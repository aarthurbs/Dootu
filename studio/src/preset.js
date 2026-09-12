/* BUSINESS_SERIOUS — direção visual dos cortes de podcast de negócios.
 *
 * A regra que manda aqui é a do usuário: "strong content → correct clip → clear
 * communication → subtle editing → authority", nunca "effects → effects → effects".
 * Por isso este arquivo é quase todo tipografia e quase nada de efeito: o que decide se um
 * corte funciona é a fala caber na tela legível, não o vídeo se mexer.
 *
 * Tudo aqui é PURO e sem React de propósito — `test-preset.mjs` prova a quebra de linha e a
 * escolha de ênfase sem subir navegador nem renderizar frame.
 */

export const PRESETS = ['BUSINESS_SERIOUS', 'LIMPO'];

export const TOKENS = {
  largura: 1080,
  altura: 1920,
  fps: 30,

  /* Fundo quase preto, não preto puro: preto absoluto contra vídeo comprimido cria banda
     visível na borda entre o fundo e a imagem. Aparece atrás da miniatura e, no corte sem
     miniatura, no letterbox inteiro — que desde 2026-08-27 é esta cor chapada, sem desfoque
     nenhum para disfarçar a emenda. Espelhado no `worker.FUNDO_COR` (paridade no
     test_serve, bloco 26). */
  fundo: '#0A0A0C',

  /* Escurecimento da miniatura de fundo. São os MESMOS números do renderizador FFmpeg
     (`worker.THUMB_LUZ` / `THUMB_SATURACAO`), com prova de paridade no test_serve: se um
     dos dois mudar sozinho, os dois caminhos passam a escurecer diferente calados.
     `brightness()` do CSS é MULTIPLICATIVO, como o `colorchannelmixer` do FFmpeg — a
     armadilha já registrada no worker.py é usar o aditivo (`eq=brightness`), que apaga
     miniatura escura por inteiro.
     Era 0.42 até 2026-09-03, e o defeito foi VISTO num corte real: a 42% a miniatura
     continuava legível, então cada tarja mostrava a manchete DELA — duas vezes, ao lado da
     legenda e do card. Miniatura nítida com texto não é moldura, é conteúdo concorrente.
     É o botão de calibragem: subir daqui traz a manchete de volta. */
  fundoLuz: 0.18,
  fundoSaturacao: 0.55,
  /* Desfoque da miniatura, em RAIO de CSS. É o MESMO desfoque que o FFmpeg aplica na
     miniatura, em unidade diferente: o CSS define o desfoque como uma gaussiana de desvio
     padrão igual à METADE do raio, então 28 aqui é sigma 14 lá. O check de paridade do
     test_serve cobra o DOBRO do sigma do worker, nunca igualdade.
     Isto NÃO é o desfoque removido em 2026-08-27: aquele borrava a tira central do VÍDEO, e
     a armadilha era o topo virar teto escuro e a base virar mesa iluminada. Este borra a
     MINIATURA, que é UMA imagem, então custa uma vez e não por quadro.
     Botão de calibragem: 0 volta a miniatura nítida — e a manchete dela com ela. */
  fundoDesfoque: 28,

  /* 820px de largura útil num quadro de 1080: sobra 130px de cada lado. A trilha de botões
     do TikTok ocupa a direita a partir de ~930px — legenda centralizada com essa largura
     passa por baixo dela, não por cima. */
  legendaLargura: 820,
  legendaFonte: 58,
  legendaEntrelinha: 1.18,
  legendaPeso: 700,

  /* O centro exato do quadro — o MESMO que o FFmpeg sempre usou
     (`overlay=(W-w)/2:(H-h)/2`), então os dois renderizadores passam a enquadrar igual.
     Era 0.47 por um motivo só: a legenda era pendurada num percentual fixo do quadro
     (`legendaTopoPct`, que saiu) e subir o vídeo 3% era o único jeito de abrir folga
     embaixo dela. Com a legenda ancorada ao retângulo do vídeo (prop `legendaBase`, vinda
     do `captions.margem_inferior`), a folga é 8% da altura do vídeo por construção e essa
     folga deixou de existir como problema. */
  videoCentroPct: 0.50,

  /* 1 = a fonte inteira, sem corte e sem zoom. Era 1.45, que ampliava para tapar a faixa
     escura sobrando em cima e embaixo — e o preço era cortar 243px de CADA lado da fonte,
     decapitando convidado na ponta de um plano aberto. A faixa deixou de ser problema
     porque agora ela é a miniatura escurecida, não tarja: ampliar para esconder o fundo
     virou trabalho sem motivo.
     CONTINUA sendo o botão de calibragem, mas para cima: subir acima de 1 volta a cortar
     as laterais, e é justamente o que este pedido tirou. */
  videoEscala: 1.0,

  /* Raio dos cantos do vídeo deitado, em pixels do quadro 1080x1920. Pedido do usuário
     (2026-09-11): no "Inteiro" a fonte encostava no fundo com canto reto.
     Espelhado no `worker.VIDEO_RAIO`, com check de paridade no test_serve — sem ele o mesmo
     corte sai com canto diferente em cada renderizador, calado.
     É o MESMO número do `cardRaio` de propósito: dois retângulos arredondados no mesmo
     quadro com raios diferentes leem como descuido, não como intenção.
     Só vale no "Inteiro" (ver `palcoGeometria`): no 1:1 e no 4:5 o vídeo tem a largura do
     quadro inteiro, então a curva cairia na BORDA do arquivo e viraria entalhe.
     Botão de calibragem: 0 devolve o canto reto, nos dois renderizadores. */
  videoRaio: 28,

  texto: '#FFFFFF',
  /* Amarelo queimado, não amarelo de aviso. Neon foi proibido explicitamente. */
  destaque: '#D9A441',
  /* Verde discreto para dinheiro/crescimento e vermelho escuro para risco/erro. Um por vez:
     duas cores de destaque na mesma tela viram semáforo e a hierarquia some. */
  destaqueGanho: '#8FB573',
  destaquePerda: '#C0554A',

  /* --- palavra sendo DITA agora (o "karaoke") ---------------------------------------
     LEQUE de cores, pedido explicito do operador em 2026-09-11: o verde unico (#59E36A) foi
     considerado apagado demais, e o pedido foi "amarelo neon, algo assim, mas nao so amarelo
     -- um leque de cores mesmo". Isso ABRE a excecao de neon que a direcao editorial proibia
     para este recurso especifico; o resto da paleta (texto, destaque, marca) continua fechado.
     A cor gira por PALAVRA (`corDaPalavra`), nao por tempo -- efeito disparado so porque o
     tempo passou continua proibido.
     Amarelo primeiro porque e o pedido e porque e a primeira palavra de cada pagina.
     Ordem escolhida para que vizinhas NUNCA caiam a menos de 30° de matiz, INCLUSIVE na volta
     do fim para o comeco: 54° -> 185° -> 315° -> 87° -> 272° -> (54°). O laranja neon que
     estava aqui SAIU por isso e nao por gosto: 29° contra os 54° do amarelo davam 25° na
     virada da pagina, e duas palavras seguidas saiam quase da mesma cor -- o que le como
     defeito de render, nao como leque. O check 8q5 cobra a conta.
     Todas com luminancia alta (>0,45): ficam ~200 ms no ar sobre a sombra da legenda e
     precisam ser lidas de relance.
     BOTAO DE CALIBRAGEM: uma cor so nesta lista devolve o karaoke monocromatico de antes. */
  palavraCores: ['#FFE600', '#00E9FF', '#FF4FD1', '#8CFF1A', '#B14BFF'],
  /* BOTAO DE CALIBRAGEM deste recurso: 1.0 desliga o pop e deixa so a cor.
     Armadilha JA MEDIDA neste projeto (ver o comentario da enfase no Clip.jsx): `scale`
     cresce o glifo e NAO a caixa de layout. 12% de uma palavra de 200px transbordam 24px,
     12px de cada lado, e o espaco entre palavras em Inter 58px e ~14px -- entao subir daqui
     cola a palavra ativa nas vizinhas, e baixar da folga. E transitorio (uma palavra por
     vez, por ~200 ms), diferente da enfase de antes, que ficava a pagina inteira no ar. */
  palavraEscala: 1.12,
  /* Sobe 4px. Negativo porque em CSS o eixo Y cresce para BAIXO. */
  palavraSubida: -4,

  /* --- marca do canal ----------------------------------------------------------------
     Laranja MEDIDO na referência que o operador forneceu, não escolhido: dos 50.416 pixels
     da imagem, `#FF5F01` é a cor cromática dominante (798px) e `#000000` são 82% do quadro.
     Os laranjas escuros que aparecem na contagem (#AE3B03, #B54303) são halo de compressão,
     não tinta da marca.
     Laranja PROFUNDO, não neon: saturação ~1,0 mas luminância 0,50 — é o que faz a paleta
     ler como financeira e séria em vez de aviso. Subir a luminância daqui é o caminho para
     a "cara de template" que a direção proíbe. */
  marcaLaranja: '#FF5F01',
  marcaPreto: '#000000',

  /* --- destaque do TÍTULO ------------------------------------------------------------
     O PESO do título e a APARÊNCIA do destaque saíram daqui e viraram coisa de MARCA
     (`TITLE_CARD_PRESETS`, no fim deste arquivo): o card tem duas identidades, e um valor
     global não consegue ser laranja-sobre-mesmo-peso numa e peso-800-para-900 na outra.
     Eram `tituloPeso: 900` e `tituloDestaqueCor: '#FF5F01'`, e foram REMOVIDOS em vez de
     deixados como padrão — token global que nada lê é a armadilha clássica: alguém o
     ajusta esperando efeito, e o valor que manda está noutro lugar. O check 9x cobra que
     eles não voltem.
     O que FICA aqui é o que vale para as duas: o fator de corpo do destaque. */
  /* Filete da esquerda do CARD — cromo do card, não do texto. O sublinhado do destaque saiu
     junto com o destaque por peso: com a cor fazendo o trabalho, a régua embaixo da palavra
     virava terceiro sinal. BOTÃO DE CALIBRAGEM: `tituloFilete: 0` tira o filete do card. */
  tituloFilete: 4,
  /* Era 1.16 escrito no Clip.jsx, afinado quando o título tinha no máximo duas linhas. Com
     três, apertado assim o bloco vira parede. Vira token pelo mesmo motivo do
     `legendaEntrelinha`: é calibragem, e calibragem dentro do componente ninguém acha. */
  tituloEntrelinha: 1.22,
  /* O trecho destacado cresce 8%. É `fontSize` e NÃO `transform: scale` de propósito: a
     armadilha já medida neste projeto (comentário da ênfase no Clip.jsx) é que `scale`
     cresce o glifo e não a caixa de layout, e o texto vizinho é comido. `fontSize` cresce a
     caixa junto — o preço é que a quebra de linha muda, e por isso o `tituloEscalonado`
     pesa os tokens do destaque por este mesmo fator em vez de fingir que são normais. */
  tituloDestaqueFator: 1.08,

  /* --- card da marca -----------------------------------------------------------------
     Antes disto o título era um `<span>` solto sobre o vídeo: branco, centrado, sem
     nenhuma amarra com a identidade do canal. O card é a placa que o ancora.
     A marca é MONOCROMÁTICA (medido no logo de referência: 0 pixels cromáticos), então
     aqui não entra cor nenhuma — a hierarquia toda é peso, tamanho e o filete branco, que
     é a régua que já ladeia o `PURO` no logo. Inventar uma cor de destaque seria inventar
     a marca. */
  cardLargura: 820,
  /* A MESMA coluna óptica da legenda (`legendaLargura`): os dois blocos de texto do quadro
     alinham na mesma vertical em vez de cada um ter a sua margem. 820/1080 = 76% — o
     pedido fala em "~80%", e casar com a legenda vale mais que os 4%. */
  /* Meio do quadro, um pouco acima do centro geométrico. Era `cardTopo: 150` (pendurado no
     alto) até o card virar uma chamada de 4s.
     Por que 0.44 e não 0.50, MEDIDO no frame: em 0.50 a base do card cai em cima da
     legenda — um título de 3 linhas termina em y 1158 e uma página de 2 linhas começa em
     y 1079, e a fala era desenhada POR CIMA do card. Legível, mas com cara de defeito. Em
     0.44 o pior caso (3 linhas no maior corpo + legenda de 2 linhas) ainda sobra folga, e
     o card continua no meio do vídeo, longe da tarja de cima e da faixa de botões.
     BOTÃO DE CALIBRAGEM da posição — mas o check 12d cobra a folga por ARITMÉTICA: descer
     daqui reprova em vez de encostar na legenda calado. */
  cardCentroPct: 0.44,
  cardPadding: 44,
  cardRaio: 28,
  /* Quase opaco, não translúcido de vidro: o card precisa de contraste forte sobre quadro
     CLARO (rosto iluminado, parede branca) e sobre quadro escuro. 92% sobre branco já é
     preto. Sem `backdrop-filter`: desfoque custa por QUADRO num render que já leva ~11s por
     segundo de clipe, e não acrescenta legibilidade nenhuma aqui. */
  cardFundo: 'rgba(10, 10, 12, .92)',
  /* A COR da borda saiu daqui e virou coisa de MARCA (`bordaCor` em `TITLE_CARD_PRESETS`):
     laranja a 30% no Primo Rico, branca a 14% no Ecommerce Puro, que é monocromático. Como
     `tituloPeso` e `tituloDestaqueCor`, foi REMOVIDA em vez de virar padrão — token global
     que nada lê é armadilha (alguém o ajusta e o valor que manda está noutro lugar).
     A ESPESSURA fica: é geometria, e o `larguraTitulo()` a desconta da caixa de texto, então
     ela tem de ser a mesma nas duas identidades (contrato no
     `TITULO_GEOMETRIA_COMPARTILHADA`). */
  cardBordaPeso: 2,
  /* Sombra realista: deslocada e contida, nunca `0 0 Npx` colorido (regra do projeto —
     profundidade é sombra, brilho é "cara de IA"). */
  cardSombra: '0 18px 48px rgba(0, 0, 0, .55)',
  /* Altura da placa da marca. 62px é o tamanho VERIFICADO para este card no README da
     identidade — abaixo de 56px o `PURO` e os filetes fecham. A largura sai da proporção
     do SVG, nunca fixada à mão. */
  logoAltura: 62,
  logoFolga: 30,
  /* O identificador ao lado do emblema. Pequeno de propósito — o título é que manda; se
     este número chegar perto do menor degrau da escada de título (32px), a assinatura passa
     a competir com a manchete. */
  marcaNomeFonte: 19,
  /* Entrada: 9 quadros a 30fps = 300ms, o teto para animação de interface. Sobe 12px e
     abre de 0.98 — nunca de `scale(0)`, que é coisa aparecendo do nada. Depois disso o
     card fica PARADO: bloco de texto que se mexe o tempo todo é o que a direção
     BUSINESS_SERIOUS proíbe por escrito. */
  cardEntradaQuadros: 9,
  cardSubida: 12,
  cardEscalaInicial: 0.98,
  /* O card é uma CHAMADA, não um rótulo permanente: entra, fica 4s e sai. É o que serve de
     miniatura e prende o olho nos primeiros segundos; depois disso ele só tampa o vídeo.
     Por isso ele é uma `<Sequence>` e não um elemento sempre montado — passados os 4s não
     sobra nada na árvore para custar quadro.
     BOTÃO DE CALIBRAGEM da chamada. Clipe mais curto que isto encurta o card junto. */
  cardDuracaoSeg: 4,
  /* Saída mais curta que a entrada (6 quadros = 200ms contra 9 = 300ms), e é regra, não
     gosto: o espectador está DECIDINDO quando o card entra e o sistema está só respondendo
     quando ele sai. Simétrico, a saída parece arrastada. */
  cardSaidaQuadros: 6,

  /* Sombra de leitura, não efeito: sem ela a legenda some sobre camisa clara. Contida e sem
     brilho colorido (regra do projeto: profundidade é sombra realista, nunca glow). */
  sombraTexto: '0 3px 14px rgba(0,0,0,.82), 0 1px 2px rgba(0,0,0,.9)',
};

