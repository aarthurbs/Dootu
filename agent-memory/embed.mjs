import { pipeline } from '@huggingface/transformers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Local, offline sentence embeddings (all-MiniLM-L6-v2, 384-dim, L2-normalized).
// First call downloads ~90MB to the HF cache; every call after is offline.
let _pipe;
export async function makeEmbedder() {
  if (!_pipe) {
    _pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return async (text) => {
    const out = await _pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(out.data);
  };
}

// `npm run warmup` (node embed.mjs) → pre-downloads the model so a scheduled
// headless agent never pays the download mid-task.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const embed = await makeEmbedder();
  const v = await embed('warmup');
  console.log(`model ready — ${v.length}-dim embeddings`);
}
