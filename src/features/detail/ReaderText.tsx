import { useLocale } from '../../i18n/locale';
import { linkifyPhones } from '../../lib/phone-links';
import { readerProse } from './reader-text';

/**
 * One catalog string as the reader sees it: in their language, without editor notes (reader-text.ts), every phone number
 * a tel: link (CW-01). The text is translated before the numbers are split out (RC-11 i). Renders nothing when no reader
 * text is left.
 */
export function ReaderText({ text, name }: { text: string | undefined; name?: string }) {
  const locale = useLocale();
  const prose = readerProse(text, locale);
  return prose ? <>{linkifyPhones(prose, { name })}</> : null;
}

/** Already-localized reader text (a sentence from readerSentences) with tap-to-call numbers. */
export function PhoneLinked({ text }: { text: string }) {
  return <>{linkifyPhones(text)}</>;
}
