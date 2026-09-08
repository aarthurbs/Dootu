"""Inicia e monitora UM yt-dlp por vez. Nada de rede/HTTP aqui."""
import datetime
import json
import re
import subprocess
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import config
import tiktok

ACTIVE_STATES = ("queued", "downloading", "processing")
PROCESS_MARKERS = ("@@POST", "[Merger]", "[Fixup", "[ExtractAudio]")

_lock = threading.Lock()
_jobs = {}       # id -> job (dict mutavel)
_active_id = None


# --- funcoes puras (testaveis) ------------------------------------------------

def valid_url(url):
    if not isinstance(url, str):
        return False
    u = url.strip()
    if not u or u.startswith("-"):  # "-oX" seria lido como opcao pelo yt-dlp
        return False
    # Caractere de controle passa pelo urlsplit mas explode no Popen do Windows com
    # ValueError ("embedded null character"), que nao e OSError: escaparia do except,
    # mataria a thread e deixaria o job travado em "queued" para sempre.
    if any(c < " " or c == chr(127) for c in u):
        return False
    try:
        p = urlparse(u)
    except ValueError:
        return False
    return p.scheme in ("http", "https") and bool(p.netloc)


_PROG_RX = (
    re.compile(r"@@PROG\s+([\d.]+)\s*%"),
    # fallback: nao pudemos verificar o formato do --progress-template em runtime
    re.compile(r"\[download\]\s+([\d.]+)\s*%"),
)


def parse_progress(line):
    for rx in _PROG_RX:
        m = rx.search(line)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                return None
    return None


def parse_filename(line):
    s = line.strip()
    if not s.startswith("@@FILE"):
        return None
    return s[len("@@FILE"):].strip() or None


def build_args(exe, url, dest, spec=None, outtmpl=None):
    """Comando do download. `spec`/`outtmpl` vazios = comportamento historico do YouTube.

    O TikTok passa os dois: `spec` porque a escolha de formato e do operador (e porque a
    variante marcada nunca pode ser escolhida por acaso), e `outtmpl` porque o "titulo" de
    um post do TikTok e a legenda inteira, com hashtag e emoji -- nome de arquivo instavel.
    `%(uploader)s-%(id)s` e estavel e unico por video: dois videos diferentes nunca colidem.
    """
    return [
        exe, "--ignore-config", "--no-playlist", "--newline", "--progress",
        # O yt-dlp escreve no pipe usando a pagina de codigo do Windows (cp1252 aqui),
        # e nos lemos como utf-8: sem isto, titulo com acento chega com U+FFFD e o nome
        # do arquivo que aparece na tela -- e o do .mostreplayed.json -- sai torto.
        # Medido: PYTHONIOENCODING=utf-8 NAO resolve (binario congelado ignora).
        "--encoding", "utf-8",
        "--no-simulate", "--no-warnings",
        "--progress-template", "download:@@PROG %(progress._percent_str)s",
        # --print implica --quiet, entao as linhas [Merger]/[Fixup] nunca aparecem e o
        # estado "processing" seria inalcancavel. O template de postprocess sobrevive.
        "--progress-template", "postprocess:@@POST %(progress._default_template)s",
        "--write-info-json",  # traz o heatmap sem UMA requisicao a mais
        # A miniatura vira o FUNDO do 9:16 (worker.build_filter). E o proprio yt-dlp que a
        # grava, ao lado do video: nenhum download novo escrito a mao, nenhuma permissao a
        # mais na extensao. Sem --convert-thumbnails de proposito -- converter exige FFmpeg
        # no PATH do helper, que pode nao existir, e o FFmpeg do Estudio le .webp igual.
        "--write-thumbnail",
        "--print", "after_move:@@FILE %(filepath)s",
    ] + (["-f", spec] if spec else []) + [
        "-P", str(dest), "-o", outtmpl or "%(title)s.%(ext)s",
        "--", url,  # tudo depois do "--" e URL, nunca opcao
    ]


