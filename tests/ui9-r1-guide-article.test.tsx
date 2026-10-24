// UI9-R1-GUIDE-ARTICLE: the guide article's type ratio, measures, hover, icons, elder bar and lead layout (round-1 cold
// review: N02 N05 N13 N14 N18 N23 N25, J1 P23 P26, J2 P14 P15 P19, J3 P16 P20). The browser numbers (probe on guide-pillar
// and guide-elder) are in lanes/UI9-R1-GUIDE-ARTICLE/PR.md; these checks keep the rules that produce them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

const articleCss = readFileSync('src/features/guides/guide-article.css', 'utf8');
const article = postcss.parse(articleCss);
const tokens = postcss.parse(readFileSync('src/tokens.css', 'utf8'));

/** Declarations of every rule whose selector list contains `selector` (exact), with the media it sits in. */
function decls(selector: string) {
  const out: { prop: string; value: string; media: string; selector: string }[] = [];
  article.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    rule.walkDecls((d: Declaration) => { out.push({ prop: d.prop, value: d.value, media, selector: rule.selector }); });
  });
  return out;
}
const value = (selector: string, prop: string, media = '') => decls(selector).filter(d => d.prop === prop && d.media === media).at(-1)?.value;

// ---- the --fs-* steps on <html> for one case (specificity, then order; width media only), as in ui9-r1-foundation.test.ts ----
type Case = { width: number; reading?: 'large' | 'extra-large'; simple?: boolean };
const rootPx = (c: Case) => 16 * (c.reading === 'extra-large' ? 1.25 : c.reading === 'large' ? 1.125 : 1);
const mediaMatches = (params: string, width: number) => params.split(/\band\b/).every(part => {
  const min = /min-width:\s*(\d+)px/.exec(part); if (min) return width >= Number(min[1]);
  const max = /max-width:\s*(\d+)px/.exec(part); if (max) return width <= Number(max[1]);
  return false;
});
function specificity(selector: string): [number, number, number] {
  const total: [number, number, number] = [0, 0, 0];
  let i = 0;
  while (i < selector.length) {
    const c = selector[i];
    if (c === '.') { total[1]++; i++; while (/[\w-]/.test(selector[i] ?? '')) i++; }
    else if (c === '[') { total[1]++; i = selector.indexOf(']', i) + 1; }
    else if (c === ':') {
      i++; const name = /^[\w-]+/.exec(selector.slice(i))?.[0] ?? ''; i += name.length;
      if (selector[i] === '(') {
        let depth = 1; const open = i; i++;
        while (i < selector.length && depth) { if (selector[i] === '(') depth++; else if (selector[i] === ')') depth--; i++; }
        if (name === 'where') continue;
        if (['is', 'not'].includes(name)) { const inner = selector.slice(open + 1, i - 1).split(',').map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0]; total[0] += inner[0]; total[1] += inner[1]; total[2] += inner[2]; }
        else total[1]++;
      } else total[1]++;
    } else if (/[a-zA-Z]/.test(c)) { total[2]++; i += /^[\w-]+/.exec(selector.slice(i))![0].length; }
    else i++;
  }
  return total;
}
function fsPx(c: Case, token: string): number {
  const html = new JSDOM('<!doctype html><html lang="zh-Hans"><body></body></html>').window.document.documentElement;
  if (c.reading) html.setAttribute('data-reading', c.reading);
  if (c.simple) html.setAttribute('data-simple', '');
  const winners = new Map<string, { spec: [number, number, number]; value: string }>();
  tokens.walkRules((rule: Rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule') { const at = parent as AtRule; if (at.name !== 'media' || !mediaMatches(at.params, c.width)) return; }
    else if (parent && parent.type !== 'root') return;
    const matching = rule.selectors.filter(selector => { try { return html.matches(selector); } catch { return false; } });
    if (!matching.length) return;
    const spec = matching.map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    for (const node of rule.nodes) {
      if (node.type !== 'decl' || !node.prop.startsWith('--')) continue;
      const current = winners.get(node.prop);
      if (!current || (spec[0] - current.spec[0] || spec[1] - current.spec[1] || spec[2] - current.spec[2]) >= 0) winners.set(node.prop, { spec, value: node.value.trim() });
    }
  });
  const resolve = (name: string): string => { const raw = winners.get(name)?.value ?? ''; const alias = /^var\((--[\w-]+)\)$/.exec(raw)?.[1]; return alias ? resolve(alias) : raw; };
  const rem = /^(\d*\.?\d+)rem$/.exec(resolve(token));
  assert.ok(rem, `${token} resolves to rem at ${JSON.stringify(c)}`);
  return Number(rem![1]) * rootPx(c);
}

