import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { parsePlannerWebResult, plannerWebAnswerParts, safePlannerWebUrl } from '../src/lib/planner-web-search';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, fireEvent } = await import('@testing-library/react');
const { PlannerWebSearch } = await import('../src/components/PlannerWebSearch');
const { api } = await import('../src/lib/api');
const originalRequest = api.request;
type Props = Parameters<typeof PlannerWebSearch>[0];
const props: Props = { query: '  Oakland live music  ', date: '2026-10-03', region: 'east-bay', city: 'Oakland', locale: 'en' };
const response = (answer = 'Check event details before going. [1]') => ({ ok: true, responseMode: 'web', checkedAt: '2026-09-29T19:00:00.000Z', answer, cached: false,
  sources: [{ title: 'Venue calendar', url: 'https://museumca.org/events/', snippet: 'Check admission and event conditions.' }] });
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise<unknown>(done => { resolve = done; }); return { promise, resolve }; };

beforeEach(context => {
  localStorage.clear();
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  api.request = async () => { throw new Error('Unexpected request'); };
});
afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); });

test('source links reject executable, credentialed and local/private destinations including alternate IP spellings', () => {
  for (const url of [
    'javascript:alert(1)', 'data:text/html,hello', 'file:///etc/hosts', 'ftp://example.com/file', '//example.com/path',
    'https://user:password@example.com/', 'http://localhost/', 'https://sub.localhost/', 'https://router.local/', 'https://printer.lan/', 'https://service.internal/', 'https://x.home.arpa/', 'http://intranet/',
    'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/',
    'http://10.0.0.1/', 'http://172.16.0.1/', 'http://192.168.1.1/', 'http://169.254.169.254/', 'http://100.64.0.1/',
    'http://[::1]/', 'http://[fc00::1]/', 'http://[::ffff:127.0.0.1]/', 'https://example.com\\@localhost/', 'https://exam\nple.com/',
  ]) assert.equal(safePlannerWebUrl(url), null, url);
  assert.equal(safePlannerWebUrl('https://museumca.org/events/?date=2026-10-03#calendar'), 'https://museumca.org/events/?date=2026-10-03#calendar');
  assert.equal(safePlannerWebUrl('http://example.com/events'), 'http://example.com/events');
});

test('rejecting a source preserves original citation indices and validates retrieval dates', () => {
  const value = parsePlannerWebResult({ ...response('Unavailable [1], published [2], missing [9].'), checkedAt: '2026-02-30', sources: [
    { title: 'Blocked', url: 'http://localhost/admin' }, { title: 'Published', url: 'https://example.com/event' },
  ] });
  assert.ok(value);
  assert.equal(value.checkedAt, null);
  assert.deepEqual(value.sources.map(source => source.number), [2]);
  const parts = plannerWebAnswerParts(value);
  assert.equal(parts.find(part => part.citation === 1)?.source, undefined);
  assert.equal(parts.find(part => part.citation === 2)?.source?.url, 'https://example.com/event');
  assert.equal(parts.find(part => part.citation === 9)?.source, undefined);
  assert.equal(parsePlannerWebResult({ ...response(), sources: [] }), null);
  assert.equal(parsePlannerWebResult({ ...response(), responseMode: 'rules' }), null);
});

test('search only runs after a click, uses the public search fields and guards repeated clicks while loading', async () => {
  const pending = deferred();
  const requests: { endpoint: string; options?: RequestInit }[] = [];
  api.request = async (endpoint, options) => { requests.push({ endpoint, options }); return pending.promise; };
  localStorage.setItem('private-plan', JSON.stringify({ title: 'Private family plan', stops: ['home'] }));
  const view = render(<PlannerWebSearch {...props} />);
  assert.equal(requests.length, 0);
  const button = view.getByRole('button', { name: 'Search the web' });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endpoint, '/planner/web-search');
  assert.equal(requests[0].options?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)), { query: 'Oakland live music', locale: 'en', date: '2026-10-03', region: 'east-bay', city: 'Oakland' });
  assert.equal((view.getByRole('button', { name: 'Searching…' }) as HTMLButtonElement).disabled, true);
  await act(async () => { pending.resolve(response()); });
  assert.ok(view.getByText('Web references found'));
  assert.equal((view.getByRole('button', { name: 'Search the web' }) as HTMLButtonElement).disabled, false);
});

