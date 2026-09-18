"""Publicar um corte na CAIXA DE ENTRADA do TikTok (rascunho), nunca post direto.

Decisão do usuário em 2026-09-10, registrada em
`docs/02-Execution/plans/PLANO-tiktok-publicar.md`: o escopo é `video.upload`, que entrega o
MP4 nos rascunhos do app; quem escreve legenda, escolhe capa e aperta "publicar" é a pessoa,
no celular. O escopo irmão `video.publish` (post direto) fica DE FORA de propósito — sem a
auditoria do TikTok ele só publica `SELF_ONLY` e ainda exige a conta privada na hora do post,
o que é o contrário de crescer. Trocar de um para o outro não é mudar uma constante: o post
direto arrasta uma tela de conformidade inteira (seletor de privacidade, disclosure de
conteúdo comercial, textos legais exatos) que o TikTok cobra na auditoria.

Nada aqui baixa mídia nem toca no YouTube: o arquivo já está no disco, produzido pelo
próprio Estúdio. O portão de direitos (`ytFetchGate`) fica onde está, na aquisição.

stdlib only (`.claude/rules/estudio-video-worker.md`). Sem `requests`, sem SDK do TikTok.

SEGREDO: o `client_secret` vive só em `.env.tiktok`, ao lado deste arquivo, e nunca sai daqui
para o navegador. Os dois arquivos locais começam com ponto, então o `send_head` do
`serve.py` os recusa como conteúdo do site (404) e o `.gitignore` os mantém fora do git.
"""

import hashlib
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

import worker

PASTA = os.path.dirname(os.path.abspath(__file__))
CRED_FILE = os.path.join(PASTA, ".env.tiktok")
TOKENS_FILE = os.path.join(PASTA, ".tiktok-tokens.json")

URL_AUTORIZAR = "https://www.tiktok.com/v2/auth/authorize/"
URL_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/"
URL_INIT = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
URL_STATUS = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"
URL_USER = "https://open.tiktokapis.com/v2/user/info/?fields=display_name"

# `user.info.basic` é só para a tela dizer QUAL conta está conectada — publicar no perfil
# errado é o tipo de erro que só se descobre depois. `video.upload` é o que sobe o arquivo.
ESCOPOS = "user.info.basic,video.upload"
CAMINHO_CALLBACK = "/tiktok/callback/"

# Regras de chunk MEDIDAS na doc (Media Transfer Guide), não estimadas:
#   - cada pedaço entre 5 MB e 64 MB; o ÚLTIMO pode passar do `chunk_size` (até 128 MB) para
#     absorver os bytes que sobram;
#   - vídeo com menos de 5 MB vai INTEIRO, com `chunk_size` igual ao tamanho total;
#   - vídeo com MAIS de 64 MB tem de ir em vários pedaços;
#   - `total_chunk_count` = `video_size // chunk_size`, arredondando para BAIXO;
#   - no máximo 1000 pedaços, enviados em ordem.
CHUNK_TETO = 64 * 1024 * 1024
# 32 MB e não 64: com 64 um arquivo de 64 MB + 1 byte daria `total_chunk_count == 1`, isto é,
# um pedaço único ACIMA do teto — exatamente o que a regra "acima de 64 MB vai em vários"
# proíbe. Com 32 o mesmo arquivo dá 2 pedaços, e o último (32 MB + 1) segue dentro dos limites.
CHUNK_PADRAO = 32 * 1024 * 1024
CHUNKS_MAX = 1000

TEMPO_LIMITE = 60
# Renova o access token quando faltar menos que isto para vencer. Ele dura 86400 s (24 h);
# a folga evita perder um upload longo no meio por token vencendo entre o init e o PUT.
FOLGA_RENOVACAO = 300

# Autorização em curso (state -> code_verifier). Uma por vez: é um site de uma pessoa só, na
# própria máquina. Morre com o processo de propósito — código de autorização é efêmero.
_PENDENTE = {}


# ------------------------------------------------------------------ credenciais e tokens
def credenciais():
    """Lê `client_key`/`client_secret` do `.env.tiktok`. Ausência é erro FALADO.

    Sem isto o operador veria "falhou" sem saber que o que falta é um arquivo que só ele
    pode criar (BP-008: nenhum ramo termina mudo).
    """
    if not os.path.isfile(CRED_FILE):
        raise worker.WorkerError(
            "tiktok_sem_credencial",
            "Falta o arquivo video-worker/.env.tiktok com TIKTOK_CLIENT_KEY e "
            "TIKTOK_CLIENT_SECRET. Veja docs/02-Execution/plans/PLANO-tiktok-publicar.md.")
    valores = {}
    with open(CRED_FILE, "r", encoding="utf-8") as arquivo:
        for linha in arquivo:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, _, valor = linha.partition("=")
            valores[chave.strip()] = valor.strip()
    chave = valores.get("TIKTOK_CLIENT_KEY", "")
    segredo = valores.get("TIKTOK_CLIENT_SECRET", "")
    if not chave or not segredo:
        raise worker.WorkerError(
            "tiktok_sem_credencial",
            "O .env.tiktok existe mas está sem TIKTOK_CLIENT_KEY ou TIKTOK_CLIENT_SECRET.")
    return chave, segredo


