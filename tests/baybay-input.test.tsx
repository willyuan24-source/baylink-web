import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};

const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayPostAssist } = await import('../src/components/BayBayPostAssist');
afterEach(() => cleanup());

test('BayBay waits for a deliberate Enter after Chinese composition before sending', async (t) => {
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    requests.push(init);
    return Response.json({ ok: true, answer: '模拟建议，不调用真实服务。' });
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={() => {}}
    onNavigate={() => {}} onCreatePostClick={() => {}} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  fireEvent.change(input, { target: { value: '刚来湾区租房要注意什么' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  assert.equal(requests.length, 0, 'confirming a Chinese candidate must not submit');
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: false });
  assert.equal(requests.length, 0, 'the IME key-code fallback must also be ignored');
  fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
  await view.findByText('模拟建议，不调用真实服务。');
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(String(requests[0].body)).message, '刚来湾区租房要注意什么');
});

test('BayBay keeps the answered question as the post intent and renders at most three real matching links', async (t) => {
  const original = '我想在中半岛找一间房，预算每月一千八';
  const opened: string[] = [];
  const creations: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, answer: '先确认入住时间和所需条件。', degraded: true,
    matchNote: '按租屋分类查找，尚未按价格筛选。',
    suggestedActions: [{ label: '整理成求租帖', type: 'postAssist', postType: 'client', category: 'rent' }],
    matchingPosts: [
      { id: 'actual-1', title: '实际房源一', city: '中半岛', budget: '$1800/月', createdAt: 1, confirmedAt: Date.now() },
      { id: 'actual-1', title: '重复信息不展示', city: '', budget: '', createdAt: 1 },
      { id: 'actual-2', title: '实际房源二', city: '东湾', budget: '$1500/月', createdAt: 2 },
      { id: 'actual-3', title: '实际房源三', city: '南湾', budget: '', createdAt: 3, status: 'closed' },
      { id: 'actual-4', title: '第四条无需展示', city: '南湾', budget: '', createdAt: 4 },
    ] }));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={() => {}}
    onNavigate={path => { opened.push(path); }} onCreatePostClick={options => { creations.push(options); }} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  fireEvent.change(input, { target: { value: original } });
  fireEvent.click(view.getByRole('button', { name: '问一下' }));
  await view.findByText('先确认入住时间和所需条件。');
  assert.ok(view.getByText('参考指引'));
  assert.match(view.getByRole('status').textContent!, /AI 服务暂时不可用/);
  assert.ok(view.getByText('按租屋分类查找，尚未按价格筛选。'));
  const links = view.getAllByRole('link');
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['/posts/actual-1', '/posts/actual-2', '/posts/actual-3']);
  assert.ok(view.getByText('今天确认有效 · 查看实际帖子'));
  assert.ok(view.getByText('待确认有效 · 查看实际帖子'));
  assert.ok(view.getByText('已结束 · 查看实际帖子'));
  fireEvent.click(links[0]);
  assert.deepEqual(opened, ['/posts/actual-1']);
  fireEvent.change(input, { target: { value: '尚未提交的另一个问题' } });
  fireEvent.click(view.getByRole('button', { name: '整理成求租帖' }));
  assert.deepEqual(creations, [{ postType: 'client', category: '租屋', initialIntent: original }]);
});

test('BayBay post intent is editable and does not generate until the user explicitly asks', async () => {
  const requests: unknown[] = [];
  const Harness = () => {
    const [intent, setIntent] = React.useState('我需要找家庭清洁');
    return <BayBayPostAssist postType="client" user={{ token: 'test-only' }} intent={intent} intentFromQuestion
      onIntentChange={setIntent} showToast={() => {}} onApply={() => {}} requestAiAssist={async body => {
        requests.push(body);
        return { ok: false, error: 'Test response; no remote service used.' };
      }} />;
  };
  const view = render(<Harness />);
  assert.equal((view.getByRole('textbox', { name: '告诉 BayBay 你想发布的内容' }) as HTMLTextAreaElement).value, '我需要找家庭清洁');
  assert.ok(view.getByText(/请确认要公开的需求/));
  assert.equal(requests.length, 0);
  fireEvent.change(view.getByRole('textbox', { name: '告诉 BayBay 你想发布的内容' }), { target: { value: '周末在东湾找两小时家庭清洁' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '帮我整理' })));
  assert.equal(requests.length, 1);
  assert.equal((requests[0] as { intent: string }).intent, '周末在东湾找两小时家庭清洁');
});
