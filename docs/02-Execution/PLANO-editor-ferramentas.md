# Plano — editor do Estúdio em ferramentas (decisão do usuário, 2026-10-01)

Status: **entregue (2026-10-01).** Medidas finais e regras em `.claude/rules/estudio-ui.md` ("Editor em ferramentas").
Pedido: barra fixa de ferramentas entre o vídeo e o painel, tela que não rola, e só
ferramentas na tela (nada de explicação, dica, diagnóstico ou aviso). As decisões 1–7 do pedido
não se reabrem. Escopo: o que o `ytDetailHTML` desenha, a `.yt-analysis-note` (editor e
grade) e a nota da faixa de importação. Nada de servidor, Remotion, modelo ou persistência.

## Fase 0 — o que foi conferido
- `.\provas.ps1`: **2420**, zero falhas, linha do `CLAUDE.md` confere.
- Chrome headless (CDP), corte real `cand_muph58ku_1`, prints de base a 1366×768 e 1440×900.
  Medido: `#main` rola **2825 px em 704** (1366×768) e **2825 em 836** (1440×900); colunas
  680 + 504 px; palco 9:16 de 338×600 a 1440×900 (topo do palco em 350 px: o pé dele sai da
  janela). A coluna da direita tem 2495 px de altura.
- As cinco seções da entrega anterior (Capa, Música, Remover, Texto, Zoom) abrem sem
  exceção no console. Prévia × PNG/MP4 real **não** foi conferida (fora deste pedido).
- Achado, sem conserto: o player do editor **não** toca o `SRC.url` direto — `srcPreviewSync`
  recodifica o trecho (`/api/video-cut?preview=1`) e só então mostra o `<video>`. Medido:
  **mais de 2 minutos** para um corte de 53 s (com a suíte rodando ao lado); a 1366×768 o
  player não apareceu em 120 s. Enquanto isso o quadro diz "Preparando apenas o trecho
  selecionado…". O `estudio-ui.md` não descreve esse caminho (fala do `SRC.url`).

## Mapa final das ferramentas
Ordem da barra (radios nativos, `name="yt-tool-<id do corte>"`):

| Ferramenta | Conteúdo (construtores de hoje; muda o invólucro, não o miolo) |
|---|---|
| Corte | `ytTrimHTML` (sem `.yt-trim-note`) + `remocoesPanelHTML` + "Marcar trecho daqui" (`yt-manual`, mesmo handler; sai do `.yt-src-meta` só no editor) |
| Enquadrar | `reframeFieldHTML` (sem `.vop-reframe-aviso`) |
| Legenda | subabas **Texto** (`capPanelHTML`) · **Estilo** (estilos, Tamanho, combinações, "Escolher cada cor", contorno, caixa) · **Posição** (vertical, lateral, alinhamento, largura) · **Profundidade** (+ Ângulo) · **Avançado** (fonte, letras). "Voltar ao padrão" e "Ver o quadro real" no cabeçalho da ferramenta |
| Card | `cardStyleFieldHTML`; "Gerenciar cards" troca o painel por `cardsPanelHTML` + "Voltar" (dentro do painel, nunca abaixo) |
| Texto | `textosPanelHTML` |
| Zoom | `zoomsPanelHTML` |
| Música | `musicaPanelHTML` |
| Capa | `capaPanelHTML` |
| Análise | só com gancho, motivo, sinais ou fatores: os quatro como seção simples; o `.yt-factors-note` vira o título "Nota interna (só ordena a lista)" |

- Topo (`.yt-detail-top`): `← Todas as sugestões` · título (`class="yt-detail-title"`,
  `data-clip-field="topic"`, aria-label curto "Título do corte") · menu **Baixar ▾** com
  "Baixar vídeo editado" (`yt-render`), "Baixar trecho original" (`yt-fetch`) e "Editado, sem
  legenda" (`yt-render-limpo`), no padrão `ytDownloadHTML`/`YT.dlMenu` (Esc fecha). O
  `status.chip` sai; o rótulo do gatilho carrega o estado (`Renderizando…`,
  `Falhou · tentar de novo`, `Gerar de novo`).
- Esquerda (`.yt-detail-main`): só o player (palco, rádio Original | Como sai, barra própria).
  Sem fonte: a moldura + "Importar vídeo" + barra de progresso.
- Direita (`.yt-detail-side`): barra + painel (ordem main → side mantida por causa do
  `colunaEsquerda`).
- Estado: `YT_TOOL` e `LEG_ABA` no módulo (sessão, sem localStorage). Padrão `corte` na
  primeira abertura; depois, a última usada, inclusive em outro corte. Troca no `change` sem
  `render()`; visibilidade por CSS (`:has(input:checked)`), com a regra do radio escondido do
  `estudio-ui.md`. Os `*_ABERTA` (CAPA/MUS/REM/TXT/ZOOM) e os `<summary>` deles saem
  (conferido: só os cinco handlers perto da linha 7414 os usam). `LEG_MAIS` fica para os
  `<details>` internos ("Escolher cada cor", "Horários (avançado)").

