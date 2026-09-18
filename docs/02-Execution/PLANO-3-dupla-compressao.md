# PLANO 3 — a dupla compressão do caminho YouTube

> **Estado (conferido em 2026-09-14): ENCERRADO em 2026-09-08. A Fase 2 não acontece.**
> O portão do §2.1 manda parar em ≥ 45 dB e a medição do §8 deu **47,46 dB PSNR / 0,9932
> SSIM**. Vale a opção A — não mexer. **Nenhuma linha de produção mudou**, que é o desfecho
> de sucesso previsto aqui. O `CLAUDE.md` exige "número novo" para reabrir.

**Ordem recomendada:** o **último** dos três. É o maior, o mais arriscado e o único que pode
terminar legitimamente em **"medi e não vou mexer"** — e isso seria um desfecho de sucesso, não
uma falha. Faça os Planos 1 e 2 antes: eles são pequenos e fecham pendência de verdade.

**Origem:** pendência (b) do relatório de 2026-09-04 e §0.2 do
`docs/03-Decisions/CONTRATO-qualidade-clip.md`, que a chama de *"o maior lastro de qualidade que sobra
depois desta entrega"*.

---

## 0. Orçamento de contexto — LEIA ISTO ANTES

**Este plano tem DUAS fases e elas são SESSÕES DIFERENTES.** Não tente as duas de uma vez: foi
exatamente assim que o trabalho anterior morreu no meio.

- **Fase 1 = medir.** Nenhuma linha de código de produção muda. Termina com um número e uma
  decisão escrita. **Uma sessão. Pare no fim dela.**
- **Fase 2 = executar**, e **só existe se a Fase 1 disser que vale**. Sessão separada, com o
  número da Fase 1 já em mãos.

Regras das duas:

- **Sem `Workflow`, sem agentes paralelos, sem fatias delegadas.**
- **NÃO leia por inteiro:** `CLAUDE.md`, `video-worker/ytclip.py` (~900 linhas),
  `video-worker/serve.py`, `video-worker/captions.py`.
- **Leia SÓ estes trechos:**

| arquivo | como achar | por quê |
|---|---|---|
| `ytclip.py` | `def fetch_section` (~853-878) | onde as flags do yt-dlp são montadas |
| `ytclip.py` | `def cues_for_range` | **a fronteira única do rebase da legenda** |
| `ytclip.py` | `def produced_media` | como o arquivo produzido é escolhido |
| `serve.py` | o bloco do `/api/yt-fetch` que chama `fetch_section` | quem consome |

- Na Fase 1, prefira rodar comandos e ler a SAÍDA a abrir arquivo.

---

## 1. O que se sabe hoje (medido) e o que NÃO se sabe

### 1.1 A cadeia tem duas gerações — confirmado

`ytclip.fetch_section` roda o yt-dlp com `--download-sections` **mais
`--force-keyframes-at-cuts`**, e a ajuda do próprio binário diz *"This is slow due to needing a
re-encode"*. Ou seja:

```
stream do YouTube → yt-dlp/FFmpeg --force-keyframes-at-cuts   [ENCODE 1]
                  → <cache>/<id>-<in>-<out>.mp4
                  → npx remotion render (decode + encode)      [ENCODE 2]
```

O caminho MP4 local (`/api/video-cut`) **não** tem intermediário: um encode só.

**Evidência independente de que o ENCODE 1 é real** (medida em 2026-09-04): num trecho baixado,
`bNkQaTQ4SE0-415-461.mp4`, os keyframes caem em **t=0 e t=10,4167 s**. A 24 fps isso é
**exatamente 250 quadros — o `-g` padrão do FFmpeg**. Um stream copy teria preservado a
estrutura de GOP do YouTube; GOP 250 cravado é impressão digital de recodificação.

### 1.2 O que NÃO está medido — e é o que a Fase 1 existe para descobrir

1. **Quanto o ENCODE 1 custa em qualidade.** Ninguém comparou o trecho recodificado com o mesmo
   trecho em stream copy. Pode ser 0,3 dB (irrelevante) ou 6 dB (relevante).
