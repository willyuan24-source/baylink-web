import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

// WEB-GUIDES-READ (Wave 5): 问 BayBay as a draft (H32) with prompts by guide kind (H75), the /guides title and H1 (H34), the
// 3D link on San Francisco outing guides (H36), the county grid (H64), the carousel on touch and in 简洁 (H67), section actions
// at large text (H52), long source lists (H66) and long addresses at 320 px (H24).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { GuidesHome } = await import('../src/components/GuidesHome');
const { getGuideBySlug } = await import('../src/data/guides');
const { bayBayPageQuestions } = await import('../src/lib/baybay-conversation');
const { guideKindOf } = await import('../src/features/guides/guide-kind');
const { GUIDES_METADATA } = await import('../src/lib/guides-metadata');
const { ENTRY_SOURCES } = await import('../src/opus-bay/ui/entrySource');
const { setLocale } = await import('../src/i18n/locale');
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const css = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const article = (slug: string, prefix = '') => new JSDOM(renderToStaticMarkup(<StaticRouter location={`${prefix}/guides/${slug}`}>
  <GuideDetail slug={slug} today="2026-10-13" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></StaticRouter>)).window.document;

test('H32: the guide\'s 问 BayBay opens the panel as a draft (nothing is sent) with a question for this guide', () => {
  const asks: [string, unknown][] = [];
  const view = render(<MemoryRouter initialEntries={['/guides/bay-area-newcomer-first-month-checklist']}>
    <GuideDetail slug="bay-area-newcomer-first-month-checklist" today="2026-10-13" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} onAsk={(question, options) => asks.push([question, options])} />
  </MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '问 BayBay' }));
  assert.equal(asks.length, 1);
  assert.deepEqual(asks[0][1], { mode: 'draft' });
  assert.match(asks[0][0], /第一步做什么、该联系谁、要准备什么/);
});

test('H75: page chips and the drafted question follow the guide kind, not 出发前核实什么 everywhere', async () => {
  await setLocale('zh-Hans', false);
  const chips = (slug: string) => bayBayPageQuestions(`/guides/${slug}`).map(chip => chip.label);
  assert.equal(guideKindOf(getGuideBySlug('bay-area-newcomer-first-month-checklist')!), 'task');
  assert.deepEqual(chips('bay-area-newcomer-first-month-checklist'), ['我该先办哪一步？', '要带哪些材料？']);
  assert.deepEqual(chips('bay-area-medicare-hicap-medi-cal-guide'), ['我该先办哪一步？', '要带哪些材料？']);
  assert.equal(guideKindOf(getGuideBySlug('half-moon-bay-coastal-half-day-guide')!), 'outing');
  assert.ok(chips('half-moon-bay-coastal-half-day-guide').includes('出发前核实什么'), 'an outing still asks what to check before going');
  assert.equal(guideKindOf(getGuideBySlug('bay-area-city-utilities-internet-phone-directory')!), 'directory');
  assert.deepEqual(chips('bay-area-city-utilities-internet-phone-directory'), ['找我所在城市的入口', '先比较哪几项']);
  assert.equal(guideKindOf(getGuideBySlug('bay-area-freebies-deals-2026-10')!), 'deals');
  assert.deepEqual(chips('bay-area-freebies-deals-2026-10'), ['这周还能用哪些？', '哪些不用消费？']);
  assert.deepEqual(chips('sf-school-district-enrollment-guide'), ['先核对学区', '整理入学步骤', '读懂官方资料'], 'school chips unchanged');
  // The K-12 transfer guide (newcomer category, no 学校与学区 tag) is a school guide too: area and grade only, no child documents.
  assert.equal(guideKindOf(getGuideBySlug('bay-area-k12-midyear-enrollment-guide')!), 'school');
  assert.deepEqual(chips('bay-area-k12-midyear-enrollment-guide'), ['先核对学区', '整理入学步骤', '读懂官方资料']);
  for (const slug of ['bay-area-newcomer-first-month-checklist', 'bay-area-311-211-local-help-guide', 'california-driver-license-id-preparation-guide']) assert.ok(!chips(slug).includes('出发前核实什么'), slug);
  await setLocale('en', false);
  assert.deepEqual(chips('bay-area-newcomer-first-month-checklist'), ['What do I do first?', 'What should I bring?']);
  for (const chip of bayBayPageQuestions('/en/guides/bay-area-freebies-deals-2026-10')) assert.doesNotMatch(chip.label + chip.question, /[㐀-鿿]/u);
});

test('H34: /guides is 办事指南 in the title and 办事与生活指南 in the H1, in three locales', async () => {
  assert.equal(GUIDES_METADATA.title, '办事指南｜BAYLINK 湾区去哪、怎么办');
  assert.ok(GUIDES_METADATA.english!.title!.length <= 60);
  const h1 = (path: string) => new JSDOM(renderToStaticMarkup(<StaticRouter location={path}><GuidesHome onOpenGuide={noop} /></StaticRouter>)).window.document.querySelector('h1')!.textContent;
  await setLocale('zh-Hans', false);
  assert.equal(h1('/guides'), '办事与生活指南');
  await setLocale('zh-Hant', false);
  assert.equal(h1('/zh-Hant/guides'), '辦事與生活指南');
  await setLocale('en', false);
  assert.equal(h1('/en/guides'), 'How-to guides for Bay Area life');
});

