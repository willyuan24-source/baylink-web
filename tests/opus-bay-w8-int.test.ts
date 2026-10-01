import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 8 · W8-I, the integration fix pass (docs/opus-bay/sf-w8-integration.md): the findings the three integration
 * lenses reported against origin/opus-bay 03ee7dfd that were confirmed and fixed here, each red before its fix.
 *  - W8I-D-1 (lane M, play/grip.ts): the grip's start line is not cut in the same frame by 'bell-first' when the game
 *    starts inside a bell window; the bell line waits its turn and is still said.
 *  - W8I-P-1 (lane M, play/sfgames8.ts): no grip invite after a grip already played this visit.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const TD = await import('../src/opus-bay/data/transit');
const grip = await import('../src/opus-bay/play/grip');
const lines = await import('../src/opus-bay/play/sfgames8Lines');
const kit = await import('../src/opus-bay/play/kit');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src/opus-bay');
const FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = TD.buildTransit(FILE);
const DT = 1 / 30;
const line = (id: string) => DATA.lines.find(l => l.id === id)!;

test('W8I-D-1 grip: started inside a bell window, the start line stays up; the bell line follows after the gap, not in the same frame', () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  grip.__resetGrip();
  const prev = game.get();
  game.set({ phase: 'playing', mode: 'free', photoMode: false, paused: false } as never);
  flow.set({ bubble: null } as never);
  try {
    const l = line('powell-hyde');
    // the first bell of a ride up from Powell & Market: start 5 u before it (inside its 14 u window)
    const probe = new grip.GripGame(l, { s: 30, dir: 1, v: 9, mode: 'run' }, l.length);
    const bell = probe.bells.find(b => b.at > 60)!;
    assert.ok(bell, 'a bell on the climb');
    const car = { s: bell.at - 5, dir: 1 as const, v: 9, mode: 'run' as const };
    const source = () => ({ view: { ...car }, line: l, to: l.length });
    assert.ok(grip.startGrip(source));
    assert.ok(grip.gripGame()!.bellNow, 'the game starts inside a bell window');
    const said: { t: number; zh: string }[] = [{ t: 0, zh: flow.get().bubble!.text.zh }];
    assert.equal(said[0].zh, lines.GRIP_LINES.start.zh);
    for (let i = 0; i < 6 / DT && grip.gripGame(); i++) {
      car.s += car.v * DT;
      stepFrameSystems(DT, i * DT);
      const b = flow.get().bubble;
      if (b && b.text.zh !== said[said.length - 1].zh) said.push({ t: grip.gripGame()!.t, zh: b.text.zh });
    }
    // the crossing's cue is an important line (forced, lane M's rule): it may come early, but never in the start's frame
    const isCross = (s: { zh: string }) => s.zh === lines.GRIP_LINES.cross.zh;
    assert.ok(said[1], `a line after the start: ${JSON.stringify(said)}`);
    assert.ok(said[1].t >= 0.5, `nothing in the start line's own frame: ${JSON.stringify(said)}`);
    const next = said.slice(1).find(s => !isCross(s))!;
    assert.ok(next && next.t >= 2.7, `the start line stays up ~2.8 s before an ordinary line: ${JSON.stringify(said)}`);
    assert.ok(said.some(s => s.zh === lines.GRIP_LINES.bellFirst.zh), `the bell line is still said: ${JSON.stringify(said)}`);
    for (let i = 2; i < said.length; i++) assert.ok(isCross(said[i]) || said[i].t - said[i - 1].t >= 2.1, `gap ${JSON.stringify(said)}`);
  } finally { grip.__resetGrip(); kit.__resetKit(); flow.set({ bubble: null } as never); game.set({ phase: prev.phase, mode: prev.mode, paused: prev.paused } as never); }
});

test('W8I-P-1 grip invite: never after a grip already played this visit (as the busk and foghorn invites)', () => {
  const src = fs.readFileSync(path.join(SRC, 'play/sfgames8.ts'), 'utf8');
  const invite = src.split('\n').find(s => s.includes('!gripInvited &&'))!;
  assert.ok(invite, 'the invite condition');
  assert.match(invite, /!played\.has\('grip'\)/);
});

