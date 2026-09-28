import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane A · PlayKit (W5-A1, plan sf-w5-plan.md §3.2 and §4.11 tests): the rhythm judge on a stub clock (±150 ms,
 * the offset learnt from the first four taps), tiers, one activity at a time, the lock held through
 * game/playerLock holdLock('activity') and released on every exit, cancel pays nothing, medals paid once per tier,
 * bests remembered, the result card (shape + word).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const kit = await import('../src/opus-bay/play/kit');
const { lockHeld, lockReport } = await import('../src/opus-bay/game/playerLock');
const { onEvent, REWARD_SOURCE, emit } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const slots = await import('../src/opus-bay/ui/slots');

type Ev = import('../src/opus-bay/core/events').GameEvent;
function record() {
  const events: Ev[] = [];
  const off = onEvent(e => { events.push(e); });
  return { events, off };
}
const spec = (id = 'test-act') => ({ id, name: { zh: '测试', en: 'Test' }, better: 'lower' as const });

test('W5-A1 judge: ±150 ms on the given clock; the offset is the median of the first four plausible taps (clamped ±0.25)', () => {
  let now = 10;
  const j = new kit.RhythmJudge({ clock: () => now });
  assert.equal(j.window, 0.15);
  // a player 120 ms late every time: the first taps are still hits, and the offset converges to 0.12
  for (const beat of [1, 2, 3, 4]) { now = beat + 0.12; assert.equal(j.judge(beat).kind, 'hit'); }
  assert.ok(Math.abs(j.offset - 0.12) < 1e-9, `offset ${j.offset}`);
  assert.equal(j.learning.length, 4);
  // after learning: 0.25 s late raw is 0.13 against the learnt offset → a hit; 0.30 raw → late; on the beat raw → early (−0.12 is inside)
  assert.equal(j.judge(5, 5.25).kind, 'hit');
  assert.equal(j.judge(6, 6.30).kind, 'late');
  assert.equal(j.judge(7, 7.0).kind, 'hit');
  assert.equal(j.judge(8, 7.8).kind, 'early');
  assert.equal(j.learning.length, 4, 'only the first four taps teach');
  // implausible taps (a stray tap 0.5 s off) never teach; the offset clamps at ±0.25
  const k = new kit.RhythmJudge({ clock: () => 0 });
  k.judge(1, 1.5);
  assert.equal(k.learning.length, 0);
  for (const b of [1, 2, 3, 4]) k.judge(b, b + 0.34);
  assert.equal(k.offset, 0.25);
  // nearest beat of a round
  const m = new kit.RhythmJudge({ clock: () => 0 });
  const r = m.judgeNearest([1, 1.5, 2], 1.56);
  assert.equal(r.beat, 1);
  assert.equal(r.kind, 'hit');
  // the default clock is audio/hooks audioNow (seconds; the performance clock before audio runs)
  const d = new kit.RhythmJudge();
  assert.ok(Math.abs(d.now() - performance.now() / 1000) < 0.5);
});

test('W5-A1 tiers: thresholds for higher- and lower-is-better scores', () => {
  assert.equal(kit.tierFor(8, [3, 6, 8]), 3);
  assert.equal(kit.tierFor(7, [3, 6, 8]), 2);
  assert.equal(kit.tierFor(3, [3, 6, 8]), 1);
  assert.equal(kit.tierFor(2, [3, 6, 8]), 0);
  assert.equal(kit.tierFor(17.9, [30, 22, 18], 'lower'), 3);
  assert.equal(kit.tierFor(25, [30, 22, 18], 'lower'), 1);
  assert.equal(kit.tierFor(31, [30, 22, 18], 'lower'), 0);
  assert.equal(kit.tierFor(NaN, [3, 6, 8]), 0);
  assert.deepEqual(kit.MEDAL_COINS, { 1: 5, 2: 10, 3: 15 });
  assert.deepEqual(Object.values(kit.TIER_WORDS).map(w => w.zh), ['再试试', '好', '很好', '太棒了']);
});

