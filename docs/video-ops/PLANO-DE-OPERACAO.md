# Plano de operação — Estúdio de Vídeos

**Escrito em:** 2026-08-04
**Para quê:** sair da fase de construir e entrar na fase de operar, sem depender de nada que
ainda não existe.

Três partes, que servem a momentos diferentes:

1. **Operar amanhã de manhã** — o que já funciona, sem backend, sem conta em lugar nenhum.
2. **Publicar sozinho** — o que falta de verdade, e a pergunta que decide a arquitetura.
3. **Supabase** — a conta que importa, com fórmula em vez de número decorado.

---

## 1. Estado verificado hoje

Rodado em 2026-08-04, nesta máquina:

```
node --check video-ops.js        → OK
node test-video-ops.js           → ok (fluxo, regras, relatórios e ponte)
node test-video-ops-dom.js       → ok (init, migração v3→v4, abas, marcação,
                                       primeiro contato, lista de cortes, promoção)
```

> **Correção da análise anterior:** ela diz que "a verificação DOM está falhando no estado
> atual". Isso era verdade **durante** as edições daquele momento; as duas suítes passam
> agora. Não há teste a estabilizar antes de seguir.

### O que existe e está provado

| Capacidade | Onde | Prova |
|---|---|---|
| Escolher vídeo local, só na sessão | `video-ops.js` · painel de intake | `test-video-ops-dom.js` |
| Marcar **vários** cortes no mesmo vídeo | lista `INTAKE.cuts` (memória) | `test-video-ops-dom.js` |
| Gerar o MP4 do corte | botão **Copiar comando** → FFmpeg do repo | executado à mão: 15,00 s · 1920×1080 · H.264/AAC |
| Cadastro mínimo → fila | **Preparar para publicação (opcional)** | `test-video-ops-dom.js` |
| Corte vertical 9:16 com blur/crop | `video-worker/worker.py` | `video-worker/test_worker.py` (o `test-video-ops-e2e.js` foi apagado em 2026-08-21) |
| Aprovação amarrada ao SHA-256 | `sensitiveSnapshot` + `artifactSignature` | `test-video-ops.js` + E2E |
| Direitos por criador, prazo e plataforma | `permissionCovers` | `test-video-ops.js` |

### O que **não** existe — está escrito no próprio código

- `video-ops.js:6` — *"Publicação real continua sendo registro manual."*
- `docs/video-ops/CONTRATO_TRABALHADOR.md:191` — *"**O trabalhador nunca publica.**"*
- `video-worker/worker.py` — **zero** chamadas de rede (`grep -cE "requests|urllib|http.client|socket"` = 0).
- `index.html:3672-3677` — os 3 `<script>` do Supabase estão **comentados**, com a receita de
  reativação inline. O backend está pausado de propósito.
- `supabase/migrations/` — existem 3 migrações (`profiles`, `projects`, `prompts`, `products`,
  `amazon_accounts`, `amazon_credentials`, `publish_jobs`). **Nenhuma tabela de vídeo.**

---

## 2. Comece a operar amanhã (sem backend)

### O 9:16 já é o padrão (corrigido em 12/08/2026)

Este trecho pedia, até 11/08/2026, um comando vertical à mão porque o botão só sabia gerar
`scale=-2:1080` (1920×1080 horizontal, inútil para Reels e TikTok). **Isso já não é
verdade** — o código venceu a documentação (BP-007). Hoje:

- na revisão da variante há **dois** botões: `Baixar horizontal` (secundário) e
  **`Baixar 9:16`** (primário, `blur` ou `crop` conforme a variante) — `video-ops.js:2787-2790`;
- na lista de cortes do primeiro contato, **⬇ Salvar** já sai em `blur` 9:16 sem escolha a
  fazer — `video-ops.js:3864`;
- o nome do arquivo diz qual é qual (`-9x16-blur` ou `-16x9`), então dá para conferir na
  pasta de Downloads antes de postar — `video-ops.js:2021-2028`;
