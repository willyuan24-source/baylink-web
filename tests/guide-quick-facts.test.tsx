import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

// H08 (GR-03): a guide without an editorial record opens with a 30 秒看懂 built only from its own sentences — the first sourced
// fact, the first phone number (tap-to-call) and the first deadline or fee — labelled 从本文整理, never on outings, directories or
// deals boards, and not at all when the guide has none of the three. Five guide types below.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideBySlug, guides } = await import('../src/data/guides');
const { GUIDE_EDITORIAL } = await import('../src/data/guide-editorial');
const { guideBlockText } = await import('../src/lib/guide-content');
const { guideQuickFacts, quickFactsEligible, shortenSentence, englishSentences, sourceBodies } = await import('../src/features/guides/guide-quick-facts');
const { setLocale } = await import('../src/i18n/locale');
// The deals board and the city directory are chunks the article loads with its record; the page waits for them, so do the tests.
await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();

const noop = () => {};
const card = (slug: string, prefix = '') => {
  const html = renderToStaticMarkup(<StaticRouter location={`${prefix}/guides/${slug}`}><GuideDetail slug={slug} today="2026-10-13" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></StaticRouter>);
  return new JSDOM(html).window.document.querySelector('.gd-keyfacts[data-fallback]');
};
const bodyOf = (slug: string) => getGuideBySlug(slug)!.blocks.map(guideBlockText).join('\n');

// One guide per type: help lines, a dated action plan, school enrollment, a library-pass edition and a transit update.
const TYPES = {
  help: 'bay-area-311-211-local-help-guide',
  plan: 'bay-area-first-7-30-days-action-plan-october-2026',
  school: 'bay-area-k12-midyear-enrollment-guide',
  pass: 'bay-area-october-library-museum-pass-guide-2026',
  transit: 'bart-october-access-parking-update-2026',
} as const;

test('five guide types get a fallback 30 秒看懂 that quotes the article and calls its first number', async () => {
  await setLocale('zh-Hans', false);
  for (const [type, slug] of Object.entries(TYPES)) {
    const element = card(slug);
    assert.ok(element, `${type}: ${slug} has a fallback card`);
    assert.match(element!.querySelector('h2')!.textContent!, /30 秒看懂.*从本文整理/);
    assert.ok(element!.querySelector('a[href="#guide-sources"]'), `${type}: the card points at the official sources`);
    const body = bodyOf(slug);
    for (const value of element!.querySelectorAll('.gd-keyfacts__value')) {
      // A context label ("SMUHSD：") names who the sentence is about; the rest is the article's sentence.
      const quoted = value.textContent!.replace(value.querySelector('.gd-keyfacts__context')?.textContent ?? '', '').replace(/…$/u, '');
      assert.ok(body.includes(quoted), `${type}: "${quoted.slice(0, 40)}" is the article's own sentence`);
    }
    const rows = guideQuickFacts(getGuideBySlug(slug)!, '2026-10-13');
    if (rows.some(row => row.kind === 'phone')) assert.ok(element!.querySelector('a[href^="tel:"]'), `${type}: the phone row is tap-to-call`);
  }
  // The help-lines guide: a sourced fact, the 311 line (tap-to-call) and that 211 consultations are free.
  const help = guideQuickFacts(getGuideBySlug(TYPES.help)!, '2026-10-13');
  assert.deepEqual(help.map(row => row.kind), ['fact', 'phone', 'fee']);
  // A Bay-wide guide leads with a fact for everyone, not the San José-only line; the fee sentence says whose consultation is free.
  assert.equal(help[0].text, '各县：从 211 Bay Area 或县运营方按城市、邮编找援助。');
  assert.equal(help[2].context, '211');
  assert.match(card(TYPES.help)!.querySelector('a[href^="tel:"]')!.getAttribute('href')!, /^tel:311$/);
});

test('no fallback card on pilots, outings, directories and deals boards, nor on a guide with none of the three', async () => {
  await setLocale('zh-Hans', false);
  const pilot = Object.keys(GUIDE_EDITORIAL)[0];
  assert.equal(card(pilot), null, 'a pilot keeps its editorial 30 秒看懂');
  for (const slug of ['san-francisco-guide', 'bay-area-city-utilities-internet-phone-directory', 'bay-area-freebies-deals-2026-10']) {
    assert.equal(quickFactsEligible(getGuideBySlug(slug)!, false), false, slug);
    assert.equal(card(slug), null, slug);
  }
  // The roommate guide states no figure, number, deadline or fee: no card rather than an invented one.
  assert.deepEqual(guideQuickFacts(getGuideBySlug('bay-area-roommate-guide')!), []);
  assert.equal(card('bay-area-roommate-guide'), null);
  // Every eligible guide's rows are its own sentences, shortened only at a clause boundary.
  for (const guide of guides) {
    if (!quickFactsEligible(guide, Object.hasOwn(GUIDE_EDITORIAL, guide.slug))) continue;
    const body = guide.blocks.map(guideBlockText).join('\n');
    for (const row of guideQuickFacts(guide, '2026-10-13')) {
      assert.ok(body.includes(row.text.replace(/…$/u, '')), `${guide.slug}: ${row.text}`);
      // Nothing that leans on the sentence before it, and nothing that has already ended.
      assert.doesNotMatch(row.text, /另一个|^这|已经结束/u, `${guide.slug}: ${row.text}`);
    }
  }
});

