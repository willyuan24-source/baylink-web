import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GuideImage } from '../src/data/guide-media';
import type { GuideBlock } from '../src/data/guides';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// JSDOM does not perform layout. Give connected, visible elements a box so the
// existing modal's actual focus trap can run without changing its implementation.
Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', {
  configurable: true,
  value: function (this: HTMLElement) {
    return this.isConnected && !this.closest('[hidden]') ? [this.getBoundingClientRect()] : [];
  },
});

const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { GuideFigure, GuideRouteRenderer } = await import('../src/components/GuideVisuals');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideBySlug, guides } = await import('../src/data/guides');
const { keepInlineImage } = await import('../src/features/guides/guide-data');
// The deals board is a chunk the article loads with its record (WEB-DATA-SPLIT); the page waits for it, so do the tests.
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();
const { getGuideMedia, GUIDE_IMAGES, AI_COVER_APPROVALS } = await import('../src/data/guide-media');
/**
 * ③④ pool pictures (the owner's category photos and approved AI covers, 2026-10-21): cover.ts lets one come back on a page
 * (ADJACENT_CARDS apart, or the farthest when a card has no other candidate; never an information card).
 */
const poolSrcs = new Set([...AI_COVER_APPROVALS.map(approval => GUIDE_IMAGES[approval.key].src),
  ...Object.values(GUIDE_IMAGES).filter(image => typeof image.rights === 'object' && image.rights?.basis === 'stock').map(image => image.src)]);
const articleImages = (slug: string) => {
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} {...guideProps} /></StaticRouter>);
  // "Read next" renders three rows for a phone and four covers for a desktop; CSS shows one of the two (UI9-GUIDES).
  const page = new JSDOM(html).window.document;
  page.querySelectorAll('.gd-related__rows').forEach(rows => rows.remove());
  return page;
};

afterEach(() => { cleanup(); document.body.style.overflow = ''; });

const photo: GuideImage = {
  src: '/test/coast.webp', srcSet: '/test/coast-small.webp 480w, /test/coast.webp 1200w',
  alt: '海岸步道与远处海湾', caption: '海岸环境资料照片，不表示今天的开放情况。',
  credit: '示例摄影者 · CC BY-SA', creditUrl: 'https://example.com/source',
  licenseUrl: 'https://example.com/license', kind: 'photo', width: 1200, height: 800,
};
const route: Extract<GuideBlock, { type: 'route' }> = {
  type: 'route', title: '海岸短程往返', text: '先读公告，再按体力选择折返点。',
  stops: [
    { title: '入口集合', text: '认清集合点和公告牌。', mapUrl: 'https://example.com/map/start' },
    { title: '沿步道慢走', text: '停留在当天开放的正式步道。' },
    { title: '原路返回', text: '所有同行者一起返回集合点。', mapUrl: 'https://example.com/map/return' },
  ],
};
const guideProps = { onBack: () => {}, onOpenGuide: () => {}, onNavigate: () => {}, onOpenPost: () => {} };
const article = (slug: string) => <MemoryRouter><GuideDetail slug={slug} returnTo="/guides?q=海边" {...guideProps} /></MemoryRouter>;

test('guide figures preserve image dimensions, responsive sources, provenance, and lazy inline loading', () => {
  const view = render(<GuideFigure image={photo} variant="cover" />);
  const img = view.getByRole('img', { name: photo.alt });
  assert.equal(img.getAttribute('width'), '1200');
  assert.equal(img.getAttribute('height'), '800');
  assert.equal(img.getAttribute('loading'), 'eager');
  assert.equal(img.getAttribute('srcset'), photo.srcSet);
  assert.equal(view.getByText(photo.caption).tagName, 'P');
  assert.equal(view.getByRole('link', { name: /图片授权/ }).getAttribute('href'), photo.licenseUrl);
  assert.equal(view.getByRole('link', { name: /示例摄影者/ }).getAttribute('rel'), 'noopener noreferrer');
  assert.equal(view.queryByText('AI 示意图 · 非实景照片'), null);

  const illustration: GuideImage = { ...photo, src: '/test/illustration.webp', kind: 'illustration' };
  view.rerender(<GuideFigure image={illustration} />);
  assert.equal(view.getByRole('img').getAttribute('loading'), 'lazy');
  assert.ok(view.getByText('AI 示意图 · 非实景照片'));
  view.rerender(<GuideFigure image={illustration} variant="poster" />);
  assert.equal(view.queryByText('AI 示意图 · 非实景照片'), null, 'legacy poster provenance must not be invented');
});

