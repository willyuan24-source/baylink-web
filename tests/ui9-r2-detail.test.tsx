import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Rule } from 'postcss';

/**
 * UI9-R2-DETAIL (second cold-review round, lanes/UI9-P4/r2/synthesis-r2.json): the event, offer and opening detail pages.
 * The photo credit sits on the picture as plain text (C P08, N25) and its links in 本页图片来源; an opening says 已开业 once
 * (C P16); 商家活动 has its own chip and every category chip is ink on its tint (N07 / N08); fact keys at 400 (N03); no
 * hover outside (hover:hover) (N23); the elder primaries stay on one line in their short words (R2-08, OD6); on a desktop
 * the H1 is the display step, the body reads at a 680 px measure and the column ends beside the body with 附近还有 and the
 * credits (B P04 / C P17); offers and openings end with a photo row (B P21); a cards-only venue photo never leads a detail
 * (DECISIONS 43(b)).
 */
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events/x' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { StaticRouter } = await import('react-router-dom');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord, nextCandidate, CARDS_ONLY_PHOTOS } = await import('../src/features/detail/build-detail');
const { heroCover } = await import('../src/features/detail/hero-cover');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { COVER_TABLES } = await import('../src/lib/cover-candidates');

after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const TODAY = '2026-10-21';
const find = (key: string) => {
  const item = localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === key);
  assert.ok(item, key);
  return item;
};
const page = (key: string) => {
  const item = find(key);
  return JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={discoveryShare(item).path}><LocalDiscoveryDetail record={buildDetailRecord(item, undefined, { railDay: TODAY })} today={TODAY} /></StaticRouter>));
};
const DETAILS = ['event:san-mateo-boos-brews-2026', 'event:menlo-park-halloween-hoopla-2026', 'offer:shake-shack-scarygood-oct2026', 'opening:marufuku-burlingame-announced'];

const DETAIL_CSS = 'src/components/local-discovery-detail.css';
const FACTS_CSS = 'src/features/detail/facts-grid.css';
const SKELETON_CSS = 'src/features/detail/detail-skeleton.css';
const sheet = (file: string) => postcss.parse(readFileSync(file, 'utf8'));
const mediaOf = (rule: Rule) => (rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : undefined);
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

test('C P08 / N25: the credit is plain text on the picture\'s bottom-right; its links are in 本页图片来源, which ends the column', () => {
  for (const key of DETAILS) {
    const doc = page(key);
    const hero = doc.querySelector('figure.detail-hero')!;
    assert.equal(hero.querySelector('figcaption'), null, `${key}: no line under the picture`);
    const credit = hero.querySelector('.ui-cover > .detail-photo-credit');
    assert.ok(credit?.textContent, `${key}: the credit is on the picture`);
    assert.equal(hero.querySelector('a'), null, `${key}: no link on the hero (N25: no 18–21 px target)`);
    const credits = doc.querySelector('details#page-credits')!;
    assert.ok(credits.closest('.detail-aside-end'), `${key}: the credits end the column`);
    assert.equal(credits.parentElement!.lastElementChild, credits, key);
    assert.equal(doc.querySelector('.detail-source #page-credits'), null, `${key}: not in 来源与核对 any more`);
  }
  const rule = decls(DETAIL_CSS, '.local-discovery-detail .detail-photo-credit');
  assert.deepEqual([rule.position, rule.right, rule.bottom, rule.background, rule.color, rule['pointer-events']], ['absolute', 'var(--sp-2)', 'var(--sp-2)', 'var(--color-badge-bg)', 'var(--color-surface)', 'none']);
  assert.equal(rule['font-size'], 'var(--fs-label-thumb)', 'the base 13 px in every reading size');
  const xl = decls(DETAIL_CSS, 'html[data-reading=extra-large] .local-discovery-detail .detail-photo-credit');
  assert.deepEqual([xl.top, xl.bottom], ['var(--sp-2)', 'auto'], '特大: the top-right corner, away from the bottom-left label');
  for (const key of DETAILS) assert.equal(page(key).querySelector('.detail-photo-credit')?.getAttribute('data-simple') ?? 'hide', 'hide', `${key}: 简洁显示 leaves it out`);
  assert.equal(rule['text-decoration'], undefined, 'no underline');
  assert.ok(!/white-space:\s*nowrap|text-overflow/.test(readFileSync(DETAIL_CSS, 'utf8').match(/\.detail-photo-credit \{[^}]*\}/)![0]), 'it wraps, never cut');
});

