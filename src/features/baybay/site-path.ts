/** Path helpers shared by the BayBay answer and its cards (no data imports, so the panel's static graph stays small). */
/** "/events/x" for a BAYLINK page link (absolute www.baylink.us or relative), else null. */
export function bayBaySitePath(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://www.baylink.us');
    if (!['www.baylink.us', 'baylink.us'].includes(parsed.hostname) || parsed.protocol !== 'https:') return null;
    return parsed.pathname.replace(/\/$/, '') || '/';
  } catch { return null; }
}

/**
 * One key per source page, for de-duplicating citations: a BAYLINK page by its path ("site:/guides/x", absolute or
 * relative), any other page by host (no www), path without trailing slashes and query ("ferrybuildingmarketplace.com/visit").
 */
export function bayBayPageKey(url: string): string {
  const site = bayBaySitePath(url);
  if (site) return `site:${site}`;
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase().replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
  } catch { return url.trim(); }
}

/** The host a citation line names ("sftravel.com"), or null for a BAYLINK page (the caller labels it) or a bad URL. */
export function bayBaySourceHost(url: string): string | null {
  if (bayBaySitePath(url)) return null;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}
