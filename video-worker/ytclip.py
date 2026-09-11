# -*- coding: utf-8 -*-
"""Descoberta de cortes a partir de uma URL do YouTube, SEM baixar o vídeo.

Por que existe: o Estúdio já corta arquivo local (worker.py + a rota /api/video-cut),
mas a fonte real do operador é uma live ou podcast que está no YouTube. Baixar 4 GB para
descobrir que só 40 s prestam é desperdício de disco, de banda e de tempo. Este módulo
separa DESCOBRIR de BAIXAR: `probe` lê só metadados e legenda (dezenas de KB), `candidates`
transforma isso em trechos sugeridos, e `fetch_section` só entra em cena depois que uma
pessoa aprovou o trecho — e aí baixa somente ele.

Sinais usados, em ordem de confiança:

1. `heatmap` — os 100 baldes do gráfico "Mais reproduzidos" que o próprio YouTube publica
   na página. É dado observado de audiência, não estimativa nossa. Nem todo vídeo tem
   (precisa de visualizações suficientes); quando não vem, NÃO se inventa nada: o campo
   sai vazio e os candidatos passam a citar só os sinais que existiram.
2. `chapters` — capítulos declarados por quem publicou. Marca troca de assunto.
3. Legenda — pausas longas, perguntas, números e frases de ênfase.
4. Classificação do assunto (`classify_segment`) — o mais fraco dos quatro: é palpite tirado
   das PALAVRAS da legenda (Dinheiro, Fracasso, Conselho…), nunca medição. Entra como
   `category` e como "assunto provável pela legenda: X" no `reason`, jamais como audiência.

O corte também precisa se sustentar sozinho: a janela foge de abrir em conector solto
("mas", "então", "isso") e, quando não há para onde recuar, avisa em `contextWarning`.

Cada candidato carrega em `signals` exatamente quais sinais o produziram, e em `reason` a
frase em português que explica isso ao operador (BP-008: automação que não diz o que fez é
indistinguível de automação quebrada).

Restrições herdadas de docs/video-ops/PESQUISA_FERRAMENTAS.md §10 (yt-dlp é exceção caso a
caso): nunca `--exec`, nunca `--netrc-cmd`, nunca cookies de navegador, nunca aria2c, nunca
nome de saída vindo do título. O portão de direitos autorais NÃO mora aqui — quem decide se
a fonte pode ser baixada é o video-ops.js, com `permissionCovers`, antes de chamar
`fetch_section`.

Lógica pura (`parse_json3`, `candidates` e auxiliares) exportada para test_ytclip.py.
"""

import json
import math
import os
import re
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worker  # noqa: E402  (WorkerError e os códigos de erro que o navegador já lê)
import captions  # noqa: E402  (normalize_cues: a regra única de sobreposição de legenda)
from heatmap import (  # noqa: E402  algoritmo unico, compartilhado com o baixador local
    SOURCE as HEATMAP_SOURCE, heatmap_peaks, most_replayed)

# ---------------------------------------------------------------- limites do corte
MIN_CLIP_SEC = 15.0
MAX_CLIP_SEC = 90.0
TARGET_CLIP_SEC = 45.0
# Teto SUAVE da história. Regra do usuário: "A strong 25-second idea can become one clip.
# A complete 70-second story can become another clip. Do not force every moment into the
# same duration." Passando disto, o próximo ponto final já serve de fecho — o teto duro
# (MAX_CLIP_SEC) continua sendo o limite absoluto, não a mira.
STORY_CLIP_SEC = 70.0
# Silêncio que separa uma ideia da seguinte. Abaixo disso o ponto final é só respiração no
# meio do raciocínio, não o fim dele.
CLOSE_PAUSE_SEC = 0.6
MAX_CANDIDATES = 12
# Duas sugestões que começam a menos disto uma da outra são a mesma sugestão.
MERGE_GAP_SEC = 8.0
# Fração do trecho MENOR que, sobreposta, já faz das duas a mesma sugestão. Era 0,5 e
# deixava passar par com 43% em comum (medido: 25:04-25:41 e 25:28-25:57 no vídeo do
# print) — dois cartões, treze segundos idênticos, e o operador escolhendo entre gêmeos.
MERGE_OVERLAP = 0.35
# Abertura do VÍDEO, onde o gráfico de audiência do YouTube é alto por construção: quem
# abre o vídeo assiste os primeiros segundos, então o primeiro balde mede carregamento de
# página e não interesse editorial. MEDIDO no vídeo do print (bNkQaTQ4SE0): o balde de
# 0 s a 22,4 s marca 65% do maior pico do vídeo — e era a única razão pela qual a abertura
# entrava na lista com nota 72. Não é lista negra de palavra de abertura (o pedido proíbe
# isso): é desconto no SINAL DE MEDIÇÃO, no trecho onde a medição é sabidamente enviesada.
ABERTURA_VIDEO_SEC = 30.0

PROBE_TIMEOUT = 120.0
FETCH_TIMEOUT = 900.0
CAPTION_TIMEOUT = 45.0
# Teto do arquivo de legenda: um json3 de podcast de 4 h fica em ~2 MB. Acima de 16 MB não é
# legenda, é outra coisa — recusar antes de dar json.loads em lixo.
CAPTION_MAX_BYTES = 16 * 1024 ** 2

# Só id de vídeo do YouTube. Vira nome de arquivo no temporário, então a lista é fechada.
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_HOSTS = ("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
                 "music.youtube.com")

# Idiomas tentados na legenda, em ordem. Códigos EXATOS de propósito: `en.*` casa com
# `en-ar`, `en-zh` e as outras 150 traduções automáticas do YouTube — medido, não suposto.
CAPTION_LANGS = ("pt", "pt-BR", "pt-orig", "en", "en-orig", "es")
# Extensões que o `--write-thumbnail` pode gravar ao lado do trecho. Lista FECHADA e usada
# nos dois sentidos: para não confundir a imagem com o vídeo ao escolher o arquivo
# produzido, e para achar a miniatura na hora do render. Sem `--convert-thumbnails`, que
# exigiria FFmpeg no PATH de quem baixa — o formato que vier serve.
# `.image` e a capa do TikTok: o yt-dlp grava com essa extensao, e o arquivo e JPEG
# (conferido com ffprobe: mjpeg 540x960). Fora da lista, o `produced_media` poderia devolver
# a CAPA no lugar do video e o `cut_background` recusaria um fundo perfeitamente bom.
THUMB_EXTS = (".webp", ".jpg", ".jpeg", ".png", ".image")

# Marcas de fala que costumam abrir um corte bom. Sem promessa de viralização: são pistas
# textuais, não previsão de desempenho.
HOOK_PATTERNS = (
    (re.compile(r"\?"), 12, "pergunta direta"),
    (re.compile(r"\b\d{1,3}(?:[.,]\d+)?\s*(?:%|por cento|mil|milh[oõ]es?|reais|anos?)\b", re.I), 14, "número concreto"),
    (re.compile(r"\b(?:nunca|sempre|ningu[eé]m|todo mundo|o segredo|a verdade|na real|o erro|pior|melhor)\b", re.I), 12, "afirmação forte"),
    (re.compile(r"\b(?:never|always|nobody|everyone|the secret|the truth|the mistake|worst|best)\b", re.I), 10, "afirmação forte"),
    (re.compile(r"\b(?:por que|porque|o motivo|explic|na prática|exemplo|imagina)\b", re.I), 8, "explicação"),
    (re.compile(r"\b(?:why|because|the reason|for example|imagine|let's say)\b", re.I), 7, "explicação"),
)
SENTENCE_END_RE = re.compile(r"[.!?…]$")


# --------------------------------------------------------------------- entrada
def video_id(url):
    """Extrai o id de 11 caracteres. Recusa qualquer host que não seja do YouTube.

    A recusa é por host e não por regex solta na URL inteira porque `fetch_section` passa
    esta URL para um processo externo: aceitar qualquer coisa aqui seria entregar o
    argumento de rede para quem colar o link.
    """
    from urllib.parse import urlparse, parse_qs
    raw = str(url or "").strip()
    if not raw:
        raise worker.WorkerError("job_invalid", "Cole o endereço do vídeo.")
    try:
        parts = urlparse(raw)
    except ValueError:
        raise worker.WorkerError("job_invalid", "Endereço inválido.")
    if parts.scheme not in ("http", "https"):
        raise worker.WorkerError("job_invalid", "O endereço precisa começar com http ou https.")
    host = (parts.hostname or "").lower()
    if host not in YOUTUBE_HOSTS:
        raise worker.WorkerError(
            "job_invalid",
            "Esta rota só aceita vídeo do YouTube; recebeu %s." % (host or "endereço sem host"))
    if host == "youtu.be":
        found = parts.path.lstrip("/").split("/")[0]
    elif parts.path.startswith(("/shorts/", "/live/", "/embed/", "/v/")):
        found = parts.path.split("/")[2] if len(parts.path.split("/")) > 2 else ""
    else:
        found = (parse_qs(parts.query).get("v") or [""])[0]
    if not VIDEO_ID_RE.match(found):
        raise worker.WorkerError("job_invalid", "Não achei o id do vídeo neste endereço.")
    return found


# --------------------------------------------------------------------- legenda
def parse_json3(raw):
    """json3 do YouTube -> [{'start','end','text'}] em segundos, ordenado e sem vazio.

    Legenda manual vem em frases pontuadas; a automática vem palavra a palavra com
    `tOffsetMs`. As duas caem no mesmo formato aqui — quem consome não precisa saber qual é.
    """
    try:
        data = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    except (ValueError, TypeError):
        raise worker.WorkerError("job_invalid", "A legenda veio num formato ilegível.")
    cues = []
    for event in (data or {}).get("events") or []:
        segs = event.get("segs") or []
        text = "".join(str(s.get("utf8") or "") for s in segs)
        text = re.sub(r"\s+", " ", text.replace("\n", " ")).strip()
        if not text:
            continue
        start_ms = event.get("tStartMs")
        if start_ms is None:
            continue
        dur_ms = event.get("dDurationMs") or 0
        start = float(start_ms) / 1000.0
        cues.append({"start": start, "end": start + float(dur_ms) / 1000.0, "text": text})
    cues.sort(key=lambda c: c["start"])
    # A legenda automática repete a linha anterior enquanto digita a próxima. Duas falas
    # com o mesmo texto e mesmo início são a mesma fala renderizada duas vezes.
    unique = []
    for cue in cues:
        if unique and cue["text"] == unique[-1]["text"] and abs(cue["start"] - unique[-1]["start"]) < 0.05:
            unique[-1]["end"] = max(unique[-1]["end"], cue["end"])
            continue
        unique.append(cue)
    return unique


