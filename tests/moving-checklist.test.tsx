import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { emptyMovingChecklist, MAX_CUSTOM_MOVING_TASKS, MOVING_CHECKLIST_GROUPS, movingChecklistKey,
  movingChecklistText, parseMovingChecklist, readMovingChecklist, saveMovingChecklist } from '../src/lib/moving-checklist';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// The tool sees only this in-memory clipboard double, never an OS or browser clipboard.
const clipboard: { writeText: (text: string) => Promise<void> } = { writeText: async () => { throw new Error('Unconfigured test clipboard'); } };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { MovingChecklistTool } = await import('../src/components/tools/MovingChecklistTool');
const firstTask = MOVING_CHECKLIST_GROUPS[0].items[0];
const markup = (scope = 'user:one', onToast: (message: string) => void = () => {}) => <MemoryRouter><MovingChecklistTool storageScope={scope} onToast={onToast} /></MemoryRouter>;
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

test('the checklist does not write on load and restores checked and custom tasks after remount', () => {
  const view = render(markup());
  assert.equal(dom.window.localStorage.getItem(movingChecklistKey('user:one')), null);
  assert.equal(view.getAllByRole('checkbox').length, 15);
  fireEvent.click(view.getByRole('checkbox', { name: firstTask.label }));
  fireEvent.change(view.getByRole('textbox', { name: '新待办' }), { target: { value: '  预留第一晚的床品  ' } });
  fireEvent.click(view.getByRole('button', { name: '添加待办' }));
  fireEvent.click(view.getByRole('checkbox', { name: '预留第一晚的床品' }));
  assert.match(view.getByRole('status').textContent!, /已完成 2 \/ 16 项/);
  const stored = readMovingChecklist('user:one');
  assert.deepEqual(stored.state.completed, [firstTask.id]);
  assert.equal(stored.state.custom[0].label, '预留第一晚的床品');
  assert.equal(stored.state.custom[0].done, true);
  view.unmount();
  const restored = render(markup());
  assert.equal((restored.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, true);
  assert.equal((restored.getByRole('checkbox', { name: '预留第一晚的床品' }) as HTMLInputElement).checked, true);
});

test('account and guest scopes remain separate even when the mounted tool changes accounts', () => {
  const view = render(markup());
  fireEvent.click(view.getByRole('checkbox', { name: firstTask.label }));
  view.rerender(markup('user:two'));
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, false);
  assert.equal(dom.window.localStorage.getItem(movingChecklistKey('user:two')), null);
  view.rerender(markup('guest'));
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, false);
  view.rerender(markup('user:one'));
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, true);
  assert.notEqual(movingChecklistKey('user:one'), movingChecklistKey('user%3Aone'));
});

test('corrupt or unknown-version storage remains untouched until an in-place reset is confirmed', () => {
  const raw = '{"version":99,"custom":["older data"]}';
  dom.window.localStorage.setItem(movingChecklistKey('user:one'), raw);
  const view = render(markup());
  assert.match(view.getByRole('alert').textContent!, /原记录尚未修改/);
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }).closest('fieldset') as HTMLFieldSetElement).disabled, true);
  assert.equal(dom.window.localStorage.getItem(movingChecklistKey('user:one')), raw);
  fireEvent.click(view.getByRole('button', { name: '重置清单' }));
  fireEvent.click(view.getByRole('button', { name: '保留清单' }));
  assert.equal(dom.window.localStorage.getItem(movingChecklistKey('user:one')), raw);
  fireEvent.click(view.getByRole('button', { name: '重置清单' }));
  fireEvent.click(view.getByRole('button', { name: '确认重置' }));
  assert.deepEqual(readMovingChecklist('user:one').state, emptyMovingChecklist());
  assert.equal(view.queryByRole('alert'), null);
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }).closest('fieldset') as HTMLFieldSetElement).disabled, false);
});

test('reset clears custom tasks and completion only after confirmation', () => {
  saveMovingChecklist('user:one', { version: 1, completed: [firstTask.id], custom: [{ id: 'custom-example', label: '搬走门口纸箱', done: true }] });
  const view = render(markup());
  fireEvent.click(view.getByRole('button', { name: '重置清单' }));
  assert.equal(readMovingChecklist('user:one').state.custom.length, 1);
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, true);
  fireEvent.click(view.getByRole('button', { name: '确认重置' }));
  assert.equal(view.queryByRole('checkbox', { name: '搬走门口纸箱' }), null);
  assert.match(view.getByRole('status').textContent!, /已完成 0 \/ 15 项/);
  assert.deepEqual(readMovingChecklist('user:one').state, emptyMovingChecklist());
});

