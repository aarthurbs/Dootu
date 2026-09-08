/* Fluxos — construtor de mapas de processo estilo n8n (documentar, NÃO executar).
   Vanilla JS, dados em localStorage (pp_fluxos_v1). Sem dependências.
   Geometria das conexões vem do MODELO (node.x/y + offsets fixos), não do getBoundingClientRect —
   por isso desenha certo mesmo com a aba escondida e durante o arraste. */
(function () {
  'use strict';

  var KEY = 'pp_fluxos_v1';
  var NODE_W = 240;   // largura fixa do nó — usada na geometria das portas
  var PORT_Y = 20;    // y (do topo do nó) do centro das portas — casa com CSS .fx-port top:14px + raio 6
  var PORT_Y_F = 46;  // y da 2ª saída (FALSO) da Decisão — casa com CSS .fx-port-false top:40px + raio 6
  var CANVAS_W = 2600, CANVAS_H = 1700;      // casa com CSS .fx-canvas/.fx-sizer (mantê-los em sincronia)
  var ZOOM_MIN = 0.4, ZOOM_MAX = 2;
  var MINI_W = 176;   // largura do minimapa (px); altura = CANVAS_H * MINI_W / CANVAS_W
  var SKILLS_TEMPLATE = 'skills-project-path-v1';

  var TYPES = {
    inicio:   { label: 'Início',   color: '#81c995' },
    processo: { label: 'Processo', color: '#6ea8fe' },
    decisao:  { label: 'Decisão',  color: '#fdd663' },
    codigo:   { label: 'Código',   color: '#c9a3ff' }
  };
  var LANGS = ['Texto', 'JavaScript', 'Python', 'PowerShell', 'Bash', 'SQL', 'HTML', 'JSON'];
  // Linguagem detectada pelo NOME do card (extensão), como no VS Code. Cai em 'Texto' se não reconhecer.
  var EXT_LANG = { py: 'Python', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', ts: 'JavaScript', jsx: 'JavaScript', tsx: 'JavaScript', ps1: 'PowerShell', psm1: 'PowerShell', sh: 'Bash', bash: 'Bash', zsh: 'Bash', sql: 'SQL', html: 'HTML', htm: 'HTML', json: 'JSON' };
  function langFromTitle(title) {
    var m = /\.([A-Za-z0-9]+)\s*$/.exec(String(title == null ? '' : title).trim());
    return (m && EXT_LANG[m[1].toLowerCase()]) || 'Texto';
  }
  // O que inserir ao apertar Enter no editor: quebra + recuo da linha atual; após ':' recua um nível a mais (Python não quebra).
  function autoIndent(lineUpToCursor) {
    var indent = (/^[ \t]*/.exec(lineUpToCursor) || [''])[0];
    return '\n' + indent + (/:\s*$/.test(lineUpToCursor) ? '    ' : '');
  }

  function uid(p) { return (p || 'n') + Math.random().toString(36).slice(2, 8); }

  // ── Modelo (funções puras — testáveis em node) ─────────────────────────────
  function seedBoard() {
    var b = { id: uid('b'), name: 'Scanner de portas (exemplo)', nodes: [], edges: [] };
    var n1 = { id: uid(), type: 'inicio',   title: 'Início',                 body: 'Rodar scanner.py\nTarget = input do usuário', x: 60,  y: 90 };
    var n2 = { id: uid(), type: 'processo', title: 'Ler portas.txt',         body: 'Abre o arquivo e monta a lista de portas (int).', x: 360, y: 60 };
    var n3 = { id: uid(), type: 'codigo',   title: 'identify_service(port)',  body: 'if port == 22:   return "SSH"\nelif port == 80:  return "HTTP"\nelif port == 443: return "HTTPS"\nelif port == 3306:return "MySQL"\nelse: return "Desconhecido"', x: 360, y: 210 };
    var n4 = { id: uid(), type: 'decisao',  title: 'test_port aberto?',       body: 'connect_ex((target,port)) == 0 ?\nABERTO : FECHADO', x: 700, y: 130 };
    var n5 = { id: uid(), type: 'processo', title: 'print resultado',         body: 'Alvo / Port / Serviço / Status', x: 1000, y: 130 };
    b.nodes = [n1, n2, n3, n4, n5];
    b.edges = [{ from: n1.id, to: n2.id }, { from: n2.id, to: n3.id }, { from: n3.id, to: n4.id }, { from: n4.id, to: n5.id }];
    var act = { id: uid('a'), name: 'Atividade 1 — identificar serviço' };   // demonstra Atividades no quadro-exemplo
    n3.activity = act.id;
    b.activities = [act];
    b.notes = [{ id: uid('s'), x: 40, y: 16, w: 320, h: 84, text: 'Dica: notas documentam e enquadram grupos. Arraste o cabeçalho p/ mover; redimensione pelo canto ↘.', color: '#fdd663' }];
    return b;
  }

  function skillsBoard() {
    var b = { id: uid('b'), name: 'Como usar as Skills — Atividades e Projetos', template: SKILLS_TEMPLATE, templateVersion: 2, nodes: [], edges: [], notes: [] };
    function node(type, title, body, x, y, color) {
      var n = { id: uid(), type: type, title: title, body: body, x: x, y: y };
      if (color) n.color = color;
      b.nodes.push(n);
      return n;
    }
    function edge(from, to, branch) {
      var e = { from: from.id, to: to.id };
      if (branch === true || branch === false) e.branch = branch;
      b.edges.push(e);
    }

    var start = node('inicio', 'Nova atividade ou projeto', 'Comece pelo resultado desejado, não pela ferramenta.', 40, 340);
    var outcome = node('processo', '1. Defina o resultado', 'Escreva em uma frase: o que precisa ficar pronto e como você saberá que funcionou?', 310, 340);
    var kind = node('decisao', 'É um projeto com várias etapas?', 'SIM: caminho de projeto.\nNÃO: caminho de atividade curta.', 580, 340);

    var activityResearch = node('decisao', 'Precisa pesquisar fora?', 'Notícias, imagens, vídeos, concorrentes, fontes ou documentação atual?', 850, 90);
    var activityReach = node('processo', 'Agent Reach', 'Pesquise e valide as fontes. Para imagens, prefira material oficial e com uso permitido.', 1120, 0, '#f2b66d');
    var activityVisual = node('decisao', 'É uma atividade de interface?', 'Tela, componente, identidade visual, apresentação ou protótipo?', 1390, 90);
    var activityDesign = node('processo', 'Open Design', 'Aplique o DESIGN.md, escolha referências e mantenha cores, tipografia, espaçamento e componentes consistentes.', 1660, 0, '#c9a3ff');
    var activityDone = node('processo', 'Execute e valide', 'Faça a menor entrega que resolve. Se a atividade crescer ou ficar ambígua, siga o caminho de projeto.', 1930, 90, '#81c995');

    var projectReach = node('processo', '2. Agent Reach — se precisar', 'Use para pesquisa externa, mercado, referências, imagens, vídeos e fontes atuais. Pule se o contexto já estiver completo.', 850, 540, '#f2b66d');
    var projectDesign = node('processo', '3. Open Design — se houver UI', 'Crie ou consulte o DESIGN.md antes das telas. Pule em projetos sem parte visual.', 1120, 540, '#c9a3ff');
    var projectSuper = node('processo', '4. Superpowers', 'Brainstorming → direção aprovada → plano → testes → implementação → revisão.', 1390, 540, '#6ea8fe');
    var projectComplex = node('decisao', 'Precisa de coordenação avançada?', 'Vários agentes, segurança, arquitetura, memória, revisão independente ou alto risco?', 1660, 540);
    var projectEcc = node('processo', '5. ECC', 'Coordene agentes especializados, testes, segurança, revisão, verificação e aprendizados reutilizáveis.', 1930, 420, '#81c995');
    var projectFocused = node('processo', 'Continue com Superpowers', 'Execute o plano e revise. Não adicione ECC quando o fluxo simples já for suficiente.', 1930, 700, '#6ea8fe');

    edge(start, outcome);
    edge(outcome, kind);
    edge(kind, projectReach, true);
    edge(kind, activityResearch, false);
    edge(activityResearch, activityReach, true);
    edge(activityResearch, activityVisual, false);
    edge(activityReach, activityVisual);
    edge(activityVisual, activityDesign, true);
    edge(activityVisual, activityDone, false);
    edge(activityDesign, activityDone);
    edge(projectReach, projectDesign);
    edge(projectDesign, projectSuper);
    edge(projectSuper, projectComplex);
    edge(projectComplex, projectEcc, true);
    edge(projectComplex, projectFocused, false);

    b.notes = [
      { id: uid('s'), x: 820, y: 0, w: 1390, h: 290, text: 'ATIVIDADE NOVA\nUse apenas a skill necessária. Pesquisa externa → Agent Reach. Interface ou visual → Open Design. Tarefa pequena → execução direta.', color: '#f2b66d' },
      { id: uid('s'), x: 820, y: 470, w: 1390, h: 360, text: 'PROJETO NOVO\nAgent Reach e Open Design são etapas condicionais. Superpowers organiza o desenvolvimento. ECC entra apenas quando a complexidade realmente exige coordenação avançada.', color: '#6ea8fe' }
    ];
    return b;
  }

  function addEdgeTo(board, from, to, branch) {
    if (!from || !to || from === to) return false;
    var ok = board.nodes.some(function (n) { return n.id === from; }) &&
             board.nodes.some(function (n) { return n.id === to; });
    if (!ok) return false;
    if (board.edges.some(function (e) { return e.from === from && e.to === to; })) return false;
    var edge = { from: from, to: to };
    if (branch === true || branch === false) edge.branch = branch;   // ramo da Decisão (V/F); ausente = incondicional
    board.edges.push(edge);
    return true;
  }

  // duplica o nó `id` no board (id novo, deslocado); PURO re: DOM — caller faz save()/render().
  function duplicateNode(board, id) {
    var n = board.nodes.filter(function (x) { return x.id === id; })[0];
    if (!n) return null;
    var copy = { id: uid(), type: n.type, title: n.title, body: n.body, x: n.x + 26, y: n.y + 26 };
    if (n.color) copy.color = n.color;
    if (n.lang) copy.lang = n.lang;
    if (n.note) copy.note = n.note;
    if (n.activity) copy.activity = n.activity;
    board.nodes.push(copy);
    return copy;
  }

  function deleteNodeFrom(board, id) {
    board.nodes = board.nodes.filter(function (n) { return n.id !== id; });
    board.edges = board.edges.filter(function (e) { return e.from !== id && e.to !== id; });
  }

  // Notas/sticky = frames de agrupamento (retângulo com texto atrás dos nós). PURO re: DOM.
  function addNote(board, x, y) {
    if (!board.notes) board.notes = [];
    var s = { id: uid('s'), x: typeof x === 'number' && isFinite(x) ? x : 40, y: typeof y === 'number' && isFinite(y) ? y : 40, w: 220, h: 140, text: '', color: '#fdd663' };
    board.notes.push(s);
    return s;
  }
  function deleteNoteFrom(board, id) {
    board.notes = (board.notes || []).filter(function (s) { return s.id !== id; });
  }

  // ordem topológica de execução (nós em ciclo ficam de fora) — puro/testável
  function execOrder(board) {
    var indeg = {}, adj = {}, byId = {};
    board.nodes.forEach(function (n) { indeg[n.id] = 0; adj[n.id] = []; byId[n.id] = n; });
    board.edges.forEach(function (e) {
      if (byId[e.from] && byId[e.to]) { adj[e.from].push(e.to); indeg[e.to]++; }
    });
    var q = board.nodes.filter(function (n) { return indeg[n.id] === 0; }).map(function (n) { return n.id; });
    var order = [], seen = {};
    while (q.length) {
      var id = q.shift(); if (seen[id]) continue; seen[id] = true; order.push(id);
      adj[id].forEach(function (to) { if (--indeg[to] <= 0) q.push(to); });
    }
    return order;
  }

  // pure: zoom p/ enquadrar uma bbox (bw×bh) numa viewport (vw×vh), limitado a [zmin, zmax].
  function fitZoom(bw, bh, vw, vh, zmin, zmax) {
    if (!(bw > 0) || !(bh > 0)) return 1;
    return Math.max(zmin, Math.min(vw / bw, vh / bh, zmax));
  }

  // pure: dois retângulos (x,y,w,h) se cruzam? Usado pelo box-select.
  function rectIntersects(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // pure: delta de arraste do grupo, travado p/ o canto sup-esq. do grupo (minx,miny) não passar de 0
  function groupDelta(rawDx, rawDy, minx, miny) {
    return { dx: Math.max(-minx, rawDx), dy: Math.max(-miny, rawDy) };
  }

  // pure: uma aresta é "seguida"? Só arestas rotuladas (branch V/F) de uma Decisão são condicionais.
  function edgeTaken(board, e, decisions) {
    if (e.branch === true || e.branch === false) {
      var src = board.nodes.filter(function (n) { return n.id === e.from; })[0];
      if (src && src.type === 'decisao') return decisions[e.from] === e.branch;
    }
    return true;   // aresta sem rótulo (ou origem não-Decisão) segue sempre
  }

  // pure: quais nós ficam ATIVOS dado o resultado (true/false/null) de cada Decisão — testável
  function activeNodes(board, decisions) {
    decisions = decisions || {};
    var order = execOrder(board);
    var byId = {}; board.nodes.forEach(function (n) { byId[n.id] = n; });
    var incoming = {}; order.forEach(function (id) { incoming[id] = []; });
    board.edges.forEach(function (e) { if (byId[e.from] && incoming[e.to]) incoming[e.to].push(e); });
    var active = {};
    order.forEach(function (id) {
      var ins = incoming[id];
      active[id] = ins.length === 0 ? true
        : ins.some(function (e) { return active[e.from] && edgeTaken(board, e, decisions); });
    });
    return active;
  }

  // ── Atividades: agrupamento leve dos cards de código (puros/testáveis) ───────
  function addActivity(board, name) {
    if (!board.activities) board.activities = [];
    var a = { id: uid('a'), name: (name && String(name).trim()) || ('Atividade ' + (board.activities.length + 1)) };
    board.activities.push(a);
    return a;
  }

  // Ordena os cards de código de UMA atividade pela ORDEM DAS CONEXÕES (não pela posição).
  // A adjacência entre cards da atividade atravessa nós intermediários que não são dela.
  // → { ok:true, order:[ids] } ou { ok:false, reason:'branch'|'disconnected' }.
  function activityOrder(board, cardIds) {
    if (cardIds.length <= 1) return { ok: true, order: cardIds.slice() };
    var set = {}; cardIds.forEach(function (id) { set[id] = true; });
    var adj = {}; board.nodes.forEach(function (n) { adj[n.id] = []; });
    board.edges.forEach(function (e) { if (adj[e.from]) adj[e.from].push(e.to); });
    var succ = {};
    cardIds.forEach(function (a) {
      succ[a] = {};
      var seen = {}, stack = (adj[a] || []).slice();
      while (stack.length) {
        var x = stack.pop(); if (seen[x]) continue; seen[x] = true;
        if (set[x]) succ[a][x] = true;                 // outro card da atividade → para (não atravessa)
        else (adj[x] || []).forEach(function (y) { if (!seen[y]) stack.push(y); });
      }
    });
    var indeg = {}, outdeg = {};
    cardIds.forEach(function (a) { indeg[a] = 0; outdeg[a] = Object.keys(succ[a]).length; });
    cardIds.forEach(function (a) { Object.keys(succ[a]).forEach(function (b) { indeg[b] = (indeg[b] || 0) + 1; }); });
    if (cardIds.some(function (a) { return outdeg[a] > 1 || indeg[a] > 1; })) return { ok: false, reason: 'branch' };
    var roots = cardIds.filter(function (a) { return indeg[a] === 0; });
    if (roots.length !== 1) return { ok: false, reason: 'disconnected' };
    var order = [], cur = roots[0], guard = 0;
    while (cur && guard++ <= cardIds.length) { order.push(cur); cur = Object.keys(succ[cur] || {})[0]; }
    if (order.length !== cardIds.length) return { ok: false, reason: 'disconnected' };
    return { ok: true, order: order };
  }

  // Compõe o "Código final" por atividade (puro/testável).
  // → [{ id, name, count, empty?, warning?, mixed?, order?, blocks:[{lang, code, cardIds}] }]
  function composeCode(board) {
    var acts = (board.activities || []).map(function (a) { return { id: a.id, name: a.name }; });
    var known = {}; acts.forEach(function (a) { known[a.id] = true; });
    var byAct = {}; acts.forEach(function (a) { byAct[a.id] = []; });
    var orphan = [];
    board.nodes.forEach(function (n) {
      if (n.type !== 'codigo') return;
      if (n.activity && known[n.activity]) byAct[n.activity].push(n.id);
      else orphan.push(n.id);                          // card antigo (sem atividade) ou id inválido
    });
    var groups = acts.map(function (a) { return { id: a.id, name: a.name, cardIds: byAct[a.id] }; });
    if (orphan.length) groups.push({ id: null, name: 'Sem atividade', cardIds: orphan });
    var byId = {}; board.nodes.forEach(function (n) { byId[n.id] = n; });
    return groups.map(function (g) {
      var res = { id: g.id, name: g.name, count: g.cardIds.length };
      if (!g.cardIds.length) { res.empty = true; return res; }
      var ord = activityOrder(board, g.cardIds);
      if (!ord.ok) { res.warning = ord.reason; return res; }
      res.order = ord.order;
      var langs = [], seen = {};
      ord.order.forEach(function (id) { var L = langFromTitle(byId[id].title); if (!seen[L]) { seen[L] = true; langs.push(L); } });
      res.mixed = langs.length > 1;                    // não mistura linguagens num só bloco
      res.blocks = langs.map(function (L) {
        var pick = ord.order.filter(function (id) { return langFromTitle(byId[id].title) === L; });
        return { lang: L, code: pick.map(function (id) { return byId[id].body || ''; }).join('\n\n'), cardIds: pick };
      });
      return res;
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var SYNTAX_WORDS = {
    JavaScript: {
      keyword: 'async await break case catch class const continue default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof var void while with yield',
      builtin: 'Array Boolean Date Error JSON Map Math Number Object Promise RegExp Set String Symbol console document fetch parseFloat parseInt setInterval setTimeout window'
    },
    Python: {
      keyword: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
      builtin: 'abs all any bool bytes dict enumerate filter float input int isinstance len list map max min open print range reversed round set sorted str sum super tuple type zip'
    },
    PowerShell: {
      keyword: 'begin break catch class continue data do dynamicparam else elseif end enum exit filter finally for foreach from function hidden if in param process return static switch throw trap try until using var while workflow',
      builtin: 'ForEach-Object Get-ChildItem Get-Content Import-Module Invoke-RestMethod Invoke-WebRequest Select-Object Set-Content Where-Object Write-Error Write-Host Write-Output'
    },
    Bash: {
      keyword: 'case coproc do done elif else esac fi for function if in select then time until while',
      builtin: 'cd echo export local printf pwd read return shift source test'
    },
    SQL: {
      keyword: 'all alter and as asc between by case create delete desc distinct drop else end exists from full group having in inner insert into is join left like limit not null on or order outer primary references right select set table then union unique update values when where',
      builtin: 'avg coalesce count current_date current_timestamp lower max min now round sum upper'
    },
    JSON: { keyword: 'false null true', builtin: '' }
  };
  Object.keys(SYNTAX_WORDS).forEach(function (lang) {
    Object.keys(SYNTAX_WORDS[lang]).forEach(function (kind) {
      var set = {};
      SYNTAX_WORDS[lang][kind].split(/\s+/).filter(Boolean).forEach(function (word) { set[word.toLowerCase()] = true; });
      SYNTAX_WORDS[lang][kind] = set;
    });
  });

  // Realce visual puro: sempre escapa o texto antes de inserir spans no DOM.
  function highlightCode(code, lang) {
    code = String(code == null ? '' : code);
    lang = LANGS.indexOf(lang) >= 0 ? lang : 'Texto';
    if (lang === 'Texto') return esc(code);
    if (lang === 'HTML') {
      var outHtml = '', lastHtml = 0, htmlRe = /(<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>)/g, hm;
      while ((hm = htmlRe.exec(code))) {
        outHtml += esc(code.slice(lastHtml, hm.index));
        outHtml += '<span class="fx-syn-' + (hm[0].slice(0, 4) === '<!--' ? 'comment' : 'tag') + '">' + esc(hm[0]) + '</span>';
        lastHtml = hm.index + hm[0].length;
      }
      return outHtml + esc(code.slice(lastHtml));
    }

    var comments = {
      JavaScript: '\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*',
      Python: '#[^\\n]*',
      PowerShell: '#[^\\n]*',
      Bash: '#[^\\n]*',
      SQL: '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/'
    };
    var source = (comments[lang] ? comments[lang] + '|' : '') +
      '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`|' +
      '\\$[A-Za-z_][\\w]*|\\b(?:0[xX][\\da-fA-F]+|\\d+(?:\\.\\d+)?)\\b|[A-Za-z_][\\w-]*';
    var re = new RegExp(source, 'g'), words = SYNTAX_WORDS[lang] || {}, out = '', last = 0, m;
    while ((m = re.exec(code))) {
      var token = m[0], kind = '';
      out += esc(code.slice(last, m.index));
      if (/^(?:\/\/|\/\*|#|--)/.test(token)) kind = 'comment';
      else if (/^["'`]/.test(token)) kind = lang === 'JSON' && /^\s*:/.test(code.slice(m.index + token.length)) ? 'key' : 'string';
      else if (/^\$/.test(token)) kind = 'variable';
      else if (/^(?:0[xX][\da-fA-F]+|\d)/.test(token)) kind = 'number';
      else if (words.keyword && words.keyword[token.toLowerCase()]) kind = 'keyword';
      else if (words.builtin && words.builtin[token.toLowerCase()]) kind = 'builtin';
      out += kind ? '<span class="fx-syn-' + kind + '">' + esc(token) + '</span>' : esc(token);
      last = m.index + token.length;
    }
    return out + esc(code.slice(last));
  }

  // ── Persistência ───────────────────────────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var db = JSON.parse(raw);
        if (db && db.boards && db.boards.length) {
          var skillIndex = -1;
          db.boards.forEach(function (board, index) { if (board.template === SKILLS_TEMPLATE) skillIndex = index; });
          var changed = false;
          if (skillIndex >= 0 && db.boards[skillIndex].templateVersion !== 2) {
            var fresh = skillsBoard();
            fresh.id = db.boards[skillIndex].id;
            db.boards[skillIndex] = fresh;
            changed = true;
          }
          if (!db.skillsTemplateV1) {
            if (skillIndex < 0) db.boards.push(skillsBoard());
            db.skillsTemplateV1 = true;
            changed = true;
          }
          if (changed) try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (ignore) {}
          return db;
        }
      }
    } catch (e) { /* localStorage indisponível / corrompido → semeia */ }
    var b = seedBoard(), skills = skillsBoard();
    return { boards: [b, skills], active: skills.id, skillsTemplateV1: true };
  }
  var saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
      snapshotHistory();   // coalesce: uma rajada de teclas/arraste vira 1 passo de histórico
    }, 250);
  }

  // ── Undo/redo (histórico curto em memória) ───────────────────────────────────
  // pure: motor de pilhas, sem DOM/DB — testável. push(prev) registra transição e zera o redo.
  function makeHistory(max) {
    var undoS = [], redoS = [];
    return {
      push: function (prev) { undoS.push(prev); if (undoS.length > max) undoS.shift(); redoS = []; },
      undo: function (cur) { if (!undoS.length) return null; redoS.push(cur); return undoS.pop(); },
      redo: function (cur) { if (!redoS.length) return null; undoS.push(cur); return redoS.pop(); },
      canUndo: function () { return undoS.length > 0; },
      canRedo: function () { return redoS.length > 0; }
    };
  }
  var hist = makeHistory(50), histPrev = null;   // histPrev = JSON do DB no último ponto de histórico
  function snapshotHistory() {
    var cur = JSON.stringify(DB);
    if (histPrev === null) { histPrev = cur; return; }   // baseline (nada a desfazer ainda)
    if (cur === histPrev) return;                         // nada mudou de fato
    hist.push(histPrev); histPrev = cur; syncHistButtons();
  }
  function applyRestore(json) {
    clearTimeout(saveT);                                  // cancela save pendente (não gera novo histórico)
    histPrev = json; DB = JSON.parse(json);
    try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
    renderKeepingScroll();                                // reconstrói a tela sem saltar o scroll
  }
  function undo() { var s = hist.undo(JSON.stringify(DB)); if (s != null) applyRestore(s); }
  function redo() { var s = hist.redo(JSON.stringify(DB)); if (s != null) applyRestore(s); }
  function syncHistButtons() {
    if (!root) return;
    var u = root.querySelector('[data-act="undo"]'), r = root.querySelector('[data-act="redo"]');
    if (u) u.disabled = !hist.canUndo();
    if (r) r.disabled = !hist.canRedo();
  }

  // ── Runtime (só no browser) ──────────────────────────────────────────────────
  var DB, root, canvas, svg, zoom = 1, panelEl = null, backdropEl = null, editingId = null, miniEl = null, skillsFittedId = null;
  var codePanelEl = null, codePanelOpen = false, codeCollapsed = {}, codeCompose = [];

  function activeBoard() {
    var m = DB.boards.filter(function (b) { return b.id === DB.active; });
    return m[0] || DB.boards[0];
  }
  function nodeById(b, id) { return b.nodes.filter(function (n) { return n.id === id; })[0]; }
  function noteById(b, id) { return (b.notes || []).filter(function (s) { return s.id === id; })[0]; }
  function outPtFor(n, branch) { return { x: n.x + NODE_W, y: n.y + (branch === false ? PORT_Y_F : PORT_Y) }; }
  function outPt(n) { return outPtFor(n, undefined); }
  function inPt(n)  { return { x: n.x,          y: n.y + PORT_Y }; }

  function edgePath(a, b) {
    var dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return 'M' + a.x + ',' + a.y + ' C' + (a.x + dx) + ',' + a.y + ' ' + (b.x - dx) + ',' + b.y + ' ' + b.x + ',' + b.y;
  }

  // ── Painel lateral de config do nó (edição maior, sem apertar o card) ────────
  function cardEl(id) { return canvas && canvas.querySelector('.fx-node[data-id="' + id + '"]'); }
  function setCardVal(id, sel, val) { var c = cardEl(id); var f = c && c.querySelector(sel); if (f) f.value = val; }
  function paintCode(card, node) {
    var pre = card && card.querySelector('.fx-node-highlight');
    var body = card && card.querySelector('.fx-node-body');
    if (!pre || !body || !node) return;
    pre.innerHTML = highlightCode(node.body || '', langFromTitle(node.title));
    pre.scrollTop = body.scrollTop;
    pre.scrollLeft = body.scrollLeft;
  }

  // backdrop do modal de edição (dim atrás do painel central; clicar fora fecha) — persistente, reusa a ação panel-close
  function backdropNode() {
    if (backdropEl) return backdropEl;
    backdropEl = document.createElement('div');
    backdropEl.className = 'fx-panel-backdrop';
    backdropEl.dataset.act = 'panel-close';
    return backdropEl;
  }

  // painel PERSISTENTE (criado 1x, re-anexado a cada render) → transições de abrir/fechar limpas
  function panelNode() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('aside');
    panelEl.className = 'fx-panel';
    panelEl.innerHTML =
      '<div class="fx-panel-head">' +
        '<span class="fx-panel-type"></span>' +
        '<span class="fx-panel-langtag" title="Linguagem detectada pelo nome do arquivo"></span>' +
        '<button class="fx-btn fx-panel-close" data-act="panel-close" title="Fechar (Esc)">✕</button>' +
      '</div>' +
      '<label class="fx-panel-label">Nome do arquivo <span class="fx-panel-hint">— a extensão define a linguagem, ex.: <code>scanner.py</code></span></label>' +
      '<input class="fx-panel-title" type="text" spellcheck="false" placeholder="scanner.py">' +
      '<div class="fx-panel-act-wrap">' +
        '<label class="fx-panel-label">Atividade</label>' +
        '<select class="fx-panel-act"></select>' +
      '</div>' +
      '<div class="fx-panel-split">' +
        '<div class="fx-panel-col">' +
          '<label class="fx-panel-label fx-panel-body-label">Código</label>' +
          '<div class="fx-panel-code-wrap">' +
            '<pre class="fx-panel-highlight" aria-hidden="true"></pre>' +
            '<textarea class="fx-panel-body" spellcheck="false" placeholder="Cole o código aqui…"></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="fx-panel-col">' +
          '<label class="fx-panel-label">Bloco de notas</label>' +
          '<textarea class="fx-panel-note" spellcheck="false" placeholder="Suas anotações sobre este card…"></textarea>' +
        '</div>' +
      '</div>';
    panelEl.querySelector('.fx-panel-body').addEventListener('scroll', function () {   // realce acompanha o scroll
      var pre = panelEl.querySelector('.fx-panel-highlight'); pre.scrollTop = this.scrollTop; pre.scrollLeft = this.scrollLeft;
    });
    return panelEl;
  }

  // popula a partir do modelo e abre; sem nó em edição → fecha. Chamado no fim de render() e ao abrir/fechar.
  function syncPanel() {
    if (!panelEl) return;
    var n = editingId ? nodeById(activeBoard(), editingId) : null;
    if (!n) { editingId = null; panelEl.classList.remove('fx-panel--open'); if (backdropEl) backdropEl.classList.remove('fx-panel-backdrop--open'); return; }
    var t = TYPES[n.type] || TYPES.processo;
    panelEl.style.setProperty('--nc', n.color || t.color);
    panelEl.querySelector('.fx-panel-type').textContent = t.label;
    panelEl.querySelector('.fx-panel-title').value = n.title || '';
    panelEl.querySelector('.fx-panel-body').value = n.body || '';
    panelEl.querySelector('.fx-panel-note').value = n.note || '';
    panelEl.querySelector('.fx-panel-body-label').textContent = n.type === 'codigo' ? 'Código' : 'Conteúdo';
    syncPanelHighlight(n);
    if (n.type === 'codigo') {
      var acts = activeBoard().activities || [];
      var cur = (n.activity && acts.some(function (a) { return a.id === n.activity; })) ? n.activity : '';
      panelEl.querySelector('.fx-panel-act').innerHTML =
        '<option value="">Sem atividade</option>' +
        acts.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
        '<option value="__new__">➕ Nova atividade…</option>';
      panelEl.querySelector('.fx-panel-act').value = cur;
      panelEl.classList.add('fx-panel-codigo');
    } else panelEl.classList.remove('fx-panel-codigo');
    panelEl.classList.add('fx-panel--open');
    if (backdropEl) backdropEl.classList.add('fx-panel-backdrop--open');
  }

  // chip de linguagem (vem do nome do arquivo) + realce colorido do editor do modal
  function syncPanelHighlight(n) {
    if (!panelEl || !n) return;
    var L = langFromTitle(n.title);
    var tag = panelEl.querySelector('.fx-panel-langtag');
    if (n.type === 'codigo') { tag.textContent = L; tag.style.display = ''; }
    else { tag.textContent = ''; tag.style.display = 'none'; }
    var pre = panelEl.querySelector('.fx-panel-highlight');
    var body = panelEl.querySelector('.fx-panel-body');
    pre.innerHTML = highlightCode(n.body || '', L);
    pre.scrollTop = body.scrollTop; pre.scrollLeft = body.scrollLeft;
  }

  // ── Painel "Código final": compõe os cards de código por atividade ───────────
  function codePanel() {
    if (codePanelEl) return codePanelEl;
    codePanelEl = document.createElement('aside');
    codePanelEl.className = 'fx-code';
    codePanelEl.innerHTML =
      '<div class="fx-code-head">' +
        '<span class="fx-code-title">Código final</span>' +
        '<button class="fx-btn fx-code-add" data-act="act-new" title="Criar uma atividade">+ Atividade</button>' +
        '<button class="fx-btn fx-code-x" data-act="code-close" title="Fechar">✕</button>' +
      '</div>' +
      '<div class="fx-code-list"></div>';
    return codePanelEl;
  }

  function toggleCodePanel(btn) {
    codePanelOpen = !codePanelOpen;
    if (codePanelEl) codePanelEl.classList.toggle('fx-code--open', codePanelOpen);
    if (btn && btn.classList) btn.classList.toggle('is-open', codePanelOpen);
    if (codePanelOpen) refreshCode();
  }

  function actNew() {
    var nm = prompt('Nome da nova atividade:', 'Atividade ' + ((activeBoard().activities || []).length + 1));
    if (nm == null) return;
    addActivity(activeBoard(), nm); save(); refreshCode();
  }
  function actRename(id) {
    var a = (activeBoard().activities || []).filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var nm = prompt('Renomear atividade:', a.name); if (nm == null) return;
    a.name = nm.trim() || a.name; save(); renderKeepingScroll();   // o badge nos cards também muda
  }
  function actMove(id, dir) {
    var acts = activeBoard().activities || [];
    var i = acts.map(function (a) { return a.id; }).indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= acts.length) return;
    var t = acts[i]; acts[i] = acts[j]; acts[j] = t; save(); refreshCode();
  }

  function fallbackCopy(text) {
    try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) {}
  }
  function codeCopy(btn) {
    var g = codeCompose[+btn.dataset.ci]; if (!g || !g.blocks) return;
    var blk = g.blocks[+btn.dataset.bi]; if (!blk) return;
    var text = blk.code, orig = btn.dataset.orig || btn.textContent;
    btn.dataset.orig = orig;
    function done() { btn.textContent = 'Copiado ✓'; setTimeout(function () { btn.textContent = orig; }, 1200); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      else { fallbackCopy(text); done(); }
    } catch (e) { fallbackCopy(text); done(); }
  }

  var WARN_MSG = {
    disconnected: 'Conecte os cards para definir a ordem do código.',
    branch: 'Há uma ramificação: a ordem ficou ambígua. Conecte os cards em sequência.'
  };

  // Reconstrói a lista do painel a partir do modelo. Preserva o próprio scroll (não mexe no Fluxo).
  function refreshCode() {
    if (!codePanelEl || !codePanelOpen) return;
    var list = codePanelEl.querySelector('.fx-code-list'); if (!list) return;
    var prevScroll = list.scrollTop;
    codeCompose = composeCode(activeBoard());
    var html = codeCompose.map(function (g, ci) {
      var key = g.id || 'orphan', collapsed = !!codeCollapsed[key];
      var controls = g.id
        ? '<button class="fx-act-btn" data-act="act-ren" data-act-id="' + esc(g.id) + '" title="Renomear">✎</button>' +
          '<button class="fx-act-btn" data-act="act-up" data-act-id="' + esc(g.id) + '" title="Subir">↑</button>' +
          '<button class="fx-act-btn" data-act="act-down" data-act-id="' + esc(g.id) + '" title="Descer">↓</button>'
        : '';
      var body;
      if (g.empty) body = '<div class="fx-code-empty">Nenhum card de código aqui. Abra o painel de um card (⤢) e escolha esta atividade.</div>';
      else if (g.warning) body = '<div class="fx-code-warn">' + esc(WARN_MSG[g.warning] || WARN_MSG.disconnected) + '</div>';
      else body =
        (g.mixed ? '<div class="fx-code-mixed">Linguagens diferentes — separadas por bloco (não misturadas).</div>' : '') +
        g.blocks.map(function (blk, bi) {
          return '<div class="fx-code-block">' +
            '<div class="fx-code-block-head">' +
              '<span class="fx-code-lang">' + esc(blk.lang) + '</span>' +
              '<button class="fx-code-copy" data-act="code-copy" data-ci="' + ci + '" data-bi="' + bi + '">Copiar</button>' +
            '</div>' +
            '<pre class="fx-code-pre">' + highlightCode(blk.code, blk.lang) + '</pre>' +
          '</div>';
        }).join('');
      return '<section class="fx-act' + (collapsed ? ' fx-act--collapsed' : '') + '">' +
        '<div class="fx-act-head" data-act="act-collapse" data-act-id="' + esc(g.id || '') + '">' +
          '<span class="fx-act-caret">▸</span>' +
          '<span class="fx-act-name">' + esc(g.name) + '</span>' +
          '<span class="fx-act-count" title="cards de código">' + g.count + '</span>' +
          controls +
        '</div>' +
        '<div class="fx-act-body">' + body + '</div>' +
      '</section>';
    }).join('');
    list.innerHTML = html || '<div class="fx-code-empty">Nenhum card de código ainda. Adicione um card “Código”.</div>';
    list.scrollTop = prevScroll;
  }

  function render() {
    var b = activeBoard();
    root.innerHTML =
      '<div class="fx-toolbar">' +
        '<select class="fx-board-sel" title="Quadro"></select>' +
        '<button class="fx-btn" data-act="board-new">+ Quadro</button>' +
        '<button class="fx-btn" data-act="skills-map" title="Abrir o mapa pronto para escolher as skills">✦ Mapa de Skills</button>' +
        '<button class="fx-btn" data-act="board-ren">Renomear</button>' +
        '<button class="fx-btn fx-btn-danger" data-act="board-del">Excluir</button>' +
        '<button class="fx-btn" data-act="board-export" title="Baixar este quadro como JSON">Exportar</button>' +
        '<button class="fx-btn" data-act="board-import" title="Importar um quadro de um arquivo JSON">Importar</button>' +
        '<button class="fx-btn" data-act="board-paste" title="Colar o JSON de um quadro">Colar</button>' +
        '<input type="file" class="fx-import-file" accept="application/json,.json" style="display:none">' +
        '<span class="fx-sep"></span>' +
        '<button class="fx-btn fx-hist-btn" data-act="undo" title="Desfazer (Ctrl+Z)" disabled>↶</button>' +
        '<button class="fx-btn fx-hist-btn" data-act="redo" title="Refazer (Ctrl+Shift+Z / Ctrl+Y)" disabled>↷</button>' +
        '<span class="fx-sep"></span>' +
        '<button class="fx-btn fx-run-btn" data-act="run" title="Executar o fluxo — roda os nós de Código num sandbox (Web Worker, sem rede)">▶ Executar</button>' +
        '<span class="fx-sep"></span>' +
        '<span class="fx-add-label">Adicionar:</span>' +
        Object.keys(TYPES).map(function (t) {
          return '<button class="fx-btn fx-add fx-add--' + t + '" data-act="add" data-type="' + t + '">' + TYPES[t].label + '</button>';
        }).join('') +
        '<button class="fx-btn fx-add-note" data-act="note-new" title="Adicionar nota / frame de agrupamento">+ Nota</button>' +
        '<span class="fx-sep"></span>' +
        '<button class="fx-btn fx-zoom-btn" data-act="zoom-out" title="Diminuir zoom (Ctrl+scroll)">−</button>' +
        '<button class="fx-btn fx-zoom-lvl" data-act="zoom-reset" title="Resetar zoom (100%)">100%</button>' +
        '<button class="fx-btn fx-zoom-btn" data-act="zoom-in" title="Aumentar zoom (Ctrl+scroll)">+</button>' +
        '<button class="fx-btn" data-act="fit-view" title="Enquadrar tudo — ajusta o zoom p/ ver todos os nós">⤢ Enquadrar</button>' +
        '<button class="fx-btn" data-act="reset-view" title="Resetar — 100% e volta ao canto">⟲ Resetar</button>' +
        '<span class="fx-sep"></span>' +
        '<button class="fx-btn fx-code-toggle' + (codePanelOpen ? ' is-open' : '') + '" data-act="code-toggle" title="Mostrar/ocultar o Código final (composição dos cards por atividade)">&lt;/&gt; Código final</button>' +
        '<span class="fx-hint">Arraste o cabeçalho p/ mover · Ctrl+arraste (botão direito) ou role p/ navegar · Ctrl+scroll = zoom</span>' +
      '</div>' +
      '<div class="fx-stage"><div class="fx-canvas-wrap"><div class="fx-sizer"><div class="fx-canvas"><svg class="fx-edges"></svg></div></div></div></div>';

    canvas = root.querySelector('.fx-canvas');
    svg = root.querySelector('.fx-edges');
    var stage = root.querySelector('.fx-stage');
    stage.appendChild(backdropNode());                          // backdrop do modal de edição (atrás do painel)
    stage.appendChild(panelNode());                             // painel de edição persistente re-anexado
    stage.appendChild(codePanel());                             // painel "Código final" persistente re-anexado
    stage.appendChild(minimap());                               // minimapa persistente re-anexado
    codePanelEl.classList.toggle('fx-code--open', codePanelOpen);

    var sel = root.querySelector('.fx-board-sel');
    DB.boards.forEach(function (bd) {
      var o = document.createElement('option');
      o.value = bd.id; o.textContent = bd.name;
      if (bd.id === DB.active) o.selected = true;
      sel.appendChild(o);
    });

    (b.notes || []).forEach(function (s) { canvas.insertBefore(noteEl(s), svg); });  // antes do <svg> → atrás das conexões e dos nós
    b.nodes.forEach(function (n) { canvas.appendChild(nodeEl(n)); });
    redrawEdges();
    applyZoom();  // reaplica o zoom atual (render() roda também ao adicionar nó / trocar quadro)
    renderMinimap();  // desenha o minimapa a partir dos nós recém-inseridos (offsetHeight já disponível)
    syncPanel();  // reabre/repopula o painel se um nó estava em edição
    refreshCode();  // reconstrói o "Código final" (no-op se o painel estiver fechado)
    syncHistButtons();  // habilita/desabilita ↶/↷ conforme as pilhas
  }

  // Re-render preservando a posição de rolagem do canvas (o zoom já é var de módulo).
  // Usado ao excluir/alterar um card p/ a tela não saltar para o começo do Fluxo.
  function renderKeepingScroll() {
    var wrap = root && root.querySelector('.fx-canvas-wrap');
    var sl = wrap ? wrap.scrollLeft : 0, st = wrap ? wrap.scrollTop : 0;
    render();
    var w2 = root && root.querySelector('.fx-canvas-wrap');
    if (w2) { w2.scrollLeft = sl; w2.scrollTop = st; }
  }

  function nodeEl(n) {
    var t = TYPES[n.type] || TYPES.processo;
    var el = document.createElement('div');
    el.className = 'fx-node fx-node--' + n.type;
    el.dataset.id = n.id;
    el.tabIndex = -1;                                   // foco de teclado no card (Delete/Ctrl+D)
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.setProperty('--nc', n.color || t.color);   // cor personalizada por card (cai no default do tipo)

    var head = document.createElement('div'); head.className = 'fx-node-head';
    var tag = document.createElement('span'); tag.className = 'fx-node-type'; tag.textContent = t.label;
    var edit = document.createElement('button'); edit.className = 'fx-node-edit'; edit.dataset.act = 'node-edit'; edit.title = 'Editar em painel'; edit.textContent = '⤢';
    var dup = document.createElement('button'); dup.className = 'fx-node-dup'; dup.dataset.act = 'node-dup'; dup.title = 'Duplicar nó (Ctrl+D)'; dup.textContent = '⧉';
    var del = document.createElement('button'); del.className = 'fx-node-del'; del.dataset.act = 'node-del'; del.title = 'Excluir nó (Delete)'; del.textContent = '✕';
    head.appendChild(tag); head.appendChild(edit); head.appendChild(dup); head.appendChild(del); el.appendChild(head);

    var title = document.createElement('input');
    title.className = 'fx-node-title'; title.value = n.title || ''; title.placeholder = 'Título'; title.spellcheck = false;
    el.appendChild(title);

    if (n.type === 'codigo' && n.activity) {            // badge da atividade (ex.: "Atividade 1")
      var acts0 = activeBoard().activities || [];
      var a0 = acts0.filter(function (x) { return x.id === n.activity; })[0];
      if (a0) { var badge = document.createElement('span'); badge.className = 'fx-node-act'; badge.textContent = a0.name; badge.title = 'Atividade: ' + a0.name; el.appendChild(badge); }
    }

    var body = document.createElement('textarea');
    body.className = 'fx-node-body' + (n.type === 'codigo' ? ' fx-mono' : '');
    body.value = n.body || '';
    body.placeholder = n.type === 'codigo' ? 'Cole o código aqui…' : 'Anotações…';
    body.spellcheck = false;
    if (n.type === 'codigo') {
      var codeWrap = document.createElement('div'); codeWrap.className = 'fx-node-code-wrap';
      var highlighted = document.createElement('pre'); highlighted.className = 'fx-node-highlight';
      highlighted.setAttribute('aria-hidden', 'true');
      highlighted.innerHTML = highlightCode(n.body || '', langFromTitle(n.title));
      body.addEventListener('scroll', function () {
        highlighted.scrollTop = body.scrollTop;
        highlighted.scrollLeft = body.scrollLeft;
      });
      codeWrap.appendChild(highlighted); codeWrap.appendChild(body); el.appendChild(codeWrap);
    } else el.appendChild(body);

    var pin = document.createElement('span'); pin.className = 'fx-port fx-port-in'; pin.title = 'Entrada';
    var pout = document.createElement('span'); pout.className = 'fx-port fx-port-out'; pout.title = 'Arraste para conectar';
    el.appendChild(pin); el.appendChild(pout);
    if (n.type === 'decisao') {                          // 2ª saída: ramo FALSO (a saída de cima vira VERDADEIRO)
      pout.title = 'Saída VERDADEIRO — seguida quando o código retorna true';
      var pf = document.createElement('span'); pf.className = 'fx-port fx-port-false';
      pf.title = 'Saída FALSO — seguida quando o código retorna false';
      el.appendChild(pf);
    }
    return el;
  }

  function noteEl(s) {
    var el = document.createElement('div');
    el.className = 'fx-note';
    el.dataset.note = s.id;
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    el.style.width = (s.w || 220) + 'px'; el.style.height = (s.h || 140) + 'px';
    el.style.setProperty('--nc', s.color || '#fdd663');

    var head = document.createElement('div'); head.className = 'fx-note-head';
    var label = document.createElement('span'); label.className = 'fx-note-label'; label.textContent = 'Nota';
    var color = document.createElement('input'); color.type = 'color'; color.className = 'fx-note-color'; color.title = 'Cor da nota'; color.value = s.color || '#fdd663';
    var del = document.createElement('button'); del.className = 'fx-note-del'; del.dataset.act = 'note-del'; del.title = 'Excluir nota'; del.textContent = '✕';
    head.appendChild(label); head.appendChild(color); head.appendChild(del); el.appendChild(head);

    var body = document.createElement('textarea'); body.className = 'fx-note-body'; body.value = s.text || ''; body.placeholder = 'Nota / frame de agrupamento…'; body.spellcheck = false;
    el.appendChild(body);

    // persiste o resize nativo (CSS resize:both) — só grava se mudou de fato (guarda o disparo inicial)
    // ponytail: a alça de resize é em px de tela, então em zoom ≠ 100% o arraste fica proporcional ao zoom (aceitável)
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        var w = el.offsetWidth, h = el.offsetHeight;
        if (w && h && (s.w !== w || s.h !== h)) { s.w = w; s.h = h; save(); }
      }).observe(el);
    }
    return el;
  }

  function redrawEdges() {
    var b = activeBoard();
    var parts = [];
    b.edges.forEach(function (e) {
      var a = nodeById(b, e.from), c = nodeById(b, e.to);
      if (a && c) parts.push('<path class="fx-edge-line" d="' + edgePath(outPtFor(a, e.branch), inPt(c)) + '"></path>');
    });
    svg.innerHTML = parts.join('');

    // botões ✕ nos meios das conexões (delete explícito — sem apagar por clique acidental no fio)
    Array.prototype.slice.call(canvas.querySelectorAll('.fx-edge-del')).forEach(function (x) { x.remove(); });
    b.edges.forEach(function (e, i) {
      var a = nodeById(b, e.from), c = nodeById(b, e.to);
      if (!a || !c) return;
      var o = outPtFor(a, e.branch), ip = inPt(c);
      var btn = document.createElement('button');
      btn.className = 'fx-edge-del'; btn.dataset.act = 'edge-del'; btn.dataset.edge = i; btn.title = 'Remover conexão'; btn.textContent = '✕';
      btn.style.left = ((o.x + ip.x) / 2 - 9) + 'px';
      btn.style.top = ((o.y + ip.y) / 2 - 9) + 'px';
      canvas.appendChild(btn);
    });
  }

  // ── Arraste de nó + criação de conexão (pointer events) ──────────────────────
  var drag = null, wire = null, pan = null, box = null, sel = {}, noteDrag = null;

  function clearSel() {                                   // limpa a seleção múltipla (visual + estado)
    Object.keys(sel).forEach(function (id) { var el = cardEl(id); if (el) el.classList.remove('fx-selected'); });
    sel = {};
  }
  function markSel(id) { sel[id] = true; var el = cardEl(id); if (el) el.classList.add('fx-selected'); }

  function toCanvas(e) {
    var r = canvas.getBoundingClientRect();   // rect já vem escalado pelo transform → dividir p/ voltar ao modelo
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }

  function onPointerDown(e) {
    // Ctrl + botão direito = navegar pelo canvas (arrasta o scroll do wrap)
    if (e.button === 2 && e.ctrlKey) {
      var wrap = root.querySelector('.fx-canvas-wrap');
      if (!wrap) return;
      pan = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, wrap: wrap };
      wrap.classList.add('fx-panning');
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
      return;
    }
    var out = e.target.closest && e.target.closest('.fx-port-out, .fx-port-false');
    if (out) {
      var srcId = out.closest('.fx-node').dataset.id;
      var branch;                                        // undefined = aresta incondicional
      if (out.classList.contains('fx-port-false')) branch = false;
      else { var sn = nodeById(activeBoard(), srcId); if (sn && sn.type === 'decisao') branch = true; }
      wire = { from: srcId, branch: branch };
      wire.tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      wire.tmp.setAttribute('class', 'fx-edge-temp');
      svg.appendChild(wire.tmp);
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
      return;
    }
    var head = e.target.closest && e.target.closest('.fx-node-head');
    if (head && !e.target.closest('.fx-node-del, .fx-node-dup, .fx-node-edit')) {
      var nEl = head.closest('.fx-node');
      var n = nodeById(activeBoard(), nEl.dataset.id);
      nEl.focus();                                       // seleciona o card p/ Delete/Ctrl+D
      var pt = toCanvas(e);
      if (!sel[n.id]) clearSel();                        // arrastar um nó fora da seleção limpa o resto
      var ids = (sel[n.id] ? Object.keys(sel) : [n.id]).filter(function (id) { return nodeById(activeBoard(), id); });
      var starts = {}, minx = Infinity, miny = Infinity;
      ids.forEach(function (id) { var nn = nodeById(activeBoard(), id); starts[id] = { x: nn.x, y: nn.y }; minx = Math.min(minx, nn.x); miny = Math.min(miny, nn.y); });
      drag = { id: n.id, dx: pt.x - n.x, dy: pt.y - n.y, el: nEl, ids: ids, starts: starts, minx: minx, miny: miny };
      nEl.classList.add('fx-dragging');
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
      return;
    }
    // arrastar uma nota pelo cabeçalho (não pelos botões de cor/excluir)
    var noteHead = e.target.closest && e.target.closest('.fx-note-head');
    if (noteHead && !e.target.closest('.fx-note-del, .fx-note-color')) {
      var sEl = noteHead.closest('.fx-note');
      var sn = noteById(activeBoard(), sEl.dataset.note);
      if (sn) {
        var ps = toCanvas(e);
        noteDrag = { note: sn, el: sEl, dx: ps.x - sn.x, dy: ps.y - sn.y };
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        e.preventDefault();
      }
      return;
    }
    // left-drag em área vazia do canvas = box-select (seleção por retângulo)
    if (e.button === 0 && e.target.closest('.fx-canvas-wrap') && !e.target.closest('.fx-node, .fx-note')) {
      var p0 = toCanvas(e);
      box = { x0: p0.x, y0: p0.y, moved: false, el: null, rect: null };
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
    }
  }

  function onPointerMove(e) {
    if (pan) {
      pan.wrap.scrollLeft = pan.sl - (e.clientX - pan.x);
      pan.wrap.scrollTop = pan.st - (e.clientY - pan.y);
    } else if (drag) {
      var pt = toCanvas(e);
      // move o grupo inteiro rígido: delta a partir do nó arrastado, travado no canto do canvas
      var d = groupDelta(Math.round(pt.x - drag.dx) - drag.starts[drag.id].x,
                         Math.round(pt.y - drag.dy) - drag.starts[drag.id].y, drag.minx, drag.miny);
      drag.ids.forEach(function (id) {
        var n = nodeById(activeBoard(), id); if (!n) return;
        n.x = drag.starts[id].x + d.dx; n.y = drag.starts[id].y + d.dy;
        var el = cardEl(id); if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
      });
      redrawEdges();
    } else if (wire) {
      var a = outPtFor(nodeById(activeBoard(), wire.from), wire.branch);
      wire.tmp.setAttribute('d', edgePath(a, toCanvas(e)));
    } else if (box) {
      var pb = toCanvas(e);
      var bx = Math.min(box.x0, pb.x), by = Math.min(box.y0, pb.y);
      var bw = Math.abs(pb.x - box.x0), bh = Math.abs(pb.y - box.y0);
      if (!box.moved && (bw > 3 || bh > 3)) {            // só cria o retângulo ao arrastar de fato
        box.moved = true;
        box.el = document.createElement('div'); box.el.className = 'fx-selbox'; canvas.appendChild(box.el);
      }
      if (box.el) {
        box.el.style.left = bx + 'px'; box.el.style.top = by + 'px';
        box.el.style.width = bw + 'px'; box.el.style.height = bh + 'px';
        clearSel();                                       // re-seleciona conforme o retângulo atual
        activeBoard().nodes.forEach(function (n) {
          var el = cardEl(n.id), nh = el ? el.offsetHeight : 90;
          if (rectIntersects(bx, by, bw, bh, n.x, n.y, NODE_W, nh)) markSel(n.id);
        });
      }
    } else if (noteDrag) {
      var pt2 = toCanvas(e);
      noteDrag.note.x = Math.max(0, Math.round(pt2.x - noteDrag.dx));
      noteDrag.note.y = Math.max(0, Math.round(pt2.y - noteDrag.dy));
      noteDrag.el.style.left = noteDrag.note.x + 'px';
      noteDrag.el.style.top = noteDrag.note.y + 'px';
    }
  }

  function onPointerUp(e) {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    if (pan) { pan.wrap.classList.remove('fx-panning'); pan = null; return; }
    if (noteDrag) { noteDrag = null; save(); return; }
    if (box) { if (box.el) box.el.remove(); if (!box.moved) clearSel(); box = null; return; }
    if (drag) { drag.el.classList.remove('fx-dragging'); drag = null; save(); renderMinimap(); }
    if (wire) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var inp = el && el.closest ? el.closest('.fx-port-in') : null;
      if (inp && addEdgeTo(activeBoard(), wire.from, inp.closest('.fx-node').dataset.id, wire.branch)) save();
      if (wire.tmp) wire.tmp.remove();
      wire = null;
      redrawEdges();
    }
  }

  // ── Zoom (Ctrl+scroll ou botões) ─────────────────────────────────────────────
  function applyZoom() {
    if (canvas) canvas.style.transform = 'scale(' + zoom + ')';
    var sizer = root && root.querySelector('.fx-sizer');
    if (sizer) { sizer.style.width = (CANVAS_W * zoom) + 'px'; sizer.style.height = (CANVAS_H * zoom) + 'px'; }
    var lvl = root && root.querySelector('.fx-zoom-lvl');
    if (lvl) lvl.textContent = Math.round(zoom * 100) + '%';
    updateMiniViewport();
  }

  // Aplica novo zoom mantendo fixo o ponto sob o cursor (cx/cy em coords de tela; null = centro do wrap)
  function setZoom(z, cx, cy) {
    var wrap = root.querySelector('.fx-canvas-wrap'); if (!wrap) return;
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    var wr = wrap.getBoundingClientRect();
    var px = (cx == null ? wr.width / 2 : cx - wr.left);
    var py = (cy == null ? wr.height / 2 : cy - wr.top);
    var mx = (wrap.scrollLeft + px) / zoom;   // ponto do modelo sob o cursor (antes)
    var my = (wrap.scrollTop + py) / zoom;
    zoom = z;
    applyZoom();
    wrap.scrollLeft = mx * zoom - px;          // reposiciona p/ o mesmo ponto ficar sob o cursor
    wrap.scrollTop = my * zoom - py;
  }

  function onWheel(e) {
    if (!e.ctrlKey) return;                     // só com Ctrl (senão é scroll normal do wrap)
    var wrap = root.querySelector('.fx-canvas-wrap');
    if (!wrap || !wrap.contains(e.target)) return;
    e.preventDefault();                         // impede o zoom da página
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
  }

  function onContextMenu(e) {
    if (e.ctrlKey && e.target.closest('.fx-canvas-wrap')) e.preventDefault();  // Ctrl+dir. = pan, não menu
  }

  // ── Minimapa + enquadrar/resetar ─────────────────────────────────────────────
  function minimap() {                                    // persistente (re-anexado a cada render)
    if (!miniEl) { miniEl = document.createElement('div'); miniEl.className = 'fx-mini'; miniEl.title = 'Clique para ir até um ponto'; }
    return miniEl;
  }
  function renderMinimap() {                              // rebuild dos nós (barato: N pequeno)
    if (!miniEl || !canvas) return;
    var b = activeBoard(), s = MINI_W / CANVAS_W;
    miniEl.style.width = MINI_W + 'px';
    miniEl.style.height = Math.round(CANVAS_H * s) + 'px';
    miniEl.innerHTML = b.nodes.map(function (n) {
      var t = TYPES[n.type] || TYPES.processo;
      var el = cardEl(n.id), h = (el && el.offsetHeight) || 90;   // offsetHeight = altura no modelo (transform não afeta layout)
      return '<i class="fx-mini-node" style="left:' + (n.x * s) + 'px;top:' + (n.y * s) +
             'px;width:' + (NODE_W * s) + 'px;height:' + (h * s) +
             'px;background:' + (n.color || t.color) + '"></i>';
    }).join('') + '<div class="fx-mini-view"></div>';
    updateMiniViewport();
  }
  function updateMiniViewport() {                         // reposiciona só o retângulo da viewport (barato p/ scroll)
    if (!miniEl) return;
    var wrap = root && root.querySelector('.fx-canvas-wrap'), view = miniEl.querySelector('.fx-mini-view');
    if (!wrap || !view) return;
    var s = MINI_W / CANVAS_W;
    view.style.left = (wrap.scrollLeft / zoom * s) + 'px';
    view.style.top = (wrap.scrollTop / zoom * s) + 'px';
    view.style.width = (wrap.clientWidth / zoom * s) + 'px';
    view.style.height = (wrap.clientHeight / zoom * s) + 'px';
  }
  function centerOn(mx, my) {                             // centra a viewport no ponto de modelo (mx,my)
    var wrap = root && root.querySelector('.fx-canvas-wrap'); if (!wrap) return;
    wrap.scrollLeft = Math.max(0, mx * zoom - wrap.clientWidth / 2);   // browser clampa no máximo; scroll dispara updateMiniViewport
    wrap.scrollTop = Math.max(0, my * zoom - wrap.clientHeight / 2);
  }
  function fitView() {                                    // enquadra todos os nós
    var b = activeBoard(), wrap = root && root.querySelector('.fx-canvas-wrap');
    if (!wrap || !b.nodes.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    b.nodes.forEach(function (n) {
      var el = cardEl(n.id), h = (el && el.offsetHeight) || 90;
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + h);
    });
    var pad = 60;
    zoom = fitZoom(maxX - minX + pad * 2, maxY - minY + pad * 2, wrap.clientWidth, wrap.clientHeight, ZOOM_MIN, ZOOM_MAX);
    applyZoom();
    centerOn((minX + maxX) / 2, (minY + maxY) / 2);
  }
  function fitSkillsOnce() {
    var b = activeBoard(), wrap = root && root.querySelector('.fx-canvas-wrap');
    if (b.template !== SKILLS_TEMPLATE || skillsFittedId === b.id || !wrap || !wrap.clientWidth || !wrap.clientHeight) return;
    fitView();
    skillsFittedId = b.id;
  }
  function resetView() {                                  // 100% + volta ao canto (0,0)
    var wrap = root && root.querySelector('.fx-canvas-wrap');
    zoom = 1; applyZoom();
    if (wrap) { wrap.scrollLeft = 0; wrap.scrollTop = 0; }
    updateMiniViewport();
  }

  // ── Execução client-side dos nós de Código (Web Worker sandbox, sem rede) ─────
  // ponytail: sandbox de intenção — bloqueia fetch/XHR/WS; não é jail à prova de bala, cumpre "sem integrações externas".
  var WORKER_SRC =
    'self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.importScripts=undefined;' +
    'self.onmessage=function(e){' +
    ' try{' +
    '  var input=e.data.input,$json=input;' +
    '  var out=(new Function("input","$json",e.data.code))(input,$json);' +
    '  Promise.resolve(out).then(function(v){self.postMessage({ok:true,output:v});},' +
    '   function(err){self.postMessage({ok:false,error:String(err&&err.message||err)});});' +
    ' }catch(err){self.postMessage({ok:false,error:String(err&&err.message||err)});}' +
    '};';

  function runCodeNode(code, input, timeoutMs) {
    return new Promise(function (resolve) {
      var url, worker, done = false, timer;
      function finish(res) {
        if (done) return; done = true; clearTimeout(timer);
        try { worker.terminate(); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {}
        resolve(res);
      }
      try {
        url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
        worker = new Worker(url);
      } catch (e) {
        resolve({ ok: false, error: 'Execução precisa de http://localhost (não file://): ' + (e.message || e) });
        return;
      }
      worker.onmessage = function (ev) { finish(ev.data); };
      worker.onerror = function (ev) { finish({ ok: false, error: ev.message || 'erro no worker' }); };
      timer = setTimeout(function () { finish({ ok: false, error: 'timeout ' + timeoutMs + 'ms (loop infinito?)' }); }, timeoutMs);
      worker.postMessage({ code: code, input: input });
    });
  }

  function seedFor(n) { if (n.type === 'inicio') { try { return JSON.parse(n.body); } catch (e) {} } return {}; }

  function preview(v) {
    var s; try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { s = String(v); }
    if (s == null) s = String(v);
    return s.length > 240 ? s.slice(0, 240) + '…' : s;
  }

  function markNodeState(id, state, result) {
    var el = canvas && canvas.querySelector('.fx-node[data-id="' + id + '"]'); if (!el) return;
    el.classList.remove('fx-run-running', 'fx-run-ok', 'fx-run-error', 'fx-run-skip');
    el.classList.add('fx-run-' + state);
    var out = el.querySelector('.fx-node-result');
    if (state === 'running') { if (out) out.remove(); return; }
    if (!out) { out = document.createElement('div'); out.className = 'fx-node-result'; el.appendChild(out); }
    if (state === 'skip') { out.className = 'fx-node-result fx-node-result--skip'; out.textContent = '⊘ ramo não tomado'; return; }
    if (result && result.ok) { out.className = 'fx-node-result fx-node-result--ok'; out.textContent = (result.passthrough ? '→ ' : '✓ ') + preview(result.output); }
    else { out.className = 'fx-node-result fx-node-result--err'; out.textContent = '✗ ' + (result ? result.error : 'erro'); }
  }

  var running = false;
  function runFlow() {
    if (running || !canvas) return;
    var b = activeBoard();
    var order = execOrder(b);
    var byId = {}; b.nodes.forEach(function (n) { byId[n.id] = n; });
    var incoming = {}; b.nodes.forEach(function (n) { incoming[n.id] = []; });
    b.edges.forEach(function (e) { if (byId[e.to] && byId[e.from]) incoming[e.to].push(e); });
    var hasBranch = {};   // Decisão só executa/roteia se tiver ao menos 1 saída rotulada (V/F)
    b.edges.forEach(function (e) { if (e.branch === true || e.branch === false) hasBranch[e.from] = true; });
    Array.prototype.forEach.call(canvas.querySelectorAll('.fx-node-result'), function (x) { x.remove(); });
    Array.prototype.forEach.call(canvas.querySelectorAll('.fx-node'), function (x) { x.classList.remove('fx-run-running', 'fx-run-ok', 'fx-run-error', 'fx-run-skip'); });
    var btn = root.querySelector('.fx-run-btn');
    var outputs = {}, active = {}, decisions = {};
    running = true; if (btn) { btn.disabled = true; btn.textContent = '▶ Executando…'; }
    (async function () {
      for (var i = 0; i < order.length; i++) {
        var id = order[i], n = byId[id];
        var inEdges = incoming[id];
        active[id] = inEdges.length === 0 ? true
          : inEdges.some(function (e) { return active[e.from] && edgeTaken(b, e, decisions); });
        if (!active[id]) { markNodeState(id, 'skip'); continue; }   // ramo não seguido — não executa (BP-008: estado visível)
        var ins = inEdges.filter(function (e) { return active[e.from] && edgeTaken(b, e, decisions); })
                         .map(function (e) { return outputs[e.from]; })
                         .filter(function (v) { return v !== undefined; });
        var input = ins.length === 0 ? seedFor(n) : (ins.length === 1 ? ins[0] : ins);
        if (n.type === 'codigo') {
          markNodeState(id, 'running');
          var res = await runCodeNode(n.body || '', input, 3000);
          outputs[id] = res.ok ? res.output : undefined;
          markNodeState(id, res.ok ? 'ok' : 'error', res);
        } else if (n.type === 'decisao' && hasBranch[id]) {
          markNodeState(id, 'running');
          var dres = await runCodeNode(n.body || '', input, 3000);
          if (dres.ok) {
            decisions[id] = !!dres.output;
            outputs[id] = input;   // dados seguem; o booleano só escolhe o ramo
            markNodeState(id, 'ok', { ok: true, output: 'ramo → ' + (decisions[id] ? 'VERDADEIRO' : 'FALSO') });
          } else {
            decisions[id] = null;  // erro → nenhum ramo rotulado é seguido
            outputs[id] = undefined;
            markNodeState(id, 'error', dres);
          }
        } else {
          outputs[id] = input;
          markNodeState(id, 'ok', { ok: true, output: input, passthrough: true });
        }
      }
      running = false; if (btn) { btn.disabled = false; btn.textContent = '▶ Executar'; }
    })();
  }

  // ── Cliques (toolbar / delete) e edição inline ──────────────────────────────
  function onClick(e) {
    var mini = e.target.closest('.fx-mini');
    if (mini) {                                           // clique no minimapa navega até o ponto
      var mr = mini.getBoundingClientRect(), ms = CANVAS_W / MINI_W;
      centerOn((e.clientX - mr.left) * ms, (e.clientY - mr.top) * ms);
      return;
    }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'add':      addNode(act.dataset.type); break;
      case 'note-new': addNoteHere(); break;
      case 'note-del': deleteNoteFrom(activeBoard(), act.closest('.fx-note').dataset.note); save(); renderKeepingScroll(); break;
      case 'node-del': deleteNodeFrom(activeBoard(), act.closest('.fx-node').dataset.id); if (editingId === act.closest('.fx-node').dataset.id) editingId = null; save(); renderKeepingScroll(); break;
      case 'node-dup': if (duplicateNode(activeBoard(), act.closest('.fx-node').dataset.id)) { save(); render(); } break;
      case 'node-edit': editingId = act.closest('.fx-node').dataset.id; syncPanel(); break;
      case 'panel-close': editingId = null; syncPanel(); break;
      case 'edge-del': activeBoard().edges.splice(parseInt(act.dataset.edge, 10), 1); save(); redrawEdges(); refreshCode(); break;
      case 'code-toggle': toggleCodePanel(act); break;
      case 'code-close': toggleCodePanel(root.querySelector('.fx-code-toggle')); break;
      case 'act-new':  actNew(); break;
      case 'act-ren':  actRename(act.dataset.actId); break;
      case 'act-up':   actMove(act.dataset.actId, -1); break;
      case 'act-down': actMove(act.dataset.actId, 1); break;
      case 'act-collapse': var ck = act.dataset.actId || 'orphan'; codeCollapsed[ck] = !codeCollapsed[ck]; refreshCode(); break;
      case 'code-copy': codeCopy(act); break;
      case 'board-new': boardNew(); break;
      case 'skills-map': openSkillsMap(); break;
      case 'board-ren': boardRename(); break;
      case 'board-del': boardDelete(); break;
      case 'board-export': exportBoard(); break;
      case 'board-import': var fi = root.querySelector('.fx-import-file'); if (fi) fi.click(); break;
      case 'board-paste': var t = prompt('Cole o JSON do quadro:'); if (t) importBoardFromText(t); break;
      case 'run':       runFlow(); break;
      case 'zoom-in':    setZoom(zoom * 1.2); break;
      case 'zoom-out':   setZoom(zoom / 1.2); break;
      case 'zoom-reset': setZoom(1); break;
      case 'fit-view':   fitView(); break;
      case 'reset-view': resetView(); break;
      case 'undo':       undo(); break;
      case 'redo':       redo(); break;
    }
  }

  function onInput(e) {
    var cls = e.target.classList;
    if (cls.contains('fx-panel-title') || cls.contains('fx-panel-body') || cls.contains('fx-panel-note')) {
      var pn = editingId ? nodeById(activeBoard(), editingId) : null; if (!pn) return;
      if (cls.contains('fx-panel-title')) { pn.title = e.target.value; setCardVal(editingId, '.fx-node-title', pn.title); paintCode(cardEl(editingId), pn); syncPanelHighlight(pn); refreshCode(); }
      else if (cls.contains('fx-panel-body')) { pn.body = e.target.value; setCardVal(editingId, '.fx-node-body', pn.body); paintCode(cardEl(editingId), pn); syncPanelHighlight(pn); refreshCode(); }
      else { pn.note = e.target.value; }   // bloco de notas: só no modelo, não afeta card nem Código final
      save(); return;   // painel escreve no modelo e espelha no card, sem re-render
    }
    var noteHost = e.target.closest('.fx-note');
    if (noteHost) {
      var sn = noteById(activeBoard(), noteHost.dataset.note); if (!sn) return;
      if (e.target.classList.contains('fx-note-body')) sn.text = e.target.value;
      else if (e.target.classList.contains('fx-note-color')) { sn.color = e.target.value; noteHost.style.setProperty('--nc', sn.color); }
      save(); return;   // nota escreve no modelo sem re-render (preserva foco)
    }
    var nEl = e.target.closest('.fx-node'); if (!nEl) return;
    var n = nodeById(activeBoard(), nEl.dataset.id); if (!n) return;
    if (cls.contains('fx-node-title')) { n.title = e.target.value; paintCode(nEl, n); refreshCode(); }   // linguagem vem do nome do arquivo
    else if (cls.contains('fx-node-body')) { n.body = e.target.value; paintCode(nEl, n); refreshCode(); }
    if (editingId && editingId === nEl.dataset.id) syncPanel();   // espelha a edição do card no painel aberto
    save(); // sem re-render → não perde o foco do campo
  }

  function onChange(e) {
    if (e.target.classList.contains('fx-panel-act')) {   // trocar a atividade do card pelo painel de edição
      var pa = editingId ? nodeById(activeBoard(), editingId) : null; if (!pa) return;
      var v = e.target.value;
      if (v === '__new__') {
        var nm = prompt('Nome da nova atividade:', 'Atividade ' + ((activeBoard().activities || []).length + 1));
        if (nm == null) { syncPanel(); return; }         // cancelou → restaura o valor do select
        pa.activity = addActivity(activeBoard(), nm).id;
      } else if (v) pa.activity = v;
      else delete pa.activity;
      save(); renderKeepingScroll();                     // atualiza badge do card + Código final, sem saltar a tela
      return;
    }
    if (e.target.classList.contains('fx-import-file')) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { importBoardFromText(String(reader.result)); };
      reader.readAsText(f);
      e.target.value = '';   // permite reimportar o mesmo arquivo
      return;
    }
    if (!e.target.classList.contains('fx-board-sel')) return;
    DB.active = e.target.value; save(); render();
    fitSkillsOnce();
  }

  // Teclado sobre um nó: Ctrl/Cmd+D duplica; Delete exclui SÓ quando o card (não um campo) está focado.
  function onKey(e) {
    if (e.key === 'Escape' && editingId) { editingId = null; syncPanel(); return; }   // Esc fecha o painel
    // auto-indentação nos editores de código (modal e card): Enter mantém o recuo; após ':' recua mais um nível
    if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.classList &&
        (e.target.classList.contains('fx-panel-body') || e.target.classList.contains('fx-mono'))) {
      var ta = e.target, s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      var insert = autoIndent(v.slice(v.lastIndexOf('\n', s - 1) + 1, s));
      e.preventDefault();
      if (!document.execCommand || !document.execCommand('insertText', false, insert)) {
        ta.value = v.slice(0, s) + insert + v.slice(en);            // fallback (não integra ao undo nativo)
        ta.selectionStart = ta.selectionEnd = s + insert.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    // undo/redo — mas num campo de texto deixa o undo NATIVO agir (não sequestra Ctrl+Z do textarea)
    var ae = document.activeElement;
    var typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    var active = document.activeElement;
    var nEl = active && active.closest ? active.closest('.fx-node') : null;
    if (!nEl) return;
    var b = activeBoard();
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (duplicateNode(b, nEl.dataset.id)) { save(); render(); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Del') && active === nEl) {
      e.preventDefault();
      if (editingId === nEl.dataset.id) editingId = null;
      deleteNodeFrom(b, nEl.dataset.id); save(); renderKeepingScroll();
    }
  }

  function addNode(type) {
    var b = activeBoard();
    var wrap = root.querySelector('.fx-canvas-wrap');
    var sx = wrap ? wrap.scrollLeft / zoom : 0, sy = wrap ? wrap.scrollTop / zoom : 0;
    var k = b.nodes.length % 6;
    b.nodes.push({ id: uid(), type: type, title: (TYPES[type] || {}).label || 'Nó', body: '', x: sx + 40 + k * 26, y: sy + 40 + k * 26 });
    save(); render();
  }

  function addNoteHere() {
    var wrap = root.querySelector('.fx-canvas-wrap');
    var sx = wrap ? wrap.scrollLeft / zoom : 0, sy = wrap ? wrap.scrollTop / zoom : 0;
    addNote(activeBoard(), sx + 40, sy + 40); save(); render();
  }

  // ponytail: prompt()/confirm() bastam p/ ferramenta pessoal; troca por input inline se incomodar
  function boardNew() {
    var name = prompt('Nome do novo quadro:', 'Novo fluxo');
    if (name == null) return;
    var b = { id: uid('b'), name: name.trim() || 'Novo fluxo', nodes: [], edges: [] };
    DB.boards.push(b); DB.active = b.id; save(); render();
  }
  function openSkillsMap() {
    var b = DB.boards.filter(function (board) { return board.template === SKILLS_TEMPLATE; })[0];
    if (!b) { b = skillsBoard(); DB.boards.push(b); }
    DB.skillsTemplateV1 = true;
    DB.active = b.id;
    editingId = null;
    codePanelOpen = false;
    zoom = 1;
    save();
    render();
    fitSkillsOnce();
  }
  function boardRename() {
    var b = activeBoard();
    var name = prompt('Renomear quadro:', b.name);
    if (name == null) return;
    b.name = name.trim() || b.name; save(); render();
  }
  function boardDelete() {
    if (DB.boards.length <= 1) { alert('Deixe pelo menos um quadro.'); return; }
    var b = activeBoard();
    if (!confirm('Excluir o quadro "' + b.name + '"? Isso apaga os nós dele.')) return;
    DB.boards = DB.boards.filter(function (x) { return x.id !== b.id; });
    DB.active = DB.boards[0].id; save(); render();
  }

  // ── Importar / Exportar quadro como JSON ────────────────────────────────────
  // boardFromJSON é PURO (sem DOM) — usa uid()/TYPES, testável via require.
  function boardFromJSON(text) {
    var raw = JSON.parse(text);                       // lança se JSON inválido
    var src = raw && raw.board ? raw.board : raw;      // aceita {board:{…}} ou o board cru
    if (!src || !Array.isArray(src.nodes) || !Array.isArray(src.edges)) {
      throw new Error('JSON não é um quadro (faltam nodes/edges).');
    }
    var acts = Array.isArray(src.activities)
      ? src.activities.filter(Boolean).map(function (a) { return { id: a.id ? String(a.id) : uid('a'), name: a.name != null ? String(a.name) : 'Atividade' }; })
      : [];
    var actIds = {}; acts.forEach(function (a) { actIds[a.id] = true; });
    var nodes = src.nodes.map(function (n) {
      n = n || {};
      var node = {
        id: n.id ? String(n.id) : uid(),
        type: TYPES[n.type] ? n.type : 'processo',
        title: n.title != null ? String(n.title) : 'Nó',
        body: n.body != null ? String(n.body) : '',
        x: isFinite(n.x) ? +n.x : 40,
        y: isFinite(n.y) ? +n.y : 40
      };
      if (n.color) node.color = String(n.color);
      if (n.lang) node.lang = String(n.lang);
      if (n.note != null) node.note = String(n.note);
      if (n.activity != null && actIds[String(n.activity)]) node.activity = String(n.activity);  // só se a atividade existe
      return node;
    });
    var ids = {}; nodes.forEach(function (n) { ids[n.id] = true; });
    var edges = src.edges
      .filter(function (e) { return e && ids[e.from] && ids[e.to]; })  // descarta arestas órfãs
      .map(function (e) { var o = { from: String(e.from), to: String(e.to) }; if (e.branch === true || e.branch === false) o.branch = e.branch; return o; });
    var notes = Array.isArray(src.notes) ? src.notes.filter(Boolean).map(function (s) {
      return {
        id: s.id ? String(s.id) : uid('s'),
        x: isFinite(s.x) ? +s.x : 40, y: isFinite(s.y) ? +s.y : 40,
        w: isFinite(s.w) ? +s.w : 220, h: isFinite(s.h) ? +s.h : 140,
        text: s.text != null ? String(s.text) : '',
        color: s.color ? String(s.color) : '#fdd663'
      };
    }) : [];
    return { id: uid('b'), name: src.name ? String(src.name) : 'Importado', activities: acts, notes: notes, nodes: nodes, edges: edges };
  }

  function exportBoard() {
    var b = activeBoard();
    var text = JSON.stringify({ name: b.name, activities: b.activities || [], notes: b.notes || [], nodes: b.nodes, edges: b.edges }, null, 2);
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url; a.download = (b.name || 'quadro').replace(/[^\w\-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function importBoardFromText(text) {
    var b;
    try { b = boardFromJSON(text); }
    catch (err) { alert('Importação falhou: ' + err.message); return; }
    DB.boards.push(b); DB.active = b.id; save(); render();
  }

  function mount() {
    root = document.getElementById('fluxos-root');
    if (!root) return;
    DB = load();
    histPrev = JSON.stringify(DB);   // baseline p/ o 1º passo já ser desfazível
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('contextmenu', onContextMenu);
    root.addEventListener('scroll', updateMiniViewport, true);  // captura: 'scroll' não borbulha; segue o pan/scroll do wrap
    render();
    fitSkillsOnce();
  }

  // chamado por activateView('fluxos') — redesenha as conexões quando a aba fica visível
  if (typeof window !== 'undefined') window.fluxosRefresh = function () { if (root) { redrawEdges(); fitSkillsOnce(); } };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { seedBoard: seedBoard, skillsBoard: skillsBoard, addEdgeTo: addEdgeTo, deleteNodeFrom: deleteNodeFrom, execOrder: execOrder, boardFromJSON: boardFromJSON, duplicateNode: duplicateNode, edgeTaken: edgeTaken, activeNodes: activeNodes, addActivity: addActivity, activityOrder: activityOrder, composeCode: composeCode, highlightCode: highlightCode, langFromTitle: langFromTitle, autoIndent: autoIndent, fitZoom: fitZoom, rectIntersects: rectIntersects, groupDelta: groupDelta, makeHistory: makeHistory, addNote: addNote, deleteNoteFrom: deleteNoteFrom };
  }
})();
