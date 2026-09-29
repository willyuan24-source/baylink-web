import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * W5-Z (the lead's final verify, docs/opus-bay/sf-w5-final-verify.md): the fixes it made.
 *
 * The find card (lane D's 小发现 · +10 金币, eggs/FactCard.tsx) sits in the phone's bottom-left thumb slot for 6 s like the
 * arrival card, and its timer waits while a pointer is on it: on the Golden Gate Bridge deck a thumb that came down on
 * it walked nowhere for as long as it stayed there. It now shares the thumb the way CP-12's arrival card does (a drag
 * steers, a tap still opens it); an opened card is a normal card again.
 */

const { THUMB_PASS } = await import('../src/opus-bay/actors/pointer');

test('W5-Z: the compact find card passes a thumb to the stick (a drag steers, a tap stays the card\'s); an opened one does not', () => {
  const { document } = new JSDOM(`<div class="ob-overlay">
    <section class="ob-arrival-card"><button id="arr">看介绍</button></section>
    <section class="ob-egg-card is-egg" id="compact"><button class="ob-egg-head" id="head">小发现</button><button class="ob-egg-close" id="x">×</button></section>
    <section class="ob-egg-card is-egg is-open" id="open"><button class="ob-egg-head" id="ohead">小发现</button><p id="fact">…</p></section>
    <div class="ob-toast" id="toast">+1 个地点</div>
  </div>`).window;
  const passes = (id: string) => !!document.getElementById(id)!.closest(THUMB_PASS);
  assert.ok(passes('arr'), 'the arrival card as before (CP-12)');
  assert.ok(passes('compact') && passes('head') && passes('x'), 'the compact find card and its buttons');
  assert.ok(!passes('open') && !passes('ohead') && !passes('fact'), 'an opened find card reads (and scrolls) as a card');
  assert.ok(!passes('toast'), 'nothing else');
  // the body lets touches through on touch screens; its buttons keep taps (and steer on a drag), like the arrival card
  const css = readFileSync(new URL('../src/opus-bay/opus-bay.css', import.meta.url), 'utf8');
  const coarse = css.slice(css.indexOf('checkpoint CP-12 · touch'));
  assert.match(coarse, /\.ob-overlay \.ob-egg-card:not\(\.is-open\) \{ pointer-events: none; \}/);
  assert.match(coarse, /\.ob-overlay \.ob-egg-card:not\(\.is-open\) button \{ pointer-events: auto; touch-action: none; \}/);
  assert.match(coarse, /\.ob-overlay\.is-sticking \.ob-egg-card:not\(\.is-open\) \{ opacity: \.3/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The Golden Gate Bridge deck's edges (the published city on disk, as lane F's tests load it)
// ---------------------------------------------------------------------------------------------------------------------

async function ggbCity() {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const T = await import('../src/opus-bay/core/terrain');
  const camera = await import('../src/opus-bay/actors/camera');
  const deck = await import('../src/opus-bay/actors/deckSteer');
  await camera.loadCityViews();
  const ggb = deck.decks().find(d => d.id === 'golden-gate-bridge');
  assert.ok(ggb, 'the city camera data registers the Golden Gate Bridge deck');
  const sf = sfDisk(), LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (let s = -40; s <= ggb.length + 40; s += 60) { const q = deck.deckPoint(ggb, s, 0); await sf.attachAround(city, q.x, q.z, 90, LMS); }
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return { T, camera, deck, ggb };
}

test('W5-Z: a thumb held off the axis on the GGB deck walks along the rail and never drops into the ragged edge under the sidewalk (it stood 1.8 u under the deck, boxed in)', async () => {
  const { T, deck, ggb } = await ggbCity();
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { game } = await import('../src/opus-bay/core/store');
  const { input } = await import('../src/opus-bay/core/input');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  game.set({ worldMode: 'city', phase: 'playing' });
  try {
    // the edge the phone found: heightAt blends the deck cells with the water below at the rails (0.5 u cells across a
    // deck at an angle), so the sidewalks' outer half is dotted with narrow low spots (1.8 u and more under the deck)
    let low = 0;
    for (let s = 5; s < ggb.length - 5; s += 0.25) for (const l of [-2.2, 2.2]) { const q = deck.deckPoint(ggb, s, l); if (T.heightAt(q.x, q.z) < ggb.y - 0.75) low++; }
    assert.ok(low > 50, `the ragged edge is there to be walked over (${low} low samples at |l| 2.2)`);
    const walk = (from: number, to: number, lateral: number, run: boolean) => {
      const c = new PlayerController(), p = runtime.player;
      const dir = to > from ? 1 : -1;
      const q = deck.deckPoint(ggb, from, 0);
      p.x = q.x; p.z = q.z; p.y = ggb.y; p.heading = ggb.heading + (dir > 0 ? 0 : Math.PI); p.locked = false; p.pathTarget = null;
      c.sync();
      // the camera behind along the axis (the deck rule), the stick pushed forward and `lateral` toward a rail
      const yaw = deck.deckCameraYaw(ggb, dir);
      const dt = 1 / 30;
      let minY = Infinity, lastS = from, t = 0, worstL = 0;
      for (let i = 0; i < 150 / dt; i++) {
        t += dt;
        runtime.input.moveX = lateral; runtime.input.moveY = Math.sqrt(1 - lateral * lateral); runtime.input.run = run; input.manualMove = true;
        c.step({ dt, now: t, cameraYaw: yaw, frozen: false, riding: false });
        minY = Math.min(minY, p.y);
        const at = deck.deckAt(p.x, p.z, p.y);
        if (at) { lastS = at.s; worstL = Math.max(worstL, Math.abs(at.l)); }
        if ((lastS - to) * dir >= 0) break;
      }
      runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; input.manualMove = false;
      return { reached: (lastS - to) * dir >= 0, minY, s: lastS, t, worstL };
    };
    for (const [from, to, lateral, run] of [[5, ggb.length - 5, 0.7, false], [5, ggb.length - 5, -0.7, true], [ggb.length - 5, 5, 0.7, true], [ggb.length - 5, 5, -0.5, false]] as const) {
      const r = walk(from, to, lateral, run);
      const tag = `${from < to ? 'S → N' : 'N → S'}, the stick ${lateral > 0 ? 'right' : 'left'} ${Math.round(Math.asin(Math.abs(lateral)) * 180 / Math.PI)}°${run ? ', running' : ''}`;
      assert.ok(r.minY >= ggb.y - 0.75, `${tag}: never under the deck (lowest ${r.minY.toFixed(2)} at s ${r.s.toFixed(1)}, deck ${ggb.y})`);
      assert.ok(r.reached, `${tag}: reached the far end (stopped at s ${r.s.toFixed(1)} after ${r.t.toFixed(0)} s)`);
      assert.ok(r.worstL > 1.9, `${tag}: it did walk along the rail (|l| up to ${r.worstL.toFixed(2)})`);
    }
  } finally { T.setCityTerrain(null); game.set({ worldMode: 'district', phase: 'title' }); }
});
