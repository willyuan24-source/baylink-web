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

/** A review schedule is not a new factual verification. Original checked dates are copied unchanged. */
export function contentReviewQueue(records: ContentReviewRecord[], today: string): ContentReviewRow[] {
  if (!validDate(today)) throw new Error('A valid local editorial date is required');
  const rows = records.map((record): ContentReviewRow => {
    if (!Number.isInteger(record.cadenceDays) || record.cadenceDays < 1) throw new Error(`Invalid review cadence: ${record.id}`);
    const checked = validDate(record.verifiedAt) && record.verifiedAt <= today;
    const nextReviewAt = checked ? new Date(Date.parse(`${record.verifiedAt}T12:00:00Z`) + record.cadenceDays * 86_400_000).toISOString().slice(0, 10) : undefined;
    const archived = validDate(record.endDate) && record.endDate < today;
    const status = archived ? 'archived' : record.manualReviewReason ? 'manual-review' : !checked ? 'missing-date' : nextReviewAt! <= today ? 'due' : 'scheduled';
    return { ...record, nextReviewAt, status };
  });
  const order = { 'manual-review': 0, 'missing-date': 1, due: 2, scheduled: 3, archived: 4 };
  const risk = { 'health-legal-financial': 0, 'time-sensitive': 1, evergreen: 2 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || risk[a.risk] - risk[b.risk] || (a.nextReviewAt || '').localeCompare(b.nextReviewAt || '') || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}
