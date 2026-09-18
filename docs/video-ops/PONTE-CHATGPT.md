# Ponte de contexto — Estúdio de Vídeos + extensão Baixador

> **Superado em parte (conferido em 2026-09-14).** Este documento é registro datado de
> **24/08/2026** e fica como está. O que mudou desde então: o **§3.1 "As cinco telas" não
> descreve mais o produto** — desde 2026-09-14 o Estúdio tem **três** telas (`central` ·
> `projects` "Meus projetos" · `youtube`), verificadas em `video-ops.js` (lista de abas) e
> registradas no `CLAUDE.md`. As etapas `1 Vídeo` / `2 Cortes` / `3 Clips` saíram da
> navegação; projetos, clips salvos e a edição dos trechos do YouTube continuam.
> Estado atual do projeto: `docs/01-Wiki/ESTADO-ATUAL.md`.

> **Para o ChatGPT:** você **não** tem acesso ao repositório. Tudo que existe está descrito
> aqui. Este documento é o estado **verificado em 24/08/2026** (todos os testes citados no §8
> rodaram e passaram nesta data). Trate o §6 (regras invioláveis) e o §7 (o que foi apagado
> de propósito) como restrições de projeto, não como sugestões: um plano que os viole é um
> plano recusado. Se algo aqui não bastar para decidir, **pergunte** em vez de supor.

---

## 1. O pedido

Quero sua ajuda para montar/avaliar **um plano de evolução do Estúdio de Vídeos**. O contexto
de negócio: operação de 90 dias produzindo **cortes verticais (9:16) de podcast de
negócios/empreendedorismo em PT-BR** para TikTok e Instagram. Um operador só (eu), máquina
Windows, sem equipe e sem servidor.

O que quero do plano: **o que construir a seguir, em que ordem, com "pronto quando" para cada
passo** — respeitando as restrições dos §6 e §7. O maior buraco hoje é o §9.

---

## 2. Panorama em 30 segundos

São **três peças locais**, nada roda em nuvem:

```
[1] Site estático (index.html, Vanilla JS)        <- a interface, aba "Estúdio de Vídeos"
        |  fetch em caminho relativo
        v
[2] Helper do Estúdio  127.0.0.1:8765  (Python)   <- serve o site E as rotas /api/*
        |  chama                                     (FFmpeg, yt-dlp, Remotion)
        v
    FFmpeg · yt-dlp · npx remotion render

[3] Baixador: extensão do navegador -> helper 127.0.0.1:8770 (Python) -> yt-dlp
        +- grava o vídeo e um sidecar .mostreplayed.json em ~/Downloads/yt-dlp
```

As peças [2] e [3] são **independentes** (portas diferentes, processos diferentes) e se
encontram num ponto só: a rota `POST /api/most-replayed` do Estúdio lê o sidecar que o
Baixador gravou (§5.3).

**Stack:** HTML/CSS/JS puro no navegador (zero npm, zero framework, zero build), Python da
biblioteca padrão nos dois helpers (zero `pip install`), e um projeto Remotion isolado em
`studio/` que é o **único** lugar com `package.json`.

---

## 3. Peça 1 — O Estúdio de Vídeos (a tela)

Aba `data-view="video-ops"` dentro do `index.html`. Renderer: `video-ops.js` (~2.100 linhas,
um IIFE, sem dependência). CSS: `video-ops.css`.

### 3.1 As cinco telas — e nada além

Barra `.vop-flow`, com um **fluxo numerado** e duas telas laterais em escala menor:

| Tela | `data-tab` | Frase que a tela mostra (`FLOW_HINT`) |
|---|---|---|
| **1 Vídeo** | `overview` | "carregue o vídeo original. Só isto: os cortes vêm no passo seguinte." |
| **2 Cortes** | `cuts` | "marque os trechos no mesmo vídeo e dê nome e prioridade a cada corte." |
| **3 Clips** | `review` | "seus clips: ajuste o título e a urgência de cada um e baixe o vídeo." |
| **Central** | `central` | "os clips que você já baixou, agrupados por vídeo. Aqui você baixa de novo." |
| **YouTube** | `youtube` | "cole a URL: a análise sugere trechos e só o trecho escolhido é baixado." |

