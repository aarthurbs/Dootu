---
paths:
  - "video-worker/**"
  - "provas.ps1"
  - "estudio.ps1"
description: Regras ativas do renderizador Python do Estúdio (FFmpeg/ASS, yt-dlp, rotas).
---

# Estúdio de Vídeos — `video-worker/` (regras ATIVAS)

Histórico, medições e armadilhas completas: `docs/archive/HISTORICO-estudio-video.md`
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

## Segurança e direitos (inviolável)
- **Nunca** `--exec`, `--netrc-cmd`, cookies de navegador nem `aria2c`. Sempre
  `--ignore-config`. A URL entregue ao processo é **reconstruída do id validado**,
  nunca a string colada. `player_client=web_embedded,tv,web` (fixado — ver armadilha 403).
- **Analisar** (metadados/legenda) é livre; **baixar mídia** passa pelo portão
  `ytFetchGate`, conferido DUAS vezes (antes de chamar e na volta). **Nunca remover o portão.**
- Guarda de travessia em todo caminho vindo de sidecar/token + lista fechada de extensão.

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
`.\provas.ps1` — comando ÚNICO das oito suítes. Ele soma e **compara com a linha
`Checks:` do `CLAUDE.md`**, saindo com erro se divergir.