test('C P16: an opening says 已开业 once, in the chip above the H1; the 开业 key is the day', () => {
  const doc = page('opening:marufuku-burlingame-announced');
  const article = doc.querySelector('article.local-discovery-detail')!;
  assert.equal((article.textContent!.match(/已开业/g) || []).length, 1, article.textContent!.match(/.{0,12}已开业.{0,12}/g)?.join(' | '));
  assert.match(doc.querySelector('.detail-chips')!.textContent || '', /10\/11 已开业/);
  assert.equal(doc.querySelector('[data-fact="when"] .detail-fact__key')!.textContent, '10/11');
});

test('N07 / N08: category chips are ink on their tint; 商家活动 has its own chip, a public benefit keeps the free tone', () => {
  assert.equal(page('offer:shake-shack-scarygood-oct2026').querySelector('.detail-cat')!.getAttribute('data-cat'), 'merchant');
  const benefit = localDiscoveries.find(row => row.kind === 'offer' && /sfmta-free-muni/.test(row.offer.id));
  if (benefit) assert.equal(page(`offer:${discoveryShare(benefit).id}`).querySelector('.detail-cat')!.getAttribute('data-cat'), 'free');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-cat').color, 'var(--color-ink)');
  assert.deepEqual(decls(DETAIL_CSS, '.local-discovery-detail .detail-cat[data-cat=merchant]'), { 'border-color': 'var(--color-line-strong)', background: 'var(--color-surface)' });
  assert.doesNotMatch(readFileSync(DETAIL_CSS, 'utf8'), /--tc-[a-z]+-fg/, 'no tone adds a text colour');
});

test('N03: fact keys at 400 (the site keeps 400 / 600 / 700); N23: every hover in this lane\'s sheets is under (hover:hover)', () => {
  assert.equal(decls(FACTS_CSS, '.local-discovery-detail .detail-fact__key')['font-weight'], '400');
  for (const file of [DETAIL_CSS, FACTS_CSS, SKELETON_CSS]) {
    sheet(file).walkRules(rule => {
      if (!rule.selector.includes(':hover')) return;
      assert.match(mediaOf(rule) || '', /hover:\s*hover/, `${file}: ${rule.selector}`);
    });
  }
});

test('R2-08 / OD6: at 特大 and in 家人版 the primary is one line in its short words; the day primary carries 加入计划', () => {
  const xl = 'html[data-reading=extra-large] .local-discovery-detail .site-detail-actions.detail-actions';
  const media = '(max-width:1023px)';
  assert.equal(decls(DETAIL_CSS, `${xl} :is(.detail-action--primary,.detail-actions__primary .saves-add-day:has(>.lucide-calendar-plus))`, media)['white-space'], 'nowrap');
  // Once added (✓ 已加入 10/24 / In your Oct 24 plan: no short words) it wraps to two balanced lines, never past the pill.
  const added = decls(DETAIL_CSS, `${xl} .detail-actions__primary .saves-add-day:not(:has(>.lucide-calendar-plus))`, media);
  assert.deepEqual([added['white-space'], added['text-wrap'], added['text-align']], ['normal', 'balance', 'center']);
  assert.equal(decls(DETAIL_CSS, `html[data-reading=extra-large][data-simple] .local-discovery-detail .site-detail-actions.detail-actions .detail-actions__primary .saves-add-day:not(:has(>.lucide-calendar-plus))`, media)['line-height'], '1.1');
  assert.equal(decls(DETAIL_CSS, `${xl} .detail-actions__primary [data-label=short]`, media).display, 'inline');
  assert.equal(decls(DETAIL_CSS, `${xl} .detail-actions__primary [data-label=full]`, media).display, 'none');
  assert.equal(decls(DETAIL_CSS, `${xl} .detail-actions__primary[data-day] .saves-add-day:has(>.lucide-calendar-plus)::after`, media).content, 'var(--detail-day-short)');
  const day = page('event:san-mateo-boos-brews-2026').querySelector('.detail-actions__primary[data-day]')!;
  assert.match(day.getAttribute('style') || '', /--detail-day-short:\s*"加入计划"/);
  // The name keeps the whole action (the visible short words are part of what it does).
  assert.match(day.querySelector('button')!.getAttribute('aria-label') || '', /^加入这天计划：/);
});

