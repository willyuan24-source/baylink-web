import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * UI-9 DECISIONS 17 + the captain's 10-20 note: one press rule site-wide. A listing whose source label starts with
 * 「媒体报道 · 」 (「媒體報導 · 」, "Press report · ") prints 「媒体报道 · M/D 核对」; any other label prints 「官网核对 M/D」.
 * Every card family reads the same test (lib/event-facts.ts isPressSource): the events index flag and EventsFrame
 * (source-kind.ts), FREE's boards (board-status.ts pressSourced), the detail page and its rails (checked-line.ts
 * pressSource) and BayBay's cards (card-check.ts pressSource). None of them may fall back to a /报道/ or outlet regex.
 */
const { isPressSource } = await import('../src/lib/event-facts');
const sourceKind = await import('../src/features/events/source-kind');
const boards = await import('../src/features/events/board-status');
const checked = await import('../src/features/source-monitor/checked-line');
const card = await import('../src/features/baybay/card-check');
const { PLANNER_EVENTS } = await import('../src/data/planner-catalog');
const { currentFreebies } = await import('../src/data/october-offers');
const { currentOpenings } = await import('../src/data/local-discoveries');

const RULES: [string, (label: string | undefined) => boolean][] = [
  ['event-facts', isPressSource],
  ['source-kind', sourceKind.isPressSource],
  ['board-status', boards.pressSourced],
  ['checked-line', checked.pressSource],
  ['card-check', card.pressSource],
];

test('one prefix rule: the five call sites agree on every fixture', () => {
  const press = ['媒体报道 · patch.com', '媒体报道 · thesocomarket.com', '媒體報導 · sfchronicle.com', 'Press report · patch.com', '  媒体报道 · SFGATE 10/3'];
  const official = [
    undefined, '', '主办方官网', 'City of Albany', 'Westfield Valley Fair',
    // These name a report but also the place's own page: official (they never start with the prefix).
    '商家官网营业安排；SFGATE 10/3 开业报道', 'SFist 9/21 开门报道 · 品牌门店页交叉核对', 'Flora 官网；Eater SF 项目地址报道',
    'Nosh 9/8 试营业报道 · The Game Parlour 官网', 'Asia Live 官方开业报道索引与现行订位入口', 'The Ritz-Carlton, San Francisco / PR Newswire',
    // No /报道/, outlet or "news" regex: the data carries the prefix when the source is press.
    'KQED 报道', 'The San Francisco Standard · Sundown Cinema', 'Community news page', 'Theater media kit',
  ];
  for (const [name, rule] of RULES) {
    for (const label of press) assert.equal(rule(label), true, `${name}: ${label}`);
    for (const label of official) assert.equal(rule(label), false, `${name}: ${label}`);
  }
});

test('on the live data every press record starts with the prefix, and the five rules agree on all of it', () => {
  const labels = [
    ...PLANNER_EVENTS.map(event => event.sourceLabel),
    ...currentFreebies.map(offer => offer.sourceLabel),
    ...currentOpenings.map(shop => shop.sourceLabel),
  ];
  assert.ok(labels.length > 900, `${labels.length} labels`);
  let press = 0;
  for (const label of labels) {
    const answers = RULES.map(([, rule]) => rule(label));
    assert.ok(answers.every(answer => answer === answers[0]), `the rules disagree on ${label}`);
    if (answers[0]) press++;
  }
  assert.ok(press > 0, 'the data has press-only records (CNT-SIGNBOARD gave them the prefix)');
});

test('no card module keeps its own press regex', () => {
  for (const file of ['src/features/events/source-kind.ts', 'src/features/events/board-status.ts', 'src/features/source-monitor/checked-line.ts', 'src/features/baybay/card-check.ts']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\/[^/\n]*报道[^/\n]*\/i?[;.,)]/, `${file} has a /报道/ regex`);
    assert.match(source, /isPressSource/, `${file} reads lib/event-facts.ts isPressSource`);
  }
});