def classify_error(raw):
    """Erro cru do yt-dlp -> codigo interno. Funcao pura.

    O 403 ganha codigo proprio porque tem causa propria e MEDIDA nesta maquina: com o build
    2026.07.04 o download morria com "HTTP Error 403: Forbidden" no meio do fluxo; com o
    2026.08.18 o MESMO comando, sem trocar um argumento, terminou o arquivo. O YouTube passou
    a exigir SABR/PO Token e build velho pede URL de midia que o servidor recusa. Por isso o
    403 nao cai no generico -- ele vira instrucao de atualizar, que e o que resolve.
    """
    low = (raw or "").lower()
    if "403" in low or "forbidden" in low:
        return "YOUTUBE_HTTP_403"
    if any(t in low for t in ("js runtime", "js challenge", "jsc ", "deno", "quickjs", "nsig")):
        return "YTDLP_RUNTIME_MISSING"
    if any(t in low for t in ("unsupported url", "unable to extract", "video unavailable",
                              "private video", "is not a valid url")):
        return "YTDLP_EXTRACTION_FAILED"
    return "YTDLP_DOWNLOAD_FAILED"


# Medido 2026-09-08 em tiktok.com/share/video/7680281054460038420: o TikTok serve pagina de
# desafio anti-bot em ~1 de 4 pedidos. O yt-dlp resolve o JS, refaz o pedido UMA vez
# ("Downloading webpage with challenge cookie") e desiste quando a segunda resposta tambem
# vem sem os dados -- morrendo em `_extract_web_data_and_status` ANTES do primeiro byte de
# midia. `--extractor-retries 10` NAO cobre este caminho (medido: 2 falhas em 14 com a flag
# contra 3 em 14 sem ela), entao quem repete somos nos: 5 falhas em 22 execucoes identicas
# (23%) caem para ~1% em tres tentativas.
# As falhas vem em RAJADA, nao sorteadas uma a uma: repetindo na hora, 3 tentativas ainda
# deram 1 falha em 10 (se fossem independentes seriam ~1 em 80). Por isso a espera entre
# tentativas -- e ela, nao a contagem, que sai da rajada.
# ponytail: espera fixa; se um dia aparecer HTTP 429 no lugar do desafio, e aqui que entra o
# recuo progressivo.
TENTATIVAS = 3
ESPERA = 3.0


def e_desafio(raw):
    """Falha TRANSITORIA de desafio anti-bot do TikTok (vale repetir)? Funcao pura.

    So esta frase. O "unable to extract" generico do classify_error NAO entra: "video
    unavailable" e "private video" tambem sao extracao falha, e repeti-los seria gastar
    tempo do operador para ouvir o mesmo nao.
    """
    return "universal data for rehydration" in (raw or "").lower()


def friendly_error(raw, has_ffmpeg):
    s = (raw or "").strip().replace("\r", " ").replace("\n", " ")
    if s.startswith("ERROR:"):
        s = s[len("ERROR:"):].strip()
    # Ruido que nao explica nada ao operador (e vazaria caminho interno).
    if s.startswith("Traceback") or s.startswith('File "') or s.startswith("@@"):
        s = ""
    low = s.lower()
    if not has_ffmpeg and ("ffmpeg" in low or "merge" in low or "postprocess" in low):
        return ("O FFmpeg nao foi encontrado — ele e necessario para juntar video e audio. "
                "Instale o FFmpeg e tente de novo.")
    if not s:
        return "O download falhou. Verifique a URL e a conexao."
    if classify_error(s) == "YOUTUBE_HTTP_403":
        return (s[:180] + " — o YouTube recusou a midia (403). Quase sempre e o yt-dlp "
                "desatualizado: rode  winget upgrade yt-dlp.yt-dlp  e tente de novo.")
    return s[:300]


