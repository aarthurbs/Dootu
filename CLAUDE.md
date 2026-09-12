# Contexto do Projeto
Plataforma client-side do vendedor (Vanilla JS, `index.html`, dados em `localStorage`): Painel do Empreendedor e Estúdio de Vídeos, mais widgets pessoais (placar NBA/Copa ao vivo). Módulos REMOVIDOS: **Amazon FBA** (2026-06-29), **Precificação**, **Inventário Amazon** e **Shooting Range** (2026-08-17), e **Prompts salvos**, **Planilha de Faturador**, **Radar** e **Fluxos** (2026-09-08) - ver Domínio do Negócio. O backend full-stack (Supabase/SP-API) está planejado, mas PAUSADO.

## Arquitetura alvo (ver ARQUITETURA.md)
- Frontend: site Vanilla JS atual (`index.html`) — NÃO reescrever; evoluir incrementalmente.
- Backend: Supabase (Postgres + Auth + Edge Functions + RLS).
- Integração: Amazon SP-API, acessada SOMENTE por Edge Functions (Deno). O navegador nunca fala com a Amazon.

## Regra de segurança inviolável
- Segredos SP-API/LWA (client_secret, refresh_token) e a `service_role` key NUNCA vão para o frontend nem para o banco acessível ao cliente. Só em env das Edge Functions / Supabase Vault.
- Toda tabela com RLS escopada por `user_id = auth.uid()`. `amazon_credentials` não tem policy de cliente (só service_role).

## Transição (importante)
- Os módulos vivos ainda usam `localStorage` (`pp_empreendedor_v1`, `pp_video_projects_v1`). Migração para Postgres é incremental e não pode quebrar o que já funciona.
- Não criar servidores Node próprios nem dependências npm no frontend; o backend é o Supabase.

# Onde estão as regras (leia antes de procurar)
Este arquivo guarda só o que vale para **todo** o projeto. O resto é carregado sob demanda:
- `.claude/rules/*.md` — regras ATIVAS por caminho, com `paths` no frontmatter. Carregam
  quando você toca o arquivo correspondente, não na partida.
- `docs/archive/HISTORICO-*.md` — trabalho CONCLUÍDO: decisões datadas, armadilhas MEDIDAS
  ("não re-descobrir"), revisões adversariais. **Não são importados de propósito** (import
  consome contexto de partida). Grep neles antes de mexer num número ou numa guarda.
- Backup íntegro do CLAUDE.md anterior (177.891 chars): `docs/archive/CLAUDE.md.backup-2026-09-04`.

| Vai mexer em | Regra ativa | Histórico |
|---|---|---|
| `video-worker/**` (FFmpeg, ASS, yt-dlp, rotas) | `.claude/rules/estudio-video-worker.md` | `HISTORICO-estudio-video.md` |
| `studio/**` (Remotion, preset, card) | `.claude/rules/estudio-remotion.md` | `HISTORICO-estudio-video.md` |
| `video-ops.js` / `.css` (tela do Estúdio) | `.claude/rules/estudio-ui.md` | `HISTORICO-estudio-video.md` |
| `baixador/**` (extensão + helper) | `.claude/rules/baixador.md` | `HISTORICO-estudio-video.md` |
| `cloud/**`, `web/**` (lançamento Fase 1) | `.claude/rules/lancamento-cloud.md` | `HISTORICO-lancamento-fase1.md` |
| `index.html`, `empreendedor.js` | `.claude/rules/modulos-index-html.md` | — |

# Domínio do Negócio (Multi-marketplace)
- **Módulos ATIVOS** (nenhum é código morto — BP-007): Central (home) · Painel do Empreendedor ·
  Estúdio de Vídeos · widgets pessoais (placar NBA/Copa). Detalhes de cada um nas regras por caminho.
