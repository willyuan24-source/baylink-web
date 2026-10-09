// System notices inside a conversation (booking and group updates) are server text with a site URL and a record id
// (E2E-14). Readers see a card: the kind, the status, the item and its time, and one in-app link — never a URL or UUID.
import { translateText, type Locale } from '../../i18n/locale';

export type SystemNoticeKind = 'booking' | 'outing' | 'notice';
export type SystemNotice = {
  kind: SystemNoticeKind;
  /** "已确认", "收到新的加入申请" … (the server's wording; see `noticeEnglish` for the English form). */
  status: string;
  /** The remaining lines, cleaned: item title, time, the standing disclaimer. */
  lines: string[];
  /** In-app destination ("/me/bookings#booking-…", "/together?outing=…"), when the notice names one. */
  to?: string;
};

const URL_PATTERN = /https?:\/\/[^\s<>"'）)]+/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** Hashes and database ids (24+ hex characters, or a prefixed hash such as booking_9f… / outing_9f…). */
const RAW_ID_PATTERN = /\b(?:[a-z]+_)?[0-9a-f]{24,}\b/gi;
const ID_LINE = /^(?:预约编号|預約編號|编号|編號|记录编号|記錄編號|booking (?:id|number)|reference)\s*[:：]/i;
const HEADER = /^BAYLINK\s*(服务预约|服務預約|小队|小隊)\s*[·・•]\s*(.+)$/;
const SITE_HOSTS = new Set(['www.baylink.us', 'baylink.us']);

/** A baylink.us URL as an in-app path (pathname + search + hash); anything else is dropped. */
export function internalPath(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!SITE_HOSTS.has(parsed.hostname)) return undefined;
    const path = parsed.pathname.replace(/^\/(?:en|zh-Hant)(?=\/|$)/, '') || '/';
    return `${path}${parsed.search}${parsed.hash}`;
  } catch { return undefined; }
}

const scrub = (text: string) => text.replace(URL_PATTERN, ' ').replace(UUID_PATTERN, ' ').replace(RAW_ID_PATTERN, ' ').replace(/\s{2,}/g, ' ').trim();

export function parseSystemNotice(content: string, messageId = ''): SystemNotice {
  const raw = String(content || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let to: string | undefined;
  let recordId: string | undefined;
  const kept: string[] = [];
  for (const line of raw) {
    if (ID_LINE.test(line)) { recordId ||= line.match(UUID_PATTERN)?.[0]; continue; }
    for (const url of line.match(URL_PATTERN) || []) to ||= internalPath(url);
    const text = scrub(line);
    if (text) kept.push(text);
  }
  const header = kept.length ? HEADER.exec(kept[0]) : null;
  // The server's record id names the kind (booking_… / outing_…); the header wording is the fallback.
  const kind: SystemNoticeKind = messageId.startsWith('booking_') ? 'booking' : messageId.startsWith('outing_') ? 'outing'
    : header ? (/预约|預約/.test(header[1]) ? 'booking' : 'outing') : 'notice';
  const status = header ? header[2].trim() : kept[0] || '';
  const lines = kept.slice(1);
  // Only the two server notice kinds link anywhere, and only to their own in-app pages.
  if (kind === 'booking') to = `/me/bookings${recordId ? `#booking-${recordId}` : ''}`;
  else if (kind === 'outing') to = to?.startsWith('/together?outing=') ? to : '/together?view=mine';
  else to = undefined;
  return { kind, status, lines, to };
}


type Pair = { zh: string; en: string };
const KIND: Record<SystemNoticeKind, Pair> = { booking: { zh: '服务预约', en: 'Service booking' }, outing: { zh: '小队', en: 'Group' }, notice: { zh: '系统通知', en: 'Notice' } };
/** The server's fixed wording in the reader's language: English from the pairs, 繁體 by conversion. */
const fixed = (pair: Pair, locale: Locale) => locale === 'en' ? pair.en : translateText(pair.zh, locale);
export const noticeKindLabel = (kind: SystemNoticeKind, locale: Locale) => fixed(KIND[kind], locale);

/** English for the fixed server wording (statuses and the standing disclaimers). */
const ENGLISH = new Map<string, string>(([
  { zh: '待服务者确认', en: 'Awaiting the provider' }, { zh: '已确认', en: 'Confirmed' }, { zh: '已拒绝', en: 'Declined' },
  { zh: '已取消', en: 'Cancelled' }, { zh: '申请已过期', en: 'Request expired' }, { zh: '已标记完成', en: 'Marked complete' },
  { zh: '收到改期提议，待对方同意', en: 'New time proposed; waiting for the other side' },
  { zh: '双方已同意改期', en: 'Both sides agreed to the new time' },
  { zh: '改期被婉拒，原预约保留', en: 'New time declined; the original booking stands' },
  { zh: '改期提议已撤回，原预约保留', en: 'New time withdrawn; the original booking stands' },
  { zh: '改期提议已过期，原预约保留', en: 'New time expired; the original booking stands' },
  { zh: '安排已变更，请查看并重新确认', en: 'Plans changed; please review and confirm again' },
  { zh: '一位成员已退出，有空位请审核候补申请', en: 'A member left; review the waitlist for the open spot' },
  { zh: '一位成员已退出', en: 'A member left' }, { zh: '小队已取消', en: 'The group was cancelled' },
  { zh: '收到新的候补申请', en: 'New waitlist request' }, { zh: '收到新的加入申请', en: 'New request to join' },
  { zh: '加入申请已通过', en: 'Your request to join was accepted' }, { zh: '加入申请未通过', en: 'Your request to join was not accepted' },
  { zh: '你已被移出小队', en: 'You were removed from the group' },
  { zh: '队长发起了时间投票，当前安排暂不变', en: 'The host started a time poll; current plans stay for now' },
  { zh: '投票时间已采用，请查看并重新确认安排', en: 'The voted time was adopted; please review and confirm again' },
  { zh: '时间投票已结束，保留当前安排', en: 'The time poll ended; current plans stay' },
  { zh: '管理员已取消小队', en: 'An administrator cancelled the group' },
  { zh: '这是时间安排记录，不含支付；价格、地点和服务范围请双方另行确认。', en: 'This is a scheduling record with no payment. Agree on price, place and scope with each other.' },
  { zh: '组队不等于活动购票或主办方报名。', en: 'Joining a group is not a ticket purchase or an organiser registration.' },
  { zh: '对方同意且新时段仍可约后才会改期，原预约在此之前保留。', en: 'The time changes only after the other side agrees and the new slot is still open; until then the original booking stands.' },
] satisfies Pair[]).map(pair => [pair.zh, pair.en]));
const PACIFIC: Pair = { zh: '（洛杉矶时间）', en: ' (Pacific time)' };
const PROPOSED: Pair = { zh: '提议时间：', en: 'Proposed time: ' };
const WHEN = /^(提议时间[:：]\s*)?(\d{4})-(\d{2})-(\d{2}) (\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})(（洛杉矶时间）)?$/;

