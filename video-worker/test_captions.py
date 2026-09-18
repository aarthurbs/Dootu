# -*- coding: utf-8 -*-
"""Provas da legenda queimada no 9:16. Sem rede, sem FFmpeg, sem YouTube.

O que este script prova (e falha alto se nao for verdade):
   1. linha do tempo   -> cue recortada no corte e com o relogio zerado no comeco dele
   2. lixo             -> duracao zero, texto vazio, borda encostada e numero invalido saem
   3. paginacao        -> no maximo 2 linhas por pagina, palavra nunca cortada no meio
   4. ASS              -> Inter Bold branca, centralizada, na posicao do preset
   5. escapes          -> chave e barra do ASS nao viram sintaxe
   6. paridade         -> os numeros sao os MESMOS do studio/src/preset.js (uma regra visual)
  10. por palavra      -> linha montada no limite da palavra, com duracao honesta

Uso:
    py -3.12 video-worker\\test_captions.py
"""

import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import captions  # noqa: E402
import ytclip  # noqa: E402

CHECKS = []


def check(label, ok):
    CHECKS.append((label, bool(ok)))


# --------------------------------------------------------------- 1. linha do tempo
# O caso EXATO do pedido: corte de 30s a 50s.
FONTE = [
    {"start": 25, "end": 32, "text": "entra pela borda de tras"},
    {"start": 35, "end": 38, "text": "inteira dentro do corte"},
    {"start": 48, "end": 55, "text": "sai pela borda da frente"},
    {"start": 60, "end": 65, "text": "depois do fim do corte"},
]
faixa = ytclip.cues_for_range(FONTE, 30.0, 50.0)
check("1a. tres falas sobrevivem ao corte 30-50", len(faixa) == 3)
check("1b. 25->32 vira 0->2 (recorta a ponta e zera o relogio)",
      (faixa[0]["start"], faixa[0]["end"]) == (0.0, 2.0))
check("1c. 35->38 vira 5->8 (so desloca)",
      (faixa[1]["start"], faixa[1]["end"]) == (5.0, 8.0))
check("1d. 48->55 vira 18->20 (recorta a ponta da frente)",
      (faixa[2]["start"], faixa[2]["end"]) == (18.0, 20.0))
check("1e. 60->65 NAO existe na saida",
      not any("depois do fim" in c["text"] for c in faixa))
check("1f. nenhum tempo negativo", all(c["start"] >= 0 for c in faixa))
check("1g. nada passa da duracao do corte", all(c["end"] <= 20.0 for c in faixa))

# Corte comecando no zero: o rebase e a identidade, nao um deslocamento a mais.
inicio_zero = ytclip.cues_for_range([{"start": 0, "end": 4, "text": "primeira fala"}], 0.0, 10.0)
check("1h. corte comecando em 0 nao desloca nada",
      (inicio_zero[0]["start"], inicio_zero[0]["end"]) == (0.0, 4.0))

# Borda encostada: uma fala que termina EXATAMENTE onde o corte comeca nao aparece.
encostada = ytclip.cues_for_range([{"start": 20, "end": 30, "text": "encosta e para"},
                                   {"start": 50, "end": 60, "text": "comeca no fim"}],
                                  30.0, 50.0)
check("1i. fala que so encosta na borda nao vira legenda de duracao zero", encostada == [])

# --------------------------------------------------------------- 2. lixo
paginas = captions.to_pages([
    {"start": 5, "end": 5, "text": "duracao zero"},
    {"start": 8, "end": 6, "text": "fim antes do inicio"},
    {"start": 1, "end": 3, "text": "   "},
    {"start": 1, "end": 3, "text": ""},
    {"start": None, "end": 3, "text": "sem inicio"},
    {"start": float("nan"), "end": 3, "text": "inicio NaN"},
    {"start": 0, "end": float("inf"), "text": "fim infinito"},
    {"start": "x", "end": "y", "text": "tempo que nao e numero"},
    "isto nao e um dict",
    None,
])
check("2a. cue de duracao zero nao vira pagina", not paginas)
check("2b. texto vazio/so espaco nao vira pagina", not paginas)
check("2c. NaN/infinito nao viram tempo (BP-004)", not paginas)
check("2d. entrada torta nao levanta excecao", isinstance(paginas, list))
check("2e. None e lista vazia sobrevivem",
      captions.to_pages(None) == [] and captions.to_pages([]) == [])

# --------------------------------------------------------------- 3. paginacao
LONGA = ("Faturamento nao e lucro e quem confunde os dois quebra a empresa "
         "em menos de dois anos sem perceber o que aconteceu")
pgs = captions.to_pages([{"start": 0, "end": 12, "text": LONGA}])
check("3a. fala longa vira varias paginas", len(pgs) > 1)
check("3b. NENHUMA pagina passa de 2 linhas",
      all(len(p["text"].split("\n")) <= captions.MAX_LINHAS for p in pgs))
check("3c. nenhuma linha passa do teto de caracteres",
      all(len(linha) <= captions.MAX_CHARS_LINHA
          for p in pgs for linha in p["text"].split("\n")))
check("3d. nenhuma palavra foi cortada no meio",
      " ".join(" ".join(p["text"].split("\n")) for p in pgs) == LONGA)
check("3e. as paginas cobrem o intervalo inteiro, sem buraco",
      pgs[0]["start"] == 0 and abs(pgs[-1]["end"] - 12) < 1e-9)
check("3f. e nao se sobrepoem nem andam para tras",
      all(pgs[i]["end"] <= pgs[i + 1]["start"] + 1e-9 for i in range(len(pgs) - 1)))
# Palavra sozinha maior que o teto passa inteira em vez de ser partida.
gigante = captions.to_pages([{"start": 0, "end": 2, "text": "A" * 60}])
check("3g. palavra maior que a linha nao e partida",
      bool(gigante) and gigante[0]["text"] == "A" * 60)

# --------------------------------------------------------------- 4. ASS
doc = captions.to_ass(faixa)
check("4a. o documento tem as tres secoes do ASS",
      "[Script Info]" in doc and "[V4+ Styles]" in doc and "[Events]" in doc)
check("4b. o quadro e 1080x1920", "PlayResX: 1080" in doc and "PlayResY: 1920" in doc)
check("4c. quebra automatica DESLIGADA (quem quebra e o to_pages)", "WrapStyle: 2" in doc)
estilo = [l for l in doc.splitlines() if l.startswith("Style: ")][0]
campos = estilo[len("Style: "):].split(",")
# O V4+ tem 23 colunas. Conferir a contagem ANTES dos indices: sem isto, uma coluna a mais
# ou a menos faz cada check abaixo ler o campo do vizinho e passar por engano.
formato = [l for l in doc.splitlines() if l.startswith("Format: Name")][0]
check("4c1. o Style tem as 23 colunas do V4+, na ordem do Format",
      len(campos) == 23 and len(formato[len("Format: "):].split(",")) == 23)
check("4d. a fonte e Inter", campos[1] == "Inter")
check("4e. o corpo e 58px (TOKENS.legendaFonte)", campos[2] == "58")
check("4f. a cor primaria e branca", campos[3] == "&H00FFFFFF")
check("4g. Bold ligado (-1 no ASS)", campos[7] == "-1")
check("4h. sem esticar glifo: ScaleX e ScaleY em 100",
      campos[11] == "100" and campos[12] == "100")
