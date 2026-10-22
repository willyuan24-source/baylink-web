import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * UI9-FREE: the 免费与优惠 and 新店 boards and the deals board (content arrangement 10-19). One card anatomy (title, line 1
 * when, line 2 status · condition · place), one status look from C's map, sections by end date and by opening, the source
 * line (媒体报道 for a press source, DECISIONS 17), rows and two Sheet chips in 简洁显示, and the boards' own stylesheet.
 */
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, waitFor, within, fireEvent } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const model = await import('../src/features/events/events-model');
const boards = await import('../src/features/events/board-status');
const { OfferFeedCard, OpeningFeedCard } = await import('../src/features/events/BoardCards');
const { statusLook } = await import('../src/components/ui/Status');
const { openingChip } = await import('../src/lib/event-facts');
const { FreebieBoard } = await import('../src/components/FreebieBoard');
const { checkEditorialStyles } = await import('../scripts/check-editorial-styles.mjs');
const { createCoverPage, resolveCovers } = await import('../src/lib/cover');
type IndexOffer = import('../src/features/events/events-index-types').IndexOffer;
type IndexOpening = import('../src/features/events/events-index-types').IndexOpening;
const { cssLoadGraph } = await import('../scripts/check-style-ratchet.mjs');

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; dom.window.document.documentElement.removeAttribute('data-simple'); });
const today = '2026-10-19';
const typeCover = { tier: 'type', reason: 'no-image' } as never;
type Offer = (typeof model.INDEX_OFFERS)[number];
const offer = (over: Partial<Offer> = {}): Offer => ({ id: 'x', brand: 'Brand', title: '测试优惠', availability: 'dated', kind: 'no-purchase', imageKey: 'none', sourceLabel: 'Brand 官网', verifiedAt: '2026-10-07', ...over } as Offer);
const card = (node: React.ReactNode) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/events">{node}</StaticRouter>));

test('line 1 of an offer says when in one M/D pattern; never the free-text label or an ISO date', () => {
  const when = (over: Partial<Offer>) => boards.offerWhen(offer(over), today);
  assert.deepEqual(when({ startDate: '2026-10-25', endDate: '2026-10-25' }), { zh: '周日 10/25', en: 'Sun, Oct 25' });
  assert.deepEqual(when({ startDate: '2026-10-24', endDate: '2026-10-31' }), { zh: '10/24–31', en: 'Oct 24–31' }, 'a run not yet started: both ends');
  assert.deepEqual(when({ startDate: '2026-10-01', endDate: '2026-11-11' }), { zh: '至 11/11', en: 'Until Nov 11' }, 'a run under way: its end');
  assert.deepEqual(when({ endDate: '2026-11-11' }), { zh: '至 11/11', en: 'Until Nov 11' });
  assert.deepEqual(when({ availability: 'ongoing', weekdays: [3] }), { zh: '每周三', en: 'Every Wed' });
  assert.deepEqual(when({ availability: 'dated', startDate: '2026-10-05', endDate: '2026-10-26', weekdays: [1] }), { zh: '每周一\u00a0· 至 10/26', en: 'Every Mon\u00a0· until Oct 26' });
  assert.deepEqual(when({ availability: 'ongoing' }), { zh: '长期有效', en: 'Ongoing' });
  assert.deepEqual(when({ availability: 'check-local' }), { zh: '日期以官网为准', en: 'Dates on the official site' });
  // Not started yet: a weekly offer says from when (so "每周三" never reads as usable this week); so does an undated one.
  assert.deepEqual(when({ availability: 'ongoing', weekdays: [3], startDate: '2026-11-04' }), { zh: '每周三\u00a0· 11/4 起', en: 'Every Wed\u00a0· from Nov 4' });
  // ...and when it also ends, the whole run, so the reader sees that it stops.
  assert.deepEqual(when({ availability: 'dated', weekdays: [3], startDate: '2026-11-04', endDate: '2026-11-25' }), { zh: '每周三\u00a0· 11/4–25', en: 'Every Wed\u00a0· Nov 4–25' });
  assert.deepEqual(when({ availability: 'dated', weekdays: [3], startDate: '2026-10-28', endDate: '2026-11-25' }), { zh: '每周三\u00a0· 10/28–11/25', en: 'Every Wed\u00a0· Oct 28–Nov 25' });
  assert.deepEqual(when({ availability: 'check-local', startDate: '2026-11-04' }), { zh: '11/4 起', en: 'From Nov 4' });
  assert.deepEqual(when({ availability: 'ongoing', startDate: '2026-11-04' }), { zh: '11/4 起', en: 'From Nov 4' });
  for (const item of model.liveOffers(model.INDEX_OFFERS, today)) {
    const line = boards.offerWhen(item, today);
    assert.doesNotMatch(`${line.zh} ${line.en}`, /\d{4}-\d{2}-\d{2}/, item.id);
    assert.doesNotMatch(line.zh, /^·/, item.id);
  }
});

