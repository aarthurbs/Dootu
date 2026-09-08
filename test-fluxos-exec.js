// Testa a ordem de execução topológica (execOrder) — puro, sem DOM.
var fx = require('./fluxos.js');
function assert(c, m) { if (!c) { console.error('FALHOU: ' + m); process.exit(1); } }

// linear A->B->C
var lin = { nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] };
assert(fx.execOrder(lin).join(',') === 'a,b,c', 'linear a,b,c (got ' + fx.execOrder(lin).join(',') + ')');

// diamante A->B, A->C, B->D, C->D : A primeiro, D por último, 4 nós
var dia = { nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }], edges: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'B', to: 'D' }, { from: 'C', to: 'D' }] };
var od = fx.execOrder(dia);
assert(od.length === 4 && od[0] === 'A' && od[3] === 'D', 'diamante A..D (got ' + od.join(',') + ')');
assert(od.indexOf('B') < od.indexOf('D') && od.indexOf('C') < od.indexOf('D'), 'B e C antes de D');

// ciclo y<->z não trava; só a raiz x sai
var cyc = { nodes: [{ id: 'x' }, { id: 'y' }, { id: 'z' }], edges: [{ from: 'x', to: 'y' }, { from: 'y', to: 'z' }, { from: 'z', to: 'y' }] };
var oc = fx.execOrder(cyc);
assert(oc.length === 1 && oc[0] === 'x', 'ciclo não trava, só x (got ' + oc.join(',') + ')');

// nós soltos (sem aresta) todos entram
var solt = { nodes: [{ id: 'p' }, { id: 'q' }], edges: [] };
assert(fx.execOrder(solt).length === 2, 'nós soltos entram');

// boardFromJSON (importar): valida, normaliza e descarta arestas órfãs; dá id de board novo
var imp = fx.boardFromJSON(JSON.stringify({
  name: 'X',
  nodes: [{ id: 'a', type: 'codigo', title: 'T', body: 'x', x: 10, y: 20 }, { id: 'b' }],
  edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'zzz' }]  // 2ª aresta é órfã
}));
assert(imp.name === 'X' && imp.nodes.length === 2, 'boardFromJSON preserva nome e nós');
assert(/^b/.test(imp.id), 'boardFromJSON gera id de board novo (prefixo b)');
assert(imp.edges.length === 1 && imp.edges[0].to === 'b', 'boardFromJSON descarta aresta órfã');
assert(imp.nodes[1].type === 'processo' && imp.nodes[1].x === 40, 'boardFromJSON aplica defaults (type/x)');
var threw = false; try { fx.boardFromJSON('{"foo":1}'); } catch (e) { threw = true; }
assert(threw, 'boardFromJSON rejeita JSON sem nodes/edges');

// duplicateNode: cópia com id novo, deslocada, mesmos campos; preserva color/lang
var db = { nodes: [{ id: 'src', type: 'codigo', title: 'T', body: 'x=1', x: 100, y: 50, color: '#abc', lang: 'JavaScript' }], edges: [] };
var cp = fx.duplicateNode(db, 'src');
assert(cp && cp.id !== 'src', 'duplicateNode gera id novo');
assert(db.nodes.length === 2, 'duplicateNode adiciona ao board');
assert(cp.x === 126 && cp.y === 76, 'duplicateNode desloca +26,+26');
assert(cp.title === 'T' && cp.body === 'x=1' && cp.color === '#abc' && cp.lang === 'JavaScript', 'duplicateNode copia campos');
assert(fx.duplicateNode(db, 'naoexiste') === null, 'duplicateNode retorna null p/ id inexistente');

// Item 3 — Decisão com 2 saídas: addEdgeTo grava branch V/F; edgeTaken/activeNodes podam o ramo errado
var brd = { nodes: [{ id: 'd', type: 'decisao' }, { id: 't' }, { id: 'f' }], edges: [] };
assert(fx.addEdgeTo(brd, 'd', 't', true) === true && brd.edges[0].branch === true, 'addEdgeTo grava branch true');
assert(fx.addEdgeTo(brd, 'd', 'f', false) === true && brd.edges[1].branch === false, 'addEdgeTo grava branch false');
var brdU = { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] };
fx.addEdgeTo(brdU, 'a', 'b');
assert(!('branch' in brdU.edges[0]), 'aresta sem branch não ganha o campo');

