/**
 * The editor's material-first queue (WEB-FRESH-ADMIN, plan §3.3) over GET /api/admin/source-monitor. Source triage
 * (API-FRESH-TRIAGE) judges each pending change: cosmetic ones are dismissed automatically as `auto-triage`, material
 * ones wait for an editor. Readers see a prompt for a material change once it has waited 48 hours (getReaderFreshness),
 * so the queue puts possible cancellations first, then material changes oldest first, then changes nobody has judged.
 * Pure functions only: the page renders what these return.
 */
export type AdminTriage = {
  hash?: string; material?: boolean; fields?: string[]; summaryZh?: string; decidedBy?: string; guards?: string[];
  at?: number; failures?: number; lastError?: string;
};
export type AdminPendingChange = {
  before: string; after: string; removed: string[]; added: string[]; summary: string; detectedAt: number; firstDetectedAt?: number;
};
export type AdminMediaCandidates = {
  ogImage?: string; ogImageAlt?: string; ogImageWidth?: number; ogImageHeight?: number; twitterImage?: string; title?: string; likelyLogo?: boolean; seenAt?: number;
};
export type AdminSourceRow = {
  id: string; title: string; url: string; kind: string; endDate?: string; contentIds?: string[];
  status: string; errorCode: string; lastFetchedAt: number | null; lastAttemptAt: number | null;
  reviewStatus: string; lastReviewedAt: number | null; reviewedBy?: string; reviewNote: string; lastEditorReviewAt?: number | null;
  hash: string; pendingChange: AdminPendingChange | null; triage?: AdminTriage | null; mediaCandidates?: AdminMediaCandidates | null;
};
export type TriageState = { enabled?: boolean; reason?: string; calls?: number; dailyLimit?: number; digest?: string };

export const READER_PROMPT_AFTER_MS = 48 * 3_600_000;
const RECENT_AUTO_MS = 48 * 3_600_000;
/** Kinds of fact a material change touches, in the order an editor checks them. */
export const TRIAGE_FIELD_LABELS: Record<string, { zh: string; en: string }> = {
  cancel: { zh: '取消或改期', en: 'Cancelled or moved' }, date: { zh: '日期', en: 'Date' }, time: { zh: '时间', en: 'Time' },
  price: { zh: '价格', en: 'Price' }, location: { zh: '地点', en: 'Location' }, eligibility: { zh: '资格条件', en: 'Eligibility' },
  registration: { zh: '报名或票务', en: 'Registration' }, phone: { zh: '电话', en: 'Phone' }, other: { zh: '其他', en: 'Other' },
};

/** The triage verdict for the text now pending, or null when triage has not judged this exact text. */
export function currentTriage(row: AdminSourceRow): AdminTriage | null {
  const triage = row.triage;
  return triage && triage.hash && triage.hash === row.hash && typeof triage.material === 'boolean' ? triage : null;
}

/** When this still-unreviewed change was first seen (the editor's 48-hour window starts there). */
export const changedAtOf = (row: AdminSourceRow): number | null => row.pendingChange?.firstDetectedAt || row.pendingChange?.detectedAt || null;

export const isPending = (row: AdminSourceRow) => row.status !== 'expired' && row.reviewStatus === 'pending';
/**
 * Readers already see this change: a possible cancellation at once (the notice box), another material change once it has
 * waited 48 hours ("主办方页面有更新"). Mirrors getReaderFreshness, which also stays quiet when an editor re-checked the
 * listing after the change; the admin row cannot see that date, so this may over-count, never under-count.
 */
export const readersSeeIt = (row: AdminSourceRow, now: number) => {
  const triage = currentTriage(row), at = changedAtOf(row);
  if (!isPending(row) || !triage?.material) return false;
  return !!triage.fields?.includes('cancel') || !at || now - at >= READER_PROMPT_AFTER_MS;
};

export type TriageQueue = {
  /** Material, with cancellation or postponement wording added: readers see a box at once. */
  cancel: AdminSourceRow[];
  /** Material changes, oldest first. */
  material: AdminSourceRow[];
  /** Pending changes triage has not judged (triage off, failed, or not yet run on this text). Readers see nothing. */
  untriaged: AdminSourceRow[];
  /** Sources the monitor cannot read (blocked, needs JavaScript, errors) with nothing pending. Readers see nothing. */
  unreadable: AdminSourceRow[];
  /** Cosmetic changes triage dismissed in the last 48 hours: for spot checks, never shown to readers as a review. */
  autoDismissed: AdminSourceRow[];
};

const oldestFirst = (a: AdminSourceRow, b: AdminSourceRow) => (changedAtOf(a) ?? Infinity) - (changedAtOf(b) ?? Infinity) || a.title.localeCompare(b.title);

export function triageQueue(rows: readonly AdminSourceRow[], now: number): TriageQueue {
  const queue: TriageQueue = { cancel: [], material: [], untriaged: [], unreadable: [], autoDismissed: [] };
  for (const row of rows) {
    if (row.status === 'expired') continue;
    if (isPending(row)) {
      const triage = currentTriage(row);
      if (triage?.material && triage.fields?.includes('cancel')) queue.cancel.push(row);
      else if (triage?.material) queue.material.push(row);
      else queue.untriaged.push(row);
    } else if (row.status === 'manual-required' || row.status === 'error') queue.unreadable.push(row);
    else if (row.reviewedBy === 'auto-triage' && row.lastReviewedAt && now - row.lastReviewedAt < RECENT_AUTO_MS) queue.autoDismissed.push(row);
  }
  queue.cancel.sort(oldestFirst); queue.material.sort(oldestFirst); queue.untriaged.sort(oldestFirst);
  queue.unreadable.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  queue.autoDismissed.sort((a, b) => (b.lastReviewedAt || 0) - (a.lastReviewedAt || 0));
  return queue;
}

/** Whole hours a change has waited (floor), for "已等 52 小时". */
export const hoursWaiting = (row: AdminSourceRow, now: number) => { const at = changedAtOf(row); return at ? Math.max(0, Math.floor((now - at) / 3_600_000)) : null; };
