import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { useEffect } from 'react';
import { JSDOM } from 'jsdom';
import { BAY_DISCOVERIES, bayDiscoveriesKey, canCollectDiscovery, collectBayDiscovery, emptyBayDiscoveries, parseBayDiscoveries, type BayDiscoveryContext } from '../src/features/little-bay/bay-discoveries';
import { bayCanMove, baySpawn, getUnifiedPlace } from '../src/features/little-bay/unified-bay-world';
import { routeBay } from '../src/features/little-bay/unified-bay-routing';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderHook, render, act, cleanup, fireEvent } = await import('@testing-library/react');
const { useBayDiscoveries } = await import('../src/features/little-bay/useBayDiscoveries');
const { default: BayDiscoveryPanel } = await import('../src/features/little-bay/BayDiscoveryPanel');
afterEach(() => { cleanup(); window.localStorage.clear(); });
const contextAt = (index = 0): BayDiscoveryContext => ({ position: BAY_DISCOVERIES[index].position, mode: 'walk', arrived: true });
const first = BAY_DISCOVERIES[0], lights = BAY_DISCOVERIES.find(item => item.kind === 'lights')!;
const lightsContext: BayDiscoveryContext = { position: lights.position, mode: 'drive', arrived: true };

test('all nine bilingual discoveries use distinct reachable entrances across the four regions', () => {
  assert.equal(BAY_DISCOVERIES.length, 9);
  assert.equal(new Set(BAY_DISCOVERIES.map(item => item.id)).size, 9);
  assert.equal(new Set(BAY_DISCOVERIES.map(item => getUnifiedPlace(item.placeKey)!.region)).size, 4);
  const start = baySpawn('sf:park');
  for (const item of BAY_DISCOVERIES) {
    const place = getUnifiedPlace(item.placeKey)!;
    assert.ok(place, item.placeKey);
    assert.ok(bayCanMove(...item.position), item.id);
    assert.ok(Math.hypot(...[item.position[0] - place.position[0], item.position[1] - place.position[1]]) > .1, `${item.id} must not be at model center`);
    const route = routeBay([start.x, start.z], item.placeKey);
    assert.equal(route.available, true, item.id);
    const finish = route.points.at(-1)!;
    assert.ok(Math.hypot(finish[0] - item.position[0], finish[1] - item.position[1]) <= item.radius, `${item.id} route must finish in interaction radius`);
    for (const other of BAY_DISCOVERIES) if (other !== item) assert.ok(Math.hypot(other.position[0] - item.position[0], other.position[1] - item.position[1]) > item.radius + other.radius, `${item.id} overlaps ${other.id}`);
    assert.ok(item.title.en && item.title.zh && item.teaser.en && item.teaser.zh);
    for (const choice of item.options) assert.ok(choice.label.en && choice.label.zh && choice.reply.en && choice.reply.zh && choice.memory.en && choice.memory.zh);
  }
});

test('map preview, teleport without movement, invalid position and remote selection cannot collect', () => {
  const empty = emptyBayDiscoveries(), valid = contextAt();
  for (const context of [
    { ...valid, mode: 'overview' as const }, { ...valid, arrived: false },
    { ...valid, position: [first.position[0] + first.radius + .001, first.position[1]] as const },
    { ...valid, position: [NaN, first.position[1]] as const }, { ...valid, position: [Infinity, 0] as const },
  ]) {
    assert.equal(canCollectDiscovery(first, context), false);
    assert.equal(collectBayDiscovery(empty, first.id, first.options[0].id, context), empty);
  }
  assert.equal(collectBayDiscovery(empty, '__proto__', 'sleep', valid), empty);
  assert.equal(collectBayDiscovery(empty, first.id, 'not-a-choice', valid), empty);
  assert.equal(collectBayDiscovery(empty, first.id, first.options[0].id, valid, new Date('bad')), empty);
  const saved = collectBayDiscovery(empty, first.id, first.options[0].id, valid, new Date('2026-09-25T12:00:00Z'));
  assert.deepEqual(saved.memories[first.id], { choiceId: first.options[0].id, collectedAt: '2026-09-25T12:00:00.000Z' });
  assert.equal(collectBayDiscovery(saved, first.id, first.options[1].id, valid), saved);
  assert.deepEqual(empty.memories, {});
});

test('light award requires the exact complete proof, correct final choice and physical arrival', () => {
  const empty = emptyBayDiscoveries();
  for (const proof of [undefined, [], ['wave'], ['wave', 'leaf'], ['sun', 'leaf', 'wave'], ['wave', 'leaf', 'sun', 'sun']]) {
    assert.equal(collectBayDiscovery(empty, lights.id, 'sun', { ...lightsContext, proof }), empty);
  }
  assert.equal(collectBayDiscovery(empty, lights.id, 'leaf', { ...lightsContext, proof: lights.sequence }), empty);
  assert.equal(collectBayDiscovery(empty, lights.id, 'sun', { ...lightsContext, arrived: false, proof: lights.sequence }), empty);
  const saved = collectBayDiscovery(empty, lights.id, 'sun', { ...lightsContext, proof: lights.sequence });
  assert.equal(saved.memories[lights.id].choiceId, 'sun');
});

