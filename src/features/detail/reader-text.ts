import { translateText, type Locale } from '../../i18n/locale';

/**
 * Reader text on event, offer and opening details (CNT-1011-05, CNT-1011-06). Catalog prose sometimes still carries the
 * editor's working notes ("本包只录入…", "核对时尚未到开业日，保留预告状态", "web open 曾返回旧缓存", raw source URLs) and
 * templated lines that repeat the date or price. Readers get the answer only: a note sentence is dropped at render time,
 * in every language, and tests/detail-reader-text.test.ts keeps new data from adding more (a ratchet on the raw data).
 *
 * The dictionaries translate whole catalog strings, so text is translated first and filtered afterwards, per language
 * (RC-11 i): 简体 filters the source, 繁體 converts the filtered source, English filters the reviewed translation.
 * No regex look-behind (Safari < 16.4 cannot parse one; W9-E guard).
 */

/** A clause that talks about the editing process ("本条只收录", "核对时…", "不沿用旧年描述"), not about the event. */
export const EDITOR_NOTE_ZH = /本包|本轮|录入|web ?open|缓存|HTTP(?!S?:\/\/)|抓取|读取|交叉确认|不沿用|不再声明|本条(?:不|只|仅)|不计入已确认|本次核实|核对时(?!间)|待复核|保留预告状态|旧链接|(?:^|[^\d-])403(?:[^\d-]|$)/i;
/** The same notes in the reviewed English translations (whole sentences are dropped there). */
export const EDITOR_NOTE_EN = /\bweb[- ]?open\b|\bcached\b|\bcache\b|\bretriev|cross-?check|corroborat|\bHTTP\b|needs? to be re-?checked|\brecheck|not counted among|this (?:collection|batch|package|entry|listing) (?:includes|only|uses only|covers only|does not treat|does not present|is not treated)|at the time of (?:checking|verification|review)|as of this review|when checked|no claim is made|\bdo not (?:borrow|reuse|carry over)\b|old links|(?:^|[^\d-])403(?:[^\d-]|$)/i;

/** A URL inside a sentence, with its "：" label separator; it becomes a placeholder before the text is split. */
const URL = /\s*[：:]?\s*https?:\/\/[^\s，。；、）)」"';,]+\s*/gi;
const URL_MARK = '\uE000';
/** What is left of "出行说明：https://…。" once the URL goes: a bare label is not worth a line. */
const BARE_LABEL_ZH = /^[\p{Script=Han}A-Za-z ]{1,8}[。；;.]?$/u;
const BARE_LABEL_EN = /^[A-Za-z ]{1,24}[.;:]?$/;

/** Sentences with their closing punctuation (and the space after it) kept, so joining them gives the text back. */
function sentences(text: string, english: boolean): string[] {
  const boundary = english ? /[.;!?]+["”’)]?(?:\s+|$)/g : /[。；！？;!?]+[”’」）)]?\s*/g;
  const parts: string[] = [];
  let at = 0;
  for (const match of text.matchAll(boundary)) {
    const end = match.index! + match[0].length;
    // "St. Helena", "a.m.", "10.5": a full stop inside a name or a number does not end an English sentence.
    if (english && match[0].startsWith('.') && /(?:\b[A-Z][a-z]?|\b[ap]\.m|\d)$/.test(text.slice(at, match.index!))) continue;
    parts.push(text.slice(at, end));
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts.filter(part => part.trim());
}

/** A Chinese sentence without its note clauses (split at "，"): "选一天10:00–14:00参加，不沿用普通周末闭馆时刻。" keeps the time. */
function withoutNoteClauses(sentence: string): string {
  const end = /[。；！？;!?]+[”’」）)]?\s*$/.exec(sentence)?.[0] ?? '';
  const clauses = sentence.slice(0, sentence.length - end.length).split('，');
  const kept = clauses.filter(clause => !EDITOR_NOTE_ZH.test(clause));
  if (!kept.length) return '';
  return kept.length === clauses.length ? sentence : `${kept.join('，')}${end.trim() || '。'}`;
}

/** Drop editor notes and raw URLs from one already-localized string. '' when nothing for the reader is left. */
export function withoutEditorNotes(text: string, english: boolean): string {
  const bare = english ? BARE_LABEL_EN : BARE_LABEL_ZH;
  // URLs first: their "?" and "!" are not sentence ends.
  const marked = text.replace(URL, URL_MARK);
  let changed = marked !== text;
  let dropped = false;
  const kept = sentences(marked, english).flatMap(sentence => {
    const reader = english ? (EDITOR_NOTE_EN.test(sentence) ? '' : sentence) : withoutNoteClauses(sentence);
    if (reader !== sentence) changed = true;
    let out = reader;
    if (reader.includes(URL_MARK)) {
      const stripped = reader.split(URL_MARK).join(english ? ' ' : '').replace(/\s+([。；，.;,])/g, '$1').trim();
      out = !stripped || bare.test(stripped) ? '' : english ? `${stripped} ` : stripped;
    }
    if (!out.trim()) { dropped = true; return []; }
    // An English sentence that followed a dropped one ("…; this is not …") starts with a capital again.
    if (english && dropped && /^[a-z]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
    dropped = false;
    return [out];
  });
  if (!changed) return text.trim();
  const joined = kept.join('').replace(/\s{2,}/g, ' ').trim();
  if (!joined) return '';
  // The last kept sentence may end on "；" or have lost its full stop with the URL.
  if (english) return joined.replace(/[;,:]$/, '.').replace(/([A-Za-z0-9)])$/, '$1.');
  return joined.replace(/[；;，,：:]$/, '。').replace(/([\p{Script=Han}A-Za-z0-9)）])$/u, '$1。');
}

