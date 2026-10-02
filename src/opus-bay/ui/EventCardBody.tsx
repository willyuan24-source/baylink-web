import { Suspense } from 'react';
import { lazyChunk } from '../game/lazyChunk';
import { ArrowLeft, CalendarDays, CalendarPlus, Check, ExternalLink, Heart, MapPinned, Navigation, Newspaper, Ticket, Users } from 'lucide-react';
import { game, useGame } from '../core/store';
import { REGION_LABELS, categoryLabel, eventById, eventSpot, goToEvent, nextShowing, useCatalog } from '../data/catalog';
import './event-go.css';
import { eventUrl, mapsUrl, planUrl, safeHref } from '../data/links';
import { closePanel, openPanel, toggleWish } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { catalogText, useT } from '../i18n';
import { LinkButton, Sheet } from './common';
import { ShareCardButton } from './ShareCardButton';
import { formatDay, joinPlace } from './format';
import { importRetry } from '../game/importRetry';
import { addEventToCalendar } from '../realsf/addCal';
import { publicLines, publicText } from '../data/publicText';

/** Wave 5 (W5-R7, city mode): 现实中怎么去 — the nearest real Muni stops and their headways (lane R's lazy chunk). */
const HowToGo = lazyChunk(() => importRetry(() => import('../realsf/HowToGo')));

