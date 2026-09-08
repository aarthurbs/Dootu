# Arquitetura — Plataforma Seller Amazon FBA

Documento de decisão de arquitetura (ADR) + roadmap. Atualizado conforme o projeto evolui.

## Objetivo

Sair de um app 100% client-side e construir um sistema próprio do Arthur que **publica anúncios diretamente na Amazon (FBA)** via SP-API, sem depender do HUB atual. Evolução incremental, sem jogar fora o frontend existente.

## Decisões (Conversa 2 · 2026-06-17)

| Tema | Decisão |
|------|---------|
| Acesso SP-API | Já possui app SP-API registrada + seller autorizado |
| Ponto de partida | Fundação Supabase primeiro (DB + Auth + migração), site segue funcionando |
| Frontend | Manter o site vanilla JS atual como UI |
| Backend | Supabase (Postgres + Auth + Edge Functions + RLS) |

## Por que NÃO dá para publicar do client-side

As credenciais SP-API/LWA (client secret, refresh token) dariam controle total da conta Amazon. Em um app de navegador elas seriam **legíveis por qualquer pessoa** (DevTools, network). Portanto:

- O navegador **nunca** fala com a Amazon.
- Segredos vivem **só no backend** (Edge Function env / Supabase Vault), nunca no banco em texto puro acessível ao cliente, nunca no frontend.
- Toda chamada SP-API passa por uma Edge Function autenticada.

## Fluxo

```
[ Navegador / site atual ]
        │  supabase-js (anon key + sessão do usuário)
        ▼
[ Supabase ]
   ├─ Postgres (RLS por user_id)         ← produtos, prompts, jobs
   ├─ Auth                                ← login do usuário
   └─ Edge Functions (Deno, service_role) ← ÚNICO que tem os segredos
            │  LWA: refresh_token → access_token
            ▼
   [ Amazon SP-API ]
        ├─ Listings Items API  (criar/atualizar oferta e listagem)
        ├─ Product Type Definitions API (atributos obrigatórios da categoria)
        └─ (Feeds API como alternativa em lote)
```

### Pipeline de publicação (assíncrono)

1. Site cria registro em `publish_jobs` com `status='queued'`.
2. Edge Function `publish` pega o job, autentica via LWA, monta o payload e chama a SP-API.
3. Atualiza `status` (`submitting`→`submitted`→`accepted`/`error`) e guarda `response`.
4. Site faz polling/realtime e mostra o resultado.

### Dois caminhos (mesma lógica do módulo Amazon já criado)

- **Buy Box** (`type='buybox'`): cria **oferta** sobre um ASIN existente. Payload mínimo. Implementar **primeiro** (mais simples).
- **Do zero** (`type='zero'`): listagem completa — exige atributos obrigatórios da categoria (Product Type Definitions) e, frequentemente, permissão de marca / GTIN exemption. Implementar **depois**.

## Modelo de dados

Ver `supabase/migrations/0001_init.sql`. Resumo:

- `profiles` — usuário (1:1 auth.users).
- `projects`, `prompts` — espelham `pp_projects_v1` / `pp_prompts_v1`.
- `products` — catálogo (espelha `amz_products_v1`).
- `amazon_accounts` — metadados da conta (marketplace BR `A2Q3Y263D00KWC`).
- `amazon_credentials` — **segredos**, RLS sem policy (só service_role).
- `publish_jobs` — fila de publicação.

## Roadmap

- **Fase 0 — Pré-requisitos SP-API** ✅ (Arthur já tem app + seller autorizado). Pendente confirmar: roles de Listings liberadas, region/marketplace.
- **Fase 1 — Fundação backend (EM ANDAMENTO)**
  - [x] Schema + RLS (`0001_init.sql`)
  - [ ] Criar projeto Supabase e aplicar migration (Arthur — ver `SETUP-SUPABASE.md`)
  - [ ] Auth no frontend + camada de dados Supabase
  - [ ] Migrar dados do localStorage → Postgres (one-time import)
- **Fase 2 — Proxy SP-API**
  - [ ] Edge Function de auth LWA (token exchange + cache)
  - [ ] Edge Function `publish` com **mock** da SP-API (validar fluxo ponta a ponta)
- **Fase 3 — Publicação real**
  - [ ] Caminho Buy Box (oferta sobre ASIN)
  - [ ] Caminho do zero (Product Type Definitions + atributos + marca/GTIN)
  - [ ] Polling de status + tratamento de issues
- **Fase 4 — Hospedagem + hardening**
  - [ ] Deploy do frontend (estático)
  - [ ] Vault para segredos, logs, retries/fila, rate limiting da SP-API

## Riscos

- **Roles restritas da SP-API** podem bloquear `Listings` mesmo com app aprovada — confirmar antes da Fase 3.
- **Atributos por categoria** (do zero) são extensos e variam — exigem Product Type Definitions; não dá para hardcodar.
- **Rate limits** da SP-API — pipeline assíncrono com fila evita travar a UI.
- **Segredos** — disciplina absoluta: nunca no frontend/banco-cliente.

## Próximo passo lógico

Arthur cria o projeto Supabase e aplica a migration (`SETUP-SUPABASE.md`) e me passa **Project URL** + **anon key**. Com isso eu ligo o login e a camada de dados no site (Fase 1, restante).
