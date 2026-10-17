import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { PUBLIC_CATALOG_FILES } from '../src/data/public-catalog-holdout';
import { WEEKEND_PICKS } from '../src/data/weekend-picks';
import { getBayAreaToday } from '../src/lib/monthly';
import { buildWeekendPicksExport } from '../src/lib/weekend-picks-export';

// The editor's weekend picks for the API (src/lib/weekend-picks-export.ts says what goes in; public-catalog-holdout.ts lists
// who reads which public file). Nothing on the site fetches it. An optional path argument writes the same file there too.
const planning = new Map(PLANNER_EVENTS.map(event => [event.id, event.planning]));
const file = buildWeekendPicksExport(getBayAreaToday(), WEEKEND_PICKS, MONTHLY_EVENTS, id => planning.get(id));
const listed = Object.entries(WEEKEND_PICKS).filter(([saturday]) => file.weekends.some(weekend => weekend.start === saturday));
for (const [saturday, list] of listed) {
  const kept = new Set(file.weekends.find(weekend => weekend.start === saturday)!.picks.map(pick => pick.id));
  const skipped = list.filter(entry => !kept.has(entry.id)).map(entry => entry.id);
  if (skipped.length) console.warn(`Warning: weekend ${saturday} picks not in the catalog on that weekend, left out: ${skipped.join(', ')}`);
}
const destinations = [resolve(PUBLIC_CATALOG_FILES.apiWeekendPicks), ...(process.argv[2] ? [resolve(process.argv[2])] : [])];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(file, null, 2)}\n`);
}
console.log(`Exported ${file.weekends.reduce((sum, weekend) => sum + weekend.picks.length, 0)} weekend picks for ${file.weekends.length} weekend(s) to ${destinations.length} file(s).`);
