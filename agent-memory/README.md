# agent-memory

Shared **persistent vector memory** for your Claude Code agents. Any agent —
interactive or the headless `claude.exe -p` ones on the Windows Scheduler — can
save a note and any other agent can semantically recall it later. Local
embeddings (no API key, offline), one JSONL file on disk, exposed as an MCP
server so every agent sees the tools automatically.

> Dev-time tooling — **not part of the site**. `index.html` never loads this;
> it has its own `package.json` and does not touch the site's npm-free rule.

## Install

```powershell
cd agent-memory
npm install
npm run warmup   # optional: pre-downloads the ~90MB embedding model once
npm test         # verifies the store logic (fast, no model needed)
```

## Register with Claude Code

```powershell
# user scope = available in every project on this machine (recommended for shared memory)
claude mcp add agent-memory --scope user -- node "C:/Users/Teste/Downloads/Seller-Arthur/agent-memory/server.mjs"
```

Restart Claude Code. Agents now have two tools:

- **`memory_remember`** — save a fact/decision/note (optional `tags`).
- **`memory_recall`** — semantic search; returns the top-k closest past notes.

## Storage

- Default file: `~/.agent-memory/memories.jsonl` (machine-global → shared across
  all projects and agents). Override with the `AGENT_MEMORY_FILE` env var.
- Append-only JSONL: `{ id, ts, text, meta, vec[384] }` per line.
- Embeddings: `all-MiniLM-L6-v2`, 384-dim, L2-normalized (cosine == dot product).

## Scaling ceiling

Recall is a brute-force cosine scan that re-reads the whole file each call
(so concurrent agents always see each other's writes). Great to ~10k memories.
Past that, swap the scan for `sqlite-vec` / HNSW — the `makeStore` API stays the
same.
