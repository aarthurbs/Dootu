# CONTRATO — execução do PLANO-qualidade-clip-tiktok

**Data:** 2026-09-03 · **Executa:** `docs/02-Execution/PLANO-qualidade-clip-tiktok.md`
**Este arquivo é a fonte da verdade da entrega.** O plano diz *o que* e *por quê*; aqui está o
contrato exato — nome, assinatura, valor literal — para que cada arquivo tenha **um escritor só**
e as provas saibam o que cobrar.

---

## 0. O que a medição mudou no plano (antes de codar)

### 0.1 `-color_primaries` e `-color_trc` são IGNORADOS por este FFmpeg — medido

A receita do §3.5 do plano **não funciona como escrita**. Medido nesta máquina
(`ffmpeg-N-125365-g9a01c1cb6a-win64-gpl`), fonte `testsrc2`, mesma cadeia do `build_filter`:

| tentativa | `color_range` | `color_space` | `color_transfer` | `color_primaries` |
|---|---|---|---|---|
| `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv` | tv | bt709 | **unknown** | **unknown** |
| idem + `-profile:v high -level 4.0`, em qualquer ordem | tv | bt709 | **unknown** | **unknown** |
| `setparams=...` no fim da cadeia de filtro | tv | bt709 | **bt709** | **bt709** |
| `-x264-params colorprim=…:transfer=…:colormatrix=…:range=tv` | tv | bt709 | bt709 | bt709 |

**Decisão: `setparams` no fim da cadeia de filtro, e NENHUMA flag de cor no encoder.**
Razões: (a) é o único ponto do 9:16 que já tem dono único (`build_filter`), então a tag não vira
uma quarta cópia de parâmetro de encode; (b) **funciona também no `h264_qsv`** — medido, QSV
existe nesta máquina e respeitou as quatro tags; (c) as duas flags que o build ignora sairiam do
código parecendo que fazem algo.

Literal único, em `worker.py`:
```python
COR_TAGS = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
```

### 0.2 Risco 4 do plano: **SIM, existe dupla compressão** — MEDIDA em 2026-09-08, e é IRRELEVANTE

> **A cadeia descrita abaixo está certa; o veredito de "maior lastro de qualidade" estava
> errado — e o erro foi não ter medido.** Medido agora (`docs/02-Execution/PLANO-3-dupla-compressao.md` §8):
> o ENCODE 1 é `libx264 crf=23.0 preset=medium` e custa **47,46 dB PSNR / 0,9932 SSIM** contra
> o stream copy do mesmo trecho. Praticamente transparente. Baixar o CRF compraria +2,4 dB por
> +78% de arquivo. **Decisão: não mexer** — o parágrafo "Não é consertado aqui" segue valendo,
> mas por ser desnecessário, não por ser risco pendente.

Medido (`ytclip.fetch_section`, ytclip.py:853-878): o comando do yt-dlp usa
`--download-sections` **+ `--force-keyframes-at-cuts`**, e a ajuda do próprio binário diz
*"This is slow due to needing a re-encode"*. Cadeia real do caminho YouTube:

```
stream do YouTube  →  yt-dlp/FFmpeg --force-keyframes-at-cuts   [ENCODE 1]
                   →  <cache>/<id>-<in>-<out>.mp4
                   →  npx remotion render (decode + encode)      [ENCODE 2]
```

O caminho MP4 local (`/api/video-cut`) **não** tem intermediário: recebe o arquivo cru e faz um
encode só. E `serve.py:222` (`horizontal_args`) foi descartado como suspeito: a pasta de clips
nunca é lida como `-i` (grep de `clips_folder` → 132, 731, 775, 778-779, 1215, 1291, 1316,
nenhum é entrada de FFmpeg).

**Não é consertado aqui, de propósito.** Tirar `--force-keyframes-at-cuts` faz o corte começar
no keyframe anterior (até um GOP antes do pedido), o que desloca o conteúdo e **dessincroniza a
legenda**, que é rebaseada no início do corte. Trocar precisão de corte por uma geração de
encode é uma decisão nova, não uma das seis frentes aprovadas. **É o maior lastro de qualidade
que sobra depois desta entrega.**

### 0.3 `--color-space=bt709` do Remotion faz **3 dos 4** tags — CORRIGIDO em 2026-09-04

