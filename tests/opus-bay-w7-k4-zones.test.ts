import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W7-K4 · the area pill (docs/opus-bay/sf-w7-K.md part b): Jefferson St on the loop bus said 北滩 (BAYBAY greeted 你好，
 * 北滩！) — Fisherman's Wharf is its own area now; Washington Square said 唐人街 — the provider answers from the 16 u
 * far.zoneGrid, whose border cell there is Chinatown's, though the square lies inside North Beach's polygon: a point
 * outside its answer's polygon takes the neighbouring cell's zone that holds it.
 */

const { createCityTerrain } = await import('../src/opus-bay/core/sfTerrain');
const T = await import('../src/opus-bay/core/terrain');
const { project } = await import('../src/opus-bay/core/geo');
const { sfDisk } = await import('./opus-bay-sf-disk');
const Z = await import('../src/opus-bay/data/cityZones');

const sf = sfDisk();
const far = await sf.far();
const at = (lat: number, lng: number) => project(lat, lng);

test('W7-K4: Jefferson St and the Wharf read 渔人码头; Washington Square reads 北滩; Chinatown, Russian Hill and the hero waterfront keep their names', async () => {
  const city = createCityTerrain(sf.manifest, {});
  city.setFar(far);
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const area = (lat: number, lng: number) => { const p = at(lat, lng); return Z.cityAreaAt(p.x, p.z)?.id ?? null; };
    // the loop bus's Wharf stretch (Jefferson St from Hyde to Powell) and the Wharf's piers
    for (const [name, lat, lng] of [['Jefferson & Hyde', 37.8080, -122.4201], ['Jefferson & Taylor', 37.8082, -122.4155], ['Jefferson & Mason', 37.8078, -122.4140], ['Pier 45', 37.8100, -122.4175], ['Beach & Taylor', 37.8070, -122.4160]] as const) {
      assert.equal(area(lat, lng), 'fishermans-wharf', name);
    }
    const p = at(37.8082, -122.4155);
    assert.deepEqual(Z.cityAreaAt(p.x, p.z)?.name, { zh: '渔人码头', en: "Fisherman's Wharf" });
    assert.deepEqual(Z.zoneName('fishermans-wharf'), { zh: '渔人码头', en: "Fisherman's Wharf" });
    // Washington Square and Columbus at Union / Filbert: North Beach (the grid said Chinatown)
    for (const [name, lat, lng] of [['Washington Square', 37.8008, -122.4101], ['Columbus & Union', 37.8003, -122.4097], ['Columbus & Filbert', 37.8015, -122.4110]] as const) {
      assert.equal(area(lat, lng), 'north-beach', name);
    }
    // unchanged: the Dragon Gate's landmark area, Portsmouth Square, Russian Hill above the Wharf, Ghirardelli (west of Hyde)
    assert.equal(area(37.7907, -122.4058), 'chinatown', 'the Dragon Gate');
    assert.equal(area(37.7948, -122.4056), 'chinatown', 'Portsmouth Square');
    assert.equal(area(37.8011, -122.4195), 'russian-hill', 'Hyde & Lombard');
    assert.equal(area(37.8058, -122.4229), 'russian-hill', 'Ghirardelli Square');
    // the hero waterfront keeps its own names (checked before the Wharf): Pier 39 inside its hero zone
    const zones = (await import('../src/opus-bay/data/district')).DISTRICT.zones;
    const pier39 = zones.find(z => z.id === 'pier39')!;
    const c = pier39.polygon.reduce((s, q) => ({ x: s.x + q.x / pier39.polygon.length, z: s.z + q.z / pier39.polygon.length }), { x: 0, z: 0 });
    assert.equal(Z.cityAreaAt(c.x, c.z)?.id, 'pier39', 'Pier 39 stays 39 号码头');
  } finally { T.setCityTerrain(null); }
});

test('W7-K4: across the city, the area pill never names a neighbourhood whose polygon misses the point when a neighbouring cell\'s polygon holds it', async () => {
  const city = createCityTerrain(sf.manifest, {});
  city.setFar(far);
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const inRing = (xz: ArrayLike<number>, x: number, z: number) => { let c = false; const n = xz.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = xz[i * 2], zi = xz[i * 2 + 1], xj = xz[j * 2], zj = xz[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    const holds = (id: string, x: number, z: number) => { const zn = far.zones.find(q => q.id === id); return !!zn && zn.rings.some(r => !r.hole && inRing(r.xz, x, z)); };
    let wrong = 0, checked = 0;
    const g = far.zoneGrid;
    for (let j = 0; j < g.rows; j += 3) for (let i = 0; i < g.cols; i += 3) {
      // a point inside the cell, off its centre (borders cut through cells)
      const x = g.originX + (i + 0.3) * g.step, z = g.originZ + (j + 0.7) * g.step;
      // (a landmark area answers by design inside its radius: the Dragon Gate says 唐人街 in the Financial District's cells)
      if (Z.landmarkAreaAt(x, z)) continue;
      const a = Z.cityAreaAt(x, z);
      if (!a || !far.zones.some(q => q.id === a.id)) continue;
      checked++;
      if (holds(a.id, x, z)) continue;
      // wrong only if a neighbour's polygon does hold it (the grid's answer stands where none does: water, slivers)
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const o = T.zoneAt(x + dx * g.step, z + dz * g.step);
        if (o && o.id !== a.id && far.zones.some(q => q.id === o.id) && holds(o.id, x, z)) { wrong++; dz = dx = 2; }
      }
    }
    assert.ok(checked > 500, `${checked} points checked`);
    assert.equal(wrong, 0, `${wrong} of ${checked} points named for the neighbouring cell's zone`);
  } finally { T.setCityTerrain(null); }
});
