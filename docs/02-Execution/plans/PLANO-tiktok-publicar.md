# Publicar no TikTok direto do Estúdio

**Decisão (2026-09-10, do usuário):** modo **rascunho / inbox** (escopo `video.upload`).
O MP4 sai do worker local para a caixa de entrada do TikTok; você termina no celular
(legenda, capa, trilha) e publica. **Post direto (`video.publish`) ficou de fora** — sem
auditoria do TikTok ele só publica `SELF_ONLY` (privado) e exige a conta privada na hora
do post, o que não serve para crescer.

## Por que dá para fazer 100% local

O TikTok tem dois Login Kits com regras de redirect URI **diferentes**:

| | Login Kit **Web** | Login Kit **Desktop** |
|---|---|---|
| Esquema | só `https` | `https` **ou `http`** |
| Host | qualquer domínio | **só `localhost` ou `127.0.0.1`** |
| Porta | — | obrigatória, curinga `*` aceito |
| PKCE | opcional | **obrigatório** |

Exemplos válidos que a doc lista: `http://localhost:3455/callback/`,
`http://127.0.0.1:*/callback/`, `https://127.0.0.1:3455/callback/`.

O site já é servido pelo próprio worker em `http://127.0.0.1:8765` (`estudio.ps1:15`),
então o **Desktop** encaixa sem domínio público, sem túnel, sem Cloudflare — e **sem
reativar o Supabase**, que a `CLAUDE.md` marca como PAUSADO.

Redirect URI deste projeto: **`http://127.0.0.1:8765/tiktok/callback/`**

## O que você precisa fazer no portal (uma vez, à mão)

1. `developers.tiktok.com` → login → **Manage apps** → **Connect an app**.
2. Preencha os dados do app (nome, ícone, categoria, descrição). Vai pedir URL de
   termos de uso e de política de privacidade — pode ser qualquer página pública sua.
3. **Add products:** `Login Kit` **e** `Content Posting API`.
4. Em **Login Kit**, adicione a plataforma **Desktop** (não Web) e cadastre o redirect URI
   **`http://127.0.0.1:*/tiktok/callback/`** — com a porta curinga. O worker monta o
   endereço a partir da porta em que subiu de verdade (o `--port` existe), então cravar
   `8765` quebraria calado no dia em que a porta mudasse.
5. Em **Content Posting API**, **NÃO** ligue a configuração *Direct Post*. Sem ela o app
   usa a rota de inbox, que é o que queremos.
6. Escopos do app: `user.info.basic` (só para mostrar qual conta está conectada na tela) e
   `video.upload`.
7. **Sandbox settings** → **Create a sandbox** → **Target users** → **Add account** → faça
   login com a sua conta do TikTok. Até 10 contas suas; pode levar até 1h para aparecer.
   **Em Sandbox você não precisa submeter o app para review.**
8. Copie `client_key` e `client_secret`.

Cole os dois em `video-worker/.env.tiktok` (o `.gitignore:2` já ignora `.env.*`):

```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

**O `client_secret` nunca vai para o navegador** — quem fala com o TikTok é o worker.
Isso é a mesma regra de `ARQUITETURA.md:23`, aplicada ao worker local em vez da Edge Function.

## Contrato técnico

Tudo em **stdlib** (`urllib.request`, `hashlib`, `secrets`) — a regra de
`.claude/rules/estudio-video-worker.md` proíbe dependência nova.

### OAuth (PKCE — atenção à pegadinha)

`GET /tiktok/login` → gera `state` + `code_verifier`, guarda em memória, redireciona 302 para
`https://www.tiktok.com/v2/auth/authorize/` com
`client_key`, `scope=user.info.basic,video.upload`, `response_type=code`, `redirect_uri`,
`state`, `code_challenge`, `code_challenge_method=S256`.

> **Pegadinha:** o TikTok exige o `code_challenge` em **hex** do SHA256 do verifier
> (`hashlib.sha256(v).hexdigest()`), **não** o base64url do RFC 7636. Errar aqui dá erro
> genérico de autorização.