def newest_file(dest):
    """Video mais recente da pasta. Usado quando a linha @@FILE nao aparece.

    O .json esta fora da lista de proposito: desde que o download passou a gravar
    .info.json e .mostreplayed.json, o arquivo MAIS NOVO da pasta costuma ser um deles, e
    o fallback devolveria o metadado como se fosse o video.

    A MINIATURA tambem: o --write-thumbnail grava no mesmo instante do video, entao o
    "mais novo" pode ser a imagem -- e o Estudio morreria com "sem faixa de video". No
    TikTok isso deixou de ser hipotese: o yt-dlp grava a capa como `.image` (JPEG com
    extensao esquisita), que passaria batido por qualquer lista de imagem "obvia".
    """
    descartar = (".part", ".ytdl", ".json") + THUMB_EXTS
    try:
        files = [f for f in Path(dest).iterdir()
                 if f.is_file() and f.suffix.lower() not in descartar]
    except OSError:
        return None
    if not files:
        return None
    return max(files, key=lambda f: f.stat().st_mtime).name


def new_job():
    return {"id": uuid.uuid4().hex[:12], "status": "queued", "progress": 0,
            "filename": None, "error": None, "_err": "",
            "_pct": 0.0, "_fase": 0}


def consume_line(job, line):
    """Aplica uma linha de saida do yt-dlp ao job."""
    s = line.strip()
    if not s:
        return
    if job["status"] == "queued":
        job["status"] = "downloading"
    pct = parse_progress(s)
    if pct is not None:
        # O yt-dlp baixa video e audio em DOIS arquivos e o percentual reinicia no segundo;
        # exibir cru faz a barra ANDAR PARA TRAS no meio do download. Cada arquivo ocupa
        # metade da barra. Com um arquivo so a barra para em 50% e o fim leva a 100 — errar
        # para baixo e melhor que anunciar 100% com o download ainda rodando.
        # ponytail: 2 fases; um 3o arquivo (raro) reaproveita a segunda metade.
        if pct + 0.5 < job["_pct"]:
            job["_fase"] = min(job["_fase"] + 1, 1)
        job["_pct"] = pct
        job["progress"] = round(pct / 2.0 + 50.0 * job["_fase"], 1)
    name = parse_filename(s)
    if name:
        job["filename"] = Path(name).name
    if any(s.startswith(m) for m in PROCESS_MARKERS):
        job["status"] = "processing"
    # A ULTIMA linha util e a que explica a falha, e ERROR: ganha de linha comum. A versao
    # anterior gravava a PRIMEIRA e reportava "@@PROG 0.0%" como se fosse o motivo do erro.
    if s.startswith("ERROR:") or not job["_err"].startswith("ERROR:"):
        job["_err"] = s


def finish(job, code, dest, has_ffmpeg):
    if code == 0:
        job["status"] = "completed"
        job["progress"] = 100
        if not job["filename"]:
            job["filename"] = newest_file(dest)  # fallback: @@FILE pode nao sair
        # Audiencia e legenda entram AQUI, no fim do import, e nunca antes: sao
        # enriquecimento do video que acabou de chegar, nao pre-requisito dele.
        analise = save_most_replayed(dest, job["filename"])
        job["mostReplayed"] = analise["mostReplayed"]
        job["captions"] = analise["captions"]
        # O que a tela vai dizer sobre a marca d'agua sai DAQUI -- do formato que virou
        # arquivo -- e nao da inspecao que o operador viu antes de clicar.
        job["watermark"] = analise["watermark"]
    else:
        job["status"] = "error"
        job["errorCode"] = classify_error(job["_err"])
        job["error"] = friendly_error(job["_err"], has_ffmpeg)
        # O erro CRU do yt-dlp continua no log; so a tela recebe a versao curta.
        print("[%s] %s" % (job["errorCode"], job["_err"][:400]))