check("4i. sem contorno (o projeto proibe outline/glow decorativo)", campos[16] == "0")
check("4j. sombra de leitura ligada", campos[17] == "3")
check("4k. alinhamento 2 = base-centro (o pe do texto e que fica fixo)", campos[18] == "2")
check("4l. margens laterais deixam 820px uteis",
      campos[19] == "130" and campos[20] == "130" and 1080 - 2 * 130 == captions.LARGURA)
check("4m. sem saber o retangulo do video, o texto para acima da faixa de UI do TikTok",
      campos[21] == str(int(round(1920 * (1 - captions.ZONA_UI_PCT)))))

dialogos = [l for l in doc.splitlines() if l.startswith("Dialogue: ")]
check("4n. uma linha Dialogue por pagina", len(dialogos) == len(captions.to_pages(faixa)))
check("4o. o primeiro dialogo comeca no zero do CORTE",
      dialogos[0].split(",")[1] == "0:00:00.00")
check("4p. e o ultimo termina dentro do corte",
      dialogos[-1].split(",")[2] <= "0:00:20.00")
check("4q. nenhuma legenda comeca depois do fim do clipe",
      not any(d.split(",")[1] > "0:00:20.00" for d in dialogos))

# --------------------------------------------------------------- 5. escapes
sujo = captions.to_ass([{"start": 0, "end": 2, "text": "chave {b1} e barra \\ no meio"}])
eventos = sujo.split("[Events]")[1]
check("5a. chave vira parentese em vez de bloco de override",
      "{" not in eventos and "(b1)" in eventos)
check("5b. barra invertida solta nao vira comando", "\\ " not in eventos)
check("5c. a quebra de linha vira \\N (e nao um Dialogue partido ao meio)",
      "\\N" in captions.to_ass([{"start": 0, "end": 4, "text": LONGA}]))
check("5d. sem cue nenhuma o documento e vazio (nao um ASS oco)",
      captions.to_ass([]) == "" and captions.to_ass(None) == "")
check("5e. so lixo tambem devolve vazio",
      captions.to_ass([{"start": 1, "end": 1, "text": "zero"}]) == "")

# --------------------------------------------- 6. paridade com o editor Remotion
# Dois renderizadores (FFmpeg/ASS e Remotion) precisam concordar. Ler o preset.js aqui e o
# que faz um ajuste num lado FALHAR em vez de divergir calado.
PRESET = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "studio", "src", "preset.js")
fonte_js = io.open(PRESET, encoding="utf-8").read()


def do_js(padrao):
    achado = re.search(padrao, fonte_js)
    return achado.group(1) if achado else None


check("6a. legendaFonte casa", do_js(r"legendaFonte:\s*(\d+)") == str(captions.FONTE_TAMANHO))
check("6b. legendaLargura casa", do_js(r"legendaLargura:\s*(\d+)") == str(captions.LARGURA))
# A POSICAO vertical DIVERGIA de proposito ate 2026-08-27: o Remotion ancorava por
# PERCENTUAL de altura (legendaTopoPct = 66% = y 1267) e o ASS pela base do retangulo do
# video, entao o mesmo corte saia com a fala em lugares diferentes -- e, depois que a
# ampliacao de 1.45x do palco saiu (2026-08-26), o texto do Remotion caia 61px ABAIXO da
# imagem. A divergencia morreu: uma formula so, em Python, `captions.margem_inferior`, que o
# `serve.render_props` manda ao Remotion no prop `legendaBase`. Este check virou PARIDADE:
# o preset nao pode ter ancora propria de volta e a funcao tem de continuar publica -- se
# alguem a reprivatizar, o serve.py deixa de poder chamar e o Remotion volta a inventar posicao.
check("6c. a ancora e uma so: o preset nao tem `legendaTopoPct` e margem_inferior e publica",
      do_js(r"legendaTopoPct:\s*([\d.]+)") is None
      and callable(getattr(captions, "margem_inferior", None))
      and not hasattr(captions, "_margem_inferior"))
check("6d. MAX_CHARS_LINHA casa",
      do_js(r"MAX_CHARS_LINHA\s*=\s*(\d+)") == str(captions.MAX_CHARS_LINHA))
check("6e. MAX_LINHAS casa", do_js(r"MAX_LINHAS\s*=\s*(\d+)") == str(captions.MAX_LINHAS))
check("6f. peso 700 = Bold", do_js(r"legendaPeso:\s*(\d+)") == "700" and captions.NEGRITO)
check("6g. a cor do texto e a mesma",
      (do_js(r"texto:\s*'(#[0-9A-Fa-f]{6})'") or "").upper() == "#FFFFFF")
# O preset guarda UMA copia em JS de um numero cujo dono e este modulo: o fallback da ancora
# (`LEGENDA_BASE_PADRAO`), usado quando o Remotion Studio abre a composicao sem servidor. Sem
# este check, trocar o RODAPE_PCT aqui deixava as cinco suites verdes com o preview numa
# posicao obsoleta -- o mesmo erro mudo que o resto do bloco 6 existe para impedir.
check("6h. o fallback da ancora no preset.js e o numero de uma fonte 16:9 deste modulo",
      do_js(r"LEGENDA_BASE_PADRAO\s*=\s*(\d+)")
      == str(captions.margem_inferior(1920, int(round(1080 * 9 / 16)))))

# --------------------------------------------- 7. deteccao de fonte (o libass troca calado)
check("7a. font_available devolve bool e nao levanta",
      isinstance(captions.font_available(), bool))
# A fonte vai EMPACOTADA no repo e o libass a recebe por fontsdir. Sem o arquivo, ele troca
# calado -- medido com -loglevel info: `fontselect: (Inter, 700, 0) -> Arial-BoldMT`.
check("7b. o arquivo da fonte empacotada esta no repositorio",
      os.path.isfile(os.path.join(captions.FONTE_DIR, captions.FONTE_ARQUIVO)))
# Polaridade: sem isto, `return True` passaria no 7a e no 7b.
_guardado = captions.FONTE_ARQUIVO
captions.FONTE_ARQUIVO = "nao-existe-esta-fonte.ttf"
check("7c. font_available e False quando o arquivo nao esta la", captions.font_available() is False)
captions.FONTE_ARQUIVO = _guardado


def _familia_ttf(caminho):
    """Nome da familia (name ID 1) declarado DENTRO do arquivo de fonte.

    O nome do ARQUIVO nao serve como prova: medido no release oficial da Inter, o
    `Inter-Bold.ttf` se declara familia "Inter" (o que o libass casa com `(Inter, 700)`), mas
    o `Inter-ExtraBold.ttf` se declara familia "Inter ExtraBold" -- e com ele no lugar o
    libass cairia em Arial CALADO, exatamente o defeito que a fonte empacotada mata. Por isso
    este check le a tabela `name`, com struct do stdlib, e nao o nome do arquivo.
    """
    import struct
    dados = open(caminho, "rb").read()
    qtd, = struct.unpack(">H", dados[4:6])
    tabelas = {}
    for i in range(qtd):
        off = 12 + i * 16
        o, l = struct.unpack(">II", dados[off + 8:off + 16])
        tabelas[dados[off:off + 4].decode("latin1")] = (o, l)
    o = tabelas["name"][0]
    conta, stroff = struct.unpack(">HH", dados[o + 2:o + 6])
    for i in range(conta):
        rec = o + 6 + i * 12
        plat, enc, _lang, nid, ln, so = struct.unpack(">HHHHHH", dados[rec:rec + 12])
        if nid != 1:
            continue
        cru = dados[o + stroff + so:o + stroff + so + ln]
        try:
            return cru.decode("utf-16-be") if (plat, enc) in ((0, 3), (3, 1), (0, 4)) else cru.decode("latin1")
        except Exception:
            continue
    return None


