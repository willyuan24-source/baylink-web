import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 6 · lane H (W6-H3): Día de los Muertos in the Mission — the spots on the published city, the sources, the
// geometry's cost, the finds on lane E's real ledger.

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const fs = await import('node:fs');
const { onEvent } = await import('../src/opus-bay/core/events');
type GameEvent = import('../src/opus-bay/core/events').GameEvent;
const { runtime } = await import('../src/opus-bay/core/runtime');
const { clearSave } = await import('../src/opus-bay/data/save');
const ledger = await import('../src/opus-bay/economy/ledger');
const { HALLOWEEN_REWARD_IDS, registerHalloweenRewards } = await import('../src/opus-bay/halloween/rewards');
const MS = await import('../src/opus-bay/halloween/muertosSpots');
const MU = await import('../src/opus-bay/halloween/muertos');

test('W6-H3 muertos: the sources are on the placement script (SFMTA route + time, the 2025 Festival of Altars), the spots are numbered, every id is a reward id', () => {
  const script = fs.readFileSync(new URL('../scripts/opus-sf/muertos-place.mts', import.meta.url), 'utf8');
  for (const url of ['https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025', 'https://missionlocal.org/2025/10/celebrate-day-of-the-dead-sf/', 'https://eltecolote.org/content/en/dia-de-los-muertos-sf-events-2/']) assert.ok(script.includes(url), url);
  assert.match(script, /checked on the web 2026-09-29/);
  assert.deepEqual(MS.MUERTOS_SPOTS.map(s => s.n), MS.MUERTOS_SPOTS.map((_, i) => i + 1));
  assert.ok(MS.MUERTOS_SPOTS.length >= 6 && MS.MUERTOS_SPOTS.length <= 11);
  for (const s of MS.MUERTOS_SPOTS) {
    assert.ok(HALLOWEEN_REWARD_IDS.includes(`muertos:${s.n}`), `muertos:${s.n}`);
    assert.ok(MU.MUERTOS_PLACE[s.where], s.where);
  }
  assert.ok(HALLOWEEN_REWARD_IDS.includes(MU.MUERTOS_ALL.id));
  assert.equal(MS.MUERTOS_SPOTS.filter(s => s.where === 'potrero-del-sol').length, 6, 'the Festival of Altars');
  assert.equal(MS.MUERTOS_SPOTS.filter(s => s.kind === 'arch').length, 1, 'the procession gathers at 22nd & Bryant');
  assert.ok(MS.PICADO.length >= 8, 'papel picado over the route');
});

test('W6-H3 muertos on the published city: altars and marigolds stand off the roadway on walkable ground; the papel picado strings span the street (≤ 16 u)', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, MU.MUERTOS_AT.x, MU.MUERTOS_AT.z, 130, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    for (const s of MS.MUERTOS_SPOTS) {
      assert.ok(canStand(s.x, s.z, 0.8) && surfaceAt(s.x, s.z) !== 'road' && !isWater(s.x, s.z), `${s.n} ${s.where}`);
      assert.ok(Math.hypot(s.x - MU.MUERTOS_AT.x, s.z - MU.MUERTOS_AT.z) < MU.MUERTOS_NEAR - 60, `${s.n} inside the build radius`);
    }
    for (const m of MS.MARIGOLDS) assert.ok(surfaceAt(m[0], m[1]) !== 'road', `marigold ${m[0]},${m[1]}`);
    for (const p of MS.PICADO) {
      const len = Math.hypot(p[2] - p[0], p[3] - p[1]);
      assert.ok(len > 2 && len <= 16, `string ${len.toFixed(1)} u`);
    }
  } finally { setCityTerrain(null); }
});

test('W6-H3 muertos geometry: one mesh ≤ 12k triangles, a halo per candle', () => {
  const halos: import('../src/opus-bay/halloween/worldHalos').HaloSpot[] = [];
  const geo = MU.buildMuertos(halos);
  const tris = (geo.index?.count ?? 0) / 3;
  assert.ok(tris > 1000 && tris <= 12_000, `${tris} triangles`);
  assert.ok(halos.length >= MS.MUERTOS_SPOTS.length * 2);
  geo.dispose();
});

test('W6-H3 muertos finds on lane E\'s real ledger: each spot pays once, all of them pay muertos:12 once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: GameEvent[] = [];
  const offEv = onEvent(e => { if (e.type === 'reward') events.push(e); });
  const offs = [ledger.initLedger(), registerHalloweenRewards()];
  clearSave();
  MU.__resetMuertosForTests();
  runtime.move.mode = 'foot';
  try {
    assert.equal(MU.visitMuertos(1), true);
    assert.equal(MU.visitMuertos(1), false);
    assert.ok(ledger.isPaid('halloween:muertos:1'));
    for (const s of MS.MUERTOS_SPOTS) MU.visitMuertos(s.n);
    assert.equal(MU.muertosCount(), MS.MUERTOS_SPOTS.length);
    assert.ok(ledger.isPaid('halloween:muertos:12'));
    assert.equal(events.filter(e => e.type === 'reward' && e.source === 'halloween:muertos:12').length, 1);
  } finally {
    offEv(); for (const o of offs) o();
    clearSave(); MU.__resetMuertosForTests();
  }
});
