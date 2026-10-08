# Estúdio — editor as tools: fixed tool bar + right panel, fixed screen, no explanatory text

Goal: turn the cut editor into a CapCut-like workspace done my way. I pick any tool from a fixed bar, its controls appear in the right panel, nothing scrolls, and the screen shows tools only: no explanations, hints, diagnostics or warnings.

## Context
- Repo: Dootu (this folder). Working tree is UNCOMMITTED (plus line-ending noise). Baseline per `CLAUDE.md`: **2420** checks (`test-video-ops.js` 187 and `test-video-ops-dom.js` 302 were green on 2026-10-01).
- Read first (`docs/INDEX.md`, "Início de uma sessão técnica"): `docs/Constituicao.md`, `docs/01-Wiki/ESTADO-ATUAL.md`, `docs/02-Execution/PENDENCIAS.md`, `CLAUDE.md`. Main rules for this work: `.claude/rules/estudio-ui.md`. Grep `docs/01-Wiki/archive/HISTORICO-estudio-video.md` before changing any measured number or guard.
- Invoke `emil-design-eng` before any UI/CSS work (mandatory, CLAUDE.md §5). If installed, apply `ui-ux-pro-max-skill` (layout) and `karpathy-skills`. Do NOT follow `remotion-edit` (this is editor code, not a clip edit). If you fan out sub-agents, load `workflow-sobrevivente` first.
- Never `git reset` / `git checkout -- <path>` / `git stash` / `git clean`, never normalize line endings, never `git add -A`. Do not commit. Read-only git with `git --no-optional-locks`. Don't read `video-ops.js` (~8k lines) or `video-ops.css` (~3.6k) whole: grep and small scripts.
- UI strings and code comments in PT-BR.
- If at any step you can't drive Chrome, say so and give me a manual checklist. Never report a check you didn't run.
- Scope = the editor only (what `ytDetailHTML` renders after "Editar" on a cut) + the analysis note `.yt-analysis-note` (also above the grid) + the explanatory note of the shared import strip. No server, Remotion or data-model change.

## What the code does today (re-confirm in Phase 0)
- `ytWorkHTML` renders `<p class="yt-analysis-note">` (`YT.note`) above the editor and above the grid. That is the text "Este vídeo não publica o gráfico de “Mais reproduzidos”…; Descartei trechos…; MuAPI sem credito (HTTP 402)." It is composed server-side (`video-worker/ytclip.py`, `muapi.py`) and their tests check it: don't touch the server.
- `ytDetailHTML` = `.yt-detail-top` (back button + `status.chip`) → `.yt-detail-grid` (two columns from `@container hub (min-width: 800px)`; `#main` is the page scroller, so the left column is `position: sticky`):
  - Left `.yt-detail-main`: `ytStageHTML` → `srcPanelHTML` (THE one `<video data-src-video>`, `legModoHTML` Original 16:9 | Como sai 9:16, `legBarraHTML`, `.vop-leg-prev-nota`, "Fundo aproximado", `.yt-src-meta` with "Marcar trecho daqui" `yt-manual`, `.vop-warning`) → `.yt-detail-title` (`data-clip-field="topic"`) → `.yt-detail-boundary` (`BOUNDARY_MSG`) → `<details class="yt-detail-sobre">` (hook, reason, signals) → `ytFactorsHTML` (`.yt-factors` + `.yt-factors-note`).
  - Right `.yt-detail-side`, one long column: `ytTrimHTML` (with `.yt-trim-note` "O Estúdio fecha o corte no fim da frase…") → `cardStyleFieldHTML` → `capPanelHTML` → `legendaPanelHTML` → `capaPanelHTML` / `musicaPanelHTML` / `remocoesPanelHTML` / `textosPanelHTML` / `zoomsPanelHTML` (each a `<details class="vop-capa …">` with a `.vop-capa-resumo` line; open state in `CAPA_ABERTA` / `MUS_ABERTA` / `REM_ABERTA` / `TXT_ABERTA` / `ZOOM_ABERTA`) → `reframeFieldHTML` → `.yt-detail-acts` (`yt-fetch`, `yt-render`, `yt-render-limpo` + the `.vop-leg-ass` FFmpeg paragraph) → `status.nota` and "Exportar está bloqueado" as `.vop-warning`.
  - `CARDS_OPEN ? cardsPanelHTML()` renders the card library BELOW the grid.
