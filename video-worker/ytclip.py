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


def _window(cues, anchor, total, stops=()):
    """Trecho que começa numa abertura limpa e fecha ONDE A IDEIA ACABA.

    Cortar no meio da palavra é o defeito mais visível de recorte automático, e começar no
    meio do raciocínio é o mais caro: o corte roda inteiro e não se entende. Por isso o
    início recua até uma fala que NÃO abre em conector solto.

    O fim não é cronômetro. "A strong 25-second idea can become one clip. A complete
    70-second story can become another clip. Do not force every moment into the same
    duration": fecha-se num ponto final seguido de pausa de verdade, ou numa troca de
    assunto (`stops` = começo dos capítulos), ou — se a fala não dá trégua — no primeiro
    ponto final depois do teto suave da história.
    """
    if not cues:
        start = max(0.0, anchor)
        return start, min(total or start + TARGET_CLIP_SEC, start + TARGET_CLIP_SEC), ""
    index = 0
    for position, cue in enumerate(cues):
        if cue["end"] > anchor:
            index = position
            break
    else:
        index = len(cues) - 1
    # Recuo: enquanto a fala anterior não terminou frase e ainda cabe no corte.
    first = index
    while first > 0:
        previous = cues[first - 1]
        if SENTENCE_END_RE.search(previous["text"]):
            break
        if cues[index]["start"] - previous["start"] > MAX_CLIP_SEC / 3:
            break
        first -= 1
    # Dentro do MESMO orçamento de recuo: se a abertura ainda começa em conector solto,
    # tenta a fala anterior. Perder três segundos custa menos que entregar corte que abre
    # em "mas" e só faz sentido para quem ouviu o podcast inteiro.
    clean = first
    while clean > 0 and _dangling_opener(cues[clean]["text"]):
        if cues[index]["start"] - cues[clean - 1]["start"] > MAX_CLIP_SEC / 3:
            break
        clean -= 1
    if not _dangling_opener(cues[clean]["text"]):
        first = clean
    start = cues[first]["start"]
    # Trocas de assunto que valem como fecho: só as que caem depois do corte já ter tamanho.
    shifts = [float(s) for s in (stops or ()) if float(s) > start + MIN_CLIP_SEC]
    last = first
    strong = None
    weak = None
    for position in range(first, len(cues)):
        cue = cues[position]
        if cue["end"] - start > MAX_CLIP_SEC:
            break
        last = position
        span = cue["end"] - start
        if span < MIN_CLIP_SEC or not SENTENCE_END_RE.search(cue["text"]):
            continue
        weak = position
        following = cues[position + 1] if position + 1 < len(cues) else None
        pause = (following["start"] - cue["end"]) if following else CLOSE_PAUSE_SEC
        shift = following is not None and any(
            cue["start"] < point <= following["start"] for point in shifts)
        if pause >= CLOSE_PAUSE_SEC or shift or span >= STORY_CLIP_SEC:
            strong = position
            break
    close = strong if strong is not None else weak
    end = cues[close if close is not None else last]["end"]
    if total:
        end = min(end, float(total))
    if end - start < MIN_CLIP_SEC:
        end = min(start + MIN_CLIP_SEC, float(total) if total else start + MIN_CLIP_SEC)
    text = " ".join(cues[position]["text"]
                    for position in range(first, (close if close is not None else last) + 1)).strip()
    return start, end, text


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