var dboard = { nodes: [{ id: 'i' }, { id: 'd', type: 'decisao' }, { id: 't' }, { id: 'f' }],
  edges: [{ from: 'i', to: 'd' }, { from: 'd', to: 't', branch: true }, { from: 'd', to: 'f', branch: false }] };
var aT = fx.activeNodes(dboard, { d: true });
assert(aT.d === true && aT.t === true && aT.f === false, 'decisão true → só ramo V ativo');
var aF = fx.activeNodes(dboard, { d: false });
assert(aF.t === false && aF.f === true, 'decisão false → só ramo F ativo');
var aN = fx.activeNodes(dboard, { d: null });
assert(aN.t === false && aN.f === false, 'decisão indefinida → nenhum ramo rotulado ativo');
assert(fx.edgeTaken(dboard, dboard.edges[1], { d: true }) === true && fx.edgeTaken(dboard, dboard.edges[1], { d: false }) === false, 'edgeTaken respeita o booleano da Decisão');
assert(fx.edgeTaken(dboard, dboard.edges[0], {}) === true, 'aresta sem rótulo é sempre seguida');
var impB = fx.boardFromJSON(JSON.stringify({ nodes: [{ id: 'd', type: 'decisao' }, { id: 't' }], edges: [{ from: 'd', to: 't', branch: true }] }));
assert(impB.edges.length === 1 && impB.edges[0].branch === true, 'boardFromJSON preserva branch da aresta');

// ── Atividades + "Código final" (composeCode / activityOrder) ────────────────
// 1) atividade com um único card → sem aviso, 1 bloco, código = corpo
var b1 = { activities: [{ id: 'a1', name: 'A1' }], nodes: [{ id: 'c1', type: 'codigo', body: 'x=1', activity: 'a1' }], edges: [] };
var r1 = fx.composeCode(b1);
assert(r1.length === 1 && r1[0].name === 'A1' && !r1[0].warning, 'composeCode: 1 grupo sem aviso');
assert(r1[0].blocks.length === 1 && r1[0].blocks[0].code === 'x=1', 'card único: código = corpo');

// 2) dois cards conectados na ordem correta → junta com LINHA EM BRANCO
var b2 = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c1', type: 'codigo', body: 'a=1', activity: 'a1' }, { id: 'c2', type: 'codigo', body: 'b=2', activity: 'a1' }],
  edges: [{ from: 'c1', to: 'c2' }] };
var r2 = fx.composeCode(b2)[0];
assert(r2.order.join(',') === 'c1,c2', 'dois cards: ordem c1,c2');
assert(r2.blocks[0].code === 'a=1\n\nb=2', 'dois cards: linha em branco entre trechos');

// 3) ordem vem das CONEXÕES, não da posição visual/ordem no array (c2 antes no array, x maior em c1)
var b3 = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c2', type: 'codigo', body: 'segundo', activity: 'a1', x: 10 }, { id: 'c1', type: 'codigo', body: 'primeiro', activity: 'a1', x: 999 }],
  edges: [{ from: 'c1', to: 'c2' }] };
var r3 = fx.composeCode(b3)[0];
assert(r3.order.join(',') === 'c1,c2' && r3.blocks[0].code === 'primeiro\n\nsegundo', 'ordem pelas conexões, não pela posição');
var b3b = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c1', type: 'codigo', body: 'um', activity: 'a1' }, { id: 'p', type: 'processo' }, { id: 'c2', type: 'codigo', body: 'dois', activity: 'a1' }],
  edges: [{ from: 'c1', to: 'p' }, { from: 'p', to: 'c2' }] };
assert(fx.composeCode(b3b)[0].order.join(',') === 'c1,c2', 'ordem atravessa nó intermediário não-atividade');

// 4) excluir um card atualiza o código final
var b4 = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c1', type: 'codigo', body: 'a', activity: 'a1' }, { id: 'c2', type: 'codigo', body: 'b', activity: 'a1' }],
  edges: [{ from: 'c1', to: 'c2' }] };
