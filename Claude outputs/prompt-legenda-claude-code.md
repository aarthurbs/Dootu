# Estúdio — caption editor: true 9:16 preview, fixed "Ajustar à mão", horizontal position, static "Profundidade" (tilted + extruded)

## Context
- Repo: Dootu (this folder). Read `CLAUDE.md` first. The path rules in `.claude/rules/` (`estudio-ui.md`, `estudio-remotion.md`, `estudio-video-worker.md`) load when you touch those paths — follow them. Code and rules are the source of truth; before changing a number or a guard, grep `docs/01-Wiki/archive/HISTORICO-estudio-video.md`.
- Mandatory (CLAUDE.md): invoke the `emil-design-eng` skill before any UI/CSS work. If installed, also apply `karpathy-skills` (code) and `ui-ux-pro-max-skill` (UI).
- This is a FEATURE change to the editor across the three mirrored layers (Python server, Remotion, site). It is NOT a cut edit: do not follow the `remotion-edit` skill — its "don't touch video-ops.js" rule is for editing one clip.
- The working tree has large UNCOMMITTED work (~30 files). Never run `git reset`, `git checkout -- <path>`, `git stash` or `git clean`. Do not commit.
- `video-ops.js` (~350 KB) and `serve.py` (~160 KB) are big: use grep and small scripts, don't read them whole.
- Code comments and every UI string in PT-BR, matching the codebase.

## Diagnosis (confirmed by running the real functions — re-confirm in Phase 0)
- **D1. The CSS preview (camada A) uses the wrong geometry.** `.vop-leg-prev` lives inside `.yt-src-stage` (`aspect-ratio: 16 / 9`, the ORIGINAL source player) but uses `--px: calc(100cqh / 1920)` and `bottom: calc(100% - var(--leg-pos))`, i.e. it treats the 16:9 source box as if it were the 1080×1920 output. With a 16:9 source in `blur`: the caption is drawn ~3.16× smaller relative to the video than in the export (1920/608); the 820 px column covers 24% of the stage width vs 75.9% of the frame; `posicaoPct` is measured on the source height, not on the 1920 frame. Dragging records positions that don't match what the operator sees.
- **D2. "Ajustar à mão" pushes the caption out of the video.** `data-act="leg-posicao"` and the first drag from automatic write `LEGENDA_POSICAO_PARTIDA = 75`. Default `blur` + 16:9 source: video band y 656–1264, automatic base y 1215 (`captions.margem_inferior(1920, 608)` → legendaBase 705). 75% puts the base at y 1440: 225 px lower, OUTSIDE the video, on the blurred band. crop11: +26 px; crop45: −87 px.
- **D3. No horizontal position exists.** The column is always centered (`left: (1080 − largura) / 2` in the `Legenda` of `Clip.jsx`; symmetric MarginL/MarginR in `captions.to_ass`). Only `alinhamento` (text align inside the column) and `largura` exist.

## Decisions already made (Arthur, 2026-09-25) — don't reopen
1. **Preview:** the SAME player gets a native segmented radio "Original 16:9 | Como sai 9:16". "Como sai 9:16" is the default when a cut is open in the editor; the choice is module state for the session (no localStorage key). Still exactly ONE `<video>` — switching modes must not recreate it (`srcAdopt`), must keep `currentTime`, and "Marcar trecho daqui" / boundary editing must keep working in both modes.
2. **"Ajustar à mão"** starts from the clip's REAL automatic anchor (resolved in Python), not from 75.
3. **Horizontal position:** new intention in `clip.edit.legenda` (proposed `posicaoXPct`, 0–100 = center of the column as % of the frame width; absent = centered = today). In the 9:16 preview the drag moves X and Y; plus a slider row "Posição lateral".
4. **Profundidade:** new control "Nenhuma · Suave · Funda" (closed set, proposed `profundidade`) available in all six styles. Look = tilted back + volume: `rotateX` with the pivot on the text BASE (top lines recede, base stays on the anchor) AND thickness via stacked hard text-shadows (no blur). STATIC: no animation, no dependency on time/frame; the page still doesn't animate; only the existing active-word pop stays. Absent/Nenhuma → every saved clip renders byte-for-byte as today.
5. This opens a documented exception to the BUSINESS_SERIOUS direction (like the neon fan). Record it, dated 2026-09-25, in one short paragraph in `CLAUDE.md` (Estúdio section) and in `estudio-remotion.md` / `estudio-ui.md`, together with the end of the "manual position starts at 75" rule.

