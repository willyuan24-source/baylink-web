import { guides } from '../data/guides';
import { safePlannerWebUrl } from './planner-web-search';

/**
 * The v2 answer contract and the cut-over contract (api docs/ai-models.md, ENGINE #31, STREAM #32, CUTOVER #34).
 * Every field is optional and additive: a v1 response (legacy `answer` only) keeps rendering as before, and a field
 * that fails validation is dropped, never rendered.
 */
export type BayBayPoint = { text: string; cardIds: string[] };
export type BayBayCallAction = { id: string; label: string; href: string; primary?: boolean };
export type BayBayEmergencySafety = { kind: 'emergency'; topic?: string; title: string; actions: BayBayCallAction[]; hideFollowups: boolean; hideFeedback: boolean };
export type BayBayResource = { id: string; title: string; url: string; phone?: string; href?: string };
export type BayBayProfessionalSafety = { kind: 'professional'; topic: string; topics: string[]; resources: BayBayResource[]; guides: { slug: string; title: string; url: string }[] };
export type BayBaySafety = BayBayEmergencySafety | BayBayProfessionalSafety;
export type BayBayNoticeKind = 'ai_daily_budget' | 'ai_paused' | 'ai_budget_reduced';
export type BayBayNotice = { kind: BayBayNoticeKind; text: string; resumesAt?: string };
export type BayBayPageEntity = { kind: 'event' | 'offer' | 'opening' | 'guide' | 'place'; id: string; title: string };
export type BayBayAnswerFields = {
  lead?: string; points?: BayBayPoint[]; gap?: string; pageEntity?: BayBayPageEntity | null;
  safety?: BayBaySafety; notice?: BayBayNotice; fallbackHelp?: { actions: BayBayCallAction[] }; corrected?: boolean;
};

/** Capabilities (GET /api/ai/baybay-capabilities): a paused or reduced BayBay, with its banner in every locale. */
export type BayBayBanner = { 'zh-Hans': string; 'zh-Hant': string; en: string };
export type BayBayPause = { reason: string; kind: 'ai_daily_budget' | 'ai_paused'; banner: BayBayBanner; resumesAt?: string; actions: BayBayCallAction[] };
export type BayBayReduced = { reason: string; kind: 'ai_budget_reduced'; banner: BayBayBanner; resumesAt?: string };
/** The AI cutoff announced ahead (api #37: `pauseScheduled`, or `aiUntil` alone): only inside its last 7 days. */
export type BayBayScheduledPause = { at: string; banner: BayBayBanner };
export type BayBayCapabilities = { pause: BayBayPause | null; reduced: BayBayReduced | null; scheduled: BayBayScheduledPause | null };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const text = v.trim();
  return text && text.length <= max && [...text].every(char => char.charCodeAt(0) >= 32 || char === '\n') ? text : undefined;
};
/** Only phone links: `tel:911`, `tel:+18002221222`. Anything else is not a call action. */
export const safeTelHref = (v: unknown): string | undefined => typeof v === 'string' && /^tel:\+?\d{3,15}$/.test(v) ? v : undefined;
const CARD_KEY = /^(?:event|offer|opening|guide|place):[A-Za-z0-9_-]{1,120}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const resumesAt = (v: unknown) => typeof v === 'string' && ISO_TIME.test(v) && Number.isFinite(Date.parse(v)) ? { resumesAt: v } : {};
const NOTICE_KINDS: readonly BayBayNoticeKind[] = ['ai_daily_budget', 'ai_paused', 'ai_budget_reduced'];

function callActions(v: unknown, max = 4): BayBayCallAction[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  return v.slice(0, max).flatMap(item => {
    if (!record(item)) return [];
    const id = clean(item.id, 60), label = clean(item.label, 80), href = safeTelHref(item.href);
    if (!id || !label || !href || seen.has(id)) return [];
    seen.add(id);
    return [{ id, label, href, ...(item.primary === true ? { primary: true } : {}) }];
  });
}

