# Estúdio — TikTok cover + manual edits (music, cut-outs, fixed text, light zoom)

## Context
- Repo: Dootu (this folder). Working tree is UNCOMMITTED (plus CRLF noise on ~200 files). Current total per `CLAUDE.md`: **2254** checks.
- Read `docs/Constituicao.md`, `docs/INDEX.md`, `docs/01-Wiki/ESTADO-ATUAL.md`, `docs/02-Execution/PENDENCIAS.md` and `CLAUDE.md`; follow `.claude/rules/estudio-ui.md`, `estudio-remotion.md`, `estudio-video-worker.md`. Grep `docs/01-Wiki/archive/HISTORICO-estudio-video.md` before changing any number or guard. Read `docs/02-Execution/PLANO-3-dupla-compressao.md` §8 (frame-alignment trap) before touching how cuts are encoded.
- Invoke `emil-design-eng` before any UI/CSS work (mandatory). If installed, apply `karpathy-skills` and `ui-ux-pro-max-skill`. Do NOT follow the `remotion-edit` skill (this is editor code, not a clip edit). If you fan out sub-agents, load `workflow-sobrevivente` first.
- Never `git reset` / `git checkout -- <path>` / `git stash` / `git clean`, never normalize line endings, never `git add -A`. Do not commit. Read-only git with `git --no-optional-locks`. Don't read `video-ops.js` / `serve.py` / `preset.js` / `Clip.jsx` whole — grep and small scripts.
- Code comments and UI strings in PT-BR.

