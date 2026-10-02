import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BookOpen, CalendarDays, CalendarPlus, Camera, Check, Clock, CloudFog, ExternalLink, Flame, Flower2, Ghost, Heart, Moon, Music, Navigation, ShoppingBag, Sparkles, Sun, Sunrise, Sunset, Target, Ticket, TramFront, Waves } from 'lucide-react';
import { useGame } from '../core/store';
import type { Bilingual, CatalogEvent } from '../core/types';
import { eventById, eventDaysInWindow, eventSpot, goToEvent, guideTitle, isAdultOnly, isProfessional, upcomingEvents, useCatalog } from '../data/catalog';
import { guideUrl, myWeekUrl, offerUrl, planUrl, type PlanStop } from '../data/links';
import { FREE_GOALS } from '../data/script';
import { ledgerVersion, subscribeLedger } from '../economy/ledger';
import { bayNow, bayParts } from '../game/bayNow';
import { goalTargets } from '../game/cityContent';
import { navigateTo, openEvent, openPanel } from '../game/flow';
import { goTo, type GoToTarget } from '../game/goTo';
import { runtime } from '../core/runtime';
import { catalogText, useT } from '../i18n';
import { LinkButton } from '../ui/common';
import { formatDay } from '../ui/format';
import { activeDaily, dailyThree, daySignals, nearestSunsetSpot, taskDone, taskWhen, DAILY_ALL_COINS, DAILY_COINS, type DailyKind, type DailyTask } from './daily';
import { EVENT_SAY, VENUE_SAY } from './eventVenues';
import { activeEventsAt, handRowOf, weekEvents, windowEndKnown, type EventWindow } from './events';
import { MOON_LABELS, MOON_SOURCE, moonPhase } from './moon';
import { KARL_SOURCE, karlMonthFactor } from './seasons';
import { bayHm, roundMinute, sunBandAt, sunHm, sunTimes } from './sun';
import { calendarAhead, calendarOn, GRADE_SAY, type CalendarRow } from './calendar';
import { liveOffers, loadLive, offersOn, standingOffers, subscribeLive } from './live';
import { hm, rowState, rowsOn, WALK_GUIDES, weekendOf, type HandRow, type SourceRef } from './todayRows';
import { COAST_SAFETY, COAST_SAFETY_SOURCE, ftLabel, loadTides, tidesOnDay, TIDE_SOURCE, WAVE_ORGAN_SOURCE, WRECK_LOW_FT, WRECKS_SOURCE, type TideExtreme } from './tides';
import './realsf.css';

/**
 * Wave 5 · lane R (W5-R4) · 今天 · SF Today — a Journal tab (ui/slots.ts registerJournalTab, from realsf/index.ts):
 *
 *   the Bay clock, sunrise / sunset, the moon (约), Karl's usual mood this month
 *   下一个目标   the first open explorer goal (the pelican first), 带我去
 *   今日三件小事  the daily three (realsf/daily.ts): done / now / later / over, 带我去, +10 each and +20 for all three
 *   今天在旧金山  the world events on today (venue, hours, cost), the Ferry Plaza market, what is free today, the fire
 *                rings in season, the Conservatory's light show — a row whose hours are over is hidden
 *   这周         San Francisco's BAYLINK events of the next 7 days (带我去 when the venue is in the world, else 看看)
 *
 * W5-R7 (the shoulds): today's calendar row (Halloween, the king tides: realsf/calendar.ts) and the tides (NOAA, baked:
 * realsf/tides.ts — the Lands End wrecks at a daylight low, the Wave Organ before a high, the coast safety line) in
 * 今天在旧金山, with BAYLINK's own offers that apply today (live.json: realsf/live.ts, each linking /offers/:id) and the
 * standing ones with their conditions; the calendar rows of the next 7 days in 这周; 我的周末 (the wishlist's events on
 * the coming weekend → BAYLINK /plan and /my-week); and 走走看 (BAYLINK walking guides by their place, only those the
 * catalog has).
 *
 * Every row carries 带我去 (lane N's goTo) and its source with the day it was checked; every time says 以官网为准.
 * Bay time throughout (`?date=` in DEV / QA builds).
 */

