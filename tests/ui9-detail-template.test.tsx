import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import React, { Suspense } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import postcss, { type Rule } from 'postcss';

/**
 * UI9-DETAIL (content arrangement 10-19): the detail template on D2. The action bar's contract (BAR-CONTRACT: cells, then the
 * one primary, always last; every rule keyed on .site-detail-actions.detail-actions; solid, no blur), the first-screen order,
 * the 13 px credit line under a photo and #page-credits, the blocks 简洁显示 subtracts, the rails' card anatomy, and the
 * in-app loading state (the skeleton after 300 ms, kept 400 ms).
 */
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events/x' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, Routes, Route } = await import('react-router-dom');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { detailLoaders } = await import('../src/data/generated/detail-loaders');
const { detailBucket } = await import('../src/lib/english-loading');
const { resetDetailRecords } = await import('../src/features/detail/load-detail');
const { default: LocalDiscoveryPage } = await import('../src/pages/LocalDiscoveryPage');

afterEach(cleanup);
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

// On or after the latest verifiedAt in the catalog (Claude's weekly review stamped 2026-10-21): a page rendered before its own
// check date prints no check line.
const TODAY = '2026-10-21';
const find = (key: string) => {
  const item = localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === key);
  assert.ok(item, key);
  return item;
};
const page = (key: string, today = TODAY) => {
  const item = find(key);
  return JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={discoveryShare(item).path}><LocalDiscoveryDetail record={buildDetailRecord(item)} today={today} /></StaticRouter>));
};
// The arrangement's four test details, an ended event and a sold-out one.
const DETAILS = ['event:sf-thrive-thrill-o-ween-2026', 'event:acl-cherryland-chinese-storytimes-oct24-2026', 'offer:sfmoma-family-oct25',
  'opening:marufuku-burlingame-announced', 'event:half-moon-bay-pumpkin-festival-2026', 'event:napa-harvest-after-dark-2026'];
const FOLLOWING = 4;

test('N18: the bar is cells, then the one primary, always last; 加入这天计划 / 加入计划 / 领取入口 / 官方页 by the page', () => {
  const primaries: Record<string, RegExp> = {
    'event:sf-thrive-thrill-o-ween-2026': /加入这天计划/, 'event:acl-cherryland-chinese-storytimes-oct24-2026': /加入这天计划/,
    'offer:sfmoma-family-oct25': /^领取入口/, 'opening:marufuku-burlingame-announced': /^加入计划$/,
    'event:half-moon-bay-pumpkin-festival-2026': /^官方页/, 'event:napa-harvest-after-dark-2026': /^官方页/,
  };
  for (const key of DETAILS) {
    const doc = page(key);
    const bar = doc.querySelector('.site-detail-actions.detail-actions')!;
    const last = bar.lastElementChild!;
    assert.ok(last.matches('.detail-actions__primary'), `${key}: the primary is last`);
    assert.match(last.textContent || '', primaries[key], key);
    const cells = [...bar.children].slice(0, -1).map(cell => cell.getAttribute('data-cell'));
    const ended = key.includes('half-moon-bay');
    assert.deepEqual(cells, ended ? ['ask'] : ['save', 'family', 'ask'], `${key}: 收藏 · 发家人 · 问 BayBay, a cell that does not apply left out`);
    const family = bar.querySelector('[data-cell="family"]');
    if (family) {
      // WCAG 2.5.3: the name is the label on screen (发家人 / 发给家人) plus a hidden （大字版）, never a name without it.
      assert.equal(family.hasAttribute('aria-label'), false, key);
      assert.deepEqual([...family.querySelectorAll('span')].map(span => span.textContent), ['发家人', '发给家人', '（大字版）'], key);
      assert.ok(family.querySelector('span:last-child')!.matches('.ui-visually-hidden'), key);
    }
    // 官方页 ↗ is on the first screen once: the primary, or the facts card's 何时 / 开业 slot when the primary is not official.
    const slot = doc.querySelectorAll('[data-fact="when"] dt a.detail-fact__aside');
    assert.equal(slot.length, last.matches('a[target="_blank"]') ? 0 : 1, key);
  }
});

