# Phase 0 — Project Audit: 2D Shooting Range → 3D FPS Training Range

Repo: `C:\Users\Teste\Downloads\seller-arthur-2`
Branch at audit time: `agent/supabase-video-studio-sync-2026-08-04`
Date: 2026-08-14

All claims below are cited `file:line`. Two facts from the briefing were wrong; see **Corrections to briefing facts** at the end.

---

## Framework

**Verdict: none. Vanilla JS, no framework, no virtual DOM.**

- Single HTML entry: `index.html` (5047 lines, 263,240 bytes), `<!DOCTYPE html>` at `index.html:1`, `<html lang="pt-BR">` at `index.html:2`.
- No React / Vue / Svelte / Angular anywhere. Every feature module is an IIFE loaded via plain `<script src>` (e.g. `index.html:4002-4003`).
- Feature modules are attached to `window` as globals (`window.SRCore` at `shooting-range-core.js:261`, `window.shootingRangeSetActive` at `shooting-range.js:769`).

**Implication for 3D:** nothing to integrate against. A new 3D module is another IIFE + one `<script>` tag, same shape as `shooting-range.js`.

---

## Language

**Verdict: ES5-flavored ES2015+ JavaScript. No TypeScript, no JSX, no transpilation.**

- Game code is deliberately conservative: `var`-only, `function` declarations, no classes, no arrow functions in `shooting-range-core.js` (`shooting-range-core.js:10-13` `var FOCAL = 900; var WALL_X = 470; …`).
- The inline script in `index.html` does use `const`/`let`/arrows/`async-await` (`index.html:3222` `function activateView(view)`, `index.html:3201` `const VIEW_GROUP = {`, `index.html:3273` `await ensureXlsx();`).
- Dual-target module pattern so Node can require the pure rules: `shooting-range-core.js:260-261`
  `if (typeof module !== 'undefined' && module.exports) module.exports = API;` / `if (typeof window !== 'undefined') window.SRCore = API;`

**Implication for 3D:** the 3D module must be plain classic-script JS (no `import`/`export` at top level), or it must be loaded as `type="module"`. Mixing matters — see *3D stack evaluation*.

---

## Rendering architecture

**Verdict: retained-mode DOM for the app shell; immediate-mode 2D canvas for the game. No WebGL in use anywhere.**

- App shell = static HTML sections toggled by the `hidden` attribute (`index.html:3238` `document.getElementById('view-shooting-range').hidden = view !== 'shooting-range';`).
- Game rendering = Canvas2D only. `shooting-range.js:698` `ctx = cv.getContext('2d');` and an offscreen scenery cache at `shooting-range.js:699-700` (`env = document.createElement('canvas');` … `ectx = env.getContext('2d')`).
- Zero `getContext('webgl')` / `getContext('webgl2')` call sites in the repo (grep for both quoting styles across `*.js`/`*.html`: no hits).
- Depth today is a **fake projection**, not 3D: `shooting-range-core.js:3` documents `s = FOCAL/(FOCAL+z)`, implemented at `shooting-range-core.js:41` `function scaleAt(z) { return FOCAL / (FOCAL + z); }`.
- Design space is a fixed 1280x720 with a viewport-scaled canvas element: `index.html:1393` `<canvas id="sr-canvas" width="1280" height="720" role="img"`, CSS `.sr-stage canvas { display: block; width: 100%; height: 100% … }` at `index.html:1491`.
- Frame loop is a single rAF handle with explicit start/stop: `shooting-range.js:505-506`
  `function startLoop() { if (!raf) { lastFrame = 0; raf = requestAnimationFrame(frame); } }` / `function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }`

**Implication for 3D:** the rAF start/stop discipline and the fixed design-space→viewport scaling are directly reusable. The `scaleAt`/`RANGE` pseudo-projection is what gets *replaced* by a real camera; it must not be half-kept, or hit-test and render will disagree (the existing code already warns about exactly that class of bug — see *Existing game code*).

---

## Routing / navigation

