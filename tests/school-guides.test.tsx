import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { guides, getGuideBySlug, GUIDE_CATEGORY_TABS } from '../src/data/guides';
import { getGuideMedia } from '../src/data/guide-media';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, normalizeText, translateEditorial } from '../src/i18n/locale';
import baseEnglish from '../src/i18n/en.json';
import sfEastEnglish from '../src/data/schools-sf-east-en.json';
import peninsulaSouthNorthEnglish from '../src/data/schools-peninsula-south-north-en.json';
import mediaEnglish from '../src/data/schools-media-en.json';
import campusMediaEnglish from '../src/data/schools-campus-media-en.json';
import uiEnglish from '../src/data/schools-ui-en.json';

const regions = [
  { slug: 'sf-school-district-enrollment-guide', label: '旧金山', domains: ['sfusd.edu', 'ccsf.edu', 'sfsu.edu'], content: [/SFUSD/, /2026.*27/, /2027.*28/, /CCSF/, /旧金山州立大学/] },
  { slug: 'peninsula-school-district-enrollment-guide', label: '半岛', domains: ['smcoe.org', 'smfcsd.net', 'smuhsd.org', 'pausd.org', 'collegeofsanmateo.edu', 'stanford.edu'], content: [/San Mateo/, /Palo Alto/, /SMFCSD/, /SMUHSD/, /PAUSD/, /小学.*高中/s, /Stanford/, /College of San Mateo/] },
  { slug: 'south-bay-school-district-enrollment-guide', label: '南湾', domains: ['sccoe.org', 'sjusd.org', 'cusdk8.org', 'sesd.org', 'fuhsd.org', 'sjsu.edu', 'foothill.edu'], content: [/San José/, /Cupertino/, /Sunnyvale/, /2026.*27/, /2027.*28/, /FUHSD/, /SJSU/, /Foothill College/] },
  { slug: 'east-bay-school-district-enrollment-guide', label: '东湾', domains: ['acoe.org', 'cccoe.k12.ca.us', 'ousd.org', 'berkeleyschools.net', 'fremontusd.aeries.net', 'mdusd.org', 'srvusd.net', 'peralta.edu', 'berkeley.edu'], content: [/Alameda/, /Contra Costa/, /Oakland/, /Berkeley/, /Fremont/, /Mt\. Diablo/, /San Ramon Valley/, /Peralta/] },
  { slug: 'north-bay-school-district-enrollment-guide', label: '北湾', domains: ['marinschools.org', 'scoe.org', 'napacoe.org', 'nvusd.org', 'marin.edu', 'santarosa.edu', 'napavalley.edu'], content: [/Marin/, /Sonoma/, /Napa/, /NVUSD/, /College of Marin/, /SRJC/, /Napa Valley College/] },
] as const;
const schoolSlugs = regions.map(region => region.slug).sort();
const schoolGuides = regions.map(({ slug }) => {
  const guide = getGuideBySlug(slug);
  assert.ok(guide, `Missing regional school guide: ${slug}`);
  return guide;
});

function chineseStrings(value: unknown): string[] {
  if (typeof value === 'string') return /\p{Script=Han}/u.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(chineseStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(chineseStrings);
  return [];
}

test('all five regions have distinct education guides with official sources and local enrollment distinctions', () => {
  assert.deepEqual(guides.filter(guide => guide.category === 'education').map(guide => guide.slug).sort(), schoolSlugs);
  assert.equal(GUIDE_CATEGORY_TABS.filter(tab => tab.id === 'education').length, 1);
  regions.forEach((region, index) => {
    const guide = schoolGuides[index];
    assert.equal(guide.categoryLabel, '学校与学区');
    assert.ok(guide.tags.includes('学校与学区'));
    assert.ok(guide.tags.includes(region.label));
    assert.equal(guide.editionMonth, undefined, 'school guidance must remain separate from monthly promotions');
    assert.ok(guide.sources.length >= 6 && guide.sources.length <= 10, guide.slug);
    assert.equal(new Set(guide.sources.map(source => source.url)).size, guide.sources.length, 'duplicate sources do not count as independent references');
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username + url.password, '');
      assert.ok(region.domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)), `${guide.slug}: ${source.url}`);
      assert.ok(source.title.trim() && source.description.trim());
    }
    const body = JSON.stringify(guide.blocks);
    for (const distinction of region.content) assert.match(body, distinction, guide.slug);
    assert.match(body, /年级/);
    assert.match(body, /学年/);
    assert.match(body, /官方/);
    assert.match(body, /语言|翻译/);
    assert.match(body, /确认|核对/, 'placement and enrollment steps need official confirmation');
    assert.ok(guide.blocks.some(block => block.type === 'checklist' && block.items.length >= 4));
    assert.ok(guide.blocks.some(block => block.type === 'template'));
    assert.ok(guide.blocks.some(block => block.type === 'link' && guide.sources.some(source => source.url === block.url)));
  });
});

test('every school article field, source, illustration credit and topic string has an exact English translation', async () => {
  const dictionary: Record<string, string> = { ...baseEnglish, ...sfEastEnglish, ...peninsulaSouthNorthEnglish, ...mediaEnglish, ...campusMediaEnglish, ...uiEnglish };
  const content = { guides: schoolGuides, media: schoolGuides.map(getGuideMedia), ui: Object.keys(uiEnglish) };
  for (const value of new Set(chineseStrings(content))) {
    const translated = dictionary[normalizeText(value)];
    assert.ok(translated?.trim(), `Missing exact-key translation: ${value}`);
    assert.doesNotMatch(translated, /\p{Script=Han}/u, value);
  }
  await loadLocale('en');
  assert.doesNotMatch(JSON.stringify(translateEditorial(content, 'en')), /\p{Script=Han}/u, 'registered locale dictionaries must also cover the complete school content');
});