test('first screen order: back link, hero (+ credit under a photo), chips, H1, sub line or dek, the facts card ending ✓ 官网核对', () => {
  for (const key of DETAILS) {
    const doc = page(key);
    const main = doc.querySelector('.detail-main--top')!;
    assert.ok(doc.querySelector('.detail-back')!.compareDocumentPosition(main) & FOLLOWING, key);
    assert.ok(main.firstElementChild!.matches('figure.detail-hero'), key);
    const hero = main.firstElementChild!;
    const photo = hero.getAttribute('data-tier') !== 'type';
    // C P08 / N25 (UI9-R2-DETAIL): the credit is plain text on the picture (no line under it, no link); G13 / DECISIONS 23:
    // the badge carries the tier words and the credit does not repeat them.
    const credit = hero.querySelector('.ui-cover > .detail-photo-credit');
    assert.equal(!!credit, photo, `${key}: a credit on a photo only`);
    assert.equal(hero.querySelector('figcaption, a'), null, `${key}: nothing under the picture, no link on it`);
    const badge = hero.querySelector('[data-provenance]')?.textContent;
    if (credit && badge) assert.ok(!credit.textContent!.startsWith(badge), `${key}: the credit does not repeat ${badge}`);
    const chips = doc.querySelector('.detail-chips')!;
    assert.ok(chips.querySelectorAll('.ui-status:not(.detail-cat)').length <= 2, `${key}: at most two status chips`);
    if (!key.startsWith('opening:')) assert.ok(chips.firstElementChild!.matches('.detail-cat[data-cat]'), `${key}: the category chip first`);
    const card = doc.querySelector('.detail-facts-card')!;
    assert.ok(card.lastElementChild!.matches('.detail-facts-check'), `${key}: the card ends with the check line`);
    assert.match(card.lastElementChild!.textContent || '', /官网核对 \d+\/\d+|媒体报道 · \d+\/\d+ 核对/);
    for (const fact of card.querySelectorAll('.detail-fact')) assert.ok(fact.querySelector('dd > .detail-fact__key')?.textContent, `${key}: every fact has a key`);
  }
  // The opening's H1 is the name; its city is the sub line (P26). C P16: the chip above the H1 says 10/11 已开业 once; the
  // 开业 key is the day.
  const shop = page('opening:marufuku-burlingame-announced');
  assert.equal(shop.querySelector('h1')!.textContent, 'Marufuku Ramen');
  assert.equal(shop.querySelector('.detail-sub')!.textContent, 'Burlingame');
  assert.match(shop.querySelector('[data-fact="when"] .detail-fact__key')!.textContent || '', /^\d+\/\d+$/);
});

test('the event 何时 key is eventWhenLine as written: weekday first, 24 h clock time, never "N–M 点"', () => {
  const doc = page('event:sf-thrive-thrill-o-ween-2026');
  const key = doc.querySelector('[data-fact="when"] .detail-fact__key')!.textContent || '';
  assert.match(key, /^周[一二三四五六日] \d+\/\d+ · \d{1,2}:\d{2}–\d{1,2}:\d{2}$/);
  for (const id of DETAILS.filter(key => key.startsWith('event:'))) assert.doesNotMatch(page(id).querySelector('[data-fact="when"]')!.textContent || '', /\d+–\d+ 点|\d+ 点起/, id);
});

test('decision 17: the facts check line and the trust row read one source type (press by its label only) and say the same', () => {
  const lines = (key: string) => {
    const doc = page(key);
    const check = doc.querySelector('.detail-facts-check')?.textContent || '';
    const row = doc.querySelector('.trust-row');
    const dated = [...(row?.querySelectorAll('.trust-row-item') ?? [])].find(item => item.querySelector('time'));
    return { check, dated: dated?.textContent || '', label: row?.querySelector('.trust-row-item')?.textContent || '' };
  };
  // An official page reached by another URL (the mall's shop page) is still the official page: 官网核对 on both lines; so is
  // a label that names the shop's own announcement beside a report (the one prefix rule, UI9-INT).
  for (const key of ['opening:jean-dousset-valley-fair', 'opening:old-post-office-burlingame']) {
    const official = lines(key);
    assert.match(official.check, /^官网核对 \d+\/\d+$/, key);
    assert.equal(official.dated, official.check, key);
  }
  // A press source: 媒体报道 · M/D 核对 on both lines, and the row never calls a press report 官方来源.
  for (const key of ['opening:albany-o2-sushi-opening-2026', 'event:r2-santarosa-ross-street-sundays-2026', 'offer:pacific-catch-aloha-corte-madera-20261005']) {
    const { check, dated, label } = lines(key);
    assert.match(check, /^媒体报道 · \d+\/\d+ 核对$/, key);
    assert.equal(dated, check, `${key}: the trust row says what the facts card says`);
    assert.equal(label, '来源', key);
  }
});

