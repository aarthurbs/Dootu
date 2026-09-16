# -*- coding: utf-8 -*-
"""Servidor local do Estúdio de Vídeos: o site estático MAIS a rota POST /api/video-cut.

Por que existe: video-ops.js chama `fetch('/api/video-cut?...')` com caminho relativo
(video-ops.js:1992). O roteiro de operação subia `python -m http.server 8765`, que só
serve arquivo e responde 501 a POST — então o botão "Baixar" da revisão nunca recebia o
MP4. Este script substitui aquele comando servindo as duas coisas na MESMA origem.

O corte NÃO é reimplementado aqui. Quem valida a entrada, mede, confere espaço,
renderiza o 9:16, grava atômico e reprova saída torta continua sendo o worker.py. Este
arquivo é só o porteiro HTTP: lê a requisição, recusa o que está errado, chama as funções
que já existem e devolve os bytes.

Uso (Windows, PowerShell, na pasta do projeto):
    py -3.12 video-worker\\serve.py
    # abra http://127.0.0.1:8765/index.html

Mais restrito que o http.server padrão: escuta só em 127.0.0.1 e recusa qualquer caminho
com componente começando por ponto (.env, .git, .claude nunca saem pela porta).
"""

import argparse
import atexit
import contextlib
import functools
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, NamedTuple, Optional, Tuple
from urllib.parse import parse_qs, quote, unquote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worker  # noqa: E402  (a pasta do worker entra no path na linha acima)
import ytclip  # noqa: E402  (descoberta de cortes por URL; mesma pasta)
import captions  # noqa: E402  (cues -> ASS para queimar a legenda no 9:16)
import muapi  # noqa: E402  (detector externo OPCIONAL de trechos; inerte sem MUAPI_KEY)

ROUTE = "/api/video-cut"
# Descoberta e aquisição por URL. Separadas de propósito: ANALISAR não baixa vídeo nenhum,
# BAIXAR só roda depois que uma pessoa aprovou o trecho. Juntar as duas numa rota só faria
# a análise arrastar gigabytes que ninguém pediu.
ROUTE_PROBE = "/api/yt-probe"
ROUTE_FETCH = "/api/yt-fetch"
# Edição. O Remotion mora em studio/, com o package.json dele: o site em index.html
# continua sem npm (CLAUDE.md). Esta rota é a única ponte entre os dois, e ela chama um
# processo — não importa nada do Node para dentro do Python.
ROUTE_RENDER = "/api/remotion-render"
# O QUADRO REAL de um corte, para conferir a legenda antes de esperar um render de minutos.
# Mesma composicao, MESMOS props (`render_props`, dono unico) e `npx remotion still` em vez
# de `render`: um segundo montador de props deixaria a conferencia concordar com ela mesma e
# discordar do MP4 -- que e o unico defeito que uma previa pode ter.
ROUTE_STILL = "/api/remotion-still"
# Espelho do `TOKENS.fps` do preset.js (o `test_serve` compara os dois lendo o arquivo).
# Serve para UMA coisa: achar o quadro do MEIO do corte. O meio, e nao o primeiro quadro,
# porque o primeiro cai dentro dos 4 s do card do titulo -- a previa sairia mostrando a
# placa e nao a legenda, que e justamente o que se foi conferir.
STILL_FPS = 30
# Um still e um quadro so: minutos de orcamento nao fazem sentido aqui, e um teto curto e o
# que impede a previa de virar uma espera indistinguivel do render inteiro.
STILL_TIMEOUT = 180.0
ROUTE_MR = "/api/most-replayed"  # le o que o baixador local ja gravou; nao analisa nada
# Revisao da legenda ANTES do render final. Le as falas do MESMO sidecar (nenhuma chamada
# nova ao yt-dlp, nenhum byte de rede) e guarda a correcao que o operador digitou.
ROUTE_CAPS = "/api/clip-captions"
ROUTE_CLIP_STATUS = "/api/clip-status"  # verifica se o MP4 do clip existe na pasta permanente
# Importação da FONTE. A mudança de arquitetura desta entrega: em vez de baixar um trecho por
# vez, o Estúdio baixa o vídeo INTEIRO uma vez e todo corte sai dele. `/api/yt-import` começa
# (ou reaproveita) o download; `/api/yt-import-state` é o que a barra de progresso consulta,
# porque o download leva minutos e uma resposta HTTP não tem como contar isso enquanto corre.
ROUTE_IMPORT = "/api/yt-import"
ROUTE_IMPORT_STATE = "/api/yt-import-state"
# Estados da importação. Conjunto FECHADO, pela mesma regra do CAPTION_STATES: cada um tem
# frase correspondente no `video-ops.js` (IMPORT_MSG), e um check do test_serve.py LÊ o JS e
# reprova quem acrescentar estado aqui sem dizer o que ele significa na tela.
IMPORT_RUNNING = "importing"
IMPORT_READY = "ready"
IMPORT_ERROR = "error"
IMPORT_IDLE = "idle"
IMPORT_STATES = (IMPORT_IDLE, IMPORT_RUNNING, IMPORT_READY, IMPORT_ERROR)
# Etapas dentro do `importing`. Separadas do estado de propósito: "baixando 40%" e
# "preparando" pedem palavras diferentes na tela, e a segunda não emite progresso nenhum —
# sem nomeá-la, os últimos 2% da barra pareceriam travados.
IMPORT_STAGE_PROBE = "lendo"
IMPORT_STAGE_DOWNLOAD = "baixando"
IMPORT_STAGE_PREPARE = "preparando"
IMPORT_STAGES = (IMPORT_STAGE_PROBE, IMPORT_STAGE_DOWNLOAD, IMPORT_STAGE_PREPARE)
# Quanto espaço em disco reservar por segundo de vídeo importado. NÃO é o
# `worker.BYTES_PER_SEC` (1,5 MB/s), que está calibrado para o 9:16 que SAI: o que entra é o
# stream do YouTube, que em 1080p H.264 + m4a fica na casa de 0,4-0,55 MB/s. Com 1,5 um
# podcast de 3 h exigiria 16 GB livres e a importação seria recusada numa máquina onde ela
# caberia folgada. 0,6 MB/s cobre o caso alto com margem. Botão de calibragem.
IMPORT_BYTES_PER_SEC = 600_000
# Versão do sidecar. O DONO do formato é o `baixador/local-helper/yt_dlp_runner.py`; este
# número viaja junto só para o arquivo ficar idêntico ao que ele grava. Nada aqui decide
# nada com base nele — quem lê (`_sidecar_captions`) degrada por AUSÊNCIA de chave, não por
# versão, e é isso que faz sidecar antigo continuar abrindo.
SIDECAR_VERSION = 5
# Tetos da legenda editada. Um corte de 90 s tem umas 40 falas; 400 e folga larga e impede
# que a rota vire deposito. O texto e de UMA fala, nao de um paragrafo.
MAX_EDIT_CUES = 400
MAX_EDIT_CHARS = 300
# Quantas correcoes ficam guardadas por servidor (uma por trecho). Ninguem revisa 32 cortes
# ao mesmo tempo; passando disso, sai a mais antiga.
MAX_EDIT_SESSIONS = 32
# Onde o corte fica DEPOIS de pronto. O temporário morre com o servidor, então o clipe só
# existia enquanto a aba estava aberta: a revisão voltava do recarregamento pedindo o
# original de novo. Pasta fixa, fora do repositório, servida em CLIPS_URL — o MP4 continua
# lá (e tocável na revisão) depois de fechar o site. Quando houver banco de dados, o que
# muda é quem guarda o CAMINHO; o arquivo continua sendo do disco.
CLIPS_URL = "/clips/"
# A FONTE importada, servida ao player interno do site. Sai da MESMA pasta do sidecar
# (`_sidecar_dir`) porque é lá que a legenda e a miniatura dela moram: um segundo diretório
# faria `cut_captions` e `cut_background` deixarem de achar o que precisam, calados.
SOURCES_URL = "/sources/"
# Tamanho do pedaço lido por vez ao responder Range. 256 KB é grande o bastante para não
# fazer syscall a cada quadro e pequeno o bastante para o player abortar a leitura rápido
# quando o operador arrasta a barra — e é ele quem arrasta, várias vezes por corte.
RANGE_CHUNK = 256 * 1024
STUDIO_DIR = os.path.join(worker.REPO, "studio")
STUDIO_ENTRY = "src/index.jsx"
STUDIO_COMPOSITION = "Clip"
DEFAULT_RENDER_TIMEOUT = 900.0
# Medido nesta máquina (i5 de 6 núcleos, 1080x1920, DOIS decodes por quadro — fundo
# borrado + vídeo): 90 s de clipe = 2700 quadros em 1005 s, ou seja ~0,37 s por quadro e
# ~11 s de render por SEGUNDO de clipe. Um teto FIXO de 900 s mata calado todo clipe
# acima de ~80 s: o operador esperava 15 min para não receber arquivo nenhum.
# `RENDER_SEC_PER_CLIP_SEC` é o botão de calibragem e guarda o DOBRO do medido de
# propósito: com a máquina disputada o mesmo render passou de 1036 s e ainda falhou na
# junção por falta de memória. Teto apertado devolve exatamente o defeito que ele existe
# para evitar, então a margem fica.
RENDER_FIXED_SEC = 60.0
RENDER_SEC_PER_CLIP_SEC = 24.0
# Quanto uma requisição espera PELA VEZ dela antes de desistir. É outra grandeza que o teto
# acima: aquele limita o processo que ESTÁ rodando, este limita quem está na FILA. Sem ele o
# `with render_lock` era bloqueante e sem prazo — e com o teto proporcional um clipe de 600 s
# (o MAX_CUT_SEC) segura o lock por ~4 h, deixando um `⬇ Baixar vídeo` do Passo 3 pendurado
# sem nada na tela dizer por quê. 300 s cobre com folga um corte FFmpeg (segundos) e um render
# curto à frente na fila; passou disso é honesto dizer que a máquina está ocupada em vez de
# fingir que o download vai sair. Botão de calibragem.
RENDER_LOCK_WAIT = 300.0
# O token do trecho vira nome de arquivo no temporario e argumento de processo: mesma
# regra do TOKEN_RE, mais o ponto da extensao.
TOKEN_FILE_RE = re.compile(r"^[A-Za-z0-9_.-]{1,120}$")
# Corpo das rotas de URL: JSON curto. 64 KB já é ordens de grandeza a mais que o necessário
# e evita que a rota vire porta de upload por engano.
MAX_JSON_BYTES = 64 * 1024
# Token de sessão gerado pelo navegador (uid('render')). Lista fechada de caracteres
# porque ele também vira nome de arquivo no diretório temporário.
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
# Espelha FFMPEG_FILTERS no video-ops.js. Todos menos `horizontal` são 9:16
# (worker.build_filter). DERIVADO do `worker.REFRAMES`, nunca escrito à mão: duas listas
# mantidas em paralelo divergiriam e o mesmo valor passaria a valer num lado e não no outro —
# é por isso que `crop11`/`crop45` não precisaram ser acrescentados aqui.
PROFILES = worker.REFRAMES + ("horizontal",)
# Acima de quanta AMPLIAÇÃO a fonte sai mole. Não é número escolhido: sai da tabela de
# reamostragem do enquadramento — de uma fonte 1920x1080 o `crop45` amplia 1,25x (aceito) e é
# logo acima disso que a ampliação passa a aparecer. Uma fonte 1280x720 leva o `crop11` a
# 1,50x e o `crop45` a 1,88x, e é para esse caso que o aviso existe.
ESCALA_MOLE = 1.30
# Cor do arquivo que o Remotion entrega. LIDO no dist/ instalado (4.0.513), não na doc:
# `@remotion/renderer/dist/ffmpeg-args.js:56-67` traduz "bt709" em
#   -colorspace:v bt709 -color_primaries:v bt709 -color_trc:v bt709 -color_range tv
#   -vf zscale=matrix=709:matrixin=709:range=limited
# ou seja NÃO é só tag: há conversão real de faixa. O default é "default", que emite lista
# VAZIA — nenhuma tag e nenhuma conversão, e é exatamente daí que vinha o defeito medido no
# clipe entregue (`bt470bg` + `range=pc`, BT.601 em faixa cheia herdado do quadro JPEG,
# enquanto o conteúdo foi desenhado em BT.709 num Chrome sRGB).
RENDER_COLOR_SPACE = "bt709"
# O quadro sai do Chrome por `Page.captureScreenshot`, e no default (`jpeg` a 80) TODO quadro
# passa por um JPEG antes do H.264. `jpeg-quality=100` derruba quase toda essa perda geracional
# custando quase nada; `png` a elimina e é o que o próprio option de color-space recomenda para
# exatidão de cor, ao preço de um pipe mais gordo num render que já leva ~11 s por segundo de
# clipe nesta máquina. ESTES DOIS SÃO O BOTÃO DE CALIBRAGEM: trocar para "png" é uma linha, e
# se isso entrar o RENDER_SEC_PER_CLIP_SEC sobe junto — senão volta a armadilha de 2026-08-26,
# com clipe longo morrendo no meio e a tela mostrando erro depois de 15 minutos.
RENDER_IMAGE_FORMAT = "jpeg"
RENDER_JPEG_QUALITY = 100
DEFAULT_PORT = 8765
DEFAULT_MAX_SECONDS = 900.0
DEFAULT_MAX_UPLOAD_BYTES = 12 * 1024 ** 3
DEFAULT_FFMPEG_TIMEOUT = 900.0
CHUNK = 1024 * 1024
# Corpo que uma recusa não leu e precisa ser descartado ANTES de responder: fechar o socket
# com bytes ainda por ler faz o Windows mandar RST, o navegador perde a resposta e o
# `fetch` cai no catch genérico — o operador leria "o renderizador não está ativo" quando o
# real é "o disco está cheio" (BP-008). Descartar não escreve nada em disco.
# ponytail: teto fixo. Acima dele o reset volta a acontecer — a mensagem se perde, mas o
# disco não enche. Se um dia isso incomodar, o caminho é o navegador perguntar o espaço
# antes de subir, não drenar mais bytes.
DRAIN_LIMIT = 64 * 1024 * 1024

STATUS_BY_CODE = {
    "job_invalid": HTTPStatus.BAD_REQUEST,
    "cut_invalid": HTTPStatus.BAD_REQUEST,
    "path_outside_root": HTTPStatus.BAD_REQUEST,
    "input_empty": HTTPStatus.BAD_REQUEST,
    "probe_failed": HTTPStatus.BAD_REQUEST,
    "hash_mismatch": HTTPStatus.BAD_REQUEST,
    # 409 é o combinado do contrato: fonte não está mais em cache, o navegador reenvia
    # o arquivo (video-ops.js:1996-1999).
    "input_missing": HTTPStatus.CONFLICT,
    "input_not_source": HTTPStatus.BAD_REQUEST,
    "no_space": HTTPStatus.INSUFFICIENT_STORAGE,
    "ffmpeg_failed": HTTPStatus.INTERNAL_SERVER_ERROR,
    "output_invalid": HTTPStatus.INTERNAL_SERVER_ERROR,
    # 503 e NÃO 409: o 409 já é o combinado do contrato para "fonte saiu do cache", e o
    # navegador responde a ele REENVIANDO o arquivo inteiro (video-ops.js:2169). Um "estou
    # ocupado" com 409 faria o Passo 3 subir o MP4 de novo para ouvir a mesma recusa.
    "render_busy": HTTPStatus.SERVICE_UNAVAILABLE,
    "contract_version": HTTPStatus.BAD_REQUEST,
    "unsupported_type": HTTPStatus.BAD_REQUEST,
}


def default_clips_dir() -> str:
    """Pasta pessoal dos cortes salvos. Fora do repositório (CLAUDE.md) e fora do
    temporário, que é apagado no encerramento."""
    return os.path.join(os.path.expanduser("~"), "Videos", "Cortes Estudio")


