# Contexto do Projeto
Plataforma client-side do vendedor (Vanilla JS, `index.html`, dados em `localStorage`): Prompts, Planilha de Faturador (SKU), Precificação multi-marketplace e **Inventário Amazon** (importa TXT tabulado da Amazon), mais widgets pessoais (placar NBA/Copa ao vivo). O módulo **Amazon FBA** (publicação de anúncio) foi removido em 2026-06-29 — o **Inventário Amazon** (`amazon-inventory.js`) segue ATIVO (ver Domínio do Negócio). O backend full-stack (Supabase/SP-API) está planejado, mas PAUSADO.

## Arquitetura alvo (ver ARQUITETURA.md)
- Frontend: site Vanilla JS atual (`index.html`) — NÃO reescrever; evoluir incrementalmente.
- Backend: Supabase (Postgres + Auth + Edge Functions + RLS).
- Integração: Amazon SP-API, acessada SOMENTE por Edge Functions (Deno). O navegador nunca fala com a Amazon.

## Regra de segurança inviolável
- Segredos SP-API/LWA (client_secret, refresh_token) e a `service_role` key NUNCA vão para o frontend nem para o banco acessível ao cliente. Só em env das Edge Functions / Supabase Vault.
- Toda tabela com RLS escopada por `user_id = auth.uid()`. `amazon_credentials` não tem policy de cliente (só service_role).

## Transição (importante)
- O módulo legado ainda usa `localStorage` (`pp_prompts_v1`, `pp_projects_v1`). Migração para Postgres é incremental e não pode quebrar o que já funciona.
- Não criar servidores Node próprios nem dependências npm no frontend; o backend é o Supabase.

# Domínio do Negócio (Multi-marketplace + Engenharia de Prompts)
- Operação: na Amazon a logística é FBA. **A precificação é multi-marketplace** (decisão do usuário, 2026-06-26): a Precificação tem **uma única ferramenta, "Multi-plataforma"** (`window.Calc5`), que compara a Margem de Contribuição em Mercado Livre Clássico/Premium, TikTok Shop, Amazon e Shopee. Removida a antiga regra "somente FBA / somente Amazon", que não vale mais para a precificação.
- **Modelo antigo de precificação removido (2026-06-26):** a Calculadora margem-alvo / "Bater concorrente" / "Ajuste %", a Configuração comissão/imposto e o histórico em `pricing_v1` foram apagados (JS, DOM e CSS). Não recriar nem referenciar `prc*`/`loadPricing`/`savePricing`/`pricing_v1` — só existe `Calc5`. A barra de abas tem um toggle "Ocultar/Mostrar opções" (`#prc-options-toggle` → recolhe `#prc-modes`).
- **Amazon FBA removido (2026-06-29):** a **Central Amazon FBA** (publicação de anúncio — caminhos `buybox`/`zero`, `amz_products_v1`) foi apagada (menu, seção, CSS, JS, arquivos). Não recriar nem referenciar `setupAmazon`/`view-amazon`/`amz_products_v1`.
- **Inventário Amazon — ATIVO, MANTER (decisão do usuário, 2026-06-30):** a versão *antiga* (`inventory.js`/`inventory-import.js`) foi apagada em 2026-06-29, **mas** o módulo **atual** `amazon-inventory.js` está vivo e é funcionalidade mantida — importa o TXT tabulado da Amazon e deixa ver/buscar os SKUs. **Aceita 2 relatórios, detectados pelo cabeçalho (2026-07-06):** "Gerenciar Inventário FBA" (6 colunas: `seller-sku`, `fulfillment-channel-sku`/FNSKU, `asin`, `condition-type`, `Warehouse-Condition-code`, `Quantity Available`) e "Relatório de todas as ofertas" com cabeçalho PT-BR (`sku-do-vendedor`, `asin 1`, `nome-do-item`, `descrição-do-item` — sem FNSKU/estoque: `qty=null` ≠ zero, a tabela troca FNSKU→Produto e esconde coluna/filtro de estoque). Check: `node test-ponte.js`. **Reescrito enxuto em 2026-06-30** (decisão do usuário): ~210 linhas, **sem alertas, sem histórico de imports, sem comparação, sem preço**; 1 snapshot compacto em `localStorage` (`pp_amazon_inventory_v1`, ~387KB p/ 6.601 SKUs) e tabela limitada por busca (teto `ROW_CAP`=200 — nunca renderiza tudo, por isso não pesa). Componentes: nav `data-view="amazon-inventory"`, seção `#view-amazon-inventory`, IDs `#amz-dropzone`/`#amz-search`/`#amz-filter`/`#amz-tbody`/`#amz-export`/`#count-amz-inventory`, roteamento em `setView`/`toolViews`. **NÃO tratar como código morto nem remover o `<script src="amazon-inventory.js">`.** É distinto do marketplace "Amazon" da Precificação (`RATES.amazon`/`amazonFrete` no `Calc5`), que é separado e legítimo. (Correção: textos anteriores que diziam "Inventário removido / não referenciar `amz*`/`view-inventario`" estavam desatualizados.)
- **Radar (E-commerce + IA) — FUNDIDOS numa aba só (decisão do usuário, 2026-07-14):** antes eram duas abas (`ecom-news` + `ia-news`); agora é **uma** nav `data-view="radar"` / `#view-radar` com um **seletor segmentado** (`.radar-seg`, botões `data-radar="ecom|ia"`) que alterna os painéis `#radar-panel-ecom` / `#radar-panel-ia` — **as infos NUNCA se misturam**, o usuário troca de feed. **Dados, agentes e renderers ficaram intactos:** `ecommerce-news-data.js`/`window.ECOM_NEWS` (sábado) e `ai-news-data.js`/`window.AI_NEWS` (diário à meia-noite); renderers `ecommerce-news.js`/`ai-news.js` continuam escrevendo nos MESMOS IDs `#ecom-*`/`#ia-*` (por isso não foram tocados). Nav badge = `#count-radar`, setado por um script inline curto no rodapé do `index.html` (conta os `.ecom-card` do feed ativo, roda após os renderers). `#count-ecom`/`#count-ai` deixaram de existir — os renderers têm guarda `if(count)`, então viram no-op. Atualização SEM runtime segue igual: tarefas do Agendador do Windows rodam `radar-ecommerce.ps1` (sáb) e `radar-ia.ps1` (diário) → `Codex.exe -p` headless. Site 100% estático (sem fetch/IA em runtime) — exceção de conteúdo externo autorizada (junto do placar ESPN).
- Prompts estruturados seguem os 5 pilares: 1. Papel, 2. Contexto, 3. Tarefa, 4. Formato, 5. Restrição.

