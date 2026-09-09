import { useState } from 'react';
import { ArrowLeftRight, Copy } from 'lucide-react';
import { UNIT_PAIRS, convertUnit, type UnitKind } from '../../lib/unit-conversion';
import type { ShowToast } from '../../app/context';

const display = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value);
export function UnitConverterTool({ onToast }: { onToast: ShowToast }) {
  const [kind, setKind] = useState<UnitKind>('temperature');
  const [value, setValue] = useState('');
  const [reversed, setReversed] = useState(false);
  const pair = UNIT_PAIRS.find(item => item.id === kind)!;
  let result: number | null = null;
  let error = '';
  if (value.trim()) {
    try {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw new Error('请输入数字，可包含小数点。');
      result = convertUnit(Number(value), kind, reversed);
    } catch (reason) { error = (reason as Error).message; }
  }
  const from = reversed ? pair.to : pair.from;
  const to = reversed ? pair.from : pair.to;
  const fromSymbol = reversed ? pair.symbolTo : pair.symbolFrom;
  const toSymbol = reversed ? pair.symbolFrom : pair.symbolTo;
  const summary = result == null ? '' : `${value} ${fromSymbol} ≈ ${display(result)} ${toSymbol}`;
  const copy = async () => { try { await navigator.clipboard.writeText(summary); onToast('换算结果已复制', 'success'); } catch { onToast('复制失败，请手动选择结果复制', 'error'); } };
  return <div className="tool-form">
    <div className="tool-choice-row" role="group" aria-label="换算类型">{UNIT_PAIRS.map(item => <button type="button" key={item.id} aria-pressed={kind === item.id} onClick={() => { setKind(item.id); setReversed(false); setValue(''); }}>{item.label}</button>)}</div>
    <div className="tool-converter-row">
      <label className="tool-field"><span>{from}</span><input aria-label="需要换算的数值" inputMode="decimal" maxLength={22} placeholder={`例如 ${pair.example}`} value={value} onChange={event => setValue(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'unit-error' : undefined} /></label>
      <button type="button" className="tool-swap" aria-label="交换换算方向" onClick={() => { setReversed(!reversed); setValue(''); }}><ArrowLeftRight size={21} /></button>
      <div className="tool-field tool-conversion-result"><span>{to}</span><output aria-live="polite" aria-label="换算结果">{result == null ? '—' : display(result)}</output></div>
    </div>
    {error && <p id="unit-error" className="tool-error" role="alert">{error}</p>}
    <p className="tool-note">结果显示最多 4 位小数。容量使用美制液体加仑（US gallon）。</p>
    <div className="tool-actions"><button type="button" className="tool-button" disabled={result == null} onClick={copy}><Copy size={16} />复制结果</button><button type="button" className="tool-button-secondary" onClick={() => setValue('')}>清空</button></div>
  </div>;
}
