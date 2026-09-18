# Lançamento — Fase 0: as duas provas

**PORTÃO FECHADO EM 2026-09-14. As duas provas estão respondidas** — ver a seção
*Decisão*, no fim do arquivo. A resposta veio junto de uma mudança de objetivo do
projeto: **o Estúdio deixou de ser produto para vender e passou a ser instrumento
de uso pessoal do dono.** Um usuário, uma máquina, nada público. É isso que responde
a Prova A e que escolhe a postura da Prova B.

O histórico das duas provas fica abaixo, tal como foi levantado. Reabrir qualquer
uma delas exige que o objetivo mude de novo, ou um número novo.

---

## Prova A — o yt-dlp funciona a partir de um IP de datacenter?

**Estado: RESPONDIDA em 2026-09-14 — a pergunta deixou de existir.** O motor não
vai para a nuvem: o yt-dlp roda na máquina do dono, em IP residencial, que é
exatamente a linha de base já medida abaixo. Nenhum IP de datacenter entra no
caminho, então não há o que medir. O passo manual de ~20 min do `PASSO-A-PASSO.md`
(Passo 3) **não será executado**.

### Linha de base local (medida em 2026-08-26, nesta máquina)

| | |
|---|---|
| Vídeo | `2jeNuXF6bI8` — *Por Que Sua Empresa NÃO CRESCE… (TALLIS GOMES) \| JOTA JOTA PODCAST #252* |
| Canal / duração | Joel Jota · 7.639 s (2h07) |
| `ytclip.probe()` | **7,5 s** · 331 KB de JSON · **zero byte de mídia** |
| `ytclip.candidates()` | **0,094 s** (função pura) · 12 trechos |
| Heatmap "Mais reproduzidos" | **presente** (100 baldes) |
| Legenda | **presente** — automática, `pt` · 3.830 falas |
| Payload público (`/probe`) | **4,2 KB** — 98,7% do dump fica no servidor |
| yt-dlp | 2026.08.18.122307, binário do PATH |

