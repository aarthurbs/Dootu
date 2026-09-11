# -*- coding: utf-8 -*-
"""Provas da ponte para o detector externo (`muapi.py`) e da sua fiacao no `ytclip`.

NENHUMA rede: a costura `muapi._open` e trocada por uma fila de respostas montada a mao.
Teste que chama a MuAPI de verdade gastaria credito, falharia por motivo alheio ao codigo
e ensinaria o operador a ignorar falha.

O que este script prova (e falha alto se nao for verdade):
   1. desligada        -> sem chave/URL nao toca a rede e diz por que
   2. contrato         -> submit + poll ate estado terminal, como o cliente MIT deles faz
   3. leitura          -> as cinco formas de resposta e os dois nomes de campo
   4. desconfianca     -> item sem numero, NaN, inf, negativo ou invertido e descartado
   5. NAO INVENTA      -> sucesso sem coordenada volta VAZIO (o cliente deles poe idx*15)
   6. nunca levanta    -> 4xx, 5xx, rede caida e corpo ilegivel viram motivo, nao excecao
   7. fiacao no ytclip -> com e SEM a chave `muapiHighlights` (BP-014: os dois ramos)
   8. ancora, nao borda-> o trecho so existe se a FALA confirmar; borda nunca vem de fora
   9. rotulo na tela   -> `video-ops.js` sabe nomear o sinal novo

Uso:
    py -3.12 video-worker\\test_muapi.py
"""

import json
import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import muapi  # noqa: E402
import test_ytclip  # noqa: E402  (reaproveita os construtores de fixture, nao roda o main)
import ytclip  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECKS = []

URL = "https://www.youtube.com/watch?v=aircAruvnKk"


def check(label, ok):
    CHECKS.append((label, bool(ok)))


class _Resp:
    """O minimo que o `with _open(...) as resp: resp.read()` do `muapi` consome."""

    def __init__(self, corpo):
        self._corpo = corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode("utf-8")

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def rodar(*respostas, **kw):
    """(lista, motivo, chamadas). Cada resposta da fila atende uma chamada de rede.

    Resposta pode ser objeto (vira JSON), bytes (corpo cru) ou Exception (levantada) --
    que e como se prova o ramo de erro sem derrubar nada de verdade.
    """
    fila = list(respostas)
    chamadas = []

    def fake(req, timeout):
        chamadas.append(req.full_url)
        item = fila.pop(0) if fila else {}
        if isinstance(item, Exception):
            raise item
        return _Resp(item)

    original = muapi._open
    muapi._open = fake
    try:
        url = kw.pop("url", URL)
        chave = kw.pop("api_key", "k-de-teste")
        lista, motivo = muapi.highlights(url, api_key=chave, **kw)
    finally:
        muapi._open = original
    return lista, motivo, chamadas


def pronto(coordenadas, campo="coordinates", dentro=False):
    """Resposta de poll ja concluida, com as coordenadas no balde pedido."""
    corpo = {"status": "completed"}
    if dentro:
        corpo["output"] = {campo: coordenadas}
    else:
        corpo[campo] = coordenadas
    return corpo


