// Minimal static file server used by the Playwright suite (and `npm run serve`).
// Serves the repo root for the local test suite: '/' -> index.html, a directory
// -> its index.html, everything else by path. (It does not apply the Cloudflare
// Pages .assetsignore exclusions — the tests only ever request the deployed
// pages.) Path resolution and MIME lookup live in the unit-tested scripts/lib
// helpers so the server itself stays a thin, side-effecting shell.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './lib/pages.mjs';
import { pathnameToRelFile } from './lib/site-checks.mjs';
import { mimeFor } from './lib/mime.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = process.env.PORT ? Number(process.env.PORT) : PORT;

function send(response, status, body = '') {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Method Not Allowed');
    return;
  }

  const pathname = new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname;
  const rel = pathnameToRelFile(pathname);
  if (rel === null) {
    send(response, 400, 'Bad Request');
    return;
  }

  let filePath = resolve(join(root, rel));
  if (!filePath.startsWith(root)) {
    send(response, 400, 'Bad Request');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(response, 404, 'Not Found');
    return;
  }

  response.writeHead(200, { 'content-type': mimeFor(filePath) });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