def _video_worker(nome):
    """Modulo compartilhado do Estudio (video-worker/): "heatmap" ou "ytclip".

    Importado, nunca copiado: duas copias divergem no primeiro ajuste de limiar (ou de
    idioma de legenda), e o Estudio de Videos usa exatamente estes mesmos detectores. Os
    dois sao stdlib puro, entao carregar um aqui nao arrasta dependencia nenhuma.
    """
    import importlib
    import os
    import sys
    raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    caminho = os.path.join(raiz, "video-worker")
    if caminho not in sys.path:
        sys.path.insert(0, caminho)
    return importlib.import_module(nome)


def _info_json(dest, filename):
    """Acha o .info.json que o yt-dlp acabou de gravar."""
    dest = Path(dest)
    if filename:
        alvo = dest / (Path(filename).stem + ".info.json")
        if alvo.exists():
            return alvo
    achados = sorted(dest.glob("*.info.json"), key=lambda f: f.stat().st_mtime)
    return achados[-1] if achados else None


# Versao do sidecar. 1 (implicita, ausente no arquivo) = so audiencia; 2 = audiencia +
# legenda; 3 = os dois mais o nome do arquivo de miniatura; 4 = mais o tempo por PALAVRA da
# legenda (`captions.words`), que e o que permite a legenda do 9:16 quebrar no limite da
# palavra em vez de na janela rolante do YouTube. Quem LE trata a ausencia da chave como 1 e
# segue -- sidecar antigo continua valendo, porque reanalisar exigiria rebaixar o video de
# novo. Ninguem gateia por versao: a chave que faltar simplesmente nao existe, e o corte cai
# no comportamento de antes (fundo chapado no v1/v2, cue grossa sem o v4). 5 = mais a
# PROCEDENCIA do arquivo (fonte, titulo, criador, instante do download, e o estado da marca
# d'agua com a evidencia), que e o que o TikTok trouxe -- chave a mais, nada removido.
SIDECAR_VERSION = 5

# Extensoes que o yt-dlp escreve com --write-thumbnail (o YouTube costuma dar .webp; o
# TikTok grava `.image`, que e JPEG -- conferido com ffprobe, mjpeg 540x960).
THUMB_EXTS = (".webp", ".jpg", ".jpeg", ".png", ".image")

CAPTIONS_NONE = "CAPTIONS_NOT_AVAILABLE"
CAPTIONS_FAILED = "CAPTIONS_EXTRACTION_FAILED"


def _captions_empty(reason, note):
    return {"available": False, "language": "", "kind": "", "cues": [], "words": [],
            "reason": reason, "note": note}


def _captions(info):
    """Legenda do MESMO .info.json que ja esta no disco -- nenhuma chamada a mais ao yt-dlp.

    O `--write-info-json` do build_args ja traz as tabelas `subtitles`/`automatic_captions`
    com o endereco de cada faixa; so falta UM GET no json3, que e o que fetch_cues faz.

    Falha aqui nao contamina a audiencia: os dois blocos sao independentes de proposito,
    porque um video pode ter grafico sem legenda e legenda sem grafico.
    """
    try:
        bloco = _video_worker("ytclip").fetch_cues(info)
    except Exception as err:
        print("[CAPTIONS_EXTRACTION_FAILED]", err)
        return _captions_empty(CAPTIONS_FAILED, str(err)[:200])
    return {"available": bloco["available"], "language": bloco["language"],
            "kind": bloco["kind"], "reason": bloco["reason"], "note": bloco["note"],
            # `cues` = a janela do YouTube, que alimenta a RECOMENDACAO de cortes e nao pode
            # mudar. `words` = a MESMA legenda com o instante de cada palavra, que e o que a
            # legenda queimada usa para quebrar no limite da palavra. Sai do mesmo GET: as
            # duas listas vem da mesma leitura, nenhuma chamada a mais ao yt-dlp.
            "cues": bloco["cues"], "words": bloco.get("words") or []}


