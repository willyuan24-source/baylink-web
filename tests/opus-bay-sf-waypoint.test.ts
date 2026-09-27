import assert from 'node:assert/strict';
import test from 'node:test';
import { viewDir } from '../src/opus-bay/game/flags';
import {
  type Box, CHEVRONS, WAYPOINT, YawTurn, chevronPoses, freeHintSuppressed, layoutWaypoint, occludedByTerrain, overlaps, placeEdge,
  routeRemaining, turnYawToward, waypointSafeArea, waypointSeconds,
} from '../src/opus-bay/game/waypoint';

/**
 * Lane G (W4-G2 / W4-G6): the waypoint's pure layout and time (plan §4.2; acceptance `sf-waypoint`): at 390 × 844 and
 * 375 × 667 the pin and label stay in the safe area and never intersect a docked bubble (nor the fixed HUD); the time is
 * the remaining route / 4.2 or the trip's remaining seconds; the edge-arrow turn; the chevrons.
 */

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const inside = (a: Box, area: Box) => a.l >= area.l - 1e-6 && a.r <= area.r + 1e-6 && a.t >= area.t - 1e-6 && a.b <= area.b + 1e-6;

test('time: the trip plan\'s remaining seconds, else the remaining route / 4.2 (+ back onto it), else straight × 1.25', () => {
  const pos = { x: 0, z: 0 }, target = { x: 100, z: 0 };
  assert.equal(waypointSeconds({ pos, target, tripLeft: 42, path: [0, 0, 100, 0] }), 42);
  // an L-shaped route 0,0 → 60,0 → 60,80; the player 3 u off it at (20, 3): remaining 40 + 80 = 120, + 3 back onto it
  const path = [0, 0, 60, 0, 60, 80];
  assert.ok(near(waypointSeconds({ pos: { x: 20, z: 3 }, target: { x: 60, z: 80 }, path }), (120 + 3) / 4.2));
  assert.ok(near(waypointSeconds({ pos, target }), (100 * 1.25) / 4.2));
  assert.ok(near(waypointSeconds({ pos, target, path: null, tripLeft: null }), (100 * 1.25) / 4.2));
  // routeRemaining: the projection, the segment, the offset; a hint segment keeps it from jumping back
  const r = routeRemaining(path, { x: 62, z: 30 });
  assert.equal(r.seg, 1);
  assert.ok(near(r.length, 50) && near(r.off, 2));
  const loop = [0, 0, 50, 0, 50, 10, 0, 10, 0, 1];
  assert.equal(routeRemaining(loop, { x: 1, z: 0.4 }).seg, 0);
  assert.equal(routeRemaining(loop, { x: 1, z: 0.4 }, 3).seg, 3, 'from the hint on, the route end wins');
});

test('safe area: x ∈ [12, w − 12] (left of a dock column), y ∈ [72, h − 124] on phones, [80, h − 120] on desktop', () => {
  assert.deepEqual(waypointSafeArea({ w: 390, h: 844, phone: true }), { l: 12, t: 72, r: 378, b: 720 });
  assert.deepEqual(waypointSafeArea({ w: 375, h: 667, phone: true }), { l: 12, t: 72, r: 363, b: 543 });
  assert.deepEqual(waypointSafeArea({ w: 1440, h: 900, phone: false }), { l: 12, t: 80, r: 1428, b: 780 });
  assert.equal(waypointSafeArea({ w: 1000, h: 700, phone: false, dockLeft: 930 }).r, 924);
});

test('edge: the pin on an on-screen target, the arrow on the area edge toward an off-screen one (mirrored behind)', () => {
  const area = waypointSafeArea({ w: 390, h: 844, phone: true });
  const on = placeEdge(200, 400, false, area);
  assert.deepEqual([on.x, on.y, on.edge], [200, 400, false]);
  const right = placeEdge(900, 396, false, area);
  assert.equal(right.edge, true);
  assert.ok(near(right.x, area.r - WAYPOINT.arrowR));
  assert.ok(Math.abs(right.angle) < 0.2);
  // behind the camera, projected to the lower left: mirrored to the upper right
  const back = placeEdge(100, 700, true, area);
  assert.equal(back.edge, true);
  assert.ok(back.x > 195 && back.y < 396);
});

