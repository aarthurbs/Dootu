# Desenho do Processo — Controle de Envios FBA (Amazon)

> **Status:** especificação de processo (sem implementação). **Granularidade:** Envio → Caixa → SKU.
> **Entrada:** manual (`localStorage`, chave `pp_fba_shipments_v1`, padrão `pp_*_v1`). **Data:** 2026-06-29.
>
> **Módulo NOVO de rastreio de envio** — distinto das antigas *Central Amazon FBA* (publicação de anúncio) e *Central de Inventário* (estoque), removidas em 2026-06-29. Não recriar nada delas.

### Ajustes aplicados nesta versão (vs. spec original)
- **Gate do EMBALADO** reescrito: comparar `Σ conteúdo das caixas` contra **`qtd_aprovada_amazon`** (fallback `qtd_separada` → `qtd_planejada`), não contra `qtd_enviada` (que é o próprio Σ caixas — comparação tautológica). Ver §3 e §4.4.
- **`RECEBIDO_COM_DIVERGENCIA`** incluído explicitamente no enum de status (antes só aparecia no diagrama).
- **Pendências da §10 resolvidas** com defaults (FC = texto; prazos = valores sugeridos; SKU = standalone — o Faturador não expõe catálogo).

---

## 1. Diagnóstico rápido

Hoje o controle de envio FBA é mental/planilha solta. O risco real não está em "criar o envio na Amazon" (a Seller Central já faz), e sim em **3 pontos cegos**:

1. **Separação × plano** — o que você separou bate com o que planejou? (erro de quantidade na origem)
2. **Despacho × rastreio** — cada caixa saiu, com transportadora e rastreio registrados? (caixa perdida sem rastro)
3. **Recebido × enviado** — a Amazon recebeu a mesma quantidade que você mandou? (divergência = dinheiro parado ou reembolso não cobrado)

O sistema precisa ser uma **máquina de estados com gates** (não deixa avançar com pendência) + **reconciliação por SKU** + **log de eventos**.

## 2. Objetivo

Saber, a qualquer momento, **em que fase cada envio está, o que falta fazer e onde há divergência** — do rascunho até o estoque conferido pela Amazon, com histórico auditável.

## 3. Máquina de estados

Pipeline principal (status do Envio). Cada transição só ocorre se o **gate** for satisfeito.

| # | Status | O que representa | Gate para avançar |
|---|--------|------------------|-------------------|
| 1 | `RASCUNHO` | Planejando: quais SKUs e quantidades | ≥1 SKU com `qtd_planejada > 0` |
| 2 | `SEPARACAO` | Separando os produtos fisicamente | `qtd_separada` preenchida em todos os SKUs |
| 3 | `CRIADO_AMAZON` | Plano de envio gerado na Seller Central | `shipmentId_amazon` + `fc_destino` preenchidos |
| 4 | `EMBALADO` | Caixas montadas, conteúdo definido, etiquetas | **Σ conteúdo das caixas = `qtd_aprovada_amazon`** (fallback separada→planejada); etiquetas FBA e de caixa marcadas |
| 5 | `EM_TRANSITO` | Caixas despachadas | Toda caixa com transportadora + rastreio + data de despacho |
| 6 | `ENTREGUE_FC` | Caixas chegaram ao centro logístico | `data_entrega_fc` registrada |
| 7 | `EM_CONFERENCIA` | Amazon recebendo/conferindo (check-in parcial) | `data_conferencia_inicio` registrada |
| 8 | `RECEBIDO` | Conferência final concluída e reconciliada | `qtd_recebida` preenchida em todos os SKUs |

**Estados laterais** (fora da linha reta):

- `RECEBIDO_COM_DIVERGENCIA` — fechamento quando `qtd_recebida ≠ qtd_enviada`. Não bloqueia fechar, mas não vira `RECEBIDO` "limpo" até o caso ser resolvido.
- `PENDENCIA_DIVERGENCIA` — flag ativável a partir do passo 6 quando há divergência detectada; visível no painel.
- `CANCELADO` — encerramento sem conclusão (Amazon recusou, desistência). Permitido a partir de qualquer status; exige `motivo_cancelamento`.

