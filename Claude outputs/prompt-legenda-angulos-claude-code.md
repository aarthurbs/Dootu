# Estúdio — caption Profundidade: 8 angles (back, forward, sideways, diagonals)

## Context
- Repo: Dootu (this folder). Extends the 2026-09-25 Profundidade (`clip.edit.legenda.profundidade`, `Nenhuma · Suave · Funda`), which today only tilts the caption BACK. I like the depth; I want more angles — sideways and diagonals too. Working tree is UNCOMMITTED. Current total: **2254** checks (`CLAUDE.md`).
- Read `CLAUDE.md`; follow `.claude/rules/estudio-remotion.md`, `estudio-ui.md`, `estudio-video-worker.md`. Invoke `emil-design-eng` before any UI/CSS work (mandatory). If installed, apply `karpathy-skills` and `ui-ux-pro-max-skill`. Do NOT follow the `remotion-edit` skill (this is editor code, not a clip edit).
- Never `git reset` / `git checkout -- <path>` / `git stash` / `git clean`. Do not commit. Don't read `video-ops.js` / `serve.py` / `preset.js` whole — grep and small scripts.
- Code comments and UI strings in PT-BR.

## What the code does today (re-confirm in Phase 0)
- **Owner — `studio/src/preset.js`:** `LEGENDA_PROFUNDIDADES` (suave 16° / 1800 px / 4 × 1.5 px; funda 32° / 700 px / 7 × 1.25 px; tinta 35) and the pure `profundidadeLegenda(aparencia)`: `transform: perspective(N) rotateX(θ)`, `transformOrigin: '50% 100%'`, `textShadow` = hard layers `0 {i·passo}px 0 color-mix(in srgb, <cor> 35%, #000)` + the style's reading shadow last. With caixa de fundo: transform only. `resolveLegenda` carries only the key; `Clip.jsx` only spreads the result (18j).
- **Site mirror — `video-ops.js`:** literal copy of the table, `legProfundidadeSombra` (× `--px`), the "Profundidade" radio in the panel, `LEGENDA_AUTO_COMUM.profundidade = 'nenhuma'`, the caixa note updated in place (`data-leg-prof-nota`). CSS `.vop-leg-prev[data-prof] > span` hardcodes `rotateX(var(--leg-incl))` and origin `50% 100%`.
- **Server — `serve.py`:** `LEGENDA_PROFUNDIDADES = ("suave", "funda")` inside `edit_of`. Forgetting a set here drops the key silently: preview tilted, MP4 flat.
- **ASS:** `ASS_NAO_REPRODUZ` already says it doesn't draw Profundidade (14h). No change.
- **Tests:** `test-preset.mjs` §18 (18a–18k; 18e proves the tilted page stays inside the flat block — for `tras` only), `test_serve.py` §35 (35f, 35f2, 35g), `test-video-ops.js` (mirror, validator, `LEGENDA_AUTO_COMUM` key list), `test-video-ops-dom.js` (flows 5–6). Stills 11–16 and 24 in `studio/preview-legenda.mjs`.

## Decisions (Arthur, 2026-09-29) — don't reopen
1. **Eight named directions** on top of today's intensity (`Nenhuma · Suave · Funda` stays as is). The direction is where the text LEANS = the side that goes AWAY from the camera: `tras` (today's), `frente`, `esquerda`, `direita`, `tras-esquerda`, `tras-direita`, `frente-esquerda`, `frente-direita`. Named presets, not free degrees — each cut gets one repeatable angle I can compare later.
2. **New field** `clip.edit.legenda.profundidadeDirecao` (closed set, inside the existing `edit`, no migration). Absent = `tras` → every saved cut renders byte-identical. Valid in all six styles; switching style keeps it; "Voltar ao padrão" clears it.
3. **UI:** a 3×3 pad "Ângulo" right under "Profundidade". The 8 outer cells are the directions (cell position = the side that goes away), each with a tiny "Aa" already tilted — pick by sample. Center cell empty. Disabled while Profundidade = Nenhuma, and says why.
4. **Still static:** no number depends on time or frame; only the active word's pop animates. No transition when switching angle.
5. Record in `CLAUDE.md` (the Profundidade paragraph, one sentence dated 2026-09-29) and in the rules. Short.

