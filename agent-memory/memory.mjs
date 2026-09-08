import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ponytail: brute-force cosine over an append-only JSONL file. O(n) per recall,
// whole file re-read each call so concurrent agent processes always see each
// other's writes (the file is the only shared truth). Fine to ~10k memories;
// swap for sqlite-vec / HNSW when recall latency actually bites.

export function makeStore(filePath, embed) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  function readAll() {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  async function remember(text, meta = {}) {
    const vec = await embed(text);
    const item = { id: crypto.randomUUID(), ts: new Date().toISOString(), text, meta, vec };
    // ponytail: single-line append assumed atomic (single-user scale).
    // Add a lockfile if two agents ever interleave writes on the same file.
    fs.appendFileSync(filePath, JSON.stringify(item) + '\n');
    return { id: item.id };
  }

  async function recall(query, k = 5) {
    const q = await embed(query);
    const scored = [];
    for (const it of readAll()) {
      if (!Array.isArray(it.vec) || it.vec.length !== q.length) continue; // dim guard (embedder changed)
      scored.push({ id: it.id, ts: it.ts, text: it.text, meta: it.meta, score: dot(q, it.vec) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  return { remember, recall, readAll };
}

// vectors are L2-normalized on write → dot product == cosine similarity
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
