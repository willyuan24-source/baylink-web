import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Wave 8 · lane S (W8-S2): Fleet Week's Parade of Ships (world/sf/fleetWeek.ts, world/sf/fleetWeekDay.ts) — toy ships on
// 9 Oct 2026 11:00–12:00 Bay time only, in under the Golden Gate's main span, along the waterfront and under the Bay
// Bridge's west span; over open water; ≤ 2 draw calls; a lazy chunk; fixed BAYBAY lines; the photo stamp.

// --- headless canvas stub (world modules create label atlases at import time; same as the events test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { parseBayDate, __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const D = await import('../src/opus-bay/world/sf/fleetWeekDay');
const F = await import('../src/opus-bay/world/sf/fleetWeek');
const { SOUVENIR_IDS, EVENT_SAY } = await import('../src/opus-bay/realsf/eventVenues');
const { projectCity } = await import('../src/opus-bay/core/geo');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
/** bubble width: CJK 1, ASCII 0.5, spaces 0 (the card / line tests' measure) */
const zhWidth = (s: string) => [...s].reduce((n, ch) => n + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);

test('W8-S2 window: the ships sail only on 9 Oct 2026, 11:00–12:00 Bay time (fleetweeksf.org, read 2026-09-30); the calendar row agrees', async () => {
  assert.equal(D.PARADE_SOURCE.sourceUrl, 'https://fleetweeksf.org/events/parade-of-ships/');
  for (const s of ['2026-10-09T11:00', '2026-10-09T11:20', '2026-10-09T11:59']) assert.equal(D.paradeOn(bay(s)), true, s);
  for (const s of ['2026-10-09T10:59', '2026-10-09T12:00', '2026-10-09T15:00', '2026-10-08T11:20', '2026-10-10T11:20', '2027-10-09T11:20']) assert.equal(D.paradeOn(bay(s)), false, s);
  assert.equal(D.isParadeDay(bay('2026-10-09T06:00')), true);
  assert.equal(D.isParadeDay(bay('2026-10-10T06:00')), false);
  const cal = await import('../src/opus-bay/realsf/calendar');
  const row = cal.CALENDAR.find(r => r.id === 'fleet-week-parade-of-ships-2026')!;
  assert.equal(row.from, D.PARADE_DAY);
  assert.equal(row.at, D.PARADE_FROM);
  assert.equal(row.source.url, D.PARADE_SOURCE.sourceUrl);
  // through the Bay clock (?date= on the dev server)
  __setBayNowForTests('2026-10-09T11:20');
  try { assert.equal(D.paradeOn(), true); } finally { __setBayNowForTests(null); }
});

