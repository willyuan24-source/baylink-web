import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

/**
 * Wave 9 · W9-I (integration fix pass) — district mode never changes (W9I-D10 = F-RC-2 / F-RP-1): lane F's first-minute
 * changes stay in the city; the district keeps its pre-W9-F golden first visit with the 看此刻 offer, its 1-minute
 * 我是本地人 quiet, and no hush. Red on 5250ffce (offerRealTime ended golden hour in every mode), green after.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 10_000;
mock.method(performance, 'now', () => clock);

const { game } = await import('../src/opus-bay/core/store');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { bayTimeOfDay } = await import('../src/opus-bay/game/qa');

// 2026-10-02 09:30 PDT: morning in the Bay, not golden hour
const MORNING = new Date('2026-10-02T16:30:00Z');

test('W9-I / F-RP-1: the district keeps golden hour after the welcome choice and offers the real Bay time (看此刻) for 10 s', () => {
  assert.notEqual(bayTimeOfDay(MORNING), 'golden');
  game.set({ worldMode: 'district' });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    flow.set({ goldenFirstVisit: true, timeOffer: null });
    flowMod.offerRealTime(MORNING);
    assert.equal(flow.get().goldenFirstVisit, true, 'golden hour stays (before W9-F3, the district F11)');
    mock.timers.tick(1900);
    assert.equal(flow.get().timeOffer, bayTimeOfDay(MORNING), 'the 看此刻 toast 1.8 s after the choice');
    mock.timers.tick(10_100);
    assert.equal(flow.get().timeOffer, null, 'gone after 10 s');
  } finally { mock.timers.reset(); flow.set({ goldenFirstVisit: false, timeOffer: null }); }
});

test('W9-I / F-RC-2: the district\'s 我是本地人 is quiet for one minute with no hush; the city\'s for 3 minutes with the hush', () => {
  game.set({ worldMode: 'district' });
  flowMod.startFree({ local: true });
  assert.equal(flow.get().quietUntil, clock + 60_000, 'district: F9\'s one quiet minute');
  assert.equal(flow.get().hushUntil, 0, 'district: no W9-F4 hush');
  game.set({ worldMode: 'city' });
  flowMod.startFree({ local: true });
  assert.equal(flow.get().quietUntil, clock + flowMod.QUIET_MS);
  assert.equal(flow.get().hushUntil, clock + flowMod.QUIET_MS);
  game.set({ worldMode: 'district' });
});

test('W9-I / W9I-P-1: 带我去 from an event card — on a first visit the event card reopens after the arrival card had its 4 s (before: it waited 20 s behind the sticky card and was dropped)', async () => {
  const A = await import('../src/opus-bay/game/attention');
  const { emit } = await import('../src/opus-bay/core/events');
  const { whenArrived, ARRIVE_CARD_MS } = await import('../src/opus-bay/game/goToRun');
  const CARD_MIN_MS = 4000; // ui/ArrivalCard.tsx CARD_MIN_MS (a .tsx with a stylesheet import: not loadable under node)
  mock.timers.enable({ apis: ['setTimeout'] });
  const step = (ms: number) => { for (let left = ms; left > 0; left -= 100) { clock += Math.min(100, left); mock.timers.tick(Math.min(100, left)); } };
  try {
    A.clearAttention();
    game.set({ worldMode: 'city' });
    flow.set({ trip: { startedAt: 1 } as never });
    let reopened = 0, arrivalGone = '';
    whenArrived(() => { reopened++; }, 'yerba-buena-gardens');
    emit({ type: 'trip', what: 'end', place: 'yerba-buena-gardens', mode: 'walk' as never });
    // the first-visit arrival card takes the title level (ui/ArrivalCard: priority card, firstVisit, CARD_MIN_MS)
    A.requestSlot('title', 'arrival-card:yerba-buena-gardens', { priority: A.ATTENTION_PRIORITY.card, minMs: CARD_MIN_MS, firstVisit: true, absorb: true, maxWaitMs: 30_000, onDrop: why => { arrivalGone = why; } });
    step(ARRIVE_CARD_MS + 200);
    assert.equal(reopened, 0, 'the arrival card first');
    step(CARD_MIN_MS);
    assert.equal(reopened, 1, 'the event card the player asked for comes back');
    assert.equal(arrivalGone, 'preempted');
  } finally { mock.timers.reset(); A.clearAttention(); flow.set({ trip: null }); game.set({ worldMode: 'district' }); }
});

test('W9-I / W9I-D8: an English .ics DESCRIPTION has no Chinese reminder line (zh keeps its bilingual line)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const C = await import('../src/opus-bay/data/catalog');
  const ics = await import('../src/opus-bay/realsf/ics');
  const CATALOG = C.sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
  const ev = CATALOG.events.find(x => x.id === 'sf-african-arts-festival-2026');
  assert.ok(ev);
  const desc = (text: string) => (text.replace(/\r\n /g, '').split('\r\n').find(l => l.startsWith('DESCRIPTION:')) ?? '');
  const en = desc(ics.eventIcs(ev, ev.startDate, 0, 'en'));
  assert.match(en, /^DESCRIPTION:Date reminder — check the official site before you go\./);
  assert.doesNotMatch(en, /日期提醒/);
  assert.match(desc(ics.eventIcs(ev, ev.startDate, 0, 'zh-Hans')), /^DESCRIPTION:日期提醒 · 以官网为准/);
});