O fluxo 1 › 2 › 3 é **um vídeo por sessão**. Central e YouTube ficam ao lado: uma é o
histórico, a outra é a segunda porta de entrada.

### 3.2 Caminho A — arquivo local (passos 1-2-3)

- **`INTAKE`** é a fonte única do original e vive **só na sessão**: `url` (blob), `file` (o File
  real que vai ao FFmpeg), `duration`, `name`, `cuts[]`.
- Os três passos montam a **mesma** seção `[data-intake]` com o **mesmo**
  `<video src=INTAKE.url>` — um player por tela, uma URL por sessão.
- **Carregar vídeo só existe no Passo 1.** Passos 2 e 3 sem vídeo mostram "Carregue o vídeo no
  Passo 1" — nunca um seletor de arquivo.
- **Corte = tempo, não cópia:** `{ id, name, priority, inSec, outSec }`. Prioridade
  `alta|media|baixa` (padrão `media`).
- Os campos de tempo aceitam `15:30`, `1:15:30` ou segundos puros (`930`); `parseClock()` é a
  única fronteira — internamente tudo continua em segundos. Texto que não é tempo vira "não
  marcado", nunca 0 calado.
- Nome e prioridade são editados **na própria linha**, sem re-render (re-render a cada tecla
  mataria o foco).
- **Passo 3 é o fim do fluxo.** Cada linha tem exatamente: prévia, título, urgência e
  **⬇ Baixar vídeo**. Nada de aprovação, descrição, legenda, hashtag ou metadado — a decisão
  do corte já foi tomada no Passo 2. **O título digitado É o nome do arquivo.**
- A extração física só acontece no ⬇ Salvar: `POST /api/video-cut` → FFmpeg local.

### 3.3 "Mais reproduzidos" — recomendação no Passo 2

Se o vídeo veio do Baixador (§5), o Passo 2 pede `POST /api/most-replayed` com o nome do
arquivo e desenha **trechos recomendados** a partir do gráfico de audiência que o YouTube
publica na própria página.

Distinção que o código faz questão de manter: **recomendação é medição** (audiência do
YouTube, morre com a sessão); **corte é decisão** (do usuário, vai para a lista). Sidecar
ausente não é erro — a tela diz que o vídeo não publica o gráfico e o passo segue com marcação
manual.

### 3.4 Caminho B — YouTube por URL (tela `youtube`)

O estado `YT` também é **de sessão** (`url`, `videoId`, `candidates`, `authorized`, `preview`).

1. Cola a URL → **Detectar cortes** (`POST /api/yt-probe`) — **não baixa nenhum byte de mídia**.
2. Volta uma lista de trechos: `id`, `topic`, `inSec`, `outSec`, `hook`, `reason`, `score`,
   `contextWarning`, `category`, `signals`, `clipToken`, `clipBytes`, `clipCues`.
3. Marcar o portão de direitos (§6) libera **Baixar trecho** (`POST /api/yt-fetch`) — baixa
   **só** o trecho escolhido.
4. **Editar no Remotion** ou **Sem legenda** (`POST /api/remotion-render`) → o MP4 pronto entra
   na Central.

Trocar a URL derruba as sugestões e a declaração do vídeo anterior — sugestão apontando para
outro vídeo seria mentira.

### 3.5 A Central — a única coisa persistida

`localStorage` `pp_video_clips_v1` (`LIB_VERSION 1`), **uma lista só**. Um registro por MP4
baixado:

```js
{ id, videoName, videoUrl, clipName, inSec, outSec, fileName, savedPath, bytes,
  origin: "local" | "youtube", createdAt }
```

- Cartões agrupados **pelo vídeo de origem**, mais recente primeiro.
- Cada cartão: prévia do próprio corte (servido em `/clips/<arquivo>`), intervalo, tamanho,
  data, **⬇ Baixar vídeo** e "Remover do histórico" (tira o registro, **não** o arquivo).
- Sem `savedPath`, o cartão **explica** que o clip foi só para Downloads em vez de oferecer um
  link morto.
- `libAdd()` é o **ponto único** de registro, chamado pelos dois caminhos de download (corte
  local e render do Remotion) — nenhum pode esquecer.

