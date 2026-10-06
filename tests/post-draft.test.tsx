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
  fireEvent.click(view.getByRole('button', { name: /发布需求/ }));
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
  const view = mount({ defaultType: 'client', initialIntent: '这周末需要找搬家公司', onClose: () => { closes += 1; } });
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
  const oldPost = { ...snapshot().form, type: 'provider', id: 'existing-post', authorId: user.id, author: { nickname: user.nickname },
    imageUrls: [], createdAt: 1, likesCount: 0, hasLiked: false, commentsCount: 0 } as PostData;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(path, '/posts/existing-post');
    assert.equal(options.method, 'PUT');
    assert.equal(JSON.parse(String(options.body)).type, 'provider', 'editing retains the real post type despite an opposite entry default');
    return oldPost;
  });
  const view = mount({ mode: 'edit', editingPost: oldPost, defaultType: 'client' });
  assert.equal(view.queryByRole('dialog', { name: '恢复发布草稿' }), null);
  fireEvent.change(view.getByRole('textbox', { name: '帖子标题' }), { target: { value: '只修改已有帖子的标题' } });
  fireEvent.click(view.getByRole('button', { name: '下一步' }));
  await act(async () => fireEvent.click(view.getByRole('button', { name: '保存修改' })));
  assert.deepEqual(readPostDraft(user.id), original);
});

test('a published service has an explicit next step into its own availability, never an automatic booking', async t => {
  const draft = snapshot();
  draft.form = { ...draft.form, type: 'provider', category: '清洁', title: '周末提供居家清洁服务', description: '在中半岛提供居家清洁，可先沟通范围与工具。' };
  draft.hadPhotos = false;
  savePostDraft(user.id, draft);
  const paths: string[] = [];
  let managed = '', closed = false;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => { paths.push(path); assert.equal(JSON.parse(String(options.body)).type, 'provider'); return { id: 'cleaning-published' }; });
  const view = mount({ defaultType: 'client', onManageAvailability: postId => { assert.equal(closed, true); managed = postId; }, onClose: () => { closed = true; } });
  fireEvent.click(view.getByRole('button', { name: '继续之前的草稿' }));
  fireEvent.click(view.getByRole('button', { name: '下一步' }));
  await act(async () => fireEvent.click(view.getByRole('button', { name: '确认发布' })));
  assert.equal(managed, '');
  assert.deepEqual(paths, ['/posts']);
  fireEvent.click(view.getByRole('button', { name: '设置可预约时段' }));
  assert.equal(managed, 'cleaning-published');
  assert.deepEqual(paths, ['/posts']);
});

test('blocked storage is reported honestly instead of claiming the draft is saved', (t) => {
  t.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('Storage unavailable'); });
  const view = mount({ defaultType: 'client', initialIntent: '这周需要找家庭清洁服务' });
  assert.match(view.getByRole('status').textContent!, /未能保存草稿/);
});

test('a generic empty entry requires a deliberate type and never persists a default demand draft', () => {
  const view = mount({ initialIntent: '这段未确认的 BayBay 输入不能确定供需类型' });
  assert.equal(view.getByRole('button', { name: '下一步' }).hasAttribute('disabled'), true);
  assert.equal(view.getByRole('button', { name: /发布需求/ }).getAttribute('aria-pressed'), 'false');
  assert.equal(view.getByRole('button', { name: /提供资源/ }).getAttribute('aria-pressed'), 'false');
  assert.equal(readPostDraft(user.id), null);
  view.unmount();
  const again = mount();
  assert.equal(again.queryByRole('dialog', { name: '恢复发布草稿' }) === null, true);
  assert.equal(again.getByRole('button', { name: '下一步' }).hasAttribute('disabled'), true);
});

test('both deliberate types survive category selection and opposite AI suggestions into the real submit payload', async t => {
  for (const type of ['provider', 'client'] as const) await t.test(type, async t => {
    const payloads: Record<string, unknown>[] = [];
    t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (path === '/ai/post-assist') {
        assert.equal(body.type, type);
        return { ok: true, draft: { title: '测试邻里二手台灯', description: '这是用于隔离测试的虚构台灯，交易时间和地点另行沟通。', type: type === 'provider' ? 'client' : 'provider', category: 'used', budget: '$30', quickTags: [] } };
      }
      assert.equal(path, '/posts'); assert.equal(options.method, 'POST'); payloads.push(body); return { id: 'type-fixture' };
    });
    const view = mount();
    fireEvent.click(view.getByRole('button', { name: type === 'provider' ? /提供资源/ : /发布需求/ }));
    fireEvent.click(view.getByRole('button', { name: '闲置', exact: true }));
    fireEvent.click(view.getByRole('button', { name: '下一步' }));
    fireEvent.change(view.getByRole('textbox', { name: '告诉 BayBay 你想发布的内容' }), { target: { value: '请整理这条虚构的台灯信息。' } });
    await act(async () => fireEvent.click(view.getByRole('button', { name: '帮我整理', exact: true })));
    fireEvent.click(view.getByRole('button', { name: '应用到表单' }));
    assert.equal(readPostDraft(user.id)?.form.type, type);
    fireEvent.click(view.getByRole('button', { name: '下一步' }));
    await act(async () => fireEvent.click(view.getByRole('button', { name: '确认发布' })));
    assert.equal(payloads.length, 1); assert.equal(payloads[0].type, type); assert.equal(payloads[0].category, '闲置');
    cleanup(); localStorage.clear();
  });
});

test('explicit supply and demand entries proceed directly with their intended type and category', () => {
  for (const type of ['provider', 'client'] as const) {
    const view = mount({ defaultType: type, defaultCategory: '闲置' });
    assert.ok(view.getByRole('textbox', { name: '帖子标题' }));
    assert.equal(readPostDraft(user.id)?.form.type, type);
    assert.equal(readPostDraft(user.id)?.form.category, '闲置');
    cleanup(); localStorage.clear();
  }
});