_fam = _familia_ttf(os.path.join(captions.FONTE_DIR, captions.FONTE_ARQUIVO))
check("7d. a familia declarada no arquivo e exatamente %r (nao %r)" % (captions.FONTE, _fam),
      _fam == captions.FONTE)
# As checagens antigas deste bloco exercitavam o `font_installed(nome)`, que varria as pastas
# de fonte do Windows casando por prefixo FECHADO -- inclusive o caso de "Interstate" nao
# passar por "Inter". Sairam junto com a funcao: a fonte deixou de ser procurada na maquina e
# passou a viajar no repositorio, entao nao ha mais nome de terceiro para casar errado.
print("  nota  fonte empacotada: %s (%s)"
      % (captions.FONTE_ARQUIVO, "presente" if captions.font_available() else "AUSENTE"))


# -------------------------------------- 8. sobreposicao (o defeito visto no video)
# O caso EXATO relatado: por volta de 13,25 s do clipe a legenda anterior ainda estava na
# tela quando a proxima comecou, e os dois textos apareceram empilhados na mesma regiao.
A_B = [
    {"start": 10.0, "end": 14.0, "text": "Finalmente saiu o escritorio"},   # A
    {"start": 13.25, "end": 17.0, "text": "e a gente comecou a faturar"},   # B comeca com A no ar
]
norm = captions.normalize_cues(A_B)
check("8a. as duas falas sobrevivem (nenhuma e descartada por sobrepor)", len(norm) == 2)
check("8b. o fim de A passa a ser o comeco de B", norm[0]["end"] == 13.25)
check("8c. fim de A <= comeco de B", norm[0]["end"] <= norm[1]["start"])
check("8d. o comeco de A e o fim de B nao foram tocados",
      norm[0]["start"] == 10.0 and norm[1]["end"] == 17.0)
check("8e. o texto nao foi inventado nem juntado",
      norm[0]["text"] == A_B[0]["text"] and norm[1]["text"] == A_B[1]["text"])


def _tempo_para_seg(campo):
    horas, minutos, segundos = campo.split(":")
    return int(horas) * 3600 + int(minutos) * 60 + float(segundos)


def _eventos(documento):
    saida = []
    for linha in documento.splitlines():
        if not linha.startswith("Dialogue: "):
            continue
        partes = linha[len("Dialogue: "):].split(",", 9)
        saida.append((_tempo_para_seg(partes[1]), _tempo_para_seg(partes[2]), partes[9]))
    return saida


def _sem_simultaneas(documento):
    """Nenhum instante da linha do tempo pode ter duas legendas no ar."""
    eventos = _eventos(documento)
    for anterior, seguinte in zip(eventos, eventos[1:]):
        if anterior[1] > seguinte[0]:
            return False
    return True


doc_ab = captions.to_ass(A_B)
check("8f. o ASS sai com os eventos em ordem e sem sobreposicao", _sem_simultaneas(doc_ab))
check("8g. nenhum evento do ASS comeca antes do fim do anterior",
      _eventos(doc_ab)[0][1] <= _eventos(doc_ab)[1][0])

# Empate: duas falas comecando no MESMO instante. Nao pode sair as duas AO MESMO TEMPO na
# tela, e a escolha tem de ser sempre a mesma (a saida vira arquivo, e arquivo e comparado).
# ATE 2026-08-28 este bloco exigia `len(um) == 1`, ou seja UMA fala sobrevivendo -- e era
# esse o defeito: quando as duas falas sao DIFERENTES, descartar uma apagava frase inteira,
# calado. Medido com tres falas de podcast: 22 palavras viravam 14 (-36%), e
# "eu perdi quarenta mil reais no primeiro ano" desaparecia. Agora empate de falas diferentes
# REPARTE o intervalo; so a reescrita da ASR (prefixo) e que colapsa. Ver `_resolve_empate`.
EMPATE = [{"start": 5.0, "end": 8.0, "text": "primeira escrita"},
          {"start": 5.0, "end": 9.0, "text": "segunda escrita"}]
um = captions.normalize_cues(EMPATE)
outro = captions.normalize_cues(list(reversed(EMPATE)))
check("8h. empate de falas DIFERENTES nao perde texto (as duas ficam)",
      [c["text"] for c in um] == ["primeira escrita", "segunda escrita"])
check("8h2. e elas nao ficam na tela ao mesmo tempo",
      all(a["end"] <= b["start"] for a, b in zip(um, um[1:])))
check("8h3. o intervalo repartido cobre o mesmo trecho, sem buraco no meio",
      um[0]["start"] == 5.0 and um[-1]["end"] == 9.0
      and um[0]["end"] == um[1]["start"])
check("8i. e a escolha nao depende da ordem de entrada", um == outro)
# A reescrita da ASR CONTINUA colapsando: "eu acho" -> "eu acho que sim" e a MESMA fala
# sendo digitada, nao duas. E o que a regra do empate existia para resolver.
check("8i2. reescrita por prefixo colapsa na versao mais completa",
      [c["text"] for c in captions.normalize_cues(
          [{"start": 1.0, "end": 3.0, "text": "eu acho"},
           {"start": 1.0, "end": 3.5, "text": "eu acho que sim"}])] == ["eu acho que sim"])
# Intervalo que nao cabe uma fala legivel para cada: junta os textos numa so, nunca apaga.
_apertado = captions.normalize_cues(
    [{"start": 0.0, "end": 0.08, "text": "duas"}, {"start": 0.0, "end": 0.08, "text": "falas"}])
check("8i3. intervalo apertado junta os textos em vez de apagar um",
      len(_apertado) == 1 and _apertado[0]["text"] == "duas falas")

# Cadeia rolante inteira (o formato tipico da legenda automatica do YouTube).
ROLANTE = [{"start": float(i), "end": i + 2.5, "text": "linha %d" % i} for i in range(10)]
rolou = captions.normalize_cues(ROLANTE)
check("8j. cadeia rolante de 10 falas nao perde nenhuma", len(rolou) == 10)
check("8k. e nenhuma delas fica no ar depois do comeco da seguinte",
      all(a["end"] <= b["start"] for a, b in zip(rolou, rolou[1:])))
check("8l. o ASS da cadeia rolante tambem sai sem simultaneas",
      _sem_simultaneas(captions.to_ass(ROLANTE)))

# Sobreposicao que engole a fala anterior: sobra menos que o piso de leitura, entao ela nao
# pode aparecer sozinha. ATE 2026-08-28 ela era DESCARTADA ("buraco curto e melhor que
# piscada") -- e isso apagava texto tambem: com legenda rolante o corte encurta muita fala, e
# cada descarte levava as palavras junto. Agora o texto dela entra na fala seguinte: pagina
# mais longa e o preco de nao perder o que foi dito.
ENGOLIDA = [{"start": 4.0, "end": 9.0, "text": "quase nao aparece"},
            {"start": 4.02, "end": 9.0, "text": "a que fica"}]
_engolida = captions.normalize_cues(ENGOLIDA)
check("8m. fala engolida nao pisca E nao perde o texto",
      len(_engolida) == 1 and _engolida[0]["text"] == "quase nao aparece a que fica")
check("8m2. e o que sobra comeca onde a fala que engoliu comecava",
      _engolida[0]["start"] == 4.02 and _engolida[0]["end"] == 9.0)

# Idempotencia: normalizar de novo nao muda nada (o to_pages chama por dentro).
check("8n. normalizar duas vezes da o mesmo resultado",
      captions.normalize_cues(rolou) == rolou)
