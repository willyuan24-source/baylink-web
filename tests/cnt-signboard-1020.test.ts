import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { currentOpenings } from '../src/data/local-discoveries';
import { OPENING_OVERLAY } from '../src/data/editorial-overlay/apply';
import { BASIS_FIELDS, readEnglishSources } from '../src/data/editorial-overlay/lint';
import basis from '../src/data/editorial-overlay/basis.json';
import { getGuideBySlug } from '../src/data/guides';
import elderEnglish from '../src/data/guides-refresh-2026-10-14-en.json';

/**
 * CNT-SIGNBOARD (2026-10-19/20 PT reads, docs/source-reads-2026-10.md "CNT-SIGNBOARD"): a new shop's card prints its
 * `category` — what the shop sells — in line 2 (BoardCards.tsx OpeningMeta; the UI9-C shop sign cover is gone, UI9-IMAGES
 * DECISIONS 21), in English from the dictionary. Each category was written from the shop's own page (or, for press-only records, the report) read that night.
 */
const english = readEnglishSources(path => readFileSync(path, 'utf8'));
const opening = (id: string) => { const found = currentOpenings.find(item => item.id === id); assert.ok(found, id); return found; };
/** rhone.com answered only with a bot check (Cloudflare) on 10-19/20, so its sign keeps the generic label for now. */
const UNREAD = new Set(['santa-clara-rhone-valley-fair-new-store-2026']);
/** Words that belong to the status chip or the date, not to "what it sells". */
const STATUS_WORDS = /预告|開業|开业|已营业|营业|新店|新餐厅|新概念|迁址|重开|快闪|零售|餐饮新店/u;

test('every opening the sign can show says what the shop sells, in at most 7 字 (one line on a phone sign) and 8 English words', () => {
  // 60 openings on 10-20; a later content lane that adds one gives it a reviewed sign too.
  assert.ok(currentOpenings.length >= 60, `${currentOpenings.length} openings`);
  for (const shop of currentOpenings) {
    if (UNREAD.has(shop.id)) continue;
    assert.equal(OPENING_OVERLAY[shop.id]?.fix?.category, shop.category,
      `${shop.id}: a new opening needs a reviewed overlay fix.category (what it sells, at most 7 字, plus English in editorial-overlay-en.json) for the shop sign`);
    assert.ok([...shop.category].length <= 7, `${shop.id}: ${shop.category} (the brief allows 12 字; 7 keeps the 390px sign on one line)`);
    assert.doesNotMatch(shop.category, STATUS_WORDS, `${shop.id}: ${shop.category} is a status, not what it sells`);
    const en = english[shop.category];
    assert.ok(en, `${shop.id}: no English for ${shop.category}`);
    assert.ok(en.split(/\s+/u).length <= 8 && !/[㐀-鿿]/u.test(en), `${shop.id}: ${en}`);
  }
  assert.equal(opening('marufuku-burlingame-announced').category, '博多豚骨拉面');
  assert.equal(english['博多豚骨拉面'], 'Hakata tonkotsu ramen');
  assert.equal(opening('mess-hall-presidio-breadwinner').category, '汉堡与三明治');
  // Re-measured on the whole board at 390px (review 10-20): these four took 3 lines in English, so they were shortened.
  assert.equal(english['女装与鞋履'], "Women's wear and shoes");
  assert.equal(english['新派粤菜'], 'Modern Cantonese food');
  assert.equal(english['酸奶冰沙与甜品'], 'Yogurt drinks and desserts');
  assert.equal(english['现代美式菜'], 'Modern American food');
});

test('every opening fix field has a basis hash, so a later upstream edit of that field is reported by the lint', () => {
  const recorded = basis as Record<string, Record<string, string>>;
  for (const [id, entry] of Object.entries(OPENING_OVERLAY)) {
    for (const field of Object.keys(entry.fix ?? {})) {
      assert.ok((BASIS_FIELDS.opening as readonly string[]).includes(field), `${id}: fix.${field} is not tracked`);
      assert.ok(recorded[`opening:${id}`]?.[field], `${id}: fix.${field} has no hash in basis.json (re-record it with --write-basis=opening:${id})`);
    }
  }
});

