# -*- coding: utf-8 -*-
"""Provas do servidor local (serve.py), com mídia SINTÉTICA.

Nenhum conteúdo protegido é usado: o vídeo vem dos geradores internos do FFmpeg
(testsrc2 + sine). Complementa o test_worker.py, que prova o lote; aqui o alvo é a rota
POST /api/video-cut — o caminho de 1 clique da revisão, que entrega o MP4 pronto para
postar no TikTok/Instagram.

O que este script prova (e falha alto se não for verdade):
   1. token fora do formato          -> recusado antes de tocar disco
   2. perfil desconhecido            -> recusado (só horizontal/blur/crop)
   3. início/fim inválido            -> cut_invalid (negativo, invertido, NaN, inf, longo demais)
   4. output com travessia           -> vira UM nome de arquivo, nunca caminho
   5. output sem extensão            -> ganha .mp4
   6. fonte fora do cache + sem corpo-> 409 (o navegador reenvia o arquivo)
   7. corte 9:16 de verdade          -> 200, video/mp4, 1080x1920, H.264+AAC
   8. segundo corte sem reenviar     -> reaproveita o cache pelo token
   9. corte horizontal               -> 200 e mantém o 16:9 em 1080p
  10. corte além do fim do vídeo     -> cut_invalid, sem gerar arquivo
  11. .env e .git                    -> 404 (o http.server padrão entregava)
  12. index.html                     -> 200 (o site continua servido)
  13. nada escrito na pasta do site  -> o temporário é o único lugar tocado
  14. encerramento                   -> o diretório temporário é removido
  16. corte pronto                   -> fica na pasta de cortes, é servido em /clips/ e
                                        /clips/../ não escapa da pasta

Uso:
    py -3.12 video-worker\\test_serve.py
    py -3.12 video-worker\\test_serve.py --keep   (mantém os temporários p/ inspeção)
"""

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import serve  # noqa: E402
import ytclip  # noqa: E402  (a lista de extensão da miniatura mora lá; ver bloco 26)
import worker  # noqa: E402
import captions as captions_mod  # noqa: E402

CHECKS = []

CR, LF = chr(13), chr(10)


def _codifica_cabecalho(valor):
    """O cabecalho HTTP e latin-1 estrito; valor que nao codifica derruba a resposta."""
    try:
        ("X-Clip-Captions: " + valor).encode("latin-1", "strict")
        return True
    except UnicodeEncodeError:
        return False



def check(label, ok):
    CHECKS.append((label, bool(ok)))
    return bool(ok)


def fail(msg):
    print("FALHOU: " + msg)
    sys.exit(1)


def recusa(raw_query, max_seconds=serve.DEFAULT_MAX_SECONDS):
    """Devolve o código do WorkerError, ou None se a query passou (o que seria a falha)."""
    try:
        serve.parse_cut_query(raw_query, max_seconds)
    except worker.WorkerError as err:
        return err.code
    return None


def make_source(path, seconds, width, height, audio=True):
    """Original sintético. Horizontal de propósito: é o caso que exercita o 9:16."""
    def produce(dest):
        args = ["-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i",
                "testsrc2=size=%dx%d:rate=30:duration=%d" % (width, height, seconds)]
        if audio:
            args += ["-f", "lavfi", "-i", "sine=frequency=330:duration=%d" % seconds]
        args += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
        args += (["-c:a", "aac", "-b:a", "96k", "-shortest"] if audio else ["-an"])
        args += ["-movflags", "+faststart", "-f", "mp4", dest]
        worker.run_ffmpeg(args)

    worker.write_atomic(path, produce)
    return path


# --------------------------------------------------------------------------- HTTP

class Resposta:
    def __init__(self, status, headers, body):
        self.status = status
        self.headers = headers
        self.body = body

    @property
    def erro(self):
        """A mensagem que o navegador leria (video-ops.js usa payload.error)."""
        try:
            return json.loads(self.body.decode("utf-8")).get("error", "")
        except (ValueError, UnicodeDecodeError):
            return ""

    @property
    def codigo_erro(self):
        try:
            return json.loads(self.body.decode("utf-8")).get("code", "")
        except (ValueError, UnicodeDecodeError):
            return ""


def pedir(url, data=None, headers=None):
    """POST/GET que NÃO levanta em 4xx/5xx: o teste precisa ler o corpo do erro."""
    request = urllib.request.Request(url, data=data,
                                     method="POST" if data is not None else "GET")
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            return Resposta(response.status, dict(response.headers), response.read())
    except urllib.error.HTTPError as err:
        return Resposta(err.code, dict(err.headers), err.read())


def post_cut(base, token, start, end, profile, output, corpo=None):
    query = ("?token=%s&name=fonte.mp4&start=%s&end=%s&profile=%s&output=%s"
             % (token, start, end, profile, output))
    # data=b"" faz o urllib mandar Content-Length: 0 — é o "reaproveite o cache".
    return pedir(base + serve.ROUTE + query, data=corpo if corpo is not None else b"",
                 headers={"Content-Type": "application/octet-stream"})


# --------------------------------------------------------------------------- main

