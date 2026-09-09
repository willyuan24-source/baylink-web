import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLoan, LOAN_LIMITS, LOAN_ROUNDING_NOTE, LoanValidationError, type LoanInput, type LoanSchedule } from '../src/lib/loan-calculator';

const standard: LoanInput = { principal: 800_000, annualInterestRate: 6, termYears: 30 };

const assertConservation = (schedule: LoanSchedule, principalCents: number) => {
  let previousBalance = principalCents;
  assert.equal(schedule.totalPrincipalCents, principalCents);
  assert.equal(schedule.totalPaidCents, principalCents + schedule.totalInterestCents);
  for (const [index, year] of schedule.annualSummary.entries()) {
    assert.equal(year.year, index + 1);
    assert.equal(year.paymentCents, year.principalCents + year.interestCents);
    assert.equal(year.balanceCents, previousBalance - year.principalCents);
    assert.ok(year.balanceCents >= 0 && year.balanceCents <= previousBalance);
    assert.ok(Object.values(year).every(value => Number.isSafeInteger(value) && value >= 0));
    previousBalance = year.balanceCents;
  }
  assert.equal(previousBalance, 0);
  assert.equal(schedule.annualSummary.reduce((sum, year) => sum + year.principalCents, 0), schedule.totalPrincipalCents);
  assert.equal(schedule.annualSummary.reduce((sum, year) => sum + year.interestCents, 0), schedule.totalInterestCents);
  assert.equal(schedule.annualSummary.reduce((sum, year) => sum + year.paymentCents, 0), schedule.totalPaidCents);
};

test('800,000 dollars at 6% for 30 years has a 4,796.40 dollar regular monthly payment', () => {
  const result = calculateLoan(standard);
  assert.equal(result.monthlyPaymentCents, 479640);
  assert.equal(result.scheduledMonths, 360);
  assert.equal(result.baseline.payoffMonths, 360);
  assert.equal(result.baseline.annualSummary.length, 30);
  assert.equal(result.minimumPaymentApplied, false);
  assert.deepEqual(result.baseline, result.accelerated);
  assert.equal(result.interestSavedCents, 0);
  assert.equal(result.monthsSaved, 0);
  assertConservation(result.baseline, 80_000_000);
});

test('zero-interest loans allocate principal only and adjust the last payment exactly', () => {
  const result = calculateLoan({ principal: 12000, annualInterestRate: 0, termYears: 1 });
  assert.equal(result.monthlyPaymentCents, 100000);
  assert.deepEqual(result.baseline.annualSummary, [{ year: 1, principalCents: 1200000, interestCents: 0, paymentCents: 1200000, balanceCents: 0 }]);
  assert.equal(result.baseline.payoffMonths, 12);
  assert.equal(result.baseline.totalInterestCents, 0);
  const cents = calculateLoan({ principal: 1, annualInterestRate: 0, termYears: 1 });
  assert.equal(cents.monthlyPaymentCents, 8);
  assert.equal(cents.baseline.lastPaymentCents, 12);
  assert.equal(cents.baseline.finalPaymentAdjustmentCents, 4);
  assert.equal(cents.baseline.totalPaidCents, 100);
  const early = calculateLoan({ principal: 0.18, annualInterestRate: 0, termYears: 1 });
  assert.equal(early.monthlyPaymentCents, 2, 'half-cent monthly payments round up');
  assert.equal(early.baseline.payoffMonths, 9);
  assert.equal(early.monthsSaved, 0, 'savings compare actual baseline months, not the stated term');
});

test('zero principal has no payments while positive sub-cent monthly payments use a one-cent minimum', () => {
  const zero = calculateLoan({ principal: -0, annualInterestRate: 30, termYears: 50, extraMonthly: 100 });
  assert.equal(zero.monthlyPaymentCents, 0);
  assert.equal(Object.is(zero.principalCents, -0), false);
  assert.deepEqual(zero.baseline, { totalPrincipalCents: 0, totalInterestCents: 0, totalPaidCents: 0, payoffMonths: 0, lastPaymentCents: 0, finalPaymentAdjustmentCents: 0, annualSummary: [] });
  assert.deepEqual(zero.accelerated, zero.baseline);
  for (const rate of [0, 0.0001, 30]) {
    const tiny = calculateLoan({ principal: 0.01, annualInterestRate: rate, termYears: 50 });
    assert.equal(tiny.monthlyPaymentCents, 1);
    assert.equal(tiny.minimumPaymentApplied, true);
    assert.equal(tiny.baseline.payoffMonths, 1);
    assert.equal(tiny.baseline.totalPaidCents, 1);
    assertConservation(tiny.baseline, 1);
  }
  assert.match(LOAN_ROUNDING_NOTE, /最低为 1 美分/);
});

test('the lowest accepted positive interest rate remains finite and close to the zero-rate payment', () => {
  const result = calculateLoan({ principal: 100_000_000, annualInterestRate: 0.0001, termYears: 50 });
  assert.equal(result.monthlyPaymentCents, 16667084);
  assert.ok(result.baseline.totalInterestCents > 0);
  assertConservation(result.baseline, 10_000_000_000);
});

