/**
 * W7-Q-review · the phone sheet's 320 px floor (opus-bay.css, W7-Q7) holds only at rest (`:not(.is-dragging)`): a finger
 * on the sheet's head adds `.is-dragging` and the height fell back to `--ob-sheet-h`, the snap's percentage — the sheet
 * dropped under the finger before it moved (the shop's 38 % snap: 320 → 252 px at 390 × 664, 320 → 210 px at 375 × 553;
 * the 35 % snap on the 390 × 844 hero phone: 320 → 295 px). The drag now starts from the height the sheet shows.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { SHEET_FLOOR_PX, sheetDragStart } from '../src/opus-bay/ui/sheetDrag';

const css = fs.readFileSync(new URL('../src/opus-bay/opus-bay.css', import.meta.url), 'utf8');
const common = fs.readFileSync(new URL('../src/opus-bay/ui/common.tsx', import.meta.url), 'utf8');

test('W7-Q-review a sheet held at its floor does not drop under the finger when the drag starts', () => {
  // the CSS floor this mirrors
  assert.ok(css.includes(`min(${SHEET_FLOOR_PX}px, calc(100dvh - var(--ob-st) - 40px))`), 'the CSS floor is SHEET_FLOOR_PX');
  // the shop (snap 38) at 390 × 664: shown 320 px (the floor), its snap is 252 px
  const h = sheetDragStart(38, 320, 664);
  assert.ok(Math.abs((h / 100) * 664 - 320) < 0.5, `the drag starts at the shown 320 px (got ${((h / 100) * 664).toFixed(1)})`);
  // 375 × 553 and the 35 % snap on the hero phone
  assert.ok(Math.abs((sheetDragStart(38, 320, 553) / 100) * 553 - 320) < 0.5);
  assert.ok(Math.abs((sheetDragStart(35, 320, 844) / 100) * 844 - 320) < 0.5);
  // above the floor nothing changes (70 % on any phone, the map's 78)
  assert.equal(sheetDragStart(70, 591, 844), 70);
  assert.equal(sheetDragStart(78, 0.78 * 664, 664), 78);
  // no measurement (or a zero one): the snap as before
  assert.equal(sheetDragStart(35, undefined, 844), 35);
  assert.equal(sheetDragStart(35, 0, 844), 35);
  assert.equal(sheetDragStart(35, 300, 0), 35);
  // never past the top
  assert.equal(sheetDragStart(100, 2000, 844), 100);
});

test('W7-Q-review the Sheet starts its drag from the shown height (ui/common.tsx)', () => {
  const down = /const onPointerDown = [\s\S]*?\n {2}\};/.exec(common)?.[0] ?? '';
  assert.ok(down, 'onPointerDown found');
  assert.match(down, /sheetDragStart\(/, 'the drag start is measured');
  assert.match(down, /getBoundingClientRect\(\)\.height/, 'from the sheet as shown');
});
