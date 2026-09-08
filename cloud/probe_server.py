#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Servidor público da ANÁLISE — Fase 1 do lançamento.

Uma rota de trabalho: `POST /probe`. Lê metadados públicos, capítulos, legenda e
o gráfico "Mais reproduzidos" de um vídeo do YouTube e devolve os trechos
sugeridos. **Nenhum byte de mídia é baixado aqui.**

`ytclip.fetch_section` (que baixa) está no módulo importado e NÃO é exposto de
propósito: baixar mídia de terceiro é o passo que exige autorização do criador, e
ele continua na máquina do operador, no Estúdio local.

Stdlib puro, como o resto do `video-worker/`. O yt-dlp entra como PROCESSO
(`ytclip._run` chama o binário do PATH), nunca como pacote importado — não trocar
por `import yt_dlp`.
"""

import json
import os
import sys
import threading
import traceback
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# No container tudo é copiado achatado em /app; localmente o módulo mora ao lado.
_WORKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "video-worker")
if os.path.isdir(_WORKER):
    sys.path.insert(0, _WORKER)

import worker   # noqa: E402  (WorkerError: erro previsto, com mensagem pronta p/ o usuário)
import ytclip   # noqa: E402

PORT = int(os.environ.get("PORT", "8080"))
# Lista separada por vírgula. São DUAS na prática: a página servida localmente
# (http://127.0.0.1:8090) e a publicada (https://<projeto>.vercel.app). Uma origem
# só obrigaria a reiniciar o servidor para trocar de página.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "").strip()
ORIGINS = [o.strip() for o in ALLOWED_ORIGIN.split(",") if o.strip()]
TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET", "").strip()
DEV = os.environ.get("CLIPS_DEV", "") == "1"
PROBE_TIMEOUT = float(os.environ.get("PROBE_TIMEOUT", "90"))
MAX_CANDIDATES = int(os.environ.get("MAX_CANDIDATES", "12"))
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT", "4"))

# Corpo é `{"url": "...", "token": "..."}`. O teto existe para não ler corpo
# ilimitado — mas 2048 era MENOR que o corpo que o próprio servidor exige: o token
# do Turnstile vai a ~2048 caracteres, então uma requisição legítima levava 413.
MAX_BODY = int(os.environ.get("MAX_BODY", "8192"))
TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

# Conjunto FECHADO de desfecho de upstream. O `message` do `ffmpeg_failed` carrega
# a última linha CRUA do stderr do yt-dlp (até 400 chars) — devolvê-la ao navegador
# publica detalhe da nossa infraestrutura. O detalhe vai ao log; o usuário recebe
# frase escrita para ele. Mesmo princípio do CAPTION_STATES do serve.py local.
UPSTREAM = {
    "ffmpeg_failed": (502, "Não consegui abrir este vídeo. Ele pode ser privado, ter sido "
                           "removido, ser restrito por idade ou estar bloqueado na região."),
    "output_invalid": (502, "O YouTube respondeu de um jeito que não consegui interpretar."),
    "job_invalid": (502, "A análise não pôde ser feita agora. Tente de novo em alguns minutos."),
    "cut_invalid": (400, "O intervalo pedido não é válido."),
}
UPSTREAM_FALLBACK = (502, "A análise falhou no acesso ao vídeo. Tente de novo.")

# Um probe é ~7,5 s de yt-dlp para um podcast de 2 h (medido). O semáforo é o que
# impede um abusador de abrir 500 subprocessos; cheio, a resposta é 503 explícito.
GATE = threading.Semaphore(MAX_CONCURRENT)

# Campos que vão para o navegador. O recorte é deliberado:
#  - `cues`: as falas INTEIRAS do vídeo (medido: 3.830 cues / 331 KB num podcast de
#    2h07). A tela não mostra transcrição; mandar tudo é banda e transcrição de
#    terceiro trafegando sem motivo.
#  - `words`: as MESMAS falas palavra a palavra (10.857 palavras no mesmo podcast), que
#    servem para montar a legenda do 9:16 — e render não acontece aqui.
#  - `state`: resto da máquina de estados do pipeline, que não existe mais.
#  - `category`: palpite do léxico que NUNCA aparece na tela (só ia no corpo do
#    render). Palpite invisível não viaja.
CANDIDATE_FIELDS = ("inSec", "outSec", "score", "signals", "topic", "hook",
                    "reason", "contextWarning")


def _f(value):
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return 0.0


def public_payload(info, cands):
    """Resposta pública. Pura, para o teste exercitar sem rede."""
    return {
        "video": {
            "videoId": str(info.get("videoId") or ""),
            "title": str(info.get("title") or ""),
            "uploader": str(info.get("uploader") or ""),
            "durationSec": _f(info.get("durationSec")),
            "url": str(info.get("url") or ""),
        },
        # `note` é o aviso que o detector já escreve (ex.: vídeo sem "Mais
        # reproduzidos"). A tela de hoje mostra exatamente este campo — não é
        # estado novo inventado para a web.
        "note": str(info.get("note") or ""),
        "candidates": [{k: c.get(k) for k in CANDIDATE_FIELDS} for c in cands],
    }


def turnstile_ok(token, ip):
    """Verifica o token do Turnstile. Sem segredo configurado só roda em CLIPS_DEV."""
    if not TURNSTILE_SECRET:
        return True
    if not token:
        return False
    body = urllib.parse.urlencode({
        "secret": TURNSTILE_SECRET, "response": token, "remoteip": ip or "",
    }).encode("utf-8")
    try:
        req = urllib.request.Request(TURNSTILE_URL, data=body,
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return bool(json.loads(resp.read(8192).decode("utf-8", "replace")).get("success"))
    except (urllib.error.URLError, ValueError, OSError) as err:
        # Falha na verificação NÃO libera: um verificador fora do ar viraria porta aberta.
        print("turnstile indisponivel: %s" % err, file=sys.stderr, flush=True)
        return False


def analyze(url, token, ip):
    """(status, corpo) da rota /probe. Separado do HTTP para o teste chamar direto."""
    # `video_id` é PURO e suas mensagens são escritas para o usuário ("Cole o
    # endereço do vídeo.", "Esta rota só aceita vídeo do YouTube; recebeu X.").
    # Validar aqui separa "o usuário errou" de "o upstream falhou" por ORIGEM, em
    # vez de adivinhar a culpa pelo código de erro — o mesmo `job_invalid` cobre
    # URL torta do usuário E yt-dlp ausente do PATH.
    try:
        ytclip.video_id(url)
    except worker.WorkerError as err:
        return 400, {"error": err.message}

    if not turnstile_ok(token, ip):
        return 403, {"error": "Verificação de robô falhou. Recarregue a página e tente de novo."}
    if not GATE.acquire(blocking=False):
        return 503, {"error": "Muita análise ao mesmo tempo agora. Tente em alguns segundos."}
    try:
        info = ytclip.probe(url, timeout=PROBE_TIMEOUT)
        cands = ytclip.candidates(info, limit=MAX_CANDIDATES)
        return 200, public_payload(info, cands)
    except worker.WorkerError as err:
        # `.code` e `.message` são os atributos reais — `args` carrega só a
        # mensagem, e ler `args[1]` estoura IndexError e transforma TODO erro
        # previsto em 500 mudo. A mensagem NÃO vai para o navegador: pode conter
        # a saída crua do yt-dlp. Vai ao log, e o usuário recebe a frase fixa.
        print("upstream %s: %s" % (err.code, err.message), file=sys.stderr, flush=True)
        status, msg = UPSTREAM.get(err.code, UPSTREAM_FALLBACK)
        return status, {"error": msg}
    except Exception:                      # noqa: BLE001 — nada derruba o processo
        traceback.print_exc()
        return 500, {"error": "A análise falhou por um motivo inesperado. Tente de novo."}
    finally:
        GATE.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "clips-probe/1"
    sys_version = ""            # sem "Python/3.12.10" no cabeçalho Server
    protocol_version = "HTTP/1.1"

    # Sem isto, `StreamRequestHandler.setup()` não chama `settimeout` (o padrão do
    # stdlib é None) e NENHUM read tem prazo: um socket que anuncia Content-Length
    # e nunca manda o corpo prende uma thread para sempre, de qualquer IP, sem
    # passar pelo Turnstile nem pelo semáforo — o corpo é lido antes dos dois.
    # É o Slowloris clássico. `handle_one_request` já trata socket.timeout fechando
    # a conexão, então uma linha resolve.
    timeout = 30

    def _cors(self):
        # Ecoa a origem que casa. Origem que não casa recebe a primeira da lista —
        # o navegador rejeita a divergência, que é o desfecho certo, e um cliente
        # sem cabeçalho Origin (curl, monitor) continua recebendo resposta.
        pedida = self.headers.get("Origin")
        if "*" in ORIGINS:
            escolhida = "*"
        elif pedida and pedida in ORIGINS:
            escolhida = pedida
        else:
            escolhida = ORIGINS[0] if ORIGINS else ""
        self.send_header("Access-Control-Allow-Origin", escolhida)
        self.send_header("Vary", "Origin")

    def _json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        # Toda recusa fecha a conexão. Os caminhos de erro respondem SEM ler o
        # corpo declarado; com keep-alive, esses bytes viram a requisição seguinte
        # (CL.0 / response-queue desync) — provado: uma requisição com corpo
        # "GET /health…" recebeu DUAS respostas. Fechar no choke point cobre
        # do_POST e do_GET de uma vez.
        if status >= 400:
            self.close_connection = True
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if status >= 400:
            self.send_header("Connection", "close")
        self._cors()
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        # Página HTTPS (Vercel) chamando 127.0.0.1 é requisição de REDE PRIVADA: o
        # Chrome manda `Access-Control-Request-Private-Network: true` no preflight e
        # exige esta resposta. Sem ela o navegador bloqueia e o erro chega ao JS
        # como falha de rede genérica — indistinguível de "o motor está desligado".
        if self.headers.get("Access-Control-Request-Private-Network"):
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] != "/health":
            return self._json(404, {"error": "Rota não existe."})
        # Estado visível (BP-008): dá para ver de fora se o portão está ligado.
        self._json(200, {"ok": True, "turnstile": "on" if TURNSTILE_SECRET else "off"})

    def do_POST(self):
        if self.path.split("?")[0] != "/probe":
            return self._json(404, {"error": "Rota não existe."})
        # Chunked recusado por escrito: sem Content-Length o teto de MAX_BODY não
        # existe, e aceitar calado seria ler corpo ilimitado.
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            return self._json(411, {"error": "Envie o corpo com Content-Length."})
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY:
            return self._json(413, {"error": "Corpo da requisição fora do tamanho aceito."})
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace") or "{}")
            if not isinstance(body, dict):
                raise ValueError("corpo não é objeto")
        except ValueError:
            return self._json(400, {"error": "Corpo inválido: esperava JSON."})
        ip = self.headers.get("CF-Connecting-IP") or self.client_address[0]
        status, payload = analyze(str(body.get("url") or ""), str(body.get("token") or ""), ip)
        self._json(status, payload)

    def log_message(self, fmt, *args):
        print("%s %s" % (self.command, fmt % args), file=sys.stderr, flush=True)


def main():
    if not ALLOWED_ORIGIN:
        sys.exit("ALLOWED_ORIGIN nao definido. Use o dominio do site (ou * em dev).")
    if not TURNSTILE_SECRET and not DEV:
        sys.exit("TURNSTILE_SECRET nao definido. Sem ele o endpoint fica aberto; "
                 "para rodar local mesmo assim, exporte CLIPS_DEV=1.")
    if not TURNSTILE_SECRET:
        print("=" * 62 + "\nAVISO: rodando SEM Turnstile (CLIPS_DEV=1). Nao publicar assim.\n"
              + "=" * 62, file=sys.stderr, flush=True)
    print("analise em http://0.0.0.0:%d  (origem: %s)" % (PORT, ALLOWED_ORIGIN),
          file=sys.stderr, flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
