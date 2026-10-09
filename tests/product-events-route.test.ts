import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { ROUTES, routeTemplate } from '../src/app/route-table';
import { API_CLIENT_EVENTS, apiAcceptsProductEvent, apiRouteTemplate } from './api-func-contract';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.baylink.us/en/events/san-francisco-fleet-week-2026?date=2026-10-10&from=card-sf#map' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { recordProductEvent, recordBayBayLatency, bayBayLatencyEvent, recordIcsDownload, recordDetailOpen } = await import('../src/lib/product-events');
const { currentRouteTemplate } = await import('../src/lib/route-template');
const { installProductObserver } = await import('../src/lib/product-observer');

const bodies = (fetch: { mock: { calls: { arguments: unknown[] }[] } }) => fetch.mock.calls
  .filter(call => String(call.arguments[0]).endsWith('/product-events'))
  .map(call => JSON.parse(String((call.arguments[1] as RequestInit).body)));
afterEach(() => { dom.reconfigure({ url: 'https://www.baylink.us/en/events/san-francisco-fleet-week-2026?date=2026-10-10&from=card-sf#map' }); });

test('events carry the route template of the current page, never its path, id, query or hash', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  recordProductEvent('official_source_click');
  const [body] = bodies(fetch);
  assert.deepEqual(body, { event: 'official_source_click', locale: 'zh-Hans', route: '/events/:id' });
  assert.doesNotMatch(JSON.stringify(body), /fleet|2026|card|map|\/en/);
  dom.reconfigure({ url: 'https://www.baylink.us/some/unknown/page?q=private' });
  recordProductEvent('nav_click');
  assert.equal(bodies(fetch)[1].route, 'other');
  recordProductEvent('page_view', { route: '/guides/:slug' });
  assert.equal(bodies(fetch)[2].route, '/guides/:slug', 'an explicit template wins (the router path, not window.location)');
});

test('every route in the table is a template the live API stores as itself, not as other', () => {
  for (const route of ROUTES) {
    const template = routeTemplate(route.path);
    assert.equal(template, route.path);
    const stored = apiRouteTemplate(template);
    assert.notEqual(stored, 'other', `${route.path} would be counted as other by the API allowlist`);
    assert.notEqual(stored, null);
  }
  // Language prefixes and trailing slashes reduce to the same template on both sides.
  for (const [path, expected] of [['/zh-Hant/guides/medicare-guide', '/guides/:slug'], ['/en/', '/'], ['/en/messages/abc', '/messages/:threadId'], ['/category/rent/', '/category/:categorySlug']] as const) {
    assert.equal(routeTemplate(path), expected);
    assert.notEqual(apiRouteTemplate(routeTemplate(path)), 'other');
  }
  assert.equal(currentRouteTemplate(), '/events/:id');
});

test('every client event the web can send is accepted by the API with its route', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  recordIcsDownload(); recordDetailOpen(); recordBayBayLatency(2_000); recordBayBayLatency(20_000);
  recordProductEvent('feedback_open'); recordProductEvent('feedback_sent'); recordProductEvent('signup_gate');
  const sent = bodies(fetch);
  assert.deepEqual(sent.map(body => body.event), ['ics_download', 'event_detail_open', 'baybay_fast', 'baybay_latency_lt3', 'baybay_slow', 'baybay_latency_gt15', 'feedback_open', 'feedback_sent', 'signup_gate']);
  for (const body of sent) assert.ok(apiAcceptsProductEvent(body, API_CLIENT_EVENTS), JSON.stringify(body));
});

test('BayBay latency buckets match the <3 / 3–8 / 8–15 / >15 s target bands', () => {
  assert.equal(bayBayLatencyEvent(0), 'baybay_latency_lt3');
  assert.equal(bayBayLatencyEvent(2_999), 'baybay_latency_lt3');
  assert.equal(bayBayLatencyEvent(3_000), 'baybay_latency_3to8');
  assert.equal(bayBayLatencyEvent(7_999), 'baybay_latency_3to8');
  assert.equal(bayBayLatencyEvent(8_000), 'baybay_latency_8to15');
  assert.equal(bayBayLatencyEvent(14_999), 'baybay_latency_8to15');
  assert.equal(bayBayLatencyEvent(15_000), 'baybay_latency_gt15');
});

test('calendar downloads count once per click, including links a page creates and clicks', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  installProductObserver();
  const generated = document.createElement('a');
  generated.href = 'blob:https://www.baylink.us/1'; generated.download = 'baylink-fleet-week.ics';
  generated.addEventListener('click', event => event.preventDefault());
  document.body.append(generated); generated.click(); generated.remove();
  const subscribe = document.createElement('a');
  subscribe.href = 'webcal://www.baylink.us/calendar/sf.ics';
  subscribe.addEventListener('click', event => event.preventDefault());
  document.body.append(subscribe); subscribe.click(); subscribe.remove();
  const ordinary = document.createElement('a');
  ordinary.href = '/events'; ordinary.addEventListener('click', event => event.preventDefault());
  document.body.append(ordinary); ordinary.click(); ordinary.remove();
  assert.deepEqual(bodies(fetch).map(body => body.event).filter(event => event === 'ics_download'), ['ics_download', 'ics_download']);
});
