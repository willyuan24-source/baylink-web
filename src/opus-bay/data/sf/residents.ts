import type { Bilingual, Vec2 } from '../../core/types';

/**
 * Six fictional city residents with a small favour each (lane G2, plans G2-6 / G2-11). Data only (type imports), so the
 * main graph pays a few hundred bytes for it: the dialogue is data/sf/dialogue.ts and the task runtime
 * game/residentTasks.ts (both in their own chunk, city mode only), the bodies actors/residentLooks.ts (its own chunk).
 *
 *   RESIDENTS         who, where (a standable, reachable spot ≥ 7.5 u from every card, postcard and station, checked
 *                     against the published city in tests/opus-bay-sf-tasks.test.ts), their idle, their favour
 *   taskState(...)    'new' | 'on' | 'done' from goalsDone: `task-on:<key>` while accepted, `task:<key>` once done
 *                     (the `task-on:` mark is dropped then, so a save never holds more than one mark per resident)
 *   task2 · task2State · letterState   wave 5 (W5-C7, plan §3.5 "Resident letters"): each resident's SECOND favour,
 *                     asked once the first is done (`task2-on:<key>` → `task2:<key>`; a photo favour notes each spot
 *                     photographed as `task2-p:<key>:<spot>` until it is done), with two new goal kinds — `photo`
 *                     (a shutter within a spot's radius) and `play` (lane A's activities) —; it leaves a mark (Luz's
 *                     otter in Balmy Alley, Ray's riff when you pass, the words they say after) and, a little later,
 *                     a letter (`letter:<key>` when it arrives, `letter-read:<key>` once opened; data/sf/letters.ts)
 *
 * First names only, no business names; every fact a resident says is in data/sf/dialogue.ts with its source.
 */

export type ResidentKey = 'gripman' | 'baker' | 'muralist' | 'gardener' | 'ranger' | 'record-store';

/** What finishes a favour (game/residentTasks.ts watches it). */
export type TaskGoal =
  /** a counted cable-car ride (lane F's `transit` event, what 'ride', real) after accepting */
  | { kind: 'ride' }
  /** talk to another resident while the favour is on (a delivery) */
  | { kind: 'deliver'; to: ResidentKey }
  /** hold this postcard (already holding it when you accept counts) */
  | { kind: 'postcard'; card: string }
  /** stand within `r` u of a spot (y ≥ `minY` when given), on your own feet, bike or car: not flying, not travelling */
  | { kind: 'reach'; x: number; z: number; r: number; minY?: number }
  /** on the Golden Gate deck within `r` u (along the bridge) of the south tower */
  | { kind: 'deck'; r: number }
  /** wave 5 (W5-C7): a photo (any shutter: photo mode, lane A's lean-out) taken within each spot's radius, `need` spots */
  | { kind: 'photo'; spots: readonly PhotoSpot[]; need: number }
  /** wave 5 (W5-C7): lane A's activity finished (`play` … `end`); with `spot`, the view look at that spot (`find view`) */
  | { kind: 'play'; activity: string; spot?: string };

/** A place a photo favour asks for: its id (the progress mark), where (x, z) and how near (u), its name in lists. */
export interface PhotoSpot { id: string; x: number; z: number; r: number; name: Bilingual }

export interface ResidentTask {
  goal: TaskGoal;
  /** the favour in lists (GoalsCard, Journal), zh ≤ 16 */
  title: Bilingual;
  /** where to go / what to do, zh ≤ 30 */
  hint: Bilingual;
  /** the list line before you have met them */
  teaser: Bilingual;
  /** the waypoint and "带我去": an id interactableById resolves (a card, a resident, G1's `place:<id>`) and its spot */
  target: { id: string; x: number; z: number; name: Bilingual; r: number };
}

/** Idle the resident plays now and then (actors/npcs.ts maps it onto an animator emote and a held pose). */
export type ResidentIdle = 'bell' | 'knead' | 'paint' | 'dig' | 'spot' | 'groove';

