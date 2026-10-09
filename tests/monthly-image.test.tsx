import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { GuideImage } from '../src/data/guide-media';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', {
  configurable: true,
  value: function (this: HTMLElement) { return this.isConnected && !this.closest('[hidden]') ? [this.getBoundingClientRect()] : []; },
});
// The cover primitives import ui.css; here CSS loads as an empty module.
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });

const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventFeedCard } = await import('../src/features/events/EventCards');
const { ImageCredits } = await import('../src/features/events/ImageCredits');
const { getCover } = await import('../src/lib/cover');
const { INDEX_EVENTS } = await import('../src/features/events/events-model');
const { GuideImageCredits } = await import('../src/components/GuideExplorer');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');

const poster: GuideImage = {
  src: '/test/concert-poster.webp', srcSet: '/test/concert-poster-small.webp 480w, /test/concert-poster.webp 1200w',
  alt: '音乐会官方宣传海报', caption: '2026 年音乐会官方宣传图，场次以主办方公告为准。',
  credit: '音乐会主办方 · 官方活动页面', creditUrl: 'https://example.com/concert',
  kind: 'poster', width: 1200, height: 1700,
};
const photo: GuideImage = {
  ...poster, src: '/test/market.webp', srcSet: undefined, alt: '周末市集的摊位',
  caption: '市集环境资料照片。', credit: '市集摄影者 · CC BY', kind: 'photo',
  creditUrl: 'https://example.com/market', licenseUrl: 'https://example.com/license', width: 1200, height: 800,
};
const install = () => { GUIDE_IMAGES['ui-test-poster'] = poster; GUIDE_IMAGES['ui-test-photo'] = photo; };
afterEach(() => { cleanup(); delete GUIDE_IMAGES['ui-test-poster']; delete GUIDE_IMAGES['ui-test-photo']; document.body.style.overflow = ''; });

// The events column (WEB-EVENTS) shows listing images as card covers through the one resolver (getCover); the old
// zoomable edition picture is gone, so these checks follow the cover and the page's credit list.
const today = '2026-10-09';
const event = { ...INDEX_EVENTS.find(item => item.id === 'fremont-ardenwood-harvest-2026')!, id: 'ui-test-event' };
const card = (imageKey: string) => {
  const item = { ...event, imageKey };
  const cover = getCover({ kind: 'event', id: item.id, imageKey }, { images: GUIDE_IMAGES, today, contextPhotos: {} });
  return { cover, view: render(<MemoryRouter><EventFeedCard event={item} cover={cover} today={today} /><ImageCredits covers={[cover]} /></MemoryRouter>) };
};

test('official posters are letterboxed whole with their responsive sources; photos crop by focus; credits never invent a licence', () => {
  install();
  const { view } = card('ui-test-poster');
  const cover = view.container.querySelector('[data-cover="image"]')!;
  assert.equal(cover.getAttribute('data-fit'), 'contain', 'official artwork must not crop away dates or event names');
  const img = cover.querySelector('.ui-cover__img')!;
  assert.equal(img.getAttribute('srcset'), poster.srcSet);
  assert.equal(img.getAttribute('height'), '1700');
  assert.equal(cover.querySelector('.ui-provenance')?.textContent, '官方图');
  assert.equal(view.getByRole('link', { name: /音乐会主办方/ }).getAttribute('href'), poster.creditUrl);
  assert.equal(view.queryByRole('link', { name: '许可' }), null, 'a source link must not invent a reuse license');
  cleanup();
  // A third-party photo on an event needs a capture year within 8 years (cover ladder tier 2).
  GUIDE_IMAGES['ui-test-photo-dated'] = { ...photo, caption: '市集环境资料照片，2024 年摄。' };
  const { view: second } = card('ui-test-photo-dated');
  delete GUIDE_IMAGES['ui-test-photo-dated'];
  assert.equal(second.container.querySelector('[data-cover="image"]')?.getAttribute('data-fit'), 'cover');
  assert.equal(second.getByRole('link', { name: '许可' }).getAttribute('href'), photo.licenseUrl);
});

test('unknown media becomes the information card, never an unrelated illustration', () => {
  const { cover, view } = card('ui-test-nonexistent');
  assert.equal(cover.tier, 'type');
  assert.equal(view.container.querySelector('img'), null);
  assert.ok(view.container.querySelector('[data-cover="type"]'));
  assert.equal(view.container.querySelector('.ev-credits'), null, 'no credit list without a photo');
});

test('image credits scope includes each used poster and photo once without leaking unrelated credits', () => {
  install();
  const view = render(<GuideImageCredits imageKeys={['ui-test-poster', 'ui-test-photo', 'ui-test-poster', 'ui-test-nonexistent']} />);
  assert.equal(view.container.querySelectorAll('li').length, 2);
  const links = Array.from(view.container.querySelectorAll('a')).map(link => link.href);
  assert.deepEqual(links, [poster.creditUrl, photo.creditUrl, photo.licenseUrl]);
  assert.ok(view.getByText(poster.credit));
  assert.ok(view.getByText(photo.credit));
});
