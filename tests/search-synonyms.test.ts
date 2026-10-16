import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import '../src/i18n/router';
import { setLocale, simplifySearch } from '../src/i18n/locale';
import { normalizeSearchQuery, normalizeSearchText, searchSynonymsOf, SEARCH_SYNONYM_GROUPS } from '../src/lib/search-synonyms';
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
  assert.ok(!slugs('养老金').includes('bay-area-useful-apps-platforms-guide'), 'an "/ssa/" path in a link is not a pension match');
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
  // Web addresses are not prose: a path segment is not SSA, a host name is not Fleet Week; the sentence around them still is.
  for (const text of ['https://mydigitalworld.fb.com/ssa/lesson/strategies-for-avoiding-scams/', 'www.ssa.gov/myaccount', 'http://example.org/fleet-week'])
    assert.equal(normalizeSearchText(text), text, text);
  assert.ok(normalizeSearchText('登录 https://www.ssa.gov/ 前先准备 SSA 信件').includes(pensionKey));
  assert.ok(!normalizeSearchText('登录 https://www.ssa.gov/ 前先准备').includes(pensionKey));
  assert.ok(!normalizeSearchText('Mobile 指南：https://mydigitalworld.fb.com/ssa/lesson').includes(pensionKey));
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

test('quick search lists the senior pages first for 长者: a synonym or a venue name only fills the rest', async () => {
  // Three event slots, soonest first: newer programs for older adults (the 10/25 Portola Valley lantern class, 55+) may
  // list ahead of the 10/30 San Leandro bingo, so only the first senior-specific event is pinned here.
  const seniorEvents = ['el-cerrito-senior-resource-fair-2026'];
  for (const [locale, query] of [['zh-Hans', '长者'], ['zh-Hant', '長者'], ['zh-Hans', '老人'], ['en', 'senior']] as const) {
    await setLocale(locale, false);
    const found = searchQuickDestinations(query, locale, today);
    const label = `${locale}: ${query} → ${JSON.stringify({ events: found.events.map(item => item.id), offers: found.offers.map(item => item.id) })}`;
    for (const id of seniorEvents) assert.ok(found.events.some(event => event.id === id), label);
    // The Napa garden talk only matches because it is held at a "Senior Center".
    assert.ok(!found.events.some(event => event.id === 'napa-water-wise-workshops-oct2026'), label);
    assert.ok(found.offers.some(offer => offer.id === seniorMuni), label);
  }
  await setLocale('zh-Hans', false);
  // A Latin word starts a word: "muni" is not inside "Community Center".
  const muni = searchQuickDestinations('长者 Muni', 'zh-Hans', today);
  assert.deepEqual(muni.events.map(event => event.id), []);
  assert.deepEqual(muni.offers.map(offer => offer.id), [seniorMuni]);
});

// ELDERS-2 (G24, G89; READ-03, CW-05, GUIDE-K): what an older reader or their family types reaches the right page first,
// and two shared words that used to pull in unrelated pages no longer do.
test('elder searches put the page a reader means first (zh-Hans and zh-Hant)', async () => {
  const seniorGuide = 'bay-area-chinese-senior-services-referral-guide';
  const dentalGuide = 'bay-area-dental-care-insurance-low-cost-guide';
  const firstGuide = (query: string, locale: 'zh-Hans' | 'zh-Hant' = 'zh-Hans') => searchGuides(guides, { query, locale })[0]?.guide.slug;
  for (const [locale, rows] of [['zh-Hans', ['老人卡', '老人免费坐公交', '长者免费坐公交', '老人坐公交免费']], ['zh-Hant', ['老人卡', '老人免費坐公交']]] as const) {
    await setLocale(locale, false);
    for (const query of rows) assert.equal(searchQuickDestinations(query, locale, today).offers[0]?.id, seniorMuni, `${locale}: ${query} → the SFMTA 65+ free Muni page`);
  }
  await setLocale('zh-Hans', false);
  // 送餐 (Home Delivered Meals) is in the senior services guide; 爸妈 / 父母 are the reader's parents.
  assert.equal(firstGuide('老人送餐'), seniorGuide);
  assert.equal(firstGuide('长者 送餐'), seniorGuide);
  assert.equal(firstGuide('Meals on Wheels'), seniorGuide);
  assert.equal(firstGuide('爸妈'), seniorGuide);
  assert.equal(firstGuide('父母'), seniorGuide);
  assert.equal(firstGuide('爸媽', 'zh-Hant'), seniorGuide);
  // 看牙 = dental; with 老人 in front it still means the dental guide, which covers Medicare and Medi-Cal dental.
  for (const query of ['看牙', '老人 看牙', '老人看牙', '長者 看牙', '牙医', 'dentist']) assert.equal(firstGuide(query), dentalGuide, query);
  // 圣荷西 is San José.
  assert.equal(firstGuide('圣荷西'), firstGuide('San Jose'));
  assert.equal(firstGuide('圣荷西'), 'san-jose-guide');
  // The words each phrase is made of reach the same key the single words do.
  assert.ok(normalizeSearchQuery('老人免费坐公交').split(' ').includes(normalizeSearchText('长者')));
  assert.deepEqual(searchSynonymsOf('老人卡').filter(member => member.includes('clipper')), ['长者 clipper', '老人 clipper', '长者clipper', '老人clipper', 'senior clipper card', 'senior clipper']);
});