assert(fx.composeCode(b4)[0].blocks[0].code === 'a\n\nb', 'antes do delete: 2 trechos');
fx.deleteNodeFrom(b4, 'c2');
var r4 = fx.composeCode(b4)[0];
assert(r4.count === 1 && r4.blocks[0].code === 'a', 'após delete: só resta c1');

// 5) dados antigos SEM atividade → grupo "Sem atividade"; id de atividade inválido também
var r5 = fx.composeCode({ nodes: [{ id: 'c1', type: 'codigo', body: 'legado' }], edges: [] });
assert(r5.length === 1 && r5[0].name === 'Sem atividade' && r5[0].blocks[0].code === 'legado', 'card legado → "Sem atividade"');
var r5b = fx.composeCode({ activities: [{ id: 'a1', name: 'A1' }], nodes: [{ id: 'c1', type: 'codigo', body: 'x', activity: 'zzz' }], edges: [] });
assert(r5b.some(function (g) { return g.name === 'Sem atividade' && g.count === 1; }), 'activity id inválido → "Sem atividade"');
assert(r5b.some(function (g) { return g.id === 'a1' && g.empty; }), 'atividade sem cards marcada empty');

// 6) importar/exportar preserva atividades e node.activity; activity órfã é descartada
var impA = fx.boardFromJSON(JSON.stringify({ name: 'Q', activities: [{ id: 'a1', name: 'Ativ 1' }], nodes: [{ id: 'c1', type: 'codigo', body: 'z', x: 1, y: 2, activity: 'a1' }], edges: [] }));
assert(impA.activities.length === 1 && impA.activities[0].name === 'Ativ 1', 'boardFromJSON preserva activities');
assert(impA.nodes[0].activity === 'a1', 'boardFromJSON preserva node.activity');
var impB = fx.boardFromJSON(JSON.stringify({ activities: [], nodes: [{ id: 'c1', type: 'codigo', activity: 'ghost' }], edges: [] }));
assert(!('activity' in impB.nodes[0]), 'boardFromJSON descarta activity órfã');

// 7) cards desconectados OU ramificação → aviso de ordem ambígua (não escolhe ordem silenciosamente)
var b7 = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c1', type: 'codigo', body: 'a', activity: 'a1' }, { id: 'c2', type: 'codigo', body: 'b', activity: 'a1' }], edges: [] };
assert(fx.composeCode(b7)[0].warning === 'disconnected', 'cards soltos → aviso disconnected');
var b7b = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c1', type: 'codigo', activity: 'a1' }, { id: 'c2', type: 'codigo', activity: 'a1' }, { id: 'c3', type: 'codigo', activity: 'a1' }],
  edges: [{ from: 'c1', to: 'c2' }, { from: 'c1', to: 'c3' }] };
assert(fx.composeCode(b7b)[0].warning === 'branch', 'ramificação → aviso branch');
assert(fx.activityOrder(b7, ['c1', 'c2']).ok === false, 'activityOrder: desconectado não-ok');
assert(fx.activityOrder({ nodes: [{ id: 'c1' }], edges: [] }, ['c1']).ok === true, 'activityOrder: card único ok');

// 8) linguagens diferentes numa atividade → blocos separados (não mistura)
var b8 = { activities: [{ id: 'a1', name: 'A1' }],
  nodes: [{ id: 'c1', type: 'codigo', title: 'a.py', body: 'print(1)', activity: 'a1' }, { id: 'c2', type: 'codigo', title: 'b.js', body: 'console.log(1)', activity: 'a1' }],
  edges: [{ from: 'c1', to: 'c2' }] };
var r8 = fx.composeCode(b8)[0];
assert(r8.mixed === true && r8.blocks.length === 2, 'linguagens diferentes → 2 blocos, mixed=true');
assert(r8.blocks[0].lang === 'Python' && r8.blocks[1].lang === 'JavaScript', 'blocos separados por linguagem na ordem');