> **Esta seção estava errada, e o erro foi deduzir do `dist/` em vez de medir o arquivo.**
> Medido agora num render real entregue pelo servidor: saem `pix_fmt=yuv420p`,
> `color_range=tv` e `color_space=bt709`; `color_transfer` e `color_primaries` continuam
> **`unknown`**. A causa já estava escrita no §0.1 logo acima e ninguém ligou as duas pontas:
> **este FFmpeg IGNORA `-color_primaries`/`-color_trc` como flag de ENCODER**, e é essa a
> forma em que o Remotion as emite. O caminho FFmpeg sai com os quatro (medido) porque nele a
> tag vem do `setparams` DENTRO do filtro. **Os dois tags que causavam dano visível — faixa
> cheia e matriz 601 — estão consertados nos dois renderizadores**; os dois que faltam são
> informativos, e um HD com matriz bt709 é inferido sem ambiguidade.
>
> **Lição:** ler o `dist/` prova o que o Remotion MANDA, não o que o FFmpeg OBEDECE.
>
> **CONSERTADO em 2026-09-04 (PLANO 1), e o "não consertado de propósito" que estava escrito
> aqui caiu.** A objeção era o risco: as duas saídas pareciam ser o `overrideFfmpegCommand`
> (armadilha declarada logo abaixo) ou "um `-bsf:v h264_metadata` dentro do passe de áudio —
> arriscar o `loudnorm`, que é audível, por dois tags informativos". **O `-bsf:v` foi o
> caminho, e o risco morreu com uma guarda de uma linha:** o `h264_metadata` só falha em
> stream que não é H.264, então `worker.finish_video` o acrescenta **apenas** quando
> `probe()["videoCodec"] == "h264"`. Não-H.264 perde a tag e **nunca** o áudio — é o check
> `16u` do `test_worker.py`, e sem ele o conserto trocaria um defeito invisível por um
> audível. O passe já rodava com `-c:v copy`, então o `-bsf:v` custa **+0 bytes de vídeo e
> zero I/O novo**: ele reescreve o VUI do SPS, não os pixels (medido: mesma contagem de
> quadros, mesmo pix_fmt — check `16q`).
>
> A função foi renomeada de `normalize_audio` para **`finish_video`** por isso mesmo: uma
> função chamada "normaliza áudio" que também escreve tag de cor é a mentira que produz o
> próximo bug. O conjunto `AUDIO_STATES` **não** mudou — ele é sobre o áudio, sai no
> `X-Clip-Audio` e tem frase do outro lado.
>
> E o ramo **sem faixa de áudio** passou a produzir arquivo também: ele saía com um `return`
> antecipado, e por ali o clipe sem áudio nunca receberia a correção de cor — calado. Corte de
> podcast sempre tem áudio, mas o `/api/video-cut` aceita MP4 local qualquer. O
> `serve._finish_video` aceita os **dois** estados de sucesso pela mesma razão: filtrar por
> `AUDIO_OK` apagaria justamente o arquivo do ramo em que o `-bsf:v` é a única coisa que o
> passe fez (check `28o4` do `test_serve.py`).
>
> Medido no arquivo produzido, via cabeçalho do próprio FFmpeg (este projeto não instala
> ffprobe — CONTRATO_TRABALHADOR §9): `yuv420p(tv, bt709/unknown/unknown, progressive)` →
> `yuv420p(tv, bt709, progressive)`. **O colapso dos três num `bt709` único é a assinatura de
> sucesso** — o FFmpeg só imprime uma vez quando primárias, transferência e matriz coincidem.

O que o `dist/` emite (continua verdade, e é o que faz a faixa e a matriz saírem certas):

`@remotion/renderer/dist/ffmpeg-args.js:56-67` emite, para `bt709`:
```
-colorspace:v bt709  -color_primaries:v bt709  -color_trc:v bt709  -color_range tv
-vf zscale=matrix=709:matrixin=709:range=limited      (quando hasPreencoded === false)
```
Ou seja **não é só tag: há conversão real de faixa**. O default hoje é `'default'` → `[]`,
nenhuma tag e nenhuma conversão — é exatamente o defeito medido no §1.1 do plano.
`overrideFfmpegCommand` **não é necessário** (e é armadilha: o Remotion já emite um `-vf` próprio
no modo bt709; acrescentar outro faz o último vencer e mata o `zscale`).

### 0.4 O cartão de trecho **não tem `<video>`** — §3.8 do plano, item "a verificar"

A prévia é `<iframe class="vop-cand-frame">` do player do YouTube (video-ops.js:1461-1463),
16:9, montada só quando o operador clica em "Prever". **Decisão:** as máscaras de recorte vão
sobre esse iframe (é 16:9, mostra o conteúdo real, custa zero requisição) **e** o rótulo do
radio sempre diz a porcentagem cortada, para o operador saber sem abrir a prévia. Máscara com
`pointer-events: none`, senão o player para de aceitar clique.

### 0.5 "QSV só no horizontal" virou "QSV não é mais usado"

`video_encoder_args()` (worker.py:422) é chamado **só** pelo `render_cut`, ou seja só no 9:16.
O `horizontal_args` (serve.py:211) tem args próprios e **nunca** usou QSV. Então "restringir ao
horizontal" significaria **acrescentar** encode de hardware a um caminho que o plano manda não
tocar. Tiramos o QSV do 9:16 e apagamos o probe, que fica sem chamador (BP-007).

---

## 1. Enquadramento: um campo, um conjunto fechado, uma tabela de proporção

### 1.1 As listas e quem deriva de quem