- **Radar Claude & Loops — INTEGRADO (decisão do usuário, 2026-07-21):** terceiro feed separado dentro de `data-view="radar"`, acionado por `data-radar="claude"` e exibido em `#radar-panel-claude`. Dados estáticos em `claude-radar-data.js` (`window.CLAUDE_RADAR`) e renderer em `claude-radar.js`; contém novidades oficiais da Claude/Anthropic, skills e loops aplicáveis e estratégia experimental de mercado. Atualizações programadas: Claude/skills às 00:00 e 18:00; mercado às 04:00. Validar com `node --check claude-radar-data.js`, `node --check claude-radar.js` e `node test-claude-radar.js`. Não misturar esse conteúdo com os painéis E-commerce ou IA.

# Performance (Carregamento e Render) — auditoria 2026-06-30
Otimizações aplicadas (cirúrgicas, sem alterar regra de negócio; ~5.3 MB + 3 requests fora do caminho crítico inicial):
- **Imagens de fundo recomprimidas** (Pillow q80, dimensões preservadas, originais com backup): `assets/capa-bg.jpg` 2.0MB→187KB · `assets/capa-sidebar.jpg` 2.5MB→211KB · `assets/themes/brasil/{bg,sidebar}.jpg` reduzidas. Total dos fundos **5.4MB→0.7MB (−88%)**.
- **`xlsx-populate.min.js` (642KB) virou lazy-load:** removido o `<script>` síncrono; helper `ensureXlsx()` no topo do script inline injeta a lib sob demanda; `await ensureXlsx()` antes dos 3 usos (`fatLoadFile`, `fatWriteRecords`, `fatWriteGroupedRecords`). Só carrega ao usar o Faturador.
- **CSS `transition: all` (16×) → propriedades específicas** (`background-color, border-color, color, box-shadow, transform, opacity`), preservando `var(--ease)`/`var(--ease-spring)` (cumpre a regra Emil, §5).
- **`supabase-*.js` retirados do carregamento (backend PAUSADO):** os 3 `<script>` ficam comentados em `index.html` (~L2935) com a receita de reativação inline; **arquivos mantidos no repo**.
- **Mantido de propósito:** `backdrop-filter`/`blur` (visual "vidro premium"); arquivos órfãos **não carregados** (`Copa.js`, `CAPA-DE-FUNDO.png`, `copa-score.js`, `wizards-score.js`, `fba-shipments.js`) — removê-los não muda o load. **Reorg 2026-07-14:** os `.js` órfãos foram movidos p/ `arquivo/` e os docs (`ARQUITETURA.md`, `CONVERSAS.md`, `PROCESSO-FBA-ENVIOS.md`, `resumo-chat-cyberlab.md`) p/ `docs/`. Nada carregado/agendado saiu da raiz — site e radares intactos.