## Regra de cada bolinha
Deriva do modelo e repinta no lugar nas escritas que não re-renderizam. Os nomes dos campos
serão reconferidos contra os validadores na Fase 2, antes de escrever.

| Ferramenta | Acende quando |
|---|---|
| Corte | `clip.boundary === 'manual'` ou `remocoesOf(...)` não vazio |
| Enquadrar | `reframeOf(clip) !== 'blur'` |
| Legenda | estilo ≠ padrão, ou `editOf(clip.edit).legenda` com alguma chave, ou `clip.capEdit` |
| Card | `clip.cardId` preenchido ou `titleCardStyle === 'nenhum'` |
| Texto / Zoom | `textosOf` / `zoomsOf` não vazio |
| Música | `edit.musica` presente |
| Capa | `clip.capaTikTok` presente |
| Análise | nunca (não é ajuste) |

## Inventário de textos
Feito por script sobre as 151 funções alcançáveis a partir do `ytDetailHTML` + `srcStripHTML`.

**REMOVER** — `.yt-analysis-note` (editor e grade; `YT.note`/`project.note` ficam no dado) ·
`.yt-trim-note` · `.yt-detail-boundary` · `.vop-leg-ass` · `.vop-warning` do editor
(`status.nota`, "Exportar está bloqueado", `sourceWarning`, "Importar está bloqueado") ·
`.yt-stage-note` · `.yt-stage-tag` · "Quadro parado…" / "O vídeo ainda não está no Estúdio…" ·
"Preparando apenas o trecho…" e "Prévia bloqueada: …" (a moldura fica, com `aria-busy`) ·
`.yt-imp-note` · `.vop-leg-prev-nota` (`legModoNota`) · `.vop-leg-state` (`legendaEstadoFrase`)
· `.vop-leg-nota` (`legGeoNota`, `legAnguloNota`, `legProfNota`) · `.vop-leg-dica` ·
`.vop-leg-still-msg` · `.vop-cap-note` (`capMessage`) · `.vop-cap-hint` · `.vop-cap-foot` ·
`.vop-card-state` (`cardPickState`) · `.vop-reframe-aviso` · `.vop-capa-resumo` · todas as
`.vop-capa-dica` (capa, música, remover, texto, zoom, limites) · `.vop-capa-aviso`
(`capaAviso`, `musicaAviso`, "faixa sumiu", `textoAvisos`, aviso do zoom) · frases do
`capaEstado` · `.vop-cards-help`, `.vop-cards-vazio`, `data-card-msg` · dicas dos campos do
card ("só aparece aqui", "vazio = sem linha de texto", "sem logo — até 512 KB…") · `title=` com
motivo ("Esta fala está num trecho removido…", "Arraste para mudar a posição", "Voltar ao
automático do estilo") · "Prévia aproximada" da capa · "Fundo aproximado" · aria-label do título
com explicação · todo `toast()` com o editor aberto (98 chamadas no arquivo; **uma** guarda no
`toast()`: `TAB === 'youtube' && YT.detail` → não mostra).

**FICA como nome** — títulos de ferramenta, seção e campo; rótulos de botão e radio ("Começa
em", "Marcar início", "Usar este quadro", "Gerar capa", "Importar do PC", "Ver o quadro real",
"Voltar ao padrão", "Original 16:9", "Como sai 9:16"…); guias de zona como rótulo curto
`aria-hidden` ("Botões do TikTok", "Texto do TikTok", "Recorte do perfil (3:4)", "Miolo seguro").

**FICA como valor** — tempos e duração (`0:53`), nomes de faixa e de card, "proporção N",
contagem "N/3", números dos sliders, "Automática" (era "Automática, dentro da imagem.") e
"Centro" (era "Centralizada."). Lista vazia não ganha frase ("Nenhum zoom." sai).

**VIRA ESTADO DO CONTROLE** — export / cru / sem legenda, "Ver o quadro real", "Gerar capa",
"Importar do PC" e prévia do trecho → `Falhou · tentar de novo` até o clique · entradas
recusadas (tempos do corte, horários, início da música, texto novo vazio, logo recusado, cota
cheia do card, remoção recusada) → `aria-invalid="true"` no controle até a próxima interação ·
capa desatualizada → o botão vira "Gerar de novo" · fala, texto ou zoom num trecho removido →
`data-removida` · `capSaveText`: "salvo" some; falha ao salvar vira `aria-invalid` no
cabeçalho do Texto (sem frase).

**ANÁLISE** — `.yt-detail-sobre` (gancho, motivo, sinais com "Mais reproduzidos") e
`ytFactorsHTML`. Na Fase 1 ficam onde estão; na Fase 2 vão para a ferramenta.

## Rótulo de falha por controle
| Controle | A falha aparece em |
|---|---|
| Baixar ▾ (editado / cru / sem legenda) | gatilho "Falhou · tentar de novo" |
| Ver o quadro real · Gerar capa · Importar do PC | o próprio botão, mesmo rótulo |
| Prévia do trecho (`src-preview-retry`) | botão na moldura, mesmo rótulo |
| Importar vídeo | "Tentar importar de novo" (já é assim) |
| Tempos, horários, início da faixa, texto novo, logo, campos do card, Marcar início/fim | `aria-invalid="true"` + contorno de perigo até a próxima interação |

## Checks
Reescrever na Fase 1: "a tela de detalhe diz DE ONDE vem a borda" → nenhuma frase de borda,
`boundary` intacto no dado · "e ele diz… tudo automatico" → nenhum `data-manual` e nenhuma
frase de estado · "o quadro real e oferecido…" → o botão existe e não há frase de
aproximação · "o download rapido avisa…" → o item existe, nenhum `.vop-leg-ass`, e
`ASS_NAO_REPRODUZ` continua no arquivo (33j2). Novos: nenhuma classe removida renderiza no
editor; `.yt-analysis-note` em lugar nenhum; nenhum toast com o editor aberto (e toast fora
dele continua); contratos presentes (`CAPTIONS_MSG`, `IMPORT_MSG`, `MUSICA_MSG`,
`MUSICA_IMPORT_MSG`, `backgroundMessage`, `ASS_NAO_REPRODUZ`).

Reescrever na Fase 2: título (no topo) · detector e decomposição (em Análise) · "texto e
aparência…" e "o essencial fica a vista…" (subabas). Novos: lista e ordem da barra (Análise só
com conteúdo) · um painel por ferramenta e `checked` = `YT_TOOL` · check que LÊ o
`video-ops.css` e acha a regra de visibilidade de cada ferramenta · trocar de ferramenta não
chama `render()` e mantém o mesmo `<video>` e o `currentTime` · `YT_TOOL`/`LEG_ABA` sobrevivem
ao re-render e a outro corte · menu e título no topo · um `<video>` · o `<audio>` da música
sobrevive à troca · `scrollTop` do painel sobrevive ao `render()` · biblioteca de cards dentro
do Card. Sabotagem numa CÓPIA temporária (só o painel ativo; troca chamando `render()`; regra
de visibilidade apagada): os checks novos têm de ficar vermelhos.

