import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnit, UNIT_PAIRS } from '../src/lib/unit-conversion';

test('everyday unit conversions use US units and preserve reverse conversions', () => {
  assert.equal(convertUnit(32, 'temperature'), 0);
  assert.ok(Math.abs(convertUnit(212, 'temperature') - 100) < 1e-10);
  assert.equal(convertUnit(1, 'distance'), 1.609344);
  assert.equal(convertUnit(1, 'volume'), 3.785411784);
  assert.ok(Math.abs(convertUnit(100, 'area') - 9.290304) < 1e-10);
  for (const pair of UNIT_PAIRS) assert.ok(Math.abs(convertUnit(convertUnit(123.45, pair.id), pair.id, true) - 123.45) < 1e-9);
});
test('invalid numbers and impossible temperatures are rejected without breaking negative temperatures', () => {
  for (const value of [NaN, Infinity, -Infinity, 1e12]) assert.throws(() => convertUnit(value, 'distance'));
  assert.throws(() => convertUnit(-1, 'area'));
  assert.throws(() => convertUnit(-460, 'temperature'));
  assert.throws(() => convertUnit(-274, 'temperature', true));
  assert.ok(convertUnit(-10, 'temperature') < 0);
  assert.ok(Math.abs(convertUnit(-273.15, 'temperature', true) + 459.67) < 1e-9);
});