export interface ResidentDef {
  key: ResidentKey;
  /** actor + interactable id; also the dialogue portrait alias (data/assets.ts `npc-<key>`) */
  id: string;
  /** speaker name in dialogue ("面包师 Rosa") */
  name: Bilingual;
  /** first name ("Rosa") */
  short: Bilingual;
  /** world spot, heading (rad, atan2(dx, dz) toward what they watch) */
  at: Vec2 & { heading: number };
  /** far.zones neighbourhood id of the spot */
  zone: string;
  /** where they are, in words ("鲍威尔街 · 市场街转车台旁") */
  place: Bilingual;
  idle: ResidentIdle;
  task: ResidentTask;
  /** wave 5 (W5-C7): the second favour, asked once `task` is done (its `teaser` is the list line before it is asked) */
  task2: ResidentTask;
}

export const TASK_ON = 'task-on:';
export const TASK_DONE = 'task:';
export const taskOnId = (key: ResidentKey) => `${TASK_ON}${key}`;
export const taskDoneId = (key: ResidentKey) => `${TASK_DONE}${key}`;

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export const TASK2_ON = 'task2-on:';
export const TASK2_DONE = 'task2:';
export const TASK2_PHOTO = 'task2-p:';
export const LETTER = 'letter:';
export const LETTER_READ = 'letter-read:';
export const task2OnId = (key: ResidentKey) => `${TASK2_ON}${key}`;
export const task2DoneId = (key: ResidentKey) => `${TASK2_DONE}${key}`;
export const task2PhotoId = (key: ResidentKey, spot: string) => `${TASK2_PHOTO}${key}:${spot}`;
export const letterId = (key: ResidentKey) => `${LETTER}${key}`;
export const letterReadId = (key: ResidentKey) => `${LETTER_READ}${key}`;
/** The waypoint id of a second favour (game/residentTasks.ts resolves it to the spot to go to now). */
export const favour2Target = (key: ResidentKey) => `favour2:${key}`;

/** Golden Gate deck: the south tower sits at local x = −GGB.TOWER (world/sf/landmarks/golden-gate-bridge.ts). */
export const GGB_SOUTH_TOWER = { id: 'place:ggb-south-tower', x: -796.12, z: 564.38 } as const;