/** Catalog prose in the reader's language, without editor notes (see the module note for the order of operations). */
export function readerProse(text: string | undefined, locale: Locale): string {
  if (!text?.trim()) return '';
  if (locale === 'en') return withoutEditorNotes(translateText(text, 'en'), true);
  const filtered = withoutEditorNotes(text, false);
  return filtered && locale === 'zh-Hant' ? translateText(filtered, 'zh-Hant') : filtered;
}

/** True when a catalog string would show the reader an editor note (the data lint counts these). */
export const hasEditorNote = (text: string) => sentences(text, false).some(sentence => EDITOR_NOTE_ZH.test(sentence)) || /https?:\/\//i.test(text);

// Templated lines (CNT-1011-06) --------------------------------------------------------------------------------------

/** The generic closing line of ~140 imported events. On a free event there are no tickets to check. */
export const TICKETS_BOILERPLATE = '出发前查看主办方最新公告，按场次确认余票、入场要求及交通安排。';
const normalized = (text: string) => text.replace(/[\s。；;，,.]/g, '');

type PlanSource = { plan: readonly string[]; tips?: readonly string[]; dateLabel: string; costLabel: string; cost: string };

/**
 * The event's "出发前" lines (source strings): the editorial overlay's `tips` when present, else `plan`, without the lines
 * that only repeat the date ("时间安排：…") or the price ("费用与参加条件：…") shown above, and, on a free event, without
 * any line about remaining tickets (余票) or a final ticket price. Lines are dropped whole, so every language agrees.
 */
export function readerPlanLines(event: PlanSource): string[] {
  const lines = event.tips?.length ? event.tips : event.plan;
  const free = event.cost === 'free';
  return lines.filter(line => {
    const time = /^时间安排[：:]/.exec(line);
    if (time && normalized(event.dateLabel).includes(normalized(line.slice(time[0].length)))) return false;
    const cost = /^费用与参加条件[：:]/.exec(line);
    if (cost && normalized(line.slice(cost[0].length)) === normalized(event.costLabel)) return false;
    if (free && (line === TICKETS_BOILERPLATE || /余票|最终价格以票页为准/.test(line))) return false;
    return true;
  });
}

/**
 * The price line in the reader's language. On a free event the hedges written for ticketed events go: the "参考：" prefix
 * and "最终价格以票页为准" (English: "Reference:" and "Check the ticket page for final prices.").
 */
export function readerCost(costLabel: string, cost: string, locale: Locale): string {
  const free = cost === 'free';
  if (locale === 'en') {
    const text = readerProse(costLabel, 'en');
    return free ? text.replace(/^Reference:\s*/i, '').replace(/\s*(?:Check the ticket page for final prices|Final prices are on the ticket page)\.?\s*$/i, '').replace(/[;,]\s*$/, '').trim() : text;
  }
  const source = withoutEditorNotes(costLabel, false);
  const text = free ? source.replace(/^参考[：:]\s*/, '').replace(/[；;，,]?\s*最终价格以票页为准\s*$/, '').trim() : source;
  return text && locale === 'zh-Hant' ? translateText(text, 'zh-Hant') : text;
}

const SEMICOLON_MARK = '\uE001';
/** Catalog prose in the reader's language, one sentence per item (offer conditions and steps read as lists). */
export function readerSentences(text: string | undefined, locale: Locale): string[] {
  const prose = readerProse(text, locale);
  if (!prose) return [];
  // English list items end at a full stop only: "…onto Senior Clipper; it is not automatically free…" stays one item.
  if (locale === 'en') return sentences(prose.split(';').join(SEMICOLON_MARK), true).map(sentence => sentence.split(SEMICOLON_MARK).join(';').trim()).filter(Boolean);
  // Each list item reads as a whole sentence: one cut at "；" ends with "。" ("新卡约四周；" → "新卡约四周。").
  return sentences(prose, false).map(sentence => sentence.trim().replace(/[；;]$/, '。')).filter(Boolean);
}
