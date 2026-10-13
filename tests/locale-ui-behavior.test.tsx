import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { setLocale } from '../src/i18n/locale';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// The events column imports its stylesheet; here CSS loads as an empty module.
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { LoanCalculatorTool } = await import('../src/components/tools/LoanCalculatorTool');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

const titles = (root: ParentNode) => [...root.querySelectorAll('.ui-feed-card h3')].map(heading => heading.textContent);
const search = async (view: ReturnType<typeof render>, filters: RegExp, keyword: RegExp, value: string) => {
  fireEvent.click(view.getByRole('button', { name: filters }));
  const sheet = await view.findByRole('dialog');
  fireEvent.change(within(sheet).getByRole('searchbox', { name: keyword }), { target: { value } });
  fireEvent.keyDown(sheet, { key: 'Escape' });
};

test('the events column’s keyword search matches translated English and Traditional text while keeping the region', async () => {
  await setLocale('en', false);
  const view = render(<MemoryRouter initialEntries={['/this-month?region=sf']}><MonthlyEdition today="2026-10-09" /></MemoryRouter>);
  await search(view, /Filters/, /Keyword/, 'fleet week');
  assert.equal(view.getByRole('status').textContent, '1 event');
  assert.match(titles(view.container).join(), /San Francisco Fleet Week/);
  assert.match(view.container.querySelector('.ev-range')!.textContent!, /San Francisco$/, 'the region filter is kept');
  await act(async () => { await setLocale('zh-Hant', false); });
  await search(view, /篩選/, /關鍵詞/, '海灣與城市');
  assert.deepEqual(titles(view.container).length, 1);
  assert.match(titles(view.container)[0]!, /海灣與城市/);
});

test('the events column’s keyword search accepts Traditional queries while reading Simplified Chinese', async () => {
  await setLocale('zh-Hant', false);
  await setLocale('zh-Hans', false);
  const view = render(<MemoryRouter initialEntries={['/this-month?region=sf']}><MonthlyEdition today="2026-10-09" /></MemoryRouter>);
  await search(view, /筛选/, /关键词/, '海灣與城市');
  assert.equal(titles(view.container).length, 1);
  assert.match(titles(view.container)[0]!, /海湾与城市/);
  assert.match(view.container.querySelector('.ev-range')!.textContent!, /旧金山$/);
});

test('switching a calculated loan to Traditional preserves inputs and the repayment amount', async () => {
  await setLocale('en', false);
  const view = render(<LoanCalculatorTool onToast={() => {}} />);
  fireEvent.change(view.getByRole('textbox', { name: 'Home price', exact: true }), { target: { value: '1000000' } });
  fireEvent.change(view.getByRole('textbox', { name: 'Annual interest rate', exact: true }), { target: { value: '6' } });
  fireEvent.click(view.getByRole('button', { name: 'Choose a 15-year loan' }));
  assert.match(view.container.querySelector('.loan-chart-axis')!.textContent!, /Year 15/);
  assert.equal(view.container.querySelector('.loan-year-slider span')!.textContent, 'End of year 1');
  assert.match(view.container.textContent!, /\$6,750\.85/);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal((view.getByRole('textbox', { name: '房屋價格' }) as HTMLInputElement).value, '1000000');
  assert.equal((view.getByRole('textbox', { name: '貸款年利率' }) as HTMLInputElement).value, '6');
  assert.equal((view.getByRole('textbox', { name: '貸款年限' }) as HTMLInputElement).value, '15');
  assert.match(view.container.textContent!, /\$6,750\.85/);
});
