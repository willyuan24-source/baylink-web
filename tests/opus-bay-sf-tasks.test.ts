import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Bilingual, DialogueNode } from '../src/opus-bay/core/types';

// Lane G2, wave 3, part b: the six city residents (G2-6 favours, G2-7 bodies, G2-11 the favour lists): who and where
// (spots checked against the published city), the favour state machine, the goal checks, the dialogue graph, the
// bodies on the resident skeleton, and the city spawn list (district unchanged).

// --- headless canvas stub (world modules create label atlases at import time; same as the contracts test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const residents = await import('../src/opus-bay/data/sf/residents');
const { RESIDENTS, TASK_ON, TASK_DONE, acceptTask, finishTask, residentByKey, residentById, taskDoneId, taskOnId, taskState, tasksDone, tasksOpen, GGB_SOUTH_TOWER } = residents;
const { BREAD_NODE, RESIDENT_SOURCES, TASK_TEXT, nodeIds, residentDialogue } = await import('../src/opus-bay/data/sf/dialogue');
const { goalMet, entryNode, arrivalStep } = await import('../src/opus-bay/game/residentTasks');
const { CITY_NPC_DEFS, NPC_DEFS, Npc, npcDefsFor, RESIDENT_HIDE, RESIDENT_SHOW, RESIDENT_LOAD } = await import('../src/opus-bay/actors/npcs');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { buildResident } = await import('../src/opus-bay/actors/residentLooks');
const { NPC_BONES, characterMaterial } = await import('../src/opus-bay/actors/models');
const { CITY_POIS, ZH_GLOSSARY } = await import('../src/opus-bay/data/sf/cityPois');
const { CITY_POSTCARDS } = await import('../src/opus-bay/data/sf/postcards');
const { ASSETS } = await import('../src/opus-bay/data/assets');
const { SF_LANDMARKS, sfLandmark, worldToLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
const { GGB } = await import('../src/opus-bay/world/sf/landmarks/golden-gate-bridge');
const { goalKeyOf } = await import('../src/opus-bay/game/flow');
const { game } = await import('../src/opus-bay/core/store');
const { goalTargets, residentInteractables } = await import('../src/opus-bay/game/cityContent');
const { DISTRICT } = await import('../src/opus-bay/data/district');

const root = path.resolve(import.meta.dirname, '..');
const bubbleWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const filled = (text: Bilingual | undefined, where: string, zhMax = 45) => {
  assert.ok(text && text.zh.trim() && text.en.trim(), `${where}: bilingual text`);
  assert.ok(/[一-鿿]/.test(text.zh), `${where}: zh has Chinese`);
  assert.ok(!/[一-鿿]/.test(text.en), `${where}: en has no Chinese`);
  assert.ok(bubbleWidth(text.zh) <= zhMax, `${where}: zh ≤ ${zhMax} (${bubbleWidth(text.zh)}): ${text.zh}`);
  for (const [from] of ZH_GLOSSARY) assert.ok(!text.zh.includes(from), `${where}: zh glossary (“${from}”)`);
};

// ---------------------------------------------------------------------------
// Who and where
// ---------------------------------------------------------------------------

test('G2-6: six residents with their portrait ids, names, favours and targets', () => {
  assert.deepEqual(RESIDENTS.map(r => r.key), ['gripman', 'baker', 'muralist', 'gardener', 'ranger', 'record-store']);
  const places = (JSON.parse(fs.readFileSync(path.join(root, 'public/opus-bay/sf/v1/places.json'), 'utf8')) as { places: { id: string; x: number; z: number }[] }).places;
  for (const r of RESIDENTS) {
    assert.equal(r.id, `npc-${r.key}`);
    assert.equal(residentByKey(r.key), r);
    assert.equal(residentById(r.id), r);
    assert.ok(ASSETS.portraits[r.id], `${r.id}: a dialogue portrait`);
    filled(r.name, `${r.key} name`, 12);
    assert.ok(r.name.zh.includes(r.short.zh) && r.name.en.includes(r.short.en), `${r.key}: the first name is in the name`);
    filled(r.place, `${r.key} place`, 20);
    filled(r.task.title, `${r.key} title`, 18);
    filled(r.task.hint, `${r.key} hint`, 30);
    filled(r.task.teaser, `${r.key} teaser`, 24);
    filled(r.task.target.name, `${r.key} target name`, 24);
    // the waypoint id resolves in-game: a landmark card, a resident, or one of G1's places at the same spot
    const t = r.task.target;
    if (t.id.startsWith('sf:')) {
      const poi = CITY_POIS.find(p => p.id === t.id);
      assert.ok(poi && dist(poi.position, t) < 0.5, `${r.key}: ${t.id} is a landmark card at the target`);
    } else if (t.id.startsWith('place:')) {
      const place = places.find(p => p.id === t.id.slice(6));
      assert.ok(place && dist(place, t) < 0.5, `${r.key}: ${t.id} is a G1 place at the target`);
    } else {
      const other = residentById(t.id);
      assert.ok(other && dist(other.at, t) < 0.5, `${r.key}: ${t.id} is a resident at the target`);
    }
  }
  // the favours' goals
  assert.deepEqual(RESIDENTS.map(r => r.task.goal.kind), ['ride', 'deliver', 'postcard', 'reach', 'deck', 'reach']);
  const card = RESIDENTS[2].task.goal;
  assert.ok(card.kind === 'postcard' && CITY_POSTCARDS.some(c => c.id === card.card), 'Luz asks for a real city postcard');
  assert.ok(card.kind === 'postcard' && dist(CITY_POSTCARDS.find(c => c.id === card.card)!.position, RESIDENTS[2].task.target) < 12, '…found in Clarion Alley');
  const tulips = RESIDENTS[3].task.goal, peaks = RESIDENTS[5].task.goal;
  assert.ok(tulips.kind === 'reach' && dist(tulips, sfLandmark('dutch-windmill')!) < 20, 'the tulip garden is by the windmill');
  assert.ok(peaks.kind === 'reach' && dist(peaks, sfLandmark('twin-peaks')!) < 2 && peaks.minY! <= (sfLandmark('twin-peaks')!.base as number), 'Twin Peaks at the lookout');
  // the south tower place sits at local x = −TOWER on the bridge
  const local = worldToLandmark(sfLandmark('golden-gate-bridge')!, GGB_SOUTH_TOWER);
  assert.ok(Math.abs(local.x + GGB.TOWER) < 3 && Math.abs(local.z) < 3, `south tower at local ${local.x.toFixed(1)}, ${local.z.toFixed(1)}`);
});

test('G2-6: every resident stands in the published city, off the road, in its neighbourhood, reachable from ferry-gate, clear of other prompts', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain, surfaceAt, zoneAt } = await import('../src/opus-bay/core/terrain');
  const { buildTransit } = await import('../src/opus-bay/data/transit');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const r of RESIDENTS) await sf.attachAround(city, r.at.x, r.at.z, 20, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const transit = buildTransit(JSON.parse(fs.readFileSync(path.join(sf.base, 'transit.json'), 'utf8')));
  const prompts = [
    ...CITY_POIS.map(p => ({ id: p.id, ...p.position })),
    ...CITY_POSTCARDS.map(c => ({ id: c.id, ...c.position })),
    ...transit.stations.map(s => ({ id: `station ${s.id}`, x: s.x, z: s.z })),
    ...transit.turntables.map(t => ({ id: `turntable ${t.name.en}`, x: t.x, z: t.z })),
  ];
  try {
    const ix = await sf.graphIndex();
    const ferry = DISTRICT.anchors['ferry-gate'];
    const home = ix.component(ix.nearestNode(ferry.x, ferry.z, 60));
    for (const r of RESIDENTS) {
      // room around them (0.9 u): a resident never plugs a narrow sidewalk
      assert.ok(canStand(r.at.x, r.at.z, 0.9), `${r.key}: standable with room around`);
      assert.notEqual(surfaceAt(r.at.x, r.at.z), 'road', `${r.key}: not on the road`);
      assert.equal(zoneAt(r.at.x, r.at.z)?.id, r.zone, `${r.key}: in ${r.zone}`);
      const n = ix.nearestNode(r.at.x, r.at.z, 10);
      assert.ok(n >= 0 && ix.component(n) === home, `${r.key}: reachable from ferry-gate`);
      for (const p of prompts) assert.ok(dist(r.at, p) >= 7.5, `${r.key}: ≥ 7.5 u from ${p.id} (${dist(r.at, p).toFixed(1)})`);
      for (const o of RESIDENTS) if (o !== r) assert.ok(dist(r.at, o.at) > 100, `${r.key} vs ${o.key}`);
      // BAYBAY finds a spot beside them in the real street from wherever you can walk up to talk (2 u, 8 ways)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, p = { x: r.at.x + Math.sin(a) * 2, z: r.at.z + Math.cos(a) * 2 };
        if (!canStand(p.x, p.z, 0.3)) continue;
        const m = residents.asideMark(p, r, p, (x, z) => canStand(x, z, 0.45));
        assert.ok(m, `${r.key}: a spot for BAYBAY when you talk from ${k * 45}°`);
      }
    }
  } finally { setCityTerrain(null); }
});

