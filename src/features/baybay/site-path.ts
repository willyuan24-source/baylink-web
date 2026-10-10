/** Path helpers shared by the BayBay answer and its cards (no data imports, so the panel's static graph stays small). */
/** "/events/x" for a BAYLINK page link (absolute www.baylink.us or relative), else null. */
export function bayBaySitePath(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://www.baylink.us');
    if (!['www.baylink.us', 'baylink.us'].includes(parsed.hostname) || parsed.protocol !== 'https:') return null;
    return parsed.pathname.replace(/\/$/, '') || '/';
  } catch { return null; }
}
