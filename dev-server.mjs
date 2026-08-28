/* Servidor local simples para testar o site.
   Uso:  node dev-server.mjs      →  http://localhost:5173          */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = join(ROOT, normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate'
    }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>404</h1>');
  }
}).listen(PORT, () => console.log('Sunset Pod rodando em http://localhost:' + PORT));
