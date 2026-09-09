/** All inputs are local values in USD; every monetary result is an integer number of cents. */
export const LIFE_TOOL_LIMITS = Object.freeze({
  maxAmountDollars: 1_000_000,
  maxWeight: 10_000,
  maxMembers: 50,
  weightDecimalPlaces: 4,
});

export const RENTAL_DEPOSIT_NOTE = '押金属于可能退还的资金占用，不计入每月开销；实际退还以约定和结算结果为准。';

export class LifeToolValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'LifeToolValidationError';
    this.field = field;
  }
}

export type RentalBudgetInput = {
  rent: number;
  utilities: number;
  parking: number;
  otherMonthly: number;
  moving: number;
  deposit: number;
};

export type RentalBudgetResult = {
  monthlyTotalCents: number;
  firstMonthCashCents: number;
  movingCostCents: number;
  refundableDepositCents: number;
  monthlyBreakdown: {
    rentCents: number;
    utilitiesCents: number;
    parkingCents: number;
    otherMonthlyCents: number;
  };
};

export type SharedBillMember = { id: string; weight: number };
export type SharedBillInput = { total: number; members: readonly SharedBillMember[] };
export type SharedBillShare = { id: string; weight: number; amountCents: number };
export type SharedBillResult = { totalCents: number; shares: SharedBillShare[] };

const requireObject = (value: unknown, field: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LifeToolValidationError(field, '请提供完整的计算项目。');
  }
};

/** Accept ordinary binary floating-point noise (0.1 + 0.2), not additional decimal precision. */
const scaledInteger = (value: number, scale: number, field: string, label: string, decimals: number): number => {
  const scaled = value * scale;
  const integer = Math.round(scaled);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  if (Math.abs(scaled - integer) > tolerance) {
    throw new LifeToolValidationError(field, `${label}最多填写 ${decimals} 位小数。`);
  }
  return integer === 0 ? 0 : integer;
};

const moneyCents = (value: number, field: string, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LifeToolValidationError(field, `${label}必须是有效数字。`);
  }
  if (value < 0 || value > LIFE_TOOL_LIMITS.maxAmountDollars) {
    throw new LifeToolValidationError(field, `${label}须在 0 至 1,000,000 美元之间。`);
  }
  return scaledInteger(value, 100, field, label, 2);
};

/** Deposits and one-time moving costs affect first-month cash only, never recurring expenses. */
export function calculateRentalBudget(input: RentalBudgetInput): RentalBudgetResult {
  requireObject(input, 'budget');
  const monthlyBreakdown = {
    rentCents: moneyCents(input.rent, 'rent', '月租'),
    utilitiesCents: moneyCents(input.utilities, 'utilities', '每月水电网费用'),
    parkingCents: moneyCents(input.parking, 'parking', '每月停车费'),
    otherMonthlyCents: moneyCents(input.otherMonthly, 'otherMonthly', '其他固定月费'),
  };
  const movingCostCents = moneyCents(input.moving, 'moving', '一次性搬家费');
  const refundableDepositCents = moneyCents(input.deposit, 'deposit', '押金');
  const monthlyTotalCents = Object.values(monthlyBreakdown).reduce((total, amount) => total + amount, 0);
  return {
    monthlyBreakdown,
    monthlyTotalCents,
    movingCostCents,
    refundableDepositCents,
    firstMonthCashCents: monthlyTotalCents + movingCostCents + refundableDepositCents,
  };
}

/**
 * Largest-remainder allocation: whole cents first, then remaining cents by fractional share.
 * Equal remainders use input order. BigInt products keep even the supported upper bounds exact.
 * IDs are trimmed, weights allow four decimal places, and input objects are never modified.
 */
export function splitSharedBill(input: SharedBillInput): SharedBillResult {
  requireObject(input, 'bill');
  const totalCents = moneyCents(input.total, 'total', '账单总额');
  if (!Array.isArray(input.members) || input.members.length < 1 || input.members.length > LIFE_TOOL_LIMITS.maxMembers) {
    throw new LifeToolValidationError('members', '请填写 1 至 50 位分摊成员。');
  }
  const seenIds = new Set<string>();
  const members = input.members.map((member, index) => {
    const field = `members.${index}`;
    requireObject(member, field);
    if (typeof member.id !== 'string' || !member.id.trim() || member.id.trim().length > 80) {
      throw new LifeToolValidationError(`${field}.id`, `第 ${index + 1} 位成员需要 1 至 80 字的标识。`);
    }
    const id = member.id.trim();
    if (seenIds.has(id)) throw new LifeToolValidationError(`${field}.id`, '成员标识不能重复。');
    seenIds.add(id);
    const weight = member.weight;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > LIFE_TOOL_LIMITS.maxWeight) {
      throw new LifeToolValidationError(`${field}.weight`, `第 ${index + 1} 位成员的权重须大于 0 且不超过 10,000。`);
    }
    const units = scaledInteger(weight, 10_000, `${field}.weight`, `第 ${index + 1} 位成员的权重`, LIFE_TOOL_LIMITS.weightDecimalPlaces);
    if (units <= 0) throw new LifeToolValidationError(`${field}.weight`, '权重最小为 0.0001。');
    return { id, weight: units / 10_000, units: BigInt(units) };
  });
  const totalWeight = members.reduce((sum, member) => sum + member.units, 0n);
  const allocated = members.map((member, index) => {
    const numerator = BigInt(totalCents) * member.units;
    return {
      id: member.id, weight: member.weight, index,
      amountCents: Number(numerator / totalWeight), remainder: numerator % totalWeight,
    };
  });
  const remainingCents = totalCents - allocated.reduce((sum, member) => sum + member.amountCents, 0);
  const remainderOrder = [...allocated].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (let index = 0; index < remainingCents; index += 1) remainderOrder[index].amountCents += 1;
  return { totalCents, shares: allocated.map(({ id, weight, amountCents }) => ({ id, weight, amountCents })) };
}
