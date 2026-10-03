import { simplifySearch } from '../i18n/locale';
import { UTILITY_CITY_ALIASES, type UtilityCity } from '../data/utility-types';

const searchKey = (text: string) => simplifySearch(text).normalize('NFKD').replace(/\p{Mark}/gu, '').toLocaleLowerCase().replace(/[\s.’'-]/g, '');

export function utilityCityMatches(city: UtilityCity, query: string): boolean {
  const key = searchKey(query.trim());
  return !key || searchKey([city.city, city.county, ...(UTILITY_CITY_ALIASES[city.city] || []),
    ...[...city.water, ...city.electric, ...city.waste].map(contact => `${contact.name} ${contact.phone || ''}`),
  ].join(' ')).includes(key);
}
