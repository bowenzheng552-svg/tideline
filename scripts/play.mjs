import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const localEnv = { ...process.env };
try { Object.assign(localEnv, parseEnv(await readFile(resolve(root, '.env.local'), 'utf8'))); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const worker = (await import(pathToFileURL(resolve(root, 'dist/server/index.js')))).default;
const server = createServer(async (req, res) => {
  try {
    const body = []; for await (const chunk of req) body.push(chunk);
    const request = new Request('http://127.0.0.1:4173' + req.url, { method: req.method, headers: req.headers, ...(body.length ? { body: Buffer.concat(body) } : {}) });
    const result = await worker.fetch(request, localEnv);
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Local server error'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
