/* Check mínimo do modelo de Fluxos (BP-011). Rode: node test-fluxos.js */
const assert = require('assert');
const { seedBoard, skillsBoard, addEdgeTo, deleteNodeFrom } = require('./fluxos.js');

const b = seedBoard();
assert.strictEqual(b.nodes.length, 5, 'seed deve ter 5 nós');
assert.strictEqual(b.edges.length, 4, 'seed deve ter 4 conexões');

const a = b.nodes[0].id, c = b.nodes[2].id;
assert.strictEqual(addEdgeTo(b, a, a), false, 'não permite auto-loop');
assert.strictEqual(addEdgeTo(b, b.nodes[0].id, b.nodes[1].id), false, 'não duplica conexão existente');
assert.strictEqual(addEdgeTo(b, a, 'inexistente'), false, 'rejeita nó que não existe');
assert.strictEqual(addEdgeTo(b, a, c), true, 'aceita conexão nova e válida');
assert.strictEqual(b.edges.length, 5);

const before = b.edges.length;
deleteNodeFrom(b, c);
assert.ok(!b.nodes.some(n => n.id === c), 'nó foi removido');
assert.ok(!b.edges.some(e => e.from === c || e.to === c), 'conexões incidentes foram removidas');
assert.ok(b.edges.length < before, 'contagem de conexões caiu');

assert.deepStrictEqual(JSON.parse(JSON.stringify(b)), b, 'round-trip JSON (persistência) preserva o board');

const skills = skillsBoard();
assert.strictEqual(skills.template, 'skills-project-path-v1', 'mapa de skills tem identificador estável');
assert.strictEqual(skills.templateVersion, 2, 'mapa de skills usa o layout compacto atual');
assert.ok(['Agent Reach', 'Open Design', '4. Superpowers', '5. ECC'].every(title =>
  skills.nodes.some(n => n.title === title)
), 'mapa inclui as quatro famílias de skills');
assert.ok(skills.edges.some(e => e.branch === true) && skills.edges.some(e => e.branch === false), 'mapa separa caminhos por decisões');
assert.ok(skills.nodes.every(n => n.x >= 0 && n.y >= 0 && n.x + 240 <= 2600), 'cards cabem no canvas');

console.log('OK — test-fluxos: todos os asserts passaram');
