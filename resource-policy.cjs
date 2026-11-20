// Only the Portable Puzzle Collection compiles bundled WebAssembly modules.
module.exports = function htmlPolicy(puzzle) {
  return [
    "default-src 'self'",
    "script-src 'self'" + (puzzle ? " 'wasm-unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "media-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'none'",
  ].join("; ");
};