| onde | nome | valor literal |
|---|---|---|
| `worker.py` | `REFRAMES` | `("blur", "crop", "crop11", "crop45")` |
| `worker.py` | `REFRAME_RATIO` | `{"crop": (16, 9), "crop11": (1, 1), "crop45": (5, 4)}` — `(alto, largo)`; **`blur` ausente = proporção da FONTE** |
| `worker.py` | `REFRAME_PADRAO` | `"blur"` |
| `serve.py` | `PROFILES` | `worker.REFRAMES + ("horizontal",)` — **derivado, nunca à mão** |
| `preset.js` | `REFRAMES` | `['blur', 'crop', 'crop11', 'crop45']` (espelho, literais de propósito — lido por regex) |
| `preset.js` | `REFRAME_PADRAO` | `'blur'` |
| `preset.js` | `REFRAMES_OFERECIDOS` | `['blur', 'crop11', 'crop45']` — **subconjunto**: `crop` é interno |
| `preset.js` | `REFRAME_LABELS` | `{blur:'Inteiro', crop11:'1:1', crop45:'4:5', crop:'9:16'}` |
| `video-ops.js` | as mesmas quatro | espelho, literais, lido por regex |

`crop` continua alcançável só editando a query à mão, como hoje. **O rótulo nunca é a chave.**

### 1.2 Validadores — um por camada, mesmo padrão do `titleCardStyle`

```python
# serve.py
def reframe_profile(valor):      # desconhecido/ausente -> worker.REFRAME_PADRAO
```
```js
// preset.js
export function reframeOf(valor)          // desconhecido/ausente -> REFRAME_PADRAO
// video-ops.js
function reframeOf(obj)                   // le obj.reframe, valida contra REFRAMES
```
`parse_cut_query` continua recusando (HTTP 400) o que não está em `PROFILES` — ela é a fronteira
da rota e recusar é o certo lá. Os validadores acima são para **corpo de POST e estado da tela**,
onde cair no padrão é o certo (trecho salvo antes desta entrega não manda a chave).

### 1.3 `video_box` passa a ser dono único da altura em TODOS os perfis

```python
# serve.py — SUBSTITUI o corpo atual
def video_box(profile, media):
    alto, largo = worker.REFRAME_RATIO.get(profile, (None, None))
    if alto is None:                       # blur: a fonte deita inteira
        largo = media.get("width") if isinstance(media, dict) else None
        alto = media.get("height") if isinstance(media, dict) else None
        if not largo or not alto:
            return None
    altura = min(worker.OUT_H, int(round(worker.OUT_W * float(alto) / float(largo))))
    return altura - (altura % 2)           # H.264/yuv420p exige par, e este numero vai
                                           # ao filtro E aos props: a paridade sai do dono
```

**A forma `round(OUT_W * alto / largo)` é obrigatória** — não troque por
`round(OUT_W / (largo/alto))`. Medido: `1080 * 1080/1920` dá exatamente `607.5` → `608`;
`1080 / (1920/1080)` cai em `607.4999…` → `607`. Um pixel de deriva silenciosa entre props e
filtro sai justamente daí.

Tabela conferida à mão (fonte 16:9) — **estes números são as provas do §5 do plano**:

| perfil | `(alto,largo)` | altura do vídeo | `band_height` | `margem_inferior(1920, h)` | região usada da fonte 1920x1080 | escala |
|---|---|---|---|---|---|---|
| `blur` | fonte | **608** | **656** | **705** | 1920x1080 | 0,56× |
| `crop11` | (1,1) | **1080** | **420** | **506** | 1080x1080 | **1,00× nativo** |
| `crop45` | (5,4) | **1350** | **285** | **393** | 864x1080 | 1,25× |
| `crop` | (16,9) | **1920** | **0** | **269** | 607x1080 | 1,78× |

`ZONA_UI_PCT` (1651,2) só morde no `crop`. `band_height` e `margem_inferior` **não mudam uma
linha** — já recebem a altura.

### 1.4 `render_props`: UMA chamada, TRÊS props

Substitui as duas chamadas com rótulo cravado (`serve.py:343` e `:349`):

```python
reframe = reframe_profile(body.get("reframe"))
altura  = video_box(reframe, media) or int(round(worker.OUT_W * 9 / 16))   # 608
...
"reframe":     reframe,
"videoAltura": altura,
"legendaBase": captions.margem_inferior(worker.OUT_H, altura),
"bandaAltura": worker.band_height(altura),
```
O fallback 608 (16:9) fica: o outro fallback — "o vídeo preenche o quadro" — jogaria a base do
texto para 1651, fora da imagem.

### 1.5 FFmpeg: **um** segmento prependido, e o resto da cadeia intacta

`_reframe_chain` ganha, e só, um segmento na frente de `[0:v]`:

```
[0:v]crop='min(iw,ih*<largo>/<alto>)':'min(ih,iw*<alto>/<largo>)'[src];
```
…e o rótulo da fonte passa a ser `[src]` no lugar de `[0:v]` no resto da cadeia. Para `blur`
(e para `crop`, que já preenche o quadro) **não há segmento nenhum e a cadeia sai byte a byte
como hoje**.

Por que o `min` dos dois lados: garante que a saída tem **exatamente** a proporção pedida, seja a
fonte mais larga ou mais estreita que ela — se `iw/ih > A` sai `ih*A × ih`, se `iw/ih < A` sai
`iw × iw/A`. Nos dois casos a proporção é `A`, e é por isso que a altura do §1.3 é
**determinística** nos perfis de recorte (1080 e 1350), independente da fonte.

