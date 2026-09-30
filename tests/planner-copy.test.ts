import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLocale } from '../src/i18n/locale';
import { VERIFIED_EVENT_SCHEDULES, VERIFIED_PLACE_SCHEDULES } from '../src/data/planner-verified-hours';
import { plannerNoticeText } from '../src/lib/planner-copy';
import { buildOutingOptions } from '../src/lib/planner-outings';

const chinese = /[\u3400-\u9fff]/;
test('all recorded official time notes translate without losing dates, times, amounts or restrictions', async () => {
  await loadLocale('en');
  const notes = new Set([...Object.values(VERIFIED_EVENT_SCHEDULES), ...Object.values(VERIFIED_PLACE_SCHEDULES)].map(schedule => schedule.note).filter((note): note is string => !!note));
  assert.ok(notes.size >= 18);
  for (const note of notes) {
    const english = plannerNoticeText(note, true);
    assert.doesNotMatch(english, chinese, note);
    for (const number of note.match(/\d+(?:[:/.]\d+)*/g) || []) assert.ok(english.includes(number), `Missing ${number} in: ${english}`);
    assert.equal(plannerNoticeText(note, false), note);
  }
  const ballet = plannerNoticeText(VERIFIED_EVENT_SCHEDULES['san-jose-first-friday-ballet-2026'].note!, true);
  assert.match(ballet, /classroom.*19:25/);
  assert.match(ballet, /start and end times have not been separately published/);
  const brunch = plannerNoticeText(VERIFIED_PLACE_SCHEDULES['restaurant-town-fare-omca'].note!, true);
  assert.match(brunch, /Last dine-in orders.*15:15/);
  assert.match(brunch, /does not take reservations/);
});

test('dynamic notices retain admission-only scope, draft group size and source-language fallback', async () => {
  await loadLocale('en');
  assert.match(plannerNoticeText('每人 $32.50 仅作为入场金额上限；未据此设置整趟总预算，餐饮与交通需要另填。', true), /\$32.50 per person is only an admission cap.*not been set as the total outing budget/);
  assert.match(plannerNoticeText('未提供同行总人数，草稿暂按 3 人显示，请选择方案后确认人数与儿童票规则。', true), /3 people.*child ticket rules/);
  assert.match(plannerNoticeText('Exploratorium · 日间科学探索馆：入场金额待确认。', true), /Daytime science museum — Admission cost is unconfirmed/);
  const english = 'Only 10/2 is confirmed; doors at 18:30. End time unknown.';
  assert.equal(plannerNoticeText(english, true), english);
  const unfamiliar = '某活动尚未公布儿童入场条款，不能保证适合 4 岁。';
  assert.equal(plannerNoticeText(unfamiliar, true), `Original note (Chinese; translation unavailable): ${unfamiliar}`);
  assert.equal(plannerNoticeText(unfamiliar, false), unfamiliar);
});

test('real half-day and full-day drafts have English notices including secondary-place caveats', async () => {
  await loadLocale('en');
  const options = buildOutingOptions({
    suggestion: { id: 'ferry', eventId: 'ferry-plaza-farmers-market-2026-autumn', date: '2026-10-03', placeIds: [], reason: '', reasons: [], unknowns: ['Tickets are not reserved.'] },
    filters: { date: '2026-10-03', city: 'San Francisco', childAges: [8] }, asOf: '2026-09-29',
  });
  assert.deepEqual(new Set(options.map(option => option.style)), new Set(['half-day', 'full-day']));
  for (const option of options) for (const note of option.notices) assert.doesNotMatch(plannerNoticeText(note, true), chinese, note);
  const notes = options.flatMap(option => option.notices).map(note => plannerNoticeText(note, true)).join('\n');
  assert.match(notes, /straight-line distance/);
  assert.match(notes, /0.*placeholder/);
  assert.match(notes, /Table|table|meal or rest break/);
});
