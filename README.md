# Dootu

Aplicativo web Vanilla JS 100% client-side. Todos os dados são salvos offline no `localStorage`.

## Ferramentas

- **Central** — a home do site: cards que abrem cada ferramenta, com a barra segmentada do header (`Central` / `Empreender`) filtrando a sidebar e os blocos de cards.
- **Painel do Empreendedor** — painel de controle dos processos do negócio: 6 "trilhos" (Identidade da marca, Radar de mercado, Laboratório de conteúdo, Rede de perfis, Funil de clientes, Lucro real), cada um com etapas (checklist) das quais o `status` (a fazer/fazendo/feito) e o `progresso %` são derivados; cabeçalho "Meta 90 dias" (dias decorridos/restantes + contador Clientes 0/10) e histórico por trilho. Vanilla JS estático (`empreendedor.js`), dados em `localStorage` (`pp_empreendedor_v1`), sem IA/backend.
- **Estúdio de Vídeos** — do vídeo longo ao MP4 pronto para postar (`video-ops.js`, worker local em `video-worker/`). Precisa de `http://127.0.0.1:8765` — rode `estudio.ps1`.
- _**Removidos em 2026-06-29** (decisão do usuário): **Central Amazon FBA** (`amz_products_v1`) e **Central de Inventário** (`inventory.js`/`inventory-import.js`)._
- _**Removidos em 2026-08-17**: **Precificação** (`window.Calc5`, `pricing_v1`), **Inventário Amazon** (`amazon-inventory.js`) e **Shooting Range** (`SRCore`)._
- _**Removidos em 2026-09-08** (simplificação antes da migração para o Obsidian): **Prompts salvos** (`pp_prompts_v1`/`pp_projects_v1`, a área de trabalho que era a home, a sidebar de Projects/Categories/Tags, o `#search` e os modais), **Planilha de Faturador** (`fat*`, `xlsx-populate.min.js`), **Radar** (3 feeds — `ecommerce-news*`, `ai-news*`, `claude-radar*` e os agentes `radar-*.ps1`) e **Fluxos** (`fluxos.js`, `pp_fluxos_v1`, `.fx-*`). O histórico de bugs mais abaixo é registro do que existiu e fica como está._

As seções de histórico abaixo são **registro do que já aconteceu** e citam módulos que não existem
mais. Elas ficam como estão de propósito — não são descrição do site atual.

## Esportes ao vivo & NBA

Um **placar único** no header (`#match-score`, controlado por `score-bar.js`), dados **públicos da ESPN** (sem chave, sem backend — exceção autorizada). Mostra só o jogo ativo e **alterna** quando há mais de um ao vivo; a cada troca o **site inteiro re-tematiza** (cores + imagens) conforme o time daquele jogo.

- **Placar único** (`score-bar.js` → `#match-score`) — consulta NBA (Wizards, `basketball/nba`) e Copa (`soccer/fifa.world`) juntas. Prioridade: jogo(s) ao vivo > próximo agendado. Com 2 jogos ao vivo, alterna a cada 14s (crossfade com blur, mostrando a crista/bandeira do time). Substitui os antigos `wizards-score.js`/`copa-score.js` (mantidos no disco, sem uso).
- **Tema dinâmico** — jogo NBA ao vivo → tema **Wizards** (vermelho/navy); jogo da Copa ao vivo → tema **Brasil** (verde/amarelo, `<html data-theme="brasil">`). Cores e imagens vêm de variáveis (`--team-*`, `--img-bg/sidebar/logo`); a troca usa um véu de transição estilo broadcast (`#theme-veil`) que mascara a troca de imagem. Sem jogo ao vivo, mantém o tema Wizards (padrão). Teste: `msThemeTest('brasil')` / `msThemeTest('wizards')` no console.
- **Round Start** (`period-intro.js`) — overlay cinematográfico ("COMEÇOU"/"AO VIVO") na virada de período/tempo, com **logo/bandeira** do time (fallback local → ESPN → só nome). Teste: `wizPeriodIntroTest(2)` (NBA) e `wizPeriodIntroTestCopa()` (Copa).
- **Times da NBA + "torcer por 2 times"** (`nba-teams.js` → `window.NBA`, botão `#nba-fav` no header) — catálogo dos 30 times; escolhe **1 do Leste e 1 do Oeste**, persiste em `localStorage` (`nba_fav_v1`).

