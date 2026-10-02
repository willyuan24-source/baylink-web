import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 9 · lane A · input, accessibility, robustness (docs/opus-bay/sf-w9-lead.md §3 A; the first-use review
 * docs/opus-bay/review-2026-10-01-first-use.md §6 界面与交互 / 技术). Logic here; the dialogue box's keys and the focus trap
 * in a DOM: opus-bay-w9-a-dom.test.ts; the save hook: opus-bay-w9-a-save.test.ts.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 500_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };
const src = (path: string) => readFileSync(new URL(`../src/opus-bay/${path}`, import.meta.url), 'utf8');

const store = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const inter = await import('../src/opus-bay/game/interactables');
const brain = await import('../src/opus-bay/game/brain');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const menu = await import('../src/opus-bay/ui/askMenu');
const { closableNow } = await import('../src/opus-bay/ui/backGuard');
const { registerAskItem } = await import('../src/opus-bay/ui/slots');
const { interactTier, interactWeight } = await import('../src/opus-bay/ui/interactPriority');
setStorageForTests(null);

function reset(world: 'city' | 'district' = 'city') {
  if (flow.get().trip) flowMod.endTrip();
  flowMod.closeDialogue();
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: world, mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  brain.resetBrain();
  inter.setInteractables(inter.buildInteractables());
  tick(5000);
}
const verb = { zh: 'x', en: 'x' };
type Choice = import('../src/opus-bay/core/types').DialogueChoice;
const L = (zh: string): Choice['label'] => ({ zh, en: zh });

// ---------------------------------------------------------------------------
// (1) BAYBAY's menu: ≤ 6 rows + 更多, by context, a digit key for every row; Esc / Space cancel through the cancel row
// ---------------------------------------------------------------------------

/** the review's 13-row free-roam menu (tech/ax-chat.txt, verify-tech t06-q-menu.jpg), as openCallMenu builds it */
const FREE_MENU: Choice[] = [
  { label: L('做个动作'), action: { type: 'ask', id: 'play-emotes' } },
  { label: L('捉迷藏'), action: { type: 'ask', id: 'play-hide-seek' } },
  { label: L('摸摸 BAYBAY'), action: { type: 'ask', id: 'play-pet' } },
  { label: L('那是什么？'), action: { type: 'ask', id: 'play-skyline' } },
  { label: L('带我去下一个目标：找鹈鹕朋友 · 科伊特塔 · 约 40 秒'), next: 'flow.goto.sf:coit-tower' },
  { label: L('附近有什么？'), next: 'flow.nearby' },
  { label: L('带我环游旧金山（约 36 分钟）'), action: { type: 'start-tour', tourId: 'sf-grand' } },
  { label: L('海边 7 站（湾区第一课）'), action: { type: 'start-tour' } },
  { label: L('这周有什么好玩的？'), action: { type: 'start-week' } },
  { label: L('用飞行券飞一次'), action: { type: 'ask', id: 'e-ticket' } },
  { label: L('今天旧金山有什么？'), action: { type: 'ask', id: 'realsf-today' } },
  { label: L('打开地图'), action: { type: 'open-map' } },
  { label: L('没事，继续逛'), action: { type: 'end' } },
];
const labels = (rows: import('../src/opus-bay/ui/askMenu').MenuRow[], choices: Choice[]) =>
  rows.map(r => (r.kind === 'choice' ? choices[r.index].label.zh : r.kind));

test('W9-A1: the 13-row call menu shows 5 rows by context + 更多… + 没事，继续逛 (was 13 rows, keys only to 9); every row of every page has a digit key', () => {
  const pages = menu.menuPages(menu.ASK_MENU_ID, FREE_MENU);
  assert.ok(pages.length >= 2, 'paged');
  assert.deepEqual(labels(pages[0], FREE_MENU), ['带我去下一个目标：找鹈鹕朋友 · 科伊特塔 · 约 40 秒', '用飞行券飞一次', '附近有什么？', '这周有什么好玩的？', '今天旧金山有什么？', 'more', '没事，继续逛']);
  assert.ok(pages[0].filter(r => r.kind === 'choice').length <= 6, '≤ 6 rows + 更多');
  for (const p of pages) assert.ok(p.length <= menu.MAX_ROWS, `a page holds ≤ 9 rows (digit keys 1–9): ${p.length}`);
  for (const p of pages.slice(1)) assert.equal(p.at(-1)!.kind, 'back', 'a later page ends with 返回');
  // every choice exactly once
  const seen = pages.flat().filter(r => r.kind === 'choice').map(r => (r as { index: number }).index).sort((a, b) => a - b);
  assert.deepEqual(seen, FREE_MENU.map((_, i) => i));
  // the small games and the map wait on 更多
  assert.deepEqual(labels(pages[1], FREE_MENU), ['带我环游旧金山（约 36 分钟）', '海边 7 站（湾区第一课）', '捉迷藏', '那是什么？', '做个动作', '摸摸 BAYBAY', '打开地图', 'back']);
});

