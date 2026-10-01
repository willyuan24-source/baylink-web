import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 8 · lane M · the Ultra review's fixes (W8-M-review), each red before its fix:
 *   - the foghorns: a horn key pressed and let go between two frames is let go (it stuck, and the rest of the answer was
 *     ignored until it ran out of time); a key pressed while Settings pauses blows nothing; being too slow is not "wrong"
 *   - the ride banner: the bell riff's pad hides while the grip runs, the grip's pad while the riff (or any game) runs —
 *     a tap on the other pad ended the game with nothing paid
 *   - the busker's canvas draws without CanvasRenderingContext2D.roundRect (iOS 15)
 *   - the set's panels hide while Settings pauses their game; the grip panel lays out side by side on a landscape phone
 */

// a window that takes key listeners (holdKeys attaches to it), before any game module loads
const g = globalThis as unknown as Record<string, unknown>;
const et = new EventTarget();
g.addEventListener = et.addEventListener.bind(et);
g.removeEventListener = et.removeEventListener.bind(et);
g.dispatchEvent = et.dispatchEvent.bind(et);
g.window ??= globalThis;

const fog = await import('../src/opus-bay/play/foghorn');
const lines = await import('../src/opus-bay/play/sfgames8Lines');
const kit = await import('../src/opus-bay/play/kit');
const zones = await import('../src/opus-bay/play/zones');
const zones8 = await import('../src/opus-bay/play/sfgames8');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');

const ROOT = path.resolve(import.meta.dirname, '..');
const PLAY = path.join(ROOT, 'src/opus-bay/play');
const DT = 1 / 30;
const TUNES: import('../src/opus-bay/play/foghorn').Horn[][] = [['H', 'L'], ['H', 'L', 'H'], ['L', 'H', 'L'], ['H', 'L', 'H', 'L'], ['L', 'H', 'L', 'H'], ['H', 'L', 'H', 'L', 'H']];

function key(type: 'keydown' | 'keyup', code: string) {
  const ev = new Event(type);
  for (const [k, v] of Object.entries({ code, repeat: false, metaKey: false, ctrlKey: false, altKey: false, target: null })) Object.defineProperty(ev, k, { value: v });
  et.dispatchEvent(ev);
}

function freshFog() {
  kit.__resetKit();
  fog.__resetFoghorn();
  game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false, paused: false } as never);
  runtime.move.mode = 'foot';
  runtime.input.moveX = 0; runtime.input.moveY = 0;
  assert.ok(fog.startFoghorn(TUNES.map(t => [...t])));
  let t = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) stepFrameSystems(DT, (t += DT)); };
  const gm = fog.fogGame()!;
  for (let i = 0; i < 600 && gm.phase !== 'answer'; i++) step();
  assert.equal(gm.phase, 'answer');
  return { gm, step };
}

test('W8-M-review foghorn: a key tap shorter than a frame is a whole horn — the answer goes on (it stuck and ran out of time)', () => {
  const { gm, step } = freshFog();
  key('keydown', 'KeyK'); key('keyup', 'KeyK');
  step(3);
  assert.equal(gm.held, null, 'the high horn let go');
  assert.equal(gm.got, 1, 'the high horn counted');
  key('keydown', 'KeyL'); step(4); key('keyup', 'KeyL'); step(2);
  assert.equal(gm.tries, 0, 'right first time');
  assert.equal(gm.phase, 'pass');
  fog.cancelFoghorn();
});

test('W8-M-review foghorn: a horn pressed and let go while Settings pauses the game blows nothing and sticks nothing', () => {
  const { gm, step } = freshFog();
  game.set({ paused: true } as never);
  key('keydown', 'KeyK'); key('keyup', 'KeyK');
  step(3);
  assert.equal(gm.held, null);
  assert.equal(gm.got, 0);
  // Esc while Settings is up is the sheet's: the game stays (it was given up under the sheet)
  key('keydown', 'Escape'); key('keyup', 'Escape');
  assert.equal(fog.fogGame(), gm, 'Esc under Settings does not give the game up');
  game.set({ paused: false } as never);
  key('keydown', 'KeyK'); step(2); key('keyup', 'KeyK'); step(1);
  key('keydown', 'KeyL'); step(2); key('keyup', 'KeyL'); step(1);
  assert.equal(gm.phase, 'pass');
  assert.equal(gm.tries, 0);
  fog.cancelFoghorn();
});

