# log — histórico cronológico

Mais recente no topo. Uma linha por mudança que outra pessoa (ou outro agente)
precisaria saber. Formato: `AAAA-MM-DD — camada — o que mudou e por quê`.

Não registrar: trivialidade, log de execução, histórico de conversa, lista de
arquivos alterados. Se ninguém vai reler, não entra.

---

- **2026-09-14 — execução — `PLANO-descricao-hashtags.md` criado; CP1 entregue no vault
  `Cortes`.** O pedido era "sistema de análise de descrição e hashtags que funcionam melhor
  para nossa conta". Com **zero clips publicados**, um analisador só poderia devolver conselho
  genérico com aparência de dado próprio — a superstição operacional que o `video-ops/REGISTROS.md`
  proíbe. O plano inverte a ordem para **gerar → registrar → ler**, que entrega valor desde já e
  vira analisador sozinho quando o dado chegar. **CP1 (feito):** `_modelo-clip.md` do vault
  ganhou `descricao_padrao`, `hashtags_set`, `variavel_testada`, `exp` e uma seção **Hipótese**
  a escrever ANTES de publicar; o `INDEX.md` de lá ganhou as tabelas de padrões de descrição e
  de conjuntos de hashtag. **A decisão de desenho que faz o sistema funcionar:** o clip guarda o
  **nome** do padrão e do conjunto, nunca o texto — vinte descrições diferentes em vinte posts
  não se agrupam, e conjunto já usado não pode ter o conteúdo alterado depois (cria SET-C). CP2
  (declarar os conjuntos) é decisão do usuário; CP3 (leitura, Python stdlib, caminho por
  argumento) e CP4 (gerador, único que toca `video-ops.js`) estão em `02-Execution/PENDENCIAS.md`.
- **2026-09-14 — decisão do usuário — o Estúdio não é mais produto para vender; virou
  instrumento de uso pessoal do dono.** O objetivo passou a ser aprender a editar e
  registrar o que funciona ao publicar, usando o site de cortes como base. Consequência
  direta: **as duas provas de `03-Decisions/LANCAMENTO-decisoes.md` fecharam.** A **Prova A**
  (yt-dlp de IP de datacenter) **perdeu o objeto** — o motor não vai para a nuvem, o yt-dlp
  roda na máquina do dono em IP residencial, que é a condição já medida em 2026-08-26; o
  Passo 3 do `PASSO-A-PASSO.md` não será executado. A **Prova B** ficou na **postura (i),
  só análise online**, escolhida por ser a única que **não muda uma linha de código** (é o
  que o sistema já faz) e porque o único "contra" dela — obrigar o usuário a instalar o
  Estúdio — sumiu quando o único usuário virou o dono, que já o tem instalado; (ii) e (iii)
  foram apagadas do arquivo conforme a instrução dele. "Acessar o Estúdio pela internet"
  saiu de *trabalho futuro* para **cancelado** em `02-Execution/PENDENCIAS.md`, e a receita
  de nuvem (Fly.io/Turnstile) virou registro histórico. **Limite que precisa ficar escrito:**
  a (i) decide a postura da ferramenta, **não** a autorização para publicar — o portão de
  declaração por URL do `CLAUDE.md` e as fontes autorizadas do `video-ops/PILOTO.md` §6
  valem igual. Mudar de objetivo apaga infraestrutura, não apaga obrigação jurídica.
- **2026-09-14 — execução — correção: os SEIS planos do Estúdio já estavam entregues.** A
  varredura da manhã registrou `PLANO-1-tags-cor-remotion.md` como "a fazer" **sem conferir o
  código** — o erro que o próprio LINT existe para pegar ("pendência morta"). O plano estava
  fechado desde 2026-09-04: `worker.COR_BSF`, a guarda `videoCodec == "h264"`,
  `worker.finish_video`, `serve._finish_video` e os checks `16n`–`16x`. O mesmo vale para
  qualidade p/ TikTok (2026-09-03), destaque no título (2026-09-01) e tempo por palavra
  (2026-08-28/31) — cada um com fechamento datado em `01-Wiki/archive/HISTORICO-estudio-video.md`.
  **A camada 02-Execution não tinha nenhum trabalho ativo.** Cada plano ganhou cabeçalho de
  estado datado no topo, para que a próxima leitura não precise refazer esta conferência.
  **Lição:** conferir plano contra o código é o mesmo trabalho que conferir nota contra o
  código — eu fiz para `plans/001-008` (módulos removidos) e esqueci dos `PLANO-*` do Estúdio.
