# PROMPT — Manual editing panel + live preview for the Estúdio de Vídeos

Copy everything below the line into Claude Code, running at the repo root (`C:\Users\Teste\Downloads\Dootu`).

---

You are working in the Dootu repo (Vanilla JS site + Python video worker + Remotion renderer). Read `CLAUDE.md` first; it overrides anything here that contradicts it.

## 1. Goal

Rebuild the clip production panel of the `youtube` detail screen into a **manual editor**: the operator keeps every automatic feature that exists today (auto captions from the YouTube sidecar, suggested in/out, title card, reframe) but can now **override each of them by hand and see the result before rendering**.

This is one verifiable objective: *for a given clip, the operator can change caption font / size / case / color / vertical position / column width and the framing, see an on-screen preview that matches the rendered frame, and export a video that looks like the preview.*

Not a timeline editor. One clip at a time. But the edit state must be modeled so a future timeline can be added without a rewrite (see §4.1).

## 2. Repo facts already verified — do not re-discover them

| Thing | Where it lives |
|---|---|
| Detail screen with the 5 controls in the screenshot | `video-ops.js` → `ytDetailHTML`, styles in `video-ops.css` |
| Caption style closed set (`classico` \| `impacto`) | 3 mirrored copies: `studio/src/preset.js` (`LEGENDA_STYLES` / `LEGENDA_PADRAO` / `LEGENDA_PRESETS`, the owner), `video-worker/serve.py:412`, `video-ops.js` (`legendaStyleOf`) |
| Reframe closed set (`blur`/`crop`/`crop11`/`crop45`) | `worker.REFRAMES` (owner), `preset.js`, `video-ops.js` (`reframeOf`, `REFRAME_LABELS`) |
| Vertical caption anchor — **single owner** | `video-worker/captions.py::margem_inferior`. FFmpeg/ASS calls it via `to_ass`; Remotion receives the same number as the `legendaBase` prop, assembled in `serve.render_props`. There is no JS formula and there must not be one. |
| POST body for the edited export | `video-ops.js::renderBody(clip, comLegenda, fonte)` — pure, exported, tested. Route `/api/remotion-render` (`serve.ROUTE_RENDER`), which shells out to `npx remotion render src/index.jsx Clip …` (`STUDIO_ENTRY` / `STUDIO_COMPOSITION`) |
| ASS/FFmpeg caption style | `video-worker/captions.py` consts: `FONTE="Inter"`, `FONTE_ARQUIVO="Inter-Bold.ttf"` (only file in `video-worker/fonts/`), `FONTE_TAMANHO=58`, `NEGRITO=True`, `LARGURA=820`, `MAX_CHARS_LINHA=25`, `MAX_LINHAS=2`, `RODAPE_PCT=0.08`, `ZONA_UI_PCT=0.86` |
| Font families loaded by the renderer | `studio/src/Clip.jsx`: Inter (600/700/800/900) + Archivo Black (400). Check `9w2` in `studio/test-preset.mjs` asserts the loaded families are exactly the set some caption style asks for, **and explicitly greps for the absence of `carregarMontserrat` / `google-fonts/Montserrat`** |
| Montserrat availability | `@remotion/google-fonts` 4.0.513 already ships `Montserrat` — no new dependency needed |
| Line-break metric constants | `preset.js`: `AVANCO_INTER=0.55`, `AVANCO_INTER_CAIXA_ALTA=0.683`, `AVANCO_ARCHIVO_BLACK=0.78`, and `AVANCO_MONTSERRAT=0.58` — **this last one is the TITLE card's constant and is lowercase-metric; it is NOT valid for an uppercase caption.** Measure a new one; do not reuse it because the name matches. |
| Test suites and their counts | `.\provas.ps1` runs ten suites and **compares the total against the line in `CLAUDE.md`** (currently 1885). It fails if they diverge. `test-video-ops-rec.js` is outside it, run by hand. |

## 3. Non-negotiable invariants

Violating any of these is a failed task, even if the tests are green.

