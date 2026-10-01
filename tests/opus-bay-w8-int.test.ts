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
