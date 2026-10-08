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
`Clips` (`youtube`, tela inicial desde 2026-09-23), `Meus projetos` (`projects`), `Central`
(`central`) e `Resultados` (`resultados`). A CHAVE continua `youtube` (dados, testes e ações
antigas falam dela); só o rótulo mudou.
`FLOW_HINT` define as telas permitidas e uma frase por tela. As rotas `overview`,
`cuts` e `review` não são mais acessíveis, inclusive por ações antigas de navegação.
`Resultados` é a ÚNICA tela que não mora neste arquivo: ela vive no `video-results.js`, e o
contrato entre os dois está em `.claude/rules/estudio-resultados.md`. Daqui saem cinco
linhas de fiação (dica, aba, ramo do `render`, `res-*` no clique, `[data-res-filter]` na
mudança) e nada mais — módulo ausente cai numa tela que DIZ o motivo, sem derrubar o resto.
A Central vazia aponta para o YouTube. A edição e a revisão de legendas dos trechos
do YouTube permanecem. Dados salvos não são apagados nem migrados nesta mudança.
Os helpers do fluxo local descritos abaixo permanecem internos, sem tela acessível.

## Excluir projeto e remover vários clips (decisão do usuário, 2026-10-07)
- **Meus projetos:** botão `Excluir` sobre a miniatura (`proj-del`), IRMÃO do cartão
  (`.vop-project-item`) — o cartão já é `role="button"`. Confirmação no lugar (`PROJ_DEL`),
  nunca `confirm()`: SÓ `Excluir | Cancelar` no centro, sem frase, com o cartão embaçado
  por baixo (pedido do usuário). `projectRemove` tira só o REGISTRO; vídeo importado, cortes e clips da
  Central ficam. Projeto aberto em Clips perde as sugestões (como o "Limpar").
- **Central:** caixa nativa por cartão (`lib-sel`) + barra `[data-lib-selbar]` (Selecionar
  todos · N selecionado(s) · Remover selecionados → confirmação no lugar). Marcar NÃO chama
  `render()` (`libSelPaint` repinta no lugar; re-render recarregaria todos os `<video>`).
  `libRemoveMany` remove o registro; o arquivo no disco fica. Seleção = sessão (`LIB_SEL`).

## A FONTE é o vídeo INTEIRO (decisão do usuário, 2026-09-15)
A tela `youtube` deixou de baixar trecho por trecho. O fluxo é: colar a URL → declarar o
direito → **`Importar vídeo`** → o original completo desce uma vez e passa a ser a mídia de
trabalho. A partir dela: o player interno toca a duração inteira, `Marcar trecho daqui` cria
corte em qualquer ponto, e os dois exports (cru e editado) saem do MESMO arquivo. **Não
recriar o caminho antigo** ("só o trecho escolhido é baixado"), nem reabrir o `/api/yt-fetch`
no fluxo normal — a rota fica no servidor, com teste próprio, mas o botão não a chama mais.
O rótulo do botão principal é **`Iniciar`** (pedido de 2026-09-23: "um botão para iniciar"),
nunca `Analisar`: ele importa E dispara a análise em paralelo (que não baixa mídia).

## Entrada direta em Clips (decisão do usuário, 2026-09-23)
Pedido: "colar uma URL, assistir ao vídeo e acessar os melhores cortes". Ordem da tela:
card da URL (`.yt-intake` em destaque + declaração) → **etapas** (`ytStepsHTML`, `data-yt-steps`:
Download · Análise · Cortes, cada uma com estado e, na falha, motivo + "Tentar novamente") →
vídeo original (`srcPanelHTML`, com "Baixar original" = `<a download>` do `/sources/…`) →
"Cortes recomendados".
- **Geração automática** (`autoCutsKick`): fonte pronta + declaração + análise = cada trecho vira
  MP4 cru pelo MESMO `/api/video-cut` do "Baixar trecho original" (`ytFetchClip(…, auto)`),
  **um por vez**, do mais recomendado ao menos. No modo automático não há `downloadBlob`: o
  arquivo fica na pasta permanente (`X-Clip-Path`) e o trecho guarda **`clip.clipSaved`** (nome
  base, validado no `candidateSanitize`). Sem caminho permanente = FALHA dita, não sucesso.
  Disparos: `srcApply` pronto, fim do `ytProbe`, `openProject`, marcar a declaração, trim.
  Falha fica em `AUTO_CUT_FAIL` (sessão) até "Tentar novamente" (`yt-cuts-retry`).
  `clipBoundaryChanged` apaga `clipSaved` (o arquivo antigo fica no disco e na Central).
- **Atualização pontual** (`autoPaint`): corte pronto troca só o painel de etapas e o card dele —
  `render()` inteiro a cada corte roubaria o foco (BP-001). Os `<video data-cut-video>` sobrevivem
  aos renders pelo `cutAdopt` (mesma ideia do `srcAdopt`).
- **Card:** posição `#N recomendado` pela **nota do detector** (`ytRank`, `score` desc, desempate
  pelo começo — o mesmo critério do `ytSorted`); `score` 0 (trecho à mão / antigo) = "Sem
  classificação do detector", nunca posição inventada. Com `clipSaved`, a miniatura vira o player
  do corte e o item "Baixar trecho original" do menu vira `<a download>` do próprio arquivo (não
  recorta de novo).