- Text found in the editor (starting list, complete it in Phase 0): `.yt-analysis-note`, `.yt-trim-note`, `.yt-detail-boundary`, `.yt-factors-note`, `.vop-leg-ass`, `.vop-warning`, `.yt-stage-note`, `.yt-imp-note` (`srcStripHTML`, shared with the grid), `.vop-leg-prev-nota` (`legModoNota`), `.vop-leg-state` (`legendaEstadoFrase`), `.vop-leg-nota`, `.vop-leg-dica`, `.vop-leg-still-msg`, `.vop-cap-note` (`capMessage`), `.vop-cap-hint`, `.vop-cap-save` (`capSaveText`), `.vop-card-state` (`cardPickState`), `.vop-reframe-aviso`, `.vop-capa-resumo`, `.vop-capa-dica` (static ones + `REM_MSG` / `TXT_MSG` / `ZOOM_MSG` / `MUS.importMsg`), `.vop-capa-aviso`, menu `<small>` descriptors, and every `toast()` fired from an editor action (e.g. `ytTrimResult`).
- Contracts the tests READ (keep them even if the editor stops rendering them): `CAPTIONS_MSG`, `IMPORT_MSG`, `MUSICA_MSG`, `MUSICA_IMPORT_MSG`, `backgroundMessage`, `ASS_NAO_REPRODUZ` (33j2), and every phrase map checked by `test_serve.py` (21t0 / 28o2 / 30d / 32a) or by `test-video-ops.js`.
- Shell: `#app` (100vh) → `.layout` (overflow hidden) → `#main` (overflow-y auto) → `#view-video-ops` (max 1200px) → `#video-ops-root` (header + tabs + `.vop-body`) → `.yt-hub` (container `hub`) → `.yt-hero` (only when the declaration is missing) → `.yt-detail`. The 9:16 stage uses `--quadro-h: max(360px, 100dvh − header − 236px)`.
- Patterns to reuse: native radios for choices (`legModoHTML`, `reframeFieldHTML`), module state without localStorage (`PREVIA_MODO`), switching without `render()` (`legModoTroca`), BP-001 writes, `srcAdopt` (keeps the `<video>` node), in-place repaint (`capPaint`), named download menu (`ytDownloadHTML` / `YT.dlMenu`, Esc closes it).

## Decisions (Arthur, 2026-10-01) — don't reopen
1. Not a sequence or wizard. A FIXED vertical tool bar sits BETWEEN the video and the right panel; clicking a tool shows only that tool's controls in the right panel.
2. Fixed screen: with the editor open the page doesn't scroll. Video, tool bar, title and export are always visible.
3. Tools only — "nada, nem aviso". Allowed text: (a) names of tools, sections, fields and buttons; (b) values (times, duration, size, %, track and card names, list items) shown as values ("Automática", not "Automática, dentro da imagem."); (c) a control's own label showing its state ("Renderizando…", "Importando 40%", "Gerar de novo", "Falhou · tentar de novo", never the reason). Allowed visual state: disabled, checked, progress bar, `data-manual`, `data-removida`, `aria-invalid` outline, the tool dot. Everything else goes: explanations, hints, diagnostics, warning lines, status sentences, tooltips with reasons, toasts.
4. My two examples, both must disappear: (1) "Este vídeo não publica o gráfico de “Mais reproduzidos”; nenhuma sugestão cita audiência. Descartei trechos: 21 começavam no meio da ideia; 16 não se entendiam sozinhos; 6 não diziam a que vinham no começo. MuAPI sem credito (HTTP 402)." (2) "O Estúdio fecha o corte no fim da frase. Ajuste para onde quiser — inclusive fora do intervalo sugerido: “daqui” usa o ponto em que o player está. Mudar a borda descarta o vídeo que você já exportou DESTE trecho (ele era de outro intervalo); o vídeo importado não é tocado."
5. The analysis note (`.yt-analysis-note`) goes everywhere, editor and grid. `YT.note` / `project.note` stay in the data.
6. "Por que este trecho foi sugerido" + the detector score move to the LAST tool, **Análise**, shown only when there's something to show. It is the only place with explanatory content.
7. Title and export move to the top bar.

