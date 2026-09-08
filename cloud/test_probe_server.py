#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Provas do servidor público da análise.

Roda sem rede e sem yt-dlp: `ytclip.probe` é substituído por um dublê. O que
importa aqui é o CONTRATO da resposta pública (o que nunca pode vazar), o mapa de
erro e a superfície HTTP — as três coisas que mudam quando o endpoint deixa de ser
localhost e passa a ser internet.

    py -3.12 cloud/test_probe_server.py
"""

import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import probe_server as ps   # noqa: E402
import worker               # noqa: E402

N = 0


def ok(label, cond):
    global N
    N += 1
    if not cond:
        raise AssertionError("FALHOU: %s" % label)


INFO = {
    "videoId": "aaaaaaaaaaa",
    "title": "Podcast de teste",
    "uploader": "Canal",
    "durationSec": "7639.0",          # o probe real às vezes devolve isto como string
    "url": "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    "note": "Este vídeo não publica “Mais reproduzidos”.",
    "captionLang": "pt",
    "captionKind": "automatica",
    "chapters": [{"start_time": 0, "title": "Abertura"}],
    "heatmap": [{"start_time": 0, "value": 1.0}],
    "cues": [{"start": 1.0, "end": 2.0, "text": "fala secreta um"}] * 3830,
}
CAND = {
    "inSec": 10.0, "outSec": 75.5, "durationSec": 65.5, "score": 84,
    "signals": ["heatmap"], "topic": "assunto", "hook": "gancho",
    "reason": "motivo", "contextWarning": "", "category": "business",
    "state": "candidate",
}


# ---------------------------------------------------------------- 1. o recorte
pay = ps.public_payload(INFO, [dict(CAND)])
blob = json.dumps(pay, ensure_ascii=False)

ok("1a payload tem só as 3 chaves de topo", sorted(pay) == ["candidates", "note", "video"])
ok("1b nenhuma fala vaza", "cues" not in blob and "fala secreta" not in blob)
ok("1c transcrição inteira não viaja: resposta é pequena", len(blob.encode()) < 2000)
ok("1d candidato tem exatamente os campos declarados",
   tuple(pay["candidates"][0]) == ps.CANDIDATE_FIELDS)
ok("1e `state` não viaja (resto do pipeline)", "state" not in pay["candidates"][0])
ok("1f `category` não viaja (palpite que não aparece na tela)",
   "category" not in pay["candidates"][0])
ok("1g durationSec string vira número", pay["video"]["durationSec"] == 7639.0)
ok("1h `note` é preservado (é estado que a tela de hoje já mostra)",
   pay["note"] == INFO["note"])
# "heatmap" APARECE no blob de propósito: é o nome de um sinal do candidato
# (signals: ["heatmap"]). O que não pode viajar são os 100 baldes e os capítulos —
# por isso a prova é estrutural, não por substring.
ok("1i os baldes do heatmap não viajam", "heatmap" not in pay and "value" not in blob)
ok("1j os capítulos não viajam", "chapters" not in pay and "start_time" not in blob)
ok("1k mas o SINAL heatmap continua chegando (é o chip da tela)",
   pay["candidates"][0]["signals"] == ["heatmap"])

ok("2a durationSec ausente não explode", ps.public_payload({}, [])["video"]["durationSec"] == 0.0)
ok("2b durationSec lixo não explode",
   ps.public_payload({"durationSec": "abc"}, [])["video"]["durationSec"] == 0.0)
ok("2c candidato sem campo vira None, não KeyError",
   ps.public_payload({}, [{}])["candidates"][0]["score"] is None)
ok("2d lista vazia é lista vazia", ps.public_payload({}, [])["candidates"] == [])
ok("2e título ausente vira string vazia, não None", ps.public_payload({}, [])["video"]["title"] == "")


# --------------------------------------------------- 3. o download não existe aqui
# Asserir o TEXTO do arquivo reprovaria a documentação: o docstring diz, em
# português, para não trocar o subprocesso por `import yt_dlp` — e a substring
# passa a existir. Mesma armadilha já medida nos checks 16h-16k do test_ytclip.
# Então a prova é de COMPORTAMENTO. Estas armadilhas ficam armadas pelo resto do
# arquivo, inclusive durante a requisição HTTP real do bloco 7.
def _proibido(nome):
    def bomba(*a, **k):
        raise AssertionError("o servidor da analise chamou %s — nunca deveria" % nome)
    return bomba


ps.ytclip.fetch_section = _proibido("fetch_section")
ps.ytclip.produced_media = _proibido("produced_media")
ok("3a o pacote yt_dlp NÃO foi importado (o binário entra por subprocess)",
   "yt_dlp" not in sys.modules)
ok("3b o handler não herda servidor de arquivo",
   not any(c.__name__ == "SimpleHTTPRequestHandler" for c in ps.Handler.__mro__))
ok("3c e não tem translate_path (o servidor local tem, para /clips)",
   not hasattr(ps.Handler, "translate_path"))


# ------------------------------------------------------------- 4. o mapa de erro
def _raise(code, msg):
    def boom(*a, **k):
        raise worker.WorkerError(code, msg)
    return boom


real_probe, real_cands = ps.ytclip.probe, ps.ytclip.candidates
ps.TURNSTILE_SECRET = ""          # sem verificação nestes casos
OK_URL = "https://www.youtube.com/watch?v=aaaaaaaaaaa"

# URL torta é recusada pelo `video_id`, que é PURO e cuja mensagem é escrita para o
# usuário. Isso separa "o usuário errou" de "o upstream falhou" por ORIGEM, em vez
# de adivinhar a culpa pelo código de erro — o mesmo `job_invalid` cobre os dois.
st, body = ps.analyze("", "", "1.2.3.4")
ok("4a URL vazia vira 400", st == 400)
ok("4b com a frase do detector, literal", body["error"] == "Cole o endereço do vídeo.")
st, body = ps.analyze("https://vimeo.com/123", "", "1.2.3.4")
ok("4c outro site vira 400 dizendo qual", st == 400 and "vimeo.com" in body["error"])

ps.ytclip.probe = _raise("ffmpeg_failed", "O yt-dlp recusou: /app/segredo.conf linha 3")
st, body = ps.analyze(OK_URL, "", "1.2.3.4")
ok("4d falha de upstream vira 502, não 400", st == 502)
ok("4e o stderr CRU do yt-dlp NÃO vaza para o navegador",
   "segredo" not in body["error"] and "/app/" not in body["error"])
ok("4f e a frase que sai é a fixa, do conjunto fechado",
   body["error"] == ps.UPSTREAM["ffmpeg_failed"][1])

ps.ytclip.probe = _raise("job_invalid", "yt-dlp não encontrado no PATH.")
st, body = ps.analyze(OK_URL, "", "1.2.3.4")
ok("4g falha de AMBIENTE não vira 400 de culpa do usuário", st == 502)
ok("4h e não conta ao visitante como nossa máquina está montada",
   "PATH" not in body["error"])


def _explode(*a, **k):
    raise RuntimeError("interno com caminho C:/Users/segredo")


ps.ytclip.probe = _explode
st, body = ps.analyze(OK_URL, "", "1.2.3.4")
ok("4i erro inesperado vira 500", st == 500)
ok("4j detalhe interno NÃO vaza na resposta", "segredo" not in body["error"])

ps.ytclip.probe = lambda url, timeout=None: dict(INFO)
ps.ytclip.candidates = lambda info, limit=None: [dict(CAND)]
st, body = ps.analyze(OK_URL, "", "1.2.3.4")
ok("4k caminho feliz devolve 200", st == 200)
ok("4l e o payload é o recortado", sorted(body) == ["candidates", "note", "video"])
ok("4m o semáforo foi devolvido em todos os ramos acima",
   ps.GATE._value == ps.MAX_CONCURRENT)

for _ in range(ps.MAX_CONCURRENT):
    ps.GATE.acquire()
st, body = ps.analyze(OK_URL, "", "1.2.3.4")
ok("5a semáforo cheio vira 503, não fila infinita", st == 503)
ok("5b e diz o que fazer", "Tente" in body["error"])
for _ in range(ps.MAX_CONCURRENT):
    ps.GATE.release()


# -------------------------------------------------------------- 6. o portão fecha
ps.TURNSTILE_SECRET = "segredo-de-teste"
st, body = ps.analyze(OK_URL, "", "1.2.3.4")
ok("6a com portão ligado, sem token = 403", st == 403)
ok("6b e o probe nem foi chamado (403 antes do subprocesso)", "robô" in body["error"])

_real_urlopen = ps.urllib.request.urlopen


def _dead(*a, **k):
    raise urllib.error.URLError("verificador fora do ar")


ps.urllib.request.urlopen = _dead
ok("6c verificador fora do ar NÃO libera (fail closed)",
   ps.turnstile_ok("token-qualquer", "1.2.3.4") is False)


class _Resp:
    def __init__(self, payload):
        self.payload = payload

    def read(self, n=None):
        return json.dumps(self.payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


ps.urllib.request.urlopen = lambda *a, **k: _Resp({"success": True})
ok("6d token válido passa", ps.turnstile_ok("t", "1.2.3.4") is True)
ps.urllib.request.urlopen = lambda *a, **k: _Resp({"success": False})
ok("6e token recusado não passa", ps.turnstile_ok("t", "1.2.3.4") is False)
ps.urllib.request.urlopen = _real_urlopen
ps.TURNSTILE_SECRET = ""


# -------------------------------------------------------- 7. a superfície HTTP real
ps.ALLOWED_ORIGIN = "https://exemplo.test"
ps.ORIGINS = ["https://exemplo.test", "http://127.0.0.1:8090"]
srv = ThreadingHTTPServer(("127.0.0.1", 0), ps.Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % srv.server_address[1]


def call(path, data=None, method=None, raw=None, extra=None):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    cab = {"Content-Type": "application/json"} if body else {}
    cab.update(extra or {})
    req = urllib.request.Request(BASE + path, data=body, method=method, headers=cab)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)


st, body, hdr = call("/health")
ok("7a /health responde 200", st == 200)
ok("7b /health diz se o portão está ligado", json.loads(body)["turnstile"] == "off")
ok("7c CORS só para a origem configurada",
   hdr.get("Access-Control-Allow-Origin") == "https://exemplo.test")
ok("7d e não é curinga", hdr.get("Access-Control-Allow-Origin") != "*")

st, _, _ = call("/")
ok("7e rota desconhecida é 404", st == 404)
st, _, _ = call("/clips/index.html")
ok("7f não existe caminho de arquivo (o local tem /clips, este não)", st == 404)
st, _, _ = call("/probe", data={"url": "u"}, method="GET")
ok("7g GET /probe é 404 (só POST)", st == 404)

st, body, hdr = call("/probe", data={"url": OK_URL})
ok("7h POST /probe funciona", st == 200)
ok("7i e devolve o payload recortado", "cues" not in body)
ok("7j o cabeçalho Server não anuncia a versão do Python",
   "Python/" not in (hdr.get("Server") or ""))

st, _, _ = call("/probe", raw=b"x" * (ps.MAX_BODY + 1))
ok("7k corpo grande demais é 413, não é lido", st == 413)
st, body, _ = call("/probe", raw=b"nao sou json")
ok("7l corpo torto é 400", st == 400)
st, body, _ = call("/probe", raw=b'"sou string"')
ok("7m JSON que não é objeto é 400", st == 400)
ok("7n o token do Turnstile CABE no corpo (2048 chars + envelope)",
   ps.MAX_BODY >= 2048 + 200)

st, _, hdr = call("/probe", method="OPTIONS")
ok("7o preflight responde 204", st == 204)
ok("7p preflight declara POST", "POST" in (hdr.get("Access-Control-Allow-Methods") or ""))


# ------------------------------------------- 8. framing: socket cru, não urllib
# Estes três nasceram de defeito REPRODUZIDO, não deduzido. urllib não os alcança
# porque ele sempre manda o corpo e nunca reusa a conexão do jeito errado.
import socket   # noqa: E402


def bruto(payload, espera=3.0, antes=None):
    """Manda bytes crus num socket só e devolve tudo que voltar até fechar."""
    s = socket.create_connection(srv.server_address, timeout=espera)
    try:
        if antes:
            antes()
        s.sendall(payload)
        s.settimeout(espera)
        out = b""
        while True:
            try:
                chunk = s.recv(4096)
            except socket.timeout:
                return out, False        # ainda aberto: ninguém fechou
            if not chunk:
                return out, True         # servidor fechou a conexão
            out += chunk
    finally:
        s.close()


# 8a-8c — CL.0 / response-queue desync. O corpo de uma requisição RECUSADA não é
# lido; com keep-alive ele viraria a requisição seguinte, e o servidor responderia
# DUAS vezes numa conexão só. Atrás de CDN (o código lê CF-Connecting-IP) isso é
# resposta de um visitante entregue a outro.
CONTRA = b"GET /health HTTP/1.1\r\nHost: x\r\n\r\n"
out, fechou = bruto(b"POST /nao-existe HTTP/1.1\r\nHost: x\r\nContent-Length: "
                    + str(len(CONTRA)).encode() + b"\r\n\r\n" + CONTRA)
ok("8a rota errada responde UMA vez, não duas", out.count(b"HTTP/1.1 ") == 1)
ok("8b e o corpo forjado não foi executado como requisição", b'"ok": true' not in out)
ok("8c e a conexão fecha em vez de servir lixo ao próximo", fechou)

out, fechou = bruto(b"POST /probe HTTP/1.1\r\nHost: x\r\nContent-Length: "
                    + str(ps.MAX_BODY + len(CONTRA) + 1).encode() + b"\r\n\r\n" + CONTRA)
ok("8d o 413 também responde uma vez só", out.count(b"HTTP/1.1 ") == 1 and b"413" in out)

# 8e — a rota irmã. O conserto mora no _json, então do_GET herda de graça.
out, _ = bruto(b"GET /nao-existe HTTP/1.1\r\nHost: x\r\nContent-Length: "
               + str(len(CONTRA)).encode() + b"\r\n\r\n" + CONTRA)
ok("8e do_GET com corpo também responde uma vez só", out.count(b"HTTP/1.1 ") == 1)

# 8f — sem Content-Length não há teto de tamanho; recusar por escrito.
out, _ = bruto(b"POST /probe HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n")
ok("8f chunked é recusado com 411, não lido sem teto", b"411" in out)

# 8g — Slowloris: Content-Length anunciado e corpo nunca enviado. Sem `timeout` na
# classe, o stdlib não põe prazo em read nenhum e a thread fica presa PARA SEMPRE,
# sem passar pelo Turnstile nem pelo semáforo (o corpo é lido antes dos dois).
ok("8g a classe declara timeout de socket", isinstance(ps.Handler.timeout, (int, float)))
_antigo = ps.Handler.timeout
ps.Handler.timeout = 1                      # 30s é o valor real; 1s para o teste
try:
    out, fechou = bruto(b"POST /probe HTTP/1.1\r\nHost: x\r\nContent-Length: 2000\r\n\r\n",
                        espera=6.0)
    ok("8h corpo que nunca chega derruba a conexão em vez de prender a thread", fechou)
finally:
    ps.Handler.timeout = _antigo

# ---------------- 9. duas origens: a página local E a publicada no Vercel
# A mesma página roda em http://127.0.0.1:8090 e em https://…vercel.app, e o motor
# fica sempre na máquina do operador. Uma origem só obrigaria a reiniciar o
# servidor para trocar de página.
_, _, hdr = call("/health", extra={"Origin": "http://127.0.0.1:8090"})
ok("9a a origem local é ecoada",
   hdr.get("Access-Control-Allow-Origin") == "http://127.0.0.1:8090")
_, _, hdr = call("/health", extra={"Origin": "https://exemplo.test"})
ok("9b a origem publicada também", hdr.get("Access-Control-Allow-Origin") == "https://exemplo.test")
_, _, hdr = call("/health", extra={"Origin": "https://site-invasor.com"})
ok("9c origem de fora NÃO é ecoada (o navegador rejeita a divergência)",
   hdr.get("Access-Control-Allow-Origin") == "https://exemplo.test")
ok("9d e nunca vira curinga por acidente", hdr.get("Access-Control-Allow-Origin") != "*")
_, _, hdr = call("/health")
ok("9e cliente sem Origin (curl, monitor) ainda recebe resposta com cabeçalho",
   bool(hdr.get("Access-Control-Allow-Origin")))

# 9f-9g — Rede privada. Página HTTPS chamando 127.0.0.1 é requisição de rede
# privada; sem este cabeçalho o Chrome bloqueia e o JS recebe falha de rede
# genérica, indistinguível de "o motor está desligado".
_, _, hdr = call("/probe", method="OPTIONS", extra={
    "Origin": "https://exemplo.test",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Private-Network": "true",
})
ok("9f o preflight de rede privada é aceito",
   hdr.get("Access-Control-Allow-Private-Network") == "true")
_, _, hdr = call("/probe", method="OPTIONS", extra={"Origin": "https://exemplo.test"})
ok("9g e o cabeçalho não é enviado quando ninguém pediu",
   hdr.get("Access-Control-Allow-Private-Network") is None)
ok("9h o preflight libera GET também (é o /health que a página consulta)",
   "GET" in (call("/probe", method="OPTIONS")[2].get("Access-Control-Allow-Methods") or ""))

srv.shutdown()
ps.ytclip.probe, ps.ytclip.candidates = real_probe, real_cands

print("%d checks OK" % N)
