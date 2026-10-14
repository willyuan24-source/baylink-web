import type { Guide, GuideBlock } from '../../data/guides';
import { guideTopicOf } from '../../data/guide-topics';
import { findPhoneNumbers } from '../../lib/phone-numbers';
import { translateText, type Locale } from '../../i18n/locale';

/**
 * H08 (GR-03): "30 秒看懂" for a guide without an editorial record — built only from sentences the article already prints,
 * never paraphrased: the first fact the article attributes to an official source (else the first sentence with a figure, else
 * one naming a body the guide cites), the first phone number (tap-to-call where the card renders it), and the first deadline
 * or fee. Each row quotes its sentence (a long one is cut at a clause boundary with …); a guide with none of the three gets
 * no card. Seasonal outings, directories and deals boards are left out: their first screen is a route, a directory or a board.
 * A row reads right on its own (review 10-14): the sentence opens its paragraph or list item, or names its own body or place;
 * a later sentence carries the label or body its text opens with ("SMUHSD：…") and is not used without one. Sentences that
 * point back ("另一个入口", "这次…"), editor's notes, things that 已经结束 and sections headed by a date already past are skipped.
 */
export type QuickFactKind = 'fact' | 'phone' | 'deadline' | 'fee';
export type QuickFact = {
  kind: QuickFactKind;
  /** The article's sentence (zh-Hans, as published), shortened at a clause boundary when long. */
  text: string;
  /** Index of the block it came from, so a translation can be looked up for the whole block (RC-11 i). */
  block: number;
  /** Characters that must appear in the translated sentence too (the number, the amount or the date). */
  anchor?: string;
  /** Who or where the sentence is about when it does not say so itself: the label or body its text opens with. */
  context?: string;
};

const DIRECTORY_BLOCKS: ReadonlySet<GuideBlock['type']> = new Set(['utility-directory', 'contact-directory', 'useful-platforms', 'city-exploration', 'shopping-directory', 'freebies', 'route']);

/** Whether a guide gets the fallback card: no editorial record, not an outing, not a directory or a deals board. */
export function quickFactsEligible(guide: Pick<Guide, 'slug' | 'category' | 'blocks'>, hasEditorial: boolean): boolean {
  if (hasEditorial || guideTopicOf(guide) === 'outings') return false;
  return !guide.blocks.some(block => DIRECTORY_BLOCKS.has(block.type));
}

const MAX = 96;
/** The text cut after each mark, the mark kept at the end of its piece (no regex look-behind: Safari < 16.4, W9-E). */
function splitAfter(text: string, marks: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) if (marks.includes(text[i])) { parts.push(text.slice(start, i + 1)); start = i + 1; }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}
/** The sentence as printed, or its leading clauses up to MAX characters with … (never a cut inside a clause). */
export function shortenSentence(sentence: string, max = MAX): string {
  const text = sentence.trim();
  if (Array.from(text).length <= max) return text;
  const clauses = splitAfter(text, '，；：,;');
  let out = '';
  for (const clause of clauses) {
    if (Array.from(out + clause).length > max) break;
    out += clause;
  }
  return out ? `${out.replace(/[，；：,;]$/u, '')}…` : '';
}

/** The texts of a block in reading order (a paragraph or tip, or each list item), each split after 。！？ and line breaks. */
function textsOf(block: GuideBlock): string[][] {
  const split = (text: string) => splitAfter(text, '。！？!?\n').map(part => part.trim()).filter(part => part.length >= 6);
  if (block.type === 'paragraph' || block.type === 'tip') return [split(block.text)];
  if (block.type === 'list') return block.items.map(split);
  return [];
}

