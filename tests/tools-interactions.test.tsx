import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// All copy operations use this in-memory double, never the system clipboard.
const clipboard: { writeText: (text: string) => Promise<void> } = { writeText: async () => { throw new Error('Unconfigured test clipboard'); } };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { RentalBudgetTool, SharedBillTool } = await import('../src/components/tools/BudgetTools');
const { UnitConverterTool } = await import('../src/components/tools/UnitConverterTool');
// Node does not load browser stylesheets; this suite checks interaction, not layout.
const cssHook = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('/tools.css') || url.endsWith('/loan-calculator.css')) return { format: 'module', shortCircuit: true, source: 'export {};' };
  return nextLoad(url, context);
} });
const { ToolsHub } = await import('../src/components/tools/ToolsHub');
cssHook.deregister();
const { api } = await import('../src/lib/api');

afterEach(() => { cleanup(); dom.window.localStorage.clear(); dom.window.sessionStorage.clear(); });
const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const inputValue = (element: HTMLElement) => (element as HTMLInputElement).value;

test('rental example separates monthly expenses from deposit and one-time cash, and copies exact totals', async t => {
  const writes: string[] = [];
  const toasts: string[] = [];
  let finishCopy: (() => void) | undefined;
  t.mock.method(clipboard, 'writeText', async (value: string) => {
    writes.push(value);
    return new Promise<void>(resolve => { finishCopy = resolve; });
  });
  const view = render(<MemoryRouter><RentalBudgetTool onToast={message => toasts.push(message)} /></MemoryRouter>);
  assert.equal(disabled(view.getByRole('button', { name: '复制费用摘要' })), true);
  fireEvent.click(view.getByRole('button', { name: '填入示例' }));
  assert.ok(view.getByText('$2,780.00'));
  assert.ok(view.getByText('$5,730.00'));
  assert.match(view.getByText(/当前为演示数值/).textContent!, /不代表市场价格/);
  fireEvent.click(view.getByRole('button', { name: '复制费用摘要' }));
  assert.deepEqual(writes, ['BAYLINK 租房费用计算\n每月合计：$2,780.00\n入住首月现金需求：$5,730.00\n其中押金：$2,500.00（现金占用，非每月开销）\n一次性搬家及安置费：$450.00\n按自填费用估算；首月租金按整月计。']);
  assert.deepEqual(toasts, []);
  await act(async () => { assert.ok(finishCopy); finishCopy(); });
  assert.deepEqual(toasts, ['计算结果已复制']);
  change(view.getByRole('textbox', { name: '押金（单独占用现金）' }), '0');
  assert.ok(view.getByText('$2,780.00'));
  assert.ok(view.getByText('$3,230.00'));
  assert.equal(view.queryByText(/当前为演示数值/), null);
  fireEvent.click(view.getByRole('button', { name: '清空' }));
  assert.equal(inputValue(view.getByRole('textbox', { name: '月租', exact: true })), '');
  assert.equal(disabled(view.getByRole('button', { name: '复制费用摘要' })), true);
});

test('rental input rejects malformed or excessive amounts, requires rent, and treats optional blanks as zero', async t => {
  const toasts: string[] = [];
  t.mock.method(clipboard, 'writeText', async () => { throw new Error('Simulated clipboard denial'); });
  const view = render(<MemoryRouter><RentalBudgetTool onToast={message => toasts.push(message)} /></MemoryRouter>);
  const rent = view.getByRole('textbox', { name: '月租', exact: true });
  change(view.getByRole('textbox', { name: '每月水电网' }), '10.25');
  assert.match(view.getByRole('alert').textContent!, /请填写月租/);
  for (const invalid of ['-1', '1.001', 'NaN', '1e3', '1000000.01']) {
    change(rent, invalid);
    assert.ok(view.getByRole('alert'));
    assert.equal(disabled(view.getByRole('button', { name: '复制费用摘要' })), true);
  }
  change(rent, '0.10');
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(view.getAllByText('$10.35').length, 2);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制费用摘要' })));
  assert.deepEqual(toasts, ['复制失败，请手动选择结果复制']);
  assert.equal(view.getAllByText('$10.35').length, 2);
  assert.equal(inputValue(rent), '0.10');
});

