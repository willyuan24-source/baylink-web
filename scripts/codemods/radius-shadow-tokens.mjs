// UI9-F codemod: border radii and drop shadows onto the tokens v2 scales (src/tokens.css).
//   node scripts/codemods/radius-shadow-tokens.mjs [--write]
// Radius (N11): every px/rem radius snaps to the nearest step: ≤8 → --r-sm (6), ≤13 → --r-md (10), ≤20 → --r-lg (16),
// ≤40 → --r-xl (24), ≥99 → --r-pill, 50% → --r-circle; 0 and other units stay. Shadow (N10): a single outer drop shadow
// (no inset, no spread) becomes --e1 (blur ≤12px) or --e2; rings, insets, multi-layer and token shadows stay.
// The 3D worlds (src/opus-bay, Little Bay) are excluded, like the style ratchet.
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
import { listSources } from '../check-style-ratchet.mjs';

const px = token => { if (token === '0') return 0; const m = /^(-?\d*\.?\d+)(px|rem)$/.exec(token); return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null; };
export function radiusToken(token) {
  if (token === '50%') return 'var(--r-circle)';
  const value = px(token);
  if (value === null || value <= 0) return token;
  if (value >= 99) return 'var(--r-pill)';
  if (value <= 8) return 'var(--r-sm)';
  if (value <= 13) return 'var(--r-md)';
  if (value <= 20) return 'var(--r-lg)';
  return 'var(--r-xl)';
}
export const rewriteRadius = value => /var\(|calc\(|max\(|min\(|\//.test(value) ? value : value.trim().split(/\s+/).map(radiusToken).join(' ');
export function rewriteShadow(value) {
  const v = value.trim();
  if (/^var\(/.test(v) || /\binset\b/.test(v) || v === 'none') return value;
  // one layer only: no top-level comma
  let depth = 0; for (const ch of v) { if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0) return value; }
  // drop the colour: functions (balanced parentheses), hex and named colours
  let bare = '', level = 0;
  for (const ch of v.replace(/[a-z-]+\(/gi, '(')) { if (ch === '(') level++; if (!level) bare += ch; if (ch === ')') level--; }
  const lengths = bare.replace(/#[\da-f]+/gi, ' ').trim().split(/\s+/).filter(token => token && !/^[a-z]+$/i.test(token));
  if (lengths.length < 3 || lengths.length > 4) return value;
  const nums = lengths.map(px);
  if (nums.some(n => n === null)) return value;
  const [, , blur, spread = 0] = nums;
  if (spread !== 0 || blur === 0) return value; // rings and hard edges are not elevation
  return blur <= 12 ? 'var(--e1)' : 'var(--e2)';
}

const write = process.argv.includes('--write');
let changed = 0;
for (const file of listSources('.', { extensions: /\.css$/ })) {
  if (file === 'src/tokens.css') continue;
  const text = readFileSync(file, 'utf8');
  const root = postcss.parse(text, { from: file });
  let touched = false;
  root.walkDecls(decl => {
    const prop = decl.prop.toLowerCase();
    const next = /^border(?:-[a-z]+)*-radius$/.test(prop) ? rewriteRadius(decl.value) : prop === 'box-shadow' ? rewriteShadow(decl.value) : decl.value;
    if (next !== decl.value) { decl.value = next; touched = true; changed++; }
  });
  if (touched && write) writeFileSync(file, root.toString());
}
console.log(`${changed} declarations ${write ? 'rewritten' : 'would change'}`);