**Não é preciso trocar `scale=1080:1920:force_original_aspect_ratio=decrease` por
`scale=1080:<altura>`**, como o plano supôs: com a fonte pré-recortada na proporção exata, o
`decrease` já produz o mesmo número inteiro do `video_box`, por construção (1080x1080 e
1080x1350, sem arredondamento). Menos diff, e o ramo `blur` fica intocado. O que o plano proíbe
— `scale=1080:-2` — continua proibido.

### 1.6 Remotion: `Palco` recorta a FONTE, e o `blur` continua idêntico

```jsx
const Palco = ({ src, reframe, altura }) => {
  const recorta = reframe !== "blur";          // "blur" = a fonte deita inteira, como hoje
  ...
}
```
- `recorta === false` → **exatamente a marcação de hoje** (`width:"100%"`, altura natural,
  `transform: translate(-50%,-50%) scale(TOKENS.videoEscala)`). Byte a byte igual: é o que faz
  todo trecho já salvo sair como sempre saiu.
- `recorta === true` → contêiner `width: TOKENS.largura`, `height: altura`, `overflow:"hidden"`,
  centrado pelos mesmos `videoCentroPct`/`translate`, e `<Video style={{width:"100%",
  height:"100%", objectFit:"cover"}}/>`.

**`videoEscala` fica `1` e `videoCentroPct` fica `0.5`** — os checks `1d` e `6a` continuam
valendo, porque isto é recorte da FONTE, não a ampliação de 1,45× removida em 2026-08-26.
Continua **exatamente uma** tag `<Video>` no arquivo (check `6m`).

Paridade aritmética com o FFmpeg, para o check: `cover` num 1080x1350 com fonte 16:9 escala para
2400 de largura e corta 660 de cada lado → mantém 1080/2400 = 45%, que é o mesmo 55% cortado
pelo `crop` do filtro.

Validador do número: `preset.ancoraVideo(valor)` — finito e `> 0` → `Math.round`, senão
`VIDEO_ALTURA_PADRAO = 608`. **Não copie o `ancoraBanda`**: lá o `0` é resposta legítima (fonte
já vertical não tem tarja); aqui altura `0` é vídeo nenhum.

---

## 2. Tarja: a miniatura para de repetir a manchete

| constante | de | para | onde |
|---|---|---|---|
| `worker.THUMB_LUZ` | `0.42` | **`0.18`** | worker.py:73 |
| `TOKENS.fundoLuz` | `0.42` | **`0.18`** | preset.js |
| `worker.THUMB_DESFOQUE_SIGMA` | — | **`14`** (novo) | worker.py |
| `TOKENS.fundoDesfoque` | — | **`28`** (novo) | preset.js |

**Os dois números são o MESMO desfoque em unidades diferentes, e isso precisa estar escrito:**
o CSS define `blur(<r>)` como uma gaussiana de desvio padrão `r/2`, então `blur(28px)` ≡
`gblur=sigma=14`. O check de paridade cobra `fundoDesfoque === 2 * THUMB_DESFOQUE_SIGMA`, não
igualdade.

- **FFmpeg:** `gblur=sigma=14` entra na cadeia `[1:v]` da miniatura, **depois** do
  `scale=…:increase,crop=1080:<band_h>` e **antes** do `eq`/`colorchannelmixer`. Custa uma vez
  (a miniatura é um quadro só que o `overlay` repete), não por quadro.
- **Remotion:** `filter: "blur(28px) brightness(0.18) saturate(0.55)"` no `<Img>`.
  **Armadilha a verificar OLHANDO o frame:** blur em CSS amostra fora da borda do elemento e
  traz transparência para dentro, o que produz um esmaecido nas bordas do quadro e na fronteira
  com o vídeo. A geometria do `<Img>` tem de ser **inflada** além da tarja (deslocamento
  negativo + tamanho maior, na ordem do raio) para as bordas esmaecidas caírem fora do
  `overflow: hidden`. O FFmpeg não tem esse problema (`gblur` replica a borda).

Isto **não** reintroduz o desfoque removido em 2026-08-27: aquele borrava a *tira central do
vídeo* (`scale=108:192:increase,crop`), cuja armadilha era o topo virar teto escuro e a base
virar mesa iluminada. Este borra a **miniatura**, que é uma imagem só e cujo texto legível é o
defeito. O escurecimento continua **multiplicativo** (`colorchannelmixer`), nunca
`eq=brightness` — a armadilha de 2026-08-26 segue valendo.

---

## 3. Cor e compressão

### 3.1 Remotion — duas flags no comando do `serve.py`

Acrescentar ao `npx remotion render` (hoje só `--props`, `--public-dir`, `--log=error`):
```
--color-space=bt709
--image-format=<jpeg|png, ver 3.3>
```
CRF fica no default do codec (18) na primeira medição.

### 3.2 FFmpeg — `setparams` e `-preset slow`

- `worker.build_filter` termina a cadeia com `,` + `COR_TAGS` (§0.1), **depois** do `ass=`.
  Um ponto, os quatro perfis.
- `worker.video_encoder_args()` → `["-c:v", "libx264", "-preset", "slow", "-crf", "18"]`.
  O probe QSV (`_QSV`, worker.py:419-443) perde o único chamador → **apagar** (BP-007).
