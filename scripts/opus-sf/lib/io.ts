// Raw input access for the SF build: the Overpass layer files (one element per line), the DEM, hashes, output.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Raw SF data folder (≈ 640 MB, not in git; re-fetch with scripts/opus-sf/fetch/*). Override with OPUS_SF_DATA. */
export const SF_DATA = process.env.OPUS_SF_DATA || 'C:/Users/willy/opus-qa/sf-data';
export const RAW = path.join(SF_DATA, 'raw');

export interface OsmGeomPoint { lat: number; lon: number }
export interface OsmMember { type: 'node' | 'way' | 'relation'; ref: number; role: string; geometry?: OsmGeomPoint[]; lat?: number; lon?: number }
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number; lon?: number;
  center?: OsmGeomPoint;
  geometry?: OsmGeomPoint[];
  members?: OsmMember[];
  tags?: Record<string, string>;
}

/** Header line of a layer file (generator, osm_base …). */
export function layerHeader(layer: string): Record<string, string> {
  const fd = fs.openSync(path.join(RAW, `osm-${layer}.json`), 'r');
  const buf = Buffer.alloc(4096);
  fs.readSync(fd, buf, 0, 4096, 0);
  fs.closeSync(fd);
  const first = buf.toString('utf8').split('\n')[0];
  return JSON.parse(first.replace(/"elements":\[\s*$/, '"elements":[]}').replace(/,?\s*$/, '')) as Record<string, string>;
}

/** Every element of raw/osm-<layer>.json (the files store one element per line). */
export function* elements(layer: string): Generator<OsmElement> {
  const text = fs.readFileSync(path.join(RAW, `osm-${layer}.json`), 'utf8');
  let at = 0;
  while (at < text.length) {
    let end = text.indexOf('\n', at);
    if (end < 0) end = text.length;
    if (text.startsWith('{"type"', at)) {
      let line = text.slice(at, end).trimEnd();
      if (line.endsWith(',')) line = line.slice(0, -1);
      yield JSON.parse(line) as OsmElement;
    }
    at = end + 1;
  }
}

export function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
export const sha256 = (b: Uint8Array | string) => crypto.createHash('sha256').update(b).digest('hex');

export function gzipBytes(b: Uint8Array): Uint8Array {
  // mtime 0 + fixed level so identical input gives identical files
  return new Uint8Array(zlib.gzipSync(b, { level: 9 }));
}

export function writeFile(file: string, data: Uint8Array | string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

export interface DemHeader {
  width: number; height: number; originLat: number; originLng: number; dLat: number; dLng: number;
}
export function loadDem(name = 'dem-sf-z14'): { hdr: DemHeader; data: Float32Array } {
  const hdr = JSON.parse(fs.readFileSync(path.join(RAW, `${name}.json`), 'utf8')) as DemHeader;
  const buf = fs.readFileSync(path.join(RAW, `${name}.f32`));
  const data = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  if (data.length !== hdr.width * hdr.height) throw new Error(`${name}: size mismatch`);
  return { hdr, data };
}

/** Bilinear DEM value at lat/lng (cell-centre registration); NaN outside the grid. */
export function demAt(dem: { hdr: DemHeader; data: Float32Array }, lat: number, lng: number): number {
  const { hdr, data } = dem;
  const c = (lng - hdr.originLng) / hdr.dLng - 0.5, r = (hdr.originLat - lat) / hdr.dLat - 0.5;
  const i = Math.floor(c), j = Math.floor(r);
  if (i < 0 || j < 0 || i >= hdr.width - 1 || j >= hdr.height - 1) return Number.NaN;
  const fx = c - i, fy = r - j, w = hdr.width;
  return data[j * w + i] * (1 - fx) * (1 - fy) + data[j * w + i + 1] * fx * (1 - fy) + data[(j + 1) * w + i] * (1 - fx) * fy + data[(j + 1) * w + i + 1] * fx * fy;
}

/** Join way geometries (lat/lon lists) into closed rings by matching endpoints exactly. */
export function joinRings(ways: OsmGeomPoint[][]): OsmGeomPoint[][] {
  const key = (p: OsmGeomPoint) => `${p.lat},${p.lon}`;
  const pool = ways.filter(w => w.length >= 2).map(w => w.slice());
  const rings: OsmGeomPoint[][] = [];
  while (pool.length) {
    let ring = pool.pop()!;
    let grew = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        const a = key(w[0]), b = key(w[w.length - 1]), head = key(ring[0]), tail = key(ring[ring.length - 1]);
        if (a === tail) ring = ring.concat(w.slice(1));
        else if (b === tail) ring = ring.concat(w.slice(0, -1).reverse());
        else if (b === head) ring = w.slice(0, -1).concat(ring);
        else if (a === head) ring = w.slice(1).reverse().concat(ring);
        else continue;
        pool.splice(i, 1); grew = true; break;
      }
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring.slice(0, -1));
  }
  return rings;
}
