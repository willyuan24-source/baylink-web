import { useId, useState } from 'react';
import { Copy, Minus, Plus, ReceiptText, RotateCcw } from 'lucide-react';
import type { ShowToast } from '../../app/context';
import { calculateDiningBill, DiningInputError, type DiningField, type DiningInput, type DiningResult } from '../../lib/dining-calculator';
import { translateText, useLocale } from '../../i18n/locale';
import './dining-calculator.css';

const EMPTY: DiningInput = { subtotal: '', tax: '', serviceCharge: '', tipPercent: '18', tipBasis: 'before-tax', people: '2' };
const EXAMPLE: DiningInput = { subtotal: '80.00', tax: '8.25', serviceCharge: '12.00', tipPercent: '18', tipBasis: 'before-tax', people: '3' };
const MONEY_FIELDS = [
  { key: 'subtotal', label: '税前消费金额', help: '餐饮小计，不含税、服务费或小费。', placeholder: '80.00' },
  { key: 'tax', label: '账单上的实际税额', help: '照账单填写美元金额；没有则留空。', placeholder: '0.00' },
  { key: 'serviceCharge', label: '账单已列的服务费', help: '只填尚未包含在税前消费中的服务费，避免重复计入。', placeholder: '0.00' },
] as const;
const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function DiningCalculator({ onToast }: { onToast: ShowToast }) {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const prefix = useId();
  const [values, setValues] = useState<DiningInput>(EMPTY);
  const [example, setExample] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const started = [values.subtotal, values.tax, values.serviceCharge].some(value => value.trim());
  let result: DiningResult | null = null;
  let error: DiningInputError | null = null;
  if (started) {
    try { result = calculateDiningBill(values); }
    catch (reason) { error = reason instanceof DiningInputError ? reason : new DiningInputError('请检查账单金额与分账人数。', 'subtotal'); }
  }
  const change = (field: DiningField, value: string) => {
    setValues(previous => ({ ...previous, [field]: value })); setExample(false); setManualCopy(false);
  };
  const invalid = (field: DiningField) => error?.field === field;
  const describedBy = (field: DiningField) => invalid(field) ? `${prefix}-error` : undefined;
  const peopleValue = /^\d{1,3}$/.test(values.people) ? Number(values.people) : NaN;
  const validPeople = Number.isInteger(peopleValue) && peopleValue >= 1 && peopleValue <= 100;
  const basisLabel = values.tipBasis === 'before-tax' ? '税前消费' : '税前消费 + 税额';
  const splitLines = result ? result.extraCentPeople > 0
    ? [`${result.extraCentPeople} × ${usd(result.baseShareCents + 1)}`, `${result.people - result.extraCentPeople} × ${usd(result.baseShareCents)}`]
    : [`${result.people} × ${usd(result.baseShareCents)}`] : [];
  const summary = result ? [
    `BAYLINK · ${tr('餐厅小费与分账')} (USD)`,
    `${tr('税前消费金额')}: ${usd(result.subtotalCents)}`,
    `${tr('账单上的实际税额')}: ${usd(result.taxCents)}`,
    `${tr('账单已列的服务费')}: ${usd(result.serviceChargeCents)}`,
    `${tr('额外小费')}: ${usd(result.tipCents)} (${result.tipPercent}% × ${usd(result.tipBaseCents)}; ${tr(basisLabel)})`,
    `${tr('账单总额')}: ${usd(result.totalCents)}`,
    `${tr('分账人数')}: ${result.people}`,
    `${tr('按人数 × 每人金额分配')}: ${splitLines.join(' + ')}`,
    tr('小费先四舍五入到美分，再分配尾差，确保各人合计等于总额。'),
    tr('服务费单独计入总额，不从额外小费中自动扣除；是否已包含小费，请核对账单。'),
    ...(example ? [tr('演示账单，所有金额和小费比例都可修改。')] : []),
  ].join('\n') : '';
  const copy = async () => {
    if (!summary) return;
    try { await navigator.clipboard.writeText(summary); setManualCopy(false); onToast(tr('聚餐账单已复制'), 'success'); }
    catch { setManualCopy(true); onToast(tr('复制失败，可在下方选择摘要手动复制。'), 'error'); }
  };

  return <div className="dining-calculator tool-form">
    <div className="dining-intro"><ReceiptText size={25} aria-hidden="true" /><div><strong>吃得开心，账也算清楚。</strong><p>照着账单填，不用心算税、小费与每个人的那一份。</p></div></div>
    <div className="tool-inline-heading"><p className="tool-note">金额统一使用美元。税额按账单填写，小费比例由你决定。</p><button type="button" className="tool-text-button" onClick={() => { setValues(EXAMPLE); setExample(true); setManualCopy(false); }}>看看一张示例账单</button></div>
    {example && <p className="dining-example" role="status">演示账单，所有金额和小费比例都可修改。</p>}
    <div className="dining-layout">
      <div className="dining-inputs">
        <div className="dining-money-grid">{MONEY_FIELDS.map(field => <label className={`tool-field dining-field-${field.key}`} key={field.key}><span>{field.label}</span><div className="tool-money-input"><span aria-hidden="true">$</span><input aria-label={field.label} inputMode="decimal" maxLength={16} placeholder={field.placeholder} value={values[field.key]} onChange={event => change(field.key, event.target.value)} aria-invalid={invalid(field.key)} aria-describedby={[`${prefix}-${field.key}-hint`, describedBy(field.key)].filter(Boolean).join(' ')} /></div><small id={`${prefix}-${field.key}-hint`}>{field.help}</small></label>)}</div>
        <div className="dining-service-note"><ReceiptText size={16} aria-hidden="true" /><p>服务费不一定就是小费。先看账单是否写明 gratuity included，再决定额外加多少；下方小费会另加，服务费不参与小费计算。</p></div>
        <fieldset className="dining-tip"><legend>额外小费</legend><div className="dining-tip-presets" aria-label="小费比例快捷选择">{[0, 15, 18, 20].map(percent => <button type="button" key={percent} aria-label={`${percent}%`} aria-pressed={values.tipPercent.trim() !== '' && Number(values.tipPercent) === percent} onClick={() => change('tipPercent', String(percent))}>{percent}%</button>)}</div>
          <label className="tool-field dining-percent-field"><span>自填小费比例</span><div><input aria-label="自填小费比例" inputMode="decimal" maxLength={8} value={values.tipPercent} onChange={event => change('tipPercent', event.target.value)} aria-invalid={invalid('tipPercent')} aria-describedby={describedBy('tipPercent')} /><span aria-hidden="true">%</span></div></label>
          <fieldset className="dining-basis"><legend>按哪个金额算小费？</legend><label><input type="radio" name={`${prefix}-basis`} value="before-tax" checked={values.tipBasis === 'before-tax'} onChange={() => change('tipBasis', 'before-tax')} />税前消费</label><label><input type="radio" name={`${prefix}-basis`} value="after-tax" checked={values.tipBasis === 'after-tax'} onChange={() => change('tipBasis', 'after-tax')} />税前消费 + 税额</label></fieldset>
        </fieldset>
        <div className="tool-field dining-people"><label htmlFor={`${prefix}-people`}>分账人数</label><div><button type="button" aria-label="减少分账人数" disabled={!validPeople || peopleValue <= 1} onClick={() => change('people', String(peopleValue - 1))}><Minus size={18} aria-hidden="true" /></button><input id={`${prefix}-people`} aria-label="分账人数" inputMode="numeric" maxLength={3} value={values.people} onChange={event => change('people', event.target.value)} aria-invalid={invalid('people')} aria-describedby={describedBy('people')} /><button type="button" aria-label="增加分账人数" disabled={!validPeople || peopleValue >= 100} onClick={() => change('people', String(peopleValue + 1))}><Plus size={18} aria-hidden="true" /></button></div><small>1 至 100 人，按实际金额均分。</small></div>
        {error && <p id={`${prefix}-error`} className="tool-error" role="alert">{error.message}</p>}
      </div>
      <section className={`dining-receipt ${result ? 'has-result' : ''}`} aria-label="聚餐计算结果" aria-live="polite">
        <div className="dining-receipt-heading"><span>YOUR TABLE, ALL SET</span><ReceiptText size={23} aria-hidden="true" /></div>
        {result ? <>
          <dl className="dining-breakdown"><div><dt>税前消费金额</dt><dd>{usd(result.subtotalCents)}</dd></div><div><dt>账单上的实际税额</dt><dd>{usd(result.taxCents)}</dd></div><div><dt>账单已列的服务费</dt><dd>{usd(result.serviceChargeCents)}</dd></div><div><dt>{tr('额外小费')} · {result.tipPercent}%</dt><dd>{usd(result.tipCents)}</dd></div></dl>
          <p className="dining-basis-note">{tr('小费计算基数')}: {usd(result.tipBaseCents)} · {tr(basisLabel)}</p>
          <div className="dining-total"><span>账单总额</span><strong>{usd(result.totalCents)}</strong></div>
          <div className="dining-per-person"><span>{result.extraCentPeople ? '每人应付区间' : '每人应付'}</span><strong>{result.extraCentPeople ? `${usd(result.baseShareCents)} – ${usd(result.baseShareCents + 1)}` : usd(result.baseShareCents)}</strong><small>{tr('分账人数')}: {result.people}</small></div>
          <div className="dining-split"><p>按人数 × 每人金额分配</p><ul>{splitLines.map(line => <li key={line}>{line}</li>)}</ul><small>小费先四舍五入到美分，再分配尾差，确保各人合计等于总额。</small></div>
        </> : <div className="dining-empty"><ReceiptText size={38} aria-hidden="true" /><strong>{error ? '改好输入，马上重新计算。' : '把账单放这里，轻松分好。'}</strong><p>填写税前消费金额后，显示总额、额外小费与每人的金额。</p></div>}
      </section>
    </div>
    <div className="tool-actions"><button type="button" className="tool-button" disabled={!result} onClick={copy}><Copy size={16} aria-hidden="true" />复制聚餐账单</button><button type="button" className="tool-button-secondary" onClick={() => { setValues(EMPTY); setExample(false); setManualCopy(false); }}><RotateCcw size={15} aria-hidden="true" />清空账单</button></div>
    {manualCopy && result && <label className="tool-field dining-manual-copy"><span>手动复制聚餐摘要</span><textarea aria-label="手动复制聚餐摘要" aria-describedby={`${prefix}-manual-hint`} readOnly rows={9} value={summary} onFocus={event => event.currentTarget.select()} /><small id={`${prefix}-manual-hint`}>点击摘要后全选，使用系统复制功能。</small></label>}
    <p className="tool-note">服务费单独计入总额，不从额外小费中自动扣除；是否已包含小费，请核对账单。</p>
  </div>;
}
