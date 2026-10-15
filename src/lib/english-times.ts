/**
 * H41 (I13-04): US-style times and dates in English text. Chinese editorial copy writes the 24-hour clock and ISO or M/D
 * dates ("10/18 · 14:00–16:00", "checked 2026-10-12"), and their English translations kept them; English readers get
 * "Oct 18 · 2–4pm" and "checked Oct 12, 2026". The site's English applies it to the dictionary as it loads and to the
 * date lines and data tokens it shows (i18n/locale.ts, switched on by i18n/metadata.ts); the generator adds the English
 * entries of neutral date lines (scripts/generate-english-scopes.ts). scripts/i18n-html-check.mjs fails a built /en page
 * that still shows a 24-hour time or an ISO date.
 *
 * Reading rules: a range written without am/pm whose end hour is smaller than its start ("10:30–3:00") is a 12-hour
 * range across noon; any other time without am/pm is the 24-hour clock. Text already in am/pm is left as it is. URLs
 * keep their digits. An M/D date is read only where nothing marks the text as something else (a day pair like
 * "6/7, 13/14", a fraction like "1/2 price").
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (value: number) => String(value).padStart(2, '0');
type Clock = { hour: number; minute: number };

const meridiemOf = (hour: number) => hour % 24 < 12 ? 'am' : 'pm';
const special = ({ hour, minute }: Clock) => minute === 0 && (hour % 12 === 0);
/** 14:00 → "2pm", 09:30 → "9:30am", 12:00 → "noon", 00:00 / 24:00 → "midnight". */
const clockText = (clock: Clock, withMeridiem = true): string => {
  if (special(clock)) return clock.hour % 24 === 0 ? 'midnight' : 'noon';
  const hour = clock.hour % 12 || 12;
  const base = clock.minute ? `${hour}:${two(clock.minute)}` : String(hour);
  return withMeridiem ? `${base}${meridiemOf(clock.hour)}` : base;
};
/** "2–9pm", "10am–5pm", "11:30am–1pm", "noon–5pm", "9am–noon". */
const rangeText = (start: Clock, end: Clock, dash: string): string => {
  const shared = !special(start) && !special(end) && meridiemOf(start.hour) === meridiemOf(end.hour);
  return `${clockText(start, !shared)}${dash}${clockText(end)}`;
};

/**
 * The matches of a global pattern that do not follow a character of `before`: a look-behind written in code, because
 * Safari before 16.4 cannot parse one and would fail the whole bundle (tests/opus-bay-w9-e-lookbehind). A match after
 * such a character is skipped and the search goes on from the next character, as the look-behind would.
 */
function* matchesNotAfter(text: string, pattern: RegExp, before: RegExp): Generator<RegExpExecArray> {
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > 0 && before.test(text[match.index - 1])) { pattern.lastIndex = match.index + 1; continue; }
    yield match;
    if (!match[0].length) pattern.lastIndex++;
  }
}
const findNotAfter = (text: string, pattern: RegExp, before: RegExp): RegExpExecArray | undefined => {
  for (const match of matchesNotAfter(text, pattern, before)) return match;
  return undefined;
};
const replaceNotAfter = (text: string, pattern: RegExp, before: RegExp, replace: (match: RegExpExecArray) => string): string => {
  let out = '';
  let last = 0;
  for (const match of matchesNotAfter(text, pattern, before)) {
    out += text.slice(last, match.index) + replace(match);
    last = match.index + match[0].length;
  }
  return out + text.slice(last);
};

const MERIDIEM = String.raw`\s?(?:[ap]\.?\s?m\b\.?)`;
const TIME = String.raw`([01]?\d|2[0-4]):([0-5]\d)`;
/** Not a time inside a longer number, a ratio, a price or a path: the character before a clock time. */
const NOT_AFTER_CLOCK = /[\d:.$/]/;
const RANGE = new RegExp(String.raw`${TIME}(${MERIDIEM})?(\s*(?:–|—|-|~|to)\s*)([01]?\d|2[0-4])(?::([0-5]\d))?(${MERIDIEM})?(?!\d|:\d)`, 'gi');
// a time whose am/pm is on the end of its range ("4:30–6pm", "6:30–8:30pm") is already 12-hour
const SINGLE = new RegExp(String.raw`${TIME}(?!\d|:\d)(?!\s*[–—~-]\s*(?:\d{1,2}(?::\d\d)?${MERIDIEM}|noon|midnight))(${MERIDIEM})?`, 'gi');

/** Text that writes the 12-hour clock: it has an am/pm and no time only the 24-hour clock writes (13:00, 08:30). */
const TWELVE_HOUR_MARK = /\d\s?[ap]\.?\s?m\b/i;
const ONLY_24_HOUR = /(?:1[3-9]|2[0-3]|0\d):[0-5]\d/g;
const MARKS = /(\d{1,2})(?::[0-5]\d)?\s?([ap])\.?\s?m\b/gi;
/**
 * In 12-hour text, a time written without its am/pm ("Gather 5:45, parade 6:00, contest 6:30 pm", "4:30–5:15, 5:15–6
 * and 6–6:45 pm") takes it from the next time that has one (or the earlier one, at the end of the text).
 */
