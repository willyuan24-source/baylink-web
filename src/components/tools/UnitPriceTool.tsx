import { useId, useRef, useState } from 'react';
import { Check, Copy, Plus, RotateCcw, ShoppingBasket, Trash2 } from 'lucide-react';
import type { ShowToast } from '../../app/context';
import { compareUnitPrices, formatUnitPrice, UNIT_PRICE_UNITS, UnitPriceError, type UnitPriceInput, type UnitPriceComparison } from '../../lib/unit-price';
import { translateText, useLocale } from '../../i18n/locale';
import './unit-price.css';

const blank = (id: string, unit: UnitPriceInput['unit'] = 'g'): UnitPriceInput => ({ id, name: '', packCount: '1', quantity: '', unit, totalPrice: '' });
const initialProducts = () => [blank('1'), blank('2')];
const EXAMPLE: UnitPriceInput[] = [
  { id: '1', name: '', packCount: '2', quantity: '500', unit: 'g', totalPrice: '7.50' },
  { id: '2', name: '', packCount: '1', quantity: '1.5', unit: 'kg', totalPrice: '10.50' },
];
const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function UnitPriceTool({ onToast }: { onToast: ShowToast }) {
  const locale = useLocale();
  const tr = (text: string) => translateText(text, locale);
  const [products, setProducts] = useState(initialProducts);
  const [example, setExample] = useState(false);
  const nextId = useRef(3);
  const prefix = useId();
  const errorId = `${prefix}-error`;
  const started = products.some(product => product.quantity.trim() || product.totalPrice.trim());
  let comparison: UnitPriceComparison | null = null;
  let error: UnitPriceError | null = null;
  if (started) {
    try { comparison = compareUnitPrices(products); }
    catch (reason) { error = reason instanceof UnitPriceError ? reason : new UnitPriceError('请检查商品数量与价格。'); }
  }
  const change = (id: string, field: keyof UnitPriceInput, value: string) => {
    setProducts(previous => previous.map(product => product.id === id ? { ...product, [field]: value } : product));
    setExample(false);
  };
  const standardLabel = comparison?.dimension === 'count' ? '每件' : comparison?.dimension === 'volume' ? '每 100 ml' : '每 100 g';
  const productName = (name: string, index: number) => name.trim() || `${tr('商品')} ${index + 1}`;
  const errorIndex = error?.rowId ? products.findIndex(product => product.id === error.rowId) : -1;
  const reset = () => { setProducts(initialProducts()); nextId.current = 3; setExample(false); };
  const summary = comparison ? [
    `${tr('单价比较摘要')} (USD) — ${tr(standardLabel)}`,
    ...comparison.results.map(result => {
      const input = products[result.inputIndex];
      const unitLabel = UNIT_PRICE_UNITS.find(unit => unit.id === input.unit)!.label;
      return `${productName(result.name, result.inputIndex)}: ${input.packCount} × ${input.quantity} ${tr(unitLabel)}; ${tr('实付总价')} ${usd(result.totalPriceCents)}; ${tr(standardLabel)} ${formatUnitPrice(result.unitPriceCents)}${result.isBest ? ` — ${tr('最低单价')}` : `; ${tr('选择最低单价时，同量可省')} ${formatUnitPrice(result.savingPerStandardCents)}`}`;
    }),
    tr('按未舍入值排序；显示最多 6 位小数。'),
    tr('仅比较你输入的实付金额与数量；品质、浓度和能否用完也值得考虑。'),
    ...(example ? [tr('演示数据，不代表任何商店现价。')] : []),
  ].join('\n') : '';
  const copy = async () => {
    if (!summary) return;
    try { await navigator.clipboard.writeText(summary); onToast(tr('单价比较已复制'), 'success'); }
    catch { onToast(tr('复制失败，请手动选择结果复制'), 'error'); }
  };

  return <div className="unit-price-tool tool-form">
    <div className="unit-price-intro"><ShoppingBasket size={22} aria-hidden="true" /><div><strong>大包装，不一定更划算。</strong><p>填入相同用途的商品，把不同包装换成同一单价。重量、容量和件数分别比较。</p></div></div>
    <p className="tool-note">实付总价填写整组商品折扣后实际支付的美元金额。若计入税费，每个商品都按同一口径；工具不猜价格、折扣或税率。</p>
    <div className="unit-price-editor-actions"><span>{tr('比较商品')} {products.length} / 4</span><button type="button" className="tool-text-button" onClick={() => { setProducts(EXAMPLE.map(product => ({ ...product }))); nextId.current = 3; setExample(true); }}>载入包装示例</button></div>
    {example && <p className="unit-price-example" role="status">演示数据，不代表任何商店现价。</p>}
    <div className="unit-price-products">
      {products.map((product, index) => {
        const headingId = `${prefix}-${product.id}-heading`;
        const invalid = (field: keyof UnitPriceInput) => error?.rowId === product.id && error.field === field;
        const describedBy = (field: keyof UnitPriceInput) => invalid(field) ? errorId : undefined;
        return <fieldset className="unit-price-product" key={product.id} aria-labelledby={headingId}>
          <legend id={headingId}>{tr('商品')} {index + 1}</legend>
          <div className="unit-price-product-top"><span className="unit-price-product-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><button type="button" className="unit-price-remove" aria-label={`${tr('移除商品')} ${index + 1}`} disabled={products.length <= 2} onClick={() => { setProducts(previous => previous.filter(item => item.id !== product.id)); setExample(false); }}><Trash2 size={16} aria-hidden="true" /></button></div>
          <label className="tool-field unit-price-name"><span>商品名称（可选）</span><input aria-label={`${tr('商品名称')} ${index + 1}`} maxLength={60} placeholder="如：燕麦、洗衣液、纸巾" value={product.name} onChange={event => change(product.id, 'name', event.target.value)} /></label>
          <div className="unit-price-amount-row">
            <label className="tool-field"><span>包数</span><input aria-label={`${tr('包数')} ${index + 1}`} inputMode="numeric" maxLength={5} value={product.packCount} onChange={event => change(product.id, 'packCount', event.target.value)} aria-invalid={invalid('packCount')} aria-describedby={describedBy('packCount')} /></label>
            <label className="tool-field"><span>每包数量</span><input aria-label={`${tr('每包数量')} ${index + 1}`} inputMode="decimal" maxLength={16} placeholder="500" value={product.quantity} onChange={event => change(product.id, 'quantity', event.target.value)} aria-invalid={invalid('quantity')} aria-describedby={describedBy('quantity')} /></label>
          </div>
          <label className="tool-field"><span>计量单位</span><select aria-label={`${tr('计量单位')} ${index + 1}`} value={product.unit} onChange={event => change(product.id, 'unit', event.target.value)} aria-invalid={invalid('unit')} aria-describedby={describedBy('unit')}>{UNIT_PRICE_UNITS.map(unit => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label>
          <label className="tool-field"><span>实付总价（USD）</span><div className="tool-money-input"><span aria-hidden="true">$</span><input aria-label={`${tr('实付总价')} ${index + 1}`} inputMode="decimal" maxLength={16} placeholder="0.00" value={product.totalPrice} onChange={event => change(product.id, 'totalPrice', event.target.value)} aria-invalid={invalid('totalPrice')} aria-describedby={describedBy('totalPrice')} /></div></label>
        </fieldset>;
      })}
    </div>
    <div className="unit-price-add-row"><button type="button" className="tool-button-secondary" disabled={products.length >= 4} onClick={() => { const id = String(nextId.current++); setProducts(previous => [...previous, blank(id, previous[0].unit)]); setExample(false); }}><Plus size={16} aria-hidden="true" />添加商品</button><span className="tool-note">最多 4 个商品；按件比较时，请用相同规格的件。</span></div>
    {error && <p id={errorId} className="tool-error" role="alert">{errorIndex >= 0 && <strong>{tr('商品')} {errorIndex + 1}: </strong>}{error.message}</p>}
    {!comparison && <div className="tool-empty-result">填完整至少两个商品，就能看到统一单价。任何一项缺失或无效时，不显示旧比较结果。</div>}
    {comparison && <section className="unit-price-results" aria-label="单价比较结果">
      <div className="unit-price-results-heading"><div><span className="unit-price-eyebrow">同量比较</span><h3>{tr(standardLabel)} <span>(USD)</span></h3></div><span className="unit-price-result-count">{comparison.allEqual ? '单价相同' : '从低到高排列'}</span></div>
      <ol>{comparison.results.map(result => <li key={result.id} className={result.isBest ? 'is-lowest' : ''} data-rank={result.rank}>
        <div className="unit-price-result-product"><span className="unit-price-rank" aria-label={`${tr('排名')} ${result.rank}`}>{result.rank}</span><div><strong translate="no">{productName(result.name, result.inputIndex)}</strong><small>{tr('实付总价')} {usd(result.totalPriceCents)}</small></div></div>
        <div className="unit-price-result-value"><strong>{formatUnitPrice(result.unitPriceCents)}</strong><small>{result.isBest ? <><Check size={12} aria-hidden="true" />{tr('最低单价')}</> : <>{tr('同量可省')} {formatUnitPrice(result.savingPerStandardCents)}</>}</small></div>
      </li>)}</ol>
      <p className="unit-price-result-note">“同量可省”表示改选最低单价商品后，每个比较单位可少付的金额，不代表整包购买能按此金额结账。</p>
      <p className="unit-price-result-note">按未舍入值排序；显示最多 6 位小数。</p>
    </section>}
    <div className="tool-actions"><button type="button" className="tool-button" disabled={!comparison} onClick={copy}><Copy size={16} aria-hidden="true" />复制单价比较</button><button type="button" className="tool-button-secondary" onClick={reset}><RotateCcw size={15} aria-hidden="true" />清空比较</button></div>
    <p className="tool-note">oz 表示重量盎司，US fl oz 表示美制液体盎司，不能混用。洗衣液浓度、纸巾层数、品质和能否用完，仍需自己判断。</p>
  </div>;
}
