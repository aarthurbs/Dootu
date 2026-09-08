# Checklist diário — Estúdio de Vídeos

Regra única deste arquivo: **se um item falhar, pare ali.** Não existe "commito e conserto
depois" — foi assim que o projeto acumulou 13 dias de trabalho sem commit.

---

## 0. Uma vez só (some daqui depois de feito)

- [ ] **Migrar os dados da origem antiga.** Todo o seu trabalho do Estúdio está salvo em
      `file://` e o painel novo abre em `http://127.0.0.1:8765` — são dois armazenamentos
      separados, então o painel novo abre vazio até você trazer os dados:
      1. abra `C:\Users\Teste\Downloads\seller-arthur-2\index.html` com duplo clique (só
         esta vez, é a origem antiga) → aba **Estúdio de Vídeos** → **Baixar dados brutos**
         → salve o `.json`;
      2. abra pelo **atalho do Desktop** → aba **Estúdio de Vídeos** → **Importar backup**
         → escolha o `.json`;
      3. confira se seus cortes apareceram. Só então siga.
- [ ] **Tirar os `.pyc` do controle de versão.** Eles estão no `.gitignore` mas entraram no
      índice antes disso, então ainda iriam pro commit:
      ```powershell
      git rm --cached -r video-worker/__pycache__
      ```

---

## 1. Ao abrir (todo dia)

- [ ] **Abrir SÓ pelo atalho `HUBI - Site (atual)` do Desktop.**
      Duplo clique no `index.html` abre em `file://`, e ali o botão **Baixar** é impossível:
      o painel chama `/api/video-cut` por caminho relativo, que em `file://` não existe.
      Pior, `file://` tem armazenamento próprio — trabalhar lá é gravar num lugar que o
      painel de verdade não lê.
- [ ] **Deixar a janela azul do PowerShell aberta** enquanto trabalha. Ela é o renderizador.
      Fechou = o FFmpeg sai do ar e o cache do corte é apagado (`serve.py` limpa o temp na
      saída, de propósito).
      Se aparecer erro de porta em uso, feche a janela antiga antes de abrir de novo.
- [ ] `git status --short` — saber o que já está solto **antes** de mexer em mais coisa.

---

## 2. Antes de qualquer commit (nesta ordem, sem pular)

- [ ] **Rodar a bateria inteira.** Um bloco, cola e roda:
      ```powershell
      node --check video-ops.js
      node test-video-ops.js
      node test-video-ops-dom.js
      py -3.12 video-worker\make_fixtures.py
      py -3.12 video-worker\test_worker.py
      py -3.12 video-worker\test_serve.py
      ```
      Esperado: 178 asserções · DOM ok · 16 · 89 · 49. **Qualquer falha = não commita.**
      `node test-ponte.js` falha desde antes e **não é do Estúdio** — é o Inventário Amazon
      comparando com um arquivo pessoal fora do repositório. Ignore por ora.
- [ ] `git diff --stat` — olhar o que está indo. Se tem arquivo que você não reconhece,
      descubra antes de commitar.
- [ ] **Mensagem de commit diz o porquê, não o quê.** O `git diff` já mostra o quê.

---

## 3. Fim do dia (obrigatório, todo dia)

- [ ] **Commitar, mesmo que pequeno.** Nunca dormir com trabalho só no disco. O Git é a
      única rede de segurança que não depende de você lembrar de copiar arquivo.
- [ ] **Exportar os dados do painel** — aba Estúdio → **Baixar dados brutos** → guarde o
      `.json` do dia. O Git versiona o *código*; seus cortes, aprovações e métricas vivem no
      `localStorage` do navegador, que o Git não vê e que o navegador pode apagar sozinho.
      Este `.json` é o único backup deles.
- [ ] **Se a fase mudou**, atualizar `CONTINUAR_PROJETO.md` (campo *Próxima fase*) e
      `docs/video-ops/PROGRESSO.md`. Checkpoint desatualizado custa uma sessão inteira de
      reconstrução de contexto.

---

## 4. Nunca (não se negocia, não importa a pressa)

- Publicar sem aprovação humana.
- Guardar token, cookie ou senha no navegador, no Drive ou no Git.
- Usar scraping ou login automatizado de TikTok/Instagram.
- Sobrescrever o arquivo original. Escrita é atômica: `.part` + rename.
- Registrar métrica ausente como `0` — ausente é `null`, e a interface mostra `—`.
  (Zero que **você** mediu continua valendo como zero.)
- Renderizar lista inteira na tela — os lotes de 50 existem por causa disso.
- Instalar npm no frontend, servidor Node, n8n, WhisperX, CUDA ou serviço pago.
- Mudar texto, horário, formato, corte, fonte, autorização ou conta de algo **já aprovado**
  sem refazer a aprovação. Publicação concluída é imutável.

---

## Por que este arquivo existe

Em 17/08/2026 o download dos cortes e o "nada fica salvo" foram diagnosticados como **um
único problema**: o site estava sendo aberto em duas origens diferentes (`file://` e
`http://127.0.0.1:8765`), que não compartilham armazenamento e onde só a segunda tem o
renderizador. Não era Supabase, não era login, não era hospedagem. Era por onde o site abre.

O item 1 deste checklist existe para esse erro não voltar.
