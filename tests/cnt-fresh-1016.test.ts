import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { VERIFIED_PLACE_SCHEDULES } from '../src/data/planner-verified-hours';
import { EVENT_OVERLAY, OFFER_OVERLAY, OPENING_OVERLAY } from '../src/data/editorial-overlay/apply';
import supplyEvents1016 from '../src/data/supply-2026-10-16-events.json';
import { loadLocale, translateText } from '../src/i18n/locale';

/**
 * CNT-FRESH-1016: the GPT editor's batch-4 freshness review (read 2026-10-15) and the lane's own re-reads of 2026-10-16
 * (docs/source-reads-2026-10.md, "CNT-FRESH-1016"). Each block pins a fact the review corrected, so a later batch cannot
 * quietly bring the old wording back.
 */
const event = (id: string) => { const found = MONTHLY_EVENTS.find(item => item.id === id); assert.ok(found, id); return found; };
const offer = (id: string) => { const found = currentFreebies.find(item => item.id === id); assert.ok(found, id); return found; };
const opening = (id: string) => { const found = currentOpenings.find(item => item.id === id); assert.ok(found, id); return found; };
const HAN = /[㐀-鿿]/u;
const strings = (value: unknown): string[] => typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

test('language claims follow each session’s own text: Tully only in English and Vietnamese, Willow Glen Mandarin on Thursdays, Alum Rock Level 0', () => {
  // Tully Tech Help for Seniors (12/20, 12/27, 1/3 and the November dates): the description promises English and Vietnamese
  // only; a Chinese filter tag is not a promise. The site never listed them as Chinese help, and must not.
  assert.ok(!MONTHLY_EVENTS.some(item => /6a8e207f4cb69d003e2363a/u.test(item.officialUrl)), 'no Tully Tech Help session is listed');
  assert.ok(!MONTHLY_EVENTS.some(item => /Tully/u.test(item.title) && /普通话|国语|粤语|中文|华语/u.test(`${item.title}${item.summary}`)), 'no Tully item claims Chinese help');
  // Willow Glen 1 on 1 Tech Assistance: "Thursdays at 11 AM - assistance available in English or Mandarin Chinese" only.
  const willowGlen = MONTHLY_EVENTS.filter(item => /Willow Glen/u.test(item.title) && /普通话|国语|Mandarin/u.test(item.title));
  assert.ok(willowGlen.length >= 1);
  for (const item of willowGlen) for (const day of item.occurrenceDates ?? []) assert.equal(weekday(day), 4, `${item.id} ${day} is a Thursday session`);
  // Alum Rock: Level 0 has the English-and-Chinese teacher; Level 1 is an English/Vietnamese class.
  const alumRock = event('sjpl-alum-rock-basic-english-2026');
  assert.match(alumRock.officialUrl, /6a88a8afb20478002994849f$/u);
  assert.match(alumRock.title, /零基础/u);
  assert.ok(!MONTHLY_EVENTS.some(item => /Alum Rock/u.test(item.title) && /Level 1|一级/u.test(item.title) && /中文/u.test(item.summary)));
});

test('library programmes are "free" by a system policy or by the event’s own page, never by a sister system', () => {
  // GPT library-free-policy (2026-10-15): strict programme rules for Oakland, SCCLD, SJPL, SMCL, Sonoma and Marin; SFPL's
  // events directory states every programme is free. Alameda County, Contra Costa, Napa, Palo Alto and Berkeley publish no
  // such rule, so their events stay "unknown" unless the event page itself says free (named here with its own quote).
  const noPolicy = ['aclibrary.bibliocommons.com', 'ccclib.bibliocommons.com', 'events.napalibrary.gov', 'napalibrary.libnet.info', 'paloalto.bibliocommons.com', 'berkeleypubliclibrary.org', 'berkeleypubliclibrary.bibliocommons.com'];
  const ownPage: Record<string, string> = {
    'ccclib-martinez-diy-gift-wrap-dec5-2026': 'the event page: "this free, all ages program"',
    'pacl-rinconada-tai-chi-2026': 'the event page: "This class is free and open to beginners"',
  };
  const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./u, ''); } catch { return ''; } };
  const free = MONTHLY_EVENTS.filter(item => item.endDate >= '2026-10-16' && noPolicy.includes(host(item.officialUrl)) && (item.cost === 'free' || item.cost === 'mixed'));
  assert.deepEqual(free.map(item => item.id).filter(id => !Object.hasOwn(ownPage, id)), []);
  // Sales keep their exception: entry is free, goods are priced.
  for (const item of MONTHLY_EVENTS.filter(row => /book-sale|friends-book/u.test(row.id) && row.cost === 'free')) assert.match(item.costLabel, /免费入场|入场免费|免费进场/u, item.id);
});