**Verdict: hand-rolled single function, `activateView(view)`. No router library, no hash routing, no History API.**

- `index.html:3222` `function activateView(view) {`
- `index.html:3225` `const toolViews = ['central', 'empreendedor', 'video-ops', 'fluxos', 'faturador', 'precificacao', 'amazon-inventory', 'radar', 'shooting-range'];`
- `index.html:3226` `const tool = toolViews.includes(view);`
- Per-view show/hide by `hidden`: `index.html:3238`.
- Lifecycle hook the game depends on: `index.html:3245`
  `if (window.shootingRangeSetActive) window.shootingRangeSetActive(view === 'shooting-range');`
- Exposed for in-game navigation: `index.html:3253` `window.appActivateView = activateView;   // usado pelo botão RETURN do Shooting Range` — consumed at `shooting-range.js:755` `if (window.appActivateView) window.appActivateView('central');`
- Header "world" filter: `index.html:3201-3204` `const VIEW_GROUP = { faturador: 'amazon', precificacao: 'amazon', 'amazon-inventory': 'amazon', radar: 'prog', empreendedor: 'prog', 'video-ops': 'prog', fluxos: 'prog' };` — **`shooting-range` is deliberately absent**, so the sidebar item never gets filtered out (`index.html:876-877`: `<!-- sem data-group: o mini-game não pertence a nenhum "mundo" de trabalho -->` then `<button class="nav-item" data-view="shooting-range">`).
- Central hub card lives in `index.html:1367-1371` (`.hub-block[data-group="jogos"]` → `.hub-card[data-view="shooting-range"]`).

**Implication for 3D:** the routing contract is already correct and must be preserved verbatim. The 3D module reuses the same `window.shootingRangeSetActive(bool)` entry point; no routing change is needed. This is the single hard integration seam.

---

## State management

**Verdict: module-scoped `var`s + a plain state object passed to pure functions; `localStorage` for persistence. No store, no reducer, no observable.**

- Round state is one plain object mutated by pure functions in the core, with an explicit state machine `idle|playing|reloading|finished` (`shooting-range-core.js` API surface, exports listed at `shooting-range-core.js:255+`).
- Clock manipulation is a pure function so pausing is exact: `shooting-range-core.js:241` `function shiftClock(st, delta) {`, called from the view at `shooting-range.js:671` `G.shiftClock(st, now() - pausedAt);      // retoma a rodada de onde parou`.
- Persistence: `shooting-range.js:21` `var KEY = 'pp_shooting_range_v1';`
- Project-wide key convention `pp_*_v1`. Full set present in the repo: `pp_amazon_inventory_imports_v1`, `pp_amazon_inventory_v1`, `pp_empreendedor_v1`, `pp_fat_autofill_v1`, `pp_faturador_xlsx_v1`, `pp_fluxos_v1`, `pp_projects_v1`, `pp_prompts_v1`, `pp_shooting_range_v1`, `pp_video_ops_v1`, `pp_video_ops_v3_backup`.

**Implication for 3D:** keep the same split — pure rules object + `pp_shooting_range_v1`. Record/settings schema should stay additive so an existing saved record survives the 3D rewrite.

---

## Styling solution

**Verdict: hand-written CSS. Predominantly a large inline `<style>` in `index.html`, plus two external stylesheets. No Tailwind, no CSS-in-JS, no preprocessor.**

- Main inline `<style>` opens at `index.html:11`.
- Shooting Range CSS is a **second, dedicated static `<style>` block right after the section**, `index.html:1478-1480`:
  `<style>` / `/* ── Shooting Range (mini-game) — estático aqui, nada injetado por JS (BP-012) ── */` / `#view-shooting-range { max-width: 1180px; }`
  Range rules run `index.html:1480-1625` (`.sr-stage` at `:1483`, `.sr-stage[data-playing="1"] canvas { cursor: none; }` at `:1492`, mobile override `.sr-stage { width: 100%; }` at `:1625`).
