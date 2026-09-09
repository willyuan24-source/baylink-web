export type DiningInput = {
  subtotal: string;
  tax: string;
  serviceCharge: string;
  tipPercent: string;
  tipBasis: 'before-tax' | 'after-tax';
  people: string;
};
export type DiningField = keyof DiningInput;

export class DiningInputError extends Error {
  field: DiningField;
  constructor(message: string, field: DiningField) {
    super(message);
    this.name = 'DiningInputError';
    this.field = field;
  }
}

export type DiningResult = {
  subtotalCents: number;
  taxCents: number;
  serviceChargeCents: number;
  tipBaseCents: number;
  tipPercent: number;
  tipCents: number;
  totalCents: number;
  people: number;
  baseShareCents: number;
  extraCentPeople: number;
  sharesCents: number[];
};

const DECIMAL = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
const MAX_AMOUNT_CENTS = 10_000_000;
function hundredths(value: string): number {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
}

function money(value: string, field: 'subtotal' | 'tax' | 'serviceCharge'): number {
  const trimmed = value.trim();
  if (!trimmed && field !== 'subtotal') return 0;
  if (!trimmed) throw new DiningInputError('请填写税前消费金额；没有税额或服务费可留空。', field);
  if (trimmed.length > 16 || !DECIMAL.test(trimmed)) throw new DiningInputError('金额须为零或正数，最多 2 位小数。', field);
  const cents = hundredths(trimmed);
  if (cents > MAX_AMOUNT_CENTS) throw new DiningInputError('每项金额不能超过 $100,000。', field);
  return cents;
}

/** Round the additional tip once, then distribute whole cents so the shares always sum to the bill. */
export function calculateDiningBill(input: DiningInput): DiningResult {
  const subtotalCents = money(input.subtotal, 'subtotal');
  const taxCents = money(input.tax, 'tax');
  const serviceChargeCents = money(input.serviceCharge, 'serviceCharge');
  const tipText = input.tipPercent.trim();
  if (tipText.length > 8 || !DECIMAL.test(tipText) || hundredths(tipText) > 10_000) {
    throw new DiningInputError('额外小费比例须为 0 至 100，最多 2 位小数；不加小费请填 0。', 'tipPercent');
  }
  if (input.tipBasis !== 'before-tax' && input.tipBasis !== 'after-tax') throw new DiningInputError('请选择税前或含税的小费计算基数。', 'tipBasis');
  const peopleText = input.people.trim();
  if (!/^\d{1,3}$/.test(peopleText) || Number(peopleText) < 1 || Number(peopleText) > 100) {
    throw new DiningInputError('分账人数须为 1 至 100 的整数。', 'people');
  }
  const people = Number(peopleText);
  const tipBaseCents = subtotalCents + (input.tipBasis === 'after-tax' ? taxCents : 0);
  const tipHundredths = hundredths(tipText);
  // The validated bounds keep this integer product well below Number.MAX_SAFE_INTEGER.
  const tipCents = Math.floor((tipBaseCents * tipHundredths + 5_000) / 10_000);
  const totalCents = subtotalCents + taxCents + serviceChargeCents + tipCents;
  const baseShareCents = Math.floor(totalCents / people);
  const extraCentPeople = totalCents % people;
  return {
    subtotalCents, taxCents, serviceChargeCents, tipBaseCents, tipPercent: tipHundredths / 100,
    tipCents, totalCents, people, baseShareCents, extraCentPeople,
    sharesCents: Array.from({ length: people }, (_, index) => baseShareCents + (index < extraCentPeople ? 1 : 0)),
  };
}