export const RESIDENTS: readonly ResidentDef[] = [
  {
    key: 'gripman', id: 'npc-gripman',
    name: bi('叮当车司机 Ray', 'Ray, gripman'), short: bi('Ray', 'Ray'),
    at: { x: 128.8, z: 266.2, heading: 2.96 }, zone: 'south-of-market',
    place: bi('鲍威尔街 · 市场街转车台旁', 'by the Powell & Market turntable'),
    idle: 'bell',
    task: {
      goal: { kind: 'ride' },
      title: bi('帮 Ray 试坐叮当车', 'Test-ride a cable car for Ray'),
      hint: bi('在转车台上车，多坐几站再下', 'Board at the turntable and ride a few stops'),
      teaser: bi('鲍威尔街 · 市场街转车台旁的叮当车司机', 'A gripman by the Powell & Market turntable'),
      target: { id: 'sf:cable-car-turntable', x: 131.58, z: 254.17, name: bi('叮当车 · 鲍威尔街 · 市场街转车台', 'Cable car · Powell & Market turntable'), r: 4 },
    },
    task2: {
      goal: { kind: 'play', activity: 'bell' },
      title: bi('陪 Ray 摇一段铃', 'Ring a bell riff for Ray'),
      hint: bi('坐上叮当车，车开起来就能摇铃', 'Ride a cable car and ring once it rolls'),
      teaser: bi('Ray 还想请你帮个忙', 'Ray has one more favour'),
      target: { id: 'sf:cable-car-turntable', x: 131.58, z: 254.17, name: bi('叮当车 · 鲍威尔街 · 市场街转车台', 'Cable car · Powell & Market turntable'), r: 4 },
    },
  },
  {
    key: 'baker', id: 'npc-baker',
    name: bi('面包师 Rosa', 'Rosa, baker'), short: bi('Rosa', 'Rosa'),
    at: { x: -63.9, z: 101.6, heading: -0.89 }, zone: 'north-beach',
    place: bi('北滩 · 华盛顿广场旁', 'by Washington Square, North Beach'),
    idle: 'knead',
    task: {
      goal: { kind: 'deliver', to: 'gripman' },
      title: bi('把面包送给 Ray', 'Take the loaf to Ray'),
      hint: bi('Ray 在鲍威尔街 · 市场街转车台旁', 'Ray is by the Powell & Market turntable'),
      teaser: bi('北滩华盛顿广场旁的面包师', 'A baker by Washington Square in North Beach'),
      target: { id: 'npc-gripman', x: 128.8, z: 266.2, name: bi('叮当车司机 Ray', 'Ray, gripman'), r: 3 },
    },
    task2: {
      goal: { kind: 'photo', need: 1, spots: [{ id: 'ferry-clock', x: 133.02, z: -4.91, r: 45, name: bi('渡轮大厦钟楼', 'Ferry Building clock tower') }] },
      title: bi('给 Rosa 拍渡轮大厦钟楼', 'Photograph the Ferry Building for Rosa'),
      hint: bi('在渡轮大厦附近拍一张照片', 'Take a photo near the Ferry Building'),
      teaser: bi('Rosa 还想请你帮个忙', 'Rosa has one more favour'),
      target: { id: 'favour2:baker', x: 133.02, z: -4.91, name: bi('渡轮大厦钟楼', 'Ferry Building clock tower'), r: 12 },
    },
  },
  {
    key: 'muralist', id: 'npc-muralist',
    name: bi('画壁画的 Luz', 'Luz, muralist'), short: bi('Luz', 'Luz'),
    at: { x: 458.9, z: 653.4, heading: 0.98 }, zone: 'mission',
    place: bi('教会区巴尔米巷', 'Balmy Alley, the Mission'),
    idle: 'paint',
    task: {
      goal: { kind: 'postcard', card: 'sf-mission-murals' },
      title: bi('找回克拉里恩巷的明信片', 'Find the postcard in Clarion Alley'),
      hint: bi('克拉里恩巷在 17 街和 18 街之间', 'Clarion Alley runs between 17th and 18th Streets'),
      teaser: bi('教会区巴尔米巷画壁画的人', 'A muralist in Balmy Alley, the Mission'),
      target: { id: 'place:osm-w8916752', x: 261.4, z: 606.01, name: bi('克拉里恩巷', 'Clarion Alley'), r: 6 },
    },
    task2: {
      goal: {
        kind: 'photo', need: 3, spots: [
          { id: 'balmy', x: 457.1, z: 653.6, r: 16, name: bi('巴尔米巷', 'Balmy Alley') },
          { id: 'clarion', x: 258.4, z: 602.6, r: 16, name: bi('克拉里恩巷', 'Clarion Alley') },
          { id: 'womens-building', x: 263.58, z: 636.23, r: 18, name: bi('女性大楼', "The Women's Building") },
        ],
      },
      title: bi('帮 Luz 拍三处壁画', 'Photograph three murals for Luz'),
      hint: bi('巴尔米巷、克拉里恩巷、女性大楼各拍一张', "One photo each: Balmy, Clarion, Women's Building"),
      teaser: bi('Luz 还想请你帮个忙', 'Luz has one more favour'),
      target: { id: 'favour2:muralist', x: 258.4, z: 602.6, name: bi('克拉里恩巷', 'Clarion Alley'), r: 8 },
    },
  },
  {
    key: 'gardener', id: 'npc-gardener',
    name: bi('园丁 Hank', 'Hank, gardener'), short: bi('Hank', 'Hank'),
    at: { x: -169.9, z: 861.6, heading: -2.12 }, zone: 'golden-gate-park',
    place: bi('金门公园 · 花卉温室前', 'Golden Gate Park, by the Conservatory'),
    idle: 'dig',
    task: {
      goal: { kind: 'reach', x: -576.98, z: 1312.19, r: 18 },
      title: bi('去风车下看看郁金香花园', 'Check the tulip garden by the windmill'),
      hint: bi('荷兰风车在金门公园最西边', 'The Dutch Windmill is at the park’s far west end'),
      teaser: bi('金门公园花卉温室前的园丁', 'A gardener by the Conservatory of Flowers'),
      target: { id: 'place:osm-w120483945', x: -576.98, z: 1312.19, name: bi('Queen Wilhelmina 郁金香花园', 'Queen Wilhelmina Tulip Garden'), r: 8 },
    },
    task2: {
      goal: { kind: 'photo', need: 1, spots: [{ id: 'windmill', x: -584.3, z: 1315.67, r: 40, name: bi('荷兰风车', 'the Dutch Windmill') }] },
      title: bi('给 Hank 拍一张荷兰风车', 'Photograph the windmill for Hank'),
      hint: bi('走到荷兰风车附近，拍一张照片', 'Get near the Dutch Windmill and take a photo'),
      teaser: bi('Hank 还想请你帮个忙', 'Hank has one more favour'),
      target: { id: 'favour2:gardener', x: -584.3, z: 1315.67, name: bi('荷兰风车', 'Dutch Windmill'), r: 8 },
    },
  },
  {
    key: 'ranger', id: 'npc-ranger',
    name: bi('公园巡护员 Dana', 'Ranger Dana'), short: bi('Dana', 'Dana'),
    at: { x: -563.6, z: 551.1, heading: -1.51 }, zone: 'presidio',
    place: bi('要塞公园 · Crissy Field', 'Crissy Field, the Presidio'),
    idle: 'spot',
    task: {
      goal: { kind: 'deck', r: 12 },
      title: bi('沿着桥面走到南塔', 'Walk the bridge to the south tower'),
      hint: bi('从桥头走上金门大桥，到第一座桥塔', 'Walk onto the Golden Gate Bridge to the first tower'),
      teaser: bi('Crissy Field 草地上的巡护员', 'A park ranger on Crissy Field'),
      target: { ...GGB_SOUTH_TOWER, name: bi('金门大桥 · 南塔', 'Golden Gate Bridge · south tower'), r: 12 },
    },
    task2: {
      goal: { kind: 'play', activity: 'view', spot: 'crissy-beach' },
      title: bi('在克里西场海滩坐一会儿', 'Sit a while on Crissy Field beach'),
      hint: bi('在海滩的观景座位坐下，看看金门大桥', 'Sit at the beach view spot and watch the bridge'),
      teaser: bi('Dana 还想请你帮个忙', 'Dana has one more favour'),
      target: { id: 'favour2:ranger', x: -581, z: 538, name: bi('克里西场海滩', 'Crissy Field beach'), r: 4 },
    },
  },
  {
    key: 'record-store', id: 'npc-record-store',
    name: bi('唱片店老板 Marcus', 'Marcus, record-shop owner'), short: bi('Marcus', 'Marcus'),
    at: { x: -32.3, z: 762.3, heading: -1.57 }, zone: 'haight-ashbury',
    place: bi('Haight 街和 Ashbury 街口', 'the corner of Haight and Ashbury'),
    idle: 'groove',
    task: {
      goal: { kind: 'reach', x: 128.86, z: 922.32, r: 20, minY: 43 },
      title: bi('上双峰看看 Karl 来了没', 'See from Twin Peaks if Karl is in'),
      hint: bi('双峰就在城中间，顶上有观景台', 'Twin Peaks is mid-city, with a lookout on top'),
      teaser: bi('Haight 街口开唱片店的人', 'A record-shop owner at Haight and Ashbury'),
      target: { id: 'sf:twin-peaks', x: 128.86, z: 922.32, name: bi('双峰观景台', 'Twin Peaks lookout'), r: 4 },
    },
    task2: {
      goal: { kind: 'photo', need: 1, spots: [{ id: 'hippie-hill', x: -142.9, z: 852.1, r: 30, name: bi('嬉皮山', 'Hippie Hill') }] },
      title: bi('替 Marcus 拍一张嬉皮山', 'Photograph Hippie Hill for Marcus'),
      hint: bi('嬉皮山在花卉温室和海特街之间', 'Between the Conservatory and Haight Street'),
      teaser: bi('Marcus 还想请你帮个忙', 'Marcus has one more favour'),
      target: { id: 'favour2:record-store', x: -142.9, z: 852.1, name: bi('嬉皮山', 'Hippie Hill'), r: 8 },
    },
  },
];

