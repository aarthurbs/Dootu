---
paths:
  - "video-worker/**"
  - "provas.ps1"
  - "estudio.ps1"
description: Regras ativas do renderizador Python do Estúdio (FFmpeg/ASS, yt-dlp, rotas).
---

# Estúdio de Vídeos — `video-worker/` (regras ATIVAS)

Histórico, medições e armadilhas completas: `docs/01-Wiki/archive/HISTORICO-estudio-video.md`
(grep lá antes de mexer num número — cada um tem uma medição atrás).

## Restrições de arquitetura (invioláveis)
- **stdlib only.** Nenhuma dependência nova. **Sem `ffprobe`** (CONTRATO_TRABALHADOR §9) —
  leia o cabeçalho do próprio FFmpeg. Nunca `import yt_dlp`; só o BINÁRIO.
- **Precisa de `http://127.0.0.1:8765`** (rode `estudio.ps1`).
- **Dono ÚNICO por grandeza.** Duas contas independentes fazem o mesmo corte sair
  diferente em cada renderizador, calado:
  - `captions.normalize_cues` — limpeza/ordenação/aparo de cue. TUDO passa por ela
    (ASS, Sequence do Remotion, painel de revisão) via `ytclip.cues_for_range`.
  - `captions.margem_inferior` — âncora vertical da legenda. O Remotion a recebe
    pelo prop `legendaBase`; **não** existe segunda fórmula.
  - `worker.band_height(video_h)` — altura da tarja → filtro `band_h` + prop `bandaAltura`.
  - `serve.video_box(profile, media)` — altura do vídeo em TODOS os perfis. UMA
    chamada devolve `reframe`, `videoAltura`, `legendaBase`, `bandaAltura`.
  - `captions.strip_artifacts` — remoção de `>>` e `[ __ ]`, chamada de dentro do
    `normalize_cues`. Nenhum renderizador ganha limpeza própria.
  - `_send_video` — choke point de `/api/video-cut` E `/api/remotion-render`:
    `_keep` (`X-Clip-Path`) + `finish_video`. Falhar ao guardar/normalizar **nunca**
    derruba o download; o motivo vai ao console.
- **`parse_json3` NÃO se toca.** O `candidates()` mede a pausa entre falas naquela
  grade para decidir onde o corte fecha; mexer ali muda a recomendação. Provas
  comportamentais: `test_ytclip` 17m, 18i, 19k.
- **`worker.REFRAMES` é a fonte; `serve.PROFILES` DERIVA dele.** Duas listas à mão
  divergem. `crop` mantém ramo dedicado — o segmento genérico o quebra (medido:
  1080x1918, e encode falhando em fonte 720p).

## A FONTE é o vídeo INTEIRO (decisão do usuário, 2026-09-15)
`/api/yt-import` baixa o original completo (`ytclip.fetch_full`) numa **thread**, e
`/api/yt-import-state` é o que a barra consulta — 2 GB não cabem numa requisição HTTP sem o
navegador desistir no meio. `/sources/` serve o arquivo ao player do site **com Range** (206),
que é o que permite arrastar a barra na duração inteira. Todo corte sai daí: o
`/api/video-cut` já recortava sub-intervalo de fonte em cache (é o caminho do trecho cru e do
9:16 FFmpeg), e o `/api/remotion-render` ganhou `start`/`end`.

- **`_download_args` é o dono único das flags dos DOIS downloads** (trecho e vídeo inteiro).
  Duas listas à mão divergiriam e o MESMO vídeo entraria com codec ou resolução diferente
  dependendo da rota, calado. `fetch_full` = `fetch_section` menos `--download-sections` e
  `--force-keyframes-at-cuts` — e é a ausência delas que elimina o encode das pontas.
- **A importação NÃO pega o `_render_slot`.** Ela não recodifica nada (só remuxa), o gargalo
  é a rede, e segurar a fila por vinte minutos de download deixaria o operador sem poder
  exportar durante todo esse tempo — pior que a briga que a trava evita. Quem pega a trava é
  o `_cut_for_render`, que é FFmpeg de verdade (o check 29i conta **quatro** `_render_slot`).
- **O sidecar é a economia central.** `write_source_sidecar` grava `<id>.mostreplayed.json` no
  formato do BAIXADOR (`baixador/local-helper/yt_dlp_runner.py` é o dono do formato), na
  MESMA pasta (`_sidecar_dir`). Com isso a fonte importada herda de graça a legenda
  (`cut_captions`, `/api/clip-captions`), o fundo por miniatura (`cut_background`) e o
  gráfico de audiência — **nenhuma rota nova para nenhum dos três**. Divergir do formato não
  dá erro: faz o `_sidecar_captions` degradar calado para "sem legenda". O check 32f prova o
  round-trip pelo leitor real.
