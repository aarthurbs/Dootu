# Baixador

Interface local para o **yt-dlp que você já tem instalado**. Nada aqui baixa vídeo por conta
própria: é só uma casca para não precisar abrir o terminal e digitar o comando.

## Desenho

```
Extensão do navegador  ->  Helper local (127.0.0.1:8770)  ->  yt-dlp (PATH)
```

- A **extensão** só sabe falar HTTP. Ela não executa programa nenhum na máquina.
- O **helper** (`local-helper\server.py`, biblioteca padrão do Python, sem `pip install`) é quem
  chama o `yt-dlp` — sempre com lista de argumentos e `shell=False`, nunca string de comando.
- Ele escuta **apenas em 127.0.0.1** e só devolve o header de CORS para origens
  `chrome-extension://`, então um site qualquer aberto no navegador não consegue disparar
  download no seu PC.

## Porta 8770 (e não 8765)

A **8765 é do Estúdio de Vídeos** (`estudio.ps1` / `video-worker\serve.py`). Subir o baixador
nela derrubaria o Estúdio. Por isso 8770.

## Pasta de download

`%USERPROFILE%\Downloads\yt-dlp` — criada na primeira vez. No YouTube o nome do arquivo é o
título do vídeo (`%(title)s.%(ext)s`). No **TikTok** é `%(uploader)s-%(id)s.%(ext)s`: o
"título" de um post do TikTok é a legenda inteira, com hashtag e emoji, e daria nome de
arquivo instável — o id é estável e único, então dois vídeos diferentes nunca colidem.

## Vídeo da aba atual

Abrir a extensão numa página `youtube.com/watch?v=...` ou `tiktok.com/@perfil/video/...` já
preenche o campo com aquele vídeo, com o título ao lado. A permissão é só `activeTab` — a extensão lê a aba **no momento em que
você clica no ícone** e nada além disso: sem content script, sem service worker, sem
`<all_urls>`, sem histórico.

Detectar **não** baixa nada. O endereço entregue ao yt-dlp é reconstruído a partir do id de 11
caracteres validado (no TikTok, do id numérico), nunca a string que estava na barra. Se a aba
não for um vídeo o bloco diz isso — e diz o caso específico, como "é uma publicação de fotos
do TikTok" — e o campo continua aceitando URL colada na mão, como sempre.

## TikTok

Fluxo do TikTok, um vídeo público por vez: cole o link (ou use o da aba atual) → **Buscar
vídeo** → confira o cartão → **Baixar**.

Aceita `tiktok.com/@perfil/video/<id>`, `/share/video/<id>`, `/embed/<id>`, o host `m.` — e os
links curtos `vm.tiktok.com/CODE`, `vt.tiktok.com/CODE` e `tiktok.com/t/CODE`. Quem segue o
link curto é o **helper**, com no máximo 3 saltos, e o destino passa pela mesma validação do
link completo: redirecionamento para fora do TikTok encerra a resolução, sem virar requisição.
Link curto expirado (o TikTok joga na home) tem mensagem própria. Publicação de **fotos** é
recusada dizendo que é fotos.

**Buscar vídeo** roda o yt-dlp em modo só-metadados (`--dump-single-json`) e devolve título,
criador, duração, miniatura, a URL canônica e a lista de qualidades. Nada é baixado nesse
passo, e o botão **Baixar** só libera depois dele — baixar sem ter buscado seria escolher
formato no escuro, e é o formato que decide a marca d'água.

### Marca d'água — o que a tela promete

Três estados, e nenhum deles é chute:

| Estado | Quando aparece |
|---|---|
| **com marca d'água** | o yt-dlp rotulou o formato como `watermarked` (é o `downloadAddr` do TikTok) |
| **sem marca d'água (confirmado)** | o próprio TikTok respondeu `has_watermark=false` para aquele formato |
| **marca d'água não confirmada** | o extrator não diz nada sobre aquele formato — o caso comum dos *play addr* |

