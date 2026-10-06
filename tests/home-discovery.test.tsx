import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getHomeWeekend } from '../src/lib/home-weekend';
import { MONTHLY_EVENTS } from '../src/lib/home-catalog';
import { eventOccursOn } from '../src/lib/event-calendar';
import { MONTHLY_EVENTS as COMPLETE_EVENTS } from '../src/data/monthly-edition';
import { guides as COMPLETE_GUIDES } from '../src/data/guides';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

test('server home exposes three real weekend dates, costs, sources and actionable deep links', () => {
  const today = '2026-10-05';
  const doc = new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></StaticRouter>)).window.document;
  const cards = [...doc.querySelectorAll('.home-weekend-card')];
  assert.equal(cards.length, 3);
  for (const card of cards) {
    const id = card.querySelector('h3 a')!.getAttribute('href')!.split('/').at(-1)!;
    const event = MONTHLY_EVENTS.find(item => item.id === id)!;
    const date = card.querySelector('time')!.getAttribute('datetime')!;
    assert.ok(date >= today && eventOccursOn(event, date));
    assert.ok(card.textContent!.includes(event.costLabel));
    assert.ok(card.textContent!.includes(event.verifiedAt));
    assert.equal(card.querySelector('[target=_blank]')!.getAttribute('href'), event.officialUrl);
    const plan = new URL(card.querySelector('.home-tonal-button')!.getAttribute('href')!, 'https://www.baylink.us');
    assert.equal(plan.searchParams.get('date'), date);
    assert.equal(plan.searchParams.get('stops'), `event:${id}`);
  }
  assert.equal(doc.querySelector('.perks-gallery'), null, 'operational posters no longer occupy home');
  assert.ok(doc.querySelector('.home-world-link'), 'the separate 3D experience remains discoverable');
  assert.ok(doc.querySelector('.home-guide-selection .home-section-heading a')!.textContent!.includes(String(COMPLETE_GUIDES.length)), 'home reports the entire guide library rather than its lightweight selection');
});

test('a compact home pool reports the entire weekend calendar count, including Sunday-only eligibility', () => {
  for (const today of ['2026-10-05', '2026-10-10', '2026-10-11', '2026-11-09']) {
    const weekend = getHomeWeekend(today);
    const days = [weekend.start, weekend.end].filter(day => day >= today);
    const actual = COMPLETE_EVENTS.filter(event => days.some(day => eventOccursOn(event, day))).length;
    assert.equal(weekend.total, actual, `${today} counts every eligible event in the published catalog`);
  }
});

test('one entry searches keywords, asks full questions, and preserves the visitor selection', () => {
  const searched: string[] = [], asked: string[] = [];
  let browsed = 0;
  const view = render(<MemoryRouter><HomeDiscovery today="2026-10-05" onSearch={query => searched.push(query)} onAskBayBay={query => asked.push(query || '')} onBrowseCommunity={() => browsed++} /></MemoryRouter>);
  const input = view.getByRole('textbox', { name: '搜索活动、指南，或问 BayBay' });
  fireEvent.change(input, { target: { value: '  免费博物馆  ' } });
  fireEvent.submit(view.getByRole('search'));
  assert.deepEqual(searched, ['免费博物馆']); assert.deepEqual(asked, []);
  fireEvent.change(input, { target: { value: '带爸妈去哪？' } });
  fireEvent.submit(view.getByRole('search'));
  assert.deepEqual(asked, ['带爸妈去哪？']);
  fireEvent.click(view.getByRole('button', { name: '日常少麻烦', exact: true }));
  assert.equal(view.getByRole('button', { name: '日常少麻烦', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(dom.window.localStorage.getItem('baylink.home-intent.v1'), 'everyday');
  fireEvent.click(view.getByRole('button', { name: '查看邻里信息' })); assert.equal(browsed, 1);
});

test('a Sunday never recommends yesterday and an empty future weekend offers an honest next step', () => {
  assert.ok(getHomeWeekend('2026-10-11').picks.every(pick => pick.date === '2026-10-11'));
  const view = render(<MemoryRouter><HomeDiscovery today="2099-01-05" onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('.home-weekend-card').length, 0);
  assert.ok(view.getByText('这个周末暂没有已确认的活动，先看常设去处或换个日期。'));
  assert.equal(view.getByRole('link', { name: '按地区找景点' }).getAttribute('href'), '/explore');
  assert.equal(view.container.querySelectorAll('.home-offer-list article').length, 0, 'expired offers never look current');
});
