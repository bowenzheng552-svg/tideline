// 生产部署用启动脚本：监听云平台注入的 PORT 与 0.0.0.0，并正确透传 Origin 以通过 worker 的同源校验。
// 本地试玩仍用 scripts/play.mjs，不依赖此文件。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = { ...process.env };
for (const file of ['.env', '.env.local', '.dev.vars']) {
  try { Object.assign(env, parseEnv(await readFile(resolve(root, file), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

const worker = (await import(pathToFileURL(resolve(root, 'dist/server/index.js')))).default;
const port = Number(process.env.PORT) || 3000;
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `127.0.0.1:${port}`;
    const request = new Request(`${proto}://${host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(body ? { body } : {}),
    });
    const result = await worker.fetch(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Server error');
  }
});
server.listen(port, '0.0.0.0', () => console.log(`tideline listening on ${port}`));
