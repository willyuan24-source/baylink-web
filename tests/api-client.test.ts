import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { api } from '../src/lib/api';

const originalFetch = globalThis.fetch;
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
let stored: string | null = null;
let expired = 0;
const setup = (token = 'old-token') => {
  stored = JSON.stringify({ id: 'test-user', token });
  expired = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, removeItem: () => { stored = null; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (event: Event) => { if (event.type === 'session-expired') expired += 1; } } });
};
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor); else Reflect.deleteProperty(globalThis, 'localStorage');
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window');
});

test('API client supports Headers input and attaches the current session token', async () => {
  setup();
  globalThis.fetch = async (_input, options) => {
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('X-Test'), 'request-marker');
    assert.equal(headers.get('Authorization'), 'Bearer old-token');
    return Response.json({ ok: true });
  };
  assert.deepEqual(await api.request('/fixture', { headers: new Headers({ 'X-Test': 'request-marker' }) }), { ok: true });
});

test('successful HTTP responses with invalid JSON fail instead of masquerading as empty data', async () => {
  setup();
  globalThis.fetch = async () => new Response('<html>proxy error</html>');
  await assert.rejects(api.request('/fixture'), (error: { status?: number }) => error.status === 502);
});

test('late unauthorized response from an old session does not expire the new account session', async () => {
  setup();
  globalThis.fetch = async () => {
    stored = JSON.stringify({ id: 'new-user', token: 'new-token' });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  };
  await assert.rejects(api.request('/conversations'));
  assert.equal(expired, 0);
});

test('only a current protected request expires the session; failed login stays in the login form', async () => {
  setup();
  globalThis.fetch = async () => Response.json({ error: 'Unauthorized' }, { status: 401 });
  await assert.rejects(api.request('/auth/login'));
  assert.equal(expired, 0);
  await assert.rejects(api.request('/conversations'));
  assert.equal(expired, 1);
});
