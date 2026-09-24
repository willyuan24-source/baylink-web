import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { ATTRACTIONS } from '../src/data/attractions';
import { EMPTY_LIBRARY, type Library, type SavedPlan, type Stop } from '../src/lib/planner';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { renderHook, cleanup, act } = await import('@testing-library/react');
const { api } = await import('../src/lib/api');
const { GUEST_PLANNER_KEY, loadGuestLibrary, usePlannerLibrary } = await import('../src/lib/planner-library');
const originalRequest = api.request;
const copy = <T,>(value: T): T => structuredClone(value);
const defer = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const session = (id?: string) => id ? localStorage.setItem('currentUser', JSON.stringify({ id, token: `${id}-test-token` })) : localStorage.removeItem('currentUser');
const stop: Stop = { kind: 'event', id: MONTHLY_EVENTS[0].id };
const plan: SavedPlan = { id: 'saved-plan', title: '周末计划', date: MONTHLY_EVENTS[0].startDate, stops: [stop], version: 1, createdAt: '2026-09-23T19:00:00Z', updatedAt: '2026-09-23T19:00:00Z' };
const input = { title: plan.title, date: plan.date, stops: plan.stops };
const library = (plans: SavedPlan[] = []): Library => ({ ...copy(EMPTY_LIBRARY), plans: copy(plans) });

afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); });

test('corrupt guest JSON and malformed root collections recover to empty, independent defaults', () => {
  for (const raw of ['{broken', 'null', '[]', '"hello"', '{"plans":{},"favorites":[]}', '{"plans":[],"favorites":false}']) {
    localStorage.setItem(GUEST_PLANNER_KEY, raw);
    assert.deepEqual(loadGuestLibrary(), EMPTY_LIBRARY);
  }
  const first = loadGuestLibrary(); first.preferences.regions.push('sf');
  assert.deepEqual(loadGuestLibrary().preferences.regions, []);
});

test('damaged guest preferences, impossible dates and empty invalid stops cannot break the restored planner', () => {
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({
    preferences: { regions: { polluted: true }, interests: null, travelMode: { $ne: '' } },
    favorites: [null, {}, { kind: 'javascript', id: 'alert(1)' }],
    plans: [null, { ...plan, date: '2026-02-30' }, { ...plan, id: 'invalid-stop', stops: [{ kind: 'event', id: 'not-published' }] }, plan],
  }));
  const restored = loadGuestLibrary();
  assert.deepEqual(restored.preferences, EMPTY_LIBRARY.preferences);
  assert.deepEqual(restored.favorites, []);
  assert.deepEqual(restored.plans.map(row => row.id), [plan.id]);
});

test('guest saves remain local and storage failure is never reported as a successful save', async () => {
  api.request = async () => { throw new Error('Guests must not call an account API'); };
  const { result } = renderHook(() => usePlannerLibrary());
  await act(async () => {});
  await act(async () => { await result.current.savePlan(input); });
  assert.equal(result.current.data.plans.length, 1);
  assert.equal(loadGuestLibrary().plans.length, 1);
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, 'setItem')!;
  Object.defineProperty(dom.window.Storage.prototype, 'setItem', { configurable: true, value: () => { throw new Error('quota'); } });
  let saved: SavedPlan | undefined;
  try { await act(async () => { saved = await result.current.savePlan({ ...input, title: 'not stored' }); }); }
  finally { Object.defineProperty(dom.window.Storage.prototype, 'setItem', descriptor); }
  assert.equal(saved, undefined);
  assert.match(result.current.error, /quota/);
  assert.equal(result.current.data.plans.length, 1);
  assert.equal(loadGuestLibrary().plans.length, 1);
});

test('same-frame repeated saves share the synchronous write lock and make one request', async () => {
  session('alice');
  const pending = defer<{ plan: SavedPlan }>(); let writes = 0;
  api.request = async (_path, options) => { if (options?.method === 'POST') { writes++; return pending.promise; } return library(); };
  const { result } = renderHook(() => usePlannerLibrary('alice'));
  await act(async () => {});
  let first!: Promise<SavedPlan | undefined>; let second!: Promise<SavedPlan | undefined>;
  await act(async () => {
    first = result.current.savePlan(input);
    second = result.current.savePlan(input);
    pending.resolve({ plan });
    await Promise.all([first, second]);
  });
  assert.equal(writes, 1);
  assert.equal(await second, undefined);
  assert.equal(result.current.data.plans.length, 1);
  assert.equal(localStorage.getItem(GUEST_PLANNER_KEY), null, 'private signed-in plans are not cached into shared guest storage');
});