test('N02: a step heading is at least 1.25x the largest text of its step, phone and desktop, in every mode', () => {
  // The rules that pick the two sizes.
  const stepText = '.gd-article .gd-step :is(.bl-guide-prose>p,.bl-guide-bullet-list,.bl-guide-tip p)';
  assert.equal(value(stepText, 'font-size'), 'var(--fs-body)');
  assert.equal(value(`:is(html[data-reading=large],html[data-reading=extra-large],html[data-simple]) ${stepText}`, 'font-size'), 'var(--fs-reading)');
  assert.equal(value('.gd-step__head h2', 'font-size'), 'var(--fs-section)');
  assert.equal(value('.gd-step__head h2', 'font-size', '(min-width:1024px)'), 'var(--fs-keep-20)');
  assert.equal(value('html[data-simple] .gd-article .gd-step__head h2', 'font-size'), 'var(--fs-keep-24)');
  const cases: (Case & { label: string })[] = [];
  for (const width of [390, 768, 1440]) for (const mode of ['standard', 'large', 'extra-large', 'simple', 'family'] as const) cases.push({
    width, label: `${width} ${mode}`, reading: mode === 'large' ? 'large' : mode === 'extra-large' || mode === 'family' ? 'extra-large' : undefined, simple: mode === 'simple' || mode === 'family',
  });
  for (const c of cases) {
    const heading = fsPx(c, c.simple ? '--fs-keep-24' : c.width >= 1024 ? '--fs-keep-20' : '--fs-section');
    const text = Math.max(fsPx(c, c.reading || c.simple ? '--fs-reading' : '--fs-body'), fsPx(c, '--fs-body'));
    assert.ok(heading / text >= 1.25, `${c.label}: step ${heading}px / text ${text}px = ${(heading / text).toFixed(3)}`);
    // Elder modes keep the 17 px → elder reading step (never smaller than the article's other prose).
    if (c.reading || c.simple) assert.equal(text, fsPx(c, '--fs-reading'), `${c.label}: elder step text stays at --fs-reading`);
  }
});

test('N05: guide source notes keep 20em (mixed Chinese) and 32em (English)', () => {
  assert.equal(value('.gd-article .bl-guide-source-note', 'max-width'), '20em');
  assert.equal(value('.gd-article .bl-guide-source-note:lang(en)', 'max-width'), '32em');
});

