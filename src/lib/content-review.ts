import type { Guide } from '../data/guides';
import type { LocalDiscovery } from '../data/local-discoveries';

export type ContentReviewRecord = {
  kind: 'event' | 'offer' | 'opening' | 'guide' | 'bulletin'; id: string; title: string; path: string;
  sourceUrls: string[]; verifiedAt?: string; endDate?: string;
  dateMeaning?: 'source-verified' | 'content-updated';
  risk: 'time-sensitive' | 'health-legal-financial' | 'evergreen';
  cadenceDays: number; manualReviewReason?: string;
};
export type ContentReviewRow = ContentReviewRecord & {
  nextReviewAt?: string; status: 'manual-review' | 'missing-date' | 'due' | 'scheduled' | 'archived';
};

const validDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Internal reasons are evidence for editors, never renewed source-check dates. */
const MANUAL_REVIEW: Record<string, string> = {
  'bay-area-dental-care-insurance-low-cost-guide': 'The DHCS dentist directory could not be read directly on 2026-10-06. Official indexed directory text and readable agency/program pages informed the guide; manually confirm the directory before expanding provider or availability claims.',
  'bay-area-naturalization-official-path-guide': 'USCIS direct HTML/PDF reads returned 403 on 2026-10-06. Official indexed document content informed this draft; manually confirm current N-400, fees, exceptions and exam version before expanding legal claims.',
  'famsf-bay-area-free-saturdays': 'Official FAMSF program/ticket pages returned 403 on 2026-10-05. Confirm free timed-ticket steps manually; retain 2026-10-02 factual check.',
  'california-tenant-deposit-rights-help-guide': 'California Courts deposit page could not be read automatically on 2026-10-05. DOJ and CRD guidance was readable; manually confirm court procedure before expanding legal claims.',
};

export function contentReviewToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

/** Shared per-item policy avoids importing the complete catalog into a reader notice. */
export function guideContentReviewRecord(guide: Pick<Guide, 'slug' | 'title' | 'tags' | 'sources' | 'updatedAt' | 'editionMonth' | 'editionThroughDate'>): ContentReviewRecord {
  const highRisk = /医保|Medicare|Medi-Cal|报税|税务|租客权益|合同|押金|法律|就医|找医生|牙科|看牙|日间照护|日間照護|dental|adult day care|驾照|公证|社安|社会保障|退休|入籍|naturalization|Social Security/iu.test([guide.title, ...guide.tags].join(' '));
  const editionEnd = guide.editionMonth && /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(guide.editionMonth)
    ? new Date(Date.UTC(Number(guide.editionMonth.slice(0, 4)), Number(guide.editionMonth.slice(5)), 0)).toISOString().slice(0, 10) : undefined;
  return { kind: 'guide', id: guide.slug, title: guide.title, path: `/guides/${guide.slug}`, sourceUrls: [...new Set(guide.sources.map(source => source.url))], verifiedAt: guide.updatedAt, dateMeaning: 'content-updated',
    endDate: guide.editionThroughDate || editionEnd, risk: highRisk ? 'health-legal-financial' : guide.editionMonth ? 'time-sensitive' : 'evergreen', cadenceDays: highRisk ? 30 : guide.editionMonth ? 14 : 90,
    manualReviewReason: MANUAL_REVIEW[guide.slug] };
}

export function discoveryContentReviewRecord(item: LocalDiscovery): ContentReviewRecord {
  if (item.kind === 'event') return { kind: 'event', id: item.event.id, title: item.event.title, path: `/events/${item.event.id}`, sourceUrls: [item.event.officialUrl], verifiedAt: item.event.verifiedAt, endDate: item.event.endDate, risk: 'time-sensitive', cadenceDays: 7 };
  if (item.kind === 'offer') return { kind: 'offer', id: item.offer.id, title: item.offer.title, path: `/offers/${item.offer.id}`, sourceUrls: [...new Set([item.offer.sourceUrl, item.offer.storeUrl].filter((url): url is string => !!url))], verifiedAt: item.offer.verifiedAt, endDate: item.offer.endDate, risk: 'time-sensitive', cadenceDays: 7,
    manualReviewReason: MANUAL_REVIEW[item.offer.id] || (item.offer.verificationStatus === 'needs-confirmation' ? 'Offer explicitly needs editorial confirmation' : undefined) };
  return { kind: 'opening', id: item.shop.id, title: item.shop.name, path: `/openings/${item.shop.id}`, sourceUrls: [item.shop.officialUrl], verifiedAt: item.shop.verifiedAt, risk: 'time-sensitive', cadenceDays: item.shop.status === 'announced' ? 7 : 30 };
}

