import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { UserData } from '../src/lib/types';
import { useContactIntent, type ContactIntent, type ContactPost } from '../src/app/useContactIntent';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { PostDetailContactPanel } = await import('../src/components/PostDetailContactPanel');
afterEach(() => cleanup());
const user = { id: 'requester', token: 'test-token' } as UserData;
const post: ContactPost = { id: 'post-42', title: '中半岛寻找搬家帮手', authorId: 'author', author: { nickname: '邻居' } };

const ContactHarness = ({ onOpen, onLoginNeeded, selectedPost = post, currentUser = null }: {
  onOpen: (intent: ContactIntent, authenticatedUser: UserData) => void; onLoginNeeded: () => void;
  selectedPost?: ContactPost; currentUser?: UserData | null;
}) => {
  const contact = useContactIntent({ user: currentUser, onOpen, onLoginNeeded });
  return <><button onClick={() => contact.requestPostContact(selectedPost)}>私信</button>
    <button onClick={() => { contact.completeContactLogin(user); contact.cancelPendingContact(); }}>完成登录</button>
    <button onClick={contact.cancelPendingContact}>取消登录</button></>;
};

test('an anonymous contact click resumes the exact post once after login; cancellation does not resume it', () => {
  const opened: ContactIntent[] = [];
  let logins = 0;
  const view = render(<ContactHarness onOpen={intent => { opened.push(intent); }} onLoginNeeded={() => { logins += 1; }} />);
  fireEvent.click(view.getByText('私信'));
  assert.equal(logins, 1);
  assert.deepEqual(opened, []);
  fireEvent.click(view.getByText('完成登录'));
  assert.deepEqual(opened, [{ targetId: 'author', nickname: '邻居', postId: 'post-42', postTitle: post.title }]);
  fireEvent.click(view.getByText('完成登录'));
  assert.equal(opened.length, 1);
  fireEvent.click(view.getByText('私信'));
  fireEvent.click(view.getByText('取消登录'));
  fireEvent.click(view.getByText('完成登录'));
  assert.equal(opened.length, 1);
});

test('signed-in contact opens directly while own or closed posts never initiate contact', () => {
  const opened: ContactIntent[] = [];
  const props = { currentUser: user, onOpen: (intent: ContactIntent) => { opened.push(intent); }, onLoginNeeded: () => assert.fail('already authenticated') };
  const view = render(<ContactHarness {...props} />);
  fireEvent.click(view.getByText('私信'));
  assert.equal(opened[0].postId, post.id);
  view.rerender(<ContactHarness {...props} selectedPost={{ ...post, authorId: user.id }} />);
  fireEvent.click(view.getByText('私信'));
  view.rerender(<ContactHarness {...props} selectedPost={{ ...post, status: 'closed' }} />);
  fireEvent.click(view.getByText('私信'));
  assert.equal(opened.length, 1);
});

test('detail separates login for private chat from a contact-info request and never auto-submits either', () => {
  let contactLogins = 0;
  let ordinaryLogins = 0;
  const view = render(<PostDetailContactPanel post={{ id: post.id, authorId: post.authorId, title: post.title, category: '搬家', contactPreference: { mode: 'manual_approve' } }}
    section="contact" currentUser={null} isOwner={false} authorName="邻居" showToast={() => {}} onAskBayBay={() => {}}
    onLoginNeeded={() => { ordinaryLogins += 1; }} onContactLoginNeeded={() => { contactLogins += 1; }}
    onOpenChat={() => assert.fail('anonymous chat must wait for login')}
    requestContact={async () => { assert.fail('contact sharing must wait for an explicit authenticated request'); }} />);
  fireEvent.click(view.getByRole('button', { name: '私信联系' }));
  assert.equal(contactLogins, 1);
  assert.equal(ordinaryLogins, 0);
  fireEvent.click(view.getByRole('button', { name: '请求联系方式' }));
  assert.equal(contactLogins, 1);
  assert.equal(ordinaryLogins, 1);
});
