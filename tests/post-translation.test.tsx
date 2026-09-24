import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { JSDOM } from 'jsdom';
import type { PostData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderHook, act, cleanup } = await import('@testing-library/react');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { usePostTranslation } = await import('../src/features/posts/usePostTranslation');
const { requestPostTranslation, postTranslationSession, postTranslationText } = await import('../src/features/posts/postTranslationStore');

const post = (id: string, title = '周末一起爬山'): PostData => ({
  id, title, description: '周六上午见，欢迎邻居们。', budget: '免费', timeInfo: '周六上午',
  authorId: 'author-one', author: { nickname: '邻居甲' }, type: 'client', city: 'Sunnyvale', category: '活动',
  contactInfo: 'private-contact', imageUrls: [], likesCount: 0, hasLiked: false, commentsCount: 0, createdAt: 1,
});
const english = { title: 'Weekend hiking', description: 'See you Saturday morning. Neighbors welcome.', budget: 'Free', timeInfo: 'Saturday morning' };
const response = (source: ReturnType<typeof postTranslationText>, translation: unknown = english) => ({ ok: true, target: 'en', source, translation });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

afterEach(async () => {
  cleanup();
  mock.restoreAll();
  await setLocale('zh-Hans', false);
  localStorage.clear();
});

test('cards and details share requests, with at most three requests running and no post text sent', async () => {
  const jobs: ReturnType<typeof deferred<unknown>>[] = [];
  const sources = Array.from({ length: 5 }, (_, index) => postTranslationText(post(`queue-${index}`)));
  const calls: string[] = [];
  mock.method(api, 'request', (endpoint: string, options: RequestInit) => {
    calls.push(endpoint);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body as string), { target: 'en' });
    const job = deferred<unknown>(); jobs.push(job); return job.promise;
  });
  const session = postTranslationSession();
  const requests = sources.map((source, index) => requestPostTranslation(`queue-${index}`, source, session));
  assert.equal(requestPostTranslation('queue-0', sources[0], session), requests[0]);
  assert.equal(calls.length, 3);
  jobs[0].resolve(response(sources[0]));
  await requests[0];
  assert.equal(calls.length, 4);
  jobs[1].resolve(response(sources[1]));
  await requests[1];
  assert.equal(calls.length, 5);
  jobs[2].resolve(response(sources[2]));
  jobs[3].resolve(response(sources[3]));
  jobs[4].resolve(response(sources[4]));
  assert.ok((await Promise.all(requests)).every(result => result.status === 'translated'));
  assert.equal((await requestPostTranslation('queue-0', sources[0], session)).status, 'translated');
  assert.equal(calls.length, 5);
});

test('English readers automatically see translations and can read the original without changing the post', async () => {
  await setLocale('en', false);
  const item = post('hook-language');
  const initial = structuredClone(item);
  const request = mock.method(api, 'request', async () => response(postTranslationText(item), { ...english, author: 'Should be ignored' }));
  const hook = renderHook(() => usePostTranslation(item));
  await act(async () => {});
  assert.equal(hook.result.current.status, 'translated');
  assert.equal(hook.result.current.translated, true);
  assert.deepEqual(hook.result.current.display, english);
  act(() => hook.result.current.toggleOriginal());
  assert.equal(hook.result.current.showOriginal, true);
  assert.equal(hook.result.current.translated, false);
  assert.deepEqual(hook.result.current.display, postTranslationText(item));
  act(() => hook.result.current.toggleOriginal());
  assert.deepEqual(hook.result.current.display, english);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal(hook.result.current.status, 'original');
  assert.deepEqual(hook.result.current.display, postTranslationText(item));
  await act(async () => { await setLocale('zh-Hans', false); });
  assert.deepEqual(hook.result.current.display, postTranslationText(item));
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(item, initial);
});

test('disabled or non-Chinese posts do not request translations', async () => {
  await setLocale('en', false);
  const request = mock.method(api, 'request', async () => { throw new Error('Must not run'); });
  const englishPost = { ...post('already-english'), ...english };
  const first = renderHook(() => usePostTranslation(post('offscreen'), false));
  const second = renderHook(() => usePostTranslation(englishPost));
  await act(async () => {});
  assert.equal(first.result.current.status, 'original');
  assert.equal(second.result.current.status, 'original');
  assert.equal(request.mock.callCount(), 0);
});