### Pastas de assets (imagens)
- `assets/nba/` — logos dos 30 times. Nome do arquivo = **sigla minúscula** (`was.png`, `lal.png`…). Ver `assets/nba/README.md`.
- `assets/flags/` — bandeiras das seleções da Copa. Nome do arquivo = **sigla FIFA minúscula de 3 letras** (`bra.png`, `arg.png`…). Ver `assets/flags/README.md`.
- Logo/bandeira ausente nunca quebra o layout: cai em fallback (monograma colorido / bandeira da ESPN / só o nome).
- `assets/themes/brasil/` — fundo/sidebar/logo do **tema Brasil** (`bg.jpg`, `sidebar.jpg`, `logo.png`), baixados do **Wikimedia Commons** (licença livre; atribuição em `CREDITS.txt`). O tema Wizards usa `assets/capa-bg.jpg` / `capa-sidebar.jpg` / `favicon.png` (referenciados pelas vars `--img-*`).

### `Copa.js` (app de torneio — bundle externo)
Bundle React/Vite compilado de um app de "Copa" (chaveamento de torneio: fases, times Brasil/Usee/Weesu/NØR, login com código de admin). **Não** é código-fonte deste site e ainda não está referenciado no `index.html`. Os **dados pessoais embutidos foram removidos** (2026-06-29): os 77 participantes tiveram o **nome anonimizado** ("Participante NN") e o **CPF zerado**; os nomes de time/fase foram preservados. Bundle revalidado (`node --check`). Não reintroduzir PII.

## Histórico de atualizações do Radar

Refreshes do `ecommerce-news-data.js` (aba Radar E-commerce). Executado pelo agente headless (`radar-ecommerce.ps1`) aos sábados ou sob demanda.

### 2026-07-03 · refresh
- 9 notícias no total (7 → 9), 3 fontes novas: Shopee (E-Commerce Brasil), Mercado Livre nova estrutura de frete (TecnoSpeed), TikTok Shop 46x criadores (Eletrolar Show). Prime Day Global atualizado com resultado consolidado de US$ 26,4 bi (About Amazon). Fontes de MP 1.357/2026 e Amazon FBA EUA trocadas por links oficiais (Senado, Selling Partners).
- Destaques do ciclo: Prime Day Brasil EM CURSO (1-7/07), reformulação de tarifas de Shopee (28/02) e Mercado Livre (02/03) forçando recálculo de margem por SKU, e MP 1.357/2026 ainda pendente de conversão em lei.
- Events: 3 datas confirmadas dentro dos próximos 60 dias (Prime Day BR até 07/07, Fórum E-Commerce Brasil 28-30/07, Dia dos Pais 09/08).
- `node --check ecommerce-news-data.js` passou. Sem bugs encontrados.

## Registro de bugs

Histórico de bugs encontrados e corrigidos. Formato: **ID · sintoma · causa · correção · prevenção · status**.

### BUG-001 · 2026-06-05
- **Sintoma:** Na ferramenta "Planilha da Amazon", a planilha gerada para download perdia validações de dados (dropdowns) e formatação do arquivo original.
- **Causa:** A versão community do SheetJS não grava estilos/validações ao salvar (recurso pago). O round-trip `XLSX.read` → `XLSX.write` reconstruía o arquivo descartando esses elementos.
- **Correção:** Motor XLSX migrado de SheetJS para `xlsx-populate`, que edita o XML original in-place e altera apenas as células escritas (coluna C).
- **Prevenção:** Regra BP-002 no `CLAUDE.md`.
- **Status:** Corrigido. Verificado em sandbox — fórmulas, estilos e abas preservados; SKUs gravados na coluna C abaixo do cabeçalho detectado.