test('one status per offer card, in C\'s map: 已售罄 · 今天/明天截止 · 还剩 N 天 once started, otherwise none', () => {
  const chip = (over: Partial<Offer>) => boards.offerChip(offer(over), today);
  const cases: [Partial<Offer>, string | null, string | null][] = [
    [{ status: 'sold_out', availability: 'check-local', startDate: '2026-09-30' }, '已售罄', 'urgent'],
    [{ startDate: '2026-10-01', endDate: today }, '今天截止', 'urgent'],
    [{ startDate: '2026-10-01', endDate: '2026-10-20' }, '明天截止', 'urgent'],
    [{ startDate: '2026-10-01', endDate: '2026-10-24' }, '还剩 5 天', 'soon'],
    [{ endDate: '2026-10-26' }, '还剩 7 天', 'soon'],
    [{ startDate: '2026-10-25', endDate: '2026-10-25' }, null, null],
    [{ startDate: '2026-10-01', endDate: '2026-10-30' }, null, null],
    [{ availability: 'ongoing' }, null, null],
  ];
  for (const [over, text, tone] of cases) {
    const result = chip(over);
    assert.equal(result?.text.zh ?? null, text, JSON.stringify(over));
    assert.equal(result?.tone ?? null, tone, JSON.stringify(over));
    // The words take the same look in C's StatusChip whatever tone a caller passes: one look per status.
    if (result) for (const words of [result.text.zh, result.text.en]) assert.equal(statusLook('neutral', words), result.tone, words);
  }
  // Openings: openingChip unchanged; a shop open on its day takes the 已开业 look, the rest neutral.
  for (const shop of model.INDEX_OPENINGS) {
    const status = boards.openingStatus(shop, today);
    assert.deepEqual(status.text, openingChip(shop, today), shop.id);
    assert.equal(statusLook('neutral', status.text.zh), status.tone, `${shop.id}: ${status.text.zh}`);
  }
});