test('zoom dialog traps focus, retains credit links, and restores focus and scrolling when closed', () => {
  document.body.style.overflow = 'auto';
  const view = render(<GuideFigure image={photo} />);
  const opener = view.getByRole('button', { name: `放大图片：${photo.alt}` });
  opener.focus();
  fireEvent.click(opener);
  const dialog = view.getByRole('dialog', { name: `图片放大：${photo.alt}` });
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(document.body.style.overflow, 'hidden');
  const close = within(dialog).getByRole('button', { name: '关闭放大图片' });
  assert.equal(document.activeElement, close);
  const license = within(dialog).getByRole('link', { name: /图片授权/ });
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, license);
  fireEvent.keyDown(license, { key: 'Tab' });
  assert.equal(document.activeElement, close);
  fireEvent.click(within(dialog).getByRole('img'));
  assert.ok(view.getByRole('dialog'), 'clicking the image must not close the overlay');
  fireEvent.keyDown(close, { key: 'Escape' });
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.activeElement, opener);
  assert.equal(document.body.style.overflow, 'auto');

  fireEvent.click(opener);
  fireEvent.click(view.getByRole('button', { name: '关闭放大图片' }));
  assert.equal(view.queryByRole('dialog'), null);
  fireEvent.click(opener);
  fireEvent.click(view.getByRole('dialog'));
  assert.equal(view.queryByRole('dialog'), null, 'backdrop is also a usable close target');
});

test('changing an image closes its old dialog and releases the page scroll lock', () => {
  const view = render(<GuideFigure image={photo} />);
  fireEvent.click(view.getByRole('button', { name: `放大图片：${photo.alt}` }));
  assert.ok(view.getByRole('dialog'));
  view.rerender(<GuideFigure image={{ ...photo, src: '/test/next.webp', alt: '另一张配图' }} />);
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(view.getByRole('img').getAttribute('src'), '/test/next.webp');
});

test('route server HTML contains all steps and safe map links without hiding the no-JavaScript text', () => {
  const html = renderToStaticMarkup(<GuideRouteRenderer block={route} id="route-test" />);
  const server = new JSDOM(html).window.document;
  assert.equal(server.querySelectorAll('.guide-route-stop').length, 3);
  assert.equal(server.querySelectorAll('[hidden]').length, 0);
  assert.equal(server.querySelectorAll('[role="tab"]').length, 0, 'SSR must not expose nonfunctional controls');
  for (const stop of route.stops) assert.ok(server.body.textContent?.includes(stop.text));
  const maps = server.querySelectorAll('a');
  assert.equal(maps.length, 2);
  for (const map of maps) {
    assert.equal(map.target, '_blank');
    assert.equal(map.rel, 'noopener noreferrer');
  }
  const unsafe = renderToStaticMarkup(<GuideRouteRenderer id="unsafe" block={{ ...route, stops: [{ title: '无地图', text: '仍保留这站说明。', mapUrl: 'javascript:alert(1)' }] }} />);
  assert.equal(new JSDOM(unsafe).window.document.querySelectorAll('a').length, 0);
});

test('route tabs support keyboard selection, wrapping, previous/next controls and accurate map targets', () => {
  const view = render(<GuideRouteRenderer block={route} id="route-test" />);
  const tabs = view.getAllByRole('tab');
  assert.equal(view.getAllByRole('tabpanel').length, 1);
  assert.equal(view.getByRole('button', { name: '上一站' }).hasAttribute('disabled'), true);
  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
  assert.equal(document.activeElement, tabs[1]);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].tabIndex, -1);
  assert.equal(tabs[1].tabIndex, 0);
  assert.ok(view.getByRole('tabpanel', { name: /沿步道慢走/ }));
  assert.equal(view.queryByRole('link', { name: /在地图中查看/ }), null);
  fireEvent.keyDown(tabs[1], { key: 'End' });
  assert.equal(document.activeElement, tabs[2]);
  assert.equal(view.getByRole('button', { name: '下一站' }).hasAttribute('disabled'), true);
  assert.equal(view.getByRole('link', { name: /在地图中查看：原路返回/ }).getAttribute('href'), route.stops[2].mapUrl);
  fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });
  assert.equal(document.activeElement, tabs[0], 'arrow navigation wraps at the route boundary');
  fireEvent.click(view.getByRole('button', { name: '下一站' }));
  assert.equal(document.activeElement, tabs[1]);
  fireEvent.click(view.getByRole('button', { name: '上一站' }));
  assert.equal(document.activeElement, tabs[0]);
  fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
  assert.equal(document.activeElement, tabs[2]);
  fireEvent.keyDown(tabs[2], { key: 'Home' });
  assert.equal(document.activeElement, tabs[0]);
});