def remove_quietly(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


# --------------------------------------------------------------------------- requisição

class CutRequest(NamedTuple):
    token: str
    profile: str
    start: float
    end: float
    output: str
    # Nome do arquivo ORIGINAL, do jeito que o navegador já mandava (o `name=` da query, que
    # até agora era ignorado). É a chave do sidecar `<nome>.mostreplayed.json` que o baixador
    # gravou — e portanto de onde sai a legenda. Fica CRU de propósito: quem endurece é o
    # _read_most_replayed, que já recusa basename diferente, ".." e caminho fora da pasta.
    name: str = ""
    # O ajuste MANUAL do corte, JÁ validado pelo `edit_of` (a query traz o JSON). `None` é
    # o automático de sempre — e é o que todo download feito antes desta entrega manda.
    edit: Optional[dict] = None

    @property
    def duration(self) -> float:
        return self.end - self.start


def _one(params: Dict[str, List[str]], key: str) -> str:
    values = params.get(key) or []
    return values[0] if values else ""


def _finite(raw: str, label: str) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise worker.WorkerError("cut_invalid", "%s não é um número: %r" % (label, raw[:40]))
    # NaN/inf passam pelo float() e viram "-ss nan" no FFmpeg. Recusar aqui (BP-004).
    if value != value or value in (float("inf"), float("-inf")):
        raise worker.WorkerError("cut_invalid", "%s não é um número finito." % label)
    return value


def parse_cut_query(raw_query: str, max_seconds: float = DEFAULT_MAX_SECONDS) -> CutRequest:
    """Único lugar que lê a query do navegador. Puro de propósito: o teste confere cada
    recusa sem abrir socket nem chamar FFmpeg."""
    params = parse_qs(raw_query, keep_blank_values=True)
    token = _one(params, "token")
    if not TOKEN_RE.match(token):
        raise worker.WorkerError("job_invalid", "Token da sessão inválido.")
    profile = _one(params, "profile") or "horizontal"
    if profile not in PROFILES:
        raise worker.WorkerError("job_invalid", "Perfil não reconhecido: %r." % profile[:20])
    start = _finite(_one(params, "start"), "start")
    end = _finite(_one(params, "end"), "end")
    if start < 0:
        raise worker.WorkerError("cut_invalid", "O início do corte não pode ser negativo.")
    if end <= start:
        raise worker.WorkerError("cut_invalid", "O fim do corte tem de ser depois do início.")
    if end - start > max_seconds:
        raise worker.WorkerError(
            "cut_invalid",
            "Corte de %.1fs passa do teto de %.0fs desta rota." % (end - start, max_seconds))
    # safe_component é o mesmo saneador do worker: devolve UM componente de nome, nunca
    # um caminho. "..\\..\\index.html" não sobrevive a ele.
    output = worker.safe_component(_one(params, "output"), fallback="corte.mp4", max_len=120)
    if not output.lower().endswith(".mp4"):
        output += ".mp4"
    # O ajuste manual viaja como UM parâmetro JSON, e não como oito campos soltos: é a
    # MESMA forma que o corpo do POST do Remotion manda, validada pela MESMA função. Dois
    # formatos para o mesmo modelo dariam dois lugares para ele divergir.
    return CutRequest(token=token, profile=profile, start=start, end=end, output=output,
                      name=_one(params, "name"), edit=edit_of(_one(params, "edit")))


# --------------------------------------------------------------------------- render

def horizontal_args(src: str, dest: str, start: float, duration: float,
                    has_audio: bool) -> List[str]:
    """Espelha FFMPEG_FILTERS.horizontal do video-ops.js (`-vf scale=-2:1080`): mantém o
    enquadramento e só desce para 1080p, porque TikTok e Instagram recusam AV1 em 4K.

    O 9:16 não passa por aqui: blur/crop são worker.render_cut + worker.build_filter, que
    já existem e são fixos em 1080x1920.
    """
    args = ["-hide_banner", "-loglevel", "error", "-y",
            "-ss", "%.3f" % start, "-i", src, "-t", "%.3f" % duration,
            "-vf", "scale=-2:1080",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-level", "4.0"]
    args += (["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
             if has_audio else ["-an"])
    # "-f mp4" é obrigatório: escrevendo em ".part" o FFmpeg não deduz o container.
    args += ["-movflags", "+faststart", "-f", "mp4", dest]
    return args


def check_horizontal(path: str, expect_duration: float, expect_audio: bool) -> dict:
    """worker.check_output exige 1080x1920; o horizontal tem outra forma. Aqui confere o
    que vale para os dois casos, com a MESMA tolerância declarada pelo worker."""
    info = worker.probe(path)
    problems = []
    if info["videoCodec"] != "h264":
        problems.append("codec de vídeo %s (esperado h264)" % info["videoCodec"])
    if expect_audio and info["audioCodec"] != "aac":
        problems.append("codec de áudio %s (esperado aac)" % info["audioCodec"])
    if not expect_audio and info["audioCodec"]:
        problems.append("faixa de áudio inesperada (%s)" % info["audioCodec"])
    if info["durationSec"] is None:
        problems.append("duração ilegível")
    elif abs(info["durationSec"] - expect_duration) > worker.TOLERANCE_SEC:
        problems.append("duração %.3fs (esperado %.3fs, tolerância %.2fs)"
                        % (info["durationSec"], expect_duration, worker.TOLERANCE_SEC))
    if problems:
        raise worker.WorkerError("output_invalid",
                                 "Arquivo gerado reprovado: " + "; ".join(problems))
    return info


def render_to(dest: str, src: str, req: CutRequest, has_audio: bool,
              timeout: Optional[float], ass_file: Optional[str] = None,
              background: Optional[str] = None, band_h: Optional[int] = None) -> dict:
    """Grava por write_atomic — o .part morre em qualquer falha, nunca sobra meio arquivo —
    e confere a saída antes de afirmar que ela existe.

    `ass_file` e `background` só chegam no ramo 9:16. O horizontal segue exatamente como era:
    o pedido diz para não queimar legenda nele enquanto a interface não pedir isso
    explicitamente, e ele não tem tarja nenhuma para preencher com miniatura.
    """
    def produce(part: str) -> None:
        if req.profile == "horizontal":
            worker.run_ffmpeg(horizontal_args(src, part, req.start, req.duration, has_audio),
                              timeout=timeout)
        else:
            worker.render_cut(src, part, req.start, req.duration, req.profile, has_audio,
                              timeout=timeout, ass_file=ass_file, background=background,
                              band_h=band_h)

    worker.write_atomic(dest, produce)
    if req.profile == "horizontal":
        return check_horizontal(dest, req.duration, has_audio)
    return worker.check_output(dest, req.duration, has_audio)


def render_background(folder, clip_name):
    """(nome da miniatura que o render usa como fundo, estado). Nome "" = letterbox chapado.

    É função, e não duas linhas soltas na rota, por um motivo só: assim o teste exercita a
    POLARIDADE com arquivos reais. Asserção sobre o TEXTO do serve.py passa igual com
    `background_ok` e com `not background_ok` — e as duas versões fazem coisas opostas
    (descartar a miniatura boa × entregar a ilegível ao render, que morre carregando).

    O ESTADO sai daqui junto com o nome porque os dois desfechos de letterbox produzem o
    MESMO pixel e pedem ações diferentes do operador, e só aqui há como separá-los:
    `thumbnail_beside` diz se o arquivo EXISTE e `background_ok` se ele ABRE. Recalcular
    isso na rota seria uma segunda fórmula divergindo calada da regra de descarte desta
    função — a lição que já criou o `captions.margem_inferior` e o `video_box`.
    """
    nome = ytclip.thumbnail_beside(folder, clip_name)
    if not nome:
        return "", BACKGROUND_NONE
    if not background_ok(os.path.join(folder, nome)):
        return "", BACKGROUND_UNREADABLE
    return nome, BACKGROUND_OK


# As duas identidades do card de titulo. ESPELHO do `studio/src/preset.js`
# (`TITLE_CARD_STYLES`/`TITLE_CARD_PADRAO`), pela mesma razao pela qual o `captions.py`
# copia os numeros da tipografia: o preset.js e ESM do projeto Remotion e este modulo e
# stdlib puro, sem npm no caminho.
# Copiar exige guarda, e ela existe: o `test_serve.py` LE o preset.js e compara a lista e o
# padrao. Divergirem faria o servidor descartar calado o valor que a tela mandou, e o video
# sairia com a OUTRA marca -- o pior desfecho possivel aqui, porque nada na tela erraria.
# "nenhum" = sem card no video. E valor do MESMO conjunto (nao uma segunda chave), e o
# PADRAO nunca e ele: valor torto tem de cair na marca de sempre, nao apagar o card calado.
TITLE_CARD_STYLES = ("primo_rico", "puro_ecommerce", "nenhum")
TITLE_CARD_PADRAO = "primo_rico"


def title_card_style(valor):
    """Valor do corpo do POST -> identidade conhecida. Desconhecido = o padrao.

    PURA e no nivel do modulo (nao dentro do `render_props`) para o teste CHAMAR com valor
    construido, em vez de asserir o texto do arquivo -- que so provaria que alguem escreveu
    a palavra. Recusa `None`, numero, dict, o rotulo da tela ("Primo Rico") e qualquer
    string fora do conjunto.
    """
    return valor if valor in TITLE_CARD_STYLES else TITLE_CARD_PADRAO


# Os estilos de LEGENDA. Mesmo espelho, mesma razao e mesma guarda do TITLE_CARD_STYLES
# acima: o dono e o `studio/src/preset.js` (`LEGENDA_STYLES`/`LEGENDA_PADRAO`), este modulo
# e stdlib puro e o `test_serve.py` LE o preset.js para comparar.
# "classico" e a legenda que TODO corte ja renderiza hoje, e por isso e o padrao: trecho
# salvo antes deste seletor nao manda a chave e tem de sair exatamente como sempre saiu.
# Aqui NAO existe o "nenhum" do card -- legenda desligada ja e o preset `limpo` da
# composicao, e um segundo jeito de desligar a mesma coisa seria dois donos para a decisao.
# DERIVADOS do `captions`, nunca escritos a mao (a mesma disciplina do `PROFILES`, que sai
# do `worker.REFRAMES`): o registro de estilos mora la porque e quem monta o .ass, e uma
# segunda lista aqui seria mais um lugar para divergir calado.
LEGENDA_STYLES = tuple(captions.LEGENDA_ESTILOS)
LEGENDA_PADRAO = captions.LEGENDA_PADRAO
# Os conjuntos FECHADOS do ajuste manual, pela mesma regra e do mesmo dono. O `test_serve`
# compara os tres espelhos (preset.js -> aqui -> video-ops.js) lendo os arquivos.
LEGENDA_FONTES = tuple(captions.LEGENDA_FONTES)
LEGENDA_CORES = tuple(captions.CORES)
LEGENDA_ALINHAMENTOS = tuple(captions.ALINHAMENTOS)
# Faixa de cada numero que o operador arrasta. Espelha o `ranges` do `editOf` no preset.js
# e no video-ops.js -- fora dela o valor e GRAMPEADO, nunca recusado: a tela ja limita os
# controles, entao um numero fora da faixa e dado velho ou adulterado, e grampear mantem o
# corte saindo em vez de derrubar o render por causa de um slider.
EDIT_FAIXAS = {"tamanho": (32, 96), "largura": (360, 1000), "posicaoPct": (0, 100)}


def edit_of(valor):
    """Ajuste MANUAL do corte (dict do POST ou JSON da query) -> modelo validado. PURA.

    Terceira copia do validador (`preset.js` e o dono, `video-ops.js` e a da tela), pela
    razao de sempre: nao ha import possivel entre um ES module e este servidor stdlib.

    Nada aqui levanta e nada aqui e obrigatorio: ausente, malformado, de versao
    desconhecida ou com campo de tipo errado devolve o modelo VAZIO, que significa
    "automatico" -- e automatico e exatamente o que todo corte salvo antes desta entrega
    manda, e tem de sair como sempre saiu.
    """
    vazio = {"v": 1, "legenda": {}, "enquadramento": {}}
    if isinstance(valor, str):
        try:
            valor = json.loads(valor) if valor.strip() else None
        except ValueError:
            return vazio
    if not isinstance(valor, dict) or valor.get("v") != 1:
        return vazio
    out = {"v": 1, "legenda": {}, "enquadramento": {}}
    legenda = valor.get("legenda")
    if isinstance(legenda, dict):
        for chave, conjunto in (("style", LEGENDA_STYLES), ("familia", LEGENDA_FONTES),
                                ("cor", LEGENDA_CORES), ("destaqueCor", LEGENDA_CORES),
                                ("alinhamento", LEGENDA_ALINHAMENTOS)):
            if legenda.get(chave) in conjunto:
                out["legenda"][chave] = legenda[chave]
        # `isinstance(x, bool)` e NAO um truthy: `caixaAlta: false` e uma escolha do
        # operador ("este estilo em caixa baixa"), nao a ausencia de escolha.
        if isinstance(legenda.get("caixaAlta"), bool):
            out["legenda"]["caixaAlta"] = legenda["caixaAlta"]
        for chave, (minimo, maximo) in EDIT_FAIXAS.items():
            numero = captions.limite(legenda.get(chave), None, minimo, maximo)
            if numero is not None:
                out["legenda"][chave] = numero
    quadro = valor.get("enquadramento")
    if isinstance(quadro, dict) and quadro.get("reframe") in worker.REFRAMES:
        out["enquadramento"]["reframe"] = quadro["reframe"]
    return out


def legenda_style(valor):
    """Valor do corpo do POST -> estilo de legenda conhecido. Desconhecido = o padrao.

    PURA e no nivel do modulo pelo mesmo motivo do `title_card_style`: o teste CHAMA com
    valor construido. Recusa `None`, numero, dict, o rotulo da tela ("Impacto (caixa alta)")
    e qualquer string fora do conjunto -- um valor desconhecido atravessando ate a composicao
    nao tem aparencia definida, e o desfecho seria uma legenda sem fonte e sem corpo, calada.
    """
    return valor if valor in LEGENDA_STYLES else LEGENDA_PADRAO


def render_props(folder, clip_name, media, body):
    """O contrato inteiro entre o servidor e a composição do Remotion, num objeto.

    Está fora da rota porque a rota só roda com `npx` instalado e um render de minutos —
    e sem isto NADA prova que o nome da miniatura chega aos props. Medido: apagar
    `"backgroundFile": fundo` matava a feature inteira (todo corte voltava ao desfoque) com
    as 171 verificações verdes, porque o que existia era asserção sobre o TEXTO do arquivo.

    Só NOMES de arquivo saem daqui, nunca caminhos de disco: é o que o `staticFile()` do
    Remotion espera e o que mantém o caminho do servidor fora do processo do render.
    """
    cues = body.get("cues")
    # UMA chamada de video_box, e dela saem TRÊS props. Antes eram duas chamadas com o rótulo
    # "blur" cravado (uma para o legendaBase, outra para o bandaAltura), o que impedia
    # qualquer outro enquadramento de existir e permitia que as duas divergissem.
    # O fallback 608 (16:9) fica: o outro fallback possível — "o vídeo preenche o quadro" —
    # jogaria a base do texto para y 1651, FORA da imagem, e errar a proporção por pouco é
    # muito melhor que isso.
    # O ajuste MANUAL, validado UMA vez e usado por todos os props que dependem dele. A
    # composicao recebe o objeto inteiro (`resolveLegenda` la dentro veste a tipografia); a
    # ancora vertical NAO sai daqui em JavaScript nenhum -- so a intencao viaja, e quem a
    # transforma em pixel continua sendo o `captions.margem_inferior`.
    edit = edit_of(body.get("edit"))
    manual = edit["legenda"]
    # O enquadramento manual ganha do `reframe` cru do corpo pelo mesmo motivo do estilo: o
    # operador trocou na tela, e o corpo pode ser de um POST antigo repetido.
    reframe = reframe_profile(edit["enquadramento"].get("reframe") or body.get("reframe"))
    altura = video_box(reframe, media) or int(round(worker.OUT_W * 9 / 16))
    # O nome do fundo E o desfecho, do MESMO dono. O estado viaja nos props porque a rota já
    # lê props para decidir coisa sua (`durationSec` -> render_budget); a composição ignora a
    # chave. A alternativa — a rota recalculando o estado — pagaria um segundo ffprobe e
    # divergiria calada da regra de descarte do `render_background`.
    fundo, estado_fundo = render_background(folder, clip_name)
    props = {
        "clipFile": clip_name,
        # Qual recorte o Palco aplica à FONTE. Conjunto FECHADO e validado aqui, pela mesma
        # razão do titleCardStyle: o corpo do POST é entrada. "blur" (o padrão) é a fonte
        # deitada inteira, exatamente como todo corte já renderiza.
        "reframe": reframe,
        # A altura do vídeo visível, do dono único. O Remotion NÃO a recalcula: uma segunda
        # fórmula em JS divergiria da do FFmpeg e o mesmo corte sairia enquadrado diferente em
        # cada renderizador, calado — a lição que já criou o `captions.margem_inferior`.
        "videoAltura": altura,
        # A miniatura que o download gravou ao lado do trecho vira o fundo do 9:16. Vazia
        # (ausente ou ilegível) faz a composição cair no desfoque de antes.
        "backgroundFile": fundo,
        # Qual dos três desfechos saiu, para o cabeçalho X-Clip-Background. NÃO é prop de
        # composição: o Clip.jsx ignora a chave, e ela existe porque "não havia miniatura" e
        # "a miniatura chegou quebrada" dão o mesmo letterbox e a tela precisa distingui-los.
        "backgroundState": estado_fundo,
        # Âncora da legenda: a MESMA conta do caminho FFmpeg/ASS. O Clip.jsx tinha um
        # percentual próprio (`legendaTopoPct` = 66% = y 1267) e escrevia a fala 61px ABAIXO
        # da imagem, sobre a miniatura escurecida; agora a fórmula é uma só, em Python, e o
        # Remotion só recebe o número.
        # Sobe junto com o vídeo: no 1:1 e no 4:5 o vídeo é mais alto, então a base do texto
        # sobe com ele e nunca encosta na faixa de botões do TikTok (o teto ZONA_UI_PCT só
        # morde no perfil `crop`, de quadro cheio). Conferido: 1215 / 1414 / 1527.
        # `posicaoPct` e a INTENCAO que o operador arrastou na previa, e ela entra AQUI, na
        # unica funcao que sabe virar pixel -- que e tambem quem grampeia contra a zona de
        # botoes do TikTok. Ausente = a ancora automatica de sempre.
        "legendaBase": captions.margem_inferior(worker.OUT_H, altura,
                                                manual.get("posicaoPct")),
        # Altura de UMA tarja. A miniatura entra no tamanho dela, repetida em cima e
        # embaixo, em vez de UMA esticada cobrindo o quadro. Sai do `worker.band_height`, o
        # MESMO dono que o filtro do FFmpeg usa — dois cálculos independentes fariam o
        # mesmo corte enquadrar a miniatura diferente em cada renderizador, calado.
        "bandaAltura": worker.band_height(altura),
        "durationSec": float(media.get("durationSec") or 0.0),
        # Pela regra unica, igual ao caminho FFmpeg. Era copia VERBATIM do corpo, e era o
        # unico ponto do projeto em que texto de legenda entrava num renderizador sem passar
        # pelo gargalo: hoje nao vaza artefato porque os dois alimentadores (`clip.clipCues`
        # do /api/yt-fetch e a correcao semeada deles) ja vem limpos -- ou seja, estava certo
        # por PROVENIENCIA, nao por construcao. A assimetria era real: a MESMA correcao
        # digitada no painel atravessava `clean_edit_cues` -> `normalize_cues` indo para o
        # FFmpeg e nada indo para o Remotion, entao duas falas sobrepostas saiam empilhadas
        # num renderizador e aparadas no outro. Idempotente para quem ja veio limpo.
        "cues": captions.normalize_cues(cues) if isinstance(cues, list) else [],
        # Pela MESMA regra unica da legenda. O `topic` do detector nasce do texto CRU da
        # transcricao (o `ytclip.candidates` le a cue sem limpeza, de proposito, porque a
        # pausa entre falas naquela grade e o que decide onde o corte fecha), entao a
        # manchete chegava aqui com `>>` -- a troca de falante do json3 -- e `[ __ ]`, a
        # censura do reconhecedor, dentro. Nenhum dos dois e fala de alguem, e queimados num
        # TITULO ficam ainda mais a vista do que na legenda. Um segundo limpador aqui
        # divergiria calado do `strip_artifacts`, que ja e o dono dessa regra.
        "title": captions.strip_artifacts(body.get("title"))[:180],
        # Qual das duas identidades o card do titulo veste. Conjunto FECHADO e validado
        # aqui, pela mesma razao do CAPTION_STATES: o corpo do POST e entrada, e um valor
        # desconhecido que atravessasse ate a composicao nao tem aparencia definida -- o
        # desfecho seria um card sem placa, sem filete e sem borda, calado.
        # Desconhecido/ausente cai no PADRAO, que e a marca que todo corte ja renderiza
        # hoje: trecho salvo antes desta entrega nao manda a chave e tem de sair como
        # sempre saiu, nao com a outra marca.
        "titleCardStyle": title_card_style(body.get("titleCardStyle")),
        # Qual aparencia a legenda veste. Conjunto FECHADO e validado aqui, pela mesma razao
        # do titleCardStyle: o corpo do POST e entrada. Desconhecido/ausente cai no
        # "classico", que e a legenda que todo corte ja renderiza -- trecho salvo antes deste
        # seletor nao manda a chave e tem de sair como sempre saiu, nao no estilo novo.
        "legendaStyle": legenda_style(manual.get("style") or body.get("legendaStyle")),
        # O ajuste manual INTEIRO, validado. O `Clip.jsx` o resolve com `resolveLegenda`,
        # que e o MESMO dono da tipografia que o teto de pagina usa -- resolver duas vezes
        # deixaria a pagina ser cortada com um corpo e desenhada com outro.
        "edit": edit,
        "preset": "limpo" if body.get("preset") == "limpo" else "legenda",
        # Só o slug: a categoria escolhe a cor do destaque na composição e nada mais.
        "category": re.sub(r"[^a-z_]", "", str(body.get("category") or "").lower())[:40],
    }
    if props["durationSec"] <= 0:
        raise worker.WorkerError("probe_failed", "Não consegui medir a duração do trecho.")
    return props


def render_budget(duration_sec, floor: float = DEFAULT_RENDER_TIMEOUT) -> float:
    """Quanto tempo o Remotion pode levar num clipe DESTE tamanho.

    O Remotion renderiza quadro a quadro num Chrome headless: o custo é proporcional à
    duração, não constante. Por isso o teto tem de ser proporcional também — um número
    fixo é errado por construção (curto demais para clipe longo, e para clipe curto o
    piso já resolve). Duração inválida cai no piso em vez de virar zero calado.
    """
    try:
        segundos = float(duration_sec)
    except (TypeError, ValueError):
        segundos = 0.0
    if not math.isfinite(segundos) or segundos < 0.0:
        segundos = 0.0
    return max(float(floor), RENDER_FIXED_SEC + segundos * RENDER_SEC_PER_CLIP_SEC)


# --------------------------------------------------------------------------- cache

class SourceCache:
    """Guarda o original que o navegador subiu, por token de sessão, para o segundo
    download do mesmo vídeo não subir os mesmos gigabytes de novo.

    ponytail: um dicionário em memória e um lock só. O cache morre com o processo, de
    propósito — quem retoma é o navegador, que reenvia o arquivo ao receber 409.
    """

    def __init__(self, folder: str) -> None:
        self.folder = folder
        self._lock = threading.Lock()
        self._entries: Dict[str, Tuple[str, dict]] = {}

    def get(self, token: str) -> Optional[Tuple[str, dict]]:
        with self._lock:
            entry = self._entries.get(token)
        # Confere o disco: temporário apagado por fora não pode virar corte fantasma.
        if entry and os.path.isfile(entry[0]):
            return entry
        return None

    def put(self, token: str, path: str, media: dict) -> None:
        with self._lock:
            self._entries[token] = (path, media)

    def path_for(self, token: str) -> str:
        return os.path.join(self.folder, token + ".src")


# --------------------------------------------------------------------------- HTTP

def _sidecar_dir():
    """Pasta onde o baixador local grava video + .info.json + .mostreplayed.json."""
    return os.path.join(os.path.expanduser("~"), "Downloads", "yt-dlp")


def _read_most_replayed(name):
    """Nome do arquivo de video -> registro de audiencia gravado ao lado dele.

    O nome vem do NAVEGADOR, entao e tratado como entrada hostil: so o basename vale, ele
    tem de ser igual ao que chegou (nome com barra ou com ".." e recusado antes de qualquer
    leitura), e o caminho resolvido precisa cair dentro da pasta do baixador. So le arquivo
    terminado em .mostreplayed.json -- esta rota nunca serve conteudo arbitrario.
    """
    bruto = str(name or "")
    base = os.path.basename(bruto)
    if not base or base != bruto or base in (".", ".."):
        raise worker.WorkerError("job_invalid", "Nome de arquivo invalido.")
    pasta = os.path.realpath(_sidecar_dir())
    alvo = os.path.join(pasta, os.path.splitext(base)[0] + ".mostreplayed.json")
    if os.path.dirname(os.path.realpath(alvo)) != pasta:
        raise worker.WorkerError("job_invalid", "Caminho fora da pasta de download.")
    if not os.path.isfile(alvo):
        return None
    with io.open(alvo, encoding="utf-8") as fh:
        return json.load(fh)


def _sidecar_captions(registro):
    """Registro do sidecar -> bloco de legenda, com sidecar ANTIGO tratado como sem legenda.

    O sidecar v1 (so audiencia) nao tem a chave `captions`, e reanalisar exigiria rebaixar o
    video: a leitura degrada para CAPTIONS_NOT_AVAILABLE e o 9:16 sai sem legenda, que e
    exatamente o que acontecia antes de esta feature existir.

    `words` (tempo por palavra) chegou no sidecar v4. Sidecar v2/v3 tem `cues` e nao tem
    `words`: a chave sai vazia e o `cues_for_range` fica no caminho da cue grossa, igual a
    antes. Ninguem rebaixa video para migrar formato de legenda.
    """
    bloco = (registro or {}).get("captions")
    if not isinstance(bloco, dict):
        return {"available": False, "language": "", "kind": "", "cues": [], "words": [],
                "reason": ytclip.CAPTIONS_NONE}
    cues = bloco.get("cues")
    words = bloco.get("words")
    return {
        "available": bool(bloco.get("available")) and isinstance(cues, list) and bool(cues),
        "language": str(bloco.get("language") or "")[:20],
        "kind": str(bloco.get("kind") or "")[:20],
        "cues": cues if isinstance(cues, list) else [],
        "words": words if isinstance(words, list) else [],
        "reason": str(bloco.get("reason") or "")[:60],
    }


# Extensoes aceitas como fundo. Lista FECHADA porque o nome vem de um arquivo em disco: um
# `"thumbnail": "..\\..\\index.html"` num sidecar torto nao pode virar entrada do FFmpeg.
# A lista mora no ytclip (que e quem baixa a miniatura) e e a MESMA nos dois caminhos: duas
# copias divergiriam e o corte perderia o fundo dependendo de por onde entrou.
THUMB_EXTS = ytclip.THUMB_EXTS


def cut_background(name):
    """Nome do original -> caminho da MINIATURA gravada ao lado dele, ou "".

    E a mesma guarda do sidecar: so basename, so dentro da pasta do baixador, e agora so
    extensao de imagem conhecida. Ausencia NAO e erro: vale para todo MP4 que nao veio do
    YouTube (e para os videos baixados antes desta versao), e nesses casos o 9:16 volta ao
    fundo desfocado, que continua no worker.
    """
    try:
        registro = _read_most_replayed(name)
    except Exception:
        return ""
    bruto = str((registro or {}).get("thumbnail") or "")
    base = os.path.basename(bruto)
    if not base or base != bruto or os.path.splitext(base)[1].lower() not in THUMB_EXTS:
        return ""
    pasta = os.path.realpath(_sidecar_dir())
    alvo = os.path.join(pasta, base)
    if os.path.dirname(os.path.realpath(alvo)) != pasta or not os.path.isfile(alvo):
        return ""
    return alvo


# ------------------------------------------------------------------ fonte importada
def source_sidecar_path(folder, stem):
    """Caminho do `.mostreplayed.json` desta fonte. Uma fórmula, dois usuários (escrita aqui,
    leitura no `_read_most_replayed`) — duas divergiriam e o leitor não acharia nada."""
    return os.path.join(folder, os.path.splitext(os.path.basename(stem))[0] + ".mostreplayed.json")


def source_media_on_disk(folder, video_id):
    """(caminho, nome) do vídeo INTEIRO deste id já preparado, ou ("", "").

    Duas coisas saem daqui de graça, e as duas importam: importar o MESMO vídeo de novo não
    baixa nada (é o que faz "exportar dois cortes sem rebaixar o original" valer também
    depois de recarregar a página), e reabrir um projeto salvo religa a fonte sem rede.

    Exige o sidecar, não só a mídia: sem ele não há legenda nem miniatura, e tratar isso como
    "pronto" faria TODO corte sair sem legenda calado (BP-008). Meia fonte é fonte ausente.
    """
    if not ytclip.VIDEO_ID_RE.match(str(video_id or "")):
        return "", ""
    try:
        caminho = ytclip.produced_media(folder, video_id)
    except (worker.WorkerError, OSError):
        return "", ""
    if not os.path.isfile(source_sidecar_path(folder, video_id)):
        return "", ""
    return caminho, os.path.basename(caminho)


def write_source_sidecar(folder, media_name, probed):
    """Grava o sidecar da fonte importada, no MESMO formato do baixador local.

    É a economia central desta entrega: escrevendo o arquivo que o Estúdio JÁ sabe ler, a
    fonte importada herda de graça a legenda (`cut_captions` e `/api/clip-captions`), o fundo
    por miniatura (`cut_background`) e o gráfico de audiência — nenhuma rota nova para nenhum
    dos três, e o caminho FFmpeg do 9:16 passa a legendar qualquer intervalo da fonte sem
    saber que ela veio de uma importação.

    O DONO do formato é o `baixador/local-helper/yt_dlp_runner.py`. Divergir dele não daria
    erro: faria o `_sidecar_captions` degradar calado para "sem legenda", que é o pior
    desfecho possível aqui.
    """
    bloco = ytclip.most_replayed(probed.get("heatmap"))
    if not bloco.get("available"):
        bloco["reason"] = "MOST_REPLAYED_NOT_AVAILABLE"
    falas = probed.get("cues") or []
    registro = {
        "version": SIDECAR_VERSION,
        "videoId": str(probed.get("videoId") or ""),
        "sourceUrl": str(probed.get("url") or ""),
        "duration": float(probed.get("durationSec") or 0.0),
        "mostReplayed": bloco,
        "captions": {
            # `available` é sobre HAVER falas, não sobre a chamada ter voltado: lista vazia
            # com `available: true` faria o leitor prometer legenda que não existe.
            "available": bool(falas),
            "language": str(probed.get("captionLang") or ""),
            "kind": str(probed.get("captionKind") or ""),
            "reason": "" if falas else ytclip.CAPTIONS_NONE,
            "note": str(probed.get("note") or ""),
            "cues": falas,
            # `words` (tempo por palavra) é o que deixa a legenda quebrar no limite da
            # palavra. Ausente, o `cues_for_range` cai na cue grossa — o caminho de sempre.
            "words": probed.get("words") or [],
        },
        # NOME, nunca caminho: é o que o `cut_background` espera, e é o que impede caminho de
        # disco de sair num arquivo que o navegador lê.
        "thumbnail": ytclip.thumbnail_beside(folder, media_name),
    }
    alvo = source_sidecar_path(folder, media_name)
    with io.open(alvo, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(registro, ensure_ascii=False, indent=1))
    return alvo


def _falha_render(proc) -> str:
    """A última linha ÚTIL do Remotion, para a mensagem de erro dizer algo.

    Era `tail.splitlines()[-1]`, e isso custou uma sessão de depuração: o `npx` imprime o
    aviso de atualização do npm DEPOIS do erro, então a rota respondia "O Remotion falhou:
    npm notice" — uma frase que não aponta para nada. O ruído é filtrado de trás para frente
    e a linha do erro de verdade sobrevive; sem nenhuma linha útil, diz isso em vez de
    inventar (BP-008).
    """
    bruto = (getattr(proc, "stderr", b"") or getattr(proc, "stdout", b"") or b"")
    linhas = [l.strip() for l in bruto.decode("utf-8", "replace").splitlines() if l.strip()]
    RUIDO = ("npm notice", "npm warn", "npm WARN", "(Use `node --trace",
             "To update, run", "New ")
    uteis = [l for l in linhas if not any(l.startswith(p) for p in RUIDO)]
    return (uteis[-1] if uteis else (linhas[-1] if linhas else "sem detalhe"))[:400]


def render_paths(folder: str, token: str) -> Tuple[str, str]:
    """(props, destino) de UM render do Remotion. Função, e não duas linhas na rota, por dois
    defeitos que já custaram caro e que só ficam prováveis desde que a fonte é o vídeo inteiro:

    1. **O destino PRECISA da extensão `.mp4`** — o Remotion decide o container por ela, e sem
       ela o processo sai sem gravar arquivo. Até aqui a extensão vinha por ACIDENTE: o token
       era o nome do arquivo do trecho (`<id>-<ini>-<fim>.mp4`), então `edit-<token>` já
       terminava em `.mp4`. Com o token virando o ID do vídeo o acidente acabou, e o desfecho
       medido foi "O Remotion falhou: npm notice" — erro que não aponta para nada.
    2. **O sufixo aleatório** — o token é o MESMO para todos os cortes da fonte, então dois
       "Baixar vídeo editado" do mesmo vídeo escreviam no mesmo `props-<token>.json`: o
       segundo sobrescrevia o primeiro ANTES da trava de render, e o primeiro renderizava o
       trecho do segundo. Arquivo errado, e nada errado na tela.

    Inline, nenhum dos dois é testável sem rodar o Remotion (minutos, `npx`, Chrome headless);
    aqui o teste CHAMA e confere. É a lição do `renderBody`, que deixou `title: ''` cravado com
    a suíte verde porque o corpo era montado dentro do `fetch`.
    """
    marca = uuid.uuid4().hex[:8]
    base = worker.safe_component(token, fallback="clipe", max_len=80)
    return (os.path.join(folder, "props-%s-%s.json" % (base, marca)),
            os.path.join(folder, "edit-%s-%s.mp4" % (base, marca)))


def still_frame(duration_sec) -> int:
    """Duracao do corte -> o quadro do MEIO dele. PURA e no nivel do modulo.

    O MEIO, e nao o comeco: os primeiros 4 s sao o card do titulo, entao um still no quadro
    0 mostraria a placa e nao a legenda -- ou seja, a previa nao responderia a pergunta que
    a fez existir. Duracao torta, zero ou negativa cai no quadro 0, que sempre existe:
    levantar aqui derrubaria a conferencia por causa de uma leitura ruim de duracao.
    """
    try:
        segundos = float(duration_sec)
    except (TypeError, ValueError):
        return 0
    if segundos != segundos or segundos in (float("inf"), float("-inf")) or segundos <= 0:
        return 0
    total = max(1, int(round(segundos * STILL_FPS)))
    return min(total - 1, total // 2)


def still_path(folder: str, props: dict) -> str:
    """Caminho do PNG de UM conjunto de props. O nome E o hash dos props.

    Cache por CONTEUDO, e nao por token: reapertar o botao sem mexer em nada tem de ser de
    graca, e mexer em qualquer controle tem de dar outro arquivo. Um nome por token faria o
    quadro antigo ser servido depois de trocar a fonte da legenda -- previa mentindo, que e
    pior que previa ausente.

    `sort_keys` porque dicionario com a mesma informacao em outra ordem e o MESMO quadro: sem
    isso o cache erraria para mais (renderiza de novo), o que e so lento, mas tambem tornaria
    o teste do cache nao-deterministico.
    """
    assinatura = json.dumps(props, sort_keys=True, ensure_ascii=False, default=str)
    return os.path.join(folder, "still-%s.png"
                        % hashlib.sha1(assinatura.encode("utf-8")).hexdigest()[:16])


def edited_name(token: str, body: dict) -> str:
    """Nome do MP4 editado que a rota guarda em disco (`_keep`).

    Sai do TOKEN e do intervalo, não do nome do arquivo temporário: desde que o trecho passou
    a ser recortado da fonte na hora, aquele nome carrega um sufixo aleatório (que existe para
    dois renders simultâneos não colidirem) e ele apareceria na pasta de cortes do operador.
    Sem intervalo no corpo — o caminho do trecho já baixado — o nome não inventa números.
    """
    base = worker.safe_component(token, fallback="clipe", max_len=60)
    if os.path.splitext(base)[1].lower() == ".mp4":
        base = os.path.splitext(base)[0]
    try:
        inicio, fim = float(body.get("start")), float(body.get("end"))
    except (TypeError, ValueError):
        return base + "-editado.mp4"
    if not (fim > inicio >= 0):
        return base + "-editado.mp4"
    return "%s-%d-%d-editado.mp4" % (base, int(inicio), int(fim))


def clip_args(src: str, dest: str, start: float, duration: float,
              has_audio: bool) -> List[str]:
    """Recorte ACURADO do trecho da fonte, na resolução nativa, para alimentar o Remotion.

    `-ss` ANTES do `-i` de propósito, e a razão é medida em horas: é o seek rápido (pula para
    o keyframe anterior sem decodificar o arquivo inteiro) e, porque este passe RECODIFICA, o
    FFmpeg ainda decodifica e descarta até o instante exato — o trecho sai começando no quadro
    pedido, com o relógio em zero. Com `-ss` DEPOIS do `-i` o corte também sairia exato, mas
    decodificando desde o começo: num podcast de 3 h, um trecho em 2:30:00 custaria duas horas
    e meia de decode. É o mesmo arranjo do `horizontal_args` e do `worker.render_cut`.

    Sem `scale`: a fonte entra no Remotion como ela é. Reescalar aqui gastaria qualidade duas
    vezes (subir um 720p para 1080 e o Remotion baixar de volta) sem comprar nada.

    `-crf 16` é mais caro que os 18 do arquivo final de propósito: este é um INTERMEDIÁRIO que
    o Remotion vai recodificar, e perda em cascata é o que se paga quando o primeiro passe já
    é econômico. Sem tag de cor: quem tagueia a saída é o `--color-space` do Remotion.
    """
    args = ["-hide_banner", "-loglevel", "error", "-y",
            "-ss", "%.3f" % start, "-i", src, "-t", "%.3f" % duration,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
            "-pix_fmt", "yuv420p"]
    args += (["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]
             if has_audio else ["-an"])
    # "-f mp4" é obrigatório: escrevendo em ".part" o FFmpeg não deduz o container.
    args += ["-movflags", "+faststart", "-f", "mp4", dest]
    return args


def background_ok(path):
    """A miniatura é uma imagem que o FFmpeg consegue abrir? Um processo de ~0,1 s.

    Existe porque miniatura truncada (download interrompido, arquivo de 0 byte) fazia o
    FFmpeg abortar e o corte INTEIRO virava erro 500 — visto no teste, não deduzido. O fundo
    é enfeite, o corte é o produto: não abrindo, volta o desfoque de sempre e o motivo vai
    para o console em vez de derrubar o render.
    """
    try:
        return bool(worker.probe(path).get("width"))
    except Exception as err:
        print("[background] miniatura ignorada (%s): %s" % (path, err), file=sys.stderr)
        return False


def reframe_profile(valor):
    """Enquadramento do 9:16 vindo do CORPO de um POST -> chave do conjunto fechado.

    Ausente ou desconhecido cai no padrão, pela mesma razão do `title_card_style`: trecho
    salvo antes do seletor de enquadramento não manda a chave e tem de sair EXATAMENTE como
    sai hoje, não com outro recorte.

    Não confundir com o `parse_cut_query`, que RECUSA (400) perfil desconhecido: lá o valor
    vem da query de uma rota e recusar é o certo; aqui ele vem de estado de tela que pode ser
    mais antigo que o código.
    """
    return valor if valor in worker.REFRAMES else worker.REFRAME_PADRAO


def video_box(profile, media):
    """Altura, DENTRO do quadro 1080x1920, do video visivel. E o que ancora a legenda.

    Dono ÚNICO da altura em TODOS os perfis: dela saem o `legendaBase`, o `bandaAltura` e o
    `videoAltura` dos props, e é ela que o Palco do Remotion recorta. Antes desta entrega o
    `render_props` chamava esta função DUAS vezes com o rótulo "blur" cravado, o que
    funcionava só porque não havia escolha de enquadramento.

    A proporção sai do `worker.REFRAME_RATIO`, onde `blur` está AUSENTE de propósito: nele a
    fonte deita inteira (`scale=...:decrease`), então a proporção é a da FONTE — um 16:9 ocupa
    608 dos 1920 px. Nos perfis de recorte ela é determinística e independente da fonte
    (1080 no 1:1, 1350 no 4:5, 1920 no `crop`), porque o `crop` do filtro garante a proporção
    exata dos dois lados. Sem dimensao legivel devolve None, e a legenda cai no limite de
    interface do `captions` em vez de ser posta num retangulo inventado.
    """
    alto, largo = worker.REFRAME_RATIO.get(profile, (None, None))
    if alto is None:
        largo = media.get("width") if isinstance(media, dict) else None
        alto = media.get("height") if isinstance(media, dict) else None
        if not largo or not alto:
            return None
    # A forma `OUT_W * alto / largo` é OBRIGATÓRIA — não troque por `OUT_W / (largo/alto)`.
    # Medido: `1080 * 1080/1920` dá exatamente 607.5 -> 608, enquanto `1080 / (1920/1080)`
    # cai em 607.4999... -> 607. Um pixel de deriva calada entre os props e o filtro sai daí.
    altura = min(worker.OUT_H, int(round(worker.OUT_W * float(alto) / float(largo))))
    # Par: H.264 com yuv420p exige dimensão par, e este número vai ao filtro E aos props —
    # então a paridade tem de sair do dono único, senão uma fonte de proporção torta produz
    # altura ímpar e o encode falha depois de o render inteiro ter rodado.
    return altura - (altura % 2)


def source_scale(profile, media):
    """Quanto a fonte é AMPLIADA para chegar aos 1080 de largura. None sem dimensão legível.

    Pura e só de informação: quem decide é o operador. O recorte é pago em reamostragem —
    cortar a fonte reduz a região aproveitada, que depois é esticada até 1080. De uma fonte
    1920x1080: `blur` usa os 1920 (0,56x, redução, o mais nítido), `crop11` usa 1080 (1,00x,
    NATIVO, sem um único pixel interpolado), `crop45` usa 864 (1,25x) e `crop` usa 607 (1,78x).
    De uma 1280x720 a conta piora: `crop11` vira 1,50x e `crop45` 1,88x.

    A região usada é a MESMA do `crop` do `worker._crop_source` — `min(w, h*largo/alto)` —,
    e no `blur` é a largura inteira, porque ele não recorta nada.
    """
    largura = media.get("width") if isinstance(media, dict) else None
    altura = media.get("height") if isinstance(media, dict) else None
    if not largura or not altura:
        return None
    alto, largo = worker.REFRAME_RATIO.get(profile, (None, None))
    usada = float(largura) if alto is None else min(float(largura),
                                                   float(altura) * largo / alto)
    if usada <= 0:
        return None
    return worker.OUT_W / usada


def clean_edit_cues(raw):
    """Legenda corrigida pelo navegador -> lista confiavel. Fronteira de confianca.

    O tempo nao e editavel na tela, mas quem manda o corpo e o navegador: numero ilegivel,
    texto gigante e lista infinita morrem aqui, nao no meio do FFmpeg. Fala com texto vazio
    e DESCARTE proposital — apagar o texto e como o operador remove uma legenda que o
    YouTube inventou. A ordem e a sobreposicao ficam com o `captions.normalize_cues`, que e a
    regra unica do projeto.
    """
    if not isinstance(raw, list):
        raise worker.WorkerError("job_invalid", "As legendas corrigidas precisam vir numa lista.")
    if len(raw) > MAX_EDIT_CUES:
        raise worker.WorkerError("job_invalid",
                                 "Legenda corrigida com falas demais (%d)." % len(raw))
    saida = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            inicio, fim = float(item.get("start")), float(item.get("end"))
        except (TypeError, ValueError):
            continue
        texto = " ".join(str(item.get("text") or "").split())[:MAX_EDIT_CHARS]
        if not texto or not (fim > inicio):
            continue
        saida.append({"start": round(inicio, 3), "end": round(fim, 3), "text": texto})
    return captions.normalize_cues(saida)


def edit_key(token, start, end):
    """Chave da correcao: sessao MAIS trecho.

    O token e por VIDEO (um por arquivo aberto na aba), entao guardar so por token faria a
    correcao de um corte vazar para outro corte do mesmo podcast. Com o intervalo na chave,
    cada trecho tem a legenda dele — e mudar o intervalo invalida a correcao, que e o certo:
    ela foi escrita para outras falas.
    """
    return "%s|%.3f|%.3f" % (token, float(start), float(end))


def _resumo_legenda(registro):
    """Bloco de legenda -> o que a TELA precisa saber. Sem as falas."""
    bloco = _sidecar_captions(registro)
    return {"available": bloco["available"], "language": bloco["language"],
            "kind": bloco["kind"], "reason": bloco["reason"],
            "count": len(bloco["cues"])}


CAPTIONS_OUT_OF_RANGE = "CAPTIONS_OUT_OF_RANGE"
# O operador apagou o texto de TODAS as falas na revisao. E um pedido explicito de "sem
# legenda", e nao pode colapsar com CAPTIONS_OUT_OF_RANGE (que fala do video, nao dele) nem,
# muito menos, cair no ramo do sidecar e queimar de volta o texto que ele acabou de apagar.
CAPTIONS_EDITED_EMPTY = "CAPTIONS_EDITED_EMPTY"
# Trecho com mais falas do que a revisao aguenta. Recusar a revisao e dizer o motivo e melhor
# que mostrar as 400 primeiras como se fossem todas: corrigir uma palavra viraria override
# truncado e o resto do clipe sairia MUDO, que e pior que nao revisar.
CAPTIONS_TOO_MANY = "CAPTIONS_TOO_MANY"

# Conjunto FECHADO de estados que podem sair daqui. O caminho e
# sidecar em disco -> cabecalho X-Clip-Captions -> frase na tela, e valor livre nesse trajeto
# quebra os dois lados: um `reason` com CRLF injeta cabecalho na resposta HTTP, e um `reason`
# desconhecido cai no CAPTIONS_MSG do video-ops.js sem frase nenhuma -- ou seja, o corte sai
# sem legenda e a tela nao diz nada (BP-008).
# `CAPTIONS_TOO_MANY` NAO entra: ele e resposta da rota de REVISAO, nao desfecho de render, e
# um estado que pode sair no cabecalho sem ter frase do outro lado e exatamente o erro mudo
# que este conjunto existe para impedir.
CAPTION_STATES = (ytclip.CAPTIONS_NONE, ytclip.CAPTIONS_FAILED, CAPTIONS_OUT_OF_RANGE,
                  CAPTIONS_EDITED_EMPTY)


def _caption_state(reason):
    """Motivo lido do sidecar -> estado conhecido. Desconhecido = falha de extracao.

    NAO colapsa os pares: `CAPTIONS_NOT_AVAILABLE` e `CAPTIONS_EXTRACTION_FAILED` continuam
    distintos, porque sao dados diferentes e o projeto proibe junta-los. O que este guarda
    recusa e o que nao e nenhum dos dois -- sidecar estranho e sidecar que nao conseguimos
    ler, entao FAILED, nunca o "o video nao publica legenda", que seria afirmar algo sobre o
    video a partir de um arquivo torto.
    """
    return reason if reason in CAPTION_STATES else ytclip.CAPTIONS_FAILED


def _audio_state(valor):
    """Desfecho do passe de -14 LUFS -> estado conhecido. Irmão do `_caption_state`.

    O conjunto vive no `worker.AUDIO_STATES` porque é lá que o passe roda; este guarda existe
    pelo mesmo motivo do outro: o valor sai num cabeçalho HTTP e vira frase na tela, e valor
    livre nesse trajeto quebra os dois lados. Desconhecido = falha, nunca `normalizado`:
    afirmar que normalizou sem saber é a única resposta pior que dizer que falhou.

    Também NÃO colapsa os pares: `AUDIO_SEM_FAIXA` (o corte não tem áudio, e dizer isso não é
    erro) e `AUDIO_NORM_FAILED` (o passe falhou e o vídeo entregue é o original) continuam
    distintos.
    """
    return valor if valor in worker.AUDIO_STATES else worker.AUDIO_FAILED


# Os TRES desfechos do fundo por miniatura, conjunto FECHADO pela MESMA razao do
# CAPTION_STATES: o valor sai num cabecalho HTTP (X-Clip-Background) e vira frase na tela, e
# valor livre nesse trajeto quebra os dois lados.
# `BACKGROUND_NONE` e `BACKGROUND_UNREADABLE` produzem o MESMO pixel (letterbox chapado) e por
# isso NUNCA colapsam num erro generico: nao ter miniatura e normal (MP4 local, trecho baixado
# antes desta entrega) e miniatura quebrada e um download a refazer. Dados diferentes pedem
# acao diferente do operador -- e ate esta entrega os dois eram MUDOS na tela (BP-008).
BACKGROUND_OK = "miniatura"
BACKGROUND_NONE = "BACKGROUND_NONE"              # nao havia miniatura ao lado do trecho
BACKGROUND_UNREADABLE = "BACKGROUND_UNREADABLE"  # havia, e nao deu para ler
BACKGROUND_STATES = (BACKGROUND_OK, BACKGROUND_NONE, BACKGROUND_UNREADABLE)


def _background_state(valor):
    """Desfecho do fundo -> estado conhecido. Irmao do `_caption_state`/`_audio_state`.

    Desconhecido cai em `BACKGROUND_UNREADABLE`, o desfecho conservador ("nao deu para
    usar"): afirmar `miniatura` sem saber diria que o fundo entrou quando o video saiu
    letterbox -- a mesma regra que impede o `_audio_state` de responder `normalizado`.

    NAO colapsa os dois legitimos. O que este guarda recusa e o que nao e nenhum dos tres --
    inclusive valor com CRLF, que injetaria cabecalho na resposta HTTP.
    """
    return valor if valor in BACKGROUND_STATES else BACKGROUND_UNREADABLE


def cut_captions(name, start, end, video_h=None, override=None, edit=None):
    """Nome do original + intervalo -> (documento ASS, estado). NUNCA levanta.

    Legenda e opcional em todo ramo: o 9:16 tem de sair mesmo sem ela. Por isso os estados
    sao distintos e nenhum deles derruba o corte — `CAPTIONS_NOT_AVAILABLE` (o video nao
    publica), `CAPTIONS_EXTRACTION_FAILED` (falhamos ao extrair, no download ou agora) e
    `CAPTIONS_OUT_OF_RANGE` (tem legenda, mas nenhuma fala cai DENTRO deste corte).

    O recorte e o rebase sao do `ytclip.cues_for_range`, fronteira unica do projeto: a
    legenda do sidecar esta no relogio do VIDEO e o MP4 comeca no segundo 0 do CORTE.

    `override` e a legenda que o OPERADOR corrigiu na tela (ja no relogio do corte, porque e
    assim que a rota de revisao a entregou). Presente, ela ganha do sidecar sem discussao: a
    legenda automatica do YouTube erra palavra e o pedido e explicito em que o texto revisado
    e o que entra no MP4. Ela passa pelo MESMO recorte, com janela 0..duracao, para nao
    depender de o navegador ter mandado tempo dentro do corte.

    `video_h` e a altura do video visivel no quadro; vai direto ao `captions.to_ass`, que
    ancora a legenda dentro da imagem.

    `edit` e o ajuste MANUAL (ja validado pelo `edit_of`). O que o ASS consegue vestir esta
    no `captions.estilo_ass`; o que ele NAO reproduz esta no `captions.ASS_NAO_REPRODUZ` e
    a tela mostra a lista ao lado do botao deste caminho (BP-008) -- um renderizador que
    entrega outra coisa CALADO e exatamente o defeito que estes checks existem para matar.
    """
    manual = (edit or {}).get("legenda") if isinstance(edit, dict) else None
    estilo = captions.estilo_ass(legenda_style((manual or {}).get("style")), manual)
    # `is not None`, NUNCA `if override:`. Uma correcao que ficou VAZIA (o operador apagou o
    # texto de todas as falas, que e como se remove legenda inventada pelo YouTube) e um
    # pedido explicito de "sem legenda". Com o teste de verdade, lista vazia caia no ramo do
    # sidecar e o corte saia queimando de volta exatamente o texto apagado — e a tela dizia
    # "com o texto que voce corrigiu".
    if override is not None:
        try:
            recorte = ytclip.cues_for_range(override, 0.0, float(end) - float(start))
            documento = captions.to_ass(recorte, video_h=video_h, estilo=estilo)
        except Exception as err:
            print("[CAPTIONS_EXTRACTION_FAILED] legenda corrigida: %s" % err, file=sys.stderr)
            return "", ytclip.CAPTIONS_FAILED
        if not documento:
            return "", CAPTIONS_EDITED_EMPTY
        return documento, ("burned" if captions.font_available(estilo["arquivo"])
                           else "burned-sem-inter")
    if not str(name or "").strip():
        return "", ytclip.CAPTIONS_NONE
    try:
        registro = _read_most_replayed(name)
    except Exception:
        # Nome recusado pelo guarda de caminho: sem sidecar, sem legenda, corte segue.
        return "", ytclip.CAPTIONS_NONE
    if not registro:
        return "", ytclip.CAPTIONS_NONE
    bloco = _sidecar_captions(registro)
    if not bloco["available"]:
        return "", _caption_state(bloco["reason"] or ytclip.CAPTIONS_NONE)
    try:
        # Palavra quando o sidecar tem (v4), cue grossa quando nao tem: a preferencia mora
        # no `cues_for_range`, que e a fronteira unica de cue de clipe.
        recorte = ytclip.cues_for_range(bloco["cues"], start, end, bloco["words"])
        documento = captions.to_ass(recorte, video_h=video_h, estilo=estilo)
    except Exception as err:
        print("[CAPTIONS_EXTRACTION_FAILED] %s: %s" % (name, err), file=sys.stderr)
        return "", ytclip.CAPTIONS_FAILED
    if not documento:
        return "", CAPTIONS_OUT_OF_RANGE
    # O libass troca a fonte ausente por Arial sem reclamar. Se a Inter nao esta instalada, a
    # legenda entra -- mas em OUTRA tipografia, e isso e dito em vez de passar calado.
    return documento, ("burned" if captions.font_available(estilo["arquivo"])
                       else "burned-sem-inter")


def _most_replayed_safe(heatmap, video_id):
    """Bloco de audiencia observada do video. NUNCA derruba a analise.

    O pedido separa os erros de proposito: nao ter grafico (MOST_REPLAYED_NOT_AVAILABLE) e o
    normal de video novo ou pouco visto, e falhar ao calcular (MOST_REPLAYED_EXTRACTION_FAILED)
    e defeito nosso. Nenhum dos dois pode impedir o video de seguir para os cortes, entao os
    dois degradam para o mesmo bloco vazio -- com o motivo registrado, porque erro silencioso
    e indistinguivel de erro ausente (BP-008).
    """
    try:
        block = ytclip.most_replayed(heatmap)
    except Exception as err:  # degradar e o requisito; propagar quebraria o import do video
        print('[MOST_REPLAYED_EXTRACTION_FAILED] %s: %s' % (video_id, err), file=sys.stderr)
        return {'available': False, 'source': ytclip.HEATMAP_SOURCE, 'points': [], 'peaks': [],
                'reason': 'MOST_REPLAYED_EXTRACTION_FAILED'}
    if not block['available']:
        block['reason'] = 'MOST_REPLAYED_NOT_AVAILABLE'
    return block


class CutHandler(SimpleHTTPRequestHandler):
    """Estático + /api/video-cut. Os atributos de classe são postos por build_server."""

    cache: Optional[SourceCache] = None
    max_seconds = DEFAULT_MAX_SECONDS
    max_upload_bytes = DEFAULT_MAX_UPLOAD_BYTES
    ffmpeg_timeout: Optional[float] = DEFAULT_FFMPEG_TIMEOUT
    render_timeout = DEFAULT_RENDER_TIMEOUT
    # Bytes do corpo ainda não lidos. Só _drain() usa: existe para a recusa antecipada
    # conseguir entregar a própria mensagem em vez de virar reset de conexão.
    unread = 0
    # ponytail: um FFmpeg por vez. Dois cortes 4K simultâneos afogam a máquina do operador
    # e terminam mais tarde do que em fila. Se um dia houver máquina sobrando, tire o lock.
    # A espera é limitada pelo _render_slot; sem fila de verdade, quem não alcança a vez
    # ouve 503. Se um dia isso incomodar, o caminho é uma fila com posição na tela.
    render_lock = threading.Lock()
    render_lock_wait = RENDER_LOCK_WAIT
    # Pasta dos cortes salvos. Atributo de classe (como os limites) para o teste apontar
    # um temporário em vez de sujar a pasta pessoal de quem roda.
    clips_folder: Optional[str] = None
    # Legenda corrigida pelo operador, por trecho (ver edit_key). Vive na SESSÃO do servidor,
    # como o cache da fonte: o sidecar em disco continua sendo a verdade do que o YouTube
    # detectou, e a correção é uma camada por cima dele. build_server dá um dicionário novo a
    # cada servidor — dois servidores num teste não trocam legenda.
    caption_edits: Dict[str, list] = {}
    caption_lock = threading.Lock()
    # Andamento das importações, por videoId. Vive na SESSÃO do servidor como o cache e a
    # legenda corrigida: o ARQUIVO é a verdade durável, isto é só o que a barra de progresso
    # precisa ler enquanto o download corre. Servidor reiniciado perde o dicionário e o
    # `_handle_import_state` redescobre a fonte pelo disco.
    imports: Dict[str, dict] = {}
    imports_lock = threading.Lock()

    # ------------------------------------------------------------ vez no renderizador
    @contextlib.contextmanager
    def _render_slot(self):
        """A vez no renderizador, com prazo. Substitui o `with` cru no `render_lock`.

        (A frase acima não cita o `with` antigo por extenso de propósito: o check 29i procura
        esse literal no arquivo, e prosa explicando a regra o faria reprovar — é a armadilha
        de asserção sobre TEXTO que este projeto já pagou duas vezes, agora ao contrário.)

        Duas grandezas SEPARADAS de propósito: `render_lock_wait` limita a espera na FILA
        (aqui) e o `timeout` do subprocess limita o processo que está RODANDO (render_budget
        / ffmpeg_timeout, em cada rota). Confundir as duas devolveria o defeito: um teto de
        fila do tamanho do render deixaria a espera de 4 h que este guarda existe para matar.

        O `finally` libera em QUALQUER saída — retorno, WorkerError, KeyboardInterrupt ou
        falha do FFmpeg. Sem ele uma exceção dentro do render travaria todo render futuro,
        que é justamente o modo de falha permanente, pior que a espera longa.
        """
        if not self.render_lock.acquire(timeout=self.render_lock_wait):
            raise worker.WorkerError(
                "render_busy",
                "O renderizador está ocupado com outro corte há mais de %d min. "
                "Espere ele terminar e peça de novo." % int(self.render_lock_wait / 60))
        try:
            yield
        finally:
            self.render_lock.release()

    # ------------------------------------------------------------ toda resposta
    def end_headers(self):
        """Servidor de DESENVOLVIMENTO não deixa o navegador guardar nada.

        O SimpleHTTPRequestHandler manda só `Last-Modified` e responde 304. Sem
        `Cache-Control`, o Chrome aplica cache HEURÍSTICO: considera o arquivo fresco por
        uma fração da idade dele e pode servir JS antigo sem sequer perguntar ao servidor.
        Já custou caro (2026-09-01): o conserto estava no disco, o servidor entregava o
        arquivo novo, e a tela continuava executando o código velho — o que manda procurar
        o defeito no lugar errado. Aqui não há nada a ganhar com cache: os arquivos vêm de
        disco local, na mesma máquina. Ponto único de propósito — `end_headers` é por onde
        TODA resposta passa (estático, /clips/, JSON de API, erro), então nenhuma rota pode
        esquecer.
        """
        self.send_header("Cache-Control", "no-store")
        # `Accept-Ranges` no caminho da fonte. Sem ele o Chrome nem TENTA pedir Range: a barra
        # do player só deixa arrastar para dentro do que já baixou, e num arquivo de 2 GB isso
        # é o mesmo que não deixar arrastar. Vive aqui pelo mesmo motivo do Cache-Control —
        # `end_headers` é por onde TODA resposta passa, então nenhuma rota pode esquecer.
        if urlparse(self.path).path.startswith(SOURCES_URL):
            self.send_header("Accept-Ranges", "bytes")
        SimpleHTTPRequestHandler.end_headers(self)

    # ---------------------------------------------------------------- estático
    def send_head(self):
        """Nenhum componente começando por ponto sai pela porta: .env, .git e .claude
        estão na raiz servida e não são conteúdo do site."""
        parts = urlparse(self.path).path.split("/")
        if any(part.startswith(".") for part in parts if part):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None
        return SimpleHTTPRequestHandler.send_head(self)

    def translate_path(self, path):
        """`/clips/<arquivo>` sai da pasta dos cortes salvos, não do repositório.

        `basename` mata travessia (o basename de `../../x` é `x`), e o guarda de componente
        com ponto do send_head roda antes. Reaproveita o GET/HEAD/404/Content-Type que o
        SimpleHTTPRequestHandler já tem — a pasta só é apontada, nada é reimplementado.
        """
        limpo = urlparse(path).path
        if limpo.startswith(CLIPS_URL):
            return os.path.join(self._clips_dir(), os.path.basename(unquote(limpo)))
        # A FONTE importada. Mesma guarda e mesma razão do /clips/: `basename` mata travessia
        # (o basename de `../../x` é `x`) e o guarda de componente com ponto do `send_head`
        # roda antes. A pasta é a do sidecar porque é lá que a fonte e a legenda dela moram.
        if limpo.startswith(SOURCES_URL):
            return os.path.join(_sidecar_dir(), os.path.basename(unquote(limpo)))
        return SimpleHTTPRequestHandler.translate_path(self, path)

    # Só a forma simples de Range, que é a que todo `<video>` manda. Múltiplas faixas numa
    # requisição (`bytes=0-9,20-29`) não aparecem em player de vídeo, e responder errado a
    # elas seria pior que não responder: sem casar aqui, o caminho normal (200 com o arquivo
    # inteiro) assume, que é sempre correto, só mais caro.
    RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")

    def do_GET(self):
        """Estático, mais Range no vídeo da fonte.

        O `SimpleHTTPRequestHandler` NÃO implementa Range: ele responde 200 com o arquivo
        inteiro e ignora o cabeçalho. Num `<video>` isso não é detalhe — arrastar para
        02:10:00 de um arquivo de 2 GB faria o navegador rebaixar os 2 GB desde o começo (ou
        simplesmente não deixar arrastar). Sem 206 não existe "navegar pela duração inteira",
        que é o pedido desta entrega.
        """
        if self.headers.get("Range") and urlparse(self.path).path.startswith(SOURCES_URL):
            try:
                if self._send_partial(self.translate_path(self.path)):
                    return
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                # O player aborta leitura a cada arrasto da barra — é o caso NORMAL aqui, não
                # falha do servidor, e não pode virar traceback no console.
                self.log_message("player desligou no meio da faixa")
                return
        SimpleHTTPRequestHandler.do_GET(self)

    def _send_partial(self, path: str) -> bool:
        """206 com a fatia pedida. False = "não sei responder isto", e o caminho normal assume."""
        casou = self.RANGE_RE.match((self.headers.get("Range") or "").strip())
        if not casou or not os.path.isfile(path):
            return False
        try:
            tamanho = os.path.getsize(path)
        except OSError:
            return False
        ini, fim = casou.group(1), casou.group(2)
        if ini == "":
            # `bytes=-N` = os N últimos bytes. É como o navegador lê o índice do MP4 quando o
            # `moov` está no fim — sem este ramo, um arquivo sem `+faststart` não abre.
            if fim == "" or int(fim) == 0:
                return False
            comeca, termina = max(0, tamanho - int(fim)), tamanho - 1
        else:
            comeca = int(ini)
            termina = tamanho - 1 if fim == "" else min(int(fim), tamanho - 1)
        if comeca >= tamanho or termina < comeca:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", "bytes */%d" % tamanho)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        resta = termina - comeca + 1
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (comeca, termina, tamanho))
        self.send_header("Content-Length", str(resta))
        # `Accept-Ranges` sai do end_headers, que é o dono dele — repetir aqui mandaria o
        # cabeçalho duas vezes.
        self.end_headers()
        if self.command == "HEAD":
            return True
        with open(path, "rb") as fh:
            fh.seek(comeca)
            while resta > 0:
                pedaco = fh.read(min(RANGE_CHUNK, resta))
                if not pedaco:
                    break
                self.wfile.write(pedaco)
                resta -= len(pedaco)
        return True

    def _clips_dir(self) -> str:
        return self.clips_folder or default_clips_dir()

    # ---------------------------------------------------------------- log
    def log_request(self, code="-", size="-"):
        # Sem query: o nome do arquivo do operador não precisa ir para o console.
        self.log_message('"%s %s" %s', self.command, urlparse(self.path).path, code)

    def log_message(self, fmt, *args):
        sys.stderr.write("[serve] %s\n" % (fmt % args))

    # ---------------------------------------------------------------- POST
    def do_POST(self) -> None:
        # Despacho por dicionário em vez de if/elif: as rotas novas herdam, sem cópia, o
        # mesmo tratamento de erro que o corte já tinha — WorkerError vira JSON com código,
        # aba fechada não derruba a thread, falha de disco vira 500 com motivo.
        handlers = {
            ROUTE: self._handle_cut,
            ROUTE_PROBE: self._handle_probe,
            ROUTE_FETCH: self._handle_fetch,
            ROUTE_RENDER: self._handle_render,
            ROUTE_STILL: self._handle_still,
            ROUTE_MR: self._handle_most_replayed,
            ROUTE_CAPS: self._handle_clip_captions,
            ROUTE_CLIP_STATUS: self._handle_clip_status,
            ROUTE_IMPORT: self._handle_import,
            ROUTE_IMPORT_STATE: self._handle_import_state,
        }
        handler = handlers.get(urlparse(self.path).path)
        if handler is None:
            self._error(HTTPStatus.NOT_FOUND, "job_invalid", "Rota inexistente.")
            return
        started = time.monotonic()
        try:
            handler()
        except worker.WorkerError as err:
            # Erro PREVISTO: vira JSON com a mensagem que o navegador já sabe ler
            # (video-ops.js:1957 usa payload.error).
            self._error(STATUS_BY_CODE.get(err.code, HTTPStatus.BAD_REQUEST),
                        err.code, err.message)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # Aba fechada no meio do download: não é falha do servidor e não derruba a thread.
            self.log_message("cliente desligou antes do fim")
        except OSError as err:
            self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "output_invalid",
                        "Falha de disco ao cortar: %s" % (err.strerror or err))
        finally:
            self.log_message("corte em %.1fs", time.monotonic() - started)

    # ------------------------------------------------------ descoberta por URL
    def _json_body(self) -> dict:
        """Corpo JSON curto das rotas de URL. Recusa antes de ler o que for grande demais."""
        length = self._content_length()
        if length > MAX_JSON_BYTES:
            raise worker.WorkerError("job_invalid", "Corpo grande demais para esta rota.")
        raw = self.rfile.read(length) if length else b"{}"
        self.unread = 0
        try:
            body = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise worker.WorkerError("job_invalid", "Corpo desta rota precisa ser JSON.")
        if not isinstance(body, dict):
            raise worker.WorkerError("job_invalid", "Corpo desta rota precisa ser um objeto JSON.")
        return body

    def _send_json(self, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_probe(self) -> None:
        """Analisa a URL e devolve candidatos. NENHUM byte de vídeo é baixado aqui.

        Sem trava de render de propósito: isto é leitura de metadados, não trabalho pesado,
        e enfileirar análise atrás de um corte de 4K deixaria a tela parada à toa.
        """
        info = ytclip.probe(self._json_body().get("url"))
        # Detector externo OPCIONAL. Sem `MUAPI_KEY` no ambiente nada é chamado: a análise
        # não fica um milissegundo mais lenta nem um centavo mais cara para quem não ligou.
        # Ligado, o que volta é ÂNCORA — o `candidates_report` ainda resolve a borda na fala
        # e ainda reprova pelo veto editorial. O motivo entra na `note` porque recurso ligado
        # que não achou nada precisa dizer por quê (BP-008): lista vazia calada é
        # indistinguível de "não rodou". A URL é a canônica do `probe`, nunca a string colada.
        aviso_externo = ""
        if os.environ.get(muapi.ENV_KEY):
            info["muapiHighlights"], aviso_externo = muapi.highlights(
                info["url"], num_highlights=ytclip.MAX_CANDIDATES)
        sugestoes, descarte = ytclip.candidates_report(info)
        # "Descartei sete porque terminavam no meio da frase" e "não achei nada" são coisas
        # diferentes para quem olha a tela (BP-008): o resumo entra na `note`, junto do que
        # já se dizia sobre legenda e heatmap ausentes.
        nota = " ".join(p for p in (info["note"], descarte, aviso_externo) if p).strip()
        self._send_json({
            "videoId": info["videoId"], "url": info["url"], "title": info["title"],
            "uploader": info["uploader"], "durationSec": info["durationSec"],
            "captionLang": info["captionLang"], "captionKind": info["captionKind"],
            "cueCount": len(info["cues"]), "chapterCount": len(info["chapters"]),
            "hasHeatmap": bool(info["heatmap"]), "note": nota,
            "thumbnail": info.get("thumbnail", ""),
            # A folha de miniaturas COM TEMPO. O navegador recorta o quadro do trecho com
            # `background-position` — nenhum byte de vídeo é baixado para popular a grade.
            "storyboard": info.get("storyboard") or {},
            "mostReplayed": _most_replayed_safe(info["heatmap"], info["videoId"]),
            "candidates": sugestoes,
        })

    def _handle_most_replayed(self) -> None:
        """Devolve a analise que o BAIXADOR ja gravou ao lado do video. Nao analisa nada.

        Existe porque o navegador nao le o disco e o helper da 8770 aceita SO origem de
        extensao -- o portao de CSRF dele fica intacto. Esta rota e do mesmo servidor que
        serve a pagina, entao a leitura acontece sem afrouxar nada. Sidecar ausente nao e
        erro: o video simplesmente nao tem grafico, e o Passo 2 segue com marcacao manual.
        """
        vazio = {"available": False, "source": ytclip.HEATMAP_SOURCE, "peaks": [],
                 "reason": "MOST_REPLAYED_NOT_AVAILABLE"}
        registro = _read_most_replayed(self._json_body().get("name"))
        if not registro:
            self._send_json({"videoId": "", "sourceUrl": "", "duration": 0.0,
                             "mostReplayed": vazio, "captions": _resumo_legenda(None)})
            return
        bloco = registro.get("mostReplayed") or {}
        self._send_json({
            "videoId": str(registro.get("videoId") or "")[:40],
            "sourceUrl": str(registro.get("sourceUrl") or "")[:300],
            "duration": float(registro.get("duration") or 0.0),
            # Os 100 baldes ficam no disco: a tela precisa das REGIOES, nao da curva inteira.
            "mostReplayed": {
                "available": bool(bloco.get("available")),
                "source": str(bloco.get("source") or ytclip.HEATMAP_SOURCE)[:40],
                "peaks": list(bloco.get("peaks") or [])[:20],
                "reason": str(bloco.get("reason") or "")[:60],
            },
            # RESUMO, nunca as falas: um podcast de 3 h tem milhares de cues, e a tela so
            # precisa dizer "tem legenda". O texto fica no disco e quem o le e o /api/video-cut
            # na hora de queimar -- o navegador nunca carrega a transcricao inteira.
            "captions": _resumo_legenda(registro),
        })

    def _handle_clip_captions(self) -> None:
        """A legenda DESTE trecho para revisão humana — e a correção dela de volta.

        Nenhuma chamada nova ao yt-dlp e nenhum byte de rede: as falas já estão no sidecar
        que o baixador gravou junto com o vídeo. Esta rota só recorta, mostra e guarda.

        Sem `cues` no corpo: devolve o que o YouTube detectou naquele intervalo (ou a
        correção já guardada, se houver — o operador tem de ver o que está valendo).
        Com `cues`: guarda a correção para o próximo /api/video-cut do MESMO trecho.

        O estado sai sempre, inclusive quando não há nada a mostrar: `ok`, `edited` ou um dos
        motivos de ausência de legenda. Tela muda seria indistinguível de tela quebrada.
        """
        body = self._json_body()
        token = str(body.get("token") or "")
        if not TOKEN_RE.match(token):
            raise worker.WorkerError("job_invalid", "Token da sessão inválido.")
        start = _finite(str(body.get("start")), "start")
        end = _finite(str(body.get("end")), "end")
        if end <= start:
            raise worker.WorkerError("cut_invalid", "O fim do trecho tem de ser depois do início.")
        chave = edit_key(token, start, end)

        if body.get("cues") is not None:
            corrigida = clean_edit_cues(body.get("cues"))
            with self.caption_lock:
                self.caption_edits[chave] = corrigida
                while len(self.caption_edits) > MAX_EDIT_SESSIONS:
                    self.caption_edits.pop(next(iter(self.caption_edits)))
            self._send_json({"cues": corrigida, "state": "edited", "language": "", "kind": ""})
            return

        with self.caption_lock:
            guardada = self.caption_edits.get(chave)
        registro = None
        try:
            registro = _read_most_replayed(body.get("name"))
        except Exception:
            # Nome recusado pelo guarda de caminho: sem sidecar, sem legenda — e dito.
            registro = None
        bloco = _sidecar_captions(registro)
        if guardada is not None:
            self._send_json({"cues": guardada, "state": "edited",
                             "language": bloco["language"], "kind": bloco["kind"]})
            return
        if not bloco["available"]:
            self._send_json({
                "cues": [], "language": bloco["language"], "kind": bloco["kind"],
                "state": _caption_state(bloco["reason"] or ytclip.CAPTIONS_NONE)})
            return
        # As MESMAS linhas que o `cut_captions` vai queimar (palavra quando existe): mostrar
        # a cue grossa aqui e queimar outra coisa faria a revisao editar texto que nao e o do
        # MP4 -- e a correcao entra como override, que substitui a legenda inteira.
        recorte = ytclip.cues_for_range(bloco["cues"], start, end, bloco["words"])
        if len(recorte) > MAX_EDIT_CUES:
            # Truncar seria pior: o navegador mostraria as primeiras como se fossem TODAS, e
            # corrigir uma palavra transformaria a lista cortada em override — o resto do
            # clipe sairia mudo. Recusar a revisão deixa o corte sair legendado pelo sidecar,
            # inteiro, e diz por quê.
            self._send_json({"cues": [], "language": bloco["language"],
                             "kind": bloco["kind"], "count": len(recorte),
                             "state": CAPTIONS_TOO_MANY})
            return
        self._send_json({"cues": recorte, "language": bloco["language"],
                         "kind": bloco["kind"],
                         "state": "ok" if recorte else CAPTIONS_OUT_OF_RANGE})

    # --------------------------------------------------- fonte importada (vídeo inteiro)
    def _source_payload(self, video_id: str, path: str, media: dict) -> dict:
        nome = os.path.basename(path)
        return {
            "state": IMPORT_READY, "stage": IMPORT_STAGE_PREPARE, "percent": 100,
            "videoId": video_id,
            # O token da fonte É o id do vídeo, e isso é escolha: ele passa no TOKEN_RE (que o
            # /api/video-cut exige) e é ESTÁVEL, então o mesmo original serve dois cortes
            # seguidos sem subir nem rebaixar um byte.
            "sourceToken": video_id,
            "sourceName": nome,
            # Endereço que o player interno do site toca. Servido com Range (ver do_GET), que
            # é o que permite arrastar a barra para qualquer ponto de um arquivo de 2 GB.
            "sourceUrl": SOURCES_URL + quote(nome),
            "bytes": os.path.getsize(path),
            "durationSec": media.get("durationSec"),
            "width": media.get("width"), "height": media.get("height"),
            "hasAudio": bool(media.get("audioCodec")),
            "error": "",
        }

    def _register_source(self, video_id: str, path: str, media: dict) -> dict:
        """Põe a fonte no cache da sessão e devolve o que a tela precisa.

        Registrar é o que faz o /api/video-cut aceitar corpo vazio para esta fonte: a rota
        acha o arquivo pelo token em vez de exigir upload. Sem isto o primeiro corte pediria o
        original de novo — que é justamente o que esta entrega existe para acabar.
        """
        self.cache.put(video_id, path, media)
        pronto = self._source_payload(video_id, path, media)
        with self.imports_lock:
            self.imports[video_id] = pronto
        return pronto

    def _import_set(self, video_id: str, **campos) -> dict:
        with self.imports_lock:
            atual = dict(self.imports.get(video_id) or {})
            atual.update(campos)
            self.imports[video_id] = atual
            return atual

    def _handle_import(self) -> None:
        """Começa (ou reaproveita) o download do vídeo INTEIRO, que passa a ser a fonte.

        O portão de direitos autorais fica no navegador (o ytFetchGate do video-ops.js só
        chama esta rota com a declaração marcada, e a confere DE NOVO na volta) — a mesma
        divisão do /api/yt-fetch, que esta rota substitui no fluxo normal.

        Responde na hora, sem esperar o download: 2 GB não cabem numa requisição HTTP sem o
        navegador desistir no meio, e sem resposta imediata a barra não teria de onde tirar o
        primeiro número. Quem conta o resto é /api/yt-import-state.

        Idempotente de propósito: fonte já pronta no disco volta PRONTA, sem rede. É isso que
        faz o segundo corte — e o projeto reaberto amanhã — não rebaixar o original.
        """
        body = self._json_body()
        vid = ytclip.video_id(body.get("url"))
        pasta = _sidecar_dir()
        caminho, _nome = source_media_on_disk(pasta, vid)
        if caminho:
            try:
                media = worker.validate_input(caminho)
            except worker.WorkerError as err:
                # Arquivo no disco mas ilegível (download interrompido, setor ruim): não é
                # pronto e não é erro de rota — é motivo para baixar de novo, e o console diz
                # por quê em vez de a tela prometer uma fonte que não abre.
                self.log_message("fonte no disco recusada, vai baixar de novo: %s", err.message)
            else:
                self._send_json(self._register_source(vid, caminho, media))
                return
        with self.imports_lock:
            atual = self.imports.get(vid)
            if atual and atual.get("state") == IMPORT_RUNNING:
                # Dois cliques no botão não viram dois downloads do mesmo vídeo.
                self._send_json(dict(atual))
                return
            self.imports[vid] = {
                "state": IMPORT_RUNNING, "stage": IMPORT_STAGE_PROBE, "percent": 0,
                "videoId": vid, "sourceToken": "", "sourceName": "", "sourceUrl": "",
                "bytes": 0, "durationSec": 0.0, "width": 0, "height": 0,
                "hasAudio": False, "error": ""}
            inicial = dict(self.imports[vid])
        # FORA do _render_slot, e isto é decisão, não esquecimento. O /api/yt-fetch pega a
        # trava porque recodifica as pontas do trecho e dois FFmpeg brigariam pela máquina;
        # aqui não há encode nenhum (o fetch_full só remuxa), o gargalo é a rede, e segurar a
        # trava por vinte minutos deixaria o operador sem poder exportar NADA durante a
        # importação — pior que a briga que ela evita.
        threading.Thread(target=self._import_worker,
                         args=(vid, "https://www.youtube.com/watch?v=" + vid, pasta),
                         daemon=True).start()
        self._send_json(inicial)

    def _import_worker(self, video_id: str, url: str, pasta: str) -> None:
        """O download do vídeo inteiro, fora da requisição. NUNCA levanta para fora.

        Toda saída passa pelo dicionário de estado: sucesso vira `ready` com o token, falha
        vira `error` com a frase. Exceção escapando daqui mataria a thread e deixaria o estado
        em `importing` para sempre — barra andando sem nada do outro lado, que é exatamente o
        defeito que este bloco existe para não ter (BP-008).
        """
        try:
            # A análise vem ANTES do download e é a mesma de sempre (metadados, capítulos,
            # legenda, heatmap): é dela que sai o sidecar, e sem sidecar a fonte nasce sem
            # legenda e sem miniatura.
            dados = ytclip.probe(url)
            worker.ensure_space(pasta, 0, int(float(dados.get("durationSec") or 0.0)
                                              * IMPORT_BYTES_PER_SEC))
            self._import_set(video_id, stage=IMPORT_STAGE_DOWNLOAD,
                             durationSec=float(dados.get("durationSec") or 0.0))
            got = ytclip.fetch_full(url, pasta, on_progress=lambda f: self._import_set(
                video_id, percent=int(f * 100)))
            self._import_set(video_id, stage=IMPORT_STAGE_PREPARE, percent=99)
            nome = os.path.basename(got["path"])
            # O sidecar ANTES de anunciar pronto: é ele que carrega a legenda e a miniatura, e
            # anunciar a fonte antes dele faria o primeiro corte sair sem legenda, calado.
            write_source_sidecar(pasta, nome, dados)
            self._register_source(video_id, got["path"], got["media"])
        except worker.WorkerError as err:
            self._import_set(video_id, state=IMPORT_ERROR, error=err.message)
        except Exception as err:      # noqa: BLE001 — ver a docstring: nada escapa daqui
            self._import_set(video_id, state=IMPORT_ERROR,
                             error="Falha inesperada ao importar: %s" % err)

    def _handle_import_state(self) -> None:
        """Andamento da importação DESTE vídeo.

        O `videoId` volta sempre, e ele é a chave da corrida: o navegador compara com a URL
        que está na tela e descarta resposta de vídeo que já não é o pedido — o operador pode
        colar outro link no meio de uma importação, e o resultado do anterior não pode assumir
        o lugar do novo.
        """
        vid = str(self._json_body().get("videoId") or "")
        if not ytclip.VIDEO_ID_RE.match(vid):
            raise worker.WorkerError("job_invalid", "Id de vídeo inválido.")
        with self.imports_lock:
            atual = self.imports.get(vid)
        if atual:
            self._send_json(dict(atual))
            return
        # Servidor reiniciado no meio: o dicionário morreu, o ARQUIVO não. Reconhecer isso
        # aqui é o que faz a tela voltar sozinha para pronto em vez de pedir outra importação
        # de 2 GB.
        caminho, _nome = source_media_on_disk(_sidecar_dir(), vid)
        if caminho:
            try:
                self._send_json(self._register_source(vid, caminho,
                                                      worker.validate_input(caminho)))
                return
            except worker.WorkerError as err:
                self.log_message("fonte no disco recusada: %s", err.message)
        self._send_json({"state": IMPORT_IDLE, "stage": "", "percent": 0, "videoId": vid,
                         "sourceToken": "", "sourceName": "", "sourceUrl": "", "bytes": 0,
                         "durationSec": 0.0, "width": 0, "height": 0, "hasAudio": False,
                         "error": ""})

    def _cut_for_render(self, src: str, media: dict, start: float, end: float,
                        token: str) -> Tuple[str, dict, List[str]]:
        """Extrai o trecho da fonte e devolve (caminho, media, temporários a apagar).

        ponytail: um encode intermediário por exportação editada. O caminho sem encode seria
        mandar o offset ao Remotion e deixá-lo ler a fonte inteira — e ele é MAIS caro, não
        menos: o Chrome headless busca quadro a quadro, e buscar dentro de um arquivo de 3 h
        custa muito mais que os segundos deste recorte. Se um dia o @remotion/media ganhar
        leitura sequencial com offset barato, é aqui que este passe sai.
        """
        base = worker.safe_component(token, fallback="fonte", max_len=40)
        destino = os.path.join(self.cache.folder, "trecho-%s-%d-%d-%s.mp4"
                               % (base, int(start), int(end), uuid.uuid4().hex[:8]))
        duracao = end - start
        com_audio = bool(media.get("audioCodec"))
        with self._render_slot():
            worker.write_atomic(destino, lambda part: worker.run_ffmpeg(
                clip_args(src, part, start, duracao, com_audio),
                timeout=self.ffmpeg_timeout))
        recortado = worker.validate_input(destino)
        sobras = [destino]
        # A miniatura viaja com o recorte: o `render_background` a descobre pelo STEM do
        # arquivo que o Remotion recebe, e sem esta cópia TODO vídeo editado de fonte
        # importada cairia no letterbox — com o estado dizendo "não havia miniatura", o que
        # seria verdade sobre o recorte e mentira sobre o vídeo. Falhar aqui não derruba o
        # render: volta o fundo chapado, e o estado já diz isso.
        pasta_fonte = os.path.dirname(src)
        capa = ytclip.thumbnail_beside(pasta_fonte, os.path.basename(src))
        if capa:
            copia = os.path.splitext(destino)[0] + os.path.splitext(capa)[1]
            try:
                shutil.copy2(os.path.join(pasta_fonte, capa), copia)
                sobras.append(copia)
            except OSError as err:
                self.log_message("miniatura nao acompanhou o recorte: %s", err)
        return destino, recortado, sobras

    def _canonical_clip_filename(self, video_id: str, start: float, end: float) -> str:
        """Nome canônico do arquivo permanente: videoId-inMs-outMs.mp4.
        Usa milissegundos inteiros para evitar variações como 12.5 vs 12.50 vs 12.500.
        """
        start_ms = int(round(float(start) * 1000))
        end_ms = int(round(float(end) * 1000))
        return "%s-%d-%d.mp4" % (video_id, start_ms, end_ms)

    def _legacy_clip_filenames(self, video_id: str, start: float, end: float) -> List[str]:
        """Gera variações de nomes legados para compatibilidade com clips já salvos.

        Ordem de preferência:
        1. Formato canônico novo (ms inteiros)
        2. Formato anterior (segundos inteiros: videoId-start-end.mp4)
        3. Formato com casas decimais truncadas
        """
        candidates = []
        # 1. Canônico (ms)
        candidates.append(self._canonical_clip_filename(video_id, start, end))
        # 2. Segundos inteiros (formato do _handle_fetch anterior)
        candidates.append("%s-%d-%d.mp4" % (video_id, int(float(start)), int(float(end))))
        # 3. Com 1 casa decimal
        candidates.append("%s-%.1f-%.1f.mp4" % (video_id, float(start), float(end)))
        # 4. Com 2 casas decimais
        candidates.append("%s-%.2f-%.2f.mp4" % (video_id, float(start), float(end)))
        # 5. Com 3 casas decimais
        candidates.append("%s-%.3f-%.3f.mp4" % (video_id, float(start), float(end)))
        # Remove duplicatas preservando ordem
        seen = set()
        uniq = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                uniq.append(c)
        return uniq

    def _resolve_clip_file(self, clips_dir: str, filename: Optional[str],
                            video_id: Optional[str], start: Optional[float], end: Optional[float]) -> Tuple[Optional[str], str]:
        """Resolve o arquivo físico do clip.

        Tenta na ordem:
        1. filename explícito (basename seguro)
        2. Nomes canônicos/legados derivados de videoId + start + end

        Retorna (caminho_resolvido, nome_do_arquivo) ou (None, motivo).
        """
        # 1. Se filename foi passado, valida e usa direto
        if filename:
            safe_name = worker.safe_component(filename, fallback="", max_len=120)
            if safe_name and safe_name == filename:
                file_path = os.path.join(clips_dir, safe_name)
                try:
                    real_clips = os.path.realpath(clips_dir)
                    real_file = os.path.realpath(file_path)
                    if os.path.commonpath([real_clips, real_file]) == real_clips and os.path.isfile(file_path):
                        return file_path, safe_name
                except ValueError:
                    pass
            return None, "invalid_filename"

        # 2. Tenta derivar de videoId + start + end
        if video_id and start is not None and end is not None:
            vid = str(video_id).strip()
            if not vid:
                return None, "invalid_video_id"
            try:
                st = float(start)
                en = float(end)
            except (TypeError, ValueError):
                return None, "invalid_time"
            if en <= st or st < 0:
                return None, "invalid_time"

            for candidate_name in self._legacy_clip_filenames(vid, st, en):
                candidate_path = os.path.join(clips_dir, candidate_name)
                try:
                    real_clips = os.path.realpath(clips_dir)
                    real_file = os.path.realpath(candidate_path)
                    if os.path.commonpath([real_clips, real_file]) == real_clips and os.path.isfile(candidate_path):
                        return candidate_path, candidate_name
                except ValueError:
                    continue
            return None, "missing_file"

        return None, "insufficient_info"

    def _handle_clip_status(self) -> None:
        """Verifica se um clip MP4 existe na pasta permanente de clips.

        Aceita dois modos:
        - filename explícito (basename)
        - videoId + start + end para resolver automaticamente (projetos legados)
        """
        body = self._json_body()
        filename = str(body.get("filename") or "").strip() or None
        video_id = str(body.get("videoId") or "").strip() or None
        start = body.get("start")
        end = body.get("end")

        clips_dir = self._clips_dir()
        file_path, resolved_name = self._resolve_clip_file(clips_dir, filename, video_id, start, end)

        if file_path:
            size = os.path.getsize(file_path)
            # Gera token de runtime para o arquivo resolvido
            runtime_token = "restored_" + uuid.uuid4().hex[:12]
            cache_path = os.path.join(self.cache.folder, runtime_token + ".src")
            try:
                shutil.copy2(file_path, cache_path)
                media = worker.validate_input(cache_path)
                self.cache.put(runtime_token, cache_path, media)
            except (OSError, worker.WorkerError) as err:
                self.log_message("falha ao preparar cache para clip resolvido: %s", err)
                runtime_token = ""

            self._send_json({
                "available": True,
                "filename": resolved_name,
                "clipToken": runtime_token,
                "bytes": size,
                "url": CLIPS_URL + quote(resolved_name),
                "reason": "available"
            })
        else:
            self._send_json({
                "available": False,
                "filename": resolved_name if filename else "",
                "clipToken": "",
                "bytes": 0,
                "url": "",
                "reason": resolved_name if resolved_name != "missing_file" else "missing_file"
            })

    def _handle_fetch(self) -> None:
        """Baixa SÓ o trecho já aprovado por uma pessoa.

        O portão de direitos autorais fica no navegador (video-ops.js só chama esta rota
        para fonte com autorização válida). Aqui vale o portão técnico: espaço em disco
        antes de escrever, e a mesma trava do corte, porque dois yt-dlp recodificando
        pontas ao mesmo tempo brigam pela mesma máquina.

        Também guarda uma cópia permanente na pasta de clips, para sobreviver a reinícios
        do servidor. Devolve o nome do arquivo permanente (clipFilename) além do token
        temporário (clipToken).
        """
        body = self._json_body()
        try:
            start = float(body.get("start"))
            end = float(body.get("end"))
        except (TypeError, ValueError):
            raise worker.WorkerError("cut_invalid", "Início e fim precisam ser números.")
        worker.ensure_space(self.cache.folder, max(0.0, end - start))
        # A legenda vem junto do trecho, e não do render: quem edita não deve precisar saber
        # que a fonte era YouTube. Custa uma leitura de metadados (~6s) dentro de uma rota
        # que já leva ~50s baixando, e evita que o navegador guarde a transcrição inteira do
        # vídeo no localStorage só para usar trinta segundos dela.
        try:
            dados = ytclip.probe(body.get("url"))
            cues = ytclip.cues_for_range(dados["cues"], start, end, dados["words"])
        except worker.WorkerError:
            # Trecho sem legenda ainda rende corte — só sai sem fala na tela. Falhar o
            # download inteiro por causa disso seria trocar um recurso por um bloqueio.
            cues = []
        with self._render_slot():
            got = ytclip.fetch_section(body.get("url"), start, end, self.cache.folder)
        token = os.path.basename(got["path"])
        self.cache.put(token, got["path"], got["media"])

        # Copia para a pasta permanente de clips com nome previsível (videoId-in-out.mp4).
        # Isso permite recuperar o arquivo depois de reiniciar o servidor.
        vid = ytclip.video_id(body.get("url"))
        permanent_name = "%s-%d-%d.mp4" % (vid, int(start), int(end))
        clips_dir = self._clips_dir()
        os.makedirs(clips_dir, exist_ok=True)
        permanent_path = os.path.join(clips_dir, permanent_name)
        try:
            shutil.copy2(got["path"], permanent_path)
        except OSError as err:
            self.log_message("não consegui copiar clip para pasta permanente: %s", err)
            permanent_name = ""

        self._send_json({
            "clipToken": token,
            "clipFilename": permanent_name,
            "bytes": got["bytes"], "cues": cues,
            "inSec": got["inSec"], "outSec": got["outSec"],
            "durationSec": got["media"].get("durationSec"),
            "width": got["media"].get("width"), "height": got["media"].get("height"),
            "hasAudio": bool(got["media"].get("audioCodec")),
            "path": got["path"],
        })

    def _send_still(self, path: str, props: dict) -> None:
        """O PNG do quadro real, mais os numeros que a TELA nao pode calcular sozinha.

        `X-Clip-Legenda-Base` e a ancora que o `captions.margem_inferior` resolveu para este
        corte: e a unica forma de a tela saber onde a legenda automatica cai sem repetir a
        formula em JavaScript -- que e proibido, e por um defeito ja pago (a legenda saiu
        61 px abaixo da imagem). `X-Clip-Video-Altura` fecha o par, porque a ancora so faz
        sentido contra a altura do video visivel.
        """
        with open(path, "rb") as handle:
            dados = handle.read()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(dados)))
        # `no-store`: o navegador nunca deve reusar este PNG por conta propria -- quem
        # decide se o quadro ainda vale e o cache por hash de props, no servidor.
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Clip-Legenda-Base", str(props.get("legendaBase", "")))
        self.send_header("X-Clip-Video-Altura", str(props.get("videoAltura", "")))
        # Sem `X-Clip-Background` aqui de proposito: o `_deliver_video` e o emissor UNICO
        # daquele estado (check 30e), e num STILL a pergunta nem se coloca -- o operador esta
        # OLHANDO o fundo que saiu.
        self.end_headers()
        self.wfile.write(dados)

    def _handle_still(self) -> None:
        """O QUADRO REAL deste corte, em PNG. Mesma composicao, MESMOS props do MP4.

        Existe porque a previa em CSS do site e uma aproximacao declarada da tipografia: ela
        nao sabe onde o `captions.margem_inferior` ancora a legenda nem como a composicao
        quebra a pagina. Esta rota responde essas duas perguntas com o renderizador de
        verdade, num quadro, em vez de minutos de render.
        """
        self._handle_render(still=True)

    def _handle_render(self, still: bool = False) -> None:
        """Manda o trecho aprovado para o Remotion e devolve o MP4 editado.

        Divisão de responsabilidade (o pedido do usuário é explícito nisto): a DESCOBERTA
        de cortes não sabe que o Remotion existe, e o Remotion não sabe de onde o trecho
        veio. O contrato entre os dois é só este JSON: qual arquivo, quanto dura, que falas
        aparecem e qual preset.

        `--public-dir` aponta para a MESMA pasta de cache onde o trecho já está, então o
        vídeo não é copiado para dentro do repositório só para ser lido.

        Aceita `clipToken` (cache da sessão) ou `clipFilename` (arquivo permanente).
        Se o token não está no cache mas o arquivo permanente existe, restaura para o cache.
        """
        import shutil as _shutil
        body = self._json_body()
        token = str(body.get("clipToken") or "")
        clip_filename = str(body.get("clipFilename") or "").strip()
        entry = None

        if token and TOKEN_FILE_RE.match(token):
            entry = self.cache.get(token)

        if not entry and clip_filename:
            # Tenta restaurar do arquivo permanente para o cache.
            safe_name = worker.safe_component(clip_filename, fallback="", max_len=120)
            if safe_name and safe_name == clip_filename:
                clips_dir = self._clips_dir()
                permanent_path = os.path.join(clips_dir, safe_name)
                if os.path.isfile(permanent_path):
                    # Copia para o cache com novo token.
                    restored_token = "restored_" + uuid.uuid4().hex[:12]
                    cache_path = self.cache.path_for(restored_token)
                    try:
                        shutil.copy2(permanent_path, cache_path)
                        media = worker.validate_input(cache_path)
                        self.cache.put(restored_token, cache_path, media)
                        entry = (cache_path, media)
                        token = restored_token
                    except (OSError, worker.WorkerError) as err:
                        self.log_message("falha ao restaurar clip do disco: %s", err)

        if not entry:
            raise worker.WorkerError(
                "input_missing",
                "Este trecho não está mais disponível. Baixe o trecho novamente.")
        src, media = entry
        if not os.path.isdir(os.path.join(STUDIO_DIR, "node_modules")):
            raise worker.WorkerError(
                "job_invalid",
                "O Remotion não está instalado. Rode `npm install` dentro da pasta studio.")
        npx = _shutil.which("npx") or _shutil.which("npx.cmd")
        if not npx:
            raise worker.WorkerError("job_invalid", "npx não encontrado no PATH.")

        # O trecho DENTRO da fonte importada. Presente, o arquivo que o Remotion recebe é um
        # recorte desta requisição; ausente, a fonte é o clipe inteiro e nada muda — é o que
        # mantém funcionando o trecho baixado por /api/yt-fetch antes desta entrega.
        temporarios: List[str] = []
        if body.get("start") is not None and body.get("end") is not None:
            comeca = _finite(str(body.get("start")), "start")
            termina = _finite(str(body.get("end")), "end")
            if comeca < 0:
                raise worker.WorkerError("cut_invalid", "O início do trecho não pode ser negativo.")
            if termina <= comeca:
                raise worker.WorkerError("cut_invalid",
                                         "O fim do trecho tem de ser depois do início.")
            if termina - comeca > worker.MAX_CUT_SEC:
                raise worker.WorkerError(
                    "cut_invalid", "Trecho de %.0fs passa do teto de %.0fs."
                    % (termina - comeca, worker.MAX_CUT_SEC))
            fonte_dur = media.get("durationSec")
            if fonte_dur is not None and termina > fonte_dur + worker.TOLERANCE_SEC:
                raise worker.WorkerError(
                    "cut_invalid", "O trecho termina em %.1fs, depois do fim do vídeo (%.1fs)."
                    % (termina, fonte_dur))
            worker.ensure_space(self.cache.folder, termina - comeca)
            src, media, temporarios = self._cut_for_render(src, media, comeca, termina, token)

        props = render_props(self.cache.folder, os.path.basename(src), media, body)

        # Sufixo aleatório, e não só o token: desde que a fonte passou a ser o vídeo inteiro o
        # token é o MESMO para todos os cortes dele, então dois "Baixar vídeo editado" do
        # mesmo vídeo escreviam no mesmo props-*.json. O segundo sobrescrevia o primeiro ANTES
        # da trava de render, e o primeiro renderizava o trecho do segundo — arquivo errado,
        # nada errado na tela. Mesma razão e mesma família do sufixo do `.ass`.
        props_path, dest = render_paths(self.cache.folder, token)
        if still:
            # Cache por CONTEUDO dos props: reapertar sem mexer em nada nao paga um render.
            # O PNG NAO entra em `temporarios` -- e o cache, e apaga-lo no `finally` faria o
            # botao custar o mesmo toda vez.
            dest = still_path(self.cache.folder, props)
            if os.path.isfile(dest) and os.path.getsize(dest) > 0:
                for sobra in temporarios:
                    remove_quietly(sobra)
                self._send_still(dest, props)
                return
            temporarios += [props_path]
        else:
            temporarios += [props_path, dest]
        with open(props_path, "w", encoding="utf-8") as handle:
            json.dump(props, handle, ensure_ascii=False)
        # O teto acompanha o tamanho do clipe: com um número fixo, todo trecho acima de
        # ~48 s morria no meio do render e o operador só via a espera acabar sem arquivo.
        limite = STILL_TIMEOUT if still else render_budget(props["durationSec"],
                                                            self.render_timeout)
        if still:
            args = [npx, "remotion", "still", STUDIO_ENTRY, STUDIO_COMPOSITION, dest,
                    "--props=" + props_path,
                    "--public-dir=" + self.cache.folder,
                    "--frame=" + str(still_frame(props["durationSec"])),
                    "--image-format=png",
                    "--log=error"]
        else:
            args = [npx, "remotion", "render", STUDIO_ENTRY, STUDIO_COMPOSITION, dest,
                    "--props=" + props_path,
                    "--public-dir=" + self.cache.folder,
                    "--color-space=" + RENDER_COLOR_SPACE,
                    "--image-format=" + RENDER_IMAGE_FORMAT,
                    "--jpeg-quality=" + str(RENDER_JPEG_QUALITY),
                    "--log=error"]
        try:
            with self._render_slot():
                proc = subprocess.run(args, cwd=STUDIO_DIR, capture_output=True,
                                      timeout=limite)
            if proc.returncode != 0 or not os.path.exists(dest):
                # O still apaga o proprio arquivo vazio: um PNG de 0 byte no cache faria a
                # proxima chamada servir o fracasso de graca, para sempre.
                if still:
                    remove_quietly(dest)
                raise worker.WorkerError(
                    "ffmpeg_failed", "O Remotion falhou: %s" % _falha_render(proc))
            if still:
                self._send_still(dest, props)
            else:
                self._send_video(dest, edited_name(token, body),
                                 background_state=props["backgroundState"])
        except subprocess.TimeoutExpired:
            if still:
                remove_quietly(dest)
                raise worker.WorkerError(
                    "ffmpeg_failed",
                    "O quadro real passou de %.0fs e foi encerrado. O Chrome do Remotion "
                    "pode estar abrindo pela primeira vez; tente de novo." % limite)
            raise worker.WorkerError(
                "ffmpeg_failed",
                "O render passou de %.0f min e foi encerrado. Este trecho tem %.0fs; "
                "corte um pedaço menor ou use o download normal do Passo 3, que usa "
                "FFmpeg e leva segundos." % (limite / 60.0, props["durationSec"]))
        finally:
            for sobra in temporarios:
                remove_quietly(sobra)

    def _handle_cut(self) -> None:
        # A query é conferida ANTES de ler o corpo: recusar 4 GB de upload por causa de um
        # parâmetro errado seria desperdício.
        req = parse_cut_query(urlparse(self.path).query, self.max_seconds)
        length = self._content_length()
        # Espaço conferido ANTES da maior escrita desta rota. O upload do original (até
        # max_upload_bytes) vinha antes de qualquer conferência: com o disco cheio o
        # arquivo era gravado inteiro e só então a rota falhava — e o .src ficava lá. Vale
        # a mesma regra do lote: conferir antes de produzir, com a mesma função
        # (worker.ensure_space) e o mesmo código `no_space` (507 em STATUS_BY_CODE).
        # `length` entra como reserva: uma chamada cobre o original QUE VAI SUBIR e o MP4
        # que sai. Sessão em cache manda length=0 e o cálculo volta a ser o de antes.
        worker.ensure_space(self.cache.folder, req.duration, length)
        cached = self.cache.get(req.token)
        if length == 0:
            if not cached:
                raise worker.WorkerError(
                    "input_missing",
                    "A fonte desta sessão não está mais no servidor; reenvie o arquivo.")
            src, media = cached
        else:
            src = self.cache.path_for(req.token)
            self._receive(src, length)
            # validate_input é o portão que já existe: arquivo vazio, ilegível ou sem
            # faixa de vídeo é recusado aqui, não no meio do render.
            media = worker.validate_input(src)
            self.cache.put(req.token, src, media)

        source_duration = media.get("durationSec")
        if source_duration is not None and req.end > source_duration + worker.TOLERANCE_SEC:
            raise worker.WorkerError(
                "cut_invalid",
                "O corte termina em %.1fs, depois do fim do vídeo (%.1fs)."
                % (req.end, source_duration))
        has_audio = bool(media.get("audioCodec"))

        # Legenda e fundo por miniatura só no 9:16. No horizontal o pedido é explícito: não
        # queimar legenda enquanto a interface não oferecer isso — e o horizontal não tem
        # tarja nenhuma para a miniatura preencher.
        # `estado_fundo` nasce VAZIO e vazio significa "não emitir o cabeçalho": é assim que o
        # horizontal fica de fora sem um `if profile` no meio do _deliver_video.
        documento, legenda, fundo, banda, estado_fundo = ("", "", None, 0, "")
        if req.profile != "horizontal":
            # A correcao e de UM render: sai da prateleira ao ser usada. Guardada, ela
            # sobreviveria ao "Restaurar texto do YouTube" e ao corte apagado e remarcado no
            # MESMO intervalo — o download seguinte queimaria um texto que ninguem mais quer,
            # calado. O navegador reenvia a correcao antes de CADA download, entao consumir
            # aqui nao perde nada (inclusive na retentativa depois de 409, que acontece antes
            # deste ponto).
            with self.caption_lock:
                corrigida = self.caption_edits.pop(
                    edit_key(req.token, req.start, req.end), None)
            # A legenda é ancorada no retângulo do vídeo, então ela depende das dimensões da
            # FONTE — que o validate_input/probe já leu logo acima.
            # A altura do vídeo dentro do quadro serve a DUAS coisas: ancorar a legenda e
            # dimensionar a tarja onde a miniatura entra. Uma leitura, um número.
            altura_video = video_box(req.profile, media)
            documento, legenda = cut_captions(req.name, req.start, req.end,
                                              altura_video, corrigida, req.edit)
            banda = worker.band_height(altura_video)
            caminho_fundo = cut_background(req.name) or ""
            fundo = caminho_fundo if caminho_fundo and background_ok(caminho_fundo) else None
            # Ausência e ilegibilidade dão o MESMO letterbox, e o estado é a única coisa que
            # separa "este vídeo não tinha miniatura" (normal em MP4 local e em trecho
            # baixado antes desta entrega) de "a miniatura chegou quebrada" (baixar o trecho
            # de novo resolve). Aqui a descoberta é a do sidecar (`cut_background`), não a por
            # stem do caminho Remotion — dois caminhos diferentes, mesma decisão de três vias.
            estado_fundo = (BACKGROUND_OK if fundo else
                            BACKGROUND_UNREADABLE if caminho_fundo else BACKGROUND_NONE)
        # O nome vem do token (TOKEN_RE) MAIS um sufixo aleatório da mesma família de
        # caracteres, então continua seguro entrar cru no filtro (ver worker.build_filter) e
        # fica na MESMA pasta do .part, que é o cwd do FFmpeg.
        #
        # O sufixo não é enfeite: o token é da SESSÃO (um por vídeo aberto), não do corte.
        # Com `<token>.ass` fixo, dois downloads do mesmo vídeo ao mesmo tempo escreviam no
        # MESMO arquivo — medido: o clipe A saiu 200, "burned", com a LEGENDA DO CLIPE B, e o
        # B morreu com 500 porque o `finally` do A apagou o arquivo debaixo dele. Não dá para
        # depender do render_lock aqui: ele é declaradamente removível ("se um dia houver
        # máquina sobrando, tire o lock") e a corrida voltaria calada.
        ass_file = (os.path.join(self.cache.folder,
                                 "%s-%s.ass" % (req.token, uuid.uuid4().hex[:12]))
                    if documento else None)
        if ass_file:
            with io.open(ass_file, "w", encoding="utf-8") as fh:
                fh.write(documento)

        dest = os.path.join(self.cache.folder, req.token + "-" + req.output)
        try:
            with self._render_slot():
                render_to(dest, src, req, has_audio, self.ffmpeg_timeout, ass_file, fundo,
                          banda)
            self._send_video(dest, req.output, legenda, estado_fundo)
        finally:
            # O MP4 não precisa sobreviver à resposta: quem guarda é a pasta de Downloads.
            remove_quietly(dest)
            if ass_file:
                remove_quietly(ass_file)

    # ---------------------------------------------------------------- corpo
    def _content_length(self) -> int:
        raw = self.headers.get("Content-Length")
        if not raw:
            return 0
        try:
            length = int(raw)
        except ValueError:
            raise worker.WorkerError("job_invalid", "Content-Length inválido.")
        if length < 0:
            raise worker.WorkerError("job_invalid", "Content-Length negativo.")
        # Anotado ANTES do teto de tamanho: a recusa por arquivo grande também precisa
        # drenar (até DRAIN_LIMIT) para o navegador ler o motivo.
        self.unread = length
        if length > self.max_upload_bytes:
            raise worker.WorkerError(
                "job_invalid",
                "Arquivo de %.1f GB passa do teto de %.1f GB desta rota."
                % (length / 1024 ** 3, self.max_upload_bytes / 1024 ** 3))
        return length

    def _receive(self, dest: str, length: int) -> None:
        """Grava em blocos de 1 MB: o original AV1 4K nunca entra inteiro na memória."""
        remaining = length
        try:
            with open(dest, "wb") as handle:
                while remaining > 0:
                    block = self.rfile.read(min(CHUNK, remaining))
                    if not block:
                        raise worker.WorkerError(
                            "input_empty", "O navegador enviou menos bytes do que anunciou.")
                    handle.write(block)
                    remaining -= len(block)
                    self.unread = remaining
        except BaseException:
            remove_quietly(dest)
            raise

    def _drain(self) -> None:
        """Descarta o corpo que a recusa não leu, para a resposta de erro chegar inteira."""
        remaining = min(self.unread, DRAIN_LIMIT)
        self.unread = 0
        try:
            while remaining > 0:
                block = self.rfile.read(min(CHUNK, remaining))
                if not block:
                    return
                remaining -= len(block)
        except OSError:
            return          # conexão já morreu: não há resposta a salvar

    def _keep(self, path: str, download_name: str) -> str:
        """Guarda o MP4 pronto na pasta dos cortes e devolve o caminho (ou '').

        Falha aqui NÃO derruba o download: o operador recebe o vídeo do mesmo jeito, só
        sem endereço fixo — e o motivo vai para o console em vez de virar erro mudo
        (BP-008). Nome repetido é sobrescrito de propósito: gerar o MESMO corte de novo
        substitui o arquivo em vez de encher a pasta de cópias numeradas.
        """
        try:
            pasta = self._clips_dir()
            os.makedirs(pasta, exist_ok=True)
            alvo = os.path.join(pasta, worker.safe_component(
                download_name, fallback="corte.mp4", max_len=120))
            try:
                os.replace(path, alvo)          # mesmo disco: move, sem segunda cópia
            except OSError:
                shutil.copyfile(path, alvo)     # outro disco: copia; o temporário morre no finally
            return alvo
        except (OSError, ValueError) as err:
            self.log_message("nao consegui guardar o corte em disco: %s", err)
            return ""

    def _finish_video(self, path: str) -> Tuple[str, str]:
        """(estado, caminho acabado ou ''). O passe de -14 LUFS + tag de cor das DUAS rotas.

        Mora aqui pela mesma razão do `_keep`: `_send_video` é o choke point de
        `/api/video-cut` e de `/api/remotion-render`, então nenhuma das duas pode esquecer de
        normalizar. O nome do temporário leva sufixo aleatório porque o token é da SESSÃO, não
        do corte — dois downloads simultâneos do mesmo vídeo escreveriam no mesmo arquivo, que
        é a corrida já medida no `.ass` em 2026-08-25.
        """
        destino = "%s-norm-%s.mp4" % (path, uuid.uuid4().hex[:12])
        estado = worker.finish_video(path, destino, timeout=self.ffmpeg_timeout)
        # Os DOIS estados de sucesso entregam arquivo: no ramo sem faixa de áudio o passe
        # ainda corrigiu a tag de cor, e aceitar só o AUDIO_OK apagaria justamente o arquivo
        # do ramo que a correção de cor existe para cobrir.
        if estado in (worker.AUDIO_OK, worker.AUDIO_SEM_FAIXA) and os.path.exists(destino):
            return estado, destino
        remove_quietly(destino)
        return estado, ""

    def _send_video(self, path: str, download_name: str, captions_state: str = "",
                    background_state: str = "") -> None:
        # O áudio é normalizado ANTES do _keep, senão o arquivo que fica no disco e o que o
        # navegador recebe seriam o de -21 LUFS enquanto a tela diz que normalizou.
        audio_state, normalizado = self._finish_video(path)
        if normalizado:
            path = normalizado
        try:
            self._deliver_video(path, download_name, captions_state, audio_state,
                                background_state)
        finally:
            # No caminho normal o _keep já MOVEU este arquivo (os.replace) e isto é no-op; ele
            # existe para o caminho em que guardar falhou e o temporário sobraria.
            if normalizado:
                remove_quietly(normalizado)

    def _deliver_video(self, path: str, download_name: str, captions_state: str,
                       audio_state: str, background_state: str = "") -> None:
        # Guardar ANTES de responder: os bytes que o navegador recebe são os do arquivo que
        # ficou no disco, então o que a revisão toca depois é exatamente o que foi baixado.
        guardado = self._keep(path, download_name)
        if guardado:
            path = guardado
        size = os.path.getsize(path)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Length", str(size))
        self.send_header("Content-Disposition", 'attachment; filename="%s"' % download_name)
        if guardado:
            # quote porque o cabeçalho é latin-1 e a pasta pessoal pode ter acento.
            self.send_header("X-Clip-Path", quote(guardado))
        # SEMPRE presente: as duas rotas passam por aqui, então cabeçalho ausente significaria
        # que ninguém tentou — e "entreguei a -21 LUFS" calado é indistinguível de "entreguei
        # no alvo do feed" até alguém comparar com o vídeo do lado (BP-008).
        self.send_header("X-Clip-Audio", _audio_state(audio_state))
        if captions_state:
            # Mesmo mecanismo do X-Clip-Path: o navegador precisa saber se a legenda entrou
            # ou por que não entrou. "Renderizou sem legenda" calado é indistinguível de
            # "renderizou com legenda" até alguém abrir o arquivo (BP-008).
            self.send_header("X-Clip-Captions", captions_state)
        if background_state:
            # CONDICIONAL, como o X-Clip-Captions e diferente do X-Clip-Audio: o perfil
            # horizontal não tem tarja e não tem fundo, então emitir estado ali seria
            # inventar. Ausência = "esta rota não tem o que dizer sobre fundo".
            # Passa pelo conjunto fechado porque o valor sai num cabeçalho: `NONE` e
            # `UNREADABLE` dão o mesmo letterbox, e sem este cabeçalho o operador não tinha
            # como saber qual dos dois foi — o motivo ia só ao console (BP-008).
            self.send_header("X-Clip-Background", _background_state(background_state))
        # O navegador marca a sessão como já enviada ao ver este cabeçalho (video-ops.js:1995).
        self.send_header("X-Video-Source-Cached", "1")
        # `Cache-Control: no-store` sai do end_headers, que vale para TODA resposta.
        self.end_headers()
        with open(path, "rb") as handle:
            shutil.copyfileobj(handle, self.wfile, CHUNK)

    def _error(self, status, code: str, message: str) -> None:
        # Todo erro passa por aqui, então o descarte do corpo mora aqui: recusar sem drenar
        # entrega um reset em vez do motivo, e a rota tem várias recusas ANTES de ler o
        # corpo (query inválida, arquivo grande demais, disco sem espaço).
        self._drain()
        body = json.dumps({"error": message, "code": code}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)


# --------------------------------------------------------------------------- servidor

def build_server(root: str, port: int = 0, max_seconds: float = DEFAULT_MAX_SECONDS,
                 max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
                 ffmpeg_timeout: Optional[float] = DEFAULT_FFMPEG_TIMEOUT,
                 folder: Optional[str] = None,
                 clips: Optional[str] = None) -> ThreadingHTTPServer:
    """port=0 pega porta livre — é assim que o teste sobe o servidor sem brigar pela 8765.

    Todo temporário fica num mkdtemp fora da pasta do projeto: nenhuma requisição escreve
    dentro do repositório.
    """
    temp = folder or tempfile.mkdtemp(prefix="video-cut-")
    atexit.register(shutil.rmtree, temp, ignore_errors=True)

    # Subclasse por servidor: dois servidores num teste não compartilham cache nem limites.
    bound = type("BoundCutHandler", (CutHandler,), {
        "cache": SourceCache(temp),
        "max_seconds": max_seconds,
        "max_upload_bytes": max_upload_bytes,
        "ffmpeg_timeout": ffmpeg_timeout,
        "render_timeout": DEFAULT_RENDER_TIMEOUT,
        "render_lock": threading.Lock(),
        "render_lock_wait": RENDER_LOCK_WAIT,
        "clips_folder": clips or default_clips_dir(),
        "caption_edits": {},
        "caption_lock": threading.Lock(),
        "imports": {},
        "imports_lock": threading.Lock(),
    })
    server = ThreadingHTTPServer(("127.0.0.1", port), functools.partial(bound, directory=root))
    server.daemon_threads = True
    server.temp_folder = temp
    return server


def close_server(server: ThreadingHTTPServer) -> None:
    server.server_close()
    shutil.rmtree(getattr(server, "temp_folder", ""), ignore_errors=True)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Servidor local do Estúdio de Vídeos: site estático + POST /api/video-cut.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--root", default=worker.REPO,
                        help="pasta servida como site (padrão: raiz do repositório)")
    parser.add_argument("--max-seconds", type=float, default=DEFAULT_MAX_SECONDS,
                        help="duração máxima de um corte")
    parser.add_argument("--max-upload-bytes", type=int, default=DEFAULT_MAX_UPLOAD_BYTES)
    parser.add_argument("--ffmpeg-timeout", type=float, default=DEFAULT_FFMPEG_TIMEOUT)
    parser.add_argument("--clips", default=default_clips_dir(),
                        help="pasta onde os cortes prontos ficam guardados (HD externo, etc.)")
    args = parser.parse_args(argv)

    if not os.path.exists(worker.FFMPEG):
        print("FALHOU: FFmpeg do projeto não encontrado em %s" % worker.FFMPEG)
        return 2
    root = os.path.realpath(args.root)
    if not os.path.isdir(root):
        print("FALHOU: pasta do site não encontrada: %s" % root)
        return 2

    server = build_server(root, port=args.port, max_seconds=args.max_seconds,
                          max_upload_bytes=args.max_upload_bytes,
                          ffmpeg_timeout=args.ffmpeg_timeout, clips=args.clips)
    host, bound_port = server.server_address[0], server.server_address[1]
    print("Estúdio de Vídeos servindo em http://%s:%d/index.html" % (host, bound_port))
    print("Corte de 1 clique ativo em POST %s (só 127.0.0.1). Ctrl+C encerra." % ROUTE)
    print("Cortes salvos em %s (a revisão toca daqui)." % args.clips)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nencerrando…")
    finally:
        close_server(server)
    return 0


if __name__ == "__main__":
    sys.exit(main())