test('W8-S2 the line: the fireboat under the Golden Gate at 11:00, ships 45 u apart, the last one at the path’s end at 12:00, nothing outside the window', () => {
  const p = F.paradePath();
  const w = D.paradeWindow();
  assert.ok(p.length > 1700 && p.length < 2100, `${p.length.toFixed(0)} u`);
  const gg = F.PATH_POINTS[F.BRIDGE_POINT];
  const lead = F.shipPose(0, w.open, p)!;
  assert.ok(Math.hypot(lead.x - gg.x, lead.z - gg.z) < 3, 'the fireboat under the main span at 11:00');
  // the Golden Gate's main span: the bridge point is between the towers, well clear of both
  const towers = [projectCity(37.8117, -122.4776), projectCity(37.8255, -122.4791)];
  for (const t of towers) assert.ok(Math.hypot(gg.x - t.x, gg.z - t.z) > 60, 'mid-span');
  // spacing along the path
  const mid = w.open + 30 * 60_000;
  for (let i = 1; i < F.SHIPS; i++) {
    const a = F.shipPose(i - 1, mid, p), b = F.shipPose(i, mid, p);
    assert.ok(a && b, `ship ${i} on the water at 11:30`);
    assert.ok(Math.abs(a!.s - b!.s - F.GAP) < 1e-6);
    assert.ok(Math.abs(Math.hypot(b!.hx, b!.hz) - 1) < 1e-6, 'a unit heading');
  }
  // the last ship reaches the end at the close; the others are gone by then
  const last = F.shipPose(F.SHIPS - 1, w.close - 1, p)!;
  assert.ok(last && p.length - last.s < 1 && last.scale < 0.1, 'the last ship sinks from view at the end');
  assert.equal(F.shipPose(0, w.close - 1, p), null, 'the fireboat is gone');
  // (W8-S review) the line sails in from outside the Gate before 11:00 (no pop-in under the deck): nothing before the
  // fireboat's entry at the path's start, nothing from 12:00, nothing the next day
  const entry = F.paradeEntryMs(p);
  assert.ok(entry < w.open && entry > w.open - 10 * 60_000, `the fireboat enters ${((w.open - entry) / 60_000).toFixed(1)} min before 11:00`);
  for (const ms of [entry - 1, w.close, bay('2026-10-10T11:20').getTime()]) for (let i = 0; i < F.SHIPS; i++) assert.equal(F.shipPose(i, ms, p), null);
  // seven ships on high, five (the fireboat + four) on phones
  assert.equal(F.shipCount('high'), 7);
  assert.equal(F.shipCount('mid'), 5);
  assert.equal(F.shipCount('low'), 5);
  // at 11:20 (the QA date) the line passes Marina Green: some ship within 200 u of the reviewing stand's spot
  const { WATCH } = { WATCH: { x: -377.5, z: 287.5 } };
  const at = bay('2026-10-09T11:20').getTime();
  const near = Array.from({ length: F.SHIPS }, (_, i) => F.shipPose(i, at, p)).filter(Boolean).map(s => Math.hypot(s!.x - WATCH.x, s!.z - WATCH.z));
  assert.ok(Math.min(...near) < 200, `${Math.min(...near).toFixed(0)} u from Marina Green at 11:20`);
});

test('W8-S4 the Alcatraz ferry (lane A): the line crosses its lanes once, briefly, and keeps ≥ 30 u from them otherwise', async () => {
  const { ALCA_OUT, ALCA_BACK } = await import('../src/opus-bay/data/ferry');
  const seg = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
  };
  const lane = (x: number, z: number) => Math.min(...[ALCA_OUT, ALCA_BACK].map(pts => Math.min(...pts.slice(1).map((b, i) => seg(x, z, pts[i], b)))));
  const p = F.paradePath();
  const stretches: number[] = [];
  let run = 0;
  for (let i = 0; i < p.n; i++) {
    if (lane(p.pos[i * 2], p.pos[i * 2 + 1]) < 30) run += p.step;
    else if (run) { stretches.push(run); run = 0; }
  }
  if (run) stretches.push(run);
  assert.equal(stretches.length, 1, `one crossing (${stretches.map(s => s.toFixed(0)).join(', ')} u)`);
  assert.ok(stretches[0] <= 130, `the crossing is short: ${stretches[0].toFixed(0)} u within 30 u of the lanes`);
});

test('W8-S4 the Marina Green spot on the parade day: 舰船巡游 · 码头绿地 in the morning, 拍舰船巡游 while the ships sail, the jets’ after', () => {
  assert.equal(D.paradeWatchState(bay('2026-10-09T06:00')), 'soon');
  assert.equal(D.paradeWatchState(bay('2026-10-09T10:59')), 'soon');
  assert.equal(D.paradeWatchState(bay('2026-10-09T11:00')), 'on');
  assert.equal(D.paradeWatchState(bay('2026-10-09T11:59')), 'on');
  for (const s of ['2026-10-09T12:00', '2026-10-09T15:00', '2026-10-08T10:00', '2026-10-10T10:00']) assert.equal(D.paradeWatchState(bay(s)), null, s);
  assert.deepEqual(F.PARADE_SOON.name, { zh: '舰船巡游 · 码头绿地', en: 'Parade of Ships · Marina Green' });
  assert.equal(F.PARADE_WATCH.verb.zh, '拍舰船巡游');
});

