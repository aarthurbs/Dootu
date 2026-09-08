"""Helper local do baixador: 5 rotas, so em 127.0.0.1. py -3.12 server.py"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import config
import tiktok
import yt_dlp_runner as runner

MAX_BODY = 4096

# A ULTIMA inspecao, e so ela. Existe por um motivo de seguranca, nao de desempenho: assim o
# `-f` do yt-dlp e sempre um `spec` que ESTE helper montou a partir do dump, e nunca uma
# expressao de formato que chegou pela rede. O popup manda so o id, conferido contra esta
# lista. Um download por vez, entao uma vaga basta.
_ultima = {"url": "", "formatos": []}


def origin_allowed(origin):
    """Origem que PODE agir neste helper.

    CORS nao serve para isso: header de resposta decide se a resposta pode ser LIDA, e nao
    impede o pedido de acontecer. Um POST cross-site com Content-Type text/plain nem gera
    preflight — o download comecaria antes de alguem olhar a origem. Por isso o portao esta
    no metodo: pedido de navegador traz Origin, e origem que nao e a extensao leva 403.
    Pedido sem Origin (curl, PowerShell, o proprio dono da maquina) segue permitido.
    """
    if origin is None:
        return True
    return origin.startswith("chrome-extension://")


def cors_origin(origin):
    # So a extensao pode disparar download; um site qualquer nao recebe o header.
    if origin and origin.startswith("chrome-extension://"):
        return origin
    return None


class Servidor(ThreadingHTTPServer):
    # SO_REUSEADDR no Windows deixa DOIS helpers ligarem na mesma porta sem erro: o segundo
    # sobe calado e atende metade dos pedidos. Melhor falhar alto com "porta em uso".
    allow_reuse_address = False


class Handler(BaseHTTPRequestHandler):
    server_version = "baixador-local"

    def log_message(self, *a):
        pass  # /status e consultado em loop; log padrao so poluiria

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = cors_origin(self.headers.get("Origin"))
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        origin = cors_origin(self.headers.get("Origin"))
        self.send_response(204 if origin else 404)
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _blocked(self):
        if origin_allowed(self.headers.get("Origin")):
            return False
        self._send(403, {"error": "Origem nao autorizada."})
        return True

    def do_GET(self):
        if self._blocked():
            return
        path = self.path.split("?", 1)[0]
        if path == "/health":
            exe = config.yt_dlp_path()
            if not exe:
                return self._send(200, {"status": "error",
                                        "error": "yt-dlp não foi encontrado no sistema."})
            return self._send(200, {
                "status": "ok",
                "ytDlp": runner.version(exe),
                "ffmpeg": bool(config.ffmpeg_path()),
                "downloadFolder": str(config.DOWNLOAD_DIR),
            })
        if path.startswith("/status/"):
            job = runner.get(path[len("/status/"):])
            if not job:
                return self._send(404, {"error": "Download não encontrado."})
            return self._send(200, job)
        if path == "/current":
            # Fechar o popup nao cancela o download; reabrir tem de reencontrar a verdade.
            # Dono do trabalho e o helper, e e ele quem responde o que esta acontecendo.
            return self._send(200, runner.current() or {})
        self._send(404, {"error": "Rota não encontrada."})

    def _inspect(self, url):
        """Metadados + formatos de UM video do TikTok. Nao baixa nada."""
        canon, cod = tiktok.canoniza(url)
        if cod:
            return self._send(400, {"error": tiktok.MOTIVOS[cod], "errorCode": cod})
        info, erro = runner.inspect(canon)
        if erro:
            # Falha de extracao fica EXPLICITA: nada de fallback inventado, nada de tentar
            # outro caminho por fora do yt-dlp.
            return self._send(502, {"error": erro, "errorCode": "TIKTOK_EXTRACAO_FALHOU"})
        dados = tiktok.resumo(info)
        dados["url"] = canon
        if not dados["formatos"]:
            return self._send(502, {"error": "O TikTok não ofereceu nenhuma faixa de vídeo "
                                             "para este link.",
                                    "errorCode": "TIKTOK_SEM_FORMATO"})
        # Troca de referencia, e nao dois `_ultima[...] =`: o servidor e ThreadingHTTPServer,
        # e duas atribuicoes deixariam uma janela em que a URL ja e a nova e a lista de
        # formatos ainda e a velha -- exatamente o par que o /download confere.
        global _ultima
        _ultima = {"url": canon, "formatos": dados["formatos"]}
        return self._send(200, dados)

    def _download_tiktok(self, url, format_id):
        canon, cod = tiktok.canoniza(url)
        if cod:
            return self._send(400, {"error": tiktok.MOTIVOS[cod], "errorCode": cod})
        ultima = _ultima  # uma leitura so, pelo mesmo motivo
        if canon != ultima["url"]:
            return self._send(409, {"error": "Busque o vídeo antes de baixar."})
        # O id vem do cliente; o `spec` que vai para a linha de comando vem SEMPRE daqui.
        escolhido = next((f for f in ultima["formatos"] if f["id"] == format_id), None)
        if not escolhido:
            return self._send(400, {"error": "Formato não encontrado. Busque o vídeo de novo."})
        job, err = runner.start(canon, escolhido["spec"], "%(uploader)s-%(id)s.%(ext)s", canon)
        return self._resposta_start(job, err)

    def _resposta_start(self, job, err):
        if err == "bad-url":
            return self._send(400, {"error": "URL inválida."})
        if err == "busy":
            return self._send(409, {"error": "Já existe um download em andamento."})
        if err == "no-ytdlp":
            return self._send(503, {"error": "yt-dlp não foi encontrado."})
        print("download:", job["id"])
        self._send(200, job)

    def do_POST(self):
        if self._blocked():
            return
        rota = self.path.split("?", 1)[0]
        if rota not in ("/download", "/inspect"):
            return self._send(404, {"error": "Rota não encontrada."})
        try:
            length = min(max(0, int(self.headers.get("Content-Length") or 0)), MAX_BODY)
            data = json.loads(self.rfile.read(length) or b"{}")
            url = data.get("url")
        except (ValueError, TypeError, AttributeError):
            return self._send(400, {"error": "URL inválida."})
        if rota == "/inspect":
            return self._inspect(url)
        # Link de TikTok tem caminho proprio (formato escolhido, nome estavel). Qualquer
        # outra URL segue pelo caminho de sempre -- o YouTube nao muda de comportamento.
        if tiktok.analisa(url)["tipo"]:
            return self._download_tiktok(url, data.get("formatId"))
        job, err = runner.start(url)
        self._resposta_start(job, err)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    config.ensure_download_dir()
    if not config.yt_dlp_path():
        print("AVISO: yt-dlp não está no PATH — nenhum download vai funcionar.")
    if not config.ffmpeg_path():
        print("AVISO: FFmpeg não está no PATH — vídeos em 1080p não podem ser juntados.")
    print(f"Baixador local: http://127.0.0.1:{config.PORT}")
    print(f"Pasta de download: {config.DOWNLOAD_DIR}")
    Servidor(("127.0.0.1", config.PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