- **Módulos REMOVIDOS — não recriar nem referenciar** (inventário completo em
  `docs/archive/HISTORICO-modulos-removidos.md`):
  - **Prompts salvos, Planilha de Faturador, Radar e Fluxos** (2026-09-08, decisão do usuário —
    simplificação do site antes da migração para o Obsidian). Não voltam. Tokens que saíram:
    - Prompts: `pp_prompts_v1` · `pp_projects_v1` · `#cards-grid` · `#toolbar` · `#empty-state` ·
      `#modal-overlay` · `#confirm-overlay` · `#prompt-form` · `#search` · `#btn-new` ·
      `.card*` · `.field` · `.tag-chip` · `.project-*` · `.s-item`/`.s-label`/`.s-section` ·
      `#projects-list` · `#categories-list` · `#tags-list`. Os 5 pilares do prompt saíram com ele.
    - Faturador: `#view-faturador` · `fat*` · `#fat-*` · `.fat-*` · `.fg-*` · `ensureXlsx` ·
      `xlsx-populate.min.js` · `fatAddGroupWithSkus` (o último chamador saiu junto).
    - Radar: `#view-radar` · `.radar-*` · `.ecom-*` · `.amz-inv-*` · `#count-radar` ·
      `ecommerce-news*.js` · `ai-news*.js` · `claude-radar*.js` · `radar-ecommerce.ps1` · `radar-ia.ps1`.
    - Fluxos: `#view-fluxos` · `#fluxos-root` · `.fx-*` · `pp_fluxos_v1` · `fluxos.js` ·
      `test-fluxos*.js` · `night-agent-prompt.md` · `plans/fluxos-n8n-backlog.md`.
    - **Sobrou de propósito:** `#toast` (usado por `supabase-client.js`) · `.world-seg*` e `.hub-*`
      (Central) · `scanner.py`/`sacanner-0.1.py` (independentes do fluxo-exemplo) ·
      `night-agent.ps1`/`register-night-agent.ps1` (runner genérico, hoje sem payload).
  - **Precificação** (2026-08-17): `Calc5` · `RATES` · `prc*` · `#prc-*` · `.plat-*` · `.pdv-*` ·
    `#view-precificacao` · `pricing_v1`. O modelo anterior (margem-alvo / "Bater concorrente")
    também não volta.
  - **Amazon FBA** (2026-06-29): `setupAmazon` · `view-amazon` · `amz_products_v1`.
  - **Inventário Amazon** (2026-08-17): `amazon-inventory.js` · `test-ponte.js` ·
    `#view-amazon-inventory` · `pp_amazon_inventory_v1` · `fatInvData` · `fatMissingSkus` ·
    `fatStagedSkus` · `fatRenderInvNotice` · `fatWeeklyDue` · `fatRenderWeekly` ·
    `fatRefreshInvBadge` · `#fat-inv-notice` · `pp_fat_autofill_v1`.
    **`fatAddGroupWithSkus` FICOU** (tem outro chamador). **CSS `.amz-inv-head` e
    `.amz-inv-kicker` FICARAM** — o Radar as reaproveita.
  - **Shooting Range** (2026-08-17): `SRCore` · `shootingRangeSetActive` · `pp_shooting_range_v1`.
    **`docs/shooting-range/` e `vendor/three.min.js` FICAM** — são insumo de plano não iniciado, não código morto.
- **Auditoria de performance 2026-06-30**: concluída e aplicada; virou BP-005 e BP-006.
  Registro em `docs/archive/HISTORICO-performance-2026-06-30.md`.

