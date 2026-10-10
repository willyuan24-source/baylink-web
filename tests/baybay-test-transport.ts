import type { TestContext } from 'node:test';
import { registerHooks } from 'node:module';

// The BayBay panel imports its own stylesheets (the answer layout and the UI primitives' ui.css), which Node cannot
// load. Tests that render the panel import this module first, so CSS modules resolve to empty modules for them.
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
/** Ancillary counters and quota reads are distinct from the conversation transport under test. */
export function mockBayBayFetch(t: TestContext, handler: typeof fetch) {
  const conversation = t.mock.fn(handler);
  t.mock.method(globalThis, 'fetch', ((input, init) => {
    const url = String(input);
    if (url.endsWith('/product-events')) return Promise.resolve(Response.json({ ok: true }));
    if (url.endsWith('/ai/usage')) return Promise.resolve(Response.json({ remaining: 20, limit: 20, resetAt: '2026-10-06T07:00:00.000Z' }));
    if (url.endsWith('/ai/baybay-capabilities')) return Promise.resolve(Response.json({ engine: 'v2', pause: null, reduced: null }));
    return conversation(input, init);
  }) as typeof fetch);
  return conversation;
}
