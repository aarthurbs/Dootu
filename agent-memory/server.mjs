import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import { makeStore } from './memory.mjs';
import { makeEmbedder } from './embed.mjs';

// Machine-global by default so EVERY agent (interactive + headless) shares one store.
const DATA_FILE = process.env.AGENT_MEMORY_FILE
  || path.join(os.homedir(), '.agent-memory', 'memories.jsonl');

const embed = await makeEmbedder();
const store = makeStore(DATA_FILE, embed);

const server = new McpServer({ name: 'agent-memory', version: '0.1.0' });

server.registerTool(
  'memory_remember',
  {
    description: 'Save a fact, decision, or note to shared long-term memory so any agent can recall it later. Use for durable knowledge, not scratch data.',
    inputSchema: {
      text: z.string().describe('The fact or note to remember (one self-contained sentence works best).'),
      tags: z.array(z.string()).optional().describe('Optional labels, e.g. ["pricing","decision"].'),
    },
  },
  async ({ text, tags }) => {
    const { id } = await store.remember(text, { tags: tags || [] });
    return { content: [{ type: 'text', text: `Remembered (id ${id}).` }] };
  },
);

server.registerTool(
  'memory_recall',
  {
    description: 'Semantic search over shared long-term memory. Returns the most relevant past notes for a query.',
    inputSchema: {
      query: z.string().describe('What you want to remember about.'),
      k: z.number().int().min(1).max(20).optional().describe('How many results (default 5).'),
    },
  },
  async ({ query, k }) => {
    const hits = await store.recall(query, k || 5);
    const text = hits.length
      ? hits.map((h) => {
          const tags = h.meta?.tags?.length ? ` [${h.meta.tags.join(', ')}]` : '';
          return `• (${h.score.toFixed(3)}) ${h.text}${tags}`;
        }).join('\n')
      : 'No memories found.';
    return { content: [{ type: 'text', text }] };
  },
);

await server.connect(new StdioServerTransport());
