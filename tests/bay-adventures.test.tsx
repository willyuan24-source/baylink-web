import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useEffect } from 'react';
import { JSDOM } from 'jsdom';
import { acceptBayAdventure, adventureNextKey, BAY_ADVENTURES, bayAdventuresKey, checkInBayAdventure, emptyBayAdventures, parseBayAdventures } from '../src/features/little-bay/bay-adventures';
import { bayApproach, bayArrival, baySegmentCanMove, getUnifiedPlace } from '../src/features/little-bay/unified-bay-world';
import { routeBay } from '../src/features/little-bay/unified-bay-routing';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderHook, render, act, cleanup, fireEvent } = await import('@testing-library/react');
const { useBayAdventures } = await import('../src/features/little-bay/useBayAdventures');
const { default: BayAdventureJournal } = await import('../src/features/little-bay/BayAdventureJournal');
afterEach(() => { cleanup(); window.localStorage.clear(); });

test('adventure stories use real map anchors for regional loops and local trails, with no invented award eligibility', () => {
  assert.equal(BAY_ADVENTURES.length, 6);
  for (const quest of BAY_ADVENTURES) {
    assert.ok(quest.steps.length >= 3 && quest.steps.length <= 4);
    if (!['peninsula-small-stops', 'east-bay-green-pages'].includes(quest.id))
      assert.ok(new Set(quest.steps.map(step => getUnifiedPlace(step.key)?.region)).size >= 2);
    for (const step of quest.steps) { assert.ok(getUnifiedPlace(step.key)); assert.ok(step.action.en && step.memory.zh); }
  }
  assert.equal(new Set(BAY_ADVENTURES.find(q => q.id === 'around-the-bay')!.steps.map(s => getUnifiedPlace(s.key)!.region)).size, 4);
});

test('new local trails connect useful stops within one region by traversable game routes', () => {
  const expected = [
    { id: 'peninsula-small-stops', region: 'peninsula', keys: ['peninsula:millbrae-transit', 'peninsula:twin-pines', 'peninsula:burgess-park'] },
    { id: 'east-bay-green-pages', region: 'east-bay', keys: ['east-bay:hayward-garden', 'east-bay:fremont-central-park', 'east-bay:ardenwood'] },
  ];
  for (const trail of expected) {
    const quest = BAY_ADVENTURES.find(item => item.id === trail.id)!;
    assert.deepEqual(quest.steps.map(item => item.key), trail.keys);
    const places = quest.steps.map(item => getUnifiedPlace(item.key)!);
    assert.ok(places.every(place => place.region === trail.region));
    assert.ok(new Set(places.map(place => place.regional?.city)).size >= 2);
    for (let index = 1; index < places.length; index++) {
      const route = routeBay(bayApproach(places[index - 1]), places[index].key);
      assert.equal(route.available, true, `${quest.id}: ${places[index].key}`);
      assert.equal(route.requiresFerry, false);
      assert.equal(bayArrival(...route.points.at(-1)!)?.key, places[index].key, 'route ends within the physical arrival area');
      for (let segment = 1; segment < route.points.length; segment++)
        assert.equal(baySegmentCanMove(route.points[segment - 1], route.points[segment]), true, 'the new trail never cuts across unplayable water');
    }
  }
});

test('local trails reject remote or out-of-order collection, resume independently and award each keepsake once', () => {
  const timestamp = new Date('2026-09-25T18:00:00.000Z');
  let progress = acceptBayAdventure(emptyBayAdventures(), 'bay-postcard');
  progress = checkInBayAdventure(progress, 'sf:ferry', timestamp);
  for (const id of ['peninsula-small-stops', 'east-bay-green-pages']) {
    const quest = BAY_ADVENTURES.find(item => item.id === id)!;
    progress = acceptBayAdventure(progress, id);
    assert.equal(checkInBayAdventure(progress, null, timestamp), progress);
    assert.equal(checkInBayAdventure(progress, quest.steps[2].key, timestamp), progress);
    for (const stop of quest.steps) {
      assert.equal(adventureNextKey(progress), stop.key);
      progress = checkInBayAdventure(progress, stop.key, timestamp);
      assert.equal(checkInBayAdventure(progress, stop.key, timestamp), progress, 'returning to the same stop cannot duplicate its memory');
      progress = parseBayAdventures(JSON.stringify(progress));
    }
    assert.equal(adventureNextKey(progress), null);
    assert.equal(progress.stamps[id].length, 3);
  }
  progress = acceptBayAdventure(progress, 'bay-postcard');
  assert.equal(adventureNextKey(progress), 'east-bay:jack-london', 'new trails preserve the existing postcard save');
  assert.equal(progress.stamps['peninsula-small-stops'].length, 3);
  assert.equal(progress.stamps['east-bay-green-pages'].length, 3);
});