test('an old response cannot replace edited content or appear after switching to Chinese', async () => {
  await setLocale('en', false);
  const first = post('edit-race');
  const edited = { ...first, title: '改为周日爬山' };
  const jobs = [deferred<unknown>(), deferred<unknown>()];
  let index = 0;
  mock.method(api, 'request', () => jobs[index++].promise);
  const hook = renderHook(({ item }) => usePostTranslation(item), { initialProps: { item: first } });
  hook.rerender({ item: edited });
  await act(async () => { jobs[0].resolve(response(postTranslationText(first))); });
  assert.equal(hook.result.current.status, 'loading');
  assert.equal(hook.result.current.display.title, edited.title);
  await act(async () => { await setLocale('zh-Hans', false); });
  await act(async () => { jobs[1].resolve(response(postTranslationText(edited), { ...english, title: 'Sunday hiking instead' })); });
  assert.equal(hook.result.current.status, 'original');
  assert.equal(hook.result.current.display.title, edited.title);
  await act(async () => { await setLocale('en', false); });
  assert.equal(hook.result.current.display.title, 'Sunday hiking instead');
});

test('failure preserves the original, automatic calls back off, and an explicit retry can recover', async () => {
  await setLocale('en', false);
  const item = post('failure-retry');
  let shouldFail = true;
  const request = mock.method(api, 'request', async () => {
    if (shouldFail) throw { status: 503 };
    return response(postTranslationText(item));
  });
  const hook = renderHook(() => usePostTranslation(item));
  await act(async () => {});
  assert.equal(hook.result.current.status, 'unavailable');
  assert.deepEqual(hook.result.current.display, postTranslationText(item));
  await requestPostTranslation(item.id, postTranslationText(item), postTranslationSession());
  assert.equal(request.mock.callCount(), 1);
  assert.equal(hook.result.current.status, 'unavailable');
  shouldFail = false;
  await act(async () => { hook.result.current.retry(); hook.result.current.retry(); });
  assert.equal(request.mock.callCount(), 2);
  assert.equal(hook.result.current.status, 'translated');
});

test('automatic failure backoff expires after thirty seconds', async () => {
  const item = post('backoff-expiry');
  const source = postTranslationText(item);
  const session = postTranslationSession();
  let now = Date.now();
  mock.method(Date, 'now', () => now);
  const request = mock.method(api, 'request', async () => { throw { status: 429 }; });
  await requestPostTranslation(item.id, source, session);
  now += 29_999;
  await requestPostTranslation(item.id, source, session);
  assert.equal(request.mock.callCount(), 1);
  now += 2;
  await requestPostTranslation(item.id, source, session);
  assert.equal(request.mock.callCount(), 2);
});

test('a long feed cannot grow the pending translation queue without limit', async () => {
  const gate = deferred<void>();
  const request = mock.method(api, 'request', async (endpoint: string) => {
    await gate.promise;
    const id = endpoint.split('/')[2];
    return response(postTranslationText(post(id)));
  });
  const session = postTranslationSession();
  const requests = Array.from({ length: 130 }, (_, index) => {
    const item = post(`bounded-${index}`);
    return requestPostTranslation(item.id, postTranslationText(item), session);
  });
  assert.equal(request.mock.callCount(), 3);
  gate.resolve();
  const results = await Promise.all(requests);
  assert.equal(request.mock.callCount(), 128);
  assert.equal(results.filter(result => result.status === 'unavailable').length, 2);
});

test('mismatched source and non-string response fields never become displayed translations', async () => {
  await setLocale('en', false);
  const wrongSource = post('wrong-source');
  const malformed = post('malformed-translation');
  mock.method(api, 'request', async (endpoint: string) => endpoint.includes('wrong-source')
    ? response({ ...postTranslationText(wrongSource), budget: '收费' })
    : response(postTranslationText(malformed), { ...english, description: { html: '<script>invalid</script>' } }));
  const first = renderHook(() => usePostTranslation(wrongSource));
  const second = renderHook(() => usePostTranslation(malformed));
  await act(async () => {});
  assert.equal(first.result.current.status, 'unavailable');
  assert.equal(second.result.current.status, 'unavailable');
  assert.deepEqual(first.result.current.display, postTranslationText(wrongSource));
  assert.deepEqual(second.result.current.display, postTranslationText(malformed));
});

test('a changed login session neither receives an earlier response nor reuses its cached visibility', async () => {
  await setLocale('en', false);
  const item = post('account-boundary');
  const jobs = [deferred<unknown>(), deferred<unknown>()];
  let index = 0;
  const request = mock.method(api, 'request', () => jobs[index++].promise);
  const hook = renderHook(() => usePostTranslation(item));
  await act(async () => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'another-user', token: 'another-session' }));
    window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'currentUser' }));
  });
  assert.equal(request.mock.callCount(), 2);
  await act(async () => { jobs[0].resolve(response(postTranslationText(item))); });
  assert.equal(hook.result.current.status, 'loading');
  assert.equal(hook.result.current.display.title, item.title);
  await act(async () => { jobs[1].resolve(response(postTranslationText(item))); });
  assert.equal(hook.result.current.status, 'translated');
});
