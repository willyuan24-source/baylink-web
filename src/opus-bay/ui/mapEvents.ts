import { useEffect, useState } from 'react';
import type { Bilingual } from '../core/types';
import { bayNow, bayParts } from '../game/bayNow';

/**
 * Wave 5 · lane N · the map's 这周 (plan §3.3 R2 "Map: a 这周 filter, on by default while an SF event is live (DOM
 * badges, no sticker atlas)"; the shot "the map with the 这周 filter on Oct 3"): lane R's world events of the next seven
 * days (realsf/events.ts weekEvents, the published hook — loaded lazily with the map, never in GameRoot's graph) as coral
 * pins at their venues. Under 全部 the events of today show (the live ones pulse); the 这周 chip shows the week and dims
 * the rest of the map. A pin tap opens the pinned card: when, where, the go button, the event card (官网 · 加入想去).
 */

/** What the pins need of lane R's EventWindow (realsf/events.ts). */
export interface EventWindowLike {
  event: { id: string; title: string };
  venue: { id: string; name: Bilingual; x: number; z: number; placeId?: string };
  open: number;
  close: number;
}

export interface WeekPinEvent { id: string; title: string; when: Bilingual; live: boolean; today: boolean; open: number }
/** One pin per venue: its events soonest first. */
export interface WeekPin { key: string; venue: EventWindowLike['venue']; live: boolean; today: boolean; events: WeekPinEvent[] }

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hm = (p: { hour: number; minute: number }) => `${p.hour}:${String(p.minute).padStart(2, '0')}`;

/**
 * When an event window is, from `now` (Bay time): 进行中 · 到 16:00 / 今天 11:00–16:00 / 明天 11:00–18:00 /
 * 10/4 周六 11:00–18:00.
 */
export function whenLabel(open: number, close: number, now: number): Bilingual {
  const o = bayParts(new Date(open)), c = bayParts(new Date(close)), n = bayParts(new Date(now));
  const span = `${hm(o)}–${hm(c)}`;
  if (open <= now && now < close) return { zh: `进行中 · 到 ${hm(c)}`, en: `On now · until ${hm(c)}` };
  if (o.dateKey === n.dateKey) return { zh: `今天 ${span}`, en: `Today ${span}` };
  const tomorrow = bayParts(new Date(now + 24 * 3600_000)).dateKey;
  if (o.dateKey === tomorrow) return { zh: `明天 ${span}`, en: `Tomorrow ${span}` };
  return { zh: `${o.month}/${o.day} ${WEEKDAY_ZH[o.weekday]} ${span}`, en: `${WEEKDAY_EN[o.weekday]} ${o.month}/${o.day} ${span}` };
}

/** The pins (pure): one per venue, events soonest first; a pin is live / today when one of its events is. */
export function weekPins(windows: readonly EventWindowLike[], now: number): WeekPin[] {
  const today = bayParts(new Date(now)).dateKey;
  const byVenue = new Map<string, WeekPin>();
  for (const w of [...windows].sort((a, b) => a.open - b.open)) {
    if (w.close <= now || !Number.isFinite(w.venue.x) || !Number.isFinite(w.venue.z)) continue;
    const live = w.open <= now && now < w.close, isToday = bayParts(new Date(w.open)).dateKey === today || live;
    let pin = byVenue.get(w.venue.id);
    if (!pin) { pin = { key: `ev:${w.venue.id}`, venue: w.venue, live: false, today: false, events: [] }; byVenue.set(w.venue.id, pin); }
    if (pin.events.some(e => e.id === w.event.id)) continue;
    pin.events.push({ id: w.event.id, title: w.event.title, when: whenLabel(w.open, w.close, now), live, today: isToday, open: w.open });
    pin.live ||= live;
    pin.today ||= isToday;
  }
  return [...byVenue.values()];
}

/** The pins a filter shows: 这周 every one, 全部 today's (on by default while an event is live), the others none. */
export function pinsFor(filter: string, pins: readonly WeekPin[]): WeekPin[] {
  if (filter === 'week') return [...pins];
  if (filter === 'all') return pins.filter(p => p.today);
  return [];
}

/**
 * (W5-N review) What the map frames when the player picks 这周 (pure): every pin of the week and the player. The chip
 * left the view where it was — opened near the player (a resume in the Marina, a trip's end), the week's venues sat
 * outside the frame or under the tool column, so 这周 3 showed one pin or none. Empty: nothing to frame.
 */
export function weekFitPoints(pins: readonly Pick<WeekPin, 'venue'>[], player: { x: number; z: number } | null): { x: number; z: number }[] {
  if (!pins.length) return [];
  const pts = pins.map(p => ({ x: p.venue.x, z: p.venue.z }));
  return player && Number.isFinite(player.x) && Number.isFinite(player.z) ? [{ x: player.x, z: player.z }, ...pts] : pts;
}

/** How often the pins are read again while the map is open (ms): an event opening or closing shows within a minute. */
export const WEEK_PINS_MS = 60_000;

/**
 * The week's pins while the map is open: lane R's weekEvents through a dynamic import (the realsf chunk the city has
 * already loaded), read again every minute and a few seconds after opening (the catalog may still be arriving). Empty
 * when the module or the catalog is not there.
 */
export function useWeekPins(): WeekPin[] {
  const [pins, setPins] = useState<WeekPin[]>([]);
  useEffect(() => {
    let live = true;
    const read = () => {
      void import('../realsf/events').then(m => {
        if (!live) return;
        const now = bayNow();
        setPins(weekPins(m.weekEvents(now, 7), now.getTime()));
      }, () => { /* no realsf chunk: no pins */ });
    };
    read();
    const soon = window.setTimeout(read, 3000);
    const id = window.setInterval(read, WEEK_PINS_MS);
    return () => { live = false; window.clearTimeout(soon); window.clearInterval(id); };
  }, []);
  return pins;
}
