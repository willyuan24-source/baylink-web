import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Rule } from 'postcss';

/**
 * UI9-R1-DETAIL (first cold-review round, lanes/UI9-P4/r1/synthesis-r1.json): the event, offer and opening detail pages
 * outside the hero, the rail markup and the page credits. One fact per row in the facts card (an offer's two short values
 * pair up, and an event's 多少钱 | 适合 on a phone when both are short, H58), 适合 at 400, the long-note clamp with 展开 on its own line; 问 BayBay kept from 360 px in every reading
 * mode; the 14 px caption at 30em (N05); the rail on the grid gutter (N16); a colour hover on the source and credit links
 * (N23); on a desktop the whole aside sticky where it fits, else the action card sticky in a full-height aside; a detail
 * bar's cells in the quiet look, one filled button per bar and section (N12, in part); the section rules
 * splitting the section gap (N15). The facts card's rules ship with the detail route, not in the global sheet.
 */
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events/x' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { StaticRouter } = await import('react-router-dom');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { NOTE_CLAMP_UNITS, PAIR_UNITS, PAIR_NOTE_UNITS } = await import('../src/features/detail/FactsGrid');
const { displayUnits } = await import('../src/lib/event-facts');
const { setLocale } = await import('../src/i18n/locale');

after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const TODAY = '2026-10-21';
const page = (key: string) => {
  const item = localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === key);
  assert.ok(item, key);
  return JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={discoveryShare(item).path}><LocalDiscoveryDetail record={buildDetailRecord(item)} today={TODAY} /></StaticRouter>));
};

const DETAIL_CSS = 'src/components/local-discovery-detail.css';
const FACTS_CSS = 'src/features/detail/facts-grid.css';
const sheet = (file: string) => postcss.parse(readFileSync(file, 'utf8'));
const mediaOf = (rule: Rule) => (rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : undefined);
/** Declarations of the rule with exactly this selector (and media, if given). */
const decls = (file: string, selector: string, media?: string) => {
  const found: Record<string, string>[] = [];
  sheet(file).walkRules(rule => {
    if (rule.selector !== selector || mediaOf(rule) !== media) return;
    const out: Record<string, string> = {};
    rule.walkDecls(decl => { out[decl.prop] = decl.value; });
    found.push(out);
  });
  assert.equal(found.length, 1, `one rule ${selector} in ${media ?? 'no media'} (${file})`);
  return found[0];
};

test('J1 P14: one fact per row, the offer\'s two short values side by side, 适合 at 400 across the card', () => {
  assert.equal(decls(FACTS_CSS, '.local-discovery-detail .detail-facts')['grid-template-columns'], 'minmax(0,1fr)');
  assert.equal(decls(FACTS_CSS, '.local-discovery-detail[data-kind=offer] .detail-facts')['grid-template-columns'], 'repeat(2,minmax(0,1fr))');
  assert.equal(decls(FACTS_CSS, '.local-discovery-detail .detail-fact[data-fact=for] .detail-fact__key')['font-weight'], '400');
  // The elder modes keep one column on a phone, an offer included.
  assert.equal(decls(FACTS_CSS, 'html:is([data-reading=large],[data-reading=extra-large],[data-simple]) .local-discovery-detail .detail-facts', '(max-width:767px)')['grid-template-columns'], 'minmax(0,1fr)');
  // The event card the cold review read (B Street, en): 何时 · 在哪 · 多少钱 · 适合, the note under 免费 whole (no 展开).
  const doc = page('event:san-mateo-boos-brews-2026');
  const order = [...doc.querySelectorAll('.detail-facts .detail-fact')].map(fact => fact.getAttribute('data-fact'));
  assert.deepEqual(order, ['when', 'where', 'cost', 'for']);
  assert.equal(doc.querySelector('[data-fact="cost"]')!.hasAttribute('data-clamp'), false, 'a two-line note shows whole on the full row');
  assert.equal(doc.querySelectorAll('.detail-fact__toggle').length, 0);
  const offer = page('offer:shake-shack-scarygood-oct2026');
  assert.deepEqual([...offer.querySelectorAll('.detail-facts .detail-fact')].map(fact => fact.getAttribute('data-fact')).slice(0, 3), ['when', 'what', 'terms']);
  assert.equal(offer.querySelector('article.local-discovery-detail')?.getAttribute('data-kind'), 'offer', 'the offer\'s pair is keyed on the article\'s kind');
  assert.ok(NOTE_CLAMP_UNITS >= 44 && NOTE_CLAMP_UNITS <= 48, 'two lines of the full-width note');
});

