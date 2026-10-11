import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/my-week' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderHook, act, cleanup } = await import('@testing-library/react');
const { api } = await import('../src/lib/api');
const saves = await import('../src/lib/saves');
const { usePlannerLibrary, GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { savedPostsKey } = await import('../src/lib/savedPosts');
const { READER_LIBRARY_KEY } = await import('../src/lib/reader-library');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { savesKey, resetSaveStore, useSave, useSavedEntries, useSavedCount, importGuestSaves, loadPlannerAccount, pendingRetryDue, PENDING_RETRY_MS, PENDING_SLOW_AFTER_MS, PENDING_SLOW_RETRY_MS, READ_RETRY_AFTER_MS } = saves;

const session = (id?: string) => id ? localStorage.setItem('currentUser', JSON.stringify({ id, token: `${id}-test-token` })) : localStorage.removeItem('currentUser');
const ids = (entries: { kind: string; id: string }[]) => entries.map(entry => `${entry.kind}:${entry.id}`);
beforeEach(t => { t.mock.method(globalThis, 'fetch', async () => Response.json({})); });
afterEach(() => { cleanup(); localStorage.clear(); resetSaveStore(); });

test('the guest list absorbs the older planner and reader lists once and leaves them in place for an older build', async () => {
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ plans: [], preferences: {}, favorites: [{ kind: 'place', id: 'golden-gate' }, { kind: 'javascript', id: 'x' }, { kind: 'event', id: 'bad id!' }] }));
  localStorage.setItem(READER_LIBRARY_KEY, JSON.stringify({ saved: ['bay-area-roommate-guide', '../escape'], recent: ['private-history'] }));
  const { result } = renderHook(() => useSavedEntries(null));
  assert.deepEqual(ids(result.current.entries), ['place:golden-gate', 'guide:bay-area-roommate-guide']);
  assert.equal(result.current.count, 2);
  assert.ok(localStorage.getItem(GUEST_PLANNER_KEY)!.includes('golden-gate'), 'the older key is untouched');
  assert.ok(localStorage.getItem(READER_LIBRARY_KEY)!.includes('private-history'));
  await act(async () => { await result.current.remove(result.current.entries[0]); });
  resetSaveStore();
  const again = renderHook(() => useSavedEntries(null));
  assert.deepEqual(ids(again.result.current.entries), ['guide:bay-area-roommate-guide'], 'a removed item never comes back from the older list');
});

test('one list and one count: device saves, posts and every kind count once, and the count equals the rows', async () => {
  localStorage.setItem(savedPostsKey(), JSON.stringify([{ id: 'post-1', title: 'User text', city: 'SF', category: '租屋', budget: '', savedAt: 1 }]));
  const { result } = renderHook(() => ({ list: useSavedEntries(null), count: useSavedCount(null), offer: useSave('offer', 'sfmta-free-muni-seniors', { userId: null }), opening: useSave('opening', 'asia-live-valley-fair', { userId: null }) }));
  await act(async () => { await result.current.offer.toggle(); await result.current.opening.toggle(); await result.current.offer.toggle(); await result.current.offer.toggle(); });
  assert.deepEqual(ids(result.current.list.entries), ['offer:sfmta-free-muni-seniors', 'opening:asia-live-valley-fair', 'post:post-1']);
  assert.equal(result.current.count, result.current.list.entries.length);
  assert.equal(result.current.offer.saved, true);
});

