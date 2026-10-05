import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { guides } from '../src/data/guides';
import { CITY_EXPLORATIONS, CITY_CURRENT_UPDATES } from '../src/data/guides-city-exploration';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { auditMediaCoverage } from './audit-media-coverage';

const start = process.argv[2] || '2026-10-05';
const through = process.argv[3] || '2026-11-15';
const countBy = <T,>(rows: T[], key: (row:T)=>string) => Object.fromEntries([...new Set(rows.map(key))].sort().map(value=>[value,rows.filter(row=>key(row)===value).length]));
const activeEvents = MONTHLY_EVENTS.filter(event=>event.startDate<=through && event.endDate>=start && (event.occurrenceDates === undefined || event.occurrenceDates.some(day=>day>=start && day<=through && day>=event.startDate && day<=event.endDate)));
const november = activeEvents.filter(event=>event.endDate>='2026-11-01' && (!event.occurrenceDates || event.occurrenceDates.some(date=>date>='2026-11-01' && date<=through)));
const activeOffers = currentFreebies.filter(offer=>(!offer.startDate || offer.startDate<=through) && (!offer.endDate || offer.endDate>=start));
console.log(JSON.stringify({
  start, through,
  inventory: { cities: CITY_EXPLORATIONS.length, places: CITY_EXPLORATIONS.reduce((n,c)=>n+c.places.length,0), guides: guides.length, events:MONTHLY_EVENTS.length, offers:currentFreebies.length, openings:currentOpenings.length, bulletins:currentRegionalBulletins.length },
  cityCoverage: CITY_EXPLORATIONS.map(city=>({city:city.city,county:city.county,places:city.places.map(p=>p.name),checked:city.verifiedAt,current:city.currentUpdate?.headline})),
  activeEvents: { total:activeEvents.length, byRegion:countBy(activeEvents,event=>event.region),byCategory:countBy(activeEvents,event=>event.category),novemberThrough15:november.map(event=>({id:event.id,title:event.title,city:event.city,start:event.startDate,end:event.endDate,days:event.occurrenceDates})) },
  activeOffers:activeOffers.map(offer=>({id:offer.id,title:offer.title,date:offer.dateLabel,availability:offer.availability,kind:offer.kind})),
  cityUpdates: CITY_CURRENT_UPDATES.map(update=>({city:update.city,title:update.headline,date:update.dateLabel,kind:update.kind})),
  media:auditMediaCoverage(),
},null,2));
