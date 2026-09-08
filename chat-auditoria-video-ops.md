# Conversa — Auditoria e evolução do módulo de vídeo

> Transcrição convertida de `pasted-text.txt`. O conteúdo original foi preservado; apenas os marcadores de participante e a estrutura Markdown foram adicionados.

## Turno 1 — Assistente

```text
I'll audit the actual code before proposing anything. Starting with structure and file sizes.

  Ran 2 shell commands

The working directory is nearly empty. Let me locate the actual project.

  Ran 2 shell commands

Found it: the real project is C:\Users\anali\Downloads\seller-arthur (my cwd seller-arthru-main (1) contains only .claude). Auditing there.

  Called plugin:context-mode:context-mode, ran 2 shell commands


⚠️ Antes do relatório: dois fatos de ambiente

1. O Claude Code não está na raiz do Seller-Arthur. Meu diretório é C:\Users\anali\Downloads\seller-arthru-main (1), que contém só .claude/. O repositório real é C:\Users\anali\Downloads\seller-arthur\ — auditei lá. Existem ainda seller-arthru-main\seller-arthru-main\ (extração aninhada) e seller-arthru-main (1)\, ambos sem os arquivos do projeto.
2. A skill emil-design-eng não está instalada nesta sessão. Skills disponíveis: ponytail, karpathy-guidelines, artifact-design, dataviz, context-mode. Segui DESIGN.md + AGENTS.md §5 (Emil Kowalski) como substituto, e as regras de movimento já testadas em test-video-ops.js.

Estado: localStorage['pp_video_ops_v1'], SCHEMA_VERSION = 3, DAYS = 90. Três coleções: accounts, videos, logs + meta{start,days} + revision.

- accounts: {id, name, niche, platforms[] (strings livres), timezone, driveRoot (URL), paused, createdAt}. Sem handle, sem linha editorial, sem modo de publicação. platforms é array — uma conta pode ter várias plataformas.
- videos: registro único e achatado que hoje acumula fonte + corte + variante + aprovação + publicação + métricas (L317–349): sourceUrl, driveUrl, fileMeta{name,size,lastModified,type}, foundAt, kind (viral|recent|own), platform, title, caption, hashtags, scheduledAt, rightsConfirmed, nicheConfirmed, reviewNote, publishedUrl, error, metrics{views,likes,comments,shares}, approval (pending|approved|changes|rejected), publication (draft|scheduled|published|error), approvedSnapshot.
- logs: {id, at, action, message, videoId, accountId} — já é uma trilha de auditoria funcional.

O que já funciona bem e deve ser preservado, não reescrito:

- Deduplicação (normalizeSource/sourceKeys/duplicateOf): URL canônica (drop de hash e utm_*, host minúsculo, barra final), drive: e file:nome:tamanho:mtime. Escopo por conta — a mesma origem pode existir em contas diferentes, e trocar de plataforma não contorna. Já tem ponytail: em L79 apontando o upgrade para hash incremental.
- Portões de aprovação (approvalIssues, 11 checagens) e de publicação (publishingIssues + approval, drift de snapshot, conta pausada, publishedUrl válido).
- Invalidação por alteração (sensitiveSnapshot, L785): JSON de 10 campos; qualquer mudança em conta/origem/tipo/plataforma/título/legenda/hashtags/horário/direitos derruba a aprovação. Mecânica exigida pela §4 — já existe e está testada.
- Publicação honesta: nada vira published sem publishedUrl válido colado pelo Arthur. blob: é rejeitado.
- Concorrência entre abas (persist, L406): comparação otimista de revision contra o valor armazenado; aborta com toast em vez de sobrescrever.
- Recuperação de dados corrompidos: sanitizeState retorna null → BROKEN_RAW → tela de recuperação; persist fica bloqueado até resolver.
- Saídas: toCsv (BOM, ;, neutralização de fórmula =+-@), backup/import JSON com allowlist, driveTree(state).

Metas e agenda: dailyGoal (2 virais + 1 recente por dia, com complete vs ready), suggestSlot (12h/18h para viral), suggestCopy (título/legenda/hashtags locais, sem IA remota), buildReport (janela em dias, melhor/pior por taxa de engajamento, totais).

UI: 3 abas — queue, accounts, reports. render() reescreve todo o innerHTML do root; refreshList() troca só a lista.

video-ops.css — 19,2 KB, 253 ocorrências de .vop-. Escopado corretamente, exceto 4 seletores globais: .publication-draft|published|scheduled|error. Sem transition: all, sem ease-in, transições 160–240 ms em propriedades específicas, :active { transform: scale(.97) }, hover só em (hover: hover) and (pointer: fine), @media (prefers-reduced-motion: reduce) presente, diálogo com overlay/display … allow-discrete.

test-video-ops.js — 139 linhas, node + assert puro, ~45 asserções: dedup, portões, snapshot, dailyGoal, engagement, buildReport, suggestCopy, suggestSlot, CSV (inclusive fórmula), driveTree, e 7 casos de migração/importação (migrateLegacyApprovals, resetExternalApprovals, backup adulterado, arquivo local após reload). Mais 3 verificações de ponte: needles no index.html, ausência de client_secret|refresh_token|service_role no JS, ausência de transition: all/ease-in no CSS.

Fiação no index.html (234,7 KB): nav L853–856 (com #count-video-ops), hub card L1338, <section id="view-video-ops" hidden><div id="video-ops-root"> L1361–1362, mapa de grupo L2912, toolViews L2934, toggle hidden L2944, window.videoOpsRefresh() L2952, <script src="video-ops.js"> L3634, <link rel="stylesheet" href="video-ops.css" /> L4678 — depois dos scripts, no fim do arquivo (risco de FOUC; não mexer agora, apenas registrado).

Supabase: confirmado pausado — os 3 <script> estão comentados em L3672–3677 com a receita de reativação inline. supabase/migrations/ tem 0001_init, 0002_sync, 0003_inventory — nenhuma tabela de vídeo.

video-apresentacao/: ~160 MB, e desses ~156 MB são mídia de um único projeto (HUBI-apresentacao-*.mp4, audio-body.wav, capturas/, narracao/). Código reaproveitável: apenas render_presentation.py (15,4 KB). O ativo real é o FFmpeg 7.1 vendorizado: _tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe, 83,6 MB, executável Windows standalone — chamável sem Python.

---
2. Lacunas

Frontend / modelo de dados
- Não existem editorialLines, creators, permissions, sources, transcripts, clips, variants, driveArtifacts, metricSnapshots, jobs. Um video é os cinco conceitos colapsados em um registro.
- Um vídeo-base não pode gerar destinos independentes: platform é um campo único no registro. Publicar o mesmo corte no TikTok e no Instagram exige duplicar o registro inteiro — e a dedup por conta permite isso, mas legenda/agenda/aprovação passam a ser duas cópias sem vínculo.
- Direitos são dois booleanos (rightsConfirmed, nicheConfirmed). Não há titular, tipo de autorização, evidência, prazo, território, monetização, plataformas permitidas — nem reaproveitamento por criador. Um false bloqueia; um true não prova nada.
- Sem estados de fonte (draft|rights_pending|ready|blocked), de processamento (queued…failed) nem de corte (candidate…rejected). Só os dois eixos aprovação/publicação existem.
- Sem timestamps de corte (in/out), sem gancho, motivo, score, alerta de contexto.
- Sem calendário: existe PLAN_DAY + dailyGoal + goalHTML para um dia de uma conta. Não há visão de 7 dias nem detecção de conflito entre contas.
- Sem visão consolidada das 10 contas: a fila é sempre de uma conta ativa (filteredVideos filtra por account.id); a aba Contas é um grid sem agregados de "precisa de atenção".
- metrics é um snapshot achatado — impossível representar 1 h / 24 h / 7 d, retenção, seguidores ou visitas à marca.
- driveTree() gera árvore por conta (Conta 01 - Nicho/Vídeos recebidos|aprovados|publicados|rejeitados|Legendas), estrutura diferente da §5.6. Não há cálculo de caminho/nome de arquivo determinístico, nem driveArtifacts, nem distinção gravado/sincronizado.
- Sem pacote de publicação (manifesto + checklist). O CSV é relatório, não pacote de destino.
- Escala: listInnerHTML renderiza todos os cards filtrados, sem limite nem paginação. .vop-video-list não é container de rolagem própria (a página rola), então refreshList preserva a posição só enquanto a contagem não muda. Com centenas de registros, o custo é o render integral — §9 não é atendida.
- Sem proteção "perfil errado" além do texto: não há @handle, avatar nem confirmação final de destino.

Backend — inexistente para vídeo, e deve continuar assim: nenhuma tabela, nenhuma Edge Function, nenhum OAuth, nenhum RLS por user_id para contas de rede social. Sem trilha de auditoria server-side.

Mídia — nada. Sem ingestão, download, transcrição, análise, reenquadramento 9:16, legenda queimada, capa, render, fila local, cancelamento, progresso, retentativa ou log. Bloqueadores de ambiente que encontrei: Python não está instalado (sem python, sem launcher py, sem diretório de instalação — os .pyc são cpython-312 de outra época/máquina). Node v24.16.0 disponível. FFmpeg existe vendorizado, mas não está no PATH.

Integrações — nada, e o AGENTS.md proíbe servidor Node/npm no frontend. Google Drive para computador não está instalado: só existe o volume C:, sem G:\Meu Drive nem %USERPROFILE%\Google Drive. A premissa central da §5.6 não tem pasta para apontar hoje.

Governança — não existe .git em nenhum dos diretórios. Sem controle de versão, "rollback" hoje significa restaurar cópia manual de arquivo. Isso é o maior risco da migração de schema.

---
3. Decisões bloqueantes (5)

1. Worker local: Python ou Node? Python não está instalado nesta máquina; Node v24.16.0 está, e os testes já rodam nele. O FFmpeg 7.1 vendorizado é um .exe que qualquer runtime chama. Instalo Python 3.12 conforme a §6 (Fase 2), ou o worker passa a ser Node/CLI local — sem npm, só child_process + o ffmpeg que já está no repo? Isso muda a Fase 2 inteira. (Nota: "sem servidor Node" ≠ "sem CLI Node"; o AGENTS.md proíbe servidor e dependência npm no frontend, não um script local.)
2. Pasta do Google Drive. O Drive para computador não está instalado. Você vai instalar (e a pasta fica em G:\Meu Drive\...), ou a Fase 1 deve apenas permitir escolher qualquer pasta local e registrar o caminho, deixando a sincronização para depois? A Fase 1 muda de "configurar caminho do Drive" para "configurar pasta de saída, Drive opcional".
3. Quantos dados reais existem hoje em pp_video_ops_v1 no navegador do Arthur? Não consigo ver o localStorage daqui. Se estiver vazio/descartável, a migração v3→v4 pode ser reset limpo (fatia muito menor). Se houver histórico publicado real, preciso da explosão completa com rollback — e isso pesa mais, sobretudo sem git.
4. Um corte gera automaticamente as duas variantes (TikTok + Instagram) da sua linha editorial, ou cada destino é escolhido manualmente? Muda o volume de registros, a UI de aprovação e o cálculo do calendário.
5. Inicializo um repositório git antes da Fase 1? Não há .git em seller-arthur, e a Fase 1 altera o schema persistido. Sem git, o único rollback do código é cópia manual da pasta. Recomendo git init + commit da baseline verde antes de qualquer migração.

Premissas que assumo sem perguntar (corrija se estiverem erradas): account.platform passa a ser uma plataforma por conta (tiktok | instagram) com @handle próprio, porque "5 no TikTok + 5 no Instagram, cada destino com legenda/agenda/aprovação/resultado próprios" só fecha assim; editorialLineId é o que mantém o par configurável, sem número fixo em código. Contas legadas com platforms[] múltiplo serão divididas, não truncadas.

---
4. Arquitetura proposta

┌─ NAVEGADOR (Vanilla JS, sem build, sem npm) ──────────────────┐
│ index.html → #video-ops-root → video-ops.js + video-ops.css   │
│ localStorage 'pp_video_ops_v1' (schema 4) = SÓ METADADOS      │
│ Papel: cadastro, direitos, decisão humana, agenda, aprovação, │
│        cálculo de caminho do Drive, leitura de resultado      │
│ NUNCA: binário, token, senha, credencial do Drive             │
└───────────────┬───────────────────────────────┬───────────────┘
      exporta job-*.json            importa result-*.json
      (download do navegador)       (<input type=file>)
                │
┌───────────────▼───────────────────────────────▲───────────────┐
│ WORKER LOCAL — PC do Arthur (Fase 2, sob autorização)         │
│ CLI, sem servidor residente, sem porta aberta                 │
│ ffmpeg-win-x86_64-v7.1.exe (já vendorizado)                   │
│ adaptadores substituíveis: transcrição │ análise │ render     │
│ escreve .part → fsync → rename atômico → verifica → manifesto │
└───────────────┬───────────────────────────────────────────────┘
                ▼
┌─ PASTA LOCAL SINCRONIZADA (caminho escolhido na configuração) ┐
│ Google Drive para computador faz a sincronização              │
│ Estados distintos: renderizado → gravado → sync CONFIRMADO    │
└────────────────

Fronteiras de segurança

┌────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│     Fronteira      │                                                                               Regra                                                                               │
├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Navegador ↔ worker │ Só JSON de metadados e caminhos. Nenhum binário trafega pelo localStorage. Job importado passa por sanitizeState-equivalente com allowlist.                       │
├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Worker ↔ Drive     │ Escrita em sistema de arquivos. Zero credencial do Drive — quem autentica é o app Drive para computador, fora do nosso código.                                    │
├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Direitos           │ sources só sai de rights_pending com permissionId apontando para uma permission válida na data e na plataforma do destino. blocked é terminal até revisão humana. │
├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Segredos           │ Nada de token no frontend. O teste !/client_secret|refresh_token|service_role/ já guarda isso e deve ser estendido a qualquer arquivo novo.                       │
├────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Deleção            │ Ação destrutiva pede confirmação; arquivo temporário local nunca é apagado antes de confirmar gravação final.                                                     │
└────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Por que troca de arquivo em vez de servidor local: o AGENTS.md proíbe servidor Node e o prompt exige justificar processo residente. Download/upload de um JSON é a ponte mais barata que existe, não abre porta, não precisa de CORS, e é depurável abrindo o arquivo. Se virar atrito real (dezenas de jobs/dia), o upgrade natural é o worker fazer watch numa pasta _jobs/ dentro da própria pasta de saída — aí o navegador só faz download e o worker acha sozinho. Registro isso como ponytail: no plano, não implemento agora.

---
5. Migração de dados

Chave e versão: manter pp_video_ops_v1 (a chave não versiona schema; state.version versiona). SCHEMA_VERSION: 3 → 4.

Rede de segurança (uma linha, antes de qualquer escrita v4): ao detectar version < 4, copiar a string crua para localStorage['pp_video_ops_v3_backup'] e só então persistir o v4. Rollback = apagar a chave principal, renomear o backup, recarregar. Sem função de downgrade, sem código novo para manter. Dado o cenário sem git, essa é a proteção que importa.

Mapeamento v3 → v4 (determinístico, testável, sem perda):

┌────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           v3                                           │                                                                      v4                                                                       │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ account.platforms: ['TikTok','Instagram']                                              │ divide em N accounts, uma por plataforma, platform singular normalizada, handle: '', editorialLineId novo por nicho, publishMode: 'manual'    │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ account.niche                                                                          │ cria uma editorialLine por nicho distinto; account.editorialLineId aponta pra ela; niche permanece no account (não apago)                     │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ video.sourceUrl/driveUrl/fileMeta/foundAt/sourceKey                                    │ um source (mesmo sourceKey, mesma dedup); status: 'ready' se rightsConfirmed senão 'rights_pending'                                           │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ video.rightsConfirmed                                                                  │ permission sintética {type:'permission', evidence:'', migratedFromV3:true, status:'unverified'} + creator sintético {name:'(não informado —   │
│                                                                                        │ migrado)'}. Nunca vira licensed/clip_program. nicheConfirmed continua campo próprio da variante.                                              │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ video.kind                                                                             │ clip.kind (mantém viral|recent|own)                                                                                                           │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ —                                                                                      │ um clip por vídeo, in: null, out: null, state: derivado da aprovação                                                                          │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ video.platform/title/caption/hashtags/scheduledAt/approval/approvedSnapshot/reviewNote │ uma variant ligada ao clip + à account correspondente                                                                                         │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ video.publication/publishedUrl/publishedAt/error                                       │ uma publication                                                                                                                               │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ video.metrics{...}                                                                     │ um metricSnapshot com window: 'manual'; variant.metrics mantido como cache do último snapshot para buildReport/toCsv não serem reescritos     │
│                                                                                        │ agora                                                                                                                                         │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ logs                                                                                   │ reusado como auditLog — não crio tabela nova (rung 2: já existe e funciona)                                                                   │
├────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ —                                                                                      │ driveArtifacts: [], transcripts: []. jobs não é criada na Fase 1 — YAGNI até o worker existir                                                 │
└────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Invariantes que a migração não pode violar (cada um vira asserção):
- sensitiveSnapshot da variante migrada precisa bater com o snapshot v3 ou a aprovação cai para pending. É exatamente o comportamento atual em L367 — reuso, não reimplemento.
- Publicação published com publishedUrl válido sobrevive (o relatório não pode perder histórico) — mesma regra de L362–366.
- Backup externo importado continua exigindo nova aprovação (resetExternalApprovals).
- sanitizeState hoje é tudo-ou-nada (return null → tela de recuperação). Coleções novas ausentes devem virar [], nunca null — senão todo backup v3 legítimo passa a ser tratado como corrompido. É o principal risco de regressão da fatia.
- Backup v4 aberto por código v3 antigo: accounts/videos não existem mais no mesmo formato → v3 rejeitaria e cairia na tela de recuperação sem apagar nada. Aceitável (falha visível, não silenciosa), mas precisa estar escrito na UI de exportação.

---
6. Plano por fases

F1.1 — Espinha de direitos + par piloto (a fatia recomendada, detalhada no item 8)
Arquivos: video-ops.js, video-ops.css, test-video-ops.js. index.html não muda.
Risco: sanitizeState tudo-ou-nada rejeitar backups válidos → mitigado por testes de backup v3 e v4 antes de tocar em load().
Aceite: node test-video-ops.js verde com os casos novos; backup v3 real importa sem cair na recuperação; um corte gera duas variantes com aprovação independente; fonte sem permissão válida não avança.

F1.2 — Sala de controle das 10 contas
Aba "Visão geral": agregados por conta (ativa/pausada/sem conteúdo/com erro/atrasada), fila cross-account com filtro por plataforma/linha/etapa/direitos/erro. Limite de render (primeiros N + "carregar mais") — paginação simples antes de virtualização.
Risco: render integral. Aceite: fila com 500 registros semeados permanece interativa; posição de rolagem preservada quando o contexto não muda (BP-013).

F1.3 — Calendário de 7 dias + conflitos
Reusa dailyGoal/suggestSlot. Aceite: dois destinos no mesmo minuto na mesma conta aparecem como conflito; mudança de horário derruba a aprovação (já é o comportamento do snapshot).

F1.4 — Caminho do Drive + pacote de publicação
drivePath(variant) puro e determinístico (clipId-criador-assunto-plataforma-conta-vN, sanitizado Windows: \ / : * ? " < > |, reservados CON/PRN/AUX/NUL/COM1..9/LPT1..9, limite de caminho, sem ponto/espaço final). Árvore da §5.6 substituindo driveTree. driveArtifacts com state: planned|written|sync_confirmed — na F1 só planned é alcançável, e a UI diz isso com essas palavras.
Risco: prometer sincronização. Aceite: nenhum texto da UI afirma "no Drive" quando o estado é planned; teste de sanitização com nome hostil.

F2 — Worker local (só após autorização, e após a decisão #1)
Comparação escrita de opções de transcrição (CPU/RAM/tempo por hora/qualidade PT-BR/tamanho/portabilidade) antes de instalar qualquer coisa. Fila persistente idempotente, cancelamento, progresso, retentativa limitada, log legível. Escrita .part → rename. Manifesto de resultado importável.
Risco: 83,6 MB de ffmpeg já no repo — verificar antes se ele é aceitável como dependência versionada ou se sai para fora do repo.

F3 — Backend/integrações — só com aprovação explícita. Revalidar as 4 fontes oficiais na data. Não prometer publicação pública automática no TikTok antes de saber se o app é aprovado; exportação manual continua caminho de primeira classe.

F4 — Aprendizagem — métricas por janela, ranking, recomendação explicável, custo por corte. Só depois do par piloto validado.

---
7. Plano de testes

Tudo em test-video-ops.js (node + assert, sem framework, sem npm — o formato atual já é o certo).

- Puros: drivePath determinístico e idempotente; sanitização de nome Windows (nomes reservados, caracteres proibidos, ponto/espaço final, comprimento); permissionCovers(permission, platform, date) — plataforma fora do escopo, prazo vencido, monetização proibida, território.
- Migração: v3 vazio; v3 com 1 vídeo pendente; v3 com publicado válido (histórico preserva); v3 com conta multi-plataforma (divide em N, nada perdido); v3 adulterado (aprovação cai); v4 → v4 (idempotente, revision não infla); backup v3 importado como externo (exige nova aprovação); pp_video_ops_v3_backup criado antes da primeira escrita v4.
- Estados: cada transição ilegal rejeitada — fonte blocked → ready, corte sem fonte ready → approved, variante alterada após aprovação → pending, published sem publishedUrl.
- Direitos: sem permissionId bloqueia; permissão vencida bloqueia; permissão que cobre só TikTok não libera variante Instagram; permissão sintética migrada (status:'unverified') não libera publicação nova.
- Duplicidade: URL canônica igual na mesma conta bloqueia; em conta diferente permite; troca de plataforma não contorna; arquivo com mesmo nome/tamanho/mtime bloqueia.
- Falhas: localStorage cheio (persist retorna false e não corrompe revision); conflito de revision entre abas; JSON inválido → BROKEN_RAW; coleção nova ausente vira [] e não dispara recuperação.
- Ponte index.html: needles atuais continuam passando; nenhum <script>/<link> novo; supabase segue comentado; sem segredo em nenhum arquivo novo; CSS sem transition: all/ease-in e com prefers-reduced-motion; novo: nenhum seletor de topo fora de #view-video-ops/.vop- (pega o vazamento atual de .publication-*).
- Manual, http://localhost: desktop + 390 px; teclado (Tab/Enter/Esc), foco visível, aria-live no feedback; :active em tudo clicável.

---
8. Primeira fatia recomendada (F1.1)

Objetivo: um par piloto — linha-editorial-01 com 1 conta TikTok + 1 conta Instagram — recebendo uma live de terceiro autorizada, gerando um corte com dois destinos independentes, cada um com seu caminho de Drive calculado e seu pacote de publicação manual. Sem backend, sem processar vídeo, sem instalar nada.

Entrega:

1. editorialLines (id, nome, público, temas) — CRUD mínimo.
2. creators (nome, perfis oficiais, política pública de cortes, contato) + permissions (type: permission|clip_program|licensed|public_domain, titular, evidência/link, data, plataformas, monetização, território, validade, status, observações). Uma permissão reaproveitável por várias fontes do mesmo criador.
3. accounts: +handle, +editorialLineId, +publishMode, platform singular. Migração divide contas multi-plataforma.
4. sources: creatorId + permissionId obrigatório + URL/arquivo + status: draft|rights_pending|ready|blocked. Reusa a dedup existente sem alteração. Sem download, sem player.
5. clips: sourceId, in/out digitados à mão, gancho, assunto, motivo. Sem editor visual, sem prévia de vídeo.
6. variants: clipId + accountId + título/legenda/hashtags/agenda + approval/approvedSnapshot/publication — reusando approvalIssues, publishingIssues e sensitiveSnapshot como estão, só trocando o alvo de video para variant.
7. drivePath() + árvore da §5.6 + driveArtifacts em state:'planned', com o rótulo honesto "caminho reservado — nada gravado ainda".
8. Pacote de publicação: JSON (destino, @handle, plataforma, título, legenda, hashtags, caminho do arquivo, permissão vinculada) + checklist .txt. Download local, publishedUrl colado à mão depois.
9. Migração v3→v4 + pp_video_ops_v3_backup + os testes do item 7 que se aplicam.

Critério de aceite verificável: node --check video-ops.js e node test-video-ops.js verdes; abrir em http://localhost, cadastrar criador → permissão → fonte → corte → aprovar as duas variantes separadamente → exportar os dois pacotes → conferir que os dois caminhos de Drive são diferentes, determinísticos e sanitizados; alterar a legenda de uma variante e confirmar que só aquela volta para pending.

---
9. Fora de escopo explícito na F1.1

Download de qualquer origem · transcrição · análise automática de cortes · qualquer chamada ao FFmpeg · render 9:16 · legenda queimada · capa · prévia de vídeo · worker local (Python ou Node) · fila de jobs · instalação de Python, modelo ou dependência · API do Google Drive, OAuth ou confirmação automática de sincronização · Supabase (segue pausado, scripts comentados) · API do TikTok e do Instagram · métricas automáticas e janelas 1 h/24 h/7 d (só o snapshot manual migrado) · fingerprint/hash de arquivo (mantém nome:tamanho:mtime com o ponytail: de L79) · calendário de 7 dias e conflitos (F1.3) · visão consolidada das 10 contas e paginação da fila (F1.2) · virtualização · custo por corte · ranking e recomendação · correção da posição do <link> do CSS em L4678 · vazamento dos seletores .publication-* (corrijo em F1.4, junto com o teste que o detecta) · qualquer alteração no index.html.

Duas coisas que não vou fazer sem você decidir: instalar Python, e instalar/apontar o Google Drive para computador. São as perguntas 1 e 2.

Aguardando aprovação para executar a Fase 1.

✻ Churned for 8m 14s
```

---

## Turno 2 — Usuário

```text
pode intelar python e apontar o google drive
```

---

## Turno 3 — Assistente

```text
Isso responde as perguntas 1 e 2. Vou preparar o ambiente e parar — não vou escrever código até você dizer EXECUTAR FASE 1 DO PLANO APROVADO.

Primeiro, checando o que tenho disponível para instalar:

  Ran 1 shell command

winget disponível, sem elevação (então Python vai por instalação por usuário, sem admin). Instalando Python 3.12 — mesma minor dos .pyc cpython-312 do imageio_ffmpeg já vendorizado, para o pipeline existente continuar compatível:

  Ran 3 shell commands

Python 3.12.10 + pip 25.0.1 instalados por usuário, PATH registrado. Validando que o FFmpeg vendorizado realmente funciona (é o ativo que justifica o worker local):

  Ran 1 shell command

FFmpeg 7.1 com libx264 + aac — exatamente o alvo MP4/H.264/AAC 9:16 da §5.3 — e o imageio_ffmpeg 0.6.0 importa no Python novo e resolve o .exe vendorizado. O caminho de render da Fase 2 não precisa de nenhum pip install.

Agora o Google Drive:

  Ran 1 shell command

Drive para computador instala em escopo de máquina — vai abrir um prompt UAC na sua tela. Se aparecer, aprove:

  Ran 1 shell command

Instalado. Verificando se já montou (o login é interativo — só você pode fazer):

  Ran 3 shell commands, wrote 3 memories

Python e Drive prontos. Faltam duas decisões que mudam o trabalho da Fase 1 — a terceira pergunta do plano (quanto dado real existe no localStorage) eu descartei: a migração + a chave de backup cobrem os dois casos com o mesmo código, então não vale perguntar.

● User answered Claude's questions:
· Quando você aprova um corte, os dois destinos da linha editorial (TikTok + Instagram) devem ser criados automaticamente, ou escolhidos um a um? → Cria as duas, dá pra apagar (Recomendado)
· Posso rodar `git init` + commit da baseline verde em Downloads\seller-arthur antes de migrar o schema? → Sim, git init antes de tudo (Recomendado)

Rodando o git init agora — é a rede de segurança antes de qualquer migração.

  Ran 5 shell commands

G: montou — você fez o login. E achei algo que corrige o que eu disse antes:


15 GB livres, modo streaming. Agora o teste que decide se a §5.6 é viável — a escrita atômica .part → rename funciona no volume do Drive?

  Ran 2 shell commands

Ambiente pronto. Resultados medidos, não presumidos:

┌─────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│      Item       │                                                                               Estado                                                                               │
├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Python          │ 3.12.10 + pip 25.0.1, por usuário em %LOCALAPPDATA%\Programs\Python\Python312, PATH de usuário registrado, launcher py instalado                                   │
├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ FFmpeg          │ 7.1 vendorizado roda standalone, com libx264 + aac; imageio_ffmpeg 0.6.0 importa no Python novo e resolve o .exe sozinho → render da Fase 2 sem nenhum pip install │
├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Google Drive    │ 128.0.0.0 instalado, você logou, G:\Meu Drive montado, modo streaming, 15 GB livres                                                                                │
├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Escrita atômica │ .part + Flush(true) + rename → passou, 2 MB relidos íntegros, .part não sobra. A §5.6 é viável.                                                                    │
├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Git             │ b0f60c8 baseline, 256 arquivos, árvore limpa, .git = 113 MB (mídia do video-apresentacao/ domina)                                                                  │
└─────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Duas correções ao relatório anterior, porque mudam o que vou fazer:

1. emil-design-eng existe no repo — em .claude/skills/emil-design-eng/SKILL.md e .agents/skills/emil-design-eng/, além de review-animations/SKILL.md + STANDARDS.md. Não está registrada como skill da sessão, mas é arquivo legível: vou lê-la e segui-la no trabalho de UI da Fase 1, em vez do fallback DESIGN.md.
2. Confirmação automática de sincronização é impossível pelo sistema de arquivos. Testei: o volume do Drive não enumera streams alternativos (Parâmetro incorreto) e o atributo do arquivo é só Normal — não há Offline/RecallOnOpen para distinguir "gravado localmente" de "chegou na nuvem". Antes eu tinha escrito isso como hipótese; agora é medido. Logo driveArtifacts.state fica planned → written → sync_confirmed, e sync_confirmed só por confirmação manual sua (ou pela API do Drive, que é Fase 3 e nem foi autorizada).

Decisões registradas: um corte gera as duas variantes (TikTok + Instagram) da linha editorial automaticamente, com aprovação/legenda/agenda independentes e opção de apagar. Git como rede de segurança, feito.

Um aviso de capacidade: 15 GB livres no Drive. Cortes verticais renderizados consomem isso rápido; a F1.4 vai calcular o caminho e o tamanho previsto, mas plano de armazenamento é decisão sua mais adiante.

A pasta de teste que criei em G:\Meu Drive já foi removida — o Drive está no estado em que você o deixou. Nenhum arquivo do repositório foi alterado; o único .gitignore respeitado é o que já existia.

Aguardando aprovação para executar a Fase 1.

✻ Worked for 9m 52s
```

---

## Turno 4 — Usuário

```text
pdoe e[[[[
```

---

## Turno 5 — Assistente

```text
Não entendi — a mensagem saiu truncada (pdoe e[[[[).

Se era "pode" liberando a execução, me confirme com a frase do contrato:

E
Interrupted · What should Claude do instead?
```

---

## Turno 6 — Usuário

```text
pode executar a parte um
```

---

## Turno 7 — Assistente