2. **Qual o GOP real do stream do YouTube.** ⚠ **Os 10,4 s acima NÃO respondem isso** — eles são
   a saída do recodificador, não a entrada. É o número que dimensiona o deslocamento se a flag
   sair.
3. **Com que parâmetros o yt-dlp recodifica.** Se for CRF alto/preset rápido, existe conserto
   barato (§3, opção C) que não mexe em deslocamento nenhum.

**Não deduza nenhum dos três. Meça.**

---

## 2. FASE 1 — medir (uma sessão, sem mexer em código)

⚠ **Precisa baixar do YouTube.** Ver §5: o portão de direitos vale integralmente.

Escolha **um** vídeo já autorizado e um trecho de ~30 s. Produza **três** arquivos do MESMO
intervalo:

| # | como | o que é |
|---|---|---|
| A | yt-dlp como hoje (`--download-sections` + `--force-keyframes-at-cuts`) | o ENCODE 1 atual |
| B | yt-dlp **sem** `--force-keyframes-at-cuts` | stream copy, começa num keyframe anterior |
| C | trecho de B recortado no intervalo exato, sem recodificar o vídeo | a referência prática |

Depois meça e **escreva os números no §8 deste arquivo**:

1. **GOP real do stream** — nos keyframes de B (`ffprobe -select_streams v:0 -show_entries
   frame=key_frame,pts_time`). É o deslocamento máximo se a flag sair.
2. **Deslocamento real** — quanto B começa antes do pedido. É o `d` da opção B do §3.
3. **Custo do ENCODE 1** — PSNR/SSIM de A contra C. **Este é o número que decide o plano.**
4. **Parâmetros do ENCODE 1** — rode o yt-dlp com `-v` e leia a linha de comando do FFmpeg que
   ele monta. Anote CRF e preset.
5. **Bitrate** de A e de C.

### 2.1 O portão de decisão — escreva a decisão, não a adie

| medição 3 (A vs C) | decisão |
|---|---|
| **≥ 45 dB PSNR** | ENCODE 1 é praticamente transparente. **PARE. Não faça a Fase 2.** Registre no `CLAUDE.md` que o lastro foi medido e é irrelevante, e tire o item da lista de pendências. |
| **38-45 dB** | perda pequena. Faça **só a opção C** do §3 (barata e sem risco). Ignore A e B. |
| **< 38 dB** | perda relevante. Aí sim avalie a opção B, com o `d` da medição 2 em mãos. |

**Parar no primeiro caso é o desfecho mais provável e é vitória** — significa que o "maior
lastro de qualidade" não era lastro, e você descobriu isso com dois arquivos e um `ffprobe` em
vez de uma refatoração arriscada.

---

## 3. FASE 2 — as três opções (só com o número da Fase 1 na mão)

### Opção A — não mexer
Aceita duas gerações. **É a escolha certa se a medição 3 der ≥45 dB.** Custo zero, risco zero.

### Opção C — melhorar o ENCODE 1 (recomendada se houver perda pequena)
Manter `--force-keyframes-at-cuts` e passar parâmetros melhores ao recodificador do yt-dlp
(`--postprocessor-args`), por exemplo CRF mais baixo. **Não mexe em deslocamento, não mexe em
legenda, não mexe em rebase.** Custo: mais tempo de download e arquivo de cache maior.
**Melhor relação risco/benefício das três.**

### Opção B — tirar a flag e compensar o deslocamento (só se a perda for grande)
Sem `--force-keyframes-at-cuts` o yt-dlp faz **stream copy** e o arquivo começa no keyframe
anterior, `d` segundos antes do pedido. Elimina o ENCODE 1 inteiro. Para o conteúdo não
deslizar, `d` tem de ser **descontado adiante**:

- o render (Remotion e FFmpeg) começa em `d`, não em 0;
- o rebase da legenda no `cues_for_range` desconta `d`.

**Por que é a mais arriscada, escrito para quem for tentar:**

- `cues_for_range` é a **fronteira única** de cue de clipe — ela alimenta o ASS do FFmpeg **e**
  as `Sequence` do Remotion. Errar `d` ali desloca a legenda nos **dois** renderizadores de uma
  vez, e o karaokê por palavra sai junto.
