import { translateText } from '../../i18n/locale';
import type { PostTranslationText } from './postTranslationStore';

const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Keep identifying strings and quoted prices byte-for-byte, including Chinese
// URL paths and written-out amounts. The complete budget field stays original.
const protectedText = [
  String.raw`(?:[hH][tT][tT][pP][sS]?:\/\/|[wW][wW][wW]\.)[^\s<>"'，。；！？、（）【】]+`,
  String.raw`[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}`,
  String.raw`@[^\s，。；！？、（）【】<>"']+`,
  String.raw`(?:US\$|[$＄¥￥€£]|(?:USD|RMB|CNY)\s*)\s*[\d,]+(?:\.\d+)?(?:\s*[-–~至]\s*[\d,]+(?:\.\d+)?)?`,
  String.raw`[\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟萬億兩貳參陸零〇,，.]+\s*(?:美元|美金|人民币|人民幣|港元|港币|港幣|台币|台幣|元|块|塊|刀)`,
].join('|');

export function traditionalPostText(source: PostTranslationText, nickname: string): PostTranslationText {
  const protectedPattern = new RegExp([nickname && escapePattern(nickname), source.budget && escapePattern(source.budget), protectedText].filter(Boolean).join('|'), 'gu');
  const convert = (text: string) => {
    let converted = '', offset = 0;
    for (const match of text.matchAll(protectedPattern)) {
      converted += translateText(text.slice(offset, match.index), 'zh-Hant') + match[0];
      offset = match.index + match[0].length;
    }
    return converted + translateText(text.slice(offset), 'zh-Hant');
  };
  return { title: convert(source.title), description: convert(source.description), budget: source.budget, timeInfo: convert(source.timeInfo) };
}
