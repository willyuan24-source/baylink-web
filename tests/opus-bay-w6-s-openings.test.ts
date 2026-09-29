import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 6 · lane S (W6-S3): the autumn release's new openings in the toy city (realsf/openings.ts, openingSigns.ts,
 * OpeningCard.tsx). A sign only for a San Francisco opening that is open and whose street address OpenStreetMap
 * confirms; the sign stands next to that point on the published city's walking network; its card links the BAYLINK page.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { OPENING_SIGNS, openingUrl, signById, SIGN_NEAR } = await import('../src/opus-bay/realsf/openings');
const { projectCity } = await import('../src/opus-bay/core/geo');

interface SiteOpening { id: string; region: string; city: string; status: string; address: string; verifiedAt: string; name: string }
const RELEASE = JSON.parse(fs.readFileSync(path.resolve('src/data/autumn-release-openings.json'), 'utf8')) as SiteOpening[];
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test('W6-S3 openings: a sign for every open San Francisco opening of the autumn release with an OSM-checked address; the rest skipped', () => {
  const sf = RELEASE.filter(o => o.region === 'sf');
  assert.equal(RELEASE.length, 31, 'the release file');
  assert.equal(sf.length, 4);
  const open = sf.filter(o => o.status === 'open' || o.status === 'soft_open');
  assert.deepEqual(OPENING_SIGNS.map(s => s.id).sort(), open.map(o => o.id).sort(), 'every open SF opening, and only those');
  assert.ok(sf.some(o => o.status === 'announced' && !signById(o.id)), 'an announced opening gets no sign');
  const ids = new Set<string>();
  for (const s of OPENING_SIGNS) {
    assert.ok(!ids.has(s.id)); ids.add(s.id);
    const site = RELEASE.find(o => o.id === s.id)!;
    assert.equal(s.address, site.address, `${s.id}: the site's address`);
    assert.equal(s.name, site.name);
    assert.equal(s.siteVerifiedAt, site.verifiedAt);
    assert.match(s.osmUrl, /^https:\/\/www\.openstreetmap\.org\/(way|node)\/\d+$/);
    assert.match(s.verifiedAt, /^2026-09-\d{2}$/);
    // the sign stands next to the address's OSM point (never a guessed point): ≤ 5 u ≈ 35 m
    assert.ok(dist(projectCity(s.osm.lat, s.osm.lng), s) <= 5, `${s.id}: ${dist(projectCity(s.osm.lat, s.osm.lng), s).toFixed(1)} u from its OSM point`);
    assert.ok([...s.what.zh].length <= 20 && [...s.hours.zh].length <= 30, s.id);
  }
  assert.ok(SIGN_NEAR >= 150 && SIGN_NEAR <= 400);
  assert.equal(openingUrl('sergeant-ma', 'zh-Hans'), '/openings/sergeant-ma');
  assert.equal(openingUrl('sergeant-ma', 'en'), '/openings/sergeant-ma?lang=en');
});

test('W6-S3 openings: every sign stands on the published city, off the road, on the walking network reachable from ferry-gate', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const s of OPENING_SIGNS) await sf.attachAround(city, s.x, s.z, 24, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    const ferry = DISTRICT.anchors['ferry-gate'];
    const home = ix.component(ix.nearestNode(ferry.x, ferry.z, 60));
    for (const s of OPENING_SIGNS) {
      assert.ok(canStand(s.x, s.z), `${s.id}: standable`);
      assert.notEqual(surfaceAt(s.x, s.z), 'road', `${s.id}: not on the road`);
      const n = ix.nearestNode(s.x, s.z, 16);
      assert.ok(n >= 0 && ix.component(n) === home, `${s.id}: on the walking network`);
    }
  } finally { setCityTerrain(null); }
});

test('W6-S3 openings: the sign is one small toy geometry (≤ 400 triangles, ≤ 4 u tall) with the kit attributes; the card links the BAYLINK page', async () => {
  const { buildOpeningSignGeometry } = await import('../src/opus-bay/realsf/eventKit');
  const geo = buildOpeningSignGeometry({ x: 10, z: 20, yaw: 0.6 }, () => 2);
  const tris = (geo.index?.count ?? 0) / 3;
  assert.ok(tris > 30 && tris <= 400, `${tris} triangles`);
  for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(geo.getAttribute(a), a);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  assert.ok(bb.min.y >= 2 - 0.01 && bb.max.y <= 2 + 4, `${bb.min.y}…${bb.max.y}`);
  assert.ok(Math.max(bb.max.x - 10, 10 - bb.min.x, bb.max.z - 20, 20 - bb.min.z) < 2, 'compact');
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { default: OpeningCard } = await import('../src/opus-bay/realsf/OpeningCard');
  styles.deregister();
  const html = renderToStaticMarkup(h(OpeningCard, { props: { id: 'sergeant-ma' }, close: () => {} }));
  assert.match(html, /Sergeant Ma/);
  assert.match(html, /185 Berry Street/);
  assert.match(html, /href="\/openings\/sergeant-ma"/);
  assert.match(html, /新店/);
  assert.equal(renderToStaticMarkup(h(OpeningCard, { props: { id: 'nope' }, close: () => {} })), '');
});
