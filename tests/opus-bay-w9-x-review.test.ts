import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { mock } from 'node:test';

/**
 * Wave 9 · lane X review (Ultra), X-RV-1: a returning player's 继续旅程 / Continue (game/resume.ts startOrResume) is the
 * Start tap of that visit, so it emits {type:'start'} as startGame() does — audio/audio.ts activates on it. Before the
 * fix the sound stayed suspended until the player's next gesture: BAYBAY's recorded welcome back (w5c-welcome-back) was
 * dropped and nothing sounded (live QA C:/Users/willy/opus-qa/w9/x-rv/rb2.log: activated false, lines played 0).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
// the UI modules import their CSS: an empty module in node (as tests/opus-bay-w5-nav.test.ts)
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
let clock = 300_000;
mock.method(performance, 'now', () => clock);

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { onEvent } = await import('../src/opus-bay/core/events');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const RS = await import('../src/opus-bay/game/resume');
const save = await import('../src/opus-bay/data/save');

test('W9-X review (X-RV-1) · Continue (a resume) emits the start event in the tap\'s own turn, before the arrival phase — the sound comes on with it', async () => {
  const S = { x: DISTRICT.spawn.x, z: DISTRICT.spawn.z };
  const seen: string[] = [];
  const off = onEvent(e => { if (e.type === 'start') seen.push(`start@${game.get().phase}`); });
  try {
    save.clearSave();
    game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' });
    save.patchSave(s => { s.lastSafe = { world: 'city', x: S.x, z: S.z, heading: 0 }; });
    save.requestResume();
    RS.startOrResume();
    const phaseAtOnce = game.get().phase, atOnce = [...seen];
    // let the resume finish first (no streamer in node: the wait gives up once the mocked clock moves on)
    clock += 20_000;
    for (let i = 0; i < 20 && game.get().phase !== 'playing'; i++) await new Promise(r => setTimeout(r, 120));
    assert.equal(phaseAtOnce, 'arrival', 'the resume path (no ferry cinematic)');
    assert.deepEqual(atOnce, ['start@title'], 'one start, emitted synchronously before the phase changes');
    assert.equal(game.get().phase, 'playing');
    assert.deepEqual(seen, ['start@title'], 'not twice');
  } finally { off(); save.clearSave(); game.set({ ...initialGameState() }); }
});
