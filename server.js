import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;

// Supported MIME types for static assets
const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // 1. Apply Hardened Security Headers (Best practice for public repos)
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; img-src 'self' data:; connect-src 'self';"
  );

  // Parse and normalize file path
  let parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath = parsedUrl.pathname;
  if (safePath === "/") {
    safePath = "/index.html";
  }

  const filePath = path.join(__dirname, safePath);
  const relativePath = path.relative(__dirname, filePath);
  
  // 2. Prevent Directory Traversal Vulnerability (Security compliance check)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");
    res.end("403 Forbidden: Access denied.");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html");
        res.end("<h1>404 Not Found</h1><p>The requested resource was not found on this server.</p>");
      } else {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      res.statusCode = 200;
      res.setHeader("Content-Type", contentType);
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[EcoTrace] Server successfully launched at http://localhost:${PORT}`);
});
