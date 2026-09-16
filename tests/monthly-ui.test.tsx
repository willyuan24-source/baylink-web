import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { buildEventCalendar } from '../src/lib/monthly';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/this-month' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { MonthlySpotlight } = await import('../src/components/MonthlySpotlight');

afterEach(() => cleanup());

test('date reminder button downloads the selected event calendar and releases its temporary URL', async () => {
  const selected = MONTHLY_EVENTS[0];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = dom.window.HTMLAnchorElement.prototype.click;
  let captured: Blob | undefined;
  let downloaded = '';
  let clickedHref = '';
  let released = '';
  let resolveRelease: () => void = () => {};
  const release = new Promise<void>(resolve => { resolveRelease = resolve; });
  URL.createObjectURL = (blob: Blob | MediaSource) => { captured = blob as Blob; return 'blob:baylink-calendar-test'; };
  URL.revokeObjectURL = (url: string) => { released = url; resolveRelease(); };
  dom.window.HTMLAnchorElement.prototype.click = function () {
    assert.equal(this.isConnected, true);
    downloaded = this.download;
    clickedHref = this.href;
  };
  try {
    const view = render(<MemoryRouter><MonthlyEdition today="2026-09-15" /></MemoryRouter>);
    fireEvent.click(view.getByRole('button', { name: `下载${selected.title}日期提醒`, exact: true }));
    assert.equal(downloaded, `baylink-${selected.id}.ics`);
    assert.equal(clickedHref, 'blob:baylink-calendar-test');
    assert.ok(captured);
    assert.equal(captured.type, 'text/calendar;charset=utf-8');
    assert.equal(await captured.text(), buildEventCalendar(selected));
    assert.equal(document.querySelector('a[download]'), null);
    await release;
    assert.equal(released, clickedHref);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    dom.window.HTMLAnchorElement.prototype.click = originalClick;
  }
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-route">{location.pathname}{location.search}</span>;
}
const edition = (today = '2026-09-15', url = '/this-month') =>
  <MemoryRouter initialEntries={[url]}><MonthlyEdition today={today} /><LocationProbe /></MemoryRouter>;
const item = (id: string) => {
  const found = MONTHLY_EVENTS.find(event => event.id === id);
  assert.ok(found, `Missing published activity: ${id}`);
  return found;
};
const queryParams = (view: ReturnType<typeof render>) => new URL(view.getByTestId('current-route').textContent!, 'http://localhost').searchParams;
const assertResultTitles = (view: ReturnType<typeof render>, ids: string[]) => {
  const expected = new Set(ids);
  for (const event of MONTHLY_EVENTS) {
    assert.equal(Boolean(view.queryByRole('article', { name: event.title, exact: true })), expected.has(event.id), event.id);
  }
  assert.match(view.getByRole('status').textContent!, new RegExp(`找到\\s*${ids.length}\\s*场活动`));
};

test('monthly edition initially exposes every activity with named official links and accurate source labels', () => {
  const view = render(edition());
  assert.ok(MONTHLY_EVENTS.some(event => event.id === 'treasure-island-coastal-cleanup-2026'));
  assertResultTitles(view, MONTHLY_EVENTS.map(event => event.id));
  assert.ok(view.getByText('秋季湾区精选'));
  assert.equal(view.getByRole('button', { name: '整个湾区', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((view.getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement).checked, false);
  for (const event of MONTHLY_EVENTS) {
    const card = within(view.getByRole('article', { name: event.title, exact: true }));
    const official = card.getByRole('link', { name: `查看${event.title}官方详情` });
    assert.equal(official.getAttribute('href'), event.officialUrl);
    assert.equal(official.getAttribute('target'), '_blank');
    assert.match(official.getAttribute('rel')!, /noopener/);
    assert.match(official.getAttribute('rel')!, /noreferrer/);
    assert.ok(card.getByText(event.costLabel, { exact: true }));
    assert.ok(card.getByText(`已核对 ${event.verifiedAt} · ${event.sourceLabel}`));
    const image = GUIDE_IMAGES[event.imageKey];
    if (!event.imageKey) {
      assert.equal(card.queryByRole('img'), null, `${event.id} must not substitute an unrelated image`);
      continue;
    }
    assert.ok(image, `${event.id} uses a registered image when provided`);
    const img = card.getByRole('img', { name: image.alt });
    assert.equal(img.getAttribute('src'), image.src);
    assert.equal(img.getAttribute('srcset'), image.srcSet);
    assert.ok(card.getByText(image.caption));
    assert.ok(card.getByRole('button', { name: `放大图片：${image.alt}` }));
    const kindLabel = image.kind === 'poster' ? '官方宣传图' : image.kind === 'illustration' ? 'BAYLINK 主题插图 · AI 创作' : image.caption.includes('资料') ? '资料照片' : '实景照片';
    assert.ok(card.getByText(kindLabel, { exact: true }), `${event.id} must label the actual media kind`);
    if (image.kind !== 'illustration') {
      assert.ok(image.creditUrl, `${event.id} needs a traceable image source`);
      const credit = card.getByRole('link', { name: new RegExp(image.credit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
      assert.equal(credit.getAttribute('href'), image.creditUrl);
      assert.equal(credit.getAttribute('target'), '_blank');
      assert.equal(credit.getAttribute('rel'), 'noopener noreferrer');
    }
  }
});

test('illustrated monthly activities use distinct registered assets and distinct actual image bytes', () => {
  assert.ok(MONTHLY_EVENTS.length > 0);
  const keys = new Set<string>();
  const paths = new Set<string>();
  const fingerprints = new Map<string, string>();
  for (const event of MONTHLY_EVENTS) {
    if (!event.imageKey) continue;
    const image = GUIDE_IMAGES[event.imageKey];
    assert.ok(image, event.id);
    assert.equal(keys.has(event.imageKey), false, `${event.id} reuses an event image key`);
    keys.add(event.imageKey);
    assert.match(image.src, /^\/guides\/[a-z0-9/.-]+\.webp$/);
    assert.equal(image.src.includes('..'), false);
    assert.equal(paths.has(image.src), false, `${event.id} reuses an event image path`);
    paths.add(image.src);
    const bytes = readFileSync(new URL(`../public${image.src}`, import.meta.url));
    const fingerprint = createHash('sha256').update(bytes).digest('hex');
    assert.equal(fingerprints.has(fingerprint), false, `${event.id} duplicates the image bytes used by ${fingerprints.get(fingerprint)}`);
    fingerprints.set(fingerprint, event.id);
  }
  const illustratedCount = MONTHLY_EVENTS.filter(event => event.imageKey).length;
  assert.ok(illustratedCount > 0, 'retain source checks for the existing illustrated activities');
  assert.equal(keys.size, illustratedCount);
  assert.equal(paths.size, illustratedCount);
  assert.equal(fingerprints.size, illustratedCount, 'different filenames must not disguise reuse of a generic event illustration');
});

test('region, free admission and keyword filters combine and clearing a search restores regional matches', () => {
  const view = render(edition());
  fireEvent.click(view.getByRole('button', { name: '南湾', exact: true }));
  fireEvent.change(view.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  const southBayFree = MONTHLY_EVENTS.filter(event => event.region === 'south-bay' && event.cost === 'free').map(event => event.id);
  assert.ok(southBayFree.includes('sunnyvale-diwali-2026'));
  assert.ok(!southBayFree.includes('mountain-view-art-wine-2026'));
  assertResultTitles(view, southBayFree);
  fireEvent.change(view.getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'bArK' } });
  assertResultTitles(view, ['bark-in-the-park-san-jose-2026']);
  const params = queryParams(view);
  assert.equal(params.get('region'), 'south-bay');
  assert.equal(params.get('cost'), 'free');
  assert.equal(params.get('q'), 'bArK');
  fireEvent.change(view.getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: '' } });
  assertResultTitles(view, southBayFree);
  assert.equal(queryParams(view).has('q'), false);
  assert.equal(view.getByRole('button', { name: '南湾', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('URL filter choices survive unmounting and revisiting the resulting address', () => {
  const first = render(edition());
  fireEvent.click(first.getByRole('button', { name: '东湾', exact: true }));
  fireEvent.change(first.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  fireEvent.change(first.getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'Lafayette' } });
  fireEvent.click(first.getByRole('checkbox', { name: '也看已结束活动' }));
  const savedUrl = first.getByTestId('current-route').textContent!;
  assert.equal(new URL(savedUrl, 'http://localhost').searchParams.get('includeEnded'), '1');
  first.unmount();

  const revisited = render(edition('2026-09-15', savedUrl));
  assert.equal(revisited.getByRole('button', { name: '东湾', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((revisited.getByRole('combobox', { name: '活动入场费用' }) as HTMLSelectElement).value, 'free');
  assert.equal((revisited.getByRole('searchbox', { name: '搜索当月活动' }) as HTMLInputElement).value, 'Lafayette');
  assert.equal((revisited.getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement).checked, true);
  assertResultTitles(revisited, ['lafayette-art-wine-2026']);
});

test('date shortcuts combine with region, cost and search, and a shared weekend URL restores the selection', () => {
  const first = render(edition('2026-09-30', '/this-month?lang=zh-Hant'));
  fireEvent.click(first.getByRole('button', { name: '这个周末', exact: true }));
  fireEvent.click(first.getByRole('button', { name: '南湾', exact: true }));
  fireEvent.change(first.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  fireEvent.change(first.getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'Sunnyvale' } });
  assertResultTitles(first, ['sunnyvale-diwali-2026']);
  assert.equal(queryParams(first).get('when'), 'weekend');
  assert.equal(queryParams(first).get('lang'), 'zh-Hant');
  assert.deepEqual([...first.container.querySelectorAll('.bl-monthly-date-range time')].map(time => time.getAttribute('datetime')), ['2026-10-03', '2026-10-04']);
  const savedUrl = first.getByTestId('current-route').textContent!;
  first.unmount();

  const revisited = render(edition('2026-09-30', savedUrl));
  assert.equal(revisited.getByRole('button', { name: '这个周末', exact: true }).getAttribute('aria-pressed'), 'true');
  assertResultTitles(revisited, ['sunnyvale-diwali-2026']);
  fireEvent.change(revisited.getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'San Jose' } });
  assertResultTitles(revisited, []);
  fireEvent.click(revisited.getByRole('button', { name: '全部日期', exact: true }));
  assert.equal(queryParams(revisited).has('when'), false);
  assertResultTitles(revisited, []);
  fireEvent.change(revisited.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'all' } });
  assert.ok(revisited.getByRole('article', { name: item('san-jose-short-film-festival-2026').title, exact: true }));
});

test('empty date filters reset without deleting language or automatically restoring ended events', () => {
  const view = render(edition('2026-10-01', '/this-month?when=today&region=sf&cost=free&q=Opera&includeEnded=0&lang=en'));
  assertResultTitles(view, []);
  assert.equal(view.getByRole('button', { name: '今天', exact: true }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(view.getByRole('button', { name: '清除筛选条件' }));
  assertResultTitles(view, MONTHLY_EVENTS.filter(event => event.endDate >= '2026-10-01').map(event => event.id));
  assert.equal(queryParams(view).toString(), 'lang=en');
  assert.equal(view.getByRole('button', { name: '全部日期', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((view.getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement).checked, false);
});

test('next seven days shows its inclusive date range and invalid date parameters safely default to all dates', () => {
  const view = render(edition('2026-10-25', '/this-month?when=invalid'));
  assert.equal(view.getByRole('button', { name: '全部日期', exact: true }).getAttribute('aria-pressed'), 'true');
  assertResultTitles(view, MONTHLY_EVENTS.filter(event => event.endDate >= '2026-10-25').map(event => event.id));
  fireEvent.click(view.getByRole('button', { name: '未来 7 天', exact: true }));
  assert.ok(view.getByText('包含今天'));
  assert.equal(queryParams(view).get('when'), 'next7');
  assert.deepEqual([...view.container.querySelectorAll('.bl-monthly-date-range time')].map(time => time.getAttribute('datetime')), ['2026-10-25', '2026-10-31']);
  assertResultTitles(view, ['petaluma-pumpkin-patch-2026', 'san-jose-short-film-festival-2026', 'bay-area-musical-improv-festival-2026', 'menlo-park-trunk-or-treat-2026', 'sf-halloween-hoopla-2026']);
});

test('new regional activities keep mixed-cost registration and ticketed events out of free-admission results', () => {
  const view = render(edition('2026-09-15', '/this-month?when=september'));
  fireEvent.click(view.getByRole('button', { name: '北湾', exact: true }));
  fireEvent.change(view.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  assertResultTitles(view, ['san-rafael-porchfest-2026', 'petaluma-fall-antique-faire-2026']);
  fireEvent.change(view.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'all' } });
  assertResultTitles(view, ['mill-valley-fall-arts-2026', 'san-rafael-porchfest-2026', 'sonoma-farm-trails-fall-tour-2026', 'petaluma-fall-antique-faire-2026', 'petaluma-pumpkin-patch-2026']);
  const farm = within(view.getByRole('article', { name: item('sonoma-farm-trails-fall-tour-2026').title, exact: true }));
  assert.ok(farm.getByText('免费登记且必须登记 · 部分农场体验另收费或预约'));
  fireEvent.click(view.getByRole('button', { name: '半岛', exact: true }));
  fireEvent.change(view.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  assertResultTitles(view, ['pacific-coast-fog-fest-2026']);
  fireEvent.change(view.getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'all' } });
  assertResultTitles(view, ['pacific-coast-fog-fest-2026', 'redwood-oktoberfest-closing-weekend-2026']);
});

test('September and October shortcuts persist in URLs and include events spanning the month boundary', () => {
  const view = render(edition('2026-09-15', '/this-month?lang=zh-Hant'));
  fireEvent.click(view.getByRole('button', { name: '整个十月', exact: true }));
  assert.equal(queryParams(view).get('when'), 'october');
  assert.equal(queryParams(view).get('lang'), 'zh-Hant');
  assertResultTitles(view, MONTHLY_EVENTS.filter(event => event.startDate <= '2026-10-31' && event.endDate >= '2026-10-01').map(event => event.id));
  assert.ok(view.getByRole('article', { name: item('petaluma-pumpkin-patch-2026').title, exact: true }), 'a September opening that runs through October remains discoverable');
  assert.deepEqual([...view.container.querySelectorAll('.bl-monthly-date-range time')].map(time => time.getAttribute('datetime')), ['2026-10-01', '2026-10-31']);
  const saved = view.getByTestId('current-route').textContent!;
  view.unmount();
  const restored = render(edition('2026-09-15', saved));
  assert.equal(restored.getByRole('button', { name: '整个十月', exact: true }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(restored.getByRole('button', { name: '九月余下', exact: true }));
  assert.equal(queryParams(restored).get('when'), 'september');
  assertResultTitles(restored, MONTHLY_EVENTS.filter(event => event.startDate <= '2026-09-30').map(event => event.id));
  assert.equal(restored.queryByRole('article', { name: item('sf-halloween-hoopla-2026').title, exact: true }), null);
});

test('every October weekend including Halloween has a published activity and excludes already ended cards', () => {
  for (const [today, expectedId] of [
    ['2026-10-03', 'sunnyvale-diwali-2026'],
    ['2026-10-10', 'san-carlos-art-wine-faire-2026'],
    ['2026-10-17', 'half-moon-bay-pumpkin-festival-2026'],
    ['2026-10-24', 'menlo-park-halloween-hoopla-2026'],
    ['2026-10-31', 'sf-halloween-hoopla-2026'],
  ]) {
    const view = render(edition(today, '/this-month?when=weekend'));
    assert.ok(view.getByRole('article', { name: item(expectedId).title, exact: true }), `${today} offers a verified local outing`);
    for (const event of MONTHLY_EVENTS.filter(event => event.endDate < today)) {
      assert.equal(view.queryByRole('article', { name: event.title, exact: true }), null, `${event.id} has ended before ${today}`);
    }
    view.unmount();
  }
  const halloween = render(edition('2026-10-31', '/this-month?when=today'));
  assertResultTitles(halloween, ['petaluma-pumpkin-patch-2026', 'sf-halloween-hoopla-2026']);
});

test('empty filter results offer a working reset while keeping the three place recommendations available', () => {
  const view = render(edition('2026-09-15', '/this-month?region=north-bay&cost=free&q=不存在的活动'));
  assertResultTitles(view, []);
  assert.ok(view.getByRole('heading', { name: '这组条件下，暂时没有活动' }));
  for (const place of MONTHLY_PLACES) assert.ok(view.getByRole('heading', { name: place.title }));
  fireEvent.click(view.getByRole('button', { name: '清除筛选条件' }));
  assertResultTitles(view, MONTHLY_EVENTS.map(event => event.id));
  assert.equal(queryParams(view).toString(), '');
  assert.equal((view.getByRole('searchbox', { name: '搜索当月活动' }) as HTMLInputElement).value, '');
  assert.equal((view.getByRole('combobox', { name: '活动入场费用' }) as HTMLSelectElement).value, 'all');
  assert.equal(view.getByRole('button', { name: '整个湾区', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('October remains current, while November archives the edition and hides ended events until requested', () => {
  const october = render(edition('2026-10-01'));
  assert.equal(october.queryByRole('complementary', { name: '往期内容提示' }), null);
  assert.ok(october.getByText('秋季湾区精选'));
  assert.ok(october.getByRole('link', { name: /挑一个秋季活动/ }));
  assertResultTitles(october, MONTHLY_EVENTS.filter(event => event.endDate >= '2026-10-01').map(event => event.id));
  october.unmount();

  const view = render(edition('2026-11-01'));
  const notice = view.getByRole('complementary', { name: '往期内容提示' });
  assert.ok(notice.textContent!.includes(MONTHLY_EDITION.label));
  assert.match(notice.textContent!, /不是当前月份的最新活动/);
  assert.ok(view.getByText('往期月刊'));
  assert.equal(view.queryByText('秋季湾区精选'), null);
  assert.equal(view.queryByRole('link', { name: /挑一个秋季活动/ }), null);
  assertResultTitles(view, []);
  const toggle = view.getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement;
  assert.equal(toggle.checked, false);
  fireEvent.click(toggle);
  assert.equal(queryParams(view).get('includeEnded'), '1');
  assertResultTitles(view, MONTHLY_EVENTS.map(event => event.id));
  for (const event of MONTHLY_EVENTS) {
    const card = within(view.getByRole('article', { name: event.title, exact: true }));
    assert.ok(card.getByText('已结束', { exact: true }));
    assert.equal(card.queryByRole('button', { name: `下载${event.title}日期提醒` }), null);
    assert.ok(card.getByRole('link', { name: `查看${event.title}官方详情` }));
  }
  fireEvent.click(toggle);
  assertResultTitles(view, []);
  assert.equal(queryParams(view).get('includeEnded'), '0');
  fireEvent.click(toggle);
  assertResultTitles(view, MONTHLY_EVENTS.map(event => event.id));
});

test('event planning details expand to readable steps and date-reminder controls have activity-specific labels', () => {
  const view = render(edition());
  const event = item('portola-2026');
  const cardElement = view.getByRole('article', { name: event.title, exact: true });
  const card = within(cardElement);
  assert.ok(card.getByRole('button', { name: `下载${event.title}日期提醒` }));
  const summary = card.getByText('去之前，先安排这三件事');
  const details = summary.closest('details')!;
  assert.equal(details.open, false);
  fireEvent.click(summary);
  assert.equal(details.open, true);
  const steps = within(card.getByRole('list')).getAllByRole('listitem');
  assert.equal(steps.length, 3);
  event.plan.forEach((tip, index) => assert.ok(steps[index].textContent!.includes(tip)));
  assert.match(steps[0].textContent!, /21 岁/);
  fireEvent.click(summary);
  assert.equal(details.open, false);
  assert.match(view.getByText(/“日期提醒”下载仅含活动日期/).textContent!, /不含具体场次与入场时间/);
});

test('monthly spotlight changes current-month language to archive language in both full and compact layouts', () => {
  for (const compact of [false, true]) {
    const view = render(<MemoryRouter><MonthlySpotlight today="2026-09-15" compact={compact} /></MemoryRouter>);
    let link = view.getByRole('link', { name: `阅读${MONTHLY_EDITION.label}湾区月刊` });
    assert.equal(link.getAttribute('href'), '/this-month');
    assert.match(link.textContent!, /本月精选/);
    const activeCount = MONTHLY_EVENTS.filter(event => event.endDate >= '2026-09-15').length;
    assert.ok(link.textContent!.includes(`${activeCount} 场可赴的活动`));
    view.rerender(<MemoryRouter><MonthlySpotlight today="2026-10-01" compact={compact} /></MemoryRouter>);
    assert.match(view.getByRole('link', { name: `阅读${MONTHLY_EDITION.label}湾区月刊` }).textContent!, /本月精选/);
    view.rerender(<MemoryRouter><MonthlySpotlight today="2026-11-01" compact={compact} /></MemoryRouter>);
    link = view.getByRole('link', { name: `阅读${MONTHLY_EDITION.label}湾区月刊` });
    assert.match(link.textContent!, /往期精选/);
    assert.ok(link.textContent!.includes(`${MONTHLY_EDITION.label} 的活动记录`));
    assert.doesNotMatch(link.textContent!, /本月精选|这个月|可赴的活动/);
    view.unmount();
  }
});

test('server HTML contains visible activities and planning text, with ended events available by explicit URL', () => {
  for (const [today, path, includeEnded] of [['2026-09-15', '/this-month', false], ['2026-10-01', '/this-month', false], ['2026-11-01', '/this-month?includeEnded=1', true]] as const) {
    const html = renderToStaticMarkup(<StaticRouter location={path}><MonthlyEdition today={today} /></StaticRouter>);
    const server = new JSDOM(html).window.document;
    const links = [...server.querySelectorAll('a')];
    for (const event of MONTHLY_EVENTS) {
      const heading = [...server.querySelectorAll('h3')].find(element => element.textContent === event.title);
      if (!includeEnded && event.endDate < today) {
        assert.equal(heading, undefined, `${today}: ${event.id} must not reappear after expiry`);
        continue;
      }
      assert.ok(heading, `${today}: ${event.id} has a server-rendered title`);
      const card = heading.closest('article')!;
      assert.ok([...card.querySelectorAll('a')].some(link => link.getAttribute('href') === event.officialUrl));
      for (const step of event.plan) assert.ok(card.textContent!.includes(step), 'collapsed native details retain crawlable planning content');
    }
    assert.equal(MONTHLY_PLACES.length, 3);
    for (const place of MONTHLY_PLACES) {
      assert.ok([...server.querySelectorAll('h3')].some(heading => heading.textContent === place.title));
      assert.ok(links.some(link => link.getAttribute('href') === place.officialUrl));
      assert.ok(links.some(link => link.getAttribute('href') === `/guides/${place.relatedGuideSlug}`));
    }
  }
});
