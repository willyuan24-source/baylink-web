import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import '../src/i18n/router';
import '../src/i18n/metadata';
import { loadLocaleForFeature, setLocale, translateText, normalizeText, type Locale } from '../src/i18n/locale';
import { languagePath, languagePrefix } from '../src/lib/language-path';
import { englishTimes } from '../src/lib/english-times';
import { renderHtmlDocument } from '../src/lib/seo';
import { EVENTS_METADATA, MONTHLY_METADATA } from '../src/lib/monthly-metadata';
import { MONTHLY_EDITION } from '../src/data/monthly-settings';
import PlannerPage from '../src/pages/PlannerPage';
import { PLAN_METADATA } from '../src/lib/planner';
import { AttractionExplorer } from '../src/components/AttractionExplorer';
import { EXPLORE_METADATA } from '../src/data/attractions';
import { getLocalDiscovery } from '../src/data/local-discoveries';
import { getDiscoveryMetadata } from '../src/lib/discovery-metadata';
import sfEastEvents from '../src/data/octnov-2026-sf-east-events.json';
import regionalEvents from '../src/data/octnov-2026-regional-events.json';
import offers from '../src/data/octnov-2026-offers.json';
import openings from '../src/data/octnov-2026-openings.json';
import { getSlugFromCategory } from '../src/routing';
import { EVENT_SCHEDULE_NOTES } from '../src/data/event-schedule-notes';
import { GUIDES_METADATA } from '../src/lib/guides-metadata';
import { GuidesHome } from '../src/components/GuidesHome';

// The events column imports its stylesheet (and the UI primitives theirs); here they load as empty modules, so the column
// is imported after the hook (static imports load first).
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { EventsView } = await import('../src/components/EventsView');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { BoardLinks } = await import('../src/features/posts/BoardLinks');
const { BOARD_CATEGORIES } = await import('../src/features/posts/community-copy');

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const routes = [
  { metadata: MONTHLY_METADATA, content: <MonthlyEdition defaultDateFilter="all" /> },
  { metadata: EVENTS_METADATA, content: <EventsView /> },
  { metadata: PLAN_METADATA, content: <PlannerPage /> },
  { metadata: EXPLORE_METADATA, content: <AttractionExplorer /> },
  { metadata: GUIDES_METADATA, content: <GuidesHome onOpenGuide={() => {}} /> },
];

test('the board links name every board in English on /en, with the board on screen marked current', async () => {
  await setLocale('en', false, '/en/category/rent');
  const body = renderToStaticMarkup(<StaticRouter basename="/en" location="/en/category/rent"><nav><BoardLinks current="租屋" /></nav></StaticRouter>);
  const dom = new JSDOM(body);
  const links = [...dom.window.document.querySelectorAll('a')];
  assert.equal(links.length, BOARD_CATEGORIES.length);
  for (const [index, link] of links.entries()) {
    assert.equal(link.getAttribute('href'), `/en/category/${getSlugFromCategory(BOARD_CATEGORIES[index])}`);
    assert.doesNotMatch(link.textContent!, /\p{Script=Han}/u, BOARD_CATEGORIES[index]);
  }
  assert.equal(links[0].textContent, 'Housing');
  assert.equal(links[0].getAttribute('aria-current'), 'page');
  dom.window.close();
});

test('actual calendar route scope translates every compact schedule note without loading the full dictionary', async () => {
  await setLocale('en', false, '/en/calendar');
  const full = JSON.parse(readFileSync(new URL('../src/data/generated/english.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const [id, note] of Object.entries(EVENT_SCHEDULE_NOTES)) {
    const translated = translateText(note);
    // the site's English reads the reviewed entry's times and dates in US style (H41, i18n/metadata.ts)
    assert.equal(translated, englishTimes(full[normalizeText(note)]), id);
    assert.doesNotMatch(translated, /\p{Script=Han}/u, id);
  }
});

test('monthly, events (weekend), planner, explore and guides SSR have translated English text and accurate three-language metadata', async () => {
  const [, month, day] = MONTHLY_EDITION.throughDate.split('-').map(Number);
  const chineseDeadline = `${month} 月 ${day} 日`;
  const englishDeadline = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${MONTHLY_EDITION.throughDate}T12:00:00Z`));
  // English runs first: only actual route (and, on /plan, workspace) scopes are loaded, never the full export dictionary.
  for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as Locale[]) {
    for (const { metadata, content } of routes) {
      const path = languagePath(metadata.path, locale);
      await setLocale(locale, false, path);
      // 行程's workspace loads its own English pack with the planner catalog, after the header (WEB-PLAN-DATA: feature 'plan').
      if (metadata.path === '/plan') await loadLocaleForFeature(locale, 'plan');
      const body = renderToStaticMarkup(<StaticRouter basename={languagePrefix(locale) || undefined} location={path}><main>{content}</main></StaticRouter>);
      const dom = new JSDOM(renderHtmlDocument(template, { ...metadata, path }, body));
      const doc = dom.window.document;
      const description = doc.querySelector('meta[name="description"]')!.getAttribute('content')!;
      const visible = doc.querySelector('main')!.textContent!;
      assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), `https://www.baylink.us${path}`);
      if (locale === 'en') {
        assert.doesNotMatch(doc.title, /\p{Script=Han}/u, `${path}: title`);
        assert.doesNotMatch(description, /\p{Script=Han}/u, `${path}: description`);
        assert.equal(/\p{Script=Han}/u.test(visible), false, `${path}: visible text contains ${visible.match(/[^<>]{0,20}\p{Script=Han}[^<>]{0,40}/u)?.[0] || ''}`);
        if (metadata.path === '/plan') assert.match(visible, /Choose places first, then plan your time and budget\./);
        if (metadata.path === '/explore') assert.match(visible, /All local guides/);
      }
      if (metadata.path === '/this-month') {
        assert.ok(description.includes(locale === 'en' ? `through ${englishDeadline}` : chineseDeadline), `${path}: metadata must match the edition's actual throughDate`);
        if (locale === 'zh-Hant') assert.match(description, /灣區精選.*預約條件/);
      }
      dom.window.close();
    }
  }
  await setLocale('zh-Hans', false);
});

test('new and updated discovery descriptions translate date, location and complete summary through existing composition rules', async () => {
  const listings = [
    ...[...sfEastEvents, ...regionalEvents].map(event => ({ kind: 'event' as const, id: event.id })),
    ...[...offers, { id: 'svma-free-wednesdays-october' }].map(offer => ({ kind: 'offer' as const, id: offer.id })),
    ...[...openings, { id: 'marufuku-burlingame-announced' }].map(opening => ({ kind: 'opening' as const, id: opening.id })),
  ];
  for (const { kind, id } of listings) {
    const item = getLocalDiscovery(kind, id);
    assert.ok(item, `${kind}:${id}`);
    const metadata = getDiscoveryMetadata(item);
    const path = languagePath(metadata.path, 'en');
    await setLocale('en', false, path);
    const dom = new JSDOM(renderHtmlDocument(template, { ...metadata, path }, '<main></main>'));
    const description = dom.window.document.querySelector('meta[name="description"]')!.getAttribute('content')!;
    assert.doesNotMatch(dom.window.document.title, /\p{Script=Han}/u, `${path}: title`);
    assert.doesNotMatch(description, /\p{Script=Han}/u, `${path}: description`);
    assert.ok(description.includes(' ｜ '), 'metadata keeps complete date labels and summaries on either side of the field separator');
    dom.window.close();
  }
  await setLocale('zh-Hans', false);
});
