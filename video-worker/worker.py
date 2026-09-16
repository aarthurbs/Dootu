"""Trabalhador local do Estúdio de Vídeos: valida, mede, corta e renderiza.

Lado local do contrato descrito em docs/video-ops/CONTRATO_TRABALHADOR.md. O navegador
descreve trabalho num job.json; este script executa e relata num result.json. Nenhum dos
dois publica, nenhum dos dois recebe segredo, e não há servidor, porta nem processo
residente envolvido.

Tipos de job atendidos nesta fase:
  ingest         valida o original, mede e calcula o SHA-256 (nada é produzido);
  render_variant corta o trecho e renderiza um MP4 vertical 1080x1920 H.264/AAC.

`transcribe` e `render_master` existem no contrato mas NÃO estão implementados aqui: o job
volta com o código `unsupported_type` em vez de fingir sucesso.

Regras que este arquivo faz questão de cumprir:
  - só opera dentro de --root; caminho absoluto externo, ".." ou link que escapa é recusado
    DEPOIS de resolver o caminho real (realpath), nunca só por inspeção do texto;
  - nenhum comando é montado por concatenação de string vinda do JSON: todo argumento do
    FFmpeg é literal deste arquivo, número validado ou caminho já resolvido dentro da raiz;
  - subprocesso sempre por lista, nunca shell=True;
  - o original é imutável: aberto somente para leitura;
  - escrita atômica (.part -> flush -> fsync -> os.replace), com `-f mp4` explícito porque
    o FFmpeg não deduz container pela extensão ".part";
  - result.json é gravado no sucesso E na falha;
  - idempotente pelo par (jobId, input.sha256): o mesmo trabalho não duplica saída;
  - sem rede. Não acessa TikTok, Instagram, YouTube nem qualquer host.

Uso:
    py -3.12 video-worker\\worker.py --root "<pasta raiz>" --job _jobs\\pending\\job_x.json
    py -3.12 video-worker\\worker.py --root "<pasta raiz>"        (varre _jobs\\pending)
"""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys

# Modulo PURO (sem rede, sem subprocess, sem FFmpeg): importado so para saber ONDE a
# fonte empacotada mora. A dependencia e nesta direcao de proposito -- o captions.py
# nao importa o worker, para um formatador de texto nao arrastar o mundo do lote.
import captions

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Caminho já validado do projeto. Não duplicar binário e não mexer no PATH global.
FFMPEG = os.path.join(REPO, "video-apresentacao", "_tools", "imageio_ffmpeg",
                      "binaries", "ffmpeg-win-x86_64-v7.1.exe")

CONTRACT_VERSION = 1
OUT_W = 1080
OUT_H = 1920
# Cor do letterbox do 9:16 quando NÃO há miniatura. Espelha o `TOKENS.fundo` do
# studio/src/preset.js: os dois renderizadores pintam a mesma cor, e o test_serve (bloco 26)
# lê o preset.js e reprova se um dos dois mudar sozinho.
# `#RRGGBB` passa cru dentro do filter_complex e sai exato — medido nesta máquina, o pixel do
# letterbox volta 10,10,12 = 0x0A0A0C. Não precisa converter para a forma `0x`.
# Aqui moravam BLUR_DIV/BLUR_SIGMA, os botões do fundo desfocado; o desfoque saiu em
# 2026-08-27 (ver _reframe_chain) e os dois ficaram sem uso.
FUNDO_COR = "#0A0A0C"
# Raio dos cantos do vídeo deitado, em pixels do quadro 1080x1920. Espelha o
# `TOKENS.videoRaio` do studio/src/preset.js — mesma disciplina do FUNDO_COR acima, com
# check de paridade no test_serve: se um dos dois mudar sozinho, o mesmo corte sai com canto
# diferente em cada renderizador, calado.
# É o MESMO número do `cardRaio` de propósito: dois retângulos arredondados no mesmo quadro
# com raios diferentes leem como descuido, não como intenção.
# Só vale no `blur` (ver _round_corners): no 1:1 e no 4:5 o vídeo tem a largura do quadro
# inteiro, então arredondar abriria entalhe escuro na BORDA do que foi exportado.
# Botão de calibragem: 0 devolve o canto reto, nos dois renderizadores.
VIDEO_RAIO = 28
# Fundo por MINIATURA (o caminho novo, quando o vídeo veio do YouTube pelo baixador). Estes
# dois são o botão de calibragem do fundo: escurecem e dessaturam a miniatura para ela ficar
# ATRÁS do vídeo, não ao lado dele.
#
# O escurecimento é MULTIPLICATIVO (colorchannelmixer), não subtrativo (eq=brightness).
# Medido olhando frame: `eq=brightness=-0.50` tira 128 de 255 de TODO pixel, então uma
# miniatura escura — que é metade dos podcasts — virava preto puro e o fundo sumia junto com
# a razão de ele existir. Multiplicar escurece na mesma proporção em toda a imagem:
# a clara para de disputar com o vídeo e a escura continua reconhecível.
#
# 0,42 -> 0,18 em 2026-09-03: olhando um corte real, as duas tarjas mostravam a miniatura
# NÍTIDA, com a manchete dela legível DUAS vezes. Não lê como moldura, lê como três imagens
# empilhadas — duas com título próprio disputando com a legenda e com o card do título.
THUMB_LUZ = 0.18
THUMB_SATURACAO = 0.55
# Desfoque da MINIATURA (só dela: a imagem de fundo tem UM quadro, então o `gblur` custa uma
# vez por corte e não por quadro). É o que apaga o texto da miniatura sem apagar a imagem.
#
# Isto NÃO reintroduz o desfoque removido em 2026-08-27: aquele borrava a TIRA CENTRAL do
# vídeo (`scale=108:192:increase,crop`), cuja armadilha medida era o topo virar teto escuro e
# a base virar mesa iluminada. Aqui o alvo é a miniatura, que é uma imagem só.
#
# O par em CSS é `TOKENS.fundoDesfoque = 28` no preset.js, e os dois números são o MESMO
# desfoque em unidades diferentes: o CSS define `blur(<r>)` como uma gaussiana de desvio
# padrão r/2, então `blur(28px)` == `gblur=sigma=14`. O check de paridade do test_serve cobra
# `fundoDesfoque == 2 * THUMB_DESFOQUE_SIGMA`, não igualdade.
THUMB_DESFOQUE_SIGMA = 14
# Alvo de loudness do feed. Medido no arquivo entregue que abriu o PLANO: -21,0 LUFS, ou seja
# ~7 dB abaixo do que TikTok/Reels entregam ao lado. `LOUDNORM` é o botão de calibragem.
LOUDNORM = "loudnorm=I=-14:TP=-1.5:LRA=11"
# Desfecho do passe de áudio. Conjunto FECHADO pela mesma razão do `serve.CAPTION_STATES`:
# ele sai num cabeçalho HTTP (X-Clip-Audio) e precisa ter frase do outro lado, na tela.
AUDIO_OK, AUDIO_SEM_FAIXA, AUDIO_FAILED = "normalizado", "AUDIO_SEM_FAIXA", "AUDIO_NORM_FAILED"
AUDIO_STATES = (AUDIO_OK, AUDIO_SEM_FAIXA, AUDIO_FAILED)
# Tags de cor do arquivo entregue. MEDIDO neste build (ffmpeg-N-125365-g9a01c1cb6a-win64-gpl),
# fonte testsrc2, a mesma cadeia do build_filter:
#   -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
#       -> color_transfer e color_primaries saem `unknown`. As duas flags são IGNORADAS,
#          em qualquer ordem e com/sem `-profile:v high -level 4.0`.
#   setparams no fim da cadeia de filtro
#       -> as QUATRO tags saem certas, e também no h264_qsv (que existe nesta máquina).
# Daí o filtro ser o lugar: é o único ponto do 9:16 que já tem dono único (build_filter), e
# flag que o build ignora ficaria no código parecendo que faz algo.
# Por que importa: o clipe medido saía `bt470bg`/`range=pc` (BT.601 faixa cheia, herdado do
# quadro JPEG do Remotion) enquanto o conteúdo foi desenhado em BT.709 — o transcodificador
# do TikTok assume 709 limitado e o resultado é deslocamento de cor e preto lavado.
COR_TAGS = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
# A MESMA coisa que o COR_TAGS, dita em outro lugar: filtro para quem RECODIFICA, bitstream
# para quem COPIA. O caminho Remotion nao passa pelo build_filter -- ele emite
# `-color_primaries`/`-color_trc` como flag de ENCODER, que este build IGNORA (medido acima),
# e o MP4 sai com `color_transfer`/`color_primaries` em `unknown`. Reescrever o VUI do SPS
# conserta as duas sem recodificar: medido em 2026-09-04 sobre um render real, +0 bytes.
# Os `1` sao os enums H.264 para BT.709; `video_full_range_flag=0` e faixa limitada.
COR_BSF = ("h264_metadata=colour_primaries=1:transfer_characteristics=1"
           ":matrix_coefficients=1:video_full_range_flag=0")


