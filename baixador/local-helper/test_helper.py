"""Checagens do helper. Sem rede, sem servidor. py -3.12 test_helper.py"""
import sys
import json
import re
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
import server
import yt_dlp_runner as r

N = 0


def ck(cond, msg):
    global N
    assert cond, msg
    N += 1


# 1. validacao de URL
for ok in ("http://x.com/v", "https://www.youtube.com/watch?v=abc"):
    ck(r.valid_url(ok), f"deveria aceitar {ok}")
for bad in ("", "   ", "file:///c:/x", "javascript:alert(1)", "-oProibido",
            "ftp://x", "http://", "https://", None, 123):
    ck(not r.valid_url(bad), f"deveria rejeitar {bad!r}")

# pasta de download nunca dentro do repositorio
repo = Path(__file__).resolve().parents[2]
ck(repo not in config.DOWNLOAD_DIR.parents and config.DOWNLOAD_DIR != repo,
   "DOWNLOAD_DIR nao pode ficar dentro do repo")

# 2. progresso
ck(r.parse_progress("@@PROG  42.3%") == 42.3, "@@PROG")
ck(r.parse_progress("[download]   7.0% of ~1.20GiB at 3MiB/s") == 7.0, "fallback [download]")
ck(r.parse_progress("@@PROG  N/A%") is None, "percentual N/A")
ck(r.parse_progress("[youtube] Extracting URL") is None, "linha lixo")
ck(r.parse_filename("@@FILE C:\\Users\\x\\Downloads\\yt-dlp\\Video.mp4") == \
   "C:\\Users\\x\\Downloads\\yt-dlp\\Video.mp4", "@@FILE")
ck(r.parse_filename("[download] 100%") is None, "@@FILE ausente")

# 3. maquina de estados
job = r.new_job()
ck(job["status"] == "queued" and job["progress"] == 0, "job nasce queued/0")
r.consume_line(job, "[youtube] abc: Downloading webpage")
ck(job["status"] == "downloading", "primeira linha -> downloading")
r.consume_line(job, "@@PROG  50.0%")
ck(job["progress"] == 25.0, "progresso: 1o arquivo ocupa a 1a metade da barra")
r.consume_line(job, "[Merger] Merging formats into \"Video.mp4\"")
ck(job["status"] == "processing", "[Merger] -> processing")
r.consume_line(job, "@@PROG  99.0%")
ck(job["status"] == "processing", "progresso nao volta de processing")
r.consume_line(job, "@@FILE C:\\tmp\\Video.mp4")
ck(job["filename"] == "Video.mp4", "filename e o nome do arquivo")

tmp = Path(tempfile.mkdtemp())
(tmp / "Outro.mp4").write_bytes(b"x")
r.finish(job, 0, tmp, True)
ck(job["status"] == "completed" and job["progress"] == 100, "exit 0 -> completed")
ck(job["filename"] == "Video.mp4", "filename do @@FILE tem precedencia")

fb = r.new_job()
r.consume_line(fb, "[download] Destination: Outro.mp4")
r.finish(fb, 0, tmp, True)
ck(fb["filename"] == "Outro.mp4", "sem @@FILE -> arquivo mais recente da pasta")

bad = r.new_job()
r.consume_line(bad, "ERROR: Video unavailable")
r.finish(bad, 1, tmp, True)
ck(bad["status"] == "error" and bad["error"] == "Video unavailable", "exit 1 -> error")
ck("\n" not in bad["error"] and "Traceback" not in bad["error"], "erro sanitizado")

ff = r.new_job()
r.consume_line(ff, "ERROR: You have requested merging of multiple formats but ffmpeg is not installed")
r.finish(ff, 1, tmp, False)
ck("FFmpeg" in ff["error"], "erro de merge sem ffmpeg avisa do FFmpeg")
ck("FFmpeg" not in r.friendly_error("ffmpeg exited with code 1", True),
   "com ffmpeg presente nao culpa o FFmpeg")
ck(r.friendly_error("", True), "erro vazio ainda tem mensagem")
ck(r.public(ff)["error"] and "_err" not in r.public(ff), "public() nao vaza campo interno")

# 4. lista de argumentos
url = "https://www.youtube.com/watch?v=abc"
args = r.build_args("C:\\bin\\yt-dlp.exe", url, tmp)
ck(isinstance(args, list) and "--ignore-config" in args, "--ignore-config presente")
ck(args[-2] == "--" and args[-1] == url, '"--" imediatamente antes da URL')
ck(all(url not in a for a in args[:-1]), "URL nunca concatenada em outro argumento")
ck("--no-playlist" in args and "--no-simulate" in args, "flags do contrato")
ck(not any("--exec" in a or "cookies" in a or "aria2c" in a for a in args), "nada proibido")

# 5. um download ativo por vez (exe falso: nenhum processo e iniciado nestes caminhos)
r._jobs.clear()
config.yt_dlp_path = lambda: None
ck(r.start(url) == (None, "no-ytdlp"), "sem yt-dlp nao executa nada")
config.yt_dlp_path = lambda: "C:\\bin\\yt-dlp.exe"
ck(not r._is_busy(), "sem job ativo")
busy = r.new_job()
busy["status"] = "downloading"
r._jobs[busy["id"]] = busy
r._active_id = busy["id"]
ck(r._is_busy(), "job em andamento = ocupado")
ck(r.start(url) == (None, "busy"), "segundo download recusado")
busy["status"] = "completed"
ck(not r._is_busy(), "job terminado libera a vaga")
ck(r.start("file:///c:/x") == (None, "bad-url"), "URL ruim recusada antes de executar")
ck(r.get("naoexiste") is None, "id desconhecido")
ck(r.get(busy["id"])["status"] == "completed", "get() devolve o job")

# CORS: so a extensao
ck(server.cors_origin("chrome-extension://abcdef") == "chrome-extension://abcdef", "CORS extensao")
for o in (None, "", "https://site-qualquer.com", "http://127.0.0.1:5500", "null"):
    ck(server.cors_origin(o) is None, f"CORS negado para {o!r}")


