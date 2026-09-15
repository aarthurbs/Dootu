# PLANO 1 — as 4 tags de cor no caminho Remotion

> **Estado (conferido em 2026-09-14): ENTREGUE em 2026-09-04.** Não é trabalho ativo.
> Prova no código, não na palavra: `worker.COR_BSF` (`worker.py:127`), a guarda
> `videoCodec == "h264"` (`worker.py:637`), `worker.finish_video` (`worker.py:609`) e
> `serve._finish_video` (`serve.py:1660`) existem; os checks `16n`–`16x` de
> `test_worker.py` cobrem P1, P2, P3, P4, P6, P7 e P8 rodando `ffprobe` em arquivo real.
> O §0.3 de `../03-Decisions/CONTRATO-qualidade-clip.md` já está marcado "CORRIGIDO".
> Fechamento registrado em `../01-Wiki/archive/HISTORICO-estudio-video.md` (l. 305).

**Ordem recomendada:** este é o **primeiro** dos três. É o menor, o de maior confiança e o
único cuja solução já está **medida funcionando**. Não depende dos Planos 2 e 3.

**Origem:** pendência (a) do relatório de 2026-09-04. Corrige o §0.3 do
`docs/03-Decisions/CONTRATO-qualidade-clip.md`, que já está marcado como errado lá.

---

## 0. Orçamento de contexto — LEIA ISTO ANTES

O trabalho anterior morreu por estouro de gasto depois de ~672k tokens. Este plano é pequeno
**se e somente se** o executor não abrir arquivo inteiro. Regras:

- **UMA sessão, UM plano.** Não use `Workflow`, não abra agentes em paralelo, não delegue
  fatias de implementação. No máximo um `Agent` só-leitura para uma busca pontual.
- **NÃO leia por inteiro:** `CLAUDE.md` (centenas de linhas de bullets densos),
  `video-worker/serve.py` (~1700 linhas), `video-ops.js`, `studio/src/preset.js`,
  `docs/03-Decisions/CONTRATO-qualidade-clip.md`.
- **Leia SÓ estes trechos** — é tudo que o plano toca:

| arquivo | trecho | por quê |
|---|---|---|
| `video-worker/worker.py` | `def normalize_audio` até o `def` seguinte (~45 linhas) | é a função que muda |
| `video-worker/worker.py` | o bloco `AUDIO_OK`/`AUDIO_SEM_FAIXA`/`AUDIO_FAILED`/`AUDIO_STATES` | conjunto fechado |
| `video-worker/serve.py` | `def _normalize_audio` (15 linhas) | único chamador |
| `video-worker/test_worker.py` | ache `normalize_audio` com Grep e leia só o bloco que aparecer | onde os checks entram |

- **Tamanho esperado:** uma sessão curta. Passou de ~200k tokens? Pare no último checkpoint
  verde e reporte — o trabalho fica salvo em disco.

---

## 1. O que está errado (MEDIDO, não deduzido)

O MP4 entregue pelo `POST /api/remotion-render` sai com **3 das 4 tags de cor**:

| tag | caminho FFmpeg | caminho Remotion |
|---|---|---|
| `pix_fmt` | `yuv420p` ✔ | `yuv420p` ✔ |
| `color_range` | `tv` ✔ | `tv` ✔ |
| `color_space` | `bt709` ✔ | `bt709` ✔ |
| `color_transfer` | `bt709` ✔ | **`unknown`** ✘ |
| `color_primaries` | `bt709` ✔ | **`unknown`** ✘ |

**A causa já estava escrita no §0.1 do contrato e ninguém ligou as duas pontas:** este FFmpeg
**IGNORA `-color_primaries`/`-color_trc` como flag de ENCODER**, e é exatamente nessa forma que
o Remotion as emite (`@remotion/renderer/dist/ffmpeg-args.js`). O caminho FFmpeg acerta as
quatro porque nele a tag vem do `setparams` **dentro do filtro** (`worker.COR_TAGS`).

**Gravidade honesta: baixa.** As duas tags que causavam dano visível — faixa cheia (`pc`) e
matriz 601 (`bt470bg`) — já estão consertadas nos dois caminhos. Um HD com matriz `bt709` é
inferido sem ambiguidade por qualquer decodificador. **O que se ganha aqui é a simetria entre
os dois renderizadores**, que neste projeto é o defeito, e o fim de um "sabido e não
consertado". Se o orçamento apertar, este é o mais adiável dos três.

