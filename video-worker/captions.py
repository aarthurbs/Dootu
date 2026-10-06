# -*- coding: utf-8 -*-
"""Legenda queimada no 9:16: cues -> documento ASS.

Módulo PURO de propósito — nada de rede, de subprocess, do `worker` nem do `ytclip`. Do
mesmo jeito que o `heatmap.py`, ele é testável sem FFmpeg, sem YouTube e sem servidor.

Os números da TIPOGRAFIA não são novos. São os MESMOS do editor Remotion
(`studio/src/preset.js`, `TOKENS`): Inter Bold 58px branca, no máximo 2 linhas de ~25
caracteres, 820px de largura útil. Dois renderizadores, uma regra visual só — e é por isso
que `test_captions.py` compara este arquivo com o `preset.js` em vez de confiar.

A POSIÇÃO vertical também é daqui, e desde 2026-08-27 para os DOIS renderizadores:
`margem_inferior` é o dono único da âncora e o `serve.render_props` manda o número dela ao
Remotion no prop `legendaBase`. Antes o Remotion tinha âncora PRÓPRIA (`legendaTopoPct` =
66% da altura = y 1267) e, desde que o vídeo parou de ser ampliado em 2026-08-26, o texto
dele caía ~61px ABAIXO da imagem, sobre a miniatura escurecida — o mesmo corte legendado
pelos dois caminhos punha a fala em lugares diferentes. A divergência morreu: o
`legendaTopoPct` saiu do preset.js e a conta ficou aqui (fonte 16:9: base do texto em
y≈1215, vídeo de 656 a 1264).

O que este módulo NÃO faz: escolher o trecho, rebasear o relógio nem destacar palavra. O
rebase é do `ytclip.cues_for_range` (fronteira única) e a ênfase semântica ficou de fora
desta versão de propósito — ver o relatório.
"""

# Quadro de saída, igual ao worker.OUT_W/OUT_H. Repetido (e não importado) porque importar o
# worker traria FFmpeg, subprocess e o mundo do lote para dentro de um formatador de texto.
OUT_W = 1080
OUT_H = 1920

# A fonte vai EMPACOTADA no repositorio, nao instalada na maquina: o libass a recebe por
# `fontsdir` (ver worker.build_filter/_place_font), entao o corte sai em Inter em qualquer
# maquina e em qualquer container -- sem passo manual, e sem depender do que o Windows tem.
# `Inter-Bold.ttf` do release oficial (SIL OFL, LICENSE.txt ao lado). O ARQUIVO importa:
# medido lendo a tabela `name`, so o `Inter-Bold.ttf` do `extras/ttf/` se declara familia
# "Inter"; o `Inter-ExtraBold.ttf` se declara familia "Inter ExtraBold", e o libass NAO o
# casaria com o `(Inter, 700)` que o estilo pede -- cairia em Arial calado, o MESMO
# defeito. Por isso o test_captions le a tabela `name` em vez de confiar no nome do arquivo.
import math
import os
import re

FONTE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

# --- espelho de studio/src/preset.js TOKENS -------------------------------------------
COR = "&H00FFFFFF"            # TOKENS.texto '#FFFFFF' no formato ASS &HAABBGGRR
LARGURA = 820                 # TOKENS.legendaLargura
MAX_CHARS_LINHA = 25          # preset.js MAX_CHARS_LINHA
MAX_LINHAS = 2                # preset.js MAX_LINHAS

# --- espelho de studio/src/preset.js LEGENDA_PRESETS ----------------------------------
# QUARTA copia de um conjunto fechado (preset.js e o dono, serve.py e video-ops.js sao as
# outras duas), pela razao de sempre: este modulo e stdlib puro e nao ha import possivel
# entre ele e um ES module. O `test_serve.py` LE o preset.js e compara -- divergir calado
# faria o MESMO corte sair numa tipografia pelo FFmpeg e noutra pelo Remotion.
#
# `negrito` e por ARQUIVO, nao por estilo: o `Inter-Bold.ttf` se declara familia "Inter",
# entao o libass precisa do `(Inter, 700)` para casar; o `Montserrat-ExtraBold.ttf` se
# declara familia "Montserrat ExtraBold" e o peso JA esta no desenho -- pedir negrito dele
# faz o libass SINTETIZAR por cima de um ExtraBold, o mesmo engrossamento borrado que o
# comentario do peso no Clip.jsx registra, e que so aparece olhando o frame.
LEGENDA_FONTES = {
    "inter": {"nome": "Inter", "arquivo": "Inter-Bold.ttf", "negrito": True},
    "montserrat": {"nome": "Montserrat ExtraBold",
                   "arquivo": "Montserrat-ExtraBold.ttf", "negrito": False},
}
# O padrao mora AQUI e o serve.py o DERIVA (como o PROFILES deriva do worker.REFRAMES):
# uma quinta copia escrita a mao seria mais um lugar para divergir calado.
LEGENDA_PADRAO = "classico"
LEGENDA_ESTILOS = {
    # `peso`, `entrelinha` e `palavra_escala` espelham `peso`/`entrelinha`/`palavraEscala` do
    # LEGENDA_PRESETS (check 34a3): sao eles que decidem a largura da palavra mais longa e a
    # altura de uma pagina de 2 linhas -- o piso da coluna e a guarda do topo (2026-09-28).
    "classico": {"familia": "inter", "tamanho": 58, "caixa_alta": False,
                 "peso": 700, "entrelinha": 1.18, "palavra_escala": 1.12},
    "impacto": {"familia": "montserrat", "tamanho": 72, "caixa_alta": True,
                "peso": 800, "entrelinha": 1.10, "palavra_escala": 1.06},
    # Os estilos prontos de 2026-09-23. `cor`/`contorno`/`fundo` em #RRGGBB, como no
    # preset.js (o check 34a compara); ausente = branco, sem contorno, sem caixa.
    "faixa": {"familia": "inter", "tamanho": 54, "caixa_alta": False,
              "fundo": "#0E0E10", "peso": 700, "entrelinha": 1.3, "palavra_escala": 1.06},
    "podcast": {"familia": "montserrat", "tamanho": 66, "caixa_alta": True,
                "contorno": "#000000", "peso": 800, "entrelinha": 1.10, "palavra_escala": 1.06},
    "papel": {"familia": "inter", "tamanho": 56, "caixa_alta": False,
              "cor": "#141414", "fundo": "#FFFFFF",
              "peso": 800, "entrelinha": 1.3, "palavra_escala": 1.04},
    "discreta": {"familia": "inter", "tamanho": 48, "caixa_alta": False,
                 "cor": "#F5F1E8", "peso": 700, "entrelinha": 1.2, "palavra_escala": 1.0},
}
# TOKENS.legendaContornoFator / legendaFundoAlfa do preset.js (check 34c).
CONTORNO_FATOR = 0.06
FUNDO_ALFA = 0.88
SEM = "nenhum"
# Avanco medio em `em`, MEDIDO (fontTools, cmap -> hmtx / unitsPerEm, media ponderada pela
# frequencia das letras do portugues). Espelha AVANCO_INTER/_CAIXA_ALTA e
# AVANCO_MONTSERRAT_LEGENDA/_CAIXA_ALTA do preset.js -- o mesmo metodo devolve 0.683160
# para a Inter Bold em caixa alta, que e o numero que ja estava la.
AVANCOS = {("inter", False): 0.55, ("inter", True): 0.683,
           ("montserrat", False): 0.610, ("montserrat", True): 0.731}
# Avanco de CADA caractere, em milesimos de `em`, para medir a palavra MAIS LONGA de um corte
# (o piso da coluna, 2026-09-28). A media acima serve para paginar; para "esta palavra cabe
# nesta coluna?" a media mente para menos em palavra de letra larga (M, W, O).
# MEDIDO no Chrome (`measureText` a 1000px) sobre as MESMAS fontes do Google que o Remotion
# carrega (`@remotion/google-fonts`: a Inter e variavel, e 700 != 800 -- o `papel` e Inter
# 800) e que o site carrega. Letter-spacing negativo do estilo NAO entra: a soma sai uns 1%
# larga, que e o lado seguro de um piso. Caractere fora da tabela vale o MAIOR da face.
AVANCO_ORDEM = ("0123456789!\"#$%&'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`"
                "abcdefghijklmnopqrstuvwxyz{|}~ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß"
                "àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ“”‘’–—…")