- `horizontal_args` **não é tocado** (o plano manda não tocar, e ele não é o arquivo que vai ao ar).
- **A terceira cópia acompanha:** `video-ops.js` `FFMPEG_FILTERS` ganha `crop11`/`crop45` e o
  `ffmpegCutCommand` passa a `-preset slow -crf 18` + as tags de cor. Senão o comando manual de
  emergência mente, e o `CLAUDE.md` já registra que ele tem de casar com o `build_filter`.

### 3.3 A medição que decide JPEG × PNG (§3.5 e risco 1 do plano)

Rodar o MESMO clipe curto três vezes — `--jpeg-quality=80` (o de hoje), `--jpeg-quality=100`,
`--image-format=png` — todas com `--color-space=bt709`, e reportar **tempo de parede**, **bytes**
e **PSNR/SSIM contra o PNG como referência**. Só então escolher. Se o PNG entrar,
`RENDER_SEC_PER_CLIP_SEC` sobe na mesma entrega — senão volta a armadilha de 2026-08-26, com
clipe longo morrendo no meio e a tela mostrando erro depois de 15 minutos.

#### FEITO em 2026-09-04 — **JPEG-100 fica**

Fonte real (podcast 1080p24 já baixado, 12 s), miniatura = quadro real do próprio vídeo.
`testsrc2` foi descartado de propósito: sem pele, grão nem gradiente, ele não responde a
pergunta, que é sobre custo em bits e banding de conteúdo de verdade.

| | JPEG-100 | PNG |
|---|---|---|
| Render (parede) | **87,9 s** (7,3 s/s de clipe) | 140,1 s (11,6 s/s) — **+59%** |
| Vídeo entregue | 1.459.284 bps | 1.387.169 bps |
| Níveis únicos na tarja escura | **36** | 34 |
| Degraus ≥4 níveis na tarja | 0,002% | 0,000% |

**Isolando o formato do H.264** (still PNG × still JPEG-100 da MESMA composição, sem encode
no meio): **PSNR 62,2 dB no luma** — perda geracional invisível (transparência começa perto
de 45 dB); diferença média de 0,35 nível na tarja e 0,59 no vídeo.

**O PNG não reduz banding, que era a única razão de considerá-lo.** O JPEG tem *mais* níveis
(36 × 34), porque o ruído de DCT age como dither e SUAVIZA o contorno. Olhando o recorte da
tarja amplificado 8×, os anéis de quantização são os mesmos nos dois, e os do PNG são se
acaso um pouco mais duros. **O banding que existe é do 8-bit sobre a miniatura escurecida** —
quem quiser matá-lo mexe em dither ou 10-bit, não no formato do quadro.
`RENDER_SEC_PER_CLIP_SEC` **não muda** (segue em 24, e o medido é 7,3).

---

## 4. Áudio a -14 LUFS, ponto único no `_send_video`

```python
# worker.py (novo)
LOUDNORM = "loudnorm=I=-14:TP=-1.5:LRA=11"    # botao de calibragem
AUDIO_OK, AUDIO_SEM_FAIXA, AUDIO_FAILED = "normalizado", "AUDIO_SEM_FAIXA", "AUDIO_NORM_FAILED"
AUDIO_STATES = (AUDIO_OK, AUDIO_SEM_FAIXA, AUDIO_FAILED)

def normalize_audio(src, dest, timeout=None):
    """-14 LUFS com o video em copy. Devolve um dos AUDIO_STATES; NUNCA levanta."""
```
> **Superado pelo PLANO 1 (2026-09-04):** a função virou **`finish_video`** e o mesmo passe
> também grava a tag de cor (`-bsf:v COR_BSF`, sob guarda de H.264 — ver §0.3). Os DOIS ramos
> passaram a escrever `dest`, então o bullet abaixo sobre "`dest` não é escrito" **deixou de
> valer**; o resto desta seção continua igual, inclusive os três estados.

- Sem faixa de áudio → `AUDIO_SEM_FAIXA`, `dest` não é escrito. **`worker.probe` já devolve
  `audioCodec`** — não é preciso processo novo nem parâmetro novo.
- Passe único: `-i src -c:v copy -af <LOUDNORM> -c:a aac -b:a 192k -ar 48000 -ac 2
  -movflags +faststart -f mp4 dest`. `-c:v copy` é o que impede uma segunda geração de vídeo.
- Qualquer falha → `AUDIO_FAILED`, o motivo vai ao **console do servidor**, e o vídeo entregue é
  o original. Falha de normalização não derruba download.

`serve._send_video` (serve.py:1228), **antes do `_keep`**: roda o passe, troca `path` pelo
normalizado quando der certo, e emite `X-Clip-Audio` com o estado — filtrado por
`_audio_state(valor)` (mesmo papel do `_caption_state`: conjunto fechado, impede CRLF no
cabeçalho e estado sem frase do outro lado). É o choke point das duas rotas, então nenhuma pode
esquecer — a mesma razão pela qual o `_keep` mora lá. Cabeçalho **sempre presente**.

`video-ops.js` ganha `AUDIO_MSG` (irmão do `CAPTIONS_MSG`, video-ops.js:1599) com **uma frase por
estado** e `audioMessage(state)`, e **as duas** rotas passam a lê-lo — hoje o caminho Remotion
(`ytRenderClip`, :1836) não lê cabeçalho de estado nenhum, só o `X-Clip-Path`.