# Rebase + sobreposicao juntos: o caminho real (sidecar -> cues_for_range -> ASS).
pelo_recorte = ytclip.cues_for_range(A_B, 8.0, 20.0)
check("8o. o caminho real (cues_for_range) tambem chega sem sobreposicao",
      len(pelo_recorte) == 2 and pelo_recorte[0]["end"] <= pelo_recorte[1]["start"]
      and pelo_recorte[0]["end"] == 5.25)

# -------------------------------------- 9. posicao presa ao retangulo do video
# 16:9 dentro do 9:16: o video ocupa 607px no meio do quadro (de 656 a 1263).
VIDEO_16_9 = int(round(1080 * 9 / 16))
doc_video = captions.to_ass(faixa, video_h=VIDEO_16_9)
estilo_v = [l for l in doc_video.splitlines() if l.startswith("Style: ")][0]
margem_v = int(estilo_v[len("Style: "):].split(",")[21])
base_texto = 1920 - margem_v
fundo_video = (1920 + VIDEO_16_9) / 2.0
topo_video = (1920 - VIDEO_16_9) / 2.0
check("9a. a base do texto fica DENTRO do video (o defeito era cair 4px abaixo dele)",
      base_texto < fundo_video)
check("9b. e no terco de baixo dele, nao no meio",
      base_texto > topo_video + VIDEO_16_9 * 0.6)
check("9c. o respiro ate a borda de baixo do video e o RODAPE_PCT",
      abs((fundo_video - base_texto) - VIDEO_16_9 * captions.RODAPE_PCT) < 1)
check("9d. duas linhas ainda cabem acima da borda de baixo",
      base_texto - 2 * captions.FONTE_TAMANHO * 1.18 > topo_video)
# Perfil crop: o video ocupa o quadro inteiro e o limite passa a ser a interface do TikTok.
margem_crop = captions.margem_inferior(1920, 1920)
check("9e. no crop o texto para acima da faixa de botoes do TikTok",
      1920 - margem_crop <= 1920 * captions.ZONA_UI_PCT + 1)
check("9f. video mais alto que o quadro nao empurra o texto para fora",
      captions.margem_inferior(1920, 5000) == margem_crop)


# ------------------------------- 10. linha montada por PALAVRA (duracao honesta)
# `cues_from_words` existe porque a legenda automatica do YouTube nao entrega FALA, entrega
# uma janela rolante: o texto do evento aparece pelo passo entre eventos (1,84 s medido num
# podcast de 53 min) e a quebra de pagina cai no limite do reconhecedor. Com o tempo por
# palavra (`ytclip.parse_json3_words`) a linha comeca na primeira palavra dela e acaba na
# ultima -- entao ela NAO pode se sobrepor a seguinte, e o `normalize_cues` nao tem o que
# truncar. Tudo aqui e valor construido: a funcao e pura.
PALAVRAS = [
    {"start": 0.0, "end": 0.30, "text": "eu"},
    {"start": 0.30, "end": 0.62, "text": "perdi"},
    {"start": 0.62, "end": 0.95, "text": "quarenta"},
    {"start": 0.95, "end": 1.30, "text": "mil"},
    {"start": 1.30, "end": 1.70, "text": "reais"},
    {"start": 1.70, "end": 2.10, "text": "no"},
    {"start": 2.10, "end": 2.50, "text": "primeiro"},
    # `end` = inicio da palavra seguinte, que e o que o `parse_json3_words` produz: o json3
    # so da instante de INICIO. Por isso "ano." vai nominalmente ate 4,10 -- e e o rabo de
    # linha que a tira da tela antes disso (10f).
    {"start": 2.50, "end": 4.10, "text": "ano."},
    # Pausa de 1,6 s entre "ano." e "depois" -- acima do PAUSA_LINHA_SEC: e respiracao, e a
    # linha fecha aqui.
    {"start": 4.10, "end": 4.50, "text": "depois"},
    {"start": 4.50, "end": 4.90, "text": "eu"},
    {"start": 4.90, "end": 5.60, "text": "aprendi"},
]
linhas = captions.cues_from_words(PALAVRAS)
check("10a. a linha comeca no inicio da PRIMEIRA palavra dela",
      linhas and linhas[0]["start"] == 0.0)
check("10b. nenhuma linha se sobrepoe a seguinte (por construcao, nao por conserto)",
      all(linhas[i]["end"] <= linhas[i + 1]["start"] + 1e-9 for i in range(len(linhas) - 1)))
check("10c. nenhuma palavra ficou pelo caminho",
      " ".join(l["text"] for l in linhas) == " ".join(p["text"] for p in PALAVRAS))
check("10d. toda linha cabe no teto do editor (2 linhas de 25)",
      all(len(captions._pack(l["text"], captions.MAX_CHARS_LINHA)) <= captions.MAX_LINHAS
          for l in linhas))
check("10e. o ponto final fecha a linha: 'ano.' nao divide pagina com 'depois'",
      all(not (l["text"].endswith("ano.") and "depois" in l["text"]) for l in linhas))
# O RABO da linha: com pausa de 1,2 s depois de "ano.", a linha sai da tela 0,7 s depois do
# inicio da ultima palavra dela em vez de ficar pendurada ate a proxima palavra. Medido no
# arquivo real: a maior pausa entre palavras e de 8,5 s -- oito segundos de frase parada na
# tela e lixo, e o `normalize_cues` nao pega isso porque nao ha sobreposicao nenhuma.
antes_da_pausa = [l for l in linhas if l["text"].rstrip().endswith("ano.")][0]
check("10f. a linha antes da pausa nao fica pendurada ate a palavra seguinte",
      abs(antes_da_pausa["end"] - (2.50 + captions.PAUSA_LINHA_SEC)) < 1e-9)
check("10g. e a linha seguinte comeca na palavra dela, nao onde a outra parou",
      any(abs(l["start"] - 4.10) < 1e-9 for l in linhas))

# Pausa como BOTAO DE CALIBRAGEM: com o limiar frouxo a pausa de 1,2 s deixa de quebrar.
frouxo = captions.cues_from_words(PALAVRAS[8:], pausa=5.0)
apertado = captions.cues_from_words(PALAVRAS[:8], pausa=0.1)
check("10h. limiar frouxo junta o que o limiar padrao separaria", len(frouxo) == 1)
check("10i. limiar apertado pica a frase (e por isso o padrao e o p90 medido, 0,7 s)",
      len(apertado) > len(captions.cues_from_words(PALAVRAS[:8])))

# O teto e conferido com o `_pack` de verdade, nunca por contagem de caracteres: 50
# caracteres podem render TRES linhas de 25 dependendo de onde caem os espacos, e o ASS nao
# quebra sozinho (WrapStyle 2).
compridas = captions.cues_from_words(
    [{"start": i * 0.4, "end": i * 0.4 + 0.4, "text": "faturamento"} for i in range(8)])
check("10j. palavra comprida em serie quebra em pagina de 2 linhas, sem cortar palavra",
      all(len(captions._pack(l["text"], captions.MAX_CHARS_LINHA)) <= captions.MAX_LINHAS
          for l in compridas) and len(compridas) == 2)

# Lixo e degenerado: nada de tempo inventado e nada de excecao.
check("10k. lista vazia, None e nao-dicionario devolvem lista vazia",
      captions.cues_from_words([]) == [] and captions.cues_from_words(None) == []
      and captions.cues_from_words(["nao sou dicionario", 7]) == [])
