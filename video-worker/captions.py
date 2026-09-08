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
import os
import re

FONTE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
FONTE_ARQUIVO = "Inter-Bold.ttf"

# --- espelho de studio/src/preset.js TOKENS -------------------------------------------
FONTE = "Inter"
FONTE_TAMANHO = 58            # TOKENS.legendaFonte
NEGRITO = True                # TOKENS.legendaPeso = 700 -> Bold (o padrão pedido)
COR = "&H00FFFFFF"            # TOKENS.texto '#FFFFFF' no formato ASS &HAABBGGRR
LARGURA = 820                 # TOKENS.legendaLargura
MAX_CHARS_LINHA = 25          # preset.js MAX_CHARS_LINHA
MAX_LINHAS = 2                # preset.js MAX_LINHAS
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


def font_available():
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
    return os.path.isfile(os.path.join(FONTE_DIR, FONTE_ARQUIVO))


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


def margem_inferior(altura, video_h=None):
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
    """
    alt = int(altura)
    caixa = min(alt, int(video_h or alt))
    # Base do texto: um respiro acima da borda de baixo do vídeo...
    base = (alt + caixa) / 2.0 - caixa * RODAPE_PCT
    # ...mas nunca dentro da faixa de botões do TikTok/Reels, que é o que aconteceria no
    # perfil `crop`, em que a borda de baixo do vídeo É a borda de baixo da tela.
    base = min(base, alt * ZONA_UI_PCT)
    return max(0, int(round(alt - base)))


def to_ass(cues, largura=OUT_W, altura=OUT_H, video_h=None):
    """Cues JÁ rebaseadas para o corte -> documento ASS completo (str), ou '' se não há nada.

    Espera o relógio do CORTE (0 = primeiro quadro), que é o que `ytclip.cues_for_range`
    entrega. Passar cues no relógio do VÍDEO faz a legenda aparecer minutos depois do fim do
    clipe — ou seja, nunca.

    `video_h` é a altura, dentro do quadro de saída, do vídeo visível: é o que põe a legenda
    DENTRO da imagem em vez de na tarja de fundo (ver `margem_inferior`).

    Devolver '' quando não sobra página é o contrato: quem chama não deve gravar arquivo
    vazio nem pendurar um filtro `ass=` que não legenda nada.
    """
    paginas = to_pages(cues)
    if not paginas:
        return ""
    # Alignment 2 = base-centro. É de baixo para cima de propósito: com o texto pendurado
    # pelo TOPO (Alignment 8), uma página de duas linhas descia 68 px a mais que uma de uma
    # linha e vazava para fora do vídeo. Ancorado pela BASE, o pé da legenda fica no mesmo
    # lugar e é a página que cresce para cima.
    margem = max(0, (int(largura) - LARGURA) // 2)
    rodape = margem_inferior(altura, video_h)
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
        "Style: Legenda,%s,%d,%s,%s,&H00000000,%s,%d,0,0,0,100,100,0,0,1,%d,%d,2,%d,%d,%d,1"
        % (FONTE, FONTE_TAMANHO, COR, COR, SOMBRA_COR, -1 if NEGRITO else 0,
           CONTORNO, SOMBRA, margem, margem, rodape),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    linhas = ["Dialogue: 0,%s,%s,Legenda,,0,0,0,,%s"
              % (_tempo(p["start"]), _tempo(p["end"]), _escapa(p["text"]))
              for p in paginas]
    return "\n".join(cabecalho + linhas) + "\n"
