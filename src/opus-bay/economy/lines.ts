import { emit } from '../core/events';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { baybayHeld } from '../game/baybayHold';
import { cinemaActive } from '../game/cinema';
import { travelActive } from '../game/fastTravel';
import { bubble, dialogueOpen } from '../game/flow';
import { flow } from '../game/flowStore';

/**
 * Wave 5 · lane E · BAYBAY's lines for the 小铺, the 飞行券 and the 手帐 (VOICE.md: 金币, 小铺, 手帐, 小发现, 看风景, 飞行券;
 * zh ≤ 45 characters — tests/opus-bay-w5-shop.test.ts). The voice ids are `e-<key>` (lane V records the frozen set;
 * until then the `voice-line` event plays her chirp).
 *
 * sayWhenFree(key) waits for a quiet moment (playing, no dialogue, cinematic, flight, photo, postcard or goals step —
 * lane C's bubble() drops a line said over those) and tries again every 1.5 s for up to `patienceS`.
 */

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export const E_LINES = {
  ticketGift: bi('送你一张飞行券！还没有鹈鹕时，想去远处就问我。', 'Here’s a flight ticket! Before the pelican, ask me and we’ll fly once.'),
  ticketRefund: bi('有鹈鹕啦，飞行券用不上了，还你 10 金币。', 'We have the pelican now — here are 10 coins back for the ticket.'),
  ticketFly: bi('抓稳啦，飞行券出发！', 'Hold on — the ticket takes us there!'),
  compassOn: bi('罗盘转起来了！跟着箭头走，我闻到宝贝了。', 'The compass is spinning! Follow the arrow — I can smell treasure.'),
  compassDone: bi('找到啦！罗盘这一趟的魔法用完了。', 'Found it! The compass is done for this outing.'),
  magnifierOn: bi('放大镜看看……附近的明信片插上小旗啦。', 'Let’s look closer… the nearest postcards have little flags.'),
  magnifierDone: bi('明信片到手！放大镜收起来喽。', 'Got the postcard! The magnifier goes back in the bag.'),
  bought: bi('好看！买下啦。', 'Looks great! It’s yours.'),
  pageStamps: bi('手帐「印章」集满啦！送你一个邮戳相框。', 'The Stamps page is full! A postmark frame for you.'),
  pageFinds: bi('手帐「小发现」集满啦！小铺里多了条寻宝金围巾，我想戴！', 'The Finds page is full! A treasure-gold scarf is in the shop now — can I wear it?'),
  pageViews: bi('手帐「看风景」集满啦！送你金色时刻相框。', 'The Views page is full! A golden-hour frame for you.'),
  pageSounds: bi('城市之声都听全啦！送你一个城市之声相框。', 'We heard every city sound! A city-sounds frame for you.'),
} as const;
export type ELineKey = keyof typeof E_LINES;

/** A quiet moment for a bubble (the gates lane C's and R's lines use). */
export function quietNow(): boolean {
  const s = game.get(), f = flow.get();
  return s.phase === 'playing' && !s.paused && s.mode !== 'onboarding' && !dialogueOpen() && !cinemaActive() && !f.cinematic && !travelActive()
    && s.move.mode !== 'travel' && !s.photoMode && !f.postcardReward && !f.postcardFly && !f.fishing
    && !baybayHeld(); // W8-K1 (lane K, surgical): a play panel, an egg card, the Halloween postcard… (not the shop)
}

const pending = new Map<ELineKey, ReturnType<typeof setTimeout>>();

/** Say one of E's lines now if it is quiet, else when it is (tries every 1.5 s for `patienceS`). */
export function sayWhenFree(key: ELineKey, patienceS = 120, ms = 4200): void {
  const old = pending.get(key);
  if (old) clearTimeout(old);
  const until = performance.now() + patienceS * 1000;
  const attempt = () => {
    pending.delete(key);
    const text = E_LINES[key];
    if (quietNow() && !flow.get().bubble) {
      bubble(text, ms);
      if (flow.get().bubble?.text === text) { emit({ type: 'voice-line', id: `e-${key}` }); return; }
    }
    if (performance.now() < until) pending.set(key, setTimeout(attempt, 1500));
  };
  attempt();
}

/** Forget the waiting lines (teardown). */
export function dropLines(): void { for (const t of pending.values()) clearTimeout(t); pending.clear(); }
