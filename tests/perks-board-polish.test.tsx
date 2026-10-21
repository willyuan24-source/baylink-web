// PERKS-BOARD (G26, G72): the deals board opens on 本周有效 with six cards per kind and 看全部 N 条, shows a picture once
// per page, makes phone numbers tappable, keeps every label at 13px or more on the ink tokens, and the saved posters
// load as 480 / 800 WebP rungs (≤ 60 KB on a phone) instead of 200 KB PNGs.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import type { FreebieOffer } from '../src/components/FreebieBoard';
import type { GuideImage } from '../src/data/guide-media';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { StaticRouter } = await import('react-router-dom');
const { FreebieBoard, FREEBIE_SECTION_SIZE } = await import('../src/components/FreebieBoard');
const { addDays, validThisWeek, weekEndOf } = await import('../src/lib/offer-week');
const { PerksGallery } = await import('../src/components/PerksGallery');
const { GuideHeader } = await import('../src/features/guides/GuideHeader');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { getGuideBySlug, guides } = await import('../src/data/guides');
const { perksPosters, perksPosterRung } = await import('../src/data/perks-posters');
const { editorialStyleScopes } = await import('../scripts/check-editorial-styles.mjs');
afterEach(() => { cleanup(); delete GUIDE_IMAGES['perks-test-photo']; });

const photo: GuideImage = { src: '/test/perks-photo.webp', alt: '门店资料照片', caption: '资料照片。', credit: '示例 · 资料照片', creditUrl: 'https://example.com/photo', kind: 'photo', width: 1200, height: 800 };
const offer = (id: string, extra: Partial<FreebieOffer> = {}): FreebieOffer => ({
  id, brand: `Brand ${id}`, title: `优惠 ${id}`, dateLabel: '长期', availability: 'ongoing', kind: 'no-purchase',
  requirement: `条件 ${id}`, description: `说明 ${id}`, imageKey: 'missing-image', sourceUrl: `https://example.com/${id}`, sourceLabel: '官方说明', ...extra,
});
const today = '2026-10-14'; // a Wednesday: this week runs through Sunday 10/18

test('本周有效 means usable between today and this Sunday: ongoing, dated within the week (and on a published weekday), started 查本店', () => {
  assert.equal(weekEndOf('2026-10-14'), '2026-10-18');
  assert.equal(weekEndOf('2026-10-18'), '2026-10-18', 'on a Sunday the week ends today');
  assert.equal(validThisWeek(offer('ongoing'), today), true);
  assert.equal(validThisWeek(offer('soon', { availability: 'dated', startDate: '2026-10-17', endDate: '2026-10-17' }), today), true);
  assert.equal(validThisWeek(offer('next', { availability: 'dated', startDate: '2026-10-19', endDate: '2026-10-25' }), today), false);
  assert.equal(validThisWeek(offer('ended', { availability: 'dated', startDate: '2026-10-01', endDate: '2026-10-13' }), today), false);
  assert.equal(validThisWeek(offer('mondays', { availability: 'dated', startDate: '2026-10-01', endDate: '2026-12-31', weekdays: [1] }), today), false, 'Mondays only: none left this week');
  assert.equal(validThisWeek(offer('saturdays', { availability: 'dated', startDate: '2026-10-01', endDate: '2026-12-31', weekdays: [6] }), today), true);
  assert.equal(validThisWeek(offer('store', { availability: 'check-local' }), today), true);
  assert.equal(validThisWeek(offer('store-later', { availability: 'check-local', startDate: '2026-10-20' }), today), false);
  assert.equal(validThisWeek(offer('unconfirmed', { verificationStatus: 'needs-confirmation' }), today), false);
  assert.equal(validThisWeek(offer('undated', { availability: 'dated' }), today), false);
  assert.equal(validThisWeek(offer('store-ended', { availability: 'check-local', endDate: '2026-10-13' }), today), false, 'a 查本店 offer past its stated end');
  assert.equal(validThisWeek(offer('perk-ended', { availability: 'ongoing', endDate: '2026-10-13' }), today), false, 'an ongoing perk past its stated end');
  assert.equal(validThisWeek(offer('store-ends-today', { availability: 'check-local', endDate: today }), today), true, 'its last day still counts');
});

