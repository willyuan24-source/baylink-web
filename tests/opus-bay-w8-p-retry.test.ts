import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 8 · lane P part b: every lazy chunk loads through game/importRetry.ts; a chunk lost by two callers is fetched
 * again once (one module instance); a chunk lost for good shows the reload card (game/chunkLost.ts); a resume no longer
 * waits up to 12 s on a lost discovery chunk.
 */

const CHROME = (url: string) => new TypeError(`Failed to fetch dynamically imported module: ${url}`);
const URL_A = 'https://www.baylink.us/assets/discovery-Ab12Cd34.js';

test('W8-P5: two callers of one lost chunk share one retry and one module instance; a later caller takes the recovered module at once', async () => {
  const { importRetry } = await import('../src/opus-bay/game/importRetry');
  const memo = new Map();
  const waits: number[] = [], urls: string[] = [];
  const mod = { quietNextDiscovery() { /* the module */ } };
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const opts = { memo, sleep: async (ms: number) => { waits.push(ms); await gate; }, importUrl: async (u: string) => { urls.push(u); return mod; } };
  const lost = () => Promise.reject(CHROME(URL_A));
  // the Overlay's boot and a resume both meet the lost chunk while the first retry waits
  const a = importRetry(lost, opts), b = importRetry(lost, opts);
  await new Promise(r => setTimeout(r, 0));
  release();
  const [ma, mb] = await Promise.all([a, b]);
  assert.equal(ma, mod);
  assert.equal(mb, ma, 'the same module instance');
  assert.deepEqual(urls, [`${URL_A}?retry=1`], 'one fetch for both callers (before W8-P5: one ?retry= chain each — two instances when they landed on different n)');
  assert.deepEqual(waits, [1000], 'one wait');
  // a later caller (the QA map, a second resume) meets the same failed URL: the recovered module, no wait, no fetch
  const c = await importRetry(lost, opts);
  assert.equal(c, mod);
  assert.deepEqual(waits, [1000]);
  assert.deepEqual(urls, [`${URL_A}?retry=1`]);
});

test('W8-P5: a chunk lost for good tells the chunk-lost listeners once (not for a quiet prefetch, not for an error the module threw); quiet and loud callers of one chunk: loud wins', async () => {
  const { importRetry, onChunkLost } = await import('../src/opus-bay/game/importRetry');
  const seen: unknown[] = [];
  const off = onChunkLost(e => { seen.push(e); });
  try {
    const memo = new Map();
    const fail = { memo, sleep: async () => {}, importUrl: async (u: string) => { throw CHROME(u); } };
    const lost = () => Promise.reject(CHROME('https://www.baylink.us/assets/claw-x.js'));
    await Promise.all([assert.rejects(importRetry(lost, fail)), assert.rejects(importRetry(lost, fail))]);
    assert.equal(seen.length, 1, 'one card for one lost chunk, however many callers');
    // a prefetch nobody waits for
    const lost2 = () => Promise.reject(CHROME('https://www.baylink.us/assets/crab-y.js'));
    await assert.rejects(importRetry(lost2, { ...fail, quiet: true }));
    assert.equal(seen.length, 1, 'quiet: no card');
    // a quiet prefetch and a loud press of the same chunk: the press shows the card
    const lost3 = () => Promise.reject(CHROME('https://www.baylink.us/assets/dough-z.js'));
    await Promise.all([assert.rejects(importRetry(lost3, { ...fail, quiet: true })), assert.rejects(importRetry(lost3, fail))]);
    assert.equal(seen.length, 2);
    // the module's own error: thrown at once, never a card
    await assert.rejects(importRetry(() => Promise.reject(new TypeError("Cannot read properties of undefined (reading 'x')")), fail), /Cannot read/);
    assert.equal(seen.length, 2);
    // Safari (no URL in the message): lost for good tells the listeners too
    await assert.rejects(importRetry(() => Promise.reject(new TypeError('Importing a module script failed.')), { sleep: async () => {} }));
    assert.equal(seen.length, 3);
  } finally { off(); }
});

