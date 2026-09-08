# PLANO — qualidade do clip 9:16 para postar no TikTok

**Data:** 2026-09-03
**Decisão do usuário:** os clips que saem do Estúdio não estão com qualidade boa o suficiente para postar.
**Escopo aprovado:** seis frentes numa entrega só.

---

## 1. O que foi MEDIDO (não deduzido)

### 1.1 O arquivo entregue

`~/Videos/Cortes Estudio/bNkQaTQ4SE0-66-140-editado.mp4` — 74,048 s, 39.379.452 bytes, caminho **Remotion**:

| | valor | veredito |
|---|---|---|
| Resolução / fps | 1080x1920 · 30/1 | ok |
| Vídeo | 3.930.649 bps (3,93 Mbps) | **baixo** — TikTok/Reels pedem ~8-10 para 1080x1920 |
| Container | 4.254.478 bps | |
| `pix_fmt` | **`yuvj420p`** | **errado** — faixa cheia, herdado de quadro JPEG |
| `color_range` | **`pc`** (cheia) | **errado** — HD é faixa limitada (`tv`) |
| `color_space` | **`bt470bg`** (BT.601 / PAL SD) | **errado** — deveria ser `bt709` |
| `color_transfer` / `color_primaries` | `unknown` / `unknown` | o transcodificador do TikTok chuta |
| Áudio | aac 48 kHz · 2 ch · 317.375 bps | ok |
| Loudness integrado | **-21,0 LUFS** (LRA 3,9 LU) | **~7 dB abaixo** do feed |

Conferido num segundo clip (`bNkQaTQ4SE0-226-315-editado.mp4`, 89,045 s): 3.064.097 bps e **os mesmos três tags errados**. Não é caso isolado.

### 1.2 A causa dos tags errados está no comando

`serve.py:1045` chama `npx remotion render` com **apenas** `--props`, `--public-dir` e `--log=error`. Não existe `studio/remotion.config.*`. Logo valem todos os defaults do Remotion 4.0.513:

- `--image-format=jpeg` com `--jpeg-quality=80` → **todo quadro passa por um JPEG 80 antes do H.264**
- CRF 18

JPEG usa matriz BT.601 em faixa cheia. É exatamente daí que saem `yuvj420p`, `color_range=pc` e `color_space=bt470bg`. O conteúdo, porém, foi desenhado num Chrome em sRGB/BT.709 — há um descasamento de matriz assado no arquivo. Quando o TikTok reencoda assumindo BT.709 limitado (o que quase tudo faz em HD), o resultado é deslocamento de cor e preto lavado.

### 1.3 O caminho FFmpeg tem outros problemas

- `worker.py:443` — `libx264 -preset veryfast -crf 20`. O `veryfast` sacrifica bastante qualidade por bit.
- `worker.py:436-442` — se houver QSV, usa **`h264_qsv -global_quality 22`**. Esta máquina (i5, Optiplex 3070) tem QSV, então os downloads do Passo 3 saíram com encode de hardware, mais fraco que x264.
- `worker.py:505` — `-pix_fmt yuv420p -profile:v high -level 4.0`, **sem nenhuma tag de cor**.
- `serve.py:222` — o normalize horizontal roda a `-preset veryfast -crf 20`.
- `video-ops.js:1547` — **terceira cópia** dos parâmetros de encode, no comando manual de emergência.

### 1.4 O que mata de verdade só apareceu OLHANDO o quadro

Quadro extraído em t=40 s do clip acima:

- O vídeo real ocupa **608 de 1920 px — 32% da altura**. O rosto fica pequeno no telefone.
- As duas tarjas mostram **a miniatura inteira, nítida, com a manchete dela legível — duas vezes**. Não lê como moldura: lê como erro de montagem, três imagens empilhadas, duas com título próprio competindo com a legenda e com o card.

A decisão de 2026-08-26 (miniatura em vez de desfoque, "moldura desfocada é enfeite") está se pagando ao contrário: **miniatura nítida com texto não é moldura, é conteúdo concorrente.**

### 1.5 Estado da tela hoje

- **Não existe seletor de enquadramento.** `video-ops.js:2576` baixa com `'blur'` cravado; o comentário em `:2551` diz "Sem escolher perfil".
- `crop` existe em `worker.REFRAMES`, em `serve.PROFILES` e em `FFMPEG_FILTERS`, mas só é alcançável pelo comando manual (`video-ops.js:1822`).
- `render_props` chama **`video_box("blur", media)` duas vezes** com o rótulo cravado — uma para `legendaBase`, uma para `bandaAltura`.

