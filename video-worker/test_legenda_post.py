# -*- coding: utf-8 -*-
"""Provas da sugestao de legenda do post (`legenda_post.py`) e da rota `/api/legenda-post`.

NENHUMA rede: a costura `legenda_post._open` e trocada por uma resposta montada a mao.
Chamar a Anthropic de verdade gastaria credito e falharia por motivo alheio ao codigo.

O que este script prova (e falha alto se nao for verdade):
   1. desligada     -> sem chave ou sem fala nao toca a rede e diz por que
   2. pedido        -> modelo, esforco, JSON estruturado, fallback e cabecalhos certos
   3. leitura       -> pega o bloco de texto (pula o de pensamento) e apara a legenda
   4. hashtags      -> porte do MoneyPrinterTurbo: '#', sem pontuacao, sem repetida, teto 5
   5. nao inventa   -> recusa, corte no meio, JSON torto e legenda vazia viram motivo
   6. nunca levanta -> 401, 429, 5xx, rede caida e corpo ilegivel viram motivo
   7. rota          -> `/api/legenda-post` despacha, responde e separa "sem chave"

Uso:
    py -3.12 video-worker\\test_legenda_post.py
"""

import json
import os
import sys
import types
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import legenda_post as lp  # noqa: E402

CHECKS = []
FALA = "  a gente quebrou duas vezes antes de achar o produto certo\n e o erro foi vender pra todo mundo "


def check(label, ok):
    CHECKS.append((label, bool(ok)))


class _Resp:
    def __init__(self, corpo):
        self._corpo = corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode("utf-8")

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def resposta(dados, parada="end_turn"):
    """Mensagem da API com um bloco de pensamento ANTES do texto, como o Opus 5.5 devolve."""
    texto = dados if isinstance(dados, str) else json.dumps(dados, ensure_ascii=False)
    return {"stop_reason": parada,
            "content": [{"type": "thinking", "thinking": ""}, {"type": "text", "text": texto}]}


def rodar(resp, texto=FALA, titulo="Podcast de negocios", api_key="chave-teste"):
    """(sugestao, motivo, pedidos). `resp` e o que a rede devolve, ou a excecao que ela levanta."""
    pedidos = []

    def falso(req, timeout):
        pedidos.append(req)
        if isinstance(resp, Exception):
            raise resp
        return _Resp(resp)

    antes = lp._open
    lp._open = falso
    try:
        sugestao, motivo = lp.sugerir(texto, titulo, api_key=api_key)
    finally:
        lp._open = antes
    return sugestao, motivo, pedidos


