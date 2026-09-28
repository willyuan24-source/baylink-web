import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CURB_BAND } from '../src/opus-bay/core/geo';
import type { Vec2 } from '../src/opus-bay/core/types';
import { DISTRICT } from '../src/opus-bay/data/district';
import { ATTRACTIONS, tripDestination } from '../src/opus-bay/data/sf/attractions';
import { SITE_ARRIVALS } from '../src/opus-bay/data/sf/siteArrivals';
import { SEWARD_SLIDES_WORLD } from '../src/opus-bay/data/sf/sewardSlides';
import { ROAD_CLASSES, demSample } from '../src/opus-bay/world/sf/format';
import { LOD0 } from '../src/opus-bay/world/sf/sites';
import { type SfLandmark, landmarkToWorld, sfLandmark, worldToLandmark } from '../src/opus-bay/world/sf/landmarks/index';
import { LANDMARK_TOPS } from '../src/opus-bay/world/sf/landmarks/tops';
import { W4_ALL_SITES, siteLod0R, w4Site } from '../src/opus-bay/world/sf/landmarks/w4sites';
import { W4_SITES_T3, W4_SITES_T3_NEXT } from '../src/opus-bay/world/sf/landmarks/w4list3';
import { SEWARD_SLIDES, sewardStreetSlides } from '../src/opus-bay/world/sf/landmarks/seward-street-slides';
import { sfDisk } from './opus-bay-sf-disk';

// Wave 5 · lane L (landmarks & streets): W5-L1 (the tier-3 sites registered, the sweep over every site-backed
// attraction's trip end, the site arrivals table for lane N), W5-L3 (the Seward Street Slides for lane A).

/** the 13 tier-3 sites W5-L1 registered (built by lane L3 after W4-IL1) */
const REGISTERED_W5 = ['womens-building', 'alta-plaza-park', 'buena-vista-park', 'calle-24', 'china-beach', 'glen-canyon-park', 'lafayette-park', 'mclaren-park', 'mount-sutro-open-space', 'mountain-lake-park', 'noe-valley-town-square', 'patricias-green', 'sutro-heights-park'];
/** the downtown gate spots (sf-w5-lead.md §6: nothing new there until lane V publishes the measured headroom) */
const DOWNTOWN = ['ferry-gate', 'chinatown', 'union-square', 'grace-nob-hill', 'powell-market'];

test('W5-L1: the tier-3 sites built after W4-IL1 are registered with their tops rows; none reaches a downtown gate spot (Ina Coolbrith waits)', () => {
  const spots = (JSON.parse(readFileSync(new URL('../scripts/opus-sf/qa/perf/w4-spots.json', import.meta.url), 'utf8')) as { spots: { id: string; go?: { x?: number; z?: number; anchor?: string } }[] }).spots;
  const at = (id: string): Vec2 => {
    const g = spots.find(s => s.id === id)!.go!;
    if (g.anchor) { const a = (DISTRICT.anchors as unknown as Record<string, Vec2>)[g.anchor]; return { x: a.x, z: a.z }; }
    return { x: g.x!, z: g.z! };
  };
  const ids = W4_SITES_T3.map(s => s.id);
  for (const id of REGISTERED_W5) {
    assert.ok(ids.includes(id), `${id} registered`);
    const s = sfLandmark(id);
    assert.ok(s && w4Site(id) === s, `${id} answers sfLandmark / w4Site`);
    assert.ok(LANDMARK_TOPS[id], `${id} has its tops row (scripts/opus-sf/assets/landmark-tops.ts)`);
    const r = siteLod0R(s) ?? LOD0[s.tier];
    for (const d of DOWNTOWN) {
      const p = at(d), dist = Math.hypot(p.x - s.x, p.z - s.z);
      assert.ok(dist > r, `${id}: its lod-0 ring (${r} u) reaches the ${d} gate spot (${dist.toFixed(0)} u)`);
    }
  }
  // two wait: the Wave Organ for lane D's egg spot at its tip (w4list3.ts), Ina Coolbrith for lane V's downtown
  // headroom (it is inside the Grace / Nob Hill spot's ring)
  assert.deepEqual(W4_SITES_T3_NEXT.map(s => s.id), ['wave-organ', 'ina-coolbrith-park']);
  const ina = W4_SITES_T3_NEXT[1], g = at('grace-nob-hill');
  assert.ok(Math.hypot(g.x - ina.x, g.z - ina.z) < LOD0[3], 'Ina Coolbrith would reach the Grace / Nob Hill spot');
  for (const s of W4_SITES_T3_NEXT) assert.equal(sfLandmark(s.id), undefined, `${s.id} not registered yet`);
});

