import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Clock3, Sparkles, X } from 'lucide-react';
import { translateText, type Locale } from '../../i18n/locale';
import type { SfLandmark } from './sf-world';
import { loadSfGuidePreview, type SfGuidePreview } from './sf-guide-preview';
import type { PlannerEvent } from '../../lib/planner';
import { getSfLandmarkPhoto } from './sf-landmark-photos';
import SfLandmarkPhoto from './SfLandmarkPhoto';

export type SfGuidePanelProps = {
  landmark: SfLandmark;
  locale: Locale;
  onClose: () => void;
  events?: PlannerEvent[];
  date?: string;
  onAsk?: (question: string) => void;
};

/** Key each reading session so old attraction text never flashes over a new place. */
export default function SfGuidePanel(props: SfGuidePanelProps) {
  return <GuideSession key={`${props.landmark.id}:${props.landmark.guideSlug || ''}:${props.locale}`} {...props} />;
}

function GuideSession({ landmark, locale, onClose, events = [], date, onAsk }: SfGuidePanelProps) {
  const [result, setResult] = useState<{ guide?: SfGuidePreview; done: boolean }>({ done: !landmark.guideSlug });
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const placeName = locale === 'en' ? landmark.titleEn : translateText(landmark.title, locale);
  const photo = getSfLandmarkPhoto(landmark.id, locale);
  const closeCurrentView = () => { if (photoExpanded) setPhotoExpanded(false); else onClose(); };

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

  useEffect(() => { close.current?.focus(); }, [photoExpanded]);

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    // The scene also listens to movement keys; a reader must keep them inside it.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCurrentView();
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

  return <div className="sf-guide-overlay" onPointerDown={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) closeCurrentView(); }}>
    <section ref={panel} className={`sf-guide-panel${photoExpanded ? ' sf-guide-panel--photo' : ''}`} role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleKeys}>
      <button ref={close} type="button" className="sf-guide-close" aria-label={photoExpanded ? t('关闭大图，返回景点', 'Close photograph and return to place') : t('关闭攻略，返回探索', 'Close guide and return to exploring')} onClick={closeCurrentView}><X size={20} /></button>
      {photoExpanded && photo ? <>
        <h3 id={headingId}>{placeName}</h3>
        <SfLandmarkPhoto key={`${photo.src}:full`} photo={photo} locale={locale} expanded />
        <div className="sf-guide-actions"><button type="button" onClick={() => setPhotoExpanded(false)}>{t('返回景点介绍', 'Back to place details')}</button></div>
      </> : <>
      <span className="sf-guide-eyebrow"><BookOpen size={15} /> BAYLINK · {t('地点攻略', 'LOCAL GUIDE')}</span>
      <h3 id={headingId}>{placeName}</h3>
      {photo && <SfLandmarkPhoto key={`${photo.src}:preview`} photo={photo} locale={locale} onExpand={() => setPhotoExpanded(true)} />}
      {landmark.visitNote && <p className="sf-visit-note">{locale === 'en' ? landmark.visitNoteEn : translateText(landmark.visitNote, locale)}</p>}
      {!result.done ? <p className="sf-guide-loading" role="status">{t('正在打开攻略…', 'Opening the guide…')}</p> : result.guide ? <>
        <div className="sf-guide-related"><span>{t('相关攻略', 'RELATED GUIDE')}</span><h4>{result.guide.title}</h4></div>
        <div className="sf-guide-meta"><span><Clock3 size={14} /> {result.guide.readMinutes} {t('分钟阅读', 'min read')}</span><span>{t('文章更新', 'Article updated')} <time dateTime={result.guide.updatedAt}>{result.guide.updatedAt}</time></span></div>
        <p className="sf-guide-summary">{result.guide.summary}</p>
        {result.guide.highlights.length > 0 && <div className="sf-guide-highlights"><h4>{t('攻略摘选', 'From the guide')}</h4><ul>{result.guide.highlights.map((item, index) => <li key={index}>{item.title && <strong>{item.title}</strong>}<p>{item.text}</p></li>)}</ul></div>}
        <p className="sf-guide-source">{t('摘自 BAYLINK 现有攻略；完整路线和资料来源请阅读原文。', 'An excerpt from the existing BAYLINK guide. Read the article for the full route and sources.')}</p>
      </> : <p className="sf-guide-summary">{t('这里暂时没有可预览的 BAYLINK 攻略，可以先查看景点的官方信息。', 'A BAYLINK guide preview is not available here yet. You can still visit the official information page.')}</p>}
      <div className="sf-guide-actions">
        {result.guide && <a className="sf-guide-primary" href={result.guide.href} target="_blank" rel="noopener noreferrer">{t('阅读全文', 'Read full guide')}<ArrowUpRight size={16} /></a>}
        <a href={landmark.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方信息', 'Official info')}<ArrowUpRight size={16} /></a>
        {onAsk && <button type="button" onClick={() => onAsk(t(`我正在迷你旧金山探索${landmark.title}，计划 ${date || '周末'} 出游。请根据站内有来源的攻略，帮我比较适合的玩法和周边地点，并说明还需要核实的预约、开放时间或费用。没有资料时请明确说明，不要推测。`, `I am exploring ${landmark.titleEn} in Mini San Francisco and planning a visit ${date || 'this weekend'}. Use sourced BAYLINK guides to suggest things to do nearby. Clearly identify missing information and what I should verify about hours, reservations and prices.`))}><Sparkles size={16} />{t('问问 BAYBAY', 'Ask BAYBAY')}</button>}
        <button type="button" onClick={onClose}>{t('继续探索', 'Keep exploring')}</button>
      </div>
      {date && <section className="sf-guide-events"><h4><CalendarDays size={15} />{t('附近已收录活动', 'Listed nearby events')}<time dateTime={date}>{date}</time></h4>{events.length ? events.slice(0, 3).map(event => <a key={event.id} href={`/events/${encodeURIComponent(event.id)}`} target="_blank" rel="noopener noreferrer"><strong>{translateText(event.title, locale)}</strong><span>{translateText(event.venue, locale)} · {translateText(event.costLabel, locale)}</span><small>{t('资料核实', 'Source checked')} {event.verifiedAt}</small><ArrowUpRight size={14} /></a>) : <p>{t('这一天暂未收录能明确匹配到这里的活动。可查看全城日历，或到官方页面核实安排。', 'No clearly matched events are listed here for this date. Check the city calendar or the official page for more options.')}</p>}<a href={`/calendar?date=${encodeURIComponent(date)}&region=sf`} target="_blank" rel="noopener noreferrer">{t('查看旧金山活动日历', 'See the SF event calendar')}<ArrowUpRight size={14} /></a></section>}
      </>}
    </section>
  </div>;
}
