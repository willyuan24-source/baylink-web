import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

/**
 * Wave 9 · lane R (W9-R7, review R§6 现实出行价值 "交通班次不分工作日和周末", planner/shots/013): an event card's 现实中怎么去
 * shows the headways of the EVENT's day and start (sfmta.com's weekday / weekend columns), not today's; a line that is not
 * running at the event's start says 那时停运. Now's rows (a place card) are unchanged.
 */

const { REAL_LINES, serviceLabel } = await import('../src/opus-bay/realsf/transitReal');

test('W9-R7 serviceLabel on an event’s day: weekend / weekday named, 那时停运 at a start outside service', () => {
  const n = REAL_LINES['n-judah'], m = REAL_LINES['m-ocean-view'];
  assert.match(serviceLabel(n, '2026-10-03', 11 * 60, true).zh, /全天 24 小时 · 周末白天约 12 分钟一班/, 'Saturday 3 Oct');
  assert.match(serviceLabel(n, '2026-10-03', 11 * 60, true).en, /about every 12 min by day on weekends/);
  assert.match(serviceLabel(n, '2026-10-05', 11 * 60, true).zh, /工作日白天约 10 分钟一班/, 'Monday 5 Oct');
  assert.match(serviceLabel(m, '2026-10-04', 11 * 60, true).zh, /周末白天约 10–15 分钟一班/, 'Sunday: M’s weekend column');
  assert.equal(serviceLabel(m, '2026-10-03', 3 * 60, true).zh, '那时停运 · 运营 6:00–24:00');
  assert.equal(serviceLabel(m, '2026-10-03', 3 * 60, true).en, 'Not running then · runs 6:00–24:00');
  // now's rows as before (tests/opus-bay-w5-calendar.test.ts)
  assert.equal(serviceLabel(n, '2026-10-05', 10 * 60).zh, '全天 24 小时 · 白天约 10 分钟一班');
  assert.match(serviceLabel(m, '2026-10-05', 3 * 60).zh, /^现在停运/);
});

test('W9-R7 the event card passes its next day and the event to 现实中怎么去', () => {
  const src = fs.readFileSync('src/opus-bay/ui/EventCardBody.tsx', 'utf8');
  assert.match(src, /<HowToGo point=\{\{ x: spot\.x, z: spot\.z \}\} day=\{next \?\? undefined\} event=\{event\} \/>/);
  const how = fs.readFileSync('src/opus-bay/realsf/HowToGo.tsx', 'utf8');
  assert.match(how, /serviceLabel\(n\.line, dateKey, at, onDay\)/);
  assert.match(how, /eventDayHours\(event, day\)/);
});