test('a long board opens on 本周有效 with six cards per kind; 看全部 N 条 opens a kind and 收起 closes it; a search lists every match', () => {
  const offers = [
    ...Array.from({ length: 9 }, (_, index) => offer(`free-${index}`)),
    ...Array.from({ length: 3 }, (_, index) => offer(`book-${index}`, { kind: 'reservation' })),
    offer('later', { availability: 'dated', startDate: '2026-11-02', endDate: '2026-11-02' }),
  ];
  const view = render(<FreebieBoard offers={offers} today={today} />);
  const dates = within(view.getByRole('radiogroup', { name: '按日期筛选' }));
  assert.equal(dates.getByRole('radio', { name: '本周有效 12' }).getAttribute('aria-checked'), 'true');
  const free = view.getByRole('region', { name: /^无需购物/ });
  assert.equal(within(free).getAllByRole('article').length, FREEBIE_SECTION_SIZE);
  const more = within(free).getByRole('button', { name: '看全部 9 条' });
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(within(view.getByRole('region', { name: /^需预约/ })).queryByRole('button', { name: /看全部/ }), null, 'three cards need no 看全部');
  fireEvent.click(more);
  assert.equal(within(free).getAllByRole('article').length, 9);
  fireEvent.click(within(free).getByRole('button', { name: '收起' }));
  assert.equal(within(free).getAllByRole('article').length, FREEBIE_SECTION_SIZE);
  assert.equal(view.queryByRole('article', { name: '优惠 later' }), null, 'next month is not this week');
  fireEvent.click(dates.getByRole('radio', { name: '全部日期' }));
  assert.ok(view.getByRole('article', { name: '优惠 later' }));
  // A search lists every match in one list.
  fireEvent.change(view.getByRole('searchbox', { name: '搜索品牌、城市或福利' }), { target: { value: 'Brand free' } });
  assert.equal(view.getAllByRole('article').length, 9);
  assert.ok(view.getByRole('heading', { name: '找到 9 项', level: 3 }));
  // Card titles sit under their section: h2 board → h3 kind → h4 card.
  assert.equal(view.getAllByRole('heading', { level: 4 }).length, 9);
});

test('a board with nothing valid this week opens on every date (a next-month board read early)', () => {
  const view = render(<FreebieBoard offers={[offer('nov', { availability: 'dated', startDate: '2026-11-07', endDate: '2026-11-07' })]} today={today} />);
  assert.equal(within(view.getByRole('radiogroup', { name: '按日期筛选' })).getByRole('radio', { name: '全部日期' }).getAttribute('aria-checked'), 'true');
  assert.ok(view.getByRole('article', { name: '优惠 nov' }));
});

test('a sold-out batch (the overlay\'s sold_out) is 已售罄, not 限量供应 · 查询余票, and never counts as 本周有效', () => {
  const soldOut = offer('opera', { availability: 'check-local', startDate: '2026-09-30', status: 'sold_out', dateLabel: '本批已售罄 · 下一批 2027/4/27 中午开售' });
  assert.equal(validThisWeek(soldOut, today), false);
  assert.equal(validThisWeek(offer('on-sale', { availability: 'check-local', startDate: '2026-10-08' }), today), true, 'a sale that opened and is not marked sold out still counts');
  const view = render(<FreebieBoard offers={[soldOut, offer('daily')]} today={today} />);
  const dates = within(view.getByRole('radiogroup', { name: '按日期筛选' }));
  assert.equal(dates.getByRole('radio', { name: '本周有效 1' }).getAttribute('aria-checked'), 'true');
  assert.equal(view.queryByRole('article', { name: '优惠 opera' }), null);
  fireEvent.click(dates.getByRole('radio', { name: '全部日期' }));
  const card = within(view.getByRole('article', { name: '优惠 opera' }));
  assert.ok(card.getByText('已售罄'));
  assert.equal(card.queryByText('限量供应 · 查询余票'), null);
});

test('no board offer that says it is sold out counts as 本周有效, on any day of October or November', () => {
  const offers = guides.flatMap(guide => guide.blocks.flatMap(block => block.type === 'freebies' ? block.offers : []));
  assert.ok(offers.some(item => item.id === 'sf-opera-dolby-figaro-offer-2026'), 'the October board lists the sold-out opera batch');
  const soldOut = offers.filter(item => item.status === 'sold_out' || /已售罄|已售完|sold out/i.test(`${item.title} ${item.dateLabel}`));
  assert.ok(soldOut.length >= 1);
  for (let day = '2026-10-01'; day <= '2026-11-30'; day = addDays(day, 1)) {
    for (const item of soldOut) assert.equal(validThisWeek(item, day), false, `${item.id} on ${day}: ${item.dateLabel}`);
  }
});

test('an offer on a guide board with a stated end date stops counting as 本周有效 after it (CNT-SUPPLY: Poppy & Claro by 10/30)', () => {
  const offers = guides.flatMap(guide => guide.blocks.flatMap(block => block.type === 'freebies' ? block.offers : []));
  const dogDinners = offers.filter(item => item.id === 'poppy-claro-doggie-dinners-fall');
  assert.ok(dogDinners.length >= 1 && dogDinners.every(item => item.endDate === '2026-10-30' && item.availability === 'check-local'), 'the boards list the dog dinners with their end date');
  for (const item of dogDinners) {
    assert.equal(validThisWeek(item, '2026-10-30'), true, 'the last Friday');
    for (let day = '2026-10-31'; day <= '2026-11-30'; day = addDays(day, 1)) assert.equal(validThisWeek(item, day), false, day);
  }
});