/* Categorias vindas do detector que puxam a cor contextual. Fora destas, o amarelo padrão. */
const COR_POR_CATEGORIA = {
  money: 'destaqueGanho',
  success: 'destaqueGanho',
  failure: 'destaquePerda',
};

export function corDoDestaque(categoria) {
  var chave = COR_POR_CATEGORIA[categoria] || 'destaque';
  return TOKENS[chave];
}

/* --------------------------------------------------------- âncora da legenda */

/* Distância da borda de BAIXO do quadro até a base da legenda quando NÃO há servidor
   mandando o prop — o caso do Remotion Studio aberto na mão. 705 é o número de uma fonte
   16:9 (`captions.margem_inferior(1920, 608)`) e o bloco 6 do `test_captions.py` compara os
   dois lendo este arquivo: mudar o `RODAPE_PCT` do Python sem mexer aqui REPROVA, em vez de
   deixar o preview numa posição obsoleta calado.
   A conta em si não é reimplementada em JS de propósito — a fórmula é uma só, em Python,
   dona da âncora nos dois renderizadores. */
export const LEGENDA_BASE_PADRAO = 705;

/* Prop `legendaBase` -> o px que vai no `bottom` da legenda.
   É função exportada aqui, e não uma linha escondida dentro do Clip.jsx, porque o teste roda
   com `node` puro e não importa JSX: enquanto a guarda morou no componente, a única prova
   possível era regex (`Number(legendaBase) ||`) — e regex casa palavra. Medido: inverter a âncora
   (`TOKENS.altura - ...`), que joga a base do texto 510px para fora do lugar, passava com as
   CINCO suítes verdes. Agora o test-preset.mjs CHAMA esta função com valor construído.
   Prop ausente ou ilegível viraria `bottom: NaN` e a legenda sumiria do quadro sem erro
   nenhum. 0 cai no padrão junto: `margem_inferior` não devolve 0 na prática (o piso é o teto
   de interface do TikTok — 269px numa fonte já vertical), então 0 é ausência. */
export const ancoraLegenda = (valor) => Number(valor) || LEGENDA_BASE_PADRAO;

/* --------------------------------------------------- tarja da miniatura */

/* Altura de UMA tarja (a de cima e a de baixo são iguais) num 16:9 deitado no 1080x1920:
   o vídeo ocupa 608px, sobram 656 de cada lado. Quem manda de verdade é o servidor, pelo
   prop `bandaAltura` — este número existe para o Remotion Studio abrir certo sem servidor,
   igual ao LEGENDA_BASE_PADRAO. Paridade com `worker.band_height` presa no test_serve. */
export const BANDA_PADRAO = 656;

/* Gate do prop. NÃO usa `Number(v) || padrão` como o `ancoraLegenda`: aqui o ZERO é
   resposta legítima — fonte já vertical enche o quadro e não sobra tarja nenhuma — e o
   `||` o trocaria por 656, mandando desenhar miniatura onde não há espaço. É a mesma
   família da armadilha `if override is not None` já registrada no serve.py. */
export const ancoraBanda = (valor) => {
  /* AUSENTE e ZERO são coisas diferentes e não podem colapsar: `Number(null)` e
     `Number('')` dão 0, então tratar tudo por `Number()` faria prop faltando apagar o fundo
     em vez de cair no padrão. */
  if (valor === null || valor === undefined || valor === '') return BANDA_PADRAO;
  var n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : BANDA_PADRAO;
};

/* ------------------------------------------------------- enquadramento (recorte da fonte) */

/* Espelho do `worker.REFRAMES`. LITERAIS de propósito: o `serve.py` e o `video-ops.js` leem
   esta lista por REGEX, como já fazem com o TITLE_CARD_STYLES — interpolar uma constante no
   meio faria o leitor extrair o NOME dela e a paridade acusaria divergência falsa. */
export const REFRAMES = ['blur', 'crop', 'crop11', 'crop45'];

/* Ausente ou desconhecido cai aqui: todo trecho salvo antes do seletor de enquadramento tem
   de sair EXATAMENTE como sai hoje, e hoje a fonte deita inteira. */
export const REFRAME_PADRAO = 'blur';

/* O que a tela OFERECE — subconjunto, e é por isso que são duas listas e não uma: `crop` é
   interno (9:16 de quadro cheio, ampliação de 1,78x numa fonte 16:9) e continua alcançável
   só editando a query à mão, como sempre foi. O check de paridade cobra que este seja
   SUBCONJUNTO de REFRAMES, não que sejam iguais. */