def parse_json3_words(raw):
    """json3 -> [{'start','end','text'}] por PALAVRA. Pura. NAO substitui o `parse_json3`.

    Segunda leitura do MESMO arquivo, so para EXIBICAO. O `parse_json3` concatena os `segs`
    de cada evento e joga fora o `tOffsetMs` de cada palavra -- e continua fazendo isso de
    proposito: o `candidates()` mede a pausa ENTRE FALAS naquela grade para decidir onde o
    corte fecha, e mexer nela mudaria a RECOMENDACAO de cortes, que nao e o que esta funcao
    resolve.

    Medido no arquivo cru de um podcast de 53 min (3406 eventos, 1703 de texto): 94,8% dos
    eventos de texto trazem `tOffsetMs` e os outros tem UMA palavra so, cujo offset e 0
    implicito -- entao as 10857 palavras tem instante absoluto, e o parse por palavra vale
    para 100% do arquivo. Legenda MANUAL nao traz offset nenhum: cada evento vira UMA
    "palavra" com a frase inteira, e o resultado degrada para a cue grossa de sempre.

    O FIM de cada palavra e o INICIO da seguinte. O json3 so da instante de INICIO, e a
    `dDurationMs` do evento e a janela rolante que mente (medido: cobre ~2 eventos de texto,
    invadindo o seguinte em 1697 de 1702 pares). Encadear e honesto porque a grade de
    palavras e monotonica e sem sobreposicao -- medido, zero negativo em 10857 palavras. A
    ultima palavra fica no ar `captions.PAUSA_LINHA_SEC`, o mesmo rabo de linha do
    reagrupamento.

    Evento sem `tStartMs` e seg que strippa para vazio (o "
" dos `aAppend` da rolagem, 1702
    deles no arquivo medido) sao ignorados: nao ha tempo nem texto para inventar.
    """
    try:
        data = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    except (ValueError, TypeError):
        raise worker.WorkerError("job_invalid", "A legenda veio num formato ilegivel.")
    palavras = []
    for event in (data or {}).get("events") or []:
        start_ms = event.get("tStartMs")
        if start_ms is None:
            continue
        for seg in event.get("segs") or []:
            texto = " ".join(str(seg.get("utf8") or "").split())
            if not texto:
                continue
            try:
                base = float(start_ms) + float(seg.get("tOffsetMs") or 0)
            except (TypeError, ValueError):
                continue
            palavras.append({"start": max(0.0, base / 1000.0), "end": 0.0, "text": texto})
    palavras.sort(key=lambda p: p["start"])
    for posicao, palavra in enumerate(palavras):
        # SEM piso de duracao aqui: a grade tem de ficar estritamente crescente, e na amostra
        # o passo entre palavras chega a 20 ms -- menos que o MIN_CUE_SEC. Um piso de 50 ms
        # punha quatro pares de palavras em sobreposicao, e sobreposicao e o defeito que este
        # caminho existe para nao ter. O piso de LEITURA e da LINHA, que e o que aparece na
        # tela, e mora no `captions.cues_from_words`.
        palavra["end"] = (palavras[posicao + 1]["start"] if posicao + 1 < len(palavras)
                          else palavra["start"] + captions.PAUSA_LINHA_SEC)
    return palavras


def pick_caption_track(info):
    """Escolhe a faixa json3. IDIOMA manda; dentro do idioma, humano ganha da automática.

    O laço externo é o de IDIOMA de propósito. Com a ordem invertida (fonte por fora) uma
    legenda MANUAL em espanhol vencia uma AUTOMÁTICA em pt-BR — e o corte saía legendado em
    espanhol num podcast brasileiro. A ordem certa é a de CAPTION_LANGS: todo o português
    antes de qualquer outro idioma, e a automática de pt só perde para a manual de pt.

    Devolve (url, lang, kind) ou (None, '', '') — ausência de legenda não é erro: o vídeo
    pode ter capítulos e heatmap, e a detecção segue com o que existir.
    """
    for lang in CAPTION_LANGS:
        for source, kind in ((info.get("subtitles"), "manual"),
                             (info.get("automatic_captions"), "automatica")):
            for track in (source or {}).get(lang) or []:
                if track.get("ext") == "json3" and track.get("url"):
                    return track["url"], lang, kind
    return None, "", ""


# Motivos separados de propósito, do mesmo jeito que os de "Mais reproduzidos": o vídeo não
# publicar legenda é o normal, nós falharmos ao buscá-la é defeito. Colapsar os dois num
# "sem legenda" genérico esconderia o segundo caso para sempre.
CAPTIONS_NONE = "CAPTIONS_NOT_AVAILABLE"
CAPTIONS_FAILED = "CAPTIONS_EXTRACTION_FAILED"


def fetch_cues(info, timeout=CAPTION_TIMEOUT):
    """`.info.json` -> bloco de legenda. UM GET; nenhum byte de vídeo.

    Ponto único de extração de legenda do projeto: o `probe()` (análise por URL, no Estúdio)
    e o baixador local chamam esta MESMA função. Duas cópias divergiriam no primeiro ajuste
    de idioma, e o 9:16 legendado depende de os dois lados verem as mesmas falas.

    Ausência de legenda nunca é fatal: o vídeo pode ter capítulo e audiência, e o 9:16
    renderiza sem legenda. O que não pode é ser calado — daí `reason` e `note`.
    """
    url, lang, kind = pick_caption_track(info or {})
    vazio = {"available": False, "language": "", "kind": "", "cues": [], "words": []}
    if not url:
        return dict(vazio, reason=CAPTIONS_NONE,
                    note="Este vídeo não publica legenda em %s." % ", ".join(CAPTION_LANGS))
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(CAPTION_MAX_BYTES + 1)
        if len(raw) > CAPTION_MAX_BYTES:
            raise IOError("passou de %d bytes" % CAPTION_MAX_BYTES)
        texto = raw.decode("utf-8", "replace")
        cues = parse_json3(texto)
        # Duas leituras do MESMO texto ja baixado: a grossa alimenta a RECOMENDACAO de
        # cortes (nao pode mudar) e a por palavra alimenta a EXIBICAO. Nenhum GET a mais.
        palavras = parse_json3_words(texto)
    except Exception as err:
        # Rede fora, json torto, arquivo gigante: degradar é o requisito. Antes desta função
        # um json3 malformado subia WorkerError e derrubava a análise INTEIRA — o vídeo perdia
        # capítulo e audiência por causa da legenda.
        return dict(vazio, reason=CAPTIONS_FAILED,
                    note="A legenda não pôde ser lida (%s); a detecção usou só capítulos "
                         "e audiência." % err)
    if not cues:
        return dict(vazio, language=lang, kind=kind, reason=CAPTIONS_NONE,
                    note="A faixa de legenda deste vídeo veio vazia.")
    return {"available": True, "language": lang, "kind": kind, "cues": cues,
            "words": palavras, "reason": "", "note": ""}


# --------------------------------------------------------------------- sinais
def hook_hits(text):
    """Pistas textuais encontradas numa fala -> (pontos, [rótulos])."""
    points = 0
    labels = []
    for pattern, weight, label in HOOK_PATTERNS:
        if pattern.search(text):
            points += weight
            if label not in labels:
                labels.append(label)
    return points, labels


# --------------------------------------------- assunto do trecho (palpite pela legenda)
def _norm(text):
    """minúsculas, sem acento, sem pontuação e cercado de espaço.

    Cercar de espaço é o truque que faz `" erro " in texto` valer casamento de PALAVRA (e
    não de pedaço de "erroneamente") sem pagar uma regex por termo — e faz frase de duas
    palavras casar pelo mesmo caminho, sem caso especial. Tirar acento é obrigatório: a
    legenda automática do YouTube escreve "licao" e "opiniao" o tempo todo.
    """
    raw = unicodedata.normalize("NFD", str(text or "").lower())
    flat = "".join(ch for ch in raw if not unicodedata.combining(ch))
    return " %s " % re.sub(r"[^0-9a-z]+", " ", flat).strip()


def _terms(*words):
    """[(exibição, normalizado)] do mais longo pro mais curto.

    A forma de exibição sobrevive porque ela vai para a tela do operador ("Começa com
    'então'"), e "entao" sem acento na interface parece defeito. Ordenar por tamanho faz
    "isso aí" ganhar de "isso" no casamento de abertura.
    """
    pairs = [(w, _norm(w).strip()) for w in words if _norm(w).strip()]
    pairs.sort(key=lambda pair: -len(pair[1]))
    return tuple(pairs)


# Requisito do usuário: "Each candidate should be classified when possible: Business,
# Mindset, Money, Career, Leadership, Discipline, Experience, Failure, Success, Advice,
# Life Lesson, Strong Opinion, Reflection."
# O vocabulário é de podcast de negócio BRASILEIRO — por isso PT-BR primeiro, com um punhado
# de termos em inglês só como rede (a legenda às vezes só existe em en). Poucos termos
# certeiros valem mais que uma lista gigante de termo fraco: cada termo aqui é uma palavra
# que uma pessoa realmente fala nesse contexto.
CATEGORY_LEXICON = {
    "money": _terms(
        "faturamento", "faturei", "fatura", "lucro", "margem", "caixa", "fluxo de caixa",
        "investimento", "investir", "prejuízo", "dívida", "dívidas", "custo", "custos",
        "receita", "capital", "juros", "patrimônio", "milhão", "milhões",
        "revenue", "profit", "cash flow", "investment", "debt"),
    "failure": _terms(
        "errei", "errou", "fracasso", "fracassei", "quebrei", "quebrou", "perdi tudo",
        "falhou", "falhei", "deu errado", "não deu certo", "aprendi da pior forma",
        "tomei prejuízo", "me ferrei", "furada", "erro",
        "mistake", "failure", "failed", "went wrong", "lost everything"),
    "success": _terms(
        "deu certo", "sucesso", "conquistei", "consegui", "funcionou", "dobrei",
        "tripliquei", "virou o jogo", "bati a meta", "alcancei", "cresceu muito",
        "deu resultado", "vitória",
        "it worked", "success", "we grew", "achieved"),
    "advice": _terms(
        "se eu fosse você", "meu conselho", "o conselho que eu dou", "eu recomendo",
        "recomendo", "comece por", "comece pelo", "não faça", "nunca faça", "evite",
        "a dica é", "minha dica", "o primeiro passo", "faça isso", "anota aí",
        "my advice", "if i were you", "start with", "you should", "my tip"),
    "life_lesson": _terms(
        "lição", "lições", "aprendi", "aprendizado", "a vida ensina", "me ensinou",
        "ficou a lição", "hoje eu sei", "com o tempo eu aprendi", "entendi que",
        "lesson", "i learned", "life taught me", "taught me"),
    "strong_opinion": _terms(
        "na minha opinião", "eu acho que", "a verdade é", "ninguém fala", "ninguém te conta",
        "todo mundo erra", "todo mundo faz errado", "eu discordo", "sinceramente",
        "é mentira", "é balela", "não acredito em", "eu odeio", "pra mim é",
        "in my opinion", "the truth is", "nobody talks about", "i disagree"),
    "business": _terms(
        "negócio", "negócios", "empresa", "empreender", "empreendedor", "empreendedorismo",
        "modelo de negócio", "mercado", "concorrência", "escalar", "operação", "sócio",
        "clientes", "vendas", "produto", "marca",
        "business", "company", "market", "startup", "customers"),
    "mindset": _terms(
        "mentalidade", "mindset", "zona de conforto", "pensar grande", "acreditar em si",
        "autoconfiança", "autossabotagem", "medo de", "coragem", "ambição",
        "cabeça no lugar", "mentalidade de dono",
        "mindset", "comfort zone", "self belief", "fear of"),
    "career": _terms(
        "carreira", "emprego", "clt", "demitido", "demissão", "fui contratado", "contratação",
        "currículo", "entrevista de emprego", "entrevista", "promoção", "salário",
        "primeiro emprego", "mudar de área", "estágio",
        "career", "job interview", "got hired", "got fired", "promotion", "salary"),
    "leadership": _terms(
        "liderança", "liderar", "líder", "equipe", "time", "gestão", "gerenciar", "delegar",
        "cultura da empresa", "gestor", "dar exemplo", "cobrar resultado", "montar time",
        "leadership", "leader", "my team", "delegate", "company culture"),
    "discipline": _terms(
        "disciplina", "disciplinado", "rotina", "constância", "consistência", "hábito",
        "hábitos", "todo dia", "acordar cedo", "persistência", "não desistir", "insistir",
        "repetição", "força de vontade",
        "discipline", "routine", "consistency", "every day", "showing up"),
    "experience": _terms(
        "minha experiência", "na minha época", "quando eu comecei", "eu passei por",
        "aconteceu comigo", "eu lembro", "minha história", "já passei por", "no meu caso",
        "eu vivi isso", "na época eu",
        "my experience", "when i started", "i remember", "in my case", "i went through"),
    "reflection": _terms(
        "fico pensando", "faz pensar", "reflexão", "refletir", "será que", "no fundo",
        "olhando pra trás", "se eu parar pra pensar", "vale a pena", "o sentido disso",
        "o que importa de verdade", "eu penso muito",
        "i wonder", "looking back", "what really matters", "is it worth it"),
}