- External sheets (linked at the very END of the file, after all scripts): `index.html:5044` `<link rel="stylesheet" href="design-system.css" />` (19,963 bytes) and `index.html:5045` `<link rel="stylesheet" href="video-ops.css" />`. Load order is a known FOUC risk, already noted in `chat-auditoria-video-ops.md:50`; not this feature's problem.
- Design tokens are CSS custom properties (`--ease`, `--ease-spring`) per CLAUDE.md §5.

**Implication for 3D:** all new `.sr-*` / crosshair / HUD CSS goes in the existing static block at `index.html:1478+`. **Do not inject CSS from JS** (rule BP-012, whose failure mode was a `var CSS` hoisting bug).

---

## Build system

**Verdict: none. Zero-build static site.**

- No `package.json`, no `node_modules` (both confirmed absent at repo root).
- No bundler config of any kind (no vite/webpack/rollup/esbuild/parcel config files).
- No `npm run` step; scripts are run directly, e.g. `node test-shooting-range.js`.
- `node v24.14.0` is installed, used **only** as a headless test runner — it is not part of serving the site.
- `skills-lock.json` exists at root but is Claude-tooling metadata, not a JS dependency manifest.

**Implication for 3D:** there is no place to `npm install` into, and no step that could transpile JSX or resolve bare specifiers like `import * as THREE from 'three'`. Any 3D library must arrive as a **pre-built file committed to the repo** and be resolved by a relative URL. This single fact decides the whole stack question below.

---

## Existing game code

**Verdict: already cleanly split rules-vs-render. The split survives the 3D rewrite; only the render/geometry half is replaced.**

Two files, 1036 lines total:

- `shooting-range-core.js` — 262 lines. Pure, DOM-free rules. Header at `:4`: `Exportado p/ node (test-shooting-range.js) e p/ o browser em window.SRCore.` Config, state machine, targets, shot resolution, combo, clock.
- `shooting-range.js` — 774 lines. Drawing, input, audio, lifecycle only.

Rules currently encoded (per CLAUDE.md and the core file): 60s round, magazine 30 / reserve 120, targets +10 paper / +25 plate / +40 moving / +50 bullseye, combo x1.2 (2) · x1.5 (5) · x2 (10), miss resets combo.

Geometry constants and the single source of truth for what is hittable:
- `shooting-range-core.js:10-13` — `FOCAL = 900`, `WALL_X = 470`, `FLOOR_Y = -235`, `CEIL_Y = 270`.
- `shooting-range-core.js:29-31` — `// janela útil do estande = a abertura da cabine em z=0 (x: ±WALL_X, y: CEIL..FLOOR).` then `RANGE: { x: 170, y: 30, w: 940, h: 505 }`.
- `shooting-range-core.js:28` re-exports all of them on `CFG`.

**The standing hazard, verbatim from CLAUDE.md:** "Mexeu em `WALL_X`/`FLOOR_Y`/`CEIL_Y`? Atualize `CFG.RANGE` junto, senão desenho e hit-test discordam." The 2D build has *two* representations of the same volume that must be edited together. A real 3D build should collapse this to one (camera + colliders, hit-test via raycast against the same transforms used to draw), which removes the hazard rather than porting it.

**Tests** (plain `assert`, no framework):
- `test-shooting-range.js` — 249 lines, pure rules.
- `test-shooting-range-dom.js` — 220 lines, fake `document`/canvas, full cycle START → shot → empty → reload → end → tab switch without duplicate listener/loop. Asserts the contract exists: `test-shooting-range-dom.js:97-98`
  `const setActive = global.window.shootingRangeSetActive;` / `assert.strictEqual(typeof setActive, 'function', 'expõe window.shootingRangeSetActive');`

**Implication for 3D:** `test-shooting-range.js` should keep passing largely unchanged if the rules layer stays pure — that is the regression net for the rewrite. `test-shooting-range-dom.js` will need a WebGL-context stub or the 3D renderer must be constructible with an injected/null renderer; decide this in Phase 1, because a headless test that cannot instantiate the renderer silently stops testing the lifecycle contract.