| estado | frase (sentido) |
|---|---|
| `normalizado` | o passe rodou e o clip saiu no alvo do feed |
| `AUDIO_SEM_FAIXA` | o corte não tem áudio — nada a normalizar, e dizer isso não é erro |
| `AUDIO_NORM_FAILED` | o passe falhou; o vídeo entregue é o original, sem normalizar |

---

## 5. Guarda de fonte (§3.7)

```python
# serve.py (puro)
ESCALA_MOLE = 1.30
def source_scale(reframe, media):   # 1080 / largura da regiao usada da fonte; None sem dimensao
```
A região usada é a mesma do `crop` do §1.5: `min(w, h*largo/alto)` — e `w` inteiro no `blur`.
O limiar `1,30` sai da tabela do §1.3, não de gosto: é o ponto em que o `crop45` deixa de ser
1,25× (aceito) e passa a ampliação que aparece.

**Onde aparece, sem rota nem cabeçalho novo:** o navegador já recebe `width`/`height` na resposta
do `/api/yt-fetch` (serve.py:998) e, no Passo 3, tem `videoWidth`/`videoHeight` no próprio
`<video>` da sessão. A conta espelhada em JS (`sourceScale`) põe o aviso **ao lado do radio**,
junto da porcentagem cortada. **Não bloqueia o render** — informa que aquele trecho sai mole
naquele enquadramento, e a escolha continua do operador (BP-008).

---

## 6. A tela

### 6.1 O radio, irmão do `Card visual`

Molde exato: `video-ops.js:1446-1456` (HTML), `:2457-2470` (`clipFieldWrite`),
`video-ops.css:676-770` (as 6 regras `.vop-cardstyle*`). Copiar a **estrutura**, não a classe:
`.vop-reframe`, `<legend>Enquadramento</legend>`, `name="reframe-<id do trecho>"`.

**A armadilha de 2026-09-02 viaja com o molde, e é obrigatória:** `position: relative` no
`fieldset` + `top: 0; left: 0` no radio `absolute`. Sem isso o radio escapa do contexto de
scroll, o foco rola o `.layout` (que tem `overflow-y: hidden`) e a tela fica numa faixa de
~200 px sem barra e sem volta — medido na época: `scrollTop` de 0 para 1696. Também
`justify-self: start`, senão o fieldset estica na largura toda do cartão e lê como faixa em vez
de controle.

Não trocar o radio por `display:none`/`visibility:hidden`: tiram o radio da ordem de foco e o
segmentado perde a navegação por seta e o grupo nomeado que o browser dá de graça.

### 6.2 Dois lugares, dois campos, o mesmo conjunto

| tela | campo | handler | vai para |
|---|---|---|---|
| cartão do trecho do YouTube | `clip.reframe` | `clipFieldWrite` (já existe) | `renderBody` → corpo do `/api/remotion-render` |
| linha do corte no Passo 3 | `cut.reframe` | `cutFieldWrite` (já existe) | `&profile=` do `/api/video-cut`, no lugar do `'blur'` cravado de `:2576` |

Nenhum re-render (BP-001): o `:checked` nativo desenha o estado. No cartão do trecho, `clip` e
`project.candidates` são o MESMO objeto, então `projectsPersist()` no clique faz a escolha voltar
com o projeto — como o `titleCardStyle` já faz.

### 6.3 Prévia do recorte

Duas máscaras sobre o `<iframe class="vop-cand-frame">` que já existe (§0.4), só quando o perfil
recorta: faixas de `21.875%` (crop11) e `27.5%` (crop45) de cada lado, `pointer-events: none`.
O rótulo do radio diz a porcentagem em texto, para valer também com a prévia fechada.

### 6.4 Movimento (regras do `emil-design-eng`, que o `.vop-cardstyle` já cumpre)

`transition` com propriedades explícitas (nunca `all`), `< 300ms`, `:active { transform:
scale(.97) }` no rótulo, hover atrás de `@media (hover: hover) and (pointer: fine)`,
`:focus-visible` com `outline`. **A máscara de recorte não anima**: ela é informação, aparece com
a escolha e fica parada.

---

## 7. Provas (o que cada suíte passa a cobrar)

Numeração livre medida: `test_serve.py` → **20r**, **21u**, **24e**, **25i**, **26z7**;
`test_worker.py` → bloco **16** (e `15d` dentro do 15). `test-preset.mjs` é bloco **14**.
`test-video-ops*.js` não numeram: frase em português.

