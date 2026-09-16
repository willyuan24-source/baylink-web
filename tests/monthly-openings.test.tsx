import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { septemberOpenings } from '../src/data/september-openings';
import { additionalOctoberOpenings } from '../src/data/october-openings-extra';
import { currentOpenings } from '../src/data/local-discoveries';
import { guides, getGuideBySlug } from '../src/data/guides';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://www.baylink.us/this-month', pretendToBeVisual: true,
});
const browserGlobals = {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
};
const previousGlobals = new Map(Object.keys(browserGlobals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(browserGlobals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const { render, fireEvent, within, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { MonthlyOpenings, OPENINGS_GUIDE_SLUG } = await import('../src/components/MonthlyOpenings');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { setLocale } = await import('../src/i18n/locale');

beforeEach(async () => { await setLocale('zh-Hans', false); });
afterEach(async () => {
  cleanup();
  await setLocale('zh-Hans', false);
  dom.window.localStorage.clear();
  dom.window.history.replaceState(null, '', '/this-month');
});
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const edition = (today = '2026-09-15') => <MemoryRouter><MonthlyOpenings today={today} /></MemoryRouter>;
const names = (view: ReturnType<typeof render>) => view.queryAllByRole('article').map(article => within(article).getByRole('heading', { level: 3 }).textContent);
const statusFilters = (view: ReturnType<typeof render>) => within(view.getByRole('group', { name: '按开业状态筛选' }));
const firstSix = ['Broken Dreams', 'Hijau Coffee', 'Kaiyō Handroll Bar', 'La Boulangerie at ERIA Marina', 'The Mess Hall · Breadwinner', 'Sergeant Ma'];
const sfOpen = ['Kaiyō Handroll Bar', 'La Boulangerie at ERIA Marina', 'The Mess Hall · Breadwinner', 'Sergeant Ma'];

test('opening status and region use confirmed business status without reviving an ended celebration', () => {
  const view = render(edition());
  assert.deepEqual(names(view), firstSix);
  assert.equal(currentOpenings.length, 11);
  assert.equal(new Set(currentOpenings.map(shop => shop.id)).size, 11);
  assert.equal(currentOpenings.filter(shop => shop.status === 'open').length, 6);
  assert.equal(currentOpenings.filter(shop => shop.status === 'announced').length, 5);
  assert.equal(statusFilters(view).getByRole('button', { name: /^全部新店/ }).textContent, '全部新店11');
  assert.equal(statusFilters(view).getByRole('button', { name: /^已开业/ }).textContent, '已开业6');
  assert.equal(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }).textContent, '预告与庆典5');
  assert.ok(view.getByText(/尚未实地探店/));
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }));
  fireEvent.change(view.getByRole('combobox', { name: '新店所在地区' }), { target: { value: 'sf' } });
  assert.deepEqual(names(view), ['Florecita Panadería', 'Handroll Hawker', 'Woods Beer & Wine Co. · Fisherman’s Wharf']);
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^已开业/ }));
  assert.deepEqual(names(view), sfOpen);
  const bakery = within(view.getByRole('article', { name: 'La Boulangerie at ERIA Marina' }));
  assert.ok(bakery.getByText('已开业', { exact: true }));
  assert.ok(!bakery.queryByText('开业庆典', { exact: true }));
  assert.ok(bakery.getByText('已营业 · 9 月 12 日庆典已结束', { exact: true }));
  assert.ok(bakery.getByText(/首日营业日期未核实/));
  assert.ok(!bakery.queryByText(/espresso|pastry|获赠/));
  assert.equal(septemberOpenings.find(shop => shop.id === 'boulangerie-eria-celebration')?.openedOn, undefined, 'verified operation does not invent a first-service date');
  assert.equal((view.getByRole('combobox', { name: '新店所在地区' }) as HTMLSelectElement).value, 'sf');
  assert.equal(statusFilters(view).getByRole('button', { name: /^已开业/ }).getAttribute('aria-pressed'), 'true');
});

test('an empty status-region combination offers a reset that restores both filters and every available opening', () => {
  const view = render(edition());
  fireEvent.change(view.getByRole('combobox', { name: '新店所在地区' }), { target: { value: 'peninsula' } });
  assert.deepEqual(names(view), ['Marufuku Ramen · Burlingame']);
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^已开业/ }));
  assert.deepEqual(names(view), []);
  assert.ok(view.getByText('这个地区暂没有符合条件的已核实新店。'));
  fireEvent.click(view.getByRole('button', { name: '查看全部新店', exact: true }));
  assert.deepEqual(names(view), firstSix);
  assert.equal((view.getByRole('combobox', { name: '新店所在地区' }) as HTMLSelectElement).value, 'all');
  assert.equal(statusFilters(view).getByRole('button', { name: /^全部新店/ }).getAttribute('aria-pressed'), 'true');
  assert.ok(!view.queryByText('这个地区暂没有符合条件的已核实新店。'));
  assert.ok(view.getByRole('button', { name: '展开其余新店' }));
});

