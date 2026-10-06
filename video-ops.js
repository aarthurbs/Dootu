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
     (`video-worker/ytclip.py`, MAX_CANDIDATES = 20 desde 2026-10-06; o check LÊ o .py):
     dois valores diferentes fariam a tela
     descartar calada sugestão que o servidor mandou. Estava sendo USADA no
     `projectsSanitize` sem existir aqui — e como a linha só é avaliada quando o projeto tem
     `candidates`, o `init` inteiro morria e a tela ficava preta só para quem já tinha
     analisado um vídeo. */
  var MAX_CANDIDATES = 20;

  /* --- identidade do card de título ---------------------------------------------------
     ESPELHO do `studio/src/preset.js` (`TITLE_CARD_STYLES`/`TITLE_CARD_PADRAO`). Não é
     import: o `index.html` é Vanilla JS sem npm e sem módulos, e o preset.js é ESM do
     projeto Remotion — a mesma razão pela qual o `captions.py` copia os números da
     tipografia em vez de importá-los.
     Copiar exige guarda, e ela existe: o `test-video-ops.js` LÊ o preset.js e compara as
     duas listas e os dois padrões, e o `test_serve.py` compara as TRÊS cópias.
     O conjunto diz só isto: "tem card" ou "sem card". QUAL card é DADO — a biblioteca é do
     operador e mora aqui no navegador (`pp_video_cards_v1`), e o servidor nunca conhece um
     id de card: ele recebe o objeto resolvido e o valida. */
  var TITLE_CARD_STYLES = ['personalizado', 'nenhum'];
  var TITLE_CARD_PADRAO = 'personalizado';
  var TITLE_CARD_SEM = 'nenhum';
  /* O rótulo da tela nunca é a chave da lógica. `nenhum` = sem card no vídeo, guardando o
     título — que também nomeia o arquivo baixado e o cartão da Central. */
  var TITLE_CARD_LABELS = {
    personalizado: 'Card da biblioteca', nenhum: 'Sem card'
  };
  /* O validador. Trecho antigo (salvo antes desta entrega, com o valor de uma identidade que
     saiu do projeto) e valor torto caem no padrão — que é "tem card", nunca "sem card":
     apagar o card calado de quem nunca escolheu nada seria pior que mostrá-lo. */
  function titleCardStyleOf(clip) {
    var valor = clip && clip.titleCardStyle;
    return TITLE_CARD_STYLES.indexOf(valor) >= 0 ? valor : TITLE_CARD_PADRAO;
  }

  /* --- o CARD em si: espelho do `cardOf` do preset.js ---------------------------------
     Terceira cópia do validador (o `preset.js` é o dono, o `serve.py` é a do servidor), pela
     razão de sempre: não há import possível entre um ES module, esta página e um servidor
     stdlib. Os NÚMEROS que decidem o que passa têm check de paridade lendo o preset.js —
     divergirem faria a tela deixar o operador escolher algo que o servidor descarta calado. */
  var CARD_PESOS = [600, 700, 800, 900];
  var CARD_LOGO_MAX = 512 * 1024;
  var CARD_LOGO_PADRAO = /^data:image\/(png|svg\+xml|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/;
  var CARD_NOME_MAX = 40;
  var CARD_IDENTIFICADOR_MAX = 60;
  var CARD_PROPORCAO_MIN = 0.05;
  var CARD_PROPORCAO_MAX = 20;
  var CARD_COR_PADRAO = /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$|^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;
  var CARD_PADROES = {
    fileteCor: '#FFFFFF',
    bordaCor: 'rgba(255, 255, 255, .14)',
    identificadorCor: 'rgba(255, 255, 255, .72)',
    destaqueCor: '#D9A441',
    tituloPeso: 900,
    destaquePeso: 900,
    destaqueSublinhado: false
  };
  function corDoCard(valor, padrao) {
    if (typeof valor !== 'string') return padrao;
    var limpo = valor.trim();
    return CARD_COR_PADRAO.test(limpo) ? limpo : padrao;
  }
  function pesoDoCard(valor, padrao) {
    var n = Number(valor);
    return CARD_PESOS.indexOf(n) >= 0 ? n : padrao;
  }
  /* Objeto qualquer -> card completo, ou `null`. PURA e nunca levanta.
     `null` é desfecho LEGÍTIMO em dois casos, e os dois estão escritos na tela: o operador
     escolheu "Sem card", ou o card que o corte apontava foi apagado da biblioteca. Nunca se
     cai em OUTRO card — herdar a identidade de um vizinho seria o pior desfecho possível,
     porque nada na tela erraria.
     Card sem logo E sem identificador é INVÁLIDO: não sobra identidade para vestir o título,
     e a placa viraria um retângulo com uma manchete dentro. */
  function cardOf(valor) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    var logo = typeof valor.logo === 'string'
      && valor.logo.length <= CARD_LOGO_MAX
      && CARD_LOGO_PADRAO.test(valor.logo)
      ? valor.logo : '';
    var identificador = typeof valor.identificador === 'string'
      ? valor.identificador.trim().slice(0, CARD_IDENTIFICADOR_MAX) : '';
    if (!logo && !identificador) return null;
    var proporcao = Number(valor.logoProporcao);
    return {
      id: typeof valor.id === 'string' ? valor.id.slice(0, 64) : '',
      nome: typeof valor.nome === 'string' ? valor.nome.trim().slice(0, CARD_NOME_MAX) : '',
      identificador: identificador,
      logo: logo,
      logoProporcao: isFinite(proporcao)
        && proporcao >= CARD_PROPORCAO_MIN && proporcao <= CARD_PROPORCAO_MAX
        ? proporcao : 1,
      fileteCor: corDoCard(valor.fileteCor, CARD_PADROES.fileteCor),
      bordaCor: corDoCard(valor.bordaCor, CARD_PADROES.bordaCor),
      identificadorCor: corDoCard(valor.identificadorCor, CARD_PADROES.identificadorCor),
      destaqueCor: corDoCard(valor.destaqueCor, CARD_PADROES.destaqueCor),
      tituloPeso: pesoDoCard(valor.tituloPeso, CARD_PADROES.tituloPeso),
      destaquePeso: pesoDoCard(valor.destaquePeso, CARD_PADROES.destaquePeso),
      destaqueSublinhado: valor.destaqueSublinhado === true
    };
  }

  /* --- a BIBLIOTECA -------------------------------------------------------------------
     Chave PRÓPRIA e global (não por projeto): um card é do canal, não de um vídeo. Guarda só
     o que o operador ESCOLHEU — campo ausente significa "segue o padrão", exatamente como o
     `edit` da legenda. É isso que faz o botão "auto" de cada linha ter o que desfazer, e é
     isso que permite o padrão do projeto mudar sem reescrever a biblioteca de ninguém. */
  var CARDS_KEY = 'pp_video_cards_v1';
  var CARDS_VERSION = 1;
  var CARDS = null;
  /* Estado de SESSÃO do editor: painel aberto, card em edição, card esperando confirmação
     de exclusão, e a última frase do editor. Nada disto vai para o disco. */
  var CARDS_OPEN = false;
  var CARD_EDIT = '';
  var CARD_DEL = '';
  var CARD_MSG = '';
  /* A última escrita na biblioteca foi RECUSADA (cota, logo, arquivo): o painel acende
     `aria-invalid` até a próxima ação (editor sem frase, decisão do usuário, 2026-10-01). */
  var CARD_FALHA = false;

  function cardsSeed() { return { v: CARDS_VERSION, cards: [] }; }
  /* Dado PERSISTIDO passa por aqui antes de virar estado (BP-014). Card sem id e card sem
     identidade não entram: o primeiro não pode ser apontado por corte nenhum, e o segundo
     não tem o que vestir. */
  function cardsSanitize(data) {
    if (!data || !Array.isArray(data.cards)) return null;
    var out = { v: CARDS_VERSION, cards: [] };
    for (var i = 0; i < data.cards.length; i++) {
      var c = data.cards[i];
      if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
      if (typeof c.id !== 'string' || !c.id) continue;
      if (!cardOf(c)) continue;
      out.cards.push(c);
    }
    return out;
  }
  function cardsLoad() {
    var raw = null;
    try { raw = localStorage.getItem(CARDS_KEY); } catch (e) { raw = null; }
    if (!raw) return cardsSeed();
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    return cardsSanitize(parsed) || cardsSeed();
  }
  /* Gravação que FALHA tem de falar. A cota do `localStorage` é o limite real desta
     biblioteca (um logo é um dataURL), e uma escrita que some calada perde o trabalho do
     operador — é o BP-008 no caso mais caro dele. Quem chama devolve a frase para a tela. */
  function cardsPersist() {
    if (!CARDS) return false;
    try {
      localStorage.setItem(CARDS_KEY, JSON.stringify(CARDS));
      return true;
    } catch (e) {
      console.warn('[video-ops] cards localStorage:', e);
      return false;
    }
  }
  function cardsList() { return CARDS ? CARDS.cards : []; }
  function cardFind(id) {
    if (!id) return null;
    var lista = cardsList();
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }
  /* Nunca reaproveitado: o id de um card apagado não pode voltar e fazer um corte órfão
     apontar para um card novo sem ninguém pedir. */
  function cardNovoId() {
    return 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }
  /* Nasce VÁLIDO (com identificador), porque um card inválido não poderia ser salvo — e um
     editor que abre num estado que ele mesmo recusa é o pior primeiro contato possível. */
  function cardCreate() {
    if (!CARDS) return null;
    var card = {
      id: cardNovoId(),
      nome: 'Card ' + (CARDS.cards.length + 1),
      identificador: 'MEU CANAL'
    };
    CARDS.cards.push(card);
    cardsPersist();
    return card;
  }
  function cardDuplicate(id) {
    var orig = cardFind(id);
    if (!orig || !CARDS) return null;
    var copia = JSON.parse(JSON.stringify(orig));
    copia.id = cardNovoId();
    copia.nome = ((orig.nome || 'Card') + ' (cópia)').slice(0, CARD_NOME_MAX);
    CARDS.cards.push(copia);
    cardsPersist();
    return copia;
  }
  /* Apagar um card NÃO mexe em corte nenhum, de propósito: reescrever os cortes que
     apontavam para ele trocaria a identidade de vídeo antigo sem ninguém pedir. Eles ficam
     órfãos, saem SEM card, e a tela diz isso no painel do corte (BP-008). */
  function cardRemove(id) {
    if (!CARDS) return false;
    var antes = CARDS.cards.length;
    CARDS.cards = CARDS.cards.filter(function (c) { return c.id !== id; });
    if (CARDS.cards.length === antes) return false;
    cardsPersist();
    return true;
  }
  /* Escreve UM campo. `null` volta ao padrão (apaga a chave). Devolve '' quando gravou e a
     FRASE do motivo quando recusou — recusa muda é indistinguível de recurso quebrado.
     `gravar: false` muda só a memória, e existe pela mesma razão do slider da legenda: o
     campo de texto dispara `input` a cada tecla, e um logo é um dataURL — gravar a cada
     letra reescreveria a biblioteca inteira dezenas de vezes por palavra. Quem GRAVA é o
     `change` (sair do campo), e é ele que reporta a cota cheia. */
  function cardFieldWrite(id, campo, valor, gravar) {
    var card = cardFind(id);
    if (!card) return 'Este card não está mais na biblioteca.';
    var tinha = Object.prototype.hasOwnProperty.call(card, campo);
    var antes = card[campo];
    if (valor === null) delete card[campo];
    else card[campo] = valor;
    if (!cardOf(card)) {
      if (tinha) card[campo] = antes; else delete card[campo];
      return 'Um card precisa de logo OU de texto ao lado — sem os dois não sobra identidade para vestir o título.';
    }
    if (gravar === false) return '';
    return cardsPersist() ? ''
      : 'Não consegui salvar: a biblioteca está cheia. Remova um logo grande ou um card antes de continuar.';
  }
  /* O logo e a proporção são gravados JUNTOS: proporção sem logo é número órfão, e logo sem
     proporção medida seria a distorção que o card existe para evitar. */
  function cardLogoWrite(id, logo, proporcao) {
    var card = cardFind(id);
    if (!card) return 'Este card não está mais na biblioteca.';
    if (logo) {
      if (String(logo).length > CARD_LOGO_MAX) {
        return 'Este arquivo passa de 512 KB. Exporte o logo menor — no vídeo a placa aparece com 62 px de altura.';
      }
      if (!CARD_LOGO_PADRAO.test(String(logo))) {
        return 'Formato não aceito. Use PNG, SVG, JPEG ou WEBP.';
      }
      if (!(isFinite(proporcao) && proporcao >= CARD_PROPORCAO_MIN
        && proporcao <= CARD_PROPORCAO_MAX)) {
        return 'Não consegui medir a proporção deste arquivo, e proporção chutada distorce o logo.';
      }
    }
    var tinhaLogo = Object.prototype.hasOwnProperty.call(card, 'logo');
    var antesLogo = card.logo;
    var antesProp = card.logoProporcao;
    if (logo) { card.logo = logo; card.logoProporcao = proporcao; }
    else { delete card.logo; delete card.logoProporcao; }
    if (!cardOf(card)) {
      if (tinhaLogo) { card.logo = antesLogo; card.logoProporcao = antesProp; }
      return 'Sem logo, este card precisa de um texto ao lado — senão não sobra identidade para vestir o título.';
    }
    return cardsPersist() ? ''
      : 'Não consegui salvar: a biblioteca está cheia. Remova um logo grande ou um card antes de continuar.';
  }

  /* --- o card de UM corte -------------------------------------------------------------- */
  function cardIdOf(clip) {
    var v = clip && clip.cardId;
    return typeof v === 'string' ? v.slice(0, 64) : '';
  }
  /* O card RESOLVIDO deste corte, ou `null`. É isto que sobe no corpo do POST — o OBJETO e
     não o id, de propósito: o servidor não tem biblioteca para consultar. */
  function cardDoClip(clip) {
    if (titleCardStyleOf(clip) === TITLE_CARD_SEM) return null;
    return cardOf(cardFind(cardIdOf(clip)));
  }
  /* O estado do seletor, numa frase. TODO ramo fala, inclusive os que NÃO agem (BP-008):
     automação muda é indistinguível de automação quebrada, e aqui o pior ramo — o card
     apagado — é justamente o mais silencioso se ninguém o escrever. PURA. */
  function cardPickState(clip) {
    if (titleCardStyleOf(clip) === TITLE_CARD_SEM) {
      return { tone: 'ok', msg: 'Sem card: o vídeo sai só com a legenda. O título continua nomeando o arquivo e o cartão da Central.' };
    }
    var id = cardIdOf(clip);
    var card = cardFind(id);
    if (card) return { tone: 'ok', msg: 'Este corte veste "' + cardRotulo(card) + '".' };
    if (id) {
      return { tone: 'warn', msg: 'O card deste corte foi apagado da biblioteca: ele vai sair SEM card. Escolha outro acima.' };
    }
    if (!cardsList().length) {
      return { tone: 'warn', msg: 'Sua biblioteca está vazia, então este corte sai sem card. Crie um card para vestir o título.' };
    }
    return { tone: 'warn', msg: 'Nenhum card escolhido — este corte vai sair sem card.' };
  }
  function cardRotulo(card) {
    return (card && (card.nome || card.identificador)) || 'Card sem nome';
  }
  /* O que o controle MOSTRA: o valor escolhido quando existe, senão o padrão do projeto.
     `manual` é o que acende o marcador da linha — valor padrão e valor escolhido nunca podem
     parecer a mesma coisa (BP-008). PURA: o teste chama com um card construído. */
  function cardValor(card, chave) {
    var manual = !!card && Object.prototype.hasOwnProperty.call(card, chave);
    var resolvido = cardOf(card);
    return {
      valor: resolvido ? resolvido[chave] : CARD_PADROES[chave],
      manual: manual
    };
  }
  /* Proporção de um SVG que não declara largura/altura intrínsecas (o navegador reporta 0
     nesses). Sem `viewBox` o arquivo é RECUSADO em vez de receber uma proporção chutada —
     chute distorce, e num emblema circular vira elipse. PURA. */
  function svgViewBoxRatio(dataUrl) {
    var prefixo = 'data:image/svg+xml;base64,';
    if (typeof dataUrl !== 'string' || dataUrl.indexOf(prefixo) !== 0) return 0;
    var texto = '';
    try { texto = atob(dataUrl.slice(prefixo.length)); } catch (e) { return 0; }
    var m = /viewBox\s*=\s*"([^"]+)"/i.exec(texto) || /viewBox\s*=\s*'([^']+)'/i.exec(texto);
    if (!m) return 0;
    var n = m[1].trim().split(/[\s,]+/).map(Number);
    if (n.length < 4 || !isFinite(n[2]) || !isFinite(n[3]) || n[2] <= 0 || n[3] <= 0) return 0;
    return n[2] / n[3];
  }
  /* O nome do peso ao lado do numero: "900" sozinho nao diz nada a quem nao desenha. */
  var CARD_PESO_LABELS = {
    600: '(SemiBold)', 700: '(Bold)', 800: '(ExtraBold)', 900: '(Black)'
  };

  /* --- estilo da legenda --------------------------------------------------------------
     Mesmo espelho, mesma razão e mesma guarda do card acima: o dono é o
     `studio/src/preset.js` (`LEGENDA_STYLES`/`LEGENDA_PADRAO`), e o `test-video-ops.js` LÊ
     o preset.js para comparar as duas listas e os dois padrões.
     Aqui NÃO existe o "nenhum" do card: legenda desligada já é o preset `limpo` do botão de
     render, e um segundo jeito de desligar a mesma coisa seria dois donos para a decisão. */
  var LEGENDA_STYLES = ['classico', 'impacto', 'faixa', 'podcast', 'papel', 'discreta'];
  var LEGENDA_PADRAO = 'classico';
  /* O rótulo da tela nunca é a chave da lógica. */
  var LEGENDA_LABELS = {
    classico: 'Clássica', impacto: 'Impacto', faixa: 'Faixa escura',
    podcast: 'Contorno', papel: 'Papel', discreta: 'Discreta'
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
  var LEGENDA_SEM = 'nenhum';
  /* Espelho do `corLegendaOf` do preset.js: token antigo, `#RRGGBB` (em maiúsculas) ou,
     só para contorno e caixa, `nenhum`. */
  function corLegendaOf(valor, semOk) {
    if (typeof valor !== 'string') return undefined;
    if (LEGENDA_CORES.indexOf(valor) >= 0) return valor;
    if (semOk && valor === LEGENDA_SEM) return valor;
    return /^#[0-9A-Fa-f]{6}$/.test(valor) ? valor.toUpperCase() : undefined;
  }
  function editOf(clip) {
    var out = { v: 1, legenda: {}, enquadramento: {} };
    var edit = clip && clip.edit;
    if (!edit || edit.v !== 1 || Array.isArray(edit)) return out;
    var legenda = edit.legenda;
    if (legenda && typeof legenda === 'object' && !Array.isArray(legenda)) {
      var sets = { style: LEGENDA_STYLES, familia: LEGENDA_FONTES,
        alinhamento: LEGENDA_ALINHAMENTOS, profundidade: Object.keys(LEGENDA_PROFUNDIDADES),
        profundidadeDirecao: Object.keys(LEGENDA_PROFUNDIDADE_DIRECOES) };
      Object.keys(sets).forEach(function (key) {
        if (sets[key].indexOf(legenda[key]) >= 0) out.legenda[key] = legenda[key];
      });
      ['cor', 'destaqueCor', 'contorno', 'fundo'].forEach(function (key) {
        var cor = corLegendaOf(legenda[key], key === 'contorno' || key === 'fundo');
        if (cor !== undefined) out.legenda[key] = cor;
      });
      if (typeof legenda.caixaAlta === 'boolean') out.legenda.caixaAlta = legenda.caixaAlta;
      var ranges = { tamanho: [32, 96], largura: [360, 1000], posicaoPct: [0, 100], posicaoXPct: [0, 100] };
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
    /* Música de fundo (2026-09-30): espelho do `musicaOf` do preset.js. */
    var musica = musicaOf(edit.musica);
    if (musica) out.musica = musica;
    /* Remoções (2026-09-30): espelho do `remocoesOf` do preset.js (só a forma). */
    var remocoes = remocoesOf(edit.remocoes);
    if (remocoes.length) out.remocoes = remocoes;
    var textos = textosOf(edit.textos);
    if (textos.length) out.textos = textos;
    var zooms = zoomsOf(edit.zooms);
    if (zooms.length) out.zooms = zooms;
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

  /* --- painel da LEGENDA (refeito em 2026-09-23, pedido do operador) ------------------
     O que mudou foi a ORGANIZAÇÃO, não o modelo: o operador escolhe um estilo PRONTO pela
     aparência, e ajusta por cima dele o que mais importa — tamanho, cores e posição — com o
     resto recolhido em "Ajustes avançados". O dado continua o mesmo `clip.edit.legenda`,
     validado pelo `editOf`, e clip salvo antes disto abre e exporta idêntico.

     `LEGENDA_AUTO` é o que cada estilo dá SOZINHO, e existe por causa do BP-008: um slider
     parado em 58 enquanto o estilo é `impacto` (72) mentiria sobre o que vai sair, e
     encostar nele pularia 14 px que ninguém pediu. Espelho do `LEGENDA_PRESETS` do
     preset.js — o `test-video-ops.js` importa o preset e compara campo a campo.
     `destaqueCor: null` = o LEQUE colorido da palavra sendo dita (clássica e impacto). */
  var LEGENDA_AUTO = {
    classico: { familia: 'inter', tamanho: 58, caixaAlta: false, peso: 700, entrelinha: 1.18,
      cor: '#FFFFFF', destaqueCor: null, contorno: 'nenhum', fundo: 'nenhum', sombra: true },
    impacto: { familia: 'montserrat', tamanho: 72, caixaAlta: true, peso: 800, entrelinha: 1.1,
      cor: '#FFFFFF', destaqueCor: null, contorno: 'nenhum', fundo: 'nenhum', sombra: true },
    faixa: { familia: 'inter', tamanho: 54, caixaAlta: false, peso: 700, entrelinha: 1.3,
      cor: '#FFFFFF', destaqueCor: '#FFD23F', contorno: 'nenhum', fundo: '#0E0E10', sombra: false },
    podcast: { familia: 'montserrat', tamanho: 66, caixaAlta: true, peso: 800, entrelinha: 1.1,
      cor: '#FFFFFF', destaqueCor: '#FFD23F', contorno: '#000000', fundo: 'nenhum', sombra: true },
    papel: { familia: 'inter', tamanho: 56, caixaAlta: false, peso: 800, entrelinha: 1.3,
      cor: '#141414', destaqueCor: '#D62839', contorno: 'nenhum', fundo: '#FFFFFF', sombra: false },
    discreta: { familia: 'inter', tamanho: 48, caixaAlta: false, peso: 700, entrelinha: 1.2,
      cor: '#F5F1E8', destaqueCor: '#F2C14E', contorno: 'nenhum', fundo: 'nenhum', sombra: true }
  };
  /* Os que não dependem do estilo: todos têm a MESMA coluna e o mesmo alinhamento.
     `posicaoPct` é `null` porque a âncora automática é calculada em Python
     (`captions.margem_inferior`) a partir do enquadramento — e uma fórmula equivalente
     aqui é justamente o defeito que aquela função existe para impedir. */
  var LEGENDA_AUTO_COMUM = { largura: 820, alinhamento: 'center', posicaoPct: null,
    posicaoXPct: null, profundidade: 'nenhuma', profundidadeDirecao: 'tras' };
  /* O leque do `TOKENS.palavraCores`: a amostra "Colorido" e a 1ª palavra da prévia. */
  var LEGENDA_LEQUE = ['#FFE600', '#00E9FF', '#FF4FD1', '#8CFF1A', '#B14BFF'];
  /* "Ajustar à mão" parte da âncora AUTOMÁTICA REAL do corte (2026-09-25): o percentual
     vem pronto do servidor (`posicaoAutoPct` do `/api/legenda-geometria`), então a legenda
     não pula ao passar para o manual e nenhuma fórmula do Python mora aqui. O antigo 75 fixo
     jogava a base 225 px para FORA do vídeo no enquadramento padrão. */
  /* PROFUNDIDADE: espelho LITERAL do `LEGENDA_PROFUNDIDADES` do preset.js (o dono). O
     test-video-ops.js importa o preset.js e compara os dois objetos. */
  var LEGENDA_PROFUNDIDADES = {
    suave: { inclinacao: 16, giro: 16, perspectiva: 1800, camadas: 4, passo: 1.5, tinta: 35 },
    funda: { inclinacao: 32, giro: 12, perspectiva: 700, camadas: 7, passo: 1.25, tinta: 35 }
  };
  /* ÂNGULO (2026-09-29): espelho LITERAL do `LEGENDA_PROFUNDIDADE_DIRECOES` e do
     `LEGENDA_PROFUNDIDADE_DIAGONAL` do preset.js (o test-video-ops.js compara). */
  var LEGENDA_PROFUNDIDADE_DIRECOES = {
    tras: { origem: '50% 100%', x: 0, y: 1 },
    frente: { origem: '50% 0%', x: 0, y: -1 },
    esquerda: { origem: '100% 100%', x: -1, y: 0 },
    direita: { origem: '0% 100%', x: 1, y: 0 },
    'tras-esquerda': { origem: '100% 100%', x: -1, y: 1 },
    'tras-direita': { origem: '0% 100%', x: 1, y: 1 },
    'frente-esquerda': { origem: '100% 0%', x: -1, y: -1 },
    'frente-direita': { origem: '0% 0%', x: 1, y: -1 }
  };
  var LEGENDA_PROFUNDIDADE_DIAGONAL = 0.75;
  var LEGENDA_PROFUNDIDADE_LABELS = [['nenhuma', 'Nenhuma'], ['suave', 'Suave'], ['funda', 'Funda']];
  var LEGENDA_PROFUNDIDADE_DIRECAO_LABELS = { tras: 'Para trás', frente: 'Para frente',
    esquerda: 'Para a esquerda', direita: 'Para a direita',
    'tras-esquerda': 'Para trás e à esquerda', 'tras-direita': 'Para trás e à direita',
    'frente-esquerda': 'Para frente e à esquerda', 'frente-direita': 'Para frente e à direita' };
  /* O pad "Ângulo" 3×3: a CÉLULA é o lado que se afasta (em cima = para trás). Centro vazio. */
  var LEG_ANGULO_GRADE = ['tras-esquerda', 'tras', 'tras-direita', 'esquerda', null, 'direita',
    'frente-esquerda', 'frente', 'frente-direita'];
  /* A amostra "Aa" é ÍCONE, não medida: a perspectiva encolhe com ela para a inclinação ler
     naquele tamanho. */
  var LEG_ANGULO_AMOSTRA = 0.12;
  /* Dentro desta distância do centro (em % da largura) o arrasto NÃO cria posição lateral:
     arrastar só para cima e para baixo nunca pode tirar a legenda do centro por tremor. */
  var LEG_X_IMA = 2;
  var LEGENDA_FONTE_LABELS = { inter: 'Inter · limpa', montserrat: 'Montserrat · forte' };
  var LEGENDA_ALINHA_LABELS = { left: 'Esquerda', center: 'Centro', right: 'Direita' };
  /* Os NOMES de cor que o editor gravava antes de 2026-09-23. Continuam válidos (corte
     salvo abre igual); a tela só os traduz para hex ao mostrar. */
  var LEGENDA_COR_HEX = {
    texto: '#FFFFFF', destaque: '#D9A441', destaqueGanho: '#8FB573',
    destaquePerda: '#C0554A', palavraCor: '#59E36A'
  };
  /* A paleta de cada papel. Escolhida para LER sobre vídeo: texto claro ou escuro de alto
     contraste, destaques saturados sem ser neon, contorno e caixa em tons que seguram o
     texto. Qualquer outra cor entra pelo seletor "Personalizada" da mesma linha. */
  var LEGENDA_TINTAS = {
    cor: [['#FFFFFF', 'Branco'], ['#F5F1E8', 'Marfim'], ['#FFD23F', 'Amarelo'], ['#141414', 'Preto']],
    destaqueCor: [['#FFD23F', 'Amarelo'], ['#FF9F1C', 'Laranja'], ['#FF6B5B', 'Coral'],
      ['#7BD389', 'Verde'], ['#4CC9F0', 'Azul'], ['#B69CFF', 'Lilás'], ['#D62839', 'Vermelho'],
      ['#FFFFFF', 'Branco']],
    contorno: [['nenhum', 'Sem contorno'], ['#000000', 'Preto'], ['#0E1A3A', 'Azul-noite'],
      ['#FFFFFF', 'Branco']],
    fundo: [['nenhum', 'Sem caixa'], ['#0E0E10', 'Preta'], ['#FFFFFF', 'Branca'],
      ['#FFD23F', 'Amarela'], ['#1E3A8A', 'Azul']]
  };
  /* COMBINAÇÕES prontas das quatro cores. É o atalho: um clique troca texto, destaque,
     contorno e caixa juntos, sempre num par que se lê bem. */
  var LEGENDA_COMBOS = [
    { nome: 'Branco e amarelo', cor: '#FFFFFF', destaqueCor: '#FFD23F', contorno: 'nenhum', fundo: 'nenhum' },
    { nome: 'Branco e coral', cor: '#FFFFFF', destaqueCor: '#FF6B5B', contorno: 'nenhum', fundo: 'nenhum' },
    { nome: 'Branco e azul', cor: '#FFFFFF', destaqueCor: '#4CC9F0', contorno: 'nenhum', fundo: 'nenhum' },
    { nome: 'Marfim e verde', cor: '#F5F1E8', destaqueCor: '#7BD389', contorno: 'nenhum', fundo: 'nenhum' },
    { nome: 'Amarelo com contorno', cor: '#FFD23F', destaqueCor: '#FFFFFF', contorno: '#000000', fundo: 'nenhum' },
    { nome: 'Faixa escura', cor: '#FFFFFF', destaqueCor: '#FFD23F', contorno: 'nenhum', fundo: '#0E0E10' },
    { nome: 'Papel', cor: '#141414', destaqueCor: '#D62839', contorno: 'nenhum', fundo: '#FFFFFF' },
    { nome: 'Marca-texto', cor: '#141414', destaqueCor: '#1E3A8A', contorno: 'nenhum', fundo: '#FFD23F' }
  ];
  var LEGENDA_TINTA_CAMPOS = ['cor', 'destaqueCor', 'contorno', 'fundo'];
  /* O que um estilo PRONTO decide. Escolher outro estilo limpa estes (senão o estilo novo
     apareceria por baixo do ajuste do anterior); posição, largura e alinhamento ficam. */
  var LEGENDA_CAMPOS_DO_ESTILO = ['style', 'familia', 'tamanho', 'caixaAlta'].concat(LEGENDA_TINTA_CAMPOS);
  /* O que o download rápido (FFmpeg/ASS) NÃO reproduz do que a tela deixa escolher.
     Espelha o `captions.ASS_NAO_REPRODUZ` (check 33j2). Desde 2026-10-01 o editor não o
     escreve na tela (decisão do usuário: só ferramentas); a lista fica como contrato. */
  var ASS_NAO_REPRODUZ = [
    'o destaque da palavra sendo dita (a página inteira sai na cor principal)',
    'a animação de entrada da palavra',
    'o desfoque da sombra (o ASS só tem sombra dura, deslocada)',
    'os cantos arredondados da caixa de fundo, e o contorno quando há caixa',
    'a inclinação e o volume da Profundidade (o texto sai reto e sem espessura)',
    'a música de fundo (sai só a voz)',
    'os trechos removidos (sai o corte inteiro)',
    'o texto fixo na tela',
    'o zoom pontual'
  ];
  /* Seções recolhidas: sobrevivem ao re-render (o `<details>` renasceria fechado). */
  var LEG_MAIS = { cores: false, avancado: false };

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
  /* Cor gravada (token antigo, hex ou `nenhum`) -> hex, ou null. */
  function legendaHex(valor) {
    if (!valor || valor === LEGENDA_SEM) return null;
    return LEGENDA_COR_HEX[valor] || String(valor).toUpperCase();
  }
  /* O valor de um controle como o DOM o escreve — é a chave que marca radio e amostra. */
  function legendaMostrado(clip, chave) {
    var v = legendaValor(clip, chave).valor;
    if (LEGENDA_TINTA_CAMPOS.indexOf(chave) >= 0) {
      if (chave === 'destaqueCor' && !v) return 'auto';
      return legendaHex(v) || LEGENDA_SEM;
    }
    return String(v);
  }
  /* Quantos controles o operador já tirou do automático. É o que a faixa de estado mostra
     — inclusive o caso em que ela NÃO age, que é o ramo que o BP-008 cobra. */
  function legendaManuais(clip) {
    var edit = editOf(clip);
    return Object.keys(edit.legenda).length + Object.keys(edit.enquadramento).length;
  }
  /* A combinação de cores em uso, ou -1. É o que acende a amostra certa. */
  function legendaComboAtivo(clip) {
    for (var i = 0; i < LEGENDA_COMBOS.length; i++) {
      var combo = LEGENDA_COMBOS[i];
      if (LEGENDA_TINTA_CAMPOS.every(function (c) { return legendaMostrado(clip, c) === combo[c]; })) return i;
    }
    return -1;
  }
  /* Grava um valor, e o valor IGUAL ao automático do estilo vira `null` (apagar a chave):
     escolher de volta o que o estilo já dá não é "ajuste", e a linha não pode acender. */
  function legendaGravar(clip, chave, valor) {
    var auto = legendaValor({ legendaStyle: legendaStyleOf(clip) }, chave).valor;
    var igual = LEGENDA_TINTA_CAMPOS.indexOf(chave) >= 0
      ? (valor === 'auto' || legendaHex(valor) === legendaHex(auto))
      : valor === auto;
    return editFieldWrite(clip, 'legenda', chave, igual ? null : valor);
  }
  function legendaComboWrite(clip, indice) {
    var combo = LEGENDA_COMBOS[indice];
    if (!clip || !combo) return false;
    LEGENDA_TINTA_CAMPOS.forEach(function (c) { legendaGravar(clip, c, combo[c]); });
    return true;
  }
  /* Trocar de estilo: o estilo novo aparece INTEIRO (limpa o que ele decide). */
  function legendaStyleWrite(clip, valor) {
    if (!clip) return false;
    var edit = editOf(clip);
    LEGENDA_CAMPOS_DO_ESTILO.forEach(function (k) { delete edit.legenda[k]; });
    clip.edit = editOf({ edit: edit });
    clip.legendaStyle = legendaStyleOf({ legendaStyle: valor });
    return true;
  }
  /* "Voltar ao padrão": a legenda inteira volta ao automático do estilo, posição inclusive.
     O enquadramento não é da legenda e fica. */
  function legendaReset(clip) {
    if (!clip) return false;
    delete LEG_X_ABERTO[clip.id];
    var edit = editOf(clip);
    edit.legenda = {};
    clip.edit = editOf({ edit: edit });
    return true;
  }

  /* O botão ↺ existe SEMPRE, e não só quando há override: um botão que aparece e some muda
     a largura da linha no meio do ajuste. Desabilitado diz a mesma coisa sem mexer em nada. */
  function legRowHTML(clip, chave, rotulo, controle) {
    var estado = legendaValor(clip, chave);
    return '<div class="vop-leg-row" data-leg-row="' + esc(chave) + '"'
      + ' data-manual="' + (estado.manual ? '1' : '0') + '">'
      + '<span class="vop-leg-lab">' + esc(rotulo) + '</span>'
      + '<div class="vop-leg-ctl">' + controle + '</div>'
      + '<button class="vop-leg-auto" type="button" data-act="leg-auto"'
      + ' data-id="' + esc(clip.id) + '" data-key="' + esc(chave) + '"'
      + (estado.manual ? '' : ' disabled')
      + ' aria-label="Voltar ' + esc(rotulo.toLowerCase())
      + ' ao automático">↺</button>'
      + '</div>';
  }
  /* Radios NATIVOS: o `:checked` desenha o selecionado, a navegação por seta vem de graça e
     não há JS de estado visual para dessincronizar do dado. O `name` leva o id do trecho E
     a chave — um `name` só faria os grupos brigarem. */
  function legRadiosHTML(clip, chave, opcoes, rotulo) {
    var atual = legendaMostrado(clip, chave);
    return legRowHTML(clip, chave, rotulo, '<div class="vop-leg-seg">'
      + opcoes.map(function (opcao) {
        var valor = String(opcao[0]);
        var id = 'leg-' + chave + '-' + clip.id + '-' + valor;
        return '<input type="radio" id="' + esc(id) + '"'
          + ' name="leg-' + esc(chave) + '-' + esc(clip.id) + '"'
          + ' data-leg-field="' + esc(chave) + '" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(valor) + '"' + (atual === valor ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(opcao[1]) + '</label>';
      }).join('') + '</div>');
  }
  /* Uma linha de cor: amostras da paleta + a cor personalizada. A amostra tem nome em
     `title` e em texto para leitor de tela — cor sozinha não é rótulo acessível. */
  function legTintaHTML(clip, chave, rotulo) {
    var atual = legendaMostrado(clip, chave);
    var opcoes = LEGENDA_TINTAS[chave].slice();
    if (chave === 'destaqueCor' && !LEGENDA_AUTO[legendaStyleOf(clip)].destaqueCor) {
      opcoes.unshift(['auto', 'Colorido (uma cor por palavra)']);
    }
    var livre = legendaHex(atual) || '#FFFFFF';
    return legRowHTML(clip, chave, rotulo, '<div class="vop-leg-sws">'
      + opcoes.map(function (opcao) {
        var id = 'leg-' + chave + '-' + clip.id + '-' + opcao[0].replace('#', '');
        var amostra = opcao[0] === 'auto'
          ? ' data-sw="leque"' : opcao[0] === LEGENDA_SEM ? ' data-sw="sem"' : ' style="--sw:' + esc(opcao[0]) + '"';
        return '<input type="radio" id="' + esc(id) + '" name="leg-' + esc(chave) + '-' + esc(clip.id) + '"'
          + ' data-leg-field="' + esc(chave) + '" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(opcao[0]) + '"' + (atual === opcao[0] ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '" class="vop-leg-sw"' + amostra + ' title="' + esc(opcao[1]) + '">'
          + '<span class="vop-sr">' + esc(opcao[1]) + '</span></label>';
      }).join('')
      + '<label class="vop-leg-livre" title="Cor personalizada">'
      + '<input type="color" data-leg-field="' + esc(chave) + '" data-id="' + esc(clip.id) + '"'
      + ' value="' + esc(livre.toLowerCase()) + '" aria-label="' + esc(rotulo) + ': cor personalizada">'
      + '<span aria-hidden="true">+</span></label>'
      + '</div>');
  }
  function legRangeHTML(clip, chave, rotulo, min, max, passo, sufixo, extra) {
    var valor = legSliderValor(clip, chave);
    return legRowHTML(clip, chave, rotulo, '<div class="vop-leg-range">'
      + '<input type="range" min="' + min + '" max="' + max + '" step="' + passo + '"'
      + ' value="' + valor + '" data-leg-field="' + esc(chave) + '"'
      + ' data-id="' + esc(clip.id) + '" aria-label="' + esc(rotulo) + '">'
      + '<output data-leg-out="' + esc(chave) + '">' + valor + esc(sufixo) + '</output>'
      + '</div>' + (extra || ''));
  }
  /* O número que o slider mostra. A posição lateral automática é o CENTRO (50%), e não o
     `null` que o modelo guarda: `num(null)` daria 0% e o slider nasceria na borda. */
  function legSliderValor(clip, chave) {
    var estado = legendaValor(clip, chave);
    if (chave === 'posicaoXPct' && !estado.manual) return 50;
    return num(estado.valor);
  }
  /* A amostra de cada estilo pronto: o mesmo desenho da prévia, em miniatura, sobre um
     fundo de "vídeo" neutro. É ela que deixa escolher pela APARÊNCIA. */
  function legLookAmostraHTML(estilo) {
    var a = LEGENDA_AUTO[estilo];
    var destaque = a.destaqueCor || LEGENDA_LEQUE[0];
    return '<span class="vop-leg-look-quadro" aria-hidden="true">'
      + '<span class="vop-leg-look-txt" data-familia="' + esc(a.familia) + '"'
      + ' data-caixa="' + (a.caixaAlta ? '1' : '0') + '" data-sombra="' + (a.sombra ? '1' : '0') + '"'
      + (a.contorno !== LEGENDA_SEM ? ' data-contorno="1"' : '')
      + ' style="--a-esc:' + (a.tamanho / 58).toFixed(3) + ';--a-cor:' + a.cor + ';--a-peso:' + a.peso
      + (a.contorno !== LEGENDA_SEM ? ';--a-contorno:' + a.contorno : '') + '">'
      + '<span' + (a.fundo !== LEGENDA_SEM ? ' class="vop-leg-look-caixa" style="--a-fundo:' + a.fundo + '"' : '') + '>'
      + 'Assim <b style="color:' + destaque + '">fica</b></span></span></span>';
  }
  function legLooksHTML(clip) {
    var atual = legendaStyleOf(clip);
    return '<fieldset class="vop-leg-looks"><legend class="vop-leg-lab">Estilo</legend>'
      + LEGENDA_STYLES.map(function (estilo) {
        var id = 'legstyle-' + clip.id + '-' + estilo;
        return '<input type="radio" id="' + esc(id) + '" name="legstyle-' + esc(clip.id) + '"'
          + ' data-clip-field="legendaStyle" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(estilo) + '"' + (atual === estilo ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '" class="vop-leg-look">' + legLookAmostraHTML(estilo)
          + '<span class="vop-leg-look-nome">' + esc(LEGENDA_LABELS[estilo]) + '</span></label>';
      }).join('') + '</fieldset>';
  }
  /* As combinações de cor: cada amostra desenha "Aa" nas quatro cores dela. */
  function legCombosHTML(clip) {
    var ativo = legendaComboAtivo(clip);
    return '<fieldset class="vop-leg-combos"><legend class="vop-leg-lab">Cores</legend>'
      + '<div class="vop-leg-combos-lista">'
      + LEGENDA_COMBOS.map(function (combo, i) {
        var id = 'legcombo-' + clip.id + '-' + i;
        return '<input type="radio" id="' + esc(id) + '" name="legcombo-' + esc(clip.id) + '"'
          + ' data-leg-combo data-id="' + esc(clip.id) + '" value="' + i + '"' + (ativo === i ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '" class="vop-leg-combo" title="' + esc(combo.nome) + '"'
          + ' style="--c-cor:' + combo.cor + ';--c-dest:' + combo.destaqueCor
          + (combo.fundo !== LEGENDA_SEM ? ';--c-fundo:' + combo.fundo : '')
          + (combo.contorno !== LEGENDA_SEM ? ';--c-contorno:' + combo.contorno : '') + '"'
          + (combo.contorno !== LEGENDA_SEM ? ' data-contorno="1"' : '')
          + (combo.fundo !== LEGENDA_SEM ? ' data-fundo="1"' : '') + '>'
          + '<span aria-hidden="true">A<b>a</b></span><span class="vop-sr">' + esc(combo.nome) + '</span></label>';
      }).join('') + '</div></fieldset>';
  }
  function legMaisHTML(chave, titulo, corpo) {
    return '<details class="vop-leg-mais"' + (LEG_MAIS[chave] ? ' open' : '') + '>'
      + '<summary data-leg-mais="' + esc(chave) + '">' + esc(titulo) + '</summary>'
      + '<div class="vop-leg-mais-corpo">' + corpo + '</div></details>';
  }
  /* O painel inteiro, na ordem em que a decisão acontece: escolho a aparência, acerto o
     tamanho e as cores, ponho no lugar — e só quem precisa abre o resto. */
  /* A ferramenta Legenda, em SUBABAS (2026-10-01): radios nativos como a barra; cada vista
     cabe a 1366×768 sem rolagem (só o Texto, que é lista, pode rolar). "Voltar ao padrão" e
     "Ver o quadro real" ficam no cabeçalho da ferramenta. */
  function legAbasHTML(clip) {
    var ativa = LEG_ABAS.some(function (a) { return a[0] === LEG_ABA; }) ? LEG_ABA : 'texto';
    return '<div class="yt-abas" role="radiogroup" aria-label="Partes da legenda">'
      + LEG_ABAS.map(function (a) {
        var id = 'leg-aba-' + clip.id + '-' + a[0];
        return '<input type="radio" id="' + esc(id) + '" name="leg-aba-' + esc(clip.id) + '"'
          + ' data-leg-aba data-id="' + esc(clip.id) + '" value="' + a[0] + '"' + (ativa === a[0] ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(a[1]) + '</label>';
      }).join('') + '</div>';
  }
  function legAbaHTML(chave, corpo) {
    return '<div class="vop-leg-aba" data-leg-aba-painel="' + chave + '">' + corpo + '</div>';
  }
  function legendaPanelHTML(clip) {
    var ajustes = Object.keys(editOf(clip).legenda).length;
    return '<section class="vop-leg" data-leg="' + esc(clip.id) + '" aria-label="Legenda">'
      + '<div class="vop-leg-head">'
      + '<button class="vop-leg-reset" type="button" data-act="leg-reset" data-id="' + esc(clip.id) + '"'
      + (ajustes ? '' : ' disabled') + '>Voltar ao padrão</button>'
      /* CAMADA B: o quadro de verdade, sob demanda, com o MESMO corpo do export. */
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="leg-still"'
      + ' data-id="' + esc(clip.id) + '">Ver o quadro real</button></div>'
      + legAbasHTML(clip)
      + legAbaHTML('texto', capPanelHTML(clip))
      + legAbaHTML('estilo', legLooksHTML(clip)
        + legRangeHTML(clip, 'tamanho', 'Tamanho', 32, 96, 2, 'px')
        + legCombosHTML(clip)
        + legMaisHTML('cores', 'Escolher cada cor',
          legTintaHTML(clip, 'cor', 'Texto')
          + legTintaHTML(clip, 'destaqueCor', 'Destaque')
          + legTintaHTML(clip, 'contorno', 'Contorno')
          + legTintaHTML(clip, 'fundo', 'Caixa de fundo')))
      /* As duas posições nascem sem número: a âncora automática e a coluna centralizada saem
         do servidor (`captions.margem_inferior` / `captions.coluna_x`). */
      + legAbaHTML('posicao', legPosicaoHTML(clip)
        + legPosicaoXHTML(clip)
        + legRadiosHTML(clip, 'alinhamento', LEGENDA_ALINHAMENTOS.map(function (a) {
          return [a, LEGENDA_ALINHA_LABELS[a]];
        }), 'Alinhamento')
        + legRangeHTML(clip, 'largura', 'Largura do texto', 360, 1000, 20, 'px'))
      + legAbaHTML('profundidade', legRadiosHTML(clip, 'profundidade', LEGENDA_PROFUNDIDADE_LABELS, 'Profundidade')
        + legAnguloHTML(clip))
      + legAbaHTML('avancado', legRadiosHTML(clip, 'familia', [['inter', LEGENDA_FONTE_LABELS.inter],
          ['montserrat', LEGENDA_FONTE_LABELS.montserrat]], 'Fonte')
        + legRadiosHTML(clip, 'caixaAlta', [['false', 'Normal'], ['true', 'MAIÚSCULAS']], 'Letras'))
      + '<div class="vop-leg-still" data-leg-still-slot></div>'
      + '</section>';
  }

  /* --- geometria da legenda: o servidor é o dono ---------------------------------------
     A prévia "Como sai 9:16" desenha com os MESMOS números do render: a tela manda a
     INTENÇÃO (enquadramento, largura, as duas posições) para o `/api/legenda-geometria` e
     recebe pixel e faixas prontos. Nenhuma fórmula de âncora ou de coluna mora aqui (check
     33g6). Estado de MÓDULO, sem chave de localStorage: é conta da sessão. */
  var LEG_GEO = { chave: '', estado: 'vazio', dados: null, erro: '' };
  /* Qual cara o player mostra com um corte aberto. Estado da SESSÃO (pedido: sem chave
     nova), "Como sai 9:16" por padrão. Trocar NÃO re-renderiza: só o atributo do palco
     muda, então o `<video>` é o mesmo nó e o `currentTime` segue correndo. */
  var PREVIA_MODO = 'saida';
  /* "Posição lateral" aberta à mão sem valor gravado: o centro não é ajuste (a chave some,
     como no `legendaGravar`), mas a linha tem de continuar mostrando o slider. */
  var LEG_X_ABERTO = {};
  /* A INTENÇÃO que muda a geometria (2026-09-28: o piso da coluna sai da palavra mais longa
     no corpo/família/caixa, e a guarda do topo sai do corpo). Cor não entra: mudar cor não
     pede nada. As falas vão à parte (`legGeoFalas`) — são delas o piso e as páginas. */
  function legGeoCorpo(clip) {
    var manual = editOf(clip).legenda;
    var legenda = {};
    ['style', 'familia', 'tamanho', 'caixaAlta', 'largura', 'posicaoPct', 'posicaoXPct'].forEach(function (k) {
      if (manual[k] !== undefined) legenda[k] = manual[k];
    });
    var corpo = { reframe: reframeOf(clip), legendaStyle: legendaStyleOf(clip),
      edit: { v: 1, legenda: legenda, enquadramento: { reframe: reframeOf(clip) } },
      width: num(SRC.width), height: num(SRC.height), source: SRC.name || '' };
    /* Remoções: a rota remapeia as falas pelo MESMO dono do export (prévia == export). Só vão
       quando existem — sem elas o corpo (e a chave do pedido) é o de sempre. */
    var rems = remocoesDoClip(clip);
    if (rems.length) {
      corpo.edit.remocoes = rems;
      corpo.start = num(clip.inSec);
      corpo.end = num(clip.outSec);
    }
    return corpo;
  }
  /* As MESMAS falas que o export manda (`renderBody`): a correção digitada inclusive. */
  function legGeoFalas(clip) {
    return JSON.stringify(capEdited(clip) || clip.clipCues || []);
  }
  function legGeoClip() { return YT.detail ? findById(YT.candidates, YT.detail) : null; }
  /* Os últimos números recebidos — servem para DESENHAR enquanto a resposta nova não chega. */
  function legGeoDados() {
    return LEG_GEO.dados && LEG_GEO.dados.videoAltura ? LEG_GEO.dados : null;
  }
  /* Só os números DESTE corte, neste estado: é o que decide a partida do "Ajustar à mão".
     Dado de outro enquadramento faria a legenda pular — o defeito que a partida real veio
     matar. */
  function legGeoDoCorte(clip) {
    /* A chave dos DADOS em mãos, não a do pedido em voo: as falas chegando disparam um pedido
       novo, e a partida (que não depende delas) não pode sumir enquanto ele volta. */
    return clip && LEG_GEO.dados && LEG_GEO.dadosChave === JSON.stringify(legGeoCorpo(clip))
      ? LEG_GEO.dados : null;
  }
  function legGeoPedir(clip) {
    if (!clip || typeof fetch !== 'function') return;
    var corpo = JSON.stringify(legGeoCorpo(clip));
    var falas = legGeoFalas(clip);
    if (corpo === LEG_GEO.chave && falas === LEG_GEO.falas && LEG_GEO.estado !== 'erro') return;
    LEG_GEO = { chave: corpo, falas: falas, estado: 'carregando', dados: LEG_GEO.dados,
      dadosChave: LEG_GEO.dadosChave, dadosFalas: LEG_GEO.dadosFalas, erro: '' };
    fetch('/api/legenda-geometria', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: corpo.slice(0, -1) + ',"cues":' + falas + '}'
    }).catch(function () {
      throw new Error('o renderizador não está ativo — rode estudio.ps1');
    }).then(function (resposta) {
      return resposta.json().then(function (p) { return { ok: resposta.ok, p: p || {} }; });
    }).then(function (res) {
      if (LEG_GEO.chave !== corpo || LEG_GEO.falas !== falas) return;
      if (!res.ok || !res.p.videoAltura) {
        throw new Error(res.p.error || 'o servidor não devolveu a geometria');
      }
      LEG_GEO = { chave: corpo, falas: falas, estado: 'pronto', dados: res.p, dadosChave: corpo,
        dadosFalas: falas, erro: '' };
      legGeoAplicar(legGeoClip());
    }).catch(function (erro) {
      if (LEG_GEO.chave !== corpo || LEG_GEO.falas !== falas) return;
      LEG_GEO = { chave: corpo, falas: falas, estado: 'erro', dados: null,
        erro: erro && erro.message ? erro.message : 'erro desconhecido' };
      legGeoAplicar(legGeoClip());
    });
  }
  /* A correção do texto muda a palavra mais longa e as páginas: pede de novo, mas só quando
     o operador para de digitar (um pedido por tecla seria ruído para o servidor). */
  var LEG_GEO_ESPERA = 0;
  function legGeoAgendar() {
    if (typeof setTimeout !== 'function') return;
    clearTimeout(LEG_GEO_ESPERA);
    LEG_GEO_ESPERA = setTimeout(function () { legGeoPedir(legGeoClip()); }, 400);
  }
  /* Editor sem frase (2026-10-01): enquanto automática, a linha mostra só o VALOR. O que o
     servidor grampeou ou avisou (borda, palavra longa, zonas do TikTok) aparece nas guias da
     prévia e no próprio slider, que já anda só dentro da faixa devolvida. */
  function legPosicaoHTML(clip) {
    var geo = legGeoDados();
    if (legendaValor(clip, 'posicaoPct').manual) {
      var faixa = geo ? geo.faixaPosicao : [0, 100];
      return legRangeHTML(clip, 'posicaoPct', 'Posição', faixa[0], faixa[1], 1, '%');
    }
    return legRowHTML(clip, 'posicaoPct', 'Posição',
      '<div class="vop-leg-range"><span class="vop-leg-auto-val">Automática</span>'
      + '<button class="vop-inline-action" type="button" data-act="leg-posicao"'
      + ' data-id="' + esc(clip.id) + '"' + (legGeoDoCorte(clip) ? '' : ' disabled') + '>Ajustar à mão</button></div>');
  }
  function legPosicaoXHTML(clip) {
    var geo = legGeoDados();
    var faixa = geo && geo.faixaPosicaoX;
    if (legendaValor(clip, 'posicaoXPct').manual || (LEG_X_ABERTO[clip.id] && faixa)) {
      var f = faixa || [50, 50];
      return legRangeHTML(clip, 'posicaoXPct', 'Posição lateral', f[0], f[1], 1, '%');
    }
    return legRowHTML(clip, 'posicaoXPct', 'Posição lateral',
      '<div class="vop-leg-range"><span class="vop-leg-auto-val">Centro</span>'
      + '<button class="vop-inline-action" type="button" data-act="leg-posicao-x"'
      + ' data-id="' + esc(clip.id) + '"' + (faixa ? '' : ' disabled') + '>Ajustar à mão</button></div>');
  }
  /* Sem intensidade o ângulo não desenha nada: o pad fica desabilitado. */
  function legAnguloSemProf(clip) {
    return !LEGENDA_PROFUNDIDADES[legendaValor(clip, 'profundidade').valor];
  }
  /* A amostra de uma célula: os sinais e o pivô da direção, com os ângulos da intensidade
     escolhida (Suave enquanto está em Nenhuma, só para o ícone não ficar reto). */
  function legAnguloAmostra(clip, direcao) {
    var p = LEGENDA_PROFUNDIDADES[legendaValor(clip, 'profundidade').valor] || LEGENDA_PROFUNDIDADES.suave;
    var a = legProfAngulos(p, direcao);
    return { transform: 'perspective(' + Math.round(p.perspectiva * LEG_ANGULO_AMOSTRA) + 'px)'
      + (a.dir.x ? ' rotateY(' + a.dir.x * a.giro + 'deg)' : '')
      + (a.dir.y ? ' rotateX(' + a.dir.y * a.incl + 'deg)' : ''), origem: a.dir.origem };
  }
  /* Radios NATIVOS pelo mesmo `legRowHTML` / `data-leg-field` dos outros grupos: gravar, o
     marcador de ajustado, o ↺ e o "Voltar ao padrão" funcionam sem handler novo. */
  function legAnguloHTML(clip) {
    var atual = legendaMostrado(clip, 'profundidadeDirecao');
    var sem = legAnguloSemProf(clip);
    return legRowHTML(clip, 'profundidadeDirecao', 'Ângulo',
      '<div class="vop-leg-angulo" role="radiogroup" aria-label="Ângulo da Profundidade">'
      + LEG_ANGULO_GRADE.map(function (direcao) {
        if (!direcao) return '<span class="vop-leg-ang-centro" aria-hidden="true"></span>';
        var id = 'leg-profundidadeDirecao-' + clip.id + '-' + direcao;
        var nome = LEGENDA_PROFUNDIDADE_DIRECAO_LABELS[direcao];
        var amostra = legAnguloAmostra(clip, direcao);
        return '<input type="radio" id="' + esc(id) + '"'
          + ' name="leg-profundidadeDirecao-' + esc(clip.id) + '"'
          + ' data-leg-field="profundidadeDirecao" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(direcao) + '"' + (atual === direcao ? ' checked' : '')
          + (sem ? ' disabled' : '') + '>'
          + '<label for="' + esc(id) + '" title="' + esc(nome) + '">'
          + '<span class="vop-leg-ang-aa" aria-hidden="true" data-leg-ang-aa="' + esc(direcao) + '"'
          + ' style="transform:' + esc(amostra.transform) + ';transform-origin:' + esc(amostra.origem) + '">Aa</span>'
          + '<span class="vop-sr">' + esc(nome) + '</span></label>';
      }).join('') + '</div>');
  }
  /* Os números chegaram (ou falharam): atualiza NO LUGAR o palco, as duas linhas de posição
     e a prévia. Nada de `render()` — a resposta pode chegar com o operador no meio de outro
     controle. A linha com o foco dentro só troca a nota. */
  function legGeoAplicar(clip) {
    var raiz = typeof document !== 'undefined' ? document.getElementById('video-ops-root') : null;
    if (!raiz || !clip) return;
    var geo = legGeoDados();
    var palco = raiz.querySelector('[data-src-stage]');
    if (palco) {
      palco.dataset.geo = geo ? '1' : '0';
      palco.dataset.fundo = geo && geo.fundoUrl ? '1' : '0';
      if (geo && palco.style && palco.style.setProperty) {
        palco.style.setProperty('--geo-video', String(geo.videoAltura));
        palco.style.setProperty('--geo-banda', String(geo.bandaAltura));
        palco.style.setProperty('--geo-fundo', geo.fundoUrl ? 'url("' + geo.fundoUrl + '")' : 'none');
      }
    }
    var foco = typeof document !== 'undefined' ? document.activeElement : null;
    [['posicaoPct', legPosicaoHTML], ['posicaoXPct', legPosicaoXHTML]].forEach(function (par) {
      var linha = raiz.querySelector('[data-leg-row="' + par[0] + '"]');
      if (!linha) return;
      if (foco && linha.contains && linha.contains(foco)) return;
      linha.outerHTML = par[1](clip);
    });
    var velha = raiz.querySelector('[data-leg-prev]');
    if (velha && velha.parentNode && !LEG_DRAG) velha.outerHTML = legendaPreviewHTML(clip);
    else if (velha && LEG_DRAG && geo) {
      /* No meio do arrasto: só a coluna efetiva e as zonas (o texto segue a mão). */
      if (editOf(clip).legenda.posicaoXPct !== undefined && geo.legendaLargura) {
        velha.style.setProperty('--leg-col', String(num(geo.legendaLargura)));
      } else if (geo.legendaLarguraMax) {
        velha.style.setProperty('--leg-col', String(num(geo.legendaLarguraMax)));
      }
      var av = geo.avisos || {};
      velha.dataset.zonaTrilha = av.trilha ? '1' : '0';
      velha.dataset.zonaRodape = av.rodape ? '1' : '0';
    }
    legQuadroMapear();
  }
  /* O seletor do player: rádio NATIVO (seta do teclado e `:checked` de graça). */
  function legModoHTML() {
    return '<div class="yt-src-modo vop-leg-seg" role="radiogroup" aria-label="Como ver o vídeo">'
      + [['original', 'Original 16:9'], ['saida', 'Como sai 9:16']].map(function (m) {
        var id = 'src-modo-' + m[0];
        return '<input type="radio" id="' + id + '" name="src-modo" data-src-modo value="' + m[0] + '"'
          + (PREVIA_MODO === m[0] ? ' checked' : '') + '>'
          + '<label for="' + id + '">' + m[1] + '</label>';
      }).join('') + '</div>';
  }
  /* A barra do "Como sai 9:16", ABAIXO do quadro: play/pause, o instante RELATIVO ao corte
     e uma busca limitada ao corte. Existe porque os controles nativos, no 9:16, moram na
     faixa do vídeo e cobrem a legenda (P2) — e parados (= editando) nunca somem. */
  function legBarraHTML(clip) {
    var dur = Math.max(0, num(clip.outSec) - num(clip.inSec));
    return '<div class="yt-src-barra" data-src-barra' + (PREVIA_MODO === 'saida' ? '' : ' hidden') + '>'
      + '<button class="yt-src-play" type="button" data-act="src-play" aria-label="Tocar">'
      + '<span aria-hidden="true" data-src-play-icone>▶</span></button>'
      + '<span class="yt-src-tempo" data-src-tempo>' + esc(fmtClock(0)) + ' / ' + esc(fmtClock(dur)) + '</span>'
      + '<input class="yt-src-busca" type="range" data-src-busca min="0" max="' + num(dur)
      + '" step="0.1" value="0" aria-label="Posição no corte">'
      + '</div>';
  }
  /* Repinta a barra NO LUGAR a cada evento do player (nunca `render()`: o arrasto da busca
     morreria no meio). O instante sai do `srcNow` e é mostrado relativo ao corte. */
  function legBarraPaint() {
    var raiz = typeof document !== 'undefined' ? document.getElementById('video-ops-root') : null;
    var barra = raiz && raiz.querySelector('[data-src-barra]');
    var clip = legGeoClip();
    if (!barra || !clip) return;
    var v = srcVideo();
    var dur = Math.max(0, num(clip.outSec) - num(clip.inSec));
    var agora = srcNow();
    var rel = agora === null ? 0 : Math.min(dur, Math.max(0, agora - num(clip.inSec)));
    var tocando = !!(v && !v.paused && !v.ended);
    var tempo = barra.querySelector('[data-src-tempo]');
    if (tempo) tempo.textContent = fmtClock(rel) + ' / ' + fmtClock(dur);
    var busca = barra.querySelector('[data-src-busca]');
    if (busca && document.activeElement !== busca) busca.value = String(Math.round(rel * 10) / 10);
    var botao = barra.querySelector('[data-act="src-play"]');
    if (botao) botao.setAttribute('aria-label', tocando ? 'Pausar' : 'Tocar');
    var icone = barra.querySelector('[data-src-play-icone]');
    if (icone) icone.textContent = tocando ? '❚❚' : '▶';
  }
  /* "Original 16:9" com a legenda no lugar certo (2026-09-28): o `.yt-src-quadro` vira o
     QUADRO DE SAÍDA (1080×1920) mapeado sobre a fonte. s = altura do conteúdo exibido do
     `<video>` (medida sob `object-fit: contain`, sem supor 16:9) ÷ `videoAltura`; a caixa é
     1080·s × 1920·s, centrada no conteúdo, com o topo em (topo do conteúdo − banda·s). O
     palco recorta. A prévia da legenda (× `--px` do quadro) cai no pixel certo, e o arrasto,
     que mede o quadro, dá a MESMA intenção nos dois modos. O vídeo e a máscara, que moram
     dentro do quadro, compensam o deslocamento para continuar cobrindo o palco inteiro.
     No 9:16 tudo volta ao CSS (estilos inline limpos). Sem `render()`: roda no
     `loadedmetadata`, no redimensionar (ResizeObserver) e quando a geometria chega. */
  var LEG_RO = null;
  var LEG_RO_ALVO = null;
  function legQuadroMapear() {
    var raiz = typeof document !== 'undefined' ? document.getElementById('video-ops-root') : null;
    var palco = raiz && raiz.querySelector('[data-src-stage]');
    if (!palco || !palco.querySelector) return;
    if (!LEG_RO && typeof ResizeObserver === 'function') {
      LEG_RO = new ResizeObserver(function () { legQuadroMapear(); });
    }
    if (LEG_RO && LEG_RO_ALVO !== palco) { LEG_RO.disconnect(); LEG_RO.observe(palco); LEG_RO_ALVO = palco; }
    var quadro = palco.querySelector('.yt-src-quadro');
    var cobre = Array.prototype.slice.call(palco.querySelectorAll('.yt-src-video, .vop-cand-mask'));
    var geo = legGeoDados();
    var v = srcVideo();
    var limpar = function () {
      if (quadro && quadro.removeAttribute) quadro.removeAttribute('style');
      cobre.forEach(function (el) { ['left', 'top', 'width', 'height', 'right', 'bottom'].forEach(function (k) { el.style[k] = ''; }); });
      if (palco.removeAttribute) palco.removeAttribute('data-mapa');
    };
    if (!quadro || palco.dataset.modo !== 'original' || !geo || !v || !legGeoClip()) return limpar();
    var W = palco.clientWidth, H = palco.clientHeight;
    var vw = Number(v.videoWidth), vh = Number(v.videoHeight);
    if (!(W > 0 && H > 0 && vw > 0 && vh > 0)) return limpar();
    var k = Math.min(W / vw, H / vh);
    var cw = vw * k, ch = vh * k;
    var cx = (W - cw) / 2, cy = (H - ch) / 2;
    var s = ch / num(geo.videoAltura);
    var qw = 1080 * s, qh = 1920 * s;
    var ql = cx + cw / 2 - qw / 2, qt = cy - num(geo.bandaAltura) * s;
    quadro.style.left = ql + 'px';
    quadro.style.top = qt + 'px';
    quadro.style.width = qw + 'px';
    quadro.style.height = qh + 'px';
    cobre.forEach(function (el) {
      el.style.left = -ql + 'px'; el.style.top = -qt + 'px';
      el.style.width = W + 'px'; el.style.height = H + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    });
    palco.setAttribute('data-mapa', '1');
  }
  function legPlayToggle() {
    var v = srcVideo();
    if (!v) return;
    if (v.paused || v.ended) {
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () {});
    } else if (v.pause) v.pause();
  }
  /* A busca fica DENTRO do corte: o valor é segundo relativo, e o `srcSeek` recebe o absoluto. */
  function legBuscaWrite(el) {
    var clip = legGeoClip();
    if (!clip) return;
    var dur = Math.max(0, num(clip.outSec) - num(clip.inSec));
    srcSeek(num(clip.inSec) + Math.min(dur, Math.max(0, Number(el.value) || 0)));
  }
  function legModoTroca(valor) {
    PREVIA_MODO = valor === 'original' ? 'original' : 'saida';
    var raiz = document.getElementById('video-ops-root');
    var palco = raiz && raiz.querySelector('[data-src-stage]');
    if (palco) palco.dataset.modo = PREVIA_MODO;
    /* O MESMO nó: só a propriedade vira (o `currentTime` e o buffer seguem). */
    var v = srcVideo();
    if (v) v.controls = PREVIA_MODO === 'original';
    var barra = raiz && raiz.querySelector('[data-src-barra]');
    if (barra) barra.hidden = PREVIA_MODO !== 'saida';
    legBarraPaint();
    legQuadroMapear();
  }
  /* Os atributos do palco na montagem (a resposta da geometria os reescreve no lugar). */
  function legPalcoAttrs() {
    var geo = legGeoDados();
    if (!geo) return ' data-geo="0" data-fundo="0"';
    return ' data-geo="1" data-fundo="' + (geo.fundoUrl ? '1' : '0') + '"'
      + ' style="--geo-video:' + num(geo.videoAltura) + ';--geo-banda:' + Number(geo.bandaAltura || 0)
      + (geo.fundoUrl ? ';--geo-fundo:url(&quot;' + esc(geo.fundoUrl) + '&quot;)' : '') + '"';
  }
  /* A sombra da Profundidade na prévia: MESMA conta do `profundidadeLegenda` do preset.js,
     com cada comprimento multiplicado por `--px` (o test-video-ops.js compara os dois). */
  var LEG_SOMBRA_PREVIA = '0 calc(3 * var(--px)) calc(14 * var(--px)) rgba(0, 0, 0, .82)';
  /* Ângulos resolvidos de uma direção (a diagonal leva o fator nos dois). */
  function legProfAngulos(p, direcao) {
    var dir = LEGENDA_PROFUNDIDADE_DIRECOES[direcao] || LEGENDA_PROFUNDIDADE_DIRECOES.tras;
    var fator = dir.x && dir.y ? LEGENDA_PROFUNDIDADE_DIAGONAL : 1;
    return { dir: dir, incl: Math.round(p.inclinacao * fator * 100) / 100,
      giro: Math.round(p.giro * fator * 100) / 100 };
  }
  /* Zero sai `0` (nunca `-0`): o `tras` continua com a mesma string de antes. */
  function legPxPrevia(v) {
    return v === 0 ? '0' : 'calc(' + v + ' * var(--px))';
  }
  function legProfundidadeSombra(p, cor, leitura, direcao) {
    var a = legProfAngulos(p, direcao);
    var vx = -a.dir.x * a.giro, vy = a.dir.y * a.incl;
    var norma = Math.sqrt(vx * vx + vy * vy);
    var tinta = 'color-mix(in srgb, ' + cor + ' ' + p.tinta + '%, #000)';
    var camadas = [];
    for (var i = 1; i <= p.camadas; i++) {
      camadas.push(legPxPrevia(Math.round(i * p.passo * (vx / norma) * 100) / 100) + ' '
        + legPxPrevia(Math.round(i * p.passo * (vy / norma) * 100) / 100) + ' 0 ' + tinta);
    }
    return camadas.join(', ') + (leitura ? ', ' + leitura : '');
  }
  /* O transform e o pivô da Profundidade na prévia: MESMA conta do `profundidadeLegenda` do
     preset.js (inclusive a compensação `c` das diagonais), com px × `--px`. O `translateX(-50%)`
     que centra a prévia fica NA FRENTE, no CSS. */
  function legProfundidadeTransform(p, direcao, fonte, entrelinha) {
    var a = legProfAngulos(p, direcao);
    var t = 'perspective(calc(' + p.perspectiva + ' * var(--px)))'
      + (a.dir.x ? ' rotateY(' + a.dir.x * a.giro + 'deg)' : '')
      + (a.dir.y ? ' rotateX(' + a.dir.y * a.incl + 'deg)' : '');
    if (a.dir.x && a.dir.y) {
      var h = 2 * (fonte || 0) * (entrelinha || 1);
      var ri = a.incl * Math.PI / 180, rg = a.giro * Math.PI / 180;
      var escapa = h * Math.sin(ri) * Math.sin(rg) * p.perspectiva
        / (p.perspectiva + h * Math.sin(ri) * Math.cos(rg));
      t = 'translateX(calc(' + a.dir.x * Math.ceil(escapa * 100) / 100 + ' * var(--px))) ' + t;
    }
    return { transform: t, origem: a.dir.origem };
  }
  /* A prévia da legenda, desenhada em CSS por cima do player da fonte. É APROXIMAÇÃO e a
     tela diz isso: a quebra de PÁGINA tem um dono só (`toCaptionPages`/`to_pages`) e esta
     caixa NÃO a reimplementa. O que ela prova é fonte, peso, corpo, caixa, as quatro cores,
     coluna, alinhamento e posição — e a primeira palavra acesa como a do karaokê.
     Números em pixels do QUADRO (1080x1920), SEM unidade: o CSS os multiplica por `--px`. */
  function legendaPreviewHTML(clip) {
    var estilo = LEGENDA_AUTO[legendaStyleOf(clip)];
    var familia = legendaValor(clip, 'familia').valor;
    var tamanho = num(legendaValor(clip, 'tamanho').valor);
    var caixa = legendaValor(clip, 'caixaAlta').valor;
    var cor = legendaHex(legendaValor(clip, 'cor').valor) || '#FFFFFF';
    var destaque = legendaHex(legendaValor(clip, 'destaqueCor').valor) || LEGENDA_LEQUE[0];
    var contorno = legendaHex(legendaValor(clip, 'contorno').valor);
    var fundo = legendaHex(legendaValor(clip, 'fundo').valor);
    var largura = num(legendaValor(clip, 'largura').valor);
    var alinha = legendaValor(clip, 'alinhamento').valor;
    var posicao = legendaValor(clip, 'posicaoPct');
    var lateral = legendaValor(clip, 'posicaoXPct');
    var prof = LEGENDA_PROFUNDIDADES[legendaValor(clip, 'profundidade').valor];
    var direcao = legendaValor(clip, 'profundidadeDirecao').valor;
    var prof3d = prof && legProfundidadeTransform(prof, direcao, tamanho, estilo.entrelinha);
    var geo = legGeoDados();
    /* O manual aparece JÁ grampeado pelas faixas do servidor: um corte salvo com 95% sai a
       86% no export, e a prévia não pode prometer outra coisa. */
    var pos = posicao.manual && geo ? legLimite(posicao.valor, geo.faixaPosicao) : posicao.valor;
    var fx = geo && geo.faixaPosicaoX;
    var x = lateral.manual ? (fx ? legLimite(lateral.valor, fx) : 50) : null;
    /* Com X manual a coluna é a EFETIVA do servidor (estreita perto da borda); o número do
       operador vira o máximo. Sem X, a de sempre. */
    if (x !== null && geo && num(geo.legendaLarguraMax) === largura && geo.legendaLargura) {
      largura = num(geo.legendaLargura);
    }
    /* Mesmas regras do `resolveLegenda`: Montserrat só tem 800; caixa apaga a sombra. */
    var peso = familia === 'montserrat' ? 800 : estilo.peso;
    var sombra = fundo ? false : (estilo.sombra || !!legendaHex(estilo.fundo));
    /* O traço CSS é o dobro do contorno visível (`contornoPx` do preset.js). */
    var traco = contorno ? 2 * Math.max(1, Math.round(tamanho * 0.06)) : 0;
    /* A PÁGINA do export sob o player (2026-09-28): até ≤ 2 linhas, cortada pelo mesmo
       algoritmo do MP4 (`captions.paginas_remotion`, porte do `toCaptionPages`). Antes era a
       fala inteira — com coluna estreita, uma torre de linhas (o bloco claro do P9). */
    var fala = legPaginaEm(clip) || 'Assim fica a legenda deste corte';
    return '<div class="vop-leg-prev" data-leg-prev'
      + ' style="--leg-fonte:' + tamanho + ';--leg-col:' + largura + ';--leg-cor:' + esc(cor)
      + ';--leg-peso:' + peso + ';--leg-lh:' + estilo.entrelinha + ';--leg-traco:' + traco
      + (contorno ? ';--leg-contorno:' + esc(contorno) : '')
      + (fundo ? ';--leg-fundo:' + esc(fundo) : '')
      /* Automática: a BASE em px do quadro, exata, do servidor. Manual: a intenção em % do
         quadro, que é o que o arrasto escreve ao vivo (e cai no mesmo pixel do export). */
      + (posicao.manual ? ';--leg-pos:' + num(pos) + '%' : '')
      + (geo ? ';--leg-base:' + num(geo.legendaBaseAuto) : '')
      + (x !== null ? ';--leg-x:' + num(x) + '%' : '')
      + (prof ? ';--leg-3dt:' + esc(prof3d.transform) + ';--leg-origem:' + esc(prof3d.origem)
        + (fundo ? '' : ';--leg-3d:' + esc(legProfundidadeSombra(prof, cor, sombra ? LEG_SOMBRA_PREVIA : '', direcao))) : '')
      + '"'
      + ' data-familia="' + esc(familia) + '" data-caixa="' + (caixa ? '1' : '0') + '"'
      + ' data-sombra="' + (sombra ? '1' : '0') + '"' + (contorno ? ' data-contorno="1"' : '')
      + (prof ? ' data-prof="' + (fundo ? 'inclina' : 'volume') + '"' : '')
      + ' data-align="' + esc(alinha) + '" data-auto="' + (posicao.manual ? '0' : '1') + '"'
      + ' data-auto-x="' + (x === null ? '1' : '0') + '" data-geo="' + (geo ? '1' : '0') + '"'
      + legZonasAttrs(geo) + '>'
      + '<span class="vop-leg-guia" aria-hidden="true"></span>'
      + legZonasHTML(geo)
      + '<span data-leg-prev-text data-pagina="' + esc(fala) + '">'
      + legPrevFalaHTML(fala, destaque, !!fundo)
      + '</span></div>';
  }
  /* As ZONAS da interface do TikTok, desenhadas no quadro enquanto se arrasta e enquanto a
     legenda está dentro de uma delas (2026-09-28: viraram aviso, não trava). Os números vêm
     da rota (`zonas`, px do quadro) — a tela não conhece nenhum. A altura da trilha não é
     documentada: ela vai de cima a baixo, e o rótulo diz "aprox.". */
  function legZonasAttrs(geo) {
    if (!geo || !geo.zonas) return '';
    var a = geo.avisos || {};
    return ' data-zona-trilha="' + (a.trilha ? '1' : '0') + '" data-zona-rodape="' + (a.rodape ? '1' : '0') + '"';
  }
  function legZonasHTML(geo) {
    if (!geo || !geo.zonas) return '';
    /* `div`, não `span`: as regras `.vop-leg-prev > span` são da alça (o texto arrastável). */
    return '<div class="vop-leg-zona" data-zona="trilha" aria-hidden="true"'
      + ' style="left:calc(' + num(geo.zonas.trilhaX) + ' * var(--px))"><em>Botões do TikTok</em></div>'
      + '<div class="vop-leg-zona" data-zona="rodape" aria-hidden="true"'
      + ' style="top:calc(' + num(geo.zonas.rodapeY) + ' * var(--px))"><em>Texto do TikTok</em></div>';
  }
  /* A página que a rota devolveu para o instante do player (relativo ao corte). No vão
     entre duas, a última que já começou; antes da primeira (ou sem player), a primeira.
     Sem as páginas da rota: null — e quem chama mostra a frase de exemplo, nunca a fala
     inteira. */
  function legPaginaEm(clip) {
    var geo = legGeoDados();
    var paginas = geo && Array.isArray(geo.paginas) ? geo.paginas : [];
    /* Páginas de OUTRAS falas (antes da correção chegar ao servidor) mentiriam: nada, e a
       resposta nova repinta a prévia no lugar. */
    if (!clip || !paginas.length || LEG_GEO.dadosFalas !== legGeoFalas(clip)) return null;
    var agora = srcNow();
    var rel = agora === null ? -1 : agora - num(clip.inSec);
    var achada = paginas[0];
    /* Com remoções a página vem no relógio da SAÍDA e traz `fonteStart`/`fonteEnd` (o mesmo
       instante na FONTE, calculado pelo dono em Python): o player toca a fonte, então é por
       eles que se escolhe. Sem remoção os dois campos não existem e vale o de sempre. */
    var ini = function (p) { return p.fonteStart !== undefined ? p.fonteStart : p.start; };
    var fim = function (p) { return p.fonteEnd !== undefined ? p.fonteEnd : p.end; };
    for (var i = 0; i < paginas.length; i++) {
      if (rel >= ini(paginas[i])) achada = paginas[i];
      if (rel >= ini(paginas[i]) && rel < fim(paginas[i])) break;
    }
    return String(achada.text || '') || null;
  }
  /* O miolo da prévia: 1ª palavra acesa como a do karaokê. Uma função só, porque a frase
     troca durante a reprodução (`capTick`) e as duas cópias divergiriam. */
  function legPrevFalaHTML(fala, destaque, caixa) {
    var partes = String(fala).split(' ');
    var texto = '<b data-leg-prev-ativa style="color:' + esc(destaque) + '">' + esc(partes[0]) + '</b>'
      + (partes.length > 1 ? ' ' + esc(partes.slice(1).join(' ')) : '');
    return caixa ? '<span class="vop-leg-prev-caixa">' + texto + '</span>' : texto;
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
  /* Entrada direta nos Clips (decisão do usuário, 2026-09-23). */
  var TAB = 'youtube';
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
  /* A última tentativa de cada ação falhou (sessão). O valor diz QUAL controle falhou —
     `true` ou o preset do render ('legenda' | 'limpo'), que dividem a mesma chave. Some
     quando a ação recomeça (`ytBusy(key, true)`). */
  var YT_FALHA = Object.create(null);
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
  /* O trecho salvo, saneado no que ESTA entrega acrescentou. Nao reescreve mais nada: o
     candidato guarda dezenas de campos do detector, e copia-los aqui um a um seria a lista
     que esquece o proximo. `cardId` de tipo errado SOME em vez de virar `String(objeto)` --
     um id torto faria o corte parecer orfao e a tela anunciaria um card apagado que nunca
     existiu. Chave AUSENTE e o caso de todo trecho salvo antes desta entrega, e ele tem de
     abrir e exportar sem levantar (BP-014). */
  function candidateSanitize(c) {
    if (!c || typeof c !== 'object') return c;
    if (typeof c.cardId !== 'string') delete c.cardId;
    /* Nome do corte gerado na pasta permanente (/clips/<nome>). Tipo errado some: o card
       cairia num player apontando para lixo. */
    if (typeof c.clipSaved !== 'string' || !/^[^\\/]{1,200}$/.test(c.clipSaved)) delete c.clipSaved;
    /* Correção do texto da legenda: passa pelo MESMO validador das falas que vêm do servidor.
       Lista quebrada ou vazia some — e o corte abre com o texto do YouTube, sem levantar. */
    if ('capEdit' in c) {
      var cap = capCuesFrom({ cues: c.capEdit });
      if (cap.length) c.capEdit = cap; else delete c.capEdit;
    }
    /* Capa do TikTok: pelo MESMO validador da tela. Torta ou de outra versão some (o corte
       abre sem capa, sem levantar). */
    if ('capaTikTok' in c) {
      var capa = capaTikTokOf(c.capaTikTok);
      if (capa) c.capaTikTok = capa; else delete c.capaTikTok;
    }
    return c;
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
        candidates: Array.isArray(p.candidates)
          ? p.candidates.slice(0, MAX_CANDIDATES).map(candidateSanitize) : [],
        clipCount: Number(p.clipCount) || 0,
        error: String(p.error || ''),
        note: String(p.note || ''),
        /* A declaração de direitos, gravada POR URL (decisão do usuário, 2026-09-23: o
           original e os cortes têm de continuar disponíveis depois de recarregar). Só o
           booleano `true` vale — qualquer outra coisa é "não declarou". */
        authorized: p.authorized === true
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
  /* Grava a declaração no projeto da URL. O portão continua o mesmo (ytFetchGate, conferido
     duas vezes); o que muda é que ele deixa de cair no recarregamento. */
  function projectAuthWrite(videoId, on) {
    var project = projectFindByVideoId(videoId);
    if (!project || project.authorized === !!on) return false;
    project.authorized = !!on;
    return projectsPersist();
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
    candidates: [], authorized: false, probeError: '',
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
    idle: 'O vídeo ainda não foi importado. Importe para poder tocar, marcar e exportar.',
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
  // Uma prévia local por vez; o original continua sendo a fonte dos exports.
  var SRC_PREVIEW = { key: '', url: '', state: 'idle', error: '' };
  var SRC_PREVIEW_BUSY = false;
  function srcPreviewKey(clip) {
    return clip && srcReady() && ytFetchGate(YT).allowed
      ? [SRC.token, SRC.url, num(clip.inSec), num(clip.outSec)].join('|') : '';
  }
  function srcPreviewDrop() {
    if (SRC_PREVIEW.url) URL.revokeObjectURL(SRC_PREVIEW.url);
    SRC_PREVIEW = { key: '', url: '', state: 'idle', error: '' };
  }
  function srcPreviewSync() {
    var clip = TAB === 'youtube' && YT.detail ? findById(YT.candidates, YT.detail) : null;
    // Voltar à grade conserva a última prévia; reabrir o mesmo corte não recodifica.
    if (!clip && srcReady() && ytFetchGate(YT).allowed) return;
    var key = srcPreviewKey(clip);
    if (key !== SRC_PREVIEW.key) {
      srcPreviewDrop();
      SRC_PREVIEW.key = key;
    }
    if (!key || SRC_PREVIEW_BUSY || SRC_PREVIEW.state !== 'idle') return;
    var pedido = SRC_PREVIEW;
    pedido.state = 'loading';
    SRC_PREVIEW_BUSY = true;
    var query = '?token=' + encodeURIComponent(SRC.token) + '&name=' + encodeURIComponent(SRC.name)
      + '&start=' + num(clip.inSec) + '&end=' + num(clip.outSec)
      + '&profile=horizontal&preview=1&output=' + encodeURIComponent(uid('previa') + '.mp4');
    // Uma requisição de cada vez: se as bordas mudarem durante o corte, só o
    // intervalo mais recente será preparado depois, sem disputar a fila de render.
    fetch('/api/video-cut' + query, { method: 'POST', headers: { Accept: 'video/mp4' } })
      .then(function (response) {
        if (!response.ok) return renderError(response).then(function (m) { throw new Error(m); });
        return response.blob();
      })
      .then(function (blob) {
        if (pedido !== SRC_PREVIEW || key !== srcPreviewKey(clip)) return;
        if (!blob || !blob.size) throw new Error('O arquivo do trecho veio vazio.');
        pedido.url = URL.createObjectURL(blob);
        pedido.state = 'ready';
      })
      .catch(function (error) {
        if (pedido !== SRC_PREVIEW) return;
        pedido.state = 'error';
        pedido.error = cleanText(error && error.message, 250) || 'Não consegui preparar o trecho.';
      })
      .then(function () { SRC_PREVIEW_BUSY = false; renderKeepingScroll(); });
  }
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
    if (!fresco) {
      if (SRC_NODE && SRC_NODE.pause) SRC_NODE.pause();
      SRC_NODE = null;
      return;
    }
    var mesmo = SRC_NODE && SRC_NODE.getAttribute && fresco.getAttribute
      && SRC_NODE.getAttribute('src') === fresco.getAttribute('src');
    if (mesmo && fresco.parentNode && fresco.parentNode.replaceChild) {
      /* A marcação diz se este modo tem controles nativos; o nó vivo obedece. */
      if (fresco.hasAttribute) SRC_NODE.controls = fresco.hasAttribute('controls');
      fresco.parentNode.replaceChild(SRC_NODE, fresco);
      return;
    }
    if (SRC_NODE && SRC_NODE.pause) SRC_NODE.pause();
    SRC_NODE = fresco;
  }
  var CUT_NODES = {};
  function cutAdopt(root) {
    if (!root.querySelectorAll) return;
    var vivos = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-cut-video]'), function (fresco) {
      var src = fresco.getAttribute('src');
      var velho = CUT_NODES[src];
      if (velho && fresco.parentNode) fresco.parentNode.replaceChild(velho, fresco);
      vivos[src] = velho || fresco;
    });
    CUT_NODES = vivos;
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
    var offset = v && v.getAttribute ? Number(v.getAttribute('data-src-offset')) || 0 : 0;
    return (typeof t === 'number' && isFinite(t)) ? t + offset : null;
  }
  function srcSeek(seconds, play) {
    var v = srcVideo();
    if (!v) return false;
    var offset = v.getAttribute ? Number(v.getAttribute('data-src-offset')) || 0 : 0;
    try { v.currentTime = Math.max(0, secs(seconds) - offset); } catch (e) { return false; }
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
    if (estado === 'ready') autoCutsKick();
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
    srcPreviewDrop();
    SRC_SEQ += 1;
    if (SRC_POLL && typeof clearTimeout === 'function') clearTimeout(SRC_POLL);
    SRC_POLL = 0;
    /* O player de OUTRO vídeo não é reaproveitado — sem isto o `srcAdopt` compararia URLs
       diferentes, o que já daria certo, mas o nó velho ficaria pendurado no módulo. */
    if (SRC_NODE && SRC_NODE.pause) SRC_NODE.pause();
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
    projectAuthWrite(videoId, true);
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
  /* Desfazer: pilha da SESSÃO, um passo por frase corrigida (digitar várias letras seguidas
     na mesma frase é UMA correção), ou o texto inteiro quando o passo foi "Restaurar". */
  var CAP_UNDO = [];
  var CAP_LAST = '';
  var CAP_FOCO = { id: '', i: 0 };
  var CAP_STOP = 0;
  var CAP_MSG = {
    wait: 'A transcrição deste trecho aparece aqui depois de importar o vídeo.',
    loading: 'Lendo a legenda deste trecho…',
    ok: 'Isto foi o que o YouTube detectou. Clique numa palavra para corrigir — o texto que ficar aqui é o que entra no vídeo.',
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
    /* A correção salva no projeto (`clip.capEdit`) volta sozinha: sem isto, reabrir a página
       mostraria o texto do YouTube e exportaria SEM a correção que a tela disse ter salvo. */
    if (!entry && cut && Array.isArray(cut.capEdit) && cut.capEdit.length) return capSeed(cut);
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
    CAP_UNDO = CAP_UNDO.filter(function (p) { return p.id !== id; });
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
  function capCopy(list) {
    return list.map(function (c) { return { start: c.start, end: c.end, text: c.text }; });
  }
  /* O estado sai da COMPARAÇÃO com o original, nunca de um histórico de teclas: desfazer à
     mão volta a "ok" sozinho, e apagar tudo é dito (o clip sai sem legenda). */
  function capState(cues, original, semFala) {
    if (!cues.length) return semFala;
    var mudou = cues.length !== original.length || cues.some(function (c, i) {
      var o = original[i];
      return !o || o.text !== c.text || o.start !== c.start || o.end !== c.end;
    });
    if (!mudou) return 'ok';
    return cues.every(function (c) { return !c.text; }) ? 'CAPTIONS_EDITED_EMPTY' : 'edited';
  }
  function capIsEdited(state) { return state === 'edited' || state === 'CAPTIONS_EDITED_EMPTY'; }
  /* A correção salva (`clip.capEdit`) entra por cima do original. Ela nasce do MESMO
     intervalo — `clipBoundaryChanged` a apaga junto com as falas —, então os tempos batem. */
  function capSeed(clip) {
    var original = capCuesFrom({ cues: (clip && clip.clipCues) || [] });
    var salvo = capCuesFrom({ cues: (clip && clip.capEdit) || [] });
    var cues = salvo.length ? salvo : capCopy(original);
    var semFala = clip.captionState && clip.captionState !== 'ok'
      ? clip.captionState : 'CAPTIONS_OUT_OF_RANGE';
    CAPS[clip.id] = {
      inSec: num(clip.inSec), outSec: num(clip.outSec),
      cues: cues, original: original,
      state: capState(cues, original, semFala),
      saved: salvo.length ? true : null
    };
    return CAPS[clip.id];
  }
  function capEdited(cut) {
    var entry = capOf(cut);
    return entry && capIsEdited(entry.state) ? entry.cues : null;
  }
  /* Grava a correção NO PROJETO que já existe (sem chave nova de localStorage) e devolve o
     estado. `saved` diz à tela o que aconteceu de verdade: true gravou, false a cota
     recusou, null é trecho sem projeto (o fluxo local, que vive só na sessão). */
  function capCommit(cut, entry) {
    entry.state = capState(entry.cues, entry.original, entry.state);
    if (capIsEdited(entry.state)) cut.capEdit = capCopy(entry.cues);
    else delete cut.capEdit;
    entry.saved = findById(YT.candidates, cut.id) ? projectsPersist() : null;
    return entry.state;
  }
  function capSaveText(entry) {
    if (!capIsEdited(entry.state)) return 'Sem correções';
    if (entry.saved === true) return 'Correções salvas neste projeto';
    if (entry.saved === false) return 'Não consegui salvar — as correções valem só até fechar a aba';
    return 'Correções guardadas nesta sessão';
  }
  function capUndoCount(id) {
    return CAP_UNDO.filter(function (p) { return p.id === id; }).length;
  }
  /* Qual frase está tocando, em segundos RELATIVOS ao começo do corte. -1 = nenhuma. */
  function capIndexAt(cues, rel) {
    for (var i = 0; i < cues.length; i++) {
      if (rel >= cues[i].start && rel < cues[i].end) return i;
    }
    return -1;
  }
  /* Parágrafos de leitura: quebra na pausa longa, no fim de frase depois de umas quatro
     falas, ou a cada oito. É só leitura — cada fala continua sendo um campo com o tempo dela. */
  function capParagrafos(cues) {
    var out = [[]];
    cues.forEach(function (c, i) {
      var atual = out[out.length - 1];
      var ant = cues[i - 1];
      if (atual.length && ((c.start - ant.end) > 1.5
          || (atual.length >= 4 && /[.?!…]$/.test(ant.text)) || atual.length >= 8)) {
        out.push(atual = []);
      }
      atual.push(i);
    });
    return out;
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
  /* O campo é a FRASE: um trecho de texto editável no parágrafo (contenteditable) ou, no
     "Horários", o número de início/fim. Mexer no texto nunca mexe no tempo — é isso que
     mantém a sincronia —, e tempo fora do trecho ou fim antes do início é recusado com o
     motivo, com o campo voltando ao valor que vale. */
  function capCueWrite(el) {
    var cut = capTarget(el.dataset.id);
    var entry = capOf(cut);
    var i = num(el.dataset.capIndex);
    if (!entry || !entry.cues[i]) return;
    var cue = entry.cues[i];
    var campo = el.dataset.capTime;
    var antes = { start: cue.start, end: cue.end, text: cue.text };
    if (campo === 'start' || campo === 'end') {
      var v = Math.round(secs(el.value) * 100) / 100;
      var dur = num(cut.outSec) - num(cut.inSec);
      var ini = campo === 'start' ? v : cue.start;
      var fim = campo === 'end' ? v : cue.end;
      if (String(el.value).trim() === '' || !(fim > ini) || fim > dur) {
        el.value = String(cue[campo]);
        if (el.setAttribute) el.setAttribute('aria-invalid', 'true');
        toast('Horário recusado: o fim da frase tem de vir depois do início, entre 0 e '
          + dur + ' s do corte.', 'error');
        return;
      }
      if (el.removeAttribute) el.removeAttribute('aria-invalid');
      if (v === cue[campo]) return;
      CAP_UNDO.push({ id: cut.id, i: i, cue: antes });
      CAP_LAST = '';
      cue[campo] = v;
    } else {
      var texto = cleanText(String(el.isContentEditable ? el.textContent : el.value)
        .replace(/\s+/g, ' '), 300);
      if (texto === cue.text) return;
      /* Uma correção por frase: as letras seguidas na mesma frase viram UM passo. */
      if (CAP_LAST !== cut.id + ':' + i) CAP_UNDO.push({ id: cut.id, i: i, cue: antes });
      CAP_LAST = cut.id + ':' + i;
      cue.text = texto;
      var o = entry.original[i];
      if (el.setAttribute) el.setAttribute('data-edited', o && o.text === texto ? '0' : '1');
    }
    capCommit(cut, entry);
    capPaint(el.closest && el.closest('[data-cap-panel]'), entry, cut.id);
    legGeoAgendar();
  }
  /* Atualiza o que cerca o texto SEM re-render: um innerHTML novo por tecla mataria o cursor
     no meio da palavra (BP-001). */
  function capPaint(panel, entry, id) {
    if (!panel || !panel.querySelector) return;
    var cabeca = panel.querySelector('[data-cap-head]');
    if (cabeca) {
      if (entry.saved === false) cabeca.setAttribute('aria-invalid', 'true');
      else cabeca.removeAttribute('aria-invalid');
    }
    var desfazer = panel.querySelector('[data-act="cap-undo"]');
    if (desfazer) desfazer.disabled = !capUndoCount(id);
    var restaurar = panel.querySelector('[data-act="cap-restore"]');
    if (restaurar) restaurar.disabled = !capIsEdited(entry.state);
  }
  function capUndo(id) {
    var k = CAP_UNDO.length - 1;
    while (k >= 0 && CAP_UNDO[k].id !== id) k--;
    if (k < 0) return false;
    var passo = CAP_UNDO.splice(k, 1)[0];
    var cut = capTarget(id);
    var entry = capOf(cut);
    if (!entry) return false;
    if (passo.all) entry.cues = passo.all;
    else if (entry.cues[passo.i]) entry.cues[passo.i] = passo.cue;
    CAP_LAST = '';
    capCommit(cut, entry);
    return true;
  }
  /* Restaurar também é desfazível: a correção inteira vira um passo da pilha. */
  function capRestore(cut) {
    var entry = capOf(cut);
    if (!entry || !entry.original.length || !capIsEdited(entry.state)) return false;
    CAP_UNDO.push({ id: cut.id, all: capCopy(entry.cues) });
    CAP_LAST = '';
    entry.cues = capCopy(entry.original);
    capCommit(cut, entry);
    return true;
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
    var entry = capOf(cut);
    if (!entry && (cut.clipCues || []).length) entry = capSeed(cut);
    /* Sem falas na mão o painel continua de pé e DIZ por quê (BP-008). */
    if (!entry) {
      entry = { cues: [], original: [], state: cut.captionState && cut.captionState !== 'ok'
        ? cut.captionState : (srcReady() ? 'loading' : 'wait') };
    }
    return capHTML(cut.id, entry, cut.inSec, cut.outSec);
  }
  /* Recebe os dados por argumento (e não lê o estado do módulo) para poder ser provado sem
     DOM — mesma regra do mrListHTML. A forma do que aparece na tela é justamente o que
     precisa de teste. */
  /* A transcrição como TEXTO CORRIDO: cada fala é um trecho editável dentro do parágrafo, com
     o tempo guardado nela (nunca à vista). Corrigir é clicar e digitar, como num documento;
     os horários moram no "Horários (avançado)", fechado. */
  function capHTML(id, entry, inSec, outSec) {
    if (!entry) return '';
    var editado = capIsEdited(entry.state);
    /* Editor sem frase (2026-10-01): sem "salvo", sem nota de estado. A única falha que o
       painel mostra é a gravação recusada (cota cheia), como `aria-invalid` no cabeçalho. */
    var abre = '<section class="vop-cap" data-cap-panel data-id="' + esc(id) + '"'
      + ' data-in="' + num(inSec) + '" aria-label="Texto da legenda">'
      + '<div class="vop-cap-head" data-cap-head' + (entry.saved === false ? ' aria-invalid="true"' : '') + '>'
      + '<h3 class="vop-cap-title">Texto da legenda</h3></div>';
    if (!entry.cues.length) return abre + '</section>';
    var dur = Math.max(0, num(outSec) - num(inSec));
    /* Remoções: a fala que cai INTEIRA num trecho removido continua aqui, MARCADA (sumir com
       ela esconderia o que o corte perdeu). Só comparação de intervalos, nenhum remapeamento. */
    var rems = remocoesDoClip(findById(YT.candidates, id));
    var removida = function (cue) {
      var de = (num(inSec) + Number(cue.start)) * 1000, ate = (num(inSec) + Number(cue.end)) * 1000;
      return rems.some(function (r) { return de >= r.deMs && ate <= r.ateMs; });
    };
    var frase = function (i) {
      var cue = entry.cues[i];
      var o = entry.original[i];
      var mudou = !o || o.text !== cue.text;
      var fora = rems.length && removida(cue);
      return '<span class="vop-cap-frase" contenteditable="plaintext-only" spellcheck="true"'
        + (fora ? ' data-removida="1"' : '')
        + ' role="textbox" data-cap-field data-cap-index="' + i + '" data-id="' + esc(id) + '"'
        + ' data-edited="' + (mudou ? '1' : '0') + '"'
        + ' aria-label="Frase em ' + esc(capClock(cue.start)) + (fora ? ' (removida do corte)' : '') + '"'
        + (!fora && mudou && o ? ' title="Original: ' + esc(o.text || '(vazio)') + '"' : '')
        + '>' + esc(cue.text) + '</span>';
    };
    return abre
      + '<div class="vop-cap-read">'
      + capParagrafos(entry.cues).map(function (p) {
        return '<p>' + p.map(frase).join(' ') + '</p>';
      }).join('')
      + '</div>'
      + '<div class="vop-cap-acts">'
      + '<button class="vop-inline-action" type="button" data-act="cap-play" data-id="' + esc(id) + '">'
      + 'Ouvir a frase selecionada</button>'
      + '<button class="vop-inline-action" type="button" data-act="cap-undo" data-id="' + esc(id) + '"'
      + (capUndoCount(id) ? '' : ' disabled') + '>Desfazer</button>'
      + '<button class="vop-inline-action" type="button" data-act="cap-restore" data-id="' + esc(id) + '"'
      + (editado ? '' : ' disabled') + '>Restaurar texto do YouTube</button>'
      + '</div>'
      + legMaisHTML('horarios', 'Horários (avançado)',
        '<ol class="vop-cap-times">'
        + entry.cues.map(function (cue, i) {
          var campo = function (qual, rotulo) {
            return '<input class="vop-cap-t" type="number" step="0.1" min="0" max="' + dur + '"'
              + ' value="' + cue[qual] + '" data-cap-field data-cap-time="' + qual + '"'
              + ' data-cap-index="' + i + '" data-id="' + esc(id) + '"'
              + ' aria-label="' + rotulo + ' da frase ' + (i + 1) + ', em segundos">';
          };
          return '<li>' + campo('start', 'Início') + '<span aria-hidden="true">→</span>'
            + campo('end', 'Fim') + '<span class="vop-cap-t-text">' + esc(cue.text) + '</span></li>';
        }).join('')
        + '</ol>')
      + '</section>';
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
     Um cartão por clip baixado, com o nome do clip, o intervalo e o botão de baixar de
     novo. Agrupado pelo nome do vídeo de origem. Continua sem direito, aprovação por
     hash, agendamento ou métrica — a decisão do corte já foi tomada.
     Desde 2026-09-10 tem UMA saída para fora da máquina: enviar o MP4 para os rascunhos
     do TikTok (`ttPublish`). É envio de arquivo, não pipeline de publicação. */
  /* Uma linha, não um painel: conectar a conta é tarefa de uma vez por ano, e um banner
     permanente cobraria atenção toda visita. Enquanto o worker não respondeu (`checked`
     falso) não desenha nada — afirmar "desconectado" antes de perguntar pisca uma
     informação errada. */
  /* Recebe o estado por PARÂMETRO (com o do módulo como padrão) para o teste conseguir
     exercitar os três desfechos sem montar meia tela. É a lição do `renderBody`: função de
     render que só existe dentro do fetch nunca é provada, e o ramo errado passa verde. */
  function ttStripHTML(estado) {
    var TT_ = estado || ttState();
    if (!TT_.checked) return '';
    if (TT_.connected) {
      return '<p class="vop-form-note">TikTok conectado'
        + (TT_.username ? ' como <strong>' + esc(TT_.username) + '</strong>' : '')
        + '. O envio vai para os <strong>rascunhos</strong> do app — você termina e publica no celular. '
        + '<button class="vop-inline-action" type="button" data-act="tt-logout">Desconectar</button></p>';
    }
    return '<p class="vop-form-note">Nenhuma conta do TikTok conectada. '
      + '<button class="vop-inline-action" type="button" data-act="tt-connect">Conectar conta do TikTok</button></p>';
  }
  /* UM parâmetro, e assim fica: o chamador é `group.items.map(libCardHTML)`, e `map` passa
     (item, índice, array). Um segundo parâmetro aqui receberia o ÍNDICE — falsy no primeiro
     cartão, truthy nos demais — e ligaria o botão do TikTok em todos menos o primeiro, sem
     erro nenhum. Quem precisa do estado da conta lê `ttState()`. */
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
      /* Só oferece enviar o que o worker consegue achar em disco. Sem cópia local o
         botão seria um clique que só sabe falhar — a linha do rodapé já explica por quê. */
      + (url && TT.connected
        ? '<button class="vop-btn vop-btn-secondary" type="button" data-act="tt-publish" data-id="' + esc(clip.id) + '">Enviar ao TikTok</button>'
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
      + ttStripHTML()
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
  /* O estilo que encaixa o quadro recortado dentro da moldura. Vive aqui porque o card da
     grade e a coluna do editor mostram o MESMO quadro: duas cópias desta conta divergiriam
     caladas, e o recorte errado não parece defeito, parece outro instante do vídeo. */
  function sbStyle(frame) {
    return 'width:' + frame.escala[0] + '%;height:' + frame.escala[1] + '%;'
      + 'transform:translate(' + frame.desloca[0].toFixed(4) + '%,' + frame.desloca[1].toFixed(4) + '%)';
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
        + ' style="' + sbStyle(frame) + '"'
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
      out.rotulo = ocupado ? 'Gerando…' : YT_FALHA['fetch:' + clip.id] ? ROTULO_FALHOU
        : (exportado ? 'Gerar de novo' : 'Baixar trecho original');
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
          + (clip.clipSaved
            ? '<a role="menuitem" href="/clips/' + esc(encodeURIComponent(clip.clipSaved)) + '" download="' + esc(clip.clipSaved) + '">'
              + 'Baixar trecho original<small>o corte já salvo neste computador · ' + esc(fmtBytes(clip.clipBytes)) + '</small></a>'
            : '<button type="button" role="menuitem" data-act="yt-fetch" data-id="' + esc(clip.id) + '"'
          + (status.podeBaixar ? '' : ' disabled') + '>'
          + esc('Baixar trecho original')
          + '<small>' + esc(status.podeBaixar
            ? 'recorte cru do vídeo importado, sem edição — segundos'
            : ('bloqueado: ' + (status.motivo || 'sem permissão'))) + '</small></button>')
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
    var pos = ytRank(clip);
    var arquivo = clip.clipSaved ? '/clips/' + encodeURIComponent(clip.clipSaved) : '';
    var gerando = AUTO_CUT === clip.id || !!YT_BUSY['fetch:' + clip.id];
    var falhou = !arquivo && !gerando ? AUTO_CUT_FAIL[clip.id] : '';
    /* Justificativa = a evidência do detector; sem ela, o motivo. Sem os dois, a tela diz. */
    var porque = clip.evidence || clip.reason || 'O detector não registrou justificativa para este trecho.';
    return '<article class="yt-card" data-clip="' + esc(clip.id) + '">'
      + (arquivo
        ? '<video class="yt-card-video" data-cut-video src="' + esc(arquivo) + '" controls preload="metadata" playsinline></video>'
        : ytThumbHTML(clip))
      + '<div class="yt-card-body">'
      + '<p class="yt-card-pos">' + (pos ? '<strong>#' + pos + '</strong> recomendado' : 'Sem classificação do detector') + '</p>'
      + '<h3 class="yt-card-title">' + esc(clip.topic) + '</h3>'
      + '<div class="yt-card-meta">'
      + '<span class="yt-range">' + esc(fmtClock(clip.inSec) + ' → ' + fmtClock(clip.outSec)) + '</span>'
      + faixa + status.chip + '</div>'
      + '<p class="yt-card-why">' + esc(porque) + '</p>'
      + (gerando ? '<p class="yt-card-gen" role="status">Gerando o corte…</p>' : '')
      + (falhou ? '<p class="yt-card-warn">O corte falhou: ' + esc(falhou)
        + ' <button class="vop-btn vop-btn-quiet" type="button" data-act="yt-cuts-retry">Tentar novamente</button></p>' : '')
      + (clip.contextWarning ? '<p class="yt-card-warn">' + esc(clip.contextWarning) + '</p>' : '')
      /* `status.nota` NÃO entra no card da grade: ela fala da FONTE (não importada / falhou),
         que é a mesma para todos os cards e já é dita uma vez nas etapas e na faixa da
         importação. Repetida em cada card virava ruído amarelo. O editor continua mostrando. */
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
    return '<section class="yt-factors"><h4>Nota interna (só ordena a lista)'
      + (num(clip.score) ? ' <span>' + num(clip.score) + '/100</span>' : '') + '</h4>'
      + '<ul>' + fatores.map(function (f) {
        var pct = Math.round(Math.max(0, Math.min(1, Number(f.value) || 0)) * 100);
        return '<li><span class="yt-factor-name">' + esc(f.label) + '</span>'
          + '<span class="yt-factor-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>'
          + '<span class="yt-factor-val">' + pct + '% de ' + num(f.weight) + ' pts</span>'
          + '<small>' + esc(f.note) + '</small></li>';
      }).join('') + '</ul></section>';
  }
  /* Uma borda: campo digitável, os dois empurrões de 1 s e "daqui" — que lê o instante do
     player. É "daqui" que cumpre o pedido de escolher pontos FORA do intervalo recomendado
     sem digitar tempo: o operador arrasta a barra até onde quer e clica. */
  function ytEdgeHTML(clip, edge, rotulo, valor) {
    var id = esc(clip.id);
    var lado = edge === 'in' ? 'Começar' : 'Terminar';
    return '<div class="yt-trim-row">'
      + '<label>' + esc(rotulo) + '<input type="text" inputmode="numeric" data-trim="' + edge + '"'
      + ' data-id="' + id + '" value="' + esc(fmtClock(valor)) + '" size="7" spellcheck="false"'
      + (YT_TRIM_INVALIDO[clip.id] ? ' aria-invalid="true"' : '') + '></label>'
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
      + ytEdgeHTML(clip, 'in', 'Começa em', clip.inSec)
      + ytEdgeHTML(clip, 'out', 'Termina em', clip.outSec)
      + '<div class="yt-trim-row"><button class="vop-btn" type="button" data-act="yt-trim-apply" data-id="' + esc(clip.id) + '">Aplicar tempos digitados</button>'
      + '<small class="yt-trim-dur">' + esc(fmtClock(num(clip.outSec) - num(clip.inSec))) + '</small></div>'
      + '</fieldset>';
  }
  /* --- A coluna da ESQUERDA do editor (2026-09-22, decisão do usuário) -------------------
     O vídeo fica ao LADO dos controles que o mudam. Até esta entrega o player era uma faixa
     de largura inteira no alto da tela e a coluna esquerda do editor guardava TEXTO, com um
     parágrafo dizendo "a prévia é o player acima" — ou seja, ajustar a borda de um corte
     exigia olhar para um lugar e mexer em outro.

     A queda, quando a fonte não está importada, é o QUADRO DO COMEÇO DO CORTE, e ele não é a
     mesma coisa que a CAPA do vídeo: a capa é um instante qualquer escolhido por terceiro, e
     pôr uma no lugar da outra é a miniatura fingindo ser o trecho — o defeito que os rótulos
     desta tela existem para não ter. Por isso `YT.thumbnail` NÃO entra aqui. Na grade ela
     entra, rotulada, porque lá a pergunta é "que vídeo é este?"; aqui é "como começa ESTE
     corte?". Sem storyboard também não há invenção: a coluna diz que o vídeo não está no
     Estúdio e oferece a importação (BP-008).

     O quadro REAL do corte existe e custa um render (`/api/remotion-still`): ele continua
     onde está, no botão "Ver o quadro real" do painel da legenda, e não vira o fallback
     daqui — seria uma chamada de render por trecho aberto. */
  function ytStageHTML(clip, gate) {
    if (srcReady()) return srcPanelHTML();
    var frame = sbFrame(clip);
    var liberado = !!(gate && gate.allowed);
    /* Editor sem frase (decisão do usuário, 2026-10-01): sem fonte, a coluna é a moldura e
       UM botão que carrega o estado no rótulo — "Importar vídeo", "Baixando o vídeo inteiro ·
       40%" (com a barra; o `srcRefresh` os anda NO LUGAR pelo `data-src-strip`) ou "Falhou ·
       tentar de novo". Sem declaração ele fica desabilitado; o portão em
       pessoa é a `.yt-hero`, que aparece acima quando a declaração falta. */
    var importando = SRC.state === 'importing';
    var pct = Math.max(0, Math.min(100, num(SRC.percent)));
    var rotulo = importando ? srcStageLabel() + ' · ' + pct + '%'
      : SRC.state === 'error' ? ROTULO_FALHOU : 'Importar vídeo';
    return '<div class="yt-stage-off" data-src-strip data-state="' + esc(SRC.state) + '">'
      + '<div class="yt-stage-frame"' + (frame ? '' : ' data-vazio="1"') + '>'
      + (frame
        ? '<img src="' + esc(frame.url) + '" alt="" loading="lazy" decoding="async"'
          + ' style="' + sbStyle(frame) + '" onload="this.dataset.pronto=\'1\'"'
          + ' onerror="this.closest(\'.yt-stage-frame\').dataset.vazio=\'1\'">'
        : '')
      + '</div>'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="yt-import"'
      + (liberado && !importando ? '' : ' disabled') + (importando ? ' aria-busy="true" data-src-line' : '') + '>'
      + esc(rotulo) + '</button>'
      + (importando ? srcBarHTML(pct) : '')
      + '</div>';
  }
  /* --- o seletor do corte e o editor da biblioteca ------------------------------------
     Radios NATIVOS, como o estilo de legenda e o enquadramento: o `:checked` desenha o
     selecionado, a navegação por seta vem de graça e não há JS de estado visual para
     dessincronizar do dado. Um grupo por corte — um `name` só faria os cartões brigarem. */
  function cardStyleFieldHTML(clip) {
    var lista = cardsList();
    var semCard = titleCardStyleOf(clip) === TITLE_CARD_SEM;
    var atual = semCard ? '' : cardIdOf(clip);
    var idSem = 'cardpick-' + clip.id + '-nenhum';
    return '<fieldset class="vop-cardstyle vop-cardpick"><legend>Card visual</legend>'
      + lista.map(function (card) {
        var id = 'cardpick-' + clip.id + '-' + card.id;
        return '<input type="radio" id="' + esc(id) + '" name="cardpick-' + esc(clip.id) + '"'
          + ' data-clip-field="cardId" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(card.id) + '"' + (atual === card.id ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(cardRotulo(card)) + '</label>';
      }).join('')
      + '<input type="radio" id="' + esc(idSem) + '" name="cardpick-' + esc(clip.id) + '"'
      + ' data-clip-field="cardId" data-id="' + esc(clip.id) + '" value=""'
      + (semCard ? ' checked' : '') + '>'
      + '<label for="' + esc(idSem) + '">' + esc(TITLE_CARD_LABELS[TITLE_CARD_SEM]) + '</label>'
      /* O caminho para a biblioteca fica AQUI, ao lado da escolha: com a biblioteca vazia
         este é o único jeito de sair do lugar, e o texto do botão diz qual dos dois casos é
         (BP-008 — o ramo que não tem o que oferecer também fala). */
      + '<button class="vop-inline-action" type="button" data-act="cards-open">'
      + (lista.length ? 'Gerenciar cards' : 'Criar o primeiro card') + '</button>'
      + '</fieldset>';
  }

  /* O `<input type="color">` só entende `#rrggbb`. O valor RESOLVIDO pode ser `rgba(...)` —
     é o que os padrões usam, para o contorno não virar moldura acesa —, então o seletor abre
     no hex equivalente e a AMOSTRA ao lado mostra a cor de verdade, com a transparência.
     PURA: o teste chama com valor construído. */
  function corHex(valor) {
    var s = String(valor == null ? '' : valor).trim();
    var longo = /^#([0-9a-f]{6})$/i.exec(s);
    if (longo) return '#' + longo[1].toLowerCase();
    var curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
    if (curto) {
      return ('#' + curto[1] + curto[1] + curto[2] + curto[2] + curto[3] + curto[3]).toLowerCase();
    }
    var rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(s);
    if (!rgb) return '#ffffff';
    return '#' + [1, 2, 3].map(function (i) {
      return ('0' + Math.min(255, Number(rgb[i])).toString(16)).slice(-2);
    }).join('');
  }

  /* A linha de um controle. MESMA estrutura (e mesmo CSS) do painel manual da legenda: é a
     mesma pergunta — "mudar uma coisa e poder voltar" — e duas formas diferentes para ela
     seriam dois lugares para calibrar. O botão "auto" existe SEMPRE e fica desabilitado
     quando não há o que desfazer: um botão que aparece e some muda a largura da linha no
     meio do ajuste. `comAuto: false` é para os campos que SÃO a identidade (nome, texto,
     logo) — eles não têm padrão para voltar. */
  function cardRowHTML(card, chave, rotulo, controle, comAuto) {
    var estado = cardValor(card, chave);
    return '<div class="vop-leg-row" data-card-row="' + esc(chave) + '"'
      + ' data-manual="' + (estado.manual ? '1' : '0') + '">'
      + '<span class="vop-leg-lab">' + esc(rotulo) + '</span>'
      + '<div class="vop-leg-ctl">' + controle + '</div>'
      + (comAuto
        ? '<button class="vop-leg-auto" type="button" data-act="card-auto"'
          + ' data-id="' + esc(card.id) + '" data-key="' + esc(chave) + '"'
          + (estado.manual ? '' : ' disabled')
          + ' aria-label="Voltar ' + esc(rotulo.toLowerCase()) + ' ao padrão">auto</button>'
        : '<span class="vop-leg-auto vop-leg-auto-vazio" aria-hidden="true"></span>')
      + '</div>';
  }
  function cardTextRowHTML(card, chave, rotulo, teto, dica) {
    var estado = cardValor(card, chave);
    return cardRowHTML(card, chave, rotulo,
      '<input class="vop-card-text" type="text" maxlength="' + teto + '"'
      + ' value="' + esc(estado.valor) + '" spellcheck="false"'
      + ' data-card-field="' + esc(chave) + '" data-id="' + esc(card.id) + '"'
      + ' placeholder="' + esc(dica) + '" aria-label="' + esc(rotulo) + '">', false);
  }
  function cardColorRowHTML(card, chave, rotulo) {
    var estado = cardValor(card, chave);
    return cardRowHTML(card, chave, rotulo,
      '<span class="vop-card-sw" style="--sw:' + esc(estado.valor) + '" aria-hidden="true"></span>'
      + '<input class="vop-card-cor" type="color" value="' + esc(corHex(estado.valor)) + '"'
      + ' data-card-field="' + esc(chave) + '" data-id="' + esc(card.id) + '"'
      + ' aria-label="' + esc(rotulo) + '">'
      + '<output data-card-out="' + esc(chave) + '">' + esc(estado.valor) + '</output>', true);
  }
  /* `<select>` e nunca campo livre: peso que o `loadFont` do Clip.jsx não carregou o Chrome
     SINTETIZA, e sai um engrossamento borrado que só aparece olhando o quadro. */
  function cardPesoRowHTML(card, chave, rotulo) {
    var estado = cardValor(card, chave);
    return cardRowHTML(card, chave, rotulo,
      '<select class="vop-card-sel" data-card-field="' + esc(chave) + '"'
      + ' data-id="' + esc(card.id) + '" aria-label="' + esc(rotulo) + '">'
      + CARD_PESOS.map(function (p) {
        return '<option value="' + p + '"' + (Number(estado.valor) === p ? ' selected' : '')
          + '>' + p + ' ' + esc(CARD_PESO_LABELS[p] || '') + '</option>';
      }).join('') + '</select>', true);
  }
  function cardSubRowHTML(card) {
    var estado = cardValor(card, 'destaqueSublinhado');
    return cardRowHTML(card, 'destaqueSublinhado', 'Sublinhar destaque',
      '<div class="vop-leg-seg">'
      + [['false', 'Não'], ['true', 'Sim']].map(function (o) {
        var id = 'cardsub-' + card.id + '-' + o[0];
        return '<input type="radio" id="' + esc(id) + '" name="cardsub-' + esc(card.id) + '"'
          + ' data-card-field="destaqueSublinhado" data-id="' + esc(card.id) + '"'
          + ' value="' + o[0] + '"' + (String(!!estado.valor) === o[0] ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + o[1] + '</label>';
      }).join('') + '</div>', true);
  }
  /* O logo. A PROPORÇÃO é medida no arquivo carregado e fica à vista: é o número que decide
     a largura da placa no quadro, e chutá-lo é o que transforma um emblema circular em
     elipse. O teto de 512 KB é dito ANTES de o operador esbarrar nele. */
  function cardLogoRowHTML(card) {
    var c = cardOf(card);
    var temLogo = !!(c && c.logo);
    return cardRowHTML(card, 'logo', 'Logo da placa',
      '<input class="vop-card-file" type="file"'
      + ' accept="image/png,image/svg+xml,image/jpeg,image/webp"'
      + ' data-card-logo data-id="' + esc(card.id) + '" aria-label="Escolher arquivo do logo">'
      + (temLogo
        ? '<span class="vop-card-logostate">proporção '
          + c.logoProporcao.toFixed(2) + ':1</span>'
          + '<button class="vop-inline-action" type="button" data-act="card-logo-clear"'
          + ' data-id="' + esc(card.id) + '">Remover</button>'
        : '<span class="vop-card-logostate">sem logo</span>'),
      false);
  }
  /* A PRÉVIA, desenhada em CSS sobre a paleta do card. É APROXIMAÇÃO e a tela diz isso: a
     tipografia final é a Inter que o Remotion carrega, a escada de corpo é do
     `tituloEscalonado` e o quadro real continua saindo do `/api/remotion-still`, do corte.
     É o MESMO par de prévias que o editor da legenda já usa — não há um terceiro.
     Toda cor daqui passou pelo `cardOf`, então o que entra no `style` é valor de um conjunto
     conhecido e nunca texto arbitrário. */
  function cardPreviewHTML(card) {
    var c = cardOf(card);
    if (!c) {
      return '<div class="vop-cardprev vop-cardprev-vazio"></div>';
    }
    return '<div class="vop-cardprev" data-card-prev aria-hidden="true"'
      + ' style="--c-filete:' + esc(c.fileteCor) + ';--c-borda:' + esc(c.bordaCor)
      + ';--c-ident:' + esc(c.identificadorCor) + ';--c-destaque:' + esc(c.destaqueCor)
      + ';--c-peso:' + c.tituloPeso + ';--c-peso-d:' + c.destaquePeso + '">'
      + '<i class="vop-cardprev-filete"></i>'
      + '<div class="vop-cardprev-marca">'
      + (c.logo
        ? '<img src="' + esc(c.logo) + '" alt=""'
          + ' style="width:' + (34 * c.logoProporcao).toFixed(1) + 'px">'
        : '')
      + (c.identificador ? '<span>' + esc(c.identificador) + '</span>' : '')
      + '</div>'
      + '<p class="vop-cardprev-titulo">Saiu de uma pequena cidade, para '
      + '<b' + (c.destaqueSublinhado ? ' data-sub="1"' : '') + '>100 mil pedidos</b> no Brasil.</p>'
      + '</div>';
  }
  function cardEditorHTML(card) {
    var apagando = CARD_DEL === card.id;
    return '<div class="vop-card-edit" data-card-edit="' + esc(card.id) + '">'
      + '<div data-card-prev-slot>' + cardPreviewHTML(card) + '</div>'
      + cardTextRowHTML(card, 'nome', 'Nome na lista', CARD_NOME_MAX, '')
      + cardTextRowHTML(card, 'identificador', 'Texto ao lado', CARD_IDENTIFICADOR_MAX,
        '')
      + cardLogoRowHTML(card)
      + cardColorRowHTML(card, 'fileteCor', 'Cor do filete')
      + cardColorRowHTML(card, 'bordaCor', 'Cor da borda')
      + cardColorRowHTML(card, 'identificadorCor', 'Cor do texto ao lado')
      + cardColorRowHTML(card, 'destaqueCor', 'Cor do destaque')
      + cardPesoRowHTML(card, 'tituloPeso', 'Peso do título')
      + cardPesoRowHTML(card, 'destaquePeso', 'Peso do destaque')
      + cardSubRowHTML(card)
      + '<div class="vop-card-acts">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="card-dup"'
      + ' data-id="' + esc(card.id) + '">Duplicar</button>'
      /* Confirmação NO LUGAR, nunca um `confirm()` do navegador: o diálogo nativo rouba o
         foco, não diz o que a exclusão custa e trava a aba. E nunca por duplo clique numa
         lista cujo handler de clique re-renderiza (BP-001). */
      + (apagando
        ? '<span class="vop-card-confirm" role="alert">Apagar "' + esc(cardRotulo(card)) + '"?'
          + '<button class="vop-btn vop-btn-danger" type="button" data-act="card-del-yes"'
          + ' data-id="' + esc(card.id) + '">Apagar mesmo assim</button>'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="card-del-no">Cancelar</button>'
          + '</span>'
        : '<button class="vop-btn vop-btn-quiet" type="button" data-act="card-del"'
          + ' data-id="' + esc(card.id) + '">Apagar</button>')
      + '</div>'
      + '</div>';
  }
  function cardsPanelHTML() {
    var lista = cardsList();
    var card = cardFind(CARD_EDIT) || lista[0] || null;
    return '<section class="vop-cards" data-cards' + (CARD_FALHA ? ' aria-invalid="true"' : '') + '>'
      + '<div class="vop-cards-top"><h4>Biblioteca de cards</h4>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="cards-close">Voltar</button>'
      + '</div>'
      + '<div class="vop-cards-list">'
      + lista.map(function (c) {
        return '<button class="vop-cards-item" type="button" data-act="card-edit"'
          + ' data-id="' + esc(c.id) + '"'
          + (card && c.id === card.id ? ' aria-current="true"' : '') + '>'
          + esc(cardRotulo(c)) + '</button>';
      }).join('')
      + '<button class="vop-cards-item vop-cards-new" type="button" data-act="card-new">'
      + '+ Novo card</button>'
      + '</div>'
      + (card ? cardEditorHTML(card) : '')
      + '</section>';
  }

  /* --- escrita e atualizacao NO LUGAR dos controles do card ---------------------------
     O DOM e ENTRADA: o valor do controle passa pelo `cardFieldWrite`, que passa pelo
     `cardOf` -- nada e gravado cru. Sem re-render, como o titulo do trecho: reescrever o
     painel a cada tecla tiraria o foco do campo (BP-001). O que muda na hora e a PREVIA, a
     faixa de estado e o marcador de cada linha, atualizados no lugar. */
  function cardFieldFromDom(input, gravar) {
    var chave = input.dataset.cardField;
    var valor = input.value;
    /* O `value` de um radio e SEMPRE string: 'false' e verdadeiro em JavaScript, e sem esta
       conversao marcar "Nao" ligaria o sublinhado. */
    if (chave === 'destaqueSublinhado') valor = valor === 'true';
    else if (chave === 'tituloPeso' || chave === 'destaquePeso') valor = Number(valor);
    var falha = cardFieldWrite(input.dataset.id, chave, valor, gravar);
    CARD_MSG = falha;
    CARD_FALHA = !!falha;
    if (falha) toast(falha, 'error');
    cardRefresh(input.dataset.id);
    return !falha;
  }
  function cardRefresh(id) {
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    if (!raiz) return;
    var card = cardFind(id);
    var slot = raiz.querySelector('[data-card-prev-slot]');
    if (slot && card) slot.innerHTML = cardPreviewHTML(card);
    var painel = raiz.querySelector('[data-cards]');
    if (painel) {
      if (CARD_FALHA) painel.setAttribute('aria-invalid', 'true');
      else painel.removeAttribute('aria-invalid');
    }
    if (!card) return;
    raiz.querySelectorAll('[data-card-row]').forEach(function (linha) {
      var estado = cardValor(card, linha.dataset.cardRow);
      linha.dataset.manual = estado.manual ? '1' : '0';
      var botao = linha.querySelector('[data-act="card-auto"]');
      if (botao) botao.disabled = !estado.manual;
      var saida = linha.querySelector('[data-card-out]');
      if (saida) saida.textContent = estado.valor;
    });
  }
  /* Upload do logo: arquivo -> dataURL -> proporcao MEDIDA na imagem carregada. A medicao
     acontece ANTES de gravar, e um arquivo que nao da para medir e RECUSADO com o motivo:
     proporcao chutada distorce a placa, e num emblema circular vira elipse. */
  function cardLogoPick(id, file) {
    if (!file || typeof FileReader === 'undefined') return;
    var leitor = new FileReader();
    leitor.onerror = function () {
      CARD_MSG = 'Não consegui ler este arquivo.';
      CARD_FALHA = true;
      toast(CARD_MSG, 'error');
      cardRefresh(id);
    };
    leitor.onload = function () {
      var dataUrl = String(leitor.result || '');
      cardLogoMedir(dataUrl, function (proporcao, erro) {
        if (erro) { CARD_MSG = erro; CARD_FALHA = true; toast(erro, 'error'); cardRefresh(id); return; }
        var falha = cardLogoWrite(id, dataUrl, proporcao);
        CARD_FALHA = !!falha;
        CARD_MSG = falha || ('Logo carregado. Proporção medida no arquivo: '
          + proporcao.toFixed(2) + ':1.');
        if (falha) toast(falha, 'error');
        /* Aqui SIM re-renderiza: a linha do logo troca de FORMA (ganha o "Remover" e o
           numero medido), e e um gesto deliberado. O `renderKeepingScroll` guarda a rolagem
           (BP-013) e o `srcAdopt` preserva o `<video>` da fonte. */
        renderKeepingScroll();
      });
    };
    leitor.readAsDataURL(file);
  }
  function cardLogoMedir(dataUrl, cb) {
    if (typeof Image === 'undefined') {
      cb(0, 'Este navegador não consegue medir a imagem.');
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        cb(img.naturalWidth / img.naturalHeight, '');
        return;
      }
      /* SVG sem largura/altura intrinsecas reporta 0 nos dois lados. A proporcao sai do
         `viewBox`; sem ele, o arquivo e recusado em vez de receber um chute. */
      var prop = svgViewBoxRatio(dataUrl);
      if (prop) { cb(prop, ''); return; }
      cb(0, 'Este SVG não declara largura/altura nem viewBox, e proporção chutada distorce '
        + 'o logo. Exporte-o com viewBox, ou use PNG.');
    };
    img.onerror = function () { cb(0, 'Não consegui abrir esta imagem.'); };
    img.src = dataUrl;
  }

  /* ==================================================================================
     REMOVER TRECHOS DO MEIO (2026-09-30, decisão do usuário)
     `clip.edit.remocoes = [{ deMs, ateMs }]` em ms da FONTE (espelho do `remocoesOf` do
     preset.js). O DONO do mapa de tempo é o `captions.mapa_saida` em Python: aqui não há
     fórmula de remapear — a tela só confere o gesto, PULA os trechos na prévia e mostra a
     duração resultante (aproximada; a exata sai do servidor). Mexer nas remoções invalida o
     MP4 editado exportado, NUNCA a fonte, o `id`, as falas ou a correção de texto. */
  /* Espelho LITERAL do `captions.REMOCAO_MIN_MS`/`PEDACO_MIN_MS`/`REMOCOES_MAX` (test_serve). */
  var REMOCAO_MIN_MS = 200;
  var PEDACO_MIN_MS = 300;
  var REMOCOES_MAX = 30;
  var REM_INICIO = Object.create(null);  /* sessão: o "Marcar início" ainda sem fim */
  var REM_MSG = Object.create(null);

  function remocoesOf(valor) {
    if (!Array.isArray(valor)) return [];
    var saida = [];
    valor.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var de = r.deMs, ate = r.ateMs;
      if (![de, ate].every(function (v) { return typeof v === 'number' && isFinite(v) && v >= 0; })) return;
      de = Math.round(de); ate = Math.round(ate);
      if (ate > de) saida.push({ deMs: de, ateMs: ate });
    });
    return saida.sort(function (a, b) { return a.deMs - b.deMs || a.ateMs - b.ateMs; }).slice(0, REMOCOES_MAX);
  }
  function remocoesDoClip(clip) { return (clip && editOf(clip).remocoes) || []; }
  /* O MP4 editado deste corte deixou de ser este corte. Diferente do `clipBoundaryChanged`:
     a BORDA não mudou, então as falas, a correção de texto e o corte cru (`clipSaved`) seguem
     valendo — só o registro do EXPORTADO sai, e o `rev` sobe. */
  function clipEditadoInvalido(clip) {
    clip.rev = num(clip.rev) + 1;
    clip.clipToken = '';
    clip.clipFilename = '';
    clip.clipBytes = 0;
  }
  function remocoesWrite(clip, lista) {
    var edit = editOf(clip);
    var limpa = remocoesOf(lista);
    if (limpa.length) edit.remocoes = limpa; else delete edit.remocoes;
    clip.edit = editOf({ edit: edit });
    clipEditadoInvalido(clip);
    return true;
  }
  /* O gesto de remover, conferido ANTES de gravar — cada recusa diz o que fazer (BP-008). */
  function remocaoConfere(clip, deMs, ateMs) {
    var inMs = num(clip.inSec) * 1000, outMs = num(clip.outSec) * 1000;
    if (!(ateMs > deMs)) return 'O fim tem de vir depois do início.';
    if (deMs <= inMs || ateMs >= outMs) return 'O trecho encosta na borda do corte: para tirar o começo ou o fim, mova a borda do corte em vez de remover.';
    if (deMs - inMs < PEDACO_MIN_MS || outMs - ateMs < PEDACO_MIN_MS) return 'Sobraria menos de 0,3 s antes ou depois: mova a borda do corte em vez de remover.';
    if (ateMs - deMs < REMOCAO_MIN_MS) return 'Trecho curto demais (mínimo 0,2 s).';
    var lista = remocoesDoClip(clip);
    if (lista.length >= REMOCOES_MAX) return 'Limite de ' + REMOCOES_MAX + ' trechos removidos.';
    if (lista.some(function (r) { return deMs < r.ateMs && ateMs > r.deMs; })) return 'Este trecho se sobrepõe a outro já removido — desfaça o outro primeiro.';
    return '';
  }
  function remocaoMarcar(clipId, ponta) {
    var clip = findById(YT.candidates, clipId);
    var t = srcNow();
    if (!clip || t === null) { toast('O player não está pronto — importe o vídeo e tente de novo.', 'error'); return; }
    var ms = Math.round(t * 1000);
    if (ponta === 'inicio') {
      REM_INICIO[clip.id] = ms;
      delete REM_MSG[clip.id];
    } else if (typeof REM_INICIO[clip.id] !== 'number') {
      REM_MSG[clip.id] = true;
    } else {
      var motivo = remocaoConfere(clip, REM_INICIO[clip.id], ms);
      if (motivo) REM_MSG[clip.id] = true;
      else {
        remocoesWrite(clip, remocoesDoClip(clip).concat([{ deMs: REM_INICIO[clip.id], ateMs: ms }]));
        delete REM_INICIO[clip.id];
        delete REM_MSG[clip.id];
        projectsPersist();
      }
    }
    renderKeepingScroll();
  }
  function remocaoDesfazer(clipId, indice) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) return;
    var lista = remocoesDoClip(clip).slice();
    if (!(indice >= 0 && indice < lista.length)) return;
    lista.splice(indice, 1);
    remocoesWrite(clip, lista);
    delete REM_MSG[clip.id];
    projectsPersist();
    renderKeepingScroll();
  }
  function remocoesTotalMs(clip) {
    return remocoesDoClip(clip).reduce(function (s, r) { return s + (r.ateMs - r.deMs); }, 0);
  }
  function remocoesPanelHTML(clip) {
    var lista = remocoesDoClip(clip);
    var corteMs = (num(clip.outSec) - num(clip.inSec)) * 1000;
    var tiradoMs = remocoesTotalMs(clip);
    var inMs = num(clip.inSec) * 1000;
    var pct = function (ms) { return corteMs > 0 ? Math.max(0, Math.min(100, (ms - inMs) / corteMs * 100)) : 0; };
    return '<section class="vop-capa vop-rem" data-rem-painel data-id="' + esc(clip.id) + '">'
      + '<div class="vop-capa-cab"><span class="vop-capa-tit">Remover trechos</span>'
      + (lista.length ? '<span class="vop-txt-tempo">≈ ' + esc(fmtClock((corteMs - tiradoMs) / 1000)) + '</span>' : '') + '</div>'
      + '<div class="vop-capa-corpo">'
      + '<div class="vop-rem-linha" aria-hidden="true">' + lista.map(function (r) {
        return '<span style="left:' + pct(r.deMs).toFixed(2) + '%;width:' + (pct(r.ateMs) - pct(r.deMs)).toFixed(2) + '%"></span>';
      }).join('') + '</div>'
      + '<div class="vop-rem-acoes">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="rem-inicio" data-id="' + esc(clip.id) + '"' + (srcReady() ? '' : ' disabled') + '>Marcar início</button>'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="rem-fim" data-id="' + esc(clip.id) + '"'
      + (srcReady() && typeof REM_INICIO[clip.id] === 'number' ? '' : ' disabled')
      + (REM_MSG[clip.id] ? ' aria-invalid="true"' : '') + '>Marcar fim</button></div>'
      + (lista.length ? '<ol class="vop-rem-lista">' + lista.map(function (r, i) {
        return '<li><span>' + esc(fmtClock(r.deMs / 1000)) + ' – ' + esc(fmtClock(r.ateMs / 1000))
          + ' (' + ((r.ateMs - r.deMs) / 1000).toFixed(1).replace('.', ',') + ' s)</span>'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="rem-desfazer" data-id="' + esc(clip.id) + '" data-i="' + i + '">Desfazer</button></li>';
      }).join('') + '</ol>' : '')
      + '</div></section>';
  }
  /* A PRÉVIA pula os trechos: tocando dentro de um deles, o player vai ao fim dele. Só leitura
     de intervalos — o mapa de tempo é do servidor. */
  function remocaoPulo() {
    var clip = legGeoClip();
    var lista = remocoesDoClip(clip);
    var v = srcVideo();
    if (!lista.length || !v || v.paused) return;
    var ms = (srcNow() || 0) * 1000;
    for (var i = 0; i < lista.length; i++) {
      if (ms >= lista[i].deMs && ms < lista[i].ateMs) { srcSeek(lista[i].ateMs / 1000, true); return; }
    }
  }

  /* ==================================================================================
     TEXTO FIXO NA TELA (2026-09-30, decisão do usuário)
     `clip.edit.textos = [{ id, texto, deMs, ateMs, posicao, estilo }]` em ms da FONTE (espelho
     do `textosOf` do preset.js). Estático. O relógio da SAÍDA é do dono em Python; aqui só se
     marca pelo player, se lista, se avisa (nunca trava) e se mostra a prévia. */
  var TEXTOS_MAX = 3;
  var TEXTO_MAX_CHARS = 80;
  var TEXTO_MIN_MS = 1000;
  var TEXTO_POSICOES = ['alto', 'meio'];
  var TEXTO_ESTILOS = ['rotulo', 'nota'];
  var TEXTO_POSICAO_LABELS = { alto: 'No alto', meio: 'No meio' };
  var TEXTO_ESTILO_LABELS = { rotulo: 'Rótulo', nota: 'Nota' };
  /* Espelho LITERAL do `TEXTO_GEOMETRIA` do preset.js (o test-video-ops.js compara). */
  var TEXTO_GEOMETRIA = { largura: 760, topo: { alto: 300, meio: 860 }, fonte: 46 };
  var TXT_INICIO = Object.create(null);
  var TXT_RASCUNHO = Object.create(null);
  var TXT_MSG = Object.create(null);
  /* Texto já colocado que o operador esvaziou: a recusa marca SÓ aquele campo (aria-invalid). */
  var TXT_VAZIO = Object.create(null);

  function textosOf(valor) {
    if (!Array.isArray(valor)) return [];
    var candidatos = [];
    valor.forEach(function (t) {
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(t.id)) return;
      if (typeof t.texto !== 'string' || !t.texto.trim()) return;
      var de = t.deMs, ate = t.ateMs;
      if (![de, ate].every(function (v) { return typeof v === 'number' && isFinite(v) && v >= 0; })) return;
      de = Math.round(de); ate = Math.round(ate);
      if (ate - de < TEXTO_MIN_MS) return;
      candidatos.push({ id: t.id, texto: t.texto.split(/\s+/).filter(Boolean).join(' ').slice(0, TEXTO_MAX_CHARS),
        deMs: de, ateMs: ate,
        posicao: TEXTO_POSICOES.indexOf(t.posicao) >= 0 ? t.posicao : 'alto',
        estilo: TEXTO_ESTILOS.indexOf(t.estilo) >= 0 ? t.estilo : 'rotulo' });
    });
    candidatos.sort(function (a, b) { return a.deMs - b.deMs || a.ateMs - b.ateMs; });
    var saida = [];
    candidatos.forEach(function (t) {
      if (saida.length && t.deMs < saida[saida.length - 1].ateMs) return;
      if (saida.length < TEXTOS_MAX) saida.push(t);
    });
    return saida;
  }
  function textosDoClip(clip) { return (clip && editOf(clip).textos) || []; }
  function textosWrite(clip, lista) {
    var edit = editOf(clip);
    var limpa = textosOf(lista);
    if (limpa.length) edit.textos = limpa; else delete edit.textos;
    clip.edit = editOf({ edit: edit });
    clipEditadoInvalido(clip);
    return true;
  }
  function textoConfere(clip, texto, deMs, ateMs) {
    if (!String(texto || '').trim()) return 'Escreva o texto antes de marcar o fim.';
    if (!(ateMs > deMs)) return 'O fim tem de vir depois do início.';
    if (deMs < num(clip.inSec) * 1000 || ateMs > num(clip.outSec) * 1000) return 'O texto tem de ficar dentro do corte.';
    if (ateMs - deMs < TEXTO_MIN_MS) return 'O texto precisa ficar pelo menos 1 s na tela.';
    var lista = textosDoClip(clip);
    if (lista.length >= TEXTOS_MAX) return 'Limite de ' + TEXTOS_MAX + ' textos por corte.';
    if (lista.some(function (t) { return deMs < t.ateMs && ateMs > t.deMs; })) return 'Este texto se sobrepõe a outro — um de cada vez na tela.';
    return '';
  }
  /* Os avisos de UM texto (nunca bloqueio): inteiro num trecho removido, junto do card de 4 s,
     encostando na legenda, ou entrando nas zonas do TikTok — números das zonas e da âncora da
     legenda vindos do servidor (`/api/legenda-geometria`). */
  function textoAvisos(clip, t) {
    var avisos = [];
    if (remocoesDoClip(clip).some(function (r) { return t.deMs >= r.deMs && t.ateMs <= r.ateMs; })) {
      avisos.push('inteiro num trecho removido: não sai no vídeo');
    }
    if (titleCardStyleOf(clip) !== TITLE_CARD_SEM && cardDoClip(clip) && t.deMs < num(clip.inSec) * 1000 + 4000) {
      avisos.push('aparece junto do card do título (primeiros 4 s)');
    }
    var geo = legGeoDoCorte(clip);
    var topo = TEXTO_GEOMETRIA.topo[t.posicao] || TEXTO_GEOMETRIA.topo.alto;
    var base = topo + 2 * TEXTO_GEOMETRIA.fonte * 1.2 + 24;
    if (geo && geo.legendaBase) {
      var auto = LEGENDA_AUTO[legendaStyleOf(clip)] || LEGENDA_AUTO.classico;
      var legendaBaixo = 1920 - num(geo.legendaBase);
      var legendaTopo = legendaBaixo - 2 * num(legendaValor(clip, 'tamanho').valor || auto.tamanho) * auto.entrelinha;
      if (base > legendaTopo && topo < legendaBaixo) avisos.push('pode encostar na legenda');
    }
    if (geo && geo.zonas) {
      var direita = (1080 + TEXTO_GEOMETRIA.largura) / 2;
      if (direita > num(geo.zonas.trilhaX)) avisos.push('entra na faixa dos botões do TikTok');
      if (base > num(geo.zonas.rodapeY)) avisos.push('entra na faixa do texto do TikTok');
    }
    return avisos;
  }
  function textoMarcar(clipId, ponta) {
    var clip = findById(YT.candidates, clipId);
    var t = srcNow();
    if (!clip || t === null) { toast('O player não está pronto — importe o vídeo e tente de novo.', 'error'); return; }
    var ms = Math.round(t * 1000);
    if (ponta === 'inicio') {
      TXT_INICIO[clip.id] = ms;
      delete TXT_MSG[clip.id];
    } else if (typeof TXT_INICIO[clip.id] !== 'number') {
      TXT_MSG[clip.id] = true;
    } else {
      var texto = TXT_RASCUNHO[clip.id] || '';
      var motivo = textoConfere(clip, texto, TXT_INICIO[clip.id], ms);
      if (motivo) TXT_MSG[clip.id] = true;
      else {
        textosWrite(clip, textosDoClip(clip).concat([{ id: 't' + Date.now().toString(36), texto: texto,
          deMs: TXT_INICIO[clip.id], ateMs: ms, posicao: 'alto', estilo: 'rotulo' }]));
        delete TXT_INICIO[clip.id];
        delete TXT_RASCUNHO[clip.id];
        delete TXT_MSG[clip.id];
        projectsPersist();
      }
    }
    renderKeepingScroll();
  }
  /* Editar um texto já colocado: o conteúdo grava no `change` (sem re-render a cada tecla);
     posição e estilo são radios (re-renderiza); remover é botão. */
  function textoCampoWrite(clipId, indice, campo, valor) {
    var clip = findById(YT.candidates, clipId);
    var lista = textosDoClip(clip).slice();
    if (!clip || !(indice >= 0 && indice < lista.length)) return false;
    delete TXT_VAZIO[clip.id + ':' + indice];
    /* A marca é por ÍNDICE: remover um item desloca os de baixo, então as marcas deste corte
       caem juntas (o estado é só "até a próxima ação"). */
    if (campo === 'remover') {
      Object.keys(TXT_VAZIO).forEach(function (k) { if (k.indexOf(clip.id + ':') === 0) delete TXT_VAZIO[k]; });
      lista.splice(indice, 1);
    }
    else if (campo === 'texto' && !String(valor || '').trim()) { TXT_VAZIO[clip.id + ':' + indice] = true; return true; }
    else lista[indice] = Object.assign({}, lista[indice], { [campo]: valor });
    textosWrite(clip, lista);
    projectsPersist();
    return true;
  }
  function textosPanelHTML(clip) {
    var lista = textosDoClip(clip);
    return '<section class="vop-capa vop-txt" data-txt-painel data-id="' + esc(clip.id) + '">'
      + '<div class="vop-capa-cab"><span class="vop-capa-tit">Texto na tela</span>'
      + '<span class="vop-txt-tempo">' + lista.length + '/' + TEXTOS_MAX + '</span></div>'
      + '<div class="vop-capa-corpo">'
      + (lista.length < TEXTOS_MAX
        ? '<label class="vop-capa-campo"><span class="vop-leg-lab">Novo texto</span>'
          + '<input type="text" maxlength="' + TEXTO_MAX_CHARS + '" data-txt-novo data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(TXT_RASCUNHO[clip.id] || '') + '" placeholder="Ex.: Faturamento de 2024" spellcheck="true"></label>'
          + '<div class="vop-rem-acoes">'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="txt-inicio" data-id="' + esc(clip.id) + '"' + (srcReady() ? '' : ' disabled') + '>Marcar início</button>'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="txt-fim" data-id="' + esc(clip.id) + '"'
          + (srcReady() && typeof TXT_INICIO[clip.id] === 'number' ? '' : ' disabled')
          + (TXT_MSG[clip.id] ? ' aria-invalid="true"' : '') + '>Marcar fim</button></div>'
        : '')
      + (lista.length ? '<ol class="vop-txt-lista">' + lista.map(function (t, i) {
        var fora = remocoesDoClip(clip).some(function (r) { return t.deMs >= r.deMs && t.ateMs <= r.ateMs; });
        var radios = function (campo, opcoes, rotulos) {
          return '<div class="vop-leg-seg">' + opcoes.map(function (v) {
            var id = 'txt-' + campo + '-' + clip.id + '-' + i + '-' + v;
            return '<input type="radio" id="' + esc(id) + '" name="txt-' + campo + '-' + esc(clip.id) + '-' + i + '"'
              + ' data-txt-field="' + campo + '" data-id="' + esc(clip.id) + '" data-i="' + i + '" value="' + v + '"'
              + (t[campo] === v ? ' checked' : '') + '><label for="' + esc(id) + '">' + esc(rotulos[v]) + '</label>';
          }).join('') + '</div>';
        };
        return '<li class="vop-txt-item"' + (fora ? ' data-removida="1"' : '') + '>'
          + '<div class="vop-txt-topo"><span class="vop-txt-tempo">' + esc(fmtClock(t.deMs / 1000)) + ' – ' + esc(fmtClock(t.ateMs / 1000)) + '</span>'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="txt-remover" data-id="' + esc(clip.id) + '" data-i="' + i + '">Remover</button></div>'
          + '<input type="text" maxlength="' + TEXTO_MAX_CHARS + '" data-txt-field="texto" data-id="' + esc(clip.id) + '" data-i="' + i + '"'
          + ' value="' + esc(t.texto) + '" aria-label="Texto ' + (i + 1) + '"'
          + (TXT_VAZIO[clip.id + ':' + i] ? ' aria-invalid="true"' : '') + '>'
          + radios('posicao', TEXTO_POSICOES, TEXTO_POSICAO_LABELS) + radios('estilo', TEXTO_ESTILOS, TEXTO_ESTILO_LABELS)
          + '</li>';
      }).join('') + '</ol>' : '')
      + '</div></section>';
  }
  /* A PRÉVIA: todos os textos do corte desenhados no quadro, cada um aceso só na própria
     janela (comparação com o instante do player — nada de remapear). */
  function textosPrevHTML(clip) {
    var lista = textosDoClip(clip);
    if (!lista.length) return '';
    var agora = (srcNow() || 0) * 1000;
    return lista.map(function (t) {
      var topo = TEXTO_GEOMETRIA.topo[t.posicao] || TEXTO_GEOMETRIA.topo.alto;
      return '<div class="vop-txt-prev" data-txt-prev data-de="' + t.deMs + '" data-ate="' + t.ateMs + '"'
        + ' data-estilo="' + esc(t.estilo) + '" style="--txt-topo:' + topo + ';--txt-col:' + TEXTO_GEOMETRIA.largura
        + ';--txt-fonte:' + TEXTO_GEOMETRIA.fonte + '"' + (agora >= t.deMs && agora < t.ateMs ? '' : ' hidden')
        + '><span>' + esc(t.texto) + '</span></div>';
    }).join('');
  }
  function textosTick() {
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    var nos = raiz && raiz.querySelectorAll ? raiz.querySelectorAll('[data-txt-prev]') : [];
    if (!nos.length) return;
    var agora = (srcNow() || 0) * 1000;
    Array.prototype.forEach.call(nos, function (n) {
      var de = Number(n.getAttribute('data-de')), ate = Number(n.getAttribute('data-ate'));
      n.hidden = !(agora >= de && agora < ate);
    });
  }

  /* ==================================================================================
     ZOOM PONTUAL LEVE (2026-09-30, decisão do usuário)
     `clip.edit.zooms = [{ id, deMs, ateMs, nivel }]` em ms da FONTE (espelho do `zoomsOf` do
     preset.js). Só a camada do vídeo, centrada, no teto de 1,15. A prévia é APROXIMADA: a
     propriedade CSS `scale` no próprio player (compõe com o `transform` do modo 16:9, não o
     sobrescreve) e transição de 400 ms — a mesma do export, que vem do preset. */
  var ZOOMS_MAX = 5;
  var ZOOM_MIN_MS = 1000;
  var ZOOM_NIVEIS = ['leve', 'medio'];
  var ZOOM_NIVEL_LABELS = { leve: 'Leve', medio: 'Médio' };
  /* Espelho LITERAL do `ZOOM_ESCALAS` do preset.js, só para a prévia (o test compara). */
  var ZOOM_ESCALAS = { leve: 1.06, medio: 1.12 };
  var ZOOM_INICIO = Object.create(null);
  var ZOOM_MSG = Object.create(null);

  function zoomsOf(valor) {
    if (!Array.isArray(valor)) return [];
    var candidatos = [];
    valor.forEach(function (z) {
      if (!z || typeof z !== 'object' || typeof z.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(z.id)) return;
      var de = z.deMs, ate = z.ateMs;
      if (![de, ate].every(function (v) { return typeof v === 'number' && isFinite(v) && v >= 0; })) return;
      de = Math.round(de); ate = Math.round(ate);
      if (ate - de < ZOOM_MIN_MS) return;
      candidatos.push({ id: z.id, deMs: de, ateMs: ate, nivel: ZOOM_NIVEIS.indexOf(z.nivel) >= 0 ? z.nivel : 'leve' });
    });
    candidatos.sort(function (a, b) { return a.deMs - b.deMs || a.ateMs - b.ateMs; });
    var saida = [];
    candidatos.forEach(function (z) {
      if (saida.length && z.deMs < saida[saida.length - 1].ateMs) return;
      if (saida.length < ZOOMS_MAX) saida.push(z);
    });
    return saida;
  }
  function zoomsDoClip(clip) { return (clip && editOf(clip).zooms) || []; }
  function zoomsWrite(clip, lista) {
    var edit = editOf(clip);
    var limpa = zoomsOf(lista);
    if (limpa.length) edit.zooms = limpa; else delete edit.zooms;
    clip.edit = editOf({ edit: edit });
    clipEditadoInvalido(clip);
    return true;
  }
  function zoomConfere(clip, deMs, ateMs) {
    if (!(ateMs > deMs)) return 'O fim tem de vir depois do início.';
    if (deMs < num(clip.inSec) * 1000 || ateMs > num(clip.outSec) * 1000) return 'O zoom tem de ficar dentro do corte.';
    if (ateMs - deMs < ZOOM_MIN_MS) return 'O zoom precisa durar pelo menos 1 s.';
    var lista = zoomsDoClip(clip);
    if (lista.length >= ZOOMS_MAX) return 'Limite de ' + ZOOMS_MAX + ' zooms por corte.';
    if (lista.some(function (z) { return deMs < z.ateMs && ateMs > z.deMs; })) return 'Este zoom se sobrepõe a outro.';
    return '';
  }
  function zoomMarcar(clipId, ponta) {
    var clip = findById(YT.candidates, clipId);
    var t = srcNow();
    if (!clip || t === null) { toast('O player não está pronto — importe o vídeo e tente de novo.', 'error'); return; }
    var ms = Math.round(t * 1000);
    if (ponta === 'inicio') {
      ZOOM_INICIO[clip.id] = ms;
      delete ZOOM_MSG[clip.id];
    } else if (typeof ZOOM_INICIO[clip.id] !== 'number') {
      ZOOM_MSG[clip.id] = true;
    } else {
      var motivo = zoomConfere(clip, ZOOM_INICIO[clip.id], ms);
      if (motivo) ZOOM_MSG[clip.id] = true;
      else {
        zoomsWrite(clip, zoomsDoClip(clip).concat([{ id: 'z' + Date.now().toString(36),
          deMs: ZOOM_INICIO[clip.id], ateMs: ms, nivel: 'leve' }]));
        delete ZOOM_INICIO[clip.id];
        delete ZOOM_MSG[clip.id];
        projectsPersist();
      }
    }
    renderKeepingScroll();
  }
  function zoomCampoWrite(clipId, indice, campo, valor) {
    var clip = findById(YT.candidates, clipId);
    var lista = zoomsDoClip(clip).slice();
    if (!clip || !(indice >= 0 && indice < lista.length)) return false;
    if (campo === 'remover') lista.splice(indice, 1);
    else if (campo === 'nivel') lista[indice] = Object.assign({}, lista[indice], { nivel: valor });
    else return false;
    zoomsWrite(clip, lista);
    projectsPersist();
    return true;
  }
  function zoomsPanelHTML(clip) {
    var lista = zoomsDoClip(clip);
    var rems = remocoesDoClip(clip);
    return '<section class="vop-capa vop-zoom" data-zoom-painel data-id="' + esc(clip.id) + '">'
      + '<div class="vop-capa-cab"><span class="vop-capa-tit">Zoom leve</span>'
      + '<span class="vop-txt-tempo">' + lista.length + '/' + ZOOMS_MAX + '</span></div>'
      + '<div class="vop-capa-corpo">'
      + (lista.length < ZOOMS_MAX
        ? '<div class="vop-rem-acoes">'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="zoom-inicio" data-id="' + esc(clip.id) + '"' + (srcReady() ? '' : ' disabled') + '>Marcar início</button>'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="zoom-fim" data-id="' + esc(clip.id) + '"'
          + (srcReady() && typeof ZOOM_INICIO[clip.id] === 'number' ? '' : ' disabled')
          + (ZOOM_MSG[clip.id] ? ' aria-invalid="true"' : '') + '>Marcar fim</button></div>'
        : '')
      + (lista.length ? '<ol class="vop-txt-lista">' + lista.map(function (z, i) {
        var removido = rems.some(function (r) { return z.deMs >= r.deMs && z.ateMs <= r.ateMs; });
        return '<li class="vop-txt-item"' + (removido ? ' data-removida="1"' : '') + '><div class="vop-txt-topo"><span class="vop-txt-tempo">'
          + esc(fmtClock(z.deMs / 1000)) + ' – ' + esc(fmtClock(z.ateMs / 1000)) + '</span>'
          + '<button class="vop-btn vop-btn-quiet" type="button" data-act="zoom-remover" data-id="' + esc(clip.id) + '" data-i="' + i + '">Remover</button></div>'
          + '<div class="vop-leg-seg">' + ZOOM_NIVEIS.map(function (v) {
            var id = 'zoom-nivel-' + clip.id + '-' + i + '-' + v;
            return '<input type="radio" id="' + esc(id) + '" name="zoom-nivel-' + esc(clip.id) + '-' + i + '"'
              + ' data-zoom-field="nivel" data-id="' + esc(clip.id) + '" data-i="' + i + '" value="' + v + '"'
              + (z.nivel === v ? ' checked' : '') + '><label for="' + esc(id) + '">' + esc(ZOOM_NIVEL_LABELS[v]) + '</label>';
          }).join('') + '</div>'
          + '</li>';
      }).join('') + '</ol>' : '')
      + '</div></section>';
  }
  /* A PRÉVIA: só o nível da janela onde o player está (a transição de 400 ms é do CSS). */
  function zoomTick() {
    var v = srcVideo();
    if (!v || !v.style) return;
    var lista = zoomsDoClip(legGeoClip());
    var ms = (srcNow() || 0) * 1000;
    var ativo = lista.filter(function (z) { return ms >= z.deMs && ms < z.ateMs; })[0];
    var escala = ativo ? String(ZOOM_ESCALAS[ativo.nivel] || ZOOM_ESCALAS.leve) : '';
    if (v.style.scale !== escala) v.style.scale = escala;
  }

  /* ==================================================================================
     MÚSICA DE FUNDO (2026-09-30, decisão do usuário)
     Só faixa do PC (MP3/M4A/WAV), numa biblioteca do servidor fora do repo. O corte guarda
     `clip.edit.musica = { id, inicioMs, nivel }` (espelho do `musicaOf` do preset.js). A tela
     manda INTENÇÃO (o nível); quem transforma em ganho é o `serve.ganho_musica`, que mede a
     voz do corte. A prévia é UM `<audio>` sincronizado ao player da fonte, com volume
     APROXIMADO pela mesma tabela — e a tela diz que é aproximação. */
  var MUSICA_NIVEIS = ['baixo', 'medio'];
  var MUSICA_NIVEL_LABELS = { baixo: 'Baixa', medio: 'Média' };
  /* Espelho do `serve.MUSICA_DB` e do `VOZ_NOMINAL_LUFS` (-14), SÓ para a prévia. */
  var MUSICA_DB = { baixo: 22, medio: 16 };
  var MUSICA_VOZ_PREVIA = -14;
  /* Uma frase para CADA desfecho do `X-Clip-Musica` (`serve.MUSICA_STATES`). */
  var MUSICA_MSG = {
    MUSICA_OK: 'A música entrou no vídeo.',
    MUSICA_AUSENTE: 'A faixa escolhida não está mais na biblioteca — o vídeo saiu SEM música. Importe a faixa de novo ou escolha outra.',
    MUSICA_ILEGIVEL: 'A faixa escolhida não pôde ser lida — o vídeo saiu SEM música. Importe a faixa de novo.'
  };
  /* Uma frase para cada recusa da importação (`worker.ERROR_CODES`, família `musica_*`). */
  var MUSICA_IMPORT_MSG = {
    musica_vazia: 'O arquivo está vazio.',
    musica_grande: 'A faixa passa de 50 MB.',
    musica_tipo: 'Só entram faixas .mp3, .m4a ou .wav.',
    musica_ilegivel: 'O arquivo não tem áudio que o FFmpeg consiga ler.'
  };
  var MUS = { lista: null, estado: 'nunca', erro: '', importando: false, importFalhou: false };

  function musicaOf(valor) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)
      || typeof valor.id !== 'string' || !/^[0-9a-f]{16}$/.test(valor.id)) return null;
    var inicio = valor.inicioMs;
    return {
      id: valor.id,
      inicioMs: typeof inicio === 'number' && isFinite(inicio) && inicio >= 0 ? Math.round(inicio) : 0,
      nivel: MUSICA_NIVEIS.indexOf(valor.nivel) >= 0 ? valor.nivel : 'baixo'
    };
  }
  function musicaDoClip(clip) { return editOf(clip).musica || null; }
  function musicaFaixa(id) {
    return (MUS.lista || []).filter(function (m) { return m.id === id; })[0] || null;
  }
  /* Grava pelo `editOf` (null = "Sem música": a chave some). */
  function musicaWrite(clip, patch) {
    if (!clip) return false;
    var edit = editOf(clip);
    if (patch === null) delete edit.musica;
    else edit.musica = musicaOf(Object.assign({ inicioMs: 0, nivel: 'baixo' }, edit.musica || {}, patch));
    if (!edit.musica) delete edit.musica;
    clip.edit = editOf({ edit: edit });
    return true;
  }
  /* A linha de estado. TODO ramo fala (BP-008). */
  function musicaEstado(clip) {
    var m = musicaDoClip(clip);
    if (!m) return { tom: 'info', texto: 'Sem música.' };
    if (MUS.estado === 'carregando' || MUS.estado === 'nunca') return { tom: 'info', texto: 'Carregando a biblioteca…' };
    if (MUS.estado === 'erro') return { tom: 'warn', texto: 'Não deu para ler a biblioteca: ' + MUS.erro };
    var faixa = musicaFaixa(m.id);
    if (!faixa) return { tom: 'warn', texto: 'A faixa escolhida não está mais na biblioteca — o vídeo sairá SEM música.' };
    return { tom: 'ok', texto: faixa.nome + ' · ' + MUSICA_NIVEL_LABELS[m.nivel].toLowerCase() + ' · começa em ' + fmtClock(m.inicioMs / 1000) + '.' };
  }
  /* Faixa mais curta que o corte: ela termina com o próprio fade, sem repetir — e a tela diz
     quantos segundos antes. */
  function musicaAviso(clip) {
    var m = musicaDoClip(clip);
    var faixa = m && musicaFaixa(m.id);
    if (!faixa || !(faixa.durationSec > 0)) return '';
    var sobra = faixa.durationSec - m.inicioMs / 1000;
    var corte = num(clip.outSec) - num(clip.inSec);
    if (sobra <= 0) return 'O início escolhido passa do fim da faixa (' + fmtClock(faixa.durationSec) + '): o vídeo sairá sem música.';
    if (sobra < corte) return 'A faixa termina ' + Math.ceil(corte - sobra) + ' s antes do fim do corte (ela não repete).';
    return '';
  }
  function musicaPanelHTML(clip) {
    var m = musicaDoClip(clip);
    var nome = 'mus-id-' + clip.id;
    var opcoes = [['', 'Sem música']].concat((MUS.lista || []).map(function (f) {
      return [f.id, f.nome + (f.durationSec ? ' · ' + fmtClock(f.durationSec) : '')];
    }));
    var faixa = m && musicaFaixa(m.id);
    return '<section class="vop-capa vop-musica" data-mus-painel data-id="' + esc(clip.id) + '">'
      + '<div class="vop-capa-cab"><span class="vop-capa-tit">Música</span></div>'
      + '<div class="vop-capa-corpo">'
      + '<div class="vop-mus-lista" role="radiogroup" aria-label="Faixa de fundo">'
      + opcoes.map(function (o, i) {
        var id = nome + '-' + i;
        return '<input type="radio" id="' + esc(id) + '" name="' + esc(nome) + '" data-mus-field="id"'
          + ' data-id="' + esc(clip.id) + '" value="' + esc(o[0]) + '"'
          + ((m ? m.id : '') === o[0] ? ' checked' : '') + '><label for="' + esc(id) + '">' + esc(o[1]) + '</label>';
      }).join('')
      + '</div>'
      + '<label class="vop-btn vop-btn-quiet vop-mus-importar">' + (MUS.importando ? 'Importando…' : MUS.importFalhou ? ROTULO_FALHOU : 'Importar do PC')
      + '<input type="file" accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav" data-mus-arquivo'
      + ' data-id="' + esc(clip.id) + '"' + (MUS.importando ? ' disabled' : '') + '></label>'
      + (m
        ? '<label class="vop-capa-campo"><span class="vop-leg-lab">Começar a faixa em</span>'
          + '<input type="text" inputmode="numeric" data-mus-field="inicio" data-id="' + esc(clip.id) + '"'
          + ' value="' + esc(clockField(m.inicioMs / 1000)) + '" placeholder="0:00"></label>'
          + '<div class="vop-capa-linha"><span class="vop-leg-lab">Volume</span><div class="vop-leg-seg">'
          + MUSICA_NIVEIS.map(function (n) {
            var id = 'mus-nivel-' + clip.id + '-' + n;
            return '<input type="radio" id="' + esc(id) + '" name="mus-nivel-' + esc(clip.id) + '" data-mus-field="nivel"'
              + ' data-id="' + esc(clip.id) + '" value="' + n + '"' + (m.nivel === n ? ' checked' : '') + '>'
              + '<label for="' + esc(id) + '">' + esc(MUSICA_NIVEL_LABELS[n]) + '</label>';
          }).join('') + '</div></div>'
        : '')
      + (faixa ? '<audio data-mus-audio preload="auto" src="' + esc(faixa.url) + '"></audio>' : '')
      + '</div></section>';
  }
  function musicaListar() {
    if (typeof fetch !== 'function' || MUS.estado === 'carregando') return;
    MUS.estado = 'carregando';
    fetch('/api/musicas', { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('o servidor respondeu ' + r.status + '.');
      return r.json();
    }).then(function (dados) {
      MUS.lista = Array.isArray(dados && dados.musicas) ? dados.musicas : [];
      MUS.estado = 'pronta';
      renderKeepingScroll();
    }).catch(function (erro) {
      MUS.estado = 'erro';
      MUS.erro = erro && erro.message ? erro.message : 'o renderizador não está ativo — rode estudio.ps1.';
      renderKeepingScroll();
    });
  }
  function musicaImportar(input, clipId) {
    var arquivo = input && input.files && input.files[0];
    if (!arquivo || MUS.importando) return;
    MUS.importando = true;
    MUS.importFalhou = false;
    renderKeepingScroll();
    fetch('/api/musica-importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Musica-Nome': encodeURIComponent(arquivo.name) },
      body: arquivo
    }).catch(function () {
      throw new Error('o renderizador não está ativo — rode estudio.ps1.');
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (p) {
        if (!r.ok) throw new Error(MUSICA_IMPORT_MSG[p && p.code] || cleanText(p && p.error, 300) || 'o servidor recusou a faixa.');
        return p;
      });
    }).then(function (p) {
      MUS.importando = false;
      var clip = findById(YT.candidates, clipId);
      if (clip && p.id) { musicaWrite(clip, { id: p.id }); projectsPersist(); }
      MUS.estado = 'nunca';
      musicaListar();
    }).catch(function (erro) {
      MUS.importando = false;
      /* Editor sem frase (2026-10-01): a recusa vira o rótulo do próprio botão. */
      MUS.importFalhou = true;
      renderKeepingScroll();
    });
  }
  /* A PRÉVIA: o `<audio>` segue o player da fonte (tocar, pausar, arrastar, velocidade). Só
     leitura do relógio do vídeo — o vídeo nunca é comandado por aqui. */
  function musicaPreviaVolume(m, faixa) {
    var alvo = MUSICA_VOZ_PREVIA - MUSICA_DB[m.nivel];
    var lufs = faixa && typeof faixa.lufs === 'number' ? faixa.lufs : -14;
    return Math.max(0, Math.min(1, Math.pow(10, (alvo - lufs) / 20)));
  }
  function musicaSync() {
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    var audio = raiz && raiz.querySelector && raiz.querySelector('[data-mus-audio]');
    var painel = raiz && raiz.querySelector && raiz.querySelector('[data-mus-painel]');
    var video = srcVideo();
    if (!audio || !painel || !video) return;
    var clip = findById(YT.candidates, painel.getAttribute('data-id'));
    var m = clip && musicaDoClip(clip);
    var t = srcNow();
    if (!m || t === null) return;
    var alvo = m.inicioMs / 1000 + (t - num(clip.inSec));
    audio.volume = musicaPreviaVolume(m, musicaFaixa(m.id));
    audio.playbackRate = Number(video.playbackRate) || 1;
    if (alvo < 0 || t > num(clip.outSec)) { if (!audio.paused) audio.pause(); return; }
    if (Math.abs((Number(audio.currentTime) || 0) - alvo) > 0.25) audio.currentTime = alvo;
    if (video.paused && !audio.paused) audio.pause();
    else if (!video.paused && audio.paused && audio.play) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
  }

  /* ==================================================================================
     CAPA DO TIKTOK (2026-09-30, decisão do usuário)
     Um PNG 1080x1920 AO LADO do MP4, escolhido no app em "Selecionar capa → galeria". Não
     entra no MP4 e não vai por API. `clip.capaTikTok` mora FORA do `clip.edit`, na chave de
     projeto de sempre (sem chave nova, sem migração). O validador é espelho LITERAL do
     `capaTikTokOf` do preset.js e do `capa_tiktok_of` do serve.py (os testes comparam).
     Duas camadas, e a tela diz qual é qual: a prévia APROXIMADA (o quadro do MESMO `<video>`
     desenhado num canvas + a manchete em CSS) e o PNG REAL (`/api/capa-tiktok`). */
  var CAPA_ESTILOS = ['negocio', 'faixa', 'limpo'];
  var CAPA_POSICOES = ['alto', 'meio', 'baixo'];
  var CAPA_TITULO_MAX = 120;
  var CAPA_DESTAQUE_MAX = 60;
  var CAPA_ESTILO_LABELS = { negocio: 'Negócio', faixa: 'Faixa', limpo: 'Limpo' };
  var CAPA_POSICAO_LABELS = { alto: 'No alto', meio: 'No meio', baixo: 'Embaixo' };
  /* Espelho LITERAL do preset.js (`CAPA_ZONAS`, `CAPA_FONTES`, `CAPA_LARGURA`,
     `CAPA_MAX_LINHAS` e o avanço MEDIDO de cada estilo) — o test-video-ops.js compara. */
  var CAPA_ZONAS = {
    grade: { x: 0, y: 240, largura: 1080, altura: 1440 },
    seguro: { x: 0, y: 420, largura: 1080, altura: 1080 },
    contador: { x: 0, y: 1570, largura: 420, altura: 110 }
  };
  var CAPA_FONTES = [132, 116, 104, 92, 80, 72];
  var CAPA_LARGURA = 920;
  var CAPA_MAX_LINHAS = 3;
  var CAPA_AVANCO = { negocio: 0.731, faixa: 0.731, limpo: 0.683 };
  /* Uma frase para CADA recusa do servidor (`serve.CAPA_ERROS`; o test_serve LÊ isto). */
  var CAPA_MSG = {
    capa_sem_fonte: 'O vídeo original não está no servidor. Importe o vídeo de novo para gerar a capa.',
    capa_sem_quadro: 'Nenhum quadro escolhido. Pause o vídeo no quadro da capa e toque em “Usar este quadro”.',
    capa_quadro_fora: 'O quadro escolhido está fora deste corte. Escolha um quadro dentro dele.'
  };
  /* Estado de SESSÃO: a imagem do quadro (dataURL), o PNG gerado, o pedido em voo, a falha e o
     painel aberto. O que é do CORTE (quadro, texto, estilo, posição) vai para o projeto. */
  var CAPA_QUADRO = Object.create(null);
  var CAPA_PRONTA = Object.create(null);
  var CAPA_BUSY = Object.create(null);
  var CAPA_FALHA = Object.create(null);

  function capaTikTokOf(valor) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) || valor.v !== 1) return null;
    var out = {
      v: 1,
      estilo: CAPA_ESTILOS.indexOf(valor.estilo) >= 0 ? valor.estilo : 'negocio',
      posicao: CAPA_POSICOES.indexOf(valor.posicao) >= 0 ? valor.posicao : 'meio'
    };
    var q = valor.quadroMs;
    if (typeof q === 'number' && isFinite(q) && q >= 0) out.quadroMs = Math.round(q);
    if (typeof valor.titulo === 'string' && valor.titulo.trim()) {
      out.titulo = valor.titulo.trim().slice(0, CAPA_TITULO_MAX);
    }
    if (typeof valor.destaque === 'string' && valor.destaque.trim()) {
      out.destaque = valor.destaque.trim().slice(0, CAPA_DESTAQUE_MAX);
    }
    return out;
  }
  /* Espelho do `capaLinhas`/`capaTitulo` do preset.js: o corpo que o PNG vai usar, para a
     prévia não mentir sobre o tamanho (e para o aviso de manchete longa). */
  function capaLinhas(titulo, fonte, avanco) {
    var cabe = Math.max(1, Math.floor(CAPA_LARGURA / (fonte * avanco)));
    var linhas = 0, atual = -1;
    String(titulo || '').split(/\s+/).filter(Boolean).forEach(function (palavra) {
      var n = palavra.length;
      if (atual >= 0 && atual + 1 + n <= cabe) { atual += 1 + n; return; }
      linhas += Math.max(1, Math.ceil(n / cabe));
      atual = n > cabe ? n % cabe || cabe : n;
    });
    return linhas;
  }
  function capaTituloTela(titulo, estilo) {
    var avanco = CAPA_AVANCO[estilo] || CAPA_AVANCO.negocio;
    for (var i = 0; i < CAPA_FONTES.length; i++) {
      var linhas = capaLinhas(titulo, CAPA_FONTES[i], avanco);
      if (linhas <= CAPA_MAX_LINHAS) return { fonte: CAPA_FONTES[i], linhas: linhas, cabe: true };
    }
    var menor = CAPA_FONTES[CAPA_FONTES.length - 1];
    return { fonte: menor, linhas: capaLinhas(titulo, menor, avanco), cabe: false };
  }
  function capaDoClip(clip) {
    return capaTikTokOf(clip && clip.capaTikTok) || { v: 1, estilo: 'negocio', posicao: 'meio' };
  }
  function capaTituloDe(clip, capa) {
    return (capa && capa.titulo) || cleanText(clip && clip.topic, CAPA_TITULO_MAX) || '';
  }
  /* Fora do corte OU dentro de um trecho removido: o quadro não está no vídeo, e a capa fica
     desatualizada (dito) — nunca movida calada para outro quadro. */
  function capaForaDoCorte(clip, capa) {
    if (typeof capa.quadroMs !== 'number') return false;
    if (capa.quadroMs < num(clip.inSec) * 1000 || capa.quadroMs > num(clip.outSec) * 1000) return true;
    return remocoesDoClip(clip).some(function (r) { return capa.quadroMs >= r.deMs && capa.quadroMs < r.ateMs; });
  }
  /* O que o PNG depende: mudar qualquer um destes deixa o PNG gerado desatualizado. */
  function capaChave(clip) {
    var capa = capaDoClip(clip);
    return JSON.stringify([capa.quadroMs, capa.estilo, capa.posicao, capaTituloDe(clip, capa),
      capa.destaque || '', reframeOf(clip), editOf(clip).enquadramento]);
  }
  /* O corpo do POST: o MESMO do export (enquadramento, título, token e intervalo da fonte) +
     a capa RESOLVIDA (manchete vazia = o título do corte). */
  function capaCorpo(clip) {
    var capa = capaDoClip(clip);
    var corpo = renderBody(clip, true, { token: SRC.token, name: SRC.name });
    corpo.capaTikTok = { v: 1, estilo: capa.estilo, posicao: capa.posicao,
      titulo: capaTituloDe(clip, capa) };
    if (typeof capa.quadroMs === 'number') corpo.capaTikTok.quadroMs = capa.quadroMs;
    if (capa.destaque) corpo.capaTikTok.destaque = capa.destaque;
    return corpo;
  }
  /* A linha de estado do painel. TODO ramo fala (BP-008), inclusive os que não agem. */
  /* Editor sem frase (decisão do usuário, 2026-10-01): o estado da capa mora no RÓTULO do
  botão que gera o PNG — gerando, falhou, desatualizada ("Gerar de novo") ou a gerar. */
  function capaRotuloGerar(clip) {
    var pronta = CAPA_PRONTA[clip.id];
    if (CAPA_BUSY[clip.id]) return 'Gerando…';
    if (CAPA_FALHA[clip.id]) return ROTULO_FALHOU;
    if (pronta && pronta.chave !== capaChave(clip)) return 'Gerar de novo';
    return 'Gerar capa';
  }
  /* O destaque na PRÉVIA: só o trecho digitado (achado sem diferenciar maiúsculas). O
     automático é o `resolveTitleHighlight` do renderizador, e ele aparece no PNG real — a
     tela diz isso em vez de ter uma segunda cópia do algoritmo. */
  function capaTextoHTML(titulo, destaque) {
    var alvo = String(destaque || '').trim();
    var i = alvo ? titulo.toLowerCase().indexOf(alvo.toLowerCase()) : -1;
    if (i < 0) return esc(titulo);
    return esc(titulo.slice(0, i)) + '<b class="vop-capa-destaque">' + esc(titulo.slice(i, i + alvo.length))
      + '</b>' + esc(titulo.slice(i + alvo.length));
  }
  function capaZonasHTML() {
    return [['grade', 'Recorte do perfil (3:4)'], ['seguro', 'Miolo seguro'], ['contador', 'Plays']]
      .map(function (z) {
        var r = CAPA_ZONAS[z[0]];
        return '<div class="vop-capa-guia" data-capa-guia="' + z[0] + '" style="--gx:' + r.x + ';--gy:' + r.y
          + ';--gw:' + r.largura + ';--gh:' + r.altura + '"><span>' + esc(z[1]) + '</span></div>';
      }).join('');
  }
  function capaPrevHTML(clip) {
    var capa = capaDoClip(clip);
    var titulo = capaTituloDe(clip, capa);
    var geo = legGeoDoCorte(clip);
    var alto = geo && geo.videoAltura ? geo.videoAltura : 608;
    var quadro = CAPA_QUADRO[clip.id] && CAPA_QUADRO[clip.id].ms === capa.quadroMs ? CAPA_QUADRO[clip.id].url : '';
    return '<div class="vop-capa-prev" data-capa-prev data-estilo="' + esc(capa.estilo) + '"'
      + ' data-posicao="' + esc(capa.posicao) + '" data-recorte="' + (reframeOf(clip) === 'blur' ? '0' : '1') + '"'
      + ' style="--capa-video:' + num(alto) + ';--capa-fonte:' + capaTituloTela(titulo, capa.estilo).fonte + '">'
      + (quadro
        ? '<img class="vop-capa-fundo" alt="" src="' + esc(quadro) + '">'
          + '<img class="vop-capa-quadro" alt="Quadro escolhido para a capa" src="' + esc(quadro) + '">'
        : '')
      + '<div class="vop-capa-texto"><span data-capa-texto>' + capaTextoHTML(titulo, capa.destaque) + '</span></div>'
      + capaZonasHTML() + '</div>';
  }
  function capaRadiosHTML(clip, chave, opcoes, rotulos, atual, rotulo) {
    return '<div class="vop-capa-linha"><span class="vop-leg-lab">' + esc(rotulo) + '</span>'
      + '<div class="vop-leg-seg">' + opcoes.map(function (valor) {
        var id = 'capa-' + chave + '-' + clip.id + '-' + valor;
        return '<input type="radio" id="' + esc(id) + '" name="capa-' + esc(chave) + '-' + esc(clip.id) + '"'
          + ' data-capa-field="' + esc(chave) + '" data-id="' + esc(clip.id) + '" value="' + esc(valor) + '"'
          + (atual === valor ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(rotulos[valor]) + '</label>';
      }).join('') + '</div></div>';
  }
  function capaSaidaHTML(clip) {
    var pronta = CAPA_PRONTA[clip.id];
    if (!pronta) return '<div data-capa-saida></div>';
    return '<div class="vop-capa-saida" data-capa-saida>'
      + '<img class="vop-capa-png" alt="Capa real gerada (PNG 1080x1920)" src="' + esc(pronta.url) + '">'
      + '<a class="vop-btn vop-btn-quiet" href="' + esc(pronta.url) + '" download="' + esc(pronta.arquivo) + '">Baixar PNG</a>'
      + '</div>';
  }
  function capaPanelHTML(clip) {
    var capa = capaDoClip(clip);
    var podeGerar = srcReady() && typeof capa.quadroMs === 'number' && !capaForaDoCorte(clip, capa) && !CAPA_BUSY[clip.id];
    return '<section class="vop-capa" data-capa-painel data-id="' + esc(clip.id) + '">'
      + '<div class="vop-capa-cab"><span class="vop-capa-tit">Capa do TikTok</span></div>'
      + '<div class="vop-capa-corpo">'
      + capaPrevHTML(clip)
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="capa-quadro" data-id="' + esc(clip.id) + '"'
      + (srcReady() ? '' : ' disabled') + '>Usar este quadro</button>'
      + '<label class="vop-capa-campo"><span class="vop-leg-lab">Manchete</span>'
      + '<input type="text" maxlength="' + CAPA_TITULO_MAX + '" data-capa-field="titulo" data-id="' + esc(clip.id) + '"'
      + ' value="' + esc(capa.titulo || '') + '" placeholder="' + esc(cleanText(clip.topic, CAPA_TITULO_MAX)) + '" spellcheck="false"></label>'
      + '<label class="vop-capa-campo"><span class="vop-leg-lab">Destaque</span>'
      + '<input type="text" maxlength="' + CAPA_DESTAQUE_MAX + '" data-capa-field="destaque" data-id="' + esc(clip.id) + '"'
      + ' value="' + esc(capa.destaque || '') + '" placeholder="Automático" spellcheck="false"></label>'
      + capaRadiosHTML(clip, 'estilo', CAPA_ESTILOS, CAPA_ESTILO_LABELS, capa.estilo, 'Estilo')
      + capaRadiosHTML(clip, 'posicao', CAPA_POSICOES, CAPA_POSICAO_LABELS, capa.posicao, 'Posição')
      + '<button class="vop-btn" type="button" data-act="capa-gerar" data-id="' + esc(clip.id) + '"'
      + (podeGerar ? '' : ' disabled') + ' data-capa-gerar>' + esc(capaRotuloGerar(clip)) + '</button>'
      + capaSaidaHTML(clip)
      + '</div></section>';
  }
  /* Grava no CORTE, sempre pelo validador. Texto não re-renderiza (BP-001): a prévia e as
     frases são atualizadas no LUGAR. Radio é clique deliberado: re-renderiza. */
  function capaFieldWrite(input, grava) {
    var clip = findById(YT.candidates, input.dataset.id);
    if (!clip) return false;
    var capa = capaDoClip(clip);
    var chave = input.dataset.capaField;
    if (chave === 'estilo' || chave === 'posicao') capa[chave] = input.value;
    else if (chave === 'titulo' || chave === 'destaque') {
      if (String(input.value || '').trim()) capa[chave] = String(input.value); else delete capa[chave];
    } else return false;
    clip.capaTikTok = capaTikTokOf(capa);
    delete CAPA_FALHA[clip.id];
    if (grava) projectsPersist();
    return true;
  }
  function capaPaint(clip) {
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    var painel = raiz && raiz.querySelector('[data-capa-painel][data-id="' + clip.id + '"]');
    if (!painel) return;
    var capa = capaDoClip(clip);
    var titulo = capaTituloDe(clip, capa);
    var texto = painel.querySelector('[data-capa-texto]');
    if (texto) texto.innerHTML = capaTextoHTML(titulo, capa.destaque);
    var prev = painel.querySelector('[data-capa-prev]');
    if (prev && prev.style) prev.style.setProperty('--capa-fonte', capaTituloTela(titulo, capa.estilo).fonte);
    var gerar = painel.querySelector('[data-capa-gerar]');
    if (gerar) gerar.textContent = capaRotuloGerar(clip);
  }
  /* "Usar este quadro": o instante do MESMO `<video>` (nunca um segundo), desenhado num canvas
     pequeno só para a prévia. A fonte é da mesma origem (`/sources/`), então o canvas não fica
     "sujo" e o `toDataURL` funciona. O instante vai para o projeto; a imagem, só para a sessão. */
  function capaUsarQuadro(clipId) {
    var clip = findById(YT.candidates, clipId);
    var t = srcNow();
    if (!clip || t === null) { toast('O player não está pronto — importe o vídeo e tente de novo.', 'error'); return; }
    var capa = capaDoClip(clip);
    capa.quadroMs = Math.round(t * 1000);
    clip.capaTikTok = capaTikTokOf(capa);
    delete CAPA_FALHA[clip.id];
    projectsPersist();
    var v = srcVideo();
    try {
      var tela = document.createElement('canvas');
      var w = Number(v.videoWidth) || 0, h = Number(v.videoHeight) || 0;
      if (w && h) {
        var escala = Math.min(1, 540 / w);
        tela.width = Math.round(w * escala);
        tela.height = Math.round(h * escala);
        tela.getContext('2d').drawImage(v, 0, 0, tela.width, tela.height);
        CAPA_QUADRO[clip.id] = { ms: clip.capaTikTok.quadroMs, url: tela.toDataURL('image/jpeg', 0.82) };
      }
    } catch (erro) {
      delete CAPA_QUADRO[clip.id];
    }
    if (capaForaDoCorte(clip, clip.capaTikTok)) toast('Este quadro está fora do corte — a capa só sai de um quadro dentro dele.', 'error');
    renderKeepingScroll();
  }
  function capaGerar(clipId) {
    var clip = findById(YT.candidates, clipId);
    if (!clip || CAPA_BUSY[clip.id]) return;
    CAPA_BUSY[clip.id] = true;
    delete CAPA_FALHA[clip.id];
    var chave = capaChave(clip);
    renderKeepingScroll();
    fetch('/api/capa-tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(capaCorpo(clip))
    }).catch(function () {
      throw new Error('O renderizador não está ativo — rode estudio.ps1.');
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) {
          throw new Error(CAPA_MSG[payload && payload.code] || cleanText(payload && payload.error, 300)
            || 'o renderizador recusou o pedido.');
        }
        return payload;
      });
    }).then(function (payload) {
      if (!payload.url || !payload.arquivo) throw new Error('o servidor não devolveu o arquivo.');
      CAPA_PRONTA[clip.id] = { url: payload.url + '?v=' + Date.now(), arquivo: payload.arquivo, chave: chave };
      delete CAPA_BUSY[clip.id];
      renderKeepingScroll();
    }).catch(function (erro) {
      delete CAPA_BUSY[clip.id];
      CAPA_FALHA[clip.id] = erro && erro.message ? erro.message : 'erro desconhecido.';
      renderKeepingScroll();
    });
  }

  /* --- Editor em FERRAMENTAS (decisão do usuário, 2026-10-01) ----------------------------
     Uma barra FIXA entre o vídeo e o painel; clicar numa ferramenta mostra só os controles
     dela. A barra é um grupo de radios NATIVOS (`name` com o id do corte): o `:checked`
     desenha a ferramenta ativa e o CSS (`:has()`) mostra o painel dela — zero JS de estado
     visual, e trocar NÃO chama `render()` (o `<video>` e o `<audio>` da música seguem
     tocando). Todo painel fica no DOM: handlers, ticks e checks continuam valendo. */
  /* Corte e Capa SAÍRAM da barra (decisão do usuário, 2026-10-05): viraram as etapas
     "Marcar trecho" e "Criar capa" do fluxo — ver `YT_ETAPAS`. */
  var YT_FERRAMENTAS = [['enquadrar', 'Enquadrar'], ['legenda', 'Legenda'],
    ['card', 'Card'], ['texto', 'Texto'], ['zoom', 'Zoom'], ['musica', 'Música'],
    ['analise', 'Análise']];
  /* O fluxo do editor (decisão do usuário, 2026-10-05): Marcar trecho → Editar vídeo →
     Baixar vídeo editado → Criar capa. Começo/fim e remoções moram SÓ em "Marcar trecho";
     "Criar capa" só abre depois do clique em "Baixar vídeo editado" que de fato começou o
     render (ou se o corte já tem capa salva — edição do usuário não some). Estado de SESSÃO,
     por corte, sem localStorage. */
  var YT_ETAPAS = [['trecho', 'Marcar trecho'], ['editar', 'Editar vídeo'], ['capa', 'Criar capa']];
  var YT_ETAPA = Object.create(null);
  var YT_CAPA_LIBERADA = Object.create(null);
  function ytCapaLiberada(clip) { return !!(YT_CAPA_LIBERADA[clip.id] || clip.capaTikTok); }
  function ytEtapaDe(clip) {
    var e = YT_ETAPA[clip.id] || 'trecho';
    return e === 'capa' && !ytCapaLiberada(clip) ? 'editar' : e;
  }
  function ytEtapasHTML(clip, ativa) {
    return '<nav class="yt-etapas" aria-label="Etapas">' + YT_ETAPAS.map(function (e, i) {
      var travada = e[0] === 'capa' && !ytCapaLiberada(clip);
      return '<button type="button" data-act="yt-etapa" data-id="' + esc(clip.id) + '" data-etapa="' + e[0] + '"'
        + (ativa === e[0] ? ' aria-current="step"' : '') + (travada ? ' disabled' : '') + '>'
        + '<span class="yt-etapa-n">' + (i + 1) + '</span>' + esc(e[1]) + '</button>';
    }).join('') + '</nav>';
  }
  /* A ferramenta e a subaba da Legenda em uso: estado de SESSÃO (sem localStorage). A
     primeira da barra na primeira abertura; depois, a última usada — inclusive em outro corte. */
  var YT_TOOL = 'enquadrar';
  var LEG_ABAS = [['texto', 'Texto'], ['estilo', 'Estilo'], ['posicao', 'Posição'],
    ['profundidade', 'Profundidade'], ['avancado', 'Avançado']];
  var LEG_ABA = 'texto';
  /* Rolagem do corpo do painel por ferramenta (BP-013): trocar devolve onde cada uma estava. */
  var YT_TOOL_SCROLL = Object.create(null);
  function ytAnaliseTem(clip) {
    return !!(clip.hook || clip.reason || (clip.signals || []).length
      || (Array.isArray(clip.factors) && clip.factors.length));
  }
  function ytFerramentasDe(clip) {
    return YT_FERRAMENTAS.filter(function (f) { return f[0] !== 'analise' || ytAnaliseTem(clip); });
  }
  function ytToolAtiva(clip) {
    var lista = ytFerramentasDe(clip).map(function (f) { return f[0]; });
    return lista.indexOf(YT_TOOL) >= 0 ? YT_TOOL : lista[0];
  }
  /* A bolinha: o corte tem valor diferente do padrão naquela ferramenta. Deriva do MODELO. */
  function ytToolDots(clip) {
    var edit = editOf(clip);
    return {
      enquadrar: reframeOf(clip) !== REFRAME_PADRAO,
      legenda: legendaStyleOf(clip) !== LEGENDA_PADRAO || Object.keys(edit.legenda).length > 0
        || !!(clip.capEdit && clip.capEdit.length),
      card: !!clip.cardId || titleCardStyleOf(clip) === TITLE_CARD_SEM,
      texto: textosDoClip(clip).length > 0,
      zoom: zoomsDoClip(clip).length > 0,
      musica: !!musicaDoClip(clip),
      analise: false
    };
  }
  /* Repinta as bolinhas NO LUGAR — roda depois de toda mudança/digitação/clique do editor,
     inclusive das escritas que não re-renderizam. */
  function ytToolDotsPaint() {
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    var clip = YT.detail ? findById(YT.candidates, YT.detail) : null;
    if (!raiz || !clip || !raiz.querySelectorAll) return;
    var dots = ytToolDots(clip);
    raiz.querySelectorAll('[data-tool-dot]').forEach(function (i) { i.hidden = !dots[i.dataset.toolDot]; });
  }
  function ytToolTroca(valor) {
    if (!YT_FERRAMENTAS.some(function (f) { return f[0] === valor; })) return;
    var raiz = document.getElementById('video-ops-root');
    var corpo = raiz && raiz.querySelector('[data-tool-body]');
    if (corpo) YT_TOOL_SCROLL[YT_TOOL] = corpo.scrollTop;
    YT_TOOL = valor;
    if (corpo) corpo.scrollTop = YT_TOOL_SCROLL[valor] || 0;
  }
  function ytToolBarHTML(clip, ativa) {
    var dots = ytToolDots(clip);
    return '<div class="yt-tools" role="radiogroup" aria-label="Ferramentas">'
      + ytFerramentasDe(clip).map(function (f) {
        var id = 'yt-tool-' + clip.id + '-' + f[0];
        return '<input type="radio" id="' + esc(id) + '" name="yt-tool-' + esc(clip.id) + '"'
          + ' data-yt-tool data-id="' + esc(clip.id) + '" value="' + f[0] + '"' + (ativa === f[0] ? ' checked' : '') + '>'
          + '<label for="' + esc(id) + '">' + esc(f[1])
          + '<i class="yt-tool-dot" data-tool-dot="' + f[0] + '" aria-hidden="true"' + (dots[f[0]] ? '' : ' hidden') + '></i>'
          + '</label>';
      }).join('') + '</div>';
  }
  function ytToolHTML(chave, rotulo, corpo) {
    return '<section class="yt-tool" data-tool="' + chave + '" aria-label="' + esc(rotulo) + '">' + corpo + '</section>';
  }
  /* A única ferramenta com conteúdo explicativo: por que o trecho foi sugerido e a nota. */
  function ytAnaliseHTML(clip) {
    return (clip.hook ? '<blockquote class="yt-detail-hook">' + esc(clip.hook) + '</blockquote>' : '')
      + (clip.reason ? '<p class="yt-detail-reason">' + esc(clip.reason) + '</p>' : '')
      + ((clip.signals || []).length
        ? '<div class="vop-pill-row">' + clip.signals.map(function (s) { return chip('vop-chip-quiet', signalLabel(s)); }).join('') + '</div>'
        : '')
      + ytFactorsHTML(clip);
  }
  /* Exportar mora na barra de cima: UM menu com nome, três destinos, o mesmo padrão do
     `ytDownloadHTML` (`YT.dlMenu`, Esc fecha). O rótulo do gatilho carrega o estado. */
  /* O rótulo do gatilho: um dono só, usado na montagem e na repintura no lugar. */
  function ytExportRotulo(id) {
    return YT_BUSY['render:' + id] ? 'Renderizando…' : YT_BUSY['fetch:' + id] ? 'Gerando…'
      : (YT_FALHA['render:' + id] || YT_FALHA['fetch:' + id]) ? ROTULO_FALHOU : 'Baixar';
  }
  /* O export começa SEM re-render (o `ytBusy` só mexe no item clicado): sem isto o gatilho
     dizia "Baixar" durante os minutos de render — achado no Chrome em 2026-10-01. */
  function ytExportPaint() {
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    var rotulo = raiz && raiz.querySelector && raiz.querySelector('[data-export-rotulo]');
    if (rotulo && YT.detail) rotulo.textContent = ytExportRotulo(YT.detail);
  }
  function ytExportHTML(clip, status) {
    var aberto = YT.dlMenu === clip.id;
    var renderizando = !!YT_BUSY['render:' + clip.id];
    var falha = YT_FALHA['render:' + clip.id];
    var travado = !status.podeBaixar;
    return '<div class="yt-dl yt-detail-export' + (aberto ? ' open' : '') + '">'
      + '<button class="vop-btn vop-btn-primary yt-dl-trigger" type="button" data-act="yt-dl-menu"'
      + ' data-id="' + esc(clip.id) + '" aria-expanded="' + aberto + '" aria-haspopup="true">'
      + '<span data-export-rotulo>' + esc(ytExportRotulo(clip.id)) + '</span><span class="yt-dl-caret" aria-hidden="true"></span></button>'
      + (aberto
        ? '<div class="yt-dl-menu" role="menu">'
          + '<button type="button" role="menuitem" data-act="yt-render" data-id="' + esc(clip.id) + '"'
          + (travado || renderizando ? ' disabled' : '') + '>'
          + esc(renderizando ? 'Renderizando…' : falha === 'legenda' ? ROTULO_FALHOU : 'Baixar vídeo editado') + '</button>'
          + '<button type="button" role="menuitem" data-act="yt-fetch" data-id="' + esc(clip.id) + '"'
          + (travado ? ' disabled' : '') + '>' + esc(status.rotulo) + '</button>'
          + '<button type="button" role="menuitem" data-act="yt-render-limpo" data-id="' + esc(clip.id) + '"'
          + (travado || renderizando ? ' disabled' : '') + '>'
          + esc(falha === 'limpo' ? ROTULO_FALHOU : 'Editado, sem legenda') + '</button>'
          + '</div>'
        : '')
      + '</div>';
  }
  function ytDetailHTML(clip, videoId, gate) {
    var status = clipStatusOf(clip, gate);
    var ativa = ytToolAtiva(clip);
    var etapa = ytEtapaDe(clip);
    var lado;
    /* "Marcar trecho" e "Criar capa" têm um painel só: sem barra, coluna única. A seção usa
       `yt-tool` + `data-tool` para herdar o layout de sempre (a capa ao lado da prévia). */
    if (etapa === 'trecho') {
      lado = '<div class="yt-detail-side" data-etapa-lado><div class="yt-tool-body" data-tool-body>'
        + '<section class="yt-tool yt-etapa" data-tool="corte" aria-label="Marcar trecho">'
        + ytTrimHTML(clip) + remocoesPanelHTML(clip)
        + '<div class="yt-etapa-acoes">'
        + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-manual">Marcar trecho daqui</button>'
        + '<button class="vop-btn vop-btn-primary" type="button" data-act="yt-etapa" data-id="' + esc(clip.id) + '" data-etapa="editar">Editar vídeo</button>'
        + '</div></section></div></div>';
    } else if (etapa === 'capa') {
      lado = '<div class="yt-detail-side" data-etapa-lado><div class="yt-tool-body" data-tool-body>'
        + '<section class="yt-tool yt-etapa" data-tool="capa" aria-label="Criar capa">' + capaPanelHTML(clip) + '</section>'
        + '</div></div>';
    }
    return '<section class="yt-detail" data-clip="' + esc(clip.id) + '" data-etapa="' + etapa + '">'
      + '<div class="yt-detail-top">'
      + '<button class="vop-btn vop-btn-quiet" type="button" data-act="yt-back">← Todas as sugestões</button>'
      + ytEtapasHTML(clip, etapa)
      + '<input class="yt-detail-title" type="text" maxlength="180" value="' + esc(clip.topic) + '"'
      + ' data-clip-field="topic" data-id="' + esc(clip.id) + '" spellcheck="false"'
      + ' aria-label="Título do corte">'
      /* Baixar vem DEPOIS de marcar o trecho: em "Marcar trecho" o menu não aparece. */
      + (etapa === 'trecho' ? '' : ytExportHTML(clip, status))
      + '</div>'
      + '<div class="yt-detail-grid">'
      /* O player É o da FONTE, o MESMO nó de sempre (`srcAdopt`). A coluna é só ele. A ordem
         main → side é contrato do `colunaEsquerda` dos testes. */
      + '<div class="yt-detail-main">' + ytStageHTML(clip, gate) + '</div>'
      + (lado || ('<div class="yt-detail-side">'
      + ytToolBarHTML(clip, ativa)
      + '<div class="yt-tool-body" data-tool-body>'
      + ytToolHTML('enquadrar', 'Enquadrar', reframeFieldHTML(clip, 'clip-field', 'reframe'))
      + ytToolHTML('legenda', 'Legenda', legendaPanelHTML(clip))
      /* A biblioteca é GLOBAL (um card é do canal), mas abre AQUI, dentro da ferramenta Card,
         com "Voltar" — nunca abaixo do espaço de trabalho. */
      + ytToolHTML('card', 'Card', CARDS_OPEN ? cardsPanelHTML() : cardStyleFieldHTML(clip))
      + ytToolHTML('texto', 'Texto', textosPanelHTML(clip))
      + ytToolHTML('zoom', 'Zoom', zoomsPanelHTML(clip))
      + ytToolHTML('musica', 'Música', musicaPanelHTML(clip))
      + (ytAnaliseTem(clip) ? ytToolHTML('analise', 'Análise', ytAnaliseHTML(clip)) : '')
      + '</div></div>'))
      + '</div>'
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
    var previa = aberto && SRC_PREVIEW.key === srcPreviewKey(aberto) && SRC_PREVIEW.state === 'ready';
    if (aberto && !previa) {
      var falhou = SRC_PREVIEW.state === 'error';
      var gate = ytFetchGate(YT);
      /* Editor sem frase (2026-10-01): enquanto o trecho é preparado a moldura fica vazia e
         ocupada (`aria-busy`); se falhar, o botão diz que falhou e tenta de novo. */
      return '<section class="yt-stage-off" data-src-panel>'
        + '<div class="yt-stage-frame" data-vazio' + (falhou || !gate.allowed ? '' : ' aria-busy="true"') + '></div>'
        + (falhou && gate.allowed ? '<button class="vop-btn" type="button" data-act="src-preview-retry">' + ROTULO_FALHOU + '</button>' : '')
        + '</section>';
    }
    var corte = aberto ? cropInsetPct(reframeOf(aberto)) : 0;
    var aviso = sourceWarning(aberto ? reframeOf(aberto) : REFRAME_PADRAO, SRC.width, SRC.height);
    return '<section class="yt-src" data-src-panel>'
      + (aberto ? legModoHTML() : '')
      /* O palco tem DUAS caras e um `<video>` só. "Como sai 9:16" desenha um quadro 9:16
         dentro do palco (medido pela altura do palco, que é determinada — ver o CSS), com o
         vídeo, as tarjas e a legenda nos números do servidor. "Original 16:9" é o player de
         sempre. Trocar muda só o `data-modo`. */
      /* No editor o palco mora numa ÁREA que é contêiner de tamanho: é ela que dá ao 9:16 a
         altura real da coluna (tela fixa, 2026-10-01). Na grade não há área. */
      + (aberto ? '<div class="yt-src-area">' : '')
      + '<div class="yt-src-stage" data-src-stage tabindex="0" data-modo="' + (aberto ? PREVIA_MODO : 'original') + '"'
      + (aberto ? ' data-reframe="' + esc(reframeOf(aberto)) + '"' + legPalcoAttrs() : '') + '>'
      + '<div class="yt-src-quadro">'
      + (aberto ? '<div class="yt-src-fundo" aria-hidden="true"><span></span><span></span></div>' : '')
      /* `preload="metadata"`: a duração e o índice entram na hora, os bytes só quando o
         operador der play ou arrastar. Num arquivo de 2 GB, `auto` começaria a baixar tudo
         de novo — depois de o vídeo já estar no disco desta máquina. */
      + '<video class="yt-src-video" data-src-video data-src-offset="' + (aberto ? num(aberto.inSec) : 0)
      /* Controles NATIVOS só no "Original 16:9": no 9:16 a barra do Chrome cobre a faixa
         do vídeo — exatamente onde mora a legenda automática (P2). Lá a barra é a nossa,
         abaixo do quadro. Trocar de modo só vira a propriedade no MESMO nó (`legModoTroca`). */
      + '" src="' + esc(previa ? SRC_PREVIEW.url : SRC.url) + '"'
      + (aberto && PREVIA_MODO === 'saida' ? '' : ' controls')
      + ' preload="metadata" playsinline></video>'
      + (corte ? '<div class="vop-cand-mask" style="--corte:' + corte + '%" aria-hidden="true"></div>' : '')
      + (aberto ? legendaPreviewHTML(aberto) : '')
      + (aberto ? textosPrevHTML(aberto) : '')
      /* Dentro do QUADRO, no canto da faixa de cima (fora dele o rótulo flutuava no preto). */
      + '</div>'
      + '</div>'
      + (aberto ? '</div>' : '')
      + (aberto ? legBarraHTML(aberto) : '')
      /* No editor a linha de baixo some: duração e bordas moram na ferramenta Corte, e o
         "Marcar trecho daqui" também. */
      + (aberto ? '' : '<div class="yt-src-meta">'
        + '<p class="yt-src-id"><strong>' + esc(SRC.name) + '</strong> · '
          + esc(fmtClock(SRC.durationSec)) + ' · ' + esc(fmtBytes(SRC.bytes))
          + (SRC.width ? ' · ' + num(SRC.width) + '×' + num(SRC.height) : '')
          + (SRC.hasAudio ? '' : ' · <em>sem faixa de áudio</em>') + '</p>'
        + '<a class="vop-btn vop-btn-quiet" href="' + esc(SRC.url) + '" download="' + esc(SRC.name) + '">Baixar original</a>'
        + '<button class="vop-btn" type="button" data-act="yt-manual">Marcar trecho daqui</button>'
        + '</div>')
      + (aviso && !aberto ? '<p class="vop-warning">' + esc(aviso) + '</p>' : '')
      + (aberto ? '' : srcStripHTML())
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
    /* Duas fases (reformulação visual, 2026-09-25): `entrada` mostra só a frase de abertura,
       o campo, o botão e a declaração; `trabalho` começa quando existe algo para acompanhar
       (importação, análise, projeto reaberto). Etapas, fonte e cortes antes disso eram
       estado vazio competindo com a única coisa que a pessoa precisa fazer. */
    var fase = (SRC.state !== 'idle' || probing || YT.state === 'ready' || YT.probeError
      || YT.candidates.length || emEdicao) ? 'trabalho' : 'entrada';
    /* A entrada anima só na TROCA de fase: `render()` recria os nós, e uma animação de
       entrada presa ao nó tocaria de novo a cada clique. */
    var entrou = fase !== YT_FASE_ANTES;
    YT_FASE_ANTES = fase;
    return '<section class="yt-hub" data-yt data-fase="' + fase + '"' + (entrou ? ' data-enter' : '') + '>'
      /* No editor o foco é o corte: o campo da URL só volta ao topo se faltar a declaração —
         aí ela é o que destrava o resto, e escondê-la mandaria a pessoa procurar. */
      + (emEdicao && YT.authorized ? '' : '<div class="yt-hero">'
      + (fase === 'entrada'
        ? '<h2 class="yt-hero-title">Transforme um vídeo longo em cortes prontos</h2>'
          + '<p class="vop-flow-hint">' + esc(FLOW_HINT.youtube) + '</p>'
        : '')
      /* Campo de URL e ação principal na mesma linha: é UMA decisão. O rótulo diz o que o
         botão FAZ — "Analisar" descrevia o passo antigo, em que a análise era tudo o que
         acontecia e a mídia vinha depois, trecho por trecho. */
      + '<div class="yt-intake">'
      + '<label class="yt-intake-field"><span>Link do vídeo</span>'
      + '<input type="url" value="' + esc(YT.url) + '" placeholder="Cole o link do YouTube"'
      + ' autocomplete="off" spellcheck="false" data-yt-url></label>'
      + '<button class="vop-btn vop-btn-primary" type="button" data-act="yt-import"'
      + (importando ? ' disabled aria-busy="true"' : '') + '>'
      + (importando ? 'Importando…' : 'Iniciar') + '</button>'
      + '</div>'
      /* O portão de direitos em pessoa. Analisar é livre; baixar mídia exige esta
         declaração — e o botão de baixar fica desabilitado com o motivo à vista até ela
         existir. Não sai daqui e não é afrouxado por causa da tela nova. */
      + '<label class="vop-yt-rights"><input type="checkbox" data-yt-rights'
      + (YT.authorized ? ' checked' : '') + '>'
      + '<span><strong>Declaro que tenho autorização do criador para publicar cortes deste vídeo.</strong>'
      + ' <small>Obrigatória antes de baixar: sem ela, baixar mídia de terceiro viola direito autoral. Vale só para esta URL e fica salva com o projeto.</small></span></label>'
      + (fase === 'entrada'
        ? '<ol class="yt-howto" aria-label="O que acontece depois">'
          + '<li><b>1</b>Baixa o vídeo inteiro</li>'
          + '<li><b>2</b>Encontra os melhores trechos</li>'
          + '<li><b>3</b>Gera os cortes prontos</li></ol>'
        : '')
      + '</div>')
      + (fase === 'entrada' ? '</section>' : ytWorkHTML(videoId, gate, probing, emEdicao, lista));
  }
  var YT_FASE_ANTES = '';
  function ytWorkHTML(videoId, gate, probing, emEdicao, lista) {
    /* Etapas e resumo da fonte são da fase de TRAZER o vídeo; no editor eles só empurrariam
       o corte para baixo da dobra. Voltar à grade os traz de volta. */
    /* A nota da análise (`YT.note`) continua no dado e não é desenhada em lugar nenhum
       (decisão do usuário, 2026-10-01). */
    if (emEdicao) return ytDetailHTML(emEdicao, videoId, gate) + '</section>';
    return ytStepsHTML()
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
      /* O player da fonte fica acima da GRADE, que é onde ele serve para comparar trechos
         (a miniatura arrasta, o "Marcar trecho daqui" lê o instante). No editor ele desceu
         para a coluna da esquerda, ao lado dos controles — então aqui ele sai, senão a tela
         declararia DOIS `<video>` do mesmo arquivo e o `srcAdopt` adotaria só o primeiro. */
      + (emEdicao ? '' : srcPanelHTML())
      + (emEdicao ? ytDetailHTML(emEdicao, videoId, gate)
        : (lista.length
          ? '<div class="yt-results-head">'
            + '<h3>Cortes recomendados · ' + lista.length + '</h3>'
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
      + (lista.length && !emEdicao ? '<small class="vop-mark-note">O vídeo editado vai para a Central, com o endereço do arquivo no seu computador.</small>' : '')
      + '</section>';
  }
  /* Rolagem da grade, guardada ao entrar no editor. Mora no MODULO e nao no estado
     persistido: e posicao de tela, some com o recarregamento, e nao pertence ao projeto. */
  var YT_GRID_SCROLL = 0;
  /* Corte cuja última borda pedida foi recusada (sessão). */
  var YT_TRIM_INVALIDO = Object.create(null);
  /* Aplica o trim e FALA o que aconteceu — nenhum ramo termina calado (BP-008): aplicou,
     recusou com o motivo, ou nao mudou nada. */
  function ytTrimResult(clip, inSec, outSec) {
    var tinhaArquivo = !!(clip.clipToken || clip.clipFilename);
    var tinhaCorrecao = !!clip.capEdit;
    var jaAberto = YT.detail === clip.id;
    var antes = clip.inSec + '-' + clip.outSec;
    var erro = ytApplyTrim(clip, inSec, outSec, YT.duration);
    /* Recusada: os campos de tempo acendem aria-invalid até a próxima borda aceita. */
    if (erro) { YT_TRIM_INVALIDO[clip.id] = true; toast(erro, 'error'); renderKeepingScroll(); return; }
    delete YT_TRIM_INVALIDO[clip.id];
    if (antes === clip.inSec + '-' + clip.outSec) { toast('Os tempos já eram esses.'); return; }
    renderKeepingScroll();
    /* A legenda do trecho estava rebaseada no começo ANTIGO e foi descartada junto com a
       borda; ler as falas do novo intervalo é o que mantém o painel e o render sincronizados
       com o que o operador acabou de escolher. Só do trecho ABERTO: recarregar a legenda de
       um trecho que ele nem está vendo é chamada de rede sem motivo. */
    if (jaAberto && srcReady()) srcCuesLoad(clip);
    autoCutsKick();
    toast('Trecho agora é ' + fmtClock(clip.inSec) + ' → ' + fmtClock(clip.outSec) + '.'
      + (tinhaArquivo
        ? ' O vídeo que você já exportou deste trecho foi descartado (era de outro intervalo)'
          + ' — exporte de novo. O vídeo importado continua no Estúdio.'
        : '')
      + (tinhaCorrecao && antes !== clip.inSec + '-' + clip.outSec
        ? ' As correções do texto da legenda eram das falas do intervalo antigo e foram descartadas.'
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
    /* O corte gerado era do intervalo antigo. O arquivo fica no disco (e na Central). */
    delete clip.clipSaved;
    delete AUTO_CUT_FAIL[clip.id];
    /* A correção do texto foi escrita para as falas do intervalo antigo. */
    delete clip.capEdit;
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
    if (on) { YT_BUSY[key] = true; delete YT_FALHA[key]; } else delete YT_BUSY[key];
    ytExportPaint();
    if (!button) return;
    button.disabled = !!on;
    if (on) {
      button.setAttribute('aria-busy', 'true');
      button.textContent = label;
    }
  }
  /* --- TikTok: mandar um clip pronto para a caixa de entrada ------------------------
     RASCUNHO, não post. O arquivo cai nos rascunhos do app e quem escreve a legenda,
     escolhe a capa e aperta publicar é a pessoa, no celular (decisão do usuário,
     2026-09-10 — ver docs/02-Execution/plans/PLANO-tiktok-publicar.md). Isto é o ÚNICO
     ponto do Estúdio que fala com fora da máquina, e ele não decide nada: não escolhe
     conta, não agenda, não aprova, não mede. Quem guarda o segredo e fala com o TikTok é
     o worker; o navegador nunca vê client_secret nem token.
     Estado de SESSÃO: o worker é a fonte da verdade (o token vive em disco, lá). Guardar
     "conectado" no localStorage faria a tela mentir depois de revogar o app no TikTok. */
  var TT = { connected: false, username: '', checked: false };
  function ttState() { return TT; }
  function ttRefresh(redesenhar) {
    return ytPost('/api/tiktok/status', {}).then(function (payload) {
      TT.connected = !!(payload && payload.connected);
      TT.username = (payload && payload.username) || '';
      TT.checked = true;
      if (redesenhar && TAB === 'central') renderKeepingScroll();
    }).catch(function () {
      /* Worker fora do ar já é dito em toda a tela; aqui só não afirmamos "conectado". */
      TT.connected = false; TT.checked = true;
    });
  }
  function ttConnect() {
    if (typeof window === 'undefined' || !window.open) return;
    window.open('/tiktok/login', '_blank', 'noopener');
    toast('Autorize na aba que abriu e volte para cá.');
    /* Voltar o foco para esta aba é o sinal de que a autorização terminou — sem isso a
       tela ficaria dizendo "desconectado" até um F5 (BP-008). `once` para não acumular. */
    window.addEventListener('focus', function () { ttRefresh(true); }, { once: true });
  }
  function ttDisconnect() {
    if (!confirm('Desconectar a conta do TikTok? Os vídeos já enviados não são afetados.')) return;
    ytPost('/api/tiktok/logout', {}).then(function () {
      TT.connected = false; TT.username = '';
      renderKeepingScroll();
      toast('Conta do TikTok desconectada.');
    }).catch(function (err) { toast(err.message, 'error'); });
  }
  /* Sobe o arquivo e SÓ ENTÃO confere o desfecho. O TikTok aceita o upload e processa
     depois: parar no "enviado" esconderia a recusa por formato/duração, que é justamente
     a falha que acontece (BP-008 — nenhum ramo termina mudo). Teto de tentativas para a
     tela não ficar perguntando para sempre. */
  var TT_TENTATIVAS = 10;
  var TT_INTERVALO = 3000;
  function ttWatch(publishId, tentativa) {
    ytPost('/api/tiktok/publish-status', { publishId: publishId }).then(function (payload) {
      var estado = (payload && payload.status) || '';
      if (estado === 'PUBLISH_COMPLETE' || estado === 'SEND_TO_USER_INBOX') {
        toast('Pronto no TikTok. Abra o app no celular: está nas notificações/rascunhos.');
        return;
      }
      if (estado === 'FAILED') {
        toast('O TikTok recusou o vídeo: ' + ((payload && payload.falha) || 'sem motivo informado'), 'error');
        return;
      }
      if (tentativa >= TT_TENTATIVAS) {
        toast('Enviado. O TikTok ainda está processando — confira o app em alguns minutos.', 'warn');
        return;
      }
      setTimeout(function () { ttWatch(publishId, tentativa + 1); }, TT_INTERVALO);
    }).catch(function () {
      toast('Enviado, mas não consegui confirmar o processamento. Confira o app.', 'warn');
    });
  }
  function ttPublish(button, clipId) {
    var clip = findById(LIB.clips, clipId);
    if (!clip) { toast('Este clip não está mais no histórico.', 'error'); return; }
    if (!clip.fileName) { toast('Este clip não tem arquivo guardado para enviar.', 'error'); return; }
    var key = 'tt:' + clipId;
    if (YT_BUSY[key]) return;
    ytBusy(key, true, button, 'Enviando…');
    ytPost('/api/tiktok/publish', { fileName: clip.fileName }).then(function (payload) {
      toast('Vídeo enviado. Conferindo o processamento…');
      ttWatch(payload && payload.publishId, 1);
    }).catch(function (err) {
      toast(err.message, 'error');
      /* Token vencido/app revogado volta 401: o selo tem de refletir isso na hora, senão a
         tela segue oferecendo "Enviar" para uma conta que já não está conectada. */
      ttRefresh(true);
    }).then(function () {
      ytBusy(key, false);
      if (TAB === 'central') renderKeepingScroll();
    });
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
    if (!mesmoVideo) {
      /* Projeto de OUTRO vídeo não herda nem a fonte nem a declaração deste: o player
         estaria tocando o arquivo errado sob os trechos novos, e a autorização de um vídeo
         NUNCA cobre outro. Recarregar a página derruba a declaração do mesmo jeito — ela é
         estado de SESSÃO, e o recarregamento acaba com a sessão. */
      srcReset();
      /* A declaração é do projeto desta URL (gravada quando o operador declarou) — nunca a
         do vídeo anterior. */
      YT.authorized = project.authorized === true;
    }
    if (YT.authorized && !srcReady() && SRC.state !== 'importing') {
      /* Mesma sessão e MESMO vídeo: a declaração vale "por sessão e por URL", e as duas
         continuam valendo — derrubá-la aqui fecharia o portão sobre o vídeo que o operador
         acabou de declarar, com o arquivo já no disco, sem proteger direito nenhum. Então
         ela FICA, e a fonte volta pelo mesmo caminho do portão no `onRootChange`: a rota de
         estado só redescobre o arquivo, sem baixar um byte. Mandar clicar "Importar vídeo"
         num arquivo que já está lá é pedir um clique sem função. */
      srcRestore(ytVideoId(YT.url));
    }
    TAB = 'youtube';
    render();
    autoCutsKick();
  }

  /* `validateProjectClips` e `persistProjectClipFilename` SAIRAM (2026-09-15). Elas
     existiam para responder "o MP4 deste trecho ainda esta no disco?" -- era isso que
     destravava o botao de render, e por isso o projeto reaberto disparava uma chamada ao
     /api/clip-status POR TRECHO. Com o video inteiro importado a pergunta e outra e vale
     para todos: "a FONTE esta pronta?". Quem responde e o `srcRestore`, com UMA chamada.
     A rota /api/clip-status fica no servidor (ela tem teste proprio e nao custa nada
     parada); o que saiu foi o chamador. */
  function ytFail(key, error, marca) {
    ytBusy(key, false);
    YT_FALHA[key] = marca || true;
    ytExportPaint();
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
      autoCutsKick();
      return;
    }
    YT.probeError = '';
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
        ? fresh.length + ' trecho(s) sugerido(s). Os cortes são gerados assim que o vídeo estiver no Estúdio.'
        : 'A análise terminou sem trecho com sinal suficiente.');
      autoCutsKick();
    }).catch(function (error) {
      YT.probeError = cleanText(error && error.message, 300) || 'a análise falhou';
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
        if (entry && entry.state === 'loading') capSeed(alvo);
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
  function ytFetchClip(button, clipId, auto) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) { toast('Este trecho não está mais na lista.', 'error'); return null; }
    if (!srcReady()) { toast('Importe o vídeo antes de gerar um trecho.', 'error'); return null; }
    var gate = ytFetchGate(YT);
    if (!gate.allowed) { toast('Gerar o trecho está bloqueado: ' + gate.reason + '.', 'error'); return null; }
    var key = 'fetch:' + clipId;
    if (YT_BUSY[key]) return null;
    var inicio = num(clip.inSec);
    var fim = num(clip.outSec);
    if (!(fim > inicio)) { toast('Este trecho não tem um intervalo válido.', 'error'); return null; }
    var rev = clip.rev;
    var videoNome = YT.title || ('YouTube ' + YT.videoId);
    var videoId = YT.videoId;
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
    if (!auto) toast('Recortando o trecho do vídeo já importado — leva segundos, não baixa nada.');
    /* Sem corpo: o servidor acha a fonte pelo token no cache dele. É esse caminho
       (`length == 0` no /api/video-cut) que faz o original não subir nem descer de novo. */
    return fetch('/api/video-cut' + query, { method: 'POST', headers: { Accept: 'video/mp4' } })
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
        /* O automático não empurra arquivo para Downloads: ele fica na pasta permanente e o
           card oferece o botão de baixar. Sem pasta permanente não há o que oferecer — e isso
           é falha dita, não sucesso calado (BP-008). */
        if (auto && !guardado) throw new Error('O corte saiu, mas o Estúdio não conseguiu guardá-lo na pasta de clips.');
        if (!auto) downloadBlob(nome, blob);
        var alvo = findById(YT.candidates, clipId);
        /* Borda mudada durante o corte: o arquivo é do intervalo antigo e não vira o corte
           deste trecho (fica na Central, que é o registro do que saiu). */
        if (alvo && alvo.rev === rev) {
          if (guardado) alvo.clipSaved = String(guardado).split(/[\\/]/).pop();
          /* Registro do que foi EXPORTADO deste trecho — não mais "o trecho está no disco".
             É o que o `clipBoundaryChanged` descarta quando a borda muda, sem levar a fonte. */
          alvo.clipToken = fonteToken;
          alvo.clipFilename = nome;
          alvo.clipBytes = blob.size;
          projectsPersist();
        }
        libAdd({
          videoName: videoNome,
          videoUrl: videoId ? 'https://www.youtube.com/watch?v=' + videoId : '',
          clipName: clip.topic, inSec: inicio, outSec: fim,
          fileName: nome, savedPath: guardado, bytes: blob.size, origin: 'youtube'
        });
        ytBusy(key, false);
        if (auto) return;
        render();
        toast((guardado
          ? 'Trecho original guardado em ' + guardado + ' e listado na Central.'
          : 'Trecho original salvo em Downloads: ' + nome + '.')
          + (audioMessage(audio) ? ' ' + audioMessage(audio) : ''));
      })
      .catch(function (error) {
        if (!auto) { ytFail(key, error); return; }
        ytBusy(key, false);
        throw error;
      });
  }
  /* --- Geração AUTOMÁTICA dos cortes (decisão do usuário, 2026-09-23) -----------------
     Fonte pronta + declaração + análise feita = cada trecho vira um MP4 na pasta permanente,
     do mais recomendado para o menos, UM de cada vez (o servidor já serializa o render, e
     um por vez é o que deixa a tela dizer "3 de 10"). É o MESMO /api/video-cut do botão
     "Baixar trecho original" — recorte cru, sem edição. Trecho que já tem arquivo é pulado;
     trecho que falhou fica marcado com o motivo até "Tentar novamente". */
  var AUTO_CUT = '';
  var AUTO_CUT_FAIL = {};
  function autoCutsQueue() {
    return ytRanked().filter(function (c) { return !c.clipSaved; });
  }
  function autoCutsKick() {
    if (AUTO_CUT || typeof fetch !== 'function') return false;
    if (!srcReady() || !ytFetchGate(YT).allowed) return false;
    var proximo = autoCutsQueue().filter(function (c) {
      return !AUTO_CUT_FAIL[c.id] && !YT_BUSY['fetch:' + c.id];
    })[0];
    if (!proximo) { autoPaint(''); return false; }
    AUTO_CUT = proximo.id;
    var p = ytFetchClip(null, proximo.id, true);
    autoPaint(proximo.id);
    if (!p) { AUTO_CUT_FAIL[proximo.id] = 'não foi possível começar este corte'; AUTO_CUT = ''; autoPaint(proximo.id); return false; }
    var fonte = SRC.token;
    p.then(function () { projectsPersist(); }, function (error) {
      AUTO_CUT_FAIL[proximo.id] = cleanText(error && error.message, 300) || 'o corte falhou';
    }).then(function () {
      AUTO_CUT = '';
      autoPaint(proximo.id);
      /* Trocou de vídeo no meio: a fila do vídeo novo começa pelo srcApply dele. */
      if (SRC.token === fonte) autoCutsKick();
    });
    return true;
  }
  /* Atualização PONTUAL: só o painel de etapas e o card do trecho. Um render() inteiro a
     cada corte pronto tiraria o foco de quem está digitando (BP-001) e remontaria os
     players dos cortes que o operador está assistindo. */
  function autoPaint(clipId) {
    if (typeof document === 'undefined' || !document.querySelector) return;
    var passos = document.querySelector('[data-yt-steps]');
    if (passos && 'outerHTML' in passos) passos.outerHTML = ytStepsHTML();
    if (!clipId) return;
    var card = document.querySelector('.yt-card[data-clip="' + clipId + '"]');
    var clip = findById(YT.candidates, clipId);
    if (card && clip && 'outerHTML' in card) card.outerHTML = ytCandidateCardHTML(clip, ytVideoId(YT.url), ytFetchGate(YT));
  }
  /* Ordem da RECOMENDAÇÃO: a nota do detector (`ytclip`, fatores no <details> do editor),
     desempate pelo começo. Trecho sem nota (marcado à mão, ou de antes da nota existir) não
     tem classificação — vai para o fim e o card DIZ isso, em vez de ganhar posição inventada. */
  function ytRanked() {
    return YT.candidates.slice().sort(function (a, b) {
      return (num(b.score) - num(a.score)) || (num(a.inSec) - num(b.inSec));
    });
  }
  function ytRank(clip) {
    if (!(num(clip && clip.score) > 0)) return 0;
    return ytRanked().filter(function (c) { return num(c.score) > 0; }).indexOf(clip) + 1;
  }
  /* As três etapas, cada uma com o seu estado e, na falha, o motivo e o "Tentar novamente". */
  function ytStepsHTML() {
    var videoId = ytVideoId(YT.url);
    if (!videoId) return '<ol class="yt-steps" data-yt-steps hidden></ol>';
    var gate = ytFetchGate(YT);
    function passo(nome, tom, texto, acao) {
      return '<li class="yt-step" data-tone="' + tom + '"><strong>' + nome + '</strong>'
        + '<span>' + esc(texto) + '</span>' + (acao || '') + '</li>';
    }
    function retry(act) {
      return '<button class="vop-btn vop-btn-quiet" type="button" data-act="' + act + '">Tentar novamente</button>';
    }
    var dl = SRC.state === 'ready' ? passo('Download', 'ok', 'Vídeo original salvo · ' + fmtBytes(SRC.bytes))
      : SRC.state === 'importing' ? passo('Download', 'run', srcStageLabel() + ' · ' + num(SRC.percent) + '%')
      : SRC.state === 'error' ? passo('Download', 'error', SRC.error || IMPORT_MSG.error, retry('yt-import'))
      : passo('Download', 'wait', !gate.allowed ? 'Bloqueado: ' + gate.reason + '.' : (SRC.error || 'Aguardando você iniciar.'));
    var an = YT_BUSY['probe:url'] ? passo('Análise', 'run', 'Lendo legenda, capítulos e audiência…')
      : YT.probeError ? passo('Análise', 'error', 'A análise falhou: ' + YT.probeError, retry('yt-probe'))
      : YT.state === 'ready' ? passo('Análise', 'ok', YT.candidates.length + ' trecho(s) recomendado(s)')
      : passo('Análise', 'wait', 'Começa junto com o download.');
    var total = YT.candidates.length;
    var prontos = YT.candidates.filter(function (c) { return c.clipSaved; }).length;
    var falhas = YT.candidates.filter(function (c) { return !c.clipSaved && AUTO_CUT_FAIL[c.id]; });
    var ct;
    if (!total) ct = passo('Cortes', 'wait', YT.state === 'ready' ? 'Nenhum trecho para gerar.' : 'Aguardando a análise.');
    else if (AUTO_CUT) ct = passo('Cortes', 'run', 'Gerando o corte ' + (prontos + falhas.length + 1) + ' de ' + total + '…');
    else if (falhas.length) ct = passo('Cortes', 'error', falhas.length + ' corte(s) falharam: ' + AUTO_CUT_FAIL[falhas[0].id], retry('yt-cuts-retry'));
    else if (prontos === total) ct = passo('Cortes', 'ok', total + ' corte(s) salvos');
    else if (!gate.allowed) ct = passo('Cortes', 'wait', 'Bloqueado: ' + gate.reason + '.');
    else if (!srcReady()) ct = passo('Cortes', 'wait', prontos + ' de ' + total + ' salvos · o resto sai quando o download terminar.');
    else ct = passo('Cortes', 'wait', prontos + ' de ' + total + ' salvos.');
    return '<ol class="yt-steps" data-yt-steps aria-live="polite">' + dl + an + ct + '</ol>';
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
      /* SE este corte tem card. Pelo validador, sempre: trecho antigo nao tem a chave e
         cairia como `undefined` no corpo do POST -- e ai a composicao usaria o
         `defaultProps` (que traz um card de EXEMPLO) em vez do que a tela mostrou.
         Mandar SEMPRE a chave e o que fecha o caminho: o `render_props` do serve.py valida
         de novo, e prop mandado vence defaultProp na composicao. */
      titleCardStyle: titleCardStyleOf(clip),
      /* QUAL card ele veste, JA RESOLVIDO. Vai o OBJETO e nao o id, de proposito: a
         biblioteca mora so aqui no navegador e o servidor nao tem onde consultar um id.
         `null` quando o operador escolheu "Sem card" OU quando o card apontado foi apagado
         -- os dois casos estao escritos no painel do corte (BP-008), e nenhum deles cai em
         outro card. O `card_of` do serve.py valida de novo: o corpo do POST e entrada. */
      card: cardDoClip(clip),
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
    if (Object.keys(edit.legenda).length || Object.keys(edit.enquadramento).length || edit.musica
      || edit.remocoes || edit.textos || edit.zooms) corpo.edit = edit;
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
    var musicaEstadoExport = '';
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
      /* Música: cabeçalho CONDICIONAL. Faixa sumida sai SEM música, e a frase diz isso. */
      musicaEstadoExport = response.headers && response.headers.get ? response.headers.get('X-Clip-Musica') || '' : '';
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
        + (backgroundMessage(fundo) ? ' ' + backgroundMessage(fundo) : '')
        + (MUSICA_MSG[musicaEstadoExport] ? ' ' + MUSICA_MSG[musicaEstadoExport] : ''),
        musicaEstadoExport && musicaEstadoExport !== 'MUSICA_OK' ? 'error' : undefined);
      renderKeepingScroll();
    }).catch(function (error) { ytFail(key, error, comLegenda ? 'legenda' : 'limpo'); });
  }
  /* CAMADA B: um quadro, do renderizador de verdade. Sem barra de progresso e sem fila
     própria — o servidor já serializa render e still no mesmo `_render_slot`, e inventar
     uma segunda fila aqui só criaria dois donos para a mesma espera.
     Editor sem frase (2026-10-01): o desfecho mora no RÓTULO do botão — "Montando…",
     de volta a "Ver o quadro real" com a imagem, ou "Falhou · tentar de novo". */
  function ytStill(button, clipId) {
    var clip = findById(YT.candidates, clipId);
    if (!clip) { toast('O trecho saiu da lista.', 'error'); return; }
    var raiz = document.getElementById('video-ops-root');
    var vaga = raiz && raiz.querySelector('[data-leg-still-slot]');
    function diga(texto) { if (button) button.textContent = texto; }
    if (button) button.disabled = true;
    diga('Montando…');
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
        vaga.innerHTML = '<img class="vop-leg-still-img" alt="Quadro real do corte"'
          + ' src="' + esc(URL.createObjectURL(saida.blob)) + '">';
      }
      diga('Ver o quadro real');
    }).catch(function () {
      if (button) button.disabled = false;
      diga(ROTULO_FALHOU);
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
    if (LEG_DRAG) return;
    var legenda = event.target.closest('[data-leg-prev-text]');
    if (legenda) { legDragStart(event, legenda); return; }
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
    youtube: 'Cole o link de um vídeo do YouTube. O Estúdio baixa o original, encontra os melhores trechos e prepara cada corte — tudo salvo neste computador.',
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
    var tabs = [['youtube', 'Clips', YT.candidates.length || ''], ['projects', 'Meus projetos', projetosCount || ''], ['central', 'Central', LIB.clips.length || ''], ['resultados', 'Resultados', publicacoes || '']];
    /* Na tela Clips a dica é a frase de abertura da própria tela (ytStepHTML): repetida aqui,
       seriam duas explicações seguidas dizendo a mesma coisa. */
    return '<nav class="vop-flow" aria-label="Telas do estúdio">'
      + '<div class="vop-flow-steps">' + tabs.map(tabButtonHTML).join('') + '</div>'
      + '</nav>'
      + (TAB === 'youtube' ? '' : '<p class="vop-flow-hint">' + esc(FLOW_HINT[TAB] || '') + '</p>');
  }
  /* Cabeçalho de UMA linha (2026-09-25, reformulação visual pedida pelo usuário): nome da área
     e o dia da operação, sem cartão próprio. A contagem da Central já mora na aba dela. */
  function headerHTML() {
    var info = projectInfo();
    return '<header class="vop-head">'
      + '<h1>Estúdio de Vídeos</h1>'
      + '<p class="vop-head-day" title="' + info.remaining + ' dias restantes">Dia ' + info.day + ' de ' + DAYS + '</p>'
      + (BROKEN_RAW ? chip('publication-error', 'Recuperação necessária') : '')
      + '</header>';
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
    if (!Object.prototype.hasOwnProperty.call(FLOW_HINT, TAB)) TAB = 'youtube';
    srcPreviewSync();
    if (TAB === 'central') body = centralHTML();
    else if (TAB === 'projects') body = projectsHTML();
    else if (TAB === 'youtube') body = ytStepHTML();
    else if (TAB === 'resultados') body = resultadosHTML();
    root.innerHTML = headerHTML() + tabsHTML() + '<main class="vop-body">' + body + '</main>';
    /* O player da fonte volta VIVO para a tela nova, com a posição, o volume e o buffer
       intactos. Tem de ser aqui, na MESMA tarefa do innerHTML — ver srcAdopt. */
    srcAdopt(root);
    cutAdopt(root);
    /* Um corte aberto pede a geometria do jeito que está (sem mudança, nem sai pedido). */
    if (TAB === 'youtube') { legGeoPedir(legGeoClip()); legQuadroMapear(); legBarraPaint(); }
    /* A biblioteca de músicas é lida UMA vez, quando o primeiro corte abre. */
    if (TAB === 'youtube' && legGeoClip() && MUS.estado === 'nunca') musicaListar();
    bindIntake();
    refreshBadge();
  }
  function renderKeepingScroll() {
    var x = typeof window !== 'undefined' ? Number(window.scrollX) || 0 : 0;
    var y = typeof window !== 'undefined' ? Number(window.scrollY) || 0 : 0;
    /* O corpo do painel do editor também rola (2026-10-01): render() troca o nó, então a
       rolagem é guardada antes e devolvida ao nó novo (BP-013). */
    var raiz = typeof document !== 'undefined' && document.getElementById('video-ops-root');
    var corpo = raiz && raiz.querySelector && raiz.querySelector('[data-tool-body]');
    var corpoY = corpo ? Number(corpo.scrollTop) || 0 : 0;
    render();
    var novo = raiz && raiz.querySelector && raiz.querySelector('[data-tool-body]');
    if (novo && corpoY) novo.scrollTop = corpoY;
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
  /* Rótulo de um controle cuja ação falhou: o editor não diz o motivo (decisão do usuário,
     2026-10-01), só que falhou e que o mesmo clique tenta de novo. */
  var ROTULO_FALHOU = 'Falhou · tentar de novo';
  function toast(message, tone) {
    if (typeof document === 'undefined') return;
    /* Com o editor aberto, nada de toast: o estado mora no próprio controle. UMA guarda aqui
       em vez de dezenas de chamadas editadas; fora do editor tudo segue igual. */
    if (TAB === 'youtube' && YT.detail) return;
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
    else if (input.dataset.clipField === 'cardId') {
      /* O value vem do DOM, e DOM e ENTRADA. Vazio significa "Sem card" -- e o ENUM mudando,
         nao um card vazio. Qualquer outro valor so vale se o card EXISTIR na biblioteca:
         radio adulterado, extensao ou HTML velho em cache nao pode virar estado, e cair num
         card qualquer seria o pior desfecho possivel (o corte sairia com a identidade errada
         sem nada na tela errar).
         SEM re-render, como o titulo: o `:checked` do radio nativo ja mostra a escolha, e
         reescrever a lista tiraria o foco de quem chegou pelo teclado (BP-001). A frase de
         estado e atualizada no LUGAR, para nenhum ramo ficar mudo (BP-008).
         Persiste porque `YT.candidates` E `project.candidates` (mesmos objetos, atribuidos
         no `open-project`), entao a escolha volta com o projeto depois de recarregar a
         pagina. E um CLIQUE deliberado, nao uma tecla. */
      var escolhido = String(input.value || '');
      if (!escolhido) {
        clip.titleCardStyle = TITLE_CARD_SEM;
        clip.cardId = '';
      } else if (cardFind(escolhido)) {
        clip.titleCardStyle = TITLE_CARD_PADRAO;
        clip.cardId = escolhido;
      } else {
        return;
      }
      projectsPersist();
    } else if (input.dataset.clipField === 'legendaStyle') {
      /* Mesmo tratamento do titleCardStyle: validador (o DOM é entrada) e `projectsPersist`
         porque isto é um CLIQUE deliberado, não uma tecla. */
      /* O estilo novo aparece INTEIRO: o `legendaStyleWrite` limpa o que ele decide. */
      legendaStyleWrite(clip, input.value);
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
      /* O palco "Como sai 9:16", a máscara e as faixas da posição dependem do enquadramento:
         sem repintar, a prévia seguiria mostrando o recorte anterior. O render pede a
         geometria nova (`legGeoPedir`) e o `srcAdopt` preserva o player. */
      renderKeepingScroll();
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
       conversão marcar "Normal" gravaria `caixaAlta: true`. */
    if (chave === 'caixaAlta') valor = valor === 'true';
    else if (['tamanho', 'largura', 'posicaoPct', 'posicaoXPct'].indexOf(chave) >= 0) valor = num(valor);
    /* O centro É a posição lateral automática: gravá-lo seria um "ajuste" que não muda nada. */
    if (chave === 'posicaoXPct' && valor === 50) valor = null;
    if (!legendaGravar(clip, chave, valor)) return false;
    legendaRefresh(clip, gravar);
    return true;
  }
  /* Uma combinação de cores: troca as quatro de uma vez, e grava (é um clique). */
  function legendaComboPick(input) {
    var clip = findById(YT.candidates, input.dataset.id);
    if (!clip || !legendaComboWrite(clip, Number(input.value))) return false;
    legendaRefresh(clip, true);
    return true;
  }
  /* Atualiza a tela NO LUGAR, sem `render()`: re-renderizar destruiria o slider no meio do
     arrasto (parente do BP-001) e recriaria o `<video>` de 2 GB da fonte. Muda o marcador de
     cada linha, o que cada controle marca (uma combinação troca quatro cores de uma vez), a
     faixa de estado, o "Voltar ao padrão" e a prévia.
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
          saida.textContent = legSliderValor(clip, linha.dataset.legRow)
            + (['posicaoPct', 'posicaoXPct'].indexOf(linha.dataset.legRow) >= 0 ? '%' : 'px');
        }
      });
      /* Quem está com o foco (o slider sendo arrastado, o seletor de cor aberto) não é
         reescrito: o valor dele já é o que o operador está escolhendo. */
      var foco = typeof document !== 'undefined' ? document.activeElement : null;
      painel.querySelectorAll('input[data-leg-field]').forEach(function (campo) {
        if (campo === foco) return;
        var atual = legendaMostrado(clip, campo.dataset.legField);
        if (campo.type === 'radio') campo.checked = campo.value === atual;
        else if (campo.type === 'color') campo.value = (legendaHex(atual) || '#FFFFFF').toLowerCase();
        else if (campo.type === 'range') campo.value = legSliderValor(clip, campo.dataset.legField);
      });
      var combo = String(legendaComboAtivo(clip));
      painel.querySelectorAll('input[data-leg-combo]').forEach(function (campo) {
        campo.checked = campo.value === combo;
      });
      var ajustes = Object.keys(editOf(clip).legenda).length;
      var zerar = painel.querySelector('[data-act="leg-reset"]');
      if (zerar) zerar.disabled = !ajustes;
      /* O pad "Ângulo" segue a intensidade NO LUGAR: desabilitado e amostras. */
      var semProf = legAnguloSemProf(clip);
      painel.querySelectorAll('input[data-leg-field="profundidadeDirecao"]').forEach(function (campo) {
        campo.disabled = semProf;
      });
      painel.querySelectorAll('[data-leg-ang-aa]').forEach(function (aa) {
        var amostra = legAnguloAmostra(clip, aa.dataset.legAngAa);
        aa.style.transform = amostra.transform;
        aa.style.transformOrigin = amostra.origem;
      });
    }
    /* A prévia é substituída inteira: ela não tem estado próprio (nem foco, nem rolagem),
       então reescrevê-la é mais simples e mais barato que sincronizar dez atributos. */
    var velha = raiz.querySelector('[data-leg-prev]');
    if (velha && velha.parentNode) velha.outerHTML = legendaPreviewHTML(clip);
    if (gravar) {
      projectsPersist();
      /* Largura e posições mudam faixa e grampo: a geometria é pedida AO SOLTAR, nunca a
         cada movimento do slider. Sem mudança na intenção, o pedido nem sai. */
      legGeoPedir(clip);
    }
  }
  /* ARRASTAR a legenda na prévia muda as DUAS posições (vertical e lateral). São os
     MESMOS `posicaoPct`/`posicaoXPct` dos sliders, em % do QUADRO 9:16 (o retângulo medido
     é o do quadro, não o do palco 16:9): o arrasto escreve a intenção, e quem a vira pixel
     continua sendo o servidor. O ponto agarrado fica sob o cursor (`delta`/`deltaX`), os
     dois eixos são grampeados AO VIVO pelas faixas que o servidor mandou, e o `localStorage`
     só é tocado ao soltar (BP-001).
     Arrastar só na vertical NÃO cria posição lateral: perto do centro (`LEG_X_IMA`) o X
     gruda no meio e continua automático, com a guia do centro à vista enquanto gruda. */
  var LEG_DRAG = null;
  function legLimite(valor, faixa) { return Math.min(faixa[1], Math.max(faixa[0], valor)); }
  function legDragStart(event, alvo) {
    var prev = alvo.closest('[data-leg-prev]');
    var quadro = prev && prev.parentNode;
    var clip = legGeoClip();
    if (!clip || !quadro || !quadro.getBoundingClientRect) return false;
    var caixa = quadro.getBoundingClientRect();
    if (!caixa.height) return false;
    var atual = legendaValor(clip, 'posicaoPct');
    var doCorte = legGeoDoCorte(clip);
    /* Sem a geometria DESTE corte não há de onde partir: a legenda fica automática e a
       tela diz por quê, em vez de chutar um percentual (o 75 de antes saía do vídeo). */
    if (!atual.manual && !doCorte) {
      toast('Sem a geometria do corte, a posição continua automática'
        + (LEG_GEO.erro ? ': ' + LEG_GEO.erro : ' (ainda calculando)') + '.', 'error');
      return false;
    }
    var geo = legGeoDados();
    var pct = atual.manual ? atual.valor : doCorte.posicaoAutoPct;
    var lateral = legendaValor(clip, 'posicaoXPct');
    var px = lateral.manual ? lateral.valor : 50;
    LEG_DRAG = { clip: clip, alvo: alvo, prev: prev, topo: caixa.top, alto: caixa.height,
      esq: Number(caixa.left) || 0, largo: Number(caixa.width) || 0,
      delta: pct - (event.clientY - caixa.top) / caixa.height * 100,
      deltaX: px - (event.clientX - (Number(caixa.left) || 0)) / (Number(caixa.width) || 1) * 100,
      faixa: geo ? geo.faixaPosicao : [0, 100], faixaX: geo ? geo.faixaPosicaoX : null,
      eraAuto: !atual.manual, eraAutoX: !lateral.manual, moveu: false };
    prev.dataset.arrastando = '1';
    if (alvo.setPointerCapture) alvo.setPointerCapture(event.pointerId);
    alvo.addEventListener('pointermove', legDragMove);
    alvo.addEventListener('pointerup', legDragEnd);
    alvo.addEventListener('pointercancel', legDragEnd);
    if (event.preventDefault) event.preventDefault();
    return true;
  }
  function legDragMove(event) {
    var d = LEG_DRAG;
    if (!d) return;
    var pct = Math.round(legLimite((event.clientY - d.topo) / d.alto * 100 + d.delta, d.faixa));
    var bruto = d.largo ? (event.clientX - d.esq) / d.largo * 100 + d.deltaX : NaN;
    /* `null` = centralizada (automática). Só sai do centro quem passou do ímã, e só até
       onde a faixa do servidor deixa. */
    var x = null;
    if (d.faixaX && Math.abs(bruto - 50) > LEG_X_IMA) x = Math.round(legLimite(bruto, d.faixaX));
    if (x === 50) x = null;
    d.moveu = true;
    editFieldWrite(d.clip, 'legenda', 'posicaoPct', pct);
    editFieldWrite(d.clip, 'legenda', 'posicaoXPct', x);
    /* A coluna estreita perto da borda e os avisos das zonas são do SERVIDOR: pede a
       geometria durante o gesto (no máximo a cada 120 ms; pedido igual nem sai), e a
       resposta muda só a coluna e as zonas desta prévia (`legGeoAplicar`). */
    var agora = Date.now();
    if (!d.pedido || agora - d.pedido > 120) { d.pedido = agora; legGeoPedir(d.clip); }
    d.prev.style.setProperty('--leg-pos', pct + '%');
    if (x !== null) d.prev.style.setProperty('--leg-x', x + '%');
    d.prev.dataset.auto = '0';
    d.prev.dataset.autoX = x === null ? '1' : '0';
    d.prev.dataset.ima = x === null && d.faixaX ? '1' : '0';
    var raiz = document.getElementById('video-ops-root');
    [['posicaoPct', pct], ['posicaoXPct', x === null ? 50 : x]].forEach(function (par) {
      var campo = raiz && raiz.querySelector('input[data-leg-field="' + par[0] + '"]');
      if (campo) campo.value = par[1];
      var saida = raiz && raiz.querySelector('[data-leg-out="' + par[0] + '"]');
      if (saida) saida.textContent = par[1] + '%';
    });
  }
  function legDragEnd() {
    var d = LEG_DRAG;
    LEG_DRAG = null;
    if (!d) return;
    d.alvo.removeEventListener('pointermove', legDragMove);
    d.alvo.removeEventListener('pointerup', legDragEnd);
    d.alvo.removeEventListener('pointercancel', legDragEnd);
    delete d.prev.dataset.arrastando;
    d.prev.dataset.ima = '0';
    if (!d.moveu) return;
    projectsPersist();
    /* O grampo e a nota de cada linha vêm do servidor: pedidos AO SOLTAR. */
    legGeoPedir(d.clip);
    /* Automática -> manual troca a FORMA da linha (texto + botão vira slider), nas duas. */
    var xManual = editOf(d.clip).legenda.posicaoXPct !== undefined;
    if (d.eraAuto || (d.eraAutoX === xManual && !LEG_X_ABERTO[d.clip.id])) renderKeepingScroll();
    else legendaRefresh(d.clip, false);
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
      YT.authorized = (projectFindByVideoId(id) || {}).authorized === true;
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
    /* Capa do TikTok: o `change` GRAVA. Radio (estilo/posição) é clique deliberado e troca a
       forma da prévia → re-render; texto só repinta no lugar (o `input` já desenhou). */
    /* Música: faixa e nível são cliques deliberados (re-renderiza); o início grava ao sair do
       campo, pelo `parseClock` (texto que não é tempo NÃO vira 0 calado: volta ao que era). */
    if (event.target.matches('[data-mus-arquivo]')) { musicaImportar(event.target, event.target.dataset.id); return; }
    /* Texto fixo: conteúdo, posição e estilo gravam no `change` e re-renderizam (avisos e
       prévia mudam de forma). O rascunho do texto novo é só sessão. */
    if (event.target.matches('[data-txt-novo]')) { TXT_RASCUNHO[event.target.dataset.id] = String(event.target.value || ''); return; }
    if (event.target.matches('[data-zoom-field]')) {
      if (zoomCampoWrite(event.target.dataset.id, Number(event.target.dataset.i),
        event.target.dataset.zoomField, String(event.target.value || ''))) renderKeepingScroll();
      return;
    }
    if (event.target.matches('[data-txt-field]')) {
      if (textoCampoWrite(event.target.dataset.id, Number(event.target.dataset.i),
        event.target.dataset.txtField, String(event.target.value || ''))) renderKeepingScroll();
      return;
    }
    if (event.target.matches('[data-mus-field]')) {
      var clipMus = findById(YT.candidates, event.target.dataset.id);
      if (!clipMus) return;
      var campoMus = event.target.dataset.musField;
      if (campoMus === 'id') musicaWrite(clipMus, event.target.value ? { id: event.target.value } : null);
      else if (campoMus === 'nivel') musicaWrite(clipMus, { nivel: event.target.value });
      else if (campoMus === 'inicio') {
        var segundos = parseClock(event.target.value);
        /* Texto que não é tempo: o campo acende aria-invalid e nada é gravado. */
        if (segundos === '') { event.target.setAttribute('aria-invalid', 'true'); return; }
        musicaWrite(clipMus, { inicioMs: Math.round(segundos * 1000) });
      }
      projectsPersist();
      renderKeepingScroll();
      return;
    }
    if (event.target.matches('[data-capa-field]')) {
      if (!capaFieldWrite(event.target, true)) return;
      if (event.target.type === 'radio') renderKeepingScroll();
      else capaPaint(findById(YT.candidates, event.target.dataset.id));
      return;
    }
    if (event.target.matches('[data-leg-combo]')) { legendaComboPick(event.target); return; }
    if (event.target.matches('[data-src-modo]')) { legModoTroca(event.target.value); return; }
    /* Ferramenta e subaba: só o estado de módulo muda; o `:checked` + CSS já mostrou o painel. */
    if (event.target.matches('[data-yt-tool]')) { ytToolTroca(event.target.value); return; }
    if (event.target.matches('[data-leg-aba]')) {
      if (LEG_ABAS.some(function (a) { return a[0] === event.target.value; })) LEG_ABA = event.target.value;
      return;
    }
    if (event.target.matches('[data-card-field]')) { cardFieldFromDom(event.target, true); return; }
    if (event.target.matches('[data-card-logo]')) {
      cardLogoPick(event.target.dataset.id, event.target.files && event.target.files[0]);
      return;
    }
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
      projectAuthWrite(ytVideoId(YT.url), YT.authorized);
      /* Declarar RELIGA a fonte que já está no disco. É o caminho do projeto reaberto: a
         declaração vale por sessão, então ela não sobrevive ao recarregamento — mas o
         ARQUIVO sobrevive, e a rota de estado só o redescobre, sem baixar um byte. Marcar a
         caixa e ver o vídeo aparecer na hora é o desfecho certo; obrigar a "importar" de
         novo um arquivo que já está lá seria pedir ao operador um clique sem função. */
      if (YT.authorized && !srcReady() && SRC.state !== 'importing') {
        srcRestore(ytVideoId(YT.url));
      }
      renderKeepingScroll();
      autoCutsKick();
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
    if (event.target.matches('[data-src-busca]')) { legBuscaWrite(event.target); return; }
    if (event.target.matches('[data-cut-field]')) { cutFieldWrite(event.target); return; }
    if (event.target.matches('[data-clip-field]')) { clipFieldWrite(event.target); return; }
    /* O slider dispara `input` a cada pixel do arrasto: a prévia acompanha em tempo real,
       e o `change` (soltar) é quem GRAVA. Sem os dois, ou a prévia só aparece no fim do
       arrasto, ou o localStorage leva dezenas de escritas por ajuste. */
    if (event.target.matches('[data-leg-field]')) { legendaFieldWrite(event.target, false); return; }
    /* Manchete/destaque da capa: cada tecla desenha a prévia no lugar, sem re-render (BP-001)
       e sem tocar o localStorage — quem grava é o `change`. */
    /* O texto novo é digitado antes de marcar o fim: guarda a cada tecla, sem re-render. */
    if (event.target.matches('[data-txt-novo]')) { TXT_RASCUNHO[event.target.dataset.id] = String(event.target.value || ''); return; }
    if (event.target.matches('[data-capa-field]') && event.target.type !== 'radio') {
      if (capaFieldWrite(event.target, false)) capaPaint(findById(YT.candidates, event.target.dataset.id));
      return;
    }
    /* O campo de texto e o seletor de cor disparam `input` a cada tecla e a cada pixel do
       arrasto: a previa acompanha em tempo real, sem re-render (BP-001) e SEM gravar. Quem
       grava e o `change` -- gravar a cada letra reescreveria a biblioteca inteira (com os
       dataURLs dos logos dentro) dezenas de vezes por palavra. */
    if (event.target.matches('[data-card-field]')) { cardFieldFromDom(event.target, false); return; }
    /* Horário grava no `change`: validar a cada tecla recusaria o "1" de quem digita "12". */
    if (event.target.matches('[data-cap-field]')) {
      if (!event.target.dataset.capTime) capCueWrite(event.target);
      return;
    }
    if (event.target.matches('[data-yt-url]')) ytUrlWrite(event.target);
  }
  /* Clicar numa frase a escolhe para "Ouvir" e, com o vídeo PARADO, leva o player até ela —
     assim o quadro e a prévia mostram a frase que se está corrigindo. Tocando, não mexe:
     arrancar o vídeo de onde o operador está assistindo seria pior que não ajudar. */
  function onRootFocus(event) {
    var el = event.target;
    if (!el || !el.matches || !el.matches('[data-cap-field]') || el.dataset.capTime) return;
    CAP_FOCO = { id: el.dataset.id, i: num(el.dataset.capIndex) };
    var clip = capTarget(el.dataset.id);
    var entry = capOf(clip);
    var cue = entry && entry.cues[CAP_FOCO.i];
    var v = srcVideo();
    if (cue && v && v.paused) srcSeek(num(clip.inSec) + cue.start, false);
  }
  /* Enter numa frase termina a correção em vez de quebrar a linha: a quebra entraria no
     texto da legenda e não é algo que o operador quis dizer. */
  function onRootKey(event) {
    var el = event.target;
    /* Espaço toca/pausa com o foco no quadro ou na barra do 9:16 (botão e busca incluídos:
       o botão ativaria sozinho e tocaria duas vezes, por isso o `preventDefault`). */
    if ((event.key === ' ' || event.key === 'Spacebar') && el && el.matches
      && el.matches('[data-src-stage], [data-src-barra], [data-src-barra] *')) {
      event.preventDefault();
      legPlayToggle();
      return;
    }
    if (event.key !== 'Enter' || !el || !el.isContentEditable || !el.matches('[data-cap-field]')) return;
    event.preventDefault();
    if (el.blur) el.blur();
  }
  /* A frase que está tocando acende no texto, e a prévia sobre o vídeo mostra ESSA frase,
     corrigida. `timeupdate` não borbulha: o ouvinte é de CAPTURA na raiz, e é por isso que
     ele sobrevive ao `srcAdopt` sem religar nada. */
  var CAP_TOCANDO = -1;
  function capTick(event) {
    var v = event.target;
    if (!v || !v.matches || !v.matches('[data-src-video]')) return;
    var offset = Number(v.getAttribute('data-src-offset')) || 0;
    var t = (Number(v.currentTime) || 0) + offset;
    if (CAP_STOP && t >= CAP_STOP) { CAP_STOP = 0; if (v.pause) v.pause(); }
    legBarraPaint();
    /* A prévia troca pela PÁGINA do export, comparando com a que ela mostra agora — e não
       pelo `CAP_TOCANDO`: um re-render recria a prévia na 1ª página enquanto o índice da
       frase continua o mesmo, e a prévia ficava presa nela até a frase mudar. */
    var prev = document.querySelector('[data-leg-prev-text]');
    var pagina = prev ? legPaginaEm(legGeoClip()) : null;
    if (prev && pagina !== null && prev.getAttribute('data-pagina') !== pagina) {
      var acesa = prev.querySelector('[data-leg-prev-ativa]');
      prev.innerHTML = legPrevFalaHTML(pagina, acesa ? acesa.style.color : '',
        !!prev.querySelector('.vop-leg-prev-caixa'));
      prev.setAttribute('data-pagina', pagina);
    }
    var panel = document.querySelector('[data-cap-panel]');
    var entry = panel && CAPS[panel.dataset.id];
    if (!entry) return;
    var idx = capIndexAt(entry.cues, t - num(panel.dataset.in));
    if (idx === CAP_TOCANDO && panel.querySelector('[data-tocando]')) return;
    CAP_TOCANDO = idx;
    var velha = panel.querySelector('[data-tocando]');
    if (velha) velha.removeAttribute('data-tocando');
    if (idx < 0) return;
    var nova = panel.querySelector('.vop-cap-frase[data-cap-index="' + idx + '"]');
    if (nova) nova.setAttribute('data-tocando', '1');
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
    /* Abrir/fechar uma seção recolhida da legenda: guarda o estado para o próximo render.
       O clique chega ANTES do navegador alternar o `open`, então o novo estado é o oposto. */
    var resumo = event.target.closest && event.target.closest('[data-leg-mais]');
    if (resumo) {
      LEG_MAIS[resumo.dataset.legMais] = !(resumo.parentNode && resumo.parentNode.open);
      return;
    }
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
      /* Pergunta ao worker na PRIMEIRA vez que a Central abre, não na partida do site:
         quem nunca vai publicar não paga uma chamada por visita. */
      if (TAB === 'central' && !TT.checked) ttRefresh(true);
    }
    /* --- a biblioteca de cards. Todo ramo repinta com `renderKeepingScroll` (BP-013): o
       painel muda de tamanho, e o `srcAdopt` preserva o `<video>` da fonte. */
    else if (action === 'cards-open') {
      CARDS_OPEN = true;
      CARD_MSG = ''; CARD_FALHA = false;
      if (!cardFind(CARD_EDIT)) CARD_EDIT = (cardsList()[0] || {}).id || '';
      renderKeepingScroll();
    }
    else if (action === 'cards-close') {
      CARDS_OPEN = false; CARD_DEL = ''; CARD_MSG = ''; CARD_FALHA = false;
      renderKeepingScroll();
    }
    else if (action === 'card-new') {
      var novoCard = cardCreate();
      if (novoCard) { CARDS_OPEN = true; CARD_EDIT = novoCard.id; CARD_DEL = ''; }
      CARD_MSG = novoCard ? '' : 'Não consegui criar o card agora.';
      CARD_FALHA = !novoCard;
      renderKeepingScroll();
    }
    else if (action === 'card-edit') {
      CARD_EDIT = button.dataset.id; CARD_DEL = ''; CARD_MSG = ''; CARD_FALHA = false;
      renderKeepingScroll();
    }
    else if (action === 'card-dup') {
      var copia = cardDuplicate(button.dataset.id);
      if (copia) { CARD_EDIT = copia.id; CARD_DEL = ''; }
      CARD_MSG = copia ? '' : 'Este card não está mais na biblioteca.';
      renderKeepingScroll();
    }
    /* Confirmacao INLINE, nunca `confirm()`: o dialogo nativo trava a aba, rouba o foco e
       nao tem como dizer o que a exclusao custa. */
    else if (action === 'card-del') { CARD_DEL = button.dataset.id; renderKeepingScroll(); }
    else if (action === 'card-del-no') { CARD_DEL = ''; renderKeepingScroll(); }
    else if (action === 'card-del-yes') {
      var idApagar = button.dataset.id;
      var apagou = cardRemove(idApagar);
      CARD_DEL = '';
      if (apagou && CARD_EDIT === idApagar) CARD_EDIT = (cardsList()[0] || {}).id || '';
      /* O que a exclusao custa e dito DEPOIS tambem: os cortes que apontavam para ele NAO
         sao reescritos (trocar a identidade de video antigo sem ninguem pedir seria pior),
         entao eles ficam orfaos e cada um anuncia isso no proprio painel. */
      CARD_MSG = apagou
        ? 'Card apagado. Os cortes que apontavam para ele saem sem card até você escolher outro.'
        : 'Este card já não estava na biblioteca.';
      renderKeepingScroll();
    }
    else if (action === 'card-logo-clear') {
      var semLogo = cardLogoWrite(button.dataset.id, '', 0);
      CARD_FALHA = !!semLogo;
      CARD_MSG = semLogo || 'Logo removido.';
      renderKeepingScroll();
    }
    else if (action === 'card-auto') {
      CARD_MSG = cardFieldWrite(button.dataset.id, button.dataset.key, null);
      CARD_FALHA = !!CARD_MSG;
      renderKeepingScroll();
    }
    else if (action === 'open-project') {
      var projectId = button.dataset.projectId;
      if (projectId) openProject(projectId);
      return;
    }
    else if (action === 'yt-import') srcImport(button);
    else if (action === 'yt-probe') ytProbe(button);
    else if (action === 'yt-cuts-retry') { AUTO_CUT_FAIL = {}; autoPaint(''); autoCutsKick(); renderKeepingScroll(); }
    else if (action === 'yt-manual') ytManualClip();
    else if (action === 'yt-fetch') ytFetchClip(button, button.dataset.id);
    else if (action === 'yt-render') {
      var renderId = button.dataset.id;
      ytRenderClip(button, renderId, 'legenda');
      /* O clique que COMEÇOU o render libera "Criar capa" e leva até ela (fluxo 2026-10-05).
         Recusado antes de começar (sem fonte, portão), o editor fica onde está. */
      if (YT_BUSY['render:' + renderId]) {
        YT_CAPA_LIBERADA[renderId] = true;
        if (YT.detail === renderId) { YT_ETAPA[renderId] = 'capa'; YT.dlMenu = ''; render(); }
      }
    }
    else if (action === 'yt-etapa') {
      var etapaClip = findById(YT.candidates, button.dataset.id);
      if (!etapaClip || !YT_ETAPAS.some(function (e) { return e[0] === button.dataset.etapa; })) return;
      if (button.dataset.etapa === 'capa' && !ytCapaLiberada(etapaClip)) return;
      YT_ETAPA[etapaClip.id] = button.dataset.etapa;
      YT.dlMenu = '';
      render();
    }
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
    else if (action === 'src-play') legPlayToggle();
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
    else if (action === 'src-preview-retry') { srcPreviewDrop(); renderKeepingScroll(); }
    else if (action === 'leg-still') { ytStill(button, button.dataset.id); }
    else if (action === 'capa-quadro') { capaUsarQuadro(button.dataset.id); }
    else if (action === 'capa-gerar') { capaGerar(button.dataset.id); }
    else if (action === 'rem-inicio') { remocaoMarcar(button.dataset.id, 'inicio'); }
    else if (action === 'rem-fim') { remocaoMarcar(button.dataset.id, 'fim'); }
    else if (action === 'rem-desfazer') { remocaoDesfazer(button.dataset.id, Number(button.dataset.i)); }
    else if (action === 'zoom-inicio') { zoomMarcar(button.dataset.id, 'inicio'); }
    else if (action === 'zoom-fim') { zoomMarcar(button.dataset.id, 'fim'); }
    else if (action === 'zoom-remover') {
      if (zoomCampoWrite(button.dataset.id, Number(button.dataset.i), 'remover')) renderKeepingScroll();
    }
    else if (action === 'txt-inicio') { textoMarcar(button.dataset.id, 'inicio'); }
    else if (action === 'txt-fim') { textoMarcar(button.dataset.id, 'fim'); }
    else if (action === 'txt-remover') {
      if (textoCampoWrite(button.dataset.id, Number(button.dataset.i), 'remover')) renderKeepingScroll();
    }
    else if (action === 'leg-reset') {
      var zerar = findById(YT.candidates, button.dataset.id);
      if (!zerar || !legendaReset(zerar)) return;
      projectsPersist();
      renderKeepingScroll();
    }
    else if (action === 'leg-auto' || action === 'leg-posicao' || action === 'leg-posicao-x') {
      var alvoLeg = findById(YT.candidates, button.dataset.id);
      if (!alvoLeg) return;
      if (action === 'leg-auto') {
        if (button.dataset.key === 'posicaoXPct') delete LEG_X_ABERTO[alvoLeg.id];
        legendaAuto(alvoLeg, button.dataset.key);
      } else if (action === 'leg-posicao-x') {
        /* Abre o slider NO CENTRO sem gravar nada: o centro é o automático. */
        LEG_X_ABERTO[alvoLeg.id] = true;
        renderKeepingScroll();
      } else {
        /* Parte da âncora automática REAL deste corte (Python), nunca de um número
           redondo: passar para o manual não pode mover a legenda. */
        var geoLeg = legGeoDoCorte(alvoLeg);
        if (!geoLeg) {
          toast('Sem a geometria do corte, a posição continua automática'
            + (LEG_GEO.erro ? ': ' + LEG_GEO.erro : ' (ainda calculando)') + '.', 'error');
          return;
        }
        editFieldWrite(alvoLeg, 'legenda', 'posicaoPct', geoLeg.posicaoAutoPct);
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
    else if (action === 'tt-connect') ttConnect();
    else if (action === 'tt-logout') ttDisconnect();
    else if (action === 'tt-publish') ttPublish(button, button.dataset.id);
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
    else if (action === 'cap-restore') {
      if (capRestore(capTarget(button.dataset.id))) {
        renderKeepingScroll();
        toast('Texto do YouTube restaurado neste trecho. "Desfazer" traz a correção de volta.');
      }
    }
    else if (action === 'cap-undo') {
      if (capUndo(button.dataset.id)) { renderKeepingScroll(); toast('Correção desfeita.'); }
    }
    /* Ouvir: toca a frase em que o operador clicou por último (ou a 1ª) e PARA no fim dela
       (`capTick`) — ouvir para conferir uma palavra não pode virar assistir o corte inteiro. */
    else if (action === 'cap-play') {
      var ouvir = capTarget(button.dataset.id);
      var ouvirCap = capOf(ouvir);
      var qual = CAP_FOCO.id === button.dataset.id ? CAP_FOCO.i : 0;
      var fraseOuvir = ouvirCap && ouvirCap.cues[qual];
      if (!fraseOuvir) return;
      CAP_STOP = num(ouvir.inSec) + fraseOuvir.end;
      if (!srcSeek(num(ouvir.inSec) + fraseOuvir.start, true)) {
        CAP_STOP = 0;
        toast('Importe o vídeo para ouvir a frase — o texto dá para corrigir mesmo assim.', 'error');
      }
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
  function lastProject() {
    var prontos = (PROJECTS && PROJECTS.projects || []).filter(function (p) {
      return p.status === PROJECT_STATUS.ready && (p.candidates || []).length;
    });
    prontos.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    return prontos[0] || null;
  }
  function init() {
    var root = document.getElementById('video-ops-root');
    if (!root) return;
    LIB = libLoad();
    PROJECTS = projectsLoad();
    CARDS = cardsLoad();
    root.addEventListener('click', onRootClick);
    /* As bolinhas da barra seguem o modelo depois de TODA mudança, inclusive as que não
       re-renderizam (um ouvinte por tipo: a bancada de teste guarda só o último). */
    root.addEventListener('change', function (e) { onRootChange(e); ytToolDotsPaint(); });
    root.addEventListener('input', function (e) { onRootInput(e); ytToolDotsPaint(); });
    root.addEventListener('pointerdown', onRootPointerDown);
    root.addEventListener('focusin', onRootFocus);
    root.addEventListener('keydown', onRootKey);
    root.addEventListener('timeupdate', capTick, true);
    /* A barra do 9:16 e o quadro mapeado do 16:9 acompanham o player sem re-render (os
       eventos de mídia não borbulham: captura na raiz, como o `capTick`). */
    ['play', 'pause', 'ended', 'seeked'].forEach(function (tipo) {
      root.addEventListener(tipo, function (e) {
        if (e.target && e.target.matches && e.target.matches('[data-src-video]')) { legBarraPaint(); musicaSync(); }
      }, true);
    });
    /* A prévia da música segue o player: tempo (corrige deriva > 0,25 s) e velocidade. */
    ['timeupdate', 'ratechange'].forEach(function (tipo) {
      root.addEventListener(tipo, function (e) {
        if (e.target && e.target.matches && e.target.matches('[data-src-video]')) {
          remocaoPulo(); musicaSync(); textosTick(); zoomTick();
        }
      }, true);
    });
    root.addEventListener('loadedmetadata', function (e) {
      if (e.target && e.target.matches && e.target.matches('[data-src-video]')) { legQuadroMapear(); legBarraPaint(); }
    }, true);
    /* Esc fecha a prévia e o menu de baixar. No DOCUMENTO e não na raiz: o foco pode estar
       dentro do iframe do YouTube, e aí a tecla nunca chegaria a um ouvinte da raiz.
       Diálogo sem Esc é armadilha de teclado — sair dele exigiria achar o botão. */
    if (document.addEventListener) document.addEventListener('keydown', onEscape);
    /* O vídeo do primeiro contato é da sessão: a URL temporária morre ao sair da página. */
    if (window.addEventListener) window.addEventListener('pagehide', intakeRelease);
    /* Recarregar volta ao último vídeo trabalhado: original, cortes e ordem continuam na
       tela (pedido: "disponíveis após atualizar a página ou sair e voltar"). */
    var ultimo = lastProject();
    if (ultimo) openProject(ultimo.id); else render();
    window.videoOpsRefresh = render;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      libEntry: libEntry,
      libSanitize: libSanitize,
      libGroups: libGroups,
      libCardHTML: libCardHTML,
      savedClipUrl: savedClipUrl,
      ttStripHTML: ttStripHTML,
      ttState: ttState,
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
      /* `openProject` CARREGA dado persistido (o projeto salvo) para dentro da sessão, então
         BP-014 manda que ela seja exportada e chamada pelo teste nos DOIS ramos — mesmo
         vídeo e vídeo diferente. O ramo que quebra calado é o de quem já tinha o projeto
         salvo, e ele é justamente o que um teste de perfil limpo nunca alcança. */
      openProject: openProject,
      /* `null` devolve o módulo ao estado de antes do `init` — é o que o teste usa para
         não deixar `PROJECTS` carregado para os casos seguintes, que contam com a guarda
         `if (!PROJECTS) return false` do `projectsPersist`. */
      __setProjects: function (lista) {
        PROJECTS = lista ? { version: PROJECTS_VERSION, projects: lista } : null;
        return PROJECTS;
      },
      clipStatusOf: clipStatusOf,
      /* A fonte importada. `srcApply` é a fronteira de ENTRADA da importação e a dona das
         guardas de corrida — BP-014 manda que ela seja exportada e chamada pelo teste com o
         payload construído, nos DOIS ramos (resposta do vídeo pedido × resposta de outro
         vídeo), porque o ramo que quebra é justamente o de quem trocou a URL no meio. */
      srcApply: srcApply,
      srcReady: srcReady,
      ytRank: ytRank,
      ytStepsHTML: ytStepsHTML,
      lastProject: lastProject,
      projectAuthWrite: projectAuthWrite,
      autoCutsKick: autoCutsKick,
      __autoCutFail: function () { return AUTO_CUT_FAIL; },
      __autoCutsQueue: autoCutsQueue,
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
      capState: capState,
      capIndexAt: capIndexAt,
      capParagrafos: capParagrafos,
      capSaveText: capSaveText,
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
      TITLE_CARD_SEM: TITLE_CARD_SEM,
      TITLE_CARD_LABELS: TITLE_CARD_LABELS,
      /* A BIBLIOTECA. Exportada porque ela e dado PERSISTIDO: o BP-014 manda que o teste
         CHAME o validador e o saneador com o dado construido, nos DOIS ramos -- com a chave
         e sem ela --, e o ramo que quebra calado e justamente o de quem ja tinha biblioteca
         antes da mudanca. */
      cardOf: cardOf,
      corDoCard: corDoCard,
      pesoDoCard: pesoDoCard,
      corHex: corHex,
      svgViewBoxRatio: svgViewBoxRatio,
      cardsSanitize: cardsSanitize,
      cardsList: cardsList,
      cardFind: cardFind,
      cardCreate: cardCreate,
      cardDuplicate: cardDuplicate,
      cardRemove: cardRemove,
      cardFieldWrite: cardFieldWrite,
      cardLogoWrite: cardLogoWrite,
      cardIdOf: cardIdOf,
      cardDoClip: cardDoClip,
      cardPickState: cardPickState,
      cardValor: cardValor,
      cardRotulo: cardRotulo,
      cardStyleFieldHTML: cardStyleFieldHTML,
      cardPreviewHTML: cardPreviewHTML,
      cardsPanelHTML: cardsPanelHTML,
      candidateSanitize: candidateSanitize,
      CARD_PESOS: CARD_PESOS,
      CARD_LOGO_MAX: CARD_LOGO_MAX,
      CARD_PADROES: CARD_PADROES,
      CARD_NOME_MAX: CARD_NOME_MAX,
      CARD_IDENTIFICADOR_MAX: CARD_IDENTIFICADOR_MAX,
      CARDS_KEY: CARDS_KEY,
      /* Portas de teste (prefixo `__`): a biblioteca e estado de SESSAO como o `YT`, e nao
         tem outro jeito de ser alcancada de fora. `null` devolve o modulo ao estado de antes
         do `init`, que e o que a guarda `if (!CARDS)` do `cardsPersist` espera. */
      __setCards: function (lista) {
        CARDS = lista ? { v: CARDS_VERSION, cards: lista } : null;
        return CARDS;
      },
      __cardsPanel: function (aberto, edit) {
        CARDS_OPEN = !!aberto;
        if (edit !== undefined) CARD_EDIT = edit;
        return { aberto: CARDS_OPEN, edit: CARD_EDIT, del: CARD_DEL, msg: CARD_MSG };
      },
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
      LEGENDA_PROFUNDIDADES: LEGENDA_PROFUNDIDADES,
      legProfundidadeSombra: legProfundidadeSombra,
      LEGENDA_PROFUNDIDADE_DIRECOES: LEGENDA_PROFUNDIDADE_DIRECOES,
      LEGENDA_PROFUNDIDADE_DIAGONAL: LEGENDA_PROFUNDIDADE_DIAGONAL,
      legProfundidadeTransform: legProfundidadeTransform,
      CAPA_ESTILOS: CAPA_ESTILOS, CAPA_POSICOES: CAPA_POSICOES, CAPA_ZONAS: CAPA_ZONAS,
      CAPA_FONTES: CAPA_FONTES, CAPA_LARGURA: CAPA_LARGURA, CAPA_MAX_LINHAS: CAPA_MAX_LINHAS,
      CAPA_AVANCO: CAPA_AVANCO, CAPA_TITULO_MAX: CAPA_TITULO_MAX, CAPA_DESTAQUE_MAX: CAPA_DESTAQUE_MAX,
      CAPA_MSG: CAPA_MSG, capaTikTokOf: capaTikTokOf, capaTituloTela: capaTituloTela,
      capaCorpo: capaCorpo, capaChave: capaChave,
      capaPanelHTML: capaPanelHTML, capaTextoHTML: capaTextoHTML,
      MUSICA_NIVEIS: MUSICA_NIVEIS, MUSICA_DB: MUSICA_DB, MUSICA_MSG: MUSICA_MSG,
      MUSICA_IMPORT_MSG: MUSICA_IMPORT_MSG, MUSICA_VOZ_PREVIA: MUSICA_VOZ_PREVIA,
      musicaOf: musicaOf, musicaWrite: musicaWrite, musicaEstado: musicaEstado,
      musicaAviso: musicaAviso, musicaPreviaVolume: musicaPreviaVolume, MUS: MUS,
      REMOCAO_MIN_MS: REMOCAO_MIN_MS, PEDACO_MIN_MS: PEDACO_MIN_MS, REMOCOES_MAX: REMOCOES_MAX,
      remocoesOf: remocoesOf, remocaoConfere: remocaoConfere, remocoesWrite: remocoesWrite,
      clipEditadoInvalido: clipEditadoInvalido, legGeoCorpo: legGeoCorpo, capaForaDoCorte: capaForaDoCorte,
      TEXTOS_MAX: TEXTOS_MAX, TEXTO_MAX_CHARS: TEXTO_MAX_CHARS, TEXTO_MIN_MS: TEXTO_MIN_MS,
      TEXTO_POSICOES: TEXTO_POSICOES, TEXTO_ESTILOS: TEXTO_ESTILOS, TEXTO_GEOMETRIA: TEXTO_GEOMETRIA,
      textosOf: textosOf, textoConfere: textoConfere, textoAvisos: textoAvisos, textosWrite: textosWrite,
      textosPrevHTML: textosPrevHTML,
      ZOOMS_MAX: ZOOMS_MAX, ZOOM_MIN_MS: ZOOM_MIN_MS, ZOOM_NIVEIS: ZOOM_NIVEIS, ZOOM_ESCALAS: ZOOM_ESCALAS,
      zoomsOf: zoomsOf, zoomConfere: zoomConfere, zoomsWrite: zoomsWrite,
      LEGENDA_COR_HEX: LEGENDA_COR_HEX,
      ASS_NAO_REPRODUZ: ASS_NAO_REPRODUZ,
      LEGENDA_FONTES: LEGENDA_FONTES,
      LEGENDA_CORES: LEGENDA_CORES,
      LEGENDA_ALINHAMENTOS: LEGENDA_ALINHAMENTOS,
      LEGENDA_STYLES: LEGENDA_STYLES,
      LEGENDA_PADRAO: LEGENDA_PADRAO,
      LEGENDA_LABELS: LEGENDA_LABELS,
      LEGENDA_COMBOS: LEGENDA_COMBOS,
      LEGENDA_TINTAS: LEGENDA_TINTAS,
      LEGENDA_LEQUE: LEGENDA_LEQUE,
      legendaGravar: legendaGravar,
      legendaComboWrite: legendaComboWrite,
      legendaComboAtivo: legendaComboAtivo,
      legendaStyleWrite: legendaStyleWrite,
      legendaReset: legendaReset,
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
