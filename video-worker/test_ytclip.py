# -*- coding: utf-8 -*-
"""Provas da descoberta de cortes. Nenhuma rede, nenhum conteúdo de terceiro.

Toda a lógica que decide ONDE cortar é pura, então prova-se com fixture sintética. O que
depende de rede (`probe`, `fetch_section`) não é exercitado aqui de propósito: teste que
chama o YouTube falha por motivo alheio ao código e ensina o operador a ignorar falha.

O que este script prova (e falha alto se não for verdade):
   1. id do vídeo           -> aceita watch/youtu.be/shorts/live, recusa host alheio e lixo
   2. json3                 -> vira cues ordenados, sem vazio e sem a repetição da automática
   3. heatmap               -> sem baldes suficientes não inventa pico; com pico, mede razão
   4. janela                -> começa em fronteira de fala e respeita o mínimo e o teto
   5. candidatos            -> saem no schema do clip, com state 'candidate'
   6. sem heatmap           -> nenhuma sugestão cita audiência (não inventar dado)
   7. dois sinais no mesmo ponto -> fundem num candidato só, com os dois registrados
   8. degenerado            -> info vazia ou sem legenda não quebra
  10. classificação         -> cada um dos 13 léxicos acerta uma frase real de podcast BR
  11. auto-suficiência      -> corte foge de abrir em conector solto; se não dá, avisa
  12. duração               -> vem da ideia (pausa/troca de assunto), não de um cronômetro
  13. nota                  -> momento forte (fracasso, dinheiro, conselho…) pesa na nota
  14. mais reproduzidos    -> normaliza o grafico, acha regiao de pico e nunca inventa dado

Uso:
    py -3.12 video-worker\\test_ytclip.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import captions  # noqa: E402
import ytclip  # noqa: E402
import worker  # noqa: E402

CHECKS = []


def check(label, ok):
    CHECKS.append((label, bool(ok)))


def raises(fn, *args):
    try:
        fn(*args)
    except worker.WorkerError:
        return True
    except Exception:
        return False
    return False


def json3(rows):
    """rows = [(inicio_seg, duracao_seg, texto)] -> json3 igual ao que o YouTube devolve."""
    return json.dumps({"events": [
        {"tStartMs": int(s * 1000), "dDurationMs": int(d * 1000), "segs": [{"utf8": t}]}
        for s, d, t in rows]})


def falar(inicio, quantidade, passo=3.0, texto="Fala continua de teste."):
    return [(inicio + i * passo, passo, texto) for i in range(quantidade)]


def main():
    # ------------------------------------------------------------------ 1. id
    check("1a. watch?v=", ytclip.video_id("https://www.youtube.com/watch?v=aircAruvnKk") == "aircAruvnKk")
    check("1b. youtu.be", ytclip.video_id("https://youtu.be/aircAruvnKk?t=30") == "aircAruvnKk")
    check("1c. shorts", ytclip.video_id("https://www.youtube.com/shorts/aircAruvnKk") == "aircAruvnKk")
    check("1d. live", ytclip.video_id("https://www.youtube.com/live/aircAruvnKk") == "aircAruvnKk")
    check("1e. host alheio recusado", raises(ytclip.video_id, "https://vimeo.com/watch?v=aircAruvnKk"))
    check("1f. sem id recusado", raises(ytclip.video_id, "https://www.youtube.com/watch?v=curto"))
    check("1g. vazio recusado", raises(ytclip.video_id, ""))
    check("1h. esquema de arquivo recusado", raises(ytclip.video_id, "file:///c:/x.mp4"))

    # -------------------------------------------------------------- 2. json3
    cues = ytclip.parse_json3(json3([
        (0.0, 2.0, "Primeira fala."), (0.0, 2.0, "Primeira fala."),
        (5.0, 2.0, ""), (2.5, 2.0, "Segunda fala."),
    ]))
    check("2a. vazio descartado", all(c["text"] for c in cues))
    check("2b. repeticao da automatica fundida", len(cues) == 2)
    check("2c. ordenado por tempo", [c["start"] for c in cues] == sorted(c["start"] for c in cues))
    check("2d. fim = inicio + duracao", abs(cues[0]["end"] - 2.0) < 1e-6)
    check("2e. json invalido recusado", raises(ytclip.parse_json3, "nao eh json {["))
    check("2f. sem eventos devolve lista vazia", ytclip.parse_json3('{"events":[]}') == [])

    # ------------------------------------------------------------ 3. heatmap
    check("3a. poucos baldes nao viram pico", ytclip.heatmap_peaks(
        [{"start_time": i, "end_time": i + 1, "value": 1.0} for i in range(4)]) == [])
    check("3b. heatmap ausente nao vira pico", ytclip.heatmap_peaks(None) == [])
    plano = [{"start_time": i * 10.0, "end_time": i * 10.0 + 10.0, "value": 0.1}
             for i in range(20)]
    plano[7]["value"] = 0.9
    plano[8]["value"] = 0.85
    picos = ytclip.heatmap_peaks(plano)
    check("3c. acha o pico", len(picos) == 1 and abs(picos[0]["start"] - 70.0) < 1e-6)
    check("3d. funde balde vizinho", bool(picos) and abs(picos[0]["end"] - 90.0) < 1e-6)
    check("3e. razao contra o topo do video", bool(picos) and abs(picos[0]["ratio"] - 1.0) < 1e-6)
    check("3f. tudo igual nao gera pico", ytclip.heatmap_peaks(
        [{"start_time": i * 5.0, "end_time": i * 5.0 + 5.0, "value": 0.5} for i in range(30)]) == [])

    # -------------------------------------------------------------- 4. janela
    fala = ytclip.parse_json3(json3(
        [(0.0, 3.0, "Abertura sem ponto"), (3.0, 3.0, "continuando a ideia."),
         (6.0, 3.0, "Aqui comeca outra coisa")] + falar(9.0, 30)))
    inicio, fim, texto = ytclip._window(fala, 4.0, 200.0)
    check("4a. recua ate o comeco da frase", abs(inicio - 0.0) < 1e-6)
    check("4b. respeita o minimo", fim - inicio >= ytclip.MIN_CLIP_SEC - 1e-6)
    check("4c. respeita o teto", fim - inicio <= ytclip.MAX_CLIP_SEC + 1e-6)
    check("4d. comeca numa fronteira de fala", any(abs(c["start"] - inicio) < 1e-6 for c in fala))
    check("4e. devolve o texto do trecho", "Abertura" in texto)
    vazio_in, vazio_out, _ = ytclip._window([], 50.0, 600.0)
    check("4f. sem legenda ainda produz janela", vazio_out > vazio_in)
    check("4g. janela nao passa da duracao do video",
          ytclip._window(fala, 190.0, 200.0)[1] <= 200.0 + 1e-6)

    # ----------------------------------------------------------- 5. candidatos
    info = {
        "durationSec": 300.0,
        "chapters": [{"start_time": 100.0, "title": "O erro mais comum"}],
        "heatmap": plano,
        "cues": ytclip.parse_json3(json3(falar(0.0, 100))),
    }
    lista = ytclip.candidates(info)
    campos = {"inSec", "outSec", "durationSec", "score", "signals", "topic", "hook",
              "reason", "state"}
    check("5a. produziu candidatos", len(lista) > 0)
    check("5b. schema do clip completo", all(campos <= set(c) for c in lista))
    check("5c. nasce como candidato", all(c["state"] == "candidate" for c in lista))
    check("5d. fim depois do inicio", all(c["outSec"] > c["inSec"] for c in lista))
    check("5e. duracao dentro dos limites", all(
        ytclip.MIN_CLIP_SEC - 1e-6 <= c["durationSec"] <= ytclip.MAX_CLIP_SEC + 1e-6 for c in lista))
    check("5f. nota de 0 a 100", all(0 <= c["score"] <= 100 for c in lista))
    check("5g. todo candidato explica o motivo", all(c["reason"].strip() for c in lista))
    check("5h. ordenado por nota", [c["score"] for c in lista] == sorted(
        (c["score"] for c in lista), reverse=True))
    check("5i. nenhum passa do fim do video", all(c["outSec"] <= 300.0 + 1e-6 for c in lista))
    check("5j. respeita o teto de sugestoes", len(ytclip.candidates(info, limit=3)) <= 3)
    check("5k. capitulo virou assunto", any("erro mais comum" in c["topic"] for c in lista))

    # ------------------------------------------------- 6. honestidade do sinal
    lista2 = ytclip.candidates(dict(info, heatmap=[]))
    check("6a. sem heatmap ninguem cita audiencia",
          all("heatmap" not in c["signals"] for c in lista2))
    check("6b. sem heatmap ninguem cita 'Mais reproduzidos'",
          all("Mais reproduzidos" not in c["reason"] for c in lista2))
    check("6c. sem heatmap ainda sugere pelo resto", len(lista2) > 0)
    check("6d. com heatmap alguem cita audiencia",
          any("heatmap" in c["signals"] for c in lista))

    # --------------------------------------------------------- 7. fusao de sinal
    junto = {
        "durationSec": 300.0,
        "chapters": [{"start_time": 70.0, "title": "Ponto quente"}],
        "heatmap": plano,
        "cues": ytclip.parse_json3(json3(falar(0.0, 100))),
    }
    fundido = [c for c in ytclip.candidates(junto) if len(c["signals"]) > 1]
    check("7a. capitulo e heatmap no mesmo ponto viram um candidato so", len(fundido) >= 1)
    check("7b. os dois sinais ficam registrados", bool(fundido) and
          {"heatmap", "chapter"} <= set(fundido[0]["signals"]))
    check("7c. concordancia aumenta a nota", bool(fundido) and fundido[0]["score"] > 45)

    # ------------------------------------------------------------- 8. degenerado
    check("8a. sem legenda e sem sinal devolve lista",
          isinstance(ytclip.candidates({"durationSec": 60.0}), list))
    check("8b. info vazia nao quebra", ytclip.candidates({}) == [])

    # ------------------------------------------------- 9. legenda do trecho
    fonte = [{"start": 0.0, "end": 5.0, "text": "Antes do corte."},
             {"start": 98.0, "end": 102.0, "text": "Entrando no corte."},
             {"start": 105.0, "end": 108.0, "text": "Bem no meio."},
             {"start": 118.0, "end": 125.0, "text": "Saindo do corte."},
             {"start": 130.0, "end": 133.0, "text": "Depois do corte."},
             {"start": 110.0, "end": 110.02, "text": "Piscada."},
             {"start": 112.0, "end": 114.0, "text": "   "}]
    faixa = ytclip.cues_for_range(fonte, 100.0, 120.0)
    textos = [c["text"] for c in faixa]
    check("9a. descarta fala antes do corte", "Antes do corte." not in textos)
    check("9b. descarta fala depois do corte", "Depois do corte." not in textos)
    check("9c. mantem fala de dentro", "Bem no meio." in textos)
    check("9d. relogio zera no comeco do corte", faixa[0]["start"] == 0.0)
    check("9e. fala que entra pela borda e aparada",
          abs(faixa[0]["end"] - 2.0) < 1e-6)
    check("9f. fala que sai pela borda e aparada",
          abs(faixa[-1]["end"] - 20.0) < 1e-6)
    check("9g. nenhuma fala passa da duracao do trecho",
          all(0 <= c["start"] < c["end"] <= 20.0 + 1e-6 for c in faixa))
    check("9h. fala de duracao zero descartada", "Piscada." not in textos)
    check("9i. fala so com espaco descartada", all(c["text"].strip() for c in faixa))
    check("9j. sem legenda devolve lista vazia", ytclip.cues_for_range([], 0.0, 30.0) == [])
    check("9k. None nao quebra", ytclip.cues_for_range(None, 0.0, 30.0) == [])
    # Legenda ROLANTE do YouTube: a fala de agora continua no ar quando a proxima comeca.
    # Os dois renderizadores 9:16 bebem desta funcao, entao a garantia mora aqui.
    rolante = ytclip.cues_for_range(
        [{"start": 110.0, "end": 114.0, "text": "Finalmente saiu o escritorio"},
         {"start": 113.25, "end": 117.0, "text": "e a gente comecou a faturar"}], 100.0, 120.0)
    check("9l. as duas falas rolantes sobrevivem", len(rolante) == 2)
    check("9m. a anterior termina quando a proxima comeca (13.25 no relogio do corte)",
          rolante[0]["end"] == 13.25 and rolante[0]["end"] <= rolante[1]["start"])
    fora_de_ordem = ytclip.cues_for_range(
        [{"start": 118.0, "end": 119.0, "text": "depois"},
         {"start": 101.0, "end": 102.0, "text": "antes"}], 100.0, 120.0)
    check("9n. a saida sai ordenada por comeco, mesmo com a entrada fora de ordem",
          [c["text"] for c in fora_de_ordem] == ["antes", "depois"])

    # ------------------------------------------------- 10. classificação do assunto
    # Uma frase representativa por categoria — se um léxico estiver vazio ou com termo que
    # ninguém fala, a categoria não aparece e a verificação cai aqui, não em produção.
    frases = [
        ("business", "A gente montou a empresa pensando no modelo de negócio e no mercado."),
        ("mindset", "Foi mentalidade: eu saí da zona de conforto e passei a pensar grande."),
        ("money", "O faturamento subiu, mas a margem de lucro caiu e o caixa apertou."),
        ("career", "Larguei o emprego CLT depois de uma entrevista que virou promoção e salário."),
        ("leadership", "Liderar um time grande é sobre delegar e cuidar da cultura da empresa."),
        ("discipline", "Disciplina é acordar cedo todo dia e manter a rotina."),
        ("experience", "Quando eu comecei, na minha época, aconteceu comigo algo que eu lembro."),
        ("failure", "Eu errei feio, quebrei a operação e aprendi da pior forma que deu errado."),
        ("success", "Deu certo: dobrei o resultado e bati a meta que eu queria."),
        ("advice", "Se eu fosse você, comece por uma coisa só; meu conselho é evite atalho."),
        ("life_lesson", "A lição que ficou: hoje eu sei que com o tempo eu aprendi a esperar."),
        ("strong_opinion", "Na minha opinião, a verdade é que ninguém fala e todo mundo erra."),
        ("reflection", "Olhando pra trás, fico pensando no que importa de verdade."),
    ]
    for slug, frase in frases:
        achado = ytclip.classify_segment(frase)
        check("10-%s. classifica a frase representativa" % slug, achado["category"] == slug)
    check("10a. todas as 13 categorias têm rótulo em português",
          set(ytclip.CATEGORY_LEXICON) == set(ytclip.CATEGORY_LABELS) and
          len(ytclip.CATEGORY_LEXICON) == 13)
    check("10b. sem termo conhecido nao chuta categoria",
          ytclip.classify_segment("bom dia pessoal tudo certo por aqui") ==
          {"category": "", "confidence": 0, "matched": []})
    check("10c. texto vazio nao quebra", ytclip.classify_segment("")["category"] == "")
    check("10d. tolera falta de acento (legenda automatica)",
          ytclip.classify_segment("na minha opiniao a verdade e essa")["category"] == "strong_opinion")
    check("10e. tolera caixa alta", ytclip.classify_segment("O FATURAMENTO E O LUCRO")["category"] == "money")
    check("10f. frase de duas palavras casa como frase",
          "se eu fosse você" in ytclip.classify_segment("se eu fosse você eu faria diferente")["matched"])
    check("10g. palavra solta nao casa por pedaco",
          ytclip.classify_segment("erroneamente calculado")["category"] == "")
    check("10h. mais termos, mais confianca",
          ytclip.classify_segment("errei e quebrei tudo, deu errado")["confidence"] >
          ytclip.classify_segment("foi um erro")["confidence"])
    check("10i. confianca de 0 a 100",
          all(0 <= ytclip.classify_segment(f)["confidence"] <= 100 for _, f in frases))

    # ------------------------------------- 11. corte que se sustenta sozinho
    check("11a. detecta abertura pendurada", ytclip._dangling_opener("Mas isso mudou tudo.") == "mas")
    check("11b. detecta abertura pendurada com acento", ytclip._dangling_opener("Então eu parei.") == "então")
    check("11c. abertura limpa nao vira aviso", ytclip._dangling_opener("A verdade é simples.") == "")
    check("11d. palavra que so comeca com o conector nao conta",
          ytclip._dangling_opener("Essencialmente foi isso.") == "")
    pendurado = ytclip.parse_json3(json3(
        [(0.0, 3.0, "A margem estava negativa naquele mes."),
         (3.0, 3.0, "Mas ninguem tinha percebido ainda"),
         (6.0, 3.0, "e o caixa foi secando devagar.")] + falar(9.0, 30)))
    check("11e. recua para fugir da abertura pendurada",
          abs(ytclip._window(pendurado, 4.0, 200.0)[0] - 0.0) < 1e-6)
    preso = ytclip.parse_json3(json3(
        [(0.0, 3.0, "Fala antiga la atras."), (40.0, 3.0, "Mas isso mudou tudo depois.")]
        + falar(43.0, 30)))
    check("11f. sem para onde recuar, mantem o inicio",
          abs(ytclip._window(preso, 41.0, 200.0)[0] - 40.0) < 1e-6)
    avisados = ytclip.candidates({"durationSec": 200.0, "heatmap": [], "cues": preso,
                                  "chapters": [{"start_time": 41.0, "title": "Virada"}]})
    check("11g. candidato pendurado avisa o operador em portugues",
          bool(avisados) and "mas" in avisados[0]["contextWarning"].lower())
    check("11h. corte com abertura limpa NAO recebe aviso",
          bool(lista) and all(c["contextWarning"] == "" for c in lista))

    # ------------------------------------- 12. duração vem da ideia, não do cronômetro
    curta = ytclip.parse_json3(json3(
        [(0.0, 2.5, "Meu primeiro produto custou caro demais"),
         (2.5, 2.5, "e eu nao sabia calcular nada"),
         (5.0, 2.5, "testei preco por preco durante meses"),
         (7.5, 2.5, "ate entender que a conta estava errada"),
         (10.0, 2.5, "o fornecedor cobrava frete escondido"),
         (12.5, 2.5, "e isso comia tudo no fim do mes"),
         # Ponto final SEM pausa depois: é respiração no meio do raciocínio, não fecho.
         (15.0, 2.5, "ai eu troquei de fornecedor."),
         (17.5, 2.5, "o negocio mudou de patamar"),
         (20.0, 2.5, "hoje eu confiro tudo antes de anunciar"),
         (22.5, 2.5, "essa foi a virada.")]
        # pausa de 1,5 s: a ideia acabou aqui, o resto é outro assunto.
        + [(26.5 + i * 2.5, 2.5, "assunto completamente diferente agora") for i in range(30)]))
    longa = ytclip.parse_json3(json3(
        [(i * 2.5, 2.5, "a historia continua sem pausa nenhuma.") for i in range(40)]))
    dur_curta = ytclip._window(curta, 1.0, 300.0)[1] - ytclip._window(curta, 1.0, 300.0)[0]
    dur_longa = ytclip._window(longa, 1.0, 300.0)[1] - ytclip._window(longa, 1.0, 300.0)[0]
    check("12a. ideia curta fecha na pausa (~25s)", abs(dur_curta - 25.0) < 1e-6)
    check("12b. historia sem pausa corre ate o teto suave (~70s)", dur_longa >= 65.0)
    check("12c. duracoes materialmente diferentes", dur_longa - dur_curta >= 20.0)
    check("12d. nenhuma das duas grudou no alvo antigo de 45s",
          abs(dur_curta - ytclip.TARGET_CLIP_SEC) > 5.0 and
          abs(dur_longa - ytclip.TARGET_CLIP_SEC) > 5.0)
    check("12e. as duas respeitam o minimo e o teto",
          all(ytclip.MIN_CLIP_SEC - 1e-6 <= d <= ytclip.MAX_CLIP_SEC + 1e-6
              for d in (dur_curta, dur_longa)))
    troca = ytclip._window(longa, 1.0, 300.0, (40.0,))
    check("12f. troca de assunto fecha antes do teto suave",
          abs((troca[1] - troca[0]) - 40.0) < 1e-6)

    # --------------------------------------- 13. nota reflete momento forte
    neutro = {"durationSec": 300.0, "heatmap": [],
              "chapters": [{"start_time": 30.0, "title": "Parte dois"}],
              "cues": ytclip.parse_json3(json3(falar(0.0, 60)))}
    forte = dict(neutro, cues=ytclip.parse_json3(json3(
        [(i * 3.0, 3.0, "eu errei feio e quebrei a empresa, aprendi da pior forma.")
         for i in range(60)])))
    lista_n = ytclip.candidates(neutro)
    lista_f = ytclip.candidates(forte)
    check("13a. categoria forte levanta a nota", bool(lista_n) and bool(lista_f) and
          lista_f[0]["score"] > lista_n[0]["score"])
    check("13b. classificou como fracasso", bool(lista_f) and lista_f[0]["category"] == "failure")
    check("13c. o motivo mostra o assunto em portugues",
          bool(lista_f) and "Fracasso" in lista_f[0]["reason"])
    check("13d. sem termo conhecido a categoria fica vazia",
          bool(lista_n) and lista_n[0]["category"] == "")
    check("13e. nota continua de 0 a 100", all(0 <= c["score"] <= 100 for c in lista_f + lista_n))
    check("13f. category entrou sem derrubar o schema antigo",
          all(campos <= set(c) and {"category", "contextWarning"} <= set(c) for c in lista_f))
    # Honestidade do sinal: sem heatmap, NADA pode cheirar a audiência — nem no assunto
    # classificado, nem no aviso de contexto.
    citacao = ("audi", "reproduz", "pico", "views", "visualiza")
    check("13g. sem heatmap nenhum texto do candidato cita audiencia",
          all(not any(t in (c["reason"] + c["topic"] + c["contextWarning"]).lower()
                      for t in citacao) for c in lista2 + lista_f + lista_n + avisados))
    check("13h. sem heatmap nenhum candidato traz o sinal de audiencia",
          all("heatmap" not in c["signals"] for c in lista_f + lista_n + avisados))

    # ------------------------------------------------- 14. mais reproduzidos
    # Gráfico sintético de 100 baldes (5s cada) com DOIS momentos fortes: 200-215s e
    # 350-360s. Sintético de propósito — teste que chama o YouTube falha por motivo alheio
    # ao código e ensina o operador a ignorar falha.
    grafico = []
    for i in range(100):
        valor = 0.2
        if i in (40, 41, 42):
            valor = (0.9, 1.0, 0.95)[i - 40]
        elif i in (70, 71):
            valor = (0.8, 0.85)[i - 70]
        grafico.append({"start_time": i * 5.0, "end_time": i * 5.0 + 5.0, "value": valor})

    mr = ytclip.most_replayed(grafico)
    vazio = ytclip.most_replayed([])
    chato = ytclip.most_replayed([{"start_time": i * 5.0, "end_time": i * 5.0 + 5.0,
                                   "value": 0.5} for i in range(100)])
    sujo = ytclip.most_replayed([
        {"start_time": None, "value": 0.9}, {"start_time": 5.0, "value": None},
        "nao e dict", {"start_time": "x", "value": "y"}])

    check("14a. sem grafico o campo sai indisponivel, nao inventado",
          vazio == {"available": False, "source": "youtube_heatmap", "points": [], "peaks": []})
    check("14b. heatmap None nao quebra", ytclip.most_replayed(None)["available"] is False)
    check("14c. balde invalido e descartado sem quebrar",
          sujo["available"] is False and sujo["points"] == [])
    check("14d. grafico chato nao vira destaque", chato["available"] is False)
    check("14e. com pico o campo fica disponivel", mr["available"] is True)
    check("14f. a fonte e declarada", mr["source"] == "youtube_heatmap")
    check("14g. guarda os 100 baldes como evidencia", len(mr["points"]) == 100)
    check("14h. valor sai normalizado de 0 a 1", all(0.0 <= p["value"] <= 1.0
                                                     for p in mr["points"]))
    check("14i. o topo do proprio video vale 1.0", max(p["value"] for p in mr["points"]) == 1.0)
    check("14j. achou os dois momentos, nao dezenas iguais", len(mr["peaks"]) == 2)
    check("14k. rank comeca em 1 e nao pula", [p["rank"] for p in mr["peaks"]] == [1, 2])
    check("14l. o mais reproduzido vem primeiro",
          mr["peaks"][0]["peakValue"] > mr["peaks"][1]["peakValue"])
    check("14m. o pico do primeiro caiu na regiao 200-215s",
          mr["peaks"][0]["start"] == 200.0 and mr["peaks"][0]["end"] == 215.0)
    check("14n. peakTime cai dentro da propria regiao",
          all(p["start"] <= p["peakTime"] <= p["end"] for p in mr["peaks"]))
    check("14o. a media da regiao nunca passa do pico dela",
          all(p["averageValue"] <= p["peakValue"] for p in mr["peaks"]))
    check("14p. tempo em segundos (numero), nunca timestamp formatado",
          all(isinstance(p[k], float) for p in mr["peaks"]
              for k in ("start", "end", "peakTime")))
    # Os limiares sao configuraveis porque o pedido exige afinar sem cacar numero solto.
    check("14q. maxPeaks corta a lista",
          len(ytclip.most_replayed(grafico, {"maxPeaks": 1})["peaks"]) == 1)
    check("14r. minPeakValue descarta o pico mais fraco",
          len(ytclip.most_replayed(grafico, {"minPeakValue": 0.9})["peaks"]) == 1)
    check("14s. minGapSec funde momento vizinho num so",
          len(ytclip.most_replayed(grafico, {"minGapSec": 400.0})["peaks"]) == 1)
    check("14t. minBuckets ainda exige grafico de verdade",
          ytclip.most_replayed(grafico[:5])["available"] is False)
    # Compatibilidade: o detector mudou de arquivo, o nome antigo NAO mudou de comportamento.
    check("14u. heatmap_peaks continua exportado pelo ytclip",
          len(ytclip.heatmap_peaks(grafico)) == 2)
    check("14v. o pico do detector antigo casa com o do campo novo",
          ytclip.heatmap_peaks(grafico)[0]["ratio"] == mr["peaks"][0]["peakValue"])

    # ------------------------------------- 15: escolha da faixa de legenda (pick + fetch)
    def faixa(lang, ext="json3"):
        return {lang: [{"ext": ext, "url": "https://exemplo/" + lang}]}

    # IDIOMA manda sobre a origem. Antes o laco externo era a fonte, e uma legenda MANUAL
    # em espanhol vencia uma AUTOMATICA em pt-BR -- o corte saia legendado em espanhol.
    check("15a. pt automatico ganha de espanhol manual",
          ytclip.pick_caption_track({"subtitles": faixa("es"),
                                     "automatic_captions": faixa("pt")})[1] == "pt")
    check("15b. e a origem escolhida e reportada",
          ytclip.pick_caption_track({"subtitles": faixa("es"),
                                     "automatic_captions": faixa("pt")})[2] == "automatica")
    # Dentro do MESMO idioma, humano continua ganhando da automatica.
    check("15c. no mesmo idioma, manual ganha da automatica",
          ytclip.pick_caption_track({"subtitles": faixa("pt"),
                                     "automatic_captions": faixa("pt")})[2] == "manual")
    check("15d. a ordem de CAPTION_LANGS e respeitada",
          ytclip.pick_caption_track({"subtitles": {}, "automatic_captions":
                                     dict(faixa("en"), **faixa("pt"))})[1] == "pt")
    check("15e. so json3 conta (nao ha parser de vtt/srt aqui)",
          ytclip.pick_caption_track({"subtitles": faixa("pt", "vtt")}) == (None, "", ""))
    check("15f. idioma fora da lista e ignorado",
          ytclip.pick_caption_track({"subtitles": faixa("de")}) == (None, "", ""))
    check("15g. sem tabela nenhuma nao levanta",
          ytclip.pick_caption_track({}) == (None, "", ""))

    # fetch_cues: ausencia e falha sao motivos DIFERENTES, e nenhum dos dois levanta.
    sem = ytclip.fetch_cues({})
    check("15h. sem faixa -> CAPTIONS_NOT_AVAILABLE",
          sem["reason"] == ytclip.CAPTIONS_NONE and sem["available"] is False)
    check("15i. e a ausencia vem explicada por escrito", bool(sem["note"]))
    ruim = ytclip.fetch_cues({"subtitles": {"pt": [{"ext": "json3",
                                                    "url": "http://127.0.0.1:1/nada"}]}})
    check("15j. falha de rede -> CAPTIONS_EXTRACTION_FAILED",
          ruim["reason"] == ytclip.CAPTIONS_FAILED)
    check("15k. e a falha NAO levanta (o video segue para os cortes)",
          ruim["cues"] == [] and ruim["available"] is False)

    # ------------------------------- 16: miniatura ao lado do trecho (fundo do 9:16)
    # Nada de rede aqui: as duas funcoes olham disco, e e exatamente onde o defeito mora.
    import shutil as _shutil
    import tempfile
    pasta = tempfile.mkdtemp(prefix="ytclip-thumb-")
    try:
        def toca(nome, conteudo=b"x"):
            with open(os.path.join(pasta, nome), "wb") as fh:
                fh.write(conteudo)

        # O defeito medido: `.jpg` ordena ANTES de `.mp4`, entao o seletor alfabetico
        # antigo entregava a IMAGEM ao validate_input e o download inteiro morria.
        stem = "abc12345678-425-515"
        toca(stem + ".jpg")
        toca(stem + ".mp4")
        check("16a. o video escolhido e o .mp4, nao a miniatura que ordena antes",
              ytclip.produced_media(pasta, stem).endswith(".mp4"))
        check("16b. a miniatura e encontrada pelo stem e devolvida como NOME",
              ytclip.thumbnail_beside(pasta, stem + ".mp4") == stem + ".jpg")

        # Fragmento e sobra de download tambem ordenam na frente do arquivo final.
        stem2 = "def12345678-10-20"
        toca(stem2 + ".f616.mp4")
        toca(stem2 + ".part")
        toca(stem2 + ".webm")
        check("16c. fragmento e .part sao ignorados",
              ytclip.produced_media(pasta, stem2).endswith(".webm"))

        # Miniatura vazia (download interrompido) nao pode sombrear uma legivel: o laco
        # continua em vez de devolver "" no primeiro candidato ruim.
        stem3 = "ghi12345678-0-5"
        toca(stem3 + ".mp4")
        toca(stem3 + ".webp", b"")
        toca(stem3 + ".jpg")
        check("16d. miniatura de 0 byte e pulada, a legivel seguinte vence",
              ytclip.thumbnail_beside(pasta, stem3 + ".mp4") == stem3 + ".jpg")
        check("16e. sem miniatura nenhuma devolve vazio, nao levanta",
              ytclip.thumbnail_beside(pasta, "zzz99999999-1-2.mp4") == "")
        check("16f. nome vazio nao vira busca pela pasta toda",
              ytclip.thumbnail_beside(pasta, "") == "")
        # Devolve NOME, nunca caminho: e o que o staticFile() do Remotion espera, e o que
        # impede caminho de disco de vazar nos props.
        check("16g. nunca devolve caminho de disco",
              os.sep not in ytclip.thumbnail_beside(pasta, stem + ".mp4"))

        # O comando REAL, sem rede: o _run e trocado por um gravador. Asserir o texto do
        # arquivo nao serve aqui — as flags proibidas aparecem nos comentarios que dizem
        # que elas sao proibidas, e o check passaria a reprovar a propria documentacao.
        # Lista, nao dict com setdefault: `len(capturado) == 1` num dict alimentado por
        # setdefault e VACUO — setdefault nunca cria chave nova, entao passava com 1, 2 ou
        # 50 chamadas. Provado numa revisao adversarial, inserindo um segundo _run de
        # verdade (exatamente o segundo pipeline que o pedido proibiu).
        chamadas = []
        original = ytclip._run
        try:
            ytclip._run = lambda args, timeout: chamadas.append(list(args))
            try:
                ytclip.fetch_section("https://www.youtube.com/watch?v=abc12345678",
                                     0.0, 5.0, pasta)
            except Exception:
                pass   # morre depois do comando, ao nao achar arquivo: o argv ja foi gravado
        finally:
            ytclip._run = original
        argv = chamadas[0] if chamadas else []
        check("16h. a miniatura vem do MESMO comando yt-dlp que ja baixa o trecho",
              "--write-thumbnail" in argv)
        check("16i. um comando so: nao ha segunda chamada ao yt-dlp para a miniatura",
              len(chamadas) == 1)
        check("16j. nenhuma flag proibida entrou com a miniatura",
              not any(a.startswith(("--exec", "--netrc", "--cookies")) or "aria2c" in a
                      or a.startswith("--convert-thumbnails") for a in argv))
        check("16k. o corte por faixa e o cliente fixado continuam no comando",
              "--download-sections" in argv and any("web_embedded" in a for a in argv))
    finally:
        _shutil.rmtree(pasta, ignore_errors=True)

    # ------------------------------- 17: tempo por PALAVRA (legenda de exibicao)
    # A legenda automatica do YouTube e uma JANELA ROLANTE: cada evento fica no ar enquanto o
    # seguinte ja comecou, e o `captions.normalize_cues` fecha um onde o outro comeca. O texto
    # do evento passa a aparecer pelo PASSO entre eventos (1,84 s medido) e a quebra de pagina
    # cai no limite arbitrario da janela do reconhecedor -- dai o relato "a legenda nao
    # completa os assuntos". O json3 traz o `tOffsetMs` de CADA palavra, e e com ele que a
    # linha e remontada, comecando na primeira palavra e acabando na ultima.
    #
    # A amostra e `fixtures/json3-rolante.json`: TEMPOS reais byte a byte de uma legenda
    # automatica pt de um podcast de 53 min, TEXTO sintetico (transcricao alheia nao e
    # versionada neste repositorio).
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "fixtures", "json3-rolante.json"), encoding="utf-8") as fh:
        AMOSTRA = fh.read()
    palavras = ytclip.parse_json3_words(AMOSTRA)
    grossas = ytclip.parse_json3(AMOSTRA)
    fim_amostra = max(c["end"] for c in grossas)
    check("17a. a amostra rende uma palavra por seg de texto (351 numa janela de 60 falas)",
          len(palavras) == 351)
    check("17b. toda palavra tem instante, texto e fim depois do inicio",
          all(p["end"] > p["start"] and p["text"].strip() for p in palavras))
    check("17c. a grade de palavras e monotonica e sem sobreposicao",
          all(palavras[i]["end"] <= palavras[i + 1]["start"] + 1e-9
              for i in range(len(palavras) - 1)))
    # Os eventos `aAppend` da rolagem (1702 no arquivo cru) carregam so "\n": nao sao fala e
    # nao podem virar palavra na tela.
    check("17d. o quebra-linha da rolagem nao virou palavra",
          not any("\n" in p["text"] for p in palavras))

    # Valor CONSTRUIDO: offset por palavra, palavra sem offset, evento sem segs e evento sem
    # tStartMs. Asserir texto do arquivo nao provaria nada disto.
    bruto = {"events": [
        {"tStartMs": 2000, "dDurationMs": 4000, "segs": [
            {"utf8": "eu"}, {"utf8": " perdi", "tOffsetMs": 300},
            {"utf8": " quarenta", "tOffsetMs": 900}]},
        {"tStartMs": 3800, "dDurationMs": 770, "segs": [{"utf8": "\n"}]},
        {"tStartMs": 4000, "dDurationMs": 3000, "segs": [{"utf8": "mil."}]},
        {"tStartMs": 5000, "dDurationMs": 1000, "segs": []},
        {"dDurationMs": 1000, "segs": [{"utf8": "sem relogio"}]},
    ]}
    construido = ytclip.parse_json3_words(json.dumps(bruto))
    check("17e. tOffsetMs soma ao tStartMs (2000+300 = 2,3 s)",
          [p["text"] for p in construido] == ["eu", "perdi", "quarenta", "mil."]
          and abs(construido[1]["start"] - 2.3) < 1e-9)
    check("17f. palavra SEM tOffsetMs herda o inicio do evento",
          abs(construido[0]["start"] - 2.0) < 1e-9
          and abs(construido[3]["start"] - 4.0) < 1e-9)
    check("17g. evento sem seg util e evento sem tStartMs saem fora (nao inventa tempo)",
          all(p["text"] != "sem relogio" for p in construido))
    check("17h. o fim de cada palavra e o inicio da seguinte (a dDurationMs mente: a janela "
          "de 4 s do primeiro evento invade o segundo)",
          abs(construido[0]["end"] - 2.3) < 1e-9 and abs(construido[2]["end"] - 4.0) < 1e-9)
    check("17i. a ULTIMA palavra fica no ar o rabo de linha (PAUSA_LINHA_SEC), nao a janela",
          abs(construido[-1]["end"] - (4.0 + captions.PAUSA_LINHA_SEC)) < 1e-9)
    try:
        ytclip.parse_json3_words("{isso nao e json")
        check("17j. json ilegivel levanta WorkerError, como no parse_json3", False)
    except worker.WorkerError:
        check("17j. json ilegivel levanta WorkerError, como no parse_json3", True)

    # Legenda MANUAL vem em FRASE, sem tOffsetMs nenhum: cada evento vira UMA "palavra" com a
    # frase inteira, e o resultado degrada para a cue grossa de sempre -- nada de picar frase
    # alheia em pedaco de 25 caracteres so porque a funcao nova existe.
    manual = ytclip.parse_json3_words(json.dumps({"events": [
        {"tStartMs": 1000, "dDurationMs": 2500, "segs": [{"utf8": "Eu perdi quarenta mil."}]},
        {"tStartMs": 4000, "dDurationMs": 2000, "segs": [{"utf8": "No primeiro ano."}]}]}))
    check("17k. legenda manual (sem offset) rende uma 'palavra' por frase",
          [p["text"] for p in manual] == ["Eu perdi quarenta mil.", "No primeiro ano."])
    linhas_manual = ytclip.cues_for_range(
        [{"start": 1.0, "end": 3.5, "text": "Eu perdi quarenta mil."},
         {"start": 4.0, "end": 6.0, "text": "No primeiro ano."}], 0.0, 10.0, manual)
    check("17l. e a frase manual chega inteira ao clipe",
          [c["text"] for c in linhas_manual] == ["Eu perdi quarenta mil.", "No primeiro ano."])

    # RESTRICAO do pedido: a grade GROSSA nao muda, porque o `candidates()` mede a pausa ENTRE
    # FALAS nela para decidir onde o corte fecha. Prova comportamental, nao textual: com e sem
    # `words` no info, a recomendacao sai IDENTICA. Quem fiar palavra no detector reprova aqui.
    info_rec = {"durationSec": 400.0, "cues": grossas,
                "chapters": [{"start_time": 30.0, "title": "Dinheiro"}], "heatmap": []}
    check("17m. a RECOMENDACAO de cortes ignora o tempo por palavra (grade grossa intacta)",
          ytclip.candidates(info_rec) == ytclip.candidates(dict(info_rec, words=palavras)))

    # ------ o efeito na legenda do clipe, medido na amostra
    antes = captions.to_pages(ytclip.cues_for_range(grossas, 0.0, fim_amostra))
    depois = captions.to_pages(ytclip.cues_for_range(grossas, 0.0, fim_amostra, palavras))
    check("17n. sem `words` o caminho e o de sempre, item por item",
          ytclip.cues_for_range(grossas, 0.0, fim_amostra)
          == ytclip.cues_for_range(grossas, 0.0, fim_amostra, [])
          == ytclip.cues_for_range(grossas, 0.0, fim_amostra, None))
    check("17o. com `words` a saida MUDA (a fiacao existe de verdade)", antes != depois)
    check("17p. nenhuma pagina se sobrepoe a seguinte",
          all(depois[i]["end"] <= depois[i + 1]["start"] + 1e-9
              for i in range(len(depois) - 1)))
    check("17q. a linha ja cabe em 2 linhas de 25: o to_pages nao reparte de novo",
          len(depois) == len(ytclip.cues_for_range(grossas, 0.0, fim_amostra, palavras)))

    # O GANHO medido: pagina que mistura o fim de uma frase com o comeco da seguinte cai de
    # 43% para 0% -- e isto que o relato "a legenda nao completa os assuntos" descreve. O que
    # NAO melhora, e foi medido: a taxa de leitura (18,8 -> 17,8 char/s mediano), porque
    # ~18 char/s e a velocidade da FALA e nenhuma paginacao a reduz.
    def mistura(pags):
        return sum(1 for pg in pags
                   if any(ch in pg["text"].replace("\n", " ").strip()[:-1] for ch in ".!?"))

    # 61 paginas ate 2026-08-31, quando o `>>` passou a sair do texto (bloco 19): a pagina e
    # cortada por CARACTERE, entao tirar dois de cada troca de falante fez as 61 caberem em
    # 60. A mistura -- que e o que este check mede -- nao se moveu: 26 nas duas contagens.
    check("17r. antes, 26 das 60 paginas (43%) partiam a frase no meio",
          len(antes) == 60 and mistura(antes) == 26)
    check("17s. depois, nenhuma pagina mistura o fim de uma frase com o comeco da outra",
          mistura(depois) == 0)

    # Nenhum caractere de fala pode ficar pelo caminho: e o mesmo defeito que o
    # `normalize_cues` deixou de causar, agora no caminho por palavra.
    trecho = ytclip.cues_for_range(grossas, 20.0, 40.0, palavras)
    # A palavra que ATRAVESSA a borda do corte conta (o tempo dela e aparado, o texto nao),
    # que e a mesma regra da cue grossa.
    ditas = [p["text"] for p in palavras if p["start"] < 40.0 and p["end"] > 20.0]
    # O `strip_artifacts` do lado esperado nao afrouxa a prova: ele so declara que o `>>` do
    # reconhecedor NAO e fala e por isso nao conta como caractere perdido (bloco 19). Todo o
    # resto continua tendo de sair inteiro e na ordem -- apagar uma palavra de verdade
    # reprova aqui do mesmo jeito que reprovava antes.
    check("17t. o texto das palavras do trecho sai inteiro, na ordem (menos o marcador)",
          " ".join(c["text"] for c in trecho)
          == captions.strip_artifacts(" ".join(ditas)))

    # A ULTIMA palavra do corte e a que o intervalo parte no meio: ela sobra com quase nada de
    # duracao e o `cues_from_words` a poe no piso de leitura (`captions.PISO_LINHA_SEC`). Esse
    # piso tem de sobreviver ao round(3) DESTA funcao -- com o piso exatamente em MIN_CUE_SEC, a
    # palavra aparada em 12,201 -> 12,251 media 0.04999999999999893 depois de arredondada e a
    # regra 1 do `normalize_cues` DESCARTAVA a cue com o texto dentro. Defeito real, achado em
    # revisao. A pausa de 2,2 s esta aqui de proposito: palavra grudada na anterior entra na
    # linha dela, nao chega ao piso e nao exercitaria nada.
    borda = ytclip.cues_for_range([], 0.0, 12.251,
                                  [{"start": 10.0, "end": 10.4, "text": "quarenta"},
                                   {"start": 12.201, "end": 12.301, "text": "mil"}])
    check("17u. palavra partida pela borda do corte nao desaparece no arredondamento",
          [c["text"] for c in borda] == ["quarenta", "mil"]
          and all(c["end"] - c["start"] >= captions.MIN_CUE_SEC for c in borda))

    # E nao e sorte de um numero so: para CADA palavra da amostra, um corte que acaba 1 ms
    # depois de ela comecar ainda tem de trazer aquela palavra. Toda iteracao cai no piso
    # (1 ms < 0,05 s), que e exatamente o caso que nenhum check cobria -- o 17t usa UMA janela
    # fixa, cuja ultima linha dura 2,32 s e nunca chega la.
    perdidas = 0
    for palavra in palavras:
        recorte = ytclip.cues_for_range(grossas, max(0.0, palavra["start"] - 5.0),
                                        palavra["start"] + 0.001, palavras)
        dito = " ".join(c["text"] for c in recorte).split()
        if not dito or dito[-1] != palavra["text"].split()[-1]:
            perdidas += 1
    check("17v. nenhuma das 351 palavras se perde quando o corte acaba 1 ms depois de ela "
          "comecar (com o piso no limiar, 63 desapareciam)", perdidas == 0)

    # ---- 18: o tempo por PALAVRA atravessa a fronteira de cue de clipe (karaoke)
    # O `cues_for_range` e o unico ponto do projeto em que cue de clipe e produzida, e agora
    # cada linha leva as palavras dela JA rebaseadas. Quem consome e o Remotion
    # (`preset.activeWordIndex` -> `Clip.jsx`), que acende a palavra sendo dita. O ASS do
    # FFmpeg ignora a chave, e isso e provado aqui na amostra REAL (18h), nao so em valor
    # construido: portar o karaoke para o libass reprova de proposito.
    JANELA = 120.0                      # comeco NAO-zero, que e onde o rebase pode errar
    corte = ytclip.cues_for_range(grossas, JANELA, JANELA + 30.0, palavras)
    check("18a. o trecho rendeu linhas e todas trouxeram as palavras delas",
          len(corte) > 3 and all(isinstance(l.get("words"), list) and l["words"]
                                 for l in corte))
    check("18b. juntar as palavras da linha reproduz o texto dela, byte a byte",
          all(" ".join(w["text"] for w in l["words"]) == l["text"] for l in corte))
    # MEDIDO na amostra: 18 das 351 palavras (5,1%) trazem espaco DENTRO -- `>> fulano`
    # (troca de falante) e `[ ca ]` (censura do reconhecedor). O `preset.palavrasAlinhadas`
    # confere a JUNCAO, nao a contagem de tokens, justamente por isso: com contagem, essas 18
    # desalinhavam 16 das 66 linhas (24,2%) e um quarto da legenda voltava ao estatico.
    check("18c. palavra com espaco dentro existe na legenda REAL (a premissa do alinhamento "
          "por conteudo, e nao por contagem de tokens)",
          sum(1 for w in palavras if len(w["text"].split()) != 1) == 18)
    todas = ytclip.cues_for_range(grossas, 0.0, fim_amostra, palavras)
    check("18c2. e NENHUMA das 66 linhas da amostra perde o tempo por palavra por causa disso",
          len(todas) == 66
          and all(" ".join(w["text"] for w in l["words"]) == l["text"] for l in todas))
    check("18d. o relogio da palavra e o do CORTE: 0 <= t <= duracao, nada negativo",
          all(0.0 <= w["start"] <= 30.0 and 0.0 <= w["end"] <= 30.0 + 1e-9
              for l in corte for w in l["words"]))
    check("18e. a linha comeca na primeira palavra dela (o tempo nao veio de outra fonte)",
          all(abs(l["words"][0]["start"] - l["start"]) < 2e-3 for l in corte))
    # O rebase acontece UMA vez. Somando a janela de volta, cada palavra tem de cair no
    # instante ABSOLUTO em que o json3 a colocou -- subtrair duas vezes atrasaria a legenda
    # 120 s e nenhuma palavra acenderia; nao subtrair a adiantaria o mesmo tanto.
    absolutos = {round(w["start"], 3) for w in palavras}
    # A palavra que a borda do corte APARA comeca em 0 por construcao (`max(inicio, begin)`):
    # ela nao tem como bater com o instante original, e isso e o recorte funcionando.
    dentro = [w for l in corte for w in l["words"] if w["start"] > 0.0]
    fora = [w for w in dentro if round(w["start"] + JANELA, 3) not in absolutos]
    check("18f. o comeco do corte foi subtraido UMA vez (palavra + 120 s bate com o json3)",
          len(dentro) > 3 and not fora)
    check("18f2. subtrair duas vezes ou nao subtrair NAO passaria neste check",
          all(round(w["start"] + 2 * JANELA, 3) not in absolutos
              or round(w["start"], 3) not in absolutos for w in dentro))
    check("18g. sem `words` a linha nao ganha a chave (sidecar v2/v3 e legenda corrigida)",
          all("words" not in l
              for l in ytclip.cues_for_range(grossas, JANELA, JANELA + 30.0)))
    check("18h. o ASS da amostra REAL sai identico com e sem tempo por palavra "
          "(o libass nao ganhou animacao)",
          captions.to_ass(corte) == captions.to_ass(
              [{"start": l["start"], "end": l["end"], "text": l["text"]} for l in corte]))
    # A restricao central do pedido, repetida aqui com a chave `words` JA presente nas cues:
    # o detector nao pode ver palavra nenhuma.
    check("18i. a RECOMENDACAO continua identica com as cues carregando `words`",
          ytclip.candidates(info_rec)
          == ytclip.candidates(dict(info_rec, cues=[dict(c, words=[dict(c)]) for c in grossas])))

    # ---- 19. o marcador do reconhecedor nao atravessa a fronteira de cue de clipe -------
    # O `cues_for_range` e a fronteira UNICA: os dois renderizadores 9:16 (ASS do FFmpeg e
    # Sequence do Remotion) e o painel de revisao do Passo 3 bebem dela. Se o `>>` e o
    # `[ __ ]` morrem aqui, morrem para os tres -- e e por isso que a limpeza mora no
    # `captions.normalize_cues` e nao em cada renderizador.
    #
    # A amostra tem `>>` de verdade (351 palavras, texto sintetico com a MESMA estrutura da
    # legenda real). O `[ __ ]` a amostra nao tem -- o texto foi trocado por palavras
    # sinteticas --, entao ele entra em valor construido, logo abaixo.
    sujas = [w for w in palavras if ">>" in w["text"]]
    check("19a. a amostra REAL traz o marcador de troca de falante (a premissa do bloco)",
          len(sujas) >= 10)
    limpo_words = ytclip.cues_for_range(grossas, 0.0, fim_amostra, palavras)
    limpo_grosso = ytclip.cues_for_range(grossas, 0.0, fim_amostra)
    check("19b. caminho por PALAVRA: nenhum '>>' sai da fronteira",
          not any(">>" in l["text"] for l in limpo_words)
          and not any(">>" in w["text"] for l in limpo_words for w in l["words"]))
    check("19c. caminho da cue GROSSA (sidecar v2/v3): nenhum '>>' sai da fronteira",
          not any(">>" in c["text"] for c in limpo_grosso))
    check("19d. mas a FALA continua la -- limpar nao e apagar (66 linhas, como antes)",
          len(limpo_words) == 66 and all(l["text"].strip() for l in limpo_words))
    # A prova de que o texto so PERDEU o marcador: reconstruindo com a mesma regra, bate.
    check("19e. o texto limpo e exatamente o texto de antes menos o marcador",
          [l["text"] for l in limpo_words]
          == [captions.strip_artifacts(l["text"]) for l in limpo_words])

    # --- o RELOGIO nao se mexe: mesma amostra, com e sem os marcadores no texto ---------
    # Trocar `>> x` por `x` na ENTRADA tem de dar o mesmo resultado que limpar na saida. Se
    # a limpeza mexesse em qualquer instante, os dois divergiriam.
    sem_marcador = [dict(w, text=captions.strip_artifacts(w["text"])) for w in palavras]
    sem_marcador = [w for w in sem_marcador if w["text"]]
    espelho = ytclip.cues_for_range(grossas, 0.0, fim_amostra, sem_marcador)
    check("19f. os INSTANTES das linhas sao identicos com e sem marcador na entrada",
          [(l["start"], l["end"]) for l in limpo_words]
          == [(l["start"], l["end"]) for l in espelho])
    check("19g. e os instantes de cada PALAVRA tambem",
          [[(w["start"], w["end"]) for w in l["words"]] for l in limpo_words]
          == [[(w["start"], w["end"]) for w in l["words"]] for l in espelho])

    # --- o caso do pedido montado sobre a fronteira: segmento vazio vira BURACO ---------
    # Tempos escolhidos a mao (o pedido os escreve assim), num corte que comeca em 10 s.
    PEDIDO = [{"start": 20.0, "end": 21.2, "text": "Eu comecei"},
              {"start": 21.2, "end": 21.8, "text": "[__]"},
              {"start": 21.8, "end": 23.0, "text": "a trabalhar cedo"}]
    recorte = ytclip.cues_for_range(PEDIDO, 10.0, 30.0)
    check("19h. o segmento so-artefato nao vira cue, e as duas falas sobrevivem",
          [c["text"] for c in recorte] == ["Eu comecei", "a trabalhar cedo"])
    check("19i. rebaseadas para o corte e SEM deslocar: 10.0-11.2 e 11.8-13.0",
          [(c["start"], c["end"]) for c in recorte] == [(10.0, 11.2), (11.8, 13.0)])
    check("19j. o buraco de 0,6 s existe do outro lado da fronteira",
          not any(c["start"] < 11.8 and c["end"] > 11.2 for c in recorte))

    # --- a RECOMENDACAO de cortes nao muda: prova comportamental, nao textual -----------
    # O `parse_json3` (que o `candidates` usa para medir pausa entre falas) NAO foi tocado de
    # proposito -- limpar la mudaria onde o corte fecha, que esta fora deste pedido.
    # Aqui morava `candidates(info_rec) == candidates(dict(info_rec, cues=list(grossas)))`,
    # que era TAUTOLOGIA: `info_rec["cues"]` JA e `grossas`, entao os dois lados eram a mesma
    # entrada pelo mesmo codigo e o check nao tinha como reprovar nunca -- provado aplicando
    # a limpeza dentro do `parse_json3` e vendo o check passar verde. A pergunta com dente e
    # a inversa: limpar a entrada do detector MUDARIA a recomendacao? Muda (medido: 15 das 60
    # cues perdem o marcador e o `hook` do candidato sai diferente). E por isso que a limpeza
    # mora no `normalize_cues` e nao no `parse_json3`.
    limpas_para_detector = [dict(c, text=captions.strip_artifacts(c["text"]))
                            for c in grossas]
    check("19k. limpar a entrada do DETECTOR mudaria a recomendacao -- a restricao 'nao "
          "toque no parse_json3' e real, nao decorativa",
          ytclip.candidates(info_rec)
          != ytclip.candidates(dict(info_rec, cues=limpas_para_detector)))
    # SABIDO E FORA DESTE PEDIDO (medido em 2026-08-31, revisao adversarial): como o detector
    # le o texto cru, o `hook`/`topic` do candidato sai com o marcador -- e ele NAO e so
    # entrada de calculo, aparece no cartao de trecho (`video-ops.js` ~1387/1390), vira o
    # nome do clip na Central (`libAdd`, persistido em pp_video_clips_v1), entra no nome do
    # MP4 e vai na resposta publica da Fase 1 (`cloud/probe_server.CANDIDATE_FIELDS`).
    # Nao foi consertado aqui porque o pedido e de LEGENDA e proibe mexer na deteccao de
    # cortes; o conserto seria limpar o campo de saida em `ytclip.py:719`, sem tocar no
    # calculo. Este check prende so o que e verdade hoje: o detector le texto cru.
    check("19l. o texto que o detector le e o CRU, com marcador (a limpeza nao vazou para "
          "dentro do `parse_json3`)",
          any(">>" in c["text"] for c in grossas))

    # ---------------------------------------------------------------- relatório
    print("\n--- verificacoes ---")
    falhas = 0
    for label, ok in CHECKS:
        print("  %s  %s" % ("ok  " if ok else "FALHA", label))
        if not ok:
            falhas += 1
    if falhas:
        print("\nFALHOU: %d verificacao(oes)" % falhas)
        return 1
    print("\nok - %d verificacoes passaram. Nenhuma rede, nenhum conteudo de terceiro."
          % len(CHECKS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