check("10l. palavra sem texto, sem inicio ou com tempo ilegivel sai fora",
      captions.cues_from_words([{"start": 0.0, "end": 1.0, "text": "   "},
                                {"start": None, "end": 1.0, "text": "sem inicio"},
                                {"start": float("nan"), "end": 1.0, "text": "nan"}]) == [])
check("10m. palavra sem fim legivel nao vira tempo inventado, e a linha ainda e legivel",
      captions.cues_from_words([{"start": 3.0, "text": "sozinha"}])[0]["end"]
      >= 3.0 + captions.MIN_CUE_SEC)

# A paginacao nao reparte de novo o que ja cabe: se repartisse, o tempo honesto da linha
# viraria fatia proporcional ao numero de caracteres -- que e justamente o que este caminho
# deixa de fazer.
check("10n. to_pages nao reparte linha que ja cabe em 2 linhas",
      len(captions.to_pages(linhas)) == len(linhas))
check("10o. e o ASS sai com uma Dialogue por linha",
      len([l for l in captions.to_ass(linhas).splitlines()
           if l.startswith("Dialogue:")]) == len(linhas))


# ------------------------- 11. o tempo por PALAVRA segue junto da linha (karaoke)
# A linha de exibicao ja era montada a partir das palavras (bloco 10); o que mudou e que ela
# passou a CARREGAR essas palavras. Quem consome e o Remotion (`preset.activeWordIndex`), que
# acende a palavra sendo dita. Nada aqui e recalculado: e a mesma grade, anexada.
#
# O ASS NAO ganhou animacao neste pedido, e isto e provado (11f): a presenca da chave `words`
# nao muda um byte do documento. Se um dia alguem portar o karaoke para o libass, e este check
# que vai reprovar -- de proposito.
LINHAS_P = captions.cues_from_words(PALAVRAS)
check("11a. cada linha carrega as palavras que a montaram",
      all(isinstance(l.get("words"), list) and l["words"] for l in LINHAS_P))
check("11b. juntar as palavras da linha reproduz o texto dela, byte a byte",
      all(" ".join(w["text"] for w in l["words"]) == l["text"] for l in LINHAS_P))
check("11c. o tempo da linha e o da primeira e da ultima palavra dela",
      all(abs(l["words"][0]["start"] - l["start"]) < 1e-9 for l in LINHAS_P))
check("11d. as palavras de uma linha sao monotonicas e nao se sobrepoem",
      all(l["words"][i]["end"] <= l["words"][i + 1]["start"] + 1e-9
          for l in LINHAS_P for i in range(len(l["words"]) - 1)))
check("11e. normalize_cues passa `words` adiante (a chave sobrevive a limpeza)",
      [c.get("words") for c in captions.normalize_cues(LINHAS_P)]
      == [l["words"] for l in LINHAS_P])
SEM_WORDS = [{"start": l["start"], "end": l["end"], "text": l["text"]} for l in LINHAS_P]
check("11f. o ASS sai IDENTICO com e sem tempo por palavra (o libass nao ganhou animacao)",
      captions.to_ass(LINHAS_P) == captions.to_ass(SEM_WORDS))
check("11g. e o to_pages tambem ignora a chave (paginacao inalterada)",
      captions.to_pages(LINHAS_P) == captions.to_pages(SEM_WORDS))
check("11h. cue SEM a chave nao ganha uma vazia (corte antigo continua estatico)",
      all("words" not in c for c in captions.normalize_cues(SEM_WORDS)))
check("11i. `words` que nao e lista, ou vazio, e ignorado em vez de virar chave torta",
      all("words" not in c for c in captions.normalize_cues(
          [{"start": 0, "end": 1, "text": "a", "words": "x"},
           {"start": 2, "end": 3, "text": "b", "words": []},
           {"start": 4, "end": 5, "text": "c", "words": None}])))
# A regra 5 do normalize_cues (a fala encurtada entra na seguinte) JUNTA texto -- entao as
# palavras tem de ser juntadas junto, ou o karaoke acenderia a palavra errada no resto da
# linha. So quando as DUAS tinham: lista cobrindo metade do texto e pior que nenhuma.
CURTA = [{"start": 0.0, "end": 5.0, "text": "primeira",
          "words": [{"start": 0.0, "end": 5.0, "text": "primeira"}]},
         {"start": 0.02, "end": 3.0, "text": "segunda",
          "words": [{"start": 0.02, "end": 3.0, "text": "segunda"}]}]
JUNTAS = captions.normalize_cues(CURTA)
check("11j. regra 5 juntou o texto das duas falas", len(JUNTAS) == 1
      and JUNTAS[0]["text"] == "primeira segunda")
check("11k. e juntou as palavras das duas, na ordem do texto",
      [w["text"] for w in JUNTAS[0].get("words") or []] == ["primeira", "segunda"])
MEIA = captions.normalize_cues([dict(CURTA[0]),
                                {"start": 0.02, "end": 3.0, "text": "segunda"}])
check("11l. se SO uma tinha palavras, a juncao sai SEM a chave (meia verdade nao acende nada)",
      len(MEIA) == 1 and "words" not in MEIA[0])
# Empate de inicio que o _resolve_empate REPARTE em fatias: o texto continua o mesmo, mas o
# tempo de cada fala mudou -- as palavras da grade original nao descrevem mais aquelas fatias.
EMPATE = captions.normalize_cues(
    [{"start": 1.0, "end": 4.0, "text": "eu perdi quarenta mil reais",
      "words": [{"start": 1.0, "end": 4.0, "text": "eu perdi quarenta mil reais"}]},
     {"start": 1.0, "end": 4.0, "text": "e demorei tres anos para voltar",
      "words": [{"start": 1.0, "end": 4.0, "text": "e demorei tres anos para voltar"}]}])
check("11m. empate repartido em fatias descarta as palavras (o tempo delas deixou de valer)",
      len(EMPATE) == 2 and all("words" not in c for c in EMPATE)
      and sorted(c["text"] for c in EMPATE) == ["e demorei tres anos para voltar",
                                                "eu perdi quarenta mil reais"])
check("11n. reescrita da ASR colapsa e mantem as palavras da versao mais completa", (lambda r: (
      len(r) == 1 and r[0]["text"] == "eu acho que sim"
      and [w["text"] for w in r[0].get("words") or []] == ["eu", "acho", "que", "sim"]))(
      captions.normalize_cues([
          {"start": 1.0, "end": 3.0, "text": "eu acho",
           "words": [{"start": 1.0, "end": 1.4, "text": "eu"},
                     {"start": 1.4, "end": 3.0, "text": "acho"}]},
          {"start": 1.0, "end": 3.0, "text": "eu acho que sim",
           "words": [{"start": 1.0, "end": 1.4, "text": "eu"},
                     {"start": 1.4, "end": 1.9, "text": "acho"},
                     {"start": 1.9, "end": 2.3, "text": "que"},
                     {"start": 2.3, "end": 3.0, "text": "sim"}]}])))
check("11o. acento e pontuacao passam intactos pela linha e pelas palavras dela", (lambda l: (
      l[0]["text"] == "Prejuízo não é lição."
      and [w["text"] for w in l[0]["words"]]
      == ["Prejuízo", "não", "é", "lição."]))(
      captions.cues_from_words([
          {"start": 0.0, "end": 0.4, "text": "Prejuízo"},
          {"start": 0.4, "end": 0.7, "text": "não"},
          {"start": 0.7, "end": 0.9, "text": "é"},
          {"start": 0.9, "end": 1.4, "text": "lição."}])))

