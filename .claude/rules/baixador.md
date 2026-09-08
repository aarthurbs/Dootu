---
paths:
  - "baixador/**"
description: Regras ativas da extensão + helper local (porta 8770), TikTok e sidecar.
---

# Ponte Baixador → Estúdio — `baixador/` (regras ATIVAS)

Histórico e medições: `docs/archive/HISTORICO-estudio-video.md`.

Mundo **separado** do Estúdio (porta **8770**). Caminho:
aba do YouTube/TikTok → extensão → helper → yt-dlp → sidecar → Estúdio.

## Permissão da extensão
**`["activeTab"]` e nada mais.** Sem content script, sem service worker, sem
`<all_urls>`, sem histórico. O popup lê a aba **no clique do ícone**, valida com
`ytWatchId()` (host fechado + id de 11 caracteres, mesma regra do `ytclip.video_id`)
ou `tiktokRef()` (host fechado + id numérico) e **preenche o campo**. Aba que não é
vídeo diz isso por escrito, e diz o caso específico — "publicação de fotos do TikTok"
não pode virar "não é vídeo" genérico (BP-008).
A URL entregue ao yt-dlp é **reconstruída do id validado**, nunca a string da barra.

## TikTok — `local-helper/tiktok.py` (puro) + rotas `/inspect` e `/current`
- **Link curto é resolvido no HELPER**, nunca no popup (que não tem host permission
  para tiktok.com e não deve ganhar uma). `canoniza()` faz **HEAD com salto contado**
  (`MAX_SALTOS = 3`) e devolve cada destino ao `analisa()` antes do próximo pedido:
  redirecionamento para fora do TikTok **encerra** a resolução em vez de virar
  requisição. Medido: os dois links curtos de exemplo do yt-dlp já expiraram e caem na
  home — daí `TIKTOK_LINK_CURTO_MORTO` ter frase própria.
- **Marca d'água só se o extrator declarar.** `marca_dagua()` tem exatamente três
  saídas: `com-marca` (o yt-dlp escreveu `watermarked`), `sem-marca` (o TikTok
  respondeu `has_watermark=false` — o `download_addr` com a nota `Download video`
  limpa), e `desconhecida` para todo o resto. **Não existe ramo que deduza ausência de
  marca de `.mp4`, resolução, codec ou de o download ter funcionado.** `escolhe()`
  devolve `''` quando só sobra variante marcada: automático nunca entrega vídeo marcado.
  Medido 2026-09-08 em `@tiktok/video/7681695065927912735`: o formato `download` tem
  logo + @arroba queimados no quadro, o `h264_720p_*` (play addr) não tem.
- **O `-f` do yt-dlp nunca vem da rede.** O popup manda só o `formatId`; o `spec` sai
  da lista que o helper montou na última inspeção (`server._ultima`). Id que não está
  nessa lista leva 400 e **nenhum processo é iniciado**.
- **A marca d'água do sidecar sai do `.info.json` do download**, não da inspeção que a
  tela mostrou antes do clique — se os dois divergirem (o formato sumiu e o yt-dlp caiu
  no fallback `/`), quem manda é o arquivo.
- **`/current` é a retomada.** Fechar o popup não cancela; reabrir lê `/current`.
  Helper reiniciado devolve `{}` **de propósito**: o yt-dlp morreu junto, o arquivo
  ficou `.part`, e reconstruir "concluído" a partir do que sobrou no disco seria mentira.
- **Desafio anti-bot repete, e com espera.** O TikTok serve página de desafio em ~1 de 4
  pedidos; o yt-dlp resolve o JS, refaz o pedido UMA vez e morre em
  `Unable to extract universal data for rehydration` **antes do primeiro byte**. `inspect()`
  e `_run()` repetem o processo inteiro (`TENTATIVAS`), e só nessa frase (`e_desafio()`):
  "video unavailable" e "private video" também são extração falha e repeti-los só gastaria
  o tempo do operador. **A `ESPERA` entre tentativas não é enfeite** — medido 2026-09-08 em
  `share/video/7680281054460038420`: 5 falhas em 22 execuções idênticas (23%); repetindo na
  hora, 3 tentativas ainda deram 1 falha em 10 (as falhas vêm em RAJADA, não sorteadas uma a
  uma); com 3 s entre elas, **0 falhas em 25**. `--extractor-retries 10` do yt-dlp NÃO cobre
  este caminho (2 falhas em 14 contra 3 em 14 sem a flag). O `_run()` dorme **fora da trava**,
  e o job volta para `queued` — que segue em `ACTIVE_STATES`, então a trava de um download por
  vez continua fechada durante a repetição.
