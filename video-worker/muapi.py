# -*- coding: utf-8 -*-
"""Ponte OPCIONAL para o `ai-clipping` da MuAPI: URL de video -> instantes sugeridos.

Por que existe: dar ao `ytclip.candidates` mais uma ANCORA, do mesmo jeito que o
heatmap e os capitulos ja entram. O que a MuAPI devolve e um palpite de ONDE OLHAR,
nao um corte: a borda continua sendo resolvida aqui, na fala, e o veto editorial
continua reprovando o que nao presta. Sem chave a ponte nao existe -- e desligada
nao custa um milissegundo no `/api/yt-probe`.

Contrato espelhado de `open-generative-ai/packages/studio/src/muapi.js` (MIT):
  POST {BASE}/api/v1/ai-clipping  {video_url, num_highlights, aspect_ratio,
                                   return_coordinates_only}  -> {request_id|id}
  GET  {BASE}/api/v1/predictions/{request_id}/result          -> {status, ...}
  terminal: completed/succeeded/success  |  failed/error/cancelled/canceled
  5xx no poll e transitorio (o cliente deles continua tentando); 4xx nao.

O que NAO foi espelhado, de proposito: `ClippingStudio.jsx:528` INVENTA
`start_time = idx * 15` com score decrescente quando a resposta vem sem coordenada.
Aqui isso volta como lista vazia e motivo a vista (BP-008) -- sugestao inventada e
pior que sugestao nenhuma, porque e indistinguivel de uma medida.

Nenhuma excecao sobe daqui: a analise e leitura de metadados e nao pode morrer
porque um terceiro caiu. Todo desfecho vira (lista, motivo).

stdlib only -- restricao de arquitetura do `video-worker/`.
"""

import json
import math
import os
import time
import urllib.error
import urllib.request

BASE = "https://api.muapi.ai"
ENV_KEY = "MUAPI_KEY"

# Teto do trabalho todo (submit + poll). O `/api/yt-probe` responde a uma tela que o
# usuario esta olhando: melhor voltar sem sugestao da MuAPI do que deixar a analise
# inteira pendurada num terceiro. O cliente deles espera ate 900 tentativas (30 min).
POLL_MAX_SEC = 60.0
POLL_INTERVAL = 2.0
HTTP_TIMEOUT = 20.0

SUCCESS_STATES = ("completed", "succeeded", "success")
FAILURE_STATES = ("failed", "error", "cancelled", "canceled")


def _open(req, timeout):
    """Costura unica de rede -- o teste troca ESTA funcao, nao o urllib."""
    return urllib.request.urlopen(req, timeout=timeout)


def _request(url, api_key, payload=None):
    """(objeto, motivo). Motivo preenchido = nao deu, e o texto ja esta em portugues."""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method="POST" if data is not None else "GET",
        headers={"Content-Type": "application/json", "x-api-key": api_key},
    )
    try:
        with _open(req, HTTP_TIMEOUT) as resp:
            corpo = resp.read()
    except urllib.error.HTTPError as err:
        if err.code in (401, 403):
            return None, "MuAPI recusou a chave (HTTP %d)." % err.code
        if err.code == 402:
            return None, "MuAPI sem credito (HTTP 402)."
        return None, "MuAPI respondeu HTTP %d." % err.code
    except Exception as err:  # rede, DNS, timeout, TLS -- nada disso derruba a analise
        return None, "MuAPI inacessivel (%s)." % type(err).__name__
    try:
        return json.loads(corpo.decode("utf-8")), ""
    except Exception:
        return None, "MuAPI devolveu resposta ilegivel."


def _coord_list(result):
    """As cinco formas que o cliente deles tenta ler, na mesma ordem.

    Cinco e o numero exato de tentativas em `ClippingStudio.jsx:516-522`: nem eles
    sabem qual o endpoint usa. Ler as cinco custa cinco linhas; adivinhar uma custa
    o recurso inteiro voltando vazio sem ninguem entender por que.
    """
    saida = result.get("output")
    saida = saida if isinstance(saida, dict) else {}
    for balde in (saida.get("coordinates"), result.get("coordinates"),
                  saida.get("timings"), result.get("timings"), saida.get("clips")):
        if isinstance(balde, list) and balde:
            return balde
    return []


