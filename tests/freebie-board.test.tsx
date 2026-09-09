import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FreebieOffer } from '../src/components/FreebieBoard';
import type { GuideImage } from '../src/data/guide-media';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', {
  configurable: true,
  value: function (this: HTMLElement) { return this.isConnected && !this.closest('[hidden]') ? [this.getBoundingClientRect()] : []; },
});
const style = document.createElement('style');
style.textContent = readFileSync(new URL('../src/components/freebie-board.css', import.meta.url), 'utf8');
document.head.append(style);
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { FreebieBoard } = await import('../src/components/FreebieBoard');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { getGuideBySlug } = await import('../src/data/guides');
const { guideBlockText } = await import('../src/lib/guide-content');
const { searchGuides } = await import('../src/lib/guide-search');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { StaticRouter } = await import('react-router-dom');

const picture: GuideImage = {
  src: '/test/freebie-poster.webp', srcSet: '/test/freebie-poster-small.webp 480w, /test/freebie-poster.webp 1200w',
  alt: '包含活动名称和日期的官方宣传图', caption: '商家公开的活动宣传海报，保留完整文字。',
  credit: '示例商家 · 官方宣传图', creditUrl: 'https://example.com/image', kind: 'poster', width: 1200, height: 1700,
};
const photo: GuideImage = { ...picture, src: '/test/freebie-photo.webp', alt: '商家店内的资料照片', caption: '店内环境资料照片，不对应当前库存。', kind: 'photo', licenseUrl: 'https://example.com/license', height: 800 };
const base: FreebieOffer = {
  id: 'coffee', brand: 'Coffee Shop', title: '周末小杯咖啡', dateLabel: '9 月 20 日', startDate: '2026-09-20', endDate: '2026-09-20',
  availability: 'dated', kind: 'no-purchase', requirement: '会员扫码领取，每人一次。', description: '先确认参与门店，再顺路领取。',
  imageKey: 'freebie-test-poster', sourceUrl: 'https://example.com/coffee', sourceLabel: '官方活动说明', storeUrl: 'https://example.com/stores',
};
const offers: FreebieOffer[] = [
  base,
  { ...base, id: 'ended', brand: 'Bakery', title: '已过期蛋糕优惠', dateLabel: '9 月 1 日', startDate: '2026-09-01', endDate: '2026-09-01', kind: 'purchase' },
  { ...base, id: 'birthday', brand: 'Beauty Shop', title: '会员生日礼', dateLabel: '生日窗口内', availability: 'ongoing', imageKey: 'freebie-test-photo' },
  { ...base, id: 'local', brand: 'Craft Store', title: '本店手作场次', dateLabel: '查看本店活动日历', availability: 'check-local', kind: 'reservation', imageNote: '仅示意活动主题' },
  { ...base, id: 'next-month', brand: 'Tool Store', title: '下月儿童手作', dateLabel: '10 月 3 日', startDate: '2026-10-03', endDate: '2026-10-03', kind: 'reservation' },
  { ...base, id: 'single-date', brand: 'Book Store', title: '单日预约体验', dateLabel: '9 月 30 日', startDate: '2026-09-30', endDate: undefined, kind: 'reservation' },
  { ...base, id: 'invalid-date', brand: 'Unverified', title: '日期仍需核对', dateLabel: '日期待确认', startDate: '2026-09-31', endDate: '2026-09-31', kind: 'purchase' },
];
function install() { GUIDE_IMAGES['freebie-test-poster'] = picture; GUIDE_IMAGES['freebie-test-photo'] = photo; }
afterEach(() => { cleanup(); delete GUIDE_IMAGES['freebie-test-poster']; delete GUIDE_IMAGES['freebie-test-photo']; });

test('board counts only dated, unexpired current-month offers and separates ongoing and local-check items', () => {
  install();
  const view = render(<FreebieBoard offers={offers} today="2026-09-09" title="九月领取清单" description="先按条件选。" />);
  assert.ok(view.getByRole('heading', { name: '九月领取清单', level: 2 }));
  assert.ok(view.getByText('先按条件选。'));
  const counts = [...view.container.querySelectorAll('.bl-freebie-board-stats>span')].map(item => item.textContent);
  assert.deepEqual(counts, ['2本月已确认', '1长期福利', '1下月预告', '1需查本店']);
  assert.ok(within(view.getByRole('article', { name: '已过期蛋糕优惠' })).getByText('已结束'));
  assert.ok(within(view.getByRole('article', { name: '本店手作场次' })).getByText('查本店场次'));
  assert.ok(within(view.getByRole('article', { name: '日期仍需核对' })).getByText('日期待核对'));
  assert.ok(within(view.getByRole('article', { name: '下月儿童手作' })).getByText('下月预告'));
  view.rerender(<FreebieBoard offers={offers} today="2026-10-01" />);
  assert.equal(view.container.querySelector('.bl-freebie-board-stats>span')?.textContent, '1本月已确认');
  assert.ok(within(view.getByRole('article', { name: '周末小杯咖啡' })).getByText('已结束'));
  assert.ok(within(view.getByRole('article', { name: '会员生日礼' })).getByText('长期福利'));
});

