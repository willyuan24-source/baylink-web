// D5 / RC-9 / RC-26: Aa scales the root font size, so every text size is in rem (px → rem codemod), --reading-scale is
// pinned at 1, and 简洁显示 floors relative text at 16px through the build's text-floor plugin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import { remNumber, rewriteCss, rewriteTsx, scaleViewportTerms, siteFiles, stripReadingScale } from '../scripts/codemods/px-to-rem.mjs';
import textFloor, { floorFontShorthand, floorFontSize, floorLineHeight } from '../scripts/postcss-text-floor.mjs';
import postcssConfig from '../postcss.config.js';

const tokens = postcss.parse(readFileSync('src/tokens.css', 'utf8'));
const declarations = (selector: string) => {
  const found = new Map<string, string>();
  tokens.walkRules(rule => { if (rule.selector === selector) for (const node of rule.nodes) if (node.type === 'decl') found.set(node.prop, node.value); });
  return found;
};

test('px → rem codemod: exact at the standard size, idempotent, and it keeps the stylesheet byte-for-byte otherwise', () => {
  assert.deepEqual([13, 10.5, 16, 22, 9.6].map(px => remNumber(px)), ['.8125', '.65625', '1', '1.375', '.6']);
  assert.equal(remNumber(11, true), '0.6875');
  const css = '.a{font-size:13px;color:red;padding:10px}\n@media (max-width:600px){.b { font-size: 10.5px !important; line-height:22px }}\n.c{font:400 12px/1.5 Arial,sans-serif}\n.d{font-size:0px}\n.e{font-size:max(16px,var(--text-body))}';
  const { text, changes } = rewriteCss(css);
  assert.equal(text, '.a{font-size:.8125rem;color:red;padding:10px}\n@media (max-width:600px){.b { font-size: .65625rem !important; line-height:1.375rem }}\n.c{font:400 .75rem/1.5 Arial,sans-serif}\n.d{font-size:0px}\n.e{font-size:max(1rem,var(--text-body))}');
  assert.equal(changes.length, 5);
  assert.equal(rewriteCss(text).changes.length, 0, 'idempotent');
});

test('the old reading-scale multiplier is removed, and a fluid heading\'s vw term carries --fluid-scale instead', () => {
  assert.equal(stripReadingScale('calc(2rem * var(--reading-scale))'), '2rem');
  assert.equal(stripReadingScale('calc(clamp(2.5rem,3.6vw,3.25rem) * var(--reading-scale))'), 'clamp(2.5rem,3.6vw,3.25rem)');
  assert.equal(stripReadingScale('calc(1rem + 2px * var(--reading-scale))'), 'calc(1rem + 2px)', 'a sum keeps its calc()');
  assert.equal(scaleViewportTerms('clamp(34px,4.3vw,56px)'), 'clamp(34px,calc(4.3vw * var(--fluid-scale)),56px)');
  assert.equal(rewriteCss('.h1{font-size:calc(clamp(2.5rem,3.6vw,3.25rem) * var(--reading-scale))}').text, '.h1{font-size:clamp(2.5rem,calc(3.6vw * var(--fluid-scale)),3.25rem)}');
  assert.equal(rewriteCss('.h2{font-size:clamp(30px, 4vw, 46px)}').text, '.h2{font-size:clamp(1.875rem, calc(4vw * var(--fluid-scale)), 2.875rem)}');
  assert.equal(rewriteCss('.w{width:4vw;font-size:1rem}').changes.length, 0, 'only text sizes change');
});

test('TSX: Tailwind arbitrary sizes with any variant and inline React sizes move to rem; a selector on the class follows', () => {
  assert.equal(rewriteTsx('<p className="text-[11px] sm:text-[13px] placeholder:text-[11px] leading-[20px] text-[#333] text-[1.2rem]" />').text,
    '<p className="text-[0.6875rem] sm:text-[0.8125rem] placeholder:text-[0.6875rem] leading-[1.25rem] text-[#333] text-[1.2rem]" />');
  assert.equal(rewriteTsx("<p style={{ fontSize: 13, margin: 0 }} /><h1 style={{ fontSize: '18px' }} /><i style={{ lineHeight: '20px' }} />").text,
    "<p style={{ fontSize: '0.8125rem', margin: 0 }} /><h1 style={{ fontSize: '1.125rem' }} /><i style={{ lineHeight: '1.25rem' }} />");
  assert.equal(rewriteTsx('ctx.font = x; const card = { fontSize: 64 };', { inlineStyles: false }).changes.length, 0, 'a .ts fontSize is SVG or canvas geometry');
  assert.equal(rewriteCss('.dialog [class*="text-[11px]"]{font-size:var(--text-fact)}').text, '.dialog [class*="text-[0.6875rem]"]{font-size:var(--text-fact)}');
  assert.equal(rewriteCss('.chip{@apply px-3 text-[11px] font-normal}').text, '.chip{@apply px-3 text-[0.6875rem] font-normal}');
});