test('complete guide places kept inline media after the selected section and preserves source, contents and return links', () => {
  // A guide whose inline picture is its own subject (a photo); generic and off-topic pictures are hidden (GUIDE-05).
  const slug = 'sf-golden-gate-bridge-fort-point-guide';
  const guide = getGuideBySlug(slug);
  assert.ok(guide);
  const media = getGuideMedia(guide);
  const kept = media.inline.filter(item => keepInlineImage(item.image, guide, guides));
  assert.ok(kept.length >= 1, 'this guide keeps its inline photo');
  const view = render(article(slug));
  const prose = view.container.querySelector('.bl-guide-prose');
  assert.ok(prose);
  // The cover is a photo cover with its provenance badge (honesty ladder), not a second captioned figure.
  const cover = view.container.querySelector('.gd-cover');
  assert.ok(cover);
  assert.ok(cover.querySelector('[data-provenance]'));
  assert.equal(view.container.querySelectorAll('.guide-figure--cover').length, 0);
  assert.equal(prose.querySelectorAll('.guide-figure--inline').length, kept.length);
  for (const item of kept) {
    const figure = Array.from(prose.querySelectorAll('figure')).find(element => element.querySelector('img')?.getAttribute('src') === item.image.src);
    assert.ok(figure);
    let cursor = figure.previousElementSibling;
    while (cursor && cursor.tagName !== 'H2') cursor = cursor.previousElementSibling;
    const headings = Array.from(prose.querySelectorAll(':scope > h2'));
    assert.equal(cursor, headings[item.afterHeading - 1]);
    assert.equal(figure.nextElementSibling, headings[item.afterHeading] || null, 'image comes after the complete section and before the next heading');
  }
  assert.ok(view.getByRole('navigation', { name: '文章目录' }));
  assert.ok(view.getByRole('heading', { name: '官方来源' }));
  assert.equal(view.getByRole('link', { name: '返回湾区指南' }).getAttribute('href'), '/guides?q=海边');
  assert.equal(view.getAllByRole('tabpanel').length, 1, 'the real article route is interactive');
  // Credits for every picture shown on the page are listed once, under the sources.
  const credits = view.container.querySelector('.gd-credits');
  assert.ok(credits);
  assert.equal(credits.querySelectorAll('li').length, new Set([getGuideMedia(guide).cover.src, ...kept.map(item => item.image.src)]).size);
});

test('off-topic inline pictures are hidden: the stock laptop photo and shared AI theme illustrations', () => {
  for (const slug of ['bay-area-medicare-hicap-medi-cal-guide', 'half-moon-bay-coastal-half-day-guide', 'bay-area-naturalization-official-path-guide']) {
    const guide = getGuideBySlug(slug);
    assert.ok(guide);
    const view = render(article(slug));
    const sources = Array.from(view.container.querySelectorAll('img')).map(img => img.getAttribute('src'));
    // The owner-approved Commons photos (CNT-MEDIA-4) and guide photos (CNT-MEDIA-5: the public-domain HHS photo in the Medicare
    // guide) are on topic and shown; the stock laptop photo and AI art stay hidden.
    for (const item of getGuideMedia(guide).inline) {
      const shown = item.image.src.startsWith('/guides/commons/') || item.image.src.startsWith('/guides/guide-photos/');
      assert.equal(sources.includes(item.image.src), shown, `${slug}: ${item.image.src} is ${shown ? 'shown' : 'hidden'}`);
    }
    cleanup();
  }
});

test('switching guide slugs resets route and checklist state and closes any enlarged image', () => {
  const first = 'sf-golden-gate-bridge-fort-point-guide';
  const second = 'sf-fishermans-wharf-pier39-guide';
  const view = render(article(first));
  const tabs = view.getAllByRole('tab');
  fireEvent.click(tabs[tabs.length - 1]);
  const checklist = view.getAllByRole('checkbox')[0] as HTMLInputElement;
  fireEvent.click(checklist);
  assert.equal(checklist.checked, true);
  fireEvent.click(view.getAllByRole('button', { name: /^放大图片：/ })[0]);
  assert.ok(view.getByRole('dialog'));
  view.rerender(article(second));
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(view.getAllByRole('tab')[0].getAttribute('aria-selected'), 'true');
  assert.ok(view.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked));
  view.rerender(article(first));
  assert.equal(view.getAllByRole('tab')[0].getAttribute('aria-selected'), 'true');
  assert.ok(view.getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked));
});

