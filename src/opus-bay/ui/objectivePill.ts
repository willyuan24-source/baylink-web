import { journalTabs, openJournal } from './slots';

/**
 * W5-F9 (plan MF6 "goals once", lane C's request): in the city the top-right pill opens the journal — on lane R's 今天
 * once that tab is registered, else on 目标 (the goals) — and never toggles a hidden goals card (the district keeps its
 * card: ui/Hud.tsx).
 */
export function openObjectiveJournal(): void {
  openJournal(journalTabs.get('today') ? 'today' : 'goals');
}
