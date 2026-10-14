import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { englishProblems } from '../scripts/i18n-html-check.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/category/rent' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, waitFor } = await import('@testing-library/react');
const { setLocale } = await import('../src/i18n/locale');
const { AdDetailModal, OfficialAds } = await import('../src/features/ads/OfficialAds');

// the board's /ads answer: two Chinese ads with a picture (shown to every reader) and one English ad
const ADS = [
  { id: 'ad-zh-1', title: '房地产经纪 · 湾区买卖与出租', content: '湾区房地产经纪，房屋买卖，管理。', imageUrl: 'https://example.com/a.jpg' },
  { id: 'ad-zh-2', title: '中文家教 · 周末小班', content: '南湾周末中文小班，6–12 岁。', imageUrl: 'https://example.com/b.jpg' },
  { id: 'ad-en-1', title: 'Bay Area Movers', content: 'Local moves, packing and storage.', imageUrl: 'https://example.com/c.jpg' },
];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => String(input).endsWith('/ads')
  ? new Response(JSON.stringify(ADS), { status: 200, headers: { 'Content-Type': 'application/json' } })
  : new Response('{}', { status: 404 })) as typeof fetch;
after(() => { globalThis.fetch = realFetch; });
const titleOf = (text: string) => [...document.querySelectorAll('div')].find(element => element.textContent === text);

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

for (const layout of ['carousel', 'list'] as const) {
  test(`H50: the ${layout} cards on /en mark each Chinese ad as Chinese, with one note per ad; an English ad gets none`, async () => {
    await setLocale('en', false);
    render(<OfficialAds isAdmin={false} showToast={() => {}} onOpenDetail={() => {}} layout={layout} />);
    await waitFor(() => assert.ok(titleOf('中文家教 · 周末小班'), 'the ads loaded'));
    for (const text of ['房地产经纪 · 湾区买卖与出租', '中文家教 · 周末小班', '湾区房地产经纪，房屋买卖，管理。']) {
      const element = titleOf(text)!;
      assert.equal(element.getAttribute('lang'), 'zh-Hans', text);
      assert.equal(element.getAttribute('translate'), 'no', text);
    }
    assert.equal(titleOf('Bay Area Movers')!.getAttribute('lang'), null, 'an English ad is not marked');
    assert.equal(document.querySelectorAll('[data-ad-original]').length, 2, 'one note per Chinese ad');
  });
}

test('H50: on Chinese pages the carousel and list cards stay as they were (no marks, no note)', async () => {
  await setLocale('zh-Hans', false);
  for (const layout of ['carousel', 'list'] as const) {
    const view = render(<OfficialAds isAdmin={false} showToast={() => {}} onOpenDetail={() => {}} layout={layout} />);
    await waitFor(() => assert.ok(titleOf('中文家教 · 周末小班')));
    assert.equal(titleOf('中文家教 · 周末小班')!.getAttribute('lang'), null);
    assert.equal(document.querySelectorAll('[data-ad-original]').length, 0);
    view.unmount();
  }
});