test('every offer and opening card has two meta lines; a sold-out offer prints 已售罄 once; a press source reads 媒体报道', () => {
  const sold = model.INDEX_OFFERS.find(item => item.status === 'sold_out')!;
  const soldCard = card(<OfferFeedCard offer={sold} cover={typeCover} today={today} />);
  assert.equal(soldCard.querySelector('.ui-feed-card__when')!.textContent, '日期以官网为准');
  const urgent = soldCard.querySelectorAll('.ui-feed-card__meta .ui-status[data-tone="urgent"]');
  assert.equal(urgent.length, 1);
  assert.equal(urgent[0].textContent, '已售罄');
  assert.equal(soldCard.textContent!.split('已售罄').length - 1, 1, 'printed once');
  assert.doesNotMatch(soldCard.querySelector('.ui-feed-card__meta')!.textContent!, /商家活动|免费福利/);
  for (const item of model.liveOffers(model.INDEX_OFFERS, today).slice(0, 40)) {
    const fragment = card(<OfferFeedCard offer={item} cover={typeCover} today={today} />);
    for (const line of ['.ui-feed-card__when', '.ui-feed-card__meta']) {
      const text = fragment.querySelector(line)?.textContent ?? '';
      assert.ok(text.trim(), `${item.id} ${line}`);
      assert.doesNotMatch(text, /^\s*·/, `${item.id} ${line}`);
    }
    assert.doesNotMatch(fragment.textContent!, /人工核对/);
  }
  const press = model.INDEX_OPENINGS.find(shop => /^媒体报道/.test(shop.sourceLabel))!;
  const official = model.INDEX_OPENINGS.find(shop => shop.id === 'marufuku-burlingame-announced')!;
  const pressCard = card(<OpeningFeedCard opening={press} cover={typeCover} today={today} />);
  assert.match(pressCard.querySelector('.ui-feed-card__trust')!.textContent!, /^媒体报道\u00a0· \d+\/\d+ 核对$/);
  assert.doesNotMatch(pressCard.textContent!, /官网核对/);
  const marufuku = card(<OpeningFeedCard opening={official} cover={typeCover} today={today} />);
  assert.equal(marufuku.querySelector('.ui-feed-card__when .ui-status')!.getAttribute('data-tone'), 'open');
  assert.equal(marufuku.querySelector('.ui-feed-card__when')!.textContent, '10/11 已开业');
  // CNT-SIGNBOARD (web #54) gave each opening what it sells: Marufuku's 拉面 is now 博多豚骨拉面.
  assert.equal(marufuku.querySelector('.ui-feed-card__meta')!.textContent, 'Burlingame\u00a0· 博多豚骨拉面');
  assert.match(marufuku.querySelector('.ui-feed-card__trust')!.textContent!, /^官网核对 \d+\/\d+$/);
  for (const shop of model.INDEX_OPENINGS) {
    const fragment = card(<OpeningFeedCard opening={shop} cover={typeCover} today={today} />);
    assert.ok(fragment.querySelector('.ui-feed-card__when .ui-status'), shop.id);
    assert.doesNotMatch(fragment.querySelector('.ui-feed-card__meta')!.textContent!, /^\s*·|·\s*$|开业预告|已营业 ·/, shop.id);
  }
});

test('the source line: a label that starts with 媒体报道 · is press (the site\'s one prefix rule); data and labels are untouched', () => {
  // UI9-INT (captain 10-20): press-only records carry the 「媒体报道 · 」 prefix in the data (web #54); every card tests
  // that prefix, never a /报道/ or outlet regex (tests/ui9-int-press-rule.test.ts holds the cross-site cases).
  assert.equal(boards.pressSourced('媒体报道 · sfgate.com'), true);
  assert.equal(boards.pressSourced('媒體報導 · sfchronicle.com'), true);
  assert.equal(boards.pressSourced('Flora 官网；Eater SF 项目地址报道'), false, 'the shop\'s own page is named');
  assert.equal(boards.pressSourced('SFist 9/21 开门报道 · 品牌门店页交叉核对'), false);
  assert.equal(boards.pressSourced('Nosh 9/8 试营业报道 · The Game Parlour 官网'), false);
  assert.equal(boards.pressSourced('Marufuku Burlingame 官方开业日期与地址'), false);
  assert.equal(boards.pressSourced('Westfield Valley Fair'), false);
  for (const label of ['Polly Klaas Community Theater', 'petalumapumpkinpatch.com', 'The San Francisco Standard · Sundown Cinema']) assert.equal(boards.pressSourced(label), false, label);
  assert.equal(boards.openingSells('开业预告 · 社区餐酒馆'), '社区餐酒馆');
  assert.equal(boards.openingSells('已营业 · 澳式寿司卷'), '澳式寿司卷');
  assert.equal(boards.openingSells('拉面'), '拉面');
});

