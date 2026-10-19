import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { EVENT_CONTEXT_PHOTOS, isApprovedEventContextPhoto } from '../src/data/event-image-usage';
import { VERIFIED_PLACE_PHOTO_ALIASES } from '../src/data/verified-place-media-updates';
import { OCTNOV_EVENT_PHOTO_ALIASES } from '../src/data/octnov-2026-event-photo-aliases';
import { getListingImage } from '../src/lib/offer-media';
import { api } from '../src/lib/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/this-month' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// jsdom has no layout: let the Sheet's focus trap see connected controls.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
// The events column imports its stylesheets; here CSS loads as an empty module (the prerender does the same).
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, fireEvent, cleanup, within, act } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { EventsView } = await import('../src/components/EventsView');
const { INDEX_EVENTS, listEvents, matchesFilters, weekendTabs, weekendPicks } = await import('../src/features/events/events-model');
const { isFreeToAttend, nextOccurrence } = await import('../src/lib/monthly');
const { normalizeSearchText } = await import('../src/lib/search-synonyms');

afterEach(() => { cleanup(); localStorage.clear(); });

/**
 * /this-month is the events column on 全部日期 (plan D3, WEB-EVENTS). The old edition's per-card planning steps, date
 * reminders, interest counts and 找搭子 filters moved to the event detail page; the listing card is one link with a cover.
 */
const TODAY = '2026-10-09';
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-route">{location.pathname}{location.search}</span>;
}
const edition = (today = TODAY, url = '/this-month') =>
  <MemoryRouter initialEntries={[url]}><MonthlyEdition today={today} /><LocationProbe /></MemoryRouter>;
const weekendPage = (today: string, url = '/events') =>
  <MemoryRouter initialEntries={[url]}><EventsView today={today} /><LocationProbe /></MemoryRouter>;
