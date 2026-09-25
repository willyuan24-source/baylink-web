import { useEffect, useId, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Check, Compass, MapPin, Navigation, Plus, Sparkles, X } from 'lucide-react';
import { PLANNER_EVENTS } from '../../data/planner-catalog';
import { translateText, type Locale } from '../../i18n/locale';
import { BAY_REGIONS } from './bay-journey';
import type { UnifiedPlace } from './unified-bay-world';
import { getSfLandmarkPhoto } from './sf-landmark-photos';
import { getRegionalLandmarkPhoto } from './regional-landmark-photos';
import { loadSfGuidePreview, type SfGuidePreview } from './sf-guide-preview';
import { unifiedPlaceEvents } from './unified-place-events';
import { useUnifiedDialog } from './useUnifiedDialog';
import SfLandmarkPhoto from './SfLandmarkPhoto';

export type UnifiedPlacePanelProps = {
  place: UnifiedPlace; locale: Locale; date: string; addedPlaceIds: readonly string[];
  onAddPlace?: (id: string) => void; onAsk?: (question: string) => void; onCityGuide?: () => void; onClose: () => void; onNavigate: (key: string) => void;
};

export default function UnifiedPlacePanel(props: UnifiedPlacePanelProps) {
  return <PlaceReadingSession key={`${props.place.key}:${props.locale}`} {...props} />;
}