function safety(v: unknown): BayBaySafety | undefined {
  if (!record(v)) return undefined;
  if (v.kind === 'emergency') {
    const actions = callActions(v.actions);
    // The card exists to put a working 911 button first; without one, the answer text stays the floor.
    if (!actions.some(action => action.href === 'tel:911')) return undefined;
    return { kind: 'emergency', ...(clean(v.topic, 40) ? { topic: clean(v.topic, 40) } : {}), title: clean(v.title, 80) || '', actions, hideFollowups: v.hideFollowups !== false, hideFeedback: v.hideFeedback !== false };
  }
  if (v.kind !== 'professional') return undefined;
  const topic = clean(v.topic, 40);
  if (!topic) return undefined;
  const resources: BayBayResource[] = Array.isArray(v.resources) ? v.resources.slice(0, 6).flatMap(row => {
    if (!record(row)) return [];
    const id = clean(row.id, 80), title = clean(row.title, 160), url = safePlannerWebUrl(row.url);
    if (!id || !title || !url) return [];
    const href = safeTelHref(row.href), phone = href ? clean(row.phone, 40) : undefined;
    return [{ id, title, url, ...(phone && href ? { phone, href } : {}) }];
  }) : [];
  const guideRows = Array.isArray(v.guides) ? v.guides.slice(0, 4).flatMap(row => {
    if (!record(row) || typeof row.slug !== 'string' || row.url !== `/guides/${row.slug}` || !guides.some(guide => guide.slug === row.slug)) return [];
    const title = clean(row.title, 200);
    return title ? [{ slug: row.slug, title, url: row.url }] : [];
  }) : [];
  if (!resources.length && !guideRows.length) return undefined;
  const topics = Array.isArray(v.topics) ? v.topics.flatMap(item => clean(item, 40) || []).slice(0, 6) : [topic];
  return { kind: 'professional', topic, topics, resources, guides: guideRows };
}

function notice(v: unknown): BayBayNotice | undefined {
  if (!record(v) || !NOTICE_KINDS.includes(v.kind as BayBayNoticeKind)) return undefined;
  const text = clean(v.text, 300);
  return text ? { kind: v.kind as BayBayNoticeKind, text, ...resumesAt(v.resumesAt) } : undefined;
}

/** Validated v2 answer fields. `lead`/`points` come only together, as the server sends them. */
export function parseBayBayAnswerFields(input: unknown): BayBayAnswerFields {
  if (!record(input)) return {};
  const result: BayBayAnswerFields = {};
  const lead = clean(input.lead, 600);
  if (lead && Array.isArray(input.points)) {
    const points = input.points.slice(0, 6).flatMap(point => {
      if (!record(point)) return [];
      const text = clean(point.text, 1600);
      if (!text) return [];
      const cardIds = Array.isArray(point.cardIds) ? [...new Set(point.cardIds.filter((key): key is string => typeof key === 'string' && CARD_KEY.test(key)))].slice(0, 5) : [];
      return [{ text, cardIds }];
    });
    result.lead = lead; result.points = points;
    const gap = clean(input.gap, 800);
    if (gap) result.gap = gap;
  }
  if (record(input.pageEntity)) {
    const kind = input.pageEntity.kind, id = input.pageEntity.id, title = clean(input.pageEntity.title, 300);
    if (['event', 'offer', 'opening', 'guide', 'place'].includes(String(kind)) && typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id) && title) result.pageEntity = { kind: kind as BayBayPageEntity['kind'], id, title };
  }
  const guard = safety(input.safety);
  if (guard) result.safety = guard;
  const banner = notice(input.notice);
  if (banner) result.notice = banner;
  if (record(input.fallbackHelp)) {
    const actions = callActions(input.fallbackHelp.actions);
    if (actions.length) result.fallbackHelp = { actions };
  }
  if (typeof input.corrected === 'boolean') result.corrected = input.corrected;
  return result;
}

function banner(v: unknown): BayBayBanner | undefined {
  if (!record(v)) return undefined;
  const zh = clean(v['zh-Hans'], 300), hant = clean(v['zh-Hant'], 300), en = clean(v.en, 300);
  return zh && hant && en ? { 'zh-Hans': zh, 'zh-Hant': hant, en } : undefined;
}

/** The cutoff is announced in its last 7 days only (api `lib/aiBudget.js` SCHEDULED_PAUSE_DAYS). */
export const BAYBAY_SCHEDULED_PAUSE_DAYS = 7;
const isoTime = (v: unknown) => typeof v === 'string' && ISO_TIME.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined;

