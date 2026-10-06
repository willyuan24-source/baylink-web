import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderPublicOutingPage } from '../api/outing-page';
import { renderPublicUserCardPage } from '../api/user-card-page';

const readTemplate = async () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const outing = { id: 'outing_public', title: '周末公园同行 <script>bad()</script>', description: '公开的小队安排', date: '2026-10-10', startTime: '10:00', endTime: '12:00',
  startAt: Date.parse('2026-10-10T17:00:00Z'), endAt: Date.parse('2026-10-10T19:00:00Z'), timezone: 'America/Los_Angeles', city: 'Oakland', venue: 'Public Park', costNote: '各自承担交通费', capacity: 6, confirmedCount: 2, status: 'open',
  host: { id: 'host-1', nickname: '邻居', verified: true, phone: 'PRIVATE_PHONE' }, officialUrl: 'https://example.org/public-park', updatedAt: Date.parse('2026-10-06T01:00:00Z'),
  members: [{ userId: 'PRIVATE_APPLICANT', note: 'PRIVATE_NOTE' }], messages: ['PRIVATE_MESSAGE'], timePoll: { availability: 'PRIVATE_POLL' }, requestCount: 75, token: 'PRIVATE_TOKEN', me: { userId: 'PRIVATE_VIEWER' } };
const user = { id: 'neighbor-1', nickname: '公开邻居', bio: '公开介绍 </script><script>bad()</script>', statusText: '一起逛湾区', city: 'Oakland', area: 'East Bay', profileTags: ['社区居民'], interests: ['散步'],
  avatar: 'https://example.org/avatar.png', coverImage: 'javascript:bad()', postCount: 4, recentPosts: [{ id: 'post-1', title: '公开的最新帖子', contactInfo: 'PRIVATE_POST_CONTACT' }],
  email: 'PRIVATE_EMAIL', phone: 'PRIVATE_PHONE', messages: ['PRIVATE_MESSAGE'], contactPreference: { value: 'PRIVATE_CONTACT' }, blockRelation: 'PRIVATE_BLOCK', officialVerification: { certificate: 'PRIVATE_CERTIFICATE' } };
const request = (path: string, method = 'GET') => new Request('https://www.baylink.us' + path, { method, headers: { Authorization: 'Bearer SHOULD_NOT_FORWARD', Cookie: 'session=SHOULD_NOT_FORWARD' } });