def band_height(video_h):
    """Altura de UMA tarja (a de cima e a de baixo são iguais), ou 0 se o vídeo enche o quadro.

    Dono ÚNICO desta conta: o filtro do FFmpeg e os props do Remotion saem os dois daqui,
    então os dois renderizadores não podem enquadrar a miniatura em lugares diferentes —
    mesma disciplina do `captions.margem_inferior`, que já é dono único da âncora da legenda.
    Um 16:9 deitado no 1080x1920 ocupa 607 px, então cada tarja tem 656.
    """
    try:
        altura = int(video_h)
    except (TypeError, ValueError):
        return 0
    return max(0, (OUT_H - altura) // 2)
# Tolerância de duração declarada: ~7 quadros a 30 fps. O recorte com recodificação erra
# menos que isso, mas o empacotamento do AAC pode esticar o fim alguns milissegundos.
TOLERANCE_SEC = 0.25
# Enquadramentos do 9:16. Conjunto FECHADO e dono único: o `serve.PROFILES` DERIVA daqui
# (`REFRAMES + ("horizontal",)`) e o preset.js/video-ops.js espelham a lista, com check de
# paridade — duas listas mantidas à mão divergiriam e o mesmo valor passaria a valer num lado
# e não no outro.
#
# `crop11`/`crop45` são o `blur` com a fonte PRÉ-RECORTADA, não variantes do `crop`: eles
# deitam a fonte no meio e têm tarja; o `crop` preenche o quadro e não tem. Ver _reframe_chain.
REFRAMES = ("blur", "crop", "crop11", "crop45")
# Proporção do quadro visível, como (alto, largo). `blur` está AUSENTE de propósito: nele a
# fonte deita inteira, então a proporção é a da FONTE, não uma escolhida aqui.
#
# O recorte é pago em reamostragem, e é isso que decide qual perfil preferir. De uma fonte
# 1920x1080: `blur` usa 1920x1080 (escala 0,56x, o mais nítido), `crop11` usa 1080x1080
# (1,00x — NATIVO, sem um único pixel interpolado), `crop45` usa 864x1080 (1,25x) e `crop`
# usa 607x1080 (1,78x, ampliação que aparece). O `serve.source_scale` é quem faz essa conta.
REFRAME_RATIO = {"crop": (16, 9), "crop11": (1, 1), "crop45": (5, 4)}
# Ausente ou desconhecido cai aqui, nos validadores de cada camada: todo trecho salvo antes
# do seletor de enquadramento tem de sair EXATAMENTE como sai hoje.
REFRAME_PADRAO = "blur"
IMPLEMENTED_TYPES = ("ingest", "render_variant")
CONTRACT_TYPES = ("ingest", "transcribe", "render_master", "render_variant")
# Estimativa conservadora de espaço: 1080x1920 H.264 fica perto de 1 MB/s; pedimos 1,5.
BYTES_PER_SEC = 1_500_000
MIN_NEEDED_BYTES = 8 * 1024 * 1024
MAX_CUT_SEC = 600.0

# Códigos estáveis para automação; a mensagem é o português que o operador lê.
# O estilo segue o contrato (`probe_failed`), não UPPER_SNAKE.
ERROR_CODES = (
    "job_invalid",          # job.json sem campo obrigatório ou com valor fora do domínio
    "contract_version",     # contractVersion diferente do suportado
    "unsupported_type",     # tipo previsto no contrato mas não implementado nesta fase
    "path_outside_root",    # caminho absoluto externo, "..", link ou volume fora da raiz
    "input_missing",        # arquivo de entrada não existe
    "input_empty",          # arquivo existe mas está vazio
    "input_not_source",     # entrada aponta para uma variante já renderizada
    "probe_failed",         # não há faixa de vídeo legível (arquivo inválido ou corrompido)
    "hash_mismatch",        # o arquivo mudou desde que o navegador calculou o hash
    "cut_invalid",          # início/fim ausente, negativo, invertido ou fora da duração
    "no_space",             # espaço livre insuficiente para produzir a saída
    "ffmpeg_failed",        # o FFmpeg retornou erro
    "output_invalid",       # o arquivo produzido não passou na conferência técnica
    "render_busy",          # a vez na fila do renderizador não chegou dentro do prazo
)


class WorkerError(Exception):
    """Erro previsto: vira `error` do result.json em vez de derrubar o processo."""

    def __init__(self, code, message):
        if code not in ERROR_CODES:
            raise AssertionError("código de erro não declarado: %r" % code)
        super().__init__(message)
        self.code = code
        self.message = message

    def as_dict(self):
        return {"code": self.code, "message": self.message}


# --------------------------------------------------------------------------- caminhos

def inside_root(root, raw, label="caminho"):
    """Resolve `raw` dentro de `root` e recusa qualquer coisa que escape.

    A checagem é feita sobre o caminho REAL (realpath resolve junction, symlink e "..").
    Comparar texto não basta: "raiz\\..\\raiz-vizinha" e um link para C:\\Windows passam
    por qualquer filtro ingênuo de string.
    """
    text = str(raw or "").strip()
    if not text:
        raise WorkerError("path_outside_root", "%s vazio no job." % label)
    if "\x00" in text:
        raise WorkerError("path_outside_root", "%s contém caractere nulo." % label)
    candidate = text if os.path.isabs(text) else os.path.join(root, text)
    real_root = os.path.realpath(root)
    real = os.path.realpath(candidate)
    try:
        common = os.path.commonpath([real_root, real])
    except ValueError:
        # Volumes diferentes (ex.: raiz em G: e caminho em C:) nem são comparáveis.
        raise WorkerError("path_outside_root",
                          "%s está em outro volume, fora da pasta raiz configurada." % label)
    if common != real_root:
        raise WorkerError("path_outside_root",
                          "%s aponta para fora da pasta raiz configurada: %s" % (label, text))
    return real


def safe_component(value, fallback="sem-nome", max_len=120):
    """Nome de arquivo seguro no Windows, sem separador de pasta.

    Espelha safeName() do video-ops.js: sem \\ / : * ? " < > |, sem controle, sem ponto ou
    espaço no fim (o Explorer os descarta calado) e sem nome reservado.
    """
    text = str(value or "")
    text = re.sub(r'[\\/:*?"<>|]', "-", text)
    text = re.sub(r"[\x00-\x1f\x7f]", "", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"-{2,}", "-", text).strip()
    text = text.strip("-. ")[:max_len].rstrip("-. ")
    if re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])", text or ""):
        text = "_" + text
    return text or fallback