// ---------------------------------------------------------------------------
// Favour state (goalsDone marks)
// ---------------------------------------------------------------------------

test('G2-6: favour state: new → on (task-on:) → done (task:, the on mark dropped); idempotent; counts', () => {
  let done: string[] = ['hood:mission'];
  assert.equal(taskState(done, 'baker'), 'new');
  done = acceptTask(done, 'baker');
  assert.deepEqual(done, ['hood:mission', `${TASK_ON}baker`]);
  assert.equal(taskState(done, 'baker'), 'on');
  assert.deepEqual(acceptTask(done, 'baker'), done, 'accepting twice changes nothing');
  assert.deepEqual(tasksOpen(done).map(r => r.key), ['baker']);
  done = finishTask(done, 'baker');
  assert.deepEqual(done, ['hood:mission', `${TASK_DONE}baker`]);
  assert.equal(taskState(done, 'baker'), 'done');
  assert.deepEqual(finishTask(done, 'baker'), done);
  assert.deepEqual(acceptTask(done, 'baker'), done, 'a done favour is not taken again');
  assert.equal(tasksDone(done), 1);
  assert.deepEqual(tasksOpen(done), []);
  // a favour can finish without being accepted first (the delivery path never skips it, but the marks stay clean)
  assert.deepEqual(finishTask([], 'ranger'), [taskDoneId('ranger')]);
  // no favour mark is a GoalKey word (completeGoal must never tick one) and none is a FREE_GOALS id
  for (const r of RESIDENTS) {
    assert.equal(goalKeyOf(taskOnId(r.key)), null, taskOnId(r.key));
    assert.equal(goalKeyOf(taskDoneId(r.key)), null, taskDoneId(r.key));
  }
});

