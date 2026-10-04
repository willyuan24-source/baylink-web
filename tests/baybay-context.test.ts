import assert from 'node:assert/strict';
import test from 'node:test';
import { BAYBAY_CITIES, bayBayLocationMentions, bayBayPageSearchContext, isBayBayResetRequest, resolveBayBaySearchContext } from '../src/lib/baybay-context';
import { bayBayTaskBrief, type BayBayTurn } from '../src/lib/baybay-conversation';
import eastCities from '../src/data/city-exploration-east-sf.json';
import southCities from '../src/data/city-exploration-peninsula-south.json';
import northCities from '../src/data/city-exploration-north.json';

const today = '2026-10-04';
test('all 101 city names and existing traditional aliases resolve without confusing nested city names', () => {
  assert.equal(BAYBAY_CITIES.length, 101);
  assert.deepEqual([...BAYBAY_CITIES].sort(), [...new Set([...eastCities, ...southCities, ...northCities].map(city => city.city))].sort(), 'the lightweight registry must cover the full published city directory');
  for (const city of BAYBAY_CITIES) assert.deepEqual(bayBayLocationMentions(`Events in ${city}`).map(item => item.city), [city], city);
  for (const [alias, city] of [['聖馬刁', 'San Mateo'], ['聖荷西', 'San Jose'], ['南舊金山', 'South San Francisco'], ['San José', 'San Jose']]) {
    assert.deepEqual(bayBayLocationMentions(`今天去${alias}`).map(item => item.city), [city], alias);
  }
  assert.deepEqual(bayBayLocationMentions('San Francisco Bay Area').map(item => item.broad), [true]);
});

test('departure corrections preserve the destination and destination changes do not become departure changes', () => {
  const initial = '10月4日从 Belmont 出发去 Oakland';
  const ctx = resolveBayBaySearchContext(initial, {}, {}, today);
  assert.deepEqual(ctx, { city: 'Oakland', date: today });
  assert.deepEqual(resolveBayBaySearchContext('出发地改成 Fremont', ctx, {}, today), ctx);
  assert.deepEqual(resolveBayBaySearchContext('目的地改去 Berkeley，明天', ctx, {}, today), { city: 'Berkeley', date: '2026-10-05' });
  const turns = (...questions: string[]): BayBayTurn[] => questions.map((question, id) => ({ id, question, state: 'complete' }));
  const changedOrigin = bayBayTaskBrief(turns(initial, '出发地改成 Fremont'));
  assert.doesNotMatch(changedOrigin, /Belmont/); assert.match(changedOrigin, /Oakland/); assert.match(changedOrigin, /Fremont/);
  for (const old of ['San Carlos', '圣马特奥', '聖馬刁']) {
    const brief = bayBayTaskBrief(turns(`今天在 ${old} 看博物馆`, '目的地改去 Berkeley'));
    assert.ok(!brief.includes(old), brief); assert.match(brief, /Berkeley/);
  }
  const english = bayBayTaskBrief(turns('From Belmont to Oakland on October 4', 'Change departure city to Fremont'));
  assert.doesNotMatch(english, /Belmont/); assert.match(english, /Oakland/);
});

test('page context accepts only known route filters and never arbitrary query or tracking text', () => {
  assert.deepEqual(bayBayPageSearchContext('/guides/bay-area-101-city-exploration-living-guide?city=san-carlos&email=private@example.com'), { city: 'San Carlos' });
  assert.deepEqual(bayBayPageSearchContext('/calendar?date=2026-10-05&region=east-bay'), { date: '2026-10-05', region: 'east-bay' });
  assert.deepEqual(bayBayPageSearchContext('/this-month?when=today', today), { date: today });
  for (const path of ['/account?city=Oakland&date=2026-10-05', '//evil.example/calendar?city=Oakland', '/calendar?city=Shanghai&region=asia&date=2026-02-30', '/calendar?city=Oakland&city=Berkeley', '/calendar?q=Oakland%20private%20address']) {
    assert.deepEqual(bayBayPageSearchContext(path), {}, path);
  }
  assert.deepEqual(resolveBayBaySearchContext('明天改去 Berkeley', { city: 'Oakland' }, { city: 'San Francisco', date: today }, today), { city: 'Berkeley', date: '2026-10-05' });
  assert.deepEqual(resolveBayBaySearchContext('再推荐两个', { city: 'Oakland' }, { region: 'sf', date: today }, today), { city: 'Oakland', date: today });
  assert.deepEqual(resolveBayBaySearchContext('不要去 Berkeley', { city: 'Oakland' }, {}, today), { city: 'Oakland' }, 'excluding another city must not clear the destination');
  assert.deepEqual(resolveBayBaySearchContext('今天有哪些活动', { city: 'Oakland', date: today }, {}, '2026-10-05'), { city: 'Oakland', date: '2026-10-05' }, 'today after midnight supersedes the previous day');
});

