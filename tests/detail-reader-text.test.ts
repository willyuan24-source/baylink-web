import assert from 'node:assert/strict';
import test from 'node:test';
import { localDiscoveries } from '../src/data/local-discoveries';
import { loadLocale, translateText } from '../src/i18n/locale';
import { EDITOR_NOTE_EN, EDITOR_NOTE_ZH, hasEditorNote, readerCost, readerPlanLines, readerProse, readerSentences, TICKETS_BOILERPLATE, withoutEditorNotes } from '../src/features/detail/reader-text';

/**
 * CNT-1011-05 / CNT-1011-06: readers get answers, not the editor's working notes or templated repeats. The filter runs at
 * render time (src/features/detail/reader-text.ts); the lint below keeps new catalog data from adding notes.
 */

test('editor notes and raw URLs leave the reader text; the facts in the same sentence stay', () => {
  assert.equal(withoutEditorNotes('每月第二个周五的艺术漫步现场音乐；本包只录入已明确列出的9月与10月场。', false), '每月第二个周五的艺术漫步现场音乐。');
  assert.equal(withoutEditorNotes('活动在 St. Helena 城外磨坊；选一天10:00–14:00参加，不沿用普通周末闭馆时刻。', false), '活动在 St. Helena 城外磨坊；选一天10:00–14:00参加。', 'a note clause goes, the time stays');
  assert.equal(withoutEditorNotes('新寿司餐厅宣布 9 月 23 日庆祝开业，实际营业状态待复核。', false), '新寿司餐厅宣布 9 月 23 日庆祝开业。');
  assert.equal(withoutEditorNotes('市府公告列明入场免费，水灯体验须购票：https://www.fostercity.org/Calendar.aspx?EID=1142 。主办方另写 8 岁以下免费。', false), '市府公告列明入场免费，水灯体验须购票。主办方另写 8 岁以下免费。', 'a "?" inside a URL is not a sentence end');
  assert.equal(withoutEditorNotes('出行说明：https://djerassi.org/about/directions/ 。最低年龄未确认。', false), '最低年龄未确认。', 'a bare label left by its URL goes too');
  assert.equal(withoutEditorNotes('出发前看主办方更新与 FAQ：https://potrerofestival.com/faq/', false), '出发前看主办方更新与 FAQ。');
  assert.equal(withoutEditorNotes('Price source: https://eventmozo.com/event/x; the ticket page shows whether early-bird prices are still available.', true), 'The ticket page shows whether early-bird prices are still available.');
  assert.equal(withoutEditorNotes('Hours are subject to the store. The brand website corroborates current operation; this is not the founding of the brand.', true), 'Hours are subject to the store. This is not the founding of the brand.');
  assert.equal(withoutEditorNotes('Doors open at 6 p.m. on St. Helena Street. Bring a chair.', true), 'Doors open at 6 p.m. on St. Helena Street. Bring a chair.', 'abbreviations are not sentence ends');
  for (const reader of ['先打 510-597-5089 预约库存。', '核对时间与菜单后再出发。', '免费，1403 Main Street 入口。']) assert.equal(withoutEditorNotes(reader, false), reader, `${reader} is reader text`);
  assert.equal(withoutEditorNotes('本条只收录 10/5 免费场。', false), '');
});

test('English notes go one sentence at a time and only in their editorial forms; reader advice and facts stay', () => {
  // A sentence that ends in a date or a time ends there: the note after it does not take it along.
  assert.equal(withoutEditorNotes('Schedule: October 3. The exact start and end times were not rechecked in this review; see the individual event page or contact the library.', true),
    'Schedule: October 3. See the individual event page or contact the library.');
  assert.equal(withoutEditorNotes('Officially listed drink specials from 15:00–18:00. This entry includes only verified drink offers, not the half-price burgers mentioned in older online posts.', true),
    'Officially listed drink specials from 15:00–18:00.');
  assert.equal(withoutEditorNotes('The official page links to tickets; live seat prices were not rechecked. Every attendee needs a ticket.', true),
    'The official page links to tickets. Every attendee needs a ticket.', 'the sentence before a dropped one ends with a full stop');
  assert.equal(withoutEditorNotes('Doors open at 6 p.m. Bring a chair. The listing was cached.', true), 'Doors open at 6 p.m. Bring a chair.', '"p.m." before a capital ends a sentence');
  assert.equal(withoutEditorNotes('Oct 2 · The exact end time was not rechecked.', true), 'Oct 2', 'a label keeps its part before " · "');
  assert.equal(withoutEditorNotes('10/2 · 电影日落后放映，具体结束时间本次未复核', false), '10/2 · 电影日落后放映。');
  // Reader advice and dated facts that only share a word with a note.
  for (const reader of [
    'Two parallel tracks explore language models, agent security, retrieval and evaluation. The organizer now lists 55 Stockton St in San Francisco.',
    'Buy regular admission through the museum link or bring membership proof, and recheck evening updates before leaving.',
    'Open since June 2026 · Rechecked in September',
    'This venue was operating by June and was rechecked in September.',
    'The previous listing described Free First Fridays, but the event page was unavailable when rechecked on October 2. Ask the museum to confirm admission, hours and eligibility.',
    'When checked, the center was changing ticket systems: dates through October 11 were bookable through Eventbrite, while October 12 onward had not yet opened.',
    'Game tickets and parking are separate, and the final kickoff and entry arrangements should be rechecked before travel.',
    'This is a separate November 7 event; do not reuse October 16 times or registration details.',
    'The brand release states a future plan; the hotel website still says Coming Soon at the time of checking.',
  ]) assert.equal(withoutEditorNotes(reader, true), reader, reader);
});