- **2026-09-14 — execução** — A troca da legenda por transcrição LOCAL (Whisper) saiu de dentro
  do plano de tempo por palavra e virou item próprio em `PENDENCIAS.md`, "Decisão aberta":
  não rodou, não foi medido, e implica dependência nova num projeto stdlib/Vanilla.
- **2026-09-14 — decisão do usuário — operação de cortes tem um dono só: o vault `Cortes`.**
  `docs/01-Wiki/Licoes.md` e `docs/_modelo-clip.md` eram **byte-a-byte iguais** às notas de lá
  (provado com `diff` ignorando fim de linha) e saíram do repositório. O que era exclusivo daqui
  — as seções *Objetivo* e *Fluxo* — foi consolidado no `INDEX.md` daquele vault, com a origem
  anotada. `01-Wiki/operacao-cortes/INDEX.md` virou ponteiro e guarda o vínculo origem→destino.
  `docs/_templates/` **ficou**: tem hipótese, `views_24h`/`views_7d` e conclusão, campos que o
  modelo do vault `Cortes` não tem — duplicata exata some, conteúdo exclusivo não.
- **2026-09-14 — decisão do usuário — `cloud/` aposentada.** A Fase 1 na nuvem não volta. A
  regra `.claude/rules/lancamento-cloud.md` deixou de carregar por `cloud/**` e, nessa parte,
  virou registro do que existiu; só `web/` segue ativo. O código continua no git.
- **2026-09-14 — decisão do usuário — `PROCESSO-FBA-ENVIOS.md` → `01-Wiki/archive/`.** Spec de
  2026-06-29 nunca implementada, de um domínio que saiu do site; o único código que a cita
  (`arquivo/fba-shipments.js`) está desligado. Vai como histórico, não como plano.
- **2026-09-14 — decisão do usuário — o vault vazio `Dootu/` fica.** Registrado no `INDEX.md`
  como pendência conhecida: são duas configurações de vault no mesmo repositório.
- **2026-09-14 — base** — LINT completo + organização. `DESIGN.md` (raiz) → `01-Wiki/` e
  `PROMPT-CLAUDE-VIDEO-OPS-V2.md` → `00-Sources/`, por `git mv`; ninguém em código os lê.
  `CONTINUAR_PROJETO.md`, `PASSO-A-PASSO.md`, `README.md` e `shooting-range/` saíram de "não
  classificado" para "fora das camadas", **cada um com o arquivo que o consome citado** — o
  agente `video-growth-loop` e a regra `lancamento-cloud` são fiação real, não hábito.
  O `INDEX.md` ganhou uma seção de **exclusões** (clone de referência, dependências,
  `README` de pasta de código): cobertura sem exclusão declarada é cobertura que mente.
- **2026-09-14 — base** — Cinco caminhos do `CLAUDE.md` ficaram para trás na migração de
  2026-09-08 e foram repontados (`docs/archive/*` → `docs/01-Wiki/archive/*`,
  `docs/PLANO-3-*` → `docs/02-Execution/PLANO-3-*`). Os dois links quebrados de
  `01-Wiki/operacao-cortes/INDEX.md` também. O `README.md` tinha **54 bytes de lixo UTF-16**
  colados no fim (append com encoding errado) — removidos, nada de conteúdo saiu.
- **2026-09-14 — execução** — Os planos `001`–`008` de `02-Execution/plans/` deixaram de se
  apresentar como TODO: sete miram Precificação e Faturador, removidos em 2026-08-17 e
  2026-09-08, e receberam `OBSOLETE`/`SUPERSEDED` com o motivo. **Só o `004` (CSP) sobrou** —
  conferido no `index.html`: não há CSP. Nenhum plano foi apagado.
- **2026-09-14 — Wiki/Decisions** — Estado atual e Pendências passaram a dizer, por escrito,
  que a **versão online e a integração TikTok não existem**: planejamento, não entrega. O
  portão (`03-Decisions/LANCAMENTO-decisoes.md`) segue com Prova A meia respondida e Prova B
  em aberto, agora visível na lista de pendências em vez de só dentro do arquivo de decisões.
- **2026-09-14 — achado (resolvido no mesmo dia, ver acima)** — A pasta `cloud/` (Fase 1 do
  lançamento: `Dockerfile`, `probe_server.py`, `test_probe_server.py`, 663 linhas) saiu da árvore
  no commit `9d726ef "melhora edit"`, junto de mudanças sem relação — remoção que passou
  despercebida porque o commit misturou vaults do Obsidian, `appearance.js` e binários de FFmpeg.
  O usuário decidiu **aposentar**, não restaurar.
