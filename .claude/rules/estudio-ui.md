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

## A FONTE é o vídeo INTEIRO (decisão do usuário, 2026-09-15)
A tela `youtube` deixou de baixar trecho por trecho. O fluxo é: colar a URL → declarar o
direito → **`Importar vídeo`** → o original completo desce uma vez e passa a ser a mídia de
trabalho. A partir dela: o player interno toca a duração inteira, `Marcar trecho daqui` cria
corte em qualquer ponto, e os dois exports (cru e editado) saem do MESMO arquivo. **Não
recriar o caminho antigo** ("só o trecho escolhido é baixado"), nem reabrir o `/api/yt-fetch`
no fluxo normal — a rota fica no servidor, com teste próprio, mas o botão não a chama mais.
O rótulo do botão principal é `Importar vídeo`, não `Analisar`: a análise continua rodando
(em paralelo, e ela não baixa mídia), mas já não é o que o primeiro clique faz.

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
  a declaração de direitos, as correções de legenda (`ytUrlWrite` → `capDrop`) **e a fonte**
  (`srcReset`).
- **`SRC`** = a FONTE importada: o vídeo inteiro (sessão). `{videoId, state, stage, percent,
  error, token, name, url, bytes, durationSec, width, height, hasAudio}`. O ARQUIVO no disco
  é a verdade durável — `SRC` é só o que a tela precisa, e o servidor o redescobre pelo disco
  (`/api/yt-import-state`) depois de um recarregamento. `SRC.token` é o **id do vídeo**, e
  isso é escolhido: ele passa no `TOKEN_RE` que o `/api/video-cut` exige e é ESTÁVEL, então o
  mesmo original serve dois cortes seguidos sem subir nem baixar um byte.
  - `IMPORT_STATES`/`IMPORT_STAGES` são **espelho do `serve.py`** e cada valor tem frase
    (`IMPORT_MSG`/`IMPORT_STAGE_MSG`) — os checks 32a/32b do `test_serve` LEEM este arquivo.
  - **`SRC_SEQ` é a guarda da corrida.** Colar outra URL no meio de uma importação sobe a
    sequência; `srcApply` descarta resposta de sequência velha, de outro `videoId`, ou de um
    id que já não é o da URL na tela. Sem isso o vídeo antigo chegaria depois e assumiria a
    tela do recém-pedido — o pedido proíbe isso por escrito.
  - **O portão de direitos é conferido DE NOVO no `srcApply`.** A declaração pode cair durante
    os minutos do download; caindo, a fonte NÃO entra na sessão e o motivo é dito. O arquivo
    fica no disco (apagar dado do operador não é papel desta tela), e re-declarar o religa na
    hora — é o mesmo caminho do projeto reaberto, no `onRootChange` do `[data-yt-rights]`.
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
- **UM player, e ele é do SITE (decisão do usuário, 2026-09-15).** O `<iframe>` do YouTube
  saiu das DUAS pontas — o diálogo de prévia (`ytPreviewHTML`, `YT.preview`, `.yt-modal*`) e
  a moldura da tela de detalhe (`.yt-detail-player`) foram apagados. No lugar, `srcPanelHTML`
  monta **um** `<video data-src-video src="/sources/…" controls>` no ALTO da tela, acima da
  grade E da tela de detalhe, e as três coisas falam com ele: `Prévia` (`srcSeek`) arrasta e
  toca, abrir um trecho posiciona no começo dele, e `Marcar trecho daqui` lê o `currentTime`.
  Dois players do mesmo arquivo de 2 GB custariam dois decodes e discordariam sobre onde o
  operador está olhando. `Esc` fecha só o menu de baixar — não há mais diálogo.
  - **`srcAdopt` preserva o nó `<video>` entre renders, e isto NÃO é otimização.** O
    `render()` troca o `innerHTML` inteiro; um player recriado perde posição, volume e buffer,
    e num arquivo de 2 GB isso quer dizer rebaixar tudo e voltar ao segundo zero a cada
    clique em "Baixar". A marcação DECLARA o player (assim ele é testável) e o `srcAdopt`
    troca o nó recém-criado pelo vivo quando a URL é a mesma. O detach e o reattach acontecem
    na **mesma tarefa síncrona** — a especificação só pausa a mídia depois de esperar um
    *stable state* e conferir se o elemento continua fora do documento, e ele já voltou. Fora
    da mesma tarefa isto não funciona.
  - **A barra de progresso da importação anda SEM re-render** (`srcRefresh`): reescrever a
    tela a cada segundo tiraria o foco de quem digita a URL (BP-001) e remontaria o player. O
    re-render fica para a TRANSIÇÃO de estado, que é quando a tela muda de cara.
  - **`.vop-cand-mask` PRECISA de `pointer-events: none`** — por cima de um `<video controls>`
    sem isso os botões de play, volume e a barra de tempo param de aceitar clique, ou seja a
    máscara tiraria justamente a navegação que esta tela existe para dar.