---

## Existing 3D libraries

**Verdict: `vendor/three.min.js` (three.js r160, UMD, 669,884 bytes) IS present on disk — untracked in git and referenced by nothing. This contradicts the briefing.**

- `vendor/three.min.js` — 669,884 bytes, mtime 2026-08-14 12:56.
- `vendor/three.LICENSE.txt` — 1,081 bytes (MIT). Copyright line visible at `vendor/three.min.js:4` `* Copyright 2010-2023 Three.js Authors`.
- Revision confirmed r160 from the minified constant `const e="160"` at `vendor/three.min.js:7`.
- Git state: `?? vendor/` — **untracked**, i.e. staged on disk by a prior step but not committed.
- **Not wired:** zero occurrences of `vendor/` in any `.js` or `.html` in the repo. No `<script src="vendor/three.min.js">` in `index.html`. No `THREE` reference outside the vendored file itself.
- No babylon.js, playcanvas, gl-matrix, regl, twgl, or any other 3D/WebGL library anywhere.

**Important caveat on this exact build.** `vendor/three.min.js:1` opens with the library's own deprecation notice:
`console.warn('Scripts "build/three.js" and "build/three.min.js" are deprecated with r150+, and will be removed with r160. Please use ES Modules or alternatives…')`
r160 is therefore effectively the **last** revision shipping a classic-script UMD build. Consequences to accept explicitly:
1. This build is loadable by a plain `<script src>` and exposes a global `THREE` — which is exactly what a no-build project needs, and why picking r160 is correct here rather than accidental.
2. Upgrading past r160 later is **not** a file swap; it requires either an ES-module `<script type="module">` path plus an import map, or a self-hosted bundle step. Pin r160 and treat the version as frozen for this feature.
3. It also prints a console warning on every load. Harmless, but it will appear in the console; do not chase it as a bug.

Also note `vendor/` is currently untracked — it must be committed (with its LICENSE file) or the site breaks for anyone who clones the repo.

---

## Existing animation libraries

**Verdict: none. Zero hits for gsap, anime.js, framer-motion, popmotion, motion-one, velocity.**

Animation today is (a) CSS transitions with custom easing tokens (`--ease`, `--ease-spring`; CLAUDE.md forbids `transition: all` and mandates specific properties) and (b) manual per-frame integration inside the rAF loop at `shooting-range.js:493` `raf = requestAnimationFrame(frame);`.

**Implication for 3D:** keep manual integration in the frame loop. A tweening library is not needed for recoil/muzzle/target motion — those are a few lines of damped math each, and three.js ships no dependency requirement for them.

---

## Existing physics / collision libraries

**Verdict: none. Zero hits for cannon-es, ammo.js, rapier, matter-js, planck, oimo.**

Collision today is analytic and trivial: circular targets, point-in-circle after the `scaleAt(z)` projection, gated by the `CFG.RANGE` rectangle so a shot outside the booth aperture cannot pass through to a target behind it (`shooting-range-core.js:29-31`).

**Implication for 3D:** a physics engine is not justified. The required interaction is *ray vs. a handful of static/kinematic shapes* — that is `THREE.Raycaster` against target meshes, plus fixed kinematic paths for moving targets. Adding a physics engine would mean a second vendored megabyte and a second source of truth for positions. Skip it; add only if the spec later demands ragdoll, bullet drop with bounce, or stacked-object interaction.

---

## Asset structure

**Verdict: `assets/` is 2D-only — 82 PNG, 15 JPG, 3 MD, 1 TXT. No 3D assets of any kind.**

- Top level: `assets/capa-bg.jpg`, `assets/CAPA-DE-FUNDO.png`, `assets/capa-sidebar.jpg`, `assets/favicon.png`, `assets/logo.png`, `assets/flags/`, `assets/nba/`, `assets/themes/`.
- No `.gltf`, `.glb`, `.fbx`, `.obj`, `.hdr`, `.ktx2`, `.basis`, no texture atlases, no skeletal animation data.
- The current game ships **no** assets at all — scenery, weapon and effects are drawn procedurally into the 2D canvas.
- Existing image-weight rule: BP-006 targets <250KB per image, after a prior audit cut backgrounds from 5.4MB to 0.7MB.