def main():
    parser = argparse.ArgumentParser(
        description="Provas do servidor local do Estúdio de Vídeos.")
    parser.add_argument("--keep", action="store_true", help="mantém os temporários")
    args = parser.parse_args()

    trabalho = tempfile.mkdtemp(prefix="serve-test-")
    site = os.path.join(trabalho, "site")
    os.makedirs(site)
    # Site de mentira: um arquivo público e dois que NÃO podem sair pela porta.
    with open(os.path.join(site, "index.html"), "w", encoding="utf-8") as handle:
        handle.write("<h1>site</h1>")
    with open(os.path.join(site, ".env"), "w", encoding="utf-8") as handle:
        handle.write("SEGREDO=nao-e-real")
    os.makedirs(os.path.join(site, ".git"))
    with open(os.path.join(site, ".git", "config"), "w", encoding="utf-8") as handle:
        handle.write("[core]")

    # ------------------------------------------------------------ 1-5: validação pura
    check("1. token vazio recusado", recusa("token=&profile=blur&start=0&end=5") == "job_invalid")
    check("1b. token com barra recusado",
          recusa("token=a%2Fb&profile=blur&start=0&end=5") == "job_invalid")
    check("1c. token com .. recusado",
          recusa("token=..&profile=blur&start=0&end=5") == "job_invalid")
    check("1d. token longo demais recusado",
          recusa("token=" + "a" * 65 + "&profile=blur&start=0&end=5") == "job_invalid")
    check("2. perfil desconhecido recusado",
          recusa("token=t1&profile=zoom&start=0&end=5") == "job_invalid")
    check("2b. perfil vazio cai no horizontal",
          serve.parse_cut_query("token=t1&start=0&end=5").profile == "horizontal")
    check("3. início negativo recusado",
          recusa("token=t1&profile=blur&start=-1&end=5") == "cut_invalid")
    check("3b. fim antes do início recusado",
          recusa("token=t1&profile=blur&start=9&end=5") == "cut_invalid")
    check("3c. intervalo vazio recusado",
          recusa("token=t1&profile=blur&start=5&end=5") == "cut_invalid")
    check("3d. NaN recusado", recusa("token=t1&profile=blur&start=nan&end=5") == "cut_invalid")
    check("3e. inf recusado", recusa("token=t1&profile=blur&start=0&end=inf") == "cut_invalid")
    check("3f. texto no lugar do número recusado",
          recusa("token=t1&profile=blur&start=abc&end=5") == "cut_invalid")
    check("3g. start ausente recusado", recusa("token=t1&profile=blur&end=5") == "cut_invalid")
    check("3h. corte acima do teto recusado",
          recusa("token=t1&profile=blur&start=0&end=1000") == "cut_invalid")
    check("3i. teto é configurável",
          recusa("token=t1&profile=blur&start=0&end=30", max_seconds=10.0) == "cut_invalid")

    travessia = serve.parse_cut_query(
        "token=t1&profile=blur&start=0&end=5&output=..%5C..%5Cindex.html").output
    check("4. output com travessia não é caminho",
          "\\" not in travessia and "/" not in travessia and ".." not in travessia)
    check("4b. output com travessia continua .mp4", travessia.endswith(".mp4"))
    absoluto = serve.parse_cut_query(
        "token=t1&profile=blur&start=0&end=5&output=C%3A%5Cx.mp4").output
    check("4c. output absoluto não é caminho", ":" not in absoluto and "\\" not in absoluto)
    check("5. output sem extensão ganha .mp4",
          serve.parse_cut_query("token=t1&profile=blur&start=0&end=5&output=corte").output
          == "corte.mp4")
    check("5b. output vazio cai no padrão",
          serve.parse_cut_query("token=t1&profile=blur&start=0&end=5&output=").output
          == "corte.mp4")

    # ------------------------------------------------------------ servidor de pé
    # Pasta de cortes apontada para o temporário do teste: a prova não escreve na pasta
    # pessoal de quem roda (o padrão é ~/Videos/Cortes Estudio).
    cortes = os.path.join(trabalho, "cortes-salvos")
    servidor = serve.build_server(site, port=0, max_seconds=60.0, clips=cortes)
    temporario = servidor.temp_folder
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % servidor.server_address[1]
    antes_do_site = sorted(os.listdir(site))

    try:
        # -------------------------------------------------------- 6: contrato do 409
        sem_cache = post_cut(base, "tok_frio", 0, 3, "blur", "corte.mp4")
        check("6. fonte fora do cache devolve 409", sem_cache.status == 409)
        check("6b. o 409 explica o que fazer, em JSON",
              sem_cache.codigo_erro == "input_missing" and "reenvie" in sem_cache.erro.lower())

        # -------------------------------------------------------- 11-12: estático
        env = pedir(base + "/.env")
        check("11. .env não sai pela porta (404)", env.status == 404)
        check("11b. o corpo do 404 não traz o segredo", b"nao-e-real" not in env.body)
        check("11c. .git não sai pela porta", pedir(base + "/.git/config").status == 404)
        pagina = pedir(base + "/index.html")
        check("12. index.html continua servido",
              pagina.status == 200 and b"<h1>site</h1>" in pagina.body)

        # ------------------------------------------------ 17: legenda vinda do sidecar
        # A pasta do baixador é redirecionada para o temporário: o teste NUNCA escreve na
        # pasta pessoal de quem roda (mesma regra do `clips=` mais acima).
        sidecars = os.path.join(trabalho, "sidecars")
        os.makedirs(sidecars)
        serve._sidecar_dir = lambda: sidecars

        def grava_sidecar(nome, payload):
            alvo = os.path.join(sidecars, os.path.splitext(nome)[0] + ".mostreplayed.json")
            with open(alvo, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False)
            return alvo

        MR_OK = {"available": True, "source": "youtube_heatmap", "reason": "", "peaks": [
            {"start": 30.0, "end": 50.0, "peakTime": 40.0, "peakValue": 1.0,
             "averageValue": 0.9, "rank": 1}]}
        FALAS = [{"start": 25, "end": 32, "text": "entra pela borda"},
                 {"start": 35, "end": 38, "text": "no meio do corte"},
                 {"start": 48, "end": 55, "text": "sai pela borda"},
                 {"start": 60, "end": 65, "text": "fora do corte"}]
        grava_sidecar("fonte.mp4", {
            "version": 2, "videoId": "abcdefghijk", "sourceUrl": "https://y/x",
            "duration": 8.0, "mostReplayed": MR_OK,
            "captions": {"available": True, "language": "pt-BR", "kind": "manual",
                         "reason": "", "cues": FALAS}})
        # Sidecar ANTIGO (v1): só audiência, sem a chave `captions` e sem `version`.
        grava_sidecar("antigo.mp4", {"videoId": "velho", "sourceUrl": "", "duration": 8.0,
                                     "mostReplayed": MR_OK})

        def mr(nome):
            return json.loads(pedir(base + serve.ROUTE_MR,
                                    data=json.dumps({"name": nome}).encode("utf-8"),
                                    headers={"Content-Type": "application/json"}).body)

        novo = mr("fonte.mp4")
        check("17. /api/most-replayed continua devolvendo os picos",
              novo["mostReplayed"]["available"] and len(novo["mostReplayed"]["peaks"]) == 1)
        check("17b. e agora diz que o vídeo tem legenda",
              novo["captions"]["available"] and novo["captions"]["language"] == "pt-BR"
              and novo["captions"]["kind"] == "manual")
        check("17c. manda a CONTAGEM, nunca a transcrição inteira",
              novo["captions"]["count"] == 4 and "cues" not in novo["captions"])

        velho = mr("antigo.mp4")
        check("17d. sidecar ANTIGO continua valendo: os picos chegam igual",
              velho["mostReplayed"]["available"] and len(velho["mostReplayed"]["peaks"]) == 1)
        check("17e. e o bloco de legenda degrada para 'não disponível', sem quebrar",
              velho["captions"]["available"] is False
              and velho["captions"]["reason"] == "CAPTIONS_NOT_AVAILABLE")
        ausente = mr("nunca-baixado.mp4")
        check("17f. vídeo sem sidecar nenhum não é erro",
              ausente["mostReplayed"]["available"] is False
              and ausente["captions"]["available"] is False)

        # cut_captions: a função que decide o que vai ser queimado. Pura o bastante para
        # ser conferida sem FFmpeg.
        doc, estado = serve.cut_captions("fonte.mp4", 30.0, 50.0)
        # "burned-sem-inter" também é sucesso: a legenda entrou, só que a fonte do projeto
        # não está instalada nesta máquina e o libass caiu no Arial (dito, nunca calado).
        check("17g. o corte 30-50 produz legenda",
              estado in ("burned", "burned-sem-inter") and bool(doc))
        check("17h. e ela vem com o relógio zerado no começo do corte",
              "0:00:00.00" in doc and "fora do corte" not in doc)
        check("17i. trecho sem nenhuma fala dentro é dito, não fingido",
              serve.cut_captions("fonte.mp4", 0.0, 5.0)[1] == "CAPTIONS_OUT_OF_RANGE")
        check("17j. sidecar antigo -> sem legenda, com motivo",
              serve.cut_captions("antigo.mp4", 30.0, 50.0)[1] == "CAPTIONS_NOT_AVAILABLE")
        check("17k. nome com travessia não lê nada e não levanta",
              serve.cut_captions("../../index.html", 0.0, 5.0)[1] == "CAPTIONS_NOT_AVAILABLE")
        check("17l. nome vazio idem",
              serve.cut_captions("", 0.0, 5.0)[1] == "CAPTIONS_NOT_AVAILABLE")
        # Legenda quebrada no sidecar: o corte tem de sair mesmo assim.
        grava_sidecar("torto.mp4", {"version": 2, "duration": 8.0, "mostReplayed": MR_OK,
                                    "captions": {"available": True, "language": "pt",
                                                 "kind": "manual", "cues": "isto nao e lista"}})
        check("17m. legenda malformada degrada em vez de derrubar o corte",
              serve.cut_captions("torto.mp4", 0.0, 5.0)[1] == "CAPTIONS_NOT_AVAILABLE")
        grava_sidecar("falhou.mp4", {
            "version": 2, "duration": 8.0, "mostReplayed": MR_OK,
            "captions": {"available": False, "language": "", "kind": "", "cues": [],
                         "reason": "CAPTIONS_EXTRACTION_FAILED"}})
        check("17n. falha de extração no download chega distinta até aqui",
              serve.cut_captions("falhou.mp4", 0.0, 5.0)[1] == "CAPTIONS_EXTRACTION_FAILED")

        # O estado vai para o cabecalho X-Clip-Captions e de la para uma frase na tela. Um
        # `reason` livre vindo do disco quebrava os dois lados: CRLF injeta cabecalho na
        # resposta HTTP, e motivo desconhecido nao tem frase no CAPTIONS_MSG do video-ops.js
        # -- o corte saia sem legenda e a tela nao dizia nada (BP-008).
        for apelido, motivo in (("crlf", "X" + CR + LF + "Set-Cookie: roubado=1"),
                                ("lixo", "MOTIVO_QUE_NAO_EXISTE"),
                                ("acento", "nao ha legenda " + chr(9986))):
            grava_sidecar(apelido + ".mp4", {
                "version": 2, "duration": 8.0, "mostReplayed": MR_OK,
                "captions": {"available": False, "language": "", "kind": "", "cues": [],
                             "reason": motivo}})
            estado = serve.cut_captions(apelido + ".mp4", 0.0, 5.0)[1]
            check("17n1. sidecar %s vira estado conhecido" % apelido,
                  estado in serve.CAPTION_STATES)
            check("17n2. sidecar %s nao carrega CR/LF para o cabecalho" % apelido,
                  CR not in estado and LF not in estado)
            # O cabecalho HTTP e latin-1 estrito: acento cru derrubaria a resposta inteira.
            check("17n3. sidecar %s e codificavel no cabecalho" % apelido,
                  _codifica_cabecalho(estado))
        # E os dois motivos legitimos continuam DISTINTOS: o guarda recusa o desconhecido,
        # nunca colapsa "o video nao publica" com "nos falhamos".
        check("17n4. o guarda nao colapsa os pares legitimos",
              serve.cut_captions("antigo.mp4", 30.0, 50.0)[1] !=
              serve.cut_captions("falhou.mp4", 0.0, 5.0)[1])
        # Sidecar v4: a legenda ganhou o tempo por PALAVRA (`words`) ao lado da janela
        # rolante (`cues`). A prova é de POLARIDADE, com valor construído: as duas listas
        # dizem coisas DIFERENTES de propósito, então o ASS mostra qual delas foi queimada.
        # Trocar `bloco["words"]` por `[]` no `cut_captions` reprova aqui — asserir texto do
        # arquivo não pegaria isso (a lição de 2026-08-26, que custou uma feature inteira).
        grava_sidecar("palavra.mp4", {
            "version": 4, "videoId": "abcdefghijk", "sourceUrl": "https://y/x",
            "duration": 60.0, "mostReplayed": MR_OK,
            "captions": {
                "available": True, "language": "pt", "kind": "automatica", "reason": "",
                # A janela rolante junta as duas ideias numa fala só, do jeito que o
                # reconhecedor entregou.
                "cues": [{"start": 30.0, "end": 34.0,
                          "text": "eu perdi quarenta mil reais. depois eu aprendi"}],
                # As MESMAS palavras, com instante. A pausa entre "reais." e "depois" é de
                # 1,5 s — acima do PAUSA_LINHA_SEC — e o ponto final fecha a linha.
                "words": [{"start": 30.0, "end": 30.4, "text": "eu"},
                          {"start": 30.4, "end": 30.9, "text": "perdi"},
                          {"start": 30.9, "end": 31.4, "text": "quarenta"},
                          {"start": 31.4, "end": 31.7, "text": "mil"},
                          {"start": 31.7, "end": 33.2, "text": "reais."},
                          {"start": 33.2, "end": 33.6, "text": "depois"},
                          {"start": 33.6, "end": 33.9, "text": "eu"},
                          {"start": 33.9, "end": 34.4, "text": "aprendi"}]}})
        doc_palavra, estado_palavra = serve.cut_captions("palavra.mp4", 30.0, 40.0, 608)
        falas_palavra = [l for l in doc_palavra.splitlines() if l.startswith("Dialogue:")]
        check("17q. o sidecar v4 queima a legenda montada por PALAVRA",
              estado_palavra in ("burned", "burned-sem-inter") and len(falas_palavra) == 2)
        check("17q2. a primeira fala fecha no ponto final, não na janela do reconhecedor",
              falas_palavra[0].endswith("reais.")
              and falas_palavra[1].endswith("depois eu aprendi"))
        # 2,40 s = 1,70 (início da última palavra da linha, no relógio do corte) +
        # PAUSA_LINHA_SEC: a linha sai da tela depois de ser falada, em vez de ficar pendurada
        # até a palavra seguinte (que só vem 1,5 s depois).
        check("17q3. e sai da tela no rabo de linha medido, não na pausa inteira",
              ",0:00:02.40," in falas_palavra[0]
              and falas_palavra[1].startswith("Dialogue: 0,0:00:03.20,"))
        check("17q4. sidecar v2 (sem `words`) continua no caminho da cue grossa",
              serve._sidecar_captions(
                  {"captions": {"available": True, "cues": FALAS}})["words"] == [])
        # O filtro do FFmpeg: com legenda ganha o `ass=`, sem legenda fica igual ao de antes.
        # A cadeia terminava no `ass=`; desde 2026-09-03 ela termina nas TAGS DE COR, e o
        # `ass=` fica logo antes. Este check passou a fixar a ORDEM (que e o que importa: o
        # `setparams` so marca o quadro, e por ultimo ele descreve o que sai do fim da
        # cadeia) em vez de so "termina com ass=".
        check("17o. o filtro 9:16 ganha o ass= quando há legenda, antes das tags de cor",
              (",ass=t1.ass:fontsdir=.," + worker.COR_TAGS)
              in worker.build_filter("blur", "t1.ass")
              and worker.build_filter("blur", "t1.ass").endswith("," + worker.COR_TAGS))
        check("17p. e fica idêntico ao antigo quando não há",
              "ass=" not in worker.build_filter("blur")
              and "ass=" not in worker.build_filter("crop"))

        # ---------------------------------------- 19: retângulo do vídeo (âncora da legenda)
        check("19. um 16:9 ocupa 608 dos 1920px (a legenda tem de caber DENTRO disso)",
              serve.video_box("blur", {"width": 1920, "height": 1080}) == 608)
        check("19b. no crop o vídeo é o quadro inteiro",
              serve.video_box("crop", {"width": 1920, "height": 1080}) == 1920)
        check("19c. fonte mais alta que 9:16 não passa do quadro",
              serve.video_box("blur", {"width": 1080, "height": 4000}) == 1920)
        check("19d. sem dimensão legível devolve None em vez de inventar retângulo",
              serve.video_box("blur", {}) is None
              and serve.video_box("blur", {"width": 0, "height": 0}) is None)
        doc_607, _ = serve.cut_captions("fonte.mp4", 30.0, 50.0, 608)
        doc_cheio, _ = serve.cut_captions("fonte.mp4", 30.0, 50.0, 1920)
        estilo_607 = [l for l in doc_607.splitlines() if l.startswith("Style: ")][0]
        margem_607 = int(estilo_607[len("Style: "):].split(",")[21])
        check("19e. a legenda do 16:9 fica acima da borda de baixo do vídeo",
              1920 - margem_607 < (1920 + 608) / 2)
        check("19f. e o retângulo muda a posição (não é número fixo)",
              doc_607 != doc_cheio)

        # ---------------------------------------- 20: miniatura como fundo do 9:16
        check("20. sem a chave `thumbnail` no sidecar não há fundo (segue desfocado)",
              serve.cut_background("fonte.mp4") == "")
        with open(os.path.join(sidecars, "fonte.webp"), "wb") as fh:
            fh.write(b"RIFF0000WEBPVP8 ")

        def sidecar_thumb(valor):
            grava_sidecar("fonte.mp4", {
                "version": 3, "videoId": "abcdefghijk", "duration": 8.0,
                "mostReplayed": MR_OK, "thumbnail": valor,
                "captions": {"available": True, "language": "pt-BR", "kind": "manual",
                             "reason": "", "cues": FALAS}})

        sidecar_thumb("fonte.webp")
        check("20b. com o arquivo no disco, o fundo é o caminho DENTRO da pasta do baixador",
              serve.cut_background("fonte.mp4") == os.path.join(sidecars, "fonte.webp"))
        sidecar_thumb("..\\..\\index.html")
        check("20c. travessia no nome da miniatura não vira entrada do FFmpeg",
              serve.cut_background("fonte.mp4") == "")
        sidecar_thumb("fonte.exe")
        check("20d. extensão fora da lista fechada é recusada",
              serve.cut_background("fonte.mp4") == "")
        sidecar_thumb("nao-existe.jpg")
        check("20e. miniatura declarada mas ausente do disco não é apontada",
              serve.cut_background("fonte.mp4") == "")
        # Este check dizia "NAO tem desfoque", e mudou de afirmacao em 2026-09-03 em vez de
        # sair. O desfoque proibido era o do VIDEO (a tira central dele, removida em
        # 2026-08-27); o que entrou agora e o desfoque da MINIATURA, que e o que apaga a
        # manchete dela -- nitida, ela aparecia legivel DUAS vezes no quadro. Ou seja: o
        # `gblur` tem de estar no ramo da miniatura (`[1:v]`) e vir do token, nunca no video.
        com_thumb = worker.build_filter("blur", None, "t.webp")
        check("20f. o desfoque da MINIATURA existe, vem do token e o [1:v] continua lá",
              ("gblur=sigma=%d" % worker.THUMB_DESFOQUE_SIGMA) in com_thumb
              and "[1:v]" in com_thumb
              # o desfoque mora DEPOIS do corte da tarja (borrar antes desperdicaria pixel
              # que vai ser jogado fora) e ANTES do escurecimento
              and com_thumb.index("gblur=") < com_thumb.index("colorchannelmixer=")
              # e o VIDEO nao e borrado: o `[fg]`/`[base]` nao passam por gblur nenhum
              and com_thumb.count("gblur=") == 1)
        # Escurecimento MULTIPLICATIVO: subtrair brilho fixo apagava miniatura escura.
        check("20g. e escurece a miniatura (senão ela disputa com o vídeo)",
              "colorchannelmixer=rr=" in worker.build_filter("blur", None, "t.webp")
              and worker.THUMB_LUZ < 0.7)
        check("20g2. sem subtrair brilho fixo (miniatura escura viraria preto)",
              "brightness=" not in worker.build_filter("blur", None, "t.webp"))
        check("20h. `background=None` e sem argumento dão o MESMO filtro",
              worker.build_filter("blur") == worker.build_filter("blur", None, None))

        # --- 20i-20p: miniatura no tamanho da TARJA, duas vezes (2026-09-01).
        # Antes, UMA miniatura era esticada para cobrir 1080x1920: ampliava ~3,2x e cada
        # tarja mostrava uma fatia gigante e ilegível da imagem. Agora ela entra no tamanho
        # de uma tarja, inteira, repetida em cima e embaixo.
        check("20i. band_height: um 16:9 (608px de vídeo) deixa 656 de tarja",
              worker.band_height(608) == 656)
        check("20i2. vídeo que enche o quadro não tem tarja nenhuma (ZERO, não 'falsy')",
              worker.band_height(worker.OUT_H) == 0)
        check("20i3. altura ilegível devolve 0 em vez de estourar",
              worker.band_height(None) == 0 and worker.band_height("x") == 0)
        check("20i4. e nunca devolve negativo (fonte mais alta que o quadro)",
              worker.band_height(worker.OUT_H + 400) == 0)

        com_banda = worker.build_filter("blur", None, "t.webp", 656)
        sem_banda = worker.build_filter("blur", None, "t.webp")
        check("20j. com band_h a miniatura é escalada para a TARJA, não para o quadro",
              "scale=1080:656:force_original_aspect_ratio=increase,crop=1080:656" in com_banda
              and "crop=1080:1920" not in com_banda)
        check("20k. e entra DUAS vezes: uma no topo, uma na base",
              "split=2[t1][t2]" in com_banda
              and "[t1]overlay=0:0" in com_banda and "[t2]overlay=0:H-h" in com_banda)
        check("20l. o escurecimento continua o mesmo nos dois ramos",
              ("colorchannelmixer=rr=%.2f" % worker.THUMB_LUZ) in com_banda)
        # Polaridade: sem o número da tarja o filtro tem de ser EXATAMENTE o de antes, senão
        # corte de MP4 local (que não tem miniatura medida) mudaria de aparência de tabela.
        check("20m. sem band_h o filtro é o de antes, byte a byte",
              sem_banda == worker.build_filter("blur", None, "t.webp", None))
        check("20m2. e band_h=0 também cai no ramo antigo (não há tarja para preencher)",
              worker.build_filter("blur", None, "t.webp", 0) == sem_banda)
        # O rótulo do vídeo virou `[fgr]` quando o canto passou a ser arredondado
        # (2026-09-11) — com `VIDEO_RAIO = 0` ele volta a ser `[fgs]`. Perguntar ao dono do
        # rótulo, em vez de cravá-lo aqui, mantém o check cobrando o que sempre cobrou: o
        # vídeo INTEIRO entrando por cima do fundo, centrado.
        _, rotulo_fg = worker._round_corners("blur")
        check("20n. o vídeo continua entrando inteiro por cima, sem corte",
              "force_original_aspect_ratio=decrease" in com_banda
              and ("[bg]%soverlay=(W-w)/2:(H-h)/2" % rotulo_fg) in com_banda)
        # O relógio: a miniatura é UM quadro, então quem carrega o fps é [canvas] (o vídeo).
        # Sem isto, um original de 30 fps sairia reamostrado para 25.
        check("20o. [canvas] continua sendo quem carrega o relógio",
              "[0:v]split=2[base][fg]" in com_banda and "[base]scale=" in com_banda)
        check("20p. a legenda ainda pode ser encadeada depois, antes das tags de cor",
              (",ass=x.ass:fontsdir=.," + worker.COR_TAGS)
              in worker.build_filter("blur", "x.ass", "t.webp", 656))

        # 20q: a FIAÇÃO serve -> worker. Sem este check, apagar o argumento na chamada de
        # `render_to` mataria a tarja em todo download do Passo 3 e as 8 suítes seguiriam
        # verdes: os checks acima só provam que `build_filter` SABE fazer, não que alguém
        # pede. Interceptando o render_cut em vez de procurar texto no fonte.
        capturado = {}
        real_render_cut = worker.render_cut

        def espiao(*args, **kwargs):
            capturado.update(kwargs)
            open(args[1], "wb").write(b"x")

        worker.render_cut = espiao
        # Pasta PRÓPRIA e descartada: o arquivo falso do espião no temporário do servidor
        # reprovava o check 13 ("o corte entregue não fica ocupando o temporário").
        fio = tempfile.mkdtemp(prefix="fio-")
        try:
            pedido = serve.CutRequest(token="tok", name="fonte.mp4", start=0.0, end=1.0,
                                      profile="blur", output="o.mp4")
            try:
                serve.render_to(os.path.join(fio, "o.mp4"), "fonte.mp4", pedido,
                                False, None, None, "t.webp", 656)
            except Exception:
                pass  # a checagem da saída falha com o arquivo falso; só a chamada importa
        finally:
            worker.render_cut = real_render_cut
            shutil.rmtree(fio, ignore_errors=True)
        check("20q. o render_to REPASSA a altura da tarja ao worker (fiação viva)",
              capturado.get("band_h") == 656 and capturado.get("background") == "t.webp")
        # O ramo SEM miniatura (MP4 local do Passo 3, trecho em cache antigo,
        # `--write-thumbnail` que falhou). O desfoque saiu em 2026-08-27 e o fundo virou
        # letterbox chapado na cor do preset. Exercitando build_filter, não `in arquivo`:
        # trocar o `pad` de volta por `gblur` passa em qualquer asserção de texto do fonte.
        sem_thumb = worker.build_filter("blur")
        check("20j. sem miniatura o fundo é letterbox chapado, não desfoque",
              "pad=%d:%d:" % (worker.OUT_W, worker.OUT_H) in sem_thumb
              and "gblur" not in sem_thumb)
        check("20k. a cor do letterbox é a do preset (%s)" % worker.FUNDO_COR,
              ("color=" + worker.FUNDO_COR) in sem_thumb)
        check("20l. a fonte inteira cabe deitada (nada de corte lateral)",
              "force_original_aspect_ratio=decrease" in sem_thumb
              and "force_original_aspect_ratio=increase" not in sem_thumb)
        check("20m. sem legenda pedida o filtro continua sem ass=", "ass=" not in sem_thumb)
        check("20n. e com legenda o ass= entra no fim da cadeia nova (antes das tags)",
              (",ass=x.ass:fontsdir=.," + worker.COR_TAGS)
              in worker.build_filter("blur", "x.ass"))
        check("20i. o vídeo continua entrando por scale=decrease (proporção preservada)",
              "force_original_aspect_ratio=decrease"
              in worker.build_filter("blur", None, "t.webp"))

        # ---------------------------------------- 21: revisão da legenda antes do render
        def caps(corpo):
            resposta = pedir(base + serve.ROUTE_CAPS,
                             data=json.dumps(corpo).encode("utf-8"),
                             headers={"Content-Type": "application/json"})
            return resposta.status, (json.loads(resposta.body) if resposta.body else {})

        sidecar_thumb("fonte.webp")
        status, lido = caps({"token": "tok_rev", "name": "fonte.mp4", "start": 30, "end": 50})
        check("21. a rota devolve o que o YouTube detectou naquele trecho",
              status == 200 and lido["state"] == "ok" and len(lido["cues"]) == 3)
        check("21b. com o relógio do CORTE, não o do vídeo", lido["cues"][0]["start"] == 0.0)
        check("21c. e diz idioma e origem da faixa",
              lido["language"] == "pt-BR" and lido["kind"] == "manual")
        vazio = caps({"token": "tok_rev", "name": "fonte.mp4", "start": 0, "end": 5})[1]
        check("21d. trecho sem fala dentro é dito, não fingido",
              vazio["state"] == "CAPTIONS_OUT_OF_RANGE" and vazio["cues"] == [])
        antigo_cap = caps({"token": "tok_rev", "name": "antigo.mp4", "start": 30, "end": 50})[1]
        check("21e. sidecar sem legenda devolve o motivo, e a tela tem o que dizer",
              antigo_cap["state"] == "CAPTIONS_NOT_AVAILABLE")
        # A correção do operador.
        CORRIGIDA = [{"start": 0.0, "end": 2.0, "text": "Finalmente saiu o escritorio, cara"},
                     {"start": 2.0, "end": 4.0, "text": "e a gente comecou a faturar"}]
        salvo_caps = caps({"token": "tok_rev", "name": "fonte.mp4", "start": 30, "end": 50,
                           "cues": CORRIGIDA})[1]
        check("21f. gravar a correção devolve o que ficou valendo",
              salvo_caps["state"] == "edited" and len(salvo_caps["cues"]) == 2)
        relido = caps({"token": "tok_rev", "name": "fonte.mp4", "start": 30, "end": 50})[1]
        check("21g. reabrir a revisão mostra o texto CORRIGIDO, não o do YouTube",
              relido["state"] == "edited"
              and relido["cues"][0]["text"] == CORRIGIDA[0]["text"])
        outro = caps({"token": "tok_rev", "name": "fonte.mp4", "start": 31, "end": 50})[1]
        check("21h. a correção NÃO vaza para outro trecho da mesma sessão",
              outro["state"] == "ok")
        check("21i. e o sidecar em disco continua com o texto original do YouTube",
              json.loads(open(os.path.join(sidecars, "fonte.mostreplayed.json"),
                              encoding="utf-8").read())["captions"]["cues"][0]["text"]
              == FALAS[0]["text"])
        doc_corrigido = serve.cut_captions("fonte.mp4", 30.0, 50.0, 608,
                                           serve.clean_edit_cues(CORRIGIDA))[0]
        # O texto sai quebrado em linhas de 25 caracteres (\N), entao a prova e por pedaco.
        check("21j. o ASS do render usa o texto corrigido",
              "escritorio, cara" in doc_corrigido
              and FALAS[0]["text"] not in doc_corrigido)
        check("21k. token inválido é recusado",
              caps({"token": "../x", "name": "fonte.mp4", "start": 0, "end": 5})[0] == 400)
        check("21l. intervalo invertido é recusado",
              caps({"token": "tok_rev", "name": "fonte.mp4", "start": 9, "end": 9})[0] == 400)
        check("21m. lista com fala demais é recusada",
              caps({"token": "tok_rev", "name": "fonte.mp4", "start": 0, "end": 5,
                    "cues": [{"start": 0, "end": 1, "text": "x"}] * (serve.MAX_EDIT_CUES + 1)}
                   )[0] == 400)
        # Fronteira de confiança: o que o navegador manda passa por clean_edit_cues.
        sujo = serve.clean_edit_cues([
            {"start": 0, "end": 3, "text": "vale"},
            {"start": 2, "end": 5, "text": "sobrepoe a de cima"},
            {"start": 9, "end": 10, "text": "   "},          # texto apagado = fala removida
            {"start": "x", "end": 2, "text": "tempo torto"},
            {"start": 6, "end": 5, "text": "fim antes do inicio"},
            "nem e dicionario",
            {"start": 7, "end": 8, "text": "a" * 5000}])
        check("21n. o lixo do corpo é descartado e a sobreposição some",
              [c["text"] for c in sujo] == ["vale", "sobrepoe a de cima", "a" * 300]
              and sujo[0]["end"] == 2)
        check("21o. e o texto é limitado no tamanho",
              all(len(c["text"]) <= serve.MAX_EDIT_CHARS for c in sujo))
        check("21p. chaves diferentes para trechos diferentes",
              serve.edit_key("t", 0, 5) != serve.edit_key("t", 0, 6))
        # Apagar o texto de TODAS as falas é o gesto de "não quero legenda neste clip".
        # Antes, a lista vazia caía no ramo do sidecar e o corte saía queimando de volta
        # exatamente o texto apagado — com a tela dizendo "com o texto que você corrigiu".
        vazia = serve.cut_captions("fonte.mp4", 30.0, 50.0, 608, [])
        check("21q. correção esvaziada NÃO volta a queimar o texto do YouTube", vazia[0] == "")
        check("21r. e o motivo é próprio, não 'nenhuma fala neste trecho'",
              vazia[1] == serve.CAPTIONS_EDITED_EMPTY
              and vazia[1] != serve.CAPTIONS_OUT_OF_RANGE)
        check("21s. o estado que SAI no cabeçalho está no conjunto fechado",
              serve.CAPTIONS_EDITED_EMPTY in serve.CAPTION_STATES)
        # TOO_MANY é resposta da rota de revisão, não desfecho de render: se entrasse no
        # conjunto, um sidecar torto com esse `reason` sairia no cabeçalho sem frase do outro
        # lado — o erro mudo que o conjunto existe para impedir.
        check("21s2. e o da revisão NÃO pode sair no cabeçalho",
              serve.CAPTIONS_TOO_MANY not in serve.CAPTION_STATES)
        # Trecho com fala demais: recusar a revisão é melhor que mostrar as 400 primeiras
        # como se fossem todas — corrigir uma palavra deixaria o resto do clipe MUDO.
        grava_sidecar("comprido.mp4", {
            "version": 3, "duration": 4000.0, "mostReplayed": MR_OK,
            "captions": {"available": True, "language": "pt", "kind": "automatica",
                         "reason": "", "cues": [
                             {"start": i * 2.0, "end": i * 2.0 + 1.5, "text": "fala %d" % i}
                             for i in range(serve.MAX_EDIT_CUES + 50)]}})
        demais = caps({"token": "tok_rev", "name": "comprido.mp4", "start": 0, "end": 3000})[1]
        # Invariante entre as duas linguagens: TODO estado que pode sair no cabeçalho
        # X-Clip-Captions precisa ter frase no CAPTIONS_MSG do video-ops.js, e todo estado da
        # rota de revisão precisa de frase no CAP_MSG. Ler o JS aqui é o que faz um estado
        # novo FALHAR em vez de sair calado na tela (mesma ideia do test_captions.py lendo o
        # preset.js). Esta prova pegou o CAPTIONS_EDITED_EMPTY sem frase.
        js_ops = open(os.path.join(worker.REPO, "video-ops.js"), encoding="utf-8").read()
        faltando_header = [e for e in serve.CAPTION_STATES + ("burned", "burned-sem-inter")
                           if ("%s:" % e) not in js_ops and ("'%s'" % e) not in js_ops]
        check("21t0. todo estado do cabeçalho tem frase no video-ops.js: %s"
              % (faltando_header or "nenhum faltando"), not faltando_header)
        faltando_revisao = [e for e in (serve.CAPTIONS_TOO_MANY, "ok", "edited", "loading")
                            if ("%s:" % e) not in js_ops and ("'%s'" % e) not in js_ops]
        check("21t1. e todo estado da revisão também: %s"
              % (faltando_revisao or "nenhum faltando"), not faltando_revisao)
        check("21t. trecho com fala demais recusa a revisão e diz por quê",
              demais["state"] == serve.CAPTIONS_TOO_MANY and demais["cues"] == []
              and demais["count"] > serve.MAX_EDIT_CUES)

        # -------------------------------------------------------- 7-10: corte de verdade
        if not os.path.exists(worker.FFMPEG):
            print("\nPULADO: FFmpeg do projeto não encontrado em %s" % worker.FFMPEG)
            print("        As provas 7 a 10 e 13 exigem o binário; as demais rodaram.")
        else:
            fonte = make_source(os.path.join(trabalho, "fonte.mp4"), 8, 1280, 720, audio=True)
            with open(fonte, "rb") as handle:
                bytes_fonte = handle.read()

            vertical = post_cut(base, "tok_quente", 0, 3, "blur", "corte-9x16", bytes_fonte)
            check("7. corte 9:16 volta 200", vertical.status == 200)
            check("7b. o tipo é video/mp4", vertical.headers.get("Content-Type") == "video/mp4")
            check("7c. o corpo tem bytes de vídeo", len(vertical.body) > 1000)
            check("7d. o navegador recebe o nome do arquivo",
                  "corte-9x16.mp4" in (vertical.headers.get("Content-Disposition") or ""))
            check("7e. o cabeçalho de cache da fonte é o do contrato",
                  vertical.headers.get("X-Video-Source-Cached") == "1")
            # Conferência técnica do que voltou: é o que TikTok/Instagram aceitam?
            baixado = os.path.join(trabalho, "baixado-9x16.mp4")
            with open(baixado, "wb") as handle:
                handle.write(vertical.body)
            medido = worker.probe(baixado)
            check("7f. a saída é 1080x1920", medido["width"] == 1080 and medido["height"] == 1920)
            check("7g. a saída é H.264 + AAC",
                  medido["videoCodec"] == "h264" and medido["audioCodec"] == "aac")
            check("7h. a duração é a do corte",
                  medido["durationSec"] is not None
                  and abs(medido["durationSec"] - 3.0) <= worker.TOLERANCE_SEC)

            # ------------------------------------- 18: legenda QUEIMADA de verdade no 9:16
            # `fonte.mp4` tem sidecar com falas em 25-55s; o vídeo sintético tem 8s, então
            # o corte 0-3 fica FORA da faixa e o 9:16 sai sem legenda — com o motivo dito.
            fora = post_cut(base, "tok_semleg", 0, 3, "blur", "sem-legenda", bytes_fonte)
            check("18. corte sem fala dentro volta 200 assim mesmo", fora.status == 200)
            check("18b. e o cabeçalho diz POR QUE não legendou",
                  fora.headers.get("X-Clip-Captions") == "CAPTIONS_OUT_OF_RANGE")

            # Agora um sidecar cujas falas caem dentro de 0-3s: a legenda TEM de entrar.
            grava_sidecar("fonte.mp4", {
                "version": 2, "videoId": "abcdefghijk", "duration": 8.0,
                "mostReplayed": MR_OK,
                "captions": {"available": True, "language": "pt-BR", "kind": "manual",
                             "reason": "", "cues": [
                                 {"start": 0.2, "end": 1.4, "text": "Faturamento nao e lucro"},
                                 {"start": 1.6, "end": 2.8, "text": "e quem confunde quebra"}]}})
            com = post_cut(base, "tok_comleg", 0, 3, "blur", "com-legenda", bytes_fonte)
            check("18c. corte COM legenda volta 200", com.status == 200)
            check("18d. e o cabeçalho confirma que a legenda entrou",
                  com.headers.get("X-Clip-Captions") in ("burned", "burned-sem-inter"))
            check("18d2. e diz a verdade sobre a fonte usada",
                  (com.headers.get("X-Clip-Captions") == "burned")
                  == captions_mod.font_available())
            legendado = os.path.join(trabalho, "baixado-legendado.mp4")
            with open(legendado, "wb") as handle:
                handle.write(com.body)
            medido_leg = worker.probe(legendado)
            check("18e. continua 1080x1920 (a legenda não mexeu no enquadramento)",
                  medido_leg["width"] == 1080 and medido_leg["height"] == 1920)
            check("18f. continua H.264 + AAC", medido_leg["videoCodec"] == "h264"
                  and medido_leg["audioCodec"] == "aac")
            check("18g. e a duração continua a do corte",
                  medido_leg["durationSec"] is not None
                  and abs(medido_leg["durationSec"] - 3.0) <= worker.TOLERANCE_SEC)
            # 18h-18j: o AUDIO, numa resposta REAL. Os checks do bloco 28 provam a funcao e o
            # conjunto fechado; este prova que a rota EMITE o cabecalho e que o arquivo
            # entregue passou pelo passe -- a diferenca entre "sabe fazer" e "faz".
            check("18k. o download traz X-Clip-Audio, e do conjunto fechado",
                  com.headers.get("X-Clip-Audio") in worker.AUDIO_STATES)
            check("18l. e com faixa de audio o estado e `normalizado`",
                  com.headers.get("X-Clip-Audio") == worker.AUDIO_OK)
            # 18n: o sidecar DESTE corte foi reescrito sem a chave `thumbnail` (a linha acima),
            # entao ele e o caso normal -- MP4 local, trecho baixado antes da entrega da
            # miniatura. Tem de sair DISTINTO do ilegivel do corte 7, e nao num erro generico.
            check("18n. sem miniatura no sidecar o cabeçalho diz NONE, não erro genérico",
                  com.headers.get("X-Clip-Background") == serve.BACKGROUND_NONE
                  and com.headers.get("X-Clip-Background")
                  != vertical.headers.get("X-Clip-Background"))
            # E o passe nao pode ter custado uma segunda geracao de VIDEO: `-c:v copy`.
            check("18m. o video continua h264 depois do passe (o audio nao reencodou imagem)",
                  medido_leg["videoCodec"] == "h264"
                  and medido_leg["width"] == 1080 and medido_leg["height"] == 1920)
            # Prova de que o filtro REALMENTE desenhou algo: os bytes não podem bater com
            # o mesmo corte sem legenda. Sem isto, um `ass=` ignorado passaria despercebido.
            check("18h. o arquivo legendado difere do mesmo corte sem legenda",
                  com.body != fora.body)
            check("18i. o .ass temporário não sobra no disco",
                  not any(f.endswith(".ass") for f in os.listdir(temporario)))

            # O horizontal NÃO ganha legenda: o pedido é explícito.
            deitado = post_cut(base, "tok_h_leg", 0, 3, "horizontal", "sem-queimar",
                               bytes_fonte)
            check("18j. o horizontal continua saindo 200", deitado.status == 200)
            check("18k. e nem chega a olhar legenda (sem cabeçalho)",
                  deitado.headers.get("X-Clip-Captions") is None)
            # E nem fundo: o horizontal nao tem tarja e nao tem miniatura para preencher, entao
            # emitir estado ali seria INVENTAR. Ausencia = "esta rota nao tem o que dizer" --
            # a mesma regra do X-Clip-Captions, e o oposto do X-Clip-Audio, que sai sempre
            # (as duas rotas normalizam). O check confere os dois lados de proposito: um
            # `send_header` incondicional passaria em qualquer prova que olhasse so o 9:16.
            check("18p. e nem fundo: o horizontal não emite X-Clip-Background",
                  deitado.headers.get("X-Clip-Background") is None
                  and deitado.headers.get("X-Clip-Audio") in worker.AUDIO_STATES)

            # ------------------------------- 22: miniatura de VERDADE vira o fundo do 9:16
            # A `fonte.webp` escrita lá em cima é lixo de propósito (miniatura truncada).
            # O corte 7 passou mesmo assim — é o que prova que fundo ilegível não derruba
            # render. Agora uma imagem que abre: o MP4 tem de MUDAR.
            check("22. miniatura ilegível não impede o corte (o 7 acima saiu 200)",
                  vertical.status == 200 and not serve.background_ok(
                      os.path.join(sidecars, "fonte.webp")))
            # O par que importa: o corte 7 rodou com a `fonte.webp` truncada apontada no
            # sidecar, entao ele prova de uma vez que o desfecho ILEGIVEL sai no cabecalho E
            # continua entregando 200 com letterbox. Corrigir o mudo nao pode transformar
            # este caso em falha -- o fundo e enfeite, o corte e o produto.
            check("22j. e o cabeçalho DIZ que a miniatura chegou quebrada",
                  vertical.headers.get("X-Clip-Background") == serve.BACKGROUND_UNREADABLE
                  and vertical.status == 200 and len(vertical.body) > 1000)
            worker.run_ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                               "-i", "smptebars=size=1280x720", "-frames:v", "1",
                               os.path.join(sidecars, "fonte.jpg")])
            sidecar_thumb("fonte.jpg")
            check("22b. e a imagem que abre é aceita como fundo",
                  serve.background_ok(os.path.join(sidecars, "fonte.jpg")))
            com_thumb = post_cut(base, "tok_thumb", 0, 3, "blur", "com-miniatura",
                                 bytes_fonte)
            check("22c. o corte com miniatura volta 200", com_thumb.status == 200)
            check("22k. e o cabeçalho confirma que a miniatura VIROU o fundo",
                  com_thumb.headers.get("X-Clip-Background") == serve.BACKGROUND_OK)
            thumbado = os.path.join(trabalho, "baixado-miniatura.mp4")
            with open(thumbado, "wb") as handle:
                handle.write(com_thumb.body)
            medido_thumb = worker.probe(thumbado)
            check("22d. continua 1080x1920", medido_thumb["width"] == 1080
                  and medido_thumb["height"] == 1920)
            check("22e. e a duração continua a do corte",
                  medido_thumb["durationSec"] is not None
                  and abs(medido_thumb["durationSec"] - 3.0) <= worker.TOLERANCE_SEC)
            check("22f. o fundo REALMENTE mudou (não é o mesmo arquivo do desfoque)",
                  com_thumb.body != com.body)
            # A fonte é 30 fps: o fundo por imagem não pode reamostrar o vídeo.
            check("22g. o vídeo não perdeu quadros para a imagem (fps preservado)",
                  medido_thumb["fps"] == worker.probe(fonte)["fps"])
            # O crop preenche o quadro sozinho: a miniatura não entra nem como -i pendurado.
            # Mesmo token do 22c: a fonte já está em cache, então este corte não reenvia bytes.
            recorte_cheio = post_cut(base, "tok_thumb", 0, 3, "crop", "crop-miniatura")
            check("22h. o crop com miniatura no sidecar continua saindo 200",
                  recorte_cheio.status == 200)
            cropado = os.path.join(trabalho, "baixado-crop-thumb.mp4")
            with open(cropado, "wb") as handle:
                handle.write(recorte_cheio.body)
            check("22i. e continua 1080x1920 com uma faixa de vídeo só",
                  worker.probe(cropado)["width"] == 1080
                  and worker.probe(cropado)["height"] == 1920)

            # --------- 23: a correção do operador chega ao MP4 (o caminho inteiro, HTTP)
            # Sidecar com falas DENTRO de 0-3s e com miniatura: é o cenário real do pedido.
            grava_sidecar("fonte.mp4", {
                "version": 3, "videoId": "abcdefghijk", "duration": 8.0,
                "mostReplayed": MR_OK, "thumbnail": "fonte.jpg",
                "captions": {"available": True, "language": "pt-BR", "kind": "automatica",
                             "reason": "", "cues": [
                                 {"start": 0.2, "end": 1.4, "text": "Finalmente saiu o [ __ ]"},
                                 {"start": 1.3, "end": 2.8, "text": "e a gente comecou"}]}})
            # A cue 0.2-1.4 continua no ar quando a 1.3 comeca: é a legenda rolante do
            # YouTube, o defeito que o operador viu no vídeo.
            revisao = caps({"token": "tok_edit", "name": "fonte.mp4", "start": 0, "end": 3})[1]
            check("23. a revisão mostra as duas falas do trecho",
                  revisao["state"] == "ok" and len(revisao["cues"]) == 2)
            check("23b. já sem sobreposição (a anterior fecha onde a seguinte começa)",
                  revisao["cues"][0]["end"] <= revisao["cues"][1]["start"])
            sem_correcao = post_cut(base, "tok_edit", 0, 3, "blur", "antes-da-correcao",
                                    bytes_fonte)
            check("23c. o corte sem correção sai legendado", sem_correcao.status == 200
                  and (sem_correcao.headers.get("X-Clip-Captions") or "").startswith("burned"))
            gravado = caps({"token": "tok_edit", "name": "fonte.mp4", "start": 0, "end": 3,
                            "cues": [{"start": 0.2, "end": 1.4, "text": "Finalmente saiu o escritorio"},
                                     {"start": 1.5, "end": 2.8, "text": "e a gente comecou a faturar"}]})[1]
            check("23d. a correção é aceita", gravado["state"] == "edited")
            com_correcao = post_cut(base, "tok_edit", 0, 3, "blur", "depois-da-correcao")
            check("23e. o corte com correção também sai legendado",
                  com_correcao.status == 200
                  and (com_correcao.headers.get("X-Clip-Captions") or "").startswith("burned"))
            # Os pixels da legenda mudaram: é o que prova que o texto do operador foi
            # QUEIMADO, e não apenas guardado num dicionário do servidor.
            check("23f. e o MP4 é diferente do que foi gerado antes da correção",
                  com_correcao.body != sem_correcao.body)
            outra_sessao = post_cut(base, "tok_quente", 0, 3, "blur", "sem-heranca")
            check("23g. a correção não vaza para outra sessão/token",
                  outra_sessao.status == 200)
            # A correção é de UM render. Guardada, ela sobreviveria ao "Restaurar texto do
            # YouTube" e ao corte apagado e remarcado no mesmo intervalo — e o download
            # seguinte queimaria, calado, um texto que ninguém mais quer.
            depois_do_uso = caps({"token": "tok_edit", "name": "fonte.mp4",
                                  "start": 0, "end": 3})[1]
            check("23h. a correção sai da prateleira ao ser usada",
                  depois_do_uso["state"] == "ok")
            de_novo = post_cut(base, "tok_edit", 0, 3, "blur", "sem-a-correcao-antiga")
            check("23i. e o download seguinte volta ao texto do YouTube, não ao antigo",
                  de_novo.status == 200 and de_novo.body != com_correcao.body)

            # --------- 24: dois downloads ao mesmo tempo NA MESMA sessão
            # O .ass era nomeado só pelo token, que é da SESSÃO (um por vídeo aberto): dois
            # cortes simultâneos escreviam no MESMO arquivo. Medido antes da correção: o
            # clipe A saiu 200/"burned" com a LEGENDA DO CLIPE B, e o B morreu com 500 porque
            # o `finally` do A apagou o arquivo debaixo dele.
            grava_sidecar("fonte.mp4", {
                "version": 3, "videoId": "abcdefghijk", "duration": 8.0,
                "mostReplayed": MR_OK,
                "captions": {"available": True, "language": "pt-BR", "kind": "manual",
                             "reason": "", "cues": [
                                 {"start": 0.3, "end": 1.2, "text": "fala do comeco"},
                                 {"start": 4.3, "end": 5.2, "text": "fala do fim"}]}})
            respostas = {}

            def baixa(rotulo, inicio, fim):
                respostas[rotulo] = post_cut(base, "tok_quente", inicio, fim, "blur",
                                             "simultaneo-" + rotulo)

            fios = [threading.Thread(target=baixa, args=("a", 0, 2)),
                    threading.Thread(target=baixa, args=("b", 4, 6))]
            for fio in fios:
                fio.start()
            for fio in fios:
                fio.join(600)
            check("24. os dois cortes simultâneos saem 200 (nenhum morre pelo outro)",
                  respostas["a"].status == 200 and respostas["b"].status == 200)
            check("24b. os dois saem legendados",
                  (respostas["a"].headers.get("X-Clip-Captions") or "").startswith("burned")
                  and (respostas["b"].headers.get("X-Clip-Captions") or "").startswith("burned"))
            check("24c. e cada um com a legenda DELE (arquivos diferentes)",
                  respostas["a"].body != respostas["b"].body)
            # A faxina do .ass acontece no `finally` do servidor, DEPOIS de o corpo da
            # resposta sair — o cliente pode terminar de ler antes disso. Sem esta janela a
            # prova acusava sobra que ia embora milissegundos depois (flaky visto rodando).
            for _ in range(25):
                sobrou_ass = [f for f in os.listdir(temporario) if f.endswith(".ass")]
                if not sobrou_ass:
                    break
                time.sleep(0.2)
            check("24d. nenhum .ass sobrou no temporário (achados: %s)"
                  % (sobrou_ass or "nenhum"), not sobrou_ass)

            # --------- 29: a vez no renderizador tem PRAZO
            # O `with self.render_lock` era bloqueante e sem prazo: com o teto proporcional
            # um clipe de 600 s segura o lock por ~4 h, e um `⬇ Baixar vídeo` ficava pendurado
            # sem nada na tela dizer por quê. As provas são comportamentais — o servidor de
            # verdade responde com o lock na mão de outro.
            check("29a. render_busy é código declarado e vale 503",
                  "render_busy" in worker.ERROR_CODES
                  and serve.STATUS_BY_CODE["render_busy"] == 503)
            check("29a2. e NÃO reusa o 409, que já manda o navegador reenviar o arquivo",
                  serve.STATUS_BY_CODE["render_busy"]
                  != serve.STATUS_BY_CODE["input_missing"])

            handler = servidor.RequestHandlerClass.func
            handler.render_lock_wait = 0.3
            ocupado = {}

            def baixa_ocupado():
                ocupado["r"] = post_cut(base, "tok_quente", 0, 2, "blur", "na-fila")

            handler.render_lock.acquire()
            try:
                fio_fila = threading.Thread(target=baixa_ocupado)
                comeco = time.time()
                fio_fila.start()
                # join com prazo: se a espera voltar a ser infinita a prova REPROVA em 30 s
                # em vez de pendurar a suíte inteira, que é o próprio defeito sob teste.
                fio_fila.join(30)
                decorrido = time.time() - comeco
            finally:
                handler.render_lock.release()
                handler.render_lock_wait = serve.RENDER_LOCK_WAIT

            check("29b. com o renderizador ocupado a requisição VOLTA (não pendura)",
                  not fio_fila.is_alive() and "r" in ocupado)
            check("29c. e volta 503 com o código render_busy, não um erro genérico",
                  ocupado.get("r") is not None and ocupado["r"].status == 503
                  and ocupado["r"].codigo_erro == "render_busy")
            check("29d. a mensagem diz o que está acontecendo, em português",
                  ocupado.get("r") is not None
                  and "ocupado" in (ocupado["r"].erro or "").lower())
            check("29e. esperou a vez antes de desistir (%.2fs), sem recusar na hora"
                  % decorrido, decorrido >= 0.3)
            # A recusa não pode VAZAR o lock: quem desiste nunca o teve, e soltá-lo por
            # engano liberaria o corte de outra thread no meio do FFmpeg.
            depois = post_cut(base, "tok_quente", 0, 2, "blur", "depois-da-fila")
            check("29f. solto o lock, o download seguinte passa (a recusa não vazou o lock)",
                  depois.status == 200 and len(depois.body) > 0)

            # Exceção DENTRO da vez tem de soltar o lock, senão um FFmpeg que falha trava
            # todo render futuro — falha permanente, pior que a espera longa.
            class _Fila(object):
                render_lock = threading.Lock()
                render_lock_wait = 0.05
                _render_slot = serve.CutHandler._render_slot

            fila = _Fila()
            try:
                with fila._render_slot():
                    raise RuntimeError("o render explodiu")
            except RuntimeError:
                pass
            check("29g. exceção dentro da vez solta o lock (nada trava para sempre)",
                  fila.render_lock.acquire(timeout=0.5))
            fila.render_lock.release()
            fila.render_lock.acquire()
            try:
                erro_fila = None
                try:
                    with fila._render_slot():
                        pass
                except worker.WorkerError as err:
                    erro_fila = err
            finally:
                fila.render_lock.release()
            check("29h. e a vez que não chega levanta WorkerError('render_busy')",
                  erro_fila is not None and erro_fila.code == "render_busy")
            # Guarda de regressão: reverter QUALQUER dos quatro pontos para o `with` cru
            # devolve a espera sem prazo calada, e os checks acima só passam pelo video-cut.
            # Os quatro: /api/video-cut, /api/yt-fetch, /api/remotion-render e o
            # `_cut_for_render` (o recorte da fonte importada que alimenta o Remotion, que é
            # FFmpeg de verdade e por isso entra na mesma fila). A IMPORTAÇÃO em si não conta
            # de propósito — ela não recodifica nada, e segurar a fila por vinte minutos de
            # download deixaria o operador sem poder exportar durante todo esse tempo.
            fonte_fila = open(os.path.join(worker.REPO, "video-worker", "serve.py"),
                              encoding="utf-8").read()
            check("29i. nenhuma rota voltou ao `with self.render_lock` cru",
                  "with self.render_lock" not in fonte_fila
                  and fonte_fila.count("with self._render_slot():") == 4)

            # 16: o corte PRONTO fica no computador e é servido de volta. É o que faz a
            # revisão abrir com o vídeo na tela depois de fechar o site — antes o MP4 só
            # existia dentro do temporário, que morre com o servidor.
            salvo = urllib.parse.unquote(vertical.headers.get("X-Clip-Path") or "")
            check("16. a resposta diz onde o corte ficou", bool(salvo))
            check("16b. o arquivo está na pasta de cortes, com o nome à vista",
                  salvo == os.path.join(cortes, "corte-9x16.mp4") and os.path.isfile(salvo))
            servido = pedir(base + "/clips/corte-9x16.mp4")
            check("16c. /clips/ serve o corte de volta",
                  servido.status == 200 and len(servido.body) == len(vertical.body))
            fuga = pedir(base + "/clips/..%2f..%2findex.html")
            check("16d. /clips/../ não escapa da pasta de cortes",
                  fuga.status == 404 and b"<h1>site</h1>" not in fuga.body)

            # 16e-16g: servidor de DESENVOLVIMENTO não deixa o navegador guardar nada. Sem
            # `Cache-Control` o SimpleHTTPRequestHandler manda só `Last-Modified`, e o Chrome
            # aplica cache heurístico — serve JS antigo sem perguntar. Custou uma sessão
            # inteira em 2026-09-01: o conserto no disco, o servidor entregando o arquivo
            # novo, e a tela executando o velho.
            estatico = pedir(base + "/index.html")
            check("16e. estático sai com Cache-Control: no-store",
                  estatico.status == 200
                  and "no-store" in (estatico.headers.get("Cache-Control") or ""))
            check("16f. o corte servido em /clips/ também",
                  "no-store" in (servido.headers.get("Cache-Control") or ""))
            # O 404 passa por send_error, que é outro caminho de resposta: se o cabeçalho
            # morasse no send_head em vez do end_headers, este check reprovaria.
            check("16g. e até a recusa — o cabeçalho mora no end_headers, ponto único",
                  "no-store" in (fuga.headers.get("Cache-Control") or ""))

            # 8: segundo download sem reenviar os bytes.
            reuso = post_cut(base, "tok_quente", 3, 6, "crop", "corte-crop")
            check("8. segundo corte reaproveita a fonte do token", reuso.status == 200)
            check("8b. o segundo corte também volta vídeo", len(reuso.body) > 1000)

            # 9: horizontal mantém o enquadramento.
            horizontal = post_cut(base, "tok_quente", 0, 2, "horizontal", "corte-16x9")
            check("9. corte horizontal volta 200", horizontal.status == 200)
            deitado = os.path.join(trabalho, "baixado-16x9.mp4")
            with open(deitado, "wb") as handle:
                handle.write(horizontal.body)
            medido_h = worker.probe(deitado)
            check("9b. o horizontal NÃO virou 9:16",
                  medido_h["height"] == 1080 and medido_h["width"] > medido_h["height"])

            # 10: corte além do fim do vídeo é recusado, e nada é produzido.
            longe = post_cut(base, "tok_quente", 0, 50, "blur", "impossivel")
            check("10. corte além do fim do vídeo é recusado", longe.status == 400)
            check("10b. o motivo é o intervalo", longe.codigo_erro == "cut_invalid")

            # 13: o MP4 pronto não fica pendurado, e o site não foi tocado.
            check("13. o corte entregue não fica ocupando o temporário",
                  not [n for n in os.listdir(temporario) if n.endswith(".mp4")])
            check("13b. nenhum .part sobrou (escrita atômica)",
                  not [n for n in os.listdir(temporario) if n.endswith(".part")])
            check("13c. a fonte em cache continua lá (é o que evita reenviar)",
                  any(n.endswith(".src") for n in os.listdir(temporario)))

        # -------------------------------------------------------- 15: disco cheio
        # A rota grava o original inteiro no temporário. Se isso acontecer antes de conferir
        # espaço, um original de vários GB enche o disco do operador para só então falhar —
        # era o que ocorria (o .src ficava lá, 507 nunca chegava). Não precisa de FFmpeg:
        # com espaço zero a recusa tem de vir ANTES de qualquer byte ir para o disco.
        livre_real = worker.shutil.disk_usage
        # _replace na tupla que a função de verdade devolve: mesmo tipo, só o campo `free`
        # zerado. Não inventa objeto de mentira nem precisa de import novo.
        sem_espaco = livre_real(temporario)._replace(free=0)
        worker.shutil.disk_usage = lambda path: sem_espaco
        try:
            cheio = post_cut(base, "tok_sem_disco", 0, 3, "blur", "corte.mp4",
                             b"x" * (2 * 1024 * 1024))
        finally:
            worker.shutil.disk_usage = livre_real
        check("15. disco sem espaço recusa o upload com 507", cheio.status == 507)
        check("15b. o motivo é o espaço, não o formato do arquivo",
              cheio.codigo_erro == "no_space")
        check("15c. nenhum byte do original foi para o disco",
              not os.path.isfile(os.path.join(temporario, "tok_sem_disco.src")))

        check("13d. nada foi escrito na pasta do site", sorted(os.listdir(site)) == antes_do_site)
        check("13e. o temporário está fora da pasta do projeto",
              not os.path.realpath(temporario).startswith(
                  os.path.realpath(worker.REPO) + os.sep))

        # ---------------------------------------- 31: a FONTE importada (vídeo inteiro)
        # A mudança de arquitetura de 2026-09-15: o Estúdio importa o vídeo INTEIRO e todo
        # corte sai dele. Nada aqui baixa nada — o que se prova é o contrato das rotas novas
        # e o Range, que é o que permite arrastar a barra num arquivo de 2 GB.
        estado_torto = pedir(base + serve.ROUTE_IMPORT_STATE,
                             data=json.dumps({"videoId": "../etc"}).encode(),
                             headers={"Content-Type": "application/json"})
        check("31a. /api/yt-import-state recusa id que não é de vídeo do YouTube",
              estado_torto.status == 400 and estado_torto.codigo_erro == "job_invalid")
        # Nada no disco = `idle`, e o videoId VOLTA: é por ele que o navegador descarta
        # resposta de um vídeo que já não é o pedido (a corrida da URL trocada no meio).
        vazio = pedir(base + serve.ROUTE_IMPORT_STATE,
                      data=json.dumps({"videoId": "zzzzzzzzzzz"}).encode(),
                      headers={"Content-Type": "application/json"})
        corpo_vazio = json.loads(vazio.body.decode("utf-8"))
        check("31b. sem fonte no disco o estado é `idle`, e diz de que vídeo fala",
              vazio.status == 200 and corpo_vazio["state"] == serve.IMPORT_IDLE
              and corpo_vazio["videoId"] == "zzzzzzzzzzz" and corpo_vazio["sourceToken"] == "")
        # Fonte PRONTA no disco: a rota de estado a redescobre, registra no cache e devolve o
        # token — sem rede. É o ramo que faz o projeto reaberto amanhã não rebaixar 2 GB.
        fonte_mp4 = make_source(os.path.join(sidecars, "abcdefghijk.mp4"), 2, 320, 180)
        serve.write_source_sidecar(sidecars, "abcdefghijk.mp4", {
            "videoId": "abcdefghijk", "url": "https://www.youtube.com/watch?v=abcdefghijk",
            "durationSec": 2.0, "heatmap": [], "cues": FALAS, "words": [],
            "captionLang": "pt-BR", "captionKind": "manual", "note": ""})
        achada = pedir(base + serve.ROUTE_IMPORT_STATE,
                       data=json.dumps({"videoId": "abcdefghijk"}).encode(),
                       headers={"Content-Type": "application/json"})
        pronta = json.loads(achada.body.decode("utf-8"))
        check("31c. fonte já no disco volta PRONTA, com token, endereço e dimensões",
              pronta["state"] == serve.IMPORT_READY
              and pronta["sourceToken"] == "abcdefghijk"
              and pronta["sourceUrl"] == serve.SOURCES_URL + "abcdefghijk.mp4"
              and pronta["width"] == 320 and pronta["height"] == 180
              and pronta["hasAudio"] is True and pronta["percent"] == 100)
        # O token é o id do vídeo, e ele TEM de passar no validador da query do /api/video-cut
        # — se não passasse, o primeiro corte da fonte importada morreria em 400.
        check("31d. o token da fonte passa no TOKEN_RE que o /api/video-cut exige",
              bool(serve.TOKEN_RE.match(pronta["sourceToken"])))
        # E o corte SAI da fonte registrada, sem corpo nenhum na requisição: é isso que
        # significa "não baixa nem sobe o original de novo".
        corte_da_fonte = post_cut(base, "abcdefghijk", 0.2, 1.2, "horizontal",
                                  "da-fonte.mp4")
        check("31e. o /api/video-cut corta a fonte importada sem reenviar um byte dela",
              corte_da_fonte.status == 200 and len(corte_da_fonte.body) > 1000)
        # DOIS cortes seguidos, intervalos diferentes, zero upload: o critério de aceitação.
        outro_corte = post_cut(base, "abcdefghijk", 1.0, 2.0, "horizontal", "outro.mp4")
        check("31f. e um SEGUNDO corte de outro intervalo sai da mesma fonte",
              outro_corte.status == 200 and len(outro_corte.body) > 1000)

        # ---- Range: sem 206 não existe "navegar pela duração inteira" ------------------
        inteiro = pedir(base + serve.SOURCES_URL + "abcdefghijk.mp4")
        tamanho_fonte = os.path.getsize(fonte_mp4)
        check("31g. /sources/ serve a fonte ao player do site",
              inteiro.status == 200 and len(inteiro.body) == tamanho_fonte)
        check("31h. e ANUNCIA Range — sem isso o Chrome nem tenta arrastar a barra",
              inteiro.headers.get("Accept-Ranges") == "bytes")
        fatia = pedir(base + serve.SOURCES_URL + "abcdefghijk.mp4",
                      headers={"Range": "bytes=10-19"})
        with open(fonte_mp4, "rb") as fh:
            esperado = fh.read()[10:20]
        check("31i. Range devolve 206 com EXATAMENTE os bytes pedidos",
              fatia.status == 206 and fatia.body == esperado
              and fatia.headers.get("Content-Range")
              == "bytes 10-19/%d" % tamanho_fonte)
        # `bytes=-N` é como o navegador lê o índice de um MP4 cujo `moov` está no fim. Sem
        # este ramo, arquivo sem faststart não abre no player.
        cauda = pedir(base + serve.SOURCES_URL + "abcdefghijk.mp4",
                      headers={"Range": "bytes=-8"})
        with open(fonte_mp4, "rb") as fh:
            fim_esperado = fh.read()[-8:]
        check("31j. e a forma `bytes=-N` (o índice no fim do MP4) também",
              cauda.status == 206 and cauda.body == fim_esperado)
        fora = pedir(base + serve.SOURCES_URL + "abcdefghijk.mp4",
                     headers={"Range": "bytes=%d-" % (tamanho_fonte + 10)})
        check("31k. faixa fora do arquivo devolve 416, não um corpo mentiroso",
              fora.status == 416 and fora.headers.get("Content-Range")
              == "bytes */%d" % tamanho_fonte)
        # Travessia: o nome vem da URL, e `basename` é o que impede `/sources/../../x`.
        check("31l. /sources/ não serve nada de fora da pasta da fonte",
              pedir(base + serve.SOURCES_URL + "..%2F..%2Findex.html").status == 404
              or b"<h1>site</h1>" not in pedir(
                  base + serve.SOURCES_URL + "..%2F..%2Findex.html").body)

        # ---- a legenda de QUALQUER intervalo da fonte, sem baixar trecho --------------
        # É o que o sidecar escrito pela importação compra: a revisão de legenda e o 9:16
        # legendado passam a valer para qualquer pedaço do vídeo inteiro.
        falas_fonte = pedir(base + serve.ROUTE_CAPS, data=json.dumps({
            "token": "abcdefghijk", "name": "abcdefghijk.mp4", "start": 25.0, "end": 40.0,
        }).encode(), headers={"Content-Type": "application/json"})
        bloco_falas = json.loads(falas_fonte.body.decode("utf-8"))
        check("31m. a legenda de um intervalo da fonte sai do sidecar que a importação gravou",
              falas_fonte.status == 200 and bloco_falas["state"] == "ok"
              and len(bloco_falas["cues"]) >= 2
              and bloco_falas["cues"][0]["start"] == 0.0)

        # ---- o render recusa intervalo impossível ANTES de gastar minutos -------------
        for rotulo, corpo_render in (
                ("fim antes do começo", {"start": 10, "end": 5}),
                ("começo negativo", {"start": -1, "end": 5}),
                ("passa do fim do vídeo", {"start": 0, "end": 900})):
            corpo_render["clipToken"] = "abcdefghijk"
            # `negada`, e NÃO `recusa`: existe uma função `recusa()` no nível do módulo, e
            # atribuir esse nome aqui a tornaria local de `main()` inteira — a primeira
            # chamada dela, 1500 linhas acima, morreria com UnboundLocalError. Pego rodando.
            negada = pedir(base + serve.ROUTE_RENDER,
                           data=json.dumps(corpo_render).encode(),
                           headers={"Content-Type": "application/json"})
            check("31n. o render recusa %s, com motivo (%s)" % (rotulo, negada.status),
                  negada.status == 400 and negada.codigo_erro == "cut_invalid"
                  and len(negada.erro) > 10)
    finally:
        serve.close_server(servidor)

    # ------------------------------------------ 25: o teto do Remotion acompanha o clipe
    # Regressão do defeito relatado: um trecho de 90s (7:05→8:35) precisa de 1005s de
    # render (medido ponta a ponta: 2700 quadros, MP4 de 39,7 MB) e morria no teto FIXO de
    # 900s — a espera acabava sem arquivo nenhum. Teto constante é errado por construção:
    # sobra para clipe curto e mata todo clipe acima de ~80s.
    curto = serve.render_budget(10.0)
    longo = serve.render_budget(90.0)
    check("25a. clipe curto fica no piso (o piso já é folgado para ele)",
          curto == serve.DEFAULT_RENDER_TIMEOUT)
    check("25b. clipe de 90s ganha teto acima do piso fixo antigo",
          longo > serve.DEFAULT_RENDER_TIMEOUT)
    # 1005s é o render medido; a margem cobre a máquina disputada, que foi justamente
    # onde o mesmo render passou de 1036s.
    check("25c. o teto cobre o custo medido de 90s com margem", longo >= 1005.0 * 1.5)
    check("25d. teto cresce com a duração", serve.render_budget(180.0) > longo)
    check("25e. duração inválida cai no piso, não em zero",
          serve.render_budget(None) == serve.DEFAULT_RENDER_TIMEOUT
          and serve.render_budget(float("inf")) == serve.DEFAULT_RENDER_TIMEOUT
          and serve.render_budget(-5.0) == serve.DEFAULT_RENDER_TIMEOUT)
    # A recusa por tempo tem de dizer a saída, não só o fracasso (BP-008): quem esperou
    # meia hora precisa saber que o download do Passo 3 faz o mesmo em segundos.
    py_serve = open(os.path.join(worker.REPO, "video-worker", "serve.py"),
                    encoding="utf-8").read()
    check("25f. a recusa por tempo aponta a alternativa em FFmpeg",
          "corte um pedaço menor" in py_serve and "Passo 3" in py_serve)
    # O teto do servidor e a estimativa da tela vêm do MESMO número medido. Divergir faz a
    # tela prometer 10 min numa chamada que o servidor corta antes disso.
    js_render = open(os.path.join(worker.REPO, "video-ops.js"), encoding="utf-8").read()
    check("25g. o aviso de render usa a estimativa, não uma frase vaga fixa",
          "Renderizando no Remotion — ' + renderEta(" in js_render)
    # A tela não pode prometer mais tempo do que o servidor concede: seria anunciar 40 min
    # numa chamada que morre em 37. Lido do fonte para os dois números não se separarem.
    fator = re.search(r"num\(segundos\)\s*\*\s*([0-9.]+)", js_render)
    check("25h. a estimativa da tela cabe no teto do servidor",
          bool(fator) and 0 < float(fator.group(1)) <= serve.RENDER_SEC_PER_CLIP_SEC)

    # -------------------------- 26: fundo por miniatura também no caminho Remotion
    # Os DOIS renderizadores passaram a usar a mesma miniatura escurecida. Se um dos dois
    # números mudar sozinho, o mesmo corte sai com fundo diferente em cada caminho e nada
    # avisa — é a mesma razão pela qual o bloco 6 compara a tipografia com o preset.js.
    preset_js = open(os.path.join(worker.REPO, "studio", "src", "preset.js"),
                     encoding="utf-8").read()
    luz = re.search(r"fundoLuz:\s*([\d.]+)", preset_js)
    sat = re.search(r"fundoSaturacao:\s*([\d.]+)", preset_js)
    check("26a. o Remotion declara o escurecimento do fundo", bool(luz) and bool(sat))
    check("26b. escurecimento idêntico ao do FFmpeg (%s vs %s)"
          % (luz.group(1) if luz else "-", worker.THUMB_LUZ),
          bool(luz) and float(luz.group(1)) == worker.THUMB_LUZ)
    check("26c. dessaturação idêntica à do FFmpeg",
          bool(sat) and float(sat.group(1)) == worker.THUMB_SATURACAO)
    # Mesma razão, para o ramo SEM miniatura: os dois renderizadores pintam o letterbox de
    # uma cor só. Divergir faz o MESMO corte sair com moldura diferente em cada caminho, sem
    # nada avisar — e o `#0A0A0C` não é preto puro de propósito (banda visível na borda).
    cor = re.search(r"fundo:\s*'(#[0-9A-Fa-f]{6})'", preset_js)
    check("26p. o Remotion declara a cor do fundo", bool(cor))
    check("26q. letterbox do FFmpeg na MESMA cor do preset (%s vs %s)"
          % (cor.group(1) if cor else "-", worker.FUNDO_COR),
          bool(cor) and cor.group(1).upper() == worker.FUNDO_COR.upper())
    # Mesma razão outra vez, agora para o CANTO do vídeo deitado (pedido do usuário,
    # 2026-09-11). Raio diferente em cada renderizador é o mesmo corte saindo com moldura
    # diferente conforme o botão que o operador apertou — e isso é invisível até alguém pôr
    # os dois arquivos lado a lado.
    raio = re.search(r"videoRaio:\s*(\d+)", preset_js)
    check("26r. o Remotion declara o raio do canto do vídeo", bool(raio))
    check("26s. e ele é o MESMO raio do FFmpeg (%s vs %s)"
          % (raio.group(1) if raio else "-", worker.VIDEO_RAIO),
          bool(raio) and int(raio.group(1)) == worker.VIDEO_RAIO)
    # O nome do campo é o contrato entre serve.py e a composição: renomear um lado só faz o
    # fundo desaparecer calado, com render verde.
    py_render = open(os.path.join(worker.REPO, "video-worker", "serve.py"),
                     encoding="utf-8").read()
    clip_jsx = open(os.path.join(worker.REPO, "studio", "src", "Clip.jsx"),
                    encoding="utf-8").read()
    check("26d. o serve.py manda backgroundFile nos props", '"backgroundFile"' in py_render)
    check("26e. a composição lê o MESMO nome de campo", "backgroundFile" in clip_jsx)
    # POLARIDADE, com arquivos reais. Os checks de texto acima passam com a guarda
    # INVERTIDA (`background_ok` sem o `not`), que descarta a miniatura boa e entrega a
    # ilegível ao render — e passam também com `"backgroundFile": ""`, que mata a feature
    # inteira. Os dois estragos foram provados numa revisão adversarial, com a suíte verde.
    fundo_dir = os.path.join(trabalho, "fundo")
    os.makedirs(fundo_dir, exist_ok=True)
    with open(os.path.join(fundo_dir, "vid-0-5.mp4"), "wb") as fh:
        fh.write(b"nao importa: o render nao roda aqui")
    shutil.copyfile(os.path.join(worker.REPO, "assets", "capa-bg.jpg"),
                    os.path.join(fundo_dir, "vid-0-5.jpg"))
    check("26i. miniatura legível VOLTA como nome (a feature não é no-op)",
          serve.render_background(fundo_dir, "vid-0-5.mp4")
          == ("vid-0-5.jpg", serve.BACKGROUND_OK))
    # `.webp` com bytes mas ilegível: passa pelo getsize do thumbnail_beside e tem de morrer
    # no background_ok, senão o Img do Remotion falha ao carregar e o render inteiro cai.
    with open(os.path.join(fundo_dir, "vid-1-6.mp4"), "wb") as fh:
        fh.write(b"nao importa")
    with open(os.path.join(fundo_dir, "vid-1-6.webp"), "wb") as fh:
        fh.write(b"RIFF" + b"\x00" * 40)
    check("26j. miniatura ilegível NÃO chega ao render",
          serve.render_background(fundo_dir, "vid-1-6.mp4")
          == ("", serve.BACKGROUND_UNREADABLE))
    check("26k. sem miniatura nenhuma o campo vai vazio",
          serve.render_background(fundo_dir, "vid-9-9.mp4")
          == ("", serve.BACKGROUND_NONE))
    # 26k2: o par que dá sentido ao conjunto. Os dois casos acima produzem o MESMO nome ("")
    # e portanto o MESMO pixel (letterbox chapado) -- o estado é a ÚNICA coisa que separa
    # "este vídeo não tinha miniatura" (normal) de "a miniatura chegou quebrada" (baixar o
    # trecho de novo resolve). Colapsá-los num valor só apagaria a diferença calado, e é
    # justamente a sabotagem que este check existe para reprovar.
    check("26k2. os dois desfechos de letterbox NÃO colapsam",
          serve.render_background(fundo_dir, "vid-1-6.mp4")[1]
          != serve.render_background(fundo_dir, "vid-9-9.mp4")[1]
          and serve.render_background(fundo_dir, "vid-1-6.mp4")[0]
          == serve.render_background(fundo_dir, "vid-9-9.mp4")[0] == "")
    # A FIAÇÃO, não só a função: apagar `"backgroundFile": fundo` da montagem dos props
    # matava a feature inteira (todo corte voltava ao desfoque) e as 171 continuavam verdes,
    # porque nada aqui construía os props de verdade. Agora constrói.
    props = serve.render_props(fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0},
                               {"preset": "legenda", "category": "Advice!", "cues": []})
    check("26l. o nome da miniatura CHEGA aos props do Remotion",
          props.get("backgroundFile") == "vid-0-5.jpg")
    check("26m. os props levam só NOMES, nunca caminho de disco",
          os.sep not in props["clipFile"] and os.sep not in props["backgroundFile"])
    # A FIAÇÃO do estado, construída e não procurada no texto: apagar `"backgroundState"` da
    # montagem faria o caminho Remotion voltar a ser mudo sobre o fundo, com render verde.
    check("26m2. o ESTADO do fundo chega aos props junto com o nome",
          props.get("backgroundState") == serve.BACKGROUND_OK)
    sem_thumb = serve.render_props(fundo_dir, "vid-9-9.mp4", {"durationSec": 12.0},
                                   {"preset": "legenda", "cues": []})
    check("26m3. e sem miniatura o par sai coerente (nome vazio, estado NONE)",
          (sem_thumb["backgroundFile"], sem_thumb["backgroundState"])
          == ("", serve.BACKGROUND_NONE))
    # E o estado tem de ATRAVESSAR para o cabeçalho: props certos com a rota ignorando a
    # chave é exatamente o erro mudo de sempre.
    check("26m4. a rota do Remotion entrega o estado ao _send_video",
          "background_state=props[" in py_render)
    check("26n. a categoria continua sanitizada para slug", props["category"] == "advice")
    # --- a tarja da miniatura chega ao Remotion pelo MESMO dono que o FFmpeg usa. Dois
    # cálculos independentes fariam o mesmo corte enquadrar a miniatura em lugares
    # diferentes em cada renderizador, calado. Construindo o valor, não procurando texto.
    props_169 = serve.render_props(fundo_dir, "vid-0-5.mp4",
                                   {"durationSec": 12.0, "width": 1920, "height": 1080},
                                   {"preset": "legenda", "cues": []})
    check("26o. a altura da tarja CHEGA aos props e é a do worker.band_height",
          props_169["bandaAltura"] == worker.band_height(serve.video_box("blur", {
              "width": 1920, "height": 1080})) == 656)
    props_vert = serve.render_props(fundo_dir, "vid-0-5.mp4",
                                    {"durationSec": 12.0, "width": 1080, "height": 1920},
                                    {"preset": "legenda", "cues": []})
    check("26o2. fonte já vertical não tem tarja: ZERO, e zero é resposta, não erro",
          props_vert["bandaAltura"] == 0)
    check("26o3. sem dimensão legível assume 16:9, como o legendaBase faz",
          props["bandaAltura"] == 656)
    # Paridade com o padrão do Studio: o preset.js carrega uma cópia do número para abrir
    # certo sem servidor. Se um dos dois mudar sozinho, o Studio e o render divergem.
    banda_js = re.search(r"BANDA_PADRAO\s*=\s*(\d+)", preset_js)
    check("26p. o BANDA_PADRAO do preset.js bate com o worker.band_height(608)",
          bool(banda_js) and int(banda_js.group(1)) == worker.band_height(608))
    # O tempo por PALAVRA atravessa esta rota INTEIRA sem ser mexido: `cues_for_range` anexa,
    # o navegador guarda em `clip.clipCues`, devolve no corpo do /api/remotion-render e o
    # `render_props` grava no props-<token>.json. Provado construindo o valor, nao procurando
    # texto no arquivo: apagar o repasse aqui mataria o karaoke inteiro (todo corte de volta a
    # legenda estatica) sem nenhuma outra suite reclamar.
    com_palavras = [{"start": 0.0, "end": 1.0, "text": "erro caro",
                     "words": [{"start": 0.0, "end": 0.4, "text": "erro"},
                               {"start": 0.4, "end": 1.0, "text": "caro"}]}]
    props_kar = serve.render_props(fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0},
                                   {"preset": "legenda", "cues": com_palavras})
    check("26r. o tempo por palavra CHEGA aos props do Remotion, intacto",
          props_kar["cues"] == com_palavras
          and props_kar["cues"][0]["words"][1]["text"] == "caro")
    check("26s. e sobrevive ao JSON que o render le do disco (props-<token>.json)",
          json.loads(json.dumps(props_kar, ensure_ascii=False))["cues"] == com_palavras)
    # O props do Remotion passa pela MESMA regra unica do caminho FFmpeg (`normalize_cues`).
    # Era copia verbatim do corpo -- o unico ponto em que texto de legenda entrava num
    # renderizador sem passar pelo gargalo. Construido, nao procurado no texto do arquivo.
    props_sujo = serve.render_props(
        fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0},
        {"preset": "legenda",
         "cues": [{"start": 0.0, "end": 3.0, "text": ">> eu perdi [ __ ] tudo"},
                  {"start": 1.0, "end": 2.0, "text": "[__]"},
                  {"start": 2.0, "end": 4.0, "text": "e recomecei"}]})
    check("26u. o marcador do reconhecedor nao chega aos props do Remotion",
          not any(">>" in c["text"] or "__" in c["text"] for c in props_sujo["cues"]))
    check("26u2. a fala limpa continua la, e a que era so artefato virou BURACO",
          [c["text"] for c in props_sujo["cues"]] == ["eu perdi tudo", "e recomecei"])
    check("26u3. e o buraco nao foi doado a vizinha: a primeira para em 1.0, a segunda "
          "comeca em 2.0",
          [(c["start"], c["end"]) for c in props_sujo["cues"]] == [(0.0, 1.0), (2.0, 4.0)])
    # O TITULO do card passa pela MESMA regra unica. Ele nasce do `topic` do detector, que le
    # a cue CRUA de proposito (a pausa entre falas naquela grade e o que decide onde o corte
    # fecha), entao chega aqui com o `>>` da troca de falante e o `[ __ ]` da censura --
    # queimados numa MANCHETE, ainda mais a vista do que na legenda. Construido e nao
    # procurado no texto do arquivo: sem estes checks, apagar a limpeza deixa as oito suites
    # verdes e o marcador volta para a tela.
    props_titulo = serve.render_props(
        fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0},
        {"preset": "legenda", "cues": [],
         "title": ">> Sai de uma cidade [ __ ] para 100 mil pedidos"})
    check("26v. o marcador do reconhecedor nao chega ao titulo do card",
          props_titulo["title"] == "Sai de uma cidade para 100 mil pedidos")
    check("26v2. titulo ausente continua vazio (o pipeline nao inventa manchete)",
          serve.render_props(fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0},
                             {"preset": "legenda"})["title"] == "")
    check("26v3. titulo gigante e aparado em 180 antes de virar props",
          len(serve.render_props(fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0},
                                 {"preset": "legenda", "title": "a" * 400})["title"]) == 180)
    # ---- a IDENTIDADE do card (Primo Rico x Ecommerce Puro) --------------------------
    # O card tinha UMA marca fixa. Agora o operador escolhe por trecho, e o valor atravessa
    # tela -> corpo do POST -> AQUI -> props-<token>.json -> composicao. O elo que erra
    # CALADO e este: descartar o valor faria o video sair com a outra marca sem nada na tela
    # errar. Construido e nao procurado no texto do arquivo, pela mesma razao do 26v.
    def props_marca(corpo):
        base = {"preset": "legenda", "cues": [], "title": "Manchete"}
        base.update(corpo)
        return serve.render_props(fundo_dir, "vid-0-5.mp4", {"durationSec": 12.0}, base)

    check("26w. a identidade escolhida CHEGA aos props, intacta",
          props_marca({"titleCardStyle": "puro_ecommerce"})["titleCardStyle"]
          == "puro_ecommerce")
    check("26w2. e a outra tambem (o valor nao e ignorado nem fixado num dos dois)",
          props_marca({"titleCardStyle": "primo_rico"})["titleCardStyle"] == "primo_rico")
    # Chave AUSENTE e o caso do trecho salvo antes desta entrega: tem de sair como sempre
    # saiu, nao com a outra marca.
    check("26w3. corpo sem a chave cai no padrao (clip antigo nao muda de marca)",
          props_marca({})["titleCardStyle"] == serve.TITLE_CARD_PADRAO == "primo_rico")
    # O corpo do POST e ENTRADA. Valor desconhecido que atravessasse ate a composicao nao
    # tem aparencia definida: o card sairia sem placa, sem filete e sem borda, calado.
    for torto in (None, "", "Puro Ecommerce", "PURO_ECOMMERCE", "puro-ecommerce",
                  "outra_marca", 7, True):
        check("26x. valor torto e normalizado, nunca chega cru (%r)" % (torto,),
              props_marca({"titleCardStyle": torto})["titleCardStyle"] == "primo_rico")
    # A chave sai SEMPRE, porque prop mandado vence defaultProp na composicao: omiti-la
    # deixaria a composicao escolher, e a tela ja mostrou uma escolha.
    check("26x2. a chave existe sempre nos props (nunca omitida)",
          "titleCardStyle" in props_marca({}))
    # E sobrevive ao JSON que o render le do disco -- mesma prova do 26s para o tempo por
    # palavra: o valor pode chegar aos props e morrer na serializacao.
    check("26x3. e sobrevive ao props-<token>.json que o render le",
          json.loads(json.dumps(props_marca({"titleCardStyle": "puro_ecommerce"})))
          ["titleCardStyle"] == "puro_ecommerce")
    # PARIDADE das tres copias do conjunto (preset.js, video-ops.js e aqui). Nao ha import
    # possivel entre elas -- o preset.js e ESM do projeto Remotion, o index.html e Vanilla JS
    # sem npm e este modulo e stdlib puro. Divergirem faria o servidor descartar calado o
    # valor que a tela mandou. Mesma disciplina do 21t0/21t1 (estados da legenda).
    preset_js = open(os.path.join(worker.REPO, "studio", "src", "preset.js"),
                     encoding="utf-8").read()
    m_lista = re.search(r"export const TITLE_CARD_STYLES = \[([^\]]*)\]", preset_js)
    m_padrao = re.search(r"export const TITLE_CARD_PADRAO = '([^']+)'", preset_js)
    check("26y. o conjunto foi encontrado no preset.js (conferencia que nao acha nada "
          "e pior que nenhuma)", bool(m_lista and m_padrao))
    do_preset = tuple(s.strip().strip("'") for s in m_lista.group(1).split(",") if s.strip())
    check("26y2. a copia do servidor bate com o preset.js, na mesma ordem",
          serve.TITLE_CARD_STYLES == do_preset)
    check("26y3. e o padrao tambem bate", serve.TITLE_CARD_PADRAO == m_padrao.group(1))
    # E a terceira copia, a da tela: se ela oferecer um valor que este modulo descarta, o
    # operador escolhe uma marca e recebe a outra.
    ops_js = open(os.path.join(worker.REPO, "video-ops.js"), encoding="utf-8").read()
    m_ops = re.search(r"var TITLE_CARD_STYLES = \[([^\]]*)\]", ops_js)
    m_ops_padrao = re.search(r"var TITLE_CARD_PADRAO = '([^']+)'", ops_js)
    check("26z. o conjunto foi encontrado no video-ops.js", bool(m_ops and m_ops_padrao))
    do_ops = tuple(s.strip().strip("'") for s in m_ops.group(1).split(",") if s.strip())
    check("26z2. a copia da tela bate com a do servidor", do_ops == serve.TITLE_CARD_STYLES)
    check("26z3. e o padrao da tela tambem", m_ops_padrao.group(1) == serve.TITLE_CARD_PADRAO)
    # A composicao tem de conhecer a chave, senao o prop chega e ninguem o le -- a familia de
    # defeito que criou o `ancoraLegenda` e o `palavrasDaPagina`.
    clip_jsx = open(os.path.join(worker.REPO, "studio", "src", "Clip.jsx"),
                    encoding="utf-8").read()
    check("26z4. a composicao recebe a chave como prop e a resolve pelo gate do preset",
          "titleCardStyle" in clip_jsx
          and "const cardMarca = titleCardPreset(titleCardStyle);" in clip_jsx
          and "card={cardMarca}" in clip_jsx)
    # "nenhum" = sem card. Atravessa validado como qualquer outro valor, e o TITULO continua
    # indo: ele nomeia o arquivo baixado e o cartao da Central. Se apagar o card custasse a
    # manchete, esta opcao seria a mesma coisa que esvaziar o titulo -- que ja dava.
    check("26z5. o 'sem card' e valor conhecido e chega intacto aos props",
          props_marca({"titleCardStyle": "nenhum"})["titleCardStyle"] == "nenhum"
          and props_marca({"titleCardStyle": "nenhum"})["title"] == "Manchete")
    # E o portao do card no Clip.jsx tem de consultar a identidade RESOLVIDA: sem isso o
    # "sem card" chegaria como `card={null}` e o `card.marca` derrubaria o render.
    check("26z6. o portao do card considera a identidade resolvida",
          "comLegenda && medida.texto && cardMarca" in clip_jsx)

    # ---- o ESTILO da legenda (classico x impacto) ------------------------------------
    # Mesma familia de elo que a identidade do card acima, e o mesmo modo de falhar calado:
    # a tela oferece um estilo, este modulo descarta, e o video sai com a legenda de sempre
    # sem nada errar. A diferenca e que aqui o estilo muda TAMBEM a quebra de linha (o
    # `tetoDaPagina` do preset.js), entao um valor descartado nao muda so a fonte.
    check("26za. o estilo escolhido CHEGA aos props, intacto",
          props_marca({"legendaStyle": "impacto"})["legendaStyle"] == "impacto")
    check("26za2. e o outro tambem (o valor nao e ignorado nem fixado num dos dois)",
          props_marca({"legendaStyle": "classico"})["legendaStyle"] == "classico")
    check("26za3. corpo sem a chave cai no padrao (clip antigo nao muda de legenda)",
          props_marca({})["legendaStyle"] == serve.LEGENDA_PADRAO == "classico")
    for torto in (None, "", "Impacto (caixa alta)", "IMPACTO", "impacto-caixa-alta",
                  "outro_estilo", 7, True):
        check("26za4. valor torto e normalizado, nunca chega cru (%r)" % (torto,),
              props_marca({"legendaStyle": torto})["legendaStyle"] == "classico")
    check("26za5. a chave existe sempre nos props (nunca omitida)",
          "legendaStyle" in props_marca({}))
    check("26za6. e sobrevive ao props-<token>.json que o render le",
          json.loads(json.dumps(props_marca({"legendaStyle": "impacto"})))
          ["legendaStyle"] == "impacto")
    # PARIDADE das tres copias, pela mesma razao do 26y/26z.
    m_leg = re.search(r"export const LEGENDA_STYLES = \[([^\]]*)\]", preset_js)
    m_leg_padrao = re.search(r"export const LEGENDA_PADRAO = '([^']+)'", preset_js)
    check("26zb. o conjunto de legenda foi encontrado no preset.js", bool(m_leg and m_leg_padrao))
    leg_preset = tuple(s.strip().strip("'") for s in m_leg.group(1).split(",") if s.strip())
    check("26zb2. a copia do servidor bate com o preset.js, na mesma ordem",
          serve.LEGENDA_STYLES == leg_preset)
    check("26zb3. e o padrao tambem bate", serve.LEGENDA_PADRAO == m_leg_padrao.group(1))
    m_leg_ops = re.search(r"var LEGENDA_STYLES = \[([^\]]*)\]", ops_js)
    m_leg_ops_padrao = re.search(r"var LEGENDA_PADRAO = '([^']+)'", ops_js)
    check("26zc. o conjunto de legenda foi encontrado no video-ops.js",
          bool(m_leg_ops and m_leg_ops_padrao))
    leg_ops = tuple(s.strip().strip("'") for s in m_leg_ops.group(1).split(",") if s.strip())
    check("26zc2. a copia da tela bate com a do servidor", leg_ops == serve.LEGENDA_STYLES)
    check("26zc3. e o padrao da tela tambem",
          m_leg_ops_padrao.group(1) == serve.LEGENDA_PADRAO)
    # A composicao tem de LER a chave: prop que chega e ninguem le e a familia de defeito que
    # criou o `ancoraLegenda`. E o teto de pagina tem de sair do estilo RESOLVIDO -- cortar a
    # pagina com o teto do classico e desenha-la a 72px em caixa alta e a linha estourando a
    # coluna de 820px, sem erro nenhum.
    check("26zc4. a composicao resolve o estilo pelo gate e corta a pagina com o teto DELE",
          "legendaStyle" in clip_jsx
          and "const aparencia = legendaPreset(legendaStyle);" in clip_jsx
          and "toCaptionPages(cues, tetoDaPagina(aparencia))" in clip_jsx)
    # Legenda CORRIGIDA na tela nao tem tempo por palavra e nao pode inventar um: o operador
    # reescreveu o texto, e a grade antiga descreve outras palavras. Fica estatica, de propo-
    # sito -- se um dia alguem "consertar" isto, o karaoke passa a acender palavra errada.
    check("26t. legenda corrigida pelo operador perde o tempo por palavra (fica estatica)",
          all("words" not in c for c in serve.clean_edit_cues(
              [{"start": 0.0, "end": 1.0, "text": "erro caro", "words": com_palavras[0]["words"]}])))
    try:
        serve.render_props(fundo_dir, "vid-0-5.mp4", {"durationSec": 0.0}, {})
        sem_duracao = False
    except worker.WorkerError:
        sem_duracao = True
    check("26o. duração zero é recusada antes de gastar minutos de render", sem_duracao)
    # Descoberta por stem numa função só: duas implementações divergiriam na lista de
    # extensões e o corte perderia o fundo dependendo do caminho.
    check("26f. a descoberta da miniatura é a do ytclip, não uma segunda cópia",
          "ytclip.thumbnail_beside" in py_render)
    check("26h. uma lista de extensão só nos dois caminhos",
          serve.THUMB_EXTS is ytclip.THUMB_EXTS)
    # Miniatura ilegível não pode derrubar o render: o mesmo portão do caminho FFmpeg.
    check("26g. a miniatura passa pelo background_ok antes do render",
          re.search(r"thumbnail_beside[\s\S]{0,240}background_ok", py_render) is not None)

    # ------------------- 27: a legenda do Remotion sai da MESMA conta do ASS
    # Ate 2026-08-27 o Clip.jsx pendurava a legenda num percentual fixo do quadro
    # (`legendaTopoPct` = 66% = y 1267) e, com o video sem ampliacao, o texto caia 61px
    # ABAIXO da imagem, sobre a miniatura escurecida. Agora a formula e uma so
    # (`captions.margem_inferior`) e chega ao Remotion pelo prop `legendaBase`.
    #
    # Exercitando a FUNCAO com valor construido, nao `in arquivo`: `"legendaBase"` no texto
    # do serve.py passa igual com o numero certo, com o numero do perfil errado e com o
    # fallback que joga o texto para fora da imagem -- os tres fazem coisas diferentes.
    def props_de(w, h):
        media = {"durationSec": 12.0}
        if w and h:
            media.update({"width": w, "height": h})
        return serve.render_props(fundo_dir, "vid-0-5.mp4", media,
                                  {"preset": "legenda", "cues": []})

    esperado_16_9 = captions_mod.margem_inferior(worker.OUT_H, 608)
    check("27a. fonte 16:9 ancora a legenda no mesmo ponto que o ASS (%d)" % esperado_16_9,
          props_de(1920, 1080)["legendaBase"] == esperado_16_9)
    # 4:3 deita mais alto no quadro, entao a legenda desce com ele: numero DIFERENTE do 16:9.
    esperado_4_3 = captions_mod.margem_inferior(worker.OUT_H, 810)
    check("27b. fonte 4:3 acompanha o retangulo maior (%d)" % esperado_4_3,
          props_de(1440, 1080)["legendaBase"] == esperado_4_3
          and esperado_4_3 != esperado_16_9)
    # Fonte ja vertical preenche o quadro: aqui manda o teto da interface do TikTok
    # (ZONA_UI_PCT), nao o rodape -- senao o texto cairia na faixa de botoes.
    esperado_9_16 = captions_mod.margem_inferior(worker.OUT_H, worker.OUT_H)
    check("27c. fonte vertical bate no teto da faixa de botoes (%d)" % esperado_9_16,
          props_de(1080, 1920)["legendaBase"] == esperado_9_16
          and worker.OUT_H - esperado_9_16 <= worker.OUT_H * captions_mod.ZONA_UI_PCT + 1)
    # Sem dimensao o probe nao diz a proporcao. O fallback tem de ser 16:9, NUNCA "o video
    # preenche o quadro": este ultimo poe a base do texto em y 1651, fora da imagem, sobre a
    # miniatura -- exatamente o defeito que este pedido veio consertar.
    sem_dim = props_de(None, None)["legendaBase"]
    check("27d. sem dimensao cai no numero do 16:9", sem_dim == esperado_16_9)
    check("27e. e NAO no de 'preenche o quadro' (que jogaria o texto para fora da imagem)",
          sem_dim != captions_mod.margem_inferior(worker.OUT_H, None))
    # O Palco do Remotion sempre DEITA o quadro inteiro; ele nao tem o recorte do perfil
    # `crop`. Usar `crop` aqui daria o numero do preenchimento em toda fonte 16:9.
    check("27f. a caixa vem do perfil blur, que e o que o Palco faz",
          props_de(1920, 1080)["legendaBase"]
          == captions_mod.margem_inferior(worker.OUT_H,
                                          serve.video_box("blur", {"width": 1920,
                                                                   "height": 1080})))
    # O NOME da chave e contrato entre as duas linguagens: o servidor a escreve no
    # props-<token>.json e a composicao tem de ler exatamente ela. Por isso o padrao abaixo e
    # montado com a chave que os props REALMENTE trazem -- renomear um lado sem o outro faz
    # todo corte cair no fallback do preset, calado.
    #
    # O CONSUMO do numero (guarda contra NaN, polaridade da ancora, fiacao na tag <Legenda>)
    # NAO se prova aqui, e nem se provava antes: eram duas asserções de TEXTO
    # (`"legendaBase" in clip_jsx`, `Number(legendaBase) ||`) e texto casa palavra -- medido,
    # tres sabotagens do lado JS passavam com as cinco suites verdes, inclusive a ancora
    # invertida de 510px. A guarda virou funcao pura (`preset.ancoraLegenda`) e quem a CHAMA
    # com valor construido e o `studio/test-preset.mjs`, bloco 7.
    chave = next(k for k in props_de(1920, 1080) if k == "legendaBase")
    check("27g. a composicao le a MESMA chave dos props, e pela guarda do preset",
          re.search(r"ancoraLegenda\(%s\)" % chave, clip_jsx) is not None
          and re.search(r"export const Clip = \(\{[^}]*\b%s\b" % chave,
                        clip_jsx) is not None)

    # ------------------------- 28: enquadramento, cor, audio (qualidade do clip 9:16)
    # 28a: `PROFILES` DERIVA do `worker.REFRAMES`. Nao e igualdade com um literal repetido:
    # o que se prova e que ninguem mantem duas listas a mao -- acrescentar um perfil no
    # worker tem de aparecer aqui sozinho, senao o mesmo valor passa a valer num lado e nao
    # no outro.
    check("28a. serve.PROFILES deriva de worker.REFRAMES (nao e segunda lista)",
          serve.PROFILES == worker.REFRAMES + ("horizontal",)
          and "crop11" in serve.PROFILES and "crop45" in serve.PROFILES)
    # 28b: o validador de CORPO. Ausente/desconhecido cai no padrao, porque trecho salvo
    # antes do seletor nao manda a chave e tem de sair como sempre saiu.
    check("28b. reframe_profile: conhecido passa, o resto cai em `blur`",
          (serve.reframe_profile("crop45"), serve.reframe_profile("crop11"),
           serve.reframe_profile("zoom"), serve.reframe_profile(None),
           serve.reframe_profile("")) == ("crop45", "crop11", "blur", "blur", "blur"))
    # E a fronteira de ROTA continua RECUSANDO, que e outra coisa: la o valor vem da query.
    check("28c. e a query de rota continua recusando perfil desconhecido (400, nao padrao)",
          recusa("token=t&start=0&end=1&profile=crop99&output=o.mp4") == "job_invalid")
    check("28c2. mas o crop11/crop45 agora PASSAM pela query (antes nao existiam)",
          serve.parse_cut_query(
              "token=t&start=0&end=1&profile=crop11&output=o.mp4").profile == "crop11")

    # 28d-28g: A GEOMETRIA, por aritmetica, com os numeros do plano. `video_box` e o dono
    # unico: dele saem o `videoAltura`, o `bandaAltura` e o `legendaBase`.
    media169 = {"width": 1920, "height": 1080, "durationSec": 10.0}
    alturas = {q: serve.video_box(q, media169)
               for q in ("blur", "crop11", "crop45", "crop")}
    check("28d. as quatro alturas do quadro visivel: 608 / 1080 / 1350 / 1920",
          alturas == {"blur": 608, "crop11": 1080, "crop45": 1350, "crop": 1920})
    check("28e. e as tarjas que sobram: 656 / 420 / 285 / 0",
          [worker.band_height(alturas[q]) for q in ("blur", "crop11", "crop45", "crop")]
          == [656, 420, 285, 0])
    check("28f. e a legenda SOBE com o video: base a 705 / 506 / 393 / 269",
          [serve.captions.margem_inferior(worker.OUT_H, alturas[q])
           for q in ("blur", "crop11", "crop45", "crop")] == [705, 506, 393, 269])
    # POLARIDADE: as tres alturas oferecidas tem de ser distintas. Um `video_box` que
    # ignorasse o perfil (o defeito de antes, com "blur" cravado nas duas chamadas do
    # render_props) passaria em qualquer check que olhasse um perfil de cada vez.
    check("28g. perfil trocado muda a altura (video_box que ignora o perfil reprova aqui)",
          len({alturas["blur"], alturas["crop11"], alturas["crop45"]}) == 3)
    # A proporcao dos perfis de recorte NAO depende da fonte -- o `min` dos dois lados do
    # `crop` garante isso. Prova: uma fonte ja VERTICAL da as mesmas alturas.
    vertical = {"width": 720, "height": 1280}
    check("28g2. e nos perfis de recorte a altura nao depende da fonte (nem 9:16 de origem)",
          serve.video_box("crop11", vertical) == 1080
          and serve.video_box("crop45", vertical) == 1350
          and serve.video_box("blur", vertical) == worker.OUT_H)
    check("28g3. altura sempre PAR (yuv420p exige, e o numero vai ao filtro E aos props)",
          all(serve.video_box(q, m) % 2 == 0
              for q in ("blur", "crop11", "crop45", "crop")
              for m in (media169, vertical, {"width": 1920, "height": 1079})))
    check("28g4. sem dimensao legivel o `blur` devolve None (nao retangulo inventado)",
          serve.video_box("blur", {}) is None and serve.video_box("blur", None) is None)

    # 28h: a AMPLIACAO da fonte, que e o aviso de fonte mole. Os numeros sao os da tabela.
    check("28h. source_scale: 0,56x / 1,00x / 1,25x / 1,78x de uma fonte 1080p",
          [round(serve.source_scale(q, media169), 2)
           for q in ("blur", "crop11", "crop45", "crop")] == [0.56, 1.0, 1.25, 1.78])
    check("28h2. e de uma 720p o recorte passa do limiar (1,50x e 1,88x contra 1,30)",
          serve.source_scale("crop11", {"width": 1280, "height": 720}) > serve.ESCALA_MOLE
          and serve.source_scale("crop45", {"width": 1280, "height": 720})
          > serve.ESCALA_MOLE
          and serve.source_scale("blur", {"width": 1280, "height": 720})
          < serve.ESCALA_MOLE)

    # 28i-28k: os PROPS do Remotion. Chamando `render_props` com valor construido, nunca
    # `in serve.py`: foi por assercao de texto que `"backgroundFile": fundo` pode ser
    # apagado com a suite verde, e e por isso que esta funcao vive fora da rota.
    props11 = serve.render_props(temporario, "c.mp4", media169, {"reframe": "crop11"})
    props_pad = serve.render_props(temporario, "c.mp4", media169, {})
    check("28i. os props levam o reframe E a altura, coerentes com o video_box",
          props11["reframe"] == "crop11" and props11["videoAltura"] == 1080
          and props11["bandaAltura"] == 420 and props11["legendaBase"] == 506)
    check("28i2. e sobrevivem ao json.dumps que grava o props-<token>.json",
          json.loads(json.dumps(props11))["videoAltura"] == 1080)
    # POLARIDADE do padrao: corpo SEM a chave tem de sair exatamente como saia antes desta
    # entrega -- 608/656/705. Um padrao que virasse `crop11` mudaria todo trecho ja salvo.
    check("28j. corpo sem `reframe` cai em blur e reproduz os numeros de antes",
          props_pad["reframe"] == "blur" and props_pad["videoAltura"] == 608
          and props_pad["bandaAltura"] == 656 and props_pad["legendaBase"] == 705)
    check("28j2. e valor torto no corpo tambem cai no padrao, nao vaza para a composicao",
          serve.render_props(temporario, "c.mp4", media169,
                             {"reframe": "../etc"})["reframe"] == "blur")
    # As TRES saidas mudam juntas: se o `render_props` voltasse a chamar `video_box("blur")`
    # com o rotulo cravado, o `reframe` sairia certo e os numeros errados -- calado.
    check("28k. trocar o reframe move as TRES saidas de uma vez",
          (props11["videoAltura"], props11["bandaAltura"], props11["legendaBase"])
          != (props_pad["videoAltura"], props_pad["bandaAltura"],
              props_pad["legendaBase"]))

    # 28l: a FIACAO serve -> worker, interceptando o `render_cut`. Os checks acima provam que
    # o `build_filter` SABE recortar e que o `video_box` SABE contar; este prova que alguem
    # PEDE (a licao do 20q).
    pedido_reframe = {}
    real_rc = worker.render_cut

    def espiao_reframe(*args, **kwargs):
        pedido_reframe["reframe"] = args[4] if len(args) > 4 else kwargs.get("reframe")
        pedido_reframe["band_h"] = kwargs.get("band_h")
        open(args[1], "wb").write(b"x")

    worker.render_cut = espiao_reframe
    fio2 = tempfile.mkdtemp(prefix="fio-reframe-")
    try:
        req45 = serve.CutRequest(token="tok", name="fonte.mp4", start=0.0, end=1.0,
                                 profile="crop45", output="o.mp4")
        try:
            serve.render_to(os.path.join(fio2, "o.mp4"), "fonte.mp4", req45, True, None,
                            None, None,
                            worker.band_height(serve.video_box("crop45", media169)))
        except Exception:
            pass
    finally:
        worker.render_cut = real_rc
        shutil.rmtree(fio2, ignore_errors=True)
    check("28l. o perfil escolhido CHEGA ao worker, com a tarja do perfil",
          pedido_reframe.get("reframe") == "crop45"
          and pedido_reframe.get("band_h") == 285)

    # 28m: PARIDADE do desfoque entre os dois renderizadores. Unidade DIFERENTE de proposito:
    # o CSS define blur(r) como gaussiana de desvio padrao r/2, entao 28px == sigma 14.
    # Igualdade simples aqui seria errada e esconderia um desfoque com o dobro do raio.
    m_desfoque = re.search(r"fundoDesfoque:\s*(\d+)", preset_js)
    check("28m. fundoDesfoque (CSS) == 2 x THUMB_DESFOQUE_SIGMA (gaussiana)",
          m_desfoque is not None
          and int(m_desfoque.group(1)) == 2 * worker.THUMB_DESFOQUE_SIGMA)
    m_luz = re.search(r"fundoLuz:\s*([\d.]+)", preset_js)
    check("28m2. e o escurecimento da tarja continua o MESMO nos dois, e mais forte",
          m_luz is not None and abs(float(m_luz.group(1)) - worker.THUMB_LUZ) < 1e-9
          and worker.THUMB_LUZ < 0.42)

    # 28n: PARIDADE do conjunto de perfis nas TRES copias. A do video-ops.js e a que nao
    # tem como importar o modulo do outro lado, entao ela e lida por regex -- e por isso os
    # tres arquivos guardam LITERAIS.
    def lista_js(texto, nome, prefixo):
        achado = re.search(prefixo + nome + r"\s*=\s*\[([^\]]*)\]", texto)
        return ([x.strip().strip("'\"") for x in achado.group(1).split(",") if x.strip()]
                if achado else None)
    reframes_preset = lista_js(preset_js, "REFRAMES", r"export const ")
    reframes_ops = lista_js(ops_js, "REFRAMES", r"var ")
    check("28n. worker.REFRAMES == preset.js == video-ops.js (mesma ordem)",
          reframes_preset == list(worker.REFRAMES)
          and reframes_ops == list(worker.REFRAMES))
    oferecidos = lista_js(ops_js, "REFRAMES_OFERECIDOS", r"var ")
    check("28n2. e os OFERECIDOS sao subconjunto (o `crop` fica interno, como sempre foi)",
          oferecidos is not None
          and set(oferecidos) < set(worker.REFRAMES) and "crop" not in oferecidos)
    check("28n3. o padrao e o mesmo nas tres copias",
          re.search(r"REFRAME_PADRAO\s*=\s*'([^']+)'", preset_js).group(1)
          == re.search(r"REFRAME_PADRAO\s*=\s*'([^']+)'", ops_js).group(1)
          == worker.REFRAME_PADRAO)

    # 28o: o CABECALHO do audio e o conjunto FECHADO. O molde e o 21t0/21t1: o check LE o
    # video-ops.js e reprova estado sem frase do outro lado -- estado que sai no cabecalho e
    # nao tem frase e o erro mudo que o conjunto existe para impedir.
    check("28o. _audio_state filtra pelo conjunto fechado (desconhecido = falha)",
          serve._audio_state(worker.AUDIO_OK) == worker.AUDIO_OK
          and serve._audio_state("qualquer\r\nCoisa: x") == worker.AUDIO_FAILED
          and serve._audio_state(None) == worker.AUDIO_FAILED)
    faltando_audio = [e for e in worker.AUDIO_STATES
                      if ('"%s"' % e) not in ops_js and ("'%s'" % e) not in ops_js
                      and ("%s:" % e) not in ops_js]
    check("28o2. e cada estado tem frase no video-ops.js (faltando: %s)"
          % (faltando_audio or "nenhum"), not faltando_audio)
    check("28o3. o `_send_video` e o UNICO emissor (as duas rotas passam por ele)",
          py_render.count('send_header("X-Clip-Audio"') == 1
          and "_finish_video" in py_render)
    # 28o4: os DOIS estados de sucesso entregam ARQUIVO. Exercitado de verdade, com um
    # substituto que so carrega o `ffmpeg_timeout` -- e o unico atributo que a funcao usa, e
    # subir um servidor inteiro para isto seria fixture por nada. Aceitar so o AUDIO_OK
    # apagaria o arquivo do ramo SEM audio, que e justamente o ramo em que a correcao de cor
    # do passe (o `-bsf:v`) e a UNICA coisa que o passe fez -- se perderia calado.
    fio3 = tempfile.mkdtemp(prefix="fio-acabamento-")
    try:
        class _Fake:
            ffmpeg_timeout = 120
        com_som = make_source(os.path.join(fio3, "com.mp4"), 1, 320, 180)
        sem_som = make_source(os.path.join(fio3, "sem.mp4"), 1, 320, 180, audio=False)
        e1, p1 = serve.CutHandler._finish_video(_Fake(), com_som)
        e2, p2 = serve.CutHandler._finish_video(_Fake(), sem_som)
        check("28o4. _finish_video entrega arquivo COM audio (%s) e SEM audio (%s)"
              % (e1, e2),
              (e1, bool(p1 and os.path.exists(p1))) == (worker.AUDIO_OK, True)
              and (e2, bool(p2 and os.path.exists(p2))) == (worker.AUDIO_SEM_FAIXA, True))
    finally:
        shutil.rmtree(fio3, ignore_errors=True)

    # 28p: as flags de cor/quadro do Remotion. As constantes sao lidas E a fiacao no argv e
    # conferida: uma declarada e nao usada seria o defeito silencioso de sempre.
    check("28p. o render pede bt709 e o quadro sem perda (flags do Remotion 4.0.513)",
          serve.RENDER_COLOR_SPACE == "bt709"
          and serve.RENDER_IMAGE_FORMAT in ("jpeg", "png")
          and (serve.RENDER_IMAGE_FORMAT == "png" or serve.RENDER_JPEG_QUALITY == 100))
    check("28p2. e elas entram no comando, nao ficam so declaradas",
          '"--color-space=" + RENDER_COLOR_SPACE' in py_render
          and '"--image-format=" + RENDER_IMAGE_FORMAT' in py_render)

    # 30: o CABECALHO do FUNDO e o conjunto FECHADO. Mesmo molde do 28o (audio) e do 21t0
    # (legenda): guarda puro aqui, frase do outro lado, e o check que LE o JS reprovando quem
    # esquecer. O defeito que este bloco fecha: os dois casos de letterbox -- sem miniatura x
    # miniatura ilegivel -- davam o MESMO pixel e NENHUM sinal na tela, entao o operador nao
    # tinha como distinguir "este video nao tinha miniatura" (normal) de "a miniatura chegou
    # quebrada" (baixar o trecho de novo resolve). O motivo ia so ao console (BP-008).
    check("30a. _background_state filtra pelo conjunto fechado (desconhecido = ilegivel)",
          serve._background_state(serve.BACKGROUND_OK) == serve.BACKGROUND_OK
          and serve._background_state("lixo") == serve.BACKGROUND_UNREADABLE
          and serve._background_state(None) == serve.BACKGROUND_UNREADABLE)
    # CRLF nao pode atravessar: o valor entra num send_header e um "\r\nX: b" injetaria um
    # cabecalho na resposta. Foi assim que o `reason` do sidecar quase escapou em 2026-08-24.
    check("30b. valor com CRLF nao chega ao cabecalho",
          serve._background_state("a" + CR + LF + "X: b") == serve.BACKGROUND_UNREADABLE
          and _codifica_cabecalho(serve._background_state("a" + CR + LF + "X: b")))
    # E os dois legitimos NAO colapsam: o guarda recusa o desconhecido, nao junta os pares --
    # a mesma regra que mantem CAPTIONS_NOT_AVAILABLE separado de EXTRACTION_FAILED.
    # 30d E o check que da sentido ao conjunto fechado: sem ele isto vira um cabecalho que
    # ninguem le. Foi o irmao dele (21t0) que pegou o CAPTIONS_EDITED_EMPTY sem frase.
    faltando_fundo = [e for e in serve.BACKGROUND_STATES
                      if ('"%s"' % e) not in ops_js and ("'%s'" % e) not in ops_js
                      and ("%s:" % e) not in ops_js]
    check("30d. cada estado do fundo tem frase no video-ops.js (faltando: %s)"
          % (faltando_fundo or "nenhum"), not faltando_fundo)
    check("30e. o `_deliver_video` e o UNICO emissor, e o cabecalho e CONDICIONAL",
          py_render.count('send_header("X-Clip-Background"') == 1
          and "if background_state:" in py_render)
    check("30c. os dois desfechos de letterbox continuam DISTINTOS",
          serve.BACKGROUND_NONE != serve.BACKGROUND_UNREADABLE
          and serve._background_state(serve.BACKGROUND_NONE) == serve.BACKGROUND_NONE
          and serve._background_state(serve.BACKGROUND_UNREADABLE)
          == serve.BACKGROUND_UNREADABLE
          and len(set(serve.BACKGROUND_STATES)) == 3)

    # ------------------------------------ 32: a fonte importada, sem servidor nem rede
    # 32a é o irmão do 21t0 e do 30d, e existe pela MESMA razão: estado que o servidor manda
    # na resposta e não tem frase do outro lado é um valor que a tela recebe e não sabe
    # dizer. Aqui dói mais que nos outros — a importação leva minutos, e um estado mudo
    # deixaria a barra andando sem nada explicando o que está acontecendo.
    faltando_import = [e for e in serve.IMPORT_STATES
                       if ('"%s"' % e) not in ops_js and ("'%s'" % e) not in ops_js
                       and ("%s:" % e) not in ops_js]
    check("32a. cada estado da importação tem frase no video-ops.js (faltando: %s)"
          % (faltando_import or "nenhum"), not faltando_import)
    faltando_etapa = [e for e in serve.IMPORT_STAGES
                      if ('"%s"' % e) not in ops_js and ("'%s'" % e) not in ops_js
                      and ("%s:" % e) not in ops_js]
    check("32b. e cada etapa também (faltando: %s)" % (faltando_etapa or "nenhum"),
          not faltando_etapa)

    # 32c: `-ss` ANTES do `-i`. Não é estilo: depois do `-i` o FFmpeg decodifica desde o
    # começo, e num podcast de 3 h um trecho em 2:30:00 custaria duas horas e meia de decode
    # por exportação. A prova é a ORDEM na lista, construída pela função.
    args_trecho = serve.clip_args("fonte.mp4", "saida.mp4", 9000.0, 40.0, True)
    check("32c. clip_args põe -ss ANTES do -i (seek rápido; depois do -i custa horas)",
          args_trecho.index("-ss") < args_trecho.index("-i")
          and args_trecho[args_trecho.index("-ss") + 1] == "9000.000"
          and args_trecho[args_trecho.index("-t") + 1] == "40.000")
    check("32d. e recodifica (o corte tem de cair no quadro pedido, não no keyframe)",
          "-c:v" in args_trecho and "libx264" in args_trecho
          and "copy" not in args_trecho)
    # Fonte sem áudio existe (vídeo mudo, tela de captura). `-an` em vez de um `-c:a` que
    # falharia no meio do passe.
    check("32e. clip_args respeita fonte sem faixa de áudio",
          "-an" in serve.clip_args("a.mp4", "b.mp4", 0.0, 1.0, False)
          and "-an" not in args_trecho)

    # 32k-32m: os nomes de UM render. Inline na rota, nenhum dos dois é testável sem rodar o
    # Remotion (minutos, npx, Chrome headless), e os dois já falharam de verdade.
    props_a, dest_a = serve.render_paths("/tmp/cache", "abcdefghijk")
    props_b, dest_b = serve.render_paths("/tmp/cache", "abcdefghijk")
    # O Remotion decide o container pela EXTENSÃO do destino. Sem `.mp4` ele sai sem gravar
    # arquivo, e a rota responde "O Remotion falhou: npm notice" — medido, e não aponta para
    # nada. A extensão vinha por acidente enquanto o token era o nome do arquivo do trecho.
    check("32k. o destino do render TEM extensão .mp4 (o Remotion a usa para o container)",
          dest_a.endswith(".mp4") and props_a.endswith(".json"))
    # O token é o MESMO para todos os cortes da fonte: sem sufixo, dois "Baixar vídeo editado"
    # do mesmo vídeo escrevem no mesmo props, e o primeiro render usa o trecho do segundo.
    check("32l. e dois renders do MESMO vídeo não colidem em props nem em destino",
          props_a != props_b and dest_a != dest_b)
    # A propriedade é "o nome é UM componente", não a grafia do separador: comparar com
    # `os.path.normpath` reprovava por `/` contra `\` no Windows, e o guarda estava certo.
    props_t, dest_t = serve.render_paths(os.path.join("qualquer", "cache"), "../../x")
    check("32m. token torto não vira caminho (o nome vai a processo e a disco)",
          os.sep not in os.path.basename(dest_t)
          and ".." not in os.path.basename(dest_t)
          and os.path.dirname(dest_t) == os.path.join("qualquer", "cache")
          and os.path.dirname(props_t) == os.path.join("qualquer", "cache"))
    # O nome do arquivo GUARDADO não carrega o sufixo aleatório do temporário: ele apareceria
    # na pasta de cortes do operador. Sai do token mais o intervalo, e sem intervalo não
    # inventa números.
    check("32n. o nome do editado sai do token e do intervalo, sem o sufixo do temporário",
          serve.edited_name("abcdefghijk", {"start": 600.0, "end": 640.0})
          == "abcdefghijk-600-640-editado.mp4"
          and serve.edited_name("abcdefghijk", {}) == "abcdefghijk-editado.mp4"
          and serve.edited_name("abcdefghijk", {"start": 5, "end": 1})
          == "abcdefghijk-editado.mp4")
    # E o erro do Remotion diz o que QUEBROU. O `npx` imprime o aviso do npm DEPOIS do erro,
    # então pegar a última linha entregava "npm notice" — uma sessão de depuração inteira.
    class _Proc:
        stderr = ("Error: Could not determine codec\n"
                  "npm notice\nnpm notice New minor version of npm available!\n").encode()
        stdout = b""
    check("32o. a falha do Remotion mostra a linha do ERRO, não o aviso do npm",
          serve._falha_render(_Proc()) == "Error: Could not determine codec")

    class _Mudo:
        stderr = b""
        stdout = b""
    check("32p. e sem nenhuma linha útil ela diz isso, em vez de inventar",
          serve._falha_render(_Mudo()) == "sem detalhe")

    # 32f: o sidecar da importação é o que dá legenda e miniatura à fonte. A prova é o
    # ROUND-TRIP pelo leitor de verdade: escrever num formato que o `_sidecar_captions` não
    # entende não daria erro nenhum — ele degradaria calado para "sem legenda", e todo corte
    # sairia sem texto. É a armadilha que este check existe para fechar.
    fio_src = tempfile.mkdtemp(prefix="fonte-sidecar-")
    try:
        serve.write_source_sidecar(fio_src, "abcdefghijk.mp4", {
            "videoId": "abcdefghijk", "url": "https://www.youtube.com/watch?v=abcdefghijk",
            "durationSec": 7200.0, "heatmap": [],
            "cues": [{"start": 1.0, "end": 2.0, "text": "primeira"},
                     {"start": 3.0, "end": 4.0, "text": "segunda"}],
            "words": [], "captionLang": "pt-BR", "captionKind": "manual", "note": ""})
        # Lido pelo MESMO caminho que o /api/video-cut usa.
        serve._sidecar_dir = lambda: fio_src
        lido = serve._sidecar_captions(serve._read_most_replayed("abcdefghijk.mp4"))
        check("32f. o sidecar da importação é lido de volta COM legenda pelo leitor real",
              lido["available"] is True and len(lido["cues"]) == 2
              and lido["language"] == "pt-BR" and lido["kind"] == "manual")
        # Sem legenda o bloco diz POR QUÊ, em vez de vir vazio e calado.
        serve.write_source_sidecar(fio_src, "bbbbbbbbbbb.mp4", {
            "videoId": "bbbbbbbbbbb", "url": "u", "durationSec": 1.0, "heatmap": [],
            "cues": [], "words": [], "captionLang": "", "captionKind": "", "note": ""})
        sem = serve._sidecar_captions(serve._read_most_replayed("bbbbbbbbbbb.mp4"))
        check("32g. e vídeo sem legenda vira motivo escrito, não lista vazia calada",
              sem["available"] is False and sem["reason"] == ytclip.CAPTIONS_NONE)
        # 32h: meia fonte é fonte AUSENTE. Mídia sem sidecar não pode passar por "pronta" —
        # passaria, e todo corte sairia sem legenda e sem miniatura, calado.
        solta = os.path.join(fio_src, "ccccccccccc.mp4")
        with open(solta, "wb") as fh:
            fh.write(b"0" * 64)
        check("32h. mídia sem sidecar NÃO conta como fonte pronta",
              serve.source_media_on_disk(fio_src, "ccccccccccc") == ("", ""))
        # E o ramo que ACHA: com os dois arquivos, a fonte é encontrada pelo id.
        with open(os.path.join(fio_src, "abcdefghijk.mp4"), "wb") as fh:
            fh.write(b"0" * 64)
        caminho_achado, nome_achado = serve.source_media_on_disk(fio_src, "abcdefghijk")
        check("32i. com mídia E sidecar a fonte é achada pelo id do vídeo",
              nome_achado == "abcdefghijk.mp4" and os.path.isfile(caminho_achado))
        check("32j. e id que não é do YouTube nunca vira caminho de arquivo",
              serve.source_media_on_disk(fio_src, "../../etc") == ("", "")
              and serve.source_media_on_disk(fio_src, "") == ("", ""))
    finally:
        shutil.rmtree(fio_src, ignore_errors=True)

    # ------------------------------------------------------------ 14: limpeza
    check("14. o temporário é removido no encerramento", not os.path.isdir(temporario))

    # ---------------------------------------------------------------- relatório
    print("\n--- verificações ---")
    falhas = 0
    for label, ok in CHECKS:
        print("  %s  %s" % ("ok  " if ok else "FALHA", label))
        if not ok:
            falhas += 1

    if not args.keep:
        shutil.rmtree(trabalho, ignore_errors=True)
        print("\n(temporários removidos; use --keep para inspecionar)")
    else:
        print("\ntrabalho mantido em %s" % trabalho)

    if falhas:
        fail("%d verificação(ões) falharam" % falhas)
    print("\nok — %d verificações passaram. Nenhum conteúdo protegido foi usado." % len(CHECKS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
