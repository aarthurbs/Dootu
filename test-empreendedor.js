// test-empreendedor.js — checa a lógica pura do Painel do Empreendedor.
// Roda em node: `node test-empreendedor.js` (sem DOM; empreendedor.js pula o init).
const assert = require('assert');
const E = require('./empreendedor.js');

// ── seed determinístico ──────────────────────────────────────────────
const s = E.seed('2026-07-31');
assert.ok(Array.isArray(s.trilhos) && s.trilhos.length === 6, 'seed tem 6 trilhos');
assert.strictEqual(s.meta.start, '2026-07-31', 'start respeita o argumento');
assert.strictEqual(s.meta.dias, 90, 'meta.dias = 90');
assert.strictEqual(s.clientes, 0, 'clientes começa em 0');
s.trilhos.forEach(function (t) {
  assert.ok(t.id && t.nome, 'trilho tem id e nome');
  assert.ok(Array.isArray(t.etapas) && t.etapas.length > 0, 'trilho tem etapas');
  assert.ok(Array.isArray(t.log), 'trilho tem log (array)');
  t.etapas.forEach(function (e) {
    assert.ok(e.id && typeof e.txt === 'string' && e.done === false, 'etapa bem formada');
  });
});
const ids = s.trilhos.map(function (t) { return t.id; });
assert.strictEqual(new Set(ids).size, ids.length, 'ids de trilho são únicos');

// ── progresso (com guarda-zero, BP-004) ──────────────────────────────
assert.strictEqual(E.progresso({ etapas: [] }), 0, 'progresso 0 etapas = 0 (sem NaN)');
assert.strictEqual(E.progresso({ etapas: [{ done: true }, { done: false }] }), 0.5, 'progresso 1/2 = 0.5');
assert.strictEqual(E.progresso({ etapas: [{ done: true }, { done: true }] }), 1, 'progresso 2/2 = 1');

// ── status derivado ──────────────────────────────────────────────────
assert.strictEqual(E.statusOf({ etapas: [] }), 'a fazer', '0 etapas = a fazer');
assert.strictEqual(E.statusOf({ etapas: [{ done: false }, { done: false }] }), 'a fazer', 'nenhuma feita = a fazer');
assert.strictEqual(E.statusOf({ etapas: [{ done: true }, { done: false }] }), 'fazendo', 'parcial = fazendo');
assert.strictEqual(E.statusOf({ etapas: [{ done: true }, { done: true }] }), 'feito', 'todas = feito');

// ── diasInfo (linha do tempo, com clamp) ─────────────────────────────
const meta = { start: '2026-07-31', dias: 90 };
const d0 = E.diasInfo(meta, '2026-07-31');
assert.strictEqual(d0.decorridos, 0, 'no start: 0 decorridos');
assert.strictEqual(d0.restantes, 90, 'no start: 90 restantes');
const d10 = E.diasInfo(meta, '2026-08-10');
assert.strictEqual(d10.decorridos, 10, '10 dias depois = 10 decorridos');
assert.strictEqual(d10.restantes, 80, '10 dias depois = 80 restantes');
const dpast = E.diasInfo(meta, '2027-01-01');
assert.strictEqual(dpast.decorridos, 90, 'passou de 90 → clamp em 90');
assert.strictEqual(dpast.restantes, 0, 'passou de 90 → 0 restantes');
const dbefore = E.diasInfo(meta, '2026-07-01');
assert.strictEqual(dbefore.decorridos, 0, 'antes do start → clamp em 0');

console.log('ok — test-empreendedor: todos os asserts passaram');