test('W5-A1 activities: one at a time; the lock is held and released on end, cancel, a new start; cancel pays nothing; medals once per tier', () => {
  kit.__resetKit();
  kit.__setBestWriter(null);
  const { events, off } = record();
  try {
    const bad = kit.startActivity({ id: 'Bad Id', name: { zh: 'x', en: 'x' } });
    assert.equal(bad, null);
    const a = kit.startActivity(spec('slides'), { lock: true })!;
    assert.ok(a.active && lockHeld() && lockReport().some(h => h.source === 'activity' && h.key === 'slides'));
    // a new start cancels the old one (free) and holds its own lock
    const b = kit.startActivity(spec('stairs'), { lock: true })!;
    assert.equal(a.active, false);
    assert.deepEqual(lockReport().map(h => h.key), ['stairs']);
    b.cancel();
    assert.equal(lockHeld(), false, 'cancel releases');
    assert.equal(events.filter(e => e.type === 'reward').length, 0, 'cancel pays nothing');
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && `${e.activity}:${e.what}`), ['slides:start', 'slides:cancel', 'stairs:start', 'stairs:cancel']);
    events.length = 0;
    // end at tier 2: medal 1 and 2 are asked for, with the stamp; the lock goes
    const c = kit.startActivity(spec('slides'), { lock: true })!;
    c.end({ tier: 2, score: 20, card: false });
    assert.equal(lockHeld(), false, 'end releases');
    const rewards = events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && [e.source, e.coins]);
    assert.deepEqual(rewards, [['medal:slides:1', 5], ['medal:slides:2', 10]]);
    for (const [source] of rewards as [string, number][]) assert.match(source, REWARD_SOURCE);
    assert.deepEqual(events.filter(e => e.type === 'play').map(e => e.type === 'play' && [e.what, e.tier]), [['start', undefined], ['end', 2]]);
    events.length = 0;
    // again at tier 3: only the new tier; ending twice does nothing more
    const d = kit.startActivity(spec('slides'))!;
    d.end({ tier: 3, score: 17, card: false });
    d.end({ tier: 3, score: 1, card: false });
    d.cancel();
    assert.deepEqual(events.filter(e => e.type === 'reward').map(e => e.type === 'reward' && e.source), ['medal:slides:3']);
    assert.equal(events.filter(e => e.type === 'play' && e.what !== 'start').length, 1);
    // onStop runs once, after the release
    let stops = '';
    const e = kit.startActivity(spec('bell'), { lock: true, onStop: how => { stops += `${how}:${lockHeld()}`; } })!;
    e.cancel(); e.cancel();
    assert.equal(stops, 'cancel:false');
  } finally { off(); kit.__resetKit(); }
});

test('W5-A1 activities: moving cancels after the grace (stick / WASD), at no cost', () => {
  kit.__resetKit();
  const { events, off } = record();
  try {
    runtime.input.moveX = 1;
    const a = kit.startActivity(spec('race'), { lock: true, cancelOnMove: true })!;
    stepFrameSystems(0.2, 0);
    assert.ok(a.active, 'the press that started it is still in the grace');
    runtime.input.moveX = 0;
    stepFrameSystems(0.3, 0);
    stepFrameSystems(0.1, 0);
    assert.ok(a.active);
    runtime.input.moveY = 0.8;
    stepFrameSystems(0.1, 0);
    assert.equal(a.active, false);
    assert.equal(lockHeld(), false);
    assert.equal(events.filter(e => e.type === 'reward').length, 0);
    stepFrameSystems(0.1, 0); // its frame system is gone: nothing throws, nothing more happens
  } finally { runtime.input.moveX = 0; runtime.input.moveY = 0; off(); kit.__resetKit(); }
});

