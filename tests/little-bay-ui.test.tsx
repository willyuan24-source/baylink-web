import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { SavedPlan } from '../src/lib/planner';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: (media: string) => ({
  media, matches: true, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
}) });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { MemoryRouter, useLocation, useNavigate } = await import('react-router-dom');
const { default: LittleBayPage } = await import('../src/pages/LittleBayPage');
const { getLittleBayStops, resolveLittleBayStop } = await import('../src/features/little-bay/catalog');
const { PLANNER_EVENTS, PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { api } = await import('../src/lib/api');
const { setLocale, translateText } = await import('../src/i18n/locale');
const originalRequest = api.request;
let copied = '';

type View = ReturnType<typeof render>;
async function open(query: Record<string, string> = {}) {
  const search = new URLSearchParams({ date: '2026-10-03', ...query, view: 'places' });
  let view!: View;
  await act(async () => {
    view = render(<MemoryRouter initialEntries={['/play?' + search.toString()]}><LittleBayPage /></MemoryRouter>);
  });
  assert.equal(view.container.querySelector('canvas'), null, 'the public list view must work without mounting WebGL');
  return view;
}
const chosenTitles = (view: View) => [...view.container.querySelectorAll('.lb-ticket-stops .is-filled strong')].map(element => element.textContent);
const visibleTitles = (view: View) => [...view.container.querySelectorAll('.lb-list-cards strong')].map(element => element.textContent);
const savedPlans = (): SavedPlan[] => JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY) || '{"plans":[]}').plans;
async function choose(view: View, title: string) {
  const button = [...view.container.querySelectorAll<HTMLButtonElement>('.lb-list-cards button')].find(item => item.querySelector('strong')?.textContent === title);
  assert.ok(button, `Expected a visible place button for ${title}`);
  await act(async () => { fireEvent.click(button); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '这一站，我想去' })); });
}

beforeEach(async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-24T19:00:00Z') });
  localStorage.clear();
  copied = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
  api.request = async () => { throw new Error('Guests must not call an account API'); };
  await setLocale('zh-Hans', false);
});
afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); });

test('shared tickets restore their region and at most three public places in the lightweight view', async () => {
  const view = await open({ stops: 'place:redwood,place:lake-merritt,place:berkeley,place:golden-gate,place:redwood,place:invented' });
  assert.equal((view.getByLabelText('探索地区') as HTMLSelectElement).value, 'east-bay');
  assert.equal((view.getByLabelText('出游日期') as HTMLInputElement).value, '2026-10-03');
  assert.equal(view.getByRole('button', { name: '地点列表', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(chosenTitles(view), ['redwood', 'lake-merritt', 'berkeley'].map(id => resolveLittleBayStop({ kind: 'place', id })!.title));
  assert.equal(savedPlans().length, 0, 'opening a shared ticket does not silently save it');
});

test('changing only the reading-language query preserves an edited draft loaded from a legacy places link', async () => {
  function LanguageQueryControl() {
    const location = useLocation();
    const navigate = useNavigate();
    return <button data-language={new URLSearchParams(location.search).get('lang') || ''} onClick={() => {
      const query = new URLSearchParams(location.search);
      query.set('lang', 'en');
      void navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
    }}>Change reading language</button>;
  }
  let view!: View;
  await act(async () => {
    view = render(<MemoryRouter initialEntries={['/play?date=2026-10-03&places=golden-gate&view=places']}><LanguageQueryControl /><LittleBayPage /></MemoryRouter>);
  });
  const bridge = resolveLittleBayStop({ kind: 'place', id: 'golden-gate' })!;
  assert.deepEqual(chosenTitles(view), [bridge.title], 'legacy places links must still initialize the public ticket');
  await act(async () => { fireEvent.change(view.getByLabelText('出游日期'), { target: { value: '2026-10-10' } }); });
  const additional = getLittleBayStops({ date: '2026-10-10', region: 'sf' }).find(item => item.kind === 'place' && item.stop.id !== 'golden-gate')!;
  assert.ok(additional);
  await choose(view, additional.title);
  const draftTitles = chosenTitles(view);
  assert.deepEqual(draftTitles, [bridge.title, additional.title]);
  assert.equal(savedPlans().length, 0, 'this regression must exercise an unsaved draft');
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: 'Change reading language' }));
    await setLocale('en', false);
  });
  assert.equal(view.getByRole('button', { name: 'Change reading language' }).getAttribute('data-language'), 'en');
  assert.equal((view.getByLabelText('Outing date') as HTMLInputElement).value, '2026-10-10', 'a language-only URL change must not restore the old shared date');
  assert.deepEqual(chosenTitles(view), draftTitles.map(title => translateText(title || '', 'en')));
  assert.equal(savedPlans().length, 0, 'language changes must not silently save a ticket');
  assert.equal(view.container.querySelector('canvas'), null);
});

test('a guest can choose three real stops, save them and update their order without duplicating the plan', async () => {
  const view = await open();
  const options = getLittleBayStops({ date: '2026-10-03', region: 'sf' });
  assert.ok(options.length >= 4);
  for (const option of options.slice(0, 3)) await choose(view, option.title);
  assert.deepEqual(chosenTitles(view), options.slice(0, 3).map(item => item.title));
  await choose(view, options[3].title);
  assert.equal(chosenTitles(view).length, 3);
  assert.match(view.getByRole('status').textContent || '', /先从车票移除一站/);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存这趟小旅行' })); });
  assert.equal(savedPlans().length, 1);
  assert.deepEqual(savedPlans()[0].stops, options.slice(0, 3).map(item => item.stop));
  assert.equal(savedPlans()[0].date, '2026-10-03');
  assert.match(view.getByRole('status').textContent || '', /已保存到这个浏览器/);
  assert.equal((view.getByRole('button', { name: '已保存', exact: true }) as HTMLButtonElement).disabled, true);
  const savedId = savedPlans()[0].id;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '将第 3 站提前' })); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存这趟小旅行' })); });
  assert.equal(savedPlans().length, 1);
  assert.equal(savedPlans()[0].id, savedId);
  assert.deepEqual(savedPlans()[0].stops, [options[0].stop, options[2].stop, options[1].stop]);
});

