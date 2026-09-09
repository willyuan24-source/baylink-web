import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getGuideBySlug, guides } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { getBayAreaToday, getEventStatus } from '../src/lib/monthly';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
afterEach(() => cleanup());

test('homepage server HTML leads with readable guides, distinct actual images and traceable credits', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery onAskBayBay={() => {}} onBrowseCommunity={() => {}} today="2026-09-09" /></StaticRouter>);
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll('h1').length, 1);
  assert.ok(document.querySelector('.home-discovery-heading a[href="/guides"]'));
  assert.ok(document.querySelector('a[href="/guides/golden-gate-park-free-car-free-day-guide"]'));
  assert.ok(document.querySelector('a[href="/guides/palo-alto-baylands-family-walk-guide"]'));
  assert.ok(document.querySelector('a[href="/this-month"]'));
  assert.ok(document.querySelector('a[href="/guides/bay-area-freebies-deals-2026-09#freebie-board-0"]'));
  assert.match(document.querySelector('.home-discovery-count')!.textContent!, new RegExp(`${guides.length} 篇生活指南`));
  const photos = [...document.querySelectorAll<HTMLImageElement>('.home-discovery-panel img')];
  assert.equal(photos.length, 6);
  const hashes = new Set<string>();
  for (const photo of photos) {
    const src = photo.getAttribute('src')!;
    const image = Object.values(GUIDE_IMAGES).find(item => item.src === src);
    assert.ok(image, `${src} is a registered image`);
    assert.equal(photo.alt, image.alt);
    assert.equal(photo.getAttribute('srcset'), image.srcSet);
    assert.equal(image.kind === 'illustration', false, 'home discovery currently has specific place and official event imagery');
    assert.ok(document.querySelector('.home-discovery-credits')?.textContent?.includes(image.caption));
    assert.ok([...document.querySelectorAll('.home-discovery-credits a')].some(link => link.getAttribute('href') === image.creditUrl));
    hashes.add(createHash('sha256').update(readFileSync(new URL(`../public${src}`, import.meta.url))).digest('hex'));
    if (image.kind === 'poster' || image.fullFrame) assert.ok(photo.closest('.home-discovery-image--full'), 'official complete graphics must use the uncropped image frame');
  }
  assert.equal(hashes.size, 6, 'each editorial surface has a different actual image');
  const hero = document.querySelector('.home-discovery-feature img')!;
  assert.equal(hero.getAttribute('loading'), 'eager');
  assert.equal(hero.getAttribute('fetchPriority')?.toLowerCase(), 'high');
  assert.equal(document.querySelector('.home-discovery-deals img')?.getAttribute('src'), GUIDE_IMAGES['freebie-lowes-haunted-house'].src);
  assert.equal(document.querySelector('.home-discovery-deals .home-discovery-image-label')?.textContent, '官方宣传照片');
});

test('intent switches change the featured guide and all three reading paths without losing community or AI actions', () => {
  let browsed = 0;
  const questions: string[] = [];
  const view = render(<MemoryRouter><HomeDiscovery today="2026-09-09" onBrowseCommunity={() => { browsed += 1; }} onAskBayBay={question => questions.push(question || '')} /></MemoryRouter>);
  for (const [label, slug, expected] of [
    ['日常少麻烦', 'bay-area-library-starter-guide', '图书馆'],
    ['新来先安顿', 'bay-area-airport-arrival-guide', '第一个月'],
    ['周末出门', 'golden-gate-park-free-car-free-day-guide', '半日出游'],
  ]) {
    fireEvent.click(view.getByRole('button', { name: label, exact: true }));
    assert.equal(view.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(view.container.querySelector('.home-discovery-feature')?.getAttribute('href'), `/guides/${slug}`);
    const guide = getGuideBySlug(slug)!;
    assert.equal(view.container.querySelector('.home-discovery-feature img')?.getAttribute('src'), getGuideMedia(guide).cover.src);
    const links = [...view.container.querySelectorAll('.home-discovery-pick')];
    assert.equal(links.length, 3);
    for (const link of links) assert.ok(getGuideBySlug(link.getAttribute('href')!.split('/').at(-1)!));
    assert.equal(new Set([...view.container.querySelectorAll('.home-discovery-feature img, .home-discovery-pick img')].map(image => image.getAttribute('src'))).size, 4);
    fireEvent.click(view.getByRole('button', { name: '帮我安排', exact: true }));
    assert.ok(questions.at(-1)?.includes(expected));
  }
  fireEvent.click(view.getByRole('button', { name: '找本地信息', exact: true }));
  assert.equal(browsed, 1);
  fireEvent.change(view.getByRole('textbox', { name: '告诉 BayBay 你的生活问题' }), { target: { value: '  从 Fremont 出发，不开车，带孩子去公园。  ' } });
  fireEvent.click(view.getByRole('button', { name: '帮我安排', exact: true }));
  assert.equal(questions.at(-1), '从 Fremont 出发，不开车，带孩子去公园。');
});

test('month cards follow Bay Area date, end-of-month counts and archive language across month boundaries', () => {
  const renderAt = (today: string) => <MemoryRouter><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>;
  const today = getBayAreaToday(new Date('2026-10-01T06:59:00Z'));
  assert.equal(today, '2026-09-30');
  const view = render(renderAt(today));
  const remaining = MONTHLY_EVENTS.filter(event => getEventStatus(event, today) !== 'ended').length;
  assert.match(view.container.querySelector('.home-discovery-edition')!.textContent!, new RegExp(`${remaining} 场尚未结束的活动`));
  assert.match(view.container.querySelector('.home-discovery-deals')!.textContent!, /本月福利/);
  assert.equal(view.container.querySelector('.home-discovery-deals img')?.getAttribute('src'), GUIDE_IMAGES['deal-85c-september'].src, 'a September 12 promotion is replaced after its date has passed');
  view.rerender(renderAt(getBayAreaToday(new Date('2026-10-01T07:01:00Z'))));
  const edition = view.container.querySelector('.home-discovery-edition')!;
  const deals = view.container.querySelector('.home-discovery-deals')!;
  assert.match(edition.textContent!, /2026 年 9 月.*往期月刊/);
  assert.equal(edition.getAttribute('href'), '/this-month?includeEnded=1');
  assert.doesNotMatch(edition.textContent!, /本月月刊|尚未结束/);
  assert.match(deals.textContent!, /往期福利/);
  assert.match(deals.textContent!, /不能当作实时优惠/);
  assert.doesNotMatch(deals.textContent!, /本月福利/);
  view.rerender(renderAt('2026-08-31'));
  assert.match(view.container.querySelector('.home-discovery-edition')!.textContent!, /月刊预告/);
  assert.match(view.container.querySelector('.home-discovery-deals')!.textContent!, /福利预告/);
});
