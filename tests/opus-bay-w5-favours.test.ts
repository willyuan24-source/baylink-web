import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { Bilingual } from '../src/opus-bay/core/types';

/**
 * Wave 5 · lane C · part c (plan sf-w5-plan.md §3.5, §4.6 W5-C7, the mid-wave checkpoint's CP-14): the district POIs in
 * the city's words, the pelican moment's two-shot beside you on open ground, the residents' second favours (the photo
 * and play goal kinds, the marks, the words of the real day) and their letters. This file runs the CITY content (the
 * page's `?world=city`, read at import time), like the game.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, toBlob: (cb: (b: null) => void) => cb(null) }) };
let clock = 900_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const store = await import('../src/opus-bay/core/store');
const { game } = store;
const { emit, onEvent } = await import('../src/opus-bay/core/events');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const inter = await import('../src/opus-bay/game/interactables');
const brain = await import('../src/opus-bay/game/brain');
const save = await import('../src/opus-bay/data/save');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const slots = await import('../src/opus-bay/ui/slots');
const pois = await import('../src/opus-bay/data/pois');
const { CITY_DISTRICT_POI_NAMES, CITY_DISTRICT_TEXT_NAMES, cityDistrictZh } = await import('../src/opus-bay/data/sf/cityPois');
const { contentFor, goalTargets, residentInteractables } = await import('../src/opus-bay/game/cityContent');
const pelican = await import('../src/opus-bay/game/pelicanFirst');
const moveApi = await import('../src/opus-bay/actors/moveApi');
const residents = await import('../src/opus-bay/data/sf/residents');
const {
  RESIDENTS, residentByKey, taskDoneId, task2State, task2OnId, task2DoneId, task2PhotoId, acceptTask2, finishTask2, photoHits, photoSpotsDone,
  task2Progress, nextPhotoSpot, letterState, deliverLetter, readLetter, letterId, letterReadId, lettersArrived, tasks2Done,
} = residents;
const dialogue = await import('../src/opus-bay/data/sf/dialogue');
const { RESIDENT_SOURCES, TASK_TEXT, nodeIds, nodeIds2, residentDialogue, fact2For } = dialogue;
const { LETTERS, LETTER_GREETING } = await import('../src/opus-bay/data/sf/letters');
const tasks = await import('../src/opus-bay/game/residentTasks');
const { entryNode, playGoalMet, favour2Spot, LETTER_DELAY_MS, LETTER_RESUME_MS, LETTER_GAP_MS } = tasks;
const { stepFrameSystems } = await import('../src/opus-bay/game/systemsRegistry');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { VIEW_SPOTS } = await import('../src/opus-bay/play/viewSpots');
setStorageForTests(null);

const bubbleWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const filled = (text: Bilingual | undefined, where: string, zhMax = 45) => {
  assert.ok(text && text.zh.trim() && text.en.trim(), `${where}: bilingual text`);
  assert.ok(/[一-鿿]/.test(text.zh), `${where}: zh has Chinese`);
  assert.ok(!/[一-鿿]/.test(text.en), `${where}: en has no Chinese`);
  assert.ok(bubbleWidth(text.zh) <= zhMax, `${where}: zh ≤ ${zhMax} (${bubbleWidth(text.zh)}): ${text.zh}`);
};
const events: { type: string; [k: string]: unknown }[] = [];
onEvent(e => { events.push(e as unknown as { type: string }); });
const rewardsSeen = () => events.filter(e => e.type === 'reward') as unknown as { source: string; coins: number }[];
const toasts = () => game.get().toasts.map(t => t.text);

function reset() {
  if (game.get().dialogue.nodeId) flowMod.closeDialogue();
  for (const o of [...slots.openOverlays()]) slots.closeOverlay(o.id);
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  runtime.move.mode = 'foot';
  brain.resetBrain();
  inter.setInteractables(inter.buildInteractables());
  save.resetSaveCache();
  pelican.resetPelicanForTests();
  moveApi.setGlideUnlocked(false);
  events.length = 0;
  tick(5000);
}
const at = (x: number, z: number) => { runtime.player.x = x; runtime.player.z = z; };

// ---------------------------------------------------------------------------
// CP-14 · the district's POIs in the city's words; the pelican two-shot
// ---------------------------------------------------------------------------

test('CP-14 the waterfront POIs say the city’s names in the city (科伊特塔壁画, not Coit Tower 壁画); the district is unchanged', () => {
  const city = contentFor('city').pois, district = contentFor('district').pois;
  const byId = (list: typeof city, id: string) => list.find(p => p.id === id)!;
  assert.equal(byId(city, 'coit-murals').name.zh, '科伊特塔壁画');
  assert.equal(byId(city, 'coit-tower').name.zh, '科伊特塔观景点');
  assert.equal(byId(city, 'filbert-steps').name.zh, '菲尔伯特台阶');
  assert.equal(byId(district, 'coit-murals').name.zh, 'Coit Tower 壁画', 'district mode keeps its frozen names');
  assert.equal(pois.DISTRICT_POIS.find(p => p.id === 'coit-murals')!.name.zh, 'Coit Tower 壁画');
  // the game's own POIS in this (city) page: the E prompt and the postcard clue read these names
  assert.equal(pois.POIS.find(p => p.id === 'coit-murals')!.name.zh, '科伊特塔壁画');
  for (const p of pois.CITY_DISTRICT_POIS) {
    const d = pois.DISTRICT_POIS.find(q => q.id === p.id)!;
    assert.equal(p.name.en, d.name.en, `${p.id}: en unchanged`);
    assert.deepEqual(p.position, d.position, `${p.id}: same spot`);
    const all = [p.name.zh, p.bark?.zh ?? '', p.interaction.verb.zh, p.realInfo?.summary.zh ?? '', ...(p.realInfo?.tips ?? []).map(t => t.zh)].join(' ');
    for (const [from] of CITY_DISTRICT_TEXT_NAMES) assert.ok(!all.includes(from), `${p.id}: no “${from}” in the city's zh (${all.slice(0, 60)})`);
  }
  for (const id of Object.keys(CITY_DISTRICT_POI_NAMES)) assert.ok(pois.DISTRICT_POIS.some(p => p.id === id), `${id}: a district POI`);
  assert.equal(cityDistrictZh('再爬一段就到 Coit Tower 啦。'), '再爬一段就到科伊特塔啦。');
  assert.equal(cityDistrictZh('去恶魔岛的船从 Pier 33 开，不是 PIER 39 哦。'), '去恶魔岛的船从 33 号码头开，不是 39 号码头哦。');
});

test('CP-14 the pelican moment waits for BAYBAY beside you, and her mark keeps the camera’s side of you open (not up the slope)', () => {
  // a summit plaza (ground 20 within 10 u of the origin), a slope down to 14 outside it
  const ground = (x: number, z: number) => { const d = Math.hypot(x, z); return d <= 10 ? 20 : Math.max(14, 20 - (d - 10) * 0.6); };
  const stand = () => true;
  // the player 2.5 u below the plaza's rim; BAYBAY downhill of them (as the checkpoint's walker had it)
  const player = { x: 0, z: 13 }, guide = { x: 0, z: 17 };
  const mark = pelican.pelicanMark(player, guide, 0, stand, ground)!;
  assert.ok(mark, 'a mark');
  assert.ok(Math.abs(Math.hypot(mark.x - player.x, mark.z - player.z) - pelican.PAIR_GAP) < 1e-6, 'PAIR_GAP beside the player');
  // the camera stands behind the player, opposite her: with her uphill of the player it is downhill (open)
  assert.ok(ground(mark.x, mark.z) > ground(player.x, player.z), `she stands uphill (${ground(mark.x, mark.z).toFixed(1)} > ${ground(player.x, player.z).toFixed(1)})`);
  // on the plaza's rim with BAYBAY down the slope: her mark stays up on the plaza (the camera keeps your level)
  const rim = pelican.pelicanMark({ x: 0, z: 9.5 }, { x: 0, z: 13 }, 0, stand, ground)!;
  assert.equal(ground(rim.x, rim.z), 20, 'on the plaza with the player');
  // on level ground the mark stays on her side
  const flat = pelican.pelicanMark({ x: 0, z: 0 }, { x: 3, z: 0 }, 0, stand, () => 0)!;
  assert.ok(flat.x > 1.6 && Math.abs(flat.z) < 1e-6, 'level: toward where she stands');
  // nothing standable: no mark
  assert.equal(pelican.pelicanMark(player, guide, 0, () => false, ground), null);
});

test('CP-14 the moment opens only once BAYBAY is within PAIR_NEAR (or after PAIR_WAIT_MS), and she holds her mark while it plays', () => {
  reset();
  const offered: string[] = [];
  pelican.resetPelicanForTests(null, line => { offered.push(typeof line === 'string' ? line : line.zh); return true; });
  const off = pelican.initPelicanFirst(line => { offered.push(typeof line === 'string' ? line : line.zh); return true; });
  try {
    Object.assign(runtime.guide, { x: 14, z: 0 });
    assert.equal(pelican.unlockPelican('viewpoint', clock), true);
    tick(pelican.MOMENT_MIN_MS + 100);
    pelican.stepPelican(clock, () => true);
    assert.equal(game.get().dialogue.nodeId, null, 'BAYBAY 14 u away: the moment waits');
    runtime.guide.x = 3;
    pelican.stepPelican(clock, () => true);
    assert.equal(game.get().dialogue.nodeId, 'pelican.moment', 'she is near: the moment opens');
    const mark = pelican.pelicanMarkNow();
    assert.ok(mark && Math.abs(Math.hypot(mark.x, mark.z) - pelican.PAIR_GAP) < 1e-6, 'her mark beside the player');
    assert.deepEqual(flowMod.talkMark(), mark, 'flow.talkMark holds her there');
    flowMod.closeDialogue();
    // a fresh unlock with BAYBAY staying far: PAIR_WAIT_MS after the unlock it opens anyway (she walks to her mark)
    reset();
    moveApi.setGlideUnlocked(false);
    Object.assign(runtime.guide, { x: 30, z: 0 });
    assert.equal(pelican.unlockPelican('viewpoint', clock), true);
    tick(pelican.MOMENT_MIN_MS + 100);
    pelican.stepPelican(clock, () => true);
    assert.equal(game.get().dialogue.nodeId, null);
    tick(pelican.PAIR_WAIT_MS);
    pelican.stepPelican(clock, () => true);
    assert.equal(game.get().dialogue.nodeId, 'pelican.moment', 'waited long enough: it opens');
    flowMod.closeDialogue();
  } finally { off(); }
});

// ---------------------------------------------------------------------------
// W5-C7 · the second favours
// ---------------------------------------------------------------------------

test('W5-C7 six second favours: photo (Rosa, Luz ×3, Hank, Marcus) and play (Ray’s riff, Dana’s look), texts, spots, targets', () => {
  assert.deepEqual(RESIDENTS.map(r => r.task2.goal.kind), ['play', 'photo', 'photo', 'photo', 'play', 'photo']);
  for (const r of RESIDENTS) {
    const t = r.task2;
    filled(t.title, `${r.key} title2`, 18);
    filled(t.hint, `${r.key} hint2`, 30);
    filled(t.teaser, `${r.key} teaser2`, 24);
    filled(t.target.name, `${r.key} target2`, 24);
    if (t.goal.kind === 'photo') {
      assert.ok(t.goal.need >= 1 && t.goal.need <= t.goal.spots.length);
      for (const s of t.goal.spots) { filled(s.name, `${r.key} spot ${s.id}`, 16); assert.ok(s.r >= 12 && s.r <= 45, `${s.id}: a forgiving radius`); }
    }
  }
  const luz = residentByKey('muralist')!.task2.goal;
  assert.ok(luz.kind === 'photo' && luz.need === 3 && luz.spots.length === 3);
  // Luz's three walls are the real mural places the city already has (Balmy, Clarion, the Women's Building)
  for (const [spot, id] of [['balmy', 'balmy-alley'], ['clarion', 'clarion-alley'], ['womens-building', 'womens-building']] as const) {
    const s = luz.spots.find(q => q.id === spot)!, a = ATTRACTIONS.find(q => q.id === id)!;
    assert.ok(Math.hypot(s.x - a.x, s.z - a.z) < 6, `${spot} by ${id}`);
  }
  const dana = residentByKey('ranger')!.task2.goal;
  assert.ok(dana.kind === 'play' && dana.activity === 'view' && VIEW_SPOTS.some(v => v.id === dana.spot), 'Dana: lane A’s Crissy Field beach view spot');
  const ray = residentByKey('gripman')!.task2.goal;
  assert.ok(ray.kind === 'play' && ray.activity === 'bell' && !ray.spot, 'Ray: lane A’s bell riff (any ride)');
});

test('W5-C7 state: locked until the first favour, new → on → done (the photo marks dropped), letters due → new → read; the marks stay few', () => {
  const k = 'muralist' as const, r = residentByKey(k)!;
  assert.equal(task2State([], k), 'locked');
  let done = [taskDoneId(k)];
  assert.equal(task2State(done, k), 'new');
  done = acceptTask2(done, k);
  assert.deepEqual(done, [taskDoneId(k), task2OnId(k)]);
  assert.equal(task2State(done, k), 'on');
  assert.deepEqual(acceptTask2(done, k), done, 'idempotent');
  // a shutter in Clarion Alley counts that spot only
  const clarion = (r.task2.goal as { spots: { id: string; x: number; z: number }[] }).spots[1];
  assert.deepEqual(photoHits(done, r, clarion.x + 3, clarion.z).map(s => s.id), ['clarion']);
  assert.deepEqual(photoHits(done, r, 0, 0), [], 'nowhere near');
  done = [...done, task2PhotoId(k, 'clarion')];
  assert.deepEqual(photoSpotsDone(done, r), ['clarion']);
  assert.equal(task2Progress(done, r), '1/3');
  assert.deepEqual(photoHits(done, r, clarion.x, clarion.z), [], 'a spot counts once');
  assert.equal(nextPhotoSpot(done, r, { x: clarion.x, z: clarion.z })!.id, 'womens-building', 'the nearest spot left');
  done = finishTask2(done, k);
  assert.deepEqual(done, [taskDoneId(k), task2DoneId(k)], 'the on and photo marks go');
  assert.equal(task2State(done, k), 'done');
  assert.equal(task2Progress(done, r), '3/3');
  assert.equal(letterState(done, k), 'due');
  done = deliverLetter(done, k);
  assert.equal(letterState(done, k), 'new');
  assert.deepEqual(deliverLetter(done, k), done, 'a letter arrives once');
  done = readLetter(done, k);
  assert.deepEqual(done, [taskDoneId(k), task2DoneId(k), letterReadId(k)], '`letter-read:` replaces `letter:`');
  assert.equal(letterState(done, k), 'read');
  assert.equal(lettersArrived(done), 1);
  assert.equal(tasks2Done(done), 1);
  // at most: 6 done + 3 photo marks while on + 6 letters → the progress save's 128 ids keep room
  assert.ok(!done.includes(letterId(k)));
});

test('W5-C7 a chat: the first favour’s thanks → fact, then the second is asked; declined this visit → asked straight away; on → remind2; done → thanks2', () => {
  const r = residentByKey('baker')!;
  const ids = nodeIds('baker'), ids2 = nodeIds2('baker');
  assert.equal(entryNode(r, [taskDoneId('baker')], true), ids.thanks);
  assert.equal(entryNode(r, [taskDoneId('baker')], true, true), ids2.ask);
  assert.equal(entryNode(r, [taskDoneId('baker'), task2OnId('baker')], true), ids2.remind);
  assert.equal(entryNode(r, [taskDoneId('baker'), task2DoneId('baker')], true), ids2.thanks);
  // before: unchanged
  assert.equal(entryNode(r, [], false), ids.hi);
});

test('W5-C7 the runtime: yes2 accepts, a shutter at the Ferry Building finishes Rosa’s (favour:baker:2 paid once), Luz’s counts 1/3 · 2/3 · done, Ray’s riff and Dana’s look finish theirs', async () => {
  reset();
  const off = tasks.initResidentTasks();
  try {
    game.set({ goalsDone: RESIDENTS.map(q => taskDoneId(q.key)) });
    emit({ type: 'dialogue', speaker: 'npc', nodeId: 'npc.baker.ask2' });
    emit({ type: 'dialogue', speaker: 'npc', nodeId: 'npc.baker.yes2' });
    assert.equal(task2State(game.get().goalsDone, 'baker'), 'on');
    assert.ok(toasts().some(t => t.includes('新的小忙')), 'the accept toast');
    // the waypoint leads to the Ferry Building
    const target = goalTargets().find(t => t.goal === task2DoneId('baker'));
    assert.ok(target && target.first && Math.hypot(target.x - 133.02, target.z + 4.91) < 1, 'Rosa’s waypoint');
    assert.equal(inter.interactableById('favour2:baker')?.name.zh, '渡轮大厦钟楼', 'favour2: resolves to the spot');
    at(0, 0); emit({ type: 'shutter' });
    assert.equal(task2State(game.get().goalsDone, 'baker'), 'on', 'a photo far away does not count');
    at(120, 10); emit({ type: 'shutter' });
    assert.equal(task2State(game.get().goalsDone, 'baker'), 'done');
    assert.deepEqual(rewardsSeen().map(x => [x.source, x.coins]), [['favour:baker:2', 25]]);
    emit({ type: 'shutter' });
    assert.equal(rewardsSeen().length, 1, 'paid once');
    // Luz: three walls
    for (const n of ['npc.muralist.ask2', 'npc.muralist.yes2']) emit({ type: 'dialogue', speaker: 'npc', nodeId: n });
    const spots = (residentByKey('muralist')!.task2.goal as { spots: { x: number; z: number }[] }).spots;
    at(spots[0].x, spots[0].z); emit({ type: 'shutter' });
    assert.ok(toasts().some(t => t.includes('1/3')), `the progress toast (${toasts().join(' | ')})`);
    at(spots[2].x, spots[2].z); emit({ type: 'shutter' });
    assert.ok(toasts().some(t => t.includes('2/3')));
    at(spots[1].x, spots[1].z); emit({ type: 'shutter' });
    assert.equal(task2State(game.get().goalsDone, 'muralist'), 'done');
    // Ray: the bell riff ends; a cancelled one does not count; Dana: the look at her view spot, not another
    for (const n of ['npc.gripman.yes2', 'npc.ranger.yes2']) emit({ type: 'dialogue', speaker: 'npc', nodeId: n });
    emit({ type: 'play', activity: 'bell', what: 'cancel' });
    assert.equal(task2State(game.get().goalsDone, 'gripman'), 'on');
    emit({ type: 'play', activity: 'bell', what: 'end', tier: 1 });
    assert.equal(task2State(game.get().goalsDone, 'gripman'), 'done');
    emit({ type: 'find', kind: 'view', id: 'twin-peaks', first: true });
    assert.equal(task2State(game.get().goalsDone, 'ranger'), 'on');
    emit({ type: 'find', kind: 'view', id: 'crissy-beach', first: true });
    assert.equal(task2State(game.get().goalsDone, 'ranger'), 'done');
    assert.deepEqual(rewardsSeen().map(x => x.source), ['favour:baker:2', 'favour:muralist:2', 'favour:gripman:2', 'favour:ranger:2']);
    assert.ok(playGoalMet({ kind: 'play', activity: 'bell' }, { type: 'play', activity: 'bell', what: 'end' }));
    assert.ok(!playGoalMet({ kind: 'play', activity: 'view', spot: 'crissy-beach' }, { type: 'play', activity: 'view', what: 'end' }), 'a view favour waits for its own spot');
    assert.equal(favour2Spot(residentByKey('muralist')!, [taskDoneId('muralist'), task2OnId('muralist')], spots[1]).name.zh, 'Clarion 巷');
  } finally { off(); }
});

test('W5-C7 the letters arrive LETTER_DELAY_MS after the favour, one at a time, on a quiet frame; a letter due from an earlier visit comes LETTER_RESUME_MS in', () => {
  reset();
  const off = tasks.initResidentTasks();
  try {
    game.set({ goalsDone: [taskDoneId('baker'), task2OnId('baker'), taskDoneId('gardener'), task2DoneId('gardener')] });
    at(120, 10);
    emit({ type: 'shutter' });
    assert.equal(letterState(game.get().goalsDone, 'baker'), 'due');
    // the gardener's was finished on an earlier visit: it comes LETTER_RESUME_MS in (first seen now)
    stepFrameSystems(0.3, clock);
    tick(LETTER_RESUME_MS + 10);
    stepFrameSystems(0.3, clock);
    assert.equal(letterState(game.get().goalsDone, 'gardener'), 'new', 'Hank’s letter arrived');
    assert.ok(toasts().some(t => t.includes('收到一封信')), 'the letter toast');
    // photo mode is not quiet; the next letter waits LETTER_GAP_MS and Rosa's own delay
    tick(LETTER_DELAY_MS);
    game.set({ photoMode: true });
    stepFrameSystems(0.3, clock);
    assert.equal(letterState(game.get().goalsDone, 'baker'), 'due', 'not in photo mode');
    game.set({ photoMode: false });
    tick(LETTER_GAP_MS);
    stepFrameSystems(0.3, clock);
    assert.equal(letterState(game.get().goalsDone, 'baker'), 'new', 'Rosa’s letter arrived');
  } finally { off(); }
});

test('W5-C7 the words: the second favour’s dialogue graph, fact2 on the real day, the letters (short, warm, sourced where they hold a fact)', () => {
  const nodes = residentDialogue();
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const r of RESIDENTS) {
    const ids = nodeIds2(r.key);
    for (const id of Object.values(ids)) { const n = byId.get(id); assert.ok(n, `${id}`); filled(n.text, id); assert.ok(n.text.en.length <= 120, `${id}: en ≤ 120`); assert.ok(!/按\s?[A-Z]\b|press [A-Z]\b|点击|tap\b|click/i.test(n.text.zh + n.text.en), `${id}: no controls`); }
    assert.deepEqual(byId.get(ids.ask)!.choices!.map(c => c.next), [ids.yes, ids.no]);
    assert.deepEqual(byId.get(ids.remind)!.choices!.map(c => c.next ?? 'end'), [ids.go, 'end']);
    assert.equal(byId.get(ids.thanks)!.next, ids.fact);
    const letter = LETTERS[r.key];
    assert.equal(letter.key, r.key);
    for (const line of letter.body) filled(line, `${r.key} letter`, 40);
    assert.ok(letter.sign.zh.includes(r.short.zh) && letter.sign.en.includes(r.short.en), `${r.key}: signed by ${r.short.en}`);
    assert.ok(letter.body.length >= 2 && letter.body.length <= 3);
    if (letter.source) { assert.match(letter.source.url, /^https:\/\//); assert.equal(letter.source.verifiedAt, '2026-09-28'); }
  }
  filled(LETTER_GREETING, 'greeting');
  for (const [id, src] of Object.entries(RESIDENT_SOURCES)) { assert.ok(byId.has(id), `a source for a live node: ${id}`); assert.match(src.url, /^https:\/\//); }
  for (const k of ['gripman', 'baker', 'gardener', 'ranger', 'record-store'] as const) assert.ok(RESIDENT_SOURCES[`npc.${k}.fact2`], `${k}: fact2 sourced`);
  // the real day: Rosa on a Saturday market morning, Hank's tulips in their months, Marcus on a weekend
  assert.match(fact2For('baker', { month: 10, weekday: 6, hour: 9 })![1], /周六/);
  assert.equal(fact2For('baker', { month: 10, weekday: 6, hour: 15 }), null, 'after the market closes');
  assert.match(fact2For('gardener', { month: 3, weekday: 2, hour: 12 })![1], /开啦/);
  assert.match(fact2For('gardener', { month: 10, weekday: 2, hour: 12 })![1], /三月/);
  assert.match(fact2For('record-store', { month: 7, weekday: 0, hour: 12 })![1], /周末/);
  assert.equal(fact2For('record-store', { month: 7, weekday: 3, hour: 12 }), null);
  for (const d of [{ month: 10, weekday: 6, hour: 9 }, { month: 3, weekday: 2, hour: 12 }, { month: 10, weekday: 2, hour: 12 }, { month: 7, weekday: 0, hour: 12 }]) {
    for (const k of ['baker', 'gardener', 'record-store'] as const) { const s = fact2For(k, d); if (s) filled({ zh: s[1], en: s[2] }, `${k} fact2 variant`); }
  }
  for (const text of [TASK_TEXT.letterLine, TASK_TEXT.allLetters, TASK_TEXT.rayRiff, TASK_TEXT.letter(RESIDENTS[1].short), TASK_TEXT.photoSpot(1, 3, { zh: 'Clarion 巷', en: 'Clarion Alley' })]) filled(text, 'favour text');
});

test('W5-C7 the Journal lists the second favours: the resident interactables stay the six; the letter overlay and favour2 resolver are the chunk’s', () => {
  reset();
  const off = tasks.initResidentTasks();
  try {
    assert.ok(slots.overlays.list().some(o => o.id === tasks.LETTER_OVERLAY), 'the letter overlay is registered');
    assert.deepEqual(residentInteractables([]).map(it => it.id), RESIDENTS.map(r => r.id));
  } finally { off(); }
  assert.ok(!slots.overlays.list().some(o => o.id === tasks.LETTER_OVERLAY), 'unregistered with the chunk');
  assert.equal(inter.interactableById('favour2:baker'), undefined);
});