/**
 * The api's own `pauseScheduled` wording for a cutoff at `at` (Pacific date and time), for a server that sends only
 * `aiUntil`: "AI 助手预计 10月29日（周四）17:00 起暂停；之后仍可查看站内资料，紧急情况请直接拨打 911。"
 */
export function bayBayScheduledPauseBanner(at: string): BayBayBanner {
  const date = new Date(at);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ...options }).format(date);
  const month = Number(part({ month: 'numeric' })), day = Number(part({ day: 'numeric' }));
  const weekday = '日一二三四五六'[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part({ weekday: 'short' }))];
  const clock = part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return {
    'zh-Hans': `AI 助手预计 ${month}月${day}日（周${weekday}）${clock} 起暂停；之后仍可查看站内资料，紧急情况请直接拨打 911。`,
    'zh-Hant': `AI 助手預計 ${month}月${day}日（週${weekday}）${clock} 起暫停；之後仍可查看站內資料，緊急情況請直接撥打 911。`,
    en: `The AI assistant is scheduled to pause from ${part({ weekday: 'short' })}, ${part({ month: 'short' })} ${day}, ${part({ hour: 'numeric', minute: '2-digit' })} PT. Site information stays available; in an emergency, call 911.`,
  };
}

/** `pauseScheduled` (or `aiUntil` alone) while the cutoff is ahead and at most 7 days away; otherwise null. */
function scheduledPause(input: Record<string, unknown>, now: number): BayBayScheduledPause | null {
  const announced = record(input.pauseScheduled) && input.pauseScheduled.kind === 'ai_pause_scheduled' ? input.pauseScheduled : null;
  const at = isoTime(announced?.at) || isoTime(input.aiUntil);
  if (!at) return null;
  const ms = Date.parse(at);
  if (!(ms > now) || ms - now > BAYBAY_SCHEDULED_PAUSE_DAYS * 86_400_000) return null;
  return { at, banner: banner(announced?.banner) || bayBayScheduledPauseBanner(at) };
}

/**
 * `pause` / `reduced` / the scheduled cutoff from the capabilities endpoint. Unknown shapes mean "not paused" — the
 * answer's own `notice` still shows. A pause says everything, so it carries no scheduled notice.
 */
export function parseBayBayCapabilities(input: unknown, now = Date.now()): BayBayCapabilities {
  const none: BayBayCapabilities = { pause: null, reduced: null, scheduled: null };
  if (!record(input)) return none;
  const pause = input.pause, reduced = input.reduced, scheduled = scheduledPause(input, now);
  if (record(pause) && (pause.kind === 'ai_daily_budget' || pause.kind === 'ai_paused')) {
    const text = banner(pause.banner);
    if (text) return { pause: { reason: clean(pause.reason, 60) || pause.kind, kind: pause.kind, banner: text, ...resumesAt(pause.resumesAt), actions: callActions(pause.actions) }, reduced: null, scheduled: null };
  }
  if (record(reduced) && reduced.kind === 'ai_budget_reduced') {
    const text = banner(reduced.banner);
    if (text) return { pause: null, reduced: { reason: clean(reduced.reason, 60) || reduced.kind, kind: 'ai_budget_reduced', banner: text, ...resumesAt(reduced.resumesAt) }, scheduled };
  }
  return { ...none, scheduled };
}

/**
 * The governance refusals in the reader's language (api `lib/aiBudget.js`; BBENG-04, CODE-API-05), so a quota message
 * never depends on the server's copy or an older server: `daily` ones cannot be retried today.
 */
export const BAYBAY_QUOTA_ERRORS: Record<string, { zh: string; en: string; daily: boolean }> = {
  AI_DAILY_LIMIT: { zh: '今日 AI 额度已用完，请明天再试；仍可浏览站内资料。', en: "You have used today's AI answers. Please try again tomorrow; site information is still available.", daily: true },
  AI_DAILY_BUDGET: { zh: '今日 AI 名额已满，明天会恢复；站内资料仍可浏览。', en: "Today's AI capacity is used up and resets tomorrow. Site information is still available.", daily: true },
  AI_WEB_BUDGET: { zh: '今天 AI 用量较高，暂停联网查询；站内资料仍可使用。', en: 'Web lookups are paused for today because AI use is high. Site information is still available.', daily: false },
  AI_CONCURRENCY_LIMIT: { zh: 'BayBay 正忙，请稍后再试。', en: 'BayBay is busy. Please try again shortly.', daily: false },
  AI_QUOTA_UNAVAILABLE: { zh: 'AI 额度暂时无法确认，请稍后再试；站内资料仍可浏览。', en: 'AI capacity cannot be checked right now. Please try again shortly; site information is still available.', daily: false },
};

