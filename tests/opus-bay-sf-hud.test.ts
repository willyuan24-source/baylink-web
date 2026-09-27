import assert from 'node:assert/strict';
import test from 'node:test';
import { type Box, overlaps, placeBubble, placeWaypoint, waypointBox } from '../src/opus-bay/game/hudLayout';

/**
 * Lane G1 (wave 3, M1 / DR-3): the projected bubble and waypoint keep out of the fixed HUD on a 390×844 phone —
 * the pills, the top stack (night-view banner, ride banner, goals card, toasts) and the bottom bar.
 */

const H = 844; // a 390 × 844 phone
const pills: Box[] = [{ l: 12, t: 12, r: 110, b: 46 }, { l: 244, t: 12, r: 378, b: 54 }];
const offer: Box = { l: 12, t: 62, r: 378, b: 118 };
const bar: Box = { l: 63, t: 780, r: 327, b: 838 };
const bubbleOf = (x: number, y: number, w: number, h: number): Box => ({ l: x - w / 2, r: x + w / 2, t: y - 10 - h, b: y - 10 });

test('bubble: a top box pushes it down, a bottom box pushes it up, then the screen clamp holds', () => {
  const boxes = [...pills, offer, bar];
  // anchor just under the banner: the bubble (60 tall) would cover it
  const a = placeBubble(200, 150, 230, 60, boxes, H, 130, H - 60);
  const ba = bubbleOf(a.x, a.y, 230, 60);
  assert.ok(boxes.every(o => !overlaps(ba, o)), `bubble ${JSON.stringify(ba)} clear of the top boxes`);
  assert.ok(ba.t >= offer.b, 'below the night-view banner');
  // anchor low: the bubble would reach into the bar
  const b = placeBubble(200, 830, 230, 60, boxes, H, 130, H - 60);
  const bb = bubbleOf(b.x, b.y, 230, 60);
  assert.ok(!overlaps(bb, bar), 'above the bottom bar');
  // nothing in the way: unchanged
  assert.deepEqual(placeBubble(200, 420, 230, 60, boxes, H, 130, H - 60), { x: 200, y: 420 });
});

test('waypoint: an edge arrow slides below the bubble along the edge; a pin on its target hides only its label', () => {
  const boxes = [...pills, bar];
  const bubble = bubbleOf(123, 436, 230, 62); // the M1 case: BAYBAY's bubble over the postcard-clue arrow at the left edge
  const edge = placeWaypoint({ x: 40, y: 419, edge: true, labelHalf: 130, labelDx: 100 }, boxes, bubble, H, 84, H - 59);
  assert.equal(edge.hidden, false);
  assert.equal(edge.hideLabel, false);
  assert.ok(!overlaps(waypointBox({ x: 40, y: edge.y, edge: true, labelHalf: 130, labelDx: 100 }), bubble), 'arrow + label clear of the bubble');
  assert.ok(edge.y > bubble.b, 'slid below it');
  const pin = placeWaypoint({ x: 150, y: 380, edge: false, labelHalf: 100, labelDx: 0 }, boxes, bubble, H, 84, H - 59);
  assert.equal(pin.y, 380, 'the pin stays on its target');
  assert.equal(pin.hideLabel, true);
});

test('waypoint: kept out of the fixed boxes, and it waits when no spot is free', () => {
  const card: Box = { l: 38, t: 174, r: 338, b: 456 };
  const toast: Box = { l: 101, t: 462, r: 275, b: 552 };
  const phoneBar: Box = { l: 56, t: 603, r: 320, b: 661 };
  // under the goals card, with toasts under it and the bar under those (375 × 667): no room → hidden
  const r = placeWaypoint({ x: 40, y: 420, edge: true, labelHalf: 130, labelDx: 100 }, [...pills, card, toast, phoneBar], null, 667, 84, 608);
  assert.equal(r.hidden, true);
  // only the banner in the way: pushed below it
  const s = placeWaypoint({ x: 200, y: 90, edge: false, labelHalf: 90, labelDx: 0 }, [...pills, offer, bar], null, H, 84, H - 59);
  assert.equal(s.hidden, false);
  assert.ok(!overlaps(waypointBox({ x: 200, y: s.y, edge: false, labelHalf: 90, labelDx: 0 }), offer, 5.9));
  assert.ok(s.y >= offer.b + 6);
});
