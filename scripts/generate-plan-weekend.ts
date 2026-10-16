import { writeFile } from 'node:fs/promises';
import { loadLocale } from '../src/i18n/locale';
import { buildPlanWeekend } from '../src/features/plan/plan-weekend-snapshot';

// 行程's 本周末精选 (H54): the home catalog's weekend snapshots reduced to the cards /plan shows, with their English and
// images (src/features/plan/plan-weekend-snapshot.ts). Runs after generate-home-catalog.ts (npm run generate:home).
await loadLocale('en');
const snapshot = buildPlanWeekend();
await writeFile('src/data/generated/plan-weekend.json', `${JSON.stringify(snapshot)}\n`);
console.log(`行程 weekend picks: ${Object.keys(snapshot.days).length} days, ${Object.keys(snapshot.events).length} events, ${Object.keys(snapshot.images).length} images.`);