- Nome de arquivo do TikTok é `%(uploader)s-%(id)s.%(ext)s`. O "título" do post é a
  legenda inteira (hashtag, emoji) — nome instável; o id é estável e único.

## Portão de direitos (inviolável)
Mesma declaração do `ytFetchGate` do Estúdio: checkbox `#direitos`, botão travado
até marcar, declaração válida **por URL** (`urlAutorizada`) — trocar de vídeo
desmarca. Conferida DUAS vezes (ao habilitar e no clique).
- **`falha()` e o fim do download liberam por `atualizaBotao()`, nunca por
  `disabled = false`** — senão um erro reabriria o portão.
- **Marcar a caixa É o ato de declarar:** a atribuição de `urlAutorizada` vive
  **só** no `change` do checkbox; o `atualizaBotao()` é validador PURO que desmarca
  em QUALQUER divergência. (Medido: marcar com o campo vazio deixava a declaração
  sem alcance e a PRÓXIMA URL colada a herdava.)

## Sidecar `<vídeo>.mostreplayed.json`
- **v5** hoje: `mostReplayed` + `captions` (`available/language/kind/reason/note/cues/words`)
  + `thumbnail` (só o NOME do arquivo; quem resolve a pasta é o `serve.cut_background`)
  + a **procedência** (`source`, `title`, `creator`, `filename`, `downloadedAt` em ISO 8601
  UTC, `watermark {status,evidence,formatId}`). URL de mídia que expira, cookie e token
  **nunca** entram no sidecar.
- **Sidecar v1/v2/v3 continua valendo** e é lido como o que lhe falta
  ("vídeo sem legenda", "sem miniatura"). **Ninguém rebaixa vídeo para migrar formato.**
- As falas saem do **MESMO `.info.json`** que o `--write-info-json` já grava — UM
  GET no json3 que o próprio dump aponta, **zero chamada extra ao yt-dlp**.
- A miniatura vem de `--write-thumbnail` no **MESMO** comando (nada de
  `--convert-thumbnails`, que exigiria FFmpeg no PATH do helper).
- **Uma extração de legenda só:** `ytclip.fetch_cues(info)`, compartilhada com o Estúdio.
  `pick_caption_track` tem **IDIOMA por fora, origem por dentro** (uma manual em
  espanhol vencia uma automática em pt-BR e o corte saía legendado em espanhol).

## Armadilha medida
`produced_media()` prefere o nome exato `<stem>.mp4`. **Ordem alfabética não
serve:** com a miniatura na mesma pasta, `.jpg` vem ANTES de `.mp4` e o
`validate_input` receberia a imagem — o download morreria com "sem faixa de vídeo".
Fragmento (`.f616.mp4`) e sobra (`.part`) também ordenam na frente.
**Há uma terceira cópia de `THUMB_EXTS` em `baixador/local-helper/yt_dlp_runner.py`.**
No TikTok o `--write-thumbnail` grava a capa como **`.image`** (é JPEG — conferido com
ffprobe: mjpeg 540x960), extensão que nenhuma lista de "imagem óbvia" pegaria. Por isso
`.image` entrou no `THUMB_EXTS` das duas cópias, e o `newest_file()` do runner passou a
descartar `THUMB_EXTS` inteiro: sem isso o fallback devolveria a CAPA como se fosse o vídeo,
porque yt-dlp grava as duas no mesmo segundo.

## Recomendação continua recomendação
`/api/most-replayed` devolve um **resumo** da legenda, **nunca as falas** (um
podcast de 3h tem milhares de cues). `mrSelectionFrom` devolve só `inSec`/`outSec`
— nada cria corte sozinho.

## Validação
`py -3.12 baixador/local-helper/test_helper.py` · `node baixador/extension/test-popup.js`
— ou `.\provas.ps1` na raiz.
