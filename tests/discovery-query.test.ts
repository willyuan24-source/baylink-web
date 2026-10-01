import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDiscoveryQuery } from '../src/lib/discovery-query';

const today = '2026-09-29';

test('whole Chinese, traditional and English requests produce the same factual filters', () => {
  for (const text of ['帮我找这个周末旧金山免费活动', '請推薦這個週末舊金山免費活動', 'Please show me free events in San Francisco this weekend']) {
    const query = parseDiscoveryQuery(text, today);
    assert.deepEqual(query.cities, ['San Francisco']);
    assert.deepEqual(query.dateRange, { start: '2026-10-03', end: '2026-10-04' });
    assert.equal(query.freeOnly, true);
    assert.equal(query.intent, 'events');
    assert.equal(query.eventKind, undefined, 'show me is an instruction, not a performance category');
    assert.deepEqual(query.tokens, []);
  }
});

test('exact city aliases cannot conflate South San Francisco with San Francisco or South Bay', () => {
  for (const text of ['South San Francisco free events', '南旧金山免费活动', 'SSF free events']) {
    assert.deepEqual(parseDiscoveryQuery(text, today).cities, ['South San Francisco']);
  }
  const region = parseDiscoveryQuery('Show me offers in the South Bay', today);
  assert.deepEqual(region.regions, ['south-bay']);
  assert.deepEqual(region.cities, []);
  assert.deepEqual(region.tokens, []);
  assert.deepEqual(parseDiscoveryQuery('Mill Valley movies', today, ['Mill Valley / San Rafael / Larkspur']).cities, ['Mill Valley']);
});

test('relative dates and weekends use Bay Area calendar days across DST, month and year boundaries', () => {
  const cases = [
    ['今天', today, today, today], ['tomorrow', today, '2026-09-30', '2026-09-30'],
    ['后天', today, '2026-10-01', '2026-10-01'], ['day after tomorrow', '2026-12-31', '2027-01-02', '2027-01-02'],
    ['this weekend', '2026-10-04', '2026-10-03', '2026-10-04'],
    ['next weekend', '2026-10-04', '2026-10-10', '2026-10-11'],
    ['明天', '2026-11-01', '2026-11-02', '2026-11-02'],
    ['本周六', today, '2026-10-03', '2026-10-03'], ['next Monday', today, '2026-10-05', '2026-10-05'],
    ['tonight', today, today, today],
  ];
  for (const [query, now, start, end] of cases) assert.deepEqual(parseDiscoveryQuery(query, now).dateRange, { start, end }, query);
});

test('explicit date ranges preserve both endpoints and reject impossible dates rather than broadening search', () => {
  for (const text of ['10月3日到5日活动', '10/3-10/5 events', 'October 3–5 events', '2026-10-03 to 2026-10-05 events', '2026-10-03-2026-10-05']) {
    assert.deepEqual(parseDiscoveryQuery(text, today).dateRange, { start: '2026-10-03', end: '2026-10-05' });
    assert.deepEqual(parseDiscoveryQuery(text, today).tokens, []);
  }
  assert.deepEqual(parseDiscoveryQuery('9/30–10/2', today).dateRange, { start: '2026-09-30', end: '2026-10-02' });
  assert.equal(parseDiscoveryQuery('2026-02-30 events', today).invalidDate, true);
  assert.equal(parseDiscoveryQuery('10月5日至3日活动', today).invalidDate, true);
});