1. **No npm, no React, no bundler in the site.** `index.html` / `video-ops.js` stay Vanilla JS loaded by `<script>`. `@remotion/player` must not enter the frontend. No new Node server — the backend is `video-worker/serve.py` plus (planned) Supabase.
2. **`captions.margem_inferior` remains the single owner of the vertical anchor.** The UI may send an *intent* (an offset/percentage the operator dragged to), but Python validates it, clamps it against `ZONA_UI_PCT` and produces the final `legendaBase`. Never reimplement the formula in JS — the repo already paid for that bug (the caption was drawn 61px below the image).
3. **Exactly one `<Video>` tag in the composition**, `videoEscala = 1`, `videoCentroPct = 0.5`. Reframing is `palcoGeometria`, never scale.
4. **Closed sets are mirrored as literals in 3 places** (preset.js owner → serve.py → video-ops.js) because `serve.py`/`video-ops.js` read the list by regex. No interpolated constants inside those lists. Every new closed set follows the same shape: pure exported validator, unknown/missing/typo falls back to the current default so previously saved clips render exactly as they render today.
5. **Every weight used must be in `loadFont`.** A missing weight is synthesized by Chrome and comes out blurry — it only shows up by *looking at the frame*.
6. **Editorial direction (BUSINESS_SERIOUS) still governs the new controls:** no neon, no meme, no emoji, no constant motion, no aggressive zoom, no effect fired just because time passed. The color pickers offer the project's closed palette (`TOKENS.texto`, `destaque`, `destaqueGanho`, `destaquePerda`, `palavraCor`), not a free color wheel.
7. **Bug-prevention rules apply:** BP-001 (inline edits never call `render()`), BP-008 (every branch, including "did nothing", says so on screen), BP-013 (preserve scroll on re-render), BP-014 (any function that sanitizes/migrates persisted data is exported and tested with both branches — field present and field absent).
8. **Do not touch** the copyright gate, `/api/yt-import`, `SRC`/`SRC_SEQ` race guards, the removed modules list, or the publication pipeline that was deleted.
9. Surgical changes only. Do not refactor neighboring working code.

## 4. Implementation order — do these in sequence, validating each

### Phase 0 — read before writing
`.claude/rules/estudio-ui.md`, `.claude/rules/estudio-remotion.md`, `.claude/rules/estudio-video-worker.md`, and grep `docs/01-Wiki/archive/HISTORICO-estudio-video.md` for any number you are about to change. State your assumptions out loud before coding; ask instead of guessing.

### Phase 1 — the edit model
Add a single versioned object on the clip: `clip.edit = { v: 1, legenda: {...}, enquadramento: {...} }`.

- `editOf(clip)` — pure, exported validator, same shape as `legendaStyleOf`. Missing or malformed → the exact current behavior (style `classico`, auto anchor, `reframe` untouched). A clip saved before this change must render byte-identically.
- Persisted in the existing project/clip storage — **no new localStorage key**, no migration that rewrites saved data.
- Model it as `{ v, legenda, enquadramento }` and not as loose top-level keys, so a future timeline adds `edit.trilhas[]` beside them without touching the validator's contract.
- Changing a clip boundary must keep invalidating only the *exported* artifact (`clipBoundaryChanged`), never the imported source, and now also never the operator's manual edit — the edit survives a trim.
- Test both branches (BP-014).

### Phase 2 — swap Archivo Black → Montserrat in the `impacto` style
Decision by the operator: the `impacto` caption style now uses **Montserrat**, ExtraBold/Black for emphasis and Medium/SemiBold for the smaller text.

- `preset.js`: `LEGENDA_PRESETS.impacto.familia = 'montserrat'`, weight 800 (ExtraBold) or 900 (Black) for the caption body, 500/600 for any secondary line. Keep `caixaAlta: true`.
- `Clip.jsx`: replace the `ArchivoBlack` import with `Montserrat`, loading exactly the weights some style asks for (`['500','600','800','900']` — trim to what is actually used).
- **Measure a new `AVANCO_MONTSERRAT_CAIXA_ALTA`** and wire it into `LEGENDA_PRESETS.impacto.avanco`. Do not reuse the title's `AVANCO_MONTSERRAT` (0.58) — it was measured for lowercase title text. Wrong advance means the page estimate lies and lines overflow the 820px column.
- If you make emphasis a *weight* change (600 → 900) instead of a color change, the line-width estimate must be computed with the **heaviest** weight on the line (worst case), otherwise an emphasized word overflows silently. Never emulate emphasis with `transform: scale` — measured and rejected in this repo.
- Update check `9w2` in `studio/test-preset.mjs`: it currently asserts Montserrat is *absent*. It must now assert the loaded families equal the set the styles ask for, with Archivo Black gone from both ends.
- Update `CLAUDE.md` / `.claude/rules/estudio-remotion.md` where they state "Montserrat saiu do projeto" — the code is the source of truth and the docs must follow it in the same commit.

### Phase 3 — FFmpeg/ASS parity
The ASS path (`captions.py` → `worker.py`) must not silently disagree with Remotion.