## Invariants (from the rules — breaking one is a bug)
- **Python is the ONLY owner of geometry:** `serve.video_box`, `worker.band_height`, `captions.margem_inferior` (+ the `ZONA_UI_PCT` clamp). No equivalent formula in JS (check 33g6). The screen sends INTENTION, never pixels. Same for X: a new pure function next to `margem_inferior` produces both the Remotion prop and the ASS MarginL/MarginR.
- **`editOf` has three copies:** `studio/src/preset.js` (owner), `serve.edit_of` + `EDIT_FAIXAS`, `video-ops.js`. New keys/ranges/sets go into all three as LITERALS (regex-read, checks 33a–33b). Forgetting `serve.edit_of` silently strips the field: the preview shows it, the MP4 doesn't.
- **Appearance is resolved once by `resolveLegenda`.** New visuals come from pure exported functions in preset.js (like `contornoPx` / `caixaLegenda`), never hand wiring in `Clip.jsx`. Tests CALL them with constructed values — no regex over JSX.
- Transforms don't touch layout: `charsPorLinhaLegenda` / `tetoDaPagina` and pagination (`toCaptionPages` / `to_pages`) stay as they are.
- What the ASS path can't reproduce goes in `captions.ASS_NAO_REPRODUZ` AND the JS `ASS_NAO_REPRODUZ` (check 33j2).
- No new npm dependency, no new localStorage key, no migration. A clip without the new keys = identical `render_props`, identical ASS `Style:`/`Dialogue:` lines, identical still hash.
- Follow `legendaGravar`: a value equal to the automatic one is not an adjustment (Nenhuma, X at the center) — the key disappears.
- BP-001 (no re-render during drag/typing; `input` draws, `change`/pointerup writes; localStorage only on release), BP-008 (every branch says what happened, including clamps and failures), BP-013, BP-014 (sanitize/load functions tested with the new fields present AND absent).
- **`.yt-src-stage` traps (estudio-ui.md):** `container-type: size` needs a determined height; `margin-inline: auto` is forbidden there; `max-height: 58vh` breaks `aspect-ratio` when it bites — so don't just flip the stage to 9/16. Suggested: in 9:16 mode give the stage a determined height and draw an inner 9:16 frame centered in it, sized from the stage height (cqh), holding the video box and the caption overlay.

## Mandatory order

