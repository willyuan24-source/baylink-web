/**
 * Bay Area wall clock helpers (America/Los_Angeles), pure and testable. The default `now` is game/bayNow's bayNow()
 * (wave 5, lane R's request to lane V): the real time, and in DEV / QA builds the `?date=` time, so the Ferry clock hands
 * and the market stalls follow a dated check like every wave-5 feature. Production: the real time, as before.
 */
import { bayNow } from '../game/bayNow';

export function bayClock(now = bayNow()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { hour: Number(get('hour')) || 0, minute: Number(get('minute')) || 0, weekday: get('weekday') };
}

/** Ferry Plaza Farmers Market days (Tuesday, Thursday, Saturday) by the Bay Area clock. */
export function isMarketDay(now = bayNow()) {
  const d = bayClock(now).weekday;
  return d === 'Tue' || d === 'Thu' || d === 'Sat';
}

/** Clock-hand angles (radians, clockwise from 12) for the Ferry Building clock faces. */
export function handAngles(hour: number, minute: number) {
  return { hour: (((hour % 12) + minute / 60) / 12) * Math.PI * 2, minute: (minute / 60) * Math.PI * 2 };
}

/** Market stalls are staffed Tue & Thu 10:00–14:00 and Sat 8:00–14:00 Bay Area time (Foodwise hours, same as
 *  game/flow `marketOpenNow`, so the stalls and BAYBAY's taste lines always agree); otherwise tarped over. */
export function isMarketOpen(now = bayNow()) {
  const c = bayClock(now);
  const opens = c.weekday === 'Sat' ? 8 : c.weekday === 'Tue' || c.weekday === 'Thu' ? 10 : 99;
  return c.hour >= opens && c.hour < 14;
}
