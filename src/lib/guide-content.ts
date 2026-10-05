import type { GuideBlock } from '../data/guides';
import { BROADBAND_MAP_URL, type UtilityContact } from '../data/utility-types';

const contactText = (contact: UtilityContact) => [contact.name, contact.phone, contact.email, contact.note, contact.url, contact.availabilityUrl, contact.movingUrl].filter(Boolean).join('\n');

/** Keep search and BayBay exports consistent with the complete readable block. */
export const guideBlockText = (block: GuideBlock): string => {
  if (block.type === 'useful-platforms') return [block.title, block.text, ...block.platforms.map(platform => [
    `Platform: ${platform.name} | ${platform.id}`, platform.summary,
    `For: ${platform.bestFor}`, `How: ${platform.howTo}`, `Coverage: ${platform.coverage}`, `Check: ${platform.watchFor}`,
    platform.url, ...platform.sources.map(source => `${source.title}: ${source.description}\n${source.url}`), platform.verifiedAt,
  ].join('\n'))].join('\n\n');
  if (block.type === 'city-exploration') return [block.title, block.text, ...block.cities.map(city => [
    `City guide: ${city.city} | ${city.county}`, city.summary,
    ...city.places.map(place => `${place.name} [${place.scope}]\n${place.description}\n${place.url}\nMap: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery)}`),
    `Visit: ${city.halfDay}`, `New resident: ${city.arrival}`, `Resident: ${city.residentTip}`,
    `Transport: ${city.transport}`, `Check before going: ${city.checks}`,
    ...(city.currentUpdate ? [`City update [${city.currentUpdate.kind}]: ${city.currentUpdate.headline}`, city.currentUpdate.dateLabel, city.currentUpdate.summary, `${city.currentUpdate.sourceLabel}: ${city.currentUpdate.sourceUrl}`, `Update checked: ${city.currentUpdate.checkedAt}`] : []),
    ...city.resources.map(resource => `${resource.label}: ${resource.url}`), city.verifiedAt,
  ].join('\n'))].join('\n\n');
  if (block.type === 'shopping-directory') return [block.title, block.text, ...block.places.map(place => [
    place.name, `${place.city} | ${place.region} | ${place.kind}`, place.address, place.description, place.bestFor,
    place.plan, place.transport, place.caution, place.url, place.directoryUrl, place.visitUrl, place.verifiedAt,
  ].join('\n'))].join('\n\n');
  if (block.type === 'utility-directory') return [block.title, block.text, ...block.cities.map(city => [city.county, city.city, city.notes,
    ...city.water.map(item => `Water: ${contactText(item)}`), ...city.electric.map(item => `Electricity: ${contactText(item)}`),
    ...city.waste.map(item => `Waste: ${contactText(item)}`), `Internet: ${BROADBAND_MAP_URL}`, city.municipalUrl, city.verifiedAt,
  ].filter(Boolean).join('\n'))].join('\n\n');
  if (block.type === 'contact-directory') return [block.title, block.text, ...block.contacts.map(contactText)].join('\n\n');
  if (block.type === 'freebies') return [block.title, block.text, ...block.offers.map(offer => `${offer.brand}：${offer.title}\n${offer.dateLabel}\n${offer.requirement}\n${offer.description}\n${offer.sourceLabel}：${offer.sourceUrl}`)].join('\n\n');
  if ('items' in block) return block.items.join('\n');
  const base = `${'title' in block && block.title ? `${block.title}\n` : ''}${block.text}`;
  if (block.type === 'link') return `${base}\n${block.url}`;
  return block.type === 'route' ? [base, ...block.stops.map(stop => `${stop.title}\n${stop.text}`)].join('\n\n') : base;
};
