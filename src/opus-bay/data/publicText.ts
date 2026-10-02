import { translateText, type Locale } from '../../i18n/locale';

/**
 * Wave 9 · lane R (W9-R5) · the catalog's words as a player should read them (review R§6 现实出行价值: an editor's
 * working note reached the event card — 「售票详情页本次触发等待页，未核实余票」, in English "The ticket details page
 * displayed a waiting screen during this check" — and two sentences were joined by a bare space, 「餐饮另付 具体预约…」).
 * The catalog is BAYLINK's (the site's editors fix the source: a Request in docs/opus-bay/sf-w9-R.md); the game shows
 * it through this filter:
 *
 *   publicText(s, locale)  zh: drops a clause (or a ，part of one) that only describes the editors' own checking
 *                          (触发 / 等待页 / 被阻 / 核实日之后 / 未代预约 / 不补造), takes 「本次」 out of the honest ones
 *                          (「具体结束时间本次未复核」 → 「具体结束时间未复核」; 「票价尚未核实，以官方购票页为准」 stays as it
 *                          is), says 节目页时长 as 时长, and puts a ； where two Chinese sentences were joined by a space.
 *                          en: the site's own translation of the ORIGINAL (its dictionary is keyed by the catalog's
 *                          exact text: a filtered zh string would not translate), then the same in English ("during
 *                          this check" goes, a "waiting screen" / "blocked" / "verification date" sentence goes).
 *                          zh-Hant: the zh result (the site runtime converts it character by character).
 *   INTERNAL_RE / INTERNAL_EN_RE   the working-note words, for the tests and for scripts/opus-sf/export-live.ts, which
 *                          refuses an offer that carries one.
 *
 * No lookbehind (Safari < 16.4: tests/opus-bay-w9-e-* guard every regex in src/).
 */

export const INTERNAL_RE = /本次|触发|等待页|被阻|核实日之后|未代预约|不补造|编辑备注|内部备注|待编辑|TODO/;
export const INTERNAL_EN_RE = /waiting screen|this (?:review|check)\b|was blocked|verification date|on your behalf|has been invented|editor'?s note|TODO/i;

const DROP_ZH = /触发|等待页|被阻|核实日之后|未代预约|不补造/;
const DROP_EN = /waiting screen|was blocked|verification date|on your behalf|has been invented/i;

const HAN = '\\u3400-\\u9fff';
/** a Chinese character / closing mark, spaces, a Chinese character / opening mark: two sentences joined by a space */
const JOINED_RE = new RegExp(`([${HAN}）」』】])\\s+([${HAN}（「『【])`, 'g');
/** a zh clause: up to and including its ；/。 (or the rest) */
const CLAUSE_ZH = /[^；。]+[；。]?/g;

function publicZh(s: string): string {
  const t = s
    .replace(/节目页时长/g, '时长')
    .replace(/本条只收录/g, '这里只列')
    .replace(/本记录收录/g, '这里列出')
    .replace(/未在本次/g, '未')
    .replace(/在本次/g, '')
    .replace(/本次/g, '')
    .replace(JOINED_RE, '$1；$2')
    // 「未取得。 所有观众…」: no space after a Chinese full stop
    .replace(/([。；！？，、])\s+(?=[㐀-鿿（「『【])/g, '$1');
  const clauses = t.match(CLAUSE_ZH) ?? [t];
  const kept = clauses
    .map(c => {
      if (!DROP_ZH.test(c)) return c;
      // a working note inside a clause: keep its other ，parts (「只确认系列公告中的日期、场地与免费，不补造具体时刻。」)
      const end = /[；。]$/.test(c) ? c.slice(-1) : '';
      const parts = (end ? c.slice(0, -1) : c).split('，').filter(p => !DROP_ZH.test(p));
      return parts.length ? parts.join('，') + end : '';
    })
    .join('')
    .trim();
  // a clause dropped at the end leaves a dangling ；
  return kept.replace(/[；，、]\s*$/, '。').replace(/^[；，。\s]+/, '');
}

function publicEn(s: string): string {
  const t = s
    .replace(/The program page lists a running time of approximately/g, 'Running time: about')
    .replace(/\s+(?:in|during) this (?:review|check)\b/gi, '')
    .replace(/\s+this time\b/g, '')
    // the dictionary's reading of 「票价与余票请以官方售票页为准」 sounds like a working note
    .replace(/Prices and availability have not been retrieved\./g, 'Check the official ticket page for prices and availability.');
  // clauses end at a . or ; before a space or the end (never the one in $22.95)
  const bits = t.split(/([.;])(?=\s|$)/);
  const clauses: string[] = [];
  for (let i = 0; i < bits.length; i += 2) {
    const c = `${bits[i]}${bits[i + 1] ?? ''}`.trim();
    if (c && !DROP_EN.test(c)) clauses.push(c);
  }
  return clauses.join(' ').replace(/[;,]$/, '.');
}

export function publicText(s: string | null | undefined, locale: Locale = 'zh-Hans'): string {
  if (!s) return '';
  if (locale === 'en') {
    const en = translateText(s, 'en');
    // not in the dictionary (still Chinese): the zh filter; the site runtime translates what it can
    return /[㐀-鿿]/.test(en) ? publicZh(s) : publicEn(en);
  }
  return publicZh(s);
}

/** A catalog event's plan lines as shown (a line left with only its heading goes). */
export const publicLines = (lines: readonly string[] | undefined, locale: Locale = 'zh-Hans'): string[] =>
  (lines ?? []).map(line => publicText(line, locale)).filter(line => line.replace(/^[^：:]*[：:]/, '').trim().length > 0);
