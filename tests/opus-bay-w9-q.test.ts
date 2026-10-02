import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

/**
 * W9-Q · phone & layout (sf-w9-lead.md §3 Q; the first-use review's 界面与交互 rows, w8 NEXT #9). The fixes are CSS, so these
 * tests pin the rules (no node test can lay CSS out); the live numbers before / after are in docs/opus-bay/sf-w9-Q.md.
 * `rules(css)` flattens a stylesheet into { media, selector, body } rows (comments dropped, nested @media joined by ' & ').
 */

const read = (p: string) => fs.readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

interface Rule { media: string; selector: string; body: string }
function rules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const walk = (text: string, media: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(inner, media ? `${media} & ${head.slice(6).trim()}` : head.slice(6).trim());
      else if (!head.startsWith('@')) for (const sel of head.split(/,(?![^(]*\))/)) out.push({ media, selector: sel.trim().replace(/\s+/g, ' '), body: inner.trim() });
      i = j;
    }
  };
  walk(src, '');
  return out;
}
/** the declarations of `selector` (exact, whitespace-normalised) under a media text containing every `media` part */
function decl(css: string, selector: string, media: string[] = []): string[] {
  return rules(css).filter(r => r.selector === selector && media.every(m => r.media.includes(m))).map(r => r.body);
}

test('rules(): flattens selectors and @media', () => {
  const r = rules('a, b:is(.x, .y) { color: red } @media (max-width: 9px) { .c { top: 0 } } /* x { } */');
  assert.deepEqual(r.map(x => [x.media, x.selector]), [['', 'a'], ['', 'b:is(.x, .y)'], ['(max-width: 9px)', '.c']]);
});

test('W9-Q1 (W8I-D-2): with a side sheet open the move chip centres left of the sheet (its box is an inline style)', () => {
  const chip = read('ui/MoveChip.tsx');
  assert.match(chip, /<div className="ob-move-chip" style=\{chipStyle\} role="status"/, 'the chip carries a class the overlay can place');
  const body = decl(read('opus-bay.css'), '.ob-overlay.has-sheet .ob-move-chip', ['(min-width: 721px)']).join(';');
  assert.match(body, /left: calc\(\(100% - var\(--ob-sheet-w, 452px\)\) \/ 2\) !important/);
  assert.match(body, /max-width: calc\(100% - var\(--ob-sheet-w, 452px\) - 120px\) !important/);
});

test('W9-Q2: on a wide desktop the HUD row stays a row beside a sheet (city), slides, and the prompt / chip step over it', () => {
  const css = read('opus-bay.css');
  const city = '.ob-overlay.has-sheet:has(.ob-area-lines)';
  assert.match(decl(css, `${city} .ob-hud-buttons`, ['(min-width: 1181px)']).join(), /flex-direction: row/);
  assert.match(decl(css, `${city} .ob-context`, ['(min-width: 1181px)']).join(), /bottom: calc\(86px \+ var\(--ob-sb\)\)/);
  assert.match(decl(css, `${city} .ob-context.is-lifted`, ['(min-width: 1181px)']).join(), /bottom: calc\(144px/);
  assert.match(decl(css, `${city} .ob-move-chip`, ['(min-width: 1181px)']).join(), /bottom: calc\(86px \+ var\(--ob-sb\)\) !important/);
  // the slide: `right` is in the transitions of the row and of the objective pill (the last plain rule of each wins)
  const last = (sel: string) => decl(css, sel).filter(b => /transition/.test(b)).pop() ?? '';
  assert.match(last('.ob-hud-buttons'), /right \.35s/);
  assert.match(last('.ob-objective'), /right \.35s/);
  // the old column rule beside a sheet is still there for 721–1180 px and for the district
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-hud-buttons', ['(min-width: 721px)']).join(), /flex-direction: column-reverse/);
  // the city marker exists only in the city's area pill
  assert.match(read('ui/GuideLayer.tsx'), /className="ob-area-lines"/);
});

test('W9-Q3: the first-visit time offer waits while the underground Metro layer is on', () => {
  assert.match(decl(read('opus-bay.css'), '.ob-overlay:has(.ob-subway.is-on) .ob-topstack > .ob-time-offer').join(), /display: none/);
});

test('W9-Q4 (lane M\'s request): the ride banner\'s pad row wraps', () => {
  const src = read('ui/RideBanner.tsx');
  const row = /const PAD_ROW: CSSProperties = \{([^}]*)\};/.exec(src)?.[1] ?? '';
  assert.match(row, /flexWrap: 'wrap'/);
  assert.match(row, /rowGap: 6/);
});

