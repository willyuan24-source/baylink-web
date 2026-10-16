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
const { setLocale } = await import('../src/i18n/locale');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

function Harness() {
  const location = useLocation();
  return <><output data-testid="location">{location.pathname}{location.search}</output><GuidesHome onOpenGuide={() => {}} /></>;
}
const open = (url: string) => render(<MemoryRouter initialEntries={[url]}><Harness /></MemoryRouter>);
const aiSources = new Set(Object.values(GUIDE_IMAGES).filter(image => image.kind === 'illustration' && !image.scene3d).map(image => image.src));

test('the index shows the seven task topics with 长辈与家属 first, a region row and the 长辈与家属先看 rail', () => {
  const view = open('/guides');
  const topics = within(view.getByRole('group', { name: '指南主题' })).getAllByRole('button');
  assert.deepEqual(topics.map(chip => chip.textContent?.replace(/\s*\d+$/, '')), ['全部', ...GUIDE_TOPICS.map(topic => topic.zh)]);
  assert.equal(topics[0].getAttribute('aria-pressed'), 'true');
  assert.equal(topics[1].textContent?.startsWith('长辈与家属'), true);
  const regions = within(view.getByRole('group', { name: '地区' })).getAllByRole('button');
  assert.deepEqual(regions.map(chip => chip.textContent), ['全湾区', '旧金山', '东湾', '半岛', '南湾', '北湾']);
  const rail = view.getByRole('region', { name: '长辈与家属先看' });
  const slides = within(rail).getAllByRole('group', { name: /^\d+ \/ \d+$/ });
  assert.equal(slides.length, 6);
  assert.deepEqual(within(rail).getAllByRole('link').map(link => link.getAttribute('href')), ELDER_HUB_SLUGS.slice(0, 6).map(slug => `/guides/${slug}`));
  // Every other topic previews up to four covers; a topic with enough guides of its own does not repeat a rail guide.
  for (const topic of GUIDE_TOPICS.filter(item => item.id !== 'elders')) {
    const section = view.getByRole('region', { name: topic.zh, exact: true });
    const links = within(section).getAllByRole('link').map(link => link.getAttribute('href')!.replace('/guides/', ''));
    const all = guideSlugsForTopic(topic.id, guides);
    const others = all.filter(slug => !ELDER_HUB_SLUGS.slice(0, 6).includes(slug));
    assert.deepEqual(links, (others.length >= 2 ? others : all).slice(0, 4), topic.zh);
  }
});

test('covers are honest: photos carry their provenance badge, other guides get a coded cover, never an AI illustration', () => {
  const view = open('/guides');
  // Posters letterbox on a blurred copy of themselves (one picture, two <img>); count the picture once.
  const images = [...view.container.querySelectorAll('img:not(.ui-cover__backdrop)')];
  assert.ok(images.length > 0);
  for (const image of images) assert.ok(!aiSources.has(image.getAttribute('src')!), `${image.getAttribute('src')} is an AI illustration`);
  const sources = images.map(image => image.getAttribute('src'));
  assert.equal(new Set(sources).size, sources.length, `no picture appears twice on the page: ${sources.filter((src, index) => sources.indexOf(src) !== index).join(', ')}`);
  for (const card of view.container.querySelectorAll('.ui-feed-card')) {
    const cover = card.querySelector('.ui-cover, [data-cover="type"]');
    assert.ok(cover, 'every card has a cover');
    assert.ok(cover.querySelector('[data-provenance]'), 'every cover is labelled');
  }
  const typed = view.container.querySelectorAll('[data-cover="type"][data-family="guide"]');
  assert.ok(typed.length > 0);
  for (const cover of typed) assert.equal(cover.querySelector('[data-provenance]')?.textContent, 'BAYLINK 信息卡');
  // A pilot guide's coded cover prints its first answer (the number joined by non-breaking hyphens, U+2011, so it keeps one line).
  // The senior services guide (800-510-2020) has a Commons photo as its cover since CNT-MEDIA-4; the Medicare guide keeps a coded one.
  assert.ok([...typed].some(cover => cover.textContent?.replaceAll(String.fromCharCode(0x2011), '-').includes('800-434-0222')));
});

test('/guides?topic=elders is a shareable 长辈与家属 hub in reading order, and chips update the URL', () => {
  const view = open('/guides?topic=elders');
  assert.equal(view.getByRole('button', { name: /^长辈与家属/ }).getAttribute('aria-pressed'), 'true');
  const list = view.getByRole('list', { name: '长辈与家属' });
  const hub = guideSlugsForTopic('elders', guides);
  assert.deepEqual(within(list).getAllByRole('link').map(link => link.getAttribute('href')), hub.map(slug => `/guides/${slug}`));
  assert.equal(view.container.querySelector('.gl-count')?.textContent, `${hub.length} 篇`);
  fireEvent.click(view.getByRole('button', { name: '东湾' }));
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
  assert.equal(view.getByRole('button', { name: '旧金山' }).getAttribute('aria-pressed'), 'true');
  const hrefs = within(view.getByRole('list', { name: '旧金山' })).getAllByRole('link').map(link => link.getAttribute('href')!.replace('/guides/', ''));
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
