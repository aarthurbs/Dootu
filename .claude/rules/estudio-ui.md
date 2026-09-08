---
paths:
  - "video-ops.js"
  - "video-ops.css"
  - "test-video-ops*.js"
description: Regras ativas da tela do Estúdio de Vídeos (5 telas, INTAKE, Central de Clips).
---

# Estúdio de Vídeos — tela (`video-ops.js` / `.css`) — regras ATIVAS

Histórico e medições: `docs/01-Wiki/archive/HISTORICO-estudio-video.md`.

## As CINCO telas, e nada além (decisão do usuário, 2026-08-21)
`data-view="video-ops"` / `#video-ops-root` / CSS externo `video-ops.css`.
Fluxo `1 Vídeo` (`overview`) › `2 Cortes` (`cuts`) › `3 Clips` (`review`), mais
`Central` (`central`) e `YouTube` (`youtube`) em escala menor. `FLOW_HINT` = uma
frase por tela. **O fluxo acaba no Passo 3** — depois de baixar não existe passo.

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