- **Card compacto (decisão do usuário, 2026-10-08):** a prévia manda; embaixo SÓ a recomendação
  e o título (`topic`). Faixa de qualidade, horários, chip de status, justificativa, "Gerando o
  corte…", falha + "Tentar novamente" e `contextWarning` saíram do card (a falha segue nas etapas;
  o aviso fica guardado no projeto). O corte salvo **não tem barra nativa** (`controls` saiu):
  o próprio `<video>` toca/pausa por clique, Espaço ou Enter (`yt-card-play`, `tabindex=0`).
  Editar e Baixar são **dois botões de vidro circulares** (`.yt-glass`, 40 px, desenhados a partir
  de uma referência do usuário: miolo cinza-prata fosco, aro em `conic-gradient` — branco no alto,
  quente à esquerda, frio à direita —, ícone branco com volume: claquete aberta listrada e o
  download clássico do Material, `YT_CARD_ICO`) no canto inferior direito da prévia (`.yt-card-media > .yt-card-acts`), com
  `aria-label` e dica (`data-dica`) no hover e no foco. Baixar abre o MESMO menu
  (`yt-dl-menu`). O card não tem mais `overflow:hidden` (o menu passa da borda); a duração da
  miniatura foi para o canto inferior esquerdo.
- **Recarregar** reabre o último projeto pronto (`lastProject`, por `updatedAt`) via `openProject`.
- **A declaração é gravada no projeto** (`project.authorized`, `projectAuthWrite`): marcar/desmarcar
  a caixa e o `Iniciar` gravam. `openProject` de outro vídeo usa a declaração DAQUELE projeto;
  colar uma URL já declarada a religa. Continua por URL, conferida duas vezes; o que mudou é que
  deixou de morrer com a sessão (pedido: original e cortes disponíveis após recarregar).

## Reformulação visual: entrada simples, informação por fase (decisão do usuário, 2026-09-25)
Pedido: "ao entrar, o usuário entende imediatamente onde colocar o link, o que acontece em
seguida e qual é o próximo passo". A funcionalidade não mudou; mudou QUANDO cada coisa aparece.
- **Cabeçalho de uma linha** (`headerHTML`): "Estúdio de Vídeos" + "Dia N de 90" ao lado das
  abas (controle segmentado). O cartão com kicker, frase e barra de 90 dias saiu, e o botão
  "Central · N clip(s)" também — a contagem mora na aba da Central (só com número > 0).
- **A tela Clips tem duas fases** (`data-fase` no `.yt-hub`, calculada no `ytStepHTML`):
  `entrada` = título, a dica (`FLOW_HINT.youtube`, que na Clips mora DENTRO da tela e não
  abaixo das abas), o campo+`Iniciar` numa peça só, a declaração e três passos (`.yt-howto`).
  `trabalho` começa com importação, análise, erro, projeto reaberto ou trecho aberto; aí
  entram as etapas, a fonte e os cortes (`ytWorkHTML`). Etapas/faixa/fonte vazias antes disso
  eram o ruído que o pedido nomeou.
- **No editor o foco é o corte:** etapas e resumo da fonte somem, e o campo+declaração só
  aparecem se a declaração faltar (é ela que destrava o resto).
- **A nota da FONTE não se repete por card** (`status.nota` saiu do `ytCandidateCardHTML`; o
  editor continua com ela). A faixa da importação diz uma vez só (`IMPORT_MSG.idle`).
- Declarada, o texto legal da declaração some (`:has(:checked) small`) — a frase fica.
- O branco é só do `Iniciar` (o `Editar` dos cards virou ícone de vidro em 2026-10-08). Animação de entrada só na TROCA de fase (`data-enter`,
  `YT_FASE_ANTES`) — `render()` recria os nós e animaria a cada clique.

## Fluxo em etapas no editor (decisão do usuário, 2026-10-05)
Pedido: "Marcar trecho → Editar vídeo → Baixar vídeo editado → Criar capa"; cortar só em Marcar
trecho, capa numa etapa própria no fim, aberta só depois do clique em "Baixar vídeo editado".
- **Etapas no topo** (`ytEtapasHTML`, botões `data-act="yt-etapa"` + `aria-current="step"`):
  `trecho` · `editar` · `capa`. Estado de SESSÃO por corte (`YT_ETAPA`, sem localStorage); todo
  corte abre em `trecho`. Trocar de etapa chama `render()` (o `srcAdopt` mantém o `<video>`).
- **Marcar trecho** = `ytTrimHTML` + Remover trechos + "Marcar trecho daqui" + `Editar vídeo`.
  É o ÚNICO lugar com começo/fim e remoções; aqui o menu Baixar não aparece.
- **Editar vídeo** = a barra de ferramentas abaixo, **sem Corte e sem Capa**, e o menu Baixar.
- **Criar capa** = `capaPanelHTML` sozinho (`data-tool="capa"`, herda o layout da prévia ao lado).
  Travada (`disabled`) até `ytCapaLiberada`: o clique em `yt-render` que DE FATO começou o render
  (`YT_BUSY`; recusado antes de começar não libera) — esse clique já leva até ela — ou corte com
  `capaTikTok` salvo (edição antiga não some). Render falhando não trava de novo.
- Lado de etapa única: `.yt-detail-side[data-etapa-lado]` com uma coluna de **528 px** (= 96 + 12 +
  420): o vídeo não muda de tamanho entre etapas. Os testes leem `class="yt-detail-side"` exato.

