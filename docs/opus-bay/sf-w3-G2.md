# Wave 3 · lane G2 (city content: lines, residents, cards)

## Part a

### 给主人的摘要

- BAYBAY 在城市里会"看情况说话"了：第一次骑车 / 开车 / 坐叮当车 / 坐渡轮 / 滑翔 / 爬陡坡，磕碰、楼梯、喘气这些小反应，还有 41 个街区的第一次到达问候（20 个街区有专门的一句介绍，其他街区说"新街区！这里是 XX～"）。38 句台词 H2b 都录好了音，气泡的开头就是录音那句话。
- 规矩：同一句 60 秒内不重复，两句之间至少隔 8 秒，不会盖住别的气泡，对话 / 过场 / 快速旅行 / 拍照时不说话，滑翔时先不打招呼、落地后只问候落地的街区。"第一次"类台词每个存档只说一次。
- 地图上的普通地点（不是 24 个地标的那 1000 多个）现在点"详情"也有自己的卡片：类型、街区、攻略、地图、附近活动、数据来源，底部一个大大的"带我去"按钮，手机上好按。
- 叮当车 / 渡轮上下车的对白、司机和水手的台词都写好了；双峰和金门大桥两个目标在浏览器里真走了一遍，都能正常打勾。
- `data/VOICE.md` 加了城市篇：BAYBAY 在全城怎么说话、台词规则、中文译名表（双峰、唐人街、叮当车、要塞公园、马里纳区……和 HUD 一致）。

### What was built (files, API for other lanes)

| file | what |
|---|---|
| `data/sf/lines.ts` (new) | `BARK_SCRIPT` (**frozen**, header says so): `BARK_SCRIPT_RECORDED` (the 20 lines H2b recorded in a2dbfe4, word for word) + `BARK_SCRIPT_TODO` (the later 18: 7 reactions, cable bell, turntable push, the "新街区！" opener and 8 more greetings; H2b recorded them in e60eec4 as `SF_VOICE_EXTRA`). `EVENT_LINES` per `LineEvent` (bike, car, bump (hard only), hill, crest, glide, glide-land, glide-no-landing, pant, stairs, cable-bell, cable-ride, push, ferry, fline): the first entry is a once-per-save "first", the next one repeats with its own cooldown; every bubble starts with its recorded phrase (tested). `NEIGHBOURHOOD_LINES` (20, real `far.zones` ids, facts with `source` + `verifiedAt` 2026-09-27), `neighbourhoodGreeting(zone, name)` for the other 21 zones, `lineMs(text)` (2.6–5.6 s). |
| `game/baybayLines.ts` (new, city chunk only) | `LineScheduler` (pure; fake clock in tests): 60 s per key, ≥ 8 s between lines, never while any bubble is up nor within 1 s after one, silent in dialogue / cinematics / fast travel / photo / postcard rewards / panels / the quiet start, zone greetings wait while you stay and are held while gliding (only the landing zone is greeted), `after` (the glide lines wait 0.9 s for audio's take-off "wow"). `createLineMemory` (`opus-bay:lines:v1`, untrusted input, `?save=off` in memory), `clearLineMemory()` (for G1's reset), `lineEventOf(ev, onFoot)`, `initBaybayLines()`: core events → scheduler, a 5 Hz frame system, `bubble(...)` + `emit({ type: 'voice-line', id })` + an emote while BAYBAY walks beside you. DEV: `__opusBay.lines` (`waiting()`, `offer(e)`, `said(key)`). |
| `game/cityContent.ts` | loads `baybayLines` as its own chunk in city mode (nothing new in GameRoot). |
| `data/script.ts` | `CITY_TRANSIT_HOOKS` for F (`cablecarStation` / `ferryStation` with `{station}`, `cablecarBoard`, `cablecarCount`, `cablecarOff`, `turntableTurned`, `ferryBoard`, `ferryOff`), the crews as `CITY_NPC_LINES` (gripman, deckhand; `NPC_LINES = byMode`), `call.menu.city` (自己逛 → `free.goals.city`; the wave-2 gap), `tour.after.city`, `postcard.first.city` / `postcard.all.city` ("20 张"). District hooks untouched. |
| `game/content.ts` | `fillText` / `hookFill` for placeholder hooks. |
| `game/brain.ts` | city only: a landmark pass-by bark waits for the bubble on screen instead of cutting a greeting short. |
| `data/sf/cityPois.ts`, `ui/PoiCard.tsx` | G1's Request 3: `placeCardTarget(id, placeById)` (a landmark place → its landmark card, a hero place merged with a district POI → that card, any other place → a `PlaceCard`), `PLACE_KIND_NAMES` (23 kinds), `placeCardName`. `PlaceCard`: type + neighbourhood, an honest "still being written up" line, the BAYLINK guide and planner links when the place has them, Maps, this week's events within 1 km, the OSM source + date, a full-width 带我去 (`navigateTo('place:<id>')`). |
| `data/VOICE.md` | "City mode" section: BAYBAY in the whole city, transit crews and residents, event / neighbourhood line rules, the zh glossary matched to `far.zones` HUD labels. |
| `tests/opus-bay-sf-lines.test.ts` (new) | 12 tests (script vs recordings, phrase prefixes, `far.zones` ids, glossary, scheduler with a fake clock, event mapping, memory as untrusted input). `tests/opus-bay-sf-content.test.ts` + the place-card and transit-hook tests. |