test('six recently verified open shops appear first, expanding reveals every announcement and filtering collapses the list', () => {
  const view = render(edition());
  assert.deepEqual(names(view), firstSix);
  assert.ok(!view.queryByRole('article', { name: 'Marufuku Ramen · Burlingame' }));
  fireEvent.click(view.getByRole('button', { name: '展开其余新店' }));
  assert.equal(names(view).length, 11);
  assert.deepEqual(new Set(names(view)), new Set(currentOpenings.map(shop => shop.name)));
  assert.deepEqual(names(view).slice(0, 6), firstSix);
  assert.equal(names(view)[6], 'Marufuku Ramen · Burlingame', 'The newly verified announcement precedes older announcements');
  assert.ok(!view.queryByRole('button', { name: '展开其余新店' }));
  fireEvent.change(view.getByRole('combobox', { name: '新店所在地区' }), { target: { value: 'south-bay' } });
  assert.deepEqual(names(view), ['Hijau Coffee', 'The Hedley Club & Palm Court']);
  fireEvent.change(view.getByRole('combobox', { name: '新店所在地区' }), { target: { value: 'all' } });
  assert.deepEqual(names(view), firstSix, 'Changing filters resets the expanded state');
  assert.ok(view.getByRole('button', { name: '展开其余新店' }));
});

test('passing an announced date and moving to the archive never silently promotes an opening forecast', () => {
  const originalStatuses = currentOpenings.map(shop => [shop.id, shop.status, shop.openedOn]);
  const view = render(edition());
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^已开业/ }));
  assert.deepEqual(names(view), firstSix);
  view.rerender(edition('2026-09-30'));
  assert.deepEqual(names(view), firstSix, 'Dates passing are not proof that service started');
  view.rerender(edition('2026-10-01'));
  assert.ok(view.getByRole('heading', { name: '湾区新店，找个理由去尝鲜。' }));
  assert.ok(!view.queryByRole('heading', { name: '本期新店记录' }));
  view.rerender(edition('2026-10-31'));
  assert.ok(view.getByRole('heading', { name: '湾区新店，找个理由去尝鲜。' }));
  assert.deepEqual(names(view), firstSix);
  view.rerender(edition('2026-11-01'));
  assert.ok(view.getByRole('heading', { name: '本期新店记录' }));
  assert.ok(view.getByText('这是本期开业消息快照，当前营业情况请查商家公告。'));
  assert.ok(!view.queryByRole('heading', { name: '湾区新店，找个理由去尝鲜。' }));
  assert.deepEqual(names(view), firstSix);
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }));
  for (const shop of currentOpenings.filter(shop => shop.status === 'announced')) {
    const card = within(view.getByRole('article', { name: shop.name, exact: true }));
    assert.ok(card.getByText(shop.openingType === 'opening-celebration' ? '开业庆典' : '开业预告', { exact: true }));
    assert.ok(card.getByText(shop.dateLabel, { exact: true }));
  }
  assert.deepEqual(currentOpenings.map(shop => [shop.id, shop.status, shop.openedOn]), originalStatuses);
});

test('every opening exposes its merchant, encoded map destination and independently traceable news source', () => {
  const view = render(edition());
  fireEvent.click(view.getByRole('button', { name: '展开其余新店' }));
  for (const shop of currentOpenings) {
    const card = within(view.getByRole('article', { name: shop.name, exact: true }));
    const merchant = card.getByRole('link', { name: '商家入口' });
    assert.equal(merchant.getAttribute('href'), shop.officialUrl);
    const map = card.getByRole('link', { name: '查看位置' });
    const location = new URL(map.getAttribute('href')!);
    assert.equal(location.origin, 'https://www.google.com');
    assert.equal(location.pathname, '/maps/search/');
    assert.equal(location.searchParams.get('api'), '1');
    assert.ok(location.searchParams.get('query')?.includes(shop.address));
    assert.ok(location.searchParams.get('query')?.includes(shop.name));
    const toggle = card.getByText('开业消息与图片来源');
    const details = toggle.closest('details');
    assert.ok(details);
    assert.equal(details.open, false);
    fireEvent.click(toggle);
    assert.equal(details.open, true);
    const source = within(details).getByRole('link', { name: shop.sourceLabel, exact: true });
    assert.equal(source.getAttribute('href'), shop.sourceUrl);
    assert.ok(within(details).getByText(`核对 ${shop.verifiedAt}`));
    for (const link of [merchant, map, source]) {
      assert.equal(link.getAttribute('target'), '_blank');
      assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
      assert.equal(new URL(link.getAttribute('href')!).protocol, 'https:');
    }
  }
  assert.equal(view.getByRole('link', { name: '收藏新店手册' }).getAttribute('href'), `/guides/${OPENINGS_GUIDE_SLUG}`);
});