test('November Chinese-community supply: two new SFPL items, the Xiangqi second day, labelled culture versus language', () => {
  assert.deepEqual(supplyEvents1016.map(item => item.id), ['sfpl-visitacion-valley-calligraphy-chess-nov14-2026', 'sfpl-sunset-mahjong-nov28-2026']);
  for (const source of supplyEvents1016) {
    const item = event(source.id);
    assert.equal(item.verifiedAt, '2026-10-16');
    assert.equal(item.cost, 'free');
    assert.match(item.summary, /英语进行/u, `${item.id}: SFPL runs programmes in English unless noted; this one is Chinese culture, not Chinese-language`);
    assert.equal(PLANNER_EVENTS.find(row => row.id === item.id)?.planning?.admissionUsd, 0);
  }
  const calligraphy = event('sfpl-visitacion-valley-calligraphy-chess-nov14-2026');
  assert.deepEqual(calligraphy.sessions, [{ date: '2026-11-14', start: '14:00', end: '15:30' }]);
  const mahjong = event('sfpl-sunset-mahjong-nov28-2026');
  assert.deepEqual(mahjong.sessions?.map(session => session.start), ['10:30', '13:30']);
  assert.match(mahjong.costLabel, /预约/u);
  assert.match(mahjong.plan.join(''), /11\/14 起打 415-355-2808/u);
  assert.equal(PLANNER_EVENTS.find(row => row.id === mahjong.id)?.planning?.reservation, 'required');
  // "All programs are drop-in (no registration necessary) unless otherwise noted": the planner's not-required value.
  assert.equal(PLANNER_EVENTS.find(row => row.id === calligraphy.id)?.planning?.reservation, 'optional');
  // The Invitational's Sunday: 12:00–17:30 (the English round list's "12:00 a.m." is a typo; the ICS and the Chinese list say noon).
  const xiangqi = event('sfpl-main-california-xiangqi-invitational-nov28-2026');
  assert.deepEqual(xiangqi.occurrenceDates, ['2026-11-28', '2026-11-29']);
  assert.equal(xiangqi.endDate, '2026-11-29');
  assert.deepEqual(xiangqi.sessions?.find(session => session.date === '2026-11-29'), { date: '2026-11-29', start: '12:00', end: '17:30' });
  assert.deepEqual(PLANNER_EVENTS.find(row => row.id === xiangqi.id)?.planning?.schedule?.sessions?.map(session => session.date), ['2026-11-28', '2026-11-29']);
  // D12: the schedule keeps its 10-14 check date; the lane's 10-16 read of the second day is in the ledger.
  assert.equal(PLANNER_EVENTS.find(row => row.id === xiangqi.id)?.planning?.schedule?.verifiedAt, '2026-10-14');
  // Chinatown Creative Saturdays: the practice is self-guided and nobody teaches. W6C-INT: CNT-WEEKEND-1107 read the
  // Cantonese/Mandarin line as the library's Chinese-programs category footer (each page says programs are in English unless
  // noted), so all three summaries say only that the library lists it among its Chinese programs (the less-claiming wording).
  for (const id of ['sfpl-chinatown-creative-saturdays-fall-2026', 'sfpl-chinatown-creative-saturdays-late-nov-2026', 'sfpl-chinatown-creative-saturdays-dec-2026']) {
    assert.match(event(id).summary, /图书馆把它列在中文活动类别里/u, id);
    assert.doesNotMatch(event(id).summary, /以粤语和普通话进行|活动语言标为/u, id);
  }
});

