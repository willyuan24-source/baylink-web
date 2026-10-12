import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import { listSources } from '../scripts/check-style-ratchet.mjs';
import { TEXT_DARK, TEXT_LIGHT } from '../scripts/codemods/hex-to-tokens.mjs';
import config from '../tailwind.config.js';

// READ-02 at the token level (TOKENS-B): every text token passes WCAG AA (4.5:1) on every surface it is drawn on, so a
// page built from tokens cannot fail contrast. Three layers: the palette matrix, every CSS rule that sets a text token
// and a background token together, and every Tailwind class string that pairs a baylink text colour with a background.

const tokensCss = readFileSync('src/tokens.css', 'utf8');
const palette = new Map<string, number[]>();
postcss.parse(tokensCss).walkDecls(/^--color-[a-z0-9-]+-rgb$/, declaration => {
  if ((declaration.parent as postcss.Rule).selector === ':root') palette.set(declaration.prop.slice(8, -4), declaration.value.trim().split(/\s+/).map(Number));
});
const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const ratio = (a: number[], b: number[]) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + .05) / (low + .05); };
const over = (fg: number[], alpha: number, bg: number[]) => fg.map((value, index) => value * alpha + bg[index] * (1 - alpha));
const rgbOf = (name: string) => { const value = palette.get(name); assert.ok(value, `--color-${name}-rgb is defined`); return value; };

const LIGHT_SURFACES = ['bg', 'surface', 'surface-2', 'selected', 'brand-tint', 'warm-tint', 'success-tint', 'warning-tint', 'danger-tint', 'info-tint', 'highlight'];
const DARK_SURFACES = ['brand-deep', 'brand-hover', 'ink'];

test('palette matrix: dark text tokens on every light surface, light text tokens on the dark brand surfaces', () => {
  const failures: string[] = [];
  for (const text of TEXT_DARK) for (const surface of LIGHT_SURFACES) {
    const value = ratio(rgbOf(text), rgbOf(surface));
    if (value < 4.5) failures.push(`${text} on ${surface} ${value.toFixed(2)}:1`);
  }
  for (const text of TEXT_LIGHT) for (const surface of DARK_SURFACES) {
    const value = ratio(rgbOf(text), rgbOf(surface));
    if (value < 4.5) failures.push(`${text} on ${surface} ${value.toFixed(2)}:1`);
  }
  // White on the brand button and the plum TypeCover pair.
  for (const [text, surface] of [['surface', 'brand'], ['plum', 'plum-tint']]) {
    const value = ratio(rgbOf(text), rgbOf(surface));
    if (value < 4.5) failures.push(`${text} on ${surface} ${value.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, []);
});

test('the colour tokens read their channels: --color-x is rgb(var(--color-x-rgb)), one value per colour', () => {
  const values = new Map<string, string>();
  postcss.parse(tokensCss).walkDecls(/^--color-/, declaration => { if ((declaration.parent as postcss.Rule).selector === ':root') values.set(declaration.prop, declaration.value.trim()); });
  for (const name of palette.keys()) assert.equal(values.get(`--color-${name}`), `rgb(var(--color-${name}-rgb))`, `--color-${name}`);
});

/** A colour written with tokens, resolved to opaque sRGB over `under` (white by default). */
const resolve = (value: string, under = [255, 255, 255]): number[] | null => {
  const opaque = /^var\(--color-([a-z0-9-]+)\)$/.exec(value.trim());
  if (opaque && palette.has(opaque[1])) return palette.get(opaque[1])!;
  const alpha = /^rgb\(var\(--color-([a-z0-9-]+)-rgb\) \/ (\d*\.?\d+)\)$/.exec(value.trim());
  if (alpha && palette.has(alpha[1])) return over(palette.get(alpha[1])!, Number(alpha[2]), under);
  return null;
};

test('every CSS rule that sets a text token on a background token passes AA', () => {
  const failures: string[] = [];
  let pairs = 0;
  for (const file of listSources('.', { extensions: /\.css$/ }) as string[]) {
    postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
      let color: string | undefined, background: string | undefined;
      rule.each(node => {
        if (node.type !== 'decl') return;
        if (node.prop === 'color') color = node.value;
        if (node.prop === 'background' || node.prop === 'background-color') background = node.value;
      });
      if (!color || !background) return;
      const bg = resolve(background); const fg = bg && resolve(color, bg);
      if (!bg || !fg) return;
      pairs++;
      const value = ratio(fg, bg);
      if (value < 4.5) failures.push(`${file} ${rule.selector}: ${color} on ${background} ${value.toFixed(2)}:1`);
    });
  }
  assert.ok(pairs > 40, `${pairs} token pairs measured`);
  assert.deepEqual(failures, []);
});

test('Tailwind: every class string pairing a baylink text colour with a baylink background passes AA', () => {
  const colours = (config.theme?.extend?.colors as { baylink: Record<string, string> }).baylink;
  const channel = (name: string) => { const token = /var\(--color-([a-z0-9-]+)-rgb\)/.exec(colours[name] ?? '')?.[1]; return token ? palette.get(token) : undefined; };
  const failures: string[] = [];
  let pairs = 0;
  for (const file of listSources('.', { extensions: /\.tsx?$/ }) as string[]) {
    for (const [literal] of readFileSync(file, 'utf8').matchAll(/(["'`])(?:(?!\1).)*\btext-baylink-[a-z-]+(?:(?!\1).)*\bbg-baylink-[a-z-]+(?:(?!\1).)*\1|(["'`])(?:(?!\2).)*\bbg-baylink-[a-z-]+(?:(?!\2).)*\btext-baylink-[a-z-]+(?:(?!\2).)*\2/g)) {
      // Base (non-variant) classes only: hover:/focus: states are checked by the rule they belong to.
      const classes = literal.slice(1, -1).split(/\s+/).filter(name => !name.includes(':'));
      const text = classes.map(name => /^text-baylink-([a-z-]+?)(?:\/(\d+))?$/.exec(name)).find(Boolean);
      const background = classes.map(name => /^bg-baylink-([a-z-]+?)(?:\/(\d+))?$/.exec(name)).find(Boolean);
      if (!text || !background) continue;
      const bgRgb = channel(background[1]); const fgRgb = channel(text[1]);
      if (!bgRgb || !fgRgb) continue;
      const bg = over(bgRgb, background[2] ? Number(background[2]) / 100 : 1, [255, 255, 255]);
      const fg = over(fgRgb, text[2] ? Number(text[2]) / 100 : 1, bg);
      pairs++;
      const value = ratio(fg, bg);
      if (value < 4.5) failures.push(`${file}: ${text[0]} on ${background[0]} ${value.toFixed(2)}:1`);
    }
  }
  assert.ok(pairs > 5, `${pairs} Tailwind pairs measured`);
  assert.deepEqual(failures, []);
});
