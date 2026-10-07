import { translateText } from '../../i18n/locale';
import type { PostTranslationText } from './postTranslationStore';

// Keep identifying strings and quoted prices byte-for-byte, including Chinese
// URL paths and written-out amounts. The complete budget field stays original.
const protectedPatterns = [
  String.raw`(?:[hH][tT][tT][pP][sS]?:\/\/|[wW][wW][wW]\.)[^\s<>"'，。；！？、（）【】]+`,
  String.raw`[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}`,
  String.raw`@[^\s，。；！？、（）【】<>"']+`,
  String.raw`(?:US\$|[$＄¥￥€£]|(?:USD|RMB|CNY)\s*)\s*[\d,]+(?:\.\d+)?(?:\s*[-–~至]\s*[\d,]+(?:\.\d+)?)?`,
  String.raw`[\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟萬億兩貳參陸零〇,，.]+\s*(?:美元|美金|人民币|人民幣|港元|港币|港幣|台币|台幣|元|块|塊|刀)`,
].map(pattern => new RegExp(pattern, 'gu'));

export function traditionalPostText(source: PostTranslationText, nickname: string): PostTranslationText {
  const literals = [nickname, source.budget].filter(Boolean);
  const convert = (text: string) => {
    const spans: Array<{ start: number; end: number }> = [];
    for (const pattern of protectedPatterns) {
      for (const match of text.matchAll(pattern)) spans.push({ start: match.index, end: match.index + match[0].length });
    }
    for (const literal of literals) {
      // Exact, case-sensitive literal matches can also overlap each other.
      for (let start = text.indexOf(literal); start !== -1; start = text.indexOf(literal, start + 1)) {
        spans.push({ start, end: start + literal.length });
      }
    }
    spans.sort((left, right) => left.start - right.start || right.end - left.end);
    const protectedSpans: typeof spans = [];
    for (const span of spans) {
      const previous = protectedSpans.at(-1);
      if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
      else protectedSpans.push({ ...span });
    }
    // A nickname or budget can begin before a URL and end inside its scheme.
    // Preserve the union of full matches rather than consuming a URL prefix.
    let converted = '', offset = 0;
    for (const { start, end } of protectedSpans) {
      converted += translateText(text.slice(offset, start), 'zh-Hant') + text.slice(start, end);
      offset = end;
    }
    return converted + translateText(text.slice(offset), 'zh-Hant');
  };
  return { title: convert(source.title), description: convert(source.description), budget: source.budget, timeInfo: convert(source.timeInfo) };
}