test('signed-in lists: one shared /planner/me read, unknown kinds skipped, other accounts and the guest list kept apart', async t => {
  localStorage.setItem(savesKey(), JSON.stringify({ v: 1, items: [{ kind: 'guide', id: 'guest-only-guide', savedAt: 1 }] }));
  session('alice');
  let reads = 0;
  t.mock.method(api, 'request', async (path: string) => {
    assert.equal(path, '/planner/me'); reads++;
    return { ...structuredClone(EMPTY_LIBRARY), favorites: [{ kind: 'event', id: 'fleet-week' }, { kind: 'future-kind', id: 'x' }, { kind: 'offer', id: 'sephora-birthday' }] };
  });
  const { result } = renderHook(() => ({ library: usePlannerLibrary('alice'), list: useSavedEntries('alice'), count: useSavedCount('alice') }));
  assert.equal(result.current.count, null, 'unknown until the account is read');
  await act(async () => {});
  assert.equal(reads, 1, 'the planner library and the save store share one read');
  assert.deepEqual(ids(result.current.list.entries), ['offer:sephora-birthday', 'event:fleet-week']);
  assert.deepEqual(ids(result.current.library.data.favorites), ['offer:sephora-birthday', 'event:fleet-week']);
  assert.equal(result.current.count, 2);
  assert.equal(result.current.library.guestCount, 1, 'the guest list is offered for import, not mixed in');
  session('bob');
  const bob = renderHook(() => useSavedEntries('bob'));
  assert.deepEqual(bob.result.current.entries, [], 'another account never sees alice’s list');
});

test('a pending save is retried after the next account read and becomes an account save once accepted', async t => {
  session('alice');
  const now = Date.now();
  localStorage.setItem(savesKey('alice'), JSON.stringify({ v: 1, items: [{ kind: 'offer', id: 'new-offer', savedAt: now, triedAt: now }, { kind: 'opening', id: 'old-opening', savedAt: now - 60 * 60_000, triedAt: now - PENDING_RETRY_MS - 1 }] }));
  const puts: string[] = [];
  let accepted = false;
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (!options?.method) return { ...structuredClone(EMPTY_LIBRARY), favorites: accepted ? [{ kind: 'opening', id: 'old-opening' }] : [] };
    puts.push(path); accepted = true;
    return { favorites: [{ kind: 'opening', id: 'old-opening' }] };
  });
  const { result } = renderHook(() => useSavedEntries('alice'));
  await act(async () => { await loadPlannerAccount('alice'); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.deepEqual(puts, ['/planner/favorites/opening/old-opening'], 'only the item due for a retry is sent again');
  assert.deepEqual(result.current.entries.map(entry => `${entry.key}/${entry.source}`), ['offer:new-offer/pending', 'opening:old-opening/account']);
  assert.equal(result.current.count, 2);
});

test('importing guest saves moves account kinds, keeps posts on the device and parks unknown items as pending', async t => {
  localStorage.setItem(savesKey(), JSON.stringify({ v: 1, items: [{ kind: 'event', id: 'fleet-week', savedAt: 2 }, { kind: 'offer', id: 'not-synced-yet', savedAt: 1 }] }));
  localStorage.setItem(savedPostsKey(), JSON.stringify([{ id: 'guest-post', title: 'Guest post', city: '', category: '', budget: '', savedAt: 1 }]));
  session('alice');
  const account: { kind: string; id: string }[] = [];
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (!options?.method) return { ...structuredClone(EMPTY_LIBRARY), favorites: account };
    if (path.includes('not-synced-yet')) throw { status: 404, code: 'ITEM_NOT_IN_CATALOG' };
    account.push({ kind: 'event', id: 'fleet-week' });
    return { favorites: account };
  });
  await act(async () => { await loadPlannerAccount('alice'); await importGuestSaves('alice'); });
  assert.deepEqual(JSON.parse(localStorage.getItem(savesKey())!).items, []);
  assert.deepEqual(JSON.parse(localStorage.getItem(savesKey('alice'))!).items.map((item: { id: string }) => item.id), ['not-synced-yet']);
  const { result } = renderHook(() => useSavedEntries('alice'));
  assert.deepEqual(ids(result.current.entries), ['offer:not-synced-yet', 'event:fleet-week']);
  assert.ok(localStorage.getItem(savedPostsKey())!.includes('guest-post'), 'posts never move to the server');
});

