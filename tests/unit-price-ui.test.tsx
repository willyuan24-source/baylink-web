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
const { MemoryRouter } = await import('react-router-dom');
const { UnitPriceTool } = await import('../src/components/tools/UnitPriceTool');
const { ToolsHub } = await import('../src/components/tools/ToolsHub');
const { setLocale } = await import('../src/i18n/locale');
cssHook.deregister();
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const mount = () => {
  const messages: { text: string; type?: string }[] = [];
  const view = render(<UnitPriceTool onToast={(text, type) => { messages.push({ text, type }); }} />);
  const change = (label: string, value: string) => fireEvent.change(view.getByLabelText(label), { target: { value } });
  return { view, change, messages };
};

test('English results translate the lowest-price badge and keep calculations unchanged', async () => {
  await setLocale('en', false);
  const { view } = mount();
  fireEvent.click(view.getByRole('button', { name: 'Load a package example' }));
  const result = view.getByRole('region', { name: 'Unit price results' });
  assert.ok(!/[\u3400-\u9fff]/.test(result.textContent!), result.textContent!);
  assert.match(result.textContent!, /\$0\.70/);
  assert.match(result.textContent!, /Lowest unit price/);
});

test('the empty tool shows no made-up prices; example is labeled and any invalid row removes stale results', () => {
  const { view, change } = mount();
  assert.equal(view.queryByRole('region', { name: '单价比较结果' }), null);
  assert.equal((view.getByRole('button', { name: '复制单价比较' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('button', { name: '载入包装示例' }));
  assert.match(view.getByRole('status').textContent!, /不代表任何商店现价/);
  const ranked = view.container.querySelectorAll('.unit-price-results li');
  assert.match(ranked[0].textContent!, /商品 2.*\$0\.70/);
  assert.match(ranked[1].textContent!, /同量可省 \$0\.05/);
  change('实付总价 1', '-1');
  assert.equal(view.queryByRole('region', { name: '单价比较结果' }), null);
  assert.equal(view.getByLabelText('实付总价 1').getAttribute('aria-invalid'), 'true');
  assert.match(view.getByRole('alert').textContent!, /实付总价须为零或正数/);
  assert.equal((view.getByRole('button', { name: '复制单价比较' }) as HTMLButtonElement).disabled, true);
  change('实付总价 1', '0');
  assert.match(view.container.querySelector('.unit-price-results li')!.textContent!, /商品 1.*\$0\.00/);
  change('计量单位 2', 'L');
  assert.equal(view.queryByRole('region', { name: '单价比较结果' }), null);
  assert.match(view.getByRole('alert').textContent!, /没有密度信息/);
});

test('rows are limited to four, incomplete additions suspend comparison, and clear resets all inputs', () => {
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入包装示例' }));
  fireEvent.click(view.getByRole('button', { name: '添加商品' }));
  assert.equal(view.queryByRole('region', { name: '单价比较结果' }), null);
  change('每包数量 3', '250'); change('实付总价 3', '2');
  assert.equal(view.container.querySelectorAll('.unit-price-results li').length, 3);
  fireEvent.click(view.getByRole('button', { name: '添加商品' }));
  assert.equal((view.getByRole('button', { name: '添加商品' }) as HTMLButtonElement).disabled, true);
  assert.equal(view.getAllByRole('group').length, 4);
  fireEvent.click(view.getByRole('button', { name: '移除商品 4' }));
  assert.equal(view.container.querySelectorAll('.unit-price-results li').length, 3);
  fireEvent.click(view.getByRole('button', { name: '清空比较' }));
  assert.equal(view.getAllByRole('group').length, 2);
  assert.equal((view.getByLabelText('每包数量 1') as HTMLInputElement).value, '');
  assert.equal((view.getByLabelText('包数 1') as HTMLInputElement).value, '1');
  assert.equal(view.queryByRole('region', { name: '单价比较结果' }), null);
});

test('copy preserves user product names and records pack quantities, totals, units and savings', async (t) => {
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async (text: string) => { writes.push(text); });
  const { view, change, messages } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入包装示例' }));
  change('商品名称 1', '我的燕麦 A');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '复制单价比较' })); });
  assert.match(writes[0], /我的燕麦 A: 2 × 500 g 克; 实付总价 \$7\.50; 每 100 g \$0\.75/);
  assert.match(writes[0], /同量可省 \$0\.05/);
  assert.equal(view.container.querySelector('.unit-price-result-product strong')!.getAttribute('translate'), 'no');
  assert.equal(messages.at(-1)?.type, 'success');
  t.mock.method(clipboard, 'writeText', async () => { throw new Error('denied'); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '复制单价比较' })); });
  assert.equal(messages.at(-1)?.type, 'error');
});

test('the toolkit route opens unit-price directly and retains draft inputs when visiting another tool', () => {
  const view = render(<MemoryRouter initialEntries={['/tools?tool=unit-price']}><ToolsHub storageScope="guest:unit-price-test" onToast={() => {}} /></MemoryRouter>);
  assert.equal(view.getByRole('heading', { level: 2, name: '单价比一比' }).id, 'active-tool-title');
  fireEvent.change(view.getByLabelText('商品名称 1'), { target: { value: 'My oats' } });
  fireEvent.click(view.getByRole('link', { name: /日常单位换算/ }));
  assert.equal(view.queryByLabelText('商品名称 1')?.closest('[hidden]')?.hasAttribute('hidden'), true);
  fireEvent.click(view.getByRole('link', { name: /单价比一比/ }));
  assert.equal((view.getByLabelText('商品名称 1') as HTMLInputElement).value, 'My oats');
});
