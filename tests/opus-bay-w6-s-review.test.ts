import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 6 · the adversarial review of lane S (W6-S-review). Three defects found by playing and by reading the autumn labels:
 *   1. realsf/events.ts labelHoursOn read Hardly Strictly Bluegrass's label ("周五11:00开门；周六、日09:00开门；每日演出至19:00")
 *      as 19:00–21:00 on every day: a part with only a doors time gave no hours, and "至19:00" (until 19:00) was taken
 *      for a start. The festival is safe today only because its venue row has verified hours; any label event written that
 *      way would stand in the world after it ended.
 *   2. An evening show whose label gives only a start ("10/15 · 20:00", "10/15–10/30 · … 其余所列日期 19:30") closes in the
 *      world by the world's rule (4 h, ≤ 21:00), and the 今天 tab, 这周, BAYBAY's line and the daily task said that close
 *      as the event's end: "Young Miko 20:00–21:00", "今天歌剧院有歌剧《曼侬》，19:30–21:00". Now "20:00 起" / "from 20:00".
 *   3. The 新店 card's two touch targets were 32 px (×) and 36 px (BAYLINK 新店页) on a phone; the game's rule is ≥ 44 px
 *      on a coarse pointer (opus-bay.css).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { labelHoursOn, eventWindow, windowEndKnown } = await import('../src/opus-bay/realsf/events');
const { sanitizeCatalog, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { EVENT_VENUES } = await import('../src/opus-bay/realsf/eventVenues');
const { eventLine } = await import('../src/opus-bay/realsf/presence');
const { dailyThree } = await import('../src/opus-bay/realsf/daily');
const CATALOG = sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const win = (id: string, venue: string, day: string) => {
  const e = CATALOG.events.find(x => x.id === id), v = EVENT_VENUES.find(x => x.id === venue);
  assert.ok(e && v, id);
  const w = eventWindow(e!, v!, day);
  assert.ok(w, `${id} on ${day}`);
  return w!;
};
const H = (h: number, m = 0) => h * 60 + m;

test('W6-S-review labels: doors-only parts open at the doors, "至 HH:mm" / "HH:mm 结束" end the day, 每日 parts join the day’s own part', () => {
  const hsb = '10/2–10/4 · 周五11:00开门；周六、日09:00开门；每日演出至19:00';
  assert.deepEqual(labelHoursOn(hsb, '2026-10-02'), [H(11), H(19)], 'Friday: doors 11:00, music until 19:00');
  assert.deepEqual(labelHoursOn(hsb, '2026-10-03'), [H(9), H(19)], 'Saturday');
  assert.deepEqual(labelHoursOn(hsb, '2026-10-04'), [H(9), H(19)], 'Sunday');
  assert.deepEqual(labelHoursOn('10/19 · 议程 17:30 签到、18:00 开始、20:30 结束', '2026-10-19'), [H(18), H(20, 30)], 'an end time closes it');
  assert.deepEqual(labelHoursOn('10/9 · 18:30 开门', '2026-10-09'), [H(18, 30), H(21)], 'doors only: from the doors, 4 h, ≤ 21:00');
  // nothing the lane pinned moves
  assert.deepEqual(labelHoursOn('10/22–10/24 · 每日 19:30', '2026-10-23'), [H(19, 30), H(21)]);
  assert.deepEqual(labelHoursOn('10/25 · 10:00 开始；结束时间未核实', '2026-10-25'), [H(10), H(14)]);
  assert.deepEqual(labelHoursOn('10/23 · 19:00；17:30 开门', '2026-10-23'), [H(17, 30), H(21)]);
  assert.deepEqual(labelHoursOn('10/15–10/30 · 10/18 14:00；其余所列日期 19:30；约 3 小时 25 分钟', '2026-10-21'), [H(19, 30), H(21)]);
});

test('W6-S-review an evening show with only a start is said "20:00 起", never with the world’s 21:00 close as its end', () => {
  const miko = win('sf-young-miko-2026', 'chase-center', '2026-10-15');
  const manon = win('sf-opera-manon-2026', 'war-memorial-opera-house', '2026-10-21');
  const grizz = win('sf-warriors-grizzlies-2026', 'chase-center', '2026-10-23');
  for (const w of [miko, manon, grizz]) assert.equal(windowEndKnown(w), false, w.event.id);
  // the organiser's end: a label range, the venue table (HSB), the market's weekday range
  assert.equal(windowEndKnown(win('sf-halloween-hoopla-2026', 'yerba-buena-gardens', '2026-10-31')), true);
  assert.equal(windowEndKnown(win('hardly-strictly-bluegrass-2026', 'hellman-hollow', '2026-10-02')), true);
  assert.equal(windowEndKnown(win('ferry-plaza-farmers-market-2026-autumn', 'ferry-building', '2026-10-03')), true);
  // BAYBAY's line
  const line = eventLine(manon);
  assert.match(line.zh, /19:30起/);
  assert.doesNotMatch(line.zh, /21:00/);
  assert.match(line.en, /from 19:30/);
  assert.match(eventLine(win('sf-halloween-hoopla-2026', 'yerba-buena-gardens', '2026-10-31')).zh, /12:00–15:00/);
  assert.match(eventLine(grizz).zh, /17:30起/, 'doors 17:30');
  // the daily three: Oct 6 has only the Lakers game (19:00, no end given) as an event
  setCatalogForTests(CATALOG);
  try {
    const task = dailyThree('2026-10-06').find(t => t.kind === 'event');
    assert.ok(task, 'an event task on Oct 6');
    assert.equal(task!.eventId, 'sf-warriors-lakers-preseason-2026');
    assert.match(task!.hint.zh, /今天 19:00 起/);
    assert.match(task!.hint.en, /today from 19:00/);
    const hoopla = dailyThree('2026-10-31').find(t => t.kind === 'event');
    assert.match(hoopla!.hint.zh, /今天 12:00–15:00/, 'a range stays a range');
  } finally { setCatalogForTests(null); }
  // the 今天 tab and 这周 say the window through the same rule
  const tab = fs.readFileSync(path.resolve('src/opus-bay/realsf/TodayTab.tsx'), 'utf8');
  assert.match(tab, /if \(!windowEndKnown\(w\)\) return \{ zh: `\$\{hmOf\(w\.open\)\} 起`, en: `from \$\{hmOf\(w\.open\)\}` \}/);
  assert.equal((tab.match(/t\(span\(/g) ?? []).length, 2, 'both places');
});

test('W6-S-review the 新店 card: × and the BAYLINK link are ≥ 44 px on a coarse pointer (the game’s touch rule)', () => {
  const css = fs.readFileSync(path.resolve('src/opus-bay/realsf/openings.css'), 'utf8');
  const coarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(coarse, 'a coarse-pointer block');
  const rule = (sel: string) => new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(coarse![1])?.[1] ?? '';
  assert.match(rule('.ob-opening-close'), /width:\s*44px/);
  assert.match(rule('.ob-opening-close'), /height:\s*44px/);
  assert.match(rule('.ob-opening-go'), /min-height:\s*44px/);
});
