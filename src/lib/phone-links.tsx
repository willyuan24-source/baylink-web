import { Fragment, type ReactNode } from 'react';
import { Phone } from 'lucide-react';
import { translateText, useLocale, type Locale } from '../i18n/locale';
import { findPhoneNumbers, phoneDirectoryOf, type PhoneDirectoryEntry } from './phone-numbers';

export type { PhoneDirectoryEntry, PhoneMatch } from './phone-numbers';

/**
 * Tap-to-call (G14). Every US phone number in reader text becomes a tel: chip; county lists become a two-column grid.
 * RC-11(i): text is translated first and split afterwards. The JSX runtime translates a string child by looking up the
 * whole Chinese sentence, so splitting a sentence before translation would leave /en paragraphs in Chinese.
 */
const callLabel = (number: string, locale: Locale, name?: string) =>
  locale === 'en' ? `Call ${name ? `${name} ` : ''}${number}` : `拨打 ${name ? `${name} ` : ''}${number}`;

/**
 * One number as a tel: chip. `inline` sits in a line of prose and gets an invisible 48px hit area; `row` stands on its
 * own line in a dense list and is really 44px (48 in 简洁显示) tall, so it never covers the link below; `block` is the
 * full-width button of a directory grid.
 */
export type PhoneChipVariant = 'inline' | 'row' | 'block';
export function PhoneChip({ number, tel, name, variant = 'inline' }: { number: string; tel: string; name?: string; variant?: PhoneChipVariant }) {
  const locale = useLocale();
  return <a className={variant === 'inline' ? 'phone-chip' : `phone-chip phone-chip--${variant}`} href={`tel:${tel}`} aria-label={callLabel(number, locale, name)}>
    <Phone aria-hidden="true" /><span>{number}</span>
  </a>;
}

// Closing punctuation right after a number. A chip is an atomic inline box, so the line could break before "。" and start
// the next line with it; the chip and its punctuation are kept together instead.
const closingPunctuation = /^[。，、；：！？）」』”’.,;:!?)\]]+/;

/** Already-translated text with each phone number replaced by a chip; the text between numbers stays as it was. */
export function linkifyPhones(text: string, options: { name?: string; variant?: PhoneChipVariant } = {}): ReactNode[] {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const match of findPhoneNumbers(text)) {
    if (match.start > at) parts.push(text.slice(at, match.start));
    const key = `${match.start}-${match.tel}`;
    const chip = <PhoneChip key={key} number={match.text} tel={match.tel} name={options.name} variant={options.variant} />;
    const closing = closingPunctuation.exec(text.slice(match.end))?.[0] || '';
    parts.push(closing ? <span key={key} className="phone-chip-keep">{chip}{closing}</span> : chip);
    at = match.end + closing.length;
  }
  if (at < text.length || !parts.length) parts.push(text.slice(at));
  return parts;
}

/** Reader text in the current language with tap-to-call numbers: translate the whole string, then split (RC-11 i). */
export function PhoneText({ text }: { text: string }) {
  const locale = useLocale();
  const translated = translateText(text, locale);
  return <Fragment>{linkifyPhones(translated)}</Fragment>;
}

/** A list whose items are all "county：number" lists becomes one PhoneDirectory; any other list renders as given. */
export function PhoneDirectoryOr({ items, children }: { items: string[]; children: ReactNode }) {
  const locale = useLocale();
  const entries = phoneDirectoryOf(items, locale);
  return entries ? <PhoneDirectory entries={entries} /> : <Fragment>{children}</Fragment>;
}

/** County numbers in a two-column grid (one column at 大/特大 and in 简洁显示 on a phone), never wrapped mid-number. */
export function PhoneDirectory({ entries }: { entries: PhoneDirectoryEntry[] }) {
  return <ul className="phone-directory">
    {entries.map(entry => <li key={`${entry.label}-${entry.tel}`}>
      <span className="phone-directory-label">{entry.label}</span>
      <PhoneChip number={entry.number} tel={entry.tel} name={entry.label} variant="block" />
    </li>)}
  </ul>;
}