// 8b) linguagem vem do NOME do arquivo (como no VS Code) + bloco de notas persiste
assert(fx.langFromTitle('scanner.py') === 'Python', 'langFromTitle: .py → Python');
assert(fx.langFromTitle('app.JS') === 'JavaScript', 'langFromTitle: extensão maiúscula → JavaScript');
assert(fx.langFromTitle('notas') === 'Texto' && fx.langFromTitle('') === 'Texto', 'langFromTitle: sem extensão → Texto');
var bn = fx.boardFromJSON(JSON.stringify({ nodes: [{ id: 'c1', type: 'codigo', title: 't.py', body: 'x', note: 'minha nota' }], edges: [] }));
assert(bn.nodes[0].note === 'minha nota', 'boardFromJSON preserva node.note (bloco de notas)');

// 8c) auto-indentação do editor (Enter)
assert(fx.autoIndent('for x in y:') === '\n    ', 'autoIndent: após ":" recua um nível (4 espaços)');
assert(fx.autoIndent('    senha = 1') === '\n    ', 'autoIndent: mantém o recuo da linha atual');
assert(fx.autoIndent('        if a:') === '\n            ', 'autoIndent: recuo existente + nível após ":"');
assert(fx.autoIndent('x = 1') === '\n', 'autoIndent: linha comum → só quebra de linha');

// 9) seed traz a atividade de exemplo e o card marcado
var sb = fx.seedBoard();
assert(Array.isArray(sb.activities) && sb.activities.length === 1, 'seed: 1 atividade de exemplo');
assert(sb.nodes.some(function (n) { return n.activity === sb.activities[0].id; }), 'seed: card marcado com a atividade');

// 10) realce de sintaxe por linguagem, mantendo o conteúdo seguro
var py = fx.highlightCode('porta = int(input("Porta: "))\nprint(porta) # resultado', 'Python');
assert(py.includes('fx-syn-builtin">int</span>'), 'Python: int destacado');
assert(py.includes('fx-syn-builtin">input</span>'), 'Python: input destacado');
assert(py.includes('fx-syn-builtin">print</span>'), 'Python: print destacado');
assert(py.includes('fx-syn-string">&quot;Porta: &quot;</span>') && py.includes('fx-syn-comment"># resultado</span>'), 'Python: string e comentário destacados');
assert(fx.highlightCode('const porta = 443;', 'JavaScript').includes('fx-syn-keyword">const</span>'), 'JavaScript: palavra-chave destacada');
assert(fx.highlightCode('Write-Host $porta', 'PowerShell').includes('fx-syn-builtin">Write-Host</span>'), 'PowerShell: comando destacado');
assert(fx.highlightCode('echo "$porta"', 'Bash').includes('fx-syn-builtin">echo</span>'), 'Bash: comando destacado');
assert(fx.highlightCode('SELECT count(*) FROM portas', 'SQL').includes('fx-syn-keyword">SELECT</span>'), 'SQL: palavra-chave destacada');
assert(fx.highlightCode('<button>OK</button>', 'HTML').includes('fx-syn-tag">&lt;button&gt;</span>'), 'HTML: tag destacada');
assert(fx.highlightCode('{"porta": 80}', 'JSON').includes('fx-syn-key">&quot;porta&quot;</span>'), 'JSON: chave destacada');
var safe = fx.highlightCode('<script>alert(1)</script>', 'Texto');
assert(!safe.includes('<script>') && safe.includes('&lt;script&gt;'), 'realce nunca injeta HTML do usuário');

// 11) fitZoom — enquadrar: escolhe o menor lado, respeita [zmin,zmax] e degenera com segurança
assert(fx.fitZoom(1000, 500, 500, 500, 0.4, 2) === 0.5, 'fitZoom escolhe o eixo mais apertado (500/1000)');
assert(fx.fitZoom(100, 100, 500, 500, 0.4, 2) === 2, 'fitZoom nunca passa de zmax');
assert(fx.fitZoom(10000, 10000, 500, 500, 0.4, 2) === 0.4, 'fitZoom nunca fica abaixo de zmin');
assert(fx.fitZoom(0, 100, 500, 500, 0.4, 2) === 1, 'fitZoom com bbox degenerada volta 1 (sem divisão inválida)');

