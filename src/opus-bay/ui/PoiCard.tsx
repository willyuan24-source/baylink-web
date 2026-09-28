import { lazy, Suspense, useSyncExternalStore } from 'react';
import { ArrowRight, BookOpen, CalendarDays, CalendarPlus, Check, Clock, ExternalLink, Heart, Lightbulb, Lock, Mail, MapPinned, Ticket } from 'lucide-react';
import { useGame } from '../core/store';
import type { PoiDef } from '../core/types';
import { eventsNear, guideTitle, placeById, todayInBay, useCatalog } from '../data/catalog';
import { guideUrl, mapsUrl, planStopTitles, planUrl, safeHref, sourceDomain } from '../data/links';
import { PHOTO_SOURCE_PAGES, POI_EXTRA_SOURCES, POI_OFFICIAL_URLS } from '../data/pois';
import { CITY_POI_ZONES, cardOfficialUrl, placeCardTarget } from '../data/sf/cityPois';
import { onPlaces, placeById as cityPlaceById, placeIndex } from '../data/sf/places';
import { closePanel, openEvent, toggleWish, tourStops } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { poiById, postcardById } from '../game/interactables';
import { useT } from '../i18n';
import { LinkButton, Sheet } from './common';
import { useIsMobile } from './hooks';
import { InteractIcon } from './icons';
import { formatDay, postcardArt, postcardForPoi } from './format';

/**
 * Real-info card for a landmark. F10: BAYLINK leads — the matching guide sits right under the summary (pinned in
 * the footer on phones); 官网 only when it really is the official site (never the fact-check source); every source
 * is listed; a still-locked postcard illustration is a slim strip, not a blurred quarter of the screen.
 * City mode (lane G2, G2-1): `openPanel('poi', 'sf:<landmarkId>')` renders the SF landmark card the same way, and
 * `openPanel('poi', 'sf:<placeId>')` a city place (G1's data/sf/places.ts): a place standing for a landmark or merged
 * with a district POI opens that card, any other place its own short card (ui/PlaceCard.tsx: lazy, city only).
 */
export function PoiCard({ id }: { id?: string }) {
  const poi = poiById(id);
  // re-render once G1's place index is in (it loads on idle)
  const places = useSyncExternalStore(subscribePlaces, placeIndex, placeIndex);
  if (poi) return <PoiCardInner poi={poi} />;
  const target = places ? placeCardTarget(id, cityPlaceById) : null;
  if (!target) return null;
  if ('poi' in target) { const other = poiById(target.poi); return other ? <PoiCardInner poi={other} /> : null; }
  return <Suspense fallback={null}><PlaceCard place={target.place} /></Suspense>;
}
/** Wave 4 · lane C: the generic place card is city-only, so it loads with its first use (not in the main graph). */
const PlaceCard = lazy(() => import('./PlaceCard'));
const subscribePlaces = (fn: () => void) => onPlaces(() => fn());