const twelveHourOf = (source: string, offset: number, hour: number): number => {
  const h = hour % 12;
  const marks = [...matchesNotAfter(source, MARKS, /[\d:]/)].map(match => ({ at: match.index, hour: Number(match[1]) % 12, pm: /p/i.test(match[2]) }));
  const next = marks.find(mark => mark.at > offset);
  if (next) return next.pm && h <= next.hour ? h + 12 : h;
  const previous = [...marks].reverse().find(mark => mark.at < offset);
  if (!previous) return h === 0 ? 12 : h;
  return previous.pm || h < previous.hour ? h + 12 : h;
};

function convertTimes(text: string): string {
  const twelveHour = TWELVE_HOUR_MARK.test(text) && !findNotAfter(text, ONLY_24_HOUR, NOT_AFTER_CLOCK);
  const ranged = replaceNotAfter(text, RANGE, NOT_AFTER_CLOCK, ({ 0: whole, 1: h1, 2: m1, 3: s1, 4: dash, 5: h2, 6: m2, 7: s2, index: offset }) => {
    const source = text;
    // already 12-hour ("4:30–6pm", "10am–3:00 PM"), or an end that is not a clock time ("10:00-5")
    if (s1 || s2 || m2 === undefined) return whole;
    let start = { hour: Number(h1), minute: Number(m1) };
    let end = { hour: Number(h2), minute: Number(m2) };
    if (start.hour > 23 && start.minute) return whole;
    if (end.hour === 24 && end.minute) return whole;
    if (twelveHour && start.hour <= 12 && end.hour <= 12) {
      start = { hour: twelveHourOf(source, offset, start.hour), minute: start.minute };
      // the end is later the same day: past noon when its hour is smaller than the start's
      const endHour = end.hour % 12 + (start.hour >= 12 || end.hour % 12 < start.hour % 12 ? 12 : 0);
      end = { hour: endHour, minute: end.minute };
    } else if (start.hour <= 12 && end.hour >= 1 && end.hour < start.hour && end.hour < 12) {
      // "10:30–3:00" in 24-hour text: a 12-hour range across noon
      end = { hour: end.hour + 12, minute: end.minute };
    }
    return rangeText(start, end, dash.trim() === 'to' ? ' to ' : '–');
  });
  const out = replaceNotAfter(ranged, SINGLE, NOT_AFTER_CLOCK, ({ 0: whole, 1: h, 2: m, 3: suffix, index: offset }) => {
    if (suffix) return whole;
    const clock = { hour: Number(h), minute: Number(m) };
    if (clock.hour === 24 && clock.minute) return whole;
    if (twelveHour && clock.hour >= 1 && clock.hour <= 12) clock.hour = twelveHourOf(ranged, offset, clock.hour);
    return clockText(clock);
  })
    // "12:00 noon" reads "noon", not "noon noon"
    .replace(/\b(noon|midnight)\s+\1\b/gi, '$1');
  // a text that got an am/pm from here writes them all one way: "3pm or 5:30pm", not "3pm or 5:30 pm" ("3:00 pm" → "3pm")
  return out !== text ? out.replace(/\b(\d{1,2})(:[0-5]\d)? ([ap]m)\b/gi, (_, hour: string, minutes: string | undefined, meridiem: string) => `${hour}${minutes === ':00' ? '' : minutes ?? ''}${meridiem}`) : out;
}

