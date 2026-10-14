import type { Guide, GuideBlock } from '../../data/guides';
import { guideTopicOf } from '../../data/guide-topics';
import { findPhoneNumbers } from '../../lib/phone-numbers';
import { translateText, type Locale } from '../../i18n/locale';

/**
 * H08 (GR-03): "30 秒看懂" for a guide without an editorial record — built only from sentences the article already prints,
 * never paraphrased: the first fact the article attributes to an official source (or the first sentence with a figure), the
 * first phone number (tap-to-call where the card renders it), and the first deadline or fee. Each row quotes its sentence
 * (a long one is cut at a clause boundary with …); a guide with none of the three gets no card. Seasonal outings,
 * directories and deals boards are left out: their first screen is a route, a directory or a board.
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

/** Sentences of a block in reading order: paragraphs and tips split after 。！？ and line breaks; each list item on its own. */
function sentencesOf(block: GuideBlock): string[] {
  const split = (text: string) => splitAfter(text, '。！？!?\n').map(part => part.trim()).filter(part => part.length >= 6);
  if (block.type === 'paragraph' || block.type === 'tip') return split(block.text);
  if (block.type === 'list') return block.items.flatMap(split);
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
/** The longest number in the matched words (\"9 月 22 日\" → 22, \"$46\" → 46): it must reappear in a translation. */
const anchorOf = (sentence: string, pattern: RegExp) => {
  const numbers = pattern.exec(sentence)?.[0].match(/\d[\d,.]*\d|\d/gu) ?? [];
  return numbers.sort((a, b) => b.length - a.length)[0]?.replace(/[,.]$/u, '');
};

/** Up to three rows from the article's own sentences; [] when it has none of them. */
export function guideQuickFacts(guide: Pick<Guide, 'blocks'>): QuickFact[] {
  const sentences = guide.blocks.flatMap((block, index) => sentencesOf(block).map(text => ({ text, block: index })));
  const used = new Set<string>();
  const take = (kind: QuickFactKind, match: (text: string) => boolean, anchor: (text: string) => string | undefined): QuickFact | null => {
    const found = sentences.find(sentence => !used.has(sentence.text) && match(sentence.text) && shortenSentence(sentence.text));
    if (!found) return null;
    used.add(found.text);
    const text = shortenSentence(found.text);
    const key = anchor(found.text);
    return { kind, text, block: found.block, ...(key && key.length >= 2 && text.includes(key) ? { anchor: key } : {}) };
  };
  const phone = take('phone', text => findPhoneNumbers(text).length > 0, text => findPhoneNumbers(text)[0]?.text);
  const deadline = take('deadline', text => DEADLINE.test(text) && !EDITORIAL.test(text), text => anchorOf(text, DEADLINE));
  const fee = deadline ? null : take('fee', text => FEE.test(text) && !EDITORIAL.test(text), text => anchorOf(text, FEE));
  const fact = take('fact', text => SOURCED.test(text) && !EDITORIAL.test(text), text => anchorOf(text, FIGURE))
    ?? take('fact', text => FIGURE.test(text) && NAMED.test(text) && !EDITORIAL.test(text), text => anchorOf(text, FIGURE));
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
 * never shows Chinese and never a sentence that does not match.
 */
export function quickFactIn(fact: QuickFact, guide: Pick<Guide, 'blocks'>, locale: Locale): string | null {
  if (locale === 'zh-Hans') return fact.text;
  if (locale === 'zh-Hant') return translateText(fact.text, locale);
  const block = guide.blocks[fact.block];
  const quoted = fact.text.replace(/…$/u, '');
  const source = block.type === 'list' ? block.items.find(item => item.includes(quoted)) ?? '' : 'text' in block ? block.text : '';
  const translated = source ? translateText(source, 'en') : '';
  if (!translated || /[㐀-鿿]/u.test(translated)) return null;
  if (block.type === 'list' && source.trim() === fact.text) return shortenSentence(translated, 200);
  if (!fact.anchor) return null;
  const piece = englishSentences(translated).find(part => hasNumber(part, fact.anchor!));
  return piece ? shortenSentence(piece, 200) : null;
}