export const residentByKey = (key: string): ResidentDef | undefined => RESIDENTS.find(r => r.key === key);
export const residentById = (id: string): ResidentDef | undefined => RESIDENTS.find(r => r.id === id);

export type TaskState = 'new' | 'on' | 'done';

export function taskState(goalsDone: readonly string[], key: ResidentKey): TaskState {
  if (goalsDone.includes(taskDoneId(key))) return 'done';
  return goalsDone.includes(taskOnId(key)) ? 'on' : 'new';
}

/** goalsDone after accepting (unchanged when already on or done). */
export function acceptTask(goalsDone: readonly string[], key: ResidentKey): string[] {
  return taskState(goalsDone, key) === 'new' ? [...goalsDone, taskOnId(key)] : [...goalsDone];
}

/** goalsDone after finishing: the `task-on:` mark is replaced by `task:` (unchanged when already done). */
export function finishTask(goalsDone: readonly string[], key: ResidentKey): string[] {
  if (taskState(goalsDone, key) === 'done') return [...goalsDone];
  return [...goalsDone.filter(id => id !== taskOnId(key)), taskDoneId(key)];
}

/** BAYBAY's spots beside a resident: [a step behind them (seen from you), to the side] in u, the first that has room. */
export const ASIDE_SPOTS: readonly (readonly [number, number])[] = [[0.25, 1.5], [0.6, 1.2], [0, 1.8]];

