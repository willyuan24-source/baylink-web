import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { guides, getGuideBySlug } from '../src/data/guides';
import { visitorPersonaGuides } from '../src/data/guides-persona-visitor';
import { newResidentPersonaGuides } from '../src/data/guides-persona-newresident';
import { establishedResidentPersonaGuides } from '../src/data/guides-persona-resident';
import { READER_PATHS } from '../src/data/reader-paths';
import { getGuideMedia, GUIDE_IMAGES, READER_GUIDE_MEDIA } from '../src/data/guide-media';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, setLocale, translateText } from '../src/i18n/locale';

// Finish asynchronous setup before registering tests: node:test may start a
// completed batch while a later top-level import is still awaiting resolution.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://www.baylink.us/guides', pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const styles = registerHooks({
  load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
  },
});
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { ReaderPaths } = await import('../src/components/ReaderPaths');

function Harness({ onOpenGuide = () => {} }: { onOpenGuide?: (slug: string) => void }) {
  const location = useLocation();
  return <><output data-testid="reader-location">{location.pathname}{location.search}{location.hash}</output><ReaderPaths onOpenGuide={onOpenGuide} /></>;
}

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); localStorage.clear(); });
after(() => { styles.deregister(); dom.window.close(); });

const personaGuides = [...visitorPersonaGuides, ...newResidentPersonaGuides, ...establishedResidentPersonaGuides];
const han = /\p{Script=Han}/u;
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('nine persona guides and every reader task resolve to published articles with valid sources and internal links', () => {
  assert.deepEqual([visitorPersonaGuides.length, newResidentPersonaGuides.length, establishedResidentPersonaGuides.length], [3, 3, 3]);
  assert.equal(new Set(personaGuides.map(guide => guide.slug)).size, 9);
  for (const guide of personaGuides) {
    assert.deepEqual(getGuideBySlug(guide.slug), guide, `Missing aggregate entry: ${guide.slug}`);
    assert.equal(guide.editionMonth, undefined, 'ongoing service guides must not disappear as an expired October outing edition');
    assert.ok(guide.sources.length >= 3 && guide.sources.length <= 8, guide.slug);
    assert.equal(new Set(guide.sources.map(source => source.url)).size, guide.sources.length, guide.slug);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:', source.url);
      assert.equal(url.username + url.password, '', source.url);
      assert.ok(url.hostname.includes('.') && source.title.trim() && source.description.trim(), source.url);
    }
    for (const block of guide.blocks) {
      if (block.type !== 'link') continue;
      const url = new URL(block.url, 'https://www.baylink.us');
      assert.equal(url.protocol, 'https:', block.url);
      if (['www.baylink.us', 'baylink.us'].includes(url.hostname) && url.pathname.startsWith('/guides/')) {
        const slug = decodeURIComponent(url.pathname.slice('/guides/'.length).replace(/\/$/, ''));
        assert.ok(getGuideBySlug(slug), `${guide.slug} links to missing ${slug}`);
      }
    }
  }
  assert.deepEqual(READER_PATHS.map(path => path.id), ['visitor', 'new-resident', 'resident']);
  for (const path of READER_PATHS) {
    assert.equal(path.paths.length, 6, path.id);
    assert.equal(new Set(path.paths.map(task => task.slug)).size, 6, path.id);
    for (const task of path.paths) assert.ok(getGuideBySlug(task.slug), `${path.id}: ${task.slug}`);
  }
});

test('persona media mappings use existing assets and preserve their original captions and attribution', () => {
  for (const guide of personaGuides) {
    const mapping = READER_GUIDE_MEDIA[guide.slug];
    assert.ok(mapping, `Explicit media mapping missing: ${guide.slug}`);
    const media = getGuideMedia(guide);
    const actual = [media.cover, ...media.inline.map(item => item.image)];
    for (const key of mapping) assert.ok(GUIDE_IMAGES[key], `Missing mapped image: ${guide.slug}: ${key}`);
    assert.equal(actual.length, 2, `${guide.slug}: cover and inline images must both be retained`);
    mapping.forEach((key, index) => {
      const original = GUIDE_IMAGES[key];
      assert.ok(original, `${guide.slug}: ${key}`);
      assert.deepEqual(actual[index], original, `${guide.slug}: credit/caption changed for ${key}`);
      assert.ok(original.alt.trim() && original.caption.trim() && original.credit.trim(), key);
      assert.ok(original.width > 0 && original.height > 0, key);
      if (original.kind === 'photo') {
        assert.ok(original.creditUrl, `Photo source missing: ${key}`);
        assert.equal(new URL(original.creditUrl).protocol, 'https:', key);
      } else assert.match(original.credit, /BAYLINK/, key);
      const assets = [original.src, ...(original.srcSet || '').split(',').map(item => item.trim().split(/\s+/)[0]).filter(Boolean)];
      for (const asset of new Set(assets)) {
        assert.match(asset, /^\/guides\/.+\.webp$/, key);
        const bytes = readFileSync(new URL(`../public${asset}`, import.meta.url));
        assert.ok(bytes.length > 1000, asset);
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', asset);
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', asset);
      }
    });
  }
});