test('何时 notes: one time style with the key (N06), the listing date note in every locale, an ended run kept whole', async () => {
  // The session notes print each day's time as the key does (C's eventWhenLine), "9 点起" beside "9 点起", never "9:00 起".
  for (const key of ['event:sausalito-goblin-jamboree-2026', 'event:concord-sidegate-trivia-october-2026']) {
    const when = page(key).querySelector('[data-fact="when"]')!;
    const keyTime = (when.querySelector('.detail-fact__key')!.textContent || '').split(' · ')[1];
    assert.ok(keyTime, key);
    const notes = [...when.querySelectorAll('.detail-fact__line')].map(line => line.textContent || '');
    assert.ok(notes.length && notes.every(line => !/ · /.test(line) || line.endsWith(` · ${keyTime}`)), `${key}: ${keyTime} | ${notes.join(' / ')}`);
  }
  // A multi-day listing without sessions keeps its date note in zh and en alike (the en range chip has a " · " too).
  const { setLocale } = await import('../src/i18n/locale');
  const notes = () => [...page('event:bay-area-musical-improv-festival-2026').querySelectorAll('[data-fact="when"] .detail-fact__line')].map(line => line.textContent);
  const zh = notes();
  await setLocale('en', false);
  try {
    const en = notes();
    assert.ok(zh.length >= 1 && en.length === zh.length, `zh ${zh.join(' / ')} | en ${en.join(' / ')}`);
  } finally {
    await setLocale('zh-Hans', false);
  }
  // An ended two-day festival keeps both days in its archive note, not just the last one in the key.
  const ended = page('event:half-moon-bay-pumpkin-festival-2026').querySelector('[data-fact="when"]')!;
  assert.match([...ended.querySelectorAll('.detail-fact__line')].map(line => line.textContent).join(' / '), /10\/17–18/);
});

test('the primary never wraps at 320 特大: a short label below 360 px at 大 / 特大 / 简洁显示, the full one kept as its name', async () => {
  const { setLocale } = await import('../src/i18n/locale');
  await setLocale('en', false);
  try {
    for (const [key, full, short] of [['offer:sfmoma-family-oct25', 'How to claim', 'Claim'], ['opening:marufuku-burlingame-announced', 'Add to a plan', 'Plan'], ['event:napa-harvest-after-dark-2026', 'Official page', 'Official']]) {
      const primary = page(key).querySelector('.site-detail-actions .detail-actions__primary')!;
      assert.equal(primary.getAttribute('aria-label'), full, key);
      assert.equal(primary.querySelector('[data-label=full]')?.textContent, full, key);
      assert.equal(primary.querySelector('[data-label=short]')?.textContent, short, key);
    }
  } finally {
    await setLocale('zh-Hans', false);
  }
  // Chinese labels are short already: one label, no second span, no aria-label.
  const zh = page('offer:sfmoma-family-oct25').querySelector('.site-detail-actions .detail-actions__primary')!;
  assert.equal(zh.querySelector('[data-label=short]'), null);
  assert.equal(zh.hasAttribute('aria-label'), false);
  const css = postcss.parse(readFileSync('src/components/local-discovery-detail.css', 'utf8'));
  const shown: string[] = [];
  css.walkRules(rule => { if (rule.selector.includes('[data-label=short]') && /display:\s*inline/.test(rule.toString()) && (rule.parent as { params?: string }).params?.includes('max-width:359px')) shown.push(rule.selector); });
  assert.equal(shown.length, 1, 'the short label shows only below 360 px');
  assert.match(shown[0], /data-reading=extra-large/);
  // 家人版 (22.5 px) below 360 px: the room for a 4-character label comes from the cells' side padding, not the type size.
  const family: string[] = [];
  css.walkRules(rule => {
    if ((rule.parent as { params?: string }).params?.includes('max-width:359px') && rule.selector.startsWith('html[data-reading=extra-large][data-simple]')) {
      rule.walkDecls(decl => { family.push(`${/__cell/.test(rule.selector) ? 'cell' : 'primary'} ${decl.prop}:${decl.value}`); });
    }
  });
  assert.deepEqual(family, ['cell padding-inline:0', 'primary padding-inline:var(--sp-1)']);
});

