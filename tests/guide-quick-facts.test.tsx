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
const { guideQuickFacts, quickFactsEligible, shortenSentence, englishSentences } = await import('../src/features/guides/guide-quick-facts');
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
      const quoted = value.textContent!.replace(/…$/u, '');
      assert.ok(body.includes(quoted), `${type}: "${quoted.slice(0, 40)}" is the article's own sentence`);
    }
    const rows = guideQuickFacts(getGuideBySlug(slug)!);
    if (rows.some(row => row.kind === 'phone')) assert.ok(element!.querySelector('a[href^="tel:"]'), `${type}: the phone row is tap-to-call`);
  }
  // The help-lines guide: a sourced fact, the 311 line (tap-to-call) and that 211 consultations are free.
  const help = guideQuickFacts(getGuideBySlug(TYPES.help)!);
  assert.deepEqual(help.map(row => row.kind), ['fact', 'phone', 'fee']);
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
    for (const row of guideQuickFacts(guide)) assert.ok(body.includes(row.text.replace(/…$/u, '')), `${guide.slug}: ${row.text}`);
  }
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

test('sentence helpers cut only at clause boundaries and keep English abbreviations together', () => {
  assert.equal(shortenSentence('短句。'), '短句。');
  const long = `${'甲'.repeat(60)}，${'乙'.repeat(30)}，${'丙'.repeat(30)}。`;
  assert.equal(shortenSentence(long), `${'甲'.repeat(60)}，${'乙'.repeat(30)}…`);
  assert.deepEqual(englishSentences('At review, Berkeley, Mt. Diablo and San Ramon Valley had entry points; recheck later. On Sept. 22 BART moved it; Lines 14 and 49 run.'),
    ['At review, Berkeley, Mt. Diablo and San Ramon Valley had entry points; recheck later.', 'On Sept. 22 BART moved it;', 'Lines 14 and 49 run.']);
});
