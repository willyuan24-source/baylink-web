import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { calculateLoan } from '../src/lib/loan-calculator';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// No network, browser account or operating-system clipboard participates in these tests.
const clipboard: { writeText: (value: string) => Promise<void> } = { writeText: async () => { throw new Error('Test clipboard is not configured'); } };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { LoanCalculatorTool } = await import('../src/components/tools/LoanCalculatorTool');
afterEach(cleanup);
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const mount = () => {
  const messages: { text: string; type?: string }[] = [];
  const view = render(<LoanCalculatorTool onToast={(text, type) => { messages.push({ text, type }); }} />);
  const change = (label: string, value: string) => fireEvent.change(view.getByLabelText(label), { target: { value } });
  return { view, messages, change };
};

test('the home example distinguishes monthly principal/interest from annual-tax and insurance housing costs', () => {
  const { view } = mount();
  assert.equal(view.queryByTestId('loan-monthly-payment'), null);
  assert.equal((view.getByRole('button', { name: '复制贷款摘要' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$4,796.40');
  assert.equal(view.getByTestId('loan-secondary-total').textContent, '$5,988.07');
  assert.equal((view.getByLabelText('房屋价格') as HTMLInputElement).value, '1000000');
  assert.equal((view.getByLabelText('首付数值') as HTMLInputElement).value, '20');
  assert.equal((view.getByLabelText('首付单位') as HTMLSelectElement).value, 'percent');
  assert.equal((view.getByLabelText('年度房产税') as HTMLInputElement).value, '12500');
  assert.equal((view.getByLabelText('年度房屋保险') as HTMLInputElement).value, '1800');
  assert.match(view.getByText(/演示使用 100 万房价/).textContent!, /不代表当前利率/);
  assert.match(view.container.querySelector('.loan-principal-strip')!.textContent!, /\$800,000\.00.*\$200,000\.00/);
  assert.match(view.container.querySelector('.loan-fee-breakdown')!.textContent!, /月均房产税.*\$1,041\.67.*月均房屋保险.*\$150\.00/);
});

test('direct-principal mode ignores retained home costs, including invalid home-only inputs', async (t) => {
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async text => { writes.push(text); });
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  change('年度房产税', 'invalid home-only amount');
  assert.ok(view.getByRole('alert'));
  fireEvent.click(view.getByRole('button', { name: '直接填写贷款本金' }));
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(view.queryByLabelText('年度房产税'), null);
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$4,796.40');
  const expected = calculateLoan({ principal: 800000, annualInterestRate: 6, termYears: 30 });
  assert.equal(view.getByTestId('loan-secondary-total').textContent, money(expected.accelerated.totalPaidCents));
  assert.equal(view.container.querySelector('.loan-fee-breakdown'), null);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制贷款摘要' })));
  assert.equal(writes.length, 1);
  assert.match(writes[0], /贷款本金：\$800,000\.00/);
  assert.doesNotMatch(writes[0], /首付：|每月住房预算|其中税/);
  fireEvent.click(view.getByRole('button', { name: '房价与首付' }));
  assert.ok(view.getByRole('alert'), 'the original home input is retained rather than silently discarded or applied to loan mode');
});

test('changing down-payment units clears the number and rejects an amount exceeding the price', () => {
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  change('首付单位', 'amount');
  assert.equal((view.getByLabelText('首付数值') as HTMLInputElement).value, '');
  assert.match(view.getByRole('alert').textContent!, /请填写首付/);
  assert.equal(view.queryByTestId('loan-monthly-payment'), null);
  change('首付数值', '200000');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$4,796.40');
  change('首付数值', '1000000.01');
  assert.match(view.getByRole('alert').textContent!, /首付不能超过房屋价格/);
  change('首付单位', 'percent');
  assert.equal((view.getByLabelText('首付数值') as HTMLInputElement).value, '');
  change('首付数值', '100.01');
  assert.ok(view.getByRole('alert'));
  assert.equal(view.queryByTestId('loan-monthly-payment'), null);
  change('首付数值', '20');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$4,796.40');
});

test('zero interest produces principal-only installments and a full-cash home retains only entered housing costs', () => {
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '直接填写贷款本金' }));
  change('贷款本金', '12000');
  change('贷款年利率', '0');
  change('贷款年限', '1');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$1,000.00');
  assert.equal(view.getByTestId('loan-secondary-total').textContent, '$12,000.00');
  assert.match(view.container.querySelector('.loan-summary-grid')!.textContent!, /当前方案利息合计\$0\.00/);
  change('贷款本金', '0');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$0.00');
  assert.equal(view.getByTestId('loan-secondary-total').textContent, '$0.00');
  assert.equal(view.queryByRole('slider'), null);
  assert.equal(view.queryByRole('table'), null);
  assert.doesNotMatch(view.container.textContent!, /NaN|Infinity/);

  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  change('首付数值', '100');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$0.00');
  assert.equal(view.getByTestId('loan-secondary-total').textContent, '$1,191.67');
  assert.equal(view.queryByRole('slider'), null);
  assert.ok(view.getByText(/贷款本金为 0，无需偿还贷款本息/));
});