test('W8-S2 the path: over open water, ≥ 25 u from any shore, clear of the harbour ferry’s loop and Alcatraz, under both bridges between their towers', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { FERRY_ROUTES } = await import('../src/opus-bay/data/ferry');
  const { CITY_BACKDROP } = await import('../src/opus-bay/world/backdrop');
  const p = F.paradePath();
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (let i = 0; i < p.n; i += 12) await sf.attachAround(city, p.pos[i * 2], p.pos[i * 2 + 1], 48, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const gg = F.PATH_POINTS[F.BRIDGE_POINT];
    const alcatraz = projectCity(37.8262, -122.4222);
    const harbour = FERRY_ROUTES.find(r => r.id === 'ferry')!.loop;
    let checked = 0;
    for (let i = 0; i < p.n; i += 2) {
      const x = p.pos[i * 2], z = p.pos[i * 2 + 1];
      assert.ok(Math.hypot(x - alcatraz.x, z - alcatraz.z) > 80, `Alcatraz at (${x.toFixed(0)}, ${z.toFixed(0)})`);
      for (const f of harbour) assert.ok(Math.hypot(x - f.x, z - f.z) > 30, `the harbour ferry's loop at (${x.toFixed(0)}, ${z.toFixed(0)})`);
      if (Math.hypot(x - gg.x, z - gg.z) < 40) continue; // the Golden Gate's deck is walkable ground over the water
      checked++;
      assert.ok(isWater(x, z), `open water at (${x.toFixed(0)}, ${z.toFixed(0)})`);
      for (let a = 0; a < 16; a++) {
        const xx = x + 25 * Math.cos(a / 16 * 2 * Math.PI), zz = z + 25 * Math.sin(a / 16 * 2 * Math.PI);
        assert.ok(isWater(xx, zz), `no shore within 25 u of (${x.toFixed(0)}, ${z.toFixed(0)})`);
      }
    }
    assert.ok(checked > 400, `${checked} samples`);
    // the Bay Bridge: the line crosses the W2–W3 span (the first suspension span) ≥ 30 u from either tower
    const { w2, w3 } = CITY_BACKDROP['bay-bridge-piers'];
    let crossing: { x: number; z: number } | null = null;
    const side = (x: number, z: number) => (w3.x - w2.x) * (z - w2.z) - (w3.z - w2.z) * (x - w2.x);
    for (let i = 1; i < p.n && !crossing; i++) {
      const ax = p.pos[i * 2 - 2], az = p.pos[i * 2 - 1], bx = p.pos[i * 2], bz = p.pos[i * 2 + 1];
      const sa = side(ax, az), sb = side(bx, bz);
      if (sa === 0 || Math.sign(sa) !== Math.sign(sb)) {
        const t = sa / (sa - sb);
        const c = { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
        const along = ((c.x - w2.x) * (w3.x - w2.x) + (c.z - w2.z) * (w3.z - w2.z)) / ((w3.x - w2.x) ** 2 + (w3.z - w2.z) ** 2);
        if (along > 0 && along < 1) crossing = c;
      }
    }
    assert.ok(crossing, 'the line passes under the west span between W2 and W3');
    for (const t of [w2, w3]) assert.ok(Math.hypot(crossing!.x - t.x, crossing!.z - t.z) >= 30, 'clear of the towers');
  } finally {
    setCityTerrain(null);
  }
});

