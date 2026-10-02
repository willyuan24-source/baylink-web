import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane F · W9-F1 — the attention arbiter (game/attention.ts; sf-w9-lead.md §4 "Attention"; review R§5 #5).
 * A fake clock and fake timers: every case runs in virtual time.
 */

const A = await import('../src/opus-bay/game/attention');

let clock = 1000;
const pending = new Map<number, { at: number; fn: () => void }>();
let tid = 0;
A.setAttentionClockForTests(() => clock, {
  set: (fn, ms) => { const id = ++tid; pending.set(id, { at: clock + ms, fn }); return id; },
  clear: t => { pending.delete(t as number); },
});
/** advance the virtual clock, firing the timers due on the way (in order) */
function advance(ms: number) {
  const end = clock + ms;
  for (;;) {
    let next: [number, { at: number; fn: () => void }] | null = null;
    for (const e of pending) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
    if (!next) break;
    pending.delete(next[0]);
    clock = Math.max(clock, next[1].at);
    next[1].fn();
  }
  clock = end;
}
const fresh = () => { A.clearAttention(); pending.clear(); clock = 1000; };

test('W9-F1: one holder per level; the next waits for the release and the 2.5 s gap', () => {
  fresh();
  const a = A.requestSlot('title', 'toast-1');
  assert.equal(a.granted, true);
  let bGranted = false;
  const b = A.requestSlot('title', 'toast-2', { onGrant: () => { bGranted = true; } });
  assert.equal(b.granted, false);
  assert.equal(b.waiting, true);
  assert.deepEqual(A.slotQueue('title'), ['toast-2']);
  advance(3000);
  assert.equal(b.granted, false, 'still held by toast-1');
  a.release();
  assert.equal(a.granted, false);
  assert.equal(A.slotHolder('title'), null);
  advance(A.ATTENTION_GAP_MS - 1);
  assert.equal(bGranted, false, 'not before the gap');
  advance(1);
  assert.equal(bGranted, true);
  assert.equal(b.granted, true);
  assert.equal(A.slotHolder('title'), 'toast-2');
});

test('W9-F1: the three levels are independent: a title, an action and a line at once (≤ 3 messages)', () => {
  fresh();
  assert.equal(A.requestSlot('title', 'card').granted, true);
  assert.equal(A.requestSlot('action', 'e-prompt').granted, true);
  assert.equal(A.requestSlot('line', 'baybay').granted, true);
  assert.equal(A.requestSlot('title', 'toast').granted, false);
  assert.equal(A.requestSlot('action', 'chip').granted, false);
  assert.equal(A.requestSlot('line', 'resident').granted, false);
});

test('W9-F1: the action level has no gap (the E prompt follows the focus)', () => {
  fresh();
  const a = A.requestSlot('action', 'e:bench');
  const b = A.requestSlot('action', 'e:bus');
  assert.equal(b.granted, false);
  a.release();
  assert.equal(b.granted, true, 'granted at once on release');
});

test('W9-F1: a higher priority takes over after the holder\'s minMs, with no gap; the holder hears onDrop(preempted)', () => {
  fresh();
  let dropped: string | null = null;
  const toast = A.requestSlot('title', 'toast', { priority: A.ATTENTION_PRIORITY.toast, minMs: 1200, onDrop: why => { dropped = why; } });
  const card = A.requestSlot('title', 'card', { priority: A.ATTENTION_PRIORITY.card });
  assert.equal(card.granted, false, 'the toast keeps its minMs');
  advance(1199);
  assert.equal(card.granted, false);
  advance(1);
  assert.equal(card.granted, true);
  assert.equal(toast.granted, false);
  assert.equal(dropped, 'preempted');
  // releasing a dropped ticket is harmless
  toast.release();
  assert.equal(A.slotHolder('title'), 'card');
});

test('W9-F1: equal or lower priority never takes over; the queue is priority first, then first come', () => {
  fresh();
  const h = A.requestSlot('title', 'h', { priority: 1 });
  A.requestSlot('title', 'low', { priority: 0 });
  A.requestSlot('title', 'same', { priority: 1 });
  A.requestSlot('title', 'low2', { priority: 0 });
  advance(10_000);
  assert.equal(A.slotHolder('title'), 'h');
  assert.deepEqual(A.slotQueue('title'), ['same', 'low', 'low2']);
  h.release();
  advance(A.ATTENTION_GAP_MS);
  assert.equal(A.slotHolder('title'), 'same');
});

test('W9-F1: a first-visit holder has no timer of its own (the arrival card): toasts wait, then expire; a stuck card takes over', () => {
  fresh();
  const card = A.requestSlot('title', 'arrival-card', { priority: A.ATTENTION_PRIORITY.card, firstVisit: true, absorb: true, minMs: 4000 });
  assert.equal(card.granted, true);
  assert.equal(A.holderIsFirstVisit('title'), true);
  assert.equal(A.titleAbsorbs(), true);
  let expired = false;
  A.requestSlot('title', 'toast', { maxWaitMs: 8000, onDrop: why => { expired = why === 'expired'; } });
  advance(60_000);
  assert.equal(card.granted, true, 'a minute later the card is still up');
  assert.equal(expired, true, 'the toast gave up after its maxWaitMs');
  const stuck = A.requestSlot('title', 'n-stuck', { priority: A.ATTENTION_PRIORITY.stuck });
  assert.equal(stuck.granted, true, 'past its minMs the card yields to the stuck card at once');
  assert.equal(card.granted, false);
});

test('W9-F1: the same id asked twice is one request; release while waiting leaves the queue', () => {
  fresh();
  A.requestSlot('line', 'a');
  const b1 = A.requestSlot('line', 'b');
  const b2 = A.requestSlot('line', 'b');
  assert.deepEqual(A.slotQueue('line'), ['b']);
  b2.release();
  assert.equal(b1.waiting, false);
  assert.deepEqual(A.slotQueue('line'), []);
});

test('W9-F1: onSlotFree tells a refused caller when to ask again', () => {
  fresh();
  const seen: string[] = [];
  const off = A.onSlotFree(level => seen.push(level));
  const a = A.requestSlot('action', 'x');
  a.release();
  off();
  A.requestSlot('action', 'y').release();
  assert.deepEqual(seen, ['action']);
});

test('W9-F1: the ribbon merges progress that arrives together; a same-kind note replaces its older count', () => {
  const t0 = 5000;
  let r = A.mergeRibbon(null, { zh: '今日小事 ✓ 新地点 · 1/3', en: 'Today’s three ✓ a new place · 1/3' }, t0, 1);
  r = A.mergeRibbon(r, { zh: '南瓜灯 1 / 40', en: 'Jack-o’-lantern 1 / 40' }, t0 + 800, 2);
  r = A.mergeRibbon(r, { zh: '+10 金币', en: '+10 coins' }, t0 + 1200, 3);
  assert.equal(r.key, 1, 'one line');
  assert.equal(A.ribbonText(r.parts).zh, '今日小事 ✓ 新地点 · 1/3 · 南瓜灯 1 / 40 · +10 金币');
  r = A.mergeRibbon(r, { zh: '南瓜灯 2 / 40', en: 'Jack-o’-lantern 2 / 40' }, t0 + 1500, 4);
  assert.equal(A.ribbonText(r.parts).zh, '今日小事 ✓ 新地点 · 1/3 · +10 金币 · 南瓜灯 2 / 40');
  const later = A.mergeRibbon(r, { zh: '+3 金币', en: '+3 coins' }, t0 + 1500 + A.RIBBON_MERGE_MS + 1, 5);
  assert.equal(later.key, 5, 'a new line after the merge window');
  assert.deepEqual(later.parts.map(p => p.zh), ['+3 金币']);
});

test('W9-F1: clearAttention drops everyone with onDrop(cleared); the module stays out of GameRoot (only lazy chunks import it)', async () => {
  fresh();
  const why: string[] = [];
  A.requestSlot('title', 'a', { onDrop: w => why.push(w) });
  A.requestSlot('title', 'b', { onDrop: w => why.push(w) });
  A.clearAttention();
  assert.deepEqual(why, ['cleared', 'cleared']);
  assert.equal(A.slotHolder('title'), null);
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve('src/opus-bay');
  // the static graph of GameRoot (the budget test's walk, simplified): game/attention must not be in it
  const seen = new Set<string>();
  const walk = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    let src = '';
    for (const ext of ['', '.ts', '.tsx']) { try { src = fs.readFileSync(path.join(root, rel + ext), 'utf8'); rel += ext; break; } catch { /* next */ } }
    if (!src) return;
    seen.add(rel);
    const re = /^(?:import|export)\s[^;]*?from\s+'(\.[^']+)'/gm;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      if (/^import\s+type\s/.test(m[0]) || /^export\s+type\s/.test(m[0])) continue;
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
  };
  walk('game/GameRoot.tsx');
  assert.ok(seen.size > 50, 'the walk found GameRoot\'s graph');
  assert.equal([...seen].some(m => m.startsWith('game/attention')), false, 'game/attention.ts is lazy');
});
