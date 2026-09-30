// W7-W2 · Alcatraz: the island's ground heights for its T1 model (src/opus-bay/world/sf/landmarks/alcatraz.ts).
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/alcatraz-ground.mts
//
// The model stands its buildings, gardens and scrub on the published city ground (the chunk DEM the island is drawn
// with: public/opus-bay/sf/<current>, chunk -4_-1), sampled on a 1 u grid over the island's local box (the landmark's
// frame: origin projectCity(37.8267, −122.423), yaw 0) and written as a 2 u grid (bilinear at runtime). Re-run after a
// new city publish; tests/opus-bay-w7-w2-alcatraz.test.ts re-samples the published DEM and fails when it drifts.
import fs from 'node:fs';
import path from 'node:path';
import { demSample } from '../../src/opus-bay/world/sf/format';
import { sfDisk } from '../../tests/opus-bay-sf-disk';
import { ALCA_GRID, ALCA_X, ALCA_Z } from '../../src/opus-bay/world/sf/landmarks/alcatrazGround';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'src/opus-bay/world/sf/landmarks/alcatrazGround.ts');

export async function sampleAlcatraz(): Promise<number[]> {
  const sf = sfDisk();
  const chunk = await sf.chunk(Math.floor(ALCA_X / 128), Math.floor(ALCA_Z / 128));
  if (!chunk) throw new Error('no chunk under Alcatraz');
  const { x0, z0, step, cols, rows } = ALCA_GRID;
  const out: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const y = demSample(chunk.dem, ALCA_X + x0 + i * step, ALCA_Z + z0 + j * step);
    out.push(Math.max(0, Math.round(y * 20) / 20));
  }
  return out;
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!)) {
  const ys = await sampleAlcatraz();
  const src = fs.readFileSync(OUT, 'utf8');
  const body = ys.map(v => String(v)).join(',');
  const next = src.replace(/const Y = \[[^\]]*\];/, `const Y = [${body}];`);
  fs.writeFileSync(OUT, next);
  console.log('wrote', ys.length, 'heights, max', Math.max(...ys));
}
