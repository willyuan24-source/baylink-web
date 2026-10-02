/**
 * W9-C2 · w8 H-RP-5 (docs/opus-bay/sf-w9-C.md part a): during the Chinatown Halloween Festival (31 Oct 2026, 11:00–15:00)
 * a toy car drove into Waverly Place, stopped short of the costume line-up and stood among the lanterns (W8-Z's festival
 * view). Now the kit closes the alley to the toy traffic while it is up (world/sf/roadClosures.ts): no car spawns on or
 * turns into it, a car already in it leaves, and the cross streets stay open. Played on the published city round the alley.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { canStand, cityChunkEpoch, heightAt, setCityTerrain, surfaceAt } from '../src/opus-bay/core/terrain';
import { createFestival, inAlley, alleyAt, alleyLength, WAVERLY } from '../src/opus-bay/halloween/worldFestival';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import { closeRoad, roadClosed } from '../src/opus-bay/world/sf/roadClosures';
import { type StreetProbe, StreetNet } from '../src/opus-bay/world/sf/streetNet';
import { TrafficSim } from '../src/opus-bay/world/sf/traffic';
import { sfDisk } from './opus-bay-sf-disk';

/** 31 Oct 2026 at hh:mm Bay time (PDT, UTC−7) */
const bay = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 31, hh + 7, mm));

test('W9-C2: the alley test — Waverly Place between its two ends is closed; the cross streets\' junctions and 3 u off the centreline are not', () => {
  const mid = alleyAt(alleyLength() / 2);
  assert.ok(inAlley(mid.x, mid.z), 'the middle of the alley');
  assert.ok(inAlley(alleyAt(4).x, alleyAt(4).z) && inAlley(alleyAt(alleyLength() - 4).x, alleyAt(alleyLength() - 4).z), 'near both ends');
  for (const end of [WAVERLY[0], WAVERLY[WAVERLY.length - 1]]) assert.equal(inAlley(end.x, end.z), false, `the junction at (${end.x}, ${end.z}) stays open`);
  const side = alleyAt(alleyLength() / 2, 3);
  assert.equal(inAlley(side.x, side.z), false, '3 u to the side (the next street / a building)');
});

test('W9-C2: the festival kit closes the alley while it is up and reopens it when it comes down (15:00; the player walks away)', () => {
  const fest = createFestival(() => 0);
  const mid = alleyAt(alleyLength() / 2);
  try {
    fest.step(mid.x, mid.z, true, bay(10, 59));
    assert.equal(roadClosed(mid.x, mid.z), false, 'before 11:00: open');
    fest.step(mid.x, mid.z, true, bay(12));
    assert.equal(fest.stats().shown, true);
    assert.equal(roadClosed(mid.x, mid.z), true, 'the kit is up: closed');
    fest.step(mid.x, mid.z, true, bay(12, 30));
    assert.equal(roadClosed(mid.x, mid.z), true, 'still up (no rebuild, no second closure)');
    fest.step(mid.x + 400, mid.z, true, bay(12, 31));
    assert.equal(roadClosed(mid.x, mid.z), false, 'the player 400 u away: the kit comes down, the alley reopens');
    fest.step(mid.x, mid.z, true, bay(13));
    assert.equal(roadClosed(mid.x, mid.z), true);
    fest.step(mid.x, mid.z, true, bay(15));
    assert.equal(roadClosed(mid.x, mid.z), false, '15:00: the festival is over');
  } finally { fest.dispose(); }
  assert.equal(roadClosed(mid.x, mid.z), false, 'disposed: open');
});

const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
const probe: StreetProbe = { surface: surfaceAt, stand: canStand, height: heightAt, epoch: (x, z) => cityChunkEpoch(Math.floor(x / 128), Math.floor(z / 128)) };
const MID = alleyAt(alleyLength() / 2);

async function withCity<T>(fn: (net: StreetNet) => T | Promise<T>): Promise<T> {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, MID.x, MID.z, 260, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try { return await fn(new StreetNet(await sf.graphIndex(), probe)); } finally { setCityTerrain(null); }
}

/** the street edges whose middle lies within 9 u of the alley's middle line (the alley's own and the cross streets') */
function edgesNear(net: StreetNet): number[] {
  const out = new Set<number>();
  for (let s = 0; s <= alleyLength(); s += 2) {
    const p = alleyAt(s);
    const n = net.ix.nearestNode(p.x, p.z, 12, () => true);
    if (n < 0) continue;
    for (let e = net.outStart(n); e < net.outEnd(n); e++) out.add(e);
  }
  return [...out];
}

test('W9-C2: on the published city the closure takes the alley\'s street edges off the toy traffic (spawns, turns), keeps the cross streets, and 60 s of traffic never drive along it', async () => {
  await withCity(net => {
    const sim = new TrafficSim(net, { focus: () => MID, visible: () => false, vehicles: () => [], people: () => {} }, { seed: 11 });
    const near = edgesNear(net).filter(e => sim.usable(e));
    const mid = (e: number) => { const s = net.edge(e)!; return { x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2 }; };
    const alley = near.filter(e => { const m = mid(e); return inAlley(m.x, m.z); });
    const cross = near.filter(e => !alley.includes(e));
    assert.ok(alley.length >= 2, `the alley carries toy traffic without the festival (${alley.length} drivable edges)`);
    assert.ok(cross.length >= 2, `cross streets round it (${cross.length})`);
    const reopen = closeRoad(inAlley);
    try {
      assert.deepEqual(alley.filter(e => sim.usable(e)), [], 'closed: no alley edge is drivable');
      assert.deepEqual(cross.filter(e => !sim.usable(e)), [], 'the cross streets stay drivable');
      let inside = 0, steps = 0;
      for (let i = 0; i < 30 * 60; i++) {
        sim.step(1 / 30);
        steps++;
        // (on an alley street, or turning into one; a car crossing the alley on a cross street is not in it)
        for (const c of sim.cars) if (c.on && !c.leaving && alley.includes(c.mode === 'turn' ? c.next : c.e)) inside++;
      }
      assert.equal(inside, 0, `car-frames in the alley over ${steps} steps`);
      // a car standing in the alley when it closes (placed there by hand: the kit went up round it) leaves it
      const c = sim.cars.find(k => !k.on) ?? sim.cars[sim.cars.length - 1];
      const e = alley[0], s = net.edge(e)!;
      Object.assign(c, { on: true, mode: 'lane', e, s: s.len / 2, v: 0, x: mid(e).x, z: mid(e).z, next: -1, node: -1, leaving: false, grow: 1, hop: 0, gave: '' });
      sim.step(1 / 30);
      // (out of sight it is recycled at once — and may be spawned again elsewhere in the same step, never in the alley)
      assert.ok(!c.on || c.leaving || !alley.includes(c.e), 'a car in the alley gives way (out of sight: gone at once)');
    } finally { reopen(); }
    assert.ok(alley.every(e => sim.usable(e)), 'reopened: drivable again');
  });
});
