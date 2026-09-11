import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Copy, Plus, X } from 'lucide-react';
import { calculateRentalBudget, splitSharedBill } from '../../lib/life-tools';
import type { ShowToast } from '../../app/context';
import { translateText, useLocale } from '../../i18n/locale';

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const money = (value: string) => {
  if (!value.trim()) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('金额请输入零或正数，最多两位小数。');
  return Number(value);
};
async function copyResult(text: string, onToast: ShowToast) {
  try { await navigator.clipboard.writeText(text); onToast('计算结果已复制', 'success'); }
  catch { onToast('复制失败，请手动选择结果复制', 'error'); }
}
const RENT_FIELDS = [
  { key: 'rent', label: '月租', placeholder: '例如 2500' }, { key: 'utilities', label: '每月水电网', placeholder: '0' },
  { key: 'parking', label: '每月停车费', placeholder: '0' }, { key: 'otherMonthly', label: '其他固定月费', placeholder: '0' },
  { key: 'moving', label: '一次性搬家及安置费', placeholder: '0' }, { key: 'deposit', label: '押金（单独占用现金）', placeholder: '0' },
] as const;
type RentField = typeof RENT_FIELDS[number]['key'];
const EMPTY_RENT: Record<RentField, string> = { rent: '', utilities: '', parking: '', otherMonthly: '', moving: '', deposit: '' };

export function RentalBudgetTool({ onToast }: { onToast: ShowToast }) {
  const [values, setValues] = useState(EMPTY_RENT);
  const [example, setExample] = useState(false);
  let result: ReturnType<typeof calculateRentalBudget> | null = null;
  let error = '';
  if (Object.values(values).some(value => value.trim())) {
    try {
      const input = Object.fromEntries(RENT_FIELDS.map(({ key }) => [key, money(values[key])])) as Record<RentField, number>;
      if (!values.rent.trim()) throw new Error('请填写月租；其他没有的费用可留空。');
      result = calculateRentalBudget(input);
    } catch (reason) { error = (reason as Error).message; }
  }
  const summary = result ? `BAYLINK 租房费用计算\n每月合计：${usd(result.monthlyTotalCents)}\n入住首月现金需求：${usd(result.firstMonthCashCents)}\n其中押金：${usd(result.refundableDepositCents)}（现金占用，非每月开销）\n一次性搬家及安置费：${usd(result.movingCostCents)}\n按自填费用估算；首月租金按整月计。` : '';
  return <div className="tool-form">
    <div className="tool-inline-heading"><p className="tool-note">金额统一使用美元。不适用的项目留空即可。</p><button type="button" className="tool-text-button" onClick={() => { setValues({ rent: '2500', utilities: '180', parking: '100', otherMonthly: '0', moving: '450', deposit: '2500' }); setExample(true); }}>填入示例</button></div>
    {example && <p className="tool-note">当前为演示数值，请按实际报价修改；示例不代表市场价格。</p>}
    <div className="tool-grid">{RENT_FIELDS.map(field => <label className="tool-field" key={field.key}><span>{field.label}</span><div className="tool-money-input"><span aria-hidden="true">$</span><input aria-label={field.label} inputMode="decimal" maxLength={12} placeholder={field.placeholder} value={values[field.key]} onChange={event => { setValues(previous => ({ ...previous, [field.key]: event.target.value })); setExample(false); }} /></div></label>)}</div>
    {error && <p className="tool-error" role="alert">{error}</p>}
    <div className="tool-budget-results" aria-live="polite"><div><span>每月固定开销</span><strong>{result ? usd(result.monthlyTotalCents) : '—'}</strong><small>月租 + 水电网 + 停车 + 其他月费</small></div><div><span>入住首月现金需求</span><strong>{result ? usd(result.firstMonthCashCents) : '—'}</strong><small>月开销 + 一次性费用 + 押金</small></div></div>
    <p className="tool-note">押金按自填金额计入现金需求，是否及何时退还需按实际约定确认。首月按整月计算；没有填写的费用未计入。</p>
    <div className="tool-actions"><button type="button" className="tool-button" disabled={!result} onClick={() => copyResult(translateText(summary), onToast)}><Copy size={16} />复制费用摘要</button><button type="button" className="tool-button-secondary" onClick={() => { setValues(EMPTY_RENT); setExample(false); }}>清空</button></div>
    <Link className="tool-related-link" to="/guides/rental-lease-checklist-before-signing">签约前，还需要核对什么？<ArrowUpRight size={15} /></Link>
  </div>;
}

