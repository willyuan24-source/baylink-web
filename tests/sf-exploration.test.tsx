import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { collectSfExplorationStamp, emptySfExploration, parseSfExploration, SF_EXPLORATION_ROUTES, SF_EXPLORATION_STOPS, SF_EXPLORATION_STOP_BY_ID, SF_RESIDENTS, sfExplorationStorageKey, sfRouteProgress } from '../src/features/little-bay/sf-exploration';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, renderHook } = await import('@testing-library/react');
const { default: SfExplorationPanel } = await import('../src/features/little-bay/SfExplorationPanel');
const { useSfExploration } = await import('../src/features/little-bay/useSfExploration');
afterEach(() => { cleanup(); window.localStorage.clear(); document.body.replaceChildren(); });

test('all trip nodes, authored residents and encounter choices have valid stable IDs', () => {
  assert.equal(new Set(SF_EXPLORATION_STOPS.map(stop => stop.id)).size, SF_EXPLORATION_STOPS.length);
  for (const route of SF_EXPLORATION_ROUTES) {
    assert.equal(new Set(route.stopIds).size, route.stopIds.length);
    for (const id of route.stopIds) assert.ok(SF_EXPLORATION_STOP_BY_ID[id]);
  }
  for (const resident of SF_RESIDENTS) {
    assert.ok(SF_EXPLORATION_STOP_BY_ID[resident.landmarkId]);
    for (const id of resident.recommendationIds) assert.ok(SF_EXPLORATION_STOP_BY_ID[id]);
  }
  for (const stop of SF_EXPLORATION_STOPS) {
    assert.ok(stop.choices.length >= 2);
    assert.equal(new Set(stop.choices.map(choice => choice.id)).size, stop.choices.length);
  }
});

test('only an actual matching arrival can collect a known choice, once', () => {
  const empty = emptySfExploration();
  assert.equal(collectSfExplorationStamp(empty, 'pier', null, 'listen'), empty, 'overview does not award a stamp');
  assert.equal(collectSfExplorationStamp(empty, 'pier', 'park', 'listen'), empty, 'another nearby landmark is insufficient');
  assert.equal(collectSfExplorationStamp(empty, 'pier', 'pier', 'untrusted-choice'), empty);
  assert.equal(collectSfExplorationStamp(empty, '__proto__', '__proto__'), empty);
  assert.equal(collectSfExplorationStamp(empty, 'pier', 'pier', 'listen', new Date('invalid')), empty);
  const collected = collectSfExplorationStamp(empty, 'pier', 'pier', 'listen', new Date('2026-09-24T20:00:00Z'));
  assert.deepEqual(collected.stamps.pier, { collectedAt: '2026-09-24T20:00:00.000Z', choiceId: 'listen' });
  assert.equal(Object.keys(empty.stamps).length, 0, 'previous progress is immutable');
  assert.equal(collectSfExplorationStamp(collected, 'pier', 'pier', 'draw'), collected, 'repeated collection never overwrites the first memory');
});

test('corrupt, future-version and partially invalid saves recover without invented progress', () => {
  for (const raw of [null, '{broken', 'null', '[]', '{"version":2}', 'x'.repeat(50_001)]) assert.deepEqual(parseSfExploration(raw), emptySfExploration());
  const parsed = parseSfExploration(JSON.stringify({ version: 1, activeRouteId: 'waterfront-day', stamps: {
    pier: { collectedAt: '2026-09-24T20:00:00Z', choiceId: 'listen', injected: true },
    park: { collectedAt: 'not-a-date', choiceId: 'picnic' },
    bridge: { collectedAt: '2026-09-24', choiceId: 'missing-choice' },
    'unknown-place': { collectedAt: '2026-09-24', choiceId: 'untrusted' },
  } }));
  assert.equal(parsed.activeRouteId, 'waterfront-day');
  assert.deepEqual(parsed.stamps, { pier: { collectedAt: '2026-09-24T20:00:00Z', choiceId: 'listen' } });
  assert.equal(parseSfExploration('{"version":1,"activeRouteId":"toString","stamps":[]}').activeRouteId, null);
});