test('W8-S2 budget and look: ≤ 2 draw calls, ≤ 3.5k triangles at quality high, grey toy ships under the Bay Bridge’s deck, flat toy colours', async () => {
  const ship = F.buildShipGeometry(), fire = F.buildFireboatGeometry();
  for (const geo of [ship, fire]) for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(geo.getAttribute(a), a);
  const tris = (geo: ReturnType<typeof F.buildShipGeometry>) => (geo.index?.count ?? geo.getAttribute('position').count) / 3;
  const high = 6 * tris(ship) + tris(fire);
  assert.ok(high <= 3500, `${high} triangles at quality high`);
  // one material for both meshes, the city's instanced toy program (no new shader program)
  const mat = F.makeShipMaterial();
  assert.equal(mat.customProgramCacheKey(), 'ob-toy-inst');
  assert.equal(mat.vertexColors, true);
  // under the Bay Bridge's toy deck (its truss band's underside at 8.7 u) with a margin; the Golden Gate's deck is at 15.2
  ship.computeBoundingBox();
  const top = ship.boundingBox!.max.y * Math.max(...F.SHIP_SIZES.map(s => s[1])) - 0.6 + 0.05;
  assert.ok(top < 8.7 - 1, `the tallest mast top at ${top.toFixed(2)} u`);
  assert.ok(F.SHIP_TOP * 1 - 0.6 < 8.7, 'SHIP_TOP agrees');
  // a handful of flat toy colours: greys, a dark boot-top, foam — no flag colours on the grey ships
  const col = ship.getAttribute('color');
  const colours = new Set<string>();
  for (let i = 0; i < col.count; i++) colours.add(`${col.getX(i).toFixed(2)},${col.getY(i).toFixed(2)},${col.getZ(i).toFixed(2)}`);
  assert.ok(colours.size <= 9, `${colours.size} colours`);
  for (const c of colours) {
    const [r, gg, b] = c.split(',').map(Number);
    const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
    // greys and foam are near-neutral; the boot-top is the one muted red-brown (a real hull's anti-fouling paint)
    assert.ok(sat < 0.12 || (r > gg && r > b && Math.max(r, gg, b) < 0.25), `a toy grey, not a flag colour: ${c}`);
  }
  ship.dispose(); fire.dispose(); mat.dispose();
});

