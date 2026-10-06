import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ProfilePersonalSpace, ProfileActivityLinks } = await import('../src/features/profile/ProfilePersonalSpace');
const { profileExplorationSteps } = await import('../src/features/profile/profile-exploration');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { setLocale } = await import('../src/i18n/locale');
const user = { id: 'space-user', token: 'space-token', nickname: 'Neighbor', role: 'user', contactType: 'wechat', contactValue: '', email: '', isBanned: false, bio: '周末看展' } as UserData;
const page = (owner = user) => <MemoryRouter><ProfilePersonalSpace key={owner.id} user={owner} onEdit={() => {}} /></MemoryRouter>;
beforeEach(async () => { localStorage.clear(); localStorage.setItem('currentUser', JSON.stringify(user)); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => dom.window.close());

test('private exploration uses saved actions, never requires contact, photos or public location', () => {
  const library = structuredClone(EMPTY_LIBRARY);
  library.preferences.travelMode = 'transit';
  library.favorites.push({ kind: 'place', id: 'saved-place' });
  library.plans.push({ id: 'saved-plan', title: 'One day', date: '2026-10-17', stops: [{ kind: 'place', id: 'saved-place' }], version: 1, createdAt: '', updatedAt: '' });
  assert.deepEqual(profileExplorationSteps(user, library).map(step => step.complete), [true, true, true, true]);
  assert.deepEqual(profileExplorationSteps(user, null).map(step => step.complete), [true, null, null, null]);
  assert.equal(profileExplorationSteps({ ...user, bio: '', socialIntents: ['coffee'] }, EMPTY_LIBRARY)[0].complete, true);
  assert.equal(profileExplorationSteps({ ...user, bio: '', isOfficialVerified: true, isPhoneVerified: true }, EMPTY_LIBRARY)[0].complete, false);
});

test('failed initial reads show unknown progress and prohibit overwriting server preferences until retry', async t => {
  let fail = true; let writes = 0;
  const data = structuredClone(EMPTY_LIBRARY); data.preferences.regions = ['peninsula'];
  t.mock.method(api, 'request', async (path: string) => { if (path === '/planner/me') { if (fail) throw { status: 503 }; return data; } writes++; throw new Error('Unexpected write'); });
  const view = render(page());
  await waitFor(() => assert.ok(view.getByRole('alert')));
  assert.match(view.container.textContent!, /— \/ 4/);
  fireEvent.click(view.getByRole('button', { name: '调整偏好' }));
  assert.ok((view.getByRole('button', { name: '半岛' }) as HTMLButtonElement).closest('fieldset')?.disabled);
  assert.equal(writes, 0);
  fail = false;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '重新读取' })); });
  assert.equal(view.getByRole('button', { name: '半岛' }).getAttribute('aria-pressed'), 'true');
  assert.match(view.container.textContent!, /2 \/ 4/);
});

test('preferences persist through the existing account API and failed saves preserve the previous selection', async t => {
  const remote = structuredClone(EMPTY_LIBRARY); let fail = false; const writes: unknown[] = [];
  t.mock.method(api, 'request', async (path: string, options?: { body?: string }) => {
    if (path === '/planner/me') return remote;
    assert.equal(path, '/planner/preferences');
    const next = JSON.parse(options!.body!); writes.push(next);
    if (fail) throw { status: 503 };
    remote.preferences = next; return { preferences: next };
  });
  const view = render(page()); await waitFor(() => assert.match(view.container.textContent!, /1 \/ 4/));
  fireEvent.click(view.getByRole('button', { name: '调整偏好' }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '半岛' })); });
  assert.deepEqual(writes[0], { regions: ['peninsula'], interests: [], travelMode: 'any' });
  assert.equal(view.getByRole('button', { name: '半岛' }).getAttribute('aria-pressed'), 'true');
  assert.match(view.getByRole('status').textContent!, /偏好已保存/);
  fail = true;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '文化' })); });
  assert.equal(view.getByRole('button', { name: '文化' }).getAttribute('aria-pressed'), 'false');
  assert.match(view.getByRole('alert').textContent!, /上次保存的选择仍然保留/);
  assert.doesNotMatch(view.getByRole('status').textContent!, /偏好已保存/);
});

test('late account responses cannot display another user’s progress', async t => {
  let resolveFirst!: (value: typeof EMPTY_LIBRARY) => void;
  t.mock.method(api, 'request', () => new Promise<typeof EMPTY_LIBRARY>(resolve => { resolveFirst = resolve; }));
  const view = render(page());
  const first = resolveFirst;
  const other = { ...user, id: 'other-space-user', bio: '' };
  localStorage.setItem('currentUser', JSON.stringify(other));
  view.rerender(page(other));
  const second = resolveFirst;
  const firstData = structuredClone(EMPTY_LIBRARY); firstData.favorites = [{ kind: 'place', id: 'first-private-place' }];
  await act(async () => first(firstData));
  assert.match(view.container.textContent!, /— \/ 4/);
  await act(async () => second(structuredClone(EMPTY_LIBRARY)));
  assert.match(view.container.textContent!, /0 \/ 4/);
});

test('journey is optional, collapsed by default and editable actions remain user initiated', async t => {
  let edits = 0;
  t.mock.method(api, 'request', async () => structuredClone(EMPTY_LIBRARY));
  const view = render(<MemoryRouter><ProfilePersonalSpace user={user} onEdit={() => edits++} /></MemoryRouter>);
  await waitFor(() => assert.match(view.container.textContent!, /1 \/ 4/));
  assert.equal(view.queryByRole('button', { name: '编辑名片' }), null);
  fireEvent.click(view.getByRole('button', { name: '查看探索步骤' }));
  fireEvent.click(view.getByRole('button', { name: '编辑名片' })); assert.equal(edits, 1);
  fireEvent.click(view.getByRole('button', { name: '设置偏好' }));
  assert.equal(view.getByRole('button', { name: '收起设置' }).getAttribute('aria-expanded'), 'true');
  assert.equal(view.getByRole('link', { name: '开始安排' }).getAttribute('href'), '/plan');
  fireEvent.click(view.getByRole('button', { name: '收起探索步骤' }));
  assert.equal(view.queryByRole('button', { name: '编辑名片' }), null);
});

test('private controls translate into English and Traditional Chinese', async t => {
  t.mock.method(api, 'request', async () => structuredClone(EMPTY_LIBRARY));
  await setLocale('en'); const view = render(page());
  assert.ok(view.getByRole('heading', { name: 'My Bay Area journey' }));
  fireEvent.click(view.getByRole('button', { name: 'Adjust preferences' }));
  await act(async () => { await setLocale('zh-Hant'); });
  assert.ok(view.getByRole('heading', { name: '我的探索路線' }));
  assert.ok(view.getByRole('button', { name: '收起設定' }));
});

test('activity links lead directly to saved plans, owned groups and both booking roles', () => {
  const view = render(<MemoryRouter><ProfileActivityLinks /></MemoryRouter>);
  assert.deepEqual([...view.container.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/my-week', '/together?view=mine', '/me/bookings']);
});