**Limite conhecido:** recarregar a página perde o vídeo e a lista de cortes da sessão (blob de
vídeo nunca vai para o `localStorage`, por decisão de projeto). **O MP4 já baixado não se
perde** — está no disco e listado na Central.

---

## 4. Peça 2 — Os motores locais

### 4.1 `video-worker/serve.py` — porta 8765

Serve o site estático **e** as rotas. Sem ele (abrindo por `file://`) os botões de baixar não
têm ninguém do outro lado. Sobe com `.\estudio.ps1`.

| Rota | O que faz |
|---|---|
| `POST /api/video-cut` | corta o MP4 local com FFmpeg |
| `POST /api/yt-probe` | analisa a URL — metadados, capítulos, legenda, heatmap. **Não baixa mídia.** |
| `POST /api/yt-fetch` | baixa **só** o trecho aprovado + devolve as legendas dele |
| `POST /api/remotion-render` | chama `npx remotion render` e devolve o MP4 editado |
| `POST /api/most-replayed` | lê o sidecar que o Baixador gravou (§5.3). Não analisa nada. |
| `POST /api/clip-captions` | legenda do trecho para o operador **revisar e corrigir** antes do render, e a correção de volta. Lê o mesmo sidecar — nenhuma chamada ao yt-dlp, nenhum byte de rede. |
| `GET /clips/<arquivo>` | serve os clips guardados (`basename` mata travessia de caminho) |

**Todo MP4 que o servidor entrega é guardado em `~/Videos/Cortes Estudio`** e o endereço volta
no cabeçalho `X-Clip-Path` → vira `savedPath` na Central. A gravação mora num ponto só
(`_send_video`), então as duas rotas de vídeo herdaram sem cópia de código. Falhar ao guardar
**não** derruba o download: o vídeo chega igual, sem endereço, e o motivo vai ao console.

### 4.2 `video-worker/ytclip.py` — o detector de cortes

- `probe()` faz **uma** chamada ao yt-dlp (`--dump-single-json`) mais um GET na legenda json3:
  dezenas de KB para um podcast de horas, **zero byte de mídia**.
- `candidates()` é **função pura** e cruza três sinais: o **heatmap** de "Mais reproduzidos"
  (100 baldes que o YouTube publica na própria página — dado observado, **não** é analytics
  privado; quando o vídeo não publica, nenhuma sugestão cita audiência), os **capítulos** e a
  **legenda** (pergunta, número, ênfase, pausa). Sinais no mesmo ponto fundem e somam nota.
- `classify_segment()` classifica em 13 categorias PT-BR (`business, mindset, money, career,
  leadership, discipline, experience, failure, success, advice, life_lesson, strong_opinion,
  reflection`). **É palpite tirado das palavras da legenda, nunca medição** — por isso não
  entra no campo `signals`, que é reservado a evidência.
- **Corte autocontido:** detecta trecho que abre com conector solto (`mas`, `então`, `aí`,
  `porque`…) e recua para um começo limpo; quando não dá, emite `contextWarning` em português
  e o operador vê o aviso na lista.
- **Duração dirigida pela ideia, não por cronômetro:** fecha em fim de frase + pausa ou troca
  de assunto — ~25 s para uma tese curta, ~70 s para uma história, com teto duro.

### 4.3 `studio/` — a camada de edição (Remotion)

Projeto React/Remotion com `package.json` **próprio**. O `index.html` continua Vanilla sem
npm: `studio/` não é servido ao site, e a única ponte é a rota de render chamando
`npx remotion render` como processo. `--public-dir` aponta para a pasta de cache, então
**nenhum byte de vídeo é escrito dentro do repositório**.

Preset único: **BUSINESS_SERIOUS**, 1080x1920, fundo do próprio vídeo borrado, vídeo
centralizado, título e legenda. Dois modos: `legenda` e `limpo`. Todos os números em `TOKENS`.

- Legenda Inter Bold 58px branca, **máx. 2 linhas**, ancorada pela BASE dentro do retângulo
  do vídeo (`captions.margem_inferior` -> prop `legendaBase`, desde 2026-08-27; antes era
  topo fixo em 66% da altura), 820px de largura
  (passa por baixo da trilha do TikTok). Fala longa vira páginas curtas.
