/* Estúdio de Vídeos — do vídeo longo ao MP4 pronto para postar.

   A navegação tem três telas:
     Central   — os clips JÁ baixados, agrupados por vídeo.
     Meus projetos — vídeos analisados e seus trechos sugeridos.
     YouTube   — cola a URL, o detector sugere trechos, baixa só o trecho e edita no Remotion.

   O pipeline de publicação (contas, material de terceiro, direitos, posts, relatórios,
   Drive, CSV) foi REMOVIDO por decisão do usuário em 2026-08-21. A chave antiga
   `pp_video_ops_v1` NÃO é lida nem apagada: os dados de quem já usava continuam
   intactos no navegador, só não têm mais tela. A persistência nova é uma lista só —
   `pp_video_clips_v1`, o registro dos clips baixados.

   Vídeo nunca entra no localStorage: só nome, intervalo e o CAMINHO em disco que o
   helper local devolve. Lógica pura exportada para test-video-ops.js. */
(function () {
  'use strict';

/* A Central é a única coisa que sobrevive ao recarregamento. Chave NOVA de propósito:
      reaproveitar pp_video_ops_v1 com outra forma jogaria fora o cadastro antigo de quem
      já usava o Estúdio, e apagar dado alheio não é papel de um refactor de tela. */
  var KEY = 'pp_video_clips_v1';
  var LIB_VERSION = 1;
  var DAYS = 90;
  var LIB = null;

  /* Projetos de vídeo: cada vídeo do YouTube analisado vira UM projeto.
     Chave separada para não misturar com clips baixados (KEY). */
  var PROJECTS_KEY = 'pp_video_projects_v1';
  var PROJECTS_VERSION = 1;
  var PROJECTS = null;
  /* Teto de sugestões guardadas por projeto. É o MESMO número do detector
     (`video-worker/ytclip.py`, MAX_CANDIDATES = 12): dois valores diferentes fariam a tela
     descartar calada sugestão que o servidor mandou. Estava sendo USADA no
     `projectsSanitize` sem existir aqui — e como a linha só é avaliada quando o projeto tem
     `candidates`, o `init` inteiro morria e a tela ficava preta só para quem já tinha
     analisado um vídeo. */
  var MAX_CANDIDATES = 12;

  /* --- identidade do card de título -------------------------------------------------
     ESPELHO do `studio/src/preset.js` (`TITLE_CARD_STYLES`/`TITLE_CARD_PADRAO`). Não é
     import: o `index.html` é Vanilla JS sem npm e sem módulos, e o preset.js é ESM do
     projeto Remotion — a mesma razão pela qual o `captions.py` copia os números da
     tipografia em vez de importá-los.
     Copiar exige guarda, e ela existe: o `test-video-ops.js` LÊ o preset.js e compara as
     duas listas e os dois padrões. Divergirem faria a tela oferecer um valor que o servidor
     descarta — e o vídeo sairia com a OUTRA marca, calado, que é o pior desfecho possível
     aqui. */
  var TITLE_CARD_STYLES = ['primo_rico', 'puro_ecommerce', 'nenhum'];
  var TITLE_CARD_PADRAO = 'primo_rico';
  /* O rótulo da tela nunca é a chave da lógica. `nenhum` = sem card no vídeo, guardando o
     título — que também nomeia o arquivo baixado e o cartão da Central. */
  var TITLE_CARD_LABELS = {
    primo_rico: 'Primo Rico', puro_ecommerce: 'Puro Ecommerce', nenhum: 'Sem card'
  };
  /* O validador. Trecho antigo (salvo antes desta entrega, sem a chave) e valor torto caem
     no padrão — que é a marca que TODO corte já renderiza hoje, então clip antigo continua
     saindo igual. */
  function titleCardStyleOf(clip) {
    var valor = clip && clip.titleCardStyle;
    return TITLE_CARD_STYLES.indexOf(valor) >= 0 ? valor : TITLE_CARD_PADRAO;
  }

  /* --- estilo da legenda --------------------------------------------------------------
     Mesmo espelho, mesma razão e mesma guarda do card acima: o dono é o
     `studio/src/preset.js` (`LEGENDA_STYLES`/`LEGENDA_PADRAO`), e o `test-video-ops.js` LÊ
     o preset.js para comparar as duas listas e os dois padrões.
     Aqui NÃO existe o "nenhum" do card: legenda desligada já é o preset `limpo` do botão de
     render, e um segundo jeito de desligar a mesma coisa seria dois donos para a decisão. */
  var LEGENDA_STYLES = ['classico', 'impacto'];
  var LEGENDA_PADRAO = 'classico';
  /* O rótulo da tela nunca é a chave da lógica. */
  var LEGENDA_LABELS = {
    classico: 'Clássica', impacto: 'Impacto'
  };
  /* O validador. Trecho salvo antes deste seletor (sem a chave) e valor torto caem no
     `classico` — a legenda que TODO corte já renderiza hoje, então clip antigo continua
     saindo igual. */
  function legendaStyleOf(clip) {
    var valor = editOf(clip).legenda.style || (clip && clip.legendaStyle);
    return LEGENDA_STYLES.indexOf(valor) >= 0 ? valor : LEGENDA_PADRAO;
  }

  /* Espelhos literais do preset.js. Só overrides válidos entram no modelo; ausência
     continua automática. Ler um projeto não migra nem regrava seus clips. */
  var LEGENDA_FONTES = ['inter', 'montserrat'];
  var LEGENDA_CORES = ['texto', 'destaque', 'destaqueGanho', 'destaquePerda', 'palavraCor'];
  var LEGENDA_ALINHAMENTOS = ['left', 'center', 'right'];
  function editOf(clip) {
    var out = { v: 1, legenda: {}, enquadramento: {} };
    var edit = clip && clip.edit;
    if (!edit || edit.v !== 1 || Array.isArray(edit)) return out;
    var legenda = edit.legenda;
    if (legenda && typeof legenda === 'object' && !Array.isArray(legenda)) {
      var sets = { style: LEGENDA_STYLES, familia: LEGENDA_FONTES,
        cor: LEGENDA_CORES, destaqueCor: LEGENDA_CORES, alinhamento: LEGENDA_ALINHAMENTOS };
      Object.keys(sets).forEach(function (key) {
        if (sets[key].indexOf(legenda[key]) >= 0) out.legenda[key] = legenda[key];
      });
      if (typeof legenda.caixaAlta === 'boolean') out.legenda.caixaAlta = legenda.caixaAlta;
      var ranges = { tamanho: [32, 96], largura: [360, 1000], posicaoPct: [0, 100] };
      Object.keys(ranges).forEach(function (key) {
        var value = legenda[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          /* Math.round porque o espelho em Python grampeia com int(round(...)): sem ele
             um corpo 72.5 viraria 72.5 na tela e 72 no .ass, e os dois renderizadores
             desenhariam tamanhos diferentes do MESMO ajuste, calados. */
          out.legenda[key] = Math.round(
            Math.min(ranges[key][1], Math.max(ranges[key][0], value)));
        }
      });
    }
    var quadro = edit.enquadramento;
    if (quadro && !Array.isArray(quadro) && REFRAMES.indexOf(quadro.reframe) >= 0) {
      out.enquadramento.reframe = quadro.reframe;
    }
    return out;
  }
  /* null restaura o automático de UM controle. O chamador persiste no projeto existente. */
  function editFieldWrite(clip, section, field, value) {
    if (!clip || ['legenda', 'enquadramento'].indexOf(section) < 0) return false;
    var edit = editOf(clip);
    if (value === null) delete edit[section][field];
    else edit[section][field] = value;
    clip.edit = editOf({ edit: edit });
    return true;
  }

  /* --- painel MANUAL da legenda -------------------------------------------------------
     O estilo (`classico`/`impacto`) continua sendo a escolha de PARTIDA; estes controles
     são o que o operador muda por cima dele, um campo de cada vez. Só o que a tela mostra
     é espelhado aqui — entrelinha, sombra e avanço não têm controle e não têm por que
     existir numa quinta cópia.

     `LEGENDA_AUTO` é o que cada estilo dá SOZINHO, e existe por causa do BP-008: um slider
     parado em 58 enquanto o estilo é `impacto` (72) mentiria sobre o que vai sair, e
     encostar nele pularia 14 px que ninguém pediu. Com o valor certo à mostra, mexer é
     ajuste; sem ele, é surpresa. O `test_serve` compara esta tabela com o `preset.js`. */
  var LEGENDA_AUTO = {
    classico: { familia: 'inter', tamanho: 58, caixaAlta: false, destaqueCor: 'palavraCor' },
    impacto: { familia: 'montserrat', tamanho: 72, caixaAlta: true, destaqueCor: 'destaque' }
  };
  /* Os que não dependem do estilo: os dois presets têm a MESMA coluna, a mesma cor de texto
     e o mesmo alinhamento. `posicaoPct` é `null` porque a âncora automática é calculada em
     Python (`captions.margem_inferior`) a partir do enquadramento — e uma fórmula
     equivalente aqui é justamente o defeito que aquela função existe para impedir. */
  var LEGENDA_AUTO_COMUM = { cor: 'texto', largura: 820, alinhamento: 'center', posicaoPct: null };
  /* Percentual de partida quando o operador decide posicionar à mão. É um número REDONDO
     escolhido pela tela, e não a âncora automática disfarçada: 75% do quadro é onde a
     legenda cai na maioria dos enquadramentos, e o ajuste fino se faz olhando o quadro
     real. Deixar o controle começar "no lugar certo" exigiria a fórmula do Python aqui. */
  var LEGENDA_POSICAO_PARTIDA = 75;
  var LEGENDA_FONTE_LABELS = { inter: 'Inter', montserrat: 'Montserrat' };
  var LEGENDA_ALINHA_LABELS = { left: 'Esquerda', center: 'Centro', right: 'Direita' };
  /* Paleta FECHADA do projeto (o `TOKENS` do preset.js), nunca uma roda de cor: a direção
     editorial proíbe neon, e um seletor livre é um convite a ele. O hexadecimal está aqui
     porque a bolinha do controle precisa dele — o VALOR gravado continua sendo o nome. */
  var LEGENDA_COR_HEX = {
    texto: '#FFFFFF', destaque: '#D9A441', destaqueGanho: '#8FB573',
    destaquePerda: '#C0554A', palavraCor: '#59E36A'
  };
  var LEGENDA_COR_LABELS = {
    texto: 'Branco', destaque: 'Âmbar', destaqueGanho: 'Verde',
    destaquePerda: 'Vermelho', palavraCor: 'Verde-claro'
  };
  /* O que o download rápido (FFmpeg/ASS) NÃO reproduz do que a tela deixa escolher.
     Espelha o `captions.ASS_NAO_REPRODUZ`, e está na tela ao lado do botão que usa aquele
     caminho: um renderizador que entrega outra coisa calado é o defeito que o BP-008
     existe para matar. */
  var ASS_NAO_REPRODUZ = [
    'o destaque da palavra sendo dita (a página inteira sai na cor principal)',
    'a animação de entrada da palavra',
    'o desfoque da sombra (o ASS só tem sombra dura, deslocada)'
  ];

  /* O que o controle MOSTRA: o valor manual quando existe, senão o automático do estilo.
     `manual` é o que acende o marcador da linha — valor automático e valor escolhido nunca
     podem parecer a mesma coisa (BP-008). PURA: o teste chama com um trecho construído. */
  function legendaValor(clip, chave) {
    var manual = editOf(clip).legenda;
    var auto = LEGENDA_AUTO[legendaStyleOf(clip)] || LEGENDA_AUTO[LEGENDA_PADRAO];
    var padrao = Object.prototype.hasOwnProperty.call(auto, chave)
      ? auto[chave] : LEGENDA_AUTO_COMUM[chave];
    var temManual = Object.prototype.hasOwnProperty.call(manual, chave);
    return { valor: temManual ? manual[chave] : padrao, manual: temManual };
  }
  /* Quantos controles o operador já tirou do automático. É o que a faixa de estado mostra
     — inclusive o caso em que ela NÃO age ("tudo automático"), que é o ramo que o BP-008
     cobra e o que um painel mudo deixaria indistinguível de um painel quebrado. */
  function legendaManuais(clip) {
    var edit = editOf(clip);
    return Object.keys(edit.legenda).length + Object.keys(edit.enquadramento).length;
  }

  function legRowHTML(clip, chave, rotulo, controle) {
    var estado = legendaValor(clip, chave);
    return '<div class="vop-leg-row" data-leg-row="' + esc(chave) + '"'
      + ' data-manual="' + (estado.manual ? '1' : '0') + '">'
      + '<span class="vop-leg-lab">' + esc(rotulo) + '</span>'
      + '<div class="vop-leg-ctl">' + controle + '</div>'
      /* O botão de voltar ao automático existe SEMPRE, e não só quando há override: um
         botão que aparece e some muda a largura da linha no meio do ajuste. Desabilitado
         quando não há o que desfazer diz a mesma coisa sem mexer no layout. */
      + '<button class="vop-leg-auto" type="button" data-act="leg-auto"'
      + ' data-id="' + esc(clip.id) + '" data-key="' + esc(chave) + '"'
      + (estado.manual ? '' : ' disabled')
      + ' title="Voltar este controle ao automático">auto</button>'
      + '</div>';
  }
  /* Radios NATIVOS, como o card e o enquadramento: o `:checked` desenha o selecionado, a
     navegação por seta vem de graça e não há JS de estado visual para dessincronizar do
     dado. O `name` leva o id do trecho E a chave — um `name` só faria os grupos brigarem. */
  function legRadiosHTML(clip, chave, opcoes, rotulo) {
    var estado = legendaValor(clip, chave);
    return legRowHTML(clip, chave, rotulo, '<div class="vop-leg-seg">'
      + opcoes.map(function (opcao) {
        var valor = String(opcao[0]);
        var id = 'leg-' + chave + '-' + clip.id + '-' + valor;
        return '<input type="radio" id="' + esc(id) + '"'
          + ' name="leg-' + esc(chave) + '-' + esc(clip.id) + '"'
          + ' data-leg-field="' + esc(chave) + '" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(valor) + '"' + (String(estado.valor) === valor ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '"' + (opcao[2] ? ' style="--sw:' + esc(opcao[2]) + '"' : '')
          + '>' + esc(opcao[1]) + '</label>';
      }).join('') + '</div>');
  }
  function legRangeHTML(clip, chave, rotulo, min, max, passo, sufixo) {
    var estado = legendaValor(clip, chave);
    var valor = num(estado.valor);
    return legRowHTML(clip, chave, rotulo, '<div class="vop-leg-range">'
      + '<input type="range" min="' + min + '" max="' + max + '" step="' + passo + '"'
      + ' value="' + valor + '" data-leg-field="' + esc(chave) + '"'
      + ' data-id="' + esc(clip.id) + '" aria-label="' + esc(rotulo) + '">'
      + '<output data-leg-out="' + esc(chave) + '">' + valor + esc(sufixo) + '</output>'
      + '</div>');
  }
  /* O painel inteiro. Fica DEPOIS do seletor de estilo e antes do enquadramento, que é a
     ordem em que a decisão acontece: escolho a aparência de partida, ajusto o que não
     serviu, e só então decido o recorte. */
  function legendaPanelHTML(clip) {
    var manuais = legendaManuais(clip);
    var posicao = legendaValor(clip, 'posicaoPct');
    return '<div class="vop-leg" data-leg="' + esc(clip.id) + '">'
      /* Faixa de estado: TODO ramo fala, inclusive o que não fez nada (BP-008). */
      + '<p class="vop-leg-state" data-leg-state data-tone="' + (manuais ? 'manual' : 'auto') + '">'
      + esc(manuais
        ? manuais + (manuais > 1 ? ' controles ajustados' : ' controle ajustado')
          + ' à mão — o resto segue o estilo.'
        : 'Tudo automático: a legenda segue o estilo escolhido acima.') + '</p>'
      + legRadiosHTML(clip, 'familia', [['inter', LEGENDA_FONTE_LABELS.inter],
        ['montserrat', LEGENDA_FONTE_LABELS.montserrat]], 'Fonte')
      + legRangeHTML(clip, 'tamanho', 'Corpo', 32, 96, 2, 'px')
      + legRadiosHTML(clip, 'caixaAlta', [['false', 'Caixa baixa'], ['true', 'CAIXA ALTA']], 'Caixa')
      + legRadiosHTML(clip, 'cor', LEGENDA_CORES.map(function (c) {
        return [c, LEGENDA_COR_LABELS[c], LEGENDA_COR_HEX[c]];
      }), 'Cor do texto')
      + legRadiosHTML(clip, 'destaqueCor', LEGENDA_CORES.map(function (c) {
        return [c, LEGENDA_COR_LABELS[c], LEGENDA_COR_HEX[c]];
      }), 'Cor do destaque')
      + legRangeHTML(clip, 'largura', 'Coluna', 360, 1000, 20, 'px')
      + legRadiosHTML(clip, 'alinhamento', LEGENDA_ALINHAMENTOS.map(function (a) {
        return [a, LEGENDA_ALINHA_LABELS[a]];
      }), 'Alinhamento')
      /* A posição vertical é o único controle que NASCE sem número: a âncora automática é
         calculada no servidor (`captions.margem_inferior`), a partir do enquadramento, e
         repeti-la aqui em JavaScript é o defeito que aquela função existe para impedir — a
         legenda já saiu 61 px abaixo da imagem por causa disso. Enquanto está automática a
         linha DIZ isso; ao assumir o controle, o slider parte de um número redondo e o
         ajuste fino se faz olhando o quadro real. */
      + (posicao.manual
        ? legRangeHTML(clip, 'posicaoPct', 'Posição vertical', 0, 100, 1, '%')
        : legRowHTML(clip, 'posicaoPct', 'Posição vertical',
          '<div class="vop-leg-range"><span class="vop-leg-auto-note">'
          + 'automática — o servidor ancora dentro da imagem</span>'
          + '<button class="vop-inline-action" type="button" data-act="leg-posicao"'
          + ' data-id="' + esc(clip.id) + '">Posicionar à mão</button></div>'))
      /* CAMADA B: o quadro de verdade, sob demanda. A prévia em CSS acima é aproximação
         declarada; este botão manda o MESMO corpo do export para o `/api/remotion-still`,
         que monta os props com a MESMA função do MP4. É ele que responde onde a legenda
         automática realmente cai — a tela não tem como saber isso sozinha, porque a âncora
         é calculada em Python e repeti-la aqui é proibido. */
      + '<div class="vop-leg-still">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="leg-still"'
      + ' data-id="' + esc(clip.id) + '">Ver o quadro real</button>'
      + '<p class="vop-leg-still-msg" data-leg-still-msg>A prévia acima é aproximação. '
      + 'O quadro real usa o renderizador do export, no meio do corte.</p>'
      + '<div data-leg-still-slot></div></div>'
      + '</div>';
  }
  /* A prévia da tipografia, desenhada em CSS por cima do player da fonte. É APROXIMAÇÃO e
     a tela diz isso: a quebra de PÁGINA tem um dono só (`toCaptionPages`/`to_pages`) e esta
     caixa NÃO a reimplementa — ela deixa o navegador quebrar o texto dentro da coluna, que
     é outra coisa. O que ela prova é fonte, corpo, caixa, cor, coluna e alinhamento.

     As medidas ficam em pixels do QUADRO (1080x1920) e o contêiner as escala com
     `transform: scale()` no CSS: assim nenhum número da prévia precisa ser convertido, e um
     erro de escala aparece como "tudo grande demais", nunca como um deslocamento sutil. */
  function legendaPreviewHTML(clip) {
    var familia = legendaValor(clip, 'familia').valor;
    var tamanho = num(legendaValor(clip, 'tamanho').valor);
    var caixa = legendaValor(clip, 'caixaAlta').valor;
    var cor = LEGENDA_COR_HEX[legendaValor(clip, 'cor').valor] || LEGENDA_COR_HEX.texto;
    var largura = num(legendaValor(clip, 'largura').valor);
    var alinha = legendaValor(clip, 'alinhamento').valor;
    var posicao = legendaValor(clip, 'posicaoPct');
    /* O texto é a primeira fala do trecho, sem recorte nosso: mostrar a fala real é o que
       faz o operador ver a linha estourar a coluna antes de exportar. Trecho sem fala usa
       uma frase de amostra. */
    var fala = ((clip.clipCues || [])[0] || {}).text || '';
    return '<div class="vop-leg-prev" data-leg-prev'
      /* NUMEROS sem unidade de proposito: o CSS os multiplica pelo tamanho de UM pixel do
         quadro (`calc(var(--leg-col) * var(--px))`), e `calc(px * px)` seria invalido. Com
         isso todo numero daqui continua sendo pixel do quadro de 1080x1920, e a conversao
         para a tela mora num lugar so. */
      + ' style="--leg-fonte:' + tamanho + ';--leg-col:' + largura + ';--leg-cor:' + esc(cor)
      + ';--leg-pos:' + (posicao.manual ? num(posicao.valor) : LEGENDA_POSICAO_PARTIDA) + '%"'
      + ' data-familia="' + esc(familia) + '" data-caixa="' + (caixa ? '1' : '0') + '"'
      + ' data-align="' + esc(alinha) + '" data-auto="' + (posicao.manual ? '0' : '1') + '"'
      + ' aria-hidden="true"><span data-leg-prev-text>'
      + esc(fala || 'Assim fica a legenda deste corte') + '</span></div>';
  }

  /* --- enquadramento do 9:16 ---------------------------------------------------------
     TERCEIRA copia do conjunto (a primeira e `worker.REFRAMES`, a segunda o `preset.js`),
     pela mesma razao do card acima: nao ha import possivel entre um modulo stdlib do
     Python, um ESM do Remotion e este arquivo, que o `index.html` carrega por <script>.
     Literais de proposito -- o `test_serve.py` le esta lista por regex e reprova se as
     tres divergirem. Divergir aqui faria a tela oferecer um perfil que a rota recusa.
     `crop` (9:16 de quadro cheio) fica FORA do que a tela oferece: ele corta 68% da largura
     e amplia a fonte 1,78x, o que e o "zoom agressivo" proibido por escrito no
     BUSINESS_SERIOUS. Continua alcancavel pelo comando manual, como sempre foi. */
  var REFRAMES = ['blur', 'crop', 'crop11', 'crop45'];
  var REFRAME_PADRAO = 'blur';
  var REFRAMES_OFERECIDOS = ['blur', 'crop11', 'crop45'];
  /* O rotulo nunca e a chave. `blur` mente e fica mentindo de proposito (desde 2026-08-27
     o fundo dele e cor chapada, nao desfoque): o nome esta em cinco lugares e renomear
     tocaria todos por beneficio zero. */
  var REFRAME_LABELS = { blur: 'Inteiro', crop11: '1:1', crop45: '4:5', crop: '9:16' };
  /* Proporcao de SAIDA de cada recorte como (alto, largo) -- a MESMA forma do
     `worker.REFRAME_RATIO`. `blur` esta ausente porque nele a fonte deita inteira, sem
     recorte nenhum. Uma tabela e tres numeros derivados dela: a porcentagem no rotulo, a
     mascara da previa e a escala aplicada a fonte. Tres literais soltos divergiriam. */
  var REFRAME_RATIO = { crop: [16, 9], crop11: [1, 1], crop45: [5, 4] };
  /* Le `obj.reframe` e valida. Corte e trecho salvos antes desta entrega nao tem a chave e
     caem no padrao -- que e o perfil que TODO download de hoje usa (`'blur'` cravado no
     `intake-cut-save`), entao clip antigo sai exatamente como sempre saiu. */
  /* O seletor de enquadramento, em HTML. UMA funcao para os DOIS lugares que o usam (o
     cartao do trecho do YouTube e a linha do corte no Passo 3): o campo e o mesmo, o
     conjunto e o mesmo, e duas copias divergiriam na primeira mudanca de rotulo.
     `campo` e o que muda -- `data-clip-field` no cartao, `data-cut-field` na linha --,
     porque cada um tem seu handler e sua lista de origem.

     Radio nativo, e nao botao com classe trocada no clique: o `:checked` desenha o
     selecionado, o browser da navegacao por seta de graca e o `fieldset`/`legend` nomeia o
     grupo. Zero JS de estado visual, que e justamente o que dessincroniza do dado.
     O `name` leva o id do item: um `name` so faria todos os cartoes brigarem pelo mesmo
     grupo. Nao ha re-render (BP-001).

     O rotulo diz a PORCENTAGEM cortada em texto, e nao so "1:1"/"4:5": a previa do recorte
     e um overlay sobre o iframe do YouTube, que so existe com a previa aberta, e sem o
     numero o operador escolheria as cegas com ela fechada (BP-008). */
  function reframeFieldHTML(item, campo, prefixo, aviso) {
    var atual = reframeOf(item);
    return '<fieldset class="vop-reframe">'
      + '<legend>Enquadramento</legend>'
      + REFRAMES_OFERECIDOS.map(function (chave) {
        var id = prefixo + '-' + item.id + '-' + chave;
        var corte = cropInsetPct(chave);
        return '<input type="radio" id="' + esc(id) + '" name="' + esc(prefixo + '-' + item.id) + '"'
          + ' data-' + esc(campo) + '="reframe" data-id="' + esc(item.id) + '"'
          + ' value="' + esc(chave) + '"' + (atual === chave ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(REFRAME_LABELS[chave])
          + (corte ? '<small>−' + esc(String(Math.round(corte * 2 * 10) / 10)) + '%</small>' : '')
          + '</label>';
      }).join('')
      + '</fieldset>'
      + (aviso ? '<p class="vop-reframe-aviso">' + esc(aviso) + '</p>' : '');
  }
  function reframeOf(obj) {
    var valor = editOf(obj).enquadramento.reframe || (obj && obj.reframe);
    return REFRAMES.indexOf(valor) >= 0 ? valor : REFRAME_PADRAO;
  }
  /* Quanto o perfil corta de CADA lado, em porcento de uma fonte 16:9 -- que e a proporcao
     do <iframe> da previa (`aspect-ratio: 16/9` no CSS) e a de todo podcast que entra aqui.
     Sai da tabela: `crop11` -> 21,875% de cada lado (43,75% no total), `crop45` -> 27,5%
     (55%). Fonte mais estreita que o alvo nao e recortada (`min` do filtro), e ai da 0. */
  var FONTE_16_9 = 16 / 9;
  function cropInsetPct(reframe) {
    var r = REFRAME_RATIO[reframe];
    if (!r) return 0;
    var mantido = (r[1] / r[0]) / FONTE_16_9;
    return mantido >= 1 ? 0 : (1 - mantido) * 50;
  }
  /* Espelho do `serve.source_scale`: quanto a regiao aproveitada da fonte e ESTICADA para
     chegar aos 1080 de largura da saida. A regiao e a mesma do `crop` do filtro,
     `min(w, h*largo/alto)`; no `blur` e a largura inteira.
     Medido de uma fonte 1920x1080: blur 0,56x (reduz, o mais nitido), crop11 1,00x (nativo,
     nem um pixel interpolado), crop45 1,25x, crop 1,78x. De uma 1280x720 o crop11 vira
     1,50x -- e por isso que a guarda importa mais no recorte que no `blur`.
     Sem dimensao devolve null: dizer "1,00x" sem ter medido seria numero inventado. */
  var ESCALA_MOLE = 1.30;
  function sourceScale(reframe, largura, altura) {
    var w = num(largura);
    var h = num(altura);
    if (!w || !h) return null;
    var r = REFRAME_RATIO[reframeOf({ reframe: reframe })];
    var regiao = r ? Math.min(w, h * r[1] / r[0]) : w;
    return regiao > 0 ? 1080 / regiao : null;
  }
  /* O aviso NAO bloqueia o render: informa que aquele trecho sai mole naquele
     enquadramento e a escolha continua do operador (BP-008). O limiar 1,30 sai da tabela
     acima, nao de gosto: e o ponto em que o `crop45` deixa de ser 1,25x (aceito) e passa a
     ampliacao que aparece na tela do telefone. */
  function sourceWarning(reframe, largura, altura) {
    var escala = sourceScale(reframe, largura, altura);
    if (escala === null || escala <= ESCALA_MOLE) return '';
    return 'A fonte tem ' + num(largura) + '×' + num(altura) + ', então este enquadramento '
      + 'amplia ' + escala.toFixed(2).replace('.', ',') + '× para chegar aos 1080 de largura'
      + ' — o clip sai mole. Dá para baixar assim; um enquadramento mais largo amplia menos.';
  }

  /* Estados possíveis de um projeto. */
  var PROJECT_STATUS = { analyzing: 'analyzing', ready: 'ready', error: 'error' };
  var PROJECT_STATUS_LABEL = { analyzing: 'Analisando...', ready: 'Pronto', error: 'Erro na análise' };
  var TAB = 'central';
  var TOAST = null;
  var BROKEN_RAW = '';
  var uidN = 0;
  /* O File real vive só na sessão. A URL alimenta a prévia; o File é enviado ao helper
     local sob demanda, sem Base64, sem nuvem e sem localStorage. */
  var SESSION_RENDER = Object.create(null);
  var SESSION_FILE_OBJECTS = Object.create(null);
  var PREVIEW_STOP = 0;
  /* Chamadas em voo para o helper local, por chave "acao:id". Vive fora do render porque
     render() reescreve o innerHTML: o botão desabilitado no elemento sozinho voltaria
     habilitado no primeiro re-render e o operador dispararia a segunda chamada. */
  var YT_BUSY = Object.create(null);
  /* Corte de verdade é trabalho de FFmpeg, não de navegador. Gravar o trecho com
     MediaRecorder foi testado e reprovado na fonte real deste projeto (AV1 4K): saiu a
     5,5 fps e derrubou a aba. O caminho honesto é o FFmpeg que já vem no repositório. */
  var FFMPEG_REL = '.\\video-apresentacao\\_tools\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
  /* Mesmos filtros de build_filter() no trabalhador. TEM de casar, senão o comando manual
     de emergência gera um vídeo diferente do que o helper entrega. O que um `-vf` de uma
     linha consegue expressar é, por construção, a cadeia SEM miniatura: o ramo da miniatura
     precisa de uma SEGUNDA entrada (`-i`) e de filter_complex, não cabe aqui. Até 2026-08-27
     o `blur` era um `gblur` e a promessa acima estava falsa nos dois ramos; com o desfoque
     removido do worker.py, este comando volta a casar de verdade com o ramo sem miniatura.
     A cor é o `worker.FUNDO_COR` (= `TOKENS.fundo` do preset.js).
     Sem o `-vf "` na frente de proposito: as tags de cor (COR_TAGS) sao acrescentadas ao
     FIM da cadeia, dentro das mesmas aspas, exatamente como o `build_filter` faz. */
  var FFMPEG_FILTERS = {
    horizontal: 'scale=-2:1080',
    blur: 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#0A0A0C,setsar=1',
    /* 1:1 e 4:5 sao o `blur` com a fonte PRE-RECORTADA -- nao variantes do `crop`. Por isso
       a cadeia deles e o segmento de recorte + a MESMA cadeia do `blur`. O `min` dos dois
       lados garante a proporcao pedida seja a fonte mais larga ou mais estreita que ela, e
       e o que impede fonte ja vertical de estourar o recorte. */
    crop11: 'crop=\'min(iw,ih*1/1)\':\'min(ih,iw*1/1)\','
      + 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#0A0A0C,setsar=1',
    crop45: 'crop=\'min(iw,ih*4/5)\':\'min(ih,iw*5/4)\','
      + 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#0A0A0C,setsar=1',
    crop: 'crop=ih*9/16:ih,scale=1080:1920'
  };
  /* As quatro tags de cor, no FIM da cadeia de FILTRO e nao no encoder. MEDIDO nesta
     maquina (ffmpeg-N-125365): `-color_primaries bt709 -color_trc bt709` sao IGNORADOS por
     este build -- o arquivo sai com `color_transfer=unknown` e `color_primaries=unknown` em
     qualquer ordem, com ou sem `-profile:v high`. Só `setparams` no filtro (ou
     `-x264-params`) grava as quatro. Este e o mesmo literal do `worker.COR_TAGS`. */
  var COR_TAGS = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

  /* Primeiro contato: o vídeo escolhido nesta sessão. NÃO é persistido — recarregar
     começa do zero, de propósito (blob de vídeo nunca vai para o localStorage). */
  var INTAKE = {
    url: '', file: null, name: '', size: 0, lastModified: 0, type: '', duration: 0,
    state: 'empty', message: '', replaced: false, inSec: '', outSec: '',
    cuts: [], editingId: ''
  };

  /* Prioridade do corte: qual trecho vale mais. Três níveis e nada além — é a única
     informação, além do nome, que o Passo 2 pede. Ausente ou desconhecida vira "media". */
  var PRIORITY_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  var PRIORITY_ORDER = ['alta', 'media', 'baixa'];
  function priorityOf(cut) {
    var value = cut && cut.priority;
    return PRIORITY_LABEL[value] ? value : 'media';
  }
  /* Sinais que o /api/yt-probe devolve por trecho. Slug desconhecido aparece como veio,
     nunca some: é evidência (audiência medida, capítulo, fala), não palpite. */
  var SIGNAL_LABEL = { heatmap: 'Mais reproduzidos', chapter: 'Capítulo', transcript: 'Fala',
                       muapi: 'Detector externo' };
  function signalLabel(id) { return SIGNAL_LABEL[id] || String(id || ''); }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + (uidN++).toString(36);
  }
  function nowISO() { return new Date().toISOString(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function localDay(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  function cleanText(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 5000); }
  function deaccent(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function safeUrl(value) {
    try {
      var url = new URL(String(value || '').trim());
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (e) { return ''; }
  }
  function findById(list, id) {
    if (!Array.isArray(list) || !id) return null;
    return list.find(function (item) { return item && item.id === id; }) || null;
  }
  /* Nome de arquivo/pasta seguro no Windows: sem caracteres proibidos, sem nome
     reservado, sem ponto ou espaço final (o Explorer os descarta silenciosamente). */
  function safeName(value, max) {
    var text = deaccent(value)
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .trim()
      .replace(/^[-. ]+|[-. ]+$/g, '');
    text = text.slice(0, max || 60).replace(/[-. ]+$/g, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(text)) text = '_' + text;
    return text || 'sem-nome';
  }
  function fmtBytes(bytes) {
    var n = num(bytes);
    if (!n) return 'tamanho desconhecido';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',') + ' GB';
  }
  function isVideoFile(file) {
    if (!file) return false;
    if (/^video\//i.test(String(file.type || ''))) return true;
    /* O Windows às vezes entrega type vazio; a extensão é o último recurso, não o primeiro. */
    return /\.(mp4|m4v|mov|webm|mkv)$/i.test(String(file.name || ''));
  }
  function chip(cls, text) { return '<span class="vop-chip ' + esc(cls) + '">' + esc(text) + '</span>'; }
  function fmtDateTime(value) {
    if (!value) return 'Sem horário';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  /* --- Tempo -----------------------------------------------------------------------
     Puras de propósito: o teste headless não tem <video>, então a regra de validação e
     a mensagem de estado são conferíveis sem DOM. */
  function secs(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function fmtClock(seconds) {
    var total = Number(seconds);
    if (!Number.isFinite(total) || total < 0) return '--:--';
    total = Math.floor(total);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(total % 60);
  }
  /* O operador pensa em minuto:segundo ("15:30"), não em 930. Estes dois são a ÚNICA
     fronteira entre o texto do campo e o modelo: INTAKE.inSec/outSec continuam em
     SEGUNDOS, então markIssues, o arrasto na barra, os presets e o corte no FFmpeg não
     mudam uma linha. Texto que não é tempo vira '' (= "não marcado") em vez de 0 calado. */
  function parseClock(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return '';
    if (raw.indexOf(':') < 0) return /^\d+$/.test(raw) ? Number(raw) : '';
    var parts = raw.split(':');
    if (parts.length > 3) return '';
    var total = 0;
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i].trim();
      /* Parte vazia é o meio da digitação: "15:" já vale 15:00 e a barra acompanha. */
      if (piece && !/^\d+$/.test(piece)) return '';
      total = total * 60 + Number(piece || 0);
    }
    return total;
  }
  /* O que aparece NO campo. '' continua vazio: campo em branco é "não marcado". */
  function clockField(value) {
    return value === '' || value === null || value === undefined ? '' : fmtClock(value);
  }
  /* Guarda NaN e Infinity (BP-004) e explica CADA recusa em português (BP-008).
     durationSec 0/ausente = duração desconhecida: não bloqueia, mas também não mente. */
  function markIssues(inSec, outSec, durationSec) {
    var issues = [];
    var start = Number(inSec);
    var end = Number(outSec);
    var total = secs(durationSec);
    if (!Number.isFinite(start) || start < 0) issues.push('início precisa ser um número a partir de zero');
    if (!Number.isFinite(end) || end <= 0) issues.push('fim precisa ser um número maior que zero');
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > 0 && end <= start) {
      issues.push('fim precisa ser maior que o início');
    }
    if (total && Number.isFinite(end) && end > total) {
      issues.push('fim passa da duração do vídeo (' + fmtClock(total) + ')');
    }
    return issues;
  }
  /* Nenhum ramo termina mudo: sem arquivo, arquivo ilegível, duração não lida, nada
     marcado, trecho inválido e trecho válido têm cada um a sua frase. */
  function markStatus(info) {
    info = info || {};
    var duration = secs(info.durationSec);
    if (!info.hasFile) {
      return { tone: 'idle', text: 'Nenhum arquivo escolhido nesta sessão. Escolha o MP4 local para marcar vendo o vídeo — início e fim também aceitam digitação.' };
    }
    if (info.fileError) {
      return { tone: 'error', text: 'O navegador não conseguiu abrir este arquivo. Confirme que é um MP4 e escolha novamente.' };
    }
    if (!duration) {
      return { tone: 'warn', text: 'Arquivo carregado, mas a duração ainda não foi lida — o fim não está sendo conferido contra o vídeo.' };
    }
    if (!secs(info.inSec) && !secs(info.outSec)) {
      return { tone: 'idle', text: 'Vídeo carregado (' + fmtClock(duration) + '). Nenhum trecho marcado ainda.' };
    }
    var issues = markIssues(info.inSec, info.outSec, duration);
    return issues.length
      ? { tone: 'error', text: 'Trecho inválido: ' + issues.join('; ') + '.' }
      : { tone: 'ok', text: 'Trecho válido: ' + fmtClock(info.inSec) + ' → ' + fmtClock(info.outSec)
          + ' (' + Math.round(Number(info.outSec) - Number(info.inSec)) + 's de ' + fmtClock(duration) + ').' };
  }

  /* --- Central de Clips (o ÚNICO dado persistido) ----------------------------------
     Um registro por MP4 que o helper local entregou. Não guarda vídeo: guarda o nome do
     clip, o nome do vídeo de origem, o intervalo e o CAMINHO em disco (`savedPath`), que
     é o que permite tocar e baixar de novo depois de fechar o site.
     Puras (libEntry/libSanitize/libGroups) para o teste conferir sem DOM. */
  var LIB_ORIGINS = ['local', 'youtube'];
  function libEntry(raw) {
    raw = raw || {};
    var inSec = num(raw.inSec);
    var outSec = num(raw.outSec);
    /* Intervalo impossível não entra: viraria um cartão que nunca toca nada. */
    if (outSec <= inSec) return null;
    var fileName = cleanText(raw.fileName, 200);
    if (!fileName) return null;
    return {
      id: cleanText(raw.id, 60) || uid('clip'),
      videoName: cleanText(raw.videoName, 200) || 'Vídeo sem nome',
      videoUrl: safeUrl(raw.videoUrl),
      clipName: cleanText(raw.clipName, 120) || 'Clip',
      inSec: inSec, outSec: outSec,
      fileName: fileName,
      /* '' é legítimo: significa "o helper não guardou em disco, só foi para Downloads". */
      savedPath: cleanText(raw.savedPath, 600),
      bytes: num(raw.bytes),
      origin: LIB_ORIGINS.indexOf(raw.origin) >= 0 ? raw.origin : 'local',
      createdAt: cleanText(raw.createdAt, 40) || nowISO()
    };
  }
  function libSeed() {
    return { version: LIB_VERSION, start: localDay(), clips: [] };
  }
  function libSanitize(value) {
    if (!value || typeof value !== 'object') return null;
    var clips = (Array.isArray(value.clips) ? value.clips : []).map(libEntry).filter(Boolean);
    return {
      version: LIB_VERSION,
      start: /^\d{4}-\d{2}-\d{2}$/.test(String(value.start || '')) ? value.start : localDay(),
      clips: clips.slice(0, 2000)
    };
  }
  /* Os cartões são agrupados POR VÍDEO: é como o operador pensa ("o que eu tirei deste
     podcast?"). Grupo mais recente primeiro; dentro dele, o clip mais recente primeiro. */
  function libGroups(clips) {
    var order = [];
    var byName = Object.create(null);
    (Array.isArray(clips) ? clips : []).slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    }).forEach(function (clip) {
      var key = clip.videoName;
      if (!byName[key]) { byName[key] = { name: key, videoUrl: clip.videoUrl, items: [] }; order.push(byName[key]); }
      byName[key].items.push(clip);
    });
    return order;
  }
  function libLoad() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return libSeed();
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    var clean = libSanitize(parsed);
    if (!clean) {
      /* Não sobrescreve o que não entendeu: guarda o texto bruto para o operador baixar
         antes de recomeçar (a mesma rede de segurança que o Estúdio já tinha). */
      BROKEN_RAW = raw;
      return libSeed();
    }
    return clean;
  }
  function libPersist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(LIB));
      return true;
    } catch (e) {
      /* Falhar em gravar não pode derrubar o download que já aconteceu: o MP4 está no
         disco, só o registro não entrou. Diz o motivo em vez de sumir (BP-008). */
      toast('Não consegui salvar o registro deste clip no navegador. O arquivo foi baixado normalmente.', 'error');
      console.warn('[video-ops] localStorage:', e);
      return false;
    }
  }
  /* Projetos: persistência separada dos clips baixados. */
  function projectsLoad() {
    var raw = null;
    try { raw = localStorage.getItem(PROJECTS_KEY); } catch (e) { raw = null; }
    if (!raw) return projectsSeed();
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    var clean = projectsSanitize(parsed);
    if (!clean) {
      console.warn('[video-ops] projects: dados inválidos, iniciando vazio');
      return projectsSeed();
    }
    return clean;
  }
  function projectsPersist() {
    /* Nada carregado = nada a gravar. Sem esta guarda, gravar `null` APAGARIA os projetos
       salvos do operador — e o caminho existe desde que a escolha do card da marca passou
       a persistir por clique, que e um handler capaz de rodar antes do `init` (e roda, na
       suite headless, onde `PROJECTS` e null e `localStorage` nao existe). */
    if (!PROJECTS) return false;
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(PROJECTS));
      return true;
    } catch (e) {
      console.warn('[video-ops] projects localStorage:', e);
      return false;
    }
  }
  function projectsSeed() {
    return { version: PROJECTS_VERSION, projects: [] };
  }
  function projectsSanitize(data) {
    if (!data || !Array.isArray(data.projects)) return null;
    var out = { version: PROJECTS_VERSION, projects: [] };
    for (var i = 0; i < data.projects.length; i++) {
      var p = data.projects[i];
      if (!p || !p.id || !p.videoId) continue;
      var proj = {
        id: String(p.id),
        videoId: String(p.videoId),
        url: String(p.url || ''),
        title: String(p.title || ''),
        thumbnail: String(p.thumbnail || ''),
        durationSec: Number(p.durationSec) || 0,
        createdAt: String(p.createdAt || ''),
        updatedAt: String(p.updatedAt || ''),
        status: PROJECT_STATUS[p.status] ? String(p.status) : PROJECT_STATUS.error,
        candidates: Array.isArray(p.candidates) ? p.candidates.slice(0, MAX_CANDIDATES) : [],
        clipCount: Number(p.clipCount) || 0,
        error: String(p.error || ''),
        note: String(p.note || '')
      };
      out.projects.push(proj);
    }
    /* Mais recentes primeiro. */
    out.projects.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return out;
  }
  /* Busca projeto pelo videoId. */
  function projectFindByVideoId(videoId) {
    if (!PROJECTS || !videoId) return null;
    return PROJECTS.projects.find(function (p) { return p.videoId === videoId; }) || null;
  }
  function projectFindById(id) {
    if (!PROJECTS || !id) return null;
    return PROJECTS.projects.find(function (p) { return p.id === id; }) || null;
  }
  /* Cria ou atualiza projeto com status analyzing. */
  function projectCreateOrReserve(videoId, url, title, thumbnail, durationSec) {
    var existing = projectFindByVideoId(videoId);
    var now = nowISO();
    if (existing) {
      /* Se já existe e está pronto ou analisando, não sobrescreve os clips. */
      if (existing.status === PROJECT_STATUS.ready || existing.status === PROJECT_STATUS.analyzing) {
        return existing;
      }
      /* Se estava em erro, atualiza para analisando. */
      existing.status = PROJECT_STATUS.analyzing;
      existing.updatedAt = now;
      existing.error = '';
      projectsPersist();
      return existing;
    }
    var project = {
      id: uid('proj'),
      videoId: videoId,
      url: url,
      title: title || '',
      thumbnail: thumbnail || '',
      durationSec: durationSec || 0,
      createdAt: now,
      updatedAt: now,
      status: PROJECT_STATUS.analyzing,
      candidates: [],
      clipCount: 0,
      error: ''
    };
    PROJECTS.projects.unshift(project);
    projectsPersist();
    return project;
  }
  function projectUpdateStatus(projectId, status, error) {
    var project = projectFindById(projectId);
    if (!project) return false;
    project.status = status;
    project.updatedAt = nowISO();
    if (error) project.error = error;
    projectsPersist();
    return true;
  }
  function projectSetCandidates(projectId, candidates, videoTitle, videoThumbnail, videoDuration, note) {
    var project = projectFindById(projectId);
    if (!project) return false;
    project.candidates = candidates || [];
    project.clipCount = project.candidates.length;
    project.status = PROJECT_STATUS.ready;
    project.updatedAt = nowISO();
    if (videoTitle) project.title = videoTitle;
    if (videoThumbnail) project.thumbnail = videoThumbnail;
    if (videoDuration) project.durationSec = videoDuration;
    if (note) project.note = note;
    projectsPersist();
    return true;
  }
  function projectSetError(projectId, error) {
    return projectUpdateStatus(projectId, PROJECT_STATUS.error, error);
  }
  /* Registro do clip baixado. Chamado dos DOIS caminhos de download (corte local e
     render do Remotion) — um ponto só, então nenhum deles pode esquecer de registrar. */
  function libAdd(raw) {
    var entry = libEntry(raw);
    if (!entry) return null;
    LIB.clips.unshift(entry);
    libPersist();
    refreshBadge();
    return entry;
  }
  function libRemove(id) {
    var before = LIB.clips.length;
    LIB.clips = LIB.clips.filter(function (clip) { return clip.id !== id; });
    if (LIB.clips.length === before) return false;
    libPersist();
    return true;
  }
  /* O arquivo em disco é servido pelo helper local em /clips/<arquivo>. Só o nome base
     entra na URL: caminho completo não é rota, e basename mata travessia. */
  function savedClipUrl(clip) {
    var base = String((clip && clip.savedPath) || '').split(/[\\/]/).pop();
    return base ? '/clips/' + encodeURIComponent(base) : '';
  }
  function projectInfo() {
    var start = Date.parse(LIB.start + 'T00:00:00');
    var elapsed = Math.floor((Date.now() - start) / 86400000);
    elapsed = Math.max(0, Math.min(DAYS, Number.isFinite(elapsed) ? elapsed : 0));
    return { day: Math.min(DAYS, elapsed + 1), elapsed: elapsed, remaining: DAYS - elapsed, percent: Math.round(elapsed / DAYS * 100) };
  }

  /* --- Ponte YouTube ---------------------------------------------------------------
     Sessão, não cadastro: a URL, os trechos sugeridos e a declaração de direito morrem
     com a aba. Baixar mídia é a "exceção aprovada caso a caso" da PESQUISA_FERRAMENTAS
     §10 — segue passando por um portão explícito, agora uma declaração do operador. */
  var YT = {
    url: '', videoId: '', state: 'idle', note: '', title: '', duration: 0,
    candidates: [], authorized: false,
    /* `detail` = trecho aberto no editor; `dlMenu` = trecho com o menu de download aberto;
       `sort` = ordem da grade; `thumbnail`/`storyboard` = as imagens da fonte. Nenhum
       deles e persistido: sao estado de TELA, e recarregar volta para a grade.
       `preview` SAIU: a previa era um dialogo com iframe do YouTube, e hoje ela e um seek no
       player da fonte -- nao ha o que guardar, porque nada abre nem fecha. */
    detail: '', dlMenu: '', sort: 'quality', thumbnail: '', storyboard: null
  };
  /* --- A FONTE: o vídeo inteiro importado ------------------------------------------
     A mudança de arquitetura desta entrega (decisão do usuário, 2026-09-15). Até aqui cada
     trecho era um download próprio, e o editor mostrava um iframe do YouTube; agora o
     original INTEIRO entra uma vez, toca num player do próprio site e TODO corte sai dele.

     Estado de SESSÃO: o arquivo no disco é a verdade durável (e o servidor o redescobre por
     ele), isto aqui é só o que a tela precisa. `videoId` é a chave da CORRIDA — colar outra
     URL no meio de uma importação invalida a anterior, e a resposta dela é descartada em vez
     de assumir o lugar do vídeo novo. */
  var SRC = {
    videoId: '', state: 'idle', stage: '', percent: 0, error: '',
    token: '', name: '', url: '', bytes: 0,
    durationSec: 0, width: 0, height: 0, hasAudio: false
  };
  /* ESPELHO do `serve.IMPORT_STATES`/`IMPORT_STAGES`. Conjuntos FECHADOS, e cada valor tem
     frase aqui: estado que sai do servidor sem frase do outro lado é o erro mudo que o
     conjunto existe para impedir (BP-008, a mesma regra do CAPTION_STATES). */
  var IMPORT_STATES = ['idle', 'importing', 'ready', 'error'];
  var IMPORT_STAGES = ['lendo', 'baixando', 'preparando'];
  var IMPORT_MSG = {
    idle: 'Nenhum vídeo importado nesta URL. Importe para poder tocar, marcar e exportar.',
    importing: 'Trazendo o vídeo para o Estúdio.',
    ready: 'Vídeo pronto no Estúdio. Todo corte sai deste arquivo — nada é baixado de novo.',
    error: 'A importação falhou.'
  };
  var IMPORT_STAGE_MSG = {
    lendo: 'Lendo os dados do vídeo',
    baixando: 'Baixando o vídeo inteiro',
    preparando: 'Preparando o arquivo'
  };
  /* De quanto em quanto tempo a barra pergunta ao servidor. 1,2 s é mais rápido que o olho
     percebe como travado e mais lento que o download muda de ponto percentual. */
  var SRC_POLL_MS = 1200;
  /* Quantas falhas de rede SEGUIDAS no acompanhamento antes de desistir. Falha isolada não é
     falha da importação (ela corre no servidor), mas tentar para sempre deixaria a barra
     andando com o servidor morto — indistinguível de download em curso. */
  var SRC_POLL_TRIES = 10;
  var SRC_POLL = 0;
  /* Sequência da importação pedida. Só a mais recente pode escrever em SRC. */
  var SRC_SEQ = 0;
  /* O nó `<video>` da fonte, PRESERVADO entre renders (ver srcAdopt). */
  var SRC_NODE = null;
  var YT_ID = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
  function ytVideoId(url) {
    var found = YT_ID.exec(safeUrl(url));
    return found ? found[1] : '';
  }
  /* Portão de direitos. ANALISAR (metadados e legenda) é livre; BAIXAR mídia exige a
     declaração explícita de que existe autorização para publicar cortes deste vídeo.
     Cada recusa devolve o motivo — botão morto e mudo é bug (BP-008). */
  function ytFetchGate(state) {
    var it = state || {};
    if (!ytVideoId(it.url)) return { allowed: false, reason: 'a URL não é de um vídeo do YouTube' };
    if (!it.authorized) return { allowed: false, reason: 'você ainda não declarou ter autorização do criador' };
    return { allowed: true, reason: '' };
  }
  function srcReady() { return SRC.state === 'ready' && !!SRC.token && !!SRC.url; }
  /* Preserva o `<video>` entre renders. O `render()` troca o innerHTML inteiro, e um player
     novo a cada re-render perderia a posição, o volume e o buffer — num arquivo de 2 GB isso
     significa rebaixar tudo e voltar ao segundo zero a cada clique em "Baixar". Por isso a
     marcação DECLARA o player (assim ele é testável e a tela é a fonte da verdade) e aqui o
     nó vivo é trocado pelo recém-criado quando a URL é a mesma.

     O detach e o reattach acontecem na MESMA tarefa síncrona: a especificação só pausa a
     mídia depois de esperar um "stable state" e conferir se o elemento continua fora do
     documento — como ele já voltou, a reprodução não é interrompida. Fora da mesma tarefa
     isto não funcionaria. */
  function srcAdopt(root) {
    if (!root || !root.querySelector) return;
    var fresco = root.querySelector('[data-src-video]');
    if (!fresco) return;
    var mesmo = SRC_NODE && SRC_NODE.getAttribute && fresco.getAttribute
      && SRC_NODE.getAttribute('src') === fresco.getAttribute('src');
    if (mesmo && fresco.parentNode && fresco.parentNode.replaceChild) {
      fresco.parentNode.replaceChild(SRC_NODE, fresco);
      return;
    }
    SRC_NODE = fresco;
  }
  function srcVideo() {
    if (SRC_NODE) return SRC_NODE;
    if (typeof document === 'undefined' || !document.querySelector) return null;
    return document.querySelector('[data-src-video]');
  }
  /* O instante em que o player está, ou null. `null` e NUNCA 0: sem player na tela, zero
     seria "o começo do vídeo" — a mesma regra do `parseClock`, onde texto que não é tempo
     vira '' em vez de 0 calado. */
  function srcNow() {
    var v = srcVideo();
    var t = v ? Number(v.currentTime) : NaN;
    return (typeof t === 'number' && isFinite(t)) ? t : null;
  }
  function srcSeek(seconds, play) {
    var v = srcVideo();
    if (!v) return false;
    try { v.currentTime = Math.max(0, secs(seconds)); } catch (e) { return false; }
    if (play && typeof v.play === 'function') {
      var p = v.play();
      /* Autoplay recusado pelo navegador não é erro para tratar: o player está na tela com
         os controles, e o operador dá play. Sem o catch a promessa rejeitada vira ruído no
         console a cada prévia. */
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }
    return true;
  }
  /* A barra anda SEM re-render. Dois motivos, os dois já pagos neste projeto: um innerHTML
     novo por segundo tiraria o foco de quem estiver digitando na URL (BP-001) e remontaria o
     player quando ele existir (a lição do appearance.js — trocar de estado não remonta nada).
     Devolve false quando a tela mudou de CARA e o caminho longo é o certo. */
  function srcRefresh() {
    if (typeof document === 'undefined' || !document.querySelector) return false;
    var faixa = document.querySelector('[data-src-strip]');
    if (!faixa || !faixa.dataset || faixa.dataset.state !== SRC.state) return false;
    if (SRC.state !== 'importing') return false;
    var pct = Math.max(0, Math.min(100, num(SRC.percent)));
    var linha = faixa.querySelector && faixa.querySelector('[data-src-line]');
    if (linha) linha.textContent = srcStageLabel() + ' · ' + pct + '%';
    var fill = faixa.querySelector && faixa.querySelector('[data-src-fill]');
    if (fill && fill.style) fill.style.transform = 'scaleX(' + (pct / 100).toFixed(3) + ')';
    var barra = faixa.querySelector && faixa.querySelector('[data-src-bar]');
    if (barra && barra.setAttribute) barra.setAttribute('aria-valuenow', String(pct));
    return true;
  }
  function srcStageLabel() {
    return IMPORT_STAGE_MSG[SRC.stage] || 'Preparando o arquivo';
  }
  /* Fronteira de ENTRADA da importação: o corpo vem do servidor, e servidor é entrada.
     Devolve true enquanto ainda há o que acompanhar.

     As três guardas do começo são o que cumpre o pedido "se a URL mudar durante a importação,
     o resultado da anterior não pode substituir o vídeo novo": resposta de sequência velha,
     de outro id, ou de um id que já não é o da URL na tela é DESCARTADA — não aplicada. */
  function srcApply(payload, seq, videoId) {
    if (seq !== SRC_SEQ) return false;
    var vindo = cleanText(payload && payload.videoId, 40);
    if (vindo && vindo !== videoId) return false;
    if (videoId !== ytVideoId(YT.url)) return false;
    var estado = cleanText(payload && payload.state, 20);
    if (IMPORT_STATES.indexOf(estado) < 0) estado = 'error';
    SRC.videoId = videoId;
    SRC.stage = IMPORT_STAGES.indexOf(cleanText(payload && payload.stage, 20)) >= 0
      ? cleanText(payload.stage, 20) : '';
    SRC.percent = Math.max(0, Math.min(100, num(payload && payload.percent)));
    SRC.error = cleanText(payload && payload.error, 400);
    if (estado === 'ready') {
      SRC.token = cleanText(payload && payload.sourceToken, 80);
      SRC.name = cleanText(payload && payload.sourceName, 200);
      SRC.url = cleanText(payload && payload.sourceUrl, 400);
      SRC.bytes = num(payload && payload.bytes);
      SRC.durationSec = secs(payload && payload.durationSec);
      SRC.width = num(payload && payload.width);
      SRC.height = num(payload && payload.height);
      SRC.hasAudio = !!(payload && payload.hasAudio);
      SRC.percent = 100;
      if (!SRC.token || !SRC.url) {
        /* Pronto sem token ou sem endereço é fonte que não toca e não corta. Cair em erro COM
           motivo é melhor que uma tela que diz "pronto" e não faz nada (BP-008). */
        estado = 'error';
        SRC.error = 'O Estúdio terminou a importação mas não recebeu o endereço do arquivo. Importe de novo.';
      } else {
        /* A duração do ARQUIVO manda no teto do corte: o `ytApplyTrim` recusa fim depois do
           fim do vídeo, e o metadado do YouTube pode divergir do que foi baixado. */
        if (SRC.durationSec) YT.duration = SRC.durationSec;
        /* O portão de direitos, conferido DE NOVO na volta: a declaração pode ser desmarcada
           durante os minutos da importação. O arquivo fica no disco (apagar dado do operador
           não é papel desta tela), mas ele não entra na sessão — e o motivo é dito. */
        var revisto = ytFetchGate(YT);
        if (!revisto.allowed) {
          estado = 'error';
          SRC.token = '';
          SRC.url = '';
          SRC.error = 'O vídeo chegou, mas o direito mudou no caminho: ' + revisto.reason
            + '. Declare de novo e importe — o arquivo já está no disco, então é instantâneo.';
        }
      }
    }
    SRC.state = estado;
    if (estado !== 'importing') {
      ytBusy('import:url', false);
      SRC_POLL = 0;
    }
    /* Transição de estado muda a CARA da tela (barra -> player, barra -> erro), e aí o
       re-render é o certo; progresso dentro do mesmo estado é atualização pontual. */
    if (!srcRefresh()) renderKeepingScroll();
    return estado === 'importing';
  }
  function srcPollNext(seq, videoId, falhas) {
    if (seq !== SRC_SEQ || SRC.state !== 'importing') return;
    if (typeof setTimeout !== 'function') return;
    SRC_POLL = setTimeout(function () {
      if (seq !== SRC_SEQ) return;
      ytPost('/api/yt-import-state', { videoId: videoId }).then(function (payload) {
        if (srcApply(payload, seq, videoId)) srcPollNext(seq, videoId, 0);
      }).catch(function (error) {
        if (seq !== SRC_SEQ) return;
        var tentou = num(falhas) + 1;
        if (tentou < SRC_POLL_TRIES) { srcPollNext(seq, videoId, tentou); return; }
        SRC.state = 'error';
        SRC.error = 'Perdi contato com o renderizador durante a importação ('
          + (cleanText(error && error.message, 200) || 'sem detalhe')
          + '). O download pode ter continuado: importe de novo para conferir — se o arquivo '
          + 'já estiver no disco, é instantâneo.';
        ytBusy('import:url', false);
        renderKeepingScroll();
      });
    }, SRC_POLL_MS);
  }
  /* Trocar de vídeo apaga a fonte da sessão. A sequência sobe ANTES de tudo: resposta em voo
     da importação anterior deixa de valer no mesmo instante. */
  function srcReset() {
    SRC_SEQ += 1;
    if (SRC_POLL && typeof clearTimeout === 'function') clearTimeout(SRC_POLL);
    SRC_POLL = 0;
    /* O player de OUTRO vídeo não é reaproveitado — sem isto o `srcAdopt` compararia URLs
       diferentes, o que já daria certo, mas o nó velho ficaria pendurado no módulo. */
    SRC_NODE = null;
    SRC.videoId = ''; SRC.state = 'idle'; SRC.stage = ''; SRC.percent = 0; SRC.error = '';
    SRC.token = ''; SRC.name = ''; SRC.url = ''; SRC.bytes = 0;
    SRC.durationSec = 0; SRC.width = 0; SRC.height = 0; SRC.hasAudio = false;
  }
  /* Importa o vídeo INTEIRO. É a ação principal da tela: cola o link, declara o direito,
     clica. Baixar mídia passa pelo portão — e ele é conferido de novo no `srcApply`.

     A ANÁLISE não espera o download: ela só lê metadados e legenda (nenhum byte de vídeo), e
     rodar as duas em paralelo põe os trechos sugeridos na tela enquanto o arquivo vem. */
  function srcImport(button) {
    var url = safeUrl(YT.url);
    var videoId = ytVideoId(url);
    if (!videoId) { toast('Cole o link de um vídeo do YouTube.', 'error'); return; }
    var gate = ytFetchGate(YT);
    if (!gate.allowed) {
      toast('Importar o vídeo está bloqueado: ' + gate.reason + '.', 'error');
      return;
    }
    if (SRC.state === 'importing') { toast('Este vídeo já está sendo importado.'); return; }
    if (SRC_POLL && typeof clearTimeout === 'function') clearTimeout(SRC_POLL);
    var seq = (SRC_SEQ += 1);
    SRC.videoId = videoId; SRC.state = 'importing'; SRC.stage = 'lendo';
    SRC.percent = 0; SRC.error = '';
    ytBusy('import:url', true, button, 'Importando…');
    renderKeepingScroll();
    ytPost('/api/yt-import', { url: url }).then(function (payload) {
      if (srcApply(payload, seq, videoId)) srcPollNext(seq, videoId, 0);
    }).catch(function (error) {
      if (seq !== SRC_SEQ) return;
      SRC.state = 'error';
      SRC.error = cleanText(error && error.message, 400) || 'A importação falhou.';
      ytBusy('import:url', false);
      renderKeepingScroll();
      toast(SRC.error, 'error');
    });
    if (!YT.candidates.length) ytProbe(null);
  }
  /* Religa a fonte de um projeto reaberto. NÃO baixa nada: a rota de estado só devolve o que
     já está no disco (e o registra de novo no servidor da sessão). Fonte que saiu do disco
     cai em `idle`, e aí a tela pede a importação — com o motivo escrito. */
  function srcRestore(videoId) {
    if (!videoId) return;
    if (SRC_POLL && typeof clearTimeout === 'function') clearTimeout(SRC_POLL);
    var seq = (SRC_SEQ += 1);
    SRC.videoId = videoId;
    ytPost('/api/yt-import-state', { videoId: videoId }).then(function (payload) {
      if (srcApply(payload, seq, videoId)) srcPollNext(seq, videoId, 0);
    }).catch(function () {
      if (seq !== SRC_SEQ) return;
      /* Renderizador desligado não é fonte ausente, e dizer "não importado" seria mentira.
         O estado fica `idle` com a frase do renderizador, que é a ação certa: subir o
         serviço. */
      SRC.state = 'idle';
      SRC.error = 'O renderizador não está ativo — rode estudio.ps1 para tocar e cortar o vídeo.';
      renderKeepingScroll();
    });
  }
  /* Converte a resposta do probe em trechos sugeridos da sessão. Trecho sem duração
     positiva é descartado: entraria como cartão que não baixa nada. */
  function ytCandidateClips(payload) {
    var raw = payload && Array.isArray(payload.candidates) ? payload.candidates : [];
    return raw.map(function (item) {
      item = item || {};
      var topic = cleanText(item.topic, 140) || 'Trecho sugerido';
      return {
        id: uid('cand'), name: topic, topic: topic,
        inSec: num(item.inSec), outSec: num(item.outSec),
        hook: cleanText(item.hook, 300),
        reason: cleanText(item.reason, 1000), score: Math.min(100, num(item.score)),
        /* O aviso vem do detector e é o que impede aprovar um trecho que começa no meio
           da ideia ("Começa com 'mas'..."). Descartar aqui deixaria a análise muda justo
           no ponto que mais custa caro depois (BP-008). */
        contextWarning: cleanText(item.contextWarning, 600),
        category: cleanText(item.category, 40),
        /* Faixa de qualidade e decomposicao. Trecho salvo ANTES desta entrega nao tem as
           chaves: `quality` vazia faz o card nao mostrar faixa nenhuma (que e melhor que
           mostrar faixa errada) e `factors` vazio esconde a secao, sem quebrar nada. */
        quality: cleanText(item.quality, 20),
        qualityLabel: cleanText(item.qualityLabel, 40),
        factors: (Array.isArray(item.factors) ? item.factors : []).slice(0, 12)
          .filter(function (f) { return f && typeof f === 'object'; })
          .map(function (f) {
            return { id: cleanText(f.id, 40), label: cleanText(f.label, 60),
                     weight: num(f.weight), value: frac(f.value), note: cleanText(f.note, 300) };
          }),
        evidence: cleanText(item.evidence, 300),
        /* De onde vem a borda: `palavra`, `fala`, `audiencia` ou `manual`. A tela DIZ isso
           em vez de afirmar conferencia que nao houve. */
        boundary: cleanText(item.boundary, 20) || 'fala',
        /* Revisao do intervalo. Sobe quando a borda muda, e e o que invalida MP4 baixado,
           legenda rebaseada e miniatura. A identidade (`id`) nao muda com ela. */
        rev: 1,
        signals: (Array.isArray(item.signals) ? item.signals : [])
          .filter(function (s) { return typeof s === 'string'; })
          .map(function (s) { return cleanText(s, 40); }).filter(Boolean).slice(0, 6),
        clipToken: '', clipBytes: 0, clipCues: []
      };
    }).filter(function (clip) { return clip.outSec > clip.inSec; });
  }

  /* A folha de miniaturas, pelo validador. Vem do servidor, e servidor e entrada: uma
     folha sem grade positiva faria o `sbFrame` dividir por zero, e uma URL que nao e https
     entraria no `src` da imagem. Grade invalida devolve null, e o card cai na capa. */
  function ytStoryboardFrom(payload) {
    var raw = payload && payload.storyboard;
    if (!raw || typeof raw !== 'object') return null;
    var folhas = (Array.isArray(raw.sheets) ? raw.sheets : [])
      .map(function (u) { return safeUrl(u); })
      .filter(function (u) { return u.indexOf('https://') === 0; })
      .slice(0, 80);
    var cols = num(raw.columns);
    var rows = num(raw.rows);
    var fps = Number(raw.fps);
    if (!folhas.length || cols < 1 || rows < 1 || !Number.isFinite(fps) || fps <= 0) return null;
    return { sheets: folhas, columns: cols, rows: rows, fps: fps,
             width: num(raw.width), height: num(raw.height) };
  }

  /* --- "Mais reproduzidos" (recomendação no Passo 2) -------------------------------
     Recomendação NÃO é corte. Vive FORA de INTAKE.cuts de propósito: corte é decisão do
     usuário e vai para a lista; recomendação é audiência medida pelo YouTube e morre com
     a sessão. Nada aqui é persistido e nada aqui cria corte sozinho. */
  var MR_SOURCE = 'youtube_heatmap';
  var MR_REC = { name: '', state: 'idle', peaks: [], reason: '', videoId: '', captions: null };
  var MR_INTENSITY = [[0.85, 'Interesse muito alto'], [0.6, 'Interesse alto']];
  /* Intensidade é FRAÇÃO de 0 a 1. num() arredonda para inteiro (é helper de segundos,
     bytes e contagem) e transformaria 0,74 em 1 — todo pico viraria "muito alto" e o
     ranking perderia o sentido. Por isso a fração tem o seu próprio guarda. */
  function frac(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(1, n);
  }
  function mrEmpty(reason) {
    return { available: false, source: MR_SOURCE, points: [], peaks: [], reason: reason || '' };
  }
  function mrPoint(p) {
    if (!p || typeof p !== 'object') return null;
    var start = num(p.start), end = num(p.end), value = frac(p.value);
    if (!(end >= start) || !(value > 0)) return null;
    return { start: start, end: end, value: value };
  }
  function mrPeak(p) {
    if (!p || typeof p !== 'object') return null;
    var start = num(p.start), end = num(p.end), peakValue = frac(p.peakValue);
    if (!(end >= start) || !(peakValue > 0)) return null;
    var peakTime = num(p.peakTime);
    return {
      start: start, end: end,
      peakTime: peakTime >= start && peakTime <= end ? peakTime : start,
      peakValue: peakValue, averageValue: frac(p.averageValue), rank: 0
    };
  }
  function ytMostReplayedFrom(raw) {
    if (!raw || typeof raw !== 'object') return mrEmpty('');
    var points = (Array.isArray(raw.points) ? raw.points : []).map(mrPoint).filter(Boolean).slice(0, 200);
    var peaks = (Array.isArray(raw.peaks) ? raw.peaks : []).map(mrPeak).filter(Boolean).slice(0, 20);
    /* O rank é recontado aqui de propósito: vale a ordem que sobreviveu à limpeza, não o
       número que veio de fora. */
    peaks.sort(function (a, b) { return b.peakValue - a.peakValue; });
    peaks.forEach(function (p, i) { p.rank = i + 1; });
    return {
      available: raw.available === true && peaks.length > 0,
      source: MR_SOURCE, points: points, peaks: peaks, reason: cleanText(raw.reason, 40)
    };
  }
  function mrIntensityLabel(score) {
    var valor = frac(score);
    for (var i = 0; i < MR_INTENSITY.length; i++) {
      if (valor >= MR_INTENSITY[i][0]) return MR_INTENSITY[i][1];
    }
    return 'Interesse moderado';
  }
  /* Resposta do helper → recomendações prontas para a tela. Função pura. Reaproveita
     ytMostReplayedFrom (o MESMO saneamento) em vez de repetir regra. */
  function mrRecsFrom(payload, duration) {
    var bloco = ytMostReplayedFrom(payload && payload.mostReplayed);
    var total = num(duration);
    var peaks = bloco.peaks.filter(function (p) {
      /* Pico fora do vídeo carregado denuncia sidecar de OUTRO arquivo. Descartar é melhor
         do que desenhar faixa em pedaço de linha do tempo que não existe. */
      return p.end > p.start && (!total || p.end <= total + 1);
    }).map(function (p) {
      return { rank: p.rank, start: p.start, end: p.end, score: p.peakValue,
               intensity: mrIntensityLabel(p.peakValue) };
    });
    return { available: bloco.available && peaks.length > 0, peaks: peaks, reason: bloco.reason };
  }
  /* --- legenda do vídeo baixado ------------------------------------------------------
     Vem do MESMO sidecar da audiência, como RESUMO: o navegador nunca carrega a
     transcrição inteira (um podcast de 3 h tem milhares de falas). Quem lê o texto é o
     /api/video-cut, no servidor, na hora de queimar a legenda no 9:16. */
  function mrCaptionsFrom(payload) {
    var raw = payload && payload.captions;
    if (!raw || typeof raw !== 'object') return null;
    var count = num(raw.count);
    return {
      available: raw.available === true && count > 0,
      language: cleanText(raw.language, 20),
      kind: cleanText(raw.kind, 20),
      reason: cleanText(raw.reason, 60),
      count: count
    };
  }
  /* Uma frase por estado. Nenhum ramo devolve '' com legenda ausente: "não há legenda" e
     "não olhei a legenda" precisam ser distinguíveis na tela (BP-008). */
  function mrCaptionsLabel(captions) {
    if (!captions) return '';
    if (captions.available) {
      var idioma = captions.language ? ' (' + captions.language + ')' : '';
      return captions.kind === 'automatica'
        ? 'Legenda automática disponível' + idioma + ' — entra no 9:16'
        : 'Legenda disponível' + idioma + ' — entra no 9:16';
    }
    if (captions.reason === 'CAPTIONS_EXTRACTION_FAILED') {
      return 'A legenda deste vídeo não pôde ser extraída; o 9:16 sai sem legenda.';
    }
    return 'O YouTube não deu legenda em português para este vídeo; o 9:16 sai sem legenda.';
  }
  function mrPeakByRank(rank) {
    for (var i = 0; i < MR_REC.peaks.length; i++) {
      if (String(MR_REC.peaks[i].rank) === String(rank)) return MR_REC.peaks[i];
    }
    return null;
  }
  /* Busca a análise que o baixador já gravou ao lado do vídeo. Uma vez por vídeo. O nome
     do arquivo carregado é a chave — e o `duration` do sidecar confere se é mesmo este
     vídeo, para nunca desenhar recomendação de outro arquivo de nome parecido. */
  function mrLoad() {
    if (!INTAKE.url || !INTAKE.name) return;
    if (MR_REC.name === INTAKE.name && MR_REC.state !== 'idle') return;
    MR_REC = { name: INTAKE.name, state: 'loading', peaks: [], reason: '', videoId: '',
               captions: null };
    ytPost('/api/most-replayed', { name: INTAKE.name }).then(function (payload) {
      if (MR_REC.name !== INTAKE.name) return;      // trocaram o vídeo durante a busca
      var dur = num(payload && payload.duration);
      if (dur && num(INTAKE.duration) && Math.abs(dur - num(INTAKE.duration)) > 2) {
        MR_REC.state = 'mismatch';
      } else {
        /* Legenda é do VÍDEO, não do pico: mesmo sem nenhuma recomendação o operador
           precisa saber se o corte que ele marcar na mão vai sair legendado. */
        MR_REC.captions = mrCaptionsFrom(payload);
        var recs = mrRecsFrom(payload, INTAKE.duration);
        MR_REC.state = recs.available ? 'ready' : 'none';
        MR_REC.peaks = recs.peaks;
        MR_REC.reason = recs.reason;
        MR_REC.videoId = cleanText(payload && payload.videoId, 20);
      }
      render();
    }).catch(function () {
      /* Sem trabalhador local (file://) ou sem análise no disco. Não é erro do usuário:
         estado neutro, e a marcação manual segue funcionando igual. */
      if (MR_REC.name === INTAKE.name) { MR_REC.state = 'none'; render(); }
    });
  }
  /* Recebe os dados por argumento (e não lê o estado do módulo) para poder ser provado
     sem DOM: a forma do que aparece na tela é justamente o que precisa de teste. */
  function mrBandsHTML(peaks, duration) {
    var total = num(duration);
    if (!total || !peaks || !peaks.length) return '';
    return peaks.map(function (p) {
      var left = Math.max(0, Math.min(100, (p.start / total) * 100));
      var width = Math.max(0.8, Math.min(100 - left, ((p.end - p.start) / total) * 100));
      return '<span class="vop-mark-rec" style="left:' + left.toFixed(3) + '%;width:'
        + width.toFixed(3) + '%" aria-hidden="true"></span>';
    }).join('');
  }
  function mrListHTML(state, peaks, captions) {
    /* A legenda é propriedade do VÍDEO inteiro, então aparece UMA vez, no cabeçalho — e
       não repetida em cada linha, que só encheria a lista sem dizer nada novo. O que é por
       clipe (a legenda caiu ou não dentro DESTE intervalo) é dito no fim do download, pelo
       cabeçalho X-Clip-Captions, que é a única fonte que sabe disso de verdade. */
    var legenda = mrCaptionsLabel(captions);
    var aviso = legenda
      ? '<p class="vop-form-note" data-intake-cap-note>' + esc(legenda) + '</p>' : '';
    if (state === 'loading') {
      return '<p class="vop-form-note" data-intake-rec-note>Procurando “Mais reproduzidos”…</p>';
    }
    if (state === 'mismatch') {
      return '<p class="vop-form-note" data-intake-rec-note>A análise encontrada é de outro '
        + 'vídeo; nenhuma recomendação foi aplicada.</p>';
    }
    if (state !== 'ready' || !peaks || !peaks.length) {
      return '<p class="vop-form-note" data-intake-rec-note>“Mais reproduzidos” não '
        + 'disponível para este vídeo. Marque os trechos na barra normalmente.</p>' + aviso;
    }
    return '<div class="vop-rec" data-intake-rec>'
      + '<div class="vop-rec-head"><strong>Trechos recomendados</strong>'
      + '<small>Audiência medida pelo YouTube. É sugestão — o corte é seu.</small>'
      + (legenda ? '<small data-intake-cap-note>' + esc(legenda) + '</small>' : '')
      + '</div>'
      + peaks.map(function (p) {
        return '<div class="vop-rec-row">'
          + '<span class="vop-rec-rank">#' + esc(String(p.rank)) + '</span>'
          + '<span class="vop-rec-when"><strong>' + esc(fmtClock(p.start)) + ' → '
          + esc(fmtClock(p.end)) + '</strong><small>' + esc(p.intensity) + '</small></span>'
          + '<span class="vop-rec-acts">'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="rec-play" data-rank="'
          + esc(String(p.rank)) + '">Ver trecho</button>'
          + '<button class="vop-btn vop-btn-secondary" type="button" data-act="rec-use" data-rank="'
          + esc(String(p.rank)) + '">Usar como corte</button>'
          + '</span></div>';
      }).join('')
      + '</div>';
  }
  /* Pico → seleção provisória. Só inSec/outSec: nem id, nem nome, nem prioridade. É o
     que garante que "Usar como corte" preenche a marcação e NÃO cria corte. */
  function mrSelectionFrom(peak) {
    return { inSec: num(peak && peak.start), outSec: num(peak && peak.end) };
  }
  function mrAction(panel, video, act, rank) {
    var peak = mrPeakByRank(rank);
    if (!peak || !panel) return;
    if (act === 'play') {
      if (video) {
        video.currentTime = peak.start;
        if (video.play) video.play();
      }
      return;
    }
    var selecao = mrSelectionFrom(peak);
    INTAKE.inSec = selecao.inSec;
    INTAKE.outSec = selecao.outSec;
    var campoIn = panel.querySelector('[data-intake-cut-field="inSec"]');
    var campoOut = panel.querySelector('[data-intake-cut-field="outSec"]');
    if (campoIn) campoIn.value = clockField(peak.start);
    if (campoOut) campoOut.value = clockField(peak.end);
    render();
  }

  /* --- Vídeo da sessão ------------------------------------------------------------- */
  function intakeRelease() {
    if (INTAKE.url) URL.revokeObjectURL(INTAKE.url);
    INTAKE.url = '';
  }
  function intakeSetFile(file) {
    var replacing = !!INTAKE.url;
    /* Carregar o original é assunto do Passo 1 — é lá que vive o seletor, a área de soltar
       e a faixa que explica uma recusa. Voltar para ele é o que garante que "arquivo não
       aceito" NUNCA cai numa tela sem onde aparecer (BP-008). */
    TAB = 'overview';
    /* Os cortes pertencem ao vídeo que estava aberto: trocar o arquivo os descarta, e o
       operador precisa SABER disso na hora (BP-008) — perder trabalho em silêncio é o pior. */
    var droppedCuts = (INTAKE.cuts || []).length;
    /* Revoga ANTES de criar a próxima: trocar de vídeo não pode acumular URL temporária. */
    intakeRelease();
    if (!isVideoFile(file)) {
      INTAKE = {
        url: '', file: null, name: String(file && file.name || ''), size: num(file && file.size),
        lastModified: 0, type: '', duration: 0,
        state: 'error', replaced: replacing,
        message: 'Este arquivo não parece ser um vídeo. Escolha um MP4 do seu computador.',
        inSec: '', outSec: '', cuts: [], editingId: ''
      };
      render();
      toast('Formato não aceito. Escolha um arquivo de vídeo, de preferência MP4.'
        + (droppedCuts ? ' Os ' + droppedCuts + ' corte(s) do vídeo anterior foram descartados.' : ''), 'error');
      return;
    }
    INTAKE = {
      url: URL.createObjectURL(file), file: file, name: String(file.name || ''), size: num(file.size),
      lastModified: num(file.lastModified), type: String(file.type || ''),
      duration: 0, state: 'loading', message: '', replaced: replacing,
      inSec: '', outSec: '', cuts: [], editingId: ''
    };
    render();
    if (droppedCuts) {
      toast('Vídeo trocado: os ' + droppedCuts + ' corte(s) marcados no vídeo anterior foram descartados.');
    }
  }
  /* Puro: o teste headless confere as quatro frases sem precisar de <video>. */
  function intakeStatus(intake) {
    var it = intake || {};
    if (it.state === 'error') {
      return { tone: 'error', text: it.message || 'Não foi possível abrir este arquivo.' };
    }
    if (it.state === 'loading') return { tone: 'warn', text: 'Abrindo o vídeo nesta sessão…' };
    if (it.state === 'ready') {
      return {
        tone: 'ok',
        text: (it.replaced ? 'Vídeo trocado. ' : '')
          + 'Vídeo carregado e pronto. Ele está disponível apenas nesta sessão e não foi enviado para a nuvem.'
      };
    }
    return {
      tone: 'idle',
      text: 'Nenhum arquivo escolhido. Selecione um vídeo autorizado do seu computador para começar.'
    };
  }
  function intakeMarkStatus(intake) {
    var it = intake || {};
    var hasIn = it.inSec !== '' && it.inSec !== null && typeof it.inSec !== 'undefined';
    var hasOut = it.outSec !== '' && it.outSec !== null && typeof it.outSec !== 'undefined';
    if (hasIn && !hasOut) return { tone: 'error', text: 'Defina o fim do corte.' };
    if (!hasIn && hasOut) return { tone: 'error', text: 'Defina o início do corte.' };
    return markStatus({
      hasFile: !!it.url, fileError: it.state === 'error', durationSec: it.duration,
      inSec: it.inSec, outSec: it.outSec
    });
  }
  /* Só o intervalo EXATAMENTE igual é recusado. Sobreposição parcial é legítima: dois
     cortes podem compartilhar a mesma fala com recortes diferentes. Devolve o corte
     conflitante (não um booleano) para a mensagem poder dizer qual é. */
  function intakeCutDuplicate(cuts, inSec, outSec, exceptId) {
    var start = num(inSec);
    var end = num(outSec);
    return (cuts || []).find(function (cut) {
      return cut && cut.id !== exceptId && num(cut.inSec) === start && num(cut.outSec) === end;
    }) || null;
  }
  /* Um corte é SÓ informação de tempo apontando para o vídeo da sessão:
     { id, name, priority, inSec, outSec }. Nenhuma cópia do original é criada para
     conferir o trecho — a prévia é o mesmo <video> posicionado em inSec e parado em
     outSec. Extração física acontece uma vez só, no ⬇ (FFmpeg local). */
  function cutName(cut, index) { return cleanText(cut && cut.name, 80) || 'Corte ' + (num(index) + 1); }
  function prioritySelectHTML(cut, index) {
    return '<select class="vop-cut-prio" data-cut-field="priority" data-id="' + esc(cut.id) + '"'
      + ' aria-label="Prioridade do corte ' + (num(index) + 1) + '">'
      + PRIORITY_ORDER.map(function (id) {
        return '<option value="' + id + '"' + (priorityOf(cut) === id ? ' selected' : '') + '>'
          + esc(PRIORITY_LABEL[id]) + '</option>';
      }).join('') + '</select>';
  }
  function cutTimesHTML(cut) {
    return '<span class="vop-cut-label">' + esc(fmtClock(cut.inSec)) + ' → ' + esc(fmtClock(cut.outSec))
      + ' · ' + (num(cut.outSec) - num(cut.inSec)) + 's</span>';
  }
  /* Passo 2: a linha É o editor. Nome e prioridade são os únicos campos — sem descrição,
     legenda, hashtag nem categoria. Escrever NÃO re-renderiza a lista (um innerHTML novo
     por tecla mataria o foco), então o mesmo <input> mostra e edita o dado. */
  function intakeCutsHTML() {
    var cuts = INTAKE.cuts || [];
    if (!cuts.length) {
      return '<p class="vop-mark-note">Nenhum corte marcado ainda. Marque um trecho acima e clique em “Adicionar corte”.</p>';
    }
    return '<ul class="vop-cuts">' + cuts.map(function (cut, index) {
      return '<li class="vop-cut"' + (cut.id === INTAKE.editingId ? ' data-editing="true"' : '') + '>'
        + '<span class="vop-cut-n" aria-hidden="true">' + (index + 1) + '</span>'
        + '<input class="vop-cut-name" type="text" maxlength="80" value="' + esc(cutName(cut, index)) + '"'
        + ' data-cut-field="name" data-id="' + esc(cut.id) + '" spellcheck="false"'
        + ' aria-label="Nome do corte ' + (index + 1) + '">'
        + prioritySelectHTML(cut, index)
        + cutTimesHTML(cut)
        + reframeFieldHTML(cut, 'cut-field', 'cutframe',
          sourceWarning(reframeOf(cut), INTAKE.width, INTAKE.height))
        + '<span class="vop-cut-acts">'
        + '<button class="vop-inline-action" type="button" data-act="intake-cut-play" data-id="' + esc(cut.id) + '">Tocar</button>'
        + '<button class="vop-inline-action vop-cut-save" type="button" data-act="intake-cut-save" data-id="' + esc(cut.id) + '"'
        + (cutBusy(cut) ? ' disabled aria-busy="true">Gerando 9:16…' : '>⬇ Salvar')
        + '</button>'
        + '<button class="vop-inline-action" type="button" data-act="intake-cut-edit" data-id="' + esc(cut.id) + '">Editar</button>'
        + '<button class="vop-inline-action vop-cut-danger" type="button" data-act="intake-cut-remove" data-id="' + esc(cut.id) + '">Remover</button>'
        + '</span></li>';
    }).join('') + '</ul>';
  }
  /* --- Revisão da legenda, antes do render final -------------------------------------
     O YouTube erra palavra e troca palavrão por "[ __ ]": o que ele detectou é ponto de
     partida, não texto final. Aqui o operador VÊ cada fala do trecho e corrige o texto —
     nada é adivinhado nem completado por nós. O tempo fica só de leitura: quem manda no
     relógio é o corte.

     Vive na SESSÃO, como o vídeo e a lista de cortes. O sidecar em disco continua sendo o
     registro do que o YouTube disse (nunca é reescrito), e a correção é uma camada por
     cima dele, entregue ao servidor por trecho na hora de baixar. */
  var CAPS = Object.create(null);
  var CAPS_OPEN = '';
  var CAP_ROUTE = '/api/clip-captions';
  var CAP_MSG = {
    loading: 'Lendo a legenda deste trecho…',
    ok: 'Isto foi o que o YouTube detectou. Corrija o que estiver errado — o texto que ficar aqui é o que entra no vídeo.',
    edited: 'Texto corrigido por você. É este que vai ser queimado no clip.',
    CAPTIONS_NOT_AVAILABLE: 'O YouTube não deu legenda em português para este vídeo; o clip sai sem legenda.',
    CAPTIONS_EXTRACTION_FAILED: 'A legenda deste vídeo não pôde ser extraída no download; o clip sai sem legenda.',
    CAPTIONS_OUT_OF_RANGE: 'Nenhuma fala da transcrição cai dentro deste trecho; o clip sai sem legenda.',
    CAPTIONS_EDITED_EMPTY: 'Você apagou o texto de todas as falas: este clip vai sair SEM legenda.',
    CAPTIONS_TOO_MANY: 'Trecho longo demais para revisar fala por fala. Baixando sem revisar, o clip sai legendado igual; para revisar, marque um corte mais curto.'
  };
  function capMessage(state) { return CAP_MSG[state] || ''; }
  /* A revisão pertence a UM intervalo. Mudar o início ou o fim no Passo 2 invalida o que
     foi corrigido: aquele texto foi escrito para outras falas, e reaproveitá-lo calado
     poria a legenda de um trecho em cima de outro. */
  function capOf(cut) {
    var entry = cut && CAPS[cut.id];
    if (!entry) return null;
    if (entry.inSec !== num(cut.inSec) || entry.outSec !== num(cut.outSec)) {
      capDrop(cut.id);
      return null;
    }
    return entry;
  }
  /* Descartar a revisão também FECHA o painel: sem isto a linha continuava com o botão
     "Fechar legenda" e aria-expanded="true" sobre um painel que já não é renderizado — o
     operador clicava em fechar o que não estava aberto. Quem descarta por causa do intervalo
     avisa no toast de "Corte atualizado" (é lá que a ação do operador aconteceu). */
  function capDrop(id) {
    var tinha = !!CAPS[id];
    delete CAPS[id];
    if (CAPS_OPEN === id) CAPS_OPEN = '';
    return tinha;
  }
  /* Só a CORREÇÃO sobe para o servidor. Legenda apenas lida não vira override: o
     /api/video-cut já lê a mesma fonte, e devolver o que veio de lá seria ruído. */
  /* A revisao nasceu servindo so o Passo 3 (INTAKE.cuts). Agora serve tambem o trecho
     recomendado do YouTube, que vive em YT.candidates -- por isso o alvo e procurado nos
     DOIS lugares. O painel (capHTML/capOf/capEdited) ja era generico: recebia o objeto e o
     id, nunca a lista. So a escrita e o "Restaurar" e que amarravam no INTAKE. */
  function capTarget(id) {
    return findById(INTAKE.cuts, id) || findById(YT.candidates, id);
  }
  /* Trecho do YouTube NAO precisa de servidor para revisar: as falas dele ja vieram no
     probe e estao em `clip.clipCues`. E o /api/remotion-render recebe as falas NO CORPO da
     requisicao, entao editar aqui basta -- nenhuma rota nova, nenhum ida e volta.
     Sem teto de falas de proposito: o trecho e limitado pelo proprio corte, e cortar a lista
     mostraria as primeiras como se fossem todas, que e o defeito que o servidor evita no
     Passo 3 recusando o trecho longo em vez de truncar. */
  function capSeed(clip) {
    var cues = capCuesFrom({ cues: (clip && clip.clipCues) || [] });
    CAPS[clip.id] = {
      inSec: num(clip.inSec), outSec: num(clip.outSec),
      cues: cues,
      original: cues.map(function (c) { return { start: c.start, end: c.end, text: c.text }; }),
      state: cues.length ? 'ok' : 'CAPTIONS_OUT_OF_RANGE'
    };
    return CAPS[clip.id];
  }
  function capEdited(cut) {
    var entry = capOf(cut);
    return entry && entry.state === 'edited' ? entry.cues : null;
  }
  /* Fronteira de entrada: o corpo vem do helper local, mas é tratado como dado externo —
     tempo que não é número e texto gigante não podem virar <input> nem voltar ao render. */
  function capCuesFrom(payload) {
    var raw = (payload && payload.cues) || [];
    if (!Array.isArray(raw)) return [];
    /* `secs`, NUNCA `num`: o tempo da fala tem casa decimal e o num() do módulo arredonda
       para segundo inteiro (ele existe para o intervalo do corte, que é inteiro). Com num()
       aqui, duas falas do mesmo segundo virariam a mesma fala e a legenda corrigida voltaria
       ao servidor com o relógio errado. */
    return raw.slice(0, 400).map(function (cue) {
      return { start: secs(cue && cue.start), end: secs(cue && cue.end),
               text: cleanText(cue && cue.text, 300) };
    }).filter(function (cue) { return cue.end > cue.start; });
  }
  function capLoad(cut) {
    var resolved = intakeResolved(cut.inSec, cut.outSec, '');
    var session = resolved && renderSession(resolved.source.id);
    if (!session) { toast('Abra o vídeo nesta sessão antes de revisar a legenda.', 'error'); return; }
    CAPS[cut.id] = { inSec: num(cut.inSec), outSec: num(cut.outSec), state: 'loading',
                     cues: [], original: [] };
    renderKeepingScroll();
    ytPost(CAP_ROUTE, { token: session.token, name: INTAKE.name,
                        start: num(cut.inSec), end: num(cut.outSec) })
      .then(function (payload) {
        var entry = CAPS[cut.id];
        if (!entry || entry.state !== 'loading') return;   // trocaram de corte no meio
        entry.cues = capCuesFrom(payload);
        /* O texto original fica guardado deste lado para o "Restaurar" existir sem uma
           segunda ida ao servidor — e para o operador poder comparar. */
        entry.original = entry.cues.map(function (c) {
          return { start: c.start, end: c.end, text: c.text };
        });
        entry.state = cleanText(payload && payload.state, 40) || 'ok';
        renderKeepingScroll();
      })
      .catch(function (error) {
        /* Só fecha o painel DESTE corte: a resposta pode chegar depois de o operador abrir a
           legenda de outro clip, e derrubar o painel dele seria erro fantasma. O nome do
           clip entra na mensagem pelo mesmo motivo. */
        capDrop(cut.id);
        renderKeepingScroll();
        toast('Legenda de “' + cutName(cut, INTAKE.cuts.indexOf(cut)) + '”: '
          + (cleanText(error && error.message, 300) || 'não consegui ler.'), 'error');
      });
  }
  /* Digitar NÃO re-renderiza a lista: um innerHTML novo por tecla mataria o foco (BP-001,
     mesma regra do cutFieldWrite). O estado vira "edited" na primeira diferença real, e
     volta a "ok" se o operador desfizer tudo na mão. */
  function capCueWrite(input) {
    var cut = capTarget(input.dataset.id);
    var entry = capOf(cut);
    var indice = num(input.dataset.capIndex);
    if (!entry || !entry.cues[indice]) return;
    entry.cues[indice].text = cleanText(input.value, 300);
    var mudou = entry.cues.some(function (cue, i) {
      return !entry.original[i] || entry.original[i].text !== cue.text;
    });
    entry.state = mudou ? 'edited' : (entry.original.length ? 'ok' : entry.state);
    var painel = input.closest('[data-cap-panel]');
    var nota = painel && painel.querySelector('[data-cap-note]');
    if (nota) nota.textContent = capMessage(entry.state);
  }
  /* Restaurar escreve nos <input> que já estão na tela em vez de re-renderizar. Dois motivos:
     a lista de falas é um container rolável próprio e um innerHTML novo a jogaria de volta
     para o topo (BP-013 — o `renderKeepingScroll` só cuida do scroll da janela); e o painel
     não pisca. */
  function capRestore(cut, panel) {
    var entry = capOf(cut);
    if (!entry || !entry.original.length) return;
    entry.cues = entry.original.map(function (c) {
      return { start: c.start, end: c.end, text: c.text };
    });
    entry.state = 'ok';
    var campos = panel ? panel.querySelectorAll('[data-cap-field]') : [];
    for (var i = 0; i < campos.length; i++) {
      if (entry.cues[i]) campos[i].value = entry.cues[i].text;
    }
    var nota = panel && panel.querySelector('[data-cap-note]');
    if (nota) nota.textContent = capMessage(entry.state);
    if (!campos.length) renderKeepingScroll();   // painel fora da tela: cai no caminho longo
    toast('Texto do YouTube restaurado neste trecho.');
  }
  /* O tempo é de LEITURA: com décimo de segundo porque duas falas seguidas caem no mesmo
     segundo cheio, e aí "0:12 → 0:12" não distinguiria uma da outra. */
  function capClock(seconds) {
    /* Em DÉCIMOS antes de separar: `2.4 % 1` dá 0.3999… em ponto flutuante, e cortar isso
       mostraria "0:02.3" para uma fala que começa em 2,4 s. Visto no teste. */
    var decimos = Math.round(secs(seconds) * 10);
    return fmtClock(Math.floor(decimos / 10)) + '.' + (decimos % 10);
  }
  function capPanelHTML(cut) {
    return capHTML(cut && cut.id, capOf(cut));
  }
  /* Recebe os dados por argumento (e não lê o estado do módulo) para poder ser provado sem
     DOM — mesma regra do mrListHTML. A forma do que aparece na tela é justamente o que
     precisa de teste. */
  function capHTML(id, entry) {
    if (!entry) return '';
    var nota = '<p class="vop-cap-note" data-cap-note>' + esc(capMessage(entry.state)) + '</p>';
    if (!entry.cues.length) {
      /* Sem fala nenhuma o painel continua aparecendo, com o motivo: sumir sem explicação
         seria indistinguível de painel quebrado (BP-008). */
      return '<div class="vop-cap" data-cap-panel data-id="' + esc(id) + '">' + nota + '</div>';
    }
    var cut = { id: id };
    return '<div class="vop-cap" data-cap-panel data-id="' + esc(cut.id) + '">' + nota
      + '<ol class="vop-cap-list">'
      + entry.cues.map(function (cue, i) {
        return '<li class="vop-cap-cue">'
          + '<span class="vop-cap-time">' + esc(capClock(cue.start)) + ' → '
          + esc(capClock(cue.end)) + '</span>'
          + '<input class="vop-cap-text" type="text" maxlength="300" spellcheck="true"'
          + ' value="' + esc(cue.text) + '" data-cap-field data-cap-index="' + i + '"'
          + ' data-id="' + esc(cut.id) + '"'
          + ' aria-label="Texto da fala em ' + esc(capClock(cue.start)) + '">'
          + '</li>';
      }).join('')
      + '</ol>'
      + '<div class="vop-cap-acts">'
      + '<button class="vop-inline-action" type="button" data-act="cap-restore" data-id="'
      + esc(cut.id) + '">Restaurar texto do YouTube</button>'
      + '<small>O arquivo do YouTube não é alterado: a correção vale para este clip.</small>'
      + '</div></div>';
  }

  /* Passo 3 (Clips): os cortes prontos, um por linha. É a MESMA linha-editor do Passo 2 —
     título e urgência continuam ajustáveis aqui, porque é onde o operador batiza o arquivo
     imediatamente antes de baixá-lo (mesmo data-cut-field, mesmo cutFieldWrite, sem
     re-render). Só isso: prévia, título, urgência, baixar. */
  function reviewCutsHTML() {
    return '<ul class="vop-cuts vop-cuts-review">' + INTAKE.cuts.map(function (cut, index) {
      var aberto = CAPS_OPEN === cut.id;
      /* A linha diz, sem abrir nada, que aquele clip já tem legenda corrigida — senão o
         operador teria de abrir um por um para lembrar onde mexeu (BP-008). */
      var revisado = capEdited(cut) ? ' — corrigida' : '';
      return '<li class="vop-cut-wrap">'
        + '<div class="vop-cut">'
        + '<span class="vop-cut-n" aria-hidden="true">' + (index + 1) + '</span>'
        + '<input class="vop-cut-name" type="text" maxlength="80" value="' + esc(cutName(cut, index)) + '"'
        + ' data-cut-field="name" data-id="' + esc(cut.id) + '" spellcheck="false"'
        + ' aria-label="Título do clip ' + (index + 1) + '">'
        + prioritySelectHTML(cut, index)
        + cutTimesHTML(cut)
        + '<span class="vop-cut-acts">'
        + '<button class="vop-inline-action" type="button" data-act="intake-cut-play" data-id="' + esc(cut.id) + '">▶ Prévia</button>'
        + '<button class="vop-inline-action" type="button" data-act="cap-review" data-id="' + esc(cut.id) + '"'
        + ' aria-expanded="' + (aberto ? 'true' : 'false') + '">'
        + (aberto ? 'Fechar legenda' : 'Legenda' + revisado) + '</button>'
        + '<button class="vop-btn vop-btn-secondary" type="button" data-act="intake-cut-save" data-id="' + esc(cut.id) + '"'
        + (cutBusy(cut) ? ' disabled aria-busy="true">Gerando 9:16…' : '>⬇ Baixar vídeo')
        + '</button>'
        + '</span></div>'
        + (aberto ? capPanelHTML(cut) : '')
        + '</li>';
    }).join('') + '</ul>';
  }
  function intakePickHTML(label, variant) {
    /* O <input type=file> é o controle de verdade: fica alcançável por teclado e o <label>
       torna a área inteira clicável. O <span> é a aparência, não um segundo controle. */
    return '<label class="vop-intake-pick"><input type="file" accept="video/mp4,video/*" data-intake-input>'
      + '<span class="vop-btn ' + variant + '">' + esc(label) + '</span></label>';
  }
  function field(label, name, value, attrs) {
    return '<label class="vop-field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" value="' + esc(value || '') + '" ' + (attrs || '') + '></label>';
  }
  function intakeMarkHTML() {
    var status = intakeMarkStatus(INTAKE);
    var hasIn = INTAKE.inSec !== '';
    var hasOut = INTAKE.outSec !== '';
    var selection = (hasIn || hasOut)
      ? 'trecho ' + (hasIn ? fmtClock(INTAKE.inSec) : '--:--') + ' → ' + (hasOut ? fmtClock(INTAKE.outSec) : '--:--')
      : 'nenhum trecho marcado';
    return '<div class="vop-mark" data-intake-mark>'
      + '<div class="vop-mark-head"><span>Marcar cortes</span></div>'
      /* Uma frase diz o que fazer; o resto da explicação fica a um clique, sem sumir. */
      + '<p class="vop-form-note"><strong>Arraste na barra</strong> para marcar o trecho e clique em '
      + '<strong>Adicionar corte</strong>. Ele entra na lista abaixo, onde você dá nome e '
      + 'prioridade — o MP4 só é gerado quando você pedir.</p>'
      + '<details class="vop-more vop-more-flat"><summary>Como isto funciona</summary>'
      + '<p class="vop-form-note">As bordas da faixa puxam início e fim; os campos aceitam o tempo '
      + 'exato pelo teclado em <strong>min:seg</strong> (15:30), em <strong>h:min:seg</strong> '
      + '(1:15:30) ou em segundos puros (930). Quem corta é o FFmpeg do projeto, atendendo em 127.0.0.1 — nada '
      + 'para instalar, nada para colar no PowerShell. Marque quantos trechos quiser no mesmo vídeo; '
      + 'a lista fica nesta sessão e some ao recarregar — o MP4 baixado, não: ele fica na Central.</p></details>'
      + '<div class="vop-form-grid">'
      /* Tempo em min:seg, do jeito que se lê num player. Texto e não number: o campo
         numérico do navegador recusa os dois pontos. Segundo puro continua valendo. */
      + field('Início (min:seg)', 'intakeInSec', clockField(hasIn ? INTAKE.inSec : ''), 'type="text" placeholder="15:30" autocomplete="off" spellcheck="false" data-intake-cut-field="inSec"')
      + field('Fim (min:seg)', 'intakeOutSec', clockField(hasOut ? INTAKE.outSec : ''), 'type="text" placeholder="16:00" autocomplete="off" spellcheck="false" data-intake-cut-field="outSec"')
      + '</div>'
      /* A barra É o controle: arrastar nela marca o trecho. Os campos continuam valendo
         (teclado, precisão) e são a fonte da verdade — o arrasto escreve neles. */
      + '<div class="vop-mark-track" data-intake-mark-track role="presentation">'
      + (MR_REC.name === INTAKE.name && MR_REC.state === 'ready'
         ? mrBandsHTML(MR_REC.peaks, INTAKE.duration) : '')
      + '<div class="vop-mark-band" data-intake-mark-band hidden>'
      + '<span class="vop-mark-handle" data-intake-handle="in" aria-hidden="true"></span>'
      + '<span class="vop-mark-handle" data-intake-handle="out" aria-hidden="true"></span></div>'
      + '<div class="vop-mark-playhead" data-intake-mark-playhead></div></div>'
      + '<div class="vop-mark-read"><strong data-intake-mark-now>0:00</strong><span>de</span>'
      + '<span data-intake-mark-dur>' + esc(fmtClock(INTAKE.duration)) + '</span>'
      + '<em data-intake-mark-sel>' + esc(selection) + '</em></div>'
      + '<div class="vop-mark-acts">'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-intake-mark-act="in">Marcar início</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-intake-mark-act="out">Marcar fim</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-intake-mark-act="p15">Preset 15s</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-intake-mark-act="p30">Preset 30s</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-intake-mark-act="play">Tocar o corte</button>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-intake-mark-act="clear">Limpar</button>'
      + '</div>'
      + '<p class="vop-mark-status" data-intake-mark-status data-tone="' + esc(status.tone) + '" role="status">'
      + esc(status.text) + '</p>'
      /* No Passo 2 a ação principal é DEFINIR o corte, não exportá-lo: adicionar à lista é
         a primária. Baixar o MP4 continua aqui, secundário, e é a ação principal do Passo 3.
         As duas só habilitam com trecho válido; quem explica o bloqueio é a faixa de estado
         logo acima (BP-008). */
      + '<div class="vop-mark-acts">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="intake-cut-add" data-intake-add'
      + (status.tone === 'ok' ? '' : ' disabled title="' + esc(status.text) + '"')
      + '>' + (INTAKE.editingId ? 'Atualizar corte' : 'Adicionar corte') + '</button>'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="intake-cut-save" data-intake-save'
      + (status.tone === 'ok' ? '' : ' disabled title="' + esc(status.text) + '"')
      + '>⬇ Salvar corte</button></div>'
      + (MR_REC.name === INTAKE.name ? mrListHTML(MR_REC.state, MR_REC.peaks, MR_REC.captions) : '')
      + '<div data-intake-cuts>' + intakeCutsHTML() + '</div>'
      + '<small class="vop-mark-note">Trocar o vídeo limpa a marcação e a lista de cortes. '
      + 'Nenhum dado deste rascunho é salvo no navegador.</small>'
      + '</div>';
  }
  /* ---------------------------------------------------------------------------------
     UM VÍDEO POR SESSÃO, UM PLAYER POR TELA.
     INTAKE é a fonte única da verdade do original: url (blob), file (o File real para o
     FFmpeg), duration, e cuts[]. Os três passos montam a MESMA seção [data-intake] com o
     MESMO <video src=INTAKE.url>, então nenhum passo tem estado de upload próprio e
     nenhum passo pede o arquivo de novo. Carregar acontece só no Passo 1.
     --------------------------------------------------------------------------------- */
  function intakeStatusStripHTML() {
    var status = intakeStatus(INTAKE);
    return '<p class="vop-mark-status" data-intake-status data-tone="' + esc(status.tone) + '" role="status">'
      + esc(status.text) + '</p>';
  }
  function intakeVideoTagHTML() {
    return '<video class="vop-intake-video" data-intake-video controls preload="metadata" src="'
      + esc(INTAKE.url) + '"></video>';
  }
  /* Nos passos 2 e 3 o vídeo não é assunto, é ferramenta: uma linha diz qual arquivo está
     em uso e a única saída para trocá-lo é voltar ao Passo 1, que é quem carrega. */
  function intakeIdentityHTML() {
    return '<p class="vop-intake-id">Vídeo em uso: <strong>' + esc(INTAKE.name) + '</strong>'
      + ' · <span data-intake-duration>' + esc(INTAKE.duration ? fmtClock(INTAKE.duration) : 'lendo…') + '</span>'
      + ' · <button class="vop-inline-action" type="button" data-act="tab" data-tab="overview">trocar no Passo 1</button></p>';
  }
  function emptyHTML(title, text, action, label, attrs) {
    return '<div class="vop-empty"><div class="vop-empty-icon" aria-hidden="true">▶</div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>'
      + (action ? '<button class="vop-btn vop-btn-primary" type="button" data-act="' + esc(action) + '"'
        + (attrs ? ' ' + attrs : '') + '>' + esc(label) + '</button>' : '') + '</div>';
  }
  /* Passo 2 e 3 nunca oferecem seletor de arquivo: se não há vídeo, o caminho é voltar ao
     Passo 1 — é lá, e só lá, que o original entra. */
  function needVideoHTML(oQue) {
    return emptyHTML('Carregue o vídeo no Passo 1',
      'O Estúdio usa um vídeo por sessão: você escolhe no Passo 1 e os passos seguintes '
      + 'reaproveitam o mesmo arquivo — não é preciso selecioná-lo de novo para ' + oQue + '.',
      'tab', 'Ir para o Passo 1', 'data-tab="overview"');
  }
  /* PASSO 1 — só carregar o original, validar que o navegador consegue abrir e seguir. */
  function videoStepHTML() {
    if (!INTAKE.url) {
      return '<section class="vop-section vop-intake" data-intake>'
        + '<div class="vop-section-head"><div><h2>Comece pelo vídeo</h2>'
        + '<p class="vop-form-note">Selecione um vídeo autorizado do seu computador. Ele fica só nesta sessão — nada é enviado para a nuvem.</p></div></div>'
        + '<div class="vop-intake-drop" data-intake-drop data-over="false">'
        + '<span class="vop-intake-icon" aria-hidden="true">▶</span>'
        + '<strong>Arraste o vídeo aqui</strong>'
        + '<small>ou use o botão abaixo · MP4 de preferência</small>'
        + intakePickHTML('Selecionar vídeo do computador', 'vop-btn-primary') + '</div>'
        + intakeStatusStripHTML()
        + '<p class="vop-form-note">Tem só o link do YouTube? Use a tela <strong>YouTube</strong> — ela analisa o vídeo e baixa apenas o trecho.</p>'
        + '</section>';
    }
    var pronto = INTAKE.state === 'ready';
    return '<section class="vop-section vop-intake" data-intake>'
      + '<div class="vop-section-head"><div><h2>Vídeo desta sessão</h2>'
      + '<p class="vop-form-note">Confira que abre e toca. Ele fica disponível nos passos seguintes.</p></div>'
      + intakePickHTML('Trocar vídeo', 'vop-btn-secondary') + '</div>'
      + intakeVideoTagHTML()
      + '<dl class="vop-intake-meta">'
      + '<div><dt>Arquivo</dt><dd>' + esc(INTAKE.name) + '</dd></div>'
      + '<div><dt>Tamanho</dt><dd>' + esc(fmtBytes(INTAKE.size)) + '</dd></div>'
      + '<div><dt>Duração</dt><dd data-intake-duration>'
      + esc(INTAKE.duration ? fmtClock(INTAKE.duration) : 'lendo…') + '</dd></div>'
      + '</dl>' + intakeStatusStripHTML()
      /* Só habilita quando o navegador confirmou que consegue abrir (BP-008): bloqueado
         com o motivo à vista, e bindIntake libera no loadedmetadata sem re-render. */
      + '<div class="vop-step-next">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="tab" data-tab="cuts" data-intake-next'
      + (pronto ? '' : ' disabled title="Aguarde o navegador terminar de abrir o vídeo."')
      + '>Continuar para os cortes →</button>'
      + '<small>' + (INTAKE.cuts.length ? INTAKE.cuts.length + ' corte(s) já marcados neste vídeo.' : 'O próximo passo é marcar os trechos.') + '</small>'
      + '</div></section>';
  }
  /* PASSO 2 — só cortes: a barra, o intervalo, o nome e a prioridade. */
  function cutsStepHTML() {
    if (!INTAKE.url) return needVideoHTML('cortar');
    mrLoad();   // assíncrono e guardado; o render de agora não espera nada
    return '<section class="vop-section vop-intake vop-intake-work" data-intake>'
      + '<div class="vop-section-head"><div><h2>Marque os melhores trechos</h2>'
      + '<p class="vop-form-note">Arraste na barra para escolher início e fim, adicione o corte e dê nome e prioridade. Quantos quiser, do mesmo vídeo.</p></div></div>'
      + intakeVideoTagHTML() + intakeIdentityHTML() + intakeMarkHTML()
      + '<div class="vop-step-next">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="tab" data-tab="review"'
      + (INTAKE.cuts.length ? '' : ' disabled title="Adicione pelo menos um corte para ver os clips."')
      + '>Ver os clips →</button>'
      + '<small>' + (INTAKE.cuts.length
        ? INTAKE.cuts.length + ' corte(s) na lista. No Passo 3 você baixa cada um.'
        : 'Marque um trecho na barra e adicione o corte.') + '</small>'
      + '</div></section>';
  }
  /* PASSO 3 — os clips: o mesmo original + inSec/outSec de cada corte. NUNCA pede
     arquivo, porque o arquivo já está aqui desde o Passo 1. É o fim do fluxo: o que foi
     baixado aparece na Central. */
  function reviewStepHTML() {
    if (!INTAKE.url) return needVideoHTML('baixar os clips');
    if (!INTAKE.cuts.length) return needCutsHTML();
    return '<section class="vop-section vop-intake vop-intake-work" data-intake>'
      + '<div class="vop-section-head"><div><h2>Seus clips</h2>'
      + '<p class="vop-form-note">“Prévia” toca só o intervalo do clip, no mesmo vídeo do Passo 1. O MP4 é cortado de verdade quando você baixa — e o arquivo baixado fica na Central.</p></div></div>'
      + intakeVideoTagHTML() + intakeIdentityHTML()
      /* Régua sem alça: aqui só se confere, não se marca. Os mesmos ganchos de leitura que
         bindIntake já alimenta (posição atual e duração) — sem data-intake-mark-track,
         então o arrasto que edita o intervalo não existe nesta tela. */
      + '<div class="vop-mark-track"><div class="vop-mark-playhead" data-intake-mark-playhead></div></div>'
      + '<div class="vop-mark-read"><strong data-intake-mark-now>0:00</strong><span>de</span>'
      + '<span data-intake-mark-dur>' + esc(fmtClock(INTAKE.duration)) + '</span>'
      + '<em>' + INTAKE.cuts.length + ' clip(s) neste vídeo</em></div>'
      + reviewCutsHTML()
      + '<div class="vop-step-next">'
      + '<button class="vop-btn vop-btn-secondary" type="button" data-act="tab" data-tab="cuts">← Voltar aos cortes</button>'
      + '<small>Os cortes e o vídeo vivem nesta sessão; os MP4 já baixados ficam na Central.</small>'
      + '</div></section>';
  }
  function needCutsHTML() {
    return emptyHTML('Nenhum clip ainda',
      'Volte ao Passo 2 e marque pelo menos um trecho. O vídeo já está carregado — ele continua o mesmo.',
      'tab', 'Ir para o Passo 2', 'data-tab="cuts"');
  }

  /* --- Central de Clips (tela) -----------------------------------------------------
     Só isto: um cartão por clip baixado, com o nome do clip, o intervalo e o botão de
     baixar de novo. Agrupado pelo nome do vídeo de origem. Nada de post, direito,
     conta, aprovação ou métrica — a decisão do corte já foi tomada. */
  function libCardHTML(clip) {
    var url = savedClipUrl(clip);
    var span = num(clip.outSec) - num(clip.inSec);
    return '<article class="vop-entity-card vop-lib-card">'
      + '<div class="vop-lib-card-head"><h4>' + esc(clip.clipName) + '</h4>'
      + (clip.origin === 'youtube' ? chip('vop-chip-quiet', 'YouTube') : '') + '</div>'
      + (url ? '<video class="vop-lib-video" controls preload="metadata" src="' + esc(url) + '"></video>' : '')
      + '<p class="vop-lib-meta"><code>' + esc(fmtClock(clip.inSec) + ' → ' + fmtClock(clip.outSec)) + '</code>'
      + ' · ' + span + 's'
      + (clip.bytes ? ' · ' + esc(fmtBytes(clip.bytes)) : '')
      + ' · ' + esc(fmtDateTime(clip.createdAt)) + '</p>'
      + '<div class="vop-card-actions">'
      /* Baixar de novo é um link nativo para o arquivo que o helper guardou: sem fetch,
         sem blob, sem estado. Sem caminho guardado não há o que servir — e a linha
         seguinte diz isso em vez de oferecer um botão que não faz nada (BP-008). */
      + (url
        ? '<a class="vop-btn vop-btn-primary" href="' + esc(url) + '" download="' + esc(clip.fileName) + '">⬇ Baixar vídeo</a>'
        : '')
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="lib-remove" data-id="' + esc(clip.id) + '">Remover do histórico</button>'
      + '</div>'
      + (url
        ? '<small class="vop-lib-path">Arquivo: <code>' + esc(clip.savedPath) + '</code>. Se ele for movido ou apagado por fora, o player fica mudo.</small>'
        : '<small class="vop-lib-path">Este clip foi para a pasta de Downloads do navegador; o helper local não guardou uma cópia, então não há endereço para tocar aqui.</small>')
      + '</article>';
  }
  function centralHTML() {
    if (!LIB.clips.length) {
      return emptyHTML('Nenhum clip baixado ainda',
        'A Central guarda os MP4 que você já baixou, agrupados pelo vídeo de origem. Baixe um clip na tela YouTube e ele aparece aqui — mesmo depois de fechar o site.',
        'tab', 'Ir para o YouTube', 'data-tab="youtube"');
    }
    var groups = libGroups(LIB.clips);
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Central de Clips</span>'
      + '<h2>' + LIB.clips.length + ' clip(s) em ' + groups.length + ' vídeo(s)</h2>'
      + '<p class="vop-form-note">Os arquivos ficam no seu computador, em <code>~/Videos/Cortes Estudio</code>. Esta tela é o índice deles.</p></div></div>'
      + groups.map(function (group) {
        return '<div class="vop-lib-group">'
          + '<div class="vop-lib-group-head"><h3>' + esc(group.name) + '</h3>'
          + '<span>' + group.items.length + ' clip(s)</span>'
          + (group.videoUrl ? '<a href="' + esc(group.videoUrl) + '" target="_blank" rel="noopener">Abrir original ↗</a>' : '')
          + '</div>'
          + '<div class="vop-entity-grid">' + group.items.map(libCardHTML).join('') + '</div>'
          + '</div>';
      }).join('')
      + '</section>';
  }
  /* --- Tela Meus Projetos ----------------------------------------------------------- */
  function projectsHTML() {
    var projects = PROJECTS && PROJECTS.projects ? PROJECTS.projects : [];
    if (!projects.length) {
      return emptyHTML('Nenhum projeto ainda',
        'Cada vídeo do YouTube que você analisa vira um projeto com seus trechos sugeridos. Clique em "Novo projeto" ou use a tela YouTube para começar.',
        'tab', 'Novo projeto', 'data-act="tab" data-tab="youtube"');
    }
    return '<section class="vop-section">'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Meus Projetos</span>'
      + '<h2>' + projects.length + ' projeto(s)</h2>'
      + '<p class="vop-form-note">Clique em um projeto para ver os trechos sugeridos. A análise não roda de novo.</p></div></div>'
      + '<div class="vop-projects-grid">' + projects.map(projectCardHTML).join('') + '</div>'
      + '</section>';
  }
  function projectCardHTML(project) {
    var statusLabel = PROJECT_STATUS_LABEL[project.status] || project.status;
    var statusClass = project.status === PROJECT_STATUS.ready ? 'vop-status-ok'
      : project.status === PROJECT_STATUS.analyzing ? 'vop-status-warn' : 'vop-status-error';
    var thumb = project.thumbnail || '';
    var thumbFallback = project.videoId ? 'https://i.ytimg.com/vi/' + project.videoId + '/hqdefault.jpg' : '';
    var created = project.createdAt ? fmtDateTime(project.createdAt) : '—';
    var clipCount = project.clipCount || 0;
    var title = project.title || ('YouTube ' + project.videoId);
    return '<article class="vop-project-card" data-act="open-project" data-project-id="' + esc(project.id) + '" tabindex="0" role="button" aria-label="' + esc(title + ', ' + statusLabel + ', ' + clipCount + ' trechos') + '">'
      + '<div class="vop-project-thumb">'
      + (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(thumbFallback) + '\';">'
        : (thumbFallback ? '<img src="' + esc(thumbFallback) + '" alt="" loading="lazy">'
        : '<div class="vop-project-thumb-placeholder" aria-hidden="true">🎬</div>'))
      + '</div>'
      + '<div class="vop-project-info">'
      + '<h3 title="' + esc(title) + '">' + esc(title) + '</h3>'
      + '<div class="vop-project-meta">'
      + '<span class="' + esc(statusClass) + '">' + esc(statusLabel) + '</span>'
      + '<span>' + clipCount + ' trecho(s)</span>'
      + '<span>' + esc(created) + '</span>'
      + '</div>'
      + (project.error ? '<p class="vop-project-error">' + esc(project.error) + '</p>' : '')
      + '</div>'
      + '</article>';
  }
  function emptyHTML(title, message, actionType, actionLabel, actionAttrs) {
    return '<section class="vop-empty">'
      + '<div class="vop-empty-icon" aria-hidden="true">📁</div>'
      + '<h2>' + esc(title) + '</h2>'
      + '<p>' + esc(message) + '</p>'
      + (actionType && actionLabel ? '<div class="vop-card-actions">'
        + '<button class="vop-btn vop-btn-primary" type="button" ' + (actionAttrs || '') + '>' + esc(actionLabel) + '</button>'
        + '</div>' : '')
      + '</section>';
  }