test('extra principal keeps the base payment and exposes added outlay, savings, annual details and a clamped slider', () => {
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  fireEvent.click(view.getByText('看看额外还本金的影响'));
  change('每月额外还本金', '500');
  const expected = calculateLoan({ principal: 800000, annualInterestRate: 6, termYears: 30, extraMonthly: 500 });
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$4,796.40');
  assert.equal(view.getByTestId('loan-secondary-total').textContent, '$5,988.07');
  const extra = view.container.querySelector('.loan-extra-result')!;
  assert.match(extra.textContent!, /每月计划支出\s*\$6,488\.07/);
  assert.ok(extra.textContent!.includes(money(expected.interestSavedCents)));
  assert.ok(expected.interestSavedCents > 0);
  fireEvent.click(view.getByText('查看每年还款明细'));
  const table = view.getByRole('table');
  const rows = within(table).getAllByRole('row');
  assert.equal(rows.length, expected.accelerated.annualSummary.length + 1);
  const firstYear = expected.accelerated.annualSummary[0];
  assert.deepEqual(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent), [money(firstYear.principalCents), money(firstYear.interestCents), money(firstYear.balanceCents)]);
  const slider = view.getByRole('slider', { name: '查看还款年份' }) as HTMLInputElement;
  fireEvent.change(slider, { target: { value: slider.max } });
  const facts = view.container.querySelector('.loan-year-facts')!;
  assert.match(facts.textContent!, /剩余本金\s*\$0\.00/);
  change('每月额外还本金', '1000000');
  const updatedSlider = view.getByRole('slider') as HTMLInputElement;
  assert.equal(updatedSlider.value, '0');
  assert.equal(updatedSlider.max, '0');
  assert.match(view.container.querySelector('.loan-extra-result')!.textContent!, /每月计划支出\s*\$805,191\.67/);
  assert.doesNotMatch(view.container.querySelector('.loan-balance-chart')!.outerHTML, /NaN|Infinity/);
});

test('invalid precision, signs and terms remove results, while clear restores the untouched entry state', () => {
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  for (const value of ['-1', 'Infinity', '1e6', '1000000.001']) {
    change('房屋价格', value);
    assert.ok(view.getByRole('alert'));
    assert.equal(view.queryByTestId('loan-monthly-payment'), null);
    assert.equal((view.getByRole('button', { name: '复制贷款摘要' }) as HTMLButtonElement).disabled, true);
  }
  change('房屋价格', '1000000');
  for (const value of ['-1', '30.0001', '0.00001']) {
    change('贷款年利率', value);
    assert.ok(view.getByRole('alert'));
  }
  change('贷款年利率', '6');
  for (const value of ['0', '51', '1.5']) {
    change('贷款年限', value);
    assert.ok(view.getByRole('alert'));
  }
  fireEvent.click(view.getByRole('button', { name: '选择 15 年贷款' }));
  assert.equal(view.queryByRole('alert'), null);
  assert.equal((view.getByLabelText('贷款年限') as HTMLInputElement).value, '15');
  fireEvent.click(view.getByRole('button', { name: '清空贷款计算' }));
  assert.equal((view.getByLabelText('房屋价格') as HTMLInputElement).value, '');
  assert.equal((view.getByLabelText('贷款年利率') as HTMLInputElement).value, '');
  assert.equal((view.getByLabelText('首付数值') as HTMLInputElement).value, '20');
  assert.equal((view.getByLabelText('首付单位') as HTMLSelectElement).value, 'percent');
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(view.queryByTestId('loan-monthly-payment'), null);
  assert.ok(view.getByText(/填写房价或本金、利率与年限/));
});