| # | prova | onde | como (obrigatório) |
|---|---|---|---|
| P1 | as três alturas, as três tarjas e as três âncoras | `test_serve.py` | **chamar** `video_box`/`band_height`/`margem_inferior` com valor construído, aritmética explícita. Polaridade: perfil trocado reprova |
| P2 | `PROFILES` é derivado de `REFRAMES` | `test_serve.py` | identidade de conteúdo, não literal repetido |
| P3 | fiação `serve → worker`: alguém **pede** o recorte | `test_serve.py` | interceptar `worker.render_cut` (o espião do `20q` já existe) e conferir o `reframe` que chega |
| P4 | `render_props` entrega `reframe`/`videoAltura`/`legendaBase`/`bandaAltura` coerentes | `test_serve.py` | **chamar** `render_props` com `media` construído; sobreviver ao `json.dumps` |
| P5 | `blur` sai idêntico ao de hoje | `test_worker.py` | `build_filter("blur", …)` sem e com a chave nova → string **igual** |
| P6 | o recorte entra na cadeia, com a proporção certa | `test_worker.py` | `build_filter` real + **render de verdade** com fonte sintética, conferindo `1080x1080`/`1080x1350` na saída |
| P7 | as quatro tags de cor saem no arquivo | `test_worker.py` | render real + `ffprobe`: `bt709` × 3 + `range=tv` |
| P8 | `-preset slow`, sem QSV | `test_worker.py` | `video_encoder_args()` — igualdade da lista |
| P9 | áudio: os três estados, e nenhum levanta | `test_worker.py` | `finish_video` com fonte com áudio, sem áudio e corrompida |
| P10 | `X-Clip-Audio` em **ambas** as rotas, conjunto fechado | `test_serve.py` | servidor de verdade; e o check que **lê o `video-ops.js`** e reprova estado sem frase (molde: `21t0`/`21t1`) |
| P11 | paridade `THUMB_LUZ` ↔ `fundoLuz` e `THUMB_DESFOQUE_SIGMA` ↔ `fundoDesfoque` | `test_serve.py` | lê o `preset.js` (molde: `26a`/`26b`/`26c`) |
| P12 | paridade dos conjuntos de perfil nas três cópias | `test_serve.py` + `test-video-ops.js` | `worker.REFRAMES` ↔ `preset.REFRAMES` ↔ `video-ops.REFRAMES`, e `REFRAMES_OFERECIDOS ⊂ REFRAMES` |
| P13 | `Palco` recorta de verdade e o gate é função pura | `test-preset.mjs` | **chamar** a função exportada com valor construído — nunca regex sobre o texto do `Clip.jsx`. Uma tag `<Video>` (contagem, não `indexOf`) |
| P14 | `ancoraVideo`: `0` não é resposta legítima aqui | `test-preset.mjs` | polaridade contra o `ancoraBanda` |
| P15 | o radio grava, não re-renderiza, e o CSS traz as duas declarações | `test-video-ops-dom.js` + `test-video-ops.js` | clique pela delegação real; o check de CSS **remove comentários antes** — a prosa que explica a armadilha contém o próprio texto `position: relative` |
| P16 | o perfil escolhido chega ao corpo/query | `test-video-ops.js` | **chamar** `renderBody(clip)` com valor construído (a lição do `title: ''`) |
| P17 | `--color-space=bt709` no comando do render | `test_serve.py` | argv construído, não `in serve.py` |
| P18 | verificação visual, DOIS renderizadores × TRÊS proporções | à mão | fonte sintética `testsrc2`. **`-ss` antes do `-i` zera o relógio e o filtro `ass` sai sem legenda** — usar `-copyts` |
| P19 | `ffprobe` do entregue | à mão | `bt709`/`range=tv`/bitrate/LUFS. É a medição que abriu o plano e é ela que o fecha |

**Regra que vale para todas:** ao provar que um valor CHEGA a algum lugar, o teste constrói o
valor e chama a função. `in arquivo` só prova que alguém escreveu a palavra — três sabotagens já
passaram com a suíte verde neste projeto por causa disso (2026-08-26, 2026-08-27, 2026-08-31).

`.\provas.ps1` soma as oito suítes e **compara com a linha `Checks:` do `CLAUDE.md`**, saindo com
erro se divergir. Ele é o comando de prova; rodar suíte à mão arrisca a armadilha do `.pyc`
obsoleto, que ele elimina com `PYTHONPYCACHEPREFIX`.

---

## 8. Fora desta entrega, de propósito

- `--force-keyframes-at-cuts` (§0.2) — medido em 2026-09-08: transparente (47,5 dB). Não era lastro.
- `horizontal_args`: preset, CRF e tags de cor.
- Rastreamento de falante: o recorte é **centrado**, sem tracking.
- Legenda (posição, tempo, karaokê, revisão, ênfase), detecção de cortes, portão de direitos,
  card do título, `cloud/`.
- `render_lock` único sem timeout — já registrado como sabido; `-preset slow` aumenta o tempo
  dentro dele.

---

## 9. Medições do orquestrador (feitas durante a execução, 2026-09-03)

### 9.1 A geometria do §1.5 foi PROVADA com FFmpeg real

`crop='min(iw,ih*<largo>/<alto>)':'min(ih,iw*<alto>/<largo>)'` seguido do
`scale=1080:1920:force_original_aspect_ratio=decrease` que já existe, em quatro fontes
sintéticas (`testsrc2`):

| fonte | `crop11` | `crop45` |
|---|---|---|
| 1920x1080 | **1080x1080** | **1080x1350** |
| 1280x720 | **1080x1080** | **1080x1350** |
| 1080x1080 | **1080x1080** | **1080x1350** |
| 720x1280 (já vertical) | **1080x1080** | **1080x1350** |