test('route progression skips collected nodes and finishes exactly at the last unique stamp', () => {
  const route = SF_EXPLORATION_ROUTES.find(item => item.id === 'waterfront-day')!;
  let progress = emptySfExploration();
  progress = collectSfExplorationStamp(progress, 'pier', 'pier');
  assert.deepEqual(sfRouteProgress(progress, route), { completed: 1, total: 3, nextStopId: 'ferry' });
  progress = collectSfExplorationStamp(progress, 'ferry', 'ferry');
  assert.equal(sfRouteProgress(progress, route).nextStopId, 'skystar');
  progress = collectSfExplorationStamp(progress, 'skystar', 'skystar');
  assert.deepEqual(sfRouteProgress(progress, route), { completed: 3, total: 3, nextStopId: null });
});

test('journal hook persists choices, isolates owners and reloads without leaking another account', () => {
  const view = renderHook(({ owner }: { owner?: string }) => useSfExploration(owner), { initialProps: { owner: 'first' } });
  act(() => {
    view.result.current.startRoute('waterfront-day');
    assert.equal(view.result.current.collect('pier', 'pier', 'listen'), true);
  });
  assert.equal(view.result.current.collectedCount, 1);
  assert.equal(view.result.current.nextStopId, 'ferry');
  assert.equal(parseSfExploration(window.localStorage.getItem(sfExplorationStorageKey('first'))).stamps.pier.choiceId, 'listen');
  view.rerender({ owner: 'second' });
  assert.equal(view.result.current.collectedCount, 0);
  assert.equal(view.result.current.activeRoute, null);
  act(() => { view.result.current.collect('park', 'park', 'sketch'); });
  view.rerender({ owner: 'first' });
  assert.equal(view.result.current.collectedCount, 1);
  assert.equal(view.result.current.progress.stamps.pier.choiceId, 'listen');
  assert.equal(view.result.current.progress.stamps.park, undefined);
  assert.notEqual(sfExplorationStorageKey(), sfExplorationStorageKey('guest'));
  assert.notEqual(sfExplorationStorageKey('a:b'), sfExplorationStorageKey('a%3Ab'));
  view.unmount();
  const restored = renderHook(() => useSfExploration('second'));
  assert.equal(restored.result.current.progress.stamps.park.choiceId, 'sketch');
});

test('journal stays playable when browser storage is unavailable', () => {
  const getItem = dom.window.Storage.prototype.getItem;
  const setItem = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
  dom.window.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  try {
    const view = renderHook(() => useSfExploration());
    act(() => { view.result.current.collect('park', 'park', 'picnic'); });
    assert.equal(view.result.current.collectedCount, 1);
  } finally {
    dom.window.Storage.prototype.getItem = getItem;
    dom.window.Storage.prototype.setItem = setItem;
  }
});

function makePanel(overrides: Partial<React.ComponentProps<typeof SfExplorationPanel>> = {}) {
  const calls = { collect: [] as string[][], travel: [] as string[], routes: [] as string[], guides: [] as string[], closes: 0 };
  const props: React.ComponentProps<typeof SfExplorationPanel> = { locale: 'en', progress: emptySfExploration(), currentNearId: null,
    onStartRoute: id => { calls.routes.push(id); }, onCollect: (id, choice) => { calls.collect.push([id, choice ?? '']); }, onTravel: id => { calls.travel.push(id); }, onGuide: id => { calls.guides.push(id); }, onClose: () => { calls.closes += 1; }, ...overrides };
  return { calls, props, view: render(<SfExplorationPanel {...props} />) };
}