// ---------------------------------------------------------------------------
// the sweep over the site-backed attractions' trip ends (the real walk data: every site's walk inputs, the rasters,
// the nav, the published walking graph)
// ---------------------------------------------------------------------------

const sf = sfDisk();
type Terrain = typeof import('../src/opus-bay/core/terrain');
type Nav = typeof import('../src/opus-bay/actors/nav');
let worldP: Promise<{ T: Terrain; nav: Nav; attach: (x: number, z: number, r: number) => Promise<unknown>; ix: Awaited<ReturnType<typeof sf.graphIndex>>; main: number }> | null = null;
/** the city as the game has it: CitySites' walk inputs, the far DEM, the renderer's base pins, the rasters on demand */
function world() {
  return (worldP ??= (async () => {
    const { createCityTerrain } = await import('../src/opus-bay/core/sfTerrain');
    const { CitySites } = await import('../src/opus-bay/world/sf/sites');
    const T = await import('../src/opus-bay/core/terrain'), nav = await import('../src/opus-bay/actors/nav');
    const far = await sf.far(), sites = new CitySites(), lms = sites.walkInputs();
    const city = createCityTerrain(sf.manifest, { landmarks: lms });
    city.setFar(far);
    sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
    sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
    T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
    const ix = await sf.graphIndex();
    return { T, nav, attach: (x: number, z: number, r: number) => sf.attachAround(city, x, z, r, lms), ix, main: ix.mainComponent() };
  })());
}

