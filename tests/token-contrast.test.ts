import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import { listSources } from '../scripts/check-style-ratchet.mjs';
import { STATUS_FAMILIES, TEXT_DARK, TEXT_LIGHT } from '../scripts/codemods/hex-to-tokens.mjs';
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
  // The codemod's light status text (a failed message on the brand bubble): the danger and warning tints.
  for (const { tint } of Object.values(STATUS_FAMILIES)) for (const surface of [...DARK_SURFACES, 'brand']) {
    const value = ratio(rgbOf(tint), rgbOf(surface));
    if (value < 4.5) failures.push(`${tint} on ${surface} ${value.toFixed(2)}:1`);
  }
  // White on the brand button, and the category map (tokens v2): each category's text on its own tint, and on paper and
  // white where a category word is printed outside its cover (chips, share cards).
  const categories = [['warm', 'warm-tint'], ['info', 'info-tint'], ['moss', 'moss-tint'], ['warning', 'warning-tint'], ['brand-hover', 'brand-tint'], ['success', 'success-tint']];
  for (const [text, surface] of [['surface', 'brand'], ...categories, ...categories.flatMap(([text]) => [[text, 'bg'], [text, 'surface']])]) {
    const value = ratio(rgbOf(text), rgbOf(surface));
    if (value < 4.5) failures.push(`${text} on ${surface} ${value.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, []);
});

test('control borders (inputs, secondary buttons, chips) are at least 3:1 on every surface a control sits on (WCAG 1.4.11)', () => {
  const failures: string[] = [];
  for (const surface of ['bg', 'surface', 'surface-2']) {
    const value = ratio(rgbOf('line-control'), rgbOf(surface));
    if (value < 3) failures.push(`line-control on ${surface} ${value.toFixed(2)}:1`);
  }
  // The focus ring: brand on the light surfaces, lime (highlight) on the deep ones.
  for (const surface of ['bg', 'surface', 'surface-2']) if (ratio(rgbOf('brand'), rgbOf(surface)) < 3) failures.push(`focus ring on ${surface}`);
  for (const surface of DARK_SURFACES) if (ratio(rgbOf('highlight'), rgbOf(surface)) < 3) failures.push(`focus ring on ${surface}`);
  assert.deepEqual(failures, []);
});

test('tokens v2: the ladder has at most 9 steps per viewport, motion and shadows are tokens, and no fifth accent hue', () => {
  const root = new Map<string, string>(); const desktop = new Map<string, string>();
  postcss.parse(tokensCss).walkDecls(/^--/, declaration => {
    const rule = declaration.parent as postcss.Rule;
    if (rule.selector !== ':root') return;
    const media = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : '';
    if (!media) root.set(declaration.prop, declaration.value.trim());
    else if (/min-width:\s*1024px/.test(media)) desktop.set(declaration.prop, declaration.value.trim());
  });
  const ladder = ['--fs-badge', '--fs-meta', '--fs-body', '--fs-reading', '--fs-card', '--fs-card-lg', '--fs-section', '--fs-title', '--fs-display'];
  const phoneSizes = new Set(ladder.map(name => root.get(name)));
  const desktopSizes = new Set(ladder.map(name => desktop.get(name) ?? root.get(name)));
  assert.ok(!phoneSizes.has(undefined), 'every ladder step is defined');
  assert.ok(phoneSizes.size <= 9 && desktopSizes.size <= 9, `${phoneSizes.size} phone / ${desktopSizes.size} desktop steps`);
  for (const name of ['--dur-1', '--dur-2', '--dur-3', '--dur-4', '--dur-5']) assert.ok(Number.parseInt(root.get(name) ?? '999', 10) <= 280, name);
  for (const name of ['--e1', '--e2', '--scrim', '--ease-out', '--ease-in', '--ease-std', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-pill', '--r-circle']) assert.ok(root.has(name), name);
  assert.ok(!palette.has('plum') && !palette.has('plum-tint'), 'no plum: 长辈 reads the brand family');
  assert.match(tokensCss, /color-scheme:\s*only light/);
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
      // A translucent background shows what is under it (a photo, a brand bubble), which a stylesheet cannot know: only
      // opaque backgrounds are measured here; the page probes measure the rest.
      const alpha = /\/ (\d*\.?\d+)\)$/.exec(background.trim());
      if (alpha && Number(alpha[1]) < .95) return;
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

test('every focus ring recoloured for a container reaches 3:1 on that container\'s own background (WCAG 2.4.7 / 1.4.11)', () => {
  // A rule like `.x :focus-visible { outline-color: var(--color-highlight) }` promises that .x is a surface lime reads on.
  // Each class named before :focus-visible is looked up in every stylesheet: where a rule for it sets an opaque token
  // background, the ring must reach 3:1 on it (UI9-F review: the footer is surface-2, where lime is 1.01:1).
  const ringFailures = (sources: postcss.Root[]) => {
  const backgrounds = new Map<string, number[][]>();
  for (const root of sources) root.walkRules(rule => {
    const last = /\.([a-z0-9_-]+)$/i.exec(rule.selector.trim())?.[1];
    if (!last) return;
    rule.walkDecls(/^background(-color)?$/, declaration => {
      const alpha = /\/ (\d*\.?\d+)\)$/.exec(declaration.value.trim());
      const rgb = alpha && Number(alpha[1]) < .95 ? null : resolve(declaration.value);
      if (rgb) backgrounds.set(last, [...(backgrounds.get(last) ?? []), rgb]);
    });
  });
  const failures: string[] = [];
  for (const root of sources) root.walkRules(/:focus-visible/, rule => {
    rule.walkDecls(/^outline(-color)?$/, declaration => {
      const ring = /var\(--color-([a-z0-9-]+)\)/.exec(declaration.value)?.[1];
      if (!ring || ring === 'brand' || !palette.has(ring)) return;
      for (const selector of rule.selectors) {
        // The ancestors only: drop the focused element's own compound (the ring is drawn around it, on what is under it).
        const head = selector.split(':focus-visible')[0];
        let depth = 0, cut = -1;
        for (let index = 0; index < head.length; index++) {
          if (head[index] === '(') depth++;
          else if (head[index] === ')') depth--;
          else if (depth === 0 && /[\s>+~]/.test(head[index])) cut = index;
        }
        const containers = [...head.slice(0, Math.max(cut, 0)).matchAll(/\.([a-z0-9_-]+)/gi)].map(match => match[1]).filter(name => name !== 'site-app');
        for (const name of containers) for (const bg of backgrounds.get(name) ?? []) {
          const value = ratio(rgbOf(ring), bg);
          if (value < 3) failures.push(`${selector}: ${ring} ring on .${name}'s background ${value.toFixed(2)}:1`);
        }
      }
    });
  });
  return failures;
  };
  const sources = (listSources('.', { extensions: /\.css$/ }) as string[]).map(file => postcss.parse(readFileSync(file, 'utf8')));
  assert.deepEqual(ringFailures(sources), []);
  // The check itself: the rule this branch first shipped (lime in the footer) fails it.
  const footer = postcss.parse('.site-app .site-footer{background:var(--color-surface-2)} .site-app :where(.site-footer,[data-surface=deep]) :focus-visible{outline-color:var(--color-highlight)}');
  assert.equal(ringFailures([footer]).length, 1);
});

