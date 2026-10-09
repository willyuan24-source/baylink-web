import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { SavedPostsPanel } = await import('../src/components/SavedPostsPanel');
const { savedPostsKey } = await import('../src/lib/savedPosts');
const { resetSaveStore, savesKey } = await import('../src/lib/saves');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); localStorage.clear(); resetSaveStore(); await setLocale('zh-Hans', false); });

const panel = (userId?: string) => <MemoryRouter><SavedPostsPanel userId={userId} /></MemoryRouter>;

test('the /me row counts the whole saved list (not only listings) and leads to My Week', () => {
  localStorage.setItem(savesKey(), JSON.stringify({ v: 1, items: [{ kind: 'offer', id: 'sephora-birthday', savedAt: 2 }, { kind: 'guide', id: 'bay-area-roommate-guide', savedAt: 1 }] }));
  localStorage.setItem(savedPostsKey(), JSON.stringify([{ id: 'p1', title: '收藏快照', city: '东湾', category: '租屋', budget: '$1800', savedAt: 1 }]));
  const view = render(panel());
  const link = view.getByRole('link', { name: /我的收藏/ });
  assert.match(link.textContent!, /我的收藏\s*3/);
  assert.equal(link.getAttribute('href'), '/my-week#saved');
});

test('accounts never see another account’s device listings, and English names the same count', async () => {
  localStorage.setItem(savedPostsKey('two'), JSON.stringify([{ id: 'p2', title: 'Other account', city: '', category: '', budget: '', savedAt: 1 }]));
  const view = render(panel());
  assert.match(view.getByRole('link').textContent!, /我的收藏\s*0/);
  cleanup();
  await act(async () => { await setLocale('en', false); });
  const english = render(panel());
  assert.match(english.getByRole('link').textContent!, /Saved items\s*0/);
  assert.match(english.getByRole('link').textContent!, /all in My Week/);
});
