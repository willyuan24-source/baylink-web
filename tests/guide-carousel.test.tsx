import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideEditorial } = await import('../src/data/guide-editorial');
const { guideCover } = await import('../src/features/guides/guide-facts');
const { peekGuide } = await import('../src/features/guides/guide-store');
const { setLocale, loadLocale } = await import('../src/i18n/locale');
// The SF outing guide below has a 3D link, a block renderer loaded with its record (guide-blocks.ts).
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const SENIOR = 'bay-area-chinese-senior-services-referral-guide';
const props = { onOpenGuide: () => {}, onNavigate: () => {}, onOpenPost: () => {} };
const article = (slug: string) => render(<MemoryRouter initialEntries={[`/guides/${slug}`]}><GuideDetail slug={slug} today="2026-10-10" {...props} /></MemoryRouter>);
const carouselOf = (view: ReturnType<typeof render>) => view.getByRole('region', { name: /(张图解|張圖解|cards)$/ });

test('the senior guide opens with a carousel: a cover with the first answer as a call link, then one slide per point', () => {
  const view = article(SENIOR);
  const editorial = getGuideEditorial(SENIOR)!;
  const carousel = carouselOf(view);
  assert.equal(carousel.getAttribute('aria-roledescription'), '轮播');
  const slides = within(carousel).getAllByRole('group', { name: /^\d+ \/ \d+$/ });
  assert.equal(slides.length, editorial.slides.length + 1);
  assert.equal(slides[0].getAttribute('aria-label'), `1 / ${slides.length}`);
  const answer = slides[0].querySelector('.gd-answer a')!;
  assert.equal(answer.getAttribute('href'), 'tel:+18005102020');
  assert.match(answer.getAttribute('aria-label')!, /^拨打 .*800-510-2020$/);
  // The cover sits before the 30-second card (look → check); the action bar (DETAIL's contract, UI9-GUIDES) follows them,
  // its one primary last: 拨打 the cover's number.
  const keyFacts = view.getByRole('heading', { name: '30 秒看懂' });
  assert.ok(carousel.compareDocumentPosition(keyFacts) & Node.DOCUMENT_POSITION_FOLLOWING);
  const actions = view.getByRole('group', { name: '这一页的操作' });
  assert.ok(keyFacts.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(actions.lastElementChild?.getAttribute('href'), 'tel:+18005102020');
  // Every slide but the cover names its source; county numbers are tap-to-call.
  for (const slide of slides.slice(1)) assert.ok(slide.querySelector('.gd-slide__source')?.textContent);
  const county = slides.find(slide => slide.textContent?.includes('各县 AAA 电话'))!;
  assert.equal(county.querySelectorAll('a[href^="tel:"]').length, 8);
  assert.ok(within(county).getByRole('link', { name: '拨打 San Francisco 415-355-3555' }));
});

test('the carousel moves with its buttons and with ←/→, and never autoplays', () => {
  const view = article(SENIOR);
  const carousel = carouselOf(view);
  const counter = carousel.querySelector('.ui-carousel__counter')!;
  const total = getGuideEditorial(SENIOR)!.slides.length + 1;
  assert.equal(counter.textContent, `1/${total}`);
  fireEvent.click(within(carousel).getByRole('button', { name: '下一张' }));
  assert.equal(counter.textContent, `2/${total}`);
  fireEvent.keyDown(carousel.querySelector('.ui-carousel__track')!, { key: 'ArrowLeft' });
  assert.equal(counter.textContent, `1/${total}`);
  assert.equal((within(carousel).getByRole('button', { name: '上一张' }) as HTMLButtonElement).disabled, true);
});

test('the carousel reads in English on /en and in Traditional Chinese on /zh-Hant', async () => {
  await loadLocale('en');
  await setLocale('en', false);
  let view = article(SENIOR);
  let carousel = carouselOf(view);
  assert.doesNotMatch(carousel.textContent!, /[㐀-鿿]/u, 'no Chinese in the English carousel');
  assert.ok(within(carousel).getByText('Name the kind of help'));
  // The cover kicker matches the head meta line: de-duplicated sources and an English date, never the ISO date.
  assert.match(carousel.querySelector('.gd-slide__kicker')!.textContent!, /^\d+ official sources? · updated [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  cleanup();
  await setLocale('zh-Hant', false);
  view = article(SENIOR);
  carousel = carouselOf(view);
  assert.match(carousel.textContent!, /長者/);
  assert.doesNotMatch(carousel.textContent!, /长者/);
});

test('guides without pilot data keep a photo cover or no picture, never a carousel', () => {
  const view = article('bay-area-airport-arrival-guide');
  assert.equal(view.container.querySelector('.gd-carousel'), null);
  const cover = view.container.querySelector('.gd-cover');
  assert.ok(cover, 'the airport guide has a photo cover');
  assert.ok(cover.querySelector('[data-provenance]')?.textContent);
  assert.equal(cover.querySelector('img')?.getAttribute('loading'), 'eager');
  // A paperwork guide whose own cover is an AI illustration lists with its topic's ③ 示意图 (UI9-IMAGES DECISIONS 21). A pilot
  // guide opens on that title picture too, its slides under it (captain 10-22 02:50: the slides are not the page's picture).
  const slug = 'bay-area-rental-scam-guide';
  const listed = guideCover({ slug, covers: peekGuide(slug)!.covers }, '2026-10-10');
  assert.equal(listed.tier, 'stock');
  const scam = article(slug);
  const lead = scam.container.querySelector('.gd-lead__visual')!;
  assert.equal(lead.firstElementChild?.className, 'gd-cover-figure', 'the title picture comes first');
  assert.equal(lead.querySelector('.gd-cover img')?.getAttribute('src'), listed.tier !== 'type' ? listed.image.src : '', 'the ③ picture, never the AI art');
  assert.equal(lead.querySelector('.gd-cover')?.getAttribute('data-tier'), 'stock');
  assert.ok(lead.querySelector('.gd-cover-figure + .gd-carousel'), 'the slides follow under it');
});

test('a slide is 3:4 at least but never a fixed 3:4 box: at 特大, in 简洁显示 and in English it grows instead of clipping', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/features/guides/guide-article.css', import.meta.url), 'utf8');
  const rule = /^\.gd-slide \{([^}]*)\}/m.exec(css)?.[1] ?? '';
  // UI9-GUIDES: on a phone the floor stops at 360 px so the cover and 30 秒看懂 share the first screen; a wider slide keeps 3:4.
  assert.match(rule, /min-height:min\(calc\(100cqw \* 4 \/ 3\), 22\.5rem\)/, 'the 3:4 floor follows the slide width, up to 360 px');
  assert.match(css, /@container \(min-width:23rem\) \{ \.gd-slide \{ min-height:calc\(100cqw \* 4 \/ 3\);/, 'a wider slide keeps 3:4');
  assert.match(rule, /height:100%/, 'the track stretches every slide to the tallest one');
  assert.doesNotMatch(css, /\.gd-slide[^{]*\{[^}]*(?:aspect-ratio|max-height|overflow:hidden)/, 'no fixed ratio or clipping on a slide');
});

test('English "Read next" cards say "1 official source" in the singular, like the index and the head meta line', async () => {
  await loadLocale('en');
  await setLocale('en', false);
  // Its Read next list holds three outings with one official source each (Alviso, Half Moon Bay, Sonoma).
  const view = article('sf-autumn-art-half-day-2026');
  const related = view.getByRole('heading', { name: 'Read next' }).closest('section')!;
  // UI9-GUIDES: two meta lines, the time first ("N min read"), then the sources ("1 official source"[ · region]).
  const grid = related.querySelector('.gd-related__grid')!;
  const whens = [...grid.querySelectorAll('.ui-feed-card__when')].map(line => line.textContent!);
  assert.equal(whens.length, grid.querySelectorAll('article').length, 'every card has a time line');
  assert.ok(whens.every(text => /^(?:(?:\w{3}|\w{3} \d+–\w{3} \d+) edition · )?\d+ min read$/.test(text)), whens.join(' | '));
  const metas = [...grid.querySelectorAll('.ui-feed-card__meta')].map(meta => meta.textContent!);
  assert.ok(metas.some(text => /^1 official source(?: · .+)?$/.test(text)), metas.join(' | '));
  assert.ok(metas.every(text => /^(?:1 official source|(?:[02-9]|\d{2,}) official sources)(?: · .+)?$|^[A-Z][\w ,]+$/.test(text)), metas.join(' | '));
});