test('corrupt and unknown saves are discarded with allowlisted choices, dates and version', () => {
  const good = { choiceId: first.options[0].id, collectedAt: '2026-09-25T12:00:00Z' };
  const parsed = parseBayDiscoveries(JSON.stringify({ version: 1, memories: { [first.id]: good, [BAY_DISCOVERIES[1].id]: { ...good, choiceId: 'made-up' }, [BAY_DISCOVERIES[2].id]: { ...good, collectedAt: 'bad' }, [lights.id]: { ...good, choiceId: 'wave' }, invented: good, constructor: good } }));
  assert.deepEqual(Object.keys(parsed.memories), [first.id]);
  assert.equal(parsed.memories[first.id].collectedAt, '2026-09-25T12:00:00.000Z');
  for (const raw of ['{', 'null', '[]', '{"version":2,"memories":{}}', '{"version":1,"memories":[]}', 'x'.repeat(12_001)]) assert.deepEqual(parseBayDiscoveries(raw), emptyBayDiscoveries());
});

test('hook isolates guest and account saves and rejects bypassing the puzzle', () => {
  const view = renderHook(({ owner }: { owner?: string }) => useBayDiscoveries(owner), { initialProps: { owner: undefined } });
  act(() => { view.result.current.collect(first.id, first.options[0].id, contextAt()); view.result.current.collect(lights.id, 'sun', lightsContext); });
  assert.equal(Object.keys(view.result.current.progress.memories).length, 1);
  view.rerender({ owner: 'first' }); assert.deepEqual(view.result.current.progress.memories, {});
  act(() => view.result.current.collect(lights.id, 'sun', { ...lightsContext, proof: lights.sequence }));
  view.rerender({ owner: 'second' }); assert.deepEqual(view.result.current.progress.memories, {});
  view.rerender({ owner: 'first' }); assert.deepEqual(Object.keys(view.result.current.progress.memories), [lights.id]);
  view.rerender({ owner: undefined }); assert.deepEqual(Object.keys(view.result.current.progress.memories), [first.id]);
  assert.notEqual(bayDiscoveriesKey(), bayDiscoveriesKey('guest'));
});

test('owner-change hydration cannot erase a child-effect collection or leak another account', () => {
  function Child({ collect }: Pick<ReturnType<typeof useBayDiscoveries>, 'collect'>) {
    useEffect(() => { collect(first.id, first.options[0].id, contextAt()); }, [collect]); return null;
  }
  function Harness({ owner }: { owner: string }) {
    const discovery = useBayDiscoveries(owner);
    return <><Child collect={discovery.collect}/><output>{Object.keys(discovery.progress.memories).length}</output></>;
  }
  const view = render(<Harness owner="one"/>);
  view.rerender(<Harness owner="two"/>);
  assert.equal(view.getByRole('status').textContent, '1');
  for (const owner of ['one', 'two']) assert.deepEqual(Object.keys(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey(owner))).memories), [first.id]);
});

test('storage failures retain session progress and tell the panel it is temporary', () => {
  const prototype = Object.getPrototypeOf(window.localStorage), original = prototype.setItem;
  prototype.setItem = () => { throw new Error('blocked'); };
  try {
    function Harness() { return <BayDiscoveryPanel discoveryId={first.id} locale="en" discovery={useBayDiscoveries('blocked')} context={contextAt()} onNavigate={() => {}} onClose={() => {}}/>; }
    const view = render(<Harness/>);
    assert.ok(view.getByText(/Storage is unavailable/));
    fireEvent.click(view.getByRole('button', { name: first.options[0].label.en }));
    fireEvent.click(view.getByRole('button', { name: 'Keep this little memory' }));
    assert.ok(view.getByText('KEPT IN YOUR FIELD NOTES'));
  } finally { prototype.setItem = original; }
});

test('remote panel offers a route, never an award; close, escape and keyboard focus are contained', () => {
  const trigger = document.createElement('button'); trigger.textContent = 'Discover'; document.body.append(trigger); trigger.focus();
  const routes: string[] = []; let closes = 0;
  function Harness() { return <BayDiscoveryPanel discoveryId={first.id} locale="en" discovery={useBayDiscoveries()} context={{ ...contextAt(), arrived: false }} onNavigate={key => routes.push(key)} onClose={() => { closes++; }}/>; }
  const view = render(<Harness/>), close = view.getByRole('button', { name: 'Close discovery' }), route = view.getByRole('button', { name: 'Take me there' });
  assert.equal(document.activeElement, close);
  assert.equal(view.queryByRole('button', { name: first.options[0].label.en }), null);
  assert.equal(view.getByRole('dialog').getAttribute('aria-modal'), 'true');
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); assert.equal(document.activeElement, route);
  fireEvent.keyDown(route, { key: 'Tab' }); assert.equal(document.activeElement, close);
  fireEvent.click(route); assert.deepEqual(routes, [first.placeKey]);
  assert.deepEqual(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())).memories, {});
  fireEvent.keyDown(close, { key: 'Escape' }); assert.equal(closes, 2);
  view.unmount(); assert.equal(document.activeElement, trigger); trigger.remove();
});