`GET /tiktok/callback/` → confere o `state`, troca `code` + `code_verifier` +
`client_secret` por token em `POST https://open.tiktokapis.com/v2/oauth/token/`
(`application/x-www-form-urlencoded`), grava em `video-worker/.tiktok-tokens.json` e
responde um HTML mínimo "conectado, pode fechar".

Token: `expires_in` 86400 (24h), `refresh_expires_in` 31536000 (365 dias). Refresh via
`grant_type=refresh_token` antes de cada uso quando faltar menos de ~5 min.

### Envio do vídeo

O arquivo está no disco do usuário, então é **FILE_UPLOAD** — a própria doc do TikTok manda
usar `PULL_FROM_URL` só quando a mídia já está num servidor com domínio verificado.

1. `POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/`
   com `source_info: {source: "FILE_UPLOAD", video_size, chunk_size, total_chunk_count}`
   → devolve `publish_id` e `upload_url`.
2. `PUT` no `upload_url` com `Content-Range: bytes X-Y/TOTAL` e `Content-Type: video/mp4`.
3. `POST /v2/post/publish/status/fetch/` com o `publish_id` para acompanhar.

**Regras de chunk medidas na doc:**
- `total_chunk_count` = `video_size // chunk_size` (arredonda para baixo).
- Cada chunk entre 5 MB e 64 MB; o **último pode passar** do `chunk_size` (até 128 MB) para
  absorver os bytes que sobram.
- Vídeo **< 5 MB vai inteiro**, com `chunk_size` igual ao tamanho total.
- Vídeo **> 64 MB obrigatoriamente em vários chunks**. Máximo 1000. Sequenciais.

Um corte de podcast vertical de ~60 s costuma ficar abaixo de 64 MB, então o caminho normal
é **um chunk só** — mas o código precisa dos dois ramos, e o teste precisa cobrir os dois
(BP-014: o ramo que quebra é sempre o que ninguém exercitou).

### Limites que viram mensagem na tela

- **6 requisições/min** por access token nas rotas de init; 30/min no status.
- Formato: MP4/WebM/MOV, H.264/H.265/VP8/VP9, 23–60 FPS, lado entre 360 e 4096 px.
- Duração: o TikTok recusa acima do que a conta permite (3 min para todos; 5 ou 10 para
  algumas). Vale checar antes de subir e falhar com frase clara em vez de erro cru.

## Rotas novas no worker

Seguem o despacho por dicionário de `serve.py:1197` e o erro JSON de `_error`
(`worker.WorkerError` → código + mensagem que o `video-ops.js` já sabe ler).

| Rota | Método | Para quê |
|---|---|---|
| `/tiktok/login` | GET | 302 para a tela de autorização do TikTok |
| `/tiktok/callback/` | GET | recebe o `code`, troca por token, grava |
| `/api/tiktok/status` | POST | `{connected, username}` para o selo na tela |
| `/api/tiktok/publish` | POST | `{clip}` → sobe o MP4, devolve `publish_id` |
| `/api/tiktok/publish-status` | POST | `{publish_id}` → estado do processamento |

As duas rotas `GET` exigem interceptar antes do estático: hoje `do_GET` não é sobrescrito e
`send_head` (`serve.py:1160`) trata tudo como arquivo.

Resolução do arquivo do clipe **reaproveita `_resolve_clip_file`** (`serve.py:1404`), que já
tem a guarda de travessia — não escrever resolução nova.

## Verificação

- `python -m pytest`/`py video-worker/test_serve.py` com os checks novos, e **atualizar a
  linha `Checks:` do `CLAUDE.md`** — o `provas.ps1` compara o total e falha se divergir.
- Cobrir os dois ramos de chunk (< 5 MB e > 64 MB) com bytes construídos, sem rede.
- Ponta a ponta: `.\estudio.ps1` → conectar → publicar um corte curto → o vídeo aparece nas
  notificações/rascunhos do app do TikTok.
