import type { MonthlyEvent, MonthlyRegion } from '../data/monthly-types';
import { EVENT_DATE_OVERRIDES } from '../data/event-calendar-dates';
import { addCalendarDays, eventOccursOn, validCalendarDay } from './event-calendar';

export const COVERAGE_REGIONS: MonthlyRegion[] = ['sf', 'east-bay', 'south-bay', 'peninsula', 'north-bay'];
export const COVERAGE_CATEGORIES = ['culture', 'outdoors', 'food', 'family', 'performance', 'sports'] as const;
type CoverageCategory = typeof COVERAGE_CATEGORIES[number];
type DateBasis = 'explicit-dates' | 'catalog-range';
type CoverageEntry = { id: string; region: MonthlyRegion; category: CoverageCategory; dateBasis: DateBasis; dates: string[] };
export type CoverageCounts = { uniqueEvents: number; eventDays: number; calendarDays: number; explicitEventDays: number; rangeEventDays: number };
type CoverageSlice = { startDate: string; endDate: string; total: CoverageCounts; regions: Record<MonthlyRegion, CoverageCounts>; categories: Record<CoverageCategory, CoverageCounts>; cells: { region: MonthlyRegion; category: CoverageCategory; counts: CoverageCounts }[] };

const countEntries = (entries: CoverageEntry[], startDate: string, endDate: string): CoverageCounts => {
  const ids = new Set<string>(), calendarDays = new Set<string>();
  let explicitEventDays = 0, rangeEventDays = 0;
  for (const entry of entries) for (const day of entry.dates) {
    if (day < startDate || day > endDate) continue;
    ids.add(entry.id); calendarDays.add(day);
    if (entry.dateBasis === 'explicit-dates') explicitEventDays += 1;
    else rangeEventDays += 1;
  }
  return { uniqueEvents: ids.size, eventDays: explicitEventDays + rangeEventDays, calendarDays: calendarDays.size, explicitEventDays, rangeEventDays };
};

