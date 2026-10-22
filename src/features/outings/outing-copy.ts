import { useCallback, useEffect, useState } from 'react';
import { translateText, useLocale } from '../../i18n/locale';

export function useOutingCopy() {
  const locale = useLocale();
  const t = useCallback((zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale), [locale]);
  return { locale, t };
}
export type OutingTranslate = ReturnType<typeof useOutingCopy>['t'];
export function useOutingNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(interval); }, []);
  return now;
}

const DAY_MS = 86_400_000;
const day = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** The days a host can pick, today … today + `ahead` (YYYY-MM-DD, Bay Area calendar), plus `keep` (a saved or drafted day) when it lies outside. */
export function outingDays(today: string, ahead: number, keep = ''): string[] {
  const days = Array.from({ length: ahead + 1 }, (_, index) => new Date(day(today) + index * DAY_MS).toISOString().slice(0, 10));
  return /^\d{4}-\d{2}-\d{2}$/.test(keep) && !days.includes(keep) ? [keep, ...days].sort() : days;
}
/** Every quarter hour 00:00–23:45, plus `keep` (a saved or drafted HH:MM) when it is another valid time. */
export function outingTimes(keep = ''): string[] {
  const times = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}`);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(keep) && !times.includes(keep) ? [...times, keep].sort() : times;
}
