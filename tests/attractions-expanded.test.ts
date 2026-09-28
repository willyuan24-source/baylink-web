import assert from 'node:assert/strict';
import test from 'node:test';
import { sfEastExpandedGuides, sfEastExpandedAttractions } from '../src/data/guides-attractions-sf-east-expanded';
import { peninsulaSouthExpandedGuides, peninsulaSouthExpandedAttractions } from '../src/data/guides-attractions-peninsula-south-expanded';
import { northExpandedGuides, northExpandedAttractions } from '../src/data/guides-attractions-north-expanded';
import { ATTRACTION_REGION_INTROS } from '../src/data/attraction-region-intros';
import { ATTRACTIONS } from '../src/data/attractions';
import { getGuideBySlug } from '../src/data/guides';
import { getGuideMedia } from '../src/data/guide-media';
import { filterAttractions, outingText, parseSharedOuting } from '../src/lib/attraction-plan';
import { loadLocale, translateEditorial } from '../src/i18n/locale';

const additions = [...sfEastExpandedAttractions, ...peninsulaSouthExpandedAttractions, ...northExpandedAttractions];
const guides = [...sfEastExpandedGuides, ...peninsulaSouthExpandedGuides, ...northExpandedGuides];

test('each region gains two discoverable, plannable attractions linked to substantial sourced guides', () => {
  assert.equal(additions.length, 10);
  for (const region of Object.keys(ATTRACTION_REGION_INTROS)) {
    assert.equal(additions.filter(place => place.region === region).length, 2, region);
  }
  for (const place of additions) {
    assert.equal(ATTRACTIONS.filter(item => item.id === place.id).length, 1, place.id);
    assert.deepEqual(parseSharedOuting(place.id), [place.id]);
    const guide = getGuideBySlug(place.slug);
    assert.ok(guide, place.slug);
    assert.equal(guide.updatedAt, '2026-09-26');
    assert.ok(guide.sources.length >= 3, place.slug);
    assert.ok(guide.sources.some(source => source.url === place.officialUrl), place.id);
    guide.sources.forEach(source => assert.equal(new URL(source.url).protocol, 'https:'));
    const route = guide.blocks.find(block => block.type === 'route');
    assert.ok(route, place.id);
    assert.equal(route.stops.length, 3);
    for (const stop of route.stops) {
      const url = new URL(stop.mapUrl!);
      assert.equal(url.hostname, 'www.google.com');
      assert.equal(url.searchParams.get('api'), '1');
      assert.ok(url.searchParams.get('query'));
    }
    assert.ok(guide.blocks.some(block => block.type === 'checklist' && block.items.length >= 4));
    assert.equal(getGuideMedia(guide).cover.kind, 'photo');
    assert.ok(filterAttractions(ATTRACTIONS, { region: place.region, query: place.city, locale: 'zh-Hans' }).some(item => item.id === place.id));
  }
});

test('new editorial content, regional intros, media credits and shared plans are complete in English', async () => {
  await loadLocale('en');
  const translated = translateEditorial({ guides, additions, intros: ATTRACTION_REGION_INTROS, media: guides.map(getGuideMedia) }, 'en');
  assert.doesNotMatch(JSON.stringify(translated), /[\u3400-\u9fff]/);
  for (const item of additions) assert.doesNotMatch(outingText([item.id], 'en'), /[\u3400-\u9fff]/, item.id);
});