test('G2-6: goal checks: being there on your own (not flying, not travelling), the postcard, the bridge deck', () => {
  const s = (x: number, z: number, y = 0, mode: 'foot' | 'glide' | 'bike' | 'travel' = 'foot', travelling = false, postcards: string[] = []) => ({ x, y, z, mode, travelling, postcards });
  const tulips = RESIDENTS[3].task.goal, peaks = RESIDENTS[5].task.goal, deck = RESIDENTS[4].task.goal, card = RESIDENTS[2].task.goal;
  assert.ok(tulips.kind === 'reach' && peaks.kind === 'reach' && deck.kind === 'deck' && card.kind === 'postcard');
  assert.ok(goalMet(tulips, s(tulips.x + 5, tulips.z)));
  assert.ok(goalMet(tulips, s(tulips.x + 5, tulips.z, 0, 'bike')), 'by bike');
  assert.ok(!goalMet(tulips, s(tulips.x + 5, tulips.z, 0, 'glide')), 'not on the pelican');
  assert.ok(!goalMet(tulips, s(tulips.x + 5, tulips.z, 0, 'foot', true)), 'not in fast travel');
  assert.ok(!goalMet(tulips, s(tulips.x + tulips.r + 1, tulips.z)), 'too far');
  assert.ok(goalMet(peaks, s(peaks.x, peaks.z + 10, peaks.minY! + 1)));
  assert.ok(!goalMet(peaks, s(peaks.x, peaks.z + 10, peaks.minY! - 5)), 'below the lookout (a tunnel / the slope under it)');
  assert.ok(goalMet(card, s(0, 0, 0, 'foot', false, [card.card])));
  assert.ok(!goalMet(card, s(0, 0)));
  const bridge = sfLandmark('golden-gate-bridge')!;
  const local = (p: { x: number; z: number }) => worldToLandmark(bridge, p);
  const onDeck = (lx: number, lz: number) => { const c = Math.cos(bridge.yaw), sn = Math.sin(bridge.yaw); return { x: bridge.x + lx * c + lz * sn, z: bridge.z - lx * sn + lz * c }; };
  const tower = onDeck(-GGB.TOWER + 4, 1);
  assert.ok(Math.abs(local(tower).x - (-GGB.TOWER + 4)) < 1e-6, 'inverse of worldToLandmark');
  assert.ok(goalMet(deck, s(tower.x, tower.z, GGB.DECK), local), 'on the deck at the south tower');
  assert.ok(!goalMet(deck, s(tower.x, tower.z, 0), local), 'under the deck (Fort Point)');
  const north = onDeck(GGB.TOWER, 0);
  assert.ok(!goalMet(deck, s(north.x, north.z, GGB.DECK), local), 'the north tower is not the south one');
  assert.ok(!goalMet(deck, s(tower.x, tower.z, GGB.DECK, 'glide'), local), 'not flying past');
  assert.ok(!goalMet({ kind: 'ride' }, s(0, 0)) && !goalMet({ kind: 'deliver', to: 'gripman' }, s(0, 0)), 'events finish those');
});