---

## 2. Decisões

| Frente | Decisão |
|---|---|
| Enquadramento | Seletor por trecho: **Inteiro / 1:1 / 4:5** |
| Tarja | Desfoque na miniatura **+** `fundoLuz`/`THUMB_LUZ` de 0,42 → **0,18** |
| Perda de quadro | **`--jpeg-quality=100` + `--color-space=bt709`** primeiro; medir; PNG só se o banding sobreviver |
| Cor | Tags BT.709 faixa limitada nos dois renderizadores |
| Compressão | `-preset slow` no 9:16; QSV só no `horizontal` |
| Áudio | `loudnorm I=-14:TP=-1.5:LRA=11`, ponto único no `_send_video` |
| Fonte | Guarda de altura mínima, com estado visível (BP-008) |

---

## 3. Desenho

### 3.1 O enquadramento é UM campo de conjunto FECHADO

`worker.REFRAMES` passa a ser `("blur", "crop", "crop11", "crop45")` e **`serve.PROFILES` deriva dele** (`REFRAMES + ("horizontal",)`). Duas listas mantidas à mão divergiriam e o mesmo valor passaria a valer num lado e não no outro.

Rótulo na tela → chave: `Inteiro`→`blur` · `1:1`→`crop11` · `4:5`→`crop45`. **O rótulo nunca é a chave.** Validador em cada camada (`serve.reframe_profile`, o espelho JS, `worker`), mesmo padrão do `titleCardStyle`. **Ausente ou desconhecido cai em `blur`** — todo trecho já salvo tem de sair exatamente como sai hoje.

Descartado: um campo ortogonal (`cropAspect`) ao lado do perfil. Dois campos que podem discordar exigem decidir quem manda — a mesma razão pela qual o `titleCardOff: true` foi recusado em favor de `'nenhum'` dentro do conjunto.

### 3.2 A geometria: uma tabela e três contas que já existem

| Perfil | Recorte | Altura do vídeo | Tarja (cada) | Corta da largura | `margem_inferior(1920, h)` |
|---|---|---|---|---|---|
| `blur` | fonte inteira | 608 | 656 | 0% | **705** |
| `crop11` | 1:1 | 1080 | 420 | **43,75%** | **506** |
| `crop45` | 4:5 | 1350 | 285 | **55%** | **393** |
| `crop` (interno) | 9:16 | 1920 | 0 | 68,4% | **269** |

**O recorte é pago em reamostragem, e isso muda qual perfil preferir.** Cortar a fonte reduz a região aproveitada, que depois é esticada até 1080 de largura. De uma fonte 1920x1080 real:

| Perfil | Região usada da fonte | Escala aplicada |
|---|---|---|
| `blur` | 1920x1080 | **0,56×** (redução — o mais nítido) |
| `crop11` | 1080x1080 | **1,00×** — *nativo, sem reamostragem* |
| `crop45` | 864x1080 | **1,25×** (ampliação leve) |
| `crop` (interno) | 607x1080 | **1,78×** (ampliação visível) |

Ou seja **o 1:1 é pixel a pixel a partir de um 1080p** — ele mais que dobra a altura do vídeo sem custar um único pixel interpolado. O 4:5 cobra 1,25× por mais 270 px de altura. Isso reforça o 1:1 como o passo natural do meio, e não só como "o suave".

De uma fonte 1280x720 a conta piora: `crop11` vira **1,50×** e `crop45` vira **1,88×** — é por isso que a guarda de fonte (§3.7) importa mais nos perfis de recorte que no `blur`.

**`band_height` e `margem_inferior` não mudam uma linha.** Já recebem a altura do vídeo e já tratam "enche o quadro". É o dividendo do dono único.

Conferido à mão: nos três perfis expostos o teto `ZONA_UI_PCT` (1651,2) **não dispara** — as bases do texto caem em 1215,4 / 1413,6 / 1527. Ou seja **a legenda sobe junto com o vídeo e nunca encosta na faixa de botões do TikTok**. Só o `crop` de quadro cheio precisa do teto.

**`video_box` passa a ser dono único da altura em TODOS os perfis**, e quem precisa da altura a recebe em vez de recalcular:

- `serve.render_props` faz **UMA** chamada e dela saem **três** props: `legendaBase`, `bandaAltura` e o novo `videoAltura`. Isso resolve de raiz o rótulo cravado duas vezes.
- `worker.build_filter` recebe a altura e escreve `scale=1080:<altura>` — **nunca `scale=1080:-2`**, que arredondaria para par por conta própria e poderia divergir do número dos props por 1 px, calado.

