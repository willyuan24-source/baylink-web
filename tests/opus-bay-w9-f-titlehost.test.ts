import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

/**
 * Wave 9 · lane F · W9-F2 — the title level on screen (ui/titleHost.ts; review R§5 #5: at the Ferry Building the
 * arrival banner, the ARRIVED card, 解锁：随时飞！, 今日小事 ✓ 1/3 and the +1 chip were up at once). Virtual time.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 50_000;
mock.method(performance, 'now', () => clock);
mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
const advance = (ms: number) => { for (let left = ms; left > 0; left -= 100) { clock += Math.min(100, left); mock.timers.tick(Math.min(100, left)); } };

const { game, toast } = await import('../src/opus-bay/core/store');
const { emit } = await import('../src/opus-bay/core/events');
const A = await import('../src/opus-bay/game/attention');
const H = await import('../src/opus-bay/ui/titleHost');
const off = H.initTitleHost();
const shown = () => { const s = H.titleHostState(); return s.toast ? (typeof s.toast.text === 'string' ? s.toast.text : s.toast.text.zh) : null; };
const ribbonZh = () => { const r = H.titleHostState().ribbon; return r ? A.ribbonText(r.parts).zh : null; };
const reset = () => { advance(20_000); A.clearAttention(); game.set({ dialogue: { nodeId: null }, panel: { kind: null } }); advance(3000); };

test('W9-F2: three toasts at once — one on screen at a time, the next ≥ 2.5 s after the last one went (before: 3 at once, core/store keeps 3)', () => {
  reset();
  toast({ zh: '已保存', en: 'Saved' });
  toast({ zh: '目标完成：坐一次叮当车', en: 'Goal done: ride a cable car' }, 'gold');
  toast({ zh: '一日游还没准备好，稍后再试', en: 'The Grand Tour is not ready yet' });
  assert.equal(shown(), '已保存');
  const firstMs = H.toastMs('已保存');
  advance(firstMs);
  assert.equal(shown(), null, 'gone after its reading time');
  advance(A.ATTENTION_GAP_MS - 200);
  assert.equal(shown(), null, 'the gap');
  advance(300);
  assert.equal(shown(), '目标完成：坐一次叮当车', 'the second one next (first come, first shown)');
  advance(H.toastMs('目标完成：坐一次叮当车', 'gold') + A.ATTENTION_GAP_MS + 100);
  // the third waited 2.4 + 2.5 + 3.2 + 2.5 s > TOAST_MAX_WAIT_MS: not shown late
  assert.equal(shown(), null);
  assert.equal(A.slotHolder('title'), null);
});

test('W9-F2: progress toasts arriving together become ONE ribbon line (今日小事 1/3 · 南瓜灯 1/40 · +10 金币), never three toasts', () => {
  reset();
  toast({ zh: '今日小事 ✓ 去新地方 · 1/3', en: 'Today’s three ✓ a new place · 1/3' }, 'success', 2800);
  toast({ zh: '南瓜灯 1 / 40 · 渡轮大厦', en: 'Jack-o’-lantern 1 / 40 · Ferry Building' }, 'gold', 3200);
  emit({ type: 'coins', total: 10, delta: 10, source: 'arrival' });
  assert.equal(shown(), null, 'no plain toast');
  assert.equal(ribbonZh(), '今日小事 ✓ 去新地方 · 1/3 · 南瓜灯 1 / 40 · 渡轮大厦 · +10 金币');
  assert.match(A.slotHolder('title') ?? '', /^ribbon:/);
  advance(H.RIBBON_SHOW_MS + 50);
  assert.equal(ribbonZh(), null, 'the ribbon leaves after its time');
  assert.equal(A.slotHolder('title'), null);
});

test('W9-F2: coins alone do not pop a ribbon (the badge pulses)', () => {
  reset();
  emit({ type: 'coins', total: 20, delta: 10, source: 'goal' });
  assert.equal(ribbonZh(), null);
});

test('W9-F2: while the arrival card holds the title (absorb), a toast goes into its ribbon row, not on top of it', () => {
  reset();
  const card = A.requestSlot('title', 'arrival-card:test', { priority: A.ATTENTION_PRIORITY.card, firstVisit: true, absorb: true });
  assert.equal(card.granted, true);
  toast({ zh: '解锁：随时飞！按 G 起飞', en: 'Unlocked: fly anytime! press G to take off' }, 'gold', 4600);
  assert.equal(shown(), null);
  assert.equal(H.titleHostState().ribbon, null, 'the host does not show it: the card does');
  assert.deepEqual(A.ribbon()?.parts.map(p => p.zh), ['解锁：随时飞！按 G 起飞']);
  card.release();
});

test('W9-F2: a dialogue holds the title level — a toast waits under it and shows after it closes', () => {
  reset();
  game.set({ dialogue: { nodeId: 'test.node' } });
  assert.equal(A.slotHolder('title'), 'modal');
  toast({ zh: '已加入想去', en: 'Added to your list' });
  assert.equal(shown(), null, 'not over the dialogue');
  advance(2000);
  game.set({ dialogue: { nodeId: null } });
  assert.equal(A.slotHolder('title'), null);
  advance(A.ATTENTION_GAP_MS + 100);
  assert.equal(shown(), '已加入想去');
});

test('W9-F2: a toast that waited too long is not shown late', () => {
  reset();
  game.set({ panel: { kind: 'map' } });
  toast({ zh: '一会儿就过期', en: 'Stale soon' });
  advance(H.TOAST_MAX_WAIT_MS + 500);
  game.set({ panel: { kind: null } });
  advance(A.ATTENTION_GAP_MS + 500);
  assert.equal(shown(), null);
});

test('W9-F2: isProgress / toastMs (pure)', () => {
  assert.equal(H.isProgress('今日小事 ✓ 去新地方 · 1/3'), true);
  assert.equal(H.isProgress('南瓜灯 3 / 40 · 渡轮大厦'), true);
  assert.equal(H.isProgress('+1 · 渡轮大厦'), true);
  assert.equal(H.isProgress('解锁：随时飞！按 G 起飞'), false);
  assert.equal(H.isProgress('现在湾区是晚上 22:02'), false);
  assert.ok(H.toastMs('Saved') >= 2400 && H.toastMs('x'.repeat(400)) <= 4600);
  assert.equal(H.toastMs('解锁：随时飞！按 G 起飞', 'gold'), H.toastMs('解锁：随时飞！按 G 起飞') + 600);
  off();
  mock.timers.reset();
});