test('a picture shows once per page: the first card with it and never the guide cover again; the other cards keep their text', () => {
  GUIDE_IMAGES['perks-test-photo'] = photo;
  const offers = [offer('one', { imageKey: 'perks-test-photo' }), offer('two', { imageKey: 'perks-test-photo' }), offer('three', { imageKey: 'perks-test-photo' })];
  const view = render(<FreebieBoard offers={offers} today={today} />);
  assert.equal(view.getAllByRole('img', { name: photo.alt }).length, 1);
  assert.ok(within(view.getByRole('article', { name: '优惠 one' })).getByRole('img', { name: photo.alt }));
  for (const id of ['two', 'three']) {
    const card = within(view.getByRole('article', { name: `优惠 ${id}` }));
    assert.equal(card.queryByRole('img'), null);
    assert.ok(card.getByText(`条件 ${id}`));
  }
  view.rerender(<FreebieBoard offers={offers} today={today} skipImages={[photo.src]} />);
  assert.equal(view.queryAllByRole('img', { name: photo.alt }).length, 0, 'the guide already shows it as its cover');
});

test('a phone number in an offer is a tap-to-call link (in the condition and the description)', () => {
  const view = render(<FreebieBoard offers={[offer('call', { requirement: '先打 (415) 555-0300 预约', description: '名额有限，致电 415-555-0400 查询。' })]} today={today} />);
  const card = within(view.getByRole('article', { name: '优惠 call' }));
  assert.equal(card.getByRole('link', { name: /拨打 \(415\) 555-0300/ }).getAttribute('href'), 'tel:+14155550300');
  assert.equal(card.getByRole('link', { name: /拨打 415-555-0400/ }).getAttribute('href'), 'tel:+14155550400');
});

test('board and gallery styles: every text size at least 13px, text on the shared tokens, no hex colours, 44px controls, guarded', () => {
  const guarded = editorialStyleScopes.map((scope: { file: string }) => scope.file);
  for (const file of ['src/components/freebie-board.css', 'src/components/perks-gallery.css']) {
    assert.ok(guarded.includes(file), `${file} is in the editorial style guard`);
    const css = readFileSync(file, 'utf8');
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i, `${file} has no hex colours`);
    postcss.parse(css).walkDecls(declaration => {
      if (declaration.prop === 'font-size') {
        const rem = /^([\d.]+)rem$/.exec(declaration.value);
        assert.ok(/^var\(--(?:text-|fs-)/.test(declaration.value) || (rem && Number(rem[1]) >= .8125), `${file}: font-size ${declaration.value}`);
      }
      if (declaration.prop === 'color') assert.match(declaration.value, /^(?:var\(--|inherit)/, `${file}: color ${declaration.value}`);
      if (declaration.prop === 'min-height' && /button|a\b|summary|input/.test((declaration.parent as postcss.Rule).selector)) assert.equal(declaration.value, 'var(--control-height)');
    });
  }
});

test('the posters load as 480 / 800 WebP rungs (the 800 at most 60 KB); the PNG stays the full view and the download', () => {
  const html = renderToStaticMarkup(<StaticRouter><PerksGallery /></StaticRouter>);
  const document = new JSDOM(html).window.document;
  for (const poster of perksPosters) {
    const image = [...document.querySelectorAll('img')].find(element => element.getAttribute('src') === perksPosterRung(poster, 800))!;
    assert.ok(image, poster.id);
    assert.equal(image.getAttribute('srcset'), `${perksPosterRung(poster, 480)} 480w, ${perksPosterRung(poster, 800)} 800w`);
    assert.ok(image.getAttribute('sizes'));
    assert.equal(image.closest('a')?.getAttribute('href'), poster.path, 'the full-size view is the PNG');
    assert.ok(document.querySelector(`a[download][href="${poster.path}"]`), 'the download is the PNG');
    for (const width of [480, 800] as const) {
      const bytes = statSync(`public${perksPosterRung(poster, width)}`).size;
      assert.ok(bytes <= (width === 800 ? 60 : 35) * 1024, `${perksPosterRung(poster, width)}: ${bytes} B`);
    }
  }
});

test('a deals guide says it is a list to filter, not a reading time that its hundred cards would make wrong', () => {
  const guide = getGuideBySlug('bay-area-freebies-deals-2026-10')!;
  const html = renderToStaticMarkup(<StaticRouter><GuideHeader guide={guide} returnTo="/guides" /></StaticRouter>);
  assert.match(html, /优惠清单 · 可按条件筛选/);
  assert.doesNotMatch(html, /约 \d+ 分钟/);
  const prose = getGuideBySlug('bay-area-chinese-senior-services-referral-guide')!;
  assert.match(renderToStaticMarkup(<StaticRouter><GuideHeader guide={prose} returnTo="/guides" /></StaticRouter>), /约 \d+ 分钟/);
});
