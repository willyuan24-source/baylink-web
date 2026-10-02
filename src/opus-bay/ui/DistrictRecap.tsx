import { ArrowRight, BookOpen, CalendarPlus, Check, Footprints, Heart, Mail, Route, Sparkles, X } from 'lucide-react';
import { useGame } from '../core/store';
import { eventById, guideTitle, placeById, useCatalog } from '../data/catalog';
import { guideUrl, planStopTitles, planUrl, validPlanStops, walkingRouteUrl, type PlanStop } from '../data/links';
import { activePostcardCount, activePostcardTotal } from '../data/postcards';
import { FREE_GOALS } from '../data/script';
import { closePanel, startWeek, tourStops } from '../game/flow';
import { poiById } from '../game/interactables';
import { useT } from '../i18n';
import { BaybayFace, LinkButton } from './common';

/** Tour stop → the BAYLINK guide that continues it in real life (shown only when the catalog lists the slug). */
const RECAP_GUIDES: Record<string, string> = {
  'sea-lions': 'sf-fishermans-wharf-pier39-guide',
  'coit-tower': 'sf-chinatown-north-beach-walk-guide',
};

/**
 * The first lesson's recap (Bay 101, district and city). Lazy since wave 4 (lane C): ui/Moments Recap loads it when
 * the recap opens, so its routes, plan links and guide rows are not in the main graph.
 */
export default function DistrictRecap() {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const completed = useGame(s => s.tour.completed);
  const postcards = useGame(s => activePostcardCount(s.postcards));
  const wishes = useGame(s => s.wishlist);
  const goals = useGame(s => FREE_GOALS.filter(goal => s.goalsDone.includes(goal.id)).length);
  const stops = tourStops();
  const planStops: PlanStop[] = [
    ...wishes.filter(item => item.kind === 'event').map(item => ({ kind: 'event' as const, id: item.id })),
    ...wishes.flatMap(item => (item.kind === 'place' ? [{ kind: 'place' as const, id: item.id }] : item.kind === 'poi' && poiById(item.id)?.plannerPlaceId ? [{ kind: 'place' as const, id: poiById(item.id)!.plannerPlaceId! }] : [])),
    ...completed.flatMap(id => { const place = poiById(id)?.plannerPlaceId; return place ? [{ kind: 'place' as const, id: place }] : []; }),
  ];
  const all = completed.length >= stops.length && stops.length > 0;
  // 1) a real walking route through the stops you finished, 2) the plan link named by what it carries,
  // 3) matching BAYLINK guides (only slugs the published catalog lists)
  const donePois = stops.filter(stop => completed.includes(stop.poiId)).map(stop => poiById(stop.poiId)).filter((poi): poi is NonNullable<typeof poi> => !!poi?.realInfo);
  const route = walkingRouteUrl(donePois.map(poi => ({ lat: poi.realInfo!.lat, lng: poi.realInfo!.lng })));
  const carried = validPlanStops(planStops, catalog);
  const names = planStopTitles(carried, catalog, locale); // W8-Q1: in the reader's language (English joined the catalog's Chinese titles)
  const planLabel = names.length ? t(`把 ${names.join('、')} 排进 BAYLINK 计划`, `Put ${names.join(', ')} in a BAYLINK plan`) : null;
  const guideSlugs = [...new Set(donePois.map(poi => RECAP_GUIDES[poi.id]).filter((slug): slug is string => !!slug && !!guideTitle(catalog, slug)))];
  return (
    <div className="ob-recap-wrap" role="dialog" aria-modal="true" aria-labelledby="ob-recap-title">
      <div className="ob-recap">
        <button type="button" className="ob-icon-btn ob-recap-close" onClick={closePanel} aria-label={t('关闭', 'Close')}><X size={20} aria-hidden /></button>
        <div className="ob-recap-stamp" aria-hidden><BaybayFace mood="proud" size={84} /><span>{all ? t('结业', 'GRADUATE') : t('打卡', 'VISITED')}</span></div>
        <h2 id="ob-recap-title">{all ? t('湾区第一课 · 完成！', 'Bay 101 · complete!') : t('今天的湾区小结', 'Today’s Bay recap')}</h2>
        <p className="ob-muted">{t('你已经认识了海滨最值得去的几站。下次来真的湾区，照着走就行。', 'You’ve met the waterfront’s best stops. Next time you’re here for real, just follow this.')}</p>
        <ol className="ob-recap-stops">
          {stops.map((stop, i) => {
            const poi = poiById(stop.poiId);
            const ok = completed.includes(stop.poiId);
            return <li key={stop.poiId} className={ok ? 'is-done' : ''}><span>{ok ? <Check size={13} aria-hidden /> : i + 1}</span>{poi ? t(poi.name) : stop.poiId}</li>;
          })}
        </ol>
        <div className="ob-recap-stats">
          <span><Route size={16} aria-hidden />{completed.length}/{stops.length} {t('站', 'stops')}</span>
          <span><Mail size={16} aria-hidden />{postcards}/{activePostcardTotal()} {t('明信片', 'postcards')}</span>
          <span><Heart size={16} aria-hidden />{wishes.length} {t('想去', 'saved')}</span>
          <span><Sparkles size={16} aria-hidden />{goals}/{FREE_GOALS.length} {t('目标', 'goals')}</span>
        </div>
        {wishes.length > 0 && (
          <div className="ob-recap-wishes">
            <strong><Heart size={15} aria-hidden />{t('旅行本 · 想去', 'Journal · saved')}</strong>
            <ul>
              {wishes.slice(0, 5).map(item => {
                const poi = item.kind === 'poi' ? poiById(item.id) : undefined;
                const title = poi ? t(poi.name) : item.kind === 'event' ? eventById(catalog, item.id)?.title ?? item.title : placeById(catalog, item.id)?.title ?? item.title;
                return <li key={`${item.kind}:${item.id}`}>{title}</li>;
              })}
              {wishes.length > 5 && <li className="is-more">+{wishes.length - 5}</li>}
            </ul>
          </div>
        )}
        <div className="ob-actions is-center is-stack">
          {route && <LinkButton href={route} tone="primary" external icon={<Footprints size={18} aria-hidden />}>{t(`Google 地图步行路线（${donePois.length} 站）`, `Walking route in Google Maps (${donePois.length} stops)`)}</LinkButton>}
          {planLabel && <LinkButton href={planUrl({ stops: carried }, catalog, locale)} tone={route ? 'soft' : 'primary'} icon={<CalendarPlus size={18} aria-hidden />}>{planLabel}</LinkButton>}
          {guideSlugs.map(slug => <LinkButton key={slug} href={guideUrl(slug, locale)} tone="ghost" icon={<BookOpen size={17} aria-hidden />}>{t('BAYLINK 攻略', 'BAYLINK guide')} · {guideTitle(catalog, slug)}</LinkButton>)}
          <button type="button" className="ob-btn ob-btn-soft" onClick={() => { closePanel(); startWeek(); }}><Sparkles size={17} aria-hidden /><span>{t('看看这周有什么活动', 'See what’s on this week')}</span></button>
          <button type="button" className="ob-btn ob-btn-ghost" onClick={closePanel}><span>{t('继续自由逛', 'Keep exploring')}</span><ArrowRight size={17} aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
