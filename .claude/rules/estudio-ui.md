---
paths:
  - "video-ops.js"
  - "video-ops.css"
  - "test-video-ops*.js"
description: Regras ativas da tela do Estúdio de Vídeos (Central, Meus projetos, YouTube).
---

# Estúdio de Vídeos — tela (`video-ops.js` / `.css`) — regras ATIVAS

Histórico e medições: `docs/01-Wiki/archive/HISTORICO-estudio-video.md`.

## As quatro telas ativas (decisão do usuário, 2026-09-14)
`data-view="video-ops"` / `#video-ops-root` / CSS externo `video-ops.css`.
`Central` (`central`, tela inicial), `Meus projetos` (`projects`), `YouTube` (`youtube`) e
`Resultados` (`resultados`).
`FLOW_HINT` define as telas permitidas e uma frase por tela. As rotas `overview`,
`cuts` e `review` não são mais acessíveis, inclusive por ações antigas de navegação.
`Resultados` é a ÚNICA tela que não mora neste arquivo: ela vive no `video-results.js`, e o
contrato entre os dois está em `.claude/rules/estudio-resultados.md`. Daqui saem cinco
linhas de fiação (dica, aba, ramo do `render`, `res-*` no clique, `[data-res-filter]` na
mudança) e nada mais — módulo ausente cai numa tela que DIZ o motivo, sem derrubar o resto.
A Central vazia aponta para o YouTube. A edição e a revisão de legendas dos trechos
do YouTube permanecem. Dados salvos não são apagados nem migrados nesta mudança.
Os helpers do fluxo local descritos abaixo permanecem internos, sem tela acessível.

## Bancada de duas colunas (>=1100px): a media query olha a JANELA, não a COLUNA
Nos passos 2 e 3, `.vop-intake-work` vira grade de duas colunas — prévia à esquerda,
ajustes à direita. A coluna da direita fica com **~683px** numa janela de 1440px, e é aí
que mora a armadilha: `.vop-cut` é `flex-wrap: nowrap` e a regra que a faz quebrar está
em `@media (max-width: 720px)`, que mede a **viewport**. Numa janela larga a regra não
dispara, a linha não quebra e o `.vop-cut-name` (`flex: 1 1 160px; min-width: 0`) encolhia
até **20px** — com o texto digitado ainda dentro. Corrigido repetindo as duas declarações
dentro do bloco `@media (min-width: 1100px)`, escopadas em `.vop-intake-work`. **Toda
regra `.vop-*` que depende de largura precisa ser conferida nas DUAS medidas: janela e
coluna.**

## O pipeline de publicação foi APAGADO — não recriar nem referenciar
`STATE` · `accounts` · `variants` · `sources` · `creators` · `permissions` ·
`driveArtifacts` · `resolveVariant` · `approvalIssues` · `toCsv` · `drivePath` ·
`publicationPackage` · `buildReport` · `applyResult` · `renderJobFor` ·
`adoptSessionVideo` · `openPromoteDialog`. Nada de post, descrição, legenda de
publicação, hashtag, aprovação por hash, métrica, Drive, CSV ou backup.
**A chave antiga `pp_video_ops_v1` NÃO é lida nem apagada** — apagar dado do
usuário não é papel de um refactor de tela.

## Estado
- **`INTAKE`** = fonte única do original (sessão): `url` (blob), `file`, `duration`,
  `cuts[]`. Um player por tela, uma URL por sessão; `bindIntake()` religa a cada render.
  **Carregar só no Passo 1** — passos 2 e 3 sem vídeo mostram `needVideoHTML()`,
  **nunca** um seletor de arquivo.
- **`YT`** = estado de SESSÃO (morre com a aba). Trocar a URL derruba sugestões,
  a declaração de direitos e as correções de legenda (`ytUrlWrite` → `capDrop`).
- **`pp_video_clips_v1`** (`LIB_VERSION 1`) = a ÚNICA coisa persistida.
  `libAdd()` é o **ponto único** de registro, chamado pelos dois caminhos de
  download; `libEntry` recusa intervalo impossível e arquivo sem nome.
- Corte = tempo (`{id,name,priority,inSec,outSec}`), nunca cópia. `INTAKE.inSec/outSec`
  seguem em SEGUNDOS; `parseClock()`/`clockField()` são a ÚNICA fronteira de min:seg.
  Texto que não é tempo vira `''` (= não marcado), **nunca 0 calado**.