test('condition filters select the matching offers without hiding requirements or losing the reset path', () => {
  install();
  const view = render(<FreebieBoard offers={offers} today="2026-09-09" />);
  const filters = within(view.getByRole('group', { name: '按领取条件筛选' }));
  for (const [label, kind] of [['无需购物', 'no-purchase'], ['需预约', 'reservation'], ['消费优惠', 'purchase']] as const) {
    fireEvent.click(filters.getByRole('button', { name: label, exact: true }));
    assert.equal(filters.getByRole('button', { name: label }).getAttribute('aria-pressed'), 'true');
    const expected = offers.filter(offer => offer.kind === kind);
    assert.equal(view.getAllByRole('article').length, expected.length);
    for (const offer of expected) {
      const card = within(view.getByRole('article', { name: offer.title }));
      assert.ok(card.getByText(offer.requirement));
      assert.ok(card.getByText(offer.description));
    }
    assert.match(view.getByRole('status').textContent || '', new RegExp(`显示 ${expected.length} 项`));
  }
  view.rerender(<FreebieBoard offers={[base]} today="2026-09-09" />);
  assert.ok(view.getByText('这个条件下暂时没有条目，换个条件看看。'));
  fireEvent.click(view.getByRole('button', { name: '查看全部' }));
  assert.equal(view.getAllByRole('article').length, 1);
  assert.equal(filters.getByRole('button', { name: '全部', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('each card keeps official links separate from image zoom and complete poster artwork', () => {
  install();
  const view = render(<FreebieBoard offers={[base]} today="2026-09-09" />);
  const cardElement = view.getByRole('article', { name: base.title });
  const card = within(cardElement);
  const image = card.getByRole('img', { name: picture.alt });
  assert.equal(getComputedStyle(image).objectFit, 'contain');
  assert.equal(image.getAttribute('srcset'), picture.srcSet);
  assert.ok(card.getByText('官方宣传图'));
  const official = card.getByRole('link', { name: `${base.brand}：${base.sourceLabel}` });
  assert.equal(official.getAttribute('href'), base.sourceUrl);
  assert.equal(official.getAttribute('target'), '_blank');
  assert.equal(official.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(card.getByRole('link', { name: `${base.brand}：查询本地门店` }).getAttribute('href'), base.storeUrl);
  assert.equal(cardElement.querySelectorAll('a button, button a, a a').length, 0);
  const source = card.getByText('图片说明与来源');
  fireEvent.click(source);
  assert.ok(card.getByText(picture.caption));
  assert.equal(card.getByRole('link', { name: picture.credit }).getAttribute('href'), picture.creditUrl);
  const opener = card.getByRole('button', { name: `放大${base.brand}配图：${picture.alt}` });
  opener.focus();
  fireEvent.click(opener);
  const dialog = within(view.getByRole('dialog', { name: `图片放大：${picture.alt}` }));
  assert.equal(dialog.getByRole('img').getAttribute('src'), picture.src);
  assert.equal(dialog.getByRole('img').getAttribute('srcset'), null);
  const close = dialog.getByRole('button', { name: '关闭放大图片' });
  assert.equal(document.activeElement, close);
  fireEvent.keyDown(close, { key: 'Escape' });
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.activeElement, opener);
});

test('all offers and their conditions remain readable in server HTML before any filtering', () => {
  install();
  const document = new JSDOM(renderToStaticMarkup(<FreebieBoard offers={offers} today="2026-09-09" />)).window.document;
  const cards = [...document.querySelectorAll('article')];
  assert.equal(cards.length, offers.length);
  for (const [index, offer] of offers.entries()) {
    assert.ok(cards[index].textContent?.includes(offer.brand));
    assert.ok(cards[index].textContent?.includes(offer.dateLabel));
    assert.ok(cards[index].textContent?.includes(offer.requirement));
    assert.ok(cards[index].textContent?.includes(offer.description));
    assert.equal(cards[index].hasAttribute('hidden'), false);
    assert.ok(cards[index].querySelector(`a[href="${offer.sourceUrl}"]`));
  }
  assert.equal(document.querySelectorAll('[aria-pressed="true"]').length, 1);
});

test('invalid source protocols and missing media do not create unsafe links or unrelated fallback images', () => {
  const offer = { ...base, sourceUrl: 'javascript:alert(1)', storeUrl: 'data:text/html,hello', imageKey: 'unknown-freebie-media' };
  const view = render(<FreebieBoard offers={[offer]} today="2026-09-09" />);
  assert.equal(view.queryByRole('link'), null);
  assert.equal(view.queryByRole('img'), null);
  assert.equal(view.queryByRole('button', { name: /放大/ }), null);
  assert.ok(view.getByText('配图整理中'));
  assert.ok(view.getByText(base.requirement));
});

test('the published September guide renders ten distinct cards with separate Target lists and searchable eligibility conditions', () => {
  const slug = 'bay-area-freebies-deals-2026-09';
  const guide = getGuideBySlug(slug);
  assert.ok(guide);
  const blocks = guide.blocks.filter(block => block.type === 'freebies');
  assert.equal(blocks.length, 1);
  const block = blocks[0];
  assert.equal(block.offers.length, 10);
  const imagePaths = block.offers.map(offer => GUIDE_IMAGES[offer.imageKey]?.src);
  assert.ok(imagePaths.every(Boolean), 'every real offer must have its own registered image');
  assert.equal(new Set(imagePaths).size, 10);
  const imageHashes = imagePaths.map(path => {
    assert.match(path!, /^\/guides\/[a-z0-9/._-]+\.webp$/);
    assert.equal(path!.includes('..'), false);
    return createHash('sha256').update(readFileSync(new URL(`../public${path}`, import.meta.url))).digest('hex');
  });
  assert.equal(new Set(imageHashes).size, 10, 'distinct filenames must correspond to distinct actual artwork');

  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} today="2026-09-09" onBack={() => {}} onOpenGuide={() => {}} onNavigate={() => {}} onOpenPost={() => {}} /></StaticRouter>);
  const document = new JSDOM(html).window.document;
  const boards = document.querySelectorAll('.bl-freebie-board');
  assert.equal(boards.length, 1, 'the board must not repeat in the prose after its full-width rendering');
  const board = boards[0];
  assert.equal(board.closest('.bl-guide-reading-layout'), null, 'cards belong above the narrow reading column');
  const cards = [...board.querySelectorAll('.bl-freebie-card')];
  assert.equal(cards.length, 10);
  assert.deepEqual([...board.querySelectorAll('.bl-freebie-board-stats>span')].map(item => item.textContent), ['6本月已确认', '3长期福利', '1下月预告']);
  for (const [index, offer] of block.offers.entries()) {
    const card = cards[index];
    assert.ok(card.textContent?.includes(offer.title));
    assert.ok(card.textContent?.includes(offer.requirement));
    assert.ok(card.textContent?.includes(offer.dateLabel));
    assert.equal(card.querySelector('.bl-freebie-card-actions a')?.getAttribute('href'), offer.sourceUrl);
    assert.equal(card.querySelector('img')?.getAttribute('src'), imagePaths[index]);
  }
  const targetOffers = block.offers.filter(offer => offer.brand === 'TARGET');
  assert.equal(targetOffers.length, 2);
  assert.equal(new Set(targetOffers.map(offer => offer.storeUrl)).size, 2, 'the two Target events must retain their different eligible-store lists');
  for (const target of targetOffers) {
    const card = cards.find(element => element.querySelector('h3')?.textContent === target.title);
    assert.equal(card?.querySelector('a[aria-label="TARGET：查询本地门店"]')?.getAttribute('href'), target.storeUrl);
  }
  const october = block.offers.find(offer => offer.id === 'homedepot-october-preview');
  assert.ok(october);
  const preview = cards.find(element => element.querySelector('h3')?.textContent === october.title);
  assert.equal(preview?.querySelector('.bl-freebie-status')?.textContent, '下月预告');
  assert.match(october.startDate!, /^2026-10-/);
  assert.ok(preview?.textContent?.includes(october.dateLabel));

  const text = guideBlockText(block);
  const lowes = block.offers.find(offer => offer.id === 'lowes-haunted-house-sep12');
  assert.ok(lowes);
  assert.ok(text.includes(lowes.requirement));
  for (const target of targetOffers) assert.ok(text.includes(target.requirement));
  for (const query of ['Kids Profile', '前 100 名符合条件顾客']) {
    assert.deepEqual(searchGuides([guide], { query }).map(result => result.guide.slug), [slug], query);
  }
});
