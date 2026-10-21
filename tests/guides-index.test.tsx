import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuidesHome } = await import('../src/components/GuidesHome');
const { guides } = await import('../src/data/guides');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { ELDER_HUB_SLUGS, GUIDE_TOPICS, guideSlugsForTopic } = await import('../src/data/guide-topics');
const { guideRegionsOf } = await import('../src/features/guides/guide-data');
const { editionState, inSeason } = await import('../src/features/guides/guide-facts');
const { getBayAreaToday } = await import('../src/lib/monthly');
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

function Harness() {
  const location = useLocation();
  return <><output data-testid="location">{location.pathname}{location.search}</output><GuidesHome onOpenGuide={() => {}} /></>;
}
const open = (url: string) => render(<MemoryRouter initialEntries={[url]}><Harness /></MemoryRouter>);
const aiSources = new Set(Object.values(GUIDE_IMAGES).filter(image => image.kind === 'illustration' && !image.scene3d).map(image => image.src));
/** The guide links of a container, once each (a list renders rows for a phone and covers for a desktop). */
const guideLinks = (element: HTMLElement) => [...new Set([...element.querySelectorAll('a[href^="/guides/"]')].map(link => link.getAttribute('href')!.replace('/guides/', '')))];
const bySlug = new Map(guides.map(guide => [guide.slug, guide]));

test('the index shows one chip row (全部, the seven topics with 长辈与家属 first, 地区 ▾), the 长辈与家属先看 band and six topic previews', async () => {
  const view = open('/guides');
  const topics = within(view.getByRole('group', { name: '指南主题' })).getAllByRole('button');
  // No counts on the chips (owner, 10-19); 地区 shows its current value and opens a sheet.
  assert.deepEqual(topics.map(chip => chip.textContent), ['全部', ...GUIDE_TOPICS.map(topic => topic.zh), '整个湾区▾']);
  assert.equal(topics[0].getAttribute('aria-pressed'), 'true');
  assert.equal(topics.at(-1)!.getAttribute('aria-haspopup'), 'dialog');
  fireEvent.click(topics.at(-1)!);
  const sheet = await view.findByRole('dialog', { name: '地区' }, { timeout: 15000 });
  assert.deepEqual(within(sheet).getAllByRole('button').filter(button => button.classList.contains('gl-regions__option')).map(option => option.textContent), ['整个湾区', '旧金山', '东湾', '半岛', '南湾', '北湾']);
  // The band: three rows in D22's curated order (the senior hotline first), no past edition; G16: each prints its 48 px 拨打
  // <number> in 简洁显示 (data-simple=show), the number the reader's bar calls.
  const today = getBayAreaToday();
  const band = view.getByRole('region', { name: '长辈与家属先看' });
  const season = ELDER_HUB_SLUGS.filter(slug => bySlug.has(slug) && editionState(bySlug.get(slug)!, today) !== 'past');
  assert.deepEqual(guideLinks(band), season.slice(0, 3));
  assert.equal(guideLinks(band)[0], 'bay-area-chinese-senior-services-referral-guide');
  const calls = [...band.querySelectorAll('a.gl-call')];
  assert.ok(calls.some(call => call.getAttribute('href') === 'tel:+18005102020' && call.getAttribute('data-simple') === 'show' && /800-510-2020/.test(call.textContent!)));
  assert.ok(within(band).getByRole('button', { name: `看全部 ${guideSlugsForTopic('elders', guides).length} 篇` }));
  // Every other topic previews up to four guides in season; a topic with enough guides of its own does not repeat a band guide.
  for (const topic of GUIDE_TOPICS.filter(item => item.id !== 'elders')) {
    const section = view.getByRole('region', { name: topic.zh, exact: true });
    const all = guideSlugsForTopic(topic.id, guides);
    const others = all.filter(slug => !season.slice(0, 3).includes(slug));
    // A topic short of a full row (医疗保险: three, one in the band) shows all of its guides (UI9 live check 10-20).
    const expected = inSeason((others.length >= Math.min(4, all.length) ? others : all).map(slug => bySlug.get(slug)!), today).slice(0, 4).map(guide => guide.slug);
    assert.deepEqual(guideLinks(section), expected, topic.zh);
    for (const slug of expected) assert.notEqual(editionState(bySlug.get(slug)!, today), 'past', `${slug}: no past edition in a preview`);
  }
});

test('covers are honest: photos carry their provenance badge, other guides get a coded cover, never an AI illustration', () => {
  const view = open('/guides');
  // Posters sit whole on a board (UI9-C: one <img>, no blurred copy).
  const images = [...view.container.querySelectorAll('img:not(.ui-cover__backdrop)')];
  assert.ok(images.length > 0);
  for (const image of images) assert.ok(!aiSources.has(image.getAttribute('src')!), `${image.getAttribute('src')} is an AI illustration`);
  // A phone shows the rows, a desktop the covers (CSS shows one of the two): neither shows a picture twice.
  for (const hidden of ['desk', 'phone']) {
    const sources = images.filter(image => !image.closest(`[data-view=${hidden}]`)).map(image => image.getAttribute('src'));
    assert.equal(new Set(sources).size, sources.length, `no picture appears twice on the page (without the ${hidden} view)`);
  }
  for (const card of view.container.querySelectorAll('.ui-feed-card')) {
    const cover = card.querySelector('.ui-cover, [data-cover="type"]');
    assert.ok(cover, 'every card has a cover');
    assert.ok(cover.querySelector('[data-provenance]'), 'every cover is labelled');
  }
  const typed = view.container.querySelectorAll('[data-cover="type"][data-kind="guide"]');
  assert.ok(typed.length > 0);
  // A row's mini cover (≤ 140 px) shows its topic mark only (UI9-C); every full-size coded cover names itself.
  for (const cover of typed) if (!cover.closest('.ui-row-card__thumb')) assert.equal(cover.querySelector('[data-provenance]')?.textContent, 'BAYLINK 信息卡');
  // A pilot guide's coded cover prints its first answer (the number joined by non-breaking hyphens, U+2011, so it keeps one
  // line): on the 长辈与家属 list's desktop covers (a row's mini cover shows the topic mark only).
  cleanup();
  const hub = open('/guides?topic=elders');
  const desk = [...hub.container.querySelectorAll('[data-view=desk] [data-cover="type"][data-kind="guide"]')];
  assert.ok(desk.some(cover => cover.textContent?.replaceAll(String.fromCharCode(0x2011), '-').includes('800-510-2020')));
});

