# PLANO 2 — `X-Clip-Background`: o último ponto sem estado visível (BP-008)

**Ordem recomendada:** o **segundo** dos três. Independente do Plano 1 e do Plano 3 — se
quiser, pode ser o primeiro. Não toque nos outros dois na mesma sessão.

**Origem:** pendência (c) do relatório de 2026-09-04, mais o item (d) "a fonte baixada continua
não medida". Os dois são o mesmo assunto — o operador não sabe o que saiu — e por isso vão
juntos num plano só.

---

## 0. Orçamento de contexto — LEIA ISTO ANTES

- **UMA sessão, UM plano.** Sem `Workflow`, sem agentes paralelos, sem fatias delegadas.
- **NÃO leia por inteiro:** `CLAUDE.md`, `video-worker/serve.py` (~1700 linhas), `video-ops.js`
  (~3000 linhas), `video-worker/test_serve.py` (~1400 linhas).
- **Leia SÓ estes trechos** — é tudo que o plano toca:

| arquivo | como achar | por quê |
|---|---|---|
| `serve.py` | `def render_background` (~318) e `def cut_background` (~548) | quem decide o fundo |
| `serve.py` | `def background_ok` (~571-583) | **é aqui que mora o `print` mudo** |
| `serve.py` | `CAPTION_STATES` + `def _caption_state` (~721-740) | **o padrão a espelhar; copie a forma** |
| `serve.py` | `def _send_video` + `def _deliver_video` (~1576-1620) | onde o cabeçalho sai |
| `serve.py` | `def source_scale` (~631) | a parte da fonte |
| `video-ops.js` | Grep `captionsMessage` e `audioMessage` | onde a frase entra |
| `video-ops.js` | Grep `sourceWarning` | já existe, só é conferido |
| `test_serve.py` | Grep `21t0` | o check que LÊ o `video-ops.js` — copie a forma |

- **Tamanho esperado:** uma sessão média. Passou de ~250k tokens? Pare no último checkpoint
  verde e reporte.

---

## 1. O que está errado

O fundo por miniatura (entrega de 2026-08-26) tem **três desfechos** e a tela não conhece
nenhum:

1. a miniatura virou o fundo — o caso normal;
2. **não havia miniatura** ao lado do trecho (sidecar v1/v2, MP4 local do Passo 3, trecho em
   cache antigo, `--write-thumbnail` que falhou) → sai letterbox chapado;
3. **havia miniatura e ela era ilegível** (`.webp` truncado) → `background_ok` a descarta e sai
   letterbox chapado.

O caso 3 é o único que produz sinal, e **o sinal vai só para o console do servidor**:

```python
# serve.py, dentro de background_ok
print("[background] miniatura ignorada (%s): %s" % (path, err), file=sys.stderr)
```

O `CLAUDE.md` já registra isto por escrito: *"é o único ponto deste recurso sem estado visível
na interface (BP-008); vale acrescentar quando alguém for mexer na tela do Passo 3."*

**Por que importa:** os casos 2 e 3 produzem o MESMO pixel (letterbox), e o operador não tem
como distinguir "este vídeo não tinha miniatura" de "a miniatura chegou quebrada". O primeiro é
normal; o segundo é um download a refazer. Automação silenciosa é indistinguível de automação
quebrada — é literalmente o BP-008.

---

## 2. Desenho — espelhe o `CAPTION_STATES`, não invente forma nova

O projeto já resolveu este problema exato para a legenda e para o áudio. **Copie a forma**, não
o texto: conjunto fechado no `serve.py`, filtro antes do cabeçalho, uma frase por estado no
`video-ops.js`, e o check que lê o JS e reprova estado sem frase.

### 2.1 O conjunto fechado

```python
BACKGROUND_OK = "miniatura"
BACKGROUND_NONE = "BACKGROUND_NONE"              # não havia miniatura ao lado
BACKGROUND_UNREADABLE = "BACKGROUND_UNREADABLE"  # havia, e não deu para ler
BACKGROUND_STATES = (BACKGROUND_OK, BACKGROUND_NONE, BACKGROUND_UNREADABLE)
```

