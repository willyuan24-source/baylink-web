import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { api } from '../src/lib/api';
import { outings, parseOuting, parseOutingMessage, safeOutingUrl, outingUrl, type Outing, type OutingCreate } from '../src/lib/outings';

const fixture = (patch: Partial<Outing> = {}): Outing => ({
  id: 'outing-fixture', title: '周六公园散步', description: 'Isolated test fixture, not a real public outing.', eventId: null,
  date: '2026-10-17', startTime: '14:00', endTime: '16:00', city: 'Fremont', venue: 'Public park entrance', capacity: 3,
  costNote: 'Each person covers their own travel.', transport: 'transit', language: 'any',
  startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'), timezone: 'America/Los_Angeles',
  status: 'open', revision: 4, planVersion: 2, host: { id: 'host', nickname: 'Host', verified: true }, confirmedCount: 1, me: null,
  createdAt: Date.parse('2026-09-30T18:00:00Z'), updatedAt: Date.parse('2026-09-30T19:00:00Z'), ...patch,
});
const create: OutingCreate = {
  title: fixture().title, description: fixture().description, eventId: null, date: '2026-10-17', startTime: '14:00', endTime: '16:00',
  city: 'Fremont', venue: 'Public park entrance', capacity: 3, costNote: 'Each person covers their own travel.', transport: 'transit', language: 'any', adultConsent: true, publicPlaceConsent: true,
};
const message = { id: 'message-1', outingId: 'outing-fixture', senderId: 'host', senderName: 'Host', text: 'Meet at the public entrance.', createdAt: Date.parse('2026-09-30T19:00:00Z') };
const originalFetch = globalThis.fetch;
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
let stored: string | null = null;
let expired = 0;
function session(token = 'old-token') {
  stored = JSON.stringify({ id: 'member', token }); expired = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, removeItem: () => { stored = null; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (event: Event) => { if (event.type === 'session-expired') expired++; } } });
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor); else Reflect.deleteProperty(globalThis, 'localStorage');
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window');
});

test('public outings preserve real states and reject malformed identities, dates, counts and member rosters', () => {
  assert.equal(parseOuting(fixture()).confirmedCount, 1);
  assert.equal(parseOuting(fixture({ status: 'cancelled' })).status, 'cancelled');
  const bad: Record<string, unknown>[] = [
    { id: '' }, { title: {} }, { date: '2026-02-30' }, { startTime: '25:00' }, { endTime: '13:00' }, { timezone: 'UTC' },
    { startAt: Number.NaN }, { endAt: Number.POSITIVE_INFINITY }, { confirmedCount: -1 }, { confirmedCount: 4 }, { capacity: 1 },
    { capacity: 2.5 }, { status: 'approved' }, { revision: -1 }, { planVersion: 0 }, { me: { userId: 'member', role: 'member', status: 'approved', confirmedVersion: 1 } },
    { members: [{ userId: 'member', nickname: 'One', role: 'member', status: 'confirmed', confirmedVersion: 2 }, { userId: 'member', nickname: 'Duplicate', role: 'member', status: 'confirmed', confirmedVersion: 2 }] },
  ];
  for (const patch of bad) assert.throws(() => parseOuting({ ...fixture(), ...patch }), /Invalid outing response/, JSON.stringify(patch));
});

test('the displayed Pacific date and time must describe the same instants, including winter UTC offset', () => {
  const winter = fixture({ date: '2026-11-08', startTime: '14:00', endTime: '16:00', startAt: Date.parse('2026-11-08T22:00:00Z'), endAt: Date.parse('2026-11-09T00:00:00Z') });
  assert.equal(parseOuting(winter).date, '2026-11-08');
  for (const patch of [{ date: '2026-10-18' }, { startAt: fixture().startAt - 3_600_000 }, { endAt: fixture().endAt + 3_600_000 }]) {
    assert.throws(() => parseOuting({ ...fixture(), ...patch }), /Invalid outing response/);
  }
  assert.throws(() => parseOuting({ ...winter, startAt: Date.parse('2026-11-08T21:00:00Z') }), /Invalid outing response/);
});