test('a browser that refuses storage keeps the save for this visit and says so', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, 'setItem')!;
  const { result } = renderHook(() => useSave('guide', 'bay-area-roommate-guide', { userId: null }));
  Object.defineProperty(dom.window.Storage.prototype, 'setItem', { configurable: true, value: () => { throw new Error('quota'); } });
  let outcome: Awaited<ReturnType<typeof result.current.toggle>>;
  try { await act(async () => { outcome = await result.current.toggle(); }); }
  finally { Object.defineProperty(dom.window.Storage.prototype, 'setItem', descriptor); }
  assert.deepEqual(outcome!, { saved: true, persisted: false });
  assert.equal(result.current.saved, true);
  assert.equal(result.current.persisted, false);
});

test('an opening saved on its card is the ♡ its detail page shows (saved there as a place): one key, one row, one count', async () => {
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ plans: [], preferences: {}, favorites: [{ kind: 'place', id: 'opening-older-shop' }] }));
  const { result } = renderHook(() => ({
    card: useSave('opening', 'new-shop', { userId: null }), detail: useSave('place', 'opening-new-shop', { userId: null }),
    list: useSavedEntries(null), count: useSavedCount(null),
  }));
  assert.deepEqual(ids(result.current.list.entries), ['opening:older-shop'], 'an older device save of the place is the opening');
  await act(async () => { await result.current.card.toggle(); });
  assert.equal(result.current.detail.saved, true, 'the detail page shows the card’s save');
  assert.deepEqual(ids(result.current.list.entries), ['opening:new-shop', 'opening:older-shop']);
  assert.equal(result.current.count, 2);
  await act(async () => { await result.current.detail.toggle(); });
  assert.equal(result.current.card.saved, false, 'removing it on the detail page removes the card’s save');
  await act(async () => { await result.current.detail.toggle(); });
  assert.deepEqual(JSON.parse(localStorage.getItem(savesKey())!).items.map((item: { kind: string; id: string }) => `${item.kind}:${item.id}`), ['opening:new-shop', 'opening:older-shop'],
    'a save from the detail page is stored as the opening');
  assert.equal(result.current.count, 2);
});

test('signed in: an opening the account holds as a place lists once, shows saved on the card, and un-saving deletes each stored form', async t => {
  session('alice');
  let favorites = [{ kind: 'place', id: 'opening-shop-a' }, { kind: 'event', id: 'fleet-week' }, { kind: 'place', id: 'opening-shop-b' }, { kind: 'opening', id: 'shop-b' }];
  const writes: string[] = [];
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (!options?.method) return { ...structuredClone(EMPTY_LIBRARY), favorites: structuredClone(favorites) };
    writes.push(`${options.method} ${path}`);
    const [kind, id] = path.split('/').slice(-2);
    favorites = options.method === 'PUT' ? [...favorites, { kind, id }] : favorites.filter(item => item.kind !== kind || item.id !== id);
    return { favorites: structuredClone(favorites) };
  });
  const { result } = renderHook(() => ({
    a: useSave('opening', 'shop-a', { userId: 'alice' }), aDetail: useSave('place', 'opening-shop-a', { userId: 'alice' }),
    b: useSave('opening', 'shop-b', { userId: 'alice' }), list: useSavedEntries('alice'), count: useSavedCount('alice'),
  }));
  await act(async () => {});
  assert.equal(result.current.a.saved, true);
  assert.deepEqual(ids(result.current.list.entries), ['opening:shop-b', 'event:fleet-week', 'opening:shop-a'], 'two stored forms of shop-b are one row');
  assert.equal(result.current.count, 3);
  await act(async () => { await result.current.a.toggle(); await result.current.b.toggle(); });
  assert.deepEqual(writes, ['DELETE /planner/favorites/place/opening-shop-a', 'DELETE /planner/favorites/place/opening-shop-b', 'DELETE /planner/favorites/opening/shop-b']);
  assert.equal(result.current.aDetail.saved, false);
  assert.deepEqual(ids(result.current.list.entries), ['event:fleet-week']);
  await act(async () => { await result.current.aDetail.toggle(); });
  assert.equal(writes.at(-1), 'PUT /planner/favorites/opening/shop-a', 'a new save is written as the opening');
  assert.equal(result.current.a.saved, true);
  assert.equal(result.current.count, 2);
});

