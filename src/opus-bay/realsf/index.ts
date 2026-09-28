import { glideUnlocked } from '../actors/moveApi';
import { emit } from '../core/events';
import { game } from '../core/store';
import type { CatalogEvent } from '../core/types';
import { eventById, getCatalog, setEventVenueHooks, type EventSpot } from '../data/catalog';
import { bayNow, bayParts } from '../game/bayNow';
import { cinemaActive } from '../game/cinema';
import { startTravel, travelActive } from '../game/fastTravel';
import { bubble, closePanel, dialogueOpen, navigateTo, openEvent } from '../game/flow';
import { flow } from '../game/flowStore';
import { BAYBAY_ID, registerPrefixResolver, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { requestHopOff } from '../game/transit';
import { worldEvent } from './events';
import { venueLatLng, type EventVenue } from './eventVenues';
import { createDayMemory, RealLineScheduler, type OfferedLine } from './lines';
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
 *
 * The hooks other lanes read (plan §4.3) are their own small modules: realsf/sun.ts (sunBandAt, sunTimes, sunPosition),
 * realsf/seasons.ts (isFireRingLit, fireRingSeason, karlMonthFactor), realsf/moon.ts (moonPhase),
 * realsf/eventVenues.ts (eventVenue), realsf/events.ts (activeEventsAt, weekEvents).
 */

const spotOf = (v: EventVenue): EventSpot => ({ x: v.x, z: v.z, ...venueLatLng(v), name: v.name });

/** 带我去 a venue: fly with the pelican once it is unlocked, else walk there with BAYBAY (the waypoint shows the way). */
export function goToVenue(event: CatalogEvent, venue: EventVenue) {
  const id = `event:${event.id}`;
  if (glideUnlocked()) {
    const s = game.get();
    if (s.move.mode === 'transit' || s.riding) requestHopOff();
    closePanel();
    startTravel({ id: venue.placeId ?? id, name: venue.name, x: venue.x, z: venue.z });
    return;
  }
  navigateTo(id);
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

export function init(): () => void {
  const offVenues = setEventVenueHooks({
    locate: event => { const v = worldEvent(event); return v ? spotOf(v) : null; },
    go: event => { const v = worldEvent(event); if (v) goToVenue(event, v); },
  });
  const offResolver = registerPrefixResolver('event:', eventInteractable);

  // BAYBAY's real-SF lines (once per key per Bay day), gated like her city lines
  const sched = new RealLineScheduler(createDayMemory());
  let acc = 0;
  const offLines = registerFrameSystem('w5-realsf-lines', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    const s = game.get(), f = flow.get();
    const now = bayNow(), day = bayParts(now).dateKey;
    const offered: OfferedLine[] = [];
    const sun = sunTimes(now), t = now.getTime();
    if (t >= sun.sunset.getTime() - SUNSET_LEAD && t < sun.sunset.getTime() - 5 * 60_000) offered.push({ key: 'sunset', text: sunsetLine(now) });
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

  return () => { offLines(); offResolver(); offVenues(); };
}