```text
Aprovado. Executando a primeira fatia (F1.1) do plano — a espinha de direitos + par piloto, com migração v3→v4 e testes. F1.2 (visão das 10 contas + paginação) e F1.3 (calendário de 7 dias) ficam para a próxima liberação; digo isso explicitamente no relatório final.

Primeiro, o contrato manda confirmar o estado vivo do código antes de editar:
  Ran 1 shell command

Baseline verde e árvore limpa. Lendo a skill de design que o prompt manda seguir antes de tocar em UI/CSS, e o código completo:

  Read 1 file, ran 1 shell command

Padrões de animação conferem com o CSS que já existe (curva custom --vop-ease-out, 160–240 ms, scale(.97) no :active, hover com gate, reduced-motion). Vou manter as mesmas convenções. Agora o código — preciso dos bytes exatos para editar:

  Read 1 file

Tenho o arquivo inteiro. O movimento que mantém o diff pequeno: uma função resolveVariant() que devolve exatamente a forma achatada que approvalIssues, publishingIssues, sensitiveSnapshot, duplicateOf, dailyGoal, buildReport e toCsv já consomem — assim preservo ~400 linhas de lógica testada em vez de reescrevê-la sobre o modelo novo.

Escrevendo o video-ops.js v4:

Vou escrever em blocos menores. Bloco 1 — cabeçalho, constantes, utilitários e a espinha de resolução/direitos:

● Write(~\Downloads\seller-arthur\video-ops.js)
Added 133 lines, removed 974 lines
   Guarda somente metadados em localStorage (pp_video_ops_v1): vídeos e tokens
   nunca entram no navegador. Publicação real fica explícita como registro manual.
/* Estúdio de Vídeos — sala de controle local para 10 contas (5 TikTok + 5 Instagram).
   Guarda somente metadados em localStorage (pp_video_ops_v1, schema 4): vídeos,
   tokens e credenciais nunca entram no navegador.
   A matéria-prima são lives e podcasts de terceiros que autorizam a divulgação de
   cortes; a autorização é registrada por criador e verificada por plataforma e prazo.
   Publicação real continua sendo registro manual. Renderização e gravação na pasta
   do Google Drive são do worker local (Fase 2) — este módulo só reserva o caminho.
   Lógica pura exportada para test-video-ops.js. */
(function () {
  'use strict';

  var KEY = 'pp_video_ops_v1';
  var SCHEMA_VERSION = 3;
  var BACKUP_V3_KEY = 'pp_video_ops_v3_backup';
  var SCHEMA_VERSION = 4;
  var DAYS = 90;
  var DRIVE_ROOT = 'Projeto Automação de Vídeos';
  var STATE = null;
  var ACTIVE_ACCOUNT = '';
  var TAB = 'queue';

  var TOAST = null;
  var TEMP_PREVIEW = '';
  var BROKEN_RAW = '';
  var MIGRATED_FROM_V3 = false;
  var SESSION_FILES = Object.create(null);
  var uidN = 0;

  var KIND_LABEL = { viral: 'Viral antigo', recent: 'Conteúdo recente', own: 'Conteúdo próprio' };
  var APPROVAL_LABEL = { pending: 'Pendente', approved: 'Aprovado', changes: 'Ajustes pedidos', rejected: 'Rejeitado' };
  var PUBLICATION_LABEL = { draft: 'Preparação', scheduled: 'Agendado', published: 'Publicado', error: 'Erro' };
  var SOURCE_STATUS_LABEL = { draft: 'Rascunho', rights_pending: 'Direitos pendentes', ready: 'Liberada', blocked: 'Bloqueada' };
  var CLIP_STATE_LABEL = { candidate: 'Candidato', selected: 'Selecionado', editing: 'Em edição', review: 'Em revisão', approved: 'Aprovado', changes: 'Ajustes pedidos', rejected: 'Rejeitado' };
  var PERMISSION_TYPE_LABEL = { permission: 'Autorização direta', clip_program: 'Programa de cortes', licensed: 'Licenciado', public_domain: 'Domínio público' };
  var PERMISSION_STATUS_LABEL = { unverified: 'Não verificada', valid: 'Válida', expired: 'Vencida', revoked: 'Revogada' };
  var DRIVE_STATE_LABEL = { planned: 'Caminho reservado', written: 'Gravado na pasta', sync_confirmed: 'Sincronização confirmada' };
  var PUBLISH_MODE_LABEL = { manual: 'Manual', api: 'Integração oficial' };
  var PLATFORM_LABEL = { tiktok: 'TikTok', instagram: 'Instagram' };

  var KINDS = ['viral', 'recent', 'own'];
  var APPROVALS = ['pending', 'approved', 'changes', 'rejected'];
  var PUBLICATIONS = ['draft', 'scheduled', 'published', 'error'];
  var SOURCE_STATUS = ['draft', 'rights_pending', 'ready', 'blocked'];
  var CLIP_STATES = ['candidate', 'selected', 'editing', 'review', 'approved', 'changes', 'rejected'];
  var PERMISSION_TYPES = ['permission', 'clip_program', 'licensed', 'public_domain'];
  var PERMISSION_STATUS = ['unverified', 'valid', 'expired', 'revoked'];
  var DRIVE_STATES = ['planned', 'written', 'sync_confirmed'];
  var PUBLISH_MODES = ['manual', 'api'];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + (uidN++).toString(36);
  }

    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  function cleanText(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 5000); }
  function deaccent(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function safeUrl(value) {
    try {
      var url = new URL(String(value || '').trim());
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (e) { return ''; }
  }
    return deaccent(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  function platformSlug(value) { return slug(value).slice(0, 40); }
  function platformLabel(value) {
    var key = platformSlug(value);
    if (PLATFORM_LABEL[key]) return PLATFORM_LABEL[key];
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
  }
  function findById(list, id) {
    if (!Array.isArray(list) || !id) return null;
    return list.find(function (item) { return item && item.id === id; }) || null;
  }
  /* Nome de arquivo/pasta seguro no Windows: sem caracteres proibidos, sem nome
     reservado, sem ponto ou espaço final (o Explorer os descarta silenciosamente). */
  function safeName(value, max) {
    var text = deaccent(value)
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/[-]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .trim()
      .replace(/^[-. ]+|[-. ]+$/g, '');
    text = text.slice(0, max || 60).replace(/[-. ]+$/g, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(text)) text = '_' + text;
    return text || 'sem-nome';
  }

  function normalizeSource(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';

  function makeSourceKey(data) {
    return sourceKeys(data).join('|');
  }
  function duplicateOf(videos, candidate, exceptId) {
  /* Serve para fontes (sem accountId, dedup global) e para os registros achatados do
     schema 3 (com accountId, dedup por conta). Comparar accountId cobre os dois casos. */
  function duplicateOf(items, candidate, exceptId) {
    var candidateKeys = storedSourceKeys(candidate);
    if (!candidate || !candidateKeys.length) return null;
    return (videos || []).find(function (video) {
      if (video.id === exceptId || video.accountId !== candidate.accountId) return false;
      return storedSourceKeys(video).some(function (key) { return candidateKeys.indexOf(key) >= 0; });
    return (items || []).find(function (item) {
      if (item.id === exceptId || item.accountId !== candidate.accountId) return false;
      return storedSourceKeys(item).some(function (key) { return candidateKeys.indexOf(key) >= 0; });
    }) || null;
  }
  function approvalIssues(video, account, options) {
    var issues = [];
    var hasLocalFile = !!(options && options.hasLocalFile);
    if (!account) issues.push('conta inválida');
    if (!storedSourceKeys(video).length) issues.push('origem ou arquivo');
    if (video.sourceUrl && !safeUrl(video.sourceUrl)) issues.push('link de origem válido');
    if (video.driveUrl && !safeUrl(video.driveUrl)) issues.push('link do Drive válido');
    if (video.fileMeta && !safeUrl(video.sourceUrl) && !safeUrl(video.driveUrl) && !hasLocalFile) issues.push('arquivo local disponível nesta sessão');
    if (!video.rightsConfirmed) issues.push('direitos de uso');
    if (!video.nicheConfirmed) issues.push('compatibilidade com o nicho');
    if (!String(video.title || '').trim()) issues.push('título');
    if (!String(video.caption || '').trim()) issues.push('legenda');
    if (!String(video.hashtags || '').trim()) issues.push('hashtags');
    if (!String(video.scheduledAt || '').trim()) issues.push('data e horário');
    if (!String(video.platform || '').trim()) issues.push('plataforma');
    else if (account && (!Array.isArray(account.platforms) || account.platforms.indexOf(video.platform) < 0)) issues.push('plataforma vinculada à conta');
    return issues;
  }
  function publishingIssues(video, account, options) {
    var issues = approvalIssues(video, account, options);
    if (video.approval !== 'approved') issues.push('aprovação');
    if (video.approval === 'approved' && video.approvedSnapshot !== sensitiveSnapshot(video)) issues.push('nova aprovação após alterações');
    if (account && account.paused) issues.push('conta pausada');
    if (!safeUrl(video.publishedUrl)) issues.push('link da postagem');
    return issues;
  }
  function dailyGoal(videos, accountId, day) {
    var planned = (videos || []).filter(function (video) {
      return video.accountId === accountId
        && String(video.scheduledAt || '').slice(0, 10) === day
        && video.approval !== 'rejected';
    });
    var viral = planned.filter(function (video) { return video.kind === 'viral'; }).length;
    var recent = planned.filter(function (video) { return video.kind === 'recent'; }).length;
    var approved = planned.filter(function (video) {
      return video.approval === 'approved' && (video.publication === 'scheduled' || video.publication === 'published');
    });
    var approvedViral = approved.filter(function (video) { return video.kind === 'viral'; }).length;
    var approvedRecent = approved.filter(function (video) { return video.kind === 'recent'; }).length;
    return {
      viral: viral,
      recent: recent,
      total: planned.length,
      approved: approved.length,
      complete: viral >= 2 && recent >= 1 && planned.length >= 3,
      ready: approvedViral >= 2 && approvedRecent >= 1 && approved.length >= 3
    };
  }
  function engagement(video) {
    var metrics = video && video.metrics || {};
    var views = num(metrics.views);
    var interactions = num(metrics.likes) + num(metrics.comments) + num(metrics.shares);
    return { views: views, interactions: interactions, rate: views ? interactions / views : 0 };
  }
  function eventDate(video) {
    return video.publishedAt || video.updatedAt || video.scheduledAt || video.createdAt || '';
  }
  function buildReport(state, accountId, days, now) {
    var all = (state.videos || []).filter(function (video) { return !accountId || video.accountId === accountId; });
    var end = new Date(now || Date.now());
    var start = new Date(end);
    start.setDate(start.getDate() - Math.max(1, Number(days) || 7) + 1);
    start.setHours(0, 0, 0, 0);
    function inside(video) {
      var at = Date.parse(eventDate(video));
      return Number.isFinite(at) && at >= start.getTime() && at <= end.getTime();
    }
    var period = all.filter(inside);
    var published = period.filter(function (video) { return video.publication === 'published'; });
    var ranked = published.slice().sort(function (a, b) {
      var ea = engagement(a), eb = engagement(b);
      return (eb.rate - ea.rate) || (eb.interactions - ea.interactions) || (eb.views - ea.views);
    });
    var totals = published.reduce(function (sum, video) {
      var m = video.metrics || {};
      sum.views += num(m.views);
      sum.likes += num(m.likes);
      sum.comments += num(m.comments);
      sum.shares += num(m.shares);
      return sum;
    }, { views: 0, likes: 0, comments: 0, shares: 0 });
    var hours = Object.create(null);
    published.forEach(function (video) {
      var hour = String(video.scheduledAt || '').slice(11, 13);
      if (!hour) return;
      if (!hours[hour]) hours[hour] = { total: 0, count: 0 };
      hours[hour].total += engagement(video).rate;
      hours[hour].count++;
    });
    var bestHour = Object.keys(hours).sort(function (a, b) {
      return (hours[b].total / hours[b].count) - (hours[a].total / hours[a].count);
    })[0] || '';
    return {
      days: Number(days) || 7,
      period: period,
      published: published,
      rejected: period.filter(function (video) { return video.approval === 'rejected'; }),
      errors: period.filter(function (video) { return video.publication === 'error'; }),
      totals: totals,
      best: ranked[0] || null,
      worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
      bestHour: bestHour ? bestHour + ':00' : ''
    };
  }
  function suggestCopy(topic, niche) {
    var cleanTopic = String(topic || '').trim();
    var cleanNiche = String(niche || '').trim();
    var words = (cleanNiche + ' ' + cleanTopic).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (word) { return word.length > 2; });
    var tags = [];
    words.forEach(function (word) { if (tags.length < 4 && tags.indexOf(word) < 0) tags.push(word); });
    if (tags.indexOf('conteudo') < 0) tags.push('conteudo');
    return {
      title: cleanTopic || ('Conteúdo sobre ' + (cleanNiche || 'o tema')),
      caption: (cleanTopic || 'Este conteúdo') + '. Salve para rever e compartilhe com quem também se interessa por ' + (cleanNiche || 'este assunto') + '.',
      hashtags: tags.map(function (word) { return '#' + word; }).join(' ')
    };
  }
  function suggestSlot(videos, accountId, kind, from) {
    var base = new Date(from || Date.now());
    var hours = kind === 'viral' ? [12, 18] : kind === 'recent' ? [21] : [9];
    for (var offset = 0; offset < DAYS; offset++) {
      for (var i = 0; i < hours.length; i++) {
        var candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, hours[i], 0, 0, 0);
        if (candidate.getTime() <= base.getTime() + 30 * 60000) continue;
        var value = localDateTime(candidate);
        var busy = (videos || []).some(function (video) {
          return video.accountId === accountId && video.approval !== 'rejected' && String(video.scheduledAt || '').slice(0, 16) === value;
        });
        if (!busy) return value;
      }
    }
    return '';
  }
  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function toCsv(state) {
    var accountMap = Object.create(null);
    (state.accounts || []).forEach(function (account) { accountMap[account.id] = account; });
    var headers = ['Conta', 'Nicho', 'Vídeo', 'Origem', 'Encontrado em', 'Tipo', 'Drive', 'Título', 'Legenda', 'Hashtags', 'Programado', 'Plataforma', 'Aprovação', 'Publicação', 'Link publicado', 'Visualizações', 'Curti
das', 'Comentários', 'Compartilhamentos', 'Erro'];
    var rows = (state.videos || []).map(function (video) {
      var account = accountMap[video.accountId] || {};
      var metrics = video.metrics || {};
      return [account.name, account.niche, video.name, video.sourceUrl, video.foundAt, KIND_LABEL[video.kind] || video.kind, video.driveUrl, video.title, video.caption, video.hashtags, video.scheduledAt, video.platform,
 APPROVAL_LABEL[video.approval] || video.approval, PUBLICATION_LABEL[video.publication] || video.publication, video.publishedUrl, num(metrics.views), num(metrics.likes), num(metrics.comments), num(metrics.shares), video
.error].map(csvCell).join(';');
    });
    return '\ufeff' + [headers.map(csvCell).join(';')].concat(rows).join('\r\n');
  }
  function driveTree(state) {
    var lines = ['Projeto Automação de Vídeos/'];
    (state.accounts || []).forEach(function (account, index) {
      var name = String(account.niche || account.name || 'Sem nicho').
      ['Vídeos recebidos', 'Vídeos aprovados', 'Vídeos publicados', 'Vídeos rejeitados', 'Legendas e informações'].forEach(function (folder) {
        lines.push('    ' + folder + '/');
      });
    });
    lines.push('  Relatórios/');
    lines.push('  Erros da automação/');
    lines.push('  Banco de ideias/');
    return lines.join('\n');
  }

  function seed(start) {
    return { version: SCHEMA_VERSION, revision: 0, meta: { start: start || localDay(), days: DAYS }, accounts: [], videos: [], logs: [] };
  /* Uma autorização só cobre o que ela declara: plataforma listada, dentro do prazo e
     com status válido. Lista de plataformas vazia não libera nada — obriga a ser explícito. */
  function permissionCovers(permission, platform, dayISO) {
    if (!permission || permission.status !== 'valid') return false;
    var day = /^\d{4}-\d{2}-\d{2}/.test(String(dayISO || '')) ? String(dayISO).slice(0, 10) : localDay();
    if (permission.validUntil && String(permission.validUntil) < day) return false;
    var list = Array.isArray(permission.platforms) ? permission.platforms : [];
    return list.indexOf(platformSlug(platform)) >= 0;
  }
  function cleanText(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 5000); }
  function sanitizeState(value, options) {
    if (!value || !Array.isArray(value.accounts) || !Array.isArray(value.videos)) return null;
    options = options || {};
    var migrateLegacyApprovals = !!options.migrateLegacyApprovals && Number(value.version || 0) < SCHEMA_VERSION;
    var clean = {
      version: SCHEMA_VERSION,
      revision: Math.max(0, Math.floor(num(value.revision))),
      meta: { start: /^\d{4}-\d{2}-\d{2}$/.test(value.meta && value.meta.start) ? value.meta.start : localDay(), days: DAYS },
      accounts: [],
      videos: [],
      logs: []
    };
    var accountIds = Object.create(null);
    for (var ai = 0; ai < value.accounts.length; ai++) {
      var rawAccount = value.accounts[ai] || {};
      var accountId = cleanText(rawAccount.id, 100);
      var platforms = Array.isArray(rawAccount.platforms) ? rawAccount.platforms.map(function (item) { return cleanText(item, 60); }).filter(Boolean) : [];
      platforms = platforms.filter(function (item, index) { return platforms.indexOf(item) === index; });
      if (!accountId || accountIds[accountId] || !cleanText(rawAccount.name, 80) || !cleanText(rawAccount.niche, 100) || !platforms.length) return null;
      accountIds[accountId] = true;
      clean.accounts.push({
        id: accountId,
        name: cleanText(rawAccount.name, 80),
        niche: cleanText(rawAccount.niche, 100),
        platforms: platforms,
        timezone: cleanText(rawAccount.timezone, 80),
        driveRoot: safeUrl(rawAccount.driveRoot),
        paused: !!rawAccount.paused,
        createdAt: cleanText(rawAccount.createdAt, 40) || nowISO()
      });
    }
    var videoIds = Object.create(null);
    var kinds = ['viral', 'recent', 'own'];
    var approvals = ['pending', 'approved', 'changes', 'rejected'];
    var publications = ['draft', 'scheduled', 'published', 'error'];
    for (var vi = 0; vi < value.videos.length; vi++) {
      var rawVideo = value.videos[vi] || {};
      var videoId = cleanText(rawVideo.id, 100);
      var account = clean.accounts.find(function (item) { return item.id === rawVideo.accountId; });
      if (!videoId || videoIds[videoId] || !account) return null;
      videoIds[videoId] = true;
      var file = rawVideo.fileMeta && rawVideo.fileMeta.name ? {
        name: cleanText(rawVideo.fileMeta.name, 255),
        size: num(rawVideo.fileMeta.size),
        lastModified: num(rawVideo.fileMeta.lastModified),
        type: cleanText(rawVideo.fileMeta.type, 100)
      } : null;
      var video = {
        id: videoId,
        accountId: account.id,
        name: cleanText(rawVideo.name, 140),
        sourceUrl: safeUrl(rawVideo.sourceUrl),
        driveUrl: safeUrl(rawVideo.driveUrl),
        sourceKey: '',
        foundAt: cleanText(rawVideo.foundAt, 10),
        kind: kinds.indexOf(rawVideo.kind) >= 0 ? rawVideo.kind : 'viral',
        platform: cleanText(rawVideo.platform, 60),
        title: cleanText(rawVideo.title, 180),
        caption: cleanText(rawVideo.caption, 2200),
        hashtags: cleanText(rawVideo.hashtags, 500),
        scheduledAt: cleanText(rawVideo.scheduledAt, 30),
        rightsConfirmed: !!rawVideo.rightsConfirmed,
        nicheConfirmed: !!rawVideo.nicheConfirmed,
        reviewNote: cleanText(rawVideo.reviewNote, 2000),
        publishedUrl: safeUrl(rawVideo.publishedUrl),
        error: cleanText(rawVideo.error, 2000),
        metrics: {
          views: num(rawVideo.metrics && rawVideo.metrics.views),
          likes: num(rawVideo.metrics && rawVideo.metrics.likes),
          comments: num(rawVideo.metrics && rawVideo.metrics.comments),
          shares: num(rawVideo.metrics && rawVideo.metrics.shares)
        },
        approval: approvals.indexOf(rawVideo.approval) >= 0 ? rawVideo.approval : 'pending',
        publication: publications.indexOf(rawVideo.publication) >= 0 ? rawVideo.publication : 'draft',
        approvedSnapshot: cleanText(rawVideo.approvedSnapshot, 8000),
        createdAt: cleanText(rawVideo.createdAt, 40) || nowISO(),
        updatedAt: cleanText(rawVideo.updatedAt, 40) || nowISO(),
        publishedAt: cleanText(rawVideo.publishedAt, 40)
      };
      video.sourceKey = makeSourceKey(video);
      if (!video.name || !video.sourceKey || duplicateOf(clean.videos, video, '')) return null;
      if (account.platforms.indexOf(video.platform) < 0) {
        video.approval = 'pending';
        video.publication = 'draft';
        video.approvedSnapshot = '';
      }
      if (video.approval === 'approved' && video.publication !== 'published' && video.fileMeta && !video.sourceUrl && !video.driveUrl) {
        video.approval = 'pending';
        video.publication = 'draft';
        video.approvedSnapshot = '';
      }
      if (migrateLegacyApprovals && video.approval === 'approved'
          && !approvalIssues(video, account).length
          && (video.publication !== 'published' || safeUrl(video.publishedUrl))) {
        video.approvedSnapshot = sensitiveSnapshot(video);
      }
      if (video.approval === 'approved' && video.approvedSnapshot !== sensitiveSnapshot(video)) {
        video.approval = 'pending';
        video.publication = 'draft';
        video.approvedSnapshot = '';
      }
      if (video.approval === 'rejected') video.publication = 'draft';
      if ((video.publication === 'scheduled' || video.publication === 'error') && video.approval !== 'approved') video.publication = 'draft';
      if (video.publication === 'published' && (video.approval !== 'approved' || !video.publishedUrl)) video.publication = 'draft';
      if (options.resetExternalApprovals && video.publication !== 'published' && video.approval === 'approved') {
        video.approval = 'pending';
        video.publication = 'draft';
        video.approvedSnapshot = '';
      }
      clean.videos.push(video);
    }
    if (Array.isArray(value.logs)) value.logs.forEach(function (rawLog) {
      rawLog = rawLog || {};
      clean.logs.push({
        id: cleanText(rawLog.id, 100) || uid('log'),
        at: cleanText(rawLog.at, 40),
        action: cleanText(rawLog.action, 80),
        message: cleanText(rawLog.message, 3000),
        videoId: videoIds[rawLog.videoId] ? rawLog.videoId : '',
        accountId: accountIds[rawLog.accountId] ? rawLog.accountId : ''
      });
    });
    return clean;
  function permissionWarnings(permission) {
    if (!permission) return ['autorização vinculada'];
    var warnings = [];
    if (!cleanText(permission.evidence) && !safeUrl(permission.evidenceUrl)) warnings.push('evidência da autorização');
    if (!cleanText(permission.holder)) warnings.push('titular dos direitos');
    if (!(Array.isArray(permission.platforms) ? permission.platforms : []).length) warnings.push('plataformas permitidas');
    if (permission.migratedFromV3) warnings.push('revisão da migração do schema 3');
    return warnings;
  }
  function load() {
    var raw = '';
    try {
      raw = localStorage.getItem(KEY) || '';
      if (!raw) return seed();
      var clean = sanitizeState(parsed, { migrateLegacyApprovals: true });
      if (!clean) { BROKEN_RAW = raw; return seed(); }
      return clean;
    } catch (e) { BROKEN_RAW = raw; return seed(); }
  }
  function persist(options) {
    options = options || {};
    if (BROKEN_RAW) {
      toast('Os dados anteriores precisam ser recuperados ou resetados antes de salvar.', 'error');
      return false;
    }
    var previousRevision = Math.max(0, Math.floor(num(STATE.revision)));
    try {
      var storedRaw = localStorage.getItem(KEY);
      if (!options.force && storedRevision !== previousRevision) {
        toast('Outra aba alterou o Estúdio. Recarregue a página antes de salvar para não perder dados.', 'error');
        return false;
      }
      STATE.revision = Math.max(storedRevision, previousRevision) + 1;
      localStorage.setItem(KEY, JSON.stringify(STATE));
      return true;
    } catch (e) {
      STATE.revision = previousRevision;
      toast('Não foi possível salvar. Exporte o backup e libere espaço no navegador.', 'error');
      return false;
    }
  }
  function addLog(action, message, videoId, accountId) {
    STATE.logs.push({ id: uid('log'), at: nowISO(), action: action, message: message || '', videoId: videoId || '', accountId: accountId || '' });
  }
  function accountOf(id) { return STATE.accounts.find(function (account) { return account.id === id; }) || null; }
  function activeAccount() { return accountOf(ACTIVE_ACCOUNT) || STATE.accounts[0] || null; }
  function projectInfo() {
    var start = Date.parse(STATE.meta.start + 'T00:00:00');
    var elapsed = Math.floor((Date.now() - start) / 86400000);
    elapsed = Math.max(0, Math.min(DAYS, Number.isFinite(elapsed) ? elapsed : 0));
    return { day: Math.min(DAYS, elapsed + 1), elapsed: elapsed, remaining: DAYS - elapsed, percent: Math.round(elapsed / DAYS * 100) };
  }
  function fmtDateTime(value) {
    if (!value) return 'Sem horário';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }
  function metric(value) { return new Intl.NumberFormat('pt-BR', { notation: value >= 10000 ? 'compact' : 'standard' }).format(num(value)); }

  function refreshBadge() {
    var badge = document.getElementById('count-video-ops');
    if (!badge || !STATE) return;
    badge.textContent = STATE.videos.filter(function (video) { return video.approval === 'pending' || video.approval === 'changes'; }).length;
  }
  function headerHTML() {
    var info = projectInfo();
    var account = activeAccount();
    var options = STATE.accounts.map(function (item) {
      return '<option value="' + esc(item.id) + '"' + (item.id === (account && account.id) ? ' selected' : '') + '>' + esc(item.name) + ' · ' + esc(item.niche) + '</option>';
    }).join('');
    return '<header class="vop-head">'
      + '<div class="vop-head-copy"><span class="vop-kicker">Operação de 90 dias</span><h1>Estúdio de Vídeos</h1>'
      + '<p>Curadoria, aprovação, agenda e aprendizado — sem publicar nada sozinho.</p></div>'
      + '<div class="vop-project"><span>Dia ' + info.day + ' de ' + DAYS + '</span><div class="vop-progress"><i style="width:' + info.percent + '%"></i></div><small>' + info.remaining + ' dias restantes</small></div>'
      + '<div class="vop-head-actions">'
      + (BROKEN_RAW ? '<span class="vop-chip publication-error">Recuperação necessária</span>' : (STATE.accounts.length ? '<label class="vop-account-picker"><span>Conta ativa</span><select data-act="account-select">' +
options + '</select></label>' : '')
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="account-add">＋ Conta</button>'
      + (STATE.accounts.length ? '<button class="vop-btn vop-btn-prima
      + '</div></header>';
  }
  function tabsHTML() {
    var tabs = [
      ['queue', 'Fila', STATE.videos.length],
      ['accounts', 'Contas', STATE.accounts.length],
      ['reports', 'Relatórios', '']
    ];
    return '<nav class="vop-tabs" aria-label="Áreas do estúdio">' + tabs.map(function (tab) {
      return '<button type="button" data-act="tab" data-tab="' + tab[0] + '" aria-pressed="' + (TAB === tab[0]) + '" class="' + (TAB === tab[0] ? 'active' : '') + '">' + tab[1] + (tab[2] !== '' ? '<span>' + tab[2] + '</
span>' : '') + '</button>';
    }).join('') + '</nav>';
  }
  function emptyHTML(title, text, action, label) {
    return '<div class="vop-empty"><div class="vop-empty-icon" aria-hidden="true">▶</div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>'
      + (action ? '<button class="vop-btn vop-btn-primary" type="button" data-act="' + action + '">' + esc(label) + '</button>' : '') + '</div>';
  }
    return '<section class="vop-empty vop-recovery"><div class="vop-empty-icon" aria-hidden="true">!</div><h2>Os dados locais precisam de recuperação</h2>'
      + '<p>O conteúdo salvo não foi reconhecido e permanece intacto no navegador. Baixe a cópia bruta antes de importar um backup válido ou começar de novo.</p>'
      + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="download-raw">Baixar dados brutos</button><button class="vop-btn vop-btn-primary" type="button" data-act="import-j
son">Importar backup</button><button class="vop-btn vop-btn-danger" type="button" data-act="reset-broken">Começar de novo</button></div></section>';
  }
  function goalHTML(account) {
    var day = PLAN_DAY || localDay();
    var goal = dailyGoal(STATE.videos, account.id, day);
    var viralPct = Math.min(100, goal.viral / 2 * 100);
    var recentPct = Math.min(100, goal.recent * 100);
    var title = account.paused ? 'Conta pausada' : goal.ready ? 'Dia pronto para publicar' : goal.complete ? 'Programação completa; falta aprovação' : 'Monte a programação do dia';
    return '<section class="vop-goal ' + (!account.paused && goal.ready ? 'complete' : '') + '">'
      + '<div class="vop-goal-head"><div><span class="vop-eyebrow">Meta diária</span><h2>' + title + '</h2></div>'
      + '<label class="vop-date"><span>Dia</span><input type="date" da
      + '<div><span>Virais antigos</span><strong>' + goal.viral + '/2</strong><div class="vop-progress"><i style="width:' + viralPct + '%"></i></div></div>'
      + '<div><span>Conteúdo recente</span><strong>' + goal.recent + '/1</strong><div class="vop-progress"><i style="width:' + recentPct + '%"></i></div></div>'
      + '<div><span>Total programado</span><strong>' + goal.total + '/3</strong><small>' + (account.paused ? 'Publicações suspensas até a retomada' : goal.ready ? 'Meta aprovada e pronta' : goal.complete ? goal.approved
 + ' de ' + goal.total + ' prontos' : 'A aprovação continua obrigatória') + '</small></div>'
      + '</div>' + (account.paused ? '<div class="vop-pause-note">Retome a conta na aba Contas antes de registrar qualquer publicação.</div>' : '') + '</section>';
  }
  function filteredVideos(account) {
    var query = SEARCH.toLowerCase();
    return STATE.videos.filter(function (video) {
      if (video.accountId !== account.id) return false;
      if (FILTER === 'pending' && video.approval !== 'pending' && video.approval !== 'changes') return false;
      if (FILTER === 'approved' && video.approval !== 'approved') return false;
      if (FILTER === 'scheduled' && video.publication !== 'scheduled') return false;
      if (FILTER === 'published' && video.publication !== 'published')
      if (FILTER === 'rejected' && video.approval !== 'rejected') return false;
      if (query && [video.name, video.title, video.platform, video.sourceUrl, video.hashtags].join(' ').toLowerCase().indexOf(query) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var aa = a.scheduledAt || '9999', bb = b.scheduledAt || '9999';
      return aa.localeCompare(bb) || String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }
  function videoCardHTML(video) {
    var rights = video.rightsConfirmed && video.nicheConfirmed;
    var source = safeUrl(video.driveUrl || video.sourceUrl);
    var metrics = video.metrics || {};
    return '<article class="vop-video-card">'
      + '<div class="vop-video-main"><div class="vop-video-top"><span class="vop-kind">' + esc(KIND_LABEL[video.kind] || video.kind) + '</span>'
      + '<span class="vop-chip approval-' + esc(video.approval) + '">' + esc(APPROVAL_LABEL[video.approval] || video.approval) + '</span>'
      + '<span class="vop-chip publication-' + esc(video.publication) + '">' + esc(PUBLICATION_LABEL[video.publication] || video.publication) + '</span></div>'
      + '<h3>' + esc(video.title || video.name) + '</h3><p>' + esc(video.name) + '</p>'
      + '<div class="vop-video-meta"><span>' + esc(video.platform || 'Sem plataforma') + '</span><span>' + esc(fmtDateTime(video.scheduledAt)) + '</span>'
      + (source ? '<a href="' + esc(source) + '" target="_blank" rel="noopener">Abrir origem ↗</a>' : '<span>Arquivo local</span>') + '</div>'
      + (!rights ? '<div class="vop-warning">Falta confirmar ' + (!video.rightsConfirmed ? 'direitos de uso' : 'compatibilidade com o nicho') + '.</div>' : '')
      + (video.reviewNote ? '<div class="vop-note">Revisão: ' + esc(video.reviewNote) + '</div>' : '') + '</div>'
      + '<div class="vop-video-side">'
      + (video.publication === 'published' ? '<div class="vop-mini-metrics"><strong>' + metric(metrics.views) + '</strong><span>views</span><small>' + metric(num(metrics.likes) + num(metrics.comments) + num(metrics.shar
es)) + ' interações</small></div>' : '')
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="video-open" data-id="' + esc(video.id) + '">Revisar</button></div></article>';
  }
  function listInnerHTML(account) {
    var videos = filteredVideos(account);
    if (!videos.length) return '<div class="vop-list-empty">Nenhum vídeo corresponde a este filtro.</div>';
    return videos.map(videoCardHTML).join('');
  }
  function queueHTML(account) {
    var filters = [['all', 'Todos'], ['pending', 'Para aprovar'], ['approved', 'Aprovados'], ['scheduled', 'Agendados'], ['published', 'Publicados'], ['error', 'Erros'], ['rejected', 'Rejeitados']];
    return goalHTML(account)
      + '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Pipeline</span><h2>Fila de conteúdo</h2></div>'
      + '<div class="vop-tools"><input class="vop-search" type="search" data-act="search" value="' + esc(SEARCH) + '" placeholder="Buscar vídeo…" aria-label="Buscar vídeo"><button class="vop-btn vop-btn-primary" type="b
utton" data-act="video-add">＋ Adicionar</button></div></div>'
      + '<div class="vop-filters">' + filters.map(function (filter) {
        return '<button type="button" data-act="filter" data-filter="' + filter[0] + '" aria-pressed="' + (FILTER === filter[0]) + '" class="' + (FILTER === filter[0] ? 'active' : '') + '">' + filter[1] + '</button>';
      }).join('') + '</div><div class="vop-video-list" data-vop-list>' + listInnerHTML(account) + '</div></section>';
  }
  function accountsHTML() {
    if (!STATE.accounts.length) return emptyHTML('Cadastre a primeira conta', 'Informe nome, nicho e plataformas antes de receber os vídeos.', 'account-add', 'Criar conta');
    return '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Configuração</span><h2>Contas e nichos</h2></div><button class="vop-btn vop-btn-primary" type="button" data-act="acco
unt-add">＋ Conta</button></div>'
      + '<div class="vop-account-grid">' + STATE.accounts.map(function (account) {
        var drive = safeUrl(account.driveRoot);
        return '<article class="vop-account-card ' + (account.paused ? 'paused' : '') + '"><div class="vop-account-title"><div><h3>' + esc(account.name) + '</h3><p>' + esc(account.niche) + '</p></div>'
          + '<span class="vop-chip ' + (account.paused ? 'publication-error' : 'publication-published') + '">' + (account.paused ? 'Pausada' : 'Ativa') + '</span></div>'
          + '<div class="vop-platforms">' + account.platforms.map(function (platform) { return '<span>' + esc(platform) + '</span>'; }).join('') + '</div>'
          + '<div class="vop-account-meta"><span>Fuso: ' + esc(account.timezone || 'Local do navegador') + '</span><span>' + STATE.videos.filter(function (video) { return video.accountId === account.id; }).length + ' ví
deos</span></div>'
          + '<div class="vop-card-actions">' + (drive ? '<a class="vop-btn vop-btn-quiet" href="' + esc(drive) + '" target="_blank" rel="noopener">Abrir Drive ↗</a>' : '')
          + '<button class="vop-btn vop-btn-secondary" type="button" data-act="account-edit" data-id="' + esc(account.id) + '">Editar</button>'
          + '<button class="vop-btn ' + (account.paused ? 'vop-btn-pri
 '</button></div></article>';
      }).join('') + '</div></section>';
  }
  function insightHTML(report, account) {
    var notes = [];
    var created = Date.parse(account.createdAt || '');
    var activeDays = Number.isFinite(created) ? Math.min(report.days, Math.max(1, Math.floor((Date.now() - created) / 86400000) + 1)) : report.days;
    var target = activeDays * 3;
    if (account.paused) notes.push('A conta está pausada; a meta de novas publicações fica suspensa até a retomada.');
    else if (report.published.length < target) notes.push('Foram publicados ' + report.published.length + ' de ' + target + ' vídeos previstos desde a criação da conta neste período.');
    if (report.errors.length) notes.push('Há ' + report.errors.length + ' erro(s) para revisar antes de ampliar o volume.');
    if (report.rejected.length) notes.push(report.rejected.length + ' conteúdo(s) rejeitado(s) ajudam a ajustar os critérios de curadoria.');
    if (!notes.length) notes.push('A operação de ' + account.name + ' está sem alertas neste período.');
    return '<div class="vop-insights"><h3>Próxima melhoria</h3>' + not
  function logsHTML(account) {
    var logs = STATE.logs.filter(function (log) { return !log.accountId || log.accountId === account.id; }).slice(-12).reverse();
    return '<div class="vop-log"><div><h3>Histórico da automação</h3><p>Ações e bloqueios ficam preservados no backup.</p></div><div class="vop-log-list">'
      + (logs.length ? logs.map(function (log) {
        return '<div><time>' + esc(fmtDateTime(log.at)) + '</time><span><strong>' + esc(log.action || 'registro') + '</strong>' + (log.message ? ' · ' + esc(log.message) : '') + '</span></div>';
      }).join('') : '<p>Nenhuma ação registrada ainda.</p>') + '</div></div>';
  }
  function reportsHTML(account) {
    var report = buildReport(STATE, account.id, REPORT_DAYS, new Date());
    var best = report.best ? engagement(report.best) : null;
    var worst = report.worst ? engagement(report.worst) : null;
    return '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Aprendizado</span><h2>Relatório da operação</h2></div>'
      + '<div class="vop-report-range">' + [7, 30, 90].map(function (days) { return '<button type="button" data-act="report-range" data-days="' + days + '" aria-pressed="' + (REPORT_DAYS === days) + '" class="' + (REPOR
T_DAYS === days ? 'active' : '') + '">' + (days === 7 ? 'Semanal' : da
      + '<div class="vop-stat"><span>Publicados</span><strong>' + report.published.length + '</strong><small>nos últimos ' + report.days + ' dias</small></div>'
      + '<div class="vop-stat"><span>Visualizações</span><strong>' + metric(report.totals.views) + '</strong><small>' + metric(report.totals.likes + report.totals.comments + report.totals.shares) + ' interações</small><
/div>'
      + '<div class="vop-stat"><span>Erros</span><strong>' + report.errors.length + '</strong><small>' + report.rejected.length + ' rejeitados</small></div>'
      + '<div class="vop-stat"><span>Melhor horário</span><strong>' + esc(report.bestHour || '—') + '</strong><small>por taxa de engajamento</small></div></div>'
      + '<div class="vop-performance"><article><span>Melhor desempenho</span><h3>' + esc(report.best ? (report.best.title || report.best.name) : 'Sem dados publicados') + '</h3>' + (best ? '<p>' + (best.rate * 100).toFi
xed(2).replace('.', ',') + '% de engajamento</p>' : '') + '</article>'
      + '<article><span>Pior desempenho</span><h3>' + esc(report.worst ? (report.worst.title || report.worst.name) : 'Dados insuficientes') + '</h3>' + (worst ? '<p>' + (worst.rate * 100).toFixed(2).replace('.', ',') +
'% de engajamento</p>' : '') + '</article></div>'
      + insightHTML(report, account)
      + logsHTML(account)
      + '<div class="vop-export"><div><h3>Dados e Google Drive</h3><p>Na Fase 1, arquivos e publicação continuam manuais; o painel guarda links e metadados, nunca vídeos ou credenciais.</p></div><div class="vop-card-act
ions">'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-
n>';
  }
  function render() {
    var root = document.getElementById('video-ops-root');
    if (!root || !STATE) return;
    if (BROKEN_RAW) {
      root.innerHTML = headerHTML() + '<main class="vop-body">' + recoveryHTML() + '</main><input type="file" id="vop-import-file" accept="application/json,.json" hidden>';
      refreshBadge();
      return;
    }
    if (!accountOf(ACTIVE_ACCOUNT)) ACTIVE_ACCOUNT = STATE.accounts[0] ? STATE.accounts[0].id : '';
    if (!PLAN_DAY) PLAN_DAY = localDay();
    var account = activeAccount();
    var body = '';
    if (!STATE.accounts.length) { TAB = 'accounts'; body = accountsHTML(); }
    else if (TAB === 'accounts') body = accountsHTML();
    else if (TAB === 'reports') body = reportsHTML(account);
    else body = queueHTML(account);
    root.innerHTML = headerHTML() + tabsHTML() + '<main class="vop-body">' + body + '</main><input type="file" id="vop-import-file" accept="application/json,.json" hidden>';
    refreshBadge();
  }
  function refreshList() {
    var root = document.getElementById('video-ops-root');
    var list = root && root.querySelector('[data-vop-list]');
    var account = activeAccount();
    if (list && account) list.innerHTML = listInnerHTML(account);
  }

  function ensureToast() {
    if (TOAST) return TOAST;
    TOAST = document.createElement('div');
    TOAST.className = 'vop-toast';
    TOAST.setAttribute('role', 'status');
    TOAST.setAttribute('aria-live', 'polite');
    document.body.appendChild(TOAST);
    return TOAST;
  }
  function toast(message, tone) {
    if (typeof document === 'undefined') return;
    var el = ensureToast();
    clearTimeout(el._hideTimer);
    el.textContent = message;
    el.dataset.tone = tone || 'ok';
    el.dataset.show = 'true';
    el._hideTimer = setTimeout(function () { el.dataset.show = 'false'; }, 3800);
  }
  function closeDialog() {
    if (TEMP_PREVIEW) { URL.revokeObjectURL(TEMP_PREVIEW); TEMP_PREVIEW = ''; }
    if (DIALOG && DIALOG.open) DIALOG.close();
  }
  function ensureDialog() {
    if (DIALOG) return DIALOG;
    DIALOG = document.createElement('dialog');
    DIALOG.className = 'vop-dialog';
    DIALOG.addEventListener('cancel', function () { closeDialog(); });
    DIALOG.addEventListener('click', onDialogClick);
    DIALOG.addEventListener('change', onDialogChange);
    DIALOG.addEventListener('submit', function (event) {
      event.preventDefault();
      var form = event.target;
      if (form.dataset.kind === 'account') saveAccountForm(form);
      if (form.dataset.kind === 'video') saveVideoForm(form, 'save');
    });
    document.body.appendChild(DIALOG);
    return DIALOG;
  }
  function openModal(html) {
    var dialog = ensureDialog();
    dialog.innerHTML = html;
    dialog.classList.toggle('vop-dialog-wide-host', !!dialog.querySelector('.vop-dialog-wide'));
    dialog.setAttribute('aria-labelledby', 'vop-dialog-title');
    dialog.showModal();
    if (first) requestAnimationFrame(function () { first.focus(); });
  }
  function field(label, name, value, attrs) {
    return '<label class="vop-field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" value="' + esc(value || '') + '" ' + (attrs || '') + '></label>';
  }
  function accountDialogHTML(account) {
    var edit = !!account;
    var timezone = account && account.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo');
    return '<form class="vop-dialog-card" data-kind="account" data-id="' + esc(account && account.id || '') + '"><div class="vop-dialog-head"><div><span class="vop-eyebrow">' + (edit ? 'Editar conta' : 'Nova conta') + '
</span><h2 id="vop-dialog-title">' + (edit ? esc(account.name) : 'Configure o primeiro nicho') + '</h2></div><button type="button" class="vop-icon-btn" data-dialog-act="close" aria-label="Fechar">×</button></div>'
      + '<div class="vop-form-grid">' + field('Nome da conta', 'name', account && account.name, 'required maxlength="80"') + field('Nicho', 'niche', account && account.niche, 'required maxlength="100"')
      + field('Plataforma da conta', 'platform', account && account.platforms[0] || 'TikTok', 'required maxlength="60"') + field('Fuso horário de referência', 'timezone', timezone, 'required maxlength="80"')
      + '<label class="vop-field vop-field-wide"><span>Pasta raiz no Google Drive (opcional)</span><input name="driveRoot" type="url" value="' + esc(account && account.driveRoot || '') + '" placeholder="https://drive.go
ogle.com/…"></label></div>'
      + '<p class="vop-form-note">O link serve para organização manual nesta fase. OAuth e credenciais nunca serão salvos no frontend.</p>'
      + '<div class="vop-dialog-foot"><button class="vop-btn vop-btn-quiet" type="button" data-dialog-act="close">Cancelar</button><button class="vop-btn vop-btn-primary" type="submit">' + (edit ? 'Salvar conta' : 'Cria
r conta') + '</button></div></form>';
  }
  function openAccountDialog(id) { openModal(accountDialogHTML(id ? accountOf(id) : null)); }
  function platformOptions(account, selected) {
    return (account && account.platforms || []).map(function (platform) {
      return '<option value="' + esc(platform) + '"' + (platform === selected ? ' selected' : '') + '>' + esc(platform) + '</option>';
    }).join('');
  }
  function previewHTML(video) {
    var src = video && (SESSION_FILES[video.id] || safeUrl(video.driveUrl) || safeUrl(video.sourceUrl));
    var playable = src && (/^blob:/.test(src) || /\.(mp4|webm|mov)(\?|$)/i.test(src));
    if (playable) return '<video class="vop-preview" controls preload="metadata" src="' + esc(src) + '"></video>';
    if (src) return '<div class="vop-preview-placeholder"><span>Prévia externa</span><a href="' + esc(src) + '" target="_blank" rel="noopener">Abrir vídeo em nova aba ↗</a></div>';
    return '<div class="vop-preview-placeholder"><span>Nenhuma prévia selecionada</span><small>Escolha um arquivo local ou informe um link.</small></div>';
  }
  function videoDialogHTML(video) {
    var edit = !!video;
    var account = accountOf(video && video.accountId) || activeAccount();
    var value = video || {
      accountId: account && account.id, name: '', sourceUrl: '', driveUrl: '', foundAt: localDay(), kind: 'viral', platform: account && account.platforms[0] || '', title: '', caption: '', hashtags: '', scheduledAt: '',
rightsConfirmed: false, nicheConfirmed: false, reviewNote: '', publishedUrl: '', error: '', metrics: { views: 0, likes: 0, comments: 0, shares: 0 }, approval: 'pending', publication: 'draft'
  /* Achata fonte + corte + variante + conta na forma que a lógica de aprovação já
     consumia no schema 3. É o que permite reaproveitar approvalIssues, sensitiveSnapshot,
     dailyGoal, buildReport e toCsv sem reescrevê-los sobre o modelo novo. */
  function resolveVariant(state, variant) {
    if (!variant) return null;
    var clip = findById(state.clips, variant.clipId);
    var source = clip ? findById(state.sources, clip.sourceId) : null;
    var account = findById(state.accounts, variant.accountId);
    var permission = source ? findById(state.permissions, source.permissionId) : null;
    var creator = source ? findById(state.creators, source.creatorId) : null;
    var platform = account ? account.platform : '';
    var day = String(variant.scheduledAt || '').slice(0, 10);
    return {
      id: variant.id,
      accountId: variant.accountId,
      clipId: variant.clipId,
      sourceId: source ? source.id : '',
      clip: clip, source: source, account: account, permission: permission, creator: creator,
      name: clip ? clip.name : '',
      sourceUrl: source ? source.sourceUrl : '',
      driveUrl: source ? source.driveUrl : '',
      fileMeta: source ? source.fileMeta : null,
      sourceKey: source ? source.sourceKey : '',
      foundAt: source ? source.foundAt : '',
      sourceStatus: source ? source.status : '',
      kind: clip ? clip.kind : 'viral',
      platform: platform,
      rightsConfirmed: permissionCovers(permission, platform, day),
      nicheConfirmed: !!variant.nicheConfirmed,
      title: variant.title,
      caption: variant.caption,
      hashtags: variant.hashtags,
      scheduledAt: variant.scheduledAt,
      publishedUrl: variant.publishedUrl,
      error: variant.error,
      metrics: variant.metrics || {},
      approval: variant.approval,
      publication: variant.publication,
      approvedSnapshot: variant.approvedSnapshot,
      driveVersion: Math.max(1, num(variant.driveVersion) || 1),
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      publishedAt: variant.publishedAt
    };
    var accounts = STATE.accounts.map(function (item) { return '<option value="' + esc(item.id) + '"' + (item.id === value.accountId ? ' selected' : '') + '>' + esc(item.name) + ' · ' + esc(item.niche) + '</option>'; })
.join('');
    var metrics = value.metrics || {};
    var actions = '';
    if (edit && value.publication !== 'published') {
      if (value.approval !== 'approved') actions += '<button class="vop-btn vop-btn-primary" type="button" data-dialog-act="approve">Aprovar e agendar</button>';
      if (value.approval !== 'rejected') actions += '<button class="vop-btn vop-btn-secondary" type="button" data-dialog-act="changes">Pedir ajustes</button><button class="vop-btn vop-btn-danger" type="button" data-dial
og-act="reject">Rejeitar</button>';
      if (value.approval === 'approved' && value.publication === 'scheduled') actions += '<button class="vop-btn vop-btn-primary" type="button" data-dialog-act="publish">Registrar como publicado</button><button class="v
op-btn vop-btn-danger" type="button" data-dialog-act="error">Registrar erro</button>';
      if (value.publication === 'error') actions += '<button class="vop-btn vop-btn-secondary" type="button" data-dialog-act="retry">Reagendar</button>';
    }
    return '<form class="vop-dialog-card vop-dialog-wide" data-kind="video" data-id="' + esc(value.id || '') + '"><div class="vop-dialog-head"><div><span class="vop-eyebrow">' + (edit ? 'Revisão do conteúdo' : 'Receber
conteúdo') + '</span><h2 id="vop-dialog-title">' + esc(edit ? (value.t
      + '<div class="vop-dialog-layout"><div class="vop-dialog-fields"><div class="vop-form-grid">'
      + '<label class="vop-field"><span>Conta e nicho</span><select name="accountId" required>' + accounts + '</select></label>'
      + field('Nome interno / tema', 'name', value.name, 'required maxlength="140"')
      + '<label class="vop-field"><span>Tipo de conteúdo</span><select name="kind"><option value="viral"' + (value.kind === 'viral' ? ' selected' : '') + '>Viral antigo</option><option value="recent"' + (value.kind ===
'recent' ? ' selected' : '') + '>Conteúdo recente</option><option value="own"' + (value.kind === 'own' ? ' selected' : '') + '>Conteúdo próprio</option></select></label>'
      + '<label class="vop-field"><span>Plataforma de destino</span><select name="platform" required>' + platformOptions(account, value.platform) + '</select></label>'
      + field('Link / origem', 'sourceUrl', value.sourceUrl, 'type="url" placeholder="https://…"') + field('Data encontrada', 'foundAt', value.foundAt || localDay(), 'type="date" required')
      + field('Link do arquivo no Drive', 'driveUrl', value.driveUrl, 'type="url" placeholder="https://drive.google.com/…"')
      + '<label class="vop-field"><span>Arquivo local (não é armazenado)</span><input name="localFile" type="file" accept="video/*"><small>' + esc(value.fileMeta && value.fileMeta.name || 'Use para prévia nesta sessão')
 + '</small></label>'
      + '<label class="vop-field vop-field-wide"><span>Título</span><input name="title" value="' + esc(value.title) + '" maxlength="180"><button class="vop-inline-action" type="button" data-dialog-act="suggest-copy">Sug
erir texto local</button></label>'
      + '<label class="vop-field vop-field-wide"><span>Legenda</span><textarea name="caption" rows="4" maxlength="2200">' + esc(value.caption) + '</textarea></label>'
      + '<label class="vop-field vop-field-wide"><span>Hashtags</span>
      + '<label class="vop-field"><span>Data e horário</span><input name="scheduledAt" type="datetime-local" value="' + esc(String(value.scheduledAt || '').slice(0, 16)) + '"><button class="vop-inline-action" type="butt
on" data-dialog-act="suggest-time">Sugerir próximo horário</button></label>'
      + '<div class="vop-checks"><label><input name="rightsConfirmed" type="checkbox"' + (value.rightsConfirmed ? ' checked' : '') + '> Conteúdo próprio, licenciado ou autorizado</label><label><input name="nicheConfirme
d" type="checkbox"' + (value.nicheConfirmed ? ' checked' : '') + '> Compatível com o nicho da conta</label></div>'
      + '<label class="vop-field vop-field-wide"><span>Observações da revisão</span><textarea name="reviewNote" rows="2">' + esc(value.reviewNote) + '</textarea></label>'
      + '<label class="vop-field vop-field-wide"><span>Link da postagem publicada</span><input name="publishedUrl" type="url" value="' + esc(value.publishedUrl) + '" placeholder="Obrigatório ao registrar a publicação"><
/label>'
      + '<label class="vop-field vop-field-wide"><span>Erro encontrado</span><textarea name="error" rows="2">' + esc(value.error) + '</textarea></label>'
      + '<fieldset class="vop-metrics vop-field-wide"><legend>Métricas</legend>' + field('Visualizações', 'views', metrics.views, 'type="number" min="0" step="1"') + field('Curtidas', 'likes', metrics.likes, 'type="numb
er" min="0" step="1"') + field('Comentários', 'comments', metrics.comments, 'type="number" min="0" step="1"') + field('Compartilhamentos', 'shares', metrics.shares, 'type="number" min="0" step="1"') + '</fieldset>'
      + '</div></div><aside class="vop-dialog-preview"><div data-preview>' + previewHTML(value) + '</div>'
      + (edit ? '<div class="vop-audit"><span class="vop-chip approval-' + esc(value.approval) + '">' + esc(APPROVAL_LABEL[value.approval]) + '</span><span class="vop-chip publication-' + esc(value.publication) + '">' +
 esc(PUBLICATION_LABEL[value.publication]) + '</span><small>Alterações em arquivo, texto, destino ou horário exigem nova aprovação.</small></div>' : '<p class="vop-form-note">O vídeo não será salvo no navegador; somente
 os metadados e links deste formulário.</p>') + '</aside></div>'
      + '<div class="vop-dialog-foot vop-dialog-foot-wrap"><div class="vop-review-actions">' + actions + '</div><div><button class="vop-btn vop-btn-quiet" type="button" data-dialog-act="close">Cancelar</button><button c
lass="vop-btn vop-btn-secondary" type="submit">Salvar</button></div></div></form>';
  }
  function openVideoDialog(id) { openModal(videoDialogHTML(id ? STATE.videos.find(function (video) { return video.id === id; }) : null)); }

  function saveAccountForm(form) {
    var before = JSON.stringify(STATE);
    var activeBefore = ACTIVE_ACCOUNT;
    var data = new FormData(form);
    var name = String(data.get('name') || '').trim();
    var niche = String(data.get('niche') || '').trim();
    var platform = String(data.get('platform') || '').trim();
    var platforms = platform ? [platform] : [];
    if (!name || !niche || !platform) { toast('Preencha nome, nicho e plataforma da conta.', 'error'); return; }
    var id = form.dataset.id;
    var account = id ? accountOf(id) : null;
    if (account) STATE.videos.forEach(function (video) {
      if (video.accountId === account.id && video.publication === 'published' && platforms.indexOf(video.platform) < 0) platforms.push(video.platform);
    });
    var oldNiche = account && account.niche;
    var oldPlatforms = account ? account.platforms.slice() : [];
    var driveRootRaw = String(data.get('driveRoot') || '').trim();
    if (driveRootRaw && !safeUrl(driveRootRaw)) { toast('Informe um link HTTP(S) válido para a pasta do Drive.', 'error'); return; }
    if (!account) {
      account = { id: uid('acc'), createdAt: nowISO(), paused: false };
      STATE.accounts.push(account);
      ACTIVE_ACCOUNT = account.id;
    }
    account.name = name;
    account.niche = niche;
    account.platforms = platforms;
    account.timezone = String(data.get('timezone') || '').trim();
    account.driveRoot = safeUrl(driveRootRaw);
      STATE.videos.forEach(function (video) {
        if (video.accountId !== account.id || video.publication === 'published') return;
        if (oldNiche !== niche) video.nicheConfirmed = false;
        video.approval = 'pending';
        video.publication = 'draft';
        video.approvedSnapshot = '';
      });
      addLog('account_scope_changed', 'Nicho ou plataformas alterados; conteúdos pendentes precisam de nova aprovação.', '', account.id);
    }
    addLog(id ? 'account_updated' : 'account_created', name, '', account.id);
    if (!persist()) { STATE = JSON.parse(before); ACTIVE_ACCOUNT = activeBefore; return; }
    closeDialog();
    TAB = 'accounts';
    render();
  function resolveAll(state) {
    return (state.variants || []).map(function (variant) { return resolveVariant(state, variant); }).filter(Boolean);
  }
  function sensitiveSnapshot(video) {
    return JSON.stringify([video.accountId, storedSourceKeys(video), video.kind, video.platform, video.title, video.caption, video.hashtags, video.scheduledAt, !!video.rightsConfirmed, !!video.nicheConfirmed]);
  /* Aceita tanto o estado v4 quanto fixtures/backups v3 achatados. */
  function reportItems(state) {
    return Array.isArray(state && state.videos) ? state.videos : resolveAll(state || {});
  }
  function readVideoForm(form, existing) {
    var data = new FormData(form);
    var input = form.querySelector('input[name=localFile]');
    var file = input && input.files && input.files[0];
    var fileMeta = file ? { name: file.name, size: file.size, lastModi
      id: existing && existing.id || uid('vid'),
      accountId: String(data.get('accountId') || ''),
      name: String(data.get('name') || '').trim(),
      sourceUrl: String(data.get('sourceUrl') || '').trim(),
      driveUrl: String(data.get('driveUrl') || '').trim(),
      fileMeta: fileMeta,
      foundAt: String(data.get('foundAt') || ''),
      kind: String(data.get('kind') || 'viral'),
      platform: String(data.get('platform') || ''),
      title: String(data.get('title') || '').trim(),
      caption: String(data.get('caption') || '').trim(),
      hashtags: String(data.get('hashtags') || '').trim(),
      scheduledAt: String(data.get('scheduledAt') || ''),
      rightsConfirmed: data.get('rightsConfirmed') === 'on',
      reviewNote: String(data.get('reviewNote') || '').trim(),
      publishedUrl: String(data.get('publishedUrl') || '').trim(),
      error: String(data.get('error') || '').trim(),
      metrics: { views: num(data.get('views')), likes: num(data.get('likes')), comments: num(data.get('comments')), shares: num(data.get('shares')) },
      updatedAt: nowISO()
    });
    video.sourceKey = makeSourceKey(video);
    if (!existing) {
      video.createdAt = video.updatedAt;
      video.approval = 'pending';
      video.publication = 'draft';
      video.publishedAt = '';
    }
    return { video: video, file: file };
  }
  function saveVideoForm(form, action) {
    var before = JSON.stringify(STATE);
    var pendingLogs = [];
    var existing = form.dataset.id ? STATE.videos.find(function (video) { return video.id === form.dataset.id; }) : null;
    var result = readVideoForm(form, existing);
    var video = result.video;
    var account = accountOf(video.accountId);
    if (!account || !video.name || !video.foundAt || !video.platform) { toast('Preencha conta, nome, data e plataforma.', 'error'); return; }
    if (account.platforms.indexOf(video.platform) < 0) { toast('Escolha uma plataforma vinculada à conta.', 'error'); return; }
    if (video.sourceUrl && !safeUrl(video.sourceUrl)) { toast('Informe um link HTTP(S) válido para a origem.', 'error'); return; }
    if (video.driveUrl && !safeUrl(video.driveUrl)) { toast('Informe um link HTTP(S) válido para o arquivo no Drive.', 'error'); return; }
    if (video.publishedUrl && !safeUrl(video.publishedUrl)) { toast('Informe um link HTTP(S) válido para a postagem.', 'error'); return; }
    if (!video.sourceKey) { toast('Informe um link de origem, um link do Drive ou escolha um arquivo.', 'error'); return; }
    var duplicate = duplicateOf(STATE.videos, video, existing && existing.id);
    if (duplicate) { toast('Este vídeo já está registrado nesta conta: ' + (duplicate.title || duplicate.name) + '.', 'error'); return; }
    var changed = existing && sensitiveSnapshot(existing) !== sensitiveSnapshot(video);
    if (existing && existing.publication === 'published' && !safeUrl(video.publishedUrl)) {
      toast('Uma publicação concluída precisa manter o link da postagem.', 'error');
      return;
    }
    if (changed && existing.publication === 'published') {
      toast('Conteúdo publicado fica preservado. Atualize somente link, métricas, erro ou observações.', 'error');
      return;
    }
    if (changed && existing.approval === 'approved' && existing.publication !== 'published') {
      video.approval = 'pending';
      video.publication = 'draft';
      video.approvedSnapshot = '';
      pendingLogs.push(['approval_invalidated', 'Conteúdo alterado após aprovação.']);
    }
    if (changed && (action === 'publish' || action === 'error' || action === 'retry')) {
      toast('Salve as alterações, revise e aprove novamente antes dessa ação.', 'error');
      return;
    }
    if (existing && existing.publication === 'published' && action !== 'save') { toast('A publicação concluída fica preservada no histórico.', 'error'); return; }
    if ((action === 'changes' || action === 'reject') && (!existing || existing.publication === 'published')) { toast('Esta transição de revisão não é válida.', 'error'); return; }
    if (action === 'approve') {
      var issues = approvalIssues(video, account, { hasLocalFile: !!(result.file || SESSION_FILES[video.id]) });
      if (issues.length) { toast('Antes de aprovar, complete: ' + issues.join(', ') + '.', 'error'); return; }
      video.approval = 'approved';
      video.publication = 'scheduled';
      video.error = '';
      video.approvedSnapshot = sensitiveSnapshot(video);
      pendingLogs.push(['approved', 'Aprovado e agendado para ' + fmtDateTime(video.scheduledAt) + '.']);
    } else if (action === 'changes' || action === 'reject') {
      if (!video.reviewNote) { toast('Escreva o motivo nas observações da revisão.', 'error'); return; }
      video.approval = action === 'changes' ? 'changes' : 'rejected';
      video.publication = 'draft';
      pendingLogs.push([action === 'changes' ? 'changes_requested' : 'rejected', video.reviewNote]);
    } else if (action === 'publish') {
      if (!existing || existing.publication !== 'scheduled') { toast('Somente um vídeo agendado pode ser registrado como publicado.', 'error'); return; }
      var publishIssues = publishingIssues(video, account, { hasLocalFile: !!(result.file || SESSION_FILES[video.id]) });
      if (publishIssues.length) { toast('Não é possível registrar a publicação: falta ' + publishIssues.join(', ') + '.', 'error'); return; }
      video.publication = 'published';
      video.publishedAt = nowISO();
      video.error = '';
      pendingLogs.push(['published_manual', video.publishedUrl]);
    } else if (action === 'error') {
      if (!existing || existing.approval !== 'approved' || existing.publication !== 'scheduled') { toast('Somente uma publicação aprovada e agendada pode registrar erro.', 'error'); return; }
      if (!video.error) { toast('Descreva o erro encontrado antes de registrá-lo.', 'error'); return; }
      video.publication = 'error';
      pendingLogs.push(['publication_error', video.error]);
    } else if (action === 'retry') {
      video.publication = video.scheduledAt ? 'scheduled' : 'draft';
      video.error = '';
      pendingLogs.push(['rescheduled', fmtDateTime(video.scheduledAt)]);
    } else {
      if (!existing) pendingLogs.push(['video_received', video.name]);
      else pendingLogs.push(['video_updated', changed ? 'Conteúdo atualizado; revisão conferida.' : 'Metadados atualizados.']);
    }
    if (existing) STATE.videos[STATE.videos.indexOf(existing)] = video;
    else STATE.videos.push(video);
    pendingLogs.forEach(function (entry) { addLog(entry[0], entry[1], video.id, video.accountId); });
    if (!persist()) { STATE = JSON.parse(before); return; }
    if (result.file) {
      if (SESSION_FILES[video.id]) URL.revokeObjectURL(SESSION_FILES[video.id]);
      SESSION_FILES[video.id] = URL.createObjectURL(result.file);
    }
    closeDialog();
    TAB = 'queue';
    render();
    var messages = { approve: 'Vídeo aprovado e agendado.', changes: 'Ajustes solicitados.', reject: 'Vídeo rejeitado e mantido no histórico.', publish: 'Publicação manual registrada.', error: 'Erro registrado.', retry:
 'Vídeo reagendado.' };
    toast(messages[action] || (existing ? 'Vídeo atualizado.' : 'Vídeo recebido e enviado para aprovação.'));
  }
  function onDialogChange(event) {
    if (event.target.name === 'accountId') {
      var account = accountOf(event.target.value);
      var select = DIALOG.querySelector('select[name=platform]');
      if (select) select.innerHTML = platformOptions(account, '');
    }
    if (event.target.name === 'localFile' && event.target.files && event.target.files[0]) {
      if (TEMP_PREVIEW) URL.revokeObjectURL(TEMP_PREVIEW);
      TEMP_PREVIEW = URL.createObjectURL(event.target.files[0]);
      var target = DIALOG.querySelector('[data-preview]');
      if (target) target.innerHTML = '<video class="vop-preview" controls preload="metadata" src="' + esc(TEMP_PREVIEW) + '"></video>';
    }
  }
  function onDialogClick(event) {
    var button = event.target.closest('[data-dialog-act]');
    if (!button) return;
    var action = button.dataset.dialogAct;
    if (action === 'close') { closeDialog(); return; }
    var form = button.closest('form');
    if (!form) return;
    if (action === 'suggest-copy') {
      var account = accountOf(form.elements.accountId.value);
      var copy = suggestCopy(form.elements.name.value, account && account.niche);
      form.elements.title.value = copy.title;
      form.elements.caption.value = copy.caption;
      form.elements.hashtags.value = copy.hashtags;
      toast('Sugestão criada localmente. Revise antes de aprovar.');
      return;
    }
    if (action === 'suggest-time') {
      var slot = suggestSlot(STATE.videos, form.elements.accountId.value, form.elements.kind.value, new Date());
      if (!slot) { toast('Não encontrei horário livre nos próximos 90 dias.', 'error'); return; }
      form.elements.scheduledAt.value = slot;
      toast('Próximo horário livre sugerido.');
      return;
    }
    saveVideoForm(form, action);
  }

  function download(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type || 'text/plain;charset=utf-8' }));
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = document.execCommand('copy');
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }
  function importBackup(file) {
    file.text().then(function (text) {
      var imported = sanitizeState(JSON.parse(text), { resetExternalApprovals: true });
      if (!imported) throw new Error('Formato inválido');
      if (!confirm('Substituir os dados atuais pelo backup selecionado?')) return;
      var before = STATE;
      var activeBefore = ACTIVE_ACCOUNT;
      var brokenBefore = BROKEN_RAW;
      STATE = imported;
      STATE.revision = before.revision;
      ACTIVE_ACCOUNT = STATE.accounts[0] ? STATE.accounts[0].id : '';
      BROKEN_RAW = '';
      if (!persist({ force: !!brokenBefore })) { STATE = before; ACTIVE_ACCOUNT = activeBefore; BROKEN_RAW = brokenBefore; return; }
      render();
      toast('Backup importado com sucesso.');
    }).catch(function () { toast('O arquivo não é um backup válido do Estúdio de Vídeos.', 'error'); });
  }
  function onRootChange(event) {
    if (event.target.matches('[data-act=account-select]')) { ACTIVE_ACCOUNT = event.target.value; render(); return; }
    if (event.target.matches('[data-act=plan-day]')) { PLAN_DAY = event.target.value || localDay(); render(); return; }
    if (event.target.id === 'vop-import-file' && event.target.files[0]) importBackup(event.target.files[0]);
  }
  function onRootInput(event) {
    if (!event.target.matches('[data-act=search]')) return;
    SEARCH = event.target.value;
    refreshList();
  }
  function onRootClick(event) {
    var button = event.target.closest('[data-act]');
    if (!button) return;
    var action = button.dataset.act;
    if (action === 'tab') { TAB = button.dataset.tab; render(); }
    else if (action === 'filter') { FILTER = button.dataset.filter; render(); }
    else if (action === 'account-add') openAccountDialog();
    else if (action === 'account-edit') openAccountDialog(button.dataset.id);
    else if (action === 'video-add') openVideoDialog();
    else if (action === 'video-open') openVideoDialog(button.dataset.id);
    else if (action === 'account-pause') {
      var account = accountOf(button.dataset.id);
      if (!account) return;
      var before = JSON.stringify(STATE);
      account.paused = !account.paused;
      addLog(account.paused ? 'account_paused' : 'account_resumed', account.name, '', account.id);
      if (!persist()) { STATE = JSON.parse(before); return; }
      render();
      toast(account.paused ? 'Conta pausada. Nenhuma publicação poderá ser registrada.' : 'Conta retomada.');
    }
    else if (action === 'report-range') { REPORT_DAYS = Number(button.dataset.days); render(); }
    else if (action === 'export-csv') { download('operacao-videos-' + localDay() + '.csv', toCsv(STATE), 'text/csv;charset=utf-8'); toast('Planilha CSV exportada.'); }
    else if (action === 'export-json') { download('backup-video-ops-' + localDay() + '.json', JSON.stringify(STATE, null, 2), 'application/json'); toast('Backup JSON exportado.'); }
    else if (action === 'import-json') { var input = document.getElementById('vop-import-file'); if (input) input.click(); }
    else if (action === 'download-raw') { download('video-ops-recuperacao-' + localDay() + '.json', BROKEN_RAW, 'application/json'); toast('Cópia bruta baixada.'); }
    else if (action === 'reset-broken') {
      if (!confirm('Começar de novo? Baixe os dados brutos antes; esta ação substitui o conteúdo local que não pôde ser lido.')) return;
      var rawBefore = BROKEN_RAW;
      try { localStorage.removeItem(KEY); } catch (e) { toast('Não foi possível limpar o armazenamento local.', 'error'); return; }
      BROKEN_RAW = '';
      STATE = seed();
      ACTIVE_ACCOUNT = '';
      if (!persist()) { BROKEN_RAW = rawBefore; try { localStorage.set
      toast('Estúdio reiniciado.');
    }
    else if (action === 'drive-tree') {
      copyText(driveTree(STATE)).then(function () { toast('Estrutura de pastas copiada. Cole-a no seu checklist do Drive.'); }).catch(function () { toast('Não consegui copiar. Exporte o backup e tente novamente.', 'erro
r'); });
    }
  }
  function init() {
    var root = document.getElementById('video-ops-root');
    if (!root) return;
    STATE = load();
    if (!localStorage.getItem(KEY)) persist();
    ACTIVE_ACCOUNT = STATE.accounts[0] ? STATE.accounts[0].id : '';
    PLAN_DAY = localDay();
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
    root.addEventListener('input', onRootInput);
    render();
    window.videoOpsRefresh = render;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      seed: seed,
      sanitizeState: sanitizeState,
      sourceKeys: sourceKeys,
      normalizeSource: normalizeSource,
      makeSourceKey: makeSourceKey,
      duplicateOf: duplicateOf,
      approvalIssues: approvalIssues,
      publishingIssues: publishingIssues,
      sensitiveSnapshot: sensitiveSnapshot,
      dailyGoal: dailyGoal,
      engagement: engagement,
      buildReport: buildReport,
      suggestCopy: suggestCopy,
      suggestSlot: suggestSlot,
      toCsv: toCsv,
      driveTree: driveTree
    };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
/*__BLOCO_2__*/
})();

Duas regex saíram com caracteres literais onde eu queria escapes — corrigindo antes de seguir:

● Update(~\Downloads\seller-arthur\video-ops.js)
Error editing file

● Update(~\Downloads\seller-arthur\video-ops.js)
Error editing file

Preciso ver os bytes reais que foram gravados:

  Ran 2 shell commands

Linhas 77 e 103 têm caracteres de controle literais (inclusive um NUL) porque digitei os caracteres em vez dos escapes. As regex funcionam, mas NUL em fonte JS é armadilha real — git pode tratar o arquivo como binário. Edit não consegue casar esses bytes, então corrijo com um patch pontual:

  Ran 1 shell command
Here-string mangled as quotes. Escrevendo o patch em arquivo:

  Made 1 scratchpad edit +20, ran 1 shell command

Escapes corrigidos, nenhum caractere de controle literal restou. Bloco 2 — migração v3→v4, saneamento e persistência:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 123 lines, removed 1 line
  function reportItems(state) {
    return Array.isArray(state && state.videos) ? state.videos : resolveAll(state || {});
  }
/*__BLOCO_2__*/
  function seed(start) {
    return {
      version: SCHEMA_VERSION, revision: 0,
      meta: { start: start || localDay(), days: DAYS },
      editorialLines: [], creators: [], permissions: [], accounts: [],
      sources: [], clips: [], variants: [], driveArtifacts: [], logs: []
    };
  }

  /* Schema 3 → 4. Determinística e sem perda: cada vídeo achatado vira fonte + corte +
     variante, o id do vídeo é preservado como id da variante (os logs continuam válidos)
     e uma conta com várias plataformas é DIVIDIDA em uma conta por plataforma.
     O booleano rightsConfirmed vira uma autorização sintética marcada migratedFromV3,
     que aparece na interface como pendência de evidência — nunca como prova. */
  function migrateV3(value) {
    var out = seed(value.meta && value.meta.start);
    out.revision = Math.max(0, Math.floor(num(value.revision)));
    var creator = { id: 'cre_v3', name: 'Criador não informado (migrado do schema 3)', profiles: '', clipPolicy: '', contact: '', createdAt: nowISO() };
    var permOk = { id: 'perm_v3_autorizados', creatorId: creator.id, type: 'permission', holder: '', evidence: '', evidenceUrl: '', grantedAt: '', platforms: [], monetization: 'unknown', territory: '', validUntil: '', st
atus: 'valid', notes: 'Migrada do schema 3: o operador havia marcado "conteúdo próprio, licenciado ou autorizado". Registre a evidência.', migratedFromV3: true, createdAt: nowISO() };
    var permPending = { id: 'perm_v3_pendentes', creatorId: creator.id, type: 'permission', holder: '', evidence: '', evidenceUrl: '', grantedAt: '', platforms: [], monetization: 'unknown', territory: '', validUntil: '',
 status: 'unverified', notes: 'Migrada do schema 3 sem confirmação de direitos.', migratedFromV3: true, createdAt: nowISO() };
    var usedOk = false, usedPending = false;
    var lines = Object.create(null);
    var mapping = Object.create(null);

    (value.accounts || []).forEach(function (raw, index) {
      raw = raw || {};
      var id = cleanText(raw.id, 100);
      if (!id) return;
      var niche = cleanText(raw.niche, 100);
      var lineKey = slug(niche) || ('linha' + index);
      if (!lines[lineKey]) {
        lines[lineKey] = { id: 'line_v3_' + (Object.keys(lines).length + 1), name: niche || ('Linha editorial ' + (index + 1)), audience: '', themes: niche, createdAt: cleanText(raw.createdAt, 40) || nowISO() };
        out.editorialLines.push(lines[lineKey]);
      }
      var platforms = (Array.isArray(raw.platforms) ? raw.platforms : []).map(platformSlug).filter(Boolean);
      platforms = platforms.filter(function (item, i) { return platforms.indexOf(item) === i; });
      if (!platforms.length) platforms = [''];
      mapping[id] = { line: lines[lineKey].id, base: raw, byPlatform: Object.create(null), split: platforms.length > 1 };
      platforms.forEach(function (platform) { addMigratedAccount(id, platform); });
    });

    function addMigratedAccount(v3Id, platform) {
      var entry = mapping[v3Id];
      if (!entry) return '';
      if (entry.byPlatform[platform]) return entry.byPlatform[platform];
      var raw = entry.base;
      var newId = entry.split || Object.keys(entry.byPlatform).length ? v3Id + '_' + (platform || 'sem-plataforma') : v3Id;
      var label = platformLabel(platform);
      out.accounts.push({
        id: newId,
        name: cleanText(raw.name, 80) + (entry.split && label ? ' · ' + label : ''),
        handle: '',
        platform: platform,
        editorialLineId: entry.line,
        niche: cleanText(raw.niche, 100),
        timezone: cleanText(raw.timezone, 80),
        driveRoot: safeUrl(raw.driveRoot),
        publishMode: 'manual',
        createdAt: cleanText(raw.createdAt, 40) || nowISO()
      });
      entry.byPlatform[platform] = newId;
      return newId;
    }

    (value.videos || []).forEach(function (raw) {
      raw = raw || {};
      var videoId = cleanText(raw.id, 100);
      var entry = mapping[cleanText(raw.accountId, 100)];
      if (!videoId || !entry) return;
      var platform = platformSlug(raw.platform);
      /* Plataforma que não existia na conta ganha a sua própria conta derivada em vez de
         ser descartada — migração não apaga destino. */
      var accountId = entry.byPlatform[platform] || addMigratedAccount(cleanText(raw.accountId, 100), platform);
      var rights = !!raw.rightsConfirmed;
      var permission = rights ? permOk : permPending;
      if (rights) { usedOk = true; if (permission.platforms.indexOf(platform) < 0 && platform) permission.platforms.push(platform); }
      else usedPending = true;
      var file = raw.fileMeta && raw.fileMeta.name ? {
        name: cleanText(raw.fileMeta.name, 255), size: num(raw.fileMeta.size),
        lastModified: num(raw.fileMeta.lastModified), type: cleanText(raw.fileMeta.type, 100)
      } : null;
      var source = {
        id: 'src_' + videoId, creatorId: creator.id, permissionId: permission.id,
        name: cleanText(raw.name, 140), format: 'live', episode: '',
        sourceUrl: safeUrl(raw.sourceUrl), driveUrl: safeUrl(raw.driveUrl), fileMeta: file,
        sourceKey: '', foundAt: cleanText(raw.foundAt, 10), durationSec: 0,
        status: rights ? 'ready' : 'rights_pending',
        createdAt: cleanText(raw.createdAt, 40) || nowISO(), updatedAt: cleanText(raw.updatedAt, 40) || nowISO()
      };
      source.sourceKey = makeSourceKey(source) || cleanText(raw.sourceKey, 600);
      out.sources.push(source);
      out.clips.push({
        id: 'clp_' + videoId, sourceId: source.id, name: cleanText(raw.name, 140),
        kind: KINDS.indexOf(raw.kind) >= 0 ? raw.kind : 'viral',
        inSec: 0, outSec: 0, hook: '', topic: cleanText(raw.name, 140), reason: 'Migrado do schema 3.',
        score: 0, contextWarning: '',
        state: raw.approval === 'approved' ? 'approved' : raw.approval === 'rejected' ? 'rejected' : raw.approval === 'changes' ? 'changes' : 'selected',
        createdAt: source.createdAt, updatedAt: source.updatedAt
      });
      out.variants.push({
        id: videoId, clipId: 'clp_' + videoId, accountId: accountId,
        title: cleanText(raw.title, 180), caption: cleanText(raw.caption, 2200), hashtags: cleanText(raw.hashtags, 500),
        scheduledAt: cleanText(raw.scheduledAt, 30), nicheConfirmed: !!raw.nicheConfirmed,
        reviewNote: cleanText(raw.reviewNote, 2000), publishedUrl: safeUrl(raw.publishedUrl), error: cleanText(raw.error, 2000),
        metrics: {
          views: num(raw.metrics && raw.metrics.views), likes: num(raw.metrics && raw.metrics.likes),
          comments: num(raw.metrics && raw.metrics.comments), shares: num(raw.metrics && raw.metrics.shares)
        },
        approval: APPROVALS.indexOf(raw.approval) >= 0 ? raw.approval : 'pending',
        publication: PUBLICATIONS.indexOf(raw.publication) >= 0 ? raw.publication : 'draft',
        approvedSnapshot: cleanText(raw.approvedSnapshot, 8000), driveV
      });
    });

    out.creators.push(creator);
    if (usedOk) out.permissions.push(permOk);
    if (usedPending) out.permissions.push(permPending);
    out.logs = Array.isArray(value.logs) ? value.logs.slice() : [];
    return out;
  }
/*__BLOCO_3__*/
})();

Bloco 3 — saneamento v4 (allowlist estrita, coleções novas ausentes viram []), carga com backup automático do v3 e persistência:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 252 lines, removed 1 line
    out.logs = Array.isArray(value.logs) ? value.logs.slice() : [];
  }
/*__BLOCO_3__*/
  /* Allowlist estrita: campo desconhecido é descartado, inconsistência estrutural
     devolve null (a interface cai na tela de recuperação, sem apagar nada).
     Coleção nova ausente vira [] — backups do schema 3 e 4 continuam válidos. */
  function sanitizeState(value, options) {
    if (!value || typeof value !== 'object') return null;
    options = options || {};
    var isV3 = Array.isArray(value.videos) && !Array.isArray(value.variants);
    if (isV3 && !Array.isArray(value.accounts)) return null;
    var src = isV3 ? migrateV3(value) : value;
    if (!Array.isArray(src.accounts) || !Array.isArray(src.variants)) return null;
    var legacy = !!options.migrateLegacyApprovals && Number(value.version || 0) < SCHEMA_VERSION;

    var clean = seed(/^\d{4}-\d{2}-\d{2}$/.test(src.meta && src.meta.start) ? src.meta.start : localDay());
    clean.revision = Math.max(0, Math.floor(num(src.revision)));

    var seen = Object.create(null);
    function claim(scope, id) {
      if (!id) return false;
      var key = scope + ':' + id;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }
    function has(list, id) { return !!findById(list, id); }
    function list(name) { return Array.isArray(src[name]) ? src[name] : []; }

    for (var li = 0; li < list('editorialLines').length; li++) {
      var rawLine = list('editorialLines')[li] || {};
      var lineId = cleanText(rawLine.id, 100);
      if (!claim('line', lineId) || !cleanText(rawLine.name, 100)) return null;
      clean.editorialLines.push({
        id: lineId, name: cleanText(rawLine.name, 100), audience: cleanText(rawLine.audience, 300),
        themes: cleanText(rawLine.themes, 500), rules: cleanText(rawLine.rules, 1000),
        createdAt: cleanText(rawLine.createdAt, 40) || nowISO()
      });
    }
    for (var ci = 0; ci < list('creators').length; ci++) {
      var rawCreator = list('creators')[ci] || {};
      var creatorId = cleanText(rawCreator.id, 100);
      if (!claim('creator', creatorId) || !cleanText(rawCreator.name, 140)) return null;
      clean.creators.push({
        id: creatorId, name: cleanText(rawCreator.name, 140), profiles: cleanText(rawCreator.profiles, 600),
        clipPolicy: cleanText(rawCreator.clipPolicy, 1500), contact: cleanText(rawCreator.contact, 300),
        createdAt: cleanText(rawCreator.createdAt, 40) || nowISO()
      });
    }
    for (var pi = 0; pi < list('permissions').length; pi++) {
      var rawPerm = list('permissions')[pi] || {};
      var permId = cleanText(rawPerm.id, 100);
      if (!claim('permission', permId) || !has(clean.creators, rawPerm.creatorId)) return null;
      var permPlatforms = (Array.isArray(rawPerm.platforms) ? rawPerm.p
      var validUntil = /^\d{4}-\d{2}-\d{2}$/.test(rawPerm.validUntil) ? rawPerm.validUntil : '';
      var status = PERMISSION_STATUS.indexOf(rawPerm.status) >= 0 ? rawPerm.status : 'unverified';
      /* Prazo vencido nunca é lido como válido, mesmo que o backup afirme o contrário. */
      if (status === 'valid' && validUntil && validUntil < localDay()) status = 'expired';
      clean.permissions.push({
        id: permId, creatorId: cleanText(rawPerm.creatorId, 100),
        type: PERMISSION_TYPES.indexOf(rawPerm.type) >= 0 ? rawPerm.type : 'permission',
        holder: cleanText(rawPerm.holder, 140), evidence: cleanText(rawPerm.evidence, 2000),
        evidenceUrl: safeUrl(rawPerm.evidenceUrl),
        grantedAt: /^\d{4}-\d{2}-\d{2}$/.test(rawPerm.grantedAt) ? rawPerm.grantedAt : '',
        platforms: permPlatforms,
        monetization: ['allowed', 'denied', 'unknown'].indexOf(rawPerm.monetization) >= 0 ? rawPerm.monetization : 'unknown',
        territory: cleanText(rawPerm.territory, 140), validUntil: validUntil, status: status,
        notes: cleanText(rawPerm.notes, 2000), migratedFromV3: !!rawPer
      });
    }
    for (var ai = 0; ai < list('accounts').length; ai++) {
      var rawAccount = list('accounts')[ai] || {};
      var accountId = cleanText(rawAccount.id, 100);
      if (!claim('account', accountId) || !cleanText(rawAccount.name, 80) || !platformSlug(rawAccount.platform)) return null;
      clean.accounts.push({
        id: accountId, name: cleanText(rawAccount.name, 80),
        handle: cleanText(rawAccount.handle, 60).replace(/^@+/, ''),
        platform: platformSlug(rawAccount.platform),
        editorialLineId: has(clean.editorialLines, rawAccount.editorialLineId) ? cleanText(rawAccount.editorialLineId, 100) : '',
        niche: cleanText(rawAccount.niche, 100), timezone: cleanText(rawAccount.timezone, 80),
        driveRoot: safeUrl(rawAccount.driveRoot),
        publishMode: PUBLISH_MODES.indexOf(rawAccount.publishMode) >= 0
      });
    }
    for (var si = 0; si < list('sources').length; si++) {
      var rawSource = list('sources')[si] || {};
      var sourceId = cleanText(rawSource.id, 100);
      if (!claim('source', sourceId) || !has(clean.creators, rawSource.creatorId) || !cleanText(rawSource.name, 140)) return null;
      var sourceFile = rawSource.fileMeta && rawSource.fileMeta.name ? {
        name: cleanText(rawSource.fileMeta.name, 255), size: num(rawSource.fileMeta.size),
        lastModified: num(rawSource.fileMeta.lastModified), type: cleanText(rawSource.fileMeta.type, 100)
      } : null;
      var permissionId = has(clean.permissions, rawSource.permissionId) ? cleanText(rawSource.permissionId, 100) : '';
      var source = {
        id: sourceId, creatorId: cleanText(rawSource.creatorId, 100), permissionId: permissionId,
        name: cleanText(rawSource.name, 140),
        episode: cleanText(rawSource.episode, 140),
        sourceUrl: safeUrl(rawSource.sourceUrl), driveUrl: safeUrl(rawSource.driveUrl), fileMeta: sourceFile,
        sourceKey: '', foundAt: cleanText(rawSource.foundAt, 10), durationSec: num(rawSource.durationSec),
        status: SOURCE_STATUS.indexOf(rawSource.status) >= 0 ? rawSource.status : 'draft',
        createdAt: cleanText(rawSource.createdAt, 40) || nowISO(),
        updatedAt: cleanText(rawSource.updatedAt, 40) || nowISO()
      };
      source.sourceKey = makeSourceKey(source);
      if (!source.sourceKey || duplicateOf(clean.sources, source, '')) return null;
      /* Sem autorização vinculada a fonte nunca fica "liberada". */
      if (!permissionId && source.status === 'ready') source.status = 'rights_pending';
      clean.sources.push(source);
    }
    for (var ki = 0; ki < list('clips').length; ki++) {
      var rawClip = list('clips')[ki] || {};
      var clipId = cleanText(rawClip.id, 100);
      if (!claim('clip', clipId) || !has(clean.sources, rawClip.sourceId) || !cleanText(rawClip.name, 140)) return null;
      clean.clips.push({
        id: clipId, sourceId: cleanText(rawClip.sourceId, 100), name: cleanText(rawClip.name, 140),
        kind: KINDS.indexOf(rawClip.kind) >= 0 ? rawClip.kind : 'viral',
        inSec: num(rawClip.inSec), outSec: num(rawClip.outSec),
        hook: cleanText(rawClip.hook, 300), topic: cleanText(rawClip.topic, 140),
        reason: cleanText(rawClip.reason, 1000), score: Math.min(100, num(rawClip.score)),
        contextWarning: cleanText(rawClip.contextWarning, 600),
        state: CLIP_STATES.indexOf(rawClip.state) >= 0 ? rawClip.state : 'candidate',
        createdAt: cleanText(rawClip.createdAt, 40) || nowISO(),
        updatedAt: cleanText(rawClip.updatedAt, 40) || nowISO()
      });
    }
    for (var vi = 0; vi < list('variants').length; vi++) {
      var rawVariant = list('variants')[vi] || {};
      var variantId = cleanText(rawVariant.id, 100);
      if (!claim('variant', variantId) || !has(clean.clips, rawVariant.clipId) || !has(clean.accounts, rawVariant.accountId)) return null;
      var variant = {
        id: variantId, clipId: cleanText(rawVariant.clipId, 100), accountId: cleanText(rawVariant.accountId, 100),
        title: cleanText(rawVariant.title, 180), caption: cleanText(rawVariant.caption, 2200),
        hashtags: cleanText(rawVariant.hashtags, 500), scheduledAt: cleanText(rawVariant.scheduledAt, 30),
        nicheConfirmed: !!rawVariant.nicheConfirmed, reviewNote: cleanText(rawVariant.reviewNote, 2000),
        publishedUrl: safeUrl(rawVariant.publishedUrl), error: cleanText(rawVariant.error, 2000),
        metrics: {
          views: num(rawVariant.metrics && rawVariant.metrics.views), likes: num(rawVariant.metrics && rawVariant.metrics.likes),
          comments: num(rawVariant.metrics && rawVariant.metrics.comments), shares: num(rawVariant.metrics && rawVariant.metrics.shares)
        },
        approval: APPROVALS.indexOf(rawVariant.approval) >= 0 ? rawVariant.approval : 'pending',
        publication: PUBLICATIONS.indexOf(rawVariant.publication) >= 0 ? rawVariant.publication : 'draft',
        approvedSnapshot: cleanText(rawVariant.approvedSnapshot, 8000),
        driveVersion: Math.max(1, num(rawVariant.driveVersion) || 1),
        createdAt: cleanText(rawVariant.createdAt, 40) || nowISO(),
        updatedAt: cleanText(rawVariant.updatedAt, 40) || nowISO(),
        publishedAt: cleanText(rawVariant.publishedAt, 40)
      };
      clean.variants.push(variant);

      var resolved = resolveVariant(clean, variant);
      var account = resolved.account;
      function invalidate() {
        variant.approval = 'pending';
        variant.publication = 'draft';
        variant.approvedSnapshot = '';
      }
      if (variant.approval === 'approved' && variant.publication !== 'published'
          && resolved.fileMeta && !resolved.sourceUrl && !resolved.driveUrl) invalidate();
      if (legacy && variant.approval === 'approved'
          && !approvalIssues(resolved, account).length
          && (variant.publication !== 'published' || safeUrl(variant.publishedUrl))) {
        variant.approvedSnapshot = sensitiveSnapshot(resolveVariant(clean, variant));
      }
      if (variant.approval === 'approved' && variant.approvedSnapshot !== sensitiveSnapshot(resolveVariant(clean, variant))) invalidate();
      if (variant.approval === 'rejected') variant.publication = 'draft';
      if ((variant.publication === 'scheduled' || variant.publication === 'error') && variant.approval !== 'approved') variant.publication = 'draft';
      if (variant.publication === 'published' && (variant.approval !== 'approved' || !variant.publishedUrl)) variant.publication = 'draft';
      if (options.resetExternalApprovals && variant.publication !== 'published' && variant.approval === 'approved') invalidate();
    }
    list('driveArtifacts').forEach(function (rawArtifact) {
      rawArtifact = rawArtifact || {};
      var artifactId = cleanText(rawArtifact.id, 100);
      if (!artifactId || !has(clean.variants, rawArtifact.variantId) || seen['artifact:' + artifactId]) return;
      seen['artifact:' + artifactId] = true;
      clean.driveArtifacts.push({
        id: artifactId, variantId: cleanText(rawArtifact.variantId, 100),
        folder: cleanText(rawArtifact.folder, 400), fileName: cleanText(rawArtifact.fileName, 255),
        relPath: cleanText(rawArtifact.relPath, 600),
        state: DRIVE_STATES.indexOf(rawArtifact.state) >= 0 ? rawArtifact.state : 'planned',
        size: num(rawArtifact.size), checksum: cleanText(rawArtifact.checksum, 128),
        version: Math.max(1, num(rawArtifact.version) || 1),
        createdAt: cleanText(rawArtifact.createdAt, 40) || nowISO(),
        updatedAt: cleanText(rawArtifact.updatedAt, 40) || nowISO()
      });
    });
    (Array.isArray(src.logs) ? src.logs : []).forEach(function (rawLog) {
      rawLog = rawLog || {};
      clean.logs.push({
        id: cleanText(rawLog.id, 100) || uid('log'), at: cleanText(rawLog.at, 40),
        action: cleanText(rawLog.action, 80), message: cleanText(rawLog.message, 3000),
        videoId: has(clean.variants, rawLog.videoId) ? cleanText(rawLog.videoId, 100) : '',
        accountId: has(clean.accounts, rawLog.accountId) ? cleanText(rawLog.accountId, 100) : ''
      });
    });
    return clean;
  }

  function load() {
    var raw = '';
    try {
      raw = localStorage.getItem(KEY) || '';
      if (!raw) return seed();
      var parsed = JSON.parse(raw);
      var wasV3 = Array.isArray(parsed.videos) && !Array.isArray(parsed.variants);
      var clean = sanitizeState(parsed, { migrateLegacyApprovals: true });
      if (!clean) { BROKEN_RAW = raw; return seed(); }
      /* Rede de segurança da migração: guarda o schema 3 cru ANTES de gravar o 4.
         Rollback = apagar pp_video_ops_v1 e renomear pp_video_ops_v3_backup. */
      if (wasV3) {
        try { if (!localStorage.getItem(BACKUP_V3_KEY)) localStorage.setItem(BACKUP_V3_KEY, raw); }
        catch (e) { BROKEN_RAW = raw; return seed(); }
        MIGRATED_FROM_V3 = true;
      }
      return clean;
    } catch (e) { BROKEN_RAW = raw; return seed(); }
  }
  function persist(options) {
    options = options || {};
    if (BROKEN_RAW) {
      toast('Os dados anteriores precisam ser recuperados ou resetados antes de salvar.', 'error');
      return false;
    }
    try {
      var storedRaw = localStorage.getItem(KEY);
      var storedRevision = storedRaw ? Math.max(0, Math.floor(num(JSON.parse(storedRaw).revision))) : 0;
      if (!options.force && storedRevision !== previousRevision) {
        toast('Outra aba alterou o Estúdio. Recarregue a página antes de salvar para não perder dados.', 'error');
        return false;
      }
      STATE.revision = Math.max(storedRevision, previousRevision) + 1;
      localStorage.setItem(KEY, JSON.stringify(STATE));
      return true;
    } catch (e) {
      STATE.revision = previousRevision;
      toast('Não foi possível salvar. Exporte o backup e libere espaço no navegador.', 'error');
      return false;
    }
  }
  function addLog(action, message, variantId, accountId) {
    STATE.logs.push({ id: uid('log'), at: nowISO(), action: action, mes
  function accountOf(id) { return findById(STATE.accounts, id); }
  function activeAccount() { return accountOf(ACTIVE_ACCOUNT) || STATE.accounts[0] || null; }
  function variantOf(id) { return findById(STATE.variants, id); }
  function resolvedOf(id) { var v = variantOf(id); return v ? resolveVariant(STATE, v) : null; }
  function accountsOfLine(lineId) {
    return STATE.accounts.filter(function (account) { return account.editorialLineId === lineId; });
  }
/*__BLOCO_4__*/
})();

Bloco 4 — regras puras (aprovação, direitos, metas, relatório, CSV, caminhos do Drive e pacote de publicação):

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 316 lines, removed 1 line
  function accountsOfLine(lineId) {
    return STATE.accounts.filter(function (account) { return account.editorialLineId === lineId; });
  }
/*__BLOCO_4__*/
  /* Aceita tanto uma variante resolvida quanto um registro achatado do schema 3;
     as checagens novas só disparam quando o campo correspondente existe. */
  function approvalIssues(video, account, options) {
    var issues = [];
    var hasLocalFile = !!(options && options.hasLocalFile);
    if (!account) issues.push('conta inválida');
    if (video.clipId && !video.clip) issues.push('corte vinculado');
    if (video.clip && !video.source) issues.push('fonte vinculada');
    if (!storedSourceKeys(video).length) issues.push('origem ou arquivo');
    if (video.sourceUrl && !safeUrl(video.sourceUrl)) issues.push('link de origem válido');
    if (video.driveUrl && !safeUrl(video.driveUrl)) issues.push('link do Drive válido');
    if (video.fileMeta && !safeUrl(video.sourceUrl) && !safeUrl(video.driveUrl) && !hasLocalFile) issues.push('arquivo local disponível nesta sessão');
    if (video.sourceStatus && video.sourceStatus !== 'ready') issues.push('fonte liberada');
    if (!video.rightsConfirmed) issues.push('direitos de uso');
    if (!video.nicheConfirmed) issues.push('compatibilidade com o nicho');
    if (!String(video.title || '').trim()) issues.push('título');
    if (!String(video.caption || '').trim()) issues.push('legenda');
    if (!String(video.hashtags || '').trim()) issues.push('hashtags');
    if (!String(video.scheduledAt || '').trim()) issues.push('data e horário');
    if (!String(video.platform || '').trim()) issues.push('plataforma');
    else if (account && Array.isArray(account.platforms) && account.platforms.indexOf(video.platform) < 0) issues.push('plataforma vinculada à conta');
    return issues;
  }
  function publishingIssues(video, account, options) {
    var issues = approvalIssues(video, account, options);
    if (video.approval !== 'approved') issues.push('aprovação');
    if (video.approval === 'approved' && video.approvedSnapshot !== sensitiveSnapshot(video)) issues.push('nova aprovação após alterações');
    if (account && account.paused) issues.push('conta pausada');
    if (!safeUrl(video.publishedUrl)) issues.push('link da postagem');
    return issues;
  }
  /* Timestamps do corte: exigidos ao criar/editar um corte no schema 4. Cortes migrados
     do schema 3 chegam com 0/0 e ficam marcados como "sem marcação" — não bloqueiam o
     histórico já publicado, mas aparecem como pendência na interface. */
  function clipIssues(clip) {
    var issues = [];
    if (!clip) return ['corte'];
    if (!String(clip.name || '').trim()) issues.push('nome do corte');
    if (!String(clip.topic || '').trim()) issues.push('assunto');
    if (num(clip.outSec) <= num(clip.inSec)) issues.push('início e fim do corte');
    return issues;
  }
  function clipUnmarked(clip) { return !!clip && !num(clip.inSec) && !num(clip.outSec); }

  /* Qualquer mudança aqui derruba a aprovação anterior. Inclui o recorte, a autorização
     usada e o estado da fonte, além dos campos que já existiam no schema 3. */
  function sensitiveSnapshot(video) {
    return JSON.stringify([
      video.accountId, storedSourceKeys(video), video.kind, video.platform, video.title,
      video.caption, video.hashtags, video.scheduledAt, !!video.rightsConfirmed, !!video.nicheConfirmed,
      video.clip ? [num(video.clip.inSec), num(video.clip.outSec)] : null,
      video.permission ? video.permission.id : '',
      video.sourceStatus || ''
    ]);
  }
  function dailyGoal(videos, accountId, day) {
      return video.accountId === accountId
        && String(video.scheduledAt || '').slice(0, 10) === day
        && video.approval !== 'rejected';
    });
    var viral = planned.filter(function (video) { return video.kind === 'viral'; }).length;
    var recent = planned.filter(function (video) { return video.kind === 'recent'; }).length;
    var approved = planned.filter(function (video) {
      return video.approval === 'approved' && (video.publication === 'scheduled' || video.publication === 'published');
    });
    var approvedViral = approved.filter(function (video) { return video.kind === 'viral'; }).length;
    var approvedRecent = approved.filter(function (video) { return video.kind === 'recent'; }).length;
    return {
      viral: viral, recent: recent, total: planned.length, approved: approved.length,
      complete: viral >= 2 && recent >= 1 && planned.length >= 3,
      ready: approvedViral >= 2 && approvedRecent >= 1 && approved.length >= 3
    };
  }
  function engagement(video) {
    var metrics = video && video.metrics || {};
    var views = num(metrics.views);
    var interactions = num(metrics.likes) + num(metrics.comments) + num(metrics.shares);
    return { views: views, interactions: interactions, rate: views ? interactions / views : 0 };
  }
  function eventDate(video) {
    return video.publishedAt || video.updatedAt || video.scheduledAt || video.createdAt || '';
  }
  function buildReport(state, accountId, days, now) {
    var all = reportItems(state).filter(function (video) { return !accountId || video.accountId === accountId; });
    var end = new Date(now || Date.now());
    var start = new Date(end);
    start.setDate(start.getDate() - Math.max(1, Number(days) || 7) + 1);
    start.setHours(0, 0, 0, 0);
    function inside(video) {
      var at = Date.parse(eventDate(video));
      return Number.isFinite(at) && at >= start.getTime() && at <= end.getTime();
    }
    var period = all.filter(inside);
    var published = period.filter(function (video) { return video.publication === 'published'; });
    var ranked = published.slice().sort(function (a, b) {
      var ea = engagement(a), eb = engagement(b);
      return (eb.rate - ea.rate) || (eb.interactions - ea.interactions) || (eb.views - ea.views);
    });
    var totals = published.reduce(function (sum, video) {
      var m = video.metrics || {};
      sum.views += num(m.views); sum.likes += num(m.likes);
      sum.comments += num(m.comments); sum.shares += num(m.shares);
      return sum;
    }, { views: 0, likes: 0, comments: 0, shares: 0 });
    var hours = Object.create(null);
    published.forEach(function (video) {
      var hour = String(video.scheduledAt || '').slice(11, 13);
      if (!hour) return;
      if (!hours[hour]) hours[hour] = { total: 0, count: 0 };
      hours[hour].total += engagement(video).rate;
      hours[hour].count++;
    });
    var bestHour = Object.keys(hours).sort(function (a, b) {
      return (hours[b].total / hours[b].count) - (hours[a].total / hours[a].count);
    })[0] || '';
    return {
      days: Number(days) || 7, period: period, published: published,
      rejected: period.filter(function (video) { return video.approval === 'rejected'; }),
      errors: period.filter(function (video) { return video.publication === 'error'; }),
      totals: totals, best: ranked[0] || null,
      worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
      bestHour: bestHour ? bestHour + ':00' : ''
    };
  }
  function suggestCopy(topic, niche) {
    var cleanTopic = String(topic || '').trim();
    var cleanNiche = String(niche || '').trim();
    var words = deaccent(cleanNiche + ' ' + cleanTopic).toLowerCase()
    var tags = [];
    words.forEach(function (word) { if (tags.length < 4 && tags.indexOf(word) < 0) tags.push(word); });
    if (tags.indexOf('conteudo') < 0) tags.push('conteudo');
    return {
      title: cleanTopic || ('Conteúdo sobre ' + (cleanNiche || 'o tema')),
      caption: (cleanTopic || 'Este conteúdo') + '. Salve para rever e compartilhe com quem também se interessa por ' + (cleanNiche || 'este assunto') + '.',
      hashtags: tags.map(function (word) { return '#' + word; }).join(' ')
    };
  }
  function suggestSlot(videos, accountId, kind, from) {
    var base = new Date(from || Date.now());
    var hours = kind === 'viral' ? [12, 18] : kind === 'recent' ? [21] : [9];
    for (var offset = 0; offset < DAYS; offset++) {
      for (var i = 0; i < hours.length; i++) {
        var candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, hours[i], 0, 0, 0);
        if (candidate.getTime() <= base.getTime() + 30 * 60000) continue;
        var value = localDateTime(candidate);
        var busy = (videos || []).some(function (video) {
          return video.accountId === accountId && video.approval !== 'rejected' && String(video.scheduledAt || '').slice(0, 16) === value;
        });
        if (!busy) return value;
    }
    return '';
  }

  function accountFolder(account) {
    if (!account) return 'sem-conta';
    return safeName(String(account.handle || '').replace(/^@+/, '') || account.name, 60);
  }
  /* Caminho determinístico: mesmos ids e nomes produzem sempre o mesmo destino.
     O worker da Fase 2 grava em <tempName> e só então renomeia para <fileName>. */
  function drivePathFor(resolved) {
    if (!resolved || !resolved.clip || !resolved.account) return null;
    var version = Math.max(1, num(resolved.driveVersion) || 1);
    var platform = platformLabel(resolved.platform) || 'sem-plataforma'
    var fileName = [
      safeName(resolved.clip.id, 32),
      safeName(resolved.creator ? resolved.creator.name : 'criador-nao-informado', 40),
      safeName(resolved.clip.topic || resolved.clip.name, 50),
      safeName(platform, 20),
      accountFolder(resolved.account),
      'v' + version
    ].join('-') + '.mp4';
    return { folder: folder, fileName: fileName, relPath: folder + '/' + fileName, tempName: fileName + '.part', version: version };
  }
  function drivePath(state, variant) { return drivePathFor(resolveVariant(state, variant)); }
  function driveMasterPath(state, clip) {
    if (!clip) return null;
    var source = findById(state.sources, clip.sourceId);
    var creator = source ? findById(state.creators, source.creatorId) : null;
    var folder = DRIVE_ROOT + '/Cortes mestres';
    var fileName = [
      safeName(clip.id, 32),
      safeName(creator ? creator.name : 'criador-nao-informado', 40),
      safeName(clip.topic || clip.name, 50), 'v1'
    ].join('-') + '.mp4';
    return { folder: folder, fileName: fileName, relPath: folder + '/' + fileName, tempName: fileName + '.part', version: 1 };
  }
  function driveTree(state) {
    var lines = [DRIVE_ROOT + '/', '  Criadores e permissões/', '  Cortes mestres/', '  Variantes/'];
    var byPlatform = Object.create(null);
    (state.accounts || []).forEach(function (account) {
      var key = account.platform || '';
      if (!byPlatform[key]) byPlatform[key] = [];
      byPlatform[key].push(account);
    });
    Object.keys(byPlatform).sort().forEach(function (key) {
      lines.push('    ' + (platformLabel(key) || 'Sem plataforma') + '/');
      byPlatform[key].forEach(function (account) { lines.push('      ' + accountFolder(account) + '/'); });
    });
    ['Legendas e capas', 'Publicados', 'Relatórios', 'Erros de processamento'].forEach(function (folder) {
      lines.push('  ' + folder + '/');
    });
    return lines.join('\n');
  }
  function artifactOf(state, variantId) {
    return (state.driveArtifacts || []).find(function (item) { return item.variantId === variantId; }) || null;
  }

  /* Pacote de publicação manual: tudo que o operador precisa para postar à mão, com o
     destino do arquivo já calculado. Não afirma que o arquivo existe. */
  function publicationPackage(state, variant) {
    var resolved = resolveVariant(state, variant);
    if (!resolved) return null;
    var path = drivePathFor(resolved);
    var artifact = artifactOf(state, variant.id);
    var permission = resolved.permission;
    return {
      variantId: variant.id,
      geradoEm: nowISO(),
      destino: {
        conta: resolved.account ? resolved.account.name : '',
        handle: resolved.account && resolved.account.handle ? '@' + resolved.account.handle : '',
        plataforma: platformLabel(resolved.platform),
        modoDePublicacao: PUBLISH_MODE_LABEL[resolved.account ? resolved.account.publishMode : 'manual']
      },
      conteudo: {
        titulo: resolved.title, legenda: resolved.caption, hashtags: resolved.hashtags,
        agendadoPara: resolved.scheduledAt, tipo: KIND_LABEL[resolved.kind] || resolved.kind
      },
      corte: resolved.clip ? {
        inicioSeg: num(resolved.clip.inSec), fimSeg: num(resolved.clip.outSec),
        semMarcacao: clipUnmarked(resolved.clip)
      } : null,
      fonte: resolved.source ? {
        nome: resolved.source.name, criador: resolved.creator ? resolved.creator.name : '',
        url: resolved.source.sourceUrl, status: SOURCE_STATUS_LABEL[resolved.source.status] || resolved.source.status
      } : null,
      autorizacao: permission ? {
        tipo: PERMISSION_TYPE_LABEL[permission.type] || permission.type,
        titular: permission.holder, evidencia: permission.evidence || permission.evidenceUrl,
        plataformas: (permission.platforms || []).map(platformLabel).join(', '),
        validaAte: permission.validUntil || 'sem prazo declarado',
        status: PERMISSION_STATUS_LABEL[permission.status] || permission.status,
        pendencias: permissionWarnings(permission)
      } : null,
      arquivo: path ? {
        pastaRelativa: path.folder, nomeFinal: path.fileName, nomeTemporario: path.tempName,
        caminhoRelativo: path.relPath,
        estado: DRIVE_STATE_LABEL[artifact ? artifact.state : 'planned']
      } : null
    };
  }
  function packageText(pkg) {
    if (!pkg) return '';
    var lines = ['CHECKLIST DE PUBLICAÇÃO MANUAL', ''];
    lines.push('Destino: ' + pkg.destino.plataforma + ' · ' + pkg.destino.conta + (pkg.destino.handle ? ' (' + pkg.destino.handle + ')' : ''));
    lines.push('Agendado para: ' + (pkg.conteudo.agendadoPara || 'sem horário'));
    lines.push('');
    lines.push('Título: ' + pkg.conteudo.titulo);
    lines.push('Legenda:'); lines.push(pkg.conteudo.legenda);
    lines.push('Hashtags: ' + pkg.conteudo.hashtags);
    lines.push('');
    if (pkg.arquivo) {
      lines.push('Arquivo esperado: ' + pkg.arquivo.caminhoRelativo);
      lines.push('Estado do arquivo: ' + pkg.arquivo.estado);
      lines.push('(o worker local grava em ' + pkg.arquivo.nomeTemporario + ' e só depois renomeia)');
      lines.push('');
    }
    if (pkg.autorizacao) {
      lines.push('Autorização: ' + pkg.autorizacao.tipo + ' · ' + pkg.autorizacao.status);
      lines.push('Plataformas cobertas: ' + (pkg.autorizacao.plataformas || 'nenhuma declarada'));
      lines.push('Válida até: ' + pkg.autorizacao.validaAte);
      if (pkg.autorizacao.pendencias.length) lines.push('PENDENTE: ' + pkg.autorizacao.pendencias.join(', '));
      lines.push('');
    }
    lines.push('[ ] Conferi que o perfil aberto é ' + (pkg.destino.handle || pkg.destino.conta) + ' em ' + pkg.destino.plataforma);
    lines.push('[ ] O vídeo não tem marca d\'água de outra rede');
    lines.push('[ ] Publiquei e colei o link real da postagem no Estúdio');
    return lines.join('\n');
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  function toCsv(state) {
    var accountMap = Object.create(null);
    (state.accounts || []).forEach(function (account) { accountMap[account.id] = account; });
    var headers = ['Conta', 'Nicho', 'Vídeo', 'Origem', 'Encontrado em', 'Tipo', 'Drive', 'Título', 'Legenda', 'Hashtags', 'Programado', 'Plataforma', 'Aprovação', 'Publicação', 'Link publicado', 'Visualizações', 'Curtid
as', 'Comentários', 'Compartilhamentos', 'Erro', 'Criador', 'Autorização', 'Status da fonte', 'Corte (s)', 'Caminho no Drive', 'Estado no Drive'];
    var rows = reportItems(state).map(function (video) {
      var account = accountMap[video.accountId] || {};
      var metrics = video.metrics || {};
      var path = video.clip ? drivePathFor(video) : null;
      var artifact = video.clip ? artifactOf(state, video.id) : null;
      return [
        account.name, account.niche, video.name, video.sourceUrl, video.foundAt,
        KIND_LABEL[video.kind] || video.kind, video.driveUrl, video.title, video.caption, video.hashtags,
        video.scheduledAt, platformLabel(video.platform) || video.platform,
        APPROVAL_LABEL[video.approval] || video.approval, PUBLICATION_LABEL[video.publication] || video.publication,
        video.publishedUrl, num(metrics.views), num(metrics.likes), num(metrics.comments), num(metrics.shares), video.error,
        video.creator ? video.creator.name : '',
        video.sourceStatus ? (SOURCE_STATUS_LABEL[video.sourceStatus] || video.sourceStatus) : '',
        video.clip ? (num(video.clip.inSec) + '-' + num(video.clip.outSec)) : '',
        path ? path.relPath : '',
        video.clip ? DRIVE_STATE_LABEL[artifact ? artifact.state : 'planned'] : ''
      ].map(csvCell).join(';');
    });
    return '' + [headers.map(csvCell).join(';')].concat(rows).join('\r\n');
  }
/*__BLOCO_5__*/
})();

Checagem de sintaxe parcial antes de seguir, e conferindo se o BOM saiu literal de novo:

  Made 1 scratchpad edit +14, ran 2 shell commands

Bloco 5 — render, abas e listas:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 271 lines, removed 1 line
    });
    return '\ufeff' + [headers.map(csvCell).join(';')].concat(rows).join('\r\n');
  }
/*__BLOCO_5__*/
  function projectInfo() {
    var start = Date.parse(STATE.meta.start + 'T00:00:00');
    var elapsed = Math.floor((Date.now() - start) / 86400000);
    elapsed = Math.max(0, Math.min(DAYS, Number.isFinite(elapsed) ? elapsed : 0));
    return { day: Math.min(DAYS, elapsed + 1), elapsed: elapsed, remaining: DAYS - elapsed, percent: Math.round(elapsed / DAYS * 100) };
  }
  function fmtDateTime(value) {
    if (!value) return 'Sem horário';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }
  function metric(value) { return new Intl.NumberFormat('pt-BR', { notation: value >= 10000 ? 'compact' : 'standard' }).format(num(value)); }
  function chip(cls, text) { return '<span class="vop-chip ' + esc(cls) + '">' + esc(text) + '</span>'; }

  function refreshBadge() {
    var badge = document.getElementById('count-video-ops');
    if (!badge || !STATE) return;
    badge.textContent = STATE.variants.filter(function (v) { return v.approval === 'pending' || v.approval === 'changes'; }).length;
  }
  function headerHTML() {
    var info = projectInfo();
    var account = activeAccount();
    var options = STATE.accounts.map(function (item) {
      return '<option value="' + esc(item.id) + '"' + (item.id === (account && account.id) ? ' selected' : '') + '>'
        + esc(platformLabel(item.platform)) + ' · ' + esc(item.name) + (item.handle ? ' (@' + esc(item.handle) + ')' : '') + '</option>';
    }).join('');
    return '<header class="vop-head">'
      + '<div class="vop-head-copy"><span class="vop-kicker">Operação de 90 dias</span><h1>Estúdio de Vídeos</h1>'
      + '<p>Cortes de lives e podcasts autorizados — curadoria, direitos, aprovação e agenda, sem publicar nada sozinho.</p></div>'
      + '<div class="vop-project"><span>Dia ' + info.day + ' de ' + DAYS + '</span><div class="vop-progress"><i style="width:' + info.percent + '%"></i></div><small>' + info.remaining + ' dias restantes</small></div>'
      + '<div class="vop-head-actions">'
      + (BROKEN_RAW ? chip('publication-error', 'Recuperação necessária')
        : (STATE.accounts.length ? '<label class="vop-account-picker"><span>Conta ativa</span><select data-act="account-select">' + options + '</select></label>' : '')
        + '<button class="vop-btn vop-btn-secondary" type="button" data-act="account-add">＋ Conta</button>'
        + (STATE.sources.length ? '<button class="vop-btn vop-btn-primary" type="button" data-act="clip-add">＋ Corte</button>' : ''))
      + '</div></header>';
  }
  function tabsHTML() {
    var pending = STATE.variants.filter(function (v) { return v.approval === 'pending' || v.approval === 'changes'; }).length;
    var tabs = [
      ['queue', 'Fila', pending || STATE.variants.length],
      ['sources', 'Fontes', STATE.sources.length],
      ['creators', 'Criadores', STATE.creators.length],
      ['accounts', 'Contas', STATE.accounts.length],
      ['reports', 'Relatórios', '']
    ];
    return '<nav class="vop-tabs" aria-label="Áreas do estúdio">' + tabs.map(function (tab) {
      return '<button type="button" data-act="tab" data-tab="' + tab[0] + '" aria-pressed="' + (TAB === tab[0]) + '" class="' + (TAB === tab[0] ? 'active' : '') + '">' + tab[1] + (tab[2] !== '' ? '<span>' + tab[2] + '</
span>' : '') + '</button>';
    }).join('') + '</nav>';
  }
  function emptyHTML(title, text, action, label) {
    return '<div class="vop-empty"><div class="vop-empty-icon" aria-hidden="true">▶</div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>'
      + (action ? '<button class="vop-btn vop-btn-primary" type="button" data-act="' + action + '">' + esc(label) + '</button>' : '') + '</div>';
  }
  function recoveryHTML() {
    return '<section class="vop-empty vop-recovery"><div class="vop-empty-icon" aria-hidden="true">!</div><h2>Os dados locais precisam de recuperação</h2>'
      + '<p>O conteúdo salvo não foi reconhecido e permanece intacto no navegador. Baixe a cópia bruta antes de importar um backup válido ou começar de novo.</p>'
      + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="download-raw">Baixar dados brutos</button><button class="vop-btn vop-btn-primary" type="button" data-act="import-j
son">Importar backup</button><button class="vop-btn vop-btn-danger" type="button" data-act="reset-broken">Começar de novo</button></div></section>';
  }
  function migrationNoticeHTML() {
    if (!MIGRATED_FROM_V3) return '';
    var pending = STATE.permissions.filter(function (p) { return p.migratedFromV3; }).length;
    return '<div class="vop-migrate-note" role="status"><strong>Dados migrados do schema 3.</strong> '
      + 'A cópia anterior ficou guardada em <code>' + esc(BACKUP_V3_KEY) + '</code> no navegador. '
      + (pending ? esc(pending) + ' autorização(ões) sintética(s) foram criadas a partir da antiga marcação de direitos e ainda <strong>não têm evidência registrada</strong> — revise na aba Criadores antes de aprovar co
nteúdo novo.' : '')
      + '</div>';
  }
  function goalHTML(account) {
    var day = PLAN_DAY || localDay();
    var goal = dailyGoal(resolveAll(STATE), account.id, day);
    var viralPct = Math.min(100, goal.viral / 2 * 100);
    var recentPct = Math.min(100, goal.recent * 100);
    var title = account.paused ? 'Conta pausada' : goal.ready ? 'Dia pronto para publicar' : goal.complete ? 'Programação completa; falta aprovação' : 'Monte a programação do dia';
    return '<section class="vop-goal ' + (!account.paused && goal.ready ? 'complete' : '') + '">'
      + '<div class="vop-goal-head"><div><span class="vop-eyebrow">Meta diária · ' + esc(platformLabel(account.platform)) + '</span><h2>' + title + '</h2></div>'
      + '<label class="vop-date"><span>Dia</span><input type="date" data-act="plan-day" value="' + esc(day) + '"></label></div>'
      + '<div class="vop-goal-grid">'
      + '<div><span>Virais antigos</span><strong>' + goal.viral + '/2<
      + '<div><span>Total programado</span><strong>' + goal.total + '/3</strong><small>' + (account.paused ? 'Publicações suspensas até a retomada' : goal.ready ? 'Meta aprovada e pronta' : goal.complete ? goal.approved
 + ' de ' + goal.total + ' prontos' : 'A aprovação continua obrigatória') + '</small></div>'
      + '</div>' + (account.paused ? '<div class="vop-pause-note">Retome a conta na aba Contas antes de registrar qualquer publicação.</div>' : '') + '</section>';
  }
  function filteredVariants(account) {
    var query = SEARCH.toLowerCase();
    return resolveAll(STATE).filter(function (v) {
      if (v.accountId !== account.id) return false;
      if (FILTER === 'pending' && v.approval !== 'pending' && v.approval !== 'changes') return false;
      if (FILTER === 'approved' && v.approval !== 'approved') return false;
      if (FILTER === 'scheduled' && v.publication !== 'scheduled') return false;
      if (FILTER === 'published' && v.publication !== 'published') return false;
      if (FILTER === 'error' && v.publication !== 'error') return false;
      if (FILTER === 'rejected' && v.approval !== 'rejected') return f
      if (query && [v.name, v.title, v.platform, v.sourceUrl, v.hashtags, v.creator && v.creator.name].join(' ').toLowerCase().indexOf(query) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var aa = a.scheduledAt || '9999', bb = b.scheduledAt || '9999';
      return aa.localeCompare(bb) || String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }
  function variantCardHTML(v) {
    var source = safeUrl(v.driveUrl || v.sourceUrl);
    var path = drivePathFor(v);
    var artifact = artifactOf(STATE, v.id);
    var blockers = [];
    if (!v.rightsConfirmed) blockers.push('autorização não cobre este destino');
    if (v.sourceStatus && v.sourceStatus !== 'ready') blockers.push('f
    if (clipUnmarked(v.clip)) blockers.push('corte sem marcação de início e fim');
    return '<article class="vop-video-card">'
      + '<div class="vop-video-main"><div class="vop-video-top"><span class="vop-kind">' + esc(KIND_LABEL[v.kind] || v.kind) + '</span>'
      + chip('approval-' + v.approval, APPROVAL_LABEL[v.approval] || v.approval)
      + chip('publication-' + v.publication, PUBLICATION_LABEL[v.publication] || v.publication)
      + chip('vop-chip-platform', platformLabel(v.platform)) + '</div>'
      + '<h3>' + esc(v.title || v.name) + '</h3><p>' + esc(v.name) + (v.creator ? ' · ' + esc(v.creator.name) : '') + '</p>'
      + '<div class="vop-video-meta"><span>' + esc(v.account ? (v.account.handle ? '@' + v.account.handle : v.account.name) : '') + '</span><span>' + esc(fmtDateTime(v.scheduledAt)) + '</span>'
      + (source ? '<a href="' + esc(source) + '" target="_blank" rel="noopener">Abrir origem ↗</a>' : '<span>Arquivo local</span>') + '</div>'
      + (blockers.length ? '<div class="vop-warning">Falta: ' + esc(blockers.join(' · ')) + '.</div>' : '')
      + (path ? '<div class="vop-path"><code>' + esc(path.relPath) + '</code>' + chip('drive-' + (artifact ? artifact.state : 'planned'), DRIVE_STATE_LABEL[artifact ? artifact.state : 'planned']) + '</div>' : '')
      + (v.reviewNote ? '<div class="vop-note">Revisão: ' + esc(v.reviewNote) + '</div>' : '') + '</div>'
      + '<div class="vop-video-side">'
      + (v.publication === 'published' ? '<div class="vop-mini-metrics
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="variant-open" data-id="' + esc(v.id) + '">Revisar</button></div></article>';
  }
  function listInnerHTML(account) {
    var items = filteredVariants(account);
    if (!items.length) return '<div class="vop-list-empty">Nenhuma variante corresponde a este filtro.</div>';
    return items.map(variantCardHTML).join('');
  }
  function queueHTML(account) {
    var filters = [['all', 'Todas'], ['pending', 'Para aprovar'], ['approved', 'Aprovadas'], ['scheduled', 'Agendadas'], ['published', 'Publicadas'], ['error', 'Erros'], ['rejected', 'Rejeitadas'], ['rights', 'Sem direi
tos']];
    if (!STATE.sources.length) return goalHTML(account) + emptyHTML('Registre a primeira fonte', 'Cadastre o criador, a autorização e a live ou podcast antes de criar cortes.', 'source-add', 'Registrar fonte');
    return goalHTML(account)
      + '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Pipeline</span><h2>Variantes desta conta</h2></div>'
      + '<div class="vop-tools"><input class="vop-search" type="search" data-act="search" value="' + esc(SEARCH) + '" placeholder="Buscar corte, criador…" aria-label="Buscar"><button class="vop-btn vop-btn-primary" type
="button" data-act="clip-add">＋ Corte</button></div></div>'
      + '<div class="vop-filters">' + filters.map(function (f) {
        return '<button type="button" data-act="filter" data-filter="' + f[0] + '" aria-pressed="' + (FILTER === f[0]) + '" class="' + (FILTER === f[0] ? 'active' : '') + '">' + f[1] + '</button>';
      }).join('') + '</div><div class="vop-video-list" data-vop-list>' + listInnerHTML(account) + '</div></section>';
  }
  function sourcesHTML() {
    if (!STATE.creators.length) return emptyHTML('Cadastre o primeiro criador', 'A autorização de cortes é registrada por criador e reaproveitada nas fontes dele.', 'creator-add', 'Cadastrar criador');
    if (!STATE.sources.length) return emptyHTML('Nenhuma fonte registrada', 'Informe a live ou o podcast de terceiro e vincule a autorização que cobre esse material.', 'source-add', 'Registrar fonte');
    return '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Biblioteca</span><h2>Fontes e direitos</h2></div><button class="vop-btn vop-btn-primary" type="button" data-act="sour
ce-add">＋ Fonte</button></div>'
      + '<div class="vop-entity-grid">' + STATE.sources.map(function (source) {
        var creator = findById(STATE.creators, source.creatorId);
        var permission = findById(STATE.permissions, source.permissionId);
        var warnings = source.permissionId ? permissionWarnings(permission) : ['autorização vinculada'];
        var clips = STATE.clips.filter(function (c) { return c.sourceId === source.id; }).length;
        return '<article class="vop-entity-card"><div class="vop-account-title"><div><h3>' + esc(source.name) + '</h3><p>' + esc(creator ? creator.name : 'Criador removido') + (source.episode ? ' · ' + esc(source.episod
e) : '') + '</p></div>'
          + chip('source-' + source.status, SOURCE_STATUS_LABEL[source.status] || source.status) + '</div>'
          + '<div class="vop-account-meta"><span>' + esc(source.format === 'podcast' ? 'Podcast' : source.format === 'other' ? 'Outro' : 'Live') + '</span><span>' + clips + ' corte(s)</span>'
          + (source.sourceUrl ? '<a href="' + esc(source.sourceUrl) + '" target="_blank" rel="noopener">Abrir ↗</a>' : '<span>Arquivo local</span>') + '</div>'
          + (permission ? '<div class="vop-pill-row">' + chip('permission-' + permission.status, PERMISSION_TYPE_LABEL[permission.type] + ' · ' + PERMISSION_STATUS_LABEL[permission.status])
            + (permission.platforms.length ? permission.platforms.map(function (p) { return chip('vop-chip-platform', platformLabel(p)); }).join('') : chip('publication-error', 'sem plataforma declarada')) + '</div>' :
'')
          + (warnings.length ? '<div class="vop-warning">Pendente: ' + esc(warnings.join(' · ')) + '.</div>' : '')
          + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="source-edit" data-id="' + esc(source.id) + '">Editar</button>'
          + '<button class="vop-btn vop-btn-primary" type="button" data-act="clip-add" data-source="' + esc(source.id) + '">Criar corte</button></div></article>';
      }).join('') + '</div></section>';
  }
  function creatorsHTML() {
    if (!STATE.creators.length) return emptyHTML('Cadastre o primeiro criador', 'Nome, perfis oficiais e a política pública de cortes dele.', 'creator-add', 'Cadastrar criador');
    return '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Direitos</span><h2>Criadores e autorizações</h2></div><button class="vop-btn vop-btn-primary" type="button" data-act=
"creator-add">＋ Criador</button></div>'
      + '<div class="vop-entity-grid">' + STATE.creators.map(function (creator) {
        var perms = STATE.permissions.filter(function (p) { return p.creatorId === creator.id; });
        return '<article class="vop-entity-card"><div class="vop-account-title"><div><h3>' + esc(creator.name) + '</h3><p>' + esc(creator.profiles || 'Sem perfis informados') + '</p></div></div>'
          + (creator.clipPolicy ? '<div class="vop-note">Política de cortes: ' + esc(creator.clipPolicy) + '</div>' : '')
          + '<div class="vop-perm-list">' + (perms.length ? perms.map(function (p) {
            var warnings = permissionWarnings(p);
            return '<div class="vop-perm"><div class="vop-pill-row">' + chip('permission-' + p.status, PERMISSION_TYPE_LABEL[p.type] + ' · ' + PERMISSION_STATUS_LABEL[p.status])
              + (p.platforms.length ? p.platforms.map(function (pl) { return chip('vop-chip-platform', platformLabel(pl)); }).join('') : chip('publication-error', 'sem plataforma'))
              + (p.validUntil ? chip('vop-chip-quiet', 'até ' + p.validUntil) : chip('vop-chip-quiet', 'sem prazo')) + '</div>'
              + (warnings.length ? '<small class="vop-warn-text">Pendente: ' + esc(warnings.join(' · ')) + '</small>' : '')
              + '<button class="vop-inline-action" type="button" data-act="permission-edit" data-id="' + esc(p.id) + '">Editar autorização</button></div>';
          }).join('') : '<p class="vop-form-note">Nenhuma autorização registrada para este criador.</p>') + '</div>'
          + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="creator-edit" data-id="' + esc(creator.id) + '">Editar</button>'
          + '<button class="vop-btn vop-btn-primary" type="button" data-act="permission-add" data-creator="' + esc(creator.id) + '">＋ Autorização</button></div></article>';
      }).join('') + '</div></section>';
  }
  function accountsHTML() {
    if (!STATE.accounts.length) return emptyHTML('Cadastre a primeira
    STATE.accounts.forEach(function (a) {
      var key = a.editorialLineId || '';
      if (!byLine[key]) byLine[key] = [];
      byLine[key].push(a);
    });
    return '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Configuração</span><h2>Linhas editoriais e contas</h2><p class="vop-form-note">' + STATE.accounts.length + ' conta(s)
 · ' + STATE.editorialLines.length + ' linha(s) editorial(is)</p></div>'
      + '<div class="vop-tools"><button class="vop-btn vop-btn-secondary" type="button" data-act="line-add">＋ Linha</button><button class="vop-btn vop-btn-primary" type="button" data-act="account-add">＋ Conta</button>
</div></div>'
      + Object.keys(byLine).map(function (lineId) {
        var line = findById(STATE.editorialLines, lineId);
        return '<div class="vop-line-group"><div class="vop-line-head"><h3>' + esc(line ? line.name : 'Sem linha editorial') + '</h3>'
          + (line ? '<button class="vop-inline-action" type="button" data-act="line-edit" data-id="' + esc(line.id) + '">Editar linha</button>' : '') + '</div>'
          + '<div class="vop-account-grid">' + byLine[lineId].map(function (account) {
            var drive = safeUrl(account.driveRoot);
            var count = STATE.variants.filter(function (v) { return v.accountId === account.id; }).length;
            return '<article class="vop-account-card ' + (account.paused ? 'paused' : '') + '"><div class="vop-account-title"><div><h3>' + esc(account.name) + '</h3><p>' + esc(account.handle ? '@' + account.handle : 'se
m @handle') + '</p></div>'
              + chip(account.paused ? 'publication-error' : 'publication-published', account.paused ? 'Pausada' : 'Ativa') + '</div>'
              + '<div class="vop-platforms"><span>' + esc(platformLabel(account.platform)) + '</span><span>' + esc(PUBLISH_MODE_LABEL[account.publishMode]) + '</span></div>'
              + '<div class="vop-account-meta"><span>Fuso: ' + esc(account.timezone || 'Local do navegador') + '</span><span>' + count + ' variante(s)</span></div>'
              + '<div class="vop-card-actions">' + (drive ? '<a class="vop-btn vop-btn-quiet" href="' + esc(drive) + '" target="_blank" rel="noopener">Abrir Drive ↗</a>' : '')
              + '<button class="vop-btn vop-btn-secondary" type="button" data-act="account-edit" data-id="' + esc(account.id) + '">Editar</button>'
              + '<button class="vop-btn ' + (account.paused ? 'vop-btn-primary' : 'vop-btn-danger') + '" type="button" data-act="account-pause" data-id="' + esc(account.id) + '">' + (account.paused ? 'Retomar' : 'Pausar
') + '</button></div></article>';
          }).join('') + '</div></div>';
      }).join('') + '</section>';
  }
  function insightHTML(report, account) {
    var notes = [];
    var created = Date.parse(account.createdAt || '');
    var activeDays = Number.isFinite(created) ? Math.min(report.days, Math.max(1, Math.floor((Date.now() - created) / 86400000) + 1)) : report.days;
    var target = activeDays * 3;
    if (account.paused) notes.push('A conta está pausada; a meta de novas publicações fica suspensa até a retomada.');
    else if (report.published.length < target) notes.push('Foram publicados ' + report.published.length + ' de ' + target + ' vídeos previstos desde a criação da conta neste período.');
    if (report.errors.length) notes.push('Há ' + report.errors.length + ' erro(s) para revisar antes de ampliar o volume.');
    if (report.rejected.length) notes.push(report.rejected.length + ' conteúdo(s) rejeitado(s) ajudam a ajustar os critérios de curadoria.');
    if (!notes.length) notes.push('A operação de ' + account.name + ' está sem alertas neste período.');
    return '<div class="vop-insights"><h3>Próxima melhoria</h3>' + notes.map(function (note) { return '<p>' + esc(note) + '</p>'; }).join('') + '</div>';
  }
  function logsHTML(account) {
    var logs = STATE.logs.filter(function (log) { return !log.accountId || log.accountId === account.id; }).slice(-12).reverse();
    return '<div class="vop-log"><div><h3>Histórico da automação</h3><p>Ações e bloqueios ficam preservados no backup.</p></div><div class="vop-log-list">'
      + (logs.length ? logs.map(function (log) {
        return '<div><time>' + esc(fmtDateTime(log.at)) + '</time><span><strong>' + esc(log.action || 'registro') + '</strong>' + (log.message ? ' · ' + esc(log.message) : '') + '</span></div>';
      }).join('') : '<p>Nenhuma ação registrada ainda.</p>') + '</div></div>';
  }
  function reportsHTML(account) {
    var report = buildReport(STATE, account.id, REPORT_DAYS, new Date());
    var best = report.best ? engagement(report.best) : null;
    var worst = report.worst ? engagement(report.worst) : null;
    return '<section class="vop-section"><div class="vop-section-head"><div><span class="vop-eyebrow">Aprendizado</span><h2>Relatório da operação</h2></div>'
      + '<div class="vop-report-range">' + [7, 30, 90].map(function (days) { return '<button type="button" data-act="report-range" data-days="' + days + '" aria-pressed="' + (REPORT_DAYS === days) + '" class="' + (REPOR
T_DAYS === days ? 'active' : '') + '">' + (days === 7 ? 'Semanal' : days === 30 ? 'Mensal' : '90 dias') + '</button>'; }).join('') + '</div></div>'
      + '<div class="vop-report-grid">'
      + '<div class="vop-stat"><span>Publicados</span><strong>' + report.published.length + '</strong><small>nos últimos ' + report.days + ' dias</small></div>'
      + '<div class="vop-stat"><span>Visualizações</span><strong>' + metric(report.totals.views) + '</strong><small>' + metric(report.totals.likes + report.totals.comments + report.totals.shares) + ' interações</small><
/div>'
      + '<div class="vop-stat"><span>Erros</span><strong>' + report.errors.length + '</strong><small>' + report.rejected.length + ' rejeitados</small></div>'
      + '<div class="vop-stat"><span>Melhor horário</span><strong>' + esc(report.bestHour || '—') + '</strong><small>por taxa de engajamento</small></div></div>'
      + '<div class="vop-performance"><article><span>Melhor desempenho</span><h3>' + esc(report.best ? (report.best.title || report.best.name) : 'Sem dados publicados') + '</h3>' + (best ? '<p>' + (best.rate * 100).toFi
xed(2).replace('.', ',') + '% de engajamento</p>' : '') + '</article>'
      + '<article><span>Pior desempenho</span><h3>' + esc(report.worst ? (report.worst.title || report.worst.name) : 'Dados insuficientes') + '</h3>' + (worst ? '<p>' + (worst.rate * 100).toFixed(2).replace('.', ',') +
'% de engajamento</p>' : '') + '</article></div>'
      + insightHTML(report, account) + logsHTML(account)
      + '<div class="vop-export"><div><h3>Dados e Google Drive</h3><p>O caminho de cada variante é calculado aqui, mas quem grava o arquivo é o worker local da Fase 2. Enquanto isso o estado fica em “' + esc(DRIVE_STATE
_LABEL.planned) + '”.</p></div><div class="vop-card-actions">'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="drive-tree">Copiar estrutura do Drive</button><button class="vop-btn vop-btn-secondary" type="button" data-act="export-csv">Exportar CSV</button
><button class="vop-btn vop-btn-secondary" type="button" data-act="export-json">Backup JSON</button><button class="vop-btn vop-btn-quiet" type="button" data-act="import-json">Importar backup</button></div></div></sectio
n>';
  }
  function render() {
    var root = document.getElementById('video-ops-root');
    if (!root || !STATE) return;
    var fileInput = '<input type="file" id="vop-import-file" accept="application/json,.json" hidden>';
    if (BROKEN_RAW) {
      root.innerHTML = headerHTML() + '<main class="vop-body">' + recoveryHTML() + '</main>' + fileInput;
      refreshBadge();
      return;
    }
    if (!accountOf(ACTIVE_ACCOUNT)) ACTIVE_ACCOUNT = STATE.accounts[0] ? STATE.accounts[0].id : '';
    if (!PLAN_DAY) PLAN_DAY = localDay();
    var account = activeAccount();
    var body = '';
    if (!STATE.accounts.length) { TAB = 'accounts'; body = accountsHTML(); }
    else if (TAB === 'accounts') body = accountsHTML();
    else if (TAB === 'creators') body = creatorsHTML();
    else if (TAB === 'sources') body = sourcesHTML();
    else if (TAB === 'reports') body = reportsHTML(account);
    else body = queueHTML(account);
    root.innerHTML = headerHTML() + tabsHTML() + '<main class="vop-body">' + migrationNoticeHTML() + body + '</main>' + fileInput;
    refreshBadge();
  function refreshList() {
    var root = document.getElementById('video-ops-root');
    var list = root && root.querySelector('[data-vop-list]');
    var account = activeAccount();
    if (list && account) list.innerHTML = listInnerHTML(account);
  }
/*__BLOCO_6__*/
})();

Bloco 6 — infraestrutura de diálogo e os formulários (linha, conta, criador, autorização, fonte, corte, variante):

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 250 lines, removed 1 line
    var account = activeAccount();
    if (list && account) list.innerHTML = listInnerHTML(account);
  }
/*__BLOCO_6__*/
  function ensureToast() {
    if (TOAST) return TOAST;
    TOAST = document.createElement('div');
    TOAST.className = 'vop-toast';
    TOAST.setAttribute('role', 'status');
    TOAST.setAttribute('aria-live', 'polite');
    document.body.appendChild(TOAST);
    return TOAST;
  }
  function toast(message, tone) {
    if (typeof document === 'undefined') return;
    var el = ensureToast();
    clearTimeout(el._hideTimer);
    el.textContent = message;
    el.dataset.tone = tone || 'ok';
    el.dataset.show = 'true';
    el._hideTimer = setTimeout(function () { el.dataset.show = 'false'; }, 3800);
  }
  function closeDialog() {
    if (TEMP_PREVIEW) { URL.revokeObjectURL(TEMP_PREVIEW); TEMP_PREVIEW = ''; }
    if (DIALOG && DIALOG.open) DIALOG.close();
  }
  var FORM_SAVERS = {};
  function ensureDialog() {
    if (DIALOG) return DIALOG;
    DIALOG = document.createElement('dialog');
    DIALOG.className = 'vop-dialog';
    DIALOG.addEventListener('cancel', function () { closeDialog(); });
    DIALOG.addEventListener('click', onDialogClick);
    DIALOG.addEventListener('change', onDialogChange);
    DIALOG.addEventListener('submit', function (event) {
      event.preventDefault();
      var form = event.target;
      var saver = FORM_SAVERS[form.dataset.kind];
      if (saver) saver(form, 'save');
    });
    document.body.appendChild(DIALOG);
    return DIALOG;
  }
  function openModal(html) {
    var dialog = ensureDialog();
    dialog.innerHTML = html;
    dialog.classList.toggle('vop-dialog-wide-host', !!dialog.querySelector('.vop-dialog-wide'));
    dialog.setAttribute('aria-labelledby', 'vop-dialog-title');
    dialog.showModal();
    var first = dialog.querySelector('input:not([type=hidden]), select, textarea');
    if (first) requestAnimationFrame(function () { first.focus(); });
  function field(label, name, value, attrs) {
    return '<label class="vop-field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" value="' + esc(value || '') + '" ' + (attrs || '') + '></label>';
  }
  function areaField(label, name, value, rows, attrs) {
    return '<label class="vop-field vop-field-wide"><span>' + esc(label) + '</span><textarea name="' + esc(name) + '" rows="' + (rows || 3) + '" ' + (attrs || '') + '>' + esc(value || '') + '</textarea></label>';
  }
  function selectField(label, name, pairs, selected, attrs, wide) {
    return '<label class="vop-field' + (wide ? ' vop-field-wide' : '') + '"><span>' + esc(label) + '</span><select name="' + esc(name) + '" ' + (attrs || '') + '>'
      + pairs.map(function (pair) {
        return '<option value="' + esc(pair[0]) + '"' + (String(pair[0]) === String(selected) ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
      }).join('') + '</select></label>';
  }
  function labelPairs(map, order) {
    return (order || Object.keys(map)).map(function (key) { return [key, map[key]]; });
  }
  function dialogHead(eyebrow, title) {
    return '<div class="vop-dialog-head"><div><span class="vop-eyebrow">' + esc(eyebrow) + '</span><h2 id="vop-dialog-title">' + esc(title) + '</h2></div>'
      + '<button type="button" class="vop-icon-btn" data-dialog-act="close" aria-label="Fechar">×</button></div>';
  }
  function dialogFoot(submitLabel, extra) {
    return '<div class="vop-dialog-foot' + (extra ? ' vop-dialog-foot-wrap' : '') + '">' + (extra ? '<div class="vop-review-actions">' + extra + '</div>' : '')
      + '<div><button class="vop-btn vop-btn-quiet" type="button" data-dialog-act="close">Cancelar</button>'
      + '<button class="vop-btn vop-btn-primary" type="submit">' + esc(submitLabel) + '</button></div></div>';
  }
  function lineDialogHTML(line) {
    return '<form class="vop-dialog-card" data-kind="line" data-id="' + esc(line && line.id || '') + '">'
      + dialogHead(line ? 'Editar linha editorial' : 'Nova linha editorial', line ? line.name : 'Agrupa as contas de um mesmo tema')
      + '<div class="vop-form-grid">' + field('Nome da linha', 'name', line && line.name, 'required maxlength="100"')
      + field('Público', 'audience', line && line.audience, 'maxlength="300"')
      + areaField('Temas', 'themes', line && line.themes, 2, 'maxlength="500"')
      + areaField('Regras editoriais', 'rules', line && line.rules, 2, 'maxlength="1000"') + '</div>'
      + '<p class="vop-form-note">Cada linha reúne normalmente uma conta no TikTok e uma no Instagram — mas o número de contas por linha é livre.</p>'
      + dialogFoot(line ? 'Salvar linha' : 'Criar linha') + '</form>';
  }
  function accountDialogHTML(account) {
    var timezone = account && account.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo');
    var lines = STATE.editorialLines.map(function (l) { return [l.id, l.name]; });
    if (!lines.length) lines = [['', 'Nenhuma linha cadastrada']];
    var platforms = labelPairs(PLATFORM_LABEL);
    if (account && account.platform && !PLATFORM_LABEL[account.platform]) platforms.push([account.platform, platformLabel(account.platform)]);
    return '<form class="vop-dialog-card" data-kind="account" data-id="' + esc(account && account.id || '') + '">'
      + dialogHead(account ? 'Editar conta' : 'Nova conta', account ? account.name : 'Configure um destino de publicação')
      + '<div class="vop-form-grid">' + field('Nome da conta', 'name', account && account.name, 'required maxlength="80"')
      + field('@handle', 'handle', account && account.handle, 'maxlength="60" placeholder="sem o @"')
      + selectField('Plataforma', 'platform', platforms, account && account.platform, 'required')
      + selectField('Linha editorial', 'editorialLineId', lines, account && account.editorialLineId, '')
      + field('Nicho', 'niche', account && account.niche, 'maxlength="100"')
      + field('Fuso horário', 'timezone', timezone, 'required maxlength="80"')
      + selectField('Modo de publicação', 'publishMode', labelPairs(PUBLISH_MODE_LABEL), account && account.publishMode, '')
      + '<label class="vop-field vop-field-wide"><span>Pasta raiz no Google Drive (opcional)</span><input name="driveRoot" type="url" value="' + esc(account && account.driveRoot || '') + '" placeholder="https://drive.go
ogle.com/…"></label></div>'
      + '<p class="vop-form-note">Uma conta = uma plataforma e um @handle. O link do Drive é só para abrir a pasta; nenhuma credencial é salva no navegador.</p>'
      + dialogFoot(account ? 'Salvar conta' : 'Criar conta') + '</form>';
  }
  function creatorDialogHTML(creator) {
    return '<form class="vop-dialog-card" data-kind="creator" data-id="' + esc(creator && creator.id || '') + '">'
      + dialogHead(creator ? 'Editar criador' : 'Novo criador', creator ? creator.name : 'Dono da live ou do podcast')
      + '<div class="vop-form-grid">' + field('Nome do criador ou canal', 'name', creator && creator.name, 'required maxlength="140"')
      + field('Contato', 'contact', creator && creator.contact, 'maxlength="300"')
      + areaField('Perfis oficiais', 'profiles', creator && creator.profiles, 2, 'maxlength="600"')
      + areaField('Política pública de cortes', 'clipPolicy', creator && creator.clipPolicy, 3, 'maxlength="1500"') + '</div>'
      + '<p class="vop-form-note">Registrar o criador não autoriza nada por si só: a permissão é cadastrada separadamente e é ela que libera o uso.</p>'
      + dialogFoot(creator ? 'Salvar criador' : 'Criar criador') + '</form>';
  }
  function permissionDialogHTML(permission, creatorId) {
    var creators = STATE.creators.map(function (c) { return [c.id, c.name]; });
    var selectedCreator = permission ? permission.creatorId : creatorId;
    var platforms = Object.keys(PLATFORM_LABEL);
    (permission && permission.platforms || []).forEach(function (p) { if (platforms.indexOf(p) < 0) platforms.push(p); });
    return '<form class="vop-dialog-card" data-kind="permission" data-id="' + esc(permission && permission.id || '') + '">'
      + dialogHead(permission ? 'Editar autorização' : 'Nova autorização', 'O que exatamente foi autorizado')
      + '<div class="vop-form-grid">'
      + selectField('Criador', 'creatorId', creators, selectedCreator, 'required')
      + selectField('Tipo', 'type', labelPairs(PERMISSION_TYPE_LABEL), permission && permission.type, 'required')
      + field('Titular dos direitos', 'holder', permission && permission.holder, 'maxlength="140"')
      + field('Link da evidência', 'evidenceUrl', permission && permission.evidenceUrl, 'type="url" placeholder="https://…"')
      + field('Concedida em', 'grantedAt', permission && permission.grantedAt, 'type="date"')
      + field('Válida até', 'validUntil', permission && permission.validUntil, 'type="date"')
      + selectField('Monetização', 'monetization', [['unknown', 'Não declarada'], ['allowed', 'Permitida'], ['denied', 'Proibida']], permission && permission.monetization, '')
      + field('Território', 'territory', permission && permission.territory, 'maxlength="140"')
      + selectField('Status', 'status', labelPairs(PERMISSION_STATUS_LABEL), permission && permission.status, 'required')
      + '<fieldset class="vop-checks vop-field-wide"><legend>Plataformas cobertas</legend>' + platforms.map(function (p) {
        var on = (permission && permission.platforms || []).indexOf(p) >= 0;
        return '<label><input name="platform_' + esc(p) + '" type="checkbox"' + (on ? ' checked' : '') + '> ' + esc(platformLabel(p)) + '</label>';
      }).join('') + '</fieldset>'
      + areaField('Evidência (texto, print descrito, trecho do contrato)', 'evidence', permission && permission.evidence, 3, 'maxlength="2000"')
      + areaField('Observações e limitações', 'notes', permission && permission.notes, 2, 'maxlength="2000"') + '</div>'
      + '<p class="vop-form-note">Só a marcação <strong>Válida</strong>, dentro do prazo e com a plataforma listada libera aprovação. Sem plataforma marcada, a autorização não cobre nada.</p>'
      + dialogFoot(permission ? 'Salvar autorização' : 'Criar autorização') + '</form>';
  }
  function sourceDialogHTML(source) {
    var creators = STATE.creators.map(function (c) { return [c.id, c.name]; });
    var creatorId = source ? source.creatorId : (creators[0] && creators[0][0]);
    var perms = STATE.permissions.filter(function (p) { return p.creatorId === creatorId; }).map(function (p) {
      return [p.id, PERMISSION_TYPE_LABEL[p.type] + ' · ' + PERMISSION_STATUS_LABEL[p.status] + ' · ' + ((p.platforms || []).map(platformLabel).join('/') || 'sem plataforma')];
    });
    perms.unshift(['', 'Nenhuma autorização vinculada']);
    return '<form class="vop-dialog-card" data-kind="source" data-id="' + esc(source && source.id || '') + '">'
      + dialogHead(source ? 'Editar fonte' : 'Nova fonte', source ? source.name : 'Live ou podcast de terceiro autorizado')
      + '<div class="vop-form-grid">'
      + selectField('Criador', 'creatorId', creators, creatorId, 'required')
      + selectField('Autorização que cobre esta fonte', 'permissionId'
      + selectField('Formato', 'format', [['live', 'Live'], ['podcast', 'Podcast'], ['other', 'Outro']], source && source.format, '')
      + field('Episódio', 'episode', source && source.episode, 'maxlength="140"')
      + field('Data encontrada', 'foundAt', source && source.foundAt || localDay(), 'type="date"')
      + field('Link da origem', 'sourceUrl', source && source.sourceUrl, 'type="url" placeholder="https://…"')
      + field('Link do arquivo no Drive', 'driveUrl', source && source.driveUrl, 'type="url" placeholder="https://drive.google.com/…"')
      + field('Duração (segundos)', 'durationSec', source && source.durationSec, 'type="number" min="0" step="1"')
      + selectField('Situação', 'status', labelPairs(SOURCE_STATUS_LABEL), source && source.status, 'required')
      + '<label class="vop-field vop-field-wide"><span>Arquivo local (não é armazenado)</span><input name="localFile" type="file" accept="video/*"><small>' + esc(source && source.fileMeta && source.fileMeta.name || 'Só
os metadados do arquivo são guardados') + '</small></label>'
      + '</div>'
      + '<p class="vop-form-note">Sem autorização vinculada a fonte não fica “Liberada”. Não baixe material que exija burlar login, paywall, DRM ou bloqueio de origem.</p>'
      + dialogFoot(source ? 'Salvar fonte' : 'Registrar fonte') + '</form>';
  }
  function clipDialogHTML(clip, sourceId) {
    var sources = STATE.sources.map(function (s) {
      return [s.id, s.name + ' · ' + (SOURCE_STATUS_LABEL[s.status] || s.status)];
    });
    var current = clip ? findById(STATE.sources, clip.sourceId) : findById(STATE.sources, sourceId) || STATE.sources[0];
    var lines = STATE.editorialLines.map(function (l) {
      return [l.id, l.name + ' (' + accountsOfLine(l.id).length + ' conta(s))'];
    });
    var defaultLine = clip ? '' : (active && active.editorialLineId) || (lines[0] && lines[0][0]) || '';
    return '<form class="vop-dialog-card" data-kind="clip" data-id="' + esc(clip && clip.id || '') + '">'
      + dialogHead(clip ? 'Editar corte' : 'Novo corte', clip ? clip.name : 'Marque o trecho e escolha a linha editorial')
      + '<div class="vop-form-grid">'
      + selectField('Fonte', 'sourceId', sources, current && current.id, 'required')
      + field('Nome do corte', 'name', clip && clip.name, 'required maxlength="140"')
      + field('Assunto', 'topic', clip && clip.topic, 'required maxlength="140"')
      + selectField('Tipo', 'kind', labelPairs(KIND_LABEL), clip && clip.kind, '')
      + field('Início (segundos)', 'inSec', clip && clip.inSec, 'type="number" min="0" step="1" required')
      + field('Fim (segundos)', 'outSec', clip && clip.outSec, 'type="number" min="0" step="1" required')
      + field('Nota de confiança (0-100)', 'score', clip && clip.score, 'type="number" min="0" max="100" step="1"')
      + selectField('Estado', 'state', labelPairs(CLIP_STATE_LABEL), clip && clip.state, '')
      + areaField('Gancho', 'hook', clip && clip.hook, 2, 'maxlength="300"')
      + areaField('Motivo da escolha', 'reason', clip && clip.reason,
      + (clip ? '' : selectField('Criar variantes para a linha editorial', 'editorialLineId', lines, defaultLine, '', true))
      + '</div>'
      + '<p class="vop-form-note">' + (clip ? 'Alterar início, fim ou fonte derruba a aprovação das variantes deste corte.' : 'Uma variante será criada para cada conta da linha escolhida — você pode apagar a que não qui
ser.') + '</p>'
      + dialogFoot(clip ? 'Salvar corte' : 'Criar corte e variantes') + '</form>';
  }
  function previewHTML(resolved) {
    var src = resolved && (SESSION_FILES[resolved.sourceId] || safeUrl(resolved.driveUrl) || safeUrl(resolved.sourceUrl));
    var playable = src && (/^blob:/.test(src) || /\.(mp4|webm|mov)(\?|$)/i.test(src));
    if (playable) return '<video class="vop-preview" controls preload="metadata" src="' + esc(src) + '"></video>';
    if (src) return '<div class="vop-preview-placeholder"><span>Prévia externa</span><a href="' + esc(src) + '" target="_blank" rel="noopener">Abrir vídeo em nova aba ↗</a></div>';
    return '<div class="vop-preview-placeholder"><span>Nenhuma prévia disponível</span><small>A fonte não tem link nem arquivo nesta sessão.</small></div>';
  }
  function variantDialogHTML(v) {
    var path = drivePathFor(v);
    var artifact = artifactOf(STATE, v.id);
    var warnings = v.permission ? permissionWarnings(v.permission) : ['autorização vinculada'];
    var actions = '';
    if (v.publication !== 'published') {
      if (v.approval !== 'approved') actions += '<button class="vop-btn vop-btn-primary" type="button" data-dialog-act="approve">Aprovar e agendar</button>';
      if (v.approval !== 'rejected') actions += '<button class="vop-btn vop-btn-secondary" type="button" data-dialog-act="changes">Pedir ajustes</button><button class="vop-btn vop-btn-danger" type="button" data-dialog-a
ct="reject">Rejeitar</button>';
      if (v.approval === 'approved' && v.publication === 'scheduled') actions += '<button class="vop-btn vop-btn-primary" type="button" data-dialog-act="publish">Registrar como publicado</button><button class="vop-btn v
op-btn-danger" type="button" data-dialog-act="error">Registrar erro</button>';
      if (v.publication === 'error') actions += '<button class="vop-btn vop-btn-secondary" type="button" data-dialog-act="retry">Reagendar</button>';
    }
    return '<form class="vop-dialog-card vop-dialog-wide" data-kind="variant" data-id="' + esc(v.id) + '">'
      + dialogHead('Revisão da variante', (v.title || v.name) + ' · ' + platformLabel(v.platform))
      + '<div class="vop-dialog-layout"><div class="vop-dialog-fields"><div class="vop-form-grid">'
      + '<div class="vop-field vop-field-wide vop-destination"><span>Destino</span><strong>' + esc(platformLabel(v.platform)) + ' · ' + esc(v.account ? v.account.name : '') + '</strong>'
      + '<code>' + esc(v.account && v.account.handle ? '@' + v.account.handle : 'sem @handle cadastrado') + '</code></div>'
      + '<label class="vop-field vop-field-wide"><span>Título</span><input name="title" value="' + esc(v.title) + '" maxlength="180"><button class="vop-inline-action" type="button" data-dialog-act="suggest-copy">Sugerir
 texto local</button></label>'
      + areaField('Legenda', 'caption', v.caption, 4, 'maxlength="2200"')
      + '<label class="vop-field vop-field-wide"><span>Hashtags</span><input name="hashtags" value="' + esc(v.hashtags) + '" maxlength="500"></label>'
      + '<label class="vop-field"><span>Data e horário</span><input name="scheduledAt" type="datetime-local" value="' + esc(String(v.scheduledAt || '').slice(0, 16)) + '"><button class="vop-inline-action" type="button"
data-dialog-act="suggest-time">Sugerir próximo horário</button></label>'
      + '<div class="vop-checks"><label><input name="nicheConfirmed" type="checkbox"' + (v.nicheConfirmed ? ' checked' : '') + '> Compatível com o nicho da conta</label></div>'
      + areaField('Observações da revisão', 'reviewNote', v.reviewNote, 2, '')
      + '<label class="vop-field vop-field-wide"><span>Link da postagem publicada</span><input name="publishedUrl" type="url" value="' + esc(v.publishedUrl) + '" placeholder="Obrigatório ao registrar a publicação"></lab
el>'
      + '<fieldset class="vop-metrics vop-field-wide"><legend>Métricas</legend>'
      + field('Visualizações', 'views', v.metrics.views, 'type="number" min="0" step="1"') + field('Curtidas', 'likes', v.metrics.likes, 'type="number" min="0" step="1"')
      + field('Comentários', 'comments', v.metrics.comments, 'type="number" min="0" step="1"') + field('Compartilhamentos', 'shares', v.metrics.shares, 'type="number" min="0" step="1"') + '</fieldset>'
      + '</div></div><aside class="vop-dialog-preview"><div data-preview>' + previewHTML(v) + '</div>'
      + '<div class="vop-audit">' + chip('approval-' + v.approval, APPROVAL_LABEL[v.approval]) + chip('publication-' + v.publication, PUBLICATION_LABEL[v.publication])
      + chip('source-' + v.sourceStatus, SOURCE_STATUS_LABEL[v.sourceStatus] || 'fonte ausente') + '</div>'
      + '<div class="vop-audit"><h4>Direitos</h4>' + (v.permission
        ? '<p>' + esc(PERMISSION_TYPE_LABEL[v.permission.type]) + ' · ' + esc(PERMISSION_STATUS_LABEL[v.permission.status]) + '</p>'
          + '<p>' + esc((v.permission.platforms || []).map(platformLabel).join(', ') || 'nenhuma plataforma declarada') + (v.permission.validUntil ? ' · até ' + esc(v.permission.validUntil) : ' · sem prazo') + '</p>'
          + (v.rightsConfirmed ? '<p class="vop-ok-text">Cobre este destino nesta data.</p>' : '<p class="vop-warn-text">Não cobre este destino nesta data.</p>')
          + (warnings.length ? '<p class="vop-warn-text">Pendente: ' + esc(warnings.join(', ')) + '</p>' : '')
        : '<p class="vop-warn-text">Nenhuma autorização vinculada à fonte.</p>') + '</div>'
      + (v.clip ? '<div class="vop-audit"><h4>Corte</h4><p>' + num(v.clip.inSec) + 's → ' + num(v.clip.outSec) + 's'
        + (clipUnmarked(v.clip) ? ' <span class="vop-warn-text">(sem marcação)</span>' : '') + '</p>'
        + (v.clip.contextWarning ? '<p class="vop-warn-text">' + esc(v.clip.contextWarning) + '</p>' : '')
        + '<button class="vop-inline-action" type="button" data-dialog-act="open-clip" data-id="' + esc(v.clip.id) + '">Editar corte</button></div>' : '')
      + (path ? '<div class="vop-audit"><h4>Arquivo no Drive</h4><code class="vop-path-code">' + esc(path.relPath) + '</code>'
        + '<p>' + chip('drive-' + (artifact ? artifact.state : 'planned'), DRIVE_STATE_LABEL[artifact ? artifact.state : 'planned']) + '</p>'
        + '<small>Caminho reservado não significa arquivo gravado, e a
      + '<div class="vop-dialog-foot vop-dialog-foot-wrap"><div class="vop-review-actions">' + actions + '</div>'
      + '<div><button class="vop-btn vop-btn-quiet" type="button" data-dialog-act="close">Cancelar</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-dialog-act="export-package">Pacote de publicação</button>'
      + '<button class="vop-btn vop-btn-danger" type="button" data-dialog-act="delete-variant">Excluir</button>'
      + '<button class="vop-btn vop-btn-secondary" type="submit">Salvar</button></div></div></form>';
  }
/*__BLOCO_7__*/
})();

Bloco 7 — handlers de salvamento, eventos, init e exports. O ponto central aqui é revalidate(): uma única função que derruba aprovações cujo snapshot mudou, chamada depois de qualquer alteração em fonte, corte, autorização ou conta:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 565 lines, removed 1 line
      + '<button class="vop-btn vop-btn-danger" type="button" data-dialog-act="delete-variant">Excluir</button>'
      + '<button class="vop-btn vop-btn-secondary" type="submit">Salvar</button></div></div></form>';
  }
/*__BLOCO_7__*/
  /* Um único guarda para toda invalidação: qualquer mudança em fonte, corte, autorização
     ou conta passa por aqui em vez de cada handler reimplementar a regra.
     Publicação concluída nunca é alterada — o histórico fica preservado. */
  function revalidate(reason) {
    var changed = 0;
    STATE.variants.forEach(function (variant) {
      if (variant.approval !== 'approved' || variant.publication === 'published') return;
      if (variant.approvedSnapshot === sensitiveSnapshot(resolveVariant(STATE, variant))) return;
      variant.approval = 'pending';
      variant.publication = 'draft';
      variant.approvedSnapshot = '';
      addLog('approval_invalidated', reason, variant.id, variant.accountId);
      changed++;
    });
    return changed;
  }
  function commit(before, message, tab) {
    if (!persist()) { STATE = JSON.parse(before); return false; }
    closeDialog();
    if (tab) TAB = tab;
    render();
    if (message) toast(message);
    return true;
  }
  function syncDriveArtifact(variant) {
    var path = drivePathFor(resolveVariant(STATE, variant));
    if (!path) return;
    var artifact = artifactOf(STATE, variant.id);
    if (!artifact) {
      artifact = { id: uid('art'), variantId: variant.id, state: 'planned', size: 0, checksum: '', createdAt: nowISO() };
      STATE.driveArtifacts.push(artifact);
    }
    /* Só o caminho é recalculado. O estado de gravação/sincronização é do worker local. */
    artifact.folder = path.folder;
    artifact.fileName = path.fileName;
    artifact.relPath = path.relPath;
    artifact.version = path.version;
    artifact.updatedAt = nowISO();
  }

  function saveLineForm(form) {
    var before = JSON.stringify(STATE);
    var data = new FormData(form);
    var name = cleanText(data.get('name'), 100);
    if (!name) { toast('Informe o nome da linha editorial.', 'error'); return; }
    var line = findById(STATE.editorialLines, form.dataset.id);
    if (!line) { line = { id: uid('line'), createdAt: nowISO() }; STATE.editorialLines.push(line); }
    line.name = name;
    line.audience = cleanText(data.get('audience'), 300);
    line.themes = cleanText(data.get('themes'), 500);
    line.rules = cleanText(data.get('rules'), 1000);
    addLog(form.dataset.id ? 'line_updated' : 'line_created', name, '', '');
    commit(before, form.dataset.id ? 'Linha editorial atualizada.' : 'Linha editorial criada.', 'accounts');
  }
  function saveAccountForm(form) {
    var before = JSON.stringify(STATE);
    var data = new FormData(form);
    var name = cleanText(data.get('name'), 80);
    var platform = platformSlug(data.get('platform'));
    var driveRootRaw = cleanText(data.get('driveRoot'), 500);
    if (!name || !platform) { toast('Informe nome e plataforma da conta.', 'error'); return; }
    if (driveRootRaw && !safeUrl(driveRootRaw)) { toast('Informe um link HTTP(S) válido para a pasta do Drive.', 'error'); return; }
    var account = accountOf(form.dataset.id);
    var publishedElsewhere = account && account.platform !== platform
      && STATE.variants.some(function (v) { return v.accountId === account.id && v.publication === 'published'; });
    if (publishedElsewhere) { toast('Esta conta já tem publicações registradas; não é possível trocar a plataforma.', 'error'); return; }
    if (!account) {
      account = { id: uid('acc'), createdAt: nowISO(), paused: false };
      STATE.accounts.push(account);
      ACTIVE_ACCOUNT = account.id;
    }
    account.name = name;
    account.handle = cleanText(data.get('handle'), 60).replace(/^@+/, '');
    account.platform = platform;
    account.editorialLineId = findById(STATE.editorialLines, data.get('editorialLineId')) ? String(data.get('editorialLineId')) : '';
    account.niche = cleanText(data.get('niche'), 100);
    account.timezone = cleanText(data.get('timezone'), 80);
    account.publishMode = PUBLISH_MODES.indexOf(String(data.get('publishMode'))) >= 0 ? String(data.get('publishMode')) : 'manual';
    account.driveRoot = safeUrl(driveRootRaw);
    addLog(form.dataset.id ? 'account_updated' : 'account_created', name, '', account.id);
    STATE.variants.forEach(function (v) { if (v.accountId === account.id) syncDriveArtifact(v); });
    var invalidated = revalidate('Dados da conta mudaram; o destino precisa de nova aprovação.');
    if (!commit(before, null, 'accounts')) { ACTIVE_ACCOUNT = activeBefore; return; }
    toast((form.dataset.id ? 'Conta atualizada.' : 'Conta criada.') + (invalidated ? ' ' + invalidated + ' aprovação(ões) voltaram para pendente.' : ''));
  }
  function saveCreatorForm(form) {
    var before = JSON.stringify(STATE);
    var data = new FormData(form);
    var name = cleanText(data.get('name'), 140);
    if (!name) { toast('Informe o nome do criador ou canal.', 'error'); return; }
    var creator = findById(STATE.creators, form.dataset.id);
    if (!creator) { creator = { id: uid('cre'), createdAt: nowISO() }; STATE.creators.push(creator); }
    creator.name = name;
    creator.profiles = cleanText(data.get('profiles'), 600);
    creator.clipPolicy = cleanText(data.get('clipPolicy'), 1500);
    creator.contact = cleanText(data.get('contact'), 300);
    addLog(form.dataset.id ? 'creator_updated' : 'creator_created', name, '', '');
    commit(before, form.dataset.id ? 'Criador atualizado.' : 'Criador cadastrado.', 'creators');
  }
  function savePermissionForm(form) {
    var before = JSON.stringify(STATE);
    var data = new FormData(form);
    var creator = findById(STATE.creators, data.get('creatorId'));
    if (!creator) { toast('Escolha um criador para a autorização.', 'error'); return; }
    var status = PERMISSION_STATUS.indexOf(String(data.get('status'))) >= 0 ? String(data.get('status')) : 'unverified';
    var evidence = cleanText(data.get('evidence'), 2000);
    var evidenceUrl = cleanText(data.get('evidenceUrl'), 500);
    if (evidenceUrl && !safeUrl(evidenceUrl)) { toast('Informe um link HTTP(S) válido para a evidência.', 'error'); return; }
    var platforms = [];
    Object.keys(PLATFORM_LABEL).concat(STATE.accounts.map(function (a) { return a.platform; })).forEach(function (p) {
      if (p && platforms.indexOf(p) < 0 && data.get('platform_' + p) === 'on') platforms.push(p);
    });
    /* Marcar como válida exige evidência e ao menos uma plataforma: é o que separa
       "o criador disse que pode" de "está registrado que pode, e para onde". */
    if (status === 'valid' && !evidence && !safeUrl(evidenceUrl)) { toast('Uma autorização válida precisa de evidência: texto ou link.', 'error'); return; }
    if (status === 'valid' && !platforms.length) { toast('Marque ao menos uma plataforma coberta pela autorização.', 'error'); return; }
    var validUntil = /^\d{4}-\d{2}-\d{2}$/.test(String(data.get('validUntil'))) ? String(data.get('validUntil')) : '';
    if (status === 'valid' && validUntil && validUntil < localDay()) { toast('O prazo informado já venceu; use o status Vencida.', 'error'); return; }
    var permission = findById(STATE.permissions, form.dataset.id);
    if (!permission) { permission = { id: uid('perm'), createdAt: nowISO() }; STATE.permissions.push(permission); }
    permission.creatorId = creator.id;
    permission.type = PERMISSION_TYPES.indexOf(String(data.get('type'))) >= 0 ? String(data.get('type')) : 'permission';
    permission.holder = cleanText(data.get('holder'), 140);
    permission.evidenceUrl = safeUrl(evidenceUrl);
    permission.grantedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(data.get('grantedAt'))) ? String(data.get('grantedAt')) : '';
    permission.platforms = platforms;
    permission.monetization = ['allowed', 'denied', 'unknown'].indexOf(String(data.get('monetization'))) >= 0 ? String(data.get('monetization')) : 'unknown';
    permission.territory = cleanText(data.get('territory'), 140);
    permission.validUntil = validUntil;
    permission.status = status;
    permission.notes = cleanText(data.get('notes'), 2000);
    permission.migratedFromV3 = false;
    /* Uma fonte marcada como liberada volta a pendente se a autorização deixar de cobrir. */
    STATE.sources.forEach(function (source) {
      if (source.permissionId === permission.id && source.status === 'ready' && permission.status !== 'valid') source.status = 'rights_pending';
    });
    addLog(form.dataset.id ? 'permission_updated' : 'permission_created', creator.name + ' · ' + PERMISSION_STATUS_LABEL[status], '', '');
    var invalidated = revalidate('A autorização mudou; o conteúdo precisa de nova aprovação.');
    if (!commit(before, null, 'creators')) return;
    toast('Autorização salva.' + (invalidated ? ' ' + invalidated + ' aprovação(ões) voltaram para pendente.' : ''));
  }
  function saveSourceForm(form) {
    var before = JSON.stringify(STATE);
    var data = new FormData(form);
    var input = form.querySelector('input[name=localFile]');
    var file = input && input.files && input.files[0];
    var existing = findById(STATE.sources, form.dataset.id);
    var creator = findById(STATE.creators, data.get('creatorId'));
    if (!creator) { toast('Escolha o criador da fonte.', 'error'); return; }
    var name = cleanText(data.get('name'), 140);
    if (!name) { toast('Informe o nome do material.', 'error'); return; }
    var sourceUrl = cleanText(data.get('sourceUrl'), 500);
    var driveUrl = cleanText(data.get('driveUrl'), 500);
    if (sourceUrl && !safeUrl(sourceUrl)) { toast('Informe um link HTTP(S) válido para a origem.', 'error'); return; }
    if (driveUrl && !safeUrl(driveUrl)) { toast('Informe um link HTTP(S) válido para o arquivo no Drive.', 'error'); return; }
    var fileMeta = file ? { name: file.name, size: file.size, lastModified: file.lastModified, type: file.type } : (existing && existing.fileMeta) || null;
    var permission = findById(STATE.permissions, data.get('permissionId'));
    var status = SOURCE_STATUS.indexOf(String(data.get('status'))) >= 0 ? String(data.get('status')) : 'draft';
    var candidate = {
      id: existing ? existing.id : uid('src'), creatorId: creator.id, permissionId: permission ? permission.id : '',
      name: name, format: String(data.get('format') || 'live'), episode: cleanText(data.get('episode'), 140),
      sourceUrl: safeUrl(sourceUrl), driveUrl: safeUrl(driveUrl), fileMeta: fileMeta,
      sourceKey: '', foundAt: cleanText(data.get('foundAt'), 10), durationSec: num(data.get('durationSec')),
      status: status, createdAt: existing ? existing.createdAt : nowISO(), updatedAt: nowISO()
    };
    candidate.sourceKey = makeSourceKey(candidate);
    if (!candidate.sourceKey) { toast('Informe um link de origem, um link do Drive ou escolha um arquivo.', 'error'); return; }
    var duplicate = duplicateOf(STATE.sources, candidate, existing && existing.id);
    if (duplicate) { toast('Esta origem já está registrada como "' + duplicate.name + '".', 'error'); return; }
    if (candidate.status === 'ready' && !permission) { toast('Vincule uma autorização antes de liberar a fonte.', 'error'); return; }
    if (candidate.status === 'ready' && permission.status !== 'valid') { toast('A autorização vinculada não está marcada como Válida.', 'error'); return; }
    if (existing) STATE.sources[STATE.sources.indexOf(existing)] = candidate;
    else STATE.sources.push(candidate);
    addLog(existing ? 'source_updated' : 'source_created', name + ' · ' + SOURCE_STATUS_LABEL[candidate.status], '', '');
    var invalidated = revalidate('A fonte mudou; o conteúdo precisa de nova aprovação.');
    if (!commit(before, null, 'sources')) return;
    if (file) {
      if (SESSION_FILES[candidate.id]) URL.revokeObjectURL(SESSION_FILES[candidate.id]);
      SESSION_FILES[candidate.id] = URL.createObjectURL(file);
    }
    toast((existing ? 'Fonte atualizada.' : 'Fonte registrada.') + (invalidated ? ' ' + invalidated + ' aprovação(ões) voltaram para pendente.' : ''));
  }
  function saveClipForm(form) {
    var before = JSON.stringify(STATE);
    var data = new FormData(form);
    var source = findById(STATE.sources, data.get('sourceId'));
    if (!source) { toast('Escolha a fonte do corte.', 'error'); return; }
    var existing = findById(STATE.clips, form.dataset.id);
    var candidate = {
      id: existing ? existing.id : uid('clp'), sourceId: source.id,
      name: cleanText(data.get('name'), 140), kind: KINDS.indexOf(String(data.get('kind'))) >= 0 ? String(data.get('kind')) : 'viral',
      inSec: num(data.get('inSec')), outSec: num(data.get('outSec')),
      hook: cleanText(data.get('hook'), 300), topic: cleanText(data.ge
      contextWarning: cleanText(data.get('contextWarning'), 600),
      state: CLIP_STATES.indexOf(String(data.get('state'))) >= 0 ? String(data.get('state')) : 'selected',
      createdAt: existing ? existing.createdAt : nowISO(), updatedAt: nowISO()
    };
    var issues = clipIssues(candidate);
    if (issues.length) { toast('Complete: ' + issues.join(', ') + '.', 'error'); return; }
    var publishedLocked = existing && STATE.variants.some(function (v) {
      return v.clipId === existing.id && v.publication === 'published'
        && (num(existing.inSec) !== candidate.inSec || num(existing.outSec) !== candidate.outSec || existing.sourceId !== candidate.sourceId);
    });
    if (publishedLocked) { toast('Este corte já tem uma variante publicada; o recorte e a fonte ficam preservados.', 'error'); return; }
    var created = 0;
    if (existing) STATE.clips[STATE.clips.indexOf(existing)] = candidate;
    else {
      STATE.clips.push(candidate);
      var line = findById(STATE.editorialLines, data.get('editorialLineId'));
      var targets = line ? accountsOfLine(line.id) : (activeAccount() ? [activeAccount()] : []);
      if (!targets.length) { toast('A linha editorial escolhida não tem contas. Cadastre uma conta antes.', 'error'); STATE = JSON.parse(before); return; }
      targets.forEach(function (account) {
        var copy = suggestCopy(candidate.topic, account.niche);
        var variant = {
          id: uid('var'), clipId: candidate.id, accountId: account.id,
          title: copy.title, caption: copy.caption, hashtags: copy.hashtags,
          scheduledAt: suggestSlot(resolveAll(STATE), account.id, candidate.kind, new Date()),
          nicheConfirmed: false, reviewNote: '', publishedUrl: '', error: '',
          metrics: { views: 0, likes: 0, comments: 0, shares: 0 },
          approval: 'pending', publication: 'draft', approvedSnapshot: '', driveVersion: 1,
          createdAt: nowISO(), updatedAt: nowISO(), publishedAt: ''
        };
        STATE.variants.push(variant);
        syncDriveArtifact(variant);
        created++;
      });
    }
    STATE.variants.forEach(function (v) { if (v.clipId === candidate.id) syncDriveArtifact(v); });
    addLog(existing ? 'clip_updated' : 'clip_created', candidate.name, '', '');
    var invalidated = revalidate('O corte mudou; o conteúdo precisa de nova aprovação.');
    if (!commit(before, null, 'queue')) return;
    toast(existing
      ? 'Corte atualizado.' + (invalidated ? ' ' + invalidated + ' aprovação(ões) voltaram para pendente.' : '')
      : 'Corte criado com ' + created + ' variante(s), uma por conta da linha.');
  }
  function readVariantForm(form, existing) {
    var data = new FormData(form);
    return Object.assign({}, existing, {
      title: cleanText(data.get('title'), 180),
      caption: cleanText(data.get('caption'), 2200),
      hashtags: cleanText(data.get('hashtags'), 500),
      scheduledAt: cleanText(data.get('scheduledAt'), 30),
      nicheConfirmed: data.get('nicheConfirmed') === 'on',
      reviewNote: cleanText(data.get('reviewNote'), 2000),
      error: cleanText(data.get('error'), 2000),
      metrics: { views: num(data.get('views')), likes: num(data.get('likes')), comments: num(data.get('comments')), shares: num(data.get('shares')) },
      updatedAt: nowISO()
    });
  }
  function saveVariantForm(form, action) {
    var before = JSON.stringify(STATE);
    var pendingLogs = [];
    var existing = variantOf(form.dataset.id);
    if (!existing) { toast('Variante não encontrada.', 'error'); return; }
    var index = STATE.variants.indexOf(existing);
    var previous = resolveVariant(STATE, existing);
    var variant = readVariantForm(form, existing);
    if (variant.publishedUrl && !safeUrl(variant.publishedUrl)) { toast('Informe um link HTTP(S) válido para a postagem.', 'error'); return; }
    variant.publishedUrl = safeUrl(variant.publishedUrl);
    STATE.variants[index] = variant;
    var resolved = resolveVariant(STATE, variant);
    var account = resolved.account;
    var hasLocalFile = !!(resolved.sourceId && SESSION_FILES[resolved.

    function fail(message) { STATE = JSON.parse(before); toast(message, 'error'); return false; }
    if (existing.publication === 'published' && !safeUrl(variant.publishedUrl)) return fail('Uma publicação concluída precisa manter o link da postagem.');
    if (changed && existing.publication === 'published') return fail('Conteúdo publicado fica preservado. Atualize somente link, métricas, erro ou observações.');
    if (existing.publication === 'published' && action !== 'save') return fail('A publicação concluída fica preservada no histórico.');
    if (changed && (action === 'publish' || action === 'error' || action === 'retry')) return fail('Salve as alterações, revise e aprove novamente antes dessa ação.');
    if (changed && existing.approval === 'approved') {
      variant.approval = 'pending';
      variant.publication = 'draft';
      variant.approvedSnapshot = '';
      pendingLogs.push(['approval_invalidated', 'Conteúdo alterado após aprovação.']);
    }
    if (action === 'approve') {
      var issues = approvalIssues(resolved, account, { hasLocalFile: hasLocalFile });
      if (issues.length) return fail('Antes de aprovar, complete: ' + issues.join(', ') + '.');
      variant.approval = 'approved';
      variant.publication = 'scheduled';
      variant.error = '';
      variant.approvedSnapshot = sensitiveSnapshot(resolveVariant(STATE, variant));
      pendingLogs.push(['approved', 'Aprovado e agendado para ' + fmtDateTime(variant.scheduledAt) + '.']);
    } else if (action === 'changes' || action === 'reject') {
      if (!variant.reviewNote) return fail('Escreva o motivo nas observações da revisão.');
      variant.approval = action === 'changes' ? 'changes' : 'rejected';
      variant.publication = 'draft';
      pendingLogs.push([action === 'changes' ? 'changes_requested' : 'rejected', variant.reviewNote]);
    } else if (action === 'publish') {
      if (existing.publication !== 'scheduled') return fail('Somente uma variante agendada pode ser registrada como publicada.');
      var publishIssues = publishingIssues(resolved, account, { hasLocalFile: hasLocalFile });
      if (publishIssues.length) return fail('Não é possível registrar a publicação: falta ' + publishIssues.join(', ') + '.');
      variant.publication = 'published';
      variant.publishedAt = nowISO();
      variant.error = '';
      pendingLogs.push(['published_manual', variant.publishedUrl]);
    } else if (action === 'error') {
      if (existing.approval !== 'approved' || existing.publication !== 'scheduled') return fail('Somente uma publicação aprovada e agendada pode registrar erro.');
      if (!variant.error) return fail('Descreva o erro encontrado antes de registrá-lo.');
      variant.publication = 'error';
      pendingLogs.push(['publication_error', variant.error]);
    } else if (action === 'retry') {
      if (existing.approval !== 'approved' || existing.publication !== 'error') return fail('Somente uma publicação com erro pode ser reagendada.');
      variant.publication = variant.scheduledAt ? 'scheduled' : 'draft';
      variant.error = '';
      pendingLogs.push(['rescheduled', fmtDateTime(variant.scheduledAt)]);
    } else {
      pendingLogs.push(['variant_updated', changed ? 'Conteúdo atualizado; revisão conferida.' : 'Metadados atualizados.']);
    }
    syncDriveArtifact(variant);
    pendingLogs.forEach(function (entry) { addLog(entry[0], entry[1], variant.id, variant.accountId); });
    var messages = { approve: 'Variante aprovada e agendada.', changes: 'Ajustes solicitados.', reject: 'Variante rejeitada e mantida no histórico.', publish: 'Publicação manual registrada.', error: 'Erro registrado.',
retry: 'Variante reagendada.' };
    commit(before, messages[action] || 'Variante atualizada.', 'queue');
  }
    line: saveLineForm, account: saveAccountForm, creator: saveCreatorForm,
    permission: savePermissionForm, source: saveSourceForm, clip: saveClipForm, variant: saveVariantForm
  };

  function openLineDialog(id) { openModal(lineDialogHTML(findById(STATE.editorialLines, id))); }
  function openAccountDialog(id) { openModal(accountDialogHTML(accountOf(id))); }
  function openCreatorDialog(id) { openModal(creatorDialogHTML(findById(STATE.creators, id))); }
  function openPermissionDialog(id, creatorId) {
    if (!STATE.creators.length) { toast('Cadastre um criador antes de registrar a autorização.', 'error'); return; }
    openModal(permissionDialogHTML(findById(STATE.permissions, id), creatorId));
  }
  function openSourceDialog(id) {
    if (!STATE.creators.length) { toast('Cadastre um criador antes de registrar a fonte.', 'error'); return; }
    openModal(sourceDialogHTML(findById(STATE.sources, id)));
  }
  function openClipDialog(id, sourceId) {
    if (!STATE.sources.length) { toast('Registre uma fonte antes de criar cortes.', 'error'); return; }
    if (!id && !STATE.accounts.length) { toast('Cadastre ao menos uma conta antes de criar cortes.', 'error'); return; }
    openModal(clipDialogHTML(findById(STATE.clips, id), sourceId));
  }
  function openVariantDialog(id) {
    var resolved = resolvedOf(id);
    if (!resolved) { toast('Variante não encontrada.', 'error'); return; }
    openModal(variantDialogHTML(resolved));
  }

  function onDialogChange(event) {
    var target = event.target;
    if (target.name === 'creatorId' && DIALOG.querySelector('select[name=permissionId]')) {
      var perms = STATE.permissions.filter(function (p) { return p.creatorId === target.value; });
      var select = DIALOG.querySelector('select[name=permissionId]');
      select.innerHTML = '<option value="">Nenhuma autorização vinculada</option>' + perms.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(PERMISSION_TYPE_LABEL[p.type] + ' · ' + PERMISSION_STATUS_LABEL[p.status] + ' · ' + ((p.platforms || []).map(platformLabel).join('/') || 'sem plataforma')) + '</
option>';
      }).join('');
    }
    if (target.name === 'localFile' && target.files && target.files[0]) {
      if (TEMP_PREVIEW) URL.revokeObjectURL(TEMP_PREVIEW);
      TEMP_PREVIEW = URL.createObjectURL(target.files[0]);
      var preview = DIALOG.querySelector('[data-preview]');
      if (preview) preview.innerHTML = '<video class="vop-preview" controls preload="metadata" src="' + esc(TEMP_PREVIEW) + '"></video>';
    }
  }
  function onDialogClick(event) {
    var button = event.target.closest('[data-dialog-act]');
    if (!button) return;
    var action = button.dataset.dialogAct;
    if (action === 'close') { closeDialog(); return; }
    var form = button.closest('form');
    if (!form) return;
    if (action === 'open-clip') { openClipDialog(button.dataset.id); return; }
    if (action === 'suggest-copy') {
      var resolved = resolvedOf(form.dataset.id);
      var copy = suggestCopy(resolved && resolved.clip ? resolved.clip.topic : '', resolved && resolved.account ? resolved.account.niche : '');
      form.elements.title.value = copy.title;
      form.elements.caption.value = copy.caption;
      form.elements.hashtags.value = copy.hashtags;
      toast('Sugestão criada localmente. Revise antes de aprovar.');
      return;
    }
    if (action === 'suggest-time') {
      var current = resolvedOf(form.dataset.id);
      if (!current) return;
      var slot = suggestSlot(resolveAll(STATE), current.accountId, current.kind, new Date());
      if (!slot) { toast('Não encontrei horário livre nos próximos 90 dias.', 'error'); return; }
      form.elements.scheduledAt.value = slot;
      return;
    }
    if (action === 'export-package') {
      var variant = variantOf(form.dataset.id);
      var pkg = publicationPackage(STATE, variant);
      if (!pkg) { toast('Não consegui montar o pacote desta variante.', 'error'); return; }
      var base = 'pacote-' + safeName(pkg.destino.plataforma, 20) + '-' + safeName(pkg.conteudo.titulo || 'variante', 40);
      download(base + '.json', JSON.stringify(pkg, null, 2), 'application/json');
      download(base + '.txt', packageText(pkg), 'text/plain;charset=utf-8');
      addLog('package_exported', pkg.arquivo ? pkg.arquivo.caminhoRelativo : '', variant.id, variant.accountId);
      persist();
      toast('Pacote de publicação exportado. O arquivo de vídeo ainda não existe — o caminho está reservado.');
      return;
    }
    if (action === 'delete-variant') {
      var target = variantOf(form.dataset.id);
      if (!target) return;
      if (target.publication === 'published') { toast('Uma variante publicada fica preservada no histórico.', 'error'); return; }
      if (!confirm('Excluir esta variante? O corte e a fonte continuam registrados.')) return;
      var before = JSON.stringify(STATE);
      STATE.variants.splice(STATE.variants.indexOf(target), 1);
      STATE.driveArtifacts = STATE.driveArtifacts.filter(function (a) { return a.variantId !== target.id; });
      addLog('variant_deleted', target.title || target.id, '', target.accountId);
      commit(before, 'Variante excluída.', 'queue');
      return;
    saveVariantForm(form, action);
  }

  function download(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type || 'text/plain;charset=utf-8' }));
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  function copyText(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = document.execCommand('copy');
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }
  function importBackup(file) {
    file.text().then(function (text) {
      var imported = sanitizeState(JSON.parse(text), { resetExternalApprovals: true });
      if (!imported) throw new Error('Formato inválido');
      if (!confirm('Substituir os dados atuais pelo backup selecionado?')) return;
      var before = STATE;
      var activeBefore = ACTIVE_ACCOUNT;
      var brokenBefore = BROKEN_RAW;
      STATE = imported;
      STATE.revision = before.revision;
      ACTIVE_ACCOUNT = STATE.accounts[0] ? STATE.accounts[0].id : '';
      BROKEN_RAW = '';
      if (!persist({ force: !!brokenBefore })) { STATE = before; ACTIVE_ACCOUNT = activeBefore; BROKEN_RAW = brokenBefore; return; }
      render();
      toast('Backup importado. Todo conteúdo aprovado voltou para revisão.');
    }).catch(function () { toast('O arquivo não é um backup válido do Estúdio de Vídeos.', 'error'); });
  }
  function onRootChange(event) {
    if (event.target.matches('[data-act=account-select]')) { ACTIVE_ACCOUNT = event.target.value; render(); return; }
    if (event.target.matches('[data-act=plan-day]')) { PLAN_DAY = event.target.value || localDay(); render(); return; }
    if (event.target.id === 'vop-import-file' && event.target.files[0]) importBackup(event.target.files[0]);
  }
  function onRootInput(event) {
    if (!event.target.matches('[data-act=search]')) return;
    SEARCH = event.target.value;
    refreshList();
  }
  function onRootClick(event) {
    var button = event.target.closest('[data-act]');
    if (!button) return;
    var action = button.dataset.act;
    if (action === 'tab') { TAB = button.dataset.tab; render(); }
    else if (action === 'filter') { FILTER = button.dataset.filter; render(); }
    else if (action === 'line-add') openLineDialog();
    else if (action === 'line-edit') openLineDialog(button.dataset.id);
    else if (action === 'account-add') openAccountDialog();
    else if (action === 'account-edit') openAccountDialog(button.dataset.id);
    else if (action === 'creator-add') openCreatorDialog();
    else if (action === 'creator-edit') openCreatorDialog(button.dataset.id);
    else if (action === 'permission-add') openPermissionDialog('', button.dataset.creator);
    else if (action === 'permission-edit') openPermissionDialog(button.dataset.id);
    else if (action === 'source-add') openSourceDialog();
    else if (action === 'source-edit') openSourceDialog(button.dataset.id);
    else if (action === 'clip-add') openClipDialog('', button.dataset.source);
    else if (action === 'variant-open') openVariantDialog(button.dataset.id);
    else if (action === 'account-pause') {
      var account = accountOf(button.dataset.id);
      if (!account) return;
      var before = JSON.stringify(STATE);
      account.paused = !account.paused;
      addLog(account.paused ? 'account_paused' : 'account_resumed', account.name, '', account.id);
      commit(before, account.paused ? 'Conta pausada. Nenhuma publicação poderá ser registrada.' : 'Conta retomada.');
    }
    else if (action === 'report-range') { REPORT_DAYS = Number(button.dataset.days); render(); }
    else if (action === 'export-csv') { download('operacao-videos-' + localDay() + '.csv', toCsv(STATE), 'text/csv;charset=utf-8'); toast('Planilha CSV exportada.'); }
    else if (action === 'export-json') { download('backup-video-ops-' + localDay() + '.json', JSON.stringify(STATE, null, 2), 'application/json'); toast('Backup JSON exportado.'); }
    else if (action === 'import-json') { var input = document.getElementById('vop-import-file'); if (input) input.click(); }
    else if (action === 'download-raw') { download('video-ops-recupera
      if (!confirm('Começar de novo? Baixe os dados brutos antes; esta ação substitui o conteúdo local que não pôde ser lido.')) return;
      var rawBefore = BROKEN_RAW;
      try { localStorage.removeItem(KEY); } catch (e) { toast('Não foi possível limpar o armazenamento local.', 'error'); return; }
      BROKEN_RAW = '';
      STATE = seed();
      ACTIVE_ACCOUNT = '';
      if (!persist()) { BROKEN_RAW = rawBefore; try { localStorage.setItem(KEY, rawBefore); } catch (e2) {} return; }
      render();
      toast('Estúdio reiniciado.');
    }
    else if (action === 'drive-tree') {
      copyText(driveTree(STATE)).then(function () { toast('Estrutura de pastas copiada. Crie-a dentro da pasta sincronizada do Drive.'); })
        .catch(function () { toast('Não consegui copiar. Exporte o backup e tente novamente.', 'error'); });
    }
  function init() {
    var root = document.getElementById('video-ops-root');
    if (!root) return;
    STATE = load();
    if (!localStorage.getItem(KEY)) persist();
    else if (MIGRATED_FROM_V3) persist({ force: true });
    ACTIVE_ACCOUNT = STATE.accounts[0] ? STATE.accounts[0].id : '';
    PLAN_DAY = localDay();
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
    root.addEventListener('input', onRootInput);
    render();
    window.videoOpsRefresh = render;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      seed: seed,
      sanitizeState: sanitizeState,
      migrateV3: migrateV3,
      sourceKeys: sourceKeys,
      normalizeSource: normalizeSource,
      makeSourceKey: makeSourceKey,
      duplicateOf: duplicateOf,
      permissionCovers: permissionCovers,
      permissionWarnings: permissionWarnings,
      resolveVariant: resolveVariant,
      resolveAll: resolveAll,
      approvalIssues: approvalIssues,
      publishingIssues: publishingIssues,
      clipIssues: clipIssues,
      clipUnmarked: clipUnmarked,
      sensitiveSnapshot: sensitiveSnapshot,
      dailyGoal: dailyGoal,
      engagement: engagement,
      buildReport: buildReport,
      suggestCopy: suggestCopy,
      suggestSlot: suggestSlot,
      toCsv: toCsv,
      safeName: safeName,
      platformLabel: platformLabel,
      drivePath: drivePath,
      driveMasterPath: driveMasterPath,
      driveTree: driveTree,
      publicationPackage: publicationPackage,
      packageText: packageText,
      BACKUP_V3_KEY: BACKUP_V3_KEY,
      SCHEMA_VERSION: SCHEMA_VERSION
    };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();

  Ran 1 shell command

Sintaxe OK, e todas as asserções v3 de lógica pura passaram sem alteração (dedup, aprovação, snapshot, metas, relatório, CSV) — a resolveVariant cumpriu o papel. Quebrou só no driveTree, que mudou de propósito. Lendo o trecho final do teste para reescrevê-lo:

  Read 1 file

Um bug real que os testes acabam de expor: no saneamento v4 eu recalculo sourceKey só a partir das URLs, perdendo o fallback que storedSourceKeys tem — uma fonte sem URL (só chave herdada) seria rejeitada e mandaria o estado inteiro para a tela de recuperação. Corrigindo:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 3 lines, removed 1 line
        createdAt: cleanText(rawSource.createdAt, 40) || nowISO(),
        updatedAt: cleanText(rawSource.updatedAt, 40) || nowISO()
      };
      source.sourceKey = makeSourceKey(source);
      /* Mesmo fallback de storedSourceKeys: uma fonte pode ter só a chave herdada,
         sem URL nem arquivo nesta sessão. Recalcular sem o fallback a rejeitaria. */
      source.sourceKey = makeSourceKey(source) || cleanText(rawSource.sourceKey, 600);
      if (!source.sourceKey || duplicateOf(clean.sources, source, '')) return null;
      /* Sem autorização vinculada a fonte nunca fica "liberada". */
      if (!permissionId && source.status === 'ready') source.status = 'rights_pending';

Agora reescrevendo o trecho de Drive e migração do teste para o schema 4:

● Update(~\Downloads\seller-arthur\test-video-ops.js)
Added 4 lines, removed 3 lines
assert.ok(csv.includes('"Conta piloto"'), 'CSV inclui a conta');
const formulaCsv = V.toCsv({ accounts: [account], videos: [{ ...ready, name: '=1+1', metrics: {} }] });
assert.ok(formulaCsv.includes('"\'=1+1"'), 'CSV neutraliza fórmulas iniciadas por = + - @');
const tree = V.driveTree({ accounts: [account] });
assert.ok(tree.includes('Conta 01 - Tecnologia/'), 'estrutura do Drive separa conta e nicho');
assert.ok(tree.includes('Vídeos publicados/'), 'estrutura inclui o ciclo completo');
const tree = V.driveTree({ accounts: [{ id: 'a1', name: 'Conta piloto', handle: 'piloto_tt', platform: 'tiktok' }] });
['Projeto Automação de Vídeos/', '  Criadores e permissões/', '  Cortes mestres/', '  Variantes/', '    TikTok/', '      piloto_tt/', '  Publicados/', '  Erros de processamento/']
  .forEach((folder) => assert.ok(tree.includes(folder), `estrutura do Drive inclui ${folder.trim()}`));
assert.ok(!tree.includes('Conta 01 -'), 'estrutura antiga por número de conta foi substituída');

const approvedForBackup = { ...ready, name: 'Backup seguro', sourceUrl: 'https://example.com/seguro.mp4', sourceKey: V.makeSourceKey({ sourceUrl: 'https://example.com/seguro.mp4' }), publication: 'scheduled', metrics: {}
 };
approvedForBackup.approvedSnapshot = V.sensitiveSnapshot(approvedForBackup);

● Update(~\Downloads\seller-arthur\test-video-ops.js)
Added 10 lines, removed 8 lines
  videos: [{ ...approvedForBackup, refresh_token: 'NAO_PERSISTIR' }],
  logs: []
});
assert.ok(imported && imported.videos[0].approval === 'approved', 'backup válido preserva aprovação vinculada ao snapshot');
assert.ok(!('refresh_token' in imported.accounts[0]) && !('refresh_token' in imported.videos[0]), 'importação usa allowlist e descarta campos desconhecidos');
assert.ok(imported && imported.variants[0].approval === 'approved', 'backup válido preserva aprovação vinculada ao snapshot');
assert.ok(!('refresh_token' in imported.accounts[0]) && !('refresh_token' in imported.variants[0]), 'importação usa allowlist e descarta campos desconhecidos');
const externalApproved = V.sanitizeState({ version: 3, meta: { start: '2026-07-31' }, accounts: [account], videos: [approvedForBackup], logs: [] }, { resetExternalApprovals: true });
assert.deepStrictEqual([externalApproved.videos[0].approval, externalApproved.videos[0].publication], ['pending', 'draft'], 'backup externo exige nova aprovação antes de publicar');
assert.deepStrictEqual([externalApproved.variants[0].approval, externalApproved.variants[0].publication], ['pending', 'draft'], 'backup externo exige nova aprovação antes de publicar');
const legacyPublished = { ...approvedForBackup, approval: 'approved', publication: 'published', approvedSnapshot: '', publishedAt: '2026-07-31T15:00:00Z' };
const migratedLegacy = V.sanitizeState({ version: 1, meta: { start: '2026-07-31' }, accounts: [account], videos: [legacyPublished], logs: [] }, { migrateLegacyApprovals: true });
assert.strictEqual(migratedLegacy.videos[0].publication, 'published', 'load local migra publicação válida da versão anterior sem perder o relatório');
assert.strictEqual(migratedLegacy.variants[0].publication, 'published', 'load local migra publicação válida da versão anterior sem perder o relatório');
const legacyMultiAccount = { ...account, platforms: ['TikTok', 'Instagram'] };
const legacyMultiVideo = { ...legacyPublished, platform: 'Instagram' };
const migratedMulti = V.sanitizeState({ version: 1, meta: { start: '2026-07-31' }, accounts: [legacyMultiAccount], videos: [legacyMultiVideo], logs: [] }, { migrateLegacyApprovals: true });
assert.strictEqual(migratedMulti.videos[0].publication, 'published', 'migração preserva histórico publicado em plataforma legada');
assert.strictEqual(migratedMulti.variants[0].publication, 'published', 'migração preserva histórico publicado em plataforma legada');
assert.strictEqual(migratedMulti.accounts.length, 2, 'conta com duas pl
const strictLegacyImport = V.sanitizeState({ version: 1, meta: { start: '2026-07-31' }, accounts: [account], videos: [legacyPublished], logs: [] });
assert.strictEqual(strictLegacyImport.videos[0].publication, 'draft', 'importação não confia em aprovação antiga sem snapshot');
assert.strictEqual(strictLegacyImport.variants[0].publication, 'draft', 'importação não confia em aprovação antiga sem snapshot');
const tampered = V.sanitizeState({ meta: { start: '2026-07-31' }, accounts: [account], videos: [{ ...approvedForBackup, title: 'Alterado depois da aprovação' }], logs: [] });
assert.strictEqual(tampered.videos[0].approval, 'pending', 'backup alterado invalida a aprovação');
assert.strictEqual(tampered.variants[0].approval, 'pending', 'backup alterado invalida a aprovação');
const localBackup = { ...localOnly, id: 'local1', name: 'Local', approval: 'approved', publication: 'scheduled', metrics: {}, approvedSnapshot: V.sensitiveSnapshot(localOnly) };
const localImported = V.sanitizeState({ meta: { start: '2026-07-31' }, accounts: [account], videos: [localBackup], logs: [] });
assert.strictEqual(localImported.videos[0].approval, 'pending', 'arquivo local sem link volta para aprovação após reload');
assert.strictEqual(localImported.variants[0].approval, 'pending', 'arquivo local sem link volta para aprovação após reload');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  Ran 1 shell command

O teste expõe uma questão de fundo real: um snapshot escrito pelo schema 3 nunca pode bater com o do schema 4, porque o novo inclui recorte, autorização e estado da fonte. Sem tratamento, toda aprovação legítima morreria na migração. A correção honesta é validar o backup antigo sob as regras antigas antes de confiar nele:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 11 lines
     e uma conta com várias plataformas é DIVIDIDA em uma conta por plataforma.
     O booleano rightsConfirmed vira uma autorização sintética marcada migratedFromV3,
     que aparece na interface como pendência de evidência — nunca como prova. */
  /* Snapshot como o schema 3 o calculava (10 campos, sem recorte/autorização/fonte).
     Serve só para conferir se um registro antigo estava íntegro quando foi gravado. */
  function v3Snapshot(video) {
    return JSON.stringify([
      video.accountId, storedSourceKeys(video), video.kind, video.platform, video.title,
      video.caption, video.hashtags, video.scheduledAt, !!video.rightsConfirmed, !!video.nicheConfirmed
    ]);
  }
  function migrateV3(value) {
    var out = seed(value.meta && value.meta.start);
    /* Marcador transitório (nunca persistido): quais aprovações do schema 3 estavam
       íntegras sob as regras do schema 3 e portanto merecem um snapshot novo. */
    out.__v3ApprovedOk = Object.create(null);
    out.revision = Math.max(0, Math.floor(num(value.revision)));
    var creator = { id: 'cre_v3', name: 'Criador não informado (migrado do schema 3)', profiles: '', clipPolicy: '', contact: '', createdAt: nowISO() };
    var permOk = { id: 'perm_v3_autorizados', creatorId: creator.id, type: 'permission', holder: '', evidence: '', evidenceUrl: '', grantedAt: '', platforms: [], monetization: 'unknown', territory: '', validUntil: '', st
atus: 'valid', notes: 'Migrada do schema 3: o operador havia marcado "conteúdo próprio, licenciado ou autorizado". Registre a evidência.', migratedFromV3: true, createdAt: nowISO() };

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 5 lines
      /* Plataforma que não existia na conta ganha a sua própria conta derivada em vez de
         ser descartada — migração não apaga destino. */
      var accountId = entry.byPlatform[platform] || addMigratedAccount(cleanText(raw.accountId, 100), platform);
      var storedSnapshot = cleanText(raw.approvedSnapshot, 8000);
      if (raw.approval === 'approved' && storedSnapshot
          && (storedSnapshot === v3Snapshot(raw) || storedSnapshot === sensitiveSnapshot(raw))) {
        out.__v3ApprovedOk[videoId] = true;
      var rights = !!raw.rightsConfirmed;
      var permission = rights ? permOk : permPending;
      if (rights) { usedOk = true; if (permission.platforms.indexOf(platform) < 0 && platform) permission.platforms.push(platform); }

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 5 lines, removed 1 line
      }
      if (variant.approval === 'approved' && variant.publication !== 'published'
          && resolved.fileMeta && !resolved.sourceUrl && !resolved.driveUrl) invalidate();
      if (legacy && variant.approval === 'approved'
      /* Regrava o snapshot no formato novo quando a aprovação antiga era legítima:
         ou o carregamento local pediu migração, ou o registro do schema 3 estava
         íntegro sob as regras do próprio schema 3. */
      var v3Ok = !!(src.__v3ApprovedOk && src.__v3ApprovedOk[variantId]);
      if ((legacy || v3Ok) && variant.approval === 'approved'
          && !approvalIssues(resolved, account).length
          && (variant.publication !== 'published' || safeUrl(variant.publishedUrl))) {
        variant.approvedSnapshot = sensitiveSnapshot(resolveVariant(clean, variant));


Baseline v4 verde. Agora os testes das regras novas — o contrato exige um teste para cada uma:

● Update(~\Downloads\seller-arthur\test-video-ops.js)
Added 132 lines
const localImported = V.sanitizeState({ meta: { start: '2026-07-31' }, accounts: [account], videos: [localBackup], logs: [] });
assert.strictEqual(localImported.variants[0].approval, 'pending', 'arquivo local sem link volta para aprovação após reload');

/* ---------- schema 4: direitos, cortes, variantes e caminho no Drive ---------- */

const v4 = () => ({
  version: 4, revision: 0, meta: { start: '2026-07-31', days: 90 },
  editorialLines: [{ id: 'line1', name: 'Linha 01', themes: 'Tecnologia' }],
  creators: [{ id: 'cre1', name: 'Podcaster Convidado' }],
  permissions: [{ id: 'perm1', creatorId: 'cre1', type: 'clip_program', holder: 'Podcaster', evidence: 'Programa oficial de cortes', platforms: ['tiktok', 'instagram'], status: 'valid' }],
  accounts: [
    { id: 'tt1', name: 'Piloto TikTok', handle: 'piloto_tt', platform: 'tiktok', editorialLineId: 'line1', niche: 'Tecnologia' },
    { id: 'ig1', name: 'Piloto Instagram', handle: 'piloto_ig', platform: 'instagram', editorialLineId: 'line1', niche: 'Tecnologia' }
  ],
  sources: [{ id: 'src1', creatorId: 'cre1', permissionId: 'perm1', name: 'Live sobre IA', sourceUrl: 'https://example.com/live-ia', status: 'ready' }],
  clips: [{ id: 'clp1', sourceId: 'src1', name: 'Três erros comuns', topic: 'Três erros comuns', kind: 'viral', inSec: 120, outSec: 175, state: 'selected' }],
  variants: [
    { id: 'var-tt', clipId: 'clp1', accountId: 'tt1', title: 'Três erros', caption: 'Legenda longa', hashtags: '#ia', scheduledAt: '2026-08-01T12:00', nicheConfirmed: true },
    { id: 'var-ig', clipId: 'clp1', accountId: 'ig1', title: 'Três erros', caption: 'Legenda longa', hashtags: '#ia', scheduledAt: '2026-08-01T18:00', nicheConfirmed: true }
  ],
  driveArtifacts: [], logs: []
});
const state4 = V.sanitizeState(v4());
assert.ok(state4, 'estado do schema 4 é aceito');
assert.strictEqual(state4.version, V.SCHEMA_VERSION, 'saneamento carimba a versão corrente');
assert.strictEqual(state4.variants.length, 2, 'um corte alimenta dois destinos independentes');

// autorização cobre exatamente o que declara
const perm = state4.permissions[0];
assert.ok(V.permissionCovers(perm, 'tiktok', '2026-08-01'), 'autorização válida cobre a plataforma listada');
assert.ok(!V.permissionCovers(perm, 'youtube', '2026-08-01'), 'plataforma fora da lista não é coberta');
assert.ok(!V.permissionCovers({ ...perm, platforms: [] }, 'tiktok', '2026-08-01'), 'sem plataforma declarada a autorização não cobre nada');
assert.ok(!V.permissionCovers({ ...perm, status: 'unverified' }, 'tiktok', '2026-08-01'), 'autorização não verificada não libera');
assert.ok(!V.permissionCovers({ ...perm, validUntil: '2026-07-30' }, 'tiktok', '2026-08-01'), 'autorização vencida não libera');
assert.ok(V.permissionCovers({ ...perm, validUntil: '2026-08-01' }, 'tiktok', '2026-08-01'), 'o último dia do prazo ainda vale');
assert.ok(!V.permissionCovers(null, 'tiktok', '2026-08-01'), 'sem autorização não há cobertura');
assert.deepStrictEqual(V.permissionWarnings(perm), [], 'autorização completa não tem pendência');
assert.ok(V.permissionWarnings({ ...perm, evidence: '', evidenceUrl: '' }).includes('evidência da autorização'), 'falta de evidência vira pendência');
assert.ok(V.permissionWarnings({ ...perm, migratedFromV3: true }).includes('revisão da migração do schema 3'), 'autorização migrada pede revisão');
assert.ok(V.permissionWarnings(null).includes('autorização vinculada'), 'fonte sem autorização é sinalizada');
const expiredState = V.sanitizeState({ ...v4(), permissions: [{ ...perm, status: 'valid', validUntil: '2020-01-01' }] });
assert.strictEqual(expiredState.permissions[0].status, 'expired', 'prazo vencido nunca é lido como válido, mesmo que o backup afirme');

// direitos derivados por destino
const rTT = V.resolveVariant(state4, state4.variants[0]);
assert.ok(rTT.rightsConfirmed, 'variante herda a cobertura da autorização da fonte');
assert.deepStrictEqual(V.approvalIssues(rTT, rTT.account), [], 'variante completa e coberta pode ser aprovada');
const onlyTikTok = V.sanitizeState({ ...v4(), permissions: [{ ...perm, platforms: ['tiktok'] }] });
assert.ok(V.resolveVariant(onlyTikTok, onlyTikTok.variants[0]).rightsConfirmed, 'autorização só de TikTok cobre a conta TikTok');
assert.ok(!V.resolveVariant(onlyTikTok, onlyTikTok.variants[1]).rightsConfirmed, 'a mesma autorização não libera o Instagram');
assert.ok(V.approvalIssues(V.resolveVariant(onlyTikTok, onlyTikTok.variants[1]), onlyTikTok.accounts[1]).includes('direitos de uso'), 'destino não coberto bloqueia aprovação');
const pendingSource = V.sanitizeState({ ...v4(), sources: [{ ...v4().sources[0], status: 'rights_pending' }] });
assert.ok(V.approvalIssues(V.resolveVariant(pendingSource, pendingSource.variants[0]), pendingSource.accounts[0]).includes('fonte liberada'), 'fonte não liberada bloqueia aprovação');
const noPermission = V.sanitizeState({ ...v4(), sources: [{ ...v4().sources[0], permissionId: '', status: 'ready' }] });
assert.strictEqual(noPermission.sources[0].status, 'rights_pending', 'fonte sem autorização nunca fica liberada');

// snapshot cobre recorte, autorização e estado da fonte
const moved = V.sanitizeState({ ...v4(), clips: [{ ...v4().clips[0], outSec: 200 }] });
assert.notStrictEqual(
  V.sensitiveSnapshot(V.resolveVariant(state4, state4.variants[0])),
  V.sensitiveSnapshot(V.resolveVariant(moved, moved.variants[0])),
  'mudar o fim do corte invalida a aprovação da variante'
);
assert.deepStrictEqual(V.clipIssues({ name: 'x', topic: 'y', inSec: 10, outSec: 5 }), ['início e fim do corte'], 'fim antes do início é rejeitado');
assert.deepStrictEqual(V.clipIssues({ name: 'x', topic: 'y', inSec: 10, outSec: 10 }), ['início e fim do corte'], 'corte de duração zero é rejeitado');
assert.deepStrictEqual(V.clipIssues({ name: 'x', topic: 'y', inSec: 0, outSec: 30 }), [], 'corte marcado a partir do segundo zero é válido');
assert.ok(V.clipIssues(null).length, 'corte ausente é pendência');
assert.ok(V.clipUnmarked({ inSec: 0, outSec: 0 }), 'corte migrado sem marcação é identificável');
assert.ok(!V.clipUnmarked({ inSec: 0, outSec: 30 }), 'corte com fim mar
// nomes seguros no Windows
assert.strictEqual(V.safeName('a/b\\c:d*e?f"g<h>i|j'), 'a-b-c-d-e-f-g-h-i-j', 'caracteres proibidos viram hífen');
assert.strictEqual(V.safeName('Ação Café'), 'Acao Cafe', 'acentos são removidos do nome de arquivo');
assert.strictEqual(V.safeName('nome final...'), 'nome final', 'ponto final é descartado pelo Explorer, então some antes');
assert.strictEqual(V.safeName('  espaço  '), 'espaco', 'espaços das pontas somem');
assert.strictEqual(V.safeName('CON'), '_CON', 'nome reservado do Windows é escapado');
assert.strictEqual(V.safeName('nul'), '_nul', 'nome reservado também em minúsculas');
assert.strictEqual(V.safeName(''), 'sem-nome', 'nome vazio tem fallback');
assert.strictEqual(V.safeName('x'.repeat(200), 40).length, 40, 'nome longo é truncado');
assert.ok(!/[.\s]$/.test(V.safeName('abcdefghij.', 11)), 'truncar não deixa ponto no fim');

// caminho determinístico no Drive
const pTT = V.drivePath(state4, state4.variants[0]);
const pIG = V.drivePath(state4, state4.variants[1]);
assert.deepStrictEqual(pTT, V.drivePath(state4, state4.variants[0]), 'o mesmo estado gera sempre o mesmo caminho');
assert.notStrictEqual(pTT.relPath, pIG.relPath, 'cada destino tem o seu próprio arquivo');
assert.ok(pTT.relPath.startsWith('Projeto Automação de Vídeos/Variantes/TikTok/piloto_tt/'), 'variante do TikTok cai na pasta da conta');
assert.ok(pIG.relPath.startsWith('Projeto Automação de Vídeos/Variantes/Instagram/piloto_ig/'), 'variante do Instagram cai na pasta da conta');
assert.strictEqual(pTT.tempName, pTT.fileName + '.part', 'o worker grava em .part antes de renomear');
assert.ok(pTT.fileName.endsWith('-v1.mp4'), 'o nome carrega a versão');
assert.ok(!/[\\:*?"<>|]/.test(pTT.fileName), 'o nome final não tem cara
assert.ok(!/[\\:*?"<>|]/.test(V.drivePath(hostile, hostile.variants[0]).relPath), 'nome hostil de criador é sanitizado no caminho');
assert.ok(V.driveMasterPath(state4, state4.clips[0]).relPath.startsWith('Projeto Automação de Vídeos/Cortes mestres/'), 'o corte mestre fica separado das variantes');

// pacote de publicação manual
const pkg = V.publicationPackage(state4, state4.variants[0]);
assert.strictEqual(pkg.destino.handle, '@piloto_tt', 'o pacote deixa o destino inequívoco');
assert.strictEqual(pkg.destino.plataforma, 'TikTok', 'o pacote nomeia a plataforma');
assert.strictEqual(pkg.arquivo.caminhoRelativo, pTT.relPath, 'o pacote carrega o caminho calculado');
assert.strictEqual(pkg.arquivo.estado, 'Caminho reservado', 'sem worker, o arquivo é apenas um caminho reservado');
assert.strictEqual(pkg.autorizacao.status, 'Válida', 'o pacote registra a autorização usada');
const pkgText = V.packageText(pkg);
assert.ok(pkgText.includes('@piloto_tt') && pkgText.includes(pTT.relPath), 'o checklist repete destino e caminho');
assert.ok(pkgText.includes('marca d\'água'), 'o checklist lembra de conferir marca d\'água de outra rede');

// integridade estrutural: falha visível, nunca exclusão silenciosa
assert.strictEqual(V.sanitizeState({ ...v4(), variants: [{ id: 'orfa', clipId: 'nao-existe', accountId: 'tt1' }] }), null, 'variante sem corte derruba o estado para a tela de recuperação');
assert.strictEqual(V.sanitizeState({ ...v4(), variants: [{ id: 'orfa', clipId: 'clp1', accountId: 'nao-existe' }] }), null, 'variante sem conta derruba o estado');
assert.strictEqual(V.sanitizeState({ ...v4(), clips: [{ id: 'clp1', sourceId: 'nao-existe', name: 'x' }] }), null, 'corte sem fonte derruba o estado');
assert.strictEqual(V.sanitizeState({ ...v4(), sources: [{ ...v4().sources[0], creatorId: 'nao-existe' }] }), null, 'fonte sem criador derruba o estado');
const dupSources = V.sanitizeState({ ...v4(), sources: [v4().sources[0], { ...v4().sources[0], id: 'src2' }] });
assert.strictEqual(dupSources, null, 'a mesma live registrada duas vezes é recusada');
const minimal = V.sanitizeState({ version: 4, meta: { start: '2026-07-31' }, accounts: [{ id: 'tt1', name: 'Só conta', platform: 'tiktok' }], variants: [] });
assert.ok(minimal, 'estado v4 sem as coleções novas continua válido');
assert.deepStrictEqual([minimal.creators, minimal.permissions, minimal.sources, minimal.clips, minimal.driveArtifacts], [[], [], [], [], []], 'coleção ausente vira lista vazia, não erro');
const roundTrip = V.sanitizeState(JSON.parse(JSON.stringify(state4)));
assert.deepStrictEqual(roundTrip.variants, state4.variants, 'sanear duas vezes não muda nada (idempotente)');
assert.ok(!('__v3ApprovedOk' in state4), 'o marcador de migração não é persistido');

// migração v3: autorização sintética e rede de segurança
const migrated = V.migrateV3({ version: 3, meta: { start: '2026-07-31' }, accounts: [account], videos: [approvedForBackup], logs: [] });
assert.strictEqual(migrated.creators.length, 1, 'migração cria o criador sintético');
assert.ok(migrated.permissions.every((p) => p.migratedFromV3), 'toda autorização vinda do schema 3 fica marcada como migrada');
assert.ok(migrated.permissions.every((p) => !p.evidence && !p.evidenceUrl), 'a migração não inventa evidência de autorização');
assert.strictEqual(migrated.sources.length, 1, 'cada vídeo do schema 3 vira uma fonte');
assert.strictEqual(migrated.clips.length, 1, 'cada vídeo do schema 3 vira um corte');
assert.strictEqual(migrated.variants[0].id, approvedForBackup.id, 'o id do vídeo antigo vira o id da variante, preservando os logs');
assert.ok(V.clipUnmarked(migrated.clips[0]), 'corte migrado fica sem marcação de início e fim');
const migratedPending = V.migrateV3({ version: 3, meta: { start: '2026-07-31' }, accounts: [account], videos: [{ ...approvedForBackup, rightsConfirmed: false }], logs: [] });
assert.strictEqual(migratedPending.sources[0].status, 'rights_pending', 'sem direitos confirmados a fonte migrada fica pendente');
assert.strictEqual(migratedPending.permissions[0].status, 'unverified', 'a autorização correspondente não é dada como válida');
assert.strictEqual(typeof V.BACKUP_V3_KEY, 'string', 'a chave de backup do schema 3 é exportada para o rollback');
assert.notStrictEqual(V.BACKUP_V3_KEY, 'pp_video_ops_v1', 'o backup do schema 3 não sobrescreve a chave principal');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'video-ops.js'), 'utf8');

  Ran 1 shell command

Passou inteiro. Antes de confiar, confirmando que a suíte tem dentes e vendo o que já existe no CSS para reaproveitar:

  Ran 1 shell command

O restore corrompeu o arquivo — Get-Content -Raw no PowerShell 5.1 lê UTF-8 como ANSI. Diagnosticando o dano antes de agir:

  Made 1 scratchpad edit +24, ran 1 shell command

Reversível: é UTF-8 lido como cp1252 e regravado, mais um BOM. Removendo o BOM e desfazendo o round-trip:

  Made 1 scratchpad edit +18, ran 1 shell command

U+0081 é um dos bytes indefinidos do cp1252 que o .NET repassou cru — o encoder do Python o rejeita. Fazendo o inverso byte a byte, com fallback para os cinco pontos indefinidos:

  Made 1 scratchpad edit +28, ran 1 shell command

O reparo abortou antes de gravar (nada piorou). Localizando onde o "Ã" sobrevive:


Falso positivo: PUBLICAÇÃO contém "Ã" legitimamente. A asserção estava errada, não o reparo. Corrigindo o teste de sanidade e gravando:

  Made 1 scratchpad edit +2 -1, ran 1 shell command

Recuperado integralmente — 134.092 bytes, testes verdes. Lição registrada: Get-Content/Set-Content do PS 5.1 não fazem round-trip de UTF-8. Fazendo um checkpoint no git agora, já que quase perdi o trabalho:

  Ran 1 shell command

index.html intacto, só os dois arquivos previstos. Agora o CSS. Vendo as convenções existentes (variáveis, chips) para casar o estilo:

  Ran 2 shell commands

Agora o CSS. Vou escopar os chips novos como .vop-chip.x (funciona no painel e n
● Update(~\Downloads\seller-arthur\video-ops.css)
File must be read first

  Read 1 file

● Update(~\Downloads\seller-arthur\video-ops.css)
Added 123 lines
  .vop-video-meta span + a::before { content: none; }
}

/* ── Schema 4: criadores, autorizações, fontes, cortes e destino no Drive ──
   Os chips novos exigem .vop-chip no seletor: valem no painel e dentro do <dialog>
   (que vive no body, fora de #view-video-ops) sem virar classe global solta. */
.vop-chip.source-draft,
.vop-chip.permission-unverified,
.vop-chip.drive-planned,
.vop-chip.vop-chip-quiet { background: rgba(255, 255, 255, .07); color: var(--text-dim); }
.vop-chip.source-ready,
.vop-chip.permission-valid,
.vop-chip.drive-sync_confirmed { background: rgba(68, 194, 119, .13); color: #8bdcab; }
.vop-chip.source-rights_pending,
.vop-chip.drive-written { background: rgba(241, 183, 72, .13); color: #e6c680; }
.vop-chip.source-blocked,
.vop-chip.permission-expired,
.vop-chip.permission-revoked { background: rgba(235, 87, 87, .12); color: #efa1a1; }
.vop-chip.vop-chip-platform { background: rgba(96, 165, 250, .13); color: #9dc4fb; }

#view-video-ops .vop-entity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
#view-video-ops .vop-entity-card {
  display: grid;
  align-content: start;
  gap: 11px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--bg-subtle, rgba(255, 255, 255, .02));
  transition: border-color 180ms var(--vop-ease-out);
}
@media (hover: hover) and (pointer: fine) {
  #view-video-ops .vop-entity-card:hover { border-color: var(--border-hover); }
}
#view-video-ops .vop-entity-card h3 { margin: 0; font-size: 15px; }
#view-video-ops .vop-entity-card p { margin: 3px 0 0; color: var(--text-dim); font-size: 12px; }

#view-video-ops .vop-pill-row { display: flex; flex-wrap: wrap; gap: 5px; }
#view-video-ops .vop-perm-list { display: grid; gap: 8px; }
#view-video-ops .vop-perm {
  display: grid;
  gap: 5px;
  padding: 9px 11px;
  border-left: 2px solid var(--border-hover);
  border-radius: 0 8px 8px 0;
  background: var(--surface-2);
}
#view-video-ops .vop-perm .vop-inline-action { justify-self: start; }

.vop-warn-text { color: #e6c680; font-size: 11px; line-height: 1.45; }
.vop-ok-text { color: #8bdcab; font-size: 11px; line-height: 1.45; }

#view-video-ops .vop-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-top: 9px;
}
#view-video-ops .vop-path code,
.vop-path-code {
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 4px 7px;
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 10.5px;
  line-height: 1.5;
}

#view-video-ops .vop-migrate-note {
  margin-bottom: 13px;
  padding: 12px 14px;
  border: 1px solid rgba(241, 183, 72, .24);
  border-radius: 11px;
  background: rgba(241, 183, 72, .08);
  color: #e6c680;
  font-size: 12px;
  line-height: 1.5;
}
#view-video-ops .vop-migrate-note code { font-size: 11px; }

#view-video-ops .vop-line-group { margin-top: 16px; }
#view-video-ops .vop-line-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}
#view-video-ops .vop-line-head h3 {
  margin: 0;
  color: var(--text-dim);
  font-size: 13px;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.vop-destination {
  display: grid;
  gap: 3px;
  padding: 11px 13px;
  border: 1px solid rgba(96, 165, 250, .22);
  border-radius: 10px;
  background: rgba(96, 165, 250, .07);
}
.vop-destination strong { font-size: 14px; }
.vop-destination code { color: #9dc4fb; font-size: 11px; }
.vop-audit h4 {
  width: 100%;
  margin: 0 0 3px;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: .05em;
  text-transform: uppercase;
}
.vop-audit p { width: 100%; margin: 0; color: var(--text-dim); font-size: 11px; line-height: 1.5; }

@media (max-width: 720px) {
  #view-video-ops .vop-entity-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .vop-dialog,
  .vop-toast,
  .vop-progress > i,
  .vop-entity-card,
  .vop-video-card { transform: none; transition-duration: .001ms; }
}

  Ran 1 shell command
Testes verdes e nenhum vazamento novo de CSS (só os 4 legados, que não são minha bagunça). O contrato pede verificação de interface em http://localhost — checando se tenho automação de navegador e como o projeto já faz teste de DOM:

  Ran 1 shell command

Não há automação de navegador nesta sessão — mas o projeto já tem o idioma certo para isso: test-fluxos-dom.js, um smoke headless com stub de DOM. Seguindo a mesma convenção:

● Write(~\Downloads\seller-arthur\test-video-ops-dom.js)
Wrote 118 lines to ..\seller-arthur\test-video-ops-dom.js
// Smoke DOM headless do Estúdio de Vídeos: stub mínimo de document/localStorage e checa
// que init()->render() roda em todas as abas sem estourar, e que a migração do schema 3
// grava a rede de segurança antes de substituir os dados.
// node --check não pega erro de runtime nos construtores de HTML; este pega.
// Uso: node test-video-ops-dom.js
const assert = require('assert');

function fakeEl() {
  const el = {
    style: { setProperty() {} },
… +108 lines

  Ran 1 shell command
visualmente (eu não tenho navegador nesta sessão):

  Ran 1 shell command

Servidor no ar. Rodando toda a bateria de testes do repositório para garantir que não quebrei módulos vizinhos:

  Ran 2 shell commands

F1.1 entregue e commitada. Relatório conforme o contrato:

Arquivos alterados

┌───────────────────────┬────────────────────────────────────┐
│        Arquivo        │              Mudança               │
│ video-ops.js          │ +1904/−487 — schema 4 completo     │
├───────────────────────┼────────────────────────────────────┤
│ test-video-ops.js     │ +157 — 123 asserções (era ~45)     │
├───────────────────────┼────────────────────────────────────┤
│ test-video-ops-dom.js │ novo, 118 linhas — smoke headless  │
├───────────────────────┼────────────────────────────────────┤
│ video-ops.css         │ +123 — estilos das entidades novas │
├───────────────────────┼────────────────────────────────────┤
│ index.html            │ não tocado                         │
└───────────────────────┴────────────────────────────────────┘

O que mudou de fato

Direitos deixaram de ser um booleano. permissionCovers() exige status válido e plataforma listada e prazo vigente. Lista de plataformas vazia não cobre nada — obriga a ser explícito. Uma autorização só de TikTok não libera o Instagram, e há teste para isso.

Um corte, dois destinos independentes. clips → N variants, uma por conta da linha editorial, cada uma com legenda, agenda, aprovação e resultado próprios. Conta = uma plataforma + um @handle.

O movimento que manteve o diff sob controle: resolveVariant() achata fonte+corte+variante+conta na forma que a lógica de aprovação já consumia. approvalIssues, publishingIssues, sensitiveSnapshot, dailyGoal, buildReport e toCsv seguem funcionando sem reescrita — todas as asserções v3 dessas funções passaram sem eu tocar numa linha delas.

Uma única função de invalidação. revalidate() é chamada depois de qualquer alteração em fonte, corte, autorização ou conta, em vez de cada handler reimplementar a regra. O snapshot agora inclui recorte, autorização e estado da fonte.

Duas questões de fundo que os testes expuseram e que eu corrigi:
1. Um snapshot escrito pelo schema 3 nunca poderia bater com o do 4. Sem tratamento, toda aprovação legítima morreria na migração. Agora o registro antigo é validado sob as regras antigas (v3Snapshot) antes de ganhar um snapshot novo — e um registro adulterado continua caindo para pendente.
2. Recalcular sourceKey só a partir das URLs rejeitava fontes que só têm a chave herdada, mandando o estado inteiro para a tela de recuperação.

Rede de segurança: o schema 3 cru é copiado para pp_video_ops_v3_backup antes da primeira gravação do v4 — verificado no teste de DOM, não só no código. Rollback = apagar pp_video_ops_v1, renomear o backup.

Testes executados

node --check video-ops.js OK. Todos os 9 arquivos de teste do repositório passam — rodei a bateria inteira para confirmar que não quebrei módulos vizinhos. Fiz também um teste de mutação (quebrei permissionCovers de propósito) para confirmar que a suíte falha quando deve.

Limitações que ficam

- Não verifiquei a interface em navegador — não tenho automação de navegador nesta sessão. Substituí por test-video-ops-dom.js (init, migração, as 5 abas, sem undefined/NaN na tela) e deixei o site no ar em http://127.0.0.1:8777/index.html para você conferir em desktop e largura móvel. É um python -m http.server em segundo plano; feche a janela ou me avise para derrubar.
- Fila ainda renderiza todos os cards, sem paginação — é a F1.2.
- Sem calendário de 7 dias e sem detecção de conflito — é a F1.3.
- transcripts e metricSnapshots não foram criados (fora do escopo da fatia; metrics segue achatado). Desviei aqui do que eu havia listado na tabela de migração: não criei transcripts: [] vazio porque nada escreve nele ainda.
- Cortes migrados chegam com 0/0 e ficam marcados “sem marcação”. Não bloqueiam o histórico publicado, mas aparecem como pendência. Cortes novos exigem fim > início.
- Os 4 seletores globais .publication-* continuam vazando — são anteriores a mim e o contrato manda não mexer no que funciona. Meus chips novos exigem .vop-chip no seletor e não vazam.
- sync_confirmed continua inalcançável por software, como medi antes: o volume do Drive não expõe estado de sincronização.

Próximo passo

F1.2 (visão consolidada das 10 contas + paginação da fila) ou F1.3 (calendário de 7 dias). Interpretei “parte um” como a primeira fatia recomendada do plano, não a Fase 1 inteira — se você queria as quatro fatias de uma vez, me diga e sigo.

Parando aqui, sem avançar automaticamente.

✻ Cooked for 35m 29s
```