**API for other lanes**
- Any lane can make BAYBAY react through core events it already emits: `vehicle:enter`, `vehicle:bump {hard}`, `vehicle:refuse {surface:'stairs'}`, `vehicle:hop {crest}`, `hill`, `pant`, `glide:start|land|no-landing`, `transit {kind, what}` (cable-car `depart` / `push` / `bell` (on foot, strength ≥ 0.4); ferry and streetcar `depart` / `board`). The hero F-line (no transit events) is picked up from `flow.ride`.
- A new line = a new `BARK_SCRIPT` id (never a changed wording) → H2b records it → an `EVENT_LINES` entry.
- `clearLineMemory()` for a "reset progress" button (G1).

### Evidence

- Checks on this head (rebased on `83bc5de`): `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems, **381 / 381** opus-bay tests (hero regression + contracts green).
- In the app (dev 5206, RTX), this run: `?start=free&world=city&save=off&at=ll:37.7502,-122.4337` (Noe Valley, a template zone) → bubble "New neighbourhood! This is Noe Valley." / "新街区！这里是诺伊谷～", `__opusAudio` counts `voice-clip:en-zone-new` = 1 (an `SF_VOICE_EXTRA` clip through the scheduler), `said('zone-noe-valley')` true. Phone 390×844 `--mobile --dpr 3` zh at the Dragon Gate: the landmark bark docks at the top under the discovery toast, no overlap with the postcard-clue chip (G1's M1 fix): `docs/opus-bay/qa/w3/G2/g2-phone390-bubble-docked-zh.jpg`.
- In the app, the interrupted run (commits d4631e6 / 96387f5 / 6447b1a / eafcef8; shots in `docs/opus-bay/qa/w3/G2/`):
  - `g2-line-first-bike.jpg` — "Bike time! I'll ride in the basket~" on the first `vehicle:enter` at the Ferry Building.
  - `g2-line-first-glide.jpg` — "Hold on, we're flying! The whole city's below us~" after the take-off whoosh (debug HUD: 70 calls, 221k triangles, 43 programs; the lines add no meshes and no programs).
  - `g2-phone390-greeting-chinatown-zh.jpg` — "你好，唐人街！它是北美最老的唐人街。" (taken before G1's M1 fix: the bubble still touched the clue chip there; the new shot above has it docked).
  - `g2-twin-peaks-goal-real-walk.jpg` — goal ticked (目标 1/7) after a real walk Castro → Twin Peaks summit (the detector armed ≥ 150 u away, no teleport).
  - `g2-golden-gate-goal-deck-walk.jpg` — goal ticked after a real walk on the deck tower to tower.
  - `g2-place-card-desktop.jpg`, `g2-place-card-phone390.jpg`, `g2-place-card-phone375.jpg` — the place card (金门公园, Salesforce 空中公园), 带我去 in reach of the thumb; the 带我去 tap on the phone starts the walk.
- Budgets: nothing of this part adds a mesh, material or program (lines are DOM bubbles; the place card is DOM).

### Decisions

- `BARK_SCRIPT` was built from H2b's already-recorded table (it landed before G2-4), so the bubbles start with exactly those phrases; everything else was written as a later block and recorded by H2b the same day.
- Reactions go stale fast (ttl 3 s): a bump line 5 s after the bump reads as a non sequitur. Firsts may wait 12 s for a free moment.
- Zone greetings rank between firsts and reactions; the Twin Peaks greeting waits for the summit (45 u of the overlook), not the zone's lower edge.
- The glide lines wait 0.9 s (`after`) instead of asking F to drop the "wow" (H2b's request 3 done on G2's side).
- Place cards say honestly that the write-up is still coming rather than inventing a summary for 1,000 places.

### Known gaps

- `SF_VOICE_EXTRA` clips are not preloaded (audio preloads `SF_VOICE_LINES` only): the first play of each can wait up to 0.7 s; and `audio.ts` picks the fallback chirp from `SF_VOICE_LINES`, so an EXTRA line whose clip is missing chirps `hi` instead of its own fallback. Both go away with Request 1.
- Place names in the discovery toast can be English in the zh UI (e.g. "Heaven Art Gallery"; G1's place index, not G2's card, which uses `placeCardName`).
- `lang=zh` is not a locale: QA URLs must use `lang=zh-Hans` for the zh clips.

### Not done

- Nothing of part a. Part b (six residents with tasks and bodies, the neighbour-help list, `sf-tasks` tests) follows below.

### Requests

1. **Lead + H2b's file** (`data/voiceLinesSf.ts`, `tests/opus-bay-h2b-assets.test.ts`, one commit with G2's `data/sf/lines.ts`), H2b's Request 1: rename today's `SF_VOICE_LINES` literal to `const CORE_LINES` and export
   `export const SF_VOICE_LINES: Record<string, SfVoiceLine> = { ...CORE_LINES, ...SF_VOICE_EXTRA };`
   In `tests/opus-bay-h2b-assets.test.ts` l.172 count `Object.keys(SF_VOICE_LINES).length` only (no `+ EXTRA`), l.179 compare `BARK_SCRIPT_RECORDED` with `CORE_LINES` (export it) and drop the `!SF_VOICE_LINES[id]` "only once" check at l.182. G2's `tests/opus-bay-sf-lines.test.ts` already accepts `SF_VOICE_LINES` growing by the later block; no G2 code change is needed (the emits already use the same ids). Then the 18 later lines preload and use their own fallback chirps.
   **Done** by H2b's review (8940dd5, `SF_VOICE_LINES = { ...CORE_LINES, ...SF_VOICE_EXTRA }`); `data/sf/lines.ts` notes it.

## Part b

### 给主人的摘要

- 城里住进了六位邻居，每人都照着他们的头像做成了小玩偶：Powell & Market 转车台的叮当车司机 Ray、北滩华盛顿广场旁的面包师 Rosa、教会区 Balmy 巷画壁画的 Luz、金门公园花卉温室前的园丁 Hank、Crissy Field 的巡护员 Dana、Haight 街口开唱片店的 Marcus。
- 每人都有一件小忙：替 Ray 试坐叮当车、把 Rosa 的酸面包送给 Ray、去 Clarion 巷找回壁画明信片、去风车下看郁金香花园、走上金门大桥到南塔、爬上双峰看看雾（Karl）来了没。答应以后路标会先指向这件事；做到的那一刻就打勾，BAYBAY 会说"回去告诉 TA 吧"，回去聊天能听到一句真实的小知识（都查过来源）。
- 旅行本的"目标"页多了"邻居的小忙 x/6"：没见过的人写着在哪、有"去找 TA"按钮；答应了的有"带我去"；手机上按钮够大。目标卡片也会显示你答应了的小忙。
- 另外把地标模型库从游戏主包里拿出去了（C2 的请求）：主包从 328 KB 降到 300 KB（gzip），手机首次加载更快。
- 全部检查通过；街区模式没有任何变化。

### What was built (files, API for other lanes)

| file | what |
|---|---|
| `data/sf/residents.ts` (new, main graph, data only) | `RESIDENTS` (6): key, id `npc-<key>` (= interactable id, actor id and the `npc-<key>` dialogue portrait alias), name / first name, spot (roomy pavement or grass; tested against the published city), far.zones neighbourhood, place words, idle, and the favour: `TaskGoal` (`ride` · `deliver` · `postcard` · `reach` · `deck`), title, hint, teaser, waypoint target (a card `sf:<id>`, a resident, or G1's `place:<id>`). State in `goalsDone`: `task-on:<key>` while accepted, `task:<key>` once done (the on mark is dropped, so a save holds one mark per resident): `taskState`, `acceptTask`, `finishTask`, `tasksDone`, `tasksOpen`, `taskOnId`, `taskDoneId`. |
| `data/sf/dialogue.ts` (new, lazy) | per resident `hi → ask (accept / 下次吧)`, `yes`, `no`, `remind (带我去 / 好的)`, `go`, `thanks → fact`, plus Ray's `npc.gripman.bread → bread2`; `RESIDENT_SOURCES` (every fact node with URL + date, checked 2026-09-27: SFMTA, Wikipedia cable-car system / Balmy Alley / Clarion Alley / Conservatory / Dutch Windmill / Crissy Field / Golden Gate Bridge / Haight-Ashbury / *F. sanfranciscensis*, SF Rec & Park Queen Wilhelmina Garden, KQED on Karl); `TASK_TEXT` (toasts, BAYBAY's "完成啦！回去告诉 X 吧～", the all-six line). |
| `game/residentTasks.ts` (new, lazy chunk, city only) | `initResidentTasks()`: defines the nodes, `flow.setResidentTalk` (a chat opens `entryNode(r, goalsDone, met)`), accept on `npc.<k>.yes`, finish on F's counted `transit` ride, on `npc.gripman.bread`, or `goalMet(goal, sample)` at 4 Hz outside chats / cards / postcard rewards (postcard in hand; within `r` of a spot on foot, bike or car — not gliding or travelling; on the Golden Gate deck within 12 u of the south tower). A favour already done when you accept or come back goes straight to the thanks. 带我去 = `flow.navigateTo(target)` when the chat closes. Pure exports for tests: `goalMet`, `entryNode`. |
| `actors/residentLooks.ts` (new, lazy chunk) | `buildResident(key)`: bodies after the portraits on `NPC_BONES` with the shared character material (no new program): Ray's flat cap, moustache, maroon waistcoat and work gloves; Rosa's baker's cap, bun, apron and loaf; Luz's curls, orange headband, paint-spotted overalls, brush and cup; Hank's straw hat, white beard, green overalls, tulip pot and trowel; Dana's flat-brim ranger hat, braids, olive uniform, binoculars and badge; Marcus's glasses, beard, teal jacket, striped shirt and a record. 3.8–4.9k triangles each (the waterfront residents are 5–6k). |
| `actors/npcs.ts` | `CITY_NPC_DEFS`, `npcDefsFor('city')` = waterfront residents + the six (district unchanged, pinned); `NpcDef.resident`; a city resident holds a hidden 12-triangle stand-in until its body is built (first within `RESIDENT_LOAD` 220 u; a fetch that stalls > 8 s is retried), shows inside 150 u, hides beyond `RESIDENT_HIDE` 160 u (no update, no ground lookup, no obstacle); `Npc.visible`; idles (bell, taste, think, work, look, tap) and held poses (the brush up at the wall, the pot, the record held out with a nod). `rig` / `anim` are swapped once, inside the resident's own group. |
| `game/cityContent.ts` | the residents as talk interactables (`residentInteractables(goalsDone)`: Ray's verb becomes "把面包交给 Ray" while you carry the loaf); lazy `residentTasks` and `cityLive`; `goalTargets()` puts an accepted favour's target first (`GoalTarget.first`, name "小忙 · …"). |
| `game/flow.ts` | `setResidentTalk(fn)` claimed first in `talkToNpc`; `nextFreeGoal` offers accepted favours before goals. |
| `ui/Moments.tsx` (GoalsCard), `ui/Journal.tsx` | G2-11 "邻居的小忙 n/6": the card lists the favours you said yes to (two at most) or where the neighbours are; the journal's Goals tab lists all six (not met → "去找 TA", on → "带我去", done → ticked with their thanks). |
| `data/sf/arrivals.ts` (new), `game/cityLive.ts` (new, lazy), `data/sf/cityPois.ts`, `game/cityGoals.ts`, `game/cityContent.ts` | C2's P7 request 4: the 24 landmark arrival spots written out (tested against D2's `sfLandmarkAnchor`; the test prints the table to paste when D2 moves one); the goal detectors' runtime and the SF landmark subject resolver moved into the lazy `cityLive`. GameRoot's static graph no longer reaches `world/sf/landmarks`. |
| `data/VOICE.md` | the six residents' voices, where they stand, their favour, and the rules (no money / shop visits, 带我去 always offered, tulips "usually in March", never "blooming now"). |
| `tests/opus-bay-sf-tasks.test.ts` (new) | 9 tests (below); `tests/opus-bay-sf-content.test.ts` + 2 (the written-out arrivals; `cityLive` registers / unregisters the SF subjects). |

**For other lanes:** a resident is `interactableById('npc-<key>')` (G1's map / trip code can lead there); a favour's
state is `taskState(goalsDone, key)`; `residentTasks` emits `{ type: 'goal', id: 'task:<key>' }` when one is done (the
cheer, the fanfare and the sparkle already follow it).

### Evidence

- **Checks** (rebased on origin before each push): `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems,
  **523 / 523** opus-bay tests on `a738b5e`, **561 / 561** on `715102b` (the part b report commit, after rebasing on the wave-4 lanes) (hero regression and contracts green). Two wall-clock asserts in G1's citymap
  and sf-nav tests failed once while six lanes loaded the machine and passed on rerun (G1 has since loosened the citymap
  one).