test('the site stays codemod-clean: no px text size and no --reading-scale multiplier outside the 3D surfaces', () => {
  const files = siteFiles() as string[];
  assert.ok(files.some(file => file.replaceAll('\\', '/') === 'src/tokens.css'));
  assert.ok(!files.some(file => /^src\/opus-bay\/|little-bay|OpusBayShell\.tsx$/i.test(file.split('\\').join('/'))), 'the game and Little Bay keep their px HUD');
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.deepEqual((file.endsWith('.css') ? rewriteCss(source) : rewriteTsx(source, { inlineStyles: file.endsWith('.tsx') })).changes, [], file);
  }
});

test('tokens: the root carries Aa (100 / 112.5 / 125%), --reading-scale is pinned at 1, and text tokens are plain rem', () => {
  assert.equal(declarations('html').get('font-size'), '100%');
  assert.equal(declarations('html[data-reading=large]').get('font-size'), '112.5%');
  assert.equal(declarations('html[data-reading=extra-large]').get('font-size'), '125%');
  const root = declarations(':root');
  assert.equal(root.get('--reading-scale'), '1');
  for (const token of ['--text-caption', '--text-fact', '--text-body', '--text-reading', '--text-card', '--text-section']) assert.match(root.get(token) || '', /^[\d.]+rem$/, token);
  tokens.walkDecls('--reading-scale', declaration => assert.equal(declaration.value, '1', `${(declaration.parent as postcss.Rule).selector} must not re-scale (125% x 1.25 = 156%)`));
  assert.equal(declarations('html:has(.ob-page,#opus-bay-shell)').get('font-size'), '100%', 'the 3D world keeps its HUD at every size');
});

test('large text and 简洁显示 turn two-up phone feeds into one column through the class hook', () => {
  let hooked = false;
  tokens.walkAtRules('media', media => {
    if (!/max-width:\s*767px/.test(media.params)) return;
    media.walkRules(rule => {
      if (!rule.selector.includes('.feed-auto-cols')) return;
      assert.match(rule.selector, /\[data-reading=large\]/); assert.match(rule.selector, /\[data-reading=extra-large\]/); assert.match(rule.selector, /\[data-simple\]/);
      rule.walkDecls('grid-template-columns', declaration => { hooked = declaration.value === 'minmax(0,1fr)' && declaration.important === true; });
    });
  });
  assert.ok(hooked);
});

test('简洁显示 text floor: relative sizes below 1rem get max(size, var(--text-floor)); --text-floor is 0 unless data-simple', () => {
  assert.equal(floorFontSize('.75rem'), 'max(.75rem, var(--text-floor, 0px))');
  assert.equal(floorFontSize('0.6875rem'), 'max(0.6875rem, var(--text-floor, 0px))');
  assert.equal(floorFontSize('80%'), 'max(80%, var(--text-floor, 0px))');
  assert.equal(floorFontSize('.9em'), 'max(.9em, var(--text-floor, 0px))');
  for (const value of ['1rem', '1.125rem', '100%', '1em', 'var(--text-caption)', '12px', 'inherit', 'clamp(1rem,2vw,2rem)']) assert.equal(floorFontSize(value), null, value);
  assert.equal(floorLineHeight('1rem'), 'max(1rem, calc(var(--text-floor, 0px) * 1.375))');
  assert.equal(floorLineHeight('1.5'), null);
  assert.equal(floorFontShorthand('600 .75rem/1.4 sans-serif'), '600 max(.75rem, var(--text-floor, 0px))/1.4 sans-serif');
  const built = postcss([textFloor()]).process('.a{font-size:.75rem!important;line-height:1rem}.b{font-size:1rem}', { from: 'C:/x/src/a.css' }).css;
  assert.equal(built, '.a{font-size:max(.75rem, var(--text-floor, 0px))!important;line-height:max(1rem, calc(var(--text-floor, 0px) * 1.375))}.b{font-size:1rem}');
  assert.equal(postcss([textFloor()]).process('.hud{font-size:.75em}', { from: 'C:\\x\\src\\opus-bay\\ui\\hud.css' }).css, '.hud{font-size:.75em}', 'the game CSS is untouched');
  assert.equal(postcss([textFloor()]).process('.hud{font-size:.75em}', { from: 'C:/x/src/styles/little-bay.css' }).css, '.hud{font-size:.75em}');
  assert.ok((postcssConfig as { plugins: Array<{ postcssPlugin?: string }> }).plugins.some(plugin => plugin.postcssPlugin === 'baylink-text-floor'), 'the build runs the floor after Tailwind');
  assert.equal(declarations(':root').get('--text-floor'), '0px');
  const simple = declarations('html[data-simple]');
  assert.equal(simple.get('--text-floor'), '1rem');
  for (const token of ['--text-caption', '--text-fact']) assert.equal(simple.get(token), '1rem', token);
  assert.equal(simple.get('--control-height'), '3rem', '48px targets');
  assert.match(simple.get('--site-mobile-nav-height') || '', /^calc\(4\.75rem/, '76px tab bar');
});