---

## Turno 8 — Usuário

```text
Quero processeguir para fase f1.2, quero pode quer nesse formato de adicionar conta a gente consiga doq colocar qualquer coisa nessa hora eu quero que voce em ajude a fazer uma conexçao real via API com o tik tok e intagram com conexão as contas e fazer um matudo na onde que do nosso site mesmoa  gente consigue fazer uma parte na onde que a gente consiga mexer e definir como a gente vai querer que fica o video no intagram e tik tok, se a gente vai postar storys, reeals, videos, clipes etc.
```

---

## Turno 9 — Assistente

```text
Antes de responder sobre a API, preciso ser direto sobre uma restrição real, e depois validar as especificações nas fontes oficiais — o próprio prompt exige revalidar antes de implementar integração.

Conexão real com TikTok/Instagram não é possível a partir deste site como ele existe hoje. OAuth exige client_secret, e um site 100% client-side não tem onde guardar segredo — qualquer chave no video-ops.js fica visível para quem abrir o DevTools. Isso não é limitação minha: é a Fase 3 do plano que você aprovou, e
O que é possível agora e cobre boa parte do que você pediu: o editor de formato e posicionamento (Reels, Stories, Feed, vídeo TikTok, carrossel) com as especificações certas por destino. Validando as regras atuais nas fontes oficiais:

● Fetch(https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)
Error: context-mode: WebFetch redirected. Call mcp__plugin_context-mode_context-mode__ctx_fetch_and_index(url: "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post", source: "...") to fetch + index the page, then mcp__plugin_context-mode_context-mode__ctx_search(queries: [...]) to query the indexed content — the raw page bytes stay in storage instead of entering your conversation. Or call mcp__plugin_context-mode_context-mode__ctx_execute(language, code) when you want to derive your answer in one round trip (parse, extract, count) without persisting the response. Both have full network access. Retry the same call on a transient DNS error (EAI_AGAIN, ETIMEDOUT, ENETUNREACH).

● Fetch(https://developers.tiktok.com/doc/content-sharing-guidelines/)
Error: context-mode: WebFetch redirected. Call mcp__plugin_context-mode_context-mode__ctx_fetch_and_index(url: "https://developers.tiktok.com/doc/content-sharing-guidelines/", source: "...") to fetch + index the page, then mcp__plugin_context-mode_context-mode__ctx_search(queries: [...]) to query the indexed content — the raw page bytes stay in storage instead of entering your conversation. Or call mcp__plugin_context-mode_context-mode__ctx_execute(language, code) when you want to derive your answer in one round trip (parse, extract, count) without persisting the response. Both have full network access. Retry the same call on a transient DNS error (EAI_AGAIN, ETIMEDOUT, ENETUNREACH).

  Called plugin:context-mode:context-mode 2 times

Pesquisa concluída. Os fatos oficiais mudam o plano de forma importante, então preciso te mostrar antes de codar:

TikTok — a documentação é explícita: "You must not share your API Credentials with any other third-party or embed your client_secret in open source projects". E o mais sério para o seu caso: um app não auditado só consegue postar em SELF_ONLY (privado), todas as contas precisam estar privadas no momento da postagem, e no máximo 5 usuários por 24h. O erro tem nome próprio: unaudited_client_can_only_post_to_private_accounts. Para postar público, o app precisa passar por auditoria da TikTok. Além disso, exige consultar creator_info antes de cada post, a privacidade tem que ser escolhida à mão sem valor padrão, e é proibido sobrepor qualquer logo ou marca d'água.

Instagram — só contas profissionais, e o fluxo é em duas etapas: cria um contêiner com media_type = REELS | STORIES | VIDEO (ou is_carousel_item para carrossel) e depois publica. O detalhe que atinge nossa arquitetura: o video_url precisa estar num servidor público — link do Google Drive não serve.

Ou seja: os formatos que você quer definir (Reels, Stories, Feed, vídeo TikTok, carrossel) eu implemento agora. A conexão real é a Fase 3 e tem dependências externas que não dependem de código.

● User answered Claude's questions:
· Como seguimos com a conexão real das contas, sabendo que ela exige backend + auditoria da TikTok? → F1.2 + formatos agora, conexão depois (Recomendado)

F1.2 + formatos, conexão depois. Preciso dos números reais de cada formato — não vou cravar duração e proporção de memória:

  Called plugin:context-mode:context-mode

Tenho o que dá para afirmar com fonte. Vou separar claramente nossa especificação editorial (9:16, MP4/H.264/AAC) de regra da plataforma (verificada hoje na doc oficial) — e não vou cravar número que a plataforma só informa em tempo de execução, como a duração máxima do TikTok, que vem do creator_info.

Começando pela tabela de formatos:

● Update(~\Downloads\seller-arthur\video-ops.js)
File must be read first

  Read 1 file

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 72 lines
  var DRIVE_STATE_LABEL = { planned: 'Caminho reservado', written: 'Gravado na pasta', sync_confirmed: 'Sincronização confirmada' };
  var PUBLISH_MODE_LABEL = { manual: 'Manual', api: 'Integração oficial' };
  var PLATFORM_LABEL = { tiktok: 'TikTok', instagram: 'Instagram' };
  var CONNECTION_LABEL = { disconnected: 'Não conectada', connected: 'Conectada', expired: 'Conexão expirada' };
  var CONNECTION_STATES = ['disconnected', 'connected', 'expired'];
  var IG_ACCOUNT_TYPE_LABEL = { unknown: 'Não informado', business: 'Empresarial', creator: 'Criador de conteúdo', personal: 'Pessoal (não publica por API)' };

  /* Formatos de publicação por plataforma.
     "nossa especificação" = alvo editorial do projeto: vertical 9:16, MP4 H.264/AAC.
     "regra da plataforma" = verificado na documentação oficial em 2026-07-31 (TikTok
     Content Posting API e Content Sharing Guidelines; Meta Instagram Content Publishing).
     O que a plataforma só informa em tempo de execução — como a duração máxima do TikTok,
     que vem de creator_info.max_video_post_duration_sec — NÃO é cravado aqui.
     ponytail: revalidar as fontes antes de ligar qualquer integração real (Fase 3). */
  var PLACEMENTS = {
    tiktok_video: {
      platform: 'tiktok', label: 'Vídeo TikTok', apiType: 'VIDEO', aspect: '9:16', container: 'MP4 (H.264/AAC)',
      rules: [
        'A duração máxima não é fixa: vem de creator_info (max_video_post_duration_sec) na hora de publicar.',
        'Proibido sobrepor logo, marca d\'água ou texto promocional — inclusive de outra rede.',
        'Cliente sem auditoria publica só em SELF_ONLY, e a conta preci
    },
    tiktok_photo: {
      platform: 'tiktok', label: 'Foto TikTok', apiType: 'PHOTO', aspect: '9:16', container: 'JPEG',
      rules: ['Duet e Stitch não se aplicam a post de foto.', 'Mesma proibição de marca d\'água do vídeo.']
    },
    ig_reels: {
      platform: 'instagram', label: 'Reels', apiType: 'REELS', aspect: '9:16', container: 'MP4 (H.264/AAC)',
      rules: ['Contêiner criado com media_type=REELS.', 'O video_url precisa estar num servidor público — link do Drive não serve.', 'alt_text não é aceito em Reels.']
    },
    ig_stories: {
      platform: 'instagram', label: 'Stories', apiType: 'STORIES', aspect: '9:16', container: 'MP4 (H.264/AAC)',
      rules: ['Contêiner criado com media_type=STORIES.', 'O video_url precisa estar num servidor público.', 'alt_text não é aceito em Stories.']
    },
    ig_feed_video: {
      platform: 'instagram', label: 'Vídeo no feed', apiType: 'VIDEO', aspect: '4:5 ou 1:1', container: 'MP4 (H.264/AAC)',
      rules: ['Contêiner criado com media_type=VIDEO.', 'O video_url precisa estar num servidor público.']
    },
    ig_carousel: {
      platform: 'instagram', label: 'Carrossel', apiType: 'CAROUSEL', aspect: '1:1 (padrão)', container: 'JPEG e/ou MP4',
      rules: ['No máximo 10 itens.', 'Todas as imagens são cortadas pela proporção da primeira; o padrão é 1:1.', 'O único formato de imagem aceito é JPEG.']
    }
  };
  var PLACEMENT_ORDER = ['tiktok_video', 'tiktok_photo', 'ig_reels', 'ig_stories', 'ig_feed_video', 'ig_carousel'];
  var DEFAULT_PLACEMENT = { tiktok: 'tiktok_video', instagram: 'ig_reels' };
  /* Limites por plataforma, não por formato. */
  var PLATFORM_RULES = {
    tiktok: [
      '6 requisições por minuto por access_token.',
      'Cliente sem auditoria: no máximo 5 usuários publicando em 24 h.',
      'Obrigatório consultar creator_info antes de cada post; a privacidade é escolhida à mão, sem valor padrão.'
    ],
    instagram: [
      'Somente contas profissionais (empresarial ou criador de conteúdo).',
      'Até 100 publicações por conta em 24 h; GET /<IG_ID>/content_publishing_limit mostra o consumo.',
      'A documentação oficial se contradiz: a seção de carrossel fala em 50 por 24 h. Confirmar na conta antes de escalar o volume.'
    ]
  };
  function placementsFor(platform) {
    var key = platformSlug(platform);
    return PLACEMENT_ORDER.filter(function (id) { return PLACEMENTS[id].platform === key; });
  }
  function placementLabel(id) { return PLACEMENTS[id] ? PLACEMENTS[id].label : (id || 'sem formato'); }
  function defaultPlacement(platform) {
    var key = platformSlug(platform);
    return DEFAULT_PLACEMENT[key] || placementsFor(key)[0] || '';
  }
  /* O formato precisa existir e pertencer à plataforma da conta de destino. */
  function placementIssues(placement, platform) {
    if (!placement) return ['formato de publicação'];
    if (!PLACEMENTS[placement]) return ['formato de publicação válido'];
    if (platformSlug(platform) && PLACEMENTS[placement].platform !== platformSlug(platform)) return ['formato compatível com a plataforma da conta'];
    return [];
  }

  var KINDS = ['viral', 'recent', 'own'];
  var APPROVALS = ['pending', 'approved', 'changes', 'rejected'];
  var PUBLICATIONS = ['draft', 'scheduled', 'published', 'error'];

Agora ligando o formato ao modelo. Mudança de formato tem que derrubar aprovação — trocar Reels por Stories muda o produto:

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 1 line
      sourceStatus: source ? source.status : '',
      kind: clip ? clip.kind : 'viral',
      platform: platform,
      placement: variant.placement || '',
      rightsConfirmed: permissionCovers(permission, platform, day),
      nicheConfirmed: !!variant.nicheConfirmed,
      title: variant.title,

● Update(~\Downloads\seller-arthur\video-ops.js)
      video.caption, video.hashtags, video.scheduledAt, !!video.rightsConfirmed, !!video.nicheConfirmed,
      video.clip ? [num(video.clip.inSec), num(video.clip.outSec)] : null,
      video.permission ? video.permission.id : '',
      video.sourceStatus || ''
      video.sourceStatus || '',
      video.placement || ''
    ]);
  }
  function dailyGoal(videos, accountId, day) {

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 2 lines
    if (!String(video.scheduledAt || '').trim()) issues.push('data e horário');
    if (!String(video.platform || '').trim()) issues.push('plataforma');
    else if (account && Array.isArray(account.platforms) && account.platforms.indexOf(video.platform) < 0) issues.push('plataforma vinculada à conta');
    /* Só cobra formato de quem tem o campo: registros achatados do schema 3 não têm. */
    if ('placement' in video) placementIssues(video.placement, video.platform).forEach(function (issue) { issues.push(issue); });
    return issues;
  }
  function publishingIssues(video, account, options) {

● Update(~\Downloads\seller-arthur\video-ops.js)
Added 8 lines
        approval: APPROVALS.indexOf(rawVariant.approval) >= 0 ? rawVari
Added 1 line
        approval: APPROVALS.indexOf(raw.approval) >= 0 ? raw.approval : 'pending',
        publication: PUBLICATIONS.indexOf(raw.publication) >= 0 ? raw.publication : 'draft',
        approvedSnapshot: cleanText(raw.approvedSnapshot, 8000), driveVersion: 1,
        placement: defaultPlacement(platform),
        createdAt: source.createdAt, updatedAt: source.updatedAt, publishedAt: cleanText(raw.publishedAt, 40)
      });
    });

● Update(~\Downloads\seller-arthur\video-ops.js)
Error: claude-sonnet-5[1m] is temporarily unavailable, so auto mode cannot determine the safety of Edit right now. Wait briefly and then try this action again. If it keeps failing, continue with other tasks that don't require this action and come back to it later. Note: reading files, searching code, and other read-only operations do not require the classifier and can still be used.
You've hit your org's monthly spend limit · run /usage-credits to ask your admin for a higher limit
/usage-credits to request more usage from your admin.
```