function PoiCardInner({ poi }: { poi: PoiDef }) {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const mobile = useIsMobile();
  const saved = useGame(s => s.wishlist.some(item => item.kind === 'poi' && item.id === poi.id));
  const tourCard = useFlow(s => s.tourPhase === 'card');
  const lastStop = useGame(s => s.tour.stop >= tourStops().length - 1);
  const info = poi.realInfo;
  const place = placeById(catalog, poi.plannerPlaceId);
  const guideSlug = poi.guideSlug ?? place?.guideSlug;
  const guideName = guideTitle(catalog, guideSlug);
  const official = safeHref(cardOfficialUrl(poi.id, place?.officialUrl, POI_OFFICIAL_URLS));
  const extra = (POI_EXTRA_SOURCES[poi.id] ?? []).map(url => safeHref(url)).filter((url): url is string => !!url);
  const photoPage = info?.photo ? safeHref(PHOTO_SOURCE_PAGES[info.photo.src]) : undefined;
  const near = info ? eventsNear(catalog, { lat: info.lat, lng: info.lng }, todayInBay(), 1.0, 7, new Date()).slice(0, 3) : [];
  const title = t(poi.name);
  // city landmark cards (`sf:<landmarkId>`, data/sf/cityPois.ts) name their neighbourhood in the eyebrow
  const zone = CITY_POI_ZONES[poi.id];
  const cardId = info?.photo ? undefined : postcardForPoi(poi.id);
  const card = postcardById(cardId);
  const art = cardId ? postcardArt(cardId) : undefined;
  const cardFound = useGame(s => !!cardId && s.postcards.includes(cardId));
  const planTitles = place ? planStopTitles([{ kind: 'place', id: place.id }], catalog) : [];

  const onWish = () => toggleWish({ kind: 'poi', id: poi.id, title: poi.name.zh });
  const guideRow = <GuideRow slug={guideSlug} name={guideName} />;

  return (
    <Sheet
      eyebrow={<><InteractIcon kind={poi.interaction.kind} size={14} />{t('真实地点', 'Real place')}{zone && <> · {t(zone)}</>}</>}
      title={title}
      onClose={closePanel}
      className="ob-poi"
      footer={
        <>
          {mobile && guideName && <div className="ob-poi-foot-guide">{guideRow}</div>}
          <div className="ob-actions">
            <button type="button" className={`ob-btn ${saved ? 'ob-btn-gold' : 'ob-btn-primary'}`} onClick={onWish} aria-pressed={saved}>
              {saved ? <Check size={18} aria-hidden /> : <Heart size={18} aria-hidden />}<span>{saved ? t('已加入想去', 'Saved') : t('加入想去', 'Save to wishlist')}</span>
            </button>
            {tourCard && <button type="button" className="ob-btn ob-btn-soft" onClick={closePanel}><span>{lastStop ? t('看我的结业小结', 'See my recap') : t('继续下一站', 'Next stop')}</span><ArrowRight size={18} aria-hidden /></button>}
          </div>
        </>
      }
    >
      {info?.photo ? (
        <figure className="ob-poi-photo">
          <img src={info.photo.src} alt={title} loading="lazy" />
          <figcaption>
            {t('图', 'Photo')}: {photoPage ? <a href={photoPage} target="_blank" rel="noopener noreferrer">{info.photo.credit}</a> : info.photo.credit}
            {info.photo.license && <> · {info.photo.licenseUrl ? <a href={info.photo.licenseUrl} target="_blank" rel="noopener noreferrer">{info.photo.license}</a> : info.photo.license}</>}
          </figcaption>
        </figure>
      ) : art && card && cardFound ? (
        <figure className="ob-poi-photo is-illustration">
          <img src={art.src} srcSet={art.srcSet} sizes="(max-width: 720px) 100vw, 420px" alt={t(card.title)} loading="lazy" draggable={false} />
          <figcaption>{t('插画 · 你收集的明信片', 'Illustration · from your postcard')}「{t(card.title)}」</figcaption>
        </figure>
      ) : card ? (
        <div className="ob-poi-locked" role="note">
          <span className="ob-poi-locked-card" aria-hidden><Mail size={18} /><Lock size={13} className="ob-poi-locked-lock" /></span>
          <span className="ob-poi-locked-text"><strong>{t('找到附近的明信片就解锁插画', 'Find the nearby postcard to unlock the illustration')}</strong><small>{t(card.hint)}</small></span>
        </div>
      ) : null}

      {info ? (
        <>
          <p className="ob-lede">{t(info.summary)}</p>
          {!mobile && guideRow}
          {place && (
            <LinkButton href={planUrl({ stops: [{ kind: 'place', id: place.id }] }, catalog, locale)} icon={<CalendarPlus size={17} aria-hidden />} tone="soft">
              {/* the planner catalog's titles are zh only (verify D7): English names the card's own place; the label wraps (content-ui.css) */}
              {t(`把 ${planTitles[0] ?? place.title} 排进 BAYLINK 计划`, `Put ${poi.name.en} in a BAYLINK plan`)}
            </LinkButton>
          )}
          {(info.hours || info.cost) && (
            <dl className="ob-facts">
              {info.hours && <div><dt><Clock size={15} aria-hidden />{t('开放', 'Hours')}</dt><dd>{t(info.hours)}</dd></div>}
              {info.cost && <div><dt><Ticket size={15} aria-hidden />{t('费用', 'Cost')}</dt><dd>{t(info.cost)}</dd></div>}
            </dl>
          )}
          {info.tips.length > 0 && (
            <section className="ob-block">
              <h3 className="ob-h3"><Lightbulb size={15} aria-hidden />{t('小贴士', 'Tips')}</h3>
              <ul className="ob-tips">{info.tips.map((tip, i) => <li key={i}>{t(tip)}</li>)}</ul>
            </section>
          )}
          <div className="ob-link-grid">
            {official && <LinkButton href={official} icon={<ExternalLink size={17} aria-hidden />} tone="soft" external>{t('官网', 'Official site')}</LinkButton>}
            <LinkButton href={mapsUrl(info.lat, info.lng, poi.name.en)} icon={<MapPinned size={17} aria-hidden />} tone="soft" external>{t('地图', 'Maps')}</LinkButton>
          </div>
          <p className="ob-source">
            {t('资料来源', 'Source')} · <a href={safeHref(info.sourceUrl)} target="_blank" rel="noopener noreferrer">{sourceDomain(info.sourceUrl) || t('来源', 'source')}</a> · {t('查证于', 'checked')} {info.verifiedAt}
            {extra.length > 0 && <><br />{t('更多来源', 'More sources')} · {extra.map((url, i) => <span key={url}>{i > 0 && ' · '}<a href={url} target="_blank" rel="noopener noreferrer">{sourceDomain(url)}</a></span>)}</>}
            <br /><span>{t('开放时间和价格可能变化，出发前请查官网确认。', 'Hours and prices change — check the official site before you go.')}</span>
          </p>
        </>
      ) : (
        <>
          <p className="ob-lede">{t('这里的真实资料还在整理中。', 'Real-world details for this spot are still being compiled.')}</p>
          {guideRow}
        </>
      )}

      <NearEvents near={near} />
    </Sheet>
  );
}

