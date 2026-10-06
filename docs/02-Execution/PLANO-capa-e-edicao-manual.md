# Plano — Capa do TikTok + edição manual (música, remoções, texto fixo, zoom leve)

**Estado (2026-09-30):** rascunho da Fase 0. A divergência da linha de base (2255 × 2254) era a
entrega do Ângulo da Profundidade de 2026-09-29 sem a Fase 4; ela foi terminada e a linha de
base agora é **2278**, conferida pelo `provas.ps1`. Fases 0, 1 (capa) e 2 (música) ENTREGUES em
2026-09-30; Fases 3 (remoções + dono do mapa), 4 (texto fixo), 5 (zoom leve) e 6 (integração,
sabotagem, stills, docs) **ENTREGUES em 2026-10-01**. Fora: a conferência no Chrome (o servidor
do DevTools não conectou nesta sessão) — é o próximo passo. Desvios do plano:
a `CapaTikTok` mora no `Clip.jsx` (não em arquivo novo); o 29i foi de 4 para 5; `MUSICA_DB`
calibrado para 22/16 medindo o MP4 final (ver `estudio-video-worker.md`).
Decisões do usuário de 2026-09-30 (não reabrir): cinco recursos; música só de arquivo do PC
(MP3/M4A/WAV); capa = PNG 1080×1920 ao lado do MP4, escolhida no app ("Selecionar capa →
galeria"), nada embutido no MP4 nem via API; fundo da capa = um quadro do corte escolhido pelo
operador, com o enquadramento do corte; tudo posicionado pelo operador, dentro da direção
editorial (sem música alta, neon, emoji, texto em movimento, zoom agressivo, efeito por tempo).

## 0. Linha de base (medida em 2026-09-30)
- `.\provas.ps1`: ver §9 (total conferido contra o `CLAUDE.md`).
- Fixture de regressão: `video-worker/fixtures/regressao-antes-capa-edicao.json` — `renderBody`
  (site) e `render_props` (servidor) de cinco cortes salvos típicos (simples, `impacto`+`crop`,
  ajuste manual de legenda/posição/enquadramento, "Sem card", `capEdit`), nos dois presets.
  Cada fase ganha um check que recalcula os dez e exige igualdade profunda.
- Stills de controle: `preview-titulo.mjs` (21) e `preview-legenda.mjs` (37) — hashes em
  `video-worker/fixtures/stills-base-2026-09-30.sha256`. Toda fase re-renderiza e compara.

## 1. O que o código faz hoje (conferido por grep)
Confirmado, com uma correção:
- `editOf` (`video-ops.js:378`, `preset.js:1550`) e `edit_of` (`serve.py:616`);
  `candidateSanitize` valida `cardId`/`clipSaved`/`capEdit` (`video-ops.js:1785-1793`).
- `_cut_for_render` (`serve.py:2144`), `_content_length`/`_receive`/`_drain` (2723/2743/2760),
  `legenda_geometria` (685), `render_props` (763), `still_path` = hash dos props (1161),
  `default_clips_dir` (251), `worker.safe_component` (`worker.py:244`). Rotas por constante
  (`ROUTE_STILL` etc.) e despacho em `do_POST` (1787).
- `/api/remotion-still` = `_handle_render(still=True)`: **a capa reaproveita esse caminho**.
- 29i conta **quatro** `with self._render_slot():` (video-cut, yt-fetch, remotion-render — que
  cobre o still — e `_cut_for_render`). A capa entra pelo `_handle_render`, então **a contagem
  não muda**.
- `Clip.jsx`: um `<Video>` (linha 202), `loadFont` Inter 600–900 e Montserrat 800,
  `<Sequence>` do card e das falas. `@remotion/media` exporta `Audio` (sem dependência nova).
  `Root.jsx` tem só a composição `Clip`. `TOKENS.fps` = 30.
- **Correção ao prompt:** o 9w2 lê SÓ o `Clip.jsx` (imports `@remotion/google-fonts/*` =
  famílias do `LEGENDA_PRESETS`). A capa usa famílias já carregadas por ele (Montserrat 800,
  Inter 900) e o arquivo novo **não importa fonte**; check irmão 9w3: `CapaTikTok.jsx` sem
  import de fonte e famílias do `CAPA_ESTILOS` ⊆ carregadas, com peso na lista do `loadFont`.
- `clipBoundaryChanged` (`video-ops.js:4352`) apaga `clipCues` e `capEdit` junto do export.
  **Remoções não podem usar ele** (a borda não muda; falas e correção continuam válidas):
  função nova `clipEditadoInvalido(clip)` — sobe `rev`, zera `clipToken/clipFilename/clipBytes`,
  mantém `clipCues`, `capEdit`, `clipSaved` (o cru não muda) e o `id`.
- `tiktok.py`: escopo `video.upload`, sem parâmetro de capa (confirmado).

## 2. Campos e conjuntos fechados
Todos na chave de projeto que já existe, **sem chave nova e sem migração**. Ausente/torto ⇒ vazio
⇒ corpo e props idênticos à fixture.

| Campo | Onde | Forma |
|---|---|---|
| `clip.capaTikTok` | fora do `edit` | `{ v:1, quadroMs, titulo?, destaque?, estilo, posicao }` |
| `clip.edit.musica` | `edit` | `{ id, inicioMs, nivel }` |
| `clip.edit.remocoes` | `edit` | `[{ deMs, ateMs }]` (ms da FONTE) |
| `clip.edit.textos` | `edit` | `[{ id, texto, deMs, ateMs, posicao, estilo }]` |
| `clip.edit.zooms` | `edit` | `[{ id, deMs, ateMs, nivel }]` |

- `CAPA_ESTILOS` = `negocio` (padrão: caixa alta Montserrat 800, destaque na cor `destaque`,
  degradê escuro contido atrás) · `faixa` (Inter 900 sobre caixa escura) · `limpo` (Inter 900,
  sombra realista, sem caixa). `CAPA_POSICOES` = `alto` · `meio` · `baixo` (padrão `meio`).
- `MUSICA_NIVEIS` = `baixo` (padrão) · `medio`. Nenhum mais alto.
- `TEXTO_POSICOES` = `alto` · `meio`. `TEXTO_ESTILOS` = `rotulo` (caixa escura, Inter 700) ·
  `nota` (sem caixa, sombra de leitura) — nomes que não colidem com os seis da legenda.
- `ZOOM_NIVEIS` = `leve` · `medio`.
- `MUSICA_STATES` = `MUSICA_OK` · `MUSICA_AUSENTE` · `MUSICA_ILEGIVEL`, cabeçalho
  **condicional** `X-Clip-Musica` (sem música no corpo ⇒ sem cabeçalho).
- `CAPA_STATES` (resposta da rota da capa, não do render): `CAPA_OK` · `CAPA_SEM_FONTE` ·
  `CAPA_QUADRO_FORA` (quadro fora do corte ou dentro de uma remoção) · `CAPA_FALHOU`.
  A tela ainda tem os estados locais "sem quadro escolhido", "gerando" e "desatualizada".
- Nomes proibidos (colisão): `capa`/`thumbnail`/`miniatura`/`fundo`/`trilha`/`cover` — usados
  só como `capaTikTok`, `musica`, `remocoes`, `textos`, `zooms`.

Validadores (três cópias, literais, test que LÊ os arquivos e compara):
`preset.js` (dono dos números) `capaTikTokOf`/`editOf` estendido · `video-ops.js`
`capaTikTokOf`/`editOf` · `serve.py` `capa_tiktok_of`/`edit_of`. `candidateSanitize` valida
`capaTikTok` (BP-014: presente, ausente, torto). `edit.v` continua 1 (campo novo ausente = vazio;
versão desconhecida continua = tudo automático, check 16a).

## 3. Donos (um por grandeza)
| Grandeza | Dono | Espelhos |
|---|---|---|
| Mapa de tempo fonte→saída | `captions.mapa_saida(in_ms, out_ms, remocoes, fps)` (Python, puro) | nenhum em JS/JSX |
| Grade de quadro | `TOKENS.fps` (30) | `captions.FPS_SAIDA`, check compara |
| Ganho da música | `serve.ganho_musica(voz_lufs, faixa_lufs, nivel)` | tabela `MUSICA_DB` literal no JS só p/ prévia |
| Volume por quadro (fades) | `preset.volumeMusica(frame, props)` | — |
| Escala do zoom por quadro | `preset.escalaZoom(frame, zooms, fps)` | CSS da prévia com os mesmos níveis (literal) |
| Guias da capa (3:4, centro seguro, contador) | `preset.CAPA_ZONAS` | literal em `video-ops.js`, check compara |
| Quebra do título da capa | `preset` (`AVANCO_*` medidos + `resolveTitleHighlight`/`splitTitleHighlight`) | — |
| Pasta da biblioteca | `serve.default_music_dir()` = `~/Music/Estudio Musicas` | — |

`mapa_saida` devolve `{ pedacos: [(de_ms, ate_ms)], duracao_ms, mapa(ms_fonte) -> ms_saida|None }`
com as pontas presas à grade de 1/30 s (uma regra: `round`); é chamado por `_cut_for_render`
(concat), pelo remapeamento de falas/palavras, pela `legenda_geometria`, por textos/zooms e pelo
`durationSec`. A tela só PULA os trechos na prévia e mostra a duração resultante.

## 4. Rotas novas
- `POST /api/capa-tiktok` — corpo = o do still + `capaTikTok` resolvido (título e destaque já
  em texto). `capa_tiktok_of` → quadro exato por FFmpeg (`-ss` antes do `-i`, recodificado,
  1 quadro, PNG na pasta pública do render, sufixo aleatório) → `npx remotion still
  CapaTikTok` via `_handle_render` (composição por parâmetro; mesma fila, mesmo cache por hash
  dos props) → cópia `<base-do-corte>-capa-tiktok.png` na pasta dos cortes → JSON
  `{estado, arquivo, url: "/clips/…"}`.
- `POST /api/musica-importar` — corpo cru pelo `_content_length`/`_receive`/`_drain`, teto
  **50 MB por rota**, nome no cabeçalho `X-Musica-Nome` (URL-encoded) → `safe_component`,
  extensões `.mp3 .m4a .wav`, temporário → FFmpeg lê (duração do cabeçalho + `ebur128`
  integrado) → move para a biblioteca com id = sha256 dos bytes (dedupe) → sidecar
  `<id>.json` `{nome, durationSec, lufs, ext}`. Recusa vazio / grande / extensão / ilegível,
  cada um com motivo próprio, e drena o corpo.
- `GET /api/musicas` — lista dos sidecars. `GET /musicas/<id>.<ext>` — Range, `basename` +
  guarda de componente com ponto (mesma do `/clips/`), extensão fechada.

## 5. Render (Remotion)
- `Root.jsx` ganha `CapaTikTok` (1080×1920, 1 quadro, `studio/src/CapaTikTok.jsx`): `Img` do
  quadro, recorte = `palcoGeometria` + reframe do corte, título com destaque, sem `<Video>`.
- `Clip.jsx`: **um** `<Audio>` do `@remotion/media` só quando `musica` vem nos props
  (`trimBefore` = início na faixa, `volume` = `volumeMusica`: fade-in 1,0 s, fade-out 1,5 s
  terminando no fim da SAÍDA; faixa mais curta termina com o próprio fade, sem loop). Uma
  `<Sequence>` por texto nos tempos de saída do dono, opacidade ≤ 150 ms, sem transform.
  Zoom = `transform: scale(escalaZoom(...))` num `<div>` que embrulha SÓ o `<Video>` do palco
  (legenda, textos, card e fundo intocados; o palco já corta o excesso). 6m/6a/1d seguem.
- Sem os campos novos: árvore e props idênticos (fixture + hashes dos stills).

## 6. Worker
- `_cut_for_render` com `remocoes`: UM encode concatenando os pedaços (`trim/atrim` +
  `concat`, fades de áudio de 12 ms em cada junção, `-ss` antes do `-i`), duração = soma exata.
  Com `musica`: mede a voz do recorte (`ebur128`, mesma passada quando der) — sem faixa de áudio,
  nível nominal −23 LUFS e a tela diz isso — e calcula o ganho linear. A cópia da miniatura
  continua.
- Falas: depois do `capEdit`, antes do `normalize_cues` do caminho que já existe — palavras
  dentro de remoção saem, fala parcial é aparada, o resto desloca.
- `captions.ASS_NAO_REPRODUZ` ganha: música, remoções, texto fixo, zoom (33j2).
- **Risco a medir na Fase 2:** o `finish_video` aplica `loudnorm` de passe único (dinâmico) na
  MISTURA. Ele pode encolher o vão voz/música. A integração mede o vão no MP4 final
  (≥ 18 dB baixo / ≥ 12 dB médio); se não fechar, o ajuste é no ganho, nunca no `loudnorm`.

## 7. Tela (`video-ops.js`/`.css`, coluna da direita, `<details>` com resumo de uma linha)
Ordem nova depois de "Aparência da legenda": **Capa do TikTok · Música · Remover trechos ·
Texto na tela · Zoom leve**. Emil antes de qualquer CSS.
- **Capa:** "Usar este quadro" (player pausado) → canvas pequeno com o quadro do `<video>` que
  já existe + overlay CSS com `--px`, rótulo "prévia aproximada"; título (padrão `topic`),
  destaque, estilo e posição por radio nativo, guias 3:4/centro/contador; "Gerar capa (PNG
  real)" → "Baixar PNG" + "No TikTok: Selecionar capa → Enviar da galeria". Todos os estados
  falam; quadro fora do corte/dentro de remoção = "desatualizada", nunca movido calado.
