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
  | { kind: 'deck'; r: number };

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
  /** where they are, in words ("Powell & Market 转车台旁") */
  place: Bilingual;
  idle: ResidentIdle;
  task: ResidentTask;
}

export const TASK_ON = 'task-on:';
export const TASK_DONE = 'task:';
export const taskOnId = (key: ResidentKey) => `${TASK_ON}${key}`;
export const taskDoneId = (key: ResidentKey) => `${TASK_DONE}${key}`;

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

/** Golden Gate deck: the south tower sits at local x = −GGB.TOWER (world/sf/landmarks/golden-gate-bridge.ts). */
export const GGB_SOUTH_TOWER = { id: 'place:ggb-south-tower', x: -796.12, z: 564.38 } as const;

export const RESIDENTS: readonly ResidentDef[] = [
  {
    key: 'gripman', id: 'npc-gripman',
    name: bi('叮当车司机 Ray', 'Ray, gripman'), short: bi('Ray', 'Ray'),
    at: { x: 128.8, z: 266.2, heading: 2.96 }, zone: 'south-of-market',
    place: bi('Powell & Market 转车台旁', 'by the Powell & Market turntable'),
    idle: 'bell',
    task: {
      goal: { kind: 'ride' },
      title: bi('帮 Ray 试坐一站叮当车', 'Test-ride a cable car for Ray'),
      hint: bi('在转车台上车，坐满一站', 'Board at the turntable and ride one full stop'),
      teaser: bi('Powell & Market 转车台旁的叮当车司机', 'A gripman by the Powell & Market turntable'),
      target: { id: 'sf:cable-car-turntable', x: 134.9, z: 261.01, name: bi('叮当车 · Powell & Market 转车台', 'Cable car · Powell & Market turntable'), r: 4 },
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
      hint: bi('Ray 在 Powell & Market 转车台旁', 'Ray is by the Powell & Market turntable'),
      teaser: bi('北滩华盛顿广场旁的面包师', 'A baker by Washington Square in North Beach'),
      target: { id: 'npc-gripman', x: 128.8, z: 266.2, name: bi('叮当车司机 Ray', 'Ray, gripman'), r: 3 },
    },
  },
  {
    key: 'muralist', id: 'npc-muralist',
    name: bi('画壁画的 Luz', 'Luz, muralist'), short: bi('Luz', 'Luz'),
    at: { x: 458.9, z: 653.4, heading: 0.98 }, zone: 'mission',
    place: bi('教会区 Balmy 巷', 'Balmy Alley, the Mission'),
    idle: 'paint',
    task: {
      goal: { kind: 'postcard', card: 'sf-mission-murals' },
      title: bi('找回 Clarion 巷的明信片', 'Find the postcard in Clarion Alley'),
      hint: bi('Clarion 巷在 17 街和 18 街之间', 'Clarion Alley runs between 17th and 18th Streets'),
      teaser: bi('教会区 Balmy 巷画壁画的人', 'A muralist in Balmy Alley, the Mission'),
      target: { id: 'place:osm-w8916752', x: 261.4, z: 606.01, name: bi('Clarion 巷', 'Clarion Alley'), r: 6 },
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

/** Favours done (Journal "邻居的小忙 3/6"). */
export const tasksDone = (goalsDone: readonly string[]) => RESIDENTS.filter(r => goalsDone.includes(taskDoneId(r.key))).length;
/** Favours accepted and not done yet, in RESIDENTS order. */
export const tasksOpen = (goalsDone: readonly string[]) => RESIDENTS.filter(r => taskState(goalsDone, r.key) === 'on');
