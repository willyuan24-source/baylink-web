import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { UnifiedSavedItems } from '../src/components/UnifiedSavedItems';
import { READER_LIBRARY_KEY } from '../src/lib/reader-library';
import { savedPostsKey } from '../src/lib/savedPosts';
import { getGuideBySlug } from '../src/data/guides';
import { MemoryRouter } from 'react-router-dom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.baylink.us/my-week' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
afterEach(() => { cleanup(); localStorage.clear(); dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: null })); });
const guide = getGuideBySlug('bay-area-roommate-guide')!;
const post = { id: 'public-one', title: 'User text stays original', city: 'SF', category: '租屋', budget: '待确认', savedAt: 1 };

test('one saved view merges device guides, scoped listings and synced favorites without duplicates or moving reading history', () => {
  localStorage.setItem(READER_LIBRARY_KEY, JSON.stringify({ saved: [guide.slug], recent: ['private-reading-history'] }));
  localStorage.setItem(savedPostsKey('alice'), JSON.stringify([post]));
  localStorage.setItem(savedPostsKey('bob'), JSON.stringify([{ ...post, id: 'private-bob', title: 'Bob only' }]));
  const view = render(<MemoryRouter><UnifiedSavedItems userId="alice" favorites={[{ kind: 'guide', id: guide.slug }]} ready busy={false} error="" onToggleFavorite={async () => undefined} /></MemoryRouter>);
  assert.equal(view.getAllByRole('link', { name: guide.title }).length, 1);
  assert.ok(view.getByRole('link', { name: post.title }));
  assert.equal(view.queryByText('Bob only') === null, true);
  assert.equal(view.queryByText('private-reading-history') === null, true);
  assert.ok(view.getByText('本机及账号'));
  assert.equal(JSON.parse(localStorage.getItem(READER_LIBRARY_KEY)!).recent[0], 'private-reading-history');
});

test('a failed account removal retains the duplicate device guide and the actionable remove control', async () => {
  localStorage.setItem('currentUser', JSON.stringify({ id: 'alice', token: 'test-only' }));
  localStorage.setItem(READER_LIBRARY_KEY, JSON.stringify({ saved: [guide.slug], recent: [] }));
  let attempts = 0;
  const view = render(<MemoryRouter><UnifiedSavedItems userId="alice" favorites={[{ kind: 'guide', id: guide.slug }]} ready busy={false} error="" onToggleFavorite={async () => { attempts++; return undefined; }} /></MemoryRouter>);
  await act(async () => fireEvent.click(view.getByRole('button', { name: `取消收藏: ${guide.title}` })));
  assert.equal(attempts, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem(READER_LIBRARY_KEY)!).saved, [guide.slug]);
  assert.ok(view.getByRole('link', { name: guide.title }));
});

test('account unavailability retains readable local items while the overall saved count remains unknown', () => {
  localStorage.setItem(savedPostsKey('alice'), JSON.stringify([post]));
  const view = render(<MemoryRouter><UnifiedSavedItems userId="alice" favorites={[]} ready={false} busy={false} error="offline" onToggleFavorite={async () => undefined} /></MemoryRouter>);
  assert.ok(view.getByLabelText('账号收藏暂时未知'));
  assert.ok(view.getByRole('link', { name: post.title }));
});
