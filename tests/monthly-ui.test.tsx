import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { EVENT_CONTEXT_PHOTOS, isApprovedEventContextPhoto } from '../src/data/event-image-usage';
import { VERIFIED_PLACE_PHOTO_ALIASES } from '../src/data/verified-place-media-updates';
import { OCTNOV_EVENT_PHOTO_ALIASES } from '../src/data/octnov-2026-event-photo-aliases';
import { getListingImage } from '../src/lib/offer-media';
import { buildEventCalendar, filterMonthlyEvents, getEventStatus } from '../src/lib/monthly';
import type { AppContextValue } from '../src/app/context';
import { api } from '../src/lib/api';
import type { EventEngagement } from '../src/lib/event-engagement';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/this-month' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within, act } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation, Routes, Route, Outlet } = await import('react-router-dom');
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
    // Persistent poster downloads are valid; only the temporary calendar link
    // must be removed. Compare a primitive so a failure cannot deep-print DOM.
    assert.equal(Boolean(document.querySelector(`a[href="${clickedHref}"][download="${downloaded}"]`)), false);
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
// Date eligibility is independently covered by monthly-logic tests. Here it
// supplies the full catalog expectation for UI filters and pagination.
const eligibleEvents = (today = '2026-09-15', filters: Parameters<typeof filterMonthlyEvents>[1] = {}) =>
  filterMonthlyEvents(MONTHLY_EVENTS, filters, today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
const eligibleIds = (today = '2026-09-15', filters: Parameters<typeof filterMonthlyEvents>[1] = {}) =>
  eligibleEvents(today, filters).map(event => event.id);
const eventCards = (view: ReturnType<typeof render>) => [...view.container.querySelectorAll<HTMLElement>('.bl-monthly-event')];
// Exhaustive catalog checks use native semantics and explicit accessible-name
// attributes. Interaction cases below still exercise named role queries. Avoid
// recomputing visibility/style for thousands of nodes for every catalog row.
const requiredElement = <T extends Element = HTMLElement>(root: Element, selector: string): T => {
  const element = root.querySelector<T>(selector);
  assert.ok(element, `Missing ${selector}`);
  return element;
};
const filters = (view: ReturnType<typeof render>) => within(requiredElement(view.container, '.bl-monthly-filters'));
const resultStatus = (view: ReturnType<typeof render>) => {
  const status = requiredElement(view.container, '.bl-monthly-results [role="status"]');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  return status;
};
const eventArticle = (view: ReturnType<typeof render>, id: string) => {
  const heading = view.container.querySelector<HTMLElement>(`#event-${id}`);
  assert.ok(heading, `Missing visible event heading: ${id}`);
  const article = heading.closest('article');
  assert.ok(article, `${id} has an article card`);
  assert.equal(article.getAttribute('role') || 'article', 'article');
  assert.equal(article.getAttribute('aria-labelledby'), heading.id);
  assert.equal(heading.tagName, 'H3');
  assert.equal(heading.textContent, item(id).title);
  assert.equal(article.closest('[hidden], [aria-hidden="true"]'), null);
  return article;
};
const showAllResults = (view: ReturnType<typeof render>) => {
  let pages = 0;
  let pagination = view.container.querySelector<HTMLElement>('#monthly-events > .discovery-load-more');
  while (pagination) {
    assert.ok(++pages <= Math.ceil(MONTHLY_EVENTS.length / 12), 'pagination must make progress');
    fireEvent.click(within(pagination).getByRole('button', { name: '查看更多活动', exact: true }));
    pagination = view.container.querySelector<HTMLElement>('#monthly-events > .discovery-load-more');
  }
};
const assertResultTitles = (view: ReturnType<typeof render>, ids: string[]) => {
  showAllResults(view);
  const actual = eventCards(view).map(card => {
    const heading = card.querySelector('h3')!;
    assert.equal(card.getAttribute('aria-labelledby'), heading.id, 'the event card has a named heading');
    const id = heading.id.replace(/^event-/, '');
    assert.equal(heading.textContent, item(id).title);
    return id;
  });
  assert.deepEqual(actual.sort(), [...ids].sort(), 'only the matching activities are rendered after all pages are revealed');
  const renderedIds = new Set(actual);
  for (const event of MONTHLY_EVENTS.filter(event => !ids.includes(event.id))) assert.equal(renderedIds.has(event.id), false, event.id);
  assert.match(resultStatus(view).textContent!, new RegExp(`找到\\s*${ids.length}\\s*场活动`));
};

test('monthly edition exposes every activity through pagination with named official links and accurate source labels', () => {
  const view = render(edition());
  assert.equal(MONTHLY_EVENTS.some(event => event.id === 'treasure-island-coastal-cleanup-2026'), true, 'the published historical activity remains readable');
  assertResultTitles(view, eligibleIds());
  assert.equal(view.container.querySelector('#event-san-jose-cdm-mid-autumn-2026'), null, 'an empty confirmed schedule does not become an upcoming outing');
  assert.ok(view.getByText('秋季湾区精选'));
  assert.equal(filters(view).getByRole('button', { name: '整个湾区', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((filters(view).getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement).checked, false);
  for (const event of eligibleEvents()) {
    const card = eventArticle(view, event.id);
    const title = requiredElement(card, 'h3 a');
    assert.equal(title.textContent, event.title);
    assert.equal(title.getAttribute('href'), `/events/${event.id}`);
    const official = requiredElement(card, '.bl-monthly-event-actions a[aria-label]');
    assert.equal(official.getAttribute('aria-label'), `查看${event.title}官方详情`);
    assert.equal(official.getAttribute('href'), event.officialUrl);
    assert.equal(official.getAttribute('target'), '_blank');
    assert.match(official.getAttribute('rel')!, /noopener/);
    assert.match(official.getAttribute('rel')!, /noreferrer/);
    assert.equal(requiredElement(card, '.bl-monthly-event-tags span:last-child').textContent, event.costLabel);
    assert.equal(requiredElement(card, '.bl-monthly-source span').textContent, `已核对 ${event.verifiedAt} · ${event.sourceLabel}`);
    const image = GUIDE_IMAGES[event.imageKey];
    if (event.imageKey) assert.ok(image, `${event.id} uses a registered image when provided`);
    if (!event.imageKey || image.kind === 'illustration') {
      assert.equal(card.querySelector('img'), null, `${event.id} must not substitute an unrelated image`);
      assert.equal(card.querySelector('button[aria-label^="放大图片："]'), null, 'text cards have no image lightbox');
      continue;
    }
    const img = requiredElement(card, 'figure img');
    assert.equal(img.getAttribute('alt'), image.alt);
    assert.equal(img.getAttribute('src'), image.src);
    assert.equal(img.getAttribute('srcset'), image.srcSet);
    assert.ok(requiredElement(card, 'figcaption').textContent!.includes(image.caption));
    assert.equal(requiredElement(card, 'button.bl-monthly-picture-frame').getAttribute('aria-label'), `放大图片：${image.alt}`);
    const year = image.caption.match(/(?:19|20)\d{2}/)?.[0];
    const kindLabel = image.kind === 'poster' || /官方|official/i.test(image.credit) ? '官方图' : /资料|往届|archive|historical/i.test(image.caption) ? `资料图${year ? ` · ${year}` : ''}` : '实拍';
    assert.equal(requiredElement(card, '.bl-monthly-picture-kind').textContent, kindLabel, `${event.id} must label the actual media kind`);
    assert.ok(image.creditUrl, `${event.id} needs a traceable image source`);
    const credit = requiredElement(card, 'figcaption a');
    assert.ok(credit.textContent!.includes(image.credit));
    assert.equal(credit.getAttribute('href'), image.creditUrl);
    assert.equal(credit.getAttribute('target'), '_blank');
    assert.equal(credit.getAttribute('rel'), 'noopener noreferrer');
  }
});

test('monthly media files and credits are valid and only reviewed contextual media may be shared', () => {
  assert.ok(MONTHLY_EVENTS.length > 0);
  const recycling = item('san-mateo-shred-ewaste-october-2026');
  assert.equal(recycling.imageKey, '', 'Beresford Park must not be illustrated with a B Street photograph');
  assert.equal(getListingImage(recycling.imageKey), undefined);
  assert.equal(recycling.venue, 'Beresford Park · 2720 Alameda de las Pulgas');
  const rendered = new JSDOM(renderToStaticMarkup(<StaticRouter location="/this-month?q=Beresford"><MonthlyEdition today="2026-10-05" /></StaticRouter>)).window.document;
  const recyclingCard = rendered.getElementById(`event-${recycling.id}`)?.closest('article');
  assert.ok(recyclingCard, 'the published recycling event is still discoverable');
  assert.equal(recyclingCard.querySelector('img'), null, 'the actual recycling card renders no unrelated image');
  assert.ok(recyclingCard.textContent?.includes(recycling.costLabel), 'resident eligibility remains visible');
  const keys = new Set<string>();
  const sourceKeys = new Set<string>();
  const paths = new Set<string>();
  const fingerprints = new Map<string, { key: string; eventId: string }>();
  const reviewedPhotoAliases = { ...VERIFIED_PLACE_PHOTO_ALIASES, ...OCTNOV_EVENT_PHOTO_ALIASES };
  const originalKey = (key: string) => reviewedPhotoAliases[key]?.sourceKey || key;
  const assertSharedContext = (key: string, eventId: string) => {
    const image = GUIDE_IMAGES[key];
    if (image.kind === 'illustration') {
      assert.match(image.caption, /插图|插画/);
      assert.match(image.caption, /非|不是|不代表|不对应.*真实活动|虚构|示意/);
      return;
    }
    assert.equal(image.kind, 'photo', `${eventId} must not reuse another event's poster`);
    assert.ok(isApprovedEventContextPhoto(key, eventId), `${eventId} needs an explicit venue/theme photo approval`);
    assert.match(image.caption, /资料/);
    assert.match(image.caption, /不是|不代表|不表示/);
    if (EVENT_CONTEXT_PHOTOS[key].purpose === 'theme') assert.match(image.caption, /主题/);
  };
  for (const event of MONTHLY_EVENTS) {
    if (!event.imageKey) continue;
    const image = GUIDE_IMAGES[event.imageKey];
    assert.ok(image, event.id);
    const alias = reviewedPhotoAliases[event.imageKey];
    if (alias) {
      const original = GUIDE_IMAGES[alias.sourceKey];
      assert.ok(original, `${event.id}: declared source photograph exists`);
      assert.equal(original.kind, 'photo', 'only a real photograph may receive a venue caption alias');
      assertSharedContext(event.imageKey, event.id);
      assert.equal(EVENT_CONTEXT_PHOTOS[event.imageKey].purpose, 'venue');
      assert.equal(image.caption, alias.caption, 'alias must retain its reviewed venue disclosure');
      for (const field of ['src', 'srcSet', 'kind', 'alt', 'credit', 'creditUrl', 'licenseUrl', 'width', 'height'] as const) {
        assert.equal(image[field], original[field], `${event.id}: alias preserves source ${field}`);
      }
    }
    if (keys.has(event.imageKey)) {
      assertSharedContext(event.imageKey, event.id);
    }
    keys.add(event.imageKey);
    sourceKeys.add(originalKey(event.imageKey));
    assert.match(image.src, /^\/guides\/[a-z0-9/.-]+\.webp$/);
    assert.equal(image.src.includes('..'), false);
    paths.add(image.src);
    assert.ok(image.alt.trim() && image.caption.trim() && image.credit.trim(), `${event.id} retains image context and credit`);
    if (image.kind !== 'illustration') assert.equal(new URL(image.creditUrl!).protocol, 'https:', event.id);
    for (const entry of (image.srcSet || '').split(',').filter(Boolean)) {
      const src = entry.trim().split(/\s+/)[0];
      assert.match(src, /^\/guides\/[a-z0-9/.-]+\.webp$/);
      assert.equal(src.includes('..'), false);
      assert.ok(readFileSync(new URL(`../public${src}`, import.meta.url)).length > 0, `${event.id} thumbnail exists`);
    }
    const bytes = readFileSync(new URL(`../public${image.src}`, import.meta.url));
    const fingerprint = createHash('sha256').update(bytes).digest('hex');
    const previous = fingerprints.get(fingerprint);
    if (previous) {
      assert.equal(originalKey(previous.key), originalKey(event.imageKey), `${event.id} must not disguise ${previous.eventId}'s image as a different asset`);
      assertSharedContext(event.imageKey, event.id);
      assertSharedContext(previous.key, previous.eventId);
    }
    fingerprints.set(fingerprint, { key: event.imageKey, eventId: event.id });
  }
  const illustratedCount = MONTHLY_EVENTS.filter(event => event.imageKey).length;
  assert.ok(illustratedCount > 0, 'retain source checks for the existing illustrated activities');
  assert.equal(paths.size, sourceKeys.size, 'only declared and reviewed venue aliases may share a file');
  assert.equal(fingerprints.size, sourceKeys.size, 'different source filenames must not disguise identical media');
});

test('region, free admission and keyword filters combine and clearing a search restores regional matches', () => {
  const view = render(edition());
  fireEvent.click(filters(view).getByRole('button', { name: '南湾', exact: true }));
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  const southBayFree = eligibleIds('2026-09-15', { region: 'south-bay', cost: 'free' });
  assert.ok(southBayFree.includes('sunnyvale-diwali-2026'));
  assert.ok(!southBayFree.includes('mountain-view-art-wine-2026'));
  assertResultTitles(view, southBayFree);
  fireEvent.change(filters(view).getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'DiWaLi' } });
  assertResultTitles(view, ['sunnyvale-diwali-2026']);
  const params = queryParams(view);
  assert.equal(params.get('region'), 'south-bay');
  assert.equal(params.get('cost'), 'free');
  assert.equal(params.get('q'), 'DiWaLi');
  fireEvent.change(filters(view).getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: '' } });
  assertResultTitles(view, southBayFree);
  assert.equal(queryParams(view).has('q'), false);
  assert.equal(filters(view).getByRole('button', { name: '南湾', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('URL filter choices survive unmounting and revisiting the resulting address', () => {
  const first = render(edition());
  fireEvent.click(filters(first).getByRole('button', { name: '东湾', exact: true }));
  fireEvent.change(filters(first).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  fireEvent.change(filters(first).getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'Oaktoberfest' } });
  fireEvent.click(filters(first).getByRole('checkbox', { name: '也看已结束活动' }));
  const savedUrl = first.getByTestId('current-route').textContent!;
  assert.equal(new URL(savedUrl, 'http://localhost').searchParams.get('includeEnded'), '1');
  first.unmount();

  const revisited = render(edition('2026-09-15', savedUrl));
  assert.equal(filters(revisited).getByRole('button', { name: '东湾', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((filters(revisited).getByRole('combobox', { name: '活动入场费用' }) as HTMLSelectElement).value, 'free');
  assert.equal((filters(revisited).getByRole('searchbox', { name: '搜索当月活动' }) as HTMLInputElement).value, 'Oaktoberfest');
  assert.equal((filters(revisited).getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement).checked, true);
  assertResultTitles(revisited, ['oakland-oaktoberfest-2026']);
});

test('date shortcuts combine with region, cost and search, and a shared weekend URL restores the selection', () => {
  const first = render(edition('2026-09-30', '/this-month?lang=zh-Hant'));
  fireEvent.click(filters(first).getByRole('button', { name: '这个周末', exact: true }));
  fireEvent.click(filters(first).getByRole('button', { name: '南湾', exact: true }));
  fireEvent.change(filters(first).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  fireEvent.change(filters(first).getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'Sunnyvale' } });
  assertResultTitles(first, ['sunnyvale-diwali-2026']);
  assert.equal(queryParams(first).get('when'), 'weekend');
  assert.equal(queryParams(first).get('lang'), 'zh-Hant');
  assert.deepEqual([...first.container.querySelectorAll('.bl-monthly-date-range time')].map(time => time.getAttribute('datetime')), ['2026-10-03', '2026-10-04']);
  const savedUrl = first.getByTestId('current-route').textContent!;
  first.unmount();

  const revisited = render(edition('2026-09-30', savedUrl));
  assert.equal(filters(revisited).getByRole('button', { name: '这个周末', exact: true }).getAttribute('aria-pressed'), 'true');
  assertResultTitles(revisited, ['sunnyvale-diwali-2026']);
  fireEvent.change(filters(revisited).getByRole('searchbox', { name: '搜索当月活动' }), { target: { value: 'San Jose' } });
  assertResultTitles(revisited, []);
  fireEvent.click(filters(revisited).getByRole('button', { name: '全部日期', exact: true }));
  assert.equal(queryParams(revisited).has('when'), false);
  assertResultTitles(revisited, ['san-jose-avenida-altares-2026', 'san-jose-first-friday-ballet-2026', 'san-jose-hellflowers-free-concert-oct2-2026', 'san-jose-sjma-dia-muertos-community-2026', 'san-jose-365-night-market-october-2026']);
  const addedConcert = item('san-jose-hellflowers-free-concert-oct2-2026');
  assert.equal(addedConcert.city, 'San Jose');
  assert.equal(addedConcert.cost, 'free');
  assert.deepEqual(addedConcert.occurrenceDates, ['2026-10-02'], 'the new Friday concert appears only after clearing the October 3–4 weekend filter');
  const addedNightMarket = item('san-jose-365-night-market-october-2026');
  assert.equal(addedNightMarket.city, 'San Jose');
  assert.equal(addedNightMarket.cost, 'free');
  assert.deepEqual(addedNightMarket.occurrenceDates, ['2026-10-30', '2026-10-31'], 'the new late-October night market appears only after clearing the October 3–4 weekend filter');
  fireEvent.change(filters(revisited).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'all' } });
  showAllResults(revisited);
  assert.ok(revisited.getByRole('article', { name: item('san-jose-short-film-festival-2026').title, exact: true }));
});

test('empty date filters reset without deleting language or automatically restoring ended events', () => {
  const view = render(edition('2026-10-01', '/this-month?when=today&region=sf&cost=free&q=Opera&includeEnded=0&lang=en'));
  assertResultTitles(view, []);
  assert.equal(filters(view).getByRole('button', { name: '今天', exact: true }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(view.getByRole('button', { name: '清除筛选条件' }));
  assertResultTitles(view, eligibleIds('2026-10-01'));
  assert.equal(queryParams(view).toString(), 'lang=en');
  assert.equal(filters(view).getByRole('button', { name: '全部日期', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((filters(view).getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement).checked, false);
});

test('next seven days shows its inclusive date range and invalid date parameters safely default to all dates', () => {
  const view = render(edition('2026-10-25', '/this-month?when=invalid'));
  assert.equal(filters(view).getByRole('button', { name: '全部日期', exact: true }).getAttribute('aria-pressed'), 'true');
  assertResultTitles(view, eligibleIds('2026-10-25'));
  fireEvent.click(filters(view).getByRole('button', { name: '未来 7 天', exact: true }));
  assert.ok(view.getByText('包含今天'));
  assert.equal(queryParams(view).get('when'), 'next7');
  assert.deepEqual([...view.container.querySelectorAll('.bl-monthly-date-range time')].map(time => time.getAttribute('datetime')), ['2026-10-25', '2026-10-31']);
  assertResultTitles(view, eligibleIds('2026-10-25', { date: 'next7' }));
  assert.ok(eventArticle(view, 'sf-halloween-hoopla-2026'), 'the seventh day remains included');
  assert.equal(view.container.querySelector('#event-calistoga-eleanor-alberga-2026'), null, 'an earlier concert is not restored by the range');
});

test('new regional activities keep mixed-cost registration and ticketed events out of free-admission results', () => {
  const view = render(edition('2026-09-15', '/this-month?when=september'));
  fireEvent.click(filters(view).getByRole('button', { name: '北湾', exact: true }));
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  assertResultTitles(view, eligibleIds('2026-09-15', { date: 'september', region: 'north-bay', cost: 'free' }));
  assert.ok(eventArticle(view, 'petaluma-pumpkin-patch-2026'), 'confirmed free basic entry remains discoverable despite paid extras');
  assert.equal(view.container.querySelector('#event-sonoma-farm-trails-fall-tour-2026'), null, 'free directory registration does not make every farm experience free');
  assert.equal(view.container.querySelector('#event-r2-santarosa-ross-street-sundays-2026'), null, 'unknown admission is not advertised as free');
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'all' } });
  assertResultTitles(view, eligibleIds('2026-09-15', { date: 'september', region: 'north-bay' }));
  const farm = within(view.getByRole('article', { name: item('sonoma-farm-trails-fall-tour-2026').title, exact: true }));
  assert.ok(farm.getByText(item('sonoma-farm-trails-fall-tour-2026').costLabel, { exact: true }));
  assert.match(farm.getByRole('list').textContent!, /无需出示Eventbrite票/);
  fireEvent.click(filters(view).getByRole('button', { name: '半岛', exact: true }));
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'free' } });
  assertResultTitles(view, eligibleIds('2026-09-15', { date: 'september', region: 'peninsula', cost: 'free' }));
  assert.equal(view.container.querySelector('#event-redwood-oktoberfest-closing-weekend-2026'), null, 'ticketed admission is not free');
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动入场费用' }), { target: { value: 'all' } });
  assertResultTitles(view, eligibleIds('2026-09-15', { date: 'september', region: 'peninsula' }));
  assert.ok(eventArticle(view, 'redwood-oktoberfest-closing-weekend-2026'));
});

test('September and October shortcuts persist in URLs and include events spanning the month boundary', () => {
  const view = render(edition('2026-09-15', '/this-month?lang=zh-Hant'));
  fireEvent.click(filters(view).getByRole('button', { name: '整个十月', exact: true }));
  assert.equal(queryParams(view).get('when'), 'october');
  assert.equal(queryParams(view).get('lang'), 'zh-Hant');
  assertResultTitles(view, eligibleIds('2026-09-15', { date: 'october' }));
  assert.ok(view.getByRole('article', { name: item('petaluma-pumpkin-patch-2026').title, exact: true }), 'a September opening that runs through October remains discoverable');
  assert.deepEqual([...view.container.querySelectorAll('.bl-monthly-date-range time')].map(time => time.getAttribute('datetime')), ['2026-10-01', '2026-10-31']);
  const saved = view.getByTestId('current-route').textContent!;
  view.unmount();
  const restored = render(edition('2026-09-15', saved));
  assert.equal(filters(restored).getByRole('button', { name: '整个十月', exact: true }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(filters(restored).getByRole('button', { name: '九月回顾', exact: true }));
  assert.equal(queryParams(restored).get('when'), 'september');
  assert.equal(queryParams(restored).get('includeEnded'), '1', 'the September archive includes completed events');
  assertResultTitles(restored, eligibleIds('2026-09-15', { date: 'september', includeEnded: true }));
  assert.equal(restored.container.querySelector('#event-san-jose-cdm-mid-autumn-2026'), null, 'an empty confirmed schedule cannot be inferred from its September bounds');
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
    showAllResults(view);
    assert.ok(view.getByRole('article', { name: item(expectedId).title, exact: true }), `${today} offers a verified local outing`);
    for (const event of MONTHLY_EVENTS.filter(event => getEventStatus(event, today) === 'ended')) {
      assert.equal(view.container.querySelector(`[id="event-${event.id}"]`), null, `${event.id} has ended before ${today}`);
    }
    view.unmount();
  }
  const halloween = render(edition('2026-10-31', '/this-month?when=today'));
  assertResultTitles(halloween, eligibleIds('2026-10-31', { date: 'today' }));
  assert.ok(eventArticle(halloween, 'sf-halloween-hoopla-2026'));
});

test('empty filter results offer a working reset while keeping the three place recommendations available', () => {
  const view = render(edition('2026-09-15', '/this-month?region=north-bay&cost=free&q=不存在的活动'));
  assertResultTitles(view, []);
  assert.ok(view.getByRole('heading', { name: '这组条件下，暂时没有活动' }));
  for (const place of MONTHLY_PLACES) assert.ok(view.getByRole('heading', { name: place.title }));
  fireEvent.click(view.getByRole('button', { name: '清除筛选条件' }));
  assertResultTitles(view, eligibleIds());
  assert.equal(queryParams(view).toString(), '');
  assert.equal((filters(view).getByRole('searchbox', { name: '搜索当月活动' }) as HTMLInputElement).value, '');
  assert.equal((filters(view).getByRole('combobox', { name: '活动入场费用' }) as HTMLSelectElement).value, 'all');
  assert.equal(filters(view).getByRole('button', { name: '整个湾区', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('December archives the edition while retaining confirmed cross-month activities and hiding ended events until requested', () => {
  const october = render(edition('2026-10-01'));
  assert.equal(october.queryByRole('complementary', { name: '往期内容提示' }), null);
  assert.ok(october.getByText('秋季湾区精选'));
  assert.ok(october.getByRole('link', { name: /挑一个秋季活动/ }));
  assertResultTitles(october, eligibleIds('2026-10-01'));
  october.unmount();

  const view = render(edition('2026-12-01'));
  const notice = view.getByRole('complementary', { name: '往期内容提示' });
  assert.ok(notice.textContent!.includes(MONTHLY_EDITION.label));
  assert.match(notice.textContent!, /不是当前月份的最新活动/);
  assert.ok(view.getByText('往期月刊'));
  assert.equal(view.queryByText('秋季湾区精选'), null);
  assert.equal(view.queryByRole('link', { name: /挑一个秋季活动/ }), null);
  const continuing = eligibleIds('2026-12-01');
  assert.ok(continuing.every(id => getEventStatus(MONTHLY_EVENTS.find(event => event.id === id)!, '2026-12-01') !== 'ended'));
  assertResultTitles(view, continuing);
  assert.equal(view.container.querySelector('#event-pleasanton-pumpkins-after-dark-2026'), null, 'a broad season end does not extend confirmed October sessions');
  const toggle = filters(view).getByRole('checkbox', { name: '也看已结束活动' }) as HTMLInputElement;
  assert.equal(toggle.checked, false);
  fireEvent.click(toggle);
  assert.equal(queryParams(view).get('includeEnded'), '1');
  assertResultTitles(view, MONTHLY_EVENTS.map(event => event.id));
  for (const event of MONTHLY_EVENTS) {
    const card = eventArticle(view, event.id);
    const dateReminder = card.querySelector('button[aria-label^="下载"]');
    if (getEventStatus(event, '2026-12-01') === 'ended') {
      assert.equal(requiredElement(card, '.bl-monthly-status').textContent, '已结束');
      assert.equal(dateReminder, null);
    } else {
      assert.ok(continuing.includes(event.id), 'only confirmed cross-month activities remain active');
      assert.equal(dateReminder?.getAttribute('aria-label'), `下载${event.title}日期提醒`);
      assert.notEqual(requiredElement(card, '.bl-monthly-status').textContent, '已结束');
    }
    assert.equal(requiredElement(card, '.bl-monthly-event-actions a[aria-label]').getAttribute('aria-label'), `查看${event.title}官方详情`);
  }
  fireEvent.click(toggle);
  assertResultTitles(view, continuing);
  assert.equal(queryParams(view).get('includeEnded'), '0');
  fireEvent.click(toggle);
  assertResultTitles(view, MONTHLY_EVENTS.map(event => event.id));
});

test('event planning details expand to readable steps and date-reminder controls have activity-specific labels', () => {
  const view = render(edition());
  const event = item('portola-2026');
  showAllResults(view);
  const cardElement = eventArticle(view, event.id);
  const card = within(cardElement);
  assert.ok(card.getByRole('button', { name: `下载${event.title}日期提醒` }));
  const summary = card.getByText('去之前，先做好这些安排');
  const details = summary.closest('details')!;
  assert.equal(details.open, false);
  fireEvent.click(summary);
  assert.equal(details.open, true);
  const steps = within(card.getByRole('list')).getAllByRole('listitem');
  assert.equal(steps.length, 3);
  event.plan.forEach((tip, index) => assert.ok(steps[index].textContent!.includes(tip)));
  assert.match(steps.map(step => step.textContent).join(' '), /21\s*岁|21\+/, 'the admission age restriction remains readable regardless of step order');
  fireEvent.click(summary);
  assert.equal(details.open, false);
  assert.match(view.getByText(/“日期提醒”下载仅含活动日期/).textContent!, /不含具体场次与入场时间/);
});

test('four-step activity preparations retain their final directions or ticket-source note in the expandable list', () => {
  for (const id of ['woodside-djerassi-free-art-hike-oct5-2026', 'fremont-fog-diwali-mela-2026']) {
    const event = item(id);
    assert.equal(event.plan.length, 4);
    const view = render(edition('2026-09-30', '/this-month?q=' + encodeURIComponent(event.title)));
    const card = within(eventArticle(view, id));
    const summary = card.getByText('去之前，先做好这些安排');
    fireEvent.click(summary);
    assert.equal(summary.closest('details')!.open, true);
    assert.deepEqual([...card.getByRole('list').querySelectorAll('li p')].map(step => step.textContent), event.plan);
    assert.match(event.plan[3], /https:\/\//, 'the separately recorded official directions or ticket evidence remains available');
    view.unmount();
  }
});

test('monthly spotlight changes current-month language to archive language in both full and compact layouts', () => {
  for (const compact of [false, true]) {
    const view = render(<MemoryRouter><MonthlySpotlight today="2026-09-15" compact={compact} /></MemoryRouter>);
    let link = view.getByRole('link', { name: `阅读${MONTHLY_EDITION.label}湾区月刊` });
    assert.equal(link.getAttribute('href'), '/this-month');
    assert.match(link.textContent!, /本月精选/);
    const activeCount = eligibleEvents().length;
    assert.ok(link.textContent!.includes(`${activeCount} 场可赴的活动`));
    view.rerender(<MemoryRouter><MonthlySpotlight today="2026-10-01" compact={compact} /></MemoryRouter>);
    assert.match(view.getByRole('link', { name: `阅读${MONTHLY_EDITION.label}湾区月刊` }).textContent!, /本月精选/);
    view.rerender(<MemoryRouter><MonthlySpotlight today="2026-12-01" compact={compact} /></MemoryRouter>);
    link = view.getByRole('link', { name: `阅读${MONTHLY_EDITION.label}湾区月刊` });
    assert.match(link.textContent!, /往期精选/);
    assert.ok(link.textContent!.includes(`${MONTHLY_EDITION.label} 的活动记录`));
    assert.doesNotMatch(link.textContent!, /本月精选|这个月|可赴的活动/);
    view.unmount();
  }
});

test('server HTML limits the first page to six real activities and preserves full result counts and archive rules', t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('SSR must not fetch participation'); });
  const request = t.mock.method(api, 'request', async () => { throw new Error('SSR must not request engagement'); });
  for (const [today, path, includeEnded] of [
    ['2026-09-15', '/this-month', false],
    ['2026-10-01', '/this-month', false],
    ['2026-11-01', '/this-month', false],
    ['2026-11-01', '/this-month?includeEnded=1', true],
  ] as const) {
    const html = renderToStaticMarkup(<StaticRouter location={path}><MonthlyEdition today={today} /></StaticRouter>);
    const server = new JSDOM(html).window.document;
    const links = [...server.querySelectorAll('a')];
    const eligible = eligibleEvents(today, { includeEnded });
    const firstPage = new Set(eligible.slice(0, 6).map(event => event.id));
    assert.equal(server.querySelectorAll('.bl-monthly-event').length, Math.min(6, eligible.length));
    assert.match(server.querySelector('[role="status"]')!.textContent!, new RegExp('找到\\s*' + eligible.length + '\\s*场活动'));
    for (const event of MONTHLY_EVENTS) {
      const heading = [...server.querySelectorAll('h3')].find(element => element.textContent === event.title);
      assert.equal(Boolean(heading), firstPage.has(event.id), today + ': ' + event.id + ' follows first-page and expiry rules');
      if (!heading) continue;
      const card = heading.closest('article')!;
      assert.ok([...card.querySelectorAll('a')].some(link => link.getAttribute('href') === event.officialUrl));
      assert.ok([...card.querySelectorAll('a')].some(link => link.getAttribute('href') === '/events/' + event.id), 'each card links to its complete indexable detail page');
      for (const step of event.plan) assert.ok(card.textContent!.includes(step), 'native details retain crawlable planning content');
      assert.equal(Boolean(card.querySelector('.event-interest span')), false, 'unknown participation does not expose a false count');
      assert.doesNotMatch(card.querySelector('.event-participation')!.textContent!, /0 人想去/);
      if (getEventStatus(event, today) === 'ended') assert.equal(card.querySelector('button[aria-label^="下载"]'), null);
    }
    assert.equal(MONTHLY_PLACES.length, 3);
    for (const place of MONTHLY_PLACES) {
      assert.ok([...server.querySelectorAll('h3')].some(heading => heading.textContent === place.title));
      assert.ok(links.some(link => link.getAttribute('href') === place.officialUrl));
      assert.ok(links.some(link => link.getAttribute('href') === '/guides/' + place.relatedGuideSlug));
    }
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(request.mock.callCount(), 0);
});

test('load more reveals twelve additional cards without changing totals and filters reset the first page', () => {
  const view = render(edition());
  assert.ok(MONTHLY_EVENTS.length >= 30, 'enough published activities to exercise three pages');
  assert.equal(eventCards(view).length, 6);
  assert.ok(resultStatus(view).textContent!.includes(`找到 ${eligibleEvents().length} 场活动`));
  fireEvent.click(view.getByRole('button', { name: '查看更多活动', exact: true }));
  assert.equal(eventCards(view).length, 18);
  fireEvent.click(view.getByRole('button', { name: '查看更多活动', exact: true }));
  assert.equal(eventCards(view).length, 30);
  assert.ok(resultStatus(view).textContent!.includes(`找到 ${eligibleEvents().length} 场活动`));
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动类型' }), { target: { value: 'family' } });
  const families = eligibleEvents().filter(event => event.category === 'family' && !['sports', 'performance'].includes(event.kind || ''));
  assert.equal(eventCards(view).length, Math.min(6, families.length), 'changing type returns to the initial page');
  assert.equal(queryParams(view).get('category'), 'family');
  assertResultTitles(view, families.map(event => event.id));
  assert.equal(view.queryByRole('button', { name: '查看更多活动', exact: true }), null);
});

test('unknown filter and sort values fall back safely while preserving unrelated URL parameters', () => {
  const view = render(edition('2026-09-15', '/this-month?region=unknown&cost=unknown&when=unknown&category=unknown&view=unknown&sort=unknown&lang=zh-Hant'));
  assert.equal(filters(view).getByRole('button', { name: '整个湾区', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(filters(view).getByRole('button', { name: '全部日期', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(filters(view).getByRole('button', { name: '全部活动', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((filters(view).getByRole('combobox', { name: '活动类型' }) as HTMLSelectElement).value, 'all');
  assert.equal((filters(view).getByRole('combobox', { name: '活动排列方式' }) as HTMLSelectElement).value, 'soon');
  assert.equal((filters(view).getByRole('combobox', { name: '活动入场费用' }) as HTMLSelectElement).value, 'all');
  assert.equal(eventCards(view).length, 6);
  assertResultTitles(view, eligibleIds());
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动类型' }), { target: { value: 'culture' } });
  assert.equal(queryParams(view).get('lang'), 'zh-Hant');
  assertResultTitles(view, eligibleEvents().filter(event => event.category === 'culture' && event.kind !== 'sports' && event.kind !== 'performance').map(event => event.id));
});

test('without app context the browser does not fetch or manufacture zero interest counts', async t => {
  const request = t.mock.method(api, 'request', async () => { throw new Error('Missing app context must not request engagement'); });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden'); });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(edition()); });
  assert.equal(eventCards(view).length, 6);
  for (const card of eventCards(view)) {
    assert.equal(Boolean(card.querySelector('.event-interest span')), false);
    assert.doesNotMatch(card.querySelector('.event-participation')!.textContent!, /0 人想去/);
  }
  assert.equal(request.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
  fireEvent.click(filters(view).getByRole('button', { name: '我的想去', exact: true }));
  assert.equal(queryParams(view).get('view'), 'interested');
  assert.ok(view.getByRole('button', { name: '登录查看我的想去', exact: true }));
  assert.equal(eventCards(view).length, 0);
});

const withAppContext = (app: Partial<AppContextValue>, url = '/this-month') =>
  <MemoryRouter initialEntries={[url]}><Routes><Route element={<Outlet context={app} />}><Route path="/this-month" element={<><MonthlyEdition today="2026-09-15" /><LocationProbe /></>} /></Route></Routes></MemoryRouter>;

test('real engagement drives popularity, my-interest and buddy filters together with type and date', async t => {
  const familyId = 'windsor-trick-or-treat-trail-2026';
  const cultureId = 'san-jose-avenida-altares-2026';
  const earlierId = 'novato-youth-folk-dance-2026';
  const entries: EventEngagement[] = MONTHLY_EVENTS.map(event => ({
    eventId: event.id,
    interestedCount: event.id === familyId ? 12 : event.id === cultureId ? 20 : event.id === earlierId ? 12 : 0,
    buddyCount: [familyId, cultureId].includes(event.id) ? 2 : 0,
    me: { interested: [familyId, earlierId].includes(event.id), lookingForBuddy: event.id === familyId },
  }));
  const requestedIds: string[][] = [];
  t.mock.method(api, 'request', async (path: string) => {
    assert.ok(path.startsWith('/events/engagement?'), 'only a read of engagement is expected');
    const ids = new URL(path, 'http://localhost').searchParams.get('ids')!.split(',').sort();
    requestedIds.push(ids);
    assert.ok(ids.length <= 100, 'each engagement request stays within the client batch limit');
    return { events: entries.filter(entry => ids.includes(entry.eventId)) };
  });
  const app = { user: { id: 'monthly-ui-user' }, setShowLogin: () => {}, showToast: () => {} } as unknown as Partial<AppContextValue>;
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(withAppContext(app, '/this-month?sort=popular&lang=zh-Hant')); });
  assert.equal(requestedIds.length, Math.ceil(MONTHLY_EVENTS.length / 100));
  assert.deepEqual(requestedIds.flat().sort(), MONTHLY_EVENTS.map(event => event.id).sort(), 'all event IDs are loaded once across the bounded requests');
  const shownIds = () => eventCards(view).map(card => card.getAttribute('aria-labelledby')!.replace(/^event-/, ''));
  assert.deepEqual(shownIds().slice(0, 3), [cultureId, earlierId, familyId], 'counts descend; equal counts use earlier dates');
  const first = within(view.getByRole('article', { name: item(cultureId).title, exact: true }));
  assert.match(first.getByText('20 人想去 · 意向不等于报名或购票。').textContent!, /^20 人想去/);
  fireEvent.click(filters(view).getByRole('button', { name: '我的想去', exact: true }));
  assertResultTitles(view, [familyId, earlierId]);
  assert.equal(queryParams(view).get('view'), 'interested');
  fireEvent.click(filters(view).getByRole('button', { name: '整个十月', exact: true }));
  assertResultTitles(view, [familyId]);
  fireEvent.click(filters(view).getByRole('button', { name: '正在找搭子', exact: true }));
  assertResultTitles(view, [familyId, cultureId]);
  fireEvent.change(filters(view).getByRole('combobox', { name: '活动类型' }), { target: { value: 'culture' } });
  assertResultTitles(view, [cultureId]);
  const savedUrl = view.getByTestId('current-route').textContent!;
  const savedParams = queryParams(view);
  assert.equal(savedParams.get('category'), 'culture');
  assert.equal(savedParams.get('when'), 'october');
  assert.equal(savedParams.get('view'), 'buddies');
  assert.equal(savedParams.get('sort'), 'popular');
  assert.equal(savedParams.get('lang'), 'zh-Hant');
  view.unmount();
  await act(async () => { view = render(withAppContext(app, savedUrl)); });
  assertResultTitles(view, [cultureId]);
  assert.equal((filters(view).getByRole('combobox', { name: '活动排列方式' }) as HTMLSelectElement).value, 'popular');
  assert.equal(filters(view).getByRole('button', { name: '正在找搭子', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('failed engagement leaves counts unknown and offers retry instead of a false empty buddy list', async t => {
  t.mock.method(api, 'request', async () => { throw new Error('Engagement service unavailable'); });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(withAppContext({ user: null }, '/this-month?view=buddies')); });
  assert.ok(view.getByText('出行意向暂时无法加载，请重试。'));
  assert.ok(view.getByRole('button', { name: '重试', exact: true }));
  assert.equal(view.queryByRole('heading', { name: '这组条件下，还没有人公开找搭子' }), null);
  assert.equal(Boolean(view.container.querySelector('.bl-monthly-results strong')), false, 'unavailable membership must not be announced as zero matches');
  assert.equal(eventCards(view).length, 0);
  await act(async () => { fireEvent.click(filters(view).getByRole('button', { name: '全部活动', exact: true })); });
  assert.equal(eventCards(view).length, 6);
  for (const card of eventCards(view)) {
    assert.equal(Boolean(card.querySelector('.event-interest span')), false);
    assert.ok(within(card).getByText('人数暂时无法加载'));
  }
});

test('ordinary browsing reads only displayed cards, expands incrementally and refreshes the active scope on focus', async t => {
  const requests: string[][] = [];
  t.mock.method(api, 'request', async (path: string) => {
    const ids = new URL(path, 'http://localhost').searchParams.get('ids')!.split(',');
    requests.push(ids);
    return { events: ids.map(eventId => ({ eventId, interestedCount: 0, buddyCount: 0, me: null })) };
  });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(withAppContext({ user: null })); });
  const visibleIds = () => eventCards(view).map(card => card.getAttribute('aria-labelledby')!.slice(6)).sort();
  const first = visibleIds();
  assert.equal(first.length, 6);
  assert.deepEqual(requests, [first], 'initial request contains only the six visible cards');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '查看更多活动', exact: true })); });
  const expanded = visibleIds();
  assert.equal(expanded.length, 18);
  assert.deepEqual(requests[1], expanded.filter(id => !first.includes(id)), 'only twelve new cards are fetched');
  assert.equal(new Set(requests.flat()).size, 18);
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); });
  assert.deepEqual(requests[2], expanded, 'focus refreshes all visible counts rather than the whole catalog');
});

test('switching to popularity waits for unseen counts and can rank an event outside the first batch first', async t => {
  const target = eligibleIds().at(-1)!;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let hold = false;
  const requests: string[][] = [];
  t.mock.method(api, 'request', async (path: string) => {
    const ids = new URL(path, 'http://localhost').searchParams.get('ids')!.split(',');
    requests.push(ids);
    if (hold) await pending;
    return { events: ids.map(eventId => ({ eventId, interestedCount: eventId === target ? 90 : 0, buddyCount: 0, me: null })) };
  });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(withAppContext({ user: null })); });
  assert.ok(!requests[0].includes(target));
  hold = true;
  await act(async () => { fireEvent.change(filters(view).getByRole('combobox', { name: '活动排列方式' }), { target: { value: 'popular' } }); });
  assert.equal(eventCards(view).length, 0, 'incomplete counts must not produce a misleading popularity ranking');
  assert.ok(view.getByText('正在读取大家的出行意向…'));
  await act(async () => { release(); });
  assert.equal(eventCards(view)[0].getAttribute('aria-labelledby'), `event-${target}`);
  assert.deepEqual(requests.flat().sort(), MONTHLY_EVENTS.map(event => event.id).sort(), 'cached plus new requests cover every candidate exactly once');
});

test('buddy and private-interest filters include matching events beyond the ordinary visible batch', async t => {
  const target = eligibleIds().at(-1)!;
  const requested: string[] = [];
  t.mock.method(api, 'request', async (path: string) => {
    const ids = new URL(path, 'http://localhost').searchParams.get('ids')!.split(',');
    requested.push(...ids);
    return { events: ids.map(eventId => ({ eventId, interestedCount: eventId === target ? 1 : 0, buddyCount: eventId === target ? 1 : 0,
      me: { interested: eventId === target, lookingForBuddy: eventId === target } })) };
  });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(withAppContext({ user: { id: 'reader' } } as Partial<AppContextValue>)); });
  assert.ok(!requested.includes(target));
  await act(async () => { fireEvent.click(filters(view).getByRole('button', { name: '正在找搭子', exact: true })); });
  assertResultTitles(view, [target]);
  assert.equal(new Set(requested).size, MONTHLY_EVENTS.length);
  const count = requested.length;
  await act(async () => { fireEvent.click(filters(view).getByRole('button', { name: '我的想去', exact: true })); });
  assertResultTitles(view, [target]);
  assert.equal(requested.length, count, 'changing full-catalog views reuses confirmed counts in the same session');
});

test('an ordinary empty search performs no engagement requests', async t => {
  const request = t.mock.method(api, 'request', async () => { throw new Error('An empty candidate list has no counts to request'); });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(withAppContext({ user: null }, '/this-month?q=absent-test-only-candidate')); });
  assert.equal(eventCards(view).length, 0);
  assert.equal(request.mock.callCount(), 0);
});
