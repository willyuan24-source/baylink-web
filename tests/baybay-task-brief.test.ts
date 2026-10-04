import assert from 'node:assert/strict';
import test from 'node:test';
import { bayBayTaskBrief, type BayBayTurn } from '../src/lib/baybay-conversation';

const turns = (...questions: string[]): BayBayTurn[] => questions.map((question, id) => ({ id, question, state: 'complete', response: { ok: true, answer: 'Assistant invention: tickets paid, private home booked, 2027-01-01.' } }));

test('a new Chinese date replaces earlier date and weekday while keeping the departure city and companions', () => {
  const brief = bayBayTaskBrief(turns('10月3日周六从 Fremont 出发，带5岁孩子看博物馆', '改成10月4日周日，想轻松一点'));
  assert.doesNotMatch(brief, /10月3日|周六/);
  assert.match(brief, /10月4日周日/); assert.match(brief, /Fremont/); assert.match(brief, /5岁孩子看博物馆/);
  assert.doesNotMatch(brief, /Assistant|paid|2027/);
});

test('English and traditional Chinese date corrections replace ISO, named and relative previous dates', () => {
  for (const [oldDate, nextDate] of [['October 3, 2026', 'next Sunday'], ['next Saturday', '2026-10-04'], ['2026-10-03', 'tomorrow'], ['下週六', '10月4日'], ['明天', '後天'], ['10/3', 'October 4th']]) {
    const brief = bayBayTaskBrief(turns(`${oldDate} Oakland museums, with friends`, `改成 ${nextDate}`));
    assert.ok(!brief.includes(oldDate), brief); assert.ok(brief.includes(nextDate), brief); assert.match(brief, /Oakland museums/);
  }
});

test('replacing an American slash date removes its complete old year from the planner handoff', () => {
  const brief = bayBayTaskBrief(turns('10/5/2027 Oakland museums', 'Change to 2028/10/06'));
  assert.doesNotMatch(brief, /2027/);
  assert.match(brief, /2028\/10\/06/);
  assert.match(brief, /Oakland museums/);
});

test('budget and transportation corrections remove old conflicting constraints across multiple turns', () => {
  const brief = bayBayTaskBrief(turns('Fremont，周六开车，每人门票预算 $80，带孩子', '改成公共交通，预算40', '时间改成周日，还是亲子活动'));
  assert.doesNotMatch(brief, /周六|开车|\$80/); assert.match(brief, /公共交通/); assert.match(brief, /预算40/); assert.match(brief, /周日/); assert.match(brief, /带孩子/);
  const english = bayBayTaskBrief(turns('Saturday, Oakland museums, driving, under $80 per person', 'Only free admission, public transit'));
  assert.doesNotMatch(english, /driving|\$80|per person/); assert.match(english, /Saturday/); assert.match(english, /Only free admission, public transit/);
});

test('a destination change preserves the explicitly different departure city', () => {
  const brief = bayBayTaskBrief(turns('10/3 从 Fremont 出发，去 Oakland 看博物馆，预算30', '目的地改去 Berkeley'));
  assert.match(brief, /Fremont/); assert.match(brief, /10\/3/); assert.match(brief, /预算30/);
  assert.doesNotMatch(brief, /Oakland/); assert.match(brief, /Berkeley/);
  const origin = bayBayTaskBrief(turns('From Fremont to Oakland museums on Saturday', 'Leaving Palo Alto instead'));
  assert.doesNotMatch(origin, /Fremont/); assert.match(origin, /Oakland museums on Saturday/); assert.match(origin, /Palo Alto/);
});

test('changing the setting removes earlier indoor/outdoor conditions without deleting unrelated interests', () => {
  const brief = bayBayTaskBrief(turns('Oakland on Saturday，室外活动，喜欢摄影', '只想室内，公共交通'));
  assert.doesNotMatch(brief, /室外/); assert.match(brief, /只想室内/); assert.match(brief, /喜欢摄影/); assert.match(brief, /Saturday/);
});

test('cancelled and failed turns never replace confirmed requirements and assistant statements never enter the brief', () => {
  const input = turns('October 3 Oakland museum, budget $40');
  input.push({ id: 1, question: 'October 4 San Jose $1000', state: 'error' }, { id: 2, question: 'October 5', state: 'cancelled' });
  const brief = bayBayTaskBrief(input);
  assert.equal(brief, 'October 3 Oakland museum, budget $40');
});

test('explicit fresh-start requests discard the earlier topic and the latest user text is preserved at the size limit', () => {
  assert.equal(bayBayTaskBrief(turns('October 3 Oakland museums', 'New plan: October 4 Napa restaurants')), 'New plan: October 4 Napa restaurants');
  const latest = '想找轻松的活动'.repeat(75).slice(0, 500);
  const brief = bayBayTaskBrief(turns('A'.repeat(500), 'B'.repeat(500), 'C'.repeat(500), latest));
  assert.ok(brief.length <= 800); assert.ok(brief.endsWith(latest));
});