- `d` **não é constante**: depende de onde caiu o keyframe. Tem de ser **medido do arquivo
  produzido** (comparando o início real com o pedido), nunca estimado.
- Se o GOP do YouTube for grande, `d` grande significa baixar bem mais mídia que o pedido — o
  que empurra contra o portão de direitos e contra o tempo de download.
- **`d` tem de atravessar como DADO**, não ser recalculado em dois lugares. É a mesma lição do
  `captions.margem_inferior` e do `video_box`: dois donos da mesma conta divergem calados.

**Se escolher B, faça em checkpoints separados:** (1) medir e propagar `d` sem usá-lo, provando
que ele chega; (2) usar `d` no render; (3) usar `d` na legenda; (4) prova visual nos dois
renderizadores. Suíte verde em cada um.

---

## 4. Provas (Fase 2, qualquer opção)

- **A legenda não pode deslizar.** Prova comportamental: para um corte conhecido, o instante de
  uma palavra no ASS e na `Sequence` tem de continuar batendo com o instante que o json3
  publicou — é o que o check `18f` do `test_ytclip.py` já faz. **Rode-o e entenda-o antes de
  mexer.**
- **A recomendação de cortes não pode mudar.** `candidates()` está fora deste plano; os checks
  `17m` e `18i` são prova comportamental disso e têm de continuar verdes.
- **Prova visual obrigatória nos dois renderizadores** se a opção B for escolhida: um quadro no
  começo, um no meio e um no fim do corte, conferindo que a fala casa com a boca. Deslizamento
  de legenda **não aparece em teste automatizado** — só olhando.
- **Sabotagens em CÓPIA no temporário**, nunca na árvore de trabalho: `d` zerado, `d` com sinal
  trocado, `d` aplicado no render mas não na legenda.

---

## 5. Direitos autorais — inviolável

Este plano **baixa mídia**, e é o único dos três que baixa por necessidade. O portão continua
valendo integralmente: **analisar metadados/legenda é livre; baixar mídia passa pela declaração
do operador** (`ytFetchGate` no Estúdio, checkbox na extensão, válida por URL). Não contorne,
não automatize a declaração, e nunca use `--exec`, `--netrc-cmd`, cookies de navegador ou
`aria2c`. `--ignore-config` continua obrigatório, e a URL entregue ao processo é reconstruída do
id validado — **nunca a string colada**.

Use **um vídeo para o qual a autorização já exista**. Se não houver, **este plano não roda**, e
isso é uma resposta legítima.

---

## 6. Fora deste plano, de propósito

- `--download-sections` em si: sem ele o yt-dlp baixaria o podcast inteiro.
- O caminho MP4 local (`/api/video-cut`): já tem um encode só.
- `candidates()`, portão de direitos, card, enquadramento, fundo, áudio, CRF do Remotion.
- Tags de cor (Plano 1) e `X-Clip-Background` (Plano 2).

## 7. Risco

**O mais alto dos três, e concentrado na opção B.** Ela mexe na fronteira única da legenda, e um
erro ali desloca a fala nos dois renderizadores de uma vez — defeito que passa em suíte verde e
só aparece assistindo ao clipe. **A opção C entrega a maior parte do ganho com uma fração do
risco.** E a opção A — não mexer — é a resposta certa se o número da Fase 1 mandar.

---

## 8. Resultado da Fase 1 — MEDIDO em 2026-09-08

**Vídeo:** `bNkQaTQ4SE0`, trecho 415-461 s (46 s, 1920x1080, 24 fps), autorizado pelo operador.
O arquivo A já existia no disco (`~/Videos/Cortes Estudio/bNkQaTQ4SE0-415-461.mp4` — o mesmo do
§1.1), então a Fase 1 custou **um** download: o B, sem `--force-keyframes-at-cuts`.

- **GOP real do stream do YouTube:** **irregular, não fixo.** 12 keyframes em 51 s, intervalos
  de **0,71 s a 7,00 s** (média 4,46). O teto de deslocamento é ~7 s — não existe "um GOP".
