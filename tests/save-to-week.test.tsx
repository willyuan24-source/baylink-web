import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'https://www.baylink.us/' });
Object.assign(globalThis, { window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true });
Object.defineProperty(globalThis,'navigator',{ configurable:true,value:dom.window.navigator });
const { render,fireEvent,cleanup,act,within,waitFor } = await import('@testing-library/react');
const { MemoryRouter,Routes,Route,Outlet } = await import('react-router-dom');
const { SaveToWeek } = await import('../src/components/SaveToWeek');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { resetSaveStore, savesKey } = await import('../src/lib/saves');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { currentFreebies } = await import('../src/data/october-offers');
type Favorite = import('../src/lib/planner').Favorite;
const event: Favorite = { kind:'event',id:MONTHLY_EVENTS[0].id };
const offer: Favorite = { kind:'offer',id:currentFreebies[0].id };
const account = { id:'reader-fixture',token:'reader-fixture-token' };
const page = (favorite: Favorite, user: typeof account | null = account, compact = false) => <MemoryRouter><Routes><Route element={<Outlet context={{ user }}/>}><Route path="/" element={<SaveToWeek favorite={favorite} compact={compact} title={compact ? 'Fixture offer' : undefined}/>}/></Route></Routes></MemoryRouter>;
// Product counters must never leave a test.
beforeEach(t => { t.mock.method(globalThis,'fetch',async () => Response.json({})); });
afterEach(() => { cleanup();localStorage.clear();resetSaveStore(); });

test('initial read failure disables unknown favorite state and offers a real reload before any write', async t => {
  localStorage.setItem('currentUser',JSON.stringify(account));
  let reads = 0,writes = 0;
  t.mock.method(api,'request',async (_path:string,options?:RequestInit) => {
    if (options?.method) { writes++;return { favorites:[] }; }
    if (++reads === 1) throw new Error('isolated initial read failure');
    return { ...structuredClone(EMPTY_LIBRARY),favorites:[event] };
  });
  const view = render(page(event));await act(async () => {});
  const retry = await view.findByRole('button',{ name:'重新读取收藏' });
  const save = view.getByRole('button',{ name:'收藏' }) as HTMLButtonElement;
  assert.equal(save.disabled,true); assert.equal(save.hasAttribute('aria-pressed'),false,'an unread account must not be called unsaved');
  fireEvent.click(save);assert.equal(writes,0);
  await act(async () => { fireEvent.click(retry); });
  const saved = await view.findByRole('button',{ name:'已收藏' }) as HTMLButtonElement;
  assert.equal(reads,2);assert.equal(saved.disabled,false);assert.equal(saved.getAttribute('aria-pressed'),'true');
  assert.equal(view.queryByRole('alert'),null);assert.equal(writes,0,'reload never mutates the confirmed saved item');
});

test('write failure keeps the known state and permits retrying the same favorite without another read', async t => {
  localStorage.setItem('currentUser',JSON.stringify(account));
  let reads = 0,writes = 0;
  t.mock.method(api,'request',async (path:string,options?:RequestInit) => {
    if (!options?.method) { reads++;return structuredClone(EMPTY_LIBRARY); }
    assert.equal(options.method,'PUT');assert.equal(path,`/planner/favorites/event/${encodeURIComponent(event.id)}`);
    if (++writes === 1) throw { status:503,error:'isolated write failure' };
    return { favorites:[event] };
  });
  const view = render(page(event));await act(async () => {});
  await act(async () => { fireEvent.click(view.getByRole('button',{ name:'收藏' })); });
  await view.findByRole('alert');
  const save = view.getByRole('button',{ name:'收藏' }) as HTMLButtonElement;
  assert.equal(save.disabled,false);assert.equal(save.getAttribute('aria-pressed'),'false','a failed save restores the confirmed state');
  assert.equal(view.queryByRole('button',{ name:'重新读取收藏' }),null,'a write error does not discard a completed read');
  await act(async () => { fireEvent.click(save); });
  await view.findByRole('button',{ name:'已收藏' });
  assert.equal(reads,1);assert.equal(writes,2);assert.equal(view.queryByRole('alert'),null);
  assert.match(view.getByTestId('save-toast').textContent!,/已收藏/);
  assert.equal(within(view.getByTestId('save-toast')).getByRole('link',{ name:'查看' }).getAttribute('href'),'/my-week#saved');
});