# Economia de Tokens e Contexto (Think in Code)
- Pare de agir como um processador de dados e atue estritamente como um gerador de código.
- NUNCA leia arquivos grandes para o contexto. Em vez disso, use ferramentas de sandbox (como bash ou `ctx_execute`) para criar e rodar scripts que analisem os dados e façam o output (`console.log`) apenas do resultado final.

# Diretrizes de Comportamento (Karpathy)
Siga rigorosamente estes princípios ao escrever código:

## 1. Pense antes de codar
- Não faça suposições e não esconda sua confusão.
- Declare suas premissas explicitamente. Se o pedido for ambíguo, pergunte ao usuário em vez de adivinhar.

## 2. Simplicidade primeiro
- Escreva o mínimo de código que resolva o problema. Nada de código especulativo.
- Se 200 linhas puderem ser resolvidas com 50 linhas, reescreva.

## 3. Mudanças Cirúrgicas
- Toque apenas no que for obrigatório para a tarefa.
- Limpe apenas a sua própria bagunça. Nunca tente "melhorar" ou refatorar códigos vizinhos que já estão funcionando.

## 4. Execução por Metas
- Transforme a instrução imperativa em um objetivo verificável com testes.
- Planeje brevemente, execute e verifique se funcionou antes de dar o resultado final como concluído.

## Bug Prevention Rules

### BP-001: Nunca usar `dblclick` em elementos cujo handler de `click` chama `render()`
- **Causa:** O primeiro clique dispara `render()`, que substitui o `innerHTML` do contêiner. O segundo clique cai sobre um novo nó DOM — o browser só dispara `dblclick` se ambos os cliques atingirem o **mesmo** elemento. O `dblclick` nunca dispara.
- **Regra:** Para ações de edição inline em listas dinâmicas, use sempre um botão explícito (ex: ✎) verificado no handler de `click` **antes** do handler que chama `render()`.

### BP-002: Nunca usar SheetJS (community) quando o requisito for preservar a planilha original
- **Causa:** A edição community do SheetJS não grava estilos, validações de dados nem formatação (são recursos pagos). Um round-trip `XLSX.read` → `XLSX.write` reconstrói o arquivo do zero e descarta esses elementos.
- **Regra:** Para editar um `.xlsx` preservando a estrutura original (estilos, fórmulas, validações), use `xlsx-populate` (edita o XML in-place) e altere **apenas** as células necessárias com `.value()`. Nunca reconstrua a planilha inteira.

### BP-003: Toda dedução embutida num valor monetário deve ser exibida no resultado
- **Causa:** Na Precificação, o frete de R$ 5 era aplicado corretamente no cálculo, mas não aparecia no resultado dos modos "Bater concorrente" e "Ajuste %" — o usuário reportou como bug ("não está colocando a taxa"). Dedução invisível é indistinguível de dedução ausente.
- **Regra:** Sempre que um valor exibido embute taxas/frete/descontos, o resultado deve listar explicitamente cada dedução aplicada (ex: "frete de R$ 5,00 embutido"). Nunca mostrar apenas o número final. **Corolário (BUG-003):** toda dedução **exibida** (ex: linha "Impostos" com DIFAL/PIS) deve também ser **aplicada** ao número que ela compõe (a M.C.). Exibir uma dedução sem subtraí-la é tão errado quanto subtrair sem exibir.