test('review 10-14: a row says whose number it is, and a section headed by a past date is not quoted', async () => {
  await setLocale('zh-Hans', false);
  // The K-12 guide is Bay-wide; its first number is San Mateo Union HSD's. The row names SMUHSD, in zh and on /en.
  const school = guideQuickFacts(getGuideBySlug(TYPES.school)!, '2026-10-13').find(row => row.kind === 'phone')!;
  assert.equal(school.context, 'SMUHSD');
  assert.match(card(TYPES.school)!.textContent!, /打电话SMUHSD：Student Services 审核后/);
  await setLocale('en', false, `/guides/${TYPES.school}`);
  assert.match(card(TYPES.school, '/en')!.textContent!, /CallSMUHSD: Student Services .*650-558-2251/);
  await setLocale('zh-Hans', false);
  // BART: the 10 月 4 日黄线 section is over by 10-13 ("周日 18:00" would read as this Sunday); before the 4th it still counts.
  const bart = getGuideBySlug(TYPES.transit)!;
  assert.ok(!guideQuickFacts(bart, '2026-10-13').some(row => row.text.includes('Pleasant Hill')));
  assert.doesNotMatch(card(TYPES.transit)!.textContent!, /Pleasant Hill/);
  assert.ok(guideQuickFacts(bart, '2026-10-02').some(row => row.text.includes('Pleasant Hill')));
  // "211 是另一个入口" (another than what?) and an editor's note about a story time that has ended are not quoted.
  assert.ok(!guideQuickFacts(getGuideBySlug(TYPES.plan)!, '2026-10-13').some(row => row.text.includes('另一个入口')));
  assert.ok(!guideQuickFacts(getGuideBySlug('sccld-sharks-library-card-september-2026')!, '2026-10-13').some(row => row.text.includes('故事会')));
});

test('English and zh-Hant cards: translated rows only, no Chinese on /en', async () => {
  await setLocale('en', false, `/guides/${TYPES.help}`);
  const english = card(TYPES.help, '/en');
  assert.ok(english, 'the help-lines card has English rows');
  assert.doesNotMatch(english!.textContent!, /[㐀-鿿]/u);
  assert.match(english!.querySelector('h2')!.textContent!, /In 30 seconds.*From this guide/);
  await setLocale('zh-Hant', false);
  const hant = card(TYPES.help, '/zh-Hant');
  assert.match(hant!.textContent!, /從本文整理/);
  await setLocale('zh-Hans', false);
});

test('without a figure, the first fact is the first sentence after the lede that names a body the guide cites', async () => {
  await setLocale('zh-Hans', false);
  const factOf = (slug: string) => guideQuickFacts(getGuideBySlug(slug)!).find(row => row.kind === 'fact');
  assert.deepEqual(sourceBodies([{ title: 'Recology SF · Bulky Item Collection' }, { title: 'PG&E · Outages & Safety' }, { title: '加州法院：租房押金指南' }, { title: 'Oakland Public Library：办卡与身份核验' }, { title: 'San Francisco' }]),
    ['Recology SF', 'Recology', 'PG&E', '加州法院', 'Oakland Public Library']);
  assert.equal(factOf('bay-area-bulky-items-ewaste-hhw-guide')?.text, '旧金山：Recology 大件项目按有效住宅账户及住房类型核资格；危险废物另走 HHW 服务。');
  assert.equal(factOf('bay-area-alerts-outages-first-day-checklist')?.text, '旧金山使用 AlertSF；Alameda County 使用 AC Alert。');
  assert.match(card('bay-area-alerts-outages-first-day-checklist')!.textContent!, /AlertSF/);
  // A sentence that opens with a condition or advice is not a fact: the only candidate on the Peninsula page starts with 如果.
  assert.deepEqual(guideQuickFacts(getGuideBySlug('peninsula-living-guide')!), []);
  // Labels before a colon do not hide advice: "Cupertino：…不能替代…" is a rule, "San José：不要…" is not.
  assert.doesNotMatch(factOf('south-bay-school-district-enrollment-guide')!.text, /^[^：]+：不要/);
  // On /en the row is the translated sentence that names the same body, or no row (never Chinese).
  await setLocale('en', false, '/guides/bay-area-alerts-outages-first-day-checklist');
  const english = card('bay-area-alerts-outages-first-day-checklist', '/en');
  if (english) { assert.doesNotMatch(english.textContent!, /[㐀-鿿]/u); assert.match(english.textContent!, /San Francisco uses AlertSF; Alameda County uses AC Alert\./); }
  await setLocale('zh-Hans', false);
});

test('sentence helpers cut only at clause boundaries and keep English abbreviations together', () => {
  assert.equal(shortenSentence('短句。'), '短句。');
  const long = `${'甲'.repeat(60)}，${'乙'.repeat(30)}，${'丙'.repeat(30)}。`;
  assert.equal(shortenSentence(long), `${'甲'.repeat(60)}，${'乙'.repeat(30)}…`);
  assert.deepEqual(englishSentences('At review, Berkeley, Mt. Diablo and San Ramon Valley had entry points; recheck later. On Sept. 22 BART moved it; Lines 14 and 49 run.'),
    ['At review, Berkeley, Mt. Diablo and San Ramon Valley had entry points; recheck later.', 'On Sept. 22 BART moved it;', 'Lines 14 and 49 run.']);
});