- **Miniatura = quadro DO TRECHO, pelo storyboard do YouTube.** `serve` entrega
  `storyboard` (`{sheets, rows, columns, fps}`) e o `sbFrame` recorta o quadro de 35% dentro
  do intervalo com `width/height` em % e `transform: translate()`. Nenhum byte de vídeo é
  baixado para popular a grade — medido: **uma** chamada de rede (`/api/yt-probe`) para dez
  cards, nove folhas de imagem. 35% e não 0% de propósito: o começo cai em troca de plano.
  - A folha **não é persistida**: a URL é assinada e expira. Reabrir projeto do MESMO vídeo
    na mesma sessão mantém a folha; vídeo diferente (ou página recarregada) cai na capa
    **rotulada** `Imagem do vídeo`, e imagem que falha vira `Prévia indisponível`. Capa
    fingindo ser quadro do trecho é o defeito que os rótulos existem para não ter.
- **`Baixar` é um menu de dois destinos com nome**: `Baixar trecho original` (recorte cru,
  pelo `/api/video-cut` com `profile=horizontal`) e `Baixar vídeo editado` (9:16 do Remotion).
  "Baixar" sozinho não diz qual arquivo sai, e entregar o antigo sob esse rótulo é o defeito.
  Os DOIS saem da fonte importada, e o único pré-requisito dos dois é `srcReady()` — o
  editado **não** depende mais de baixar o trecho antes. Sem fonte, os dois ficam
  **desabilitados com o motivo escrito**, e o motivo fala de IMPORTAR.
- **`clipToken`/`clipFilename`/`clipBytes` mudaram de significado.** Eram "o MP4 deste trecho
  está no disco" (e era isso que destravava o render); hoje são o registro do que foi
  **exportado** deste trecho. `clipBoundaryChanged` continua descartando os três — e a FONTE
  nunca vai junto. **`clipFilename` NÃO viaja no corpo do `/api/remotion-render`**: ele era a
  rede que restaurava o arquivo do trecho quando o token expirava, e mandado junto hoje faria
  um token de fonte expirado renderizar o **próprio arquivo exportado** como se fosse a
  fonte. A rede certa passou a ser o `/api/yt-import`, que redescobre a fonte no disco.
- **`validateProjectClips`/`persistProjectClipFilename` foram APAGADAS** — respondiam "o MP4
  deste trecho está no disco?" com uma chamada ao `/api/clip-status` POR TRECHO. A pergunta
  virou "a fonte está pronta?", e quem responde é o `srcRestore`, com UMA chamada. A rota
  `/api/clip-status` fica no servidor (tem teste próprio e não custa nada parada); o que saiu
  foi o chamador.
- **`Remotion` não aparece na interface** — é detalhe de implementação. O botão diz
  "Baixar vídeo editado". Check no `test-video-ops-dom.js`.
- **Depois de analisar, a tela FICA no hub.** Ia para "Meus projetos", o que punha um clique
  entre a análise e o resultado que ela acabou de produzir. O projeto continua salvo, e é
  por ele que se volta ao vídeo depois de recarregar.

