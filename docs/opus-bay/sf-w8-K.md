# Wave 8 · lane K · BAYBAY, feel, safety

Worktree `C:/Users/willy/wt/w8-k` (branch `w8-k`), dev port 5801, scratch `C:/Users/willy/opus-qa/w8/k/`, QA images
`docs/opus-bay/qa/w8/K/`. Owns `game/**` except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`, `album.ts`, `photo.ts`;
`actors/**` (X's look edits excepted); `eggs/**`; `data/cityZones.ts`; `play/PlayChip.tsx`, `play/chip.ts`, `play/kit.ts`;
`world/sf/props.ts` (`treesNear`); the canopy part of `world/materials.ts` (city-only).

## 给主人的摘要

1. **P0 已修并在手机上实测**：抓娃娃面板开着等 60 秒——BAYBAY 不再自己插话（以前到 59 秒会冒出「金色时刻！」，第一次进游戏的玩家还会听到「点一下你自己…」的配音）；关上面板后，攒着的台词按顺序再说。小游戏面板、彩蛋卡、万圣节明信片、相册、来信、新店卡都算。
2. 小游戏自己的台词（「哎呀，滑掉了！」「新的纪念品！」，X 线已配音）以前被面板盖住、只听到声音；现在气泡会自动挪到面板下方，看得见。
3. **海德街叮当车坐着时，路边树冠不再挡住镜头**：只对行道树的叶子做"镜头和人之间的半透明"，不加任何绘制批次；手机和电脑上都拍了前后对比（见 `qa/w8/K/b-k5-*`）。走路时的树保持原样（试过全透，树只剩光秃秃的树干，不好看，已取消）。
4. 带名字的 BAYBAY 气泡（「最近的观景点：××」「跟我来！去××」「抓紧！我们飞去××」等）改成固定句子，名字放到提示条/地图标记/行程条上，这样 X 线能给它们配音（前 8 句 X 线已录好，最后 3 句 22:45 推送，等 X 线 23:40 那一轮录）。
5. 其他线加新面板时，只要在 `game/baybayHold.ts` 的列表里加一行；面板根节点加 `data-ob-hud-box`，BAYBAY 的气泡就会自动避开它。

## Part a (2026-09-30, 18:52–19:15 PDT): P0 · BAYBAY talks under a lazy overlay

### What was built

- **`game/baybayHold.ts`** (new, strings only, ≈ 1 KB, imports nothing but `ui/slots`):
  - `BAYBAY_HOLD_OVERLAYS` — the overlay ids that hold BAYBAY's ambient lines while open: `play-claw`, `play-crab`,
    `play-dough`, `play-fortune` (lane M, W7), `w2-skyline` (W2), `play-result` (the PlayKit medal card), `play-snap`
    (the crest polaroid), `play-lion-badges` (the sea-lion count), `play-emotes` (the emote wheel), `h-postcard`,
    `egg-card`, `egg-note`, `egg-operator`, `egg-listen`, `c-album`, `c-letter`, `realsf-opening`.
    **Lanes M / A / H (and anyone adding a panel): append your overlay id to this array, one line, named in your commit.**
  - `BAYBAY_HOLD_ACTIVITIES` — PlayKit activity ids that hold them while they run, panel or not: `claw`, `crab`,
    `sourdough`, `fortune`, `skyline`, `kite`, `hide-seek`, `bell`. A new game with no panel of its own during which
    BAYBAY must not chatter goes here (its `startActivity` id).
  - `BUBBLE_WAIT_OVERLAYS = ['h-postcard']`; `baybayHeld()`, `holdingOverlay()`, `bubbleWaits()`,
    `noteHoldActivity(id)` (called by `play/kit.ts` on every start / stop / reset).
  - Never `openOverlays().length`: `play-chip` and `play-flight` are overlays too and never hold (the glide / stairs /
    ride lines go on under them); the shop (`e-shop`, `e-ticket`) is not in the list (its own 好看！买下啦。 line is
    said while it is open).
- **The gates** — `|| baybayHeld()` in every unprompted BAYBAY line source:
  - `game/cityMoments.ts` `stepPacer` (arrival, tour, transit, tunnel lines; a held line waits its ttl out) and the
    rumour teller's `rumourMoment`; `game/baybayLines.ts` (event + neighbourhood lines); `game/pelicanFirst.ts` (the
    pelican moment waits);
  - surgical, one clause each (named here and in the commit): `realsf/index.ts` (lane S: the Bay's calendar lines),
    `halloween/world.ts` (lane H: the season's lines and the lantern sniff), `economy/lines.ts` `quietNow` (the
    notebook / ticket / compass lines; not the shop).
- **`game/flow.ts` `bubble()`** now returns whether the bubble is on screen. While the Halloween postcard is open it
  **waits**: the last bubble said is kept (up to `BUBBLE_WAIT_MAX` 15 s) and shown once the card has closed and no
  other bubble is up (so the card's own 万圣节明信片收进手帐啦 keep line goes first); older than 15 s it is dropped (not
  said late). A play panel never holds a bubble: the games say their own lines over their own panels.
- **A voice never plays with its bubble hidden**: the pacer, `baybayLines` and `realsf` emit their `voice-line` only
  when `bubble()` returned true (voiceW5's text-matched lines already follow the bubble on screen, so a waiting bubble
  is voiced when it shows).
- Test **`tests/opus-bay-w8-k1-hold.test.ts`** (6): the pacer's voiced tour line under each of 7 panels (no bubble, no
  voice; said with its voice once the panel closes); the first-hill and first-bike lines under an egg card and the
  Halloween postcard; the play chip + first-flight chip do not hold; `bubble()` waits behind the postcard, shows after,
  is dropped after 15 s, and a game's own bubble shows over its own panel; the list / activities / every scheduler asks
  `baybayHeld()` / the gate imports no lazy module; hide & seek and the kite hold, a stairs race does not.
  **Red on the old code: 5 of 6** ("no tour line under play-claw", "nothing said under the egg card", "not on screen
  under the card", "game/cityMoments.ts asks baybayHeld()", "hide-seek: [前面就是渡轮大厦…]"); green after.

### Evidence

- Checks on `f1891399` (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old warnings) ·
  suite **1666 / 1666** (145 s). Touched lanes' tests (lines, verify-c, w5 content / eggs / play / shop, w6-h, w7-g
  postcards, w7-h, w7-m games, w7-w2 kite / skyline / hide & seek, tripflow): 233 / 233.

### Decisions

- The hold covers every unprompted BAYBAY line source I found (5 schedulers + the rumours + the pelican moment), not only
  the two W7-I named: the realsf calendar lines and the Halloween world lines had the same gap.
- The cards (album, letter, a 新店 card) hold too: they are modal cards like the egg card. The shop does not.
- The pacer still ignores `quietUntil` (the games' quiet minute) as before: its lines are the tour / transit / arrival
  narration; the hold list is the stronger, explicit rule.
- `bubble()` waits only behind the Halloween postcard (lane G's request: a modal like the city postcard reward, whose
  bubbles are still dropped as before).

### Known gaps

- Not yet played live (part a pushed first so the other lanes have the list; a live check follows in part b).

### Requests

- **Lanes M, A, H, W1, W2, S**: a new panel / card overlay → one line in `game/baybayHold.ts` `BAYBAY_HOLD_OVERLAYS`
  (and a PlayKit activity that must be quiet without a panel → `BAYBAY_HOLD_ACTIVITIES`), named in your commit.

## Part a2 (2026-09-30, 19:24–21:10 PDT, the Ultra resume): W8-K3 pushed, the live 60 s proof, W8-K4

The first agent was stopped at 19:20 only because the wave became one Ultra workflow. Kept whole: W8-K1 / W8-K2 (pushed),
W8-K3 (committed: checked and pushed as `cc5dbdc5`), the canopy work (uncommitted: finished as W8-K5, part b). Nothing
was discarded; its scratch shots `hyde8-phone-seat-*` were unusable (the new save's goals card covered the frame) and
were shot again.

### W8-K3 (`cc5dbdc5`): templated bubbles → fixed lines + a toast / the waypoint

As committed by the first agent (its message has the list): the skyline quiz's 最近的观景点：<name> → `SKYLINE_LINES.noViewPin`
+ the lookout on a toast and as the map target; the free lead, the trip's arrival and next ride, go-to's 就在这里, the line
boarding, the view-spot sit → `game/fixedLines.ts W8K_LINES`; the welcome back (city) → the recorded 欢迎回来！我们接着逛吧。
+ the area on a toast. District bubbles unchanged. Checks before its push: tsc 0 · eslint 0 errors (50 old warnings) ·
suite 1670: 1669 pass, 1 wall-clock assert (`sf-move2` E2-5 "a cached cell is cheap", 1000 calls < 50 ms) under load —
alone 24 / 24 (rule 9).

**New fixed BAYBAY lines for lane X (zh + en, no templates; on origin since `cc5dbdc5`; recorded by lane X in W8-X3 `da07f2a9`):**

| where | zh | en |
|---|---|---|
| `game/fixedLines.ts` `leadGo` | 跟我来！我带你过去～ | Follow me — I’ll take you there! |
| `leadArrive` | 到啦！试试看吧～ | Here we are — give it a try! |
| `tripHere` | 到啦！就是这里～ | Here we are! |
| `tripToStop` | 去车站，我们坐车过去！ | To the stop — we’ll ride there! |
| `goToHere` | 就在这里啦！ | It’s right here! |
| `allAboard` | 上车！出发咯～ | All aboard — off we go! |
| `sitView` | 坐一会儿，看看风景～ | Let’s sit and take in the view. |
| `play/skylineLines.ts` `noViewPin` | 最近的观景点我标出来啦，跟着标记走吧！ | I’ve marked the nearest lookout — just follow the pin! |

### The live proof (P0 item 1's "open the claw panel and wait 60 s")

`C:/Users/willy/opus-qa/w8/k/hold60.mjs`: dev 5801, one headless Chrome, 390 × 844 dpr 3 (mid), a new save (`save=off`),
the goals step answered with 我自己逛 (Escape), teleport to the Musée's claw spot, `startClaw()`, then 60 s with every
BAYBAY bubble and every `voice-line` event logged (with the open overlays); two lines offered meanwhile the way the game
offers them (the loop's voiced Ferry Building approach through the pacer, a `hill` event line); then the panel closed
(Escape) and 15 s more.

- **Run 1 (W8-K1 only, 19:33):** under the panel the claw's own lines (新的纪念品！, 差一点点！ ×3) and, at 59.3 s,
  **金色时刻！这光拍什么都好看。** — `game/brain.ts`'s light line, which waited only for the claw's own 60 s `quietUntil`. No
  voice under the panel. The flow bubble at 60 s was set but **not visible on screen**: the bubble anchor (z 8) sits
  under the claw panel (z 43). After closing: the ticket-gift line (voiced), the crab-wheel bark, the held Ferry Building
  line with its voice.
- **Run 2 (brain + zones gated, 20:03):** no light line, but at 66 s **点一下你自己，可以挥手、跳舞、和我自拍！ with its voice**
  (`w5-a-24fec38d`, play/index.ts's once-per-device emote coach: 50 s of a still player). After closing, the sea-otter
  float line (play/pet.ts) replaced the crab-wheel bark 0.6 s after it showed.
- **Run 3 (W8-K4 complete, 20:14):** under the panel only the claw's own 4 lines, **0 voices**; after closing the light
  line, the crab-wheel bark and a rumour (voiced), one after the other.

### W8-K4 (`f6d95e78`): what the proof found

- `game/brain.ts`: her small talk (the light line, the idle lines, the pass-by barks) is `quiet` while `baybayHeld()`.
- `play/index.ts` (lane A's, surgical): the emote coach's quiet test asks `baybayHeld()`. W5-A1's play-core budget
  (≤ 6144 B gzip of the static play graph): 6130 → **6143 B** (1 B left — lanes adding static play code need room; the
  `zones.ts` / `pet.ts` gates are outside the core).
- `play/pet.ts` (surgical): the float line waits for a bubble on screen and for a held panel (W5-A3 follows on purpose).
- `play/zones.ts` (surgical): `zoneInvite` / `sayWhenQuiet` knew the activity, not a card: they ask `baybayHeld()`.
- `game/hudLayout.ts` `HUD_BOX_SELECTOR` += `.ob-sfg-panel` (claw / crab / dough / fortune and lane M's new grip panel),
  `.ob-play-sky`, `.ob-play-snap`, `.ob-play-lion-badges`, `[data-ob-hud-box]`: the bubble is placed round the play panels
  like round the rest of the fixed HUD, so the games' own (now voiced, W8-X1) lines are read, not only heard. Shot
  `qa/w8/K/a-k4-claw-phone-own-bubble.jpg` (run 3).
- `game/baybayHold.ts`: `baybayHeld()` is a **city rule** (`worldMode === 'city'`): brain / zones / the coach speak in
  the district too, and the district never changes.
- Test `tests/opus-bay-w8-k4-hold.test.ts` (4) — red on the old files (with only `brain.ts` reverted: the light line under
  `play-claw`; an invite under the egg card; the selector), green now.
- Checks on the K4 tree (rebased onto `79326be9`): tsc 0 · eslint 0 errors (50 old warnings) · suite **1690 / 1690**.
  Re-run after the last rebases (A1, S2, W2a, H1–H4, M1–M2, W11): tsc 0 and their test files + mine 66 / 66.

## Part b (2026-09-30, 20:45–21:50 PDT): W8-K5 · the seated Hyde St rider under a canopy

### What was built (`W8-K5`)

- **`world/sf/props.ts`**: the street trees' leaves (round-tree blobs, cypress / pine cones, the palm crown and fronds)
  carry `aInfo.x` `CANOPY_INFO` = 11; trunks, lamps and the far lollipops stay untagged (nothing else uses 11; window
  styles test `< 6.5`, `== 7 / 8 / 9 / 10`). `CityProps.stepCanopyFade()` (each frame from `update`) sets `U.uCanopy` =
  the player's chest (`CANOPY_FADE_CHEST` 0.9 u over the feet) with w = 1 only while a canopy within `CANOPY_FADE_REACH`
  2.6 u hangs in the band 0.5 u below … 3.6 u above the feet (`treesNear`), the camera stands within `CANOPY_CAM_NEAR` 7 u
  of the chest and the occlusion fade is on (photo mode / SoloView turn it off); w = 0 on dispose (district).
- **`data/sf/cityShaders.ts` `toyCanopy`** (lane P's W8-P1 layout: city-only GLSL rides in the city data chunk;
  `world/cityShaderSlot.ts` NONE gets `toyCanopy: ''`): spliced into `TOY_FRAG` right after the occlusion fade, in the
  non-hero branch. The tagged leaves inside a tube along the camera's last 3.5 u to the chest (radius 1 → 2.2 u) thin to
  the Bayer dither (≤ 90 %), with none of the occlusion fade's `L − 1.2` / `+ 0.35` cut-offs (those kept the leaves at
  the rider whole). `world/materials.ts`: only `U.uCanopy` and its `uniform vec4` line.
- **`treesNear` without an iterator** (W7-K review open item): `Map.forEach` with one bound callback and the query in
  fields — no iterator / entry array per resident chunk per call.
- Test `tests/opus-bay-w8-k5-canopy.test.ts` (3): the tags (leaves, not trunks / lamps / lollipops); the block spliced
  once inside the non-hero branch; the gates (an overhanging canopy on, 6 u along the street off, a tree down the hill
  off, the camera 7+ u off off, the bench shot on, `uFade` 0 off, dispose off); `treesNear`'s answers. Lane P's `w8-p`
  splice / district tests pass with the new block (the district's program keeps its braces without it).

### Evidence

- `C:/Users/willy/opus-qa/w8/k/hyde8.mjs` (dev 5801, one headless Chrome, `?date=2026-09-30T13:00`, a new save with the
  goals step answered): from Hyde & Beach on the Powell–Hyde, seated (E), at 5 spots up Hyde St the game paused and the
  same frame shot with the dither on and forced off (`stepCanopyFade` overridden). **Phone 390 × 844 dpr 3 (mid):** off,
  a kerb tree's canopy fills the middle of the frame and hides the rider at the first blocks; on, the rider and BAYBAY
  show through a dither (`qa/w8/K/b-k5-hyde-seat-phone-off-on.jpg`, spots 0 and 3, read). **Desktop 1440 × 900
  (high):** the same (`qa/w8/K/b-k5-hyde-seat-desktop-off-on.jpg`, read). Draw calls equal on / off at every spot
  (phone 68–75, desktop 89–93; tris ≤ 357 k): **0 new draw calls**. (The pause does not freeze the car itself: at
  2 of 5 spots the off frame is ≈ 1–2 u further on.)
- **On foot** (`walk8.mjs`, phone, beside two street trees on Bush St and Greenwich St): the first cut (the agent's
  original sphere of 1.3–2.3 u round the chest + the tube) erased the whole canopy over a walker, leaving a bare trunk
  next to the player (read). Dropped: the sphere is gone, and the dither needs the camera within 7 u — the follow
  camera on foot (≈ 12 u, high) keeps the occlusion fade alone: w = 0 there, the trees as before.
- Checks on `b544ac56`: tsc 0 · eslint 0 errors (50 old warnings) · suite **1734 / 1734**.

### Decisions

- A tube along the camera's line only (no sphere): the leaves beside and behind the rider stay; only those between the
  camera and the chest thin out.
- City only, gated by the camera's distance: the seated / side-on ride shots (≈ 4 u) and any close camera get it; the
  high follow camera on foot does not (it did not need it: the occlusion fade and W7-K1's lift handle it).
- The GLSL lives in lane P's city shader table, not in `materials.ts` (P's W8-P1 moved the city-only GLSL out of
  GameRoot): `materials.ts` grows by one uniform.

### Known gaps

- The dither edge is visible on a large canopy at the tube's rim (a band of dither, read in the desktop pair) — the
  smoothstep from 0.55 R to R; acceptable for a toy look.
- Not played with the Powell–Mason / California lines (the same `CityProps` code; their kerb trees are fewer).

## Part c (2026-09-30, 22:00–22:45 PDT): the bubble beside the panels, the kite, the new boats

### W8-K7: the bubble half under the claw panel

The run-3 shot of part a2 showed the claw's own 新的纪念品！ **half under the panel**: `placeBubble`'s three passes pushed it
below the panel, then above the Hop button, then below the panel again, and stopped there. Now, when the bubble still
covers a box after the passes, the free candidate nearest the anchor wins (rows below / above every box, each with the
anchor's x or beside a box; x kept on screen — `game/Systems.tsx` passes `[half, w − half]`, `hudLayoutSlot` forwards
it). The 3-pass answer is kept whenever it is free (the sf-hud / w7-p placement tests unchanged). Test `W8-K4b` (the
phone layout of that shot) red on the old file, green now. **Live again** (`hold60.mjs`, phone, 22:05): the bubble
sits fully below the panel, left of Hop (`qa/w8/K/a-k7-claw-phone-bubble-below-panel.jpg`, read); the claw's 4 own
lines now voiced (W8-X1 on origin) with their bubbles on screen; still no ambient line, 0 other voices under the panel.

### W8-K8: the kite (W7-W2 review items)

- `play/PlayChip.tsx`: the hold button (放线, the slides' tuck, the marshmallow's 按住烤) blurs after a **mouse** press, so
  Space / E reach the games' own keys again (`play/partc.ts holdKeys` skips a focused BUTTON); with the keyboard focus on
  it (tabbed to) it holds on Space / Enter / E itself and lets go on blur. Pure helper `play/chipKeys.ts`.
- `play/kite.ts` (lane W2's, surgical): the 75 s `quietUntil` it sets at the start is brought down to 8 s after the round
  (不玩了, walking off, the end) when it is still the kite's own.
- Test `tests/opus-bay-w8-k8-kite.test.ts` (2), the quiet part red on the old `kite.ts`; `w7-w2-kite` (5) green.
- **Live** (`kite8.mjs`, desktop 1440 × 900, Marina Green, 放风筝 from 问 BAYBAY, a mouse press on 放线 at its settled
  place, `elementFromPoint` = the button): `document.activeElement` after the press = **BODY** (before: the button), so
  Space goes to the kite's `holdKeys`. (The line % while Space was held moved with the wind: 30 → 32 % in a lull; in the
  first, mis-aimed run — the press landed on the Postcards pill while the chip was still popping in and opened the
  journal, also not a button — 22 → 73 % in a gust. A first press must wait for the chip's pop-in: noted for QA scripts.)

### Part c item 5: BAYBAY on foot and the parked ride vs wave 8's new boats — do the W7 rules hold?

Read on origin (`f80e8a2d` A1, `65478b6d` A3, `ec790ebc` S2): **they do not apply — the boats stay on the water.**
- Lane A's Alcatraz ferry (`world/sf/alcatrazFerrySystem.ts`) lies in Pier 33's slip bow to the shore and runs its own
  lanes on the Bay; lane S's Parade of Ships (`world/sf/fleetWeek.ts`) sails a line under the bridge to the Bay Bridge.
  Neither is in streetNet's road-vehicle list (`world/transitLayer.ts roadVehicles`: the cable cars, the F-line, the
  loop bus and the Metro only), so W7-K2's `clearTransitPaths` (the tow) and `guideAside` (BAYBAY's step off the rails)
  never see them — and need not: BAYBAY's targets must pass `canStand` (no water) and a parked ride cannot be driven
  into a slip (`collide`). Boarding (the player and BAYBAY) is the ferry's own protocol (lane A).
- No code change; nothing to test beyond what A / S test (their ferry / parade tests pass on my tree).

### Not done

- **A parked ride > 250 u away is still towed only on the player's return** (W7 known gap): the road-vehicle list holds
  the transit within 250 u of the player, so a car left on the rails far away is towed the moment the player comes back
  within 250 u (≈ at the edge of what is drawn). A static check against every line's path when the player leaves needs
  the four lines' geometry (the cable lines, the F-line path, the loop and the Metro), ≈ 1 h with tests: left for wave 9
  as the item stands (nobody sees the car meanwhile).
- The emote coach was the last byte of W5-A1's play-core budget (6143 / 6144 B): a lane adding static play code needs
  room (lane P's call).

### Checks (part c)

- On `5485c1a8` (W8-K7 + W8-K8 on `67bbd5b0`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50
  old warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1769 / 1769**.

### W8-K10: a trip's first line (pushed ≈ 22:50, for lane X's 23:40 pass)

`game/tripRun.ts startTrip` (the map's 带我去, a row, 问 BAYBAY, goTo) said 抓紧！我们飞去<name> / 跟我来！坐车去<name> / 先去坐上小车
（骑上单车），再去<name>！ / 跟我来！去<name> — templated, never voiced. In the city (the trip pill and the announce name the
place) it now says a fixed line; the district keeps its bubbles. **Three new fixed lines for lane X** (`game/fixedLines.ts`):

| key | zh | en |
|---|---|---|
| `tripFly` | 抓紧！我们飞过去～ | Hold on — we’ll fly there! |
| `tripBike` | 先骑上单车，再出发！ | Hop on the bike first, then off we go! |
| `tripCar` | 先坐上小车，再出发！ | Into the toy car first, then off we go! |

A ride on any leg says the recorded `tripToStop`, on foot the recorded `leadGo` (both W8-X3). Test: `w8-k3-lines` W8-K10.
Live (`trip10.mjs`, phone, from the Ferry Building, `guide.qaTrip` walk to the Palace of Fine Arts and to Coit Tower):
the bubble 跟我来！我带你过去～ / Follow me — I’ll take you there!, the pill "Next: The Palace ~2 min" and the waypoint
"Palace of Fine Arts · ~2 min" name the place (read).
The district's first tour (`flow.ts leadBubble` 下一站：<stop>) is district-only and stays.

## Final (2026-09-30, 22:50 PDT)

### Where a reviewer should look first

1. The claw panel at the Musée (phone 390 × 844): open it and wait 60 s — no ambient bubble / voice; the claw's own lines
   docked below the panel, clear of Hop (`hold60.mjs` in scratch reproduces it with a log).
2. Seated on the Powell–Hyde up Hyde St (phone and desktop): the kerb trees' canopies dither in front of the rider; on foot
   the trees are as before (`hyde8.mjs`, `walk8.mjs`).
3. `game/baybayHold.ts` (the list other lanes extend; `baybayHeld()` is now city-only) and `game/hudLayout.ts`
   (`HUD_BOX_SELECTOR`, `placeBubble`'s fallback).
4. The kite on desktop: a mouse press on 放线, then Space (the focus is back on the page).

### Requests

- **Lanes M / A / H / S / W1 / W2:** a new panel → one line in `game/baybayHold.ts BAYBAY_HOLD_OVERLAYS`; a panel root
  that is not `.ob-sfg-panel` → `data-ob-hud-box` on it so BAYBAY's bubble is placed round it (lane M's grip and busk
  panels are `.ob-sfg-panel`: covered).
- **Lane X:** the three W8-K10 lines above (zh + en exactly as in `game/fixedLines.ts`).
- **Lane P / the lead:** W5-A1's play-core budget is at 6143 / 6144 B gzip after W8-K4's coach gate — the next static
  addition to `play/index.ts`'s graph needs a trim or a decision on the budget.
- **QA scripts:** a first click on the activity chip must wait for its pop-in (≈ 0.5 s): measured too early, the press
  lands on the Postcards pill (top right) and opens the journal.

### Final checks

- On W8-K10 (rebased onto `d3114585`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old
  warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1785 / 1785**. After the last
  rebase before the push: tsc and the incoming lanes' test files re-run (below the push line in the commit log).
- No Higgsfield credits spent (lane K has no allowance). Dev server 5801 and every headless Chrome of the lane stopped
  at the end; scratch scripts in `C:/Users/willy/opus-qa/w8/k/` (`hold60.mjs`, `hyde8.mjs`, `walk8.mjs`, `kite8.mjs`,
  `trip10.mjs`, `drv.mjs`, `pair.py`).