test('ended pages: the notice link is a full target on its own line, and the lone 分享 is the source section\'s last line', () => {
  const css = readFileSync('src/components/local-discovery-detail.css', 'utf8');
  assert.match(css, /\.content-review-ended a \{ display:flex; width:fit-content; align-items:center; min-height:var\(--control-height\); \}/);
  const doc = page('event:half-moon-bay-pumpkin-festival-2026');
  assert.equal(doc.querySelector('section.detail-together'), null, 'no shell without 一起去');
  const source = doc.querySelector('section.detail-source')!;
  const row = source.querySelector(':scope > .detail-share')!;
  assert.ok(row, 'the share row is in 来源与核对');
  assert.equal(row.getAttribute('data-simple'), 'hide');
  assert.equal(row.nextElementSibling, source.querySelector('#page-credits'), 'page credits stay last');
});

test('#page-credits lists every photo on the page, last in the source section; a type cover has no credit', () => {
  for (const key of DETAILS) {
    const doc = page(key);
    const credits = doc.querySelector('details#page-credits');
    const photos = doc.querySelectorAll('.detail-hero[data-tier]:not([data-tier="type"]), .detail-photo').length
      + [...doc.querySelectorAll('.detail-rail__track [data-cover="image"], .detail-rail--side [data-cover="image"]')].length;
    if (!photos) { assert.equal(credits, null, key); continue; }
    assert.ok(credits, key);
    assert.equal(Number(credits.getAttribute('data-count')), credits.querySelectorAll('li').length, key);
    assert.equal(credits.querySelectorAll('li').length, photos, key);
    // B P04 / C P17 (UI9-R2-DETAIL): the list ends the desktop column under 附近还有, and is the page's last line on a phone.
    assert.equal(credits.parentElement!.lastElementChild, credits, `${key}: last in the column's end`);
    assert.ok(credits.closest('.detail-aside-end'), key);
    // UI9 live check 10-20: the footer adds no second 「↑ 本页图片来源」 on a detail; the list is in 来源与核对.
    assert.equal(credits.hasAttribute('data-credits-at-end'), true, 'no footer link on a detail');
  }
});

test('简洁显示 subtracts: the dek, 想约人一起去 with the share row, the long caption and licences, the related rail, 继续发现湾区', () => {
  const doc = page('event:sf-thrive-thrill-o-ween-2026');
  for (const selector of ['.detail-dek', 'section.detail-together', '.discovery-return']) assert.equal(doc.querySelector(selector)?.getAttribute('data-simple'), 'hide', selector);
  const related = doc.querySelector('section[aria-labelledby="detail-related-title"]');
  if (related) assert.equal(related.getAttribute('data-simple'), 'hide');
  for (const kept of ['.detail-hero', '.detail-chips', 'h1', '.detail-facts-card', '.detail-source', '.site-detail-actions']) assert.equal(doc.querySelector(kept)?.closest('[data-simple="hide"]') ?? null, null, kept);
  // The ended page's 接下来可以去 is its content: it stays (as rows) in 简洁显示.
  const ended = page('event:half-moon-bay-pumpkin-festival-2026');
  assert.equal(ended.querySelector('section[aria-labelledby="detail-next-title"]')?.getAttribute('data-simple'), null);
  // One way back at the end for 简洁显示 (the tab bar is hidden on a detail).
  assert.equal(doc.querySelector('nav.detail-back--end a')?.getAttribute('href'), '/events');
});