def ler_tokens():
    """Tokens guardados, ou `None`. Arquivo corrompido conta como desconectado — reconectar
    custa um clique, e levantar aqui deixaria a tela sem nem o botão de conectar."""
    try:
        with open(TOKENS_FILE, "r", encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    except (OSError, ValueError):
        return None
    return dados if isinstance(dados, dict) and dados.get("refresh_token") else None


def gravar_tokens(dados):
    dados = dict(dados)
    dados["obtido_em"] = time.time()
    with open(TOKENS_FILE, "w", encoding="utf-8") as arquivo:
        json.dump(dados, arquivo)
    return dados


def esquecer():
    """Desconectar = apagar o arquivo. Não há sessão em memória para limpar."""
    try:
        os.remove(TOKENS_FILE)
    except OSError:
        pass


# ------------------------------------------------------------------------- HTTP (stdlib)
def _pedir(req):
    """Uma porta só para todo tráfego com o TikTok, para todo erro virar `WorkerError`.

    O corpo do erro é lido e devolvido: o TikTok explica o motivo ali (`error_description`,
    `error.message`), e engolir isso transformaria "seu app não tem o escopo" num 500 mudo.
    """
    try:
        with urllib.request.urlopen(req, timeout=TEMPO_LIMITE) as resposta:
            bruto = resposta.read()
    except urllib.error.HTTPError as err:
        detalhe = ""
        try:
            detalhe = err.read().decode("utf-8", "replace")[:400]
        except OSError:
            pass
        raise worker.WorkerError(
            "tiktok_recusou", "O TikTok recusou (HTTP %s). %s" % (err.code, detalhe))
    except urllib.error.URLError as err:
        raise worker.WorkerError(
            "tiktok_sem_rede", "Não consegui falar com o TikTok: %s" % (err.reason,))
    if not bruto:
        return {}
    try:
        return json.loads(bruto.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise worker.WorkerError("tiktok_recusou", "O TikTok respondeu algo que não é JSON.")


def _json_api(url, corpo, token):
    """Rotas `open.tiktokapis.com`: erro vem em `error.code != "ok"` com HTTP 200."""
    req = urllib.request.Request(
        url, data=json.dumps(corpo).encode("utf-8"), method="POST",
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/json; charset=UTF-8"})
    resposta = _pedir(req)
    erro = resposta.get("error") or {}
    if erro.get("code") not in (None, "ok"):
        raise worker.WorkerError(
            "tiktok_recusou",
            "O TikTok recusou: %s (%s)" % (erro.get("message") or "sem motivo",
                                           erro.get("code")))
    return resposta.get("data") or {}


def _form(campos):
    req = urllib.request.Request(
        URL_TOKEN, data=urllib.parse.urlencode(campos).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "Cache-Control": "no-cache"})
    resposta = _pedir(req)
    if resposta.get("error"):
        raise worker.WorkerError(
            "tiktok_recusou",
            "O TikTok recusou o token: %s — %s" % (resposta.get("error"),
                                                   resposta.get("error_description", "")))
    if not resposta.get("access_token"):
        raise worker.WorkerError("tiktok_recusou", "O TikTok não devolveu access_token.")
    return resposta


# ------------------------------------------------------------------------------- OAuth
def url_autorizacao(redirect_uri):
    """Monta a URL de autorização e guarda o par `state`/`code_verifier` desta tentativa.

    PKCE é OBRIGATÓRIO no Login Kit de desktop — que é o que permite `127.0.0.1` como
    redirect (o Login Kit web exige https e domínio público, e mataria o worker local).

    ARMADILHA: o TikTok quer o `code_challenge` em HEX do SHA256, não no base64url que o
    RFC 7636 manda. Usar base64url dá erro genérico de autorização, sem dizer o motivo.
    """
    chave, _ = credenciais()
    verifier = secrets.token_hex(48)
    state = secrets.token_urlsafe(24)
    _PENDENTE.clear()
    _PENDENTE[state] = verifier
    campos = {
        "client_key": chave,
        "scope": ESCOPOS,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": hashlib.sha256(verifier.encode("ascii")).hexdigest(),
        "code_challenge_method": "S256",
    }
    return URL_AUTORIZAR + "?" + urllib.parse.urlencode(campos)


def concluir_login(code, state, redirect_uri):
    """Troca o `code` por tokens. O `state` é conferido e CONSUMIDO (uso único)."""
    verifier = _PENDENTE.pop(state, None) if state else None
    if not verifier:
        raise worker.WorkerError(
            "tiktok_estado_invalido",
            "Esta autorização não confere com nenhum pedido em aberto. "
            "Feche esta aba e clique em Conectar de novo.")
    if not code:
        raise worker.WorkerError(
            "tiktok_estado_invalido", "O TikTok voltou sem código de autorização.")
    chave, segredo = credenciais()
    return gravar_tokens(_form({
        "client_key": chave,
        "client_secret": segredo,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code_verifier": verifier,
    }))


def token_valido():
    """Access token pronto para uso, renovando antes de vencer. Levanta se não há conexão."""
    tokens = ler_tokens()
    if not tokens:
        raise worker.WorkerError(
            "tiktok_desconectado",
            "Nenhuma conta do TikTok conectada. Clique em Conectar conta do TikTok.")
    vence_em = float(tokens.get("obtido_em") or 0) + float(tokens.get("expires_in") or 0)
    if tokens.get("access_token") and time.time() < vence_em - FOLGA_RENOVACAO:
        return tokens["access_token"]
    chave, segredo = credenciais()
    novos = gravar_tokens(_form({
        "client_key": chave,
        "client_secret": segredo,
        "grant_type": "refresh_token",
        "refresh_token": tokens["refresh_token"],
    }))
    return novos["access_token"]


def conta():
    """`{connected, username}` para o selo da tela. NÃO levanta quando desconectado — a tela
    precisa desenhar o botão de conectar, e erro ali viraria tela vazia (BP-008)."""
    if not ler_tokens():
        return {"connected": False, "username": ""}
    try:
        token = token_valido()
        req = urllib.request.Request(URL_USER, headers={"Authorization": "Bearer " + token})
        dados = (_pedir(req).get("data") or {}).get("user") or {}
        return {"connected": True, "username": dados.get("display_name") or ""}
    except worker.WorkerError as err:
        # Refresh vencido (365 dias) ou app revogado: é desconexão, não falha da tela.
        return {"connected": False, "username": "", "motivo": err.message}


# ------------------------------------------------------------------------------ upload
def chunk_plan(tamanho):
    """`(chunk_size, total_chunk_count)` conforme as regras do Media Transfer Guide.

    Função pura, e o único lugar onde a aritmética de pedaço existe — é ela que o teste
    exercita nos dois ramos (arquivo pequeno e arquivo acima do teto), porque o corte normal
    de podcast cabe num pedaço só e o ramo de vários nunca rodaria na prática (BP-014).
    """
    if tamanho <= 0:
        raise worker.WorkerError("tiktok_video", "O arquivo do clip está vazio.")
    if tamanho <= CHUNK_TETO:
        return tamanho, 1
    pedaco = CHUNK_PADRAO
    total = tamanho // pedaco
    if total > CHUNKS_MAX:
        # Arquivo absurdo para um corte; cresce o pedaço em vez de estourar o teto de 1000.
        pedaco = -(-tamanho // CHUNKS_MAX)
        total = tamanho // pedaco
    return pedaco, total


def publicar(caminho):
    """Sobe o MP4 para a caixa de entrada do TikTok. Devolve `publish_id`."""
    try:
        tamanho = os.path.getsize(caminho)
    except OSError as err:
        raise worker.WorkerError(
            "tiktok_video", "Não consegui ler o arquivo do clip: %s" % (err.strerror or err,))
    pedaco, total = chunk_plan(tamanho)
    token = token_valido()
    dados = _json_api(URL_INIT, {"source_info": {
        "source": "FILE_UPLOAD",
        "video_size": tamanho,
        "chunk_size": pedaco,
        "total_chunk_count": total,
    }}, token)
    destino = dados.get("upload_url")
    publish_id = dados.get("publish_id")
    if not destino or not publish_id:
        raise worker.WorkerError(
            "tiktok_recusou", "O TikTok aceitou o pedido mas não devolveu endereço de envio.")
    with open(caminho, "rb") as arquivo:
        for indice in range(total):
            inicio = indice * pedaco
            # O ÚLTIMO pedaço leva todo o resto: os bytes que sobram da divisão inteira vão
            # com ele (a doc permite até 128 MB nele). Fatiar em `pedaco` cravado deixaria
            # uma sobra que ninguém enviaria, e o TikTok esperaria para sempre.
            fim = tamanho - 1 if indice == total - 1 else inicio + pedaco - 1
            arquivo.seek(inicio)
            corpo = arquivo.read(fim - inicio + 1)
            req = urllib.request.Request(destino, data=corpo, method="PUT", headers={
                "Content-Type": "video/mp4",
                "Content-Length": str(len(corpo)),
                "Content-Range": "bytes %d-%d/%d" % (inicio, fim, tamanho),
            })
            _pedir(req)
    return publish_id


def estado(publish_id):
    """Como está o processamento do lado do TikTok."""
    if not publish_id:
        raise worker.WorkerError("job_invalid", "Falta o publish_id.")
    dados = _json_api(URL_STATUS, {"publish_id": publish_id}, token_valido())
    return {"status": dados.get("status") or "",
            "falha": (dados.get("fail_reason") or "")}
