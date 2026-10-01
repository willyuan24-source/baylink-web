import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

/**
 * W8-Q-review (Ultra) · lane Q's phone fixes, re-checked. Each test names the finding it pins (sf-w8-Q.md "Review (Ultra)"):
 * Q-PL-1 the grip game under the ride banner in short landscape · Q-PL-2 the HUD pile-up left of a side sheet in short
 * landscape · Q-PL-3 the Metro card over the station strip in short landscape · Q-RC-1 the play chip in the top stack's band
 * (601–1080 px) · Q-RC-2 the waypoint × touch area · Q-RC-3 the map's tool column under a pinned card · Q-RC-4 / Q-PL-4 the
 * reusable overlap scan.
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = (p: string) => read(`src/opus-bay/${p}`);
/** the body of the first `@media <query> {` block after `marker` */
const mediaAfter = (src: string, marker: string, query: string) => {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `marker ${marker}`);
  const head = `@media ${query} {\n`;
  const start = src.indexOf(head, at);
  assert.ok(start >= 0, `@media ${query} after ${marker}`);
  return src.slice(start + head.length, src.indexOf('\n}', start));
};

test('Q-PL-1: in short landscape the grip game\'s canvas sits beside its controls, so the panel stays under the ride banner (W8-M-review\'s fix)', () => {
  const g = css('play/sfgames8.css');
  const block = mediaAfter(g, 'W8-M-review', '(max-height: 560px) and (min-width: 600px)');
  assert.match(block, /grid-template-areas: 'canvas head' 'canvas clock' 'canvas hint' 'canvas controls';/);
  assert.match(block, /\.ob-sfg-panel\.is-grip > \.ob-sfg-canvas \{ grid-area: canvas;/);
  // the grip panel is bottom-anchored on a phone; nothing hides the ride banner (it stays in view above the panel)
  assert.match(g, /\.ob-sfg-panel\.is-grip \{ top: auto; bottom: calc\(12px/);
  assert.doesNotMatch(g, /\.ob-topstack > \.ob-ride \{ visibility: hidden; \}/);
});

test('Q-PL-2: a phone on its side with a side sheet: the pills, the waypoint and the bubble wait under the sheet', () => {
  const block = mediaAfter(css('opus-bay.css'), 'Q-PL-2', '(min-width: 721px) and (max-height: 500px)');
  assert.match(block, /\.ob-overlay\.has-sheet :is\(\.ob-area, \.ob-objective, \.ob-waypoint, \.ob-bubble-anchor\) \{ visibility: hidden; \}/);
  // the desktop side-sheet rules this complements (the HUD column moves left of the sheet)
  assert.match(css('opus-bay.css'), /\.ob-overlay\.has-sheet \.ob-hud-buttons \{ right: calc\(var\(--ob-sheet-w, 452px\) \+ 16px\);/);
});

test('Q-PL-3: in short landscape the Metro card stays under the station strip', () => {
  const t = css('ui/transit-ui.css');
  const strip = /\.ob-subway-strip \{[^}]*top: calc\((\d+)px \+ var\(--ob-st, 0px\)\); height: (\d+)px;/.exec(t)!;
  const stripBottom = Number(strip[1]) + Number(strip[2]);
  const block = mediaAfter(t, 'Q-PL-3', '(max-height: 480px)');
  const m = /\.ob-subway-card \{ bottom: calc\((\d+)px \+ var\(--ob-sb, 0px\)\); max-height: calc\(100% - (\d+)px - var\(--ob-st, 0px\) - var\(--ob-sb, 0px\)\); overflow-y: auto;/.exec(block)!;
  const [bottom, cut] = [Number(m[1]), Number(m[2])];
  // the card's top is at least (cut − bottom) px from the top: clear of the strip with a gap
  assert.ok(cut - bottom >= stripBottom + 4, `card top ≥ ${cut - bottom} vs strip bottom ${stripBottom}`);
  // at 667 × 320 (and 844 × 340) the card (≈ 211 px with its 设置 row) fits without scrolling
  assert.ok(320 - cut >= 211, `${320 - cut} px for the card at 320 px tall`);
});

test('Q-RC-1: between 601 and 1080 px wide the play chip clears the two-line objective pill and the top stack starts under it', () => {
  const block = mediaAfter(css('opus-bay.css'), 'W8-Q12', '(min-width: 601px) and (max-width: 1080px)');
  const chipTop = Number(/\.ob-overlay \.ob-play-flight \{ top: calc\((\d+)px \+ var\(--ob-st\)\); \}/.exec(block)![1]);
  const stackTop = Number(/\.ob-overlay:has\(\.ob-play-flight\) \.ob-topstack \{ top: calc\((\d+)px \+ var\(--ob-st\)\); \}/.exec(block)![1]);
  // measured at 844 × 340 / 768 × 1024: the objective pill (two lines) ends at 67 px; the chip is 54 px tall
  assert.ok(chipTop > 67, `chip top ${chipTop} vs the objective's bottom 67`);
  assert.ok(stackTop >= chipTop + 54 + 6, `top stack ${stackTop} vs chip bottom ${chipTop + 54}`);
  // the default top stack (70 px; 62 under 720 px) is what the chip used to sit in
  assert.match(css('opus-bay.css'), /\.ob-topstack \{\n {2}position: absolute; left: 50%; top: calc\(70px \+ var\(--ob-st\)\);/);
});

test('Q-RC-2: the waypoint × keeps wave 7\'s 44 × 44 touch area on every pointer (no smaller coarse-pointer circle overrides it)', () => {
  assert.match(css('opus-bay.css'), /\.ob-waypoint-dismiss::before \{ content: ''; position: absolute; inset: -10px -4px -10px -16px; border-radius: 12px; \}/);
  assert.match(css('opus-bay.css'), /\.ob-waypoint-dismiss \{[^}]*width: 24px; height: 24px;/);
  // 24 + 4 + 16 = 44 wide, 24 + 10 + 10 = 44 tall
  for (const f of ['ui/guide-ui.css', 'ui/map-w4.css', 'opus-bay.css']) {
    const rules = css(f).match(/[^{}]*\.ob-waypoint-dismiss::before \{[^}]*\}/g) ?? [];
    assert.ok(rules.every(r => /inset: -10px -4px -10px -16px/.test(r)), `${f}: no other ::before for the × (${rules.length})`);
  }
});

test('Q-RC-3: a pinned card that caps the map\'s tool column below one column\'s height makes the reserved column two wide', () => {
  const map = css('ui/CityMap.tsx');
  assert.match(map, /const toolsFitOneColumn = \(count: number, touch: boolean, maxH: number\) => count \* \(touch \? 44 : 36\) \+ \(count - 1\) \* 8 <= maxH;/);
  assert.match(map, /const tallTools = !!size && size\.h >= \(coarse \? TALL_TOOLS_H_TOUCH : TALL_TOOLS_H\) && !toolsWrapPinned;/);
  assert.match(map, /const wrapPinned = pinned && !!size && !toolsFitOneColumn\(\(plan\?\.route \|\| trip\) \? 6 : 5, coarse, toolsMaxHeight\(size\.h, true\)\);/);
  assert.match(map, /useEffect\(\(\) => \{ setToolsWrapPinned\(wrapPinned\); \}, \[wrapPinned\]\);/);
  // the column carries is-two (and toolRight 106 / 90) whenever tallTools is false
  assert.match(map, /className=\{`ob-citymap-tools\$\{tallTools \? '' : ' is-two'\}/);
  // 390 × 844 with a card pinned: the cap measured 248 px; five 44 px tools need 252
  const column = (n: number, px: number) => n * px + (n - 1) * 8;
  assert.ok(column(5, 44) > 248 && column(5, 36) <= 248, 'W8-Q6 (44 px) made five tools wrap under a pinned card; 36 px did not');
});

test('Q-RC-4 / Q-PL-4: the reusable overlap scan starts each size as a fresh player, reports a goals step that did not open, rides the grip from a station and checks canvases', () => {
  const scan = read('scripts/opus-sf/qa/overlap-scan.mjs');
  assert.match(scan, /Storage\.clearDataForOrigin/);
  assert.match(scan, /surface: 'gstep \(did not open\)', n: 0, missing: true/);
  assert.match(scan, /summary, canvas'\)\]/, 'a canvas counts as a control');
  assert.match(scan, /const st = ob\.transit\.station\(l\.stops\[0\]\.station\); if \(st\) \(await imp\('game\/flow\.ts'\)\)\.teleportPlayer/);
  assert.match(scan, /writes <out>\/overlap-<lang>\.json/);
  assert.match(scan, /path\.join\(OUT, `overlap-\$\{LANG\}\.json`\)/);
});
