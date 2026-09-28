import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { seaLionMonth, type SeaLionMonth } from './gates';
import { type EggHost, flock, fx, isFound, momentFree, reveal, say, sound } from './hosts';
import type { BirdPath } from './props';
import { heard } from './listen';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D3) · the Wharf and the Bay: egg 2 (PIER 39's sea lions by the real month), egg 3 (the arcade's
 * laughing lady), egg 11 (a pelican loop round Alcatraz).
 */

// --- egg 2 · the sea lions follow the real month ----------------------------------------------------------------

const SEA = 'pier39-sea-lion-season';
/**
 * The month line (Bay month through game/bayNow): PIER 39 says numbers rise and fall with the seasons; Wikipedia's Pier 39
 * page: in June and July most leave temporarily for their breeding grounds near the Channel Islands (both read
 * 2026-09-28). Never a count; "usually" words.
 */
export const SEA_LION_MONTH_LINES: Readonly<Record<SeaLionMonth, Bilingual>> = {
  away: { zh: '六七月大多数海狮南下生宝宝，所以浮台空了一些。', en: 'In June and July most of them head south to have pups — the docks look emptier.' },
  returning: { zh: '夏天过后，海狮通常会陆续回到浮台上来。', en: 'After the summer they usually drift back to the docks.' },
  home: { zh: '这个季节，浮台上通常很热闹——听听它们在聊什么！', en: 'This time of year the docks are usually busy — listen to them chat!' },
};
/** How loud the barks are by month (0 … 1). */
export const SEA_LION_LOUDNESS: Readonly<Record<SeaLionMonth, number>> = { away: 0.35, returning: 0.65, home: 1 };

export function seaLionsHost(): EggHost {
  const egg = eggById(SEA)!;
  let still = 0;
  let saidThisVisit = false;
  let monthSaid = false;
  const play = () => {
    const m = seaLionMonth();
    sound('egg:sealions', { x: egg.at.x - 6, z: egg.at.z - 8 }, { near: 10, far: 80, gain: SEA_LION_LOUDNESS[m] });
    return m;
  };
  return {
    id: SEA,
    range: 40,
    enter: () => { saidThisVisit = false; },
    update: ctx => {
      const near = ctx.dist <= 9 && runtime.move.mode === 'foot' && runtime.player.speed < 1.2;
      still = near && !ctx.busy ? still + ctx.dt : 0;
      if (still < 1.5 || saidThisVisit || !momentFree()) return;
      saidThisVisit = true;
      const m = play();
      // found before: the month line once a session (the barks every visit)
      if (!reveal(SEA, { lines: [SEA_LION_MONTH_LINES[m], ...egg.lines] }) && !monthSaid) say(SEA_LION_MONTH_LINES[m]);
      monthSaid = true;
    },
    qa: () => { const m = play(); reveal(SEA, { lines: [SEA_LION_MONTH_LINES[m], ...egg.lines] }); },
  };
}

// --- egg 3 · the laughing lady at the arcade door ---------------------------------------------------------------

const LADY = 'musee-laughing-lady';

