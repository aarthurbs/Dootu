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
- **Seis estilos de legenda (2026-09-23, pedido do operador):** `classico` · `impacto` ·
  `faixa` (caixa escura) · `podcast` (rótulo "Contorno") · `papel` (caixa clara) ·
  `discreta`. Os dois primeiros não mudaram um valor (check 15b). Os quatro novos têm UMA
  cor de destaque, que é também a da palavra sendo dita (check 17e2), e texto/destaque com
  contraste ≥ 4,5:1 sobre a própria caixa (check 17e). **Contorno e caixa são opcionais e
  nascem desligados nos de sempre**: o pedido do operador reabriu o contorno que a direção
  antes evitava, e `nenhum` desliga os dois mesmo num estilo que os traz. A composição os
  veste por `contornoPx` (traço = 2× o visível, `paint-order: stroke fill`) e
  `caixaLegenda` (`box-decoration-break: clone`), funções puras do preset — nunca fiação
  escrita à mão no JSX (check 17f).
- **PROFUNDIDADE — exceção documentada à direção (2026-09-25, pedido do operador).**
  `LEGENDA_PROFUNDIDADES = { suave, funda }` no preset.js é o DONO dos números (inclinação,
  perspectiva e passo em px do quadro, camadas, tinta); `profundidadeLegenda(aparencia)` é a
  função pura que devolve `transform: perspective(N) rotateX(θ)` com `transformOrigin:
  '50% 100%'` (gira pela BASE: a base fica no `legendaBase`) e o `textShadow` = camadas duras
  em `color-mix(in srgb, <cor> 35%, #000)` + a sombra de leitura do estilo por último. O
  `resolveLegenda` só carrega a chave; o `Clip.jsx` só ESPALHA o resultado. **Estática:** a
  assinatura não tem tempo nem quadro (check 18b). Nenhuma → `{}` (mesma árvore). Com caixa:
  só inclina. Calibrado no olho sobre os stills: Suave 16°/1800/4×1,5 px (a partida de 3×1 px
  sumia atrás da sombra de leitura), Funda 32°/700/7×1,25 px. O Chrome do Remotion desenha o
  `color-mix` e o texto sai nítido sob o 3D (stills 11–16 do `preview-legenda.mjs`).
- **ÂNGULO (2026-09-29, pedido do operador).** `profundidadeDirecao` ∈ `LEGENDA_PROFUNDIDADE_DIRECOES`
  (`tras` · `frente` · `esquerda` · `direita` · quatro diagonais `tras-*`/`frente-*`), cada uma com
  `origem`, sinal `x` (rotateY, + = a direita se afasta) e `y` (rotateX, + = o topo se afasta).
  Ausente/torta = `tras` = o objeto de 2026-09-25, byte a byte (19b; zero sai `0`, nunca `-0`).
  **Regra do pivô:** a origem é a borda/o canto MAIS PERTO da câmera; com `perspective()` dentro do
  transform o ponto de fuga é a origem, então tudo que recua encolhe para ela e a página inclinada
  fica DENTRO do bloco reto — por isso nenhuma conta do Python mudou. Laterais e `tras-*` giram
  pela base (a base fica no `legendaBase`); a família `frente` gira pelo topo (a base sobe, de
  propósito). O lateral usa um ângulo próprio (`giro`: Suave 16°, Funda 12°) porque a coluna é
  ~4× mais larga que a página é alta; nas diagonais os dois ângulos × `LEGENDA_PROFUNDIDADE_DIAGONAL`
  (0,75). **Diagonal vaza sem conserto:** a ponta vertical que recua escapa pela borda do pivô em
  s·H·senθ·senφ; um `translateX(c)` PRIMEIRO na lista (aplicado depois da projeção) a devolve, com
  H = `MAX_LINHAS` × corpo × entrelinha. A prova é o 19g (projeção 3D PRÓPRIA dos quatro cantos,
  8 × 2 × coluna × página × corpo × entrelinha: pior margem 0,000 px) e o piso de leitura 19i
  (canto mais longe ≥ 70% do tamanho; medido 0,732). O volume sai para o lado mais perto (19f).
  Stills 25–39 do `preview-legenda.mjs`.