test('/guides?topic=elders is a shareable 长辈与家属 hub in reading order, and chips update the URL', async () => {
  const view = open('/guides?topic=elders');
  assert.equal(view.getByRole('button', { name: /^长辈与家属/ }).getAttribute('aria-pressed'), 'true');
  const list = view.getAllByRole('list', { name: '长辈与家属' })[0];
  const hub = guideSlugsForTopic('elders', guides);
  assert.deepEqual(guideLinks(list), hub);
  assert.equal(view.container.querySelector('.gl-count')?.textContent, `${hub.length} 篇`);
  // G16's 拨打 rows are the band's (/guides); the hub list keeps plain rows.
  assert.equal(list.querySelector('a.gl-call'), null);
  fireEvent.click(view.getByRole('button', { name: '地区：整个湾区' }));
  fireEvent.click(within(await view.findByRole('dialog', { name: '地区' }, { timeout: 15000 })).getByRole('button', { name: '东湾' }));
  const url = new URL(view.getByTestId('location').textContent!, 'http://localhost');
  assert.equal(url.searchParams.get('topic'), 'elders');
  assert.equal(url.searchParams.get('region'), 'east-bay');
  fireEvent.click(view.getByRole('button', { name: /^全部/ }));
  assert.equal(new URL(view.getByTestId('location').textContent!, 'http://localhost').searchParams.get('topic'), null);
});

test('searching inside a topic searches that topic’s own list, so the 长辈与家属 hub finds guides filed under another topic', async () => {
  const hub = new Set(guideSlugsForTopic('elders', guides));
  for (const [query, slug] of [['Medicare', 'bay-area-medicare-hicap-medi-cal-guide'], ['牙科', 'bay-area-dental-care-insurance-low-cost-guide'], ['SSA', 'bay-area-social-security-retirement-preparation-guide']]) {
    const view = open(`/guides?topic=elders&q=${encodeURIComponent(query)}`);
    // Full-text search loads the guide corpus on the first search (WEB-DATA-SPLIT).
    const hrefs = within(await view.findByRole('list', { name: '搜索结果' })).getAllByRole('link').map(link => link.getAttribute('href')!.replace('/guides/', ''));
    assert.ok(hrefs.includes(slug), `${query} → ${slug}`);
    for (const href of hrefs) assert.ok(hub.has(href), `${href} is in the hub`);
    cleanup();
  }
  // The topic still narrows: nothing outside the hub comes back.
  const view = open('/guides?topic=elders&q=押金');
  for (const link of view.container.querySelectorAll('.gl-results a')) assert.ok(hub.has(link.getAttribute('href')!.replace('/guides/', '')));
});

test('a region chip lists only that region’s guides', () => {
  const view = open('/guides?region=sf');
  assert.equal(view.getByRole('button', { name: '地区：旧金山' }).getAttribute('aria-pressed'), 'true');
  const hrefs = guideLinks(view.getAllByRole('list', { name: '旧金山' })[0]);
  const expected = guides.filter(guide => guideRegionsOf(guide).includes('sf')).map(guide => guide.slug);
  assert.ok(expected.length >= 10);
  assert.deepEqual(hrefs.sort(), expected.slice(0, 24).sort());
});

test('a search with no match says so and offers one next step', async () => {
  const view = open('/guides?q=zzqqxx');
  assert.ok(await view.findByRole('heading', { name: '还没有找到相关指南' }));
  fireEvent.click(view.getByRole('button', { name: '查看全部指南' }));
  assert.equal(new URL(view.getByTestId('location').textContent!, 'http://localhost').searchParams.get('q'), null);
});

test('the English index has English topic chips and headings, and the prerendered index links every guide', async () => {
  await setLocale('en', false);
  const view = open('/en/guides');
  const chips = within(view.getByRole('group', { name: 'Guide topics' })).getAllByRole('button').map(chip => chip.textContent || '');
  assert.equal(chips[1].startsWith('Seniors & family'), true);
  for (const chip of chips) assert.doesNotMatch(chip, /[㐀-鿿]/u, chip);
  assert.ok(view.getByRole('heading', { name: 'Start here for seniors and family' }));
  cleanup();
  await setLocale('zh-Hans', false);
  const html = new JSDOM(renderToStaticMarkup(<StaticRouter location="/guides"><GuidesHome onOpenGuide={() => {}} /></StaticRouter>)).window.document;
  for (const guide of guides) assert.ok(html.querySelector(`a[href="/guides/${guide.slug}"]`), guide.slug);
  assert.ok(html.querySelector('[data-testid="guides-home"] h1'));
});
