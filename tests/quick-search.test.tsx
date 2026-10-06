import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { searchQuickDestinations } = await import('../src/lib/quick-search');
const { QuickExplore } = await import('../src/components/QuickExplore');
const { ModalShell } = await import('../src/components/ui/Modal');
const { setLocale } = await import('../src/i18n/locale');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { currentFreebies } = await import('../src/data/october-offers');
const { currentOpenings } = await import('../src/data/local-discoveries');
const { PLANNER_EVENTS } = await import('../src/data/planner-catalog');
const { eventOccursOn } = await import('../src/lib/event-calendar');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('ordinary multilingual outing questions retain useful dated events and separately unverified places', async () => {
  for (const [locale, query] of [['zh-Hant', '今天有什麼活動，地方好去？'], ['zh-Hans', '今天有什么活动，好玩的地方？'], ['en', 'What events and places can I visit today?'], ['en', 'things to do today']] as const) {
    await setLocale(locale, false);
    const results = searchQuickDestinations(query, locale, '2026-10-04');
    assert.ok(results.events.length > 0, query);
    assert.ok(results.events.every(event => eventOccursOn(event, '2026-10-04')), 'events must actually occur on the requested day');
    assert.equal(results.attractions.length, 0, 'place hours are not confirmed availability');
    assert.ok(results.unverified.attractions.length > 0, 'general outings keep places as separately unverified references');
    assert.deepEqual(results.queryInfo.tokens, [], query);
    assert.deepEqual(results.queryInfo.dateRange, { start: '2026-10-04', end: '2026-10-04' });
  }
});

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

test('cached search opens with input focus and Escape returns to the keyboard opener on every visit', () => {
  // The module above is already loaded: no Suspense fallback delays portal mounting.
  // jsdom has no layout, so expose connected controls to ModalShell's visibility check.
  const previousRects = dom.window.HTMLElement.prototype.getClientRects;
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
  };
  function CachedSearchHost() {
    const [open, setOpen] = React.useState(false);
    return <><button type="button" onClick={() => setOpen(true)}>Open cached search</button>
      {open && <QuickExplore onClose={() => setOpen(false)} onSearch={() => {}} onNavigate={() => {}} onAsk={() => {}} />}</>;
  }
  const view = render(<CachedSearchHost />);
  try {
    const opener = view.getByRole('button', { name: 'Open cached search' });
    for (let visit = 0; visit < 2; visit++) {
      opener.focus();
      fireEvent.click(opener, { detail: 0 });
      const input = view.getByRole('combobox');
      assert.ok(document.activeElement === input, 'search remains ready for immediate typing');
      fireEvent.change(input, { target: { value: '小费' } });
      assert.equal((input as HTMLInputElement).value, '小费');
      fireEvent.keyDown(input, { key: 'Escape' });
      assert.equal(view.queryByRole('dialog'), null);
      assert.ok(document.activeElement === opener, 'Escape restores the same keyboard trigger');
    }
  } finally {
    view.unmount();
    dom.window.HTMLElement.prototype.getClientRects = previousRects;
  }
});