/** The static manifest is data, not an instruction to fetch arbitrary URLs or alter content. */
export function parseContentReviewManifest(value: unknown, today: string): ContentReviewRow[] {
  const manifest = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  if (manifest?.version !== 1 || !Array.isArray(manifest.items) || manifest.items.length > 5000) throw new Error('Invalid content review manifest');
  const identities = new Set<string>();
  const records = manifest.items.map((value): ContentReviewRecord => {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    if (!['event', 'offer', 'opening', 'guide', 'bulletin'].includes(String(item.kind)) || typeof item.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/u.test(item.id)
      || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 600 || typeof item.path !== 'string' || !/^\/(?:events|offers|openings|guides)\/[a-zA-Z0-9_-]+$|^\/this-month#monthly-news$/u.test(item.path)
      || !Array.isArray(item.sourceUrls) || item.sourceUrls.length > 100 || item.sourceUrls.some(url => typeof url !== 'string' || !/^https?:\/\//u.test(url) || url.length > 3000)
      || !['time-sensitive', 'health-legal-financial', 'evergreen'].includes(String(item.risk)) || !Number.isInteger(item.cadenceDays) || Number(item.cadenceDays) < 1 || Number(item.cadenceDays) > 366
      || (item.verifiedAt !== undefined && typeof item.verifiedAt !== 'string') || (item.endDate !== undefined && typeof item.endDate !== 'string')
      || (item.dateMeaning !== undefined && !['source-verified', 'content-updated'].includes(String(item.dateMeaning))) || (item.manualReviewReason !== undefined && typeof item.manualReviewReason !== 'string')) throw new Error('Invalid content review record');
    const identity = `${item.kind}:${item.id}`;
    if (identities.has(identity)) throw new Error('Duplicate content review record');
    identities.add(identity);
    return { kind: item.kind as ContentReviewRecord['kind'], id: item.id, title: item.title, path: item.path, sourceUrls: item.sourceUrls as string[], verifiedAt: item.verifiedAt as string | undefined,
      endDate: item.endDate as string | undefined, dateMeaning: item.dateMeaning as ContentReviewRecord['dateMeaning'], risk: item.risk as ContentReviewRecord['risk'], cadenceDays: Number(item.cadenceDays), manualReviewReason: item.manualReviewReason as string | undefined };
  });
  return contentReviewQueue(records, today);
}

/** A review schedule is not a new factual verification. Original checked dates are copied unchanged. */
export function contentReviewQueue(records: ContentReviewRecord[], today: string): ContentReviewRow[] {
  if (!validDate(today)) throw new Error('A valid local editorial date is required');
  const rows = records.map((record): ContentReviewRow => {
    if (!Number.isInteger(record.cadenceDays) || record.cadenceDays < 1) throw new Error(`Invalid review cadence: ${record.id}`);
    const checked = validDate(record.verifiedAt) && record.verifiedAt <= today && (!record.endDate || validDate(record.endDate));
    const nextReviewAt = checked ? new Date(Date.parse(`${record.verifiedAt}T12:00:00Z`) + record.cadenceDays * 86_400_000).toISOString().slice(0, 10) : undefined;
    const archived = validDate(record.endDate) && record.endDate < today;
    const status = archived ? 'archived' : record.manualReviewReason ? 'manual-review' : !checked ? 'missing-date' : nextReviewAt! <= today ? 'due' : 'scheduled';
    return { ...record, nextReviewAt, status };
  });
  const order = { 'manual-review': 0, 'missing-date': 1, due: 2, scheduled: 3, archived: 4 };
  const risk = { 'health-legal-financial': 0, 'time-sensitive': 1, evergreen: 2 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || risk[a.risk] - risk[b.risk] || (a.nextReviewAt || '').localeCompare(b.nextReviewAt || '') || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}