test('the boards\' sections: 这 7 天 / 7 天以后 / 长期有效 with sold-out offers last; 已开业 (newest first day first) / 即将开业', () => {
  const offers = model.liveOffers(model.INDEX_OFFERS, today);
  const sections = boards.offerSections(offers, today);
  assert.deepEqual(sections.map(section => section.id), ['week', 'later', 'ongoing']);
  assert.equal(sections.reduce((sum, section) => sum + section.offers.length, 0), offers.length);
  for (const section of sections) {
    const sold = section.offers.findIndex(item => item.status === 'sold_out');
    if (sold >= 0) assert.ok(section.offers.slice(sold).every(item => item.status === 'sold_out'), `${section.id}: sold out last`);
  }
  assert.ok(sections[2].offers.every(item => !item.endDate), '长期有效 has no end date');
  const shops = boards.openingSections(model.INDEX_OPENINGS, today);
  assert.deepEqual(shops.map(section => section.id), ['open', 'soon']);
  assert.equal(shops[0].openings[0].id, 'marufuku-burlingame-announced', 'the newest dated first day leads');
  assert.equal(shops[0].openings.length + shops[1].openings.length, model.INDEX_OPENINGS.length);
  assert.ok(shops[1].openings.every(shop => shop.status === 'announced' || (shop.openedOn ?? '') > today));
});

test('简洁显示: rows without ♡, at most 3 per section, no sold-out offer, two Sheet chips and one guide link', async () => {
  localStorage.setItem('baylink.simple-display.v1', '1');
  dom.window.document.documentElement.setAttribute('data-simple', '');
  const view = render(<MemoryRouter initialEntries={['/events?view=perks']}><EventsView today={today} /></MemoryRouter>);
  await waitFor(() => assert.ok(view.container.querySelector('.fb-rows .ui-row-card')));
  const board = view.container.querySelector('.fb-board')!;
  for (const list of board.querySelectorAll('.fb-rows')) assert.ok(list.querySelectorAll('.ui-row-card').length <= 3);
  assert.equal(board.querySelector('.saves-control, .ui-feed-card__save'), null, 'no ♡ on the rows (DECISIONS 16)');
  assert.doesNotMatch(board.textContent!, /已售罄/);
  assert.equal(board.querySelector('.fb-kinds'), null, 'no sideways chip row');
  const chips = [...board.querySelectorAll('.fb-filters > .ui-chip')];
  assert.deepEqual(chips.map(chip => chip.getAttribute('aria-haspopup')), ['dialog', 'dialog']);
  assert.deepEqual(chips.map(chip => chip.textContent), ['整个湾区', '全部条件']);
  assert.equal(board.querySelectorAll('nav.ev-end a').length, 1, 'one guide link');
  // Every count is taken from the list the sections show (no sold-out offers in 简洁): the Sheet footers and the status line.
  const listed = () => [...board.querySelectorAll('.fb-section__count')].reduce((sum, head) => sum + Number(head.textContent!.match(/\d+/)![0]), 0);
  fireEvent.click(chips[0]);
  const regions = await view.findByRole('dialog', { name: '选择地区' });
  fireEvent.click(within(regions).getByRole('button', { name: `显示 ${listed()} 条` }));
  fireEvent.click(chips[1]);
  const sheet = await view.findByRole('dialog', { name: '按领取条件筛选' });
  fireEvent.click(within(sheet).getByRole('button', { name: '需预约', exact: true }));
  await waitFor(() => assert.match(board.querySelector('.fb-status')!.textContent!, /^需预约 · \d+ 条$/));
  // The one sold-out offer asks for a purchase: 消费优惠 is where a count that included it would be one too many.
  fireEvent.click(within(sheet).getByRole('button', { name: '消费优惠', exact: true }));
  await waitFor(() => assert.match(board.querySelector('.fb-status')!.textContent!, /^消费优惠 · \d+ 条$/));
  assert.equal(board.querySelector('.fb-status')!.textContent, `消费优惠 · ${listed()} 条`);
  assert.ok(within(sheet).getByRole('button', { name: `显示 ${listed()} 条` }));
});

