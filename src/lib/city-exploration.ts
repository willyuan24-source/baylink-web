import type { CityExploration } from '../data/city-exploration-types';
import cityAliases from '../data/city-search-aliases.json';
import { simplifySearch, translateText, type Locale } from '../i18n/locale';

const normalize = (value: string) => simplifySearch(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function cityExplorationMatches(city: CityExploration, query: string, locale: Locale): boolean {
  const terms = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  if (!terms.length) return true;
  const values = [city.city, city.county, ...(cityAliases[city.city as keyof typeof cityAliases] || []), city.summary,
    city.halfDay, city.arrival, city.residentTip, city.transport, city.checks,
    ...city.places.flatMap(place => [place.name, place.description]), ...city.resources.map(resource => resource.label)];
  const haystack = normalize([...values, ...values.map(value => translateText(value, locale))].join(' '));
  return terms.every(term => haystack.includes(term));
}
