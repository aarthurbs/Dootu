# Publicar para VOCÊ ver — Vercel + motor local

**Sua meta (2026-08-27):** ter o site no ar para você abrir do computador de casa e
do trabalho, ver como está ficando e mexer. **Não é lançamento**, não é venda, e
não tem cliente. Nada de conta, banco, cobrança ou limite por usuário.

O que isso significa em desenho:

| | |
|---|---|
| **Vercel** | serve a página. Publica a cada `git push`. |
| **Motor da análise** | roda na **sua máquina** (`127.0.0.1:8080`). Nunca vai à nuvem nesta fase. |
| **Banco de dados** | nenhum. Nada persiste ainda. |
| **Docker / Fly.io** | prontos no repositório, **sem obrigação de usar**. |
| **Auth, planos, cobrança, Turnstile** | fora. |
| **yt-dlp / Remotion** | continuam validados só localmente. |

---

## O detalhe que decide tudo: conteúdo misto

A página no Vercel é servida por **HTTPS**. Chamar `http://127.0.0.1:8080` dela é
uma requisição de **rede privada**, e cada navegador decide diferente:

| Navegador | Chamada HTTPS → `127.0.0.1` |
|---|---|
| **Chrome / Edge** | **liberada** — `127.0.0.1` é "origem confiável". Pode exigir um cabeçalho no preflight. |
| **Firefox** | liberada. |
| **Safari** | **bloqueada.** Não tem contorno. |

Você está no Windows, então Chrome ou Edge. O lado do servidor **já está pronto e
medido** — o preflight de rede privada é respondido:

```
Access-Control-Allow-Private-Network: true
```

E o mais importante: **quando não funciona, a página diz por quê.** Um `fetch`
bloqueado por conteúdo misto e um motor desligado chegam ao JavaScript como o
*mesmo* erro genérico — não há como distinguir. Então a página nomeia as duas
causas em vez de escolher uma e mentir.

---

## Passo 1 — Rodar tudo na sua máquina (1 comando)

```powershell
.\analise-local.ps1
```

Sobe duas coisas: o motor em `127.0.0.1:8080` e a página em `127.0.0.1:8090`.
Abra **http://127.0.0.1:8090** e cole a URL de um podcast. `Ctrl+C` encerra os dois.

Se a porta estiver ocupada, o script diz qual e o PID — rodar duas vezes é a
confusão número 1.

---

## Passo 2 — Publicar a página no Vercel