type Member = { id: string; name: string; weight: string };
const INITIAL_MEMBERS: Member[] = [{ id: '1', name: '成员 A', weight: '1' }, { id: '2', name: '成员 B', weight: '1' }, { id: '3', name: '成员 C', weight: '1' }];
export function SharedBillTool({ onToast }: { onToast: ShowToast }) {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const [total, setTotal] = useState('');
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [nextId, setNextId] = useState(4);
  let result: ReturnType<typeof splitSharedBill> | null = null;
  let error = '';
  if (total.trim()) {
    try {
      result = splitSharedBill({ total: money(total), members: members.map(member => {
        if (!/^\d+(?:\.\d{1,4})?$/.test(member.weight)) throw new Error('每位成员的权重需为正数，最多四位小数。');
        return { id: member.id, weight: Number(member.weight) };
      }) });
    } catch (reason) { error = (reason as Error).message; }
  }
  const nameOf = (id: string) => members.find(member => member.id === id)?.name.trim() || tr(`成员 ${members.findIndex(member => member.id === id) + 1}`);
  const separator = locale === 'en' ? ': ' : '：';
  // Translate the template before inserting user names. OpenCC and dictionary matches
  // must never rewrite identities embedded in copied financial summaries.
  const summary = result ? tr('BAYLINK 共享账单分摊\n总额：{total}\n{shares}\n各人金额合计等于账单总额，尾差按权重余数分配。')
    .replace('{total}', usd(result.totalCents))
    .replace('{shares}', () => result.shares.map(share => `${nameOf(share.id)}${separator}${usd(share.amountCents)}${locale === 'en' ? ` (${tr('权重')} ${share.weight})` : `（${tr('权重')} ${share.weight}）`}`).join('\n')) : '';
  return <div className="tool-form">
    <label className="tool-field"><span>需要分摊的总金额（USD）</span><div className="tool-money-input"><span aria-hidden="true">$</span><input aria-label="分摊总金额" inputMode="decimal" maxLength={12} placeholder="例如 100.00" value={total} onChange={event => setTotal(event.target.value)} /></div></label>
    <div className="tool-inline-heading"><p className="tool-note">权重都为 1 就是均分；2 和 1 表示承担比例为 2:1。</p><button type="button" className="tool-text-button" onClick={() => setMembers(previous => previous.map(member => ({ ...member, weight: '1' })))}>设为均分</button></div>
    <div className="tool-member-list">{members.map((member, index) => <div key={member.id} className="tool-member-row"><label className="tool-field"><span>成员 {index + 1}</span><input aria-label={`成员 ${index + 1} 名称`} maxLength={24} value={member.name} onChange={event => setMembers(previous => previous.map(item => item.id === member.id ? { ...item, name: event.target.value } : item))} /></label><label className="tool-field"><span>权重</span><input aria-label={`成员 ${index + 1} 权重`} inputMode="decimal" maxLength={10} value={member.weight} onChange={event => setMembers(previous => previous.map(item => item.id === member.id ? { ...item, weight: event.target.value } : item))} /></label><button type="button" className="tool-icon-button" aria-label={`移除成员 ${index + 1}`} disabled={members.length <= 2} onClick={() => setMembers(previous => previous.filter(item => item.id !== member.id))}><X size={17} /></button></div>)}</div>
    <button type="button" className="tool-text-button" disabled={members.length >= 12} onClick={() => { setMembers(previous => [...previous, { id: String(nextId), name: `成员 ${nextId}`, weight: '1' }]); setNextId(nextId + 1); }}><Plus size={16} />添加成员（{members.length}/12）</button>
    {error && <p className="tool-error" role="alert">{error}</p>}
    {result ? <div className="tool-split-result" aria-live="polite"><p>每人应承担</p><ul>{result.shares.map(share => <li key={share.id}><span translate="no">{nameOf(share.id)}</span><strong>{usd(share.amountCents)}</strong></li>)}</ul><div><span>合计</span><strong>{usd(result.totalCents)}</strong></div></div> : <p className="tool-empty-result">填好总金额，就能看到每人的分摊金额。</p>}
    <p className="tool-note">按美分分配尾差，保证合计等于总额；这是一份分摊建议，不记录已付款状态，也不会发起收款。</p>
    <div className="tool-actions"><button type="button" className="tool-button" disabled={!result} onClick={() => copyResult(summary, onToast)}><Copy size={16} />复制分摊结果</button><button type="button" className="tool-button-secondary" onClick={() => { setTotal(''); setMembers(INITIAL_MEMBERS); setNextId(4); }}>重置</button></div>
  </div>;
}