- **`source_media_on_disk` exige mídia E sidecar.** Meia fonte é fonte ausente: sem sidecar
  não há legenda nem miniatura, e tratá-la como pronta faria TODO corte sair sem legenda,
  calado (checks 32h/32i).
- **`clip_args` põe `-ss` ANTES do `-i`.** Não é estilo: depois do `-i` o FFmpeg decodifica
  desde o começo, e num podcast de 3 h um trecho em 2:30:00 custaria duas horas e meia de
  decode por exportação. Antes do `-i` COM recodificação o corte ainda cai no quadro exato —
  mesmo arranjo do `horizontal_args` e do `worker.render_cut` (check 32c).
- **O nome do props/dest do Remotion leva sufixo aleatório.** Desde que a fonte passou a ser
  o vídeo inteiro o token é o MESMO para todos os cortes dele, e dois "Baixar vídeo editado"
  do mesmo vídeo escreviam em `props-<token>.json`: o segundo sobrescrevia o primeiro ANTES
  da trava, e o primeiro renderizava o trecho do segundo. Mesma família do sufixo do `.ass`.
- **A miniatura é COPIADA ao lado do recorte** no `_cut_for_render`: o `render_background` a
  descobre pelo STEM do arquivo que o Remotion recebe, e sem a cópia todo vídeo editado de
  fonte importada cairia no letterbox — com o estado dizendo "não havia miniatura", verdade
  sobre o recorte e mentira sobre o vídeo.
- **`IMPORT_STATES`/`IMPORT_STAGES`** entram nos conjuntos FECHADOS: cada valor precisa de
  frase no `video-ops.js` (os checks 32a/32b LEEM o JS, como 21t0 e 30d).

## Segurança e direitos (inviolável)
- **Nunca** `--exec`, `--netrc-cmd`, cookies de navegador nem `aria2c`. Sempre
  `--ignore-config`. A URL entregue ao processo é **reconstruída do id validado**,
  nunca a string colada. `player_client=web_embedded,tv,web` (fixado — ver armadilha 403).
  Vale para a importação do mesmo jeito, e os checks 24l/24m capturam o argv REAL do
  `fetch_full` — não o texto do arquivo, que CITA as flags proibidas ao explicar a proibição
  (`in arquivo` só prova que alguém escreveu a palavra).
- **Analisar** (metadados/legenda) é livre; **baixar mídia** passa pelo portão
  `ytFetchGate`, conferido DUAS vezes (antes de chamar e na volta). **Nunca remover o portão.**
  Agora é a IMPORTAÇÃO que ele guarda — é ela que baixa. O portão fica no navegador, como no
  `/api/yt-fetch`; o servidor cuida do portão TÉCNICO (espaço em disco, id válido).
- Guarda de travessia em todo caminho vindo de sidecar/token + lista fechada de extensão.
  **`/sources/` segue a mesma regra do `/clips/`**: `basename` mata travessia e o guarda de
  componente com ponto do `send_head` roda antes (check 31l).

