# Estúdio — caption editor, fix round: real 9:16 frame, caption in both modes, free placement

## Context
- Repo: Dootu (this folder). This fixes the 2026-09-25 delivery (9:16 preview, "Ajustar à mão", `posicaoXPct`, Profundidade), which is in the working tree, UNCOMMITTED. Current total: **2233** checks (`CLAUDE.md`).
- Read `CLAUDE.md`; follow `.claude/rules/estudio-ui.md`, `estudio-remotion.md`, `estudio-video-worker.md`. Invoke `emil-design-eng` before any UI/CSS work (mandatory). If installed, apply `karpathy-skills` and `ui-ux-pro-max-skill`. Do NOT follow the `remotion-edit` skill (this is editor code, not a clip edit).
- Never `git reset` / `git checkout -- <path>` / `git stash` / `git clean`. Do not commit. Don't read `video-ops.js` / `serve.py` whole — grep and small scripts.
- Code comments and UI strings in PT-BR.

## What I see (two screenshots) and what the code says
- **P1. Tiny frame, black pillarbox.** In "Como sai 9:16" the stage stays 16:9 (`aspect-ratio: 16 / 9`, `max-height: 58vh`) and `.yt-src-quadro` is `width: calc(100cqh * 9 / 16)`. On my screen: stage ~755×420, frame ~235 px wide (31% of the stage), caption drawn at ~15 px.
- **P2. Native controls cover the caption.** In this mode the `<video controls>` box IS the video band, so Chrome's control bar sits on the lower part of the band. That is exactly where the automatic caption lives: base at y 1215 of 1920, 49 px above the band's bottom (1264). While paused (= while editing) the bar never hides.
- **P3.** "Fundo aproximado" floats at the stage's top-left over the black area: `.yt-src-fundo-rot` is a child of `.yt-src-stage`, outside `.yt-src-quadro`.
- **P4.** The frame has no visible edge (bands are darkened to 18%, correctly), and the band blur shows dark halos at the seams: `filter: blur()` on spans with `left:0; right:0` samples transparent pixels. `Fundo` in `Clip.jsx` avoids this by extending the blurred layer by `fundoDesfoque`; the preview doesn't.
- **P5. "Original 16:9" hides the caption** (`.yt-src-stage[data-modo="original"] .vop-leg-prev { display: none }`, from the last round). I now want it visible there too.
- **P6. Lateral movement is millimetric.** `captions.coluna_x` clamps the invisible COLUMN (default `largura` 820 = x 130–950), with `MARGEM_LATERAL` 40 on the left and `TRILHA_X` 930 on the right. Real output: at 820 → range 42–50%: 86 px left, 0 px right (19 px / 0 px on screen). The first 2% are eaten by the center magnet (`LEG_X_IMA`). Even at the 360 minimum: 313 px left / 205 px right. The operator never sees the column; it's what blocks the move.
- **P7. Locks instead of freedom.** Manual vertical range is `[0, 86]`: 86% (`ZONA_UI_PCT`) blocks the bottom, and 0% allows a 2-line page to be cut at the top (no top guard).
- **P8. The preview's typography lies.**
  - (a) The active word is `<b data-leg-prev-ativa>` with no weight rule, so it gets `bolder` = 900. `index.html` loads only Montserrat 800 (Inter up to 800), so Chrome SYNTHESIZES 900: wider and blurrier than the export. "EMPREENDEDORES," is 15 chars × 72 px × 0.731 (impacto) ≈ 790 px and fits the 820 column in the export, but spills past the column in the preview.
  - (b) The preview draws the whole current cue (`legPrevFalaHTML(entry.cues[idx].text …)` in `capTick`), not the ≤ 2-line page the export shows. With a narrow column this becomes a tower of lines.
- **P9. Unknown: a light-gray box above the caption** (screenshot 2). It is the width of the column, runs from the top of the frame down to the caption line, has rounded bottom corners, and the dashed drag outline surrounds it. It covers the top band and part of the video. Find the root cause in the DOM. Suspects, in order: P8b + caixa de fundo + text color equal to the box; the Profundidade transform; a leftover element. Don't guess.

## Decisions (Arthur, 2026-09-28) — don't reopen
1. **Free placement.** I can put the caption anywhere in the 9:16 frame.
   - The ONLY hard limit: the text never leaves the frame. Keep 40 px (`MARGEM_LATERAL`) from every edge, plus a top guard so a full 2-line page fits.
   - Platform zones become WARNINGS, not locks: the TikTok right rail (x ≥ `TRILHA_X` 930) and the bottom UI zone (y ≥ `ZONA_UI_PCT` × 1920).
   - The AUTOMATIC anchor keeps avoiding them exactly as today.
2. **Sideways = the column narrows, the font doesn't.**
   - When the requested X doesn't fit, Python narrows the column (lines get shorter) instead of stopping. Moving back toward the center widens it again, up to `largura`, which becomes the operator's MAXIMUM.
   - Floor = the estimated width of the longest word of THIS cut at the current font/family/case, so no word is ever cut. Only when even the floor doesn't fit does X stop.
