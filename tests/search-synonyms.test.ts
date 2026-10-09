import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import '../src/i18n/router';
import { setLocale, simplifySearch } from '../src/i18n/locale';
import { normalizeSearchText, searchSynonymsOf, SEARCH_SYNONYM_GROUPS } from '../src/lib/search-synonyms';
import { searchGuides } from '../src/lib/guide-search';
import { searchQuickDestinations } from '../src/lib/quick-search';
import { isHomeQuestion } from '../src/lib/home-query';
import { guides } from '../src/data/guides';

// G17 acceptance, on the day the R0 testers arrive (Fleet Week runs 10/6–10/12).
const today = '2026-10-08';
after(async () => { await setLocale('zh-Hans', false); });

/** What the site search overlay (QuickExplore) lists for a query: destinations plus guides. */
const siteSearch = (query: string, locale: 'zh-Hans' | 'zh-Hant' | 'en') => {
  const destinations = searchQuickDestinations(query, locale, today);
  return {
    events: destinations.events.map(item => item.id), offers: destinations.offers.map(item => item.id),
    guides: searchGuides(guides, { query, locale }).map(result => result.guide.slug),
  };
};
const fleetWeek = 'san-francisco-fleet-week-2026';
const pension = 'bay-area-social-security-retirement-preparation-guide';
const doctorGuides = ['bay-area-first-doctor-insurance-network-guide', 'bay-area-chinese-senior-services-referral-guide'];
const seniorMuni = 'sfmta-free-muni-seniors';

test('the five colloquial searches each find the page a reader means (zh-Hans, zh-Hant, en)', async () => {
  const cases = {
    'zh-Hans': [['蓝天使', 'event'], ['舰队周', 'event'], ['海军周', 'event'], ['养老金', 'pension'], ['中文医生', 'doctor'], ['长者 Muni', 'muni'], ['老人 Muni', 'muni']],
    'zh-Hant': [['藍天使', 'event'], ['艦隊週', 'event'], ['養老金', 'pension'], ['中文醫生', 'doctor'], ['長者 Muni', 'muni'], ['長輩 Muni', 'muni']],
    en: [['Blue Angels', 'event'], ['Fleet Week', 'event'], ['蓝天使', 'event'], ['pension', 'pension'], ['Social Security', 'pension'], ['Chinese doctor', 'doctor'], ['senior Muni', 'muni']],
  } as const;
  for (const [locale, rows] of Object.entries(cases) as [keyof typeof cases, typeof cases[keyof typeof cases]][]) {
    await setLocale(locale, false);
    for (const [query, want] of rows) {
      const found = siteSearch(query, locale);
      const label = `${locale}: ${query} → ${JSON.stringify(found).slice(0, 300)}`;
      if (want === 'event') assert.equal(found.events[0], fleetWeek, label);
      if (want === 'pension') assert.equal(found.guides[0], pension, label);
      if (want === 'doctor') assert.ok(found.guides.slice(0, 3).some(slug => doctorGuides.includes(slug)), label);
      if (want === 'muni') assert.ok(found.offers.includes(seniorMuni), label);
    }
  }
});

test('the guide library search (/guides?q=) finds the same answers', () => {
  const slugs = (query: string, locale: 'zh-Hans' | 'zh-Hant' = 'zh-Hans') => searchGuides(guides, { query, locale }).map(result => result.guide.slug);
  assert.equal(slugs('养老金')[0], pension);
  assert.equal(slugs('退休金')[0], pension);
  assert.ok(slugs('中文医生').includes('bay-area-first-doctor-insurance-network-guide'));
  assert.ok(slugs('长者 Muni').includes('bay-area-october-muni-clipper-payment-update-2026'));
  assert.ok(slugs('老人服务').includes('bay-area-chinese-senior-services-referral-guide'));
  assert.ok(slugs('诈骗').includes('bay-area-rental-scam-guide'));
  assert.deepEqual(slugs('诈骗'), slugs('防骗'));
  assert.deepEqual(slugs('白卡'), slugs('Medi-Cal'));
  assert.ok(slugs('红蓝卡').includes('bay-area-medicare-hicap-medi-cal-guide'));
  assert.deepEqual(slugs('長輩', 'zh-Hant'), slugs('长辈'));
  assert.deepEqual(slugs('屋仑'), slugs('奥克兰'));
  assert.deepEqual(slugs('圣荷西'), slugs('San Jose'));
  assert.deepEqual(slugs('费利蒙'), slugs('Fremont'));
  assert.deepEqual(slugs('库比蒂诺'), slugs('Cupertino'));
});

test('a synonym never makes a word out of part of another word', () => {
  const pensionKey = normalizeSearchText('养老金');
  for (const text of ['message', 'passage', 'Mississauga', 'suspension', 'expensive', 'compensation']) assert.ok(!normalizeSearchText(text).includes(pensionKey), text);
  assert.ok(normalizeSearchText('Call SSA first').includes(pensionKey));
  assert.ok(normalizeSearchText('社安金').includes(pensionKey));
  // A Social Security number is paperwork, not a pension.
  assert.ok(!normalizeSearchText('Social Security number').includes(pensionKey));
  assert.ok(!normalizeSearchText('scampi').includes(normalizeSearchText('scam')));
  assert.ok(normalizeSearchText('scams').includes(normalizeSearchText('诈骗')));
  // Partial words still find their literal spelling inside the shared key.
  assert.ok(normalizeSearchText('San Francisco Fleet Week').includes('angels'));
  assert.ok(normalizeSearchText('舰队周').includes('天使'));
});

test('Traditional, full-width and case variants share one key; groups are lower-case Simplified and disjoint', () => {
  assert.equal(normalizeSearchText('藍天使'), normalizeSearchText('Fleet Week'));
  assert.equal(normalizeSearchText('ＦＬＥＥＴ ＷＥＥＫ'), normalizeSearchText('fleet week'));
  assert.equal(normalizeSearchText('長者'), normalizeSearchText('senior'));
  assert.deepEqual(searchSynonymsOf('長者').slice(0, 2), ['长辈', '老人']);
  assert.deepEqual(searchSynonymsOf('no such word'), []);
  const seen = new Set<string>();
  for (const group of SEARCH_SYNONYM_GROUPS) for (const member of group) {
    assert.equal(member, member.toLowerCase(), member);
    assert.equal(simplifySearch(member), member, `${member} is already Simplified`);
    assert.ok(!seen.has(member), `${member} is in two groups`);
    seen.add(member);
  }
});

test('home: a Traditional question goes to BayBay like a Simplified one; keywords stay in search', () => {
  for (const question of ['长者怎么申请免费 Muni', '長者怎麼申請免費 Muni', '養老金什麼時候領', '哪裡有中文醫生', '幫我查藍天使時間', '請問白卡怎麼申請']) assert.equal(isHomeQuestion(question), true, question);
  for (const keyword of ['蓝天使', '藍天使', '長者 Muni', '养老金', 'Fleet Week']) assert.equal(isHomeQuestion(keyword), false, keyword);
});