---

## 2. O conserto, já MEDIDO funcionando

```
ffmpeg -i <clip>.mp4 -c copy \
  -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0 \
  <saida>.mp4
```

Medido em 2026-09-04 sobre um render real do Remotion:

- antes: `tv` / `bt709` / **unknown** / **unknown**
- depois: `tv` / `bt709` / **bt709** / **bt709**
- **delta de tamanho: +0 bytes.** Não recodifica — reescreve o VUI do SPS.
- `h264_metadata` **existe** neste FFmpeg (conferido em `ffmpeg -bsfs`).

Os `1` são os enums H.264 para BT.709; `video_full_range_flag=0` é faixa limitada.

### 2.1 Descartado, e por quê

- **`overrideFfmpegCommand`** (via `studio/remotion.config.ts`): o §0.3 do contrato o marca
  como armadilha — o Remotion já emite um `-vf zscale` próprio no modo `bt709`, e acrescentar
  outro `-vf` faz o último vencer e **mata a conversão real de faixa**. Perderíamos algo que
  hoje funciona para ganhar duas tags informativas.
- **`-x264-params colorprim=…`**: funciona (§0.1 do contrato), mas só é alcançável pelo
  `overrideFfmpegCommand` acima. Mesma armadilha.
- **Um segundo passe de FFmpeg só para a tag:** dobra o I/O do arquivo entregue por nada — o
  passe de áudio já existe e já roda com `-c:v copy`.

---

## 3. Desenho

### 3.1 O passe do `_send_video` deixa de ser só de áudio

`worker.normalize_audio` já roda **um** passe com `-c:v copy` no choke point das duas rotas. O
`-bsf:v` entra **nesse mesmo passe**, custo zero.

**Mas há uma armadilha real no ramo sem áudio.** Hoje:

```python
if not info.get("audioCodec"):
    ...
    return AUDIO_SEM_FAIXA          # <- sai SEM produzir `dest`
```

Pôr o `-bsf:v` só no comando existente faria **o clipe sem faixa de áudio nunca receber a
correção de cor**, calado. Corte de podcast sempre tem áudio, mas `/api/video-cut` aceita MP4
local qualquer, então o ramo é alcançável.

**Decisão: a função passa a produzir `dest` nos DOIS ramos**, com um passe só:

- com áudio → `-c:v copy [-bsf:v …] -af LOUDNORM -c:a aac -b:a 192k -ar 48000 -ac 2 …`
- sem áudio → `-c:v copy [-bsf:v …] -an …`

O conjunto de retorno **não muda** (`AUDIO_OK` / `AUDIO_SEM_FAIXA` / `AUDIO_FAILED`): o estado
continua sendo sobre o ÁUDIO, e "não tinha faixa" continua sendo verdade.

### 3.2 Renomear `normalize_audio` → `finish_video`

Uma função chamada `normalize_audio` que também reescreve tag de cor é a mentira que produz o
próximo bug. São **3 pontos** (`worker.py`, `serve.py:_normalize_audio`, `test_worker.py`) —
troque com Grep, não a olho. `AUDIO_STATES` e os três valores **não** são renomeados: continuam
sendo sobre áudio, e mexer neles arrastaria `serve._audio_state`, o cabeçalho `X-Clip-Audio` e a
frase do `video-ops.js`.

### 3.3 A guarda que protege o áudio (obrigatória)

O `-bsf:v h264_metadata` **falha em stream que não é H.264**, e a falha derrubaria o passe
inteiro → `AUDIO_FAILED` → **o clipe sairia sem normalizar o áudio**, que é audível e importa
muito mais que duas tags. Então:

```python
tags = ["-bsf:v", COR_BSF] if info.get("videoCodec") == "h264" else []
```

Não-H.264 perde só a tag, nunca o áudio. **Esta guarda é o coração do plano**; sem ela o
conserto troca um defeito invisível por um audível.

### 3.4 `serve._normalize_audio` aceita o arquivo nos dois ramos

```python
if estado in (worker.AUDIO_OK, worker.AUDIO_SEM_FAIXA) and os.path.exists(destino):
    return estado, destino
```

Sem isto o `remove_quietly` apaga o arquivo do ramo sem áudio e a correção de cor se perde
justamente no ramo que este plano existe para cobrir.