test('runtime English locale translates every Chinese field in all three personas and reader paths', async () => {
  await loadLocale('en');
  for (const text of new Set(strings({ personaGuides, READER_PATHS }).filter(value => han.test(value)))) {
    const translated = translateText(text, 'en');
    assert.ok(translated.trim(), text);
    assert.notEqual(translated, text, `Unregistered translation: ${text}`);
    assert.doesNotMatch(translated, han, `Incomplete runtime translation: ${text}`);
  }
});

test('all nine persona titles are discoverable through the real Chinese and English guide search', async () => {
  await loadLocale('en');
  for (const guide of personaGuides) {
    for (const locale of ['zh-Hans', 'en'] as const) {
      const query = translateText(guide.title, locale);
      assert.ok(searchGuides(guides, { query, locale }).some(result => result.guide.slug === guide.slug), `${locale}: ${guide.slug}`);
    }
  }
});

for (const selected of READER_PATHS) {
  test(`audience=${selected.id} opens exactly its six tasks without mixing another reader's panel`, async () => {
    await setLocale('en', false);
    const view = render(<MemoryRouter initialEntries={[`/guides?audience=${selected.id}&lang=en`]}><Harness /></MemoryRouter>);
    assert.ok(view.getByRole('heading', { name: translateText(selected.title, 'en') }));
    assert.equal(view.getByRole('button', { name: translateText(selected.label, 'en') }).getAttribute('aria-pressed'), 'true');
    const panel = view.container.querySelector<HTMLElement>('#reader-path-panel');
    assert.ok(panel);
    const links = within(panel).getAllByRole('link');
    assert.equal(links.length, 6);
    assert.deepEqual(links.map(link => new URL(link.getAttribute('href')!, dom.window.location.href).pathname), selected.paths.map(task => `/guides/${task.slug}`));
    for (const task of selected.paths) assert.ok(within(panel).getByRole('heading', { name: translateText(task.label, 'en') }));
    for (const other of READER_PATHS.filter(path => path.id !== selected.id)) {
      assert.equal(view.queryByRole('heading', { name: translateText(other.title, 'en') }), null);
      for (const task of other.paths) assert.equal(within(panel).queryByRole('heading', { name: translateText(task.label, 'en') }), null);
    }
    assert.equal(view.getAllByRole('button').filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
  });
}

test('switching reader buttons updates audience while preserving language and other URL filters', () => {
  const view = render(<MemoryRouter initialEntries={['/guides?audience=visitor&lang=en&category=newcomer&q=school']}><Harness /></MemoryRouter>);
  for (const selected of [READER_PATHS[1], READER_PATHS[2], READER_PATHS[0]]) {
    fireEvent.click(view.getByRole('button', { name: selected.label }));
    const url = new URL(view.getByTestId('reader-location').textContent!, dom.window.location.href);
    assert.equal(url.pathname, '/guides');
    assert.equal(url.searchParams.get('audience'), selected.id);
    assert.equal(url.searchParams.get('lang'), 'en');
    assert.equal(url.searchParams.get('category'), 'newcomer');
    assert.equal(url.searchParams.get('q'), 'school');
    assert.equal(view.getByRole('button', { name: selected.label }).getAttribute('aria-pressed'), 'true');
    assert.ok(view.getByRole('heading', { name: selected.title }));
    assert.equal(view.getAllByRole('link').length, 6);
  }
});

test('task links call the correct guide callback normally and leave Ctrl-click to the browser', () => {
  const opened: string[] = [];
  const view = render(<MemoryRouter initialEntries={['/guides?audience=visitor&lang=en']}><Harness onOpenGuide={slug => opened.push(slug)} /></MemoryRouter>);
  for (const selected of READER_PATHS) {
    fireEvent.click(view.getByRole('button', { name: selected.label }));
    const links = view.getAllByRole('link');
    selected.paths.forEach((task, index) => {
      const before = opened.length;
      assert.equal(fireEvent.click(links[index], { button: 0 }), false, 'Normal click must prevent duplicate router navigation');
      assert.deepEqual(opened.slice(before), [task.slug]);
      const location = view.getByTestId('reader-location').textContent;
      let preventedByComponent: boolean | undefined;
      // Observe after React's handler, then suppress jsdom's unsupported browser navigation only.
      document.addEventListener('click', event => { preventedByComponent = event.defaultPrevented; event.preventDefault(); }, { once: true });
      fireEvent.click(links[index], { button: 0, ctrlKey: true });
      assert.equal(preventedByComponent, false, `Ctrl-click was intercepted: ${task.slug}`);
      assert.equal(opened.length, before + 1, `Ctrl-click invoked callback: ${task.slug}`);
      assert.equal(view.getByTestId('reader-location').textContent, location);
    });
  }
});
