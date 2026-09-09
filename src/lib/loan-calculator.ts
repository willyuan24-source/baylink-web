/** Local estimates only: inputs use USD and annual percentage points; outputs use integer cents. */
export const LOAN_LIMITS = Object.freeze({
  maxPrincipalDollars: 100_000_000,
  maxAnnualInterestRate: 30,
  minTermYears: 1,
  maxTermYears: 50,
  maxExtraMonthlyDollars: 1_000_000,
});

export const LOAN_ROUNDING_NOTE = '月供和每期利息四舍五入至美分；正本金的月供最低为 1 美分。按月计息，额外还款在支付当期利息后抵扣本金；最后一期调整至结清余额，可能高于或低于常规月供。';

export type LoanInput = Readonly<{
  principal: number;
  annualInterestRate: number;
  termYears: number;
  extraMonthly?: number;
}>;

export type LoanInputField = keyof LoanInput | 'loan';

export class LoanValidationError extends Error {
  readonly field: LoanInputField;

  constructor(message: string, field: LoanInputField) {
    super(message);
    this.name = 'LoanValidationError';
    this.field = field;
  }
}

export type LoanAnnualSummary = {
  /** One-based loan year, not a calendar year. The last year may contain fewer than 12 payments. */
  year: number;
  principalCents: number;
  interestCents: number;
  paymentCents: number;
  balanceCents: number;
};

export type LoanSchedule = {
  totalPrincipalCents: number;
  totalInterestCents: number;
  totalPaidCents: number;
  payoffMonths: number;
  lastPaymentCents: number;
  /** Last payment minus the planned monthly payment (including extra principal). May be negative. */
  finalPaymentAdjustmentCents: number;
  annualSummary: LoanAnnualSummary[];
};

export type LoanResult = {
  principalCents: number;
  scheduledMonths: number;
  /** Formula payment rounded half up to cents, with a one-cent minimum for positive principal. */
  monthlyPaymentCents: number;
  minimumPaymentApplied: boolean;
  extraMonthlyCents: number;
  baseline: LoanSchedule;
  accelerated: LoanSchedule;
  interestSavedCents: number;
  monthsSaved: number;
};

const scaledInput = (value: number, scale: number, maximum: number, field: LoanInputField, label: string, decimals: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LoanValidationError(`${label}必须是有效数字。`, field);
  }
  if (value < 0 || value > maximum) {
    throw new LoanValidationError(`${label}须在 0 至 ${maximum.toLocaleString('en-US')} 之间。`, field);
  }
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  // Permit binary representation noise (e.g. 0.1 + 0.2), but never turn a positive fraction into zero.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  if ((value !== 0 && rounded === 0) || Math.abs(scaled - rounded) > tolerance) {
    throw new LoanValidationError(`${label}最多填写 ${decimals} 位小数。`, field);
  }
  return rounded === 0 ? 0 : rounded;
};

const RATE_DENOMINATOR = 12_000_000n; // annual percentage * 10,000, divided by 100 and 12 months.

/** Exact nonnegative half-up rounding; each month's interest is calculated on the opening balance. */
const monthlyInterest = (balanceCents: number, annualRateUnits: number): number =>
  Number((BigInt(balanceCents) * BigInt(annualRateUnits) + RATE_DENOMINATOR / 2n) / RATE_DENOMINATOR);

const simulate = (principalCents: number, annualRateUnits: number, scheduledMonths: number, plannedPaymentCents: number): LoanSchedule => {
  const annualSummary: LoanAnnualSummary[] = [];
  let balanceCents = principalCents;
  let totalInterestCents = 0;
  let totalPaidCents = 0;
  let payoffMonths = 0;
  let lastPaymentCents = 0;

  // The fixed term bounds the simulation even if cent rounding prevents principal reduction.
  for (let month = 1; month <= scheduledMonths && balanceCents > 0; month += 1) {
    const interestCents = monthlyInterest(balanceCents, annualRateUnits);
    const amountDueCents = balanceCents + interestCents;
    const paymentCents = month === scheduledMonths ? amountDueCents : Math.min(plannedPaymentCents, amountDueCents);
    const principalPaidCents = paymentCents - interestCents;
    balanceCents -= principalPaidCents;
    totalInterestCents += interestCents;
    totalPaidCents += paymentCents;
    payoffMonths = month;
    lastPaymentCents = paymentCents;

    const year = Math.ceil(month / 12);
    let summary = annualSummary[year - 1];
    if (!summary) {
      summary = { year, principalCents: 0, interestCents: 0, paymentCents: 0, balanceCents: 0 };
      annualSummary.push(summary);
    }
    summary.principalCents += principalPaidCents;
    summary.interestCents += interestCents;
    summary.paymentCents += paymentCents;
    summary.balanceCents = balanceCents;
  }

  return {
    totalPrincipalCents: principalCents - balanceCents,
    totalInterestCents,
    totalPaidCents,
    payoffMonths,
    lastPaymentCents,
    finalPaymentAdjustmentCents: payoffMonths ? lastPaymentCents - plannedPaymentCents : 0,
    annualSummary,
  };
};

/**
 * Fixed nominal annual interest, monthly compounding, payments at each month end.
 * No fees, tax, insurance, rate changes or prepayment penalties are assumed.
 * log1p/expm1 avoid cancellation at very small positive interest rates.
 * Both schedules use cent-rounded monthly interest and settle any residual at the original term.
 */
export function calculateLoan(input: LoanInput): LoanResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new LoanValidationError('请提供完整的贷款计算项目。', 'loan');
  }
  const principalCents = scaledInput(input.principal, 100, LOAN_LIMITS.maxPrincipalDollars, 'principal', '贷款本金（美元）', 2);
  const annualRateUnits = scaledInput(input.annualInterestRate, 10_000, LOAN_LIMITS.maxAnnualInterestRate, 'annualInterestRate', '年利率（%）', 4);
  const extraMonthlyCents = scaledInput(input.extraMonthly === undefined ? 0 : input.extraMonthly, 100, LOAN_LIMITS.maxExtraMonthlyDollars, 'extraMonthly', '每月额外还本金（美元）', 2);
  if (typeof input.termYears !== 'number' || !Number.isInteger(input.termYears) || input.termYears < LOAN_LIMITS.minTermYears || input.termYears > LOAN_LIMITS.maxTermYears) {
    throw new LoanValidationError('贷款年限须为 1 至 50 的整数。', 'termYears');
  }
  const scheduledMonths = input.termYears * 12;
  const monthlyRate = annualRateUnits / Number(RATE_DENOMINATOR);
  const formulaPaymentCents = annualRateUnits === 0
    ? principalCents / scheduledMonths
    : principalCents * monthlyRate / -Math.expm1(-scheduledMonths * Math.log1p(monthlyRate));
  const roundedPaymentCents = Math.round(formulaPaymentCents);
  const minimumPaymentApplied = principalCents > 0 && roundedPaymentCents === 0;
  const monthlyPaymentCents = principalCents > 0 ? Math.max(1, roundedPaymentCents) : 0;
  const baseline = simulate(principalCents, annualRateUnits, scheduledMonths, monthlyPaymentCents);
  const accelerated = simulate(principalCents, annualRateUnits, scheduledMonths, monthlyPaymentCents + extraMonthlyCents);

  return {
    principalCents,
    scheduledMonths,
    monthlyPaymentCents,
    minimumPaymentApplied,
    extraMonthlyCents,
    baseline,
    accelerated,
    interestSavedCents: baseline.totalInterestCents - accelerated.totalInterestCents,
    monthsSaved: baseline.payoffMonths - accelerated.payoffMonths,
  };
}