## Padrões de interação (não negociáveis)
- **BP-001:** edição inline nunca re-renderiza a lista — `cutFieldWrite` /
  `clipFieldWrite` / `titleCardStyleOf` escrevem no modelo sem `render()`.
  Reescrever a lista a cada tecla mata o foco.
- **BP-008:** todo ramo comunica. Sem `savedPath` o cartão **explica** em vez de
  oferecer link morto. `captionsMessage` tem uma frase para CADA estado de
  `CAPTION_STATES`, e o mesmo vale para `X-Clip-Audio` e para `X-Clip-Background`
  (`backgroundMessage`) — `test_serve` 21t0/21t1/28o2/30d LEEM este arquivo e
  reprovam estado sem frase. No fundo o caso normal (`miniatura`) entra com frase
  **vazia** de propósito; os dois casos de letterbox — não havia miniatura × ela
  chegou quebrada — dão o MESMO pixel, então cada um diz o que aconteceu **e o que
  fazer**, e nunca colapsam numa frase só.
- **BP-013:** `capRestore` escreve nos `<input>` que já estão na tela, sem
  re-render (a lista de falas é container rolável próprio).
- **"Está renderizando" mora no MÓDULO (`CUT_BUSY`/`ytBusy`), não no `disabled` do
  botão** — qualquer re-render devolve o botão habilitado no meio do download.
- **Radio escondido `position: absolute` PRECISA de ancestral posicionado.**
  `position: relative` no fieldset + `top:0; left:0` no radio. Sem isso o foco
  rola o `.layout` (que tem `overflow-y: hidden`) e a tela fica numa faixa de
  ~200px **sem barra e sem volta** (medido: `scrollTop` 0 → 1696).
  **Não** trocar por `display:none`/`visibility:hidden` — tiram o radio da ordem
  de foco. Mais `justify-self: start`, senão o fieldset estica e lê como faixa.
- Seletor segmentado = **radio nativo**; o `:checked` desenha o estado. Zero JS de
  estado visual (é o que dessincroniza do dado). `name` leva o id do trecho.

## Conjuntos fechados espelhados (validador local obrigatório)
`titleCardStyleOf` e `reframeOf` — ausente ou desconhecido cai no padrão
(`primo_rico` / `blur`). **O rótulo da tela nunca é a chave.** As listas são lidas
por REGEX pelo `serve.py`/`preset.js`, então usam **literais**, nunca constante
interpolada.

## Hub de recomendações: grade compacta + tela de detalhe (2026-09-09)
A tela `youtube` tem DUAS caras, e a divisão é a regra: **grade** para COMPARAR, **detalhe**
para PRODUZIR. Até esta entrega cada sugestão era um cartão de linha inteira com título
editável, card de marca, enquadramento, legenda e dois botões de render — comparar dois
trechos exigia rolar a página.

- **Nada de controle de produção na grade.** O card tem miniatura 16:9, título de duas
  linhas, faixa de tempo, UMA frase de evidência e a linha de ações (`Editar` primário,
  `Baixar` secundário; `Prévia` pela miniatura). Os cinco controles moram no `ytDetailHTML`.
  Checks no `test-video-ops-dom.js` reprovam quem os trouxer de volta.
- **A nota NÃO aparece no card.** Número de 0 a 100 num cartão lê como probabilidade de
  sucesso, que este sistema não mede. O card mostra a PALAVRA da faixa (`qualityLabel`) e
  só quando ela **não** é a melhor — elogio em todo card é ruído; ressalva é informação. A
  nota e a decomposição (`factors`) ficam no `<details>` da tela de detalhe.
- **As colunas vêm da largura do CONTÊINER, não da janela** — `container-type: inline-size`
  no `.yt-hub` e `@container hub (min-width: 620px | 920px)`. É o conserto certo da
  armadilha documentada acima ("a media query olha a JANELA, não a COLUNA"): esta tela vive
  ao lado da sidebar do site, e medir a viewport erra a conta. Medido: 1198px → 3 colunas de
  376px · 757px → 2 de 351px · 458px → 1. Sem suporte a container query, o padrão de uma
  coluna continua valendo.
- **Um player, num diálogo.** `ytPreviewHTML` monta UM `<iframe>` e só quando a prévia está
  aberta — a grade tem zero player (medido). `Esc` fecha a prévia e o menu de baixar, por um
  ouvinte no DOCUMENTO: com o foco dentro do iframe do YouTube, um ouvinte na raiz nunca
  receberia a tecla.