test('a $100 bill splits into exact cents, responds to weights, and copies updated names and shares', async t => {
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async (value: string) => { writes.push(value); });
  const view = render(<SharedBillTool onToast={() => {}} />);
  const shares = () => Array.from(view.getByRole('list').querySelectorAll('strong')).map(item => item.textContent);
  change(view.getByRole('textbox', { name: '分摊总金额' }), '100');
  assert.deepEqual(shares(), ['$33.34', '$33.33', '$33.33']);
  assert.equal(shares().reduce((sum, value) => sum + Math.round(Number(value!.replace('$', '')) * 100), 0), 10000);
  change(view.getByRole('textbox', { name: '成员 1 权重' }), '2');
  change(view.getByRole('textbox', { name: '成员 1 名称' }), 'Alex');
  assert.deepEqual(shares(), ['$50.00', '$25.00', '$25.00']);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制分摊结果' })));
  assert.deepEqual(writes, ['BAYLINK 共享账单分摊\n总额：$100.00\nAlex：$50.00（权重 2）\n成员 B：$25.00（权重 1）\n成员 C：$25.00（权重 1）\n各人金额合计等于账单总额，尾差按权重余数分配。']);
  fireEvent.click(view.getByRole('button', { name: '设为均分' }));
  assert.deepEqual(shares(), ['$33.34', '$33.33', '$33.33']);
  fireEvent.click(view.getByRole('button', { name: '移除成员 3' }));
  assert.deepEqual(shares(), ['$50.00', '$50.00']);
  assert.equal(disabled(view.getByRole('button', { name: '移除成员 1' })), true);
  fireEvent.click(view.getByRole('button', { name: /添加成员/ }));
  assert.deepEqual(shares(), ['$33.34', '$33.33', '$33.33']);
  fireEvent.click(view.getByRole('button', { name: '重置' }));
  assert.equal(view.queryByRole('list'), null);
  assert.equal(inputValue(view.getByRole('textbox', { name: '成员 1 名称' })), '成员 A');
  assert.equal(disabled(view.getByRole('button', { name: '复制分摊结果' })), true);
});

test('invalid member weights or amounts cannot leave stale calculated shares available for copying', () => {
  const view = render(<SharedBillTool onToast={() => {}} />);
  const total = view.getByRole('textbox', { name: '分摊总金额' });
  const weight = view.getByRole('textbox', { name: '成员 1 权重' });
  change(total, '100');
  for (const invalid of ['0', '-1', 'NaN', '', '0.00001', '10001']) {
    change(weight, invalid);
    assert.ok(view.getByRole('alert'));
    assert.equal(view.queryByRole('list'), null);
    assert.equal(disabled(view.getByRole('button', { name: '复制分摊结果' })), true);
  }
  change(weight, '0.5');
  assert.equal(view.queryByRole('alert'), null);
  for (const invalid of ['-1', '1.001', '1e2', '1000001']) {
    change(total, invalid);
    assert.ok(view.getByRole('alert'));
    assert.equal(disabled(view.getByRole('button', { name: '复制分摊结果' })), true);
  }
  change(total, '');
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(view.queryByRole('list'), null);
});