### BUG-002 · 2026-06-10
- **Sintoma:** Na aba "Precificação", resultados abaixo de R$ 100 pareciam não aplicar a taxa de entrega de R$ 5.
- **Causa:** O motor de cálculo aplicava o frete corretamente (custo 50 → R$ 74,32 = (50+5)/0,74), mas os resultados dos modos "Bater concorrente" e "Ajuste %" não exibiam o frete embutido — dedução invisível parece dedução ausente.
- **Correção:** Todo resultado agora mostra explicitamente "frete de R$ 5,00 embutido (venda abaixo de R$ 100)" ou "frete grátis (venda ≥ R$ 100)" (`prcFreteInfo`). Nenhuma fórmula foi alterada.
- **Prevenção:** Regra BP-003 no `CLAUDE.md`.
- **Status:** Corrigido. Verificado em headless Chrome — matriz de custos abaixo de R$ 100 com frete embutido no preço e visível no resultado.

### BUG-003 · 2026-06-26
- **Sintoma:** Na nova sub-aba "Multi-plataforma" (importada do arquivo CALCULADORA 5.0), ao editar **DIFAL** ou **PIS/COFINS** em "Ajustar taxas", a linha "Impostos" do card passava a incluí-los, mas a Margem de Contribuição (M.C.) não mudava — margem superestimada.
- **Causa:** A fórmula era `M.C. = valorReceber − custo − frete − tarifa − icms`, somando só o ICMS; DIFAL e PIS eram calculados e exibidos em "Impostos" mas nunca subtraídos da M.C. Passava despercebido porque os dois vêm zerados por padrão.
- **Correção:** A M.C. agora subtrai também DIFAL e PIS nas 5 plataformas (`− difal − pis`). Detectado **antes da integração** na análise do arquivo; corrigido durante a integração.
- **Prevenção:** Regra BP-003 no `CLAUDE.md` (dedução embutida num valor deve refletir no resultado) — estendida: toda dedução exibida deve também ser aplicada ao número que ela compõe.
- **Status:** Corrigido. Verificado em sandbox (teste isolado): com DIFAL 5% + PIS 3% sobre venda R$ 100, a M.C. deixa de ficar em R$ 34 (errado) e passa a R$ 26,20.

### BUG-004 · 2026-06-26
- **Sintoma:** Na sub-aba "Multi-plataforma", com Valor de Venda = 0 (e rebate 0), a margem percentual dos cards aparecia como "-Infinity%".
- **Causa:** `mcPct = mc / valorReceber` com `valorReceber = 0` → divisão por zero; `pct()` não tratava valor não-finito.
- **Correção:** `mcPct = valorReceber ? mc / valorReceber : 0` nas 5 plataformas.
- **Prevenção:** Regra BP-004 no `CLAUDE.md`.
- **Status:** Corrigido na integração. Verificado em sandbox (DOM stub): `init()`+`calc()` rodam sem lançar; Amazon (custo 54,80 / venda 96 / rebate 5,30) → M.C. R$ 11,74 e 5 cards renderizados.

### BUG-005 · 2026-07-02
- **Sintoma:** Ao digitar o NCM num grupo do Faturador, "não aparece a opção de preencher" o CEST (reporte do usuário).
- **Causa:** O motor estava correto (verificado com a lib real + planilha real: NCM único preenche, ambíguo popula o datalist) — mas 3 dos 4 estados eram **invisíveis**: NCM ambíguo escondia as opções num `<datalist>` que só aparece clicando no campo CEST (~53% dos SKUs estão sob NCMs ambíguos); NCM inexistente na planilha não dizia nada; planilha sem índice não avisava. Comportamento silencioso é indistinguível de quebrado (mesmo princípio do BUG-002).
- **Correção:** `fatAutofillFromNcm` agora mostra um hint sob o campo CEST em todos os estados: único → "✓ CEST preenchido pela planilha"; ambíguo → chips clicáveis com os CESTs conhecidos (clicar preenche); NCM novo → "ainda não existe na planilha"; sem planilha → "carregue a planilha". Nenhuma regra de preenchimento mudou.
- **Prevenção:** Regra BP-008 no `CLAUDE.md`.
- **Status:** Corrigido. Motor verificado em Node com `xlsx-populate` + planilha real (37 NCMs indexados; 64041100→2803800 preenche; 64029990→2 opções; 99999999→sem hit); sintaxe do script inline validada.