test('new text-only opening cards retain official evidence and never invent photos or first-service dates', () => {
  const view = render(edition());
  fireEvent.click(view.getByRole('button', { name: '展开其余新店' }));
  const officialHosts = new Set(['www.kaiyosf.com', 'www.messhallpresidio.com', 'www.brokendreamsoakland.com', 'kemlu.go.id', 'www.marufukuramen.com']);
  assert.equal(additionalOctoberOpenings.length, 5);
  for (const shop of additionalOctoberOpenings) {
    assert.equal(shop.verifiedAt, '2026-09-15');
    assert.ok(officialHosts.has(new URL(shop.sourceUrl).hostname), shop.id);
    assert.equal(shop.imageKey, '');
    const article = view.getByRole('article', { name: shop.name, exact: true });
    const card = within(article);
    assert.ok(!card.queryByRole('img'), 'Unverified photos must not be replaced by invented imagery');
    assert.ok(!card.queryByRole('button', { name: /^查看大图/ }));
    assert.ok(card.getByText(shop.summary));
    assert.ok(card.getByText(shop.editorTip));
    assert.equal(card.getByRole('link', { name: shop.name, exact: true }).getAttribute('href'), `/openings/${shop.id}`);
    fireEvent.click(card.getByText('开业消息与图片来源'));
    assert.equal(card.getByRole('link', { name: shop.sourceLabel, exact: true }).getAttribute('href'), shop.sourceUrl);
    assert.ok(card.getByText(`核对 ${shop.verifiedAt}`));
    if (shop.status === 'announced' || shop.openingType === 'opening-celebration') assert.equal(shop.openedOn, undefined);
  }
  const brokenDreams = additionalOctoberOpenings.find(shop => shop.id === 'broken-dreams-oakland')!;
  assert.equal(brokenDreams.openedOn, '2026-08-10');
  assert.match(brokenDreams.editorTip, /周末暂休/);
  const marufuku = additionalOctoberOpenings.find(shop => shop.id === 'marufuku-burlingame-announced')!;
  assert.equal(marufuku.status, 'announced');
  assert.match(marufuku.dateLabel, /日期尚未公布/);
  assert.match(marufuku.address, /待官方公布/);
});

test('the handbook route resolves to published September content with all six places and clickable primary sources in server HTML', () => {
  const guide = getGuideBySlug(OPENINGS_GUIDE_SLUG);
  assert.ok(guide, 'the card link must point to a registered guide');
  assert.equal(guides.filter(item => item.slug === OPENINGS_GUIDE_SLUG).length, 1);
  assert.equal(guide.editionMonth, '2026-09');
  assert.match(guide.sourceNote || '', /未实地探店/);
  const server = new JSDOM(renderToStaticMarkup(<StaticRouter location={`/guides/${OPENINGS_GUIDE_SLUG}`}>
    <GuideDetail slug={OPENINGS_GUIDE_SLUG} today="2026-10-01" onBack={() => {}} onOpenGuide={() => {}} onNavigate={() => {}} onOpenPost={() => {}} />
  </StaticRouter>));
  try {
    const document = server.window.document;
    assert.equal(document.querySelector('h1')?.textContent, guide.title);
    assert.match(document.querySelector('.bl-guide-edition-notice')?.textContent || '', /往期攻略 · 2026 年 9 月/);
    const links = [...document.querySelectorAll('a')];
    for (const shop of septemberOpenings) {
      assert.ok(document.body.textContent?.includes(shop.name));
      assert.ok(document.body.textContent?.includes(shop.dateLabel));
      for (const url of [shop.officialUrl, shop.sourceUrl]) {
        assert.ok(links.some(link => link.getAttribute('href') === url), `${shop.name} needs ${url}`);
      }
    }
  } finally { server.window.close(); }
});