# --------------------------------------------------------------------------- medição

def sha256(path, chunk=1024 * 1024):
    """Incremental: um original de 30 min não pode ser carregado inteiro na memória."""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(chunk), b""):
            digest.update(block)
    return digest.hexdigest()


def probe(path):
    """Duração, codec, resolução e áudio a partir do cabeçalho do próprio FFmpeg.

    O pacote imageio_ffmpeg do projeto não traz ffprobe e a decisão registrada
    (CONTRATO_TRABALHADOR §9) é não instalar outro binário enquanto esta leitura bastar.
    Não existe ramo alternativo de propósito: código que nunca roda não é testado.
    """
    proc = subprocess.run([FFMPEG, "-hide_banner", "-i", path],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    err = proc.stderr or ""
    duration = None
    found = re.search(r"Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)", err)
    if found:
        duration = round(int(found.group(1)) * 3600 + int(found.group(2)) * 60
                         + float(found.group(3)), 3)
    video = re.search(r"Stream #\d+:\d+.*?: Video: (\w+).*?, (\d{2,5})x(\d{2,5})", err, re.S)
    audio = re.search(r"Stream #\d+:\d+.*?: Audio: (\w+)", err, re.S)
    fps = re.search(r"(\d+(?:\.\d+)?) fps", err)
    return {
        "durationSec": duration,
        "sizeBytes": os.path.getsize(path),
        "videoCodec": video.group(1) if video else None,
        "width": int(video.group(2)) if video else None,
        "height": int(video.group(3)) if video else None,
        "audioCodec": audio.group(1) if audio else None,
        "fps": float(fps.group(1)) if fps else None,
        "probe": "ffmpeg-header",
    }


def validate_input(path, expected_sha=None):
    """Existência, tamanho, faixa de vídeo legível e (quando pedido) conferência de hash."""
    if not os.path.exists(path) or not os.path.isfile(path):
        raise WorkerError("input_missing", "Arquivo de entrada não encontrado: %s" % path)
    if os.path.getsize(path) == 0:
        raise WorkerError("input_empty", "Arquivo de entrada está vazio: %s" % path)
    info = probe(path)
    if not info["videoCodec"] or not info["width"] or not info["height"]:
        raise WorkerError("probe_failed",
                          "Arquivo sem faixa de vídeo legível (inválido ou corrompido): %s" % path)
    if info["durationSec"] is None:
        raise WorkerError("probe_failed", "Não foi possível ler a duração de %s" % path)
    digest = sha256(path)
    if expected_sha and digest != expected_sha:
        raise WorkerError("hash_mismatch",
                          "O arquivo mudou desde a marcação no navegador. "
                          "Esperado %s…, encontrado %s…" % (expected_sha[:12], digest[:12]))
    info["sha256"] = digest
    return info


def ensure_space(folder, duration_sec, reserve_bytes=0):
    """Confere espaço livre ANTES de produzir. Encher o disco não é falha aceitável."""
    needed = max(MIN_NEEDED_BYTES, int((duration_sec or 0) * BYTES_PER_SEC)) + int(reserve_bytes)
    free = shutil.disk_usage(folder).free
    if free < needed:
        raise WorkerError("no_space",
                          "Espaço livre insuficiente em %s: %.1f MB disponíveis, "
                          "%.1f MB necessários." % (folder, free / 1e6, needed / 1e6))
    return {"neededBytes": needed, "freeBytes": free}


# --------------------------------------------------------------------------- escrita

def write_atomic(target, produce):
    """Escreve em .part, força ao disco e só então renomeia.

    Sem isso o Google Drive para Desktop pode sincronizar um arquivo pela metade. O .part
    fica na MESMA pasta do destino de propósito: os.replace só é atômico no mesmo volume.
    """
    part = target + ".part"
    if os.path.exists(part):
        os.remove(part)
    try:
        produce(part)
        if not os.path.exists(part) or os.path.getsize(part) == 0:
            raise WorkerError("output_invalid", "O produtor não gerou conteúdo em %s" % part)
        with open(part, "rb+") as handle:
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(part, target)
    except BaseException:
        # Falha não deixa lixo parcial para trás — nem para o Drive, nem para o operador.
        if os.path.exists(part):
            try:
                os.remove(part)
            except OSError:
                pass
        raise
    if os.path.exists(part):
        raise WorkerError("output_invalid", "O arquivo .part sobrou depois do rename.")
    return target


def write_json_atomic(target, payload):
    text = json.dumps(payload, indent=2, ensure_ascii=False)

    def produce(dest):
        with open(dest, "w", encoding="utf-8") as handle:
            handle.write(text)
    return write_atomic(target, produce)


# --------------------------------------------------------------------------- render

def build_filter(reframe, ass=None, background=None, band_h=None):
    r"""Filtro de conversão para 9:16. Recebe só um rótulo de uma lista fechada.

    `background` liga o fundo por MINIATURA: quando presente, o vídeo entra como `-i` número
    1 (ver render_cut) e a tarja de cima e a de baixo passam a mostrar a miniatura do vídeo,
    escurecida, em vez da cor chapada do fallback.

    `ass` é o NOME do arquivo de legenda (sem pasta), e o FFmpeg roda com `cwd` na pasta
    dele. É de propósito: o caminho dentro de um filtro exige escapar `\`, `:` e `'`, e em
    `C:\Users\...` isso é fonte clássica de bug no Windows. Com o cwd na pasta o filtro
    recebe só o nome — e o nome é gerado por nós a partir do token da sessão (TOKEN_RE:
    `[A-Za-z0-9_-]`), então não sobra nada para escapar.
    ponytail: nome relativo; no dia em que a legenda vier de fora do temporário, aí sim
    escrever o escapador de caminho — e testá-lo.
    """
    cadeia = _reframe_chain(reframe, background, band_h)
    # Parênteses explícitos: o `if/else` já tem precedência menor que o `+`, mas ler isso
    # de cabeça é justamente onde alguém erra depois.
    # `fontsdir=.` e a fonte EMPACOTADA, que o `_place_font` poe ao lado do .ass. Um ponto,
    # e nao o caminho da pasta do repo, pela MESMA razao do `ass=` acima: caminho dentro do
    # filtro exige escapar a barra invertida e o dois-pontos, e um C:\Users\...
    # absoluto e a armadilha classica no Windows.
    cadeia = (cadeia + ",ass=" + ass + ":fontsdir=.") if ass else cadeia
    # As tags de cor DEPOIS do ass=: o setparams só marca o quadro, não desenha nada, e
    # deixá-lo por último é o que garante que ele descreve o que sai do fim da cadeia.
    # Um ponto, os quatro perfis (ver COR_TAGS para a medição que trouxe a tag para cá).
    return cadeia + "," + COR_TAGS


def _crop_source(reframe):
    """(segmento que pré-recorta a fonte, rótulo da fonte para o resto da cadeia).

    `crop11`/`crop45` são o `blur` com a fonte pré-recortada na proporção pedida, então a
    cadeia toda que já existe é reaproveitada com UM segmento prependido — não quatro ramos
    novos. `blur` e `crop` não recortam nada e saem com `[0:v]`, byte a byte como hoje:
    o `blur` deita a fonte inteira e o `crop` já preenche o quadro com o `increase,crop`
    que sempre teve. `crop` TEM proporção em REFRAME_RATIO (o video_box e o source_scale
    precisam dela) e ainda assim não entra aqui, por isso.

    Por que o `min` dos dois lados: garante que a saída tem EXATAMENTE a proporção pedida,
    seja a fonte mais larga ou mais estreita que ela — se iw/ih > A sai `ih*A x ih`, se
    iw/ih < A sai `iw x iw/A`. Nos dois casos a proporção é A, e é por isso que a altura do
    `serve.video_box` é determinística nos perfis de recorte (1080 e 1350), independente da
    fonte, e que o `scale=...:decrease` seguinte já produz o mesmo número inteiro.
    As aspas são obrigatórias: a vírgula dentro do `min()` separaria filtros sem elas.
    """
    if reframe == "crop" or reframe not in REFRAME_RATIO:
        return "", "[0:v]"
    alto, largo = REFRAME_RATIO[reframe]
    return ("[0:v]crop='min(iw,ih*%d/%d)':'min(ih,iw*%d/%d)'[src];"
            % (largo, alto, alto, largo)), "[src]"


def _round_corners(reframe, entrada="[fgs]", saida="[fgr]"):
    r"""(segmento que arredonda os cantos do vídeo, rótulo a usar no overlay).

    Pedido do usuário (2026-09-11), no "Inteiro": a fonte deitada encostava no fundo com
    canto reto. Só o `blur` entra aqui — no 1:1 e no 4:5 o vídeo tem os 1080 de largura do
    quadro, então o canto curvo cairia na BORDA do arquivo exportado e viraria entalhe.
    Quem não arredonda recebe o rótulo de entrada de volta e sai byte a byte como saía.

    Máscara de UM quadro: `trim=end_frame=1` antes do `geq`, e o framesync do `alphamerge`
    repete o último quadro da segunda entrada (`repeatlast`) pelo clipe inteiro. É a razão
    de existir desta forma — `geq` é caro por pixel, e rodá-lo por quadro custaria mais que
    o encode. Medido nesta máquina: com o `trim` o canto volta escuro em t=0, 1,5 e 2,9 s de
    um clipe de 3 s, e o miolo continua sendo vídeo.

    `clip(...,0,1)` em vez de `if(lte(...))` de propósito: dá 1 px de meio-tom na curva,
    que é o que o `border-radius` do navegador faz no outro renderizador. Degrau duro deixa
    o canto serrilhado, e serrilhado é justamente o que aparece num corte de 1080 px.
    """
    if reframe != REFRAME_PADRAO or VIDEO_RAIO <= 0:
        return "", entrada
    # Distância para DENTRO da borda a partir da qual o canto começa a curvar: zero no meio
    # de cada lado (então o `hypot` só passa do raio nos quatro cantos) e crescendo até o
    # raio nas pontas. `W`/`H` vêm do próprio quadro, e é por isso que a máscara nasce do
    # vídeo já escalado e não de um `color=` de tamanho calculado aqui: o `scale=decrease`
    # arredonda a altura por conta dele, e um pixel de diferença faria o alphamerge falhar.
    dx = "max(max(%d-X,X-(W-1-%d)),0)" % (VIDEO_RAIO, VIDEO_RAIO)
    dy = "max(max(%d-Y,Y-(H-1-%d)),0)" % (VIDEO_RAIO, VIDEO_RAIO)
    alfa = "255*clip(%d+0.5-hypot(%s,%s),0,1)" % (VIDEO_RAIO, dx, dy)
    return (entrada + "split=2[fgv][fgm];"
            "[fgm]trim=end_frame=1,format=gray,geq=lum='" + alfa + "'[fgmask];"
            "[fgv]format=yuva420p[fgva];"
            "[fgva][fgmask]alphamerge" + saida + ";"), saida


def _reframe_chain(reframe, background=None, band_h=None):
    recorte, src = _crop_source(reframe)
    deita = reframe in REFRAMES and reframe != "crop"
    arredonda, fg = _round_corners(reframe)
    if deita and background and band_h:
        # Miniatura no tamanho de UMA TARJA, repetida em cima e embaixo — em vez de UMA
        # miniatura esticada para cobrir os 1080x1920 inteiros.
        #
        # Por que mudou (2026-09-01, pedido do usuário olhando um corte real): cobrir o
        # quadro inteiro amplia a miniatura ~3,2x e recorta 68% da largura dela, então cada
        # tarja mostrava uma FATIA gigante e sem sentido — num caso medido, o título da
        # miniatura ("INVISTA") aparecia em letras enormes, cortado no meio. No tamanho da
        # tarja a miniatura aparece INTEIRA, duas vezes, e volta a ser reconhecível.
        #
        # Custo medido: a tarja é 1080x656 (proporção 1,65) e a miniatura é 16:9 (1,78),
        # então encher a tarja corta 43 px de CADA lado — 4% da largura. É o preço de não
        # deixar faixa vazia entre a miniatura e o vídeo. Para preservar a miniatura inteira
        # e aceitar a faixa, troque `increase` por `decrease` e o `crop` por um `pad`.
        #
        # [canvas] existe para carregar o RELÓGIO: o `overlay` produz um quadro por quadro da
        # entrada de baixo, e a miniatura tem um quadro só (a 25 fps por padrão do
        # decodificador de imagem). Com a miniatura embaixo, um original de 30 fps sairia
        # reamostrado para 25 e perderia quadro.
        # "O conteúdo de [canvas] é irrelevante" vale ENQUANTO as duas tarjas mais o vídeo o
        # cobrem inteiro — e o canto arredondado é exatamente o que abre buraco nessa conta.
        # MEDIDO ao ligar o raio: o pixel (2,658), 2 px abaixo da tarja, voltava vermelho
        # vivo — era o vídeo CRU esticado para 1080x1920 aparecendo pelo canto. Por isso a
        # chapa: no raio 0 ela não entra e a cadeia fica byte a byte como era.
        chapa = ("drawbox=color=%s:t=fill," % FUNDO_COR) if arredonda else ""
        return recorte + (
            "%ssplit=2[base][fg];"
            "[base]scale=%d:%d,%ssetsar=1[canvas];"
            "[1:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
            # O desfoque entra DEPOIS do corte da tarja (borrar antes desperdiçaria pixel
            # que vai ser jogado fora) e ANTES do escurecimento, para o `gblur` misturar as
            # cores originais e não as já achatadas.
            "gblur=sigma=%d,"
            "eq=saturation=%.2f,colorchannelmixer=rr=%.2f:gg=%.2f:bb=%.2f,split=2[t1][t2];"
            "[canvas][t1]overlay=0:0[b1];"
            "[b1][t2]overlay=0:H-h[bg];"
            "[fg]scale=%d:%d:force_original_aspect_ratio=decrease[fgs];"
            % (src, OUT_W, OUT_H, chapa, OUT_W, band_h, OUT_W, band_h, THUMB_DESFOQUE_SIGMA,
               THUMB_SATURACAO, THUMB_LUZ, THUMB_LUZ, THUMB_LUZ, OUT_W, OUT_H)
        ) + arredonda + ("[bg]%soverlay=(W-w)/2:(H-h)/2,setsar=1" % fg)
    if deita and background:
        # Fundo = MINIATURA do vídeo, cobrindo o quadro inteiro e escurecida. Substitui o
        # desfoque porque o desfoque não era desfoque do quadro: era o desfoque da TIRA
        # CENTRAL do quadro (108 px de largura de um 16:9 esticados para 1080), e num
        # podcast a tira central tem o teto escuro em cima e a mesa iluminada embaixo — daí
        # a tarja de cima virar quase preta e a de baixo, não. Visto no frame, não deduzido.
        #
        # [canvas] existe para carregar o RELÓGIO: o `overlay` produz um quadro por quadro da
        # entrada de baixo, e a miniatura tem um quadro só (a 25 fps por padrão do
        # decodificador de imagem). Com a miniatura embaixo, um original de 30 fps sairia
        # reamostrado para 25 e perderia quadro. O conteúdo de [canvas] é irrelevante: a
        # miniatura o cobre inteiro, opaca, com o mesmo tamanho.
        return recorte + (
            "%ssplit=2[base][fg];"
            "[base]scale=%d:%d,setsar=1[canvas];"
            "[1:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
            "gblur=sigma=%d,"
            "eq=saturation=%.2f,colorchannelmixer=rr=%.2f:gg=%.2f:bb=%.2f[thumb];"
            "[canvas][thumb]overlay=0:0[bg];"
            "[fg]scale=%d:%d:force_original_aspect_ratio=decrease[fgs];"
            % (src, OUT_W, OUT_H, OUT_W, OUT_H, OUT_W, OUT_H, THUMB_DESFOQUE_SIGMA,
               THUMB_SATURACAO, THUMB_LUZ, THUMB_LUZ, THUMB_LUZ, OUT_W, OUT_H)
        ) + arredonda + ("[bg]%soverlay=(W-w)/2:(H-h)/2,setsar=1" % fg)
    if deita:
        # O rótulo mente e fica mentindo de propósito: `blur` é o nome em REFRAMES, em
        # serve.PROFILES, no FFMPEG_FILTERS do video-ops.js, no nome do arquivo baixado
        # (`-9x16-blur.mp4`) e nas suítes. Renomear tocaria cinco lugares por benefício zero,
        # então o nome fica e este comentário é o aviso para quem ler depois.
        #
        # Fundo = a cor do preset, letterbox chapado. Preserva o conteúdo inteiro (a fonte
        # cabe deitada, `decrease`), igual a antes; o que saiu é só o desfoque.
        # Por que o desfoque saiu (2026-08-27): ele nunca borrou o quadro, borrou a TIRA
        # CENTRAL dele — a armadilha medida está escrita no ramo de cima, que é quem herdou
        # o assunto. Com a legenda ancorada DENTRO do vídeo, o fundo virou moldura, e moldura
        # desfocada é enfeite. De graça: sai o `split`/`gblur`/`overlay` inteiro (~1 s por
        # corte de 30 s, na versão já otimizada em quadro reduzido).
        #
        # `crop11`/`crop45` caem aqui também, e TEM de ser assim: sem miniatura, o 1:1 e o
        # 4:5 são a fonte pré-recortada deitada sobre a cor chapada. Antes deste ramo aceitar
        # `deita` eles vazavam para o `return` final e saíam como `crop` de quadro cheio —
        # ou seja, escolher 1:1 num MP4 local do Passo 3 entregava um 9:16 recortado.
        if not arredonda:
            return recorte + ("%sscale=%d:%d:force_original_aspect_ratio=decrease,"
                              "pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=%s,setsar=1"
                              % (src, OUT_W, OUT_H, OUT_W, OUT_H, FUNDO_COR))
        # Canto arredondado sobre letterbox chapado. A placa de fundo nasce do PRÓPRIO vídeo
        # já escalado (`drawbox=t=fill` é um memset no tamanho exato), e não de um `color=`
        # com dimensão calculada aqui: a altura do `scale=decrease` é arredondada pelo
        # FFmpeg, e um pixel de diferença faria o `alphamerge` recusar as duas entradas.
        # O `pad` continua sendo quem monta o quadro — o letterbox é o mesmo de sempre, e é
        # por isso que este ramo não virou `overlay` sobre tela cheia.
        return recorte + (
            "%sscale=%d:%d:force_original_aspect_ratio=decrease,split=2[fgs][fgbg];"
            "[fgbg]drawbox=color=%s:t=fill[flat];"
            % (src, OUT_W, OUT_H, FUNDO_COR)
        ) + arredonda + (
            "[flat]%soverlay=0:0,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=%s,setsar=1"
            % (fg, OUT_W, OUT_H, FUNDO_COR)
        )
    # Alternativa simples: reenquadramento central. Corta as laterais, sem rastreamento.
    return ("[0:v]scale=%d:%d:force_original_aspect_ratio=increase,"
            "crop=%d:%d,setsar=1" % (OUT_W, OUT_H, OUT_W, OUT_H))


def run_ffmpeg(args, timeout=None, cwd=None):
    """timeout=None mantém o comportamento do lote: esperar o que o corte precisar.

    O servidor local (serve.py) passa um teto porque lá o FFmpeg atende uma requisição
    do navegador — um processo travado prenderia a thread para sempre.

    `cwd` existe só para o filtro `ass=`: ver build_filter. Todo o resto dos caminhos que
    passam por aqui é absoluto, então mudar a pasta de trabalho não afeta mais nada.
    """
    try:
        proc = subprocess.run([FFMPEG] + args, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout, cwd=cwd)
    except subprocess.TimeoutExpired:
        raise WorkerError("ffmpeg_failed",
                          "O FFmpeg passou de %ss e foi encerrado." % timeout)
    if proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-6:]
        raise WorkerError("ffmpeg_failed",
                          "O FFmpeg falhou (código %d): %s" % (proc.returncode, " / ".join(tail)))
    return proc.stderr or ""


