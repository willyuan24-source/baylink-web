import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';

/**
 * N06 (UI9-R1 cold review): one way of mixing scripts in record text. A Han character and a Latin letter, a digit or a
 * "$" price are separated by a space ("10:45 在 Maloney", "6–17 岁 $15", "Lot 1 集合"), the way the site's own copy and
 * guides already write them. Every string a page can show from an event, offer, new shop, bulletin or planner place is
 * checked after the whole data pipeline (editorial overlay included), so a new record that writes "带5岁和12岁的孩子"
 * fails here. Card date labels use M/D, never "M 月 D 日" (DECISIONS 20: one date pattern on cards).
 */

const HAN = '[\\u3400-\\u9fff\\uf900-\\ufaff]';
/** Every pair, overlapping ones included ('在' in '5在M' is two pairs). */
const TIGHT = new RegExp(`(?=(${HAN}[A-Za-z0-9]|[A-Za-z0-9]${HAN}|${HAN}\\$\\d))`, 'g');
/** "T恤" (T-shirt) is one word. */
const WORDS = /T恤/g;
/** Not reader text: ids, links, image keys, dates and search aliases. */
const SKIP = new Set(['id', 'aliases', 'imageKey', 'imageKeys', 'officialUrl', 'sourceUrl', 'storeUrl', 'url', 'slug', 'relatedGuideSlug', 'mapUrl', 'creditUrl', 'src', 'startDate', 'endDate', 'occurrenceDates', 'verifiedAt']);

/**
 * Strings the OPUS contract tests pin as they are (tests/opus-bay-* belong to the 3D world's lane): the Chase Center door
 * times (tests/opus-bay-w7-s-venues.test.ts reads "18:00开门" from the catalog) and the Exploratorium After Dark price line
 * (tests/opus-bay-w9-r-words.test.ts translates it word for word), and the MoAD first-Thursday title, which
 * tests/opus-bay-w5-calendar.test.ts compares with public/opus-bay/sf/v1/live.json (reference-only; scripts/opus-sf/export-live.ts
 * writes it). They go once those tests read the spaced text and live.json is re-exported.
 */
const PINNED: ReadonlySet<string> = new Set([
  '11月5日 19:00；17:30开门',
  '11月28日 19:30；18:00开门',
  '普通After Dark官网参考价$22.95；该场最终票价及附加项目按票页',
  '费用与参加条件：普通After Dark官网参考价$22.95；该场最终票价及附加项目按票页 需购票；Tactile Dome等附加项目另订另付。',
  '需购票；Tactile Dome等附加项目另订另付。',
  'MoAD 10月首周四免费夜场',
]);

type Hit = { where: string; text: string };
const tightIn = (text: string) => [...text.replace(WORDS, '').matchAll(TIGHT)].map(match => match[1]);
function collect(kind: string, record: { id: string }, value: unknown, path: string, hits: Hit[]) {
  if (typeof value === 'string') {
    if (!PINNED.has(value) && tightIn(value).length) hits.push({ where: `${kind}:${record.id} ${path}`, text: value });
    return;
  }
  if (Array.isArray(value)) { value.forEach((item, index) => collect(kind, record, item, `${path}[${index}]`, hits)); return; }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) if (!SKIP.has(key)) collect(kind, record, item, path ? `${path}.${key}` : key, hits);
  }
}

const RECORDS: readonly [string, readonly { id: string }[]][] = [
  ['event', MONTHLY_EVENTS], ['offer', currentFreebies], ['opening', currentOpenings], ['bulletin', currentRegionalBulletins], ['place', MONTHLY_PLACES],
];

test('record text puts a space between Han and Latin letters, digits or a $ price', () => {
  const hits: Hit[] = [];
  for (const [kind, list] of RECORDS) {
    assert.ok(list.length > 0, `${kind} records load`);
    for (const record of list) collect(kind, record, record, '', hits);
  }
  assert.deepEqual(hits.slice(0, 20).map(hit => `${hit.where}: ${hit.text}`), [], `${hits.length} strings without the space`);
});

test('the pinned strings still exist (drop them here once the OPUS tests read the spaced text)', () => {
  const all = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === 'string') all.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  for (const [, list] of RECORDS) list.forEach(walk);
  for (const text of PINNED) assert.ok(all.has(text), `no record shows ${text} any more: remove it from PINNED`);
});

test('the lint reads the pairs a reader sees', () => {
  assert.deepEqual(tightIn('参加巡游者10:45在Maloney'), ['者1', '5在', '在M']);
  assert.deepEqual(tightIn('6–17岁$15'), ['7岁', '岁$1']);
  assert.deepEqual(tightIn('参加巡游者 10:45 在 Maloney · 6–17 岁 $15 · Lot 1 集合'), []);
  assert.deepEqual(tightIn('可带自备 T恤参加'), []);
});

/** "11 月 5 日", and the ranges and lists "11 月 14–15 日", "11 月 1、8、14、15 日", "11 月 8／22 日", "11 月 20–22、27–29 日". */
const MONTH_DAY = /\d+\s*月\s*\d+(?:\s*[–\-、／/,，和]\s*\d+)*\s*日/;
/** Today in the Bay Area; records that ended before it no longer reach a card, so their old labels may stay. */
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

test('card date labels use M/D, never "M 月 D 日" (single dates, ranges or lists)', () => {
  const labels = ([...MONTHLY_EVENTS, ...currentFreebies, ...currentOpenings] as { id: string; dateLabel: string; startDate?: string; endDate?: string }[])
    .filter(record => !PINNED.has(record.dateLabel) && MONTH_DAY.test(record.dateLabel))
    .filter(record => (record.endDate ?? record.startDate ?? TODAY) >= TODAY)
    .map(record => `${record.id}: ${record.dateLabel}`);
  assert.deepEqual(labels, []);
});

test('the date-label check reads ranges and lists', () => {
  for (const label of ['11 月 5 日 19:00', '11 月 14–15 日 11:00–17:00', '11 月 1、8、14、15 日 14:00–15:00', '11 月 8／22 日 11:00–12:00', '11 月 20–22、27–29 日；11:30']) assert.ok(MONTH_DAY.test(label), label);
  for (const label of ['11/14–11/15 11:00–17:00', '11/1、11/8、11/14、11/15 14:00–15:00', '11/16–11/30 每日 15:00–15:30', '10/2 · 13:00–17:00']) assert.ok(!MONTH_DAY.test(label), label);
});