O terceiro estado é o normal num vídeo público, e ele **não** vira "sem marca d'água".
Extensão `.mp4`, resolução, codec e "o download funcionou" não são evidência de nada. A escolha
automática pega a melhor variante que **não** está marcada; se só houver variante marcada, a
tela diz isso e **nenhuma** vem pré-escolhida — baixar assim é clique explícito seu.

Medido aqui em 2026-09-08, no mesmo vídeo: o formato `download` traz o logo do TikTok e o
`@perfil` queimados no quadro; o `h264_720p_*` (play addr) não traz. Logo, legenda e figurinha
que o **criador** colocou continuam no vídeo — nada aqui apaga pixel.

O arquivo sai **sem recodificar**: uma variante progressiva baixa como está. Variante sem
áudio próprio ganha `+ba` (remux, cópia de fluxo) para nunca sair muda.

### O download não depende do popup

O dono do trabalho é o helper. Fechar o popup não cancela nada; ao reabrir, ele pergunta
`GET /current` e reencontra o progresso de verdade. Helper reiniciado devolve vazio — o
processo do yt-dlp morreu junto e o arquivo ficou pela metade, então não há "concluído" a
restaurar.

## Declaração de direitos

O botão **Baixar** fica travado até você marcar a declaração de autorização, e a declaração
vale para **uma URL**: trocar de vídeo desmarca a caixa. O clique confere de novo na hora de
chamar o helper, porque a caixa pode ter mudado depois de o botão liberar.

## Análise gravada ao lado do vídeo

Terminado o download, o helper grava `<nome do vídeo>.mostreplayed.json` na mesma pasta
(sidecar **versão 5**):

```json
{
  "version": 5,
  "videoId": "...", "sourceUrl": "...", "duration": 0.0,
  "source": "TikTok", "title": "...", "creator": "perfil",
  "filename": "perfil-7000000000000000000.mp4",
  "downloadedAt": "2026-09-08T14:49:49Z",
  "watermark": { "status": "desconhecida", "evidence": "...", "formatId": "..." },
  "mostReplayed": { "available": true, "peaks": [ { "start": 0, "end": 0, "rank": 1 } ] },
  "captions": { "available": true, "language": "pt-BR", "kind": "manual",
    "cues":  [ { "start": 12.4, "end": 15.8, "text": "..." } ],
    "words": [ { "start": 12.4, "end": 12.72, "text": "..." } ] },
  "thumbnail": "Titulo do video.webp"
}
```

Os dois primeiros blocos vêm do **mesmo** `.info.json` que o `--write-info-json` já gravava: a
audiência sai do `heatmap` (`video-worker/heatmap.py`) e a legenda de UM GET no json3 que o
próprio dump aponta (`video-worker/ytclip.py`, `fetch_cues`). Nenhuma chamada extra ao yt-dlp.

`words` (chegou no v4) é a MESMA legenda lida palavra a palavra — o json3 traz o instante de
cada uma —, do MESMO GET: zero chamada a mais. É dela que a legenda do 9:16 tira a quebra de
linha, que passa a começar na primeira palavra e acabar na última, sem a sobreposição da
janela rolante do YouTube. Sidecar sem essa chave cai na `cues` grossa, o comportamento de
antes. A recomendação de cortes continua lendo só `cues` — de propósito.

`thumbnail` é só o **nome** do arquivo que o `--write-thumbnail` gravou ao lado do vídeo
(costuma ser `.webp`) — quem resolve a pasta é o Estúdio, com guarda de travessia. Ele vira o
**fundo do 9:16**: cobre o quadro inteiro, escurecido, no lugar do desfoque que antes era
tirado da tira central do próprio vídeo. Sem essa chave (ou com o arquivo ausente ou
ilegível), o corte cai no **letterbox chapado** na cor do preset — nunca falha por causa do
fundo. (Aqui dizia "volta ao fundo desfocado": o desfoque saiu dos três renderizadores em
2026-08-27, quando a legenda passou a ser escrita DENTRO do vídeo e a moldura virou só
moldura.)