# ------------------- 12. artefato do reconhecedor nao chega na tela (e nao move relogio)
# O defeito relatado: ">> Ta bom." e "[__]" queimados no 9:16. Sao marcadores que o
# reconhecedor escreve -- troca de falante e censura de palavrao -- e ninguem falou.
# Os checks CHAMAM as funcoes com valor construido, nunca procuram texto no fonte: em
# 2026-08-26 e de novo em 2026-08-27 assercao sobre o TEXTO do arquivo deixou sabotagem
# passar com a suite verde ("`in arquivo` so prova que alguem escreveu a palavra").
TABELA_ARTEFATO = [
    (">> Tá bom.", "Tá bom."),
    (">>Tá bom.", "Tá bom."),
    ("[__]", ""),
    ("[__] Tá bom.", "Tá bom."),
    ("Tá bom. [__]", "Tá bom."),
    ("Tá bom.", "Tá bom."),
    # A forma que o YouTube escreve de verdade, com espacos dentro dos colchetes.
    ("[ __ ]", ""),
    (">> fulano", "fulano"),
]
for _entrada, _esperado in TABELA_ARTEFATO:
    check("12a. strip_artifacts(%r) == %r" % (_entrada, _esperado),
          captions.strip_artifacts(_entrada) == _esperado)

# Conservador: o que NAO e artefato provado fica. Uma regra que apagasse isto estaria
# "modificando texto normal de forma agressiva", que e o que o pedido proibe.
for _intacto in ['Eu falei: "tá bom"', "[Música]", "[Aplausos]", "Custou R$ 40.000,00",
                 "E aí? > isso mesmo", "3 > 2 e 2 < 3", "Fatura_mento", "…e então"]:
    check("12b. texto legitimo passa intacto: %r" % _intacto,
          captions.strip_artifacts(_intacto) == " ".join(_intacto.split()))

check("12c. idempotente: limpar duas vezes da o mesmo (o espaco impede 'a>[__]>b' virar "
      "'a>>b' e ressuscitar o artefato)",
      all(captions.strip_artifacts(captions.strip_artifacts(t))
          == captions.strip_artifacts(t)
          for t in [">> a", "a>[__]>b", ">>>> x", "[ ___ ]", "a >> b >> c"]))

# --- o caso do pedido, palavra por palavra: o segmento vazio vira BURACO ------------
GAP_FONTE = [{"start": 10.0, "end": 11.2, "text": "Eu comecei"},
             {"start": 11.2, "end": 11.8, "text": "[__]"},
             {"start": 11.8, "end": 13.0, "text": "a trabalhar cedo"}]
GAP = captions.normalize_cues(GAP_FONTE)
check("12d. o segmento que era so artefato NAO vira legenda", len(GAP) == 2)
check("12e. nenhum artefato sobrou no texto",
      not any(">>" in c["text"] or "__" in c["text"] for c in GAP))
check("12f. a fala anterior NAO foi esticada (11.2, o fim que ela ja tinha)",
      GAP[0]["start"] == 10.0 and GAP[0]["end"] == 11.2)
check("12g. a proxima fala NAO foi puxada para tras (comeca em 11.8, como no original)",
      GAP[1]["start"] == 11.8 and GAP[1]["end"] == 13.0)
check("12h. o texto das vizinhas nao foi tocado nem trocado de lugar",
      [c["text"] for c in GAP] == ["Eu comecei", "a trabalhar cedo"])
check("12i. o intervalo 11.2-11.8 ficou SEM legenda (buraco de verdade, 0,6 s)",
      not any(c["start"] < 11.8 and c["end"] > 11.2 for c in GAP))
check("12j. o artefato tambem nao foi copiado, resumido nem inventado em outro lugar",
      sum(len(c["text"]) for c in GAP)
      == len("Eu comecei") + len("a trabalhar cedo"))

# --- e o mesmo caso com a legenda ROLANTE, que e como o YouTube entrega de verdade ---
# Aqui e que a BARREIRA se prova: a fala de tras invade a seguinte (10.0 -> 13.5). Sem a
# barreira, quem a aparia passaria a ser a proxima fala DE VERDADE (11.8) e ela cobriria o
# buraco inteiro -- exatamente o "nao estenda a legenda anterior" que o pedido proibe.
ROLANTE = captions.normalize_cues(
    [{"start": 10.0, "end": 13.5, "text": "Eu comecei"},
     {"start": 11.2, "end": 12.4, "text": ">> [ __ ]"},
     {"start": 11.8, "end": 13.0, "text": "a trabalhar cedo"}])
check("12k. rolante: a anterior para no comeco do artefato (11.2), nao em 11.8",
      len(ROLANTE) == 2 and ROLANTE[0]["end"] == 11.2)
check("12l. rolante: a seguinte mantem o proprio comeco (11.8)",
      ROLANTE[1]["start"] == 11.8 and ROLANTE[1]["end"] == 13.0)
check("12m. rolante: sem a barreira este check reprovaria (a anterior iria a 11.8)",
      captions.normalize_cues(
          [{"start": 10.0, "end": 13.5, "text": "Eu comecei"},
           {"start": 11.8, "end": 13.0, "text": "a trabalhar cedo"}])[0]["end"] == 11.8)

# A barreira nunca custa fala de verdade: se aparar deixasse a anterior curta demais para
# ser lida, ela seria descartada com o texto dentro -- pior que o artefato.
CURTA = captions.normalize_cues(
    [{"start": 10.0, "end": 13.5, "text": "Eu perdi quarenta mil reais"},
     {"start": 10.01, "end": 11.0, "text": "[ __ ]"},
     {"start": 11.8, "end": 13.0, "text": "no primeiro ano"}])
check("12n. barreira que apagaria a fala anterior e ignorada (o texto sobrevive)",
      [c["text"] for c in CURTA]
      == ["Eu perdi quarenta mil reais", "no primeiro ano"])
# O 12n sozinho NAO basta, e isso foi medido: tirando o piso da guarda, a fala vira uma
# piscada de 10 ms (`Dialogue: 0:00:10.00,0:00:10.01`) com o texto INTACTO -- ilegivel e
# calada. Texto e duracao sao coisas diferentes, e a razao escrita no codigo fala de LEITURA.
check("12n2. e conserva duracao legivel -- barreira ignorada e barreira que apara a 10 ms "
      "tem o MESMO texto, entao o 12n sozinho nao as separa",
      all(c["end"] - c["start"] >= captions.MIN_CUE_SEC for c in CURTA))
check("12n3. o intervalo dela e o de quem nunca foi aparada (10.0-11.8)",
      [(c["start"], c["end"]) for c in CURTA] == [(10.0, 11.8), (11.8, 13.0)])

# --- a guarda da barreira faz a MESMA pergunta que a regra 1 ------------------------
# Gap de EXATAMENTE 50 ms: `4.05 >= 4.0 + 0.05` e True, mas `4.05 - 4.0` da
# 0.04999999999999982 e a regra 1 descarta. Com as duas formas discordando, o segundo passe
# do pipeline (`cues_for_range` -> `to_pages`) apagava a frase inteira, calado.
ULP_FONTE = [{"start": 4.0, "end": 7.6, "text": "eu quebrei duas vezes antes de acertar"},
             {"start": 4.05, "end": 4.35, "text": "[__]"}]
ULP1 = captions.normalize_cues(ULP_FONTE)
check("12x. gap de 50 ms: normalizar duas vezes NAO apaga a fala (idempotente na fronteira "
      "de float, que e onde ela nao era)",
      captions.normalize_cues(ULP1) == ULP1)
