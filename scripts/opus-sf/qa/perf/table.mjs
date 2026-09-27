// Builds the §4.2 markdown rows from the perf logs: node table.mjs <tag>
import fs from 'node:fs';
const tag = process.argv[2] || 'nv';
const dir = new URL(`./${tag}/`, import.meta.url);
const names = { 'ferry-gate': 'Ferry gate', chinatown: 'Chinatown (Dragon Gate)', 'twin-peaks': 'Twin Peaks', 'ocean-beach': 'Ocean Beach (Judah)', 'ggb-south': 'GGB south anchorage', mission: 'Mission (Mission Dolores)' };
const read = f => {
  const out = {};
  for (const line of fs.readFileSync(new URL(f, dir), 'utf8').split('\n')) {
    try { const j = JSON.parse(line); if (j.eval && typeof j.value === 'string' && j.value.startsWith('{')) out[j.eval] = JSON.parse(j.value); } catch { /* not json */ }
  }
  return out;
};
const rows = [];
for (const s of Object.keys(names)) for (const vp of ['desktop', 'mobile']) {
  const f = `perf-${s}-${vp}.log`;
  if (!fs.existsSync(new URL(f, dir))) continue;
  const r = read(f);
  for (const t of ['1x', '4x']) {
    const i = r[`${t}-idle`], w = r[`${t}-walk`];
    if (!i || !w) { rows.push(`| ${names[s]} | ${vp} | ${t} | (missing) |`); continue; }
    const calls = Math.max(i.calls, w.calls), tris = Math.max(i.tris, w.tris), objects = Math.max(i.objects, w.objects);
    const progs = `${r['1x-idle']?.programs}→${w.programs}`;
    const fails = [];
    if (t === '4x' && (i.fps < 45 || w.fps < 45)) fails.push('fps<45');
    if (t === '1x' && vp === 'desktop' && (w.p95 > 18 || w.p99 > 25)) fails.push('p95/p99');
    if (calls > 150) fails.push('calls'); if (tris > 400000) fails.push('tris'); if (objects > 500) fails.push('objects');
    if (r['1x-idle'] && r['4x-walk'] && r['1x-idle'].programs !== r['4x-walk'].programs) fails.push('programs');
    if (w.over100 > 0 || i.over100 > 0) fails.push('>100ms');
    rows.push(`| ${names[s]} | ${vp === 'desktop' ? 'desktop 1440×900' : '390×844'} | ${t} | ${calls} | ${(tris / 1000).toFixed(0)}k | ${progs} | ${objects} | ${i.fps} | ${w.fps} | ${w.p95} | ${w.p99} | ${i.over50 + w.over50} / ${i.over100 + w.over100} | ${fails.length ? 'fail: ' + fails.join(', ') : 'pass'} |`);
  }
}
console.log(rows.join('\n'));
