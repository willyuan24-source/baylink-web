import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDiningBill, DiningInputError, type DiningInput, type DiningField } from '../src/lib/dining-calculator';

const bill = (overrides: Partial<DiningInput> = {}): DiningInput => ({ subtotal: '80.00', tax: '8.25', serviceCharge: '12.00', tipPercent: '18', tipBasis: 'before-tax', people: '3', ...overrides });

test('dining totals keep existing service charges separate and distribute every cent exactly', () => {
  const result = calculateDiningBill(bill());
  assert.equal(result.tipBaseCents, 8000);
  assert.equal(result.tipCents, 1440);
  assert.equal(result.totalCents, 11465);
  assert.equal(result.baseShareCents, 3821);
  assert.equal(result.extraCentPeople, 2);
  assert.deepEqual(result.sharesCents, [3822, 3822, 3821]);
  assert.equal(result.sharesCents.reduce((sum, share) => sum + share, 0), result.totalCents);
  const afterTax = calculateDiningBill(bill({ tipBasis: 'after-tax' }));
  assert.equal(afterTax.tipBaseCents, 8825);
  assert.equal(afterTax.tipCents, 1589);
  assert.equal(afterTax.totalCents, 11614);
  assert.deepEqual(afterTax.sharesCents, [3872, 3871, 3871]);
});

test('decimal parsing and half-cent rounding do not lose cents through floating point money conversion', () => {
  const rounded = calculateDiningBill(bill({ subtotal: '1.10', tax: '', serviceCharge: '', tipPercent: '5', people: '1' }));
  assert.equal(rounded.subtotalCents, 110);
  assert.equal(rounded.tipCents, 6);
  assert.equal(rounded.totalCents, 116);
  assert.deepEqual(rounded.sharesCents, [116]);
  assert.equal(calculateDiningBill(bill({ subtotal: '.01', tax: '.01', serviceCharge: '', tipPercent: '12.50', tipBasis: 'after-tax' })).tipCents, 0);
});

test('zero additional tip preserves a service charge and zero-value bills remain valid', () => {
  const noTip = calculateDiningBill(bill({ tipPercent: '0' }));
  assert.equal(noTip.tipCents, 0);
  assert.equal(noTip.serviceChargeCents, 1200);
  assert.equal(noTip.totalCents, 10025);
  const zero = calculateDiningBill(bill({ subtotal: '0', tax: '', serviceCharge: '', people: '100' }));
  assert.equal(zero.totalCents, 0);
  assert.equal(zero.sharesCents.length, 100);
  assert.ok(zero.sharesCents.every(share => share === 0));
});

test('all supported group sizes conserve the total and differ by at most one cent', () => {
  for (let people = 1; people <= 100; people++) {
    for (const subtotal of ['.01', '.99', '100.10', '100000']) {
      const result = calculateDiningBill(bill({ subtotal, people: String(people), tipPercent: '19.99', tipBasis: 'after-tax' }));
      assert.equal(result.sharesCents.length, people);
      assert.equal(result.sharesCents.reduce((sum, value) => sum + value, 0), result.totalCents);
      assert.ok(Math.max(...result.sharesCents) - Math.min(...result.sharesCents) <= 1);
      assert.ok(result.sharesCents.every(Number.isSafeInteger));
    }
  }
  const maximum = calculateDiningBill(bill({ subtotal: '100000', tax: '100000', serviceCharge: '100000', tipPercent: '100', tipBasis: 'after-tax' }));
  assert.equal(maximum.totalCents, 50_000_000);
});

test('missing, negative, non-finite, imprecise and excessive inputs identify the offending field', () => {
  const cases: [DiningField, string][] = [
    ['subtotal', ''],
    ...(['subtotal', 'tax', 'serviceCharge'] as const).flatMap(field => ['-1', 'NaN', 'Infinity', '1e3', '1,000', '1.001', '100000.01', '9'.repeat(200)].map(value => [field, value] as [DiningField, string])),
    ...['', '-1', 'NaN', 'Infinity', '1e1', '18.001', '100.01'].map(value => ['tipPercent', value] as [DiningField, string]),
    ...['', '0', '-1', '1.5', 'NaN', 'Infinity', '101', '1e1'].map(value => ['people', value] as [DiningField, string]),
    ['tipBasis', 'unknown'],
  ];
  for (const [field, value] of cases) {
    assert.throws(() => calculateDiningBill(bill({ [field]: value })), (error: unknown) => error instanceof DiningInputError && error.field === field, `${field}: ${value}`);
  }
});
