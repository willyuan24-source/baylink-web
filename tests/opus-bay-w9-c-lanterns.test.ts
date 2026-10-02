/**
 * W9-C6 · Chinatown's night lanterns glow (review 2026-10-01 R§6 世界、镜头与美术: 「唐人街夜里…灯笼几乎不发光，没有霓虹」;
 * explorer 70-ct-night / 71-ct-night-low): every paper lantern on the strings across Grant Ave, the dragon lamps and three
 * neon glows by the blade signs ask the night light field for a near glow (world/sf/lights.ts HALO_GLOW) — the field's
 * one Points draw: no new call, no triangle.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const Li = await import('../src/opus-bay/world/sf/lights');
const { dragonGate } = await import('../src/opus-bay/world/sf/landmarks/dragon-gate');

test('W9-C6: a site light with `halo` becomes a near glow (aLevel HALO_GLOW + diameter / HALO_MAX_D); without it, as before', () => {
  const [glow, plain] = Li.siteLightSpecs([
    { x: 1, y: 2, z: 3, size: 0.5, color: '#ff5a3a', halo: 1.2 },
    { x: 1, y: 2, z: 3, size: 0.55, color: '#ff8a5c' },
  ]);
  assert.ok(glow.level >= Li.HALO_GLOW && glow.level < Li.HALO_GLOW + 1, `glow level ${glow.level}`);
  assert.ok(Math.abs((glow.level - Li.HALO_GLOW) * Li.HALO_MAX_D - 1.2) < 1e-9, 'the diameter rides in the fraction');
  assert.equal(plain.level, 0.55, 'a plain site light keeps its level');
  // the shader handles the band before the crown drift's (HALO_GLOW 6 > CROWN_DRIFT 5): a world-sized point, its own falloff
  const vert = String(Li.LIGHT_FIELD.vertexShader), frag = String(Li.LIGHT_FIELD.fragmentShader);
  assert.ok(Li.HALO_GLOW > Li.CROWN_DRIFT);
  assert.ok(vert.indexOf(`aLevel >= ${Li.HALO_GLOW.toFixed(1)}`) >= 0 && vert.indexOf(`aLevel >= ${Li.HALO_GLOW.toFixed(1)}`) < vert.indexOf(`aLevel >= ${Li.CROWN_DRIFT.toFixed(1)}`), 'the glow band is tested first');
  assert.match(vert, /star > 1\.5\s*\?\s*clamp\(size \* uPx \/ d/);
  assert.match(frag, /vStar > 1\.5/);
});

test('W9-C6: the Dragon Gate site lights carry a glow for each of the 32 lanterns (3 gate strings + 5 Grant Ave strings, 4 each), the 4 dragon lamps and 3 neon signs', () => {
  const lights = dragonGate.lights ?? [];
  const halos = lights.filter(l => l.halo);
  const lantern = halos.filter(l => l.color === '#ff5a3a');
  assert.equal(lantern.length, 32);
  assert.equal(halos.filter(l => l.color === '#ffb066').length, 4, 'dragon lamps');
  const neon = halos.filter(l => l.color === '#ff4fa3' || l.color === '#36e2cf');
  assert.equal(neon.length, 3);
  for (const l of halos) assert.ok(l.halo! > 0.5 && l.halo! < Li.HALO_MAX_D, `halo ${l.halo}`);
  // the lanterns hang under their wires: 2.6–3.6 u over the street (local heights over the gate's base, the corner's ground)
  const strings = lights.filter(l => !l.halo && l.color === '#ff8a5c');
  assert.equal(strings.length, 8, 'the far-field points per string stay');
  // every lantern glow sits within ≈ 2 u (across the street) of its string's far point
  for (const l of lantern) assert.ok(strings.some(s => Math.hypot(s.x - l.x, s.z - l.z) < 2 && Math.abs(s.y - l.y) < 0.6), `a lantern glow at (${l.x.toFixed(1)}, ${l.y.toFixed(1)}, ${l.z.toFixed(1)}) by a string`);
});
