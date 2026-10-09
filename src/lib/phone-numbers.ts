import { translateText, type Locale } from '../i18n/locale';

/**
 * US phone numbers in reader text (G14), without React: findPhoneNumbers for links and probes, parsePhoneDirectory for
 * "county：number" lists. Chips and grids are in phone-links.tsx.
 */
export type PhoneMatch = { start: number; end: number; text: string; tel: string };

// (1-)NXX-NXX-XXXX with -, . or space, an area code in ASCII or full-width brackets, or +1NXXNXXXXXX written solid.
const FORMATTED = /(?:\+?1[ .-]?)?(?:[(（]([2-9]\d\d)[)）] ?|([2-9]\d\d)[ .-])([2-9]\d\d)[ .-](\d{4})|\+1([2-9]\d\d)([2-9]\d\d)(\d{4})/g;
// Three-digit service lines count only right after a word that says to call them: 请拨 911, call 311, 拨打 988
// (zh-Hant text is linkified after conversion, so 撥打 / 請撥 / 致電 too).
const SERVICE = /(?:[拨撥]打|[请請][拨撥]|[拨撥]|致[电電]|打|call|dial)[ :：]?(211|311|511|711|811|911|988)/gi;
const wordCharacter = /[0-9A-Za-z_]/;
const joinedBefore = /[-./$#@=&?%+_]/;

const validNumber = (area: string, exchange: string, line: string) =>
  area[1] !== '9' && area.slice(1) !== '11' && exchange.slice(1) !== '11' &&
  // 555-0100 to 555-0199 are reserved for fiction and examples; never dial them.
  !(exchange === '555' && line.startsWith('01'));

/** US numbers in reading order. Dates, prices, ZIP codes, years, ranges, times and numbers inside URLs or longer digit runs are not phones. */
export function findPhoneNumbers(text: string): PhoneMatch[] {
  const found: PhoneMatch[] = [];
  const formatted = new RegExp(FORMATTED.source, 'g');
  for (let match = formatted.exec(text); match; match = formatted.exec(text)) {
    const start = match.index, end = start + match[0].length;
    const before = text[start - 1] || '', after = text[end] || '';
    const area = match[1] || match[2] || match[5], exchange = match[3] || match[6], line = match[4] || match[7];
    if (wordCharacter.test(before) || joinedBefore.test(before) || wordCharacter.test(after) || after === '%' ||
      /[-./]/.test(after) && /\d/.test(text[end + 1] || '') || !validNumber(area, exchange, line)) {
      // Not a phone here; a match that began on someone else's "1" ("Room 101 415-…") may still hide one, so look again.
      formatted.lastIndex = start + 1;
      continue;
    }
    found.push({ start, end, text: match[0], tel: `+1${area}${exchange}${line}` });
  }
  for (const match of text.matchAll(SERVICE)) {
    const number = match[1], end = match.index! + match[0].length, start = end - number.length;
    const before = text[match.index! - 1] || '', after = text[end] || '';
    if (/[a-z]/i.test(match[0][0]) && wordCharacter.test(before)) continue;
    if (wordCharacter.test(after) || /[-./:]/.test(after) && /\d/.test(text[end + 1] || '')) continue;
    if (!found.some(item => start < item.end && end > item.start)) found.push({ start, end, text: number, tel: number });
  }
  return found.sort((a, b) => a.start - b.start);
}

export type PhoneDirectoryEntry = { label: string; number: string; tel: string };

/**
 * "San Francisco：415-355-3555；San Mateo：844-868-0938。" (or its translation, with ASCII punctuation) as label/number
 * pairs; null when the text is anything but such a list, so ordinary sentences are never reshaped into a grid.
 */
export function parsePhoneDirectory(text: string): PhoneDirectoryEntry[] | null {
  const pieces = text.trim().replace(/[。.]$/, '').split(/[；;]\s*/).filter(Boolean);
  if (pieces.length < 2) return null;
  const entries: PhoneDirectoryEntry[] = [];
  for (const piece of pieces) {
    const separator = piece.search(/[：:]/);
    if (separator < 1) return null;
    // NFKC: the source lists use full-width punctuation even in English county names (Napa／Solano → Napa/Solano).
    const label = piece.slice(0, separator).trim().normalize('NFKC'), value = piece.slice(separator + 1).trim();
    const [phone, ...more] = findPhoneNumbers(value);
    if (!phone || more.length || phone.start !== 0 || phone.end !== value.length || label.length > 32) return null;
    entries.push({ label, number: phone.text, tel: phone.tel });
  }
  return entries;
}

/** Several county lists (already in the reader's language) as one grid; null when any of them is not a pure list. */
export function phoneDirectoryOf(items: string[], locale: Locale): PhoneDirectoryEntry[] | null {
  const lists = items.map(item => parsePhoneDirectory(translateText(item, locale)));
  return lists.length && lists.every(list => list) ? lists.flat() as PhoneDirectoryEntry[] : null;
}
