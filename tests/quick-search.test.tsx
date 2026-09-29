import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { searchQuickDestinations } = await import('../src/lib/quick-search');
const { QuickExplore } = await import('../src/components/QuickExplore');
const { setLocale } = await import('../src/i18n/locale');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { currentFreebies } = await import('../src/data/october-offers');
const { currentOpenings } = await import('../src/data/local-discoveries');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('quick discovery finds tools, upcoming events and attractions with multilingual queries', async () => {
  assert.equal(searchQuickDestinations('房贷', 'zh-Hans').tools[0].id, 'loan');
  assert.equal(searchQuickDestinations('mortgage', 'zh-Hans').tools[0].id, 'loan');
  assert.equal(searchQuickDestinations('Petaluma 南瓜', 'zh-Hans', '2026-09-23').events[0].id, 'petaluma-pumpkin-patch-2026');
  assert.equal(searchQuickDestinations('Petaluma 南瓜', 'zh-Hans', '2026-11-01').events.length, 0);
  assert.equal(searchQuickDestinations('Coastal Cleanup', 'zh-Hans', '2026-09-23').events.length, 0);
  assert.equal(searchQuickDestinations('金门大桥', 'zh-Hans').attractions[0].id, 'golden-gate');
  assert.equal(searchQuickDestinations('no-such-place-123', 'zh-Hans').attractions.length, 0);
  assert.equal(searchQuickDestinations('', 'zh-Hans').tools.length, 0);
  await setLocale('zh-Hant', false);
  assert.equal(searchQuickDestinations('金門大橋', 'zh-Hant').attractions[0].id, 'golden-gate');
  await setLocale('en', false);
  assert.equal(searchQuickDestinations('Petaluma pumpkin', 'en', '2026-09-23').events[0].id, 'petaluma-pumpkin-patch-2026');
});

test('keyboard opens the matching tool and IME enter never navigates', () => {
  const opened: string[] = [];
  const view = render(<QuickExplore onClose={() => {}} onSearch={() => {}} onNavigate={path => opened.push(path)} onAsk={() => {}} />);
  const input = view.getByRole('combobox');
  fireEvent.click(view.getByRole('button', { name: '小费', exact: true }));
  assert.equal(document.activeElement, input);
  assert.equal((input as HTMLInputElement).value, '小费');
  fireEvent.change(input, { target: { value: '房贷' } });
  fireEvent.compositionStart(input);
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(opened, []);
  fireEvent.compositionEnd(input);
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(opened, ['/tools?tool=loan#tool-workspace']);
  fireEvent.change(input, { target: { value: '金门大桥' } });
  assert.equal(view.getAllByRole('option').filter(option => option.textContent?.startsWith('金门大桥与 Fort Point')).length, 1);
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  assert.equal(input.getAttribute('aria-activedescendant'), `quick-result-${view.getAllByRole('option').length - 1}`);
});

test('quick search respects confirmed event days and offer validity while retaining ongoing benefits', () => {
  const eventCount = MONTHLY_EVENTS.length;
  const offerCount = currentFreebies.length;
  try {
    MONTHLY_EVENTS.push({ ...MONTHLY_EVENTS[0], id: 'search-sessions-fixture', title: 'SearchSessionsFixture', startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-02'] });
    currentFreebies.push(
      { ...currentFreebies[0], id: 'search-expired-fixture', title: 'SearchOffersFixture', availability: 'dated', startDate: '2026-09-01', endDate: '2026-09-28' },
      { ...currentFreebies[0], id: 'search-invalid-fixture', title: 'SearchOffersFixture', availability: 'dated', startDate: '2026-02-30', endDate: '2026-10-31' },
      { ...currentFreebies[0], id: 'search-ongoing-fixture', title: 'SearchOffersFixture', availability: 'ongoing', startDate: undefined, endDate: undefined },
      { ...currentFreebies[0], id: 'search-current-fixture', title: 'SearchOffersFixture', availability: 'dated', startDate: '2026-09-29', endDate: '2026-09-29' },
    );
    assert.equal(searchQuickDestinations('SearchSessionsFixture', 'zh-Hans', '2026-10-01').events.length, 1);
    assert.equal(searchQuickDestinations('SearchSessionsFixture', 'zh-Hans', '2026-10-03').events.length, 0);
    assert.deepEqual(searchQuickDestinations('SearchOffersFixture', 'zh-Hans', '2026-09-29').offers.map(offer => offer.id), ['search-ongoing-fixture', 'search-current-fixture']);
    assert.deepEqual(searchQuickDestinations('SearchOffersFixture', 'zh-Hans', '2026-10-01').offers.map(offer => offer.id), ['search-ongoing-fixture']);
  } finally {
    MONTHLY_EVENTS.splice(eventCount);
    currentFreebies.splice(offerCount);
  }
});

test('offer and opening results expose conditions and status and navigate to their detail pages', () => {
  const offerCount = currentFreebies.length;
  const openingCount = currentOpenings.length;
  const eventCount = MONTHLY_EVENTS.length;
  const opened: string[] = [];
  try {
    currentFreebies.push({ ...currentFreebies[0], id: 'search-eligible-fixture', title: 'SearchEligibilityFixture', brand: 'Test Benefits', availability: 'ongoing', dateLabel: '持续福利 · 以当前资格为准', startDate: undefined, endDate: undefined, requirement: '仅限有效福利卡持有人及最多三名同行者；需出示证件。' });
    currentOpenings.push(
      { ...currentOpenings[0], id: 'search-soft-fixture', name: 'SearchSoftFixture', status: 'soft_open', dateLabel: '试营业；正式开业日未确认', openedOn: undefined },
      { ...currentOpenings[0], id: 'search-announced-fixture', name: 'SearchAnnouncedFixture', status: 'announced', dateLabel: '原计划2020年；仍待营业确认', openedOn: undefined },
    );
    MONTHLY_EVENTS.push({ ...MONTHLY_EVENTS[0], id: 'search-route-fixture', title: 'SearchEventRouteFixture', startDate: '2099-10-01', endDate: '2099-10-01', occurrenceDates: ['2099-10-01'] });
    const view = render(<QuickExplore onClose={() => {}} onSearch={() => {}} onNavigate={path => opened.push(path)} onAsk={() => {}} />);
    const input = view.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'SearchEligibilityFixture' } });
    const offer = view.getByRole('option', { name: /^Test Benefits.*SearchEligibilityFixture/ });
    assert.match(offer.textContent || '', /仅限有效福利卡.*最多三名同行者.*证件/);
    fireEvent.click(offer);
    fireEvent.change(input, { target: { value: 'SearchSoftFixture' } });
    const soft = view.getByRole('option', { name: /^SearchSoftFixture/ });
    assert.match(soft.textContent || '', /试营业/);
    fireEvent.click(soft);
    fireEvent.change(input, { target: { value: 'SearchAnnouncedFixture' } });
    const announced = view.getByRole('option', { name: /^SearchAnnouncedFixture/ });
    assert.match(announced.textContent || '', /开业预告/);
    assert.doesNotMatch(announced.textContent || '', /已开业/);
    fireEvent.click(announced);
    fireEvent.change(input, { target: { value: 'SearchEventRouteFixture' } });
    fireEvent.click(view.getByRole('option', { name: /^SearchEventRouteFixture/ }));
    assert.deepEqual(opened, ['/offers/search-eligible-fixture', '/openings/search-soft-fixture', '/openings/search-announced-fixture', '/events/search-route-fixture']);
  } finally {
    currentFreebies.splice(offerCount);
    currentOpenings.splice(openingCount);
    MONTHLY_EVENTS.splice(eventCount);
  }
});