test('W8-S2 BAYBAY’s lines are fixed (voiceable), short, bilingual; the photo stamp is an appended souvenir with a name', () => {
  for (const l of [F.PARADE_DAY_LINE, F.PARADE_NOW_LINE, F.PARADE_NEAR_LINE, F.PARADE_PHOTO_LINE]) {
    assert.ok(zhWidth(l.zh) <= 45, `${l.zh}: ${zhWidth(l.zh)}`);
    assert.ok(l.en.length <= 110, l.en);
    assert.doesNotMatch(l.en, /\p{Script=Han}/u);
    assert.doesNotMatch(l.zh + l.en, /\$\{|\{\w+\}/, 'no template');
  }
  assert.doesNotMatch(F.PARADE_NEAR_LINE.zh + F.PARADE_DAY_LINE.zh, /军舰|战舰|导弹|炮/, 'toy ships: no weapons talk');
  assert.equal(F.PARADE_SOUVENIR, 'fleet-week-2026-parade');
  // append-only: right after the W7 ids (a save keeps its bits)
  assert.equal(SOUVENIR_IDS.indexOf(F.PARADE_SOUVENIR), SOUVENIR_IDS.indexOf('sf-sunday-streets-excelsior-oct18-2026') + 1);
  assert.ok(F.PARADE_SOUVENIR.length <= 40);
  assert.deepEqual(EVENT_SAY[F.PARADE_SOUVENIR], { zh: '舰队周舰船巡游', en: 'the Parade of Ships' });
});

test('W8-S2 a lazy chunk: realsf/index.ts imports the ships only dynamically (the day check is tiny), never GameRoot or the district', () => {
  const index = fs.readFileSync(path.resolve('src/opus-bay/realsf/index.ts'), 'utf8');
  assert.match(index, /import\('\.\.\/world\/sf\/fleetWeek'\)/);
  assert.doesNotMatch(index, /^import \{[^}]*\} from '\.\.\/world\/sf\/fleetWeek';/m, 'no static import of the ships');
  const day = fs.readFileSync(path.resolve('src/opus-bay/world/sf/fleetWeekDay.ts'), 'utf8');
  assert.deepEqual([...day.matchAll(/^import .* from '([^']+)';/gm)].map(m => m[1]), ['../../game/bayNow'], 'the day check imports only the Bay clock');
  for (const f of ['src/opus-bay/game/GameRoot.tsx', 'src/opus-bay/world/sf/cityWorld.ts']) {
    if (fs.existsSync(path.resolve(f))) assert.doesNotMatch(fs.readFileSync(path.resolve(f), 'utf8'), /fleetWeek/, f);
  }
});

test('W8-S2 the runtime: the day line before 11:00, the now line during, the fireboat line near it, nothing after 12:00; the ships build only near', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
  const { WATCH } = await import('../src/opus-bay/realsf/jets');
  const keys = (fw: { offered(): { key: string }[] }) => fw.offered().map(l => l.key);
  const step = () => stepFrameSystems(0.6, 0);
  const put = (x: number, z: number) => { runtime.player.x = x; runtime.player.z = z; };
  const saved = { x: runtime.player.x, z: runtime.player.z };
  __setBayNowForTests('2026-10-09T09:00');
  const fw = F.initFleetWeek();
  try {
    put(0, 600); // the Mission, far from Marina Green
    step();
    assert.deepEqual(keys(fw), ['parade-day']);
    assert.equal(fw.stats().on, false);
    __setBayNowForTests('2026-10-09T11:20');
    step();
    assert.equal(fw.stats().on, true);
    assert.deepEqual(keys(fw), ['parade-now'], 'during the parade, far away: the now line');
    fw.said('parade-now');
    assert.deepEqual(keys(fw), ['parade-now'], 'the scheduler forgets a key per Bay day; the module keeps offering it');
    // at the reviewing stand while the fireboat passes (≈ 11:16)
    __setBayNowForTests('2026-10-09T11:16');
    put(WATCH.x, WATCH.z);
    step();
    assert.ok(keys(fw).includes('parade-near'), `near the fireboat: ${keys(fw)}`);
    assert.ok(!keys(fw).includes('parade-now'), 'not the far line at Marina Green');
    assert.equal(fw.stats().built, false, 'no world in a node test: nothing is built');
    // the tail of the line passing, the fireboat long gone: no fireboat line
    __setBayNowForTests('2026-10-09T11:40');
    step();
    assert.ok(!keys(fw).includes('parade-near'));
    __setBayNowForTests('2026-10-09T12:10');
    step();
    assert.equal(fw.stats().on, false);
    assert.deepEqual(keys(fw), []);
    __setBayNowForTests('2026-10-10T09:00');
    put(0, 600);
    step();
    assert.deepEqual(keys(fw), [], 'the next day: nothing');
  } finally {
    fw.off();
    __setBayNowForTests(null);
    put(saved.x, saved.z);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// W8-S review (Ultra): the reviewers' findings S-P1 … S-P6, S-code-3 / 4
// ---------------------------------------------------------------------------------------------------------------

test('W8-S review S-P4: no ship pops in — each sails in from the path’s start, growing out of the water; the fireboat is under the Gate at 11:00', () => {
  const p = F.paradePath(), w = D.paradeWindow();
  for (let i = 0; i < F.SHIPS; i++) {
    let was = false;
    for (let ms = w.open - 15 * 60_000; ms < w.close; ms += 1000) {
      const s = F.shipPose(i, ms, p);
      const now = !!s && s.scale > 0;
      if (now && !was) assert.ok(s!.scale < 0.1 && s!.s < 2, `ship ${i} appears at arc ${s!.s.toFixed(1)} u with scale ${s!.scale.toFixed(2)}`);
      was = now;
    }
  }
  const gg = F.PATH_POINTS[F.BRIDGE_POINT], lead = F.shipPose(0, w.open, p)!;
  assert.ok(Math.hypot(lead.x - gg.x, lead.z - gg.z) < 3, 'the fireboat under the main span at 11:00');
});

test('W8-S review S-P1: the Marina Green spot says 拍舰船巡游 only while a ship is near enough to pay; before the line it informs, after it points on', () => {
  const p = F.paradePath(), w = D.paradeWindow();
  const WATCH = { x: -377.5, z: 287.5 };
  let photo = 0;
  for (let ms = w.open; ms < w.close; ms += 30_000) {
    const st = F.standState(ms, p);
    const ships = Array.from({ length: F.SHIPS }, (_, i) => F.shipPose(i, ms, p)).filter(s => s && s.scale > 0.5);
    const near = Math.min(...ships.map(s => Math.hypot(s!.x - WATCH.x, s!.z - WATCH.z)));
    // the photo camera stands ≤ 12 u behind the player: a ship within PHOTO_NEAR − 12 of the spot is near enough to pay
    if (st === 'photo') { photo++; assert.ok(near < F.PHOTO_NEAR - 12, `${new Date(ms).toISOString()}: photo prompt with the nearest ship ${near.toFixed(0)} u away`); }
  }
  assert.ok(photo >= 40, `${photo} half-minutes of photo prompt`);
  assert.equal(F.standState(w.open, p), 'coming', '11:00: the line is still at the Gate');
  assert.equal(F.standState(bay('2026-10-09T11:20').getTime(), p), 'photo');
  assert.equal(F.standState(bay('2026-10-09T11:50').getTime(), p), 'follow', '11:50: the line is off the Embarcadero');
});

test('W8-S review S-P2: BAYBAY’s waypoint follows the line — the first viewing spot along the route the ships still pass; never away from ships in front of the player', async () => {
  const p = F.paradePath();
  const at = (s: string) => bay(s).getTime();
  assert.equal(F.viewSpotAt(at('2026-10-09T10:30'), p)?.id, 'realsf:jets-watch', 'before the parade: the reviewing stand');
  assert.equal(F.viewSpotAt(at('2026-10-09T11:20'), p)?.id, 'realsf:jets-watch');
  assert.equal(F.viewSpotAt(at('2026-10-09T11:30'), p)?.id, 'place:aquatic-park-hyde-pier');
  assert.equal(F.viewSpotAt(at('2026-10-09T11:42'), p)?.id, 'place:ferry-building');
  assert.equal(F.viewSpotAt(at('2026-10-09T11:55'), p), null, 'the line is nearly home: no spot to send anyone to');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const keys = (fw: { offered(): { key: string }[] }) => fw.offered().map(l => l.key);
  const put = (x: number, z: number) => { runtime.player.x = x; runtime.player.z = z; };
  const saved = { x: runtime.player.x, z: runtime.player.z };
  __setBayNowForTests('2026-10-09T11:42');
  const fw = F.initFleetWeek();
  try {
    // the Ferry Building at 11:42: the line passes in front — the fireboat's line, not "go to Marina Green"
    put(132.11, 19.31);
    stepFrameSystems(0.6, 0);
    assert.ok(!keys(fw).includes('parade-now'), `ships in front of the player: ${keys(fw)}`);
    assert.ok(keys(fw).includes('parade-near'), `${keys(fw)}`);
    // far away (the Mission) at 11:42: the now line, and its waypoint is the Ferry Building, not Marina Green
    put(0, 600);
    stepFrameSystems(0.6, 0);
    assert.deepEqual(keys(fw), ['parade-now']);
    const { game } = await import('../src/opus-bay/core/store');
    const mode = game.get().mode;
    game.set({ mode: 'free' });
    try {
      flow.set({ mapTarget: null });
      fw.said('parade-now');
      assert.equal(flow.get().mapTarget, 'place:ferry-building');
    } finally { game.set({ mode }); flow.set({ mapTarget: null }); }
    // the end of the path at 11:59: the last ship beside the player — no far line
    __setBayNowForTests('2026-10-09T11:59');
    put(420, -60);
    stepFrameSystems(0.6, 0);
    assert.ok(!keys(fw).includes('parade-now'), `${keys(fw)}`);
    // the Golden Gate deck at 10:58: the fireboat sailing in under the player — no "watch from Marina Green"
    __setBayNowForTests('2026-10-09T10:58');
    put(-865.8, 508.6);
    stepFrameSystems(0.6, 0);
    assert.ok(!keys(fw).includes('parade-day'), `${keys(fw)}`);
  } finally {
    fw.off();
    flow.set({ mapTarget: null });
    __setBayNowForTests(null);
    put(saved.x, saved.z);
  }
});

test('W8-S review S-P5: the parade’s lines are on offer from its first frame; realsf/index.ts holds the jets’ lines while the chunk loads', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const saved = { x: runtime.player.x, z: runtime.player.z };
  runtime.player.x = 0; runtime.player.z = 600;
  __setBayNowForTests('2026-10-09T11:42');
  const fw = F.initFleetWeek();
  try {
    assert.deepEqual(fw.offered().map(l => l.key), ['parade-now'], 'no tick needed');
  } finally {
    fw.off();
    __setBayNowForTests(null);
    runtime.player.x = saved.x; runtime.player.z = saved.z;
  }
  const { holdJetsForParade } = D;
  const day = bay('2026-10-09T11:42'), other = bay('2026-10-10T11:42');
  assert.equal(holdJetsForParade(day, { ready: false, failed: false }), true, 'the parade day, the chunk still loading: the jets wait');
  assert.equal(holdJetsForParade(day, { ready: true, failed: false }), false);
  assert.equal(holdJetsForParade(day, { ready: false, failed: true }), false, 'a chunk that failed for good never mutes the jets');
  assert.equal(holdJetsForParade(other, { ready: false, failed: false }), false);
  const index = fs.readFileSync(path.resolve('src/opus-bay/realsf/index.ts'), 'utf8');
  assert.match(index, /holdJetsForParade\(/);
});

test('W8-S review S-P6 / S-code-3 / 4: the morning prompt opens the 今天 tab (the parade’s row with its 11:00–12:00), one Chinese name everywhere', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { lastJournalRequest } = await import('../src/opus-bay/ui/slots');
  const saved = { x: runtime.player.x, z: runtime.player.z };
  __setBayNowForTests('2026-10-09T09:00');
  const fw = F.initFleetWeek();
  try {
    const pr = fw.prompt();
    assert.ok(pr, 'the morning prompt');
    assert.equal(pr!.verb.zh, '看看舰船巡游');
    const seq = lastJournalRequest().seq;
    pr!.act();
    assert.equal(lastJournalRequest().seq, seq + 1);
    assert.equal(lastJournalRequest().tab, 'today', 'the 今天 tab, where the parade row says 11:00–12:00');
  } finally {
    fw.off();
    __setBayNowForTests(null);
    runtime.player.x = saved.x; runtime.player.z = saved.z;
  }
  const cal = await import('../src/opus-bay/realsf/calendar');
  const row = cal.CALENDAR.find(r => r.id === 'fleet-week-parade-of-ships-2026')!;
  assert.match(row.title.zh, /舰船巡游/);
  assert.match(row.note.zh, /11:00–12:00/);
  for (const t of [row.title.zh, F.PARADE_WATCH.name.zh, F.PARADE_SOON.name.zh, F.PARADE_FOLLOW.name.zh, EVENT_SAY[F.PARADE_SOUVENIR].zh]) assert.doesNotMatch(t, /游行/, t);
});
