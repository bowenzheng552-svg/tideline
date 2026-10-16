import { build } from 'esbuild';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const app = await build({ entryPoints: [resolve(root, 'src/app.js')], bundle: true, minify: true, format: 'esm', write: false, target: ['es2022'], legalComments: 'none' });
const files = {
  '/': ['text/html; charset=utf-8', await readFile(resolve(root, 'src/index.html'), 'utf8')],
  '/style.css': ['text/css; charset=utf-8', await readFile(resolve(root, 'src/style.css'), 'utf8')],
  '/app.js': ['text/javascript; charset=utf-8', app.outputFiles[0].text]
};
const api = await readFile(resolve(root, 'worker/api.js'), 'utf8');
const worker = api + '\nconst assets = ' + JSON.stringify(files) + ';\nexport default { async fetch(request, env = {}) { const url = new URL(request.url); if (url.pathname.startsWith("/api/")) return handleApi(request, env); if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", {status: 405}); const asset = assets[url.pathname]; if (!asset) return new Response("Not found", {status: 404}); return new Response(request.method === "HEAD" ? null : asset[1], {headers: {"Content-Type": asset[0], "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "Cache-Control": "no-cache"}}); } };\n';
await mkdir(resolve(root, 'dist/server'), { recursive: true });
await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await writeFile(resolve(root, 'dist/server/index.js'), worker);
await copyFile(resolve(root, '.openai/hosting.json'), resolve(root, 'dist/.openai/hosting.json'));
console.log('Built self-contained Worker with 3D scene and chat API.');