**`NONE` e `UNREADABLE` NUNCA colapsam num erro genérico.** É a mesma regra que mantém
`CAPTIONS_NOT_AVAILABLE` separado de `CAPTIONS_EXTRACTION_FAILED`, e é o motivo de o plano
existir: são dados diferentes e pedem ação diferente do operador.

`_background_state(valor)` filtra pelo conjunto, irmão do `_caption_state` e do `_audio_state`:
valor desconhecido vira `BACKGROUND_UNREADABLE` (o desfecho conservador — "não deu para usar"),
**sem** colapsar os dois legítimos. O valor entra num cabeçalho HTTP; valor livre nesse trajeto
quebra os dois lados (foi assim que o `reason` do sidecar quase injetou cabeçalho, em
2026-08-24).

### 2.2 O cabeçalho é CONDICIONAL, como o `X-Clip-Captions`

`X-Clip-Audio` é sempre presente porque as duas rotas 9:16 sempre tentam normalizar.
`X-Clip-Background` é **condicional**: o perfil `horizontal` não tem tarja e não tem fundo, e
emitir estado ali seria inventar. Ausência = "esta rota não tem o que dizer".

### 2.3 A fiação

`background_ok` **não deve** virar a fonte do estado — ela responde uma pergunta booleana e é
chamada de dois lugares. Quem decide é quem já escolhe o fundo:

- **caminho FFmpeg** (`/api/video-cut`): onde hoje se resolve `fundo` via `cut_background` +
  `background_ok`, calcule também o estado e passe ao `_send_video`.
- **caminho Remotion**: `render_background(folder, clip_name)` devolve `""` nos casos 2 e 3
  **sem distinguir os dois** — é aqui que está o trabalho de verdade. Ela precisa separar
  "não achei arquivo" de "achei e não presta". Use o `ytclip.thumbnail_beside`, que já devolve
  o nome quando existe: **achou nome + `background_ok` falhou = `UNREADABLE`; não achou nome =
  `NONE`.**

`_send_video(path, download_name, captions_state="")` ganha `background_state=""`, e
`_deliver_video` emite o cabeçalho quando ele vier preenchido.

### 2.4 A frase, no `video-ops.js`

Uma por estado, irmãs do `captionsMessage`/`audioMessage`. O caso normal (`miniatura`) pode não
render frase nenhuma no toast — é o esperado, e o `audioMessage` já tem esse precedente. Os dois
casos de letterbox precisam dizer **o que aconteceu e o que fazer**:

- `NONE` → o trecho não trouxe miniatura, então o fundo saiu chapado (normal em MP4 local e em
  trecho baixado antes desta entrega).
- `UNREADABLE` → veio miniatura e ela chegou quebrada; **baixar o trecho de novo resolve**.

### 2.5 A parte da fonte (item (d))

`serve.source_scale` e o espelho `sourceScale`/`sourceWarning` do `video-ops.js` **já existem e
já funcionam** — o que ficou pendente é que **nunca foram vistos com uma fonte real**, porque o
cache estava limpo quando a entrega foi medida. Isto **não é código a escrever**, é uma
conferência:

1. baixe um trecho pelo fluxo normal (passa pelo portão de direitos — ver §5);
2. leia `width`/`height` do que o yt-dlp entregou;
3. confira se o aviso de fonte aparece (ou não aparece) nos três enquadramentos, e se o número
   bate com a tabela de reamostragem do `PLANO-qualidade-clip-tiktok.md` §3.2.

Se o seletor `height<=1080` estiver entregando menos que 1080 na prática, **isso é um achado a
registrar**, não a consertar aqui.

---

## 3. Provas