## Target layout (two-column mode)
```
← Todas as sugestões  [Título do corte ...............]    [Baixar ▾]
┌──────────────────────┬────────────┬──────────────────────────────┐
│                      │ Corte      │ LEGENDA                      │
│                      │ Enquadrar  │ Texto · Estilo · Posição · … │
│        VÍDEO         │ Legenda •  │                              │
│ Original | Como sai  │ Card       │ only the active tool         │
│                      │ Texto      │                              │
│                      │ Zoom       │                              │
│ ▶ 0:12 ━━━━━━ 0:48   │ Música •   │                              │
│                      │ Capa       │                              │
│                      │ Análise    │                              │
└──────────────────────┴────────────┴──────────────────────────────┘
```
- Top bar (`.yt-detail-top`): back button; the title input moved here (same `class="yt-detail-title"`, `data-clip-field="topic"`, aria-label); export menu on the right with "Baixar vídeo editado" (`yt-render`), "Baixar trecho original" (`yt-fetch`), "Editado, sem legenda" (`yt-render-limpo`). Same handlers, named-menu pattern, the trigger label carries the busy/failed state. No `status.chip`, no descriptors.
- Left `.yt-detail-main` = the player only (stage, mode radio, own bar). Without a source: the frame + "Importar vídeo" + progress bar.
- Right `.yt-detail-side` = tool bar + panel. Keep both class names and the order main → side (the DOM helper `colunaEsquerda` depends on it).

| Tool | Contents (reuse the builders; change wrappers, not internals) |
|---|---|
| Corte | `ytTrimHTML` + `remocoesPanelHTML` + "Marcar trecho daqui" (`yt-manual`, same handler) |
| Enquadrar | `reframeFieldHTML` |
| Legenda | sub-tabs: Texto (`capPanelHTML`) · Estilo (looks, Tamanho, combos, "Escolher cada cor") · Posição (vertical, lateral, alinhamento, largura) · Profundidade (+ Ângulo) · Avançado (rest of "Ajustes avançados"); "Voltar ao padrão" and "Ver o quadro real" in the tool header |
| Card | `cardStyleFieldHTML`; "Gerenciar cards" opens `cardsPanelHTML` INSIDE this panel (with Voltar), never below the workspace |
| Texto | `textosPanelHTML` |
| Zoom | `zoomsPanelHTML` |
| Música | `musicaPanelHTML` |
| Capa | `capaPanelHTML` |
| Análise | hook, reason, signals, score and factors (from `.yt-detail-sobre` + `ytFactorsHTML`) as a plain section; the `.yt-factors-note` paragraph becomes the heading "Nota interna (só ordena a lista)" |

The Legenda grouping is a starting point: merge or split sub-tabs only so each view fits at 1366×768. `<details>` inside a sub-tab ("Horários (avançado)", "Escolher cada cor") may stay, with `LEG_MAIS` keeping their open state.

## Interaction contract
- Tool bar = native radio group (`name` with the clip id). `:checked` draws the active tool; panel visibility by CSS (`:has()`), zero JS visual state. On `change`: write module state `YT_TOOL` (session only, no localStorage), no `render()`. Legenda sub-tabs: same pattern (`LEG_ABA`). Follow the hidden-radio rule of estudio-ui.md (positioned ancestor; never `display:none` / `visibility:hidden` on the input).
- Every tool panel stays in the DOM; only the active one is visible. Handlers, `capTick` / `textosTick` / `zoomTick`, the music `<audio data-mus-audio>`, geometry updates and the existing checks keep working. Re-render restores `YT_TOOL` / `LEG_ABA`. Default: Corte on the first open of the session; afterwards the last tool used, also when opening another cut.
- The Capa / Música / Remover / Texto / Zoom `<details>` become plain sections (title only); the `*_ABERTA` toggles this orphans are removed (BP-007 check first).
- Tool dot: small dot on the bar item when the cut has a non-default value in that tool (derive each condition from the model; list them in the plan). No text, a single colour. Repaints in place on writes that don't render.
- A text or zoom fully inside a removed span gets the same `data-removida` look as removed falas. No text.
- Failures show only on the control that triggered them: invalid or refused input → `aria-invalid="true"` + danger outline until the next interaction; failed action (export, still, cover PNG, music import) → its label becomes "Falhou · tentar de novo" until clicked. While the editor is open no `toast()` is shown (one guard, not dozens of edits); outside the editor toasts are unchanged.
- Motion (Emil): tool switching happens tens of times per session → no panel animation, instant swap. Bar items `:active { transform: scale(.97) }` ≤ 160 ms with the project's ease-out; never `transition: all`; no glow; respect `prefers-reduced-motion`.
- Keyboard: arrows move within the tool bar (native radios); Esc still closes only the download menu; Space still plays with focus on the stage/bar.