# 6. barra nao anda para tras, e URL com caractere de controle nao passa
j2 = r.new_job()
for linha, esperado in (("@@PROG  10.0%", 5.0), ("@@PROG  90.0%", 45.0),
                        ("@@PROG   5.0%", 52.5), ("@@PROG  80.0%", 90.0)):
    r.consume_line(j2, linha)
    ck(j2["progress"] == esperado,
       "barra em duas fases: %s -> %s" % (linha.strip(), esperado))
ck(r.valid_url("https://x/" + chr(0) + "--exec") is False, "URL com NUL recusada")
ck(r.valid_url("https://x/" + chr(10) + "a") is False, "URL com quebra de linha recusada")
ck(r.valid_url("https://x/" + chr(127)) is False, "URL com DEL recusada")
ck(r.valid_url("https://www.youtube.com/watch?v=abc") is True, "URL normal segue aceita")

# 7. portao de origem: o CORS nao impede o pedido de chegar, o metodo impede
import server as srv
ck(srv.origin_allowed(None) is True, "sem Origin (curl/dono da maquina) passa")
ck(srv.origin_allowed("chrome-extension://abc") is True, "extensao passa")
ck(srv.origin_allowed("https://site-malicioso.example") is False, "site qualquer leva 403")
ck(srv.origin_allowed("http://127.0.0.1:8770") is False, "pagina local tambem nao age")

# 8. a ultima linha util e a que explica a falha
j3 = r.new_job()
r.consume_line(j3, "@@PROG   0.0%")
r.consume_line(j3, "ERROR: unable to download video data: HTTP Error 403: Forbidden")
r.finish(j3, 1, Path(tempfile.mkdtemp()), True)
ck("403" in j3["error"], "erro reportado e o ERROR:, nao o primeiro @@PROG")
ck("@@" not in j3["error"], "nada de marcador interno no texto do erro")


# 9. "Mais reproduzidos" entra no import sem poder derrubar o download
ck("--write-info-json" in r.build_args("yt-dlp.exe", "https://x/v", "C:\\tmp"),
   "o download ja pede o metadado (nenhuma requisicao extra)")

d = Path(tempfile.mkdtemp())
(d / "Video.mp4").write_bytes(b"x")
(d / "Video.info.json").write_text(json.dumps({
    "id": "abc123", "webpage_url": "https://www.youtube.com/watch?v=abc123",
    "duration": 5421,
    "heatmap": [{"start_time": i * 5.0, "end_time": i * 5.0 + 5.0,
                 "value": 1.0 if i in (40, 41) else 0.2} for i in range(100)],
}), encoding="utf-8")
reg = r.save_most_replayed(d, "Video.mp4")
ck(reg["videoId"] == "abc123", "videoId veio do metadado")
ck(reg["duration"] == 5421.0, "duracao em segundos")
ck(reg["mostReplayed"]["available"] is True, "achou o momento mais reproduzido")
ck(reg["mostReplayed"]["peaks"][0]["rank"] == 1, "pico ranqueado")
ck(len(reg["mostReplayed"]["points"]) == 100, "guardou os baldes como evidencia")
ck((d / "Video.mostreplayed.json").exists(), "bloco persistido AO LADO do video")
ck(json.loads((d / "Video.mostreplayed.json").read_text(encoding="utf-8"))["mostReplayed"]
   ["peaks"][0]["peakValue"] == 1.0, "o arquivo gravado tem o mesmo pico")

# Caso 2 do pedido: video sem grafico continua funcionando
d2 = Path(tempfile.mkdtemp())
(d2 / "Sem.mp4").write_bytes(b"x")
(d2 / "Sem.info.json").write_text(json.dumps({"id": "s1", "duration": 10}), encoding="utf-8")
reg2 = r.save_most_replayed(d2, "Sem.mp4")
ck(reg2["mostReplayed"]["available"] is False, "sem grafico: available=false")
ck(reg2["mostReplayed"]["reason"] == "MOST_REPLAYED_NOT_AVAILABLE", "motivo distinguivel")
ck((d2 / "Sem.mostreplayed.json").exists(), "gravou mesmo sem grafico")

# Caso 3 do pedido: falha na extracao NAO e falha de download
d3 = Path(tempfile.mkdtemp())
(d3 / "Ruim.info.json").write_text("{ isto nao e json", encoding="utf-8")
reg3 = r.save_most_replayed(d3, "Ruim.mp4")
ck(reg3["mostReplayed"]["reason"] == "MOST_REPLAYED_EXTRACTION_FAILED",
   "metadado corrompido -> EXTRACTION_FAILED, nao excecao")
j4 = r.new_job()
r.finish(j4, 0, d3, True)
ck(j4["status"] == "completed", "download segue completo mesmo com heatmap falhando")


# 10. classificacao do erro (o 403 tem causa propria e instrucao propria)
ck(r.classify_error("ERROR: unable to download video data: HTTP Error 403: Forbidden")
   == "YOUTUBE_HTTP_403", "403 -> YOUTUBE_HTTP_403")
ck(r.classify_error("ERROR: Unsupported URL: https://x/y") == "YTDLP_EXTRACTION_FAILED",
   "URL sem extrator -> YTDLP_EXTRACTION_FAILED")
ck(r.classify_error("WARNING: no JS runtime available; install deno")
   == "YTDLP_RUNTIME_MISSING", "runtime ausente -> YTDLP_RUNTIME_MISSING")
ck(r.classify_error("ERROR: unknown network hiccup") == "YTDLP_DOWNLOAD_FAILED",
   "resto -> YTDLP_DOWNLOAD_FAILED")
