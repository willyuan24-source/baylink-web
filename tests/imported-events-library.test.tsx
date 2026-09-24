import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { EMPTY_EVENT, type ImportedEvent } from '../src/lib/imported-events';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/my-week' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, CustomEvent: dom.window.CustomEvent, FileReader: dom.window.FileReader, IS_REACT_ACT_ENVIRONMENT: true });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { renderHook, render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventImportDialog } = await import('../src/components/EventScreenshotImport');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { api } = await import('../src/lib/api');
const { GUEST_EVENTS_KEY, useImportedEvents } = await import('../src/lib/useImportedEvents');
const originalRequest = api.request;
const session = (id?: string) => id ? localStorage.setItem('currentUser', JSON.stringify({ id, token: `${id}-test-token` })) : localStorage.removeItem('currentUser');
const draft = { ...EMPTY_EVENT, title: 'Private workshop', date: '2026-10-03', venue: 'Community hall' };
const event = (id = 'private-test', title = draft.title): ImportedEvent => ({ id, ...draft, title });
const snapshot = (events: ImportedEvent[] = [], revision = 0) => ({ events: structuredClone(events), revision });
const defer = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(async context => { localStorage.clear(); await setLocale('zh-Hans', false); context.mock.method(globalThis, 'fetch', async () => new Response('{}')); });
afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); });

test('guest events remain local; storage quota failure preserves records and allows a successful retry', async context => {
  api.request = async () => { throw new Error('A guest must never call an account API'); };
  const { result } = renderHook(() => useImportedEvents());
  await act(async () => {});
  let saved: ImportedEvent | undefined;
  await act(async () => { saved = await result.current.save(draft); });
  assert.ok(saved);
  assert.equal(result.current.events.length, 1);
  assert.equal(JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY)!).revision, 1);
  const quota = context.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('quota'); });
  await act(async () => { saved = await result.current.save({ ...draft, title: 'Second event' }); });
  assert.equal(saved, undefined);
  assert.equal(result.current.events.length, 1);
  assert.match(result.current.error, /保存失败/);
  quota.mock.restore();
  await act(async () => { saved = await result.current.save({ ...draft, title: 'Second event' }); });
  assert.ok(saved);
  assert.equal(result.current.events.length, 2);
  assert.equal(JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY)!).events.length, 2);
});

test('damaged guest data is preserved and blocks saves until the stored record is recoverable', async () => {
  const damaged = '{broken';
  localStorage.setItem(GUEST_EVENTS_KEY, damaged);
  const { result } = renderHook(() => useImportedEvents());
  await act(async () => {});
  assert.match(result.current.error, /无法读取/);
  await act(async () => { assert.equal(await result.current.save(draft), undefined); });
  assert.equal(localStorage.getItem(GUEST_EVENTS_KEY), damaged, 'never replace an unreadable calendar with an empty save');
  localStorage.setItem(GUEST_EVENTS_KEY, JSON.stringify(snapshot([event()], 3)));
  await act(async () => { await result.current.refresh(); });
  assert.equal(result.current.events[0].id, 'private-test');
  assert.equal(result.current.error, '');
});

test('a revision conflict reloads the newer calendar and a retry preserves both writers', async () => {
  session('alice');
  let remote = snapshot([event('existing', 'Existing event')], 1);
  let writes = 0;
  api.request = async (_path, options) => {
    if (options?.method !== 'PUT') return structuredClone(remote);
    const body = JSON.parse(String(options.body));
    writes++;
    if (body.revision !== remote.revision) throw { status: 409 };
    remote = snapshot(body.events, remote.revision + 1);
    return structuredClone(remote);
  };
  const { result } = renderHook(() => useImportedEvents('alice'));
  await act(async () => {});
  remote = snapshot([...remote.events, event('other-device', 'Other device')], 2);
  let saved: ImportedEvent | undefined;
  await act(async () => { saved = await result.current.save(draft); });
  assert.equal(saved, undefined);
  assert.match(result.current.error, /别处更新/);
  assert.equal(result.current.events.length, 2);
  await act(async () => { saved = await result.current.save(draft); });
  assert.ok(saved);
  assert.equal(writes, 2);
  assert.equal(remote.events.length, 3);
  assert.ok(remote.events.some(item => item.id === 'other-device'));
  assert.equal(localStorage.getItem(GUEST_EVENTS_KEY), null, 'signed-in activity details never enter guest storage');
});