// 12) rectIntersects — box-select: sobreposição vs. fora, e toque de borda não conta como cruzamento
assert(fx.rectIntersects(0, 0, 100, 100, 50, 50, 100, 100) === true,  'rectIntersects detecta sobreposição');
assert(fx.rectIntersects(0, 0, 10, 10, 100, 100, 10, 10) === false, 'rectIntersects: retângulos distantes não cruzam');
assert(fx.rectIntersects(0, 0, 10, 10, 10, 0, 10, 10) === false, 'rectIntersects: só encostar a borda não é cruzar');

// 13) groupDelta — arraste em grupo: trava p/ o canto sup-esq. do grupo não passar de 0
assert(fx.groupDelta(-30, -40, 10, 20).dx === -10 && fx.groupDelta(-30, -40, 10, 20).dy === -20, 'groupDelta trava o delta negativo em -min');
assert(fx.groupDelta(50, 60, 10, 20).dx === 50 && fx.groupDelta(50, 60, 10, 20).dy === 60, 'groupDelta não mexe em delta positivo (longe da borda)');

// 14) makeHistory — motor de undo/redo: push/undo/redo, teto e limpeza do redo em nova ação
var H = fx.makeHistory(2);
assert(H.canUndo() === false && H.canRedo() === false, 'makeHistory começa vazio');
H.push('A');
assert(H.canUndo() === true, 'após push há o que desfazer');
assert(H.undo('B') === 'A', 'undo devolve o estado anterior (A)');
assert(H.canRedo() === true && H.redo('A') === 'B', 'redo devolve o estado desfeito (B)');
var H2 = fx.makeHistory(2);
H2.push('s1'); H2.push('s2'); H2.push('s3');
assert(H2.undo('cur') === 's3' && H2.undo('s3') === 's2' && H2.undo('s2') === null, 'makeHistory respeita o teto (o mais antigo cai)');
var H3 = fx.makeHistory(5);
H3.push('x'); H3.undo('y');
assert(H3.canRedo() === true, 'redo disponível após undo');
H3.push('z');
assert(H3.canRedo() === false, 'push (nova ação) limpa a pilha de redo');

// 15) addNote / deleteNoteFrom — notas/sticky (frames de agrupamento)
var nb = { id: 'b', nodes: [], edges: [] };
var note = fx.addNote(nb, 120, 80);
assert(nb.notes.length === 1 && note.w === 220 && note.h === 140 && note.color === '#fdd663', 'addNote cria nota com defaults (220×140, amarelo)');
assert(note.x === 120 && note.y === 80, 'addNote respeita a posição passada');
var note2 = fx.addNote(nb, 'x', null);   // args inválidos caem no default 40,40
assert(note2.x === 40 && note2.y === 40, 'addNote sanitiza posição inválida p/ 40,40');
fx.deleteNoteFrom(nb, note.id);
assert(nb.notes.length === 1 && nb.notes[0].id === note2.id, 'deleteNoteFrom remove só a nota alvo');
fx.deleteNoteFrom({ id: 'x', nodes: [], edges: [] }, 'qualquer');   // board sem notes não estoura

// 16) boardFromJSON — preserva/sanitiza notas no round-trip
var imp = fx.boardFromJSON(JSON.stringify({ name: 'T', nodes: [], edges: [], notes: [
  { id: 's1', x: 10, y: 20, w: 300, h: 90, text: 'grupo', color: '#6ea8fe' },
  { text: 'sem geometria' }   // faltando campos → defaults
] }));
assert(imp.notes.length === 2, 'boardFromJSON mantém as notas');
assert(imp.notes[0].w === 300 && imp.notes[0].text === 'grupo' && imp.notes[0].color === '#6ea8fe', 'boardFromJSON preserva a nota completa');
assert(imp.notes[1].w === 220 && imp.notes[1].h === 140 && imp.notes[1].color === '#fdd663', 'boardFromJSON completa a nota parcial com defaults');
assert(fx.boardFromJSON(JSON.stringify({ nodes: [], edges: [] })).notes.length === 0, 'boardFromJSON sem notes → array vazio');

console.log('OK — test-fluxos-exec: todos os asserts passaram');
