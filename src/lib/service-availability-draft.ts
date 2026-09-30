export type AvailabilityDraftSlot = { date: string; startTime: string; endTime: string };
export type AvailabilityDraftError = 'format' | 'date' | 'time' | 'weekday' | 'past';
export type AvailabilityDraft = { slots: AvailabilityDraftSlot[]; error?: AvailabilityDraftError };
const weekdays = '日一二三四五六';
const pad = (value: number) => String(value).padStart(2, '0');

export function serviceToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const validDay = (date: string) => /^20\d{2}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;

/** A deliberately bounded grammar: unsupported clauses and exceptions never silently disappear.
 * This creates a preview only; authoritative timezone, lead-time and overlap checks remain on the server.
 */
export function draftServiceAvailability(input: string, today = serviceToday()): AvailabilityDraft {
  const fail = (error: AvailabilityDraftError): AvailabilityDraft => ({ slots: [], error });
  if (!validDay(today)) return fail('date');
  const text = input.trim().replace(/：/g, ':').replace(/星期/g, '周');
  if (text.length > 160) return fail('format');
  const match = text.match(/^(.+?)\s+(\d{1,2}:\d{2})\s*[-–—~～至到]\s*(\d{1,2}:\d{2})$/);
  if (!match) return fail('format');
  const time = (value: string) => value.split(':').map(Number);
  const [startH, startM] = time(match[2]);
  const [endH, endM] = time(match[3]);
  if (startH > 23 || endH > 23 || startM > 59 || endM > 59 || endH * 60 + endM <= startH * 60 + startM) return fail('time');
  const startTime = `${pad(startH)}:${pad(startM)}`;
  const endTime = `${pad(endH)}:${pad(endM)}`;
  const dates: string[] = [];
  const phrase = match[1].replace(/\s/g, '');
  const weekly = phrase.match(/^(本月|下月|20\d{2}-\d{2}|\d{1,2}月)每周([一二三四五六日天])$/);
  if (weekly) {
    let year = Number(today.slice(0, 4));
    let month = Number(today.slice(5, 7));
    if (weekly[1] === '下月') { month++; if (month === 13) { month = 1; year++; } }
    else if (/^20/.test(weekly[1]) && weekly[1].includes('-')) { [year, month] = weekly[1].split('-').map(Number); }
    else if (weekly[1].endsWith('月') && /^\d/.test(weekly[1])) month = Number(weekly[1].slice(0, -1));
    if (!validDay(`${year}-${pad(month)}-01`)) return fail('date');
    const target = weekdays.indexOf(weekly[2] === '天' ? '日' : weekly[2]);
    for (let day = 1; day <= 31; day++) {
      const date = `${year}-${pad(month)}-${pad(day)}`;
      if (validDay(date) && date >= today && new Date(`${date}T12:00:00Z`).getUTCDay() === target) dates.push(date);
    }
  } else {
    const explicit = phrase.match(/^(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})[日号]?(?:周([一二三四五六日天]))?$/);
    let date: string;
    if (/^20\d{2}-\d{2}-\d{2}$/.test(phrase)) date = phrase;
    else if (explicit) date = `${explicit[1] || today.slice(0, 4)}-${pad(Number(explicit[2]))}-${pad(Number(explicit[3]))}`;
    else return fail('format');
    if (!validDay(date)) return fail('date');
    if (explicit?.[4] && new Date(`${date}T12:00:00Z`).getUTCDay() !== weekdays.indexOf(explicit[4] === '天' ? '日' : explicit[4])) return fail('weekday');
    if (date >= today) dates.push(date);
  }
  if (!dates.length) return fail('past');
  return { slots: dates.map(date => ({ date, startTime, endTime })) };
}