check("12y. e a fala chega ao ASS com duracao legivel, nao como piscada",
      captions.to_ass(ULP1).count("Dialogue:") == 1
      and all(c["end"] - c["start"] >= captions.MIN_CUE_SEC for c in ULP1))
check("12z. a barreira de 50 ms foi ignorada, entao a fala manteve o fim ORIGINAL (7.6)",
      [(c["start"], c["end"]) for c in ULP1] == [(4.0, 7.6)])

# --- as PALAVRAS seguem a mesma regra (senao o karaoke acende o marcador) -----------
PALAVRA = captions.normalize_cues([{
    "start": 0.0, "end": 2.0, "text": ">> Eu [ __ ] comecei",
    "words": [{"start": 0.0, "end": 0.5, "text": ">> Eu"},
              {"start": 0.5, "end": 1.0, "text": "[ __ ]"},
              {"start": 1.0, "end": 2.0, "text": "comecei"}]}])
check("12o. a palavra tambem perde o marcador",
      [w["text"] for w in PALAVRA[0]["words"]] == ["Eu", "comecei"])
check("12p. juntar as palavras limpas reproduz o texto limpo (o que o "
      "`preset.palavrasAlinhadas` exige para o karaoke nao cair para estatico)",
      " ".join(w["text"] for w in PALAVRA[0]["words"]) == PALAVRA[0]["text"]
      == "Eu comecei")
check("12q. o instante das palavras VIZINHAS nao mudou ao tirar a do meio",
      [(w["start"], w["end"]) for w in PALAVRA[0]["words"]] == [(0.0, 0.5), (1.0, 2.0)])

# --- o ASS: fim da linha, o que o FFmpeg queima -------------------------------------
ASS_SUJO = captions.to_ass(
    [{"start": 0.0, "end": 2.0, "text": ">> Tá bom."},
     {"start": 2.0, "end": 3.0, "text": "[__]"},
     {"start": 3.0, "end": 5.0, "text": "a gente perdeu tudo"}])
check("12r. nenhum '>>' chega ao documento ASS", ">>" not in ASS_SUJO)
check("12s. nenhum '[__]'/'[ __ ]' chega ao documento ASS",
      not re.search(r"\[\s*_+\s*\]", ASS_SUJO))
check("12t. a fala limpa continua la, com o relogio dela",
      "Tá bom." in ASS_SUJO and "0:00:00.00,0:00:02.00" in ASS_SUJO)
check("12u. o segmento vazio nao virou Dialogue (3 falas entraram, 2 saem)",
      ASS_SUJO.count("Dialogue:") == 2)
check("12v. a fala DEPOIS do buraco mantem o proprio comeco no ASS (3,00 s)",
      "0:00:03.00,0:00:05.00" in ASS_SUJO)
check("12w. cue que era SO artefato, sozinha, nao gera documento nenhum",
      captions.to_ass([{"start": 0.0, "end": 2.0, "text": "[ __ ]"}]) == "")


# ---------------------------------------------------------------- 13. estilo do .ass
# O caminho FFmpeg/ASS deixou de ser "Inter 58 branca, sempre": ele veste o estilo escolhido
# e o ajuste manual. Estes checks CHAMAM `estilo_ass`/`to_ass` com valores construidos --
# asserir o texto do arquivo so provaria que alguem escreveu a palavra.
_CUES_ESTILO = [{"start": 0.0, "end": 4.0,
                 "text": "A maioria das pessoas nao vai conseguir fazer isso de jeito nenhum"}]

_CLASSICO = captions.estilo_ass()
check("13a. sem estilo e sem ajuste, o resolvido e o classico de sempre",
      _CLASSICO["fonte"] == "Inter" and _CLASSICO["tamanho"] == 58
      and _CLASSICO["negrito"] is True and _CLASSICO["caixaAlta"] is False
      and _CLASSICO["max_linha"] == captions.MAX_CHARS_LINHA
      and _CLASSICO["largura"] == captions.LARGURA
      and _CLASSICO["alinhamento"] == 2 and _CLASSICO["posicaoPct"] is None)
check("13a2. e os quatro nomes publicos sao DERIVADOS desse mesmo estilo",
      (captions.FONTE, captions.FONTE_TAMANHO, captions.NEGRITO, captions.FONTE_ARQUIVO)
      == (_CLASSICO["fonte"], _CLASSICO["tamanho"], _CLASSICO["negrito"], _CLASSICO["arquivo"]))

_IMPACTO = captions.estilo_ass("impacto")
check("13b. o impacto e Montserrat ExtraBold 72, caixa alta",
      _IMPACTO["fonte"] == "Montserrat ExtraBold" and _IMPACTO["tamanho"] == 72
      and _IMPACTO["caixaAlta"] is True)
# O arquivo ja e ExtraBold: pedir negrito por cima faz o libass SINTETIZAR sobre um peso que
# ja e alto -- engrossamento borrado que so aparece olhando o frame.
check("13b2. e ele NAO pede negrito de um arquivo que ja nasce ExtraBold",
      _IMPACTO["negrito"] is False)
check("13b3. o arquivo dele existe no repositorio (senao o libass troca por Arial, calado)",
      captions.font_available(_IMPACTO["arquivo"]))
check("13b4. e o `font_available` sem argumento continua respondendo pelo classico",
      captions.font_available() == captions.font_available(captions.FONTE_ARQUIVO))
check("13b5. arquivo inexistente devolve False em vez de levantar",
      captions.font_available("NaoExiste-Bold.ttf") is False)
# O libass casa pelo NOME que a fonte declara, nao pelo nome do arquivo: `Montserrat-
# ExtraBold.ttf` se declara familia "Montserrat ExtraBold", e pedir "Montserrat" cairia em
# Arial calado. Por isso a tabela guarda o nome declarado, e este check LE a tabela `name`.
_NOMES_TTF = {}
for _fid, _f in captions.LEGENDA_FONTES.items():
    _caminho = os.path.join(captions.FONTE_DIR, _f["arquivo"])
    _familia = ""
    if os.path.isfile(_caminho):
        with io.open(_caminho, "rb") as _handle:
            _bruto = _handle.read()
        # Familia (nameID 1) em UTF-16BE, como toda tabela `name` de TTF da Microsoft.
        _alvo = _f["nome"].encode("utf-16-be")
        _familia = _f["nome"] if _alvo in _bruto else ""
    _NOMES_TTF[_fid] = _familia
check("13b6. cada arquivo DECLARA a familia que o estilo pede (o libass casa pelo nome)",
      all(_NOMES_TTF[_fid] == _f["nome"] for _fid, _f in captions.LEGENDA_FONTES.items()))

# O defeito que esta entrega veio matar: 25 caracteres fixos no ASS contra o teto do ESTILO
# no Remotion. Com 72px e o avanco medido da Montserrat em caixa alta, cabem 15 por linha.
check("13c. o teto de caracteres sai do CORPO e do avanco, nao da constante",
      _IMPACTO["max_linha"] == 15 and _IMPACTO["max_linha"] != captions.MAX_CHARS_LINHA)
check("13c2. coluna mais estreita cabe menos caractere, pela mesma conta",
      captions.chars_por_linha(58, 0.55, 360) == 11
      and captions.chars_por_linha(58, 0.55) == captions.MAX_CHARS_LINHA)