// H65 (GR-09): the senior fare card, RTC / Clipper Access and free rides reach the senior-fares guide (CNT-GUIDES-2, H71) first and
// the Muni / Clipper guide right after it; Free Muni itself opens the Muni guide. Elder words lift elder and transit guides over
// pages that only mention them (the deals boards list a Free Muni offer).
test('elder transit searches put the senior-fares guide, then the Muni / Clipper guide, first (H65)', async () => {
  const seniorFares = 'bay-area-senior-transit-clipper-discounts-guide';
  const muniGuide = 'bay-area-october-muni-clipper-payment-update-2026';
  const top = (query: string, locale: 'zh-Hans' | 'zh-Hant' = 'zh-Hans') => searchGuides(guides, { query, locale }).slice(0, 2).map(result => result.guide.slug);
  const first = (query: string, locale: 'zh-Hans' | 'zh-Hant' = 'zh-Hans') => top(query, locale)[0];
  await setLocale('zh-Hans', false);
  for (const query of ['老人卡', '长者卡', '长者 Clipper', '老人 clipper', 'RTC', 'Clipper Access']) assert.deepEqual(top(query), [seniorFares, muniGuide], query);
  assert.deepEqual(top('Free Muni'), [muniGuide, seniorFares]);
  for (const query of ['老人免费坐车', '长者免费坐车', '老人免费坐公交']) assert.equal(first(query), seniorFares, query);
  await setLocale('zh-Hant', false);
  for (const query of ['老人卡', '長者 Clipper']) assert.deepEqual(top(query, 'zh-Hant'), [seniorFares, muniGuide], query);
  assert.equal(first('老人免費坐車', 'zh-Hant'), seniorFares);
  await setLocale('zh-Hans', false);
  // An elder word still finds the page a reader means: 送餐 is the senior services guide, 看牙 the dental guide.
  assert.equal(first('老人送餐'), 'bay-area-chinese-senior-services-referral-guide');
  assert.equal(first('老人 看牙'), 'bay-area-dental-care-insurance-low-cost-guide');
  // RTC is a whole word only: it is not inside another Latin word.
  assert.equal(normalizeSearchText('artcenter').includes(normalizeSearchText('rtc')), false);
});

test('a district is not a school district and a network is not broadband (CW-05)', async () => {
  await setLocale('zh-Hans', false);
  const slugs = (query: string) => searchGuides(guides, { query, locale: 'zh-Hans' }).map(result => result.guide.slug);
  const schoolGuides = guides.filter(guide => /school-district/.test(guide.slug)).map(guide => guide.slug);
  assert.ok(schoolGuides.length >= 4);
  const mission = slugs('Mission District');
  assert.equal(mission[0], 'sf-mission-dolores-murals-walk-guide');
  assert.deepEqual(mission.filter(slug => schoolGuides.includes(slug)), [], 'no school-district guide for the neighbourhood');
  assert.ok(!normalizeSearchText('East Bay Regional Park District').includes(normalizeSearchText('学区')));
  assert.ok(!searchQuickDestinations('学区', 'zh-Hans', today).offers.some(offer => offer.id === 'east-bay-green-friday-nov27-2026'), 'a park district is not a 学区');
  assert.ok(slugs('学区').slice(0, 4).every(slug => schoolGuides.includes(slug)), '学区 still finds the school-district guides');
  // 保险网络 is the doctor's insurance network; 宽带 is internet service.
  assert.equal(slugs('保险网络')[0], 'bay-area-first-doctor-insurance-network-guide');
  assert.ok(!normalizeSearchText('哪个网络').includes(normalizeSearchText('宽带')));
  assert.notEqual(slugs('宽带')[0], 'bay-area-first-doctor-insurance-network-guide');
  assert.deepEqual(slugs('宽带').slice(0, 1), ['bay-area-city-utilities-internet-phone-directory']);
  assert.ok(normalizeSearchText('home internet').includes(normalizeSearchText('宽带')));
});

test('a typed query keeps each synonym a word of its own; the text side keeps them joined', () => {
  const senior = normalizeSearchText('长者');
  assert.deepEqual(normalizeSearchQuery('老人送餐').split(' '), [senior, normalizeSearchText('送餐')]);
  assert.equal(normalizeSearchText('老人送餐'), `${senior}${normalizeSearchText('送餐')}`);
  assert.equal(normalizeSearchQuery('养老金'), normalizeSearchText('养老金'));
});