test('H58: an event\'s 多少钱 | 适合 share a phone row (标准) only when both fit one line of a half card', () => {
  assert.equal(decls(FACTS_CSS, 'html:not([data-reading=large],[data-reading=extra-large],[data-simple]) .local-discovery-detail .detail-facts[data-pair]', '(max-width:767px)')['grid-template-columns'], 'repeat(2,minmax(0,1fr))');
  assert.ok(PAIR_UNITS <= 8 && PAIR_NOTE_UNITS <= 22, 'a half card is about 139 px at 360');
  let paired = 0, single = 0;
  for (const item of localDiscoveries.filter(row => row.kind === 'event').slice(0, 60)) {
    const doc = page(`event:${discoveryShare(item).id}`);
    const facts = doc.querySelector('.detail-facts')!;
    const forValue = facts.querySelector('[data-fact="for"] .detail-fact__key')?.textContent ?? '';
    const cost = facts.querySelector('[data-fact="cost"]');
    const costKey = cost?.querySelector('.detail-fact__key')?.textContent ?? '';
    const note = cost?.querySelector('dd>small')?.textContent ?? '';
    if (facts.hasAttribute('data-pair')) {
      paired++;
      assert.ok(forValue && displayUnits(forValue) <= PAIR_UNITS && displayUnits(costKey) <= PAIR_UNITS && displayUnits(note) <= PAIR_NOTE_UNITS, `${discoveryShare(item).id}: ${costKey} | ${forValue}`);
      assert.equal(cost?.hasAttribute('data-clamp'), false);
    } else {
      single++;
      assert.ok(!forValue || displayUnits(forValue) > PAIR_UNITS || displayUnits(costKey) > PAIR_UNITS || displayUnits(note) > PAIR_NOTE_UNITS, discoveryShare(item).id);
    }
  }
  assert.ok(paired > 0 && single > 0, `both kinds sampled (${paired} paired, ${single} one per row)`);
});

test('J1 P14: a clamped note fades out at the end of its second line and 展开 has a line of its own, never over the text', () => {
  const text = readFileSync(FACTS_CSS, 'utf8');
  const phone = text.slice(text.indexOf('@media(max-width:767px)'));
  assert.ok(phone.length > 0);
  const clamp = decls(FACTS_CSS, 'html:not([data-reading=large],[data-reading=extra-large],[data-simple]) .local-discovery-detail .detail-fact[data-clamp]:not([data-open]) dd>small', '(max-width:767px)');
  assert.equal(clamp['max-height'], 'calc(2em * var(--lh-ui))', 'two lines of the note');
  assert.equal(clamp.overflow, 'hidden');
  assert.match(clamp.mask ?? '', /transparent/, 'the second line fades out');
  const toggle = decls(FACTS_CSS, 'html:not([data-reading=large],[data-reading=extra-large],[data-simple]) .local-discovery-detail .detail-fact__toggle', '(max-width:767px)');
  assert.equal(toggle.display, 'inline-flex', 'after the block note: a line of its own');
  assert.equal(toggle['min-height'], '0', 'the page-wide 44px control height would add a row');
  assert.equal(toggle.position, 'relative');
  assert.equal(toggle.right, undefined);
  const target = decls(FACTS_CSS, 'html:not([data-reading=large],[data-reading=extra-large],[data-simple]) .local-discovery-detail .detail-fact__toggle::before', '(max-width:767px)');
  assert.equal(target.height, 'var(--control-height)', 'a 44 px target around the one line');
  // The note keeps the card's UI line height, so two lines are exactly the clamp height (tokens.css gives small --lh-read).
  assert.equal(decls(FACTS_CSS, '.local-discovery-detail .detail-fact dd small')['line-height'], 'var(--lh-ui)');
  // The global sheet no longer carries the facts card (it ships with the detail route); only the page frame's gutter lists
  // name the card.
  const global: string[] = [];
  sheet(DETAIL_CSS).walkRules(rule => { for (const selector of rule.selectors) if (/detail-fact/.test(selector)) global.push(selector); });
  assert.ok(global.length > 0 && global.every(selector => selector.startsWith('.local-discovery-detail :is(.detail-head,.detail-note,.detail-facts-card,')), global.join(' | '));
});

