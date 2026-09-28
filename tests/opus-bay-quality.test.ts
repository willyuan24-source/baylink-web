import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 3, P4 / CS-7 (lane C2): the quality policy. Touch-first or high-density devices start at `mid` unless ?quality=
 * or the player's own pick says otherwise; a saved `high` is only the default (every visit saves it), a saved `mid` /
 * `low` is a pick; the adaptive monitor steps down at ≈ 50 fps from `high` (30 from `mid`) and never back up.
 */

const { MONITOR, declineFrom, monitorBounds, startQuality } = await import('../src/opus-bay/world/quality');

const desk = { coarse: false, dpr: 1 };
const phone = { coarse: true, dpr: 3 };

test('start: ?quality= wins over everything', () => {
  for (const url of ['high', 'mid', 'low'] as const) {
    assert.deepEqual(startQuality({ url, choice: 'low', saved: 'mid', ...phone }), { quality: url, reason: 'url' });
    assert.deepEqual(startQuality({ url, ...desk }), { quality: url, reason: 'url' });
  }
});

test('start: the player\'s pick beats the device rule (a phone that chose high stays high)', () => {
  assert.deepEqual(startQuality({ choice: 'high', saved: 'high', ...phone }), { quality: 'high', reason: 'choice' });
  assert.deepEqual(startQuality({ choice: 'low', saved: 'high', ...desk }), { quality: 'low', reason: 'choice' });
});

test('start: touch or DPR ≥ 2 → mid, even with the default high saved; a saved mid / low is kept', () => {
  assert.deepEqual(startQuality({ saved: 'high', ...phone }), { quality: 'mid', reason: 'device' });
  assert.deepEqual(startQuality({ saved: null, ...phone }), { quality: 'mid', reason: 'device' });
  assert.deepEqual(startQuality({ coarse: false, dpr: 2 }), { quality: 'mid', reason: 'device' });
  assert.deepEqual(startQuality({ coarse: true, dpr: 1 }), { quality: 'mid', reason: 'device' });
  assert.deepEqual(startQuality({ saved: 'low', ...phone }), { quality: 'low', reason: 'saved' });
  assert.deepEqual(startQuality({ saved: 'mid', ...desk }), { quality: 'mid', reason: 'saved' });
});

test('start: a desktop (fine pointer, DPR < 2) keeps its saved level or high', () => {
  assert.deepEqual(startQuality({ saved: 'high', ...desk }), { quality: 'high', reason: 'default' });
  assert.deepEqual(startQuality({ ...desk }), { quality: 'high', reason: 'default' });
  assert.deepEqual(startQuality({ coarse: false, dpr: 1.5 }), { quality: 'high', reason: 'default' });
});

/** drei's PerformanceMonitor rule over one batch of window averages (node_modules/@react-three/drei PerformanceMonitor). */
function monitorSays(averages: number[], q: 'high' | 'mid' | 'low'): 'decline' | 'incline' | 'none' {
  const [lower, upper] = monitorBounds(q);
  const n = MONITOR.iterations;
  if (averages.filter(v => v >= upper).length > n * MONITOR.threshold) return 'incline';
  if (averages.filter(v => v < lower).length > n * MONITOR.threshold) return 'decline';
  return 'none';
}

test('monitor: the phone profile (30–45 fps on high) steps down; 60 fps with a hitch or two does not', () => {
  assert.equal(monitorSays([44, 38, 45, 41, 36, 43, 45, 40], 'high'), 'decline');
  assert.equal(monitorSays([46, 47, 45, 48, 49, 44, 47, 46], 'high'), 'decline', 'the old 40 fps bound never fired here');
  assert.equal(monitorSays([60, 60, 42, 60, 31, 60, 60, 59], 'high'), 'none');
  assert.equal(monitorSays([55, 56, 54, 58, 60, 57, 55, 56], 'high'), 'none');
});

test('monitor: never steps back up; from mid only when really slow; never below low', () => {
  for (const q of ['high', 'mid', 'low'] as const) assert.notEqual(monitorSays([60, 60, 60, 60, 60, 60, 60, 60], q), 'incline');
  assert.equal(monitorSays([44, 45, 42, 46, 41, 45, 44, 43], 'mid'), 'none');
  assert.equal(monitorSays([24, 26, 22, 25, 28, 27, 23, 25], 'mid'), 'decline');
  assert.equal(monitorSays([10, 10, 10, 10, 10, 10, 10, 10], 'low'), 'none');
  assert.equal(declineFrom('high'), 'mid');
  assert.equal(declineFrom('mid'), 'low');
  assert.equal(declineFrom('low'), null);
  assert.ok(MONITOR.flipflops >= 2, 'high → mid → low stays possible');
});

test('a pick back to the automatic level is remembered (verify-code F3: phone mid → pick high → pick mid again)', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const store = new Map<string, string>();
  const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  const matchMedia = (m: string) => ({ matches: m === '(pointer: coarse)' });
  const prev = { window: g.window, location: g.location };
  g.window = { localStorage, matchMedia, devicePixelRatio: 3, location: { search: '' } };
  g.location = { search: '' };
  try {
    const { game } = await import('../src/opus-bay/core/store');
    const { keepSetting } = await import('../src/opus-bay/data/wishlist');
    const { initQualityPolicy, declineQuality, qualityDecision, nextWarmState, QUALITY_CHOICE_KEY } = await import('../src/opus-bay/world/quality');
    // the Settings panel's own write path (ui/Settings.tsx setSetting)
    const pick = (q: 'high' | 'mid' | 'low') => { keepSetting('quality'); game.set(s => ({ settings: { ...s.settings, quality: q } })); };
    initQualityPolicy();
    assert.deepEqual(qualityDecision(), { quality: 'mid', reason: 'device' });
    assert.equal(game.get().settings.quality, 'mid');
    assert.equal(store.get(QUALITY_CHOICE_KEY), undefined, 'the automatic start level is not a choice');
    // the warm-up's next level (world/warmup.ts): the monitor's step from each level, as program keys see it
    assert.deepEqual([nextWarmState('high'), nextWarmState('mid'), nextWarmState('low')], [{ shadows: true }, { shadows: false }, null]);
    pick('high');
    assert.equal(store.get(QUALITY_CHOICE_KEY), 'high');
    pick('mid');
    assert.deepEqual({ stored: store.get(QUALITY_CHOICE_KEY), live: game.get().settings.quality }, { stored: 'mid', live: 'mid' });
    // the monitor's steps stay session-only; a pick after one is saved again
    assert.equal(declineQuality(), 'low');
    assert.equal(store.get(QUALITY_CHOICE_KEY), 'mid', 'an automatic step is never saved as a choice');
    pick('mid');
    assert.equal(store.get(QUALITY_CHOICE_KEY), 'mid');
    pick('high');
    assert.equal(declineQuality(), 'mid');
    assert.equal(store.get(QUALITY_CHOICE_KEY), 'high', 'the step down from the pick keeps the pick');
  } finally {
    g.window = prev.window;
    g.location = prev.location;
  }
});
