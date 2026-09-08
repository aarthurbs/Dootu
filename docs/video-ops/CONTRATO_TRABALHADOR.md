# Contrato navegador ↔ trabalhador local

**Versão do contrato:** 1 · **Escrito em:** 01/08/2026 · **Atualizado em:** 03/08/2026 ·
**Estado:** implementado para `ingest` e `render_variant` em `video-worker/worker.py`.
`transcribe` e `render_master` seguem especificados e **não implementados** — o job volta
com `unsupported_type` em vez de fingir sucesso.

Provas executáveis (mídia sintética; nenhum conteúdo protegido):

```powershell
py -3.12 video-worker\make_fixtures.py    # blocos do contrato (probe, hash, atômico, job/result)
py -3.12 video-worker\test_worker.py      # o trabalhador: sandbox, recorte, render, espaço, idempotência
# node test-video-ops-e2e.js              APAGADO em 2026-08-21 (o pipeline de variantes/import/aprovação
#                                         saiu do Estúdio); o contrato do trabalhador continua provado acima
```

**Como rodar.** `--root` aponta para a pasta **do projeto** (a que contém `Fontes
originais/`, `Variantes/`, `_jobs/` e `_results/`). Todo caminho dentro do job é relativo
a essa raiz — sem o prefixo `Projeto Automação de Vídeos/`, que o navegador remove ao
emitir o job. Nada é lido ou escrito fora da raiz.

```powershell
py -3.12 video-worker\worker.py --root "G:\Meu Drive\Projeto Automação de Vídeos"
```

## 1. Princípio

O navegador **descreve trabalho**; o trabalhador **executa e relata**. Nenhum dos dois
publica. Nenhum dos dois recebe segredo. A troca é por arquivo JSON em pasta, sem
servidor, sem porta aberta e sem processo residente.

```text
navegador  --escreve-->  _jobs\pending\<jobId>.json
trabalhador --move-->    _jobs\running\<jobId>.json
trabalhador --escreve--> _results\<jobId>.json   (+ move para done\ ou failed\)
navegador  --importa-->  result.json
```

O navegador nunca lê a pasta sozinho: o operador baixa o `job.json` e importa o
`result.json`. Vigilância automática de pasta só entra se o atrito for medido e doer.

## 2. Estados

`pending` → `running` → `done` | `failed`

- a transição é representada pela **pasta** onde o arquivo está, não por um campo mutável;
- `failed` é terminal para a tentativa, não para o job: enquanto `attempts < maxAttempts`
  ele volta para `pending`;
- não existe estado implícito. Um job sem arquivo em nenhuma pasta é um erro a investigar,
  nunca um sucesso silencioso.

## 3. `job.json`

```json
{
  "contractVersion": 1,
  "jobId": "job_2026-08-01_0001",
  "type": "ingest | transcribe | render_master | render_variant",
  "createdAt": "2026-08-01T09:00:00Z",
  "state": "pending",
  "attempts": 0,
  "maxAttempts": 3,
  "input": {
    "path": "G:\\Meu Drive\\Projeto Automação de Vídeos\\Fontes originais\\src_1\\original.mp4",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb924…"
  },
  "output": { "folder": "…\\Cortes mestres\\clp_1" },
  "options": { "overwrite": false }
}
```

Campos obrigatórios: `contractVersion`, `jobId`, `type`, `state`, `attempts`,
`maxAttempts`, `input`.

`input.sha256` é **obrigatório em `render_variant`** — é ele que dá idempotência e garante
que o arquivo não mudou desde a marcação no navegador. Em **`ingest` é opcional**, porque é
o próprio ingest que calcula esse hash: exigi-lo ali seria pedir ao navegador um dado que
ele ainda não tem (o navegador não lê 700 MB para gerar SHA-256). A idempotência do ingest
continua valendo pelo `jobId`. *(Esclarecimento de 03/08/2026, sem mudança de versão: o
campo segue no mesmo lugar e com o mesmo significado.)*

`render_variant` acrescenta em `options` — aditivo, contrato segue 1:

```json
"options": {
  "inSec": 600, "outSec": 615, "reframe": "blur | crop",
  "variantId": "var_t15", "platform": "tiktok", "placement": "tiktok_video",
  "renderVersion": 1, "targetSec": 15, "overwrite": false
}
```

`reframe` vem de lista fechada: `blur` preserva o quadro inteiro sobre fundo desfocado
tirado dele mesmo; `crop` reenquadra no centro. Não há rastreamento automático de sujeito.

## 4. `result.json`

```json
{
  "contractVersion": 1,
  "jobId": "job_2026-08-01_0001",
  "state": "done",
  "attempts": 1,
  "finishedAt": "2026-08-01T09:04:12Z",
  "input": { "path": "…", "sha256": "…" },
  "media": {
    "durationSec": 6.0, "sizeBytes": 184320,
    "videoCodec": "h264", "width": 1080, "height": 1920,
    "audioCodec": "aac", "probe": "ffmpeg-header"
  },
  "artifacts": [
    { "kind": "master", "path": "…\\master.mp4", "sha256": "…", "sizeBytes": 184320 }
  ],
  "error": null
}
```

Obrigatórios: `contractVersion`, `jobId`, `state`, `artifacts`, `error`. Cada artefato
precisa de `kind`, `path`, `sha256` e `sizeBytes`.

Regra que o validador impõe: `state: "failed"` **exige** `error` preenchido, e
`state: "done"` **proíbe** `error`. Falha nunca vira sucesso silencioso.