test('J1 P20 / J2 P14 / J3 P18: 问 BayBay from 360 px in every reading mode; 特大 wraps the primary, it never swaps a word', () => {
  const css = sheet(DETAIL_CSS);
  const tight: string[] = [];
  css.walkRules(rule => { if (rule.selector.includes('[data-label=tight]') && /display:\s*inline/.test(rule.toString())) tight.push(`${mediaOf(rule)} ${rule.selector}`); });
  assert.deepEqual(tight, ['(max-width:359px) .site-detail-actions.detail-actions [data-label=tight]'], 'BayBay alone only below 360 px');
  const wrap = decls(DETAIL_CSS, 'html[data-reading=extra-large] .local-discovery-detail .site-detail-actions.detail-actions :is(.detail-action--primary,.detail-actions__primary .saves-add-day)', '(max-width:1023px)');
  assert.deepEqual([wrap['white-space'], wrap['text-wrap'], wrap['text-align']], ['normal', 'balance', 'center'], 'wrapped lines centred, clear of the round ends');
  assert.equal(decls(DETAIL_CSS, 'html[data-reading=extra-large][data-simple] .local-discovery-detail .site-detail-actions.detail-actions', '(max-width:1023px)')['padding-inline'], '0 var(--sp-1)');
  assert.equal(decls(DETAIL_CSS, 'html:is([data-reading=extra-large],[data-simple]) .site-detail-actions.detail-actions :is(.detail-action--primary,.detail-actions__primary .saves-add-day)', '(max-width:1023px)')['padding-inline'], 'var(--sp-2)');
  assert.equal(decls(DETAIL_CSS, '.site-detail-actions.detail-actions :is(.detail-action--primary,.detail-actions__primary .saves-add-day)', '(max-width:359px)')['text-align'], 'center');
  // From 360 px no detail rule takes the primary's padding below 8 px (the review's −4.8 px glyph clearance at 4 px).
  sheet(DETAIL_CSS).walkRules(rule => {
    if (mediaOf(rule) === '(max-width:1023px)' && rule.selector.includes('detail-action--primary')) rule.walkDecls('padding-inline', decl => assert.notEqual(decl.value, 'var(--sp-1)', rule.selector));
  });
  for (const [key, primary] of [['event:san-mateo-boos-brews-2026', /加入这天计划/], ['offer:shake-shack-scarygood-oct2026', /领取入口/], ['opening:marufuku-burlingame-announced', /加入计划|商家官网/]] as const) {
    const bar = page(key).querySelector('.site-detail-actions.detail-actions')!;
    assert.equal(bar.querySelector('[data-cell="ask"] [data-label="long"]')?.textContent, '问 BayBay', key);
    assert.match(bar.lastElementChild?.textContent || '', primary, key);
  }
});

test('the 问 BayBay label reads Ask BayBay on /en', async () => {
  await setLocale('en', false);
  try {
    const bar = page('event:san-mateo-boos-brews-2026').querySelector('.site-detail-actions.detail-actions')!;
    assert.equal(bar.querySelector('[data-cell="ask"] [data-label="long"]')?.textContent, 'Ask BayBay');
  } finally {
    await setLocale('zh-Hans', false);
  }
});

test('N05 / N16 / N23: the caption at 30em, the rail on the grid gutter, the source and credit links change colour on hover', () => {
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-caption')['max-width'], 'min(var(--measure),30em)');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-rail__track', '(min-width:768px)').gap, 'var(--grid-gutter)');
  const hover = '(hover:hover) and (pointer:fine)';
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail :is(.detail-credit,.detail-page-credits,.content-review-ended,.trust-row) a:hover', hover).color, 'var(--color-ink)');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .trust-row a:hover', hover).color, 'var(--color-brand-hover)');
});