test('unit conversion distinguishes blank from zero, handles both directions and copies the displayed unit', async t => {
  const writes: string[] = [];
  const toasts: string[] = [];
  t.mock.method(clipboard, 'writeText', async (value: string) => { writes.push(value); });
  const view = render(<UnitConverterTool onToast={message => toasts.push(message)} />);
  const input = view.getByRole('textbox', { name: '需要换算的数值' });
  const output = () => view.getByLabelText('换算结果').textContent;
  assert.equal(output(), '—');
  assert.equal(disabled(view.getByRole('button', { name: '复制结果' })), true);
  change(input, '32');
  assert.equal(output(), '0');
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制结果' })));
  assert.deepEqual(writes, ['32 °F ≈ 0 °C']);
  assert.deepEqual(toasts, ['换算结果已复制']);
  fireEvent.click(view.getByRole('button', { name: '交换换算方向' }));
  assert.equal(inputValue(input), '');
  assert.equal(output(), '—');
  change(input, '100');
  assert.equal(output(), '212');
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制结果' })));
  assert.equal(writes[1], '100 °C ≈ 212 °F');
  fireEvent.click(view.getByRole('button', { name: '距离', exact: true }));
  assert.equal(output(), '—');
  change(input, '10');
  assert.equal(output(), '16.0934');
  fireEvent.click(view.getByRole('button', { name: '交换换算方向' }));
  change(input, '16.09344');
  assert.equal(output(), '10');
  change(input, '0');
  assert.equal(output(), '0');
  assert.equal(disabled(view.getByRole('button', { name: '复制结果' })), false);
  fireEvent.click(view.getByRole('button', { name: '清空' }));
  assert.equal(output(), '—');
});

test('unit errors hide stale results and copying failures leave the valid calculation intact', async t => {
  const toasts: string[] = [];
  t.mock.method(clipboard, 'writeText', async () => { throw new Error('Simulated clipboard denial'); });
  const view = render(<UnitConverterTool onToast={message => toasts.push(message)} />);
  const input = view.getByRole('textbox', { name: '需要换算的数值' });
  for (const invalid of ['abc', 'NaN', 'Infinity', '1e3', '1000000001', '-459.68']) {
    change(input, invalid);
    assert.ok(view.getByRole('alert'));
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(view.getByLabelText('换算结果').textContent, '—');
    assert.equal(disabled(view.getByRole('button', { name: '复制结果' })), true);
  }
  change(input, '-40');
  assert.equal(view.getByLabelText('换算结果').textContent, '-40');
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制结果' })));
  assert.deepEqual(toasts, ['复制失败，请手动选择结果复制']);
  assert.equal(inputValue(input), '-40');
  fireEvent.click(view.getByRole('button', { name: '重量', exact: true }));
  change(input, '-1');
  assert.match(view.getByRole('alert').textContent!, /零或正数/);
  change(input, '  ');
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(view.getByLabelText('换算结果').textContent, '—');
});

test('tool navigation preserves separate in-page drafts and calculations without making any request', t => {
  const request = t.mock.method(api, 'request', async () => { throw new Error('Unexpected request from local tools'); });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network is forbidden in this test'); });
  const view = render(<MemoryRouter initialEntries={['/tools?tool=budget']}><ToolsHub storageScope="guest:test" onToast={() => {}} /></MemoryRouter>);
  assert.ok(view.getByRole('heading', { level: 2, name: '租房费用计算' }));
  fireEvent.click(view.getByRole('button', { name: '填入示例' }));
  const navigate = (title: string) => fireEvent.click(view.getByRole('link', { name: new RegExp(title) }));
  navigate('日常单位换算');
  change(view.getByRole('textbox', { name: '需要换算的数值' }), '32');
  navigate('共享账单分摊');
  change(view.getByRole('textbox', { name: '分摊总金额' }), '100');
  navigate('AI 沟通助手');
  change(view.getByRole('textbox', { name: '需要表达的事实' }), '我周五下午可以看房。');
  navigate('租房费用计算');
  assert.equal(inputValue(view.getByRole('textbox', { name: '月租', exact: true })), '2500');
  assert.ok(view.getByText('$5,730.00'));
  assert.equal(view.getByRole('link', { name: /租房费用计算/ }).getAttribute('aria-current'), 'page');
  navigate('日常单位换算');
  assert.equal(inputValue(view.getByRole('textbox', { name: '需要换算的数值' })), '32');
  assert.equal(view.getByLabelText('换算结果').textContent, '0');
  navigate('共享账单分摊');
  assert.equal(inputValue(view.getByRole('textbox', { name: '分摊总金额' })), '100');
  assert.ok(view.getByText('$33.34'));
  navigate('AI 沟通助手');
  assert.equal(inputValue(view.getByRole('textbox', { name: '需要表达的事实' })), '我周五下午可以看房。');
  assert.equal(request.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(dom.window.localStorage.length, 0);
});