```json
"error": { "code": "probe_failed", "message": "arquivo sem faixa de vídeo legível" }
```

`code` é estável para automação; `message` é português legível para o operador.

Cada artefato de variante acrescenta (aditivo): `variantId`, `renderVersion`, `reframe`,
`inSec`, `outSec`, `durationSec`, `width`, `height`, `videoCodec`, `audioCodec` e
`sourceSha256` — é o que o Estúdio usa para amarrar a aprovação ao arquivo revisado.

### 4.1 Tabela de códigos de erro

Fonte da verdade: `ERROR_CODES` em `video-worker/worker.py`.

| `code` | quando acontece |
|---|---|
| `job_invalid` | job.json ilegível, sem campo obrigatório ou com valor fora do domínio |
| `contract_version` | `contractVersion` diferente do suportado |
| `unsupported_type` | tipo previsto no contrato mas não implementado nesta fase |
| `path_outside_root` | caminho absoluto externo, `..`, link ou volume fora da raiz |
| `input_missing` | arquivo de entrada não existe |
| `input_empty` | arquivo existe mas está vazio |
| `input_not_source` | entrada aponta para uma variante já renderizada (evita cascata) |
| `probe_failed` | sem faixa de vídeo legível: arquivo inválido ou corrompido |
| `hash_mismatch` | o arquivo mudou desde que o navegador registrou o hash |
| `cut_invalid` | início/fim ausente, negativo, invertido, não finito ou além da duração |
| `no_space` | espaço livre insuficiente — abortado **antes** de produzir arquivo |
| `ffmpeg_failed` | o FFmpeg retornou erro |
| `output_invalid` | o arquivo produzido reprovou na conferência (resolução, codec, duração) |

## 5. Escrita atômica — obrigatória

1. escrever em `<destino>.part`;
2. `flush()` + `os.fsync()`;
3. `os.replace(part, destino)` — atômico no mesmo volume;
4. conferir que o `.part` sumiu.

Sem isso o Google Drive para Desktop pode sincronizar um arquivo pela metade.

**Armadilha já encontrada e provada pelo harness:** escrevendo em `.part`, o FFmpeg não
deduz o container pela extensão e aborta com *"Unable to choose an output format"*. Toda
escrita atômica de mídia **precisa** de `-f mp4` (ou o formato correspondente) explícito.

## 6. Idempotência

A chave é o par (`jobId`, `input.sha256`). Se já existe `_results\<jobId>.json` com
`state: "done"` e o mesmo `input.sha256`, **não refazer**: o resultado anterior vale.
Mudou o hash da entrada? É outro trabalho — exige `jobId` novo. Isso impede que uma
reexecução duplique saída na pasta do Drive.

## 7. Ordem de implementação do trabalhador

Estado em 03/08/2026: **1–5 e 8–13 feitos** para corte e variante vertical (os passos 5 e 8
se resolvem no mesmo render, direto do original); **6 e 7 (transcrição) não feitos**.

1. validar o arquivo de entrada;
2. coletar duração, codec, resolução e áudio;
3. calcular SHA-256 (incremental — nunca carregar o arquivo inteiro na memória);
4. detectar duplicata por hash;
5. gerar proxy ou áudio quando necessário;
6. transcrever;
7. produzir JSON de palavras, SRT, VTT e ASS;
8. renderizar o corte mestre;
9. renderizar a variante TikTok;
10. renderizar a variante Instagram;
11. validar duração, resolução, codec e existência dos arquivos;
12. gravar o resultado do job;
13. parar, aguardando aprovação humana.

**O trabalhador nunca publica.**

## 8. Restrições

- Python já instalado (3.12.10) e o FFmpeg já validado do projeto; nada de binário novo
  sem necessidade demonstrada;
- sem servidor Node, sem npm no frontend, sem banco adicional, sem n8n, sem Docker;
- sem GPU/CUDA no início;
- sem segredo no navegador, no Drive ou no Git;
- o original é imutável: nunca sobrescrever nem apagar automaticamente;
- verificar espaço livre antes de renderizar; abortar com erro legível em vez de encher
  o disco.

## 8.1 Render vertical — o que o trabalhador garante

Toda variante sai **MP4 1080x1920, H.264 (yuv420p) + AAC 48 kHz**, sem marca d'água, com
nome determinístico e seguro no Windows. A duração é conferida contra a seleção com
tolerância de **0,25 s** (`TOLERANCE_SEC`); fora disso o job falha com `output_invalid` em
vez de entregar arquivo torto. Original sem faixa de áudio gera variante sem áudio e isso
é **relatado** em `notes.audio` — nunca preenchido com silêncio inventado.

Cada variante é gerada **direto do original**: nenhum job aceita como entrada um arquivo
dentro de `Variantes/` (`input_not_source`), então não existe recodificação em cascata entre
TikTok e Instagram. Um job por variante — a falha de uma não obriga a refazer as outras.

## 9. O que ainda não está decidido

- `ffprobe` **não** vem no pacote `imageio_ffmpeg` do projeto. Hoje duração, codec e
  resolução são lidos do cabeçalho que o próprio `ffmpeg` imprime, e isso já foi provado
  suficiente com mídia sintética. Só instalar `ffprobe` se aparecer um caso real em que
  essa leitura falhe — aí passando pelo checklist de `PESQUISA_FERRAMENTAS.md`.
- Vigilância automática da pasta `_jobs`: fora do escopo até o atrito ser medido.
- Formato do `transcript.json`: será fechado junto com o benchmark de legendas, não antes.