- os filtros do navegador são espelho de `build_filter()` do `worker.py`, então o comando
  manual de emergência entrega o mesmo vídeo — `video-ops.js:51-63`.

Não há mais nada a corrigir antes da primeira postagem neste ponto. Quem quiser o caminho
com hash e aprovação amarrada ao arquivo continua tendo a opção de **passar pelo worker**
(job.json → `_jobs/pending` → importar o `result.json`), que é o que o E2E prova ponta a
ponta.

### Rotina diária

1. `.\estudio.ps1` na pasta do projeto — sobe o renderizador e já abre a página nele.
   *(equivale a `py -3.12 video-worker\serve.py` + abrir `http://127.0.0.1:8765/index.html`)*
   *(o Estúdio precisa de `http://`; em `file://` várias coisas não funcionam)*
   *(NÃO use `python -m http.server`: ele só serve arquivo e responde 501 a POST, então o
   botão **Baixar** da revisão fica sem renderizador e nada baixa)*
2. **Estúdio de Vídeos → Visão geral →** escolher a live/podcast já baixado.
3. Marcar **todos** os cortes daquele vídeo de uma vez (Adicionar corte, repetir).
4. Em cada corte: **⬇ Salvar** → o `serve.py` renderiza em 9:16 e o MP4 cai em Downloads.
   *(se o renderizador não responder, o Estúdio copia o comando do FFmpeg e diz o motivo —
   aí é colar no PowerShell dentro da pasta do projeto, como antes)*
5. Revisar os MP4s. Descartar os ruins **antes** de cadastrar qualquer coisa.
6. Para os que sobrarem: **Preparar para publicação (opcional)** → criador, assunto, conta.
7. Postar à mão no app. Colar o link real de volta na variante.
8. 24-48 h depois: preencher as métricas.

### Rotina semanal

- **Relatórios → Exportar CSV** (histórico fora do navegador).
- **Relatórios → Backup JSON** — o `localStorage` some se limparem o navegador. **Este é o
  único backup que existe hoje.**
- Conferir "Próxima melhoria" e os erros da semana.

### Regra desta fase

O rascunho de cortes vive **só na sessão**. Recarregar a página perde a lista.
Marque, gere os arquivos e **só então** recarregue ou troque de vídeo.

---

## 3. O buraco real: publicar sozinho

Tudo acima depende de você estar na frente do computador na hora de postar. É isso, e só
isso, que a automação resolve.

### Decisão de plataforma

| Plataforma | Caminho | Veredito |
|---|---|---|
| **Instagram Reels** | Conta profissional + OAuth Meta + Content Publishing API | **Primeira integração.** Único caminho oficial que aceita ferramenta própria sem drama. |
| **Facebook Reels** | Mesma infraestrutura Meta | Segunda. Reaproveita a maior parte do trabalho. |
| **YouTube Shorts** | API oficial, aceita agendamento | Viável. Projeto não auditado publica **só como privado** — inútil para alcance até passar na auditoria. |
| **TikTok** | Content Posting API | **Manter assistido.** A política atual **rejeita** como caso de auditoria "ferramenta interna para contas próprias/da equipe". Sem auditoria, todo post sai privado. |

**Consequência prática:** metade da sua operação (as 5 contas TikTok) continua manual por
tempo indeterminado. O ganho da automação é real, mas parcial. Planeje com isso na mesa.

### ⚡ A pergunta que decide a arquitetura inteira

**A API do Instagram aceita receber os bytes do vídeo direto, ou exige uma URL pública que a
Meta vai buscar?**

| Se… | Então a arquitetura é… | Custo |
|---|---|---|
| **Upload direto (resumable) funciona** | Script local + Agendador do Windows. O projeto **já usa** esse padrão nos radares (`radar-ecommerce.ps1`, `radar-ia.ps1`). Sem Supabase, sem storage, sem egress. | **R$ 0** |
| **Só `video_url` público** | Precisa hospedar o MP4 num lugar público → Supabase Storage (ou similar) → a conta de egress da §4 passa a valer. | ver §4 |