test('W5-A1 bests: remembered per activity (lower / higher is better), written through lane E when it offers recordBest', () => {
  kit.__resetKit();
  const writes: [string, number][] = [];
  kit.__setBestWriter((k, v) => { writes.push([k, v]); });
  try {
    assert.equal(kit.bestOf('stairs'), undefined);
    assert.equal(kit.recordBest('stairs', 20, 'lower'), true);
    assert.equal(kit.recordBest('stairs', 22, 'lower'), false);
    assert.equal(kit.recordBest('stairs', 18, 'lower'), true);
    assert.equal(kit.bestOf('stairs'), 18);
    assert.equal(kit.recordBest('rings', 5), true);
    assert.equal(kit.recordBest('rings', 5), false, 'a tie is no new best');
    assert.equal(kit.recordBest('Bad Key', 1), false);
    assert.equal(kit.recordBest('rings', NaN), false);
  } finally { kit.__setBestWriter(undefined); }
  return new Promise<void>(done => setTimeout(() => {
    assert.deepEqual(writes, [['stairs', 20], ['stairs', 18], ['rings', 5]]);
    kit.__resetKit();
    done();
  }, 0));
});

test('W5-A1 result card: the overlay opens with the medal, the best line (新纪录！ / the earlier best) and the coins the ledger paid', async () => {
  kit.__resetKit();
  kit.__setBestWriter(null);
  kit.ensureResultOverlay();
  // a stub ledger: pays every reward it sees and says so
  const offLedger = onEvent(e => { if (e.type === 'reward') emit({ type: 'coins', total: 0, delta: e.coins, source: e.source }); });
  try {
    assert.ok(slots.overlays.get(kit.RESULT_OVERLAY), 'registered');
    const run = kit.startActivity(spec('slides'))!;
    run.end({ tier: 1, score: 25, detail: { zh: '25 秒', en: '25 s' }, bestText: b => ({ zh: `上次你 ${b} 秒！`, en: `Last time: ${b} s!` }), again: () => undefined });
    let shown = kit.lastResultShown()!;
    assert.equal(shown.tier, 1);
    assert.equal(shown.coins, 5);
    assert.equal(shown.fresh, false, 'the first score is no record yet');
    assert.equal(shown.best, undefined);
    assert.deepEqual(slots.openOverlays().map(o => o.id), [kit.RESULT_OVERLAY]);
    kit.startActivity(spec('slides'))!.end({ tier: 1, score: 28, bestText: b => ({ zh: `上次你 ${b} 秒！`, en: `Last time: ${b} s!` }) });
    shown = kit.lastResultShown()!;
    assert.deepEqual(shown.best, { zh: '上次你 25 秒！', en: 'Last time: 25 s!' });
    assert.equal(shown.coins, 0, 'tier 1 was paid already');
    kit.startActivity(spec('slides'))!.end({ tier: 3, score: 16 });
    shown = kit.lastResultShown()!;
    assert.equal(shown.fresh, true);
    assert.equal(shown.coins, 25, 'tiers 2 and 3 now');
    kit.closeResult();
    assert.deepEqual(slots.openOverlays(), []);
  } finally { offLedger(); kit.unregisterResultOverlay(); kit.__resetKit(); }

  // the card itself: shape + word for every tier, the buttons
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { default: ResultCard } = await import('../src/opus-bay/play/ResultCard');
  styles.deregister();
  const marks: Record<number, RegExp> = { 0: /<circle[^>]*class="is-open"/, 1: /<circle cx="23"/, 2: /<path d="M23 3l20 20/, 3: /<path d="M23 3.5l5.6/ };
  for (const tier of [0, 1, 2, 3] as const) {
    const html = renderToStaticMarkup(h(ResultCard, { props: { activity: 'x', name: { zh: '西沃德滑梯', en: 'Seward slides' }, tier, detail: { zh: '18 秒', en: '18 s' }, fresh: tier === 3, coins: tier ? 5 : 0, again: () => undefined }, close: () => undefined }));
    assert.match(html, new RegExp(`tier-${tier}`));
    assert.match(html, marks[tier], `tier ${tier} shape`);
    assert.ok(html.includes(kit.TIER_WORDS[tier].zh), `tier ${tier} word`);
    assert.ok(html.includes('再来一次') && html.includes('好的'));
    if (tier === 3) assert.ok(html.includes('新纪录！'));
    if (tier) assert.ok(html.includes('+5 金币'));
  }
  assert.equal(game.get().phase !== undefined, true);
});