### 3.3 Os dois renderizadores, um segmento de filtro novo

O achado estrutural: **`crop11` e `crop45` são o `blur` com a fonte pré-recortada**, não variantes do `crop`. Eles têm tarja; o `crop` não tem. Então:

- **FFmpeg:** um segmento novo é *prependido* a `[0:v]` — `crop='min(iw,ih*A)':'min(ih,iw/A)'` — e toda a cadeia `blur` que já existe é reaproveitada com a tarja certa. O `min` é o que impede fonte já vertical de estourar o recorte. **Um ponto de inserção, não quatro** (os três ramos de fundo e o chapado continuam como estão).
- **Remotion:** o `Palco` recebe um contêiner de `1080 × videoAltura` com `overflow: hidden` e o `<Video>` em `objectFit: cover`. **`videoEscala` fica 1.0 e `videoCentroPct` fica 0.50** — os checks 1d e 6a continuam valendo, porque isto é recorte da FONTE, não ampliação. Não é o zoom de 1,45× removido em 2026-08-26.

Paridade aritmética: `cover` num 1080×1350 com fonte 16:9 escala para 2400 de largura e corta 660 de cada lado → mantém 1080/2400 = 45%, que é exatamente o 55% cortado do FFmpeg.

### 3.4 A tarja para de repetir a manchete

`fundoLuz`/`THUMB_LUZ` 0,42 → **0,18**, mais desfoque na miniatura (`blur(28px)` no `Img`, `gblur` no filtro).

**Isto NÃO reintroduz o desfoque removido em 2026-08-27.** Aquele borrava a *tira central do vídeo* (`scale=108:192:increase,crop`), e a armadilha era o topo virar teto escuro e a base virar mesa iluminada. Este borra a **miniatura**, que é uma imagem só e cujo texto legível é o defeito. O escurecimento continua **multiplicativo** (`THUMB_LUZ`), nunca `eq=brightness` — a armadilha de 2026-08-26 segue valendo.

### 3.5 Cor e compressão

**Remotion:** `--color-space=bt709` e `--jpeg-quality=100`. O `colorSpace` com `"bt709"` existe no 4.0.513 (confirmado em `node_modules/@remotion/renderer/dist/options/color-space.js`). **O primeiro passo do plano é verificar o que a flag realmente emite** — se ela já tagueia BT.709 em faixa limitada, o PNG passa a ser só sobre a perda geracional do JPEG. CRF fica em 18 na primeira medição; desce a 16 só se o bitrate entregue ficar abaixo de ~8 Mbps.

**FFmpeg:** `-preset veryfast` → `-preset slow` no 9:16; tags `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`; **QSV restrito ao `horizontal`** — o 9:16 é o arquivo que vai ao ar e `global_quality 22` entrega menos por bit.

**A terceira cópia** (`ffmpegCutCommand`, `video-ops.js:1547`) acompanha, senão o comando manual passa a mentir — o `CLAUDE.md` já registra que ele tem de casar com o `build_filter`.

### 3.6 Áudio a -14 LUFS

`loudnorm=I=-14:TP=-1.5:LRA=11` num passe `-c:v copy -c:a aac -b:a 192k`, dentro do **`_send_video`, antes do `_keep`**. É o choke point das duas rotas (`/api/video-cut` e `/api/remotion-render`), então nenhuma pode esquecer — mesma razão pela qual o `_keep` mora lá.

Falha **não** derruba o download: entrega o original. Mas não pode ser calada — ganha `X-Clip-Audio` com **conjunto fechado**, seguindo o `CAPTION_STATES` letra por letra, incluindo uma frase por estado no `video-ops.js` e o check que **lê o JS** e reprova estado sem frase. O conjunto:

| Estado | Significado |
|---|---|
| `normalizado` | o passe rodou e o clip saiu no alvo |
| `AUDIO_SEM_FAIXA` | o corte não tem áudio — nada a normalizar, e dizer isso não é erro |
| `AUDIO_NORM_FAILED` | o passe falhou; o vídeo entregue é o original, sem normalizar |

Cabeçalho ausente = a rota não tentou (o que não deve acontecer nas duas rotas de 9:16, e por isso o check cobra as duas).

### 3.7 Guarda de fonte

O seletor do yt-dlp pede `height<=1080` com avc1 primeiro, mas o último ramo (`b`) aceita qualquer altura. Se o stream baixado vier abaixo do necessário, dizer na tela — renderizar upscale mole calado é o BP-008.

