import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { PostData, UserData } from '../src/lib/types';
import { readPostDraft, savePostDraft, type PostDraft } from '../src/lib/postDraft';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { CreatePostModal } = await import('../src/features/posts/CreatePostModal');
const { api } = await import('../src/lib/api');
const { defaultContactPreference } = await import('../src/components/ContactPreferenceForm');
const user = { id: 'draft-owner', nickname: '测试邻居', token: 'test-only-token' } as UserData;
const snapshot = (): PostDraft => ({ version: 1, updatedAt: Date.now(), step: 2, aiIntent: '我需要在中半岛找房',
  form: { title: '中半岛寻找一间房', description: '希望靠近公共交通，入住时间和租金可以进一步沟通。', category: '租屋',
    city: '中半岛', type: 'client', budget: '$1800/月', timeInfo: '十月入住', contactInfo: '' },
  contactPreference: defaultContactPreference(), defaultCoverUrl: null, hadPhotos: true });
const mount = (props: Partial<React.ComponentProps<typeof CreatePostModal>> = {}) => render(
  <CreatePostModal user={user} onClose={() => {}} onCreated={() => {}} showToast={() => {}} {...props} />,
);
afterEach(() => { cleanup(); localStorage.clear(); });

test('new posts save text by account, recover the selected form and disclose omitted photos', () => {
  const view = mount();
  fireEvent.click(view.getByRole('button', { name: '下一步' }));
  fireEvent.change(view.getByRole('textbox', { name: '帖子标题' }), { target: { value: '中半岛寻找一间房' } });
  fireEvent.change(view.getByRole('textbox', { name: '详细内容' }), { target: { value: snapshot().form.description } });
  const saved = readPostDraft(user.id);
  assert.equal(saved?.form.title, '中半岛寻找一间房');
  assert.equal(readPostDraft('different-account'), null);
  assert.match(view.getByRole('status').textContent!, /已自动保存/);
  view.unmount();

  const withPhotos = { ...saved!, hadPhotos: true, uploadedImages: ['data:image/png;base64,NOT_SAVED'] };
  savePostDraft(user.id, withPhotos);
  assert.doesNotMatch(localStorage.getItem(localStorage.key(0)!)!, /NOT_SAVED|uploadedImages/);
  const reopened = mount();
  assert.ok(reopened.getByRole('dialog', { name: '恢复发布草稿' }));
  fireEvent.click(reopened.getByRole('button', { name: '继续之前的草稿' }));
  assert.equal((reopened.getByRole('textbox', { name: '帖子标题' }) as HTMLInputElement).value, saved?.form.title);
  assert.ok(reopened.getByText(/这份草稿之前有照片，请重新添加/));
});

test('discarding the old draft preserves a new BayBay intent, and explicit discard clears it', () => {
  savePostDraft(user.id, snapshot());
  let closes = 0;
  const view = mount({ initialIntent: '这周末需要找搬家公司', onClose: () => { closes += 1; } });
  fireEvent.click(view.getByRole('button', { name: '丢弃旧草稿，重新开始' }));
  assert.equal((view.getByRole('textbox', { name: '帖子标题' }) as HTMLInputElement).value, '');
  assert.equal((view.getByRole('textbox', { name: '告诉 BayBay 你想发布的内容' }) as HTMLTextAreaElement).value, '这周末需要找搬家公司');
  assert.equal(readPostDraft(user.id)?.aiIntent, '这周末需要找搬家公司');
  fireEvent.click(view.getByRole('button', { name: '丢弃草稿并关闭' }));
  assert.equal(readPostDraft(user.id), null);
  assert.equal(closes, 1);
});

test('failed publication retains the draft; only a successful response clears it', async (t) => {
  const draft = snapshot();
  draft.hadPhotos = false;
  savePostDraft(user.id, draft);
  let resolveSave: ((value: unknown) => void) | undefined;
  let requests = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(path, '/posts');
    assert.equal(options.method, 'POST');
    requests += 1;
    if (requests === 1) throw new Error('Test network failure');
    return new Promise(resolve => { resolveSave = resolve; });
  });
  const view = mount();
  fireEvent.click(view.getByRole('button', { name: '继续之前的草稿' }));
  fireEvent.click(view.getByRole('button', { name: '下一步' }));
  await act(async () => fireEvent.click(view.getByRole('button', { name: '确认发布' })));
  assert.ok(readPostDraft(user.id), 'a rejected request must preserve the recoverable text');
  fireEvent.click(view.getByRole('button', { name: '确认发布' }));
  assert.ok(readPostDraft(user.id), 'a pending request must not claim publication or discard text');
  await act(async () => { assert.ok(resolveSave); resolveSave({ id: 'created-test-post' }); });
  assert.ok(view.getByRole('heading', { name: '发布成功' }));
  assert.equal(readPostDraft(user.id), null);
});

test('editing an existing post neither restores nor changes a new-post draft', async (t) => {
  savePostDraft(user.id, snapshot());
  const original = readPostDraft(user.id);
  const oldPost = { ...snapshot().form, id: 'existing-post', authorId: user.id, author: { nickname: user.nickname },
    imageUrls: [], createdAt: 1, likesCount: 0, hasLiked: false, commentsCount: 0 } as PostData;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(path, '/posts/existing-post');
    assert.equal(options.method, 'PUT');
    return oldPost;
  });
  const view = mount({ mode: 'edit', editingPost: oldPost });
  assert.equal(view.queryByRole('dialog', { name: '恢复发布草稿' }), null);
  fireEvent.change(view.getByRole('textbox', { name: '帖子标题' }), { target: { value: '只修改已有帖子的标题' } });
  fireEvent.click(view.getByRole('button', { name: '下一步' }));
  await act(async () => fireEvent.click(view.getByRole('button', { name: '保存修改' })));
  assert.deepEqual(readPostDraft(user.id), original);
});

test('blocked storage is reported honestly instead of claiming the draft is saved', (t) => {
  t.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('Storage unavailable'); });
  const view = mount({ initialIntent: '这周需要找家庭清洁服务' });
  assert.match(view.getByRole('status').textContent!, /未能保存草稿/);
});
