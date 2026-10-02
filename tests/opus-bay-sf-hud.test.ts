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

// ---------------------------------------------------------------------------------------------------------------
// Wave 5 · W5-F3 (plan MF3, owner F3): 起飞 always there on foot after the unlock; the routed wave-3 G items
// ---------------------------------------------------------------------------------------------------------------

const OB = path.resolve(import.meta.dirname, '../src/opus-bay');
const srcOf = (f: string) => fs.readFileSync(path.join(OB, f), 'utf8');

test('W5-F3 · 起飞 on the phone: shown on foot once unlocked whatever the focus (BAYBAY in talk range included); hidden only in a dialogue, a panel, a cinematic / fishing / the postcard reward or off foot', () => {
  const s = srcOf('actors/TouchControls.tsx');
  const line = s.split('\n').find(l => l.includes("mode === 'foot' && unlocked"));
  assert.ok(line, 'the 起飞 slot');
  assert.doesNotMatch(line, /focus/, 'no focus rule on 起飞 (BAYBAY in range is usually the focus: 7 of 23 samples)');
  assert.doesNotMatch(s, /useGame\(s => s\.focus\)/, 'the move column does not read the focus at all');
  assert.match(s, /if \(dialogue \|\| panel \|\| busy\) return null;/, 'the column hides in a dialogue, a panel, a cinematic, fishing or the reward');
  assert.match(s, /const busy = useFlow\(s => !!s\.cinematic \|\| !!s\.fishing \|\| !!s\.postcardReward\)/);
});

