// UI9-F codemod: font sizes onto the tokens v2 ladder, the weight budget, control borders and motion durations.
//   node scripts/codemods/type-weight-tokens.mjs [--write] [--report]
// Size (N01, N04): a plain px/rem font size snaps to the nearest ladder step (13 · 14 · 16 · 17 · 18 · 20 · 24 · 28 · 32 ·
// 44, src/tokens.css): below 13 → 13 (the floor), 15 → 14 for meta-like rules (chips, tabs, labels, dates, notes …)
// and 16 for everything else (buttons, inputs, body copy), other ties round down, above 44 → 44. clamp() / calc() / em /
// % / var() sizes stay, and so do cover rules (the cover system is UI9-C's). The value stays a literal, so the build's
// text floor (scripts/postcss-text-floor.mjs) still lifts it in 简洁显示 exactly as before.
// Weight (N03): 700 / 800 / 900 / bold / bolder → 600 (the only strong weight), and 600 → 400 on rules whose subject is
// supporting text (badges, chips, tabs, meta, kickers, labels, dates, credits, notes, summaries …): 600 stays for
// headings, card titles, the primary button and key values.
// Controls (N09): an input, select or textarea border drawn in a decorative line colour reads line-control (≥3:1).
// Motion (N24): a literal transition / animation duration of 50-360ms snaps to the five-step scale (120 · 160 · 200 ·
// 240 · 280ms) as a literal; delays, reduced-motion resets (.01ms), loops and long animations stay.
// The 3D worlds (src/opus-bay, Little Bay) are excluded, like the style ratchet; src/tokens.css is the ladder itself.
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
import { listSources } from '../check-style-ratchet.mjs';

export const LADDER = [13, 14, 16, 17, 18, 20, 24, 28, 32, 44];
/** Whole words inside class names: "count" matches .x__count and .count but not .account. */
const words = list => new RegExp(`(?<![a-z])(?:${list})(?![a-z])`, 'i');
const COVER = words('covers?|posters?|tickets?|stamps?|share-card');
const META = words('segmented|meta|chips?|tabs?|badges?|tags?|labels?|caption|small|eyebrow|kicker|count|date|dateline|time|price|pills?|notes?|hint|sources?|credits?|crumbs?|status|legend|footnote|dt|sub|aside|help|kbd');
/** px for a plain length (16px root), or null. */
export const lengthPx = value => { const m = /^(\d*\.?\d+)(px|rem)$/.exec(value.trim()); return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null; };
const remText = px => { const rem = +(px / 16).toFixed(4); return `${String(rem).replace(/^0\./, '.')}rem`; };
/** The ladder step for a size in px; selector decides the 15px tie. */
export function ladderStep(px, selector = '') {
  if (px < 13) return 13;
  if (px > 44) return 44;
  const lower = [...LADDER].reverse().find(step => step <= px), upper = LADDER.find(step => step >= px);
  if (lower === px) return px;
  if (Math.abs(px - 15) < .01) return META.test(selector) ? 14 : 16;
  return px - lower <= upper - px ? lower : upper;
}
export function rewriteFontSize(value, selector) {
  const important = /\s*!important\s*$/i.exec(value)?.[0] ?? '';
  const bare = value.slice(0, value.length - important.length);
  const px = lengthPx(bare);
  if (px === null || COVER.test(selector)) return value;
  const step = ladderStep(px, selector);
  return step === px ? value : remText(step) + important;
}
/** The subject (last compound) of each selector in a rule. */
const subjects = selector => {
  const parts = []; let depth = 0, current = '';
  for (const ch of selector) { if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch; }
  parts.push(current);
  return parts.map(part => part.trim().split(/\s*[\s>+~]\s*(?![^(]*\))/).pop() || '');
};
const QUIET = words('provenance|stickers?|badges?|chips?|tags?|pills?|meta|kicker|eyebrow|labels?|caption|credits?|count|counter|notes?|hint|sources?|date|dates|time|dateline|status|toggle|tabs?|segmented|filters?|crumbs?|summary|small|dt|legend|footnote|help|byline');
const STRONG = words('pins?|titles?|head|heading|h[1-6]|name|value|key|price|primary|number|cta|logo|wordmark|total|amount|strong|b');
export function rewriteWeight(value, selector) {
  const important = /\s*!important\s*$/i.exec(value)?.[0] ?? '';
  let bare = value.slice(0, value.length - important.length).trim().toLowerCase();
  if (/^(?:700|800|900|bold|bolder)$/.test(bare)) bare = '600';
  // Navigation and unread states keep their weight: it is the state, not decoration.
  if (bare === '600' && !COVER.test(selector) && !/navigation|unread/i.test(selector) && subjects(selector).every(subject => QUIET.test(subject) && !STRONG.test(subject))) bare = '400';
  return bare === value.trim().toLowerCase() ? value : bare + important;
}
const CONTROL = /(?:^|[\s>+~(,:])(?:input|select|textarea)\b/i;
export const rewriteControlBorder = (value, selector) => CONTROL.test(selector) && !/checkbox|radio|range/.test(selector)
  ? value.replace(/var\(--color-line(?:-strong)?\)/g, 'var(--color-line-control)') : value;
const DURATIONS = [120, 160, 200, 240, 280];
/** The duration (the first time in each layer) snaps to the scale when it is 50-360ms; delays, "instant" 0.01ms tricks
 *  (reduced-motion resets) and loops stay. */
export function rewriteDurations(value) {
  const layers = []; let depth = 0, current = '';
  for (const ch of value) { if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ',' && depth === 0) { layers.push(current); current = ''; } else current += ch; }
  layers.push(current);
  return layers.map(layer => {
    let seen = false;
    return layer.replace(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b(?![^(]*\))/g, (match, n, unit) => {
      if (seen) return match;
      seen = true;
      const ms = Number(n) * (unit === 's' ? 1000 : 1);
      if (ms < 50 || ms > 360) return match;
      const step = DURATIONS.reduce((best, d) => Math.abs(d - ms) < Math.abs(best - ms) ? d : best);
      if (step === ms) return match;
      return unit === 's' ? `${String(step / 1000).replace(/^0\./, '.')}s` : `${step}ms`;
    });
  }).join(',');
}

