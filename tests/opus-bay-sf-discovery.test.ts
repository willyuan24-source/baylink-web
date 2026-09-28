import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sfDisk } from './opus-bay-sf-disk';

/**
 * Lane P (wave 4, W4-P7 at the integration): discovery with stations as places — the place index the game builds
 * (places.json through applyW4Places, the stations of every published line as rows), found at 12 u like any place,
 * kept among the save's `discovered` ids, and the stamp toast naming them.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop), set: () => true });
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const sf = sfDisk();
const { buildPlaceIndex, landmarkInputsFrom, poiInputs } = await import('../src/opus-bay/data/sf/places');
const { applyW4Places } = await import('../src/opus-bay/data/sf/extraPlaces');
const { stationRows } = await import('../src/opus-bay/data/sf/stationPlaces');
const { w4Of } = await import('../src/opus-bay/data/sf/mapTransit');
const { buildTransit } = await import('../src/opus-bay/data/transit');
const { mapLinesFrom, mapStations } = await import('../src/opus-bay/ui/mapLines');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { sfLandmarkAnchor } = await import('../src/opus-bay/world/sf/landmarks/context');
const { sfLandmarkInfo } = await import('../src/opus-bay/data/sf/landmarks');
const { newlyDiscovered, DISCOVER_R, StampThrottle } = await import('../src/opus-bay/game/discovery');
const { MAX_DISCOVERED } = await import('../src/opus-bay/data/save');

const placesFile = JSON.parse(fs.readFileSync(path.join(sf.base, 'places.json'), 'utf8'));
const transitFile = JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8'));
const w4 = w4Of(transitFile).lines.length ? w4Of(transitFile) : w4Of(JSON.parse(fs.readFileSync(path.join(sf.base, 'transit-w4.json'), 'utf8')));
const stations = mapStations(mapLinesFrom(buildTransit(transitFile), transitFile.lines.find((l: { id: string }) => l.id === 'f-line'), w4.lines));
const rows = applyW4Places(placesFile);
const ix = buildPlaceIndex({ places: [...rows, ...stationRows(stations, w4.props, new Set(rows.map(r => r.id)), placesFile.verifiedAt)] }, landmarkInputsFrom(SF_LANDMARKS, sfLandmarkInfo, sfLandmarkAnchor), poiInputs());

test('stations are places: every map station is a row of the index, found within 12 u like any place', () => {
  const st = ix.list.filter(p => p.station);
  assert.equal(st.length, stations.length);
  assert.ok(st.length >= 100, `${st.length} stations`);
  for (const s of st.slice(0, 40)) {
    const near = (d: number) => newlyDiscovered(ix, { x: s.x + d, z: s.z }, () => false).some(p => p.id === s.id);
    assert.equal(near(DISCOVER_R - 0.1), true, `${s.id} at 11.9 u`);
    assert.equal(near(DISCOVER_R + 0.1), false, `${s.id} at 12.1 u`);
  }
  // loop, Metro, cable-car and F stops are all among them
  for (const prefix of ['loop-', 'muni-', 'f-line-']) assert.ok(st.some(s => s.id.startsWith(prefix)), prefix);
  assert.ok(st.some(s => s.name.zh.endsWith('站')), 'Metro stations carry their zh gloss');
});

test('the save keeps them: every place and station id fits the discovered cap; the stamp toast tells finds together', () => {
  assert.ok(ix.list.length <= MAX_DISCOVERED, `${ix.list.length} rows ≤ ${MAX_DISCOVERED}`);
  const st = new StampThrottle(4000);
  const a = ix.get('muni-castro')!, b = ix.get('castro-theatre')!;
  st.push(a); st.push(b);
  assert.deepEqual(st.take(0).map(p => p.id), ['muni-castro', 'castro-theatre']);
});
