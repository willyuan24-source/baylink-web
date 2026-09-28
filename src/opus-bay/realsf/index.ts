import { glideUnlocked } from '../actors/moveApi';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { CatalogEvent } from '../core/types';
import { eventById, getCatalog, setEventVenueHooks, type EventSpot } from '../data/catalog';
import { bayNow, bayParts } from '../game/bayNow';
import { cinemaActive } from '../game/cinema';
import { startTravel, travelActive } from '../game/fastTravel';
import { bubble, closePanel, dialogueOpen, navigateTo, openEvent } from '../game/flow';
import { goTo } from '../game/goTo';
import { flow } from '../game/flowStore';
import { BAYBAY_ID, registerPrefixResolver, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { requestHopOff } from '../game/transit';
import { worldEvent } from './events';
import { venueLatLng, type EventVenue } from './eventVenues';
import { createDayMemory, RealLineScheduler, type OfferedLine } from './lines';
import { initPresence } from './presence';
import { FIRE_SEASON_LAST_DAY } from './seasons';
import { sunTimes, sunsetLine } from './sun';

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

export function init(): () => void {
  const offVenues = setEventVenueHooks({
    locate: event => { const v = worldEvent(event); return v ? spotOf(v) : null; },
    go: event => { const v = worldEvent(event); if (v) goToVenue(event, v); },
  });
  const offResolver = registerPrefixResolver('event:', eventInteractable);
  // W5-R3: the open events in the world (pennants, crowds, kits, loops, lines, souvenirs)
  const presence = initPresence();
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __opusRealSF?: unknown }).__opusRealSF = { presence: () => presence.stats() };

  // BAYBAY's real-SF lines (once per key per Bay day), gated like her city lines
  const sched = new RealLineScheduler(createDayMemory());
  let acc = 0;
  const offLines = registerFrameSystem('w5-realsf-lines', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    const s = game.get(), f = flow.get();
    const now = bayNow(), day = bayParts(now).dateKey;
    const offered: OfferedLine[] = [...presence.offered()];
    const sun = sunTimes(now), t = now.getTime();
    if (t >= sun.sunset.getTime() - SUNSET_LEAD && t < sun.sunset.getTime() - 5 * 60_000) offered.push({ key: 'sunset', text: sunsetLine(now) });
    const p = bayParts(now);
    if (p.month === 10 && p.day === 31 && Math.hypot(runtime.player.x - FIRE_RINGS_AT.x, runtime.player.z - FIRE_RINGS_AT.z) < FIRE_LINE_NEAR) offered.push({ key: 'fire-season-end', text: FIRE_SEASON_LAST_DAY });
    if (!offered.length) return;
    const line = sched.step(performance.now() / 1000, day, {
      silent: s.phase !== 'playing' || s.paused || s.mode === 'onboarding' || dialogueOpen() || cinemaActive() || !!f.cinematic || travelActive()
        || s.move.mode === 'travel' || s.photoMode || !!f.postcardReward || !!f.postcardFly || !!f.fishing || s.panel.kind !== null,
      bubble: !!f.bubble,
      quiet: performance.now() < f.quietUntil,
    }, offered);
    if (!line) return;
    bubble(line.text, 4600, BAYBAY_ID, 'bark');
    emit({ type: 'voice-line', id: `realsf-${line.key}` });
  }, 5);

  return () => {
    offLines(); presence.off(); offResolver(); offVenues();
    if (import.meta.env?.DEV && typeof window !== 'undefined') delete (window as unknown as { __opusRealSF?: unknown }).__opusRealSF;
  };
}
