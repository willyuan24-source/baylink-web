// D5 / READ-05: public/reading-init.js applies the saved Aa size and 简洁显示 before the first paint. It is a classic ES5
// script that index.html loads synchronously in <head>, ahead of every stylesheet and the module (CSP: no inline script).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { FAMILY_LINK_KEY, READING_SIZE_KEY, SIMPLE_DISPLAY_KEY } from '../src/lib/reading-preferences';
import { GUEST_PLANNER_KEY } from '../src/lib/planner-storage-key';

const SRC = fs.readFileSync('public/reading-init.js', 'utf8');

function load(url: string, saved: Record<string, string> = {}, { blockStorage = false, visit = null as string | null } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', url });
  for (const [key, value] of Object.entries(saved)) dom.window.localStorage.setItem(key, value);
  if (visit !== null) dom.window.sessionStorage.setItem(FAMILY_LINK_KEY, visit);
  if (blockStorage) for (const storage of ['localStorage', 'sessionStorage']) Object.defineProperty(dom.window, storage, { configurable: true, get() { throw new Error('SecurityError'); } });
  dom.window.eval(SRC);
  return dom;
}
function run(url: string, saved: Record<string, string> = {}, options: { blockStorage?: boolean; visit?: string | null } = {}) {
  const root = load(url, saved, options).window.document.documentElement;
  return { reading: root.getAttribute('data-reading'), simple: root.hasAttribute('data-simple') };
}