export const REFRAMES_OFERECIDOS = ['blur', 'crop11', 'crop45'];

/* Rótulo NUNCA é chave: quem manda no render é a chave, e o rótulo pode mudar sozinho. */
export const REFRAME_LABELS = {
  blur: 'Inteiro', crop11: '1:1', crop45: '4:5', crop: '9:16',
};

/* Gate do prop, irmão do `titleCardStyleOf`. */
export function reframeOf(valor) {
  return REFRAMES.indexOf(valor) >= 0 ? valor : REFRAME_PADRAO;
}

/* Altura do vídeo visível num 16:9 deitado. Como o BANDA_PADRAO, existe para o Remotion
   Studio abrir certo sem servidor; quem manda é o prop `videoAltura`, que sai do
   `serve.video_box` — o dono ÚNICO da altura nos dois renderizadores. */
export const VIDEO_ALTURA_PADRAO = 608;

/* Gate do `videoAltura`. NÃO é o `ancoraBanda`: lá o ZERO é resposta legítima (fonte já
   vertical não sobra tarja), aqui altura 0 é vídeo nenhum — um `>= 0` deixaria passar uma
   caixa de altura zero e o corte sairia sem imagem, com o fundo inteiro à vista e nenhum
   erro. Por isso `> 0`. */
export function ancoraVideo(valor) {
  var n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : VIDEO_ALTURA_PADRAO;
}

/* Geometria do palco: o que o `Clip.jsx` põe no contêiner do vídeo e no próprio vídeo.

   É FUNÇÃO PURA e exportada de propósito, não estilo escrito à mão dentro do componente.
   A lição custou três sabotagens passando com a suíte verde (2026-08-27): enquanto a âncora
   da legenda era provada por regex sobre o texto do Clip.jsx, tirar o argumento da tag
   (`bottom: undefined`) e inverter o sinal (510px fora de lugar) passavam calados. Foi por
   isso que nasceu o `ancoraLegenda`, e é por isso que isto nasce assim.

   `blur` devolve EXATAMENTE a geometria de sempre — largura 100%, altura natural do vídeo —
   e é o que faz todo trecho já salvo sair como saía. Os perfis de recorte devolvem uma caixa
   de 1080 x altura com `overflow: hidden` e o vídeo em `cover`, ou seja quem é recortado é a
   FONTE. Isto NÃO é a ampliação de 1,45x removida em 2026-08-26: ali o vídeo já enquadrado
   era esticado (zoom nítido, proibido por escrito no BUSINESS_SERIOUS); aqui a fonte entra
   inteira e sobra menos dela. `videoEscala` fica 1 e `videoCentroPct` fica 0.5.

   Paridade com o FFmpeg, por aritmética: `cover` num 1080x1350 com fonte 16:9 escala para
   2400 de largura e corta 660 de cada lado, mantendo 1080/2400 = 45% — o mesmo 55% que o
   `crop='min(iw,ih*4/5)'...` do filtro corta. */
export function palcoGeometria(reframe, altura) {
  var recorta = reframeOf(reframe) !== REFRAME_PADRAO;
  var caixa = {
    position: 'absolute',
    left: '50%',
    top: TOKENS.videoCentroPct * 100 + '%',
    transform: 'translate(-50%, -50%) scale(' + TOKENS.videoEscala + ')',
    width: '100%',
    lineHeight: 0,
  };
  /* `width: '100%'` e altura natural: o mesmo estilo de antes desta entrega. */
  var video = { width: '100%' };
  /* `objectFit` sai SEPARADO do estilo porque no `<Video>` do @remotion/media ele é um PROP
     de primeira classe, e não CSS: posto dentro de `style` ele é IGNORADO e o componente
     ainda avisa no console ("Use the `objectFit` prop instead of the `style` prop").
     Medido olhando o frame: com ele no estilo o 1:1 saía com o vídeo em 608px de altura
     dentro da caixa de 1080 — ou seja recorte nenhum, e a legenda (ancorada como se o vídeo
     tivesse 1080) caía na tarja. O aviso do console era a única pista, e passava batido no
     meio da saída do render. */
  var objectFit = null;
  if (recorta) {
    caixa.width = TOKENS.largura;
    caixa.height = ancoraVideo(altura);
    caixa.overflow = 'hidden';
    video = { width: '100%', height: '100%' };
    objectFit = 'cover';
  } else if (TOKENS.videoRaio > 0) {
    /* O raio vai na CAIXA, com `overflow: hidden`, e não no `<Video>`: o recorte fica sendo
       do contêiner, que é um `<div>` comum, em vez de depender de o Chromium respeitar
       `border-radius` num elemento substituído com overlay de vídeo. O par é obrigatório —
       raio sem `overflow` não corta nada.
       Só aqui (o ramo que NÃO recorta) porque no 1:1 e no 4:5 a caixa tem os 1080 de
       largura do quadro: a curva cairia na borda do arquivo exportado. */
    caixa.borderRadius = TOKENS.videoRaio;
    caixa.overflow = 'hidden';
  }
  return { recorta: recorta, caixa: caixa, video: video, objectFit: objectFit };
}

/* ------------------------------------------------------- palavra sendo dita (karaoke) */

/* Mola do pop. Os tres numeros sao os do pedido. Amortecimento calculado, nao chutado:
   z = damping / (2*sqrt(stiffness*mass)) = 12 / (2*sqrt(220*0,5)) = 0,572 -> sobressalto de
   exp(-pi*z/sqrt(1-z^2)) = 11,2%. Ou seja a escala passa por ~1,133 antes de assentar em
   1,12 e a subida por ~4,45px antes de assentar em 4px. Sobressalto e o que faz o "pop"
   existir; 11% de 12% e 1,5% de tamanho e assenta em ~8 quadros a 30fps.
   SEM `overshootClamping` de proposito: clampar transforma o pop numa rampa. Se um dia
   incomodar, o botao e o `TOKENS.palavraEscala`, nao a mola. */
export const MOLA_PALAVRA = { damping: 12, stiffness: 220, mass: 0.5 };

/* Indice da palavra que esta sendo dita em `tempo`, ou -1. PURA.
   O intervalo e SEMANTICO: `start <= t < end`, fim EXCLUSIVO. Na fronteira em que uma
   palavra acaba no mesmo instante em que a seguinte comeca -- que e a regra do
   `parse_json3_words`, onde o fim de cada palavra E o inicio da proxima --, so a NOVA
   acende. Com fim inclusivo as duas ficariam verdes no mesmo quadro.
   Lista ausente, palavra sem tempo legivel e tempo ilegivel devolvem -1: a legenda continua
   ESTATICA e branca, exatamente como antes desta feature existir. Nada aqui levanta.
   Sobreposicao acidental: a ULTIMA que casa vence -- deterministico (nunca duas ativas) e a
   mesma regra que o `captions.normalize_cues` usa no empate ("a que o YouTube estava
   escrevendo"). */
export function activeWordIndex(palavras, tempo) {
  if (!Array.isArray(palavras)) return -1;
  var t = Number(tempo);
  if (!isFinite(t)) return -1;
  var achado = -1;
  for (var i = 0; i < palavras.length; i++) {
    var palavra = palavras[i];
    if (!palavra) continue;
    var inicio = Number(palavra.start);
    var fim = Number(palavra.end);
    if (!isFinite(inicio) || !isFinite(fim) || !(fim > inicio)) continue;
    if (inicio <= t && t < fim) achado = i;
  }
  return achado;
}

/* Progresso da mola (0..~1,11) -> escala e subida da palavra ativa. PURA, e separada do
   Clip.jsx pelo motivo que este projeto ja aprendeu duas vezes: e a POLARIDADE que erra
   calada. Inverter o sinal da subida ou escrever `1 - p*k` no lugar de `1 + p*k` passa em
   qualquer asercao de TEXTO sobre o Clip.jsx e so aparece olhando o frame -- entao o teste
   CHAMA esta funcao com valor construido. */
export function popPalavra(progresso, estilo) {
  var p = Number(progresso);
  if (!isFinite(p)) p = 0;
  /* O ESTILO da legenda manda na amplitude do pop, e o argumento e OPCIONAL de proposito:
     sem ele a funcao se comporta exatamente como antes deste registro existir (os tokens
     globais, que sao os valores do proprio `classico`), entao nenhuma chamada antiga muda
     de resultado. Estilo torto tambem cai nos tokens em vez de virar `NaN` na transformacao
     -- `scale(NaN)` e ignorado pelo CSS, e a palavra ativa pararia de crescer calada. */
  var e = estilo || TOKENS;
  var escala = Number(e.palavraEscala);
  var subida = Number(e.palavraSubida);
  if (!isFinite(escala)) escala = TOKENS.palavraEscala;
  if (!isFinite(subida)) subida = TOKENS.palavraSubida;
  return {
    escala: 1 + (escala - 1) * p,
    /* `|| 0` mata o -0: `-4 * 0` da `-0` em IEEE 754, e `translateY(-0px)`, alem de feio,
       faz o valor deixar de comparar igual a 0 em teste estrito. */
    subida: subida * p || 0,
  };
}

/* Cor da palavra de indice `i` dentro da pagina. PURA e exportada pelo motivo de sempre
   (`popPalavra`, `palavrasDaPagina`): escrita a mao no Clip.jsx, ler a chave errada apagaria o
   leque inteiro com a suite verde -- entao o teste CHAMA esta funcao com o preset de verdade.
   O indice e o da PALAVRA, nao o do quadro: a cor de uma palavra nao muda enquanto ela esta
   acesa. Pagina nova recomeca no amarelo de proposito -- a primeira cor vira ancora de leitura
   em vez de o leque escorregar sem referencia.
   Estilo torto, lista vazia ou indice ilegivel caem no BRANCO do texto: a palavra perde o
   destaque, mas a legenda continua legivel. `color: undefined` deixaria a palavra ativa com a
   cor da anterior e o defeito passaria calado. */
export function corDaPalavra(estilo, indice) {
  var leque = (estilo || TOKENS).palavraCores;
  if (!Array.isArray(leque) || !leque.length) return TOKENS.texto;
  var i = Math.floor(Number(indice));
  if (!isFinite(i) || i < 0) i = 0;
  return leque[i % leque.length];
}

