"""TikTok: URL -> referencia canonica, e formato -> marca d'agua.

Mundo separado do render do Estudio (que mora em video-worker/ e tem trava propria): aqui e
o BAIXADOR, porta 8770. Nada neste arquivo fala com o Remotion nem com o worker de render.

Duas regras que valem a leitura:

1. **A URL que vai para o yt-dlp e SEMPRE remontada a partir do id validado**, nunca a
   string que o operador colou -- mesma regra do `ytWatchId()` no popup e do
   `ytclip.video_id()`. Link curto (vm./vt./…/t/) e resolvido AQUI, com salto contado, e o
   destino passa pela mesma validacao do link completo. Se o destino nao for uma pagina de
   video do TikTok, a resolucao morre: nenhum host de fora e sequer contactado.

2. **Marca d'agua so e afirmada com prova do extrator.** MP4, resolucao, codec e "o download
   funcionou" NAO sao prova de nada. O yt-dlp rotula o formato `downloadAddr` como
   `watermarked` (tiktok.py do yt-dlp, `_parse_aweme_video_web`) e, no caminho da API,
   escreve `Download video, watermarked` so quando o proprio TikTok devolve
   `has_watermark=true`. Fora esses dois casos o estado e DESCONHECIDA -- que e diferente de
   "sem marca". Medido em 2026-09-08 neste repositorio: o formato `download` do
   @tiktok/video/7681695065927912735 traz o logo do TikTok + @arroba queimados no quadro, e
   o `h264_720p_*` (play addr) do MESMO video nao traz.
"""
import re
import urllib.error
import urllib.parse
import urllib.request

# UA de navegador: o encurtador do TikTok responde ao Python-urllib, mas nao ha motivo para
# depender disso. Nenhum cookie, nenhum token -- so o salto.
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
TIMEOUT = 10
MAX_SALTOS = 3  # encurtador do TikTok resolve em 1; 3 e folga, nao convite a cadeia longa

HOSTS = ("tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
         "tiktokv.com", "www.tiktokv.com")
HOSTS_CURTOS = ("vm.tiktok.com", "vt.tiktok.com")

_RX_VIDEO = re.compile(r"^/(?:@([\w.\-]{1,40})/)?(?:video|v)/(\d{6,25})")
_RX_SHARE = re.compile(r"^/(?:share/video|embed)/(\d{6,25})")
_RX_FOTO = re.compile(r"^/(?:@[\w.\-]{1,40}/)?photo/(\d{6,25})")
_RX_CURTO = re.compile(r"^/([A-Za-z0-9]{4,32})/?$")

URL_NAO_TIKTOK = "URL_NAO_TIKTOK"
TIPO_NAO_SUPORTADO = "TIKTOK_TIPO_NAO_SUPORTADO"
CURTO_MORTO = "TIKTOK_LINK_CURTO_MORTO"
CURTO_FALHOU = "TIKTOK_LINK_CURTO_FALHOU"

# Cada codigo tem frase propria: "nao e TikTok", "e TikTok mas nao e video" e "o link curto
# nao leva a lugar nenhum" sao problemas diferentes e o operador precisa saber qual e o dele.
MOTIVOS = {
    URL_NAO_TIKTOK: "Este link não é de um vídeo do TikTok. Cole o endereço de um vídeo "
                    "público (tiktok.com/@perfil/video/…) ou um link curto vm./vt.tiktok.com.",
    TIPO_NAO_SUPORTADO: "Este link é de uma publicação de fotos do TikTok, não de um vídeo. "
                        "Só vídeo é suportado.",
    CURTO_MORTO: "O link curto não leva mais a um vídeo — ele foi redirecionado para outra "
                 "página do TikTok. Abra o vídeo e copie o endereço completo.",
    CURTO_FALHOU: "Não consegui abrir o link curto do TikTok. Verifique a conexão e tente "
                  "de novo.",
}


def canonica(user, vid):
    """Endereco remontado do id. Sem perfil, cai na forma /share/video/ (que o yt-dlp aceita)."""
    if user:
        return "https://www.tiktok.com/@%s/video/%s" % (user, vid)
    return "https://www.tiktok.com/share/video/%s" % vid