test('W8I-P-2 / D-4 / P-8 areas: the walkable Alcatraz says 恶魔岛, the Powell & Market turntable says 联合广场; the Dragon Gate, Pier 33 and the bridge keep theirs', async () => {
  const CZ = await import('../src/opus-bay/data/cityZones');
  const places = (JSON.parse(fs.readFileSync(path.join(ROOT, 'public/opus-bay/sf/v1/places.json'), 'utf8')) as { places: { id: string; x: number; z: number }[] }).places;
  const at = (id: string) => places.find(p => p.id === id)!;
  for (const [area, pid] of [['alcatraz', 'alcatraz'], ['union-square', 'union-square']] as const) {
    const row = CZ.LANDMARK_AREAS.find(a => a.id === area)!;
    assert.ok(row, area);
    assert.ok(Math.hypot(row.x - at(pid).x, row.z - at(pid).z) < 1, `${area} sits on places.json ${pid}`);
  }
  // the island: the quay, the cellhouse front, the lens's spot (-452.3, -74.8); the dock's berth
  const { ALCA_TERMINALS } = await import('../src/opus-bay/data/ferry');
  for (const p of [{ x: -452.3, z: -74.8 }, { x: -461, z: -63 }, ALCA_TERMINALS.island.quay, ALCA_TERMINALS.island.berth]) {
    assert.deepEqual(CZ.cityAreaAt(p.x, p.z)?.name, { zh: '恶魔岛', en: 'Alcatraz Island' }, JSON.stringify(p));
  }
  assert.notEqual(CZ.cityAreaAt(-92.8, -18.5)?.id, 'alcatraz', 'Pier 33 is not the island');
  // the turntable (the lens stood at 128.24, 256) and the square
  const turn = at('cable-car-powell-market');
  for (const p of [{ x: 128.24, z: 256 }, turn, at('union-square')]) assert.equal(CZ.cityAreaAt(p.x, p.z)?.id, 'union-square', JSON.stringify(p));
  assert.equal(CZ.cityAreaAt(82, 176)?.id, 'chinatown', 'the Dragon Gate stays Chinatown');
  assert.equal(CZ.cityAreaAt(92.31, 418.18)?.id, 'civic-center');
});

test('W8I-WS-2 a panel holds the otter float line and the 飞行券 gift (their voices played with the bubble off screen under a place card)', async () => {
  const { game: G } = await import('../src/opus-bay/core/store');
  const shop = await import('../src/opus-bay/economy/shopRun');
  const prev = G.get();
  try {
    G.set({ phase: 'playing', mode: 'free', panel: { kind: null }, dialogue: { ...prev.dialogue, nodeId: null } } as never);
    const open = shop.ticketGiftWaits();
    G.set({ panel: { kind: 'poi', id: 'sf:alcatraz' } } as never);
    assert.equal(shop.ticketGiftWaits(), true, 'a place card holds the gift');
    G.set({ panel: { kind: null } } as never);
    assert.equal(shop.ticketGiftWaits(), open, 'closed: as before');
  } finally { G.set({ phase: prev.phase, mode: prev.mode, panel: prev.panel, dialogue: prev.dialogue } as never); }
  const pet = fs.readFileSync(path.join(SRC, 'play/pet.ts'), 'utf8');
  assert.match(pet.split('\n').find(l => l.includes('const idle ='))!, /s\.panel\.kind === null/);
});

test('W8I-D-3 no E prompt while a play activity holds the feet (busk / foghorn showed "E Talk to BAYBAY", and E does nothing)', async () => {
  const L = await import('../src/opus-bay/game/playerLock');
  assert.equal(L.lockHeldBy('activity'), false);
  const off = L.holdLock('activity', 'busk');
  try { assert.equal(L.lockHeldBy('activity'), true); assert.equal(L.lockHeldBy('ride'), false); } finally { off(); }
  assert.equal(L.lockHeldBy('activity'), false);
  const brain = fs.readFileSync(path.join(SRC, 'game/brain.ts'), 'utf8');
  assert.match(brain.split('\n').find(l => l.includes('const blocked ='))!, /lockHeldBy\('activity'\)/);
});

test('W8I-P-3 / D-5 Halloween night after dark: a first visit follows the Bay clock (no golden hour under 今晚是万圣节)', () => {
  const w = fs.readFileSync(path.join(SRC, 'halloween/world.ts'), 'utf8');
  assert.match(w, /phase === 'night' && flow\.get\(\)\.goldenFirstVisit && bayTimeOfDay\(now\) === 'night'\) flow\.set\(\{ goldenFirstVisit: false, timeOffer: null \}\)/);
});

test('W8I-WS-7 the 今天 tab lists days with their own comma apart (it read "Sat, Sun, Oct 11" as one date)', () => {
  const tab = fs.readFileSync(path.join(SRC, 'realsf/TodayTab.tsx'), 'utf8');
  assert.doesNotMatch(tab, /\.join\(t\('、', ', '\)\)/);
  assert.equal((tab.match(/\.join\(t\('、', DAYS_JOIN_EN\)\)/g) ?? []).length, 2);
});
