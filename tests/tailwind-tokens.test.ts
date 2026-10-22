import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../tailwind.config.js';

// TOKENS-B (RC-9, SV-07): Tailwind's baylink.* colours read the palette's channel tokens, so one value in src/tokens.css
// re-themes every utility class, and the /NN opacity modifiers keep working. A plain var(--color-…) would silently drop
// all of them (Tailwind cannot put an alpha on an opaque var()), which is why the colours are rgb(var(--…-rgb) / <alpha-value>).

const tokens = readFileSync('src/tokens.css', 'utf8');
const channels = new Map<string, string>();
postcss.parse(tokens).walkDecls(/^--color-[a-z0-9-]+-rgb$/, declaration => { channels.set(declaration.prop, declaration.value.trim()); });

const compile = async (classes: string) => {
  const result = await postcss([tailwindcss({ ...config, content: [{ raw: `<div class="${classes}"></div>`, extension: 'html' }] })])
    .process('@tailwind utilities;', { from: undefined });
  return result.css;
};
const flatColours = (colours: Record<string, unknown>, prefix = ''): [string, string][] => Object.entries(colours).flatMap(([name, value]) => typeof value === 'string'
  ? [[`${prefix}${name}`, value] as [string, string]] : flatColours(value as Record<string, unknown>, `${prefix}${name}-`));

test('every baylink.* colour is an rgb() of a channel token that tokens.css defines', () => {
  const colours = flatColours((config.theme?.extend?.colors ?? {}) as Record<string, unknown>);
  assert.ok(colours.length >= 15, 'the palette is parsed');
  for (const [name, value] of colours) {
    const match = /^rgb\(var\((--color-[a-z0-9-]+-rgb)\) \/ <alpha-value>\)$/.exec(value);
    assert.ok(match, `${name}: ${value} must be rgb(var(--color-…-rgb) / <alpha-value>)`);
    assert.match(channels.get(match[1]) ?? '', /^\d{1,3} \d{1,3} \d{1,3}$/, `${name}: ${match[1]} is an "R G B" channel token in src/tokens.css`);
  }
});

test('opacity modifiers still emit: border-baylink-border/60 and friends compile to the channel token with that alpha', async () => {
  const css = await compile('border-baylink-border/60 bg-baylink-section/40 text-baylink-green/80 ring-baylink-green/15 from-baylink-green/5 bg-baylink-green text-baylink-muted hover:bg-baylink-green/10');
  const rule = (selector: string) => {
    let found = '';
    postcss.parse(css).walkRules(node => { if (node.selector === selector) found = node.toString(); });
    assert.ok(found, `${selector} is emitted`);
    return found;
  };
  assert.match(rule('.border-baylink-border\\/60'), /border-color: rgb\(var\(--color-line-rgb\) \/ 0\.6\)/);
  assert.match(rule('.bg-baylink-section\\/40'), /background-color: rgb\(var\(--color-surface-2-rgb\) \/ 0\.4\)/);
  assert.match(rule('.text-baylink-green\\/80'), /color: rgb\(var\(--color-brand-rgb\) \/ 0\.8\)/);
  assert.match(rule('.ring-baylink-green\\/15'), /--tw-ring-color: rgb\(var\(--color-brand-rgb\) \/ 0\.15\)/);
  assert.match(rule('.from-baylink-green\\/5'), /rgb\(var\(--color-brand-rgb\) \/ 0\.05\)/);
  assert.match(rule('.bg-baylink-green'), /background-color: rgb\(var\(--color-brand-rgb\) \/ var\(--tw-bg-opacity, 1\)\)/);
  // READ-02 at the token level: the muted text classes read ink-3 (6.25:1 on white, ≥5.19:1 on every light surface).
  assert.match(rule('.text-baylink-muted'), /color: rgb\(var\(--color-ink-3-rgb\) \/ var\(--tw-text-opacity, 1\)\)/);
  assert.match(rule('.hover\\:bg-baylink-green\\/10:hover'), /rgb\(var\(--color-brand-rgb\) \/ 0\.1\)/);
});

test('every *-baylink-* class written in src compiles to a rule (none silently dropped)', async () => {
  const sources = (await import('../scripts/check-style-ratchet.mjs')).listSources('.', { extensions: /\.tsx?$/ }) as string[];
  const used = new Set<string>();
  const pattern = /(?<![\w-])(?:text|bg|border(?:-[trblxy])?|ring(?:-offset)?|accent|from|via|to|fill|stroke|outline|divide|placeholder|decoration|caret)-baylink-[a-z-]+(?:\/\d+)?(?![\w-])/g;
  for (const file of sources) for (const match of readFileSync(file, 'utf8').matchAll(pattern)) used.add(match[0]);
  // A floor that proves the scan reads the sources; it falls as templates move off Tailwind colours (UI9-BB left exactly 40;
  // UI9-R1-CATEGORY moved OfficialAds onto community.css: exactly 38; with UI9-R1-RATCHET-LOGGED-IN's member dialogs on the
  // tokens too, fix batch 4's integration counts exactly 37). A lane that drops more lowers it to its own count;
  // when parallel lanes merge, the integration re-counts.
  assert.ok(used.size >= 37, `found ${used.size} distinct classes`);
  const css = await compile([...used].join(' '));
  const emitted = new Set<string>();
  postcss.parse(css).walkRules(rule => {
    for (const selector of rule.selectors) {
      const name = /^\.((?:\\.|[^\s:>~+.[\\])+)/.exec(selector)?.[1];
      if (name) emitted.add(name.replace(/\\(.)/g, '$1'));
    }
  });
  // from-baylink-green/6 (BayBayPostAssist) is not on Tailwind's opacity scale and was never emitted, hex or not.
  const neverEmitted = new Set(['from-baylink-green/6']);
  const missing = [...used].filter(name => !emitted.has(name) && !neverEmitted.has(name));
  assert.deepEqual(missing, [], 'classes Tailwind no longer generates');
});