/** A pause notice (daily budget or paused) leads with 911 · 211; a reduced-budget notice has no call buttons. */
export const bayBayNoticeIsPause = (kind: BayBayNoticeKind): boolean => kind !== 'ai_budget_reduced';

/**
 * The turn whose pause / reduced notice shows in full: the newest answer carrying one of that kind. Earlier answers show
 * theirs compact (text only), and the panel's top banner steps aside once an answer carries one, so 911 · 211 appear once.
 */
export function bayBayFullNoticeTurns(turns: readonly { id: number; response?: { notice?: BayBayNotice } }[]): { pause?: number; reduced?: number } {
  const full: { pause?: number; reduced?: number } = {};
  for (const turn of turns) if (turn.response?.notice) full[bayBayNoticeIsPause(turn.response.notice.kind) ? 'pause' : 'reduced'] = turn.id;
  return full;
}

/** The 911 / 211 pair a paused BayBay shows first when the server sent none. */
export const BAYBAY_HELP_ACTIONS: readonly BayBayCallAction[] = [{ id: 'call-911', label: '911', href: 'tel:911' }, { id: 'call-211', label: '211', href: 'tel:211' }];

/** "10 月 10 日 0:00" / "Oct 10, 12:00 AM" in Bay Area time, for a resume time. */
export function bayBayResumeLabel(iso: string, english: boolean): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
  if (english) return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  return `${parts.month} 月 ${parts.day} 日 ${Number(parts.hour)}:${parts.minute}`;
}

/**
 * How a pause banner adds its resume time so it is said once: `none` when the server text already gives a clock time
 * or date, `time` when it already says BayBay comes back ("明天会恢复", "back tomorrow"), else the full `sentence`.
 */
export function bayBayResumeStyle(text: string): 'none' | 'time' | 'sentence' {
  if (/\d{1,2}:\d{2}|\d{1,2}\s*月\s*\d{1,2}\s*[日号號]|\b\d{1,2}\s*[ap]\.?m\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(text)) return 'none';
  return /恢复|恢復|\bback\b|\bresum/i.test(text) ? 'time' : 'sentence';
}

/**
 * The answer's cards in the order its points name them (`points[].cardIds`, so the card for point 1 comes first), then
 * any card no point names, in the server's order.
 */