j5 = r.new_job()
r.consume_line(j5, "ERROR: unable to download video data: HTTP Error 403: Forbidden")
r.finish(j5, 1, Path(tempfile.mkdtemp()), True)
ck(j5["errorCode"] == "YOUTUBE_HTTP_403", "o codigo acompanha o job")
ck("403" in j5["error"], "o texto original do yt-dlp continua visivel")
ck("winget upgrade" in j5["error"], "e o usuario recebe o que fazer a respeito")
ck("errorCode" in r.public(j5), "o codigo sai no /status")
argumentos = r.build_args("yt-dlp.exe", "https://www.youtube.com/watch?v=x", "C:\tmp")
ck("--js-runtimes" not in argumentos, "nenhum --js-runtimes: o deno instalado ja resolve")
ck(not any("player_client" in a for a in argumentos), "nenhum player_client especulativo")
ck(not any("cookie" in a for a in argumentos), "nenhum cookie de navegador")
ck("--write-info-json" in argumentos, "o .info.json do Mais reproduzidos segue intacto")
ck("--write-thumbnail" in argumentos, "a miniatura (fundo do 9:16) sai no MESMO comando")
ck("--convert-thumbnails" not in argumentos,
   "sem converter miniatura: exigiria FFmpeg no PATH do helper, e o do Estudio le .webp")
ck(not any("--exec" in a or "netrc" in a or "aria2c" in a for a in argumentos),
   "nada de --exec/--netrc/aria2c entrou junto (PESQUISA_FERRAMENTAS §10)")


# 11. acento no titulo nao pode virar U+FFFD no nome do arquivo
a11 = r.build_args("yt-dlp.exe", "https://www.youtube.com/watch?v=x", "C:\tmp")
ck("--encoding" in a11 and a11[a11.index("--encoding") + 1] == "utf-8",
   "o yt-dlp e obrigado a falar utf-8 no pipe")
d11 = Path(tempfile.mkdtemp())
nome_ok = "Poderosíssimo.webm"
(d11 / nome_ok).write_bytes(b"x")
(d11 / "Poderosíssimo.info.json").write_text(json.dumps({"id": "z1", "duration": 5}),
                                                 encoding="utf-8")
reg11 = r.save_most_replayed(d11, nome_ok)
ck((d11 / "Poderosíssimo.mostreplayed.json").exists(),
   "o sidecar nasce com o MESMO nome acentuado do video")
ck("�" not in "".join(p.name for p in d11.iterdir()),
   "nenhum nome de arquivo com caractere de substituicao")
ck(reg11["videoId"] == "z1", "e leu o .info.json certo pelo nome acentuado")

# 12. sidecar v2: audiencia + legenda, do MESMO .info.json, sem chamada extra ao yt-dlp
import http.server
import json as _json
import threading

d12 = Path(tempfile.mkdtemp())
(d12 / "v.mp4").write_bytes(b"x")
PICOS = [{"start_time": i * 6, "end_time": i * 6 + 6,
          "value": (0.9 if i in (5, 6) else 0.1)} for i in range(100)]
FALAS = {"events": [{"tStartMs": 1000, "dDurationMs": 2000, "segs": [{"utf8": "primeira"}]},
                    {"tStartMs": 4000, "dDurationMs": 2000, "segs": [{"utf8": "segunda"}]}]}


# Servidor de legenda de mentira: json3 servido do proprio 127.0.0.1, sem tocar a internet.
class _Legenda(http.server.BaseHTTPRequestHandler):
    corpo = _json.dumps(FALAS).encode("utf-8")

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/vazio":
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Length", str(len(self.corpo)))
        self.end_headers()
        self.wfile.write(self.corpo)


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Legenda)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE_LEG = "http://127.0.0.1:%d" % srv.server_address[1]


def info(subs=None, autos=None):
    return {"id": "abcdefghijk", "duration": 600, "webpage_url": "https://y/x",
            "heatmap": PICOS, "subtitles": subs or {}, "automatic_captions": autos or {}}


def grava(pasta, nome, dados):
    (pasta / (Path(nome).stem + ".info.json")).write_text(json.dumps(dados), encoding="utf-8")