/** True for the server's fixed wording (a status, a disclaimer, a time); false for a member's own words such as the item title. */
export const isNoticeWording = (text: string) => ENGLISH.has(text) || WHEN.test(text);

/** A status in the reader's language; one the site does not know stays as the server wrote it. */
export function noticeStatus(status: string, locale: Locale): string {
  const english = ENGLISH.get(status);
  return english === undefined ? status : fixed({ zh: status, en: english }, locale);
}

/** One line for the conversation list: the notice's kind and status for a system notice, otherwise the message without links or ids. */
export function previewText(content: string | undefined, locale: Locale = 'zh-Hans'): string {
  const text = String(content || '');
  const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
  const header = HEADER.exec(firstLine);
  if (header) return `${noticeKindLabel(/预约|預約/.test(header[1]) ? 'booking' : 'outing', locale)} · ${noticeStatus(header[2].trim(), locale)}`;
  return scrub(text.replace(/\s+/g, ' '));
}

/**
 * A notice line in the reader's language. "2026-10-17 10:00–11:00（洛杉矶时间）" reads as a date: "10月17日周六 10:00–11:00
 * （洛杉矶时间）", "10月17日週六 10:00–11:00（洛杉磯時間）" or "Sat, Oct 17 · 10:00–11:00 (Pacific time)". Fixed wording is
 * translated; any other line (the item's own title) stays as written apart from the time-zone and proposal fragments.
 */
export function noticeLine(text: string, locale: Locale): string {
  const match = WHEN.exec(text);
  if (!match) {
    const english = ENGLISH.get(text);
    if (english !== undefined) return fixed({ zh: text, en: english }, locale);
    return locale === 'zh-Hans' ? text : text.split(PACIFIC.zh).join(fixed(PACIFIC, locale)).replace(PROPOSED.zh, fixed(PROPOSED, locale));
  }
  const [, proposed, year, month, day, start, end, pacific] = match;
  const english = locale === 'en';
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const label = new Intl.DateTimeFormat(english ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN', { weekday: 'short', month: english ? 'short' : 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
  const prefix = proposed ? fixed(PROPOSED, locale) : '';
  const suffix = pacific ? fixed(PACIFIC, locale) : '';
  return english ? `${prefix}${label} · ${start}–${end}${suffix}` : `${prefix}${label} ${start}–${end}${suffix}`;
}
