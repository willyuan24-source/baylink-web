import { useEffect, useState } from 'react';
import { getBayAreaToday } from './monthly';

/** Today's Bay Area date, refreshed every minute, on focus and when the tab becomes visible; a supplied date wins. */
export function useBayAreaToday(suppliedToday?: string) {
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, []);
  return suppliedToday || localToday;
}
