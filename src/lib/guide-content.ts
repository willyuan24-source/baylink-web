import type { GuideBlock } from '../data/guides';
import { BROADBAND_MAP_URL, type UtilityContact } from '../data/utility-types';

const contactText = (contact: UtilityContact) => [contact.name, contact.phone, contact.email, contact.note, contact.url, contact.availabilityUrl, contact.movingUrl].filter(Boolean).join('\n');

/** Keep search and BayBay exports consistent with the complete readable block. */
export const guideBlockText = (block: GuideBlock): string => {
  if (block.type === 'utility-directory') return [block.title, block.text, ...block.cities.map(city => [city.county, city.city, city.notes,
    ...city.water.map(item => `Water: ${contactText(item)}`), ...city.electric.map(item => `Electricity: ${contactText(item)}`),
    ...city.waste.map(item => `Waste: ${contactText(item)}`), `Internet: ${BROADBAND_MAP_URL}`, city.municipalUrl, city.verifiedAt,
  ].filter(Boolean).join('\n'))].join('\n\n');
  if (block.type === 'contact-directory') return [block.title, block.text, ...block.contacts.map(contactText)].join('\n\n');
  if (block.type === 'freebies') return [block.title, block.text, ...block.offers.map(offer => `${offer.brand}：${offer.title}\n${offer.dateLabel}\n${offer.requirement}\n${offer.description}\n${offer.sourceLabel}：${offer.sourceUrl}`)].join('\n\n');
  if ('items' in block) return block.items.join('\n');
  const base = `${'title' in block && block.title ? `${block.title}\n` : ''}${block.text}`;
  return block.type === 'route' ? [base, ...block.stops.map(stop => `${stop.title}\n${stop.text}`)].join('\n\n') : base;
};
