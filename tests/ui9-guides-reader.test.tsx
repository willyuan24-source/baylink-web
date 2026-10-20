// UI9-GUIDES: the guide reader and /guides after the UI-9 content arrangement — the action bar on DETAIL's contract, the
// detail chrome on /guides/:slug, one number per guide for the reader's bar and the index's 简洁 rows, the 简洁 hooks, and the
// token-only stylesheets (sizes, line heights, radii, shadows, hover behind a fine pointer).
import assert from 'node:assert/strict';
import test, { after, afterEach, type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React from 'react';
import postcss, { type AtRule, type Rule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.scrollTo = () => {};
// RC-25: a test sets this to make the guide search corpus fail to load (offline), as a rejected chunk would.
const failing = { corpus: false };
const hooks = registerHooks({ load(url, context, next) {
  if (failing.corpus && url.includes('guide-search-corpus')) return { format: 'module', shortCircuit: true, source: 'throw new Error("offline");' };
  if (url.includes('/socket.io-client/')) return { format: 'module', shortCircuit: true, source: 'export const io = () => ({ on() { return this; }, off() { return this; }, emit() {}, disconnect() {} });' };
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
await import('../src/i18n/router');
const { setLocale } = await import('../src/i18n/locale');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { api } = await import('../src/lib/api');
const { GuideDetail } = await import('../src/components/GuideDetail');
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();
const { peekGuide, loadGuide } = await import('../src/features/guides/guide-store');
const { guideCallOf } = await import('../src/features/guides/guide-facts');
const { getGuideEditorial } = await import('../src/data/guide-editorial');
const { ROUTES } = await import('../src/app/route-table');
const guidesIndex = (await import('../src/data/generated/guides-index.json')).default as { guides: { slug: string; call?: { number: string } }[] };
const { telOf } = await import('../src/features/guides/guide-records');
after(() => { hooks.deregister(); });
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

const SENIOR = 'bay-area-chinese-senior-services-referral-guide';
const OUTING = 'golden-gate-park-free-car-free-day-guide';
const noop = () => {};
async function article(slug: string) {
  if (!peekGuide(slug)) await loadGuide(slug);
  return render(<MemoryRouter initialEntries={[`/guides/${slug}`]}><GuideDetail slug={slug} today="2026-10-19" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} onAsk={noop} /></MemoryRouter>);
}

test('/guides/:slug is a detail route: the app is marked data-chrome="detail" and the tab bar stays in the DOM', async (t: TestContext) => {
  assert.equal(ROUTES.find(route => route.path === '/guides/:slug')?.chrome, 'detail');
  assert.equal(ROUTES.find(route => route.path === '/guides')?.chrome, undefined);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in chrome tests'); });
  t.mock.method(api, 'request', async (endpoint: string) => {
    if (endpoint.startsWith('/posts?')) return { posts: [], hasMore: false };
    throw new Error(`Unexpected API call: ${endpoint}`);
  });
  function Harness() {
    const location = useLocation();
    return <Routes><Route element={<AppLayout realLocation={location} />}><Route path="*" element={<p>page</p>} /></Route></Routes>;
  }
  const view = render(<MemoryRouter initialEntries={[`/guides/${SENIOR}`]}><Harness /></MemoryRouter>);
  await act(async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 10)); });
  assert.equal(view.container.querySelector('.site-app')!.getAttribute('data-chrome'), 'detail');
  // CSS hides the tab bar only once the page renders its .site-detail-actions bar (site-chrome.css, D10).
  assert.ok(view.container.querySelector('nav.site-mobile-nav'));
});

test('the bar follows DETAIL\'s contract: 收藏 · 发家人 · 问 BayBay, then one primary, last — 拨打 the number or 官方入口 ↗', async () => {
  const senior = await article(SENIOR);
  const bar = senior.getByRole('group', { name: '这一页的操作' });
  assert.ok(bar.classList.contains('site-detail-actions') && bar.classList.contains('detail-actions'));
  assert.deepEqual([...bar.children].map(cell => cell.getAttribute('data-cell')), ['save', 'family', 'ask', null]);
  const call = bar.lastElementChild!;
  assert.ok(call.classList.contains('detail-actions__primary') && call.classList.contains('detail-action--primary'));
  assert.equal(call.getAttribute('href'), 'tel:+18005102020');
  assert.match(call.textContent!, /拨打 800-510-2020/);
  assert.ok(within(bar).getByRole('button', { name: '问 BayBay 这一页' }));
  assert.equal(bar.querySelectorAll('.detail-actions__primary').length, 1);
  cleanup();
  // A guide without a number: the primary is its first official source.
  const outing = await article(OUTING);
  const other = outing.getByRole('group', { name: '这一页的操作' });
  const primary = other.lastElementChild!;
  assert.equal(primary.getAttribute('href'), peekGuide(OUTING)!.guide.sources[0].url);
  assert.match(primary.textContent!, /^官方入口/);
  assert.equal(primary.getAttribute('target'), '_blank');
});

test('one number per guide: the reader\'s bar and the band\'s 简洁 rows call the same number (guideCallOf)', () => {
  // The index carries a number only for the guides the 长辈与家属 band can show (G16), each the one the reader's bar calls.
  const called = guidesIndex.guides.filter(card => card.call);
  assert.ok(called.length >= 3, `${called.length} guides with a number`);
  for (const card of called) {
    const call = guideCallOf(getGuideEditorial(card.slug));
    assert.deepEqual({ number: card.call!.number, tel: telOf(card.call!.number) }, call && { number: call.number, tel: call.tel }, card.slug);
  }
  const senior = guidesIndex.guides.find(card => card.slug === SENIOR)!;
  assert.equal(senior.call?.number, '800-510-2020');
});

test('reader order and hierarchy: one H1, the cover title a styled line, 目录 after 30 秒看懂, credits last with #page-credits', async () => {
  const view = await article(SENIOR);
  assert.equal(view.container.querySelectorAll('h1').length, 1);
  const cover = view.container.querySelector('.gd-slide__cover-title')!;
  assert.equal(cover.tagName, 'P');
  const order = ['.gd-keyfacts', '.gd-toc', '.gd-contacts', '.gd-main', '#guide-sources', '.gd-related', '#page-credits'].map(selector => view.container.querySelector(selector));
  for (const [index, element] of order.entries()) assert.ok(element, `${index}`);
  for (let index = 1; index < order.length; index++) assert.ok(order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${index}`);
  const toc = view.getByRole('navigation', { name: '文章目录' });
  assert.ok(toc.querySelector('a[href="#gd-contacts-title"]'));
  assert.ok(toc.querySelector('a[href="#guide-sources"]'));
  assert.ok(Number(view.container.querySelector('#page-credits')!.getAttribute('data-count')) >= 1);
  // Two meta lines; each item a nowrap unit (the dot is drawn before the next item, never typed).
  const metas = view.container.querySelectorAll('.gd-meta');
  assert.equal(metas.length, 2);
  for (const item of view.container.querySelectorAll('.gd-meta__item')) assert.doesNotMatch(item.textContent!, /^·/);
  // Contacts: 拨打 is secondary (the bar's 拨打 is the one filled button), and prints the number in 简洁 (CSS).
  for (const call of view.container.querySelectorAll('.gd-contact__call')) {
    assert.equal(call.getAttribute('data-variant'), 'secondary');
    assert.ok(call.querySelector('.gd-contact__call-number'));
  }
  // Every fold is F2's Disclosure: no native marker.
  for (const details of view.container.querySelectorAll('details')) assert.ok(details.classList.contains('ui-disclosure'), details.className);
});

test('3D postcards keep their own label: no credit line on a scene3d picture, GuideOpusEntry untouched', async () => {
  const view = await article(OUTING);
  assert.ok(view.container.querySelector('.gd-opus'), 'the 在 3D 里先看看 entry stays');
  for (const credit of view.container.querySelectorAll('.gd-credit')) assert.doesNotMatch(credit.textContent!, /3D/);
});

const css = (file: string) => postcss.parse(readFileSync(file, 'utf8'));
const LANE_SHEETS = ['src/features/guides/guide-article.css', 'src/features/guides/guide-library.css'];
/** Every sheet this lane touched (DECISIONS #13: no font-size literal in them; line heights on --lh-*; every hover behind a
 *  fine pointer, N23). */
const TOUCHED_SHEETS = [...LANE_SHEETS, 'src/components/guides-ui.css', 'src/components/monthly-deals.css', 'src/components/reader-library.css', 'src/components/guide-visuals.css', 'src/components/phone-links.css'];
const inMedia = (rule: Rule, pattern: RegExp) => { for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) if (node.type === 'atrule' && pattern.test((node as AtRule).params)) return true; return false; };

test('the lane\'s sheets are token-only: sizes, line heights, radii and shadows; every hover behind a fine pointer', () => {
  for (const file of LANE_SHEETS) {
    css(file).walkDecls(declaration => {
      const where = `${file} ${(declaration.parent as Rule).selector} ${declaration.prop}:${declaration.value}`;
      if (declaration.prop === 'font-size') assert.match(declaration.value, /^(?:var\(--fs-[\w-]+\)|1em|inherit)$/, where);
      if (declaration.prop === 'line-height') assert.match(declaration.value, /^(?:var\(--lh-[\w-]+\)|1)$/, where);
      if (/^border(?:-[a-z]+)*-radius$/.test(declaration.prop)) assert.match(declaration.value, /^(?:var\(--r-[\w-]+\)|0)$/, where);
      if (declaration.prop === 'box-shadow') assert.match(declaration.value, /^var\(--(?:e1|e2|scrim)\)$/, where);
    });
  }
  for (const file of TOUCHED_SHEETS) {
    css(file).walkDecls('font-size', declaration => {
      // phone-links.css scales a chip to its sentence (.9em / .82em below 360 px): a ratio of the text around it, not a size.
      const ratio = file.endsWith('phone-links.css') && /^\.\d+em$/.test(declaration.value);
      if (!ratio) assert.match(declaration.value, /^(?:var\(--(?:fs|text)-[\w-]+\)|inherit|1em)$/, `${file} ${(declaration.parent as Rule).selector}`);
    });
    // phone-links.css is shared site-wide (HOME, DETAIL, BayBay): its chip keeps 1.6 and its directory label 1.5 in every locale
    // (--lh-ui is 1.45 in English, and no token is 1.5), so the chips outside the guides do not move.
    const shared = file.endsWith('phone-links.css');
    css(file).walkDecls('line-height', declaration => { if (!(shared && /^1\.[56]$/.test(declaration.value))) assert.match(declaration.value, /^(?:var\(--lh-[\w-]+\)|1|normal|inherit)$/, `${file} ${(declaration.parent as Rule).selector}`); });
    css(file).walkRules(rule => {
      if (/:hover/.test(rule.selector)) assert.ok(inMedia(rule, /\(hover:hover\) and \(pointer:fine\)/), `${file}: ${rule.selector}`);
    });
  }
});

test('简洁显示 hooks: the lane-scoped hide / show rules, no carousel in 简洁, 特大 shows the cover slide only', () => {
  const article = readFileSync('src/features/guides/guide-article.css', 'utf8');
  assert.match(article, /html\[data-simple\] \.gd-page \[data-simple=hide\] \{ display:none; \}/);
  assert.match(article, /html\[data-simple\] \.gd-page\[data-pilot\] \.gd-lead__visual \{ display:none; \}/);
  assert.match(article, /html\[data-reading=extra-large\]:not\(\[data-simple\]\) \.gd-carousel:not\(\[data-all\]\) \.ui-carousel__slide:not\(:first-child\) \{ display:none; \}/);
  const library = readFileSync('src/features/guides/guide-library.css', 'utf8');
  assert.match(library, /html\[data-simple\] \.gl-page \[data-simple=hide\]/);
});

test('the bar\'s call never shows a bare number on a phone: two rows below 390 px and at 大 / 特大 / 简洁; short cell labels in the rail', () => {
  const rules = new Map<string, string[]>();
  css('src/features/guides/guide-article.css').walkRules(rule => {
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    rules.set(media, [...(rules.get(media) ?? []), rule.selector]);
  });
  const twoRow = (media: string) => (rules.get(media) ?? []).some(selector => selector.endsWith('.gd-bar>.detail-actions__primary'));
  assert.ok(twoRow('(max-width:389px)'), 'two rows below 390 px (360–389 px standard hid the glyph and the verb)');
  const modes = (rules.get('(max-width:479px)') ?? []).find(selector => selector.endsWith('.gd-bar>.detail-actions__primary'));
  for (const mode of ['data-reading=large', 'data-reading=extra-large', 'data-simple']) assert.ok(modes?.includes(mode), `${mode} on a phone: two rows`);
  // The rail's 72–85 px cells: DETAIL's desktop 发给家人 / "Send to family" overflowed at 特大 and in English.
  assert.ok((rules.get('') ?? []).includes('.site-detail-actions.detail-actions.gd-bar [data-label=desk]'));
  assert.ok((rules.get('') ?? []).includes('.site-detail-actions.detail-actions.gd-bar [data-label=phone]'));
});

test('G6 and one save glyph: no all-caps English labels and no bookmark on the guide surfaces', () => {
  for (const file of ['src/components/GuideDetail.tsx', 'src/components/ReaderLibrary.tsx', 'src/components/GuidesHome.tsx', 'src/features/guides/GuideActions.tsx', 'src/features/saves/GuideSaveButton.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /YOUR NEXT STEP|YOUR LITTLE CORNER/, file);
    assert.doesNotMatch(source, /\bBookmark\b/, file);
  }
});

const { setSimpleDisplay } = await import('../src/lib/reading-preferences');

test('简洁显示 keeps two tap targets per number (the bar and its contact); every other copy is text on one line', async () => {
  setSimpleDisplay(true);
  try {
    const view = await article(SENIOR);
    const taps = [...view.container.querySelectorAll('a[href="tel:+18005102020"]')].filter(link => !link.closest('.gd-carousel'));
    assert.equal(taps.length, 2, taps.map(link => link.className).join(' | '));
    assert.ok(taps.some(link => link.closest('.gd-bar')) && taps.some(link => link.closest('.gd-contact')));
    // The copies that print as text keep the number on one line (never "800-/510-2020" at 简洁 / 家人版 sizes).
    const walker = document.createTreeWalker(view.container, dom.window.NodeFilter.SHOW_TEXT);
    let plain = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement!;
      if (!/800-510-2020/.test(node.textContent!) || parent.closest('a, .gd-carousel, .gd-contact__number')) continue;
      plain++;
      assert.ok(parent.closest('.gd-nowrap'), `"${node.textContent}" in .${parent.className}`);
    }
    assert.ok(plain >= 2, `${plain} plain copies`);
  } finally { setSimpleDisplay(false); }
});

const { editionState, guideCardLines, inSeason } = await import('../src/features/guides/guide-facts');

test('guideCardLines: the current edition first on line 1, the sources and the region on line 2, English singular / plural', () => {
  const card = { sourceCount: 1, readMinutes: 4, editionMonth: '2026-10', regions: ['east-bay' as const] };
  assert.deepEqual(guideCardLines(card, '2026-10-20'), { when: { zh: '10 月本期 · 约 4 分钟', en: 'Oct edition · 4 min read' }, meta: { zh: '1 个官方来源 · 东湾', en: '1 official source · East Bay' } });
  assert.deepEqual(guideCardLines({ sourceCount: 3, readMinutes: 2 }, '2026-10-20'), { when: { zh: '约 2 分钟', en: '2 min read' }, meta: { zh: '3 个官方来源', en: '3 official sources' } });
  // An edition says 本期 only while it is current: not before its month, not after its last day.
  assert.equal(guideCardLines({ ...card, editionMonth: '2026-11' }, '2026-10-20').when.zh, '约 4 分钟');
  assert.equal(guideCardLines({ ...card, editionMonth: '2026-11', editionThroughDate: '2026-11-15' }, '2026-11-20').when.zh, '约 4 分钟');
  assert.deepEqual(guideCardLines({ ...card, editionMonth: '2026-11', editionThroughDate: '2026-11-15' }, '2026-11-10').when, { zh: '11/1–11/15 本期 · 约 4 分钟', en: 'Nov 1–Nov 15 edition · 4 min read' });
  // The label follows the coverage, not the file month (lib/edition-label): an "11 月" edition that starts on 10-07 is current
  // on 10-20 and says its days, never "11 月本期" beside October's own edition.
  assert.deepEqual(guideCardLines({ ...card, editionMonth: '2026-11', editionStartDate: '2026-10-07', editionThroughDate: '2026-11-30' }, '2026-10-20').when, { zh: '10/7–11/30 本期 · 约 4 分钟', en: 'Oct 7–Nov 30 edition · 4 min read' });
  assert.equal(guideCardLines({ ...card, editionMonth: '2026-11', editionStartDate: '2026-10-05' }, '2026-10-20').when.zh, '10/5–11/30 本期 · 约 4 分钟');
  assert.equal(guideCardLines({ ...card, editionMonth: '2027-01', editionStartDate: '2026-11-26', editionThroughDate: '2027-01-01' }, '2026-12-01').when.zh, '11/26–1/1 本期 · 约 4 分钟');
  assert.equal(guideCardLines({ ...card, editionMonth: '2026-11', editionStartDate: '2026-11-01', editionThroughDate: '2026-11-30' }, '2026-11-02').when.zh, '11 月本期 · 约 4 分钟');
});

test('one edition rule for the head, the 往期 notice, the rows and the previews (today 2026-11-20)', async () => {
  const half = { editionMonth: '2026-11', editionThroughDate: '2026-11-15' };
  const holiday = { editionMonth: '2027-01', editionStartDate: '2026-11-26', editionThroughDate: '2027-01-01' };
  assert.equal(editionState(half, '2026-11-20'), 'past');
  assert.equal(editionState(half, '2026-11-15'), 'current');
  assert.equal(editionState(holiday, '2026-11-20'), 'upcoming');
  assert.equal(editionState(holiday, '2026-11-26'), 'current');
  assert.equal(editionState({ editionMonth: '2026-11' }, '2026-10-20'), 'upcoming');
  assert.equal(editionState({}, '2026-11-20'), undefined);
  // Previews: current first, a past edition out, the rest in order.
  const cards = [{ slug: 'a' }, { slug: 'b', ...half }, { slug: 'c', ...holiday }, { slug: 'd', editionMonth: '2026-11' }];
  assert.deepEqual(inSeason(cards, '2026-11-20').map(card => card.slug), ['d', 'a', 'c']);
  // The reader: a half-month edition past its last day keeps its full 往期 notice (a content date, never a check) and no 本期.
  const past = 'east-bay-november-nature-programs-2026';
  if (!peekGuide(past)) await loadGuide(past);
  const view = render(<MemoryRouter><GuideDetail slug={past} today="2026-11-20" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></MemoryRouter>);
  const notice = view.container.querySelector('.bl-guide-edition-notice')!;
  assert.ok(notice, 'the 往期 notice');
  assert.match(notice.textContent!, /往期攻略/);
  assert.match(notice.textContent!, /内容更新 \d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(notice.textContent!, /核对日期/);
  assert.equal(view.container.querySelector('.gd-meta__item[data-edition]'), null);
  cleanup();
  const current = render(<MemoryRouter><GuideDetail slug={past} today="2026-11-10" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></MemoryRouter>);
  assert.equal(current.container.querySelector('.bl-guide-edition-notice'), null);
  assert.match(current.container.querySelector('.gd-meta__item[data-edition="current"]')!.textContent!, /本期$/);
  cleanup();
  // An upcoming edition with its own dates names them (as the base's box did), without 本期.
  const holidaySlug = 'bay-area-holiday-hours-thanksgiving-new-year-2026';
  if (!peekGuide(holidaySlug)) await loadGuide(holidaySlug);
  const soon = render(<MemoryRouter><GuideDetail slug={holidaySlug} today="2026-10-20" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></MemoryRouter>);
  assert.match(soon.container.querySelector('.gd-meta__item[data-edition="upcoming"]')!.textContent!, /^适用 2026\D+11\D+26/);
});

const { GuideToTop } = await import('../src/features/guides/GuidePageParts');

test('回到顶部: hidden until two screens down, then a jump (no smooth scroll) in 简洁显示 and under reduced motion', (t: TestContext) => {
  const view = render(<GuideToTop />);
  const button = view.container.querySelector<HTMLButtonElement>('.gd-to-top')!;
  assert.equal(button.getAttribute('aria-label'), '回到顶部');
  assert.equal(button.hidden, true);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: window.innerHeight * 2 + 10 });
  act(() => { window.dispatchEvent(new dom.window.Event('scroll')); });
  assert.equal(button.hidden, false);
  const calls: ScrollToOptions[] = [];
  t.mock.method(window, 'scrollTo', (options: ScrollToOptions) => { calls.push(options); });
  document.documentElement.setAttribute('data-simple', '');
  try { act(() => { button.click(); }); } finally { document.documentElement.removeAttribute('data-simple'); }
  assert.deepEqual(calls.at(-1), { top: 0, behavior: 'auto' });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

const { GuidesHome } = await import('../src/components/GuidesHome');
const { regionSheet } = await import('../src/features/guides/region-sheet');

function IndexHarness() {
  const location = useLocation();
  return <><output data-testid="location">{location.pathname}{location.search}</output><GuidesHome onOpenGuide={noop} /></>;
}

test('RC-25: when the 地区 sheet cannot load (offline), the page stays and the regions show as an inline chip row', async (t: TestContext) => {
  t.mock.method(regionSheet, 'load', () => Promise.reject(new Error('offline')));
  const view = render(<MemoryRouter initialEntries={['/guides']}><IndexHarness /></MemoryRouter>);
  await act(async () => { view.getByRole('button', { name: '地区：整个湾区' }).click(); });
  const regions = await view.findByRole('group', { name: '地区' }, { timeout: 15000 });
  assert.ok(view.container.querySelector('.gl-page'), 'the page is still there');
  await act(async () => { within(regions).getByRole('button', { name: '东湾' }).click(); });
  assert.equal(new URL(view.getByTestId('location').textContent!, 'http://localhost').searchParams.get('region'), 'east-bay');
});

test('RC-25: when search cannot load, 重试 sits above the band and the topic sections, and the count stays quiet', async () => {
  failing.corpus = true;
  try {
    const view = render(<MemoryRouter initialEntries={['/guides?q=看医生']}><IndexHarness /></MemoryRouter>);
    await view.findByText('搜索暂时没能加载', undefined, { timeout: 15000 });
    assert.ok(view.getByRole('button', { name: /重试/ }));
    assert.ok(view.getByRole('region', { name: '长辈与家属先看' }), 'the band stays');
    assert.ok(view.container.querySelectorAll('.gl-section[aria-labelledby^="gl-topic-"]').length >= 6, 'the topic sections stay');
    assert.equal(view.container.querySelector('.gl-count')!.textContent, '');
  } finally { failing.corpus = false; }
});

const { ReadingShelfView } = await import('../src/components/ReaderLibrary');

test('RC-25: ?view=saved with nothing saved says 还没有收藏 and leads to the 长辈与家属 guides', () => {
  const view = render(<MemoryRouter initialEntries={['/guides?view=saved']}><ReadingShelfView saved={{ ids: [], known: true, busy: () => false, remove: noop }} /></MemoryRouter>);
  assert.ok(view.getByRole('heading', { name: '还没有收藏' }));
  assert.equal(view.getByRole('link', { name: /长辈与家属/ }).getAttribute('href'), '/guides?topic=elders');
  assert.equal(view.queryByText(/你的阅读角落/), null);
});