test('official links and outing navigation do not accept active protocols, credentials or query injection', () => {
  assert.equal(safeOutingUrl('https://example.test/event?id=1'), true);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.test/event', 'http://example.test/event', 'https://user:pass@example.test/event']) {
    assert.equal(safeOutingUrl(url), false, url);
    assert.throws(() => parseOuting(fixture({ officialUrl: url })), /Invalid outing response/);
  }
  const url = new URL(outingUrl('one&view=mine#private'), 'https://www.baylink.us');
  assert.deepEqual([...url.searchParams.entries()], [['outing', 'one&view=mine#private']]); assert.equal(url.hash, '');
});

test('list filters are encoded independently and cancellation reaches the shared client', async t => {
  const signal = new AbortController().signal;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    const url = new URL(path, 'https://example.test');
    assert.equal(url.pathname, '/outings'); assert.equal(options.signal, signal);
    assert.deepEqual([...url.searchParams.entries()], [['eventId', 'festival&date=other'], ['date', '2026-10-17'], ['city', 'San José / SF'], ['cursor', 'cursor+/=']]);
    return { outings: [fixture()], nextCursor: null };
  });
  assert.equal((await outings.list({ eventId: 'festival&date=other', date: '2026-10-17', city: 'San José / SF', cursor: 'cursor+/=' }, signal)).outings.length, 1);
});

test('failed or inconsistent lists never masquerade as empty results and pagination cannot loop', async t => {
  let response: unknown;
  t.mock.method(api, 'request', async () => response);
  for (const value of [null, {}, { outings: [fixture(), fixture()], nextCursor: null }, { outings: [{ id: 'bad' }], nextCursor: null }, { outings: [], nextCursor: {} }, { outings: [], nextCursor: '' }, { outings: [], nextCursor: 'already-read' }]) {
    response = value;
    await assert.rejects(outings.list({ cursor: 'already-read' }), /Invalid outing response/, JSON.stringify(value));
  }
  response = { outings: [], nextCursor: null };
  assert.deepEqual(await outings.list(), { outings: [], nextCursor: null });
});

test('detail and mutation acknowledgements must refer to the requested outing', async t => {
  const other = fixture({ id: 'different-outing' });
  t.mock.method(api, 'request', async () => ({ outing: other }));
  await assert.rejects(outings.get(fixture().id), /Invalid outing response/);
  await assert.rejects(outings.update(fixture(), create, 'edit-key'), /Invalid outing response/);
  await assert.rejects(outings.action(fixture(), 'request', { adultConsent: true }, 'request-key'), /Invalid outing response/);
  await assert.rejects(outings.adminCancel(fixture().id, fixture().revision, 'reviewed', 'admin-key'), /Invalid outing response/);
});

test('create, edit and join send explicit consent, revision and caller retry identity without inventing acceptance', async t => {
  const signal = new AbortController().signal;
  const requests: { path: string; method: string | undefined; body: Record<string, unknown> }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(options.signal, signal); requests.push({ path, method: options.method, body: JSON.parse(String(options.body)) });
    return { outing: fixture({ me: { userId: 'member', role: 'member', status: 'requested', confirmedVersion: 0 } }), notificationWarning: 'Saved; notification could not be sent.' };
  });
  await outings.create(create, 'create-key', signal);
  await outings.update(fixture(), create, 'edit-key', signal);
  const result = await outings.action(fixture(), 'request', { note: 'Can arrive by public transit.', adultConsent: true }, 'retry-key', signal);
  assert.deepEqual(requests[0], { path: '/outings', method: 'POST', body: { ...create, idempotencyKey: 'create-key' } });
  assert.equal(requests[1].method, 'PATCH'); assert.equal(requests[1].body.revision, 4);
  assert.deepEqual(requests[2].body, { note: 'Can arrive by public transit.', adultConsent: true, action: 'request', revision: 4, idempotencyKey: 'retry-key' });
  assert.equal(result.outing.me?.status, 'requested'); assert.equal(result.outing.confirmedCount, 1); assert.ok(result.notificationWarning);
});

