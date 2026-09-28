import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { dayRoll, markToday, usedToday } from './gates';
import { type EggHost, fx, isFound, props, reveal, say, sound } from './hosts';
import { eggById, FORTUNES } from './registry';

/**
 * Wave 5 · lane D (W5-D3) · egg 5, the fortune-cookie trail: a cookie at the Japanese Tea Garden's gate (Golden Gate
 * Park: a little stand in the prop pool) and one in Ross Alley, Chinatown (downtown: a prompt only). One cookie a Bay day
 * at each; the slip is one of BAYBAY's fortunes (registry FORTUNES), the same all day for everyone at that spot and new
 * the next day. The first cookie is the find; each spot tells its own line once. Nothing is lost for skipping a day.
 */

const EGG = 'fortune-cookie-trail';
export type CookieSpot = 'tea' | 'ross';
export const TOMORROW_LINE: Bilingual = { zh: '今天的饼干拿过啦，明天可能不一样哦。', en: 'You had today’s cookie — tomorrow’s may be different.' };

/** Today's slip at a spot (stable for the Bay date). */
export function fortuneFor(spot: CookieSpot, dateKey?: string): Bilingual {
  return FORTUNES[Math.floor(dayRoll(`fortune:${spot}`, dateKey) * FORTUNES.length) % FORTUNES.length];
}

export function cookiesHost(): EggHost {
  const egg = eggById(EGG)!;
  const [tea, ross] = [egg.at, egg.also![0]];
  const standAt = { x: tea.x + 1.2, z: tea.z + 0.8 };
  props.set(`egg:${EGG}:tea`, { kind: 'cookie', x: standAt.x, z: standAt.z, heading: 0.6 });
  const said = new Set<CookieSpot>();
  const take = (spot: CookieSpot) => {
    const at = spot === 'tea' ? tea : ross;
    if (usedToday(`cookie:${spot}`)) { say(TOMORROW_LINE); return; }
    markToday(`cookie:${spot}`);
    sound('egg:cookie', at, { near: 6, far: 30 });
    fx('sparkle', at.x, heightAt(at.x, at.z) + 1.4, at.z, { count: 8, color: '#f6e1a8' });
    const line = egg.lines[spot === 'tea' ? 0 : 1];
    const slip = fortuneFor(spot);
    const firstEver = !isFound(EGG);
    // the spot's own line once (this session), then the slip
    const lines = said.has(spot) ? [slip] : [line, slip];
    said.add(spot);
    if (firstEver) reveal(EGG, { lines, cardDelay: 2.2 });
    else { reveal(EGG, { lines: false }); say(lines); }
  };
  const prompt = (spot: CookieSpot) => {
    const at = spot === 'tea' ? standAt : ross;
    return {
      id: `egg:${EGG}:${spot}`, source: 'find' as const, action: 'taste' as const,
      verb: spot === 'tea' ? { zh: '拿一块幸运饼干', en: 'Take a fortune cookie' } : { zh: '尝一块饼干', en: 'Try a cookie' },
      name: egg.name, x: at.x, z: at.z, radius: 3, act: () => take(spot),
    };
  };
  return {
    id: EGG,
    range: 30,
    interactables: () => [prompt('tea'), prompt('ross')],
    dispose: () => props.set(`egg:${EGG}:tea`, null),
    qa: () => take('tea'),
  };
}
