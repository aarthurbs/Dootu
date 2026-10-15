# -*- coding: utf-8 -*-
"""Sugestao de legenda do post + hashtags para UM corte, pelo Claude.

Decisao do usuario, 2026-10-14: excecao ESCRITA a regra "nada de legenda de publicacao,
hashtag" (`.claude/rules/estudio-ui.md`). E so SUGESTAO: nada aqui publica, agenda ou
mede. O rascunho do TikTok continua sendo so o MP4 -- a API de inbox nao aceita texto
(`tiktok.py` manda so `source_info`), entao o operador copia a sugestao e cola no celular.

Adaptado do `generate_social_metadata` do MoneyPrinterTurbo (MIT,
`app/services/llm.py`): o prompt por plataforma e a limpeza das hashtags. O que NAO veio:
o titulo (o TikTok nao tem), as quatro plataformas (o Estudio so manda ao TikTok) e o
"fallback heuristico" deles, que devolve hashtags genericas quando a IA falha --
sugestao inventada e indistinguivel de sugestao de verdade. Aqui falha volta motivo.

Sem chave a ponte nao existe, como a MuAPI. Nenhuma excecao sobe daqui: todo desfecho
vira (sugestao, motivo). stdlib only -- restricao de arquitetura do `video-worker/`.
"""

import json
import os
import re
import urllib.error
import urllib.request

URL = "https://api.anthropic.com/v1/messages"
ENV_KEY = "ANTHROPIC_API_KEY"
MODELO = "claude-opus-5-5"
# Teto do campo de legenda do TikTok; a resposta passa disso so se a IA desobedecer.
LEGENDA_MAX = 2200
HASHTAGS = 5
# Fala de um corte de 3 min fica perto de 3 KB; o teto so impede mandar um podcast inteiro.
TEXTO_MAX = 8000
TITULO_MAX = 300
HTTP_TIMEOUT = 90.0

ESQUEMA = {
    "type": "object",
    "properties": {
        "legenda": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["legenda", "hashtags"],
    "additionalProperties": False,
}

SISTEMA = """Você escreve a legenda de posts do TikTok para cortes de podcast de negócios e empreendedorismo em português do Brasil.

Regras:
1. A legenda resume a ideia central do que é DITO no corte, em 1 a 3 frases curtas, e termina com uma pergunta ou chamada curta para comentar.
2. Seja fiel à fala: não invente número, nome, promessa ou fato que não esteja no texto.
3. Tom claro e com autoridade. Sem emoji, sem caixa alta gritada, sem clickbait.
4. Não coloque hashtag dentro da legenda.
5. "hashtags": exatamente {n} hashtags relevantes ao assunto, cada uma começando com "#", sem espaço.""".format(n=HASHTAGS)


def _open(req, timeout):
    """Costura unica de rede -- o teste troca ESTA funcao, nao o urllib."""
    return urllib.request.urlopen(req, timeout=timeout)


def normalizar_hashtags(bruto, quantas=HASHTAGS):
    """Lista (ou texto) da IA -> ['#tag', ...] sem vazio, sem repetida, no maximo `quantas`.

    Porte do `_normalize_hashtags` do MoneyPrinterTurbo: item de lista e UMA tag inteira
    ("du lich" vira "#dulich", nao duas), texto solto quebra por espaco/virgula.
    """
    if isinstance(bruto, str):
        itens = re.split(r"[\s,]+", bruto)
    elif isinstance(bruto, (list, tuple)):
        itens = [str(i) for i in bruto]
    else:
        itens = []
    vistas, saida = set(), []
    for item in itens:
        tag = re.sub(r"[^\w]", "", item)
        if not tag or tag.lower() in vistas:
            continue
        vistas.add(tag.lower())
        saida.append("#" + tag)
        if len(saida) >= quantas:
            break
    return saida


def pedido(texto, titulo=""):
    """Corpo do POST /v1/messages. Puro."""
    contexto = "Título do vídeo de origem: %s\n\n" % titulo if titulo else ""
    return {
        "model": MODELO,
        "max_tokens": 16000,
        # Tarefa curta e de baixo risco: o esforco baixo segura custo e tempo de espera.
        "output_config": {"effort": "low",
                          "format": {"type": "json_schema", "schema": ESQUEMA}},
        # Recusa de classificador reroda noutro modelo dentro da MESMA chamada.
        "fallbacks": "default",
        "system": SISTEMA,
        "messages": [{"role": "user", "content": contexto + "Fala do corte:\n" + texto}],
    }


def ler_resposta(resposta):
    """Objeto da API -> ({legenda, hashtags}, motivo). Puro."""
    if not isinstance(resposta, dict):
        return None, "A IA devolveu resposta ilegivel."
    parada = resposta.get("stop_reason")
    if parada == "refusal":
        return None, "A IA recusou este texto."
    if parada == "max_tokens":
        return None, "A resposta da IA foi cortada no meio."
    blocos = resposta.get("content") or []
    texto = next((b.get("text") for b in blocos
                  if isinstance(b, dict) and b.get("type") == "text"), None)
    try:
        dados = json.loads(texto or "")
    except ValueError:
        return None, "A IA devolveu resposta ilegivel."
    if not isinstance(dados, dict):
        return None, "A IA devolveu resposta ilegivel."
    legenda = str(dados.get("legenda") or "").strip()[:LEGENDA_MAX].rstrip()
    if not legenda:
        return None, "A IA devolveu legenda vazia."
    return {"legenda": legenda, "hashtags": normalizar_hashtags(dados.get("hashtags"))}, ""


def sugerir(texto, titulo="", api_key=None):
    """(sugestao, motivo). Sugestao = {legenda, hashtags}; motivo preenchido = nao deu."""
    api_key = api_key if api_key is not None else os.environ.get(ENV_KEY, "")
    if not api_key:
        return None, "Sugestao desligada (sem %s no ambiente)." % ENV_KEY
    texto = " ".join(str(texto or "").split())[:TEXTO_MAX]
    if not texto:
        return None, "Este corte nao tem fala transcrita para resumir."
    titulo = " ".join(str(titulo or "").split())[:TITULO_MAX]
    req = urllib.request.Request(
        URL, data=json.dumps(pedido(texto, titulo)).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "x-api-key": api_key,
                 "anthropic-version": "2023-06-01",
                 "anthropic-beta": "server-side-fallback-2026-07-01"},
    )
    try:
        with _open(req, HTTP_TIMEOUT) as resp:
            corpo = resp.read()
    except urllib.error.HTTPError as err:
        if err.code in (401, 403):
            return None, "A Anthropic recusou a chave (HTTP %d)." % err.code
        if err.code == 429:
            return None, "Limite da Anthropic atingido (HTTP 429). Tente de novo em instantes."
        return None, "A Anthropic respondeu HTTP %d." % err.code
    except Exception as err:  # rede, DNS, timeout, TLS
        return None, "Anthropic inacessivel (%s)." % type(err).__name__
    try:
        return ler_resposta(json.loads(corpo.decode("utf-8")))
    except ValueError:
        return None, "A IA devolveu resposta ilegivel."