test('N18 / N25 / J2 P14: one-row bar from 390 px in every mode, primary last, 问 BayBay; two rows only below 390 px', () => {
  const twoRow: string[] = [];
  article.walkDecls('flex', d => { if (d.value === '1 0 100%') twoRow.push(`${(d.parent!.parent as AtRule).params} ${(d.parent as Rule).selector.startsWith(':is(html') ? 'elder' : 'all'}`); });
  assert.deepEqual(twoRow, ['(max-width:389px) all'], 'the full-width call row only below 390 px (no 大 / 特大 / 简洁 rule up to 479 px)');
  const long = 'html .site-detail-actions.detail-actions.gd-bar .detail-actions__cell[data-cell=ask] [data-label=long]';
  assert.equal(value(long, 'display'), 'inline');
  assert.equal(value(long.replace('=long]', '=tight]'), 'display'), 'none');
  assert.equal(value(long, 'display', '(max-width:389px)'), undefined, 'no BayBay-only label on a narrow phone');
  // DETAIL's 家人版 swap to BayBay is (0,5,1); the guide's long label outranks it.
  assert.ok(specificity(long)[1] > specificity('html[data-reading=extra-large][data-simple] .site-detail-actions.detail-actions [data-label=long]')[1], 'outranks DETAIL');
  // Follow-up 1 / C P09 (UI9-R2-GUIDE): every cell label keeps one line, 问 BayBay included, in every mode and language.
  assert.equal(value('html .site-detail-actions.detail-actions.gd-bar .detail-actions__cell [data-label]', 'white-space'), 'nowrap');
  article.walkDecls('white-space', d => { if (/gd-bar/.test((d.parent as Rule).selector) && /data-label/.test((d.parent as Rule).selector)) assert.equal(d.value, 'nowrap', `${(d.parent as Rule).selector}: no wrapping label`); });
  assert.match(value('html:root:is([data-reading=large],[data-reading=extra-large],[data-simple]):has(.gd-bar)', '--site-mobile-nav-height', '(min-width:390px) and (max-width:1023px)') ?? '', /var\(--fs-meta\) \* 1\.3/);
  // 回到顶部 is not a third pinned layer at 大 / 特大 / 简洁 below a desktop.
  const toTop = ':is(html[data-reading=large],html[data-reading=extra-large],html[data-simple]) .gd-page .gd-to-top';
  assert.equal(value(toTop, 'position', '(max-width:1023px)'), 'static');
  assert.equal(value(`${toTop}::after`, 'content', '(max-width:1023px)'), 'attr(aria-label)');
  // 家人版 keeps 4 px bar sides; only a 1-800 call (data-long) takes them for its number.
  const family = 'html[data-reading=extra-large][data-simple] .site-detail-actions.detail-actions.gd-bar';
  assert.equal(value(family, 'padding-inline', '(min-width:390px) and (max-width:1023px)'), 'var(--sp-1)');
  assert.equal(value(`${family}:has(.gd-bar__call[data-long])`, 'padding-inline', '(min-width:390px) and (max-width:1023px)'), '0');
  // The short name BayBay in the phone bar only where one row has no room for 问 BayBay beside the number (390–429 px): not
  // on the two-row bar below 390 px, not from 430 px or on a tablet (R2-GUIDE round 3: by room, not by mode).
  const shortAt = new Set<string>();
  article.walkDecls('display', d => { const rule = d.parent as Rule; if (d.value === 'inline' && /\[data-cell=ask\] \[data-label=tight\]/.test(rule.selector) && !/gd-rail/.test(rule.selector)) shortAt.add((rule.parent as AtRule).params); });
  assert.deepEqual([...shortAt], ['(min-width:390px) and (max-width:429px)']);
});

