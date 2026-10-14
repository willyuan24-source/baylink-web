import { simplifySearch } from '../i18n/locale';

/**
 * Search synonyms (G17), shared by quick search, guide search and the /events keyword filter.
 *
 * Each group lists equivalent spellings, lower-case and in Simplified Chinese: normalizeSearchText() folds
 * Traditional Chinese to Simplified first (simplifySearch), so 藍天使 / 艦隊週 / 養老金 / 長者 need no entries of
 * their own. Every member of a group is rewritten to the group's key, one token that spells out all members, so a
 * query and a document meet on the same key while a partial word ("angels", "天使") still finds its literal
 * spelling inside the key. Matching is symmetric: the same function runs on the query and on the text (a typed query
 * through normalizeSearchQuery, which only splits the keys into words of their own).
 */
export const SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Events people name by their nickname.
  ['舰队周', '海军周', '蓝天使', '蓝天使飞行表演', 'fleet week', 'blue angels'],
  // Seniors and the benefits they ask about.
  // 爸妈 / 父母 on this site are the reader's own ageing parents (帮父母看医保, 爸妈来住): G89, GUIDE-K.
  ['长者', '长辈', '老人', '老年人', '年长者', '耆英', '爸妈', '父母', '老爸老妈', '爸爸妈妈', 'seniors', 'senior', 'elderly', 'older adults'],
  // The reduced-fare card: 老人卡 is the Senior Clipper, not every senior page (G24). 长者 Clipper / 老人 Clipper written as
  // two words are the same card (H65, GR-09).
  ['老人卡', '长者卡', '老人交通卡', '长者交通卡', '长者 clipper', '老人 clipper', '长者clipper', '老人clipper', 'senior clipper card', 'senior clipper'],
  // RTC is the old name of the disabled riders' discount card, now Clipper Access (the Muni / Clipper guide's word) (H65).
  ['clipper access', 'rtc clipper', 'rtc 卡', 'rtc卡', 'regional transit connection', 'rtc'],
  // SFMTA Free Muni for seniors (65+), as readers type it (H65).
  ['free muni for seniors', 'free muni', '免费 muni', '免费muni', 'muni 免费'],
  // Meals brought to the door (Home Delivered Meals, Meals on Wheels): GUIDE-K 老人送餐.
  ['送餐', '上门送餐', '送餐服务', 'meals on wheels', 'home-delivered meals', 'home delivered meals'],
  // 老人看牙 asks where an older reader can see a dentist: the dental guide (Medicare / Medi-Cal dental) answers it, though
  // it does not use the word 老人; as two separate words the search would ask for both (READ-03).
  ['看牙', '看牙医', '牙医', '牙科', '洗牙', '老人看牙', '老人 看牙', '长者看牙', '长者 看牙', '老人牙科', '长者牙科', 'senior dental', 'dental care', 'dentists', 'dentist', 'dental'],
  // Riding the bus: 坐公交 / 巴士 meet the pages that say 公交 (the SFMTA 65+ free Muni page says "Muni 公交").
  ['公交', '坐公交', '乘公交', '搭公交', '公交车', '公车', '巴士', '坐巴士', 'public transit', 'buses', 'bus'],
  // The neighbourhood, not a school district: the guides write "Mission 社区" or name Mission Dolores in it (CW-05).
  ['mission district', 'mission dolores', 'mission 社区', 'mission社区', 'mission 区', 'mission区', '米慎区', '教会区'],
  ['养老金', '退休金', '社安金', '社安福利', '社会保障退休金', 'social security retirement', 'social security benefits', 'social security', 'pension', 'ssa'],
  // A Social Security number is paperwork, not a pension: listed apart so the longer names win.
  ['社安号', '社会安全号', '社会安全号码', '社会安全卡', '社安卡', 'social security number', 'social security card', 'ssn'],
  ['防骗', '诈骗', '防诈骗', '防诈', '反诈', '骗局', '欺诈', 'scams', 'scam', 'fraud'],
  ['medicare', '联邦医保', '红蓝卡', '红白蓝卡'],
  ['medi-cal', '白卡', 'medi cal'],
  // Everyday errands (kept from the guide search).
  // Only a school district is a 学区: "Mission District" and "East Bay Regional Park District" are not (CW-05).
  ['学区', 'school districts', 'school district'], ['学校', 'schools', 'school'],
  ['校区', '校园', 'campuses', 'campus'], ['入学', 'enrollment', 'enrolment'],
  ['租房', '租屋', '租赁'], ['二手', '闲置'],
  ['驾照', '考驾照', '驾驶证', 'driver license', "driver's license"],
  // Not 网络: 哪个网络 on a doctor page is an insurance network (CW-05).
  ['宽带', 'broadband', 'internet'],
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
  // SF Muni is free at 65+ (SFMTA Free Muni for Seniors); readers ask for it in their own words (G24).
  ...['老人免费坐公交', '老人坐公交免费', '老人免费乘公交', '老人免费公交', '老人公交免费', '长者免费坐公交', '长者免费公交', '老人免费坐巴士', '长者免费坐巴士',
    '老人免费坐车', '长者免费坐车', '老人坐车免费', '长者坐车免费', '老人免费乘车', '长者免费乘车']
    .map(phrase => [phrase, '长者 免费 muni'] as const),
];