**Faça este spike antes de escrever qualquer linha de backend.** Meio dia: criar uma conta
profissional de teste, um app Meta em modo de desenvolvimento, e tentar publicar um Reel de
15 s pelos dois caminhos. O resultado economiza semanas.

Enquanto essa resposta não existir, **não abra conta paga em lugar nenhum.**

---

## 4. Supabase: a conta que importa

Os números do plano gratuito citados na análise (500 MB banco · 1 GB storage · 50 MB por
arquivo · 5 GB de egress · 500 mil chamadas de Edge Function · pausa após 7 dias parado)
**precisam ser confirmados em `supabase.com/pricing` na hora de decidir** — limite de plano
gratuito muda sem aviso. O que não muda é a conta:

```
publicações/mês  =  contas × vídeos/dia × 30
egress/mês       =  publicações/mês × tamanho médio do arquivo × (1 + retentativas)
```

Com Reels de 15-30 s em 1080p H.264 — que é o que este projeto produz — o arquivo fica entre
**5 e 15 MB**. Usando 10 MB:

| Cenário | Publicações/mês | Egress |
|---|---|---|
| 1 conta piloto × 3/dia | 90 | ~0,9 GB |
| 3 contas × 3/dia | 270 | ~2,7 GB |
| 5 contas × 3/dia | 450 | ~4,5 GB ← **teto do grátis** |
| 10 contas × 3/dia | 900 | ~9 GB |

**Regra de decisão:** o grátis cobre até ~4 contas publicando 3× por dia. Além disso, ou paga,
ou não usa storage (ver o spike de upload direto, §3).

### Correções à análise anterior

- **O limite de 50 MB por arquivo não é problema aqui.** Um corte de 30 s em 1080p a 2,4 Mbps
  dá ~9 MB. O corte real gerado hoje: 15 s = 4,5 MB. Sobra folga de 5×.
- **A pausa por inatividade não é problema** se você publica todo dia — o próprio cron mantém
  o projeto ativo. Vira problema se a operação parar por uma semana.
- **Renderizar na Edge Function está fora de cogitação** (256 MB de RAM, ~2 s de CPU por
  requisição). O corte continua local. Isso não é limitação do plano grátis, é da arquitetura
  serverless.

### O que resolve e o que não resolve

**Resolve:** fila e agenda sobrevivem ao navegador fechado · tokens protegidos no Vault ·
estado compartilhado entre máquinas · histórico durável (hoje o único backup é o JSON manual).

**Não resolve:** não baixa vídeo do TikTok/Instagram · não dispensa a aprovação das
plataformas · não acelera corte nem render · não resolve o TikTok.

---

## 5. Fases, com "pronto quando"

Cada fase só começa quando a anterior cumpriu o critério. Nenhuma fase remove o modo manual —
ele é a rede de segurança.

### Fase 0 — Tornar o caminho rápido postável *(meia hora)*
Botão de corte oferece a versão **9:16** além da horizontal.
**Pronto quando:** um corte gerado pelo botão abre no app do Instagram sem tarja e sem crop
automático.

### Fase 1 — Spike do Instagram *(meio dia, sem código de produção)*
Conta profissional de teste + app Meta em desenvolvimento. Publicar um Reel de 15 s pela API,
pelos dois caminhos (upload direto e `video_url`).
**Pronto quando:** você souber, por escrito, qual dos dois funciona — e o Reel estiver no
perfil de teste.

### Fase 2 — Fila persistente *(o desenho depende da Fase 1)*
Uma tabela de agendamento e um executor. **Local (Agendador do Windows) se o upload direto
funcionar; Supabase se exigir URL pública.**
**Pronto quando:** um vídeo aprovado às 14h é publicado às 18h com o computador ocioso, e o
link real volta para o Estúdio sozinho.

### Fase 3 — Segunda conta e retentativa
Duas contas Instagram na mesma fila, com retentativa automática e registro de erro.
**Pronto quando:** derrubar a rede no horário agendado resulta em erro registrado + nova
tentativa bem-sucedida, **sem post duplicado**.