### Phase 0 — confirm and plan (NO edits)
1. `.\provas.ps1` must be green at the current total (2184). If not, stop and report; don't fix unrelated failures.
2. Re-confirm D1–D3 with numbers (call the Python functions).
3. Horizontal clamp: use only limits already in the repo — the 1080 frame and the TikTok right rail documented next to `legendaLargura` in `TOKENS` (~930 px; today's centered 820 column ends at 950). Propose the exact rule. Don't invent safe-zone numbers; if you need the rail's vertical extent and it isn't documented, ask me.
4. Reply with a short plan: names (fields, props, functions, route), files, how the preview gets the geometry, the clamp rule, the Profundidade starting values, tests to add/update (including the ones that encode the old 75 rule), and the Chrome widths you'll check.

**Stop and wait for my OK.**

### Phase 1 — geometry from the single owner
- Extract the geometry part of `serve.render_props` into ONE pure function (videoAltura, bandaAltura, legendaBase, the new X prop) used by `render_props` AND by a cheap route (suggested `POST /api/legenda-geometria`, body `{reframe, edit, width, height}`, validated with `edit_of` / `reframe_profile`). It returns the resolved numbers, the automatic anchor, the numeric bounds of `posicaoPct` / `posicaoXPct` for the current column width, and whether a value was clamped. No render, no ffprobe. A test calls both paths with the same input and asserts equal numbers.
- The site calls it when a cut opens, on reframe/width/position change (on release, not per pointermove) and on reset. Failure → the preview says so (BP-008) and points to "Ver o quadro real".
- If you see a cheaper path that keeps Python as the only owner, propose it in Phase 0.

### Phase 2 — "Como sai 9:16"
- Video box in output px × `--px`, from the server numbers: `blur` = full width × `videoAltura`, centered, `object-fit: contain`; `crop11`/`crop45` = 1080 × `videoAltura`, `object-fit: cover` (same as `palcoGeometria`). Hide `.vop-cand-mask` in this mode.
- Bands: the thumbnail the export uses, with the same filter as `Fundo` in `Clip.jsx` (`TOKENS.fundoDesfoque`, `fundoLuz`, `fundoSaturacao`), if the site can reach that file; otherwise a neutral dark fill. Small label "Fundo aproximado". Never use `YT.thumbnail` as a stand-in for the cut's frame (existing rule).
- The existing overlay math becomes correct once its container is the 9:16 frame — keep it. Scale the reading shadow by `--px` as well.
- Automatic position = the server's automatic anchor (no more 75 placeholder at opacity .9).
- "Original 16:9": caption overlay hidden + the line "A legenda aparece no modo Como sai 9:16."
- Notes and tips say "posição" instead of "altura".

### Phase 3 — "Ajustar à mão"
- `leg-posicao` and the first drag from automatic start at `round((1920 − legendaBase_auto) / 1920 × 100)`. `posicaoPct` stays integer.
- No geometry available → don't guess: stay automatic and say why.
- Acceptance: switching to manual moves the exported base ≤ 10 px (expected with a 16:9 source: blur +5, crop11 −7, crop45 −9).

### Phase 4 — horizontal position
- Python function → Remotion prop (e.g. `legendaEsquerda`, px of the column's left edge) and ASS MarginL/MarginR (Alignment 2 centers between the margins, so X is exact in ASS). Guard in preset.js like `ancoraLegenda` (absent/invalid → centered, today's formula).
- Row "Posição lateral": automatic = "Centralizada." + "Ajustar à mão"; manual = slider + ↺ + `data-manual`, same pattern as the vertical row.
- The 2D drag uses the 9:16 FRAME rect for both axes, keeps the grabbed point under the cursor, clamps live to the server bounds, and writes on release. A vertical-only drag must not create a manual X: snap to the center within a small threshold (show a center guide while snapping) and keep X automatic.
- No room to move at the current width → the row says "Sem espaço para os lados com esta largura — diminua a Largura do texto." Clamp messages name the reason (borda do quadro / trilha de botões do TikTok).
- `legendaStyleWrite` keeps X (like position/width/alignment); "Voltar ao padrão" clears it.

### Phase 5 — Profundidade
- Table in preset.js (owner), e.g. `LEGENDA_PROFUNDIDADES = { suave, funda }`: tilt, perspective distance (output px), extrusion layers × step (px), extrusion tint. STARTING values, calibrate BY EYE: suave ≈ rotateX 14° / 1800 px / 3 × 1 px; funda ≈ rotateX 32° / 700 px / 7 × 1.25 px. Tint as a CSS expression both renderers understand (e.g. `color-mix(in srgb, <text color> 35%, #000)`) so no color math is duplicated — confirm it renders in Remotion's Chrome; if not, compute the hex in preset.js and mirror it with a parity test.
- One pure exported function returns the block style: `transform: perspective(Npx) rotateX(θ)`, `transform-origin: 50% 100%`, extrusion shadows followed by the style's reading shadow. `resolveLegenda` includes it; `Clip.jsx` only spreads it. Nenhuma → adds nothing (same tree, same styles).
- With caixa de fundo: tilt only, no extrusion, and the row says "Com caixa de fundo, a Profundidade inclina o texto sem volume." With contorno: extrusion under the stroke — check by eye. The active word keeps its color and pop.
- CSS preview: same numbers (mirror in video-ops.js, compared by `test-video-ops.js` importing preset.js), every length × `--px`.
- ASS: add one sentence to both `ASS_NAO_REPRODUZ` lists (the perspective and the volume of Profundidade).
- Panel: row after the color rows and before "Posição", native segmented radio, with ↺. Style change keeps it; "Voltar ao padrão" clears it.
- With the tilt, the projected text stays inside the frame and the base stays on `legendaBase` (test the pure function; confirm on stills). If headless Chrome blurs text under the 3D transform, fix it and say what you changed.

### Phase 6 — tests, visual check, docs
- Tests, with the rules' method (pure functions called with constructed values; sabotage only in a temp COPY, never in the working tree; parity of every new literal/range across the three layers):
  - clip without the new keys → identical `render_props`, ASS and still hash;
  - "Ajustar à mão" jump ≤ 10 px in blur/crop11/crop45;
  - X: Remotion prop == ASS MarginL (same function); clamps; absent = centered;
  - Profundidade: Nenhuma adds nothing; Suave/Funda take no time input and pivot on the base; preview mirror == preset;
  - DOM flow: open cut → 9:16 by default → exactly one `<video>` → Ajustar à mão → 2D drag → change reframe → Profundidade Funda → saved → reopened → export body carries the fields → Voltar ao padrão clears X and Profundidade.
- `.\provas.ps1` green; paste the `Checks:` line it prints into `CLAUDE.md` (the script fails if the line diverges).
- Stills: add cases to `studio/preview-legenda.mjs` (Suave and Funda on classico and impacto; with contorno = podcast; with caixa = faixa; X at both clamped extremes) → `cd studio; node preview-legenda.mjs <folder>`. LOOK at every frame and list the paths.
- Chrome with `.\estudio.ps1` running (http://127.0.0.1:8765): widths 390, 800, 1100, 1198, 1440 — no horizontal overflow, one `<video>`, bench layout intact. Compare "Como sai 9:16" with "Ver o quadro real" for blur, crop11 and crop45: caption base and size must match within a few output px.
- Render time: 30 s cut, Funda vs Nenhuma. If Funda approaches the `RENDER_SEC_PER_CLIP_SEC` guard, report — don't touch the constant.

## Out of scope — don't touch (report anything you notice)
Values of the six styles, pagination, karaokê timing and the neon fan, title card library, text correction panel, reframe logic (read only), `ytclip.py`, publishing/TikTok, Resultados, `index.html`, other modules.

## Deliverable (reply in PT-BR)
1. Diagnóstico confirmado (números)
2. O que mudou — uma linha por arquivo
3. Campos, props, rota e funções novas (nomes, faixas, padrões)
4. Provas: saída do `provas.ps1` + a nova linha `Checks:`
5. Stills: caminhos e o que você conferiu
6. Chrome: larguras e a comparação 9:16 × quadro real
7. Tempo de render (Nenhuma × Funda)
8. O que o download rápido (ASS) não reproduz
9. Riscos, pendências e próximo passo