def analisa(bruta):
    """URL crua -> {'tipo', 'url', 'id', 'user'}. `tipo` vazio = nao e link de TikTok.

    Funcao PURA: nao toca a rede. `tipo` 'curto' quer dizer "e do TikTok e precisa de um
    salto para virar video" -- quem da o salto e o canoniza().
    """
    vazio = {"tipo": "", "url": "", "id": "", "user": ""}
    if not isinstance(bruta, str):
        return vazio
    u = bruta.strip()
    # Caractere de controle passa pelo urlsplit e explode no Popen do Windows (mesma
    # armadilha do valid_url do runner).
    if not u or any(c < " " or c == chr(127) for c in u):
        return vazio
    try:
        p = urllib.parse.urlparse(u)
    except ValueError:
        return vazio
    if p.scheme not in ("http", "https"):
        return vazio
    host = p.hostname.lower() if p.hostname else ""
    if host not in HOSTS:
        return vazio
    caminho = p.path or "/"

    m = _RX_FOTO.match(caminho)
    if m:
        return {"tipo": "foto", "url": "", "id": m.group(1), "user": ""}

    m = _RX_VIDEO.match(caminho)
    if m:
        user, vid = m.group(1) or "", m.group(2)
        return {"tipo": "video", "url": canonica(user, vid), "id": vid, "user": user}

    m = _RX_SHARE.match(caminho)
    if m:
        return {"tipo": "video", "url": canonica("", m.group(1)), "id": m.group(1), "user": ""}

    # Link curto: /CODE nos hosts vm./vt., ou /t/CODE no host completo.
    if host in HOSTS_CURTOS:
        m = _RX_CURTO.match(caminho)
        if m:
            return {"tipo": "curto", "url": "https://%s/%s" % (host, m.group(1)),
                    "id": "", "user": ""}
    elif caminho.startswith("/t/"):
        m = _RX_CURTO.match(caminho[2:])
        if m:
            return {"tipo": "curto", "url": "https://www.tiktok.com/t/%s" % m.group(1),
                    "id": "", "user": ""}
    return vazio


