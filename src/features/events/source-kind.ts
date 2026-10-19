/**
 * A listing whose source is a press report ("媒体报道 · patch.com", "SFGATE 10/3 开业报道"), not the organiser's or the shop's
 * own page: the same test as eventOrganizer in src/lib/schema-org.ts (copied, so the events chunk does not load that module).
 * Such an item never says 官网核对 (UI-9 DECISIONS 17, owner confirmed 10-19): a card reads 「媒体报道 · M/D 核对」, and a
 * list's head says how many of its items are reports. Read from the sourceLabel, no data edit (generate-events-index.ts
 * writes it into the index as `press`).
 */
export const PRESS_SOURCE = /媒体报道|新闻|报道|media|news/i;
export const isPressSource = (label: string | undefined) => !!label && PRESS_SOURCE.test(label);