def video_encoder_args():
    """Encoder do 9:16 — o arquivo que vai ao ar. x264 em `slow`, e só.

    Chamada SÓ pelo `render_cut`, ou seja só no 9:16: o `serve.horizontal_args` monta os
    argumentos dele por conta própria e nunca passou por aqui.

    Até 2026-09-03 isto sondava o `h264_qsv` da Intel e o preferia quando existia. Duas
    trocas, nesta ordem:

    - **QSV saiu.** Nesta máquina (i5, Optiplex 3070) o probe passava, então TODO 9:16 baixado
      no Passo 3 vinha de encode de hardware a `-global_quality 22`, que entrega menos
      qualidade por bit que o x264. Hardware é a troca certa quando o alvo é tempo; aqui o
      alvo é o arquivo que o TikTok vai reencodar. O plano dizia "QSV restrito ao horizontal",
      mas restringir a um caminho que nunca o usou seria ACRESCENTAR encode de hardware onde
      o plano manda não tocar — então ele simplesmente deixou de ser usado, e o probe foi
      apagado por não ter mais chamador (BP-007).
    - **`veryfast` -> `slow`, `crf 20` -> `18`.** O `veryfast` sacrifica bastante qualidade por
      bit, e este é o único encode do caminho FFmpeg. Custa tempo dentro do `render_lock`,
      que é único e sem timeout — sabido, e registrado no CLAUDE.md.
    """
    return ["-c:v", "libx264", "-preset", "slow", "-crf", "18"]