for (const strict of [false, true]) {
  test(`cold search fallback transfers focus to the input and back to its original opener${strict ? ' in StrictMode' : ''}`, async () => {
    let resolveChunk!: (value: { default: typeof QuickExplore }) => void;
    const chunk = new Promise<{ default: typeof QuickExplore }>(resolve => { resolveChunk = resolve; });
    const DeferredSearch = React.lazy(() => chunk);
    function ColdSearchHost() {
      const [open, setOpen] = React.useState(false);
      const openerRef = React.useRef<HTMLElement | null>(null);
      const close = () => setOpen(false);
      return <><button type="button" onClick={() => { openerRef.current = document.activeElement as HTMLElement | null; setOpen(true); }}>Open cold search</button>
        {open && <React.Suspense fallback={<ModalShell label="Loading search" onClose={close} restoreFocusRef={openerRef}><p role="status">Loading search</p><button onClick={close}>Close loading search</button></ModalShell>}>
          <DeferredSearch restoreFocusRef={openerRef} onClose={close} onSearch={() => {}} onNavigate={() => {}} onAsk={() => {}} />
        </React.Suspense>}</>;
    }
    const previousRects = dom.window.HTMLElement.prototype.getClientRects;
    dom.window.HTMLElement.prototype.getClientRects = function () {
      return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
    };
    const pageRoot = document.createElement('div'); pageRoot.id = 'root'; document.body.append(pageRoot);
    const view = render(strict ? <React.StrictMode><ColdSearchHost /></React.StrictMode> : <ColdSearchHost />, { container: pageRoot, baseElement: document.body });
    try {
      const opener = view.getByRole('button', { name: 'Open cold search' });
      opener.focus(); fireEvent.click(opener, { detail: 0 });
      const loadingClose = view.getByRole('button', { name: 'Close loading search' });
      assert.ok(document.activeElement === loadingClose, 'the real modal fallback must first receive keyboard focus');
      assert.equal(pageRoot.inert, true);
      await act(async () => { resolveChunk({ default: QuickExplore }); await chunk; });
      const input = view.getByRole('combobox');
      assert.equal(view.queryByRole('dialog', { name: 'Loading search' }), null);
      assert.ok(document.activeElement === input, 'resolved search is ready for typing');
      assert.equal(pageRoot.inert, true);
      fireEvent.change(input, { target: { value: '牙医' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      assert.equal(view.queryByRole('dialog'), null);
      assert.ok(document.activeElement === opener, 'the disconnected fallback button must never become the return target');
      assert.equal(pageRoot.inert, false);
      // Opening the same resolved lazy component now exercises the cached path.
      fireEvent.click(opener, { detail: 0 });
      const cachedInput = view.getByRole('combobox');
      assert.ok(document.activeElement === cachedInput);
      fireEvent.keyDown(cachedInput, { key: 'Escape' });
      assert.ok(document.activeElement === opener);
    } finally {
      view.unmount(); pageRoot.remove(); dom.window.HTMLElement.prototype.getClientRects = previousRects;
    }
  });
}

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

test('whole-sentence searches use actual dates, cities and free admission instead of incidental prose', async () => {
  await setLocale('en', false);
  for (const query of ['这个周末旧金山免费活动', 'Show me free events in San Francisco this weekend']) {
    const results = searchQuickDestinations(query, 'en', '2026-09-29');
    assert.ok(results.events.length > 0);
    for (const event of results.events) {
      assert.equal(event.city, 'San Francisco');
      assert.equal(event.cost, 'free');
      assert.ok(event.startDate <= '2026-10-04' && event.endDate >= '2026-10-03');
    }
    assert.equal(results.openings.length, 0);
  }
  assert.ok(searchQuickDestinations('South Bay', 'en', '2026-09-29').offers.every(offer => offer.region === 'south-bay'));
  assert.ok(searchQuickDestinations('San Francisco free', 'en', '2026-09-29').openings.length === 0);
  assert.ok(searchQuickDestinations('周末 旧金山 免费', 'en', '2026-09-29').events.every(event => event.city === 'San Francisco'));
  assert.ok(searchQuickDestinations('South San Francisco events', 'en', '2026-09-29').events.every(event => event.city === 'South San Francisco'));
});

test('indoor, family ages and budgets use known facts; unknown prices and chamber-music wording do not pass', () => {
  const indoor = searchQuickDestinations('室内', 'zh-Hans', '2026-09-29').events;
  assert.ok(indoor.length > 0);
  assert.ok(indoor.every(event => PLANNER_EVENTS.find(item => item.id === event.id)?.planning?.setting === 'indoor'));
  assert.ok(!indoor.some(event => event.id === 'sf-quinteto-latino-lunchtime-2026'));
  // Scope the known storytime to its city so new valid earlier programs cannot
  // displace it from the three-result preview and mask the age-boundary check.
  assert.ok(searchQuickDestinations('Burlingame 雨天室内带2岁孩子活动', 'zh-Hans', '2026-09-29').events.some(event => event.id === 'burlingame-mandarin-storytime-2026'));
  assert.ok(!searchQuickDestinations('Burlingame 雨天室内带8岁孩子活动', 'zh-Hans', '2026-09-29').events.some(event => event.id === 'burlingame-mandarin-storytime-2026'));
  const count = MONTHLY_EVENTS.length;
  try {
    MONTHLY_EVENTS.push({ ...MONTHLY_EVENTS[0], id: 'unknown-search-budget', title: 'BudgetEvidenceFixture', cost: 'unknown', costLabel: '免费停车，门票未确认', startDate: '2026-10-01', endDate: '2026-10-01', occurrenceDates: undefined });
    assert.equal(searchQuickDestinations('BudgetEvidenceFixture', 'zh-Hans', '2026-09-29').events.length, 1);
    assert.equal(searchQuickDestinations('BudgetEvidenceFixture 免费', 'zh-Hans', '2026-09-29').events.length, 0);
    assert.equal(searchQuickDestinations('BudgetEvidenceFixture under $20', 'zh-Hans', '2026-09-29').events.length, 0);
    assert.equal(searchQuickDestinations('BudgetEvidenceFixture 两人总共80美元', 'zh-Hans', '2026-09-29').events.length, 1, 'a total budget must not become an individual admission cap');
    assert.equal(searchQuickDestinations('BudgetEvidenceFixture 免费停车', 'zh-Hans', '2026-09-29').events.length, 1, 'free parking must not turn unknown admission into a free filter');
  } finally { MONTHLY_EVENTS.splice(count); }
  assert.equal(searchQuickDestinations('帮我找旧金山咖啡20美元以内', 'zh-Hans', '2026-09-29').events.length, 0);
  assert.equal(searchQuickDestinations('不要室内活动', 'zh-Hans', '2026-09-29').events.length, 0, 'unsupported negation should ask for clarification, not recommend the excluded type');
  assert.equal(searchQuickDestinations('10/3或10/4活动', 'zh-Hans', '2026-09-29').events.length, 0, 'alternative dates require clarification');
});

test('requested dates honor discrete occurrences and distinguish ongoing offers and shop hours from confirmed availability', () => {
  const count = MONTHLY_EVENTS.length;
  try {
    MONTHLY_EVENTS.push({ ...MONTHLY_EVENTS[0], id: 'date-search-fixture', title: 'DateEvidenceFixture', startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-02', '2026-10-09'] });
    assert.equal(searchQuickDestinations('DateEvidenceFixture 10/3–10/4', 'zh-Hans', '2026-09-29').events.length, 0);
    assert.equal(searchQuickDestinations('DateEvidenceFixture 10/2', 'zh-Hans', '2026-09-29').events.length, 1);
    assert.equal(searchQuickDestinations('2026-02-30 events', 'zh-Hans', '2026-09-29').events.length, 0);
  } finally { MONTHLY_EVENTS.splice(count); }
  const weekend = searchQuickDestinations('周末', 'zh-Hans', '2026-09-29');
  assert.equal(weekend.openings.length, 0, 'shop prose mentioning weekend is not verified hours');
  assert.ok(weekend.offers.every(offer => offer.availability === 'dated'));
  assert.ok(weekend.unverified.offers.every(offer => offer.availability !== 'dated'));
  assert.ok(weekend.unverified.openings.every(shop => shop.status !== 'announced'));
  const closed = searchQuickDestinations('Broken Dreams 周末', 'zh-Hans', '2026-09-29');
  assert.equal(closed.openings.length + closed.unverified.openings.length, 0, 'published weekend closure must not become a reference suggestion either');
  assert.equal(searchQuickDestinations('旧金山咖啡店', 'zh-Hans', '2026-09-29').events.length, 0, 'cafe intent must not be filled with unrelated events');
});

test('coffee requests do not treat free event admission as a drink price, while explicit coffee events remain searchable', () => {
  const count = MONTHLY_EVENTS.length;
  const id = 'search-coffee-event-fixture';
  try {
    MONTHLY_EVENTS.push({
      ...MONTHLY_EVENTS[0], id, title: 'Neighborhood Fixture', city: 'San Francisco',
      summary: '邻里活动有咖啡店聚会；饮品收费另计。', cost: 'free',
      startDate: '2026-10-18', endDate: '2026-10-18', occurrenceDates: undefined,
    });
    for (const query of ['帮我找旧金山咖啡20美元以内', '幫我找舊金山咖啡20美元以內', 'Find coffee in San Francisco under $20']) {
      const result = searchQuickDestinations(query, 'zh-Hans', '2026-09-29');
      assert.equal(result.queryInfo.intent, 'places');
      assert.equal(result.events.length, 0, 'free event entry is not evidence of a coffee price');
    }
    for (const query of ['旧金山咖啡活动20美元以内', 'coffee events in San Francisco under $20']) {
      const result = searchQuickDestinations(query, 'zh-Hans', '2026-09-29');
      assert.equal(result.queryInfo.intent, 'events');
      assert.ok(result.events.some(event => event.id === id), 'an explicit event request retains relevant coffee events');
    }
  } finally { MONTHLY_EVENTS.splice(count); }
});

test('new search UI explains understood conditions and missing evidence, with the original query handed to BayBay', async () => {
  const asked: (string | undefined)[] = [];
  const view = render(<QuickExplore onClose={() => {}} onSearch={() => {}} onNavigate={() => {}} onAsk={query => asked.push(query)} />);
  const query = '帮我找旧金山咖啡20美元以内，步行15分钟内';
  fireEvent.change(view.getByRole('combobox'), { target: { value: query } });
  assert.match(view.baseElement.textContent || '', /已识别.*San Francisco.*\$20/);
  assert.match(view.baseElement.textContent || '', /未知价格不按免费处理/);
  assert.match(view.baseElement.textContent || '', /尚未计算距离或通行时间/);
  fireEvent.click(view.getByRole('option', { name: /交给 BayBay 继续安排/ }));
  assert.deepEqual(asked, [query]);
  await act(async () => { await setLocale('en', false); });
  assert.match(view.baseElement.textContent || '', /Understood:/);
  assert.match(view.baseElement.textContent || '', /Unknown prices are not treated as free/);
  fireEvent.change(view.getByRole('combobox'), { target: { value: 'events total $80' } });
  assert.match(view.baseElement.textContent || '', /total budget is not applied as a price filter/);
  fireEvent.change(view.getByRole('combobox'), { target: { value: 'no indoor events' } });
  assert.match(view.baseElement.textContent || '', /excluded preferences are not treated as positive filters/);
});