/* Palavras da cue, se elas descreverem EXATAMENTE o texto dela. Senao, null -> legenda
   estatica de sempre.
   A conferencia e por CONTEUDO, nao por contagem de tokens, e isso foi MEDIDO: 5,1% das
   palavras da legenda real (18 de 351 na amostra `fixtures/json3-rolante.json`) trazem espaco
   DENTRO -- `>> fulano`, a marca de troca de falante do json3, e `[ ca ]`, a censura do
   reconhecedor. Comparando `words.length` com `text.split(' ').length`, essas 18 palavras
   desalinhavam 16 das 66 linhas (24,2%) e um quarto da legenda voltava ao estatico: alguma
   linha acendendo e outra nao, que parece defeito. Comparando a JUNCAO, nenhuma linha cai.
   Props de uma versao antiga ou cue mexida na mao nao casam e caem no estatico -- que e o
   ponto: melhor legenda branca do que acender a palavra errada. */
function palavrasAlinhadas(cue, texto) {
  var lista = cue && cue.words;
  if (!Array.isArray(lista) || !lista.length) return null;
  var limpa = [];
  for (var i = 0; i < lista.length; i++) {
    var palavra = lista[i];
    if (!palavra) return null;
    var termo = String(palavra.text || '').replace(/\s+/g, ' ').trim();
    if (!termo) return null;
    limpa.push({ start: Number(palavra.start), end: Number(palavra.end), text: termo });
  }
  return limpa.map(function (p) { return p.text; }).join(' ') === texto ? limpa : null;
}

/* Pagina -> as palavras que o karaoke deve acender, ou null (legenda estatica de sempre).
   PURA e exportada porque e a CHAVE-MESTRA do recurso: quem produz e o `toCaptionPages`
   (`pagina.palavras`) e quem consome e o `Clip.jsx`. Enquanto o gate morou dentro do
   componente, a unica prova possivel era regex, e a revisao adversarial desta entrega MEDIU
   a sabotagem: trocar o gate para `pagina.words` (chave que nunca existiu) desliga o karaoke
   em TODA pagina de TODO corte -- legenda estatica branca, sem erro, sem aviso -- e passava
   com as 119 verificacoes verdes. E a mesma classe de erro que criou o `ancoraLegenda` em
   2026-08-27, agora com o mesmo conserto: o teste CHAMA esta funcao com uma pagina construida
   pelo proprio `toCaptionPages`, entao as duas pontas da chave sao provadas por execucao.

   `length < 2` NAO e paranoia: uma pagina de um atomo so e (a) uma linha de uma palavra, onde
   acender a unica palavra nao acrescenta hierarquia nenhuma -- a MESMA regra que o
   `pickEmphasis` ja aplica para pagina de menos de 3 palavras --, ou (b) legenda MANUAL, onde
   `parse_json3_words` devolve UMA "palavra" com a FRASE inteira: sem esta guarda a linha
   inteira ficaria verde e cresceria 12%, o que a revisao apontou. Medido na amostra real:
   9 das 66 linhas (13,6%) caem aqui, todas de uma palavra, e saem em branco estatico. */
export function palavrasDaPagina(pagina) {
  var lista = pagina && pagina.palavras;
  if (!Array.isArray(lista) || lista.length < 2) return null;
  return lista;
}

/* --------------------------------------------------------------- quebra de linha */

/* Caracteres que cabem numa linha de 820px em Inter Bold 58px. Medido pela largura média de
   avanço da fonte (~0.55em), não chutado: 820 / (58 * 0.55) ~= 25. */
export const MAX_CHARS_LINHA = 25;
export const MAX_LINHAS = 2;
export const MAX_CHARS_PAGINA = MAX_CHARS_LINHA * MAX_LINHAS;

/* Uma fala longa não vira uma legenda de cinco linhas: vira várias páginas curtas, cada uma
   com a fatia de tempo proporcional ao próprio tamanho. É o "short readable groups" do
   pedido — e o motivo de o corte de página ser por PALAVRA, nunca no meio dela. */
export function toCaptionPages(cues, maxChars) {
  var teto = maxChars || MAX_CHARS_PAGINA;
  var paginas = [];
  (cues || []).forEach(function (cue) {
    var texto = String((cue && cue.text) || '').replace(/\s+/g, ' ').trim();
    if (!texto) return;
    var inicio = Number(cue.start) || 0;
    var fim = Number(cue.end) || 0;
    if (!(fim > inicio)) return;

    /* Tempo por PALAVRA, quando a cue trouxe (`captions.cues_from_words` -> serve.py ->
       props do render). Com ele, o ÁTOMO da página deixa de ser o token separado por espaço e
       passa a ser a PALAVRA do reconhecedor — o algoritmo é o MESMO (acumula até o teto,
       nunca corta o átomo ao meio), só a unidade muda, e o texto do bloco continua sendo a
       junção dos átomos dele. Medido na amostra real: as 66 linhas com tempo por palavra já
       cabem numa página cada, então este ramo não reparte nada na prática — ele existe para a
       linha longa e para não partir `[ ca ]`/`>> fulano` no meio. */
    var comTempo = palavrasAlinhadas(cue, texto);
    /* Atomo maior que a pagina inteira derruba o caminho por palavra e devolve a paginacao
       por token, EXATAMENTE como era. É o caso da legenda MANUAL: `parse_json3_words` faz
       UMA "palavra" com a frase toda, e com ela como atomo o `|| !atual` deixaria passar uma
       pagina de 77 caracteres num teto de 50 — a paginacao de 2 linhas colapsava e os dois
       renderizadores divergiam (apontado na revisao adversarial). Medido: 0 dos 351 atomos
       da amostra automatica passa de 50 chars, então na legenda automatica isto nunca
       dispara; ele existe para a manual. */
    if (comTempo && comTempo.some(function (p) { return p.text.length > teto; })) {
      comTempo = null;
    }
    var termos = comTempo ? comTempo.map(function (p) { return p.text; }) : texto.split(' ');
    var blocos = [];
    var contagens = [];   // quantos átomos entraram em cada bloco
    var atual = '';
    var conta = 0;
    termos.forEach(function (palavra) {
      var tentativa = atual ? atual + ' ' + palavra : palavra;
      /* `|| !atual` deixa passar a palavra sozinha maior que o teto: cortar no meio dela
         seria pior que estourar a linha, e o CSS ainda dá conta do que não couber. */
      if (tentativa.length <= teto || !atual) { atual = tentativa; conta++; }
      else { blocos.push(atual); contagens.push(conta); atual = palavra; conta = 1; }
    });
    if (atual) { blocos.push(atual); contagens.push(conta); }
    var cursor = 0;

    /* Tempo repartido por tamanho de texto, não em fatias iguais: uma página com três
       palavras e outra com doze não levam o mesmo tempo para serem faladas.
       COM tempo por palavra a repartição por caractere não é usada: o começo de cada página
       é o começo da PRIMEIRA PALAVRA dela e o fim é o começo da página seguinte. Repartir por
       caractere aqui punha a fronteira da Sequence num instante que a fala não tem, e as
       palavras da página caíam FORA da janela dela — a palavra acendia atrasada, ou não
       acendia (achado da revisão adversarial; alcança as 2 de 66 linhas da amostra que passam
       de 50 caracteres e por isso são repartidas). O fim vem da página SEGUINTE, e não da
       última palavra, para não abrir buraco em que a legenda pisca fora da tela. */
    var fatias = comTempo ? blocos.map(function (_, indice) {
      var desde = contagens.slice(0, indice).reduce(function (a, b) { return a + b; }, 0);
      return comTempo[desde].start;
    }) : null;
    var total = blocos.reduce(function (soma, b) { return soma + b.length; }, 0) || 1;
    var relogio = inicio;
    blocos.forEach(function (bloco, indice) {
      var fatia = (fim - inicio) * (bloco.length / total);
      var termina = indice === blocos.length - 1 ? fim
        : (fatias ? fatias[indice + 1] : relogio + fatia);
      var pagina = { start: relogio, end: termina, text: bloco };
      if (comTempo) {
        pagina.palavras = comTempo.slice(cursor, cursor + contagens[indice]);
        cursor += contagens[indice];
      }
      paginas.push(pagina);
      relogio = termina;
    });
  });
  return paginas;
}

/* --------------------------------------------------------------- ênfase */

/* Termos que MUDAM o entendimento da frase quando destacados. A regra do usuário é
   explícita: "Do not highlight random words simply to create movement." Por isso a lista é
   curta e concreta — dinheiro, erro, resultado — e não "palavras bonitas". */
const TERMOS_FORTES = [
  'faturamento', 'lucro', 'margem', 'prejuizo', 'caixa', 'receita', 'custo',
  'divida', 'investimento', 'retorno',
  'erro', 'erros', 'fracasso', 'falencia', 'quebrei', 'errei',
  'nunca', 'sempre', 'ninguem', 'tudo', 'nada',
  'disciplina', 'foco', 'tempo', 'liberdade',
];
/* Número com unidade: "40%", "3 anos", "200 mil". Número solto não vira destaque — "eu
   tinha 2 opções" não fica mais claro com o 2 em amarelo. */
const NUMERO_FORTE = /^r?\$?\d[\d.,]*%?$/i;
const UNIDADES = ['%', 'mil', 'milhao', 'milhoes', 'reais', 'anos', 'ano', 'meses', 'mes'];

