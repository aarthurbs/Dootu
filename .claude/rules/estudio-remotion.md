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
- **Nenhuma FAMÍLIA de fonte nova.** Inter (400/700/800/900) via
  `@remotion/google-fonts`. **Montserrat saiu do projeto** (check 9w cobra as duas
  pontas). Peso ausente do `loadFont` é SINTETIZADO pelo navegador e sai borrado —
  só aparece OLHANDO o frame.
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
- **A cor da palavra ativa é um LEQUE** (`TOKENS.palavraCores`, pedido do operador em
  2026-09-11), o MESMO nos dois estilos de legenda, resolvido por `preset.corDaPalavra`.
  Gira pelo ÍNDICE DA PALAVRA, nunca pelo tempo. É a única exceção ao "cor neon" proibido
  acima. Vizinhas ficam a ≥30° de matiz **inclusive na volta** do fim para o começo — foi o
  que tirou o laranja da lista (25° do amarelo). Lista vazia/estilo torto cai no branco do
  texto, não em `undefined`. Checks 8q–8q7 e 15d5.

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

## Validação
`node studio/test-preset.mjs` — ou, preferido, `.\provas.ps1` na raiz.
