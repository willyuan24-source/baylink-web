import { guides } from '../src/data/guides';
import { CITY_CURRENT_UPDATES } from '../src/data/guides-city-exploration';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { getBayAreaToday } from '../src/lib/monthly';

const today = process.argv[2] || getBayAreaToday();
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
console.log(JSON.stringify({
  checkedAt: today,
  inventory: { cityUpdates: CITY_CURRENT_UPDATES.length, guides: guides.length, events: MONTHLY_EVENTS.length, offers: currentFreebies.length, openings: currentOpenings.length, bulletins: currentRegionalBulletins.length },
  duplicateEvents: duplicates(MONTHLY_EVENTS, item => `${canonical(item.officialUrl)}|${item.city}|${item.startDate}|${item.endDate}`).map(({identity,rows})=>({identity,ids:rows.map(item=>item.id)})),
  dateProblems: MONTHLY_EVENTS.filter(item => item.startDate > item.endDate || item.verifiedAt > today || item.occurrenceDates?.some(day => day < item.startDate || day > item.endDate)).map(item=>item.id),
  sourceUrls: [...urls.entries()].filter(([url]) => !/^https:\/\/(www\.)?(google\.com\/maps|maps\.google)/.test(url)).map(([url, owners])=>({url,owners})),
  missingPhotos: [...MONTHLY_EVENTS, ...currentFreebies, ...currentOpenings, ...currentRegionalBulletins].filter(item=>!GUIDE_IMAGES[item.imageKey]).map(item=>item.id),
}, null, 2));