def _thumbnail(dest, filename):
    """Nome do arquivo de miniatura que o yt-dlp gravou ao lado do video, ou "".

    So o NOME, nunca o caminho: quem le e o Estudio, que resolve dentro da propria pasta de
    download (guarda de travessia la, do mesmo jeito que o do sidecar). Miniatura ausente
    nao e erro nem motivo de aviso -- o 9:16 volta ao fundo desfocado de sempre.
    """
    if not filename:
        return ""
    base = Path(filename).stem
    for ext in THUMB_EXTS:
        if (Path(dest) / (base + ext)).exists():
            return base + ext
    return ""


def _agora_iso():
    """Instante do download em ISO 8601 UTC (…Z). Sem fuso local: sidecar viaja de maquina."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _procedencia(info, filename):
    """De ONDE veio o arquivo, com a marca d'agua DO FORMATO QUE FOI BAIXADO.

    A leitura e do .info.json que o yt-dlp acabou de gravar -- ou seja, do formato que de
    fato virou arquivo, e nao da inspecao que o operador viu na tela minutos antes. Se as
    duas divergirem (o formato sumiu e o yt-dlp caiu no fallback do `/`), quem manda e o
    disco.

    Fora do TikTok o estado e "nao-se-aplica": o YouTube nao tem esse problema, e inventar
    "desconhecida" ali sugeriria uma duvida que nao existe.
    """
    fonte = str(info.get("extractor_key") or info.get("extractor") or "")
    fid = str(info.get("format_id") or "")
    if fonte.lower().startswith("tiktok"):
        estado, prova = tiktok.marca_dagua(
            {"format_id": fid, "format_note": info.get("format_note")})
    else:
        estado, prova = tiktok.NAO_SE_APLICA, "fonte sem marca d'água adicionada pela plataforma"
    return {
        "source": fonte,
        "title": str(info.get("title") or ""),
        "creator": str(info.get("uploader") or info.get("channel") or ""),
        "filename": str(filename or ""),
        "downloadedAt": _agora_iso(),
        "watermark": {"status": estado, "evidence": prova, "formatId": fid},
    }


def save_most_replayed(dest, filename):
    """Grava a ANALISE (audiencia + legenda) AO LADO do video. Devolve o dict gravado.

    Roda depois de o arquivo estar no disco, e falha aqui NUNCA derruba o download: o video
    ja existe e precisa seguir para os cortes. Os codigos do pedido ficam distintos em
    `reason`, para o Passo de Cortes saber se o video nao publica o grafico
    (MOST_REPLAYED_NOT_AVAILABLE) ou se fomos nos que falhamos
    (MOST_REPLAYED_EXTRACTION_FAILED) -- erro silencioso e indistinguivel de erro ausente.
    A legenda tem o par equivalente (CAPTIONS_NOT_AVAILABLE / CAPTIONS_EXTRACTION_FAILED).

    O nome ficou: renomear obrigaria a mexer em finish(), no teste e na documentacao para
    nao ganhar nada -- o arquivo continua sendo o `.mostreplayed.json` que o Estudio le.
    """
    hm = None
    try:
        hm = _video_worker("heatmap")
        caminho = _info_json(dest, filename)
        if caminho is None:
            raise IOError("o yt-dlp nao gravou .info.json")
        info = json.loads(caminho.read_text(encoding="utf-8", errors="replace"))
        bloco = hm.most_replayed(info.get("heatmap"))
        if not bloco["available"]:
            bloco["reason"] = "MOST_REPLAYED_NOT_AVAILABLE"
        registro = {
            "version": SIDECAR_VERSION,
            "videoId": str(info.get("id") or ""),
            "sourceUrl": str(info.get("webpage_url") or ""),
            "duration": float(info.get("duration") or 0.0),
            "mostReplayed": bloco,
            "captions": _captions(info),
            "thumbnail": _thumbnail(dest, filename),
        }
        registro.update(_procedencia(info, filename))
    except Exception as err:
        print("[MOST_REPLAYED_EXTRACTION_FAILED]", err)
        fonte = hm.SOURCE if hm else "youtube_heatmap"
        registro = {"version": SIDECAR_VERSION,
                    "videoId": "", "sourceUrl": "", "duration": 0.0,
                    # A miniatura nao depende do .info.json: ela e um arquivo no disco, e
                    # falhar em ler o heatmap nao e motivo para o 9:16 perder o fundo.
                    "thumbnail": _thumbnail(dest, filename),
                    "mostReplayed": {"available": False, "source": fonte, "points": [],
                                     "peaks": [],
                                     "reason": "MOST_REPLAYED_EXTRACTION_FAILED"},
                    # Sem .info.json legivel nao ha de onde tirar legenda tambem.
                    "captions": _captions_empty(CAPTIONS_FAILED, str(err)[:200])}
        # A procedencia existe mesmo aqui, com as chaves VAZIAS: sidecar de falha que omite
        # a marca d'agua e indistinguivel de sidecar que afirma "sem marca".
        registro.update(_procedencia({}, filename))
        registro["watermark"]["status"] = tiktok.DESCONHECIDA
        registro["watermark"]["evidence"] = "não foi possível ler o .info.json do download"
    try:
        nome = (Path(filename).stem if filename else "sem-nome") + ".mostreplayed.json"
        (Path(dest) / nome).write_text(
            json.dumps(registro, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError as err:
        print("[MOST_REPLAYED_EXTRACTION_FAILED] nao deu para gravar o arquivo:", err)
    return registro


def public(job):
    out = {"id": job["id"], "status": job["status"], "progress": job["progress"]}
    if job.get("filename"):
        out["filename"] = job["filename"]
    if job.get("error"):
        out["error"] = job["error"]
    if job.get("errorCode"):
        out["errorCode"] = job["errorCode"]
    if job.get("mostReplayed"):
        out["mostReplayed"] = job["mostReplayed"]
    if job.get("watermark"):
        out["watermark"] = job["watermark"]
    if job.get("sourceUrl"):
        out["sourceUrl"] = job["sourceUrl"]
    cc = job.get("captions")
    if cc:
        # RESUMO, nunca as falas: um podcast de 3 h tem milhares de cues e o popup so
        # precisa dizer "tem legenda, em que idioma, quantas falas". O texto inteiro fica
        # no sidecar, que e quem o Estudio le na hora de queimar a legenda no 9:16.
        out["captions"] = {"available": cc.get("available", False),
                           "language": cc.get("language", ""),
                           "kind": cc.get("kind", ""),
                           "reason": cc.get("reason", ""),
                           "count": len(cc.get("cues") or [])}
    return out


# --- execucao ----------------------------------------------------------------

def _is_busy():
    return bool(_active_id) and _jobs[_active_id]["status"] in ACTIVE_STATES


INSPECT_TIMEOUT = 90


def inspect(url):
    """Metadados + formatos SEM baixar midia. -> (info, mensagem_de_erro).

    Roda o mesmo yt-dlp do download, so que em modo dump. Nao mexe na trava do download:
    inspecionar enquanto um download roda e legitimo (e barato) -- o que nao pode e comecar
    um segundo download.
    """
    exe = config.yt_dlp_path()
    if not exe:
        return None, "yt-dlp não foi encontrado."
    args = [exe, "--ignore-config", "--no-playlist", "--no-warnings", "--encoding", "utf-8",
            "--dump-single-json", "--", url]
    for restam in range(TENTATIVAS - 1, -1, -1):
        try:
            r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                               errors="replace", timeout=INSPECT_TIMEOUT, shell=False,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except subprocess.TimeoutExpired:
            return None, ("A busca demorou demais (%ds) e foi cancelada. Tente de novo."
                          % INSPECT_TIMEOUT)
        except (OSError, ValueError):
            return None, "Não foi possível iniciar o yt-dlp."
        if r.returncode == 0:
            break
        cru = [l for l in (r.stderr or "").splitlines() if l.strip()]
        ultimo = cru[-1] if cru else ""
        if not (restam and e_desafio(ultimo)):
            return None, friendly_error(ultimo, bool(config.ffmpeg_path()))
        print("[DESAFIO_TIKTOK] busca repetida (%d restante(s))" % restam)
        time.sleep(ESPERA)
    try:
        return json.loads(r.stdout or "{}"), None
    except ValueError:
        # Saida ilegivel e falha nossa, nao "video indisponivel": dizer qual dos dois e.
        return None, "O yt-dlp respondeu algo que não consegui ler."


def start(url, spec=None, outtmpl=None, source_url=None):
    """-> (job_publico, None) | (None, "bad-url" | "no-ytdlp" | "busy")."""
    global _active_id
    if not valid_url(url):
        return None, "bad-url"
    exe = config.yt_dlp_path()
    if not exe:
        return None, "no-ytdlp"
    with _lock:
        if _is_busy():
            return None, "busy"
        job = new_job()
        job["sourceUrl"] = source_url or url.strip()
        _jobs[job["id"]] = job
        _active_id = job["id"]
        snapshot = public(job)
    threading.Thread(target=_run, args=(job, exe, url.strip(), spec, outtmpl),
                     daemon=True).start()
    return snapshot, None


def _run(job, exe, url, spec=None, outtmpl=None):
    dest = config.ensure_download_dir()
    has_ffmpeg = bool(config.ffmpeg_path())
    for restam in range(TENTATIVAS - 1, -1, -1):
        try:
            proc = subprocess.Popen(
                build_args(exe, url, dest, spec, outtmpl),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                bufsize=1, text=True, encoding="utf-8", errors="replace",
                shell=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except (OSError, ValueError):
            with _lock:
                job["status"] = "error"
                job["error"] = "Nao foi possivel iniciar o yt-dlp."
            return
        for line in proc.stdout:
            with _lock:
                consume_line(job, line)
        code = proc.wait()
        with _lock:
            if code == 0 or not (restam and e_desafio(job["_err"])):
                finish(job, code, dest, has_ffmpeg)
                return
            # O desafio morre antes do primeiro byte: nao ha .part nem meio arquivo para
            # limpar. So o que a tentativa morta escreveu NO JOB precisa voltar a zero,
            # senao a barra e o erro dela vazam para a tentativa seguinte. O status volta
            # para "queued", que segue em ACTIVE_STATES -- a trava de um download por vez
            # continua fechada durante a repeticao.
            print("[DESAFIO_TIKTOK] download repetido (%d restante(s)): %s"
                  % (restam, job["_err"][:200]))
            job.update({"status": "queued", "progress": 0, "filename": None, "error": None,
                        "_err": "", "_pct": 0.0, "_fase": 0})
        # FORA da trava: durante a espera o /job continua respondendo ao popup.
        time.sleep(ESPERA)


def get(job_id):
    with _lock:
        job = _jobs.get(job_id)
        return public(job) if job else None


def current():
    """O ultimo download deste helper (rodando OU terminado), ou None.

    E o que devolve a verdade quando o popup fecha e reabre: o dono do trabalho e o helper,
    nunca a janela. Fechar o popup nao cancela nada e reabrir nao perde o progresso.

    Helper reiniciado devolve None de proposito: o processo do yt-dlp morreu junto, o
    arquivo ficou pela metade (.part) e chamar isso de "concluido" seria mentira. Estado que
    nao sobreviveu ao reinicio nao pode ser reconstruido a partir do que sobrou no disco.
    """
    with _lock:
        job = _jobs.get(_active_id)
        return public(job) if job else None


def version(exe):
    try:
        r = subprocess.run([exe, "--version"], capture_output=True, text=True,
                           timeout=15, shell=False)
        return (r.stdout or "").strip() or "desconhecida"
    except (OSError, subprocess.SubprocessError):
        return "desconhecida"
