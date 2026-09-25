import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, BookOpen, Clock3, X } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';
import type { SfLandmark } from './sf-world';
import { loadSfGuidePreview, type SfGuidePreview } from './sf-guide-preview';

export type SfGuidePanelProps = {
  landmark: SfLandmark;
  locale: Locale;
  onClose: () => void;
};

/** Key each reading session so old attraction text never flashes over a new place. */
export default function SfGuidePanel(props: SfGuidePanelProps) {
  return <GuideSession key={`${props.landmark.id}:${props.landmark.guideSlug || ''}:${props.locale}`} {...props} />;
}

function GuideSession({ landmark, locale, onClose }: SfGuidePanelProps) {
  const [result, setResult] = useState<{ guide?: SfGuidePreview; done: boolean }>({ done: !landmark.guideSlug });
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const placeName = locale === 'en' ? landmark.titleEn : translateText(landmark.title, locale);

  useEffect(() => {
    if (!landmark.guideSlug) return;
    let active = true;
    void loadSfGuidePreview(landmark.guideSlug, locale)
      .then(guide => { if (active) setResult({ guide, done: true }); })
      .catch(() => { if (active) setResult({ done: true }); });
    return () => { active = false; };
  }, [landmark.guideSlug, locale]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    // The scene also listens to movement keys; a reader must keep them inside it.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') || [])];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <div className="sf-guide-overlay" onPointerDown={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="sf-guide-panel" role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleKeys}>
      <button ref={close} type="button" className="sf-guide-close" aria-label={t('关闭攻略，返回探索', 'Close guide and return to exploring')} onClick={onClose}><X size={20} /></button>
      <span className="sf-guide-eyebrow"><BookOpen size={15} /> BAYLINK · {t('地点攻略', 'LOCAL GUIDE')}</span>
      <span className="sf-guide-place">{placeName}</span>
      <h3 id={headingId}>{result.guide?.title || t('从这里，走进真实旧金山', 'Explore this place in real life')}</h3>
      {!result.done ? <p className="sf-guide-loading" role="status">{t('正在打开攻略…', 'Opening the guide…')}</p> : result.guide ? <>
        <div className="sf-guide-meta"><span><Clock3 size={14} /> {result.guide.readMinutes} {t('分钟阅读', 'min read')}</span><span>{t('文章更新', 'Article updated')} <time dateTime={result.guide.updatedAt}>{result.guide.updatedAt}</time></span></div>
        <p className="sf-guide-summary">{result.guide.summary}</p>
        {result.guide.highlights.length > 0 && <div className="sf-guide-highlights"><h4>{t('攻略摘选', 'From the guide')}</h4><ul>{result.guide.highlights.map((item, index) => <li key={index}>{item.title && <strong>{item.title}</strong>}<p>{item.text}</p></li>)}</ul></div>}
        <p className="sf-guide-source">{t('摘自 BAYLINK 现有攻略；完整路线和资料来源请阅读原文。', 'An excerpt from the existing BAYLINK guide. Read the article for the full route and sources.')}</p>
      </> : <p className="sf-guide-summary">{t('这里暂时没有可预览的 BAYLINK 攻略，可以先查看景点的官方信息。', 'A BAYLINK guide preview is not available here yet. You can still visit the official information page.')}</p>}
      <div className="sf-guide-actions">
        {result.guide && <a className="sf-guide-primary" href={result.guide.href} target="_blank" rel="noopener noreferrer">{t('阅读全文', 'Read full guide')}<ArrowUpRight size={16} /></a>}
        <a href={landmark.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方信息', 'Official info')}<ArrowUpRight size={16} /></a>
        <button type="button" onClick={onClose}>{t('继续探索', 'Keep exploring')}</button>
      </div>
    </section>
  </div>;
}