test('W5-F3 · the 起飞 pulse: an unlock during play pulses once, a save restored while the world mounts does not; lane C / A ask with pulseGlideButton', async () => {
  const moveApi = await import('../src/opus-bay/actors/moveApi');
  const now = { t: 1_000_000 };
  const real = performance.now.bind(performance);
  (performance as { now: () => number }).now = () => now.t;
  try {
    const m = { carried: false, glideUnlocked: false, toFoot() {}, setGlideUnlocked(v: boolean) { this.glideUnlocked = v; } };
    moveApi.setGlideUnlocked(true);             // a restore before the bind
    const p0 = moveApi.glidePulseSeq();
    moveApi.bindMoveApi(m);
    moveApi.notifyGlide();
    assert.equal(moveApi.glidePulseSeq(), p0, 'no pulse for a restore at load');
    moveApi.setGlideUnlocked(false);
    now.t += 60_000;                            // a minute of play later: the pelican moment
    moveApi.setGlideUnlocked(true);
    assert.equal(moveApi.glidePulseSeq(), p0 + 1, 'the unlock in play pulses');
    moveApi.notifyGlide();
    assert.equal(moveApi.glidePulseSeq(), p0 + 1, 'once');
    moveApi.pulseGlideButton();
    assert.equal(moveApi.glidePulseSeq(), p0 + 2, 'asked again (先试试起飞？)');
    moveApi.bindMoveApi(null);
  } finally { (performance as { now: () => number }).now = real; }
  // the pulse is a CSS ring (a glow with reduced motion) on the 起飞 slot, keyed by the count
  assert.match(srcOf('actors/TouchControls.tsx'), /key=\{pulse\} className=\{pulse \? 'ob-glide-slot ob-glide-pulse'/);
  const css = srcOf('opus-bay.css');
  assert.match(css, /\.ob-glide-pulse \{ animation: ob-glide-pulse 1\.2s ease-out 2; \}/);
  assert.match(css, /\.ob-overlay\.is-reduced \.ob-glide-pulse \{ animation-name: ob-glide-glow; \}/);
});

test('W5-F3 · the routed wave-3 G items (sf-w4-lead.md §8.4) are in: FocusMarker single pass, the move column in the HUD boxes, the 667 × 375 column, twoShotPose prefers BAYBAY\'s side, the reset clears the line memory and the play block, the BAYBAY GLB through heroGltfLoader', () => {
  assert.match(srcOf('game/Systems.tsx'), /ring: new THREE\.MeshBasicMaterial\(\{[^}]*forceSinglePass: true/);
  assert.match(srcOf('game/hudLayout.ts'), /'\.ob-move-buttons > \*'/);
  assert.match(srcOf('opus-bay.css'), /@media \(min-width: 601px\) and \(max-width: 720px\) and \(max-height: 500px\) \{\s*\.ob-hud-buttons \{ flex-direction: column-reverse; bottom: calc\(18px \+ var\(--ob-sb\)\); \}/);
  assert.match(srcOf('actors/camera.ts'), /const prefer = gs \|\| this\.twoSide;/);
  const settings = srcOf('ui/Settings.tsx');
  assert.match(settings, /import\('\.\.\/game\/baybayLines'\)\)?\.then\(m => m\.clearLineMemory\(\)/); // (W8-P5: through importRetry)
  assert.match(settings, /clearSave\(\); resetLineMemory\(\);/, 'the reset clears the save (the play block with it) and the line memory');
  assert.match(srcOf('economy/ledger.ts'), /onSaveCleared\(/, 'lane E\'s ledger forgets its coins when the save is cleared');
  assert.match(srcOf('actors/system.ts'), /import\('\.\.\/world\/models'\)\)?\.then\(m => m\.heroGltfLoader\(\)\.loadAsync\(MODELS\.baybay\.url\)\)/); // (W8-P5: through importRetry)
});

// ---------------------------------------------------------------------------
// W5-F9 · the overlay layout at 390 × 844 and 375 × 667 (plan §4.4 item 9, MF6)
// ---------------------------------------------------------------------------

test('W5-F9 · the city pill opens the journal (on 今天 once lane R registers it, else 目标); the district pill still toggles its goals card', async () => {
  const slots = await import('../src/opus-bay/ui/slots');
  const { openObjectiveJournal } = await import('../src/opus-bay/ui/objectivePill');
  const seen: (string | undefined)[] = [];
  const off = slots.subscribeJournalRequest(() => seen.push(slots.lastJournalRequest().tab));
  try {
    openObjectiveJournal();
    const offTab = slots.registerJournalTab({ id: 'today', order: 5, label: { zh: '今天', en: 'Today' }, icon: () => null, load: async () => ({ default: () => null }) });
    openObjectiveJournal();
    offTab();
    openObjectiveJournal();
  } finally { off(); }
  assert.deepEqual(seen, ['goals', 'today', 'goals']);
  const hud = srcOf('ui/Hud.tsx');
  assert.match(hud, /const open = city \? openObjectiveJournal : \(\) => flow\.set\(s => \(\{ goalsCard: !s\.goalsCard \}\)\);/, 'district: the goals card as before');
});

test('W5-F9 · phones: the pill keeps two lines (the badges ride on the goals line); N\'s go chip keeps left of the move column; the top stack starts under the discovery chip while it shows', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { Hud } = await import('../src/opus-bay/ui/Hud');
  styles.deregister();
  const slots = await import('../src/opus-bay/ui/slots');
  const { game } = await import('../src/opus-bay/core/store');
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  const hadWindow = 'window' in g, savedMM = g.window?.matchMedia;
  g.window ??= globalThis as unknown as Record<string, unknown>;
  const saved = { mode: game.get().mode, phase: game.get().phase, worldMode: game.get().worldMode };
  const offBadge = slots.registerPillBadge({ id: 'w5-f9-coins', order: 0, Component: () => h('span', null, '🪙 42') });
  try {
    game.set({ mode: 'free', phase: 'playing', worldMode: 'city' });
    // a phone: (max-width: 600px) matches
    g.window!.matchMedia = (q: string) => ({ matches: /max-width: (600|720)px/.test(q) && !/min-width/.test(q), addEventListener() {}, removeEventListener() {} });
    const phone = renderToStaticMarkup(h(Hud));
    assert.match(phone, /<small>[^<]*<span class="ob-pill-badges"><span class="ob-pill-badge"><span>🪙 42<\/span><\/span><\/span><\/small>/, 'phone: the coins after 目标 n/m');
    assert.match(phone, /aria-label="打开旅行本"/);
    g.window!.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const desk = renderToStaticMarkup(h(Hud));
    assert.match(desk, /<em>[^<]*<\/em><span class="ob-pill-badges">/, 'desktop: after 明信片 n/m as before');
  } finally {
    offBadge();
    game.set(saved);
    if (savedMM === undefined) delete g.window!.matchMedia; else g.window!.matchMedia = savedMM;
    if (!hadWindow) delete g.window;
  }
  const css = srcOf('opus-bay.css');
  assert.match(css, /\.ob-overlay \.ob-go-chip \{ left: calc\(12px \+ var\(--ob-sl\)\); right: calc\(84px \+ var\(--ob-sr\)\);[^}]*max-width: calc\(100% - 96px - var\(--ob-sl\) - var\(--ob-sr\)\)/);
  assert.match(css, /\.ob-overlay:has\(\.ob-found-chip\) \.ob-topstack \{ top: calc\(92px \+ var\(--ob-st\)\); \}/);
  // lane A's chip (phones) and result card: the toasts start under them (A's request 3)
  assert.match(css, /\.ob-overlay:has\(\.ob-play-flight\) \.ob-topstack \{ top: calc\(185px \+ var\(--ob-st\)\); \}/);
  assert.match(css, /\.ob-overlay:has\(\.ob-play-result:not\(\.is-ride\)\) \.ob-topstack \{ top: calc\(281px \+ var\(--ob-st\)\); \}/);
  const play = fs.readFileSync(path.join(OB, 'play/play.css'), 'utf8');
  assert.match(play, /\.ob-play-result \{\s*position: absolute; left: 50%; top: calc\(104px \+ var\(--ob-st\)\)/, 'the card still starts at 104 px');
  assert.match(play, /\.ob-play-flight \{ top: calc\(118px \+ var\(--ob-st\)\)/, 'the phone chip still starts at 118 px');
});