try:
    # 12a. legenda MANUAL em pt-BR disponivel
    grava(d12, "v.mp4", info(subs={"pt-BR": [{"ext": "json3", "url": BASE_LEG + "/ok"}]}))
    reg = r.save_most_replayed(d12, "v.mp4")
    # Era 3 ate a legenda passar a guardar o tempo por PALAVRA: `captions.words` chegou no
    # v4, e e o que deixa a legenda do 9:16 quebrar no limite da palavra em vez de na janela
    # rolante do YouTube. Sidecar v1/v2/v3 ja gravado continua valendo do outro lado (le como
    # "sem palavra" e cai na cue grossa) -- ninguem rebaixa video para migrar formato.
    ck(reg["version"] == 5, "o sidecar declara a versao 5")
    ck(len(reg["captions"]["words"]) == 2 and reg["captions"]["words"][0]["start"] == 1.0,
       "e as palavras da legenda foram junto, no relogio do VIDEO")
    ck(reg["mostReplayed"]["available"], "a audiencia continua saindo igual")
    ck(reg["captions"]["available"], "e a legenda entrou no sidecar")
    ck(reg["captions"]["language"] == "pt-BR", "com o idioma registrado")
    ck(reg["captions"]["kind"] == "manual", "e a origem (manual x automatica)")
    ck(len(reg["captions"]["cues"]) == 2, "as duas falas foram parseadas")
    ck(reg["captions"]["cues"][0]["start"] == 1.0, "no relogio do VIDEO, em segundos")
    gravado = json.loads((d12 / "v.mostreplayed.json").read_text(encoding="utf-8"))
    ck(gravado["captions"]["cues"][0]["text"] == "primeira", "e chegaram ao arquivo")
    ck(gravado["captions"]["words"][1]["text"] == "segunda",
       "as palavras tambem chegaram ao arquivo (v4)")

    # 12b. so legenda AUTOMATICA em pt: vale, e a origem e dita
    grava(d12, "v.mp4", info(autos={"pt": [{"ext": "json3", "url": BASE_LEG + "/ok"}]}))
    auto = r.save_most_replayed(d12, "v.mp4")
    ck(auto["captions"]["available"] and auto["captions"]["kind"] == "automatica",
       "legenda automatica e usada, e identificada como automatica")

    # 12c. IDIOMA manda sobre a origem: pt automatica ganha de espanhol manual
    grava(d12, "v.mp4", info(subs={"es": [{"ext": "json3", "url": BASE_LEG + "/ok"}]},
                             autos={"pt": [{"ext": "json3", "url": BASE_LEG + "/ok"}]}))
    mista = r.save_most_replayed(d12, "v.mp4")
    ck(mista["captions"]["language"] == "pt",
       "portugues automatico ganha de espanhol manual (o corte e em PT-BR)")

    # 12c-bis. MINIATURA: e o arquivo no disco que manda, e sai so o NOME (nunca o caminho).
    grava(d12, "v.mp4", info(subs={"pt-BR": [{"ext": "json3", "url": BASE_LEG + "/ok"}]}))
    ck(r.save_most_replayed(d12, "v.mp4")["thumbnail"] == "",
       "sem arquivo de miniatura no disco, o sidecar registra vazio (fundo desfocado de antes)")
    (d12 / "v.webp").write_bytes(b"RIFF0000WEBP")
    com_thumb = r.save_most_replayed(d12, "v.mp4")
    ck(com_thumb["thumbnail"] == "v.webp", "com a miniatura gravada, o sidecar aponta o NOME dela")
    ck("/" not in com_thumb["thumbnail"] and "\\" not in com_thumb["thumbnail"],
       "e nunca um caminho: quem resolve a pasta e o Estudio, com guarda de travessia")
    # Heatmap ilegivel nao pode custar o fundo do 9:16: sao dados independentes.
    (d12 / "v.info.json").write_text("{nao e json", encoding="utf-8")
    ck(r.save_most_replayed(d12, "v.mp4")["thumbnail"] == "v.webp",
       "info.json torto derruba a audiencia, nao a miniatura")
    (d12 / "v.webp").unlink()

    # 12d. sem faixa nenhuma: nao e erro, e o motivo e distinto
    grava(d12, "v.mp4", info())
    sem = r.save_most_replayed(d12, "v.mp4")
    ck(sem["captions"]["available"] is False, "video sem legenda nao ganha legenda")
    ck(sem["captions"]["reason"] == "CAPTIONS_NOT_AVAILABLE", "com o motivo 'nao publica'")
    ck(sem["mostReplayed"]["available"], "e a audiencia NAO e afetada pela falta de legenda")

    # 12e. faixa existe mas o GET falha: motivo DIFERENTE do anterior
    grava(d12, "v.mp4", info(subs={"pt": [{"ext": "json3", "url": BASE_LEG + "/vazio"}]}))
    falhou = r.save_most_replayed(d12, "v.mp4")
    ck(falhou["captions"]["reason"] == "CAPTIONS_EXTRACTION_FAILED",
       "falha ao buscar a legenda NAO se confunde com 'video nao publica'")
    ck(falhou["mostReplayed"]["available"], "e o grafico continua chegando mesmo assim")

    # 12f. json3 malformado: degrada, nunca derruba o import do video
    class _Torto(_Legenda):
        corpo = b"isto nao eh json {["

    srv2 = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Torto)
    threading.Thread(target=srv2.serve_forever, daemon=True).start()
    grava(d12, "v.mp4", info(subs={"pt": [{"ext": "json3", "url": "http://127.0.0.1:%d/x"
                                                                  % srv2.server_address[1]}]}))
    torto = r.save_most_replayed(d12, "v.mp4")
    ck(torto["captions"]["reason"] == "CAPTIONS_EXTRACTION_FAILED",
       "legenda ilegivel vira falha de extracao, nao excecao")
    ck(torto["mostReplayed"]["available"], "e o video segue para os cortes assim mesmo")
    srv2.shutdown()

    # 12g. sem .info.json: os DOIS blocos falham, cada um com o seu codigo
    d12b = Path(tempfile.mkdtemp())
    (d12b / "v.mp4").write_bytes(b"x")
    orfao = r.save_most_replayed(d12b, "v.mp4")
    ck(orfao["mostReplayed"]["reason"] == "MOST_REPLAYED_EXTRACTION_FAILED",
       "sem .info.json a audiencia reporta falha de extracao")
    ck(orfao["captions"]["reason"] == "CAPTIONS_EXTRACTION_FAILED",
       "e a legenda tambem, em vez de fingir 'nao publica'")
    ck(orfao["version"] == 5, "o sidecar de falha tambem declara a versao")
    ck(orfao["captions"]["words"] == [],
       "e a chave das palavras existe vazia, em vez de faltar")
    ck(orfao["thumbnail"] == "", "e a chave da miniatura existe mesmo no sidecar de falha")

    # 12h. o RESUMO que vai para o popup nao carrega a transcricao inteira
    grava(d12, "v.mp4", info(subs={"pt-BR": [{"ext": "json3", "url": BASE_LEG + "/ok"}]}))
    trabalho = r.new_job()
    trabalho["filename"] = "v.mp4"
    r.finish(trabalho, 0, d12, True)
    publico = r.public(trabalho)
    ck(publico["captions"]["count"] == 2, "o popup recebe a CONTAGEM de falas")
    ck("cues" not in publico["captions"], "e nunca o texto delas")
    ck(publico["mostReplayed"]["available"], "junto da audiencia, como antes")
finally:
    srv.shutdown()


# 13. TikTok: a URL que vai para o yt-dlp e REMONTADA do id, nunca a string colada
import tiktok as tk

ck(tk.analisa("https://www.tiktok.com/@perfil/video/7000000000000000000")["url"]
   == "https://www.tiktok.com/@perfil/video/7000000000000000000", "link completo")
