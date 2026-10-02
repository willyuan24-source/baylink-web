import { game, type GameState } from '../core/store';
import { flow } from '../game/flowStore';
import type { FlowState } from '../game/flowStore';
import { lockHeldBy } from '../game/playerLock';
import { openOverlays } from './slots';

/**
 * W9-A · the browser's back button / the phone's back gesture closes what is open first (review R§6 界面与交互: "浏览器后退
 * （手机返回手势）直接离开游戏"; tech/notes.md "back button: leaves game to / (also with map open)").
 *
 * While something closable is open, one extra history entry (the same URL, `state.obBack`) sits on top. Back pops it and
 * the game gets an Escape — exactly the key's close: the dialogue's cancel row, the open panel, the most recent overlay,
 * photo mode, a game's 放弃. A close from inside the game takes the entry back off (a swallowed history.back()), so with
 * nothing open back leaves the page as it always did. Never strands the player: the entry is only put back while
 * something is still open after the close, and a back whose Escape closed nothing is let through next time.
 *
 * The play layer installs it once (ui/Dialogue.tsx; this module rides in that chunk). The site's router sees a same-URL
 * pop (the state keeps its own `idx` / `key`): nothing navigates.
 */

const MARK = 'w9a';
const TICK_MS = 250;
/** after a back: how long the Escape's close may take to show (React commits the DOM after the store) */
const SETTLE_MS = 180;

type HistoryState = Record<string, unknown> | null;

/** What is open that Escape closes (pure: the stores' state, the open overlays, the DOM's open dialog count). */
export function closableNow(s: Pick<GameState, 'phase' | 'photoMode' | 'panel' | 'dialogue'>, f: Pick<FlowState, 'cinematic' | 'postcardReward' | 'fishing'>, overlays: number, dialogs: number, activity: boolean): string | null {
  if (s.phase !== 'playing' || f.cinematic) return null;
  if (s.photoMode) return 'photo';
  if (overlays) return `overlay:${overlays}`;
  if (s.panel.kind) return `panel:${s.panel.kind}`;
  if (f.postcardReward) return 'postcard';
  if (f.fishing) return 'fishing';
  if (dialogs) return `dialog:${s.dialogue.nodeId ?? ''}:${dialogs}`;
  if (activity) return 'activity';
  return null;
}

/** Open `[role="dialog"]`s of the game an Escape closes (the dialogue box says `data-ob-cancel="0"` when it cannot). */
function openDialogs(doc: Document): number {
  let n = 0;
  for (const el of doc.querySelectorAll<HTMLElement>('.ob-page [role="dialog"]:not([data-ob-cancel="0"])')) {
    if (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : el.offsetParent !== null) n++;
  }
  return n;
}

/**
 * Leaving the game by a link while the guard's entry is on top (Settings › 回到 BAYLINK with Settings open): replace that
 * entry instead of pushing past it, or the site's back would land on the game twice. Returns true when it navigated
 * (the caller then prevents the link's default).
 */
export function leaveOverGuard(href: string, win: Pick<Window, 'history' | 'location'> = window): boolean {
  if ((win.history.state as HistoryState)?.obBack !== MARK) return false;
  win.location.replace(href);
  return true;
}

export function installBackGuard(win: Window = window): () => void {
  const doc = win.document, hist = win.history;
  const now = () => closableNow(game.get(), flow.get(), openOverlays().length, openDialogs(doc), lockHeldBy('activity'));
  const ours = () => (hist.state as HistoryState)?.obBack === MARK;
  /** our own history.back() is in flight: its popstate is ours */
  let popping = false;
  /** a back's Escape that closed nothing: do not catch the next back while this is what is open */
  let stuck: string | null = null;
  let settleUntil = 0;

  const push = () => {
    const state = (hist.state as HistoryState) ?? {};
    try { hist.pushState({ ...state, obBack: MARK }, '', win.location.href); } catch { /* a sandboxed frame: back leaves */ }
  };
  const tick = () => {
    if (popping || performance.now() < settleUntil) return;
    const open = now();
    if (open !== stuck) stuck = null;
    if (open && !stuck && !ours()) push();
    else if (!open && ours()) { popping = true; hist.back(); }
  };
  const escape = () => {
    const at = doc.activeElement instanceof HTMLElement && doc.activeElement !== doc.body ? doc.activeElement : win;
    const init = { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true };
    at.dispatchEvent(new KeyboardEvent('keydown', init));
    at.dispatchEvent(new KeyboardEvent('keyup', init));
  };
  const onPop = () => {
    if (popping) { popping = false; return; }
    const before = now();
    if (!before) return; // nothing open: the player is leaving (or went back past our entry)
    escape();
    settleUntil = performance.now() + SETTLE_MS;
    win.setTimeout(() => {
      const after = now();
      // the Escape closed nothing (a dialog that does not close on Escape): let the next back through
      stuck = after && after === before ? after : null;
      tick();
    }, SETTLE_MS);
  };

  win.addEventListener('popstate', onPop);
  const id = win.setInterval(tick, TICK_MS);
  return () => {
    win.removeEventListener('popstate', onPop);
    win.clearInterval(id);
  };
}
