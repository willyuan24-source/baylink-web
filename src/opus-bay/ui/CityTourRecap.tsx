import { tourIdOf, useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { SF_GRAND, cityTour, targetAt, type CityTourDef } from '../data/sf/tours';
import { arrivalSeen } from '../game/cityContent';
import { lastCityTour, playedStop, savedProgress } from '../game/cityTour';
import { closePanel, openEvent, openPanel, startWeek } from '../game/flow';
import { interactableById } from '../game/interactables';
import { weekEvents, type EventWindow } from '../realsf/events';
import { catalogText, useT } from '../i18n';
import { RecapMap } from './RecapMap';
import { TourRecap } from './TourRecap';

/**
 * Wave 4 · lane C · W4-C4: the Grand Tour's recap in the game (ui/Moments Recap mounts it lazily when `game.tour` holds
 * a city tour). Reads the store and hands ui/TourRecap its props: the stops done (game.tour.completed), the version
 * played (the run that just ended, else the save), postcards, the arrival stamps of the tour's attractions, and lane P's
 * recap map over the painted city (ui/RecapMap.tsx, in this lazy chunk) as its map.
 */
/** (W9-N3) an event this close (u) to a tour stop's end is "near the stops" (≈ a few minutes on foot in the game). */
export const NEAR_STOP_U = 300;

/** The tour's stop postcards (review R§6: the recap said 0/24 — every postcard of the city, not the tour's). */
export function tourPostcards(def: CityTourDef, express: boolean, have: readonly string[]): { found: number; total: number } {
  const ids = [...new Set(def.chapters.flatMap(c => c.stops.flatMap(s => (s.postcard && !s.optional && !(express && s.express === 'skip') ? [s.postcard] : []))))];
  return { found: ids.filter(id => have.includes(id)).length, total: ids.length };
}

/** This week's world events whose venue lies within NEAR_STOP_U of a tour stop (soonest first, at most `max`). */
export function eventsNearStops(def: CityTourDef, windows: readonly EventWindow[], max = 3): EventWindow[] {
  const ends = def.chapters.flatMap(c => c.stops.flatMap(s => { const p = targetAt(s.target); return p ? [p] : []; }));
  const seen = new Set<string>();
  return windows.filter(w => {
    if (seen.has(w.event.id) || !ends.some(p => Math.hypot(p.x - w.venue.x, p.z - w.venue.z) <= NEAR_STOP_U)) return false;
    seen.add(w.event.id);
    return true;
  }).slice(0, max);
}

/** eventsNearStops over this week's windows; an unloaded catalog is no events (the box then points to 这周). */
function nearStopsSafe(def: CityTourDef): EventWindow[] {
  try { return eventsNearStops(def, weekEvents()); } catch { return []; }
}

const WEEK_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "周六 10/3" / "Sat 10/3" for a Bay date key. */
export function dayLabel(dateKey: string): Bilingual {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return { zh: `${WEEK_ZH[wd]} ${m}/${d}`, en: `${WEEK_EN[wd]} ${m}/${d}` };
}

export default function CityTourRecap() {
  const { locale } = useT();
  const tourState = useGame(s => s.tour);
  const have = useGame(s => s.postcards);
  const def = cityTour(tourIdOf(tourState)) ?? SF_GRAND;
  const last = lastCityTour();
  const express = last && last.def.id === def.id ? last.express : !!savedProgress(def.id)?.express;
  const attractions = [...new Set(def.chapters.flatMap(c => c.stops.flatMap(s => (s.attraction && !s.optional && !(express && s.express === 'skip') ? [s.attraction] : []))))];
  const postcards = tourPostcards(def, !!express, have);
  const nearby = nearStopsSafe(def);
  const stopName = (id: string): Bilingual | null => {
    const stop = def.chapters.flatMap(c => c.stops).find(s => s.id === id);
    return stop ? interactableById(playedStop(def, stop, express).target)?.name ?? null : null;
  };
  return (
    <TourRecap
      tour={def}
      completed={tourState.completed}
      postcards={postcards}
      stamps={{ found: attractions.filter(a => arrivalSeen(a)).length, total: attractions.length }}
      express={express}
      stopName={stopName}
      onClose={closePanel}
      onOpenMap={() => openPanel('map')}
      mapSlot={<RecapMap tour={def} completed={tourState.completed} express={express} stopName={stopName} />}
      nearby={nearby.map(w => ({ id: w.event.id, title: catalogText(w.event.title, locale), when: dayLabel(w.dateKey), where: w.venue.name }))}
      onEvent={id => { closePanel(); openEvent(id); }}
      onWeek={() => { closePanel(); startWeek(); }}
    />
  );
}