test('encounter requires a memory choice and explains the virtual-only stamp', () => {
  const { view, calls } = makePanel({ currentNearId: 'pier' });
  const collect = view.getByRole('button', { name: 'Keep this virtual stamp' });
  assert.equal((collect as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('button', { name: 'Listen quietly' }));
  assert.match(view.getByRole('status').textContent ?? '', /counts the calls/);
  assert.equal((collect as HTMLButtonElement).disabled, false);
  assert.deepEqual(calls.collect, [], 'choosing alone is not collection');
  fireEvent.click(collect);
  assert.deepEqual(calls.collect, [['pier', 'listen']]);
  assert.match(view.getByText(/Virtual stamps stay in this browser/).textContent ?? '', /do not record real visits/);
});

test('overview has no collect action and a changed arrival cannot reuse an old choice', () => {
  const { view, props, calls } = makePanel({ initialTab: 'encounter' });
  assert.equal(view.queryByRole('button', { name: 'Keep this virtual stamp' }), null);
  view.rerender(<SfExplorationPanel {...props} currentNearId="pier" />);
  fireEvent.click(view.getByRole('button', { name: 'Listen quietly' }));
  view.rerender(<SfExplorationPanel {...props} currentNearId="park" />);
  assert.equal((view.getByRole('button', { name: 'Keep this virtual stamp' }) as HTMLButtonElement).disabled, true);
  assert.deepEqual(calls.collect, []);
});

test('collecting keeps keyboard focus inside the dialog after the collect button disappears', () => {
  let closed = false;
  function Harness() {
    const exploration = useSfExploration();
    return <SfExplorationPanel locale="en" progress={exploration.progress} currentNearId="pier" onCollect={(id, choice) => { exploration.collect(id, 'pier', choice); }} onStartRoute={() => {}} onTravel={() => {}} onGuide={() => {}} onClose={() => { closed = true; }} />;
  }
  const view = render(<Harness />);
  fireEvent.click(view.getByRole('button', { name: 'Listen quietly' }));
  const collect = view.getByRole('button', { name: 'Keep this virtual stamp' });
  collect.focus();
  fireEvent.click(collect);
  assert.equal(view.queryByRole('button', { name: 'Keep this virtual stamp' }), null);
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Close journal' }));
  assert.equal(view.getByRole('status').textContent, 'Saved to your journal');
  fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Explore the real place' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  assert.equal(closed, true);
});

test('trips travel to the next uncollected stop and residents are explicitly authored', () => {
  const progress = collectSfExplorationStamp(emptySfExploration(), 'ferry', 'ferry');
  const { view, calls } = makePanel({ progress, initialTab: 'routes' });
  const waterfront = view.getByRole('heading', { name: 'Hello along the waterfront' }).closest('article')!;
  fireEvent.click(waterfront.querySelector('button')!);
  assert.deepEqual(calls.routes, ['waterfront-day']);
  assert.deepEqual(calls.travel, ['pier']);
  fireEvent.click(view.getByRole('button', { name: 'Neighbors' }));
  assert.ok(view.getByText('Authored character'));
  fireEvent.click(view.getByRole('button', { name: /Kai Bay watcher/ }));
  fireEvent.click(view.getByRole('button', { name: 'Read guide: PIER 39' }));
  assert.deepEqual(calls.guides, ['pier']);
});

test('journal traps focus, stops movement keys, closes with Escape and restores focus', () => {
  const opener = document.createElement('button');
  opener.textContent = 'Open journal';
  document.body.append(opener); opener.focus();
  let leaked = 0;
  const listener = () => { leaked += 1; };
  window.addEventListener('keydown', listener);
  const { view, calls } = makePanel();
  const dialog = view.getByRole('dialog');
  const close = view.getByRole('button', { name: 'Close journal' });
  assert.equal(document.activeElement, close);
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  const buttons = dialog.querySelectorAll('button');
  assert.equal(document.activeElement, buttons[buttons.length - 1]);
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  assert.equal(document.activeElement, close);
  fireEvent.keyDown(close, { key: 'w' });
  assert.equal(leaked, 0);
  fireEvent.keyDown(close, { key: 'Escape' });
  assert.equal(calls.closes, 1);
  view.unmount();
  assert.equal(document.activeElement, opener);
  window.removeEventListener('keydown', listener);
});