1. [vercel.com](https://vercel.com) → entre com o GitHub.
2. **Add New… → Project** → escolha este repositório.
3. Configure **exatamente** assim:

| Campo | Valor |
|---|---|
| Framework Preset | **Other** |
| **Root Directory** | **`web`** |
| Build Command | **vazio** |
| Output Directory | **vazio** |
| Install Command | **vazio** |

4. **Deploy.**

> ### O erro que você não pode cometer
> Se o **Root Directory** ficar vazio, o Vercel publica a **raiz do repositório** —
> e o seu site pessoal inteiro (Faturador, Radar, Fluxos, Painel do Empreendedor)
> fica público na internet.
> **O valor é `web`.** Depois do deploy, abra a URL e confirme que aparece a página
> "Cortes", e não o menu do seu site.

Anote a URL (algo como `https://cortes-abc123.vercel.app`).

### A branch que o Vercel publica

Você está na branch `agent/supabase-video-studio-sync-2026-08-04`. O Vercel publica
`main` como produção por padrão e dá URLs **novas a cada commit** para outras
branches — ruim para "sempre o mesmo link".

**Settings → Git → Production Branch** → ponha a branch em que você realmente
trabalha. Uma configuração, zero risco de git. (A alternativa é trabalhar na `main`,
mas isso exige um merge e não vale o risco agora.)

> O `.env` **não sobe**: está no `.gitignore`, conferido — nunca entrou no histórico.
> E a URL de produção é pública para quem tiver o link. Não há nada privado na
> página, mas não trate esse endereço como secreto.

---

## Passo 3 — Deixar o motor aceitar o site publicado

O motor só responde a origens que ele conhece. Passe a URL do Vercel:

```powershell
.\analise-local.ps1 -Site "https://cortes-abc123.vercel.app"
```

Para não digitar sempre, guarde na sua conta do Windows (uma vez por computador):

```powershell
setx CLIPS_SITE "https://cortes-abc123.vercel.app"
```

Feche e reabra o PowerShell. Daí em diante `.\analise-local.ps1` já vai com a URL.

Abra o site do Vercel **com o motor ligado**: a análise funciona, chamando o seu
próprio computador. Desligue o motor e recarregue: a página abre igual e explica
que o motor está desligado.

---

## Passo 4 — O processo dos dois computadores

O que você quer é que o site no ar seja sempre o seu trabalho mais recente. Isso é
git, e o Vercel publica sozinho.

**Ao começar a mexer, em qualquer máquina:**

```powershell
git pull
```

**Ao terminar:**

```powershell
git add -A
git commit -m "o que mudou"
git push
```

O Vercel vê o push e republica em ~30 s. Recarregue o site e está lá.

### A regra que evita dor de cabeça

**`git pull` antes de começar. Sempre.** Se você mexer em casa sem puxar o que fez
no trabalho, as duas versões divergem e você vai resolver conflito em vez de
trabalhar. Não existe truque: é lembrar de puxar.

Se esquecer e o `push` for recusado:

```powershell
git pull --rebase
```

E se der conflito, pare e me chame — desfazer conflito no braço é como se perde
trabalho.

---

## O que a página faz quando o motor está desligado

Isto é o comportamento normal e esperado (você vai ver muito):

- A página abre, com o visual completo.
- Um aviso explica que o motor não respondeu, com **as duas causas possíveis** e o
  comando que resolve (`analise-local.ps1`).
- O botão **Detectar cortes** fica desabilitado — e o motivo está à vista, não
  escondido.
- Um botão **Verificar de novo** reconsulta sem recarregar a página.

É de propósito: um site que promete análise e devolve erro de rede é pior do que um
site que diz onde o motor está.

---

## O que NÃO fazer

- **Não publique a raiz do repositório.** Root Directory é `web`. (Passo 2)
- **Não coloque o motor na nuvem ainda.** Falta a Prova A: ninguém testou se o
  YouTube atende o yt-dlp de um IP de datacenter. Está em `docs/LANCAMENTO-decisoes.md`.
- **Não comite o `.env`.** Já está protegido; mantenha assim.
- **Não abra o motor para a internet** (túnel, ngrok, porta no roteador). Ele não
  tem autenticação e viraria um proxy de download público.
- **Não use Safari** para testar o site publicado — ele bloqueia a chamada ao seu
  computador, sempre. Use Chrome ou Edge.
- **Não adicione banco, login ou cobrança** antes de existir dado que precise
  sobreviver ao fechar a aba.

---

## Rotina de todo dia, resumida

```powershell
git pull                      # 1. puxa o que você fez na outra máquina
.\analise-local.ps1           # 2. liga o motor + página local
#    ... mexer, testar em http://127.0.0.1:8090 ...
git add -A; git commit -m "..."; git push    # 3. publica
```

---

## Quando um dia for lançar de verdade

Nada disso é para agora. O que muda está escrito em
**`docs/LANCAMENTO-decisoes.md`**: as duas provas que precisam de resposta (o
yt-dlp funciona de IP de datacenter? qual a postura de direitos autorais?) e, no
fim, a receita de publicar o motor com Fly.io + Turnstile — que já está pronta no
repositório (`cloud/Dockerfile`, `.dockerignore`) e não precisa ser reescrita.

---

## Testes (rode antes e depois de qualquer mudança)

```powershell
py -3.12 cloud\test_probe_server.py            # 71
node web\test-app.js                           # 34
py -3.12 video-worker\test_ytclip.py           # 149
py -3.12 video-worker\test_serve.py            # 175
py -3.12 video-worker\test_captions.py         # 76
py -3.12 video-worker\test_worker.py           # 89
py -3.12 baixador\local-helper\test_helper.py  # 127
node test-video-ops.js                         # 38
node test-video-ops-dom.js                     # 70
node studio\test-preset.mjs                    # 56
```