test('plan lines that only repeat the date or the price go, and a free event never asks to check remaining tickets', () => {
  const event = { dateLabel: '10/12 · 12:00–16:00', costLabel: '免费参加，摊位消费另付', cost: 'free', plan: ['时间安排：12:00–16:00。', '费用与参加条件：免费参加，摊位消费另付', '从 Mission 街入口进场。', TICKETS_BOILERPLATE] };
  assert.deepEqual(readerPlanLines(event), ['从 Mission 街入口进场。']);
  assert.deepEqual(readerPlanLines({ ...event, cost: 'paid' }), ['从 Mission 街入口进场。', TICKETS_BOILERPLATE], 'a ticketed event keeps the ticket line');
  assert.deepEqual(readerPlanLines({ ...event, plan: ['费用与参加条件：免费参加，摊位消费另付 需在官网登记。'] }), ['费用与参加条件：免费参加，摊位消费另付 需在官网登记。'], 'a line that adds a fact stays');
  assert.deepEqual(readerPlanLines({ ...event, tips: ['带折叠椅。'] }), ['带折叠椅。'], 'the editorial overlay\'s tips win');
  assert.equal(readerCost('参考：免费 · 须提前在线报名；最终价格以票页为准', 'free', 'zh-Hans'), '免费 · 须提前在线报名');
  assert.equal(readerCost('参考：$15–27；最终价格以票页为准', 'paid', 'zh-Hans'), '参考：$15–27；最终价格以票页为准', 'a ticketed event keeps its hedge');
});

test('offer conditions and steps read one whole sentence per item', () => {
  assert.deepEqual(readerSentences('已有 Clipper 的申请可能需三周，新卡约四周；获批后再用，补发遗失卡可能收费。', 'zh-Hans'), ['已有 Clipper 的申请可能需三周，新卡约四周。', '获批后再用，补发遗失卡可能收费。'], 'an item cut at "；" ends with "。"');
  assert.deepEqual(readerSentences('Apply onto Senior Clipper; it is not automatically free. Approval takes about three weeks.', 'en'), ['Apply onto Senior Clipper; it is not automatically free.', 'Approval takes about three weeks.']);
});

// Catalog fields a detail page shows. The lint counts note sentences in them; the filter hides them meanwhile.
const FIELDS = ['title', 'dateLabel', 'costLabel', 'summary', 'requirement', 'description', 'editorTip', 'dek', 'dateNote', 'venue', 'address'] as const;
const readerStrings = () => localDiscoveries.flatMap(item => {
  const record = (item.kind === 'event' ? item.event : item.kind === 'offer' ? item.offer : item.shop) as unknown as Record<string, unknown>;
  const fields: [string, string][] = FIELDS.flatMap(field => typeof record[field] === 'string' ? [[`${item.kind}:${record.id}.${field}`, record[field] as string] as [string, string]] : []);
  for (const list of ['plan', 'tips']) if (Array.isArray(record[list])) (record[list] as string[]).forEach((line, index) => fields.push([`${item.kind}:${record.id}.${list}[${index}]`, line]));
  return fields;
});

/**
 * The notes still in the catalog on 10-12 (CNT-1011-05 lists them; the CNT lanes rewrite them into reader text or an
 * internal note). Remove a line here when its data is fixed. A note anywhere else fails: write it for the reader instead.
 */
const KNOWN_NOTES = new Set([
  'event:foster-city-water-lantern-festival-2026.plan[1]', 'event:fremont-fog-diwali-mela-2026.plan[3]', 'event:november-north-bale-old-mill-days-2026.plan[0]',
  'event:oakland-civic-ai-design-sprint-2026.plan[1]', 'event:santa-clara-bruno-mars-oct-2026.summary', 'event:santa-clara-volvo-ex60-lab-2026.plan[2]',
  'event:sf-fall-show-oct15-18-2026.plan[1]', 'event:sf-nexus-party-oct1-2026.plan[2]', 'event:sf-potrero-hill-festival-oct17-2026.plan[1]',
  'event:sonoma-womens-suffrage-2026.plan[1]', 'event:vallejo-brewing-artwalk-2026.summary', 'event:woodside-djerassi-free-art-hike-oct5-2026.plan[3]',
  'offer:history-smc-free-oct2.description', 'offer:omca-free-oct4.description', 'opening:albany-o2-sushi-opening-2026.summary',
  'opening:los-altos-coffeebar-announced-2026.editorTip', 'opening:marufuku-burlingame-announced.summary', 'opening:millbrae-cafe-announced-2026.editorTip',
  'opening:mountain-view-tong-sui-announced-2026.editorTip', 'opening:palo-alto-auntea-jenny-announced-2026.editorTip',
  'opening:palo-alto-bonbon-matcha-announced-2026.editorTip', 'opening:walnut-creek-vici-new-store-2026.editorTip',
  // "本次未复核" / "此条仅收" (counted since review round 1).
  'event:fremont-finding-nemo-outdoor-movie-2026.dateLabel', 'event:fremont-finding-nemo-outdoor-movie-2026.plan[0]',
  'event:menlo-kasturba-gandhi-2026.dateLabel', 'event:menlo-kasturba-gandhi-2026.plan[0]', 'offer:sunnyvale-st-johns-happy-hour-ongoing.description',
]);