3. **Caption visible and draggable in both modes.** In "Original 16:9" it is drawn in the right place over the source. Where the frame isn't video (the blurred bands) it can't be shown there, and the screen says so.
4. **"Como sai 9:16" = a big frame.** The stage itself becomes the 9:16 frame (no black pillarbox). Native controls only in "Original 16:9"; here, a compact control bar BELOW the frame. Label inside the frame, visible frame edge.
5. **The preview shows the page the export shows** (≤ 2 lines, real line breaks, real weight).
6. Record in `CLAUDE.md` (Estúdio section, one short paragraph dated 2026-09-28) and in the rules: this replaces the 2026-09-25 locks (`trilha` clamp, 86% manual clamp, overlay hidden in 16:9).

## Invariants (unchanged)
- **Python is the only owner of geometry and pagination limits:** `captions.margem_inferior`, `captions.coluna_x`, `serve.legenda_geometria`, `serve.render_props`. No formula in the site: checks 33g6 and 35h forbid `RODAPE_PCT` / `ZONA_UI_PCT` / `TRILHA_X` / `MARGEM_LATERAL` in `video-ops.js`. Zone guide positions and all bounds come from the route as numbers.
- Three copies of `editOf` as literals (33a–33b); `resolveLegenda` resolves once; pure exported functions called by tests (no regex over JSX); sabotage only in a temp COPY.
- No new npm dependency, no new localStorage key, no migration. One `<video>` (`srcAdopt`); switching modes never recreates it.
- BP-001, BP-008 (every branch speaks, including warnings), BP-013, BP-014.
- `.yt-src-stage` traps still apply: `container-type: size` needs a determined size; never `margin-inline: auto` there.

## Mandatory order

