import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { septemberOpenings } from '../src/data/september-openings';
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

const edition = (today = '2026-09-11') => <MemoryRouter><MonthlyOpenings today={today} /></MemoryRouter>;
const names = (view: ReturnType<typeof render>) => view.queryAllByRole('article').map(article => within(article).getByRole('heading', { level: 3 }).textContent);
const statusFilters = (view: ReturnType<typeof render>) => within(view.getByRole('group', { name: '按开业状态筛选' }));

test('opening status and region combine without treating an opening celebration as a confirmed September opening', () => {
  const view = render(edition());
  assert.deepEqual(names(view), septemberOpenings.slice(0, 6).map(shop => shop.name));
  assert.ok(view.getByText(/尚未实地探店/));
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }));
  fireEvent.change(view.getByRole('combobox', { name: '新店所在地区' }), { target: { value: 'sf' } });
  assert.deepEqual(names(view), ['La Boulangerie at ERIA Marina', 'Florecita Panadería', 'Handroll Hawker', 'Woods Beer & Wine Co. · Fisherman’s Wharf']);
  const celebration = within(view.getByRole('article', { name: 'La Boulangerie at ERIA Marina' }));
  assert.ok(celebration.getByText('开业庆典', { exact: true }));
  assert.ok(celebration.getByText(/首日营业日期未核实/));
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^已开业/ }));
  assert.deepEqual(names(view), ['Sergeant Ma']);
  assert.equal((view.getByRole('combobox', { name: '新店所在地区' }) as HTMLSelectElement).value, 'sf');
  assert.equal(statusFilters(view).getByRole('button', { name: /^已开业/ }).getAttribute('aria-pressed'), 'true');
});

test('an empty status-region combination offers a reset that restores both filters and every available opening', () => {
  const view = render(edition());
  fireEvent.change(view.getByRole('combobox', { name: '新店所在地区' }), { target: { value: 'south-bay' } });
  assert.deepEqual(names(view), ['The Hedley Club & Palm Court']);
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^已开业/ }));
  assert.deepEqual(names(view), []);
  assert.ok(view.getByText('这个地区暂没有符合条件的已核实新店。'));
  fireEvent.click(view.getByRole('button', { name: '查看全部新店', exact: true }));
  assert.deepEqual(names(view), septemberOpenings.slice(0, 6).map(shop => shop.name));
  assert.equal((view.getByRole('combobox', { name: '新店所在地区' }) as HTMLSelectElement).value, 'all');
  assert.equal(statusFilters(view).getByRole('button', { name: /^全部新店/ }).getAttribute('aria-pressed'), 'true');
  assert.ok(!view.queryByText('这个地区暂没有符合条件的已核实新店。'));
});

test('passing an announced date and moving to the archive never silently promotes an opening forecast', () => {
  const originalStatuses = septemberOpenings.map(shop => [shop.id, shop.status, shop.openedOn]);
  const view = render(edition());
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^已开业/ }));
  assert.deepEqual(names(view), ['Sergeant Ma']);
  view.rerender(edition('2026-09-30'));
  assert.deepEqual(names(view), ['Sergeant Ma'], 'dates passing are not proof that service started');
  view.rerender(edition('2026-10-01'));
  assert.ok(view.getByRole('heading', { name: '本期新店记录' }));
  assert.ok(view.getByText('这是九月的开业消息快照，当前营业情况请查商家公告。'));
  assert.ok(!view.queryByRole('heading', { name: '九月，新开的一扇门。' }));
  assert.deepEqual(names(view), ['Sergeant Ma']);
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }));
  for (const shop of septemberOpenings.filter(shop => shop.status === 'announced')) {
    const card = within(view.getByRole('article', { name: shop.name, exact: true }));
    assert.ok(card.getByText(shop.openingType === 'opening-celebration' ? '开业庆典' : '开业预告', { exact: true }));
    assert.ok(card.getByText(shop.dateLabel, { exact: true }));
  }
  assert.deepEqual(septemberOpenings.map(shop => [shop.id, shop.status, shop.openedOn]), originalStatuses);
});

test('every opening exposes its merchant, encoded map destination and independently traceable news source', () => {
  const view = render(edition());
  for (const shop of septemberOpenings) {
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

test('the handbook route resolves to published September content with all six places and clickable primary sources in server HTML', () => {
  const guide = getGuideBySlug(OPENINGS_GUIDE_SLUG);
  assert.ok(guide, 'the card link must point to a registered guide');
  assert.equal(guides.filter(item => item.slug === OPENINGS_GUIDE_SLUG).length, 1);
  assert.equal(guide.editionMonth, '2026-09');
  assert.match(guide.sourceNote || '', /尚未实地探店/);
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