**Regra de transição:** avançar **1 passo por vez**. Voltar status é permitido (correção), mas **gera evento no histórico com motivo**.

```
RASCUNHO → SEPARACAO → CRIADO_AMAZON → EMBALADO → EM_TRANSITO → ENTREGUE_FC → EM_CONFERENCIA → RECEBIDO
                                                                                       └→ RECEBIDO_COM_DIVERGENCIA
(qualquer status) → CANCELADO
```

## 4. Checklist por etapa (anti-erro)

Cada etapa tem um checklist que o gate verifica.

**4.1 RASCUNHO** — SKUs com qtd planejada; (opcional) objetivo do envio.
**4.2 SEPARAÇÃO** — qtd separada conferida SKU a SKU; alerta se `qtd_separada ≠ qtd_planejada` (registrar motivo).
**4.3 CRIADO NA AMAZON** — `shipmentId` colado; FC de destino; qtd aprovada conferida (Amazon pode cortar/dividir).
**4.4 EMBALADO** — caixas 1..N com dimensões e peso; conteúdo de cada caixa (SKU+qtd); **Σ caixas = `qtd_aprovada_amazon`** (reconciliação interna); etiqueta FBA (item) impressa; etiqueta de caixa (box label) impressa.
**4.5 EM TRÂNSITO** — transportadora por caixa; rastreio por caixa; data de despacho; data prevista de entrega.
**4.6 ENTREGUE NO FC** — data de entrega no centro (todas as caixas).
**4.7 EM CONFERÊNCIA** — data de início; acompanhar recebimento parcial (Amazon credita aos poucos).
**4.8 RECEBIDO** — qtd recebida por SKU; divergência calculada; se ≠ 0, abrir caso/reconciliação antes de fechar limpo.

## 5. Modelo de dados (3 níveis)

Chave única: `pp_fba_shipments_v1` (array de envios; caixas e itens **aninhados** no envio).

### 5.1 Envio (Shipment)

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| `id` | string | sim | auto (`env_<timestamp>`) |
| `nome` | string | sim | apelido legível ("Reposição Junho – kits") |
| `status` | enum | sim | ver §3 |
| `shipmentId_amazon` | string | passo 3 | ex: `FBA15ABC…` |
| `fc_destino` | string | passo 3 | centro logístico (ex: `GRU1`) |
| `tipo_envio` | enum | não | `SPD` (caixas avulsas) / `LTL` (paletizado) |
| `data_rascunho` | date | sim | criação |
| `data_criado_amazon` | date | passo 3 | |
| `data_despacho` | date | passo 5 | |
| `data_prevista_entrega` | date | passo 5 | base dos alertas de atraso |
| `data_entrega_fc` | date | passo 6 | |
| `data_conferencia_inicio` | date | passo 7 | |
| `data_conferencia_fim` | date | passo 8 | |
| `motivo_cancelamento` | string | se cancelado | |
| `observacoes` | string | não | |

**Derivados** (calculados, não digitados): `total_skus`, `un_planejadas` (Σ qtd_planejada), `un_enviadas` (Σ conteúdo das caixas), `un_recebidas` (Σ qtd_recebida), `divergencia_total` (un_recebidas − un_enviadas).

### 5.2 Caixa (Box) — lista dentro do envio

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| `numero` | int | sim | 1..N dentro do envio |
| `dim_cm` | {c,l,a} | passo 4 | dimensões |
| `peso_kg` | number | passo 4 | |
| `transportadora` | string | passo 5 | |
| `rastreio` | string | passo 5 | código de rastreamento |
| `etiqueta_fba_ok` | bool | passo 4 | etiqueta de item impressa |
| `etiqueta_caixa_ok` | bool | passo 4 | box label impressa |
| `status_caixa` | enum | sim | montada / despachada / entregue |
| `conteudo` | lista | passo 4 | `[{sku, qtd}]` |