- **Ênfase: no máximo UMA palavra por página**, escolhida por significado (termo de
  dinheiro/erro ou número com unidade). Amarelo queimado, verde para dinheiro/sucesso,
  vermelho para fracasso — **uma cor por vez**.
- **A legenda não anima, de propósito.** O que o espectador vê dezenas de vezes não deve
  animar. Movimento só com razão semântica.
- `TOKENS.videoEscala = 1.45` é o botão de calibragem: corta 270px de cada lado, bom para
  plano fechado; em plano aberto pode cortar o convidado na ponta — baixar para ~1.15.

**Direção editorial (não negociável):** *conteúdo forte → corte certo → comunicação clara →
edição discreta → autoridade*. **Nunca** "efeito, efeito, efeito". Proibido por escrito: meme,
emoji, estética de desenho, texto em movimento constante, zoom agressivo, shake, corte a cada
segundo, B-roll aleatório, música alta, cor neon, "edição genérica de TikTok" e **qualquer
efeito disparado só porque o tempo passou**.

---

## 5. Peça 3 — A extensão (Baixador)

Pasta `baixador/`. É uma **casca para o yt-dlp que já está instalado na máquina** — não baixa
nada por conta própria. Existe para eu não precisar abrir o terminal.

```
Extensão do navegador  ->  Helper local (127.0.0.1:8770)  ->  yt-dlp (do PATH)
```

### 5.1 A extensão (`baixador/extension/`)

Manifest V3, **quatro arquivos** (`manifest.json`, `popup.html`, `popup.css`, `popup.js` — ~126
linhas de JS). Carregada sem empacotar, por "Modo do desenvolvedor" no Chrome/Edge.

```json
"permissions": [],
"host_permissions": ["http://127.0.0.1:8770/*"]
```

**Permissão zero.** Sem content script, sem background, sem acesso a aba nenhuma. O popup só
sabe falar HTTP com o helper: `GET /health`, `POST /download`, `GET /status/<id>`. Ela **não
executa programa nenhum** na máquina.

### 5.2 O helper (`baixador/local-helper/`, ~480 linhas de Python)

Biblioteca padrão, sem `pip install`. Escuta **apenas em 127.0.0.1** e só devolve CORS para
origem `chrome-extension://` — um site qualquer aberto no navegador não consegue disparar
download no PC. Chama o yt-dlp sempre com **lista de argumentos e `shell=False`**, nunca string
de comando, e com `--` antes da URL (tudo depois é URL, nunca opção).

Porta **8770 e não 8765**: a 8765 é do Estúdio; subir aqui derrubaria ele.

Detalhes que já custaram bug e estão comentados no código:

- **Barra em duas fases:** o yt-dlp baixa vídeo e áudio em dois arquivos e o percentual
  reinicia no segundo — exibir cru fazia a barra **andar para trás**. Cada arquivo ocupa metade
  da barra. Errar para baixo é melhor que anunciar 100% com o download ainda rodando.
- **`--encoding utf-8` explícito:** sem isso, título com acento chega com `U+FFFD` e o nome do
  arquivo sai torto. Medido: `PYTHONIOENCODING` **não** resolve (binário congelado ignora).
- **403 tem código de erro próprio:** com build velho do yt-dlp o download morria com "HTTP
  Error 403"; o mesmo comando, sem trocar um argumento, terminou o arquivo com o build novo.
  Então o 403 não cai no genérico — vira a instrução `winget upgrade yt-dlp.yt-dlp`, que é o
  que resolve.
- O fallback de nome de arquivo ignora `.json` de propósito (senão devolveria o metadado como
  se fosse o vídeo).

Pasta de download: `%USERPROFILE%\Downloads\yt-dlp` — **fora do repositório**, de propósito.

### 5.3 A ponte entre as duas peças

No fim do download, o helper grava um sidecar **`<nome do vídeo>.mostreplayed.json`** ao lado
do MP4, com a audiência observada. O algoritmo mora em `video-worker/heatmap.py` e é
**importado, nunca copiado** — duas cópias divergiriam no primeiro ajuste de limiar, e o
Estúdio usa exatamente o mesmo detector.