test('extra monthly principal shortens repayment and reduces actual interest without changing the base payment', () => {
  const result = calculateLoan({ ...standard, extraMonthly: 500 });
  assert.equal(result.monthlyPaymentCents, 479640);
  assert.equal(result.extraMonthlyCents, 50000);
  assert.ok(result.accelerated.payoffMonths < result.baseline.payoffMonths);
  assert.ok(result.accelerated.totalInterestCents < result.baseline.totalInterestCents);
  assert.equal(result.monthsSaved, result.baseline.payoffMonths - result.accelerated.payoffMonths);
  assert.equal(result.interestSavedCents, result.baseline.totalInterestCents - result.accelerated.totalInterestCents);
  assert.ok(result.accelerated.lastPaymentCents <= result.monthlyPaymentCents + result.extraMonthlyCents);
  assertConservation(result.accelerated, result.principalCents);
  const immediate = calculateLoan({ principal: 100, annualInterestRate: 12, termYears: 10, extraMonthly: 1_000_000 });
  assert.equal(immediate.accelerated.payoffMonths, 1);
  assert.equal(immediate.accelerated.lastPaymentCents, 10100);
  assert.equal(immediate.accelerated.totalInterestCents, 100);
  assertConservation(immediate.accelerated, 10000);
});

test('cent-rounded interest uses half-up rounding and surfaces a large terminal adjustment when necessary', () => {
  const halfCent = calculateLoan({ principal: 0.2, annualInterestRate: 30, termYears: 50 });
  assert.equal(halfCent.monthlyPaymentCents, 1);
  assert.equal(halfCent.baseline.totalInterestCents, 600, '0.5 cent monthly interest rounds to one cent');
  assert.equal(halfCent.baseline.lastPaymentCents, 21);
  assert.equal(halfCent.baseline.finalPaymentAdjustmentCents, 20);
  assertConservation(halfCent.baseline, 20);
  const roundedInterestOnly = calculateLoan({ principal: 100_000, annualInterestRate: 30, termYears: 50 });
  assert.equal(roundedInterestOnly.monthlyPaymentCents, 250000);
  assert.equal(roundedInterestOnly.baseline.payoffMonths, 600);
  assert.equal(roundedInterestOnly.baseline.lastPaymentCents, 10250000);
  assert.equal(roundedInterestOnly.baseline.finalPaymentAdjustmentCents, 10000000);
  assert.equal(roundedInterestOnly.baseline.annualSummary[0].principalCents, 0);
  assertConservation(roundedInterestOnly.baseline, 10000000);
});

test('supported extremes and varied fractional amounts conserve safe integer cents without negative balances', () => {
  for (const principal of [0.07, 1.01, 1234.56, LOAN_LIMITS.maxPrincipalDollars]) {
    for (const annualInterestRate of [0, 0.0001, 6.1234, LOAN_LIMITS.maxAnnualInterestRate]) {
      for (const termYears of [1, 50]) {
        const result = calculateLoan({ principal, annualInterestRate, termYears, extraMonthly: principal < 2 ? 0.01 : LOAN_LIMITS.maxExtraMonthlyDollars });
        for (const schedule of [result.baseline, result.accelerated]) {
          assertConservation(schedule, Math.round(principal * 100));
          assert.ok(schedule.payoffMonths >= 1 && schedule.payoffMonths <= termYears * 12);
          assert.ok(Number.isSafeInteger(schedule.totalPaidCents));
        }
        assert.ok(result.interestSavedCents >= 0);
        assert.ok(result.monthsSaved >= 0);
      }
    }
  }
});

test('invalid amounts, rates, terms, precision and runtime types produce field-specific errors', () => {
  const invalidByField = {
    principal: [-1, NaN, Infinity, 100_000_000.01, 0.001, 1e-20, '100', null, undefined],
    annualInterestRate: [-0.0001, NaN, Infinity, 30.0001, 0.00001, 1e-20, '6', null, undefined],
    termYears: [0, -1, 1.5, 51, NaN, Infinity, '30', null, undefined],
    extraMonthly: [-0.01, NaN, Infinity, 1_000_000.01, 0.001, 1e-20, '100', null],
  };
  for (const [field, invalid] of Object.entries(invalidByField)) {
    for (const value of invalid) {
      assert.throws(() => calculateLoan({ ...standard, [field]: value } as LoanInput), (error: unknown) =>
        error instanceof LoanValidationError && error.field === field && error.message.length > 5,
      );
    }
  }
  for (const input of [null, undefined, [], 'loan', 10]) {
    assert.throws(() => calculateLoan(input as unknown as LoanInput), (error: unknown) =>
      error instanceof LoanValidationError && error.field === 'loan',
    );
  }
});

test('ordinary floating-point noise is accepted, inputs are not mutated, and results are JSON-safe', () => {
  const input = Object.freeze({ principal: 0.1 + 0.2, annualInterestRate: 0.1 + 0.2, termYears: 1, extraMonthly: 0.01 });
  const result = calculateLoan(input);
  assert.equal(result.principalCents, 30);
  assert.equal(input.principal, 0.1 + 0.2);
  assert.deepEqual(result, calculateLoan(input));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  result.accelerated.annualSummary[0].principalCents = 999;
  assert.equal(result.baseline.totalPrincipalCents, 30);
  assert.notEqual(result.baseline.annualSummary[0].principalCents, 999);
});