test('H36: San Francisco outing guides link into the 3D city with a source the game counts; 办事 guides do not', async () => {
  await setLocale('zh-Hans', false);
  const link = (slug: string, prefix = '') => article(slug, prefix).querySelector('a.gd-opus');
  const ggb = link('sf-golden-gate-bridge-fort-point-guide')!;
  assert.equal(ggb.getAttribute('href'), '/opus-bay?world=city&start=free&at=lm-golden-gate-bridge&from=guide');
  assert.match(ggb.textContent!, /在 3D 里先看看.*3D 看金门大桥/);
  assert.ok(ggb.querySelector('img'), 'the place\'s 3D postcard goes with it');
  assert.match(ggb.textContent!, /3D 场景插图/, 'labelled by getImageProvenance');
  const city = link('sf-first-visit-tickets-waterfront-october-2026')!;
  assert.equal(city.getAttribute('href'), '/opus-bay?from=guide');
  for (const slug of ['bay-area-chinese-senior-services-referral-guide', 'san-jose-guide', 'bay-area-311-211-local-help-guide']) assert.equal(link(slug), null, slug);
  await setLocale('en', false, '/guides/sf-golden-gate-bridge-fort-point-guide');
  const english = link('sf-golden-gate-bridge-fort-point-guide', '/en')!;
  // The site's link localization (i18n/host.ts) turns ?lang=en into the hosted /en/opus-bay page; the source stays.
  assert.equal(english.getAttribute('href'), '/en/opus-bay?world=city&start=free&at=lm-golden-gate-bridge&from=guide');
  assert.doesNotMatch(english.textContent!, /[㐀-鿿]/u);
  for (const href of [ggb.getAttribute('href')!, city.getAttribute('href')!, english.getAttribute('href')!]) {
    assert.ok((ENTRY_SOURCES as readonly string[]).includes(new URLSearchParams(href.split('?')[1]).get('from')!), href);
  }
  // The postcard is a .ui-cover, and ui.css (width:100%, same weight, loaded later) once squeezed the text to 0 px: the
  // column width must come from a heavier selector, and ui.css must not out-rank it (Chrome check: lanes/WEB-GUIDES-READ).
  assert.ok(ggb.querySelector('.gd-opus__art.ui-cover'), 'the postcard is a CoverImage');
  const guideCss = css('features/guides/guide-article.css');
  assert.ok(guideCss.includes('.gd-opus>.gd-opus__art { flex:none; width:7.5rem;'), 'the 7.5rem column on the heavier selector');
  assert.doesNotMatch(guideCss, /(?:^|[}\s])\.gd-opus__art \{[^}]*width/u, 'no width on the bare class, which .ui-cover overrides');
  assert.ok(!css('components/ui/ui.css').includes('gd-opus'), 'ui.css never styles the 3D link');
});

test('H66: a deals board\'s long source list folds after eight; a pilot keeps every source its marks point at', async () => {
  await setLocale('zh-Hans', false);
  const deals = article('bay-area-freebies-deals-2026-10');
  const sources = getGuideBySlug('bay-area-freebies-deals-2026-10')!.sources.length;
  assert.ok(sources > 100);
  const list = deals.querySelector('.bl-guide-sources')!;
  assert.equal(list.querySelectorAll(':scope > ul > li').length, 8);
  const more = list.querySelector('details.gd-sources-more')!;
  assert.match(more.querySelector('summary')!.textContent!, new RegExp(`看全部 ${sources} 个官方来源`));
  assert.equal(more.querySelectorAll('li').length, sources - 8);
  const dmv = article('california-driver-license-id-preparation-guide').querySelector('.bl-guide-sources')!;
  assert.equal(dmv.querySelector('details.gd-sources-more'), null);
  assert.equal(dmv.querySelectorAll('li[id^="guide-source-"]').length, getGuideBySlug('california-driver-license-id-preparation-guide')!.sources.length);
});

test('H67, H52, H64, H24: carousel buttons on touch and a list in 简洁; section links under the heading; one-column counties; addresses wrap', () => {
  const guideCss = css('features/guides/guide-article.css');
  assert.match(guideCss, /\.gd-carousel \.ui-carousel :is\(\.ui-carousel__prev,\.ui-carousel__next\) \{ display:inline-grid; width:3rem; height:3rem; \}/, 'H67: 48px buttons at every width');
  assert.match(guideCss, /html\[data-simple\] \.gd-carousel \.ui-carousel__track \{ flex-direction:column;/, 'H67: 简洁 lists the slides');
  assert.match(guideCss, /:is\(html\[data-reading=large\],html\[data-reading=extra-large\],html\[data-simple\]\) \.gd-related__head \{ flex-direction:column;/, 'H52 article');
  assert.match(css('features/guides/guide-library.css'), /:is\(html\[data-reading=large\],html\[data-reading=extra-large\],html\[data-simple\]\) \.gl-section__head \{ flex-direction:column;/, 'H52 index');
  assert.match(guideCss, /@media \(max-width:419px\) \{\s*\.gd-article \.gd-phone-directory \{ grid-template-columns:minmax\(0, 1fr\);/, 'H64');
  assert.match(css('components/guides-ui.css'), /\.bl-guide-prose :is\(p, li, dd\),[\s\S]*?overflow-wrap: break-word;/, 'H24 addresses');
});