test('an offer the account catalog does not know yet stays saved on this device and is never shown as an error (RC-15)', async t => {
  localStorage.setItem('currentUser',JSON.stringify(account));
  const writes: string[] = [];
  t.mock.method(api,'request',async (path:string,options?:RequestInit) => {
    if (!options?.method) return structuredClone(EMPTY_LIBRARY);
    writes.push(`${options.method} ${path}`);
    throw { status:404,code:'ITEM_NOT_IN_CATALOG',error:'这个项目尚未发布或已下架。' };
  });
  const view = render(page(offer,account,true));await act(async () => {});
  await act(async () => { fireEvent.click(view.getByRole('button',{ name:'收藏：Fixture offer' })); });
  const saved = view.getByRole('button',{ name:'取消收藏：Fixture offer' });
  assert.equal(saved.getAttribute('aria-pressed'),'true');
  assert.equal(view.queryByRole('alert'),null);
  assert.match(view.getByTestId('save-toast').textContent!,/本机/);
  assert.deepEqual(writes,[`PUT /planner/favorites/offer/${encodeURIComponent(offer.id)}`]);
  const pending = JSON.parse(localStorage.getItem(savesKey(account.id))!).items;
  assert.deepEqual(pending.map((item: Favorite) => `${item.kind}:${item.id}`),[`offer:${offer.id}`]);
  // Removing a device-only save needs no account call.
  await act(async () => { fireEvent.click(saved); });
  assert.equal(view.getByRole('button',{ name:'收藏：Fixture offer' }).getAttribute('aria-pressed'),'false');
  assert.equal(writes.length,1);
});

test('guests save offers in this browser without any account request; guide mounts defer to the reader actions', async t => {
  t.mock.method(api,'request',async () => { throw new Error('Guests must not call an account API'); });
  const view = render(page(offer,null));
  // The control loads on its own; until then a disabled copy of the button holds its place.
  await waitFor(() => assert.equal(view.getByRole('button',{ name:'收藏' }).hasAttribute('disabled'),false));
  await act(async () => { fireEvent.click(view.getByRole('button',{ name:'收藏' })); });
  assert.equal(view.getByRole('button',{ name:'已收藏' }).getAttribute('aria-pressed'),'true');
  assert.equal(view.getByRole('link',{ name:'我的这周' }).getAttribute('href'),'/my-week#saved');
  assert.deepEqual(JSON.parse(localStorage.getItem(savesKey())!).items.map((item: Favorite) => item.id),[offer.id]);
  cleanup();
  const guide = render(page({ kind:'guide',id:'bay-area-roommate-guide' },null));
  assert.equal(guide.container.textContent,'','the guide page already shows its ♡ in the reader actions');
});

test('a failed account read stays silent on list cards; only the card the reader taps re-reads and says it failed', async t => {
  localStorage.setItem('currentUser',JSON.stringify(account));
  let reads = 0,fail = true;
  t.mock.method(api,'request',async (_path:string,options?:RequestInit) => {
    if (options?.method) throw new Error('no write expected');
    reads++;
    if (fail) throw { status:503,error:'isolated read failure' };
    return { ...structuredClone(EMPTY_LIBRARY),favorites:[{ kind:'offer',id:currentFreebies[1].id }] };
  });
  const offers = currentFreebies.slice(0,3);
  const view = render(<MemoryRouter><Routes><Route element={<Outlet context={{ user:account }}/>}><Route path="/" element={<>{offers.map(item => <SaveToWeek key={item.id} favorite={{ kind:'offer',id:item.id }} compact title={item.title}/>)}</>}/></Route></Routes></MemoryRouter>);
  const heart = (index: number) => view.getByRole('button',{ name:`收藏：${offers[index].title}` }) as HTMLButtonElement;
  await waitFor(() => assert.equal(heart(0).disabled,false));
  assert.equal(reads,1);
  assert.equal(view.queryAllByRole('alert').length,0,'one failed read must not put an alert under every card');
  assert.equal(view.queryByRole('button',{ name:'重新读取收藏' }),null);
  assert.equal(heart(0).hasAttribute('aria-pressed'),false,'an unread account is never called unsaved');
  await act(async () => { fireEvent.click(heart(0)); });
  assert.equal(reads,2,'tapping a card reads the list again');
  await waitFor(() => assert.equal(view.getAllByRole('alert').length,1));
  assert.ok(heart(0).closest('.saves-control')!.querySelector('[role=alert]'),'the alert sits on the tapped card');
  fail = false;
  await act(async () => { fireEvent.click(heart(2)); });
  assert.equal(reads,3);
  await waitFor(() => assert.equal(view.queryAllByRole('alert').length,0));
  assert.equal(view.getByRole('button',{ name:`取消收藏：${offers[1].title}` }).getAttribute('aria-pressed'),'true');
  assert.equal(heart(2).getAttribute('aria-pressed'),'false','the re-read itself never saves the tapped item');
});

test('two saves in a row show one confirmation, not two stacked toasts', async () => {
  const offers = currentFreebies.slice(0,2);
  const view = render(<MemoryRouter><Routes><Route element={<Outlet context={{ user:null }}/>}><Route path="/" element={<>{offers.map(item => <SaveToWeek key={item.id} favorite={{ kind:'offer',id:item.id }} compact title={item.title}/>)}</>}/></Route></Routes></MemoryRouter>);
  const heart = (index: number) => view.getByRole('button',{ name:`收藏：${offers[index].title}` }) as HTMLButtonElement;
  await waitFor(() => assert.equal(heart(1).disabled,false));
  await act(async () => { fireEvent.click(heart(0)); });
  await act(async () => { fireEvent.click(heart(1)); });
  assert.equal(view.getAllByTestId('save-toast').length,1);
});