test('signed in: quick saves of two items keep both, whatever lands first; writes go one at a time', async t => {
  session('alice');
  let favorites: { kind: string; id: string }[] = [];
  const sent: string[] = [];
  let release!: () => void;
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (!options?.method) return { ...structuredClone(EMPTY_LIBRARY), favorites: structuredClone(favorites) };
    sent.push(path);
    const [kind, id] = path.split('/').slice(-2);
    favorites = [...favorites, { kind, id }];
    const answer = { favorites: structuredClone(favorites) };
    if (sent.length === 1) await new Promise<void>(resolve => { release = resolve; });
    return answer;
  });
  const { result } = renderHook(() => ({ a: useSave('offer', 'offer-a', { userId: 'alice' }), b: useSave('offer', 'offer-b', { userId: 'alice' }), list: useSavedEntries('alice') }));
  await act(async () => {});
  let pending: Promise<unknown>[] = [];
  await act(async () => { pending = [result.current.a.toggle(), result.current.b.toggle()]; await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.deepEqual(sent, ['/planner/favorites/offer/offer-a'], 'the second write waits for the first answer');
  assert.equal(result.current.a.saved, true); assert.equal(result.current.b.saved, true);
  // A read that lands meanwhile (the tab regained focus) still shows both.
  await act(async () => { await loadPlannerAccount('alice'); });
  assert.deepEqual(ids(result.current.list.entries).sort(), ['offer:offer-a', 'offer:offer-b']);
  await act(async () => { release(); await Promise.all(pending); });
  assert.deepEqual(sent, ['/planner/favorites/offer/offer-a', '/planner/favorites/offer/offer-b']);
  assert.deepEqual(ids(result.current.list.entries).sort(), ['offer:offer-a', 'offer:offer-b']);
});

test('signed in: a read that started before a save answered does not put the older list back', async t => {
  session('alice');
  let favorites: { kind: string; id: string }[] = [];
  let hold = false, answerRead = () => {};
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (!options?.method) {
      const answer = { ...structuredClone(EMPTY_LIBRARY), favorites: structuredClone(favorites) };
      return hold ? new Promise(resolve => { answerRead = () => resolve(answer); }) : answer;
    }
    favorites = [...favorites, { kind: 'offer', id: 'offer-c' }];
    return { favorites: structuredClone(favorites) };
  });
  const { result } = renderHook(() => ({ c: useSave('offer', 'offer-c', { userId: 'alice' }), list: useSavedEntries('alice') }));
  await act(async () => {});
  hold = true;
  let read!: Promise<unknown>;
  await act(async () => { read = loadPlannerAccount('alice'); await new Promise(resolve => setTimeout(resolve, 0)); });
  await act(async () => { await result.current.c.toggle(); });
  await act(async () => { answerRead(); await read; });
  assert.equal(result.current.c.saved, true, 'the older list (without the save) is not shown');
  assert.deepEqual(ids(result.current.list.entries), ['offer:offer-c']);
});

test('RC-15 retries: every 15 min in the first week, then once a day, and never once the item has left the web catalog', () => {
  const at = Date.parse('2026-10-11T12:00:00Z');
  const fresh = { savedAt: at - 60 * 60_000 }, old = { savedAt: at - PENDING_SLOW_AFTER_MS - 1 };
  assert.equal(pendingRetryDue({ ...fresh }, at), true, 'never tried');
  assert.equal(pendingRetryDue({ ...fresh, triedAt: at - PENDING_RETRY_MS + 1 }, at), false);
  assert.equal(pendingRetryDue({ ...fresh, triedAt: at - PENDING_RETRY_MS }, at), true);
  assert.equal(pendingRetryDue({ ...old, triedAt: at - PENDING_RETRY_MS }, at), false, 'a week on, at most once a day');
  assert.equal(pendingRetryDue({ ...old, triedAt: at - PENDING_SLOW_RETRY_MS }, at), true);
  assert.equal(pendingRetryDue({ ...fresh, retired: true }, at), false);
});