/**
 * Words a page may say instead of a group's name, for the guide search only (H65): the Muni / Clipper guide never says 老人卡
 * or Free Muni, but it says 长者 and Clipper, and Muni. A query word from one of these groups also matches a guide that has
 * every word of one alternative. Written as plain words; they go through the same rewrite as everything else.
 */
const SEARCH_ALTERNATIVES: readonly (readonly [string, readonly (readonly string[])[]])[] = [
  ['老人卡', [['长者', 'clipper'], ['长者', 'muni']]],
  ['free muni', [['muni']]],
  ['clipper access', [['优惠', 'clipper']]],
];
let alternatives: Map<string, string[][]> | undefined;
/** The alternative word sets (already rewritten) for a rewritten query word; [] when it has none. */
export function searchAlternativesOf(token: string): string[][] {
  alternatives ||= new Map(SEARCH_ALTERNATIVES.map(([member, sets]) => [normalizeSearchText(member), sets.map(words => words.map(word => normalizeSearchText(word)))]));
  return alternatives.get(token) ?? [];
}

/** Query words that mean an older reader or their transit card: the guide search lifts elder and transit guides for them (H65). */
export function isElderSearchToken(token: string): boolean {
  return ['长者', '老人卡', 'free muni', 'clipper access'].some(word => normalizeSearchText(word) === token);
}

/** Query words that name a reduced-fare card or free ride (老人卡, RTC / Clipper Access, Free Muni): transit guides first (H65). */
export function isFareCardSearchToken(token: string): boolean {
  return ['老人卡', 'free muni', 'clipper access'].some(word => normalizeSearchText(word) === token);
}

// U+2063 INVISIBLE SEPARATOR: not whitespace to /\s/ or to the discovery tokenizer, so a key stays one token.
const SEPARATOR = '⁣';
const latin = /[a-z0-9]/;
// A web address is not prose: "mydigitalworld.fb.com/ssa/lesson" must not read as SSA (养老金).
const webAddress = /(?:https?:\/\/|www\.)[!-~]+/g;
let matcher: { pattern: RegExp; replacements: Map<string, string> } | undefined;

function buildMatcher() {
  const replacements = new Map<string, string>();
  for (const group of SEARCH_SYNONYM_GROUPS) {
    const key = SEPARATOR + group.map(member => member.replaceAll(' ', SEPARATOR)).join(SEPARATOR) + SEPARATOR;
    for (const member of group) replacements.set(member, key);
  }
  // A phrase's words take their group keys (长者 → the senior key), so the phrase finds what each word would.
  for (const [phrase, words] of SEARCH_PHRASES) replacements.set(phrase, ` ${words.split(' ').map(word => replacements.get(word) ?? word).join(' ')} `);
  const alternatives = [...replacements.keys()].sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { pattern: new RegExp(alternatives.join('|'), 'g'), replacements };
}

/**
 * Lower-case, Simplified, width-folded text with every synonym rewritten to its group key. A Latin name only counts
 * as a whole word at its start ("pension" is not inside "suspension"), and a short one (≤4 letters, e.g. "ssa") at
 * both ends; the neighbouring characters are checked in code, as a regex look-behind would stop Safari < 16.4. Nothing
 * inside a web address (http://, https:// or www.) is rewritten.
 */
export function normalizeSearchText(text: string, { separate = false }: { separate?: boolean } = {}): string {
  const value = simplifySearch(text).normalize('NFKC').toLowerCase();
  const { pattern, replacements } = matcher ||= buildMatcher();
  const addresses = value.includes('http') || value.includes('www.') ? [...value.matchAll(webAddress)].map(found => [found.index!, found.index! + found[0].length]) : [];
  return value.replace(pattern, (match: string, offset: number) => {
    if (addresses.some(([start, end]) => offset >= start && offset < end)) return match;
    const before = value[offset - 1] || '', after = value[offset + match.length] || '';
    if (latin.test(match[0]) && latin.test(before)) return match;
    if (match.length <= 4 && latin.test(match[match.length - 1]) && latin.test(after)) return match;
    const replacement = replacements.get(match)!;
    return separate ? ` ${replacement} ` : replacement;
  }).trim();
}

/**
 * A typed query: the same rewrite, with every synonym a word of its own. 老人送餐 → senior + 送餐 and 老人看牙 → senior +
 * dental each match anywhere in a text (all words must), not only side by side as the keys stand in the text.
 */
export const normalizeSearchQuery = (query: string): string => normalizeSearchText(query, { separate: true }).replace(/\s+/g, ' ');

/** The other spellings a reader may have meant, for "also searched" hints and tests; [] when the term is in no group. */
export function searchSynonymsOf(term: string): string[] {
  const value = simplifySearch(term).normalize('NFKC').toLowerCase().trim();
  return [...(SEARCH_SYNONYM_GROUPS.find(group => group.includes(value)) || [])].filter(member => member !== value);
}