- **Deslocamento `d` observado:** **5,1667 s = 124 quadros a 24 fps.** Medido do CONTEÚDO (ver
  a armadilha do §8.2) e conferido contra a grade: 5,1667 s é um dos intervalos reais de
  keyframe do stream. O yt-dlp sem a flag chama o FFmpeg com `-ss 415 -t 46 ... -c copy`
  (confirmado no `-v`), e a pré-rolagem vem escondida na edit list do MP4 — para ver os 1230
  quadros é preciso `-ignore_editlist 1`.
- **PSNR/SSIM de A contra C:** **PSNR y = 47,46 dB** (average 48,50) · **SSIM Y = 0,9932**
  (All 0,9939). Por quadro: média 47,65 · mediana 47,56 · p5 46,55 · mínimo 34,64 em **um**
  quadro (corte de cena). Quartis 47,47 / 47,27 / 47,41 / 48,51 — uniforme, sem deriva de
  alinhamento ao longo dos 46 s.
- **Parâmetros do ENCODE 1:** `libx264` (`TAG:encoder=Lavc61.19.100 libx264`), **`rc=crf`,
  `crf=23.0`, preset `medium`** — `ref=3 me=hex subme=7 bframes=3 rc_lookahead=40 trellis=1
  8x8dct=1` é a assinatura exata do medium — e `keyint=250`, que é a impressão digital dos 250
  quadros do §1.1. Lido do SEI do próprio arquivo A, **não** do `-v` do yt-dlp: é evidência do
  artefato entregue, não da linha de comando montada.
- **Bitrate A / C:** vídeo **1,709 / 1,920 Mbps** (arquivo 1,844 / 2,270). A sai 11% abaixo da
  fonte.
- **Decisão (§2.1): ≥ 45 dB → o ENCODE 1 é praticamente transparente. PARE. A Fase 2 NÃO
  acontece.** O "maior lastro de qualidade que sobra" foi medido e **não é lastro.**

### 8.1 Confirmação independente — e por que ela também mata a opção C

Reproduzi o ENCODE 1 localmente: os mesmos quadros de C, `libx264 -preset medium -crf 23`.
Deu **47,57 dB** em **9.814.517 bytes**, contra 47,46 dB e ~9,83 MB de vídeo do A real. Bater a
0,1 dB e a 0,2% de tamanho prova que **A não tem nenhuma perda além da que o CRF 23 explica** —
não há segunda degradação escondida na cadeia do yt-dlp.

O mesmo experimento mede o que a **opção C** compraria: `-crf 18` nos mesmos quadros dá
**49,93 dB** (+2,4 dB) por **17.471.061 bytes — 78% mais arquivo** (e 5% mais tempo de encode).
Pagar 78% de cache e de download para ir de 47,5 a 49,9 dB, faixa em que já não se vê diferença,
não se justifica. **A opção C também não vale, e agora isso está medido em vez de suposto.**
A resposta é a **opção A — não mexer.**

### 8.2 A armadilha que custou 17 dB — leia antes de medir `d` de novo

Achei o `d` primeiro por correlação de assinatura de luma 8x8 por quadro. Ela apontou **125**
quadros. O offset certo é **124**, e um único quadro de erro vale isto:

| offset | `d` | PSNR y |
|---|---|---|
| 124 | 5,1667 s | **47,46 dB** |
| 125 | 5,2083 s | 30,62 dB |
| 126 | 5,25 s | 27,63 dB |

**Por que a assinatura erra:** num plano estático de podcast, quadros vizinhos têm luma média
quase idêntica — o sinal é degenerado e o mínimo cai no vizinho, com pico "nítido" de 3,46x que
não quer dizer nada. E o erro é **silencioso**: 30,62 dB é um número perfeitamente plausível de
"perda relevante" e teria empurrado a decisão para a faixa `< 38 dB` — ou seja, para a **opção B,
a mais arriscada das três, para consertar um problema que não existe.**

**Alinhamento de quadro se acha com a própria métrica final (PSNR nos offsets vizinhos), nunca
com uma assinatura barata.** Confira sempre ±1 quadro: o offset certo tem pico de ~17 dB sobre o
vizinho, não de alguns décimos.