CATEGORY_LABELS = {
    "money": "Dinheiro", "failure": "Fracasso", "success": "Sucesso", "advice": "Conselho",
    "life_lesson": "Lição de vida", "strong_opinion": "Opinião forte",
    "business": "Negócios", "mindset": "Mentalidade", "career": "Carreira",
    "leadership": "Liderança", "discipline": "Disciplina",
    "experience": "Experiência", "reflection": "Reflexão",
}

# Requisito do usuário: "The system should prioritize moments containing: strong opinions;
# practical advice; lessons learned; mistakes; failures; success stories; ... money insights".
# Estas seis carregam sozinhas um corte; as outras sete são contexto, não gancho.
STRONG_CATEGORIES = ("failure", "success", "advice", "life_lesson", "strong_opinion", "money")

# Aberturas que penduram o sentido numa frase que ficou FORA do corte.
DANGLING_OPENERS = _terms(
    "e", "mas", "então", "aí", "aí sim", "isso aí", "porque", "por isso", "por causa disso",
    "isso", "esse", "essa", "daí", "assim", "dessa forma", "ele", "ela", "eles", "elas",
    "and", "but", "so", "then", "because", "that", "this", "it", "he", "she", "which")


def classify_segment(text):
    """Texto do trecho -> {'category','confidence','matched'}. Função pura.

    PALPITE TIRADO DA LEGENDA, e apresentado como tal. Diferente do heatmap (audiência
    observada), aqui não há medição nenhuma: a confiança é só quantos termos distintos da
    categoria apareceram no que a pessoa falou. Sem nenhum termo, a categoria sai VAZIA em
    vez de sair chutada — palpite silencioso é indistinguível de palpite errado (BP-008).
    """
    norm = _norm(text)
    best_slug, best_hits, best_weight = "", [], 0
    for slug, terms in CATEGORY_LEXICON.items():
        hits, weight = [], 0
        for display, flat in terms:
            if (" %s " % flat) in norm:
                hits.append(display)
                # Frase de duas palavras ("se eu fosse você") é evidência bem mais forte que
                # palavra solta ("faça"), que aparece em qualquer conversa.
                weight += 2 if " " in flat else 1
        if weight > best_weight:
            best_slug, best_hits, best_weight = slug, hits, weight
    if not best_slug:
        return {"category": "", "confidence": 0, "matched": []}
    return {"category": best_slug,
            "confidence": min(100, 25 + 15 * best_weight),
            "matched": best_hits[:8]}


def _dangling_opener(text):
    """Conector solto na PRIMEIRA palavra do trecho -> a palavra; senão ''. Função pura.

    Regra do usuário: "A clip must make sense independently from the full podcast. Do not
    select a segment only because it contains an interesting sentence if the viewer cannot
    understand it without previous context." Corte que abre em "mas"/"então"/"isso" aponta
    para uma frase que ficou de fora — quem assiste cai no meio do raciocínio alheio.
    """
    head = _norm(text)
    for display, flat in DANGLING_OPENERS:
        if head.startswith(" %s " % flat):
            return display
    return ""


# ------------------------------------------------- grade de FRASES (borda do corte)
# A borda do corte é medida na FRASE, não na cue — e esta é a correção mais cara desta
# entrega. MEDIDO no vídeo do print (bNkQaTQ4SE0, 988 cues / 6408 palavras): a legenda
# rolante do YouTube fecha a cue no MEIO da oração, então 12 de 12 candidatos abriam no
# meio de uma frase ("total. Eh, é super importante…", "mais qualidade. O teu negócio
# é um", "gente faz aqui no G4, né?") e 10 de 12 fechavam mal — 4 no meio da oração e
# 7 com a fala ainda no ar na hora do corte (um deles nos dois). O ponto
# final que o detector antigo procurava mora DENTRO do texto da cue e não no fim dele —
# por isso recuar de cue em cue nunca chegava ao começo da oração, e por isso o `$` do
# SENTENCE_END_RE contra o texto da cue era pergunta feita à grade errada.
FRASE_PAUSA_SEC = 0.45
# Fala sem pontuação nenhuma existe (legenda automática antiga, inglês). Ela fecha por
# tamanho para não virar uma "frase" de três minutos que engole a janela inteira.
FRASE_MAX_SEC = 22.0
# Silêncio que, sozinho, ENCERRA a ideia mesmo sem ponto final. Bem maior que o
# CLOSE_PAUSE_SEC de propósito: 0,6 s é respiração, 1,1 s é fim de assunto. É o que dá
# saída honesta para faixa sem pontuação — sem ele, track sem ponto nunca fecharia e a
# análise devolveria lista vazia num vídeo que tem, sim, momentos bons.
FECHO_PAUSA_SEC = 1.1
# Respiro nas pontas: o corte não começa no ataque exato da consoante nem termina no
# último milissegundo da sílaba. Teto curto — abertura morta é defeito, não elegância.
# O respiro só ocupa silêncio que JÁ existe (metade da folga), então nunca invade a fala
# vizinha: é o que impede "cortar a primeira consoante" sem inventar tempo.
RESPIRO_ANTES_SEC = 0.12
RESPIRO_DEPOIS_SEC = 0.30
# Quanto o detector pode andar em volta do sinal procurando um momento COMPLETO. O pedido
# é explícito: "A high replay peak may justify searching nearby for a complete moment; it
# does not justify a fixed window centered on the peak."
BUSCA_FRASES = 3

# Marcadores de NÃO-FALA da legenda automática: `[risadas]`, `[música]`, `[aplausos]` e o
# `[ __ ]` da censura. Medida SÓ da análise — o dono da limpeza para EXIBIÇÃO continua
# sendo `captions.strip_artifacts`, que não é tocado aqui: "Preserve the original timed
# transcript. Maintain a separate normalized representation for analysis and display."
NAO_FALA_RE = re.compile(r"\[[^\]]{0,40}\]")
FALANTE_RE = re.compile(r">>+")
# Densidade acima da qual o trecho é ruído, não fala aproveitável. Ambas medidas POR
# MINUTO para não punir clipe curto. Calibradas contra o caso real: a abertura 0:00-0:40
# do vídeo do print tem 4 `[ __ ]` e 2 trocas de falante em 40 s (6,0/min e 3,0/min).
NAO_FALA_POR_MIN = 3.0
TROCA_POR_MIN = 2.6
# Piso de fala de verdade dentro do trecho. Abaixo disso é música, vinheta ou silêncio.
FALA_MIN_PALAVRAS = 12
ABERTURA_MIN_PALAVRAS = 4

# Os cinco fatores editoriais e o teto do sinal de popularidade. Somam 88 + 12 = 100, e
# essa divisão é a regra do pedido em número: "Do not allow replay popularity to
# compensate for a missing answer, truncated conclusion, or unusable transcript."
# Audiência entra como EMPURRÃO (12 pontos no máximo), nunca como resgate — e os três
# fatores de veto (abertura, independência, fecho) reprovam ANTES de somar nota.
FATORES = (
    ("abertura", 20, "Abertura"),
    ("independencia", 18, "Independência"),
    ("desenvolvimento", 18, "Desenvolvimento"),
    ("fecho", 20, "Fecho"),
    ("confiabilidade", 12, "Confiabilidade"),
)
INTERESSE_PESO = 12
VETO = ("abertura", "independencia", "fecho")
# Rótulo de qualidade. O card mostra a PALAVRA, nunca o número: "Remove misleading
# precision from the default card presentation... must not be displayed as a probability
# of success." O número continua existindo para ORDENAR e vem com `factors` atrás, que é
# a decomposição rastreável que o pedido exige.
#
# O rótulo sai do PERFIL DOS FATORES, não de um corte na soma — e a razão é medida: no
# vídeo do print os nove aprovados caem entre 82 e 91 pontos, então qualquer corte em cima
# da soma põe todos na mesma faixa e o rótulo não informa nada. Contar quantos fatores
# estão fortes distingue "os cinco em pé" de "três em pé e dois raspando", que é a
# diferença que o operador precisa ver. E não depende de audiência: `interesse` fica fora
# desta conta de propósito.
FORTE_PISO = 0.7           # nenhum fator abaixo disto
FORTE_CHEIOS = 3           # e pelo menos três no máximo
BOM_PISO = 0.6


def _palavras_de(texto):
    """Quantas palavras FALADAS o texto tem (sem `>>`, sem `[risadas]`). Pura."""
    limpo = NAO_FALA_RE.sub(" ", FALANTE_RE.sub(" ", str(texto or "")))
    return len([w for w in limpo.split() if any(ch.isalnum() for ch in w)])


def _juntar(pedacos):
    """Pedaços contíguos -> uma frase. O texto de EXIBIÇÃO passa pelo dono único da
    limpeza (`captions.strip_artifacts`); nenhum instante é lido ou escrito aqui."""
    texto = " ".join(str(p["text"]).strip() for p in pedacos if str(p.get("text") or "").strip())
    inicio = float(pedacos[0]["start"])
    fim = max(float(p.get("end") or p["start"]) for p in pedacos)
    return {"start": round(inicio, 3), "end": round(max(fim, inicio), 3),
            "text": " ".join(texto.split()),
            "clean": captions.strip_artifacts(texto),
            "pauseAfter": 0.0, "wordLevel": False}