| # | check | como |
|---|---|---|
| P1 | trecho COM miniatura boa → cabeçalho `miniatura` | requisição real, ler o cabeçalho |
| P2 | trecho SEM miniatura → `BACKGROUND_NONE` | cache sem a imagem |
| P3 | miniatura ILEGÍVEL → `BACKGROUND_UNREADABLE` | gravar um `.jpg` truncado ao lado |
| P4 | **P2 e P3 não colapsam** — os dois valores são diferentes | comparação direta |
| P5 | `_background_state` recusa valor fora do conjunto | chamada pura com lixo |
| P6 | valor com CRLF não injeta cabeçalho | chamada pura com `"a\r\nX: b"` |
| P7 | perfil `horizontal` **não** emite o cabeçalho | requisição real |
| P8 | **todo estado do conjunto tem frase no `video-ops.js`** | check que LÊ o JS (copie o 21t0) |
| P9 | miniatura ilegível continua **não derrubando** o corte (200, letterbox) | regressão |

**P8 é o check que dá sentido ao conjunto fechado** — foi ele que pegou o
`CAPTIONS_EDITED_EMPTY` sem frase. Sem P8 este plano vira um cabeçalho que ninguém lê.

**P3 e P9 juntos** são o par que importa: o defeito atual é que o caso 3 é mudo, e a correção
não pode transformá-lo em falha.

**Sabotagens — em CÓPIA no temporário, NUNCA na árvore de trabalho:**

1. `render_background` devolvendo `NONE` para os dois casos → P4
2. cabeçalho emitido também no `horizontal` → P7
3. tirar uma frase do `video-ops.js` → P8
4. `_background_state` deixando passar valor livre → P5/P6

---

## 4. Checkpoints

Depois de cada um, **suíte verde**. Sessão que morre retoma do último verde.

- **CP1** — conjunto fechado + `_background_state` + checks P5/P6 (tudo puro, sem fiação ainda).
  `.\provas.ps1`
- **CP2** — `render_background` separa `NONE` de `UNREADABLE`; caminho Remotion emite o
  cabeçalho. Checks P1/P2/P3/P4. `.\provas.ps1`
- **CP3** — caminho FFmpeg emite; `horizontal` não emite. Checks P7/P9. `.\provas.ps1`
- **CP4** — frases no `video-ops.js` + check P8. `.\provas.ps1`
- **CP5** — sabotagens 1-4 em cópia temporária; `CLAUDE.md` atualizado (a linha `Checks:` **e**
  o bullet que hoje diz "é o único ponto deste recurso sem estado visível na interface" —
  deixou de ser verdade).
- **CP6** *(opcional, precisa de rede e do portão)* — a conferência da fonte do §2.5.

---

## 5. Direitos autorais — inviolável

O CP6 precisa **baixar** um trecho. O portão do Estúdio (declaração por URL, `ytFetchGate`) e o
da extensão continuam valendo integralmente: **analisar metadados é livre, baixar mídia passa
pela declaração do operador.** Não contorne, não automatize a declaração, não use `--exec`,
cookies de navegador nem `aria2c`. Se não quiser baixar nada, **encerre no CP5** — os CPs 1-5
não tocam a rede e entregam o valor principal do plano.

---

## 6. Fora deste plano, de propósito

- Trocar o comportamento do fallback: letterbox **continua** sendo o certo quando não há
  miniatura. Este plano faz a tela DIZER, não muda o pixel.
- `THUMB_LUZ`/`fundoLuz`/`THUMB_DESFOQUE_SIGMA`: já calibrados, não mexa.
- A geometria da tarja (`band_height`), a legenda, o card, o enquadramento.
- Tags de cor (Plano 1) e dupla compressão (Plano 3).

## 7. Risco

**Baixo.** Nada aqui muda um pixel do vídeo entregue — só acrescenta um cabeçalho e frases. O
único ponto de atenção é o `_send_video`, que é choke point das duas rotas: mexa só na
assinatura (parâmetro novo com padrão `""`) e rode a suíte no checkpoint.
