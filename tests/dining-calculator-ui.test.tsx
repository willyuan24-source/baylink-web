import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const clipboard: { writeText: (text: string) => Promise<void> } = { writeText: async () => {} };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });
const cssHook = registerHooks({ load(url, context, nextLoad) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context); } });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { DiningCalculator } = await import('../src/components/tools/DiningCalculator');
const { setLocale } = await import('../src/i18n/locale');
cssHook.deregister();
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const mount = () => {
  const messages: string[] = [];
  const view = render(<DiningCalculator onToast={text => { messages.push(text); }} />);
  const change = (label: string, value: string) => fireEvent.change(view.getByLabelText(label), { target: { value } });
  return { view, change, messages };
};

test('dining starts empty, labels its example and updates a real bill when the tip basis changes', () => {
  const { view } = mount();
  assert.equal((view.getByRole('button', { name: '复制聚餐账单' }) as HTMLButtonElement).disabled, true);
  assert.equal(view.container.querySelector('.dining-total'), null);
  fireEvent.click(view.getByRole('button', { name: '看看一张示例账单' }));
  const peopleLabel = view.container.querySelector('.dining-people>label') as HTMLLabelElement;
  assert.equal(peopleLabel.control, view.getByLabelText('分账人数'));
  fireEvent.click(peopleLabel);
  assert.equal((view.getByLabelText('分账人数') as HTMLInputElement).value, '3');
  assert.match(view.getByRole('status').textContent!, /演示账单/);
  assert.match(view.container.querySelector('.dining-total')!.textContent!, /\$114\.65/);
  assert.match(view.container.querySelector('.dining-split')!.textContent!, /2 × \$38\.221 × \$38\.21/);
  fireEvent.click(view.getByRole('radio', { name: '税前消费 + 税额' }));
  assert.match(view.container.querySelector('.dining-total')!.textContent!, /\$116\.14/);
  assert.equal(view.queryByRole('status'), null);
  fireEvent.click(view.getByRole('button', { name: '0%', exact: true }));
  assert.equal(view.getByRole('button', { name: '0%', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.match(view.container.querySelector('.dining-total')!.textContent!, /\$100\.25/);
});

test('invalid bill input clears stale totals, associates its error and disables copying', () => {
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '看看一张示例账单' }));
  change('账单上的实际税额', '-1');
  assert.equal(view.container.querySelector('.dining-total'), null);
  assert.equal(view.getByLabelText('账单上的实际税额').getAttribute('aria-invalid'), 'true');
  assert.ok(view.getByLabelText('账单上的实际税额').getAttribute('aria-describedby')!.includes(view.getByRole('alert').id));
  assert.equal((view.getByRole('button', { name: '复制聚餐账单' }) as HTMLButtonElement).disabled, true);
  change('账单上的实际税额', '0');
  change('分账人数', '101');
  assert.equal(view.container.querySelector('.dining-total'), null);
  assert.match(view.getByRole('alert').textContent!, /1 至 100/);
  change('分账人数', '1');
  assert.equal((view.getByRole('button', { name: '减少分账人数' }) as HTMLButtonElement).disabled, true);
  assert.match(view.container.querySelector('.dining-total')!.textContent!, /\$106\.40/);
  fireEvent.click(view.getByRole('button', { name: '清空账单' }));
  assert.equal((view.getByLabelText('税前消费金额') as HTMLInputElement).value, '');
  assert.equal((view.getByLabelText('分账人数') as HTMLInputElement).value, '2');
  assert.equal(view.container.querySelector('.dining-total'), null);
});

test('receipt copy includes the basis and exact split; clipboard denial provides a selectable fallback', async (t) => {
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async (text: string) => { writes.push(text); });
  const { view, change, messages } = mount();
  fireEvent.click(view.getByRole('button', { name: '看看一张示例账单' }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '复制聚餐账单' })); });
  assert.match(writes[0], /额外小费: \$14\.40 \(18% × \$80\.00; 税前消费\)/);
  assert.match(writes[0], /账单已列的服务费: \$12\.00/);
  assert.match(writes[0], /2 × \$38\.22 \+ 1 × \$38\.21/);
  assert.match(writes[0], /不从额外小费中自动扣除/);
  assert.equal(messages.at(-1), '聚餐账单已复制');
  t.mock.method(clipboard, 'writeText', async () => { throw new Error('denied'); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '复制聚餐账单' })); });
  const fallback = view.getByLabelText('手动复制聚餐摘要') as HTMLTextAreaElement;
  assert.equal(fallback.readOnly, true);
  assert.equal(fallback.value, writes[0]);
  fireEvent.focus(fallback);
  assert.equal(fallback.selectionStart, 0);
  assert.equal(fallback.selectionEnd, fallback.value.length);
  change('税前消费金额', '90');
  assert.equal(view.queryByLabelText('手动复制聚餐摘要'), null);
});

test('English dining results and copied receipts stay in English with the same exact amounts', async (t) => {
  await setLocale('en', false);
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async (text: string) => { writes.push(text); });
  const { view } = mount();
  fireEvent.click(view.getByRole('button', { name: 'Try a sample receipt' }));
  const result = view.getByRole('region', { name: 'Dining calculation results' });
  assert.ok(!/[\u3400-\u9fff]/.test(result.textContent!), result.textContent!);
  assert.match(result.textContent!, /\$114\.65/);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy dining receipt' })); });
  assert.ok(!/[\u3400-\u9fff]/.test(writes[0]), writes[0]);
  assert.match(writes[0], /2 × \$38\.22 \+ 1 × \$38\.21/);
});