### 3.5 Literal único

Em `worker.py`, ao lado de `COR_TAGS` (que é o do filtro), com o comentário dizendo que os dois
dizem a MESMA coisa em lugares diferentes — filtro para quem recodifica, bitstream para quem
copia:

```python
COR_BSF = ("h264_metadata=colour_primaries=1:transfer_characteristics=1"
           ":matrix_coefficients=1:video_full_range_flag=0")
```

---

## 4. Provas (comportamentais — asserção de texto NÃO vale aqui)

A lição de 2026-08-26 e 2026-08-27: `in arquivo` só prova que alguém escreveu a palavra. Todo
check abaixo **produz um arquivo e roda `ffprobe` nele**.

| # | check | como |
|---|---|---|
| P1 | clipe com áudio sai com as **quatro** tags | corte real → `ffprobe` |
| P2 | clipe **sem** faixa de áudio TAMBÉM sai com as quatro | fonte `-an` → `ffprobe` |
| P3 | e devolve `AUDIO_SEM_FAIXA` (o estado não mudou) | valor de retorno |
| P4 | o áudio continua indo a -14 LUFS | `loudnorm print_format=json` no resultado |
| P5 | **polaridade:** sem `COR_BSF` no comando, P1 reprova | sabotagem em CÓPIA no temporário |
| P6 | vídeo não-H.264 **não derruba o passe**: áudio normalizado, sem a tag | fonte mpeg4/vp9 |
| P7 | o caminho FFmpeg (que já tinha as 4) continua com as 4 | `render_cut` → `ffprobe` |
| P8 | não recodificou: contagem de quadros e `pix_fmt` iguais | `ffprobe` antes/depois |

**P6 é o check que impede o pior desfecho** (perder o `loudnorm` por causa de uma tag). Se ele
não existir, o plano não está feito.

**Sabotagens a exercitar — numa CÓPIA em temporário, NUNCA na árvore de trabalho** (lição de
2026-08-26, quando um revisor sabotou o arquivo real e outro reportou como defeito
"confirmado"). Cada uma tem de reprovar num check nomeado:

1. tirar `COR_BSF` do comando → P1
2. inverter a guarda (`!=` no lugar de `==`) → P6
3. voltar o `return AUDIO_SEM_FAIXA` antecipado → P2
4. deixar o `serve._normalize_audio` só com `AUDIO_OK` → P2

---

## 5. Checkpoints (para sobreviver a uma sessão que morre)

Depois de cada um, **a suíte tem de estar verde**. Sessão que morre retoma do último verde.

- **CP1** — `COR_BSF` declarado + `-bsf:v` no ramo COM áudio + guarda H.264. `.\provas.ps1`
- **CP2** — ramo SEM áudio produz `dest`; `serve._normalize_audio` aceita os dois estados. `.\provas.ps1`
- **CP3** — renomear para `finish_video` (3 pontos). `.\provas.ps1`
- **CP4** — checks P1-P8 escritos em `test_worker.py`. `.\provas.ps1`
- **CP5** — sabotagens 1-4 conferidas em cópia temporária; §0.3 do
  `docs/03-Decisions/CONTRATO-qualidade-clip.md` atualizado (hoje diz "não consertado de propósito");
  `CLAUDE.md` com a contagem nova.

**O `.\provas.ps1` compara o total com a linha `Checks:` do `CLAUDE.md` e falha se divergir** —
atualize a linha no CP5 com o número que ele imprimir. Não some de cabeça.

---

## 6. Fora deste plano, de propósito

- O caminho FFmpeg (já sai com as quatro — é conferido, não tocado).
- `--color-space=bt709`, `--image-format`, `--jpeg-quality`: ficam como estão.
- Bitrate/CRF: já medido e fechado (CRF 18 = 53,1 dB contra o sem-perda).
- `overrideFfmpegCommand` e `studio/remotion.config.ts`: **não crie**.
- `X-Clip-Background` (Plano 2) e dupla compressão (Plano 3).

## 7. Risco

**Baixo, com uma exceção nomeada:** o passe do `_send_video` é o choke point das DUAS rotas de
download. Errar aqui não estraga a cor — estraga **todo download**. Por isso os checkpoints são
pequenos e a suíte roda em cada um, e por isso a guarda do §3.3 e o check P6 não são opcionais.