test('blank optional filters are omitted and the query limit is enforced without a request', async () => {
  const bodies: Record<string, unknown>[] = [];
  api.request = async (_endpoint, options) => { bodies.push(JSON.parse(String(options?.body))); return response(); };
  const view = render(<PlannerWebSearch {...props} query="x" date="" region="" city=" " />);
  assert.equal((view.getByRole('button', { name: 'Search the web' }) as HTMLButtonElement).disabled, true);
  view.rerender(<PlannerWebSearch {...props} query={'x'.repeat(501)} date="" region="" city=" " />);
  assert.equal((view.getByRole('button', { name: 'Search the web' }) as HTMLButtonElement).disabled, true);
  assert.equal(bodies.length, 0);
  view.rerender(<PlannerWebSearch {...props} date="" region="" city=" " />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
  assert.deepEqual(bodies, [{ query: 'Oakland live music', locale: 'en' }]);
});

test('answer and source text cannot inject HTML and filtered citations never point to the wrong source', async () => {
  api.request = async () => ({ ...response('<img src=x onerror=alert(1)> [1] Safe [2] Missing [9]'), cached: true, sources: [
    { title: 'Unsafe destination', url: 'javascript:alert(1)' },
    { title: '<script>unsafe title</script>', url: 'https://example.com/event', snippet: '<img src=x onerror=alert(2)>' },
  ] });
  const view = render(<PlannerWebSearch {...props} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
  assert.equal(view.container.querySelectorAll('script, img').length, 0);
  assert.match(view.container.querySelector('.planner-web-answer')!.textContent!, /<img src=x onerror=alert\(1\)>/);
  assert.match(view.container.querySelector('.planner-web-answer')!.textContent!, /\[1\] \(source unavailable\)/);
  assert.match(view.container.querySelector('.planner-web-answer')!.textContent!, /\[9\] \(source unavailable\)/);
  const citation = view.container.querySelector('.planner-web-citation')!;
  assert.equal(citation.textContent, '[2]');
  assert.equal(citation.getAttribute('href'), 'https://example.com/event');
  for (const link of view.container.querySelectorAll('a')) {
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(link.getAttribute('href'), 'https://example.com/event');
  }
  assert.equal(view.container.querySelector('.planner-web-sources li')?.getAttribute('value'), '2');
  assert.ok(view.getByText('https://example.com/event'));
  assert.match(view.container.querySelector('.planner-web-checked')!.textContent!, /Retrieved:.*2026.*Bay Area time.*Cached result/);
  assert.match(view.container.querySelector('.planner-web-caution')!.textContent!, /not individually verified official information/);
});

test('every search prop change clears completed results without silently making another request', async () => {
  for (const changed of [{ query: 'San Jose shows' }, { date: '2026-10-04' }, { region: 'sf' }, { city: 'Berkeley' }, { locale: 'zh-Hant' as const }]) {
    let calls = 0;
    api.request = async () => { calls++; return response('Previous result [1]'); };
    const view = render(<PlannerWebSearch {...props} />);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
    assert.ok(view.container.querySelector('.planner-web-results'));
    view.rerender(<PlannerWebSearch {...props} {...changed} />);
    assert.equal(view.container.querySelector('.planner-web-results'), null);
    assert.equal(calls, 1);
    view.unmount();
  }
});

test('changed props abort the old request and its late response cannot overwrite the new result', async () => {
  const first = deferred(); const second = deferred();
  const signals: AbortSignal[] = [];
  api.request = async (_endpoint, options) => { signals.push(options!.signal as AbortSignal); return signals.length === 1 ? first.promise : second.promise; };
  const view = render(<PlannerWebSearch {...props} />);
  act(() => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
  view.rerender(<PlannerWebSearch {...props} city="Berkeley" />);
  assert.equal(signals[0].aborted, true);
  assert.equal(view.queryByText('Searching…'), null);
  act(() => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
  await act(async () => { second.resolve(response('New Berkeley result [1]')); });
  await act(async () => { first.resolve(response('Old Oakland result [1]')); });
  assert.match(view.container.querySelector('.planner-web-answer')!.textContent!, /New Berkeley result/);
  assert.doesNotMatch(view.container.textContent!, /Old Oakland result/);
});

test('cancel and unmount abort requests and never count or render late successful responses', async context => {
  const metrics = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  for (const action of ['cancel', 'unmount']) {
    const pending = deferred(); let signal!: AbortSignal;
    api.request = async (_endpoint, options) => { signal = options!.signal as AbortSignal; return pending.promise; };
    const view = render(<PlannerWebSearch {...props} />);
    act(() => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
    if (action === 'cancel') fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
    else view.unmount();
    assert.equal(signal.aborted, true);
    await act(async () => { pending.resolve(response('Obsolete result [1]')); });
    assert.equal(view.container.querySelector('.planner-web-results'), null);
    view.unmount();
  }
  assert.equal(metrics.mock.callCount(), 0);
});

test('503 and 429 have friendly English and Chinese messages without exposing server details', async () => {
  for (const [status, locale, message] of [[503, 'en', /temporarily unavailable/], [429, 'en', /temporarily at its limit/], [503, 'zh-Hant', /站外搜尋暫不可用/], [429, 'zh-Hans', /次数暂时用完/]] as const) {
    api.request = async () => { throw { status, error: 'Private provider diagnostic' }; };
    const view = render(<PlannerWebSearch {...props} locale={locale} />);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: locale === 'en' ? 'Search the web' : locale === 'zh-Hant' ? '搜尋站外資料' : '搜索站外资料' })); });
    assert.match(view.getByRole('alert').textContent!, message);
    assert.doesNotMatch(view.container.textContent!, /Private provider diagnostic/);
    assert.equal(view.container.querySelector('.planner-web-results'), null);
    view.unmount();
  }
});

test('success is counted anonymously and a response without safe sources is not presented as sourced advice', async context => {
  const metrics = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  api.request = async () => response();
  const view = render(<PlannerWebSearch {...props} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
  assert.equal(metrics.mock.callCount(), 1);
  const metricOptions = metrics.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(metricOptions.credentials, 'omit');
  assert.deepEqual(Object.keys(JSON.parse(String(metricOptions.body))).sort(), ['event', 'locale']);
  assert.equal(JSON.parse(String(metricOptions.body)).event, 'planner_web_search');
  api.request = async () => ({ ...response('Unsourced claim'), sources: [{ title: 'Private', url: 'https://localhost/' }] });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Search the web' })); });
  assert.match(view.getByRole('alert').textContent!, /No result with usable sources/);
  assert.equal(view.container.querySelector('.planner-web-results'), null);
  assert.equal(metrics.mock.callCount(), 1);
});
