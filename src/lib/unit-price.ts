// NIST customary units: 1 lb = 453.59237 g; 16 oz = 1 lb.
// 1 US fl oz = (231 / 128) in³, with 1 in = 2.54 cm exactly.
// Reference: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8
export const UNIT_PRICE_UNITS = [
  { id: 'g', label: 'g 克', dimension: 'weight', numerator: 1n, denominator: 1n },
  { id: 'kg', label: 'kg 千克', dimension: 'weight', numerator: 1000n, denominator: 1n },
  { id: 'oz', label: 'oz 盎司（重量）', dimension: 'weight', numerator: 226796185n, denominator: 8000000n },
  { id: 'lb', label: 'lb 磅', dimension: 'weight', numerator: 45359237n, denominator: 100000n },
  { id: 'ml', label: 'ml 毫升', dimension: 'volume', numerator: 1n, denominator: 1n },
  { id: 'L', label: 'L 升', dimension: 'volume', numerator: 1000n, denominator: 1n },
  { id: 'us-fl-oz', label: 'US fl oz 美制液体盎司', dimension: 'volume', numerator: 473176473n, denominator: 16000000n },
  { id: 'piece', label: '件', dimension: 'count', numerator: 1n, denominator: 1n },
] as const;

export type UnitPriceUnit = typeof UNIT_PRICE_UNITS[number]['id'];
export type UnitPriceDimension = typeof UNIT_PRICE_UNITS[number]['dimension'];
export type UnitPriceInput = { id: string; name: string; packCount: string; quantity: string; unit: UnitPriceUnit; totalPrice: string };
type InputField = 'packCount' | 'quantity' | 'totalPrice' | 'unit';

export class UnitPriceError extends Error {
  rowId?: string;
  field?: InputField;
  constructor(message: string, rowId?: string, field?: InputField) {
    super(message);
    this.name = 'UnitPriceError';
    this.rowId = rowId;
    this.field = field;
  }
}

export type UnitPriceResult = {
  id: string; name: string; inputIndex: number; rank: number; isBest: boolean;
  totalBaseQuantity: number; totalPriceCents: number; unitPriceCents: number; savingPerStandardCents: number;
};
export type UnitPriceComparison = {
  dimension: UnitPriceDimension; standardAmount: 1 | 100; results: UnitPriceResult[];
  allEqual: boolean; savingsVersusHighestPercent: number;
};

const quantityPattern = /^(?:\d+(?:\.\d{1,4})?|\.\d{1,4})$/;
const pricePattern = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
function decimalInteger(value: string, places: number): bigint {
  const [whole, fractional = ''] = value.split('.');
  return BigInt(whole || '0') * 10n ** BigInt(places) + BigInt(fractional.padEnd(places, '0') || '0');
}
type Ratio = { numerator: bigint; denominator: bigint };
const compareRatio = (a: Ratio, b: Ratio) => {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};
const ratioNumber = (ratio: Ratio) => Number(ratio.numerator) / Number(ratio.denominator);

/** International avoirdupois ounces/pounds and US liquid fluid ounces, with exact rational ranking. */
export function compareUnitPrices(inputs: UnitPriceInput[]): UnitPriceComparison {
  if (inputs.length < 2 || inputs.length > 4) throw new UnitPriceError('请比较 2 至 4 个商品。');
  if (new Set(inputs.map(input => input.id)).size !== inputs.length) throw new UnitPriceError('商品编号重复，请清空后重新输入。');
  const rows = inputs.map((input, inputIndex) => {
    const unit = UNIT_PRICE_UNITS.find(item => item.id === input.unit);
    if (!unit) throw new UnitPriceError('请选择支持的计量单位。', input.id, 'unit');
    const packs = input.packCount.trim();
    const amount = input.quantity.trim();
    const price = input.totalPrice.trim();
    if (!/^\d{1,5}$/.test(packs) || Number(packs) < 1 || Number(packs) > 10000) throw new UnitPriceError('包数须为 1 至 10000 的整数。', input.id, 'packCount');
    if (amount.length > 16 || !quantityPattern.test(amount)) throw new UnitPriceError('每包数量须为正数，最多 4 位小数。', input.id, 'quantity');
    const quantity = decimalInteger(amount, 4);
    if (quantity <= 0n || quantity > 10000000000n) throw new UnitPriceError('每包数量须大于 0，且不超过 1000000。', input.id, 'quantity');
    if (unit.dimension === 'count' && quantity % 10000n !== 0n) throw new UnitPriceError('按件比较时，每包件数须为整数。', input.id, 'quantity');
    if (price.length > 16 || !pricePattern.test(price)) throw new UnitPriceError('实付总价须为零或正数，最多 2 位小数。', input.id, 'totalPrice');
    const cents = decimalInteger(price, 2);
    if (cents > 100000000n) throw new UnitPriceError('实付总价不能超过 $1,000,000。', input.id, 'totalPrice');
    const baseQuantity: Ratio = { numerator: quantity * BigInt(packs) * unit.numerator, denominator: 10000n * unit.denominator };
    const standardAmount = unit.dimension === 'count' ? 1 : 100;
    const unitPrice: Ratio = { numerator: cents * baseQuantity.denominator * BigInt(standardAmount), denominator: baseQuantity.numerator };
    return { input, inputIndex, dimension: unit.dimension, baseQuantity, cents, unitPrice };
  });
  const dimension = rows[0].dimension;
  if (rows.some(row => row.dimension !== dimension)) throw new UnitPriceError('重量、容量和件数须分别比较；没有密度信息，不能把克换成毫升。');
  rows.sort((a, b) => compareRatio(a.unitPrice, b.unitPrice) || a.inputIndex - b.inputIndex);
  const best = rows[0].unitPrice;
  const highest = rows[rows.length - 1].unitPrice;
  let rank = 1;
  const results = rows.map((row, index): UnitPriceResult => {
    if (index && compareRatio(row.unitPrice, rows[index - 1].unitPrice) !== 0) rank = index + 1;
    const savings: Ratio = { numerator: row.unitPrice.numerator * best.denominator - best.numerator * row.unitPrice.denominator, denominator: row.unitPrice.denominator * best.denominator };
    return {
      id: row.input.id, name: row.input.name.trim(), inputIndex: row.inputIndex, rank, isBest: compareRatio(row.unitPrice, best) === 0,
      totalBaseQuantity: ratioNumber(row.baseQuantity), totalPriceCents: Number(row.cents),
      unitPriceCents: ratioNumber(row.unitPrice), savingPerStandardCents: ratioNumber(savings),
    };
  });
  return {
    dimension, standardAmount: dimension === 'count' ? 1 : 100, results,
    allEqual: compareRatio(best, highest) === 0,
    savingsVersusHighestPercent: highest.numerator === 0n ? 0 : ratioNumber({ numerator: (highest.numerator * best.denominator - best.numerator * highest.denominator) * 100n, denominator: highest.numerator * best.denominator }),
  };
}

/** Positive prices smaller than the display precision must never look free. */
export function formatUnitPrice(cents: number): string {
  const dollars = cents / 100;
  if (dollars > 0 && dollars < 0.000001) return '<$0.000001';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(dollars);
}
