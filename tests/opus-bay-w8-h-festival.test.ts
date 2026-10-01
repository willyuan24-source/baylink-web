import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 8 · lane H · the Chinatown Halloween Festival on Waverly Place (halloween/worldFestival.ts): Saturday 31 October
 * 2026, 11:00–15:00 Bay time (https://www.cycsf.org/chinatown-halloween-festival/, checked 2026-09-30; the same window
 * as lane S's calendar row). The kit — lanterns across the alley, craft tables, a pumpkin patch, a little stage and the
 * costume contest's line-up — is ONE merged mesh on TOY (+1 call) that exists only in that window near Waverly Place;
 * BAYBAY offers her two new lines there (halloween/world.ts).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const F = await import('../src/opus-bay/halloween/worldFestival');
const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
const { CALENDAR, WAVERLY_PLACE } = await import('../src/opus-bay/realsf/calendar');
const { TOY } = await import('../src/opus-bay/world/materials');

const at = (s: string) => parseBayDate(s)!;

test('W8-H festival: on exactly 31 Oct 2026 11:00 ≤ t < 15:00 Bay time — the calendar row\'s day and hours', () => {
  assert.equal(F.festivalOn(at('2026-10-31T10:59')), false);
  assert.equal(F.festivalOn(at('2026-10-31T11:00')), true);
  assert.equal(F.festivalOn(at('2026-10-31T14:59')), true);
  assert.equal(F.festivalOn(at('2026-10-31T15:00')), false);
  assert.equal(F.festivalOn(at('2026-10-30T12:00')), false);
  assert.equal(F.festivalOn(at('2027-10-31T12:00')), false, 'this year\'s festival only');
  const row = CALENDAR.find(r => r.id === F.FESTIVAL.id);
  assert.ok(row, 'lane S\'s calendar row');
  assert.equal(row!.from, F.FESTIVAL.date);
  assert.equal(row!.lineAt?.from, F.FESTIVAL.from);
  assert.equal(row!.lineAt?.to, F.FESTIVAL.to);
  // the alley is where the calendar puts the festival
  const mid = F.alleyAt(F.alleyLength() / 2);
  assert.ok(Math.hypot(mid.x - WAVERLY_PLACE.x, mid.z - WAVERLY_PLACE.z) < 15, 'Waverly Place');
});

test('W8-H festival: the kit along Waverly Place — lanterns, a stage, the line-up — inside a phone\'s budget, built only in its window and near', () => {
  const kit = F.buildFestival(() => 5);
  const tris = (kit.geo.index?.count ?? 0) / 3;
  assert.ok(tris > 2000 && tris <= F.FESTIVAL_TRIS_MAX, `${tris} triangles`);
  assert.ok(kit.lanterns >= 18, `${kit.lanterns} lanterns`);
  assert.ok(kit.kids >= 6);
  // everything sits along the alley (within its half width + a margin, below the lantern wires)
  const pos = kit.geo.getAttribute('position');
  const L = F.alleyLength();
  for (let i = 0; i < pos.count; i += 7) {
    const x = pos.getX(i), z = pos.getZ(i);
    let best = Infinity;
    for (let s = 0; s <= L; s += 0.25) { const p = F.alleyAt(s); best = Math.min(best, Math.hypot(p.x - x, p.z - z)); }
    assert.ok(best < 2.3, `a vertex ${best.toFixed(2)} u off the alley`);
    assert.ok(pos.getY(i) >= 4.9 && pos.getY(i) < 9, `y ${pos.getY(i)}`);
  }
  kit.geo.dispose();
  const fest = F.createFestival(() => 5);
  const mid = F.alleyAt(L / 2), stage = F.alleyAt(F.STAGE.s, F.STAGE.side);
  try {
    fest.step(mid.x, mid.z, true, at('2026-10-31T10:30'));
    assert.equal(fest.stats().shown, false, 'not before 11:00');
    fest.step(mid.x, mid.z, true, at('2026-10-31T12:00'));
    assert.equal(fest.stats().shown, true);
    const meshes = fest.group.children as import('three').Mesh[];
    assert.equal(meshes.length, 1, 'one mesh: +1 call');
    assert.equal(meshes[0].material, TOY, 'the city\'s static toy program');
    assert.equal(fest.near(stage.x, stage.z), 'contest');
    const south = F.alleyAt(3);
    assert.equal(fest.near(south.x, south.z), 'lanterns');
    assert.equal(fest.near(mid.x + 200, mid.z), null);
    fest.step(mid.x + F.FEST_NEAR + 10, mid.z, true, at('2026-10-31T12:00'));
    assert.equal(fest.stats().shown, false, 'dropped far away');
    fest.step(mid.x, mid.z, true, at('2026-10-31T12:00'));
    fest.step(mid.x, mid.z, false, at('2026-10-31T12:00'));
    assert.equal(fest.stats().shown, false, 'dropped when the season is off');
    fest.step(mid.x, mid.z, true, at('2026-10-31T15:00'));
    assert.equal(fest.stats().shown, false, 'gone at 15:00');
    assert.equal(fest.near(stage.x, stage.z), null);
  } finally { fest.dispose(); }
});

test('W8-H festival: wired into the Halloween world (its group, its step, BAYBAY\'s two lines, its teardown)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/opus-bay/halloween/world.ts', import.meta.url), 'utf8');
  assert.match(src, /group\.add\([^)]*festival\.group/);
  assert.match(src, /festival\.step\(p\.x, p\.z, !!offSystem && phase !== 'off', now\)/);
  assert.match(src, /offer\('chinatown-contest', 'chinatownContest'\)/);
  assert.match(src, /offer\('chinatown-lanterns', 'chinatownLanterns'\)/);
  assert.match(src, /festival\.dispose\(\)/);
});
