# Registro de Conversas — Plataforma de Prompts / Amazon FBA

> Este arquivo registra tudo o que conversamos e todo o entendimento do projeto.
> Atualizado a cada conversa. Entrada mais recente no topo.

---

## 2026-06-17 — Conversa 2: virada para full-stack (Supabase + SP-API)

### Pedido do Arthur
Ir além do gerador de prompt: **conectar a API da Amazon (SP-API) e publicar anúncios direto do site**. Adicionar banco de dados (Supabase) e hospedagem. Construir o "seu próprio sistema Amazon", do jeito dele, evoluindo a partir disso.

### Diagnóstico dado
- Publicar do client-side é inseguro (segredos vazariam) → backend obrigatório. Supabase Edge Functions resolve.
- O gargalo é o acesso SP-API (conta dev, app, autorização, roles), não o código.
- A direção contraria o CLAUDE.md atual ("100% client-side") → constituição atualizada.

### Decisões (respondidas)
1. **Acesso SP-API:** já tem app SP-API registrada + seller autorizado.
2. **Ponto de partida:** fundação Supabase primeiro (DB + Auth + migração), site segue funcionando.
3. **Arquitetura:** manter frontend atual + Supabase como backend.

### Entregue nesta conversa (Fase 1 — núcleo)
- `supabase/migrations/0001_init.sql` — schema + RLS: `profiles`, `projects`, `prompts`, `products`, `amazon_accounts`, `amazon_credentials` (segredos, só service_role), `publish_jobs` (fila de publicação).
- `ARQUITETURA.md` — ADR, diagrama de fluxo, pipeline de publicação, roadmap Fase 0–4, riscos.
- `SETUP-SUPABASE.md` — runbook para criar o projeto, aplicar a migration e pegar as chaves.
- `CLAUDE.md` — atualizado para a arquitetura full-stack, mantendo princípios de engenharia e a regra de segurança dos segredos.

### Próximo passo (bloqueia o resto)
Arthur cria o projeto Supabase (região São Paulo), aplica a migration e envia **Project URL + anon key**. Com isso: login no site + camada de dados Supabase + importação do localStorage → Postgres. Depois: Edge Functions (auth LWA + publish mock → real).

### Pendências
- Confirmar roles de **Listings** liberadas na app SP-API (gating da Fase 3).
- Confirmar region/marketplace (BR = `A2Q3Y263D00KWC`).
- Migrar segredos para Supabase Vault antes de produção.

---

## 2026-06-18 — Conversa 3: chaves do Supabase + auth no frontend

### O que aconteceu
- Arthur enviou Project URL, anon key e (por engano) a **service_role key em texto puro** no chat.
- **AÇÃO DE SEGURANÇA:** orientado a **rotacionar a service_role key** imediatamente (ela ignora RLS). Não foi armazenada em lugar nenhum.
- Sandbox sem rede (DNS bloqueado) → verificação da conexão acontece no navegador do Arthur.

### Entregue
- `supabase-config.js` — só dados públicos (URL + anon + marketplace BR).
- `supabase-client.js` — mini-cliente Vanilla (fetch puro, sem SDK/CDN): signUp/signIn/signOut, sessão em `sb_session_v1`, helper `SB.rest()` autenticado (para sync nas próximas fases), widget de conta + modal de login injetados. Login **opcional e não-quebra** o app.
- `index.html` — incluídos os dois scripts antes de `</body>` (única alteração).
- Validação: `node --check` OK nos dois arquivos.

### Como o Arthur testa
1. Confirmar (no painel) que a migration criou as 7 tabelas.
2. Rotacionar a service_role key.
3. Abrir o site → botão "Entrar na nuvem" (canto sup. direito) → criar conta / entrar. Confirmar e-mail se o Supabase pedir.

### Próximo passo
Com login funcionando: implementar a **sincronização** localStorage → Postgres (produtos e prompts via `SB.rest()`), depois Fase 2 (Edge Functions: auth LWA + publish mock).

### Pendência de segurança
- [ ] Rotacionar service_role key (Arthur).
- [ ] Migrar segredos SP-API para Vault antes de produção.

---

## 2026-06-18 — Conversa 4: sincronização localStorage → Postgres

### Contexto
Login na nuvem confirmado funcionando pelo Arthur.