test('late account reads and stale save closures cannot expose or write through a different account', async () => {
  session('alice'); const oldRead = defer<ReturnType<typeof snapshot>>(); let reads = 0; let writes = 0;
  api.request = async (_path, options) => {
    if (options?.method === 'PUT') { writes++; return snapshot(); }
    return ++reads === 1 ? oldRead.promise : snapshot([event('bob-only', 'Bob private event')]);
  };
  const { result, rerender } = renderHook(({ id }: { id?: string }) => useImportedEvents(id), { initialProps: { id: 'alice' as string | undefined } });
  const staleSave = result.current.save;
  session('bob'); rerender({ id: 'bob' });
  await act(async () => {});
  await act(async () => { oldRead.resolve(snapshot([event('alice-only', 'Alice private event')])); });
  assert.deepEqual(result.current.events.map(item => item.id), ['bob-only']);
  await act(async () => { assert.equal(await staleSave(draft), undefined); });
  assert.equal(writes, 0);
  session(); rerender({ id: undefined }); await act(async () => {});
  assert.deepEqual(result.current.events, []);
  assert.equal(localStorage.getItem(GUEST_EVENTS_KEY), null);
});

test('same-frame saves share one write lock and a lost response cannot duplicate the saved event', async () => {
  session('alice');
  let remote = snapshot(); const pending = defer<ReturnType<typeof snapshot>>(); let writes = 0;
  api.request = async (_path, options) => {
    if (options?.method !== 'PUT') return structuredClone(remote);
    const body = JSON.parse(String(options.body)); writes++;
    if (body.revision !== remote.revision) throw { status: 409 };
    remote = snapshot(body.events, remote.revision + 1);
    return writes === 1 ? pending.promise : structuredClone(remote);
  };
  const { result } = renderHook(() => useImportedEvents('alice'));
  await act(async () => {});
  let first!: Promise<ImportedEvent | undefined>; let second!: Promise<ImportedEvent | undefined>;
  await act(async () => {
    first = result.current.save(draft); second = result.current.save(draft);
    pending.reject(new Error('Network response lost after server committed'));
    await Promise.all([first, second]);
  });
  assert.equal(writes, 1);
  assert.equal(await first, undefined); assert.equal(await second, undefined);
  await act(async () => { await result.current.save(draft); });
  assert.equal(remote.events.length, 1);
  assert.equal(result.current.events.length, 1);
  await act(async () => { await result.current.save(draft); });
  assert.equal(writes, 2, 'the conflict retry reloads the committed row; a further retry must not duplicate it');
  assert.match(result.current.error, /已在你的日程/);
});

test('switching accounts during a save releases the previous mutation state and ignores its late response', async () => {
  session('alice'); const pending = defer<ReturnType<typeof snapshot>>();
  const nextPending = defer<ReturnType<typeof snapshot>>();
  let writes = 0;
  api.request = async (_path, options) => {
    if (options?.method === 'PUT') { writes++; return writes === 1 ? pending.promise : nextPending.promise; }
    return snapshot([event('bob-existing', 'Existing record')], 1);
  };
  const { result, rerender } = renderHook(({ id }: { id: string }) => useImportedEvents(id), { initialProps: { id: 'alice' } });
  await act(async () => {});
  let previous!: Promise<ImportedEvent | undefined>;
  await act(async () => { previous = result.current.save(draft); });
  assert.equal(result.current.busy, true);
  session('bob'); rerender({ id: 'bob' }); await act(async () => {});
  assert.equal(result.current.busy, false, 'a new account must not inherit the old account saving spinner');
  let next!: Promise<ImportedEvent | undefined>;
  await act(async () => { next = result.current.save({ ...draft, title: 'Bob new event' }); });
  assert.equal(writes, 2, 'the old account request must not retain the new account write lock');
  await act(async () => { pending.resolve(snapshot([event('alice-late', 'Alice private event')], 2)); await previous; });
  assert.equal(await previous, undefined);
  assert.equal(result.current.busy, true, 'the old finally block must not release the new account in-flight write');
  await act(async () => { assert.equal(await result.current.save({ ...draft, title: 'Another Bob event' }), undefined); });
  assert.equal(writes, 2);
  await act(async () => { nextPending.resolve(snapshot([event('bob-new', 'Bob new event')], 2)); await next; });
  assert.ok(await next);
  assert.deepEqual(result.current.events.map(item => item.id), ['bob-new']);
  assert.equal(result.current.busy, false);
});

async function openDialog() {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter><EventImportDialog onClose={() => {}} /></MemoryRouter>); });
  return view;
}
async function chooseScreenshot(view: ReturnType<typeof render>) {
  const file = new dom.window.File(['tiny test image'], 'activity.png', { type: 'image/png' });
  fireEvent.change(view.getByLabelText('选择活动截图'), { target: { files: [file] } });
  await view.findByRole('img', { name: '已选活动截图' });
}