### BUG-006 · 2026-07-02
- **Sintoma:** Na planilha gerada pelo Faturador, o NCM/CEST da linha nova (SKU inserido) aparecia em **vermelho** com aviso "Validação de formato" no Excel; a linha também nascia sem o formato das demais (custo sem casas decimais fixas) e sem o "Ok" na coluna A.
- **Causa:** O site gravava NCM (col. E) e CEST (col. L) como **texto** (valor vindo do `<input>`), mas o template da Amazon guarda essas colunas como **número** — comparação empírica: linhas pretas = `t=n` (número), linha vermelha = `t=s` (texto), com estilo idêntico. Além disso, a linha inserida cai **abaixo da faixa formatada** do template (as regras de formatação/validação da Amazon terminam na última linha emitida), então não herdava estilo nenhum (perdia p.ex. o `numberFormat` do custo).
- **Correção:** Em `fatWriteGroupedRecords`: NCM/CEST só-dígitos gravados como número (mantém texto se houver zero à esquerda, que número perderia); linha inserida copia o estilo por coluna (C/D/E/F/L/P) da última linha de dados real; coluna A recebe "Ok" com estilo "Bom" do Excel (fundo `C6EFCE`, fonte `006100`, centralizado).
- **Prevenção:** Regra BP-009 no `CLAUDE.md`.
- **Status:** Corrigido. Verificado em Node com `xlsx-populate` + planilha real: 9/9 asserts (E/L numéricos, A="Ok" verde, `numberFormat` do custo copiado ("0.00"), linha vizinha intocada, 4 abas preservadas).

### BUG-007 · 2026-07-03
- **Sintoma:** Mesmo após o BUG-006, o CEST das linhas novas continuava **vermelho** no Excel, com tooltip de validação errado ("escolha: Distribuidor, Fabricante ou Importador" — que nem é regra de CEST); o upload na Amazon funcionava normalmente.
- **Causa:** O template da Amazon tem formatação condicional **moderna no `extLst` (namespace x14)** — invisível para quem só olha a CF clássica, os estilos das células e as validações principais (por isso o BUG-006 não a encontrou). A regra da lista de "Atividade secundária" (`'Validação de dados'!G3:G5` = Distribuidor/Importador/Fabricante) teve suas faixas espatifadas por inserções de linha e fragmentos caíram nas colunas **B e L (CEST)** das linhas de append (`L2867:L3527`, `B2867:B3527`, `M2695`) — todo CEST novo era comparado com "Distribuidor/Fabricante/Importador" e ficava vermelho (dxf inline `FFC00000`). A validação de dados x14 da atividade carregava os mesmos fragmentos no sqref (daí o tooltip/dropdown errados).
- **Correção:** `fatStripBrokenCf(sheet)` no motor de gravação: remove os 3 blocos x14 de CF da atividade aplicados fora da coluna G e limpa as faixas fora de G do sqref da validação x14 da atividade (atualizando o atributo `count`). Idempotente; `try/catch` garante que nunca derruba a gravação. Regras legítimas (coluna G, CEST 7 dígitos, ExTipi, Origem) e as 196 CFs clássicas ficam intactas.
- **Prevenção:** Regra BP-010 no `CLAUDE.md`.
- **Status:** Corrigido. Verificado em Node com `xlsx-populate` + planilha real: 10/10 asserts (x14 CF 14→11; `L2867`/`B2867`/`M2695` ausentes do extLst; DV da atividade só com faixas G; CFs clássicas e dados intactos; 4 abas preservadas).