**Implication for 3D:** the path of least resistance and least risk is to keep the range **asset-free**: procedural geometry (`BoxGeometry`/`PlaneGeometry`/`CylinderGeometry`), `MeshStandardMaterial` or `MeshLambertMaterial` with flat colors, and canvas-generated textures if any are needed at all. This preserves offline operation, adds no loader (`GLTFLoader` is not in the UMD global for r160 examples — `THREE.GLTFLoader` ships separately under `examples/`, which is NOT included in `vendor/`), and stays inside BP-006. If a GLTF model is ever required, that is a second vendored file plus a new asset directory — call it out as scope, do not smuggle it in.

---

## Audio system

**Verdict: 100% WebAudio synthesis at runtime. No audio files, no audio library.**

- Context is lazily created: `shooting-range.js:60` `var AC = window.AudioContext || window.webkitAudioContext;`
- Created only on the user gesture: `shooting-range.js:589` `audio();                                   // AudioContext nasce no gesto do usuário`
- Sounds are oscillator-based: `shooting-range.js:88` `var o = a.createOscillator();` and `shooting-range.js:107`.
- Off-tab guard documented at `shooting-range.js:56`: `// usuário já trocou de aba — e não podem religar o AudioContext suspenso.`
- No `new Audio(` call sites, no `.mp3`/`.ogg`/`.wav` in the repo.

**Implication for 3D:** reusable as-is. If positional audio is wanted, `THREE.PositionalAudio` can wrap the *existing* synthesized buffers — but plain stereo is likely sufficient for a fixed-position shooter and avoids re-plumbing the gesture-gated context. Do not add audio files: it would break the no-assets/offline property for no gameplay gain.

---

## Input system

**Verdict: plain `addEventListener` with Pointer Events + `keydown`. NO Pointer Lock anywhere in the repo.**

- Aim/fire: `shooting-range.js:719-733` — `pointermove` → `aimFrom`, `pointerdown` → fire, `pointerup`/`pointercancel`/`pointerleave` → `stopFire`, `window blur` → `stopFire`, and `contextmenu` → `preventDefault()`.
- Keyboard is attached/detached with the tab, not permanently: `shooting-range.js:643` `if (on) window.addEventListener('keydown', onKey);`
- Screen click targets on the stage: `shooting-range.js:736`.
- Resize + visibility: `shooting-range.js:766-767` — `window resize` (guarded by `active`) and `document visibilitychange` → `onVisibility`.
- Bootstrap: `shooting-range.js:772` `if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);`
- Cursor hiding while playing is CSS-driven, not JS: `index.html:1492` `.sr-stage[data-playing="1"] canvas { cursor: none; }`
- Grep for `requestPointerLock` across all `.js`/`.html`: **no hits.**

**Implication for 3D:** Pointer Lock is the one genuinely new input primitive an FPS needs, and it is net-new work with real edge cases: it is async and can be rejected, it requires a user gesture, `pointerlockchange`/`pointerlockerror` must both be handled, Esc silently exits (and must pause the round the same way the tab switch does), and `movementX/movementY` replace absolute coordinates. Wire lock exit into the **existing** pause path (`shiftClock`, `shooting-range.js:671`) rather than inventing a second pause mechanism — otherwise the clock will drift on Esc. The existing `.sr-stage[data-playing="1"]` cursor CSS becomes redundant under lock but is harmless to keep as the unlocked fallback.

---

## Existing second-tab implementation

**Verdict: fully wired and self-consistent. Five integration points, all of which the 3D version inherits unchanged.**

