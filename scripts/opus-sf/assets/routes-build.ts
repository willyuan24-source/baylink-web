// The walks of the three finished routes (lane D2, D2-11), written to src/opus-bay/data/sf/routePaths.ts:
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/routes-build.ts [--check]
//
// Each route is the published walk graph's A* route (core/walkGraph findGraphPath, the game's own routing) from stop to
// stop in data/sf/routes.ts, every leg simplified to 1 u (Douglas–Peucker, the stops kept), points rounded to 0.1 u;
// `stopAt` = each stop's arc position (the leg ends). Re-run after changing a stop (tests/opus-bay-sf-routes checks the
// table against a fresh build); --check prints what changed and exits 1 when anything did.
import fs from 'node:fs';
import path from 'node:path';
import { findGraphPath } from '../../../src/opus-bay/core/walkGraph';
import type { Vec2 } from '../../../src/opus-bay/core/types';
import { ROUTE_PATHS } from '../../../src/opus-bay/data/sf/routePaths';
import { SF_ROUTES, type SfRoute } from '../../../src/opus-bay/data/sf/routes';
import { sfDisk } from '../../../tests/opus-bay-sf-disk';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, 'src/opus-bay/data/sf/routePaths.ts');
/** simplification tolerance (u) */
const TOL = 1;

function simplify(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    const a = pts[i0], b = pts[i1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    let best = -1, bd = tol;
    for (let i = i0 + 1; i < i1; i++) {
      const p = pts[i], t = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2)) : 0;
      const d = Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([i0, best], [best, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const r1 = (v: number) => Math.round(v * 10) / 10 + 0;

export async function buildRoutePath(route: SfRoute, ix: Awaited<ReturnType<ReturnType<typeof sfDisk>['graphIndex']>>) {
  const node = (x: number, z: number, what: string) => {
    const n = ix.nearestNode(x, z, 60);
    if (n < 0) throw new Error(`${what}: no walk-graph node within 60 u`);
    return n;
  };
  const out: Vec2[] = [];
  const stopAt: number[] = [0];
  let len = 0, from = node(route.stops[0].x, route.stops[0].z, route.stops[0].id);
  for (let i = 1; i < route.stops.length; i++) {
    const s = route.stops[i];
    // this stop's leg, through its waypoints
    for (const to of [...(s.via ?? []).map(([x, z], k) => node(x, z, `${s.id} via ${k}`)), node(s.x, s.z, s.id)]) {
      const p = findGraphPath(ix, from, to);
      if (!p) throw new Error(`→ ${s.id}: no walk`);
      const leg = simplify(p.points.map(q => ({ x: r1(q.x), z: r1(q.z) })), TOL);
      for (let k = out.length ? 1 : 0; k < leg.length; k++) {
        if (out.length) len += Math.hypot(leg[k].x - out[out.length - 1].x, leg[k].z - out[out.length - 1].z);
        out.push(leg[k]);
      }
      from = to;
    }
    stopAt.push(Math.round(len * 10) / 10);
  }
  return { points: out.flatMap(p => [p.x, p.z]), length: Math.round(len * 10) / 10, stopAt };
}

async function main() {
  const check = process.argv.includes('--check');
  const ix = await sfDisk().graphIndex();
  const rows: string[] = [];
  let diffs = 0;
  for (const r of SF_ROUTES) {
    const b = await buildRoutePath(r, ix);
    const changed = JSON.stringify(b) !== JSON.stringify(ROUTE_PATHS[r.id]);
    if (changed) diffs++;
    const gaps = b.stopAt.slice(1).map((a, i) => a - b.stopAt[i]);
    console.log(`${r.id} ${b.length.toFixed(0)} u, ${b.points.length / 2} points, gaps ${gaps.map(g => g.toFixed(0)).join(' / ')}${changed ? '  CHANGED' : ''}`);
    rows.push(`  ${r.id}: {\n    length: ${b.length},\n    stopAt: [${b.stopAt.join(', ')}],\n    points: [${b.points.join(', ')}],\n  },`);
  }
  if (check) process.exit(diffs ? 1 : 0);
  const src = fs.readFileSync(OUT, 'utf8');
  const head = src.slice(0, src.indexOf('export const ROUTE_PATHS'));
  fs.writeFileSync(OUT, `${head}export const ROUTE_PATHS: Readonly<Record<string, { length: number; stopAt: readonly number[]; points: readonly number[] }>> = {\n${rows.join('\n')}\n};\n`);
  console.log('wrote', path.relative(ROOT, OUT));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void main();