ck(tk.analisa("https://m.tiktok.com/@perfil/video/7000000000000000000?is_from_webapp=1")["url"]
   == "https://www.tiktok.com/@perfil/video/7000000000000000000",
   "host mobile e parametro de rastreio somem na remontagem")
ck(tk.analisa("https://www.tiktok.com/share/video/7000000000000000000")["tipo"] == "video",
   "forma /share/video/")
ck(tk.analisa("https://www.tiktok.com/embed/7000000000000000000")["tipo"] == "video",
   "forma /embed/")
ck(tk.analisa("https://vm.tiktok.com/ZTR45GpSF/")["tipo"] == "curto", "link curto vm.")
ck(tk.analisa("https://www.tiktok.com/t/ZTR45GpSF/")["tipo"] == "curto", "link curto /t/")
ck(tk.analisa("https://www.tiktok.com/@p/photo/7000000000000000000")["tipo"] == "foto",
   "publicacao de fotos e um tipo RECONHECIDO e recusado, nao lixo")
for ruim in ("https://tiktok.com.golpe.net/@x/video/7000000000000000000",
             "https://www.tiktok.com/@perfil", "https://www.tiktok.com/tag/algo",
             "https://www.tiktok.com/@p/video/12", "javascript:alert(1)",
             "file:///c:/x", "https://www.youtube.com/watch?v=abc", "", None, 123,
             "https://www.tiktok.com/@p/video/7000000000000000000" + chr(0)):
    ck(tk.analisa(ruim)["tipo"] == "", "recusa %.44s" % str(ruim))

# canoniza(): link curto resolve com salto CONTADO, e so dentro do TikTok
ck(tk.canoniza("https://www.tiktok.com/@p/video/7000000000000000000")
   == ("https://www.tiktok.com/@p/video/7000000000000000000", ""),
   "link completo nao gasta requisicao nenhuma")

saltos = []


def salto_falso(destinos):
    fila = list(destinos)

    def _salto(url):
        saltos.append(url)
        return fila.pop(0) if fila else ""
    return _salto


ck(tk.canoniza("https://vm.tiktok.com/ZABC1234",
               salto_falso(["https://www.tiktok.com/@p/video/7000000000000000000?x=1"]))
   == ("https://www.tiktok.com/@p/video/7000000000000000000", ""),
   "link curto vira o endereco canonico do video")
ck(saltos == ["https://vm.tiktok.com/ZABC1234"], "e gastou UM pedido, na URL remontada")

ck(tk.canoniza("https://vm.tiktok.com/ZABC1234", salto_falso(["https://www.tiktok.com/?_r=1"]))
   == ("", tk.CURTO_MORTO),
   "link curto expirado (o caso real: cai na home) tem motivo proprio")
ck(tk.canoniza("https://vm.tiktok.com/ZABC1234",
               salto_falso(["https://evil.example/@p/video/7000000000000000000"]))
   == ("", tk.CURTO_MORTO),
   "redirecionamento para FORA do TikTok encerra a resolucao")
saltos.clear()
ck(tk.canoniza("https://vm.tiktok.com/ZABC1234",
               salto_falso(["https://vt.tiktok.com/ZLOOP123"] * 9))[1] == tk.CURTO_FALHOU,
   "cadeia infinita de redirecionamento para de saltar")
ck(len(saltos) == tk.MAX_SALTOS, "no maximo %d saltos, sempre" % tk.MAX_SALTOS)


def salto_explode(_url):
    raise OSError("conexao recusada")


ck(tk.canoniza("https://vm.tiktok.com/ZABC1234", salto_explode) == ("", tk.CURTO_FALHOU),
   "rede fora do ar vira motivo, nao excecao")
ck(tk.canoniza("https://www.tiktok.com/@p/photo/7000000000000000000")[1]
   == tk.TIPO_NAO_SUPORTADO, "foto tem motivo proprio")
ck(tk.canoniza("https://vimeo.com/1")[1] == tk.URL_NAO_TIKTOK, "e nao-TikTok tem outro")
for cod in (tk.URL_NAO_TIKTOK, tk.TIPO_NAO_SUPORTADO, tk.CURTO_MORTO, tk.CURTO_FALHOU):
    ck(cod in tk.MOTIVOS and len(tk.MOTIVOS[cod]) > 20,
       "todo motivo tem frase para o operador: " + cod)


# 14. marca d'agua: so o que o extrator DECLAROU vira afirmacao
ck(tk.marca_dagua({"format_id": "download", "format_note": "watermarked"})[0] == tk.COM_MARCA,
   "o rotulo do caminho web e lido")
ck(tk.marca_dagua({"format_id": "download_addr", "format_note": "Download video, watermarked"})[0]
   == tk.COM_MARCA, "e o do caminho da API tambem")
ck(tk.marca_dagua({"format_id": "download_addr", "format_note": "Download video"})[0]
   == tk.SEM_MARCA, "has_watermark=false do proprio TikTok e prova de ausencia")
ck(tk.marca_dagua({"format_id": "h264_720p_1052500-0", "format_note": None})[0]
   == tk.DESCONHECIDA,
   "play addr NAO vira 'sem marca': o extrator nao diz nada sobre ele")
ck(tk.marca_dagua({"format_id": "bytevc1_1080p_795937-0", "vcodec": "h265",
                   "ext": "mp4", "height": 1920})[0] == tk.DESCONHECIDA,
   "resolucao, codec e extensao NAO sao evidencia de nada")
for estado in (tk.COM_MARCA, tk.SEM_MARCA, tk.DESCONHECIDA):
    ck(len(tk.FRASE[estado]) > 10, "todo estado tem frase: " + estado)