test('W9-A1: the call menu ranks a tour / a paused trip first and another lane\'s new ask row on page 1; ≤ 7 rows stay on one page; other menus page only past 9 rows, in their own order', () => {
  const tour: Choice[] = [
    { label: L('做个动作'), action: { type: 'ask', id: 'play-emotes' } },
    { label: L('继续一日游：带我去金门大桥'), action: { type: 'tour-next' } },
    { label: L('跳过这一站'), next: 'flow.tour.skip' },
    { label: L('先不逛了，结束一日游'), action: { type: 'tour-end' } },
    { label: L('附近能玩什么'), action: { type: 'ask', id: 'g-play-near' } },
    { label: L('打开地图'), action: { type: 'open-map' } },
    { label: L('没事，继续逛'), action: { type: 'end' } },
  ];
  const one = menu.menuPages(menu.ASK_MENU_ID, tour);
  assert.equal(one.length, 1, '7 rows: one page, no 更多');
  assert.deepEqual(labels(one[0], tour), ['继续一日游：带我去金门大桥', '跳过这一站', '附近能玩什么', '先不逛了，结束一日游', '做个动作', '打开地图', '没事，继续逛']);
  // the district tour's 继续：带我去… is an 'end' that is not the last row
  const district: Choice[] = [{ label: L('继续：带我去渡轮大厦'), action: { type: 'end' } }, { label: L('跳过这一站'), action: { type: 'tour-next' } }, { label: L('没事，继续逛'), action: { type: 'end' } }];
  assert.equal(menu.cancelIndex(district), 2);
  assert.deepEqual(labels(menu.menuPages(menu.ASK_MENU_ID, district)[0], district), ['继续：带我去渡轮大厦', '跳过这一站', '没事，继续逛']);
  // a station menu with 11 stops: original order, cancel on page 1, a digit for every row
  const stops: Choice[] = [...Array.from({ length: 11 }, (_, i) => ({ label: L(`站 ${i + 1}`), next: `flow.ride.a>s${i}` })), { label: L('先不坐了'), action: { type: 'end' } }];
  const sp = menu.menuPages('flow.streetcar', stops);
  assert.deepEqual(labels(sp[0], stops), ['站 1', '站 2', '站 3', '站 4', '站 5', '站 6', '站 7', 'more', '先不坐了']);
  assert.deepEqual(labels(sp[1], stops), ['站 8', '站 9', '站 10', '站 11', 'back']);
  // the welcome: one page, its own order, no cancel row (Esc / Space do nothing there)
  const welcome: Choice[] = [1, 2, 3, 4].map(i => ({ hotkey: String(i), label: L(`w${i}`), action: { type: 'free-roam' } }));
  assert.deepEqual(labels(menu.menuPages('intro.hello.city', welcome)[0], welcome), ['w1', 'w2', 'w3', 'w4']);
  assert.equal(menu.cancelIndex(welcome), -1);
  assert.deepEqual(menu.menuPages('x', []), []);
});

test('W9-A1: the live call menu (openCallMenu + the lanes\' ask rows) pages to ≤ 6 rows + 更多 with 没事，继续逛 as its cancel row', () => {
  reset('city');
  const offs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => registerAskItem({ id: `t-${id}`, order: i % 2 ? -1 : 50, label: L(`ask ${id}`), icon: () => null }));
  try {
    flowMod.callBaybay();
    const node = flowMod.nodeById(store.game.get().dialogue.nodeId);
    assert.equal(node?.id, menu.ASK_MENU_ID);
    const choices = node!.choices!;
    assert.ok(choices.length > 7, `${choices.length} rows built`);
    const cancel = menu.cancelIndex(choices);
    assert.equal(cancel, choices.length - 1, 'the cancel row is 没事，继续逛');
    assert.equal(choices[cancel].label.zh, '没事，继续逛');
    const pages = menu.menuPages(node!.id, choices);
    assert.ok(pages[0].length <= 7 && pages[0].filter(r => r.kind === 'choice').length <= 6);
    // Esc / Space = chooseDialogue(cancel row): the menu closes, nothing else starts
    flowMod.chooseDialogue(cancel);
    assert.equal(store.game.get().dialogue.nodeId, null);
    assert.equal(store.game.get().panel.kind, null);
  } finally { for (const off of offs) off(); }
});

