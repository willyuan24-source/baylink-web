import type { TestContext } from 'node:test';
/** Ancillary counters and quota reads are distinct from the conversation transport under test. */
export function mockBayBayFetch(t: TestContext, handler: typeof fetch) {
  const conversation = t.mock.fn(handler);
  t.mock.method(globalThis, 'fetch', ((input, init) => {
    const url = String(input);
    if (url.endsWith('/product-events')) return Promise.resolve(Response.json({ ok: true }));
    if (url.endsWith('/ai/usage')) return Promise.resolve(Response.json({ remaining: 20, limit: 20, resetAt: '2026-10-06T07:00:00.000Z' }));
    return conversation(input, init);
  }) as typeof fetch);
  return conversation;
}