## Geometry contract — why `tras` pivots on the base
The server guarantees the FLAT page stays 40 px inside the frame (plus the top guard). If the tilted page stays inside its flat box, that guarantee holds for every angle with ZERO change in Python. So:
- **Pivot = the edge (or corner) nearest the camera.** Everything else recedes (z ≤ 0). With `perspective()` inside `transform`, the vanishing point is the `transform-origin`, so receding points shrink toward the pivot and stay inside the box.
- **Signs** (CSS axes: y down, z toward the viewer): `rotateX(+θ)` sends the top away (`tras`, today); `rotateY(+φ)` sends the right side away (`direita`). The corner check proves them.

| Direction | Goes away | Pivot (`transform-origin`) | Rotation | Volume offset (near side) |
|---|---|---|---|---|
| `tras` (today) | top edge | `50% 100%` | `rotateX(+θ)` | (0, +1) |
| `frente` | bottom edge | `50% 0%` | `rotateX(−θ)` | (0, −1) |
| `direita` | right side | `0% 100%` | `rotateY(+φ)` | (−1, 0) |
| `esquerda` | left side | `100% 100%` | `rotateY(−φ)` | (+1, 0) |
| `tras-direita` | top-right corner | `0% 100%` | `rotateY(+φ) rotateX(+θ)` + `translateX` | mix (−, +) |
| `tras-esquerda` | top-left corner | `100% 100%` | `rotateY(−φ) rotateX(+θ)` + `translateX` | mix (+, +) |
| `frente-direita` | bottom-right corner | `0% 0%` | `rotateY(+φ) rotateX(−θ)` + `translateX` | mix (−, −) |
| `frente-esquerda` | bottom-left corner | `100% 0%` | `rotateY(−φ) rotateX(−θ)` + `translateX` | mix (+, −) |