AVANCO_ESPACO = {("inter", 700): 237, ("inter", 800): 219, ("montserrat", 800): 291}
AVANCO_CHAR = {
    ("inter", 700): (
        674, 431, 630, 646, 676, 622, 649, 582, 651, 649, 338, 552, 649, 655, 1016, 672,
        339, 377, 377, 559, 679, 334, 468, 334, 388, 334, 343, 679, 679, 679, 560, 1016,
        747, 662, 740, 722, 607, 587, 750, 747, 281, 584, 719, 565, 932, 762, 771, 648,
        777, 657, 655, 667, 732, 747, 1038, 738, 731, 664, 377, 388, 377, 487, 476, 365,
        581, 630, 588, 630, 596, 398, 632, 623, 271, 271, 580, 271, 913, 623, 613, 630,
        630, 407, 560, 366, 623, 600, 850, 580, 602, 573, 469, 372, 469, 679, 747, 747,
        747, 747, 747, 747, 1022, 740, 607, 607, 607, 607, 281, 281, 281, 281, 760, 762,
        771, 771, 771, 771, 771, 771, 732, 732, 732, 732, 731, 669, 657, 581, 581, 581,
        581, 581, 581, 910, 588, 596, 596, 596, 596, 271, 271, 271, 271, 599, 623, 613,
        613, 613, 613, 613, 613, 623, 623, 623, 623, 602, 630, 602, 540, 532, 311, 311,
        500, 1000, 1002),
    ("inter", 800): (
        692, 441, 638, 657, 688, 634, 662, 588, 664, 662, 358, 586, 655, 660, 1029, 683,
        354, 382, 382, 583, 686, 353, 471, 353, 400, 353, 360, 686, 686, 686, 579, 1036,
        770, 665, 744, 723, 610, 585, 752, 749, 286, 590, 738, 565, 943, 766, 773, 652,
        782, 662, 660, 677, 727, 770, 1059, 761, 752, 679, 382, 400, 382, 493, 484, 382,
        588, 638, 595, 638, 601, 410, 639, 635, 283, 283, 593, 283, 927, 635, 619, 638,
        638, 420, 573, 382, 635, 615, 863, 594, 618, 581, 486, 388, 486, 686, 770, 770,
        770, 770, 770, 770, 1035, 744, 610, 610, 610, 610, 286, 286, 286, 286, 770, 766,
        773, 773, 773, 773, 773, 773, 727, 727, 727, 727, 752, 683, 674, 588, 588, 588,
        588, 588, 588, 907, 595, 601, 601, 601, 601, 283, 283, 283, 283, 606, 635, 619,
        619, 619, 619, 619, 619, 635, 635, 635, 635, 618, 638, 618, 581, 569, 331, 331,
        500, 1000, 1058),
    ("montserrat", 800): (
        685, 405, 599, 603, 700, 607, 649, 632, 669, 649, 301, 462, 730, 647, 897, 752,
        242, 369, 369, 453, 609, 283, 388, 283, 415, 283, 283, 609, 609, 609, 597, 1036,
        786, 769, 730, 826, 672, 642, 770, 806, 339, 557, 752, 610, 954, 806, 846, 737,
        846, 740, 647, 635, 786, 766, 1184, 737, 693, 679, 389, 415, 389, 610, 500, 600,
        628, 695, 603, 698, 642, 406, 705, 696, 313, 320, 677, 313, 1045, 696, 666, 695,
        695, 443, 547, 447, 692, 620, 956, 619, 620, 556, 414, 314, 414, 609, 786, 786,
        786, 786, 786, 786, 1099, 730, 672, 672, 672, 672, 339, 339, 339, 339, 843, 806,
        846, 846, 846, 846, 846, 846, 786, 786, 786, 786, 693, 737, 703, 628, 628, 628,
        628, 628, 628, 999, 603, 642, 642, 642, 642, 313, 313, 313, 313, 622, 696, 666,
        666, 666, 666, 666, 666, 692, 692, 692, 692, 620, 695, 620, 545, 545, 283, 283,
        500, 1000, 858),
}
# TOKENS de cor no formato ASS &HAABBGGRR (alfa invertido: 00 = opaco, e a ordem dos bytes
# e a INVERSA do #RRGGBB). Paleta FECHADA do projeto, nao roda de cor livre -- a direcao
# editorial proibe neon.
CORES = {"texto": "&H00FFFFFF", "destaque": "&H0041A4D9", "destaqueGanho": "&H0073B58F",
         "destaquePerda": "&H004A55C0", "palavraCor": "&H006AE359"}
# `left|center|right` -> Alignment do ASS na linha de BAIXO (1, 2, 3).
ALINHAMENTOS = {"left": 1, "center": 2, "right": 3}
# O que o caminho ASS NAO consegue reproduzir do preset do Remotion. Conjunto FECHADO
# porque a TELA mostra estas frases ao lado do botao que usa este caminho (BP-008): um
# renderizador que entrega outra coisa CALADO e exatamente o defeito que estes checks
# existem para impedir.
ASS_NAO_REPRODUZ = (
    "o destaque da palavra sendo dita (a pagina inteira sai na cor principal)",
    "a animacao de entrada da palavra",
    "o desfoque da sombra (o ASS so tem sombra dura, deslocada)",
    "os cantos arredondados da caixa de fundo, e o contorno quando ha caixa",
    "a inclinacao e o volume da Profundidade (o texto sai reto e sem espessura)",
    "a musica de fundo (sai so a voz)",
    "os trechos removidos (sai o corte inteiro)",
    "o texto fixo na tela",
    "o zoom pontual",
)
_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


def cor_ass(valor, alfa=0):
    """Nome de token ou #RRGGBB -> &HAABBGGRR. Qualquer outra coisa -> None.

    `alfa` e OPACIDADE (0..1) quando dado; 0 = opaco, que e o de sempre.
    """
    if valor in CORES and not alfa:
        return CORES[valor]
    if not isinstance(valor, str) or not _HEX.match(valor):
        return None
    aa = int(round((1 - alfa) * 255)) if alfa else 0
    return "&H%02X%s%s%s" % (aa, valor[5:7], valor[3:5], valor[1:3])

# Os quatro nomes de sempre, agora DERIVADOS do estilo padrao em vez de escritos a mao: o
# corte sem estilo escolhido tem de sair byte a byte como sempre saiu, e derivar e o que
# garante isso quando alguem mexer na tabela. Continuam publicos porque o worker
# (`_place_font`) e a tela leem o arquivo da fonte.
_PADRAO = LEGENDA_ESTILOS[LEGENDA_PADRAO]
FONTE_ARQUIVO = LEGENDA_FONTES[_PADRAO["familia"]]["arquivo"]
FONTE = LEGENDA_FONTES[_PADRAO["familia"]]["nome"]
NEGRITO = LEGENDA_FONTES[_PADRAO["familia"]]["negrito"]
FONTE_TAMANHO = _PADRAO["tamanho"]


def limite(valor, padrao, minimo, maximo):
    """Numero do operador -> dentro da faixa. Texto, bool e nao-finito caem no padrao."""
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return padrao
    if valor != valor or valor in (float("inf"), float("-inf")):
        return padrao
    return int(round(min(maximo, max(minimo, valor))))