test('W8-P5: the chunk-lost card — once per page, in the reader\'s language, 重新载入 writes the save first, 先继续玩 closes it', async () => {
  const { showChunkLostCard, resetChunkLostForTests, chunkLostCard, CHUNK_LOST_TEXT } = await import('../src/opus-bay/game/chunkLost');
  type El = { className: string; textContent: string; type?: string; children: El[]; attrs: Record<string, string>; listeners: Record<string, () => void>; removed: boolean; append(...c: El[]): void; setAttribute(k: string, v: string): void; addEventListener(k: string, f: () => void): void; remove(): void; focus(): void };
  const make = (): El => {
    const el: El = { className: '', textContent: '', children: [], attrs: {}, listeners: {}, removed: false,
      append(...c) { el.children.push(...c); }, setAttribute(k, v) { el.attrs[k] = v; }, addEventListener(k, f) { el.listeners[k] = f; }, remove() { el.removed = true; }, focus() {} };
    return el;
  };
  const page = make();
  const doc = { createElement: () => make(), querySelector: (q: string) => (q === '.ob-page' ? page : null), body: make() } as unknown as Document;
  resetChunkLostForTests();
  let reloads = 0;
  assert.equal(showChunkLostCard(doc, () => { reloads++; }), true);
  assert.equal(showChunkLostCard(doc, () => { reloads++; }), false, 'once per page');
  const card = page.children[0];
  assert.equal(card, chunkLostCard() as unknown as El);
  assert.match(card.className, /ob-gl-lost/);
  assert.equal(card.attrs.role, 'alertdialog');
  const box = card.children[0];
  const [title, body, reload, later] = box.children;
  assert.ok([CHUNK_LOST_TEXT.zh.title, CHUNK_LOST_TEXT.en.title, CHUNK_LOST_TEXT.hant.title].includes(title.textContent));
  assert.ok(body.textContent.length > 10);
  reload.listeners.click();
  assert.equal(reloads, 1);
  later.listeners.click();
  assert.equal(card.removed, true);
  for (const t of Object.values(CHUNK_LOST_TEXT)) assert.ok(t.title && t.body && t.reload && t.later);
  assert.doesNotMatch(CHUNK_LOST_TEXT.en.title + CHUNK_LOST_TEXT.en.body + CHUNK_LOST_TEXT.en.reload + CHUNK_LOST_TEXT.en.later, /[㐀-鿿]/, 'English never shows Chinese');
  resetChunkLostForTests();
});

test('W8-P5: every relative dynamic import() in src/opus-bay loads through importRetry — wrap a new one as importRetry(() => import(\'./x\'))', () => {
  const root = path.resolve('src/opus-bay');
  // not wrapped on purpose: the helper itself; the frozen feature index (game/w5Features.ts, the lead's: sf-w8-P.md
  // Requests); the tiny goTo hook (type imports only, tests/opus-bay-w5-nav.test.ts W5-N1)
  const EXEMPT = new Set(['game/importRetry.ts', 'game/w5Features.ts', 'game/goTo.ts']);
  const files: string[] = [];
  (function walk(d: string) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p); } })(root);
  const bare: string[] = [];
  const RE = /(?<!importRetry\(\(\) => )(?<!typeof )\bimport\((['"])(\.{1,2}\/[^'"]+)\1\)/g;
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    if (EXEMPT.has(rel)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const t = line.trimStart();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || line.includes('__opusBay') || line.includes('import.meta.env') || /^\s*(export\s+)?type\s/.test(line)) return;
      for (const m of line.matchAll(RE)) {
        const after = line.slice((m.index ?? 0) + m[0].length);
        if (/^\.(?!then\b|catch\b|finally\b)[A-Za-z_]/.test(after)) continue; // a type position: import('./x').Name
        bare.push(`${rel}:${i + 1} ${m[0]}`);
      }
    });
  }
  assert.deepEqual(bare, [], 'a bare import(): Chrome keeps a lost chunk failed for the page\'s life — load it through game/importRetry.ts');
});