- Embed the Montserrat TTFs in `video-worker/fonts/` (with their LICENSE) and make `FONTE` / `FONTE_ARQUIVO` / `NEGRITO` / `FONTE_TAMANHO` derive from the chosen style instead of being module constants.
- `to_ass` receives the resolved edit and mirrors what ASS *can* express: font name, size, bold, primary color, `MarginV` (from `margem_inferior`, still the owner), alignment, and the column margins.
- What ASS **cannot** express (per-word karaoke, the scale pop) must be stated on screen next to the button that uses that path — BP-008: a path that quietly renders something different is the defect these checks exist to prevent.
- Extend the existing parity checks in `test_serve.py` / `test_captions.py` instead of deleting them.

### Phase 4 — the panel UI
**Invoke the `emil-design-eng` skill before writing any CSS** (required by `CLAUDE.md`).

Keep the existing blocks (`COMEÇO E FIM`, `CARD VISUAL`, `LEGENDA`, `ENQUADRAMENTO`) and both export buttons. Add, inside the caption block:

- style (existing closed set), font (closed list), size, uppercase toggle, text color and emphasis color (closed palette), column width, horizontal alignment, and vertical position;
- a **"back to automatic"** reset per control, and a visible marker on any control the operator has overridden — an automatic value and a manual value must never look the same (BP-008);
- the auto-caption text editor stays exactly where it is; manual styling must not disable auto captions.

Interaction rules: segmented controls are native radios (`:checked` draws the state, zero JS for visual state); inline edits write to the model without `render()` (BP-001); the hidden-radio trap needs a positioned ancestor (see `estudio-ui.md`, it caused a 200px dead scroll band); container queries, not viewport media queries, because this screen lives next to the sidebar.

### Phase 5 — the preview (two layers, on purpose)
**Layer A — live CSS preview, instant.** An overlay on the existing site player (`<video data-src-video>` — reuse it, `srcAdopt` must keep preserving the node; do not create a second player for a 2GB file). The 1080×1920 frame is drawn in a box scaled with `transform: scale()`, so every number stays in frame pixels. The caption is draggable; dragging writes `edit.legenda` and nothing else. Label it as an approximation.

**Layer B — real frame, on demand.** New route `/api/remotion-still` that runs `npx remotion still src/index.jsx Clip …` with **the exact props `render_props` builds for the video** (one owner — do not assemble a second prop object), at a frame in the middle of the clip, returning a PNG. Cache by a hash of the props so re-clicking without changes is free. Timeouts and failures get a written reason on screen, never a silent spinner.

The screen must say which one the operator is looking at: layer A is an approximation of the typography, layer B is the truth.

The token values layer A needs follow the repo's existing pattern for cross-language constants: literal mirrored copies with a parity check that reads the files by regex. Do not invent a new sharing mechanism, and do not let the CSS preview become an independent fourth implementation of the caption layout — the page-breaking logic (`toCaptionPages`, `MAX_CHARS_LINHA`, `MAX_LINHAS`) has one owner.

### Phase 6 — tests and counts
Add checks to the suites that already own each area (`studio/test-preset.mjs`, `test-video-ops.js`, `test-video-ops-dom.js`, `video-worker/test_serve.py`, `test_captions.py`). Then **update the totals in `CLAUDE.md`** so `.\provas.ps1` adds up — it exits with an error when the sum diverges, and the per-suite numbers in that line must match too.

## 5. Acceptance criteria

1. A clip saved before this change opens and exports identical to today — no visual diff.
2. Changing font, size, case, color, column width or vertical position changes the exported MP4 in the same direction the preview showed.
3. The real-frame preview and the final render agree on typography and caption position (compare a still against the same frame of the render).
4. Auto captions still load from the source sidecar, still editable, and manual styling never turns them off.
5. The `impacto` style renders in Montserrat with no synthesized weight (inspect a frame — a blurry thickening is the failure mode).
6. The ASS/FFmpeg path either matches the chosen style or says on screen exactly what it will not reproduce.
7. `.\provas.ps1` green, with the new counts written into `CLAUDE.md`.
8. No new npm dependency in the site, no new Node process, no second `<Video>` tag, no JS copy of `margem_inferior`.

## 6. Validation commands

```
.\provas.ps1
node test-video-ops-rec.js          # by hand, if you touched the recommendation
cd studio; node preview-titulo.mjs  # then LOOK at the frame — typography is not proven by assertions
```
Plus one real render of a ~20s clip in both caption styles and at least two reframes, and one `/api/remotion-still` compared against that render.

## 7. Deliverable format

Report back with: what changed per file; which closed sets gained values and where the three copies are; the measured advance constant and how you measured it; the new test counts per suite and the new total; what the ASS path does not reproduce; and anything you found out of scope (report it, do not do it).