/** One live BAYLINK event (only ids from /planner-catalog.json). */
export default function EventCardBody({ id }: { id?: string }) {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const status = useGame(s => s.catalogStatus);
  const fromBoard = useFlow(s => s.weekResult?.events.some(item => item.event.id === id) ?? false);
  const saved = useGame(s => s.wishlist.some(item => item.kind === 'event' && item.id === id));
  const event = eventById(catalog, id);
  const back = fromBoard ? () => { game.set({ panel: { kind: 'week' } }); } : undefined;

  if (!event) {
    return (
      <Sheet title={status === 'loading' ? t('正在读取活动…', 'Loading event…') : t('找不到这个活动', 'Event not found')} onClose={closePanel}>
        <p className="ob-lede">{status === 'error' ? t('暂时连不上 BAYLINK 活动数据，稍后再试。', 'Can’t reach BAYLINK’s event data right now. Try again later.') : t('它可能已经结束或下架了。', 'It may have ended or been removed.')}</p>
        <button type="button" className="ob-btn ob-btn-soft" onClick={() => openPanel('week')}>{t('回到这周活动', 'Back to this week')}</button>
      </Sheet>
    );
  }
  const showing = nextShowing(event);
  const next = showing?.date ?? null;
  const category = categoryLabel(event);
  const region = REGION_LABELS[event.region];
  const official = safeHref(event.officialUrl);
  // wave 5 (city mode): its San Francisco venue in the world (lane R's table): 带我去 through N's goTo
  const spot = next ? eventSpot(event) : null;
  const plan = publicLines(event.plan, locale);

  return (
    <Sheet
      eyebrow={<><Newspaper size={14} aria-hidden />{t('BAYLINK 活动', 'BAYLINK event')}{category ? ` · ${t(category)}` : ''}</>}
      title={event.title}
      onClose={closePanel}
      className="ob-event"
      headerExtra={back && <button type="button" className="ob-icon-btn" onClick={back} aria-label={t('返回公告板', 'Back to the board')}><ArrowLeft size={20} aria-hidden /></button>}
      footer={
        <div className="ob-actions">
          <button type="button" className={`ob-btn ${saved ? 'ob-btn-gold' : 'ob-btn-primary'}`} aria-pressed={saved} onClick={() => toggleWish({ kind: 'event', id: event.id, title: event.title })}>
            {saved ? <Check size={18} aria-hidden /> : <Heart size={18} aria-hidden />}<span>{saved ? t('已加入想去', 'Saved') : t('加入想去', 'Save to wishlist')}</span>
          </button>
          <LinkButton href={eventUrl(event.id, locale)} tone="soft">{t('看活动详情', 'Event details')}</LinkButton>
        </div>
      }
    >
      <div className="ob-event-when">
        <span className={`ob-chip ${next ? 'is-teal' : ''}`}>{showing?.tonight ? t('今晚', 'Tonight') : next ? formatDay(next, locale) : t('已结束', 'Ended')}</span>
        {event.dateLabel && <span className="ob-event-datelabel">{publicText(event.dateLabel, locale)}</span>}
        {spot && (
          <button type="button" className="ob-btn ob-btn-primary ob-btn-sm ob-event-go" onClick={() => { goToEvent(event); }} aria-label={t(`带我去${spot.name.zh}`, `Take me to ${spot.name.en}`)}>
            <Navigation size={15} aria-hidden /><span>{t('带我去', 'Take me there')}</span>
          </button>
        )}
      </div>
      <dl className="ob-facts">
        {(event.venue || event.city) && <div><dt><MapPinned size={15} aria-hidden />{t('地点', 'Where')}</dt><dd>{joinPlace([event.venue ? catalogText(event.venue, locale) : null, event.city, region ? t(region) : null])}</dd></div>}
        {(event.costLabel || event.cost) && <div><dt><Ticket size={15} aria-hidden />{t('费用', 'Cost')}</dt><dd>{event.costLabel ? publicText(event.costLabel, locale) : (event.cost === 'free' ? t('免费', 'Free') : event.cost)}</dd></div>}
        {event.audience?.length ? <div><dt><Users size={15} aria-hidden />{t('适合', 'For')}</dt><dd>{event.audience.slice(0, 4).join(' · ')}</dd></div> : null}
      </dl>
      {event.summary && <p className="ob-lede">{publicText(event.summary, locale)}</p>}
      {/* W9-R7: the headways of the event's day and start (a Saturday event shows weekend service) */}
      {spot && <Suspense fallback={null}><HowToGo point={{ x: spot.x, z: spot.z }} day={next ?? undefined} event={event} /></Suspense>}
      {/* W9-R5 (review R§6): the editors' working notes never reach the card (data/publicText.ts) */}
      {plan.length ? (
        <section className="ob-block">
          <h3 className="ob-h3">{t('出发前', 'Before you go')}</h3>
          <ul className="ob-tips">{plan.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </section>
      ) : null}
      <p className="ob-source">
        {t('资料来源', 'Source')} · {official ? <a href={official} target="_blank" rel="noopener noreferrer">{event.sourceLabel ?? t('官网', 'official site')}</a> : event.sourceLabel ?? 'BAYLINK'}
        {event.verifiedAt && <> · {t('查证于', 'checked')} {event.verifiedAt}</>}
        <br /><span>{t('活动信息来自 BAYLINK 编辑整理，出发前以官网为准。', 'Curated by BAYLINK editors — confirm on the official site before you go.')}</span>
      </p>
      <div className="ob-link-grid">
        {next && <LinkButton href={planUrl({ date: next, stops: [{ kind: 'event', id: event.id }] }, catalog, locale)} icon={<CalendarPlus size={17} aria-hidden />} tone="soft">{t('安排进计划', 'Plan it')}</LinkButton>}
        {/* W9-R3 (review R§6: no calendar on event cards): the next day of it as an .ics, a reminder the day before */}
        {next && (
          <button type="button" className="ob-btn ob-btn-soft" onClick={() => addEventToCalendar(event, next, locale)} aria-label={`${t('加到日历（提前一天提醒）', 'Add to calendar (a reminder the day before)')} · ${formatDay(next, locale)}`}>
            <CalendarDays size={17} aria-hidden /><span>{t('加到日历', 'Add to calendar')}</span>
          </button>
        )}
        {official && <LinkButton href={official} icon={<ExternalLink size={17} aria-hidden />} tone="soft" external>{t('官网', 'Official site')}</LinkButton>}
        {event.location && <LinkButton href={mapsUrl(event.location.lat, event.location.lng, event.venue)} icon={<MapPinned size={17} aria-hidden />} tone="soft" external>{t('地图', 'Maps')}</LinkButton>}
        {next && <ShareCardButton spec={{ kind: 'event', id: event.id }} />}
      </div>
    </Sheet>
  );
}