test('家人版 (简洁 at 特大): 2 rows per section on both boards; each section\'s 再看 N 条 lists the rest (page ≤ 1.0× standard)', async () => {
  localStorage.setItem('baylink.simple-display.v1', '1');
  localStorage.setItem('baylink.reading-size.v1', 'extra-large');
  dom.window.document.documentElement.setAttribute('data-simple', '');
  for (const view of ['perks', 'openings']) {
    const page = render(<MemoryRouter initialEntries={[`/events?view=${view}`]}><EventsView today={today} /></MemoryRouter>);
    await waitFor(() => assert.ok(page.container.querySelector('.fb-rows .ui-row-card')));
    const sections = [...page.container.querySelectorAll('.fb-section')];
    assert.ok(sections.length >= 2, view);
    for (const section of sections) {
      const rows = section.querySelectorAll('.ui-row-card').length;
      const total = Number(section.querySelector('.fb-section__count')!.textContent!.match(/\d+/)![0]);
      assert.equal(rows, Math.min(2, total), `${view}: ${section.querySelector('h2')!.textContent}`);
      assert.equal(section.querySelector('.ev-more button')?.textContent, total > 2 ? `再看 ${Math.min(12, total - 2)} ${view === 'perks' ? '条' : '家'}` : undefined);
    }
    page.unmount();
  }
});

test('the boards\' stylesheet: fb- names only, no ellipsis or faded :disabled, editorial guard with contrast, loaded lazily', () => {
  const css = readFileSync('src/features/events/boards.css', 'utf8');
  const tokens = readFileSync('src/tokens.css', 'utf8');
  const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map(match => match[1].trim()).filter(selector => !selector.startsWith('@'));
  for (const selector of selectors) assert.match(selector, /\.fb-/, `every rule is scoped to the boards: ${selector}`);
  for (const file of ['src/features/events/boards.css', 'src/components/freebie-board.css', 'src/components/perks-gallery.css']) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /text-overflow\s*:\s*ellipsis/, file);
    assert.doesNotMatch(text, /:disabled[^{]*\{[^}]*opacity/, file);
    assert.deepEqual(checkEditorialStyles([{ file, text }], tokens, { contrast: true }), [], file);
  }
  const graph = cssLoadGraph();
  assert.ok(graph.lazy.includes('src/features/events/boards.css') && !graph.global.includes('src/features/events/boards.css'));
});

test('the deals board prints 官网核对 M/D (媒体报道 for a press source), never 人工核对, and no all-caps eyebrow', () => {
  const base = { id: 'a', brand: 'BRAND', title: '一份优惠', dateLabel: '长期', availability: 'ongoing', kind: 'no-purchase', requirement: '到店领取。', description: '说明。', imageKey: 'none', sourceUrl: 'https://example.com', sourceLabel: 'Brand 官方说明', verifiedAt: '2026-10-07' } as const;
  const html = renderToStaticMarkup(<FreebieBoard offers={[base, { ...base, id: 'b', title: '报道里的优惠', sourceLabel: '媒体报道 · sfgate.com' }]} today={today} />);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('#offer-a .bl-freebie-verified')!.textContent, '官网核对 10/7');
  assert.equal(doc.querySelector('#offer-b .bl-freebie-verified')!.textContent, '媒体报道\u00a0· 10/7 核对');
  assert.doesNotMatch(html, /人工核对|核对 2026-|LITTLE PERKS|SAVE &amp; SHARE/);
  assert.equal(doc.querySelector('.bl-freebie-card-brand')!.textContent, 'Brand', 'the brand in normal case (400)');
  assert.equal(doc.querySelectorAll('[role="radiogroup"][aria-label="按日期筛选"] .ui-chip[role="radio"]').length, 2, '本周有效 | 全部日期 is one radio group of F’s chips');
  const rules = (file: string) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const css = rules('src/components/freebie-board.css');
  assert.doesNotMatch(css, /letter-spacing/);
  assert.doesNotMatch(css.replace(/@media \(hover:hover\) and \(pointer:fine\) \{[\s\S]*?\n\}/g, ''), /:hover/, 'every :hover is gated');
  assert.doesNotMatch(rules('src/components/perks-gallery.css'), /letter-spacing|scale\(1\.0/);
});