### Phase 0 — confirm and plan (NO edits)
1. `.\provas.ps1` green at 2233. If not, stop and report.
2. Reproduce P1–P9 in Chrome (`.\estudio.ps1`, http://127.0.0.1:8765) with numbers. For P9, inspect the DOM (`.vop-leg-prev > span` and children, computed styles), isolating style / combination / caixa / Profundidade, and give the root cause.
3. Plan with exact names:
   - new/changed fields, props and route payload;
   - how the longest word is measured: per-character advances measured from `video-worker/fonts/` with fontTools (the method that produced `AVANCOS`), or the average × a safety factor you justify by measuring 3 real long words in a Remotion still;
   - the top guard (add the style line height to `captions.LEGENDA_ESTILOS`, parity-checked against `LEGENDA_PRESETS` like 34a — no invented numbers);
   - the tests that encode the old locks and will change.

**Stop and wait for my OK.**

### Phase 1 — geometry and pages (Python, single owner)
- **`coluna_x`:** effective column = the widest ≤ `largura` that fits at X within [40, 1040]. Never below the floor; clamp X only when the floor doesn't fit.
  - Return: effective width, floor, the word that set it, bounds of `posicaoXPct` for this cut, and warning flags (`trilha` when the column's right edge > 930).
  - ASS: MarginL/MarginR and `max_linha` from the effective width.
- **`margem_inferior` for MANUAL positions:** base y ∈ [40 + 2 lines × size × line height, 1920 − 40]; flag `rodape` when base y > `ZONA_UI_PCT` × 1920. Automatic unchanged.
- **`legenda_geometria` / `/api/legenda-geometria`:**
  - The body also takes the cut's (corrected) cues — the same ones the export sends.
  - Returns: the bounds; the zones in output px (for the guides); the flags; and the PAGES (`to_pages` with the effective `max_linha`: text + start/end relative to the cut).
  - `render_props` uses the same function with the export's cues. A test asserts route == render_props for the same input.
  - If no existing check proves `to_pages` ≡ `toCaptionPages`, add one.
- **Remotion:** new prop (e.g. `legendaColuna`), sent only when X is manual; a pure guard in `preset.js`; `resolveLegenda` uses it once for layout AND pagination (`tetoDaPagina`).
- **Old clips:** no `posicaoXPct` and manual `posicaoPct` ≤ 86 → byte-identical props / ASS / still hash.
  - A manual `posicaoPct` > 86 (only possible before 2026-09-25) now renders where it was dragged. Intended — say it in the report.

### Phase 2 — preview fidelity (P8, P9)
- Active word keeps the page's weight (`font-weight: inherit`, or a `<span>`), so nothing is synthesized. Check the other preview elements for the same trap.
- The preview shows the current PAGE from the route. The page for the player's time goes through `capTick`; when paused, the page under the playhead. Fall back to the first page — never the whole cue.
- Fix P9 at its root cause.

### Phase 3 — the 9:16 frame and controls (P1–P4)
- **Stage = frame** in `data-modo="saida"`:
  - `width: min(100%, calc(H * 9 / 16)); aspect-ratio: 9 / 16; max-height: none; justify-self: center` (grid alignment, never auto margins). Keep `container-type: size`.
  - H = the tallest value that keeps the whole sticky left column (mode radio + frame + bar + note + meta row) inside the viewport; floor ~360 px. Measure at 1440×600 and 1440×900.
  - `.yt-src-quadro` fills the stage.
- **Look:** label inside the frame (corner of the top band); 1 px subtle edge + radius; band blur extended by the blur radius like `Fundo` (no halos).
- **Controls:** `video.controls` only in "Original 16:9", on the same node (no re-creation, `currentTime` kept). Below the frame, a compact bar:
  - play/pause;
  - time relative to the cut (`srcNow()` / `srcSeek()` + `inSec` / `outSec`);
  - a seek bar limited to the cut; space toggles play when the stage/bar has focus.
  - "Marcar trecho daqui" keeps working. Emil rules: `:active scale(.97)`, no `transition: all`, < 300 ms.

### Phase 4 — caption in "Original 16:9" (P5)
- In "Original 16:9", `.yt-src-quadro` becomes the OUTPUT frame mapped onto the source:
  - s = displayed video content height ÷ `videoAltura`. Read the `<video>` content rect under `object-fit: contain`; don't assume 16:9.
  - Box = 1080·s × 1920·s, centered on the displayed content, top = content top − `bandaAltura`·s. The stage clips it.
  - The existing overlay (× `--px`) then lands on the right pixel; crop11/crop45 go through the same numbers (the mask stays).
  - Update on `loadedmetadata` and resize, without re-render.
- The drag keeps working (it measures `.yt-src-quadro`). The same screen point on the video must give the same `posicaoPct` / `posicaoXPct` in both modes (test).
- Caption outside the video → "A legenda está na faixa de fundo, fora do vídeo — veja em Como sai 9:16."

### Phase 5 — panel, warnings, guides
- "Posição" / "Posição lateral" use the new bounds. Move "Alinhamento" and "Largura do texto" out of "Ajustes avançados", next to "Posição lateral": to hug an edge I pick Esquerda/Direita.
- Replace the old lock messages ("Parou antes da trilha…", "Parou acima da zona…", "Sem espaço para os lados…") with:
  - "A coluna estreitou para caber aqui (usando 460 px de 820)."
  - "A palavra mais longa deste corte (“EMPREENDEDORES,”) não deixa ir além daqui — diminua o Tamanho para chegar mais perto da borda."
  - "A legenda entrou na faixa dos botões do TikTok — pode ficar atrás deles."
  - "A legenda entrou na faixa do texto do TikTok (nome e descrição) — pode ficar atrás dele."
- **Zone guides:** shown in the 9:16 frame while dragging and while the caption is inside a zone. Translucent, labeled "Botões do TikTok (aprox.)" / "Texto do TikTok (aprox.)", numbers from the route. The rail's vertical extent isn't documented: draw it full height, mark it approximate, don't invent numbers.
- Keep `LEG_X_IMA`, but measure that it doesn't eat usable travel.

### Phase 6 — tests, stills, Chrome, docs
- **Tests:**
  - elastic column + floor with constructed words;
  - top guard; manual below 86% allowed + flag; automatic unchanged; old clips identical;
  - route == `render_props` (cues included); pages;
  - DOM: `controls` toggles on the same node; bar seeks inside the cut; label inside the frame; overlay visible in both modes; drag parity between modes; wide ranges; active word weight inherited.
- `.\provas.ps1` green; paste the `Checks:` line it prints into `CLAUDE.md`.
- **Stills** (`cd studio; node preview-legenda.mjs <folder>`): the four extremes with a real long word; narrowed column; bottom zone; top guard; Profundidade Funda at an edge. LOOK at each; nothing may leave the frame.
- **Chrome:** widths 390 / 800 / 1100 / 1198 / 1440, heights 600 / 900:
  - frame exactly 9:16 (±1 px), never collapsed, no horizontal overflow;
  - "Como sai 9:16" and the 16:9 overlay vs "Ver o quadro real" at the extremes: base, left edge and line breaks within a few output px.
- **Docs:** `CLAUDE.md`, `estudio-ui.md`, `estudio-video-worker.md`, `estudio-remotion.md` — replace the 2026-09-25 lock rules; keep it short.

## Acceptance
- Frame noticeably bigger than today at the same window (report the px).
- With `classico` 58 and a cut whose longest word has ≤ 9 letters, the text center reaches ≤ 20% and ≥ 80% of the frame width. Report the real range for classico / impacto / podcast on the cut I'm testing.
- No page ever leaves the frame; no synthesized weight in the preview; the preview shows the same page as the still.

## Out of scope
Style values, karaokê timing, neon fan, title cards, text correction, reframe logic, `ytclip.py`, publishing/TikTok, Resultados, other modules. Report anything else you notice; don't fix it.

## Deliverable (reply in PT-BR)
1. Causa raiz de P1–P9 (números)
2. O que mudou — uma linha por arquivo
3. Campos, props e rota (nomes, faixas, padrões)
4. Provas: saída do `provas.ps1` + nova linha `Checks:`
5. Stills (caminhos) e comparação prévia × quadro real
6. Faixa lateral real alcançada por estilo
7. Riscos, pendências e próximo passo
