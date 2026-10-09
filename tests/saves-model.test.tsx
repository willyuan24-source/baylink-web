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
const { savesKey, resetSaveStore, useSave, useSavedEntries, useSavedCount, importGuestSaves, loadPlannerAccount, PENDING_RETRY_MS } = saves;

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
  localStorage.setItem(savesKey('alice'), JSON.stringify({ v: 1, items: [{ kind: 'offer', id: 'new-offer', savedAt: now, triedAt: now }, { kind: 'opening', id: 'old-opening', savedAt: 1, triedAt: now - PENDING_RETRY_MS - 1 }] }));
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
