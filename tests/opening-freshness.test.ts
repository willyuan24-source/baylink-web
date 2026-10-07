import assert from 'node:assert/strict';
import test from 'node:test';
import { openingFreshnessLabel } from '../src/lib/opening-freshness';

test('recent opening claims require real past first-service and review dates, with exact age boundaries', () => {
  const shop = { status: 'open' as const, openedOn: '2026-08-08', verifiedAt: '2026-11-01' };
  assert.equal(openingFreshnessLabel(shop, '2026-11-06'), '实际首日营业在近 90 天内。');
  assert.equal(openingFreshnessLabel(shop, '2026-11-07'), '保留营业记录，已不属于近 90 天新开。');
  assert.equal(openingFreshnessLabel({ ...shop, openedOn: undefined }, '2026-11-06'), '营业情况近期核查；首日营业日期未确认。');
  for (const openedOn of ['2026-11-07', '2026-02-30']) assert.equal(openingFreshnessLabel({ ...shop, openedOn }, '2026-11-06'), '首日营业日期待核实，暂不按近期新开推荐。');
  for (const verifiedAt of ['2026-11-07', '2026-10-06', '2026-02-30']) assert.equal(openingFreshnessLabel({ ...shop, verifiedAt }, '2026-11-06'), '营业记录需要重新核查，出发前请确认当前状态。');
  assert.equal(openingFreshnessLabel({ ...shop, verifiedAt: '2026-10-07' }, '2026-11-05'), '实际首日营业在近 90 天内。');
  assert.equal(openingFreshnessLabel({ ...shop, verifiedAt: '2026-10-07' }, '2026-11-06'), '营业记录需要重新核查，出发前请确认当前状态。');
  assert.equal(openingFreshnessLabel({ ...shop, status: 'announced' }, '2027-01-01'), '仍为预告，尚未确认开始营业。');
});
