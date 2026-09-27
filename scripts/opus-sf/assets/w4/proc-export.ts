/**
 * Lane V (W4-V4 QA gate): export lane L's procedural lod-0 building of a wave-4 site as an OBJ (local frame, three.js
 * axes, vertex colours), cropped to the building's box so plaza props do not enter the silhouette, for the
 * AI-vs-procedural silhouette check (proc_iou.py, Blender).
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/w4/proc-export.ts <siteId> <out.obj> <x0,x1,z0,z1> [yMin]
 *
 * The y of every vertex is lowered by the lowest cropped vertex (the model rests on y = 0 like the GLBs).
 */
import fs from 'node:fs';
import { buildLandmark } from '../../../../src/opus-bay/world/sf/landmarks/index';
import { w4Site } from '../../../../src/opus-bay/world/sf/landmarks/w4sites';

const [id, out, boxArg, yMinArg] = process.argv.slice(2);
const site = w4Site(id);
if (!site) throw new Error(`no wave-4 site ${id}`);
const [x0, x1, z0, z1] = boxArg.split(',').map(Number);
const g = buildLandmark(site, 0, 0);
const pos = g.getAttribute('position').array as ArrayLike<number>;
const col = g.getAttribute('color').array as ArrayLike<number>;
const idx = g.getIndex()!.array as ArrayLike<number>;
const inBox = (i: number) => pos[i * 3] >= x0 && pos[i * 3] <= x1 && pos[i * 3 + 2] >= z0 && pos[i * 3 + 2] <= z1;
const keep: number[] = [];
for (let t = 0; t < idx.length; t += 3) if (inBox(idx[t]) && inBox(idx[t + 1]) && inBox(idx[t + 2])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
let yMin = Infinity;
for (const i of keep) yMin = Math.min(yMin, pos[i * 3 + 1]);
if (yMinArg !== undefined) yMin = Math.max(yMin, Number(yMinArg));
const map = new Map<number, number>();
const lines: string[] = [`# ${id} lod 0 (lane L procedural), cropped to x ${x0}..${x1} z ${z0}..${z1}, y - ${yMin.toFixed(3)}`];
for (const i of keep) {
  if (map.has(i)) continue;
  map.set(i, map.size + 1);
  lines.push(`v ${pos[i * 3].toFixed(4)} ${(pos[i * 3 + 1] - yMin).toFixed(4)} ${pos[i * 3 + 2].toFixed(4)} ${col[i * 3].toFixed(3)} ${col[i * 3 + 1].toFixed(3)} ${col[i * 3 + 2].toFixed(3)}`);
}
for (let t = 0; t < keep.length; t += 3) lines.push(`f ${map.get(keep[t])} ${map.get(keep[t + 1])} ${map.get(keep[t + 2])}`);
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(JSON.stringify({ id, triangles: keep.length / 3, vertices: map.size, yMin: +yMin.toFixed(3) }));
