import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderPublicPostPage } from '../api/post-page';

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const readTemplate = async () => template;
const sample = { id: 'public-post', title: '真实房源 <script>bad()</script>', description: '公开房源介绍', category: '租房', city: '东湾', budget: '$1200', status: 'active', imageUrls: ['https://example.com/room.jpg'], token: 'PRIVATE_TOKEN', contactInfo: 'PRIVATE_CONTACT', author: { email: 'PRIVATE_EMAIL' }, contactPreference: { methods: [{ value: 'PRIVATE_PHONE' }] } };
const request = () => new Request('https://www.baylink.us/posts/public-post', { headers: { Authorization: 'Bearer SHOULD_NOT_FORWARD', Cookie: 'session=SHOULD_NOT_FORWARD' } });

test('public post HTML is readable and never forwards auth or serializes private fields', async () => {
  let called = false;
  const response = await renderPublicPostPage(request(), { readTemplate, fetch: async (url, options) => {
    called = true;
    assert.equal(url, 'https://baylink-api.onrender.com/api/posts/public-post');
    assert.deepEqual(options?.headers, { Accept: 'application/json' });
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.cache, 'no-store');
    return Response.json(sample);
  } });
  assert.ok(called);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /公开房源介绍/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /PRIVATE_|SHOULD_NOT_FORWARD|<script>bad/);
  assert.match(html, /property="og:type" content="article"/);
});

test('deleted post is 404 and noindex while closed historical post remains accessible', async () => {
  const missing = await renderPublicPostPage(request(), { readTemplate, fetch: async () => new Response('', { status: 404 }) });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('x-robots-tag')!, /noindex/);
  const closed = await renderPublicPostPage(request(), { readTemplate, fetch: async () => Response.json({ ...sample, status: 'closed' }) });
  assert.equal(closed.status, 200);
  assert.match(await closed.text(), /已结束/);
});

test('upstream errors and malformed payloads stay 503 instead of becoming false 404s', async () => {
  const responses = [
    async () => { throw new Error('network'); },
    async () => new Response('', { status: 500 }),
    async () => new Response('', { status: 403 }),
    async () => Response.json({ error: 'unexpected' }),
    async () => Response.json({ ...sample, id: 'wrong-post' }),
  ];
  for (const fetch of responses) {
    const result = await renderPublicPostPage(request(), { readTemplate, fetch });
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('retry-after'), '60');
    assert.match(result.headers.get('x-robots-tag')!, /noindex/);
  }
});

test('invalid IDs and hidden posts do not expose content', async () => {
  const invalid = await renderPublicPostPage(new Request('https://www.baylink.us/api/post-page?postId=..%2Fsecret'), { readTemplate, fetch: async () => { throw new Error('Should not fetch an invalid ID'); } });
  assert.equal(invalid.status, 404);
  const hidden = await renderPublicPostPage(request(), { readTemplate, fetch: async () => Response.json({ ...sample, adminHidden: true }) });
  assert.equal(hidden.status, 404);
  assert.doesNotMatch(await hidden.text(), /公开房源介绍|PRIVATE_/);
});

test('HEAD does not return a body and missing build output returns recoverable 503', async () => {
  const head = await renderPublicPostPage(new Request('https://www.baylink.us/posts/public-post', { method: 'HEAD' }), { readTemplate, fetch: async () => Response.json(sample) });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const failed = await renderPublicPostPage(request(), { readTemplate: async () => { throw new Error('Missing file'); } });
  assert.equal(failed.status, 503);
  assert.match(failed.headers.get('x-robots-tag')!, /noindex/);
});