### BUG-008 · 2026-07-15
- **Sintoma:** Ao abrir a aba **CyberLab** (`data-view="curso"`), a tela ficava em branco / "querendo carregar" — o conteúdo do curso não montava.
- **Causa:** `curso-data.js` estava **truncado** (erro de sintaxe `Unexpected end of input`, linha 469). A última aula do módulo Projeto final (`mpfa2`, "Escrever o relatório") foi cortada no meio da geração pelo `curso-expandir.ps1` (agente headless), sem fechar `pontos`/`recursos`/checkpoint nem as arrays/objeto. JS inválido → `window.CURSO` nunca era definido → `curso.js` batia na guarda `if (!root || !window.CURSO) return;` e saía calado, deixando `#curso-root` vazio (falha silenciosa, irmã do BP-008).
- **Correção:** Completei a aula `mpfa2` (pontos, prática, recursos) e o checkpoint do módulo Projeto final, fechando arrays/objeto no padrão das demais aulas. Guarda pós-execução no `curso-expandir.ps1`: `node --check curso-data.js` após a geração, com FALHA alta no log se não parsear.
- **Prevenção:** Regra BP-011 no `CLAUDE.md`.
- **Status:** Corrigido. `node --check curso-data.js` passa; `window.CURSO` com 10 módulos, todos com checkpoint.

### BUG-009 · 2026-07-23
- **Sintoma:** A aba nova **Praticando** (`data-view="pratica"`) renderizava **sem estilo nenhum** — botões crus do navegador, opções inline, texto solto sobre a imagem de fundo. O conteúdo aparecia, mas "cru".
- **Causa:** Em `pratica.js`, `ensureCss()` (que faz `style.textContent = CSS`) era chamado **antes** da linha `var CSS = \`…\``. Por hoisting, a *declaração* de `CSS` sobe mas a *atribuição* não — então no momento da injeção `CSS` valia `undefined`, e o `<style>` saía vazio. `node --check` passava (sintaxe válida); o bug só aparecia em runtime. A mesma armadilha existia na finada `cursos.js`.
- **Correção:** Movi `var CSS = \`…\`;` para **antes** de `ensureCss()`/`build()`. Provado com simulação headless de DOM: o `<style>` injetado passou de vazio para 12 KB (`.prt-card`/`.prt-opt` presentes). Aproveitei pra reformular o design (cards com profundidade, molas, veredito animado, `prefers-reduced-motion`).
- **Prevenção:** Regra BP-012 no `CLAUDE.md`.
- **Status:** Corrigido. `node --check pratica.js` passa; harness headless confirma CSS não-vazio.

### BUG-010 · 2026-07-28
- **Sintoma:** Na aba **Fluxos**, ao excluir um card pelo `X` (ou por Delete), o card sumia mas o canvas **saltava de volta para o começo do Fluxo** — o usuário perdia a região que estava olhando.
- **Causa:** `deleteNodeFrom()` → `save()` → `render()`, e `render()` reconstrói o `innerHTML` do `#fluxos-root`, recriando o `.fx-canvas-wrap`. O zoom sobrevive (é var de módulo, reaplicada por `applyZoom()`), mas `scrollLeft`/`scrollTop` do container rolável nascem em 0 — a posição de rolagem era perdida.
- **Correção:** Novo `renderKeepingScroll()` em `fluxos.js` que captura `scrollLeft`/`scrollTop` do `.fx-canvas-wrap` **antes** de `render()` e os restaura **depois**. Usado nos dois caminhos de exclusão (`node-del` e tecla Delete) e ao trocar a atividade de um card. Como o canvas tem tamanho fixo (`CANVAS_W/H`), a faixa de rolagem é idêntica após o re-render e a tela fica parada.
- **Prevenção:** Regra BP-013 no `CLAUDE.md`.
- **Status:** Corrigido. `node --check fluxos.js` + `node test-fluxos.js`/`test-fluxos-dom.js`/`test-fluxos-exec.js` passam.