function semAcento(valor) {
  return String(valor || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/* Devolve o ÍNDICE da palavra a destacar, ou -1. No máximo uma por página: se toda frase
   tem palavra destacada, nenhuma está destacada. */
export function pickEmphasis(texto) {
  var palavras = String(texto || '').split(/\s+/).filter(Boolean);
  /* Página de uma ou duas palavras já é o destaque inteiro; colorir uma delas não
     acrescenta hierarquia nenhuma. */
  if (palavras.length < 3) return -1;
  var melhor = -1;
  var melhorPeso = 0;
  palavras.forEach(function (palavra, indice) {
    var limpa = semAcento(palavra.replace(/[.,!?;:"()]/g, '').replace(/[“”]/g, ''));
    if (!limpa) return;
    var peso = 0;
    if (TERMOS_FORTES.indexOf(limpa) >= 0) peso = 2;
    if (NUMERO_FORTE.test(limpa)) {
      var seguinte = semAcento((palavras[indice + 1] || '').replace(/[.,!?;:]/g, ''));
      if (limpa.indexOf('%') >= 0 || UNIDADES.indexOf(seguinte) >= 0) peso = 3;
    }
    if (peso > melhorPeso) { melhorPeso = peso; melhor = indice; }
  });
  return melhor;
}

/* Página -> pedaços para o React, com a palavra destacada isolada. Devolver pedaços em vez
   de HTML mantém a composição sem dangerouslySetInnerHTML. */
export function splitEmphasis(texto, indiceDestaque) {
  var palavras = String(texto || '').split(/\s+/).filter(Boolean);
  if (indiceDestaque < 0 || indiceDestaque >= palavras.length) {
    return [{ texto: palavras.join(' '), forte: false }];
  }
  var pedacos = [];
  var antes = palavras.slice(0, indiceDestaque).join(' ');
  var depois = palavras.slice(indiceDestaque + 1).join(' ');
  if (antes) pedacos.push({ texto: antes + ' ', forte: false });
  pedacos.push({ texto: palavras[indiceDestaque], forte: true });
  if (depois) pedacos.push({ texto: ' ' + depois, forte: false });
  return pedacos;
}

/* -------------------------------------------------------- destaque do TÍTULO */

/* O título é UMA frase, não uma página de legenda — então o que se destaca é um TRECHO
   ("100 mil pedidos"), não uma palavra solta. Mesma disciplina do `pickEmphasis`: listas
   fechadas, função pura, zero dependência.
   O pedido do card proíbe "AI or NLP dependency" e "unreliable automatic keyword
   detection". Léxico fechado não adivinha: erra sempre igual, e o conserto é editar a
   lista. E o `highlightText` do operador continua vencendo o automático, sempre. */

export const MIN_PALAVRAS_TITULO = 5;
/* Se quase tudo está destacado, nada está. Irmão do `< 3 palavras` do pickEmphasis. */
export const MAX_COBERTURA_TITULO = 0.45;
/* Teto de crescimento: moeda + número + escala + unidade = 4 tokens. */
const TETO_SPAN = 3;

const ESCALA = ['mil', 'milhao', 'milhoes', 'bilhao', 'bilhoes', 'mi', 'bi', 'k'];
const MOEDA = ['r$', 'us$', '$'];
/* Substantivo que fecha a conta ("100 mil **pedidos**"). Lista fechada e não "qualquer
   substantivo" de propósito: sem ela, "Faturei R$ 2 milhões vendendo capinha" engoliria
   `vendendo`, e separar verbo de substantivo exige morfologia — a dependência proibida.
   Unidade desconhecida faz o trecho parar cedo e sair "R$ 2 milhões", que já está certo:
   FALHA PARA O LADO SEGURO. */
const UNIDADE_RESULTADO = [
  'pedidos', 'vendas', 'clientes', 'reais', 'dolares', 'seguidores', 'inscritos',
  'alunos', 'views', 'visualizacoes', 'funcionarios', 'lojas', 'produtos', 'unidades',
  'contratos', 'anos', 'meses', 'dias', 'semanas', 'paises', 'cidades',
];
/* Ano não é resultado: "em 2019 eu quebrei" não vira "**2019**". Só rejeita com um destes
   antes, então "cheguei a 2000 clientes" continua valendo. */
const DATA_ANTES = ['em', 'desde', 'entre', 'ate', 'ano', 'anos'];
const ANO = /^\d{4}$/;
/* Do TERMOS_FORTES (compartilhado com a legenda) saem os intensificadores. Numa PÁGINA de
   legenda "nunca" é a palavra que muda o sentido; num TÍTULO ele não é a afirmação, e
   destacá-lo é exatamente o "highlight random words to create movement" que o pedido
   proíbe. Não é uma segunda lista de termos: é um filtro nomeado sobre a que já existe —
   duas listas divergiriam e o mesmo termo passaria a valer na legenda e não no título. */
const FRACOS_NO_TITULO = ['nunca', 'sempre', 'ninguem', 'tudo', 'nada'];

const PONTUACAO_FIM = /[.,;:!?…—-]+$/;

/* Token sem a pontuação colada e sem acento. `1,2` sobrevive (a vírgula é interna). */
function nucleo(token) {
  return semAcento(String(token || '').replace(PONTUACAO_FIM, '').replace(/^[“"(]+/, ''));
}
/* Token que FECHA a oração. O trecho nunca atravessa: destaque partido em duas orações
   não se lê como uma coisa só. */
function fecha(token) {
  return PONTUACAO_FIM.test(String(token || ''));
}

function candidato(tokens, i) {
  var alvo = nucleo(tokens[i]);
  if (!alvo) return null;

  if (NUMERO_FORTE.test(alvo)) {
    if (ANO.test(alvo) && DATA_ANTES.indexOf(nucleo(tokens[i - 1])) >= 0) return null;
    var inicio = i;
    var temMoeda = /^r?\$/.test(alvo);
    if (!temMoeda && MOEDA.indexOf(nucleo(tokens[i - 1])) >= 0) { inicio = i - 1; temMoeda = true; }
    var fim = i;
    var temEscala = false;
    while (!fecha(tokens[fim]) && fim - inicio < TETO_SPAN
           && ESCALA.indexOf(nucleo(tokens[fim + 1])) >= 0) { fim++; temEscala = true; }
    var temUnidade = false;
    if (!fecha(tokens[fim]) && fim - inicio < TETO_SPAN
        && UNIDADE_RESULTADO.indexOf(nucleo(tokens[fim + 1])) >= 0) { fim++; temUnidade = true; }
    if (temMoeda || temEscala || alvo.indexOf('%') >= 0) return { inicio: inicio, fim: fim, peso: 4 };
    if (temUnidade) return { inicio: inicio, fim: fim, peso: 3 };
    /* Número nu: "as 3 coisas que eu faria" não fica mais claro com o 3 destacado. */
    return null;
  }

  if (TERMOS_FORTES.indexOf(alvo) >= 0 && FRACOS_NO_TITULO.indexOf(alvo) < 0) {
    return { inicio: i, fim: i, peso: 2 };
  }
  return null;
}

function cobertura(tokens, span) {
  var total = tokens.join(' ').length;
  return total ? tokens.slice(span.inicio, span.fim + 1).join(' ').length / total : 1;
}

/* Devolve `{inicio, fim}` em ÍNDICES DE TOKEN (inclusivos), ou null.
   Índice e não string: em "Gastei 50 mil e faturei 300 mil", um `replace('mil')` pintaria
   o PRIMEIRO. Devolver posição é o que impede isso. */
export function pickTitleHighlight(titulo) {
  var tokens = String(titulo || '').split(/\s+/).filter(Boolean);
  /* Frase curta já é o destaque inteiro. */
  if (tokens.length < MIN_PALAVRAS_TITULO) return null;
  var melhor = null;
  for (var i = 0; i < tokens.length; i++) {
    var cand = candidato(tokens, i);
    /* `>=` e não `>`: no empate vence o da DIREITA, porque em PT-BR o desfecho cai no fim
       da frase ("saiu de uma pequena cidade, para **100 mil pedidos**"). */
    if (cand && (!melhor || cand.peso >= melhor.peso)) melhor = cand;
  }
  if (!melhor) return null;
  var span = { inicio: melhor.inicio, fim: melhor.fim };
  if (cobertura(tokens, span) > MAX_COBERTURA_TITULO) return null;
  return span;
}

/* Acha o trecho digitado pelo operador, comparando por núcleo (sem acento, sem pontuação)
   para não exigir que ele copie a pontuação do título. */
function acharTrecho(tokens, trecho) {
  var alvo = String(trecho).split(/\s+/).map(nucleo).filter(Boolean);
  if (!alvo.length) return null;
  for (var i = 0; i + alvo.length <= tokens.length; i++) {
    var bate = true;
    for (var j = 0; j < alvo.length; j++) {
      if (nucleo(tokens[i + j]) !== alvo[j]) { bate = false; break; }
    }
    if (bate) return { inicio: i, fim: i + alvo.length - 1 };
  }
  return null;
}

/* Conjunto FECHADO de desfechos — mesma disciplina do `CAPTION_STATES` do serve.py: estado
   que pode sair sem ninguém ter frase do outro lado é o erro mudo. */
export const TITULO_ORIGEM = ['manual', 'auto', 'nenhum', 'manual-sem-correspondencia'];

/* O GATE que o Clip.jsx chama. É função pura e exportada de propósito: escrito à mão lá
   dentro, trocá-lo por uma chave que não existe desligaria o destaque em TODO título, sem
   erro nenhum e com a suíte verde — a armadilha que já criou o `ancoraLegenda` e o
   `palavrasDaPagina` neste mesmo arquivo. */
export function resolveTitleHighlight(titulo, opcoes) {
  var op = opcoes || {};
  var tokens = String(titulo || '').split(/\s+/).filter(Boolean);
  var manual = String(op.highlightText || '').trim();
  if (manual) {
    var achado = acharTrecho(tokens, manual);
    /* Trecho digitado que não existe no título NÃO cai no automático: o operador fez uma
       escolha explícita, e destacar outra coisa no lugar seria pior que não destacar. O
       estado sai daqui para quem chama poder dizer (BP-008) — ignorar calado é a
       automação muda. */
    return achado ? { span: achado, origem: 'manual' }
                  : { span: null, origem: 'manual-sem-correspondencia' };
  }
  if (op.autoHighlight === false) return { span: null, origem: 'nenhum' };
  var auto = pickTitleHighlight(titulo);
  return auto ? { span: auto, origem: 'auto' } : { span: null, origem: 'nenhum' };
}

/* ------------------------------------------------- tamanho do título no card */

/* Escada de tamanhos, do maior para o menor. Escada e não fórmula contínua de propósito: o
   pedido exige regra DETERMINÍSTICA, e um número redondo por degrau é o que faz dois
   títulos de tamanho parecido saírem no MESMO corpo em vez de em 47,3 e 46,8px — variação
   que o espectador lê como descuido.
   O primeiro degrau é maior que os 50px que o título sempre teve: com o card por trás, o
   texto não disputa mais legibilidade com a imagem e pode crescer. O ÚLTIMO é o piso: 36px
   num quadro de 1080 ainda é lido num celular. */
export const TITULO_FONTES = [58, 52, 46, 41, 36, 32];
export const MAX_LINHAS_TITULO = 3;
/* Largura média de avanço da Montserrat ExtraBold, em em. Mesmo modelo do
   `MAX_CHARS_LINHA` da legenda (que usa 0.55 para a Inter Bold) — a Montserrat é mais
   larga. É o BOTÃO DE CALIBRAGEM desta escada: subir estima linhas mais cheias e desce o
   corpo antes; descer deixa o texto crescer e arrisca a quarta linha. Conferido OLHANDO o
   frame, que é o único jeito de conferir métrica de fonte. */
export const AVANCO_MONTSERRAT = 0.58;

/* Largura de texto DENTRO do card: o card menos a borda dos dois lados, menos os dois
   paddings e menos o filete da esquerda, que ocupa largura real (o `paddingLeft` do card
   abre espaço para ele). Errar isto para mais é a origem clássica do estouro — e o card é
   `border-box`, então a borda sai de dentro dos 820px, não soma a eles. */
export function larguraTitulo() {
  return TOKENS.cardLargura - 2 * TOKENS.cardBordaPeso - 2 * TOKENS.cardPadding
    - TOKENS.tituloFilete;
}

function charsPorLinha(fonte) {
  return Math.floor(larguraTitulo() / (fonte * AVANCO_MONTSERRAT));
}

function noSpan(span, i) {
  return !!span && i >= span.inicio && i <= span.fim;
}

/* Quebra gulosa por PALAVRA — nunca no meio de uma. Devolve o número de linhas, ou
   Infinity quando uma palavra sozinha não cabe na linha: sem essa saída, "empreendedorismo"
   num corpo grande estouraria a caixa em vez de forçar o degrau seguinte, e estouro
   horizontal é o que o pedido proíbe. */
function linhasEm(pesos, cpl) {
  if (cpl < 1) return Infinity;
  var linhas = 1;
  var atual = 0;
  for (var i = 0; i < pesos.length; i++) {
    if (pesos[i] > cpl) return Infinity;
    var somado = atual ? atual + 1 + pesos[i] : pesos[i];
    if (somado <= cpl) { atual = somado; } else { linhas++; atual = pesos[i]; }
  }
  return linhas;
}

/* Título + trecho destacado -> `{fonte, linhas, texto, cortado}`. PURA.
   Desce a escada até caber em `MAX_LINHAS_TITULO`. Os tokens do destaque pesam mais porque
   são RENDERIZADOS maiores (`tituloDestaqueFator`) — medir o título como se fossem normais
   é como a terceira linha vira quarta calada.
   Só quando nem o piso cabe é que o texto é aparado, em fronteira de PALAVRA e com
   reticência à vista. Aparar é o último recurso e não o primeiro: o pedido manda reduzir o
   corpo, e cortar texto que ninguém pediu para cortar é pior que um título miúdo. Com
   `topic` limitado a 140 caracteres na origem, o piso já cobre o caso normal. */
export function tituloEscalonado(texto, span) {
  var tokens = String(texto || '').split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return { fonte: TITULO_FONTES[0], linhas: 0, texto: '', cortado: false };
  }
  var pesos = tokens.map(function (token, i) {
    return token.length * (noSpan(span, i) ? TOKENS.tituloDestaqueFator : 1);
  });
  for (var d = 0; d < TITULO_FONTES.length; d++) {
    var linhas = linhasEm(pesos, charsPorLinha(TITULO_FONTES[d]));
    if (linhas <= MAX_LINHAS_TITULO) {
      return { fonte: TITULO_FONTES[d], linhas: linhas, texto: tokens.join(' '), cortado: false };
    }
  }
  var piso = TITULO_FONTES[TITULO_FONTES.length - 1];
  /* Um caractere reservado para a reticência, que também ocupa espaço. Sem isso a última
     linha sai um caractere mais larga do que a conta autorizou. */
  var cpl = Math.max(1, charsPorLinha(piso) - 1);
  var mantidos = [];
  var usadas = 1;
  var atual = 0;
  for (var i = 0; i < tokens.length; i++) {
    var peso = pesos[i];
    /* Palavra larga demais para a linha para aqui — mas nunca devolve título vazio: a
       primeira entra de qualquer jeito. */
    if (peso > cpl && mantidos.length) break;
    var somado = atual ? atual + 1 + peso : peso;
    if (somado > cpl) {
      if (usadas >= MAX_LINHAS_TITULO) break;
      usadas++;
      somado = peso;
    }
    atual = somado;
    mantidos.push(tokens[i]);
  }
  if (!mantidos.length) mantidos = [tokens[0]];
  return {
    fonte: piso,
    linhas: Math.min(usadas, MAX_LINHAS_TITULO),
    texto: mantidos.join(' ') + '…',
    cortado: mantidos.length < tokens.length,
  };
}

/* ------------------------------------------------------------ entrada do card */

/* Progresso 0..1 -> opacidade, subida e escala do card. PURA e exportada pelo motivo que
   este arquivo já aprendeu três vezes (`ancoraLegenda`, `palavrasDaPagina`, `popPalavra`):
   é a POLARIDADE que erra calada. Inverter a subida faz o card DESCER para o lugar, e
   `1 - p` no lugar de `p` o faz sumir depois de entrar — as duas coisas passam em qualquer
   asserção de texto sobre o Clip.jsx e só aparecem olhando o frame.
   Fora do intervalo é grampeado: o card entra uma vez e fica PARADO pelo resto do corte. */
/* Quanto do card está no ar no quadro `q` de uma janela de `total` quadros: 0 antes de
   entrar, 1 no ar, 0 depois de sair. LINEAR — o easing é aplicado por quem chama.
   PURA e exportada pelo mesmo motivo do `entradaCard`: é a POLARIDADE DA SAÍDA que erra
   calada. Trocar `total - q` por `q` faz o card sumir logo depois de entrar e ficar
   invisível o resto da janela, e isso passa em qualquer asserção de texto sobre o Clip.jsx
   — só aparece olhando o vídeo, num trecho de 4s que ninguém repara que faltou. */
export function presencaCard(quadro, total) {
  var q = Number(quadro);
  var t = Number(total);
  if (!isFinite(q) || !isFinite(t) || t <= 0) return 0;
  if (q < 0 || q >= t) return 0;
  var entrada = Math.max(1, TOKENS.cardEntradaQuadros);
  var saida = Math.max(1, TOKENS.cardSaidaQuadros);
  /* Janela curta demais para entrar E sair (clipe de 1s, calibragem exagerada): reparte o
     que há em vez de deixar as duas rampas se atropelarem — sobrepostas, elas produziriam
     progresso maior que 1 na entrada e negativo na saída, ou seja um card que estoura de
     tamanho e depois pisca. */
  if (entrada + saida > t) {
    entrada = Math.max(1, Math.floor(t / 2));
    saida = Math.max(1, t - entrada);
  }
  if (q < entrada) return q / entrada;
  var faltam = t - q;
  if (faltam <= saida) return faltam / saida;
  return 1;
}

export function entradaCard(progresso) {
  var p = Number(progresso);
  if (!isFinite(p)) p = 1;
  p = Math.max(0, Math.min(1, p));
  return {
    opacidade: p,
    /* Começa ABAIXO e sobe: em CSS o Y cresce para baixo, então o deslocamento inicial é
       positivo e vai a zero. `|| 0` mata o -0, como no `popPalavra`. */
    subida: TOKENS.cardSubida * (1 - p) || 0,
    escala: TOKENS.cardEscalaInicial + (1 - TOKENS.cardEscalaInicial) * p,
  };
}

/* Título -> pedaços para o React, com o trecho destacado isolado. Espelha o
   `splitEmphasis`: pedaços em vez de HTML mantêm a composição sem dangerouslySetInnerHTML. */
export function splitTitleHighlight(titulo, span) {
  var tokens = String(titulo || '').split(/\s+/).filter(Boolean);
  if (!span || !(span.inicio >= 0) || !(span.fim < tokens.length) || span.fim < span.inicio) {
    return [{ texto: tokens.join(' '), forte: false }];
  }
  var pedacos = [];
  var antes = tokens.slice(0, span.inicio).join(' ');
  var depois = tokens.slice(span.fim + 1).join(' ');
  if (antes) pedacos.push({ texto: antes + ' ', forte: false });
  pedacos.push({ texto: tokens.slice(span.inicio, span.fim + 1).join(' '), forte: true });
  if (depois) pedacos.push({ texto: ' ' + depois, forte: false });
  return pedacos;
}

/* ==================================================================================
   AS DUAS IDENTIDADES DO CARD DE TÍTULO
   ==================================================================================
   O card nasceu com UMA marca (Ecommerce Puro, monocromática) e no mesmo dia foi trocado
   pela do Primo Rico (preto e laranja) — a segunda apagou a primeira, e o operador ficou
   sem poder escolher. Aqui elas passam a COEXISTIR.

   O que é comum fica FORA daqui de propósito, num lugar só: a escada de corpo
   (`TITULO_FONTES`/`tituloEscalonado`), a quebra por palavra, o teto de 3 linhas, o aparo
   com reticência, a janela de 4s do card (`presencaCard`/`entradaCard`) e — o mais
   importante — o algoritmo de destaque (`pickTitleHighlight`/`resolveTitleHighlight`/
   `splitTitleHighlight`). Um segundo algoritmo de destaque por marca é justamente o que
   este pedido proíbe, e seria a origem óbvia de duas marcas destacando trechos diferentes
   da MESMA manchete.

   O que cada marca possui é a IDENTIDADE: a placa, o identificador, a cor e a APARÊNCIA do
   destaque. Nada mais. */

/* O valor canônico, e é ele que atravessa tela -> POST -> servidor -> props -> composição.
   Conjunto FECHADO, pela mesma razão do `serve.CAPTION_STATES`: valor desconhecido que
   chegasse ao renderizador não tem aparência definida, e o desfecho seria um card sem
   marca nenhuma, calado. */
/* SEM card nenhum. É um valor do MESMO conjunto, e não uma segunda chave (um
   `titleCardOff: true` ao lado exigiria decidir quem manda quando os dois discordassem).
   Já existia um jeito de não ter card — apagar o título —, mas ele custa o título, que
   também nomeia o arquivo baixado e o cartão na Central. Esta opção separa as duas coisas:
   guarda a manchete e só não a queima no vídeo. */
export const TITLE_CARD_SEM = 'nenhum';

/* LITERAIS, e não `TITLE_CARD_SEM` interpolado: esta lista é lida como TEXTO por regex pelo
   `serve.py` e pelo `video-ops.js` (as duas outras cópias do conjunto, que não têm como
   importar este módulo). Com a constante no meio, os leitores extraíam o NOME dela em vez do
   valor e a paridade acusava divergência falsa. O check 13a2 amarra as duas pontas. */
export const TITLE_CARD_STYLES = ['primo_rico', 'puro_ecommerce', 'nenhum'];

/* O PADRÃO é `primo_rico` porque é o que TODO corte já renderiza hoje: clip salvo antes
   desta entrega não tem a chave, e trocar a marca dele por causa de um refactor seria
   mudar a aparência de vídeo antigo sem ninguém pedir. E o padrão NUNCA é `nenhum`: valor
   torto tem de cair na marca de sempre, não apagar o card calado. */
export const TITLE_CARD_PADRAO = 'primo_rico';

/* O rótulo da tela NUNCA é a chave da lógica: é isto que impede "Puro Ecommerce" (com
   espaço, com acento, escrito de outro jeito amanhã) de virar identificador. */
export const TITLE_CARD_LABELS = {
  primo_rico: 'Primo Rico',
  puro_ecommerce: 'Puro Ecommerce',
  nenhum: 'Sem card',
};

/* PURA, exportada, e o ÚNICO validador do valor. Desconhecido, ausente, `null`, número,
   objeto, rótulo da tela — tudo cai no padrão em vez de derrubar o render ou produzir card
   sem marca. É a mesma regra que o `video-ops.js` espelha para o navegador e o `serve.py`
   espelha para o servidor (as três cópias têm check de paridade: divergirem faria a tela
   mandar um valor que o servidor descarta, e o vídeo sairia com a outra marca). */
export function titleCardStyleOf(valor) {
  return TITLE_CARD_STYLES.indexOf(valor) >= 0 ? valor : TITLE_CARD_PADRAO;
}

/* Espessura do sublinhado do destaque, em `em` do corpo do título. Sai do `tituloFilete`
   para a régua do card e a do texto terem a MESMA espessura no primeiro degrau da escada —
   uma linguagem só de linha branca no quadro, não duas larguras diferentes. Dividir pelo
   degrau de referência é o que faz o sublinhado ENCOLHER junto com o corpo, em vez de
   encostar no acento da linha de baixo (armadilha já medida: 4px fixos deixavam 0,7px de
   folga no degrau de 32px). */
export const TITULO_FILETE_REF = 58;

/* O registro. Cada entrada é dona da sua identidade e NÃO alcança a da outra: o
   `CardTitulo` recebe um destes objetos e a marca já resolvida, então nenhum `if` de marca
   sobra dentro do JSX — que é onde a fiação erra calada neste projeto. */
export const TITLE_CARD_PRESETS = {
  /* ---- Primo Rico: preto e laranja. A cor foi MEDIDA na referência (#FF5F01 é a
     cromática dominante; 82% do quadro é #000000), não escolhida. O destaque do título é
     COR, e é por isso que ele não soma peso nem sublinhado: cor + 8% de corpo já carregam
     a ênfase, e empilhar três sinais para dizer uma coisa só é o que vira "cara de
     template". */
  primo_rico: {
    marca: 'primo_rico',
    /* Filete da esquerda do card: cromo da marca. */
    fileteCor: TOKENS.marcaLaranja,
    /* Borda laranja de opacidade controlada — contorno próprio sobre qualquer quadro, sem
       virar moldura acesa. */
    bordaCor: 'rgba(255, 95, 1, .30)',
    /* Identificador em branco a 72%, e não em laranja: o emblema, a borda, o filete e o
       trecho destacado já são laranja; um quinto elemento na cor da marca faria o card
       competir consigo mesmo. */
    identificadorCor: 'rgba(255, 255, 255, .72)',
    tituloPeso: 900,
    destaque: {
      cor: TOKENS.marcaLaranja,
      /* MESMO peso do resto do título. */
      peso: 900,
      sublinhado: false,
    },
  },
  /* ---- Ecommerce Puro: monocromático, e por MEDIÇÃO. O README da identidade registra
     0 pixels cromáticos no logo de referência — não existe cor de destaque para extrair
     dele, e inventar uma seria inventar a marca. Sem cor, a hierarquia do destaque volta a
     ser o que era antes de o laranja existir: PESO (800 -> 900), corpo (+8%) e o filete
     branco, que é a régua que já ladeia o `PURO` na própria placa.
     A tipografia é a MESMA Inter do resto do projeto, e isso também é o README: "O texto
     do card continua em Inter. Montserrat só na marca" — e a marca está em curvas no SVG,
     então nenhuma FAMÍLIA de fonte nova entra por causa desta segunda identidade. */
  puro_ecommerce: {
    marca: 'puro_ecommerce',
    fileteCor: TOKENS.texto,
    /* Branca a 14%, como era quando o card não tinha cor de marca. */
    bordaCor: 'rgba(255, 255, 255, .14)',
    /* Sem identificador de texto (a placa já traz o wordmark), então esta cor não chega a
       ser usada. Declarada para o registro ter a mesma forma nas duas entradas. */
    identificadorCor: 'rgba(255, 255, 255, .72)',
    /* 800 e não 900: aqui o 900 é o DESTAQUE, e base e destaque no mesmo peso não
       deixariam nada destacado. Os dois são Inter, e o 800 é o único peso novo desta
       entrega (mesma família, nenhuma dependência nova). */
    tituloPeso: 800,
    destaque: {
      /* Sem cor própria: o texto do título já é `TOKENS.texto`, e o que muda é o peso. */
      cor: TOKENS.texto,
      peso: 900,
      sublinhado: true,
    },
  },
};

/* O preset resolvido, pronto para o componente. Passa pelo `titleCardStyleOf`, então
   qualquer valor torto devolve o card do Primo Rico em vez de `undefined` — que no JSX
   viraria um card sem placa, sem filete e sem borda, sem erro nenhum. */
export function titleCardPreset(valor) {
  var chave = titleCardStyleOf(valor);
  /* `null` é desfecho LEGÍTIMO — "o operador escolheu não ter card" — e nunca sintoma de
     valor quebrado: valor torto já caiu na marca padrão dentro do `titleCardStyleOf`. Mesma
     disciplina do `if override is not None` do serve.py: apagar de propósito não pode ser
     confundido com não ter dado. Quem consome TEM de tratar o `null` — o `Clip.jsx` o
     consulta no portão do card, e ignorá-lo derruba o render (`card.marca` de `null`).
     O ramo é explícito só por LEGIBILIDADE: um `TITLE_CARD_PRESETS[chave] || null` se
     comporta igual para toda entrada de hoje (medido — nenhuma prova distingue os dois), e
     quem protege o caso futuro (uma identidade declarada em `TITLE_CARD_STYLES` sem entrada
     no registro) é o check 13a3, que compara os dois tamanhos. */
  if (chave === TITLE_CARD_SEM) return null;
  return TITLE_CARD_PRESETS[chave];
}

/* A GEOMETRIA é compartilhada, e esta lista é o contrato que torna isso seguro.
   O `larguraTitulo()` mede a caixa de texto a partir de `cardLargura`, `cardBordaPeso`,
   `cardPadding` e `tituloFilete` — todos em `TOKENS`, ou seja UM valor para as duas
   marcas. Isso está certo hoje: os dois cards têm o mesmo tamanho, o mesmo respiro e o
   mesmo filete de 4px, e a placa de 62px é o tamanho verificado nas DUAS identidades (o
   README do Ecommerce Puro fixa 62px para este card, e o emblema do Primo Rico usa o mesmo
   `logoAltura`).
   Se um dia uma marca ganhar padding ou filete próprio, esta função deixa de dizer a
   verdade para ela e a estimativa de linhas passa a mentir PARA MAIS — o estouro
   horizontal clássico. Daí a lista: o check 13n cobra que nenhum preset traga geometria
   própria, e quem acrescentar uma reprova lá com o recado de passar o preset ao
   `larguraTitulo`/`tituloEscalonado`, em vez de descobrir o estouro no frame. */
export const TITULO_GEOMETRIA_COMPARTILHADA = [
  'cardLargura', 'cardBordaPeso', 'cardPadding', 'tituloFilete', 'tituloDestaqueFator',
  'tituloEntrelinha', 'cardCentroPct', 'cardRaio', 'cardFundo', 'cardSombra',
  'logoAltura', 'logoFolga', 'marcaNomeFonte',
  'cardEntradaQuadros', 'cardSaidaQuadros', 'cardSubida', 'cardEscalaInicial',
  'cardDuracaoSeg',
];

/* ============================================================ estilos de LEGENDA

   Até aqui a legenda tinha UMA aparência, escrita direto nos `TOKENS` e lida pelo
   `Clip.jsx`. Este registro é o MESMO movimento que o `TITLE_CARD_PRESETS` já fez com o
   card: a tipografia vira dado, o componente recebe UM objeto resolvido, e nenhum `if` de
   estilo sobra dentro do JSX — que é onde a fiação erra calada neste projeto.

   O que NÃO diverge por estilo, e por isso continua nos `TOKENS`: a LARGURA da coluna
   (`legendaLargura`, os 820px que passam por baixo da trilha de botões do TikTok), a ÂNCORA
   (`legendaBase`, calculada pelo servidor e compartilhada com o FFmpeg/ASS) e o teto de
   linhas (`MAX_LINHAS`). Estilo escolhe tipografia; geometria de plataforma não é gosto.
   O check 15h cobra que nenhum preset traga largura ou âncora própria. */

/* LITERAIS, e não constantes interpoladas: esta lista é lida como TEXTO por regex pelo
   `serve.py` e pelo `video-ops.js` — as outras duas cópias do conjunto, que não têm como
   importar este módulo. Com uma constante no meio, o leitor extrai o NOME dela em vez do
   valor e a paridade acusa divergência falsa (já aconteceu com o `TITLE_CARD_STYLES`). */
export const LEGENDA_STYLES = ['classico', 'impacto'];

/* O padrão é o `classico` porque ele É a legenda que todo corte já renderiza hoje: trecho
   salvo antes desta entrega não tem a chave, e trocar a aparência de vídeo antigo por causa
   de um recurso novo seria mudar o passado sem ninguém pedir. */
export const LEGENDA_PADRAO = 'classico';

/* O rótulo da tela NUNCA é a chave da lógica. */
export const LEGENDA_LABELS = {
  classico: 'Legenda clássica',
  impacto: 'Impacto (caixa alta)',
};

/* PURA, exportada, e o ÚNICO validador do valor — a mesma regra do `titleCardStyleOf`, e
   espelhada no `serve.py` e no `video-ops.js`. Desconhecido, ausente, `null`, número e
   rótulo de tela caem no padrão: um valor torto chegando ao registro viraria `undefined`,
   ou seja uma legenda sem fonte, sem corpo e sem cor, sem erro nenhum. */
export function legendaStyleOf(valor) {
  return LEGENDA_STYLES.indexOf(valor) >= 0 ? valor : LEGENDA_PADRAO;
}

/* --------------------------------------------------------- avanço médio das fontes */

/* Largura média de AVANÇO, em `em` do corpo — a mesma convenção do `MAX_CHARS_LINHA`
   (820 / (58 * 0.55) ~= 25) e do `AVANCO_MONTSERRAT` do título.
   MEDIDO no arquivo que o projeto já tem em disco (`video-worker/fonts/Inter-Bold.ttf`,
   lido com fontTools, média ponderada pela frequência das letras do português): 0,559em em
   caixa baixa — ou seja, o 0,55 que já estava aqui, confirmado por medição e não por
   herança. */
export const AVANCO_INTER = 0.55;

/* A MESMA Inter Bold, o MESMO texto, em CAIXA ALTA: 0,683em. Caixa alta não é a mesma linha
   com letra maiúscula — é uma linha 22% mais comprida, e é exatamente por isso que um estilo
   em caixa alta não pode herdar o teto de caracteres do estilo em caixa baixa. */
export const AVANCO_INTER_CAIXA_ALTA = 0.683;

/* ESTIMADO, não medido — e o comentário existe para ninguém tratá-lo como medição: a
   Archivo Black NÃO está em disco neste projeto (o Remotion a busca no Google na hora do
   render), então o número sai da medição acima (0,683em) mais 15% de folga por ser um
   desenho black e largo contra um bold.
   É CONSERVADOR de propósito, e a assimetria importa: superestimar o avanço fecha a página
   mais cedo — página curta, que é justamente o efeito deste estilo; subestimar deixa a
   linha estourar a coluna de 820px e a página vira três linhas altas demais para a folga
   dentro do vídeo. Na dúvida, para cima.
   BOTÃO DE CALIBRAGEM: com o arquivo da fonte em mãos, medir e trocar este número. */
export const AVANCO_ARCHIVO_BLACK = 0.78;

/* Quantos caracteres cabem numa linha da coluna da legenda com ESTE corpo e ESTA fonte.
   É a conta do `MAX_CHARS_LINHA` com os dois parâmetros à mostra em vez de cravados: o
   estilo novo muda o corpo E a fonte ao mesmo tempo, e um dos dois esquecido dá uma legenda
   que estoura a coluna sem erro nenhum. Entrada torta devolve o teto de hoje em vez de
   `NaN`, que viraria página de zero caractere e laço infinito no `toCaptionPages`. */
export function charsPorLinhaLegenda(fonte, avanco) {
  var corpo = Number(fonte);
  var a = Number(avanco);
  if (!isFinite(corpo) || corpo <= 0 || !isFinite(a) || a <= 0) return MAX_CHARS_LINHA;
  return Math.max(1, Math.floor(TOKENS.legendaLargura / (corpo * a)));
}

/* Teto de caracteres de uma PÁGINA deste estilo — é o argumento do `toCaptionPages`, que
   conta a página inteira e não a linha. Existe como função, e não como campo do registro,
   porque é valor DERIVADO: gravado à mão no preset, ele passaria a mentir no dia em que
   alguém ajustasse o corpo da fonte e esquecesse o teto. */
export function tetoDaPagina(estilo) {
  var e = estilo || LEGENDA_PRESETS[LEGENDA_PADRAO];
  return charsPorLinhaLegenda(e.fonte, e.avanco) * MAX_LINHAS;
}

/* --------------------------------------------------------- o registro */

export const LEGENDA_PRESETS = {
  /* ---- Clássico: a legenda de hoje, sem um valor diferente. Ele NÃO repete número
     nenhum — cada campo aponta para o token que o `Clip.jsx` já lia —, e é isso que faz o
     check 15b ("o clássico não muda nada") ser verdadeiro por construção em vez de por
     conferência de dois números iguais escritos em lugares diferentes. */
  classico: {
    familia: 'inter',
    caixaAlta: false,
    fonte: TOKENS.legendaFonte,
    peso: TOKENS.legendaPeso,
    entrelinha: TOKENS.legendaEntrelinha,
    /* `normal` e não 0: é o valor que o CSS usa quando ninguém mexeu, e a legenda de hoje
       não declara `letterSpacing` nenhum. */
    tracking: 'normal',
    avanco: AVANCO_INTER,
    cor: TOKENS.texto,
    sombra: TOKENS.sombraTexto,
    /* Ênfase semântica do caminho ESTÁTICO (sem tempo por palavra): peso 900 mais a cor da
       categoria, exatamente como estava escrito no componente. */
    pesoDestaque: 900,
    palavraCores: TOKENS.palavraCores,
    palavraEscala: TOKENS.palavraEscala,
    palavraSubida: TOKENS.palavraSubida,
  },

  /* ---- Impacto: caixa alta, corpo grande, uma grotesca black. É o estilo de canal de
     negócio que o operador pediu, e a direção continua a mesma — o que muda é a ESCALA da
     tipografia, não a quantidade de efeito: nenhuma animação nova entra aqui, a página
     segue estática e quem se mexe continua sendo só a palavra sendo dita.

     Archivo Black, e não Inter 900 em caixa alta: a diferença que se vê no frame é a
     LARGURA do desenho, não o peso — uma black larga preenche a coluna, e é isso que dá a
     leitura de "letreiro" da referência. E não uma condensada (Anton e parecidas): a
     referência é larga, e condensada em caixa alta a 72px vira manchete de jornal.

     Peso 400 NÃO é engano: a família Archivo Black tem UM peso, e o preto já está no
     desenho. Pedir 700 ou 900 aqui faz o Chrome SINTETIZAR o negrito por cima de um peso
     que já é máximo — engrossamento borrado que só aparece olhando o frame, a mesma
     armadilha que o comentário do peso 800 da Inter registra no `Clip.jsx`. */
  impacto: {
    familia: 'archivo_black',
    caixaAlta: true,
    /* 72px contra os 58 do clássico. Com 820px de coluna e o avanço estimado, dá 14
       caracteres por linha: "A MAIORIA / NÃO VAI" cabe em duas linhas, que é o formato da
       referência. BOTÃO DE CALIBRAGEM do estilo — e note que subir daqui ENCURTA a página
       sozinho, porque o teto de caracteres é derivado do corpo. */
    fonte: 72,
    peso: 400,
    /* 1.10 e não os 1.18 do clássico: corpo grande pede entrelinha proporcionalmente menor,
       senão as duas linhas parecem dois blocos soltos. E não menos que isto: em caixa alta
       o Ã e o Õ do português ocupam a folga que o `A` não usa, e abaixo de ~1.06 o til da
       linha de baixo encosta na base da linha de cima. */
    entrelinha: 1.10,
    /* Fecha 1% do avanço. A fonte já é larga; tracking negativo forte aqui gruda as
       hastes. */
    tracking: '-0.01em',
    avanco: AVANCO_ARCHIVO_BLACK,
    cor: TOKENS.texto,
    /* Sombra mais densa que a do clássico, e pelo mesmo motivo de sempre: leitura, não
       efeito. Um bloco de caixa alta a 72px cobre muito mais imagem, então a chance de cair
       sobre parede clara é maior. Continua sem brilho colorido e sem contorno — contorno
       grosso é a assinatura do editor automático que a direção do projeto evita. */
    sombra: '0 4px 18px rgba(0,0,0,.9), 0 2px 4px rgba(0,0,0,.92)',
    /* MESMO peso do resto (a família só tem um), então a ênfase estática aqui é COR — a
       mesma escolha do card `primo_rico`, pelo mesmo motivo: empilhar três sinais para
       dizer uma coisa só é o que vira cara de template. */
    pesoDestaque: 400,
    /* O MESMO leque do clássico, e de propósito: o pedido de 2026-09-11 é do recurso, não de
       um estilo. Aqui ele era o amarelo queimado sozinho (`TOKENS.destaque`) — que continua
       sendo a ênfase ESTÁTICA da direção, e por isso a tinta não sumiu do projeto, só deixou
       de ser a da palavra ativa. Duas listas diferentes seriam dois lugares para calibrar a
       mesma decisão. */
    palavraCores: TOKENS.palavraCores,
    /* 1.06 contra 1.12 do clássico. `scale` cresce o glifo e NÃO a caixa de layout (medido
       neste projeto e registrado no `TOKENS.palavraEscala`): 12% de uma palavra de 72px em
       caixa alta transbordam mais que os mesmos 12% a 58px em caixa baixa, e o espaço entre
       palavras não cresce junto. Pop menor, mesma leitura. */
    palavraEscala: 1.06,
    palavraSubida: -5,
  },
};

/* O preset resolvido, pronto para o componente. Passa pelo `legendaStyleOf`, então valor
   torto devolve o estilo de hoje em vez de `undefined`.
   Aqui NÃO existe o desfecho `null` do card: "sem legenda" já é o preset `LIMPO` da
   composição, decidido antes, e um segundo jeito de desligar a legenda seria dois donos
   para a mesma decisão. */
export function legendaPreset(valor) {
  return LEGENDA_PRESETS[legendaStyleOf(valor)];
}

/* Os ids de FAMÍLIA que os presets podem pedir. A fonte em si é carregada no `Clip.jsx`
   (é lá que o `@remotion/google-fonts` vive), e este é o contrato entre os dois: um id novo
   no registro sem o carregamento correspondente deixaria a legenda cair na fonte de
   fallback do Chrome — legível, sem erro, e completamente fora da identidade. O check 15g
   amarra as duas pontas. */
export const LEGENDA_FAMILIAS = ['inter', 'archivo_black'];