test('ambiguous or invalid date changes clear stale dates instead of selecting a convenient day', () => {
  for (const message of ['改成2026-02-30', '10月5日或者10月6日', '10/5–10/7']) {
    assert.deepEqual(resolveBayBaySearchContext(message, { city: 'Oakland', date: today }, {}, today), { city: 'Oakland' }, message);
  }
  assert.deepEqual(resolveBayBaySearchContext('孩子生日是2020-01-02', {}, {}, today), {}, 'personal birth dates do not become retained outing dates');
  assert.deepEqual(resolveBayBaySearchContext('整个湾区都可以', { city: 'Oakland', date: today }, {}, today), { date: today });
  assert.deepEqual(resolveBayBaySearchContext('Oakland 或者 Berkeley', { city: 'San Francisco' }, {}, today), {}, 'do not silently choose one city');
});

test('only explicit reset commands discard remembered public conditions', () => {
  for (const message of ['重新開始，今天有哪些活動？', '请重新开始', '重新开始吧', '讓我們重新開始', 'New plan: tomorrow in Oakland', 'Please start over.', "Let's start over"]) assert.equal(isBayBayResetRequest(message), true, message);
  for (const message of ['不要重新开始', '什么是“重新开始”？', 'Do not start over', 'Tell me about a new plan']) assert.equal(isBayBayResetRequest(message), false, message);
  assert.deepEqual(resolveBayBaySearchContext('重新开始，明天在 Berkeley', { city: 'Oakland', date: today }, {}, today), { city: 'Berkeley', date: '2026-10-05' });
});

test('handoff retains public city and date beyond four raw turns without carrying older private prose', () => {
  let context = {};
  const turns: BayBayTurn[] = ['今天在 San Mateo，private@example.com', '想轻松一点', '最好室內', '坐公共交通', '再推薦兩個'].map((question, id) => {
    context = resolveBayBaySearchContext(question, context, {}, today);
    return { id, question, state: 'complete', searchContext: context };
  });
  const brief = bayBayTaskBrief(turns);
  assert.match(brief, /San Mateo/); assert.match(brief, /2026-10-04/); assert.doesNotMatch(brief, /private@example/);
  assert.equal(bayBayTaskBrief([...turns, { id: 6, question: '重新开始，去 Berkeley', state: 'complete' }]), '重新开始，去 Berkeley');
});

test('explicit unrestricted dates and locations clear prior requirements in both memory and planner handoff', () => {
  for (const message of ['日期不限', '哪天都行', 'Any day is fine', 'No date restriction']) {
    assert.deepEqual(resolveBayBaySearchContext(message, { city: 'Oakland', date: today }, {}, today), { city: 'Oakland' }, message);
  }
  for (const message of ['不限定城市都可以', '城市不限', 'Any city is fine']) {
    assert.deepEqual(resolveBayBaySearchContext(message, { city: 'Oakland', date: today }, {}, today), { date: today }, message);
  }
  const brief = bayBayTaskBrief([{ id: 1, question: '今天在 San Francisco 看活动', state: 'complete' }, { id: 2, question: '城市不限，日期不限', state: 'complete' }]);
  assert.doesNotMatch(brief, /San Francisco|今天/);
  assert.match(brief, /城市不限，日期不限/);
});

test('negated destinations cannot become positive memory or remain positive handoff constraints', () => {
  for (const message of ['不想去旧金山', '别在 San Francisco', "I don't want to go to San Francisco"]) {
    assert.deepEqual(resolveBayBaySearchContext(message, { city: 'San Francisco', date: today }, {}, today), { date: today }, message);
  }
  assert.deepEqual(resolveBayBaySearchContext('不想去 Oakland，只去 San Jose', { city: 'Berkeley' }, {}, today), { city: 'San Jose' });
  const brief = bayBayTaskBrief([{ id: 1, question: '从 Oakland 去 San Francisco', state: 'complete' }, { id: 2, question: '不想去 San Francisco', state: 'complete' }]);
  assert.equal((brief.match(/San Francisco/g) || []).length, 1, 'only the latest exclusion should mention the rejected destination');
  assert.match(brief, /Oakland/);
});

test('repeating one destination in multiple languages is not treated as ambiguous cities', () => {
  assert.deepEqual(resolveBayBaySearchContext('San Jose，圣荷西，今天有什么活动', {}, {}, today), { city: 'San Jose', date: today });
});