### Fase 4 — Facebook Reels
Reaproveita a infraestrutura Meta.
**Pronto quando:** o mesmo corte publica nas duas redes a partir de uma aprovação só.

### Fase 5 — Reavaliar YouTube e TikTok
Só depois que o Instagram estiver rodando há **30 dias sem intervenção manual**.

---

## 6. Regras invioláveis (todas as fases)

1. **Token nunca no navegador.** Nem em `supabase-config.js`, nem em `localStorage`, nem em
   variável de JS. Só em env de Edge Function / Vault — ou, no caminho local, em variável de
   ambiente da máquina. Mesma regra que já vale para a SP-API (`AGENTS.md`).
2. **Nada publica sem aprovação humana.** A automação executa uma decisão já tomada; não toma
   a decisão. `approval === 'approved'` continua sendo pré-requisito.
3. **Direito não se inventa.** Sem autorização válida cobrindo aquela plataforma naquela data,
   a variante não aprova. Vale igual com backend.
4. **O hash manda.** Render novo = aprovação nova. Não relaxar isso para "agilizar".
5. **O modo manual nunca é removido.** É o que salva quando a API muda ou a conta é limitada.

---

## 7. Se o backend voltar, atualize a documentação junto

`AGENTS.md` e `CLAUDE.md` dizem hoje, em vários pontos, que **o backend está PAUSADO**.
Descomentar os 3 `<script>` do `index.html` sem atualizar esses textos cria exatamente o
problema da **BP-007**: documentação mentindo sobre o código, e alguém removendo como "morto"
algo que está vivo.

Ao reativar, na mesma tarefa:
- `AGENTS.md` / `CLAUDE.md` — seção de arquitetura e a nota de performance sobre os scripts.
- `docs/video-ops/PROGRESSO.md` — registrar a fase.
- Nova migração em `supabase/migrations/` — as tabelas de vídeo **não existem** ainda.
- `docs/video-ops/CONTRATO_TRABALHADOR.md:191` — se um dia algo publicar, aquela linha muda.

---

## 8. Riscos e pontos de parada

| Risco | Sinal | O que fazer |
|---|---|---|
| Meta rejeita o app | App Review negado | Parar a Fase 2. Voltar ao manual. Não há plano B rápido. |
| Conta limitada por volume | Posts sumindo, alcance zerado | Reduzir cadência **antes** de investigar código. |
| TikTok nunca libera | Auditoria negada | Aceitar 5 contas manuais como custo fixo da operação. |
| `localStorage` estourar | Toast "Não foi possível salvar" | Exportar backup e podar. Já existe poda de log (`LOG_LIMIT`). |
| Perder o histórico | Navegador limpo sem backup | **Backup JSON semanal é obrigatório enquanto não houver banco.** |
| Fonte em AV1 4K | Corte lento, PC travando | Converter o original uma vez para 1080p antes de trabalhar nele. |

---

## 9. Comandos de verificação

```bash
node --check video-ops.js
node test-video-ops.js
node test-video-ops-dom.js
# node test-video-ops-e2e.js        APAGADO em 2026-08-21 junto com o pipeline de posts;
#                                   o lado do worker segue coberto por test_worker.py
py -3.12 video-worker/test_worker.py
```

Estilo (os dois devem retornar 0):

```powershell
Select-String -Path video-ops.css -Pattern "transition: all" | Measure-Object -Line
Select-String -Path video-ops.css -Pattern "ease-in\b"       | Measure-Object -Line
```

---

## 10. A próxima coisa a fazer

**Fase 0 e Fase 1, nesta ordem, nesta semana.**

A Fase 0 porque hoje o caminho rápido produz arquivo horizontal que você não pode postar — é
o único defeito que impede a operação de começar já.

A Fase 1 porque a resposta dela decide se o resto custa R$ 0 ou US$ 25/mês, e decide se o
Supabase entra ou não. Escrever backend antes dessa resposta é escrever backend no escuro.

**Não abra conta paga antes da Fase 1 terminar.**