# 15. escolha de formato: a variante marcada nunca e escolhida sozinha
DUMP = {"id": "7000000000000000000", "title": "Corte", "uploader": "perfil",
        "webpage_url": "https://www.tiktok.com/@perfil/video/7000000000000000000",
        "duration": 58, "thumbnail": "https://cdn/x.jpeg",
        "formats": [
            {"format_id": "audio", "ext": "mp3", "vcodec": "none", "acodec": "mp3"},
            {"format_id": "download", "format_note": "watermarked", "ext": "mp4",
             "vcodec": "h264", "acodec": "aac"},
            {"format_id": "h264_720p-0", "vcodec": "h264", "acodec": "aac",
             "width": 720, "height": 1280, "tbr": 1052, "filesize": 7701278},
            {"format_id": "h264_720p-1", "vcodec": "h264", "acodec": "aac",
             "width": 720, "height": 1280, "tbr": 1052, "filesize": 7701278},
            {"format_id": "bytevc1_1080p", "vcodec": "h265", "acodec": "none",
             "width": 1080, "height": 1920, "tbr": 795},
        ]}
lista = tk.formatos(DUMP)
ck([f["id"] for f in lista] == ["h264_720p-0", "bytevc1_1080p", "download"],
   "ordem: com audio e mais alto primeiro, marcado por ultimo")
ck(len(lista) == 3, "a renderizacao repetida (-0 e -1) conta uma vez so")
ck(all(f["id"] != "audio" for f in lista), "faixa so de audio nao e opcao de video")
ck(tk.escolhe(lista) == "h264_720p-0", "a escolha automatica NAO e a variante marcada")
ck(tk.escolhe([f for f in lista if f["marca"] == tk.COM_MARCA]) == "",
   "so havendo variante marcada, a escolha automatica se recusa a escolher")
semaudio = [f for f in lista if f["id"] == "bytevc1_1080p"][0]
ck(semaudio["spec"] == "bytevc1_1080p+ba/bytevc1_1080p",
   "formato sem audio proprio junta a melhor faixa de audio, em vez de sair mudo")
ck(lista[0]["spec"] == "h264_720p-0", "e formato com audio baixa como esta, sem remux")
ck("7.3 MB" in lista[0]["rotulo"] and "720x1280" in lista[0]["rotulo"],
   "o rotulo diz resolucao e tamanho")
ck("marca d'água não confirmada" in lista[0]["rotulo"],
   "e nao esconde que a marca d'agua nao foi confirmada")
res = tk.resumo(DUMP)
ck(res["videoId"] == "7000000000000000000" and res["criador"] == "perfil"
   and res["duracao"] == 58.0 and res["thumbnail"].startswith("https://"),
   "o resumo leva id, criador, duracao e miniatura")
ck(res["soComMarca"] is False, "com variante limpa disponivel, soComMarca e falso")
so_marcado = dict(DUMP, formats=[{"format_id": "download", "format_note": "watermarked",
                                  "vcodec": "h264", "acodec": "aac"}])
ck(tk.resumo(so_marcado)["soComMarca"] is True,
   "so havendo variante marcada, o estado e DITO em vez de deduzido do vazio")
vazio_res = tk.resumo({"formats": []})
ck(vazio_res["soComMarca"] is False and vazio_res["escolhido"] == "",
   "sem formato nenhum, 'todas tem marca' seria mentira")
ck(tk.resumo({})["titulo"] == "" and tk.resumo({})["duracao"] == 0.0,
   "metadado ausente fica ausente, nao inventado")


# 16. comando do download: formato e nome de arquivo do TikTok
args = r.build_args("yt-dlp.exe", "https://www.tiktok.com/@p/video/7000000000000000000",
                    "C:\\tmp", "h264_720p-0", "%(uploader)s-%(id)s.%(ext)s")
ck(args[-2] == "--" and args[-1].startswith("https://www.tiktok.com/"),
   "a URL continua depois do --, onde nao pode virar opcao")
ck(args[args.index("-f") + 1] == "h264_720p-0", "o -f leva o formato escolhido")
ck(args[args.index("-o") + 1] == "%(uploader)s-%(id)s.%(ext)s",
   "e o nome sai do id, que e estavel e unico por video")
ck(all(isinstance(a, str) for a in args), "tudo e lista de argumentos, nunca string de shell")
antigo = r.build_args("yt-dlp.exe", "https://www.youtube.com/watch?v=abc", "C:\\tmp")
ck("-f" not in antigo and antigo[antigo.index("-o") + 1] == "%(title)s.%(ext)s",
   "sem formato pedido, o comando do YouTube fica IGUAL ao de antes")


# 17. a miniatura nunca pode ser confundida com o video (o TikTok grava .image)
d13 = Path(tempfile.mkdtemp())
(d13 / "v.mp4").write_bytes(b"x")
for sobra in ("v.image", "v.webp", "v.jpg", "v.info.json", "v.mp4.part"):
    (d13 / sobra).write_bytes(b"x")
ck(r.newest_file(d13) == "v.mp4",
   "com miniatura .image mais nova na pasta, o fallback ainda acha o VIDEO")
ck(".image" in r.THUMB_EXTS, "e o .image conta como miniatura para o sidecar")
(d13 / "v.webp").unlink()
(d13 / "v.jpg").unlink()  # sobra so a capa do TikTok
(d13 / "v.info.json").write_text(json.dumps({
    "id": "7000000000000000000", "title": "Corte", "uploader": "perfil",
    "extractor_key": "TikTok", "duration": 58,
    "webpage_url": "https://www.tiktok.com/@perfil/video/7000000000000000000",
    "format_id": "h264_720p-0",
}), encoding="utf-8")
tt = r.save_most_replayed(d13, "v.mp4")
ck(tt["thumbnail"] == "v.image", "a miniatura do TikTok entra no sidecar")
ck(tt["source"] == "TikTok" and tt["creator"] == "perfil" and tt["title"] == "Corte",
   "a procedencia guarda fonte, criador e titulo")
ck(tt["filename"] == "v.mp4" and tt["videoId"] == "7000000000000000000",
   "com o nome do arquivo e o id estavel")