## Barra com identidade âmbar e carregador do palco (decisão do usuário, 2026-10-07)
- **Âmbar dourado é a cor da marca do editor** (`--vop-marca` #E8B04B; claro #9A6408). Cor de
  ESTADO: só a ferramenta ativa, a bolinha de ajuste e a subaba ativa. Ícone SVG de traço por
  ferramenta (`YT_TOOL_ICO`, `currentColor`); na coluna de 96 px ícone sobre o nome, faixa
  lateral âmbar que cresce (180 ms) — a troca não re-renderiza, então a transição roda.
- **Palco carregando = véu com brilho + anel, sem texto.** Moldura `aria-busy` (trecho sendo
  preparado) e `.yt-src-stage` sem `data-pronto`. `SRC_PRONTO` (módulo) guarda a URL que já
  pintou o 1º quadro (`loadeddata`/`canplay`/`play`/`error`; rede de 1,5 s após
  `loadedmetadata`) e a marcação a repõe — no nó, o véu piscaria a cada `render()`.

## Editor em ferramentas (decisão do usuário, 2026-10-01)
Pedido: um espaço de trabalho como um editor de vídeo — escolho a ferramenta numa barra fixa,
os controles dela aparecem no painel, nada rola, e a tela mostra só ferramentas. Decisão em
`docs/03-Decisions/2026-10-01-editor-em-ferramentas.md`. **Substitui, no editor, as regras
marcadas "Superado no editor" abaixo.**
- **Layout (hub ≥ 800 px):** topo = `← Todas as sugestões` · título (`.yt-detail-title`,
  `data-clip-field="topic"`) · menu **Baixar ▾** (`ytExportHTML`: editado / trecho original /
  editado sem legenda, padrão `YT.dlMenu`, Esc fecha). Grade = vídeo `minmax(0,1fr)` · barra
  **96 px** · painel **420 px**. A coluna do vídeo é só o player (rádio do modo, palco, barra
  própria); o resto saiu dela. Ordem main → side mantida (o `colunaEsquerda` dos testes).
- **Ferramentas:** Enquadrar ·
  Legenda (subabas Texto · Estilo · Posição · Profundidade · Avançado; "Voltar ao padrão" e "Ver
  o quadro real" no cabeçalho) · Card (a biblioteca abre DENTRO dela, com "Voltar") · Texto ·
  Zoom · Música · **Análise** (gancho, motivo, sinais e a nota, sob "Nota interna (só
  ordena a lista)"; só aparece com conteúdo — único lugar com texto explicativo).
- **Interação:** barra e subabas são radios NATIVOS (`data-yt-tool` / `data-leg-aba`, `name`
  com o id do corte, radio escondido ancorado no ancestral posicionado). O painel aparece pelo
  `:has(input[...]:checked)` no `video-ops.css` — uma regra por ferramenta, e um check LÊ o CSS
  e cobra as sete. Trocar só grava `YT_TOOL` / `LEG_ABA` (módulo, sem localStorage) e **não chama
  `render()`**: `<video>`, `<audio>` da música e `currentTime` seguem (medido tocando). Todo
  painel fica no DOM. Padrão = a 1ª da barra (Enquadrar) na 1ª abertura da sessão; depois a última usada, inclusive em
  outro corte. `renderKeepingScroll` guarda o `scrollTop` do corpo do painel (BP-013).
- **Bolinha** (`ytToolDots`, 6 px, uma cor): Enquadrar ≠ blur ·
  Legenda = estilo ≠ padrão, ajuste no `edit.legenda` ou `capEdit` · Card = card escolhido ou
  "Sem card" · Texto / Zoom = lista não vazia · Música = faixa. Repinta no
  lugar depois de todo `change`/`input` (`ytToolDotsPaint`).
- **Sem texto:** nenhuma explicação, dica, aviso, frase de estado, tooltip com motivo ou toast
  com o editor aberto (UMA guarda no `toast()`). Falha de ação = o rótulo do PRÓPRIO controle
  vira `Falhou · tentar de novo` (`ROTULO_FALHOU`; export pelo `YT_FALHA`, repintado no gatilho
  por `ytExportPaint`); entrada recusada = `aria-invalid="true"` + contorno até a próxima ação.
  Os contratos que os testes leem (`CAPTIONS_MSG`, `IMPORT_MSG`, `MUSICA_MSG`,
  `MUSICA_IMPORT_MSG`, `CAP_MSG`, `backgroundMessage`, `ASS_NAO_REPRODUZ`) continuam no arquivo.
  A `.yt-analysis-note` não é desenhada em lugar nenhum (nem na grade).
- **Tela fixa** (hub ≥ 800 px **e** janela ≥ 600 px de altura): cadeia flex de `#main` até o
  `.yt-detail` com `flex: 1 0 auto`, escopada em `:has(.yt-detail)`; a grade do editor tem
  `contain: size` + base 0 e recebe exatamente o que sobra. **Armadilha medida:** o
  `#video-ops-root` alinha os filhos ao centro — sem `align-self: stretch` no `.vop-body` a
  grade ficava com 0 px. O 9:16 vem da altura real: `.yt-src-area` (só no editor) é contêiner de
  tamanho e o palco mede `min(100cqw, 100cqh × 9/16)` — erro 0 em todas as medidas. Fora do modo
  fixo empilha (vídeo primeiro, barra em faixa) e a página rola.
- **Medido no Chrome (corte real):** fixo de 1100×700 a 1920×1080 com `#main` sem rolagem e sem
  rolagem horizontal; palco 208×370 (1280×650) · 275×488 (1366×768) · 450×800 (1920×1080);
  390×844 e 800×600 empilham. A 1366×768 só Legenda → Texto (lista) rola no painel; a Capa cabe
  com a prévia ao lado dos controles. Campo mais estreito do painel: 76 px. Export real: gatilho
  "Renderizando…" por 425 s e de volta a "Baixar", sem toast.

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
  - **Reabrir projeto do MESMO vídeo NÃO derruba a declaração (decisão do usuário,
    2026-09-22).** Ela vale "para esta sessão e para esta URL", e as duas continuam valendo:
    o `openProject` só a zera quando `!mesmoVideo`, e no mesmo vídeo religa a fonte do disco
    (`srcRestore`) quando ela não está na sessão e não está sendo importada. Antes ela caía
    sempre, com o arquivo já no disco — mais restrito que a regra escrita, e sem proteger
    direito nenhum: o operador declarava, importava, voltava ao projeto e declarava de novo.
    **Trocar para uma URL NÃO declarada derruba**; recarregar já não derruba (2026-09-23,
    ver "Entrada direta em Clips"). O `ytFetchGate` e a
    conferência dupla no `srcApply` não mudaram em nada. `openProject` é exportada e testada
    nos DOIS ramos (BP-014).
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
- **BP-008:** todo ramo comunica. **[No editor, superado em 2026-10-01: o estado vive no próprio controle, sem frase — ver "Editor em ferramentas".]** Sem `savedPath` o cartão **explica** em vez de
  oferecer link morto. `captionsMessage` tem uma frase para CADA estado de
  `CAPTION_STATES`, e o mesmo vale para `X-Clip-Audio` e para `X-Clip-Background`
  (`backgroundMessage`) — `test_serve` 21t0/21t1/28o2/30d LEEM este arquivo e
  reprovam estado sem frase. No fundo o caso normal (`miniatura`) entra com frase
  **vazia** de propósito; os dois casos de letterbox — não havia miniatura × ela
  chegou quebrada — dão o MESMO pixel, então cada um diz o que aconteceu **e o que
  fazer**, e nunca colapsam numa frase só.
- **BP-001 no texto da legenda:** digitar numa frase (`capCueWrite`) nunca re-renderiza —
  `capPaint` só atualiza nota, "salvo" e botões. Desfazer/Restaurar re-renderizam (o texto
  já não tem rolagem própria, então o `renderKeepingScroll` basta).
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
(`personalizado` / `blur`). **O rótulo da tela nunca é a chave.** As listas são lidas
por REGEX pelo `serve.py`/`preset.js`, então usam **literais**, nunca constante
interpolada. O mesmo vale para os NÚMEROS do card (`CARD_PESOS`, `CARD_LOGO_MAX`): o
`test_serve.py` compara as três cópias.

## Biblioteca de cards do título (2026-09-22)
As duas identidades de terceiro saíram do código; o card virou **dado do operador**.
- Chave PRÓPRIA e global: **`pp_video_cards_v1`** (`{ v: 1, cards: [...] }`). Um card é do
  canal, não de um vídeo. Ela guarda **só o que foi escolhido** — campo ausente significa
  "segue o padrão", como o `edit` da legenda, e é isso que dá ao botão `auto` de cada linha
  o que desfazer. O clip ganhou **`clip.cardId`** dentro da chave de projeto que já existe;
  **sem migração** e sem chave nova para o projeto.
- O POST manda o **objeto resolvido** (`cardDoClip`), nunca o id: o servidor não tem
  biblioteca para consultar.
- **Apagar um card NÃO reescreve corte nenhum.** O corte fica órfão, sai SEM card, e o
  painel dele DIZ isso (`cardPickState`, tom `warn`) — nunca cai em outro card. Trocar a
  identidade de vídeo antigo sem ninguém pedir seria pior que o aviso.
- **TODO estado do seletor tem frase** (BP-008): **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** biblioteca vazia (com o botão que cria o
  primeiro card), nenhum card escolhido, card escolhido, card apagado, e "Sem card".
- **Cota cheia é reportada**, nunca engolida: `cardFieldWrite`/`cardLogoWrite` devolvem a
  frase do motivo, e escrita recusada não deixa rastro no card.
- Editor: radios nativos para a escolha, `<select>` para o peso (nunca campo livre — peso
  fora do `loadFont` sai borrado), `<input type="color">` com a AMOSTRA ao lado (o input
  não representa alfa, e os padrões usam `rgba`), confirmação de exclusão **inline** (nunca
  `confirm()`, nunca `dblclick` — BP-001), e prévia em CSS **declarada como aproximação**
  (o quadro real continua sendo o `/api/remotion-still`). Não há uma terceira prévia.

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
  - `sbStyle` é o dono da conta de recorte (largura/altura em % e `translate`). O card da
    grade e a coluna do editor mostram o MESMO quadro: duas cópias divergiriam caladas, e
    recorte errado não parece defeito — parece outro instante do vídeo.

## A bancada do editor: vídeo à ESQUERDA, controles à DIREITA (decisão do usuário, 2026-09-22)
Abrir um trecho põe o vídeo ao LADO dos controles que o mudam. Até esta entrega o player era
uma faixa de largura inteira no alto da tela e a coluna esquerda do editor guardava TEXTO,
com um parágrafo (`.yt-detail-onde`, **apagado**) mandando olhar "o player acima" — ajustar a
borda de um corte era olhar para um lugar e mexer em outro.

- **Continua havendo UM player.** `ytStepHTML` emite `srcPanelHTML()` **só na grade**
  (`emEdicao ? '' : srcPanelHTML()`); no editor quem o emite é o `ytStageHTML`, dentro da
  `.yt-detail-main`. Emitir nos dois lugares declara dois `<video>` do mesmo arquivo de 2 GB
  e o `srcAdopt` adota só o primeiro — check no `test-video-ops-dom.js` conta as ocorrências.
- **A queda da coluna esquerda tem TRÊS ramos, e a capa não é um deles** (`ytStageHTML`):
  fonte pronta → o player; sem fonte, com storyboard → o **quadro do começo do corte**,
  rotulado; sem os dois → a moldura DIZ que não há quadro. **`YT.thumbnail` nunca entra
  aqui** — "o quadro do começo do corte" e "a imagem de capa do vídeo" são coisas diferentes,
  e a capa é um instante qualquer escolhido por terceiro. Na grade ela entra, rotulada,
  porque lá a pergunta é "que vídeo é este?". Todo ramo oferece a importação ou DIZ por que
  ela está bloqueada (BP-008). O `ytThumbHTML` não foi tocado.
- **`/api/remotion-still` NÃO é o fallback daqui**: ele devolve o quadro verdadeiro, mas
  custa um render por trecho aberto. Ele fica onde está, no botão "Ver o quadro real".
- **O texto do detector desceu para um `<details>` fechado** **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** (`.yt-detail-sobre`: gancho,
  motivo e sinais). Some inteiro quando não há nada a contar — seta que não abre nada é pior
  que seta nenhuma. O `<input>` do título (com o `data-clip-field="topic"`) e a linha de
  borda continuam à vista, acima dele.
- **As duas colunas vêm do CONTÊINER** — `@container hub (min-width: 800px)`, que já existia
  e foi conferido com a marcação nova. Medido (largura do `hub`): 1198px → 655 de vídeo +
  485 de controles · 860px → 461 + 341 · abaixo de 800px **empilha, vídeo primeiro**, e aí
  ele fica MAIOR (758px de largura a 800). Campo mais estreito da direita: **75px** em todas
  as medidas — a armadilha do `.vop-cut-name` de 20px não se repete. Sem rolagem horizontal
  em nenhuma largura (360px a 1198px).
- **A coluna esquerda acompanha a rolagem em duas colunas (2026-09-22).** **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]**
  `.yt-detail-main` usa `position: sticky; top: 12px; align-self: start` na mesma
  container query de 800px. O ancestral rolável é `#main`; não é necessário alterar
  o overflow do shell. O `align-self` impede que a coluna estique até a altura dos
  controles e elimine o percurso do sticky. Em uma coluna permanece estática, sem
  cobrir os controles. Conferido no Chrome em janelas de 390 a 1440px, inclusive
  1440×600: player visível junto à legenda em duas colunas, um player e nenhum
  overflow horizontal ou deslocamento de `.layout`.

### `.yt-src-stage` PRECISA de altura determinada — `container-type: size` a zera
`container-type: size` (que existe para a prévia da legenda medir em `cqh`) aplica contenção
de TAMANHO: o palco passa a ser medido como se estivesse vazio, e o `<video>` deixa de
contribuir com altura. **Medido no Chrome:** sem `aspect-ratio`, palco de 1156px de largura
fica com **2px** de altura (só as duas bordas), o `overflow: hidden` engole o player inteiro
e a `.vop-leg-prev` sai com `font-size: 0` — ou seja, o player e as duas sobreposições ficam
invisíveis. Regressão entrada em `b41107b` e consertada em 2026-09-22 com
`width: 100%; aspect-ratio: 16 / 9` no palco e o `<video>` em `position: absolute; inset: 0`.
**`margin-inline: auto` para centrar está proibido aqui**: margem automática tira o item da
esticada da grade e o manda medir pelo conteúdo, que com contenção é ZERO — medido, o palco
voltou a 2×2 px nas oito larguras. Tirar o `aspect-ratio` sem tirar o `container-type: size`
apaga a tela: os dois andam juntos.
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
- **`boundary` diz de onde vem a borda** e a tela escreve isso: **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** `palavra` (instante da
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
- **As duas posições NASCEM sem número, de propósito.** A âncora automática
  (`captions.margem_inferior`) e a coluna centralizada (`captions.coluna_x`) são calculadas em
  Python; uma fórmula equivalente em JS é o defeito que já escreveu a legenda 61px ABAIXO da
  imagem. Enquanto automáticas as linhas DIZEM isso ("Automática, dentro da imagem." /
  "Centralizada."). **Nunca** trazer `RODAPE_PCT`/`ZONA_UI_PCT`/`TRILHA_X`/`MARGEM_LATERAL`
  para cá — os checks 33g6 e 35h reprovam.
- **"Ajustar à mão" parte da âncora REAL (2026-09-25).** O 75 fixo (`LEGENDA_POSICAO_PARTIDA`,
  **apagado**) jogava a base 225 px para FORA do vídeo no `blur`. Agora a partida é o
  `posicaoAutoPct` que o `/api/legenda-geometria` devolve para ESTE corte (`legGeoDoCorte`):
  o salto fica em ≤ 10 px (blur 5 · crop11 7 · crop45 9 · crop 0, check 35c). Sem a
  geometria deste corte o botão fica desabilitado e o arrasto recusa com o motivo — nunca chuta.

### "Como sai 9:16", posição lateral e Profundidade (decisão do usuário, 2026-09-25)
- **UM `<video>`, duas caras.** Rádio nativo `Original 16:9 | Como sai 9:16` acima do palco
  (`legModoHTML`, `data-src-modo`); `PREVIA_MODO` é estado de MÓDULO (sem chave de
  localStorage), padrão `saida`. Trocar muda só o `data-modo` do `.yt-src-stage` e a
  propriedade `controls` do MESMO `<video>` (`legModoTroca`) — `currentTime` intacto.
- **2026-09-28 (substitui o palco 16:9 com um 9:16 dentro, que dava 214×381 a 1440×900):** em
  `saida` o PALCO É o quadro — `width: min(100%, --quadro-h × 9/16)` + `aspect-ratio: 9/16`,
  centrado por `justify-self` (nunca margem automática; `container-type: size` continua com
  tamanho determinado). **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** `--quadro-h = max(360px, 100dvh − header − 236px)`: a coluna sticky
  inteira (rádio + quadro + barra + nota + linha de baixo) cabe na janela. Medido: 337,5×600 a
  1440×900 · 202,5×360 (piso) a 600 de altura · erro 9:16 = 0 px nas 10 medidas (390–1440 ×
  600/900), sem rolagem horizontal. A borda é **anel** (`box-shadow` 1 px), nunca `border`:
  dentro da caixa do `aspect-ratio` ela tirava 1,56 px da proporção.
- **Controles nativos só no 16:9.** No 9:16 a barra do Chrome morava na faixa do vídeo, em cima
  da legenda. Lá entra a barra própria ABAIXO do quadro (`legBarraHTML`/`legBarraPaint`):
  play/pause, tempo relativo ao corte, busca presa ao corte (`legBuscaWrite`), espaço toca com
  foco no quadro/barra. Repinta pelos eventos de mídia (captura na raiz), nunca `render()`.
- Rótulo "Fundo aproximado" DENTRO do quadro; as tarjas sangram o raio do desfoque (como o
  `Fundo` do Clip.jsx), senão o blur amostra transparente e desenha halo na emenda.
- **Legenda também no 16:9** (`legQuadroMapear`): o `.yt-src-quadro` vira o quadro de saída
  sobre a fonte — s = altura do conteúdo do `<video>` (medida sob `contain`) ÷ `videoAltura`,
  caixa 1080·s × 1920·s centrada no conteúdo, topo = topo do conteúdo − banda·s; vídeo e máscara
  compensam o deslocamento. Roda no `loadedmetadata`, no ResizeObserver e na geometria nova.
  Medido: o mesmo ponto do texto dá (0,5000; 0,6328) do quadro nos dois modos. Legenda na faixa
  de fundo → a nota diz "A legenda está na faixa de fundo, fora do vídeo — veja em Como sai 9:16.
- **A geometria vem do `/api/legenda-geometria`** (`legGeoPedir`): ao abrir o corte (gancho no
  fim do `render`), ao trocar enquadramento/largura/posição (AO SOLTAR) e ao voltar ao padrão.
  A chave do pedido é só a intenção (enquadramento, largura, posições, dimensões da fonte) —
  mudar cor não pede nada. A resposta atualiza NO LUGAR (`legGeoAplicar`), sem `render()`.
  Falha = nota nas linhas e abaixo do player, apontando para "Ver o quadro real" (BP-008).
- **Trocar o enquadramento re-renderiza** (clique deliberado). Antes não repintava, e a prévia
  9:16 seguia no recorte anterior — achado no Chrome desta entrega.
- **Posição lateral** (`posicaoXPct`, 0–100 = centro da coluna em % da largura; ausente =
  centralizada). O centro (50) NÃO é ajuste (`legendaFieldWrite` grava `null`), então "Ajustar à
  mão" só abre o slider (`LEG_X_ABERTO`, sessão). "Alinhamento" e "Largura do texto" moram ao
  lado dela (saíram dos "Ajustes avançados"): para encostar numa borda, Esquerda/Direita.
- **Posição LIVRE (2026-09-28, substitui as travas de 2026-09-25).** As faixas vêm da rota e só
  impedem a página de sair do quadro. Perto da borda a coluna ESTREITA (número do servidor,
  `legendaLargura`; `legendaLarguraMax` = a do operador) até o piso da palavra mais longa. Frases
  (todo ramo fala): "A coluna estreitou para caber aqui (usando N px de M).", "A palavra mais longa
  deste corte (“X”) não deixa ir além daqui — diminua o Tamanho…", "A legenda entrou na faixa dos
  botões do TikTok — pode ficar atrás deles.", "…faixa do texto do TikTok (nome e descrição)…",
  além de topo/margem de baixo. As frases de trava antigas saíram.
- **Guias das zonas** (`legZonasHTML`, `div` — as regras `.vop-leg-prev > span` são da alça):
  "Botões do TikTok (aprox.)" (trilha de cima a baixo — a altura dela não é documentada) e "Texto
  do TikTok (aprox.)", com os números da rota (`zonas`). Visíveis ao arrastar e com a legenda
  dentro da zona; só no 9:16.
- **Arrasto 2D** mede o retângulo do QUADRO (nos dois modos), grampeia ao vivo nas faixas do
  servidor e grava ao soltar; DURANTE o gesto pede a geometria (≥ 120 ms entre pedidos; pedido
  igual nem sai) e aplica só a coluna efetiva e as zonas — nenhuma fórmula de coluna no site. Ímã
  do centro (`LEG_X_IMA` = 2%, cobre 48–52 de uma faixa ~16–84): arrasto só vertical não cria X.
- **Profundidade** na prévia: espelho literal `LEGENDA_PROFUNDIDADES` + `legProfundidadeSombra`
  (× `--px`), comparados com o preset.js importado. Com caixa, a linha avisa que só inclina.
- **Ângulo (2026-09-29):** pad 3×3 "Ângulo" logo abaixo da Profundidade (`legAnguloHTML`) — oito
  radios NATIVOS pelo `legRowHTML`/`data-leg-field` de sempre (gravar, ↺ e "Voltar ao padrão"
  sem handler novo), célula = o lado que se afasta, "Aa" já inclinado como amostra, centro vazio
  não interativo. Com Nenhuma: `disabled` + "Escolha Suave ou Funda para usar o ângulo." Trocar a
  intensidade atualiza o pad NO LUGAR. A prévia usa `legProfundidadeTransform` (transform + pivô,
  espelho do preset, com a compensação da diagonal) nas custom properties `--leg-3dt`/`--leg-origem`;
  `test-video-ops.js` compara as 8 × 2 combinações com o preset importado, e o fluxo 7 do
  `test-video-ops-dom.js` faz desabilitado → Funda → diagonal → salvo → reaberto → export → estilo
  trocado → "Voltar ao padrão".
- **`input` desenha, `change` grava.** O slider dispara `input` a cada pixel do arrasto: a
  prévia acompanha em tempo real e o `localStorage` só é tocado ao soltar. E a escrita
  **não re-renderiza** (o slider morreria no meio do arrasto — parente do BP-001); quem
  re-renderiza é só o `auto` e o "Posicionar à mão", porque a linha troca de FORMA.

### O painel reorganizado (decisão do usuário, 2026-09-23)
Pedido: "uma pessoa sem experiência em edição consiga personalizar a legenda". O MODELO não
mudou (mesmo `clip.edit.legenda`, sem chave nova, sem migração); mudou a organização.
- **Ordem = hierarquia:** **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** Estilo (seis cartões com amostra desenhada no próprio estilo) →
  Tamanho → Cores (oito COMBINAÇÕES prontas de texto+destaque+contorno+caixa) → Posição. O
  resto mora em dois `<details>` recolhidos: "Escolher cada cor" (paleta curada por papel +
  `<input type="color">` para cor personalizada) e "Ajustes avançados" (fonte, letras,
  largura, alinhamento). O estado de aberto sobrevive ao re-render (`LEG_MAIS`).
- **O seletor de estilo mora DENTRO do painel** (o `fieldset.vop-cardstyle` "Legenda" solto
  saiu). Trocar de estilo (`legendaStyleWrite`) limpa o que o estilo decide — tipografia e
  as quatro cores — e mantém posição, largura e alinhamento.
- **Valor igual ao automático do estilo não é ajuste** (`legendaGravar`): a chave some e a
  linha não acende. Uma combinação grava só o que difere do estilo.
- **"Voltar ao padrão"** (`legendaReset`) zera a legenda inteira, posição inclusive, e deixa
  o estilo e o enquadramento. Cada linha mantém o seu ↺ (o antigo botão `auto`).
- **Arrastar a legenda na prévia muda a posição.** O texto da `.vop-leg-prev` é a alça
  (`pointer-events: auto` só nele — o resto do overlay deixa o clique ir para o player). O
  arrasto escreve o MESMO `posicaoPct` do slider, com o ponto agarrado sob o cursor; só
  `--leg-pos` muda durante o gesto e o `localStorage` é tocado ao soltar. Automática → manual
  re-renderiza (a linha troca de forma).
- **Cores: token antigo OU `#RRGGBB`** (`corLegendaOf`, três cópias); `contorno`/`fundo`
  aceitam também `nenhum`. A tela traduz token antigo para hex só ao MOSTRAR — ler não
  regrava o clip. `LEGENDA_AUTO` agora traz peso, entrelinha, as quatro cores e a sombra de
  cada estilo, e o `test-video-ops.js` o compara com o `LEGENDA_PRESETS` IMPORTADO.
- **Checks do fluxo inteiro** no `test-video-ops-dom.js` ("fluxo 1–6"): estilo → combinação
  → cor livre → tamanho → arrastar → salvo no projeto → reaberto → corpo do export → voltar
  ao padrão.

### Correção do TEXTO da legenda (decisão do usuário, 2026-09-23)
Pedido: "revisar um texto comum: encontrar o erro, clicar e corrigir, sem precisar entender
tempos ou segmentos". A lista de `<input>` com horário e rolagem interna SAIU.
- **Duas áreas com nome, nesta ordem, na coluna de controles:** **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** "Texto da legenda"
  (`capPanelHTML`, sempre aberto — o botão `yt-cap` saiu) e "Aparência da legenda"
  (`legendaPanelHTML`).
- **Texto corrido, sincronia intacta:** cada fala é um `<span contenteditable="plaintext-only"
  data-cap-field>` dentro de parágrafos (`capParagrafos`, só leitura). Editar muda o TEXTO da
  fala, nunca o tempo — é isso que preserva a sincronia. **Não trocar por um `<textarea>`
  único:** perderia a relação fala↔tempo. Enter termina a correção (não entra quebra).
- **Horários moram em "Horários (avançado)"** (`legMaisHTML('horarios')`, fechado), em
  segundos relativos ao corte; grava no `change`, recusa fim ≤ início ou além do corte.
- **Persistido no projeto, sem chave nova:** `clip.capEdit = [{start,end,text}]` só quando
  difere do original (`capState` compara). `capOf` o semeia ao reabrir, então prévia e export
  (`renderBody` → `capEdited`) usam a correção depois de recarregar. `candidateSanitize` o
  valida (BP-014); `clipBoundaryChanged` o apaga (e o toast da borda DIZ isso).
- **Fala apagada vai vazia** e o `clean_edit_cues` do servidor a descarta. Tudo apagado =
  `CAPTIONS_EDITED_EMPTY`, com frase.
- **"Salvo" visível** **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** (`capSaveText`: salvo / cota recusou / só na sessão / sem correções).
  **Desfazer** = pilha da sessão, um passo por frase (e "Restaurar" também se desfaz).
- **Ouvir e acompanhar:** clicar numa frase com o vídeo parado leva o player até ela;
  "Ouvir a frase selecionada" toca e para no fim (`CAP_STOP`); `capTick` (ouvinte de
  CAPTURA de `timeupdate` na raiz) acende a frase tocando e troca o texto da prévia CSS pela
  fala corrigida (`legPrevFalaHTML`, dono único do miolo da prévia).

### Capa do TikTok e Música (decisão do usuário, 2026-09-30)
**[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]**
Duas seções `<details>` depois de "Aparência da legenda", cada uma com resumo de estado de uma
linha (todo ramo fala).
- **Capa:** `clip.capaTikTok` FORA do `edit` (validado no `candidateSanitize`). "Usar este
  quadro" lê o instante do MESMO `<video>` (`srcNow`) e o desenha num canvas só para a prévia
  (dataURL de sessão; a fonte é da mesma origem). Prévia aproximada em CSS (`--px`, guias
  `CAPA_ZONAS`, corpo pelo espelho `capaTituloTela`); o destaque AUTOMÁTICO não é copiado — a
  prévia mostra só o trecho digitado e diz que o automático aparece no PNG real. Quadro fora do
  corte = "Capa desatualizada", botão trava; PNG gerado com chave diferente = desatualizado.
  Manchete/destaque: `input` desenha, `change` grava; radios re-renderizam. `capaCorpo` = o
  corpo do export + a capa resolvida; a capa NÃO entra no `renderBody` do MP4.
- **Música:** `clip.edit.musica = {id, inicioMs, nivel}` pelo `editOf` (o "Voltar ao padrão" da
  legenda não a apaga). Biblioteca lida uma vez ao abrir o corte (`/api/musicas`); importar pelo
  `<input type="file">` dentro do botão (focável, nunca `display:none`), com frase para cada
  recusa (`MUSICA_IMPORT_MSG`). Início pelo `parseClock` (texto que não é tempo não vira 0).
  Prévia = UM `<audio>` sincronizado ao player (captura de mídia na raiz; deriva > 0,25 s
  corrige), volume pela MESMA tabela `MUSICA_DB` (espelho do servidor, 38b2) e rotulado
  aproximado. `X-Clip-Musica` vira frase no toast do export (`MUSICA_MSG`). O download rápido
  declara que não leva música (`ASS_NAO_REPRODUZ`).
- **Remover trechos:** `clip.edit.remocoes` (ms da FONTE) por "Marcar início/fim" do player;
  `remocaoConfere` recusa com motivo (borda → "mova a borda do corte", curto, sobreposto, teto);
  lista com Desfazer, linha do tempo fina e duração "≈" (subtração simples; a exata é do
  servidor). **Nenhuma fórmula de remapear no site:** a prévia só PULA os trechos
  (`remocaoPulo`) e escolhe a página por `fonteStart`, que vem do dono. `clipEditadoInvalido`
  (não o `clipBoundaryChanged`) invalida só o exportado — falas, correção, corte cru e `id`
  ficam. Fala inteira num trecho removido fica MARCADA no texto (`data-removida`), nunca some.
  O `renderBody` manda o `edit` também quando só há remoções (bug achado pelo fluxo 10d).
- **Texto na tela** e **Zoom leve:** mesma interação (Marcar início/fim pelo player, lista com
  remover; texto editável e radios de posição/estilo; zoom com radio Leve/Médio). Validadores
  `textosOf`/`zoomsOf` espelham o preset. Avisos do texto nunca travam (`textoAvisos`: inteiro num
  trecho removido, junto do card de 4 s, encostando na legenda, zonas do TikTok com os números da
  rota). Prévias: os textos como camada irmã da prévia da legenda, acesos pelo instante do player
  (`textosTick`); o zoom pela propriedade CSS `scale` no próprio player (`zoomTick`, transição
  400 ms = a do export). Os ticks moram no ouvinte de `timeupdate` da captura da raiz.

### As duas prévias, e a tela diz qual é qual
**[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]** As duas camadas continuam; a tela já não as descreve.
- **Camada A — CSS, instantânea.** Overlay `.vop-leg-prev` sobre o player da FONTE que já
  existe (nunca um segundo `<video>` de 2 GB). Ela prova fonte, peso, entrelinha, corpo,
  caixa, as quatro cores (a 1ª palavra acesa como a do karaokê), coluna e alinhamento. **Desde
  2026-09-28 ela mostra a PÁGINA do export** (≤ 2 linhas de conteúdo, sob o player —
  `legPaginaEm`), vinda da rota (`paginas`, do `captions.paginas_remotion`): nenhuma paginação no
  site. Sem páginas da rota (ou páginas de falas velhas) → frase de exemplo, **nunca a fala
  inteira** (a torre de linhas + caixa com `clone` + texto da cor da caixa era o bloco claro do
  P9). A palavra acesa herda o peso (`font-weight: inherit`; como `<b>` o Chrome sintetizava 900),
  e `overflow-wrap: normal` (o `break-word` partia "historicame/nte"). O `capTick` troca a página
  comparando com a mostrada (`data-pagina`), não pelo `CAP_TOCANDO` — depois de um re-render a
  prévia ficava presa na 1ª fala. A rota recebe as falas corrigidas (`legGeoFalas`); correção
  digitada re-pede após 400 ms (`legGeoAgendar`). Números vão em pixels do QUADRO
  (1080×1920) como custom properties **sem unidade**, e o CSS os multiplica por
  `--px: calc(100cqh / 1920)` — unidade de container, não `scale()` calculado em JS.
- **Camada B — o quadro real, sob demanda.** `/api/remotion-still` roda `npx remotion still`
  com os props que o `render_props` monta para o MP4 (um dono só), no quadro do MEIO do
  corte — o começo cai dentro dos 4s do card do título. Cache por hash dos props, então
  reapertar sem mexer em nada é de graça. Todo desfecho fala (BP-008): pedindo, pronto (com
  a âncora que o servidor resolveu, lida do `X-Clip-Legenda-Base`) e falhou com o motivo.
- **O download rápido (FFmpeg/ASS) avisa o que não reproduz** **[Superado no editor em 2026-10-01 — ver "Editor em ferramentas".]**, ao lado do próprio botão:
  `ASS_NAO_REPRODUZ` espelha `captions.ASS_NAO_REPRODUZ` (check 33j2).

## Validação
`node test-video-ops.js` · `node test-video-ops-dom.js` — ou `.\provas.ps1`.
`node test-video-ops-rec.js` fica **fora** do `provas.ps1`: rode-o à mão ao mexer na
recomendação.
