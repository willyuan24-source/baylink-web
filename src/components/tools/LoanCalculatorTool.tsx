import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Copy } from 'lucide-react';
import { calculateLoan, type LoanSchedule } from '../../lib/loan-calculator';
import type { ShowToast } from '../../app/context';

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const duration = (months: number) => `${Math.floor(months / 12) ? `${Math.floor(months / 12)} 年` : ''}${months % 12 ? ` ${months % 12} 个月` : ''}`.trim() || '0 个月';
const INITIAL = { price: '', down: '20', principal: '', rate: '', years: '30', tax: '', insurance: '', hoa: '', pmi: '', extra: '' };
type Field = keyof typeof INITIAL;
function numeric(raw: string, label: string, decimals: number, optional = false, max = 100_000_000): number {
  if (!raw.trim() && optional) return 0;
  if (!raw.trim()) throw new Error(`请填写${label}。`);
  const pattern = decimals ? new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`) : /^\d+$/;
  if (!pattern.test(raw.trim())) throw new Error(`${label}需为零或正数${decimals ? `，最多 ${decimals} 位小数` : '，不含小数'}。`);
  const number = Number(raw);
  if (!Number.isFinite(number) || number > max) throw new Error(`${label}超出支持范围（最大 ${max.toLocaleString('en-US')}）。`);
  return number;
}

function BalanceChart({ baseline, current, principal, months, selected }: { baseline: LoanSchedule; current: LoanSchedule; principal: number; months: number; selected: number }) {
  const point = (month: number, balance: number) => `${42 + month / months * 506},${22 + (1 - balance / principal) * 122}`;
  const path = (schedule: LoanSchedule) => [point(0, principal), ...schedule.annualSummary.map(row => point(Math.min(row.year * 12, schedule.payoffMonths), row.balanceCents))].join(' ');
  const focus = current.annualSummary[selected];
  const focusX = focus ? 42 + Math.min(focus.year * 12, current.payoffMonths) / months * 506 : 42;
  const focusY = focus ? 22 + (1 - focus.balanceCents / principal) * 122 : 22;
  return <svg className="loan-balance-chart" viewBox="0 0 590 178" role="img" aria-label="贷款本金余额下降趋势，深色为当前还款方案，浅色虚线为不额外还款方案；精确数值见年度明细">
    <line x1="42" y1="144" x2="548" y2="144" stroke="#dce4d3" />
    <line x1="42" y1="22" x2="548" y2="22" stroke="#edf0e8" strokeDasharray="4 5" />
    <polyline points={path(baseline)} fill="none" stroke="#b8c4a9" strokeWidth="3" strokeDasharray="5 4" />
    <polyline points={path(current)} fill="none" stroke="#456c43" strokeWidth="3" />
    <circle cx={focusX} cy={focusY} r="5" fill="#456c43" stroke="white" strokeWidth="2" />
    <text x="42" y="166" fontSize="11" fill="#738267">开始还款</text><text x="548" y="166" textAnchor="end" fontSize="11" fill="#738267">第 {months / 12} 年</text>
  </svg>;
}

export function LoanCalculatorTool({ onToast }: { onToast: ShowToast }) {
  const [mode, setMode] = useState<'home' | 'loan'>('home');
  const [downMode, setDownMode] = useState<'percent' | 'amount'>('percent');
  const [values, setValues] = useState(INITIAL);
  const [example, setExample] = useState(false);
  const [selectedYear, setSelectedYear] = useState(0);
  const change = (key: Field, value: string) => { setValues(previous => ({ ...previous, [key]: value })); setExample(false); };
  let plan: ReturnType<typeof calculateLoan> | null = null;
  let downCents = 0;
  let taxCents = 0;
  let insuranceCents = 0;
  let hoaCents = 0;
  let pmiCents = 0;
  let error = '';
  const started = !!(mode === 'home' ? values.price : values.principal) || !!values.rate;
  if (started) {
    try {
      let principal: number;
      if (mode === 'home') {
        const price = numeric(values.price, '房屋价格', 2);
        if (price <= 0) throw new Error('房屋价格需大于 0。');
        const priceCents = Math.round(price * 100);
        const down = numeric(values.down, '首付', downMode === 'percent' ? 4 : 2, false, downMode === 'percent' ? 100 : 100_000_000);
        downCents = downMode === 'percent' ? Math.round(priceCents * down / 100) : Math.round(down * 100);
        if (downCents > priceCents) throw new Error('首付不能超过房屋价格。');
        principal = (priceCents - downCents) / 100;
        taxCents = Math.round(numeric(values.tax, '年度房产税', 2, true, 1_000_000) * 100 / 12);
        insuranceCents = Math.round(numeric(values.insurance, '年度房屋保险', 2, true, 1_000_000) * 100 / 12);
        hoaCents = Math.round(numeric(values.hoa, '每月 HOA', 2, true, 1_000_000) * 100);
        pmiCents = Math.round(numeric(values.pmi, '每月贷款保险', 2, true, 1_000_000) * 100);
      } else principal = numeric(values.principal, '贷款本金', 2);
      plan = calculateLoan({ principal, annualInterestRate: numeric(values.rate, '贷款年利率', 4, false, 30), termYears: numeric(values.years, '贷款年限', 0, false, 50), extraMonthly: numeric(values.extra, '每月额外还本金', 2, true, 1_000_000) });
    } catch (reason) { error = reason instanceof Error ? reason.message : '请检查输入内容。'; }
  }
  const schedule = plan?.accelerated;
  const fees = taxCents + insuranceCents + hoaCents + pmiCents;
  const monthlyHousing = plan ? plan.monthlyPaymentCents + fees : 0;
  const monthlyOutlay = plan && schedule ? (schedule.payoffMonths === 1 ? schedule.lastPaymentCents : schedule.payoffMonths ? plan.monthlyPaymentCents + plan.extraMonthlyCents : 0) + fees : 0;
  const yearIndex = schedule ? Math.min(selectedYear, Math.max(0, schedule.annualSummary.length - 1)) : 0;
  const year = schedule?.annualSummary[yearIndex];
  const moneyInput = (key: Field, label: string, placeholder = '0') => <label className="tool-field"><span>{label}</span><div className="tool-money-input"><span aria-hidden="true">$</span><input aria-label={label} inputMode="decimal" maxLength={14} value={values[key]} placeholder={placeholder} onChange={event => change(key, event.target.value)} /></div></label>;
  const copy = async () => {
    if (!plan || !schedule) return;
    const finalPaymentSummary = schedule.payoffMonths ? `最后一期贷款还款：${usd(schedule.lastPaymentCents)}（不含住房税费与保险）${schedule.finalPaymentAdjustmentCents > 100 ? `\n末期另补足余额：${usd(schedule.finalPaymentAdjustmentCents)}，已计入最后一期金额，请核对贷款方实际还款表。` : ''}` : '';
    const summary = `BAYLINK 贷款计算\n贷款本金：${usd(schedule.totalPrincipalCents)}${mode === 'home' ? `\n首付：${usd(downCents)}` : ''}\n固定年利率：${values.rate}%\n贷款年限：${values.years} 年\n常规每月本息：${usd(plan.monthlyPaymentCents)}${mode === 'home' ? `\n每月住房预算（未计额外还款）：${usd(monthlyHousing)}\n其中税、保险、HOA：${usd(fees)}` : ''}\n每月额外还本金：${usd(schedule.payoffMonths ? plan.extraMonthlyCents : 0)}\n当前方案利息合计：${usd(schedule.totalInterestCents)}\n贷款本息合计：${usd(schedule.totalPaidCents)}\n预计还清：${duration(schedule.payoffMonths)}\n较不额外还款节省利息：${usd(plan.interestSavedCents)}\n固定利率、每月计息估算；未计贷款费用、罚金及税费变化，末期按余额调整。`;
    try { await navigator.clipboard.writeText([summary, finalPaymentSummary].filter(Boolean).join('\n')); onToast('贷款计算摘要已复制', 'success'); } catch { onToast('复制失败，请手动选择页面结果复制', 'error'); }
  };
  return <div className="tool-form loan-calculator">
    <div className="tool-choice-row" role="group" aria-label="贷款计算方式"><button type="button" aria-pressed={mode === 'home'} onClick={() => { setMode('home'); setExample(false); }}>房价与首付</button><button type="button" aria-pressed={mode === 'loan'} onClick={() => { setMode('loan'); setExample(false); }}>直接填写贷款本金</button></div>
    <div className="tool-inline-heading"><p className="tool-note">固定利率、每月等额还本付息。金额统一使用美元。</p><button type="button" className="tool-text-button" onClick={() => { setMode('home'); setDownMode('percent'); setValues({ price: '1000000', down: '20', principal: '800000', rate: '6', years: '30', tax: '12500', insurance: '1800', hoa: '0', pmi: '0', extra: '0' }); setExample(true); setSelectedYear(0); }}>载入贷款示例</button></div>
    {example && <p className="tool-note">演示使用 100 万房价、20% 首付、6% 年利率。仅用于试算，不代表当前利率、税率或贷款报价。</p>}
    <div className="tool-grid">
      {mode === 'home' ? <>{moneyInput('price', '房屋价格', '例如 1000000')}<label className="tool-field"><span>首付</span><div className="loan-down-input"><input aria-label="首付数值" inputMode="decimal" maxLength={14} value={values.down} onChange={event => change('down', event.target.value)} /><select aria-label="首付单位" value={downMode} onChange={event => { setDownMode(event.target.value as 'percent' | 'amount'); change('down', ''); }}><option value="percent">%</option><option value="amount">USD</option></select></div></label></> : moneyInput('principal', '贷款本金', '例如 800000')}
      <label className="tool-field"><span>贷款年利率（%）</span><input aria-label="贷款年利率" inputMode="decimal" maxLength={8} placeholder="填写贷款利率，例如 6" value={values.rate} onChange={event => change('rate', event.target.value)} /><small>填写 Interest rate，不是包含费用的 APR。</small></label>
      <label className="tool-field"><span>贷款年限（年）</span><input aria-label="贷款年限" inputMode="numeric" maxLength={2} value={values.years} onChange={event => change('years', event.target.value)} /><div className="loan-term-shortcuts">{[10, 15, 20, 30].map(term => <button type="button" key={term} aria-label={`选择 ${term} 年贷款`} aria-pressed={values.years === String(term)} onClick={() => change('years', String(term))}>{term} 年</button>)}</div></label>
    </div>
    {mode === 'home' && <details className="loan-options"><summary>加上税、保险和 HOA <ChevronDown size={16} /></summary><p className="tool-note">填写年度金额或月费，留空按 0 处理。贷款保险请按报价填写，不会自动判断是否需要或何时取消。</p><div className="tool-grid">{moneyInput('tax', '年度房产税')}{moneyInput('insurance', '年度房屋保险')}{moneyInput('hoa', '每月 HOA')}{moneyInput('pmi', '每月贷款保险（PMI 等）')}</div></details>}
    <details className="loan-options"><summary>看看额外还本金的影响 <ChevronDown size={16} /></summary>{moneyInput('extra', '每月额外还本金')}<p className="tool-note">假设从第一期开始每月追加到本金，常规月供不变。未计提前还款罚金；实际操作前请向贷款方确认。</p></details>
    {error && <p className="tool-error" role="alert">{error}</p>}
    {plan && schedule ? <>
      <div className="loan-principal-strip"><span>贷款本金 <strong>{usd(schedule.totalPrincipalCents)}</strong></span>{mode === 'home' && <span>首付 <strong>{usd(downCents)}</strong></span>}</div>
      <div className="tool-budget-results" aria-live="polite"><div><span>每月贷款本息</span><strong data-testid="loan-monthly-payment">{usd(plan.monthlyPaymentCents)}</strong><small>固定月供，不含额外还本金及住房费用</small></div><div><span>{mode === 'home' ? '每月住房预算' : '贷款本息合计'}</span><strong data-testid="loan-secondary-total">{usd(mode === 'home' ? monthlyHousing : schedule.totalPaidCents)}</strong><small>{mode === 'home' ? '贷款本息 + 自填税费、保险、HOA' : '当前方案的本金 + 利息，不含贷款费用'}</small></div></div>
      {mode === 'home' && <div className="loan-fee-breakdown"><span>月均房产税 <b>{usd(taxCents)}</b></span><span>月均房屋保险 <b>{usd(insuranceCents)}</b></span><span>HOA <b>{usd(hoaCents)}</b></span><span>贷款保险 <b>{usd(pmiCents)}</b></span></div>}
      <div className="loan-summary-grid"><div><span>预计还清</span><strong>{duration(schedule.payoffMonths)}</strong></div><div><span>当前方案利息合计</span><strong>{usd(schedule.totalInterestCents)}</strong></div><div><span>贷款本息合计</span><strong>{usd(schedule.totalPaidCents)}</strong></div></div>
      {schedule.payoffMonths > 0 && <p className="loan-final-payment">最后一期贷款还款：<strong>{usd(schedule.lastPaymentCents)}</strong>，不含住房税费与保险。</p>}
      {schedule.finalPaymentAdjustmentCents > 100 && <p className="tool-error" role="status">按美分取整后，末期需另补足 {usd(schedule.finalPaymentAdjustmentCents)} 余额，已计入上方最后一期金额。请核对贷款方的实际还款表。</p>}
      {plan.extraMonthlyCents > 0 && schedule.payoffMonths > 0 && <div className="loan-extra-result" aria-live="polite"><p>每月计划支出 <strong>{usd(monthlyOutlay)}</strong><small>包含额外还本金{mode === 'home' ? '和自填住房费用' : ''}；末期按余款结清</small></p><div><span>预计少付利息 <b>{usd(plan.interestSavedCents)}</b></span><span>预计提前 <b>{duration(plan.monthsSaved)}</b></span></div></div>}
      {year && schedule.totalPrincipalCents > 0 && <div className="loan-chart-section"><div className="tool-inline-heading"><h3>本金余额，逐年看清</h3><span className="tool-note">深色：当前方案</span></div><BalanceChart baseline={plan.baseline} current={schedule} principal={schedule.totalPrincipalCents} months={plan.scheduledMonths} selected={yearIndex} /><label className="loan-year-slider"><span>查看第 {year.year} 年{yearIndex === schedule.annualSummary.length - 1 ? '结束时' : '末'}</span><input aria-label="查看还款年份" type="range" min={0} max={schedule.annualSummary.length - 1} value={yearIndex} onChange={event => setSelectedYear(Number(event.target.value))} /></label><div className="loan-year-facts"><span>当年还本金 <b>{usd(year.principalCents)}</b></span><span>当年利息 <b>{usd(year.interestCents)}</b></span><span>剩余本金 <b>{usd(year.balanceCents)}</b></span></div></div>}
      {schedule.annualSummary.length > 0 && <details className="loan-options"><summary>查看每年还款明细 <ChevronDown size={16} /></summary><div className="loan-table-scroll" tabIndex={0} role="region" aria-label="年度还款明细，可横向滚动"><table><caption>当前还款方案，金额为 USD；年份自首期开始计算</caption><thead><tr><th scope="col">年</th><th scope="col">还本金</th><th scope="col">付利息</th><th scope="col">剩余本金</th></tr></thead><tbody>{schedule.annualSummary.map(row => <tr key={row.year}><th scope="row">{row.year}</th><td>{usd(row.principalCents)}</td><td>{usd(row.interestCents)}</td><td>{usd(row.balanceCents)}</td></tr>)}</tbody></table></div></details>}
      {!schedule.payoffMonths && <p className="tool-note">贷款本金为 0，无需偿还贷款本息。房产税、保险与 HOA 仍按自填金额计入。</p>}
    </> : !error && <p className="tool-empty-result">填写房价或本金、利率与年限，马上看到月供和还款走势。</p>}
    <div className="tool-actions"><button type="button" className="tool-button" disabled={!plan} onClick={copy}><Copy size={16} />复制贷款摘要</button><button type="button" className="tool-button-secondary" onClick={() => { setValues(INITIAL); setMode('home'); setDownMode('percent'); setExample(false); setSelectedYear(0); }}>清空贷款计算</button></div>
    <p className="tool-note">结果为固定利率、每月计息的估算，按美分取整并在末期调整；极小贷款月供至少 1 美分。未计贷款手续费、成交费用、利率调整或未来税费变化，不适用于仅付息、气球贷或按日计息产品。</p>
    <div className="loan-source-links"><a href="https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-mortgage-interest-rate-and-an-apr-en-135/" target="_blank" rel="noopener noreferrer">CFPB：利率与 APR <ArrowUpRight size={13} /></a><a href="https://www.consumerfinance.gov/ask-cfpb/on-a-mortgage-whats-the-difference-between-my-principal-and-interest-payment-and-my-total-monthly-payment-en-1941/" target="_blank" rel="noopener noreferrer">本息与完整月支出 <ArrowUpRight size={13} /></a></div>
  </div>;
}
