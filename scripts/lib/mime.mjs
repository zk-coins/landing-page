// MIME types the dev server serves. Pure lookup table + resolver, unit-tested to
// 100% in test/site-checks.test.mjs.

const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

export const DEFAULT_MIME = 'application/octet-stream';

// Content-type for a file path or a bare extension. An unknown or extensionless
// name falls back to a generic binary type rather than guessing.
export function mimeFor(pathOrExt) {
  const dot = pathOrExt.lastIndexOf('.');
  const ext = dot === -1 ? pathOrExt : pathOrExt.slice(dot);
  const type = MIME.get(ext.toLowerCase());
  return type === undefined ? DEFAULT_MIME : type;
}