def finish_video(src, dest, timeout=None):
    """Passe de acabamento: audio a -14 LUFS e tag de cor, com o video em `copy`.

    Devolve um AUDIO_STATES e NUNCA levanta. Por que nao levanta: quem chama e o
    `serve._send_video`, no caminho de um download que ja deu certo. Falhar aqui nao e motivo
    para nao entregar o video -- entrega-se o original e o estado diz o que nao rolou
    (BP-008). Dai o desfecho ser um valor de conjunto fechado, e nao uma excecao.

    O nome NAO e `normalize_audio` de proposito: uma funcao que se chama assim e tambem
    reescreve tag de cor e a mentira que produz o proximo bug. O conjunto de retorno continua
    sendo sobre AUDIO (`AUDIO_SEM_FAIXA` continua sendo verdade), porque e ele que vira frase
    na tela pelo cabecalho X-Clip-Audio.

    `-c:v copy` e o que impede uma SEGUNDA geracao de imagem: o passe toca o audio e o VUI do
    bitstream, nunca os pixels. Medido no clipe real de 74 s que abriu o plano de qualidade:
    -21,0 -> -14,3 LUFS em 11 s de parede (~0,15 s por segundo de clipe), faixa de video byte
    a byte igual (mesmo pix_fmt, mesmos 2220 quadros). Passe UNICO de proposito: o loudnorm e
    dinamico e acerta dentro de ~0,3 dB, e dois passes custariam o dobro pela fracao.

    Os DOIS ramos produzem `dest`. O ramo sem audio saia antes com um `return`, e por ali o
    clipe sem faixa nunca receberia a correcao de cor -- calado. Corte de podcast sempre tem
    audio, mas o `/api/video-cut` aceita MP4 local qualquer, entao o ramo e alcancavel.
    """
    try:
        info = probe(src)
        # O `-bsf:v h264_metadata` FALHA em stream que nao e H.264, e a falha derrubaria o
        # passe inteiro -> AUDIO_NORM_FAILED -> o clipe sairia sem normalizar o AUDIO, que e
        # audivel e importa muito mais que duas tags informativas. Nao-H.264 perde so a tag.
        cor = ["-bsf:v", COR_BSF] if info.get("videoCodec") == "h264" else []
        tem_audio = bool(info.get("audioCodec"))
        if not tem_audio:
            # Corte sem audio. Nao e erro, e dizer isso nao e erro: o `-af` num arquivo sem
            # faixa faria o FFmpeg falhar e o estado sairia como falha, que seria mentira.
            #
            # O `videoCodec` e o que separa os dois casos, e separar e obrigatorio: o `probe`
            # le o cabecalho do stderr do FFmpeg e NAO levanta em arquivo ilegivel -- ele
            # devolve tudo `None`. Sem esta guarda um MP4 truncado sairia como "nao tem
            # audio", que e a colapsagem de dois motivos distintos num so que o conjunto
            # fechado existe para impedir (a mesma razao do CAPTIONS_NOT_AVAILABLE x
            # CAPTIONS_EXTRACTION_FAILED). Medido: um arquivo com o texto "nao sou mp4"
            # dentro devolvia AUDIO_SEM_FAIXA.
            if not info.get("videoCodec"):
                raise WorkerError("probe_failed", "Arquivo ilegível para o passe de áudio.")
        faixa = (["-af", LOUDNORM, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
                 if tem_audio else ["-an"])
        run_ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", src,
                    "-c:v", "copy"] + cor + faixa
                   + ["-movflags", "+faststart", "-f", "mp4", dest], timeout=timeout)
        if not os.path.getsize(dest):
            raise WorkerError("output_invalid", "O passe de acabamento saiu vazio.")
        return AUDIO_OK if tem_audio else AUDIO_SEM_FAIXA
    except Exception as err:
        print("[audio] acabamento ignorado (%s): %s" % (src, err), file=sys.stderr)
        return AUDIO_FAILED


