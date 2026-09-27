// The ground under each San Francisco landmark's setting (lane D2, D2-09), measured on the published city
// (public/opus-bay/sf/<current>) and written to src/opus-bay/world/sf/landmarks/settingData.ts:
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/landmark-settings.ts [--check]
//
// Per landmark: its base exactly as the renderer computes it (a number, or for 'terrain' the chunk's buildL1 base +
// baseLift), the DRAWN city ground over the exclusion's local box (world/sf/build.ts chunkContext height: the walked
// ground minus the landmark's sink inside its exclusion), each grid point the highest ground within ±0.5 u so draped
// plazas never sink into a kerb, in 1/100 u above the base; and the city streets its exclusion clips (the parts
// inside it, as the renderer would have drawn them: class, right-of-way, the centreline in LOCAL x / y / z; y follows
// the street up to the exclusion edge and the sunk ground 2 u inside it). Re-run after changing a landmark's
// exclusion, sink, base or position (tests/opus-bay-sf-landmark-context checks the table against a fresh measurement);
// --check prints the differences and exits 1 when there are any.
import fs from 'node:fs';
import path from 'node:path';
import { SF_LANDMARKS } from '../../../src/opus-bay/world/sf/landmarks/index';
import { SETTING_DATA, type SettingData } from '../../../src/opus-bay/world/sf/landmarks/settingData';
import { SETTING_IDS, measureSetting } from './settingsMeasure';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, 'src/opus-bay/world/sf/landmarks/settingData.ts');

async function main() {
  const check = process.argv.includes('--check');
  const out: Record<string, SettingData> = {};
  let diffs = 0;
  for (const l of SF_LANDMARKS.filter(q => SETTING_IDS.includes(q.id))) {
    const d = await measureSetting(l);
    out[l.id] = d;
    const old = SETTING_DATA[l.id];
    const changed = !old || JSON.stringify(old) !== JSON.stringify(d);
    if (changed) diffs++;
    console.log(`${l.id.padEnd(26)} base ${d.base.toFixed(2)} sink ${d.sink}  grid ${d.grid.cols}×${d.grid.rows}  streets ${d.streets.length}${changed ? (old ? '  CHANGED' : '  NEW') : ''}`);
  }
  if (check) process.exit(diffs ? 1 : 0);
  const body = Object.entries(out).map(([id, d]) => {
    const g = d.grid, rows: string[] = [];
    for (let j = 0; j < g.rows; j++) rows.push(`      ${g.h.slice(j * g.cols, (j + 1) * g.cols).join(', ')},`);
    const st = d.streets.map(s => `      { c: '${s.c}', w: ${s.w}, p: [${s.p.join(', ')}] },`);
    return `  '${id}': {\n    base: ${d.base}, sink: ${d.sink},\n    grid: { x0: ${g.x0}, z0: ${g.z0}, step: ${g.step}, cols: ${g.cols}, rows: ${g.rows}, h: [\n${rows.join('\n')}\n    ] },\n    streets: [${st.length ? `\n${st.join('\n')}\n    ` : ''}],\n  },`;
  }).join('\n');
  const src = fs.readFileSync(OUT, 'utf8');
  const head = src.slice(0, src.indexOf('export const SETTING_DATA'));
  fs.writeFileSync(OUT, `${head}export const SETTING_DATA: Readonly<Record<string, SettingData>> = {\n${body}\n};\n`);
  console.log('wrote', path.relative(ROOT, OUT));
}

void main();
