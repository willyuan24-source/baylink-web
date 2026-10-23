import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import '../src/i18n/router';
import { setLocale } from '../src/i18n/locale';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import type { WeekendPickEntry } from '../src/data/weekend-picks';
import { coverItemFor, createCoverPage, getCover, resolveCovers, type CoverAsset, type CoverItem } from '../src/lib/cover';
import { CLOSE_UP_FACE_IMAGES, NOT_FOR_LEAD, POSED_GROUP_IMAGES, RELEASED_CLOSE_UPS, leadImageKey } from '../src/lib/close-up-faces';
import { isLeadPicture, leadItem, leadsWithPicture } from '../src/lib/lead-rule';
import { BOARD_STOCK, COVER_TABLES, DENSE_STOCK, MACRO_STOCK, ROUTE_STOCK, coverCandidates, routeStock, sceneFirst } from '../src/lib/cover-candidates';
import { buildCanLead, getBuildWeekend } from '../src/lib/home-weekend-build';

/**
 * UI9-R2-COVER-PICK (round-2 cold review R2-02 / R2-05, UI-9 DECISIONS 32): lead slots take only a ① or ② photograph; a
 * stock picture is not repeated in one list while an item has another; macro and texture stock never comes first.
 */
const today = '2026-10-23';
const context = { images: GUIDE_IMAGES, today };
// Real registry keys (fixed files): an official photo, two flyers, a posed group, a venue photo and two stock pictures.
const PHOTO = 'official-oakland-omca-dia-muertos-2026';
const POSTERS = ['official-acl-cherryland-chinese-storytimes-oct24-2026', 'official-windsor-trick-or-treat-trail-2026', 'official-sf-world-of-dumplings-2026'];
const GROUP = 'official-sjpl-almaden-sounds-of-south-asia-2026';
const VENUE = 'roundup-chase-center';

test('DECISIONS 32: a lead slot takes a ① or ② photograph only; a flyer, a close-up or a posed group stays a card', () => {
  assert.equal(leadsWithPicture({ id: 'x-photo', imageKey: PHOTO }, context), true, 'an official photo leads');
  assert.equal(getCover(leadItem({ id: 'x-photo', imageKey: PHOTO }), context).tier, 'official');
  for (const key of POSTERS) {
    const record = { id: `x-${key}`, imageKey: key, imageKeys: [key, 'stock-storytime-3'] };
    assert.equal((GUIDE_IMAGES[key] as CoverAsset).kind, 'poster', `${key} is a flyer`);
    assert.equal(leadsWithPicture(record, context), false, `${key}: a flyer never leads`);
    assert.equal(getCover(coverItemFor('event', record), context).tier, 'official', `${key}: its card keeps the flyer`);
    const slot = getCover(leadItem(record), context);
    assert.equal(slot.tier, 'stock', `${key}: forced into a lead slot, it draws its next candidate`);
    const alone = getCover(leadItem({ id: record.id, imageKey: key }), context);
    assert.equal(alone.tier === 'type' && alone.reason, 'not-a-photo', `${key}: a lead never shows the flyer`);
  }
  // The six close-ups the owner released (10-21) stay released for cards, rows and detail pages, and never lead.
  assert.equal(RELEASED_CLOSE_UPS.size, 6);
  for (const key of [...CLOSE_UP_FACE_IMAGES, ...POSED_GROUP_IMAGES]) {
    const record = { id: `x-${key}`, imageKey: key };
    assert.ok(NOT_FOR_LEAD.has(key));
    assert.equal(leadImageKey(key), undefined, `${key}: the lead slot skips it`);
    assert.equal(leadsWithPicture(record, context), false, `${key}: never a lead`);
    assert.notEqual(getCover(coverItemFor('event', record), context).tier, 'type', `${key}: its card keeps the picture`);
  }
  assert.ok(POSED_GROUP_IMAGES.has(GROUP), 'the Almaden stage line-up is a posed group');
  // A flyer pick with a venue photo stays a card (OD2: the next pick with a photograph leads), and an event with no usable
  // picture of its own leads with its venue photo.
  assert.equal(leadsWithPicture({ id: 'x-flyer-venue', imageKey: POSTERS[0], imageKeys: [POSTERS[0], VENUE] }, context), false);
  assert.equal(leadsWithPicture({ id: 'x-venue', imageKeys: [VENUE] }, context), true);
  assert.equal(leadsWithPicture({ id: 'x-own-stock', imageKey: 'stock-halloween-1', imageKeys: ['stock-halloween-1', VENUE] }, context), false, 'an own ③ key stops a lead (the slot draws it first)');
  assert.equal(isLeadPicture(getCover(coverItemFor('event', { id: 'x-stock', imageKeys: ['stock-halloween-1'] }), context)), false, 'a ③ picture is no lead picture');
});

