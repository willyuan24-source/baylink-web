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
const hooks = registerHooks({ load(url, context, next) {
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

test('one number per guide: the reader\'s bar and the index\'s 简洁 elder rows call the same number (guideCallOf)', () => {
  const called = guidesIndex.guides.filter(card => card.call);
  assert.ok(called.length >= 8, `${called.length} guides with a number`);
  for (const card of guidesIndex.guides) {
    const call = guideCallOf(getGuideEditorial(card.slug));
    assert.deepEqual(card.call && { number: card.call.number, tel: telOf(card.call.number) }, call && { number: call.number, tel: call.tel }, card.slug);
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

test('G6 and one save glyph: no all-caps English labels and no bookmark on the guide surfaces', () => {
  for (const file of ['src/components/GuideDetail.tsx', 'src/components/ReaderLibrary.tsx', 'src/components/GuidesHome.tsx', 'src/features/guides/GuideActions.tsx', 'src/features/saves/GuideSaveButton.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /YOUR NEXT STEP|YOUR LITTLE CORNER/, file);
    assert.doesNotMatch(source, /\bBookmark\b/, file);
  }
});
