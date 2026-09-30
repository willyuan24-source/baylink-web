import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

/**
 * Wave 7 · lane G (W7-G1) · the four Halloween postcards at their moments (halloween/playPostcards.ts gates on the
 * ledger, halloween/playPostcardRun.ts hands one over after BAYBAY's bubble as the `h-postcard` overlay), the notebook
 * block that stays after the season, and the wave-7 lines (halloween/lines.ts W7_HALLOWEEN_LINES) for lane X.
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

const cards = await import('../src/opus-bay/halloween/playPostcards');
const run = await import('../src/opus-bay/halloween/playPostcardRun');
const { HALLOWEEN_POSTCARD_IDS, HALLOWEEN_POSTCARDS } = await import('../src/opus-bay/data/sf/halloweenPostcards');
const { HALLOWEEN_LINES, W7_HALLOWEEN_LINES, hLine } = await import('../src/opus-bay/halloween/lines');
const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
const { registerHalloweenRewards } = await import('../src/opus-bay/halloween/rewards');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const slots = await import('../src/opus-bay/ui/slots');

const set = (...ids: string[]) => { const s = new Set(ids.map(i => `halloween:${i}`)); return (src: string) => s.has(src); };

test('W7-G1 gates: each card from the ledger id of its moment (first door, hunt:all, first night, muertos:12)', () => {
  assert.deepEqual(cards.earnedHalloweenCards(() => false), []);
  const d = TREAT_DOORS.find(x => !x.gone)!;
  assert.deepEqual(cards.earnedHalloweenCards(set(`door:${d.n}`)), ['halloween-trick-or-treat']);
  assert.deepEqual(cards.earnedHalloweenCards(set('hunt:all')), ['halloween-pumpkin-hunt']);
  assert.deepEqual(cards.earnedHalloweenCards(set('hunt:20')), [], 'the hunt card is the end of the hunt (all 40)');
  assert.deepEqual(cards.earnedHalloweenCards(set(`night:${d.n}`)), ['halloween-big-night']);
  assert.deepEqual(cards.earnedHalloweenCards(set('muertos:12')), ['muertos-mission']);
  assert.deepEqual(cards.earnedHalloweenCards(set('muertos:8')), []);
  assert.equal(cards.halloweenCardCount(set(`door:${d.n}`, `night:${d.n}`, 'hunt:all', 'muertos:12')), 4);
  // every one of lane X's four cards has a gate, in the notebook's order
  assert.deepEqual([...cards.HALLOWEEN_CARD_GATES.map(x => x.id)].sort(), [...HALLOWEEN_POSTCARD_IDS].sort());
  assert.deepEqual(cards.HALLOWEEN_CARD_ORDER.map(c => c.id), cards.HALLOWEEN_CARD_GATES.map(x => x.id));
  for (const c of HALLOWEEN_POSTCARDS) assert.ok(cards.halloweenCardGate(c.id)?.how.zh, c.id);
  assert.match(cards.halloweenCardGate('halloween-pumpkin-hunt')!.how.zh, /40/);
  assert.match(cards.halloweenCardGate('muertos-mission')!.how.en, /all 8/);
});

test('W7-G1 moments: only the cards a ledger change newly earned; the notebook block in season or once one is earned', () => {
  assert.deepEqual(cards.newlyEarned([], ['halloween-trick-or-treat']), ['halloween-trick-or-treat']);
  assert.deepEqual(cards.newlyEarned(['halloween-trick-or-treat'], ['halloween-trick-or-treat', 'halloween-big-night']), ['halloween-big-night']);
  assert.deepEqual(cards.newlyEarned(['halloween-big-night'], []), [], 'a reset earns nothing');
  // the block: in the season always, after it (1 Nov → next October) only once a card is earned
  assert.equal(cards.showCardsBlock(() => false, true), true);
  assert.equal(cards.showCardsBlock(() => false, false), false);
  assert.equal(cards.showCardsBlock(set('muertos:12'), false), true, 'stays after 2 November');
});

test('W7-G1 the hand-over waits for BAYBAY: never before 1.4 s, after 0.8 s of quiet, over nothing busy; at 14 s regardless of chatter', () => {
  const base = { waited: 2, quiet: 1, busy: false, otherOverlay: false };
  assert.equal(run.cardMayOpen(base), true);
  assert.equal(run.cardMayOpen({ ...base, waited: 1 }), false);
  assert.equal(run.cardMayOpen({ ...base, quiet: 0.5 }), false, 'the thanks and its milestone line are 0.25 s apart');
  assert.equal(run.cardMayOpen({ ...base, otherOverlay: true }), false);
  assert.equal(run.cardMayOpen({ ...base, busy: true, waited: 60 }), false, 'never over a dialogue or a city postcard');
  assert.equal(run.cardMayOpen({ ...base, quiet: 0, waited: run.CARD_MAX_WAIT }), true, 'at 14 s over her chatter');
  // W7-G-review: the 14 s only outlasts BAYBAY's chatter — never another lane's overlay (the claw machine, the crab net,
  // the sourdough, a slide's chip, the shop sheet, the album): the card's dim would cover a game while it runs
  assert.equal(run.cardMayOpen({ ...base, quiet: 0, otherOverlay: true, waited: run.CARD_MAX_WAIT }), false);
  assert.equal(run.cardMayOpen({ ...base, otherOverlay: true, waited: 600 }), false);
});

test('W7-G1 in play: a treat pays door:n → the card opens after the bubble, kept → BAYBAY says where it went; earned before → no pop-up', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  save.resetSaveCache();
  save.clearSave();
  const offLedger = L.initLedger();
  const offIds = registerHalloweenRewards();
  const d = TREAT_DOORS.filter(x => !x.gone);
  // a card earned before the wiring ran: no pop-up (it shows in the notebook)
  L.pay(`halloween:door:${d[0].n}`, 5);
  game.set({ phase: 'playing' });
  const r = run.initHalloweenPostcards();
  const opened = () => slots.openOverlays().filter(o => o.id === run.H_POSTCARD_OVERLAY);
  try {
    mock.timers.tick(20_000);
    assert.equal(opened().length, 0);
    assert.deepEqual(r.pending(), []);
    // the big night's first treat: BAYBAY is talking
    flow.set({ bubble: { who: 'baybay', text: hLine('w6g-thanks'), key: 1, tone: 'bark' } });
    L.pay(`halloween:night:${d[1].n}`, 5);
    assert.deepEqual(r.pending(), ['halloween-big-night']);
    mock.timers.tick(3000);
    assert.equal(opened().length, 0, 'not over her bubble');
    flow.set({ bubble: null });
    // (review of the first play: the card opened over the journal) — never over a side panel, however long it waits
    game.set({ panel: { ...game.get().panel, kind: 'journal' } as never });
    mock.timers.tick(30_000);
    assert.equal(opened().length, 0, 'not over the journal');
    game.set({ panel: { ...game.get().panel, kind: null } as never });
    // W7-G-review: nor over another lane's overlay (a mini-game's panel), however long it waits
    const offGame = slots.registerOverlay({ id: 'play-claw', Component: () => null });
    slots.openOverlay('play-claw');
    mock.timers.tick(30_000);
    assert.equal(opened().length, 0, 'not over a running mini-game');
    slots.closeOverlay('play-claw');
    offGame();
    mock.timers.tick(1000);
    assert.deepEqual(opened().map(o => (o.props as { id: string }).id), ['halloween-big-night']);
    // kept: the overlay closes, BAYBAY's fixed line (lane X voices it)
    slots.closeOverlay(run.H_POSTCARD_OVERLAY);
    assert.deepEqual(flow.get().bubble?.text, hLine('w7g-postcard-keep'));
    // the same card is not handed over twice in a save
    L.pay(`halloween:night:${d[2].n}`, 5);
    mock.timers.tick(20_000);
    assert.equal(opened().length, 0);
    // a Settings reset drops what is waiting
    L.pay('halloween:muertos:12', 10);
    assert.deepEqual(r.pending(), ['muertos-mission']);
    save.clearSave();
    L.pay('halloween:costume:first', 10);
    assert.deepEqual(r.pending(), []);
  } finally {
    r.off();
    offIds();
    offLedger();
    flow.set({ bubble: null });
    game.set({ phase: 'title' });
    save.clearSave();
    mock.timers.reset();
  }
});

test('W7-G1 the wave-7 lines: fixed texts for lane X (unique, short, apart from the recorded wave-6 table)', () => {
  const w6 = new Set(HALLOWEEN_LINES.flatMap(l => [l.id, l.zh, l.en]));
  const ids = new Set<string>();
  for (const l of W7_HALLOWEEN_LINES) {
    assert.match(l.id, /^w7g-[a-z0-9-]+$/);
    assert.ok(!ids.has(l.id), l.id);
    ids.add(l.id);
    assert.ok(!w6.has(l.id) && !w6.has(l.zh) && !w6.has(l.en), `${l.id} is new`);
    assert.ok([...l.zh].length <= 45 && l.en.length <= 110, l.id);
    assert.ok(!/\$\{|\d/.test(l.zh + l.en), `${l.id}: no number or template in a voiced line`);
    assert.deepEqual(hLine(l.id), { zh: l.zh, en: l.en });
  }
  assert.ok(ids.has('w7g-postcard-keep'));
});