## CSS — cadeia de altura (Fase 2)
- Modo fixo = `@container hub (min-width: 800px)` **e** `@media (min-height: 600px)`.
- Escopo "editor aberto" por `:has(.yt-detail)`: `#main:has(#view-video-ops .yt-detail)` sem
  rolagem e com padding vertical menor; flex em coluna com `min-height: 0` de
  `#view-video-ops` → `#video-ops-root` → `.vop-body` → `.yt-hub` → `.yt-detail` (topo `auto`,
  grade `1fr`). Regras só no `video-ops.css`; se o shell do `index.html` pedir mais que uma
  regra escopada, paro e pergunto.
- Grade: `minmax(0,1fr) auto <painel>` (painel 380–420 px, barra ≈ 96 px). O sticky sai.
- Palco 9:16 pela altura real da coluna (`height: 100%` + `aspect-ratio: 9/16` +
  `max-width: 100%`, `container-type: size` mantido) no lugar do `--quadro-h`; anel, não borda.
- Só o corpo do painel rola (`overflow-y: auto; overscroll-behavior: contain`), como reserva.
  `renderKeepingScroll` passa a guardar o `scrollTop` do painel por ferramenta (BP-013).
- Barra: `:active { transform: scale(.97) }` 140 ms `var(--vop-ease-out)`; troca de painel
  instantânea; sem `transition: all`, sem glow; `prefers-reduced-motion` tira o scale.
- Empilhado (fora do modo fixo): vídeo primeiro, barra em faixa horizontal, a página pode
  rolar, sem overflow horizontal desde 360 px.

## Caminhos que ficam sem aviso por decisão
Mudar a borda descarta o exportado e a correção da legenda · cota cheia do navegador
(correção só na sessão) · faixa de música apagada da biblioteca (sai sem música) · início da
faixa além do fim · legenda indisponível, fora do trecho ou longa demais (sai sem legenda) ·
card apagado ou biblioteca vazia (sai sem card) · enquadramento que amplia demais a fonte (sai
mole) · legenda na faixa de fundo ou nas zonas do TikTok · palavra longa que trava a posição ·
texto junto do card de 4 s ou encostando na legenda · zoom ou texto inteiro num trecho removido
(só o `data-removida`) · o download rápido não leva música, profundidade etc. · falha de
export, still, capa ou importação de música sem o motivo · prévia do trecho levando minutos
sem frase.