const item = (id: string) => {
  const found = INDEX_EVENTS.find(event => event.id === id);
  assert.ok(found, `Missing published activity: ${id}`);
  return found;
};
type View = ReturnType<typeof render>;
const queryParams = (view: View) => new URL(view.getByTestId('current-route').textContent!, 'http://localhost').searchParams;
const feedIds = (root: ParentNode) => [...root.querySelectorAll('#monthly-events .ui-feed-card a.ui-card-link')].map(link => link.getAttribute('href')!.replace(/^\/events\//, ''));
const { arrangePicks, homeLeadFor } = await import('../src/features/events/weekend-lead');
const pickIds = (root: ParentNode) => [...new Set([...root.querySelectorAll('.ev-picks a.ui-card-link')].map(link => link.getAttribute('href')!.replace(/^\/events\/|\?.*$/g, '')))];
const rangeLine = (root: ParentNode) => root.querySelector('.ev-range')?.textContent;
const status = (view: View) => {
  const element = view.container.querySelector('.ev-count')!;
  assert.equal(element.getAttribute('role'), 'status');
  assert.equal(element.getAttribute('aria-live'), 'polite');
  return element.textContent!;
};
/** The expected list for a date filter other than 本周末: next-day order (events-model listEvents). */
const expected = (today: string, filters: { region?: 'all' | 'sf' | 'east-bay' | 'south-bay' | 'peninsula' | 'north-bay'; free?: boolean; q?: string; tag?: import('../src/features/events/events-model').EventTag } = {}, when: Parameters<typeof listEvents>[1] = 'all') =>
  listEvents(INDEX_EVENTS.filter(event => matchesFilters(event, { region: filters.region ?? 'all', free: !!filters.free, q: filters.q ?? '', tag: filters.tag }, normalizeSearchText)), when, today).map(event => event.id);
const showAll = (view: View) => {
  for (let pages = 0; ; pages++) {
    const more = view.queryByRole('button', { name: /^再看 \d+ 场$/ });
    if (!more) return;
    assert.ok(pages <= Math.ceil(INDEX_EVENTS.length / 12), 'pagination must make progress');
    fireEvent.click(more);
  }
};
const assertFeed = (view: View, ids: string[]) => {
  showAll(view);
  assert.deepEqual(feedIds(view.container), ids, 'only the matching activities are listed, in next-day order');
  assert.equal(status(view), `找到 ${ids.length} 场活动`);
};
async function openFilters(view: View) {
  await act(async () => { fireEvent.click(view.getByRole('button', { name: /^筛选/ })); });
  return within(view.getByRole('dialog'));
}
const filterRow = (view: View) => within(view.container.querySelector<HTMLElement>('.ev-rail')!);

test('/this-month lists every live activity through 再看 12 场, each card one link with a cover, never an ended one', () => {
  const view = render(edition());
  assert.equal(rangeLine(view.container), '全部日期 · 收录至 2/28');
  const ids = expected(TODAY);
  assert.ok(ids.length > 100, 'the edition carries the whole autumn catalog');
  assertFeed(view, ids);
  for (const card of view.container.querySelectorAll('#monthly-events .ui-feed-card')) {
    const links = card.querySelectorAll('a');
    assert.equal(links.length, 1, 'the whole card is one link');
    assert.equal(card.querySelectorAll('.ui-feed-card__save button').length, card.querySelectorAll('button').length, 'its only button is the ♡ on the cover (H31)');
    assert.match(links[0].getAttribute('href')!, /^\/events\/[a-z0-9-]+$/);
    assert.ok(card.querySelector('[data-cover="image"], [data-cover="type"]'), 'every card has a cover');
  }
  for (const id of ids) assert.ok(nextOccurrence(item(id), TODAY), `${id} still has a day on or after today`);
  assert.equal(feedIds(view.container).includes('san-jose-cdm-mid-autumn-2026'), false, 'an empty confirmed schedule does not become an upcoming outing');
});

test('monthly media files and credits are valid and only reviewed contextual media may be shared', () => {
  assert.ok(MONTHLY_EVENTS.length > 0);
  const recycling = MONTHLY_EVENTS.find(event => event.id === 'san-mateo-shred-ewaste-october-2026')!;
  assert.equal(recycling.imageKey, '', 'Beresford Park must not be illustrated with a B Street photograph');
  assert.equal(getListingImage(recycling.imageKey), undefined);
  assert.equal(recycling.venue, 'Beresford Park · 2720 Alameda de las Pulgas');
  const rendered = new JSDOM(renderToStaticMarkup(<StaticRouter location="/this-month?q=Beresford"><MonthlyEdition today="2026-10-05" /></StaticRouter>)).window.document;
  const recyclingCard = rendered.querySelector(`#monthly-events a[href="/events/${recycling.id}"]`)?.closest('.ui-feed-card');
  assert.ok(recyclingCard, 'the published recycling event is still discoverable by its venue');
  assert.equal(recyclingCard.querySelector('img'), null, 'the recycling card renders no unrelated image');
  assert.ok(recyclingCard.querySelector('[data-cover="type"]'), 'it gets the information card instead');
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

test('region, free admission and keyword filters combine, and clearing the keyword restores the regional matches', async () => {
  const view = render(edition());
  const sheet = await openFilters(view);
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '南湾', exact: true })); });
  await act(async () => { fireEvent.click(filterRow(view).getByRole('button', { name: '免费', exact: true })); });
  const southBayFree = expected(TODAY, { region: 'south-bay', free: true });
  assert.ok(southBayFree.includes('santa-clara-library-comic-con-2026'));
  assert.ok(southBayFree.length > 5);
  assertFeed(view, southBayFree);
  await act(async () => { fireEvent.change(sheet.getByRole('searchbox', { name: '关键词' }), { target: { value: 'CoMiC cOn' } }); });
  assertFeed(view, ['santa-clara-library-comic-con-2026']);
  const params = queryParams(view);
  assert.equal(params.get('region'), 'south-bay');
  assert.equal(params.get('cost'), 'free');
  assert.equal(params.get('q'), 'CoMiC cOn');
  await act(async () => { fireEvent.change(sheet.getByRole('searchbox', { name: '关键词' }), { target: { value: '' } }); });
  assertFeed(view, southBayFree);
  assert.equal(queryParams(view).has('q'), false);
  assert.equal(sheet.getByRole('button', { name: '南湾', exact: true }).getAttribute('aria-pressed'), 'true');
});

