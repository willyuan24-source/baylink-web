import assert from 'node:assert/strict';
import test from 'node:test';
import { localDiscoveries } from '../src/data/local-discoveries';
import { buildDetailRecord } from '../src/features/detail/build-detail';
import { heroCover, railCovers } from '../src/features/detail/hero-cover';
import { createCoverPage } from '../src/lib/cover';
import { getBayAreaToday } from '../src/lib/monthly';

// UI9-IMG-A1b (UI9-IMAGES DECISIONS 21/22): a detail page's hero and its rail cards are pictures — the listing's own, else its
// next candidate the build chose (② venue → ③ stock → ④ approved AI) — never an information card.
test('every detail hero and rail card is a picture (0 information cards)', () => {
  const today = getBayAreaToday();
  const typed: string[] = [];
  // Live listings (an event that has not ended; every offer and opening the site lists), as report:covers' inventory.
  for (const item of localDiscoveries.filter(row => row.kind !== 'event' || row.event.endDate >= today)) {
    const record = buildDetailRecord(item);
    const id = item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id;
    if (heroCover(record, today).tier === 'type') typed.push(`${item.kind}:${id} hero`);
    const page = createCoverPage();
    const rail = record.rail.filter(event => event.endDate >= today);
    railCovers(rail.map(event => ({ event, date: event.startDate })), today, page)
      .forEach((cover, index) => { if (cover.tier === 'type') typed.push(`${item.kind}:${id} rail ${rail[index].id}`); });
  }
  assert.deepEqual(typed, []);
});

// /plan (UI9-IMG-A1b): every live event stop resolves to a picture with the plan extras' candidates and images.
test('every live /plan event stop is a picture (plan extras coverKeys)', async () => {
  const { buildPlanCatalog } = await import('../scripts/generate-plan-catalog');
  const { getCover } = await import('../src/lib/cover');
  const catalog = buildPlanCatalog();
  const today = getBayAreaToday();
  const typed = catalog.events.filter(event => event.endDate >= today).filter(event => getCover(
    { kind: 'event', id: event.id, imageKey: event.imageKey, ...(catalog.coverKeys?.[event.id] ? { imageKeys: catalog.coverKeys[event.id] } : {}) },
    { images: key => catalog.images[key], today }).tier === 'type').map(event => event.id);
  assert.deepEqual(typed, []);
  // Places: a place with no picture and no postcard shows a ③ picture of its kind; a landmark without either is listed here.
  const { installPlanExtras } = await import('../src/lib/planner-source');
  const { stopCoverItem } = await import('../src/lib/plan-stop-cover');
  installPlanExtras(catalog);
  const places = catalog.places.filter(place => getCover(stopCoverItem({ kind: 'place', id: place.id }), { images: key => catalog.images[key], today }).tier === 'type').map(place => place.id);
  assert.deepEqual(places, [], 'every planner place shows a picture');
});

test('the eight home entry tiles: a lazy 480 w photo each, its name and one line on a scrim white text reads at ≥ 4.5:1 (DECISIONS 27)', async () => {
  const { readFileSync } = await import('node:fs');
  const { HOME_TILES } = await import('../src/lib/home-catalog');
  const tiles = JSON.parse(readFileSync('src/data/home-tile-photos.json', 'utf8')) as Record<string, { key: string }>;
  assert.deepEqual(Object.keys(HOME_TILES).sort(), Object.keys(tiles).sort());
  for (const [id, photo] of Object.entries(HOME_TILES)) {
    assert.match(photo.src, /-small\.webp$/, `${id}: the 480 w file`);
    assert.equal(photo.width, 480);
    assert.match(photo.credit, /^入口配图/, `${id}: credited as an entry photo, never 示意图`);
  }
  // The warm scrim (tokens.css --color-scrim-rgb 30 24 16) at .62 from 38% of the tile down, over a white pixel: white text ≥ 4.5:1.
  const css = readFileSync('src/components/home-discovery.css', 'utf8');
  assert.match(css, /\.home-mood::before \{[^}]*rgb\(var\(--color-scrim-rgb\) \/ \.62\) 38%, rgb\(var\(--color-scrim-rgb\) \/ \.8\) 100%\)/);
  const lin = (v: number) => (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const over = (alpha: number) => [30, 24, 16].map(channel => (alpha * channel + (1 - alpha) * 255) / 255);
  const luminance = (rgb: number[]) => rgb.map(lin).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  assert.ok(1.05 / (luminance(over(.62)) + .05) >= 4.5, `${(1.05 / (luminance(over(.62)) + .05)).toFixed(2)}:1`);
  assert.doesNotMatch(readFileSync('src/features/home/MoodCircles.tsx', 'utf8'), /className="[^"]*ui-chip/, 'the tiles are .home-mood, not the shared chip');
});