def candidates(info, limit=MAX_CANDIDATES):
    """Metadados + legenda -> trechos sugeridos. Função pura: nada de rede aqui.

    Cada item sai no MESMO formato que o `clip` já guardado em pp_video_ops_v1
    (video-ops.js:603-605), então entra no site sem migração de schema, com
    `state='candidate'` — nada é aprovado nem baixado por esta função.
    """
    cues = list(info.get("cues") or [])
    chapters = list(info.get("chapters") or [])
    total = float(info.get("durationSec") or 0.0)
    peaks = heatmap_peaks(info.get("heatmap"))
    raw = []

    for peak in peaks[:limit]:
        share = int(round(peak.get("ratio", 0) * 100))
        raw.append({
            "anchor": float(peak["start"]),
            "score": 45 + min(35, int(peak.get("ratio", 0) * 35)),
            "signals": ["heatmap"],
            "reasons": ["pico de \u201cMais reproduzidos\u201d (%d%% do maior do v\u00eddeo)" % share],
            "topic": "",
        })

    for chapter in chapters:
        start = chapter.get("start_time")
        if start is None:
            continue
        title = re.sub(r"\s+", " ", str(chapter.get("title") or "")).strip()
        raw.append({
            "anchor": float(start),
            "score": 30,
            "signals": ["chapter"],
            "reasons": ["in\u00edcio do cap\u00edtulo \u201c%s\u201d" % title if title else "in\u00edcio de cap\u00edtulo"],
            "topic": title[:140],
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
            "anchor": float(cue["start"]),
            "score": min(70, 18 + points),
            "signals": ["transcript"],
            "reasons": labels,
            "topic": "",
        })

    raw.sort(key=lambda item: item["score"], reverse=True)
    # Começo de capítulo = troca de assunto declarada por quem publicou. Serve de fecho para
    # a janela: a ideia acabou ali, mesmo que a pessoa continue falando sem pausa.
    stops = tuple(float(c["start_time"]) for c in chapters if c.get("start_time") is not None)
    picked = []
    for item in raw:
        start, end, text = _window(cues, item["anchor"], total, stops)
        if end - start < MIN_CLIP_SEC:
            continue
        merged = None
        for chosen in picked:
            overlap = min(chosen["outSec"], end) - max(chosen["inSec"], start)
            span = min(chosen["outSec"] - chosen["inSec"], end - start)
            if abs(chosen["inSec"] - start) <= MERGE_GAP_SEC or (span > 0 and overlap > span * 0.5):
                merged = chosen
                break
        if merged:
            # Mesmo trecho achado por outro sinal: soma confiança em vez de duplicar a
            # sugestão. Dois sinais concordando vale mais que um, e o operador vê os dois.
            for signal in item["signals"]:
                if signal not in merged["signals"]:
                    merged["signals"].append(signal)
                    merged["score"] = min(100, merged["score"] + 12)
            for reason in item["reasons"]:
                if reason not in merged["reasons"]:
                    merged["reasons"].append(reason)
            if item["topic"] and not merged["topic"]:
                merged["topic"] = item["topic"]
            continue
        # A nota tem que refletir MOMENTO FORTE, não só presença de sinal: uma janela que
        # fala de fracasso, dinheiro ou conselho vale mais que uma que só coincidiu com um
        # pico. E abertura pendurada desconta, porque o corte pode não se sustentar sozinho.
        guess = classify_segment(text)
        warning = _dangling_opener(text)
        bonus = guess["confidence"] // 10
        if guess["category"] in STRONG_CATEGORIES:
            bonus += 10
        if warning:
            bonus -= 8
        picked.append({
            "inSec": round(start, 2), "outSec": round(end, 2),
            "score": max(0, item["score"] + bonus), "signals": list(item["signals"]),
            "reasons": list(item["reasons"]), "topic": item["topic"],
            "hook": _first_sentence(text), "guess": guess, "warning": warning,
        })
        if len(picked) >= limit:
            break

    picked.sort(key=lambda c: c["score"], reverse=True)
    out = []
    for position, clip in enumerate(picked):
        duration = clip["outSec"] - clip["inSec"]
        motives = list(clip["reasons"])
        category = clip["guess"]["category"]
        if category:
            # "pela legenda" n\u00e3o \u00e9 enfeite: separa palpite de texto do dado observado do
            # heatmap, que \u00e9 a \u00fanica coisa aqui que mede audi\u00eancia de verdade.
            motives.append("assunto prov\u00e1vel pela legenda: %s" % CATEGORY_LABELS[category])
        reasons = "; ".join(motives) or "trecho com fala cont\u00ednua"
        out.append({
            "inSec": clip["inSec"], "outSec": clip["outSec"],
            "durationSec": round(duration, 2),
            "score": min(100, int(clip["score"])),
            "signals": clip["signals"],
            "topic": (clip["topic"] or _first_sentence(clip["hook"], 60) or
                      "Corte %02d" % (position + 1))[:140],
            "hook": clip["hook"][:300],
            "reason": ("%s (%.0fs)" % (reasons, duration))[:1000],
            "category": category,
            "contextWarning": ("Come\u00e7a com \u201c%s\u201d \u2014 pode n\u00e3o fazer "
                               "sentido sozinho." % clip["warning"]) if clip["warning"] else "",
            "state": "candidate",
        })
    return out


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
    }


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