test('G2-review: a place favour counts when you get there yourself, not when 飞过去 or the pelican drops you there', () => {
  type M = 'foot' | 'glide' | 'bike' | 'car' | 'travel' | 'transit';
  const s = (x: number, z: number, y = 50, mode: M = 'foot', travelling = false) => ({ x, y, z, mode, travelling, postcards: [] as string[] });
  const peaks = RESIDENTS[5].task.goal, tulips = RESIDENTS[3].task.goal, deck = RESIDENTS[4].task.goal;
  assert.ok(peaks.kind === 'reach' && tulips.kind === 'reach' && deck.kind === 'deck');
  const at = s(peaks.x, peaks.z + 5), out = s(peaks.x + peaks.r + 30, peaks.z);
  // walked up: armed on the way (outside the lookout), counts on arrival
  let a = { armed: false, epoch: null as number | null };
  assert.ok(!arrivalStep(a, peaks, out, 1));
  assert.ok(arrivalStep(a, peaks, at, 1), 'walked in');
  // 飞过去 to the lookout: the trip bumps the epoch; standing where it lands does not count (the old code finished it)
  a = { armed: false, epoch: null };
  assert.ok(!arrivalStep(a, peaks, out, 1), 'accepted far away: armed');
  assert.ok(!arrivalStep(a, peaks, s(peaks.x, peaks.z, 200, 'travel', true), 2), 'in the air');
  for (let i = 0; i < 8; i++) assert.ok(!arrivalStep(a, peaks, at, 2), 'landed on the lookout: not yet');
  assert.ok(!arrivalStep(a, peaks, out, 2), 'step out…');
  assert.ok(arrivalStep(a, peaks, at, 2), '…and back in: counts');
  // a trip that lands elsewhere, then walking in, counts
  a = { armed: true, epoch: 1 };
  assert.ok(!arrivalStep(a, tulips, s(tulips.x + 60, tulips.z, 0), 2));
  assert.ok(arrivalStep(a, tulips, s(tulips.x + 2, tulips.z, 0, 'bike'), 2), 'by bike after the trip');
  // the pelican lands you in the garden (same epoch): not until you step out and back
  a = { armed: false, epoch: null };
  assert.ok(!arrivalStep(a, tulips, s(tulips.x + 60, tulips.z, 0), 3));
  assert.ok(!arrivalStep(a, tulips, s(tulips.x + 2, tulips.z, 30, 'glide'), 3));
  assert.ok(!arrivalStep(a, tulips, s(tulips.x + 2, tulips.z, 0), 3), 'landed in the garden');
  // a transit car neither arms nor disarms
  a = { armed: false, epoch: null };
  assert.ok(!arrivalStep(a, tulips, s(tulips.x + 60, tulips.z, 0, 'transit'), 3));
  assert.ok(!arrivalStep(a, tulips, s(tulips.x + 2, tulips.z, 0), 3), 'never armed on your own');
  // the bridge deck: walked from the bridge end to the south tower counts, flown onto it does not
  const bridge = sfLandmark('golden-gate-bridge')!;
  const local = (p: { x: number; z: number }) => worldToLandmark(bridge, p);
  const onDeck = (lx: number, lz: number) => { const c = Math.cos(bridge.yaw), sn = Math.sin(bridge.yaw); return { x: bridge.x + lx * c + lz * sn, z: bridge.z - lx * sn + lz * c }; };
  const end = onDeck(-GGB.TOWER - 40, 0), tower = onDeck(-GGB.TOWER + 3, 0);
  a = { armed: false, epoch: null };
  assert.ok(!arrivalStep(a, deck, s(end.x, end.z, GGB.DECK), 4, local));
  assert.ok(arrivalStep(a, deck, s(tower.x, tower.z, GGB.DECK), 4, local), 'walked the deck');
  a = { armed: false, epoch: null };
  assert.ok(!arrivalStep(a, deck, s(end.x, end.z, GGB.DECK + 20, 'glide'), 4, local));
  assert.ok(!arrivalStep(a, deck, s(tower.x, tower.z, GGB.DECK), 4, local), 'landed at the tower');
});

