/**
 * A listing whose source is a press report: the one prefix rule in src/lib/event-facts.ts (a label that starts with
 * 「媒体报道 · 」). Such an item never says 官网核对 (UI-9 DECISIONS 17, owner confirmed 10-19): a card reads
 * 「媒体报道 · M/D 核对」, and a list's head says how many of its items are reports. Read from the sourceLabel, no data edit
 * (generate-events-index.ts writes it into the index as `press`).
 */
export { isPressSource } from '../../lib/event-facts';