// ---------------------------------------------------------------------------
// (1) one modal at a time; E priorities; E after a close
// ---------------------------------------------------------------------------

test('W9-A2: Esc (Settings) then Q never stacks two panels — Q closes Settings (the pause) and opens BAYBAY\'s menu in its place (red before: both open, shot gamer/025)', () => {
  reset('city');
  flowMod.openPanel('settings');
  assert.equal(store.game.get().paused, true);
  tick(1000);
  flowMod.callBaybay();
  assert.equal(store.game.get().panel.kind, null, 'Settings closed');
  assert.equal(store.game.get().paused, false, 'not paused: a game picked from the menu does not start paused');
  assert.equal(store.game.get().dialogue.nodeId, 'flow.call');
  flowMod.closeDialogue();
  // a call answered late (BAYBAY walked over) never opens the menu over a panel the player opened meanwhile
  flowMod.openPanel('map');
  flowMod.openCallMenu();
  assert.equal(store.game.get().dialogue.nodeId, null, 'no menu over the map');
  assert.equal(store.game.get().panel.kind, 'map');
  assert.equal(flow.get().callPending, false);
});

test('W9-A2: E in the city — an activity / pickup beats a place card, which beats BAYBAY and a bench; the claw beats the follow-you 坐下 (review: 抓娃娃点只出现"坐下"); the district keeps its weights', () => {
  reset('city');
  inter.setFocusWeight(interactWeight); // the play layer installs it (ui/Dialogue.tsx usePlayA11y)
  Object.assign(runtime.guide, { x: 0.8, z: 0 });
  const bay = { id: inter.BAYBAY_ID, source: 'baybay' as const, action: 'talk' as const, verb, name: verb, x: 0.8, z: 0, radius: 2.4 };
  const poi = { id: 'sf:ferry-building', source: 'poi' as const, action: 'info' as const, verb, name: verb, x: 2.5, z: 0, radius: 3 };
  const bench = { id: 'seat-1', source: 'seat' as const, action: 'info' as const, verb, name: verb, x: 1.2, z: 0, radius: 1.5 };
  const sit = { id: 'play:sit', source: 'activity' as const, action: 'info' as const, verb, name: verb, x: 0.1, z: 0, radius: 1.3 };
  const claw = { id: 'play:claw', source: 'activity' as const, action: 'info' as const, verb, name: verb, x: 1.1, z: 0, radius: 1.6 };
  inter.setInteractables([bay, poi, bench]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, poi.id, 'the place card, not BAYBAY at your side (before: BAYBAY 0.53 < card 0.83) nor the bench');
  inter.setInteractables([sit, claw, bay]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, claw.id, 'the claw machine, not 坐下 (before: 坐下 0.08 < claw 0.69)');
  inter.setInteractables([bench, bay]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, inter.BAYBAY_ID, 'within one tier the old weights decide (BAYBAY 0.53 < the bench 0.8)');
  // district: unchanged weights (BAYBAY at your side over the card)
  reset('district');
  Object.assign(runtime.guide, { x: 0.8, z: 0 });
  inter.setInteractables([bay, poi]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, inter.BAYBAY_ID, 'district weights unchanged');
  assert.equal(interactTier({ id: 'x', source: 'poi' }, 'x'), 0, 'the tour\'s stop is first');
  assert.equal(interactTier({ id: 'view:twin-peaks', source: 'find' }), 1, '坐下看风景 sits with the place cards');
  // without the play layer (no weight installed) the city keeps the old weights; the play layer installs it
  inter.setFocusWeight(null);
  reset('city');
  Object.assign(runtime.guide, { x: 0.8, z: 0 });
  inter.setInteractables([bay, poi]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, inter.BAYBAY_ID);
  assert.match(src('ui/Dialogue.tsx'), /setFocusWeight\(interactWeight\)/);
});