test('G2-6: a chat opens the node the favour asks for; Ray takes the loaf first', () => {
  const rosa = residentByKey('baker')!, ray = residentByKey('gripman')!;
  assert.equal(entryNode(rosa, [], false), nodeIds('baker').hi);
  assert.equal(entryNode(rosa, [], true), nodeIds('baker').ask, 'met already this visit: straight to the ask');
  assert.equal(entryNode(rosa, [taskOnId('baker')], true), nodeIds('baker').remind);
  assert.equal(entryNode(rosa, [taskDoneId('baker')], false), nodeIds('baker').thanks);
  assert.equal(entryNode(ray, [taskOnId('baker')], false), BREAD_NODE);
  assert.equal(entryNode(ray, [taskOnId('baker'), taskOnId('gripman')], true), BREAD_NODE);
  assert.equal(entryNode(ray, [taskDoneId('baker'), taskOnId('gripman')], true), nodeIds('gripman').remind);
});

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

test('G2-6: the residents’ dialogue graph resolves: bilingual, bubble length, portraits by id, answers, sources', () => {
  const nodes = residentDialogue();
  const byId = new Map<string, DialogueNode>(nodes.map(n => [n.id, n]));
  assert.equal(byId.size, nodes.length, 'unique ids');
  for (const n of nodes) {
    filled(n.text, n.id);
    assert.ok(n.text.en.length <= 120, `${n.id}: en ≤ 120`);
    assert.ok(!/按\s?[A-Z]\b|press [A-Z]\b|点击|tap\b|click/i.test(n.text.zh + n.text.en), `${n.id}: no controller-specific words`);
    assert.equal(n.speaker, 'npc');
    assert.match(n.id, /^npc\.[a-z-]+\./, `${n.id}: npc.<key> (the portrait follows the id)`);
    const key = /^npc\.([a-z-]+)\./.exec(n.id)![1];
    assert.ok(residentByKey(key), `${n.id}: a resident`);
    assert.deepEqual(n.npcName, residentByKey(key)!.name);
    assert.ok(!(n.next && n.choices?.length), `${n.id}: next and choices are exclusive`);
    assert.ok(n.next || n.choices?.length || n.action?.type === 'end', `${n.id}: ends or goes on`);
    if (n.next) assert.ok(byId.has(n.next), `${n.id}: next ${n.next}`);
    const hot = new Set<string>();
    for (const c of n.choices ?? []) {
      filled(c.label, `${n.id} choice`, 10);
      assert.match(c.hotkey ?? '', /^[1-9]$/);
      assert.ok(!hot.has(c.hotkey!), `${n.id}: unique hotkeys`); hot.add(c.hotkey!);
      assert.ok(c.next ? byId.has(c.next) : c.action?.type === 'end', `${n.id}: choice → ${c.next ?? c.action?.type}`);
    }
  }
  for (const r of RESIDENTS) {
    const ids = nodeIds(r.key);
    for (const id of Object.values(ids)) assert.ok(byId.has(id), `${r.key}: ${id}`);
    assert.equal(byId.get(ids.hi)!.next, ids.ask);
    assert.deepEqual(byId.get(ids.ask)!.choices!.map(c => c.next), [ids.yes, ids.no]);
    assert.deepEqual(byId.get(ids.remind)!.choices!.map(c => c.next ?? 'end'), [ids.go, 'end']);
    assert.equal(byId.get(ids.thanks)!.next, ids.fact);
    // every favour has at least one sourced fact, and every source is a live node with a URL and a date
    assert.ok(Object.keys(RESIDENT_SOURCES).some(id => id.startsWith(`npc.${r.key}.`)), `${r.key}: a sourced fact`);
  }
  assert.ok(byId.has(BREAD_NODE) && byId.has(byId.get(BREAD_NODE)!.next!));
  for (const [id, src] of Object.entries(RESIDENT_SOURCES)) {
    assert.ok(byId.has(id), `source for a live node: ${id}`);
    assert.match(src.url, /^https:\/\//);
    assert.match(src.verifiedAt, /^2026-\d\d-\d\d$/);
  }
  // the toasts / BAYBAY line around a favour
  filled(TASK_TEXT.accepted(RESIDENTS[0].task.title), 'accepted toast');
  filled(TASK_TEXT.done(RESIDENTS[0].task.title), 'done toast');
  for (const r of RESIDENTS) filled(TASK_TEXT.tellThem(r.short), `${r.key} tell them`);
  filled(TASK_TEXT.allDone, 'all done');
});

// ---------------------------------------------------------------------------
// Bodies, spawning, interactables, waypoints
// ---------------------------------------------------------------------------

test('G2-7: bodies on the resident skeleton, the shared character material, 2–5k triangles each', () => {
  const names = NPC_BONES.map(b => b.name);
  for (const r of RESIDENTS) {
    const rig = buildResident(r.key);
    assert.deepEqual(Object.keys(rig.bones).sort(), [...names].sort(), `${r.key}: NPC_BONES`);
    assert.equal(rig.mesh.material, characterMaterial(), `${r.key}: the shared character material (no new program)`);
    assert.ok(rig.mesh.isSkinnedMesh);
    const tris = rig.mesh.geometry.index!.count / 3;
    assert.ok(tris >= 2000 && tris <= 5000, `${r.key}: ${tris} triangles`);
    assert.ok(rig.height > 1.25 && rig.height < 1.75, `${r.key}: ${rig.height.toFixed(2)} u tall`);
    rig.mesh.geometry.dispose(); rig.mesh.skeleton.dispose();
  }
});

test('G2-review: a resident body builds once near, and never after its ActorSystem let it go', async () => {
  const tick = () => new Promise(res => setTimeout(res, 0));
  const def = CITY_NPC_DEFS.find(d => d.resident === 'baker')!;
  const saved = { x: runtime.player.x, z: runtime.player.z };
  try {
    runtime.player.x = def.at!.x + 2; runtime.player.z = def.at!.z;
    // near: the body is fetched, built and shown
    const a = new Npc(def);
    const standIn = a.rig;
    a.update(0.016, 0);
    for (let i = 0; i < 40 && a.rig === standIn; i++) await tick();
    a.update(0.016, 0.1);
    assert.notEqual(a.rig, standIn, 'body built');
    assert.ok(a.visible && a.object.visible, 'shown');
    // released while its body is still loading (the system disposed): nothing is built, it stays hidden
    const b = new Npc(def);
    const standInB = b.rig;
    b.update(0.016, 0);
    b.release();
    for (let i = 0; i < 40; i++) await tick();
    b.update(0.016, 0.1);
    assert.equal(b.rig, standInB, 'no orphan body after release');
    assert.ok(!b.visible && !b.object.visible);
    a.rig.mesh.geometry.dispose(); a.rig.mesh.skeleton.dispose(); b.rig.mesh.geometry.dispose(); b.rig.mesh.skeleton.dispose();
  } finally { runtime.player.x = saved.x; runtime.player.z = saved.z; }
});

test('G2-7: city mode spawns the six at their spots; district mode unchanged', () => {
  assert.deepEqual(npcDefsFor('district'), NPC_DEFS);
  const city = npcDefsFor('city');
  assert.deepEqual(city.slice(0, NPC_DEFS.length), NPC_DEFS, 'the waterfront residents stay');
  assert.deepEqual(city.slice(NPC_DEFS.length), CITY_NPC_DEFS);
  for (const [i, r] of RESIDENTS.entries()) {
    const d = CITY_NPC_DEFS[i];
    assert.equal(d.id, r.id);
    assert.equal(d.resident, r.key);
    assert.deepEqual(d.at, { x: r.at.x, z: r.at.z, heading: r.at.heading });
    assert.notEqual(d.talks, false);
  }
  assert.ok(RESIDENT_SHOW < RESIDENT_HIDE && RESIDENT_HIDE < RESIDENT_LOAD && RESIDENT_HIDE <= 160, 'hide by ~160 u, build before they show');
});

test('G2-6: in a chat BAYBAY stands beside the resident, never between the two-shot camera and them', () => {
  const { asideMark, ASIDE_SPOTS } = residents;
  const r = RESIDENTS[1];
  const open = () => true;
  // mirrors actors/camera.ts twoShotPose: behind the player, 0.43 / 0.66 / 0.99 rad off the player → speaker line,
  // TWO_DIST 8 (6.4 in portrait) + 0.6 per u beyond 2.5 from the pair's midpoint
  for (const L of [1.4, 2.2, 3.2]) {
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2, ax = -Math.sin(a0), az = -Math.cos(a0);
      const p = { x: r.at.x - ax * L, z: r.at.z - az * L };
      for (const guideSide of [1, -1]) {
        const guide = { x: p.x + az * guideSide, z: p.z - ax * guideSide };
        const m = asideMark(p, r, guide, open)!;
        assert.ok(m, 'a mark on open ground');
        assert.ok(dist(m, r.at) >= 1.1 && dist(m, r.at) <= 2, 'beside them');
        assert.ok(dist(m, p) > L, 'not between you and them');
        // she keeps the side she is on (no walk across the pair)
        assert.ok(((m.x - r.at.x) * az - (m.z - r.at.z) * ax) * guideSide > 0, 'the side she is on');
        for (const R0 of [8, 6.4]) {
          for (const ang of [0.43, 0.66, 0.99]) {
            for (const sign of [1, -1]) {
              const mx = (p.x + r.at.x) / 2, mz = (p.z + r.at.z) / 2, R = R0 + Math.max(0, L - 2.5) * 0.6;
              const c = Math.cos(sign * ang), s = Math.sin(sign * ang);
              const cam = { x: mx + (-ax * c + az * s) * R, z: mz + (-ax * s - az * c) * R };
              const dR = dist(cam, r.at), dB = dist(cam, m);
              let sep = Math.abs(Math.atan2(m.x - cam.x, m.z - cam.z) - Math.atan2(r.at.x - cam.x, r.at.z - cam.z));
              if (sep > Math.PI) sep = 2 * Math.PI - sep;
              // in front of them only with clear air between (BAYBAY ≈ 0.45 u, a resident ≈ 0.4 u half-width)
              if (dB < dR) assert.ok(sep > Math.asin(0.45 / dB) + Math.asin(0.4 / dR), `L ${L}, ${k * 45}°, camera ${R0} ${sign * ang}: BAYBAY blocks the resident`);
            }
          }
        }
      }
    }
  }
  // no room on her side: the other side; no room anywhere: she stays put
  const p = { x: r.at.x, z: r.at.z - 2 };
  const westOnly = (x: number) => x < r.at.x;
  const m = asideMark(p, r, { x: r.at.x + 1, z: p.z }, westOnly)!;
  assert.ok(m.x < r.at.x);
  assert.equal(asideMark(p, r, p, () => false), null);
  assert.equal(ASIDE_SPOTS.length, 3);
});

