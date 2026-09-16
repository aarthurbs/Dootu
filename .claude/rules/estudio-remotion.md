---
paths:
  - "studio/**"
description: Regras ativas da camada de edição Remotion (preset, Clip.jsx, card do título).
---

# Estúdio de Vídeos — `studio/` (regras ATIVAS)

Histórico e medições: `docs/01-Wiki/archive/HISTORICO-estudio-video.md`.

## Fronteira
`studio/` tem `package.json` próprio e **não é servido ao site**. O `index.html`
continua **Vanilla JS sem npm**; a única ponte é `/api/remotion-render` chamando
`npx remotion render` como processo. `--public-dir` aponta para a pasta de CACHE,
então **nenhum byte de vídeo é escrito dentro do repositório** e `staticFile()`
**não alcança o repo** (marca e fonte viajam embutidas — `studio/src/marca.js`).

## Direção editorial (decisão do usuário, BUSINESS_SERIOUS)
Alvo: cortes de podcast de **negócios/empreendedorismo em PT-BR**.
Direção: *conteúdo forte → corte certo → comunicação clara → edição discreta → autoridade*.
**Proibido por escrito:** meme, emoji, estética de desenho, texto em movimento
constante, zoom agressivo, shake, corte a cada segundo, B-roll aleatório, música
alta, cor neon, "edição genérica de TikTok" e **qualquer efeito disparado só
porque o tempo passou**. Movimento só com razão semântica.

## Invariantes da composição
- **Exatamente UMA tag `<Video>`** (a do `Palco`) — check 6m CONTA as tags. Duas
  reintroduzem o decode DUPLO por quadro, que é a maior parte do custo de render.
- **`videoEscala` = 1** (check 6a) e **`videoCentroPct` = 0.5** (check 1d). Aquilo
  era a ampliação de 1,45× removida em 2026-08-26; recorte de fonte é
  `palcoGeometria`, não escala.
- **A âncora da legenda vem de FORA** — prop `legendaBase`, calculado por
  `captions.margem_inferior` em Python. `legendaTopoPct` **não existe mais**; não
  recriar percentual do quadro. Ancorar pela BASE é o que faz uma página de duas
  linhas crescer para cima.
- **`objectFit` é PROP, não CSS.** Dentro de `style` o `<Video>` do `@remotion/media`
  o IGNORA (só um aviso no meio do log). `palcoGeometria` o devolve separado.
- **`Img` do Remotion, nunca `<img>`** — o `Img` segura a captura com `delayRender`
  até a imagem carregar; senão os primeiros quadros saem sem fundo.
- **DUAS famílias, e só as que algum estilo pede.** Inter (600/700/800/900) e
  **Montserrat 800** (estilo `impacto`, desde 2026-09-16 — substituiu a Archivo
  Black por decisão do usuário), as duas via `@remotion/google-fonts`, sem
  dependência nova. O check **9w2** cobra a RELAÇÃO, não um número: o `Clip.jsx`
  carrega exatamente as famílias que o `LEGENDA_PRESETS` pede — família carregada que
  estilo nenhum usa é peso morto no render, e estilo pedindo família que ninguém
  carregou desenha na fonte padrão do Chrome, sem erro. Peso ausente do `loadFont` é
  SINTETIZADO pelo navegador e sai borrado — só aparece OLHANDO o frame.
- **O avanço de cada família é MEDIDO, nunca estimado.** `AVANCO_MONTSERRAT_CAIXA_ALTA`
  = 0,731 e `AVANCO_MONTSERRAT_LEGENDA` = 0,610 (fontTools, `instantiateVariableFont`
  em wght=800, `cmap` → `hmtx`/`unitsPerEm`, média ponderada pela frequência das letras
  do português; arredondados PARA CIMA). O mesmo método devolve 0,683160 para a Inter
  Bold em caixa alta, que é o número que já estava lá — é essa reprodução que valida o
  método. **Não reaproveitar o `AVANCO_MONTSERRAT` (0,58) do TÍTULO:** ele mede outro
  texto, em caixa baixa, e usá-lo aqui faria a estimativa de quebra mentir e a linha
  estourar a coluna de 820px, sem erro nenhum.
- **A aparência da legenda é resolvida UMA vez, por `resolveLegenda(legendaStyle, edit)`.**
  Ela junta o preset com o ajuste MANUAL do operador (prop `edit`) e devolve o objeto que
  alimenta a página, a composição e o teto de caracteres. Resolver duas vezes deixaria a
  página ser cortada com um corpo e desenhada com outro. O `reframe` NÃO é re-resolvido
  aqui: o prop já chega validado pelo `reframeOf` do site e pelo `reframe_profile` do
  servidor, e uma terceira resolução seria o quarto dono do mesmo conjunto.