test('a record whose only source is a press report says 媒体报道 in its source label; official pages are not called press', () => {
  // The cards print 「媒体报道 · M/D 核对」 for these (UI-9 DECISIONS 17): the label is the card's signal.
  for (const id of ['hedley-club', 'woods-wharf']) assert.match(opening(id).sourceLabel, /^媒体报道 · /u, id);
  assert.equal(opening('hedley-club').sourceUrl, 'https://sf.eater.com/restaurant-news/213458/hedley-club-palm-court-hotel-de-anza-opening-san-jose');
  // KAIYŌ's own site and Marin Country Mart's store pages are official pages, not press.
  for (const id of ['kaiyo-handroll-union', 'anya-gifting-larkspur', 'margaux-larkspur', 'varley-larkspur']) {
    const shop = opening(id);
    assert.doesNotMatch(shop.sourceLabel, /媒体报道/u, id);
    assert.equal(shop.sourceUrl, shop.officialUrl, `${id}: the source is the official page`);
  }
  for (const shop of currentOpenings) {
    if (shop.sourceLabel.startsWith('媒体报道')) assert.notEqual(shop.sourceUrl, shop.officialUrl, `${shop.id}: a press label on an official source`);
    assert.ok(english[shop.sourceLabel] || !/[㐀-鿿]/u.test(shop.sourceLabel), `${shop.id}: English for ${shop.sourceLabel}`);
  }
});

test('the status and date lines follow the pages read on 10-19/20; no first day is invented and no status is guessed', () => {
  const marufuku = opening('marufuku-burlingame-announced');
  assert.equal(marufuku.status, 'open');
  assert.equal(marufuku.openedOn, '2026-10-11', 'the earlier store-page read (10-13) stays; the store page no longer prints the day');
  assert.match(marufuku.summary, /now open in BURLINGAME/u);
  assert.match(marufuku.summary, /Coming Soon/u);
  const cere = opening('berkeley-cere-tea-opening-2026');
  assert.equal(cere.status, 'soft_open');
  assert.match(cere.dateLabel, /Soft Opening Special/u);
  const messHall = opening('mess-hall-presidio-breadwinner');
  assert.equal(messHall.status, 'open');
  assert.match(messHall.summary, /Dayboat Seafood（海鲜）已开始供应/u);
  assert.match(messHall.summary, /Boda 仍标 Coming Soon/u);
  assert.doesNotMatch(messHall.summary, /Dayboat Seafood 仍标记即将开放/u);
  // The menu page lists 7:00–10:00 breakfast, the home page says 11:00: the tip says the two disagree.
  assert.match(messHall.editorTip, /菜单页另列 7:00–10:00 早餐，但官网首页只写 11:00 起供应/u);
  // Hedley Club: Eater's preview said September; no page read proves the reopening, so it stays announced.
  assert.equal(opening('hedley-club').status, 'announced');
  // BitterBuck: its site lists regular hours but does not say the soft opening ended.
  assert.equal(opening('san-jose-bitterbuck-soft-opening-2026').status, 'soft_open');
});

test('the senior transit guide names VTA ACCESS (vta.org read 10-20): eligibility and trip booking are two lines', () => {
  const guide = getGuideBySlug('bay-area-senior-transit-clipper-discounts-guide')!;
  const ada = guide.blocks.find(block => block.type === 'paragraph' && block.text.includes('VTA ACCESS'));
  assert.ok(ada && ada.type === 'paragraph');
  assert.match(ada.text, /申请资格打 \(408\) 321-2381/u);
  assert.match(ada.text, /提前 1–3 天打 \(408\) 321-2380 预约行程（8:00 到 17:00 前）/u);
  assert.doesNotMatch(ada.text, /中文(?:电话|服务|热线)/u, 'the Chinese is the application form, not phone service');
  assert.match((elderEnglish as Record<string, string>)[ada.text] ?? '', /\(408\) 321-2380/u);
  assert.ok(guide.sources.some(source => source.url === 'https://www.vta.org/programs/access'));
});