### Entregue
- `supabase/migrations/0002_sync.sql` — adiciona `client_ref` + índice único `(user_id, client_ref)` (alvo do ON CONFLICT, upsert idempotente) e `default user_id = auth.uid()` nas tabelas. **Arthur precisa rodar esta migration.**
- `supabase-sync.js` — `SB.syncUp()`: lê `pp_projects_v1` / `pp_prompts_v1` / `amz_products_v1` e faz upsert em `projects`/`products`/`prompts` via PostgREST, mapeando `projectId` local → uuid do projeto na nuvem. Feedback com contagem.
- `supabase-client.js` — botão "⟳ Sincronizar" no widget de conta (quando logado).
- `index.html` — incluído `supabase-sync.js`.
- Validação: `node --check` OK no sync.js; client.js íntegro (199 linhas) confirmado via Read (mount do shell estava defasado, falso negativo).

### Como o Arthur testa
1. Rodar `0002_sync.sql` no SQL Editor.
2. No site logado: cadastrar/ter alguns produtos e prompts → clicar "⟳ Sincronizar".
3. Conferir no Table Editor que `products` e `prompts` receberam as linhas.

### Próximo passo
Fase 2 — Edge Functions: auth LWA (token exchange) + função `publish` com mock da SP-API, lendo de `publish_jobs`. Depois, SP-API real (Buy Box primeiro).

### Pendências de segurança (reforço)
- [ ] Rotacionar service_role key (Arthur).
- [ ] Migrar segredos SP-API para Vault antes de produção.

---

## 2026-06-18 — Conversa 5: Central de Inventário (manual, cloud-backed)

### Pedido
Central para administrar os produtos do seller / controlar inventário. "De improviso por enquanto" = manual agora.

### Decisões
1. **Fonte do estoque:** manual agora, SP-API (FBA Inventory API) depois — com gancho pronto.
2. **Campos:** quantidades FBA (disponível, a caminho, reservado) + preço e custo.

### O que pedi ao Arthur fornecer
- Central manual: nada além de confirmar campos (feito).
- Para sync real depois: credenciais LWA (`client_id`, `client_secret`, `refresh_token`) como **secrets das Edge Functions** + confirmar role FBA Inventory. Nunca no chat/frontend.

### Entregue
- `supabase/migrations/0003_inventory.sql` — colunas em `products`: `qty_available`, `qty_inbound`, `qty_reserved`, `price`, `cost`, `last_synced_at`. **Arthur precisa rodar.**
- `inventory.js` — aba **Inventário** (Supabase-backed): tabela por SKU, edição inline (PATCH no blur, sem perder foco), add/remover (remover com confirm — BP-001), resumo (SKUs, disponível, a caminho, valor em estoque a custo, valor de venda). Requer login; mostra CTA de login se deslogado.
- `index.html` — nav-item `data-view="inventario"`, `section#view-inventario`, `activateView` (+inventario chamando `window.invRender()`), include de `inventory.js`. Confirmado via Read (mount do shell atrasa em edits).
- Validação: `node --check` OK no inventory.js.

### Como o Arthur testa
1. Rodar `0003_inventory.sql`.
2. Logar → aba **Inventário** → adicionar produto / editar quantidades, preço, custo (salva ao sair do campo) → conferir no Table Editor.
3. Produtos do módulo Amazon + ⟳ Sincronizar também aparecem aqui.

### Próximo passo
Fase 2 — Edge Functions: auth LWA + `publish` (mock → real) e a função de **pull do FBA Inventory** que preenche os mesmos campos automaticamente (`last_synced_at`).

### Pendências de segurança (reforço)
- [ ] Rotacionar service_role key (Arthur).
- [ ] Segredos SP-API só via Vault/secrets das Edge Functions.

---

## 2026-06-18 — Conversa 6: importar planilha de estoque

### Contexto
Conta é da empresa; Arthur precisa pedir autorização do chefe para a SP-API. Enquanto isso, quer **subir a planilha do estoque atual** para popular a central e demonstrar a ideia.

### Entregue
- `inventory-import.js` (arquivo novo) — botão **⬆ Importar planilha** na aba Inventário. Lê `.xlsx` (reusa `XlsxPopulate`) e `.csv` (parser próprio, detecta delimitador `,`/`;`). Auto-detecta colunas (SKU, Produto, Disponível, A caminho, Reservado, Preço, Custo) com **mapeamento editável**, preview da contagem, e **upsert em lote** (chunks de 500) no Supabase chaveado por `sku` (`client_ref='sku:'+sku`) — re-importar atualiza, não duplica. Parser numérico trata pt-BR (`1.234,56`, `R$ 80,00`).
- `inventory.js` — hook `window.invAfterRender()` ao fim de `render()` para injetar a UI do importador (re-injeta a cada render).
- `index.html` — include de `inventory-import.js`.
- Validação: `node --check` OK; parser numérico testado.
- Sem migration nova (usa as colunas da 0003).