## What the code does today (re-confirm in Phase 0)
- **Per-cut edits:** `clip.edit = { v: 1, legenda, enquadramento }` inside the EXISTING project key. Three literal validators: `studio/src/preset.js` (owner of the numbers), `video-ops.js` `editOf`, `video-worker/serve.py` `edit_of`. Absent/malformed ⇒ empty ⇒ renders exactly as today. Clips load through `projectsSanitize` → `candidateSanitize` (which already validates `cardId`, `clipSaved`, `capEdit`).
- **Worker:** `serve.py` on `http://127.0.0.1:8765` (`.\estudio.ps1`). stdlib only, FFmpeg binary only, NO ffprobe (read FFmpeg's own header), never `import yt_dlp`. Routes: `/api/remotion-render`, `/api/remotion-still`, `/api/video-cut` (fast FFmpeg/ASS), `/api/legenda-geometria` (caption geometry + TikTok zones, owner `captions`), `/clips/` (`~/Videos/Cortes Estudio`, basename + dot-component guard), `/sources/` (Range). Upload plumbing exists: `_content_length` / `_receive` / `_drain`. `_cut_for_render` cuts the source for Remotion; check 29i counts `_render_slot`.
- **Remotion:** `studio/` 4.0.513 + `@remotion/media`. Composition `Clip` in `Root.jsx`; `npx remotion render|still` with `--public-dir` = the worker's temp cache, so `staticFile()` never reaches the repo. `@remotion/media` already exports `Audio` (no new dependency). Checks: 6m (one `<Video>`, only in `Clip.jsx`), 6a (`videoEscala` = 1), 1d (`videoCentroPct` = 0.5), 9w2 (loaded font families = what the presets use).
- **Editor:** one player left, controls right (`ytStageHTML`, `.yt-detail-main`); exactly ONE `<video>` in the DOM (a DOM test counts it). Caption preview uses `--px` custom properties; `clockField` / `parseClock` are the only min:sec boundary.
- **TikTok:** `video-worker/tiktok.py` sends the MP4 to the TikTok inbox (drafts, `video.upload`). That API has NO cover parameter; the cover is picked in the app ("Selecionar capa" → a frame or an image from the gallery).
- **Fast path:** `/api/video-cut` lists what it doesn't draw in `captions.ASS_NAO_REPRODUZ` (mirror check 33j2).
- **Name collisions — do NOT reuse:** `capa` / `thumbnail` / `miniatura` / `fundo` = the SOURCE video's YouTube thumbnail used as background (`render_background`, `BACKGROUND_STATES`, `YT.thumbnail`); `trilha` = TikTok right-button zone (`captions.TRILHA_X`, `avisos.trilha`); `cover` = CSS objectFit. New names: `capaTikTok`, `musica`, `remocoes`, `textos`, `zooms`.

## Decisions (Arthur, 2026-09-30) — don't reopen
1. This delivery has five features: **Capa do TikTok**, **música de fundo**, **remover trechos do meio**, **texto fixo na tela**, **zoom pontual leve**.
2. Music comes ONLY from files on my PC (MP3 / M4A / WAV). No links, no yt-dlp for audio.
3. Cover = PNG 1080×1920 saved beside the MP4. I send it to my phone and use "Selecionar capa → galeria". Nothing embedded in the MP4, no cover via API.
4. Cover background = a frame of the cut chosen by me, with the same framing as the cut.
5. Everything is placed by me at a moment I choose and stays inside the editorial rule already written (no loud music, no neon, no emoji, no moving text, no aggressive zoom, nothing fired only because time passed).

## Feature contracts
### A. Capa do TikTok (not part of the MP4)
- Background: pause the one player → "Usar este quadro" → `clip.capaTikTok.quadroMs` (source ms, clamped to the cut). Framing = `palcoGeometria` + the clip's reframe. No new crop formula.
- Headline: default = the clip title field (`topic`), editable. Uppercase, heavy (Montserrat 800 / Inter 900 — already loaded), one highlighted keyword via `resolveTitleHighlight` / `splitTitleHighlight`, closed palette only, legibility by realistic shadow or a contained dark gradient (no glow). Line breaks from the MEASURED `AVANCO_*` constants. No new family; extend 9w2 (or a sibling check) to the new composition.
- Closed sets: `CAPA_ESTILOS` (2–3 presets; default = business-channel look above), `CAPA_POSICOES` (`alto`, `meio`, `baixo`).
- Guides + warnings, never blocks (only hard limit: fits in the frame): profile grid ≈ 3:4 center crop (1080×1440, y 240–1680), play count bottom-left; headline inside the center 1080×1080 (y 420–1500). One owner for these numbers, mirrored with a check.
- Render: composition `CapaTikTok` (1080×1920, 1 frame) in `Root.jsx`; route `POST /api/capa-tiktok`: validate (`capa_tiktok_of`) → exact frame by FFmpeg (`-ss` before `-i`, re-encode, 1 frame) into the render public dir → `npx remotion still` → cache by props hash → save `<cut-base>-capa-tiktok.png` beside the MP4 (served by `/clips/`). Reuse the `/api/remotion-still` machinery; don't fork it. If the 29i count must change, change it deliberately and say why. Remotion `Img`, never `<img>`; no `<Video>` in this composition.
- UI "Capa do TikTok": Layer A = paused frame of the existing `<video>` drawn into a small canvas (same origin, never a 2nd `<video>`) + CSS overlay with `--px`, labeled "prévia aproximada". Layer B = "Gerar capa (PNG real)" → real PNG, "Baixar PNG", and "No TikTok: Selecionar capa → Enviar da galeria". States that speak: no source, no frame, generating, ready, failed (reason), stale (frame outside the cut or inside a removal — never moved silently).
- Storage: `clip.capaTikTok` OUTSIDE `clip.edit`, same project key. Validators JS `capaTikTokOf`, PY `capa_tiktok_of`, preset-side resolver; `candidateSanitize` validates it.

### B. Música de fundo
- Library: durable folder outside repo and temp (one owner, e.g. `default_music_dir()` next to `default_clips_dir()`). `POST /api/musica-importar`: raw body through the existing plumbing, per-route cap 50 MB (the default cap is for GB videos), name in a URL-encoded header sanitized by `worker.safe_component`, closed extensions `.mp3 .m4a .wav`, temp file → FFmpeg validation → move into the library; reject empty / oversize / unknown / unreadable with the reason. id = content hash (dedupe). Measure integrated loudness at import (FFmpeg `ebur128` or `loudnorm` print) → sidecar `{nome, durationSec, lufs, ext}`. `GET /api/musicas` lists; `/musicas/<id>.<ext>` serves with Range and the `/clips/` guards.
- Per cut: `clip.edit.musica = { id, inicioMs, nivel }`. `MUSICA_NIVEIS` = `baixo` (default) | `medio` — NO louder level. Level = "dB below the VOICE". Owner in Python: only when music is set, measure the cut's voice loudness in `_cut_for_render` (no audio track ⇒ nominal level, and the screen says so) and compute the linear gain from voice LUFS, track LUFS and `nivel`. The screen sends intent, never dB.
- Render: worker copies the track into the render public dir (random suffix) → props (file, gain, offset). `Clip.jsx` gets exactly ONE `<Audio>` from `@remotion/media` (trimBefore from the offset), volume from a pure exported `preset.js` function (fades owned there, fade-out ends at the output end). Music runs on the OUTPUT timeline (removals don't remap it). Track shorter than the cut ⇒ it ends with its fade and the UI says how many seconds early (no loop).
- States: conditional `X-Clip-Musica`, closed `MUSICA_STATES` (`MUSICA_OK`, `MUSICA_AUSENTE`, `MUSICA_ILEGIVEL`), each with a phrase in `video-ops.js` and a `test_serve.py` check that READS the JS (30d pattern). Missing track ⇒ export WITHOUT music and say so (like an orphan card), never another track. No music ⇒ no header, identical props.
- UI "Música": "Sem música" (default), library as native radios (name + duration), "Importar do PC", start point via `clockField` / `parseClock`, level radios (Baixa / Média), fixed note "Faixa com direitos autorais pode ser silenciada pelo TikTok — prefira faixas livres de direitos." Preview = one `<audio>` synced to the one player (play / pause / seek / rate), volume approximated from the same table + stored track LUFS (nominal voice level stated in the plan), labeled "prévia aproximada — a mistura final sai no MP4".

### C. Remover trechos do meio
- Model: `clip.edit.remocoes = [{ deMs, ateMs }]` in SOURCE ms, strictly inside the cut, sorted, merged; each ≥ 200 ms, max 30, kept pieces ≥ 300 ms. At the very start/end ⇒ refuse and tell me to move the boundary. ms precision is fine here: removals never touch `inSec` / `outSec`, file names, `num()` or `edit_key` — the whole-second boundary rule stays as is.
- ONE owner of the time map: a pure Python function (e.g. `captions.mapa_saida(in_ms, out_ms, remocoes)`) snapping edges to the output frame grid (mirror of `TOKENS.fps`, one rounding rule) → kept segments + source→output map. Used by: (1) `_cut_for_render`: ONE encode concatenating the kept pieces (`-ss` before `-i`, exact frames, 10–15 ms audio fades per join, duration = exact sum; the thumbnail copy beside the recorte keeps working); (2) cue AND per-word remap inside the existing path (`ytclip.cues_for_range` → `captions.normalize_cues`), after `clip.capEdit`: drop words inside removals, clip partial overlaps, shift the rest; (3) `/api/legenda-geometria` pages (preview = export); (4) `textos` / `zooms`; (5) `durationSec`. No remap formula in JS/JSX: the screen only skips removed spans in preview playback and shows the resulting duration.
- UI: "Marcar início" / "Marcar fim" from the player time, list with "Desfazer" each, total removed + resulting duration, slim timeline of the cut with the removed spans; preview skips them (labeled). The caption correction panel marks falas inside a removal instead of hiding them. Changing removals invalidates the exported edited MP4, never the source nor the cut `id` (reuse `clipBoundaryChanged` / `rev` without dropping still-valid data such as source-rebased cues).
- Don't touch `parse_json3` or `candidates()`.

### D. Texto fixo na tela
- Model: `clip.edit.textos = [{ id, texto, deMs, ateMs, posicao, estilo }]` in SOURCE ms (mapped by the owner); max 3, ≤ 80 chars, ≥ 1 s, no overlap. `posicao` ∈ `alto` | `meio`; `estilo` = 2 presets from existing tokens, named differently from caption styles. Static: hard cut or opacity fade ≤ 150 ms (constant in `preset.js`); no transform animation.
- Render: one `<Sequence>` per text at output times from the owner; partially removed ⇒ clipped; fully removed ⇒ dropped and the UI says so. Warn (never block) on overlap with the caption page, the title card's first 4 s, or the TikTok zones (numbers from `/api/legenda-geometria`).
- UI: same interaction as removals (mark in/out, list with edit / remove).

### E. Zoom pontual leve
- Model: `clip.edit.zooms = [{ id, deMs, ateMs, nivel }]` in SOURCE ms; max 5, ≥ 1 s, no overlap. `nivel` ∈ `leve` | `medio`; hard ceiling 1.15. Custom ease in/out, no overshoot, no shake / rotation / pan, centered.
- Render: pure exported `preset.js` function (frame, zooms in output frames) → scale, exactly 1 outside intervals, applied ONLY to the video-layer wrapper (captions, texts, title card and blurred background untouched; stage clips overflow). 6m, 6a and 1d stay green — if they can't coexist with this, STOP and ask.
- UI: same interaction as removals; preview = CSS transform on the one player (approximate, labeled).

### Fast path
`/api/video-cut` does NOT reproduce B–E in this delivery: add them to `captions.ASS_NAO_REPRODUZ` (33j2) so its button says so.

## Numbers — STARTING values (calibrate by eye/ear on stills and exports; record the finals)
- Music: baixo −20 dB / medio −14 dB below the voice; fade in 1.0 s, fade out 1.5 s; 50 MB.
- Removals: ≥ 200 ms, ≤ 30, kept ≥ 300 ms, join fades 10–15 ms.
- Texts: ≤ 3, ≤ 80 chars, ≥ 1 s, fade ≤ 150 ms.
- Zoom: leve 1.06 / medio 1.12, ceiling 1.15, transition 400 ms, ≤ 5, ≥ 1 s.
- Cover: 1080×1920, safe center 1080×1080, grid guide 3:4.

## Invariants (unchanged)
- One owner per quantity; the screen sends intent, never pixels, dB or frames. Closed sets as LITERALS in each copy, with tests that READ the files and compare (existing pattern).
- Saved cuts without the new fields: deep-equal `renderBody` / `render_props` and byte-identical still hashes. The existing checks pass WITHOUT edits; only key-list assertions may change.
- No new dependency (npm in the site, pip, ffprobe), no new localStorage key, no migration. BP-001, BP-008, BP-013, BP-014 (every sanitizer/loader called with constructed data, field present AND absent/malformed). Neon stays only on the spoken word.
- Every new header value has a phrase in `video-ops.js`; distinct failures never collapse into one message.
- Security: sanitized names, closed extension lists, basename + dot guard on every new served path, size caps, drain on refusal. No secrets anywhere.
- UI: native radios, container queries, one player, no horizontal overflow 360–1440 px, Emil rules (strong custom easing, < 300 ms, `:active { transform: scale(.97) }`, never `transition: all`, no glow). New sections go in the existing right column with existing patterns (`<details>` with a one-line state summary); don't redesign the column.

## Mandatory order
### Phase 0 — confirm and plan (NO edits)
1. `.\provas.ps1` green at 2254. If not — including a CLAUDE.md total that differs from the measured one — stop and report.
2. Baseline: render the current stills (`cd studio; node preview-titulo.mjs`; `node preview-legenda.mjs <baseline-folder>`), hash the PNGs, and save the current `render_props` output of one saved cut as the regression fixture.
3. Re-confirm "What the code does today" with grep (names, lines).
4. Plan in `docs/02-Execution/PLANO-capa-e-edicao-manual.md` (linked from `docs/INDEX.md`): exact field names, closed sets, owners, routes, UI placement, files that change, tests to add, stills list, starting numbers.

**Stop and wait for my OK.**

### Phase 1 — Capa do TikTok
### Phase 2 — Música

**Stop and wait for my OK** (I test cover + music in real use before the heavy part).

### Phase 3 — Remoções + the time-map owner
### Phase 4 — Texto fixo (uses the owner)
### Phase 5 — Zoom leve (uses the owner)
Inside each phase: validators (3 copies + mirrors) → worker / owner → Remotion → UI (Emil first) → its tests → `.\provas.ps1` green. Never start a phase on red.

### Phase 6 — integration, sabotage, stills, Chrome, docs
- **Integration** (worker running): export one real cut with removals + music + 1 text + 1 zoom. Duration = sum of kept pieces ± 1 frame (FFmpeg header). Measured with FFmpeg: music ≥ 18 dB (baixo) / ≥ 12 dB (medio) below the voice; words in sync after each join. Listen to it.
- **Tests:** validators (present / absent / malformed / out of range / unknown version); time-map owner (merge, snapping, minimum sizes, cues + words inside / partial / after, texts and zooms inside / partial / fully removed, duration sum); music-gain owner; volume and zoom pure functions; routes (import accept / reject, traversal, oversize, empty, unreadable; list; serve guards; every cover state); DOM flows for each section (set → saved → reload → export body carries it → "voltar ao padrão" clears it).
- **Sabotage** a temp COPY (never the repo): remap shifted by +1 frame; gain sign flipped; zoom applied to the captions layer; `candidateSanitize` dropping `capaTikTok` — the new checks must go red. Show it.
- `.\provas.ps1` green; paste the `Checks:` line it prints into `CLAUDE.md`.
- **Stills:** new `studio/preview-capa.mjs` (modeled on `preview-titulo.mjs`): short title, long title, highlight, each position, with guides; plus text + caption coexistence and zoom at start / middle / end. LOOK at each. Re-render the baseline stills: same hashes.
- **Chrome** (`.\estudio.ps1`, http://127.0.0.1:8765): 390 / 800 / 1100 / 1440 px; every new state visible; keyboard focus; still one `<video>` in the DOM; preview vs real result for cover, text and zoom.
- **Docs (short, dated):** one paragraph in `CLAUDE.md` "Estúdio de Vídeos (regra de topo)"; owners and invariants in the three rules files; a decision note in `docs/03-Decisions/` (append-only, linked from `docs/INDEX.md`) with the decisions above; `docs/01-Wiki/ESTADO-ATUAL.md` (state + exact next step); one line in `docs/log.md`; mark the plan delivered at its top. Usee Constitution: no file lists or execution logs inside notes.

## Acceptance
- Saved cuts without the new fields: identical props and still hashes (every existing case).
- Cover: real PNG 1080×1920 beside the MP4, matching the preview; guides show the 3:4 crop and the safe center.
- Music: import / list / pick / offset / level survive reload and reach the MP4; measured gaps met; a missing track exports without music and the screen says so.
- Removals: exact duration; captions in sync after every join; preview skips the spans.
- Texts and zooms land exactly on the chosen spans after removals; captions and title card unaffected by the zoom; 6m / 6a / 1d green.
- The fast-download button lists what it doesn't reproduce.

## Out of scope
The rights gate (`ytFetchGate`) and yt-dlp flags · music from links · direct post (`video.publish`) or cover via API · cover embedded in the MP4 · the publish pipeline deleted on 2026-08-21 · removed modules · `parse_json3` / `candidates()` / the recommendation · Resultados · ducking, beat sync, transitions, B-roll, stickers, moving text · deleting tracks from the library (goes to pending) · refactors of neighboring code. Report anything else you notice; don't fix it.

## Stop and ask me if
Baseline red · a new dependency seems necessary · 6m / 6a / 1d / 9w2 can't hold · anything needs the rights gate, the deleted publish pipeline or the recommendation code · a rule in `CLAUDE.md` or `.claude/rules/` contradicts this prompt · unclear where a note belongs.

## Deliverable (reply in PT-BR)
1. O que mudou — uma linha por arquivo
2. Campos, conjuntos fechados, donos e rotas novas
3. Números finais (o que calibrou e por quê), medições de loudness e de duração
4. Provas: saída do `provas.ps1` por fase, nova linha `Checks:`, sabotagem que ficou vermelha
5. Stills: caminhos, hashes antes/depois e o que viu em cada um
6. Prévia × resultado real (capa, música, remoções, texto, zoom)
7. Riscos, pendências e próximo passo
