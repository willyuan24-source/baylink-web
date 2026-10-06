import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import '../src/i18n/router';
import { AttractionExplorer } from '../src/components/AttractionExplorer';
import { ATTRACTIONS } from '../src/data/attractions';
import { setLocale } from '../src/i18n/locale';
import { OPUS_BAY_ATTRACTION_ENTRIES, opusBayAttractionEntry } from '../src/lib/opus-bay-attraction-entry';
import { languagePath, languagePrefix } from '../src/lib/language-path';
import { readQa } from '../src/opus-bay/game/qa';
import { applyW4Places } from '../src/opus-bay/data/sf/extraPlaces';
import { buildPlaceIndex } from '../src/opus-bay/data/sf/places';
import { sfLandmarkAnchor } from '../src/opus-bay/world/sf/landmarks/context';

test('the seven SF card entrances resolve to published city places or model arrivals', () => {
  const current = JSON.parse(readFileSync(new URL('../public/opus-bay/sf/current.json', import.meta.url), 'utf8'));
  const file = JSON.parse(readFileSync(new URL(`../public/opus-bay/sf/${current.version}/places.json`, import.meta.url), 'utf8'));
  const places = buildPlaceIndex({ places: applyW4Places(file) }, []);
  assert.equal(Object.keys(OPUS_BAY_ATTRACTION_ENTRIES).length, 7);
  for (const [id, entry] of Object.entries(OPUS_BAY_ATTRACTION_ENTRIES)) {
    assert.equal(ATTRACTIONS.find(attraction => attraction.id === id)?.region, 'sf', id);
    const target = entry.target.startsWith('lm-') ? sfLandmarkAnchor(entry.target.slice(3)) : places.get(entry.target)?.arrival;
    assert.ok(target && Number.isFinite(target.x) && Number.isFinite(target.z), `${id}: ${entry.target} has an actual city arrival`);
    if (!entry.target.startsWith('lm-')) assert.equal(places.get(entry.target)?.walkable, true, `${id}: the published target supports travel`);
    const url = new URL(opusBayAttractionEntry(id, 'en')!.href, 'https://www.baylink.us');
    assert.equal(url.searchParams.get('world'), 'city');
    assert.equal(readQa(url.search).start, 'free');
    assert.equal(readQa(url.search).at, entry.target);
    assert.equal(url.searchParams.get('lang'), 'en');
    assert.equal(url.searchParams.get('from'), 'guide');
  }
  const island = opusBayAttractionEntry('alcatraz', 'en')!;
  assert.equal(new URL(island.href, 'https://www.baylink.us').searchParams.get('at'), 'alcatraz-landing');
  assert.match(island.label, /Pier 33/);
  for (const id of ['berkeley', 'stanford', 'unknown', '__proto__']) assert.equal(opusBayAttractionEntry(id, 'en'), undefined, id);
});

test('each SF attraction card exposes its specific 3D destination in the initial HTML in all three languages', async () => {
  try {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      await setLocale(locale, false);
      const html = renderToStaticMarkup(createElement(StaticRouter, { location: languagePath('/explore?region=sf', locale), basename: languagePrefix(locale) || undefined }, createElement(AttractionExplorer)));
      const dom = new JSDOM(html);
      const links = [...dom.window.document.querySelectorAll('.attraction-card a')].filter(anchor => anchor.getAttribute('href')?.includes('/opus-bay?'));
      assert.equal(links.length, 7);
      for (const entry of Object.values(OPUS_BAY_ATTRACTION_ENTRIES)) {
        const anchor = links.find(link => new URL(link.getAttribute('href')!, 'https://www.baylink.us').searchParams.get('at') === entry.target);
        assert.ok(anchor, entry.target);
        const url = new URL(anchor.getAttribute('href')!, 'https://www.baylink.us');
        assert.equal(url.pathname, languagePath('/opus-bay', locale));
        if (locale !== 'zh-Hans') assert.equal(url.searchParams.get('lang'), locale);
        if (locale === 'en') assert.doesNotMatch(anchor.textContent!, /[\u3400-\u9fff]/);
      }
      dom.window.close();
    }
  } finally { await setLocale('zh-Hans', false); }
});