test('desktop: the whole aside sticky where it fits, else the action card sticky in it; a detail bar\'s cells quiet (N12)', () => {
  const desk = '(min-width:1024px)';
  const aside = decls(DETAIL_CSS, '.local-discovery-detail .detail-aside', desk);
  assert.equal(aside['align-self'], 'stretch');
  assert.equal(aside.position, undefined, 'in 大 / 特大 / 简洁显示 or on a short screen the facts card scrolls away');
  const card = decls(DETAIL_CSS, '.local-discovery-detail .site-detail-actions.detail-actions', desk);
  assert.deepEqual([card.position, card.top], ['sticky', '5.5rem']);
  const std = 'html:not([data-reading=large],[data-reading=extra-large],[data-simple]) .local-discovery-detail';
  const tall = '(min-width:1024px) and (min-height:820px)';
  const whole = decls(DETAIL_CSS, `${std} .detail-aside`, tall);
  assert.deepEqual([whole['align-self'], whole.position, whole.top], ['start', 'sticky', '5.5rem'], '标准 on a tall screen: the facts stay in view too');
  assert.equal(decls(DETAIL_CSS, `${std} .site-detail-actions.detail-actions`, tall).position, 'static');
  // A guide's card keeps its boxed cells (UI9-R1-GUIDE-ARTICLE); a detail page's cells drop the box, hover and press keep
  // the sunken fill.
  const shared = decls(DETAIL_CSS, '.site-detail-actions.detail-actions :is(button.detail-actions__cell,.detail-actions__cell .saves-toggle)', desk);
  assert.equal(shared.border, '1px solid var(--color-line-control)');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .site-detail-actions.detail-actions :is(button.detail-actions__cell,.detail-actions__cell .saves-toggle)', desk)['border-color'], 'transparent');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .site-detail-actions.detail-actions :is(button.detail-actions__cell,.detail-actions__cell .saves-toggle):not(:hover,:active)', desk).background, 'none');
  // One filled button per bar (its primary, on every kind) and at most one per body section.
  for (const key of ['event:san-mateo-boos-brews-2026', 'offer:shake-shack-scarygood-oct2026', 'opening:marufuku-burlingame-announced']) {
    const doc = page(key);
    const bar = doc.querySelector('.site-detail-actions.detail-actions')!;
    assert.equal(bar.querySelectorAll('.detail-action--primary,.detail-actions__primary .saves-add-day').length, 1, `${key}: one primary in the bar`);
    assert.equal(bar.querySelectorAll('.detail-actions__cell [data-variant="primary"],.detail-actions__cell.detail-action--primary').length, 0, `${key}: no filled cell`);
    for (const section of doc.querySelectorAll('.detail-body section')) assert.ok(section.querySelectorAll('[data-variant="primary"]').length <= 1, `${key} ${section.className}`);
  }
});

test('N15: a section rule splits the section gap instead of adding to it; the share row has no rule of its own', () => {
  const source = decls(DETAIL_CSS, '.local-discovery-detail .detail-body>.detail-source');
  assert.deepEqual([source['margin-top'], source['padding-top']], ['calc(var(--section-gap) * .625)', 'calc(var(--section-gap) * .375)']);
  const end = decls(DETAIL_CSS, '.local-discovery-detail .discovery-return');
  assert.deepEqual([end['margin-top'], end.padding], ['calc(var(--section-gap) * .625)', 'calc(var(--section-gap) * .375) 0 0']);
  const share = decls(DETAIL_CSS, '.local-discovery-detail .detail-share');
  assert.deepEqual(share, { 'margin-top': 'var(--sp-3)' });
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-share .editorial-share-buttons')['margin-inline-start'], 'calc(-1 * var(--sp-2))', 'the quiet buttons\' icons on the column edge');
});

test('DECISIONS 13: no font-size literal in the sheets this lane touches', () => {
  for (const file of [DETAIL_CSS, FACTS_CSS, 'src/features/detail/detail-sheet.css']) {
    sheet(file).walkDecls('font-size', decl => { assert.match(decl.value, /^(?:var\(--|inherit$)/, `${file}: ${decl.value}`); });
  }
});