def _fechar_pausas(frases):
    """Preenche `pauseAfter` e `hardStart` e devolve a grade ordenada.

    `hardStart` é a diferença entre "aqui começa uma oração" e "aqui a pessoa respirou".
    Sem ela o corte abria em fragmento: `FRASE_PAUSA_SEC` é 0,45 s, e 0,45 s de silêncio
    dentro de uma frase é comum na fala — foi assim que saíram aberturas como "Você criou
    uma gordura que te dê um conforto" e "Tomar decisão financeira, mas eu acho". Só conta
    como início FIRME o que vem depois de ponto final, de silêncio longo ou de troca de
    falante. Na grade grossa (sem palavra a palavra) toda frase termina em ponto por
    construção, então todas são firmes e o comportamento antigo é preservado.
    """
    frases = [f for f in frases if f["end"] > f["start"] and f["text"]]
    frases.sort(key=lambda f: (f["start"], f["end"]))
    for pos, frase in enumerate(frases):
        seguinte = frases[pos + 1] if pos + 1 < len(frases) else None
        frase["pauseAfter"] = (round(max(0.0, seguinte["start"] - frase["end"]), 3)
                               if seguinte else 99.0)
    for pos, frase in enumerate(frases):
        if pos == 0 or FALANTE_RE.match(frase["text"]):
            frase["hardStart"] = True
            continue
        anterior = frases[pos - 1]
        frase["hardStart"] = bool(SENTENCE_END_RE.search(anterior["text"].rstrip())
                                  or anterior["pauseAfter"] >= FECHO_PAUSA_SEC)
    return frases


def _sentences_from_words(words):
    """Palavras com instante absoluto -> frases. A borda cai no instante da PALAVRA."""
    frases, buffer_, limpos = [], [], []
    for p in words or []:
        if not isinstance(p, dict):
            continue
        texto = " ".join(str(p.get("text") or "").split())
        if not texto:
            continue
        try:
            inicio = float(p["start"])
            fim = float(p.get("end") or inicio)
        except (KeyError, TypeError, ValueError):
            continue
        limpos.append({"start": inicio, "end": max(fim, inicio), "text": texto})
    limpos.sort(key=lambda p: p["start"])
    for pos, palavra in enumerate(limpos):
        # `>>` é TROCA DE FALANTE, e troca de falante nunca cai no meio de uma oração:
        # ela abre frase nova. É a única pista de "speaker turn" que o json3 publica.
        if buffer_ and FALANTE_RE.match(palavra["text"]):
            frases.append(_juntar(buffer_))
            buffer_ = []
        buffer_.append(palavra)
        seguinte = limpos[pos + 1] if pos + 1 < len(limpos) else None
        pausa = (seguinte["start"] - palavra["end"]) if seguinte else 99.0
        pontuou = bool(SENTENCE_END_RE.search(palavra["text"].rstrip()))
        estourou = (palavra["end"] - buffer_[0]["start"]) >= FRASE_MAX_SEC
        if pontuou or pausa >= FRASE_PAUSA_SEC or estourou or seguinte is None:
            frases.append(_juntar(buffer_))
            buffer_ = []
    if buffer_:
        frases.append(_juntar(buffer_))
    for frase in frases:
        frase["wordLevel"] = True
    return _fechar_pausas(frases)


def _sentences_from_cues(cues):
    """Sem palavra a palavra: agrupa CUE até o ponto final. Borda ESTIMADA, e o
    `wordLevel=False` diz isso a quem consome — o pedido manda distinguir borda estimada
    por texto de borda conferida na mídia, e este é o primeiro degrau dessa distinção."""
    frases, buffer_ = [], []
    for cue in cues or []:
        texto = " ".join(str(cue.get("text") or "").split())
        if not texto:
            continue
        buffer_.append({"start": float(cue["start"]), "end": float(cue["end"]), "text": texto})
        if SENTENCE_END_RE.search(texto.rstrip()):
            frases.append(_juntar(buffer_))
            buffer_ = []
    if buffer_:
        frases.append(_juntar(buffer_))
    return _fechar_pausas(frases)


def _silencios_das_cues(cues):
    """[(instante, duração)] dos silêncios MEDIDOS na grade grossa. Pura.

    Existe porque a grade por PALAVRA não tem pausa nenhuma, por construção: o
    `parse_json3_words` põe o `end` de cada palavra no `start` da seguinte (a `dDurationMs`
    do evento é a janela rolante, que mente). MEDIDO no vídeo do print: 0 de 496 pausas na
    grade por palavra, contra 9 de 146 acima de CLOSE_PAUSE_SEC na grade de cue, a maior de
    12,8 s. Sem cruzar as duas, `FECHO_PAUSA_SEC`, `CLOSE_PAUSE_SEC` e o respiro do fim
    ficavam INERTES justo no caminho bom — código vivo que nunca roda é pior que código
    removido, porque parece cobertura.

    A cue rolante do YouTube se sobrepõe à seguinte, então lacuna aqui é rara e é justamente
    o silêncio de verdade. Nada daqui muda instante nenhum: só ANOTA quanto durou a pausa.
    """
    lacunas = []
    limite = 0.0
    for cue in cues or []:
        try:
            inicio, fim = float(cue["start"]), float(cue["end"])
        except (KeyError, TypeError, ValueError):
            continue
        if limite and inicio - limite > 0.05:
            lacunas.append((limite, round(inicio - limite, 3)))
        limite = max(limite, fim)
    return lacunas


# Quanto as duas grades podem discordar sobre ONDE a pausa começa. Elas medem a mesma fala
# por caminhos diferentes (palavra a palavra × janela rolante), então casar no instante
# exato não acontece — e um casamento largo demais colaria a pausa na frase errada.
PAUSA_TOLERANCIA_SEC = 0.4


def sentences_from(cues, words=None):
    """Legenda -> FRASES com instante ABSOLUTO. Grade ÚNICA das bordas do corte.

    Com `words` (o `parse_json3_words`) a borda cai no instante da PALAVRA, que é a
    evidência de tempo mais fina que a fonte publica. Sem ela — legenda manual, sidecar
    antigo, faixa sem `tOffsetMs` — degrada para a cue grossa e `wordLevel` sai False.

    A DURAÇÃO da pausa vem sempre da grade de cue (ver `_silencios_das_cues`): é a única
    das duas que a mede. Borda pela palavra, pausa pela cue — cada grandeza com a grade que
    tem a evidência dela.

    `parse_json3` NÃO é tocado: esta é uma SEGUNDA leitura da mesma legenda, do lado da
    análise, exatamente como o `parse_json3_words` já era do lado da exibição. A grade
    grossa continua intacta e continua sendo a que a legenda queimada usa.
    """
    if words:
        grade = _sentences_from_words(words)
        if grade:
            return _anotar_pausas(grade, _silencios_das_cues(cues))
    return _sentences_from_cues(cues)


def _anotar_pausas(frases, lacunas):
    """Empresta à grade fina a duração das pausas medidas na grossa — e devolve o fim da
    frase para onde a FALA parou.

    O casamento é pelo FIM da lacuna, não pelo começo, e a razão é a construção da grade
    fina: o `end` de uma palavra é o `start` da SEGUINTE, então o fim de uma frase seguida
    de silêncio cai depois do silêncio inteiro, não antes. MEDIDO no vídeo do print: há uma
    lacuna de 12,76 s, e sem esta correção um corte que fechasse ali levaria 12,76 s de
    silêncio no rabo — que é exatamente o "excessive trailing silence" que o pedido proíbe.
    O respiro do fim (`RESPIRO_DEPOIS_SEC`) volta a ter de onde sair.
    """
    if not lacunas:
        return frases
    for frase in frases[:-1]:
        for instante, duracao in lacunas:
            if abs((instante + duracao) - frase["end"]) > PAUSA_TOLERANCIA_SEC:
                continue
            # A fala parou em `instante`; dali até `end` era silêncio.
            if instante > frase["start"]:
                frase["end"] = round(instante, 3)
            frase["pauseAfter"] = max(frase["pauseAfter"], duracao)
            break
    # `hardStart` lê `pauseAfter`, então tem de ser recalculado depois de anotar: uma frase
    # que agora sabe que veio depois de 12 s de silêncio é início firme, e antes não era.
    for pos, frase in enumerate(frases):
        if pos == 0 or FALANTE_RE.match(frase["text"]):
            frase["hardStart"] = True
            continue
        anterior = frases[pos - 1]
        frase["hardStart"] = bool(SENTENCE_END_RE.search(anterior["text"].rstrip())
                                  or anterior["pauseAfter"] >= FECHO_PAUSA_SEC)
    return frases


def _indice_em(frases, instante):
    """Primeira frase que ainda não terminou em `instante`. -1 se a grade é vazia."""
    for pos, frase in enumerate(frases):
        if frase["end"] > instante:
            return pos
    return len(frases) - 1 if frases else -1


def _fecha_ideia(frase, shifts):
    """A ideia acaba NESTA frase? Ponto final, ou silêncio longo, ou troca de capítulo."""
    if frase["pauseAfter"] >= FECHO_PAUSA_SEC:
        return True
    if any(frase["start"] < ponto <= frase["end"] + frase["pauseAfter"] for ponto in shifts):
        return True
    return bool(SENTENCE_END_RE.search(frase["text"].rstrip()))


