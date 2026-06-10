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
  // 1. Validate HTTP request method (Only allow safe static content retrieval methods)
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Allow", "GET, HEAD");
    res.end("405 Method Not Allowed: Only GET and HEAD methods are supported.");
    return;
  }

  // 2. Validate request URL format and filter malicious payloads (Null bytes)
  if (req.url.includes("\0") || req.url.includes("%00")) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("400 Bad Request: Null bytes are prohibited.");
    return;
  }

  // 3. Apply Hardened Security Headers (Best practice for production environments)
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com; script-src 'self'; img-src 'self' data:; connect-src 'self';"
  );

  // Parse and normalize file path
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("400 Bad Request: Invalid URL structure.");
    return;
  }

  let safePath = parsedUrl.pathname;
  if (safePath === "/") {
    safePath = "/index.html";
  }

  const filePath = path.join(__dirname, safePath);
  const resolvedPath = path.resolve(filePath);
  const relativePath = path.relative(__dirname, resolvedPath);
  
  // 4. Prevent Directory Traversal Vulnerability (Security compliance check)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !resolvedPath.startsWith(__dirname)) {
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
