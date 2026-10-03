import { SHOPPING_KINDS, SHOPPING_REGIONS, type ShoppingPlace } from '../data/shopping-types';
import { translateText, simplifySearch, type Locale } from '../i18n/locale';
import { UTILITY_CITY_ALIASES } from '../data/utility-types';

const normalize = (value: string) => simplifySearch(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function shoppingPlaceMatches(place: ShoppingPlace, query: string, locale: Locale): boolean {
  const values = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  if (!values.length) return true;
  const aliases = Object.entries(UTILITY_CITY_ALIASES).filter(([city]) => place.city.includes(city)).flatMap(([, names]) => names);
  const terms = [place.name, place.city, ...aliases, place.region, place.address, place.description, place.bestFor, place.plan, place.transport, place.caution, SHOPPING_KINDS[place.kind], SHOPPING_REGIONS[place.region]];
  const haystack = normalize([...terms, ...terms.map(term => translateText(term, locale))].join(' '));
  return values.every(value => haystack.includes(value));
}
