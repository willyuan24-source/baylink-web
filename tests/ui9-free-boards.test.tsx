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
  assert.deepEqual(when({ availability: 'dated', startDate: '2026-10-05', endDate: '2026-10-26', weekdays: [1] }), { zh: '每周一 · 至 10/26', en: 'Every Mon · until Oct 26' });
  assert.deepEqual(when({ availability: 'ongoing' }), { zh: '长期有效', en: 'Ongoing' });
  assert.deepEqual(when({ availability: 'check-local' }), { zh: '日期以官网为准', en: 'Dates on the official site' });
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
  assert.equal(marufuku.querySelector('.ui-feed-card__meta')!.textContent, 'Burlingame\u00a0· 拉面');
  assert.match(marufuku.querySelector('.ui-feed-card__trust')!.textContent!, /^官网核对 \d+\/\d+$/);
  for (const shop of model.INDEX_OPENINGS) {
    const fragment = card(<OpeningFeedCard opening={shop} cover={typeCover} today={today} />);
    assert.ok(fragment.querySelector('.ui-feed-card__when .ui-status'), shop.id);
    assert.doesNotMatch(fragment.querySelector('.ui-feed-card__meta')!.textContent!, /^\s*·|·\s*$|开业预告|已营业 ·/, shop.id);
  }
});

test('the source line: a press label without the shop\'s own page is press; data and labels are untouched', () => {
  assert.equal(boards.pressSourced('媒体报道 · sfgate.com'), true);
  assert.equal(boards.pressSourced('Eater SF · Hotel De Anza 餐饮预告'), true);
  assert.equal(boards.pressSourced('The San Francisco Standard · 8 月 31 日'), true);
  assert.equal(boards.pressSourced('Flora 官网；Eater SF 项目地址报道'), false, 'the shop\'s own page is named');
  assert.equal(boards.pressSourced('SFist 9/21 开门报道 · 品牌门店页交叉核对'), false);
  assert.equal(boards.pressSourced('Marufuku Burlingame 官方开业日期与地址'), false);
  assert.equal(boards.pressSourced('Westfield Valley Fair'), false);
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
  fireEvent.click(chips[1]);
  const sheet = await view.findByRole('dialog', { name: '按领取条件筛选' });
  fireEvent.click(within(sheet).getByRole('button', { name: '需预约', exact: true }));
  await waitFor(() => assert.match(board.querySelector('.fb-status')!.textContent!, /^需预约 · \d+ 条$/));
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
  assert.equal(doc.querySelector('#offer-b .bl-freebie-verified')!.textContent, '媒体报道 · 10/7 核对');
  assert.doesNotMatch(html, /人工核对|核对 2026-|LITTLE PERKS|SAVE &amp; SHARE/);
  assert.equal(doc.querySelector('.bl-freebie-card-brand')!.textContent, 'Brand', 'the brand in normal case (400)');
  assert.ok(doc.querySelector('[role="radiogroup"][aria-label="按日期筛选"]'), '本周有效 | 全部日期 is a SegmentedControl');
  const rules = (file: string) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const css = rules('src/components/freebie-board.css');
  assert.doesNotMatch(css, /letter-spacing/);
  assert.doesNotMatch(css.replace(/@media \(hover:hover\) and \(pointer:fine\) \{[\s\S]*?\n\}/g, ''), /:hover/, 'every :hover is gated');
  assert.doesNotMatch(rules('src/components/perks-gallery.css'), /letter-spacing|scale\(1\.0/);
});
