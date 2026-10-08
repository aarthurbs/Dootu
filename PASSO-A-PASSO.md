# Publicar o site para VOCÊ acessar — Vercel

**Meta (2026-10-08):** ter o site no ar para abrir de qualquer computador ou celular.
**Não é lançamento**: nada de conta, banco, cobrança ou cliente.

| | |
|---|---|
| **O que vai ao ar** | Só a pasta `dist/`, montada por `node publicar.mjs` a partir do `index.html`: os scripts e CSS que ele carrega + `assets/`. Nada de docs, vídeos, testes, motor ou `.env`. |
| **Funciona no site publicado** | Central, Painel do Empreendedor, placar, aparência. |
| **Estúdio de Vídeos** | Continua no **seu PC**. No site publicado, a tela Clips vira um link para `http://127.0.0.1:8765` — abre o Estúdio do computador em que você estiver, com o `estudio.ps1` ligado. |
| **Quem publica** | A Vercel, a cada `git push`. O `vercel.json` já diz o que rodar e o que publicar. |

> **Por que o Estúdio não vai junto:** ele precisa do motor (`serve.py` com FFmpeg, yt-dlp e
> Remotion). Numa hospedagem comum a página abriria, mas todo botão falharia. Colocar o motor
> na internet exige login e proteção antes — é outro projeto (`docs/03-Decisions/LANCAMENTO-decisoes.md`).

---

## Passo 1 — Conferir na sua máquina

```powershell
node publicar.mjs
```

Monta `dist/` (≈8 MB) e lista o que entrou. Um `AVISO` quer dizer que o `index.html` pede um
arquivo que não existe — ele já falta no site local também.

`dist/` está no `.gitignore`: não se versiona, a Vercel gera a dela.

## Passo 2 — Subir o código

Os arquivos `publicar.mjs` e `vercel.json` precisam estar no GitHub:

```powershell
git add -A
git commit -m "publicacao do site"
git push
```

## Passo 3 — Criar o projeto na Vercel (uma vez)

1. [vercel.com](https://vercel.com) → entre com o GitHub.
2. **Add New… → Project** → escolha `aarthurbs/Dootu`.
3. **Root Directory: deixe vazio** (a raiz). **Não mexa** em Build Command nem Output
   Directory — o `vercel.json` já os fixa em `node publicar.mjs` e `dist`.
4. **Deploy.** Abra a URL e confira: o site abre na tela Clips com o card
   "Abrir o Estúdio de Vídeos".

**Branch publicada:** a Vercel publica a `main` por padrão. Se você trabalha em outra branch,
**Settings → Git → Production Branch** → ponha a sua.

> Netlify ou Cloudflare Pages: os mesmos dois valores — comando de build `node publicar.mjs`,
> pasta publicada `dist`.

---

## O que muda entre o site publicado e o local

- **Os dados ficam no navegador e no endereço.** O Painel do Empreendedor do site publicado
  começa vazio e é separado do Painel em `127.0.0.1:8765`. Seus projetos do Estúdio continuam
  onde estão (no endereço local).
- O link é público para quem o tiver. Os arquivos não têm nada privado, mas não trate o
  endereço como secreto.

## O que NÃO fazer

- **Não troque o Output Directory para a raiz.** Publicaria o repositório inteiro (docs,
  `CLAUDE.md`, código do motor, centenas de MB de vídeo).
- **Não abra o motor para a internet** (túnel, ngrok, porta no roteador). Ele não tem login e
  viraria um proxy de download público.
- **Não comite o `.env`.** Já está no `.gitignore`; mantenha assim.

## Rotina

```powershell
git pull                                      # 1. puxa o que você fez na outra máquina
.\estudio.ps1                                 # 2. liga o Estúdio local
git add -A; git commit -m "..."; git push    # 3. publica (a Vercel republica em ~30 s)
```

Antes de publicar mudanças no Estúdio: `.\provas.ps1`.