def main():
    # ---------------------------------------------------------------- 1. desligada
    s, m, p = rodar(resposta({}), api_key="")
    check("1a. sem chave nao toca a rede", s is None and not p)
    check("1b. e diz qual variavel falta", lp.ENV_KEY in m)
    s, m, p = rodar(resposta({}), texto="   \n ")
    check("1c. corte sem fala nao toca a rede e diz", s is None and not p and "fala" in m)

    # ---------------------------------------------------------------- 2. pedido
    ok_resp = resposta({"legenda": "Vender para todo mundo quase quebrou a empresa. Você já errou o público?",
                        "hashtags": ["#empreendedorismo", "negócios", "#Vendas", "#vendas", "du lich", "#!!", "#gestão", "#extra"]})
    s, m, p = rodar(ok_resp)
    req = p[0] if p else None
    corpo = json.loads(req.data.decode("utf-8")) if req else {}
    cab = {k.lower(): v for k, v in (req.header_items() if req else [])}
    check("2a. uma chamada, POST na Messages API", len(p) == 1 and req.full_url == lp.URL
          and req.get_method() == "POST")
    check("2b. modelo claude-opus-5-5 com esforco baixo", corpo.get("model") == "claude-opus-5-5"
          and corpo["output_config"]["effort"] == "low")
    fmt = corpo.get("output_config", {}).get("format", {})
    check("2c. resposta presa ao esquema JSON (legenda + hashtags, nada mais)",
          fmt.get("type") == "json_schema" and fmt["schema"]["required"] == ["legenda", "hashtags"]
          and fmt["schema"]["additionalProperties"] is False)
    check("2d. fallback 'default' com o cabecalho da forma escalar",
          corpo.get("fallbacks") == "default"
          and cab.get("anthropic-beta") == "server-side-fallback-2026-07-01")
    check("2e. chave e versao nos cabecalhos", cab.get("x-api-key") == "chave-teste"
          and cab.get("anthropic-version") == "2023-06-01")
    conteudo = corpo["messages"][0]["content"] if corpo else ""
    check("2f. a fala vai limpa de espacos, com o titulo do video junto",
          "a gente quebrou duas vezes antes de achar o produto certo e o erro foi vender pra todo mundo" in conteudo
          and "Podcast de negocios" in conteudo)
    check("2g. sem pensamento desligado nem orcamento (400 no Opus 5.5)",
          "thinking" not in corpo and "temperature" not in corpo)
    _, _, p = rodar(ok_resp, texto="x" * (lp.TEXTO_MAX + 500), titulo="")
    longo = json.loads(p[0].data.decode("utf-8"))["messages"][0]["content"]
    check("2h. fala gigante e aparada no teto e titulo vazio nao vira linha",
          longo.count("x") == lp.TEXTO_MAX and "Título" not in longo)

    # ---------------------------------------------------------------- 3/4. leitura e hashtags
    check("3a. le o bloco de TEXTO, nao o de pensamento",
          m == "" and s["legenda"].startswith("Vender para todo mundo"))
    check("4a. hashtags com '#', sem pontuacao, sem repetida (sem diferenciar caixa), teto 5",
          s["hashtags"] == ["#empreendedorismo", "#negócios", "#Vendas", "#dulich", "#gestão"])
    check("4b. texto solto quebra por espaco e virgula",
          lp.normalizar_hashtags("#a, b  #c", 5) == ["#a", "#b", "#c"])
    check("4c. tipo estranho vira lista vazia", lp.normalizar_hashtags(None) == []
          and lp.normalizar_hashtags(42) == [])
    s, m, _ = rodar(resposta({"legenda": "a" * (lp.LEGENDA_MAX + 50), "hashtags": []}))
    check("3b. legenda acima do teto do TikTok e aparada", m == "" and len(s["legenda"]) == lp.LEGENDA_MAX)

    # ---------------------------------------------------------------- 5. nao inventa
    casos = [
        ("5a. recusa do classificador", resposta({}, parada="refusal"), "recusou"),
        ("5b. resposta cortada no meio", resposta('{"legenda": "abc', parada="max_tokens"), "cortada"),
        ("5c. texto que nao e JSON", resposta("Claro! Aqui vai a legenda"), "ilegivel"),
        ("5d. JSON que nao e objeto", resposta("[1, 2]"), "ilegivel"),
        ("5e. legenda vazia", resposta({"legenda": "  ", "hashtags": ["#a"]}), "vazia"),
        ("5f. resposta sem bloco de texto", {"stop_reason": "end_turn", "content": []}, "ilegivel"),
    ]
    for label, resp, palavra in casos:
        s, m, _ = rodar(resp)
        check(label + " -> motivo, sem sugestao (nada de hashtag generica)", s is None and palavra in m)

    # ---------------------------------------------------------------- 6. nunca levanta
    def http(code):
        return urllib.error.HTTPError(lp.URL, code, "x", {}, None)

    for label, erro, palavra in [("6a. chave recusada", http(401), "chave"),
                                 ("6b. limite de uso", http(429), "429"),
                                 ("6c. erro do servidor", http(529), "HTTP 529"),
                                 ("6d. rede caida", urllib.error.URLError("dns"), "inacessivel"),
                                 ("6e. timeout", TimeoutError(), "inacessivel")]:
        s, m, _ = rodar(erro)
        check(label + " vira motivo", s is None and palavra in m)
    s, m, _ = rodar(b"<html>bad gateway</html>")
    check("6f. corpo que nao e JSON vira motivo", s is None and "ilegivel" in m)

    # ---------------------------------------------------------------- 7. rota
    import serve  # noqa: E402
    chamados = []
    h = serve.CutHandler.__new__(serve.CutHandler)
    h.path = serve.ROUTE_LEGENDA_POST
    h._handle_legenda_post = lambda: chamados.append(1)
    h.log_message = lambda *a: None
    h.do_POST()
    check("7a. POST /api/legenda-post despacha para o handler", chamados == [1])

    enviados = []
    falso = types.SimpleNamespace(_json_body=lambda: {"texto": FALA, "titulo": "T"},
                                  _send_json=enviados.append, log_message=lambda *a: None)
    antes = (lp.sugerir, os.environ.get(lp.ENV_KEY))
    try:
        lp.sugerir = lambda texto, titulo: ({"legenda": "L", "hashtags": ["#a"]}, "")
        os.environ[lp.ENV_KEY] = "chave-teste"
        serve.CutHandler._handle_legenda_post(falso)
        lp.sugerir = lambda texto, titulo: (None, "Sugestao desligada.")
        os.environ.pop(lp.ENV_KEY, None)
        serve.CutHandler._handle_legenda_post(falso)
    finally:
        lp.sugerir = antes[0]
        if antes[1] is None:
            os.environ.pop(lp.ENV_KEY, None)
        else:
            os.environ[lp.ENV_KEY] = antes[1]
    check("7b. sucesso devolve legenda, hashtags e motivo vazio",
          enviados[0] == {"legenda": "L", "hashtags": ["#a"], "motivo": "", "desligada": False})
    check("7c. sem chave devolve motivo e desligada=true (tentar de novo nao adianta)",
          enviados[1]["motivo"] and enviados[1]["desligada"] is True and enviados[1]["legenda"] == "")

    # ---------------------------------------------------------------- relatorio
    print("\n--- verificacoes ---")
    falhas = 0
    for label, ok in CHECKS:
        print("  %s  %s" % ("ok  " if ok else "FALHA", label))
        if not ok:
            falhas += 1
    if falhas:
        print("\nFALHOU: %d verificacao(oes)" % falhas)
        return 1
    print("\nok - %d verificacoes passaram. Nenhuma rede, nenhum credito gasto." % len(CHECKS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
