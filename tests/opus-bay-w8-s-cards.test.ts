import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 8 · lane S (W8-S3): the place cards that had no hours or price (W7-R's open list) — hours / cost from official
// pages, checked 2026-09-30: the city park code (5 a.m. to midnight), the GGNRA hours page, UCSF, Rec and Park, the Port,
// the venues' own sites; public alleys, stairs and streets say so. Every new line is hedged like the others.

const { PLACE_CARDS } = await import('../src/opus-bay/data/sf/placeCards');
const { PLACE_CARDS_2, CURATED_CARDS } = await import('../src/opus-bay/data/sf/placeCards2');
const { placeCardProblems } = await import('../src/opus-bay/data/sf/placeCardTypes');
const CARDS = [...PLACE_CARDS, ...PLACE_CARDS_2, ...CURATED_CARDS];
const card = (id: string) => { const c = CARDS.find(x => x.id === id); assert.ok(c, id); return c!; };
const cites = (id: string, url: string) => { const c = card(id); return c.sourceUrl === url || c.sources.includes(url); };

const PARK_CODE = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_park/0-0-0-46781';
const GGNRA = 'https://www.nps.gov/goga/planyourvisit/hours.htm';

/** the 50 cards W8-S3 filled (hours and / or cost), all re-dated 2026-09-30 */
const W8 = [
  'alta-plaza-park', 'buena-vista-park', 'glen-canyon-park', 'ina-coolbrith-park', 'lafayette-park', 'mclaren-park', 'mountain-lake-park',
  'patricias-green', 'india-basin-waterfront-park', 'grand-view-park', 'bison-paddock', 'murphy-windmill', 'seward-street-slides', 'huntington-park',
  'china-beach', 'sutro-heights-park', 'baker-beach', 'fort-funston', 'mount-sutro-open-space', 'herons-head-park', 'crane-cove-park',
  'visitacion-valley-greenway', 'balmy-alley', 'clarion-alley', 'macondray-lane', 'lyon-street-steps', 'greenwich-steps', 'hidden-garden-steps',
  'tiled-steps-16th-avenue', 'vermont-street-crooked-block', 'calle-24', 'union-street-shopping', 'clement-street', 'irving-street', 'haight-ashbury',
  'maiden-lane', 'harvey-milk-plaza', 'ingleside-terraces-sundial', 'cupids-span', 'yoda-fountain', 'wave-organ', 'sentinel-building',
  'chinese-telephone-exchange', 'womens-building', 'aquarium-of-the-bay', 'boudin-bakery', 'buena-vista-cafe', 'tadich-grill',
  'glide-memorial-church', 'candlestick-point-sra',
];

test('W8-S3 fifty cards gained hours or a price, re-checked 2026-09-30, valid and hedged', () => {
  assert.equal(new Set(W8).size, 50);
  for (const id of W8) {
    const c = card(id);
    assert.equal(c.verifiedAt, '2026-09-30', id);
    assert.ok(c.hours && c.cost || c.hours || c.cost, `${id} has hours or a price`);
    assert.deepEqual(placeCardProblems(c), [], id);
    if (c.hours) assert.match(c.hours.zh, /约|官网|确认|现场/, `${id} hours hedged`);
    if (c.cost && /\d/.test(c.cost.zh)) assert.match(c.cost.zh, /约|官网|现场|确认/, `${id} price hedged`);
  }
  // after this wave, the short cards without both hours and a price are the ones with a stated reason (report part c)
  const left = PLACE_CARDS_2.filter(c => !c.hours && !c.cost).map(c => c.id).sort();
  assert.deepEqual(left, ['balboa-theatre', 'bayview-opera-house', 'hyde-street-pier', 'moscone-center', 'palace-hotel', 'portsmouth-square', 'sfjazz-center', 'the-fillmore']);
});

test('W8-S3 the facts behind the lines: the park code, the national park, the official pages', () => {
  // city parks: Park Code §3.21, 5 a.m. to midnight (Rec and Park's own pages say the same for Ina Coolbrith, Patricia's Green)
  for (const id of ['alta-plaza-park', 'buena-vista-park', 'glen-canyon-park', 'lafayette-park', 'mclaren-park', 'mountain-lake-park', 'india-basin-waterfront-park', 'grand-view-park', 'bison-paddock', 'murphy-windmill']) {
    assert.ok(cites(id, PARK_CODE), `${id} cites the park code`);
    assert.match(card(id).hours!.zh, /5:00 到午夜/);
    assert.match(card(id).hours!.en, /5am to midnight/);
  }
  assert.match(card('ina-coolbrith-park').sourceUrl, /sfrecpark\.org/);
  assert.ok(cites('patricias-green', 'https://sfrecpark.org/facilities/facility/details/Patricias-Green-in-Hayes-Valley-362'));
  // GGNRA: China Beach and Sutro Heights 6 a.m. to an hour after sunset; elsewhere open around the clock, lots sunrise–sunset
  for (const id of ['china-beach', 'sutro-heights-park']) { assert.ok(cites(id, GGNRA), id); assert.match(card(id).hours!.zh, /6:00 到日落后 1 小时/); }
  for (const id of ['baker-beach', 'fort-funston']) { assert.ok(cites(id, GGNRA), id); assert.match(card(id).hours!.zh, /全天可去.*停车场日出到日落/); }
  // the venues' own pages
  assert.ok(cites('aquarium-of-the-bay', 'https://www.aquariumofthebay.org/tickets'));
  assert.match(card('aquarium-of-the-bay').cost!.zh, /成人约 28 美元.*4–12 岁约 20 美元.*65 岁以上约 24 美元/);
  assert.ok(cites('tadich-grill', 'https://www.tadichgrillsf.com/'));
  assert.match(card('tadich-grill').hours!.zh, /周日休息/);
  assert.ok(cites('buena-vista-cafe', 'https://www.thebuenavista.com/'));
  assert.ok(cites('glide-memorial-church', 'https://www.glide.org/church/'));
  assert.equal(card('glide-memorial-church').quiet, true, 'a church stays quiet');
  assert.match(card('candlestick-point-sra').hours!.zh, /约每天 7:00–19:00/, 'the state park page: 7 am to 7 pm (was sunrise to sunset)');
  // (W8-S review) the same page also lists "Operating Hours: Sunrise - Sunset, 7 days a week" (re-read 2026-10-01): the line says both
  assert.match(card('candlestick-point-sra').hours!.zh, /日出到日落/);
  assert.match(card('candlestick-point-sra').hours!.en, /sunrise to sunset/);
  // (W8-S review) the hours and the 40 mph wind rule are the Sutro Stewards' trail-map page's (UCSF's reserve page states
  // neither: re-read 2026-09-30), so the line cites that page and does not say "per UCSF"
  assert.ok(cites('mount-sutro-open-space', 'https://www.sutrostewards.org/trail-map'));
  assert.doesNotMatch(card('mount-sutro-open-space').hours!.en, /UCSF/);
  assert.match(card('mount-sutro-open-space').hours!.en, /Sutro Stewards/);
  assert.ok(cites('herons-head-park', 'https://sfrecpark.org/facilities/facility/details/Herons-Head-Park-Nature-Exploration-Area-447'));
  assert.ok(cites('crane-cove-park', 'https://www.sfport.com/cranecovepark'));
  assert.ok(cites('boudin-bakery', 'https://boudinbakery.com/boudin-at-the-wharf/'));
  // no new line invents a price for a free public place
  for (const id of ['balmy-alley', 'clarion-alley', 'lyon-street-steps', 'wave-organ', 'cupids-span', 'china-beach']) assert.doesNotMatch(card(id).cost!.zh, /美元|\$/);
});
