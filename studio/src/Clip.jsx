import { Fragment } from "react";
import {
  AbsoluteFill, Easing, Img, Sequence, spring, staticFile, useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { loadFont as carregarInter } from "@remotion/google-fonts/Inter";
/* A segunda FAMILIA do projeto, e a primeira que nao e Inter: ela e o estilo `impacto` da
   legenda. Nenhuma dependencia nova entra por causa dela — o `@remotion/google-fonts` ja
   estava no package.json desde a Inter, e este import e mais um modulo de dentro dele. */
import { loadFont as carregarMontserrat } from "@remotion/google-fonts/Montserrat";
import {
  TOKENS, corDoDestaque, toCaptionPages, pickEmphasis, splitEmphasis,
  ancoraLegenda, LEGENDA_BASE_PADRAO, ancoraBanda, BANDA_PADRAO,
  activeWordIndex, popPalavra, corDaPalavra, MOLA_PALAVRA,
  palavrasDaPagina, resolveTitleHighlight, splitTitleHighlight,
  tituloEscalonado, entradaCard, presencaCard,
  cardOf, titleCardStyleOf, TITLE_CARD_PADRAO, TITLE_CARD_SEM, CARD_EXEMPLO,
  TITULO_FILETE_REF,
  palcoGeometria, REFRAME_PADRAO, VIDEO_ALTURA_PADRAO,
  resolveLegenda, tetoDaPagina, LEGENDA_PADRAO, contornoPx, caixaLegenda,
  profundidadeLegenda, esquerdaLegenda,
  CAPA_ESTILO_DEF, CAPA_ENTRELINHA, CAPA_FOLGA_DEGRADE, CAPA_ZONAS, capaTitulo, capaBloco,
  volumeMusica, textoFixoEstilo, opacidadeTexto, escalaZoom,
} from "./preset.js";
/* Só os pesos usados. Cada peso extra é um arquivo a mais que o render espera carregar antes
   do primeiro frame.
   Esta lista É o `CARD_PESOS` do preset.js, e o check 9w amarra as duas pontas: o editor de
   cards oferece exatamente estes números porque um peso NÃO carregado é SINTETIZADO pelo
   Chrome — sai um engrossamento borrado, sem erro e sem check reprovando, visível só olhando
   o quadro. Mesma FAMÍLIA (Inter), nenhuma dependência nova. */
const { fontFamily: INTER } = carregarInter("normal", {
  weights: ["600", "700", "800", "900"], subsets: ["latin"],
});
/* Corpo e destaque Montserrat usam 800; não há linha secundária que peça 500/600.
   Pedir peso que não foi carregado sintetiza negrito e borra a captura.
   `latin` basta para o portugues: o bloco cobre U+0000-00FF, ou seja A-Z, acentos, C-cedilha
   e til. Subset a mais e arquivo a mais para o render esperar antes do primeiro quadro. */
const { fontFamily: MONTSERRAT } = carregarMontserrat("normal", {
  weights: ["800"], subsets: ["latin"],
});

/* O id que o preset da legenda pede -> a familia carregada aqui. E um REGISTRO, e nao um
   `if` dentro do componente, pela razao de sempre neste arquivo: fiacao escrita a mao no JSX
   e onde a escolha erra calada (`ancoraLegenda`, `palavrasDaPagina`, `presencaCard`).
   Id ausente do mapa cai na Inter em vez de `undefined`: `fontFamily: undefined` faz o
   Chrome desenhar na fonte padrao DELE — legivel, sem erro, e fora da identidade. O check
   15g cobra que todo id do `LEGENDA_FAMILIAS` tenha entrada aqui. */
const FAMILIAS = { inter: INTER, montserrat: MONTSERRAT };
const familiaDo = (estilo) => FAMILIAS[estilo && estilo.familia] || INTER;

/* Montserrat pertence à legenda; os dois cards continuam em Inter. As placas são curvas. */

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
  /* SE este corte tem card. Conjunto fechado (`personalizado` | `nenhum`), padrão do
     preset.js, e valor torto não chega ao JSX: o `titleCardStyleOf` o normaliza. */
  titleCardStyle: TITLE_CARD_PADRAO,
  /* QUAL card ele veste — dado, e não enum: a biblioteca é do operador e mora no navegador.
     Este exemplo existe para o Remotion Studio abrir MOSTRANDO um card (o mesmo motivo do
     `title` acima) e é só TEXTO: nenhum asset de marca volta ao repositório por esta porta.
     Não vaza para render nenhum — o `render_props` do serve.py SEMPRE manda a chave `card`,
     e prop mandado vence defaultProp. Valor torto não chega ao JSX: o `cardOf` o valida. */
  card: CARD_EXEMPLO,
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
const Palco = ({ src, reframe, altura, zooms }) => {
  const geo = palcoGeometria(reframe, altura);
  const quadro = useCurrentFrame();
  const { fps } = useVideoConfig();
  /* `objectFit` é PROP, não estilo: dentro de `style` o @remotion/media o ignora e o recorte
     não acontece (visto no frame). `blur` manda null, e aí a tag fica exatamente como era. */
  const video = <Video src={src} style={geo.video} objectFit={geo.objectFit || undefined} />;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={geo.caixa}>
        {/* Zoom pontual (2026-09-30): SÓ a camada do vídeo escala, centrada, num contêiner que
            CORTA o excesso (legenda, textos, card e fundo intocados). Sem zoom, a árvore é a de
            sempre — os stills de controle saem com o mesmo hash. */}
        {Array.isArray(zooms) && zooms.length ? (
          <div style={{ overflow: "hidden", lineHeight: 0 }}>
            <div style={{ transform: "scale(" + escalaZoom(quadro, zooms, fps) + ")", transformOrigin: "50% 50%" }}>
              {video}
            </div>
          </div>
        ) : video}
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
const Legenda = ({ pagina, cor, base, esquerda, de, aparencia }) => {
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
       "Faturamento" no verde de dinheiro (#8FB573) de forma PERMANENTE, ao lado da cor da
       palavra sendo dita: duas cores de destaque na mesma tela, que é literalmente
       o que o comentário do `destaqueGanho` proíbe ("viram semáforo e a hierarquia some"), e
       o pedido é explícito em que só a palavra corrente fica colorida. Com o leque de
       2026-09-11 no ar o argumento só ficou mais forte: a página já tem até cinco matizes.
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
        estilo.color = corDaPalavra(aparencia, i);
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
          /* Borda esquerda do servidor (`captions.coluna_x`, a MESMA do MarginL do ASS)
             ou, sem posição lateral manual, a centralizada de sempre — `esquerdaLegenda`. */
          left: esquerda,
          width: aparencia.largura || TOKENS.legendaLargura,
          textAlign: aparencia.alinhamento || "center",
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
          /* Contorno: o traço é centrado no desenho da letra, e `paint-order` o põe POR
             BAIXO do preenchimento — só a metade de fora aparece, e a letra não afina. */
          ...(aparencia.contorno
            ? { WebkitTextStroke: contornoPx(aparencia) + "px " + aparencia.contorno,
              paintOrder: "stroke fill" }
            : null),
          /* Reparte as duas linhas em vez de deixar uma cheia e uma com duas palavras. */
          textWrap: "balance",
          /* PROFUNDIDADE: inclinação pela base + volume. Sai inteira do preset.js; Nenhuma
             devolve `{}` e o bloco fica com exatamente as propriedades de antes. */
          ...profundidadeLegenda(aparencia),
        }}
      >
        <CaixaLegenda estilo={caixaLegenda(aparencia)}>
        {/* Sem tempo por palavra (sidecar antigo, legenda corrigida na mão, legenda
            manual), cai no caminho ESTÁTICO de sempre, sem uma linha de diferença. */}
        {conteudo || pedacos.map(function (pedaco, i) {
          if (!pedaco.forte) return <span key={i}>{pedaco.texto}</span>;
          return (
            <span
              key={i}
              style={{
                color: aparencia.destaqueCor || cor,
                /* O peso vem do estilo e sempre existe no carregamento da família. */
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
        </CaixaLegenda>
      </div>
    </AbsoluteFill>
  );
};

/* Sem caixa, nenhum nó a mais: a página sem fundo sai com a MESMA árvore de antes. */
const CaixaLegenda = ({ estilo, children }) => (
  estilo ? <span style={estilo}>{children}</span> : <Fragment>{children}</Fragment>
);

/* O card do título: a placa, o identificador, a manchete e o filete. Fica no meio do quadro,
   longe da legenda e longe da zona de interface das plataformas. Vazio por padrão — o
   pipeline não inventa manchete, e sem título o card inteiro não é montado.
   Era um `<span>` branco solto sobre o vídeo, sem nenhuma amarra com o canal. O card resolve
   três coisas de uma vez: dá contraste garantido sobre quadro claro E escuro (o texto sobre
   vídeo dependia da sombra e sumia em camisa branca), põe a identidade no quadro, e cria a
   hierarquia que o título sozinho não tinha.
   A IDENTIDADE é DADO, e chega pronta: o card vem da biblioteca que o operador construiu no
   site, atravessa o POST e é validado pelo `cardOf` (preset.js) antes de virar props. Aqui
   dentro não há `if` de identidade NENHUM, e é isso que garante que um card não possa usar a
   placa, o identificador nem a paleta de outro — fiação escrita à mão neste arquivo é
   exatamente o que já passou verde e saiu errado no frame três vezes (`ancoraLegenda`,
   `palavrasDaPagina`, `presencaCard`).
   A geometria (tamanho, respiro, raio, sombra, posição, janela de 4s) e o ALGORITMO de
   destaque são compartilhados por TODO card — é uma caixa só, vestida de muitas formas.

   `fonte` chega pronta do `tituloEscalonado` (preset.js) em vez de ser calculada aqui: é
   lógica pura, e provada por execução lá em vez de por regex sobre este arquivo. */
/* Ease-out FORTE — o `cubic-bezier(.23,1,.32,1)`, não o `ease-out` nativo, que é fraco
   demais para parecer intencional. Nunca `ease-in`: começar devagar no instante em que o
   espectador está olhando é o que faz algo parecer lento. Curva e não `spring`: mola tem
   sobressalto e este card não pode quicar (o pedido proíbe por escrito). A mola fica na
   palavra da legenda, onde o sobressalto É o recurso. */
const SUAVE = Easing.bezier(0.23, 1, 0.32, 1);

const CardTitulo = ({ texto, destaque, fonte, total, card }) => {
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
          /* A cor da borda é do CARD; a espessura, o raio, o fundo e a sombra são
             compartilhados — é uma caixa só, vestida de muitas formas. */
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
        {/* Placa + identificador. `Img` do Remotion e não `<img>`: o Img segura a captura
            do quadro (delayRender) até a imagem carregar — com a tag crua os primeiros
            quadros saem SEM a placa, e isso só aparece olhando o frame 0. O `src` é um data
            URI, e é a única forma aceita (validada no `cardOf` e no `card_of`): o
            `--public-dir` do render aponta para o cache do YouTube e `staticFile()` não
            alcança o repositório, então endereço remoto ou falharia ou viraria busca de rede
            no meio da captura.
            SEM logo não se monta `Img` nenhum: um `src` vazio é um pedido de rede para a
            própria página, que o delayRender esperaria e o quadro sairia com imagem
            quebrada. O `cardOf` garante que um card sem logo tem identificador.
            A largura sai da PROPORÇÃO medida no arquivo: fixar os dois lados distorceria a
            placa — e num emblema CIRCULAR isso viraria elipse, o erro mais visível que
            existe num logo. */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 16,
            marginBottom: TOKENS.logoFolga,
          }}
        >
          {card.logo
            ? (
              <Img
                src={card.logo}
                style={{
                  display: "block",
                  height: TOKENS.logoAltura,
                  width: TOKENS.logoAltura * card.logoProporcao,
                }}
              />
            )
            : null}
          {/* O identificador é SECUNDÁRIO ao título, e é o tamanho e a opacidade que dizem
              isso — não uma cor a menos. Caixa alta com espacejamento aberto é o que faz três
              palavras pequenas lerem como assinatura, e não como uma frase que alguém
              esqueceu de terminar.
              AUSENTE é desfecho legítimo, não campo esquecido: uma placa que já traz o
              wordmark diria o nome do canal duas vezes no mesmo card. Por isso o teste é
              sobre o CAMPO ter conteúdo, e não um `if` de identidade — trocar de card não
              pode acender texto que a placa dele já contém. */}
          {card.identificador
            ? (
              <span
                style={{
                  fontFamily: INTER, fontWeight: 700, fontSize: TOKENS.marcaNomeFonte,
                  letterSpacing: "0.14em", color: card.identificadorCor,
                  whiteSpace: "nowrap",
                }}
              >
                {card.identificador}
              </span>
            )
            : null}
        </div>
        <div
          style={{
            /* O peso BASE é do CARD, e sai de um conjunto FECHADO (`CARD_PESOS`) que é
               exatamente o que o `loadFont` acima carrega: peso não carregado o Chrome
               sintetiza, e sai um engrossamento borrado sem erro nenhum. */
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
                  /* A APARÊNCIA do destaque é do CARD, e o ALGORITMO que escolheu este
                     trecho é compartilhado (`resolveTitleHighlight`/`splitTitleHighlight`) —
                     é essa separação que faz TODO card destacar o MESMO trecho da mesma
                     manchete, e só vesti-lo de forma diferente.
                     Uma cor por card: duas viram semáforo, a mesma razão pela qual a legenda
                     usa uma cor de ênfase por vez. */
                  color: card.destaqueCor,
                  /* Mesmo peso do título quando o sinal é a cor; um degrau acima quando o
                     operador quiser o destaque por PESO. Os dois vêm do `CARD_PESOS`. */
                  fontWeight: card.destaquePeso,
                  /* Cresce por `fontSize` e não por `transform: scale`: scale cresce o glifo
                     e não a caixa, e o texto vizinho é comido — armadilha já medida neste
                     projeto ("Faturamentonão"). Em `em` para acompanhar o degrau da escada. */
                  fontSize: TOKENS.tituloDestaqueFator + "em",
                  /* O sublinhado é o terceiro sinal, e é opcional de propósito: resolve o
                     card monocromático, onde o peso sozinho é sutil demais a 32px, e vira
                     ruído onde já há cor. `text-decoration` e NÃO um retângulo posicionado:
                     é o que faz o filete acompanhar o trecho quando ele QUEBRA entre duas
                     linhas (medido — um retângulo sublinharia o vão).
                     Em `em` e nunca em px: com a escada descendo a 32px, 4px fixos deixavam
                     0,7px de folga até os acentos da linha de baixo. */
                  ...(card.destaqueSublinhado
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

/* Texto fixo na tela (2026-09-30): ESTÁTICO. Só a opacidade entra e sai (até 150 ms, pela
   função pura do preset); nenhuma transformação. O relógio é o da Sequence (relativo). */
const TextoFixo = ({ texto, quadros }) => {
  const quadro = useCurrentFrame();
  const { fps } = useVideoConfig();
  const estilo = textoFixoEstilo(texto);
  return (
    <div style={{ ...estilo.bloco, opacity: opacidadeTexto(quadro, quadros, fps) }}>
      <span style={{ ...estilo.texto, fontFamily: INTER }}>{texto.texto}</span>
    </div>
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
  highlightText, autoHighlight, titleCardStyle, card, legendaStyle, preset, category,
  reframe, videoAltura, edit, legendaEsquerda, legendaColuna, musica, textos, zooms,
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
  const aparencia = resolveLegenda(legendaStyle, edit, legendaColuna);
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
  /* O card resolvido UMA vez, e é o mesmo valor que o portão abaixo consulta e que o
     componente recebe — resolver duas vezes deixaria o portão e o card poderem discordar.
     DUAS camadas, e as duas são entrada: o ENUM diz se este corte tem card (`nenhum` é
     escolha do operador), e o `cardOf` diz se o objeto que veio junto é um card de verdade.
     `null` é desfecho legítimo nos dois caminhos — "Sem card" e "o card que este corte
     apontava foi apagado da biblioteca" —, e por isso ele entra no PORTÃO em vez de virar
     `card.logo` de `null` dentro do JSX, que derrubaria o render inteiro. */
  const cardResolvido = titleCardStyleOf(titleCardStyle) === TITLE_CARD_SEM
    ? null : cardOf(card);
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
      <Palco src={src} reframe={reframe} altura={videoAltura} zooms={zooms} />
      {/* Música de fundo (2026-09-30): UMA faixa, só quando o servidor a manda. Relógio da
          SAÍDA; o volume por quadro (ganho do servidor + fades) é a função pura do preset. */}
      {musica && musica.file ? (
        <Audio src={staticFile(musica.file)} trimBefore={Math.round((musica.inicioSec || 0) * fps)}
          volume={(f) => volumeMusica(f, musica, fps, durationInFrames)} />
      ) : null}
      {/* O card entra, fica 4s e SAI — é chamada e miniatura, não rótulo permanente. Uma
          `Sequence` e não um `opacity: 0` no fim: passados os 4s não sobra elemento na
          árvore para custar quadro, e o relógio dela é o que a entrada/saída lê.
          Clipe mais curto que a janela encurta o card junto (`Math.min`), senão a Sequence
          se estenderia além da composição e o Remotion recusaria o render. */}
      {comLegenda && medida.texto && cardResolvido
        ? (
          <Sequence from={0} durationInFrames={cardQuadros} layout="none">
            <CardTitulo
              texto={medida.texto} destaque={destaque.span} fonte={medida.fonte}
              total={cardQuadros} card={cardResolvido}
            />
          </Sequence>
        )
        : null}
      {/* Textos fixos: os tempos já chegam no relógio da SAÍDA (dono em Python). */}
      {(Array.isArray(textos) ? textos : []).map(function (t) {
        const de = Math.round(t.deSec * fps);
        const quadros = Math.round((t.ateSec - t.deSec) * fps);
        if (!(quadros > 0) || de < 0) return null;
        return (
          <Sequence key={"texto-" + t.id} from={de} durationInFrames={quadros} layout="none">
            <TextoFixo texto={t} quadros={quadros} />
          </Sequence>
        );
      })}
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
              esquerda={esquerdaLegenda(legendaEsquerda, aparencia.largura)}
              de={de} aparencia={aparencia} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/* CAPA DO TIKTOK (2026-09-30): UM quadro, 1080x1920, PNG. Mora aqui, e não num arquivo à
   parte, para herdar as duas famílias JÁ carregadas acima (Montserrat 800 e Inter 700) sem
   um segundo `loadFont` — o 9w2 continua cobrindo o único arquivo que carrega fonte — e o
   mesmo `Fundo` do corte. Sem componente de vídeo (o 6m conta as tags): o quadro chega como PNG que o
   FFmpeg extraiu, e entra por `Img` do Remotion (segura a captura até carregar).
   Enquadramento = `palcoGeometria` do corte, nenhuma fórmula nova. `guias` só existe para os
   stills de conferência — o servidor nunca manda, e o PNG real sai sem elas. */
export const capaDefaultProps = {
  quadroFile: "", reframe: REFRAME_PADRAO, videoAltura: VIDEO_ALTURA_PADRAO,
  bandaAltura: BANDA_PADRAO, titulo: "Perdi 40 mil no primeiro ano", destaque: "",
  estilo: "negocio", posicao: "meio", guias: false,
};
const CAPA_SOMBRA = "0 4px 18px rgba(0,0,0,.6), 0 2px 3px rgba(0,0,0,.7)";
const Guia = ({ zona, rotulo }) => (
  <div style={{ position: "absolute", left: zona.x, top: zona.y, width: zona.largura,
    height: zona.altura, boxSizing: "border-box", border: "3px dashed rgba(255,255,255,.7)" }}>
    <span style={{ position: "absolute", left: 12, top: 8, fontFamily: INTER, fontWeight: 700,
      fontSize: 26, color: "rgba(255,255,255,.85)" }}>{rotulo}</span>
  </div>
);
export const CapaTikTok = ({ quadroFile, reframe, videoAltura, bandaAltura, titulo, destaque,
  estilo, posicao, guias }) => {
  const def = CAPA_ESTILO_DEF[estilo] || CAPA_ESTILO_DEF.negocio;
  const texto = String(titulo || "").trim();
  const medida = capaTitulo(texto, estilo);
  const span = resolveTitleHighlight(texto, { highlightText: destaque || "", autoHighlight: true }).span;
  const pedacos = splitTitleHighlight(texto, span);
  const imagem = quadroFile ? staticFile(quadroFile) : "";
  const geo = palcoGeometria(reframe, videoAltura);
  const caixa = def.caixa ? { backgroundColor: TOKENS.fundo + "E0", padding: "0.04em 0.22em",
    boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } : {};
  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.fundo }}>
      <Fundo imagem={imagem} banda={ancoraBanda(bandaAltura)} />
      {imagem ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div style={geo.caixa}>
            <Img src={imagem} style={{ ...geo.video, objectFit: geo.objectFit || undefined }} />
          </div>
        </AbsoluteFill>
      ) : null}
      {texto ? (
        <div style={{
          position: "absolute", left: 0, width: TOKENS.largura, boxSizing: "border-box",
          padding: (def.degrade ? CAPA_FOLGA_DEGRADE : 0) + "px 80px", textAlign: "center",
          background: def.degrade
            ? "linear-gradient(180deg, rgba(10,10,12,0), rgba(10,10,12,.62) 24%, rgba(10,10,12,.62) 76%, rgba(10,10,12,0))"
            : "none",
          ...capaBloco(posicao, def.degrade ? CAPA_FOLGA_DEGRADE : 0),
        }}>
          <span style={{
            fontFamily: FAMILIAS[def.familia], fontWeight: def.peso, fontSize: medida.fonte,
            lineHeight: CAPA_ENTRELINHA, textTransform: "uppercase", color: TOKENS.texto,
            textShadow: def.caixa ? "none" : CAPA_SOMBRA, overflowWrap: "normal", ...caixa,
          }}>
            {pedacos.map((p, i) => (
              <span key={i} style={p.forte ? { color: TOKENS.destaque } : undefined}>{p.texto}</span>
            ))}
          </span>
        </div>
      ) : null}
      {guias ? (
        <Fragment>
          <Guia zona={CAPA_ZONAS.grade} rotulo="Recorte do perfil (3:4)" />
          <Guia zona={CAPA_ZONAS.seguro} rotulo="Miolo seguro" />
          <Guia zona={CAPA_ZONAS.contador} rotulo="Contador de plays" />
        </Fragment>
      ) : null}
    </AbsoluteFill>
  );
};