# Entrada torta nao pode virar teto 0: pagina de zero caractere e laco infinito no to_pages.
check("13c3. entrada torta devolve o teto de hoje, nunca 0 nem NaN",
      all(captions.chars_por_linha(*a) == captions.MAX_CHARS_LINHA
          for a in [(0, 0.55), (58, 0), ("x", 0.55), (58, None), (58, 0.55, 0),
                    (58, 0.55, "x"), (58, 0.55, float("inf"))]))

# Ajuste MANUAL. Cada campo e provado pelo EFEITO no documento, nao pela chave no dicionario.
_MANUAL = captions.estilo_ass("impacto", {
    "familia": "inter", "tamanho": 44, "caixaAlta": False, "cor": "destaque",
    "largura": 600, "alinhamento": "left", "posicaoPct": 70})
check("13d. o ajuste manual ganha do estilo em cada campo que o ASS expressa",
      _MANUAL["fonte"] == "Inter" and _MANUAL["tamanho"] == 44
      and _MANUAL["caixaAlta"] is False and _MANUAL["cor"] == captions.CORES["destaque"]
      and _MANUAL["largura"] == 600 and _MANUAL["alinhamento"] == 1
      and _MANUAL["posicaoPct"] == 70)
check("13d2. `style` dentro do ajuste tambem escolhe o preset de partida",
      captions.estilo_ass(None, {"style": "impacto"})["fonte"] == "Montserrat ExtraBold")
# `caixaAlta: False` e uma ESCOLHA ("este estilo em caixa baixa"), nao a ausencia de escolha:
# um `if manual.get("caixaAlta")` a perderia e o impacto sairia em caixa alta mesmo assim.
check("13d3. caixaAlta False sobrevive (booleano, nao truthy)",
      captions.estilo_ass("impacto", {"caixaAlta": False})["caixaAlta"] is False)
check("13d4. numeros fora da faixa sao GRAMPEADOS, nao recusados",
      captions.estilo_ass(None, {"tamanho": 999, "largura": 1, "posicaoPct": -5})
      == dict(_CLASSICO, tamanho=96, largura=360, posicaoPct=0,
              max_linha=captions.chars_por_linha(96, 0.55, 360)))
check("13d5. tipo errado, cor livre e alinhamento desconhecido caem no automatico",
      captions.estilo_ass("xxx", {"familia": 123, "tamanho": "58", "cor": "#ff00ff",
                                  "alinhamento": "justify", "caixaAlta": 1,
                                  "posicaoPct": "80"}) == _CLASSICO)
check("13d6. `manual` que nao e dicionario nao derruba nada",
      all(captions.estilo_ass(None, m) == _CLASSICO for m in (None, [], "x", 7)))

# A ancora continua com UM dono: `pct` e INTENCAO, e quem vira pixel (e quem grampeia contra
# a zona de botoes do TikTok) e o `margem_inferior`.
check("13e. sem `pct` a ancora e exatamente a de sempre",
      captions.margem_inferior(1920, 607) == 705
      and captions.margem_inferior(1920, 607, None) == 705)
check("13e2. com `pct` a base vai para a fracao pedida da altura do quadro",
      captions.margem_inferior(1920, 607, 70) == 1920 - int(round(1920 * 0.70)))
# 99% cairia DENTRO da faixa de botoes do TikTok: o teto ZONA_UI_PCT continua mordendo.
check("13e3. e o teto da zona de interface continua sendo aplicado",
      captions.margem_inferior(1920, 607, 99) == 269
      and captions.margem_inferior(1920, 607, 99) == captions.margem_inferior(1920, 1920))
check("13e4. pct fora de 0..100 e grampeado aqui tambem (o .ass nunca ve numero torto)",
      captions.margem_inferior(1920, 607, -40) == 1920
      and captions.margem_inferior(1920, 607, 400) == captions.margem_inferior(1920, 607, 86))

# O documento. A prova e o TEXTO do .ass gerado, nao o dicionario que o gerou.
_ASS_IMPACTO = captions.to_ass(_CUES_ESTILO, video_h=607, estilo=_IMPACTO)
check("13f. a linha Style do impacto leva fonte, corpo e Bold=0",
      "Style: Legenda,Montserrat ExtraBold,72," in _ASS_IMPACTO
      and ",&H00FFFFFF,&H00FFFFFF,&H00000000,&H2E000000,0," in _ASS_IMPACTO)
# O ASS nao tem `text-transform`: o `textTransform: uppercase` do Clip.jsx e CSS e nao viaja.
# Sem subir o texto aqui, o MESMO estilo sai em caixa alta num renderizador e baixa no outro.
check("13f2. a caixa alta e aplicada ao TEXTO, porque o ASS nao tem text-transform",
      "A MAIORIA DAS" in _ASS_IMPACTO and "A maioria das" not in _ASS_IMPACTO)
# O `Format:` do ASS tem 10 campos e o TEXTO e o decimo -- `split(",", 9)`, e nao um regex
# ate a primeira virgula DUPLA: ela aparece antes disso (o campo `Name`, vazio), e cortar
# ali deixava "0,0,0," colado no comeco e o check media a string errada.
_LINHAS_IMPACTO = [parte
                   for evento in _ASS_IMPACTO.splitlines() if evento.startswith("Dialogue:")
                   for parte in evento.split(",", 9)[9].split(r"\N")]
check("13f3. e a pagina e cortada com o teto DELE (15 por linha, nao 25)",
      bool(_LINHAS_IMPACTO) and all(len(linha) <= 15 for linha in _LINHAS_IMPACTO))
_ASS_MANUAL = captions.to_ass(_CUES_ESTILO, video_h=607, estilo=_MANUAL)
_MARGEM_MANUAL = (1080 - 600) // 2
check("13g. coluna manual muda a margem lateral do documento",
      ",%d,%d," % (_MARGEM_MANUAL, _MARGEM_MANUAL) in _ASS_MANUAL
      and ",%d,%d," % ((1080 - 820) // 2, (1080 - 820) // 2) not in _ASS_MANUAL)
check("13g2. alinhamento a esquerda vira Alignment 1, e a cor manual entra",
      ",1,%d,%d," % (_MARGEM_MANUAL, _MARGEM_MANUAL) in _ASS_MANUAL
      and captions.CORES["destaque"] in _ASS_MANUAL)
check("13g3. a posicao manual vira o MarginV que o `margem_inferior` resolveu",
      (",%d,1" % captions.margem_inferior(1920, 607, 70)) in _ASS_MANUAL
      and (",%d,1" % captions.margem_inferior(1920, 607)) not in _ASS_MANUAL)
# Corte salvo antes desta entrega nao manda estilo nenhum: tem de sair byte a byte igual.
check("13h. sem `estilo`, o documento e IDENTICO ao que o classico gera",
      captions.to_ass(_CUES_ESTILO, video_h=607)
      == captions.to_ass(_CUES_ESTILO, video_h=607, estilo=captions.estilo_ass())
      and captions.to_ass(_CUES_ESTILO, video_h=607, estilo="lixo")
      == captions.to_ass(_CUES_ESTILO, video_h=607))
check("13h2. e sem pagina continua devolvendo '' em qualquer estilo",
      captions.to_ass([], estilo=_IMPACTO) == "")
# O que o ASS NAO faz precisa estar declarado: e o que a tela mostra ao lado do botao dele.
check("13i. a lista do que o ASS nao reproduz existe, e nenhuma frase e vazia",
      isinstance(captions.ASS_NAO_REPRODUZ, tuple) and len(captions.ASS_NAO_REPRODUZ) >= 3
      and all(isinstance(f, str) and f.strip() for f in captions.ASS_NAO_REPRODUZ))


def main():
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