O caminho inteiro roda: `POST /probe` → yt-dlp → legenda → candidatos → JSON.
Provado com servidor de verdade em `127.0.0.1:8098` — resposta HTTP 200 de 4.226
bytes — e as duas recusas previstas funcionando (`vimeo.com` → 400 "Esta rota só
aceita vídeo do YouTube"; URL vazia → 400 "Cole o endereço do vídeo").

### O que faltava — registro, não pendência (encerrado em 2026-09-14)

Tudo abaixo valia enquanto o motor fosse para a nuvem. Com a decisão de 2026-09-14
nada disso acontece. Fica escrito para não ser redescoberto se o objetivo mudar.

O YouTube trata IP residencial e IP de datacenter de forma diferente. De um
container em nuvem, o pedido pode voltar com verificação de robô ("Sign in to
confirm you're not a bot") em vez do JSON. **Isso mata a Fase 1 e não aparece em
teste local.** O passo está no `PASSO-A-PASSO.md` (Passo 3) e leva ~20 minutos.

Duas observações que já valem, medidas no código:

- **`probe()` não fixa `player_client`.** Quem fixa
  `player_client=web_embedded,tv,web` é o `fetch_section` (que baixa). Se o probe
  falhar da nuvem, um cliente explícito é a primeira coisa a testar — e é uma
  linha dentro do `ytclip.probe`, não um redesenho.
- **Se o bloqueio acontecer,** o caminho é (a) proxy residencial, com custo
  recorrente por GB, ou (b) a análise continuar local e o site público virar
  vitrine + lista de espera. Não invente contorno; traga o resultado.

---

## Prova B — postura de direitos autorais

**Estado: RESPONDIDA em 2026-09-14 — escolhida a (i).** As opções (ii) OAuth do
canal próprio e (iii) download no servidor foram apagadas conforme a instrução
original deste arquivo.

### (i) Só análise online — ESCOLHIDA
O servidor lê metadados públicos e a legenda que o YouTube publica. **Nunca baixa
mídia.** O download e o render continuam na máquina do usuário, no Estúdio local,
onde a declaração de autorização do criador já existe.
*A favor:* mais barato (nenhum FFmpeg na nuvem), postura mais defensável, e é o
que já está pronto e testado. *Contra:* o usuário precisa instalar o Estúdio para
cortar de fato — o site entrega o "onde", não o arquivo.

**Por que ela, com o objetivo de hoje:** o "contra" da (i) deixou de existir. Ele
custava um passo a mais para um usuário desconhecido; agora o único usuário é o
dono, e o Estúdio já está instalado na máquina dele. A (i) é a única das três que
**não muda uma linha de código** — é o que o sistema faz hoje. A (ii) exigiria a
API do YouTube, trabalho que não existe. A (iii) transferiria para o projeto uma
exposição que não faz sentido nenhum assumir quando não há cliente do outro lado.

**O que a (i) NÃO resolve, e é preciso estar escrito:** esta prova decide a postura
da *ferramenta*, não a autorização para *publicar*. Cortar podcast de terceiro e
postar em conta própria continua exigindo autorização da fonte — é o portão de
declaração explícita do `CLAUDE.md` (inviolável, conferido duas vezes, válido por
URL) e as fontes autorizadas do `../video-ops/PILOTO.md` §6. Escolher a (i) não
destrava publicação; destrava só o fim do impasse de arquitetura.

### O que fecha uma porta que parecia aberta

**"Deixa o usuário subir o MP4 dele" não é saída legal — é remoção do produto.**
A mágica é inteira derivada de dado que o YouTube publica: o heatmap de "Mais
reproduzidos" e a legenda. Um arquivo enviado não tem nenhum dos dois. Substituir
isso exigiria transcrição própria (Whisper): nova dependência, novo custo por
minuto, e o detector teria que ser reescrito para pontuar sem heatmap. É outro
produto, não uma variação deste.

---

## Decisão (2026-09-14, decisão do usuário)

- [x] **Prova A** — o probe funciona de um IP de datacenter? **Resposta: a pergunta
  não se aplica.** O motor não vai para a nuvem. O site passou a ser de uso pessoal
  do dono, com o yt-dlp já instalado na máquina dele, em IP residencial — a mesma
  condição da linha de base medida em 2026-08-26. Nenhum IP de datacenter no
  caminho, nada a medir. O Passo 3 do `PASSO-A-PASSO.md` não será executado.

- [x] **Prova B** — postura escolhida: **(i) só análise online.** Porque é a única
  que não muda uma linha de código — descreve o que o sistema já faz — e porque o
  único "contra" dela (obrigar o usuário a instalar o Estúdio) desapareceu quando o
  único usuário passou a ser o dono, que já o tem instalado. A (ii) exigiria a API
  do YouTube, que não existe no projeto; a (iii) traria exposição jurídica sem
  nenhum cliente para justificá-la.

**Consequência imediata:** as Fases 2 e 3 não começam por decisão de escopo, não
por falta de prova. O portão está fechado e o que havia atrás dele foi arquivado —
ver a seção seguinte.

---

## Nada disso é para agora (decisão do usuário, 2026-08-27)

> **Superado em 2026-09-14: nada disto é para nunca, não para "agora".** Com o
> objetivo pessoal e as duas provas respondidas acima, o motor não vai para a nuvem
> e a receita abaixo (Fly.io, Turnstile, render em container) vira **registro
> histórico**. Não executar. Retomar exige objetivo novo e plano novo — e a pasta
> `cloud/` já foi aposentada em 2026-09-14 (ver `../02-Execution/PENDENCIAS.md`).

A fase atual é **Vercel servindo a página + motor rodando na máquina do
operador**, para ele acompanhar o trabalho de casa e do trabalho. Não é
lançamento. Ver `PASSO-A-PASSO.md`.

Este arquivo continua sendo o portão de quando **o motor** for para a nuvem. A
receita abaixo está pronta até onde dá sem uma conta de nuvem; guardada aqui para
não ser reescrita.

### Receita de publicar o motor (Fly.io)

Precisa de um lugar que **rode subprocesso** (yt-dlp) e **escale a zero**.
Cloudflare Workers e Supabase Edge Functions não servem — não rodam processo.

```powershell
iwr https://fly.io/install.ps1 -useb | iex
fly auth login
fly launch --no-deploy --dockerfile cloud/Dockerfile --name cortes-analise
```

No `fly.toml` gerado, confira: `internal_port = 8080`, `auto_stop_machines`
ligado, `min_machines_running = 0` (é o escala-a-zero) e região `gru`.

```powershell
fly secrets set ALLOWED_ORIGIN="https://seu-site" TURNSTILE_SECRET="<secret>"
fly deploy --dockerfile cloud/Dockerfile
```

**Confira o tamanho do envio.** O repositório tem **1,1 GB** (medido) e o
`.dockerignore` existe para subir só os cinco `.py` (~150 KB). É a única peça
desta receita **não verificada** — nesta máquina não há Docker, e as regras de
re-inclusão do `.dockerignore` só se provam num build real. Se o deploy anunciar
dezenas ou centenas de MB, o arquivo não pegou.

### Turnstile (só quando o motor for público)

Não é contra custo — a análise é barata. É para o serviço não virar proxy grátis
de metadados e o IP não ser banido pelo YouTube em um dia.

1. Cloudflare → Turnstile → *Add widget*.
2. **Site Key** vai em `web/config.js` (é pública). **Secret Key** vai só em
   variável de ambiente do serviço, nunca no repositório.
3. `curl $URL/health` deve dizer `"turnstile": "on"`.

O servidor **se recusa a subir** sem `TURNSTILE_SECRET`, a não ser com
`CLIPS_DEV=1` — que é o modo da fase atual, onde não há nada público a proteger.

### E o render?

Quando o render for para a nuvem, é pelo **caminho FFmpeg**, não pelo Remotion.
Medido: o Remotion gasta ~11 s de render por 1 s de clipe (90 s = 1005 s); o
FFmpeg entrega o mesmo 9:16 com legenda queimada em segundos. E a imagem
~~**precisa da fonte Inter instalada**~~ **(superado em 2026-08-28: a Inter vai empacotada no repo e o filtro a recebe por `fontsdir`, então o container só precisa do FFmpeg)** — sem ela o libass trocaria calado para Arial e
todo clipe sai com a tipografia errada sem ninguém saber.
