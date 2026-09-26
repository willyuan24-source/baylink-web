import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Bilingual, DialogueNode } from '../src/opus-bay/core/types';
import { DISTRICT } from '../src/opus-bay/data/district';
import { CONTENT_POI_ANCHORS, EMBARCADERO_INFO, FARMERS_MARKET_DAYS, POIS, POI_EXTRA_SOURCES, PHOTO_SOURCE_PAGES, SUBJECT_FACTS, VERIFIED_AT, isFarmersMarketDay } from '../src/opus-bay/data/pois';
import { POSTCARDS, POSTCARD_IDS } from '../src/opus-bay/data/postcards';
import { FREE_GOALS, GUIDE_BARKS, NODES, NPC_LINES, SCRIPT_HOOKS, START_NODE, WEEK_QUESTIONS } from '../src/opus-bay/data/script';
import { FIRST_TOUR, FIRST_TOUR_PASSES } from '../src/opus-bay/data/tours';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const catalog = readJson('public/planner-catalog.json') as { places: { id: string }[] };
const guides = readJson('public/baybay-guides.json') as { slug: string }[];
const PLACE_IDS = new Set(catalog.places.map(place => place.id));
const GUIDE_SLUGS = new Set(guides.map(guide => guide.slug));

/** Bubble width: every non-ASCII char counts 1, ASCII counts ½ (a Latin word is narrower than a hanzi). */
const bubbleWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const filled = (text: Bilingual | undefined, where: string) => {
  assert.ok(text, `${where}: missing text`);
  assert.ok(text.zh.trim().length > 0, `${where}: empty zh`);
  assert.ok(text.en.trim().length > 0, `${where}: empty en`);
  assert.ok(/[一-鿿]/.test(text.zh) || /^[A-Z0-9 .'·-]+$/i.test(text.zh), `${where}: zh has Chinese text`);
  assert.ok(!/[一-鿿]/.test(text.en), `${where}: en has no Chinese`);
};
const https = (url: string | undefined, where: string) => assert.match(url ?? '', /^https:\/\/[^\s]+$/, `${where}: sourceUrl must be https`);

/** Names DESIGN.md §11 promises in DISTRICT.anchors. */
const DESIGN_ANCHORS = (() => {
  const design = fs.readFileSync(path.join(root, 'src/opus-bay/DESIGN.md'), 'utf8');
  const section = design.slice(design.indexOf('## 11.'), design.indexOf('## 12.'));
  const names = new Set([...section.matchAll(/`([a-z0-9-]+)`/g)].map(match => match[1]));
  return names;
})();

const walkNext = (start: string) => {
  const seen: DialogueNode[] = [];
  let id: string | undefined = start;
  while (id) {
    const node: DialogueNode | undefined = NODES[id];
    assert.ok(node, `node ${id} (reached from ${start}) exists`);
    assert.ok(!seen.includes(node), `next-chain from ${start} loops at ${id}`);
    seen.push(node);
    id = node.next;
  }
  return seen;
};

test('dialogue graph: ids, bilingual text, bubble length, references, hotkeys', () => {
  const ids = Object.keys(NODES);
  assert.ok(ids.length >= 80, `expected a full script, got ${ids.length} nodes`);
  for (const [key, node] of Object.entries(NODES)) {
    assert.equal(node.id, key, `${key}: key/id mismatch`);
    filled(node.text, key);
    assert.ok(bubbleWidth(node.text.zh) <= 45, `${key}: zh bubble too long (${bubbleWidth(node.text.zh)}): ${node.text.zh}`);
    assert.ok(node.text.en.length <= 120, `${key}: en bubble too long (${node.text.en.length})`);
    assert.ok(!/按\s?[A-Z]\b|press [A-Z]\b/i.test(node.text.zh + node.text.en), `${key}: no controller-specific hints in dialogue`);
    if (node.speaker === 'npc') filled(node.npcName, `${key} npcName`);
    if (node.next) assert.ok(NODES[node.next], `${key}: next → ${node.next} missing`);
    assert.ok(!(node.next && node.choices?.length), `${key}: next and choices are exclusive`);
    const hotkeys = new Set<string>();
    for (const choice of node.choices ?? []) {
      filled(choice.label, `${key} choice`);
      assert.ok(bubbleWidth(choice.label.zh) <= 20, `${key}: choice label too long: ${choice.label.zh}`);
      assert.ok(choice.next || choice.action, `${key}: choice "${choice.label.zh}" goes nowhere`);
      if (choice.next) assert.ok(NODES[choice.next], `${key}: choice next → ${choice.next} missing`);
      if (choice.hotkey) {
        assert.match(choice.hotkey, /^[1-9]$/, `${key}: hotkey is a digit`);
        assert.ok(!hotkeys.has(choice.hotkey), `${key}: duplicate hotkey ${choice.hotkey}`);
        hotkeys.add(choice.hotkey);
      }
      if (choice.action?.type === 'open-poi') assert.ok(POIS.some(poi => poi.id === (choice.action as { poiId: string }).poiId));
    }
    if (node.action?.type === 'open-poi') assert.ok(POIS.some(poi => poi.id === (node.action as { poiId: string }).poiId));
    walkNext(key);
  }
});

test('welcome offers the four starts with hotkeys 1–4', () => {
  const hello = NODES[START_NODE];
  assert.equal(hello.speaker, 'baybay');
  assert.deepEqual(hello.choices?.map(choice => choice.hotkey), ['1', '2', '3', '4']);
  assert.deepEqual(hello.choices?.map(choice => choice.action?.type), ['start-tour', 'start-week', 'free-roam', 'skip-intro']);
  assert.deepEqual(hello.choices?.map(choice => choice.label.zh), ['刚来湾区，带我认识一下', '这周有什么好玩的？', '我自己逛逛', '我是本地人，直接开始']);
});

test('script hooks, NPC lines and week questions resolve', () => {
  const hookIds = Object.values(SCRIPT_HOOKS).flatMap(value => (typeof value === 'string' ? [value] : Object.values(value)));
  for (const id of hookIds) assert.ok(NODES[id], `hook ${id} exists`);
  assert.equal(SCRIPT_HOOKS.tourIntro, FIRST_TOUR.introNode);
  assert.equal(SCRIPT_HOOKS.tourOutro, FIRST_TOUR.outroNode);
  assert.deepEqual(NPC_LINES.map(npc => npc.key).sort(), ['family', 'fisher', 'jogger', 'streetcar', 'vendor']);
  for (const npc of NPC_LINES) {
    assert.equal(npc.nodeId, `npc.${npc.key}`, 'flow looks NPC lines up as npc.<key>');
    assert.ok(NODES[npc.nodeId], `${npc.nodeId} exists`);
    assert.ok(DESIGN_ANCHORS.has(npc.anchor), `${npc.anchor} is a §11 anchor`);
    filled(npc.name, npc.key);
  }
  for (const key of ['companions', 'vibe', 'region'] as const) {
    const values = WEEK_QUESTIONS[key].map(option => option.value);
    assert.equal(new Set(values).size, values.length, `${key} values unique`);
    WEEK_QUESTIONS[key].forEach(option => filled(option.label, `${key}.${option.value}`));
    const node = NODES[`week.${key}`];
    assert.deepEqual(node.choices?.map(choice => choice.action), values.map(value => ({ type: 'set-week-pref', key, value })));
  }
  for (const [kind, lines] of Object.entries(GUIDE_BARKS)) {
    assert.ok(lines.length > 0, `${kind} barks`);
    lines.forEach(line => { filled(line, `bark ${kind}`); assert.ok(bubbleWidth(line.zh) <= 45); });
  }
});

test('free-roam goals are the five designed goals', () => {
  assert.deepEqual(FREE_GOALS.map(goal => goal.id), ['postcards', 'streetcar', 'viewpoint', 'sea-lions', 'taste']);
  FREE_GOALS.forEach(goal => { filled(goal.label, goal.id); filled(goal.hint, goal.id); });
});

test('tour: 6–7 stops in walking order with arrive + done nodes that hand control back to the tour system', () => {
  assert.ok(FIRST_TOUR.stops.length >= 6 && FIRST_TOUR.stops.length <= 7);
  assert.deepEqual(FIRST_TOUR.stops.map(stop => stop.poiId), ['ferry-building', 'farmers-market', 'pier7', 'exploratorium', 'filbert-steps', 'coit-tower', 'sea-lions']);
  filled(FIRST_TOUR.name, 'tour name');
  const chains = [FIRST_TOUR.introNode, ...FIRST_TOUR.stops.flatMap(stop => [stop.arriveNode, stop.doneNode ?? ''])];
  for (const start of chains) {
    assert.ok(start && NODES[start], `tour node ${start} exists`);
    const nodes = walkNext(start);
    for (const node of nodes) {
      assert.ok(!node.choices?.length, `${node.id}: tour lines have no choices (they would stall the tour)`);
      assert.notEqual(node.action?.type, 'tour-next', `${node.id}: 'tour-next' would skip the stop card`);
    }
    assert.equal(nodes.at(-1)?.action?.type, 'end', `${start} ends with 'end'`);
  }
  assert.ok(walkNext(FIRST_TOUR.outroNode).at(-1)?.action?.type === 'tour-end');
  for (const stop of FIRST_TOUR.stops) {
    const poi = POIS.find(item => item.id === stop.poiId);
    assert.ok(poi?.realInfo, `${stop.poiId} has a real-info card`);
    const doneText = walkNext(stop.doneNode!).map(node => node.text.zh).join('');
    assert.ok(/\d/.test(doneText) || /BAYLINK|执照|免费|单号|鹦鹉|Grace/.test(doneText), `${stop.poiId}: done lines carry a concrete fact`);
  }
  for (const id of FIRST_TOUR_PASSES) assert.ok(POIS.some(poi => poi.id === id && poi.bark));
});

test('POIs: unique ids, verified real info, valid BAYLINK links, reused photos exist', () => {
  const ids = POIS.map(poi => poi.id);
  assert.equal(new Set(ids).size, ids.length, 'POI ids unique');
  for (const required of ['ferry-building', 'farmers-market', 'weekly-board', 'pier14', 'pier7', 'exploratorium', 'levis-plaza', 'filbert-steps', 'coit-tower', 'pier33', 'pier39-carousel', 'sea-lions', 'streetcar-ferry', 'streetcar-green', 'streetcar-pier39']) {
    assert.ok(ids.includes(required), `POI ${required}`);
  }
  for (const poi of POIS) {
    filled(poi.name, poi.id);
    filled(poi.interaction.verb, `${poi.id} verb`);
    filled(poi.bark, `${poi.id} bark`);
    assert.ok(bubbleWidth(poi.bark!.zh) <= 45, `${poi.id} bark length`);
    assert.ok(poi.radius >= 2 && poi.radius <= 6, `${poi.id} radius`);
    assert.ok(Number.isFinite(poi.position.x) && Number.isFinite(poi.position.z), `${poi.id} position`);
    if (poi.interaction.nodeId) assert.ok(NODES[poi.interaction.nodeId], `${poi.id} nodeId ${poi.interaction.nodeId}`);
    if (poi.guideSlug) assert.ok(GUIDE_SLUGS.has(poi.guideSlug), `${poi.id}: guide ${poi.guideSlug} exists`);
    if (poi.plannerPlaceId) assert.ok(PLACE_IDS.has(poi.plannerPlaceId), `${poi.id}: planner place ${poi.plannerPlaceId} exists`);
    if (poi.id === 'weekly-board') { assert.equal(poi.realInfo, undefined, 'the board is a game element'); continue; }
    const info = poi.realInfo;
    assert.ok(info, `${poi.id} has realInfo`);
    https(info.sourceUrl, poi.id);
    assert.equal(info.verifiedAt, VERIFIED_AT);
    filled(info.summary, `${poi.id} summary`);
    if (info.hours) filled(info.hours, `${poi.id} hours`);
    if (info.cost) filled(info.cost, `${poi.id} cost`);
    assert.ok(info.tips.length >= 1, `${poi.id} tips`);
    info.tips.forEach((tip, i) => filled(tip, `${poi.id} tip ${i}`));
    if (info.tips.some(tip => tip.zh.includes('BAYLINK'))) assert.ok(poi.guideSlug, `${poi.id}: credited BAYLINK tips link their guide`);
    assert.ok(info.lat > 37.79 && info.lat < 37.812 && info.lng > -122.412 && info.lng < -122.389, `${poi.id}: lat/lng on the SF waterfront`);
    if (info.photo) {
      assert.ok(fs.existsSync(path.join(root, 'public', info.photo.src)), `${poi.id}: photo ${info.photo.src} exists`);
      assert.ok(info.photo.credit && info.photo.license && info.photo.licenseUrl, `${poi.id}: photo credit + license`);
      https(PHOTO_SOURCE_PAGES[info.photo.src], `${poi.id} photo page`);
    }
  }
  for (const [id, urls] of Object.entries(POI_EXTRA_SOURCES)) {
    assert.ok(ids.includes(id), `extra sources for known POI ${id}`);
    urls.forEach(url => https(url, `${id} extra`));
  }
  assert.deepEqual(POIS.filter(poi => poi.interaction.kind === 'streetcar').map(poi => poi.interaction.refId), ['ferry', 'green', 'pier39']);
  assert.equal(POIS.filter(poi => poi.interaction.kind === 'photo').length, 1, 'flow expects exactly one photo POI');
  assert.equal(POIS.filter(poi => poi.interaction.kind === 'board').length, 1);
  for (const [id, subject] of Object.entries(SUBJECT_FACTS)) { filled(subject.name, id); filled(subject.fact, id); https(subject.sourceUrl, id); }
  https(EMBARCADERO_INFO.sourceUrl, 'embarcadero');
});

test('postcards: the eight illustrated ids with verified facts and hints', () => {
  assert.deepEqual(POSTCARDS.map(card => card.id), [...POSTCARD_IDS]);
  assert.deepEqual([...POSTCARD_IDS].sort(), ['bay-bridge-night', 'coit-tower', 'exploratorium', 'ferry-building-dawn', 'filbert-steps', 'pier7-sunset', 'sea-lions', 'streetcar']);
  for (const card of POSTCARDS) {
    filled(card.title, card.id);
    filled(card.fact, card.id);
    filled(card.hint, card.id);
    https(card.sourceUrl, card.id);
    assert.equal(card.image, `/opus-bay/postcards/${card.id}-600.webp`);
    assert.ok(Number.isFinite(card.position.x) && Number.isFinite(card.position.z));
  }
});

test('content only uses §11 anchor names (and the district provides them once it is built)', t => {
  const used = [...CONTENT_POI_ANCHORS, ...POSTCARD_IDS.map(id => `postcard-${id}`), ...NPC_LINES.map(npc => npc.anchor)];
  for (const name of used) assert.ok(DESIGN_ANCHORS.has(name), `${name} is listed in DESIGN.md §11`);
  const defined = Object.keys(DISTRICT.anchors ?? {});
  if (defined.length < 20) { t.skip(`district anchors still seed (${defined.length})`); return; }
  const missing = used.filter(name => !defined.includes(name));
  assert.deepEqual(missing, [], 'district defines every anchor content uses');
});

test('POI landmarkIds point at district landmarks (click proxies) once the district is built', t => {
  const landmarkIds = new Set(DISTRICT.landmarks.map(landmark => landmark.id));
  if (landmarkIds.size < 5) { t.skip(`district landmarks still seed (${landmarkIds.size})`); return; }
  const unknown = POIS.filter(poi => poi.landmarkId && !landmarkIds.has(poi.landmarkId)).map(poi => `${poi.id}→${poi.landmarkId}`);
  assert.deepEqual(unknown, []);
  const shared = POIS.filter(poi => poi.landmarkId).map(poi => poi.landmarkId);
  assert.equal(new Set(shared).size, shared.length, 'one POI per landmark proxy');
});

test('farmers market days follow the Bay Area calendar', () => {
  assert.deepEqual([...FARMERS_MARKET_DAYS], [2, 4, 6]);
  assert.equal(isFarmersMarketDay(new Date('2026-09-26T18:00:00Z')), true, 'Saturday');
  assert.equal(isFarmersMarketDay(new Date('2026-09-25T18:00:00Z')), false, 'Friday');
  assert.equal(isFarmersMarketDay(new Date('2026-09-26T05:00:00Z')), false, 'still Friday night in San Francisco');
  assert.equal(isFarmersMarketDay(new Date('2026-09-29T20:00:00Z')), true, 'Tuesday');
});

// ---------------------------------------------------------------------------
// Polish round 1 (flow-ui): honest links and copy
// ---------------------------------------------------------------------------

import { POI_OFFICIAL_URLS } from '../src/opus-bay/data/pois';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** Year-month a slug is tied to ("…-2026-10", "…-october-…-2026"), or null for evergreen guides. */
const slugMonth = (slug: string): string | null => {
  const ym = /(\d{4})-(\d{2})(?:$|-)/.exec(slug);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const name = MONTHS.findIndex(m => slug.includes(m));
  const year = /(20\d{2})/.exec(slug)?.[1];
  return name >= 0 && year ? `${year}-${String(name + 1).padStart(2, '0')}` : null;
};

test('F10: no place card links a month-tagged BAYLINK guide that is already out of date', () => {
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  for (const poi of POIS) {
    if (!poi.guideSlug) continue;
    const month = slugMonth(poi.guideSlug);
    if (month) assert.ok(month >= now, `${poi.id}: guide ${poi.guideSlug} is for ${month}, before ${now}`);
  }
  assert.equal(slugMonth('bay-area-freebies-deals-2026-10'), '2026-10');
  assert.equal(slugMonth('bay-area-october-muni-clipper-payment-update-2026'), '2026-10');
  assert.equal(slugMonth('sf-fishermans-wharf-pier39-guide'), null);
});

test('F10: 官网 is only ever a place\'s own official site (never a fact-check source like a PDF or an agency list)', () => {
  const OFFICIAL_HOSTS = ['www.ferrybuildingmarketplace.com', 'foodwise.org', 'www.exploratorium.edu', 'sfrecpark.org', 'www.nps.gov', 'www.pier39.com', 'www.sfmta.com'];
  for (const [id, url] of Object.entries(POI_OFFICIAL_URLS)) {
    assert.ok(POIS.some(poi => poi.id === id), `official site for a known POI: ${id}`);
    const u = new URL(url);
    assert.equal(u.protocol, 'https:');
    assert.ok(OFFICIAL_HOSTS.includes(u.hostname), `${id}: ${u.hostname} is an official home`);
    assert.ok(!/\.pdf$/i.test(u.pathname), `${id}: not a PDF`);
  }
  for (const id of ['pier7', 'pier14', 'levis-plaza', 'filbert-steps']) assert.equal(POI_OFFICIAL_URLS[id], undefined, `${id} has no official site of its own`);
});

test('F14 / F16: no "live" claims and one vocabulary (旅行本) in the player-facing strings', () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } };
  for (const dir of ['src/opus-bay/ui', 'src/opus-bay/game', 'src/opus-bay/data']) walk(path.join(root, dir));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/实时日历|实时信息|每周更新/.test(text), `${path.basename(file)} claims a live / weekly-updated feed`);
    const strings = [...text.matchAll(/'([^'\n]*)'|`([^`]*)`/g)].map(m => m[1] ?? m[2]).join('\n');
    assert.ok(!/手帐/.test(strings), `${path.basename(file)} still says 手帐 (the journal is 旅行本)`);
  }
});