test('line 2 of an English opening card keeps what the shop sells after the leading word is dropped', async () => {
  const { loadLocale, setLocale } = await import('../src/i18n/locale');
  await loadLocale('en');
  await setLocale('en', false);
  try {
    // CNT-SIGNBOARD (web #54) rewrote every opening's category to what it sells, without a leading status word
    // (Yutori: 新餐厅 · 日式晚餐 → 加州风味日本菜); the strip is still pinned on its own.
    const yutori = model.INDEX_OPENINGS.find(shop => shop.id === 'yutori-palo-alto-restaurant');
    assert.ok(yutori);
    const meta = card(<OpeningFeedCard opening={yutori} cover={typeCover} today={today} />).querySelector('.ui-feed-card__meta')!.textContent!;
    assert.match(meta, /· California-style Japanese food$/);
    assert.equal(boards.openingSells('新餐厅 · 日式晚餐'), '日式晚餐');
    assert.equal(boards.openingSells('Upcoming · Neighborhood pub and restaurant'), 'Neighborhood pub and restaurant');
  } finally { await setLocale('zh-Hans', false); }
});

test('the coded-cover note prints once per board, under the last section, on cards and on rows (H12 / SV13-02)', async () => {
  const css = readFileSync('src/features/events/boards.css', 'utf8');
  assert.match(css, /\.fb-board \.ui-feed>\.ui-cover-credit \{ display:none; \}/, 'each grid\'s own copy is hidden');
  assert.doesNotMatch(css, /:not\(:last-child\)/);
  for (const simple of [false, true]) {
    if (simple) {
      localStorage.setItem('baylink.simple-display.v1', '1');
      dom.window.document.documentElement.setAttribute('data-simple', '');
    }
    for (const view of ['perks', 'openings']) {
      const page = render(<MemoryRouter initialEntries={[`/events?view=${view}`]}><EventsView today={today} /></MemoryRouter>);
      await waitFor(() => assert.ok(page.container.querySelector('.fb-section')));
      const board = page.container.querySelector('.fb-board')!;
      assert.ok(board.querySelector(simple ? '.fb-rows' : '.ui-feed'), `${view}: ${simple ? 'rows' : 'cards'}`);
      const notes = [...board.querySelectorAll('.ui-cover-credit')].filter(note => !note.closest('.ui-feed'));
      // The note explains information cards; since the owner approved AI covers (2026-10-21) a board can have none.
      const typed = board.querySelectorAll('[data-cover="type"]').length;
      assert.equal(notes.length, typed ? 1 : 0, `${view} (简洁 ${simple}): one note for the board when it has an information card`);
      if (typed) {
        assert.equal(notes[0].previousElementSibling?.className, 'fb-sections', 'under the last section');
        assert.match(notes[0].textContent!, /^没有照片的条目用 BAYLINK 信息卡/);
      }
      page.unmount();
    }
  }
});