test('URL filter choices survive unmounting and revisiting the resulting address', async () => {
  const first = render(edition());
  const sheet = await openFilters(first);
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '东湾', exact: true })); });
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '免费', exact: true })); });
  await act(async () => { fireEvent.change(sheet.getByRole('searchbox', { name: '关键词' }), { target: { value: 'Powwow' } }); });
  const savedUrl = first.getByTestId('current-route').textContent!;
  first.unmount();
  localStorage.clear();

  const revisited = render(edition(TODAY, savedUrl));
  assert.equal(rangeLine(revisited.container), '全部日期 · 收录至 2/28 · 东湾');
  assert.equal(filterRow(revisited).getByRole('button', { name: '免费', exact: true }).getAttribute('aria-pressed'), 'true');
  // 免费 is on the rail (its own pressed chip); 筛选 counts what was chosen in the sheet: the keyword, also shown as 「Powwow」.
  assert.match(filterRow(revisited).getByRole('button', { name: /^筛选/ }).textContent!, /筛选 1$/, 'the 筛选 chip counts the keyword');
  assert.ok(filterRow(revisited).getByRole('button', { name: '清除：「Powwow」' }));
  const again = await openFilters(revisited);
  assert.equal((again.getByRole('searchbox', { name: '关键词' }) as HTMLInputElement).value, 'Powwow');
  assertFeed(revisited, ['berkeley-indigenous-peoples-powwow-2026']);
});

test('date shortcuts combine with region, cost and search, and a shared weekend URL restores the selection', async () => {
  const today = '2026-10-14'; // Wednesday: the weekend is 10/17–18
  const first = render(edition(today, '/this-month?lang=zh-Hant'));
  const sheet = await openFilters(first);
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '本周末', exact: true })); });
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '南湾', exact: true })); });
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '免费', exact: true })); });
  assert.equal(queryParams(first).get('when'), 'weekend');
  assert.equal(queryParams(first).get('lang'), 'zh-Hant');
  assert.equal(rangeLine(first.container), '本周末 · 10/17–18 · 南湾');
  // 免费 narrows the list, so the editor's picks step aside and every match is in the day tabs.
  assert.deepEqual(pickIds(first.container), []);
  const { tabs } = weekendTabs(INDEX_EVENTS.filter(event => event.region === 'south-bay' && isFreeToAttend(event)), today);
  showAll(first);
  // UI9-EVENTS: the whole weekend on arrival (no day chip checked), each event once.
  const whole = [...new Set([...tabs.sat, ...tabs.open, ...tabs.sun].map(event => event.id))].sort();
  assert.deepEqual([...feedIds(first.container)].sort(), whole, 'the whole weekend first');
  const savedUrl = first.getByTestId('current-route').textContent!;
  first.unmount();

  const revisited = render(edition(today, savedUrl));
  assert.equal(rangeLine(revisited.container), '本周末 · 10/17–18 · 南湾');
  showAll(revisited);
  assert.deepEqual([...feedIds(revisited.container)].sort(), whole);
  const again = await openFilters(revisited);
  await act(async () => { fireEvent.click(again.getByRole('button', { name: '全部日期', exact: true })); });
  assert.equal(queryParams(revisited).has('when'), false, 'the page default leaves the URL');
  assert.equal(queryParams(revisited).get('lang'), 'zh-Hant');
  assertFeed(revisited, expected(today, { region: 'south-bay', free: true }));
});