def _place_font(pasta):
    """Copia a fonte empacotada para AO LADO do .ass, para o filtro receber `fontsdir=.`.

    Por que copiar em vez de apontar `fontsdir` direto para `video-worker/fonts`: o valor vai
    DENTRO do filter_complex, e um caminho absoluto do Windows exige escapar a barra invertida
    e o dois-pontos -- a armadilha classica que o `ass=` ja evita rodando com `cwd` na pasta
    do arquivo. Com a fonte ao lado, o valor e um ponto e nao sobra nada para escapar. Sao
    420 KB por corte, contra megabytes de video.

    Arquivo AUSENTE nao levanta: e o caso que o `captions.font_available()` reporta na tela
    como `burned-sem-inter`, e o corte tem de sair mesmo assim. Falha de COPIA levanta: se o
    .ass acabou de ser escrito nesta pasta e a fonte nao entra, e disco cheio ou permissao, e
    engolir devolveria o corte em Arial CALADO -- o defeito que a fonte empacotada existe
    para matar.
    """
    # TODAS as fontes do registro, e nao so a do estilo padrao: o `fontsdir=.` do filtro
    # aponta para a PASTA, e escolher o arquivo aqui exigiria carregar o estilo resolvido do
    # corte ate dentro do worker. Sao ~800 KB por corte contra megabytes de video, e a
    # alternativa era o estilo `impacto` cair em Arial CALADO.
    for fonte in sorted({f["arquivo"] for f in captions.LEGENDA_FONTES.values()}):
        origem = os.path.join(captions.FONTE_DIR, fonte)
        if os.path.isfile(origem):
            shutil.copyfile(origem, os.path.join(pasta, fonte))


def render_cut(src, dest, start, duration, reframe, has_audio, timeout=None, ass_file=None,
               background=None, band_h=None):
    """Renderiza UM corte vertical direto do original.

    Toda variante nasce do original: nada aqui aceita a saída de outra plataforma como
    entrada, então não existe recodificação em cascata entre TikTok e Instagram.

    `ass_file` é o caminho de um .ass já pronto, com o relógio JÁ zerado no começo do corte
    (`-ss` antes de `-i` faz o filtro enxergar o corte começando em 0). Ausente = render sem
    legenda, exatamente como antes — é o caminho do lote e o do vídeo sem legenda.

    `background` é o caminho de uma IMAGEM (a miniatura do vídeo no YouTube, gravada pelo
    baixador ao lado do arquivo). Presente, ela vira o fundo do 9:16; ausente, o fundo é a
    cor chapada do preset (FUNDO_COR) — que é o caminho do lote e o do MP4 local, que não
    têm miniatura nenhuma. Até 2026-08-27 esse ramo era um desfoque; ver _reframe_chain.
    """
    pasta = nome = None
    if ass_file:
        pasta, nome = os.path.split(os.path.abspath(ass_file))
        _place_font(pasta)
    filtro = build_filter(reframe, nome, background, band_h)
    args = [
        "-hide_banner", "-loglevel", "error", "-y",
        # -ss antes de -i busca rápido; com recodificação o FFmpeg ainda entrega
        # precisão de quadro. -t depois de -i limita a duração da SAÍDA.
        "-ss", "%.3f" % start, "-i", src,
    ]
    # Entrada 1 SÓ se o filtro realmente a usa: o perfil `crop` preenche o quadro sozinho e
    # não tem tarja para a miniatura ocupar. Perguntar ao filtro (em vez de repetir aqui a
    # lista de perfis que usam fundo) mantém as duas decisões no mesmo lugar — e não deixa
    # um `-i` pendurado que ninguém lê.
    if background and "[1:v]" in filtro:
        # Sem `-loop`: a imagem tem um quadro e o `overlay` repete o último
        # (eof_action=repeat, o padrão) pelo clipe inteiro. Quem manda na duração é o `-t`.
        args += ["-i", background]
    args += [
        "-t", "%.3f" % duration,
        "-filter_complex", filtro,
    ] + video_encoder_args() + [
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
    ]
    if has_audio:
        args += ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
    else:
        # Original sem áudio não ganha faixa muda inventada: a ausência é relatada.
        args += ["-an"]
    args += [
        "-movflags", "+faststart",
        # Obrigatório: escrevendo em ".part" o FFmpeg não deduz o container pela extensão
        # e aborta com "Unable to choose an output format".
        "-f", "mp4", dest,
    ]
    run_ffmpeg(args, timeout=timeout, cwd=pasta)


