import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W8-P-review (Ultra) · lane P's lazy-chunk recovery, the holes the two lenses found (sf-w8-P.md "Review (Ultra)").
 */

const CHROME = (url: string) => new TypeError(`Failed to fetch dynamically imported module: ${url}`);

test('P-RP-2: a chunk whose first retry chain failed loads once the network is back — a new chain never asks for a ?retry= URL the page already lost', async () => {
  const { importRetry } = await import('../src/opus-bay/game/importRetry');
  const memo = new Map();
  const URL_M = 'https://www.baylink.us/assets/MapPanel-Q1w2E3r4.js';
  const failed = new Set<string>(); // Chrome's module map: a failed URL stays failed for the page's life
  let online = false;
  const urls: string[] = [];
  const mod = { MapPanel() { return null; } };
  const opts = {
    memo, sleep: async () => {},
    importUrl: async (u: string) => { urls.push(u); if (failed.has(u) || !online) { failed.add(u); throw CHROME(u); } return mod; },
  };
  const press = () => Promise.reject(CHROME(URL_M)); // the bare import: failed for good after the first loss
  await assert.rejects(importRetry(press, opts));
  assert.deepEqual(urls, [`${URL_M}?retry=1`, `${URL_M}?retry=2`, `${URL_M}?retry=3`]);
  online = true; // the tunnel ends; the player chose 先继续玩 and presses M again
  const m = await importRetry(press, opts);
  assert.equal(m, mod, 'the panel loads (before: ?retry=1..3 again, all failed in the module map — the part was dead for the visit)');
  assert.equal(urls[3], `${URL_M}?retry=4`);
});

test('P-RC-2: an error that already names a ?retry= URL (a nested chain\'s last word, e.g. data/sf/cityData.ts\'s top-level await) is thrown on — never retried under a URL `load` does not import', async () => {
  const { importRetry, namesRetriedUrl } = await import('../src/opus-bay/game/importRetry');
  const urls: string[] = [];
  const opts = { memo: new Map(), sleep: async () => {}, importUrl: async (u: string) => { urls.push(u); return { notGameRoot: true }; } };
  const nested = CHROME('https://www.baylink.us/assets/cityDataChunk-A.js?retry=3');
  assert.equal(namesRetriedUrl(nested), true);
  assert.equal(namesRetriedUrl(CHROME('https://www.baylink.us/assets/cityDataChunk-A.js')), false);
  assert.equal(namesRetriedUrl(CHROME('http://localhost:5843/src/opus-bay/ui/CityMap.tsx?t=1&retry=2')), true);
  await assert.rejects(importRetry(() => Promise.reject(nested), opts), /retry=3/);
  assert.deepEqual(urls, [], 'no import of the data chunk standing in for the module load() imports');
});

test('P-RC-5 / P-RP-3: quietly() — a prefetch lost for good shows no reload card; the press that needs the part asks again, loudly', async () => {
  const { importRetry, onChunkLost, quietly } = await import('../src/opus-bay/game/importRetry');
  const seen: unknown[] = [];
  const off = onChunkLost(e => { seen.push(e); });
  try {
    const memo = new Map();
    const fail = { memo, sleep: async () => {}, importUrl: async (u: string) => { throw CHROME(u); } };
    const lost = () => Promise.reject(CHROME('https://www.baylink.us/assets/claw-Z9.js'));
    await assert.rejects(quietly(() => importRetry(lost, fail)));
    assert.equal(seen.length, 0, 'a walk past the claw zone during an outage: no card');
    await assert.rejects(importRetry(lost, fail));
    assert.equal(seen.length, 1, 'pressing E there: the card');
    // quietly is synchronous: a load started after it returned is loud again
    const p = quietly(() => 1);
    assert.equal(p, 1);
    await assert.rejects(importRetry(() => Promise.reject(CHROME('https://www.baylink.us/assets/crab-Y8.js')), fail));
    assert.equal(seen.length, 2);
  } finally { off(); }
  // the speculative prefetches use it (Overlay's panels, zonePrefetch, the FactCard prefetch)
  const overlay = fs.readFileSync(path.resolve('src/opus-bay/ui/Overlay.tsx'), 'utf8');
  assert.match(overlay, /quietly\(\(\) => \{ for \(const load of \[loadMap, loadJournal, loadWeek, loadSettings, loadRideBanner, loadMoveChip\]\) void load\(\)\.catch\(\(\) => \{\}\); \}\)/);
  assert.match(fs.readFileSync(path.resolve('src/opus-bay/play/zones.ts'), 'utf8'), /void quietly\(load\)\.catch\(/);
  assert.match(fs.readFileSync(path.resolve('src/opus-bay/eggs/index.ts'), 'utf8'), /importRetry\(\(\) => import\('\.\/FactCard'\), \{ quiet: true \}\)/);
});

test('P-RP-1: lazyChunk — a part whose chunk is lost for good renders nothing (no site error page over the game); the next mount asks again; the module\'s own error still throws', async () => {
  const { lazyChunk } = await import('../src/opus-bay/game/lazyChunk');
  const factories: (() => Promise<{ default: unknown }>)[] = [];
  const fakeLazy = (f: () => Promise<{ default: unknown }>) => { factories.push(f); return (() => null) as never; };
  const Part = () => null;
  let mode: 'lost' | 'ok' | 'bug' = 'lost';
  lazyChunk(() => (mode === 'ok' ? Promise.resolve({ default: Part }) : mode === 'bug' ? Promise.reject(new TypeError("Cannot read properties of undefined (reading 'x')")) : Promise.reject(CHROME('https://www.baylink.us/assets/CityMap-A.js?retry=3'))), fakeLazy);
  assert.equal(factories.length, 1);
  const first = await factories[0]();
  assert.equal(typeof first.default, 'function');
  assert.notEqual(first.default, Part, 'nothing in its place');
  assert.equal((first.default as () => unknown)(), null);
  assert.equal(factories.length, 2, 'a fresh React.lazy for the next mount (React keeps a lazy\'s first result)');
  mode = 'ok';
  assert.equal((await factories[1]()).default, Part, 'the panel opened again after the network came back');
  // an error the module's own code threw is not swallowed
  lazyChunk(() => Promise.reject(new TypeError("Cannot read properties of undefined (reading 'x')")), fakeLazy);
  await assert.rejects(factories[2](), /Cannot read/);
  mode = 'bug';
  // every React.lazy in src/opus-bay goes through lazyChunk, except OpusBayPage's GameRoot (P-RC-1)
  const root = path.resolve('src/opus-bay');
  const bare: string[] = [];
  (function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (rel === 'OpusBayPage.tsx' || rel === 'game/lazyChunk.ts') continue;
      fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
        const t = line.trimStart();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (/(?<![\w.])lazy\(/.test(line)) bare.push(`${rel}:${i + 1}`);
      });
    }
  })(root);
  assert.deepEqual(bare, [], 'a bare React.lazy: a lost chunk replaces the whole game with the site error page — use game/lazyChunk.ts');
});