O sidecar carrega hoje três coisas (`version: 3`): a audiência, as falas da legenda e o
**nome do arquivo de miniatura** que o `--write-thumbnail` gravou junto — é essa imagem que
vira o fundo do 9:16. Chave ausente nunca é erro: sem legenda o corte sai sem legenda, sem
miniatura o fundo é a cor chapada do preset (o desfoque saiu em 2026-08-27).

O Estúdio lê esse sidecar pela rota `POST /api/most-replayed` (§3.3). Por que uma rota e não
uma leitura direta: o navegador não lê o disco, e o helper da 8770 aceita **só** origem de
extensão — o portão de CSRF dele fica intacto. A rota é do mesmo servidor que serve a página,
então a leitura acontece sem afrouxar nada.

Falha ao gravar o sidecar **nunca** derruba o download, e os motivos ficam distintos
(`MOST_REPLAYED_NOT_AVAILABLE` = o vídeo não publica o gráfico; `MOST_REPLAYED_EXTRACTION_FAILED`
= fomos nós que falhamos), porque erro silencioso é indistinguível de erro ausente.

### 5.4 Limites assumidos desta versão

**1 download por vez** (pedir outro devolve "Já existe um download em andamento"). Sem fila,
sem histórico, sem banco. Sem seletor de qualidade ou formato. Sem MP3/só-áudio, sem
thumbnail, sem legenda. Sem playlist e sem canal. Sem login, sem cookies, sem contas, sem
nuvem, sem tela de configurações. Recarregar a extensão no meio de um download perde a barra de
progresso, não o arquivo.

---

## 6. Regras invioláveis (qualquer plano precisa caber nelas)

1. **Nada de npm, framework ou build no site.** `index.html` é Vanilla JS e continua sendo.
   `studio/` é a única exceção, isolada atrás de um processo.
2. **Nada de servidor Node próprio.** Os helpers são Python de biblioteca padrão. Quando
   houver backend, ele é Supabase — hoje **PAUSADO**.
3. **Nenhum byte de vídeo dentro do repositório.** Downloads em `~/Downloads/yt-dlp`, clips em
   `~/Videos/Cortes Estudio`, cache do Remotion fora.
4. **Portão de direitos autorais — nunca remover.** Analisar (metadados/legenda) é livre;
   **baixar mídia** passa por um portão explícito: uma declaração marcada pelo operador
   ("Declaro que tenho autorização do criador…"), válida **por sessão e por URL** — trocar de
   vídeo exige declarar de novo. É conferida **duas vezes**: antes de chamar e na volta da
   resposta, porque a declaração pode ser desmarcada durante os ~50 s do download.
   *(Honestidade sobre o portão: ele é mais frouxo que o cadastro de autorização que existia
   antes — não tem prazo nem plataforma. Se um dia precisar de prova, ele volta como tabela,
   não como checkbox.)*
5. **yt-dlp:** nunca `--exec`, nunca `--netrc-cmd`, nunca cookies de navegador, nunca aria2c.
   Sempre `--ignore-config` (para nenhum `yt-dlp.conf` da máquina reintroduzir o proibido). A
   URL entregue ao processo é **reconstruída do id validado**, nunca a string colada.
6. **Automação muda é proibida: estado visível em todos os casos, inclusive quando não age.**
   Preencheu → confirmação; tem opções → opções à vista; não achou → dizer por quê. Nenhum ramo
   termina sem feedback.
7. **Toda divisão por valor vindo de input guarda o denominador zero.**
8. **Sem "cara de IA" na UI:** proibido glow neon gratuito, gradiente arco-íris e qualquer
   efeito sem função. Transições < 300 ms, easing forte, `transition` com propriedade
   específica (nunca `transition: all`).
9. **Mudança cirúrgica.** Tocar só no que a tarefa exige. Não "melhorar" código vizinho que
   funciona. Se 200 linhas resolvem em 50, são 50.

---

## 7. O que foi apagado de propósito — não sugerir de volta

Em 21/08/2026 **o pipeline de publicação inteiro saiu** do Estúdio. Saíram as telas *Material*,
*Posts*, *Direitos*, *Contas* e *Relatórios* **e todo o código atrás delas**: contas, linhas
editoriais, criadores, autorizações, fontes, variantes/posts, aprovação por hash, publicação,
métricas, caminhos do Drive, exportação CSV, logs, backup/importação e os diálogos modais.
`video-ops.js` foi de 4.904 para ~2.100 linhas; o CSS perdeu 165 regras mortas.