test('简洁显示 only raises: every --fs-* step is at least the standard step, on a phone and on a desktop', () => {
  const steps = (selector: string, desktop: boolean) => {
    const found = new Map<string, number>();
    postcss.parse(tokensCss).walkDecls(/^--fs-/, declaration => {
      const rule = declaration.parent as postcss.Rule;
      const media = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : '';
      if (rule.selector !== selector || (media && !(desktop && /min-width:\s*1024px/.test(media)))) return;
      found.set(declaration.prop, Number.parseFloat(declaration.value));
    });
    return found;
  };
  for (const desktop of [false, true]) {
    const standard = new Map([...steps(':root', false), ...(desktop ? steps(':root', true) : [])]);
    const simple = new Map([...standard, ...steps('html[data-simple]', false), ...(desktop ? steps('html[data-simple]', true) : [])]);
    for (const [name, size] of standard) assert.ok((simple.get(name) ?? 0) >= size, `${desktop ? 'desktop' : 'phone'} ${name}: simple ${simple.get(name)}rem < standard ${size}rem`);
  }
});

test('share cards read the category map and the inks of the token sheet (--tc-* pairs, --color-ink*)', async () => {
  const { CARD_CHANNELS, CARD_INK, CARD_PALETTE } = await import('../src/lib/share-card-svg');
  // Every channel the cards carry is the sheet's own.
  for (const [name, channels] of Object.entries(CARD_CHANNELS)) assert.equal(channels, rgbOf(name).join(' '), `--color-${name}-rgb`);
  const hex = (rgb: number[]) => `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  const tc = new Map<string, string>();
  postcss.parse(tokensCss).walkDecls(/^--tc-[a-z]+-(bg|fg)$/, declaration => { if ((declaration.parent as postcss.Rule).selector === ':root') tc.set(declaration.prop, declaration.value.trim()); });
  for (const [tone, pair] of Object.entries(CARD_PALETTE)) for (const side of ['bg', 'fg'] as const) {
    const token = /^var\(--color-([a-z0-9-]+)\)$/.exec(tc.get(`--tc-${tone}-${side}`) ?? '')?.[1];
    assert.ok(token, `--tc-${tone}-${side} reads a palette colour`);
    assert.equal(pair[side].toUpperCase(), hex(rgbOf(token)), `${tone} ${side}`);
  }
  for (const [key, token] of [['ink', 'ink'], ['ink2', 'ink-2'], ['ink3', 'ink-3'], ['brand', 'brand'], ['brandDeep', 'brand-deep'], ['paper', 'bg']] as const) {
    assert.equal(CARD_INK[key], hex(rgbOf(token)), `CARD_INK.${key}`);
  }
  // Both card renderers take their inks from CARD_INK rather than hex literals of their own.
  for (const file of ['src/lib/share-card-svg.ts', 'src/lib/weekly-card-svg.ts']) assert.doesNotMatch(readFileSync(file, 'utf8'), /\bINK(?:_2|_3)? = '#/, file);
});

test('UI9-C covers: every type-cover ink is ≥ 4.5:1 on its ground, the status looks hold, and every deep shade has chroma C* ≥ 15', () => {
  // CIELAB chroma of an sRGB colour (D65).
  const chroma = (rgb: number[]) => {
    const [r, g, b] = rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    const xyz = [(r * .4124 + g * .3576 + b * .1805) / .95047, r * .2126 + g * .7152 + b * .0722, (r * .0193 + g * .1192 + b * .9505) / 1.08883];
    const f = (t: number) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
    const [fx, fy, fz] = xyz.map(f);
    return Math.hypot(500 * (fx - fy), 200 * (fy - fz));
  };
  const failures: string[] = [];
  const pairs: [string, string][] = [
    // the type-cover ground (sunken) and its text
    ['ink', 'surface-2'], ['ink-2', 'surface-2'], ['ink-3', 'surface-2'],
    // the calendar page's weekday band and the ticket value: white on each category's deep shade, the shade on white
    ...['warm', 'info', 'moss', 'warning', 'brand-hover', 'success'].flatMap(deep => [['surface', deep], [deep, 'surface']] as [string, string][]),
    // the headline slide and the shop sign (paper, lime and muted text on brand-deep), the number plate (white on brand)
    ['bg', 'brand-deep'], ['highlight', 'brand-deep'], ['on-brand-muted', 'brand-deep'], ['surface', 'brand'],
    // the status map: free, partial, soon, urgent, open, ended, neutral
    ['brand-deep', 'highlight'], ['brand-deep', 'surface'], ['danger', 'surface'], ['surface', 'danger'], ['brand-deep', 'brand-tint'], ['ink-3', 'surface-2'], ['ink-2', 'surface-2'],
    // the provenance chip
    ['ink-2', 'surface'],
  ];
  for (const [text, surface] of pairs) {
    const value = ratio(rgbOf(text), rgbOf(surface));
    if (value < 4.5) failures.push(`${text} on ${surface} ${value.toFixed(2)}:1`);
  }
  for (const deep of ['warm', 'info', 'moss', 'warning', 'brand-hover', 'success', 'brand', 'brand-deep', 'danger']) {
    const value = chroma(rgbOf(deep));
    if (value < 15) failures.push(`${deep} C* ${value.toFixed(1)} < 15`);
  }
  assert.deepEqual(failures, []);
});
