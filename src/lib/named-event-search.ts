/** Curated event names, not fuzzy title matching. Mirror changes in backend namedEventSearch.js. */
// W9-E (review 2026-10-01 R§5 #2): no regex look-behind here — Safari / WKWebView before 16.4 (iOS 15, iOS 16.0–16.3, WeChat
// on those iPhones) cannot parse one, and this module is evaluated with the site's main bundle (quick-search.ts →
// QuickExplore): the old look-behind regex stopped the whole site there. The English / "SF" names still need no letter or
// digit right before them; that check is made in code (replaceWaterLanternNames), with the same matches as before
// (tests/opus-bay-w9-e-lookbehind.test.ts compares it with the old regex on 30 000 queries). The backend (Node) keeps its regex.
const latinWaterLanternName = /(?:(?:(?:san\s+francisco|sf)\s+)?water\s+lantern\s+festival|(?:san\s+francisco|sf)\s*(?:的\s*)?水[灯燈][节節])(?![a-z0-9])/iuy;
const chineseWaterLanternName = /(?:(?:旧金山|舊金山)\s*(?:的\s*)?)?水[灯燈][节節]/iuy;
const letterOrDigit = /^[a-z0-9]$/iu;

/** Each name in the query, left to right, as the old global `(not after [a-z0-9]) latin | chinese` regex matched it: at each position the
 * English / "SF" name first (only when the character before is not a letter or digit, case-folded as /iu does), else the
 * Chinese one; after a match the search goes on from its end. */
function replaceWaterLanternNames(query: string, replace: (name: string, offset: number) => string): string {
  let out = '', last = 0, at = 0;
  while (at < query.length) {
    let match: RegExpExecArray | null = null;
    if (at === 0 || !letterOrDigit.test(query[at - 1])) { latinWaterLanternName.lastIndex = at; match = latinWaterLanternName.exec(query); }
    if (!match) { chineseWaterLanternName.lastIndex = at; match = chineseWaterLanternName.exec(query); }
    if (match) {
      out += query.slice(last, at) + replace(match[0], at);
      at = last = at + match[0].length;
      continue;
    }
    at += (query.codePointAt(at) ?? 0) > 0xffff ? 2 : 1;
  }
  return out + query.slice(last);
}
const excludedVenue = /(?:排除|不要(?:去)?|不去|避开|避開|避免)\s*(?:半岛|半島|foster\s+city)|\b(?:exclude|avoid|not|no|outside)\s+(?:the\s+)?(?:peninsula|foster\s+city)\b/iu;
const negatedName = /(?:不要|不想(?:去|要)?|不去|排除|避开|避開|避免)\s*$|\b(?:no|not|without|avoid|exclude|don['’]t want|do not want)\s*$/iu;

export function recognizeNamedEvent(query: string): { eventIds: string[]; constraintText: string; blocked: boolean } {
  let matched = false;
  let blocked = false;
  const constraintText = replaceWaterLanternNames(query, (name, offset) => {
    matched = true;
    const prefix = query.slice(Math.max(0, offset - 40), offset);
    if (negatedName.test(prefix)) blocked = true;
    // "SF 的水灯节" names the event; "仅限 SF 水灯节" explicitly restricts its location.
    const constrainedCity = /(?:仅限|僅限|只限|仅在|僅在|只在|限于|限於|only in)\s*$/iu.test(prefix)
      ? name.match(/^(?:san\s+francisco|sf|旧金山|舊金山)/iu)?.[0] : undefined;
    if (constrainedCity) return constrainedCity + ' '.repeat(name.length - constrainedCity.length);
    // Only the recognized name is removed. Outside cities, dates, budgets and ages remain.
    return ' '.repeat(name.length);
  });
  return {
    eventIds: matched ? ['foster-city-water-lantern-festival-2026'] : [],
    constraintText,
    blocked: matched && (blocked || excludedVenue.test(constraintText)),
  };
}