const DRIVEN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
const chunks = new Map<string, Awaited<ReturnType<typeof sf.chunk>>>();
const segDist = (p: Vec2, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L));
  return Math.hypot(p.x - ax - dx * t, p.z - az - dz * t);
};
/** in the toy traffic: the rasters paint 'road' AND the point lies on a driven street's asphalt (the landmarks test's rule) */
async function inTraffic(p: Vec2): Promise<string | null> {
  const w = await world();
  await w.attach(p.x, p.z, 8);
  if (w.T.surfaceAt(p.x, p.z) !== 'road') return null;
  for (let cz = Math.floor((p.z - 8) / 128); cz <= Math.floor((p.z + 8) / 128); cz++) for (let cx = Math.floor((p.x - 8) / 128); cx <= Math.floor((p.x + 8) / 128); cx++) {
    const k = `${cx}_${cz}`;
    if (!chunks.has(k)) chunks.set(k, await sf.chunk(cx, cz));
    const rd = chunks.get(k)?.roads;
    for (let i = 0; rd && i < rd.count; i++) {
      if (!DRIVEN.has(ROAD_CLASSES[rd.cls[i]])) continue;
      const wd = rd.width[i], asphalt = wd >= 3 ? wd / 2 - CURB_BAND : wd / 2;
      for (let q = rd.pStart[i]; q + 1 < rd.pStart[i + 1]; q++) {
        if (segDist(p, rd.xyz[q * 3], rd.xyz[q * 3 + 2], rd.xyz[q * 3 + 3], rd.xyz[q * 3 + 5]) <= asphalt) return `${ROAD_CLASSES[rd.cls[i]]} street`;
      }
    }
  }
  return null;
}
const pip = (p: Vec2, poly: readonly Vec2[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
};
const inSiteBlocker = (l: SfLandmark, w: Vec2) => { const p = worldToLandmark(l, w); return (l.walk?.blockers ?? []).some(b => ('poly' in b ? pip(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) < b.r)); };

/** Why a trip end fails (empty: it passes): standable, clear of the site, off the asphalt, reached from the walking graph, landed on by a fly-in. */
async function tripEndProblems(l: SfLandmark, p: Vec2, landingOpen = false): Promise<string[]> {
  const w = await world();
  await w.attach(p.x, p.z, 60);
  const out: string[] = [];
  if (!w.T.canStand(p.x, p.z, 0.4)) out.push('not standable');
  if (inSiteBlocker(l, p)) out.push('inside a blocker of the site');
  const t = await inTraffic(p);
  if (t) out.push(`on a ${t}'s asphalt`);
  const n = w.ix.nearestNode(p.x, p.z, 40, i => w.ix.component(i) === w.main);
  if (n < 0) out.push('no walking-graph node within 40 u');
  else {
    const path = w.nav.findPath({ x: w.ix.x(n), z: w.ix.z(n) }, p, 8), e = path?.points[path.points.length - 1];
    const d = !path ? Infinity : e ? Math.hypot(e.x - p.x, e.z - p.z) : 0;
    if (d >= 1.1) out.push(`the path from the walking graph stops ${d.toFixed(2)} u short`);
  }
  const land = w.nav.arrivalSpot(p, 30);
  if (!land) out.push('no fly-in landing');
  else if (!landingOpen) {
    const d = Math.hypot(land.x - p.x, land.z - p.z), lt = await inTraffic(land);
    if (d > 3) out.push(`a fly-in lands ${d.toFixed(1)} u away`);
    if (lt) out.push(`a fly-in lands on a ${lt}'s asphalt`);
  }
  return out;
}

/** attractions whose trip end stays open (with the reason; the report's Requests) */
const OPEN_TRIPS: Record<string, string> = {
  'balmy-alley': 'the alley is the site: its murals are on the garage doors either side and the site draws the lane',
  'cable-car-museum': 'the barn-side sidewalks are thinner than a nav cell and the far side of Mason St is the cable-car track (Requests: nav arrivalSpot)',
};
/** street sites whose sidewalk is thinner than a nav cell: the fly-in landing snaps into the kerb lane (Requests: nav) */
const LANDING_OPEN = new Set(['irving-street', 'clement-street', 'haight-ashbury']);

test('W5-L1: data/sf/siteArrivals.ts is the site records\' arrivals (sfLandmarkAnchor) for attractions the sites model', async () => {
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  assert.ok(Object.keys(SITE_ARRIVALS).length >= 20);
  const lines: string[] = [];
  for (const [id, e] of Object.entries(SITE_ARRIVALS)) {
    assert.ok(ATTRACTIONS.some(a => a.id === id), `${id} is an attraction`);
    const s = w4Site(e.site);
    assert.ok(s && s.w4.attractions.includes(id), `${e.site} models ${id}`);
    const a = sfLandmarkAnchor(e.site)!;
    lines.push(`  '${id}': { x: ${+a.x.toFixed(2)}, z: ${+a.z.toFixed(2)}, heading: ${+a.heading.toFixed(3)}, site: '${e.site}' },`);
    if (Math.abs(a.x - e.x) > 0.01 || Math.abs(a.z - e.z) > 0.01 || Math.abs(a.heading - e.heading) > 0.002) {
      console.log(`SITE_ARRIVALS is stale: paste into src/opus-bay/data/sf/siteArrivals.ts\n${lines.join('\n')}`);
      assert.fail(`${id}: (${e.x}, ${e.z}, ${e.heading}) vs sfLandmarkAnchor(${e.site}) (${a.x.toFixed(2)}, ${a.z.toFixed(2)}, ${a.heading.toFixed(3)})`);
    }
  }
});

test('W5-L1: the walk sweep — every site-backed attraction ends its trip where a walker can stand, off the asphalt, reached from the walking graph and landed on by a fly-in (the table where the attraction\'s own arrival fails)', async () => {
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const w = await world();
  const bad: string[] = [];
  let n = 0;
  try {
    for (const s of W4_ALL_SITES) {
      for (const id of s.w4.attractions) {
        const a = ATTRACTIONS.find(q => q.id === id);
        if (!a || OPEN_TRIPS[id]) continue;
        n++;
        const d = tripDestination(a), e = SITE_ARRIVALS[id], end = e ? { x: e.x, z: e.z } : { x: d.x, z: d.z };
        const p = await tripEndProblems(s, end, LANDING_OPEN.has(id));
        if (p.length) bad.push(`${id} (${end.x.toFixed(1)}, ${end.z.toFixed(1)}${e ? ', site table' : ', own arrival'}): ${p.join('; ')}`);
        // lane L3's tier-3 records: the trip ends at the feature, not the park's map point (plan MF2: McLaren 100 u off,
        // Mountain Lake 26 u, the sundial 10 u, the Wave Organ across the harbour)
        if (W4_SITES_T3.includes(s)) {
          const sa = sfLandmarkAnchor(s.id)!;
          if (Math.hypot(end.x - sa.x, end.z - sa.z) > 8) bad.push(`${id}: the trip ends ${Math.hypot(end.x - sa.x, end.z - sa.z).toFixed(1)} u from ${s.id}'s arrival`);
        }
      }
    }
  } finally { w.T.setCityTerrain(null); worldP = null; }
  assert.ok(n >= 60, `${n} attractions swept`);
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// W5-L3: the Seward Street Slides for lane A
// ---------------------------------------------------------------------------

test('W5-L3: data/sf/sewardSlides.ts is the Seward record in world coordinates (chute lines, deck, arrival, foot)', async () => {
  const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
  const S = sewardStreetSlides, T = SEWARD_SLIDES_WORLD, near = (a: number, b: number) => Math.abs(a - b) <= 0.011;
  assert.equal(T.site, S.id);
  assert.ok(S.w4.attractions.includes(T.attraction));
  assert.equal(S.yaw, 0, 'the table adds the origin and the base (yaw 0)');
  assert.equal(T.chutes.length, SEWARD_SLIDES.length);
  T.chutes.forEach((c, k) => {
    const l = SEWARD_SLIDES[k];
    for (const [w, p] of [[c.top, l.to], [c.bottom, l.from]] as const) {
      assert.ok(near(w.x, S.x + p.x) && near(w.z, S.z + p.z) && near(w.y, S.base + p.y), `${c.id}: (${w.x}, ${w.y}, ${w.z}) vs the record's line`);
    }
    assert.ok(c.top.y > c.bottom.y + 2, `${c.id} runs downhill`);
    assert.ok(near(c.heading, Math.PI), 'downhill toward Seward Street (−z)');
    assert.ok(Math.hypot(c.start.x - c.top.x, c.start.z - c.top.z) <= 0.6, `${c.id}: the start stands at the chute head`);
    assert.ok(Math.hypot(c.runout.x - c.bottom.x, c.runout.z - c.bottom.z) <= 0.8, `${c.id}: the run-out is at the chute's end`);
  });
  const deck = S.walk!.surfaces![0];
  assert.ok(near(T.deck.y, S.base + (deck.y as number)), 'the deck height is the walk surface\'s');
  assert.ok(pip(worldToLandmark(S, T.deck), deck.poly), 'the deck point is on the deck');
  const a = sfLandmarkAnchor(S.id)!;
  assert.ok(near(T.arrival.x, a.x) && near(T.arrival.z, a.z) && near(T.arrival.heading, a.heading), 'the arrival is the site\'s');
  assert.ok(pip(worldToLandmark(S, T.arrival), deck.poly), 'the arrival is on the deck');
  const f = worldToLandmark(S, T.foot);
  assert.ok(f.z < -2 && Math.abs(f.x) < 1, 'the foot is below the chutes\' ends');
  assert.deepEqual([...T.hours.days].sort(), [0, 2, 3, 4, 5, 6], 'Tuesday to Sunday');
  assert.equal(T.hours.open, 600);
  assert.equal(T.hours.close, 1020);
  assert.match(T.hours.sourceUrl, /^https:\/\/sfrecpark\.org\//);
  assert.match(T.hours.verifiedAt, /^2026-\d\d-\d\d$/);
});

test('W5-L3: the Seward top deck is walkable, each chute head is stood at from it, and the stairs lead up to it from the foot and down from Corwin Street', async () => {
  const w = await world();
  const S = sewardStreetSlides, T = SEWARD_SLIDES_WORLD;
  try {
    await w.attach(S.x, S.z, 60);
    // the auto-walk (0.75 u nav cells) stops within a step of the spot, and that last step is standable all the way
    // (the player's stick or lane A's activity covers it)
    const walked = (from: Vec2, to: Vec2) => {
      const p = w.nav.findPath(from, to, 1), e = p?.points[p.points.length - 1];
      if (!p || !e) return Infinity;
      const d = Math.hypot(e.x - to.x, e.z - to.z);
      for (let t = 0; t <= 1; t += 0.05) if (!w.T.canStand(e.x + (to.x - e.x) * t, e.z + (to.z - e.z) * t, 0.3)) return Infinity;
      return d < 1.3 ? 0 : d;
    };
    const corwin = landmarkToWorld(S, { x: 0, z: 7.4 });
    assert.ok(w.T.canStand(corwin.x, corwin.z, 0.3), 'the Corwin Street sidewalk above the deck');
    for (const c of T.chutes) {
      assert.ok(w.T.canStand(c.start.x, c.start.z, 0.3), `${c.id}: the start on the deck is standable`);
      assert.ok(Math.abs(w.T.heightAt(c.start.x, c.start.z) - c.start.y) < 0.05, `${c.id}: the start is on the deck's surface`);
      assert.ok(w.T.canStand(c.runout.x, c.runout.z, 0.3), `${c.id}: the run-out is standable`);
      assert.ok(walked(T.foot, c.start) < 0.8, `${c.id}: from the foot up the stairs to the chute head (${walked(T.foot, c.start).toFixed(2)} u short)`);
      assert.ok(walked(corwin, c.start) < 0.8, `${c.id}: from Corwin Street down onto the deck`);
      assert.ok(walked(c.runout, T.foot) < 0.8, `${c.id}: from the run-out back to the foot`);
    }
    // blockers vs drawn at the top: the rail across the deck's back and the lamp had no blocker (the player walked
    // through them); now every part drawn higher than a step over the deck and the way in behind it stands in a blocker
    // (the cardboard leans in the neighbour's wall clearance, outside the walk)
    const { buildLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
    const pos = buildLandmark(S, 0, 0).getAttribute('position'), dy = S.walk!.surfaces![0].y as number;
    const near = (p: Vec2) => S.walk!.blockers.some(b => ('poly' in b ? pip(p, b.poly) : Math.hypot(p.x - b.x, p.z - b.z) <= b.r + 0.05));
    const loose: string[] = [];
    for (let i = 0; i < pos.count; i++) {
      const p = { x: pos.getX(i), z: pos.getZ(i) };
      // body height over the deck (a lamp head overhead is not in the way)
      if (p.x < -0.72 || p.x > 0.95 || p.z < 5.6 || p.z > 7.2 || pos.getY(i) < dy + 0.25 || pos.getY(i) > dy + 2.4 || near(p)) continue;
      const wp = landmarkToWorld(S, p);
      if (w.T.canStand(wp.x, wp.z, 0.3)) loose.push(`(${p.x.toFixed(2)}, ${pos.getY(i).toFixed(2)}, ${p.z.toFixed(2)})`);
    }
    assert.deepEqual(loose.slice(0, 5), [], 'drawn parts where a walker stands');
  } finally { w.T.setCityTerrain(null); worldP = null; }
});

// ---------------------------------------------------------------------------
// W5-L2: the Ocean Beach fire rings follow the real season (lane R's isFireRingLit)
// ---------------------------------------------------------------------------

test('W5-L2: the fire rings burn only in the NPS season and hours (1 March – 31 October, 06:00 – 21:30 Bay time), through lane R\'s isFireRingLit', async () => {
  const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
  const { fireRingsLit, resetFireRings, oceanBeachFireRings: R } = await import('../src/opus-bay/world/sf/landmarks/ocean-beach-fire-rings');
  const { buildLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { CitySites } = await import('../src/opus-bay/world/sf/sites');
  const at = (spec: string) => { assert.ok(__setBayNowForTests(spec), spec); resetFireRings(); return fireRingsLit(); };
  const glow = () => { const g = buildLandmark(R, 0, 0), info = g.getAttribute('aInfo'); let n = 0; for (let i = 0; i < info.count; i++) if (info.getW(i) > 0) n++; return n; };
  const ringLights = () => new CitySites().siteLights().filter(l => l.color === '#ff9a4a' && Math.hypot(l.x - R.x, l.z - R.z) < 60).length;
  try {
    const cases: [string, boolean][] = [
      ['2026-10-03T19:00', true], ['2026-10-03T21:29', true], ['2026-10-03T21:30', false], ['2026-10-03T05:59', false],
      ['2026-10-31T21:00', true], ['2026-11-01T19:00', false], ['2026-11-05T19:00', false], ['2027-02-28T20:00', false],
      ['2027-03-01T20:00', true], ['2026-07-04T12:00', true],
    ];
    for (const [spec, want] of cases) assert.equal(at(spec), want, spec);
    // cold out of season: grey ash, no glow, no fire lights, and the lod 0 rebuilds when it flips (buildKey)
    at('2026-11-05T19:00');
    assert.equal(R.buildKey!(), 0);
    assert.equal(glow(), 0, 'no ember glow');
    assert.equal(ringLights(), 0, 'no fire lights in the night light field');
    at('2026-10-03T19:00');
    assert.equal(R.buildKey!(), 1);
    assert.ok(glow() > 0, 'the embers glow');
    const g = buildLandmark(R, 0, 0), tris = (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;
    assert.ok(tris <= 800, `lit, the rings stay in the tier-3 cap: ${tris} ≤ 800`);
    assert.equal(ringLights(), 8, 'eight fire lights');
    // the Bay clock is asked at most every 15 s (buildKey runs every frame while the lod 0 is near)
    __setBayNowForTests('2026-11-05T19:00');
    assert.equal(fireRingsLit(), true, 'cached within 15 s');
    assert.equal(fireRingsLit(Date.now() + 15_001), false, 'asked again after 15 s');
  } finally { __setBayNowForTests(null); resetFireRings(); }
});