test('public outing SSR reads only the anonymous endpoint and excludes applicants, polls, messages and contact data', async () => {
  const response = await renderPublicOutingPage(request('/together?outing=outing_public&tracking=PRIVATE_TRACKING'), { readTemplate, fetch: async (url, options) => {
    assert.equal(url, 'https://baylink-api.onrender.com/api/outings/outing_public');
    assert.deepEqual(options?.headers, { Accept: 'application/json' });
    assert.equal(options?.credentials, 'omit'); assert.equal(options?.cache, 'no-store'); assert.equal(options?.redirect, 'error');
    return Response.json({ outing });
  } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /公开的小队安排|Public Park/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /content="https:\/\/www.baylink.us\/together\?outing=outing_public"/);
  assert.match(html, /"startDate":"2026-10-10T17:00:00.000Z"/);
  assert.match(html, /已确认人数<\/dt><dd>2<\/dd>/);
  assert.doesNotMatch(html, /PRIVATE_|SHOULD_NOT_FORWARD|<script>bad\(\)|requestCount|timePoll/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
});

test('public user SSR uses the public-profile API, honors hidden fields and never invents missing statistics', async () => {
  const response = await renderPublicUserCardPage(request('/en/users/neighbor-1?tracking=PRIVATE_TRACKING'), { readTemplate, fetch: async (url, options) => {
    assert.equal(url, 'https://baylink-api.onrender.com/api/users/neighbor-1/public');
    assert.deepEqual(options?.headers, { Accept: 'application/json' });
    return Response.json({ ...user, profileVisibility: { location: false, interests: false, socialLinks: false }, postCount: undefined });
  } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<html lang="en"/);
  assert.match(html, /content="en_US"/);
  assert.match(html, /https:\/\/www.baylink.us\/en\/users\/neighbor-1/);
  assert.match(html, /公开邻居|公开的最新帖子/);
  assert.match(html, /\/en\/posts\/post-1/);
  assert.doesNotMatch(html, /PRIVATE_|SHOULD_NOT_FORWARD|Oakland|East Bay|散步|Public posts: 0|javascript:bad|<script>bad\(\)/);
  assert.match(html, /\\u003c\/script>/, 'profile JSON-LD escapes author text rather than creating executable tags');
});

test('canonical metadata keeps only a validated public identifier and has request-scoped language', async () => {
  const [en, hant, legacy] = await Promise.all([
    renderPublicOutingPage(request('/api/outing-page?outingId=outing_public&siteLanguage=en'), { readTemplate, fetch: async () => Response.json({ outing }) }),
    renderPublicUserCardPage(request('/api/user-card-page?userId=neighbor-1&siteLanguage=zh-Hant'), { readTemplate, fetch: async () => Response.json(user) }),
    renderPublicUserCardPage(request('/users/neighbor-1?lang=en'), { readTemplate, fetch: async () => Response.json(user) }),
  ]);
  const english = await en.text(), traditional = await hant.text(), oldLink = await legacy.text();
  assert.match(english, /rel="canonical" href="https:\/\/www.baylink.us\/en\/together\?outing=outing_public"/);
  assert.match(traditional, /<html lang="zh-Hant"/);
  assert.match(traditional, /rel="canonical" href="https:\/\/www.baylink.us\/zh-Hant\/users\/neighbor-1"/);
  assert.match(oldLink, /<html lang="en"/);
  assert.doesNotMatch(english + traditional + oldLink, /PRIVATE_/);
});

test('missing and hidden public records fail closed, while upstream errors remain recoverable 503 responses', async () => {
  for (const [render, path, payload] of [[renderPublicOutingPage, '/together?outing=outing_public', { outing }], [renderPublicUserCardPage, '/users/neighbor-1', user]] as const) {
    const absent = await render(request(path), { readTemplate, fetch: async () => new Response('', { status: 404 }) });
    assert.equal(absent.status, 404);
    const hiddenPayload = render === renderPublicOutingPage ? { outing: { ...outing, adminHidden: true } } : { ...user, accountStatus: 'suspended' };
    const hidden = await render(request(path), { readTemplate, fetch: async () => Response.json(hiddenPayload) });
    assert.equal(hidden.status, 404);
    assert.doesNotMatch(await hidden.text(), /公开的小队安排|公开邻居|PRIVATE_/);
    for (const status of [403, 429, 500]) {
      const failed = await render(request(path), { readTemplate, fetch: async () => new Response('', { status }) });
      assert.equal(failed.status, 503); assert.equal(failed.headers.get('retry-after'), '60');
    }
    const mismatch = render === renderPublicOutingPage ? { outing: { ...outing, id: 'other' } } : { ...user, id: 'other' };
    assert.equal((await render(request(path), { readTemplate, fetch: async () => Response.json(mismatch) })).status, 503);
    assert.equal((await render(request(path, 'HEAD'), { readTemplate, fetch: async () => Response.json(payload) })).status, 200);
    assert.equal(await (await render(request(path, 'HEAD'), { readTemplate, fetch: async () => Response.json(payload) })).text(), '');
  }
});

test('invalid identifiers, unsupported methods, incomplete builds and contradictory outing dates expose no content', async () => {
  const invalid = await renderPublicOutingPage(request('/api/outing-page?outingId=..%2Fsecret'), { readTemplate, fetch: async () => { throw new Error('must not fetch'); } });
  assert.equal(invalid.status, 404);
  const method = await renderPublicUserCardPage(request('/users/neighbor-1', 'POST'), { readTemplate });
  assert.equal(method.status, 405); assert.equal(method.headers.get('allow'), 'GET, HEAD');
  const missingBuild = await renderPublicUserCardPage(request('/users/neighbor-1'), { readTemplate: async () => { throw new Error('missing'); } });
  assert.equal(missingBuild.status, 503);
  for (const payload of [{ ...outing, startAt: Date.parse('2026-10-09T17:00:00Z') }, { ...outing, confirmedCount: 7 }, { ...outing, timezone: 'UTC' }]) {
    const malformed = await renderPublicOutingPage(request('/together?outing=outing_public'), { readTemplate, fetch: async () => Response.json({ outing: payload }) });
    assert.equal(malformed.status, 503);
    assert.doesNotMatch(await malformed.text(), /公开的小队安排|PRIVATE_/);
  }
});