test('W8-M-review foghorn: an answer that runs out of time replays the call without BAYBAY saying "wrong horn"', () => {
  const { gm, step } = freshFog();
  let said: unknown = null;
  const off = flow.subscribe(() => { const b = flow.get().bubble; if (b) said = b.text; });
  for (let i = 0; i < 600 && gm.tries === 0; i++) step();
  off();
  assert.equal(gm.last?.ev === 'late' || gm.phase === 'call', true);
  assert.equal(gm.tries, 1);
  assert.notDeepEqual(said, lines.FOG_LINES.wrong, 'no horn was blown: not "wrong horn"');
  fog.cancelFoghorn();
});

test('W8-M-review ride pads: the bell riff pad hides while the grip runs, the grip pad while another game runs', async () => {
  kit.__resetKit();
  const ride = { kind: 'cable-car', line: 'powell-hyde', stage: 'riding' } as never;
  assert.equal(zones.bellPadVisible(ride), true);
  assert.equal(zones8.gripPadVisible(ride), true);
  // the bell riff (lane A's activity) running: no grip pad
  const riff = kit.startActivity({ id: 'bell', name: { zh: '铃', en: 'Bell' }, better: 'higher' });
  assert.ok(riff);
  assert.equal(zones8.gripPadVisible(ride), false, 'a tap on 拉闸 would end the riff');
  assert.equal(zones.bellPadVisible(ride), true, 'the riff keeps its own pad');
  riff!.cancel();
  // the grip running: no bell pad (its 停 / 铃声对答 would end the grip)
  const grip = kit.startActivity({ id: 'grip', name: { zh: '拉闸', en: 'Grip' }, better: 'higher' });
  assert.ok(grip);
  assert.equal(zones.bellPadVisible(ride), false, 'a tap on 铃声对答 would end the grip');
  grip!.cancel();
  assert.equal(zones.bellPadVisible(ride), true);
});

test('W8-M-review busker canvas: no unguarded roundRect (iOS 15 has none: the drawing loop died on its first frame)', () => {
  const src = fs.readFileSync(path.join(PLAY, 'BuskPanel.tsx'), 'utf8');
  for (const m of src.matchAll(/\.roundRect\(/g)) {
    const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
    assert.match(line, /roundRect\s*\?|if \(c\.roundRect\)|typeof c\.roundRect/, `unguarded: ${line.trim()}`);
  }
});

test('W8-M-review panels: hidden while Settings pauses their game; the grip panel side by side on a landscape phone', () => {
  for (const f of ['GripPanel.tsx', 'BuskPanel.tsx', 'FogPanel.tsx']) {
    const src = fs.readFileSync(path.join(PLAY, f), 'utf8');
    assert.match(src, /useGame\(s => s\.paused\)/, `${f} reads the pause`);
    assert.match(src, /is-paused/, `${f} marks the pause`);
  }
  const css = fs.readFileSync(path.join(PLAY, 'sfgames8.css'), 'utf8');
  assert.match(css, /\.ob-sfg-panel\.is-paused\s*\{[^}]*visibility:\s*hidden/);
  assert.match(css, /@media \(max-height: 560px\) and \(min-width: 600px\)\s*\{[^@]*\.ob-sfg-panel\.is-grip\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.ob-sfg-panel:is\(\.is-grip, \.is-busk, \.is-fog\)\s*\{[^}]*background:\s*#fffaf1/, 'opaque: no HUD labels through the legend');
  assert.match(css, /\.ob-overlay\.has-sheet \.ob-sfg-panel:is\(\.is-grip, \.is-busk, \.is-fog\)\s*\{[^}]*right:\s*calc\(var\(--ob-sheet-w/, 'left of an open side sheet');
});