test('editorial lint: no new editor or pipeline note in an event, offer or opening reader field', () => {
  const found = readerStrings().filter(([, text]) => hasEditorNote(text)).map(([key]) => key);
  const fresh = found.filter(key => !KNOWN_NOTES.has(key));
  assert.deepEqual(fresh, [], 'Write these for the reader (or keep the working note out of the catalog): the page hides note sentences, but new data must not add them (CNT-1011-05)');
  const fixed = [...KNOWN_NOTES].filter(key => !found.includes(key));
  if (fixed.length) console.log(`Fixed in the data, remove from KNOWN_NOTES: ${fixed.join(', ')}`);
});

test('no detail shows a note or a raw URL to a reader, in 简体 or English', async () => {
  await loadLocale('en');
  for (const [key, text] of readerStrings()) {
    const zh = readerProse(text, 'zh-Hans');
    assert.ok(!EDITOR_NOTE_ZH.test(zh) && !/https?:\/\//i.test(zh), `${key}: ${zh}`);
    const en = readerProse(text, 'en');
    assert.ok(!EDITOR_NOTE_EN.test(en) && !/https?:\/\//i.test(en), `${key}: ${en}`);
  }
});

/** Fields a fact cell or a heading prints on its own: the filter must never leave them blank. */
const LABEL_FIELDS = new Set(['title', 'dateLabel', 'costLabel', 'requirement']);
test('a title, date, cost or requirement never goes blank after the note filter, in any language', async () => {
  await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
  for (const [key, text] of readerStrings()) {
    if (!LABEL_FIELDS.has(key.slice(key.lastIndexOf('.') + 1)) || !text.trim()) continue;
    for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) assert.ok(readerProse(text, locale), `${key} (${locale}) is blank after the note filter`);
  }
});

/** An independent sentence split (after ". ", "; ", "! ", "? ", around " · "; not after an initial like "St."). */
function pieces(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/(?<=[.;!?]["”’)]?)\s+|\s+·\s+/)) {
    if (out.length && /(?:^|\s)[A-Z][a-z]?\.$/.test(out[out.length - 1])) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
  }
  return out.filter(piece => piece.trim());
}
const core = (text: string) => text.replace(/[\s.;,:]+$/, '').trim().toLocaleLowerCase('en-US');

/**
 * English strings the filter shortens although the 简体 source keeps everything: the English pack still carries a pipeline
 * note the source no longer has ("Prices and availability have not been retrieved.", "…could not be retrieved during this
 * check"). Remove a line when CNT re-translates it. Any other English-only drop fails: English readers get every fact.
 */
const EN_ONLY_NOTES = new Set([
  'event:sf-disney-worlds-collide-2026.plan[1]', 'event:sf-rod-wave-2026.plan[1]', 'event:sf-chayanne-2026.plan[1]', 'event:sf-young-miko-2026.plan[1]',
  'opening:hijau-san-jose-storefront.editorTip',
]);

test('every English sentence the filter drops is a note on its own, and English drops nothing the 简体 page keeps', async () => {
  await loadLocale('en');
  const englishOnly: string[] = [];
  for (const [key, text] of readerStrings()) {
    const source = translateText(text, 'en').trim();
    const shown = readerProse(text, 'en');
    if (shown === source) continue;
    for (const piece of pieces(source)) {
      if (core(shown).includes(core(piece))) continue;
      assert.ok(EDITOR_NOTE_EN.test(piece) || /https?:\/\//i.test(piece), `${key}: dropped a sentence that is not a note: "${piece}"`);
    }
    if (readerProse(text, 'zh-Hans') === text.trim()) englishOnly.push(key);
  }
  assert.deepEqual(englishOnly.filter(key => !EN_ONLY_NOTES.has(key)), [], 'English drops text the 简体 page shows');
  const fixed = [...EN_ONLY_NOTES].filter(key => !englishOnly.includes(key));
  if (fixed.length) console.log(`Re-translated, remove from EN_ONLY_NOTES: ${fixed.join(', ')}`);
});