Nenhum dos dois é obrigatório, e cada ausência tem motivo próprio em `reason` —
`MOST_REPLAYED_NOT_AVAILABLE` / `MOST_REPLAYED_EXTRACTION_FAILED` e
`CAPTIONS_NOT_AVAILABLE` / `CAPTIONS_EXTRACTION_FAILED`. Falha aqui **nunca** derruba o
download: o vídeo já está no disco e segue para os cortes.

O bloco de **procedência** chegou no v5: de onde veio o arquivo, quem publicou, quando foi
baixado e o estado da marca d'água **do formato que virou arquivo** — lido do `.info.json` do
próprio download, não da busca que você viu antes de clicar. Fora do TikTok o estado é
`nao-se-aplica`, em vez de inventar dúvida. `downloadedAt` é ISO 8601 em UTC. URL de mídia que
expira, cookie e token **nunca** entram aqui.

Sidecar antigo (sem `version`, sem `captions`, sem `thumbnail` ou sem `words`) continua
valendo — o Estúdio lê a chave que faltar como "vídeo sem legenda" / "sem miniatura" /
"sem tempo por palavra". Ninguém rebaixa vídeo de novo só para migrar formato.

É esse arquivo que o Estúdio de Vídeos lê em `/api/most-replayed` para sugerir os trechos do
Passo 2 e para queimar a legenda no 9:16.

## Como iniciar

```powershell
.\start-downloader.ps1
```

O script sobe o helper, confere o `/health` e mostra o endereço. Feche a janela para parar.

## Como carregar a extensão (sem empacotar)

Chrome: `chrome://extensions` → ligar **Modo do desenvolvedor** → **Carregar sem compactar** →
apontar para a pasta `baixador\extension`.

Edge: mesma coisa em `edge://extensions`.

Não precisa empacotar nem publicar. Se você mexer no código da extensão, clique em recarregar
naquela mesma tela.

## Teste

```powershell
py -3.12 baixador\local-helper\test_helper.py
node baixador\extension\test-popup.js
```

Os dois rodam offline (não baixam vídeo nenhum e não tocam a internet — a legenda de teste é
servida por um `http.server` no próprio 127.0.0.1). O primeiro valida URL, contrato das rotas,
parser da saída do yt-dlp, o sidecar, a resolução de link curto (com salto de mentira), a
classificação de marca d'água e as rotas `/inspect` · `/download` · `/current` (com o yt-dlp
dublado, contra um servidor em porta efêmera); o segundo carrega o `popup.js` num contexto do
`vm` com `document`/`chrome`/`fetch` de mentira e prova a detecção da aba, a validação de URL,
o portão de direitos, o cartão do TikTok e a retomada depois de fechar o popup.

O `test_helper.py` entra no `.\provas.ps1` da raiz; o `test-popup.js` roda à mão.

## Limites desta versão

- **1 download por vez.** Pedir outro enquanto um está rodando devolve
  "Já existe um download em andamento."
- Sem fila, sem histórico, sem banco de dados.
- **YouTube**: sem seletor de qualidade — sai o padrão do yt-dlp (o seletor existe só no
  TikTok, onde ele é o que decide a marca d'água).
- **TikTok**: um vídeo público por operação. Sem perfil, sem hashtag, sem som, sem live, sem
  publicação de fotos, sem vídeo privado ou restrito — e nada aqui contorna essas restrições.
- Sem MP3 / só-áudio e sem thumbnail.
- Sem arquivo de legenda separado (`.srt`/`.vtt`): as falas vão para o sidecar de análise,
  que é quem o Estúdio lê. O vídeo baixado em si não tem legenda embutida.
- Sem playlist e sem canal (`--no-playlist`).
- Sem login, sem cookies, sem contas, sem nuvem, sem tela de configurações.
- Fechar o popup no meio de um download **não** perde nem o arquivo nem a barra: ao reabrir,
  o estado volta do helper. Reiniciar o **helper** perde os dois (e não finge que terminou).

## Uso

Ferramenta **local**, para a sua máquina, e **somente para conteúdo que você tem direito de
baixar** (material próprio, licença que permita, ou autorização de quem publicou).
