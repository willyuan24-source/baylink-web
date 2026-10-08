import { useEffect, useState } from 'react';
import { Check, Type, X } from 'lucide-react';
import { ModalShell } from './ui/Modal';
import { initializeReadingSize, setReadingSize, setSimpleDisplay, useReadingSize, useSimpleDisplay, type ReadingSize } from '../lib/reading-preferences';
import { translateText, useLocale } from '../i18n/locale';

export function ReadingPreferencesCard() {
  const size = useReadingSize();
  const simple = useSimpleDisplay();
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const options: Array<{ id: ReadingSize; label: string; percentage: string }> = [
    { id: 'standard', label: english ? 'Standard' : '标准', percentage: '100%' },
    { id: 'large', label: english ? 'Large' : '大', percentage: '112.5%' },
    { id: 'extra-large', label: english ? 'Extra large' : '特大', percentage: '125%' },
  ];
  return <section className="reading-preferences" aria-label={english ? 'Reading size' : '阅读字号'}>
    <h2>{english ? 'Make yourself comfortable' : '选一个看得舒服的字号'}</h2>
    <p>{t('全站文字一起变大，也可以继续使用浏览器缩放。', 'Text grows across the whole site. Your browser zoom remains available.')}</p>
    <div role="group" aria-label={english ? 'Text size' : '文字大小'}>{options.map(option => <button type="button" key={option.id} aria-pressed={size === option.id} onClick={() => setReadingSize(option.id)}><span>{option.label}</span><small>{option.percentage}</small>{size === option.id && <Check size={20} aria-hidden="true" />}</button>)}</div>
    <button type="button" role="switch" aria-checked={simple} className="reading-simple-switch" onClick={() => setSimpleDisplay(!simple)}>
      <span><strong>{t('简洁显示（适合长辈）', 'Simple display (easier reading)')}</strong><small>{t('全站文字至少 16 像素，按钮和底部导航更大，更容易点。', 'Every line of text at least 16 px, with larger buttons and tabs.')}</small></span>
      <span className="reading-simple-track" aria-hidden="true"><span /></span>
    </button>
    <p className="reading-preview">{english ? 'A small plan can make a good weekend.' : '一场活动，一份指南，把湾区生活慢慢安排好。'}</p>
  </section>;
}

export function ReadingPreferencesButton() {
  const [open, setOpen] = useState(false);
  const english = useLocale() === 'en';
  useEffect(initializeReadingSize, []);
  return <>
    <button type="button" className="site-reading-button" aria-label={english ? 'Change text size' : '调整阅读字号'} aria-haspopup="dialog" onClick={() => setOpen(true)}><Type size={20} aria-hidden="true" /><span>Aa</span></button>
    {open && <ModalShell label={english ? 'Reading preferences' : '阅读与显示'} onClose={() => setOpen(false)} className="reading-overlay"><div className="reading-dialog"><button type="button" className="reading-close" aria-label={english ? 'Close reading preferences' : '关闭阅读设置'} onClick={() => setOpen(false)}><X size={22} /></button><ReadingPreferencesCard /></div></ModalShell>}
  </>;
}
