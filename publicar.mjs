// Monta dist/ — a pasta que a hospedagem publica — só com o que o index.html carrega.
// A lista sai do próprio index.html (todo <script src> e <link href> local) + a pasta assets/:
// script novo entra sozinho, e nada além disso vai ao ar (docs, vídeos, testes, motor, .env).
// Uso: node publicar.mjs — a Vercel roda isto a cada push (vercel.json; ver PASSO-A-PASSO.md).
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const locais = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
  .map(m => m[1].split(/[?#]/)[0])
  .filter(u => !/^([a-z]+:|\/\/)/i.test(u) && !u.startsWith('assets/'));

rmSync('dist', { recursive: true, force: true });
const copiados = [];
for (const f of new Set(['index.html', 'assets', ...locais])) {
  if (!existsSync(f)) {
    console.warn(`AVISO: o index.html pede "${f}", que não existe — fica fora (também falta no site local).`);
    continue;
  }
  cpSync(f, `dist/${f}`, { recursive: true });
  copiados.push(f);
}
console.log(`dist/ pronto com ${copiados.length} itens: ${copiados.join(', ')}`);