- **Miniatura = quadro DO TRECHO, pelo storyboard do YouTube.** `serve` entrega
  `storyboard` (`{sheets, rows, columns, fps}`) e o `sbFrame` recorta o quadro de 35% dentro
  do intervalo com `width/height` em % e `transform: translate()`. Nenhum byte de vídeo é
  baixado para popular a grade — medido: **uma** chamada de rede (`/api/yt-probe`) para dez
  cards, nove folhas de imagem. 35% e não 0% de propósito: o começo cai em troca de plano.
  - A folha **não é persistida**: a URL é assinada e expira. Reabrir projeto do MESMO vídeo
    na mesma sessão mantém a folha; vídeo diferente (ou página recarregada) cai na capa
    **rotulada** `Imagem do vídeo`, e imagem que falha vira `Prévia indisponível`. Capa
    fingindo ser quadro do trecho é o defeito que os rótulos existem para não ter.
- **`Baixar` é um menu de dois destinos com nome**: `Baixar trecho original` (recorte cru) e
  `Baixar vídeo editado` (9:16 do Remotion). "Baixar" sozinho não diz qual arquivo sai, e
  entregar o antigo sob esse rótulo é o defeito. Sem trecho no disco, o editado fica
  **desabilitado com o motivo escrito**.
- **`Remotion` não aparece na interface** — é detalhe de implementação. O botão diz
  "Baixar vídeo editado". Check no `test-video-ops-dom.js`.
- **Depois de analisar, a tela FICA no hub.** Ia para "Meus projetos", o que punha um clique
  entre a análise e o resultado que ela acabou de produzir. O projeto continua salvo, e é
  por ele que se volta ao vídeo depois de recarregar.

## O intervalo resolvido é SEGUNDO INTEIRO, e há UM dono
`ytclip.candidates` entrega `inSec`/`outSec` já em segundo inteiro (piso no começo, teto no
fim — os dois lados ALARGAM para dentro do silêncio, nunca comem fala). Não é preguiça: o
nome do arquivo baixado é `<id>-<início>-<fim>.mp4` com inteiros, o `/api/yt-fetch` recebe
`num(inSec)` (que **arredonda**), o `?start=` do player é inteiro e o `/api/clip-status` acha
o arquivo pelo mesmo par. Com fração, o detector prometia 2071,35 e o export entregava 2071
— borda diferente da calculada, calada. Foi o mesmo `num()` que fez os botões de ajuste de
**meio** segundo não fazerem nada: o passo é de **1 s**.

- **Mudar a borda invalida a mídia** (`clipBoundaryChanged`): token, nome do arquivo,
  tamanho, `clipCues` (que estavam rebaseadas no começo ANTIGO) e o painel de legenda saem
  juntos, e `rev` sobe. O **`id` NÃO muda** — projeto salvo continua abrindo. `ytApplyTrim`
  é exportada e testada nos dois ramos, com e sem arquivo baixado (BP-014).
- **`boundary` diz de onde vem a borda** e a tela escreve isso: `palavra` (instante da
  palavra), `fala` (legenda sem tempo por palavra), `audiencia` (sem legenda) ou `manual`
  (ajustada por você). Afirmar conferência que não houve é o que o pedido proíbe.

## Fiação (o que já quebrou calado)
- **`renderBody(clip, comLegenda)` é função pura exportada** — o corpo do POST
  montado inline dentro do `fetch` deixou `title: ''` cravado, e o card do título
  inteiro (33 verificações verdes) **nunca chegou à tela**. Família do BP-014.
- **`projectsPersist()` tem guarda `if (!PROJECTS) return false;`** — gravar nulo
  antes do `init` APAGARIA os projetos salvos.
- **BP-014:** função que sanitiza/migra/carrega dado PERSISTIDO
  (`projectsSanitize`) tem de ser exportada e testada nos DOIS ramos.
- **`FFMPEG_FILTERS` é a terceira cópia** do filtro (comando manual de
  emergência) e TEM de casar com o `worker.build_filter` — checks 26p/26q leem os
  arquivos. Ele não cobre o ramo da miniatura (precisa de 2ª entrada, não cabe num `-vf`).

## Validação
`node test-video-ops.js` · `node test-video-ops-dom.js` — ou `.\provas.ps1`.
`node test-video-ops-rec.js` fica **fora** do `provas.ps1`: rode-o à mão ao mexer na
recomendação.