def main():
    muapi.POLL_INTERVAL = 0.0  # o contrato de espera e provado no 6g; aqui seria so lentidao

    # --------------------------------------------------------------- 1. desligada
    lista, motivo, chamadas = rodar(api_key="")
    check("1a. sem chave devolve lista vazia", lista == [])
    check("1b. sem chave diz qual variavel falta", muapi.ENV_KEY in motivo)
    check("1c. sem chave NAO toca a rede", chamadas == [])
    lista, motivo, chamadas = rodar(url="  ")
    check("1d. sem URL devolve vazio com motivo", lista == [] and bool(motivo))
    check("1e. sem URL NAO toca a rede", chamadas == [])
    guardada = os.environ.get(muapi.ENV_KEY)
    os.environ.pop(muapi.ENV_KEY, None)
    try:
        vazio, motivo_env = muapi.highlights(URL)
        check("1f. sem argumento a chave vem do ambiente (ausente = desligada)",
              vazio == [] and muapi.ENV_KEY in motivo_env)
    finally:
        if guardada is not None:
            os.environ[muapi.ENV_KEY] = guardada

    # --------------------------------------------------------------- 2. contrato
    lista, motivo, chamadas = rodar({"request_id": "req-1"},
                                    pronto([{"start_time": 120.0, "end_time": 160.0}]))
    check("2a. caminho feliz devolve o trecho", lista == [{"start": 120.0, "end": 160.0}])
    check("2b. caminho feliz nao inventa motivo", motivo == "")
    check("2c. o submit vai no endpoint do ai-clipping",
          chamadas and chamadas[0].endswith("/api/v1/ai-clipping"))
    check("2d. o poll usa o request_id devolvido",
          len(chamadas) == 2 and chamadas[1].endswith("/api/v1/predictions/req-1/result"))
    check("2e. `id` serve de request_id quando nao vem `request_id`",
          rodar({"id": "req-2"}, pronto([{"start": 10.0, "end": 40.0}]))[2][1].endswith(
              "/api/v1/predictions/req-2/result"))
    check("2f. resposta ja pronta no submit dispensa o poll",
          rodar(pronto([{"start": 10.0, "end": 40.0}]))[0] == [{"start": 10.0, "end": 40.0}])
    check("2g. estado nao-terminal continua o poll",
          rodar({"request_id": "r"}, {"status": "processing"}, {"status": "queued"},
                pronto([{"start": 5.0, "end": 30.0}]))[0] == [{"start": 5.0, "end": 30.0}])
    for estado in muapi.SUCCESS_STATES:
        check("2h. estado terminal de sucesso aceito: %s" % estado,
              rodar({"request_id": "r"}, {"status": estado, "coordinates":
                    [{"start": 5.0, "end": 30.0}]})[0] == [{"start": 5.0, "end": 30.0}])
    for estado in muapi.FAILURE_STATES:
        saiu, pormenor, _ = rodar({"request_id": "r"}, {"status": estado})
        check("2i. estado terminal de falha encerra sem levantar: %s" % estado,
              saiu == [] and estado in pormenor)

    # ---------------------------------------------------------------- 3. leitura
    coord = [{"start": 60.0, "end": 95.0}]
    for campo, dentro, nome in (("coordinates", False, "coordinates"),
                                ("coordinates", True, "output.coordinates"),
                                ("timings", False, "timings"),
                                ("timings", True, "output.timings"),
                                ("clips", True, "output.clips")):
        check("3a. le a resposta na forma `%s`" % nome,
              rodar({"request_id": "r"}, pronto(coord, campo, dentro))[0] == coord)
    check("3b. aceita o par start_time/end_time",
          rodar({"request_id": "r"}, pronto([{"start_time": 7.0, "end_time": 9.0}]))[0]
          == [{"start": 7.0, "end": 9.0}])
    check("3c. aceita o par start/end",
          rodar({"request_id": "r"}, pronto([{"start": 7.0, "end": 9.0}]))[0]
          == [{"start": 7.0, "end": 9.0}])
    check("3d. numero em texto e convertido",
          rodar({"request_id": "r"}, pronto([{"start": "7", "end": "9"}]))[0]
          == [{"start": 7.0, "end": 9.0}])
    check("3e. ordena por inicio",
          [t["start"] for t in rodar({"request_id": "r"}, pronto(
              [{"start": 90.0, "end": 99.0}, {"start": 10.0, "end": 20.0}]))[0]] == [10.0, 90.0])
    check("3f. respeita o teto pedido",
          len(rodar({"request_id": "r"}, pronto(
              [{"start": float(i), "end": float(i) + 5.0} for i in range(1, 30)]),
              num_highlights=4)[0]) == 4)
    check("3g. o `score` deles NAO entra no trecho (outra grandeza que o `interesse`)",
          rodar({"request_id": "r"}, pronto([{"start": 1.0, "end": 9.0, "score": 0.97}]))[0]
          == [{"start": 1.0, "end": 9.0}])
    check("3h. o `label` deles NAO entra (o padrao e 'Highlight #1' -- manchete inventada)",
          rodar({"request_id": "r"}, pronto(
              [{"start": 1.0, "end": 9.0, "label": "Highlight #1"}]))[0]
          == [{"start": 1.0, "end": 9.0}])

    # ----------------------------------------------------------- 4. desconfianca
    lixo = [None, "trecho", 42, [], {}, {"start": 5.0}, {"end": 5.0},
            {"start": "abc", "end": "def"}, {"start": None, "end": None},
            {"start": float("nan"), "end": 10.0}, {"start": 1.0, "end": float("inf")},
            {"start": -5.0, "end": 10.0}, {"start": 10.0, "end": 10.0},
            {"start": 30.0, "end": 10.0}]
    for item in lixo:
        saiu, _, _ = rodar({"request_id": "r"}, pronto([item]))
        check("4a. item imprestavel descartado: %r" % (item,), saiu == [])
    misto, _, _ = rodar({"request_id": "r"}, pronto(
        [{"start": 30.0, "end": 10.0}, {"start": 50.0, "end": 80.0}, None]))
    check("4b. item ruim no meio nao leva os bons junto", misto == [{"start": 50.0, "end": 80.0}])

    # ------------------------------------------------------------ 5. NAO INVENTA
    vazio, motivo, _ = rodar({"request_id": "r"}, {"status": "completed"})
    check("5a. sucesso sem coordenada devolve VAZIO", vazio == [])
    check("5b. e diz por que (BP-008)", bool(motivo.strip()))
    inventado = [{"start": 0.0, "end": 15.0}, {"start": 15.0, "end": 30.0},
                 {"start": 30.0, "end": 45.0}]
    check("5c. NAO repete o `idx * 15` do ClippingStudio.jsx:528", vazio != inventado)
    check("5d. balde vazio tambem nao vira trecho",
          rodar({"request_id": "r"}, pronto([]))[0] == [])

    # --------------------------------------------------------- 6. nunca levanta
    for codigo, pedaco in ((401, "chave"), (403, "chave"), (402, "credito"),
                           (404, "404"), (429, "429")):
        erro = urllib.error.HTTPError(URL, codigo, "nao", None, None)
        saiu, pormenor, _ = rodar(erro)
        check("6a. HTTP %d vira motivo, nao excecao" % codigo,
              saiu == [] and pedaco in pormenor)
    check("6b. rede caida vira motivo",
          rodar(urllib.error.URLError("sem rota"))[0] == []
          and "inacessivel" in rodar(urllib.error.URLError("sem rota"))[1])
    check("6c. corpo ilegivel vira motivo",
          rodar(b"<html>nao sou json</html>")[0] == []
          and "ilegivel" in rodar(b"<html>nao sou json</html>")[1])
    check("6d. resposta que nao e objeto vira motivo",
          rodar([1, 2, 3])[0] == [] and bool(rodar([1, 2, 3])[1]))
    saiu, pormenor, chamadas = rodar({"request_id": "r"},
                                     urllib.error.HTTPError(URL, 503, "oops", None, None),
                                     pronto([{"start": 8.0, "end": 44.0}]))
    check("6e. 5xx no poll e transitorio: continua e chega ao resultado",
          saiu == [{"start": 8.0, "end": 44.0}] and len(chamadas) == 3)
    saiu, pormenor, chamadas = rodar({"request_id": "r"},
                                     urllib.error.HTTPError(URL, 404, "sumiu", None, None),
                                     pronto([{"start": 8.0, "end": 44.0}]))
    check("6f. 4xx no poll encerra na hora (nao insiste)",
          saiu == [] and len(chamadas) == 2)
    teto = muapi.POLL_MAX_SEC
    muapi.POLL_MAX_SEC = 0.0
    try:
        saiu, pormenor, _ = rodar({"request_id": "r"}, {"status": "processing"})
        check("6g. poll sem fim para no teto e diz que nao respondeu",
              saiu == [] and "respondeu" in pormenor)
    finally:
        muapi.POLL_MAX_SEC = teto

    # ------------------------------------------------------ 7. fiacao no ytclip
    fala = ytclip.parse_json3(test_ytclip.json3(test_ytclip.falar(0.0, 100)))
    base = {"durationSec": 300.0, "chapters": [], "heatmap": [], "cues": fala}
    sem_chave = ytclip.candidates(base)
    check("7a. sem sinal nenhum o detector nao sugere nada (base limpa)", sem_chave == [])
    check("7b. chave AUSENTE nao muda nada", ytclip.candidates(dict(base)) == sem_chave)
    check("7c. lista VAZIA nao muda nada",
          ytclip.candidates(dict(base, muapiHighlights=[])) == sem_chave)
    check("7d. `None` na chave nao muda nada",
          ytclip.candidates(dict(base, muapiHighlights=None)) == sem_chave)
    com_chave = ytclip.candidates(dict(base, muapiHighlights=[{"start": 150.0, "end": 190.0}]))
    check("7e. a ancora de fora PRODUZ sugestao onde nao havia", len(com_chave) > 0)
    check("7f. o sinal fica registrado no candidato",
          all("muapi" in c["signals"] for c in com_chave))
    check("7g. o candidato explica de onde veio",
          all("detector externo" in c["reason"] for c in com_chave))
    check("7h. nao cita audiencia (o `interesse` continua 0.0, nao e popularidade)",
          all("heatmap" not in c["signals"] and "Mais reproduzidos" not in c["reason"]
              for c in com_chave))
    check("7i. o candidato sai no schema de sempre, como candidato",
          all({"inSec", "outSec", "score", "signals", "state"} <= set(c)
              and c["state"] == "candidate" for c in com_chave))
    sujeira = [None, "trecho", 42, {}, {"start": "abc"}, {"start": float("nan")},
               {"start": -3.0}, {"naoTem": 1}]
    check("7j. lixo na chave nao quebra nem inventa",
          ytclip.candidates(dict(base, muapiHighlights=sujeira)) == sem_chave)
    check("7k. `candidates_report` aceita a chave e continua devolvendo (lista, motivo)",
          isinstance(ytclip.candidates_report(
              dict(base, muapiHighlights=[{"start": 150.0, "end": 190.0}])), tuple))

    # ----------------------------------------------------- 8. ancora, nao borda
    check("8a. a borda sai da FALA, nunca do numero que veio de fora",
          all(c["boundary"] in ("fala", "palavra") for c in com_chave))
    check("8b. o trecho nao comeca no instante cru que a API mandou",
          any(abs(c["inSec"] - 150.0) > 1e-6 for c in com_chave))
    check("8c. sem legenda a ancora de fora NAO vira sugestao (nao ha borda para conferir)",
          ytclip.candidates({"durationSec": 300.0, "chapters": [], "heatmap": [], "cues": [],
                             "muapiHighlights": [{"start": 150.0, "end": 190.0}]}) == [])
    check("8d. a duracao continua saindo dos limites do projeto",
          all(ytclip.MIN_CLIP_SEC - 1e-6 <= c["durationSec"] <= ytclip.MAX_CLIP_SEC + 1e-6
              for c in com_chave))
    check("8e. o teto de sugestoes continua valendo com a ancora de fora",
          len(ytclip.candidates(dict(base, muapiHighlights=[
              {"start": float(30 + i * 10), "end": float(70 + i * 10)} for i in range(40)]),
              limit=3)) <= 3)

    # -------------------------------------------------------- 9. rotulo na tela
    with open(os.path.join(REPO, "video-ops.js"), "r", encoding="utf-8") as fh:
        js = fh.read()
    check("9a. o `video-ops.js` nomeia o sinal novo (senao a tela mostra 'muapi' cru)",
          "muapi:" in js.split("SIGNAL_LABEL")[1][:300])

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
