import type * as Script from './script';

/**
 * W7-P3 · the dialogue script rides with the play layer (lane P: GameRoot ≤ 265 KB gzip with room for the wave).
 *
 * `data/script.ts` (every dialogue node, the goals' texts, the barks and hooks: ≈ 13.5 KB gzip) is read only once play
 * has begun — the welcome dialogue after Start, BAYBAY's barks and hooks, the goals — so it comes with the play layer's
 * chunk (ui/playParts.tsx → data/scriptLoad.ts), and GameRoot holds Start until that chunk is in (W6-P1's gate): the
 * first line of play has every node exactly as before. The main graph (game/flow.ts, brain.ts, content.ts,
 * cityContent.ts) imports these same-named live bindings instead; `registerScript` points them at the module when it
 * loads. Before that they are empty (no node, no hook, no bark: every caller already has its fallback for a missing
 * line). Node (tests, scripts: no `import.meta.env`) loads the script here at once. Lazy chunks (the play layer's UI,
 * voice, the week panel) keep importing `data/script.ts` itself: the same module instance.
 */
type S = typeof Script;

export let NODES: S['NODES'] = {};
export let START_NODE: S['START_NODE'] = '';
export let DISTRICT_START_NODE: S['DISTRICT_START_NODE'] = '';
export let CITY_START_NODE: S['CITY_START_NODE'] = '';
export let FREE_GOALS: S['FREE_GOALS'] = [];
export let DISTRICT_FREE_GOALS: S['DISTRICT_FREE_GOALS'] = [];
export let STOP_PROMPTS: S['STOP_PROMPTS'] = {};
export let SCRIPT_HOOKS = {} as S['SCRIPT_HOOKS'];
export let DISTRICT_SCRIPT_HOOKS = {} as S['DISTRICT_SCRIPT_HOOKS'];
export let CITY_SCRIPT_HOOKS = {} as S['CITY_SCRIPT_HOOKS'];
export let GUIDE_BARKS = {} as S['GUIDE_BARKS'];
export let DISTRICT_GUIDE_BARKS = {} as S['DISTRICT_GUIDE_BARKS'];
export let CITY_GUIDE_BARKS = {} as S['CITY_GUIDE_BARKS'];
export let NPC_LINES: S['NPC_LINES'] = [];

let loaded = false;
/** Whether the script is in (tests / QA). */
export const scriptLoaded = () => loaded;

/** Point the bindings above at the script module (data/scriptLoad.ts, in the play layer's chunk; node: below). */
export function registerScript(m: S): void {
  NODES = m.NODES;
  START_NODE = m.START_NODE;
  DISTRICT_START_NODE = m.DISTRICT_START_NODE;
  CITY_START_NODE = m.CITY_START_NODE;
  FREE_GOALS = m.FREE_GOALS;
  DISTRICT_FREE_GOALS = m.DISTRICT_FREE_GOALS;
  STOP_PROMPTS = m.STOP_PROMPTS;
  SCRIPT_HOOKS = m.SCRIPT_HOOKS;
  DISTRICT_SCRIPT_HOOKS = m.DISTRICT_SCRIPT_HOOKS;
  CITY_SCRIPT_HOOKS = m.CITY_SCRIPT_HOOKS;
  GUIDE_BARKS = m.GUIDE_BARKS;
  DISTRICT_GUIDE_BARKS = m.DISTRICT_GUIDE_BARKS;
  CITY_GUIDE_BARKS = m.CITY_GUIDE_BARKS;
  NPC_LINES = m.NPC_LINES;
  loaded = true;
}

// node (tests, QA scripts: no Vite build, no import.meta.env) reads the script at once (data/script.ts imports nothing
// that imports this module, so the wait cannot come back to itself)
if ((import.meta.env as object | undefined) === undefined) registerScript(await import('./script'));