- **Música:** "Sem música" (padrão), biblioteca em radios (nome + duração), "Importar do PC"
  (`<input type="file" accept=".mp3,.m4a,.wav">`), início por `clockField`/`parseClock`,
  nível Baixa/Média, nota fixa de direitos autorais, prévia por UM `<audio>` sincronizado ao
  player (play/pause/seek/velocidade), "prévia aproximada — a mistura final sai no MP4",
  aviso de faixa curta ("termina N s antes").
- **Remover trechos:** "Marcar início"/"Marcar fim" do tempo do player, lista com "Desfazer",
  total removido + duração resultante, linha do tempo fina do corte; prévia pula os trechos;
  o painel de texto da legenda MARCA falas dentro de remoção.
- **Texto na tela / Zoom leve:** mesma interação (marcar início/fim, lista, editar/remover);
  avisos (nunca bloqueio) de sobreposição com a página da legenda, os 4 s do card e as zonas
  do TikTok, com números da `/api/legenda-geometria`. Prévia do zoom = CSS no player (rotulada).
- Um `<video>` no DOM (check que já conta), sem rolagem horizontal 360–1440, container queries.

## 8. Números de partida (calibrar olhando/ouvindo; registrar os finais)
Música −20 dB (baixo) / −14 dB (médio) abaixo da voz; fade 1,0 s / 1,5 s; 50 MB.
Remoções ≥ 200 ms, ≤ 30, pedaço mantido ≥ 300 ms, fade de junção 12 ms.
Textos ≤ 3, ≤ 80 caracteres, ≥ 1 s, fade 150 ms. Zoom leve 1,06 / médio 1,12, teto 1,15,
transição 400 ms, ≤ 5, ≥ 1 s. Capa 1080×1920, centro seguro 1080×1080 (y 420–1500), grade
3:4 (1080×1440, y 240–1680), contador de plays embaixo à esquerda.