test('CHSA roots seminar: no broken short link, the flyer’s registration page and room, no geocoded Foster City address', () => {
  const roots = event('chsa-taiwanese-chinese-roots-seminar-2026');
  const text = strings(roots).join(' ');
  assert.doesNotMatch(text, /tinyurl/iu, 'the CHSA short link redirects to an unrelated page');
  assert.match(roots.plan.join(''), /LoveBoatAlumni\.org\/roots2026/u);
  // The organizers' flyer (the official image on the page) names the room and street; the CHSA page names only the center and
  // the city's pages disagree on the center's buildings, so the flyer is quoted in the plan and no structured address is added.
  assert.match(roots.plan[0], /Wind Room/u);
  assert.match(roots.plan[0], /1000 E Hillsdale Blvd/u);
  assert.doesNotMatch(text, /没写具体哪栋楼|no building or street number/u, 'the flyer does give the room and street');
  assert.equal(roots.address, undefined, 'no structured address while the city pages conflict');
  assert.ok(roots.plan.length <= 4);
});

test('dated offers: sold-out batches, booking text and year-round terms follow the pages of 2026-10-16', () => {
  const cal = offer('berkeley-cal-golden-bear-oct-sale-2026');
  assert.match(cal.description, /10\/23、24、25、28 四场都已售完/u);
  assert.doesNotMatch(cal.description, /10\/24 和 11\/1 仍有票/u);
  const mammal = offer('marine-mammal-center-free');
  assert.doesNotMatch(mammal.description, /Eventbrite|10\/12|尚待开放/u, 'the ticket migration note is gone from the homepage');
  assert.doesNotMatch(mammal.sourceLabel, /迁移/u, 'the source line no longer cites a migration notice');
  const mod = offer('mod-pizza-kids-sundays-2026');
  assert.doesNotMatch(mod.dateLabel, /10 月余下/u, 'Sundays year round, not an October-only offer');
  // "Year Round" is the deal page's wording; the 6/15 terms say only "Valid on Sundays" and may end at any time.
  assert.match(mod.dateLabel, /官网写全年每周日，条款未写截止日/u);
  assert.match(mod.description, /2026\/2\/22/u, 'the stale end line is named as a conflict');
  const opera = offer('sf-opera-dolby-figaro-offer-2026');
  assert.match(opera.requirement, /94000–95999/u);
  assert.match(opera.requirement, /只能用于一场演出/u);
  assert.match(offer('homedepot-monthly-kids-workshops').description, /11\/21 和 12\/5 两场要到 11\/7 才开放报名/u);
});