test('map selection never awards a step; only the physical next stop can be checked in sequentially', () => {
  const empty = emptyBayAdventures(), quest = BAY_ADVENTURES[0];
  assert.equal(acceptBayAdventure(empty, 'not-a-quest'), empty);
  assert.equal(checkInBayAdventure(empty, quest.steps[0].key), empty);
  const active = acceptBayAdventure(empty, quest.id);
  assert.deepEqual(active.stamps, {});
  assert.equal(adventureNextKey(active), quest.steps[0].key);
  assert.equal(checkInBayAdventure(active, quest.steps[1].key), active);
  assert.equal(checkInBayAdventure(active, null), active);
  assert.equal(checkInBayAdventure(active, quest.steps[0].key, new Date('bad')), active);
  const first = checkInBayAdventure(active, quest.steps[0].key);
  assert.equal(adventureNextKey(first), quest.steps[1].key);
  assert.equal(checkInBayAdventure(first, quest.steps[0].key), first);
  const second = checkInBayAdventure(first, quest.steps[1].key);
  const finished = checkInBayAdventure(second, quest.steps[2].key);
  assert.equal(adventureNextKey(finished), null);
  assert.equal(checkInBayAdventure(finished, quest.steps[2].key), finished);
  assert.equal(finished.stamps[quest.id].length, 3);
  assert.deepEqual(empty.stamps, {});
});

test('corrupted journals cannot skip a missing step or introduce unknown quests', () => {
  const valid = '2026-09-25T12:00:00.000Z';
  const parsed = parseBayAdventures(JSON.stringify({ version: 1, activeId: '__proto__', stamps: { 'bay-postcard': [valid, 'bad', valid], 'bright-ideas': [valid, valid, valid, valid], 'invented': [valid] } }));
  assert.equal(parsed.activeId, null);
  assert.deepEqual(parsed.stamps['bay-postcard'], [valid]);
  assert.equal(parsed.stamps['bright-ideas'].length, 3);
  assert.equal(parsed.stamps.invented, undefined);
  for (const raw of ['{', 'null', '[]', '{"version":2}', 'x'.repeat(20_001)]) assert.deepEqual(parseBayAdventures(raw), emptyBayAdventures());
});

test('progress survives switching trails and accounts without copying guest or another account data', () => {
  const view = renderHook(({ owner }: { owner?: string }) => useBayAdventures(owner), { initialProps: { owner: undefined } });
  act(() => { view.result.current.accept('bay-postcard'); view.result.current.checkIn('sf:ferry'); });
  assert.equal(view.result.current.nextKey, 'east-bay:jack-london');
  act(() => { view.result.current.accept('bright-ideas'); view.result.current.checkIn('peninsula:stanford'); view.result.current.cancel(); });
  assert.equal(view.result.current.activeQuest, undefined);
  act(() => view.result.current.accept('bay-postcard'));
  assert.equal(view.result.current.nextKey, 'east-bay:jack-london');
  view.rerender({ owner: 'one' });
  assert.deepEqual(view.result.current.progress.stamps, {});
  act(() => { view.result.current.accept('coastal-collection'); view.result.current.checkIn('sf:ocean-beach'); });
  view.rerender({ owner: 'two' });
  assert.deepEqual(view.result.current.progress.stamps, {});
  view.rerender({ owner: 'one' });
  assert.equal(view.result.current.nextKey, 'peninsula:half-moon-bay');
  assert.equal(view.result.current.progress.stamps['bay-postcard'], undefined);
  view.rerender({ owner: undefined });
  assert.equal(view.result.current.nextKey, 'east-bay:jack-london');
  assert.notEqual(bayAdventuresKey(), bayAdventuresKey('guest'));
  assert.equal(parseBayAdventures(window.localStorage.getItem(bayAdventuresKey('one'))).stamps['coastal-collection'].length, 1);
});

test('unavailable storage keeps the adventure usable and explicitly reports session-only progress', () => {
  const prototype = Object.getPrototypeOf(window.localStorage), original = prototype.setItem;
  prototype.setItem = () => { throw new Error('storage blocked'); };
  try {
    const view = renderHook(() => useBayAdventures('blocked'));
    assert.equal(view.result.current.persistent, false);
    act(() => { view.result.current.accept('bay-postcard'); view.result.current.checkIn('sf:ferry'); });
    assert.equal(view.result.current.nextKey, 'east-bay:jack-london');
  } finally { prototype.setItem = original; }
});