Determinístico e igual ao `video_box`, inclusive com fonte já vertical — é o `min` dos dois
lados que faz isso.

### 9.2 Por que o `crop` NÃO pode receber o segmento genérico — medido

Aplicando a MESMA expressão ao perfil `crop` (16,9), a saída dá **1080x1918**, não 1080x1920:
`min(iw, ih*9/16)` num 1920x1080 é `607.5`, o filtro `crop` **trunca para 607**, e a proporção
resultante (0,56204) não é 9:16, então o `decrease` erra a altura por 2 px. `worker.check_output`
exige exatamente 1080x1920 e reprovaria o arquivo. Numa fonte 1280x720 o encode falhou de vez.

**Por isso o `crop` mantém o ramo dedicado que já tem** (`scale=…:increase,crop=1080:1920`), e
`REFRAME_RATIO["crop"]` serve só para `video_box`/`source_scale`, **nunca** para montar o
segmento. Quem "unificar" isso depois reintroduz o defeito.

### 9.3 O passe de áudio do §4, medido no clip real de 74 s

`bNkQaTQ4SE0-66-140-editado.mp4`, passe único `-c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11`:

| | antes | depois |
|---|---|---|
| Loudness integrado | **-21,0 LUFS** | **-14,3 LUFS** |
| LRA | 3,9 LU | 3,1 LU |
| bytes | 39.379.452 | 38.223.541 |
| faixa de vídeo | h264 · yuvj420p · pc · bt470bg · 2220 quadros | **idêntica** |

**Custo: 11 s de parede para 74 s de clipe** (~0,15 s por segundo de clipe) — ruído ao lado dos
~11 s de render por segundo de clipe do Remotion.

Dois fatos que precisam estar escritos: (a) o passe único de `loudnorm` é dinâmico e acerta
dentro de ~0,3 dB (-14,3 e não -14,0); dois passes acertariam exato e custariam o dobro, e a
decisão é ficar no passe único. (b) `-c:v copy` **não conserta as tags de cor** — elas continuam
`pc`/`bt470bg` depois do passe, o que confirma que a cor tem de ser resolvida na ORIGEM (as flags
do Remotion, §3.1), nunca neste passe.

### 9.4 Baseline do arquivo entregue, re-conferida

Idêntica à do §1.1 do plano: `yuvj420p` · `color_range=pc` · `color_space=bt470bg` ·
`color_transfer`/`color_primaries` **unknown** · 3.930.649 bps · 30/1 · -21,0 LUFS. É o "antes"
da prova P19.

### 9.5 P19 fechada — o "depois", medido ponta a ponta em 2026-09-04

Servidor real (`serve.build_server`), cache semeado como o `/api/yt-fetch` faz (trecho +
miniatura ao lado), `POST /api/remotion-render` com o MESMO corpo que o `renderBody` monta.
Fonte: `bNkQaTQ4SE0-415-461.mp4`, 12 s. **O arquivo medido é o que sai da resposta HTTP**, ou
seja depois do passe de áudio do `_send_video` — não o intermediário do render.

| | antes (§9.4) | depois |
|---|---|---|
| `pix_fmt` | `yuvj420p` | **`yuv420p`** |
| `color_range` | `pc` | **`tv`** |
| `color_space` | `bt470bg` | **`bt709`** |
| `color_transfer` / `color_primaries` | unknown | **bt709** *(consertado no PLANO 1 — ver §0.3)* |
| Loudness | -21,0 LUFS | **-14,05 LUFS** · TP **-1,50 dBTP** |
| Vídeo | 3.930.649 bps | 1.459.284 bps |
| Container | 4.254.478 bps | 1.657.797 bps |

Resolução 1080x1920 · 30/1 · aac 48 kHz estéreo 192 kbps · vídeo 12,067 s / container 12,1 s /
áudio 12,1 s (sincronizados) · `X-Clip-Audio: normalizado` · `X-Clip-Path` presente.

**O alvo de ~8 Mbps é inalcançável e desnecessário, e a razão não é o encoder.** A escada
inteira, com a MESMA composição, mora uma ordem de grandeza abaixo dele:

| encode | bitrate | PSNR vs `-qp 0` | SSIM |
|---|---|---|---|
| sem perda (`-qp 0`) | 25,27 Mbps | — | — |
| **CRF 18 (o de hoje)** | **1,11 Mbps** | **53,1 dB** | **0,9980** |
| CRF 16 | 1,49 Mbps | 54,0 dB (+0,9) | 0,9983 |
| CRF 14 | 2,05 Mbps | 54,9 dB (+1,8) | 0,9986 |

O plano mandava descer para CRF 16 se o entregue ficasse abaixo de 8 Mbps; **descer não
resolve** — encostar em 8 exigiria CRF ~6, ~6× mais bytes gastos em ruído. E CRF 18 já está a
53 dB do sem-perda (transparência começa perto de 45), então **o gargalo não é o encoder: é o
conteúdo**. O quadro é um 1080p de 1,71 Mbps REDUZIDO para 1080x608 mais duas tarjas borradas
e escurecidas. **A queda de 3,93 para 1,46 Mbps não é regressão:** os bits de antes pagavam a
miniatura NÍTIDA das tarjas, que era o defeito visual que esta entrega removeu.
