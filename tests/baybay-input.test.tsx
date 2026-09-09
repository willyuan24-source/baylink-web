import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};

const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
afterEach(() => cleanup());

test('BayBay waits for a deliberate Enter after Chinese composition before sending', async (t) => {
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    requests.push(init);
    return Response.json({ ok: true, answer: '模拟建议，不调用真实服务。' });
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={() => {}}
    onNavigate={() => {}} onCreatePostClick={() => {}} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  fireEvent.change(input, { target: { value: '刚来湾区租房要注意什么' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  assert.equal(requests.length, 0, 'confirming a Chinese candidate must not submit');
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: false });
  assert.equal(requests.length, 0, 'the IME key-code fallback must also be ignored');
  fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
  await view.findByText('模拟建议，不调用真实服务。');
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(String(requests[0].body)).message, '刚来湾区租房要注意什么');
});
