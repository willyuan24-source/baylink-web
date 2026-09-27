/** Bay Area wall clock helpers (America/Los_Angeles), pure and testable. */

export function bayClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { hour: Number(get('hour')) || 0, minute: Number(get('minute')) || 0, weekday: get('weekday') };
}

/** Ferry Plaza Farmers Market days (Tuesday, Thursday, Saturday) by the Bay Area clock. */
export function isMarketDay(now = new Date()) {
  const d = bayClock(now).weekday;
  return d === 'Tue' || d === 'Thu' || d === 'Sat';
}

/** Clock-hand angles (radians, clockwise from 12) for the Ferry Building clock faces. */
export function handAngles(hour: number, minute: number) {
  return { hour: (((hour % 12) + minute / 60) / 12) * Math.PI * 2, minute: (minute / 60) * Math.PI * 2 };
}

/** Market stalls are staffed Tue & Thu 10:00–14:00 and Sat 8:00–14:00 Bay Area time (Foodwise hours, same as
 *  game/flow `marketOpenNow`, so the stalls and BAYBAY's taste lines always agree); otherwise tarped over. */
export function isMarketOpen(now = new Date()) {
  const c = bayClock(now);
  const opens = c.weekday === 'Sat' ? 8 : c.weekday === 'Tue' || c.weekday === 'Thu' ? 10 : 99;
  return c.hour >= opens && c.hour < 14;
}
