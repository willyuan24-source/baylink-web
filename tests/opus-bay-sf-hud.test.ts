import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { type TransitFileJson, buildTransit, setTransitData } from '../src/opus-bay/data/transit';
import { type Box, overlaps, placeBubble, placeWaypoint, waypointBox } from '../src/opus-bay/game/hudLayout';
import { transitGlyph } from '../src/opus-bay/ui/transitGlyph';

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

test("prompt glyph (lane F's request): city stations show the cable car, a ferry pier the ferry, nothing else changes", () => {
  const file = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as TransitFileJson;
  const data = buildTransit(file);
  setTransitData(data);
  try {
    const st = data.stations[0];
    assert.equal(transitGlyph({ id: `transit-${st.id}`, source: 'transit', refId: st.id }), 'cable-car');
    const tt = data.turntables[0];
    assert.equal(transitGlyph({ id: `transit-push-${tt.id}`, source: 'transit', refId: tt.id }), 'cable-car', 'the turntable push');
    assert.equal(transitGlyph({ id: 'transit-ferry-building-gangway', source: 'transit', refId: 'ferry-building' }), 'ferry');
    assert.equal(transitGlyph({ id: 'f-line-stop', source: 'poi' }), undefined, 'the district F-line stop keeps the tram');
  } finally { setTransitData(null); }
});

test('W4 integration (routed F w3 a / b): F-line stations show the streetcar, Pier 41 the ferry, lane T\'s stops the bus / metro', () => {
  const file = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as TransitFileJson;
  const data = buildTransit(file);
  setTransitData(data);
  try {
    // the city F-line's own stations are `f-<street>` (data/fline.ts); transitStation knows only the cable-car stations
    assert.equal(transitGlyph({ id: 'transit-f-castro-st-market-st', source: 'transit', refId: 'f-castro-st-market-st' }), 'streetcar');
    // ferry terminals by ferryTerminal(refId): Pier 41 has no "ferry" in its id
    assert.equal(transitGlyph({ id: 'transit-pier-41', source: 'transit', refId: 'pier-41' }), 'ferry');
    assert.equal(transitGlyph({ id: 'transit-ferry-building', source: 'transit', refId: 'ferry-building' }), 'ferry');
    // lane T's lines: the loop's Ferry Building stop is a bus stop, not a ferry
    assert.equal(transitGlyph({ id: 'transit-loop-ferry-building', source: 'transit', refId: 'loop-ferry-building' }), 'bus');
    assert.equal(transitGlyph({ id: 'transit-muni-embarcadero', source: 'transit', refId: 'muni-embarcadero' }), 'metro');
    // a cable-car station keeps its glyph
    const st = data.stations[0];
    assert.equal(transitGlyph({ id: `transit-${st.id}`, source: 'transit', refId: st.id }), 'cable-car');
  } finally { setTransitData(null); }
});
