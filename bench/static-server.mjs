import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.map':  'application/json'
};

export function serveDir(root, port) {
  const base = resolve(root);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      let full = join(base, p);
      if (!full.startsWith(base)) { res.writeHead(403).end(); return; }
      try {
        const s = await stat(full);
        if (s.isDirectory()) full = join(full, 'index.html');
      } catch {
        full = join(base, 'index.html'); // SPA fallback
      }
      const buf = await readFile(full);
      res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) {
      res.writeHead(404).end(String(e));
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}