test('legacy poster remains expandable and full guide server rendering retains every itinerary description', () => {
  const view = render(article('san-francisco-guide'));
  const disclosure = view.container.querySelector<HTMLDetailsElement>('.guide-poster-disclosure');
  assert.ok(disclosure);
  assert.equal(disclosure.open, false);
  assert.equal(disclosure.querySelector('summary')?.textContent, '查看原版图文海报');
  assert.equal(disclosure.querySelector('img')?.getAttribute('src'), getGuideBySlug('san-francisco-guide')?.cover);
  assert.equal(disclosure.querySelector('img')?.getAttribute('width'), '1055');
  assert.equal(disclosure.querySelector('.guide-image-kind'), null);

  const slug = 'half-moon-bay-coastal-half-day-guide';
  const guide = getGuideBySlug(slug);
  assert.ok(guide);
  const routeBlock = guide.blocks.find(block => block.type === 'route');
  assert.ok(routeBlock);
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} {...guideProps} /></StaticRouter>);
  const server = new JSDOM(html).window.document;
  for (const stop of routeBlock.stops) assert.ok(server.body.textContent?.includes(stop.text));
  assert.equal(server.querySelectorAll('.guide-route-stop[hidden]').length, 0);
});

test('no article shows the same picture twice: a related guide, an inline figure or the legacy poster never repeats a picture already on the page', () => {
  const repeats: string[] = [];
  for (const guide of guides) {
    // Posters letterbox on a blurred copy of themselves (one picture, two <img>); count the picture once.
    const page = articleImages(guide.slug);
    // A ③④ pool picture may come back (cover.ts); the todo test below tracks where it does.
    const images = Array.from(page.querySelectorAll('img:not(.ui-cover__backdrop)')).filter(image => !poolSrcs.has(image.getAttribute('src') ?? ''));
    // The deals board (FreebieBoard, WEB-EVENTS) reuses an offer picture across offers and shows the lead offer's photo,
    // which the deals guides keep as their cover (monthly-deals-ui); every other picture appears once on the page.
    const inBoard = (image: Element) => !!image.closest('[id^="freebie-board-"]');
    const lead = new Set(images.filter(image => image.closest('.gd-lead')).map(image => image.getAttribute('src')));
    const board = new Set(images.filter(inBoard).map(image => image.getAttribute('src')));
    const seen = new Set<string | null>();
    for (const image of images.filter(image => !inBoard(image))) {
      const src = image.getAttribute('src');
      if (seen.has(src) || (board.has(src) && !lead.has(src))) repeats.push(`${guide.slug}: ${src}`);
      seen.add(src);
    }
  }
  assert.deepEqual(repeats, []);
});

// UI9-IMG-A1b: guide cards now show their ③ category photos (DECISIONS 22: ③ before ④; the four 'everyday' AI repeats are
// gone), and the build gives each 接下来 card a pool picture the page does not show yet (generate-guide-data.ts
// distinctRelated). These pages still repeat one, because their category's pool is smaller than the page's same-category
// cards (guide-school 3, guide-housing 3, shopping 7 with the deals board's offers): B2 adds pictures (owner approval), then
// this list shrinks to []. Pinned, so any other ③④ repeat fails here.
const KNOWN_POOL_REPEATS = [
  'bay-area-city-utilities-internet-phone-directory: /guides/category-stock/stock-guide-housing-4.webp',
  'bay-area-first-7-30-days-action-plan-october-2026: /guides/category-stock/stock-guide-housing-4.webp',
  'bay-area-first-rental-process: /guides/category-stock/stock-guide-housing-2.webp',
  'bay-area-freebies-deals-2026-10: /guides/category-stock/stock-shopping-2.webp',
  'bay-area-freebies-deals-2026-11: /guides/category-stock/stock-shopping-2.webp',
  'bay-area-rental-scam-guide: /guides/category-stock/stock-guide-housing-1.webp',
  'east-bay-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-1.webp',
  'east-bay-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-1.webp',
  'local-service-safety-guide: /guides/category-stock/stock-guide-housing-4.webp',
  'move-in-move-out-checklist: /guides/category-stock/stock-guide-housing-4.webp',
  'north-bay-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-2.webp',
  'north-bay-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-3.webp',
  'peninsula-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-2.webp',
  'peninsula-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-3.webp',
  'rental-lease-checklist-before-signing: /guides/category-stock/stock-guide-housing-2.webp',
  'sf-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-1.webp',
  'sf-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-1.webp',
  'south-bay-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-2.webp',
  'south-bay-school-district-enrollment-guide: /guides/category-stock/stock-guide-school-3.webp',
];
test('no article repeats a ③④ pool picture either, beyond the known repeats of categories with too few pictures', () => {
  const repeats: string[] = [];
  for (const guide of guides) {
    const seen = new Set<string>();
    for (const image of articleImages(guide.slug).querySelectorAll('img:not(.ui-cover__backdrop)')) {
      const src = image.getAttribute('src') ?? '';
      if (!poolSrcs.has(src)) continue;
      if (seen.has(src)) repeats.push(`${guide.slug}: ${src}`);
      seen.add(src);
    }
  }
  assert.deepEqual([...repeats].sort(), [...KNOWN_POOL_REPEATS].sort());
});