test('rails: one card anatomy (3:2 cover, line 1 eventWhenLine, line 2 status · place, the ✓ line) and at most three rows', () => {
  // Decision 20: FeedCard's own two-line title clamp on a rail card (no override here); a row card's title is never cut.
  assert.doesNotMatch(readFileSync('src/components/local-discovery-detail.css', 'utf8'), /ui-feed-card__title[^}]*line-clamp/);
  const doc = page('event:half-moon-bay-pumpkin-festival-2026');
  const rail = doc.querySelector('section[aria-labelledby="detail-next-title"]')!;
  const cards = rail.querySelectorAll('.detail-rail__track .ui-feed-card');
  assert.ok(cards.length >= 1 && cards.length <= 4);
  assert.equal(rail.getAttribute('data-count'), String(cards.length));
  for (const card of cards) {
    assert.match(card.querySelector('.ui-feed-card__when')?.textContent || '', /^周[一二三四五六日] \d+\/\d+|\d+\/\d+/);
    assert.ok(card.querySelector('.ui-feed-card__meta')?.textContent, 'line 2');
    assert.match(card.querySelector('.ui-feed-card__trust')?.textContent || '', /官网核对|媒体报道/);
    assert.ok(card.querySelector('[data-cover]'), 'a cover');
  }
  const rows = rail.querySelectorAll('.detail-rail__rows .ui-row-card');
  assert.ok(rows.length <= 3 && rows.length === Math.min(3, cards.length));
  assert.equal(rail.querySelector('.detail-rail__rows a.ui-more')?.getAttribute('href'), '/events');
});

const css = (file: string) => postcss.parse(readFileSync(file, 'utf8'));
test('the bar CSS: keyed on .site-detail-actions.detail-actions, solid, no blur, 56 px cells, fixed at the tab bar height', () => {
  const sheet = css('src/components/local-discovery-detail.css');
  let fixed = false;
  sheet.walkRules((rule: Rule) => {
    if (!/detail-actions/.test(rule.selector)) return;
    for (const part of rule.selectors) assert.match(part, /\.site-detail-actions\.detail-actions/, `keyed: ${part}`);
    rule.walkDecls(decl => {
      assert.notEqual(decl.prop, 'backdrop-filter', rule.selector);
      if (decl.prop === 'position' && decl.value === 'fixed') fixed = true;
      if (decl.prop === 'background') assert.doesNotMatch(decl.value, /color-mix|transparent\)|\/ ?\./, `solid: ${rule.selector}`);
    });
  });
  assert.ok(fixed, 'the phone bar is fixed');
  const text = readFileSync('src/components/local-discovery-detail.css', 'utf8');
  assert.match(text, /min-width:56px; height:56px;/);
  assert.match(text, /height:var\(--site-mobile-nav-height\)/);
  assert.match(text, /html\[data-simple\] \.local-discovery-detail \[data-simple=hide\] \{ display:none; \}/);
});