/** the phone's fixed HUD (opus-bay.css at 390 / 375 px): area pill, objective pill, phone bar, the touch action */
const phoneHud = (w: number, h: number): Box[] => [
  { l: 12, t: 12, r: 12 + Math.min(0.42 * w, 170), b: 46 },
  { l: w - 12 - Math.min(0.48 * w, 250), t: 12, r: w - 12, b: 58 },
  { l: w / 2 - 131, t: h - 6 - 56, r: w / 2 + 131, b: h - 6 },
  { l: w - 16 - 64, t: h - 72 - 64, r: w - 16, b: h - 72 },
];
/** BAYBAY's bubble docked on phones (Systems.tsx: x = w / 2, anchor y = max(minY, 0.2 h), 250 × 48, hangs 10 px above) */
const dockedBubble = (w: number, h: number): Box => {
  const bw = 250, bh = 48, minY = 58 + 10 + bh + 10, ay = Math.max(minY, h * 0.2);
  return { l: w / 2 - bw / 2, t: ay - 10 - bh, r: w / 2 + bw / 2, b: ay - 10 };
};

for (const [w, h] of [[390, 844], [375, 667]] as const) {
  test(`layout ${w} × ${h}: pin and label always in the safe area, never on the docked bubble or the fixed HUD`, () => {
    const area = waypointSafeArea({ w, h, phone: true });
    const boxes = phoneHud(w, h);
    const bubbles: (Box | null)[] = [null, dockedBubble(w, h), { l: w / 2 - 125, t: h * 0.45 - 58, r: w / 2 + 125, b: h * 0.45 - 10 }];
    let n = 0, full = 0, hidden = 0;
    for (const bubble of bubbles) {
      for (let x = -240; x <= w + 240; x += 23) {
        for (let y = -240; y <= h + 240; y += 29) {
          for (const behind of [false, true]) {
            const L = layoutWaypoint({ x, y, behind, area, labelW: 150, bubble, boxes });
            n++;
            if (L.hidden) { hidden++; continue; }
            assert.ok(inside(L.pin, area), `pin out of the area at ${x},${y}`);
            if (bubble) assert.ok(!overlaps(L.pin, bubble), `pin under the bubble at ${x},${y}`);
            for (const b of boxes) assert.ok(!overlaps(L.pin, b), `pin under the HUD at ${x},${y}`);
            if (L.label.box) {
              assert.ok(inside(L.label.box, area), `label out of the area at ${x},${y}`);
              if (bubble) assert.ok(!overlaps(L.label.box, bubble), `label under the bubble at ${x},${y} (${L.label.mode})`);
              for (const b of boxes) assert.ok(!overlaps(L.label.box, b), `label under the HUD at ${x},${y}`);
              if (L.label.mode === 'full') full++;
            }
          }
        }
      }
    }
    // the rules must not make the waypoint useless: almost always shown, mostly with its full label
    // (measured: ≥ 99 % full labels, ≤ 1 % hidden — a pin on its target right under the bubble waits a frame)
    assert.ok(hidden / n < 0.03, `hidden ${hidden} / ${n}`);
    assert.ok(full / (n - hidden) > 0.95, `full labels ${full} / ${n - hidden}`);
  });
}

test('bubble over the label of a pin: the label drops below the bubble, else shows the time only, else the pin alone', () => {
  const area = waypointSafeArea({ w: 390, h: 844, phone: true });
  // pin at (195, 300) (box 291–309, + the 6 px gap); its label would be 316–341; the bubble covers the label, not the pin
  const bubble: Box = { l: 90, t: 318, r: 300, b: 352 };
  const L = layoutWaypoint({ x: 195, y: 300, behind: false, area, labelW: 150, bubble });
  assert.equal(L.edge, false);
  assert.equal(L.label.mode, 'full');
  assert.ok(L.label.box!.t >= bubble.b, 'dropped below the bubble');
  // a tall bubble (dropping would be > 90 px) but narrow: the short label fits beside? no — under it is blocked, so none
  const tall: Box = { l: 90, t: 318, r: 300, b: 460 };
  assert.equal(layoutWaypoint({ x: 195, y: 300, behind: false, area, labelW: 150, bubble: tall }).label.mode, 'none');
  // a bubble covering only the wide label's left edge: the short label (time only) fits
  const edgeBubble: Box = { l: 60, t: 318, r: 150, b: 470 };
  const S = layoutWaypoint({ x: 195, y: 300, behind: false, area, labelW: 160, bubble: edgeBubble });
  assert.equal(S.label.mode, 'short');
  assert.ok(!overlaps(S.label.box!, edgeBubble));
  // the pin itself under the bubble: hidden this frame (it never sits under it)
  assert.equal(layoutWaypoint({ x: 195, y: 330, behind: false, area, labelW: 150, bubble }).hidden, true);
});

