import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Wave 9 · lane N · W9-N2b (w8 W8I-D-4, left open in wave 8; review R§5 #6 "one time source"): on Alcatraz the waypoint
 * chip offered a WALKING time to a city target ("科伊特塔 · 约 2 分钟" across the bay). With the water between the player
 * and the target and no trip planned, the chip now says the ferry comes first and gives no walking time.
 * Red before: no acrossWaterLabel; guideCity's cityWaypoint wrote fr.plainTime(target, d) on the island.
 */

const W = await import('../src/opus-bay/game/waypoint');
const { ALCA_X, ALCA_Z } = await import('../src/opus-bay/world/sf/landmarks/alcatrazGround');
const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/arrivals');

test('W9-N2b the waypoint across the water: the ferry first, no walking time', () => {
  const island = { x: ALCA_X + 2, z: ALCA_Z + 1 };
  const coit = { x: 41.9, z: 49.3 };
  const ferryBuilding = { x: 131.5, z: 15.1 };
  assert.deepEqual(W.acrossWaterLabel(island, coit), { zh: '先坐船回城', en: 'ferry back first' });
  assert.deepEqual(W.acrossWaterLabel(ferryBuilding, island), { zh: '要坐船上岛', en: 'by ferry' });
  assert.equal(W.acrossWaterLabel(ferryBuilding, coit), null, 'both in the city: the walking time as before');
  assert.equal(W.acrossWaterLabel(island, { x: ALCA_X - 10, z: ALCA_Z + 5 }), null, 'both on the island');
  const ggb = LANDMARK_ARRIVALS['golden-gate-bridge'];
  assert.equal(W.acrossWaterLabel({ x: ggb.x, z: ggb.z }, coit), null);
  // guideCity's waypoint asks it before the plain (walking) time, and only when no trip leg ends at the target
  const src = readFileSync(new URL('../src/opus-bay/game/guideCity.ts', import.meta.url), 'utf8');
  assert.match(src, /trip === null \? acrossWaterLabel\(p, target\) \?\? fr\.plainTime\(target, d\) : timeLabel\(trip\)/);
});
