// Lane V (W5-V9): the production-header check. Serves a built `dist` the way vercel.json routes it — every header route
// that matches (the Content-Security-Policy, nosniff, frame options, cache), the `dest` rewrites, `handle: filesystem`,
// the SPA routes and the final 404 — and collects every CSP violation the browser reports and every request that did
// not end in 200 / 304.
//
//   node scripts/opus-sf/qa/csp-serve.mjs --dir <dist> [--port 5517] [--vercel vercel.json] [--spa /opus-bay] [--log <file.json>]
//
//   --spa <path>   also serve index.html for this path (an SPA route vercel.json does not list; reported as such)
//   --log <file>   on exit (Ctrl-C / SIGTERM / GET /__csp-done): { violations, failed, served, spaHits } as JSON
//
// The CSP header is served exactly as vercel.json has it, plus `report-uri /__csp-report` (reporting only: it changes
// no decision), so the browser POSTs each violation here; `GET /__csp-stats` returns the tallies so far.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const DIR = path.resolve(args.dir ?? 'dist');
const PORT = Number(args.port ?? 5517);
const vercel = JSON.parse(fs.readFileSync(args.vercel ?? 'vercel.json', 'utf8'));
const SPA = [].concat(args.spa ?? []).filter(s => typeof s === 'string');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.gif': 'image/gif', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.obc': 'application/octet-stream', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

const stats = { violations: [], failed: [], served: 0, spaHits: 0, started: new Date().toISOString() };

/** The file for a URL path in DIR (a directory → its index.html), or null. */
function fileFor(p) {
  const clean = decodeURIComponent(p.split('?')[0]);
  const f = path.join(DIR, clean);
  if (!f.startsWith(DIR)) return null;
  try {
    const st = fs.statSync(f);
    if (st.isFile()) return f;
    if (st.isDirectory() && fs.existsSync(path.join(f, 'index.html'))) return path.join(f, 'index.html');
  } catch { /* not there */ }
  return null;
}

/** vercel.json's routes for one request: headers, the file to serve (or null), the status. */
function route(urlPath) {
  const headers = {};
  let p = urlPath.split('?')[0];
  let status = 200;
  let phase = 'pre';
  for (const r of vercel.routes) {
    if (r.handle === 'filesystem') {
      phase = 'post';
      const f = fileFor(p);
      if (f) return { headers, file: f, status };
      continue;
    }
    const m = new RegExp(r.src).exec(p);
    if (!m) continue;
    Object.assign(headers, r.headers ?? {});
    if (r.dest) {
      const dest = r.dest.replace(/\$(\d+)/g, (_, i) => m[Number(i)] ?? '');
      if (r.status) status = r.status;
      if (dest.startsWith('/api/')) return { headers, file: null, status: 501, note: `serverless ${dest}` };
      p = dest.split('?')[0];
      if (phase === 'post' || !r.continue) return { headers, file: fileFor(p), status };
    } else if (!r.continue) break;
  }
  return { headers, file: null, status: 404 };
}

const server = http.createServer((req, res) => {
  const u = req.url ?? '/';
  if (u.startsWith('/__csp-report')) {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const r = JSON.parse(body)['csp-report'] ?? JSON.parse(body);
        stats.violations.push({ at: new Date().toISOString(), directive: r['violated-directive'] ?? r['effective-directive'], blocked: r['blocked-uri'], source: r['source-file'], line: r['line-number'] });
        console.log(JSON.stringify({ csp: stats.violations.at(-1) }));
      } catch { stats.violations.push({ raw: body.slice(0, 400) }); }
      res.writeHead(204); res.end();
    });
    return;
  }
  if (u.startsWith('/__csp-stats')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ...stats, violations: stats.violations.length, failed: stats.failed.length, list: { violations: stats.violations, failed: stats.failed } })); return; }
  if (u.startsWith('/__csp-done')) { res.writeHead(200); res.end('bye'); finish(); return; }
  let r = route(u);
  const spa = !r.file && SPA.some(s => u.split('?')[0].replace(/\/$/, '') === s);
  if (spa) { r = { ...route('/index.html'), headers: route(u).headers, status: 200 }; stats.spaHits++; }
  const headers = { ...r.headers };
  if (headers['Content-Security-Policy']) headers['Content-Security-Policy'] += '; report-uri /__csp-report';
  if (r.status >= 400) stats.failed.push({ url: u, status: r.status, note: r.note });
  if (!r.file) {
    if (r.status < 400) stats.failed.push({ url: u, status: 404, note: r.note });
    res.writeHead(r.status === 200 ? 404 : r.status, { ...headers, 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  const type = MIME[path.extname(r.file).toLowerCase()] ?? 'application/octet-stream';
  const st = fs.statSync(r.file);
  const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ...headers, ETag: etag }); res.end(); return; }
  stats.served++;
  res.writeHead(r.status, { ...headers, 'Content-Type': type, 'Content-Length': st.size, ETag: etag });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(r.file).pipe(res);
});

function finish() {
  const out = { ...stats, dir: DIR, spa: SPA, finished: new Date().toISOString() };
  if (args.log) fs.writeFileSync(args.log, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ done: true, violations: stats.violations.length, failed: stats.failed.length, served: stats.served, spaHits: stats.spaHits }));
  server.close();
  setTimeout(() => process.exit(0), 200);
}
process.on('SIGINT', finish);
process.on('SIGTERM', finish);
server.listen(PORT, () => console.log(JSON.stringify({ listening: `http://localhost:${PORT}`, dir: DIR, spa: SPA })));
