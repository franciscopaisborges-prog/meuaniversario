/**
 * Servidor estático local (sem dependências) para desenvolvimento e testes.
 * Uso: node tests/server.mjs [porta]   → http://127.0.0.1:5173
 */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
const BLOCKED = [/^\/node_modules\//, /^\/tests\//, /^\/tools\//, /^\/\./];

export function startServer(port = 5173, extraHeaders = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";
      if (BLOCKED.some((re) => re.test(pathname))) {
        res.writeHead(404).end("Not found");
        return;
      }
      const file = normalize(join(ROOT, pathname));
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not file");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        ...extraHeaders,
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.argv[2] || 5173);
  await startServer(port);
  console.log(`Site local em http://127.0.0.1:${port}/  (admin: /admin.html)`);
  console.log("Para usar os emuladores Firebase: acrescente ?emulators=1 ao endereço.");
}
