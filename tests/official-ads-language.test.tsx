import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { englishProblems } from '../scripts/i18n-html-check.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/category/rent' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { setLocale } = await import('../src/i18n/locale');
const { AdDetailModal } = await import('../src/features/ads/OfficialAds');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

/** H50 (I13-13): a Chinese ad on an English page is marked as Chinese and says it is shown as written. */
const ad = { id: 'ad-test', title: '房地产经纪 · 湾区买卖与出租', content: '湾区房地产经纪，房屋买卖，管理。', imageUrl: 'https://example.com/a.jpg' };

test('H50: on /en the ad title and text carry lang="zh-Hans" translate="no", plus an English original-language note', async () => {
  await setLocale('en', false);
  render(<AdDetailModal ad={ad} onClose={() => {}} />);
  const title = [...document.querySelectorAll('h4')].find(element => element.textContent?.includes('房地产经纪'))!;
  assert.equal(title.getAttribute('lang'), 'zh-Hans');
  assert.equal(title.getAttribute('translate'), 'no');
  const body = [...document.querySelectorAll('p')].find(element => element.textContent?.startsWith('湾区房地产经纪'))!;
  assert.equal(body.getAttribute('lang'), 'zh-Hans');
  assert.equal(body.getAttribute('translate'), 'no');
  assert.equal(document.querySelector('[data-ad-original]')?.textContent, 'Shown in Chinese, as the advertiser wrote it');
  // the language check of the built /en pages accepts it: the Chinese sits in markup that says it is Chinese
  const html = `<html><head><title>x</title></head><body>${document.body.innerHTML}</body></html>`;
  assert.ok(!englishProblems(html).some(text => text.includes('房地产')), 'the ad text is not flagged');
});

test('H50: Chinese pages keep the ad as it is (no language marks, no note)', async () => {
  await setLocale('zh-Hans', false);
  render(<AdDetailModal ad={ad} onClose={() => {}} />);
  const title = [...document.querySelectorAll('h4')].find(element => element.textContent?.includes('房地产经纪'))!;
  assert.equal(title.getAttribute('translate'), null);
  assert.equal(document.querySelector('[data-ad-original]'), null);
});
