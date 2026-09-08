---
paths:
  - "cloud/**"
  - "web/**"
  - "PASSO-A-PASSO.md"
description: Regras ativas da Fase 1 do lançamento público (só a ANÁLISE vai ao ar).
---

# Lançamento público, Fase 1 — `cloud/` e `web/` (regras ATIVAS)

Histórico completo: `docs/archive/HISTORICO-lancamento-fase1.md`.
Passos manuais: `PASSO-A-PASSO.md` · portão da Fase 0: `docs/LANCAMENTO-decisoes.md`.

## O que vai ao ar, e só isso
`probe()` + `candidates()` — metadados públicos, capítulos, legenda e heatmap.
**Não baixa um byte de mídia.** Cortar e renderizar continuam LOCAIS, no Estúdio,
onde a declaração de autorização existe.

## Fronteiras invioláveis
- `cloud/probe_server.py` é **stdlib puro** e **importa** `ytclip` sem alterar uma
  linha dele — fronteira única preservada. Expõe **duas** rotas: `POST /probe` e `GET /health`.
- **`ytclip.fetch_section` não é exposta de propósito.** A prova é comportamental:
  `test_probe_server.py` bloco 3 arma uma bomba em `fetch_section`/`produced_media`
  que fica ativa durante a requisição HTTP real.
- `cloud/Dockerfile`: `python:3.12-slim` + yt-dlp **binário** (nunca `import yt_dlp`),
  **sem FFmpeg**, usuário sem privilégio. O `.dockerignore` mantém o **`serve.py`
  FORA da imagem** — o container fica sem ter como servir download, render ou
  `/clips`, nem por regressão futura.
- **`web/` é um SEGUNDO ponto de entrada, não uma reorganização.** Nada foi movido:
  o `index.html` da raiz tem 0 `import`, 15 `<script src>` cuja ordem importa e 138
  buscas por id — mover arquivo ali troca benefício zero por tela em branco calada.
  **O Cloudflare Pages tem de apontar para `web`**, nunca para a raiz.

## A resposta pública é RECORTADA
`{video, note, candidates[]}`, 8 campos por candidato (`CANDIDATE_FIELDS`).
Fora de propósito: `cues` (3.830 falas / 331 KB num podcast de 2h07 — a resposta
cai para 4,2 KB), `state` (era do pipeline) e `category` (palpite que nunca
aparece na tela). `note` FICA.

## A tela pública NÃO tem portão de direitos nem estado de legenda
Aqui não existe download: checkbox que não guarda nada é teatro. As frases de
legenda/heatmap pertencem ao Passo 2 do Estúdio; usá-las aqui seria inventar estado.

## Armadilhas medidas (não re-descobrir)
1. **`Handler.timeout` não é opcional** — o padrão do stdlib é "sem prazo", e um
   socket que anuncia `Content-Length` e não manda o corpo prende uma thread para
   sempre, **antes** do Turnstile e do semáforo (Slowloris).
2. **Recusa tem de FECHAR a conexão** — 404/413 respondem sem ler o corpo e, com
   keep-alive, esses bytes viram a requisição seguinte (reproduzido: uma
   requisição, **duas respostas**). O conserto mora no `_json`, então `do_GET` herda.
3. **O `message` do `ffmpeg_failed` carrega o stderr CRU do yt-dlp** — vai ao log,
   **nunca** à resposta. O usuário recebe frase de conjunto fechado (`UPSTREAM`).
4. `MAX_BODY` precisa caber o token do Turnstile (~2048 chars).
5. Resposta obsoleta repopulava a lista com trechos de outro vídeo — contador de
   requisição, e `busy` liberado FORA do guarda.
6. **Token do Turnstile é de uso único** (`reset()` a cada tentativa), e "script não
   carregou" ≠ "não resolveu" — frases diferentes, senão manda marcar caixa que não existe.

## Continua fora, de propósito
Contas, banco, RLS, R2, fila e render na nuvem. **Quando o render for para a
nuvem, é pelo caminho FFmpeg** (o Remotion faz ~11 s de render por 1 s de clipe;
o FFmpeg entrega o mesmo 9:16 com legenda queimada em segundos), e o container só
precisa do FFmpeg — a fonte Inter já viaja no repo.

## Pendência aberta
**A Prova A não está respondida:** o probe funciona da máquina local (2h07 → 7,5 s),
mas **ninguém testou de um IP de datacenter** — o YouTube pode devolver
verificação de robô. É o portão do `PASSO-A-PASSO.md`, Passo 3.

## Validação
`py -3.12 cloud/test_probe_server.py` (63) · `node web/test-app.js` (28).