test('no wrapped title, meta, row or credit line starts with "·", in zh and in English: every " · " is glued (N06)', async () => {
  // An ordinary space before the dot is where a line may break; the boards glue it with a no-break space instead. In English
  // the words are translated first and glued after, so the dictionary's own " · " ("… · through October 31, 2026") is glued too.
  const loose = / ·/;
  const lines = '.ui-feed-card__title, .ui-feed-card__when, .ui-feed-card__meta, .ui-feed-card__trust, .ui-row-card__title, .ui-row-card__date, .ui-row-card__meta, .ui-row-card__credit';
  const photo = (kind: 'offer' | 'opening', item: { id: string; imageKey?: string }) => resolveCovers([{ kind, id: item.id, imageKey: item.imageKey }], { ...model.coverContext(today), page: createCoverPage() })[0];
  const { getGuideBySlug } = await import('../src/data/guides');
  await (await import('../src/features/guides/guide-blocks')).preloadAllGuideBlocks();
  const { loadLocale, setLocale } = await import('../src/i18n/locale');
  await loadLocale('en');
  let glued = 0;
  try {
    for (const locale of ['zh-Hans', 'en'] as const) {
      await setLocale(locale, false);
      for (const item of model.liveOffers(model.INDEX_OFFERS, today)) {
        for (const row of [false, true]) {
          for (const line of card(<OfferFeedCard offer={item} cover={photo('offer', item)} today={today} row={row} />).querySelectorAll(lines)) {
            assert.doesNotMatch(line.textContent!, loose, `${locale} ${item.id}: ${line.textContent}`);
          }
        }
      }
      for (const shop of model.INDEX_OPENINGS) {
        for (const row of [false, true]) {
          const title = card(<OpeningFeedCard opening={shop} cover={photo('opening', shop)} today={today} row={row} />);
          for (const line of title.querySelectorAll(lines)) assert.doesNotMatch(line.textContent!, loose, `${locale} ${shop.id}: ${line.textContent}`);
          if (shop.name.includes(' · ')) glued += title.querySelector(row ? '.ui-row-card__title' : '.ui-feed-card__title')!.textContent!.includes('\u00a0· ') ? 1 : 0;
        }
      }
      // The deals board: brand, title, the record's date words, the status line, the source line and the picture's credit line.
      for (const slug of ['bay-area-freebies-deals-2026-11', 'bay-area-retail-freebies-family-deals']) {
        for (const block of getGuideBySlug(slug)!.blocks.filter(item => item.type === 'freebies')) {
          const offers = (block as unknown as { offers: Parameters<typeof FreebieBoard>[0]['offers'] }).offers;
          const doc = new JSDOM(renderToStaticMarkup(<FreebieBoard offers={offers} today={today} initialDates="all" sectionSize={Infinity} />)).window.document;
          const parts = doc.querySelectorAll('.bl-freebie-card-brand, .bl-freebie-card h4, .bl-freebie-card-date, .bl-freebie-card-tags, .bl-freebie-verified, .bl-freebie-credit');
          assert.ok(parts.length > 20, slug);
          for (const part of parts) assert.doesNotMatch(part.textContent!, loose, `${locale} ${slug}: ${part.textContent}`);
          if (locale === 'zh-Hans') for (const credit of doc.querySelectorAll('.bl-freebie-credit')) assert.match(credit.textContent!, /^(官方图|资料图|照片|BAYLINK 实拍)[^·]*(\u00a0· \d{4}( 往届)?)?$/, `${slug}: the credit line says what the picture is (G13): ${credit.textContent}`);
          if (locale === 'en') assert.ok([...doc.querySelectorAll('.bl-freebie-card-date')].some(date => /[a-z]\u00a0· through /.test(date.textContent!)), `${slug}: the translated date words keep the glue`);
          // 本周有效: the results line's "· 本周有效至 10/25 周日" is glued to the count before it.
          const week = new JSDOM(renderToStaticMarkup(<FreebieBoard offers={offers} today={today} initialDates="week" />)).window.document;
          assert.match(week.querySelector('.bl-freebie-results span + span')!.textContent!, /^\u00a0· /, `${locale} ${slug}: the results line`);
        }
      }
    }
  } finally { await setLocale('zh-Hans', false); }
  // Openings whose own name carries " · " ("Marufuku Ramen · Burlingame"): the title keeps the glue on cards and rows, both locales.
  assert.ok(glued >= 4 * 2 * 2, `glued titles: ${glued}`);
});

