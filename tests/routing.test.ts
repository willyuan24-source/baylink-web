import assert from 'node:assert/strict';
import test from 'node:test';
import { getCategoryFromSlug, getSlugFromCategory, isKnownAppPath } from '../src/routing';

test('unknown routes and inherited object properties cannot become indexable categories', () => {
  for (const path of ['/not-real', '/category/unknown', '/category/constructor', '/category/__proto__', '/posts/id/extra', '/users/id/extra']) assert.equal(isKnownAppPath(path), false, path);
  assert.equal(getCategoryFromSlug('constructor'), '全部');
  assert.equal(getSlugFromCategory('__proto__'), null);
});

test('known category aggregates and supported deep links are recognized exactly', () => {
  for (const path of ['/', '/category/service', '/category/moving/', '/posts/post-id', '/messages/thread-id', '/guides/local-service-safety-guide']) assert.equal(isKnownAppPath(path), true, path);
  assert.equal(getCategoryFromSlug('service'), '本地服务');
});