def check_output(path, expect_duration, expect_audio):
    """Conferência técnica do arquivo produzido. Sem isso "gravei" é só uma afirmação."""
    info = probe(path)
    problems = []
    if info["width"] != OUT_W or info["height"] != OUT_H:
        problems.append("resolução %sx%s (esperado %dx%d)"
                        % (info["width"], info["height"], OUT_W, OUT_H))
    if info["videoCodec"] != "h264":
        problems.append("codec de vídeo %s (esperado h264)" % info["videoCodec"])
    if expect_audio and info["audioCodec"] != "aac":
        problems.append("codec de áudio %s (esperado aac)" % info["audioCodec"])
    if not expect_audio and info["audioCodec"]:
        problems.append("faixa de áudio inesperada (%s) num original sem áudio" % info["audioCodec"])
    if info["durationSec"] is None:
        problems.append("duração ilegível")
    elif abs(info["durationSec"] - expect_duration) > TOLERANCE_SEC:
        problems.append("duração %.3fs (esperado %.3fs, tolerância %.2fs)"
                        % (info["durationSec"], expect_duration, TOLERANCE_SEC))
    if problems:
        raise WorkerError("output_invalid", "Arquivo gerado reprovado: " + "; ".join(problems))
    return info


# --------------------------------------------------------------------------- contrato

def require(job, key):
    if key not in job:
        raise WorkerError("job_invalid", "job.json sem campo obrigatório: %s" % key)
    return job[key]


def positive_number(raw, label, allow_zero=True):
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise WorkerError("cut_invalid", "%s não é um número: %r" % (label, raw))
    if not math.isfinite(value):
        raise WorkerError("cut_invalid",
                          "%s precisa ser um número finito (recebido %r)." % (label, raw))
    if value < 0 or (not allow_zero and value == 0):
        raise WorkerError("cut_invalid",
                          "%s precisa ser maior que zero (recebido %s)." % (label, value))
    return value


def validate_job(job):
    """Valida a forma do job antes de tocar em disco ou chamar o FFmpeg."""
    if not isinstance(job, dict):
        raise WorkerError("job_invalid", "job.json não contém um objeto JSON.")
    for key in ("contractVersion", "jobId", "type", "state", "attempts", "maxAttempts", "input"):
        require(job, key)
    if job["contractVersion"] != CONTRACT_VERSION:
        raise WorkerError("contract_version",
                          "Este trabalhador atende o contrato %d; o job pede %r."
                          % (CONTRACT_VERSION, job["contractVersion"]))
    if not isinstance(job["jobId"], str) or not job["jobId"].strip():
        raise WorkerError("job_invalid", "jobId ausente ou vazio.")
    if job["type"] not in CONTRACT_TYPES:
        raise WorkerError("job_invalid", "tipo de job fora do contrato: %r" % job["type"])
    if job["type"] not in IMPLEMENTED_TYPES:
        raise WorkerError("unsupported_type",
                          "O tipo %r existe no contrato mas ainda não foi implementado. "
                          "Nada foi produzido." % job["type"])
    if not isinstance(job["input"], dict):
        raise WorkerError("job_invalid", "job.json sem objeto input.")
    # Esclarecimento do contrato §3/§6: o sha256 da entrada é OBRIGATÓRIO em
    # render_variant — ali ele é a chave de idempotência e a garantia de que o arquivo não
    # mudou desde a marcação. Em `ingest` ele é OPCIONAL, porque é o próprio ingest que
    # calcula esse hash; exigi-lo seria pedir ao navegador um dado que ele ainda não tem.
    # A idempotência do ingest continua valendo pelo jobId.
    if job["type"] != "ingest" and not str(job["input"].get("sha256") or "").strip():
        raise WorkerError("job_invalid",
                          "job.json de %s precisa do sha256 da entrada (idempotência). "
                          "Rode um job 'ingest' primeiro." % job["type"])
    return job


def cut_from_options(options, source_duration):
    """Extrai e valida o recorte. Nenhum destes números vai cru para linha de comando."""
    if "inSec" not in options or "outSec" not in options:
        raise WorkerError("cut_invalid", "O job de render precisa de inSec e outSec.")
    start = positive_number(options.get("inSec"), "inSec")
    end = positive_number(options.get("outSec"), "outSec", allow_zero=False)
    if end <= start:
        raise WorkerError("cut_invalid",
                          "O fim (%.3fs) precisa ser maior que o início (%.3fs)." % (end, start))
    if source_duration is not None and end > source_duration + TOLERANCE_SEC:
        raise WorkerError("cut_invalid",
                          "O fim (%.3fs) passa da duração do vídeo (%.3fs)." % (end, source_duration))
    duration = end - start
    if duration > MAX_CUT_SEC:
        raise WorkerError("cut_invalid",
                          "Recorte de %.1fs acima do teto de %.0fs desta fase."
                          % (duration, MAX_CUT_SEC))
    return start, end, duration


def results_dir(root):
    folder = os.path.join(root, "_results")
    os.makedirs(folder, exist_ok=True)
    return folder


def previous_result(root, job_id):
    path = os.path.join(results_dir(root), safe_component(job_id) + ".json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def duplicate_job(root, job_id, digest):
    """Mesmo conteúdo já processado por OUTRO jobId — é informação, não erro."""
    folder = results_dir(root)
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(folder, name), encoding="utf-8") as handle:
                other = json.load(handle)
        except (OSError, ValueError):
            continue
        if other.get("jobId") == job_id or other.get("state") != "done":
            continue
        if (other.get("input") or {}).get("sha256") == digest:
            return other.get("jobId")
    return None


def build_result(job, state, media=None, artifacts=None, error=None, notes=None):
    result = {
        "contractVersion": CONTRACT_VERSION,
        "jobId": job.get("jobId") if isinstance(job, dict) else None,
        "state": state,
        "attempts": int(job.get("attempts") or 0) + 1 if isinstance(job, dict) else 1,
        "finishedAt": None,
        "input": job.get("input") if isinstance(job, dict) else None,
        "media": media,
        "artifacts": artifacts or [],
        "error": error,
    }
    if notes:
        result["notes"] = notes
    return result


def artifact_of(path, root, kind, extra=None):
    record = {
        "kind": kind,
        "path": os.path.relpath(path, root).replace("\\", "/"),
        "absPath": path,
        "sha256": sha256(path),
        "sizeBytes": os.path.getsize(path),
    }
    if extra:
        record.update(extra)
    return record