test('an empty result offers a working reset that keeps the language and the remembered region', async () => {
  const view = render(edition('2026-10-14', '/this-month?when=today&region=sf&cost=free&q=不存在的活动&lang=en'));
  assert.deepEqual(feedIds(view.container), []);
  // The empty card names the query and offers 清除搜索 (UI9-EVENTS §7); with the keyword gone, 清除筛选 resets the rest.
  assert.ok(view.getByRole('heading', { name: '没有找到「不存在的活动」' }));
  assert.ok(view.getByRole('link', { name: '问 BayBay' }).getAttribute('href')!.startsWith('/plan?q='), 'a keyword with no match can go to BayBay');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '清除搜索' })); });
  assert.equal(queryParams(view).has('q'), false);
  if (view.queryByRole('button', { name: '清除筛选' })) await act(async () => { fireEvent.click(view.getByRole('button', { name: '清除筛选' })); });
  else await act(async () => { fireEvent.click(view.getByRole('button', { name: /^筛选/ })); fireEvent.click(within(view.getByRole('dialog')).getByRole('button', { name: '清除', exact: true })); });
  assert.equal(queryParams(view).toString(), 'region=sf&lang=en');
  assertFeed(view, expected('2026-10-14', { region: 'sf' }));
});

test('next seven days shows its inclusive range, and an invalid date parameter falls back to the page default', () => {
  const view = render(edition('2026-10-25', '/this-month?when=invalid'));
  assert.equal(rangeLine(view.container), '全部日期 · 收录至 2/28');
  assertFeed(view, expected('2026-10-25'));
  cleanup();
  const next7 = render(edition('2026-10-25', '/this-month?when=next7'));
  assert.equal(rangeLine(next7.container), '未来 7 天 · 10/25–31');
  const ids = expected('2026-10-25', {}, 'next7');
  assertFeed(next7, ids);
  assert.ok(ids.includes('sf-halloween-hoopla-2026'), 'the seventh day remains included');
  for (const id of ids) assert.ok(nextOccurrence(item(id), '2026-10-25')! <= '2026-10-31', `${id} is within the seven days`);
});

test('mixed-cost entry and unknown admission stay out of 免费, while confirmed free basic entry stays in', () => {
  assert.equal(isFreeToAttend(item('petaluma-pumpkin-patch-2026')), true, 'confirmed free basic entry despite paid extras');
  assert.equal(isFreeToAttend(item('half-moon-bay-pumpkin-festival-2026')), true, 'free festival entry with paid attractions');
  assert.equal(item('r2-santarosa-ross-street-sundays-2026').cost, 'unknown');
  assert.equal(isFreeToAttend(item('r2-santarosa-ross-street-sundays-2026')), false, 'unknown admission is not advertised as free');
  const view = render(edition('2026-10-14', '/this-month?region=north-bay&cost=free'));
  showAll(view);
  const ids = feedIds(view.container);
  assert.deepEqual(ids, expected('2026-10-14', { region: 'north-bay', free: true }));
  assert.ok(ids.includes('petaluma-pumpkin-patch-2026'));
  assert.equal(ids.includes('r2-santarosa-ross-street-sundays-2026'), false);
  for (const id of ids) assert.equal(isFreeToAttend(item(id)), true, id);
});

test('October and November shortcuts persist in URLs and include events spanning the month boundary', async () => {
  const view = render(edition('2026-10-09', '/this-month?lang=zh-Hant'));
  const sheet = await openFilters(view);
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '十一月', exact: true })); });
  assert.equal(queryParams(view).get('when'), 'november');
  assert.equal(queryParams(view).get('lang'), 'zh-Hant');
  assert.equal(rangeLine(view.container), '十一月');
  const november = expected('2026-10-09', {}, 'november');
  assertFeed(view, november);
  assert.ok(november.includes('livermore-great-elephant-migration-2026'), 'an October opening that runs into November remains discoverable');
  const saved = view.getByTestId('current-route').textContent!;
  view.unmount();
  const restored = render(edition('2026-10-09', saved));
  assert.equal(rangeLine(restored.container), '十一月');
  const again = await openFilters(restored);
  assert.equal(again.getByRole('button', { name: '十一月', exact: true }).getAttribute('aria-pressed'), 'true');
  await act(async () => { fireEvent.click(again.getByRole('button', { name: '十月', exact: true })); });
  assert.equal(queryParams(restored).get('when'), 'october');
  assertFeed(restored, expected('2026-10-09', {}, 'october'));
  assert.ok(feedIds(restored.container).includes('livermore-great-elephant-migration-2026'));
});