ck(tt["sourceUrl"] == "https://www.tiktok.com/@perfil/video/7000000000000000000",
   "e o link canonico de origem")
ck(re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", tt["downloadedAt"]),
   "o instante do download e ISO 8601 em UTC")
ck(tt["watermark"]["status"] == tk.DESCONHECIDA,
   "marca d'agua do arquivo salvo: play addr sai DESCONHECIDA, nunca 'sem marca'")
ck(tt["watermark"]["formatId"] == "h264_720p-0", "com o formato que virou arquivo")
ck(len(tt["watermark"]["evidence"]) > 10, "e com a evidencia por escrito")

(d13 / "v.info.json").write_text(json.dumps({
    "id": "x", "extractor_key": "TikTok", "format_id": "download",
    "format_note": "watermarked",
}), encoding="utf-8")
ck(r.save_most_replayed(d13, "v.mp4")["watermark"]["status"] == tk.COM_MARCA,
   "baixar a variante marcada e registrado COMO marcada")
(d13 / "v.info.json").write_text(json.dumps({
    "id": "abc", "extractor_key": "Youtube", "format_id": "137+140",
}), encoding="utf-8")
ck(r.save_most_replayed(d13, "v.mp4")["watermark"]["status"] == tk.NAO_SE_APLICA,
   "fora do TikTok o campo diz 'nao se aplica', em vez de inventar duvida")

d14 = Path(tempfile.mkdtemp())
(d14 / "v.mp4").write_bytes(b"x")
orf = r.save_most_replayed(d14, "v.mp4")
ck(orf["watermark"]["status"] == tk.DESCONHECIDA,
   "sem .info.json a marca d'agua e DESCONHECIDA, nunca omitida")
ck(orf["downloadedAt"].endswith("Z"), "e o sidecar de falha tambem data o download")


# 18. o popup fala dos MESMOS estados que o helper emite (constante espelhada, BP-014)
POPUP = (Path(__file__).resolve().parents[1] / "extension" / "popup.js").read_text(
    encoding="utf-8")
for estado in (tk.COM_MARCA, tk.SEM_MARCA, tk.DESCONHECIDA, tk.NAO_SE_APLICA):
    ck("'%s'" % estado in POPUP,
       "o popup sabe traduzir o estado '%s' que o helper emite" % estado)


# 20. desafio anti-bot do TikTok: a busca e o download REPETEM; erro permanente nao
ck(r.e_desafio("ERROR: [TikTok] 7680281054460038420: Unable to extract universal data for "
               "rehydration; please report this issue on ..."),
   "o desafio do TikTok e reconhecido como transitorio")
for permanente in ("ERROR: Video unavailable", "ERROR: [TikTok] 1: private video",
                   "ERROR: Unsupported URL: https://x.com/1", "", None):
    ck(not r.e_desafio(permanente), f"erro permanente nao pode virar repeticao: {permanente!r}")

_DESAFIO = ["ERROR: [TikTok] 7680281054460038420: Unable to extract universal data for "
            "rehydration; please report this issue on ..."]


class _RespFalsa:
    def __init__(self, rc, linhas):
        self.returncode = rc
        self.stdout = "\n".join(linhas) if rc == 0 else ""
        self.stderr = "" if rc == 0 else "\n".join(linhas)


class _ProcFalso:
    def __init__(self, rc, linhas):
        self.returncode = rc
        self.stdout = iter(linhas)  # consume_line ja faz strip: linha sem \n serve

    def wait(self):
        return self.returncode


class _SubprocessFalso:
    """Substitui o modulo subprocess do runner: roteiro de respostas, processo nenhum."""
    PIPE = -1
    STDOUT = -2
    CREATE_NO_WINDOW = 0
    TimeoutExpired = TimeoutError

    def __init__(self, roteiro):
        self.roteiro = list(roteiro)
        self.chamadas = 0

    def _proxima(self):
        self.chamadas += 1
        return self.roteiro.pop(0)

    def run(self, *a, **k):
        return _RespFalsa(*self._proxima())

    def Popen(self, *a, **k):
        return _ProcFalso(*self._proxima())


_sub_real, _dir_real = r.subprocess, config.ensure_download_dir
_espera_real, r.ESPERA = r.ESPERA, 0
with tempfile.TemporaryDirectory() as _tmp:
    config.ensure_download_dir = lambda: Path(_tmp)
    try:
        falso = _SubprocessFalso([(1, _DESAFIO), (1, _DESAFIO), (0, ['{"id": "abc"}'])])
        r.subprocess = falso
        info, erro = r.inspect("https://www.tiktok.com/share/video/7680281054460038420")
        ck(erro is None and info == {"id": "abc"} and falso.chamadas == 3,
           "a busca repete o desafio do TikTok ate o TikTok responder")

        falso = _SubprocessFalso([(1, _DESAFIO)] * 9)
        r.subprocess = falso
        info, erro = r.inspect("https://www.tiktok.com/share/video/7680281054460038420")
        ck(info is None and falso.chamadas == r.TENTATIVAS and "rehydration" in (erro or ""),
           "com desafio em todas, a busca para em TENTATIVAS e devolve o erro do yt-dlp")

        falso = _SubprocessFalso([(1, ["ERROR: Video unavailable"]), (0, ["{}"])])
        r.subprocess = falso
        info, erro = r.inspect("https://www.tiktok.com/share/video/7680281054460038420")
        ck(info is None and falso.chamadas == 1 and "unavailable" in (erro or "").lower(),
           "erro permanente na busca nao gasta tentativa")

        # O ramo que quebra e o de quem JA tinha progresso na tentativa morta (BP-014): sem o
        # reset, a barra e o _err da primeira volta vazariam para a segunda.
        _alvo = Path(_tmp) / "v.mp4"
        falso = _SubprocessFalso([(1, ["@@PROG 40.0%"] + _DESAFIO),
                                  (1, _DESAFIO),
                                  (0, ["@@PROG 100.0%", "@@FILE %s" % _alvo])])
        r.subprocess = falso
        trabalho = r.new_job()
        r._run(trabalho, "yt-dlp.exe", "https://www.tiktok.com/share/video/7680281054460038420")
        ck(falso.chamadas == 3, "o download repete o desafio do TikTok")
        ck(trabalho["status"] == "completed" and trabalho["error"] is None
           and trabalho["filename"] == "v.mp4",
           "e termina concluido, sem o erro nem o progresso da tentativa morta")

        falso = _SubprocessFalso([(1, _DESAFIO)] * 9)
        r.subprocess = falso
        trabalho = r.new_job()
        r._run(trabalho, "yt-dlp.exe", "https://www.tiktok.com/share/video/7680281054460038420")
        ck(falso.chamadas == r.TENTATIVAS and trabalho["status"] == "error"
           and trabalho["errorCode"] == "YTDLP_EXTRACTION_FAILED",
           "esgotadas as tentativas, o download falha com o erro de verdade")

        falso = _SubprocessFalso([(1, ["ERROR: Video unavailable"]), (0, [])])
        r.subprocess = falso
        trabalho = r.new_job()
        r._run(trabalho, "yt-dlp.exe", "https://www.tiktok.com/share/video/7680281054460038420")
        ck(falso.chamadas == 1 and trabalho["status"] == "error",
           "erro permanente no download nao gasta tentativa")
    finally:
        r.subprocess, config.ensure_download_dir = _sub_real, _dir_real
        r.ESPERA = _espera_real


