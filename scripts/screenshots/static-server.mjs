// Server statico minimo per servire il gioco in locale durante test e screenshot.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

export function startStaticServer({ root = process.cwd(), port = 0 } = {}) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let path = normalize(decodeURIComponent(url.pathname));
      if (path.endsWith("/")) path += "index.html";
      const file = join(base, path);
      if (!file.startsWith(base)) throw new Error("fuori dalla radice");
      const info = await stat(file);
      if (!info.isFile()) throw new Error("non e' un file");
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404");
    }
  });
  return new Promise((ok) => {
    server.listen(port, "127.0.0.1", () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}
