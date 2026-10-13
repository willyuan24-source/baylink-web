import { translateText, type Locale } from '../../i18n/locale';
import { brandCase } from '../../lib/event-facts';

const HAN = /[㐀-鿿]/;

/**
 * An offer's brand line as readers see it: a store name in display case and never translated ("Dunkin’"); a described brand
 * ("参与 Taco Trail 的本地餐厅") in the page's language, like the title. An English page with no translation for it gets ''
 * (the line is left out) rather than Chinese (PROD-W3: the Concord Taco Trail card read Simplified on /en and zh-Hant).
 */
export function offerBrandLine(brand: string, locale: Locale): string {
  if (!HAN.test(brand)) return brandCase(brand);
  const shown = translateText(brand, locale).trim();
  return locale === 'en' && HAN.test(shown) ? '' : shown;
}