// A fact the article attributes to an official page: "DMV 写明：…", "加州车辆法 12505(c) 规定：…".
const SOURCED = /(?:写明|规定|列出|公布|显示)[：:]|(?:页面|官网|公告|说明)(?:写明|列出|显示|要求)/u;
// Otherwise a figure next to a named body ("BART 9 月 22 日…", "SJPL：最低预约年龄为 14 岁"), never an editor's example.
const FIGURE = /\$\s?\d[\d,.]*|\d+(?:[.,]\d+)?\s*(?:%|个|岁|天|年|月|小时|分钟|道|题|次|英尺|美元)|\d{3,}/u;
const NAMED = /[A-Z][A-Za-z&]+|政府|法院|[^\s]{1,6}(?:局|署|部门|办公室|图书馆)/u;
const EDITORIAL = /编辑|示例|例如|比如|假设|演算|估算|经验/u;
// A deadline or a date with a number in it; a fee as an amount, or a service the article says is free.
const DEADLINE = /\d+\s*(?:个)?(?:天|日|周|个月|年)(?:之?内|以内|之?前)|截止(?:日期?)?(?:为|是)?\s*\d|(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*日|\b(?:1[0-2]|0?[1-9])\/(?:3[01]|[12]\d|0?[1-9])\b(?!\s*小时)/u;
const FEE = /\$\s?\d[\d,.]*|免费(?:提供|咨询|参加|入场|服务|办理|报税|申请|使用|借|开放)|(?:咨询|服务|入场|参加|报名|办理|借阅|使用)(?:都|均|一律)?免费/u;
// The bodies a guide cites, from its source titles ("Recology SF · Bulky Item Collection" → Recology, "PG&E · Outages" → PG&E,
// "加州法院：租房押金指南" → 加州法院): acronyms of three letters or more, CamelCase names and other capitalised words that are not
// places or generic words. A sentence that names one of them states what that body's page says (the guide's own source).
const NOT_A_BODY = new Set(['San', 'Santa', 'Francisco', 'Mateo', 'Clara', 'Jose', 'José', 'County', 'City', 'Bay', 'Area', 'California', 'Oakland',
  'Berkeley', 'Alameda', 'Marin', 'Sonoma', 'Napa', 'Solano', 'Contra', 'Costa', 'Palo', 'Alto', 'Novato', 'Health', 'Public', 'Library', 'District',
  'Sanitary', 'Household', 'Hazardous', 'Waste', 'Facility', 'Sheriff', 'Silicon', 'Valley', 'Power', 'Utilities', 'Current', 'Quality', 'Spare', 'Build',
  'Outages', 'Safety', 'Alerts', 'Your', 'Card', 'Collection', 'Bulky', 'Item', 'Recycling', 'Disposal', 'College', 'Department', 'Office', 'Center',
  'Services', 'Service', 'Official', 'Guide', 'Help', 'Home', 'BAYLINK', 'USA', 'Google']);
const PLACE = new Set(['San', 'Santa', 'Francisco', 'Mateo', 'Clara', 'Jose', 'José', 'Bay', 'Area', 'California', 'Oakland', 'Berkeley', 'Alameda',
  'Marin', 'Sonoma', 'Napa', 'Solano', 'Contra', 'Costa', 'Palo', 'Alto', 'Novato', 'Silicon', 'Valley']);
export function sourceBodies(sources: readonly { title: string }[]): string[] {
  const found = new Set<string>();
  for (const { title } of sources) {
    const org = title.split(/[：:·|]| - /u)[0].trim();
    if (/^[㐀-鿿]{2,8}$/u.test(org)) found.add(org);
    // A name of several words counts as a whole ("Oakland Public Library"), even when each word alone is a place or generic.
    if (/^[A-Z][A-Za-z&.]*(?: [A-Z][A-Za-z&.]*){1,4}$/u.test(org) && org.split(' ').some(word => !PLACE.has(word))) found.add(org);
    for (const word of org.match(/[A-Za-z][A-Za-z&.]*[A-Za-z]/gu) ?? []) {
      if (NOT_A_BODY.has(word)) continue;
      if (/^[A-Z&]{3,}$/u.test(word) || /^[A-Z][a-z]+[A-Z]/u.test(word) || (word.length >= 5 && /^[A-Z]/u.test(word))) found.add(word);
    }
  }
  return [...found];
}
const ADVICE = /^(?:[^：:]{1,24}[：:]\s*)?(?:如果|假如|若|想|要是|不要|别|先别|不能|不必|建议|记得)/u;
const namesBody = (text: string, body: string) => {
  for (let at = text.indexOf(body); at >= 0; at = text.indexOf(body, at + 1)) {
    if (!/[A-Za-z]/u.test(text[at - 1] || '') && !/[A-Za-z]/u.test(text[at + body.length] || '')) return true;
  }
  return false;
};
/** The longest number in the matched words (\"9 月 22 日\" → 22, \"$46\" → 46): it must reappear in a translation. */
const anchorOf = (sentence: string, pattern: RegExp) => {
  const numbers = pattern.exec(sentence)?.[0].match(/\d[\d,.]*\d|\d/gu) ?? [];
  return numbers.sort((a, b) => b.length - a.length)[0]?.replace(/[,.]$/u, '');
};

// A sentence that leans on the one before it ("211 是另一个入口", "这次公告…", "也可以…") is never quoted alone.
const POINTS_BACK = /另一(?:个|种|条|家|项|处|套)|上述|前述/u;
const LEADS_BACK = /^(?:也|还|另|并且|而且|同时|此外|但|不过|因此|所以|这|那|该|此|它|其(?!他|它|余))/u;
const ENDED = /已(?:经)?(?:结束|过期)/u;
const EDITOR_NOTE = /^编辑(?:建议|提示|算例|说明)?[：:]/u;
// Bay Area places: a sentence naming one says where it applies; a label made only of them ("San José：", "半岛 Peninsula：")
// marks an instruction for that one place.
const PLACE_IN_TEXT = /旧金山|奥克兰|圣何塞|伯克利|弗里蒙特|圣马特奥|圣克拉拉|阿拉米达|马林|索诺玛|纳帕|索拉诺|东湾|南湾|北湾|半岛/u;
const PLACE_ONLY = new RegExp(`^(?:${PLACE_IN_TEXT.source})$`, 'u');
const PLACE_WORD = new Set([...PLACE, 'County', 'Cupertino', 'Sunnyvale', 'Fremont', 'Mt.', 'Diablo', 'Ramon', 'Hayward', 'Richmond', 'Milpitas', 'Peninsula', 'East', 'South', 'North']);
const CITY_WORD = /\b(?:San Francisco|San Jos[eé]|San Mateo|Santa Clara|Oakland|Berkeley|Alameda|Marin|Sonoma|Napa|Solano|Contra Costa|Palo Alto|Cupertino|Sunnyvale|Fremont)\b/u;
const labelOf = (text: string) => /^([^：:，。]{1,16})[：:]/u.exec(text)?.[1].trim();
const placeLabel = (label: string | undefined) => !!label && label.split(/\s+/u).every(word => PLACE_ONLY.test(word) || PLACE_WORD.has(word));
/** A date in a section heading ("10 月 4 日黄线", "10/4") that is 1 to 183 days before today: that section is over. */
function pastHeading(heading: string, today: string): boolean {
  const match = /(\d{1,2})\s*月\s*(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s*日/u.exec(heading) ?? /(?:^|\D)(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?:\s*[–-]\s*(\d{1,2}))?(?!\d)/u.exec(heading);
  if (!match) return false;
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.UTC(Number(today.slice(0, 4)), Number(match[1]) - 1, Number(match[3] ?? match[2]))) / 86_400_000;
  return days >= 1 && days <= 183;
}
type Candidate = { text: string; block: number; context?: string; placeLabel: boolean };

/** Up to three rows from the article's own sentences; [] when it has none of them. `today` (YYYY-MM-DD) drops past sections. */
export function guideQuickFacts(guide: Pick<Guide, 'blocks'> & { slug?: string; sources?: readonly { title: string }[] }, today?: string): QuickFact[] {
  const bodies = sourceBodies(guide.sources ?? []);
  // The body named first in the text (the longest name when two start at the same place: "Recology SF" before "Recology").
  const bodyIn = (text: string) => bodies.filter(body => namesBody(text, body))
    .sort((a, b) => text.indexOf(a) - text.indexOf(b) || b.length - a.length)[0];
  const candidates: Candidate[] = [];
  let heading = '';
  guide.blocks.forEach((block, index) => {
    if (block.type === 'heading') { heading = block.text; return; }
    if (today && pastHeading(heading, today)) return;
    for (const sentences of textsOf(block)) {
      if (!sentences.length || EDITOR_NOTE.test(sentences[0])) continue;
      const label = labelOf(sentences[0]);
      // What a later sentence is about: the label its text opens with when that names a place, a body or a 211-style line,
      // else the first body the opening sentence names.
      const context = label && (placeLabel(label) || bodyIn(label) || /^\d{3}$/u.test(label) || /^[A-Z][\w.&]*(?: [A-Z][\w.&]*)*$/u.test(label)) ? label : bodyIn(sentences[0]);
      sentences.forEach((text, at) => {
        const rest = text.replace(/^[^：:，。]{1,16}[：:]\s*/u, '');
        if (POINTS_BACK.test(text) || LEADS_BACK.test(rest) || ENDED.test(text)) return;
        const own = at === 0 || !!bodyIn(text) || PLACE_IN_TEXT.test(text) || CITY_WORD.test(text);
        if (own) candidates.push({ text, block: index, placeLabel: placeLabel(labelOf(text)) });
        else if (context) candidates.push({ text, block: index, context, placeLabel: placeLabel(context) });
      });
    }
  });
  // A Bay-wide guide leads with a fact for everyone: a sentence for one place ("San José：…") only when no other qualifies.
  const factOrder = /^bay-area-/u.test(guide.slug ?? '') ? [...candidates.filter(item => !item.placeLabel), ...candidates.filter(item => item.placeLabel)] : candidates;
  // The lede (the text before the first heading) sets the scene; a body's own rule is looked for after it, and not in a
  // sentence that opens with a condition or a piece of advice ("如果…", "想…", "不要…", also after a "San José：" label).
  const firstHeading = guide.blocks.findIndex(block => block.type === 'heading');
  const used = new Set<string>();
  const take = (kind: QuickFactKind, match: (text: string, block: number) => boolean, anchor: (text: string) => string | undefined, from = candidates): QuickFact | null => {
    const found = from.find(item => !used.has(item.text) && match(item.text, item.block) && shortenSentence(item.text));
    if (!found) return null;
    used.add(found.text);
    const text = shortenSentence(found.text);
    const key = anchor(found.text);
    return { kind, text, block: found.block, ...(key && key.length >= 2 && text.includes(key) ? { anchor: key } : {}), ...(found.context ? { context: found.context } : {}) };
  };
  const phone = take('phone', text => findPhoneNumbers(text).length > 0, text => findPhoneNumbers(text)[0]?.text);
  const deadline = take('deadline', text => DEADLINE.test(text) && !EDITORIAL.test(text), text => anchorOf(text, DEADLINE));
  const fee = deadline ? null : take('fee', text => FEE.test(text) && !EDITORIAL.test(text), text => anchorOf(text, FEE));
  const fact = take('fact', text => SOURCED.test(text) && !EDITORIAL.test(text), text => anchorOf(text, FIGURE), factOrder)
    ?? take('fact', text => FIGURE.test(text) && NAMED.test(text) && !EDITORIAL.test(text), text => anchorOf(text, FIGURE), factOrder)
    // Otherwise the first sentence after the lede that names a body the guide cites ("旧金山：Recology 大件项目按…核资格").
    ?? take('fact', (text, block) => block > firstHeading && !!bodyIn(text) && !EDITORIAL.test(text) && !ADVICE.test(text) && !/[？?]$/u.test(text), bodyIn, factOrder);
  return [fact, phone, deadline ?? fee].filter((row): row is QuickFact => !!row);
}

// English abbreviations a sentence does not end at ("Mt. Diablo", "Sept. 22", "6 p.m. that Sunday").
const ABBREVIATION = /(?:^|[\s(])(?:Mt|St|Ave|Blvd|Rd|Dr|No|Jr|Sr|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|vs|etc|a\.m|p\.m|e\.g|i\.e|U\.S)$/u;
/** English sentences: cut after . ! ? ; when a space and a capital letter, a digit or a quote follow, but not after an abbreviation. */
export function englishSentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length - 2; i++) {
    if (!'.!?;'.includes(text[i]) || text[i + 1] !== ' ' || !/[A-Z0-9"“'‘(]/u.test(text[i + 2])) continue;
    if (text[i] === '.' && ABBREVIATION.test(text.slice(start, i))) continue;
    parts.push(text.slice(start, i + 1).trim()); start = i + 2;
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}
const CJK = /[㐀-鿿]/u;
const hasNumber = (text: string, number: string) => {
  for (let at = text.indexOf(number); at >= 0; at = text.indexOf(number, at + 1)) {
    if (!/\d/u.test(text[at - 1] || '') && !/\d/u.test(text[at + number.length] || '')) return true;
  }
  return false;
};

/**
 * A row in the reader's language. zh-Hant converts the sentence; English looks up the whole block or list item (the dictionary
 * keys whole strings, RC-11 i): a row that is a whole list item shows the whole translated item, a sentence of a longer text
 * shows the translated sentence that carries the same number. null when there is no translation or no such sentence, so /en
 * never shows Chinese and never a sentence that does not match. A row's `context` label goes with it: a Latin name
 * as it is, a Chinese one as the label the English text opens with ("San Francisco: …"), and no English row without one.
 */
export function quickFactIn(fact: QuickFact, guide: Pick<Guide, 'blocks'>, locale: Locale): { label?: string; text: string } | null {
  if (locale === 'zh-Hans') return { label: fact.context, text: fact.text };
  if (locale === 'zh-Hant') return { label: fact.context && translateText(fact.context, locale), text: translateText(fact.text, locale) };
  const block = guide.blocks[fact.block];
  const quoted = fact.text.replace(/…$/u, '');
  const source = block.type === 'list' ? block.items.find(item => item.includes(quoted)) ?? '' : 'text' in block ? block.text : '';
  const translated = source ? translateText(source, 'en') : '';
  if (!translated || /[㐀-鿿]/u.test(translated)) return null;
  const label = fact.context && CJK.test(fact.context) ? /^([^:]{1,32}):\s/u.exec(translated)?.[1] : fact.context;
  if (fact.context && !label) return null;
  if (block.type === 'list' && source.trim() === fact.text) return { label, text: shortenSentence(translated, 200) };
  if (!fact.anchor) return null;
  const anchor = fact.anchor;
  const carries = (part: string) => /\d/u.test(anchor) ? hasNumber(part, anchor) : namesBody(part, anchor);
  const english = englishSentences(translated);
  // When the English text has as many sentences and clauses as the Chinese, the row is the same run of them, so a sentence
  // the translation split in two keeps its head ("The Golden Gate Bridge …. Use FasTrak's bridge directory for other crossings.").
  const pieces = (text: string) => splitAfter(text, '。！？；!?;').filter(part => part.trim());
  const from = pieces(source.slice(0, source.indexOf(quoted))).length;
  const run = english.slice(from, from + pieces(quoted).length).join(' ');
  if (!fact.text.endsWith('…') && pieces(source).length === english.length && carries(run)) return { label, text: shortenSentence(run, 200) };
  const piece = english.find(carries);
  // A clause cut at a semicolon reads as its own sentence.
  return piece ? { label, text: shortenSentence(piece.replace(/;$/u, '.'), 200) } : null;
}
