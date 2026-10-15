import './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BAYBAY_QUOTA_VISIBLE } = await import('../src/features/baybay/BayBayAnswer');
const { bayBayDraft } = await import('../src/features/baybay/draft');
const { guides } = await import('../src/data/guides');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };

/** /ai/usage reports BayBay's own share (`baybay`), capabilities an optional pause; any other request is a failure here. */
function mockPanel(t: import('node:test').TestContext, remaining: number, pause: unknown = null) {
  const asked = t.mock.fn();
  t.mock.method(globalThis, 'fetch', ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/ai/usage')) return Promise.resolve(Response.json({ baybay: { remaining, limit: 20, resetAt: '2026-10-15T07:00:00.000Z' } }));
    if (url.endsWith('/ai/baybay-capabilities')) return Promise.resolve(Response.json({ engine: 'v2', pause, reduced: null }));
    if (url.endsWith('/product-events')) return Promise.resolve(Response.json({ ok: true }));
    asked(url);
    return Promise.resolve(Response.json({ ok: true, answer: '不应发出' }));
  }) as typeof fetch);
  return asked;
}

test('the day\'s remaining AI queries show in one visible line at 5 or fewer, the calm used-up line at 0, in three languages', async t => {
  const expected = {
    'zh-Hans': { few: '今日 AI 查询还剩 3 次，湾区午夜重置。', none: '今日 AI 额度已用完，湾区午夜重置；站内资料和紧急求助仍可用。' },
    'zh-Hant': { few: '今日 AI 查詢還剩 3 次，灣區午夜重置。', none: '今日 AI 額度已用完，灣區午夜重置；站內資料和緊急求助仍可用。' },
    en: { few: '3 AI queries left today; resets at Bay Area midnight.', none: 'Today’s AI answers are used up and reset at Bay Area midnight. Site information and emergency help still work.' },
  } as const;
  assert.equal(BAYBAY_QUOTA_VISIBLE, 5);
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    for (const [remaining, text] of [[20, null], [6, null], [3, expected[locale].few], [0, expected[locale].none]] as const) {
      t.mock.restoreAll();
      mockPanel(t, remaining);
      const view = render(<BayBayAssistantEntry {...props} />);
      await act(async () => {});
      const line = view.baseElement.querySelector('.bb-quota');
      if (text === null) assert.equal(line, null, `${locale} ${remaining}: the count stays in the collapsed details`);
      else {
        assert.equal(line?.textContent, text, `${locale} ${remaining}`);
        assert.equal(line?.getAttribute('role'), 'status');
        assert.ok(line?.closest('form.baybay-composer-footer'), 'by the question box, visible without opening 检索、额度与对话说明');
        assert.equal(line?.closest('details'), null);
        assert.equal(view.baseElement.querySelector('.baybay-composer-footer a[href^="tel:"], .baybay-composer-footer .bb-call'), null, 'no call buttons (H37)');
      }
      cleanup();
    }
  }
  t.mock.restoreAll();
  mockPanel(t, 1);
  await setLocale('zh-Hans', false);
  let view = render(<BayBayAssistantEntry {...props} />);
  await act(async () => {});
  assert.equal(view.baseElement.querySelector('.bb-quota')?.textContent, '今日 AI 查询还剩 1 次，湾区午夜重置。');
  cleanup();
  await setLocale('en', false);
  view = render(<BayBayAssistantEntry {...props} />);
  await act(async () => {});
  assert.equal(view.baseElement.querySelector('.bb-quota')?.textContent, '1 AI query left today; resets at Bay Area midnight.');
  cleanup();
});

test('a pause banner already explains a stop, so the quota line steps aside', async t => {
  mockPanel(t, 0, { kind: 'ai_daily_budget', reason: 'daily_budget', banner: { 'zh-Hans': '今日 AI 名额已满，明天会恢复；站内资料仍可浏览。', 'zh-Hant': '今日 AI 名額已滿，明天會恢復；站內資料仍可瀏覽。', en: 'Today’s AI capacity is used up.' } });
  const view = render(<BayBayAssistantEntry {...props} />);
  await act(async () => {});
  assert.ok(view.baseElement.querySelector('.bb-notice[data-notice="ai_daily_budget"]'), 'the banner shows');
  assert.equal(view.baseElement.querySelector('.bb-quota'), null);
});

test('bayBayDraft: 问 BayBay on a guide prefills its question under 正在看：<the guide>, focuses the box and never sends', async t => {
  const calls: unknown[][] = [];
  const onAsk = bayBayDraft((...args) => { calls.push(args); });
  onAsk('这份指南里，长辈要先准备什么？');
  assert.deepEqual(calls, [['这份指南里，长辈要先准备什么？', { mode: 'draft' }]]);
  assert.doesNotThrow(() => bayBayDraft(undefined)('no opener yet'), 'a page outside the app shell has no opener');

  const asked = mockPanel(t, 20);
  const guide = guides[0];
  const question = `关于「${guide.title}」，我想先确认：`;
  const view = render(<BayBayAssistantEntry {...props} currentPath={`/guides/${guide.slug}`} pendingQuestion={question} pendingQuestionId={1} pendingQuestionMode="draft" />);
  await act(async () => {});
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLTextAreaElement;
  assert.equal(input.value, question);
  assert.equal(document.activeElement, input, 'the reader finishes the question');
  const capsule = view.baseElement.querySelector('.bb-capsule__text');
  assert.equal(capsule?.textContent, `正在看：${guide.title}`, 'the guide goes with the question');
  await act(async () => {});
  assert.equal(asked.mock.callCount(), 0, 'a draft never starts an AI request by itself');
});
