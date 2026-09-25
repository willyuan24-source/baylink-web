import { ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES } from '../../data/attractions';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../../data/guide-media';
import { guides } from '../../data/guides';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../../data/planner-catalog';
import { addCalendarDays, eventOccursOn, validCalendarDay } from '../../lib/event-calendar';
import { cleanStops, distanceKm, stopPath, todayInBay, validStop, type GeoPoint, type PlannerEvent, type PlannerPlace, type Stop } from '../../lib/planner';

export type LittleBayStop = {
  key: string;
  stop: Stop;
  title: string;
  subtitle: string;
  city: string;
  region: string;
  kind: 'event' | 'place';
  price: string;
  free: boolean;
  href: string;
  sourceUrl?: string;
  image?: string;
  /** Keep the existing attribution/caption when a card displays this image. */
  imageMeta?: GuideImage;
  location?: GeoPoint;
  tags: string[];
};

const categoryLabels = { culture: '艺术文化', outdoors: '户外探索', food: '美食市集', family: '亲子活动' };
const attractionsById = new Map(ATTRACTIONS.map(place => [place.id, place]));
const guidesBySlug = new Map(guides.map(guide => [guide.slug, guide]));

function eventStop(event: PlannerEvent): LittleBayStop {
  const stop: Stop = { kind: 'event', id: event.id };
  const imageMeta = GUIDE_IMAGES[event.imageKey];
  return {
    key: `event:${event.id}`, stop, kind: 'event', title: event.title,
    subtitle: event.summary, city: event.city, region: event.region, price: event.costLabel,
    free: event.cost === 'free', href: stopPath(stop), sourceUrl: event.officialUrl,
    image: imageMeta?.src, imageMeta, location: event.location,
    tags: [categoryLabels[event.category]],
  };
}

function placeStop(place: PlannerPlace): LittleBayStop {
  const stop: Stop = { kind: 'place', id: place.id };
  const attraction = attractionsById.get(place.id);
  const guide = guidesBySlug.get(place.guideSlug);
  const imageMeta = guide ? getGuideMedia(guide).cover : undefined;
  return {
    key: `place:${place.id}`, stop, kind: 'place', title: place.title,
    subtitle: place.summary, city: place.city, region: place.region,
    price: ATTRACTION_COSTS.find(cost => cost.id === place.cost)?.label || '请查看官方票价',
    free: place.cost === 'free', href: stopPath(stop), sourceUrl: place.officialUrl || undefined,
    image: imageMeta?.src, imageMeta, location: place.location,
    tags: (attraction?.themes || []).map(theme => ATTRACTION_THEMES.find(item => item.id === theme)!.label),
  };
}

/** Resolve saved public references independently of the current discovery filters. */
export function resolveLittleBayStop(stop: Stop): LittleBayStop | undefined {
  if (!validStop(stop)) return undefined;
  if (stop.kind === 'event') {
    const event = PLANNER_EVENTS.find(item => item.id === stop.id);
    return event ? eventStop(event) : undefined;
  }
  const place = PLANNER_PLACES.find(item => item.id === stop.id);
  return place ? placeStop(place) : undefined;
}

/** Prefer a different theme/city before repeating the first catalog category. */
function varied(stops: LittleBayStop[]): LittleBayStop[] {
  const remaining = [...stops];
  const result: LittleBayStop[] = [];
  const themes = new Set<string>();
  const cities = new Set<string>();
  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = -1;
    remaining.forEach((stop, index) => {
      const score = (stop.tags.some(tag => !themes.has(tag)) ? 2 : 0) + (cities.has(stop.city) ? 0 : 1);
      if (score > bestScore) { bestIndex = index; bestScore = score; }
    });
    const [next] = remaining.splice(bestIndex, 1);
    result.push(next);
    next.tags.forEach(tag => themes.add(tag));
    cities.add(next.city);
  }
  return result;
}

/**
 * Real catalog suggestions for a Pacific calendar day; the 3D positions are decorative.
 * Places are outing ideas, not an assertion of opening hours or ticket availability.
 */
export function getLittleBayStops({ date, region, freeOnly = false }: {
  date: string; region: string; freeOnly?: boolean;
}): LittleBayStop[] {
  if (!validCalendarDay(date) || !ATTRACTION_REGIONS.some(item => item.id === region)) return [];
  const matches = (item: { region: string; cost: string }) => (region === 'all' || item.region === region) && (!freeOnly || item.cost === 'free');
  const events = varied(PLANNER_EVENTS.filter(event => matches(event) && eventOccursOn(event, date)).map(eventStop));
  const places = varied(PLANNER_PLACES.filter(matches).map(placeStop));
  const result: LittleBayStop[] = [];
  while (result.length < 6 && (events.length || places.length)) {
    if (events.length) result.push(events.shift()!);
    if (result.length < 6 && places.length) result.push(places.shift()!);
  }
  return result;
}

/** Add flexible same-city places to one anchor, never stack unrelated timed events. */
export function pickLittleBayOuting(anchor: LittleBayStop, date: string, freeOnly = false): Stop[] {
  const selected = resolveLittleBayStop(anchor.stop);
  if (!selected || !cleanLittleBayPlanStops([selected.stop], date).length || (freeOnly && !selected.free)) return [];
  const places = PLANNER_PLACES.filter(place => place.city === selected.city
    && !(selected.kind === 'place' && place.id === selected.stop.id));
  const freePlaces = places.filter(place => place.cost === 'free');
  const candidates = freeOnly || freePlaces.length ? freePlaces : places;
  // Straight-line geography only orders ideas; it does not claim journey times or access.
  const distance = (place: PlannerPlace) => selected.location && place.location ? distanceKm(selected.location, place.location) : Infinity;
  candidates.sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  return [selected.stop, ...candidates.slice(0, 2).map(place => ({ kind: 'place' as const, id: place.id }))];
}

/** The next Saturday includes today when the selected Pacific day is Saturday. */
export function getNextSaturday(today = todayInBay()): string {
  if (!validCalendarDay(today)) throw new RangeError('Expected a valid calendar date');
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addCalendarDays(today, (6 - weekday + 7) % 7);
}

/** Recheck a selection after changing dates, before saving or sharing a plan. */
export function cleanLittleBayPlanStops(input: unknown, date: string): Stop[] {
  if (!validCalendarDay(date) || !Array.isArray(input)) return [];
  return cleanStops(input.filter((stop): stop is Stop => {
    if (!validStop(stop)) return false;
    if (stop.kind === 'place') return true;
    const event = PLANNER_EVENTS.find(item => item.id === stop.id);
    return !!event && eventOccursOn(event, date);
  }));
}
