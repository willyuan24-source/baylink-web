import type { Bilingual } from '../core/types';
import { bayNow } from '../game/bayNow';
import { loadLive } from '../realsf/live';
import { sunHm, sunTimes } from '../realsf/sun';
import { todayHeadline } from '../realsf/todayLine';

/**
 * W9-F9 (lane F; review §4 item 3, 放大方式：在标题页和 HUD 上露出一条「今天在旧金山」; sf-w9-lead §3 F (5)) · one line about
 * San Francisco today for the title's strip and 我是本地人's one 今天 card (ui/titleHost.ts): lane R's todayHeadline() on
 * the Bay clock (?date= honoured), with BAYLINK's offers file fetched first (the one the journal's 今天 page reads, once
 * per page); a plain day before sunset: the sunset time (realsf/sun.ts, as the journal's 今天 page); after sunset with
 * nothing on: null (no strip). A lazy chunk: the catalog may not be in yet, so a world event cannot be the line here —
 * the calendar, the sunset, a dressing day and today's free can.
 */
export async function titleToday(waitMs = 2000): Promise<Bilingual | null> {
  // a slow network: the line without today's free after waitMs (the calendar and the sun still answer)
  try { await Promise.race([loadLive(), new Promise(r => setTimeout(r, waitMs))]); } catch { /* offline: the same */ }
  const now = bayNow();
  const h = todayHeadline(now);
  if (h) return { zh: h.zh, en: h.en };
  const sunset = sunTimes(now).sunset;
  if (now.getTime() >= sunset.getTime()) return null;
  const t = sunHm(sunset);
  return { zh: `日落 ${t}`, en: `Sunset at ${t}` };
}
