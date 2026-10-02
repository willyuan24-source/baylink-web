/**
 * Wave 7 · lane X (visuals): the downtown / Chinatown street façades (W7-X1), the city's day sky and toy cloud puffs,
 * the city gull, the crowd's near figure per quality. The district keeps every look (its recipe, its sky, its gull).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const input = (o: Partial<import('../src/opus-bay/world/sf/look').LookInput>): import('../src/opus-bay/world/sf/look').LookInput => ({
  style: 'office', roof: 'flat', pal: { wall: '#cdd5dc', trim: '#fbf6ec', roof: '#bdb7ad' }, seed: 1, area: 30, H: 8, zone: 'financial-district-south-beach', flags: 0, ...o,
});

test('W7-X1 · façades: Chinatown walk-ups get balconies, the old downtown core its pre-war fronts, the rest keeps its look', async () => {
  const { facadeFor, sfLook, PREWAR_WALLS, CHINATOWN_FACADE_WALLS, CHINATOWN_MAX_H, PREWAR_ZONES, lightness } = await import('../src/opus-bay/world/sf/look');
  // the façade walls stay as light as the city's house walls (tests/opus-bay-sf-look: HSL L ≥ 0.78)
  for (const w of [...PREWAR_WALLS, ...CHINATOWN_FACADE_WALLS]) assert.ok(lightness(w) >= 0.78, `${w} L ${lightness(w).toFixed(3)}`);
  // Chinatown: every walk-up / small office / brick below the cap, whatever its seed; a tall one keeps its style
  for (let seed = 1; seed < 200; seed++) {
    for (const style of ['office', 'residential', 'brick', 'chinatown', 'deco'] as const) assert.equal(facadeFor(input({ style, seed, zone: 'chinatown', H: 6 })), 'chinatown');
  }
  assert.equal(facadeFor(input({ zone: 'chinatown', H: CHINATOWN_MAX_H + 1 })), null);
  // Victorians, civic halls, piers and sheds never change; outside the zones nothing changes
  for (const style of ['victorian', 'civic', 'pier', 'industrial', 'sunset', 'marina'] as const) {
    assert.equal(facadeFor(input({ style, zone: 'chinatown' })), null, style);
    assert.equal(facadeFor(input({ style, zone: 'financial-district-south-beach' })), null, style);
  }
  for (const zone of ['mission', 'sunset-parkside', 'marina', null]) assert.equal(facadeFor(input({ zone })), null, String(zone));
  // FiDi: most low offices are pre-war (≈ 90 %), fewer of the taller ones, none above maxH; brick stays SoMa brick
  const share = (H: number) => { let n = 0; for (let seed = 1; seed <= 2000; seed++) if (facadeFor(input({ seed, H })) === 'prewar') n++; return n / 2000; };
  const z = PREWAR_ZONES['financial-district-south-beach'];
  assert.ok(Math.abs(share(8) - z.low) < 0.04, `low share ${share(8)}`);
  assert.ok(Math.abs(share(16) - z.high) < 0.04, `high share ${share(16)}`);
  assert.equal(share(z.maxH + 0.5), 0);
  assert.equal(facadeFor(input({ style: 'brick' })), null);
  // the look: façade walls from their own warm pools, deterministic per seed; no façade = exactly the old look
  for (let seed = 1; seed < 60; seed++) {
    const pre = sfLook(input({ seed, H: 8 }));
    if (pre.facade === 'prewar') assert.ok(PREWAR_WALLS.includes(pre.wall), pre.wall);
    const ct = sfLook(input({ seed, zone: 'chinatown', style: 'residential', H: 5 }));
    assert.equal(ct.facade, 'chinatown');
    assert.ok(CHINATOWN_FACADE_WALLS.includes(ct.wall));
    const plain = sfLook(input({ seed, zone: 'mission', style: 'residential', H: 5 }));
    assert.equal(plain.facade, undefined);
    assert.deepEqual(sfLook(input({ seed, H: 8 })), pre);
  }
});

test('W7-X1 · the recipe paints the façade through the TOY window style (never over a glass curtain wall); L0 and L1 agree', async () => {
  const { cityLook, CITY_FLAG, toyBuildingL0, toyBuildingL1 } = await import('../src/opus-bay/world/recipes/city');
  const { WIN } = await import('../src/opus-bay/world/recipes/shapes');
  const { CityBatch } = await import('../src/opus-bay/world/sf/mesh');
  const poly = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }, { x: 0, z: 4 }];
  const spec = (facade?: 'prewar' | 'chinatown', flags = 0, H = 9) => ({ poly, baseY: 0, H, style: 'office' as const, roof: 'flat' as const, palette: { wall: '#eee6d6', trim: '#f4efe4', roof: '#d6d2ca', ...(facade ? { facade } : {}) }, seed: 42, flags });
  assert.equal(cityLook(spec('prewar')).win, WIN.prewar);
  assert.equal(cityLook(spec('chinatown')).win, WIN.chinatown);
  assert.equal(cityLook(spec()).win, WIN.office);
  assert.equal(cityLook(spec('prewar', CITY_FLAG.glass)).win, WIN.glass);
  assert.equal(cityLook(spec('prewar', CITY_FLAG.glass)).facade, null);
  // the window style reaches the walls' aInfo.x on both tiers; the cornice / parapet stays within the L0 budget
  const styles = (f: (b: InstanceType<typeof CityBatch>) => void) => { const b = new CityBatch(4096); f(b); const a = b.toPool(); const s = new Set<number>(); if (a) for (let i = 0; i < a.vertexCount; i++) s.add(a.info[i * 4]); return { s, tris: a ? a.indexCount / 3 : 0 }; };
  for (const facade of ['prewar', 'chinatown'] as const) {
    const l0 = styles(b => toyBuildingL0(b, spec(facade)));
    const l1 = styles(b => toyBuildingL1(b, spec(facade)));
    assert.ok(l0.s.has(WIN[facade]) && l1.s.has(WIN[facade]), facade);
    const plain = styles(b => toyBuildingL0(b, spec()));
    assert.ok(l0.tris - plain.tris <= 40, `${facade} adds ${l0.tris - plain.tris} triangles`);
    assert.ok(l0.tris <= 600, `${facade} L0 ${l0.tris} ≤ 600`);
  }
});

test('W7-X1 · the TOY shader: the two façade styles are their own branch; the district\'s styles 1–8 are untouched', async () => {
  const { TOY_FRAG } = await import('../src/opus-bay/world/materials');
  assert.ok(TOY_FRAG.includes('obFac == 9.0 || obFac == 10.0'));
  // the generic window branch (styles 1–6) and the pier shed (8) keep their exact conditions
  assert.ok(TOY_FRAG.includes('if (vInfo.x > 0.5 && vInfo.x < 6.5 && abs(vWN.y) < 0.4) {'));
  assert.ok(TOY_FRAG.includes('if (floor(vInfo.x + 0.5) == 8.0 && abs(vWN.y) < 0.4) {'));
  const { WIN } = await import('../src/opus-bay/world/recipes/shapes');
  assert.deepEqual({ ...WIN }, { none: 0, res: 1, office: 2, shop: 3, brick: 4, victorian: 5, glass: 6, shed: 8, prewar: 9, chinatown: 10 });
});

test('W7-X1 · the city\'s day sky: a bluer zenith and cloud puffs by day and (less) in the morning, never at golden hour, at night or in the district', async () => {
  const { Environment, CITY_DAY_SKY } = await import('../src/opus-bay/world/environment');
  assert.deepEqual({ ...CITY_DAY_SKY }, { morning: 0.6, day: 1, golden: 0, night: 0 });
  const uni = (e: InstanceType<typeof Environment>) => (e as unknown as { skyMat: { uniforms: { uCityDay: { value: number } }; fragmentShader: string } }).skyMat;
  const district = new Environment('district');
  const city = new Environment('city');
  for (const tod of ['morning', 'day', 'golden', 'night'] as const) {
    district.setTime(tod, true);
    city.setTime(tod, true);
    assert.equal(uni(district).uniforms.uCityDay.value, 0, `district ${tod}`);
    assert.equal(uni(city).uniforms.uCityDay.value, CITY_DAY_SKY[tod], `city ${tod}`);
  }
  // a blend from night to day eases in (no pop) and ends at the day value
  city.setTime('night', true);
  city.setTime('day', false);
  const cam = new (await import('three')).PerspectiveCamera();
  const seen: number[] = [];
  for (let i = 0; i < 40; i++) { city.update(0.1, cam, cam.position); seen.push(uni(city).uniforms.uCityDay.value); }
  assert.ok(seen[0] > 0 && seen[0] < 1 && seen[seen.length - 1] === 1, seen.slice(0, 3).join(','));
  assert.ok(uni(city).fragmentShader.includes('obPuffs'));
  district.dispose(); city.dispose();
});

test('W7-X1 · the city gull: white body, grey bent wings with black tips, every wing part flaps; the district keeps its gull', async () => {
  // (W9-P) the city gull rides with the city chunk (world/sf/cityFigures.ts) since GameRoot's wave-9 move
  const { cityGullGeometry } = await import('../src/opus-bay/world/sf/cityFigures');
  const g = cityGullGeometry();
  const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  assert.ok(tris <= 260, `city gull ${tris} ≤ 260 triangles`);
  const col = g.getAttribute('color'), info = g.getAttribute('aInfo'), pos = g.getAttribute('position');
  let dark = 0, darkFlap = 0, white = 0, farTip = 0;
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    if (r < 0.05 && gg < 0.05 && b < 0.05) { dark++; if (info.getZ(i) === 1) darkFlap++; farTip = Math.max(farTip, Math.abs(pos.getX(i))); }
    if (r > 0.95 && gg > 0.95 && b > 0.95) white++;
  }
  assert.ok(dark > 0 && dark === darkFlap, 'black tips on the flapping wings only');
  assert.ok(farTip > 0.65, `the tips reach the wing ends (${farTip.toFixed(2)})`);
  assert.ok(white > dark, 'a white bird');
  // the wing tip sits behind the wrist (swept back) and below the raised arm: the bent-elbow silhouette
  let wristZ = -1, tipZ = 1;
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i)), z = pos.getZ(i);
    if (info.getZ(i) === 1 && x > 0.35 && x < 0.45) wristZ = Math.max(wristZ, z);
    if (info.getZ(i) === 1 && x > 0.68) tipZ = Math.min(tipZ, z);
  }
  assert.ok(tipZ < wristZ - 0.1, `swept back: tip z ${tipZ.toFixed(2)} behind wrist z ${wristZ.toFixed(2)}`);
});

test('W7-X1 · the crowd\'s near figure per quality: the phone (mid) switches to the far figure sooner and draws fewer', async () => {
  const { CROWD } = await import('../src/opus-bay/world/sf/crowd');
  assert.deepEqual(CROWD.nearBy.high, { lod: CROWD.nearLod, max: CROWD.nearMax });
  assert.ok(CROWD.nearBy.mid.lod < CROWD.nearBy.high.lod && CROWD.nearBy.mid.max < CROWD.nearBy.high.max);
  assert.ok(CROWD.nearBy.low.max <= CROWD.nearBy.mid.max);
  // the triangle cap on the phone: ≤ 8 near figures of ≤ 700 triangles
  assert.ok(CROWD.nearBy.mid.max * 700 <= 5600);
});
