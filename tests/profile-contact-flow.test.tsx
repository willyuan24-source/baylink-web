import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { PublicUserProfile, UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { UserProfileModal } = await import('../src/features/users/UserProfileModal');
const { useContactIntent } = await import('../src/app/useContactIntent');
const { api } = await import('../src/lib/api');
afterEach(() => { cleanup(); localStorage.clear(); });

const profile: PublicUserProfile = { id: 'neighbor', nickname: '湾区邻居', role: 'user', postCount: 0, recentPosts: [] };
const user: UserData = { id: 'viewer', nickname: '当前账号', email: '', contactType: 'wechat', contactValue: '' };

test('cancelled profile contact login does not resume after a later unrelated sign-in', async t => {
  t.mock.method(api, 'getUserPublicProfile', async () => profile);
  const opened: string[] = [];
  let cancelLogin!: () => void;
  let laterSignIn!: () => void;
  let loginRequests = 0;
  function Harness() {
    const [currentUser, setCurrentUser] = React.useState<UserData | null>(null);
    const contact = useContactIntent({ user: currentUser, onLoginNeeded: () => { loginRequests += 1; },
      onOpen: intent => { opened.push(intent.targetId); } });
    cancelLogin = contact.cancelPendingContact;
    laterSignIn = () => { setCurrentUser(user); contact.completeContactLogin(user); };
    return <UserProfileModal userId={profile.id} currentUser={currentUser} onClose={() => {}}
      onChat={contact.openChat} onLoginNeeded={() => { loginRequests += 1; }} />;
  }
  const view = render(<Harness />);
  await view.findByRole('button', { name: '登录后发私信' });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '登录后发私信' })));
  assert.equal(loginRequests, 1);
  await act(async () => cancelLogin());
  await act(async () => laterSignIn());
  assert.deepEqual(opened, []);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '发私信', exact: true })));
  assert.deepEqual(opened, [profile.id]);
});

test('a completed profile contact login resumes exactly once through the shared flow', async t => {
  t.mock.method(api, 'getUserPublicProfile', async () => profile);
  const opened: string[] = [];
  let finishLogin!: () => void;
  function Harness() {
    const [currentUser, setCurrentUser] = React.useState<UserData | null>(null);
    const contact = useContactIntent({ user: currentUser, onLoginNeeded() {}, onOpen: intent => { opened.push(intent.targetId); } });
    finishLogin = () => { setCurrentUser(user); contact.completeContactLogin(user); };
    return <UserProfileModal userId={profile.id} currentUser={currentUser} onClose={() => {}} onChat={contact.openChat} onLoginNeeded={() => {}} />;
  }
  const view = render(<Harness />);
  await view.findByRole('button', { name: '登录后发私信' });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '登录后发私信' })));
  await act(async () => finishLogin());
  assert.deepEqual(opened, [profile.id]);
});

test('profile contact stays disabled while the shared conversation opener is pending', async t => {
  t.mock.method(api, 'getUserPublicProfile', async () => profile);
  let finishOpening!: () => void;
  const pending = new Promise<void>(resolve => { finishOpening = resolve; });
  let opened = 0;
  function Harness() {
    const contact = useContactIntent({ user, onLoginNeeded() {}, onOpen: () => { opened += 1; return pending; } });
    return <UserProfileModal userId={profile.id} currentUser={user} onClose={() => {}} onChat={contact.openChat} />;
  }
  const view = render(<Harness />);
  fireEvent.click(await view.findByRole('button', { name: '发私信', exact: true }));
  const opening = view.getByRole('button', { name: '正在打开聊天…', exact: true }) as HTMLButtonElement;
  assert.equal(opening.disabled, true);
  await act(async () => { fireEvent.click(opening); fireEvent.click(opening); });
  assert.equal(opened, 1);
  assert.equal((view.getByRole('button', { name: '正在打开聊天…', exact: true }) as HTMLButtonElement).disabled, true);
  await act(async () => finishOpening());
  assert.equal((view.getByRole('button', { name: '发私信', exact: true }) as HTMLButtonElement).disabled, false);
  assert.equal(opened, 1);
});

test('temporary profile failures offer retry and hide contact actions until recovery', async t => {
  let attempts = 0;
  t.mock.method(api, 'getUserPublicProfile', async () => {
    if (++attempts === 1) throw { status: 503, error: 'Fixture outage' };
    return profile;
  });
  const view = render(<UserProfileModal userId={profile.id} currentUser={user} onClose={() => {}} onChat={() => {}} />);
  await view.findByText('资料加载失败，请稍后重试。');
  assert.equal(view.queryByRole('button', { name: '发私信', exact: true }), null);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '重新加载' })));
  assert.equal(attempts, 2);
  assert.ok(view.getByRole('button', { name: '发私信', exact: true }));
  assert.equal(view.queryByRole('alert'), null);
});

test('missing profiles show unavailable state without inviting a network retry', async t => {
  t.mock.method(api, 'getUserPublicProfile', async () => { throw { status: 404 }; });
  const view = render(<UserProfileModal userId="missing" currentUser={user} onClose={() => {}} onChat={() => {}} />);
  await view.findByText('无法查看该用户资料');
  assert.equal(view.queryByRole('button', { name: '重新加载' }), null);
  assert.equal(view.queryByRole('button', { name: '发私信', exact: true }), null);
});