test('Desktop rail: the three cells share one height and hold 问 BayBay / Ask BayBay on one line inside', () => {
  const rail = '.gd-rail .site-detail-actions.detail-actions.gd-bar';
  const desk = '(min-width:1024px)';
  assert.equal(value(rail, 'align-items', desk), 'stretch', 'the cell row stretches every cell to the tallest');
  const cells = `${rail} :is(button.detail-actions__cell,.detail-actions__cell .saves-toggle)`;
  assert.equal(value(cells, 'height', desk), 'auto', 'no fixed 56 px box in the rail');
  assert.equal(value(cells, 'min-height', desk), '56px');
  assert.equal(value(cells, 'line-height', desk), 'var(--lh-tight)');
  assert.equal(value(`${rail}>.detail-actions__cell[data-cell=save]>.saves-control`, 'display', desk), 'grid', 'the ♡ button fills its stretched cell');
  assert.equal(value(`${rail}>.detail-actions__cell[data-cell=save]>.saves-control`, 'align-items', desk), 'stretch', 'saves.css centres the ♡; the rail stretches it');
  assert.equal(value(`${rail} .detail-actions__cell[data-cell=ask] [data-label=long]`, 'white-space', desk), undefined, 'the rail lets no label wrap');
  // R2-GUIDE round 3: the ask cell (an equal grid track) is a size container; where its content box is narrower than its
  // label at its own size (4.66em 问 BayBay, 5.27em Ask BayBay: the 304 px rail at 1024 px in the large modes) it reads BayBay.
  assert.equal(value(`${rail} .detail-actions__cell[data-cell=ask]`, 'container', desk), 'gd-ask / inline-size');
  for (const [query, lang] of [['gd-ask (max-width:4.66em)', 'html:not(:lang(en))'], ['gd-ask (max-width:5.27em)', 'html:lang(en):not([data-reading=extra-large][data-simple])'], ['gd-ask (max-width:5.1em)', 'html[data-reading=extra-large][data-simple]:lang(en)']]) {
    assert.equal(value(`${lang} ${rail} .detail-actions__cell[data-cell=ask] [data-label=long]`, 'display', query), 'none', query);
    assert.equal(value(`${lang} ${rail} .detail-actions__cell[data-cell=ask] [data-label=tight]`, 'display', query), 'inline', query);
  }
  // Up to ~1360 px 回到顶部 sits over the rail column: the sticky stack ends above it.
  assert.match(value('.gd-rail__inner', 'max-height', '(min-width:1024px) and (max-width:1365px)') ?? '', /- 3rem - var\(--sp-6\) \* 3\)$/);
  // The rail is the only place outside the elder modes and English phones where the cells give up DETAIL's fixed height.
  const heightAuto: string[] = [];
  article.walkDecls('height', d => { if (d.value === 'auto' && /detail-actions__cell/.test((d.parent as Rule).selector)) heightAuto.push(`${(d.parent!.parent as AtRule).params}`); });
  assert.deepEqual(heightAuto.sort(), ['(min-width:1024px)', '(min-width:390px)']);
});

test('J2 P19 / J3 P20 / J2 P15: controls under the slide, the motif in its corner zone, larger source marks', () => {
  article.walkRules(rule => { if (/ui-carousel__controls/.test(rule.selector)) rule.walkDecls('position', d => assert.fail(`controls positioned: ${rule.selector} ${d.value}`)); });
  assert.doesNotMatch(articleCss, /6\.75rem/, 'no slide padding reserved for controls');
  assert.equal(value('.gd-slide__mark', 'stroke-width'), '1.75');
  assert.equal(value('.gd-slide__mark', 'bottom'), '-6cqw');
  // The safe zone is kept by the source and an answer right above it; the summary line keeps its width (no orphan 医保).
  assert.equal(value('.gd-slide--cover .gd-slide__source', 'padding-right'), '24cqw');
  assert.equal(value('.gd-slide--cover .gd-answer:has(+.gd-slide__source)', 'max-width'), 'calc(100% - 24cqw)');
  article.walkRules(rule => { if (/gd-slide__line/.test(rule.selector)) rule.walkDecls(/^padding/, d => assert.fail(`summary line inset: ${rule.selector} ${d.prop}:${d.value}`)); });
  assert.doesNotMatch(articleCss, /nth-last-child\(2\)/, 'no rule assumes the source is the last child');
  assert.equal(value('html[data-reading=extra-large] .gd-slide__mark', 'opacity'), '.07');
  assert.equal(value('.gd-source-mark', 'font-size'), 'var(--fs-card)');
  assert.equal(value('.gd-source-mark', 'vertical-align'), 'baseline');
  assert.equal(value('.gd-source-mark', 'min-height'), '1.5rem');
});

test('N13: article icons on three sizes (1 / 1.25 / 1.5rem) besides the corner mark', () => {
  const sizes = new Set<string>();
  article.walkRules(rule => {
    if (!/svg/.test(rule.selector) || /gd-slide__mark/.test(rule.selector)) return;
    rule.walkDecls(/^(width|height)$/, d => sizes.add(d.value));
  });
  assert.deepEqual([...sizes].sort(), ['1.25rem', '1.5rem', '1rem']);
});