test('member message reads and writes reject another outing, duplicated messages and invalid text', async t => {
  let response: unknown;
  t.mock.method(api, 'request', async () => response);
  for (const messages of [[{ ...message, outingId: 'someone-elses-outing' }], [message, message], [{ ...message, text: {} }], [{ ...message, createdAt: 'yesterday' }]]) {
    response = { messages }; await assert.rejects(outings.messages(fixture().id), /Invalid outing response/);
  }
  response = { message: { ...message, outingId: 'other' } };
  await assert.rejects(outings.sendMessage(fixture(), 'hello', 'message-key'), /Invalid outing response/);
  assert.throws(() => parseOutingMessage({ ...message, text: '' }), /Invalid outing response/);
  response = { messages: [message] }; assert.deepEqual((await outings.messages(fixture().id)).messages, [message]);
});

test('message and report requests retain identity and evidence without sending a client author or fake acknowledgement', async t => {
  const requests: { path: string; payload: Record<string, unknown> }[] = [];
  const signal = new AbortController().signal;
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(options.signal, signal); requests.push({ path, payload: JSON.parse(String(options.body)) });
    return path.endsWith('/reports') ? { reportId: 'real-report' } : { message };
  });
  await outings.sendMessage(fixture(), 'Meet at the public entrance.', 'message-key', signal);
  assert.deepEqual(await outings.report(fixture().id, 'harassment', 'Please review this message.', message.id, signal), { reportId: 'real-report' });
  assert.deepEqual(requests[0].payload, { text: message.text, revision: 4, idempotencyKey: 'message-key' });
  assert.deepEqual(requests[1].payload, { reason: 'harassment', details: 'Please review this message.', messageId: 'message-1' });
});

test('AI suggestions are draft-only, bounded and cannot inject consent, membership or unsafe links', async t => {
  let response: unknown = { source: 'ai', answer: 'Please confirm the public meeting place.', questions: ['Which entrance?'], missing: ['venue'], draft: { title: 'Park walk', date: '2026-10-17', transport: 'transit' } };
  const paths: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { paths.push(path); return response; });
  const input = { intent: 'Saturday afternoon, public transport.', locale: 'en' };
  assert.equal((await outings.draft(input)).draft.transport, 'transit'); assert.deepEqual(paths, ['/ai/outing-draft']);
  for (const patch of [{ source: 'fallback' }, { questions: ['one', 'two', 'three'] }, { draft: { adultConsent: true } }, { draft: { status: 'confirmed' } }, { draft: { officialUrl: 'javascript:alert(1)' } }, { draft: { date: '2026-02-30' } }, { draft: { capacity: 99 } }, { draft: { transport: 'driver-will-pick-you-up' } }]) {
    response = { source: 'ai', answer: '', questions: [], missing: [], draft: {}, ...patch };
    await assert.rejects(outings.draft(input), /Invalid outing response/);
  }
  assert.ok(paths.every(path => path === '/ai/outing-draft'), 'asking AI never creates or joins an outing');
});

test('protected outing calls use current credentials and an old unauthorized request cannot expire a new session', async () => {
  session();
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer old-token');
    stored = JSON.stringify({ id: 'new-member', token: 'new-token' });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  };
  await assert.rejects(outings.mine()); assert.equal(expired, 0);
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer new-token');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  };
  await assert.rejects(outings.mine()); assert.equal(expired, 1);
});

test('aborted reads and backend permission/conflict failures stay failures rather than returning success-shaped defaults', async () => {
  session();
  const controller = new AbortController(); controller.abort();
  globalThis.fetch = async (_url, options) => { assert.ok(options?.signal?.aborted); throw new DOMException('Aborted', 'AbortError'); };
  await assert.rejects(outings.get(fixture().id, controller.signal));
  for (const status of [403, 409, 503]) {
    globalThis.fetch = async () => Response.json({ error: 'Not applied' }, { status });
    await assert.rejects(outings.action(fixture(), 'accept', { userId: 'member' }, 'action-key'), (error: { status?: number }) => error.status === status);
  }
});