/**
 * Where BAYBAY waits while you chat with a resident (game/flow talkMark): beside them, on the side she is already on,
 * a quarter step behind. The conversation two-shot sits behind you, 25–57° off your line to them (actors/camera.ts
 * twoShotPose), so from there she never stands in front of the resident (tested for both sides and every angle the
 * camera solves). A spot `stand` rejects falls back to the next one, then the other side; null = she stays put.
 */
export function asideMark(player: Vec2, r: ResidentDef, guide: Vec2, stand: (x: number, z: number) => boolean): Vec2 | null {
  let ax = r.at.x - player.x, az = r.at.z - player.z;
  const L = Math.hypot(ax, az);
  if (L < 0.3) { ax = Math.sin(r.at.heading); az = Math.cos(r.at.heading); } else { ax /= L; az /= L; }
  const px = az, pz = -ax;
  const side = (guide.x - r.at.x) * px + (guide.z - r.at.z) * pz < 0 ? -1 : 1;
  for (const s of [side, -side]) {
    for (const [back, lat] of ASIDE_SPOTS) {
      const x = r.at.x + ax * back + px * s * lat, z = r.at.z + az * back + pz * s * lat;
      if (stand(x, z)) return { x, z };
    }
  }
  return null;
}

/** Favours done (Journal "邻居的小忙 3/6"). */
export const tasksDone = (goalsDone: readonly string[]) => RESIDENTS.filter(r => goalsDone.includes(taskDoneId(r.key))).length;
/** Favours accepted and not done yet, in RESIDENTS order. */
export const tasksOpen = (goalsDone: readonly string[]) => RESIDENTS.filter(r => taskState(goalsDone, r.key) === 'on');

// --- wave 5 · W5-C7: the second favour and the letters ------------------------------------------------------------------

/** 'locked' until the first favour is done; then 'new' → 'on' (`task2-on:`) → 'done' (`task2:`). */
export type Task2State = 'locked' | TaskState;

export function task2State(goalsDone: readonly string[], key: ResidentKey): Task2State {
  if (goalsDone.includes(task2DoneId(key))) return 'done';
  if (taskState(goalsDone, key) !== 'done') return 'locked';
  return goalsDone.includes(task2OnId(key)) ? 'on' : 'new';
}

/** goalsDone after accepting the second favour (unchanged unless it is 'new'). */
export function acceptTask2(goalsDone: readonly string[], key: ResidentKey): string[] {
  return task2State(goalsDone, key) === 'new' ? [...goalsDone, task2OnId(key)] : [...goalsDone];
}