- **Ênfase por `fontSize`, nunca `transform: scale`** em texto que tem vizinha:
  scale cresce o glifo e **não** a caixa de layout (a armadilha do "Faturamentonão").
  Exceção viva: `TOKENS.palavraEscala` (1,12) no karaokê — folga medida APERTADA
  (5px assentada); é o botão de calibragem, baixar para ~1,08 tira o risco.

## Karaokê por palavra (só no Remotion; o ASS não anima)
- Base de tempo: **segundos relativos ao começo do CORTE**. O rebase acontece UMA
  vez, em `ytclip._lines_from_words_in_range`. `useCurrentFrame()` dentro de
  `<Sequence>` é RELATIVO — a `Legenda` recebe o prop `de` e **soma**.
- `preset.activeWordIndex` — intervalo `start <= t < end`, **fim EXCLUSIVO** (o fim
  de cada palavra É o início da seguinte; inclusivo acende duas).
- `preset.palavrasAlinhadas` confere a **JUNÇÃO** (`words.join(' ') === text`),
  nunca contagem de tokens — 5,1% das palavras trazem espaço dentro (`>> fulano`,
  `[ ca ]`) e alinhar por contagem derrubava 24% das linhas ao estático.
- Página de UM átomo não acende. Átomo maior que a página derruba o caminho por palavra.
- **A ênfase semântica (`pickEmphasis`) NÃO é aplicada com o karaokê no ar** — duas
  cores de destaque na mesma tela viram semáforo. Ela continua no caminho estático.

## Card do título
- **`titleCardStyle`** é conjunto FECHADO: `primo_rico` | `puro_ecommerce` | `nenhum`.
  Validador em cada camada (`preset.titleCardStyleOf`). **Ausente/torto = `primo_rico`**;
  o padrão **NUNCA** é `nenhum`. `titleCardPreset` devolvendo `null` é desfecho
  legítimo, não sintoma.
- **O portão é load-bearing:** `comLegenda && medida.texto && cardMarca`. Sem o
  terceiro termo, "Sem card" chega como `card={null}` e `MARCAS[card.marca]`
  derruba o render inteiro (tela preta, não card faltando).
- **UM algoritmo de destaque** (`pickTitleHighlight`/`resolveTitleHighlight`/
  `splitTitleHighlight`), compartilhado pelas marcas. O preset possui só a
  IDENTIDADE (placa, cor, peso, aparência). `highlightText` do operador vence sempre.
- **Geometria é compartilhada** (`TITULO_GEOMETRIA_COMPARTILHADA` + check 13t): quem
  der padding/filete próprio a uma marca precisa passar o preset ao
  `larguraTitulo`/`tituloEscalonado`, senão a estimativa de linhas mente PARA MAIS.
- Escada determinística `TITULO_FONTES`, teto de **3 linhas**, quebra sempre por
  PALAVRA, aparo com reticência só quando nem o piso cabe.
  **`AVANCO_MONTSERRAT` é estimativa de métrica** — mexeu, rode o preview e OLHE.
- Sublinhado em `em` (px fixo não desce com o corpo — medido: 0,7px de folga a 32px).
- `OFICIAL` **não entra** sem autorização declarada (check 11z9b).
- Entrada: `interpolate` + `Easing.bezier`, **nunca `spring`** (mola quica).
  Abre de 0.98, **nunca de `scale(0)`**. Só `opacity` e `transform` animam.
  Polaridade mora em `entradaCard`/`presencaCard` (funções puras).

## Ao escrever teste aqui
- **Guarda de consumidor tem de ser função pura exportada e CHAMADA** com valor
  construído. Regex no texto do `.jsx` deixou passar: `bottom: undefined`, âncora
  invertida (510px fora), `legendaBase` fora do destructuring (436px de erro) e o
  karaokê inteiro desligado — tudo com a suíte verde.
- Sabote numa **CÓPIA em temporário**, com o controle passando antes.
- Verificação visual é obrigatória para tipografia/geometria: `cd studio && node preview-titulo.mjs`.

## Conferir OLHANDO (tipografia não se prova por asserção)
`cd studio && node preview-titulo.mjs` — os stills do CARD.
`cd studio && node preview-legenda.mjs [pasta]` — os stills da LEGENDA: o `classico` de
controle, o `impacto` em Montserrat, dois ajustes manuais (família/corpo/coluna/alinhamento)
e a posição vertical manual. Os DOIS ficam **fora** do `provas.ps1`: eles precisam de FFmpeg
e do Chrome do Remotion, e o que provam é o que nenhuma asserção pega — peso SINTETIZADO
pelo navegador sai como engrossamento borrado e passa em qualquer check. Rode ao mexer em
`AVANCO_*`, no `LEGENDA_PRESETS` ou no `loadFont`, e **olhe o frame**.

## Validação
`node studio/test-preset.mjs` — ou, preferido, `.\provas.ps1` na raiz.