test('manual event entry requires confirmation, preserves the draft after storage failure, and retries successfully', async context => {
  api.request = async () => { throw new Error('Manual guest entry must not submit images or call an account API'); };
  const view = await openDialog();
  fireEvent.click(view.getByRole('button', { name: '手动填写' }));
  const title = view.getByLabelText(/^活动名称/) as HTMLInputElement;
  const date = view.getByLabelText(/活动日期/) as HTMLInputElement;
  const confirm = view.getByRole('checkbox', { name: '我已核对活动名称、日期和地点。' });
  fireEvent.change(title, { target: { value: 'My private workshop' } });
  fireEvent.click(confirm);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存到我的这周' })); });
  assert.match(view.getByRole('alert').textContent || '', /包括年份/);
  assert.equal(localStorage.getItem(GUEST_EVENTS_KEY), null);
  fireEvent.change(date, { target: { value: '2026-10-03' } });
  assert.equal((confirm as HTMLInputElement).checked, false, 'editing an extracted or manual fact requires confirmation again');
  assert.equal((view.getByRole('button', { name: '保存到我的这周' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(confirm);
  const quota = context.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('quota'); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存到我的这周' })); });
  assert.match(view.getByRole('alert').textContent || '', /保存失败/);
  assert.equal(title.value, 'My private workshop');
  assert.equal(date.value, '2026-10-03');
  assert.equal(view.queryByRole('heading', { name: '活动已留好。' }), null);
  quota.mock.restore();
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存到我的这周' })); });
  assert.ok(view.getByRole('heading', { name: '活动已留好。' }));
  const stored = JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY)!);
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].title, 'My private workshop');
});

test('a stopped screenshot response cannot replace a manually edited draft', async () => {
  const pending = defer<{ ok: boolean; draft: typeof draft }>(); let signal: AbortSignal | null | undefined;
  let requests = 0;
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, '/ai/event-extract'); requests++; signal = options?.signal; return pending.promise;
  };
  const view = await openDialog();
  await chooseScreenshot(view);
  fireEvent.click(view.getByRole('button', { name: '识别活动' }));
  assert.equal(requests, 1);
  fireEvent.click(view.getByRole('button', { name: '停止识别' }));
  assert.equal(signal?.aborted, true);
  fireEvent.click(view.getByRole('button', { name: '手动填写' }));
  fireEvent.change(view.getByLabelText(/^活动名称/), { target: { value: 'My carefully edited name' } });
  await act(async () => { pending.resolve({ ok: true, draft: { ...draft, title: 'Late AI title' } }); });
  assert.equal((view.getByLabelText(/^活动名称/) as HTMLInputElement).value, 'My carefully edited name');
  assert.equal(view.queryByDisplayValue('Late AI title'), null);
  assert.equal(localStorage.getItem(GUEST_EVENTS_KEY), null);
});

test('switching reading language cancels recognition and ignores results from the previous language', async () => {
  const pending = defer<{ ok: boolean; draft: typeof draft }>(); let signal: AbortSignal | null | undefined;
  api.request = async (_endpoint, options) => { signal = options?.signal; return pending.promise; };
  const view = await openDialog(); await chooseScreenshot(view);
  fireEvent.click(view.getByRole('button', { name: '识别活动' }));
  await act(async () => { await setLocale('en', false); });
  assert.equal(signal?.aborted, true);
  await act(async () => { pending.resolve({ ok: true, draft: { ...draft, title: '旧语言迟到内容' } }); });
  assert.equal(view.queryByDisplayValue('旧语言迟到内容'), null);
  assert.ok(view.getByRole('button', { name: translateText('识别活动') }));
  assert.equal(localStorage.getItem(GUEST_EVENTS_KEY), null);
});

test('a language change during image preparation releases the controls and ignores the old file read', async context => {
  const readers: FileReader[] = [];
  context.mock.method(dom.window.FileReader.prototype, 'readAsDataURL', function (this: FileReader) { readers.push(this); });
  const view = await openDialog();
  const file = new dom.window.File(['tiny test image'], 'activity.png', { type: 'image/png' });
  await act(async () => { fireEvent.change(view.getByLabelText('选择活动截图'), { target: { files: [file] } }); });
  const reader = readers[0];
  assert.ok(reader);
  assert.equal((view.getByRole('button', { name: '手动填写' }) as HTMLButtonElement).disabled, true);
  await act(async () => { await setLocale('en', false); });
  assert.equal((view.getByRole('button', { name: translateText('手动填写') }) as HTMLButtonElement).disabled, false);
  await act(async () => {
    Object.defineProperty(reader, 'result', { configurable: true, value: 'data:image/png;base64,dGVzdA==' });
    reader.dispatchEvent(new dom.window.ProgressEvent('loadend'));
  });
  assert.equal(view.queryByRole('img', { name: translateText('已选活动截图') }), null);
});