# Estúdio de Vídeos (regra de topo)
Cinco telas: `1 Vídeo` › `2 Cortes` › `3 Revisão`, mais `Central` e `YouTube`.
**Direção editorial (decisão do usuário):** cortes de podcast de negócios/empreendedorismo em
PT-BR — *conteúdo forte → corte certo → comunicação clara → edição discreta → autoridade*,
**nunca** "efeito, efeito, efeito". Proibido por escrito: meme, emoji, texto em movimento
constante, zoom agressivo, shake, música alta, cor neon, e **qualquer efeito disparado só
porque o tempo passou**.
**Direitos autorais (inviolável):** analisar metadados/legenda é livre; **baixar mídia passa
por portão de declaração explícita**, conferido duas vezes e válido por URL. Nunca remover o
portão. Nunca `--exec`, `--netrc-cmd`, cookies de navegador ou `aria2c` no yt-dlp.
**Dupla compressão do caminho YouTube — MEDIDA em 2026-09-08 e DESCARTADA.** O ENCODE 1 do
yt-dlp (`--force-keyframes-at-cuts`) é `libx264 crf=23 preset=medium` e custa **47,5 dB PSNR /
0,993 SSIM** contra o stream copy do mesmo trecho: praticamente transparente. `-crf 18` compra
+2,4 dB por **+78% de arquivo**. Decisão: **não mexer** — nem a opção B (tirar a flag) nem a C
(CRF menor). Não reabrir sem número novo. Medições em `docs/PLANO-3-dupla-compressao.md` §8,
inclusive a armadilha de alinhamento de quadro que vale 17 dB.
Precisa de `http://127.0.0.1:8765` (rode `estudio.ps1`).

## Validação do Estúdio — um comando só
**Rode `.\provas.ps1`.** Ele roda as nove suítes, soma, e **confere o total contra a linha
abaixo** (sai com erro se divergir — não some de cabeça, e não apague esta linha).
    - Checks — **rode `.\provas.ps1`**: `test_captions.py` (154) · `test_serve.py` (**338**) · `test_ytclip.py` (**234**) · `test_worker.py` (**118**) · `test_muapi.py` (**79**) · `test_helper.py` (**232**) · `studio/test-preset.mjs` (**366**) · `test-video-ops.js` (**96**) · `test-video-ops-dom.js` (**133**) — **1750 verificações nas nove, zero falhas**.
    - `test-video-ops-rec.js` existe e passa, mas **fica FORA do `provas.ps1`** — não é somado
      nem conferido por ele. Quem mexer na recomendação rode-o à mão: `node test-video-ops-rec.js`.

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
- **Causa:** O `CLAUDE.md` afirmava que o módulo Inventário fora removido, mas `amazon-inventory.js` continuava vivo e load-bearing (`#view-amazon-inventory`, roteamento em `setView`). Remover o `<script>` como "morto" teria quebrado a tela — pego em teste e revertido.
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
- **Causa (BUG-008):** `curso-expandir.ps1` (claude.exe -p headless) reescreve `curso-data.js`; uma execução cortou no meio da última aula e deixou JS inválido. `curso.js` tem guarda `if (!window.CURSO) return` e falhou em silêncio → aba CyberLab em branco. Arquivo de dados truncado é indistinguível de válido até o parser rodar.
- **Regra:** Toda automação (PowerShell/headless) que gera ou edita `.js`/dados deve validar sintaxe (`node --check <arquivo>`, e para globais um `node -e` que confirme o global) ANTES de dar a tarefa por concluída — e, quando não puder validar dentro do agente, uma guarda no runner deve registrar FALHA alta no log em vez de shipar o arquivo quebrado calado. A defesa primária é não gravar arquivo inválido; a guarda no consumidor (`window.CURSO`) é a última linha, não a primeira.

### BP-012: CSS injetado via `var CSS = \`…\`` deve ser atribuído ANTES de chamar o injetor (hoisting)
- **Causa (BUG-009):** Em `pratica.js`, `ensureCss()` (`style.textContent = CSS`) era chamado antes da linha `var CSS = \`…\``. A declaração `var` sobe por hoisting, mas a **atribuição** não — então `CSS` valia `undefined` na injeção e o `<style>` saía vazio. `node --check` passa (sintaxe ok); a aba renderiza crua só em runtime. Mesma armadilha existia na `cursos.js`.
- **Regra:** Em renderers que injetam CSS por `<style>`, defina o `var CSS`/const **acima** da chamada que o consome (ou chame o injetor no fim do IIFE, depois da atribuição). Verifique com simulação headless de DOM (stub de `document`/`localStorage`) que o `textContent` injetado é não-vazio — `node --check` não pega erro de ordem de runtime. Preferir CSS estático no `index.html` (como `curso.js`) quando não houver motivo pra injetar.