### 5.3 Item por SKU (linha do envio)

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| `sku` | string | sim | |
| `descricao` | string | não | título curto |
| `fnsku` | string | não | identificador FBA |
| `qtd_planejada` | int | passo 1 | |
| `qtd_separada` | int | passo 2 | |
| `qtd_aprovada_amazon` | int | passo 3 | Amazon pode reduzir |
| `qtd_enviada` | int | passo 4 | **= Σ deste SKU nas caixas (derivado)** |
| `qtd_recebida` | int | passo 8 | conferência Amazon (manual) |
| `divergencia` | int | — | `qtd_recebida − qtd_enviada` (derivado) |
| `status_recon` | enum | — | ok / faltando / sobra / em_conferencia |
| `validade_lote` | string | não | se produto com validade |

> **Invariante crítico:** para cada SKU, `qtd_enviada = Σ` daquele SKU em todas as caixas. O sistema **calcula** (nunca deixa digitar) e **bloqueia o avanço** se não fechar.

## 6. Alertas

Painel "Atenção" no topo do módulo listando envios com alerta ativo.

### 6.1 Alertas de tempo (SLA) — *prazos = defaults, ajustáveis em constantes*

| Condição | Severidade | Mensagem |
|----------|-----------|----------|
| `RASCUNHO` parado > 7 dias | baixa | "Envio em rascunho há X dias" |
| `CRIADO_AMAZON` sem despacho > 7 dias | média | "Plano criado e não despachado — janela da Amazon pode expirar" |
| `EM_TRANSITO` passou da `data_prevista_entrega` | alta | "Entrega atrasada — verificar rastreio" |
| `ENTREGUE_FC` sem conferência > 3 dias úteis | média | "Entregue mas Amazon ainda não iniciou conferência" |
| `EM_CONFERENCIA` aberta > 14 dias | alta | "Conferência longa — abrir caso na Amazon" |

### 6.2 Alertas de consistência / divergência

| Condição | Severidade | Mensagem |
|----------|-----------|----------|
| `qtd_separada < qtd_planejada` | média | "Separação incompleta no SKU X" |
| `qtd_aprovada_amazon < qtd_planejada` | média | "Amazon reduziu a quantidade do SKU X" |
| Σ conteúdo caixas ≠ `qtd_aprovada_amazon` | **alta (bloqueia)** | "Conteúdo das caixas não fecha com o aprovado" |
| Caixa sem rastreio ao despachar | **alta (bloqueia)** | "Caixa N sem código de rastreio" |
| Etiqueta não marcada antes de despachar | **média (bloqueia)** | "Etiqueta pendente na caixa N" |
| `divergencia ≠ 0` no recebimento | alta | "SKU X: recebido difere do enviado (Δ)" |

> Severidade **"bloqueia"** = o gate impede a transição até resolver.

## 7. Histórico (log de eventos por envio)

Cada envio guarda um array `historico` **append-only** (nunca editar/apagar — só adicionar).

```js
{
  ts: "2026-06-29T14:03:00",
  tipo: "DESPACHOU",
  de_status: "EMBALADO",
  para_status: "EM_TRANSITO",
  descricao: "3 caixas despachadas via Correios",
  dados: { caixas: [1,2,3] }
}
```

Tipos mínimos: `CRIOU_RASCUNHO`, `EDITOU_SKU`, `SEPAROU`, `CRIOU_NA_AMAZON`, `GEROU_CAIXA`, `IMPRIMIU_ETIQUETA`, `DESPACHOU`, `REGISTROU_RASTREIO`, `MARCOU_ENTREGUE`, `INICIOU_CONFERENCIA`, `REGISTROU_RECEBIMENTO`, `REGISTROU_DIVERGENCIA`, `ABRIU_CASO`, `VOLTOU_STATUS`, `FECHOU`, `CANCELOU`.

> Toda mudança de status e toda divergência **obrigatoriamente** geram evento.

## 8. Painel (visão geral)