test('N23: the slide numbers and the article links change on hover (pointer devices only)', () => {
  const hover: string[] = [];
  article.walkAtRules('media', at => { if (at.params === '(hover:hover) and (pointer:fine)') at.walkRules(rule => { if (rule.nodes.some(n => n.type === 'decl' && (n.prop === 'color' || n.prop === 'background' || n.prop.startsWith('text-decoration')))) hover.push(rule.selector); }); });
  const all = hover.join(' ');
  for (const part of ['.gd-slide__phone:hover', '.gd-meta a', '.bl-guide-toc a', '.gd-contact__places a', '.gd-article .gd-sources li>a', '.gd-source-mark', '.gd-diagram__tel']) assert.ok(all.includes(part), `${part} has a hover look`);
  article.walkRules(rule => { if (/:hover/.test(rule.selector)) assert.equal((rule.parent as AtRule).params, '(hover:hover) and (pointer:fine)', `${rule.selector} is gated`); });
});

test('R2-07 / J1 P26: the lead stacks from 768 px (16:7 picture, 30 秒看懂, one fixed-height slide row), one county list under 400 px', () => {
  // UI9-R2-GUIDE supersedes J1 P23 / J3 P16: no slide stretched beside 30 秒看懂, no two-column tablet lead.
  assert.equal(value('html:not([data-simple]):not([data-reading=extra-large]) .gd-page[data-pilot] .gd-lead__side>.gd-keyfacts', 'margin-bottom', '(min-width:1024px)'), undefined);
  assert.equal(value('html:not([data-simple]):not([data-reading=extra-large]) .gd-page[data-pilot] .gd-lead[data-visual]', 'grid-template-columns', '(min-width:768px) and (max-width:1023px)'), undefined);
  assert.equal(value('.gd-lead:not([data-scene3d]) .gd-cover.ui-cover', '--ui-cover-ratio', '(min-width:768px)'), '16 / 7');
  assert.equal(value('.gd-title__head', 'font-size', '(min-width:768px)'), 'var(--fs-display)');
  assert.equal(value('.gd-lead__story .ui-carousel__slide', 'flex', '(min-width:768px)'), '0 0 calc((100% - var(--grid-gutter)) / 2)');
  assert.equal(value('.gd-lead__story .ui-carousel__slide', 'flex-basis', '(min-width:1200px)'), 'calc((100% - 2 * var(--grid-gutter)) / 3)');
  assert.equal(value('.gd-lead__story .gd-slide', 'min-height', '(min-width:768px)'), '22.5rem');
  assert.equal(value('.gd-keyfacts ol', 'grid-template-columns', '(min-width:1024px)'), 'repeat(2, minmax(0, 1fr))');
  assert.equal(value('.gd-diagram__map', 'grid-template-columns', '(max-width:399px)'), 'minmax(0, 1fr)');
  assert.equal(value('html:not([data-reading=large]):not([data-reading=extra-large]):not([data-simple]) .gd-slide__phones[data-count=many] .gd-slide__phone-number', 'font-size'), 'var(--fs-body)');
});

test('标准 is html[data-reading=standard] after hydration: no rule keys it on a missing data-reading', () => {
  assert.doesNotMatch(articleCss, /:not\(\[data-reading\]\)/);
});

test('N14: guides-ui.css spacing is on the --sp steps (the ratchet rule: 0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px)', () => {
  const steps = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64, 96]);
  const off: string[] = [];
  postcss.parse(readFileSync('src/components/guides-ui.css', 'utf8')).walkDecls(/^(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z-]+)?$/, d => {
    for (const m of d.value.replace(/var\([^)]*\)/g, '').matchAll(/(?<![\w.-])-?(\d*\.?\d+)(px|rem|em)\b/g)) if (!steps.has(Number(m[1]) * (m[2] === 'px' ? 1 : 16))) off.push(`${(d.parent as Rule).selector} ${d.prop}:${d.value}`);
  });
  assert.deepEqual(off, []);
});
