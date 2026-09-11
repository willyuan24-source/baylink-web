import assert from 'node:assert/strict';
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
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { LoanCalculatorTool } = await import('../src/components/tools/LoanCalculatorTool');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('monthly search matches translated English and Traditional text while preserving the region filter', async () => {
  await setLocale('en', false);
  const view = render(<MemoryRouter initialEntries={['/this-month?region=sf']}><MonthlyEdition today="2026-09-09" /></MemoryRouter>);
  fireEvent.change(view.getByRole('searchbox', { name: "Search this month's events" }), { target: { value: 'lion dances' } });
  assert.equal(view.getByRole('status').textContent, 'Found 1 event');
  assert.equal(view.container.querySelectorAll('.bl-monthly-event').length, 1);
  assert.match(view.container.querySelector('.bl-monthly-event h3')!.textContent!, /Chinatown Autumn Moon Festival/);
  assert.equal(view.getByRole('button', { name: 'San Francisco', exact: true }).getAttribute('aria-pressed'), 'true');
  await act(async () => { await setLocale('zh-Hant', false); });
  fireEvent.change(view.getByRole('searchbox', { name: '搜索當月活動' }), { target: { value: '舞獅' } });
  assert.equal(view.container.querySelectorAll('.bl-monthly-event').length, 1);
  assert.match(view.container.querySelector('.bl-monthly-event h3')!.textContent!, /舞獅/);
});

test('monthly search accepts Traditional queries while reading Simplified Chinese', async () => {
  await setLocale('zh-Hant', false);
  await setLocale('zh-Hans', false);
  const view = render(<MemoryRouter initialEntries={['/this-month?region=sf']}><MonthlyEdition today="2026-09-11" /></MemoryRouter>);
  fireEvent.change(view.getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: '舞獅' } });
  assert.equal(view.container.querySelectorAll('.bl-monthly-event').length, 1);
  assert.match(view.container.querySelector('.bl-monthly-event h3')!.textContent!, /中秋/);
  assert.equal(view.getByRole('button', { name: '旧金山', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('switching a calculated loan to Traditional preserves inputs and the repayment amount', async () => {
  await setLocale('en', false);
  const view = render(<LoanCalculatorTool onToast={() => {}} />);
  fireEvent.change(view.getByRole('textbox', { name: 'Home price', exact: true }), { target: { value: '1000000' } });
  fireEvent.change(view.getByRole('textbox', { name: 'Annual interest rate', exact: true }), { target: { value: '6' } });
  fireEvent.click(view.getByRole('button', { name: 'Choose a 15-year loan' }));
  assert.match(view.container.querySelector('.loan-balance-chart')!.textContent!, /Year 15/);
  assert.equal(view.container.querySelector('.loan-year-slider span')!.textContent, 'End of year 1');
  assert.match(view.container.textContent!, /\$6,750\.85/);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal((view.getByRole('textbox', { name: '房屋價格' }) as HTMLInputElement).value, '1000000');
  assert.equal((view.getByRole('textbox', { name: '貸款年利率' }) as HTMLInputElement).value, '6');
  assert.equal((view.getByRole('textbox', { name: '貸款年限' }) as HTMLInputElement).value, '15');
  assert.match(view.container.textContent!, /\$6,750\.85/);
});