test('observations show choice-specific feedback, require a deliberate save, and retain the original keepsake', () => {
  function Harness({ context }: { context: BayDiscoveryContext }) { return <BayDiscoveryPanel discoveryId={first.id} locale="en" discovery={useBayDiscoveries()} context={context} onNavigate={() => {}} onClose={() => {}}/>; }
  const view = render(<Harness context={contextAt()}/>);
  fireEvent.click(view.getByRole('button', { name: first.options[0].label.en }));
  assert.ok(view.getByText(first.options[0].reply.en));
  assert.deepEqual(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())).memories, {});
  view.rerender(<Harness context={{ ...contextAt(), mode: 'overview' }}/>);
  assert.equal(view.queryByRole('button', { name: 'Keep this little memory' }), null);
  view.rerender(<Harness context={contextAt()}/>);
  fireEvent.click(view.getByRole('button', { name: 'Keep this little memory' }));
  assert.ok(view.getByText(first.options[0].memory.en));
  const collectedAt = parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())).memories[first.id].collectedAt;
  fireEvent.click(view.getByRole('button', { name: first.options[1].label.en }));
  assert.ok(view.getByText(first.options[1].reply.en));
  assert.ok(view.getByText(first.options[0].memory.en));
  assert.equal(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())).memories[first.id].collectedAt, collectedAt);
});

test('light challenge resets on mistakes, awards only after three correct clicks, and can be replayed', () => {
  function Harness() { return <BayDiscoveryPanel discoveryId={lights.id} locale="en" discovery={useBayDiscoveries()} context={lightsContext} onNavigate={() => {}} onClose={() => {}}/>; }
  const view = render(<Harness/>);
  fireEvent.click(view.getByRole('button', { name: 'Light Wave' }));
  assert.ok(view.getByText('1 / 3 lamps lit'));
  fireEvent.click(view.getByRole('button', { name: 'Light Sun' }));
  assert.ok(view.getByText(/order got tangled/));
  assert.equal(view.container.querySelectorAll('.bay-light-buttons .is-lit').length, 0);
  for (const label of ['Wave', 'Leaf']) fireEvent.click(view.getByRole('button', { name: `Light ${label}` }));
  assert.deepEqual(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())).memories, {});
  fireEvent.click(view.getByRole('button', { name: 'Light Sun' }));
  assert.ok(view.getByText('KEPT IN YOUR FIELD NOTES'));
  const saved = parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey()));
  assert.equal(saved.memories[lights.id].choiceId, 'sun');
  fireEvent.click(view.getByRole('button', { name: 'Play again' }));
  assert.ok(view.getByText('0 / 3 lamps lit'));
  for (const label of ['Wave', 'Leaf', 'Sun']) fireEvent.click(view.getByRole('button', { name: `Light ${label}` }));
  assert.deepEqual(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())), saved);
  view.unmount(); const reopened = render(<Harness/>);
  assert.ok(reopened.getByText('KEPT IN YOUR FIELD NOTES'));
});

test('closing an unfinished puzzle and switching owners never grants an incomplete keepsake', () => {
  function Harness({ owner }: { owner: string }) { return <BayDiscoveryPanel key={owner} discoveryId={lights.id} locale="en" discovery={useBayDiscoveries(owner)} context={lightsContext} onNavigate={() => {}} onClose={() => {}}/>; }
  const view = render(<Harness owner="first"/>);
  fireEvent.click(view.getByRole('button', { name: 'Light Wave' }));
  fireEvent.click(view.getByRole('button', { name: 'Light Leaf' }));
  view.rerender(<Harness owner="second"/>);
  assert.ok(view.getByText('0 / 3 lamps lit'));
  fireEvent.click(view.getByRole('button', { name: 'Light Sun' }));
  assert.ok(view.getByText(/order got tangled/));
  for (const owner of ['first', 'second']) assert.deepEqual(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey(owner))).memories, {});
});

test('traditional Chinese applies to new stories and interaction controls without changing saved IDs', async () => {
  const { loadLocale, translateText } = await import('../src/i18n/locale');
  await loadLocale('zh-Hant');
  function Harness() { return <BayDiscoveryPanel discoveryId={first.id} locale="zh-Hant" discovery={useBayDiscoveries()} context={contextAt()} onNavigate={() => {}} onClose={() => {}}/>; }
  const view = render(<Harness/>);
  assert.ok(view.getByRole('button', { name: '關閉小發現' }));
  assert.ok(view.getByRole('heading', { name: translateText(first.title.zh, 'zh-Hant') }));
  fireEvent.click(view.getByRole('button', { name: translateText(first.options[0].label.zh, 'zh-Hant') }));
  fireEvent.click(view.getByRole('button', { name: '把這份回憶收好' }));
  assert.ok(view.getByText('已記入發現冊'));
  assert.equal(parseBayDiscoveries(window.localStorage.getItem(bayDiscoveriesKey())).memories[first.id].choiceId, first.options[0].id);
});