const monthDay = (month: number, day: number) => `${MONTHS[month - 1]} ${day}`;
const validDay = (month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

function convertDates(text: string): string {
  // ISO: 2026-10-13 → Oct 13, 2026 (a range of two: Oct 1–31, 2026 / Sep 25–Oct 31, 2026)
  let out = text.replace(/\b(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:\s*(?:–|—|to)\s*(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))?\b/g, (whole, y1: string, mo1: string, d1: string, y2?: string, mo2?: string, d2?: string) => {
    if (!validDay(Number(mo1), Number(d1))) return whole;
    if (!y2) return `${monthDay(Number(mo1), Number(d1))}, ${y1}`;
    if (!validDay(Number(mo2), Number(d2))) return whole;
    if (y1 !== y2) return `${monthDay(Number(mo1), Number(d1))}, ${y1}–${monthDay(Number(mo2), Number(d2))}, ${y2}`;
    return `${monthDay(Number(mo1), Number(d1))}–${mo1 === mo2 ? Number(d2) : monthDay(Number(mo2), Number(d2))}, ${y1}`;
  });
  // a year-first day list: 2026/10/10、11、17、18 → Oct 10, 11, 17 and 18, 2026 (not "Oct 10, 2026、11、17、18")
  out = out.replace(/\b(20\d\d)\/(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])((?:\s*[、,，]\s*(?:3[01]|[12]\d|0?[1-9])\b(?![\d/:.]))+)/g, (whole, year: string, month: string, first: string, rest: string) => {
    const days = [first, ...rest.split(/\s*[、,，]\s*/u).filter(Boolean)].map(Number);
    if (days.some(day => !validDay(Number(month), day))) return whole;
    return `${MONTHS[Number(month) - 1]} ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}, ${year}`;
  });
  // year first: 2026/9/1 (–10/30) → Sep 1(–Oct 30), 2026
  out = out.replace(/\b(20\d\d)\/(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?:\s*[–—-]\s*(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9]))?\b(?![\d/])/g, (whole, year: string, mo1: string, d1: string, mo2?: string, d2?: string) => {
    if (!validDay(Number(mo1), Number(d1)) || (mo2 && !validDay(Number(mo2), Number(d2)))) return whole;
    return `${monthDay(Number(mo1), Number(d1))}${mo2 ? `–${mo1 === mo2 ? Number(d2) : monthDay(Number(mo2), Number(d2))}` : ''}, ${year}`;
  });
  // M/D/YYYY → Sep 30, 2026
  out = replaceNotAfter(out, /\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])\/(20\d\d)\b/g, /[\d/.]/, ({ 0: whole, 1: month, 2: day, 3: year }) => validDay(Number(month), Number(day)) ? `${monthDay(Number(month), Number(day))}, ${year}` : whole);
  // M/D: not in text that pairs days ("6/7, 13/14") or writes fractions ("1/2 price")
  if (findNotAfter(out, /(?:1[3-9]|2\d|3[01])\/\d{1,2}(?![\d/])/g, /[\d/]/)) return out;
  return replaceNotAfter(out, /\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])\b(?![\d/%])(?:(\s*[–—-]\s*)(?:(1[0-2]|0?[1-9])\/)?(3[01]|[12]\d|0?[1-9])\b(?![\d/%]))?(?!\s*(?:cup|mile|inch|in\b|lb|pound|oz|price|off|hour|tsp|tbsp|of\b))/gi, /[\d/.,$:]/,
    ({ 0: whole, 1: mo1, 2: d1, 3: dash, 4: mo2, 5: d2 }) => {
      if (!validDay(Number(mo1), Number(d1))) return whole;
      if (!dash) return monthDay(Number(mo1), Number(d1));
      const endMonth = Number(mo2 ?? mo1);
      if (!validDay(endMonth, Number(d2))) return whole;
      return `${monthDay(Number(mo1), Number(d1))}–${endMonth === Number(mo1) ? Number(d2) : monthDay(endMonth, Number(d2))}`;
    })
    // "Sat 9/12" → "Sat, Sep 12"
    .replace(/\b(Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)\.? (?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d)/g, '$1, ');
}

const PUNCTUATION: readonly [RegExp, string][] = [[/\s*；\s*/gu, ';'], [/\s*[、，]\s*/gu, ','], [/\s*：\s*/gu, ':'], [/\s*。\s*/gu, '.']];
/** A language-neutral line's Chinese punctuation, written the English way: "；" → "; ", "、" / "，" → ", ", "：" → ": ", "。" → ". " (no space at the end). */
export const englishPunctuation = (text: string): string => PUNCTUATION.reduce((out, [pattern, mark]) => out.replace(pattern, (match: string, offset: number) => offset + match.length < out.length ? `${mark} ` : mark), text);
/**
 * A language-neutral date line in English ("10/31、11/28 · 11:00–15:00" → "Oct 31, Nov 28 · 11am–3pm"): its punctuation and
 * its times and dates. The generator's neutral entries (scripts/generate-english-scopes.ts) and the date and time tokens
 * the site converts as it shows them (i18n/locale.ts) both use it, so the two read the same.
 */
export const englishDateLine = (text: string): string => englishTimes(englishPunctuation(text));

/** English text with US-style times and dates; URLs, emails and text without digits are returned unchanged. */
export function englishTimes(text: string): string {
  if (!/\d[:/-]\d/.test(text)) return text;
  // URLs and e-mail addresses keep their digits
  const kept: string[] = [];
  // a private-use character marks each kept span (no digit pattern can match across it)
  const masked = text.replace(/\b(?:https?:\/\/|www\.)\S+|\S+@\S+\.\w+/g, match => { kept.push(match); return `${kept.length - 1}`; });
  const converted = convertTimes(convertDates(masked));
  return converted.replace(/(\d+)/g, (_, index: string) => kept[Number(index)]);
}

/**
 * What the /en release check flags in visible text (scripts/i18n-html-check.mjs keeps its own copy of these patterns, as
 * plain JavaScript): a clock time with no am/pm on it or on the end of its range, and an ISO date.
 */
const TWENTY_FOUR_HOUR = /\b([01]?\d|2[0-3]):[0-5]\d\b(?!\s?(?:[ap]\.?\s?m\b|[–—-]\s?\d{1,2}(?::\d\d)?\s?[ap]\.?\s?m\b))/gi;
export const twentyFourHourTime = (text: string): string | undefined => findNotAfter(text, TWENTY_FOUR_HOUR, NOT_AFTER_CLOCK)?.[0];
export const ISO_DATE = /\b20\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/;
/** A 24-hour time or an ISO date: text the English pages show in US style instead. */
export const hasTwentyFourHourOrIso = (text: string): boolean => !!twentyFourHourTime(text) || ISO_DATE.test(text);
