import type { Locale } from '../i18n/locale';

/** A run of title text. `keep` runs are words or name groups that should not break across lines. */
export type TitlePiece = { text: string; keep: boolean };

const HAN = /\p{Script=Han}/u;
const HAN_ONLY = /^\p{Script=Han}+$/u;
const LATIN_PART = /^[\p{Script=Latin}\p{M}\p{N}'’.&+!-]+$/u;
/** Particles a Chinese line may end after (的) or break around (与, 和 …), even inside a run of single characters. */
const BREAK_AFTER = new Set(['的', '与', '與', '和', '及', '或', '对', '對']);
const BREAK_BEFORE = new Set(['与', '與', '和', '及', '或', '对', '對']);
/** Words that belong with the next one: a group does not end on them (South | San Francisco, Bark | in the Park). */
const BINDS_NEXT = /^(?:a|an|the|of|in|on|at|by|to|for|and|or|&|x|×|de|del|la|las|los|el|san|santa|st\.|mt\.|palo)$/i;
/**
 * Units must fit the phone H1 at extra-large Aa (37.5px; 34px for offers) in a 335px column (375px phone):
 * 8 Han characters are 300px, 14 Latin characters about 290px.
 */
const MAX_HAN = 8;
const MAX_LATIN = 14;

type Segmenter = typeof Intl.Segmenter;
let probed: Segmenter | undefined;
let probeResult = false;
/** Engines without the CJK word dictionary return one character per segment; their "words" would be guesses. */
function segmentsWords(Segmenter: Segmenter): boolean {
  if (probed !== Segmenter) {
    probed = Segmenter;
    try { probeResult = Array.from(new Segmenter('zh-Hans', { granularity: 'word' }).segment('万圣节')).length === 1; } catch { probeResult = false; }
  }
  return probeResult;
}

/**
 * Split a run of Han segments into units. Word segmentation knows common words (万圣节, 南瓜) but cuts most names and
 * compounds into single characters (市|集, 亲|子, 嘉|年华), so a break is only offered between two dictionary words or
 * at a particle; single characters stay with their neighbours (不|吓|人的 stays 不吓人的). A unit over MAX_HAN is split
 * nearest its middle, preferring a boundary between a word and a run of single characters, then any boundary.
 */
function hanUnits(segments: string[]): string[] {
  const single = (i: number) => segments[i]?.length === 1;
  // Boundary i sits before segments[i]. 2 always breaks; 1 and 0 break only to keep a unit within MAX_HAN.
  const rank = (i: number) => {
    if (BREAK_AFTER.has(segments[i - 1]) || BREAK_BEFORE.has(segments[i]) || !single(i - 1) && !single(i)) return 2;
    if (single(i - 1) && single(i)) return 0;
    // A word next to a run of two or more single characters (亲|子 · 游戏) rather than next to a lone one (演唱|会).
    return (single(i) ? single(i + 1) : single(i - 2)) ? 1 : 0;
  };
  const split = (from: number, to: number): string[] => {
    for (let i = from + 1; i < to; i++) if (rank(i) === 2) return [...split(from, i), ...split(i, to)];
    const text = segments.slice(from, to).join('');
    if (text.length <= MAX_HAN) return [text];
    for (const level of [1, 0]) {
      let best = 0, bestDistance = Infinity, offset = 0;
      for (let i = from + 1; i < to; i++) {
        offset += segments[i - 1].length;
        const distance = Math.abs(offset - text.length / 2);
        if (rank(i) === level && distance < bestDistance) { best = i; bestDistance = distance; }
      }
      if (best) return [...split(from, best), ...split(best, to)];
    }
    return [text];
  };
  return split(0, segments.length);
}

/**
 * Split a run of Latin words into name groups of at most MAX_LATIN characters: as few groups as possible, then none
 * ending on a word that binds to the next, then the most even (San Francisco | Fleet Week, South | San Francisco).
 * Solved from the end of the run with one best plan per start word, so a long English name costs linear time
 * instead of one pass per possible grouping.
 */
function latinGroups(words: string[]): string[][] {
  const better = (cost: number[], than: number[]) => { const index = cost.findIndex((value, i) => value !== than[i]); return index >= 0 && cost[index] < than[index]; };
  // plans[start] is the best grouping of words[start..]: where its first group ends, and its cost
  // [groups, groups ending on a binding word, longest group].
  const plans: { end: number; cost: number[] }[] = [];
  plans[words.length] = { end: words.length, cost: [0, 0, 0] };
  for (let start = words.length - 1; start >= 0; start--) {
    for (let end = start + 1; end <= words.length && (end === start + 1 || words.slice(start, end).join(' ').length <= MAX_LATIN); end++) {
      const rest = plans[end].cost;
      const cost = [rest[0] + 1, rest[1] + (end < words.length && BINDS_NEXT.test(words[end - 1]) ? 1 : 0), Math.max(rest[2], words.slice(start, end).join(' ').length)];
      if (!plans[start] || better(cost, plans[start].cost)) plans[start] = { end, cost };
    }
  }
  const groups: string[][] = [];
  for (let start = 0; start < words.length; start = plans[start].end) groups.push(words.slice(start, plans[start].end));
  return groups;
}

/**
 * Break-safe pieces of a displayed title (REPORT-1007 §4.1 item 9): Chinese words and short Latin names become `keep`
 * runs so text-wrap:balance cannot split 万圣节 or Fleet Week. Joined, the pieces are exactly `text`. Returns null — plain
 * text, today's behaviour — for English, for titles without Chinese and for engines without word segmentation.
 */
export function titleBreakPieces(text: string, locale: Locale): TitlePiece[] | null {
  if (locale === 'en' || !HAN.test(text)) return null;
  const Segmenter = typeof Intl === 'object' ? Intl.Segmenter : undefined;
  if (typeof Segmenter !== 'function' || !segmentsWords(Segmenter)) return null;
  // Word segmentation keeps "Center：Live" together (a colon can sit inside a word); titles use it as punctuation.
  const segments = Array.from(new Segmenter(locale, { granularity: 'word' }).segment(text), part => part.segment).flatMap(segment => segment.split(/([:：·])/u).filter(Boolean));
  const pieces: TitlePiece[] = [];
  const push = (piece: string, keep: boolean) => {
    const last = pieces.at(-1);
    if (!keep && last && !last.keep) last.text += piece;
    else pieces.push({ text: piece, keep });
  };
  for (let i = 0; i < segments.length;) {
    if (HAN_ONLY.test(segments[i])) {
      const run: string[] = [];
      while (i < segments.length && HAN_ONLY.test(segments[i])) run.push(segments[i++]);
      for (const unit of hanUnits(run)) push(unit, unit.length > 1 && unit.length <= MAX_HAN);
    } else if (LATIN_PART.test(segments[i])) {
      // Words are space-separated; hyphens, apostrophes and periods stay inside a word (Joseph’s, St.).
      const words = [''];
      while (i < segments.length && (LATIN_PART.test(segments[i]) || segments[i] === ' ' && LATIN_PART.test(segments[i + 1] ?? ''))) {
        if (segments[i] === ' ') words.push(''); else words[words.length - 1] += segments[i];
        i++;
      }
      latinGroups(words).forEach((group, index) => { if (index) push(' ', false); push(group.join(' '), group.length > 1); });
    } else push(segments[i++], false);
  }
  return pieces;
}
