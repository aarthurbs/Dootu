# Lançamento — Fase 0: as duas provas

Este arquivo é o portão. Enquanto a Prova A e a Prova B não estiverem respondidas
aqui, as Fases 2 e 3 não começam.

---

## Prova A — o yt-dlp funciona a partir de um IP de datacenter?

**Estado: meia resposta. A linha de base local está medida; o lado datacenter é
seu passo manual (precisa de uma conta de nuvem para responder).**

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

### O que falta (e é o passo mais importante do lançamento)

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

**Estado: NÃO RESPONDIDA. É decisão sua.** Escolha uma das três, apague as outras
duas e escreva a razão. As Fases 1, 2 e 3 do `Prompt-Lancamento-Clips-v2.md`
assumem a **(i)**.

### (i) Só análise online — *é o que o código de hoje faz*
O servidor lê metadados públicos e a legenda que o YouTube publica. **Nunca baixa
mídia.** O download e o render continuam na máquina do usuário, no Estúdio local,
onde a declaração de autorização do criador já existe.
*A favor:* mais barato (nenhum FFmpeg na nuvem), postura mais defensável, e é o
que já está pronto e testado. *Contra:* o usuário precisa instalar o Estúdio para
cortar de fato — o site entrega o "onde", não o arquivo.

### (ii) Canal do próprio usuário (OAuth do YouTube)
Só baixamos vídeo que o usuário comprovadamente possui.
*A favor:* postura sólida, permite render na nuvem sem exposição nossa. *Contra:*
público restrito a donos de canal, e exige a API do YouTube — trabalho que não
existe hoje.

### (iii) Download no servidor com declaração do usuário
É o portão de hoje, transplantado para a nuvem.
*A favor:* produto completo em uma tela. *Contra:* a exposição passa a ser nossa,
não do usuário. O `PESQUISA_FERRAMENTAS.md` §10 declara o yt-dlp "exceção
aprovada caso a caso" — e caso a caso não é "para todo estranho pagante".

### O que fecha uma porta que parecia aberta

**"Deixa o usuário subir o MP4 dele" não é saída legal — é remoção do produto.**
A mágica é inteira derivada de dado que o YouTube publica: o heatmap de "Mais
reproduzidos" e a legenda. Um arquivo enviado não tem nenhum dos dois. Substituir
isso exigiria transcrição própria (Whisper): nova dependência, novo custo por
minuto, e o detector teria que ser reescrito para pontuar sem heatmap. É outro
produto, não uma variação deste.

---

## Decisão (preencher)

- [ ] **Prova A** — o probe funciona de um IP de datacenter? Resposta:
- [ ] **Prova B** — postura escolhida: (i) / (ii) / (iii). Porque:

---

## Nada disso é para agora (decisão do usuário, 2026-08-27)

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
