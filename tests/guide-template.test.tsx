import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

// This in-memory double is the only clipboard available to the rendered component.
// Tests never access a browser session or the operating system clipboard.
const clipboard = { writeText: async (text: string): Promise<void> => { throw new Error(`Unconfigured clipboard double received ${text.length} characters.`); } };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });

const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideBySlug } = await import('../src/data/guides');

afterEach(() => cleanup());

const renderAirportGuide = () => {
  const slug = 'bay-area-airport-arrival-guide';
  const guide = getGuideBySlug(slug);
  assert.ok(guide, 'the published airport guide must be registered in the main guide collection');
  const template = guide.blocks.find((block) => block.type === 'template');
  assert.ok(template, 'the airport guide must expose its practical contact template');
  const view = render(
    <MemoryRouter initialEntries={[`/guides/${slug}`]}>
      <GuideDetail slug={slug} onBack={() => {}} onOpenGuide={() => {}} onNavigate={() => {}} onOpenPost={() => {}} />
    </MemoryRouter>,
  );
  const region = view.getByRole('region', { name: template.title });
  const button = within(region).getByRole('button', { name: `复制${template.title}` }) as HTMLButtonElement;
  return { view, template, region, button };
};

test('guide template reports copied only after the clipboard resolves and preserves the exact original text', async (t) => {
  const writes: string[] = [];
  let resolveCopy: (() => void) | undefined;
  t.mock.method(clipboard, 'writeText', (text: string) => {
    writes.push(text);
    return new Promise<void>((resolve) => { resolveCopy = resolve; });
  });
  const { template, region, button } = renderAirportGuide();

  fireEvent.click(button);
  assert.deepEqual(writes, [template.text], 'copy must retain every newline, bracket, and instruction from the published template');
  assert.equal(button.disabled, true, 'prevent repeated copying while the first request is pending');
  assert.equal(button.textContent, '正在复制…');
  assert.equal(within(region).queryByText('已复制'), null, 'a pending clipboard write must not claim success');

  await act(async () => {
    assert.ok(resolveCopy);
    resolveCopy();
  });
  assert.equal(button.textContent, '已复制');
  assert.equal(button.disabled, false);
  assert.equal(within(region).getByRole('status').textContent, '模板已复制。请填写你的真实情况。');
  assert.equal(writes.length, 1);
});

test('guide template keeps the original selectable text and offers manual copying when clipboard permission is denied', async (t) => {
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async (text: string) => {
    writes.push(text);
    throw new Error('Clipboard permission denied');
  });
  const { template, region, button } = renderAirportGuide();

  fireEvent.click(button);
  const message = await within(region).findByText('浏览器未允许复制，请选中上方文字手动复制。');
  assert.equal(message.getAttribute('role'), 'status');
  assert.deepEqual(writes, [template.text]);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '复制模板');
  assert.equal(within(region).queryByText('已复制'), null);

  const original = within(region).getByText(template.text, { normalizer: (text) => text });
  assert.equal(original.tagName, 'PRE');
  assert.equal(original.textContent, template.text, 'a denied write must not clear or replace the copyable content');
  assert.equal(original.tabIndex, 0, 'keyboard users can still reach the original template');
  assert.equal(original.hidden, false);
  assert.notEqual(getComputedStyle(original).display, 'none');
  assert.notEqual(getComputedStyle(original).visibility, 'hidden');
});