/** Advisory inventory only: no editorial target or source-verification claim is inferred. */
export function buildContentCoverage(events: MonthlyEvent[], startDate: string, weeks = 8, overrides: Record<string, string[]> = EVENT_DATE_OVERRIDES) {
  if (!validCalendarDay(startDate) || !Number.isInteger(weeks) || weeks < 4 || weeks > 8) throw new Error('Coverage requires a valid start date and 4–8 whole weeks.');
  const endDate = addCalendarDays(startDate, weeks * 7 - 1);
  if (!validCalendarDay(endDate)) throw new Error('Coverage window is outside the supported calendar.');
  const diagnostics: { id: string; issue: string }[] = [];
  const groups = new Map<string, MonthlyEvent[]>();
  for (const event of events) groups.set(event.id, [...(groups.get(event.id) || []), event]);
  const entries: CoverageEntry[] = [];
  for (const [id, records] of groups) {
    // Duplicate IDs are ambiguous catalog records, never additional events.
    if (records.length !== 1) { diagnostics.push({ id, issue: `Duplicate ID (${records.length} records); excluded pending editorial review.` }); continue; }
    const event = records[0];
    if (!id || !validCalendarDay(event.startDate) || !validCalendarDay(event.endDate) || event.startDate > event.endDate) {
      diagnostics.push({ id, issue: 'Invalid catalog date range; excluded.' }); continue;
    }
    const category = event.kind === 'sports' || event.kind === 'performance' ? event.kind : event.category;
    if (!COVERAGE_REGIONS.includes(event.region) || !COVERAGE_CATEGORIES.includes(category)) {
      diagnostics.push({ id, issue: 'Unknown region or category; excluded.' }); continue;
    }
    const explicit = Object.hasOwn(overrides, id) ? overrides[id] : event.occurrenceDates;
    if (explicit?.some(day => !validCalendarDay(day) || day < event.startDate || day > event.endDate)) {
      diagnostics.push({ id, issue: 'Invalid or out-of-range explicit dates ignored; valid dates remain counted.' });
    }
    const dates: string[] = [];
    for (let day = startDate; day <= endDate; day = addCalendarDays(day, 1)) if (eventOccursOn(event, day, overrides)) dates.push(day);
    if (dates.length) entries.push({ id, region: event.region, category, dateBasis: explicit === undefined ? 'catalog-range' : 'explicit-dates', dates });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const slice = (start: string, end: string): CoverageSlice => ({
    startDate: start, endDate: end, total: countEntries(entries, start, end),
    regions: Object.fromEntries(COVERAGE_REGIONS.map(region => [region, countEntries(entries.filter(entry => entry.region === region), start, end)])) as CoverageSlice['regions'],
    categories: Object.fromEntries(COVERAGE_CATEGORIES.map(category => [category, countEntries(entries.filter(entry => entry.category === category), start, end)])) as CoverageSlice['categories'],
    cells: COVERAGE_REGIONS.flatMap(region => COVERAGE_CATEGORIES.map(category => ({ region, category, counts: countEntries(entries.filter(entry => entry.region === region && entry.category === category), start, end) }))),
  });
  const weekly = Array.from({ length: weeks }, (_, i) => slice(addCalendarDays(startDate, i * 7), addCalendarDays(startDate, i * 7 + 6)));
  const emptyCells = weekly.flatMap(week => week.cells.filter(cell => cell.counts.uniqueEvents === 0).map(cell => ({ startDate: week.startDate, endDate: week.endDate, region: cell.region, category: cell.category })));
  return {
    schemaVersion: 1, timezone: 'America/Los_Angeles', startDate, endDate, weekCount: weeks,
    policy: 'advisory-only; no minimum coverage target or release failure',
    definitions: {
      uniqueEvents: 'Distinct catalog event IDs with at least one eligible date. Weekly unique-event counts must not be summed across weeks.',
      eventDays: 'Distinct (event ID, Pacific calendar date) pairs; duplicate explicit dates count once. Not timed sessions, attendance or independent programs.',
      calendarDays: 'Distinct Pacific dates containing at least one catalog event. Not a sum across events or categories.',
      explicitEventDays: 'Event-days listed by the calendar override or occurrenceDates; an explicit empty list contributes zero.',
      rangeEventDays: 'Event-days inferred from an inclusive catalog start/end range. These are not individually verified opening dates or sessions.',
      categories: 'The six monthly-page categories; performance/sports kind takes precedence over the base category.',
      warnings: 'Empty region/category/week cells describe this catalog only, not the absence of local activities. No target has been imposed.',
      sources: 'This report reads the local catalog and calendar overrides. It performs no new official-source verification and changes no review dates.',
    },
    catalogRecords: events.length, catalogUniqueIds: groups.size,
    window: slice(startDate, endDate), weeks: weekly, entries, diagnostics,
    warnings: { emptyCellCount: emptyCells.length, emptyCells },
  };
}

export function contentCoverageMarkdown(report: ReturnType<typeof buildContentCoverage>): string {
  const lines = [
    '# BAYLINK upcoming content coverage', '',
    `Window: ${report.startDate}–${report.endDate} (${report.weekCount} rolling seven-day weeks; ${report.timezone}).`, '',
    '**Advisory only.** Empty cells are editorial review prompts, not release failures or adopted coverage targets.', '',
    ...Object.entries(report.definitions).map(([key, value]) => `- **${key}:** ${value}`), '',
    `Catalog: ${report.catalogRecords} records / ${report.catalogUniqueIds} distinct IDs. Window: ${report.window.total.uniqueEvents} events / ${report.window.total.eventDays} event-days / ${report.window.total.calendarDays} calendar days.`, '',
    '| Week | Unique events | Event-days | Explicit / range days | Calendar days | Empty cells / 30 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...report.weeks.map(week => `| ${week.startDate}–${week.endDate} | ${week.total.uniqueEvents} | ${week.total.eventDays} | ${week.total.explicitEventDays} / ${week.total.rangeEventDays} | ${week.total.calendarDays} | ${week.cells.filter(cell => !cell.counts.uniqueEvents).length} |`), '',
    '## Region × category by week', '', 'Cells show **unique events / event-days**. Zero means this catalog has no dated entry in that cell.', '',
    `| Week | Region | ${COVERAGE_CATEGORIES.join(' | ')} |`, `| --- | --- | ${COVERAGE_CATEGORIES.map(() => '---:').join(' | ')} |`,
    ...report.weeks.flatMap(week => COVERAGE_REGIONS.map(region => `| ${week.startDate} | ${region} | ${COVERAGE_CATEGORIES.map(category => { const counts = week.cells.find(cell => cell.region === region && cell.category === category)!.counts; return `${counts.uniqueEvents} / ${counts.eventDays}`; }).join(' | ')} |`)), '',
    '## Data diagnostics', '',
    ...(report.diagnostics.length ? report.diagnostics.map(item => `- ${item.id}: ${item.issue}`) : ['No duplicate IDs or invalid catalog dates were detected.']), '',
    'The companion JSON includes per-region/category totals and exact counted dates for every event ID. Source freshness must be reviewed separately.', '',
  ];
  return lines.join('\n');
}