test('G2-6: 附近有什么？ names a neighbour within a minute whose favour is new (city only)', async () => {
  const { neighbourNearby, NEIGHBOUR_NEAR } = await import('../src/opus-bay/game/flow');
  const rosa = residentByKey('baker')!, ray = residentByKey('gripman')!;
  const near = { x: rosa.at.x + 6, z: rosa.at.z };
  const was = game.get().worldMode;
  try {
    game.set({ worldMode: 'district', goalsDone: [] });
    assert.equal(neighbourNearby(near), undefined, 'district: no city residents');
    game.set({ worldMode: 'city' });
    assert.equal(neighbourNearby(near)?.key, 'baker');
    assert.ok(dist(rosa.at, ray.at) < NEIGHBOUR_NEAR);
    game.set({ goalsDone: [taskOnId('baker')] });
    assert.equal(neighbourNearby(near)?.key, 'gripman', 'Rosa said yes already: the next one in reach');
    game.set({ goalsDone: [taskOnId('baker'), taskDoneId('gripman')] });
    assert.equal(neighbourNearby(near), undefined, 'nobody new in reach');
    game.set({ goalsDone: [] });
    assert.equal(neighbourNearby({ x: rosa.at.x + 1, z: rosa.at.z })?.key, 'gripman', 'not the one you are standing next to');
  } finally { game.set({ worldMode: was, goalsDone: [] }); }
});

