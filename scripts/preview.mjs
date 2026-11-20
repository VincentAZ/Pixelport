import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import htmlPolicy from "../resource-policy.cjs";
const root = fileURLToPath(new URL("../app/", import.meta.url));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (
      !path.startsWith(resolve(root) + sep) ||
      (await stat(path)).isDirectory()
    )
      throw Error();
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      ...(extname(path) === ".html" && {
        "Content-Security-Policy": htmlPolicy(
          path.startsWith(resolve(root, "vendor/puzzles") + sep),
        ),
      }),
    });
    createReadStream(path)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(
  Number(process.env.PORT) || 5173,
  process.env.HOST || "127.0.0.1",
  () => console.log("Pixelport preview ready"),
);