test('budget, family ages, setting and uncertainty remain explicit instead of becoming fuzzy text', () => {
  const query = parseDiscoveryQuery('雨天室内带6岁孩子活动，门票20美元以内', today);
  assert.equal(query.setting, 'indoor');
  assert.equal(query.maxAdmissionUsd, 20);
  assert.equal(query.admissionBudget, true);
  assert.deepEqual(query.childAges, [6]);
  assert.equal(query.family, true);
  assert.equal(parseDiscoveryQuery('室内乐', today).setting, undefined);
  assert.equal(parseDiscoveryQuery('预算80', today).maxAdmissionUsd, 80);
  assert.equal(parseDiscoveryQuery('family-friendly events under $20', today).maxAdmissionUsd, 20);
  assert.deepEqual(parseDiscoveryQuery('Please find family activities with tickets under $20', today).tokens, []);
  for (const text of ['新开的咖啡店', 'new coffee shops', 'new cafes']) {
    const parsed = parseDiscoveryQuery(text, today);
    assert.equal(parsed.intent, 'openings');
    assert.deepEqual(parsed.tokens, ['咖啡']);
  }
  assert.equal(parseDiscoveryQuery('咖啡店步行15分钟内', today).distanceRequested, true);
  assert.equal(parseDiscoveryQuery('南湾试营业新店', today).openingStatus, 'soft_open');
});

test('negated preferences, free extras and total budgets are never converted into positive admission filters', () => {
  for (const text of ['不要室内活动', '不要户外活动', '不要免费活动', '不要亲子活动', 'events but not indoor', 'events without kids', 'avoid free events']) {
    const query = parseDiscoveryQuery(text, today);
    assert.ok(query.unsupported.includes('negative-preference'), text);
    assert.equal(query.setting, undefined, text);
    assert.equal(query.freeOnly, false, text);
    assert.equal(query.family, false, text);
  }
  for (const text of ['免费停车活动', 'events with free parking']) {
    const query = parseDiscoveryQuery(text, today);
    assert.equal(query.freeOnly, false);
    assert.ok(query.unsupported.includes('free-extras'));
  }
  for (const text of ['两人总共80美元活动', 'events with a total budget of $80']) {
    const query = parseDiscoveryQuery(text, today);
    assert.equal(query.maxAdmissionUsd, undefined);
    assert.equal(query.totalBudgetUsd, 80);
    assert.ok(query.unsupported.includes('total-budget'));
    assert.deepEqual(query.tokens, []);
  }
  const admission = parseDiscoveryQuery('门票每人不超过30美元', today);
  assert.equal(admission.maxAdmissionUsd, 30);
  assert.equal(admission.admissionBudget, true);
  assert.deepEqual(admission.tokens, []);
});

test('alternative and conflicting dates do not silently keep the final date', () => {
  for (const text of ['10/3或10/4活动', 'events October 3 or October 4', '明天 2026-10-05 活动']) {
    const query = parseDiscoveryQuery(text, today);
    assert.ok(query.unsupported.includes('multiple-dates'), text);
    assert.equal(query.dateRange, undefined, text);
  }
  assert.deepEqual(parseDiscoveryQuery('10/3–10/4活动', today).dateRange, { start: '2026-10-03', end: '2026-10-04' });
  assert.deepEqual(parseDiscoveryQuery('10月3日周六活动', today).dateRange, { start: '2026-10-03', end: '2026-10-03' });
});

test('an exact date with its weekday is one day even when it is not the next Saturday', () => {
  for (const text of ['10月17日周六，半岛两个人，不开车，想找免费活动', '10月17日（星期六）免費活動', '2026-10-17 Saturday free events', 'October 17, 2026 (Saturday) free events', '10/17, Saturday events']) {
    const query = parseDiscoveryQuery(text, '2026-09-30');
    assert.deepEqual(query.dateRange, { start: '2026-10-17', end: '2026-10-17' }, text);
    assert.equal(query.invalidDate, false, text); assert.equal(query.unsupported.includes('multiple-dates'), false, text);
  }
  for (const text of ['10月17日周日活动', 'October 17 (Sunday) events']) assert.equal(parseDiscoveryQuery(text, '2026-09-30').invalidDate, true, text);
  for (const text of ['10月17日周六或10月18日周日', '10月17日或周六', '10/17 Saturday or 10/18 Sunday', '10月17日下周六']) {
    assert.equal(parseDiscoveryQuery(text, '2026-09-30').unsupported.includes('multiple-dates'), true, text);
  }
});