test('B P04 / C P17: desktop H1 display step; body at the reading step on 42.5rem (680 px), English on --measure; the column ends with the body', () => {
  const desk = '(min-width:1024px)';
  assert.deepEqual([decls(DETAIL_CSS, '.local-discovery-detail .detail-head h1', desk)['font-size']], ['var(--text-display)']);
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-layout', desk)['grid-template-rows'], 'auto 1fr auto');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-main--body', desk)['grid-row'], '2 / span 2');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail .detail-aside', desk)['grid-row'], '1 / span 2');
  const end = decls(DETAIL_CSS, '.local-discovery-detail .detail-aside-end', desk);
  assert.deepEqual([end['grid-column'], end['grid-row'], end['align-self']], ['9 / span 4', '3', 'end']);
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail', desk)['--detail-measure'], '42.5rem');
  assert.equal(decls(DETAIL_CSS, '.local-discovery-detail:lang(en)', desk)['--detail-measure'], 'var(--measure)');
  assert.equal(decls(SKELETON_CSS, '.detail-skeleton .detail-skeleton__title', desk).height, 'calc(var(--text-display) * var(--lh-display))');
});

test('B P21: every detail ends with a photo row; the column\'s 附近还有 repeats none of the page\'s cards', () => {
  for (const key of DETAILS) {
    const doc = page(key);
    const end = doc.querySelector('#detail-related-title')?.closest('.detail-rail');
    assert.ok(end, `${key}: a closing photo row`);
    const ends = [...end!.querySelectorAll('.detail-rail__track a')].map(a => a.getAttribute('href'));
    assert.ok(ends.length >= (key.startsWith('event:') ? 2 : 3), `${key}: ${ends.length} cards`);
    const side = [...doc.querySelectorAll('.detail-rail--side .detail-rail__rows a[href^="/events/"]')].map(a => a.getAttribute('href'));
    assert.ok(side.length <= 3, key);
    for (const href of side) assert.ok(!ends.includes(href), `${key}: ${href} once`);
    assert.equal(doc.querySelector('.detail-rail--side .detail-rail__track'), null, `${key}: the column takes rows only`);
  }
});

test('B P21 budget: a rail card\'s picture is decorative, so the record (and the bucket\'s English pack) carries no alt', () => {
  for (const key of DETAILS) {
    const record = buildDetailRecord(find(key), undefined, { railDay: TODAY });
    const pictured = record.rail.filter(event => event.image);
    assert.ok(pictured.length >= 3, `${key}: ${pictured.length} rail pictures`);
    for (const event of pictured) assert.equal(event.image!.alt, '', `${key}: ${event.id} keeps no alt`);
    const doc = page(key);
    for (const img of doc.querySelectorAll('.detail-rail img')) assert.equal(img.getAttribute('alt'), '', `${key}: rail img alt`);
  }
});