1. Sidebar nav: `index.html:877` `<button class="nav-item" data-view="shooting-range">`, deliberately without `data-group` (`index.html:876` comment).
2. Central hub card: `index.html:1368-1371`, inside `.hub-block[data-group="jogos"]` (`index.html:1367` comment: only shows on Central).
3. Section + stage: `index.html:1391-1393` — `<section id="view-shooting-range" hidden>` → `<div class="sr-stage" id="sr-stage">` → `<canvas id="sr-canvas" width="1280" height="720" role="img" …>`. HUD and end-of-round screens are DOM siblings, not canvas-drawn (e.g. `.sr-cta` with `#sr-again` / `#sr-return` at `index.html:1470-1471`).
4. Static CSS: `index.html:1478-1625`.
5. Scripts, in dependency order, near the end of body: `index.html:4002` `<script src="shooting-range-core.js"></script>` then `index.html:4003` `<script src="shooting-range.js"></script>`.

Lifecycle contract (confirmed end to end): `index.html:3245` calls `window.shootingRangeSetActive(view === 'shooting-range')`; `shooting-range.js:678` `function setActive(on) {` cancels the rAF (`:506`), removes the keydown listener (`:643`), and resumes the clock via `G.shiftClock` on re-entry (`:671`); registered at `shooting-range.js:769`.

**Implication for 3D:** integration cost is near zero — replace the two script files' contents (or add a third), keep `#sr-canvas` as the WebGL surface, keep the DOM HUD. The `role="img"` attribute on the canvas and the DOM-based HUD are the accessibility story; preserve them (a11y is explicitly not-lazy territory).

---

## 3D stack evaluation

The candidates named in the spec, judged against *this* repo — no build step, no npm, no framework, must work offline from `file://`-adjacent static hosting.

### `three`
**Verdict: CHOSEN, vendored as a committed pre-built UMD file.**

- It is the only mainstream 3D library that ships a **classic-script build exposing a global** (`THREE`), which is the only module format this project can load — there is no bundler to resolve a bare `import 'three'` specifier and no `package.json` to install into (*Build system*).
- The exact artifact is already on disk: `vendor/three.min.js` r160, 669,884 bytes, MIT license file alongside it (*Existing 3D libraries*).
- It fully covers the required feature set with no plugins: perspective camera, scene graph, procedural geometries, lights, and `THREE.Raycaster` for shot resolution — replacing the hand-rolled `scaleAt(z)` + `CFG.RANGE` double-bookkeeping with a single source of truth.
- Vendoring a large library and lazy-loading it is **established precedent in this repo, not a new pattern**: `xlsx-populate.min.js` (642,319 bytes) sits at the repo root and is injected on demand by `ensureXlsx()` at `index.html:2396` (`s.src = 'xlsx-populate.min.js';` at `index.html:2401`), awaited before each use at `index.html:3273`, `3491`, `3850`, and documented at `index.html:2009` and `index.html:2393` (`//  LIB SOB DEMANDA — xlsx-populate (642KB) só carrega ao usar o Faturador`). three.min.js at 670KB is the same order of magnitude and **must** follow the same lazy pattern — BP-005 forbids >100KB synchronously on the critical path, and the Shooting Range is a game tab most visits never open.

### `@react-three/fiber`
**Verdict: REJECTED. Non-starter, twice over.**

1. It is a **React renderer**. It requires `react` and `react-dom` as peer dependencies. This repo has no React (*Framework*) — adopting fiber means vendoring React + ReactDOM and introducing a component tree inside a vanilla app whose navigation is `hidden`-attribute toggling and whose state is module-scoped `var`s (*State management*). That is a parallel architecture, not an integration.
2. It is **distributed as ESM/CJS on npm only** — there is no maintained UMD/global build. With no bundler and no npm (*Build system*), there is nothing that can resolve its imports or its React peer imports. Making it load would mean adopting an import map plus ESM-CDN URLs, which breaks the offline requirement, or introducing a build step, which is explicitly forbidden.
3. Even setting distribution aside, its value proposition — declarative scene graph, reconciler-managed lifecycle, hooks — is value *relative to React*. Here the scene is a fixed booth with a handful of targets, and the lifecycle is already solved by one function (`setActive`). Fiber would add ~1MB of framework to make a 40-line `scene.add()` sequence declarative. Straight cost, no benefit.