### BP-004: Toda divisão por um valor vindo de input do usuário deve guardar o denominador zero
- **Causa (BUG-004):** Na sub-aba Multi-plataforma, `mcPct = mc / valorReceber` com venda 0 produzia `-Infinity`, exibido como "-Infinity%". `pct()`/`brl()` não tratavam valores não-finitos.
- **Regra:** Antes de dividir por um campo editável, guarde o zero: `denominador ? num / denominador : 0`. Funções de formatação (`pct`, `brl`) devem tratar `NaN`/`Infinity` retornando 0.

### BP-005: Não carregar bibliotecas pesadas (>100KB) de forma síncrona no caminho crítico
- **Causa:** `xlsx-populate.min.js` (642KB) era um `<script>` síncrono no meio do `<body>`, bloqueando o parser e baixado em **toda** visita, embora só seja usado quando o usuário processa a planilha do Faturador.
- **Regra:** Bibliotecas grandes usadas apenas sob interação devem ser carregadas **sob demanda** (injeção de `<script>` via helper que retorna `Promise`, ex.: `ensureXlsx()`), com `await` antes do primeiro uso. Nunca síncrono no carregamento inicial.

### BP-006: Imagens devem ser comprimidas antes do commit (alvo prático <250KB)
- **Causa:** `capa-bg.jpg` (2.0MB) e `capa-sidebar.jpg` (2.5MB) eram fundos decorativos absurdamente sub-comprimidos (uma imagem de ~1900px deveria pesar ~200KB) — ~4.6MB no caminho crítico só de fundo.
- **Regra:** Imagens decorativas/de fundo: recomprimir (qualidade ~80, dimensão = tamanho de exibição). Nunca commitar JPG/PNG multi-MB. Fazer **backup do original** antes de recomprimir.

### BP-007: Antes de remover "código morto", confirmar que a UI ativa não o referencia
- **Causa:** O `AGENTS.md` afirmava que o módulo Inventário fora removido, mas `amazon-inventory.js` continuava vivo e load-bearing (`#view-amazon-inventory`, roteamento em `setView`). Remover o `<script>` como "morto" teria quebrado a tela — pego em teste e revertido.
- **Regra:** "Código morto" só é morto se nada ativo o referencia. Antes de remover `<script>`/arquivo: verificar (1) se a UI/roteamento ativo o usa e (2) se algum global que ele expõe é consumido. **A documentação pode estar desatualizada — a fonte da verdade é o código.**

### BP-008: Toda automação de UI deve ter estado visível em TODOS os casos — inclusive quando não age
- **Causa (BUG-005):** O autofill de CEST por NCM funcionava, mas era mudo em 3 de 4 estados: NCM ambíguo deixava as opções num `<datalist>` invisível até clicar no campo, NCM desconhecido e planilha sem índice não diziam nada. O usuário reportou como "não está aparecendo a opção de preencher" — automação silenciosa é indistinguível de automação quebrada (irmão do BP-003).
- **Regra:** Recurso automático (autofill, sugestão, detecção) deve comunicar visivelmente o que fez **e o que não fez**: preencheu → confirmação; tem opções → opções à vista (chips/botões, nunca só `datalist`); não achou → dizer por quê. Nenhum ramo termina sem feedback.

### BP-009: Ao gravar em planilha de terceiros, espelhar o TIPO e o estilo das linhas de dados existentes
- **Causa (BUG-006):** O Faturador gravava NCM/CEST como texto (valor cru do `<input>`), mas o template da Amazon guarda essas colunas como número — o Excel marcava a célula em vermelho ("Validação de formato") mesmo com o valor correto. E a linha inserida, por nascer abaixo da faixa formatada do template, perdia o estilo (ex.: custo sem `numberFormat`).
- **Regra:** Valor certo com tipo errado é dado errado para quem valida. Antes de gravar numa planilha alheia: (1) inspecionar como as linhas existentes guardam o dado (`t=s` texto vs número) e gravar igual; (2) linha nova copia o estilo por coluna de uma linha de dados real (`cell.style(props)` do xlsx-populate). Exceção: dígitos com zero à esquerda ficam texto (número perderia o zero).

