import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import '../src/i18n/router';
import '../src/i18n/metadata';
import { setLocale, type Locale } from '../src/i18n/locale';
import { languagePath, languagePrefix } from '../src/lib/language-path';
import { renderHtmlDocument } from '../src/lib/seo';
import { MONTHLY_METADATA, WEEKLY_METADATA } from '../src/lib/monthly-metadata';
import { MONTHLY_EDITION } from '../src/data/monthly-settings';
import { MonthlyEdition } from '../src/components/MonthlyEdition';
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

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const routes = [
  { metadata: MONTHLY_METADATA, content: <MonthlyEdition defaultDateFilter="all" /> },
  { metadata: WEEKLY_METADATA, content: <MonthlyEdition defaultDateFilter="weekend" /> },
  { metadata: PLAN_METADATA, content: <PlannerPage /> },
  { metadata: EXPLORE_METADATA, content: <AttractionExplorer /> },
];

test('monthly, weekend, planner and explore SSR have translated English text and accurate three-language metadata', async () => {
  const [, month, day] = MONTHLY_EDITION.throughDate.split('-').map(Number);
  const chineseDeadline = `${month} 月 ${day} 日`;
  const englishDeadline = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${MONTHLY_EDITION.throughDate}T12:00:00Z`));
  // English runs first: only actual route scopes are loaded, never the full export dictionary.
  for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as Locale[]) {
    for (const { metadata, content } of routes) {
      const path = languagePath(metadata.path, locale);
      await setLocale(locale, false, path);
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
