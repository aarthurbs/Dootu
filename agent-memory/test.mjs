import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeStore } from './memory.mjs';

// Fake embedder: 3-dim unit vectors keyed by a word. Deterministic, no 90MB model
// needed — this checks the store logic (persistence, cosine ranking, guards), not
// the embedding quality (that's the model's job).
function fakeEmbed(text) {
  const t = text.toLowerCase();
  if (t.includes('cat')) return Promise.resolve([1, 0, 0]);
  if (t.includes('dog')) return Promise.resolve([0, 1, 0]);
  return Promise.resolve([0, 0, 1]);
}

const file = path.join(os.tmpdir(), `agent-mem-test-${process.pid}.jsonl`);
fs.rmSync(file, { force: true });

const store = makeStore(file, fakeEmbed);
await store.remember('the cat sat on the mat', { tags: ['animal'] });
await store.remember('a dog barked loudly');

// recall ranks the semantically-closest first
const hits = await store.recall('feline pet cat', 2);
assert.equal(hits[0].text, 'the cat sat on the mat', 'cat query surfaces the cat memory first');
assert.equal(hits[0].meta.tags[0], 'animal', 'metadata persisted');
assert.ok(hits[0].score > hits[1].score, 'scores ordered descending');

// persistence: a fresh store over the same file still sees prior memories
// (proves it survives a process restart — the "between agents" property)
const store2 = makeStore(file, fakeEmbed);
const hits2 = await store2.recall('dog', 1);
assert.equal(hits2[0].text, 'a dog barked loudly', 'memory survived restart (on disk)');

// dim guard: a query of a different length must not crash recall
const store3 = makeStore(file, () => Promise.resolve([1, 0]));
const safe = await store3.recall('anything', 5);
assert.ok(Array.isArray(safe) && safe.length === 0, 'mismatched dims skipped, no throw');

fs.rmSync(file, { force: true });
console.log('OK — all memory store checks passed');