### BP-010: Formatação/validação de XLSX também vive no extLst (x14) — auditar lá antes de concluir "não há regra"
- **Causa (BUG-007):** CF clássica, estilos (xf com herança/tema) e sharedStrings estavam limpos, mas o Excel pintava o CEST de vermelho. A regra morava em `extLst > ext > x14:conditionalFormattings` (com dxf inline), onde o Excel guarda CF moderna (ex.: fórmulas entre abas) — e o mesmo vale para `x14:dataValidations`. Agravante: templates de terceiros com faixas espatifadas por inserção de linha podem aplicar a regra de UMA coluna em OUTRA (a lista de "Atividade" caiu na coluna CEST).
- **Regra:** Ao investigar "por que a célula está com essa cara", a varredura deve cobrir TODAS as camadas: xf da célula (com herança xfId e cor de tema), CF clássica (avaliando o deslocamento relativo da âncora), **CF x14 no extLst**, DV clássica e **DV x14**, formato numérico com cor (`[Red]`) e rich-text do sharedStrings. E ao corrigir template alheio: remover/limpar SÓ o fragmento comprovadamente quebrado, preservando as regras legítimas (cirúrgico, idempotente, com try/catch que nunca derruba a gravação).

### BP-011: Arquivo de dados gerado/editado por agente headless deve passar por `node --check` antes de concluir
- **Causa (BUG-008):** `curso-expandir.ps1` (Codex.exe -p headless) reescreve `curso-data.js`; uma execução cortou no meio da última aula e deixou JS inválido. `curso.js` tem guarda `if (!window.CURSO) return` e falhou em silêncio → aba CyberLab em branco. Arquivo de dados truncado é indistinguível de válido até o parser rodar.
- **Regra:** Toda automação (PowerShell/headless) que gera ou edita `.js`/dados deve validar sintaxe (`node --check <arquivo>`, e para globais um `node -e` que confirme o global) ANTES de dar a tarefa por concluída — e, quando não puder validar dentro do agente, uma guarda no runner deve registrar FALHA alta no log em vez de shipar o arquivo quebrado calado. A defesa primária é não gravar arquivo inválido; a guarda no consumidor (`window.CURSO`) é a última linha, não a primeira.

### BP-013: Re-render que troca `innerHTML` de um container rolável deve preservar a posição de rolagem
- **Causa (BUG-010):** Na aba Fluxos, excluir um card chamava `render()`, que reconstrói o `innerHTML` de `#fluxos-root` e recria o `.fx-canvas-wrap`. O zoom sobrevivia (var de módulo), mas `scrollLeft`/`scrollTop` nasciam em 0 → o canvas saltava para o começo do Fluxo, perdendo a região que o usuário olhava.
- **Regra:** Antes de um re-render que substitui o `innerHTML` de (ou acima de) um elemento com `overflow:auto`, capture `scrollLeft`/`scrollTop` do container rolável e restaure-os depois (helper como `renderKeepingScroll()` em `fluxos.js`). Vale para toda mutação que re-renderiza e não muda a extensão rolável (excluir/editar/duplicar). Exceção legítima: quando o conteúdo muda de contexto (trocar de quadro/board), resetar o scroll é o comportamento certo — aí NÃO preservar.

---

## 5. Micro-interações e Polimento (Emil Kowalski)
- **SEMPRE invoque a skill `emil-design-eng` (Skill tool) ANTES de qualquer trabalho de UI/CSS/design** neste projeto — sem o usuário precisar pedir — e aplique o framework dela.
- Foque na percepção de velocidade do usuário e atrito zero.
- Use física baseada em molas (spring animations) em vez de transições lineares duras de CSS.
- Garanta a "interrompibilidade": se o usuário cancelar um clique ou gesto no meio, a animação deve reverter com fluidez natural.
- Princípios não-negociáveis: easing custom forte (nunca `ease-in` em UI), durações <300ms, `:active { transform: scale(.97) }` em tudo clicável, `transition` com propriedades específicas (nunca `transition: all`).
- **Sem "cara de IA":** proibido glow neon gratuito (`0 0 Npx` colorido), gradiente arco-íris e qualquer efeito sem função. Profundidade = sombra realista (offset + contida). Beleza é alavanca; detalhes invisíveis somam.
