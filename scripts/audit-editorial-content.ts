import { readFileSync, writeFileSync } from 'node:fs';
import { guides } from '../src/data/guides';
import { CITY_CURRENT_UPDATES } from '../src/data/guides-city-exploration';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { getBayAreaToday } from '../src/lib/monthly';
import { EVENT_OVERLAY, OFFER_OVERLAY, OPENING_OVERLAY, PRE_OVERLAY } from '../src/data/editorial-overlay/apply';
import { basisFor, lintEditorial, overlayCoverage, readEnglishSources, type Basis } from '../src/data/editorial-overlay/lint';

// Usage: tsx scripts/audit-editorial-content.ts [YYYY-MM-DD] [--strict] [--write-basis]
//   --strict       exit 1 when an item with an overlay entry has an editorial lint error (content.md §4.4)
//   --write-basis  record the source fields each overlay entry was written against (src/data/editorial-overlay/basis.json)
const args = process.argv.slice(2);
const today = args.find(arg => /^\d{4}-\d{2}-\d{2}$/.test(arg)) || getBayAreaToday();
const BASIS_FILE = 'src/data/editorial-overlay/basis.json';
if (args.includes('--write-basis')) {
  const rows = Object.entries(basisFor(PRE_OVERLAY)).map(([key, fields]) => `${JSON.stringify(key)}: ${JSON.stringify(fields)}`);
  writeFileSync(BASIS_FILE, `{\n${rows.join(',\n')}\n}\n`);
}

const canonical = (value: string) => { const url = new URL(value); return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`; };
const duplicates = <T,>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) { const identity = key(item); groups.set(identity, [...(groups.get(identity) || []), item]); }
  return [...groups].filter(([, group]) => group.length > 1).map(([identity, rows]) => ({ identity, rows }));
};
const urls = new Map<string, string[]>();
const visit = (value: unknown, owner: string) => {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) { const old = urls.get(value) || []; if (!old.includes(owner)) old.push(owner); urls.set(value, old); }
  else if (Array.isArray(value)) value.forEach(item => visit(item, owner));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => visit(item, owner));
};
CITY_CURRENT_UPDATES.forEach(item => visit(item, `city:${item.city}`));
guides.forEach(item => visit(item, `guide:${item.slug}`));
MONTHLY_EVENTS.forEach(item => visit(item, `event:${item.id}`));
currentFreebies.forEach(item => visit(item, `offer:${item.id}`));
currentOpenings.forEach(item => visit(item, `opening:${item.id}`));
currentRegionalBulletins.forEach(item => visit(item, `bulletin:${item.id}`));

let basis: Basis | undefined;
try { basis = JSON.parse(readFileSync(BASIS_FILE, 'utf8')); } catch { basis = undefined; }
const overlay = { events: EVENT_OVERLAY, offers: OFFER_OVERLAY, openings: OPENING_OVERLAY };
const english = readEnglishSources(path => readFileSync(path, 'utf8'));
const issues = lintEditorial({ events: MONTHLY_EVENTS, offers: currentFreebies, openings: currentOpenings, overlay, english, from: today, sources: PRE_OVERLAY, basis });
const errors = issues.filter(issue => issue.level === 'error');
const byRule = (level: string) => Object.fromEntries([...issues.filter(issue => issue.level === level).reduce((counts, issue) => counts.set(issue.rule, (counts.get(issue.rule) ?? 0) + 1), new Map<string, number>())].sort());

console.log(JSON.stringify({
  checkedAt: today,
  inventory: { cityUpdates: CITY_CURRENT_UPDATES.length, guides: guides.length, events: MONTHLY_EVENTS.length, offers: currentFreebies.length, openings: currentOpenings.length, bulletins: currentRegionalBulletins.length },
  duplicateEvents: duplicates(MONTHLY_EVENTS, item => `${canonical(item.officialUrl)}|${item.city}|${item.startDate}|${item.endDate}`).map(({identity,rows})=>({identity,ids:rows.map(item=>item.id)})),
  dateProblems: MONTHLY_EVENTS.filter(item => item.startDate > item.endDate || item.verifiedAt > today || item.occurrenceDates?.some(day => day < item.startDate || day > item.endDate)).map(item=>item.id),
  sourceUrls: [...urls.entries()].filter(([url]) => !/^https:\/\/(www\.)?(google\.com\/maps|maps\.google)/.test(url)).map(([url, owners])=>({url,owners})),
  missingPhotos: [...MONTHLY_EVENTS, ...currentFreebies, ...currentOpenings, ...currentRegionalBulletins].filter(item=>!GUIDE_IMAGES[item.imageKey]).map(item=>item.id),
  editorial: {
    coverage: overlayCoverage({ events: MONTHLY_EVENTS, overlay, from: today }),
    errors: byRule('error'),
    warnings: byRule('warn'),
    errorList: errors,
  },
}, null, 2));
if (args.includes('--strict') && errors.length) {
  console.error(`${errors.length} editorial lint errors on items with an overlay entry`);
  process.exitCode = 1;
}