def _window(cues, anchor, total, stops=(), words=None):
    """Trecho que começa numa FRASE inteira e fecha ONDE A IDEIA ACABA.

    Devolve dicionário — e não a tripla de antes — porque quem avalia precisa das frases
    escolhidas, não só das pontas: a nota editorial se mede no texto de cada frase, e
    recalcular a fatia do lado de fora criaria uma segunda conta da mesma grandeza.

    `fecho` sai False quando NÃO existe fim de ideia dentro do teto. Antes, esse caso caía
    no `last` — a última cue que ainda cabia — e era daí que vinham os 10 de 12 cortes que
    terminavam mal. Agora o caso é REPROVADO pelo `avaliar`, não remendado.
    """
    frases = sentences_from(cues, words)
    if not frases:
        # Sem transcrição não há borda para achar. Quem chama decide o que fazer com isso
        # (o `candidates` usa a REGIÃO MEDIDA do pico e marca a borda como estimada) —
        # inventar aqui uma janela de tamanho fixo é o defeito, não a saída.
        inicio = max(0.0, float(anchor))
        fim = min(float(total) if total else inicio + TARGET_CLIP_SEC, inicio + TARGET_CLIP_SEC)
        return {"inSec": inicio, "outSec": max(fim, inicio), "text": "", "clean": "",
                "frases": [], "fecho": False, "wordLevel": False, "abriuNaFrase": False}

    indice = max(0, _indice_em(frases, float(anchor)))
    # Recuo, em dois passos e no MESMO orçamento. Primeiro até um início FIRME: abrir onde
    # a pessoa só respirou entrega meia oração. Depois, enquanto a abertura pendurar o
    # sentido numa frase anterior ("Mas isso mudou tudo"). Perder três segundos custa menos
    # que entregar corte que só faz sentido para quem ouviu o episódio inteiro.
    primeira = indice
    orcamento = MAX_CLIP_SEC / 3
    while primeira > 0 and not frases[primeira].get("hardStart"):
        if frases[indice]["start"] - frases[primeira - 1]["start"] > orcamento:
            break
        primeira -= 1
    while primeira > 0 and _dangling_opener(frases[primeira]["clean"] or frases[primeira]["text"]):
        if frases[indice]["start"] - frases[primeira - 1]["start"] > orcamento:
            break
        primeira -= 1
        # O recuo por conector pode cair num "só respirou": volta a firmar.
        while primeira > 0 and not frases[primeira].get("hardStart"):
            if frases[indice]["start"] - frases[primeira - 1]["start"] > orcamento:
                break
            primeira -= 1

    inicio_fala = frases[primeira]["start"]
    shifts = [float(s) for s in (stops or ()) if float(s) > inicio_fala + MIN_CLIP_SEC]
    ultima = primeira
    fechou = False
    for pos in range(primeira, len(frases)):
        frase = frases[pos]
        if frase["end"] - inicio_fala > MAX_CLIP_SEC:
            break
        ultima = pos
        span = frase["end"] - inicio_fala
        if span < MIN_CLIP_SEC:
            continue
        if _fecha_ideia(frase, shifts):
            fechou = True
            # Fim de frase COM trégua de verdade (ou troca de capítulo) fecha na hora; fim
            # de frase sem pausa é respiração no meio do raciocínio, e aí a janela continua
            # até o teto suave da história.
            if (frase["pauseAfter"] >= CLOSE_PAUSE_SEC
                    or any(frase["start"] < p <= frase["end"] + frase["pauseAfter"] for p in shifts)
                    or span >= STORY_CLIP_SEC):
                break
    # A janela só vale até a última frase que FECHA. Parar na `ultima` crua era o que
    # deixava meia frase pendurada no fim quando o laço saía pelo teto.
    if fechou:
        while ultima > primeira and not _fecha_ideia(frases[ultima], shifts):
            ultima -= 1
    fatia = frases[primeira:ultima + 1]
    fim = frases[ultima]["end"]
    # Respiro nas pontas, dentro do silêncio que JÁ existe: metade da folga, no máximo o
    # teto. Nunca invade a fala vizinha, então não corta consoante nem come sílaba.
    folga_antes = frases[primeira - 1]["pauseAfter"] if primeira > 0 else inicio_fala
    inicio = max(0.0, inicio_fala - min(RESPIRO_ANTES_SEC, max(0.0, folga_antes) / 2.0))
    fim = fim + min(RESPIRO_DEPOIS_SEC, max(0.0, frases[ultima]["pauseAfter"]) / 2.0)
    if total:
        fim = min(fim, float(total))
    if fim - inicio < MIN_CLIP_SEC:
        fechou = False
    texto = " ".join(f["text"] for f in fatia).strip()
    return {"inSec": round(inicio, 3), "outSec": round(fim, 3), "text": texto,
            "clean": " ".join(" ".join(f["clean"] for f in fatia).split()),
            "frases": fatia, "fecho": fechou,
            "wordLevel": bool(fatia and fatia[0].get("wordLevel")),
            "abriuNaFrase": True}


def avaliar(janela, interesse=0.0):
    """Janela -> {'score','quality','factors','reject'}. Pura, interpretável, sem rede.

    Os cinco fatores são os do pedido, na ordem dele: abertura, independência,
    desenvolvimento, fecho e confiabilidade. `interesse` (audiência/capítulo, 0 a 1) entra
    por último e vale no MÁXIMO INTERESSE_PESO pontos — e os três vetos rodam ANTES de
    somar, então pico de audiência não resgata trecho incoerente. Cada fator sai com a
    frase que o explica: nota sem decomposição é precisão inventada.
    """
    fatia = janela.get("frases") or []
    texto = janela.get("clean") or ""
    cru = janela.get("text") or ""
    span = max(0.001, float(janela.get("outSec", 0)) - float(janela.get("inSec", 0)))
    minutos = max(span / 60.0, 0.01)
    palavras = _palavras_de(texto)
    abertura = fatia[0] if fatia else None
    palavras_abertura = _palavras_de(abertura["clean"]) if abertura else 0
    pendurada = _dangling_opener(abertura["clean"]) if abertura else ""
    nao_fala = len(NAO_FALA_RE.findall(cru)) / minutos
    trocas = len(FALANTE_RE.findall(cru)) / minutos

    valores, notas = {}, []
    # 1. Abertura: a primeira frase orienta quem chega agora?
    if not abertura or palavras_abertura < ABERTURA_MIN_PALAVRAS:
        valores["abertura"] = 0.0
        notas.append(("abertura", "A primeira fala é curta demais para orientar quem chega."))
    elif pendurada:
        valores["abertura"] = 0.0
        notas.append(("abertura", "Abre em “%s” — o sentido ficou na frase anterior." % pendurada))
    elif not abertura.get("hardStart", True):
        # O recuo tentou e não alcançou um início firme dentro do orçamento. Entregar meia
        # oração é o defeito relatado ("começa abruptamente"); reprovar é a saída honesta.
        valores["abertura"] = 0.0
        notas.append(("abertura", "Abre no meio da oração — não há começo de frase "
                                  "alcançável antes deste ponto."))
    elif NAO_FALA_RE.search(abertura["text"]):
        # A PRIMEIRA frase é onde quem chega decide continuar; se ela mesma vem censurada
        # ou é `[risadas]`, não há o que orientar. Medido: era isto que ainda deixava
        # entrar a briga de buzina do começo do vídeo do print ("Para com essa [ __ ] um
        # pouco.") e o ">> Ah, é. [risadas]" — os dois abrem num marcador, não numa fala.
        valores["abertura"] = 0.0
        notas.append(("abertura", "A primeira frase é censurada ou não é fala "
                                  "(risadas, música, palavra apagada)."))
    else:
        pontos, _ = hook_hits(abertura["clean"])
        if palavras_abertura >= ABERTURA_MIN_PALAVRAS * 2:
            cheia = 1.0
        elif palavras_abertura >= ABERTURA_MIN_PALAVRAS + 2:
            cheia = 0.8
        else:
            cheia = 0.55
        valores["abertura"] = min(1.0, cheia + (0.2 if pontos >= 12 else 0.0))
        notas.append(("abertura", "Começa numa frase inteira%s." %
                      (" e com gancho na primeira fala" if pontos >= 12 else "")))
    # 2. Independência: dá para entender sem os minutos anteriores?
    if nao_fala > NAO_FALA_POR_MIN:
        valores["independencia"] = 0.0
        notas.append(("independencia",
                      "Fala censurada ou sem áudio aproveitável (%.0f marcas por minuto)." % nao_fala))
    elif trocas > TROCA_POR_MIN:
        valores["independencia"] = 0.0
        notas.append(("independencia", "Conversa picada: %.0f trocas de falante por minuto." % trocas))
    elif pendurada:
        valores["independencia"] = 0.0
        notas.append(("independencia", "Depende do que foi dito antes do corte."))
    else:
        valores["independencia"] = 1.0 if nao_fala == 0 and trocas <= 1.0 else 0.75
        notas.append(("independencia", "Se sustenta sem o resto do episódio."))
    # 3. Desenvolvimento: entrega alguma coisa depois da abertura?
    if palavras < FALA_MIN_PALAVRAS or len(fatia) < 2:
        valores["desenvolvimento"] = 0.25 if palavras else 0.0
        notas.append(("desenvolvimento", "Pouca fala dentro do trecho (%d palavras)." % palavras))
    else:
        densidade = palavras / max(span / 10.0, 0.1)
        valores["desenvolvimento"] = max(0.4, min(1.0, densidade / 22.0))
        notas.append(("desenvolvimento", "%d palavras em %d frases." % (palavras, len(fatia))))
    # 4. Fecho: a última frase termina o raciocínio?
    if not janela.get("fecho"):
        valores["fecho"] = 0.0
        notas.append(("fecho", "Termina no meio da frase — a fala continua depois do corte."))
    elif not fatia:
        # Sem transcrição não há frase para conferir. O fecho não é REPROVADO (a região de
        # audiência é uma borda medida, só não é a da fala), mas também não é afirmado:
        # meio valor e a frase dizendo que ninguém olhou. Afirmar fecho que não se
        # conferiu é exatamente a "measurement I did not make" que o pedido proíbe.
        valores["fecho"] = 0.5
        notas.append(("fecho", "Fim não conferido: sem legenda, a borda é o fim da região "
                               "de audiência."))
    else:
        respirou = fatia[-1]["pauseAfter"] >= CLOSE_PAUSE_SEC
        valores["fecho"] = 1.0 if respirou else 0.7
        notas.append(("fecho", "Fecha a frase%s." % (" e cai numa pausa" if respirou else "")))
    # 5. Confiabilidade: a evidência de tempo é medida ou estimada?
    if not fatia:
        valores["confiabilidade"] = 0.0
        notas.append(("confiabilidade",
                      "Sem transcrição: as bordas vêm da região de audiência, não da fala."))
    elif janela.get("wordLevel"):
        valores["confiabilidade"] = 1.0
        notas.append(("confiabilidade", "Bordas no instante da palavra."))
    else:
        valores["confiabilidade"] = 0.6
        notas.append(("confiabilidade", "Bordas na fala inteira (legenda sem tempo por palavra)."))

    reprovas = [nome for nome in VETO if valores.get(nome, 0.0) <= 0.0]
    bruto = sum(valores[nome] * peso for nome, peso, _ in FATORES)
    bruto += min(1.0, max(0.0, float(interesse))) * INTERESSE_PESO
    score = int(round(max(0.0, min(100.0, bruto))))
    # Rótulo pelo PERFIL dos cinco fatores editoriais — `interesse` fica fora, então
    # audiência não promove ninguém de faixa. Reprovado já saiu antes daqui.
    editoriais = [valores.get(nome, 0.0) for nome, _, _ in FATORES]
    piso_real = min(editoriais) if editoriais else 0.0
    cheios = sum(1 for v in editoriais if v >= 0.999)
    if reprovas:
        slug, rotulo = "fraco", "Vale conferir"
    elif piso_real >= FORTE_PISO and cheios >= FORTE_CHEIOS:
        slug, rotulo = "forte", "Recomendado"
    elif piso_real >= BOM_PISO:
        slug, rotulo = "bom", "Bom candidato"
    else:
        slug, rotulo = "fraco", "Vale conferir"
    explica = dict(notas)
    fatores = [{"id": nome, "label": rot, "weight": peso,
                "value": round(valores.get(nome, 0.0), 2), "note": explica.get(nome, "")}
               for nome, peso, rot in FATORES]
    fatores.append({"id": "interesse", "label": "Interesse do público",
                    "weight": INTERESSE_PESO,
                    "value": round(min(1.0, max(0.0, float(interesse))), 2),
                    "note": "Audiência e capítulos somam no máximo %d pontos "
                            "— nunca resgatam um trecho reprovado." % INTERESSE_PESO})
    return {"score": score, "quality": slug, "qualityLabel": rotulo, "factors": fatores,
            "reject": explica.get(reprovas[0], "") if reprovas else "",
            "rejectId": reprovas[0] if reprovas else ""}