/** The BAYLINK guide row (nothing without a guide). */
export function GuideRow({ slug, name }: { slug?: string; name?: string }) {
  const { t, locale } = useT();
  if (!slug || !name) return null;
  return (
    <a className="ob-guide-row" href={guideUrl(slug, locale)} target="_blank" rel="noopener">
      <BookOpen size={18} aria-hidden /><span><small>{t('BAYLINK 攻略', 'BAYLINK guide')}</small>{name}</span><ArrowRight size={17} aria-hidden />
    </a>
  );
}

/** "附近这周": this week's BAYLINK events within 1 km. */
export function NearEvents({ near }: { near: ReturnType<typeof eventsNear> }) {
  const { t, locale } = useT();
  if (!near.length) return null;
  return (
    <section className="ob-block">
      <h3 className="ob-h3"><CalendarDays size={15} aria-hidden />{t('附近这周', 'Nearby this week')}</h3>
      <ul className="ob-mini-events">
        {near.map(item => (
          <li key={item.event.id}>
            <button type="button" onClick={() => openEvent(item.event.id)}>
              <span className="ob-mini-date">{item.tonight ? t('今晚', 'Tonight') : formatDay(item.nextDate, locale)}</span>
              <span className="ob-mini-title">{item.event.title}<small className="ob-mini-dist">{t(`${item.km.toFixed(1)} km · 步行约 ${item.walkMin} 分钟`, `${item.km.toFixed(1)} km · ~${item.walkMin} min walk`)}</small></span>
              <ArrowRight size={15} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