test('W9-A2: E right after a line / card closed is not a new interaction (400 ms), and E never acts while Settings pauses the game (red before: the second E talked to BAYBAY again)', () => {
  reset('city');
  Object.assign(runtime.guide, { x: 0.8, z: 0 });
  const bay = { id: inter.BAYBAY_ID, source: 'baybay' as const, action: 'talk' as const, verb, name: verb, x: 0.8, z: 0, radius: 2.4 };
  inter.setInteractables([bay]);
  brain.updateFocus();
  assert.equal(store.game.get().focus, inter.BAYBAY_ID);
  flowMod.playDialogue('flow.tour.skip');
  if (!store.game.get().dialogue.nodeId) flowMod.callBaybay();
  assert.ok(store.game.get().dialogue.nodeId, 'a line is open');
  flowMod.closeDialogue();
  brain.updateFocus();
  tick(300);
  assert.equal(flowMod.requestInteract('key'), false, 'E 300 ms after the close: ignored');
  assert.equal(store.game.get().dialogue.nodeId, null);
  tick(300);
  assert.equal(flowMod.requestInteract('key'), true, 'E 600 ms after the close talks to BAYBAY (the 280 ms press debounce apart)');
  assert.equal(store.game.get().dialogue.nodeId, 'flow.call');
  flowMod.closeDialogue();
  tick(1000);
  flowMod.openPanel('settings');
  tick(1000);
  assert.equal(flowMod.requestInteract('key'), false, 'paused: E does nothing behind Settings');
  assert.equal(store.game.get().dialogue.nodeId, null);
  flowMod.closePanel();
});

// ---------------------------------------------------------------------------
// (2) the back button: what Escape would close
// ---------------------------------------------------------------------------

test('W9-A3: the back button closes what Escape closes; nothing closable (the welcome, a cinematic, the title) → back leaves', () => {
  const s = { phase: 'playing' as const, photoMode: false, panel: { kind: null }, dialogue: { nodeId: null } };
  const f = { cinematic: null, postcardReward: null, fishing: null };
  assert.equal(closableNow(s, f, 0, 0, false), null, 'nothing open: back leaves the page as before');
  assert.equal(closableNow({ ...s, panel: { kind: 'map' } }, f, 0, 1, false), 'panel:map');
  assert.equal(closableNow({ ...s, photoMode: true }, f, 0, 0, false), 'photo');
  assert.equal(closableNow(s, f, 2, 1, false), 'overlay:2');
  assert.equal(closableNow({ ...s, dialogue: { nodeId: 'flow.call' } }, f, 0, 1, false), 'dialog:flow.call:1');
  assert.equal(closableNow(s, f, 0, 0, true), 'activity', 'a game in progress (Esc = 放弃)');
  assert.equal(closableNow({ ...s, phase: 'title' as const }, f, 1, 1, false), null, 'the title');
  assert.equal(closableNow({ ...s, panel: { kind: 'map' } }, { ...f, cinematic: 'intro' as never }, 0, 1, false), null, 'a cinematic: back leaves');
  // the dialogue box tells the guard a menu without a cancel row (the welcome) is not closable
  assert.match(src('ui/Dialogue.tsx'), /data-ob-cancel=\{!menu \|\| cancelAt >= 0 \? '1' : '0'\}/);
  assert.match(src('ui/backGuard.ts'), /\[role="dialog"\]:not\(\[data-ob-cancel="0"\]\)/);
});

// ---------------------------------------------------------------------------
// (6) the typewriter out of aria-live
// ---------------------------------------------------------------------------

test('W9-A6: the dialogue box is not an aria-live region (the typewriter re-announced every step); the whole line is an .ob-sr copy, the live announce stays flow\'s', () => {
  const box = src('ui/Dialogue.tsx');
  assert.doesNotMatch(box, /role="dialog" aria-live/, 'no live region on the box');
  assert.match(box, /<span aria-hidden>\{text\.slice\(0, shown\)\}<\/span>/, 'the typed part is hidden from screen readers');
  assert.match(box, /<span className="ob-sr">\{text\}<\/span>/, 'the whole line, once');
  assert.match(src('game/flow.ts'), /announce\(node\.text\);/, 'the live region still says each line once (ui/Floating LiveRegion)');
});