## Fixed-screen contract
- Fixed mode = the hub in two-column mode (container ≥ 800px, today's breakpoint) and a viewport ≥ 600px tall. Otherwise: stacked fallback (video first, tool bar as a horizontal strip, page may scroll), no horizontal overflow from 360px.
- Columns: video `minmax(0, 1fr)` · tool bar `auto` · panel with a fixed comfortable width. This replaces the 1.35fr / 1fr split. The narrowest field in the panel stays ≥ 75px.
- Height comes from a flex/grid chain with `min-height: 0` from `#main` down to `.yt-detail`, scoped to "editor open" (e.g. `:has(.yt-detail)`), not from new magic offsets. `#main` doesn't scroll in fixed mode (its vertical padding may shrink, scoped). When the declaration is missing, `.yt-hero` sits above and the workspace shrinks; still no page scroll. Prefer `video-ops.css`; if `index.html` / `design-system.css` must change, read `.claude/rules/modulos-index-html.md` first.
- Remove the sticky left column in fixed mode (nothing scrolls).
- The 9:16 stage is sized by the left column's real height (replaces the `--quadro-h` offset), exact 9:16 (0 px error), keeping the `container-type: size` + determinate height + ring rules. Lower the 360px floor only as far as needed.
- Only the panel body scrolls (`overflow-y: auto`, `overscroll-behavior: contain`), and only as a fallback. At 1366×768 every view fits with NO internal scroll, except long lists (Legenda → Texto, removals, texts, zooms, card library).
- BP-013: the panel body is now a scroll container, so `render()` must preserve its `scrollTop` per tool (`renderKeepingScroll` only saves the window today).
- Starting values (measure, record the finals): panel 380–420 px · tool bar ≈ 96 px · dot 6 px · press feedback 120–160 ms.

## Invariants (unchanged)
- No server / Remotion / model / persistence change; no new localStorage key; no migration. Same edits ⇒ identical `renderBody`.
- Exactly ONE `<video data-src-video>`; `srcAdopt` keeps the node, so switching tools or re-rendering never resets playback.
- Rights gate untouched (`ytFetchGate`, `.yt-hero`, the declaration label and its legal text).
- The contracts above stay. BP-001, BP-007, BP-012, BP-013, BP-014. "Remotion" never appears in the UI.
- Delete only what THIS change orphans (helpers, CSS rules, checks that asserted only removed text). Never neighbouring code.

## Mandatory order
### Phase 0 — confirm and plan (NO edits)
1. `.\provas.ps1` green at 2420 with the CLAUDE.md line matching. If not, stop and report.
2. Pending from 2026-10-01 (ESTADO-ATUAL): `.\estudio.ps1`, open one cut in Chrome, screenshot the CURRENT editor at 1366×768 and 1440×900 (baseline). Note anything broken in the five sections of the last delivery: report, don't fix.
3. Re-confirm "What the code does today" with grep (names, lines). With a script, list every text the editor can render (nodes, attributes, toasts) and classify each one: REMOVE / KEEP-name / KEEP-value / CONTROL-STATE / ANÁLISE.
4. Plan in `docs/02-Execution/PLANO-editor-ferramentas.md` (linked from `docs/INDEX.md`): final tool map and sub-tabs, the inventory, the dot condition per tool, the failure label per control, DOM checks to rewrite and to add, CSS approach for the height chain.

**Stop and wait for my OK.**

### Phase 1 — remove the text (layout unchanged)
- Apply the inventory per decision 3; remove `.yt-analysis-note` in both places; toast guard; failure labels. ANÁLISE items stay as they are until Phase 2.
- Rewrite (never just delete) the DOM checks whose subject changed, so they assert the new decision. At least: "a tela de detalhe diz DE ONDE vem a borda do corte", "e ele diz, sem ajuste nenhum, que esta tudo automatico", "o quadro real e oferecido, e a previa em CSS se declara aproximacao", "e o download rapido avisa, ao lado do proprio botao, o que ele nao reproduz". Add: none of the removed classes renders in the editor; `.yt-analysis-note` renders nowhere; no toast while the editor is open; the contracts are still present.
- `.\provas.ps1` green; paste the `Checks:` line it prints into CLAUDE.md.

**Stop and wait for my OK** (I look at it in the browser).

### Phase 2 — tool bar, panel, fixed screen
- Order: `emil-design-eng` → markup (top bar, tool bar, panels, sub-tabs, Análise, card library inside Card) → CSS (height chain, bar, panel, 9:16 sizing, fallback) → state (`YT_TOOL`, `LEG_ABA`, dots) → tests → `.\provas.ps1`.
- Rewrite: "o titulo do trecho continua editavel e ligado ao campo que grava" (now in the top bar), "o texto do detector fica fechado, sem empurrar o video para baixo" and "a decomposicao da nota fica aqui, e diz que nao e previsao de desempenho" (now in Análise), "texto e aparência são duas áreas com nome" and "o essencial fica a vista e o resto recolhido" (now sub-tabs).
- Add: the bar lists the tools in order, with Análise only when there's content; one panel per tool, `checked` = `YT_TOOL`; a check that READS `video-ops.css` and finds the visibility rule of every tool; switching tools doesn't call `render()` and keeps the same `<video>` node and `currentTime`; `YT_TOOL` / `LEG_ABA` survive a re-render and opening another cut; export menu and title in the top bar; still one `<video>`; the music `<audio>` survives a tool switch; the panel `scrollTop` survives `render()`; card library inside Card.
- Sabotage a temp COPY (never the repo): render only the active panel; make the switch call `render()`; drop one visibility rule. The new checks must go red. Show it.

### Phase 3 — Chrome and docs
- Chrome (`.\estudio.ps1`, http://127.0.0.1:8765), one real cut, at 390×844, 800×600, 1100×700, 1280×650, 1366×768, 1536×864 and 1920×1080. For each: fixed or stacked; in fixed mode `#main` scrollHeight == clientHeight, video + bar + title + export visible, which tool views needed internal scroll; 9:16 size; no horizontal overflow. Switch tools while playing (video and music keep going, no jump); drag the caption; export one cut (the label shows busy/done); Tab/arrows through the bar. Screenshots before/after.
- Docs (short, dated, PT-BR): new section in `.claude/rules/estudio-ui.md` "Editor em ferramentas (decisão do usuário, 2026-10-01)" with the decisions, both contracts and the measured sizes. In that file, mark as superseded for the editor: the column order of "O painel reorganizado", the `<details>` of "Capa do TikTok e Música", the sticky column (2026-09-22), the `--quadro-h` numbers (2026-09-28), the boundary line "a tela escreve isso", "o download rápido avisa", "As duas prévias, e a tela diz qual é qual" and every "todo ramo fala" that put a sentence on the editor screen. One line under BP-008 in CLAUDE.md ("no editor do Estúdio o estado vive no próprio controle, sem frase na tela — decisão 2026-10-01, ver estudio-ui.md") and one line in the Estúdio top rule. Decision note `docs/03-Decisions/2026-10-01-editor-em-ferramentas.md` (append-only, linked from INDEX); ESTADO-ATUAL (state + exact next step); one line in `docs/log.md`; mark the plan delivered. No file lists or execution logs inside notes (Constituição Usee).

## Acceptance
- Editor open in fixed mode: the page never scrolls; video, tool bar, title and export always on screen.
- Clicking a tool shows only that tool, instantly, without re-render; playback isn't interrupted.
- No explanation, hint, warning, status sentence, tooltip with reason or toast in the editor; my two examples are gone; `.yt-analysis-note` is gone from the grid too.
- Every existing control still works and saves as before; same edits ⇒ same export.
- `.\provas.ps1` green with the new total in CLAUDE.md.

## Out of scope
Server, worker, Remotion and their texts · new tools or features · keyboard shortcuts · timeline · icon library · grid/hub cards, Central, Meus projetos, Resultados, entry screen and `FLOW_HINT` · rights gate · recommendation code · refactors of neighbouring code. Report anything else you notice; don't fix it.

## Stop and ask me if
Baseline red · a check or contract would have to be deleted instead of rewritten · a control has no home in the tool map · a view doesn't fit at 1366×768 even after splitting · fixed mode needs a shell change beyond a scoped rule · a rule in CLAUDE.md or `.claude/rules/` contradicts this prompt beyond what's listed · unclear where a note belongs.

## Deliverable (reply in PT-BR)
1. O que mudou — uma linha por arquivo
2. Inventário de textos: removido / mantido como nome ou valor / virou estado do controle / foi para Análise
3. Mapa final das ferramentas e subabas, e a regra de cada bolinha
4. Provas: saída do `provas.ps1` por fase, nova linha `Checks:`, sabotagem que ficou vermelha
5. Chrome: tabela por tamanho de janela + prints antes/depois
6. Caminhos que ficaram sem aviso por decisão (ex.: mudar a borda descarta a correção da legenda; cota cheia; faixa de música sumida; falha de export sem motivo), um por linha
7. Riscos, pendências e próximo passo