def cues_for_range(cues, start, end, words=None):
    """Falas que caem dentro do trecho, com o relógio zerado no começo do corte.

    A legenda do YouTube conta a partir do começo do VÍDEO; o arquivo que o Remotion recebe
    começa no segundo 0 do CORTE. Sem rebasear, uma legenda de um corte em 00:08:21
    apareceria oito minutos depois do fim do clipe — ou seja, nunca. Recortar também
    importa: mandar a transcrição inteira faria o Remotion montar milhares de Sequence para
    exibir trinta segundos.

    A saída sai ORDENADA e SEM SOBREPOSIÇÃO (`captions.normalize_cues`). É aqui porque esta
    é a fronteira única do projeto para cue de CLIPE: os dois renderizadores 9:16 — o ASS
    queimado pelo FFmpeg e as Sequence do Remotion — bebem desta função, e legenda rolante do
    YouTube (a de agora ainda no ar quando a próxima começa) empilha dois textos na mesma
    região em qualquer um dos dois.

    `words` é a MESMA legenda lida palavra a palavra (`parse_json3_words`). Presente, ela
    ganha: a linha é remontada no limite da PALAVRA e dura o tempo daquelas palavras, então
    não existe janela rolante para truncar. Ausente — sidecar v1/v2/v3 já gravado, legenda
    corrigida na mão pelo operador, faixa sem `tOffsetMs` — o caminho é o da cue grossa,
    exatamente como antes. Ninguém rebaixa vídeo para migrar formato de legenda.
    """
    begin, finish = float(start), float(end)
    if words:
        return captions.normalize_cues(_lines_from_words_in_range(words, begin, finish))
    out = []
    for cue in cues or []:
        first = max(float(cue["start"]), begin)
        last = min(float(cue["end"]), finish)
        # Fala que só encosta na borda (mesmo instante de início e fim depois do corte)
        # viraria Sequence de duração zero, que o Remotion recusa.
        if last - first < captions.MIN_CUE_SEC:
            continue
        text = str(cue.get("text") or "").strip()
        if text:
            out.append({"start": round(first - begin, 3), "end": round(last - begin, 3),
                        "text": text})
    return captions.normalize_cues(out)


def _lines_from_words_in_range(words, begin, finish):
    """Palavras do trecho -> linhas já rebaseadas. Recorta ANTES de agrupar de propósito:
    palavra pela metade na borda do corte não pode arrastar a linha para fora da janela."""
    janela = []
    for palavra in words or []:
        if not isinstance(palavra, dict):
            continue
        try:
            inicio = float(palavra["start"])
            fim = float(palavra.get("end") or inicio)
        except (KeyError, TypeError, ValueError):
            continue
        if fim <= begin or inicio >= finish:
            continue
        janela.append({"start": max(inicio, begin) - begin,
                       "end": min(fim, finish) - begin, "text": palavra.get("text")})
    return [{"start": round(linha["start"], 3), "end": round(linha["end"], 3),
             "text": linha["text"],
             # As palavras da linha seguem junto, JA rebaseadas -- elas foram recortadas e
             # rebaseadas acima, no MESMO laco, e nada aqui subtrai o comeco do corte uma
             # segunda vez. E o unico ponto do projeto em que tempo por palavra atravessa a
             # fronteira de cue de clipe, e e o que alimenta o karaoke do Remotion.
             "words": [{"start": round(p["start"], 3), "end": round(p["end"], 3),
                        "text": p["text"]}
                       for p in linha.get("words") or []]}
            for linha in captions.cues_from_words(janela)]


def _first_sentence(text, limit=280):
    clean = re.sub(r"\s+", " ", str(text or "")).strip()
    if not clean:
        return ""
    parts = re.split(r"(?<=[.!?…])\s+", clean)
    hook = parts[0] if parts else clean
    return hook[:limit].strip()


# Muleta de fala que abre frase sem dizer nada ("Eh, estamos ali mais ou menos..."). Sai
# só do TÍTULO — o corte continua começando onde a fala começa, porque tirar o "Eh" do
# vídeo seria remover palavra do meio da frase, que o pedido proíbe.
#
# A muleta só conta quando vem SEGUIDA DE VÍRGULA, que é como a transcrição a marca. Sem
# essa exigência, "Assim que eu entendi" perdia o "Assim" e "Olha o seguinte" perdia o
# artigo — e pior, `_norm("ó")` é "o", então a entrada acentuada comia o artigo "o" de
# qualquer frase. Título aparado errado é pior que título com muleta.
MULETAS = frozenset(flat for _, flat in _terms(
    "eh", "ah", "uh", "ó", "olha", "tipo", "então", "assim", "né", "pois é", "sabe",
    "bom", "cara", "well", "so", "like"))
MULETA_RE = re.compile(r"^\s*([^\s,;:]+(?:\s+[^\s,;:]+)?)\s*,\s*")


def _titulo_de(fatia, limite=72):
    """Fatia de frases -> título do CORTE, tirado da fala escolhida. Puro.

    Nunca o título do vídeo e nunca fragmento: o defeito relatado era exatamente este —
    títulos como "total.", "mais qualidade." e ">> Ah, é." saíam de `_first_sentence` do
    texto cru, que começava onde a CUE começava (no meio da oração) e ainda carregava o
    `>>` e o `[ __ ]`.

    A escolha é a frase de ABERTURA, não a mais chamativa do trecho: é ela que o
    espectador ouve primeiro, então título tirado do meio promete uma coisa e entrega
    outra. Só se a abertura for magra demais para nomear o corte é que se olha as
    seguintes. O texto vem limpo do dono único (`captions.strip_artifacts`) e é aparado no
    limite da PALAVRA.
    """
    frases = [f.get("clean") or "" for f in fatia or []]
    frases = [" ".join(f.split()) for f in frases if _palavras_de(f) >= 3]
    if not frases:
        return ""
    escolhida = ""
    for frase in frases[:4]:
        if _palavras_de(_sem_muleta(frase)) >= 6:
            escolhida = frase
            break
    if not escolhida:
        escolhida = max(frases[:6], key=lambda f: (hook_hits(f)[0], _palavras_de(f)))
    limpo = _sem_muleta(escolhida)
    if len(limpo) > limite:
        aparado = limpo[:limite].rsplit(" ", 1)[0]
        limpo = (aparado or limpo[:limite]).rstrip(" ,;:-–—") + "…"
    return (limpo[:1].upper() + limpo[1:]) if limpo else ""


def _sem_muleta(frase):
    """Apara muleta e pontuação solta do COMEÇO de um título. Pura e idempotente.

    Só apara o que sobra: se depois da poda ficariam menos de três palavras, devolve o
    texto original — título vazio é pior que título com muleta.
    """
    texto = " ".join(str(frase or "").split()).lstrip(" ,;:-–—…")
    while texto:
        achado = MULETA_RE.match(texto)
        if not achado:
            break
        if _norm(achado.group(1)).strip() not in MULETAS:
            break
        resto = texto[achado.end():].lstrip(" ,;:-–—…")
        if _palavras_de(resto) < 3:
            break
        texto = resto
    return texto


def _interesse_de(item, total):
    """Sinal de POPULARIDADE do item, de 0 a 1. Nunca é nota: é empurrão com teto.

    O primeiro balde do gráfico do YouTube é alto em TODO vídeo — quem abre o vídeo assiste
    os primeiros segundos, então o pico do começo mede carregamento de página, não interesse
    editorial. MEDIDO no vídeo do print: o balde de 0 s a 22 s marca 65% do maior do vídeo,
    e era a única razão pela qual a abertura entrava com nota 72. O desconto não REPROVA
    (o veto editorial faz isso, com evidência do texto) — só tira do sinal a parte que é
    artefato de medição.
    """
    bruto = min(1.0, max(0.0, float(item.get("interesse") or 0.0)))
    if float(item.get("anchor") or 0.0) <= ABERTURA_VIDEO_SEC:
        return bruto * 0.35
    return bruto


REPROVA_LABEL = {
    "abertura": "começavam no meio da ideia",
    "independencia": "não se entendiam sozinhos",
    "fecho": "terminavam no meio da frase",
}


def candidates(info, limit=MAX_CANDIDATES):
    """Atalho para quem só quer a lista. O relatório fica em `candidates_report`."""
    return candidates_report(info, limit)[0]


def candidates_report(info, limit=MAX_CANDIDATES):
    """(lista, resumo). Mesma conta do `candidates`, com o que foi DESCARTADO à vista.

    Existe porque "não sugeri nada" e "descartei sete porque terminavam no meio da frase"
    são coisas diferentes para quem olha a tela, e recurso automático que reprova calado é
    indistinguível de recurso quebrado (BP-008). O resumo é a única saída de texto desta
    camada e vai junto da `note` da análise.
    """
    return _candidates(info, limit)