const TICK_MS = 15_000;

/** The Bay clock, re-read every 15 s. */
function useBayClock(): Date {
  const [now, setNow] = useState(() => bayNow());
  useEffect(() => {
    const id = setInterval(() => setNow(bayNow()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** 'the Japanese Tea Garden' → 'The Japanese Tea Garden' (English row titles) */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** (W8-I, W8I-WS-7) days that carry their own comma ('Sun, Oct 11') are listed with '; ': ', ' read 'Sat, Sun, Oct 11' as one date */
const DAYS_JOIN_EN = '; ';
const minuteOf = (d: Date) => { const p = bayParts(d); return p.hour * 60 + p.minute; };
const go = (target: GoToTarget, fallback?: () => void) => {
  void goTo(target, { source: 'realsf:today' }).then(r => { if (!r.ok && (r.why === 'unknown' || r.why === 'no-way')) fallback?.(); });
};

function Source({ src }: { src: SourceRef | { label: string; url?: string; verifiedAt?: string } }) {
  const { t } = useT();
  return (
    <small className="ob-today-src">
      {t('来源', 'Source')} · {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.label}<ExternalLink size={11} aria-hidden /></a> : src.label}
      {src.verifiedAt && <> · {t('查证于', 'checked')} {src.verifiedAt}</>}
    </small>
  );
}

function GoButton({ onClick, label }: { onClick: () => void; label: Bilingual }) {
  const { t } = useT();
  return (
    <button type="button" className="ob-btn ob-btn-soft ob-btn-sm ob-today-go" onClick={onClick} aria-label={t(`带我去${label.zh}`, `Take me to ${label.en}`)}>
      <Navigation size={14} aria-hidden /><span>{t('带我去', 'Go')}</span>
    </button>
  );
}

function Row({ icon, title, meta, children, side, done, tone }: { icon: ReactNode; title: ReactNode; meta?: ReactNode; children?: ReactNode; side?: ReactNode; done?: boolean; tone?: 'now' | 'later' | 'over' }) {
  return (
    <li className={`ob-today-row${done ? ' is-done' : ''}${tone ? ` is-${tone}` : ''}`}>
      <span className="ob-today-ico" aria-hidden>{done ? <Check size={15} /> : icon}</span>
      <div className="ob-today-main">
        <strong>{title}</strong>
        {meta && <small>{meta}</small>}
        {children}
      </div>
      {side && <div className="ob-today-side">{side}</div>}
    </li>
  );
}

function State({ state, from }: { state: 'open' | 'now' | 'later' | 'over' | 'any'; from?: number }) {
  const { t } = useT();
  if (state === 'open' || state === 'now') return <span className="ob-today-state is-now">{t('现在开放', 'Open now')}</span>;
  if (state === 'later' && from !== undefined) return <span className="ob-today-state">{t(`${hm(from)} 起`, `From ${hm(from)}`)}</span>;
  if (state === 'over') return <span className="ob-today-state is-over">{t('今天已过', 'Over today')}</span>;
  return null;
}

const BAND: Record<string, Bilingual> = {
  night: { zh: '夜里', en: 'Night' }, morning: { zh: '清晨', en: 'Morning' }, day: { zh: '白天', en: 'Daytime' }, golden: { zh: '金色时刻', en: 'Golden hour' },
};
const HAND_ICON: Record<HandRow['kind'], ReactNode> = { market: <ShoppingBag size={15} />, free: <Flower2 size={15} />, fire: <Flame size={15} />, show: <Sparkles size={15} /> };
const DAILY_ICON: Record<DailyKind, ReactNode> = {
  event: <Music size={15} />, sunset: <Sunset size={15} />, market: <ShoppingBag size={15} />, ride: <TramFront size={15} />,
  free: <Flower2 size={15} />, fire: <Flame size={15} />, new: <Camera size={15} />,
};

/** A world event's hours today, 'H:mm–H:mm' (a window closing at midnight ends at 24:00); (review) 'H:mm 起' / 'from H:mm'
 *  when the organiser gives only a start (the world's 4 h / 21:00 close is not the event's end: the opera runs to 23:00). */
const hmOf = (ms: number) => bayHm(new Date(ms)).replace(/^0(?=\d:)/, '');
const span = (w: EventWindow): Bilingual => {
  if (!windowEndKnown(w)) return { zh: `${hmOf(w.open)} 起`, en: `from ${hmOf(w.open)}` };
  const s = `${hmOf(w.open)}–${hmOf(w.close) === '0:00' ? '24:00' : hmOf(w.close)}`;
  return { zh: s, en: s };
};
const eventSource = (e: CatalogEvent) => ({ label: e.sourceLabel ?? 'BAYLINK', url: e.officialUrl && /^https:\/\//.test(e.officialUrl) ? e.officialUrl : undefined, verifiedAt: e.verifiedAt });

const CAL_ICON = (r: CalendarRow) => (r.dress === 'pumpkins' ? <Ghost size={15} /> : r.dress === 'king-tide' ? <Waves size={15} /> : <CalendarDays size={15} />);
const TIDE_KIND: Record<TideExtreme['kind'], Bilingual> = { H: { zh: '高', en: 'high' }, L: { zh: '低', en: 'low' } };

/** 'https://www.cablecarmuseum.org/info.html' → 'cablecarmuseum.org' */
const sourceLabel = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

function OfferLink({ id }: { id: string }) {
  const { t, locale } = useT();
  return (
    <small className="ob-today-src ob-today-offer">
      <a href={offerUrl(id, locale)} target="_blank" rel="noopener">{t('BAYLINK 优惠详情', 'BAYLINK offer')}<ExternalLink size={11} aria-hidden /></a>
    </small>
  );
}

export default function TodayTab() {
  const { t, locale } = useT();
  const now = useBayClock();
  const catalog = useCatalog();
  const goalsDone = useGame(s => s.goalsDone);
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  useSyncExternalStore(subscribeLive, liveOffers, liveOffers);
  const wish = useGame(s => s.wishlist);
  const [, setTidesIn] = useState(0);
  useEffect(() => {
    let on = true;
    void loadTides().then(tb => { if (on && tb) setTidesIn(n => n + 1); });
    void loadLive();
    return () => { on = false; };
  }, []);

  const day = bayParts(now).dateKey;
  const nowMs = now.getTime(), nowMin = minuteOf(now);
  const sun = sunTimes(now);
  const moon = moonPhase(now);
  const karl = karlMonthFactor(now);
  const band = BAND[sunBandAt(now)] ?? BAND.day;

  // 下一个目标: the first open explorer goal (the city list: the pelican first)
  const nextGoal = FREE_GOALS.find(g => !goalsDone.includes(g.id));
  const p = { x: runtime.player.x, z: runtime.player.z };
  const goalGo = nextGoal ? goalTargets().filter(g => g.goal === nextGoal.id).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] : undefined;

  // 今日三件小事
  const tasks: DailyTask[] | null = activeDaily()?.tasks() ?? (catalog ? dailyThree(day, daySignals(day, catalog)) : null);
  const doneCount = tasks?.filter(x => taskDone(x)).length ?? 0;

  // 今天在旧金山: world events still on today, then the hand rows not over yet
  const live = new Set(activeEventsAt(now, catalog).map(w => w.event.id));
  const todaysAll = weekEvents(now, 1, catalog).filter(w => w.dateKey === day);
  // (W6-S) the Ferry Plaza market is the hand row below, not a second row
  const todays = todaysAll.filter(w => !handRowOf(w.event));
  const hand = rowsOn(day, minuteOf(roundMinute(sun.sunset))).filter(r => rowState(r.hours, nowMin) !== 'over');
  const calToday = calendarOn(day);
  // the tides: the Lands End wrecks at a daylight low (≤ 1 ft) still ahead, else the Wave Organ before a high
  const tides = tidesOnDay(day);
  const lowAhead = tides.find(e => e.kind === 'L' && e.ft <= WRECK_LOW_FT && e.ms > nowMs && e.ms > sun.sunrise.getTime() && e.ms < sun.sunset.getTime());
  const highAhead = tides.find(e => e.kind === 'H' && e.ms > nowMs);
  // BAYLINK's offers today: on their own hand row when there is one, else a row (hidden once its hours are over)
  const offers = offersOn(day);
  const handIds = new Set(hand.map(r => r.id));
  const offerOnHand = new Map(offers.filter(o => o.offer.hand && handIds.has(o.offer.hand)).map(o => [o.offer.hand!, o.offer]));
  const offerRows = offers.filter(o => !(o.offer.hand && offerOnHand.get(o.offer.hand) === o.offer) && rowState(o.hours, nowMin) !== 'over');
  const standing = standingOffers();

  // 这周: San Francisco events of the next 7 days (not the ones above), for everyone; an event whose venue is in the
  // world shows its window there (Fleet Week: the air show at Marina Green, not the week's first programme)
  const shown = new Set(todaysAll.map(w => w.event.id));
  const worldWins = new Map(weekEvents(now, 7, catalog).map(w => [w.event.id, w]));
  const week = upcomingEvents(catalog, day, 7, now)
    .filter(u => u.event.region === 'sf' && !isAdultOnly(u.event) && !isProfessional(u.event) && !shown.has(u.event.id))
    .map(u => ({ u, win: worldWins.get(u.event.id) }))
    .sort((a, b) => (a.win?.dateKey ?? a.u.nextDate).localeCompare(b.win?.dateKey ?? b.u.nextDate))
    .slice(0, 8);
  const calWeek = calendarAhead(day, 7);

  // 我的周末: the wishlist's events on the coming weekend (+ its catalog places) → BAYLINK's planner
  const weekend = weekendOf(day);
  const wishEvents = wish.filter(w => w.kind === 'event').map(w => eventById(catalog, w.id))
    .filter((e): e is CatalogEvent => !!e)
    .map(e => ({ e, on: eventDaysInWindow(e, weekend[0], weekend[weekend.length - 1], day) }))
    .filter(x => x.on.length);
  const wishPlaces = wish.filter(w => w.kind === 'place' && !!catalog?.places.some(p => p.id === w.id));
  const planStops: PlanStop[] = [...wishEvents.map(x => ({ kind: 'event' as const, id: x.e.id })), ...wishPlaces.map(w => ({ kind: 'place' as const, id: w.id }))];
  const planDay = wishEvents[0]?.on[0] ?? weekend[0];
  const guides = WALK_GUIDES.filter(g => guideTitle(catalog, g.slug) && (!g.month || g.month === bayParts(now).month));

  const karlLine: Bilingual = karl >= 0.8 ? { zh: '这个月通常多雾，卡尔常来', en: 'Usually a foggy month — Karl drops by often' }
    : karl <= 0.4 ? { zh: '这个月通常晴朗少雾', en: 'Usually a clear month with little fog' }
    : { zh: '这个月雾通常不多也不少', en: 'Usually a month of some fog' };

  return (
    <div className="ob-today">
      <section className="ob-today-now" aria-label={t('旧金山现在', 'San Francisco now')}>
        <div className="ob-today-clock">
          <strong>{bayHm(now)}</strong>
          <span>{formatDay(day, locale, '1970-01-01')} · {t('旧金山时间', 'SF time')}</span>
        </div>
        <ul className="ob-today-sky">
          <li><Sunrise size={15} aria-hidden />{t('日出', 'Sunrise')} {sunHm(sun.sunrise).replace(/^0/, '')}</li>
          <li><Sunset size={15} aria-hidden />{t('日落', 'Sunset')} {sunHm(sun.sunset)}</li>
          <li><Moon size={15} aria-hidden />{t(`约${MOON_LABELS[moon.name].zh}`, `About a ${MOON_LABELS[moon.name].en.toLowerCase()}`)}</li>
          <li><Sun size={15} aria-hidden />{t(band)}</li>
        </ul>
        <p className="ob-today-note"><CloudFog size={14} aria-hidden />{t(karlLine)}</p>
        <small className="ob-today-src">
          {t('日出日落按 NOAA 公式算，与美国海军天文台相差 1 分钟内', 'Sun times from NOAA’s equations, within a minute of the US Naval Observatory')} ·{' '}
          <a href={MOON_SOURCE.sourceUrl} target="_blank" rel="noopener noreferrer">{t('月相', 'Moon')}<ExternalLink size={11} aria-hidden /></a> ·{' '}
          <a href={KARL_SOURCE.sourceUrl} target="_blank" rel="noopener noreferrer">{t('雾', 'Fog')}<ExternalLink size={11} aria-hidden /></a> · {t('查证于', 'checked')} {KARL_SOURCE.verifiedAt}
        </small>
      </section>

      {nextGoal && (
        <section className="ob-block">
          <h3 className="ob-h3"><Target size={15} aria-hidden />{t('下一个目标', 'Next goal')}</h3>
          <ul className="ob-today-rows">
            <Row icon={<Target size={15} />} title={t(nextGoal.label)} meta={t(nextGoal.hint)}
              side={goalGo && <GoButton label={goalGo.name} onClick={() => go({ placeId: goalGo.id, name: goalGo.name }, () => navigateTo(goalGo.id))} />} />
          </ul>
        </section>
      )}

      <section className="ob-block ob-today-daily">
        <h3 className="ob-h3"><Sparkles size={15} aria-hidden />{t('今日三件小事', 'Three small things today')}{tasks && <small className="ob-today-count">{doneCount}/{tasks.length}</small>}</h3>
        {!tasks ? <p className="ob-muted">{t('正在看今天旧金山有什么…', 'Checking what San Francisco has today…')}</p> : (
          <ul className="ob-today-rows">
            {tasks.map(task => {
              const done = taskDone(task);
              const when = taskWhen(task, nowMs);
              const target: GoToTarget | null = task.kind === 'sunset'
                ? (() => { const s = nearestSunsetSpot(p); return { placeId: s.id, name: s.name }; })()
                : task.go ? { ...(task.go.placeId ? { placeId: task.go.placeId } : { point: task.go.point }), name: task.go.name } : null;
              return (
                <Row key={task.source} icon={DAILY_ICON[task.kind]} title={t(task.title)} meta={t(task.hint)} done={done} tone={done ? undefined : when === 'over' ? 'over' : undefined}
                  side={!done && <>
                    {task.window && <State state={when} from={when === 'later' ? minuteOf(new Date(task.window.open)) : undefined} />}
                    {target && when !== 'over' && <GoButton label={target.name ?? { zh: '那里', en: 'there' }} onClick={() => go(target)} />}
                  </>}
                />
              );
            })}
          </ul>
        )}
        <p className="ob-muted ob-today-foot">
          {doneCount === 3
            ? t('今天的三件都做完啦！明天可能不一样哦～', 'All three done today! Tomorrow may bring different ones.')
            : t(`每件 +${DAILY_COINS} 金币，三件都做完再 +${DAILY_ALL_COINS} · 没做完也不会少什么，明天可能不一样`, `+${DAILY_COINS} coins each, +${DAILY_ALL_COINS} for all three · nothing is lost if you skip; tomorrow may bring different ones`)}
        </p>
      </section>

      <section className="ob-block">
        <h3 className="ob-h3"><CalendarDays size={15} aria-hidden />{t('今天在旧金山', 'Today in San Francisco')}</h3>
        <ul className="ob-today-rows">
          {todays.map(w => {
            const name = EVENT_SAY[w.event.id];
            const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
            const on = live.has(w.event.id);
            const cost = w.event.cost === 'free' ? t('免费', 'free') : w.event.costLabel ?? '';
            return (
              <Row key={w.event.id} icon={<Music size={15} />} tone={on ? 'now' : 'later'}
                title={<button type="button" className="ob-today-link" onClick={() => openEvent(w.event.id)}>{t(w.event.title, name ? cap(name.en) : w.event.title)}</button>}
                meta={`${t(place)} · ${t(span(w))}${cost ? ` · ${cost}` : ''} · ${t('以官网为准', 'check before you go')}`}
                side={<>
                  <State state={on ? 'now' : 'later'} from={minuteOf(new Date(w.open))} />
                  <GoButton label={w.venue.name} onClick={() => goToEvent(w.event)} />
                </>}>
                <Source src={eventSource(w.event)} />
              </Row>
            );
          })}
          {calToday.map(r => (
            <Row key={r.id} icon={CAL_ICON(r)} tone="now" title={`${t(r.title)} · ${t(r.where)}`} meta={`${t(r.note)}${r.sunsetNote ? ` · ${t('今天日落', 'sunset')} ${sunHm(sun.sunset)}` : ''} · ${t(GRADE_SAY[r.grade])}`}
              side={(r.placeId || r.xz) && <GoButton label={r.where} onClick={() => go(r.placeId ? { placeId: r.placeId, name: r.where } : { point: r.xz!, name: r.where })} />}>
              <Source src={r.source} />
            </Row>
          ))}
          {hand.map(r => {
            const state = rowState(r.hours, nowMin);
            const offer = offerOnHand.get(r.id);
            return (
              <Row key={r.id} icon={HAND_ICON[r.kind]} tone={state === 'open' ? 'now' : 'later'} title={`${t({ zh: r.place.zh, en: cap(r.place.en) })} · ${t(r.what)}`}
                meta={`${r.hours ? `${hm(r.hours[0])}–${hm(r.hours[1])} · ` : ''}${t(r.note)}`}
                side={<>
                  <State state={state} from={r.hours?.[0]} />
                  <GoButton label={r.place} onClick={() => go(r.placeId ? { placeId: r.placeId, name: r.place } : { point: r.at, name: r.place })} />
                </>}>
                <Source src={r.source} />
                {offer && <OfferLink id={offer.id} />}
              </Row>
            );
          })}
          {offerRows.map(({ offer, hours }) => {
            const state = rowState(hours, nowMin);
            const place = offer.place;
            return (
              <Row key={offer.id} icon={<Ticket size={15} />} tone={state === 'open' ? 'now' : 'later'}
                title={`${place ? t({ zh: place.name.zh, en: cap(place.name.en) }) : t(offer.title)} · ${offer.free ? t('免费', 'free') : t('优惠', 'discount')}`}
                meta={`${hours ? `${hm(hours[0])}–${hm(hours[1])} · ` : ''}${t(offer.who)} · ${t('以官网为准', 'check before you go')}`}
                side={<>
                  {hours && <State state={state} from={hours[0]} />}
                  {place && <GoButton label={place.name} onClick={() => go(place.id ? { placeId: place.id, name: place.name } : { point: { x: place.x, z: place.z }, name: place.name })} />}
                </>}>
                <Source src={offer.rule ? { label: sourceLabel(offer.rule.url), url: offer.rule.url, verifiedAt: offer.rule.verifiedAt } : offer.source} />
                <OfferLink id={offer.id} />
              </Row>
            );
          })}
          {tides.length > 0 && (
            <Row key="tides" icon={<Waves size={15} />} title={`${t('潮汐', 'Tides')} · ${tides.map(e => `${t(TIDE_KIND[e.kind])} ${hmOf(e.ms)}`).join(' · ')}`}
              meta={`${lowAhead ? t(`${hmOf(lowAhead.ms)} 低潮 ${ftLabel(lowAhead.ft)} 英尺：天涯海角下能看到老沉船的发动机`, `Low tide ${ftLabel(lowAhead.ft)} ft at ${hmOf(lowAhead.ms)}: the old wrecks’ engines show below Lands End`)
                : highAhead ? t(`${hmOf(highAhead.ms)} 高潮 ${ftLabel(highAhead.ft)} 英尺：涨潮时海浪风琴唱得最响`, `High tide ${ftLabel(highAhead.ft)} ft at ${hmOf(highAhead.ms)}: the Wave Organ sings loudest at high tide`)
                : t('今天的潮水都过了', 'Today’s tides have turned')} · ${t(COAST_SAFETY)}`}
              side={lowAhead
                ? <GoButton label={{ zh: '天涯海角', en: 'Lands End' }} onClick={() => go({ placeId: 'lands-end', name: { zh: '天涯海角', en: 'Lands End' } })} />
                : highAhead ? <GoButton label={{ zh: '海浪风琴', en: 'the Wave Organ' }} onClick={() => go({ placeId: 'wave-organ', name: { zh: '海浪风琴', en: 'the Wave Organ' } })} /> : undefined}>
              <small className="ob-today-src">
                {t('来源', 'Source')} · <a href={TIDE_SOURCE.url} target="_blank" rel="noopener noreferrer">{t('NOAA 潮汐预报 · 金门站', 'NOAA tide predictions · Golden Gate')}<ExternalLink size={11} aria-hidden /></a>
                {' · '}<a href={(lowAhead ? WRECKS_SOURCE : WAVE_ORGAN_SOURCE).url} target="_blank" rel="noopener noreferrer">{(lowAhead ? WRECKS_SOURCE : WAVE_ORGAN_SOURCE).label}<ExternalLink size={11} aria-hidden /></a>
                {' · '}<a href={COAST_SAFETY_SOURCE.url} target="_blank" rel="noopener noreferrer">{COAST_SAFETY_SOURCE.label}<ExternalLink size={11} aria-hidden /></a>
                {' · '}{t('查证于', 'checked')} {TIDE_SOURCE.verifiedAt}
              </small>
            </Row>
          )}
          {!todays.length && !hand.length && !calToday.length && !offerRows.length && !tides.length && <li className="ob-muted">{t('今天没有特别的安排，随便逛逛也很好。', 'Nothing special today — a wander is lovely too.')}</li>}
        </ul>
        {standing.length > 0 && (
          <p className="ob-muted ob-today-foot ob-today-standing">
            {t('长期福利（需符合条件）：', 'Standing offers (conditions apply): ')}
            {standing.map((o, i) => (
              <span key={o.id}>{i > 0 && ' · '}<a href={offerUrl(o.id, locale)} target="_blank" rel="noopener">{o.place ? t(o.place.name) : 'Muni'}</a>{t(`（${o.who.zh}）`, ` (${o.who.en})`)}</span>
            ))}
          </p>
        )}
        <p className="ob-muted ob-today-foot">{t('游戏里的地方随时都能去；时间写的是现实里的旧金山。', 'In the game every place is open any time; the hours are the real San Francisco’s.')}</p>
      </section>

      <section className="ob-block">
        <h3 className="ob-h3"><Clock size={15} aria-hidden />{t('这周', 'This week')}</h3>
        {!catalog ? <p className="ob-muted">{t('正在读取 BAYLINK 活动…', 'Loading BAYLINK events…')}</p> : !week.length && !calWeek.length ? (
          <p className="ob-muted">{t('这周旧金山暂时没有新活动，过几天再来看看。', 'No new San Francisco events this week yet — check back in a few days.')}</p>
        ) : (
          <ul className="ob-today-rows">
            {calWeek.map(r => (
              <Row key={r.id} icon={CAL_ICON(r)} title={`${t(r.title)} · ${t(r.where)}`}
                meta={`${formatDay(r.from, locale, day)}${r.to !== r.from ? `–${formatDay(r.to, locale, day)}` : ''} · ${t(r.note)}`}
                side={(r.placeId || r.xz) && <GoButton label={r.where} onClick={() => go(r.placeId ? { placeId: r.placeId, name: r.where } : { point: r.xz!, name: r.where })} />}>
                <Source src={r.source} />
              </Row>
            ))}
            {week.map(({ u, win }) => {
              const spot = eventSpot(u.event);
              const en = EVENT_SAY[u.event.id]?.en;
              const where = win ? `${t(VENUE_SAY[win.venue.id] ?? win.venue.name)} · ${t(span(win))}` : catalogText(u.event.venue ?? '', locale); // (W8-Q2, lane Q surgical) the catalog's venue is Simplified Chinese
              return (
                <Row key={u.event.id} icon={<CalendarDays size={15} />}
                  title={<button type="button" className="ob-today-link" onClick={() => openEvent(u.event.id)}>{t(u.event.title, en ? cap(en) : u.event.title)}</button>}
                  meta={`${formatDay(win?.dateKey ?? u.nextDate, locale, day)}${where ? ` · ${where}` : ''}${u.event.cost === 'free' ? ` · ${t('免费', 'free')}` : ''}`}
                  side={spot ? <GoButton label={spot.name} onClick={() => goToEvent(u.event)} />
                    : <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm ob-today-go" onClick={() => openEvent(u.event.id)}><span>{t('看看', 'See')}</span></button>}>
                  <Source src={eventSource(u.event)} />
                </Row>
              );
            })}
          </ul>
        )}
        <p className="ob-source">
          {t('活动来自 BAYLINK 编辑整理，出发前以官网为准。', 'Events are curated by BAYLINK editors — confirm on the official site before you go.')}{' '}
          <button type="button" className="ob-today-link" onClick={() => openPanel('week')}>{t('这周去哪', 'This week')}</button>
        </p>
      </section>

      <section className="ob-block ob-today-weekend">
        <h3 className="ob-h3"><Heart size={15} aria-hidden />{t('我的周末', 'My weekend')}<small className="ob-today-count">{weekend.map(d => formatDay(d, locale, day)).join(t('、', DAYS_JOIN_EN))}</small></h3>
        {wishEvents.length || wishPlaces.length ? (
          <ul className="ob-today-rows">
            {wishEvents.map(({ e, on }) => {
              const spot = eventSpot(e);
              return (
                <Row key={e.id} icon={<CalendarDays size={15} />}
                  title={<button type="button" className="ob-today-link" onClick={() => openEvent(e.id)}>{e.title}</button>}
                  meta={on.map(d => formatDay(d, locale, day)).join(t('、', DAYS_JOIN_EN))}
                  side={spot ? <GoButton label={spot.name} onClick={() => goToEvent(e)} /> : undefined} />
              );
            })}
            {wishPlaces.map(w => <Row key={w.id} icon={<Heart size={15} />} title={catalog?.places.find(p => p.id === w.id)?.title ?? w.title} meta={t('想去的地方', 'Saved place')} />)}
          </ul>
        ) : (
          <p className="ob-muted">{t('在活动卡上点「加入想去」，这个周末能去的就会出现在这里。', 'Tap “Save to wishlist” on an event card: what fits this weekend shows up here.')}</p>
        )}
        <div className="ob-actions ob-today-actions">
          {planStops.length > 0 && <LinkButton href={planUrl({ date: planDay, stops: planStops }, catalog, locale, day)} tone="primary" icon={<CalendarPlus size={17} aria-hidden />}>{t('去 BAYLINK 排周末', 'Plan the weekend on BAYLINK')}</LinkButton>}
          <LinkButton href={myWeekUrl(locale)} tone={planStops.length ? 'soft' : 'primary'} icon={<CalendarDays size={17} aria-hidden />}>{t('我的一周', 'My week')}</LinkButton>
        </div>
      </section>

      {guides.length > 0 && (
        <section className="ob-block">
          <h3 className="ob-h3"><BookOpen size={15} aria-hidden />{t('走走看 · BAYLINK 攻略', 'Walks · BAYLINK guides')}</h3>
          <ul className="ob-today-rows">
            {guides.map(g => (
              <Row key={g.slug} icon={<BookOpen size={15} />}
                title={<a className="ob-today-link" href={guideUrl(g.slug, locale)} target="_blank" rel="noopener">{t(guideTitle(catalog, g.slug) ?? g.name.zh, g.name.en)}</a>}
                meta={t(g.month ? '这个月的散步路线 · BAYLINK 攻略' : '散步路线 · BAYLINK 攻略', g.month ? 'This month’s walk · a BAYLINK guide' : 'A walk · a BAYLINK guide')}
                side={<GoButton label={g.name} onClick={() => go({ placeId: g.placeId, name: g.name })} />} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
