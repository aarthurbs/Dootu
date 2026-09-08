---
name: remotion-edit
description: Edita um corte já aprovado no Estúdio de Vídeos usando o Remotion em studio/. Use quando o usuário pedir para editar, legendar, reenquadrar, aplicar um preset ou renderizar um clipe — ou disser "edita o corte X", "põe legenda", "manda pro Remotion". NÃO use para descobrir cortes (isso é o /api/yt-probe) nem para publicar.
---

# Editar um corte com o Remotion

Você recebe um corte **já escolhido por uma pessoa** e aplica **só** o que foi pedido.

## Regra zero

Você **não** redesenha o projeto. Não troca a arquitetura, não adiciona recurso que ninguém
pediu, não "melhora" a composição de passagem. Se o pedido é "aumenta a legenda", o diff é
a fonte da legenda — não uma revisão do `Clip.jsx`.

Se o pedido for ambíguo (**"deixa melhor"**, **"dá um tapa"**), pergunte o que mudar antes
de mexer. Palpite vira retrabalho.

## 1. Receber o corte

O corte vem do Estúdio de Vídeos com estes campos (é o `clip` do `pp_video_ops_v1`):

    clipToken   nome do arquivo do trecho, já baixado, dentro da pasta de cache
    inSec/outSec  posição no vídeo original (informativo — o arquivo já está cortado)
    cues        falas do trecho, com o relógio ZERADO no começo do corte
    topic/hook  assunto e primeira frase
    reason      por que o trecho foi sugerido

Se não houver `clipToken`, o trecho ainda não foi baixado. **Pare e diga isso** — não baixe
por conta própria: baixar mídia passa pelo portão de direitos autorais no navegador.

## 2. Entender o conteúdo antes de editar

Leia as `cues`. Elas dizem do que o corte trata e onde caem as pausas. Editar sem ler é
como legendar de olhos fechados. Se não houver `cues`, diga que o corte não tem legenda
disponível e siga sem inventar texto.

## 3. Onde mexer

| Pedido | Arquivo |
|---|---|
| Tamanho, cor, posição, fonte da legenda | `studio/src/Clip.jsx`, componente `Legenda` |
| Enquadramento, fundo, desfoque | `studio/src/Clip.jsx`, componente `Fundo` |
| Título | `studio/src/Clip.jsx`, bloco do `title` |
| Duração, fps, dimensão | `studio/src/Root.jsx` (`calculateMetadata`) |
| Preset novo | `defaultProps.preset` + o ramo correspondente no `Clip` |
| Qual arquivo/legenda/preset vai para o render | `video-worker/serve.py`, `_handle_render` |

**Nunca** edite `video-worker/ytclip.py` para resolver um pedido de edição: aquilo é
descoberta de cortes e não sabe que o Remotion existe. Manter os dois separados é decisão
de arquitetura, não acidente.

## 4. Aplicar só o que foi pedido

Um pedido, um diff. Se enxergar outro problema, **relate** em vez de consertar junto.

## 5. Prever antes de renderizar

    cd studio && npm run studio

Abre o Remotion Studio com prévia ao vivo. Muito mais rápido que renderizar para descobrir
que a legenda ficou grande demais.

## 6. Validar o render

Renderizar sem erro **não é** prova de que ficou certo (`AGENTS.md`: "ausência de erro de
sintaxe não é sucesso"). Depois de renderizar, confira de verdade:

    npx remotion render src/index.jsx Clip out/teste.mp4 --props=job.json --public-dir=<pasta>
    <ffmpeg> -hide_banner -i out/teste.mp4          # dimensão precisa ser 1080x1920, h264+aac
    <ffmpeg> -ss <meio> -i out/teste.mp4 -frames:v 1 out/frame.png

E **olhe o frame**. Legenda cortada pela borda, texto sobre o rosto e fundo preto chapado
só aparecem na imagem. O FFmpeg do projeto está em
`video-apresentacao/_tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`.

## 7. Exportar

O caminho normal é o botão do Estúdio, que chama `POST /api/remotion-render` e entrega o
MP4 na pasta de Downloads. Renderizar à mão é para desenvolvimento; o resultado fica em
`studio/out/`, que é ignorado pelo Git.

## Proibições

- Nada de nuvem, upload, serviço pago ou render remoto. É tudo local.
- Nada de `npm install` de biblioteca nova sem autorização explícita do usuário
  (`AGENTS.md`: "peça autorização antes de instalar").
- Não publicar, não postar, não agendar. Publicação é humana.
- Não mexer em `index.html`, `video-ops.js` nem `worker.py` para resolver pedido de edição.
- Não prometer alcance nem viralização.
