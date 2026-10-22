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
  assert.match(home, /\.ui-feed-card__save \{ top:var\(--sp-1\); right:auto; left:calc\(112px - 36px - var\(--sp-1\)\); \}/, 'home 大 / 特大 rows: ♡ on the thumbnail');
  assert.doesNotMatch(home, /\.ui-feed-card__title \{ padding-right:48px; \}/, 'the title keeps the row width');
  const events = readFileSync('src/features/events/events.css', 'utf8');
  for (const css of [home, events]) {
    assert.match(css, /width:36px; height:36px; min-height:36px;/);
    assert.match(css, /\.saves-toggle::after \{ content:""; position:absolute; inset:-4px; \}/, '36 + 2 × 4 = 44 px to tap');
  }
});