test('an empty filter offers one primary that widens the narrower filter, with its count, and no empty section head', async () => {
  const offers = model.INDEX_OFFERS as IndexOffer[];
  const openings = model.INDEX_OPENINGS as IndexOpening[];
  const savedOffers = offers.splice(0), savedOpenings = openings.splice(0);
  const primary = (root: Element) => [...root.querySelectorAll('.ui-button[data-variant="primary"]')];
  try {
    // A region with nothing in it widens the region (only San Francisco's offers and shops are left).
    offers.push(...savedOffers.filter(item => item.region === 'sf'));
    openings.push(...savedOpenings.filter(item => item.region === 'sf'));
    const sf = model.liveOffers(offers, today).length;
    for (const [view, words] of [['perks', `看整个湾区的优惠（${sf}）`], ['openings', `看整个湾区的新店（${openings.length}）`]] as const) {
      const page = render(<MemoryRouter initialEntries={[`/events?view=${view}&region=south-bay`]}><EventsView today={today} /></MemoryRouter>);
      await waitFor(() => assert.equal(primary(page.container.querySelector('.fb-board') ?? page.container).length, 1, view));
      const board = page.container.querySelector('.fb-board')!;
      assert.equal(board.querySelector('.fb-section__head'), null, `${view}: no empty section head`);
      assert.deepEqual(primary(board).map(button => button.textContent), [words], view);
      fireEvent.click(primary(board)[0]);
      await waitFor(() => assert.ok(board.querySelector('.fb-section__head'), `${view}: widened to the whole Bay Area`));
      page.unmount();
    }
    // A condition with nothing in it widens the condition (no 需预约 offer is left).
    offers.splice(0, offers.length, ...savedOffers.filter(item => item.kind !== 'reservation'));
    const all = model.liveOffers(offers, today).length;
    const page = render(<MemoryRouter initialEntries={['/events?view=perks&region=all']}><EventsView today={today} /></MemoryRouter>);
    await waitFor(() => assert.ok(page.container.querySelector('.fb-section')));
    const board = page.container.querySelector('.fb-board')!;
    fireEvent.click(within(board.querySelector('.fb-kinds') as HTMLElement).getByRole('button', { name: '需预约' }));
    await waitFor(() => assert.equal(board.querySelector('.fb-section__head'), null));
    assert.deepEqual(primary(board).map(button => button.textContent), [`看整个湾区的全部优惠（${all}）`]);
    fireEvent.click(primary(board)[0]);
    await waitFor(() => assert.ok(board.querySelector('.fb-section__head')));
    assert.equal(board.querySelector('.fb-kinds [aria-pressed="true"]')!.textContent, '全部');
  } finally {
    offers.splice(0, offers.length, ...savedOffers);
    openings.splice(0, openings.length, ...savedOpenings);
  }
});

test('简洁 and 家人版 rows keep the 示意图 / AI 示意图 words on a ③ category photo and an approved AI cover (UI9-IMAGES DECISIONS 23)', async () => {
  // A row thumbnail shows no chip once the row has a source line (covers.css), and 简洁 drops a ①② photo's words; a ③
  // picture still says 示意图 and a ④ one AI 示意图 in every size and mode, so their words stay in the row's source line.
  const { images } = model.coverContext(today);
  const aiKey = Object.keys(images).find(key => images[key].aiCoverApproved);
  const stockKey = Object.keys(images).find(key => key.startsWith('stock-'));
  assert.ok(aiKey, 'the events index carries an approved AI illustration');
  assert.ok(stockKey, 'the events index carries a category photo');
  const resolve = (kind: 'offer' | 'opening', id: string, imageKey: string) => resolveCovers([{ kind, id, imageKey }], { ...model.coverContext(today), page: createCoverPage() })[0];
  const offer = model.INDEX_OFFERS[0];
  const shop = model.INDEX_OPENINGS[0];
  const pictures = [
    { tier: 'ai', key: aiKey, words: { 'zh-Hans': /AI 示意图/, en: /AI (?:image|illustration)/ } },
    { tier: 'stock', key: stockKey, words: { 'zh-Hans': /(?<!AI )示意图/, en: /Illustrative photo|Stock photo/ } },
  ] as const;
  const { loadLocale, setLocale } = await import('../src/i18n/locale');
  await loadLocale('en');
  try {
    for (const { tier, key, words } of pictures) {
      const offerCover = resolve('offer', offer.id, key);
      const shopCover = resolve('opening', shop.id, key);
      assert.equal(offerCover.tier, tier, key);
      assert.equal(shopCover.tier, tier, key);
      for (const locale of ['zh-Hans', 'en'] as const) {
        await setLocale(locale, false);
        for (const simple of [false, true]) {
          const rows = {
            offer: card(<OfferFeedCard offer={offer} cover={offerCover} today={today} row simple={simple} />),
            opening: card(<OpeningFeedCard opening={shop} cover={shopCover} today={today} row simple={simple} />),
          };
          for (const [kind, row] of Object.entries(rows)) {
            assert.match(row.querySelector('.ui-row-card__credit')?.textContent ?? '', words[locale], `${locale} ${kind} row (简洁 ${simple}) names the ${tier} picture`);
          }
        }
      }
    }
  } finally {
    await setLocale('zh-Hans', false);
  }
});
