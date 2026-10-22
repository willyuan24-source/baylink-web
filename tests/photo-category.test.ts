import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PHOTO_CATEGORIES, PHOTO_CATEGORY_IDS, bulletinPhotoCategory, eventPhotoCategory, guidePhotoCategory, isPhotoCategoryId,
  offerPhotoCategory, openingPhotoCategory, photoCategoryOf, type PhotoCategoryId,
} from '../src/lib/photo-category';
import overrideFile from '../src/data/photo-category-overrides.json';
import type { EventsBoards, EventsIndex, EventsLater } from '../src/features/events/events-index-types';

// UI9-IMAGES (DECISIONS 22 ③, 24): every record on the shelf — the route's events, events-later, every offer, new shop,
// bulletin and guide, not only this window's — falls into a stock-photo pool, so no card can end up without a picture.
const generated = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/generated/${name}`, import.meta.url), 'utf8'));
const index = generated('events-index.json') as EventsIndex;
const later = generated('events-later.json') as EventsLater;
// UI9-IMG-A1b: the boards' offers and new shops are in events-boards.json.
const boards = generated('events-boards.json') as EventsBoards;
const guides = (generated('guides-index.json') as { guides: { slug: string; title: string; category: string }[] }).guides;

test('the category list is closed: unique ids, every label in three languages', () => {
  assert.deepEqual(PHOTO_CATEGORIES.map(c => c.id), [...PHOTO_CATEGORY_IDS]);
  for (const c of PHOTO_CATEGORIES) {
    assert.ok(c.zh && c.zhHant && c.en, c.id);
    if (c.season) assert.match(`${c.season.from} ${c.season.through}`, /^\d\d-\d\d \d\d-\d\d$/, c.id);
  }
});

test('every live record has a photo category (add a rule or an override when this fails)', () => {
  const missing: string[] = [];
  const check = (label: string, category: PhotoCategoryId | undefined) => { if (!category) missing.push(label); };
  const events = [...index.events, ...later.events];
  assert.ok(events.length > 100 && boards.offers.length > 50 && guides.length > 50, 'the generated catalog is loaded');
  for (const e of events) check(`event:${e.id} ${e.title}`, eventPhotoCategory(e));
  for (const o of boards.offers) check(`offer:${o.id} ${o.brand} ${o.title}`, offerPhotoCategory(o));
  for (const o of boards.openings) check(`opening:${o.id} ${o.name} ${o.category}`, openingPhotoCategory(o));
  for (const b of index.bulletins) check(`bulletin:${b.id} ${b.title}`, bulletinPhotoCategory(b));
  for (const g of guides) check(`guide:${g.slug}`, guidePhotoCategory(g));
  assert.deepEqual(missing, []);
});

test('the override table names known kinds and categories', () => {
  for (const [key, value] of Object.entries((overrideFile as { overrides: Record<string, string> }).overrides)) {
    assert.match(key, /^(event|offer|opening|guide|bulletin):\S+$/, key);
    assert.ok(isPhotoCategoryId(value), `${key} → ${value}`);
  }
});

test('the rules put typical records in the pool their picture shows', () => {
  const ev = (title: string, venue = '', extra: object = {}) => eventPhotoCategory({ id: 't', title, venue, ...extra });
  assert.equal(ev('Cupertino 图书馆周六亲子故事时间', 'Cupertino 图书馆 101 室', { category: 'family' }), 'storytime');
  assert.equal(ev('San Leandro 图书馆万圣节故事与讨糖', 'Main Library', { category: 'family' }), 'halloween', 'season first');
  assert.equal(ev('感恩节 Silicon Valley Turkey Trot：圣何塞市中心 5K'), 'fun-run', 'a Turkey Trot is a run');
  assert.equal(ev('2027 旧金山华埠春节花市', '华埠 Grant Ave'), 'lunar-new-year');
  assert.equal(ev('圣何塞 Sharks 对 Canucks：常规赛', 'SAP Center', { kind: 'sports' }), 'sports-hockey');
  assert.equal(ev('The Smashing Pumpkins：The Rats In a Cage', 'SAP Center', { kind: 'performance' }), 'concert');
  assert.equal(ev('Berkeley 市中心周六农夫市集：12 月加开手作礼物', '', { category: 'food' }), 'farmers-market');
  assert.equal(ev('Mare Island 成人创作工作坊', 'Mare Island Art Studios', { category: 'family' }), 'class-workshop');
  assert.equal(offerPhotoCategory({ id: 't', brand: 'SFMTA · SAN FRANCISCO', title: '18 岁及以下乘 Muni 常规公交和轻轨免费' }), 'transit');
  assert.equal(offerPhotoCategory({ id: 't', brand: 'DUTCH BROS', title: '生日领一杯饮品，券可用 30 天' }), 'birthday-perk');
  assert.equal(offerPhotoCategory({ id: 't', brand: 'ASIAN ART MUSEUM · SF', title: '11/1 亚洲艺术博物馆普通入场免费' }), 'museum');
  assert.equal(openingPhotoCategory({ id: 't', name: 'Ceré Tea', category: '抹茶与焙茶饮品', openingType: 'new-restaurant' }), 'cafe-tea');
  assert.equal(openingPhotoCategory({ id: 't', name: 'Varley', category: '针织与运动女装', openingType: 'new-store' }), 'shopping');
  assert.equal(guidePhotoCategory({ slug: 'bart-october-access-parking-update-2026' }), 'transit');
  assert.equal(guidePhotoCategory({ slug: 'bay-area-chinese-senior-services-referral-guide', category: 'service' }), 'seniors');
  assert.equal(guidePhotoCategory({ slug: 'some-new-rent-guide', category: 'rent' }), 'guide-housing', 'falls back to the guide category');
});

test('a guide is read by its slug whether the record calls it slug or id (candidates, report:covers, the home rail)', () => {
  assert.equal(photoCategoryOf('guide', { id: 'bart-october-access-parking-update-2026' }), 'transit');
  assert.equal(photoCategoryOf('guide', { slug: 'bart-october-access-parking-update-2026' }), 'transit');
  assert.equal(photoCategoryOf('guide', { id: 'some-new-rent-guide', category: 'rent' }), 'guide-housing');
});

// DECISIONS 24: a seasonal picture only for a record that happens in that season, and never a 21+ picture on a family card.
const SEASONS = new Map(PHOTO_CATEGORIES.filter(c => c.season).map(c => [c.id, c.season!]));
const inSeason = (day: string, season: { from: string; through: string }) => {
  const md = day.slice(5, 10);
  return season.from <= season.through ? md >= season.from && md <= season.through : md >= season.from || md <= season.through;
};
const daysOf = (e: { startDate?: string; endDate?: string; occurrenceDates?: readonly string[] }) => {
  const days = [...(e.occurrenceDates ?? [])];
  if (e.startDate) {
    const end = Date.parse(`${e.endDate || e.startDate}T12:00:00Z`);
    for (let t = Date.parse(`${e.startDate}T12:00:00Z`), n = 0; t <= end && n < 400; t += 86_400_000, n++) days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
};

test('every record in a seasonal pool has a day in that season, and no family event gets the 21+ pool', () => {
  const wrong: string[] = [];
  for (const e of [...index.events, ...later.events]) {
    const category = eventPhotoCategory(e);
    const season = category && SEASONS.get(category);
    if (season && !daysOf(e).some(day => inSeason(day, season))) wrong.push(`${category} ${e.id} ${e.startDate}..${e.endDate}`);
    if (category === 'wine-beer' && e.category === 'family') wrong.push(`wine-beer on a family event: ${e.id}`);
  }
  assert.deepEqual(wrong, []);
  assert.notEqual(eventPhotoCategory({ id: 't', title: 'Petaluma Cider Circus 苹果酒与河畔游园', category: 'family' }), 'wine-beer');
});
