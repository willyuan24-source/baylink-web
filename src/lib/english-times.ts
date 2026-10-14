/**
 * H41 (I13-04): US-style times and dates in English text. Chinese editorial copy writes the 24-hour clock and ISO or M/D
 * dates ("10/18 · 14:00–16:00", "checked 2026-10-12"), and their English translations kept them; English readers get
 * "Oct 18 · 2–4pm" and "checked Oct 12, 2026". Applied when the English dictionary and its scopes are generated
 * (scripts/generate-english-scopes.ts), not at runtime; scripts/i18n-html-check.mjs fails a built /en page that still
 * shows a 24-hour time or an ISO date.
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

const MERIDIEM = String.raw`\s?(?:[ap]\.?\s?m\b\.?)`;
const TIME = String.raw`([01]?\d|2[0-4]):([0-5]\d)`;
const RANGE = new RegExp(String.raw`(?<![\d:.$/])${TIME}(${MERIDIEM})?(\s*(?:–|—|-|~|to)\s*)([01]?\d|2[0-4])(?::([0-5]\d))?(${MERIDIEM})?(?!\d|:\d)`, 'gi');
// a time whose am/pm is on the end of its range ("4:30–6pm", "6:30–8:30pm") is already 12-hour
const SINGLE = new RegExp(String.raw`(?<![\d:.$/])${TIME}(?!\d|:\d)(?!\s*[–—~-]\s*(?:\d{1,2}(?::\d\d)?${MERIDIEM}|noon|midnight))(${MERIDIEM})?`, 'gi');

/** Text that writes the 12-hour clock: it has an am/pm and no time only the 24-hour clock writes (13:00, 08:30). */
const TWELVE_HOUR_MARK = /\d\s?[ap]\.?\s?m\b/i;
const ONLY_24_HOUR = /(?<![\d:.$/])(?:1[3-9]|2[0-3]|0\d):[0-5]\d/;
const MARKS = /(?<![\d:])(\d{1,2})(?::[0-5]\d)?\s?([ap])\.?\s?m\b/gi;
/**
 * In 12-hour text, a time written without its am/pm ("Gather 5:45, parade 6:00, contest 6:30 pm", "4:30–5:15, 5:15–6
 * and 6–6:45 pm") takes it from the next time that has one (or the earlier one, at the end of the text).
 */
const twelveHourOf = (source: string, offset: number, hour: number): number => {
  const h = hour % 12;
  const marks = [...source.matchAll(MARKS)].map(match => ({ at: match.index!, hour: Number(match[1]) % 12, pm: /p/i.test(match[2]) }));
  const next = marks.find(mark => mark.at > offset);
  if (next) return next.pm && h <= next.hour ? h + 12 : h;
  const previous = [...marks].reverse().find(mark => mark.at < offset);
  if (!previous) return h === 0 ? 12 : h;
  return previous.pm || h < previous.hour ? h + 12 : h;
};

function convertTimes(text: string): string {
  const twelveHour = TWELVE_HOUR_MARK.test(text) && !ONLY_24_HOUR.test(text);
  const ranged = text.replace(RANGE, (whole, h1: string, m1: string, s1: string | undefined, dash: string, h2: string, m2: string | undefined, s2: string | undefined, offset: number, source: string) => {
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
  return ranged.replace(SINGLE, (whole, h: string, m: string, suffix: string | undefined, offset: number, source: string) => {
    if (suffix) return whole;
    const clock = { hour: Number(h), minute: Number(m) };
    if (clock.hour === 24 && clock.minute) return whole;
    if (twelveHour && clock.hour >= 1 && clock.hour <= 12) clock.hour = twelveHourOf(source, offset, clock.hour);
    return clockText(clock);
  });
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
  // year first: 2026/9/1 (–10/30) → Sep 1(–Oct 30), 2026
  out = out.replace(/\b(20\d\d)\/(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?:\s*[–—-]\s*(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9]))?\b(?![\d/])/g, (whole, year: string, mo1: string, d1: string, mo2?: string, d2?: string) => {
    if (!validDay(Number(mo1), Number(d1)) || (mo2 && !validDay(Number(mo2), Number(d2)))) return whole;
    return `${monthDay(Number(mo1), Number(d1))}${mo2 ? `–${mo1 === mo2 ? Number(d2) : monthDay(Number(mo2), Number(d2))}` : ''}, ${year}`;
  });
  // M/D/YYYY → Sep 30, 2026
  out = out.replace(/(?<![\d/.])\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])\/(20\d\d)\b/g, (whole, month: string, day: string, year: string) => validDay(Number(month), Number(day)) ? `${monthDay(Number(month), Number(day))}, ${year}` : whole);
  // M/D: not in text that pairs days ("6/7, 13/14") or writes fractions ("1/2 price")
  if (/(?<![\d/])(?:1[3-9]|2\d|3[01])\/\d{1,2}(?![\d/])/.test(out)) return out;
  return out.replace(/(?<![\d/.,$:])\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])\b(?![\d/%])(?:(\s*[–—-]\s*)(?:(1[0-2]|0?[1-9])\/)?(3[01]|[12]\d|0?[1-9])\b(?![\d/%]))?(?!\s*(?:cup|mile|inch|in\b|lb|pound|oz|price|off|hour|tsp|tbsp|of\b))/gi,
    (whole, mo1: string, d1: string, dash: string | undefined, mo2: string | undefined, d2: string | undefined) => {
      if (!validDay(Number(mo1), Number(d1))) return whole;
      if (!dash) return monthDay(Number(mo1), Number(d1));
      const endMonth = Number(mo2 ?? mo1);
      if (!validDay(endMonth, Number(d2))) return whole;
      return `${monthDay(Number(mo1), Number(d1))}–${endMonth === Number(mo1) ? Number(d2) : monthDay(endMonth, Number(d2))}`;
    })
    // "Sat 9/12" → "Sat, Sep 12"
    .replace(/\b(Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)\.? (?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d)/g, '$1, ');
}

/** English text with US-style times and dates; URLs, emails and text without digits are returned unchanged. */
export function englishTimes(text: string): string {
  if (!/\d[:/-]\d/.test(text)) return text;
  // URLs and e-mail addresses keep their digits
  const kept: string[] = [];
  const masked = text.replace(/\b(?:https?:\/\/|www\.)\S+|\S+@\S+\.\w+/g, match => { kept.push(match); return `\u0000${kept.length - 1}\u0000`; });
  const converted = convertTimes(convertDates(masked));
  return converted.replace(/\u0000(\d+)\u0000/g, (_, index: string) => kept[Number(index)]);
}

/**
 * What the /en release check flags in visible text (scripts/i18n-html-check.mjs keeps its own copy of these patterns, as
 * plain JavaScript): a clock time with no am/pm on it or on the end of its range, and an ISO date.
 */
export const TWENTY_FOUR_HOUR = /(?<![\d:.$/])\b([01]?\d|2[0-3]):[0-5]\d\b(?!\s?(?:[ap]\.?\s?m\b|[–—-]\s?\d{1,2}(?::\d\d)?\s?[ap]\.?\s?m\b))/i;
export const ISO_DATE = /\b20\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/;
