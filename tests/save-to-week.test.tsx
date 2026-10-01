import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'https://www.baylink.us/' });
Object.assign(globalThis, { window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true });
Object.defineProperty(globalThis,'navigator',{ configurable:true,value:dom.window.navigator });
const { render,fireEvent,cleanup,act } = await import('@testing-library/react');
const { MemoryRouter,Routes,Route,Outlet } = await import('react-router-dom');
const { SaveToWeek } = await import('../src/components/SaveToWeek');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const favorite = { kind:'event' as const,id:MONTHLY_EVENTS[0].id };
const account = { id:'reader-fixture',token:'reader-fixture-token' };
const page = () => <MemoryRouter><Routes><Route element={<Outlet context={{ user:account }}/>}><Route path="/" element={<SaveToWeek favorite={favorite}/>}/></Route></Routes></MemoryRouter>;
afterEach(() => { cleanup();localStorage.clear(); });

test('initial read failure disables unknown favorite state and offers a real reload before any write', async t => {
  localStorage.setItem('currentUser',JSON.stringify(account));
  let reads = 0,writes = 0;
  t.mock.method(globalThis,'fetch',async () => Response.json({}));
  t.mock.method(api,'request',async (_path:string,options?:RequestInit) => {
    if (options?.method) { writes++;return { favorites:[] }; }
    if (++reads === 1) throw new Error('isolated initial read failure');
    return { ...structuredClone(EMPTY_LIBRARY),favorites:[favorite] };
  });
  const view = render(page());await act(async () => {});
  const retry = await view.findByRole('button',{ name:'重新读取收藏' });
  const save = view.getByRole('button',{ name:'收藏到我的这周' }) as HTMLButtonElement;
  assert.equal(save.disabled,true); assert.equal(save.hasAttribute('aria-pressed'),false,'an unread account must not be called unsaved');
  fireEvent.click(save);assert.equal(writes,0);
  fireEvent.click(retry);
  const saved = await view.findByRole('button',{ name:'已加入我的这周' }) as HTMLButtonElement;
  assert.equal(reads,2);assert.equal(saved.disabled,false);assert.equal(saved.getAttribute('aria-pressed'),'true');
  assert.equal(view.queryByRole('alert'),null);assert.equal(writes,0,'reload never mutates the confirmed saved item');
});

test('write failure keeps the known state and permits retrying the same favorite without another read', async t => {
  localStorage.setItem('currentUser',JSON.stringify(account));
  let reads = 0,writes = 0;
  t.mock.method(globalThis,'fetch',async () => Response.json({}));
  t.mock.method(api,'request',async (_path:string,options?:RequestInit) => {
    if (!options?.method) { reads++;return structuredClone(EMPTY_LIBRARY); }
    assert.equal(options.method,'PUT');
    if (++writes === 1) throw new Error('isolated write failure');
    return { favorites:[favorite] };
  });
  const view = render(page());await act(async () => {});
  fireEvent.click(view.getByRole('button',{ name:'收藏到我的这周' }));
  await view.findByRole('alert');
  const save = view.getByRole('button',{ name:'收藏到我的这周' }) as HTMLButtonElement;
  assert.equal(save.disabled,false);assert.equal(save.getAttribute('aria-pressed'),'false');
  assert.equal(view.queryByRole('button',{ name:'重新读取收藏' }),null,'a write error does not discard a completed read');
  fireEvent.click(save);await view.findByRole('button',{ name:'已加入我的这周' });
  assert.equal(reads,1);assert.equal(writes,2);assert.equal(view.queryByRole('alert'),null);
});
