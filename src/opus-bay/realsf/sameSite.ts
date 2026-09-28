/**
 * Wave 5 · lane R (W5-R7) · the same-site data files lane R bakes at build time (`public/opus-bay/sf/<version>/`):
 * tides.json (scripts/opus-sf/export-tides.ts) and live.json (scripts/opus-sf/export-live.ts). The player's browser
 * only ever fetches these same-site paths (production CSP `connect-src 'self'`, plan D13): never NOAA or anyone else.
 */

/** Fetch `/opus-bay/sf/<current version>/<name>` as JSON (null on any failure; never throws). */
export async function fetchSfJson(name: 'tides.json' | 'live.json', fetcher?: typeof fetch): Promise<unknown> {
  const get = fetcher ?? globalThis.fetch.bind(globalThis);
  try {
    const cur = (await (await get('/opus-bay/sf/current.json')).json()) as { version?: unknown };
    const version = typeof cur.version === 'string' && /^[a-z0-9-]{1,16}$/.test(cur.version) ? cur.version : 'v1';
    const res = await get(`/opus-bay/sf/${version}/${name}`);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}
