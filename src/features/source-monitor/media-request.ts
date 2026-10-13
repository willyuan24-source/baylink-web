import type { MediaRightsBasis } from '../../data/guide-media';

/**
 * The organiser-image queue (content.md §4.3, REPORT-1007 §5.8, RC-32): GET /api/admin/source-monitor/media-candidates lists
 * each live listing's og:image / twitter:image URL. Nothing here downloads or displays an image. An editor asks the organiser
 * (a prepared email), records a public-domain / CC / press-kit / permission basis as a rights record to hand to the content
 * lane (no image is published without `rights.basis`), or rejects the candidate. There is no API to store these decisions,
 * so they stay in this browser.
 */
export type MediaCandidate = {
  sourceId: string; kind: string; title: string; url: string; contentIds: string[]; nextDate: string | null;
  listings: { title: string; path: string }[];
  ogImage?: string; ogImageAlt?: string; ogImageWidth?: number; ogImageHeight?: number; twitterImage?: string;
  likelyLogo?: boolean; siteDefault?: boolean; seenAt?: number;
};
export type RecordableBasis = Extract<MediaRightsBasis, 'public-domain' | 'cc' | 'press-kit' | 'permission'>;
export const RECORDABLE_BASES: readonly RecordableBasis[] = ['permission', 'press-kit', 'cc', 'public-domain'];
export type MediaDecision = { decision: 'requested' | 'recorded' | 'rejected'; at: string; record?: MediaRightsRecord };
export type MediaRightsRecord = {
  candidate: { sourceId: string; contentIds: string[]; officialPage: string; imageUrl: string; width?: number; height?: number; alt?: string };
  rights: { basis: RecordableBasis; evidenceUrl: string; scope: string; promoAllowed: boolean; grantedAt?: string };
  recordedOn: string;
  status: 'awaiting owner download approval';
};

export const imageOf = (candidate: MediaCandidate) => candidate.ogImage || candidate.twitterImage || '';
export const decisionKey = (candidate: MediaCandidate) => `${candidate.sourceId}|${imageOf(candidate)}`;

/** Parses the endpoint's answer; anything else is "no answer" (the queue then says it could not load). */
export function parseMediaCandidates(value: unknown): MediaCandidate[] | null {
  const list = value && typeof value === 'object' && Array.isArray((value as { candidates?: unknown }).candidates) ? (value as { candidates: unknown[] }).candidates : null;
  if (!list) return null;
  const text = (input: unknown, max = 3000) => typeof input === 'string' && input.length <= max ? input : undefined;
  const https = (input: unknown) => { const url = text(input); return url && /^https?:\/\//u.test(url) ? url : undefined; };
  const size = (input: unknown) => typeof input === 'number' && Number.isInteger(input) && input > 0 && input < 100_000 ? input : undefined;
  return list.slice(0, 300).flatMap((raw): MediaCandidate[] => {
    const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
    const sourceId = text(row?.sourceId, 160), url = https(row?.url);
    if (!row || !sourceId || !url || !(https(row.ogImage) || https(row.twitterImage))) return [];
    return [{
      sourceId, url, kind: text(row.kind, 40) || 'event', title: text(row.title, 600) || sourceId,
      contentIds: Array.isArray(row.contentIds) ? row.contentIds.filter((id): id is string => typeof id === 'string').slice(0, 20) : [],
      nextDate: typeof row.nextDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(row.nextDate) ? row.nextDate : null,
      listings: Array.isArray(row.listings) ? row.listings.flatMap(item => item && typeof item === 'object' && typeof (item as { title?: unknown }).title === 'string' && typeof (item as { path?: unknown }).path === 'string' && /^\/[\w/-]+$/u.test((item as { path: string }).path) ? [{ title: (item as { title: string }).title, path: (item as { path: string }).path }] : []).slice(0, 3) : [],
      ogImage: https(row.ogImage), ogImageAlt: text(row.ogImageAlt, 300), ogImageWidth: size(row.ogImageWidth), ogImageHeight: size(row.ogImageHeight),
      twitterImage: https(row.twitterImage), likelyLogo: row.likelyLogo === true, siteDefault: row.siteDefault === true,
      seenAt: typeof row.seenAt === 'number' && Number.isFinite(row.seenAt) ? row.seenAt : undefined,
    }];
  });
}

/**
 * The permission email (REPORT-1007 §5.8; RC-32: credit, link back, and removal on request). English, because the
 * organisers are; the editor adds the organiser's address from their page. Opens in the editor's own mail app.
 */
export function permissionMailto(candidate: MediaCandidate): string {
  const listing = candidate.listings[0]?.title || candidate.title;
  const when = candidate.nextDate ? ` (${candidate.nextDate})` : '';
  const subject = `Photo permission request: ${candidate.title}`.slice(0, 180);
  const body = [
    'Hello,',
    '',
    'I am writing on behalf of BAYLINK (https://www.baylink.us), a Chinese-language guide that helps Chinese-speaking families in the San Francisco Bay Area find local events. Every listing links to its official source.',
    '',
    `We list "${listing}"${when} and link to your page: ${candidate.url}`,
    `May we show your official image on that listing? ${imageOf(candidate)}`,
    '',
    'We would credit it as "© [your organization]" with a link back to your page, use it only alongside our coverage of this event, and remove it promptly if you ask.',
    '',
    'A short reply to this email is enough. If you prefer a different image or credit line, please tell us.',
    '',
    'Thank you,',
    'BAYLINK · https://www.baylink.us/about',
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The record an editor copies for the content lane / owner approval list. Validates what a rights record must carry. */
export function rightsRecord(candidate: MediaCandidate, input: { basis: RecordableBasis; evidenceUrl: string; scope: string; promoAllowed: boolean; grantedAt?: string }, today: string): MediaRightsRecord | null {
  const evidenceUrl = input.evidenceUrl.trim(), scope = input.scope.trim(), grantedAt = input.grantedAt?.trim();
  if (!RECORDABLE_BASES.includes(input.basis) || !/^https:\/\/\S+$/u.test(evidenceUrl) || evidenceUrl.length > 1000 || !scope || scope.length > 200) return null;
  if (grantedAt && !/^\d{4}-\d{2}-\d{2}$/u.test(grantedAt)) return null;
  if (input.basis === 'permission' && !grantedAt) return null;
  return {
    candidate: { sourceId: candidate.sourceId, contentIds: candidate.contentIds, officialPage: candidate.url, imageUrl: imageOf(candidate),
      ...(candidate.ogImageWidth ? { width: candidate.ogImageWidth } : {}), ...(candidate.ogImageHeight ? { height: candidate.ogImageHeight } : {}), ...(candidate.ogImageAlt ? { alt: candidate.ogImageAlt } : {}) },
    rights: { basis: input.basis, evidenceUrl, scope, promoAllowed: input.promoAllowed, ...(grantedAt ? { grantedAt } : {}) },
    recordedOn: today,
    status: 'awaiting owner download approval',
  };
}

const DECISIONS_KEY = 'baylink.admin.media-decisions.v1';
export function readMediaDecisions(): Record<string, MediaDecision> {
  try {
    const value = JSON.parse(window.localStorage.getItem(DECISIONS_KEY) || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, MediaDecision> : {};
  } catch { return {}; }
}
export function writeMediaDecisions(decisions: Record<string, MediaDecision>): boolean {
  try { window.localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions)); return true; } catch { return false; }
}