test('DECISIONS 43(b): a cards-only venue photo never becomes a detail hero; rail cards may still show it', () => {
  assert.deepEqual([...CARDS_ONLY_PHOTOS].sort(), ['venue-sjpl-calabazas-library', 'venue-smcl-atherton-library', 'venue-smcl-brisbane-library']);
  // A stand-in for B2's venue photo (not on this base): an approved venue photo's record under the cards-only key.
  const venue = Object.values(GUIDE_IMAGES).find(image => image.kind === 'photo' && image.subject === 'venue')!;
  assert.ok(venue, 'a venue photo to stand in');
  for (const key of CARDS_ONLY_PHOTOS) {
    const images = { ...GUIDE_IMAGES, [key]: { ...venue, src: `/guides/venues/${key}.webp` } };
    const tables = { ...COVER_TABLES, venues: [...COVER_TABLES.venues, { id: key, name: key, match: ['Test Library 43b'], imageKeys: [key], approvedAt: '2026-10-23', ownerQuote: 'test' }] };
    const record = { id: `test-43b-${key}`, title: 'Storytime', venue: 'Test Library 43b', category: 'family', audience: ['亲子家庭'] };
    const card = nextCandidate('event', record, new Set(), { images, tables });
    assert.equal(card?.key, key, `${key}: a card shows the venue photo`);
    const hero = nextCandidate('event', record, new Set(), { images, tables, hero: true });
    assert.ok(hero && hero.key !== key, `${key}: the hero falls to the next candidate (${hero?.key})`);
  }
});

test('DECISIONS 43(b): a listing whose own image is a cards-only photo does not lead with it; the hero takes the next one', () => {
  const venue = Object.values(GUIDE_IMAGES).find(image => image.kind === 'photo' && image.subject === 'venue')!;
  const base = buildDetailRecord(find('event:san-mateo-boos-brews-2026'), undefined, { railDay: TODAY });
  assert.ok(base.item.kind === 'event');
  const event = base.item.event;
  const next = Object.entries(GUIDE_IMAGES).find(([key, image]) => image.kind === 'photo' && image.subject === 'venue' && image.src !== venue.src && !CARDS_ONLY_PHOTOS.has(key))!;
  const own = (imageKey: string, hero?: { key: string; image: typeof venue }) => ({ ...base, item: { ...base.item, event: { ...event, imageKey } }, image: { ...venue, src: `/guides/venues/${imageKey}.webp` }, hero });
  const src = (cover: ReturnType<typeof heroCover>) => (cover.tier === 'type' ? cover.tier : cover.image.src);
  // The control: the same photo under any other key leads (the path is live).
  assert.equal(src(heroCover(own('venue-test-43b-own'), TODAY)), '/guides/venues/venue-test-43b-own.webp');
  for (const key of CARDS_ONLY_PHOTOS) {
    assert.equal(src(heroCover(own(key, { key: next[0], image: next[1] }), TODAY)), next[1].src, `${key}: the next candidate leads`);
    assert.equal(src(heroCover(own(key), TODAY)), 'type', `${key}: with no candidate, the type cover`);
  }
});

test('C P16: an opening page says 已开业 once outside the editor\'s prose (a no-day key keeps the time)', () => {
  const counts = new Map<number, string[]>();
  for (const item of localDiscoveries.filter(row => row.kind === 'opening')) {
    const key = `${item.kind}:${discoveryShare(item).id}`;
    const doc = page(key);
    for (const prose of doc.querySelectorAll('.detail-summary, .detail-prose')) prose.remove();
    const n = (doc.textContent!.match(/已开业/g) || []).length;
    counts.set(n, [...(counts.get(n) || []), key]);
  }
  assert.deepEqual([...counts.keys()].filter(n => n > 1), [], JSON.stringify(Object.fromEntries([...counts].filter(([n]) => n > 1))));
  const when = (key: string) => page(key).querySelector('.detail-fact[data-fact=when] .detail-fact__key')?.textContent?.trim();
  assert.equal(when('opening:roundup-alesta-sebastopol-2026'), '2026 年夏季');
  assert.equal(when('opening:asia-live-valley-fair'), '2026 年 6 月 · 九月复核');
});
