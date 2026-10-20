import { useId } from 'react';
import { Check } from 'lucide-react';
import { setReadingSize, setSimpleDisplay, useReadingSize, useSimpleDisplay, type ReadingSize } from '../lib/reading-preferences';
import { translateText, useLocale } from '../i18n/locale';
import './site-dialogs.css';

/**
 * Text size and 简洁显示 (content arrangement §7), shown in a Sheet that names it (the header's Aa sheet, /me's row): 标准 /
 * 大 / 特大, each with a sample 字 at its relative size and the percentage as a caption; then the 简洁显示 switch with its
 * one line. Styles: site-dialogs.css (.reading-sheet-card), over the older global rules in tokens.css.
 */
export function ReadingPreferencesCard() {
  const size = useReadingSize();
  const simple = useSimpleDisplay();
  // The card can be on /me and in the Aa sheet at once, so the switch's label and hint ids must be unique.
  const switchId = useId();
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const options: Array<{ id: ReadingSize; label: string; percentage: string }> = [
    { id: 'standard', label: english ? 'Standard' : '标准', percentage: '100%' },
    { id: 'large', label: english ? 'Large' : '大', percentage: '112.5%' },
    { id: 'extra-large', label: english ? 'Extra large' : '特大', percentage: '125%' },
  ];
  return <section className="reading-preferences reading-sheet-card" aria-label={english ? 'Reading size' : '阅读字号'}>
    <div role="group" aria-label={english ? 'Text size' : '文字大小'} className="reading-sizes">{options.map(option => <button type="button" key={option.id} aria-pressed={size === option.id} onClick={() => setReadingSize(option.id)}>
      <span className="reading-sample" data-size={option.id} aria-hidden="true">{english ? 'Aa' : '字'}</span>
      <span className="reading-size-name">{option.label}{size === option.id && <Check size={18} aria-hidden="true" strokeWidth={1.75} />}</span>
      <small>{option.percentage}</small>
    </button>)}</div>
    <p className="reading-note">{t('全站文字一起变大，也可以继续使用浏览器缩放。', 'Text grows across the whole site. Your browser zoom remains available.')}</p>
    <button type="button" role="switch" aria-checked={simple} aria-labelledby={`${switchId}label`} aria-describedby={`${switchId}hint`} className="reading-simple-switch" onClick={() => setSimpleDisplay(!simple)}>
      <span><strong id={`${switchId}label`}>{t('简洁显示（适合长辈）', 'Simple display (easier reading)')}</strong><small id={`${switchId}hint`}>{t('全站文字至少 16 像素，按钮和底部导航更大，更容易点。', 'Every line of text at least 16 px, with larger buttons and tabs.')}</small></span>
      <span className="reading-simple-track" aria-hidden="true"><span /></span>
    </button>
  </section>;
}