### BP-013: Re-render que troca `innerHTML` de um container rolável deve preservar a posição de rolagem
- **Causa (BUG-010):** Na aba Fluxos, excluir um card chamava `render()`, que reconstrói o `innerHTML` de `#fluxos-root` e recria o `.fx-canvas-wrap`. O zoom sobrevivia (var de módulo), mas `scrollLeft`/`scrollTop` nasciam em 0 → o canvas saltava para o começo do Fluxo, perdendo a região que o usuário olhava.
- **Regra:** Antes de um re-render que substitui o `innerHTML` de (ou acima de) um elemento com `overflow:auto`, capture `scrollLeft`/`scrollTop` do container rolável e restaure-os depois (helper como `renderKeepingScroll()` em `fluxos.js`). Vale para toda mutação que re-renderiza e não muda a extensão rolável (excluir/editar/duplicar). Exceção legítima: quando o conteúdo muda de contexto (trocar de quadro/board), resetar o scroll é o comportamento certo — aí NÃO preservar.

### BP-014: Identificador não declarado num ramo dependente de DADOS passa por `node --check` e pela suíte inteira
- **Causa (BUG-011):** `video-ops.js` usava `MAX_CANDIDATES` — nome que só existia em `video-worker/ytclip.py` — dentro de `Array.isArray(p.candidates) ? p.candidates.slice(0, MAX_CANDIDATES) : []`. Sintaxe válida, então `node --check` passou. O ternário curto-circuita, então quem nunca tinha analisado um vídeo jamais avaliava a referência e via o site normal. Quem tinha um projeto salvo com `candidates` perdia **o site inteiro**: `projectsSanitize` lança → `projectsLoad` lança → `init` morre no `DOMContentLoaded` → `#video-ops-root` fica vazio → **tela preta**, com nada além do erro no console. Relatado como "por que ele está ficando só com tela preta", e irreproduzível em perfil limpo — o que manda investigar o servidor, o cache e o CSS antes de olhar para o lugar certo. As 124 verificações do Estúdio passavam porque `projectsSanitize` **não era exportada**: nenhuma delas a chamava.
- **Regra:** Função que sanitiza, migra ou carrega dado PERSISTIDO (`localStorage`, sidecar, JSON salvo) tem de ser **exportada e chamada pelo teste com o dado construído**, e nos DOIS ramos — campo presente e campo ausente. Cobrir só o ramo vazio é cobrir o caminho de quem nunca usou a ferramenta, e o ramo que quebra é justamente o do usuário antigo. `node --check` prova sintaxe, não fiação (mesma raiz do "`in arquivo` só prova que alguém escreveu a palavra"), e "abriu na minha máquina" prova o perfil limpo, não o do usuário. **Corolário:** constante espelhada entre Python e JS (aqui, o teto de sugestões) precisa de check que compare os dois números — divergirem calados faz um lado descartar dado que o outro mandou.

---

## 5. Micro-interações e Polimento (Emil Kowalski)
- **SEMPRE invoque a skill `emil-design-eng` (Skill tool) ANTES de qualquer trabalho de UI/CSS/design** neste projeto — sem o usuário precisar pedir — e aplique o framework dela.
- Foque na percepção de velocidade do usuário e atrito zero.
- Use física baseada em molas (spring animations) em vez de transições lineares duras de CSS.
- Garanta a "interrompibilidade": se o usuário cancelar um clique ou gesto no meio, a animação deve reverter com fluidez natural.
- Princípios não-negociáveis: easing custom forte (nunca `ease-in` em UI), durações <300ms, `:active { transform: scale(.97) }` em tudo clicável, `transition` com propriedades específicas (nunca `transition: all`).
- **Sem "cara de IA":** proibido glow neon gratuito (`0 0 Npx` colorido), gradiente arco-íris e qualquer efeito sem função. Profundidade = sombra realista (offset + contida). Beleza é alavanca; detalhes invisíveis somam.