export function bayBayOrderCards<T extends { kind: string; id: string }>(cards: readonly T[], points: readonly Pick<BayBayPoint, 'cardIds'>[]): T[] {
  const rank = new Map<string, number>();
  for (const point of points) for (const key of point.cardIds) if (!rank.has(key)) rank.set(key, rank.size);
  if (!rank.size) return [...cards];
  return cards.map((card, index) => ({ card, index, rank: rank.get(`${card.kind}:${card.id}`) ?? Infinity }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index).map(entry => entry.card);
}

/** Points shown before "更多": the answer layout keeps 2–3 points visible (1007 §6.5). */
export const BAYBAY_VISIBLE_POINTS = 3;
/** The visible-answer budget: ≤250 字 (zh) or ≤120 words (en), excluding citation markers. */
export const BAYBAY_ANSWER_BUDGET = { zh: 250, en: 120 } as const;

/** What a reader sees as answer text: citation markers `[n]` do not count. */
export const bayBayReadableText = (text: string) => text.replace(/\[\d{1,3}\]/g, '').replace(/[ \t]+/g, ' ').trim();
/** 字 for zh (letters and digits in a Latin run count as one unit per word), words for en. */
export function bayBayTextUnits(text: string, english: boolean): number {
  const readable = bayBayReadableText(text);
  if (english) return readable.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
  const han = (readable.match(/[㐀-鿿]/g) || []).length;
  const latinWords = (readable.replace(/[㐀-鿿]/g, ' ').match(/[\p{L}\p{N}]+(?:[.:'’-][\p{L}\p{N}]+)*/gu) || []).length;
  return han + latinWords;
}

/** A point as laid out; `continued` is the rest of a first point cut at a sentence end (no bullet of its own). */
export type BayBayViewPoint = BayBayPoint & { continued?: boolean };

const CITATION = /\[\d{1,3}\]/g;
/** "U.S.", "Mr.", "St.", "a.m.": a full stop that does not end the sentence. */
const ABBREVIATION = /^(?:(?:[A-Z]\.)+|(?:Mr|Mrs|Ms|Dr|St|Ave|Blvd|Rd|No|vs|etc)\.)$/i;
const BREAK = '\u0000';
/**
 * Sentences of a point: split after 。！？； (zh) or . ! ? and a space (en), with any closing quote or bracket; a [n]
 * right after the end stays with it. No look-behind: Safari before 16.4 cannot parse one.
 */
function bayBaySentences(text: string, english: boolean): string[] {
  const marked = english
    ? text.replace(/(\S*)([.!?]["”’')\]]*)\s+/g, (all: string, word: string, end: string) => ABBREVIATION.test(word + end) ? all : `${word}${end}${BREAK}`)
    : text.replace(/[。！？；][”’」』）)]*/g, `$&${BREAK}`);
  const out: string[] = [];
  for (const piece of marked.split(BREAK)) {
    const marks = /^(?:\s*\[\d{1,3}\])+/.exec(piece)?.[0] || '';
    if (marks && out.length) out[out.length - 1] += `${english ? ' ' : ''}${marks.trim()}`;
    const rest = (out.length && marks ? piece.slice(marks.length) : piece).trim();
    if (rest) out.push(rest);
  }
  return out;
}

/**
 * A first point too long for the budget: the sentences that fit stay visible (keeping its [n] if they had none) and
 * the rest continues behind "更多". Null when not even its first sentence fits; then the whole point shows.
 */
function bayBayCutPoint(point: BayBayPoint, room: number, english: boolean): [BayBayViewPoint, BayBayViewPoint] | null {
  const sentences = bayBaySentences(point.text, english);
  let count = 0, units = 0;
  while (count < sentences.length - 1 && units + bayBayTextUnits(sentences[count], english) <= room) units += bayBayTextUnits(sentences[count++], english);
  if (!count) return null;
  const join = (list: string[]) => list.join(english ? ' ' : '');
  const shown = join(sentences.slice(0, count)), rest = join(sentences.slice(count));
  const cites = shown.match(CITATION) ? [] : [...new Set(rest.match(CITATION) || [])];
  return [{ ...point, text: cites.length ? `${shown}${english ? ' ' : ''}${cites.join('')}` : shown }, { text: rest, cardIds: [], continued: true }];
}

/**
 * The answer as laid out: the lead, then up to BAYBAY_VISIBLE_POINTS points that fit the visible budget together
 * with the lead, then the rest behind "更多". The gap line is part of the rest. The first point always shows; when it
 * does not fit, it is cut at its last sentence end that does and continues behind "更多".
 */
export function bayBayAnswerView(fields: Pick<BayBayAnswerFields, 'lead' | 'points' | 'gap'>, english: boolean) {
  if (!fields.lead || !fields.points) return null;
  const budget = english ? BAYBAY_ANSWER_BUDGET.en : BAYBAY_ANSWER_BUDGET.zh;
  let used = bayBayTextUnits(fields.lead, english);
  const visible: BayBayViewPoint[] = [], more: BayBayViewPoint[] = [];
  for (const point of fields.points) {
    const units = bayBayTextUnits(point.text, english);
    if (!visible.length && used + units > budget) {
      const cut = bayBayCutPoint(point, budget - used, english);
      if (cut) { visible.push(cut[0]); more.push(cut[1]); used += bayBayTextUnits(cut[0].text, english); continue; }
    }
    if (!more.length && visible.length < BAYBAY_VISIBLE_POINTS && (!visible.length || used + units <= budget)) { visible.push(point); used += units; }
    else more.push(point);
  }
  return { lead: fields.lead, visible, more, gap: fields.gap, visibleUnits: used };
}