- **2026-09-14 — Wiki/regras do Estúdio** — Navegação reduzida a Central (inicial), Meus projetos e YouTube por pedido do usuário; etapas Vídeo/Cortes/Revisão e seus atalhos desativados, preservando os dados salvos e a edição dos trechos do YouTube.

- **2026-09-08 — migração** — 23 arquivos movidos para dentro das camadas com
  `git mv` (conteúdo não editado no movimento). Referências em **forma de
  caminho** corrigidas em `CLAUDE.md`, nos 5 `.claude/rules/*`, em
  `web/legal.html`, `CONTINUAR_PROJETO.md`, `PASSO-A-PASSO.md` e nas
  auto-referências de `plans/`. Menção a nome nu de arquivo em prosa **não** foi
  tocada — o nome não mudou, só a pasta.
- **2026-09-08 — migração** — **Ficaram fora das camadas por acoplamento de
  código**, não por esquecimento: `docs/night-reports/` (o `night-agent.ps1`
  escreve lá, linha 30) e `docs/video-ops/` (`video-worker/{worker,ytclip,make_fixtures}.py`
  citam o contrato, e `.claude/{agents,commands}/video-growth-loop.md` mandam
  gravar no `PROGRESSO.md`). Vale a mesma regra que mantém `.claude/rules/` fora
  da KB: **doc que um programa lê fica junto do programa.** Mover exigiria editar
  `.ps1`, `.py` e config de agente.
- **2026-09-08 — migração** — Caminhos internos de `01-Wiki/archive/HISTORICO-*`
  **não** foram reescritos: são registro datado do que aconteceu, não ponteiro
  vivo. Custo aceito e conhecido: alguns citam o local antigo. Nenhum é link
  markdown, então o LINT de links não acusa.
- **2026-09-08 — base** — Base de conhecimento estruturada em quatro camadas
  (`00-Sources` / `01-Wiki` / `02-Execution` / `03-Decisions`), com o contrato de
  escrita de cada uma no `README.md` da própria pasta. Motivo: o projeto já tinha
  as quatro camadas de fato — espalhadas por `docs/`, `plans/` e a raiz — mas sem
  nome, sem regra de qual vence e sem índice (o `INDEX.md` anterior cobria 4 de
  83 arquivos e ainda se chamava "Extensão Clips").
- **2026-09-08 — base** — `AGENTS.md` da raiz passou a ser o protocolo da KB. O
  conteúdo anterior era cópia desatualizada do `CLAUDE.md` (19 KB, declarava-se
  "retrato ANTIGO" na primeira linha e descrevia como ativos módulos já
  removidos) — e era justamente o primeiro arquivo que o Codex lê. Verificado
  antes de substituir: o conjunto BP-* do `CLAUDE.md` (001–014) contém o do
  `AGENTS.md` (001–011, 013); nada de único foi perdido. Versão antiga no git.
- **2026-09-08 — base** — Fluxos INGEST / QUERY / LINT definidos em
  [`01-Wiki/fluxos-kb.md`](01-Wiki/fluxos-kb.md).
- **2026-09-14 — estúdio** — Tela **Resultados dos cortes** (`video-results.js`, chave
  `pp_video_results_v1`), quarta tela do Estúdio. Registra à mão o que já foi publicado e
  mede o que rendeu. O que vale guardar não é a tela, são as três regras que a governam e
  que são o jeito normal de mentir com número: **ausência não é zero** (métrica em branco é
  `null`, nunca 0 — senão a mediana de quem não preencheu um campo despenca);
  **medições diferentes nunca se somam** (as contagens das plataformas são acumuladas, então
  24 h + 7 dias contaria as mesmas visualizações duas vezes — `medicaoDaJanela` escolhe UMA
  por publicação); e **padrão é associação, não causa** (sai com n, cortes que sustentam,
  exemplos, as duas medianas e rótulo). A taxa de engajamento usa só os componentes medidos
  e carrega uma assinatura — taxas de assinaturas diferentes não se comparam, e comparar
  seria invisível sem isso. Nenhuma nota única de "potencial viral", pela mesma razão pela
  qual a nota do hub não aparece no card. Autorizado pelo usuário como área de ANÁLISE; não
  reabre o pipeline de publicação apagado em 2026-08-21.