- **sf-tasks** (9): the six spots stand with 0.9 u of room in the published city, off the road, in their far.zones
  neighbourhood, reachable from ferry-gate, ≥ 7.5 u from every landmark card, postcard, cable-car station and turntable,
  more than 100 u from each other; targets resolve (cards, residents, G1 places at the same spot; the south-tower place
  sits at local x = −TOWER); the state machine (idempotent; no mark is a GoalKey word); `goalMet` (on foot / bike yes;
  gliding, fast travel, below the lookout, under the deck, the north tower no); `entryNode` (hi → ask when met → remind →
  thanks; Ray takes the loaf first); the dialogue graph (zh ≤ 45, en ≤ 120, no control words, glossary, hotkeys, a sourced
  fact per favour, every source a live node); bodies (NPC_BONES, the shared material, 2–5k triangles, 1.25–1.75 u tall);
  the spawn list; interactables; waypoints (an accepted favour first, gone once done).
- **In the app** (dev 5206, RTX, city mode):
  - All six favours end to end: Rosa → accept → Ray takes the loaf (baker done); Ray → accept → **a real ride** on the
    Powell-Hyde car from the turntable finishes the favour and the cable-car goal together (87 s incl. the wait for the
    car); Hank → the tulip garden; Marcus → the Twin Peaks lookout; Dana → the bridge deck at the south tower; Luz → the
    Clarion postcard (finished once the reward card closed, then BAYBAY's line) — each with the toast, and the thanks and
    the fact when you come back.
  - Budget with a resident on screen, 1440×900, quality high: Rosa at Washington Square **100 calls, 357,397 triangles,
    61 fps**; she costs **2 calls and 9,848 triangles** (mesh + shadow; 98 / 347,549 with her hidden). Ray at the
    turntable: 2 calls, 7,628 triangles. Residents share the player's material and object kind, so they add no program
    (`material === characterMaterial()`, tested). The six stand > 100 u apart, so at most one is ever drawn.
  - Body ready after arriving: 0.3 s at Rosa, ≈ 1.2 s at Marcus on the phone profile (390×844, dpr 3).
  - **P7**: production builds of the same tree before / after: GameRoot **328.06 → 299.62 KB gzip**; the landmark library
    is its own 26.6 KB chunk; `cityLive` 1.05 KB, `residentTasks` 6.38 KB, `residentLooks` 2.52 KB. The residents
    themselves added 3.4 KB to GameRoot (324.65 → 328.06: the data, the lists, the interactables).
- **Shots** (`docs/opus-bay/qa/w3/G2/`): `g2-residents-lineup.jpg` (the six bodies side by side, a QA lineup),
  `g2-ray-takes-the-loaf.jpg`, `g2-favour-done-tell-them.jpg`, `g2-real-ride-finishes-ray-favour.jpg`,
  `g2-hank-thanks-fact.jpg`, `g2-budget-rosa-in-view.jpg`, `g2-journal-favours-desktop.jpg`,
  `g2-phone390-goalscard-favours.jpg`, `g2-phone375-journal-favours.jpg`, `g2-phone390-marcus-ask.jpg` (touch: the
  "和 Marcus 聊聊" button, his portrait, big choices).

### Decisions

- **Six favours, six kinds of play**: a real ride (F's counted segment), a delivery between two residents, a postcard, a
  walk across the park, a walk onto the bridge, a climb. They finish the moment you do them; the thanks is a reward you
  can collect any time (no "go back to complete" gate, which reads as busywork on a phone).
- **Lenient on how you get there** (bike and toy car count; fast travel and the pelican do not). The strict "on your own"
  rule stays with the explorer goals.
- **Baker by Washington Square, not the Dragon Gate**: her portrait holds sourdough, so North Beach; the narrow Grant Ave
  sidewalk would have had her block the path (spots need 0.9 u of room, tested). Marcus moved 9 u up Haight St for the
  same reason.
- **Bodies in their own chunk, built on first approach** (220 u), shown at 150 u, hidden at 160 u: a resident costs
  nothing until you are near, and the main graph pays only for the data.
- **Cable-car words say "a few stops"**: F counts a ride after 150 u; "坐满一站" in the goal hint, Ray's lines and the
  early-hop-off hook promised less than the rule.
- **P7 by writing the arrivals out**, checked against D2's function, instead of a dynamic import: the landmark cards must
  exist synchronously (data/pois resolves them at import). This also answers E2's request 3 (same subject):
  `baybayLines` / `residentTasks` / `cityLive` import the landmark library only inside their own lazy chunks.
- **D2's optional note** (the landmark part of `ZH_GLOSSARY` / `PLANNER_DROP` is redundant after D2-12): kept — harmless,
  and the glossary also drives the zh checks in the tests.

### Known gaps

- A hidden resident's blob shadow is still drawn by the actor system at its spot (a faint smudge, visible only from far
  or high views, and during the ≈ 1 s body build). Request 1.
- The conversation camera sometimes has BAYBAY or the player between the lens and the resident (E2's two-shot; seen with
  Luz in the narrow alley and Rosa at her corner).
- `goalsDone` is saved with a 64-entry cap (G1's `data/wishlist.ts`); a player who visits all 41 neighbourhoods and does
  every goal and favour gets close to it. Request 2.
- F's inline fallback for the early-hop-off bubble still says "从一站坐到下一站" (shown only if the hook is missing). Request 4.
- The favours are not in the call menu (问 BAYBAY) yet; the goals card, the journal and the waypoint lead to them.

### Not done

- Nothing of part b's list (G2-6, G2-7, G2-11, G2-12 numbers and shots, sf-tasks). Not in the list and not started:
  voice clips for the residents (no Higgsfield in this lane; they are text + portrait).

### Requests

1. **E2, `src/opus-bay/actors/system.ts`** (the blob loop, l.633): skip hidden city residents:
   `for (const npc of this.npcs) if (npc.visible) blob(npc.x, npc.z, npc.y, (npc.def.scale ?? 1) * 1.05);`
   (`Npc.visible` is always true for the waterfront residents, so district mode is unchanged.)
2. **G1, `src/opus-bay/data/wishlist.ts`** `readProgress` l.107: read `goalsDone` with a larger cap, e.g.
   `goalsDone: strings(raw.goalsDone, 128),` (41 `hood:` marks + goals + favour marks come close to 64).
3. **C2, `tests/opus-bay-sf-budget.test.ts`**: the five `LANDMARK_EDGES_PENDING` entries are gone from the code (the P7
   test passes); empty the list so it pins the new state (`const LANDMARK_EDGES_PENDING: string[] = [];`).
4. **F, `src/opus-bay/game/transit.ts`** l.414, the fallback text:
   `{ zh: '多坐几站再下车，才算坐过叮当车哦', en: 'Ride a few stops before you hop off and it counts as a cable-car ride' }`.

Relayed messages during part b: none.