def _trecho(item):
    """Um item da resposta -> {start, end}, ou None se nao da para crer.

    So estes dois campos saem daqui. O `score` deles NAO entra: o `interesse` do
    `ytclip` e popularidade de AUDIENCIA medida (com desconto de abertura), e a
    confianca de um modelo e outra grandeza -- misturar as duas no mesmo slot faz o
    mesmo video render corte diferente sem ninguem ver. O `label` tambem fica de
    fora: o padrao deles e "Highlight #1", que viraria manchete inventada na tela.
    """
    if not isinstance(item, dict):
        return None
    bruto_ini = item.get("start_time", item.get("start"))
    bruto_fim = item.get("end_time", item.get("end"))
    try:
        inicio, fim = float(bruto_ini), float(bruto_fim)
    except (TypeError, ValueError):
        return None
    # NaN/inf passam pelo float() e envenenam a ordenacao e o `_indice_em` la na frente.
    if not (math.isfinite(inicio) and math.isfinite(fim)) or inicio < 0.0 or fim <= inicio:
        return None
    return {"start": inicio, "end": fim}


def highlights(video_url, api_key=None, num_highlights=3, aspect_ratio="9:16"):
    """(lista, motivo). Lista de {start, end} -- SO instantes, zero midia.

    `return_coordinates_only=True` e o que mantem isto barato e dentro do portao de
    direitos: a MuAPI nao renderiza nem devolve arquivo, so diz onde olhar. Quem corta
    continua sendo o FFmpeg daqui.
    """
    api_key = api_key if api_key is not None else os.environ.get(ENV_KEY, "")
    if not api_key:
        return [], "MuAPI desligada (sem %s no ambiente)." % ENV_KEY
    if not str(video_url or "").strip():
        return [], "MuAPI nao foi chamada: sem URL de video."

    envio, motivo = _request(BASE + "/api/v1/ai-clipping", api_key, {
        "video_url": video_url,
        "num_highlights": int(num_highlights),
        "aspect_ratio": aspect_ratio,
        "return_coordinates_only": True,
    })
    if motivo:
        return [], motivo
    if not isinstance(envio, dict):
        return [], "MuAPI devolveu resposta ilegivel."

    pedido = envio.get("request_id") or envio.get("id")
    resultado = envio if not pedido else None
    if pedido:
        limite = time.time() + POLL_MAX_SEC
        url = "%s/api/v1/predictions/%s/result" % (BASE, pedido)
        while resultado is None:
            if time.time() >= limite:
                return [], "MuAPI nao respondeu em %ds." % int(POLL_MAX_SEC)
            time.sleep(POLL_INTERVAL)
            parcial, motivo = _request(url, api_key)
            if motivo:
                # 5xx e transitorio no cliente deles; 4xx e resposta e encerra.
                if "HTTP 5" in motivo and time.time() < limite:
                    continue
                return [], motivo
            if not isinstance(parcial, dict):
                return [], "MuAPI devolveu resposta ilegivel."
            estado = str(parcial.get("status") or "").lower()
            if estado in FAILURE_STATES:
                return [], "MuAPI falhou (%s)." % (estado or "sem estado")
            if estado in SUCCESS_STATES:
                resultado = parcial

    trechos = [t for t in (_trecho(i) for i in _coord_list(resultado)) if t]
    if not trechos:
        # Aqui e exatamente onde o cliente deles inventa `idx * 15`. Nos dizemos.
        return [], "MuAPI respondeu sem nenhuma coordenada utilizavel."
    trechos.sort(key=lambda t: t["start"])
    return trechos[:int(num_highlights)], ""
