import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane E · W5-E8: the scripted economy run (scripts/opus-sf/economy-run.mts) keeps the locked prices honest.
 *
 * - Hour 1 of the typical profile on the real data and the real ledger (the opening of the checkpoint's phone script,
 *   then ordinary play): the balance buys 3–5 cosmetics at the average wearable price (plan MF5), the first one within
 *   the first ten minutes, every reward source paid once.
 * - The city's one-off coins cover the whole wardrobe with room to spare (nobody needs the daily refills to buy
 *   everything), and the whole wardrobe is several hours of play (plan D21: 6–8 h).
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const E = await import('../scripts/opus-sf/economy-run.mts');

test('W5-E8 the typical first hour buys 3–5 cosmetics, the first within ten minutes; each source is paid once', async () => {
  const res = await E.runEconomy({ hours: 1, profile: { ...E.PROFILES.typical, stay: { ...E.PROFILES.typical.stay } } });
  const pc = E.priceCheck(res);
  assert.ok(pc.cosmeticsHour1 >= 3 && pc.cosmeticsHour1 <= 5.5, `hour 1: ${res.hours[0].total} coins = ${pc.cosmeticsHour1} cosmetics at ${pc.avg}`);
  const cheapest = Math.min(...E.wearablePrices());
  assert.ok(res.minutes[10] >= cheapest, `minute 10: ${res.minutes[10]} coins (the cheapest look is ${cheapest})`);
  // the ledger paid every source once and the balance is the sum of what it paid
  const sources = res.rows.map(r => r.source);
  assert.equal(new Set(sources).size, sources.length, 'each source once');
  assert.equal(res.rows.reduce((n, r) => n + r.coins, 0), res.hours[0].total);
  // what hour 1 is made of: the opening's pelican, flight and egg; arrivals; coins on the ground
  const by = res.hours[0].bySource;
  for (const k of ['goal', 'ring', 'medal', 'egg', 'arrive', 'trail', 'cache']) assert.ok((by[k] ?? 0) > 0, `hour 1 pays ${k}`);
});

test('W5-E8 the one-off coins cover the wardrobe with room to spare; the wardrobe is hours of play', async () => {
  const sup = await E.supply();
  const wardrobe = E.wearablePrices().reduce((a, b) => a + b, 0);
  assert.ok(wardrobe <= 0.8 * sup.onceTotal, `wardrobe ${wardrobe} vs one-off coins ${sup.onceTotal}`);
  // at the typical run's pace (hours 2+: ≈ 280 an hour) the wardrobe is more than six hours of play
  assert.ok(wardrobe >= 6 * 280 && wardrobe <= 8 * 280, `wardrobe ${wardrobe}`);
  assert.ok(sup.daily.trail >= 300 && sup.daily.three === 50, 'the daily refills');
});
