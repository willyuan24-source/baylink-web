import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://www.baylink.us/events?region=sf&tester=t07&from=card-sf', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load(url, context, nextLoad) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context); } });
const { fireEvent, act, within, waitFor } = await import('@testing-library/react');
const { activeTester, endTesterMode, startTesterMode, testerCode, TESTER_STORAGE_KEY, TESTER_TTL_MS } = await import('../src/features/feedback/tester-mode');
const { bootTesterMode } = await import('../src/features/feedback/tester-boot');

afterEach(() => { endTesterMode(); });
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });

test('only T + 2–3 digits is a tester code', () => {
  assert.equal(testerCode('t07'), 'T07');
  assert.equal(testerCode(' T123 '), 'T123');
  for (const value of ['T7', 'T1234', 'tester', '07', 'T07<script>', '', null]) assert.equal(testerCode(value), null);
});

test('a tester link asks for consent first, keeps nothing before "agree", and leaves no code in the address bar', async () => {
  bootTesterMode(false);
  assert.equal(window.location.pathname + window.location.search, '/events?region=sf&from=card-sf', 'the code leaves the URL; other parameters stay');
  assert.equal(localStorage.getItem(TESTER_STORAGE_KEY), null);
  await settle();
  const consent = await waitFor(() => within(document.body).getByRole('dialog', { name: '参加 BAYLINK 内测' }));
  assert.match(consent.textContent!, /你的测试编号：T07/);
  assert.equal(document.activeElement, within(consent).getByRole('heading', { name: '参加 BAYLINK 内测' }), 'focus starts at the heading, not the privacy link');
  assert.equal(within(document.body).queryByRole('button', { name: '反馈' }), null, 'no tester button before consent');
  await act(async () => { fireEvent.click(within(consent).getByRole('button', { name: '同意，开始内测' })); });
  const stored = JSON.parse(localStorage.getItem(TESTER_STORAGE_KEY)!);
  assert.equal(stored.id, 'T07');
  assert.ok(Math.abs(stored.until - (Date.now() + TESTER_TTL_MS)) < 5_000, '30 days');
  const button = within(document.body).getByRole('button', { name: '反馈' });
  await act(async () => { fireEvent.click(button); await new Promise(resolve => setTimeout(resolve, 50)); });
  const sheet = await waitFor(() => within(document.body).getByRole('dialog', { name: '反馈与报错' }));
  assert.equal((within(sheet).getByLabelText('联系方式（选填）') as HTMLInputElement).value, '测试编号 T07', 'visible and editable, nowhere else');
  await act(async () => { fireEvent.click(within(sheet).getByRole('button', { name: '退出内测' })); });
  assert.equal(localStorage.getItem(TESTER_STORAGE_KEY), null);
  assert.equal((within(sheet).getByLabelText('联系方式（选填）') as HTMLInputElement).value, '');
  assert.equal(within(sheet).getByRole('status').textContent, '已退出内测，反馈按钮不再显示。');
  await act(async () => { fireEvent.click(within(sheet).getByRole('button', { name: '取消' })); });
  assert.equal(within(document.body).queryByRole('button', { name: '反馈' }), null);
});

test('declining stores nothing; an expired record is removed; blocked storage never throws', () => {
  assert.equal(activeTester(), null);
  localStorage.setItem(TESTER_STORAGE_KEY, JSON.stringify({ id: 'T08', until: Date.now() - 1 }));
  assert.equal(activeTester(), null);
  assert.equal(localStorage.getItem(TESTER_STORAGE_KEY), null, 'expired after 30 days');
  localStorage.setItem(TESTER_STORAGE_KEY, '{"id":"<b>","until":9999999999999}');
  assert.equal(activeTester(), null, 'a tampered code is ignored');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    assert.equal(startTesterMode('T09').id, 'T09', 'tester mode still works for this page');
    assert.equal(activeTester()?.id, 'T09');
    endTesterMode();
    assert.equal(activeTester(), null);
  } finally { Object.defineProperty(globalThis, 'localStorage', original); }
});

test('the 3D world is left alone', () => {
  dom.reconfigure({ url: 'https://www.baylink.us/opus-bay?tester=T07' });
  bootTesterMode(true);
  assert.equal(window.location.search, '?tester=T07');
});