## O intervalo resolvido é SEGUNDO INTEIRO, e há UM dono
`ytclip.candidates` entrega `inSec`/`outSec` já em segundo inteiro (piso no começo, teto no
fim — os dois lados ALARGAM para dentro do silêncio, nunca comem fala). Não é preguiça: o
nome do arquivo exportado leva os inteiros, a query do `/api/video-cut` recebe `num(inSec)`
(que **arredonda**) e o `edit_key` da legenda corrigida acha a correção pelo mesmo par. Com
fração, o detector prometia 2071,35 e o export entregava 2071 — borda diferente da calculada,
calada. Foi o mesmo `num()` que fez os botões de ajuste de **meio** segundo não fazerem nada:
o passo é de **1 s**. O botão `daqui` segue a MESMA regra, com os dois lados alargando:
`Math.floor` no começo, `Math.ceil` no fim.

- **Mudar a borda invalida o EXPORTADO, nunca a fonte** (`clipBoundaryChanged`): token, nome
  do arquivo, tamanho, `clipCues` (que estavam rebaseadas no começo ANTIGO) e o painel de
  legenda saem juntos, e `rev` sobe. O **`id` NÃO muda** — projeto salvo continua abrindo. E
  `SRC` não é tocado: é o pedido em pessoa ("mudar um corte pode invalidar a versão exportada
  dele, mas não pode invalidar nem remover o vídeo importado"). `ytApplyTrim` é exportada e
  testada nos dois ramos, com e sem arquivo exportado (BP-014).
- **A legenda do trecho vem do sidecar da FONTE, na hora** (`srcCuesLoad` → `/api/clip-captions`
  com `{token, name, start, end}`). Antes ela viajava dentro do `/api/yt-fetch`, ou seja não
  existia sem baixar o trecho. A chamada é feita ao ABRIR o trecho e ao mudar a borda, e a
  resposta é descartada se `clip.rev` mudou no caminho — texto de um intervalo em cima de
  outro é o defeito que o `capOf` já guardava pelo par de tempos.
- **`boundary` diz de onde vem a borda** e a tela escreve isso: `palavra` (instante da
  palavra), `fala` (legenda sem tempo por palavra), `audiencia` (sem legenda) ou `manual`
  (ajustada por você). Afirmar conferência que não houve é o que o pedido proíbe.

## Fiação (o que já quebrou calado)
- **`renderBody(clip, comLegenda, fonte)` é função pura exportada** — o corpo do POST
  montado inline dentro do `fetch` deixou `title: ''` cravado, e o card do título
  inteiro (33 verificações verdes) **nunca chegou à tela**. Família do BP-014.
  - **`start`/`end` e o token da fonte andam num ÚNICO ramo `if (daFonte)`.** Mandar o token
    da fonte sem o intervalo faz o servidor renderizar o vídeo INTEIRO — duas horas de
    podcast no lugar de um corte de 40 s, descobertas depois de horas de render. Separá-los
    em dois `if` é abrir a porta para exatamente isso.
- **`projectsPersist()` tem guarda `if (!PROJECTS) return false;`** — gravar nulo
  antes do `init` APAGARIA os projetos salvos.
- **BP-014:** função que sanitiza/migra/carrega dado PERSISTIDO
  (`projectsSanitize`) tem de ser exportada e testada nos DOIS ramos.
- **`FFMPEG_FILTERS` é a terceira cópia** do filtro (comando manual de
  emergência) e TEM de casar com o `worker.build_filter` — checks 26p/26q leem os
  arquivos. Ele não cobre o ramo da miniatura (precisa de 2ª entrada, não cabe num `-vf`).

## Editor MANUAL da legenda (decisão do usuário, 2026-09-16)
O estilo (`classico`/`impacto`) é a escolha de PARTIDA; o painel `.vop-leg` é o que o
operador muda por cima dele, um campo de cada vez. Modelo versionado **na chave que já
existe**: `clip.edit = { v: 1, legenda: {...}, enquadramento: {...} }` — **sem chave nova
de `localStorage`**, sem migração, e clip salvo antes disto abre e exporta idêntico.

- **`editOf` é o validador, e é ele que grava.** Nada entra cru: `editFieldWrite` escreve
  sempre passando pelo `editOf`, e `null` no valor é o gesto de "voltar ao automático" —
  a chave some, em vez de virar chave morta no disco. Terceira cópia (preset.js é o dono,
  `serve.edit_of` é a do servidor); as faixas numéricas e os conjuntos fechados
  (`LEGENDA_FONTES` · `LEGENDA_CORES` · `LEGENDA_ALINHAMENTOS`) são **literais** lidos por
  regex pelo `test_serve` (checks 33a–33b).
- **`Math.round` no grampo dos números.** O espelho em Python grampeia com
  `int(round(...))`; sem isso um corpo 72,5 valeria 72,5 na tela e 72 no `.ass`, e os dois
  renderizadores desenhariam tamanhos diferentes do MESMO ajuste.
- **O automático tem de aparecer como NÚMERO** (`LEGENDA_AUTO`, BP-008): um slider parado
  em 58 enquanto o estilo é `impacto` (72) mente sobre o que vai sair, e encostar nele pula
  14px que ninguém pediu. A tabela é conferida contra o `preset.js` (check 33d2).
- **Automático e manual nunca podem parecer a mesma coisa.** A linha ajustada acende
  `data-manual="1"` (borda que já ocupa lugar — acender não empurra o layout) e o botão
  `auto` dela sai do `disabled`. A faixa de estado fala nos DOIS ramos, inclusive
  "Tudo automático".
- **A posição vertical NASCE sem número, de propósito.** A âncora automática é calculada
  em Python (`captions.margem_inferior`) a partir do enquadramento; uma fórmula equivalente
  em JS é o defeito que já escreveu a legenda 61px ABAIXO da imagem. Enquanto é automática
  a linha DIZ isso; ao assumir, o slider parte de um número redondo da tela
  (`LEGENDA_POSICAO_PARTIDA`, 75) e o ajuste fino se faz olhando o quadro real. **Nunca**
  trazer `RODAPE_PCT`/`ZONA_UI_PCT` para cá — o check 33g6 reprova.
- **`input` desenha, `change` grava.** O slider dispara `input` a cada pixel do arrasto: a
  prévia acompanha em tempo real e o `localStorage` só é tocado ao soltar. E a escrita
  **não re-renderiza** (o slider morreria no meio do arrasto — parente do BP-001); quem
  re-renderiza é só o `auto` e o "Posicionar à mão", porque a linha troca de FORMA.

### As duas prévias, e a tela diz qual é qual
- **Camada A — CSS, instantânea.** Overlay `.vop-leg-prev` sobre o player da FONTE que já
  existe (nunca um segundo `<video>` de 2 GB). Ela prova fonte, corpo, caixa, cor, coluna e
  alinhamento, e **não** a quebra de página: essa tem um dono só (`toCaptionPages` /
  `to_pages`) e não ganha uma quarta implementação. Números vão em pixels do QUADRO
  (1080×1920) como custom properties **sem unidade**, e o CSS os multiplica por
  `--px: calc(100cqh / 1920)` — unidade de container, não `scale()` calculado em JS.
- **Camada B — o quadro real, sob demanda.** `/api/remotion-still` roda `npx remotion still`
  com os props que o `render_props` monta para o MP4 (um dono só), no quadro do MEIO do
  corte — o começo cai dentro dos 4s do card do título. Cache por hash dos props, então
  reapertar sem mexer em nada é de graça. Todo desfecho fala (BP-008): pedindo, pronto (com
  a âncora que o servidor resolveu, lida do `X-Clip-Legenda-Base`) e falhou com o motivo.
- **O download rápido (FFmpeg/ASS) avisa o que não reproduz**, ao lado do próprio botão:
  `ASS_NAO_REPRODUZ` espelha `captions.ASS_NAO_REPRODUZ` (check 33j2).

## Validação
`node test-video-ops.js` · `node test-video-ops-dom.js` — ou `.\provas.ps1`.
`node test-video-ops-rec.js` fica **fora** do `provas.ps1`: rode-o à mão ao mexer na
recomendação.