test('every remaining October weekend including Halloween has a published activity and no ended card', () => {
  for (const [today, expectedId] of [
    ['2026-10-10', 'san-mateo-shred-ewaste-october-2026'],
    ['2026-10-17', 'half-moon-bay-pumpkin-festival-2026'],
    ['2026-10-24', 'menlo-park-halloween-hoopla-2026'],
    ['2026-10-31', 'sf-halloween-hoopla-2026'],
  ]) {
    const { tabs } = weekendTabs(INDEX_EVENTS, today);
    const weekend = new Set([...tabs.sat, ...tabs.sun, ...tabs.open].map(event => event.id));
    assert.ok(weekend.has(expectedId), `${today} offers a verified local outing`);
    const view = render(weekendPage(today));
    showAll(view);
    const shown = [...pickIds(view.container), ...feedIds(view.container)];
    assert.ok(shown.length >= 12, `${today}: the picks and a full first page`);
    for (const id of shown) {
      assert.ok(weekend.has(id), `${id} is on the weekend of ${today}`);
      assert.ok(nextOccurrence(item(id), today), `${id} has not ended before ${today}`);
    }
    // The editor's block: never home's lead (it returns to the feed), the lead first, then up to three pick rows.
    const picks = weekendPicks(INDEX_EVENTS, today, { limit: 5 });
    const { lead, rows } = arrangePicks(picks, today, homeLeadFor(today, picks));
    assert.deepEqual(pickIds(view.container).slice(0, 1 + Math.min(3, rows.length)), [lead!, ...rows.slice(0, 3)].map(pick => pick.event.id));
    cleanup();
  }
  const halloween = render(edition('2026-10-31', '/this-month?when=today'));
  assert.equal(rangeLine(halloween.container), '今天 · 10/31 周六');
  assertFeed(halloween, expected('2026-10-31', {}, 'today'));
  assert.ok(feedIds(halloween.container).includes('sf-halloween-hoopla-2026'));
});

test('after the edition, only confirmed cross-month activities remain and ended ones are never listed', () => {
  // CNT-SUPPLY-3: after the last winter-break weekend (2027-01-04) a few seasonal runs continue on their own published dates
  // (Glowfari to 1/31, IlluminOdyssey to 1/24, and with the SF commit Glow and the Union Square rink). CNT-WEEKEND-1128 runs the
  // edition to 2/28 for the dated 2027 Lunar New Year programmes, which are listed too; nothing else is.
  const view = render(edition('2027-01-04'));
  assert.equal(rangeLine(view.container), '全部日期 · 收录至 2/28', 'the range line names the edition’s last day');
  const continuing = expected('2027-01-04');
  assert.ok(continuing.includes('oakland-zoo-glowfari-2026'), 'Glowfari runs to 1/31');
  assert.ok(continuing.includes('sf-chinese-new-year-parade-2027'), 'the 2/20 parade is listed');
  for (const id of continuing) assert.ok(item(id).endDate > '2027-01-03', `${id} runs past the winter-break weekends`);
  assert.deepEqual([...continuing].sort(), INDEX_EVENTS.filter(event => nextOccurrence(event, '2027-01-04')).map(event => event.id).sort(), 'exactly the activities with a day after the edition');
  showAll(view);
  assert.deepEqual(feedIds(view.container), continuing, 'no ended card is listed');
  cleanup();
  // Mid-December, inside the edition: what still runs is listed and what has ended is not (the old 12/01 check's positive case).
  const mid = render(edition('2026-12-14'));
  assert.equal(rangeLine(mid.container), '全部日期 · 收录至 2/28');
  const running = expected('2026-12-14');
  assert.ok(running.length > 0, 'activities still run after the last supplied weekend');
  assert.ok(running.includes('dickens-christmas-fair-2026'), 'the Dickens Fair runs to 12/20');
  assert.deepEqual([...running].sort(), INDEX_EVENTS.filter(event => nextOccurrence(event, '2026-12-14')).map(event => event.id).sort(), 'exactly the activities with a day on or after 12/14');
  for (const id of running) assert.ok(item(id).endDate >= '2026-12-14', `${id} has not ended`);
  assertFeed(mid, running);
  for (const id of ['pleasanton-pumpkins-after-dark-2026', 'livermore-great-elephant-migration-2026', 'scl-sonoma-valley-gingerbread-dec13-2026', 'sjpl-tully-friends-book-sale-dec5-2026']) {
    assert.equal(feedIds(mid.container).includes(id), false, `${id} ended before 12/14 and is not listed`);
  }
});