- **Posição lateral: prop `legendaEsquerda`** (px da borda esquerda da coluna), que o servidor
  só manda quando há `posicaoXPct` — dono `captions.coluna_x`, o MESMO que dá o MarginL/MarginR
  do ASS. Guarda `esquerdaLegenda(valor, largura)`: ausente/ilegível = a centralizada de
  sempre, e zero é valor (nada de `Number(v) || padrão`).
  **E a coluna EFETIVA: prop `legendaColuna` (2026-09-28)**, junto da esquerda: perto da borda
  a coluna estreita. Guarda pura `colunaLegenda(valor, largura)`; o `resolveLegenda(style, edit,
  legendaColuna)` a aplica UMA vez, e a mesma largura desenha e pagina (`tetoDaPagina`).
  Sem a prop, a aparência é idêntica (check 18l).
- **A cor de destaque escolhida vale para a palavra sendo dita.** O `resolveLegenda` troca o
  `palavraCores` (o leque) por `[destaqueCor]`; antes a escolha só valia no caminho
  estático e o MP4 com karaokê a ignorava (checks 17b–17b3). Cor em `#RRGGBB` é aceita
  (`corLegendaOf`), e os nomes de token antigos continuam válidos.
- **Ênfase por `fontSize`, nunca `transform: scale`** em texto que tem vizinha:
  scale cresce o glifo e **não** a caixa de layout (a armadilha do "Faturamentonão").
  Exceção viva: `TOKENS.palavraEscala` (1,12) no karaokê — folga medida APERTADA
  (5px assentada); é o botão de calibragem, baixar para ~1,08 tira o risco.

## Capa do TikTok e música (2026-09-30, decisão do usuário)
- **`CapaTikTok` mora no `Clip.jsx`** (registrada no `Root.jsx`, 1080×1920, 1 quadro): herda as
  faces já carregadas (Montserrat 800, Inter 700) e o `Fundo`, sem segundo `loadFont` (9w2 segue
  cobrindo um arquivo só) e sem componente de vídeo (6m conta as tags — nem em COMENTÁRIO cite a
  tag, o regex conta o texto). Quadro por `Img`, enquadramento por `palcoGeometria`. Dono dos
  números no preset: `capaTikTokOf`, `CAPA_ESTILOS` (`negocio` · `faixa` · `limpo`),
  `CAPA_POSICOES`, `CAPA_ZONAS` (guias), escada `CAPA_FONTES` escolhida por `capaTitulo` com o
  avanço MEDIDO de cada face (Inter 900 não tem avanço medido — por isso não entrou), `capaBloco`
  (texto no miolo y 440–1480). Destaque = `resolveTitleHighlight`. Stills: `preview-capa.mjs`.
- **UMA `<Audio>`** do `@remotion/media`, só com o prop `musica` (o servidor manda
  `{file, ganho, inicioSec, faixaSec}`). Volume por quadro = `volumeMusica` (pura, relógio da
  SAÍDA): fade-in `MUSICA_FADE_IN` 1 s, fade-out `MUSICA_FADE_OUT` 1,5 s terminando no fim da
  saída ou da faixa (sem loop), grampeado em [0, ganho ≤ 1]. `musicaOf` guarda `{id, inicioMs,
  nivel}`; o `editOf` só cria a chave com faixa válida (corte sem música = edit de sempre).
- **Texto fixo:** prop `textos` (`{id, texto, posicao, estilo, deSec, ateSec}`, relógio da SAÍDA
  vindo do Python) → UMA `<Sequence>` por texto com `TextoFixo`. Estático: só `opacidadeTexto`
  (fade ≤ `TEXTO_FADE_MS` 150) e `textoFixoEstilo` (coluna `TEXTO_GEOMETRIA` 760 px em x 160–920,
  à esquerda da trilha 930; `topo` alto 300 / meio 860; `rotulo` com caixa, `nota` com sombra).
- **Zoom leve:** prop `zooms` (`{id, nivel, deSec, ateSec}`) → `escalaZoom(quadro, zooms, fps)`,
  pura: EXATAMENTE 1 fora das janelas, smoothstep sem sobressalto em `ZOOM_TRANSICAO_MS` 400
  (≤ metade da janela), níveis `ZOOM_ESCALAS` 1,06/1,12, teto `ZOOM_TETO` 1,15. Mora no `Palco`,
  num contêiner `overflow: hidden` em volta da `<Video>` — só a camada do vídeo (24f). Sem zoom a
  árvore é a de sempre (stills de controle com o mesmo hash). 6m/6a/1d seguem verdes; o 14p
  aceita o prop `zooms` (lista de props do Palco).

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

