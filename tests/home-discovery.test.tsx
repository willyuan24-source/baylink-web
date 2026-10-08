import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getHomeWeekend, getWeeklyCardHref } from '../src/lib/home-weekend';
import { MONTHLY_EVENTS, HOME_WEEKENDS } from '../src/lib/home-catalog';
import { WEEKEND_PICKS, type WeekendPickEntry } from '../src/data/weekend-picks';
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

const assertEditorialRender = async (today: string) => {
  const picks = getHomeWeekend(today).picks;
  assert.ok(picks.some(pick => pick.editorial), `${today} has an editor pick`);
  const doc = new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></StaticRouter>)).window.document;
  const cards = [...doc.querySelectorAll('.home-weekend-card')];
  assert.deepEqual(cards.map(card => card.querySelector('h3 a')!.getAttribute('href')), picks.map(pick => `/events/${pick.event.id}`));
  picks.forEach(({ editorial }, index) => {
    const line = cards[index].querySelector('.home-weekend-pick');
    if (!editorial) return assert.equal(line, null, 'automatic picks carry no editor label');
    assert.equal(line!.querySelector('span')!.textContent, '编辑精选');
    // A hidden separator keeps label and reason apart for screen readers and copy.
    assert.equal(line!.textContent, `编辑精选：${editorial.reason.zh}`);
  });
  assert.equal(doc.querySelector('.home-weekly-share a[download]')!.getAttribute('href'), getWeeklyCardHref(today));
  const { setLocale } = await import('../src/i18n/locale');
  try {
    for (const [locale, prefix, label] of [['en', '/en', "Editor's pick"], ['zh-Hant', '/zh-Hant', '編輯精選']] as const) {
      await setLocale(locale, false);
      const view = render(<MemoryRouter basename={prefix} initialEntries={[`${prefix}/`]}><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
      const lines = [...view.container.querySelectorAll('.home-weekend-pick')];
      assert.equal(lines.length, picks.filter(pick => pick.editorial).length, locale);
      for (const line of lines) assert.equal(line.querySelector('span')!.textContent, label);
      if (locale === 'en') assert.equal(lines[0].textContent, `Editor's pick: ${picks.find(pick => pick.editorial)!.editorial!.reason.en}`);
      view.unmount();
    }
  } finally {
    await setLocale('zh-Hans', false);
  }
};

test('editor picks show their reason in each edition and the share link matches the day', async () => {
  // Render the published picks while a snapshot day has them. Follow the
  // snapshots instead of a fixed date, so advancing the edition's review date
  // cannot strand this check on a day without picks.
  const days = Object.keys(HOME_WEEKENDS).sort();
  const published = days.find(day => getHomeWeekend(day).picks.some(pick => pick.editorial));
  if (published) await assertEditorialRender(published);
  // Always render an injected pick as well, so the label path keeps running
  // after the current weekend is deleted from src/data/weekend-picks.ts.
  const snapshots = HOME_WEEKENDS as Record<string, { ids: string[] }>;
  const day = days.filter(item => snapshots[item].ids.length >= 2).at(-1)!;
  const saturday = getHomeWeekend(day).start;
  const editorPicks = WEEKEND_PICKS as Record<string, readonly WeekendPickEntry[]>;
  const original = editorPicks[saturday];
  editorPicks[saturday] = [{ id: snapshots[day].ids[1], reason: { zh: '测试理由', en: 'Test reason' } }];
  try {
    await assertEditorialRender(day);
  } finally {
    if (original) editorPicks[saturday] = original;
    else delete editorPicks[saturday];
  }
});

test('a compact home pool reports the entire weekend calendar count, including Sunday-only eligibility', () => {
  // Generation begins at the current edition's review date; historical days
  // before that boundary have no full-catalog snapshot. Check every published
  // snapshot, so advancing checkedAt cannot leave this regression on an old day.
  const daysWithSnapshots = Object.keys(HOME_WEEKENDS).sort();
  assert.ok(daysWithSnapshots.length > 0, 'the compact pool publishes calendar totals');
  assert.ok(daysWithSnapshots.some(day => new Date(`${day}T12:00:00Z`).getUTCDay() === 0), 'Sunday-only coverage is exercised');
  for (const today of daysWithSnapshots) {
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