# 19. as rotas novas, pela rede -- com o yt-dlp de mentira
import http.client
import threading as _th

_infos = {"https://www.tiktok.com/@perfil/video/7000000000000000000": DUMP}
_iniciados = []


def _inspect_falso(url):
    if url in _infos:
        return _infos[url], None
    return None, "Vídeo indisponível ou privado."


def _start_falso(url, spec=None, outtmpl=None, source_url=None):
    _iniciados.append({"url": url, "spec": spec, "outtmpl": outtmpl})
    return {"id": "trabalho1", "status": "queued", "progress": 0}, None


r.inspect, r.start = _inspect_falso, _start_falso
r._active_id = None
casa = server.Servidor(("127.0.0.1", 0), server.Handler)
_th.Thread(target=casa.serve_forever, daemon=True).start()
PORTA = casa.server_address[1]


def pede(metodo, rota, corpo=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    c.request(metodo, rota, json.dumps(corpo) if corpo else None,
              {"Content-Type": "application/json"})
    resp = c.getresponse()
    dados = json.loads(resp.read() or b"{}")
    c.close()
    return resp.status, dados


try:
    codigo, corpo_resp = pede("GET", "/current")
    ck(codigo == 200 and corpo_resp == {},
       "helper sem download nenhum devolve vazio -- e nao um 'concluido' fantasma")

    codigo, corpo_resp = pede("POST", "/inspect", {"url": "https://vimeo.com/1"})
    ck(codigo == 400 and corpo_resp["errorCode"] == tk.URL_NAO_TIKTOK,
       "/inspect recusa URL que nao e do TikTok, com codigo proprio")
    codigo, corpo_resp = pede("POST", "/inspect",
                              {"url": "https://www.tiktok.com/@p/photo/7000000000000000000"})
    ck(codigo == 400 and corpo_resp["errorCode"] == tk.TIPO_NAO_SUPORTADO,
       "e recusa publicacao de fotos dizendo que e fotos")
    codigo, corpo_resp = pede("POST", "/inspect",
                              {"url": "https://www.tiktok.com/@outro/video/7999999999999999999"})
    ck(codigo == 502 and "indispon" in corpo_resp["error"],
       "falha de extracao vira 502 EXPLICITO, sem fallback inventado")

    codigo, insp = pede("POST", "/inspect",
                        {"url": "https://m.tiktok.com/@perfil/video/7000000000000000000?x=1"})
    ck(codigo == 200 and insp["url"]
       == "https://www.tiktok.com/@perfil/video/7000000000000000000",
       "/inspect devolve a URL canonica que sera baixada")
    ck(insp["escolhido"] == "h264_720p-0", "com a variante nao marcada pre-escolhida")

    codigo, corpo_resp = pede("POST", "/download", {
        "url": "https://www.tiktok.com/@perfil/video/7000000000000000000",
        "formatId": "inventado-pelo-cliente"})
    ck(codigo == 400 and not _iniciados,
       "formato que nao saiu da inspecao NAO vira -f: nenhum yt-dlp e iniciado")
    codigo, corpo_resp = pede("POST", "/download", {
        "url": "https://www.tiktok.com/@outro/video/7111111111111111111",
        "formatId": "h264_720p-0"})
    ck(codigo == 409 and not _iniciados,
       "baixar outro video sem ter buscado e recusado, em vez de baixar no escuro")

    codigo, corpo_resp = pede("POST", "/download", {
        "url": "https://www.tiktok.com/@perfil/video/7000000000000000000",
        "formatId": "bytevc1_1080p"})
    ck(codigo == 200 and corpo_resp["id"] == "trabalho1",
       "com formato valido, o download comeca")
    ck(_iniciados[-1]["spec"] == "bytevc1_1080p+ba/bytevc1_1080p",
       "e o -f e o spec MONTADO PELO HELPER, nao a string que chegou pela rede")
    ck(_iniciados[-1]["outtmpl"] == "%(uploader)s-%(id)s.%(ext)s",
       "com o nome de arquivo estavel do TikTok")

    codigo, corpo_resp = pede("POST", "/download",
                              {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
    ck(codigo == 200 and _iniciados[-1]["spec"] is None
       and _iniciados[-1]["outtmpl"] is None,
       "o YouTube segue pelo caminho de sempre: sem -f e sem -o novo")
finally:
    casa.shutdown()

print(f"OK {N} checagens")