test('a family link opens at 特大 in 简洁显示 before anything paints', () => {
  assert.deepEqual(run('https://www.baylink.us/guides/bay-area-chinese-senior-services-referral-guide?reading=extra-large&simple=1'), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/zh-Hant/?simple=1&reading=large#top'), { reading: 'large', simple: true });
});

test('the saved choice applies on every later visit, and a link can switch 简洁显示 off', () => {
  assert.deepEqual(run('https://www.baylink.us/', { [READING_SIZE_KEY]: 'extra-large', [SIMPLE_DISPLAY_KEY]: '1' }), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/events/x?simple=0', { [READING_SIZE_KEY]: 'large', [SIMPLE_DISPLAY_KEY]: '1' }), { reading: 'large', simple: false });
  assert.deepEqual(run('https://www.baylink.us/', { [READING_SIZE_KEY]: 'standard', [SIMPLE_DISPLAY_KEY]: '0' }), { reading: null, simple: false });
});

test('unknown values and blocked storage leave the standard page; a shared link still works without storage', () => {
  assert.deepEqual(run('https://www.baylink.us/?reading=huge&simple=yes', { [READING_SIZE_KEY]: 'giant' }), { reading: null, simple: false });
  assert.deepEqual(run('https://www.baylink.us/?xreading=large'), { reading: null, simple: false });
  assert.deepEqual(run('https://www.baylink.us/?reading=extra-large&simple=1', {}, { blockStorage: true }), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/', {}, { blockStorage: true }), { reading: null, simple: false });
});

// G52 / CW-06: the link leaves the address bar before the router reads it, and goes to the app for this tab.
test('a family link leaves the address bar at once, keeps the page’s own parameters and anchor, and is handed to the app', () => {
  const dom = load('https://www.baylink.us/events?day=sat&reading=extra-large&simple=1#top');
  assert.equal(dom.window.location.pathname + dom.window.location.search + dom.window.location.hash, '/events?day=sat#top');
  assert.equal(dom.window.sessionStorage.getItem(FAMILY_LINK_KEY), 'extra-large|1');
  assert.equal(dom.window.document.documentElement.getAttribute('data-reading'), 'extra-large');
  for (const [url, left, handed] of [
    ['https://www.baylink.us/?reading=large', '/', 'large|'],
    ['https://www.baylink.us/guides?simple=0&topic=elders', '/guides?topic=elders', '|0'],
    ['https://www.baylink.us/zh-Hant/offers/x?a=1&reading=large&b=2', '/zh-Hant/offers/x?a=1&b=2', 'large|'],
  ] as const) {
    const page = load(url);
    assert.equal(page.window.location.pathname + page.window.location.search, left, url);
    assert.equal(page.window.sessionStorage.getItem(FAMILY_LINK_KEY), handed, url);
  }
  // Without a link the address bar is left alone.
  assert.equal(load('https://www.baylink.us/events?day=sat').window.location.search, '?day=sat');
});

test('a reload in the same tab keeps the visit’s link over the saved choice; a new visit has the saved choice again', () => {
  const saved = { [READING_SIZE_KEY]: 'standard', [SIMPLE_DISPLAY_KEY]: '0' };
  assert.deepEqual(run('https://www.baylink.us/events', saved, { visit: 'extra-large|1' }), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/events', saved, { visit: '|1' }), { reading: null, simple: true });
  assert.deepEqual(run('https://www.baylink.us/events', saved), { reading: null, simple: false });
});

test('the 3D world keeps its own HUD sizes: /opus-bay and /play are never scaled', () => {
  for (const path of ['/opus-bay', '/opus-bay/', '/opus-bay.html', '/en/opus-bay', '/zh-Hant/opus-bay?from=nav', '/play', '/en/play']) {
    assert.deepEqual(run(`https://www.baylink.us${path}${path.includes('?') ? '&' : '?'}reading=extra-large&simple=1`, { [READING_SIZE_KEY]: 'extra-large' }), { reading: null, simple: false }, path);
  }
  assert.deepEqual(run('https://www.baylink.us/playground?reading=large'), { reading: 'large', simple: false }, 'only the game paths are skipped');
});

test('reading-init is ES5, tiny, and loads synchronously in <head> before every stylesheet and the app module', async () => {
  for (const [what, pattern] of [['arrow', /=>/], ['let / const', /\b(?:let|const)\s/], ['template literal', /`/], ['class', /\bclass\s+\w/], ['spread', /\.\.\./]] as const) assert.doesNotMatch(SRC, pattern, what);
  const acorn = await import('acorn').catch(() => null);
  if (acorn) acorn.parse(SRC, { ecmaVersion: 5 });
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  // ~1 KB with the D17 language redirect (WEB-SHELL1), ~1.6 KB with the CW-02 stale-date check (WEB-FRESH2: 1,621 chars;
  // the US DST rule instead of Intl with a time zone, whose first use cost ~95 ms at 4x CPU before the first paint), ~2.1 KB
  // with the G52 family-link hand-over (WEB-POLISH: 2,062 chars together), ~2.4 KB with the H20 marks for 行程's prerendered
  // page, upcoming saved days and plan links (WEB-PERF-3: 2,378 chars); still one small blocking request, cached briefly
  // (vercel.json).
  assert.ok(code.length < 2400, `reading-init stays small on the critical path (${code.length} chars without comments)`);
  const html = fs.readFileSync('index.html', 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const tag = '<script src="/reading-init.js"></script>';
  assert.ok(head.includes(tag), 'a plain blocking script: no defer, async or module, so it runs before the first paint');
  for (const later of ['rel="stylesheet"', 'type="module"', '/boot-check.js', '<!--baylink-meta-start-->']) {
    const at = html.indexOf(later);
    if (at >= 0) assert.ok(html.indexOf(tag) < at, `reading-init comes before ${later}`);
  }
  for (const key of [READING_SIZE_KEY, SIMPLE_DISPLAY_KEY, GUEST_PLANNER_KEY]) assert.ok(SRC.includes(`'${key}'`), `reading-init reads ${key}, the key the app saves`);
});

// H20 (WEB-PERF-3): a guest's saved plan for today or later marks <html data-plans> before the first paint, so 行程's
// prerendered 已排的日子 shows a loading block, not its empty state (src/styles/plan-page.css). Past days are not listed
// (plan-stop-cover.ts upcomingPlans), so a library of past plans keeps the empty state from the first frame.
test('upcoming saved plans in this browser mark the page before it paints; past ones, none, an empty list or blocked storage do not', () => {
  const marked = (saved: Record<string, string>, options = {}) => load('https://www.baylink.us/plan', saved, options).window.document.documentElement.hasAttribute('data-plans');
  const library = (plans: unknown[]) => JSON.stringify({ preferences: {}, favorites: [{ kind: 'event', id: 'e1', date: '2099-01-01' }], plans });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  const shift = (days: number) => new Date(Date.parse(`${today}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
  const plan = (id: string, date: string) => ({ id, title: '周六', date, stops: [{ kind: 'place', id: 'x' }], version: 1 });
  assert.equal(marked({ [GUEST_PLANNER_KEY]: library([plan('p1', shift(2))]) }), true, 'an upcoming day');
  assert.equal(marked({ [GUEST_PLANNER_KEY]: library([plan('p1', today)]) }), true, 'today');
  assert.equal(marked({ [GUEST_PLANNER_KEY]: library([plan('p1', shift(-3)), plan('p2', shift(1))]) }), true, 'a past day and an upcoming one');
  assert.equal(marked({ [GUEST_PLANNER_KEY]: library([plan('p1', shift(-1)), plan('p2', shift(-30))]) }), false, 'only past days (a date before "plans" does not count)');
  assert.equal(marked({ [GUEST_PLANNER_KEY]: library([]) }), false);
  assert.equal(marked({}), false);
  assert.equal(marked({ [GUEST_PLANNER_KEY]: 'x' }, { blockStorage: true }), false);
  const css = fs.readFileSync('src/styles/plan-page.css', 'utf8');
  assert.match(css, /html\[data-plans\] :is\(main\[data-prerender-path="\/plan"\],\.site-boot-main\) #plan-days \.ui-state \{ display:none; \}/, 'only the prerendered /plan page (and its boot copy) hides its empty state');
});

// H20 (WEB-PERF-3 review): the prerendered /plan page is built without a query, so it carries this weekend's picks; a link
// that opens a plan (the 分享版 link, ?edit= from My Week) marks <html data-plan-link> and the picks never paint above it.
test('a link that opens a plan marks the page before it paints, so the prerendered picks stay hidden', () => {
  const linked = (url: string) => load(url).window.document.documentElement.hasAttribute('data-plan-link');
  for (const query of ['?date=2026-10-17&stops=place%3Agolden-gate', '?edit=p1', '?places=a,b', '?baybayDraft=x', '?reading=large&edit=p1', '?edit'])
    assert.equal(linked(`https://www.baylink.us/plan${query}`), true, query);
  for (const query of ['', '?q=museum', '?editor=1', '?date=2026-10-17', '?baybayBrief=x'])
    assert.equal(linked(`https://www.baylink.us/plan${query}`), false, query);
  const css = fs.readFileSync('src/styles/plan-page.css', 'utf8');
  assert.match(css, /html\[data-plan-link\] :is\(main\[data-prerender-path="\/plan"\],\.site-boot-main\) \.plan-weekend \{ display:none; \}/, 'only the prerendered /plan page (and its boot copy) hides the picks');
});