test('the files this lane styles: tokens for every font size, 400 / 600 only, no all-caps labels (G6)', () => {
  for (const file of ['src/components/local-discovery-detail.css', 'src/components/discovery-community.css', 'src/features/detail/facts-grid.css',
    'src/features/detail/detail-sheet.css', 'src/features/detail/detail-skeleton.css']) {
    css(file).walkDecls(decl => {
      // 0 only where a ::after swaps the words (R2-08: 加入计划 in place of AddToDayPlan's 加入这天计划): no type size.
      const swap = !!decl.parent && (decl.parent as Rule).selector?.endsWith(':has(>.lucide-calendar-plus)') && decl.value === '0';
      if (decl.prop === 'font-size' && !swap) assert.match(decl.value, /^(?:var\(--|inherit$)/, `${file}: ${decl.parent && (decl.parent as Rule).selector} ${decl.value}`);
      if (decl.prop === 'font-weight') assert.match(decl.value, /^(400|600|inherit)$/, `${file}: ${decl.value}`);
      assert.notEqual(decl.prop === 'text-transform' ? decl.value : '', 'uppercase', file);
    });
  }
  for (const file of ['src/components/EditorialShareActions.tsx', 'src/components/EventParticipation.tsx', 'src/features/detail/ShareCardSheet.tsx', 'src/features/detail/BuddiesSheet.tsx', 'src/components/LocalDiscoveryDetail.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /PASS IT ON|GO TOGETHER|discovery-eyebrow/, file);
  }
});

test('in-app loading: the old view for 300 ms, then the detail skeleton, kept at least 400 ms, then the page', async () => {
  const ID = 'oakland-tool-library';
  const BUCKET = detailBucket('offer', ID);
  const original = detailLoaders[BUCKET];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  detailLoaders[BUCKET] = () => gate.then(() => original());
  resetDetailRecords();
  try {
    const view = render(<MemoryRouter initialEntries={[`/offers/${ID}`]}><Suspense fallback={<p>loading</p>}><Routes>
      <Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} />
    </Routes></Suspense></MemoryRouter>);
    assert.ok(view.getByText('loading'), 'the first 300 ms suspend (the app keeps the old page meanwhile)');
    assert.equal(view.container.querySelector('.detail-skeleton'), null);
    const skeleton = await waitFor(() => { const node = view.container.querySelector('.detail-skeleton[aria-busy="true"]'); assert.ok(node); return node; }, { timeout: 5_000 });
    const shownAt = Date.now();
    assert.ok(skeleton.querySelector('.detail-back a[href="/events?view=perks"]'), 'the back link');
    assert.equal(skeleton.querySelectorAll('.detail-skeleton__fact').length, 4);
    assert.equal(view.container.querySelector('.site-detail-actions'), null, 'the bar arrives with the record');
    release();
    await view.findByRole('heading', { level: 1 }, { timeout: 15_000 });
    assert.ok(Date.now() - shownAt >= 380, `the skeleton stayed ${Date.now() - shownAt} ms`);
    assert.equal(view.container.querySelector('.detail-skeleton'), null);
  } finally {
    detailLoaders[BUCKET] = original;
    resetDetailRecords();
  }
});

test('in-app loading, fast path: a record in under 300 ms never shows the skeleton, even when the route re-renders after 300 ms', async t => {
  const ID = 'oakland-tool-library';
  const BUCKET = detailBucket('offer', ID);
  const original = detailLoaders[BUCKET];
  await original(); // the bucket module is cached, so the load below takes microtasks, not a fetch
  let loadedAt = 0;
  detailLoaders[BUCKET] = () => original().then(module => { loadedAt = Date.now(); return module; });
  resetDetailRecords();
  let bump!: () => void;
  function Shell() {
    const [count, setCount] = React.useState(0);
    bump = () => setCount(value => value + 1);
    return <MemoryRouter initialEntries={[`/offers/${ID}`]}><Suspense fallback={<p>loading</p>}><Routes>
      <Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} />
    </Routes></Suspense><output data-count={count} /></MemoryRouter>;
  }
  const { act } = await import('@testing-library/react');
  let skeletons = 0;
  const observer = new dom.window.MutationObserver(() => { if (document.querySelector('.detail-skeleton')) skeletons++; });
  observer.observe(document.body, { childList: true, subtree: true });
  try {
    const mountedAt = Date.now();
    const view = render(<Shell />);
    const heading = await view.findByRole('heading', { level: 1 }, { timeout: 15_000 });
    // A loaded machine: the fast path was not exercised, and the run says so (the slow path has its own test).
    if (loadedAt - mountedAt >= 250) { t.skip(`load too slow to exercise the fast path (${loadedAt - mountedAt} ms)`); return; }
    await new Promise(resolve => { setTimeout(resolve, Math.max(0, mountedAt + 420 - Date.now())); });
    await act(async () => { bump(); });
    await new Promise(resolve => { setTimeout(resolve, 400); });
    await act(async () => { bump(); });
    assert.equal(skeletons, 0, 'no skeleton over a page already on screen');
    assert.equal(view.container.querySelector('.detail-skeleton'), null);
    assert.equal(view.getByRole('heading', { level: 1 }), heading, 'the page was not remounted');
  } finally {
    observer.disconnect();
    detailLoaders[BUCKET] = original;
    resetDetailRecords();
  }
});