def chars_por_linha(fonte, avanco, largura=LARGURA):
    """Porte do `charsPorLinhaLegenda()` do preset.js. Entrada torta devolve o teto de hoje.

    Sem isto o caminho ASS pagina com 25 caracteres fixos enquanto o Remotion pagina com o
    teto do ESTILO (o `impacto` cabe 15 por linha), e o mesmo corte sai com quebras
    diferentes em cada renderizador -- calado.
    """
    try:
        corpo, a = float(fonte), float(avanco)
    except (TypeError, ValueError):
        return MAX_CHARS_LINHA
    if not (corpo > 0) or not (a > 0):
        return MAX_CHARS_LINHA
    try:
        coluna = float(largura)
    except (TypeError, ValueError):
        coluna = float(LARGURA)
    if not (coluna > 0) or coluna == float("inf"):
        coluna = float(LARGURA)
    return max(1, int(coluna // (corpo * a)))


def estilo_ass(style=None, manual=None):
    """Estilo de legenda + ajuste MANUAL -> o que o ASS consegue dizer. PURA e total.

    Dona unica da traducao preset->ASS. Nada aqui levanta: entrada desconhecida, ausente,
    de tipo errado ou fora da paleta cai no `classico`, que e a legenda que TODO corte ja
    queima hoje -- corte salvo antes desta entrega nao manda chave nenhuma e tem de sair
    exatamente como sempre saiu.

    O que o ASS NAO expressa esta em `ASS_NAO_REPRODUZ`, e a tela mostra a lista ao lado do
    botao que usa este caminho (BP-008).
    """
    m = manual if isinstance(manual, dict) else {}
    escolhido = m.get("style") if m.get("style") in LEGENDA_ESTILOS else style
    base = LEGENDA_ESTILOS.get(escolhido, LEGENDA_ESTILOS[LEGENDA_PADRAO])
    familia = m["familia"] if m.get("familia") in LEGENDA_FONTES else base["familia"]
    fonte = LEGENDA_FONTES[familia]
    caixa = m["caixaAlta"] if isinstance(m.get("caixaAlta"), bool) else base["caixa_alta"]
    tamanho = limite(m.get("tamanho"), base["tamanho"], 32, 96)
    largura = limite(m.get("largura"), LARGURA, 360, 1000)

    def _tinta(chave):
        # Manual valido vence; `nenhum` desliga; senao o do estilo.
        v = m.get(chave)
        if v == SEM:
            return None
        return v if cor_ass(v) else base.get(chave)
    contorno, fundo = _tinta("contorno"), _tinta("fundo")
    # Mesma regra do `resolveLegenda`: Montserrat so existe em 800; a Inter usa o do estilo.
    peso = 800 if familia == "montserrat" else base["peso"]
    return {
        "fonte": fonte["nome"],
        "arquivo": fonte["arquivo"],
        "negrito": fonte["negrito"],
        "familia": familia,
        "tamanho": tamanho,
        "caixaAlta": caixa,
        "cor": cor_ass(m.get("cor")) or cor_ass(base.get("cor")) or COR,
        # Visivel em px (o `Outline` do ASS ja e o que aparece fora da letra).
        "contorno": cor_ass(contorno),
        "contorno_px": max(1, int(round(tamanho * CONTORNO_FATOR))),
        "fundo": cor_ass(fundo, FUNDO_ALFA),
        "largura": largura,
        "alinhamento": ALINHAMENTOS.get(m.get("alinhamento"), 2),
        # O teto de CARACTERES por linha sai do corpo, do avanco medido da familia/caixa e
        # da coluna -- a mesma conta do `tetoDaPagina` do preset.js.
        "max_linha": chars_por_linha(tamanho, AVANCOS[(familia, caixa)], largura),
        "peso": peso,
        "entrelinha": base["entrelinha"],
        "palavra_escala": base["palavra_escala"],
        # A base mais ALTA que ainda cabe uma pagina inteira (2 linhas) dentro do quadro:
        # a margem do quadro + duas linhas no corpo e na entrelinha do estilo.
        "topo": MARGEM_LATERAL + int(math.ceil(MAX_LINHAS * tamanho * base["entrelinha"])),
        # INTENCAO vertical, nunca a ancora: quem transforma isto em MarginV e o
        # `margem_inferior`, que continua dono unico e e quem aplica o teto da zona de UI.
        "posicaoPct": limite(m.get("posicaoPct"), None, 0, 100),
        # INTENCAO horizontal (centro da coluna em % da largura do quadro). Quem a vira
        # MarginL/MarginR e o `coluna_x`, que tambem e quem grampeia contra a trilha.
        "posicaoXPct": limite(m.get("posicaoXPct"), None, 0, 100),
    }
# TOKENS.sombraTexto = '0 3px 14px rgba(0,0,0,.82)'. Sombra de LEITURA, não efeito: sem ela
# a legenda branca some sobre camisa clara. O alfa do ASS é invertido (00 = opaco), então
# 82% de opacidade vira round((1 - .82) * 255) = 46 = 0x2E.
SOMBRA = 3
SOMBRA_COR = "&H2E000000"
CONTORNO = 0                  # sem outline: o projeto proíbe contorno/glow decorativo
# Respiro entre a última linha da legenda e a borda de BAIXO do vídeo visível. A legenda mora
# DENTRO da imagem, não na tarja de fundo embaixo dela — ver `margem_inferior`.
RODAPE_PCT = 0.08
# Abaixo disto começa a interface do TikTok/Reels (nome, descrição, barra de progresso). Vale
# para o perfil `crop`, em que o vídeo ocupa o quadro inteiro e o rodapé sozinho jogaria o
# texto para dentro da faixa de botões.
ZONA_UI_PCT = 0.86
# Silencio entre o INICIO de duas palavras que fecha a linha, quando a legenda vem com tempo
# por palavra (`ytclip.parse_json3_words`). MEDIDO na legenda real de um podcast de 53 min
# (10857 palavras com instante): palavras da mesma janela do YouTube comecam a cada ~201 ms
# (mediana) e a primeira palavra de uma janela vem ~279 ms depois da ULTIMA da anterior --
# p10 120 ms, p90 719 ms, maximo 8500 ms. 0,7 s = o p90: quebra na respiracao de verdade, e
# nao a cada palavra. E O BOTAO DE CALIBRAGEM: subir junta mais palavra por pagina (menos
# troca na tela), descer pica a frase.
# O mesmo numero e o RABO da linha: ela sai da tela no maximo este tanto depois do inicio da
# ultima palavra dela. Coerente por construcao -- pausa maior que isto ja quebrou a linha --,
# e e o que impede a pausa de 8,5 s de deixar a frase pendurada oito segundos na tela.
PAUSA_LINHA_SEC = 0.7
# Fecha a linha DEPOIS da palavra terminada assim. NAO e caminho morto de legenda manual:
# aqui dizia "praticamente so dispara em legenda MANUAL: a automatica do YouTube nao
# pontua", e a amostra desmente -- 44 das 351 palavras (12,5%) terminam em .!? e outras 29
# em virgula. A pontuacao e ESTRUTURAL, nao invencao do texto sintetico: 11 das 15 trocas de
# falante (`isSpeakerChange`) vem logo depois de uma palavra pontuada. E o ramo carrega o
# ganho inteiro do 17s: desligado, 24 de 53 paginas voltam a partir a frase no meio. Nao
# apagar como ramo que nunca roda.
FIM_DE_FRASE = (".", "!", "?", "…")

# Fala mais curta que isto não dá tempo de ser lida e vira piscada. É o mesmo piso do
# `ytclip.cues_for_range`, repetido aqui porque este módulo também recebe cue EDITADA pelo
# operador, que não passa por lá.
MIN_CUE_SEC = 0.05
# Piso de duracao da LINHA de exibicao (`cues_from_words`), 2 ms ACIMA do MIN_CUE_SEC de
# proposito: quem consome ARREDONDA para milissegundo (`ytclip._lines_from_words_in_range`) e
# so DEPOIS compara `fim - inicio < MIN_CUE_SEC`. Piso exatamente no limiar e cara-ou-coroa de
# float -- medido: a ultima palavra do corte, aparada em 12,201 -> 12,251, dava
# 0.05000000000000071 aqui e 0.04999999999999893 depois do round(3), e a regra 1 do
# `normalize_cues` DESCARTAVA a cue com o texto dentro, sempre no FIM do trecho e sempre
# calado: 63 das 351 palavras da amostra desapareciam quando o corte acabava 1 ms depois de
# a palavra comecar (e o que o check 17v do test_ytclip varre, palavra por palavra).
# Arredondar dois instantes encurta a duracao em no maximo 1 ms, entao 2 ms sobrevivem com
# 1 ms de sobra.
PISO_LINHA_SEC = MIN_CUE_SEC + 0.002

# Marcadores que o RECONHECEDOR escreve e que NINGUEM falou. Conjunto FECHADO de dois, e
# fechado de proposito: tudo que nao for provadamente artefato e fala de alguem.
#   `>>`      troca de falante do json3 (vem colado ou com espaco: ">>Ta bom", ">> Ta bom")
#   `[ __ ]`  censura de palavrao do reconhecedor (o YouTube escreve com espacos dentro)
# MEDIDO na amostra real (`fixtures/json3-rolante.json`): 18 das 351 palavras trazem um
# deles -- e era essa a razao de aparecer ">> Ta bom." queimado no 9:16.
# NAO entram aqui: `[Musica]`, `[Aplausos]`, reticencia, aspas e pontuacao. Sao ou fala ou
# descricao de audio que alguem pode querer ler; apagar seria a "modificacao agressiva de
# texto normal" que o pedido proibe. Substituimos por ESPACO, nunca por vazio: com vazio,
# "a>[__]>b" viraria "a>>b" e criaria o artefato que acabamos de tirar (a funcao deixaria
# de ser idempotente).
ARTEFATOS_RE = re.compile(r">>+|\[\s*_+\s*\]")


def strip_artifacts(texto):
    """Texto da transcricao -> so o que foi FALADO. Pura, idempotente, regra UNICA.

    Mora aqui e e chamada de um lugar so (`normalize_cues`) porque `normalize_cues` e o
    gargalo por onde TODA cue passa antes de virar legenda: o ASS do FFmpeg (via `to_pages`),
    as Sequence do Remotion e o painel de revisao do Passo 3 bebem todos do
    `ytclip.cues_for_range`, que termina nela. Uma copia desta regra em cada renderizador
    divergiria calada -- que e exatamente o defeito que o `margem_inferior` ja resolveu para
    a POSICAO da legenda.

    So mexe em TEXTO. Nenhum instante e lido ou escrito aqui.
    """
    return " ".join(ARTEFATOS_RE.sub(" ", str(texto or "")).split())


def font_available(arquivo=None):
    """O arquivo da fonte empacotada esta no repositorio?

    Substituiu o `font_installed`, que procurava a Inter instalada no Windows. A pergunta
    mudou porque a resposta mudou: a fonte agora viaja com o projeto e o libass a recebe por
    `fontsdir`, entao "instalada nesta maquina" deixou de ser a condicao de o corte sair em
    Inter -- e nunca foi verdade na nuvem, onde nao ha maquina de ninguem para instalar nada.

    Continua existindo porque o libass NAO falha quando nao acha a fonte: ele troca calado.
    Medido nesta maquina, com `-loglevel info`:

        fontselect: (Inter, 700, 0) -> Arial-BoldMT, 0, Arial-BoldMT

    O corte sai legendado do mesmo jeito, so que em Arial, e ninguem fica sabendo. Se alguem
    apagar o arquivo, quem chama transforma este False no aviso `burned-sem-inter` na tela,
    em vez de deixar a tipografia trocar sozinha (BP-008).
    """
    return os.path.isfile(os.path.join(FONTE_DIR, arquivo or FONTE_ARQUIVO))


def _num(valor):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    # NaN/inf viraria tempo ilegível no ASS e legenda eterna na tela (BP-004).
    if n != n or n in (float("inf"), float("-inf")):
        return None
    return n


def _pack(texto, limite):
    """Palavras -> linhas de no máximo `limite` caracteres. Nunca corta palavra no meio."""
    linhas = []
    atual = ""
    for palavra in str(texto or "").split():
        tentativa = (atual + " " + palavra) if atual else palavra
        # `or not atual` deixa passar a palavra sozinha maior que o limite: quebrar dentro
        # dela seria pior que estourar a linha.
        if len(tentativa) <= limite or not atual:
            atual = tentativa
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def _reescrita(anterior, novo):
    """`novo` e a MESMA fala que o YouTube estava escrevendo, so mais completa?

    A legenda automatica reemite a linha enquanto "digita": "eu acho" -> "eu acho que" ->
    "eu acho que sim". Nesses casos a anterior nunca teria como aparecer e descartar e o
    certo -- era para ISSO que a regra do empate existia.

    O reconhecimento e por PREFIXO, e e o que separa este caso do outro: duas falas
    DIFERENTES no mesmo instante nao sao prefixo uma da outra. Descartar uma delas apagava
    frase inteira, calado. MEDIDO com tres falas de podcast empatando o inicio: 22 palavras
    viravam 14 (-36%) e "eu perdi quarenta mil reais no primeiro ano" sumia sem nada na tela
    -- o defeito relatado como "a legenda nao completa o assunto".
    """
    a = " ".join(str(anterior or "").casefold().split())
    b = " ".join(str(novo or "").casefold().split())
    if not a or not b:
        return True
    return b.startswith(a) or a.startswith(b)


def _resolve_empate(grupo):
    """Falas com o MESMO instante de inicio -> lista sem empate e SEM texto perdido.

    Em grupo, e nao par a par, porque a decisao depende de todas as falas do instante.
    Duas etapas: colapsa reescrita (fica a versao mais completa) e, se sobrar mais de uma
    fala de verdade, REPARTE o intervalo por tamanho de texto em vez de escolher uma.

    Intervalo que nao cabe uma fala legivel para cada -> junta os textos numa fala so.
    Pagina mais longa e pior que o ideal; frase apagada e pior que isso.
    """
    if len(grupo) < 2:
        return list(grupo)
    restante = []
    for cue in grupo:
        if restante and _reescrita(restante[-1]["text"], cue["text"]):
            if len(cue["text"]) >= len(restante[-1]["text"]):
                restante[-1] = cue
            continue
        restante.append(cue)
    if len(restante) < 2:
        return restante

    inicio = restante[0]["start"]
    fim = max(c["end"] for c in restante)
    total = sum(len(c["text"]) for c in restante) or 1
    fatias, relogio = [], inicio
    for indice, cue in enumerate(restante):
        termina = (fim if indice == len(restante) - 1
                   else relogio + (fim - inicio) * (len(cue["text"]) / total))
        fatias.append({"start": relogio, "end": termina, "text": cue["text"]})
        relogio = termina
    if any(f["end"] - f["start"] < MIN_CUE_SEC for f in fatias):
        return [{"start": inicio, "end": fim,
                 "text": " ".join(c["text"] for c in restante)}]
    return fatias


def normalize_cues(cues):
    """Cues -> lista limpa, ordenada e SEM SOBREPOSIÇÃO. Pura, determinística e idempotente.

    Existe porque a legenda automática do YouTube é ROLANTE: um evento json3 continua no ar
    enquanto o seguinte já começou (medido num corte real, por volta de 13,25 s do clipe).
    Cada evento vira um Dialogue, os dois caem na MESMA região da tela e o espectador lê dois
    textos empilhados. Nenhum ajuste de posição resolve isso — o defeito é de TEMPO, e é aqui
    que ele morre, antes de existir ASS.

    É também o ponto único em que o marcador do reconhecedor (`>>`, `[ __ ]`) sai do texto
    — ver `strip_artifacts`. Aqui porque é aqui que passa TUDO: nenhum renderizador tem
    limpeza própria, então nenhum pode divergir.

    As regras, na ordem:
      0. o texto perde os artefatos de transcrição; se não sobrar nada, a cue NÃO vira
         legenda — mas o instante dela ainda apara a fala anterior (a "barreira" do laço
         final), para o buraco continuar buraco em vez de virar fala esticada;
      1. fora quem não é dicionário, não tem texto, tem tempo ilegível ou dura menos que
         MIN_CUE_SEC;
      2. ordem por (início, fim, texto) — o texto entra na chave para duas falas empatadas
         não trocarem de lugar entre execuções (a saída vira arquivo, e arquivo é comparado);
      3. começo igual ou anterior ao da fala já aceita: a anterior não teria como aparecer,
         então a ÚLTIMA vence (é a que o YouTube estava escrevendo);
      4. sobreposição parcial: a anterior TERMINA onde esta começa;
      5. se o corte do item 4 deixar a anterior curta demais para ser lida, ela sai —
         buraco curto é melhor que piscada.

    O relógio NÃO é tocado: o rebase para o começo do corte é do `ytclip.cues_for_range` e
    continua sendo a fronteira única do projeto.
    """
    limpo = []
    for cue in cues or []:
        if not isinstance(cue, dict):
            continue
        bruto = " ".join(str(cue.get("text") or "").split())
        # O artefato sai do TEXTO e o instante fica: cue que era SO marcador continua na
        # lista com texto vazio e vira BARREIRA no laco de baixo -- nao aparece na tela, mas
        # o tempo dela nao e doado a fala vizinha. Ver o comentario la embaixo.
        texto = strip_artifacts(bruto)
        inicio, fim = _num(cue.get("start")), _num(cue.get("end"))
        if not bruto or inicio is None or fim is None:
            continue
        inicio = max(0.0, inicio)
        if fim - inicio < MIN_CUE_SEC:
            continue
        item = {"start": inicio, "end": fim, "text": texto}
        # `words` (tempo por PALAVRA) e OPCIONAL e passa INTEIRO quando existe: quem produz e
        # o `cues_from_words`, quem consome e o karaoke do Remotion (`activeWordIndex`, no
        # preset.js). Cue sem a chave -- sidecar v1/v2/v3, legenda corrigida na mao pelo
        # operador, cue grossa de legenda manual -- continua exatamente como antes: legenda
        # estatica e branca. Nao e obrigatorio para carregar corte nenhum.
        palavras = cue.get("words")
        if isinstance(palavras, list) and palavras:
            # As palavras passam pela MESMA regra, senao o karaoke acenderia o marcador: o
            # Remotion so pinta palavra a palavra quando `words.join(' ')` bate com o texto
            # da pagina (`preset.palavrasAlinhadas`), e limpar so um dos dois derrubaria
            # todo corte para a legenda estatica. Palavra que era so artefato sai da lista;
            # os instantes das VIZINHAS nao sao tocados.
            limpas = [dict(p, text=strip_artifacts(p.get("text")))
                      for p in palavras if isinstance(p, dict)]
            limpas = [p for p in limpas if p["text"]]
            if limpas:
                item["words"] = limpas
        limpo.append(item)
    limpo.sort(key=lambda c: (c["start"], c["end"], c["text"]))
    # Empate de inicio e resolvido ANTES do laco de sobreposicao, e em GRUPO -- ver
    # _resolve_empate. Aqui morava um `while saida and cue["start"] <= saida[-1]["start"]:
    # saida.pop()`, que APAGAVA a fala anterior de qualquer empate, texto e tudo.
    grupos = []
    for cue in limpo:
        if grupos and abs(cue["start"] - grupos[-1][0]["start"]) < 1e-9:
            grupos[-1].append(cue)
        else:
            grupos.append([cue])
    sem_empate = []
    for grupo in grupos:
        sem_empate.extend(_resolve_empate(grupo))

    saida = []
    for cue in sem_empate:
        if not cue["text"]:
            # BARREIRA: o intervalo era SO artefato (`>>`, `[ __ ]`). Ele nao vira legenda --
            # e esse e o ponto do pedido: o espectador ve um buraco curto, nunca o marcador.
            # Mas o instante em que ele COMECA continua valendo, senao a fala anterior
            # escorreria por cima do buraco (a legenda do YouTube e rolante: quase toda fala
            # invade a seguinte, e sem a barreira quem apara a anterior passaria a ser a
            # PROXIMA fala de verdade, esticando a de tras pelo tempo do artefato). Buraco
            # curto vale mais que fala esticada.
            #
            # A barreira e ignorada quando aparar deixaria a anterior curta demais para ser
            # lida: descartar fala de verdade por causa de um marcador seria o pior dos
            # mundos, e ai a proxima fala apara como sempre aparou.
            #
            # A pergunta e feita com a MESMA expressao da regra 1 (`fim - inicio`), nunca
            # com `inicio + MIN_CUE_SEC`. As duas formas discordam por um ULP e isso apagava
            # a frase inteira, calada: com gap de exatamente 50 ms, `4.05 >= 4.0 + 0.05` e
            # True mas `4.05 - 4.0` da 0.04999999999999982, que e MENOR que o piso. O
            # caminho do FFmpeg normaliza DUAS vezes (`cues_for_range` e depois `to_pages`),
            # entao o primeiro passe aceitava a cue aparada e o segundo a descartava pela
            # regra 1 -- com o texto dentro. Medido: "eu quebrei duas vezes antes de
            # acertar" sumia do ASS e nada na tela dizia. Mesma familia da armadilha que
            # criou o `PISO_LINHA_SEC`; aqui nao ha `round` no meio, entao a expressao
            # identica basta e nao precisa de folga inventada.
            if saida and saida[-1]["end"] > cue["start"] and (
                    cue["start"] - saida[-1]["start"] >= MIN_CUE_SEC):
                saida[-1]["end"] = cue["start"]
            continue
        if saida and saida[-1]["end"] > cue["start"]:
            saida[-1]["end"] = cue["start"]
            if saida[-1]["end"] - saida[-1]["start"] < MIN_CUE_SEC:
                # A anterior ficou curta demais para ser lida. Aqui ela era DESCARTADA
                # ("buraco curto e melhor que piscada"), e isso tambem apagava texto: com
                # legenda rolante o corte encurta muita fala, e cada descarte levava as
                # palavras junto. Agora o texto dela entra na fala seguinte -- pagina mais
                # longa e o preco de nao perder o que foi dito.
                perdida = saida.pop()
                juntou = {"start": cue["start"], "end": cue["end"],
                          "text": (perdida["text"] + " " + cue["text"]).strip()}
                # As palavras so seguem se as DUAS falas tinham. Lista cobrindo metade do
                # texto acenderia a palavra errada, e meia verdade aqui e pior que a legenda
                # estatica de sempre -- que e justamente o que a ausencia da chave produz.
                if perdida.get("words") and cue.get("words"):
                    juntou["words"] = perdida["words"] + cue["words"]
                cue = juntou
        saida.append(cue)
    return saida


def cues_from_words(palavras, max_linha=MAX_CHARS_LINHA, max_linhas=MAX_LINHAS,
                    pausa=PAUSA_LINHA_SEC):
    """Palavras com tempo -> linhas de exibicao com duracao HONESTA. Pura e deterministica.

    A linha comeca no inicio da PRIMEIRA palavra dela e acaba no fim da ULTIMA, entao NAO ha
    sobreposicao por construcao: o `normalize_cues` nao tem janela rolante para truncar, e
    nenhum caractere e cobrado de um tempo que nao existiu.

    Quebra por tres motivos, nesta ordem de leitura: pausa de verdade entre as palavras
    (`pausa`), fim de frase pontuado (`FIM_DE_FRASE`) e o teto de linhas do editor. O teto e
    conferido com o `_pack` de verdade, nunca por contagem de caracteres: 50 caracteres podem
    render TRES linhas de 25 dependendo de onde caem os espacos, e o ASS nao quebra sozinho
    (WrapStyle 2).

    O que isto NAO resolve, e foi medido: a pessoa fala a ~18 char/s, entao reagrupar nao
    baixa a taxa de leitura -- ela e da FALA, nao da paginacao. O que muda e onde a pagina
    quebra (limite de palavra, com o tempo daquelas palavras) em vez do limite arbitrario da
    janela do YouTube, e cada pagina passar a durar o tempo que as palavras dela levaram em
    vez de uma fatia proporcional ao numero de caracteres.
    """
    limpo = []
    for palavra in palavras or []:
        if not isinstance(palavra, dict):
            continue
        texto = " ".join(str(palavra.get("text") or "").split())
        inicio, fim = _num(palavra.get("start")), _num(palavra.get("end"))
        if not texto or inicio is None:
            continue
        inicio = max(0.0, inicio)
        # Palavra sem fim legivel nao vira tempo inventado: ela ocupa um instante e quem
        # define a duracao da LINHA e a ultima palavra dela (ou o piso de leitura).
        fim = inicio if fim is None or fim < inicio else fim
        limpo.append({"start": inicio, "end": fim, "text": texto})
    limpo.sort(key=lambda p: (p["start"], p["text"]))

    linhas, atual = [], []

    def fecha():
        if not atual:
            return
        inicio = atual[0]["start"]
        fim = min(atual[-1]["end"], atual[-1]["start"] + pausa)
        linhas.append({"start": inicio, "end": max(fim, inicio + PISO_LINHA_SEC),
                       "text": " ".join(p["text"] for p in atual),
                       # As palavras que MONTARAM a linha seguem junto dela. Nada e
                       # recalculado nem inventado: e a mesma grade que o
                       # `ytclip.parse_json3_words` leu do json3, so anexada para o Remotion
                       # poder acender a que esta sendo dita. O `to_ass` (FFmpeg) ignora a
                       # chave -- o ASS NAO ganhou animacao neste pedido.
                       "words": [dict(p) for p in atual]})
        del atual[:]

    for palavra in limpo:
        if atual:
            anterior = atual[-1]
            candidato = " ".join(p["text"] for p in atual) + " " + palavra["text"]
            if (palavra["start"] - anterior["start"] > pausa
                    or anterior["text"].rstrip("\"')]»").endswith(FIM_DE_FRASE)
                    or len(_pack(candidato, max_linha)) > max_linhas):
                fecha()
        atual.append(palavra)
    fecha()
    return linhas


def to_pages(cues, max_linha=MAX_CHARS_LINHA, max_linhas=MAX_LINHAS):
    """Cues -> páginas curtas, cada uma com no máximo `max_linhas` linhas.

    Porte do `toCaptionPages()` do preset.js: fala longa vira várias páginas curtas, cada
    uma com a fatia de tempo PROPORCIONAL ao próprio tamanho — três palavras e doze palavras
    não levam o mesmo tempo para serem faladas.

    Uma diferença deliberada em relação ao JS: lá o corte é por PÁGINA de 50 caracteres e o
    CSS quebra em 2 linhas; aqui o corte é por LINHA e as linhas são agrupadas de duas em
    duas. O ASS não tem quebra automática ligada (WrapStyle 2), então o teto de 2 linhas
    precisa ser garantido na conta — um bloco de 50 caracteres pode render 3 linhas de 25
    dependendo de onde caem os espaços.
    """
    paginas = []
    # A limpeza (lixo, ordem, sobreposição) é do normalize_cues: uma regra só, no mesmo
    # módulo, e o caminho para o ASS passa obrigatoriamente por ela.
    for cue in normalize_cues(cues):
        texto, inicio, fim = cue["text"], cue["start"], cue["end"]
        linhas = _pack(texto, max_linha)
        blocos = ["\n".join(linhas[i:i + max_linhas])
                  for i in range(0, len(linhas), max_linhas)]
        total = sum(len(b) for b in blocos) or 1
        relogio = inicio
        for indice, bloco in enumerate(blocos):
            # A última página fecha exatamente no fim da cue: somar frações daria erro de
            # arredondamento acumulado e a legenda ficaria um piscar além da fala.
            termina = (fim if indice == len(blocos) - 1
                       else relogio + (fim - inicio) * (len(bloco) / total))
            paginas.append({"start": relogio, "end": termina, "text": bloco})
            relogio = termina
    return paginas


def _tempo(segundos):
    """Segundos -> `H:MM:SS.cc` do ASS. Negativo vira zero: o corte começa no 0."""
    centesimos = int(round(max(0.0, float(segundos)) * 100))
    horas, resto = divmod(centesimos, 360000)
    minutos, resto = divmod(resto, 6000)
    segs, cs = divmod(resto, 100)
    return "%d:%02d:%02d.%02d" % (horas, minutos, segs, cs)


def _escapa(texto):
    r"""Texto -> campo Text do ASS.

    `{}` abre bloco de override e `\` inicia comando: uma fala com chave viraria formatação
    invisível em vez de texto na tela. A nossa quebra de linha entra depois, como `\N`.
    """
    limpo = str(texto or "").replace("\\", "/").replace("{", "(").replace("}", ")")
    return limpo.replace("\r", "").replace("\n", "\\N")


def margem_inferior(altura, video_h=None, pct=None, topo=None):
    """MarginV do Alignment 2: distância da borda de BAIXO do quadro até a base do texto.

    PÚBLICA e dona ÚNICA da âncora vertical da legenda, nos dois renderizadores: o FFmpeg/ASS
    chama daqui (via `to_ass`) e o Remotion recebe o mesmo número pelo prop `legendaBase`,
    montado no `serve.render_props`. Não reimplemente esta conta em JS — duas fórmulas
    divergiriam e o mesmo corte sairia com a legenda em lugares diferentes, calado.

    A legenda é ancorada ao RETÂNGULO DO VÍDEO, não ao quadro de 1920 px. Num 16:9 dentro do
    9:16 o vídeo ocupa 607 px no meio do quadro (656 → 1263) — o antigo topo fixo em 66% da
    altura (1267 px) caía QUATRO pixels ABAIXO da imagem, ou seja, a legenda era escrita na
    tarja de fundo e não sobre o vídeo. Com a base calculada, ela sobe para dentro da imagem
    em qualquer proporção de fonte.

    `video_h` é a altura do vídeo VISÍVEL dentro do quadro (perfil `crop` ocupa o quadro
    inteiro; `blur` ocupa a caixa deitada). Ausente = ocupa tudo.

    `pct` é a INTENÇÃO vertical que o operador arrastou na prévia: onde a BASE do texto
    deve ficar, em % da altura do quadro contada do TOPO. Ausente = a âncora automática de
    sempre. É intenção e não âncora de propósito — quem transforma percentual em MarginV é
    esta função, aqui, e é ela que continua aplicando o teto da zona de botões do TikTok.
    Uma fórmula equivalente em JavaScript é exatamente o defeito que esta função existe
    para impedir (a legenda saía 61 px ABAIXO da imagem).

    MANUAL é LIVRE (decisão do usuário, 2026-09-28): o único limite duro é a página não sair
    do quadro — base entre `topo` (a base mais alta que ainda cabe 2 linhas, do
    `estilo_ass`) e a margem do quadro embaixo. A zona de botões do TikTok virou AVISO
    (`serve.legenda_geometria` diz quando a base entra nela), não trava. A AUTOMÁTICA continua
    fugindo dela exatamente como antes.
    """
    alt = int(altura)
    caixa = min(alt, int(video_h or alt))
    if pct is None:
        # Base do texto: um respiro acima da borda de baixo do vídeo...
        base = (alt + caixa) / 2.0 - caixa * RODAPE_PCT
        # ...mas nunca dentro da faixa de botões do TikTok/Reels, que é o que aconteceria no
        # perfil `crop`, em que a borda de baixo do vídeo É a borda de baixo da tela.
        base = min(base, alt * ZONA_UI_PCT)
    else:
        base = alt * (min(100.0, max(0.0, float(pct))) / 100.0)
        piso = MARGEM_LATERAL if topo is None else int(topo)
        base = min(alt - MARGEM_LATERAL, max(piso, base))
    return max(0, int(round(alt - base)))


# Limites da posicao LATERAL, os dois ja existentes no projeto (nenhum numero de zona segura
# inventado): 40 px e a margem que a coluna MAIS LARGA que o editor aceita (1000 num quadro
# de 1080) ja deixa de cada lado; 930 e onde comeca a trilha de botoes do TikTok, anotada ao
# lado do `legendaLargura` no TOKENS do preset.js.
MARGEM_LATERAL = 40
TRILHA_X = 930


# A coluna mais estreita que o editor aceita (`largura` 360..1000). So serve de piso quando o
# corte nao tem palavra nenhuma para medir.
COLUNA_MIN = 360


def _u16(texto):
    # Comprimento em unidades UTF-16, que e o `.length` do JavaScript: a paginacao do Remotion
    # conta assim, e o porte tem de contar igual (emoji vale 2 la).
    return len(texto.encode("utf-16-le")) // 2


def _face(familia, peso):
    return (familia, 800) if (familia, peso) not in AVANCO_CHAR else (familia, peso)


def largura_texto(texto, familia, peso, caixa, tamanho):
    """Largura estimada de `texto` (uma palavra) em px do quadro, pela `AVANCO_CHAR`. PURA."""
    face = _face(familia, peso)
    tabela = AVANCO_CHAR.get(face) or AVANCO_CHAR[("inter", 700)]
    maior = max(tabela)
    s = str(texto or "")
    if caixa:
        s = s.upper()
    total = 0
    for ch in s:
        i = AVANCO_ORDEM.find(ch)
        total += AVANCO_ESPACO.get(face, maior) if ch == " " else (tabela[i] if i >= 0 else maior)
    return total / 1000.0 * float(tamanho)


def palavra_mais_longa(cues, estilo):
    """(palavra, px) mais LARGA das falas do corte, no corpo/familia/caixa do estilo.

    Mede o TOKEN como ele e desenhado (pontuacao inclusa: "EMPREENDEDORES," e o que ocupa a
    linha). Sem palavra nenhuma: ("", 0.0).
    """
    melhor = ("", 0.0)
    for cue in normalize_cues(cues) if isinstance(cues, list) else []:
        for palavra in str(cue.get("text") or "").split():
            px = largura_texto(palavra, estilo["familia"], estilo["peso"], estilo["caixaAlta"],
                               estilo["tamanho"])
            if px > melhor[1]:
                melhor = (palavra.upper() if estilo["caixaAlta"] else palavra, px)
    return melhor


def linhas_da_pagina(texto, estilo, coluna):
    """Quantas linhas uma PAGINA ocupa na coluna, quebrando por palavra como o CSS. PURA.

    O Remotion corta a pagina por CARACTERES (`toCaptionPages`) e deixa o navegador quebrar
    a linha: uma palavra longa sozinha numa linha faz a pagina de "2 linhas" virar 3 (medido
    no still: "OS / EMPREENDEDORES, / QUE" no impacto). A guarda do topo precisa do numero
    de VERDADE. Folga de 1%: linha que encosta na coluna conta como cheia.
    """
    face = _face(estilo["familia"], estilo["peso"])
    espaco = AVANCO_ESPACO.get(face, 300) / 1000.0 * float(estilo["tamanho"])
    linhas, atual = 0, 0.0
    for palavra in str(texto or "").split():
        w = largura_texto(palavra, estilo["familia"], estilo["peso"], estilo["caixaAlta"],
                          estilo["tamanho"])
        if linhas and atual + espaco + w <= coluna * 0.99:
            atual += espaco + w
        else:
            linhas, atual = linhas + 1, w
    return linhas


def topo_das_paginas(estilo, paginas, coluna):
    """A base mais alta em que a pagina MAIS ALTA deste corte ainda cabe no quadro. PURA.

    Nunca menos que as 2 linhas do `estilo["topo"]` (sem paginas, a guarda de sempre)."""
    linhas = max([MAX_LINHAS] + [linhas_da_pagina(p.get("text"), estilo, coluna) for p in paginas])
    return MARGEM_LATERAL + int(math.ceil(linhas * estilo["tamanho"] * estilo["entrelinha"]))


def coluna_x(largura, coluna, pct=None, piso=None):
    """Intencao horizontal -> borda esquerda/direita e LARGURA da coluna, em px. PURA.

    Dona UNICA da posicao lateral nos dois renderizadores: o ASS usa `esquerda`/`direita`
    como MarginL/MarginR (o Alignment 2 centra entre as margens, entao o X sai exato) e o
    Remotion recebe `esquerda` e `largura` pelos props `legendaEsquerda`/`legendaColuna`,
    montados no `serve.render_props`.

    `pct` e o CENTRO da coluna em % da largura do quadro. Ausente = centralizada, com as
    duas margens iguais a `(largura - coluna) // 2` -- byte a byte o `to_ass` de sempre.

    COLUNA ELASTICA (decisao do usuario, 2026-09-28; substitui o grampo `borda`/`trilha`):
    com X manual, a coluna efetiva e a MAIS LARGA <= `coluna` que cabe centrada em X entre
    as margens do quadro (`MARGEM_LATERAL` dos dois lados). Andar para a borda ESTREITA a
    coluna (as linhas ficam mais curtas) em vez de parar; voltar para o centro a alarga ate
    `coluna`, que vira o MAXIMO do operador. Nunca abaixo de `piso` (a palavra mais longa,
    ja com a escala da palavra acesa -- ver `layout_legenda`): so quando nem o piso cabe e
    que o X para, e `grampeado` diz `palavra` (ou `borda`, sem palavra medida).
    A trilha de botoes do TikTok virou AVISO (`trilha`: a borda direita passou de `TRILHA_X`).
    `faixa` = (min, max) do `pct` inteiro em que o piso cabe, ou None quando nao ha curso.
    """
    quadro = int(largura)
    col = max(1, min(quadro, int(coluna)))
    centro = (quadro - col) // 2
    medido = bool(piso)
    p = int(math.ceil(piso)) if medido else min(col, COLUNA_MIN)
    p = max(1, min(p, quadro - 2 * MARGEM_LATERAL))
    lo_px, hi_px = MARGEM_LATERAL + p / 2.0, quadro - MARGEM_LATERAL - p / 2.0
    lo = int(math.ceil(lo_px / quadro * 100.0 - 1e-9))
    hi = int(math.floor(hi_px / quadro * 100.0 + 1e-9))
    faixa = (lo, hi) if lo < hi else None
    if pct is None:
        return {"esquerda": centro, "direita": centro, "largura": col, "piso": p,
                "faixa": faixa, "grampeado": None, "trilha": False, "estreitou": False}
    desejado = float(pct) / 100.0 * quadro
    cx = min(hi_px, max(lo_px, desejado))
    grampeado = None if abs(cx - desejado) < 1e-9 else ("palavra" if medido else "borda")
    cabe = int(math.floor(2 * min(cx - MARGEM_LATERAL, quadro - MARGEM_LATERAL - cx) + 1e-9))
    efetiva = min(cabe, max(p, min(col, cabe)))
    esquerda = int(math.floor(cx - efetiva / 2.0 + 0.5))
    esquerda = min(quadro - MARGEM_LATERAL - efetiva, max(MARGEM_LATERAL, esquerda))
    return {"esquerda": esquerda, "direita": quadro - efetiva - esquerda, "largura": efetiva,
            "piso": p, "faixa": faixa, "grampeado": grampeado,
            "trilha": esquerda + efetiva > TRILHA_X, "estreitou": efetiva < col}


def layout_legenda(estilo, cues, largura=OUT_W):
    """Estilo resolvido + falas do corte -> a coluna que os DOIS renderizadores usam. PURA.

    Uma chamada so para o ASS (`to_ass`) e para o Remotion (`serve.legenda_geometria`): o
    piso sai da palavra mais longa DESTE corte, no corpo/familia/caixa do estilo, vezes a
    escala da palavra acesa (`palavra_escala`) -- a palavra sendo dita cresce, e sem a
    escala ela passaria da margem do quadro encostada na borda. O teto de caracteres por
    linha acompanha a coluna EFETIVA (coluna mais estreita = linha mais curta).
    """
    palavra, px = palavra_mais_longa(cues, estilo)
    piso = int(math.ceil(px * float(estilo.get("palavra_escala") or 1.0))) if px else None
    col = coluna_x(largura, estilo["largura"], estilo.get("posicaoXPct"), piso)
    col["palavra"] = palavra
    col["max_linha"] = chars_por_linha(estilo["tamanho"],
                                       AVANCOS[(estilo["familia"], estilo["caixaAlta"])],
                                       col["largura"])
    return col


def _palavras_alinhadas(cue, texto):
    # Porte do `palavrasAlinhadas` do preset.js: as palavras so valem se a JUNCAO delas for
    # exatamente o texto da fala.
    lista = cue.get("words") if isinstance(cue, dict) else None
    if not isinstance(lista, list) or not lista:
        return None
    limpa = []
    for palavra in lista:
        if not palavra or not isinstance(palavra, dict):
            return None
        termo = re.sub(r"\s+", " ", str(palavra.get("text") or "")).strip()
        if not termo:
            return None
        limpa.append({"start": _numero(palavra.get("start")), "text": termo})
    return limpa if " ".join(p["text"] for p in limpa) == texto else None


def _numero(valor):
    # `Number(v) || 0` do JavaScript, para o que chega numa cue.
    if isinstance(valor, bool):
        return float(valor)
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return 0.0
    return n if n == n else 0.0


def paginas_remotion(cues, teto):
    """Porte PURO do `toCaptionPages(cues, teto)` do preset.js: as paginas que o MP4 mostra.

    Existe para a PREVIA mostrar a pagina do export (decisao do usuario, 2026-09-28). O
    `to_pages` acima e a paginacao do ASS e corta POR LINHA; o Remotion corta POR PAGINA de
    `teto` caracteres e usa a palavra do reconhecedor como atomo -- medido num corte real:
    28 x 30 paginas no classico, 97 x 83 no impacto a 360. O check 36p roda o node e compara
    este porte com o `toCaptionPages` de verdade; mexeu num, mexe no outro.
    Devolve `{start, end, text}` (sem as palavras: a previa nao anima).
    """
    paginas = []
    for cue in cues if isinstance(cues, list) else []:
        if not isinstance(cue, dict):
            continue
        texto = re.sub(r"\s+", " ", str(cue.get("text") or "")).strip()
        if not texto:
            continue
        inicio, fim = _numero(cue.get("start")), _numero(cue.get("end"))
        if not fim > inicio:
            continue
        com_tempo = _palavras_alinhadas(cue, texto)
        if com_tempo and any(_u16(p["text"]) > teto for p in com_tempo):
            com_tempo = None
        termos = [p["text"] for p in com_tempo] if com_tempo else texto.split(" ")
        blocos, contagens, atual, conta = [], [], "", 0
        for palavra in termos:
            tentativa = atual + " " + palavra if atual else palavra
            if _u16(tentativa) <= teto or not atual:
                atual, conta = tentativa, conta + 1
            else:
                blocos.append(atual)
                contagens.append(conta)
                atual, conta = palavra, 1
        if atual:
            blocos.append(atual)
            contagens.append(conta)
        fatias = [com_tempo[sum(contagens[:i])]["start"] for i in range(len(blocos))] \
            if com_tempo else None
        total = sum(_u16(b) for b in blocos) or 1
        relogio = inicio
        for indice, bloco in enumerate(blocos):
            fatia = (fim - inicio) * (_u16(bloco) / total)
            termina = fim if indice == len(blocos) - 1 \
                else (fatias[indice + 1] if fatias else relogio + fatia)
            paginas.append({"start": relogio, "end": termina, "text": bloco})
            relogio = termina
    return paginas


def to_ass(cues, largura=OUT_W, altura=OUT_H, video_h=None, estilo=None):
    """Cues JÁ rebaseadas para o corte -> documento ASS completo (str), ou '' se não há nada.

    Espera o relógio do CORTE (0 = primeiro quadro), que é o que `ytclip.cues_for_range`
    entrega. Passar cues no relógio do VÍDEO faz a legenda aparecer minutos depois do fim do
    clipe — ou seja, nunca.

    `video_h` é a altura, dentro do quadro de saída, do vídeo visível: é o que põe a legenda
    DENTRO da imagem em vez de na tarja de fundo (ver `margem_inferior`).

    `estilo` é o que o `estilo_ass()` resolveu (preset + ajuste manual). Ausente = o
    `classico`, byte a byte o documento que este módulo sempre gerou.

    Devolver '' quando não sobra página é o contrato: quem chama não deve gravar arquivo
    vazio nem pendurar um filtro `ass=` que não legenda nada.
    """
    e = estilo if isinstance(estilo, dict) else estilo_ass()
    # O teto de caracteres vem do ESTILO, não da constante: paginar com 25 e desenhar a 72px
    # em caixa alta é a linha estourando a coluna, sem erro nenhum — e é justamente a
    # divergência entre os dois renderizadores que esta entrega veio matar.
    # A coluna (e o teto de caracteres que sai dela) do MESMO dono do Remotion: com X manual
    # ela estreita perto da borda, e paginar com o teto da coluna cheia estouraria a margem.
    lay = layout_legenda(e, cues, largura)
    paginas = to_pages(cues, lay["max_linha"])
    if not paginas:
        return ""
    # Alignment 2 = base-centro. É de baixo para cima de propósito: com o texto pendurado
    # pelo TOPO (Alignment 8), uma página de duas linhas descia 68 px a mais que uma de uma
    # linha e vazava para fora do vídeo. Ancorado pela BASE, o pé da legenda fica no mesmo
    # lugar e é a página que cresce para cima.
    margem, margem_dir = max(0, lay["esquerda"]), max(0, lay["direita"])
    rodape = margem_inferior(altura, video_h, e["posicaoPct"], e.get("topo"))
    cabecalho = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: %d" % int(largura),
        "PlayResY: %d" % int(altura),
        # 2 = sem quebra automática. Quem quebra somos nós, no to_pages, com o mesmo
        # limite do editor Remotion.
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,"
        " BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,"
        " BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        # ScaleX/ScaleY ficam em 100: escalar glifo destacado foi medido e reprovado neste
        # projeto (a caixa de layout não acompanha e a palavra seguinte é comida).
        # Tres casos, e o de sempre (sem contorno, sem caixa) sai byte a byte igual:
        # caixa = BorderStyle 3 (o libass pinta a caixa na cor do OUTLINE e usa o Outline
        # como respiro; sem sombra, que sobre caixa e borrao); contorno = Outline visivel.
        "Style: Legenda,%s,%d,%s,%s,%s,%s,%d,0,0,0,100,100,0,0,%d,%d,%d,%d,%d,%d,%d,1"
        % ((e["fonte"], e["tamanho"], e["cor"], e["cor"])
           + ((e["fundo"], e["fundo"], -1 if e["negrito"] else 0, 3,
               max(1, int(round(e["tamanho"] * 0.18))), 0)
              if e.get("fundo") else
              (e["contorno"], SOMBRA_COR, -1 if e["negrito"] else 0, 1,
               e["contorno_px"], SOMBRA)
              if e.get("contorno") else
              ("&H00000000", SOMBRA_COR, -1 if e["negrito"] else 0, 1, CONTORNO, SOMBRA))
           + (e["alinhamento"], margem, margem_dir, rodape)),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    # A caixa alta é aplicada ao TEXTO porque o ASS não tem `text-transform`: o
    # `textTransform: uppercase` do Clip.jsx é CSS e não viaja para cá. Sem isto o mesmo
    # estilo sai em caixa alta num renderizador e em caixa baixa no outro.
    linhas = ["Dialogue: 0,%s,%s,Legenda,,0,0,0,,%s"
              % (_tempo(p["start"]), _tempo(p["end"]),
                 _escapa(p["text"].upper() if e["caixaAlta"] else p["text"]))
              for p in paginas]
    return "\n".join(cabecalho + linhas) + "\n"


# ------------------------------------------------------------------------------------------
# REMOVER TRECHOS DO MEIO (2026-09-30, decisão do usuário): DONO ÚNICO do mapa de tempo.
# Remoções chegam em ms da FONTE (`clip.edit.remocoes`), estritamente dentro do corte. Daqui saem
# os pedaços mantidos (que o `_cut_for_render` concatena num encode), a duração da saída e o
# remapeamento de falas, palavras, páginas da prévia, textos e zooms. Nenhuma fórmula de remapear
# existe em JS/JSX: a tela só PULA os trechos na prévia.
# As pontas caem na grade dos quadros da SAÍDA (espelho de `TOKENS.fps`, uma regra: round).
FPS_SAIDA = 30
REMOCAO_MIN_MS = 200
REMOCOES_MAX = 30
PEDACO_MIN_MS = 300


def mapa_saida(in_ms, out_ms, remocoes, fps=FPS_SAIDA):
    """`(in, out, [{deMs, ateMs}])` -> `{remocoes, pedacos, duracao_ms}`. PURA.

    Ordena, prende à grade, junta sobrepostas/encostadas, descarta a que toca a borda do corte
    (mover a borda é o gesto certo — a tela diz isso), a menor que `REMOCAO_MIN_MS` e a que
    deixaria um pedaço mantido menor que `PEDACO_MIN_MS`; no máximo `REMOCOES_MAX`. Sem remoção
    válida: um pedaço só, o corte inteiro.
    """
    passo = 1000.0 / fps
    grade = lambda t: in_ms + round((t - in_ms) / passo) * passo  # noqa: E731
    brutas = []
    for r in remocoes or []:
        try:
            de, ate = float(r["deMs"]), float(r["ateMs"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (math.isfinite(de) and math.isfinite(ate)) or ate <= de:
            continue
        de, ate = grade(de), grade(ate)
        if de <= in_ms or ate >= out_ms:
            continue
        brutas.append([de, ate])
    brutas.sort()
    juntas = []
    for de, ate in brutas:
        if juntas and de <= juntas[-1][1]:
            juntas[-1][1] = max(juntas[-1][1], ate)
        else:
            juntas.append([de, ate])
    aceitas, cursor = [], in_ms
    for de, ate in juntas:
        if len(aceitas) >= REMOCOES_MAX or ate - de < REMOCAO_MIN_MS - 1e-6:
            continue
        if de - cursor < PEDACO_MIN_MS - 1e-6 or out_ms - ate < PEDACO_MIN_MS - 1e-6:
            continue
        aceitas.append((round(de, 3), round(ate, 3)))
        cursor = ate
    pedacos, cursor = [], float(in_ms)
    for de, ate in aceitas:
        pedacos.append((round(cursor, 3), de))
        cursor = ate
    pedacos.append((round(cursor, 3), float(out_ms)))
    return {"remocoes": aceitas, "pedacos": pedacos,
            "duracao_ms": round(sum(b - a for a, b in pedacos), 3)}


def saida_de(mapa, ms):
    """ms da FONTE -> ms da SAÍDA, ou None se o instante foi removido (ou está fora do corte)."""
    acumulado = 0.0
    for a, b in mapa["pedacos"]:
        if a <= ms <= b:
            return acumulado + (ms - a)
        acumulado += b - a
    return None


def fonte_de(mapa, ms_saida):
    """ms da SAÍDA -> ms da FONTE (o inverso). É o que a prévia, que toca a FONTE, usa para
    achar a página — o site não tem fórmula de mapa."""
    # Na fronteira EXATA entre dois pedaços vence o começo do seguinte (é onde a página começa).
    acumulado = 0.0
    for a, b in mapa["pedacos"]:
        if ms_saida < acumulado + (b - a) - 1e-6:
            return a + max(0.0, ms_saida - acumulado)
        acumulado += b - a
    return mapa["pedacos"][-1][1]


def _mantido(mapa, de, ate):
    """O maior intervalo de [de, ate] (ms da fonte) que cai INTEIRO num pedaço mantido."""
    melhor = None
    for a, b in mapa["pedacos"]:
        x, y = max(a, de), min(b, ate)
        if y > x and (melhor is None or y - x > melhor[1] - melhor[0]):
            melhor = (x, y)
    return melhor


def remapear_cues(cues, mapa):
    """Falas em s RELATIVOS ao corte (como o render as recebe) -> no relógio da SAÍDA. PURA.

    Palavra inteira dentro de remoção SAI; palavra parcial é aparada ao pedaço mantido; o resto
    desloca. Fala com palavras é refeita a partir delas (o texto é a junção, como o karaokê
    exige); fala sem palavras vira o trecho entre o primeiro e o último instante mantidos.
    Sem remoção, devolve as falas como vieram.
    """
    if not mapa or not mapa["remocoes"]:
        return cues
    in_ms = mapa["pedacos"][0][0]
    fonte = lambda s: in_ms + float(s) * 1000.0  # noqa: E731
    saida = lambda ms: round(saida_de(mapa, ms) / 1000.0, 3)  # noqa: E731
    novas = []
    for cue in cues or []:
        if not isinstance(cue, dict):
            continue
        palavras = cue.get("words")
        if isinstance(palavras, list) and palavras:
            ficam = []
            for w in palavras:
                try:
                    parte = _mantido(mapa, fonte(w["start"]), fonte(w["end"]))
                except (KeyError, TypeError, ValueError):
                    parte = None
                if parte:
                    ficam.append(dict(w, start=saida(parte[0]), end=saida(parte[1])))
            if ficam:
                novas.append(dict(cue, start=ficam[0]["start"], end=ficam[-1]["end"],
                                  text=" ".join(str(w.get("text", "")) for w in ficam), words=ficam))
            continue
        try:
            de, ate = fonte(cue["start"]), fonte(cue["end"])
        except (KeyError, TypeError, ValueError):
            continue
        partes = [(max(a, de), min(b, ate)) for a, b in mapa["pedacos"] if min(b, ate) > max(a, de)]
        if partes:
            novas.append(dict(cue, start=saida(partes[0][0]), end=saida(partes[-1][1])))
    return novas


def paginas_na_fonte(paginas, mapa):
    """Cada página (relógio da SAÍDA) ganha `fonteStart`/`fonteEnd` (s relativos ao corte, na
    FONTE): a prévia toca a fonte pulando os trechos, e escolhe a página por estes números."""
    if not mapa or not mapa["remocoes"]:
        return paginas
    in_ms = mapa["pedacos"][0][0]
    rel = lambda ms: round((ms - in_ms) / 1000.0, 3)  # noqa: E731
    return [dict(p, fonteStart=rel(fonte_de(mapa, p["start"] * 1000.0)),
                 fonteEnd=rel(fonte_de(mapa, p["end"] * 1000.0))) for p in paginas]


def intervalos_saida(itens, mapa):
    """Itens com `deMs/ateMs` na FONTE (textos fixos, zooms) -> `(ficam, removidos)` no relógio
    da SAÍDA, em s relativos ao corte. PURA; o MESMO mapa das falas (`mapa_saida`, com ou sem
    remoção). Parcialmente removido = aparado ao que sobra (ele atravessa a junção contínuo);
    inteiramente removido = sai, e o id volta em `removidos` para a tela poder dizer."""
    ficam, removidos = [], []
    for it in itens or []:
        de, ate = float(it["deMs"]), float(it["ateMs"])
        partes = [(max(a, de), min(b, ate)) for a, b in mapa["pedacos"] if min(b, ate) > max(a, de)]
        if not partes:
            removidos.append(it.get("id"))
            continue
        saida = dict(it)
        saida["deSec"] = round(saida_de(mapa, partes[0][0]) / 1000.0, 3)
        saida["ateSec"] = round(saida_de(mapa, partes[-1][1]) / 1000.0, 3)
        ficam.append(saida)
    return ficam, removidos
