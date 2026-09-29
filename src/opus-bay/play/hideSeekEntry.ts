import { Search } from 'lucide-react';
import { registerAskItem } from '../ui/slots';

/**
 * Wave 6 · lane W · the way into 捉迷藏 (play/hideSeek.ts, its own small chunk): an item in BAYBAY's menu (问 BAYBAY →
 * 捉迷藏 — the Ask button, then one tap: phones and keyboards alike), shown while a round may start, and (W6-W5) the one
 * coach line that tells a new player it is there. play/index.ts init() registers it with the other ask items.
 */
let mod: typeof import('./hideSeek') | null = null;
const load = () => import('./hideSeek').then(m => (mod = m));

export function registerHideSeek(): () => void {
  let offCoach: (() => void) | null = null, gone = false;
  void load().then(m => { if (!gone) offCoach = m.startHideCoach(); }).catch(() => { /* the item stays hidden */ });
  const offItem = registerAskItem({
    id: 'play-hide-seek', order: -15, label: { zh: '捉迷藏', en: 'Hide & seek' }, icon: Search,
    visible: () => !!mod && mod.hideSeekAllowed(),
    onSelect: () => { void load().then(m => { m.startHideSeek(); }); },
  });
  return () => { gone = true; offCoach?.(); offItem(); };
}
