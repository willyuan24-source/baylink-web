import { PLATFORM_CATEGORIES, type UsefulPlatform } from '../data/useful-platform-types';
import { simplifySearch, translateText, type Locale } from '../i18n/locale';

const normalize = (text: string) => simplifySearch(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const aliases: Record<string, string[]> = {
  'hungrypanda': ['hungry panada', 'hungry panda', '熊猫外卖', '熊貓外賣'],
  'ubereats': ['uber eat', 'uber eats', 'ubereat'],
  'dealmoon': ['北美省钱快报', '北美省錢快報'],
  'fantuan': ['饭团', '飯糰', '飯團'],
  'weee': ['华人买菜', '華人買菜'],
};

export function usefulPlatformMatches(platform: UsefulPlatform, query: string, locale: Locale): boolean {
  const values = [platform.name, PLATFORM_CATEGORIES[platform.category], platform.summary, platform.bestFor, platform.howTo, platform.watchFor, platform.coverage,
    ...(aliases[normalize(platform.name).replace(/\p{Script=Han}/gu, '')] || aliases[normalize(platform.id)] || [])];
  const haystack = normalize([...values, ...values.map(value => translateText(value, locale))].join(' '));
  return query.trim().split(/\s+/).map(normalize).filter(Boolean).every(term => haystack.includes(term));
}