test('server HTML renders the first 12 real activities with the full count and never fetches', t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('SSR must not fetch'); });
  const request = t.mock.method(api, 'request', async () => { throw new Error('SSR must not request engagement'); });
  for (const today of ['2026-10-09', '2026-10-20', '2026-11-01']) {
    const server = new JSDOM(renderToStaticMarkup(<StaticRouter location="/this-month"><MonthlyEdition today={today} /></StaticRouter>)).window.document;
    const ids = expected(today);
    assert.deepEqual(feedIds(server), ids.slice(0, 12), today);
    assert.equal(server.querySelector('.ev-count')!.textContent, `找到 ${ids.length} 场活动`);
    assert.equal(server.querySelector('.ev-list-end__count')?.textContent, `已显示 12 / ${ids.length} 场 · 按日期排列`);
    assert.doesNotMatch(server.body.textContent!, /0 人想去/, 'no invented interest counts');
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(request.mock.callCount(), 0);
});

test('再看 12 场 reveals twelve more without changing the total, and a new filter returns to the first page', async t => {
  const request = t.mock.method(api, 'request', async () => { throw new Error('the listing requests no engagement'); });
  const view = render(edition());
  const total = expected(TODAY).length;
  const cards = () => view.container.querySelectorAll('#monthly-events .ui-feed-card').length;
  assert.equal(cards(), 12);
  fireEvent.click(view.getByRole('button', { name: '再看 12 场' }));
  assert.equal(cards(), 24);
  fireEvent.click(view.getByRole('button', { name: '再看 12 场' }));
  assert.equal(cards(), 36);
  assert.equal(status(view), `找到 ${total} 场活动`);
  await act(async () => { fireEvent.click(filterRow(view).getByRole('button', { name: '亲子', exact: true })); });
  const kids = expected(TODAY, { tag: 'kids' });
  assert.equal(queryParams(view).get('tag'), 'kids');
  assert.equal(cards(), Math.min(12, kids.length), 'a new story returns to the first page');
  assertFeed(view, kids);
  assert.equal(request.mock.callCount(), 0);
});

test('unknown filter and sort values fall back safely while preserving unrelated URL parameters', async () => {
  const view = render(edition(TODAY, '/this-month?region=unknown&cost=unknown&when=unknown&category=unknown&view=unknown&sort=unknown&lang=zh-Hant'));
  assert.equal(rangeLine(view.container), '全部日期 · 收录至 2/28');
  // H23: the region is a one-tap chip row; an unknown region reads as 整个湾区 (selected), not as a narrowed region.
  assert.equal(within(view.getByRole('group', { name: '地区' })).getByRole('button', { name: '整个湾区' }).getAttribute('aria-pressed'), 'true');
  assert.equal(filterRow(view).getByRole('button', { name: '免费', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(filterRow(view).getByRole('button', { name: /^筛选/ }).textContent, '筛选', 'nothing is counted as a filter');
  assert.deepEqual(feedIds(view.container), expected(TODAY).slice(0, 12));
  // 户外 is in the 筛选 sheet now (UI9-EVENTS rail 1: 免费 · 亲子 · 长辈友好).
  const sheet = await openFilters(view);
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '户外', exact: true })); });
  assert.equal(queryParams(view).get('lang'), 'zh-Hant');
  assert.equal(queryParams(view).get('tag'), 'outdoors');
  assertFeed(view, expected(TODAY, { tag: 'outdoors' }));
});
