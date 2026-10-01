export type PlannerWebSource = { number: number; title: string; url: string; snippet?: string };
export type PlannerWebCandidate = { id: string; name: string; city: string | null; summary: string | null; timeSummary: string | null; priceSummary: string | null; sourceUrls: string[] };
export type PlannerWebResult = { answer: string; sources: PlannerWebSource[]; checkedAt: string | null; cached: boolean; candidates: PlannerWebCandidate[] };
export type SavedWebCandidate = PlannerWebCandidate & { checkedAt: string | null; requestedDate: string | null };
export const GUEST_WEB_CANDIDATES_KEY = 'baylink.planner.web-candidates.guest.v1';

/** A name-based lookup, not a verified coordinate or route. */
export function plannerWebMapSearchUrl(candidate: Pick<PlannerWebCandidate, 'name' | 'city'>): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', [candidate.name.trim(), candidate.city?.trim(), 'California'].filter(Boolean).join(', '));
  return url.href;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Public web references only. No embedded credentials, local hosts or IP literals.
 * This validates a link, not the destination's content or DNS resolution.
 */
export function safePlannerWebUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096 || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127 || char === '\\')) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.+$/, '');
    // Public sources do not need IP-literal links. URL normalizes unusual IPv4
    // spellings (e.g. 2130706433 or 0x7f000001) before this check.
    if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host)) return null;
    if (/(?:^|\.)(?:localhost|local|internal|intranet|lan|home|test|invalid)$/.test(host) || /(?:^|\.)home\.arpa$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}

function validCheckedAt(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const day = value.slice(0, 10);
  const dayStamp = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(dayStamp) || new Date(dayStamp).toISOString().slice(0, 10) !== day || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

const shortText = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

/** A candidate must point to citations from this response, never a model-invented URL. */
function parseCandidate(value: unknown, sourceUrls?: Set<string>): PlannerWebCandidate | null {
  if (!record(value)) return null;
  const id = shortText(value.id, 100), name = shortText(value.name, 160);
  if (!id || !name || !Array.isArray(value.sourceUrls)) return null;
  const urls = [...new Set(value.sourceUrls.flatMap(raw => {
    const url = safePlannerWebUrl(raw);
    return url && (!sourceUrls || sourceUrls.has(url)) ? [url] : [];
  }))].slice(0, 5);
  if (!urls.length) return null;
  return { id, name, city: shortText(value.city, 100), summary: shortText(value.summary, 700), timeSummary: shortText(value.timeSummary, 500), priceSummary: shortText(value.priceSummary, 500), sourceUrls: urls };
}

/** Guest saves stay on this browser. Signed-in results are never written here. */
export function loadGuestWebCandidates(): SavedWebCandidate[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GUEST_WEB_CANDIDATES_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 20).flatMap(item => {
      const candidate = parseCandidate(item);
      return candidate && record(item) ? [{ ...candidate, checkedAt: validCheckedAt(item.checkedAt), requestedDate: validCheckedAt(item.requestedDate)?.slice(0, 10) || null }] : [];
    }).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index);
  } catch { return []; }
}

/** Keep source numbers tied to the original array, even after rejecting a URL. */
export function parsePlannerWebResult(value: unknown): PlannerWebResult | null {
  if (!record(value) || value.ok !== true || value.responseMode !== 'web' || typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 30000 || !Array.isArray(value.sources)) return null;
  const sources = value.sources.slice(0, 30).flatMap((item, index): PlannerWebSource[] => {
    if (!record(item)) return [];
    const url = safePlannerWebUrl(item.url);
    if (!url) return [];
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 500) : new URL(url).hostname;
    return [{ number: index + 1, title, url, ...(typeof item.snippet === 'string' && item.snippet.trim() ? { snippet: item.snippet.trim().slice(0, 1500) } : {}) }];
  });
  if (!sources.length) return null;
  const urls = new Set(sources.map(source => source.url));
  const candidates = Array.isArray(value.candidates) ? value.candidates.slice(0, 5).flatMap(item => { const candidate = parseCandidate(item, urls); return candidate ? [candidate] : []; }).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index) : [];
  return { answer: value.answer, sources, checkedAt: validCheckedAt(value.checkedAt), cached: value.cached === true, candidates };
}

export type PlannerWebAnswerPart = { text: string; citation?: number; source?: PlannerWebSource };
export function plannerWebAnswerParts(result: PlannerWebResult): PlannerWebAnswerPart[] {
  return result.answer.split(/(\[\d+\])/g).filter(Boolean).map(text => {
    const match = /^\[(\d+)\]$/.exec(text);
    if (!match) return { text };
    const citation = Number(match[1]);
    return { text, citation, source: result.sources.find(source => source.number === citation) };
  });
}
