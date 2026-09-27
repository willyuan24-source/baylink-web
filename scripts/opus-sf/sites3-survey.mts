// Site survey for the wave-4 TIER-3 sites (lane L3): scripts/opus-sf/sites-survey.mts (lane L's, unchanged) with the
// tier-3 records appended to the list it searches for --site, so it draws a tier-3 site's model, exclusion, blockers,
// ground, arrival and flag over the published city. Same arguments:
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/sites3-survey.mts --out C:/Users/willy/opus-qa/w4/w4-l3/survey --site <id> [--r 40 --px 10]
//
// The append happens in this process only (the survey imports w4sites.ts' list and finds the same array).
import type { W4Site } from '../../src/opus-bay/world/sf/landmarks/siteKit';
import { W4_SITES } from '../../src/opus-bay/world/sf/landmarks/w4sites';
import { W4_SITES_T3 } from '../../src/opus-bay/world/sf/landmarks/w4list3';

(W4_SITES as W4Site[]).push(...W4_SITES_T3);
await import('./sites-survey.mts');