- **Lista de envios**: nome, status (badge colorida por fase), FC, un. enviadas/recebidas, Δ divergência, ícone de alerta.
- **Filtros**: por status e por "com alerta".
- **Indicadores no topo**: nº de envios ativos, em trânsito, em conferência, com divergência aberta.
- **Ao abrir um envio**: linha do tempo das 8 etapas (concluída/atual/pendente) + checklist da etapa atual + caixas + tabela de reconciliação por SKU + histórico.

## 9. Critérios de conclusão ("pronto")

1. Nenhum envio avança com checklist/gate pendente.
2. Para todo envio, responder em <5s: em que fase está e o que falta.
3. Toda divergência recebido × enviado fica visível e registrada (não some no fechamento).
4. Histórico completo de cada envio (quem/quando/o quê).
5. Total enviado sempre fecha com a soma das caixas (invariante §5.3).

## 10. Pendências — RESOLVIDAS (defaults, ajustáveis)

- **FCs (centros):** ainda **sem lista fixa** → começa como **campo de texto** (`fc_destino`). Vira `<select>` quando o usuário mandar a lista de FCs que usa.
- **Prazos dos alertas (§6.1):** usar os **valores sugeridos** como defaults, em **constantes no topo do módulo** (fáceis de editar).
- **Origem do SKU:** **standalone** — o módulo **Planilha de Faturador NÃO mantém catálogo** de SKU reutilizável (só preenche um XLSX enviado; chaves em uso: `pp_prompts_v1`, `pp_projects_v1`, `calcPresets`). SKU/descrição digitados no módulo, com **autocomplete** a partir dos envios anteriores. Reavaliar se um dia existir um cadastro de produtos.
- **Implementação:** módulo Vanilla JS novo em `index.html`, chave `pp_fba_shipments_v1`, seguindo o padrão dos módulos atuais (IIFE, `window.*`, CSS escopado no tema vigente). UI passa pela skill `emil-design-eng` antes de qualquer CSS.

## 11. Plano de implementação (fases)

Cada fase é **verificável isoladamente** (lógica pura testada em sandbox antes de ligar na UI). A skill `emil-design-eng` é invocada **antes** de qualquer trabalho de UI/CSS (F6, e os controles de F2+).

| Fase | Entrega | Verificação |
|------|---------|-------------|
| **F1 — Dados + estados** | Modelo 3 níveis, enum de status, store `pp_fba_shipments_v1` (load/save/migração), campos derivados, invariante §5.3. Camada de dados pura (`window.FBA`). | Sandbox: criar envio, add SKU/caixa, derivados batem; invariante calcula. |
| **F2 — Transições + gates + checklist** | Máquina de estados: avançar 1 passo (valida gate da §3), voltar com motivo, checklist por etapa (§4). Gera evento em toda transição. | Sandbox: tentar avançar com pendência = bloqueia; avançar válido = ok; voltar gera evento. |
| **F3 — Caixas + reconciliação por SKU** | CRUD de caixas, conteúdo por caixa, `qtd_enviada = Σ caixas` (derivado, bloqueia se não fechar com aprovado), tabela de reconciliação (Δ por SKU, `status_recon`). | Sandbox: somas e Δ corretos; gate EMBALADO bloqueia quando Σ ≠ aprovado. |
| **F4 — Alertas** | Motor de alertas de tempo (§6.1) + consistência (§6.2), com severidade e flag "bloqueia". Painel "Atenção". | Sandbox: cenários disparam os alertas certos; "bloqueia" trava o gate. |
| **F5 — Histórico** | Log append-only por envio; auto-evento em toda mudança de status e divergência; tipos da §7. | Sandbox: sequência de ações gera o log esperado, imutável. |
| **F6 — Painel + timeline (UI)** | Nav-item + `#view-fba-envios`; lista (badges/filtros/indicadores) + detalhe (timeline 8 etapas, checklist atual, caixas, reconciliação, histórico). CSS no tema vigente. | Visual no app; gates e alertas refletidos na tela; `prefers-reduced-motion`. |

**Ordem:** F1→F2→F3→F4→F5 são lógica (testáveis sem UI); F6 monta a interface por cima. Cada fase entra como um bloco isolado no `index.html` (não toca nos módulos existentes).
