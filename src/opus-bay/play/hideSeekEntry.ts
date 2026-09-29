import { Search } from 'lucide-react';
import { registerAskItem } from '../ui/slots';

/**
 * Wave 6 · lane W · the way into 捉迷藏 (play/hideSeek.ts, its own small chunk): an item in BAYBAY's menu (问 BAYBAY →
 * 捉迷藏 — the Ask button, then one tap: phones and keyboards alike), shown while a round may start. play/index.ts
 * init() registers it with the other ask items.
 */
let mod: typeof import('./hideSeek') | null = null;
const load = () => import('./hideSeek').then(m => (mod = m));

export function registerHideSeek(): () => void {
  void load().catch(() => { /* the item stays hidden */ });
  return registerAskItem({
    id: 'play-hide-seek', order: -15, label: { zh: '捉迷藏', en: 'Hide & seek' }, icon: Search,
    visible: () => !!mod && mod.hideSeekAllowed(),
    onSelect: () => { void load().then(m => { m.startHideSeek(); }); },
  });
}
