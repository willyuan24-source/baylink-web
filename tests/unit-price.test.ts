import assert from 'node:assert/strict';
import test from 'node:test';
import { compareUnitPrices, formatUnitPrice, UnitPriceError, type UnitPriceInput } from '../src/lib/unit-price';

const product = (id: string, overrides: Partial<UnitPriceInput> = {}): UnitPriceInput => ({ id, name: '', packCount: '1', quantity: '100', unit: 'g', totalPrice: '1.00', ...overrides });
const closeTo = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('multipacks normalize grams and kilograms and report savings for equal quantities', () => {
  const result = compareUnitPrices([product('small', { packCount: '3', quantity: '500', totalPrice: '9.00' }), product('large', { quantity: '1.5', unit: 'kg', totalPrice: '8.25' })]);
  assert.equal(result.dimension, 'weight');
  assert.equal(result.standardAmount, 100);
  assert.deepEqual(result.results.map(row => [row.id, row.rank, row.unitPriceCents, row.savingPerStandardCents]), [['large', 1, 55, 0], ['small', 2, 60, 5]]);
  assert.equal(result.results[0].totalBaseQuantity, 1500);
  closeTo(result.savingsVersusHighestPercent, 100 / 12);
});

test('avoirdupois pound and 16 ounces tie exactly, without rounded conversion factors', () => {
  const result = compareUnitPrices([product('lb', { quantity: '1', unit: 'lb', totalPrice: '5' }), product('oz', { quantity: '16', unit: 'oz', totalPrice: '5' })]);
  assert.equal(result.allEqual, true);
  assert.deepEqual(result.results.map(row => [row.rank, row.isBest]), [[1, true], [1, true]]);
  assert.equal(result.results[0].totalBaseQuantity, 453.59237);
  assert.equal(result.savingsVersusHighestPercent, 0);
});

test('US liquid fluid ounces normalize to milliliters, with ranking before display rounding', () => {
  const ounces = compareUnitPrices([product('oz', { quantity: '8', unit: 'us-fl-oz', totalPrice: '2' }), product('liter', { quantity: '1', unit: 'L', totalPrice: '8' })]);
  assert.equal(ounces.dimension, 'volume');
  assert.equal(ounces.results[0].id, 'liter');
  assert.equal(ounces.results[1].totalBaseQuantity, 236.5882365);
  closeTo(ounces.results[1].unitPriceCents, 20000 / 236.5882365);
  const nearTie = compareUnitPrices([product('fl', { quantity: '33.814', unit: 'us-fl-oz' }), product('L', { quantity: '1', unit: 'L' })]);
  assert.deepEqual(nearTie.results.map(row => [row.id, row.rank]), [['L', 1], ['fl', 2]]);
  assert.equal(formatUnitPrice(nearTie.results[0].unitPriceCents), formatUnitPrice(nearTie.results[1].unitPriceCents));
  assert.ok(nearTie.results[1].savingPerStandardCents > 0);
});

test('count comparisons include multipack pieces and stable equal-price ranks', () => {
  const result = compareUnitPrices([
    product('a', { unit: 'piece', packCount: '2', quantity: '10', totalPrice: '4' }),
    product('b', { unit: 'piece', quantity: '20', totalPrice: '4' }),
    product('c', { unit: 'piece', quantity: '10', totalPrice: '3' }),
    product('d', { unit: 'piece', quantity: '20', totalPrice: '6' }),
  ]);
  assert.equal(result.standardAmount, 1);
  assert.deepEqual(result.results.map(row => [row.id, row.rank, row.unitPriceCents]), [['a', 1, 20], ['b', 1, 20], ['c', 3, 30], ['d', 3, 30]]);
  assert.throws(() => compareUnitPrices([product('a', { unit: 'piece', quantity: '1.5' }), product('b', { unit: 'piece' })]), /件数须为整数/);
});

test('weight, volume and count cannot be compared, even with identical numbers', () => {
  for (const unit of ['ml', 'piece'] as const) assert.throws(() => compareUnitPrices([product('weight'), product('other', { unit })]), /没有密度信息/);
  assert.throws(() => compareUnitPrices([product('volume', { unit: 'L' }), product('count', { unit: 'piece' })]), /须分别比较/);
});

test('zero totals remain valid, while very small positive unit prices never appear free', () => {
  const zero = compareUnitPrices([product('free', { totalPrice: '0' }), product('paid')]);
  assert.equal(zero.results[0].unitPriceCents, 0);
  assert.equal(zero.savingsVersusHighestPercent, 100);
  assert.equal(formatUnitPrice(0), '$0.00');
  const allFree = compareUnitPrices([product('a', { totalPrice: '0' }), product('b', { totalPrice: '0' })]);
  assert.equal(allFree.allEqual, true);
  assert.equal(allFree.savingsVersusHighestPercent, 0);
  const tiny = compareUnitPrices([product('a', { packCount: '10000', quantity: '1000000', unit: 'kg', totalPrice: '.01' }), product('b', { unit: 'kg' })]);
  assert.equal(formatUnitPrice(tiny.results[0].unitPriceCents), '<$0.000001');
});

test('incomplete, signed, imprecise or out-of-range inputs are rejected with the affected field', () => {
  const cases: [keyof UnitPriceInput, string][] = [
    ...['', '0', '1.5', '-1', '10001', '999999999999'].map(value => ['packCount', value] as [keyof UnitPriceInput, string]),
    ...['', '0', '-1', 'NaN', '1e3', '1,000', '0.00001', '1000001', 'Infinity'].map(value => ['quantity', value] as [keyof UnitPriceInput, string]),
    ...['', '-.01', '1.001', '1e2', '1000000.01'].map(value => ['totalPrice', value] as [keyof UnitPriceInput, string]),
  ];
  for (const [field, value] of cases) assert.throws(() => compareUnitPrices([product('bad', { [field]: value }), product('ok')]), (error: unknown) => error instanceof UnitPriceError && error.rowId === 'bad' && error.field === field, `${field}: ${value}`);
  assert.throws(() => compareUnitPrices([product('a')]), /2 至 4/);
  assert.throws(() => compareUnitPrices(Array.from({ length: 5 }, (_, i) => product(String(i)))), /2 至 4/);
  assert.throws(() => compareUnitPrices([product('same'), product('same')]), /编号重复/);
  assert.throws(() => compareUnitPrices([product('unknown', { unit: 'cup' as UnitPriceInput['unit'] }), product('ok')]), /支持的计量单位/);
});
