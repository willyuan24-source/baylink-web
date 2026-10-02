// W9-E part a · review 2026-10-01 R§5 #2: Safari / WKWebView before 16.4 (iOS 15, iOS 16.0–16.3 and WeChat on those
// iPhones) cannot parse a regex look-behind. The main bundle's module evaluated `new RegExp("(?<![a-z0-9])…")` at its top
// level (src/lib/named-event-search.ts via quick-search.ts → QuickExplore), so on those phones the whole site stopped on
// the prerendered HTML (gapfill/ios/sim-opusbay.json: SyntaxError at index-CBvX8zQb.js:116). Both look-behinds are
// rewritten; these tests hold the new code to EXACTLY the old matches (the old regexes are the oracle here, in tests/,
// where Node parses them) and fail on any look-behind that comes back under src/** or public/*.js.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { recognizeNamedEvent } from '../src/lib/named-event-search';
import { splitAfterSentenceEnds } from '../src/lib/guide-search';

// ---- the oracle: the pre-W9-E code, verbatim ----
const OLD_NAME = /(?<![a-z0-9])(?:(?:(?:san\s+francisco|sf)\s+)?water\s+lantern\s+festival|(?:san\s+francisco|sf)\s*(?:的\s*)?水[灯燈][节節])(?![a-z0-9])|(?:(?:旧金山|舊金山)\s*(?:的\s*)?)?水[灯燈][节節]/giu;
const OLD_EXCLUDED = /(?:排除|不要(?:去)?|不去|避开|避開|避免)\s*(?:半岛|半島|foster\s+city)|\b(?:exclude|avoid|not|no|outside)\s+(?:the\s+)?(?:peninsula|foster\s+city)\b/iu;
const OLD_NEGATED = /(?:不要|不想(?:去|要)?|不去|排除|避开|避開|避免)\s*$|\b(?:no|not|without|avoid|exclude|don['’]t want|do not want)\s*$/iu;
function oldRecognize(query: string) {
  let matched = false;
  let blocked = false;
  const names: [string, number][] = [];
  const constraintText = query.replace(OLD_NAME, (name: string, offset: number) => {
    matched = true;
    names.push([name, offset]);
    const prefix = query.slice(Math.max(0, offset - 40), offset);
    if (OLD_NEGATED.test(prefix)) blocked = true;
    const constrainedCity = /(?:仅限|僅限|只限|仅在|僅在|只在|限于|限於|only in)\s*$/iu.test(prefix)
      ? name.match(/^(?:san\s+francisco|sf|旧金山|舊金山)/iu)?.[0] : undefined;
    if (constrainedCity) return constrainedCity + ' '.repeat(name.length - constrainedCity.length);
    return ' '.repeat(name.length);
  });
  return { eventIds: matched ? ['foster-city-water-lantern-festival-2026'] : [], constraintText, blocked: matched && (blocked || OLD_EXCLUDED.test(constraintText)), names };
}
const oldSplit = (text: string) => text.split(/(?<=[。！？；\n])/);

// a small seeded generator (mulberry32): the same strings on every run
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NAMED_CASES = [
  // the site's own cases (tests/named-event-search.test.ts) …
  '水灯节', '水燈節', 'SF水灯节', 'SF 水灯节', 'SF的水灯节', 'SF 的水灯节', '旧金山的水灯节', '舊金山的水燈節', 'sf  水燈節',
  'San Francisco Water Lantern Festival', 'SAN  FRANCISCO  WATER LANTERN FESTIVAL', 'San Francisco 水灯节', 'Foster City 水灯节',
  'Foster City San Francisco Water Lantern Festival', '在旧金山找水灯节 10/3', '仅限SF水灯节 10/3', '仅限SF的水灯节 10/3', '水灯节 排除半岛 10/3',
  'Water Lantern Festival outside the peninsula 10/3', '不要水灯节 10/3', '水灯节 10/5', '免费 SF水灯节 10/3',
  'free San Francisco Water Lantern Festival 10/3', '室内水灯节 10/3', 'SF明天有什么', 'water', 'water festival', 'San Francisco festival',
  // … negations in both languages …
  'no water lantern festival', 'not the SF water lantern festival', "don't want water lantern festival", 'do not want 水灯节',
  'without San Francisco Water Lantern Festival', '不想去旧金山的水灯节', '避開舊金山水燈節', '避免水灯节', '不去水灯节 only in SF',
  'only in SF水灯节', 'only in San Francisco water lantern festival', '僅限舊金山的水燈節', '只在 sf 水灯节', '限於SF水燈節',
  // … and the look-behind's own edges: a letter or digit right before the English / "SF" names (no match there, but the
  // Chinese alternative still can), a name right after another match, look-ahead edges, case folding, astral characters
  'xsf水灯节', 'asf 水灯节', '1sf水灯节', 'ksf水灯节', 'Ksf水灯节', 'Ksf水灯节', 'ſsf水灯节', '_sf水灯节', '-sf水灯节', '😀sf水灯节',
  'awater lantern festival', '9water lantern festival', '水灯节sf水灯节', '水灯节SF水灯节水燈節', 'SF水灯节SF水灯节', 'festivalwater lantern festival',
  'water lantern festivals', 'water lantern festival1', 'water lantern festival水灯节', 'sf水灯节x', 'sanfrancisco水灯节', 'san francisco水灯节',
  'sf的 水灯节', 'sf 的  水灯节', 'xsan francisco water lantern festival', 'x san francisco water lantern festival', '旧金山水灯节', '旧金山 的 水灯节',
  '旧金山的', '水灯', '水灯节节', 'SF水灯', 'SF\n水灯节', 'sf\twater\tlantern\tfestival', 'ＳＦ水灯节', '', ' ', '旧金山旧金山水灯节',
];

test('W9-E: recognizeNamedEvent finds exactly what the look-behind regex found (constraint text, ids, blocked) — listed cases', () => {
  for (const q of NAMED_CASES) {
    const want = oldRecognize(q);
    const got = recognizeNamedEvent(q);
    assert.deepEqual(got, { eventIds: want.eventIds, constraintText: want.constraintText, blocked: want.blocked }, JSON.stringify(q));
  }
  // the edge cases really are edges (the oracle sees them): a letter before "sf" hides the SF name but not the Chinese one
  assert.deepEqual(oldRecognize('xsf水灯节').names, [['水灯节', 3]]);
  assert.deepEqual(oldRecognize('水灯节sf水灯节').names, [['水灯节', 0], ['sf水灯节', 3]]);
  assert.deepEqual(oldRecognize('Ksf水灯节').names, [['水灯节', 3]], 'the Kelvin sign case-folds to k under /iu');
  assert.deepEqual(oldRecognize('😀sf水灯节').names, [['sf水灯节', 2]]);
});

test('W9-E: recognizeNamedEvent equals the look-behind regex on 30 000 generated queries (tokens, case, spacing, astral characters)', () => {
  const TOKENS = ['sf', 'SF', 'Sf', 'san francisco', 'San  Francisco', 'water', 'Water', 'lantern', 'festival', 'festivals', ' ', '  ', '\n', '的', '水', '灯', '燈', '节', '節',
    '水灯节', '水燈節', '旧金山', '舊金山', 'a', 'x', '1', '9', '_', '-', 'K', 'K', 'ſ', '😀', '不要', '不想去', 'no ', 'not ', "don't want ", 'only in ', '仅限', '只在',
    'foster city', 'Foster City ', '排除', '半岛', 'peninsula', 'outside the ', '10/3', '免费'];
  const rand = rng(20261001);
  let matched = 0;
  for (let n = 0; n < 30000; n++) {
    let q = '';
    const len = 1 + Math.floor(rand() * 9);
    for (let i = 0; i < len; i++) q += TOKENS[Math.floor(rand() * TOKENS.length)];
    const want = oldRecognize(q);
    if (want.eventIds.length) matched++;
    assert.deepEqual(recognizeNamedEvent(q), { eventIds: want.eventIds, constraintText: want.constraintText, blocked: want.blocked }, JSON.stringify(q));
  }
  assert.ok(matched > 3000, `the generator reaches the names often enough (${matched})`);
});

test('W9-E: guide-search splits a snippet after 。！？； and line breaks exactly as the look-behind split did', () => {
  const CASES = ['', '。', '。。', '。。a', 'a。', 'a。b', '第一句。第二句！第三句？第四句；第五句\n第六句', '\n', '\n\n', 'a\n', '\na', '没有标点的一段话',
    'Mixed 中文。English sentence. 再来！', '。！？；\n', '😀。😀', 'ends with 。', '打印店。打印 打印？'];
  for (const c of CASES) assert.deepEqual(splitAfterSentenceEnds(c), oldSplit(c), JSON.stringify(c));
  const ALPHA = ['。', '！', '？', '；', '\n', 'a', '打', '印', ' ', '😀', '.', '!', '?', ';'];
  const rand = rng(1001);
  for (let n = 0; n < 20000; n++) {
    let s = '';
    const len = Math.floor(rand() * 14);
    for (let i = 0; i < len; i++) s += ALPHA[Math.floor(rand() * ALPHA.length)];
    assert.deepEqual(splitAfterSentenceEnds(s), oldSplit(s), JSON.stringify(s));
  }
});

// The guard: no look-behind in any regex literal or RegExp string the browser runs. A plain text scan of src/** and
// public/*.js for "(?<=" / "(?<!" (named groups "(?<name>" are fine: Safari 11.1+). Comments count too — write
// "look-behind" in words there.
test('W9-E guard: no regex look-behind anywhere under src/** or in public/*.js (Safari < 16.4 cannot parse it — review R§5 #2)', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(?:[cm]?[jt]sx?)$/.test(e.name)) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const m of text.matchAll(/\(\?<[=!]/g)) {
        const line = text.slice(0, m.index).split('\n').length;
        found.push(`${path.relative(process.cwd(), p).replaceAll('\\', '/')}:${line}`);
      }
    }
  };
  walk(path.resolve('src'));
  for (const f of fs.readdirSync(path.resolve('public'))) if (/\.m?js$/.test(f)) {
    const text = fs.readFileSync(path.resolve('public', f), 'utf8');
    if (/\(\?<[=!]/.test(text)) found.push(`public/${f}`);
  }
  assert.deepEqual(found, [], 'a regex look-behind breaks the whole site on iOS < 16.4: check the character before the match in code instead (see src/lib/named-event-search.ts)');
});

test('W9-E: vite.config.ts sets build.target so esbuild lowers syntax Safari 15 cannot parse (class static blocks)', () => {
  const cfg = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
  const m = cfg.match(/target:\s*\[([^\]]*)\]/);
  assert.ok(m, 'build.target is set');
  assert.match(m![1], /'safari15'/);
  assert.match(m![1], /'ios15'/);
});