test('the home lead (getBuildWeekend): the editor\'s first pick with a photograph leads; the flyer and close-up picks follow as cards', () => {
  // The 10/24–25 weekend as the editor listed it on 10-21: two flyers and a close-up before the OMCA photo.
  const ids = ['acl-cherryland-chinese-storytimes-oct24-2026', 'r2-petaluma-lumafest-20261024', 'sf-financial-planning-day-oct24-2026', 'oakland-omca-dia-muertos-2026'];
  const list = { '2026-10-24': ids.map(id => ({ id, reason: { zh: `理由 ${id}`, en: `Reason ${id}` } })) as WeekendPickEntry[] };
  const weekend = getBuildWeekend(today, MONTHLY_EVENTS, list);
  assert.deepEqual(weekend.picks.map(pick => [pick.event.id, pick.editorial?.rank]), [[ids[3], 4], [ids[0], 1], [ids[1], 2]]);
  assert.ok(buildCanLead(weekend.picks[0].event, today));
  for (const pick of weekend.picks.slice(1)) assert.equal(buildCanLead(pick.event, today), false, `${pick.event.id}: a card, not a lead`);
  // It heads the feed the home shows (its first card, or its second when it has no picture): /plan's fourth card.
  assert.ok(weekend.feed.slice(0, 2).some(entry => entry.event.id === ids[2]), 'the third pick heads the feed');
  assert.equal(new Set([...weekend.picks, ...weekend.feed].map(entry => entry.event.id)).size, weekend.picks.length + weekend.feed.length, 'each event once');
});

test('the /events lead (arrangePicks) and each /calendar day lead (canLead) take the first event with a photograph', async () => {
  const { arrangePicks, canLead } = await import('../src/features/events/weekend-lead');
  const { INDEX_EVENTS } = await import('../src/features/events/events-model');
  const base = INDEX_EVENTS[0];
  const event = (id: string, imageKey?: string) => ({ ...base, id, imageKey: imageKey as string, imageKeys: undefined });
  const pick = (item: ReturnType<typeof event>) => ({ event: item, date: today });
  const [flyer, face, group, photo] = [pick(event('p-flyer', POSTERS[1])), pick(event('p-face', [...CLOSE_UP_FACE_IMAGES][0])), pick(event('p-group', GROUP)), pick(event('p-photo', PHOTO))];
  for (const item of [flyer, face, group]) assert.equal(canLead(item.event, today), false, item.event.id);
  assert.equal(canLead(photo.event, today), true);
  assert.deepEqual(arrangePicks([flyer, face, group, photo], today, undefined, []), { lead: photo, rows: [flyer, face, group] });
  // No pick has a photograph: the ranking's first event that has one leads, every pick stays a row.
  const ranked = [event('r-flyer', POSTERS[2]), event('r-photo', PHOTO)];
  assert.equal(arrangePicks([flyer, face], today, undefined, ranked).lead?.event.id, 'r-photo');
});