const write = process.argv.includes('--write');
const report = process.argv.includes('--report');
const counts = { size: 0, weight: 0, border: 0, motion: 0 };
const lines = [];
for (const file of listSources('.', { extensions: /\.css$/ })) {
  if (file === 'src/tokens.css') continue;
  const text = readFileSync(file, 'utf8');
  const root = postcss.parse(text, { from: file });
  let touched = false;
  root.walkDecls(decl => {
    const prop = decl.prop.toLowerCase();
    const selector = decl.parent?.type === 'rule' ? decl.parent.selector : '';
    if (decl.parent?.type === 'atrule' && /keyframes/i.test(decl.parent.parent?.name || '')) return;
    if (decl.parent?.parent?.type === 'atrule' && /keyframes/i.test(decl.parent.parent.name)) return;
    let next = decl.value, kind = null;
    if (prop === 'font-size') { next = rewriteFontSize(decl.value, selector); kind = 'size'; }
    else if (prop === 'font-weight') { next = rewriteWeight(decl.value, selector); kind = 'weight'; }
    else if (prop === 'font') { next = decl.value.replace(/(^|\s)(700|800|900|bold|bolder)(?=\s)/, '$1600'); kind = 'weight'; }
    else if (/^border(?:-(?:top|right|bottom|left|block|inline))?(?:-color)?$/.test(prop)) { next = rewriteControlBorder(decl.value, selector); kind = 'border'; }
    else if (/^(?:transition|transition-duration|animation|animation-duration)$/.test(prop)) { next = rewriteDurations(decl.value); kind = 'motion'; }
    if (kind && next !== decl.value) {
      if (report) lines.push(`${kind}\t${file}\t${selector.replace(/\s+/g, ' ').slice(0, 90)}\t${decl.value} → ${next}`);
      decl.value = next; touched = true; counts[kind]++;
    }
  });
  if (touched && write) writeFileSync(file, root.toString());
}
if (report) console.log(lines.join('\n'));
console.log(`${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')} declarations ${write ? 'rewritten' : 'would change'}`);
