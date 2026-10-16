import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AppContextValue } from '../src/app/context';

/**
 * WEB-PERF-3 review (H20): the first use of 行程's form on a plain visit, before the workspace is in, is not lost. Words
 * typed into the HTML page before the app ran, words typed and an example tap (which fills the box at once) on the
 * prerendered form the app shows meanwhile: the live workspace that replaces it keeps the text, the focus and the caret
 * (src/features/plan/boot-carry.ts).
 */
process.env.BAYLINK_LAZY_PLAN = '1';
const EXAMPLE = '明天在旧金山找家餐厅，再去附近逛逛';
const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="root"><main data-prerender-path="/plan"><fieldset class="planner-interaction-scope"><div class="planner-data-slot" data-plan-slot=""><section id="plan-days">已排的日子</section><form class="planner-form"><label class="planner-question">这次想怎么过？<textarea maxlength="800"></textarea></label><div class="ui-chip-row planner-examples"><button type="button" class="ui-chip">${EXAMPLE}</button><button type="button" class="ui-chip">这个周末东湾有哪些新店？</button></div></form></div></fieldset></main></div></body></html>`, { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// Typed while the page was only HTML (before 行程's route code ran): the route code picks it up when it captures the page.
dom.window.document.querySelector('textarea')!.value = '周日去海边';
const { render, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { api } = await import('../src/lib/api');

test('an example tap and the words typed on the prerendered form survive the swap, with the focus and the caret', async () => {
  localStorage.clear();
  const sent: string[] = [];
  api.request = (async (endpoint: string, options?: RequestInit) => { sent.push(`${endpoint} ${JSON.parse(String(options?.body)).message}`); return new Promise(() => {}); }) as typeof api.request;
  let view!: ReturnType<typeof render>;
  act(() => {
    view = render(<MemoryRouter initialEntries={['/plan']}><Routes><Route element={<Outlet context={{ openBayBay: () => {}, setShowLogin: () => {} } as unknown as AppContextValue} />}>
      <Route path="/plan" element={<PlannerPage />} />
    </Route></Routes></MemoryRouter>);
  });
  const boot = view.container.querySelector<HTMLTextAreaElement>('[aria-busy="true"] .planner-question textarea');
  assert.ok(boot, 'the prerendered form is on screen while the workspace loads');
  assert.equal(boot!.value, '周日去海边', 'what was typed into the HTML page before the app ran is still in the box');
  // a tap on an example fills the box at once (and asks for the workspace)
  act(() => { boot!.parentElement!.parentElement!.querySelector<HTMLButtonElement>('.planner-examples button')!.click(); });
  assert.equal(boot!.value, EXAMPLE);
  // the reader goes on typing in the box, then taps 帮我挑选方案 before the workspace is in: no reload (it would lose the
  // words); the request goes out once the workspace is in
  let defaultPrevented = false;
  act(() => {
    boot!.focus();
    boot!.value = `${EXAMPLE}，周六带孩子去`;
    boot!.setSelectionRange(boot!.value.length, boot!.value.length);
    boot!.dispatchEvent(new window.Event('input', { bubbles: true }));
    const submit = new window.Event('submit', { bubbles: true, cancelable: true });
    boot!.closest('form')!.dispatchEvent(submit);
    defaultPrevented = submit.defaultPrevented;
  });
  assert.equal(defaultPrevented, true, 'the prerendered form never submits natively');
  await waitFor(() => assert.ok(view.container.querySelector('.planner-catalog')), { timeout: 20000 });
  await waitFor(() => assert.deepEqual(sent, [`/planner/recommend ${EXAMPLE}，周六带孩子去`]), { timeout: 5000 });
  const live = view.container.querySelector<HTMLTextAreaElement>('.planner-form .planner-question textarea')!;
  assert.equal(view.container.querySelector('[aria-busy="true"] .planner-question'), null, 'the live workspace replaced the prerendered form');
  assert.equal(live.value, `${EXAMPLE}，周六带孩子去`, 'the words typed so far are still there');
  assert.equal(document.activeElement, live, 'the box still has the focus');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  assert.equal(live.selectionStart, live.value.length, 'the caret where it was');
});