test('/plan\'s first pick and the home lead in the generated snapshots are lead photographs', () => {
  const catalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { weekends: Record<string, { ids: string[] }>; events: { id: string; imageKey?: string; imageKeys?: string[] }[] };
  const plan = JSON.parse(readFileSync('src/data/generated/plan-weekend.json', 'utf8')) as { days: Record<string, { entries: { id: string }[] }>; events: Record<string, { id: string; imageKey?: string; imageKeys?: string[] }> };
  const byId = new Map(catalog.events.map(event => [event.id, event]));
  // Snapshot days whose weekend has no lead photograph among its events (getBuildWeekend then keeps the picks as they are).
  // Empty on 10-23 (10/23–11/19 checked); a day added here must name the weekend and why.
  const NO_LEAD_PHOTOGRAPH = new Set<string>();
  let days = 0;
  for (const [day, snapshot] of Object.entries(catalog.weekends)) {
    if (NO_LEAD_PHOTOGRAPH.has(day)) continue;
    const lead = byId.get(snapshot.ids[0]);
    assert.ok(lead && leadsWithPicture(lead, { images: GUIDE_IMAGES, today: day }), `${day}: the home lead ${snapshot.ids[0]} is a lead photograph`);
    days++;
    const first = plan.days[day]?.entries[0];
    if (!first) continue;
    assert.equal(first.id, lead.id, `${day}: /plan opens with the home's lead`);
    const shown = getCover(coverItemFor('event', { ...plan.events[first.id], id: first.id }), { images: GUIDE_IMAGES, today: day });
    assert.ok(isLeadPicture(shown), `${day}: /plan's first pick shows a lead photograph (${shown.tier})`);
  }
  assert.ok(days > 0, 'snapshot days checked');
});