test('a late response from another account cannot populate the current account or guest data', async () => {
  session('alice'); const old = defer<Library>(); let reads = 0;
  api.request = async () => ++reads === 1 ? old.promise : library([{ ...plan, id: 'bob-plan', title: 'Bob only' }]);
  const { result, rerender } = renderHook(({ id }: { id?: string }) => usePlannerLibrary(id), { initialProps: { id: 'alice' } });
  session('bob'); rerender({ id: 'bob' });
  await act(async () => {});
  assert.deepEqual(result.current.data.plans.map(row => row.id), ['bob-plan']);
  await act(async () => { old.resolve(library([plan])); });
  assert.deepEqual(result.current.data.plans.map(row => row.id), ['bob-plan']);
  session(); rerender({ id: undefined });
  await act(async () => {});
  assert.deepEqual(result.current.data.plans, []);
  assert.equal(localStorage.getItem(GUEST_PLANNER_KEY), null);
});

test('stale action closures cannot write through a newly switched account token', async () => {
  session('alice'); let writes = 0;
  api.request = async (_path, options) => { if (options?.method) { writes++; return { plan }; } return library(); };
  const { result, rerender } = renderHook(({ id }: { id: string }) => usePlannerLibrary(id), { initialProps: { id: 'alice' } });
  await act(async () => {});
  const oldSave = result.current.savePlan;
  session('bob');
  await act(async () => { await oldSave(input); });
  assert.equal(writes, 0, 'storage/session changes are checked before using a new token');
  rerender({ id: 'bob' }); await act(async () => {});
  await act(async () => { await oldSave(input); });
  assert.equal(writes, 0, 'a previous owner closure remains invalid after rerender');
});

test('409 update and delete preserve the known plan and show a refresh instruction', async () => {
  session('alice'); const bodies: unknown[] = [];
  api.request = async (_path, options) => {
    if (options?.method) { bodies.push(JSON.parse(String(options.body))); throw { status: 409, error: 'stale version' }; }
    return library([plan]);
  };
  const { result } = renderHook(() => usePlannerLibrary('alice'));
  await act(async () => {});
  await act(async () => { await result.current.savePlan({ ...input, title: 'Unconfirmed change' }, plan); });
  assert.deepEqual(result.current.data.plans, [plan]);
  assert.match(result.current.error, /刷新/);
  assert.equal((bodies[0] as { version: number }).version, 1);
  await act(async () => { await result.current.deletePlan(plan); });
  assert.deepEqual(result.current.data.plans, [plan]);
  assert.deepEqual(bodies[1], { version: 1 });
});

test('guest drafts require explicit import and partial failure retains drafts for a deduplicated retry', async () => {
  session('alice');
  const guest = { ...library([plan]), favorites: [{ kind: 'place' as const, id: ATTRACTIONS[0].id }] };
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify(guest));
  const remote = library(); let planWrites = 0; let failFavorite = true;
  api.request = async (path, options) => {
    if (!options?.method) return copy(remote);
    if (path === '/planner/plans') { planWrites++; const created = { ...plan, id: 'imported-plan' }; remote.plans.push(created); return { plan: created }; }
    if (path.startsWith('/planner/favorites/')) {
      if (failFavorite) throw { status: 503, error: 'temporarily unavailable' };
      remote.favorites = copy(guest.favorites); return { favorites: copy(remote.favorites) };
    }
    throw new Error('Unexpected route');
  };
  const { result } = renderHook(() => usePlannerLibrary('alice'));
  await act(async () => {});
  assert.equal(planWrites, 0);
  assert.equal(result.current.guestCount, 2);
  assert.deepEqual(result.current.data.plans, []);
  await act(async () => { await result.current.importGuest(); });
  assert.equal(planWrites, 1);
  assert.notEqual(localStorage.getItem(GUEST_PLANNER_KEY), null);
  failFavorite = false;
  await act(async () => { await result.current.importGuest(); });
  assert.equal(planWrites, 1);
  assert.equal(localStorage.getItem(GUEST_PLANNER_KEY), null);
  assert.equal(result.current.data.plans[0].id, 'imported-plan');
  assert.equal(result.current.data.favorites.length, 1);
});