A chave antiga `pp_video_ops_v1` (schema 4) **continua intacta** no navegador de quem usava —
só não tem mais tela. Apagar dado do usuário não é papel de um refactor de tela.

**Um plano que proponha "trazer de volta as contas / o agendamento / a aprovação" precisa dizer
explicitamente que está revertendo essa decisão, e por quê.** Não reintroduzir por descuido.

Fora da v1 do editor **de propósito** (a base tinha que renderizar certo antes de ganhar
recurso): zoom, transição, corte dinâmico, trilha sonora, efeito sonoro, marca d'água,
abertura/encerramento.

---

## 8. Como eu verifico que nada quebrou

Todos passaram em 24/08/2026:

```
node test-video-ops.js                        -> 32 provas  (lógica pura do Estúdio)
node test-video-ops-dom.js                    -> 70 provas  (as 5 telas, Central, portão)
node test-video-ops-rec.js                    -> ok         (recomendação "Mais reproduzidos")
node studio/test-preset.mjs                   -> 45 provas  (tipografia, quebra, ênfase)
py -3.12 video-worker/test_ytclip.py          -> 124 provas (detector; nenhuma rede)
py -3.12 video-worker/test_serve.py           -> 53 provas  (rotas, /clips, travessia)
py -3.12 video-worker/test_worker.py          -> 89 provas  (FFmpeg)
py -3.12 baixador/local-helper/test_helper.py -> 96 provas  (offline, não baixa nada)
```

Nenhum teste usa rede ou conteúdo de terceiro. Qualquer passo do plano deve dizer **qual desses
comandos prova que ele funcionou** — ou qual teste novo precisa existir.

---

## 9. O buraco real, e o que eu já sei que dói

**O buraco:** do MP4 pronto até o post publicado, tudo é manual. Hoje o fluxo acaba no arquivo
na pasta; eu abro o TikTok/Instagram e subo na mão. Esse é o assunto principal do plano.

Restrições que já conheço sobre isso: a API do Instagram/Facebook exige conta Business e app
revisado; a do TikTok é mais fechada; e **eu não quero um servidor rodando 24/7** — a máquina é
a minha. Qualquer proposta precisa dizer **onde o processo vive** e o que acontece quando a
máquina está desligada.

**Armadilhas já medidas — não re-descobrir:**

- **Render de 10 s leva ~150 s.** Quase tudo é o `npx remotion render` refazendo o bundle. Se
  incomodar, o caminho é `@remotion/bundler` com bundle reaproveitado — **não** mexer na
  composição.
- **`--download-sections` obriga o downloader FFmpeg**, que refaz o pedido com User-Agent de
  Chrome; o cliente padrão devolve URL casada com outro agente e o YouTube responde **403**
  (aparece como `ffmpeg exited with code 3436169992`). Só `web_embedded` entrega 1080p —
  `tv`/`web`/`android`/`mweb` caem em 360p e `ios`/`web_safari` não negociam formato. Fixado
  `player_client=web_embedded,tv,web`.
- **`transform: scale(1.05)` numa palavra destacada** cresce o glifo mas **não a caixa de
  layout** — em palavra longa os 5% transbordam ~17 px e comem o espaço seguinte
  ("Faturamentonão"). Só aparece **olhando o frame**; nenhum teste pegou. A escala foi
  removida; ênfase hoje é cor + peso 900.
- Arquivo movido ou apagado por fora = player mudo na Central; a linha embaixo do cartão diz
  isso em vez de fingir que está tudo bem.

---

## 10. Formato de resposta que me serve

Para cada passo do plano, quero: **o que muda**, **em qual arquivo**, **quanto tempo**, **como
sei que ficou pronto** (o comando ou o teste), e **o que esse passo deliberadamente não faz**.
Ordem por dependência, não por tamanho. Se algum passo violar o §6 ou reverter o §7, diga isso
na cara em vez de embrulhar.

E se a sua conclusão for "não construa nada disso ainda, opere na mão mais duas semanas" — diga
também. É uma resposta válida.