### `@react-three/drei`
**Verdict: REJECTED. Depends on the thing already rejected.**

- `drei` is a helper collection **for `@react-three/fiber`** — every export is a React component or hook. It cannot be used without fiber, so rejecting fiber rejects drei by construction.
- Same npm-only ESM distribution problem, plus a wide dependency fan-out of its own.
- The helpers that would be tempting here (`<Sky>`, `<Text>`, orbit/pointer-lock controls, loaders) are each either unnecessary for a closed indoor booth, already solved by the DOM HUD (*Existing second-tab implementation*), or a small amount of direct three.js code. Pointer Lock in particular is ~30 lines against the native API (*Input system*) — importing a React helper ecosystem to get it is the definition of over-building.

### Decision

**Vendored plain three.js r160 (`vendor/three.min.js`), loaded lazily via a `<script>`-injection helper modeled on `ensureXlsx()` (`index.html:2396`), commit `vendor/` including `three.LICENSE.txt`, pin r160 (last UMD build), no other 3D/animation/physics dependency.**

Consequences to accept up front, so they are not discovered later:
- r160 is a dead-end for upgrades without an ESM migration (*Existing 3D libraries*). Pin it and say so in a comment.
- three's `examples/jsm/*` addons (GLTFLoader, EffectComposer, controls) are **not** in `vendor/three.min.js` and are ESM-only. Designing around zero addons keeps the stack at exactly one vendored file.
- The load must be gated behind entering the tab or pressing START, and the pre-load state needs a visible affordance — a silent 670KB wait is indistinguishable from a broken tab (BP-008: automation must have visible state in every branch, including when it does nothing yet).
- `test-shooting-range-dom.js` cannot instantiate a real `WebGLRenderer` under Node's fake canvas. Either keep renderer construction injectable, or the DOM test stops covering the lifecycle contract it exists to protect (*Existing game code*).

---

## Constraints that shape the implementation

Hard rules, from `CLAUDE.md` plus what the code actually enforces. These are not preferences.