test('G2-6: residents are talk interactables (the verb follows the loaf); accepted favours lead the waypoints', () => {
  const its = residentInteractables([]);
  assert.deepEqual(its.map(it => it.id), RESIDENTS.map(r => r.id));
  for (const it of its) {
    const r = residentById(it.id)!;
    assert.equal(it.source, 'npc'); assert.equal(it.action, 'talk'); assert.equal(it.npc, r.key);
    assert.deepEqual({ x: it.x, z: it.z }, { x: r.at.x, z: r.at.z });
  }
  assert.equal(residentInteractables([taskOnId('baker')]).find(it => it.id === 'npc-gripman')!.verb.en, 'Give Ray the loaf');
  // goalTargets: nothing in district mode; in city mode an accepted favour comes first, and goes once done
  assert.deepEqual(goalTargets(), []);
  const was = game.get().worldMode;
  try {
    game.set({ worldMode: 'city', goalsDone: [taskOnId('ranger')] });
    const t = goalTargets();
    assert.equal(t[0].id, GGB_SOUTH_TOWER.id);
    assert.equal(t[0].goal, taskDoneId('ranger'));
    assert.ok(t[0].first && t.slice(1).every(x => !x.first));
    game.set({ goalsDone: [taskDoneId('ranger')] });
    assert.ok(goalTargets().every(x => !x.first));
  } finally { game.set({ worldMode: was, goalsDone: [] }); }
});