## Card do título — BIBLIOTECA do operador (2026-09-22)
- **DUAS camadas, e as duas são entrada.** `titleCardStyle` é conjunto FECHADO e diz só
  SE o corte tem card: `personalizado` | `nenhum` (validador `preset.titleCardStyleOf`,
  espelhado no `serve.py` e no `video-ops.js`). **Ausente/torto = `personalizado`**; o
  padrão **NUNCA** é `nenhum`. QUAL card é **DADO**, não enum: o objeto viaja no prop
  `card` e passa pelo `preset.cardOf` — mesmo desenho do `edit` da legenda.
- **A biblioteca mora SÓ no navegador** (`pp_video_cards_v1`). O servidor nunca conhece
  um id de card: ele recebe o objeto resolvido e o valida (`serve.card_of`). Por isso o
  POST manda o OBJETO, nunca o id.
- **O portão é load-bearing:** `comLegenda && medida.texto && cardResolvido`. Sem o
  terceiro termo, "Sem card" e card apagado chegam como `card={null}` e `card.logo`
  derruba o render inteiro (tela preta, não card faltando).
- **`cardOf` devolvendo `null` é desfecho legítimo**, em dois casos: "Sem card" e "o card
  que este corte apontava foi apagado". Nunca se cai em OUTRO card — herdar a identidade
  de um vizinho é o pior desfecho, porque nada na tela erraria. Card **sem logo E sem
  identificador é inválido**: não sobra identidade para vestir o título.
- **Só `data:image/{png,svg+xml,jpeg,webp};base64,`** no logo, com teto de **512 KB em
  caracteres do dataURL**, conferido nas TRÊS camadas. `staticFile()` não alcança o
  repositório (o `--public-dir` é o cache do YouTube), então endereço remoto falharia ou
  viraria busca de rede no meio da captura. A **proporção é MEDIDA** no arquivo
  (`naturalWidth/naturalHeight`, com o `viewBox` como reserva para SVG sem tamanho
  intrínseco) — chute distorce, e num emblema circular vira elipse.
- **Peso vem de `CARD_PESOS`**, que É a lista do `loadFont` (check 9w): peso não
  carregado o Chrome SINTETIZA, e sai borrado sem erro nenhum.
- **UM algoritmo de destaque** (`pickTitleHighlight`/`resolveTitleHighlight`/
  `splitTitleHighlight`), compartilhado por TODO card. O card possui só a IDENTIDADE
  (placa, identificador, cor, peso, sublinhado). `highlightText` do operador vence sempre.
- **Geometria é compartilhada** (`TITULO_GEOMETRIA_COMPARTILHADA` + check 13t), e isso
  ficou MAIS importante com a identidade virando dado: quem der padding/filete próprio a
  um card precisa passar o card ao `larguraTitulo`/`tituloEscalonado`, senão a estimativa
  de linhas mente PARA MAIS.
- Escada determinística `TITULO_FONTES`, teto de **3 linhas**, quebra sempre por
  PALAVRA, aparo com reticência só quando nem o piso cabe.
  **`AVANCO_MONTSERRAT` é estimativa de métrica** — mexeu, rode o preview e OLHE.
- Sublinhado em `em` (px fixo não desce com o corpo — medido: 0,7px de folga a 32px).
- **Nenhum asset de marca vive no repositório.** O registro de identidades de terceiro
  (`studio/src/marca.js`) e as duas pastas de logo saíram em 2026-09-22 — inventário do que
  saiu em `CLAUDE.md`, "Módulos REMOVIDOS". A placa entra pelo card do operador, como dataURL
  dentro do próprio card. Checks 13z/13z1.
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
e a posição vertical manual, e (19–24, 2026-09-28) os quatro extremos livres com palavra longa,
a coluna estreitada e a Funda na borda — números do DONO (`serve.legenda_geometria` chamado
pelo Python), quadro 15, na página da palavra longa. 2º argumento = prefixo dos casos. Os DOIS ficam **fora** do `provas.ps1`: eles precisam de FFmpeg
e do Chrome do Remotion, e o que provam é o que nenhuma asserção pega — peso SINTETIZADO
pelo navegador sai como engrossamento borrado e passa em qualquer check. Rode ao mexer em
`AVANCO_*`, no `LEGENDA_PRESETS` ou no `loadFont`, e **olhe o frame**.

## Validação
`node studio/test-preset.mjs` — ou, preferido, `.\provas.ps1` na raiz.