# --------------------------------------------------------------------------- execução

def do_ingest(job, root, reserve_bytes=0):
    src = inside_root(root, (job["input"] or {}).get("path"), "input.path")
    media = validate_input(src, str((job["input"] or {}).get("sha256") or "").strip())
    notes = {}
    twin = duplicate_job(root, job["jobId"], media["sha256"])
    if twin:
        notes["duplicateOfJobId"] = twin
    return build_result(job, "done", media=media,
                        artifacts=[artifact_of(src, root, "source")], notes=notes or None)


def do_render_variant(job, root, reserve_bytes=0):
    options = job.get("options") or {}
    output = job.get("output") or {}
    src = inside_root(root, (job["input"] or {}).get("path"), "input.path")
    # A variante nasce do original. Se a entrada for a saída de outra plataforma, para.
    rel_src = os.path.relpath(src, root).replace("\\", "/").lower()
    if rel_src.startswith("variantes/") or "/variantes/" in rel_src:
        raise WorkerError("input_not_source",
                          "A entrada aponta para uma variante já renderizada. Toda variante "
                          "precisa ser gerada do original ou de um mestre.")
    media = validate_input(src, str((job["input"] or {}).get("sha256") or "").strip())
    start, end, duration = cut_from_options(options, media["durationSec"])

    reframe = options.get("reframe", "blur")
    if reframe not in REFRAMES:
        raise WorkerError("job_invalid",
                          "reframe inválido: %r (use %s)." % (reframe, " ou ".join(REFRAMES)))

    folder = inside_root(root, output.get("folder") or ".", "output.folder")
    os.makedirs(folder, exist_ok=True)
    file_name = safe_component(output.get("fileName") or (job["jobId"] + ".mp4"))
    if not file_name.lower().endswith(".mp4"):
        file_name += ".mp4"
    dest = inside_root(root, os.path.join(folder, file_name), "output.fileName")

    space = ensure_space(folder, duration, reserve_bytes)
    has_audio = bool(media["audioCodec"])

    write_atomic(dest, lambda part: render_cut(src, part, start, duration, reframe, has_audio))
    out_info = check_output(dest, duration, has_audio)

    extra = {
        "variantId": str(options.get("variantId") or ""),
        "platform": str(options.get("platform") or ""),
        "placement": str(options.get("placement") or ""),
        "renderVersion": int(positive_number(options.get("renderVersion", 1),
                                            "renderVersion", allow_zero=False)),
        "reframe": reframe,
        "inSec": round(start, 3),
        "outSec": round(end, 3),
        "targetSec": options.get("targetSec"),
        "durationSec": out_info["durationSec"],
        "width": out_info["width"],
        "height": out_info["height"],
        "videoCodec": out_info["videoCodec"],
        "audioCodec": out_info["audioCodec"],
        "sourceSha256": media["sha256"],
    }
    notes = {"space": space, "toleranceSec": TOLERANCE_SEC}
    if not has_audio:
        notes["audio"] = "O original não tem faixa de áudio; a variante foi gerada sem áudio."
    return build_result(job, "done", media=media,
                        artifacts=[artifact_of(dest, root, "variant", extra)], notes=notes)


HANDLERS = {"ingest": do_ingest, "render_variant": do_render_variant}


def process_job(job, root, finished_at, reserve_bytes=0):
    """Executa um job e devolve o result.json. Nunca levanta erro previsto para fora."""
    try:
        validate_job(job)
        previous = previous_result(root, job["jobId"])
        if (previous and previous.get("state") == "done"
                and (previous.get("input") or {}).get("sha256") == job["input"].get("sha256")):
            # Idempotência: mesmo jobId + mesmo hash de entrada. O resultado anterior vale.
            previous["reused"] = True
            return previous, True
        result = HANDLERS[job["type"]](job, root, reserve_bytes)
    except WorkerError as err:
        result = build_result(job if isinstance(job, dict) else {}, "failed", error=err.as_dict())
    except OSError as err:
        result = build_result(job if isinstance(job, dict) else {}, "failed",
                              error={"code": "ffmpeg_failed",
                                     "message": "Falha de sistema de arquivos: %s" % err})
    result["finishedAt"] = finished_at
    return result, False


def move_job_file(job_path, root, state):
    """A transição de estado é a PASTA onde o arquivo está, não um campo mutável."""
    pending = os.path.join(root, "_jobs", "pending")
    if not os.path.isdir(pending):
        return None
    if os.path.dirname(os.path.realpath(job_path)) != os.path.realpath(pending):
        return None
    target_dir = os.path.join(root, "_jobs", state)
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, os.path.basename(job_path))
    os.replace(job_path, target)
    return target


def run_job_file(job_path, root, finished_at, reserve_bytes=0):
    try:
        with open(job_path, encoding="utf-8") as handle:
            job = json.load(handle)
    except (OSError, ValueError) as err:
        result = build_result({}, "failed",
                              error={"code": "job_invalid",
                                     "message": "job.json ilegível (%s)." % err})
        result["finishedAt"] = finished_at
    else:
        result, reused = process_job(job, root, finished_at, reserve_bytes)
        if reused:
            print("  = %s já concluído com o mesmo hash; nada refeito." % result.get("jobId"))
    job_id = safe_component(result.get("jobId")
                            or os.path.splitext(os.path.basename(job_path))[0])
    write_json_atomic(os.path.join(results_dir(root), job_id + ".json"), result)
    move_job_file(job_path, root, "done" if result["state"] == "done" else "failed")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Trabalhador local do Estúdio de Vídeos.")
    parser.add_argument("--root", required=True,
                        help="pasta raiz; nada é lido ou escrito fora dela")
    parser.add_argument("--job", default=None,
                        help="um job.json específico (padrão: varre _jobs/pending)")
    parser.add_argument("--finished-at", default="", help="carimbo ISO para o result.json")
    parser.add_argument("--reserve-bytes", type=int, default=0,
                        help="soma bytes à exigência de espaço livre (usado nos testes)")
    args = parser.parse_args(argv)

    if not os.path.exists(FFMPEG):
        print("FALHOU: FFmpeg do projeto não encontrado em %s" % FFMPEG)
        return 2
    root = os.path.realpath(args.root)
    if not os.path.isdir(root):
        print("FALHOU: pasta raiz inexistente: %s" % root)
        return 2

    if args.job:
        try:
            jobs = [inside_root(root, args.job, "--job")]
        except WorkerError as err:
            print("FALHOU: [%s] %s" % (err.code, err.message))
            return 2
    else:
        pending = os.path.join(root, "_jobs", "pending")
        jobs = ([os.path.join(pending, n) for n in sorted(os.listdir(pending))
                 if n.endswith(".json")] if os.path.isdir(pending) else [])
    if not jobs:
        print("Nenhum job pendente em %s" % root)
        return 0

    failures = 0
    for job_path in jobs:
        result = run_job_file(job_path, root, args.finished_at, args.reserve_bytes)
        if result["state"] == "done":
            arts = ", ".join("%s %s" % (a["kind"], a["sha256"][:12]) for a in result["artifacts"])
            print("ok      %s  %s" % (result.get("jobId"), arts or "sem artefato"))
        else:
            failures += 1
            print("FALHOU  %s  [%s] %s" % (result.get("jobId"), result["error"]["code"],
                                           result["error"]["message"]))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
