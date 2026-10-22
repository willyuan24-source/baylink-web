import assert from 'node:assert/strict';
import { test, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.baylink.us/my-week' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { UnifiedSavedItems } = await import('../src/components/UnifiedSavedItems');
const { READER_LIBRARY_KEY } = await import('../src/lib/reader-library');
const { savedPostsKey } = await import('../src/lib/savedPosts');
const { resetSaveStore, savesKey, useSavedCount } = await import('../src/lib/saves');
const { getGuideBySlug } = await import('../src/data/guides');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { currentFreebies } = await import('../src/data/october-offers');
const { currentOpenings } = await import('../src/data/local-discoveries');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { brandCase } = await import('../src/lib/event-facts');
const { setLocale } = await import('../src/i18n/locale');

const TODAY = '2026-10-09';
const guide = getGuideBySlug('bay-area-roommate-guide')!;
const event = MONTHLY_EVENTS[0], offer = currentFreebies[0], opening = currentOpenings[0];
const post = { id: 'public-one', title: 'User text stays original', city: 'SF', category: '租屋', budget: '待确认', savedAt: 1 };
const guestList = (items: { kind: string; id: string }[]) => localStorage.setItem(savesKey(), JSON.stringify({ v: 1, items: items.map(item => ({ ...item, savedAt: 1 })) }));
// What /me's 收藏 tile renders (WEB-ACCOUNT's MeTiles reads useSavedCount; null → no number).
function MeCount({ userId }: { userId?: string }) { const count = useSavedCount(userId ?? null); return <output data-testid="me-saved-count">{count ?? '—'}</output>; }
const page = (user: { id: string } | null = null) => <MemoryRouter><Routes><Route element={<Outlet context={{ user }} />}><Route path="/" element={<>
  <MeCount userId={user?.id} />
  <UnifiedSavedItems today={TODAY} signedIn={!!user} />
</>} /></Route></Routes></MemoryRouter>;
beforeEach(t => { t.mock.method(globalThis, 'fetch', async () => Response.json({})); });
afterEach(() => { cleanup(); localStorage.clear(); resetSaveStore(); });

test('one saved list: every kind as a row with a cover, and the /me count equals the rows', () => {
  guestList([{ kind: 'offer', id: offer.id }, { kind: 'opening', id: opening.id }, { kind: 'event', id: event.id }, { kind: 'guide', id: guide.slug }]);
  localStorage.setItem(savedPostsKey(), JSON.stringify([post]));
  localStorage.setItem(savedPostsKey('bob'), JSON.stringify([{ ...post, id: 'private-bob', title: 'Bob only' }]));
  const view = render(page());
  const section = within(view.getByTestId('my-week-saved'));
  const rows = view.getByTestId('my-week-saved').querySelectorAll('ul > li');
  assert.equal(rows.length, 5);
  assert.equal(view.getByTestId('my-week-saved-count').textContent, '5');
  assert.equal(view.getByTestId('me-saved-count').textContent, '5', '/me names the same number');
  assert.ok(section.getByRole('link', { name: offer.title }));
  assert.match(section.getByRole('link', { name: offer.title }).closest('li')!.textContent!, new RegExp(`优惠 · ${brandCase(offer.brand)} · `), 'the brand leads the meta line in its display casing');
  assert.ok(section.getByRole('link', { name: opening.name }));
  assert.ok(section.getByRole('link', { name: guide.title }));
  assert.equal(section.getByRole('link', { name: post.title }).querySelector('[translate="no"]')!.textContent, post.title, 'user text is never translated');
  assert.equal(view.queryByText('Bob only'), null, 'another account’s device list stays apart');
  for (const row of rows) assert.ok(row.querySelector('[data-cover]'), 'every row carries a cover frame');
  assert.equal([...rows].some(row => row.querySelector('[data-cover="type"]')), false, 'never an information card (UI9-IMAGES DECISIONS 21)');
  // Captain 10-22 02:50: no row keeps an empty LQIP frame; a saved post (no photo in its snapshot) shows its board category's ③.
  for (const row of rows) assert.ok(row.querySelector('[data-cover="image"] img'), `every row shows a picture: ${row.textContent}`);
  const postCover = view.getByTestId('my-week-saved').querySelector('li[data-kind="post"] [data-cover="image"]')!;
  assert.equal(postCover.getAttribute('data-tier'), 'stock');
  assert.match(postCover.querySelector('img')!.getAttribute('src')!, /stock-guide-housing-/, '租屋 → a home picture');
  assert.ok(section.getByRole('group', { name: '按类型筛选收藏' }));
});

test('filters by kind, removes with the ♡, and keeps a retired item listed (with its ♡) so the count never drifts', async () => {
  guestList([{ kind: 'offer', id: 'retired-offer-id' }, { kind: 'event', id: event.id }, { kind: 'offer', id: offer.id }]);
  const view = render(page());
  const section = within(view.getByTestId('my-week-saved'));
  assert.match(view.getByTestId('my-week-saved').textContent!, /已下架/);
  fireEvent.click(section.getByRole('button', { name: /^优惠/ }));
  assert.equal(view.getByTestId('my-week-saved').querySelectorAll('ul > li').length, 2);
  await act(async () => { fireEvent.click(section.getByRole('button', { name: `取消收藏：${offer.title}` })); });
  assert.equal(view.getByTestId('my-week-saved-count').textContent, '2');
  assert.equal(view.getByTestId('me-saved-count').textContent, '2');
  assert.deepEqual(JSON.parse(localStorage.getItem(savesKey())!).items.map((item: { id: string }) => item.id), ['retired-offer-id', event.id]);
});

test('an ended event says so, and on /en every piece of the meta line is translated', async () => {
  const ended = MONTHLY_EVENTS.find(item => item.endDate < TODAY)!;
  const shop = currentOpenings.find(item => / · /.test(item.dateLabel))!;
  guestList([{ kind: 'event', id: ended.id }, { kind: 'opening', id: shop.id }, { kind: 'offer', id: offer.id }]);
  const view = render(page());
  const endedRow = within(view.getByTestId('my-week-saved')).getByRole('link', { name: ended.title }).closest('li')!;
  assert.equal(endedRow.getAttribute('data-ended'), '');
  assert.match(endedRow.querySelector('.ui-row-card__date')!.textContent!, /^已结束 · /);
  cleanup();
  await act(async () => { await setLocale('en', false); });
  try {
    const english = render(page());
    const rows = [...english.getByTestId('my-week-saved').querySelectorAll('ul > li')];
    assert.equal(rows.length, 3);
    for (const row of rows) assert.doesNotMatch(row.textContent!, /[㐀-鿿]/, `no Chinese left in an /en row: ${row.textContent}`);
    assert.match(rows[0].querySelector('.ui-row-card__date')!.textContent!, /^Ended · /);
  } finally { await act(async () => { await setLocale('zh-Hans', false); }); }
});

test('the older reader list shows once, and an empty list explains how to save', () => {
  localStorage.setItem(READER_LIBRARY_KEY, JSON.stringify({ saved: [guide.slug], recent: ['private-reading-history'] }));
  const view = render(page());
  assert.equal(within(view.getByTestId('my-week-saved')).getAllByRole('link', { name: guide.title }).length, 1);
  assert.equal(view.queryByText('private-reading-history'), null);
  cleanup(); localStorage.clear(); resetSaveStore();
  const empty = render(page());
  assert.ok(within(empty.getByTestId('my-week-saved')).getByRole('heading', { name: '还没有收藏' }));
  assert.equal(empty.queryByTestId('my-week-saved-count'), null, 'an empty list prints no “0” beside its heading; the empty state says it');
  assert.equal(within(empty.getByTestId('my-week-saved')).getByRole('link', { name: '看本周末活动' }).getAttribute('href'), '/events');
});

test('an unavailable account keeps device items readable while the account count stays unknown on both surfaces', async t => {
  localStorage.setItem('currentUser', JSON.stringify({ id: 'alice', token: 'test-only' }));
  localStorage.setItem(savedPostsKey('alice'), JSON.stringify([post]));
  let fail = true;
  t.mock.method(api, 'request', async () => { if (fail) throw { status: 503 }; return { ...structuredClone(EMPTY_LIBRARY), favorites: [{ kind: 'event', id: event.id }] }; });
  const view = render(page({ id: 'alice' }));
  await act(async () => {});
  assert.ok(view.getByLabelText('账号收藏暂时未知'));
  assert.equal(view.getByTestId('me-saved-count').textContent, '—');
  assert.ok(within(view.getByTestId('my-week-saved')).getByRole('link', { name: post.title }));
  fail = false;
  await act(async () => { fireEvent.click(within(view.getByTestId('my-week-saved')).getByRole('button', { name: '重试' })); });
  assert.equal(view.getByTestId('my-week-saved-count').textContent, '2');
  assert.equal(view.getByTestId('me-saved-count').textContent, '2');
});

test('saved listings on screen are checked: a deleted or hidden one says so and offers its ♡, a live one keeps its link', async t => {
  const gone = { ...post, id: 'deleted-one', title: 'Deleted by its author' };
  const unsure = { ...post, id: 'unsure-one', title: 'Check failed' };
  localStorage.setItem(savedPostsKey(), JSON.stringify([post, gone, unsure]));
  const checked: string[] = [];
  t.mock.method(api, 'request', async (path: string) => {
    checked.push(path);
    if (path === `/posts/${post.id}`) return { ...post };
    if (path === `/posts/${gone.id}`) throw { status: 404, error: 'not found' };
    throw { status: 503 };
  });
  const view = render(page());
  const section = within(view.getByTestId('my-week-saved'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.deepEqual(checked.sort(), [`/posts/${gone.id}`, `/posts/${post.id}`, `/posts/${unsure.id}`]);
  assert.ok(section.getByRole('link', { name: post.title }), 'a live listing keeps its link');
  const goneRow = view.getByTestId('saved-post-gone');
  assert.match(goneRow.textContent!, /Deleted by its author · 这条信息目前不可访问，可以移除收藏。/);
  assert.equal(section.queryByRole('link', { name: gone.title }), null, 'no link to a dead page');
  assert.match(section.getByRole('link', { name: unsure.title }).closest('li')!.textContent!, /暂时无法检查是否仍在/);
  assert.equal(view.getByTestId('my-week-saved-count').textContent, '3', 'the count still names every saved item');
  await act(async () => { fireEvent.click(within(goneRow).getByRole('button', { name: `取消收藏：${gone.title}` })); });
  assert.equal(view.getByTestId('my-week-saved-count').textContent, '2');
  assert.equal(checked.length, 3, 'each listing is checked once per visit');
});

test('a member’s words stay as written in every language; the board’s own labels are translated', async () => {
  const listing = { id: 'fremont-room', title: '东湾 Fremont 两房出租，近 BART', city: 'Fremont', category: '租屋', budget: '$2,600/月', savedAt: 1 };
  localStorage.setItem(savedPostsKey(), JSON.stringify([listing]));
  const row = (view: ReturnType<typeof render>) => view.getByTestId('my-week-saved').querySelector('li[data-kind="post"]')!;
  await act(async () => { await setLocale('zh-Hant', false); });
  try {
    const hant = render(page());
    const link = within(row(hant)).getByRole('link');
    assert.equal(link.textContent, listing.title, 'the title is not converted to 繁體');
    const meta = row(hant).querySelector('.ui-row-card__meta')!;
    assert.match(meta.textContent!, /^鄰里資訊 · 租屋 · Fremont · \$2,600\/月$/, 'labels in 繁體, the budget exactly as written');
    assert.equal([...meta.querySelectorAll('[translate="no"]')].map(node => node.textContent).join('|'), 'Fremont|$2,600/月');
    cleanup();
    await act(async () => { await setLocale('en', false); });
    const english = render(page());
    assert.equal(within(row(english)).getByRole('link').textContent, listing.title);
    assert.equal(row(english).querySelector('.ui-row-card__meta')!.textContent, 'Neighborhood listing · Housing · Fremont · $2,600/月', 'the category is the board’s label, translated');
  } finally { await act(async () => { await setLocale('zh-Hans', false); }); }
});

test('RC-15: My Week stops the retries of a pending save whose item has left the web catalog, and lists it as retired', async t => {
  localStorage.setItem('currentUser', JSON.stringify({ id: 'alice', token: 'test-only' }));
  const now = Date.now();
  localStorage.setItem(savesKey('alice'), JSON.stringify({ v: 1, items: [{ kind: 'offer', id: 'retired-offer-zz', savedAt: now, triedAt: now }, { kind: 'offer', id: offer.id, savedAt: now, triedAt: now }] }));
  t.mock.method(api, 'request', async (_path: string, options?: RequestInit) => {
    if (options?.method) throw { status: 404, code: 'ITEM_NOT_IN_CATALOG' };
    return structuredClone(EMPTY_LIBRARY);
  });
  const view = render(page({ id: 'alice' }));
  await act(async () => {});
  const stored = JSON.parse(localStorage.getItem(savesKey('alice'))!).items as { id: string; retired?: boolean }[];
  assert.deepEqual(stored.map(item => [item.id, !!item.retired]), [['retired-offer-zz', true], [offer.id, false]]);
  const saved = within(view.getByTestId('my-week-saved'));
  assert.equal(saved.getAllByText('这条内容已下架或暂时找不到。', { exact: false }).length, 1);
  assert.ok(saved.getByRole('link', { name: new RegExp(offer.title.slice(0, 8)) }), 'the offer still listed keeps its row');
  assert.equal(view.getByTestId('my-week-saved-count').textContent, '2', 'the count never drifts');
});