test('W9-Q5: five or more journal tabs stand in two rows (3 / 4 / 5 columns), never a hidden sideways scroll', () => {
  const css = read('ui/content-ui.css');
  const all = rules(css);
  const grid = all.filter(r => r.selector === '.ob-journal .ob-tabs.is-many').map(r => r.body).pop() ?? '';
  assert.match(grid, /display: grid/);
  assert.match(grid, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(grid, /overflow: visible/);
  assert.match(decl(css, '.ob-journal .ob-tabs.is-many:has(> button:nth-child(7))').join(), /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(decl(css, '.ob-journal .ob-tabs.is-many:has(> button:nth-child(9))').join(), /repeat\(5, minmax\(0, 1fr\)\)/);
  const btn = all.filter(r => !r.media && r.selector === '.ob-journal .ob-tabs.is-many:has(> button) > button').map(r => r.body).pop() ?? '';
  assert.match(btn, /flex-wrap: wrap/);
  assert.match(btn, /min-width: 0/, 'the old min-width: max-content is overridden by the later rule');
  assert.match(btn, /font-size: 13px/);
  // Journal.tsx still marks five or more tabs is-many
  assert.match(read('ui/Journal.tsx'), /const many = tabs\.length >= 5;/);
});

test('W9-Q6: a shop tile\'s name may take two lines (Int’l Orange was 3 px too wide on one)', () => {
  const css = read('economy/economy.css');
  const name = decl(css, '.ob-shop-name').pop() ?? '';
  assert.match(name, /white-space: normal/);
  assert.match(name, /-webkit-line-clamp: 2/);
});

test('W9-Q7: on touch the flyer\'s 带我去 is a 44 px button, the flyer tall enough to keep it under the date block', () => {
  const css = read('ui/event-go.css');
  const go = decl(css, '.ob-flyer .ob-flyer-go', ['(pointer: coarse)']).join();
  assert.match(go, /min-height: 44px/);
  const minW = Number(/min-width: (\d+)px/.exec(go)?.[1] ?? 0);
  assert.ok(minW >= 44, `min-width ${minW}`);
  assert.match(decl(css, '.ob-flyer.has-go > button:first-child', ['(pointer: coarse)']).join(), /min-height: 138px/);
});

test('W9-Q8: running text is ≥ 13 px on phones (fine print ≥ 12)', () => {
  const css = read('opus-bay.css');
  const block = rules(css).filter(r => r.media.includes('(max-width: 720px)') && r.selector.startsWith('.ob-overlay :is('));
  const sels = block.map(r => r.selector).join(' ');
  for (const cls of ['.ob-goals small', '.ob-card-hint', '.ob-today-main small', '.ob-today-note', '.ob-toggle-text small', '.ob-steps-text small', '.ob-album-note', '.ob-flyer-meta', '.ob-gstep-note']) assert.ok(sels.includes(cls), cls);
  assert.ok(block.every(r => /font-size: 13px/.test(r.body)));
  assert.match(decl(css, '.ob-overlay .ob-gstep-list li', ['(max-width: 720px)']).join(), /font-size: 13px/);
  assert.match(decl(css, '.ob-overlay .ob-today-src', ['(max-width: 720px)']).join(), /font-size: 12px !important/);
});

test('W9-Q9: the dialogue box never grows past the top of the screen; its choices scroll inside it', () => {
  const css = read('opus-bay.css');
  const box = rules(css).filter(r => r.selector === '.ob-dialogue-box' && r.media === '' && /max-height/.test(r.body)).pop()?.body ?? '';
  assert.match(box, /display: flex/);
  assert.match(box, /flex-direction: column/);
  assert.match(box, /max-height: calc\(100dvh - 46px - var\(--ob-sb\) - var\(--ob-st\)\)/);
  assert.match(decl(css, '.ob-dialogue-box', ['(max-width: 720px)']).join(), /max-height: calc\(100dvh - 70px/);
  const choices = decl(css, '.ob-dialogue-box > .ob-choices').join();
  assert.match(choices, /min-height: 0/);
  assert.match(choices, /overflow-y: auto/);
  // the choices are the box's own children in ui/Dialogue.tsx
  assert.match(read('ui/Dialogue.tsx'), /<div className="ob-dialogue-box"[\s\S]*?className=\{`ob-choices /);
});

test('W9-Q10: short landscape phones: compact sheet heads, the place card\'s footer in one row', () => {
  const css = read('opus-bay.css');
  const m = ['(max-width: 720px) and (max-height: 460px)'];
  assert.match(decl(css, '.ob-sheet-foot:has(> .ob-poi-foot-guide)', m).join(), /display: flex/);
  assert.match(decl(css, '.ob-sheet-foot > .ob-poi-foot-guide', m).join(), /flex: 1 1 auto/);
  assert.match(decl(css, '.ob-sheet-foot > .ob-poi-foot-guide .ob-guide-row', m).join(), /min-height: 44px/);
  assert.match(decl(css, '.ob-sheet-head', m).join(), /padding: 16px 8px 6px 18px/);
  assert.match(decl(css, '.ob-choices.is-grid', m).join(), /max-height: none/);
  // the footer markup the rule reads (PoiCardBody / PlaceCard): the guide row, then the actions
  assert.match(read('ui/PoiCardBody.tsx'), /<div className="ob-poi-foot-guide">\{guideRow\}<\/div>\}\s*<div className="ob-actions">/);
});

test('W9-Q11: narrow desktop windows with a sheet (175 % zoom): the prompt / move chip keep left of the HUD column, the objective on screen, the area pill waits', () => {
  const css = read('opus-bay.css');
  const m = ['(min-width: 721px) and (max-width: 1180px)'];
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-context', m).join(), /left: calc\(\(100% - var\(--ob-sheet-w, 452px\) - 76px\) \/ 2\)/);
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-context', m).join(), /max-width: calc\(100% - var\(--ob-sheet-w, 452px\) - 100px\)/);
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-move-chip', m).join(), /- 76px\) \/ 2\) !important/);
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-objective', m).join(), /max-width: calc\(100% - var\(--ob-sheet-w, 452px\) - 28px\)/);
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-objective-text strong', m).join(), /text-overflow: ellipsis/);
  assert.match(decl(css, '.ob-overlay.has-sheet:has(.ob-sheet.is-wide) .ob-area', ['(min-width: 721px) and (max-width: 1080px)']).join(), /visibility: hidden/);
  assert.match(decl(css, '.ob-overlay.has-sheet .ob-area', ['(min-width: 721px) and (max-width: 960px)']).join(), /visibility: hidden/);
  // the docked bubble is clamped on screen like the anchored one (game/Systems.tsx: one clamp after both branches)
  const sys = read('game/Systems.tsx');
  const i = sys.indexOf('if (offscreen) {');
  const clamp = sys.indexOf('x = Math.min(w - half, Math.max(half, x));', i);
  const place = sys.indexOf('const placed = placeBubble(', i);
  assert.ok(i > 0 && clamp > i && clamp < place, 'one clamp between the branches and placeBubble');
  assert.equal(sys.split('x = Math.min(w - half, Math.max(half, x));').length - 1, 1);
});