## Conjuntos FECHADOS (valor livre nesse trajeto quebra os dois lados)
`serve.CAPTION_STATES` · `worker.AUDIO_STATES` · `serve.BACKGROUND_STATES` ·
`worker.REFRAMES` · `TITLE_CARD_STYLES`.
Todo valor que sai num cabeçalho HTTP precisa de frase correspondente no
`video-ops.js` — `test_serve` 21t0/21t1/28o2/**30d** LEEM o JS e reprovam quem esquecer.
`CAPTIONS_TOO_MANY` fica **FORA** de `CAPTION_STATES` (é resposta de rota, não
desfecho de render). Pares como `NOT_AVAILABLE` × `EXTRACTION_FAILED`,
`AUDIO_SEM_FAIXA` × `AUDIO_NORM_FAILED` e **`BACKGROUND_NONE` × `BACKGROUND_UNREADABLE`**
**nunca** colapsam num erro genérico.

**Cabeçalho SEMPRE × CONDICIONAL.** `X-Clip-Audio` sai sempre (as duas rotas
normalizam, então ausência significaria "ninguém tentou"). `X-Clip-Captions` e
`X-Clip-Background` são **condicionais**: no perfil `horizontal` não há legenda
queimada nem tarja para a miniatura preencher, e emitir estado ali seria inventar —
ausência = "esta rota não tem o que dizer". Checks 18p/30e.

## Guardas que já custaram um bug
- **`if override is not None`**, nunca `if override:` — lista vazia é o gesto de
  "não quero legenda" (estado `CAPTIONS_EDITED_EMPTY`).
- **`ancoraBanda`/altura 0 é resposta legítima**; nunca `Number(v) || padrão`.
- **Nome do `.ass` leva sufixo aleatório** — o token é da SESSÃO, não do corte.
  **Não** trocar por "gravar dentro do `render_lock`": o lock é declaradamente removível.
- **`caption_edits.pop`** — a correção é consumida no uso.
- **`-bsf:v h264_metadata` só com `videoCodec == "h264"`**; sem a guarda o passe
  inteiro morre e o clipe sai **sem normalizar o áudio** (audível).
- **`round(OUT_W * alto / largo)`**, nunca `round(OUT_W / (largo/alto))` — 1px de
  deriva calada entre props e filtro. A altura sai PAR (yuv420p exige).
- **`background_ok()`** filtra miniatura ilegível ANTES do render/filtro; falhar
  volta ao fallback e **não** derruba o corte. Desde 2026-09-04 o motivo não vai
  mais só ao console: sai no `X-Clip-Background` e vira frase na tela. Ela responde
  pergunta BOOLEANA e é chamada de dois lugares — quem decide o ESTADO é quem
  escolhe o fundo (`render_background` no Remotion, o ramo do `cut_background` no
  FFmpeg), nunca ela.
- **Escurecer é MULTIPLICATIVO** (`THUMB_LUZ`), nunca `eq=brightness`.

## Cor e áudio
- `-color_primaries`/`-color_trc` como flag de ENCODER são **IGNORADOS** por este
  FFmpeg. Quem recodifica recebe a tag pelo `worker.COR_TAGS` (`setparams` no fim
  do filtro); quem COPIA recebe pelo `worker.COR_BSF` (`-bsf:v h264_metadata`).
- `worker.finish_video` = passe único: `loudnorm I=-14:TP=-1.5:LRA=11` + tag de cor.
  Os DOIS estados de sucesso produzem arquivo (`serve._finish_video` não filtra por `AUDIO_OK`).
- Alvo de saída: `yuv420p` · `tv` · `bt709` (as três coincidindo, o FFmpeg imprime
  `bt709` uma vez só — essa é a assinatura de sucesso).

## Fonte
`video-worker/fonts/Inter-Bold.ttf` viaja no repo (SIL OFL). `worker._place_font`
copia para AO LADO do `.ass` e o filtro usa **`fontsdir=.`** — caminho absoluto do
Windows exigiria escapar `\` e `:` dentro do `filter_complex`. Arquivo ausente
**não levanta** (é o estado `burned-sem-inter`); falha de CÓPIA levanta.
**O libass NÃO falha quando não acha a fonte — ele troca calado para Arial.**

## Prazos (botões de calibragem)
`RENDER_SEC_PER_CLIP_SEC` (guarda o DOBRO do medido) · `DEFAULT_RENDER_TIMEOUT` é
**piso**, não teto · `RENDER_LOCK_WAIT` = 300 s → `_render_slot()` levanta
`WorkerError("render_busy")` → **503** (nunca 409: o navegador responde a 409
reenviando o arquivo inteiro). O `finally` solta o lock em QUALQUER saída.
**Nunca voltar ao `with` cru** — check 29i.

## Ao escrever teste aqui
- **Asserir texto do arquivo não prova fiação nem polaridade.** Construa o valor e
  CHAME a função. `in arquivo` só prova que alguém escreveu a palavra.
- Sabote numa **CÓPIA em temporário**, nunca na árvore de trabalho. Só copiar
  `video-worker/` **não roda**: as suítes resolvem tudo por `worker.REPO` (derivado de
  `__file__`). Ao lado da cópia precisa de
  `video-apresentacao/_tools/imageio_ffmpeg/binaries/ffmpeg-*.exe`, `video-ops.js` (o
  `test_serve` LÊ o JS), e `studio/` e `assets/`. **Hardlink (`ln`) ou junção
  (`cmd /c mklink /J`) só no que a sabotagem NÃO escreve** — o `ffmpeg.exe` (87 MB, +0
  bytes assim) e as duas pastas. Quem é ALVO de sabotagem vai como `cp` de verdade:
  hardlink em `video-ops.js` faz a sabotagem editar o arquivo do REPO. Confira com
  `stat -c %h` (1 = cópia independente). E **desfaça a junção com `cmd /c rmdir` ANTES de
  apagar o temporário** — remoção recursiva sobre junção apaga o ALVO, isto é, o repositório.
- Suíte reprovando "sem motivo": confira `__pycache__/*.pyc` obsoleto e
  `Get-Process chrome-headless-shell` (órfãos comendo RAM → `0xC0000142`).
- Contagem de quadros: `findall(...)[-1]`, não `search` (pega linha de progresso).
- Still com filtro `ass`: use `-copyts` (`-ss` antes do `-i` zera o relógio e o
  quadro sai sem legenda).

## Validação
`.\provas.ps1` — comando ÚNICO das dez suítes. Ele soma e **compara com a linha
`Checks:` do `CLAUDE.md`**, saindo com erro se divergir.
