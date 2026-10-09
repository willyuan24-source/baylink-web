import { simplifySearch } from '../i18n/locale';

/**
 * Search synonyms (G17), shared by quick search, guide search and the /events keyword filter.
 *
 * Each group lists equivalent spellings, lower-case and in Simplified Chinese: normalizeSearchText() folds
 * Traditional Chinese to Simplified first (simplifySearch), so 藍天使 / 艦隊週 / 養老金 / 長者 need no entries of
 * their own. Every member of a group is rewritten to the group's key, one token that spells out all members, so a
 * query and a document meet on the same key while a partial word ("angels", "天使") still finds its literal
 * spelling inside the key. Matching is symmetric: the same function runs on the query and on the text.
 */
export const SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Events people name by their nickname.
  ['舰队周', '海军周', '蓝天使', '蓝天使飞行表演', 'fleet week', 'blue angels'],
  // Seniors and the benefits they ask about.
  ['长者', '长辈', '老人', '老年人', '年长者', '耆英', 'seniors', 'senior', 'elderly', 'older adults'],
  ['养老金', '退休金', '社安金', '社安福利', '社会保障退休金', 'social security retirement', 'social security benefits', 'social security', 'pension', 'ssa'],
  // A Social Security number is paperwork, not a pension: listed apart so the longer names win.
  ['社安号', '社会安全号', '社会安全号码', '社会安全卡', '社安卡', 'social security number', 'social security card', 'ssn'],
  ['防骗', '诈骗', '防诈骗', '防诈', '反诈', '骗局', '欺诈', 'scams', 'scam', 'fraud'],
  ['medicare', '联邦医保', '红蓝卡', '红白蓝卡'],
  ['medi-cal', '白卡', 'medi cal'],
  // Everyday errands (kept from the guide search).
  ['学区', 'school districts', 'school district', 'districts', 'district'], ['学校', 'schools', 'school'],
  ['校区', '校园', 'campuses', 'campus'], ['入学', 'enrollment', 'enrolment'],
  ['租房', '租屋', '租赁'], ['二手', '闲置'],
  ['驾照', '考驾照', '驾驶证', 'driver license', "driver's license"], ['宽带', '网络', '网路'],
  ['打印', '列印'], ['维修', '修理'], ['净滩', '海岸清理', 'coastal cleanup'],
  ['就医', '看病', '看医生', 'medical care'],
  ['报税', 'tax filing', 'tax return'], ['押金', 'security deposit'],
  // City names as Chinese readers write them.
  ['旧金山', '三藩市', 'san francisco'],
  ['南旧金山', '南三藩市', 'south san francisco'],
  ['圣何塞', '圣荷西', 'san jose', 'san josé'],
  ['奥克兰', '屋仑', 'oakland'],
  ['弗里蒙特', '费利蒙', '菲利蒙', '佛利蒙', 'fremont'],
  ['库比蒂诺', '库柏蒂诺', '古柏蒂诺', 'cupertino'],
  ['伯克利', '柏克莱', 'berkeley'],
  ['桑尼维尔', '森尼韦尔', '森尼维尔', 'sunnyvale'],
  ['圣克拉拉', '圣塔克拉拉', 'santa clara'],
  ['帕洛阿尔托', '帕罗奥图', 'palo alto'],
  ['山景城', 'mountain view'],
  ['米尔皮塔斯', '苗必达', 'milpitas'],
  ['圣马特奥', '圣马刁', 'san mateo'],
  ['红木城', 'redwood city'],
  ['戴利城', 'daly city'],
  ['阿拉米达', 'alameda'],
  ['海沃德', 'hayward'],
  ['核桃溪', 'walnut creek'],
  ['半月湾', 'half moon bay'],
];

/** Phrases that are two separate words to a reader: 中文医生 is a doctor page that mentions Chinese, not the literal phrase. */
const SEARCH_PHRASES: readonly (readonly [string, string])[] = [
  ['会说中文的医生', '中文 医生'], ['说中文的医生', '中文 医生'], ['讲中文的医生', '中文 医生'],
  ['中文医生', '中文 医生'], ['华语医生', '中文 医生'], ['华人医生', '中文 医生'], ['中文家庭医生', '中文 家庭医生'],
];

// U+2063 INVISIBLE SEPARATOR: not whitespace to /\s/ or to the discovery tokenizer, so a key stays one token.
const SEPARATOR = '⁣';
const latin = /[a-z0-9]/;
let matcher: { pattern: RegExp; replacements: Map<string, string> } | undefined;

function buildMatcher() {
  const replacements = new Map<string, string>();
  for (const group of SEARCH_SYNONYM_GROUPS) {
    const key = SEPARATOR + group.map(member => member.replaceAll(' ', SEPARATOR)).join(SEPARATOR) + SEPARATOR;
    for (const member of group) replacements.set(member, key);
  }
  for (const [phrase, words] of SEARCH_PHRASES) replacements.set(phrase, ` ${words} `);
  const alternatives = [...replacements.keys()].sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { pattern: new RegExp(alternatives.join('|'), 'g'), replacements };
}

/**
 * Lower-case, Simplified, width-folded text with every synonym rewritten to its group key. A Latin name only counts
 * as a whole word at its start ("pension" is not inside "suspension"), and a short one (≤4 letters, e.g. "ssa") at
 * both ends; the neighbouring characters are checked in code, as a regex look-behind would stop Safari < 16.4.
 */
export function normalizeSearchText(text: string): string {
  const value = simplifySearch(text).normalize('NFKC').toLowerCase();
  const { pattern, replacements } = matcher ||= buildMatcher();
  return value.replace(pattern, (match: string, offset: number) => {
    const before = value[offset - 1] || '', after = value[offset + match.length] || '';
    if (latin.test(match[0]) && latin.test(before)) return match;
    if (match.length <= 4 && latin.test(match[match.length - 1]) && latin.test(after)) return match;
    return replacements.get(match)!;
  }).trim();
}

/** The other spellings a reader may have meant, for "also searched" hints and tests; [] when the term is in no group. */
export function searchSynonymsOf(term: string): string[] {
  const value = simplifySearch(term).normalize('NFKC').toLowerCase().trim();
  return [...(SEARCH_SYNONYM_GROUPS.find(group => group.includes(value)) || [])].filter(member => member !== value);
}