test('changing the outing date removes an unavailable event while retaining selected places', async () => {
  const fleet = PLANNER_EVENTS.find(event => event.id === 'san-francisco-fleet-week-2026')!;
  const bridge = resolveLittleBayStop({ kind: 'place', id: 'golden-gate' })!;
  const view = await open({ date: '2026-10-10', stops: `event:${fleet.id},place:golden-gate` });
  assert.deepEqual(chosenTitles(view), [fleet.title, bridge.title]);
  await act(async () => { fireEvent.change(view.getByLabelText('出游日期'), { target: { value: '2026-10-13' } }); });
  assert.deepEqual(chosenTitles(view), [bridge.title]);
  assert.match(view.getByRole('status').textContent || '', /已移除新日期没有举办的活动/);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存这趟小旅行' })); });
  assert.equal(savedPlans()[0].date, '2026-10-13');
  assert.deepEqual(savedPlans()[0].stops, [bridge.stop]);
});

test('past shared dates stay unchanged and an incomplete date edit does not erase the ticket', async () => {
  const bridge = resolveLittleBayStop({ kind: 'place', id: 'golden-gate' })!;
  const view = await open({ date: '2026-09-23', stops: 'place:golden-gate' });
  const dateInput = view.getByLabelText('出游日期') as HTMLInputElement;
  assert.equal(dateInput.value, '2026-09-23', 'a historical share must not silently become this Saturday');
  assert.deepEqual(chosenTitles(view), [bridge.title]);
  assert.equal((view.getByRole('button', { name: '保存这趟小旅行' }) as HTMLButtonElement).disabled, true);
  await act(async () => { fireEvent.change(dateInput, { target: { value: '' } }); });
  assert.deepEqual(chosenTitles(view), [bridge.title], 'clearing the date while editing must preserve the draft');
  assert.equal((view.getByRole('button', { name: '分享车票' }) as HTMLButtonElement).disabled, true);
  assert.equal((view.getByRole('button', { name: '保存这趟小旅行' }) as HTMLButtonElement).disabled, true);
  await act(async () => { fireEvent.change(dateInput, { target: { value: '2026-10-03' } }); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存这趟小旅行' })); });
  assert.equal(savedPlans()[0].date, '2026-10-03');
  assert.deepEqual(savedPlans()[0].stops, [bridge.stop]);
});

test('free and region filters update discovery cards without deleting the existing ticket', async () => {
  const alcatraz = resolveLittleBayStop({ kind: 'place', id: 'alcatraz' })!;
  const view = await open({ stops: 'place:alcatraz' });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '主体免费', exact: true })); });
  assert.equal(view.getByRole('button', { name: '主体免费', exact: true }).getAttribute('aria-pressed'), 'true');
  const sfFree = getLittleBayStops({ date: '2026-10-03', region: 'sf', freeOnly: true });
  assert.deepEqual(visibleTitles(view), sfFree.map(item => item.title));
  assert.ok(!visibleTitles(view).includes(alcatraz.title));
  assert.deepEqual(chosenTitles(view), [alcatraz.title]);
  await act(async () => { fireEvent.change(view.getByLabelText('探索地区'), { target: { value: 'east-bay' } }); });
  const eastFree = getLittleBayStops({ date: '2026-10-03', region: 'east-bay', freeOnly: true });
  assert.ok(eastFree.length);
  assert.deepEqual(visibleTitles(view), eastFree.map(item => item.title));
  for (const title of visibleTitles(view)) {
    assert.ok([...PLANNER_EVENTS, ...PLANNER_PLACES].some(item => item.title === title && item.region === 'east-bay' && item.cost === 'free'));
  }
  assert.deepEqual(chosenTitles(view), [alcatraz.title]);
});

test('sharing returns to /play with public references and recipient-controlled language, including a clipboard-denied fallback', async () => {
  await setLocale('en', false);
  const view = await open({ stops: 'place:golden-gate,place:chinatown', userId: 'private-user', token: 'private-token', note: 'private-note' });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Share', exact: true })); });
  const link = new URL(copied);
  assert.equal(link.origin, 'https://www.baylink.us');
  assert.equal(link.pathname, '/play');
  assert.deepEqual([...link.searchParams.keys()].sort(), ['date', 'stops']);
  assert.equal(link.searchParams.get('date'), '2026-10-03');
  assert.equal(link.searchParams.has('lang'), false, 'the recipient should use their own reading language');
  assert.equal(link.searchParams.get('stops'), 'place:golden-gate,place:chinatown');
  assert.ok(!copied.includes('private'));
  const field = view.getByLabelText('Public places and date link') as HTMLInputElement;
  assert.equal(field.value, copied);
  assert.equal(field.readOnly, true);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('NotAllowedError'); } } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Share', exact: true })); });
  assert.match(view.getByRole('status').textContent || '', /Copy it from the field below/);
  assert.equal(field.value, copied);
});