test('captain 10-21 18:30: a short /guides topic row ends on 看全部, and a row\'s ♡ sits on its thumbnail at a third of it, hit area 44 px', async () => {
  const { readFileSync } = await import('node:fs');
  const library = readFileSync('src/features/guides/guide-library.css', 'utf8');
  assert.match(library, /\.gl-all-cell \{ display:none; \}/);
  assert.match(library, /html:not\(\[data-reading\$=large\]\) \.gl-all-cell \{ display:flex; grid-column:span var\(--gl-rest, 1\); \}/);
  assert.match(readFileSync('src/components/GuidesHome.tsx', 'utf8'), /className="gl-all-cell" style=\{\{ '--gl-rest': 4 - shown \}/);
  const home = readFileSync('src/components/home-discovery.css', 'utf8');
  assert.match(home, /\.ui-feed-card__save \{ grid-area:1 \/ 1 \/ 2 \/ 2; top:var\(--sp-1\); right:var\(--sp-1\); \}/, 'home 大 / 特大 rows: ♡ on the thumbnail');
  assert.doesNotMatch(home, /\.ui-feed-card__title \{ padding-right:48px; \}/, 'the title keeps the row width');
  const events = readFileSync('src/features/events/events.css', 'utf8');
  for (const css of [home, events]) {
    assert.match(css, /width:36px; height:36px; min-height:36px;/);
    assert.match(css, /\.saves-toggle::after \{ content:""; position:absolute; inset:-4px; \}/, '36 + 2 × 4 = 44 px to tap');
  }
});

test('every share card and weekly tile fronts a picture promotion allows: never AI art, never CC BY-SA (DECISIONS 21/24)', async () => {
  const { localDiscoveries } = await import('../src/data/local-discoveries');
  const { guides } = await import('../src/data/guides');
  const { GUIDE_IMAGES, getGuideMedia } = await import('../src/data/guide-media');
  const { cardPhoto, promoPhoto, sharePicture } = await import('../src/lib/share-card-model');
  const { isAiIllustration } = await import('../src/lib/cover');
  const today = '2026-10-22';
  const pictures = [
    ...localDiscoveries.map(item => { const record = item.kind === 'event' ? item.event : item.kind === 'offer' ? item.offer : item.shop; return [`${item.kind}:${record.id}`, sharePicture(item.kind, record, cardPhoto(item, GUIDE_IMAGES[record.imageKey], today), GUIDE_IMAGES)] as const; }),
    ...guides.map(guide => [`guide:${guide.slug}`, sharePicture('guide', { id: guide.slug, title: guide.title, category: guide.category }, promoPhoto(getGuideMedia(guide).cover), GUIDE_IMAGES)] as const),
  ];
  assert.deepEqual(pictures.filter(([, image]) => !image).map(([id]) => id), [], 'every card has a picture');
  for (const [id, image] of pictures) {
    assert.ok(!isAiIllustration(image as never) && (typeof image!.rights !== 'object' || image!.rights?.basis !== 'ai'), `${id}: no AI art on a share card`);
    assert.doesNotMatch(image!.licenseUrl ?? '', /by-sa/i, `${id}: no CC BY-SA photo (the card prints no author or licence)`);
  }
  const used = new Set<string>();
  const event = localDiscoveries.find(item => item.kind === 'event')!;
  const first = sharePicture('event', (event as { event: { id: string; imageKey: string } }).event, undefined, GUIDE_IMAGES, used)!;
  used.add(first.src);
  assert.notEqual(sharePicture('event', (event as { event: { id: string; imageKey: string } }).event, undefined, GUIDE_IMAGES, used)?.src, first.src, 'a weekly card shows each file once');
});

test('item 9 checks: a heavy stock picture comes last; city-sights only on city guides; Fruitvale (11/01) shows ③, the 11/01 lead is ①②', async () => {
  const { coverCandidates, COVER_TABLES, HEAVY_STOCK } = await import('../src/lib/cover-candidates');
  const pool = COVER_TABLES.categories.halloween ?? [];
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const keys = coverCandidates('event', { id, title: '万圣节南瓜灯 Halloween', venue: 'Park' }).filter(key => pool.includes(key));
    if (keys.length) assert.ok([...HEAVY_STOCK].every(key => !keys.includes(key) || keys.at(-1) === key), `${id}: ${keys.join(', ')}`);
  }
  const { readFileSync } = await import('node:fs');
  const { photoCategoryOf } = await import('../src/lib/photo-category');
  const index = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8'));
  const later = JSON.parse(readFileSync('src/data/generated/events-later.json', 'utf8'));
  const boards = JSON.parse(readFileSync('src/data/generated/events-boards.json', 'utf8'));
  const records = [...index.events.map((e: object) => ['event', e]), ...later.events.map((e: object) => ['event', e]), ...boards.offers.map((o: object) => ['offer', o]), ...boards.openings.map((o: object) => ['opening', o])] as [string, Record<string, unknown>][];
  assert.deepEqual(records.filter(([kind, record]) => photoCategoryOf(kind, record) === 'city-sights').map(([, record]) => record.id), [], 'city-sights (real landmarks) never on an event, offer or new shop');
  const fruitvale = [...index.events, ...later.events].find((event: { id: string }) => event.id === 'nov2026-fruitvale-dia-muertos');
  if (fruitvale) assert.ok(fruitvale.imageKeys?.length && fruitvale.imageKeys.every((key: string) => key.startsWith('stock-')), 'Fruitvale shows a ③ picture, not its AI art');
  const home = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8'));
  if (home.weekends['2026-11-01']) assert.notEqual(home.weekends['2026-11-01'].ids[0], 'nov2026-fruitvale-dia-muertos', 'the 11/01 lead has a ① or ② picture');
});