class _SemSeguir(urllib.request.HTTPRedirectHandler):
    """Redirecionamento e DADO aqui, nao comportamento: quem decide seguir e o canoniza()."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_ABRIDOR = urllib.request.build_opener(_SemSeguir)


def _salto(url):
    """UM pedido HEAD -> destino do redirecionamento, ou '' se a pagina respondeu direto."""
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with _ABRIDOR.open(req, timeout=TIMEOUT) as resp:
            resp.read(0)
            return ""
    except urllib.error.HTTPError as err:
        if 300 <= err.code < 400:
            return err.headers.get("Location") or ""
        raise


def canoniza(bruta, salto=None):
    """URL crua -> (url_canonica, codigo_de_erro). Link curto custa no maximo MAX_SALTOS HEADs.

    O laco so contacta host de TikTok: o destino de cada salto volta para o analisa() antes
    de virar o proximo pedido, entao um redirecionamento para fora simplesmente encerra a
    resolucao (nao vira requisicao).
    """
    ref = analisa(bruta)
    if ref["tipo"] == "video":
        return ref["url"], ""
    if ref["tipo"] == "foto":
        return "", TIPO_NAO_SUPORTADO
    if ref["tipo"] != "curto":
        return "", URL_NAO_TIKTOK

    salto = salto or _salto
    atual = ref["url"]
    for _ in range(MAX_SALTOS):
        try:
            destino = salto(atual)
        except Exception as err:  # rede, DNS, TLS, HTTP 4xx/5xx
            print("[%s] %s" % (CURTO_FALHOU, err))
            return "", CURTO_FALHOU
        if not destino:
            return "", CURTO_MORTO
        alvo = analisa(urllib.parse.urljoin(atual, destino))
        if alvo["tipo"] == "video":
            return alvo["url"], ""
        if alvo["tipo"] == "foto":
            return "", TIPO_NAO_SUPORTADO
        if alvo["tipo"] != "curto":
            # Inclui o caso medido: link curto expirado cai na home do TikTok.
            return "", CURTO_MORTO
        atual = alvo["url"]
    return "", CURTO_FALHOU


# --- marca d'agua -------------------------------------------------------------------

COM_MARCA = "com-marca"
SEM_MARCA = "sem-marca"
DESCONHECIDA = "desconhecida"
NAO_SE_APLICA = "nao-se-aplica"

# Ordem de preferencia. Confirmado sem marca ganha de desconhecido, que ganha de marcado --
# e o marcado NUNCA e escolhido sozinho (so por clique explicito no seletor).
_PESO = {SEM_MARCA: 2, DESCONHECIDA: 1, COM_MARCA: 0}

FRASE = {
    COM_MARCA: "com marca d'água do TikTok",
    SEM_MARCA: "sem marca d'água do TikTok (confirmado)",
    DESCONHECIDA: "marca d'água não confirmada",
}


def marca_dagua(fmt):
    """Formato do yt-dlp -> (estado, evidencia). So repassa o que o extrator declarou.

    Nao existe ramo que deduza "sem marca" de extensao, resolucao, codec ou de o download
    ter funcionado. Formato sobre o qual o extrator nao diz nada sai DESCONHECIDA.
    """
    fid = str(fmt.get("format_id") or "")
    nota = str(fmt.get("format_note") or "").strip()
    if "watermark" in nota.lower():
        return COM_MARCA, 'o yt-dlp rotula este formato como "%s"' % nota
    if fid.startswith("download_addr") and nota == "Download video":
        # Caminho da API: o extrator so omite ", watermarked" quando o proprio TikTok
        # respondeu has_watermark=false. A omissao AQUI e afirmacao, nao silencio.
        return SEM_MARCA, "o TikTok respondeu has_watermark=false para este formato"
    return DESCONHECIDA, "o extrator não declara marca d'água para este formato"


def _rotulo(f):
    partes = []
    if f["altura"]:
        partes.append("%dx%d" % (f["largura"] or 0, f["altura"]))
    else:
        partes.append("resolução desconhecida")
    if f["vcodec"]:
        partes.append(f["vcodec"])
    if f["tamanho"]:
        partes.append("%.1f MB" % (f["tamanho"] / 1048576.0))
    if not f["temAudio"]:
        partes.append("sem áudio próprio")
    partes.append(FRASE[f["marca"]])
    return " · ".join(partes)


def formatos(info):
    """Formatos de VIDEO do dump, sem repetidos, do melhor para o pior.

    Faixa so de audio fica de fora: ela nao e opcao de "baixar o video". Formato sem audio
    proprio continua na lista, mas com `spec` que manda o yt-dlp juntar a melhor faixa de
    audio -- remux, sem recodificar -- para nunca entregar arquivo mudo.
    """
    saida, vistos = [], set()
    for f in info.get("formats") or []:
        if (f.get("vcodec") or "none") == "none":
            continue
        fid = str(f.get("format_id") or "")
        if not fid:
            continue
        estado, prova = marca_dagua(f)
        tem_audio = (f.get("acodec") or "none") != "none"
        tbr = f.get("tbr") or 0
        # O TikTok devolve a MESMA renderizacao em duas URLs (…-0 e …-1). Sem esta chave o
        # seletor teria dez linhas para cinco qualidades.
        chave = (f.get("width"), f.get("height"), f.get("vcodec"), round(tbr), estado)
        if chave in vistos:
            continue
        vistos.add(chave)
        item = {
            "id": fid,
            # `spec` e o que vai para o -f do yt-dlp. Sem audio proprio -> "<id>+ba/<id>":
            # junta a melhor faixa de audio por remux e, se nao houver nenhuma, ainda baixa
            # o video em vez de falhar.
            "spec": fid if tem_audio else (fid + "+ba/" + fid),
            "largura": f.get("width") or 0,
            "altura": f.get("height") or 0,
            "vcodec": str(f.get("vcodec") or ""),
            "acodec": str(f.get("acodec") or ""),
            "temAudio": tem_audio,
            "tamanho": int(f.get("filesize") or f.get("filesize_approx") or 0),
            "tbr": tbr,
            "marca": estado,
            "evidencia": prova,
        }
        item["rotulo"] = _rotulo(item)
        saida.append(item)
    saida.sort(key=lambda f: (_PESO[f["marca"]], 1 if f["temAudio"] else 0,
                              f["altura"], f["tbr"]), reverse=True)
    return saida


def escolhe(lista):
    """Id do melhor formato que NAO e marcado. '' quando so sobra variante com marca d'agua.

    Devolver '' de proposito: baixar a versao marcada existe, mas tem de ser escolha dita
    do operador -- automatico nunca entrega video marcado fingindo que esta tudo bem.
    """
    for f in lista:
        if f["marca"] != COM_MARCA:
            return f["id"]
    return ""


def resumo(info):
    """Dump do yt-dlp -> o que a tela precisa. Metadado ausente fica ausente, nao inventado."""
    lista = formatos(info)
    return {
        "videoId": str(info.get("id") or ""),
        "titulo": str(info.get("title") or ""),
        "criador": str(info.get("uploader") or info.get("channel") or ""),
        "sourceUrl": str(info.get("webpage_url") or ""),
        "duracao": float(info.get("duration") or 0.0),
        "thumbnail": str(info.get("thumbnail") or ""),
        "formatos": lista,
        "escolhido": escolhe(lista),
        # Dito em voz alta em vez de deduzido do vazio: "todas as variantes disponiveis sao
        # marcadas" e um estado, nao a ausencia de um.
        "soComMarca": bool(lista) and all(f["marca"] == COM_MARCA for f in lista),
    }
