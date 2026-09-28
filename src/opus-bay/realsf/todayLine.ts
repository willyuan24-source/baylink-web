import type { Bilingual, Catalog } from '../core/types';
import { getCatalog } from '../data/catalog';
import { bayNow, bayParts } from '../game/bayNow';
import { EVENT_SAY, VENUE_SAY } from './eventVenues';
import { weekEvents } from './events';
import { sunHm, sunTimes } from './sun';

/**
 * Wave 5 · lane R (W5-R4) · one short line about San Francisco today (zh ≤ 45 characters): BAYBAY's addition to lane C's
 * welcome back (game/welcome.ts onWelcome 'returning') and the header of lane E's notebook (plan §3.5: "today's real SF
 * line"). Today's event in the world first, else the sunset, else the daily three.
 *
 *   todayLine(now?, catalog?)   今天金门公园有蓝草音乐节，旅行本「今天」里有～ · 今天旧金山日落 18:47，旅行本「今天」里有三件小事～
 */

const cut = (zh: string, alt: string) => ([...zh].length <= 45 ? zh : alt);

export function todayLine(now: Date = bayNow(), catalog: Catalog | null = getCatalog()): Bilingual {
  const day = bayParts(now).dateKey;
  const w = weekEvents(now, 1, catalog).find(x => x.dateKey === day);
  if (w) {
    const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
    const name = EVENT_SAY[w.event.id] ?? { zh: '活动', en: 'an event' };
    return {
      zh: cut(`今天${place.zh}有${name.zh}，旅行本「今天」里有～`, `今天${place.zh}有${name.zh}！`),
      en: `${place.en} has ${name.en} today — it is in the journal's Today page.`,
    };
  }
  const sun = sunTimes(now);
  if (now.getTime() < sun.sunset.getTime()) {
    const t = sunHm(sun.sunset);
    return { zh: `今天旧金山日落 ${t}，旅行本「今天」里有三件小事～`, en: `Sunset in San Francisco today is at ${t}; three small things wait in the journal's Today page.` };
  }
  return { zh: '旅行本「今天」里有今日三件小事，慢慢逛～', en: 'Three small things for today wait in the journal’s Today page — no rush.' };
}