## 9. Arquivos, testes e stills
Arquivos que mudam: `studio/src/{preset.js,Clip.jsx,Root.jsx,CapaTikTok.jsx*}` ·
`studio/{test-preset.mjs,preview-capa.mjs*}` · `video-worker/{serve.py,captions.py,
test_serve.py,test_captions.py}` · `video-ops.js` · `video-ops.css` · `test-video-ops.js` ·
`test-video-ops-dom.js` · docs (`CLAUDE.md`, três regras, decisão em `03-Decisions/`,
`ESTADO-ATUAL.md`, `log.md`, este plano). (*novo)

Testes por fase: validadores (presente/ausente/torto/fora da faixa/versão desconhecida);
fixture intacta; dono do mapa (merge, grade, mínimos, falas e palavras dentro/parcial/depois,
textos e zooms dentro/parcial/removidos, soma); ganho; `volumeMusica`/`escalaZoom`; rotas
(aceita/recusa, travessia, tamanho, vazio, ilegível, lista, guardas, cada estado da capa);
frase para cada estado (padrão 30d); fluxos DOM de cada seção (definir → salvo → recarregar →
corpo do export → voltar ao padrão). Sabotagens em cópia temporária (Fase 6).

Stills novos (`preview-capa.mjs`): título curto, longo, com destaque, cada posição, com guias;
texto + legenda juntos; zoom no começo/meio/fim. Stills de controle devem manter o hash.

## 10. Ordem
Fase 1 Capa → Fase 2 Música → **parar para teste real** → Fase 3 Remoções + dono do mapa →
Fase 4 Texto → Fase 5 Zoom → Fase 6 integração, sabotagem, stills, Chrome, docs.
Cada fase: validadores → worker/dono → Remotion → tela → testes → `.\provas.ps1` verde.
