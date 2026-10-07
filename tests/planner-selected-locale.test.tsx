import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/en/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
await import('../src/i18n/router');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { setLocale } = await import('../src/i18n/locale');
const { api } = await import('../src/lib/api');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const originalRequest = api.request;
const eventId = 'nov2026-crab-cove-bay-bird-morning';
const date = '2026-11-22';
type View = ReturnType<typeof render>;
const editor = (view: View) => within(view.getByRole('complementary'));
const links = (view: View) => [...view.container.querySelectorAll('.planner-stops > li > a')].map(link => link.getAttribute('href'));
const input = (view: View, label: string) => editor(view).getByLabelText(label) as HTMLInputElement;
function noChineseAppText(view: View) {
  const walker = document.createTreeWalker(view.container, dom.window.NodeFilter.SHOW_TEXT);
  const untranslated: string[] = [];
  while (walker.nextNode()) if (/\p{Script=Han}/u.test(walker.currentNode.textContent!)) untranslated.push(walker.currentNode.textContent!);
  assert.deepEqual(untranslated, []);
  for (const element of view.container.querySelectorAll('[aria-label]')) assert.doesNotMatch(element.getAttribute('aria-label')!, /\p{Script=Han}/u);
}
async function open(stops = `event:${eventId}`) {
  let view!: View;
  await act(async () => {
    view = render(<MemoryRouter basename="/en" initialEntries={[`/en/plan?stops=${stops}&date=${date}`]}><PlannerPage /></MemoryRouter>);
  });
  return view;
}
beforeEach(async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-07T19:00:00Z') });
  localStorage.clear();
  // Deliberately never loadLocale('en'): a fresh browser only gets this route's scopes.
  await setLocale('en', false, '/en/plan');
  api.request = async endpoint => { throw new Error(`Unexpected API call: ${endpoint}`); };
});
afterEach(async () => { cleanup(); localStorage.clear(); api.request = originalRequest; await setLocale('zh-Hans', false); });

test('fresh English selected plan translates controls before interaction and replacement, cancellation and undo preserve the draft', async () => {
  const view = await open();
  const selected = editor(view).getByRole('list', { name: 'Selected places' });
  assert.equal(within(selected).getByRole('button', { name: 'Replace this stop' }).textContent, 'Replace');
  assert.ok(within(selected).getByRole('button', { name: 'Remove this stop' }));
  noChineseAppText(view);
  const original = links(view);
  fireEvent.change(input(view, 'Plan name'), { target: { value: '家人的 $50 outing' } });
  const assertDraft = () => {
    assert.equal(input(view, 'Plan name').value, '家人的 $50 outing');
    assert.equal(input(view, 'Date').value, date);
  };
  fireEvent.click(within(selected).getByRole('button', { name: 'Replace this stop' }));
  assert.ok(editor(view).getByText('Choose a replacement from the places list.'));
  assert.match(editor(view).getAllByRole('status').map(node => node.textContent).join(' '), /Replacing stop 1 — choose a replacement from the places list\./);
  assert.ok(view.getAllByRole('button', { name: 'Replace selected stop' }).length);
  noChineseAppText(view);
  fireEvent.click(editor(view).getByRole('button', { name: 'Cancel replacement' }));
  assert.deepEqual(links(view), original);
  assertDraft();
  assert.equal(view.queryByRole('button', { name: 'Replace selected stop' }), null);
  fireEvent.click(editor(view).getByRole('button', { name: 'Replace this stop' }));
  fireEvent.click(view.getByRole('button', { name: 'Attractions', exact: true }));
  const replacement = view.container.querySelector('.planner-catalog article[id^="catalog-place:"]') as HTMLElement;
  assert.ok(replacement);
  const replacementHref = within(replacement).getByRole('link', { name: 'Read more' }).getAttribute('href');
  fireEvent.click(within(replacement).getByRole('button', { name: 'Replace selected stop' }));
  assert.deepEqual(links(view), [replacementHref]);
  assert.ok(editor(view).getByRole('status').textContent?.includes('Stop replaced. Your other places and date are unchanged.'));
  assertDraft();
  noChineseAppText(view);
  fireEvent.click(editor(view).getByRole('button', { name: 'Undo the last change' }));
  assert.deepEqual(links(view), original);
  assertDraft();
  await act(async () => { await setLocale('zh-Hant', false, '/zh-Hant/plan'); });
  assert.ok(editor(view).getByRole('list', { name: '所選地點' }));
  assert.equal(editor(view).getByRole('button', { name: '替換此站' }).textContent, '換');
  await act(async () => { await setLocale('en', false, '/en/plan'); });
  assertDraft();
  noChineseAppText(view);
});

test('replacement date rejection and six-stop limit are English and do not mutate selected stops', async () => {
  let view = await open();
  const original = links(view);
  fireEvent.click(editor(view).getByRole('button', { name: 'Replace this stop' }));
  fireEvent.change(view.getByLabelText('Outing date'), { target: { value: '2026-10-10' } });
  const candidate = view.container.querySelector('.planner-catalog article[id^="catalog-event:"]') as HTMLElement;
  assert.ok(candidate);
  fireEvent.click(within(candidate).getByRole('button', { name: 'Replace selected stop' }));
  assert.ok(editor(view).getByText('This event is not on your plan date. Choose an event on the same day.'));
  assert.deepEqual(links(view), original);
  assert.equal(input(view, 'Date').value, date);
  noChineseAppText(view);
  view.unmount();
  const places = PLANNER_PLACES.slice(0, 6).map(place => `place:${place.id}`);
  view = await open(places.join(','));
  const sixStops = links(view);
  assert.equal(sixStops.length, 6);
  assert.equal(editor(view).getAllByRole('button', { name: 'Move stop up' }).length, 5);
  const extraEvent = view.container.querySelector('.planner-catalog article[id^="catalog-event:"]') as HTMLElement;
  assert.ok(extraEvent);
  fireEvent.click(within(extraEvent).getByRole('button', { name: 'Add to plan' }));
  assert.ok(editor(view).getByText('A plan can have up to six stops. Remove one before adding another.'));
  assert.deepEqual(links(view), sixStops);
  noChineseAppText(view);
});