/** goalsDone after finishing it: `task2:` replaces `task2-on:` and the photo marks (unchanged when already done). */
export function finishTask2(goalsDone: readonly string[], key: ResidentKey): string[] {
  if (task2State(goalsDone, key) === 'done') return [...goalsDone];
  const photo = `${TASK2_PHOTO}${key}:`;
  return [...goalsDone.filter(id => id !== task2OnId(key) && !id.startsWith(photo)), task2DoneId(key)];
}

/** The spots of a photo favour photographed so far (ids, in the favour's order). */
export function photoSpotsDone(goalsDone: readonly string[], r: ResidentDef): string[] {
  const g = r.task2.goal;
  if (g.kind !== 'photo') return [];
  if (goalsDone.includes(task2DoneId(r.key))) return g.spots.map(s => s.id);
  return g.spots.filter(s => goalsDone.includes(task2PhotoId(r.key, s.id))).map(s => s.id);
}

/** A photo favour's progress for lists ("1/3"), or null for the other kinds and single-spot photos. */
export function task2Progress(goalsDone: readonly string[], r: ResidentDef): string | null {
  const g = r.task2.goal;
  return g.kind === 'photo' && g.need > 1 ? `${Math.min(g.need, photoSpotsDone(goalsDone, r).length)}/${g.need}` : null;
}

/**
 * The photo spots a shutter at (x, z) counts for (pure): the favour's spots within their radius not photographed yet.
 * Empty unless the second favour is on.
 */
export function photoHits(goalsDone: readonly string[], r: ResidentDef, x: number, z: number): PhotoSpot[] {
  const g = r.task2.goal;
  if (g.kind !== 'photo' || task2State(goalsDone, r.key) !== 'on') return [];
  const done = new Set(photoSpotsDone(goalsDone, r));
  return g.spots.filter(s => !done.has(s.id) && Math.hypot(x - s.x, z - s.z) <= s.r);
}

/** The spot a photo favour points to now: the nearest one not photographed yet (the favour's target otherwise). */
export function nextPhotoSpot(goalsDone: readonly string[], r: ResidentDef, from: Vec2): PhotoSpot | null {
  const g = r.task2.goal;
  if (g.kind !== 'photo') return null;
  const done = new Set(photoSpotsDone(goalsDone, r));
  let best: PhotoSpot | null = null, bestD = Infinity;
  for (const s of g.spots) { if (done.has(s.id)) continue; const d = Math.hypot(s.x - from.x, s.z - from.z); if (d < bestD) { best = s; bestD = d; } }
  return best;
}

/** 'none' (the second favour not done) · 'due' (done, the letter on its way) · 'new' (arrived, unread) · 'read'. */
export type LetterState = 'none' | 'due' | 'new' | 'read';
export function letterState(goalsDone: readonly string[], key: ResidentKey): LetterState {
  if (goalsDone.includes(letterReadId(key))) return 'read';
  if (goalsDone.includes(letterId(key))) return 'new';
  return goalsDone.includes(task2DoneId(key)) ? 'due' : 'none';
}
/** goalsDone after a letter arrives (only when it is due) / after it is read (`letter-read:` replaces `letter:`). */
export const deliverLetter = (goalsDone: readonly string[], key: ResidentKey): string[] => (letterState(goalsDone, key) === 'due' ? [...goalsDone, letterId(key)] : [...goalsDone]);
export function readLetter(goalsDone: readonly string[], key: ResidentKey): string[] {
  return letterState(goalsDone, key) === 'new' ? [...goalsDone.filter(id => id !== letterId(key)), letterReadId(key)] : [...goalsDone];
}

/** Second favours done / letters arrived (the Journal's counts). */
export const tasks2Done = (goalsDone: readonly string[]) => RESIDENTS.filter(r => goalsDone.includes(task2DoneId(r.key))).length;
export const lettersArrived = (goalsDone: readonly string[]) => RESIDENTS.filter(r => { const s = letterState(goalsDone, r.key); return s === 'new' || s === 'read'; }).length;