test('a pending save whose item left the web catalog is not sent again; back in the catalog, it is', async t => {
  session('alice');
  const now = Date.now();
  localStorage.setItem(savesKey('alice'), JSON.stringify({ v: 1, items: [{ kind: 'offer', id: 'gone-offer', savedAt: now - 60_000 }, { kind: 'offer', id: 'live-offer', savedAt: now - 60_000 }] }));
  const puts: string[] = [];
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (!options?.method) return structuredClone(EMPTY_LIBRARY);
    puts.push(path);
    throw { status: 404, code: 'ITEM_NOT_IN_CATALOG' };
  });
  const { result } = renderHook(() => useSavedEntries('alice'));
  act(() => { result.current.retirePending(new Set(['offer:gone-offer'])); });
  const stored = () => JSON.parse(localStorage.getItem(savesKey('alice'))!).items as { id: string; retired?: boolean; triedAt?: number }[];
  assert.deepEqual(stored().map(item => [item.id, !!item.retired]), [['gone-offer', true], ['live-offer', false]], 'the mark is kept with the device save');
  await act(async () => { await loadPlannerAccount('alice'); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.deepEqual(puts, ['/planner/favorites/offer/live-offer'], 'only the item still in the catalog is retried');
  assert.equal(result.current.count, 2, 'a retired save stays listed (and counted) until the reader removes it');
  // The same offer is published again: the next retry sends it.
  act(() => { result.current.retirePending(new Set()); });
  assert.deepEqual(stored().map(item => [item.id, !!item.retired]), [['gone-offer', false], ['live-offer', false]]);
  await act(async () => { await loadPlannerAccount('alice'); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.deepEqual(puts, ['/planner/favorites/offer/live-offer', '/planner/favorites/offer/gone-offer'], 'live-offer waits 15 min; gone-offer was never tried');
});

test('a failed first account read is tried again when the browser is back online, and on focus at most every 15 s', async t => {
  session('alice');
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-11T12:00:00Z') });
  let reads = 0, fail = true;
  t.mock.method(api, 'request', async () => {
    reads++;
    if (fail) throw { status: 503 };
    return { ...structuredClone(EMPTY_LIBRARY), favorites: [{ kind: 'offer', id: 'kept-offer' }] };
  });
  const { result } = renderHook(() => ({ list: useSavedEntries('alice'), heart: useSave('offer', 'kept-offer', { userId: 'alice' }) }));
  await act(async () => {});
  assert.equal(reads, 1); assert.equal(result.current.list.status, 'error'); assert.equal(result.current.heart.saved, null);
  await act(async () => { window.dispatchEvent(new window.Event('focus')); });
  assert.equal(reads, 1, 'focus right after the failure does not read again');
  t.mock.timers.tick(READ_RETRY_AFTER_MS);
  await act(async () => { window.dispatchEvent(new window.Event('focus')); });
  assert.equal(reads, 2, 'focus 15 s later reads again'); assert.equal(result.current.list.status, 'error');
  fail = false;
  await act(async () => { window.dispatchEvent(new window.Event('online')); });
  assert.equal(reads, 3, 'back online reads at once');
  assert.equal(result.current.list.status, 'ready'); assert.equal(result.current.heart.saved, true);
  await act(async () => { window.dispatchEvent(new window.Event('online')); window.dispatchEvent(new window.Event('focus')); });
  assert.equal(reads, 3, 'a confirmed list is not read again within the minute');
});
