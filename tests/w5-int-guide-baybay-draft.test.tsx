import './baybay-test-transport';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

// W5-INT (Wave 5 integration): the two halves of H32 meet. WEB-GUIDES-READ's 问 BayBay on a guide calls
// onAsk(question, { mode: 'draft' }) (GuideActions), GuideDetailPage passes the app's openBayBay as onAsk, and AppLayout
// turns that call into the panel's pendingQuestion / pendingQuestionMode (trimmed, at most 500 characters). WEB-LINK-2's
// panel then shows the question in the box under 正在看：<the guide> and sends nothing by itself.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { getGuideBySlug } = await import('../src/data/guides');
const { setLocale } = await import('../src/i18n/locale');
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};

for (const slug of ['bay-area-chinese-senior-services-referral-guide', 'golden-gate-park-free-car-free-day-guide']) {
  test(`H32 end to end (${slug}): the guide's 问 BayBay reaches the panel as a draft under 正在看 and sends nothing`, async t => {
    const guide = getGuideBySlug(slug);
    assert.ok(guide, `${slug} exists`);
    const asked = t.mock.fn();
    t.mock.method(globalThis, 'fetch', ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/ai/usage')) return Promise.resolve(Response.json({ baybay: { remaining: 20, limit: 20, resetAt: '2026-10-15T07:00:00.000Z' } }));
      if (url.endsWith('/ai/baybay-capabilities')) return Promise.resolve(Response.json({ engine: 'v2', pause: null, reduced: null }));
      if (url.endsWith('/product-events')) return Promise.resolve(Response.json({ ok: true }));
      asked(url);
      return Promise.resolve(Response.json({ ok: true, answer: '不应发出' }));
    }) as typeof fetch);

    // GuideDetailPage: onAsk={openBayBay}. AppLayout.openBayBay keeps the trimmed question (≤500) and its mode.
    const pending: { text: string; mode: 'send' | 'draft' }[] = [];
    const openBayBay = (question?: string, options?: { mode?: 'send' | 'draft' }) => {
      if (question?.trim()) pending.push({ text: question.trim().slice(0, 500), mode: options?.mode || 'send' });
    };
    const page = render(<MemoryRouter initialEntries={[`/guides/${slug}`]}>
      <GuideDetail slug={slug} today="2026-10-13" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} onAsk={openBayBay} />
    </MemoryRouter>);
    fireEvent.click(page.getAllByRole('button', { name: '问 BayBay' })[0]);
    assert.equal(pending.length, 1, 'one question goes to the opener');
    assert.equal(pending[0].mode, 'draft', 'the guide drafts; it never asks at once');
    cleanup();

    const panel = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}
      currentPath={`/guides/${slug}`} pendingQuestion={pending[0].text} pendingQuestionId={1} pendingQuestionMode={pending[0].mode} />);
    await act(async () => {});
    const input = panel.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLTextAreaElement;
    assert.equal(input.value, pending[0].text, 'the drafted question waits in the box');
    assert.equal(document.activeElement, input, 'the reader finishes the question');
    assert.equal(panel.baseElement.querySelector('.bb-capsule__text')?.textContent, `正在看：${guide!.title}`, 'the guide goes with the question');
    await act(async () => {});
    assert.equal(asked.mock.callCount(), 0, 'a draft never starts an AI request by itself');
  });
}
