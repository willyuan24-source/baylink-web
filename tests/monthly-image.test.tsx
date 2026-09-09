import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
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
const style = document.createElement('style');
style.textContent = readFileSync(new URL('../src/components/monthly-edition.css', import.meta.url), 'utf8');
document.head.append(style);

const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { EditionPicture } = await import('../src/components/MonthlyEdition');
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

test('official posters retain their complete layout, responsive sources and source credit', () => {
  install();
  const view = render(<EditionPicture imageKey="ui-test-poster" />);
  const img = view.getByRole('img', { name: poster.alt });
  assert.equal(getComputedStyle(img).objectFit, 'contain', 'official artwork must not crop away dates or event names');
  assert.equal(img.getAttribute('srcset'), poster.srcSet);
  assert.equal(img.getAttribute('height'), '1700');
  assert.ok(view.getByText('官方宣传图'));
  assert.ok(view.getByText(poster.caption));
  assert.equal(view.getByRole('link', { name: /音乐会主办方/ }).getAttribute('href'), poster.creditUrl);
  assert.equal(view.queryByRole('link', { name: /图片授权/ }), null, 'a source link must not invent a reuse license');
  view.rerender(<EditionPicture imageKey="ui-test-photo" />);
  assert.equal(getComputedStyle(view.getByRole('img')).objectFit, 'cover');
  assert.ok(view.getByText('资料照片'));
  assert.equal(view.getByRole('link', { name: /图片授权/ }).getAttribute('href'), photo.licenseUrl);
});

test('monthly picture zoom uses the full asset, traps focus and restores the opener after Escape or close', () => {
  install();
  const view = render(<EditionPicture imageKey="ui-test-poster" />);
  const opener = view.getByRole('button', { name: `放大图片：${poster.alt}` });
  opener.focus();
  fireEvent.click(opener);
  const dialog = within(view.getByRole('dialog', { name: `图片放大：${poster.alt}` }));
  const close = dialog.getByRole('button', { name: '关闭放大图片' });
  assert.equal(document.activeElement, close);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(dialog.getByRole('img').getAttribute('src'), poster.src);
  assert.equal(dialog.getByRole('img').getAttribute('srcset'), null, 'enlarged view must not select a small thumbnail');
  const source = dialog.getByRole('link', { name: /音乐会主办方/ });
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, source);
  fireEvent.keyDown(source, { key: 'Tab' });
  assert.equal(document.activeElement, close);
  fireEvent.keyDown(close, { key: 'Escape' });
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.activeElement, opener);
  fireEvent.click(opener);
  fireEvent.click(within(view.getByRole('dialog')).getByRole('button', { name: '关闭放大图片' }));
  assert.equal(view.queryByRole('dialog'), null);
});

test('changing the monthly picture closes its old lightbox and unknown media does not show an unrelated illustration', () => {
  install();
  const view = render(<EditionPicture imageKey="ui-test-poster" />);
  fireEvent.click(view.getByRole('button', { name: /^放大图片/ }));
  assert.ok(view.getByRole('dialog'));
  view.rerender(<EditionPicture imageKey="ui-test-photo" />);
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(view.getByRole('img').getAttribute('src'), photo.src);
  view.rerender(<EditionPicture imageKey="ui-test-nonexistent" />);
  assert.equal(view.queryByRole('img'), null);
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