/* --- Tela YouTube ---------------------------------------------------------------- */
  /* --- Hub de recomendações -----------------------------------------------------------
     Uma grade compacta de cards 16:9, e nada de controle de produção dentro dela: quem
     compara trechos precisa ver VÁRIOS ao mesmo tempo, e enquadramento, card de marca,
     legenda e render são decisões de UM trecho — vivem na tela de detalhe (`yt-open`).
     Antes desta entrega cada card ocupava uma linha inteira com os cinco controles, e
     comparar dois trechos exigia rolar a página. */

  /* Quadro do storyboard que representa o trecho. 35% dentro do corte de propósito: o
     começo costuma cair no ponto de troca de plano (quadro preto, transição) e o fim é a
     borda que o operador vai ajustar. `fps` do storyboard é quadros por segundo de VÍDEO
     (~0,1 = um quadro a cada 10 s), então o índice é `floor(t * fps)`.
     Não há cache por intervalo de propósito: a folha é a MESMA para todo o vídeo, o
     intervalo só muda o recorte. Mexer na borda não pede imagem nova — o cache HTTP do
     navegador já guarda a folha, e é por isso que a grade inteira custa poucas imagens. */
  function sbFrame(clip) {
    var sb = YT.storyboard;
    if (!sb || !sb.sheets || !sb.sheets.length || !(sb.fps > 0)) return null;
    var cols = Math.max(1, num(sb.columns));
    var rows = Math.max(1, num(sb.rows));
    var porFolha = cols * rows;
    var t = num(clip.inSec) + (num(clip.outSec) - num(clip.inSec)) * 0.35;
    var indice = Math.max(0, Math.floor(t * Number(sb.fps)));
    var folha = Math.floor(indice / porFolha);
    if (folha >= sb.sheets.length) folha = sb.sheets.length - 1;
    var dentro = indice - folha * porFolha;
    return {
      url: sb.sheets[folha],
      /* Largura/altura em % do contêiner e o deslocamento em % da PRÓPRIA imagem: com a
         folha em `cols*100%`, mover um quadro é andar `100/cols` por cento dela. */
      escala: [cols * 100, rows * 100],
      desloca: [-(dentro % cols) * (100 / cols), -Math.floor(dentro / cols) * (100 / rows)]
    };
  }
  /* A miniatura do card. Três estados, todos rotulados — miniatura muda é indistinguível
     de miniatura quebrada (BP-008): quadro do trecho, capa do vídeo, ou indisponível. */
  function ytThumbHTML(clip) {
    var frame = sbFrame(clip);
    var dur = Math.max(0, Math.round(num(clip.outSec) - num(clip.inSec)));
    var faixa = fmtClock(clip.inSec) + ' a ' + fmtClock(clip.outSec);
    var interno;
    if (frame) {
      interno = '<img class="yt-thumb-sheet" src="' + esc(frame.url) + '" alt=""'
        + ' loading="lazy" decoding="async"'
        + ' style="width:' + frame.escala[0] + '%;height:' + frame.escala[1] + '%;'
        + 'transform:translate(' + frame.desloca[0].toFixed(4) + '%,' + frame.desloca[1].toFixed(4) + '%)"'
        + ' onload="this.dataset.pronto=\'1\'"'
        + ' onerror="this.closest(\'.yt-thumb\').dataset.fallback=\'quebrou\'">';
    } else if (YT.thumbnail) {
      interno = '<img class="yt-thumb-capa" src="' + esc(YT.thumbnail) + '" alt=""'
        + ' loading="lazy" decoding="async" onload="this.dataset.pronto=\'1\'"'
        + ' onerror="this.closest(\'.yt-thumb\').dataset.fallback=\'quebrou\'">'
        + '<span class="yt-thumb-tag">Imagem do vídeo</span>';
    } else {
      interno = '<span class="yt-thumb-tag">Prévia indisponível</span>';
    }
    return '<button class="yt-thumb" type="button" data-act="yt-preview" data-id="' + esc(clip.id) + '"'
      + ' aria-label="Ver prévia de ' + esc(clip.topic) + ', de ' + esc(faixa) + '">'
      + interno
      + '<span class="yt-thumb-quebrou">Prévia indisponível</span>'
      + '<span class="yt-play" aria-hidden="true"></span>'
      + '<span class="yt-dur">' + esc(fmtClock(dur)) + '</span>'
      + '</button>';
  }
  /* O que se pode FAZER com este trecho. Um lugar só: o card mostra o resumo e a tela de
     detalhe mostra a frase inteira, e as duas leem daqui.

     Desde a importação do vídeo inteiro a PERGUNTA mudou. Antes era "o MP4 deste trecho está
     no disco?", e era isso que destravava o render; agora é "a FONTE está pronta?" — porque
     todo corte sai dela, e o arquivo do trecho, quando existe, é o RESULTADO de uma
     exportação anterior. Ele continua sendo descartado quando a borda muda
     (`clipBoundaryChanged`), e a fonte NÃO vai junto. */
  function clipStatusOf(clip, gate) {
    var exportado = !!(clip && (clip.clipToken || clip.clipFilename));
    var ocupado = !!YT_BUSY['fetch:' + (clip && clip.id)];
    var out = { chip: '', nota: '', pronto: false, podeBaixar: false,
                rotulo: 'Baixar trecho original', motivo: '' };
    if (exportado) {
      out.chip = chip('source-ready', 'Já exportado · ' + fmtBytes(clip.clipBytes));
    }
    if (SRC.state === 'ready') {
      out.pronto = true;
      out.podeBaixar = !ocupado;
      out.rotulo = ocupado ? 'Gerando…' : (exportado ? 'Gerar de novo' : 'Baixar trecho original');
    } else if (SRC.state === 'importing') {
      out.chip = chip('vop-status-warn', 'Importando o vídeo · ' + num(SRC.percent) + '%');
      out.rotulo = 'Importando o vídeo…';
      out.motivo = 'o vídeo ainda está sendo importado';
    } else if (SRC.state === 'error') {
      out.chip = chip('vop-status-error', 'Importação falhou');
      out.nota = SRC.error || IMPORT_MSG.error;
      out.motivo = 'a importação do vídeo falhou — importe de novo para cortar';
    } else {
      out.nota = 'Importe o vídeo inteiro para tocar, marcar e exportar este trecho.';
      out.motivo = 'o vídeo ainda não foi importado';
    }
    /* O portão de direitos é a condição EXTERNA e vence as outras na hora de explicar. Quando
       falta a declaração E o vídeo, os dois são verdade — mas declarar é o passo que libera
       importar, então é ele que a frase precisa nomear. Dizer "o vídeo não foi importado" a
       quem nem pode importar manda o operador para a ação errada (BP-008). */
    if (!(gate && gate.allowed)) {
      out.podeBaixar = false;
      out.motivo = (gate && gate.reason) || 'sem permissão';
    }
    return out;
  }
  /* Menu de download. Duas saídas com nomes diferentes porque são arquivos diferentes, e
     "Baixar" sozinho não diz qual: o trecho original é o recorte cru da fonte; o vídeo
     editado é o 9:16 que sai do Remotion com legenda e enquadramento. Editado sem trecho
     no disco fica DESABILITADO com o motivo à vista, nunca entregando o arquivo antigo. */
  function ytDownloadHTML(clip, status) {
    var aberto = YT.dlMenu === clip.id;
    var renderizando = !!YT_BUSY['render:' + clip.id];
    return '<div class="yt-dl' + (aberto ? ' open' : '') + '">'
      + '<button class="vop-btn vop-btn-quiet yt-dl-trigger" type="button" data-act="yt-dl-menu"'
      + ' data-id="' + esc(clip.id) + '" aria-expanded="' + aberto + '" aria-haspopup="true">'
      + 'Baixar<span class="yt-dl-caret" aria-hidden="true"></span></button>'
      + (aberto
        ? '<div class="yt-dl-menu" role="menu">'
          + '<button type="button" role="menuitem" data-act="yt-fetch" data-id="' + esc(clip.id) + '"'
          + (status.podeBaixar ? '' : ' disabled') + '>'
          + esc('Baixar trecho original')
          + '<small>' + esc(status.podeBaixar
            ? 'recorte cru do vídeo importado, sem edição — segundos'
            : ('bloqueado: ' + (status.motivo || 'sem permissão'))) + '</small></button>'
          + '<button type="button" role="menuitem" data-act="yt-render" data-id="' + esc(clip.id) + '"'
          + (status.podeBaixar && !renderizando ? '' : ' disabled') + '>'
          + esc(renderizando ? 'Renderizando…' : 'Baixar vídeo editado')
          /* O editado não depende mais de baixar o trecho antes: os dois saem do MESMO
             arquivo importado, e o único pré-requisito é a fonte estar pronta. */
          + '<small>' + esc(status.podeBaixar
            ? '9:16 com legenda e enquadramento — ' + renderEta(num(clip.outSec) - num(clip.inSec))
            : (status.motivo || 'importe o vídeo primeiro')) + '</small></button>'
          + '</div>'
        : '')
      + '</div>';
  }
  function ytCandidateCardHTML(clip, videoId, gate) {
    var status = clipStatusOf(clip, gate);
    /* A faixa de qualidade aparece só quando NÃO é a melhor: elogio em todo card é ruído,
       e a informação que muda decisão é a ressalva. A nota numérica saiu do card de
       propósito — número de 0 a 100 num card lê como probabilidade de sucesso, que este
       sistema não mede. Ela e a decomposição continuam na tela de detalhe. */
    var faixa = clip.quality && clip.quality !== 'forte'
      ? chip('yt-q-' + clip.quality, clip.qualityLabel) : '';
    return '<article class="yt-card" data-clip="' + esc(clip.id) + '">'
      + ytThumbHTML(clip)
      + '<div class="yt-card-body">'
      + '<h3 class="yt-card-title">' + esc(clip.topic) + '</h3>'
      + '<div class="yt-card-meta">'
      + '<span class="yt-range">' + esc(fmtClock(clip.inSec) + ' → ' + fmtClock(clip.outSec)) + '</span>'
      + faixa + status.chip + '</div>'
      + (clip.evidence ? '<p class="yt-card-why">' + esc(clip.evidence) + '</p>' : '')
      + (clip.contextWarning ? '<p class="yt-card-warn">' + esc(clip.contextWarning) + '</p>' : '')
      + (status.nota ? '<p class="yt-card-warn">' + esc(status.nota) + '</p>' : '')
      + '</div>'
      + '<div class="yt-card-acts">'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="yt-open" data-id="' + esc(clip.id) + '">Editar</button>'
      + ytDownloadHTML(clip, status)
      + '</div>'
      + '</article>';
  }
  /* --- Tela de detalhe (o editor do trecho) -------------------------------------------
     É para onde foram os controles que estavam na grade. Mesma sessão, mesmos objetos —
     `yt-back` volta para a grade com a rolagem no lugar. */
  function ytFactorsHTML(clip) {
    var fatores = Array.isArray(clip.factors) ? clip.factors : [];
    if (!fatores.length) return '';
    return '<details class="yt-factors"><summary>Como esta sugestão foi avaliada'
      + (num(clip.score) ? ' <span>' + num(clip.score) + '/100</span>' : '') + '</summary>'
      + '<p class="yt-factors-note">Nota interna, usada só para ordenar a lista. Não é '
      + 'previsão de desempenho — o Estúdio não mede audiência futura.</p>'
      + '<ul>' + fatores.map(function (f) {
        var pct = Math.round(Math.max(0, Math.min(1, Number(f.value) || 0)) * 100);
        return '<li><span class="yt-factor-name">' + esc(f.label) + '</span>'
          + '<span class="yt-factor-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
          + '<span class="yt-factor-val">' + pct + '% de ' + num(f.weight) + ' pts</span>'
          + '<small>' + esc(f.note) + '</small></li>';
      }).join('') + '</ul></details>';
  }
  /* Uma borda: campo digitável, os dois empurrões de 1 s e "daqui" — que lê o instante do
     player. É "daqui" que cumpre o pedido de escolher pontos FORA do intervalo recomendado
     sem digitar tempo: o operador arrasta a barra até onde quer e clica. */
  function ytEdgeHTML(clip, edge, rotulo, valor) {
    var id = esc(clip.id);
    var lado = edge === 'in' ? 'Começar' : 'Terminar';
    return '<div class="yt-trim-row">'
      + '<label>' + esc(rotulo) + '<input type="text" inputmode="numeric" data-trim="' + edge + '"'
      + ' data-id="' + id + '" value="' + esc(fmtClock(valor)) + '" size="7" spellcheck="false"></label>'
      + '<span class="yt-trim-nudge">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-nudge" data-id="' + id + '"'
      + ' data-edge="' + edge + '" data-delta="-1" aria-label="' + esc(lado) + ' um segundo antes">−1s</button>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-nudge" data-id="' + id + '"'
      + ' data-edge="' + edge + '" data-delta="1" aria-label="' + esc(lado) + ' um segundo depois">+1s</button>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-mark" data-id="' + id + '"'
      + ' data-edge="' + edge + '"' + (srcReady() ? '' : ' disabled')
      + ' aria-label="' + esc(lado) + ' no ponto em que o vídeo está">daqui</button>'
      + '</span></div>';
  }
  function ytTrimHTML(clip) {
    return '<fieldset class="yt-trim"><legend>Começo e fim</legend>'
      + '<p class="yt-trim-note">O Estúdio fecha o corte no fim da frase. Ajuste para onde '
      + 'quiser — inclusive fora do intervalo sugerido: “daqui” usa o ponto em que o player '
      + 'está. Mudar a borda descarta o vídeo que você já exportou DESTE trecho (ele era de '
      + 'outro intervalo); o vídeo importado não é tocado.</p>'
      + ytEdgeHTML(clip, 'in', 'Começa em', clip.inSec)
      + ytEdgeHTML(clip, 'out', 'Termina em', clip.outSec)
      + '<div class="yt-trim-row"><button class="vop-btn" type="button" data-act="yt-trim-apply" data-id="' + esc(clip.id) + '">Aplicar tempos digitados</button>'
      + '<small class="yt-trim-dur">' + esc(fmtClock(num(clip.outSec) - num(clip.inSec))) + ' de duração</small></div>'
      + '</fieldset>';
  }
  var BOUNDARY_MSG = {
    palavra: 'Bordas medidas no instante da palavra, pela legenda deste vídeo.',
    fala: 'Bordas na fala inteira: esta legenda não traz tempo por palavra, então o começo e o fim são estimados.',
    audiencia: 'Bordas vindas da região de audiência: este vídeo não entregou legenda, e nada foi conferido na fala.',
    manual: 'Bordas ajustadas por você — a conferência do detector não vale mais para este intervalo.'
  };
  function ytDetailHTML(clip, videoId, gate) {
    var status = clipStatusOf(clip, gate);
    /* A revisão da legenda é oferecida sempre que a FONTE está pronta, e não só quando as
       falas já estão na mão: elas são lidas na abertura do trecho (`srcCuesLoad`), e esconder
       o botão enquanto a chamada corre faria ele aparecer do nada meio segundo depois. O
       painel diz em que estado está — inclusive "este trecho não tem fala" (BP-008). */
    var temCues = srcReady() || ((clip.clipCues || []).length > 0);
    var capAberto = CAPS_OPEN === clip.id;
    var renderizando = !!YT_BUSY['render:' + clip.id];
    var estiloAtual = titleCardStyleOf(clip);
    var legendaAtual = legendaStyleOf(clip);
    return '<section class="yt-detail" data-clip="' + esc(clip.id) + '">'
      + '<div class="yt-detail-top">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-back">← Todas as sugestões</button>'
      + status.chip + '</div>'
      + '<div class="yt-detail-grid">'
      + '<div class="yt-detail-main">'
      /* O player NÃO mora aqui. Ele é o da FONTE, no painel logo acima desta tela: um
         arquivo, um player, e é nele que o trecho é conferido. Duplicá-lo aqui custaria um
         segundo decode do mesmo vídeo de 2 GB e faria os dois discordarem sobre onde o
         operador está olhando. O iframe do YouTube que ficava neste lugar saiu por decisão
         do usuário — o Estúdio toca a mídia que importou, não a página de terceiro. */
      + '<p class="yt-detail-onde">' + esc(srcReady()
        ? 'A prévia é o player acima, na duração inteira do vídeo. Abrir este trecho já '
          + 'posicionou o vídeo no começo dele.'
        : 'Importe o vídeo para conferir este trecho no player.') + '</p>'
      + '<input class="yt-detail-title" type="text" maxlength="180" value="' + esc(clip.topic) + '"'
      + ' data-clip-field="topic" data-id="' + esc(clip.id) + '" spellcheck="false"'
      + ' aria-label="Título do trecho — também é o card de 4s no vídeo e o nome do arquivo">'
      + '<p class="yt-detail-boundary">' + esc(BOUNDARY_MSG[clip.boundary] || BOUNDARY_MSG.fala) + '</p>'
      + (clip.hook ? '<blockquote class="yt-detail-hook">' + esc(clip.hook) + '</blockquote>' : '')
      + (clip.reason ? '<p class="yt-detail-reason">' + esc(clip.reason) + '</p>' : '')
      + ((clip.signals || []).length
        ? '<div class="vop-pill-row">' + clip.signals.map(function (s) { return chip('vop-chip-quiet', signalLabel(s)); }).join('') + '</div>'
        : '')
      + ytFactorsHTML(clip)
      + '</div>'
      + '<div class="yt-detail-side">'
      + ytTrimHTML(clip)
      + '<fieldset class="vop-cardstyle"><legend>Card visual</legend>'
      + TITLE_CARD_STYLES.map(function (estilo) {
        var id = 'cardstyle-' + clip.id + '-' + estilo;
        return '<input type="radio" id="' + esc(id) + '" name="cardstyle-' + esc(clip.id) + '"'
          + ' data-clip-field="titleCardStyle" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(estilo) + '"' + (estiloAtual === estilo ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(TITLE_CARD_LABELS[estilo]) + '</label>';
      }).join('') + '</fieldset>'
      /* Mesma classe do card de propósito: os dois são a MESMA pergunta ("que aparência
         este corte veste?") e merecem o mesmo componente, não um estilo novo no CSS. */
      + '<fieldset class="vop-cardstyle"><legend>Legenda</legend>'
      + LEGENDA_STYLES.map(function (estilo) {
        var id = 'legstyle-' + clip.id + '-' + estilo;
        return '<input type="radio" id="' + esc(id) + '" name="legstyle-' + esc(clip.id) + '"'
          + ' data-clip-field="legendaStyle" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(estilo) + '"' + (legendaAtual === estilo ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(LEGENDA_LABELS[estilo]) + '</label>';
      }).join('') + '</fieldset>'
      + legendaPanelHTML(clip)
      + reframeFieldHTML(clip, 'clip-field', 'reframe',
        sourceWarning(reframeOf(clip), clip.sourceWidth, clip.sourceHeight))
      + '<div class="yt-detail-acts">'
      + (temCues
        ? '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-cap" data-id="' + esc(clip.id) + '"'
          + ' aria-expanded="' + (capAberto ? 'true' : 'false') + '">'
          + (capAberto ? 'Fechar legenda' : 'Revisar legenda' + (capEdited(clip) ? ' — corrigida' : '')) + '</button>'
        : '')
      + '<button class="vop-btn" type="button" data-act="yt-fetch" data-id="' + esc(clip.id) + '"'
      + (status.podeBaixar ? '' : ' disabled') + '>' + esc(status.rotulo) + '</button>'
      /* O download rapido queima a legenda com FFmpeg/ASS, que nao expressa tudo o que a
         composicao do Remotion faz. Dizer AQUI, ao lado do botao que usa esse caminho, e o
         que impede o operador de comparar dois arquivos e achar que um deles quebrou
         (BP-008) -- e o botao ao lado, "Baixar video editado", nao tem essa limitacao. */
      + '<p class="vop-leg-ass">O download rápido queima a legenda com FFmpeg: ele veste '
      + 'fonte, corpo, caixa, cor, coluna, alinhamento e posição, mas <strong>não</strong> reproduz '
      + ASS_NAO_REPRODUZ.map(esc).join('; ') + '. O "Baixar vídeo editado" reproduz.</p>'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="yt-render" data-id="' + esc(clip.id) + '"'
      + (status.podeBaixar && !renderizando ? '' : ' disabled') + '>'
      + esc(renderizando ? 'Renderizando…' : 'Baixar vídeo editado') + '</button>'
      + (status.podeBaixar
        ? '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-render-limpo" data-id="' + esc(clip.id) + '"'
          + (renderizando ? ' disabled' : '') + '>Editado, sem legenda</button>'
        : '')
      + '</div>'
      + (status.nota ? '<p class="vop-warning">' + esc(status.nota) + '</p>' : '')
      + (!status.podeBaixar && status.motivo
        ? '<p class="vop-warning">Exportar está bloqueado: ' + esc(status.motivo) + '.</p>' : '')
      + '</div></div>'
      + (capAberto ? capPanelHTML(clip) : '')
      + '</section>';
  }
  /* --- O player da FONTE: um arquivo, um player, a tela inteira -------------------------
     Substitui o diálogo com iframe do YouTube que existia aqui. Não é "esconder o logo": o
     `<video>` toca o MP4 que o Estúdio importou, servido pelo `/sources/` do renderizador
     local com Range — por isso a barra arrasta para qualquer ponto da duração inteira, e não
     só para o que já baixou. Sem embed, sem miniatura de terceiro, sem sair do site.

     UM só, e no alto da tela: a grade usa para dar prévia do trecho (arrasta e toca), a tela
     de detalhe usa para conferir o que vai exportar, e "Marcar trecho daqui" usa o instante
     dele. Dois players do mesmo arquivo de 2 GB custariam dois decodes e discordariam sobre
     onde o operador está olhando. */
  function srcBarHTML(pct) {
    return '<div class="yt-imp-bar" data-src-bar role="progressbar" aria-valuemin="0"'
      + ' aria-valuemax="100" aria-valuenow="' + pct + '"'
      + ' aria-label="Progresso da importação do vídeo">'
      + '<i data-src-fill style="transform:scaleX(' + (pct / 100).toFixed(3) + ')"></i></div>';
  }
  /* A faixa de estado da importação. TODO estado tem frase, inclusive o que não age
     (BP-008): `idle` diz que nada foi importado, `importing` mostra etapa e porcentagem,
     `error` diz o motivo E oferece tentar de novo, `ready` confirma. */
  function srcStripHTML() {
    var estado = SRC.state;
    var abre = '<div class="yt-imp" data-src-strip data-state="' + esc(estado) + '">';
    if (estado === 'importing') {
      var pct = Math.max(0, Math.min(100, num(SRC.percent)));
      return abre
        + '<p class="yt-imp-line" data-src-line>' + esc(srcStageLabel()) + ' · ' + pct + '%</p>'
        + srcBarHTML(pct)
        + '<p class="yt-imp-note">O vídeo inteiro entra no Estúdio uma vez. Depois disso todo '
        + 'corte sai deste arquivo — nenhum trecho é baixado de novo.</p>'
        + '</div>';
    }
    if (estado === 'error') {
      return abre
        + '<p class="yt-imp-line" data-src-line>' + esc(SRC.error || IMPORT_MSG.error) + '</p>'
        + '<button class="vop-btn" type="button" data-act="yt-import">Tentar importar de novo</button>'
        + '</div>';
    }
    if (estado === 'ready') {
      return abre + '<p class="yt-imp-line" data-src-line>' + esc(IMPORT_MSG.ready) + '</p></div>';
    }
    return abre + '<p class="yt-imp-line" data-src-line>'
      + esc(SRC.error || IMPORT_MSG.idle) + '</p></div>';
  }
  function srcPanelHTML() {
    if (!srcReady()) return srcStripHTML();
    /* A máscara mostra quanto o enquadramento escolhido descarta, e ela segue o trecho
       ABERTO — na grade não há recorte escolhido, então não há o que mascarar. */
    var aberto = YT.detail ? findById(YT.candidates, YT.detail) : null;
    var corte = aberto ? cropInsetPct(reframeOf(aberto)) : 0;
    var aviso = sourceWarning(aberto ? reframeOf(aberto) : REFRAME_PADRAO, SRC.width, SRC.height);
    return '<section class="yt-src" data-src-panel>'
      + '<div class="yt-src-stage">'
      /* `preload="metadata"`: a duração e o índice entram na hora, os bytes só quando o
         operador der play ou arrastar. Num arquivo de 2 GB, `auto` começaria a baixar tudo
         de novo — depois de o vídeo já estar no disco desta máquina. */
      + '<video class="yt-src-video" data-src-video src="' + esc(SRC.url) + '" controls'
      + ' preload="metadata" playsinline></video>'
      + (corte ? '<div class="vop-cand-mask" style="--corte:' + corte + '%" aria-hidden="true"></div>' : '')
      + (aberto ? legendaPreviewHTML(aberto) : '')
      + '</div>'
      + (aberto ? '<p class="vop-leg-prev-nota">A caixa sobre o player é uma <strong>aproximação</strong> '
        + 'da tipografia (fonte, corpo, caixa, cor, coluna e alinhamento). O quadro de verdade sai '
        + 'do botão <em>Ver o quadro real</em>, no painel da legenda.</p>' : '')
      + '<div class="yt-src-meta">'
      + '<p class="yt-src-id"><strong>' + esc(SRC.name) + '</strong> · '
      + esc(fmtClock(SRC.durationSec)) + ' · ' + esc(fmtBytes(SRC.bytes))
      + (SRC.width ? ' · ' + num(SRC.width) + '×' + num(SRC.height) : '')
      + (SRC.hasAudio ? '' : ' · <em>sem faixa de áudio</em>') + '</p>'
      + '<button class="vop-btn" type="button" data-act="yt-manual">Marcar trecho daqui</button>'
      + '</div>'
      + (aviso ? '<p class="vop-warning">' + esc(aviso) + '</p>' : '')
      + srcStripHTML()
      + '</section>';
  }
  /* Ordem da lista. Duas, e só duas: qualidade da recomendação (o padrão) e ordem do
     vídeo, que é como quem já conhece o episódio procura. */
  var YT_SORTS = [['quality', 'Melhores primeiro'], ['time', 'Ordem do vídeo']];
  function ytSorted() {
    var lista = YT.candidates.slice();
    if (YT.sort === 'time') {
      lista.sort(function (a, b) { return num(a.inSec) - num(b.inSec); });
    } else {
      /* O servidor já manda ordenado por nota; reordenar aqui com o MESMO desempate
         mantém a lista estável quando o operador volta da tela de detalhe. */
      lista.sort(function (a, b) {
        return (num(b.score) - num(a.score)) || (num(a.inSec) - num(b.inSec));
      });
    }
    return lista;
  }
  function ytStepHTML() {
    var videoId = ytVideoId(YT.url);
    var gate = ytFetchGate(YT);
    var probing = !!YT_BUSY['probe:url'];
    var emEdicao = YT.detail ? findById(YT.candidates, YT.detail) : null;
    var lista = ytSorted();
    var importando = SRC.state === 'importing';
    return '<section class="vop-section yt-hub" data-yt>'
      + '<div class="vop-section-head"><div><span class="vop-eyebrow">Corte por URL</span>'
      + '<h2>Importe o vídeo e escolha os trechos</h2>'
      + '<p class="vop-form-note">O vídeo <strong>inteiro</strong> entra no Estúdio uma vez e '
      + 'toca aqui dentro. Todo corte é gerado desse mesmo arquivo — você pode exportar '
      + 'quantos quiser sem baixar o original de novo.</p></div></div>'
      /* Campo de URL e ação principal na mesma linha: é UMA decisão. O rótulo diz o que o
         botão FAZ — "Analisar" descrevia o passo antigo, em que a análise era tudo o que
         acontecia e a mídia vinha depois, trecho por trecho. */
      + '<div class="yt-intake">'
      + '<label class="yt-intake-field"><span>URL do vídeo</span>'
      + '<input type="url" value="' + esc(YT.url) + '" placeholder="https://www.youtube.com/watch?v=…"'
      + ' autocomplete="off" spellcheck="false" data-yt-url></label>'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="yt-import"'
      + (importando ? ' disabled aria-busy="true"' : '') + '>'
      + (importando ? 'Importando…' : 'Importar vídeo') + '</button>'
      + '</div>'
      /* O portão de direitos em pessoa. Analisar é livre; baixar mídia exige esta
         declaração — e o botão de baixar fica desabilitado com o motivo à vista até ela
         existir. Não sai daqui e não é afrouxado por causa da tela nova. */
      + '<label class="vop-yt-rights"><input type="checkbox" data-yt-rights'
      + (YT.authorized ? ' checked' : '') + '>'
      + '<span><strong>Declaro que tenho autorização do criador para publicar cortes deste vídeo.</strong>'
      + ' Baixar mídia de terceiro sem autorização é violação de direito autoral; esta declaração vale para esta sessão e para esta URL.</span></label>'
      /* Resumo da fonte: pequeno, uma linha, não domina a página. O link "Abrir no YouTube"
         saiu por decisão do usuário — a edição acontece dentro do site, e um atalho para
         fora dele no meio do editor é exatamente o que o pedido manda tirar. */
      + (videoId && YT.state === 'ready'
        ? '<div class="yt-source">'
          + (YT.thumbnail ? '<img src="' + esc(YT.thumbnail) + '" alt="" loading="lazy" decoding="async"'
            + ' onerror="this.style.display=\'none\'">' : '')
          + '<div><strong>' + esc(YT.title || ('YouTube ' + videoId)) + '</strong>'
          + '<span>' + (YT.duration ? esc(fmtClock(YT.duration)) : '') + '</span></div>'
          + '</div>'
        : '')
      /* O player da fonte fica ACIMA da grade e da tela de detalhe, e é o mesmo nos dois. */
      + srcPanelHTML()
      + (YT.note ? '<p class="yt-analysis-note">' + esc(YT.note) + '</p>' : '')
      + (emEdicao ? ytDetailHTML(emEdicao, videoId, gate)
        : (lista.length
          ? '<div class="yt-results-head">'
            + '<h3>' + lista.length + ' ' + (lista.length === 1 ? 'sugestão' : 'sugestões') + '</h3>'
            + '<div class="yt-results-tools">'
            + '<label class="yt-sort"><span>Ordem</span><select data-yt-sort>'
            + YT_SORTS.map(function (s) {
              return '<option value="' + s[0] + '"' + (YT.sort === s[0] ? ' selected' : '') + '>' + esc(s[1]) + '</option>';
            }).join('') + '</select></label>'
            + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-clear">Limpar</button>'
            + '</div></div>'
            + '<div class="yt-grid">' + lista.map(function (clip) {
              return ytCandidateCardHTML(clip, videoId, gate);
            }).join('') + '</div>'
          : (probing
            ? '<div class="yt-grid yt-grid-skeleton" aria-hidden="true">'
              + '<div class="yt-skel"></div><div class="yt-skel"></div><div class="yt-skel"></div></div>'
            : (YT.state === 'ready'
              ? '<div class="yt-empty"><h3>Nenhum trecho passou nos critérios</h3>'
                + '<p>Este vídeo não rendeu trecho que comece numa frase inteira e feche a ideia. '
                + 'Tente analisar outro vídeo.</p></div>'
              : ''))))
      + '<small class="vop-mark-note">O vídeo editado vai para a Central, com o endereço do arquivo no seu computador.</small>'
      + '</section>';
  }
  /* Rolagem da grade, guardada ao entrar no editor. Mora no MODULO e nao no estado
     persistido: e posicao de tela, some com o recarregamento, e nao pertence ao projeto. */
  var YT_GRID_SCROLL = 0;
  /* Aplica o trim e FALA o que aconteceu — nenhum ramo termina calado (BP-008): aplicou,
     recusou com o motivo, ou nao mudou nada. */
  function ytTrimResult(clip, inSec, outSec) {
    var tinhaArquivo = !!(clip.clipToken || clip.clipFilename);
    var jaAberto = YT.detail === clip.id;
    var antes = clip.inSec + '-' + clip.outSec;
    var erro = ytApplyTrim(clip, inSec, outSec, YT.duration);
    if (erro) { toast(erro, 'error'); return; }
    if (antes === clip.inSec + '-' + clip.outSec) { toast('Os tempos já eram esses.'); return; }
    renderKeepingScroll();
    /* A legenda do trecho estava rebaseada no começo ANTIGO e foi descartada junto com a
       borda; ler as falas do novo intervalo é o que mantém o painel e o render sincronizados
       com o que o operador acabou de escolher. Só do trecho ABERTO: recarregar a legenda de
       um trecho que ele nem está vendo é chamada de rede sem motivo. */
    if (jaAberto && srcReady()) srcCuesLoad(clip);
    toast('Trecho agora é ' + fmtClock(clip.inSec) + ' → ' + fmtClock(clip.outSec) + '.'
      + (tinhaArquivo
        ? ' O vídeo que você já exportou deste trecho foi descartado (era de outro intervalo)'
          + ' — exporte de novo. O vídeo importado continua no Estúdio.'
        : ''));
  }
  /* Mudar a borda muda o ARQUIVO: o MP4 já baixado é de outro intervalo, a legenda do
     clipe está rebaseada no começo antigo e a miniatura mostra outro quadro. Tudo isso é
     descartado junto, e a `rev` sobe — a identidade do trecho (`id`) NÃO muda, então
     projeto salvo continua abrindo e o operador não perde o histórico. */
  function clipBoundaryChanged(clip) {
    clip.rev = num(clip.rev) + 1;
    clip.clipToken = '';
    clip.clipFilename = '';
    clip.clipBytes = 0;
    clip.clipCues = [];
    /* `clipStatus`/`clipAvailable` eram do `validateProjectClips`, que saiu. Continuam sendo
       ZERADOS aqui, e não removidos: projeto salvo antes de 2026-09-15 tem as duas chaves, e
       deixar um `available` velho num trecho de outro intervalo seria mentira persistida. */
    clip.clipStatus = 'none';
    clip.clipAvailable = false;
    /* A FONTE não é tocada — e isto é o pedido em pessoa: "mudar um corte pode invalidar a
       versão exportada dele, mas não pode invalidar nem remover o vídeo importado". */
    capDrop(clip.id);
    projectsPersist();
  }
  /* Aplica um novo par de tempos. Devolve a frase do erro, ou '' quando aplicou. Exportada
     e chamada pelo teste com o trecho construído (BP-014): é ela que invalida mídia
     baixada, e o ramo que interessa é o do operador que JÁ tinha baixado. */
  /* O intervalo e SEMPRE em segundo inteiro, e nao por preguica: o nome do arquivo baixado
     e `<id>-<inicio>-<fim>.mp4` com inteiros, o `/api/yt-fetch` recebe `num(inSec)` (que
     arredonda), o `?start=` do player e inteiro e o `/api/clip-status` acha o arquivo pelo
     mesmo par. Um passo de meio segundo era um botao que nao fazia NADA -- `num()`
     arredondava de volta e o `ytTrimResult` avisava "os tempos ja eram esses". Um numero,
     um dono: quem resolve o intervalo e o `ytclip.candidates`, e ele ja entrega inteiro. */
  function ytApplyTrim(clip, inSec, outSec, duracaoVideo) {
    var inicio = Math.max(0, num(inSec));
    var fim = num(outSec);
    var teto = num(duracaoVideo);
    if (!(fim > inicio)) return 'O fim precisa vir depois do começo.';
    if (fim - inicio < 3) return 'O trecho ficaria com menos de 3 segundos.';
    if (teto && fim > teto) return 'O fim passa da duração do vídeo (' + fmtClock(teto) + ').';
    if (inicio === num(clip.inSec) && fim === num(clip.outSec)) return '';
    clip.inSec = inicio;
    clip.outSec = fim;
    clip.durationSec = Math.round((fim - inicio) * 100) / 100;
    /* A borda mudou por mão humana: a evidência de fecho do detector não vale mais para
       este intervalo, e dizer que vale seria afirmar conferência que não houve. */
    clip.boundary = 'manual';
    clipBoundaryChanged(clip);
    return '';
  }

  /* --- FFmpeg local ---------------------------------------------------------------- */
  /* As QUATRO chaves de REFRAMES passam; qualquer outra coisa cai em `horizontal`. Antes
     desta entrega so `blur` e `crop` passavam, e um `crop11` escolhido na tela sairia com o
     nome e o filtro do horizontal -- calado. */
  function commandProfile(value) {
    return REFRAMES.indexOf(value) >= 0 ? value : 'horizontal';
  }
  /* Literal PowerShell: aspas simples não interpolam $(), variáveis nem crases; um
     apóstrofo literal vira dois. O nome do arquivo vem do computador do operador. */
  function psQuote(value) { return "'" + String(value == null ? '' : value).replace(/'/g, "''") + "'"; }
  function ffmpegCutCommand(fileName, inSec, outSec, outName, profile) {
    var start = num(inSec);
    var stop = num(outSec);
    if (!cleanText(fileName) || stop <= start) return '';
    var selected = commandProfile(profile);
    /* O 9:16 e o arquivo que vai ao ar, e e ele que o `video_encoder_args` do worker
       encoda a `-preset slow -crf 18` desde esta entrega (era `veryfast -crf 20`, que
       sacrifica bastante qualidade por bit) mais as tags de cor. O `horizontal` espelha o
       `serve.horizontal_args`, que o pedido manda NAO tocar -- entao ele fica como estava.
       Sem esta distincao o comando de emergencia mentiria num dos dois. */
    var noAr = selected !== 'horizontal';
    return '$v = ' + psQuote('..\\' + fileName) + '; & ' + psQuote(FFMPEG_REL)
      + ' -ss ' + start + ' -to ' + stop + ' -i $v'
      + ' -vf "' + FFMPEG_FILTERS[selected] + (noAr ? ',' + COR_TAGS : '') + '"'
      + ' -c:v libx264 -preset ' + (noAr ? 'slow -crf 18' : 'veryfast -crf 20')
      + ' -pix_fmt yuv420p'
      + ' -c:a aac -b:a 128k -movflags +faststart ' + psQuote(outName);
  }
  function cutFileName(base, inSec, outSec, profile) {
    var selected = commandProfile(profile);
    var name = safeName(String(base || 'corte').replace(/\.[^.]+$/, '')
      + '-' + num(inSec) + 's-' + num(outSec) + 's', 80);
    /* O formato entra no nome nos DOIS casos: na pasta de Downloads é o que diz, de
       relance, qual arquivo vai para TikTok/Instagram (9x16) e qual não. */
    return name + (selected === 'horizontal' ? '-16x9' : '-9x16-' + selected) + '.mp4';
  }
  /* O vídeo da sessão não tem cadastro, mas o helper local acha o arquivo pela chave de
     upload. Chave reservada e registrada na hora do download, então não depende da ordem
     de carregamento. */
  var INTAKE_SOURCE_ID = 'intake-session';
  function intakeResolved(inSec, outSec, base) {
    if (!INTAKE.file) return null;
    if (SESSION_FILE_OBJECTS[INTAKE_SOURCE_ID] !== INTAKE.file) {
      SESSION_FILE_OBJECTS[INTAKE_SOURCE_ID] = INTAKE.file;
      /* Trocar o vídeo invalida o cache de upload: o token subiria o arquivo errado. */
      delete SESSION_RENDER[INTAKE_SOURCE_ID];
    }
    return {
      source: { id: INTAKE_SOURCE_ID },
      clip: { inSec: num(inSec), outSec: num(outSec), topic: base || INTAKE.name }
    };
  }
  function renderSession(sourceId) {
    var file = SESSION_FILE_OBJECTS[sourceId];
    if (!file) return null;
    var current = SESSION_RENDER[sourceId];
    if (!current || current.file !== file) {
      current = { file: file, token: uid('render'), uploaded: false };
      SESSION_RENDER[sourceId] = current;
    }
    return current;
  }
  /* O helper local guarda cada MP4 que entrega numa pasta fixa e devolve o caminho no
     cabeçalho. É esse caminho que faz o clip sobreviver ao fechamento do site. */
  function savedPathOf(response) {
    var header = response && response.headers && response.headers.get('X-Clip-Path');
    if (!header) return '';
    var caminho;
    try { caminho = decodeURIComponent(header); } catch (e) { caminho = header; }
    return cleanText(caminho, 600);
  }
  function captionsStateOf(response) {
    var header = response && response.headers && response.headers.get('X-Clip-Captions');
    return cleanText(header, 40);
  }
  function audioStateOf(response) {
    var header = response && response.headers && response.headers.get('X-Clip-Audio');
    return cleanText(header, 40);
  }
  function backgroundStateOf(response) {
    var header = response && response.headers && response.headers.get('X-Clip-Background');
    return cleanText(header, 40);
  }
  /* Os TRES desfechos do fundo do 9:16, em uma frase cada. O cabecalho e CONDICIONAL, como o
     X-Clip-Captions: ausente = perfil horizontal, que nao tem tarja nem fundo, e ai nao ha o
     que dizer em vez de inventar.
     O caso normal entra com frase VAZIA de proposito -- o fundo saiu como devia e o toast nao
     precisa de mais uma linha. A chave existe porque um check do test_serve.py LE este arquivo
     e reprova estado do conjunto fechado sem entrada aqui.
     Os DOIS casos de letterbox precisam dizer o que aconteceu E o que fazer: eles produzem o
     MESMO pixel, e ate esta entrega o motivo ia so ao console do servidor (BP-008). */
  var BACKGROUND_MSG = {
    miniatura: '',
    BACKGROUND_NONE: 'Este trecho não trouxe miniatura, então o fundo saiu chapado — '
      + 'normal em MP4 local e em trecho baixado antes desta versão.',
    BACKGROUND_UNREADABLE: 'A miniatura deste trecho chegou quebrada e o fundo saiu chapado; '
      + 'baixar o trecho de novo resolve.'
  };
  function backgroundMessage(state) { return BACKGROUND_MSG[state] || ''; }
  /* Os TRES desfechos do passe de -14 LUFS, em uma frase cada. Diferente do CAPTIONS_MSG,
     este cabecalho vem SEMPRE nas duas rotas: o passe roda no `_send_video`, que e o choke
     point das duas, entao ausencia significa versao antiga do helper -- e ai nao ha o que
     dizer, em vez de inventar um estado.
     Um check do test_serve.py LE este arquivo e reprova estado do conjunto fechado sem
     frase aqui: estado que sai no cabecalho e nao tem frase do outro lado e o erro mudo que
     o conjunto existe para impedir. */
  var AUDIO_MSG = {
    normalizado: 'O áudio saiu a -14 LUFS, o volume do feed.',
    AUDIO_SEM_FAIXA: 'Este corte não tem áudio, então não havia volume a ajustar.',
    AUDIO_NORM_FAILED: 'O ajuste de volume falhou e o vídeo saiu com o áudio original — '
      + 'ele tende a ficar mais baixo que o resto do feed.'
  };
  function audioMessage(state) { return AUDIO_MSG[state] || ''; }
  /* Os quatro desfechos possíveis do 9:16, em uma frase cada. Cabeçalho ausente = a rota
     nem chegou a olhar legenda (perfil horizontal), e aí não há o que dizer. */
  var CAPTIONS_MSG = {
    burned: 'A legenda entrou no vídeo.',
    /* O libass troca fonte ausente por Arial sem avisar — medido. Dizer isso é o que separa
       "saiu em Inter Bold" de "saiu em Arial e ninguém viu" (BP-008). */
    'burned-sem-inter': 'A legenda entrou, mas a fonte Inter não está instalada nesta '
      + 'máquina e o vídeo saiu em Arial. Instale a Inter para a tipografia do projeto.',
    CAPTIONS_NOT_AVAILABLE: 'Sem legenda: o YouTube não deu legenda em português para este vídeo.',
    CAPTIONS_EXTRACTION_FAILED: 'Sem legenda: a extração da legenda falhou no download.',
    CAPTIONS_OUT_OF_RANGE: 'Sem legenda: nenhuma fala da transcrição cai dentro deste trecho.',
    /* Chega aqui quando o operador apagou o texto de todas as falas na revisão: o clip sai
       sem legenda porque foi isso que ele pediu — não porque algo falhou. */
    CAPTIONS_EDITED_EMPTY: 'Sem legenda: você apagou o texto de todas as falas deste trecho.'
  };
  function captionsMessage(state) {
    return CAPTIONS_MSG[state] || '';
  }
  function renderError(response) {
    if (!response || typeof response.json !== 'function') return Promise.resolve('O renderizador local não respondeu.');
    return response.json().then(function (payload) {
      return cleanText(payload && payload.error, 500) || 'O renderizador local recusou o vídeo.';
    }).catch(function () { return 'O renderizador local não está ativo neste endereço.'; });
  }
  /* fetch REJEITA quando o helper não está no ar. Sem separar esse caso do erro de
     negócio, o operador lê "falhou" e não descobre que basta subir o serviço. */
  function ytPost(route, body) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('Este navegador não consegue falar com o renderizador local.'));
    return fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).catch(function () {
      throw new Error('O renderizador não está ativo — rode estudio.ps1.');
    }).then(function (response) {
      if (!response.ok) return renderError(response).then(function (message) { throw new Error(message); });
      return response.json().catch(function () { throw new Error('O renderizador devolveu uma resposta ilegível.'); });
    });
  }
  /* O estado "ocupado" mora no módulo, não no botão: render() recria o botão e um
     disabled posto só no elemento voltaria habilitado no meio da chamada. */
  function ytBusy(key, on, button, label) {
    if (on) YT_BUSY[key] = true; else delete YT_BUSY[key];
    if (!button) return;
    button.disabled = !!on;
    if (on) {
      button.setAttribute('aria-busy', 'true');
      button.textContent = label;
    }
  }
  /* Abre um projeto existente: mostra os trechos sugeridos sem re-analisar. */
  function openProject(projectId) {
    var project = projectFindById(projectId);
    if (!project) { toast('Projeto não encontrado.', 'error'); return; }
    if (project.status === PROJECT_STATUS.analyzing) {
      toast('Este projeto ainda está sendo analisado.', 'warn');
      return;
    }
    if (project.status === PROJECT_STATUS.error) {
      toast('Este projeto teve erro na análise: ' + project.error, 'error');
      return;
    }
    /* Carrega os candidatos do projeto para a sessão YT. A folha de storyboard fica se o
       vídeo for o MESMO desta sessão: ela veio do probe de agora e as URLs ainda valem.
       Vídeo diferente (ou sessão nova, depois de recarregar) cai na capa rotulada. */
    var mesmoVideo = YT.videoId === project.videoId;
    YT.videoId = project.videoId;
    YT.title = project.title;
    YT.duration = project.durationSec;
    YT.candidates = project.candidates || [];
    YT.url = project.url;
    YT.state = 'ready';
    YT.note = project.note || '';
    YT.detail = '';
    YT.dlMenu = '';
    YT.thumbnail = safeUrl(project.thumbnail) || (project.videoId
      ? 'https://i.ytimg.com/vi/' + project.videoId + '/hqdefault.jpg' : '');
    /* A folha NAO e persistida: a URL dela e assinada e expira. Projeto de OUTRO video, ou
       sessao nova depois de recarregar, cai na capa do video rotulada como capa -- que e o
       fallback honesto, e nao uma imagem quebrada nem uma capa fingindo ser quadro do
       trecho. Apagar tambem no mesmo video era o defeito: o probe acabava de montar a folha
       e ela morria no clique seguinte, entao a miniatura DO TRECHO nunca aparecia. */
    if (!mesmoVideo) YT.storyboard = null;
    /* Projeto de OUTRO vídeo não herda a fonte deste: o player estaria tocando o arquivo
       errado sob os trechos novos. Mesmo vídeo mantém a fonte já religada. */
    if (!mesmoVideo) srcReset();
    /* A declaração é por sessão e por URL. Por isso a fonte NÃO é religada aqui: religar
       traria a mídia de terceiro de volta à tela sem declaração nenhuma. Quem religa é o
       próprio portão, no `onRootChange` — marcar a caixa restaura do disco na hora, sem
       rede, porque o arquivo já está lá. */
    YT.authorized = false;
    TAB = 'youtube';
    render();
  }

  /* `validateProjectClips` e `persistProjectClipFilename` SAIRAM (2026-09-15). Elas
     existiam para responder "o MP4 deste trecho ainda esta no disco?" -- era isso que
     destravava o botao de render, e por isso o projeto reaberto disparava uma chamada ao
     /api/clip-status POR TRECHO. Com o video inteiro importado a pergunta e outra e vale
     para todos: "a FONTE esta pronta?". Quem responde e o `srcRestore`, com UMA chamada.
     A rota /api/clip-status fica no servidor (ela tem teste proprio e nao custa nada
     parada); o que saiu foi o chamador. */
  function ytFail(key, error) {
    ytBusy(key, false);
    renderKeepingScroll();
    toast(error && error.message ? error.message : 'A chamada ao renderizador falhou.', 'error');
  }
  /* Analisa: metadados, capítulos, legenda e heatmap. NÃO baixa mídia — por isso não
     passa pelo portão de direitos. */
  function ytProbe(button) {
    var url = safeUrl(YT.url);
    var videoId = ytVideoId(url);
    if (!videoId) { toast('Cole o link de um vídeo do YouTube.', 'error'); return; }
    var key = 'probe:url';
    if (YT_BUSY[key]) return;
    /* Cria ou reserva projeto para este vídeo. */
    var project = projectCreateOrReserve(videoId, url, '', '', 0);
    /* Vídeo já analisado: reaproveita as sugestões salvas em vez de gastar outra análise.
       NÃO troca de aba e NÃO derruba a declaração de direitos — antes isto mandava o
       operador para "Meus projetos" (um clique entre ele e o resultado) e, pior, o caminho
       de lá zera a declaração que ele acabou de dar para importar. O fluxo pedido é colar,
       importar e ver os trechos na MESMA tela. */
    if (project.status === PROJECT_STATUS.ready && (project.candidates || []).length) {
      YT.videoId = videoId;
      YT.title = project.title;
      YT.duration = num(project.durationSec) || YT.duration;
      YT.candidates = project.candidates;
      YT.note = project.note || '';
      YT.state = 'ready';
      YT.detail = '';
      YT.dlMenu = '';
      YT.thumbnail = safeUrl(project.thumbnail) || YT.thumbnail;
      ytBusy(key, false);
      renderKeepingScroll();
      toast(project.candidates.length + ' trecho(s) deste vídeo já estavam analisados.');
      return;
    }
    ytBusy(key, true, button, 'Analisando…');
    ytPost('/api/yt-probe', { url: url }).then(function (payload) {
      var fresh = ytCandidateClips(payload);
      var title = cleanText(payload && payload.title, 200);
      /* `durationSec`, nao `duration`: a rota /api/yt-probe sempre mandou `durationSec`, e
         ler a chave errada deixava YT.duration em 0 -- o tempo do video nunca aparecia no
         cabecalho da fonte e o projeto salvava duracao zero. */
      var duration = num(payload && payload.durationSec);
      var note = cleanText(payload && payload.note, 400);
      /* Thumbnail: usa a melhor do payload ou fallback do YouTube. */
      /* A capa vem escolhida do servidor (a maior publicada). O endereco estavel do
         YouTube fica como rede: `hqdefault` existe para todo video. */
      var thumbnail = safeUrl(payload && payload.thumbnail);
      if (!thumbnail && videoId) {
        thumbnail = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
      }
      YT.thumbnail = thumbnail;
      YT.storyboard = ytStoryboardFrom(payload);
      YT.videoId = videoId;
      YT.title = title;
      YT.duration = duration;
      YT.note = note;
      YT.candidates = fresh;
      YT.state = 'ready';
      /* Atualiza projeto com os resultados. */
      projectSetCandidates(project.id, fresh, title, thumbnail, duration, note);
      ytBusy(key, false);
      /* FICA na aba do hub: o fluxo pedido e "cola a URL -> analisa -> compara os trechos",
         e mandar para a lista de projetos punha um clique entre a analise e o resultado
         que ela acabou de produzir. O projeto continua salvo -- e a aba "Meus projetos"
         continua sendo por onde se volta a ele depois de recarregar a pagina. */
      TAB = 'youtube';
      YT.detail = '';
      YT.dlMenu = '';
      render();
      toast(fresh.length
        ? fresh.length + ' trecho(s) sugerido(s). Nada foi baixado — a escolha é sua.'
        : 'A análise terminou sem trecho com sinal suficiente.');
    }).catch(function (error) {
      projectSetError(project.id, error && error.message ? error.message : 'Falha na análise');
      ytFail(key, error);
    });
  }
  /* Duração de partida de um trecho marcado à mão: o alvo do detector
     (`ytclip.TARGET_CLIP_SEC`). Não é teto — as bordas são ajustáveis depois, como em
     qualquer sugestão. Caiu de 45 para 35 em 2026-09-16, junto com o alvo do motor: o
     trecho manual nascer maior que toda sugestão da lista é a tela contradizendo o
     detector, e quem marca à mão é a mesma pessoa que acabou de ver a lista. */
  var MANUAL_SEC = 35;
  /* `unshift` e NÃO um array novo: o `YT.candidates` É o array do projeto salvo (o
     `openProject` o pega por referência), e trocá-lo por outro desligaria os dois — o trecho
     novo apareceria na tela e nunca no disco. */
  function ytAddCandidate(clip) {
    YT.candidates.unshift(clip);
    projectsPersist();
  }
  /* Um trecho marcado À MÃO, a partir de onde o player está. É o que cumpre "navegar pela
     duração inteira e definir um corte manualmente": nenhuma sugestão precisa existir, e o
     ponto pode estar em qualquer lugar do vídeo. */
  function ytManualClip() {
    if (!srcReady()) { toast('Importe o vídeo antes de marcar um trecho.', 'error'); return; }
    var agora = srcNow();
    if (agora === null) { toast('O player do vídeo não está na tela.', 'error'); return; }
    var inicio = Math.floor(agora);
    var teto = num(SRC.durationSec) || num(YT.duration);
    var fim = teto ? Math.min(teto, inicio + MANUAL_SEC) : inicio + MANUAL_SEC;
    if (!(fim - inicio >= 3)) {
      toast('Faltam menos de 3 segundos até o fim do vídeo — arraste para trás e marque de novo.', 'error');
      return;
    }
    var clip = {
      id: uid('cand'), name: 'Trecho de ' + fmtClock(inicio),
      topic: 'Trecho de ' + fmtClock(inicio),
      inSec: inicio, outSec: fim, hook: '', reason: '',
      score: 0, contextWarning: '', category: '',
      quality: '', qualityLabel: '', factors: [],
      evidence: 'Marcado por você no player, em ' + fmtClock(inicio) + '.',
      /* `manual` de propósito: a conferência do detector não vale para esta borda, e dizer
         que vale seria afirmar uma checagem que não houve. */
      boundary: 'manual', rev: 1, signals: [],
      durationSec: fim - inicio,
      clipToken: '', clipFilename: '', clipBytes: 0, clipCues: []
    };
    ytAddCandidate(clip);
    YT.detail = clip.id;
    YT.dlMenu = '';
    render();
    srcSeek(inicio, false);
    srcCuesLoad(clip);
    toast('Trecho criado em ' + fmtClock(inicio) + ' → ' + fmtClock(fim)
      + '. Ajuste as bordas e exporte — sai do vídeo que já está importado.');
  }
  /* As falas DESTE intervalo, recortadas do sidecar da fonte pelo servidor.

     Substitui o que vinha dentro do `/api/yt-fetch`: a legenda viajava junto do download de
     UM trecho, e sem aquele download não havia legenda. Agora a fonte é o vídeo inteiro, a
     transcrição dele está no sidecar, e o recorte é pedido na hora — uma chamada por trecho
     aberto, e o navegador nunca guarda a transcrição inteira de um podcast de 3 h. */
  function srcCuesLoad(clip) {
    /* Devolve promessa para o export poder ESPERAR: quem exporta direto da grade nunca abriu
       o editor, então as falas ainda não foram lidas, e descobrir isso no fim de um render de
       minutos é o pior desfecho possível. */
    if (!srcReady() || !clip) return Promise.resolve(null);
    var pedido = num(clip.rev);
    CAPS[clip.id] = { inSec: num(clip.inSec), outSec: num(clip.outSec), state: 'loading',
                      cues: [], original: [] };
    return ytPost(CAP_ROUTE, { token: SRC.token, name: SRC.name,
                               start: num(clip.inSec), end: num(clip.outSec) })
      .then(function (payload) {
        var alvo = findById(YT.candidates, clip.id);
        /* A borda pode ter mudado durante a chamada (um `daqui`, um −1s). A legenda que
           chegou é de OUTRO intervalo, e escrevê-la aqui poria o texto de um trecho em cima
           de outro — o mesmo defeito que o `capOf` já guarda pelo par de tempos. */
        if (!alvo || num(alvo.rev) !== pedido) return;
        var cues = capCuesFrom(payload);
        alvo.clipCues = cues;
        alvo.captionState = cleanText(payload && payload.state, 40) || 'ok';
        var entry = CAPS[clip.id];
        if (entry && entry.state === 'loading') {
          entry.cues = cues;
          entry.original = cues.map(function (c) {
            return { start: c.start, end: c.end, text: c.text };
          });
          entry.state = alvo.captionState;
        }
        projectsPersist();
        renderKeepingScroll();
      })
      .catch(function (error) {
        capDrop(clip.id);
        var alvo = findById(YT.candidates, clip.id);
        if (alvo) alvo.captionState = 'CAPTIONS_EXTRACTION_FAILED';
        renderKeepingScroll();
        toast('Legenda deste trecho: '
          + (cleanText(error && error.message, 300) || 'não consegui ler.'), 'error');
      });
  }
  /* "Baixar trecho original": o recorte CRU da fonte já importada, pelo /api/video-cut.

     Até esta entrega este botão chamava o /api/yt-fetch e baixava o trecho do YouTube — rede
     a cada trecho, e o arquivo dele era pré-requisito para exportar o editado. Agora nenhum
     byte novo vem da internet: o corte sai do arquivo que está no disco, e é por isso que
     dois trechos seguidos não rebaixam o original.

     O portão de direitos continua valendo e continua conferido DUAS vezes (antes de chamar e
     na volta): o arquivo é de vídeo de terceiro do mesmo jeito. */
  function ytFetchClip(button, clipId) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) { toast('Este trecho não está mais na lista.', 'error'); return; }
    if (!srcReady()) { toast('Importe o vídeo antes de gerar um trecho.', 'error'); return; }
    var gate = ytFetchGate(YT);
    if (!gate.allowed) { toast('Gerar o trecho está bloqueado: ' + gate.reason + '.', 'error'); return; }
    var key = 'fetch:' + clipId;
    if (YT_BUSY[key]) return;
    var inicio = num(clip.inSec);
    var fim = num(clip.outSec);
    if (!(fim > inicio)) { toast('Este trecho não tem um intervalo válido.', 'error'); return; }
    var nome = cutFileName(clip.topic, inicio, fim, 'horizontal');
    /* O token e o nome são lidos AGORA e guardados: a fonte pode ser trocada durante a
       chamada, e usar o SRC de então escreveria o resultado de um vídeo no registro de
       outro. */
    var fonteToken = SRC.token;
    var fonteNome = SRC.name;
    var query = '?token=' + encodeURIComponent(fonteToken)
      + '&name=' + encodeURIComponent(fonteNome)
      + '&start=' + encodeURIComponent(inicio) + '&end=' + encodeURIComponent(fim)
      + '&profile=horizontal&output=' + encodeURIComponent(nome);
    var guardado = '';
    var audio = '';
    ytBusy(key, true, button, 'Gerando…');
    toast('Recortando o trecho do vídeo já importado — leva segundos, não baixa nada.');
    /* Sem corpo: o servidor acha a fonte pelo token no cache dele. É esse caminho
       (`length == 0` no /api/video-cut) que faz o original não subir nem descer de novo. */
    fetch('/api/video-cut' + query, { method: 'POST', headers: { Accept: 'video/mp4' } })
      .catch(function () {
        throw new Error('O renderizador não está ativo — rode estudio.ps1.');
      })
      .then(function (response) {
        if (!response.ok) return renderError(response).then(function (m) { throw new Error(m); });
        guardado = savedPathOf(response);
        audio = audioStateOf(response);
        return response.blob();
      })
      .then(function (blob) {
        if (!blob || !blob.size) throw new Error('O renderizador devolveu um arquivo vazio.');
        var revisto = ytFetchGate(YT);
        if (!revisto.allowed) throw new Error('O arquivo saiu, mas o direito mudou no caminho: ' + revisto.reason + '.');
        downloadBlob(nome, blob);
        var alvo = findById(YT.candidates, clipId);
        if (alvo) {
          /* Registro do que foi EXPORTADO deste trecho — não mais "o trecho está no disco".
             É o que o `clipBoundaryChanged` descarta quando a borda muda, sem levar a fonte. */
          alvo.clipToken = fonteToken;
          alvo.clipFilename = nome;
          alvo.clipBytes = blob.size;
          projectsPersist();
        }
        libAdd({
          videoName: YT.title || ('YouTube ' + YT.videoId),
          videoUrl: YT.videoId ? 'https://www.youtube.com/watch?v=' + YT.videoId : '',
          clipName: clip.topic, inSec: inicio, outSec: fim,
          fileName: nome, savedPath: guardado, bytes: blob.size, origin: 'youtube'
        });
        ytBusy(key, false);
        render();
        toast((guardado
          ? 'Trecho original guardado em ' + guardado + ' e listado na Central.'
          : 'Trecho original salvo em Downloads: ' + nome + '.')
          + (audioMessage(audio) ? ' ' + audioMessage(audio) : ''));
      })
      .catch(function (error) { ytFail(key, error); });
  }
  /* --- Edição: manda o trecho para o Remotion --------------------------------------
     O contrato entre as duas metades é só este objeto: qual arquivo, que falas e que
     preset. A descoberta de cortes não sabe que o Remotion existe, e o Remotion não sabe
     que a fonte era YouTube. Não usa ytPost: a resposta aqui é um MP4, não JSON. */
  /* O Remotion renderiza quadro a quadro num Chrome headless: ~12s de render por segundo
     de clipe, medido nesta máquina (i5 de 6 núcleos, 1080x1920, dois decodes por quadro —
     90s de clipe = 2700 quadros em 1005s). Um trecho de 90s leva ~18 min. Dizer "leva
     alguns minutos" para uma espera dessas é o mesmo que não dizer nada (BP-008): o
     operador desiste no meio e conclui que quebrou. Este fator é a estimativa HONESTA; o
     teto de verdade mora no serve.py (render_budget) e é folgado de propósito. */
  function renderEta(segundos) {
    var total = num(segundos) * 12;
    if (!(total > 0)) return 'alguns minutos';
    if (total < 90) return 'cerca de um minuto';
    return 'cerca de ' + Math.round(total / 60) + ' min';
  }
  /* O corpo do POST /api/remotion-render. PURA e exportada de proposito, e a razao e o
     proprio defeito que este commit conserta: enquanto ela era montada inline dentro do
     `fetch`, a unica prova possivel era regex sobre o arquivo -- e foi assim que
     `title: ''` atravessou a entrega inteira do destaque de titulo. O recurso existia no
     preset.js, tinha 33 verificacoes verdes, e NUNCA chegava ao render, nem aqui nem no
     Remotion Studio. Nao era a composicao: era uma linha fixa neste corpo.
     E a mesma licao do BP-014 (a funcao que le dado persistido tem que ser exportada e
     chamada pelo teste) aplicada ao dado que SAI: agora o teste constroi um trecho e
     confere o que sobe. */
  /* `fonte` = `{token, name}` da fonte importada. Presente, o corpo passa a dizer QUAL
     pedaço dela renderizar; ausente, o comportamento é o de antes (o arquivo do token é o
     clipe inteiro), e é isso que mantém funcionando um trecho baixado antes desta entrega.

     Os dois campos andam JUNTOS num único ramo de propósito: mandar o token da fonte sem o
     intervalo faria o servidor renderizar o vídeo INTEIRO — duas horas de podcast no lugar de
     um corte de 40 s, depois de um render de horas. Separá-los em dois `if` seria abrir a
     porta para exatamente isso. */
  function renderBody(clip, comLegenda, fonte) {
    var daFonte = !!(fonte && fonte.token);
    var corpo = {
      clipToken: daFonte ? fonte.token : clip.clipToken,
      preset: comLegenda ? 'legenda' : 'limpo',
      category: cleanText(clip.category, 40),
      /* O texto corrigido no painel vence o que o YouTube detectou. Sem correcao, vai o
         original -- e o `capEdited` so devolve algo depois de uma diferenca real. */
      cues: comLegenda ? (capEdited(clip) || clip.clipCues || []) : [],
      /* O titulo do card da marca. O texto e o `topic` do trecho, que ja e o que nomeia o
         arquivo baixado e o cartao na Central -- a manchete e a mesma coisa que o operador
         ja le na tela, e nao um campo novo para ele preencher. Quem tira o `>>` e o
         `[ __ ]` da transcricao e o `strip_artifacts` do servidor (regra unica,
         compartilhada com a legenda); aqui so se apara o tamanho. */
      title: cleanText(clip.topic, 180),
      /* A identidade que o card veste. Pelo validador, sempre: trecho antigo nao tem a
         chave e cairia como `undefined` no corpo do POST -- e ai a marca sairia do
         `defaultProps` da composicao em vez da escolha do operador. Trecho antigo tem que
         sair como sempre saiu (Primo Rico), e isso e o validador quem garante, nao a
         ausencia da chave.
         Mandar SEMPRE a chave e o que fecha o caminho: o `render_props` do serve.py valida
         de novo, e prop mandado vence defaultProp na composicao. */
      titleCardStyle: titleCardStyleOf(clip),
      /* O estilo da legenda, pelo validador e SEMPRE presente, pela mesma razão do
         titleCardStyle: trecho salvo antes deste seletor não tem a chave, e mandar
         `undefined` deixaria a composição cair no `defaultProps` em vez da escolha do
         operador. O `render_props` do serve.py valida de novo. */
      legendaStyle: legendaStyleOf(clip),
      /* O enquadramento escolhido. Pelo validador e SEMPRE presente, pela mesma razao do
         titleCardStyle: trecho salvo antes do seletor nao tem a chave, e mandar `undefined`
         deixaria a composicao cair no `defaultProps` em vez da escolha do operador.
         Mandar a chave sempre e o que fecha o caminho -- o `render_props` do serve.py valida
         de novo e dela tira o `videoAltura`, o `bandaAltura` e o `legendaBase`. */
      reframe: reframeOf(clip)
    };
    var edit = editOf(clip);
    if (Object.keys(edit.legenda).length || Object.keys(edit.enquadramento).length) corpo.edit = edit;
    if (daFonte) {
      corpo.start = num(clip.inSec);
      corpo.end = num(clip.outSec);
      /* O nome da fonte é a chave do sidecar dela no servidor (legenda e miniatura). */
      corpo.name = cleanText(fonte.name, 200);
    }
    return corpo;
  }
  function ytRenderClip(button, clipId, preset) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) { toast('Este trecho não está mais na lista.', 'error'); return; }
    /* O pré-requisito mudou: era "este trecho já foi baixado", agora é "o vídeo está
       importado". É o que permite exportar dois cortes diferentes sem um único download novo
       — e o que faz o primeiro corte sair sem etapa intermediária nenhuma. */
    if (!srcReady()) { toast('Importe o vídeo antes de exportar o corte editado.', 'error'); return; }
    var gate = ytFetchGate(YT);
    if (!gate.allowed) { toast('Exportar está bloqueado: ' + gate.reason + '.', 'error'); return; }
    var key = 'render:' + clipId;
    if (YT_BUSY[key]) return;
    var comLegenda = preset !== 'limpo';
    ytBusy(key, true, button, 'Renderizando…');
    toast('Renderizando no Remotion — ' + renderEta(num(clip.outSec) - num(clip.inSec))
      + ' para este trecho. Pode continuar usando a aba, mas não feche o navegador.');
    /* As falas deste intervalo podem AINDA não ter sido lidas: quem exporta pelo menu da
       grade nunca abriu o editor, e antes desta entrega elas vinham dentro do download do
       trecho. Lê ANTES de renderizar — descobrir no fim de um render de minutos que o vídeo
       saiu sem legenda porque ninguém abriu o trecho é o pior desfecho possível (BP-008).
       `capOf` é a guarda que impede isto de atropelar uma correção já digitada. */
    var esperaLegenda = (comLegenda && !capOf(clip) && !(clip.clipCues || []).length)
      ? srcCuesLoad(clip)
      : Promise.resolve(null);
    esperaLegenda.then(function () {
      ytRenderStart(button, clipId, comLegenda, key);
    });
  }
  /* A segunda metade do export editado, depois de a legenda estar na mão. Separada para o
     `ytRenderClip` poder ESPERAR a leitura das falas sem aninhar o fetch do MP4 dentro de
     outro then. */
  function ytRenderStart(button, clipId, comLegenda, key) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) { ytBusy(key, false); toast('O trecho saiu da lista.', 'error'); return; }
    if (comLegenda && !(clip.clipCues || []).length) {
      /* Nem toda fonte tem legenda. Dizer isso ANTES do render de minutos é melhor que
         entregar um vídeo mudo e deixar o operador achar que o preset quebrou (BP-008). */
      toast('Este trecho não tem legenda disponível; vai sair sem texto na tela.');
    }
    var nome = cutFileName(clip.topic, num(clip.inSec), num(clip.outSec), 'crop');
    var guardado = '';
    var audio = '';
    var fundo = '';
    var body = renderBody(clip, comLegenda, { token: SRC.token, name: SRC.name });
    /* `clipFilename` NÃO vai mais no corpo, e a omissão é a correção de um perigo real: ele
       era a rede de segurança que restaurava o arquivo do trecho quando o token expirava, e
       hoje ele guarda o nome do que foi EXPORTADO deste trecho. Mandado junto, um token de
       fonte expirado faria o servidor cair nessa rede e renderizar o vídeo JÁ EXPORTADO como
       se fosse a fonte. A rede certa agora é o próprio `/api/yt-import`, que redescobre a
       fonte no disco sem baixar nada. */
    fetch('/api/remotion-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'video/mp4' },
      body: JSON.stringify(body)
    }).catch(function () {
      throw new Error('O renderizador não está ativo — rode estudio.ps1.');
    }).then(function (response) {
      if (!response.ok) return renderError(response).then(function (m) { throw new Error(m); });
      guardado = savedPathOf(response);
      /* O caminho Remotion nao lia cabecalho de estado NENHUM ate esta entrega: o volume do
         clipe e o mesmo assunto aqui e no Passo 3, e o passe roda para os dois. */
      audio = audioStateOf(response);
      /* Qual fundo saiu. Os dois casos de letterbox dao o MESMO pixel, entao sem esta leitura
         o operador nao distingue "nao tinha miniatura" de "a miniatura chegou quebrada". */
      fundo = backgroundStateOf(response);
      return response.blob();
    }).then(function (blob) {
      if (!blob || !blob.size) throw new Error('O Remotion devolveu um arquivo vazio.');
      downloadBlob(nome, blob);
      ytBusy(key, false);
      libAdd({
        videoName: YT.title || ('YouTube ' + YT.videoId),
        videoUrl: YT.videoId ? 'https://www.youtube.com/watch?v=' + YT.videoId : '',
        clipName: clip.topic, inSec: clip.inSec, outSec: clip.outSec,
        fileName: nome, savedPath: guardado, bytes: blob.size, origin: 'youtube'
      });
      toast((guardado
        ? 'Vídeo editado guardado em ' + guardado + ' e listado na Central.'
        : 'Vídeo editado salvo em Downloads: ' + nome + '.') + (audioMessage(audio) ? ' ' + audioMessage(audio) : '')
        + (backgroundMessage(fundo) ? ' ' + backgroundMessage(fundo) : ''));
      renderKeepingScroll();
    }).catch(function (error) { ytFail(key, error); });
  }
  /* CAMADA B: um quadro, do renderizador de verdade. Sem barra de progresso e sem fila
     própria — o servidor já serializa render e still no mesmo `_render_slot`, e inventar
     uma segunda fila aqui só criaria dois donos para a mesma espera.
     TODO desfecho fala (BP-008): pedindo, deu certo (com a âncora que o servidor resolveu)
     e falhou com o motivo. Fiapo de carregamento sem fim é o que este projeto não aceita. */
  function ytStill(button, clipId) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) { toast('O trecho saiu da lista.', 'error'); return; }
    var raiz = document.getElementById('video-ops-root');
    var aviso = raiz && raiz.querySelector('[data-leg-still-msg]');
    var vaga = raiz && raiz.querySelector('[data-leg-still-slot]');
    function diga(texto) { if (aviso) aviso.textContent = texto; }
    if (button) button.disabled = true;
    diga('Montando o quadro real… o primeiro pode demorar (o Chrome do Remotion abre agora).');
    fetch('/api/remotion-still', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'image/png' },
      body: JSON.stringify(renderBody(clip, true, { token: SRC.token, name: SRC.name }))
    }).catch(function () {
      throw new Error('O renderizador não está ativo — rode estudio.ps1.');
    }).then(function (response) {
      if (!response.ok) return renderError(response).then(function (m) { throw new Error(m); });
      var base = response.headers.get('X-Clip-Legenda-Base') || '';
      var alto = response.headers.get('X-Clip-Video-Altura') || '';
      return response.blob().then(function (blob) { return { blob: blob, base: base, alto: alto }; });
    }).then(function (saida) {
      if (button) button.disabled = false;
      if (!saida.blob || !saida.blob.size) throw new Error('O Remotion devolveu um quadro vazio.');
      if (vaga) {
        /* O objeto anterior é revogado: cada clique gera uma URL nova, e sem isto o
           navegador segura um PNG de 1080x1920 por clique até a aba fechar. */
        var velha = vaga.querySelector('img');
        if (velha && velha.src.indexOf('blob:') === 0) URL.revokeObjectURL(velha.src);
        vaga.innerHTML = '<img class="vop-leg-still-img" alt="Quadro real do corte, '
          + 'renderizado pelo Remotion" src="' + esc(URL.createObjectURL(saida.blob)) + '">';
      }
      diga('Este é o quadro real, no meio do corte. A legenda foi ancorada a '
        + saida.base + ' px da borda de baixo, sobre um vídeo de ' + saida.alto + ' px de altura.');
    }).catch(function (error) {
      if (button) button.disabled = false;
      diga('Não deu para montar o quadro real: ' + (error && error.message ? error.message : 'erro desconhecido') + '.');
    });
  }
  /* A aba não processa AV1/4K: envia o File somente ao helper local da mesma origem. O
     primeiro download sobe a fonte; o segundo reaproveita o cache temporário pelo token. */
  /* "Este trecho está renderizando" mora no MÓDULO, não no botão. O botão é recriado a cada
     render da lista — e agora a própria tela tem um botão que re-renderiza ("Legenda"), então
     o `disabled` posto no elemento voltava habilitado no meio do download e um segundo clique
     subia o original de novo e disparava um segundo FFmpeg para o mesmo corte. É a mesma
     razão que já estava escrita no ytBusy. A chave é o INTERVALO porque o Passo 2 também
     baixa a partir da marcação, que não tem id de corte. */
  var CUT_BUSY = Object.create(null);
  function cutBusyKey(inSec, outSec) { return num(inSec) + '-' + num(outSec); }
  function cutBusy(cut) {
    return !!CUT_BUSY[cutBusyKey(cut && cut.inSec, cut && cut.outSec)];
  }
  function downloadRenderedCut(button, resolved, profile, corrigida) {
    var sourceId = resolved && resolved.source && resolved.source.id;
    var session = sourceId && renderSession(sourceId);
    var start = num(resolved && resolved.clip && resolved.clip.inSec);
    var stop = num(resolved && resolved.clip && resolved.clip.outSec);
    var selected = commandProfile(profile);
    if (!session || stop <= start) {
      toast('Abra o vídeo nesta sessão e confirme um intervalo válido antes de baixar.', 'error');
      return;
    }
    if (typeof fetch !== 'function') {
      toast('Este navegador não consegue falar com o renderizador local.', 'error');
      return;
    }
    var nomeBase = resolved.clip.topic || INTAKE.name;
    var outName = cutFileName(nomeBase, start, stop, selected);
    var comCorrecao = !!(corrigida && corrigida.length);
    var query = '?token=' + encodeURIComponent(session.token)
      + '&name=' + encodeURIComponent(session.file.name || 'video.mp4')
      + '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(stop)
      + '&profile=' + encodeURIComponent(selected) + '&output=' + encodeURIComponent(outName);
    var busyKey = cutBusyKey(start, stop);
    if (CUT_BUSY[busyKey]) {
      toast('Este trecho já está sendo gerado. Espere o arquivo chegar.', 'error');
      return;
    }
    CUT_BUSY[busyKey] = true;
    var label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Gerando 9:16…';

    function request(includeFile, retried) {
      var headers = { Accept: 'video/mp4' };
      if (includeFile) headers['Content-Type'] = session.file.type || 'application/octet-stream';
      return fetch('/api/video-cut' + query, {
        method: 'POST', headers: headers, body: includeFile ? session.file : null
      }).then(function (response) {
        if (response.headers && response.headers.get('X-Video-Source-Cached') === '1') session.uploaded = true;
        if (response.status === 409 && !includeFile && !retried) {
          session.uploaded = false;
          return request(true, true);
        }
        if (!response.ok) {
          return renderError(response).then(function (message) { throw new Error(message); });
        }
        session.uploaded = true;
        /* O caminho é lido do cabeçalho ANTES do corpo: é o endereço fixo onde o helper
           acabou de guardar este corte, e é ele que a Central vai tocar depois. */
        var guardado = savedPathOf(response);
        /* O que aconteceu com a LEGENDA deste clipe só o servidor sabe: ele é quem recorta
           as falas no intervalo. Ler o cabeçalho é o que impede "renderizou sem legenda"
           de passar por "renderizou com legenda" até alguém abrir o arquivo (BP-008). */
        var legenda = captionsStateOf(response);
        var audioEstado = audioStateOf(response);
        var fundoEstado = backgroundStateOf(response);
        return response.blob().then(function (blob) {
          if (!blob || !blob.size) throw new Error('O renderizador devolveu um arquivo vazio.');
          downloadBlob(outName, blob);
          libAdd({
            videoName: INTAKE.name, clipName: nomeBase, inSec: start, outSec: stop,
            fileName: outName, savedPath: guardado, bytes: blob.size, origin: 'local'
          });
          toast((guardado
            ? 'Corte guardado em ' + guardado + ' — ele está na Central daqui pra frente.'
            : 'Corte salvo em Downloads: ' + outName + '.') + ' ' + captionsMessage(legenda)
            + (comCorrecao && legenda.indexOf('burned') === 0
              ? ' Com o texto que você corrigiu.' : '')
            + (audioMessage(audioEstado) ? ' ' + audioMessage(audioEstado) : '')
            + (backgroundMessage(fundoEstado) ? ' ' + backgroundMessage(fundoEstado) : ''));
        });
      });
    }

    /* A correção da legenda sobe ANTES do render, na rota de revisão: o corpo do
       /api/video-cut é o vídeo, não sobra lugar para texto lá. Falhar aqui derruba o
       download inteiro de propósito — baixar um clip com a legenda errada depois de o
       operador ter corrigido seria pior que não baixar (BP-008). */
    var envio = comCorrecao
      ? ytPost(CAP_ROUTE, { token: session.token, name: session.file.name || 'video.mp4',
                            start: start, end: stop, cues: corrigida })
      : Promise.resolve(null);

    envio.then(function () {
      return request(!session.uploaded, false);
    }).catch(function (error) {
      var motivo = cleanText(error && error.message, 500) || 'Não consegui gerar o vídeo.';
      /* Renderizador fora do ar não pode deixar o operador sem saída: o comando do FFmpeg
         é a rede de segurança e vem copiado JUNTO com o motivo — nunca calado e nunca sem
         dizer por que apareceu (BP-008). */
      var manual = ffmpegCutCommand(session.file.name, start, stop, outName, selected);
      if (!manual) { toast(motivo, 'error'); return; }
      return copyText(manual).then(function () {
        /* O comando de emergência não queima legenda (o .ass é escrito pelo servidor, que
           acabou de cair). Dizer isso é o que separa "clip sem legenda" de "clip sem legenda
           e ninguém avisou" — sobretudo depois de o operador ter corrigido o texto. */
        toast(motivo + ' Copiei o comando do FFmpeg (saída ' + outName
          + '): cole no PowerShell dentro da pasta do projeto. Atenção: esse comando NÃO '
          + 'queima legenda — o clip sai sem o texto.', 'error');
      }, function () { toast(motivo, 'error'); });
    }).then(function () {
      delete CUT_BUSY[busyKey];
      button.disabled = false;
      button.textContent = label;
      button.removeAttribute('aria-busy');
      renderKeepingScroll();
    });
  }

  /* --- Painel do vídeo: refresh sem re-render --------------------------------------- */
  function intakeMarkRefresh(panel) {
    if (!panel) return;
    var duration = secs(INTAKE.duration);
    var status = intakeMarkStatus(INTAKE);
    var box = panel.querySelector('[data-intake-mark-status]');
    if (box) { box.textContent = status.text; box.dataset.tone = status.tone; }
    var dur = panel.querySelector('[data-intake-mark-dur]');
    if (dur) dur.textContent = fmtClock(duration);
    var hasIn = INTAKE.inSec !== '';
    var hasOut = INTAKE.outSec !== '';
    var selected = panel.querySelector('[data-intake-mark-sel]');
    if (selected) {
      selected.textContent = (hasIn || hasOut)
        ? 'trecho ' + (hasIn ? fmtClock(INTAKE.inSec) : '--:--') + ' → ' + (hasOut ? fmtClock(INTAKE.outSec) : '--:--')
        : 'nenhum trecho marcado';
    }
    /* O painel não é re-renderizado a cada digitação, então o estado dos botões é
       atualizado aqui junto com a faixa que diz o porquê. */
    var add = panel.querySelector('[data-intake-add]');
    if (add) {
      add.disabled = status.tone !== 'ok';
      add.title = status.tone === 'ok' ? '' : status.text;
      add.textContent = INTAKE.editingId ? 'Atualizar corte' : 'Adicionar corte';
    }
    /* Não mexer no rótulo enquanto o render está em andamento: downloadRenderedCut é dono
       do texto e do aria-busy do botão até a resposta chegar. */
    var save = panel.querySelector('[data-intake-save]');
    if (save && save.getAttribute('aria-busy') !== 'true') {
      save.disabled = status.tone !== 'ok';
      save.title = status.tone === 'ok' ? '' : status.text;
    }
    var band = panel.querySelector('[data-intake-mark-band]');
    if (band) {
      var valid = duration > 0 && hasIn && hasOut
        && !markIssues(INTAKE.inSec, INTAKE.outSec, duration).length;
      band.hidden = !valid;
      if (valid) {
        band.style.left = (Number(INTAKE.inSec) / duration * 100) + '%';
        band.style.width = ((Number(INTAKE.outSec) - Number(INTAKE.inSec)) / duration * 100) + '%';
      }
    }
  }
  /* Reescreve SÓ a lista. O <video> é irmão deste nó e não é recriado: arquivo, posição e
     estado do player sobrevivem a adicionar, editar e remover corte (nada de render()). */
  function intakeCutsRefresh(panel) {
    if (!panel) return;
    var box = panel.querySelector('[data-intake-cuts]');
    if (box) box.innerHTML = intakeCutsHTML();
  }
  function intakePlayheadRefresh(panel, video) {
    if (!panel || !video) return;
    var now = panel.querySelector('[data-intake-mark-now]');
    if (now) now.textContent = fmtClock(video.currentTime);
    var head = panel.querySelector('[data-intake-mark-playhead]');
    var duration = secs(video.duration);
    if (head) head.style.left = duration ? (secs(video.currentTime) / duration * 100) + '%' : '0%';
  }
  /* --- Arrastar o trecho na barra ---------------------------------------------------
     Um arrasto por vez, num estado de módulo: o segundo dedo TEM de ser ignorado, senão a
     borda salta para o outro toque no meio do gesto. */
  var DRAG = null;
  /* Puro: converte posição do ponteiro em segundo do vídeo. Testável sem DOM de verdade. */
  function trackRatio(box, clientX) {
    if (!box || !box.width) return 0;
    var ratio = (clientX - box.left) / box.width;
    return ratio < 0 ? 0 : (ratio > 1 ? 1 : ratio);
  }
  function trackSeconds(track, clientX) {
    var duration = secs(INTAKE.duration);
    /* Segundos inteiros: os campos são de tempo e o comando do FFmpeg usa inteiros. */
    return duration ? Math.round(trackRatio(track.getBoundingClientRect(), clientX) * duration) : 0;
  }
  /* Os campos continuam sendo a fonte da verdade; o arrasto escreve neles e deixa
     intakeMarkRefresh cuidar de faixa, status e botões — uma via só. */
  function dragWrite(panel) {
    var inField = panel.querySelector('[data-intake-cut-field="inSec"]');
    var outField = panel.querySelector('[data-intake-cut-field="outSec"]');
    if (inField) inField.value = clockField(INTAKE.inSec);
    if (outField) outField.value = clockField(INTAKE.outSec);
    intakeMarkRefresh(panel);
  }
  function onRootPointerDown(event) {
    if (DRAG || !event.target || !event.target.closest) return;
    var track = event.target.closest('[data-intake-mark-track]');
    if (!track) return;
    var panel = intakePanel();
    /* Sem vídeo aberto não há duração, e sem duração a barra não significa nada (BP-004). */
    if (!panel || !secs(INTAKE.duration)) return;
    var handle = event.target.closest('[data-intake-handle]');
    var at = trackSeconds(track, event.clientX);
    if (handle) {
      /* Arrastar uma borda mantém a outra parada: ela é a âncora do gesto. */
      DRAG = { track: track, panel: panel,
               anchor: num(handle.dataset.intakeHandle === 'in' ? INTAKE.outSec : INTAKE.inSec) };
    } else {
      /* Apertar na barra vazia começa uma seleção nova daquele ponto. */
      DRAG = { track: track, panel: panel, anchor: at };
    }
    track.dataset.dragging = '1';
    /* Captura: o gesto sobrevive a sair do elemento, e não morre no meio do movimento. */
    if (track.setPointerCapture) track.setPointerCapture(event.pointerId);
    track.addEventListener('pointermove', onTrackPointerMove);
    track.addEventListener('pointerup', onTrackPointerEnd);
    track.addEventListener('pointercancel', onTrackPointerEnd);
    onTrackPointerMove(event);
    /* Sem isto o navegador começa a selecionar texto no meio do arrasto. */
    if (event.preventDefault) event.preventDefault();
  }
  function onTrackPointerMove(event) {
    if (!DRAG) return;
    var at = trackSeconds(DRAG.track, event.clientX);
    /* Cruzar a âncora não trava: as bordas trocam de papel, como em qualquer editor. */
    var start = Math.min(DRAG.anchor, at);
    var end = Math.max(DRAG.anchor, at);
    /* Trecho de zero segundo não existe; garante 1s para a faixa nascer visível. */
    if (end === start) {
      if (start > 0) start -= 1; else end = Math.min(secs(INTAKE.duration), 1);
    }
    INTAKE.inSec = start;
    INTAKE.outSec = end;
    dragWrite(DRAG.panel);
  }
  function onTrackPointerEnd() {
    if (!DRAG) return;
    var track = DRAG.track;
    track.removeEventListener('pointermove', onTrackPointerMove);
    track.removeEventListener('pointerup', onTrackPointerEnd);
    track.removeEventListener('pointercancel', onTrackPointerEnd);
    delete track.dataset.dragging;
    DRAG = null;
  }
  function intakeMarkAction(panel, video, act) {
    var inField = panel.querySelector('[data-intake-cut-field="inSec"]');
    var outField = panel.querySelector('[data-intake-cut-field="outSec"]');
    if (!inField || !outField) return;
    if (act === 'clear') {
      INTAKE.inSec = '';
      INTAKE.outSec = '';
      /* Limpar também sai do modo de edição: senão o CTA ficaria em "Atualizar corte"
         apontando para um corte que o operador não está mais editando. */
      INTAKE.editingId = '';
      inField.value = '';
      outField.value = '';
      PREVIEW_STOP = 0;
      if (video) video.pause();
      intakeCutsRefresh(panel);
      intakeMarkRefresh(panel);
      return;
    }
    if (!video || INTAKE.state !== 'ready') {
      toast('Aguarde o navegador terminar de abrir o vídeo.', 'error');
      return;
    }
    var duration = secs(INTAKE.duration);
    var current = Math.round(secs(video.currentTime));
    if (act === 'in' || act === 'out') {
      if (act === 'in') { INTAKE.inSec = current; inField.value = clockField(current); }
      else { INTAKE.outSec = current; outField.value = clockField(current); }
    } else if (act === 'p15' || act === 'p30') {
      var span = act === 'p15' ? 15 : 30;
      var start = current;
      var end = start + span;
      var clamped = false;
      /* `duration &&` obrigatório: sem duração legível o clamp viraria 0→0 (BP-004). */
      if (duration && end > duration) {
        end = Math.floor(duration);
        start = Math.max(0, end - span);
        clamped = true;
      }
      INTAKE.inSec = start;
      INTAKE.outSec = end;
      inField.value = clockField(start);
      outField.value = clockField(end);
      toast('Preset de ' + span + 's aplicado'
        + (clamped ? ', ajustado para não passar da duração do vídeo.' : '.'));
    } else if (act === 'play') {
      /* Valida pela MESMA regra que a tela mostra: markIssues trata '' como 0 e aceitaria
         um início que o operador nunca definiu (BP-003/BP-008). */
      if (intakeMarkStatus(INTAKE).tone !== 'ok') {
        intakeMarkRefresh(panel);
        toast('Marque um trecho válido antes de reproduzir.', 'error');
        return;
      }
      video.currentTime = Number(INTAKE.inSec);
      PREVIEW_STOP = Number(INTAKE.outSec);
      var started = video.play();
      if (started && started.catch) {
        started.catch(function () { toast('O navegador bloqueou a reprodução. Use o controle do player.', 'error'); });
      }
    }
    intakeMarkRefresh(panel);
  }
  /* Adicionar, tocar, editar e remover corte. NENHUM destes caminhos chama render(),
     cria registro ou grava algo: só a lista e o estado dos botões são atualizados. */
  function intakeCutAction(panel, video, act, id) {
    var inField = panel.querySelector('[data-intake-cut-field="inSec"]');
    var outField = panel.querySelector('[data-intake-cut-field="outSec"]');
    function clearMark() {
      INTAKE.inSec = '';
      INTAKE.outSec = '';
      INTAKE.editingId = '';
      if (inField) inField.value = '';
      if (outField) outField.value = '';
    }
    if (act === 'add') {
      /* Mesma validação que a tela mostra — o botão já nasce bloqueado, mas a ação
         também recusa e explica, em vez de falhar em silêncio (BP-008). */
      if (intakeMarkStatus(INTAKE).tone !== 'ok') {
        intakeMarkRefresh(panel);
        toast('Marque um trecho válido antes de adicionar o corte.', 'error');
        return;
      }
      if (intakeCutDuplicate(INTAKE.cuts, INTAKE.inSec, INTAKE.outSec, INTAKE.editingId)) {
        toast('Este intervalo já está na lista. Trechos que se sobrepõem em parte são aceitos; iguais, não.', 'error');
        return;
      }
      var editing = findById(INTAKE.cuts, INTAKE.editingId);
      /* Mudar o intervalo invalida a legenda revisada daquele corte (o texto foi escrito para
         outras falas). O descarte é dito AQUI, junto do "Corte atualizado", porque é aqui que
         o operador agiu — no Passo 3 ele só veria o botão voltar a "Legenda" sem motivo. */
      var perdeuLegenda = false;
      if (editing) {
        var mudouIntervalo = editing.inSec !== num(INTAKE.inSec)
          || editing.outSec !== num(INTAKE.outSec);
        editing.inSec = num(INTAKE.inSec);
        editing.outSec = num(INTAKE.outSec);
        if (mudouIntervalo) perdeuLegenda = capDrop(editing.id);
      } else {
        /* Nasce com nome útil e prioridade média: o operador ajusta na própria linha, e
           nenhum campo obrigatório trava o ritmo de marcar vários trechos seguidos. */
        INTAKE.cuts.push({
          id: uid('cut'), name: 'Corte ' + (INTAKE.cuts.length + 1), priority: 'media',
          inSec: num(INTAKE.inSec), outSec: num(INTAKE.outSec)
        });
      }
      /* Limpa SÓ a marcação: o player segue com o mesmo arquivo, na mesma posição. */
      var wasEditing = !!editing;
      clearMark();
      intakeCutsRefresh(panel);
      intakeMarkRefresh(panel);
      toast((wasEditing ? 'Corte atualizado.' : 'Corte ' + INTAKE.cuts.length + ' adicionado. Marque o próximo trecho.')
        + (perdeuLegenda ? ' A legenda que você revisou era do intervalo antigo e foi descartada — revise de novo no Passo 3.' : ''));
      return;
    }
    var cut = findById(INTAKE.cuts, id);
    if (!cut) { toast('Este corte não está mais na lista.', 'error'); return; }
    if (act === 'play') {
      if (!video || INTAKE.state !== 'ready') {
        toast('Aguarde o navegador terminar de abrir o vídeo.', 'error');
        return;
      }
      video.currentTime = num(cut.inSec);
      PREVIEW_STOP = num(cut.outSec);
      var started = video.play();
      if (started && started.catch) {
        started.catch(function () { toast('O navegador bloqueou a reprodução. Use o controle do player.', 'error'); });
      }
      return;
    }
    if (act === 'edit') {
      /* Só devolve o intervalo para os campos. Não mexe no player de propósito: quem
         quiser rever o trecho usa "Tocar". */
      INTAKE.inSec = num(cut.inSec);
      INTAKE.outSec = num(cut.outSec);
      INTAKE.editingId = cut.id;
      if (inField) inField.value = clockField(INTAKE.inSec);
      if (outField) outField.value = clockField(INTAKE.outSec);
      intakeCutsRefresh(panel);
      intakeMarkRefresh(panel);
      return;
    }
    if (act === 'remove') {
      INTAKE.cuts = INTAKE.cuts.filter(function (item) { return item.id !== cut.id; });
      if (INTAKE.editingId === cut.id) clearMark();
      intakeCutsRefresh(panel);
      intakeMarkRefresh(panel);
      toast('Corte removido.');
    }
  }
  function intakePanel() {
    var host = document.getElementById('video-ops-root');
    return host && host.querySelector ? host.querySelector('[data-intake]') : null;
  }
  /* Arrastar-e-soltar e a leitura da duração precisam de ouvintes diretos; o resto do
     painel usa a delegação que já existe na raiz. Roda depois de cada render. */
  function bindIntake() {
    var panel = intakePanel();
    if (!panel) return;
    var drop = panel.querySelector('[data-intake-drop]');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (type) {
        drop.addEventListener(type, function (event) {
          event.preventDefault();
          drop.dataset.over = 'true';
        });
      });
      ['dragleave', 'dragend'].forEach(function (type) {
        drop.addEventListener(type, function () { drop.dataset.over = 'false'; });
      });
      drop.addEventListener('drop', function (event) {
        event.preventDefault();
        drop.dataset.over = 'false';
        var dropped = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (dropped) intakeSetFile(dropped);
      });
    }
    var video = panel.querySelector('[data-intake-video]');
    if (!video) return;
    var markFields = panel.querySelectorAll('[data-intake-cut-field]');
    markFields.forEach(function (input) {
      input.addEventListener('input', function () {
        INTAKE[input.dataset.intakeCutField] = parseClock(input.value);
        PREVIEW_STOP = 0;
        intakeMarkRefresh(panel);
      });
      /* Ao SAIR do campo o texto volta normalizado: digitar 930 mostra 15:30 e ensina o
         formato sem aula. Enquanto digita o campo não é reescrito — o cursor pularia. */
      input.addEventListener('change', function () {
        input.value = clockField(INTAKE[input.dataset.intakeCutField]);
        intakeMarkRefresh(panel);
      });
    });
    panel.querySelectorAll('[data-intake-mark-act]').forEach(function (button) {
      button.addEventListener('click', function () { intakeMarkAction(panel, video, button.dataset.intakeMarkAct); });
    });
    video.addEventListener('loadedmetadata', function () {
      INTAKE.duration = secs(video.duration);
      INTAKE.state = 'ready';
      /* Atualiza só os dois nós de leitura: re-render aqui perderia a posição do player. */
      var slot = panel.querySelector('[data-intake-duration]');
      if (slot) slot.textContent = INTAKE.duration ? fmtClock(INTAKE.duration) : 'não foi possível ler';
      var box = panel.querySelector('[data-intake-status]');
      var ready = intakeStatus(INTAKE);
      if (box) { box.textContent = ready.text; box.dataset.tone = ready.tone; }
      /* Só agora o navegador confirmou que consegue abrir: o Passo 1 libera o "Continuar".
         Sem re-render — o player recém-criado perderia o arquivo que acabou de abrir. */
      var next = panel.querySelector('[data-intake-next]');
      if (next) { next.disabled = false; next.removeAttribute('title'); }
      intakeMarkRefresh(panel);
      intakePlayheadRefresh(panel, video);
    });
    video.addEventListener('timeupdate', function () {
      if (PREVIEW_STOP && video.currentTime >= PREVIEW_STOP) { video.pause(); PREVIEW_STOP = 0; }
      intakePlayheadRefresh(panel, video);
    });
    video.addEventListener('pause', function () { PREVIEW_STOP = 0; });
    video.addEventListener('error', function () {
      intakeRelease();
      INTAKE.state = 'error';
      INTAKE.message = 'Não foi possível abrir este vídeo no navegador. Confirme que o arquivo é um MP4 válido.';
      render();
    });
  }

  /* --- Barra de telas e render ------------------------------------------------------
     Central, projetos salvos e análise do YouTube são as únicas telas disponíveis. */
  var FLOW_HINT = {
    central: 'Os clips que você já baixou, agrupados por vídeo. Aqui você baixa de novo.',
    projects: 'Seus projetos de análise: cada vídeo do YouTube analisado vira um projeto com seus trechos sugeridos.',
    youtube: 'Cole a URL do YouTube e importe o vídeo inteiro: ele toca aqui dentro e todo corte sai desse mesmo arquivo.',
    resultados: 'O que aconteceu depois de publicar: registre cada publicação, anote as métricas com data e veja quais formatos rendem mais.'
  };
  /* A tela Resultados vive no `video-results.js` — módulo próprio, chave própria
     (`pp_video_results_v1`). Estas duas funções são o ÚNICO ponto de contato: se o arquivo
     não carregar, a aba DIZ o motivo em vez de renderizar vazio (BP-008), e o resto do
     Estúdio continua funcionando. */
  function resultsAPI() {
    return (typeof window !== 'undefined' && window.videoResults) ? window.videoResults : null;
  }
  function resultadosHTML() {
    var api = resultsAPI();
    if (!api) {
      return emptyHTML('A tela de Resultados não carregou',
        'O arquivo video-results.js não foi encontrado nesta página. Recarregue; se continuar assim, confira se a tag <script src="video-results.js"> ainda está no index.html.',
        'tab', 'Voltar para a Central', 'data-act="tab" data-tab="central"');
    }
    return api.html(LIB ? LIB.clips : []);
  }
  function tabButtonHTML(tab) {
    return '<button type="button" data-act="tab" data-tab="' + tab[0] + '"'
      + ' aria-pressed="' + (TAB === tab[0]) + '" class="' + (TAB === tab[0] ? 'active' : '') + '">'
      + esc(tab[1])
      + (tab[2] !== '' ? '<span>' + tab[2] + '</span>' : '') + '</button>';
  }
  function tabsHTML() {
    var projetosCount = PROJECTS && PROJECTS.projects ? PROJECTS.projects.length : 0;
    var api = resultsAPI();
    var publicacoes = api ? api.count() : 0;
    var tabs = [['central', 'Central', LIB.clips.length || ''], ['projects', 'Meus projetos', projetosCount || ''], ['youtube', 'YouTube', YT.candidates.length || ''], ['resultados', 'Resultados', publicacoes || '']];
    return '<nav class="vop-flow" aria-label="Telas do estúdio">'
      + '<div class="vop-flow-steps">' + tabs.map(tabButtonHTML).join('') + '</div>'
      + '</nav>'
      + '<p class="vop-flow-hint">' + esc(FLOW_HINT[TAB] || '') + '</p>';
  }
  function headerHTML() {
    var info = projectInfo();
    return '<header class="vop-head">'
      + '<div class="vop-head-copy"><span class="vop-kicker">Operação de 90 dias</span><h1>Estúdio de Vídeos</h1>'
      + '<p>Do vídeo longo ao arquivo pronto para postar. O corte é seu; o Estúdio só recorta e guarda.</p></div>'
      + '<div class="vop-project"><span>Dia ' + info.day + ' de ' + DAYS + '</span><div class="vop-progress"><i style="width:' + info.percent + '%"></i></div><small>' + info.remaining + ' dias restantes</small></div>'
      + '<div class="vop-head-actions">'
      + (BROKEN_RAW ? chip('publication-error', 'Recuperação necessária')
        : '<button class="vop-btn vop-btn-quiet" type="button" data-act="tab" data-tab="central">Central · ' + LIB.clips.length + ' clip(s)</button>')
      + '</div></header>';
  }
  function recoveryHTML() {
    return '<section class="vop-empty vop-recovery"><div class="vop-empty-icon" aria-hidden="true">!</div><h2>O histórico local precisa de recuperação</h2>'
      + '<p>O registro de clips salvo neste navegador não foi reconhecido e permanece intacto. Baixe a cópia bruta antes de recomeçar — os arquivos de vídeo no seu computador não são afetados.</p>'
      + '<div class="vop-card-actions"><button class="vop-btn vop-btn-secondary" type="button" data-act="download-raw">Baixar dados brutos</button>'
      + '<button class="vop-btn vop-btn-danger" type="button" data-act="reset-broken">Começar de novo</button></div></section>';
  }
  function render() {
    /* Sem DOM não há o que pintar. A guarda existe porque o módulo é carregado FORA do
       navegador pela própria suíte de lógica pura (`test-video-ops.js`), e desde que o
       `srcApply` passou a repintar na transição de estado ele alcança este ponto de lá —
       `document` indefinido derrubava a suíte inteira. Mesma família do guarda de `window`
       que o resto do arquivo já usa. */
    if (typeof document === 'undefined') return;
    var root = document.getElementById('video-ops-root');
    if (!root) return;
    if (BROKEN_RAW) {
      root.innerHTML = headerHTML() + '<main class="vop-body">' + recoveryHTML() + '</main>';
      refreshBadge();
      return;
    }
    var body = '';
    if (!Object.prototype.hasOwnProperty.call(FLOW_HINT, TAB)) TAB = 'central';
    if (TAB === 'central') body = centralHTML();
    else if (TAB === 'projects') body = projectsHTML();
    else if (TAB === 'youtube') body = ytStepHTML();
    else if (TAB === 'resultados') body = resultadosHTML();
    root.innerHTML = headerHTML() + tabsHTML() + '<main class="vop-body">' + body + '</main>';
    /* O player da fonte volta VIVO para a tela nova, com a posição, o volume e o buffer
       intactos. Tem de ser aqui, na MESMA tarefa do innerHTML — ver srcAdopt. */
    srcAdopt(root);
    bindIntake();
    refreshBadge();
  }
  function renderKeepingScroll() {
    var x = typeof window !== 'undefined' ? Number(window.scrollX) || 0 : 0;
    var y = typeof window !== 'undefined' ? Number(window.scrollY) || 0 : 0;
    render();
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { window.scrollTo(x, y); });
      else window.scrollTo(x, y);
    }
  }
  /* O contador da navegação diz quantos clips estão guardados na Central. */
  function refreshBadge() {
    var badge = document.getElementById('count-video-ops');
    if (!badge || !LIB) return;
    badge.textContent = LIB.clips.length;
  }
  function ensureToast() {
    if (TOAST) return TOAST;
    TOAST = document.createElement('div');
    TOAST.className = 'vop-toast';
    TOAST.setAttribute('role', 'status');
    TOAST.setAttribute('aria-live', 'polite');
    document.body.appendChild(TOAST);
    return TOAST;
  }
  function toast(message, tone) {
    if (typeof document === 'undefined') return;
    var el = ensureToast();
    clearTimeout(el._hideTimer);
    el.textContent = message;
    el.dataset.tone = tone || 'ok';
    el.dataset.show = 'true';
    el._hideTimer = setTimeout(function () { el.dataset.show = 'false'; }, 3800);
  }
  /* Salvar arquivo JÁ pronto — o MP4 que o renderizador local devolve — passa pela mesma
     âncora do download de texto: um único lugar cria e revoga a URL temporária. */
  function downloadBlob(name, blob) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  function download(name, content, type) {
    downloadBlob(name, new Blob([content], { type: type || 'text/plain;charset=utf-8' }));
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = document.execCommand('copy');
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  /* --- Eventos ---------------------------------------------------------------------- */
  /* Nome e prioridade vão direto para o corte na sessão. Sem re-render de propósito:
     reescrever a lista a cada tecla tiraria o foco do campo (parente do BP-001). */
  /* Titulo do card, escrito a cada tecla e SEM re-render — irmao do `cutFieldWrite`, pelo
     mesmo motivo dele: reescrever a lista tiraria o foco do campo (BP-001).
     Trecho que nao esta mais na lista (URL trocada no meio da digitacao) simplesmente nao
     grava, em vez de criar um candidato fantasma. */
  function clipFieldWrite(input) {
    var clip = findById(YT.candidates, input.dataset.id);
    if (!clip) return;
    if (input.dataset.clipField === 'topic') clip.topic = cleanText(input.value, 180);
    else if (input.dataset.clipField === 'titleCardStyle') {
      /* Pelo validador, e nao `= input.value`: o value vem do DOM, e DOM e entrada. */
      clip.titleCardStyle = titleCardStyleOf({ titleCardStyle: input.value });
      /* SEM re-render, como o titulo: o `:checked` do radio nativo ja mostra a escolha, e
         reescrever a lista tiraria o foco de quem chegou pelo teclado (BP-001).
         Persiste porque `YT.candidates` E `project.candidates` (mesmos objetos, atribuidos
         no `open-project`), entao a escolha volta com o projeto depois de recarregar a
         pagina. E um CLIQUE deliberado, nao uma tecla: gravar aqui nao martela o
         localStorage como gravaria a cada letra do titulo. */
      projectsPersist();
    } else if (input.dataset.clipField === 'legendaStyle') {
      /* Mesmo tratamento do titleCardStyle: validador (o DOM é entrada) e `projectsPersist`
         porque isto é um CLIQUE deliberado, não uma tecla. */
      clip.legendaStyle = legendaStyleOf({ legendaStyle: input.value });
      projectsPersist();
      /* E aqui, diferente do card, o re-render é OBRIGATÓRIO: o painel manual mostra o valor
         que o AUTOMÁTICO usaria (corpo 58 no clássico, 72 no impacto), e o estilo é quem
         decide esse número. Sem repintar, trocar de estilo deixaria os sliders parados no
         número do estilo anterior — automação mentindo sobre o que vai sair, que é o BP-008
         ao contrário. `renderKeepingScroll` guarda a rolagem e o `srcAdopt` preserva o
         `<video>` da fonte, então o custo é zero para quem está com o player tocando. */
      renderKeepingScroll();
    } else if (input.dataset.clipField === 'reframe') {
      /* Mesmo tratamento do titleCardStyle: validador (o DOM e entrada) e `projectsPersist`
         porque isto e um CLIQUE deliberado, nao uma tecla -- gravar a cada letra martelaria
         o localStorage, e e por isso que o `topic` ao lado NAO persiste. */
      clip.reframe = reframeOf({ reframe: input.value });
      projectsPersist();
    }
  }
  /* --- escrita e atualização no lugar dos controles manuais ---------------------------
     O DOM é ENTRADA: o valor do `<input>` passa pelo `editFieldWrite`, que passa pelo
     `editOf` — nada é gravado cru. `false` significa "o trecho não está mais na lista"
     (a URL trocou no meio do ajuste), e aí não se grava candidato fantasma. */
  function legendaFieldWrite(input, gravar) {
    var clip = findById(YT.candidates, input.dataset.id);
    if (!clip) return false;
    var chave = input.dataset.legField;
    var valor = input.value;
    /* O `value` de um radio é SEMPRE string: 'false' é verdadeiro em JavaScript, e sem esta
       conversão marcar "Caixa baixa" gravaria `caixaAlta: true`. */
    if (chave === 'caixaAlta') valor = valor === 'true';
    else if (['tamanho', 'largura', 'posicaoPct'].indexOf(chave) >= 0) valor = num(valor);
    if (!editFieldWrite(clip, 'legenda', chave, valor)) return false;
    legendaRefresh(clip, gravar);
    return true;
  }
  /* Atualiza a tela NO LUGAR, sem `render()`: re-renderizar destruiria o slider no meio do
     arrasto (parente do BP-001) e recriaria o `<video>` de 2 GB da fonte. Três coisas
     mudam — o marcador de cada linha, a faixa de estado e a prévia.
     Persiste aqui porque `YT.candidates` É `project.candidates` (mesmos objetos), então o
     ajuste volta com o projeto depois de recarregar a página. */
  function legendaRefresh(clip, gravar) {
    var raiz = document.getElementById('video-ops-root');
    if (!raiz) return;
    var painel = null;
    raiz.querySelectorAll('[data-leg]').forEach(function (el) {
      if (el.dataset.leg === clip.id) painel = el;
    });
    if (painel) {
      painel.querySelectorAll('[data-leg-row]').forEach(function (linha) {
        var estado = legendaValor(clip, linha.dataset.legRow);
        linha.dataset.manual = estado.manual ? '1' : '0';
        var botao = linha.querySelector('[data-act="leg-auto"]');
        if (botao) botao.disabled = !estado.manual;
        var saida = linha.querySelector('[data-leg-out]');
        if (saida) {
          saida.textContent = num(estado.valor)
            + (linha.dataset.legRow === 'posicaoPct' ? '%' : 'px');
        }
      });
      var faixa = painel.querySelector('[data-leg-state]');
      var manuais = legendaManuais(clip);
      if (faixa) {
        faixa.dataset.tone = manuais ? 'manual' : 'auto';
        faixa.textContent = manuais
          ? manuais + (manuais > 1 ? ' controles ajustados' : ' controle ajustado')
            + ' à mão — o resto segue o estilo.'
          : 'Tudo automático: a legenda segue o estilo escolhido acima.';
      }
    }
    /* A prévia é substituída inteira: ela não tem estado próprio (nem foco, nem rolagem),
       então reescrevê-la é mais simples e mais barato que sincronizar seis atributos. */
    var velha = raiz.querySelector('[data-leg-prev]');
    if (velha && velha.parentNode) velha.outerHTML = legendaPreviewHTML(clip);
    if (gravar) projectsPersist();
  }
  /* Volta UM controle ao automático. `null` é o gesto de apagar a chave — o `editFieldWrite`
     a remove e o `editOf` reescreve o modelo, então não sobra chave morta no disco.
     Aqui SIM re-renderiza: a linha da posição vertical troca de FORMA (slider <-> botão) e
     os radios precisam voltar a marcar o valor automático. É um CLIQUE deliberado, o
     `renderKeepingScroll` guarda a rolagem (BP-013) e o `srcAdopt` preserva o `<video>` da
     fonte — nem a posição do player se perde. */
  function legendaAuto(clip, chave) {
    if (!editFieldWrite(clip, 'legenda', chave, null)) return false;
    projectsPersist();
    renderKeepingScroll();
    return true;
  }
  function cutFieldWrite(input) {
    var cut = findById(INTAKE.cuts, input.dataset.id);
    if (!cut) return;
    if (input.dataset.cutField === 'name') cut.name = cleanText(input.value, 80);
    else if (input.dataset.cutField === 'priority') cut.priority = priorityOf({ priority: input.value });
    /* Enquadramento: pelo validador, nunca cru. O DOM e entrada. */
    else if (input.dataset.cutField === 'reframe') cut.reframe = reframeOf({ reframe: input.value });
  }
  /* A URL é lida a cada tecla, sem re-render: trocar o innerHTML tiraria o foco do campo.
     Mudar de vídeo derruba as sugestões do vídeo anterior — deixá-las na tela apontando
     para outra URL seria mentira, e a próxima análise as substituiria calada. */
  function ytUrlWrite(input) {
    var proximo = cleanText(input.value, 400);
    if (proximo === YT.url) return;
    YT.url = proximo;
    var id = ytVideoId(proximo);
    if (id !== YT.videoId) {
      YT.videoId = id;
      /* A correcao de legenda pertence ao trecho de UM video. Sem isto ela sobreviveria em
         CAPS e, se um id de candidato se repetisse, o texto de um video seria queimado no
         outro. Pelo mesmo motivo o capDrop tambem fecha o painel. */
      YT.candidates.forEach(function (velho) { capDrop(velho.id); });
      YT.candidates = [];
      YT.note = '';
      YT.title = '';
      YT.state = 'idle';
      /* A FONTE também cai: o player estava tocando o arquivo do vídeo ANTERIOR, e deixá-lo
         na tela sob uma URL nova seria a mentira mais cara desta tela — o operador marcaria
         trechos no vídeo errado. A sequência sobe aqui dentro, então uma importação em voo
         deixa de poder escrever (é o que impede o resultado da URL antiga de substituir o
         vídeo recém-pedido). */
      srcReset();
      /* A declaração é por URL: trocar o vídeo exige declarar de novo, senão a
         autorização de um vídeo cobriria outro em silêncio. */
      YT.authorized = false;
    }
  }
  function onRootChange(event) {
    /* <select> dispara change; o input de nome também cai aqui no blur. Idempotente. */
    if (event.target.matches('[data-res-filter]')) {
      var resApi = resultsAPI();
      if (resApi && resApi.field(event.target)) renderKeepingScroll();
      return;
    }
    if (event.target.matches('[data-cut-field]')) { cutFieldWrite(event.target); return; }
    if (event.target.matches('[data-clip-field]')) { clipFieldWrite(event.target); return; }
    if (event.target.matches('[data-leg-field]')) { legendaFieldWrite(event.target, true); return; }
    if (event.target.matches('[data-cap-field]')) { capCueWrite(event.target); return; }
    if (event.target.matches('[data-intake-input]')) {
      var chosen = event.target.files && event.target.files[0];
      if (chosen) intakeSetFile(chosen);
      return;
    }
    /* O portão de direitos: marcar/desmarcar muda o estado dos botões de baixar, então
       aqui o re-render é o certo — e é barato, a tela é uma lista. */
    if (event.target.matches('[data-yt-rights]')) {
      YT.authorized = !!event.target.checked;
      /* Declarar RELIGA a fonte que já está no disco. É o caminho do projeto reaberto: a
         declaração vale por sessão, então ela não sobrevive ao recarregamento — mas o
         ARQUIVO sobrevive, e a rota de estado só o redescobre, sem baixar um byte. Marcar a
         caixa e ver o vídeo aparecer na hora é o desfecho certo; obrigar a "importar" de
         novo um arquivo que já está lá seria pedir ao operador um clique sem função. */
      if (YT.authorized && !srcReady() && SRC.state !== 'importing') {
        srcRestore(ytVideoId(YT.url));
      }
      renderKeepingScroll();
      return;
    }
    /* Ordem da grade. Pelo validador: o value vem do DOM, e DOM e entrada — chave
       desconhecida cai em `quality`, que e o padrao. */
    if (event.target.matches('[data-yt-sort]')) {
      YT.sort = YT_SORTS.some(function (o) { return o[0] === event.target.value; })
        ? event.target.value : 'quality';
      renderKeepingScroll();
      return;
    }
    if (event.target.matches('[data-yt-url]')) ytUrlWrite(event.target);
  }
  function onRootInput(event) {
    if (event.target.matches('[data-cut-field]')) { cutFieldWrite(event.target); return; }
    if (event.target.matches('[data-clip-field]')) { clipFieldWrite(event.target); return; }
    /* O slider dispara `input` a cada pixel do arrasto: a prévia acompanha em tempo real,
       e o `change` (soltar) é quem GRAVA. Sem os dois, ou a prévia só aparece no fim do
       arrasto, ou o localStorage leva dezenas de escritas por ajuste. */
    if (event.target.matches('[data-leg-field]')) { legendaFieldWrite(event.target, false); return; }
    if (event.target.matches('[data-cap-field]')) { capCueWrite(event.target); return; }
    if (event.target.matches('[data-yt-url]')) ytUrlWrite(event.target);
  }
  /* Esc fecha o menu de baixar. O diálogo de prévia saiu com o iframe, então não há mais
     diálogo para fechar — o player da fonte é parte da tela e não se fecha. */
  function onEscape(event) {
    if (!event || event.key !== 'Escape') return;
    if (!YT.dlMenu) return;
    YT.dlMenu = '';
    renderKeepingScroll();
  }
  function onRootClick(event) {
    var button = event.target.closest('[data-act]');
    if (!button) return;
    var action = button.dataset.act;
    /* Tudo que começa em `res-` é da tela Resultados. O módulo decide o que fazer e só diz
       se precisa repintar — quem repinta é aqui, dono do `#video-ops-root`: dois módulos
       escrevendo no mesmo innerHTML acabariam com um apagando o outro. */
    if (action.indexOf('res-') === 0) {
      var resApi = resultsAPI();
      if (resApi && resApi.act(action, button)) renderKeepingScroll();
      return;
    }
    if (action === 'tab') {
      if (!Object.prototype.hasOwnProperty.call(FLOW_HINT, button.dataset.tab)) return;
      TAB = button.dataset.tab;
      render();
    }
    else if (action === 'open-project') {
      var projectId = button.dataset.projectId;
      if (projectId) openProject(projectId);
      return;
    }
    else if (action === 'yt-import') srcImport(button);
    else if (action === 'yt-probe') ytProbe(button);
    else if (action === 'yt-manual') ytManualClip();
    else if (action === 'yt-fetch') ytFetchClip(button, button.dataset.id);
    else if (action === 'yt-render') ytRenderClip(button, button.dataset.id, 'legenda');
    else if (action === 'yt-render-limpo') ytRenderClip(button, button.dataset.id, 'limpo');
    else if (action === 'yt-mark') {
      var marcar = findById(YT.candidates, button.dataset.id);
      if (!marcar) { toast('Este trecho não está mais na lista.', 'error'); return; }
      var agora = srcNow();
      if (agora === null) {
        toast('O player do vídeo não está na tela — importe o vídeo para marcar por aqui.', 'error');
        return;
      }
      /* Segundo INTEIRO, como todo o resto do intervalo: o nome do arquivo, o /api/video-cut
         e o /api/remotion-render trabalham em inteiro, e fração aqui prometeria uma borda que
         o export não entrega. Piso no começo e teto no fim, os dois ALARGANDO — é a mesma
         regra do `ytclip.candidates`, que nunca come fala. */
      var daqui = button.dataset.edge === 'in' ? Math.floor(agora) : Math.ceil(agora);
      ytTrimResult(marcar,
        button.dataset.edge === 'in' ? daqui : marcar.inSec,
        button.dataset.edge === 'out' ? daqui : marcar.outSec);
    }
    else if (action === 'yt-preview') {
      /* A prévia é um SEEK no player da fonte, não um diálogo: leva o vídeo ao começo do
         trecho e toca. Sem re-render de propósito — reescrever a tela remontaria o player
         que acabou de receber o comando. */
      var espiar = findById(YT.candidates, button.dataset.id);
      if (!espiar) { toast('Este trecho não está mais na lista.', 'error'); return; }
      if (!srcSeek(espiar.inSec, true)) {
        toast(srcReady()
          ? 'O player do vídeo não está na tela.'
          : 'Importe o vídeo para ver a prévia dentro do Estúdio.', 'error');
        return;
      }
      if (YT.dlMenu) { YT.dlMenu = ''; renderKeepingScroll(); }
    }
    else if (action === 'yt-open') {
      var abrir = findById(YT.candidates, button.dataset.id);
      if (!abrir) { toast('Este trecho não está mais na lista.', 'error'); return; }
      /* Guarda a rolagem da GRADE para voltar onde o operador estava — o pedido pede
         posicao de rolagem sensata na volta da edicao (parente do BP-013). */
      YT_GRID_SCROLL = typeof window !== 'undefined' ? Number(window.scrollY) || 0 : 0;
      YT.detail = abrir.id;
      YT.dlMenu = '';
      render();
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
      /* Abrir um trecho POSICIONA o vídeo no começo dele — é o pedido explícito ("the editor
         should seek the video to the suggested starting point"). Sem tocar: quem abre o
         editor vai ajustar a borda, e som começando sozinho atrapalha. Depois do `render()`,
         porque é ele que adota o player na tela. */
      srcSeek(abrir.inSec, false);
      /* As falas DESTE intervalo, se ainda não foram lidas. Uma chamada por trecho aberto, e
         a transcrição inteira nunca entra no navegador. */
      if (srcReady() && !capOf(abrir) && !(abrir.clipCues || []).length) srcCuesLoad(abrir);
    }
    else if (action === 'yt-back') {
      YT.detail = '';
      YT.dlMenu = '';
      render();
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        var voltar = YT_GRID_SCROLL;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { window.scrollTo(0, voltar); });
        else window.scrollTo(0, voltar);
      }
    }
    /* Voltar UM controle ao automático, e assumir a posição vertical à mão. Os dois são
       cliques deliberados numa lista que muda de FORMA, então aqui o re-render é o certo
       (o `srcAdopt` preserva o player e o `renderKeepingScroll` a rolagem). */
    else if (action === 'leg-still') { ytStill(button, button.dataset.id); }
    else if (action === 'leg-auto' || action === 'leg-posicao') {
      var alvoLeg = findById(YT.candidates, button.dataset.id);
      if (!alvoLeg) return;
      if (action === 'leg-auto') legendaAuto(alvoLeg, button.dataset.key);
      else {
        editFieldWrite(alvoLeg, 'legenda', 'posicaoPct', LEGENDA_POSICAO_PARTIDA);
        projectsPersist();
        renderKeepingScroll();
      }
    }
    else if (action === 'yt-dl-menu') {
      YT.dlMenu = YT.dlMenu === button.dataset.id ? '' : button.dataset.id;
      renderKeepingScroll();
    }
    else if (action === 'yt-nudge') {
      var empurrar = findById(YT.candidates, button.dataset.id);
      if (!empurrar) { toast('Este trecho não está mais na lista.', 'error'); return; }
      var passo = Number(button.dataset.delta) || 0;
      var novoIn = empurrar.inSec + (button.dataset.edge === 'in' ? passo : 0);
      var novoOut = empurrar.outSec + (button.dataset.edge === 'out' ? passo : 0);
      ytTrimResult(empurrar, novoIn, novoOut);
    }
    else if (action === 'yt-trim-apply') {
      var ajustar = findById(YT.candidates, button.dataset.id);
      if (!ajustar) { toast('Este trecho não está mais na lista.', 'error'); return; }
      var campoIn = document.querySelector('[data-trim="in"][data-id="' + ajustar.id + '"]');
      var campoOut = document.querySelector('[data-trim="out"][data-id="' + ajustar.id + '"]');
      ytTrimResult(ajustar,
        campoIn ? parseClock(campoIn.value) : ajustar.inSec,
        campoOut ? parseClock(campoOut.value) : ajustar.outSec);
    }
    else if (action === 'yt-clear') {
      YT.candidates = []; YT.note = ''; YT.state = 'idle';
      YT.detail = ''; YT.dlMenu = '';
      /* "Limpar" limpa as SUGESTÕES, não o vídeo importado: ele custou minutos de download e
         continua servindo para marcar trecho à mão. Apagá-lo junto seria o desfecho que o
         pedido proíbe — mexer no corte não pode invalidar o original. */
      render();
    }
    else if (action === 'lib-remove') {
      /* O registro sai; o arquivo em disco fica. Dizer isso na pergunta evita a leitura
         de que "remover" apaga o vídeo. */
      if (!confirm('Remover este clip do histórico? O arquivo no seu computador não é apagado.')) return;
      if (libRemove(button.dataset.id)) { renderKeepingScroll(); toast('Clip removido do histórico. O arquivo continua no seu computador.'); }
    }
    /* Um clique, um arquivo. Sem escolher perfil: o 9:16 do perfil `blur` é o formato de
       postar, e é o único que preserva o quadro inteiro do original. O nome do perfil é
       herdado — desde 2026-08-27 o fundo dele é a cor do preset, não desfoque. */
    else if (action === 'intake-cut-save') {
      var daLista = button.dataset.id ? findById(INTAKE.cuts, button.dataset.id) : null;
      if (button.dataset.id && !daLista) {
        toast('Este corte não está mais na lista.', 'error');
        return;
      }
      var trecho = daLista || { inSec: INTAKE.inSec, outSec: INTAKE.outSec };
      if (!daLista && intakeMarkStatus(INTAKE).tone !== 'ok') {
        toast('Marque um trecho válido na barra antes de salvar.', 'error');
        return;
      }
      /* O título que o operador digitou na linha É o nome do arquivo: é para isso que o
         campo existe no Passo 3. safeName/cutFileName sanitizam e acrescentam o intervalo,
         então dois clips com o mesmo título não se sobrescrevem. */
      var nomeBase = daLista ? cutName(daLista, INTAKE.cuts.indexOf(daLista)) : INTAKE.name;
      var pronto = intakeResolved(trecho.inSec, trecho.outSec, nomeBase);
      if (!pronto) {
        toast('Abra um vídeo nesta aba antes de salvar o corte.', 'error');
        return;
      }
      /* A legenda revisada acompanha o clip: se o operador corrigiu o texto, é ele que
         desce para o render. Sem revisão, o servidor usa o que o YouTube detectou. */
      /* O enquadramento sai da LINHA do corte, nao mais cravado em `blur`. Sem corte na
         lista (trecho marcado direto na barra) cai no padrao, que e o `blur` de sempre. */
      downloadRenderedCut(button, pronto, reframeOf(daLista || {}),
        daLista && capEdited(daLista));
    }
    /* Revisar a legenda: abre o painel do clip (um por vez) e busca as falas na primeira
       abertura. Reabrir não busca de novo — o que está na tela é o que vai ser queimado. */
    else if (action === 'cap-review') {
      var alvoCap = findById(INTAKE.cuts, button.dataset.id);
      if (!alvoCap) { toast('Este corte não está mais na lista.', 'error'); return; }
      if (CAPS_OPEN === alvoCap.id) { CAPS_OPEN = ''; renderKeepingScroll(); return; }
      CAPS_OPEN = alvoCap.id;
      if (capOf(alvoCap)) renderKeepingScroll();
      else capLoad(alvoCap);
    }
    else if (action === 'yt-cap') {
      var clipCap = findById(YT.candidates, button.dataset.id);
      if (!clipCap) { toast('Este trecho não está mais na lista.', 'error'); return; }
      if (CAPS_OPEN === clipCap.id) { CAPS_OPEN = ''; renderKeepingScroll(); return; }
      CAPS_OPEN = clipCap.id;
      /* Semeia da sessao, sem rede: as falas ja vieram no probe. */
      if (!capOf(clipCap)) capSeed(clipCap);
      renderKeepingScroll();
    }
    else if (action === 'cap-restore') {
      var voltaCap = capTarget(button.dataset.id);
      if (voltaCap) capRestore(voltaCap, button.closest('[data-cap-panel]'));
    }
    else if (action === 'rec-play' || action === 'rec-use') {
      var recPanel = intakePanel();
      if (recPanel) {
        mrAction(recPanel, recPanel.querySelector('[data-intake-video]'),
          action.replace('rec-', ''), button.dataset.rank);
      }
    }
    else if (action === 'intake-cut-add' || action === 'intake-cut-play'
      || action === 'intake-cut-edit' || action === 'intake-cut-remove') {
      /* Delegação na raiz: a lista é reescrita por innerHTML, então ouvinte preso a cada
         botão morreria no primeiro refresh. Botões explícitos, nunca dblclick (BP-001). */
      var cutPanel = intakePanel();
      if (cutPanel) {
        intakeCutAction(cutPanel, cutPanel.querySelector('[data-intake-video]'),
          action.replace('intake-cut-', ''), button.dataset.id);
      }
    }
    else if (action === 'download-raw') { download('video-ops-recuperacao-' + localDay() + '.json', BROKEN_RAW, 'application/json'); toast('Cópia bruta baixada.'); }
    else if (action === 'reset-broken') {
      if (!confirm('Começar de novo? Baixe os dados brutos antes; esta ação substitui o histórico local que não pôde ser lido. Nenhum arquivo de vídeo é apagado.')) return;
      try { localStorage.removeItem(KEY); } catch (e) { toast('Não foi possível limpar o armazenamento local.', 'error'); return; }
      BROKEN_RAW = '';
      LIB = libSeed();
      libPersist();
      render();
      toast('Histórico reiniciado.');
    }
  }
  function init() {
    var root = document.getElementById('video-ops-root');
    if (!root) return;
    LIB = libLoad();
    PROJECTS = projectsLoad();
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
    root.addEventListener('input', onRootInput);
    root.addEventListener('pointerdown', onRootPointerDown);
    /* Esc fecha a prévia e o menu de baixar. No DOCUMENTO e não na raiz: o foco pode estar
       dentro do iframe do YouTube, e aí a tecla nunca chegaria a um ouvinte da raiz.
       Diálogo sem Esc é armadilha de teclado — sair dele exigiria achar o botão. */
    if (document.addEventListener) document.addEventListener('keydown', onEscape);
    /* O vídeo do primeiro contato é da sessão: a URL temporária morre ao sair da página. */
    if (window.addEventListener) window.addEventListener('pagehide', intakeRelease);
    render();
    window.videoOpsRefresh = render;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      libEntry: libEntry,
      libSanitize: libSanitize,
      libGroups: libGroups,
      savedClipUrl: savedClipUrl,
      ytVideoId: ytVideoId,
      ytFetchGate: ytFetchGate,
      ytCandidateClips: ytCandidateClips,
      ytMostReplayedFrom: ytMostReplayedFrom,
      mrRecsFrom: mrRecsFrom,
      mrIntensityLabel: mrIntensityLabel,
      mrBandsHTML: mrBandsHTML,
      mrListHTML: mrListHTML,
      mrSelectionFrom: mrSelectionFrom,
      mrCaptionsFrom: mrCaptionsFrom,
      mrCaptionsLabel: mrCaptionsLabel,
      captionsMessage: captionsMessage,
      renderEta: renderEta,
      renderBody: renderBody,
      clipFieldWrite: clipFieldWrite,
      /* Semeia YT.candidates para o teste exercitar a edicao de titulo sem DOM e sem rede.
         Prefixo `__` porque e porta de teste, nao API da tela: o `YT` e estado de SESSAO e
         nao tem outro jeito de ser alcancado de fora. */
      __setCandidates: function (lista) { YT.candidates = lista || []; },
      /* O hub, exportado para os testes. `ytApplyTrim` e `clipBoundaryChanged` mexem em
         dado PERSISTIDO (o candidato do projeto salvo), entao BP-014 manda que o teste as
         chame com o trecho construido, nos dois ramos: com arquivo baixado e sem. */
      ytApplyTrim: ytApplyTrim,
      clipStatusOf: clipStatusOf,
      /* A fonte importada. `srcApply` é a fronteira de ENTRADA da importação e a dona das
         guardas de corrida — BP-014 manda que ela seja exportada e chamada pelo teste com o
         payload construído, nos DOIS ramos (resposta do vídeo pedido × resposta de outro
         vídeo), porque o ramo que quebra é justamente o de quem trocou a URL no meio. */
      srcApply: srcApply,
      srcReady: srcReady,
      srcReset: srcReset,
      srcCuesLoad: srcCuesLoad,
      srcPanelHTML: srcPanelHTML,
      srcStripHTML: srcStripHTML,
      IMPORT_STATES: IMPORT_STATES,
      IMPORT_STAGES: IMPORT_STAGES,
      IMPORT_MSG: IMPORT_MSG,
      IMPORT_STAGE_MSG: IMPORT_STAGE_MSG,
      /* Porta de teste, não API da tela (prefixo `__`): SRC é estado de SESSÃO e não tem
         outro jeito de ser alcançado de fora. */
      __srcState: function () { return SRC; },
      /* A sequência da importação em curso. Sem ela o teste só conseguiria provar o ramo que
         DESCARTA (sequência velha), e o ramo que aplica ficaria sem cobertura — é a metade
         que o BP-014 diz que quebra calada. */
      __srcSeq: function () { return SRC_SEQ; },
      __setSource: function (dados) {
        Object.keys(dados || {}).forEach(function (k) { SRC[k] = dados[k]; });
        return SRC;
      },
      ytStoryboardFrom: ytStoryboardFrom,
      __setStoryboard: function (sb) { YT.storyboard = sb || null; },
      __setSort: function (v) { YT.sort = v; },
      __setDuration: function (v) { YT.duration = num(v); },
      __ytState: function () { return YT; },
      sbFrame: sbFrame,
      ytSorted: ytSorted,
      onEscape: onEscape,
      ytCandidateCardHTML: ytCandidateCardHTML,
      ytDetailHTML: ytDetailHTML,
      ytStepHTML: ytStepHTML,
      capMessage: capMessage,
      capCuesFrom: capCuesFrom,
      capClock: capClock,
      capHTML: capHTML,
      signalLabel: signalLabel,
      markIssues: markIssues,
      markStatus: markStatus,
      fmtClock: fmtClock,
      parseClock: parseClock,
      clockField: clockField,
      intakeStatus: intakeStatus,
      intakeMarkStatus: intakeMarkStatus,
      intakeCutDuplicate: intakeCutDuplicate,
      ffmpegCutCommand: ffmpegCutCommand,
      cutFileName: cutFileName,
      isVideoFile: isVideoFile,
      fmtBytes: fmtBytes,
      safeName: safeName,
      trackRatio: trackRatio,
      priorityOf: priorityOf,
      projectsSanitize: projectsSanitize,
      /* O validador da identidade do card e as duas listas. Exportados para o teste CHAMAR
         a funcao com um trecho construido, e para ele comparar as copias com o preset.js --
         asserir o TEXTO do arquivo so provaria que alguem escreveu a palavra. */
      titleCardStyleOf: titleCardStyleOf,
    /* O conjunto de enquadramento e as contas dele. Exportados porque a paridade com o
       `preset.js` e com o `worker.py` e cobrada por check, e porque `sourceScale` e
       `cropInsetPct` sao aritmetica que tem de ser exercitada com valor construido -- nao
       basta provar que a palavra esta no arquivo. */
    REFRAMES: REFRAMES,
    REFRAME_PADRAO: REFRAME_PADRAO,
    REFRAMES_OFERECIDOS: REFRAMES_OFERECIDOS,
    REFRAME_LABELS: REFRAME_LABELS,
    reframeOf: reframeOf,
    cropInsetPct: cropInsetPct,
    sourceScale: sourceScale,
    sourceWarning: sourceWarning,
    ESCALA_MOLE: ESCALA_MOLE,
    audioMessage: audioMessage,
    backgroundMessage: backgroundMessage,
      TITLE_CARD_STYLES: TITLE_CARD_STYLES,
      TITLE_CARD_PADRAO: TITLE_CARD_PADRAO,
      TITLE_CARD_LABELS: TITLE_CARD_LABELS,
      /* O validador do estilo de legenda e as listas dele, pela mesma razão do card: o
         teste CHAMA a função com um trecho construído e compara as cópias com o preset.js. */
      legendaStyleOf: legendaStyleOf,
      editOf: editOf,
      editFieldWrite: editFieldWrite,
      /* O painel manual: o teste CHAMA estas funcoes com um trecho construido, em vez de
         asserir o texto do arquivo -- `in arquivo` so prova que alguem escreveu a palavra. */
      legendaValor: legendaValor,
      legendaManuais: legendaManuais,
      legendaPanelHTML: legendaPanelHTML,
      legendaPreviewHTML: legendaPreviewHTML,
      LEGENDA_AUTO: LEGENDA_AUTO,
      LEGENDA_AUTO_COMUM: LEGENDA_AUTO_COMUM,
      LEGENDA_COR_HEX: LEGENDA_COR_HEX,
      ASS_NAO_REPRODUZ: ASS_NAO_REPRODUZ,
      LEGENDA_FONTES: LEGENDA_FONTES,
      LEGENDA_CORES: LEGENDA_CORES,
      LEGENDA_ALINHAMENTOS: LEGENDA_ALINHAMENTOS,
      LEGENDA_STYLES: LEGENDA_STYLES,
      LEGENDA_PADRAO: LEGENDA_PADRAO,
      LEGENDA_LABELS: LEGENDA_LABELS,
      LIB_VERSION: LIB_VERSION,
      MAX_CANDIDATES: MAX_CANDIDATES,
      KEY: KEY
    };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
