import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CalendarDays, Camera, Check, Clock, CloudFog, ExternalLink, Flame, Flower2, Moon, Music, Navigation, ShoppingBag, Sparkles, Sun, Sunrise, Sunset, Target, TramFront } from 'lucide-react';
import { useGame } from '../core/store';
import type { Bilingual, CatalogEvent } from '../core/types';
import { eventSpot, goToEvent, isAdultOnly, isProfessional, upcomingEvents, useCatalog } from '../data/catalog';
import { FREE_GOALS } from '../data/script';
import { ledgerVersion, subscribeLedger } from '../economy/ledger';
import { bayNow, bayParts } from '../game/bayNow';
import { goalTargets } from '../game/cityContent';
import { navigateTo, openEvent, openPanel } from '../game/flow';
import { goTo, type GoToTarget } from '../game/goTo';
import { runtime } from '../core/runtime';
import { useT } from '../i18n';
import { formatDay } from '../ui/format';
import { activeDaily, dailyThree, daySignals, nearestSunsetSpot, taskDone, taskWhen, DAILY_ALL_COINS, DAILY_COINS, type DailyKind, type DailyTask } from './daily';
import { EVENT_SAY, VENUE_SAY } from './eventVenues';
import { activeEventsAt, weekEvents, type EventWindow } from './events';
import { MOON_LABELS, MOON_SOURCE, moonPhase } from './moon';
import { KARL_SOURCE, karlMonthFactor } from './seasons';
import { bayHm, sunBandAt, sunTimes } from './sun';
import { hm, rowState, rowsOn, type HandRow, type SourceRef } from './todayRows';
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

/** A world event's hours today, 'H:mm–H:mm' (a window closing at midnight ends at 24:00). */
const hmOf = (ms: number) => bayHm(new Date(ms)).replace(/^0(?=\d:)/, '');
const span = (w: EventWindow) => `${hmOf(w.open)}–${hmOf(w.close) === '0:00' ? '24:00' : hmOf(w.close)}`;
const eventSource = (e: CatalogEvent) => ({ label: e.sourceLabel ?? 'BAYLINK', url: e.officialUrl && /^https:\/\//.test(e.officialUrl) ? e.officialUrl : undefined, verifiedAt: e.verifiedAt });

export default function TodayTab() {
  const { t, locale } = useT();
  const now = useBayClock();
  const catalog = useCatalog();
  const goalsDone = useGame(s => s.goalsDone);
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);

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
  const todays = weekEvents(now, 1, catalog).filter(w => w.dateKey === day);
  const hand = rowsOn(day, minuteOf(sun.sunset)).filter(r => rowState(r.hours, nowMin) !== 'over');

  // 这周: San Francisco events of the next 7 days (not the ones above), for everyone; an event whose venue is in the
  // world shows its window there (Fleet Week: the air show at Marina Green, not the week's first programme)
  const shown = new Set(todays.map(w => w.event.id));
  const worldWins = new Map(weekEvents(now, 7, catalog).map(w => [w.event.id, w]));
  const week = upcomingEvents(catalog, day, 7, now)
    .filter(u => u.event.region === 'sf' && !isAdultOnly(u.event) && !isProfessional(u.event) && !shown.has(u.event.id))
    .map(u => ({ u, win: worldWins.get(u.event.id) }))
    .sort((a, b) => (a.win?.dateKey ?? a.u.nextDate).localeCompare(b.win?.dateKey ?? b.u.nextDate))
    .slice(0, 8);

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
          <li><Sunrise size={15} aria-hidden />{t('日出', 'Sunrise')} {bayHm(sun.sunrise).replace(/^0/, '')}</li>
          <li><Sunset size={15} aria-hidden />{t('日落', 'Sunset')} {bayHm(sun.sunset)}</li>
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
                meta={`${t(place)} · ${span(w)}${cost ? ` · ${cost}` : ''} · ${t('以官网为准', 'check before you go')}`}
                side={<>
                  <State state={on ? 'now' : 'later'} from={minuteOf(new Date(w.open))} />
                  <GoButton label={w.venue.name} onClick={() => goToEvent(w.event)} />
                </>}>
                <Source src={eventSource(w.event)} />
              </Row>
            );
          })}
          {hand.map(r => {
            const state = rowState(r.hours, nowMin);
            return (
              <Row key={r.id} icon={HAND_ICON[r.kind]} tone={state === 'open' ? 'now' : 'later'} title={`${t({ zh: r.place.zh, en: cap(r.place.en) })} · ${t(r.what)}`}
                meta={`${r.hours ? `${hm(r.hours[0])}–${hm(r.hours[1])} · ` : ''}${t(r.note)}`}
                side={<>
                  <State state={state} from={r.hours?.[0]} />
                  <GoButton label={r.place} onClick={() => go(r.placeId ? { placeId: r.placeId, name: r.place } : { point: r.at, name: r.place })} />
                </>}>
                <Source src={r.source} />
              </Row>
            );
          })}
          {!todays.length && !hand.length && <li className="ob-muted">{t('今天没有特别的安排，随便逛逛也很好。', 'Nothing special today — a wander is lovely too.')}</li>}
        </ul>
        <p className="ob-muted ob-today-foot">{t('游戏里的地方随时都能去；时间写的是现实里的旧金山。', 'In the game every place is open any time; the hours are the real San Francisco’s.')}</p>
      </section>

      <section className="ob-block">
        <h3 className="ob-h3"><Clock size={15} aria-hidden />{t('这周', 'This week')}</h3>
        {!catalog ? <p className="ob-muted">{t('正在读取 BAYLINK 活动…', 'Loading BAYLINK events…')}</p> : !week.length ? (
          <p className="ob-muted">{t('这周旧金山暂时没有新活动，过几天再来看看。', 'No new San Francisco events this week yet — check back in a few days.')}</p>
        ) : (
          <ul className="ob-today-rows">
            {week.map(({ u, win }) => {
              const spot = eventSpot(u.event);
              const en = EVENT_SAY[u.event.id]?.en;
              const where = win ? `${t(VENUE_SAY[win.venue.id] ?? win.venue.name)} · ${span(win)}` : u.event.venue ?? '';
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
    </div>
  );
}