test('the five regional covers are distinct usable local illustrations with honest captions and responsive assets', () => {
  const imagePaths = new Set<string>();
  const imageHashes = new Set<string>();
  for (const guide of schoolGuides) {
    const { cover } = getGuideMedia(guide);
    assert.equal(cover.kind, 'illustration');
    assert.match(cover.src, /^\/guides\/schools\/.+\.webp$/);
    assert.ok(cover.alt.trim());
    assert.match(cover.caption, /AI/);
    assert.match(cover.caption, /虚构/);
    assert.match(cover.caption, /不代表实际学校/);
    assert.match(cover.caption, /学区边界|招生承诺/);
    assert.ok(cover.width > 0 && cover.height > 0);
    const sources = [cover.src, ...(cover.srcSet || '').split(',').map(item => item.trim().split(/\s+/)[0]).filter(Boolean)];
    assert.ok(sources.some(src => src.endsWith('-small.webp')), 'cards need a local small image');
    for (const src of new Set(sources)) {
      const bytes = readFileSync(new URL(`../public${src}`, import.meta.url));
      assert.ok(bytes.length > 1000, src);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', src);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', src);
      if (src === cover.src) imageHashes.add(createHash('sha256').update(bytes).digest('hex'));
    }
    imagePaths.add(cover.src);
  }
  assert.equal(imagePaths.size, regions.length);
  assert.equal(imageHashes.size, regions.length, 'renaming the same cover is not distinct regional imagery');
});

test('school and district searches work in English, simplified Chinese and traditional Chinese without unrelated category results', async () => {
  for (const query of ['school', 'schools', 'district', 'districts', 'school district', '学校', '学区', '學校', '學區', '入學']) {
    const results = searchGuides(guides, { query, category: 'education', locale: 'zh-Hans' });
    assert.deepEqual(results.map(result => result.guide.slug).sort(), schoolSlugs, query);
  }
  await loadLocale('en');
  for (const region of regions) {
    const results = searchGuides(guides, { query: `${region.label} 学区`, category: 'education', locale: 'en' });
    assert.ok(results.some(result => result.guide.slug === region.slug), region.label);
    assert.ok(results.every(result => result.guide.category === 'education'));
  }
  for (const [query, slug] of [
    ['Palo Alto school', 'peninsula-school-district-enrollment-guide'],
    ['Sunnyvale district', 'south-bay-school-district-enrollment-guide'],
    ['Napa enrollment', 'north-bay-school-district-enrollment-guide'],
    ['舊金山 入學', 'sf-school-district-enrollment-guide'],
    ['東灣 學區', 'east-bay-school-district-enrollment-guide'],
  ]) assert.ok(searchGuides(guides, { query, category: 'education', locale: 'en' }).some(result => result.guide.slug === slug), query);
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { GuidesHome } = await import('../src/components/GuidesHome');
afterEach(() => cleanup());

function SchoolHomeHarness() {
  const location = useLocation();
  return <><output data-testid="location">{location.pathname}{location.search}</output><GuidesHome onOpenGuide={() => {}} /></>;
}

const unrelatedPromos = '.guide-attraction-entry, .daily-guide-topics:not(.reader-paths), .bl-monthly-spotlight, .bl-monthly-deals, .bl-guides-spotlights, .bl-guide-explorer, .editorial-collections';

function assertEducationView(view: ReturnType<typeof render>) {
  assert.equal(view.getByRole('button', { name: '学校与学区', exact: true }).getAttribute('aria-pressed'), 'true');
  const library = view.getByRole('region', { name: '五区学校与学区指南' });
  const cards = within(library).getAllByRole('link');
  assert.deepEqual(cards.map(card => card.getAttribute('href')?.replace('/guides/', '')).sort(), schoolSlugs);
  for (const guide of schoolGuides) assert.ok(within(library).getByRole('heading', { name: guide.title }));
  assert.equal(view.container.querySelectorAll(unrelatedPromos).length, 0, 'an education filter must not promote unrelated activities, deals or attractions');
}

test('the guide overview previews four school guides and its category control opens the complete school library', () => {
  const view = render(<MemoryRouter initialEntries={['/guides']}><SchoolHomeHarness /></MemoryRouter>);
  const categories = view.getByRole('group', { name: '指南分类' });
  const topics = view.getByRole('region', { name: '学校与学区', exact: true });
  assert.ok(categories.compareDocumentPosition(topics) & Node.DOCUMENT_POSITION_FOLLOWING, 'category controls must precede the library');
  assert.equal(within(topics).getAllByRole('link').length, 4);
  assert.equal(view.container.querySelectorAll(unrelatedPromos).length, 0, 'the compact overview has no unrelated promotional modules');
  fireEvent.click(within(categories).getByRole('button', { name: '学校与学区', exact: true }));
  assert.match(view.getByTestId('location').textContent || '', /category=education/);
  assertEducationView(view);
});

test('a shared education URL restores the filter and supports school searches without reintroducing promotions', () => {
  const view = render(<MemoryRouter initialEntries={['/guides?category=education']}><SchoolHomeHarness /></MemoryRouter>);
  assertEducationView(view);
  fireEvent.change(view.getByRole('searchbox', { name: /篇指南中搜索/ }), { target: { value: '學區' } });
  const url = new URL(view.getByTestId('location').textContent || '', 'http://localhost');
  assert.equal(url.searchParams.get('category'), 'education');
  assert.equal(url.searchParams.get('q'), '學區');
  assertEducationView(view);
});
