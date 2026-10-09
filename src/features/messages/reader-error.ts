import { translateText, type Locale } from '../../i18n/locale';

const HAN = /[㐀-鿿]/;
/**
 * An error message from the server or from friendlyErrorMessage (which still answers in Simplified Chinese, e.g. for a
 * network failure) in the reader's language: 繁體 by conversion; on English pages Chinese wording gives way to the
 * caller's English fallback. TODO(WEB-SHELL2): drop once friendlyErrorMessage is localized.
 */
export const readerError = (message: string, locale: Locale, fallback: string) =>
  locale === 'en' ? (HAN.test(message) ? fallback : message) : translateText(message, locale);