test('openings: status and first day only where a page says so; conflicts stay visible', () => {
  const millbrae = opening('millbrae-cafe-announced-2026');
  assert.equal(millbrae.status, 'open');
  assert.equal(millbrae.openedOn, undefined, 'the site lists hours, not a first day');
  // Bruma and Florecita: the 10-16 reads stay in the ledger, but the status flip waits for the 3D city's opening signs
  // (tests/opus-bay-w6-s-openings.test.ts: every open San Francisco opening has a sign). Owner decision 2026-10-17: until
  // then the text is worded as announced, so it agrees with the 即将开业 chip, and names the 10/16 check date.
  for (const id of ['bruma-ritz-carlton-sf', 'florecita-mission']) {
    const shop = opening(id);
    assert.equal(shop.status, 'announced', id);
    assert.match(shop.dateLabel, /以(?:酒店)?官网为准（10\/16 核对）/u, id);
    assert.doesNotMatch(`${shop.dateLabel}${shop.summary}${shop.editorTip}`, /newly opened|已迁到|去新址|已开业|周四至周一 8:00–14:00|11:30–23:00/u, id);
  }
  assert.match(opening('bruma-ritz-carlton-sf').summary, /计划开门日是 10\/12/u);
  assert.match(opening('florecita-mission').summary, /3349 23rd Street/u);
  for (const id of ['bruma-ritz-carlton-sf', 'florecita-mission', 'shinka-the-jay-announced', 'marufuku-burlingame-announced', 'millbrae-cafe-announced-2026']) {
    assert.equal(OPENING_OVERLAY[id]?.openedOn ?? undefined, id === 'marufuku-burlingame-announced' ? '2026-10-11' : undefined, `${id}: no invented first day`);
  }
  const shinka = opening('shinka-the-jay-announced');
  assert.match(shinka.summary, /官网已列出营业时间/u);
  assert.match(shinka.summary, /Coming Soon/u);
  assert.match(opening('marufuku-burlingame-announced').summary, /两处说法不一/u);
  // Delage: "Open Monday - Saturday" leaves Sunday unlisted, not closed; the 9/29 check date stays (D12).
  const delage = VERIFIED_PLACE_SCHEDULES['opening-oakland-delage-reopening-2026'];
  assert.equal(delage.weekly?.[0], undefined);
  assert.equal(delage.verifiedAt, '2026-09-29');
  assert.match(opening('oakland-delage-reopening-2026').editorTip, /周日没有列/u);
  assert.doesNotMatch(opening('oakland-delage-reopening-2026').editorTip, /周日不营业/u);
  assert.deepEqual(delage.weekly?.[1]?.map(window => `${window.open}-${window.close}`), ['11:30-14:30', '17:00-21:00']);
  assert.match(opening('broken-dreams-oakland').editorTip, /12:00 开门.*11:00/u);
  assert.match(opening('roundup-alesta-sebastopol-2026').editorTip, /每天营业/u);
  assert.doesNotMatch(opening('roundup-alesta-sebastopol-2026').editorTip, /周一休息/u);
  // Old Post Office: brunch had been announced from Sunday 10/18, so a Saturday 10/17 visit is still a phone call.
  assert.match(opening('old-post-office-burlingame').editorTip, /10\/17 周六.*650-502-1000/u);
  // 55 Coffee: a pop-up known from an Instagram post and a 9/16 report keeps its status but says it may have ended.
  assert.equal(opening('oakland-55-coffee-pop-up-2026').status, 'open');
  assert.match(opening('oakland-55-coffee-pop-up-2026').editorTip, /快闪店，目前找不到官方页面确认仍在营业/u);
});

test('every string this lane added reads in English without Chinese', async () => {
  await loadLocale('en');
  const ids = { events: [...supplyEvents1016.map(item => item.id), 'sfpl-main-california-xiangqi-invitational-nov28-2026', 'chsa-taiwanese-chinese-roots-seminar-2026'],
    offers: ['berkeley-cal-golden-bear-oct-sale-2026', 'marine-mammal-center-free', 'mod-pizza-kids-sundays-2026', 'sf-opera-dolby-figaro-offer-2026', 'homedepot-monthly-kids-workshops'],
    openings: ['bruma-ritz-carlton-sf', 'millbrae-cafe-announced-2026', 'florecita-mission', 'shinka-the-jay-announced', 'old-post-office-burlingame', 'ignite-san-pedro-square', 'oakland-delage-reopening-2026', 'pittsburg-nekter-opening-2026', 'oakland-55-coffee-pop-up-2026'] };
  const texts = [
    ...ids.events.flatMap(id => { const item = event(id); return [item.title, item.dateLabel, item.costLabel, item.summary, item.venue, ...item.plan, ...item.audience, item.shortTitle ?? '', item.dek ?? '']; }),
    ...ids.offers.flatMap(id => strings(OFFER_OVERLAY[id]?.fix)),
    ...ids.openings.flatMap(id => strings(OPENING_OVERLAY[id]?.fix)),
    ...ids.events.flatMap(id => strings(EVENT_OVERLAY[id]?.fix)),
    offer('marine-mammal-center-free').sourceLabel, `${offer('marine-mammal-center-free').brand}：${offer('marine-mammal-center-free').sourceLabel}`,
  ].filter(text => HAN.test(text));
  assert.ok(texts.length > 40);
  for (const text of texts) assert.doesNotMatch(translateText(text, 'en'), HAN, text);
});