export function laughingLadyHost(): EggHost {
  const egg = eggById(LADY)!;
  let busyUntil = 0;
  let clock = 0;
  const laugh = () => {
    if (clock < busyUntil) return;
    busyUntil = clock + 4.5;
    sound('egg:cackle', egg.at, { near: 6, far: 40 });
    const first = !isFound(LADY);
    // BAYBAY cannot help laughing along: always the first time, then about one time in five
    const giggle = first || Math.random() < 0.2;
    if (giggle) setTimeout(() => sound('egg:giggle', { x: runtime.guide.x, z: runtime.guide.z }, { near: 6, far: 40 }), 1400);
    if (!reveal(LADY, { lines: [egg.lines[0], egg.lines[1]], cardDelay: 3 }) && giggle) say(egg.lines[1]);
    // (part c) listening at the door: once the laugh has rung out, it joins 城市之声 (its card after the egg's)
    setTimeout(() => { heard('laughing-lady'); }, 2600);
  };
  return {
    id: LADY,
    range: 30,
    update: ctx => { clock = ctx.t; },
    interactables: () => [{
      id: `egg:${LADY}`, source: 'find', action: 'info', verb: { zh: '听听笑声', en: 'Listen at the door' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 3, act: laugh,
    }],
    qa: laugh,
  };
}

// --- egg 11 · a pelican loop round Alcatraz ---------------------------------------------------------------------

const ISLAND = 'alcatraz-pelican-island';
/** the loop counts while the glide is between these distances of the island's centre (u): round it, not over it */
export const LOOP_BAND = { min: 22, max: 230 } as const;

/** Accumulates the winding angle of a path round a centre; a full turn (either way) is one loop. */
export class LoopCounter {
  private last: number | null = null;
  private acc = 0;
  readonly cx: number;
  readonly cz: number;
  readonly band: { min: number; max: number };
  constructor(cx: number, cz: number, band: { min: number; max: number } = LOOP_BAND) { this.cx = cx; this.cz = cz; this.band = band; }
  reset() { this.last = null; this.acc = 0; }
  /** feed a position; true when this step closed a full loop (the counter restarts for the next one) */
  step(x: number, z: number): boolean {
    const d = Math.hypot(x - this.cx, z - this.cz);
    if (d < this.band.min || d > this.band.max) { this.reset(); return false; }
    const a = Math.atan2(z - this.cz, x - this.cx);
    if (this.last !== null) {
      let da = a - this.last;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      this.acc += da;
    }
    this.last = a;
    if (Math.abs(this.acc) >= Math.PI * 2) { this.acc = 0; return true; }
    return false;
  }
  get turned() { return this.acc; }
}

/** Five pelicans swooping in from the sides to fly a V just ahead of the player's pelican, then peeling away. */
export function pelicanEscort(seconds = 7): BirdPath {
  return (t, i) => {
    const g = runtime.glide;
    if (!g.active && t > 0.5) return null;
    const side = i % 2 ? 1 : -1, rank = Math.floor(i / 2) + 1;
    const fx0 = Math.sin(g.heading), fz0 = Math.cos(g.heading);
    const rx = Math.cos(g.heading), rz = -Math.sin(g.heading);
    // a loose V AHEAD of the player's pelican (seen from the follow camera behind it), rising a little with rank
    const back = -(4 + 2.6 * rank), out = 3.4 * rank * side;
    const peel = Math.max(0, t - (seconds - 1.8)) * 9;
    const enter = Math.max(0, 1 - t / 1.4) ** 2 * 26 * side;
    return {
      x: g.x - fx0 * back + rx * (out + peel * side + enter),
      y: g.y + 0.6 * rank - 0.4 + Math.sin(t * 3 + i) * 0.3 + peel * 0.4,
      z: g.z - fz0 * back + rz * (out + peel * side + enter),
      heading: g.heading + side * Math.min(0.5, peel * 0.05),
      flap: Math.sin(t * 7 + i * 1.3),
    };
  };
}

export function alcatrazHost(): EggHost {
  const egg = eggById(ISLAND)!;
  const loop = new LoopCounter(egg.at.x, egg.at.z);
  let loops = 0;
  const closed = () => {
    loops++;
    const g = runtime.glide;
    sound('egg:whoosh');
    fx('sparkle', g.x, g.y + 1, g.z, { count: 14, color: '#ffffff' });
    flock.start('pelican', 5, 7, pelicanEscort());
    // the name the first time, the occupation's words on the water tower the second time (respectful, no jokes)
    if (loops === 1) { if (!reveal(ISLAND, { lines: [egg.lines[0]] })) say(egg.lines[0]); }
    else if (loops === 2) say(egg.lines[1]);
  };
  return {
    id: ISLAND,
    range: LOOP_BAND.max + 40,
    update: () => {
      const g = runtime.glide;
      if (!g.active) { loop.reset(); return; }
      if (loop.step(g.x, g.z)) closed();
    },
    leave: () => loop.reset(),
    qa: closed,
  };
}