**O limiar sai da tabela de reamostragem do §3.2, não de um número escolhido:** o aviso dispara quando a escala aplicada passa de **1,30×**, que é o ponto em que o `crop45` sai de 1,25× (aceito) para ampliação que aparece. Em números: fonte com altura < 1080 aciona o aviso nos perfis de recorte; o `blur` só reclama abaixo de ~608 de altura, porque ele reduz em vez de ampliar. **O aviso não bloqueia o render** — ele informa que aquele trecho vai sair mole naquele enquadramento, e a escolha continua do operador.

### 3.8 A tela

Radio no cartão do trecho, irmão do `Card visual`, com os mesmos motivos: `:checked` desenha o selecionado, o browser dá navegação por seta de graça, `name` leva o id do trecho, e não re-renderiza (BP-001).

**Carrega a armadilha medida em 2026-09-02:** `position: relative` no fieldset + `top: 0; left: 0` no radio. Sem isso o radio escapa do contexto de scroll, o foco rola o `.layout` que tem `overflow-y: hidden`, e a tela fica numa faixa de ~200 px sem barra e sem volta. Medido na época: `scrollTop` de 0 para 1696.

**Prévia do recorte:** duas máscaras CSS sobre a prévia de vídeo que o cartão já tem — sem render novo e sem requisição. *A verificar no plano:* se o cartão de trecho realmente tem `<video>` antes do download; se não tiver, o seletor mostra as porcentagens e a prévia só aparece depois do "Baixar trecho".

---

## 4. Fora deste pedido, de propósito

- Rastreamento de falante — o recorte é **centrado**, sem tracking.
- Legenda: posição, tempo, karaokê, revisão, ênfase — nada tocado.
- Detecção e recomendação de cortes (`candidates()`), portão de direitos, fundo por miniatura como mecanismo, card do título — nada tocado.
- Quadro PNG no Remotion — só se a medição do `--jpeg-quality=100` pedir.
- O caminho da nuvem (`cloud/`).

---

## 5. Provas

- **Paridade `video_box` ↔ `Clip.jsx` por função exportada chamada com valor construído**, nunca regex sobre o texto do arquivo. A lição de 2026-08-26 e 2026-08-27 já custou três sabotagens passando com a suíte verde; `ancoraLegenda` e `render_props` existem por isso.
- **Fiação `serve → worker` interceptando `render_cut`** — provar que alguém *pede* o recorte, não só que o `build_filter` sabe fazer (a lição do check 20q).
- **As três alturas e as três âncoras por aritmética**, com polaridade: perfil trocado tem de reprovar.
- **Estado de áudio em conjunto fechado**, com o check que lê o `video-ops.js`.
- **Verificação visual nos DOIS renderizadores, nas três proporções** — fonte sintética `testsrc2` (bordas nítidas, dá para ver onde acaba o vídeo). Lembrar da armadilha do próprio teste: `-ss` **antes** do `-i` zera o relógio e o filtro `ass` sai sem legenda; usar `-copyts`.
- **`ffprobe` do entregue** conferindo `bt709` / `color_range=tv` / bitrate / LUFS. É a medição que abriu este plano e é ela que o fecha.

---

## 6. Riscos e itens abertos

1. **Teto de render.** `--jpeg-quality=100` custa pouco (era a razão de escolhê-lo antes do PNG), mas se a medição levar ao PNG, o `RENDER_SEC_PER_CLIP_SEC` sobe junto — senão volta a armadilha de 2026-08-26, com clipe longo morrendo no meio e a tela mostrando erro depois de 15 minutos.
2. **1:1 e 4:5 cortam convidado em plano aberto** (44% e 55% da largura). É por isso que virou escolha do operador com prévia, e não padrão.
3. **A fonte baixada não foi medida** — o cache estava limpo. O número real sai no primeiro download depois da guarda.
4. **A suspeitar, não medido:** se algum caminho 9:16 consome um intermediário já recodificado (`serve.py:222` roda a `-crf 20 -preset veryfast`), há dupla compressão escondida. **Primeira coisa que o plano verifica.**
5. **`render_lock` único** segurando as três rotas com `with` bloqueante e sem timeout — já registrado como sabido e não consertado; `-preset slow` aumenta o tempo dentro do lock.
6. **Constituição não consultada.** `C:\Usee Brasil\Obsidian\Geral Usee` não existe nesta máquina; o usuário autorizou seguir sem ela em 2026-09-03.