test('R2-05: a ③ picture is not shown twice on one page while an item has a candidate the page has not shown', () => {
  const stock = (n: number): CoverAsset => ({ ...(GUIDE_IMAGES['stock-halloween-1'] as CoverAsset), src: `/guides/test/pool-${n}.webp` });
  const images = { a: stock(1), b: stock(2), c: stock(3), d: stock(4) };
  const items: CoverItem[] = ['one', 'two', 'three', 'four'].map((id, i) => ({ kind: 'event', id, imageKeys: [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']][i] }));
  for (const page of [createCoverPage(), createCoverPage({ fresh: true })]) {
    const srcs = resolveCovers(items, { images, today, page }).map(cover => cover.tier === 'stock' ? cover.image.src : cover.tier);
    assert.equal(new Set(srcs).size, 4, `four cards, four pictures: ${srcs.join(' ')}`);
  }
  // Every candidate already shown: the item repeats the one shown farthest away, never an empty frame.
  const five = [...items, { kind: 'event', id: 'five', imageKeys: ['a', 'd'] } as CoverItem];
  const last = resolveCovers(five, { images, today, page: createCoverPage() })[4];
  assert.equal(last.tier === 'stock' && last.image.src, images.a.src);
});

test('R2-05: a list deals its ③ pictures first, so a card taking its first new picture leaves no later card without one', () => {
  const stock = (n: number): CoverAsset => ({ ...(GUIDE_IMAGES['stock-halloween-1'] as CoverAsset), src: `/guides/test/halloween-${n}.webp` });
  const images = Object.fromEntries([1, 2, 3, 4, 6].map(n => [`h${n}`, stock(n)]));
  // The 10/24 calendar's five Halloween cards and the candidates the route shipped them: one card after another, the
  // Monster Mash found all three of its pictures on the page (a repeat) while h3 stayed unused.
  const sets = [['h2', 'h3', 'h4'], ['h6', 'h1', 'h2'], ['h1', 'h2', 'h3'], ['h6', 'h1', 'h2'], ['h6', 'h4', 'h1']];
  const items: CoverItem[] = sets.map((imageKeys, i) => ({ kind: 'event', id: `halloween-${i}`, imageKeys }));
  const srcs = (covers: ReturnType<typeof resolveCovers>) => covers.map(cover => cover.tier === 'stock' ? cover.image.src : cover.tier);
  const page = createCoverPage();
  const greedy = items.map(item => getCover(item, { images, today, page }));
  assert.equal(new Set(srcs(greedy)).size, 4, 'one card after another: a repeat');
  const dealt = srcs(resolveCovers(items, { images, today, page: createCoverPage() }));
  assert.equal(new Set(dealt).size, 5, `dealt: five cards, five pictures (${dealt.join(' ')})`);
  // A lead keeps its first picture (the hero-size one); cards resolved by an earlier call on the page keep theirs.
  const lead: CoverItem = { kind: 'event', id: 'lead', imageKeys: ['h6', 'h1'], lead: true };
  const withLead = resolveCovers([lead, ...items], { images, today, page: createCoverPage() });
  assert.equal(withLead[0].tier === 'stock' && withLead[0].image.src, images.h6.src);
  const shared = createCoverPage();
  const first = srcs(resolveCovers(items.slice(0, 2), { images, today, page: shared }));
  const rest = srcs(resolveCovers(items.slice(2), { images, today, page: shared }));
  assert.deepEqual(srcs(resolveCovers(items.slice(0, 2), { images, today, page: shared })), first, 'a card resolved before keeps its picture');
  assert.equal(new Set([...first, ...rest]).size, 5, 'a later call deals what the page has left around the fixed two');
  // More cards than pictures: the cards left over repeat the picture shown farthest away, never an empty frame.
  const many = resolveCovers([...items, ...items.map(item => ({ ...item, id: `${item.id}-again` }))], { images, today, page: createCoverPage() });
  assert.ok(many.every(cover => cover.tier === 'stock'));
  assert.equal(new Set(srcs(many).slice(0, 5)).size, 5);
});

test('R2-05: the boards\' records carry their whole ③ pool; the route\'s events keep their caps (the near window)', () => {
  const record = { id: 'x-offer', brand: 'Test', title: 'Birthday treat' };
  assert.equal(routeStock('offer', record, new Set()).stock, BOARD_STOCK);
  assert.equal(routeStock('opening', { id: 'x-shop', name: 'Test cafe' }, new Set()).stock, BOARD_STOCK);
  assert.ok([ROUTE_STOCK, DENSE_STOCK].includes(routeStock('event', { id: 'x-event', title: 'Storytime' }, new Set()).stock!));
  const boards = JSON.parse(readFileSync('src/data/generated/events-boards.json', 'utf8')) as { offers: { imageKeys?: string[] }[] };
  const stockCounts = boards.offers.map(offer => (offer.imageKeys ?? []).filter(key => key.startsWith('stock-')).length);
  assert.ok(Math.max(...stockCounts) > DENSE_STOCK, `an offer carries its whole pool (${Math.max(...stockCounts)} pictures)`);
});

test('R2-05: macro and texture stock is never a record\'s first ③ candidate while its category has a scene picture', () => {
  const pools = Object.entries(COVER_TABLES.categories) as [string, string[]][];
  const listed = new Set(pools.flatMap(([, keys]) => keys));
  for (const key of MACRO_STOCK) assert.ok(listed.has(key), `${key} is a pool picture`);
  // Every event in the edition, whatever spot its id starts its pool at, and from every spot of its pool (route catalogs).
  const poolOf = new Map(pools.flatMap(([, keys]) => keys.map(key => [key, keys] as const)));
  let checked = 0;
  for (const event of MONTHLY_EVENTS) for (const start of [undefined, 0, 1, 2, 3, 4, 5]) {
    const candidates = coverCandidates('event', event, COVER_TABLES, start === undefined ? {} : { start });
    const first = candidates.find(key => poolOf.has(key));
    if (!first || !poolOf.get(first)!.some(key => !MACRO_STOCK.has(key))) continue;
    checked++;
    assert.equal(MACRO_STOCK.has(first), false, `${event.id} (start ${start}): ${first} comes first`);
  }
  assert.ok(checked > 1000, `${checked} candidate lists checked`);
  assert.deepEqual(sceneFirst(['m1', 'm2', 's1', 'm3', 's2'], new Set(['m1', 'm2', 'm3'])), ['s1', 'm1', 'm2', 'm3', 's2']);
  assert.deepEqual(sceneFirst(['s1', 'm1'], new Set(['m1'])), ['s1', 'm1']);
  assert.deepEqual(sceneFirst(['m1'], new Set(['m1'])), ['m1'], 'a pool of macro pictures only keeps them');
});

test('/ai-in-the-bay: every session card shows a picture, labelled on the picture, with the page\'s image credits', async () => {
  await setLocale('zh-Hans', false, '/ai-in-the-bay');
  const { default: AiLocalPage } = await import('../src/pages/AiLocalPage');
  const html = renderToStaticMarkup(createElement(StaticRouter, { location: '/ai-in-the-bay' }, createElement(AiLocalPage, { today: '2026-10-05' })));
  const document = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
  const cards = [...document.querySelectorAll('article.bl-ai-event')];
  assert.ok(cards.length > 0, 'sessions listed');
  for (const card of cards) assert.ok(card.querySelector('.bl-ai-event-media img'), `${card.querySelector('h3')?.textContent}: a picture`);
  assert.ok(document.querySelector('#page-credits'), 'the page lists its pictures');
});