function PlaceReadingSession({ place, locale, date, addedPlaceIds, onAddPlace, onAsk, onCityGuide, onClose, onNavigate }: UnifiedPlacePanelProps) {
  const titleId = useId(), [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<{ done: boolean; guide?: SfGuidePreview }>({ done: !place.guideSlug });
  const leave = () => expanded ? setExpanded(false) : onClose();
  const { panel, closeButton, onKeyDown } = useUnifiedDialog(leave);
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const title = locale === 'en' ? place.titleEn : translateText(place.title, locale);
  const region = BAY_REGIONS.find(item => item.id === place.region)!;
  const photo = place.region === 'sf' ? getSfLandmarkPhoto(place.id, locale) : getRegionalLandmarkPhoto(place.region, place.id, locale);
  const added = !!place.plannerPlaceId && addedPlaceIds.includes(place.plannerPlaceId);
  const events = unifiedPlaceEvents(PLANNER_EVENTS, place, date);
  const lang = locale === 'zh-Hans' ? '' : `&lang=${locale}`;
  const description = place.regional ? t(place.regional.description, place.regional.descriptionEn) : place.sf?.visitNote ? t(place.sf.visitNote, place.sf.visitNoteEn || place.sf.visitNote) : null;
  useEffect(() => {
    if (!place.guideSlug) return;
    let active = true;
    void loadSfGuidePreview(place.guideSlug, locale).then(guide => { if (active) setResult({ done: true, guide }); }).catch(() => { if (active) setResult({ done: true }); });
    return () => { active = false; };
  }, [place.guideSlug, locale]);
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, [expanded, closeButton]);

  return <div className="unified-dialog-backdrop" onPointerDown={event => event.stopPropagation()} onClick={event => { if (event.target === event.currentTarget) leave(); }}>
    <section ref={panel} className={`unified-dialog unified-place-panel sf-guide-panel${expanded ? ' unified-dialog--photo' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onKeyUp={event => event.stopPropagation()}>
      <button ref={closeButton} type="button" className="unified-dialog-close sf-guide-close" aria-label={expanded ? t('关闭大图', 'Close photograph') : t('关闭地点详情', 'Close place details')} onClick={leave}><X size={20} /></button>
      <div className="unified-dialog-eyebrow"><MapPin size={14} />{t(region.zh, region.en)}{place.regional?.city && ` · ${place.regional.city}`}</div>
      <h3 id={titleId}>{title}</h3>
      {photo && <SfLandmarkPhoto key={`${photo.src}:${expanded}`} photo={photo} locale={locale} expanded={expanded} onExpand={() => setExpanded(true)} />}
      {!photo && <div className="unified-photo-pending"><Compass size={25}/><p>{t('实景照片待补充，可以先查看官方地点页面。', 'Photograph coming soon. Visit the official place page for more information.')}</p><a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">{t('查看官方页面', 'Official place page')}<ArrowUpRight size={14}/></a></div>}
      {expanded ? <button type="button" className="unified-button" onClick={() => setExpanded(false)}>{t('返回地点介绍', 'Back to place details')}</button> : <>
        {description && <p className="unified-place-description">{description}</p>}
        {place.regional?.address && <p className="unified-place-address"><MapPin size={15}/>{place.regional.address}</p>}
        <div className="unified-place-primary-actions">
          <button type="button" className="unified-button unified-button--primary" onClick={() => { onNavigate(place.key); onClose(); }}><Navigation size={17} />{t('在游戏中导航到这里', 'Navigate here in the game')}</button>
          {place.plannerPlaceId && onAddPlace && <button type="button" className="unified-button" disabled={added} onClick={() => onAddPlace(place.plannerPlaceId!)}>{added ? <Check size={17} /> : <Plus size={17} />}{added ? t('已加入我的周末', 'Added to my day') : t('加入我的周末', 'Add to my day')}</button>}
        </div>
        {!result.done && <p role="status" className="unified-place-description">{t('正在打开相关攻略…', 'Opening the related guide…')}</p>}
        {result.guide && <section className="unified-place-guide"><span className="unified-dialog-eyebrow"><BookOpen size={14} />{t('相关攻略', 'RELATED GUIDE')}</span><h4>{result.guide.title}</h4><p>{result.guide.summary}</p><a href={result.guide.href} target="_blank" rel="noopener noreferrer">{t('阅读全文', 'Read full guide')}<ArrowUpRight size={15} /></a><small>{t('文章更新', 'Article updated')} {result.guide.updatedAt}</small></section>}
        <div className="unified-place-links">
          <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方参观信息', 'Official visitor information')}<ArrowUpRight size={15} /></a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${place.coordinate[1]},${place.coordinate[0]}`} target="_blank" rel="noopener noreferrer">{t('在真实地图查看', 'View on a real map')}<ArrowUpRight size={15} /></a>
          {onAsk && <button type="button" onClick={() => { onAsk(t(`我想在 ${date} 去 ${place.title}，请根据有来源的 BAYLINK 攻略帮我安排周边半日游，注明仍需核实的预约、开放时间、费用。资料不足请直接说明，不要猜测。`, `I would like to visit ${place.titleEn} on ${date}. Use sourced BAYLINK guides to plan a half-day nearby. Identify what still needs verification about reservations, hours and prices. Clearly state any missing information.`)); onClose(); }}><Sparkles size={15} />{t('请 BAYBAY 帮我安排', 'Plan with BAYBAY')}</button>}
        </div>
        <section className="unified-place-events"><h4><CalendarDays size={16} />{t('这一天的附近活动', 'Nearby events on this day')}<time dateTime={date}>{date}</time></h4>
          {onCityGuide && <button type="button" className="unified-button" onClick={onCityGuide}><CalendarDays size={15}/>{t('查看本城本月与下月活动', 'City events this month & next')}<ArrowUpRight size={15}/></button>}
          {events.length ? events.slice(0, 3).map(event => <a key={event.id} href={`/events/${encodeURIComponent(event.id)}${locale === 'zh-Hans' ? '' : `?lang=${locale}`}`} target="_blank" rel="noopener noreferrer"><strong>{translateText(event.title, locale)}</strong><span>{translateText(event.venue, locale)} · {translateText(event.costLabel, locale)}</span><small>{t('资料核实', 'Source checked')} {event.verifiedAt}</small><ArrowUpRight size={15} /></a>) : <p>{t('这一天暂未收录能明确匹配到附近的活动。可以继续查看地区日历。', 'No clearly matched nearby events are listed for this date. You can explore the regional calendar.')}</p>}
          <a href={`/calendar?date=${encodeURIComponent(date)}&region=${place.region}${lang}`} target="_blank" rel="noopener noreferrer"><Compass size={15} />{t(`查看${region.zh}活动日历`, `See the ${region.en} event calendar`)}<ArrowUpRight size={15} /></a>
        </section>
      </>}
    </section>
  </div>;
}