- Sideways pivots on the BOTTOM corner, so the base stays on `legendaBase` for the whole `tras` + sideways family.
- The `frente` family pivots on the TOP: the base rises off the anchor (up to ~70 px for a 2-line page at 96 px, Funda). Intended — pivoting `frente` on the base would grow the top past the flat box and can leave the frame.
- **Diagonals leak without a fix.** With `perspective(N) rotateY(±φ) rotateX(±θ)` (rotateX applies first), the far vertical end pokes out past the NEAR side edge by up to `s·H·sinθ·sinφ` (H = page height, s = that corner's perspective scale). Compensate with a screen-space `translateX(c)` placed FIRST in the list (so it applies after the projection): `c` = that poke for the tallest page (`H_max = MAX_LINHAS × fonte × entrelinha`, from the resolved aparência), signed away from the near edge (≈ 14 px at Funda, ≈ 10 px at Suave, for a 2-line page at 96 px). A shorter page just gets nudged inward — the far side has slack. The corner check is the proof, not this formula.
- `tras` / `frente` stay single-axis strings (`perspective(N) rotateX(θ)`, no `rotateY(0deg)`), sideways is `perspective(N) rotateY(φ)` only.

## Numbers — STARTING values, calibrate BY EYE on stills
- `inclinacao` (θ) and `perspectiva` stay exactly as today, so `tras` is untouched.
- Sideways needs its own angle (e.g. `giro`, φ): the column (up to 1000 px) is ~4× wider than a 2-line page is tall, so 32° / 700 sideways would shrink the far end of a 1000 px column to ~57% (`700 / (700 + 1000·sin 32°)`). Start at **suave `giro` 16°, funda `giro` 12°**.
- Diagonals: start with both angles × 0.75 (the factor lives in the table, not inline).
- Volume: same `camadas` / `passo` / `tinta`; offset toward the near side (table above); diagonals = normalized mix weighted by the two angles. Round like today; a zero component prints `0` (never `-0`), so `tras` stays byte-identical.
- All numbers live in `preset.js` (owner — e.g. extend each `LEGENDA_PROFUNDIDADES` entry + a `LEGENDA_PROFUNDIDADE_DIRECOES` table with signs and pivot), mirrored literally in `video-ops.js`. Keep one entry per line in `LEGENDA_PROFUNDIDADES` (35g reads its keys with `^\s*(\w+): \{`).

## Invariants (unchanged)
- Python stays the only owner of geometry and pagination: `captions.margem_inferior`, `captions.coluna_x`, `captions.paginas_remotion`, `serve.legenda_geometria`, `serve.render_props`. No change there — the contract above is what makes that possible.
- `profundidadeLegenda(aparencia)`: one argument, no time/frame (18b); `resolveLegenda` carries only the key; `Clip.jsx` only spreads (18j). Pure exported functions called by tests; no regex over JSX for behavior.
- Three literal copies of `editOf` (33a–33b) + the new set mirrored in `preset.js` / `serve.py` / `video-ops.js` (the 35g pattern).
- **The existing checks in §18 of `test-preset.mjs` pass WITHOUT edits** — they prove saved cuts didn't change. Only key-list assertions (e.g. `LEGENDA_AUTO_COMUM`) may change.
- No new npm dependency, no new localStorage key, no migration. BP-001, BP-008, BP-013, BP-014 (sanitizer called with constructed data, key present and absent). Neon stays only on the spoken word.

## Mandatory order

### Phase 0 — confirm and plan (NO edits)
1. `.\provas.ps1` green at 2254. If not, stop and report.
2. Baseline: render ALL current stills (`cd studio; node preview-legenda.mjs <baseline-folder>`) and hash the PNGs.
3. Re-confirm "What the code does today" with grep (names, lines).
4. Plan with exact names: field and values, table shape, the 16 transform + origin strings (8 directions × suave/funda) with the starting numbers, the compensation `c` of each diagonal in px for the worst case, files that change, tests to add/update, stills list.

**Stop and wait for my OK.**

### Phase 1 — owner (preset.js) and Remotion
- Tables + `profundidadeLegenda` handle the direction; absent → `tras` → the same object as today.
- `editOf` accepts `profundidadeDirecao` (closed set); `resolveLegenda` carries only the key.
- `Clip.jsx`: no change expected (it only spreads). If you think it needs one, say why first.

### Phase 2 — mirrors (server and site)
- `serve.py`: the direction set + `edit_of`; `render_props` sends it inside `edit` (same path as `profundidade`).
- `video-ops.js`: validator copy, table copy, `LEGENDA_AUTO_COMUM.profundidadeDirecao = 'tras'`, and a pure mirror for transform + origin next to `legProfundidadeSombra` (which gains an OPTIONAL direction argument, default `tras` — current calls keep working). Export them for the tests.

### Phase 3 — panel and preview (invoke `emil-design-eng` first)
- Pad "Ângulo" under "Profundidade", before the caixa note. 8 native radios in a 3×3 grid, through `legRowHTML` and the same `data-leg-field` / `data-id` path as `legRadiosHTML` — saving, the "ajustado" marker, "voltar ao automático" and "Voltar ao padrão" work with no new handler. Center cell = non-interactive placeholder.
- Each cell: a tiny "Aa" with the direction's signs/pivot and the selected intensity's angles (perspective scaled to the sample so the lean reads at that size — it's an icon, not a measurement) + the name as visually hidden text and `title`.
- Names: "Para trás", "Para frente", "Para a esquerda", "Para a direita", "Para trás e à esquerda", "Para trás e à direita", "Para frente e à esquerda", "Para frente e à direita". Default checked: "Para trás".
- With Nenhuma: native `disabled` + visible line "Escolha Suave ou Funda para usar o ângulo." (BP-008). Changing the intensity updates the pad IN PLACE (disabled state, samples), like `data-leg-prof-nota` — no panel re-render. The caixa note keeps working for every direction.
- Look: cells ≥ 40 px; selected = border + contained offset shadow (like `.vop-cardstyle input:checked + label`); `:focus-visible` ring; `:active { transform: scale(.97) }` 120–160 ms with `--vop-ease-out`; hover only under `@media (hover: hover) and (pointer: fine)`; never `transition: all`; no glow. Samples and preview switch instantly.
- Preview (`.vop-leg-prev`): replace the hardcoded `rotateX(var(--leg-incl))` / `50% 100%` with the mirrored transform + origin (`translateX(-50%)` stays first). "Como sai 9:16" must match "Ver o quadro real".

### Phase 4 — tests, stills, Chrome, docs
- **`test-preset.mjs` §19 (new):**
  - absent direction ≡ `tras` ≡ today (whole block style, suave and funda, all six styles);
  - each direction: expected pivot; only `perspective` / `rotateX` / `rotateY` (+ `translateX` on diagonals); caixa → transform only, no `textShadow`;
  - **corner check:** parse the `transform` / `transformOrigin` the function returns and project the 4 corners of the flat box with your OWN 3D math (independent from the implementation). Grid: 8 directions × 2 intensities × column {240, 360, 820, 1000} × page {1 line, `MAX_LINHAS` lines} × font {32, 96} × line height {1.1, 1.3}. Every corner inside the flat box (±0.5 px); for every bottom pivot (`tras`, sideways, `tras-*`) the bottom corners stay at y = 0. Print the worst margin. If a case fails, fix the transform — never drop the case;
  - **legibility:** at column 1000 and the tallest page (2 × 96 × 1.3), the farthest corner's perspective scale `N / (N − z)` ≥ 0.70, every direction × intensity;
  - volume points to the near side; `editOf` keeps valid / drops invalid / never adds the key when absent.
- **`test_serve.py` §36 (new):** `edit_of` keeps/drops; `render_props` carries it; the direction set is identical in `preset.js` / `serve.py` / `video-ops.js`.
- **`test-video-ops.js`:** tables deep-equal; mirror transform/origin/shadow == preset for all 16 combos (strip `calc(… * var(--px))`); screen validator == preset; update the key lists.
- **`test-video-ops-dom.js`:** Nenhuma → pad disabled + reason → Funda → "Para trás e à direita" → saved in `clip.edit.legenda.profundidadeDirecao` → reopened → export body carries it → switching style keeps it → "Voltar ao padrão" clears it; the preview span gets the direction's origin.
- **Sabotage** a temp COPY (never the repo): wrong pivot on `direita`, and no compensation on one diagonal — the new checks must go red. Show it.
- `.\provas.ps1` green; paste the `Checks:` line it prints into `CLAUDE.md`.
- **Stills** (new cases from 25): the 8 directions at Funda on `impacto`; Suave `direita` and Suave `tras-esquerda` on `classico`; Funda `direita` on `podcast` (volume under the stroke); Funda `tras-direita` on `faixa` (tilt only); via `doDono`: Funda `tras-esquerda` at `posicaoXPct` 0, Funda `frente-direita` at 100, Funda `frente` at `posicaoPct` 0. LOOK at each: nothing leaves the frame, text sharp under `rotateY`, volume on the near side. Re-render all existing cases: same hashes as the baseline (or a 0-pixel diff).
- **Chrome** (`.\estudio.ps1`, http://127.0.0.1:8765): pad at widths 390 / 800 / 1440; Tab reaches the group and arrows move inside it; preview vs "Ver o quadro real" for `direita`, `tras-esquerda`, `frente`.
- **Docs:** `CLAUDE.md` (one sentence), `estudio-remotion.md` (tables, pivot rule, diagonal compensation, final numbers), `estudio-ui.md` (pad + mirror). Short.

## Acceptance
- Saved cuts without the new field: byte-identical props and still hashes (every existing case).
- The 8 directions × 2 intensities pass the corner check and the 70% legibility floor; the 8 are clearly distinct on the stills.
- Pad: disabled with Nenhuma and says why; the choice survives reload and reaches the MP4; the preview matches the real frame.

## Out of scope
The intensity radio itself, style values, animation of any kind, Python geometry/pagination, the ASS path, neon fan, title cards, karaokê timing, text correction, reframe, `ytclip.py`, Resultados, publishing, other modules. Report anything else you notice; don't fix it.

## Deliverable (reply in PT-BR)
1. O que mudou — uma linha por arquivo
2. Campo, tabelas e números finais (o que calibrou e por quê)
3. Pivôs e compensação das diagonais (pior caso em px)
4. Provas: saída do `provas.ps1`, nova linha `Checks:`, sabotagem que ficou vermelha
5. Stills: caminhos, hashes antes/depois e o que viu em cada ângulo novo
6. Prévia × quadro real nos 3 ângulos
7. Riscos, pendências e próximo passo
