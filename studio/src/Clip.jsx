import { Fragment } from "react";
import {
  AbsoluteFill, Easing, Img, Sequence, spring, staticFile, useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { loadFont as carregarInter } from "@remotion/google-fonts/Inter";
/* A segunda FAMILIA do projeto, e a primeira que nao e Inter: ela e o estilo `impacto` da
   legenda. Nenhuma dependencia nova entra por causa dela — o `@remotion/google-fonts` ja
   estava no package.json desde a Inter, e este import e mais um modulo de dentro dele. */
import { loadFont as carregarArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";
import {
  TOKENS, corDoDestaque, toCaptionPages, pickEmphasis, splitEmphasis,
  ancoraLegenda, LEGENDA_BASE_PADRAO, ancoraBanda, BANDA_PADRAO,
  activeWordIndex, popPalavra, MOLA_PALAVRA,
  palavrasDaPagina, resolveTitleHighlight, splitTitleHighlight,
  tituloEscalonado, entradaCard, presencaCard,
  titleCardPreset, TITLE_CARD_PADRAO, TITULO_FILETE_REF,
  palcoGeometria, REFRAME_PADRAO, VIDEO_ALTURA_PADRAO,
  legendaPreset, tetoDaPagina, LEGENDA_PADRAO,
} from "./preset.js";
/* O REGISTRO das marcas, nunca uma marca solta. Enquanto isto era
   `import { MARCA_BADGE, ... }`, um segundo card só poderia escolher o asset com um `if` de
   marca escrito à mão aqui dentro — e fiação escrita à mão neste arquivo é exatamente o que
   já passou verde e saiu errada no frame três vezes (`ancoraLegenda`, `palavrasDaPagina`,
   `presencaCard`). Agora quem escolhe é o `titleCardPreset` do preset.js, provado por
   execução, e o componente recebe UMA entrada — sem alcance nenhum à outra. */
import { MARCAS } from "./marca.js";

/* Só os pesos usados. Cada peso extra é um arquivo a mais que o render espera carregar antes
   do primeiro frame.
   O 800 entrou com a segunda identidade do card: no Ecommerce Puro o destaque do título é
   PESO (800 -> 900), porque a marca é monocromática e não há cor de marca para usar. Sem o
   arquivo do 800 o navegador SINTETIZA o peso a partir do 700 e sai um engrossamento
   borrado que só aparece OLHANDO o frame — a mesma armadilha que o 900 já teve. Mesma
   FAMÍLIA (Inter), nenhuma dependência nova. */
const { fontFamily: INTER } = carregarInter("normal", {
  weights: ["600", "700", "800", "900"], subsets: ["latin"],
});
/* UM peso, e nao e descuido: a familia Archivo Black tem um peso so (400) e o preto ja
   esta no desenho. Pedir 700 ou 900 dela faria o Chrome SINTETIZAR negrito sobre um peso que
   ja e maximo — o mesmo engrossamento borrado que o comentario do peso 800 da Inter (acima)
   registra, e que so aparece OLHANDO o frame.
   `latin` basta para o portugues: o bloco cobre U+0000-00FF, ou seja A-Z, acentos, C-cedilha
   e til. Subset a mais e arquivo a mais para o render esperar antes do primeiro quadro. */
const { fontFamily: ARCHIVO_BLACK } = carregarArchivoBlack("normal", {
  weights: ["400"], subsets: ["latin"],
});

/* O id que o preset da legenda pede -> a familia carregada aqui. E um REGISTRO, e nao um
   `if` dentro do componente, pela razao de sempre neste arquivo: fiacao escrita a mao no JSX
   e onde a escolha erra calada (`ancoraLegenda`, `palavrasDaPagina`, `presencaCard`).
   Id ausente do mapa cai na Inter em vez de `undefined`: `fontFamily: undefined` faz o
   Chrome desenhar na fonte padrao DELE — legivel, sem erro, e fora da identidade. O check
   15g cobra que todo id do `LEGENDA_FAMILIAS` tenha entrada aqui. */
const FAMILIAS = { inter: INTER, archivo_black: ARCHIVO_BLACK };
const familiaDo = (estilo) => FAMILIAS[estilo && estilo.familia] || INTER;

/* A Montserrat continua FORA. Ela existia para o wordmark da marca antiga; as duas placas de
   hoje estão em curvas (PNG e SVG), então nenhuma das duas identidades depende de fonte
   instalada — e o texto do card é Inter nas duas, o que o próprio README do Ecommerce Puro
   manda ("O texto do card continua em Inter. Montserrat só na marca"). */

export const WIDTH = TOKENS.largura;
export const HEIGHT = TOKENS.altura;
export const FPS = TOKENS.fps;

export const defaultProps = {
  clipFile: "",        // nome do arquivo dentro do --public-dir (nunca caminho absoluto)
  backgroundFile: "",  // miniatura do vídeo, mesma pasta; vazio = letterbox na cor do preset
  durationSec: 30,
  cues: [],            // [{start,end,text}] em segundos RELATIVOS ao começo do corte
  /* Distância da borda de BAIXO do quadro até a base da legenda, em px. Quem calcula é o
     `captions.margem_inferior` do servidor (dono único da âncora, compartilhado com o
     caminho FFmpeg/ASS). O padrão mora no preset.js (uma cópia só do número em JS, com
     paridade guardada pelo test_captions.py) e existe para o Remotion Studio abrir na
     posição certa quando não há servidor mandando props. */
  legendaBase: LEGENDA_BASE_PADRAO,
  /* Altura de UMA tarja, onde a miniatura entra (repetida em cima e embaixo). Quem calcula
     é o `worker.band_height` do servidor, dono único também do filtro do FFmpeg. O padrão
     serve o Remotion Studio sem servidor, igual ao legendaBase. */
  bandaAltura: BANDA_PADRAO,
  /* Recorte aplicado a FONTE: "blur" deita o quadro inteiro (o de sempre), "crop11" e
     "crop45" recortam para 1:1 e 4:5. Conjunto fechado, validado pelo `reframeOf`.
     Ausente cai no padrao, entao trecho salvo antes do seletor sai como sempre saiu. */
  reframe: REFRAME_PADRAO,
  /* Altura do video visivel dentro do quadro. Quem calcula e o `serve.video_box`, dono
     unico da altura nos DOIS renderizadores; o padrao serve o Remotion Studio sem
     servidor, igual ao legendaBase e ao bandaAltura. */
  videoAltura: VIDEO_ALTURA_PADRAO,
  /* Preenchido para o Remotion Studio abrir MOSTRANDO o card — que é o ponto onde o
     recurso se conferia e não se via nada: com `title: ""` a composição não monta o card,
     e abrir o projeto ao lado do vídeo dava a impressão de que o destaque não existia.
     Não vaza para render nenhum: o `render_props` do serve.py SEMPRE manda a chave
     `title`, e prop mandado vence defaultProp. */
  title: "Saiu de uma pequena cidade, para 100 mil pedidos no Brasil.",
  /* Trecho do título a destacar, escolhido À MÃO. Vence o automático sempre. Vazio é o
     normal: o `resolveTitleHighlight` escolhe sozinho. Prop ausente cai aqui, então o
     `render_props` do serve.py não precisa saber que isto existe. */
  highlightText: "",
  /* Interruptor do automático. `false` = título liso, aconteça o que acontecer. */
  autoHighlight: true,
  /* Qual das duas identidades o card veste. O padrão é o `primo_rico` do preset.js — a
     marca que TODO corte já renderiza hoje —, e é o que faz clip antigo (sem a chave no
     `pp_video_projects`) sair exatamente como saía. Valor torto não chega ao JSX: o
     `titleCardPreset` o normaliza. */
  titleCardStyle: TITLE_CARD_PADRAO,
  /* Qual aparencia a legenda veste. O padrao e o `classico` do preset.js — a legenda que
     TODO corte ja renderiza hoje —, e e o que faz clip salvo antes desta entrega (sem a
     chave no `pp_video_projects`) sair exatamente como saia. Valor torto nao chega ao JSX:
     o `legendaPreset` o normaliza. */
  legendaStyle: LEGENDA_PADRAO,
  preset: "BUSINESS_SERIOUS",
  category: "",        // vem do detector; só escolhe a cor do destaque
};

/* O serve.py e o video-ops.js já falam "legenda"/"limpo" desde a primeira versão do
   pipeline. Renomear os dois lados agora quebraria o caminho que funciona só para deixar o
   nome bonito — então o nome novo entra e o antigo continua valendo. */
function normalizarPreset(valor) {
  var bruto = String(valor || "").toUpperCase();
  if (bruto === "LIMPO") return "LIMPO";
  return "BUSINESS_SERIOUS";
}

/* Reenquadramento 9:16. O fundo preenche o quadro inteiro com a MINIATURA do vídeo,
   escurecida com os MESMOS números do FFmpeg (`worker.THUMB_LUZ`/`THUMB_SATURACAO`, usados
   lá dentro do ramo `reframe == "blur" and background` do `_reframe_chain` — NÃO no ramo
   `crop`, que reenquadra por recorte e não monta fundo nenhum).
   `Img` do Remotion, não `<img>`: o Img segura a captura do quadro (delayRender) até a
   imagem carregar. Com a tag crua os primeiros quadros saem sem fundo e isso só aparece
   OLHANDO o frame 0.
   `cover` recorta a miniatura — pode, é fundo. O vídeo do Palco nunca é recortado.

   SEM miniatura não se desenha imagem nenhuma: sobra o `backgroundColor` do preset, ou seja
   letterbox chapado, o MESMO que o `worker.py` pinta com `pad=...:color=FUNDO_COR`.
   Aqui havia um segundo elemento de vídeo, desfocado; ele foi REMOVIDO em 2026-08-27, porque
   a legenda passou a ser ancorada DENTRO do vídeo e o fundo virou moldura — desfoque de
   moldura é enfeite. E era enfeite CARO: com ele, o Chrome decodificava o mesmo clipe DUAS
   vezes por quadro (o do fundo mais o do `Palco`), e esse decode duplo é a maior parte dos
   ~11 s de render por segundo de clipe já medidos nesta máquina. Agora é um decode por
   quadro — e o check 6m do test-preset.mjs CONTA as tags para o segundo não voltar.
   Não trocar por "o próprio vídeo em `cover`, nítido": ampliaria a fonte 3,16x (recorta 68%
   da largura de um 16:9 num 1080x1920) — zoom maior que o 1,45x que já foi removido do Palco,
   e "zoom agressivo" é proibido por escrito na direção BUSINESS_SERIOUS. */
/* A miniatura entra no tamanho de UMA TARJA, repetida em cima e embaixo — não uma esticada
   cobrindo o quadro inteiro.
   Por que mudou (2026-09-01, pedido do usuário olhando um corte real): cobrir 1080x1920
   amplia a miniatura ~3,2x e recorta 68% da largura dela, então cada tarja mostrava uma
   FATIA gigante e ilegível — num caso medido, o título da miniatura aparecia em letras
   enormes, cortado no meio. No tamanho da tarja ela aparece INTEIRA, duas vezes.
   Custo medido: a tarja é 1080x656 (1,65) e a miniatura é 16:9 (1,78), então `cover` corta
   43px de CADA lado (4% da largura) — o preço de não deixar faixa vazia junto do vídeo.
   `banda` 0 é resposta legítima (fonte já vertical enche o quadro): aí não há tarja e não
   se desenha nada, em vez de esconder miniatura atrás do vídeo. */
const Fundo = ({ imagem, banda }) => (
  <AbsoluteFill style={{ backgroundColor: TOKENS.fundo, overflow: "hidden" }}>
    {imagem && banda > 0
      ? ["top", "bottom"].map((borda) => (
        <Img
          key={borda}
          src={imagem}
          style={{
            /* A geometria é INFLADA pelo raio do desfoque, e isso não é folga estética:
               `filter: blur` amostra fora da borda do elemento e o que entra é TRANSPARENTE,
               então a tarja sairia esmaecendo para o fundo nas bordas — vinheta na borda do
               quadro e uma falha clara na fronteira com o vídeo. Inflando e deixando o
               `overflow: hidden` do pai cortar, as bordas esmaecidas caem fora da tela.
               O FFmpeg não tem esse problema: o `gblur` replica a borda em vez de trazer
               transparência. */
            position: "absolute",
            left: -TOKENS.fundoDesfoque,
            [borda]: -TOKENS.fundoDesfoque,
            width: "calc(100% + " + 2 * TOKENS.fundoDesfoque + "px)",
            height: banda + 2 * TOKENS.fundoDesfoque,
            objectFit: "cover",
            /* Desfoque + escurecimento na MINIATURA. O desfoque é o que apaga a manchete
               dela: nítida, ela aparecia legível DUAS vezes e o quadro lia como três imagens
               empilhadas, com dois títulos disputando com a legenda e com o card do título.
               `fundoDesfoque` (28px em CSS) é o MESMO desfoque do `gblur=sigma=14` do
               worker.py — o CSS define blur(r) como gaussiana de desvio padrão r/2 —, e a
               paridade é cobrada por check em unidade convertida, não por igualdade. */
            filter: "blur(" + TOKENS.fundoDesfoque + "px) brightness("
              + TOKENS.fundoLuz + ") saturate(" + TOKENS.fundoSaturacao + ")",
          }}
        />
      ))
      : null}
  </AbsoluteFill>
);

/* No centro do quadro (50%), o MESMO enquadramento do FFmpeg (`overlay=(W-w)/2:(H-h)/2`).
   Era 47% para abrir folga embaixo, porque a legenda ficava pendurada num percentual fixo do
   quadro e caía fora da imagem; agora ela é ancorada ao retângulo do vídeo (prop
   `legendaBase`), a folga vem da própria conta e não há mais motivo para descentralizar.

   O enquadramento vem do `palcoGeometria` (preset.js), função PURA chamada aqui. Escrever o
   estilo à mão nesta linha é o que já deixou três sabotagens passarem com a suíte verde em
   2026-08-27, quando a prova era regex sobre o texto deste arquivo. `blur` devolve a
   geometria de sempre; `crop11`/`crop45` devolvem uma caixa de 1080 x videoAltura com o
   vídeo em `cover`, recortando a FONTE. */
const Palco = ({ src, reframe, altura }) => {
  const geo = palcoGeometria(reframe, altura);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={geo.caixa}>
        {/* `objectFit` é PROP, não estilo: dentro de `style` o @remotion/media o ignora e
            o recorte não acontece (visto no frame). `blur` manda null, e aí a tag fica
            exatamente como era antes desta entrega. */}
        <Video src={src} style={geo.video} objectFit={geo.objectFit || undefined} />
      </div>
    </AbsoluteFill>
  );
};

/* Uma palavra da página. Recebe estilo pronto de propósito: quem decide o que anima é a
   `Legenda` (que tem o relógio), e assim NENHUM hook roda por palavra.
   `inline-block` é o mínimo para `transform` valer num pedaço de texto — e transform não
   participa do layout, então a escala e a subida NÃO mudam a largura da linha nem a quebra.
   O espaço fica FORA do span: dentro de um inline-block ele não é oportunidade de quebra de
   linha, e a legenda deixaria de quebrar onde quebrava antes. */
const Palavra = ({ texto, estilo, espaco }) => (
  <Fragment>
    {espaco ? " " : ""}
    <span style={estilo}>{texto}</span>
  </Fragment>
);

/* Uma página de legenda. A PÁGINA não anima — nem entrada, nem saída, nem posição: o
   espectador vê essa troca dezenas de vezes por corte, e bloco de texto que se mexe o tempo
   todo é o que a direção BUSINESS_SERIOUS proíbe por escrito ("constant text movement").
   O que anima é UMA palavra: a que está sendo dita naquele quadro. Isso tem razão semântica
   (marca onde a fala está, que é a única coisa na tela que muda de significado a cada
   instante) e é o que o usuário pediu explicitamente. Movimento com motivo, não decoração —
   e o botão para desligar o pop e deixar só a cor é o `TOKENS.palavraEscala = 1`.

   `de` é o quadro em que a Sequence desta página começa, no relógio do CORTE. Precisa vir
   por prop porque `useCurrentFrame()` DENTRO de uma Sequence devolve o quadro RELATIVO a
   ela: sem somar `de`, cada página recomeçaria o relógio no zero e a palavra acesa seria
   sempre uma das primeiras. Os tempos das palavras já estão no relógio do corte (o
   `ytclip._lines_from_words_in_range` subtraiu o começo do trecho UMA vez), então aqui só se
   SOMA `de` — nada é subtraído de novo. */
const Legenda = ({ pagina, cor, base, de, aparencia }) => {
  const quadro = useCurrentFrame();
  const { fps } = useVideoConfig();
  /* Relógio do CORTE, a MESMA base dos tempos das palavras. */
  var quadroCorte = quadro + de;
  /* O gate mora no preset.js (`palavrasDaPagina`) e não aqui: escrito à mão neste arquivo,
     ler a chave errada desligava o karaokê em todo corte com as suítes verdes — medido na
     revisão desta entrega. Lá ele é chamado pelo teste com uma página de verdade. */
  var palavras = palavrasDaPagina(pagina);
  var ativa = palavras ? activeWordIndex(palavras, quadroCorte / fps) : -1;
  var conteudo;
  if (palavras) {
    /* Com o karaokê no ar, a ênfase SEMÂNTICA não é aplicada — e isso foi decidido OLHANDO
       o frame, não por gosto. Numa página de `category: money`, o `pickEmphasis` pintava
       "Faturamento" no verde de dinheiro (#8FB573) de forma PERMANENTE, ao lado do verde da
       palavra sendo dita (#59E36A): duas cores de destaque na mesma tela, que é literalmente
       o que o comentário do `destaqueGanho` proíbe ("viram semáforo e a hierarquia some"), e
       o pedido é explícito em que só a palavra corrente fica verde.
       A ênfase NÃO foi removida do projeto: ela continua inteira no caminho ESTÁTICO abaixo
       (corte antigo, legenda corrigida na mão, legenda manual) e no ASS do FFmpeg, que é
       onde ela foi desenhada para viver. Se um dia se quiser as duas juntas, o conserto é
       voltar o ramo `i === indice` aqui — mas então escolha outra cor para uma das duas. */
    conteudo = palavras.map(function (palavra, i) {
      var estilo = { display: "inline-block" };
      if (i === ativa) {
        /* A mola começa no quadro em que ESTA palavra ficou ativa, não no começo da
           página: senão a primeira palavra popparia e as outras entrariam já assentadas. */
        var progresso = spring({
          frame: quadroCorte - Math.round(Number(palavra.start) * fps),
          fps,
          config: MOLA_PALAVRA,
        });
        var pop = popPalavra(progresso, aparencia);
        estilo.color = aparencia.palavraCor;
        estilo.transform = "translateY(" + pop.subida + "px) scale(" + pop.escala + ")";
        /* Perto da BASE da palavra: o crescimento e a subida saem do pé do texto, então a
           linha de leitura não desce quando a palavra cresce. */
        estilo.transformOrigin = "50% 85%";
      }
      return <Palavra key={i} texto={palavra.text} estilo={estilo} espaco={i > 0} />;
    });
  }
  /* O caminho estático continua idêntico ao de antes: só é montado quando não há karaokê. */
  var indice = palavras ? -1 : pickEmphasis(pagina.text);
  var pedacos = palavras ? [] : splitEmphasis(pagina.text, indice);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          /* Ancorada pela BASE, não pelo topo, e é o mesmo motivo do `Alignment 2` do ASS:
             pendurada pelo topo, uma página de 2 linhas desce ~68px a mais que uma de 1 linha
             e a linha de leitura PULA a cada troca de página — movimento constante de texto,
             proibido por escrito na direção BUSINESS_SERIOUS. Pela base, o pé do texto fica
             parado e é a página que cresce para cima.
             O número vem do servidor (`captions.margem_inferior`), o mesmo que o FFmpeg usa. */
          bottom: base,
          left: (TOKENS.largura - TOKENS.legendaLargura) / 2,
          width: TOKENS.legendaLargura,
          textAlign: "center",
          /* A TIPOGRAFIA toda vem do estilo resolvido (`LEGENDA_PRESETS`), nao mais dos
             tokens globais: e o que permite um segundo estilo existir sem um `if` aqui
             dentro. A GEOMETRIA acima (largura da coluna e ancora) continua global de
             proposito — ela e limite de plataforma, nao gosto. */
          fontFamily: familiaDo(aparencia),
          fontWeight: aparencia.peso,
          fontSize: aparencia.fonte,
          lineHeight: aparencia.entrelinha,
          letterSpacing: aparencia.tracking,
          /* Caixa alta pelo CSS, e nunca maiusculizando a STRING da fala: assim o texto
             que atravessa o pipeline continua sendo a fala como ela foi dita (e o que a
             correcao na mao e o caminho FFmpeg/ASS leem), e a caixa e decisao de APARENCIA,
             desfeita trocando o estilo. O check 15i6 cobra as duas metades. */
          textTransform: aparencia.caixaAlta ? "uppercase" : "none",
          color: aparencia.cor,
          textShadow: aparencia.sombra,
          /* Reparte as duas linhas em vez de deixar uma cheia e uma com duas palavras. */
          textWrap: "balance",
        }}
      >
        {/* Sem tempo por palavra (sidecar antigo, legenda corrigida na mão, legenda
            manual), cai no caminho ESTÁTICO de sempre, sem uma linha de diferença. */}
        {conteudo || pedacos.map(function (pedaco, i) {
          if (!pedaco.forte) return <span key={i}>{pedaco.texto}</span>;
          return (
            <span
              key={i}
              style={{
                color: cor,
                /* O peso do destaque e do ESTILO: no `impacto` a familia tem um peso so, e
                   pedir 900 dela faria o Chrome sintetizar negrito borrado sobre um preto
                   que ja e maximo. La a enfase e cor, como no card `primo_rico`. */
                fontWeight: aparencia.pesoDestaque,
                /* SEM escala, de propósito. `transform: scale(1.05)` cresce o glifo mas não
                   a caixa de layout: numa palavra longa os 5% transbordam ~17px e comem o
                   espaço seguinte — "Faturamento não" renderizou "Faturamentonão". Visto no
                   frame, não no teste. Cor mais peso 900 já carregam a ênfase, e a spec pede
                   escala como opção ("may receive"), não como obrigação. */
                letterSpacing: "-0.005em",
              }}
            >
              {pedaco.texto}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* O card da marca: a placa do canal, o título e o filete. Fica no topo, longe da legenda e
   longe da zona de interface das plataformas. Vazio por padrão — o pipeline não inventa
   manchete, e sem título o card inteiro não é montado.
   Era um `<span>` branco solto sobre o vídeo, sem nenhuma amarra com o canal. O card resolve
   três coisas de uma vez: dá contraste garantido sobre quadro claro E escuro (o texto sobre
   vídeo dependia da sombra e sumia em camisa branca), põe a marca no quadro, e cria a
   hierarquia que o título sozinho não tinha.
   DUAS identidades, escolhidas pelo operador por clip (`titleCardStyle`) e resolvidas em
   `TITLE_CARD_PRESETS` (preset.js). Elas divergem no que é IDENTIDADE — placa,
   identificador, cor da borda, cor do filete e a aparência do destaque — e mais nada:
   - `primo_rico`: preto e laranja, e o destaque do título é COR (#FF5F01 medido na
     referência). Peso igual ao do resto: cor + 8% de corpo já carregam a ênfase.
   - `puro_ecommerce`: MONOCROMÁTICO por medição, não por gosto — o logo de referência tem
     0 pixels cromáticos, então não existe cor de marca para extrair dele. Sem cor, a
     hierarquia é peso (800 -> 900), corpo (+8%) e o filete branco.
   A geometria (tamanho, respiro, raio, sombra, posição, janela de 4s) e o ALGORITMO de
   destaque são compartilhados — é o mesmo card vestido de duas formas, não dois cards.

   `fonte` chega pronta do `tituloEscalonado` (preset.js) em vez de ser calculada aqui: é
   lógica pura, e provada por execução lá em vez de por regex sobre este arquivo. E o mesmo
   vale para o `card`: quem escolhe a identidade é o `titleCardPreset`, não um `if` aqui. */
/* Ease-out FORTE — o `cubic-bezier(.23,1,.32,1)`, não o `ease-out` nativo, que é fraco
   demais para parecer intencional. Nunca `ease-in`: começar devagar no instante em que o
   espectador está olhando é o que faz algo parecer lento. Curva e não `spring`: mola tem
   sobressalto e este card não pode quicar (o pedido proíbe por escrito). A mola fica na
   palavra da legenda, onde o sobressalto É o recurso. */
const SUAVE = Easing.bezier(0.23, 1, 0.32, 1);

const CardTitulo = ({ texto, destaque, fonte, total, card }) => {
  /* A identidade chega RESOLVIDA (o `titleCardPreset` já rodou no `Clip`), e a placa sai do
     registro por `card.marca`. Nenhum `if` de marca neste arquivo: é o que garante que uma
     marca não possa usar o asset, o identificador ou a paleta da outra. */
  const marca = MARCAS[card.marca];
  /* Dentro da Sequence, `useCurrentFrame()` já é o quadro RELATIVO ao card — é justamente
     por isso que ele mora numa: a janela de 4s vira a origem do relógio, e entrada e saída
     não precisam saber em que ponto do clipe estão. */
  const quadro = useCurrentFrame();
  /* Quem decide quanto do card está no ar é o `presencaCard` (preset.js), função pura
     provada por execução. A curva entra DEPOIS, sobre o valor linear: escrita à mão aqui,
     a rampa de saída invertida deixaria o card invisível por 3,8s dos 4s, sem erro nenhum. */
  const entrada = entradaCard(SUAVE(presencaCard(quadro, total)));
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          /* No MEIO do quadro. O card é uma chamada de 4s, não um rótulo: no centro ele é a
             primeira coisa que o olho encontra. `translate(-50%,-50%)` centra pelo próprio
             tamanho, então ele cresce para os dois lados e a posição não depende de quantas
             linhas o título tem. */
          left: "50%",
          top: TOKENS.cardCentroPct * 100 + "%",
          boxSizing: "border-box",
          width: TOKENS.cardLargura,
          padding: TOKENS.cardPadding,
          /* Abre espaço para o filete, que ocupa largura real. O `larguraTitulo()` do
             preset.js desconta exatamente isto — as duas contas têm que casar, senão a
             estimativa de linhas mente para mais. */
          paddingLeft: TOKENS.cardPadding + TOKENS.tituloFilete,
          borderRadius: TOKENS.cardRaio,
          backgroundColor: TOKENS.cardFundo,
          /* A cor da borda é da MARCA (laranja no Primo Rico, branca a 14% no Ecommerce
             Puro); a espessura, o raio, o fundo e a sombra são compartilhados — é o mesmo
             card, vestido de duas formas, e não dois cards. */
          border: TOKENS.cardBordaPeso + "px solid " + card.bordaCor,
          boxShadow: TOKENS.cardSombra,
          opacity: entrada.opacidade,
          /* Só `opacity` e `transform`: são as duas propriedades que não repaginam layout.
             Animar padding ou altura aqui custaria layout em todo quadro do render.
             O `-50%` de cada eixo é a centralização (não é animação); o que se move é o
             `entrada.subida`, somado dentro do mesmo `translate`. */
          transform: "translate(-50%, calc(-50% + " + entrada.subida + "px))"
            + " scale(" + entrada.escala + ")",
          /* Do CENTRO, porque é por ali que o card está ancorado agora. Ancorado no meio e
             escalando a partir do topo, ele pareceria escorregar para baixo ao entrar. */
          transformOrigin: "50% 50%",
          overflow: "hidden",
        }}
      >
        {/* O filete. É a MESMA régua que ladeia o `PURO` no logo e a mesma espessura do
            sublinhado do destaque (`tituloFilete`), de propósito: uma linguagem só de
            destaque no quadro, não três larguras diferentes de linha branca.
            Recuado em cima e embaixo pelo padding — colado nas quinas ele brigaria com o
            arredondamento do card. */}
        <div
          style={{
            position: "absolute", left: 0,
            top: TOKENS.cardPadding, bottom: TOKENS.cardPadding,
            width: TOKENS.tituloFilete, backgroundColor: card.fileteCor,
          }}
        />
        {/* Emblema + identificador. `Img` do Remotion e não `<img>`: o Img segura a captura
            do quadro (delayRender) até a imagem carregar — com a tag crua os primeiros
            quadros saem SEM a marca, e isso só aparece olhando o frame 0. A fonte é um data
            URI embutido (marca.js), porque o `--public-dir` do render aponta para o cache do
            YouTube e `staticFile()` não alcança o repositório.
            A largura sai da PROPORÇÃO do arquivo: fixar os dois lados distorceria a marca —
            e num emblema CIRCULAR isso viraria elipse, que é o erro mais visível que existe
            num logo. */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 16,
            marginBottom: TOKENS.logoFolga,
          }}
        >
          <Img
            src={marca.badge}
            style={{
              display: "block",
              height: TOKENS.logoAltura,
              width: TOKENS.logoAltura * marca.proporcao,
            }}
          />
          {/* O identificador é SECUNDÁRIO ao título, e é o tamanho e a opacidade que dizem
              isso — não uma cor a menos. Em branco a 72% e não em laranja: o emblema, a
              borda, o filete e o trecho destacado já são laranja; um quinto elemento na cor
              da marca faria o card competir consigo mesmo. Caixa alta com espacejamento
              aberto é o que faz três palavras pequenas lerem como assinatura, e não como
              uma frase que alguém esqueceu de terminar.
              AUSENTE é desfecho legítimo, não campo esquecido: a placa do Ecommerce Puro JÁ
              traz o wordmark `ECOMMERCE`/`PURO`, e escrever o nome do canal ao lado dele o
              diria duas vezes no mesmo card. Por isso o teste é sobre o nome ter conteúdo, e
              não um `if` de marca — trocar a marca não pode acender texto que a placa dela
              já contém. */}
          {marca.nome
            ? (
              <span
                style={{
                  fontFamily: INTER, fontWeight: 700, fontSize: TOKENS.marcaNomeFonte,
                  letterSpacing: "0.14em", color: card.identificadorCor,
                  whiteSpace: "nowrap",
                }}
              >
                {marca.nome}
              </span>
            )
            : null}
        </div>
        <div
          style={{
            /* O peso BASE é da marca: 900 (Inter Black) no Primo Rico, onde o destaque é
               cor, e 800 no Ecommerce Puro, onde o destaque é o próprio 900 — base e
               destaque no mesmo peso não deixariam nada destacado. */
            fontFamily: INTER, fontWeight: card.tituloPeso, fontSize: fonte,
            lineHeight: TOKENS.tituloEntrelinha, color: TOKENS.texto,
            /* À esquerda, alinhado com a marca e com o filete. Centrado, o texto flutuava
               solto do card e nada no bloco tinha uma margem em comum. */
            textAlign: "left", textWrap: "balance", letterSpacing: "-0.01em",
            /* SEM `textShadow`: aqui o contraste vem do card. A sombra existia para o texto
               sobreviver sobre o vídeo, e efeito que perdeu a função é enfeite. */
          }}
        >
          {/* Sem trecho destacado isto devolve UM pedaço com `forte: false`, e o título sai
              exatamente como saía antes deste recurso existir. */}
          {splitTitleHighlight(texto, destaque).map(function (pedaco, indice) {
            if (!pedaco.forte) return <Fragment key={indice}>{pedaco.texto}</Fragment>;
            return (
              <span
                key={indice}
                style={{
                  /* A APARÊNCIA do destaque é da marca, e o ALGORITMO que escolheu este
                     trecho é compartilhado (`resolveTitleHighlight`/`splitTitleHighlight`) —
                     é essa separação que faz as duas identidades destacarem sempre o MESMO
                     trecho da mesma manchete, e só vesti-lo de forma diferente.
                     Uma cor por card: duas viram semáforo, a mesma razão pela qual a legenda
                     usa uma cor de ênfase por vez. No Ecommerce Puro esta cor é o próprio
                     branco do título, porque lá o sinal é o peso. */
                  color: card.destaque.cor,
                  /* No Primo Rico é o MESMO peso do título (a cor já carrega a ênfase, e
                     somar peso diria a mesma coisa duas vezes); no Ecommerce Puro é o degrau
                     acima, porque sem cor de marca o peso é o único sinal que sobra. */
                  fontWeight: card.destaque.peso,
                  /* Cresce por `fontSize` e não por `transform: scale`: scale cresce o glifo
                     e não a caixa, e o texto vizinho é comido — armadilha já medida neste
                     projeto ("Faturamentonão"). Em `em` para acompanhar o degrau da escada. */
                  fontSize: TOKENS.tituloDestaqueFator + "em",
                  /* O sublinhado só existe na marca monocromática, onde o peso sozinho é
                     sutil demais a 32px. `text-decoration` e NÃO um retângulo posicionado:
                     é o que faz o filete acompanhar o trecho quando ele QUEBRA entre duas
                     linhas (medido — um retângulo sublinharia o vão).
                     Em `em` e nunca em px: com a escada descendo a 32px, 4px fixos deixavam
                     0,7px de folga até os acentos da linha de baixo. */
                  ...(card.destaque.sublinhado
                    ? {
                      textDecoration: "underline",
                      textDecorationThickness:
                        (TOKENS.tituloFilete / TITULO_FILETE_REF).toFixed(4) + "em",
                      textUnderlineOffset: "0.16em",
                    }
                    : null),
                }}
              >
                {pedaco.texto}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Vazio = () => (
  <AbsoluteFill
    style={{
      backgroundColor: TOKENS.fundo, color: TOKENS.texto, fontFamily: INTER,
      fontSize: 44, fontWeight: 600, alignItems: "center", justifyContent: "center",
      padding: 90, textAlign: "center", lineHeight: 1.3,
    }}
  >
    Nenhum trecho carregado. Aprove um corte no Estúdio e clique em “Baixar trecho”.
  </AbsoluteFill>
);

export const Clip = ({
  clipFile, backgroundFile, legendaBase, bandaAltura, cues, title,
  highlightText, autoHighlight, titleCardStyle, legendaStyle, preset, category,
  reframe, videoAltura,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  /* Janela do card. `Math.min` com a duração da composição porque um clipe de 2s não pode
     hospedar uma Sequence de 4s; `Math.max(1, …)` porque Sequence de zero quadro é inválida
     e derrubaria o render inteiro por causa de um card. */
  const cardQuadros = Math.max(1, Math.min(
    Math.round(TOKENS.cardDuracaoSeg * fps), durationInFrames));
  /* Antes do early-return: hook não pode ser condicional. Só serve para o aviso abaixo
     sair UMA vez por render, e não uma vez por quadro. */
  const quadro = useCurrentFrame();
  if (!clipFile) return <Vazio />;

  const src = staticFile(clipFile);
  /* Nome de arquivo dentro do --public-dir, como o clipFile — nunca caminho de disco. Vem
     vazio quando o download não trouxe miniatura, e aí o Fundo pinta só a cor do preset. */
  const fundo = backgroundFile ? staticFile(backgroundFile) : "";
  const escolhido = normalizarPreset(preset);
  const comLegenda = escolhido === "BUSINESS_SERIOUS";
  const cor = corDoDestaque(category);
  /* A aparência resolvida UMA vez, e é o MESMO objeto que corta as páginas e que o
     componente recebe. Resolver duas vezes deixaria o teto de caracteres e a fonte poderem
     discordar — páginas cortadas para 58px desenhadas a 72px, que é uma linha estourando a
     coluna sem erro nenhum. */
  const aparencia = legendaPreset(legendaStyle);
  /* Fatiar a fala em páginas curtas é lógica pura e mora no preset.js, provada por
     test-preset.mjs — aqui só vira Sequence.
     O teto vem do ESTILO (`tetoDaPagina`), não mais da constante: caixa alta a 72px é ~22%
     mais larga por caractere que a caixa baixa a 58px, e cortar as duas com o mesmo número
     é o estouro de coluna garantido. */
  const paginas = comLegenda ? toCaptionPages(cues, tetoDaPagina(aparencia)) : [];
  /* Gate do destaque do título = `resolveTitleHighlight` (preset.js), chamado AQUI. Escrito
     à mão nesta linha, trocá-lo por uma chave que não existe desligaria o destaque em TODO
     título, calado e com a suíte verde — a mesma armadilha do `ancoraLegenda`. */
  const opcoesTitulo = { highlightText, autoHighlight };
  /* Duas passadas, e a ordem importa: mede com o destaque do texto INTEIRO (os tokens dele
     pesam mais, porque saem maiores), depois resolve o destaque sobre o texto FINAL. Só
     resolver antes daria índices de token errados no caso raro em que o título é aparado —
     e só resolver depois mediria o destaque como se fosse texto normal. */
  const medida = tituloEscalonado(title, resolveTitleHighlight(title, opcoesTitulo).span);
  const destaque = resolveTitleHighlight(medida.texto, opcoesTitulo);
  /* A identidade resolvida UMA vez, e é o mesmo valor que o portão abaixo consulta e que o
     componente recebe — resolver duas vezes deixaria o portão e o card poderem discordar.
     `null` = o operador escolheu "Sem card": desfecho legítimo, e por isso ele entra no
     PORTÃO em vez de virar `card.marca` de `null` dentro do JSX, que derrubaria o render. */
  const cardMarca = titleCardPreset(titleCardStyle);
  /* Único lugar em que este render tem como falar com uma pessoa: o log. Trecho digitado
     que não bate com o título não destaca nada, e ficar calado é indistinguível de recurso
     quebrado (BP-008). */
  if (quadro === 0 && destaque.origem === "manual-sem-correspondencia") {
    console.warn("[titulo] highlightText nao encontrado no titulo, nada destacado:", highlightText);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.fundo }}>
      {/* Gate do prop = `ancoraBanda` (preset.js), chamado AQUI. Escrito à mão nesta linha,
          trocá-lo por um `bandaAltura` cru deixaria `height: undefined` e o fundo sumiria
          em TODO corte, sem erro nenhum — a armadilha que já criou o `ancoraLegenda`. */}
      <Fundo imagem={fundo} banda={ancoraBanda(bandaAltura)} />
      {/* Gate do enquadramento = `palcoGeometria` (preset.js), que valida o `reframe` e
          usa o `ancoraVideo` na altura. Passar os props CRUS aqui e resolver dentro do
          componente daria no mesmo, mas tirar um deles desta linha deixaria o palco no
          padrao calado -- e ha check chamando a funcao pura justamente por isso. */}
      <Palco src={src} reframe={reframe} altura={videoAltura} />
      {/* O card entra, fica 4s e SAI — é chamada e miniatura, não rótulo permanente. Uma
          `Sequence` e não um `opacity: 0` no fim: passados os 4s não sobra elemento na
          árvore para custar quadro, e o relógio dela é o que a entrada/saída lê.
          Clipe mais curto que a janela encurta o card junto (`Math.min`), senão a Sequence
          se estenderia além da composição e o Remotion recusaria o render. */}
      {comLegenda && medida.texto && cardMarca
        ? (
          <Sequence from={0} durationInFrames={cardQuadros} layout="none">
            <CardTitulo
              texto={medida.texto} destaque={destaque.span} fonte={medida.fonte}
              total={cardQuadros} card={cardMarca}
            />
          </Sequence>
        )
        : null}
      {paginas.map(function (pagina, indice) {
        const de = Math.round(pagina.start * fps);
        const duracao = Math.round((pagina.end - pagina.start) * fps);
        /* Página de duração zero viraria Sequence inválida e derrubaria o render inteiro
           por causa de uma linha de legenda torta. */
        if (duracao <= 0 || de < 0) return null;
        return (
          <Sequence key={indice} from={de} durationInFrames={duracao} layout="none">
            {/* Guarda do prop = `ancoraLegenda` (preset.js), chamada AQUI: numa variável
                local, tirar este argumento deixava `bottom: undefined` — o React descarta a
                propriedade e a legenda sai da âncora — sem nenhum check reprovar. */}
            <Legenda pagina={pagina} cor={cor} base={ancoraLegenda(legendaBase)}
              de={de} aparencia={aparencia} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
