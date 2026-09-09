import assert from 'node:assert/strict';
import test from 'node:test';
import { postAvailability } from '../src/lib/postAvailability';

const now = Date.UTC(2026, 8, 8);
const day = 86_400_000;
const active = { category: '租屋', type: 'provider' as const, status: 'active' as const };

test('legacy posts and invalid or future confirmation dates cannot claim confirmed availability', () => {
  for (const confirmedAt of [undefined, null, 0, -1, NaN, Infinity, now + day]) {
    const result = postAvailability({ ...active, confirmedAt }, now);
    assert.equal(result.label, '待确认有效');
    assert.equal(result.tone, 'unconfirmed');
  }
});

test('only a recent explicit publisher confirmation produces confirmed copy', () => {
  assert.equal(postAvailability({ ...active, confirmedAt: now }, now).label, '今天确认有效');
  assert.equal(postAvailability({ ...active, confirmedAt: now - 30 * day }, now).tone, 'confirmed');
  const expired = postAvailability({ ...active, confirmedAt: now - 31 * day }, now);
  assert.equal(expired.tone, 'unconfirmed');
  assert.match(expired.detail, /31 天前/);
});

test('closed status takes precedence over recent confirmation and reflects the posting purpose', () => {
  for (const [category, type, label] of [
    ['租屋', 'provider', '已出租'], ['闲置', 'provider', '已售出'],
    ['清洁', 'provider', '已结束'], ['租屋', 'client', '已解决'],
  ] as const) {
    const result = postAvailability({ category, type, status: 'closed', confirmedAt: now }, now);
    assert.equal(result.label, label);
    assert.equal(result.tone, 'closed');
  }
});
