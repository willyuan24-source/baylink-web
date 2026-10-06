import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ReportModal } = await import('../src/components/ReportModal');
const { AdminReportsView } = await import('../src/features/admin/AdminViews');
const { PostDetailContactPanel } = await import('../src/components/PostDetailContactPanel');
const { getGuideBySlug } = await import('../src/data/guides');
const { api } = await import('../src/lib/api');
afterEach(() => { cleanup(); localStorage.clear(); });

test('message reporting explains the selected-message boundary and submits only its scoped ID and chosen reason', async t => {
  let body: Record<string, unknown> | undefined, closed = false;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(path, '/reports'); assert.equal(options.method, 'POST'); body = JSON.parse(String(options.body)); return { success: true, id: 'reported' };
  });
  const view = render(<ReportModal targetType="message" targetId="old-timestamp" conversationId="actual-thread" onClose={() => { closed = true; }}
    onSubmit={async (reason, detail) => { await api.submitReport({ targetType: 'message', targetId: 'old-timestamp', conversationId: 'actual-thread', reason, detail }); }} />);
  assert.ok(view.getByRole('dialog', { name: '举报私信' }));
  assert.ok(view.getByText('选中消息交由管理员审核；不会上传整段会话或联系方式卡。'));
  fireEvent.click(view.getByRole('radio', { name: '诈骗 / 可疑交易' }));
  fireEvent.change(view.getByPlaceholderText('补充说明（可选）'), { target: { value: '  请求核验这条可疑付款要求  ' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '提交举报' })));
  assert.deepEqual(body, { targetType: 'message', targetId: 'old-timestamp', conversationId: 'actual-thread', reason: 'scam', detail: '请求核验这条可疑付款要求' });
  assert.equal(closed, true);
});

test('admin message reports display selected plain text and omitted attachment notices, without exposing private attachment fields', async t => {
  const filters: string[] = [];
  const base = { reporter: null, targetType: 'message', targetId: 'old-timestamp', reason: 'scam', detail: '', status: 'open', createdAt: Date.now(),
    targetUser: { id: 'real-sender', nickname: '真实发送者' }, targetPost: null };
  t.mock.method(api, 'getAdminReports', async (_status: string, type: string) => { filters.push(type); return { reports: [
    { ...base, id: 'plain', evidence: { messageId: 'old-timestamp', conversationId: 'actual-thread', type: 'text', text: '<script>Selected plain-text message</script>' } },
    { ...base, id: 'attachment', evidence: { messageId: 'second', conversationId: 'actual-thread', type: 'contact_card', attachmentOmitted: true,
      contactCard: { value: 'PRIVATE_CONTACT' }, replyTo: { content: 'PRIVATE_REPLY' }, imageUrl: 'PRIVATE_IMAGE' } },
  ] }; });
  const view = render(<AdminReportsView onBack={() => {}} showToast={() => {}} />);
  await act(async () => {});
  assert.equal(view.getAllByText('· 私信举报').length, 2);
  assert.ok(view.getByText('<script>Selected plain-text message</script>'));
  assert.ok(view.getByText('联系方式与附件已省略；未上传整段会话。'));
  assert.equal(view.container.querySelectorAll('script').length, 0);
  assert.doesNotMatch(view.container.textContent || '', /PRIVATE_CONTACT|PRIVATE_REPLY|PRIVATE_IMAGE|帖子作者/);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '私信', exact: true })));
  assert.deepEqual(filters, ['all', 'message']);
});

test('contact panels link the actual rental, secondhand and service categories to published safety guides before contacting', () => {
  for (const [category, slug, label] of [['租屋', 'bay-area-rental-scam-guide', '租房防骗指南'], ['闲置', 'bay-area-used-trading-safety-guide', '二手交易安全指南'], ['清洁', 'local-service-safety-guide', '本地服务安全指南']]) {
    assert.ok(getGuideBySlug(slug), `Safety destination must exist: ${slug}`);
    const view = render(<MemoryRouter><PostDetailContactPanel post={{ id: 'public', authorId: 'owner', category, title: 'Public listing' }}
      currentUser={null} isOwner={false} authorName="Owner" section="contact" onLoginNeeded={() => {}} onOpenChat={() => {}}
      requestContact={async () => ({ status: 'dm_first' })} onAskBayBay={() => {}} showToast={() => {}} /></MemoryRouter>);
    assert.equal(view.getByRole('link', { name: `${label} ↗` }).getAttribute('href'), `/guides/${slug}`);
    assert.ok(view.getByRole('button', { name: '私信联系' }));
    cleanup();
  }
});
