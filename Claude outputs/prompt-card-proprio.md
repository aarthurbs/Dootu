# PROMPT — Biblioteca de cards próprios (Estúdio de Vídeos / Dootu)

> Cole o bloco abaixo inteiro no agente de código, com o repositório `Dootu` aberto.

---

```
# TASK

In the Dootu repo, replace the closed set of third-party title-card identities
(`primo_rico`, `puro_ecommerce`) with a card LIBRARY the operator builds himself, and
remove the third-party presets and assets from the codebase entirely.

All code, comments, UI strings, commit messages and test check names MUST be written in
Brazilian Portuguese, matching the existing style of the repo. This prompt is in English;
the code is not.

# 0. GROUND RULES

- Read `CLAUDE.md` first. It is binding. Pay special attention to BP-003, BP-007, BP-008,
  BP-013 and BP-014.
- Read the path rules that apply to every file you touch:
  `.claude/rules/estudio-ui.md`, `.claude/rules/estudio-remotion.md`,
  `.claude/rules/estudio-video-worker.md`, `.claude/rules/modulos-index-html.md`.
- Surgical changes only. Do not refactor neighbouring working code. Do not reformat files.
- Do not invent a second owner for any decision that already has one.
- No new npm dependency in the site (`index.html` is Vanilla JS, no modules, no bundler).
  No new font family. No new HTTP route.
- State your assumptions explicitly before coding. If something in this prompt conflicts
  with the code on disk, THE CODE WINS — stop and report the conflict instead of guessing.

# 1. REQUIRED READING (before writing a single line)

Read these, in this order, and do not skip any:

1. `CLAUDE.md` (sections: Estúdio de Vídeos, Bug Prevention Rules, Validação do Estúdio)
2. `studio/src/preset.js` — `TITLE_CARD_STYLES`, `TITLE_CARD_PADRAO`, `TITLE_CARD_LABELS`,
   `titleCardStyleOf`, `TITLE_CARD_PRESETS`, `titleCardPreset`,
   `TITULO_GEOMETRIA_COMPARTILHADA`, `TOKENS` (card geometry), `LEGENDA_PRESETS`
3. `studio/src/marca.js` — the two embedded third-party badges
4. `studio/src/Clip.jsx` — `CardTitulo` and the card gate
   (`comLegenda && medida.texto && cardMarca`)
5. `video-worker/serve.py` — `TITLE_CARD_STYLES`, `title_card_style`, `edit_of`,
   `render_props` (note: props reach Remotion through a JSON FILE, `--props=props_path`)
6. `video-ops.js` — the mirror block (`TITLE_CARD_*`, `titleCardStyleOf`), `ytDetailHTML`
   (the `Card visual` fieldset), `clipFieldWrite`, `renderBody`, `editOf`, `projectsPersist`
7. `video-ops.css` — `.vop-cardstyle` and the neighbouring panel styles
8. The tests that own the parity guards:
   `studio/test-preset.mjs` (13a, 13a2–13a6, 13n, 13n2, 13t, 13t2, 13t3),
   `video-worker/test_serve.py` (26y3, 26z2, 26z3 and the props check at ~1473),
   `test-video-ops.js` (`titleCardStyleOf` block, ~line 620),
   `test-video-ops-dom.js` (~line 663, asserts the two labels are rendered)

# 2. SCOPE

## In scope

1. Remove `Primo Rico` and `Puro Ecommerce` from the `Card visual` selector AND from the
   codebase: presets, embedded badges, labels, parity checks and the third-party logo
   folders (`logo-primo-rico/`, `logo-ecommerce-puro/`) — the last two ONLY after
   BP-007 verification that nothing live references them.
2. Add a card LIBRARY: the operator creates, names, edits, duplicates and deletes his own
   title cards. Each clip picks one, or picks "Sem card".
3. A card editor screen/panel with a live preview.

## Explicitly OUT of scope — do not touch

- Card GEOMETRY (`cardLargura`, `cardPadding`, `cardRaio`, `cardFundo`, `cardSombra`,
  `cardCentroPct`, `logoAltura`, `tituloFilete`, `cardBordaPeso`, the 4s window, the
  entry/exit curve). `TITULO_GEOMETRIA_COMPARTILHADA` and check 13t stay alive and stay
  enforced: a card owns IDENTITY only, never geometry. `larguraTitulo()` /
  `tituloEscalonado()` keep one single source of truth.
- The caption subsystem (`LEGENDA_PRESETS`, `resolveLegenda`, manual editor, `legendaBase`).
- `reframe`, `palcoGeometria`, `Fundo`, the import pipeline, the rights gate, `yt-import`.
- The title highlight ALGORITHM (`pickTitleHighlight` / `resolveTitleHighlight` /
  `splitTitleHighlight`). A card dresses the highlight; it does not decide which words.
- Any localStorage key other than the new one. Do not read, migrate or delete
  `pp_video_projects_v1` contents beyond adding the new clip field.

# 3. THE ARCHITECTURAL DECISION (do not redesign it)

Today `titleCardStyle` is a CLOSED enum mirrored in three layers (preset.js is the owner,
video-ops.js mirrors it for the browser, serve.py mirrors it for the server) with parity
checks that read the files as text. An operator-built library breaks that premise: the
identity stops being an enum value and becomes DATA.

Keep the closed enum, shrink it, and ship the card as validated DATA alongside it —
exactly the precedent `edit` already sets (`edit_of` in serve.py, `editOf` in video-ops.js,
model owned by preset.js):

- `TITLE_CARD_STYLES = ['personalizado', 'nenhum']` — still a closed set, still mirrored in
  the three layers, parity checks 26y3/26z2/26z3 stay alive with the new values.
- `TITLE_CARD_PADRAO = 'personalizado'` — the default is NEVER `nenhum`. A clip saved
  before this change carries `primo_rico`, falls outside the set, and lands on the default,
  which now means "the house card".
- The POST body carries `titleCardStyle` AND a resolved `card` object. The server validates
  the whole object with a new pure `card_of()` (sibling of `edit_of`: never raises, unknown
  or malformed returns `None`, which the composition reads as "no card").
- The Remotion composition receives the card ALREADY RESOLVED. `MARCAS` in
  `studio/src/marca.js` dies with the third-party badges; `CardTitulo` must not look
  anything up. No `if` about identity inside the JSX — that is where this project's wiring
  fails silently.
- The library itself lives ONLY in the browser. The server never knows about card ids or
  about the library; it validates the one card object it was handed.

# 4. DATA MODEL

New localStorage key, its own (the library is global, not per project):

```
pp_video_cards_v1 = {
  v: 1,
  cards: [ <card> ]
}
```

A `<card>`:

```
{
  id: 'card-<timestamp>-<rand>',  // stable, never reused, never shown to the operator
  nome: 'Dootu',                  // names the card IN THE LIST, never drawn in the video
  identificador: 'DOOTU | CORTES',// text next to the badge; empty = no text line
  logo: 'data:image/png;base64,…' | '',  // empty = no badge
  logoProporcao: 1.0,             // largura/altura, MEASURED at upload, never guessed
  fileteCor, bordaCor, identificadorCor, destaqueCor,  // CSS colors
  tituloPeso, destaquePeso,       // closed set — see 6.2
  destaqueSublinhado: true|false
}
```

Clip gains `clip.cardId` (string). `clip.titleCardStyle` keeps its name and becomes
`'personalizado' | 'nenhum'`, so no migration and the three mirrors keep the same shape.

The POST body (`renderBody` in video-ops.js) sends `titleCardStyle` ALWAYS (validator, never
raw), plus `card: <resolved card object>` when the style is `personalizado` and the card
still exists. Sending the object and not the id is deliberate: the server has no library.

Rules that fall out of this and must be implemented, not assumed:

- Card deleted while a clip pointed at it → that clip renders with NO card, and the screen
  SAYS SO in the clip panel (BP-008: silent automation is indistinguishable from broken
  automation). Never fall back to another card, never fail silently.
- Empty library → the `Card visual` fieldset says the library is empty and offers the
  button that creates the first card. It does not render an empty radio group.
- A card with BOTH `logo` and `identificador` empty is invalid: refuse to save it and say
  why. A card with neither has no identity to dress the title with.
- Editing a card changes every clip that points at it. That is the point of a library —
  do not snapshot the card into the clip.

# 5. MANDATORY IMPLEMENTATION ORDER

One phase at a time. Run the full suite at the end of EVERY phase; a phase is not done
while anything is red. Do not start a phase before the previous one is green.

**Phase 1 — `studio/src/preset.js` (the owner).**
Shrink `TITLE_CARD_STYLES`/`TITLE_CARD_LABELS`, set the new default, delete
`TITLE_CARD_PRESETS` and rewrite `titleCardPreset` as `cardOf(valor)`: a PURE, exported
validator that turns an arbitrary object into a complete card or into `null`. Every field
gets a default, unknown/absent/wrong-typed values fall back instead of reaching the JSX.
Update `studio/test-preset.mjs`: rewrite 13a/13a2–13a6/13n/13n2, keep 13t/13t2/13t3
(geometry stays shared and a card still must not carry geometry), and add checks that CALL
`cardOf` with built values on BOTH branches — valid card and garbage (BP-014).

**Phase 2 — `studio/src/marca.js`.**
Delete `MARCAS`, both badges, both proportions, both names. If the file has nothing left,
delete the file and its imports. Run BP-007 verification before removing
`logo-primo-rico/` and `logo-ecommerce-puro/`: grep the whole repo (excluding
`docs/01-Wiki/archive/`, which is dated history and is NOT rewritten) and confirm nothing
live references them.

**Phase 3 — `studio/src/Clip.jsx`.**
`CardTitulo` consumes the resolved card: `card.logo` (through Remotion's `Img`, never
`<img>`), `card.logoProporcao` for width (height stays `TOKENS.logoAltura` — fixing both
sides squashes the badge), `card.identificador` (no text line when empty), and the colors
and weights for filete, border, title and highlight. The card gate stays load-bearing:
`comLegenda && medida.texto && cardResolvido`. Empty `logo` must not render a broken `Img`.

**Phase 4 — `video-worker/serve.py`.**
Mirror the shrunk enum, write `card_of()` next to `edit_of()` (pure, module level, never
raises, so the test can call it with built values), wire it into `render_props` as
`"card": card_of(body.get("card")) if style == "personalizado" else None`. Enforce the
size ceiling (see 6.4) SERVER-SIDE too: the POST body is input. Update `test_serve.py`:
fix the parity checks 26y3/26z2/26z3 for the new values, and add checks that call
`card_of` with a valid card, a malformed one, an oversized logo and a wrong-scheme logo.

**Phase 5 — `video-ops.js` + `video-ops.css` (the screen).**
Mirror block, `cardOf` mirror, the rewritten `Card visual` fieldset (native radios, one per
library card, plus "Sem card"), `clip.cardId` in `clipFieldWrite` (validator, `projectsPersist`,
no re-render — BP-001), `renderBody` sending the resolved object, and the card EDITOR
(see 6.3). Sanitize `cardId` in `projectsSanitize` and export it so the test can call it
with a saved clip carrying the field and one without it (BP-014 — this is exactly the bug
that once produced a black screen).

**Phase 6 — screen tests.**
`test-video-ops.js`: the mirror validators, `cardOf`, library CRUD, quota failure, the
deleted-card branch, `renderBody` output for both styles.
`test-video-ops-dom.js`: replace the check at ~663 (it asserts the two third-party labels)
with one that asserts the library labels, the empty-library message and the
deleted-card message.

**Phase 7 — visual verification (NOT optional).**
Update `studio/preview-titulo.mjs`: the scenarios `12-marca-primo-rico` and
`13-marca-puro-ecommerce` die; put in their place at least a full card (logo + text), a
logo-only card, a text-only card and a long title that hits the 3-line ceiling. Run
`cd studio && node preview-titulo.mjs` and LOOK at the stills. Typography and geometry are
not proven by assertion. Report what you saw.

**Phase 8 — documentation (active only).**
Update `CLAUDE.md` (Estúdio de Vídeos section, the module inventory, and the check-count
line) and `.claude/rules/estudio-ui.md` + `.claude/rules/estudio-remotion.md`.
`.\provas.ps1` compares the suite total against the line in `CLAUDE.md` and EXITS WITH
ERROR if they diverge — update that line with the real new numbers, never by arithmetic
done in your head. Do NOT rewrite anything under `docs/01-Wiki/archive/`: it is dated
history of work already finished.

# 6. NON-NEGOTIABLE IMPLEMENTATION RULES

## 6.1 The three mirrors
`preset.js` is the owner; `video-ops.js` and `serve.py` copy, because an ES module, a
Vanilla-JS page and a stdlib Python server cannot import each other. Copying demands a
guard, and the guard already exists: the parity checks read the files as TEXT with regex.
So keep the declarations LITERAL — no interpolated constants inside
`TITLE_CARD_STYLES`/`TITLE_CARD_PADRAO` — or the readers extract the constant's NAME.
Validate at every layer. The DOM is input; the POST body is input.

## 6.2 Typography — the trap that passes green and ships blurred
Weights are a CLOSED set, limited to the weights `Clip.jsx` actually passes to
`loadFont` (Inter 600/700/800/900 today). A weight that is not loaded is SYNTHESIZED by
Chrome and renders as a blurry thickening — no error, no failed check, only visible by
looking at the frame. Do not add a font family: check 9w2 enforces the relation between
loaded families and what the presets ask for, and Montserrat 800 exists for the caption
style `impacto` alone. If the operator picks a weight, it comes from a `<select>` with the
loaded weights, never a free number field.

## 6.3 The card editor (UI)
Before writing any UI/CSS, invoke the `emil-design-eng` skill (the project's CLAUDE.md
requires it) and apply its framework. Then:

- Live preview built in CSS, inside the editor, and LABELLED as an approximation of the
  final frame — this is the same two-preview pattern the caption editor already uses; do
  not invent a third. The real frame stays `/api/remotion-still`, from the clip.
- Logo upload: `<input type="file">` → dataURL. Accept `image/png`, `image/svg+xml`,
  `image/jpeg`, `image/webp`. Measure the proportion from the loaded image
  (`naturalWidth/naturalHeight`); an SVG with no intrinsic width/height reports 0 — fall
  back to the `viewBox` ratio, and if there is none, refuse the file and say why. Never
  store a guessed proportion.
- Every field has a visible current value and a way back to the default (same pattern as
  the manual caption controls).
- Native radios for the card choice (the `:checked` draws the state, zero JS for visual
  state). Hidden `position:absolute` radios NEED a positioned ancestor — `position:relative`
  on the fieldset, `top:0;left:0` on the radio — or focus scrolls `.layout` into a ~200px
  strip with no way back (measured). Never `display:none`/`visibility:hidden`.
- Motion: only `transform` and `opacity`; specific `transition` properties, never
  `transition: all`; durations under 300ms; strong custom ease-out
  `cubic-bezier(.23,1,.32,1)`; never `ease-in`; `:active { transform: scale(.97) }` on
  everything clickable; never enter from `scale(0)`; honour `prefers-reduced-motion`; gate
  hover effects behind `@media (hover:hover) and (pointer:fine)`.
- No gratuitous neon glow (`0 0 Npx` coloured), no rainbow gradient, no effect without a
  function. Depth is a realistic shadow (offset, contained).
- Destructive actions: deleting a card asks for confirmation inline. Never a `confirm()`
  dialog, and never a `dblclick` on a list whose click handler re-renders (BP-001).
- Any re-render that replaces the `innerHTML` of a scrollable container preserves
  `scrollLeft`/`scrollTop` (BP-013, `renderKeepingScroll`).

## 6.4 Storage and size ceilings
- The logo dataURL has a hard ceiling — 512 KB per card — enforced in the browser AND in
  `card_of` on the server. State the limit in the UI before the operator hits it.
- localStorage quota failure must be caught and REPORTED ("não consegui salvar: a
  biblioteca está cheia"), never swallowed. A write that silently fails loses the
  operator's work.
- Only `data:image/...;base64,` URLs are accepted for the logo. Reject `http(s):`,
  `file:` and anything else at both layers: `staticFile()` does not reach the repo
  (`--public-dir` points at the YouTube cache), and a remote URL would either fail to load
  or turn the render into a network fetch.

# 7. FILES AFFECTED

Change: `studio/src/preset.js`, `studio/src/Clip.jsx`, `studio/src/marca.js` (likely
delete), `studio/test-preset.mjs`, `studio/preview-titulo.mjs`,
`video-worker/serve.py`, `video-worker/test_serve.py`, `video-ops.js`, `video-ops.css`,
`test-video-ops.js`, `test-video-ops-dom.js`, `CLAUDE.md`,
`.claude/rules/estudio-ui.md`, `.claude/rules/estudio-remotion.md`.

Delete after BP-007 verification: `logo-primo-rico/`, `logo-ecommerce-puro/`.

Do not touch: `index.html` beyond what the editor strictly needs, `video-results.js`,
`captions.py`, `ytclip.py`, `worker.py`, anything under `docs/01-Wiki/archive/`,
`baixador/`, `web/`, `supabase/`.

# 8. SUCCESS CRITERIA

1. The strings "Primo Rico" and "Puro Ecommerce" (and the identifiers `primo_rico`,
   `puro_ecommerce`) appear NOWHERE outside `docs/01-Wiki/archive/`.
2. The operator can create a card, name it, upload a logo, set identifier text, colors,
   weights and underline, see it in the preview, save it, pick it on a clip, and export a
   clip that renders that card.
3. Cards can be edited, duplicated and deleted; the library survives a page reload.
4. A clip pointing at a deleted card renders with no card and the screen says so.
5. An empty library shows an explanation and the create button, not an empty radio group.
6. A clip saved before this change opens and exports without throwing (BP-014) — verified
   by a test that calls `projectsSanitize` with a clip that has no `cardId` AND with one
   that has a dangling `cardId`.
7. Garbage in any of the three layers (adulterated radio `value`, malformed POST body,
   corrupted localStorage) lands on a defined outcome, never on a broken render.
8. `.\provas.ps1` passes and its total matches the line in `CLAUDE.md`.

# 9. REQUIRED VALIDATION (run these, paste the output)

```
.\provas.ps1                      # the ten suites + the total guard
node test-video-ops-rec.js        # outside provas.ps1, run by hand
cd studio && node preview-titulo.mjs   # LOOK at the stills, then describe them
```

Plus one real end-to-end export from the site with a created card
(requires `http://127.0.0.1:8765` — run `estudio.ps1`), and one export with "Sem card".

# 10. DELIVERABLE FORMAT

Report, in this order:

1. Assumptions you made and any conflict you found between this prompt and the code.
2. What changed, file by file, in one line each.
3. The validation output (all commands above).
4. What you saw in the stills.
5. What is still pending, and anything you noticed that is out of scope and did NOT do.

Do not declare the task complete while any suite is red, while the `CLAUDE.md` total
diverges, or while you have not LOOKED at a rendered frame.
```