test('a child arrival in the owner-change commit survives hydration without leaking between accounts', () => {
  function Arrival({ accept, checkIn }: Pick<ReturnType<typeof useBayAdventures>, 'accept' | 'checkIn'>) {
    useEffect(() => { accept('bay-postcard'); checkIn('sf:ferry'); }, [accept, checkIn]);
    return null;
  }
  function Harness({ owner }: { owner: string }) {
    const adventure = useBayAdventures(owner);
    return <><Arrival accept={adventure.accept} checkIn={adventure.checkIn} /><output>{adventure.nextKey}</output></>;
  }
  const view = render(<Harness owner="first" />);
  assert.equal(view.getByRole('status').textContent, 'east-bay:jack-london');
  view.rerender(<Harness owner="second" />);
  assert.equal(view.getByRole('status').textContent, 'east-bay:jack-london');
  for (const owner of ['first', 'second']) assert.equal(parseBayAdventures(window.localStorage.getItem(bayAdventuresKey(owner))).stamps['bay-postcard'].length, 1);
});

test('journal gates the collect button on actual proximity, offers navigation and restores focus', () => {
  const trigger = document.createElement('button'); trigger.textContent = 'Open journal'; document.body.append(trigger); trigger.focus();
  const routes: string[] = []; let closed = 0;
  function Harness({ nearKey }: { nearKey: string | null }) {
    const adventure = useBayAdventures();
    return <BayAdventureJournal locale="en" adventure={adventure} nearKey={nearKey} onNavigate={key => routes.push(key)} onClose={() => { closed++; }} />;
  }
  const view = render(<Harness nearKey={null} />);
  const close = view.getByRole('button', { name: 'Close travel adventures' });
  assert.equal(document.activeElement, close);
  assert.equal(view.getByRole('dialog').getAttribute('aria-modal'), 'true');
  fireEvent.click(view.getAllByRole('button', { name: 'Start trail' })[0]);
  assert.equal((view.getByRole('button', { name: 'Write the postcard' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('button', { name: 'Route to the next stop' }));
  assert.deepEqual(routes, ['sf:ferry']);
  assert.deepEqual(parseBayAdventures(window.localStorage.getItem(bayAdventuresKey())).stamps, {});
  view.rerender(<Harness nearKey="east-bay:jack-london" />);
  assert.equal((view.getByRole('button', { name: 'Write the postcard' }) as HTMLButtonElement).disabled, true);
  view.rerender(<Harness nearKey="sf:ferry" />);
  fireEvent.click(view.getByRole('button', { name: 'Write the postcard' }));
  assert.ok(view.getByText('BAYBAY writes: a wide bay, a little hello.'));
  assert.equal(document.activeElement, view.getByRole('heading', { name: 'A postcard across the Bay' }));
  assert.equal((view.getByRole('button', { name: 'Add the harbor postmark' }) as HTMLButtonElement).disabled, true);
  const last = view.getAllByRole('button').at(-1)!;
  close.focus(); fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); assert.equal(document.activeElement, last);
  fireEvent.keyDown(last, { key: 'Tab' }); assert.equal(document.activeElement, close);
  fireEvent.keyDown(close, { key: 'Escape' }); assert.equal(closed, 2);
  view.unmount(); assert.equal(document.activeElement, trigger); trigger.remove();
});

test('the final arrival awards one keepsake badge and retains every collected memory on reopen', () => {
  let progress = acceptBayAdventure(emptyBayAdventures(), 'bay-postcard');
  progress = checkInBayAdventure(progress, 'sf:ferry');
  progress = checkInBayAdventure(progress, 'east-bay:jack-london');
  window.localStorage.setItem(bayAdventuresKey(), JSON.stringify(progress));
  function Harness() { return <BayAdventureJournal locale="en" adventure={useBayAdventures()} nearKey="east-bay:berkeley" onNavigate={() => {}} onClose={() => {}} />; }
  const view = render(<Harness />);
  fireEvent.click(view.getByRole('button', { name: 'Deliver the postcard' }));
  assert.ok(view.getByText('TRAIL COMPLETE'));
  assert.equal(view.queryByRole('button', { name: 'Deliver the postcard' }), null);
  assert.equal(view.container.querySelector('.bay-adventure-badges b')?.textContent, '1');
  for (const step of BAY_ADVENTURES[0].steps) assert.ok(view.getByText(step.memory.en));
  view.unmount();
  const reopened = render(<Harness />);
  assert.equal(reopened.container.querySelector('.bay-adventure-badges b')?.textContent, '1');
  assert.ok(reopened.getByText('TRAIL COMPLETE'));
});