test('an edge arrow slides along its edge to clear the bubble', () => {
  const area = waypointSafeArea({ w: 390, h: 844, phone: true });
  const bubble: Box = { l: 250, t: 380, r: 390, b: 440 };
  const L = layoutWaypoint({ x: 1200, y: 400, behind: false, area, labelW: 140, bubble });
  assert.equal(L.edge, true);
  assert.ok(!overlaps(L.pin, bubble) && !overlaps(L.label.box!, bubble));
  assert.equal(L.label.mode, 'full');
  assert.ok(Math.abs(L.x - (area.r - WAYPOINT.arrowR)) < 1, 'still on the right edge');
});

test('occluded on-screen targets: 70 % and a notch; edge arrows never', () => {
  const area = waypointSafeArea({ w: 1440, h: 900, phone: false });
  const on = layoutWaypoint({ x: 700, y: 400, behind: false, area, labelW: 160, bubble: null, occluded: true });
  assert.equal(on.opacity, WAYPOINT.occludedOpacity);
  assert.equal(on.notch, true);
  const off = layoutWaypoint({ x: 3000, y: 400, behind: false, area, labelW: 160, bubble: null, occluded: true });
  assert.equal(off.opacity, 1);
  assert.equal(off.notch, false);
});

test('tap on the edge arrow: the camera turns to the target over 0.6 s, the short way round', () => {
  const player = { x: 0, z: 0 }, target = { x: 100, z: 100 };
  const yaw = turnYawToward(player, target);
  const v = viewDir(yaw);
  assert.ok(near(v.x, Math.SQRT1_2) && near(v.z, Math.SQRT1_2), 'the camera then looks at the target');
  const turn = new YawTurn(3.0, -3.0);
  assert.ok(Math.abs(turn.delta) < 0.3, 'across ±π the short way');
  let y = turn.yaw;
  for (let i = 0; i < 30; i++) y = turn.step(1 / 60);
  assert.equal(turn.done, false);
  for (let i = 0; i < 10; i++) y = turn.step(1 / 60);
  assert.equal(turn.done, true);
  assert.ok(near(Math.cos(y), Math.cos(-3.0)) && near(Math.sin(y), Math.sin(-3.0)));
  assert.equal(new YawTurn(0, 1).duration, WAYPOINT.turnSeconds);
});

test('occlusion: a ridge between the eye and the target; unknown ground never occludes', () => {
  const ridge = (x: number) => (x > 40 && x < 60 ? 30 : 0);
  assert.equal(occludedByTerrain({ x: 0, y: 10, z: 0 }, { x: 100, y: 10, z: 0 }, x => ridge(x)), true);
  assert.equal(occludedByTerrain({ x: 0, y: 40, z: 0 }, { x: 100, y: 40, z: 0 }, x => ridge(x)), false);
  assert.equal(occludedByTerrain({ x: 0, y: 10, z: 0 }, { x: 100, y: 10, z: 0 }, () => null), false);
});

test('the soft free hint waits during trips, tours and panoramas and for 60 s after an arrival', () => {
  assert.equal(freeHintSuppressed({ nowMs: 1e6 }), false);
  assert.equal(freeHintSuppressed({ trip: true, nowMs: 0 }), true);
  assert.equal(freeHintSuppressed({ tour: true, nowMs: 0 }), true);
  assert.equal(freeHintSuppressed({ panorama: true, nowMs: 0 }), true);
  assert.equal(freeHintSuppressed({ lastArrivalMs: 1000, nowMs: 60_999 }), true);
  assert.equal(freeHintSuppressed({ lastArrivalMs: 1000, nowMs: 61_000 }), false);
});

test('chevrons: 3 points 2, 4 and 6 u ahead along the route, with its heading; fewer near the end', () => {
  const path = [0, 0, 3, 0, 3, 20];
  const c = chevronPoses(path, { x: 0, z: 0.5 });
  assert.equal(c.length, CHEVRONS.count);
  assert.ok(near(c[0].x, 2) && near(c[0].z, 0));
  assert.ok(near(c[1].x, 3) && near(c[1].z, 1), 'round the corner');
  assert.ok(near(c[2].x, 3) && near(c[2].z, 3));
  assert.ok(near(c[0].heading, Math.PI / 2) && near(c[2].heading, 0));
  assert.equal(chevronPoses(path, { x: 3, z: 16 }).length, 2, '4 u left: 2 and 4 u only');
  assert.deepEqual(chevronPoses([0, 0], { x: 0, z: 0 }), []);
});