test('P-RC-1: OpusBayPage loads GameRoot with a bare import — ~150 lazy chunks import their shared modules from GameRoot\'s own file, a retried GameRoot is an instance they never see', () => {
  const src = fs.readFileSync(path.resolve('src/opus-bay/OpusBayPage.tsx'), 'utf8');
  assert.match(src, /const GameRoot = lazy\(\(\) => import\('\.\/game\/GameRoot'\)\.then\(/);
  assert.match(src, /if \(isLoadFailure\(e\)\)[\s\S]{0,200}sessionStorage\.setItem\(GAME_RELOAD_KEY, '1'\); location\.reload\(\)/, 'a lost GameRoot reloads once per session');
  assert.doesNotMatch(src, /importRetry\(\(\) => import\('\.\/game\/GameRoot'\)\)/);
});

test('P-RC-4: game/flow.ts startTrip loads tripRun through importRetry', () => {
  const src = fs.readFileSync(path.resolve('src/opus-bay/game/flow.ts'), 'utf8');
  assert.doesNotMatch(src, /void import\('\.\/tripRun'\)/);
  assert.match(src, /void importRetry\(\(\) => import\('\.\/tripRun'\)\)\.then\(m => \{ m\.initTripRun\(\); tripRunner\?\.start\(option, dest, source\); \}/);
});

test('P-RC-3 / P-RC-7: the chunk-lost card takes focus itself (Space / Enter stay the game\'s), in the reader\'s own language', async () => {
  const { showChunkLostCard, resetChunkLostForTests, CHUNK_LOST_TEXT } = await import('../src/opus-bay/game/chunkLost');
  const L = await import('../src/i18n/locale');
  type El = { tag: string; className: string; textContent: string; tabIndex?: number; children: El[]; attrs: Record<string, string>; focused: number; append(...c: El[]): void; setAttribute(k: string, v: string): void; addEventListener(): void; remove(): void; focus(): void };
  const make = (tag: string): El => {
    const el: El = { tag, className: '', textContent: '', children: [], attrs: {}, focused: 0,
      append(...c) { el.children.push(...c); }, setAttribute(k, v) { el.attrs[k] = v; }, addEventListener() {}, remove() {}, focus() { el.focused++; } };
    return el;
  };
  const before = L.getLocale();
  try {
    for (const [locale, tx] of [['en', CHUNK_LOST_TEXT.en], ['zh-Hant', CHUNK_LOST_TEXT.hant], ['zh-Hans', CHUNK_LOST_TEXT.zh]] as const) {
      await L.setLocale(locale, false);
      const page = make('main');
      const doc = { createElement: (t: string) => make(t.toUpperCase()), querySelector: (q: string) => (q === '.ob-page' ? page : null), body: make('BODY') } as unknown as Document;
      resetChunkLostForTests();
      assert.equal(showChunkLostCard(doc, () => {}), true);
      const card = page.children[0];
      const [title, body, reload, later] = card.children[0].children;
      assert.equal(title.textContent, tx.title, locale);
      assert.equal(body.textContent, tx.body, locale);
      assert.equal(reload.textContent, tx.reload, locale);
      assert.equal(later.textContent, tx.later, locale);
      assert.equal(card.focused, 1, 'the card itself takes focus');
      assert.equal(card.tabIndex, -1);
      assert.equal(reload.focused, 0, 'not 重新载入: a Space (jump) or Enter (interact) on a focused button reloaded the page mid-play');
    }
  } finally {
    await L.setLocale(before, false);
    resetChunkLostForTests();
  }
});
