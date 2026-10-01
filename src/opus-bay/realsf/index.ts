import { createElement } from 'react';
import { CalendarHeart, Sun } from 'lucide-react';
import { glideUnlocked } from '../actors/moveApi';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, CatalogEvent } from '../core/types';
import { eventById, getCatalog, setEventVenueHooks, type EventSpot } from '../data/catalog';
import { bayNow, bayParts } from '../game/bayNow';
import { baybayHeld } from '../game/baybayHold';
import { cinemaActive } from '../game/cinema';
import { startTravel, travelActive } from '../game/fastTravel';
import { bubble, closePanel, dialogueOpen, navigateTo, openEvent } from '../game/flow';
import { goTo } from '../game/goTo';
import { flow } from '../game/flowStore';
import { BAYBAY_ID, registerPrefixResolver, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { requestHopOff } from '../game/transit';
import { lastWelcome, onWelcome } from '../game/welcome';
import { openJournal, registerAskItem, registerJournalTab } from '../ui/slots';
import { initDaily } from './daily';
import { calendarLines } from './calendar';
import { initDressing } from './dressing';
import { worldEvent } from './events';
import { venueLatLng, type EventVenue } from './eventVenues';
import { createDayMemory, RealLineScheduler, type OfferedLine } from './lines';
import { loadLive } from './live';
import { moonPhase } from './moon';
import { initJets } from './jets';
import { initPresence } from './presence';
import { initOpenings } from './openingSigns';
import { FIRE_SEASON_LAST_DAY } from './seasons';
import { sunBandAt, sunTimes, sunsetLine } from './sun';
import { loadTides, tideLoudness } from './tides';
import { todayLine } from './todayLine';
import { holdJetsForParade, isParadeDay } from '../world/sf/fleetWeekDay';
import type { FleetWeek } from '../world/sf/fleetWeek';
import { importRetry } from '../game/importRetry';

/**
 * Wave 5 · lane R — the real San Francisco: the sun, events at their venues, 今天 · SF Today, 今日三件小事, Fleet Week.
 *
 * game/w5Features.ts loads this module lazily in city mode only and calls `init()` once (after the economy); `init()`
 * starts everything and returns the function that undoes it. District mode never loads it (the district never changes).
 *
 *   W5-R1  the sky follows San Francisco's real sun (game/qa.ts bayTimeOfDay, city mode) — nothing to start here;
 *          BAYBAY's once-a-Bay-day sunset line (in the two and a half hours before sunset)
 *   W5-R2  the venue table into the catalog (data/catalog.ts setEventVenueHooks): "附近这周" by mapped venue, 带我去 on
 *          flyers and event cards, the week board's playable city first; `event:<catalog id>` resolves to the venue
 *          (the waypoint and navigateTo walk there)
 *   W5-R3  realsf/presence.ts: during an event's real window its pennant, crowd, toy kit, loop, BAYBAY's line and the
 *          souvenir stamp; BAYBAY's fire-season line at Ocean Beach on 31 October
 *   W5-R4  今天 · SF Today: a Journal tab (realsf/TodayTab.tsx, loaded on first view) and 今天旧金山有什么？ in the 问
 *          BAYBAY menu; BAYBAY's SF Today line after lane C's welcome back (realsf/todayLine.ts)
 *   W5-R5  今日三件小事 (realsf/daily.ts): three small things seeded by the Bay date, paid by lane E's ledger
 *   W5-R6  Fleet Week over the Bay (realsf/jets.ts): the toy jets, their smoke and roar, the show-day line and the
 *          waypoint, the photo stamp, the pelican's soft boxes — Oct 9–11, 12:00–16:00 only
 *   W5-R7  the shoulds: the verified calendar (realsf/calendar.ts) and its dressings (realsf/dressing.ts: Halloween's
 *          pumpkins, the king tides' spray), the baked tides (realsf/tides.ts → lane D's Wave Organ louder near high
 *          tide) and BAYLINK's offers (realsf/live.ts), both same-site files fetched at idle; 现实中怎么去 on event cards
 *          (realsf/HowToGo.tsx); BAYBAY's 今晚差不多满月 on Twin Peaks and Ocean Beach
 *
 * The hooks other lanes read (plan §4.3) are their own small modules: realsf/sun.ts (sunBandAt, sunTimes, sunPosition),
 * realsf/seasons.ts (isFireRingLit, fireRingSeason, karlMonthFactor), realsf/moon.ts (moonPhase),
 * realsf/eventVenues.ts (eventVenue), realsf/events.ts (activeEventsAt, weekEvents).
 */

const spotOf = (v: EventVenue): EventSpot => ({ x: v.x, z: v.z, ...venueLatLng(v), name: v.name });

/**
 * 带我去 a venue through lane N's goTo (the planner's best way: BAYBAY leads, a ride, or the pelican once unlocked). If
 * the trip runner cannot take it ('unknown' / 'no-way'), the old way: fly once the pelican is unlocked, else walk there
 * with BAYBAY (the waypoint shows the way).
 */
export function goToVenue(event: CatalogEvent, venue: EventVenue) {
  const id = `event:${event.id}`;
  const target = venue.placeId ? { placeId: venue.placeId, name: venue.name } : { point: { x: venue.x, z: venue.z }, name: venue.name };
  void goTo(target, { source: 'realsf:event' }).then(r => {
    if (r.ok || (r.why !== 'unknown' && r.why !== 'no-way')) return;
    if (glideUnlocked()) {
      const s = game.get();
      if (s.move.mode === 'transit' || s.riding) requestHopOff();
      closePanel();
      startTravel({ id: venue.placeId ?? id, name: venue.name, x: venue.x, z: venue.z });
      return;
    }
    navigateTo(id);
  });
}

/** `event:<catalog id>` → an interactable at the event's venue (not listed: no E prompt; the waypoint and 带我去 use it). */
export function eventInteractable(id: string): Interactable | undefined {
  const event = eventById(getCatalog(), id.slice('event:'.length));
  const venue = event ? worldEvent(event) : null;
  if (!event || !venue) return undefined;
  return {
    id, source: 'event', action: 'info', verb: { zh: '看看活动', en: 'See the event' }, name: venue.name,
    x: venue.x, z: venue.z, radius: 10, act: () => openEvent(event.id),
  };
}

/** The once-a-Bay-day sunset line is offered from this long before sunset (ms) until 5 min before it. */
const SUNSET_LEAD = 150 * 60_000;

/** Ocean Beach's fire rings (the season's last-day line is offered within this of them, u). */
const FIRE_RINGS_AT = { x: -564.83, z: 1363.73 }, FIRE_LINE_NEAR = 220;

/** Where BAYBAY says the full-moon line (Twin Peaks' overlook, Ocean Beach; u) and how full the moon must be. */
export const MOON_SPOTS = [{ x: 125.7, z: 937.8 }, { x: -431, z: 1475 }] as const;
export const MOON_NEAR = 250, MOON_FULL = 0.96;
export const FULL_MOON_LINE: Bilingual = { zh: '今晚差不多满月，在这儿看月亮正好～', en: 'Nearly a full moon tonight — a lovely spot to watch it rise.' };
/** The full-moon line is on offer: the moon ≥ 96 % lit, the sky golden or night, within MOON_NEAR of a moon spot. */
export function fullMoonNear(now: Date, p: { x: number; z: number }): boolean {
  const band = sunBandAt(now);
  if (band !== 'golden' && band !== 'night') return false;
  if (moonPhase(now).illumination < MOON_FULL) return false;
  return MOON_SPOTS.some(s => Math.hypot(p.x - s.x, p.z - s.z) < MOON_NEAR);
}
/** The same-site files (tides.json, live.json) are fetched this long after init (ms): never in the first frames. */
const IDLE_FETCH_MS = 4000;

/** The 今天 tab's icon and the ask item's (the Journal draws slot icons bare: size them here). */
const TodayIcon = () => createElement(Sun, { size: 16, 'aria-hidden': true });
const AskIcon = () => createElement(CalendarHeart, { size: 18, 'aria-hidden': true });
/** a welcome back this recent (ms) still gets BAYBAY's SF Today line when this chunk loads after it */
const WELCOME_LATE = 60_000;

export function init(): () => void {
  const offVenues = setEventVenueHooks({
    locate: event => { const v = worldEvent(event); return v ? spotOf(v) : null; },
    go: event => { const v = worldEvent(event); if (v) goToVenue(event, v); },
  });
  const offResolver = registerPrefixResolver('event:', eventInteractable);
  // W5-R3: the open events in the world (pennants, crowds, kits, loops, lines, souvenirs)
  const presence = initPresence();
  // W5-R5 / R4 / R6: the daily three, the 今天 tab, the ask item, the welcome-back line, the Fleet Week jets
  const daily = initDaily();
  const offTab = registerJournalTab({
    id: 'today', order: 5, label: { zh: '今天', en: 'Today' }, icon: TodayIcon,
    count: () => { const list = daily.tasks(); return list ? `${list.filter(t => daily.done(t)).length}/${list.length}` : undefined; },
    load: () => importRetry(() => import('./TodayTab')),
  });
  const offAsk = registerAskItem({ id: 'realsf-today', order: 40, label: { zh: '今天旧金山有什么？', en: 'What’s on in SF today?' }, icon: AskIcon, onSelect: () => openJournal('today') });
  let welcomeSaid = false;
  const offWelcome = onWelcome(kind => { if (kind !== 'returning') return null; welcomeSaid = true; return todayLine(); });
  const lw = lastWelcome();
  let welcomeLate = !!lw && lw.kind === 'returning' && performance.now() - lw.at < WELCOME_LATE;
  const jets = initJets();
  // W5-R7: the calendar's dressings; the baked files at idle; lane D's Wave Organ follows the real tide
  const dressing = initDressing();
  // W6-S3: the autumn release's new San Francisco openings (a 新店 sign at the address, its card → the BAYLINK page)
  const openings = initOpenings();
  let organOff: (() => void) | null = null;
  // (review) a teardown while the eggs chunk is still loading must not wire the organ afterwards
  let live = true;
  const idle = setTimeout(() => {
    void loadTides();
    void loadLive();
    void importRetry(() => import('../eggs/marina')).then(m => { if (!live) return; m.setOrganTide(() => tideLoudness()); organOff = () => m.setOrganTide(null); }, () => undefined);
  }, IDLE_FETCH_MS);
  // W8-S: Fleet Week's Parade of Ships (9 Oct 11:00–12:00) — its own lazy chunk, loaded on the parade's Bay day only
  let parade: FleetWeek | null = null;
  let paradeLoading = false;
  /** (W8-S review) failed loads: retried, and after PARADE_TRIES the jets' lines stop waiting for it */
  let paradeFails = 0;
  const PARADE_TRIES = 3;
  const loadParade = () => {
    if (parade || paradeLoading || paradeFails >= PARADE_TRIES) return;
    paradeLoading = true;
    void importRetry(() => import('../world/sf/fleetWeek')).then(m => { if (live) parade = m.initFleetWeek(); }, () => { paradeLoading = false; paradeFails++; });
  };
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    (window as unknown as { __opusRealSF?: unknown }).__opusRealSF = {
      presence: () => presence.stats(), jets: () => jets.stats(), dressing: () => dressing.stats(), organWired: () => organOff !== null,
      openings: () => openings.stats(),
      parade: () => parade?.stats() ?? null,
      daily: () => daily.tasks()?.map(t => ({ n: t.n, kind: t.kind, source: t.source, done: daily.done(t), title: t.title.zh })) ?? null,
      complete: (kind: Parameters<typeof daily.complete>[0]) => daily.complete(kind),
      /** QA (review): the line keys on offer right now, by source */
      offered: () => ({ presence: presence.offered().map(l => l.key), jets: jets.offered().map(l => l.key), daily: daily.offered().map(l => l.key), dressing: dressing.offered().map(l => l.key), calendar: calendarLines(bayNow(), runtime.player).map(l => l.key), parade: parade?.offered().map(l => l.key) ?? [] }),
    };
  }

  // BAYBAY's real-SF lines (once per key per Bay day), gated like her city lines
  const sched = new RealLineScheduler(createDayMemory());
  let acc = 0;
  const offLines = registerFrameSystem('w5-realsf-lines', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    const s = game.get(), f = flow.get();
    const now = bayNow(), day = bayParts(now).dateKey;
    if (!parade && isParadeDay(now)) loadParade();
    // (W8-S) on 9 Oct the parade's lines (11:00) come before the jets' (12:00): the scheduler takes the first unsaid key;
    // (W8-S review, S-P5) while the parade's chunk is still loading that day the jets' lines wait for it
    const holdJets = holdJetsForParade(now, { ready: !!parade, failed: paradeFails >= PARADE_TRIES });
    const offered: OfferedLine[] = [...presence.offered(), ...(parade?.offered() ?? []), ...(holdJets ? [] : jets.offered()), ...daily.offered(), ...dressing.offered(), ...calendarLines(now, runtime.player)];
    if (welcomeLate && !welcomeSaid) offered.unshift({ key: 'today-welcome', text: todayLine(now) });
    const sun = sunTimes(now), t = now.getTime();
    if (t >= sun.sunset.getTime() - SUNSET_LEAD && t < sun.sunset.getTime() - 5 * 60_000) offered.push({ key: 'sunset', text: sunsetLine(now) });
    const p = bayParts(now);
    if (p.month === 10 && p.day === 31 && Math.hypot(runtime.player.x - FIRE_RINGS_AT.x, runtime.player.z - FIRE_RINGS_AT.z) < FIRE_LINE_NEAR) offered.push({ key: 'fire-season-end', text: FIRE_SEASON_LAST_DAY });
    if (fullMoonNear(now, runtime.player)) offered.push({ key: 'full-moon', text: FULL_MOON_LINE });
    if (!offered.length) return;
    const line = sched.step(performance.now() / 1000, day, {
      silent: s.phase !== 'playing' || s.paused || s.mode === 'onboarding' || dialogueOpen() || cinemaActive() || !!f.cinematic || travelActive()
        || s.move.mode === 'travel' || s.photoMode || !!f.postcardReward || !!f.postcardFly || !!f.fishing || s.panel.kind !== null
        || baybayHeld(), // W8-K1 (lane K, surgical): a play panel, an egg card, the Halloween postcard… (game/baybayHold.ts)
      bubble: !!f.bubble,
      quiet: performance.now() < f.quietUntil,
    }, offered);
    if (!line) return;
    if (line.key === 'today-welcome') welcomeLate = false;
    if (line.key.startsWith('jets-')) jets.said(line.key);
    if (line.key.startsWith('parade-')) parade?.said(line.key);
    if (bubble(line.text, 4600, BAYBAY_ID, 'bark')) emit({ type: 'voice-line', id: `realsf-${line.key}` });
  }, 5);

  return () => {
    live = false;
    clearTimeout(idle); organOff?.(); organOff = null; dressing.off(); openings.off();
    offLines(); parade?.off(); parade = null; jets.off(); offWelcome(); offAsk(); offTab(); daily.off(); presence.off(); offResolver(); offVenues();
    if (import.meta.env?.DEV && typeof window !== 'undefined') delete (window as unknown as { __opusRealSF?: unknown }).__opusRealSF;
  };
}
