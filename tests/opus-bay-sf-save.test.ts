import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_DISCOVERED, MAX_ZONES, SAVE_BOUNDS, SAVE_ID, SAVE_MAX_BYTES, decodeSave, encodeSave, noteRide, readSave, resetSaveCache, patchSave, requestResume, takeResumeRequest } from '../src/opus-bay/data/save';

/** Lane G1 (G1-3): save v2 is untrusted input — a fuzz corpus never throws and never yields an invalid save. */

type Save = NonNullable<ReturnType<typeof decodeSave>>;

function assertValid(s: Save) {
  assert.equal(s.version, 2);
  const inBox = (x: number, z: number) => Number.isFinite(x) && Number.isFinite(z) && x >= SAVE_BOUNDS.minX && x <= SAVE_BOUNDS.maxX && z >= SAVE_BOUNDS.minZ && z <= SAVE_BOUNDS.maxZ;
  if (s.lastSafe) {
    assert.ok(inBox(s.lastSafe.x, s.lastSafe.z));
    assert.ok(s.lastSafe.world === 'city' || s.lastSafe.world === 'district');
    assert.ok(Math.abs(s.lastSafe.heading) <= Math.PI + 1e-9);
  }
  for (const id of s.discovered ?? []) assert.match(id, SAVE_ID);
  for (const id of s.zones ?? []) assert.match(id, SAVE_ID);
  assert.ok((s.discovered?.length ?? 0) <= MAX_DISCOVERED && (s.zones?.length ?? 0) <= MAX_ZONES);
  for (const [k, v] of Object.entries(s.rides ?? {})) { assert.match(k, SAVE_ID); assert.ok(Number.isInteger(v) && v >= 0); }
  if (s.vehicles?.bike) { assert.match(s.vehicles.bike.id, SAVE_ID); assert.ok(inBox(s.vehicles.bike.x, s.vehicles.bike.z)); }
  if (s.vehicles?.car) assert.ok(inBox(s.vehicles.car.x, s.vehicles.car.z));
  assert.ok(encodeSave(s).length <= SAVE_MAX_BYTES);
}

const good = {
  version: 2, lastSafe: { world: 'city', x: 120.5, z: 640, heading: 7, zone: 'mission' }, discovered: ['city-hall', 'coit-tower', 'city-hall'],
  zones: ['mission', 'chinatown'], rides: { 'powell-hyde': 2, 'bad id!': 3, ferry: -1 }, vehicles: { bike: { id: 'bike-3', x: 1, z: 2, heading: 0 }, car: { x: 'x', z: 1 } },
  unlocked: { glide: true },
};

test('decode: a good save survives, bad rows are dropped, headings wrap, duplicates collapse', () => {
  const s = decodeSave(JSON.stringify(good))!;
  assertValid(s);
  assert.deepEqual(s.discovered, ['city-hall', 'coit-tower']);
  assert.deepEqual(s.rides, { 'powell-hyde': 2 });
  assert.equal(s.vehicles?.bike?.id, 'bike-3');
  assert.equal(s.vehicles?.car, undefined);
  assert.ok(Math.abs(s.lastSafe!.heading - (7 - 2 * Math.PI)) < 1e-9);
  assert.equal(s.unlocked?.glide, true);
  assert.deepEqual(decodeSave(encodeSave(s)), s, 'round trip');
});

test('decode: wrong version, junk text, oversize text and far-away positions', () => {
  for (const raw of ['', 'null', '[]', '{"version":1}', '{"version":"2"}', '{', 'x'.repeat(SAVE_MAX_BYTES + 1), 42, null, undefined]) assert.equal(decodeSave(raw), null, String(raw).slice(0, 20));
  const clamp = decodeSave({ version: 2, lastSafe: { world: 'city', x: SAVE_BOUNDS.maxX + 30, z: SAVE_BOUNDS.minZ - 10, heading: 0 } })!;
  assert.deepEqual([clamp.lastSafe!.x, clamp.lastSafe!.z], [SAVE_BOUNDS.maxX, SAVE_BOUNDS.minZ], 'a little outside: clamped');
  assert.equal(decodeSave({ version: 2, lastSafe: { world: 'city', x: 9e9, z: 0, heading: 0 } })!.lastSafe, undefined, 'far outside: dropped');
  assert.equal(decodeSave({ version: 2, lastSafe: { world: 'moon', x: 0, z: 0, heading: 0 } })!.lastSafe, undefined);
  const many = decodeSave({ version: 2, discovered: Array.from({ length: 5000 }, (_, i) => `p-${i}`), zones: Array.from({ length: 200 }, (_, i) => `z-${i}`) })!;
  assert.equal(many.discovered!.length, MAX_DISCOVERED);
  assert.equal(many.zones!.length, MAX_ZONES);
});

test('decode fuzz: 3,000 mutated saves never throw and never come out invalid', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const junk = (): unknown => {
    const r = rnd();
    if (r < 0.1) return null;
    if (r < 0.2) return rnd() * 1e12 - 5e11;
    if (r < 0.3) return [NaN, Infinity, -Infinity, -0][Math.floor(rnd() * 4)];
    if (r < 0.4) return 'x'.repeat(Math.floor(rnd() * 120)) + (rnd() < 0.5 ? '!' : '');
    if (r < 0.5) return [junk(), junk()];
    if (r < 0.6) return { x: junk(), z: junk(), heading: junk(), id: junk(), world: rnd() < 0.5 ? 'city' : junk() };
    if (r < 0.7) return true;
    if (r < 0.8) return { __proto__: { version: 2 }, constructor: 1 };
    return `id-${Math.floor(rnd() * 99)}`;
  };
  const keys = ['version', 'lastSafe', 'discovered', 'zones', 'rides', 'vehicles', 'unlocked', 'savedAt'] as const;
  for (let i = 0; i < 3000; i++) {
    const s: Record<string, unknown> = JSON.parse(JSON.stringify(good));
    for (let m = 0; m < 1 + Math.floor(rnd() * 4); m++) {
      const k = keys[Math.floor(rnd() * keys.length)];
      if (k === 'version' && rnd() < 0.7) continue;
      if (rnd() < 0.5 && s[k] && typeof s[k] === 'object') { const o = s[k] as Record<string, unknown>; const ks = Object.keys(o); if (ks.length) o[ks[Math.floor(rnd() * ks.length)]] = junk(); }
      else s[k] = junk();
    }
    let out: ReturnType<typeof decodeSave> = null;
    assert.doesNotThrow(() => { out = decodeSave(rnd() < 0.5 ? JSON.stringify(s) : s); });
    if (out) assertValid(out);
  }
});

test('noteRide / patchSave / resume request (in memory without a window)', () => {
  resetSaveCache();
  assert.equal(readSave(), null);
  noteRide('powell-hyde'); noteRide('powell-hyde'); noteRide('Bad Id');
  assert.deepEqual(readSave()?.rides, { 'powell-hyde': 2 });
  patchSave(s => { s.lastSafe = { world: 'city', x: 1, z: 2, heading: 0 }; });
  assert.equal(readSave()?.lastSafe?.x, 1);
  assert.equal(takeResumeRequest(), false);
  requestResume();
  assert.equal(takeResumeRequest(), true);
  assert.equal(takeResumeRequest(), false, 'once');
  resetSaveCache();
});
