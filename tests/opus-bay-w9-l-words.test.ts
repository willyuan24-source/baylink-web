import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane L · words (R§6 语言与本地化 rows, w8 NEXT P0-4): English text in a Noto-first font stack gets its line in
 * opus-bay.css ("What’ s that?"), the Welcome Center has a Chinese name (the Grand Tour's beacon), the seniors' free Muni
 * cites SFMTA's English page (no override in export-live.ts), and the two catalog rows the game links read in English.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('W9-L every Noto-first font stack in the game\'s CSS has its English line (Noto Sans SC\'s full-width ’)', () => {
  const css: string[] = [];
  const walk = (d: string) => { for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (f.name.endsWith('.css')) css.push(p); } };
  walk('src/opus-bay');
  const main = read('src/opus-bay/opus-bay.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const english = new Set<string>();
  for (const m of main.matchAll(/([^{}]+)\{\s*font-family:\s*var\(--ob-font\);\s*\}/g)) for (const sel of m[1].split(',')) { const s = sel.trim().replace(/\s+/g, ' '); if (s.startsWith("html[lang='en'] ")) english.add(s.slice("html[lang='en'] ".length)); }
  const missing: string[] = [];
  let noto = 0;
  for (const file of css) {
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/font(?:-family)?:[^;]*'Noto Sans SC',\s*var\(--ob-font\)/.test(m[2])) continue;
      for (const sel of m[1].split(',')) { const s = sel.trim().replace(/\s+/g, ' '); if (s.startsWith('html[lang=')) continue; noto++; if (!english.has(s)) missing.push(`${file}: ${s}`); }
    }
  }
  assert.ok(noto >= 9, `${noto} Noto-first selectors`);
  assert.deepEqual(missing, [], 'add html[lang=\'en\'] <selector> { font-family: var(--ob-font) } to opus-bay.css');
});

test('W9-L the Welcome Center has its Chinese name (the Grand Tour beacon read "Welcome Center · 约 12 秒" in zh)', async () => {
  const { PLACE_NAME_FIXES } = await import('../src/opus-bay/data/sf/extraPlaces');
  const wc = PLACE_NAME_FIXES['osm-w164569681'];
  assert.ok(wc);
  assert.match(wc.zh, /^\p{Script=Han}+$/u);
  assert.equal(wc.zh, '金门大桥游客中心');
  assert.match(wc.en, /Welcome Center/);
});

test('W9-L the seniors\' free Muni cites SFMTA\'s English page (the site row, the game\'s live.json, no override)', () => {
  const offers = JSON.parse(read('src/data/september-refresh-offers.json')) as { id: string; sourceUrl: string }[];
  const site = offers.find(o => o.id === 'sfmta-free-muni-seniors');
  assert.equal(site?.sourceUrl, 'https://www.sfmta.com/fares/free-muni-seniors-ages-65');
  const live = JSON.parse(read('public/opus-bay/sf/v1/live.json')) as { offers: { id: string; source: { url: string } }[] };
  assert.equal(live.offers.find(o => o.id === 'sfmta-free-muni-seniors')?.source.url, site!.sourceUrl);
  assert.doesNotMatch(read('scripts/opus-sf/export-live.ts'), /sourceEn: \{ from: 'https:\/\/www\.sfmta\.com\/vi\//);
  for (const f of ['public/baybay-guides.json', 'public/baybay-guides.en.json']) assert.doesNotMatch(read(f), /sfmta\.com\/vi\/node\/12193/, f);
});

test('W9-L the Exploratorium and Gott\'s catalog rows read in English', async () => {
  const L = await import('../src/i18n/locale');
  await L.loadLocale('en');
  const catalog = JSON.parse(read('public/planner-catalog.json')) as { places: { id: string; title: string; summary: string }[] };
  for (const id of ['venue-exploratorium-daytime', 'restaurant-gotts-ferry-building']) {
    const row = catalog.places.find(p => p.id === id);
    assert.ok(row, id);
    for (const text of [row.title, row.summary]) assert.doesNotMatch(L.translateText(text, 'en'), /\p{Script=Han}/u, `${id}: ${text}`);
  }
});