test('copy exports the entered scenario, announces success only after resolution, and reports denied copying', async (t) => {
  const writes: string[] = [];
  let resolveCopy: (() => void) | undefined;
  t.mock.method(clipboard, 'writeText', (value: string) => { writes.push(value); return new Promise<void>(resolve => { resolveCopy = resolve; }); });
  const { view, messages } = mount();
  fireEvent.click(view.getByRole('button', { name: '载入贷款示例' }));
  fireEvent.click(view.getByRole('button', { name: '复制贷款摘要' }));
  assert.equal(writes.length, 1);
  assert.match(writes[0], /贷款本金：\$800,000\.00\n首付：\$200,000\.00/);
  assert.match(writes[0], /常规每月本息：\$4,796\.40/);
  assert.match(writes[0], /每月住房预算（未计额外还款）：\$5,988\.07/);
  assert.match(writes[0], /固定年利率：6%/);
  assert.equal(messages.length, 0);
  await act(async () => { assert.ok(resolveCopy); resolveCopy(); });
  assert.deepEqual(messages[0], { text: '贷款计算摘要已复制', type: 'success' });
  t.mock.method(clipboard, 'writeText', async () => { throw new Error('Test clipboard denied'); });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制贷款摘要' })));
  assert.deepEqual(messages.at(-1), { text: '复制失败，请手动选择页面结果复制', type: 'error' });
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$4,796.40');
});

test('the final installment and significant terminal adjustment stay explicit in both the page and copied summary', async (t) => {
  const writes: string[] = [];
  t.mock.method(clipboard, 'writeText', async value => { writes.push(value); });
  const { view, change } = mount();
  fireEvent.click(view.getByRole('button', { name: '直接填写贷款本金' }));
  change('贷款本金', '100000');
  change('贷款年利率', '30');
  change('贷款年限', '50');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$2,500.00');
  assert.match(view.container.querySelector('.loan-final-payment')!.textContent!, /最后一期贷款还款：\$102,500\.00/);
  assert.match(view.getByRole('status').textContent!, /末期需另补足 \$100,000\.00 余额/);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制贷款摘要' })));
  assert.equal(writes.length, 1);
  assert.match(writes[0], /常规每月本息：\$2,500\.00/);
  assert.match(writes[0], /最后一期贷款还款：\$102,500\.00（不含住房税费与保险）/);
  assert.match(writes[0], /末期另补足余额：\$100,000\.00，已计入最后一期金额，请核对贷款方实际还款表。/);
  change('贷款本金', '1');
  change('贷款年利率', '0');
  change('贷款年限', '1');
  assert.equal(view.getByTestId('loan-monthly-payment').textContent, '$0.08');
  assert.match(view.container.querySelector('.loan-final-payment')!.textContent!, /最后一期贷款还款：\$0\.12/);
  assert.equal(view.getByTestId('loan-secondary-total').textContent, '$1.00');
  assert.equal(view.queryByRole('status'), null);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制贷款摘要' })));
  assert.equal(writes.length, 2);
  assert.match(writes[1], /最后一期贷款还款：\$0\.12/);
  assert.doesNotMatch(writes[1], /末期另补足余额/);
});