test('custom labels and item count are validated, and deleting an item permits another addition', () => {
  const custom = Array.from({ length: MAX_CUSTOM_MOVING_TASKS }, (_, index) => ({ id: `custom-${index}`, label: `自定义事项 ${index}`, done: false }));
  saveMovingChecklist('user:one', { version: 1, completed: [], custom });
  const view = render(markup());
  const input = view.getByRole('textbox', { name: '新待办' });
  fireEvent.change(input, { target: { value: 'x'.repeat(81) } });
  fireEvent.click(view.getByRole('button', { name: '添加待办' }));
  assert.match(view.getByRole('alert').textContent!, /最多 80/);
  fireEvent.change(input, { target: { value: '一条新增事项' } });
  fireEvent.click(view.getByRole('button', { name: '添加待办' }));
  assert.match(view.getByRole('alert').textContent!, /已满 20/);
  fireEvent.click(view.getByRole('button', { name: '删除待办：自定义事项 0' }));
  fireEvent.click(view.getByRole('button', { name: '添加待办' }));
  assert.ok(view.getByRole('checkbox', { name: '一条新增事项' }));
  assert.equal(readMovingChecklist('user:one').state.custom.length, 20);
});

test('storage failure keeps in-page work, discloses failed persistence, and cannot falsely confirm reset', (t) => {
  const view = render(markup());
  t.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('Quota denied'); });
  fireEvent.click(view.getByRole('checkbox', { name: firstTask.label }));
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, true);
  assert.match(view.getByRole('alert').textContent!, /未能保存/);
  assert.doesNotMatch(view.getByRole('status').textContent!, /已保存到此浏览器/);
  fireEvent.click(view.getByRole('button', { name: '重置清单' }));
  fireEvent.click(view.getByRole('button', { name: '确认重置' }));
  assert.match(view.getByRole('alert').textContent!, /重置未保存/);
  assert.equal((view.getByRole('checkbox', { name: firstTask.label }) as HTMLInputElement).checked, true);
});

test('copy waits for success and offers the exact same text for manual copying after rejection', async (t) => {
  const writes: string[] = [];
  let resolveCopy: (() => void) | undefined;
  t.mock.method(clipboard, 'writeText', (text: string) => { writes.push(text); return new Promise<void>(resolve => { resolveCopy = resolve; }); });
  const view = render(markup());
  fireEvent.click(view.getByRole('checkbox', { name: firstTask.label }));
  const expected = movingChecklistText(readMovingChecklist('user:one').state);
  fireEvent.click(view.getByRole('button', { name: '复制清单' }));
  assert.deepEqual(writes, [expected]);
  assert.ok(view.getByRole('button', { name: '正在复制…' }));
  assert.equal(view.queryByRole('button', { name: '已复制清单' }), null);
  await act(async () => { assert.ok(resolveCopy); resolveCopy(); });
  assert.ok(view.getByRole('button', { name: '已复制清单' }));
  t.mock.method(clipboard, 'writeText', async (text: string) => { writes.push(text); throw new Error('Clipboard permission denied'); });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '已复制清单' })));
  assert.deepEqual(writes, [expected, expected]);
  assert.equal((view.getByRole('textbox', { name: '可手动复制的搬家清单' }) as HTMLTextAreaElement).value, expected);
  assert.ok(view.getByText('浏览器未允许复制，请选中下方文本手动复制。'));
});

test('invalid stored ids, duplicate entries, wrong booleans, and oversized records are rejected', () => {
  const invalid = [
    '{broken',
    JSON.stringify({ ...emptyMovingChecklist(), completed: ['unknown-task'] }),
    JSON.stringify({ ...emptyMovingChecklist(), completed: [firstTask.id, firstTask.id] }),
    JSON.stringify({ ...emptyMovingChecklist(), custom: [{ id: 'custom-one', label: '任务', done: 'yes' }] }),
    JSON.stringify({ ...emptyMovingChecklist(), custom: [{ id: 'custom-one', label: 'x'.repeat(81), done: false }] }),
    JSON.stringify({ ...emptyMovingChecklist(), custom: Array.from({ length: 21 }, (_, index) => ({ id: `custom-${index}`, label: '任务', done: false })) }),
  ];
  for (const raw of invalid) assert.ok(parseMovingChecklist(raw).error);
  assert.equal(parseMovingChecklist(null).error, null);
  assert.equal(parseMovingChecklist(JSON.stringify(emptyMovingChecklist())).error, null);
});