1. **No npm dependencies in the frontend.** No `package.json`, no `node_modules` (both verified absent). Third-party code arrives only as a committed pre-built file resolved by a relative path.
2. **No build step, no bundler, no transpilation.** What is committed is what the browser executes. No top-level `import`/`export` in classic scripts.
3. **No custom Node server.** Node v24.14.0 exists solely to run headless test scripts (`node test-shooting-range.js`). The site is served as static files.
4. **Site stays static and works offline.** No runtime fetch, no CDN, no API. *Existing exception already in the tree:* remote Google Fonts at `index.html:8-10` (`<link href="https://fonts.googleapis.com/css2?family=Inter…">`) — it degrades to a fallback font and is pre-existing; do not add a second network dependency on its precedent.
5. **BP-005 — nothing >100KB loads synchronously on the critical path.** three.min.js at 669,884 bytes is 6.7× the threshold. It **must** be lazy-loaded on demand, following `ensureXlsx()` (`index.html:2396-2401`).
6. **BP-012 — Range CSS is static in `index.html`.** No `<style>` injected from JS. Extend the existing block at `index.html:1478+`; the block's own comment states this (`index.html:1479`).
7. **Preserve the lifecycle contract exactly.** `window.shootingRangeSetActive(bool)` (`index.html:3245` → `shooting-range.js:678`, exposed at `:769`) must keep cancelling the rAF, detaching the keydown listener, and pausing/resuming the round clock via `shiftClock` (`shooting-range.js:671`). Same behavior on `visibilitychange` (`shooting-range.js:767`). A WebGL render loop left running off-tab is a battery/GPU regression the current 2D build does not have.
8. **No duplicate listeners or loops on re-entry.** This is an asserted invariant, not a nicety — `test-shooting-range-dom.js` exists to catch it (`test-shooting-range-dom.js:97-98`).
9. **Keep the pure-rules / render split and the tests green.** `shooting-range-core.js` must stay DOM-free and dual-exported (`shooting-range-core.js:260-261`) so `node test-shooting-range.js` remains the regression net across the rewrite. Plain `assert` — do not introduce a test framework (that would need npm; see 1).
10. **Single source of truth for geometry.** The current build's documented hazard is `WALL_X`/`FLOOR_Y`/`CEIL_Y` drifting from `CFG.RANGE` (`shooting-range-core.js:29-31`) so that drawing and hit-testing disagree. Real 3D must resolve this by raycasting against the same transforms it renders — not by porting two parallel representations.
11. **BP-007 — verify before deleting.** The 2D drawing code in `shooting-range.js` is load-bearing until the 3D path is proven; the repo has a documented incident of removing "dead" code that was live. Code is the source of truth, not the docs.
12. **BP-006 — images <250KB, backup before recompressing.** Argues for the asset-free procedural range (*Asset structure*).
13. **Karpathy rules (CLAUDE.md §Diretrizes):** surgical changes, minimum code, no speculative abstractions, no refactoring working neighbors. Concretely: do not restructure `activateView`, the world-filter (`VIEW_GROUP`, `index.html:3201`), or any sibling tab while doing this.
14. **Emil design rules (CLAUDE.md §5):** the `emil-design-eng` skill must be invoked before UI/CSS work. Durations <300ms, custom easing (never `ease-in`), `:active { transform: scale(.97) }` on clickables, specific `transition` properties (never `transition: all`), and no gratuitous neon glow. Applies to the HUD, crosshair, and menu screens — not to in-scene 3D effects.
15. **Accessibility is not simplifiable.** The canvas carries `role="img"` (`index.html:1393`) and the HUD/end screens are real DOM (`index.html:1470-1471`), keyboard-reachable. A 3D rewrite must not move the HUD into the WebGL canvas.
16. **Untracked vendor directory must be committed.** `git status` reports `?? vendor/`. Ship `vendor/three.min.js` **and** `vendor/three.LICENSE.txt` (MIT attribution is a license obligation, not optional tidiness).

---

## Corrections to briefing facts

Two stated facts were wrong; everything else in the briefing was confirmed.

1. **WRONG: "NO 3D library present: no three, babylon, playcanvas, gl-matrix. Nothing WebGL anywhere."**
   `vendor/three.min.js` **does exist** — three.js **r160**, minified UMD, **669,884 bytes**, mtime 2026-08-14 12:56, with `vendor/three.LICENSE.txt` (1,081 bytes, MIT) beside it. Revision confirmed from the minified `const e="160"` at `vendor/three.min.js:7`.
   The *spirit* of the fact holds: it is **untracked in git** (`?? vendor/`) and **referenced by nothing** — zero occurrences of `vendor/` in any `.js`/`.html`, no `<script>` tag for it, no `THREE` usage outside the file. So there is no WebGL *in use* anywhere, and no `getContext('webgl')` call site exists. But the vendored artifact is already staged on disk, so Phase 1 should **wire and commit** it, not download it. Also inherited from that choice: r160 is the final revision with a classic-script build (the file self-warns at `vendor/three.min.js:1`), so the version is effectively frozen.

2. **IMPRECISE: "Styling: hand-written CSS, mostly a big inline `<style>` in index.html."**
   True but incomplete: there are also **two external stylesheets**, `design-system.css` (19,963 bytes) and `video-ops.css`, linked at `index.html:5044-5045` — *after* every `<script>`, at the very end of the file. Irrelevant to the range's own CSS (which is correctly static and inline at `index.html:1478+`), but it means "all CSS is inline" is not a safe assumption when reasoning about cascade or load order.

Minor precision notes (not corrections): `activateView` is declared at `index.html:3222`, not ~3225 (3225 is the `toolViews` array). `toolViews` also contains `video-ops`, which the briefing's list omitted.
