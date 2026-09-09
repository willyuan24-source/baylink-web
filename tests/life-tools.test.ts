import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateRentalBudget,
  splitSharedBill,
  LifeToolValidationError,
  LIFE_TOOL_LIMITS,
  RENTAL_DEPOSIT_NOTE,
  type RentalBudgetInput,
  type SharedBillInput,
} from '../src/lib/life-tools';

const budget: RentalBudgetInput = { rent: 1900, utilities: 125.75, parking: 80, otherMonthly: 29.99, moving: 325.5, deposit: 1900 };

test('rental budget separates monthly expenses from moving costs and refundable deposit cash', () => {
  const result = calculateRentalBudget(budget);
  assert.equal(result.monthlyTotalCents, 213574);
  assert.equal(result.firstMonthCashCents, 436124);
  assert.equal(result.movingCostCents, 32550);
  assert.equal(result.refundableDepositCents, 190000);
  assert.deepEqual(result.monthlyBreakdown, { rentCents: 190000, utilitiesCents: 12575, parkingCents: 8000, otherMonthlyCents: 2999 });
  const withoutDeposit = calculateRentalBudget({ ...budget, deposit: 0 });
  assert.equal(withoutDeposit.monthlyTotalCents, result.monthlyTotalCents);
  assert.equal(result.firstMonthCashCents - withoutDeposit.firstMonthCashCents, 190000);
  assert.match(RENTAL_DEPOSIT_NOTE, /不计入每月开销/);
});

test('money conversion handles zero and ordinary decimal sums without inventing fractions of a cent', () => {
  const result = calculateRentalBudget({ rent: 0.1 + 0.2, utilities: 0.1, parking: 0.2, otherMonthly: 0, moving: 0, deposit: -0 });
  assert.equal(result.monthlyTotalCents, 60);
  assert.equal(result.firstMonthCashCents, 60);
  assert.equal(Object.is(result.refundableDepositCents, -0), false);
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0.001, 1_000_000.01, '12', null, undefined]) {
    assert.throws(() => calculateRentalBudget({ ...budget, rent: invalid as number }), (error: unknown) =>
      error instanceof LifeToolValidationError && error.field === 'rent' && error.message.length > 5,
    );
  }
  for (const field of ['utilities', 'parking', 'otherMonthly', 'moving', 'deposit'] as const) {
    assert.throws(() => calculateRentalBudget({ ...budget, [field]: -0.01 }), (error: unknown) =>
      error instanceof LifeToolValidationError && error.field === field,
    );
  }
});

test('equal shares allocate remainder cents deterministically in member order', () => {
  const input = { total: 10, members: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }] };
  assert.deepEqual(splitSharedBill(input), {
    totalCents: 1000,
    shares: [{ id: 'a', weight: 1, amountCents: 334 }, { id: 'b', weight: 1, amountCents: 333 }, { id: 'c', weight: 1, amountCents: 333 }],
  });
  assert.deepEqual(splitSharedBill(input), splitSharedBill(input));
  assert.deepEqual(splitSharedBill({ ...input, total: 0.02 }).shares.map((share) => share.amountCents), [1, 1, 0]);
});

test('weighted allocation awards the cent to the largest fractional share, not always the first person', () => {
  const result = splitSharedBill({ total: 0.01, members: [{ id: 'small', weight: 1 }, { id: 'large', weight: 2 }] });
  assert.deepEqual(result.shares.map((share) => share.amountCents), [0, 1]);
  const decimal = splitSharedBill({ total: 100, members: [{ id: 'a', weight: 1.5 }, { id: 'b', weight: 2.5 }] });
  assert.deepEqual(decimal.shares.map((share) => share.amountCents), [3750, 6250]);
});

test('splits conserve every cent at boundary amounts and across uneven fractional weights', () => {
  for (const total of [0, 0.01, 0.07, 10.01, 999999.99, LIFE_TOOL_LIMITS.maxAmountDollars]) {
    for (const weights of [[1], [0.0001, 10000], [0.3333, 0.6667, 2.5], Array.from({ length: 50 }, (_, index) => index + 1)]) {
      const result = splitSharedBill({ total, members: weights.map((weight, index) => ({ id: String(index), weight })) });
      assert.equal(result.shares.reduce((sum, share) => sum + share.amountCents, 0), result.totalCents);
      assert.ok(result.shares.every((share) => Number.isSafeInteger(share.amountCents) && share.amountCents >= 0));
    }
  }
  assert.deepEqual(splitSharedBill({ total: 0, members: [{ id: 'only', weight: 1 }] }).shares, [{ id: 'only', weight: 1, amountCents: 0 }]);
});

test('invalid bill amounts, weights, member identities and oversized lists fail clearly', () => {
  for (const total of [-1, NaN, Infinity, 0.001, 1000000.01]) {
    assert.throws(() => splitSharedBill({ total, members: [{ id: 'a', weight: 1 }] }), LifeToolValidationError);
  }
  for (const weight of [0, -0, -1, NaN, Infinity, 10000.01, 0.00001, '1', null, undefined]) {
    assert.throws(() => splitSharedBill({ total: 1, members: [{ id: 'a', weight: weight as number }] }), (error: unknown) =>
      error instanceof LifeToolValidationError && error.field === 'members.0.weight',
    );
  }
  for (const members of [[], [{ id: ' ', weight: 1 }], [{ id: 'a', weight: 1 }, { id: ' a ', weight: 1 }], [{ id: 'x'.repeat(81), weight: 1 }], Array.from({ length: 51 }, (_, index) => ({ id: String(index), weight: 1 })), [null]]) {
    assert.throws(() => splitSharedBill({ total: 1, members } as SharedBillInput), LifeToolValidationError);
  }
  assert.throws(() => splitSharedBill(null as unknown as SharedBillInput), LifeToolValidationError);
  assert.throws(() => calculateRentalBudget(null as unknown as RentalBudgetInput), LifeToolValidationError);
});

test('calculations do not mutate caller objects and results contain JSON-safe numbers only', () => {
  const rental = Object.freeze({ ...budget });
  calculateRentalBudget(rental);
  const input = Object.freeze({ total: 10, members: Object.freeze([Object.freeze({ id: ' first ', weight: 1 }), Object.freeze({ id: 'second', weight: 2 })]) });
  const result = splitSharedBill(input);
  assert.equal(input.members[0].id, ' first ');
  assert.equal(result.shares[0].id, 'first');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});