### Como o Arthur testa
1. (Se ainda não fez) rodar `0003_inventory.sql`.
2. Logado → aba Inventário → **⬆ Importar planilha** → escolher o arquivo → conferir o mapeamento das colunas → **Importar**. A tabela e o resumo se preenchem.

### Próximo passo
Quando o chefe autorizar a SP-API: Fase 2 (Edge Functions: auth LWA + pull FBA Inventory substituindo o import manual; e publish).

---

## Entendimento geral do projeto (estável)

- App web **100% client-side, Vanilla JS**, arquivo único `index.html`. Sem Node, sem npm, sem servidor. Dados no `localStorage`.
- Não é só "Plataforma de Prompts". É um painel com módulos:
  - **Prompts** — biblioteca de prompts (5 pilares: Papel, Contexto, Tarefa, Formato, Restrição). Storage `pp_prompts_v1` / `pp_projects_v1`.
  - **Planilha de Faturador** — edição fiscal de `.xlsx` (NCM, CEST, origem, custo, SKU) via `xlsx-populate` (preserva o arquivo original — ver BP-002).
  - **Precificação** — cálculo de preço de venda Amazon (margem, comissão, imposto, frete fixo R$ 5 abaixo de R$ 100). Storage `pricing_v1`.
  - **Amazon FBA** *(novo — ver abaixo)*.
- Navegação por `data-view` → `activateView(view)`; views de ferramenta escondem `toolbar/cards-grid/empty-state` e mostram a `section` correspondente.

### Contexto do negócio Amazon (do Arthur)
- Operação trabalha **só com FBA** — **sem cross-docking**.
- Existe um sistema de **HUB** para administrar produtos, mas **não é usado na Amazon** (suspeita de integração mal configurada com a API). Objetivo: fazer ao menos a **publicação de anúncio** pela própria plataforma.
- Dois caminhos de publicação:
  1. **Catálogo já existe (Buy Box):** ASIN já está na Amazon. Não publica do zero — só disputa o catálogo / buy box. **Caminho fácil.**
  2. **Publicar do zero:** listagem completa. Mais difícil e **trava muito na permissão de marca**.

---

## 2026-06-17 — Conversa 1: criação do módulo Amazon FBA

### Pedido do Arthur
Aprimorar o site para o fluxo Amazon, mantendo tudo o que já existe, e criar este `.md` de registro.

### Decisões (respondidas via perguntas)
1. **Função do módulo:** os três combinados → intake do produto → classificação do caminho → geração do prompt de anúncio.
2. **Classificação:** dois caminhos — *Catálogo já existe (buy box)* e *Publicar do zero*. Permissão de marca entra como **flag dentro do caminho "do zero"** (não como status de topo).
3. **Integração:** **aba separada nova** (`data-view="amazon"`), sem alterar Faturador/Precificação/Prompts.

### O que foi implementado (`index.html`)
- **Nav:** novo item `data-view="amazon"` ("Amazon FBA") com contador `#count-amazon`.
- **Section `#view-amazon`** com o fluxo em 3 blocos:
  1. **Caminho** — toggle Buy Box / Do zero. "Do zero" revela select de **permissão de marca** (não exigida / pendente / em análise / liberada). "Buy Box" revela campo de **ASIN existente**.
  2. **Cadastro** — título*, SKU, marca*, EAN/GTIN, categoria, público, características* (uma por linha), palavras-chave.
  3. **Checklist dinâmico** — muda conforme o caminho; sinaliza FBA, campos obrigatórios e o risco de permissão de marca.
- **Geração de prompt** pelos 5 pilares, adaptado ao caminho (buy box = vincular oferta, não criar ASIN; do zero = listagem completa + aviso de marca). Botões: copiar e **salvar na biblioteca de prompts** (reusa `pp_prompts_v1`, categoria "Amazon FBA").
- **Produtos salvos** — lista com badges (Buy Box / Do zero / marca pendente), editar/excluir.
- **Storage:** `amz_products_v1`.
- **Regras seguidas:** BP-001 (ações de lista por botão explícito, antes do re-render); mudança cirúrgica (não tocou nos módulos existentes); CSS reaproveitando variáveis/classes atuais.

### Pendências / próximos passos lógicos
- **Validação real com a API da Amazon (SP-API):** o módulo hoje gera prompt e organiza o fluxo — não publica de fato. Próximo passo seria integrar a publicação (exige backend/credenciais; conflita com a regra "100% client-side" — decidir arquitetura).
- Verificar se vale puxar **custo do Faturador** e **preço da Precificação** automaticamente para dentro do fluxo Amazon (hoje é aba isolada por decisão do Arthur).
- Confirmar limites/diretrizes de conteúdo atuais da Amazon BR (título, bullets, search terms) — valores usados são os de referência comuns.