def _candidates(info, limit=MAX_CANDIDATES):
    """Metadados + legenda -> trechos sugeridos. Função pura: nada de rede aqui.

    Cada item sai no MESMO formato que o `clip` já guardado em pp_video_ops_v1, então
    entra no site sem migração de schema, com `state='candidate'` — nada é aprovado nem
    baixado por esta função.

    Ordem do trabalho, que é a ordem do pedido: (1) sinais viram ÂNCORAS, não janelas;
    (2) em volta de cada âncora procura-se um momento COMPLETO (`BUSCA_FRASES` frases para
    cada lado); (3) a janela é REPROVADA ou aprovada pelo `avaliar`, com o veto editorial
    rodando antes de somar audiência; (4) sobreposição funde; (5) ordena. Preferir poucas
    sugestões boas a preencher cota é regra explícita, então a lista pode sair menor que o
    `limit` — inclusive vazia, e aí a tela diz por quê.
    """
    cues = list(info.get("cues") or [])
    words = list(info.get("words") or [])
    chapters = list(info.get("chapters") or [])
    total = float(info.get("durationSec") or 0.0)
    peaks = heatmap_peaks(info.get("heatmap"))
    frases = sentences_from(cues, words)
    stops = tuple(float(c["start_time"]) for c in chapters if c.get("start_time") is not None)

    raw = []
    for peak in peaks[: limit * 2]:
        ratio = float(peak.get("ratio", 0) or 0.0)
        share = int(round(ratio * 100))
        raw.append({
            "anchor": float(peak["start"]), "regiao": (float(peak["start"]), float(peak["end"])),
            "interesse": ratio, "signals": ["heatmap"],
            "reasons": ["pico de “Mais reproduzidos” (%d%% do maior do vídeo)" % share],
            "topic": "", "topicAt": None,
        })
    for chapter in chapters:
        start = chapter.get("start_time")
        if start is None:
            continue
        title = re.sub(r"\s+", " ", str(chapter.get("title") or "")).strip()
        raw.append({
            "anchor": float(start), "regiao": None, "interesse": 0.25,
            "signals": ["chapter"],
            "reasons": ["início do capítulo “%s”" % title if title else "início de capítulo"],
            # O título do capítulo é o nome que QUEM PUBLICOU deu àquele momento — é
            # evidência, não invenção, e é melhor manchete que uma frase de legenda
            # automática. Só vale se o corte ABRIR no capítulo (`topicAt`): capítulo que
            # entrou por fusão a oito segundos de distância nomearia outro trecho.
            "topic": title[:140], "topicAt": float(start),
        })
    for position, cue in enumerate(cues):
        points, labels = hook_hits(cue["text"])
        if not points:
            continue
        pause = cue["start"] - cues[position - 1]["end"] if position else 0.0
        if pause >= 1.2:
            points += 8
            labels = labels + ["pausa longa antes da fala"]
        if points < 16:
            continue
        raw.append({
            "anchor": float(cue["start"]), "regiao": None, "interesse": 0.0,
            "signals": ["transcript"], "reasons": labels, "topic": "", "topicAt": None,
        })
    # Palpite de um detector de fora (hoje o `ai-clipping` da MuAPI, via `muapi.py`), já
    # como DADO — esta função continua pura. Entra como ÂNCORA, nunca como borda:
    # `regiao=None` faz o trecho existir só se a fala confirmar, então a janela sai da
    # mesma busca de frase completa e passa pelo mesmo veto editorial que todo o resto.
    # Dar região aqui faria o `boundary` sair "audiencia" num vídeo sem legenda — afirmar
    # conferência que não houve. `interesse=0.0` porque esse slot é popularidade MEDIDA,
    # e confiança de modelo de terceiro não é isso.
    for trecho in info.get("muapiHighlights") or []:
        try:
            inicio = float(trecho.get("start"))
        except (TypeError, ValueError, AttributeError):
            continue
        if not math.isfinite(inicio) or inicio < 0.0:
            continue
        raw.append({
            "anchor": inicio, "regiao": None, "interesse": 0.0,
            "signals": ["muapi"], "reasons": ["trecho apontado por detector externo"],
            "topic": "", "topicAt": None,
        })

    # Âncora mais promissora primeiro, só para escolher quem tenta antes; a NOTA quem dá é
    # o `avaliar`, depois de resolver a janela. O instante desempata — ordem estável.
    raw.sort(key=lambda item: (-float(item["interesse"]), float(item["anchor"])))

    picked, reprovados = [], {}
    for item in raw:
        interesse = _interesse_de(item, total)
        melhor = None
        if frases:
            # Busca em volta do sinal por um momento COMPLETO. Pico alto autoriza PROCURAR
            # perto; não autoriza janela de tamanho fixo centrada nele.
            base = max(0, _indice_em(frases, item["anchor"]))
            vistos = set()
            for salto in range(-BUSCA_FRASES, BUSCA_FRASES + 1):
                pos = base + salto
                if pos < 0 or pos >= len(frases) or pos in vistos:
                    continue
                vistos.add(pos)
                # Tentar por um "só respirou" é gastar busca: o recuo do `_window` vai
                # firmar o início e cair na mesma janela de um vizinho já tentado.
                if not frases[pos].get("hardStart"):
                    continue
                janela = _window(cues, frases[pos]["start"], total, stops, words)
                if janela["outSec"] - janela["inSec"] < MIN_CLIP_SEC:
                    continue
                nota = avaliar(janela, interesse)
                if nota["reject"]:
                    chave = nota["rejectId"]
                    reprovados[chave] = reprovados.get(chave, 0) + 1
                    continue
                if melhor is None or nota["score"] > melhor[1]["score"]:
                    melhor = (janela, nota)
            if melhor is None:
                continue
        else:
            # Sem legenda: a única borda MEDIDA que existe é a região do próprio pico.
            # Ela vale como sugestão, mas sai marcada — `confiabilidade` = 0 e a frase do
            # fator diz que a borda não veio da fala. Capítulo sozinho não vira sugestão:
            # não há nem borda nem texto para conferir, e cartão sem evidência é cota.
            if not item["regiao"]:
                continue
            inicio, fim = item["regiao"]
            fim = max(fim, inicio + MIN_CLIP_SEC)
            if total:
                fim = min(fim, total)
            if fim - inicio < MIN_CLIP_SEC:
                continue
            janela = {"inSec": round(inicio, 3),
                      "outSec": round(min(fim, inicio + MAX_CLIP_SEC), 3),
                      "text": "", "clean": "", "frases": [], "fecho": True,
                      "wordLevel": False, "abriuNaFrase": False}
            melhor = (janela, avaliar(janela, interesse))

        janela, nota = melhor
        # O intervalo resolvido sai em SEGUNDO INTEIRO, e e o unico numero que o sistema
        # inteiro usa: o nome do arquivo baixado e `%d-%d` (`_canonical_clip_filename`), o
        # `/api/yt-fetch` recebe `num(inSec)` (que arredonda), o `?start=` do player e
        # inteiro e o `/api/clip-status` acha o arquivo pelo mesmo par. Deixar fracao aqui
        # fazia o detector prometer 2071,35 e o export entregar 2071 -- borda diferente da
        # calculada, calada, que e exatamente o "correct requested timestamp can still
        # produce an incorrect exported boundary" do pedido. Piso no comeco e teto no fim:
        # os dois lados ALARGAM para dentro do silencio, nunca comem fala.
        start = float(math.floor(janela["inSec"]))
        end = float(math.ceil(janela["outSec"]))
        if total:
            end = min(end, float(math.ceil(total)))
        if end - start < MIN_CLIP_SEC:
            continue
        merged = None
        for chosen in picked:
            overlap = min(chosen["outSec"], end) - max(chosen["inSec"], start)
            span = min(chosen["outSec"] - chosen["inSec"], end - start)
            if abs(chosen["inSec"] - start) <= MERGE_GAP_SEC or (span > 0 and overlap > span * MERGE_OVERLAP):
                merged = chosen
                break
        if merged:
            # Mesmo trecho achado por outro sinal: registra o sinal e recalcula a nota pelo
            # `avaliar` com o maior interesse dos dois — nunca por soma solta. Dois sinais
            # concordando não podem furar o teto de popularidade.
            novo = False
            for signal in item["signals"]:
                if signal not in merged["signals"]:
                    merged["signals"].append(signal)
                    novo = True
            for reason in item["reasons"]:
                if reason not in merged["reasons"]:
                    merged["reasons"].append(reason)
            if item["topic"] and not merged["topic"]:
                merged["topic"] = item["topic"]
                merged["topicAt"] = item.get("topicAt")
            if novo or interesse > merged["interesse"]:
                merged["interesse"] = max(merged["interesse"], interesse)
                merged["nota"] = avaliar(merged["janela"], merged["interesse"])
            continue

        guess = classify_segment(janela["clean"] or janela["text"])
        picked.append({
            "inSec": round(start, 2), "outSec": round(end, 2), "janela": janela,
            "nota": nota, "interesse": interesse, "signals": list(item["signals"]),
            "reasons": list(item["reasons"]), "topic": item["topic"],
            "topicAt": item.get("topicAt"), "guess": guess,
        })
        if len(picked) >= limit:
            break

    # Nota primeiro, começo do vídeo como desempate: ordenação ESTÁVEL e reproduzível, que
    # é o que permite comparar duas análises do mesmo vídeo.
    picked.sort(key=lambda c: (-c["nota"]["score"], c["inSec"]))
    out = []
    for clip in picked:
        janela, nota = clip["janela"], clip["nota"]
        duration = clip["outSec"] - clip["inSec"]
        motives = list(clip["reasons"])
        category = clip["guess"]["category"]
        if category:
            # "pela legenda" não é enfeite: separa palpite de texto do dado observado do
            # heatmap, que é a única coisa aqui que mede audiência de verdade.
            motives.append("assunto provável pela legenda: %s" % CATEGORY_LABELS[category])
        # A frase do card é UMA, e é a do fator que mais pesou — evidência, não resumo de
        # tudo. Os motivos completos continuam no `reason`, que a tela de detalhe mostra.
        forte = max(nota["factors"][:len(FATORES)], key=lambda f: f["value"] * f["weight"])
        do_capitulo = (clip["topic"] if clip.get("topicAt") is not None
                       and abs(float(clip["topicAt"]) - clip["inSec"]) <= MERGE_GAP_SEC else "")
        titulo = (do_capitulo or _titulo_de(janela["frases"]) or clip["topic"]
                  or ("Trecho em %d:%02d" % (int(clip["inSec"]) // 60, int(clip["inSec"]) % 60)))
        out.append({
            "inSec": clip["inSec"], "outSec": clip["outSec"],
            "durationSec": round(duration, 2),
            "score": nota["score"], "quality": nota["quality"],
            "qualityLabel": nota["qualityLabel"], "factors": nota["factors"],
            "signals": clip["signals"],
            "topic": titulo[:140],
            "hook": (janela["clean"] or janela["text"])[:600],
            "evidence": forte["note"][:300],
            "reason": ("; ".join(motives) or "trecho com fala contínua")[:1000],
            "category": category,
            # Borda MEDIDA na palavra, ESTIMADA na fala inteira, ou vinda só da audiência.
            # O pedido manda distinguir isso na tela e não afirmar conferência que não houve.
            "boundary": ("palavra" if janela.get("wordLevel")
                         else ("fala" if janela.get("frases") else "audiencia")),
            "contextWarning": ("Bordas estimadas pela região de audiência — este vídeo não "
                               "entregou legenda. Confira o começo e o fim antes de baixar."
                               if not janela.get("frases") else ""),
            "state": "candidate",
        })
    return out, _resumo_reprovas(reprovados, len(out))


def _resumo_reprovas(reprovados, aprovados):
    """Contagem de descartes -> frase em português. Vazia quando não houve descarte.

    Conta JANELAS avaliadas e reprovadas, não âncoras: a mesma âncora tenta várias janelas
    em volta, então o número é "quantas tentativas caíram", que é o que explica por que a
    lista saiu curta.
    """
    if not reprovados:
        return ""
    partes = ["%d %s" % (n, REPROVA_LABEL[k]) for k, n in
              sorted(reprovados.items(), key=lambda kv: -kv[1]) if k in REPROVA_LABEL]
    if not partes:
        return ""
    cabeca = ("Nenhum trecho passou nos critérios editoriais"
              if not aprovados else "Descartei trechos")
    return "%s: %s." % (cabeca, "; ".join(partes))


# ------------------------------------------------------------------------ rede
def _ytdlp():
    import shutil
    found = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe")
    if not found:
        raise worker.WorkerError(
            "job_invalid",
            "yt-dlp n\u00e3o encontrado no PATH. Instale-o para analisar v\u00eddeos do YouTube.")
    return found


def _run(args, timeout):
    """Chama o yt-dlp com a lista de argumentos que NÓS montamos.

    `--ignore-config` está aqui de propósito: sem ele o yt-dlp lê yt-dlp.conf do sistema e
    do usuário, e um arquivo desses poderia reintroduzir justamente o que a auditoria
    proibiu (cookies, aria2c, --exec). A URL nunca é a string colada — é reconstruída a
    partir do id validado, então nada do que o operador cola vira argumento de processo.
    """
    try:
        proc = subprocess.run([_ytdlp(), "--ignore-config", "--no-playlist", "--no-warnings"] + args,
                              capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise worker.WorkerError("ffmpeg_failed",
                                 "O yt-dlp passou de %.0fs e foi encerrado." % timeout)
    except OSError as err:
        raise worker.WorkerError("job_invalid", "Falha ao chamar o yt-dlp: %s" % err)
    if proc.returncode != 0:
        tail = (proc.stderr or b"").decode("utf-8", "replace").strip().splitlines()
        raise worker.WorkerError(
            "ffmpeg_failed",
            "O yt-dlp recusou o v\u00eddeo: %s" % (tail[-1][:400] if tail else "sem detalhe"))
    return proc.stdout


# Storyboard: a folha de miniaturas com TEMPO que o YouTube já publica. Cada `sb*` é uma
# grade `rows x columns` de quadros; `fps` diz quantos quadros por segundo de vídeo, então
# o quadro do instante t é `floor(t * fps)`. É o único jeito de dar miniatura DO TRECHO
# antes de existir mídia baixada — e não custa byte de vídeo nenhum: o navegador carrega a
# folha e recorta com `background-position`. Medido no vídeo do print: `sb0` tem 320x180,
# grade 3x3, 25 folhas, fps 0,1007 (um quadro a cada ~9,9 s).
STORYBOARD_MIN_W = 120


def _storyboard(info):
    """Dump do yt-dlp -> a MELHOR folha de storyboard, ou {} se o vídeo não publica.

    Escolhe pela largura: miniatura de card fica em ~380 px, então 320 px é o teto útil e
    48 px (o `sb3`) não serve para nada. Só o que a tela precisa viaja — a URL de cada
    folha, a grade e o fps.
    """
    melhor = None
    for fmt in info.get("formats") or []:
        if not str(fmt.get("format_id") or "").startswith("sb"):
            continue
        largura = int(fmt.get("width") or 0)
        fps = float(fmt.get("fps") or 0.0)
        folhas = [f.get("url") for f in (fmt.get("fragments") or []) if f.get("url")]
        if largura < STORYBOARD_MIN_W or fps <= 0 or not folhas:
            continue
        if melhor is None or largura > melhor["width"]:
            melhor = {"width": largura, "height": int(fmt.get("height") or 0),
                      "rows": int(fmt.get("rows") or 0), "columns": int(fmt.get("columns") or 0),
                      "fps": fps, "sheets": folhas[:80]}
    if not melhor or melhor["rows"] < 1 or melhor["columns"] < 1:
        return {}
    return melhor


def probe(url, timeout=PROBE_TIMEOUT):
    """Metadados + legenda. NENHUM byte de vídeo é baixado aqui.

    Uma chamada ao yt-dlp e, quando existe legenda, um GET no endereço que o próprio dump
    devolveu. Somados, dezenas de KB para um podcast de horas.
    """
    vid = video_id(url)
    canonical = "https://www.youtube.com/watch?v=" + vid
    out = _run(["--skip-download", "--dump-single-json", "--", canonical], timeout)
    try:
        info = json.loads(out.decode("utf-8", "replace"))
    except ValueError:
        raise worker.WorkerError("job_invalid", "O yt-dlp devolveu uma resposta ilegível.")

    # Sem legenda a detecção continua com heatmap e capítulos, mas o operador precisa saber
    # que o sinal mais rico faltou (BP-008) — a `note` vem pronta de fetch_cues.
    legenda = fetch_cues(info)
    cues, lang, kind = legenda["cues"], legenda["language"], legenda["kind"]
    caption_note = legenda["note"]

    heatmap = info.get("heatmap") or []
    if not heatmap:
        note = "Este vídeo não publica o gráfico de \u201cMais reproduzidos\u201d; " \
               "nenhuma sugestão cita audiência."
        caption_note = (caption_note + " " + note).strip() if caption_note else note

    return {
        "videoId": vid, "url": canonical,
        "title": str(info.get("title") or "")[:300],
        "uploader": str(info.get("uploader") or "")[:140],
        "durationSec": float(info.get("duration") or 0.0),
        "chapters": [{"start_time": c.get("start_time"), "title": c.get("title")}
                     for c in (info.get("chapters") or []) if c.get("start_time") is not None],
        "heatmap": [{"start_time": b.get("start_time"), "end_time": b.get("end_time"),
                     "value": b.get("value")} for b in heatmap],
        "cues": cues, "words": legenda["words"],
        "captionLang": lang, "captionKind": kind,
        "note": caption_note,
        # Capa do vídeo (a maior publicada) e a folha de storyboard. A capa nomeia o
        # projeto; o storyboard é o que dá miniatura DO TRECHO sem baixar vídeo.
        "thumbnail": _melhor_capa(info),
        "storyboard": _storyboard(info),
    }


def _melhor_capa(info):
    """A maior capa publicada. Fallback para o endereço estável do YouTube."""
    melhor, area = "", -1
    for t in info.get("thumbnails") or []:
        u = str(t.get("url") or "")
        if not u.startswith("https://"):
            continue
        a = int(t.get("width") or 0) * int(t.get("height") or 0)
        if a > area:
            melhor, area = u, a
    return melhor[:400]


def fetch_section(url, start, end, outdir, timeout=FETCH_TIMEOUT):
    """Baixa SOMENTE o trecho aprovado. Chamada depois da decisão humana, nunca antes.

    `--download-sections` faz o servidor entregar só a faixa pedida, e
    `--force-keyframes-at-cuts` recodifica as pontas para o corte cair no segundo exato em
    vez do keyframe mais próximo — sem isso o começo do corte escorrega alguns segundos.
    O nome do arquivo vem do id validado, nunca do título (título alheio com barra
    invertida ou dois-pontos viraria caminho no Windows).
    """
    import glob
    vid = video_id(url)
    begin, finish = float(start), float(end)
    if not (finish > begin >= 0):
        raise worker.WorkerError("cut_invalid", "O fim do corte precisa vir depois do início.")
    if finish - begin > worker.MAX_CUT_SEC:
        raise worker.WorkerError(
            "cut_invalid",
            "Corte de %.0fs passa do teto de %.0fs." % (finish - begin, worker.MAX_CUT_SEC))
    os.makedirs(outdir, exist_ok=True)
    stem = "%s-%d-%d" % (vid, int(begin), int(finish))
    for old in glob.glob(os.path.join(outdir, stem + ".*")):
        try:
            os.remove(old)
        except OSError:
            pass
    _run([
        "--download-sections", "*%.2f-%.2f" % (begin, finish),
        "--force-keyframes-at-cuts",
        # Por que fixar o cliente (medido, não suposto): baixar faixa exige o downloader
        # FFmpeg, e o FFmpeg refaz o pedido com User-Agent de Chrome. O cliente padrão
        # (`ANDROID_VR`) devolve URL casada com OUTRO agente, e o YouTube responde 403 —
        # o erro aparecia como "ffmpeg exited with code 3436169992", que não diz nada.
        # Dos clientes testados, só `web_embedded` entregou 1080p; `tv`/`web` caem em 360p
        # e ficam como rede de segurança para quando o embedded parar de funcionar.
        "--extractor-args", "youtube:player_client=web_embedded,tv,web",
        # O mesmo binário que o worker.py já usa. Sem isto o yt-dlp pega o FFmpeg do PATH,
        # que na máquina do operador é um nightly — duas versões diferentes cortando o
        # mesmo vídeo é fonte de diferença que ninguém consegue explicar depois.
        "--ffmpeg-location", worker.FFMPEG,
        # H.264 primeiro: o AV1 que o YouTube serve em 1080p decodifica devagar no
        # navegador e no render, e a fonte não ganha nada em qualidade sendo AV1.
        "-f", "bv*[height<=1080][vcodec^=avc1]+ba[acodec^=mp4a]/"
              "bv*[height<=1080]+ba/b[height<=1080]/b",
        "--merge-output-format", "mp4",
        # A miniatura do vídeo, no MESMO comando: ela vira o fundo do 9:16 no lugar da
        # tarja desfocada. Sai da lista `thumbnails` do dump que o extractor já fez — não é
        # segunda extração, não é pipeline novo e não custa chamada extra ao yt-dlp.
        "--write-thumbnail",
        "-o", os.path.join(outdir, stem + ".%(ext)s"),
        "--", "https://www.youtube.com/watch?v=" + vid,
    ], timeout)
    path = produced_media(outdir, stem)
    # O mesmo portão do upload local: arquivo vazio ou sem faixa de vídeo morre aqui, não
    # no meio do render do Remotion.
    media = worker.validate_input(path)
    # A miniatura NÃO volta aqui de propósito: quem precisa dela é o render, e ele a
    # redescobre pelo stem na hora (serve.render_background). Devolver o nome criaria um
    # campo que ninguém lê e um segundo lugar onde a informação pode ficar velha.
    return {"path": path, "bytes": os.path.getsize(path), "media": media,
            "inSec": begin, "outSec": finish}


def produced_media(outdir, stem):
    """Qual dos arquivos gravados com este stem é o VÍDEO.

    Era `sorted(glob(stem + ".*"))[0]`, que escolhia por ordem alfabética. Com a miniatura
    ao lado isso quebra: `.jpg` vem ANTES de `.mp4`, o `validate_input` receberia a imagem
    e o download inteiro morreria com "sem faixa de vídeo". Fragmento (`.f616.mp4`) e sobra
    de download (`.part`) também ordenam na frente do arquivo final.

    Por isso o nome EXATO primeiro — `--merge-output-format mp4` faz dele a regra — e só
    depois a sobra, filtrada. O último ramo do seletor de formato pode entregar `.webm`,
    então o fallback existe.
    """
    import glob
    alvo = os.path.join(outdir, stem + ".mp4")
    if os.path.isfile(alvo):
        return alvo
    restos = []
    for caminho in sorted(glob.glob(os.path.join(outdir, stem + ".*"))):
        cauda = os.path.basename(caminho)[len(stem):]
        if os.path.splitext(caminho)[1].lower() in THUMB_EXTS:
            continue
        # Fragmento do yt-dlp é `.f<número>.<ext>`. Filtrar por `.f` solto descartaria um
        # container final legítimo em `.flv`/`.f4v` — o último ramo do seletor de formato
        # (`b[height<=1080]`) é justamente o que pode entregar container inesperado.
        if caminho.endswith((".part", ".ytdl")) or re.match(r"^\.f\d+\.", cauda):
            continue
        restos.append(caminho)
    if not restos:
        raise worker.WorkerError("output_invalid", "O yt-dlp terminou sem gravar o trecho.")
    return restos[0]


def thumbnail_beside(folder, filename):
    """Nome da miniatura gravada ao lado deste arquivo, ou "" se não houver nenhuma legível.

    Fronteira ÚNICA da descoberta por stem: quem baixa e quem renderiza usam esta função,
    então a lista de extensões não se duplica. Devolve NOME, nunca caminho — é o que o
    `staticFile()` do Remotion espera, e o que impede caminho de disco de vazar nos props.

    O laço pula candidato ausente ou de 0 byte, para um `.webp` interrompido não sombrear um
    `.jpg` bom. Ele NÃO julga se a imagem abre — arquivo truncado com bytes passa por aqui;
    quem recusa isso é o `serve.render_background`, que roda o `background_ok` (um ffprobe)
    antes de o nome chegar ao render. Esta função não abre processo nenhum, de propósito.
    """
    base = os.path.splitext(os.path.basename(filename or ""))[0]
    if not base:
        return ""
    for ext in THUMB_EXTS:
        alvo = os.path.join(folder, base + ext)
        if os.path.isfile(alvo) and os.path.getsize(alvo) > 0:
            return base + ext
    return ""
