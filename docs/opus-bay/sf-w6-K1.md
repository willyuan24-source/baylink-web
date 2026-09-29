# Wave 6 · lane K1 · feel & play fixes

Worktree `C:/Users/willy/wt/w6-k1` (branch `w6-k1`), dev port 5601, scratch `C:/Users/willy/opus-qa/w6/k1/`, QA images
`docs/opus-bay/qa/w6/K1/`. Owns `actors/**`, `play/**` (except lane W's new files), `eggs/**`.

## 给主人的摘要

1. 手机摇杆修好了：以前手指按住时如果页面尺寸变了一下（比如 iPhone 的工具栏出现/消失），摇杆底座会跟着跑，人物会突然掉头往回走；现在摇杆只看手指本身的位置，页面怎么变都不会反向（390×844 和 375×667 都实测过）。
2. 街区模式（?world=district）恢复成和第五波之前完全一样：跳上台阶不再"手扒边缘爬上去"，攀爬只在整座旧金山模式里有。
3. 第五波审查留下的小毛病都修了：对话开着时瞬移后 BAYBAY 不会再跑回老地方；E 键提示会跟着改名（飞行表演开始后显示"拍飞机编队"）；换世界时天色立刻切换；坐渡轮时提示写"船上 / 下船"；在金门大桥桥面上不会再误触发"海獭亲戚"彩蛋（下到炮台水边才触发，已实测）；彩虹脚印、桥面行走、自动飞行、爬楼梯比赛、缆车摇铃不再每帧制造垃圾对象。
4. 缆车转盘"嘿咻推"不会再抢走车站的"坐叮当车"按钮；飞行金圈的代码在解锁鹈鹕时就提前加载，第一次飞行不再卡一下。
5. 坐海德街缆车时镜头不会再钻进两边的房子里：街道窄的时候镜头自动绕到车后方、稍高一点，看得见站在踏板上的你（电脑和手机都实测过）；街边的树还会半透明地挡一点，留作下次再优化。

## Part a (2026-09-29, 01:53–02:10 PDT): the floating stick, the mantle in the district

### What was built

- **W6-K1a `be8a9f15` (the stick, NEXT P0 #2, W5-Z §7.2)** `actors/pointer.ts`: the floating stick's base is kept in
  **client coordinates** (`export const stickBase = { x, y }`), like the thumb; the reading is thumb − base, so the canvas
  rect never enters it. Before, the base was stored relative to the rect and the reading was `thumb − rect − base`: a
  rect that moved for one move event (W5-Z: a CDP screenshot; on an iPhone a toolbar resize could) looked like a 60 px
  thumb jump, dragged the floating base past the rim and flipped the reading (moveY +1 → −0.99). The rect is now read
  only to paint `stickView.baseX / baseY` (what `TouchControls` draws, unchanged API), and a `resize` of the window or
  the visual viewport (`visualViewport` `resize` / `scroll`) repaints the base while a thumb is down; all listeners are
  removed on detach.
- **W6-K1b `2061d31f` (the mantle, the lead's decision §6)** `actors/controller.ts`: W5-F10's mantle (a hop against a 0.45–1.6 u
  ledge climbs it hands first) and the "higher than 1.6 u is a wall even in a jump" rule both run only with city terrain
  (`cityTerrain()`); in the district the hop lands on the ledge as before wave 5.
- Tests: `tests/opus-bay-w6-k1-stick.test.ts` (2: a rect that jumps 60 px mid-touch keeps the reading up, then reverse
  is still instant; the drawn base follows the rect and a visual viewport resize repaints it, listeners removed) —
  **red on the old `pointer.ts`** (the reading flipped to −0.13 while the rect was off); `tests/opus-bay-w6-k1-feel.test.ts`
  (1: the district's only 1 u ledge, the plaza at the top of the stairs at (−55, 57.5), y 19.0 → 20.0: a hop from
  x −56.5 lands on the plaza with **no mantle** — **red on the old controller**: 1 mantle). The ledge was found with a
  node probe over the whole district (a 0.5 u scan for 0.5–1.5 u rises, then a run-and-hop sweep over 12 248 starts: this
  is the one place the district mantled).

### Evidence

- Checks on `2061d31f` (rebased; pushed with the report as `c30942b9`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1384 / 1384**, fail 0 (W5-F10's city mantle
  test unchanged and green; the hero regression green).
- Live, dev server 5601, headless Chrome (one at a time, PERF-LOCK absent), `?world=city&start=free&quality=mid`, touch,
  dpr 3 (`C:/Users/willy/opus-qa/w6/k1/stick.mjs`): thumb down at (110, 0.76 H), pushed 70 px up, held 0.8 s, then the
  viewport shrinks by 70 px mid-touch (`Emulation.setDeviceMetricsOverride`, an iOS-like toolbar coming in: `innerHeight`
  and `visualViewport.height` 844 → 774), a screenshot taken mid-touch, the viewport restored, then the thumb pulled down.
  - **390 × 844**: stick y = **1.000** at every reading while pushed (pushed · held · toolbar in · after the mid-touch
    screenshot · toolbar out), then −1.000 on the pull (instant reverse), 0 on release; the drawn base
    (`translate3d(110px, 617px)`) equals `stickBase` minus the rect, under the thumb's path.
  - **375 × 667** (→ 597 with the toolbar): the same, y = 1.000 at all five up readings, −1 on the pull.
  - Shot `docs/opus-bay/qa/w6/K1/a-stick-toolbar-phone.jpg` (read): taken with the toolbar in (390 × 774), the stick's
    base and knob drawn under the thumb, knob at the top of the ring, the HUD intact.
- (Chrome's viewport resize moves the bottom edge, so the rect's origin stays put there; the rect-jump case itself is
  the node test's, which reproduces W5-Z's flip on the old code.)

### Decisions

- Kept `stickView`'s shape (canvas-relative, for `TouchControls`) and added `stickBase` (client px) beside it rather than
  changing the paint contract; no "skip a move whose rect changed" filter is needed once the rect is out of the reading.
- The mantle gate is the whole block (mantle + the city's "too high is a wall" rule), keyed on `cityTerrain()` like the
  rest of the controller's city-only guards.

### Known gaps

- No real iPhone (as in W5-Z): a Safari top-bar collapse that moves the layout viewport's origin under a still thumb
  would still read as a thumb move (as it always did); with the game's `touch-action: none` page nothing scrolls, so
  this should not happen.

### Not done (this part)

- Nothing from part a's list.

### Requests

- None.

## Part b (2026-09-29, 02:15–03:15 PDT): the reviews' small items (F, D, A) and a far talk target

### What was built

| commit | item (source) | what changed | files |
|---|---|---|---|
| `65ee092d` | F · deck and auto-glide garbage; A · stair-race and bell-pad garbage | `deckAt(x, z, y?, out?)`, `deckWish(…, out?)`, `deckDip(…, out?)` write into the caller's object; new `onDeck(x, z, y?)` (no object); `laneClear` probes inline (no `deckPoint` per probe); the controller keeps `deckOut` / `wishOut` / `dipOut` / `dipOut2`, the camera `deckOut`. `GlideSim.floorAt(world, x, z, out?)` (+ `GlideFloor`); the flight's three probes use two reused floors; `autoGlideInput(g, to, world, out?)`; the move system's `flyGlide` fills one `glideIn` for the stick, the auto-glide and the approach (never writing into `NO_GLIDE_INPUT`). `lineProgress(l, x, z, out?)` with no object per segment; the race's finish test is a module function (no closure per frame). Bell pad: the cursor / meter are style writes from the rAF loop; React re-renders only when `riffLook(now)` changes (phase, round, dots lit / missed, jazz count, flash) — before, every frame of the 20 s riff. (The glide's `step` report object stays: one per frame, callers keep it.) | `actors/{deckSteer,feet,controller,camera,glide,moveSystem}.ts`, `play/{stairs,bell}.ts`, `play/BellPad.tsx` |
| `92796327` | W5-Z §7.5 · BAYBAY's far talk target (F / C) | `GuideMover.step`: a `talk` target more than `TALK_FAR` = 30 u from the player is dropped (every live talk mark stands beside the player: a resident ≤ 7 u, the stage / welcome / pelican marks); with a dialogue left open across a teleport she stays by the player instead of walking off, re-planning a long `findPath` and hopping back in | `actors/guide.ts` |
| `2038f2c9` | F · the stale E prompt (lane R's review) | `ContextAction` subscribes to `interactablesEpoch` and re-reads its interactable in an effect (after Systems' layout effect has swapped the rebuilt list in): the jets' 看看飞行表演 → 拍飞机编队 now shows. **A surgical fix in lane K2's `ui/Hud.tsx`** (7 lines) | `ui/Hud.tsx` |
| `57c56a75` | F · `useTimeOfDay` on a world switch (lane R's review) | the world is an effect dependency and passed to `bayTimeOfDay`: a switch re-applies the band at once. **Surgical, lane K2's `ui/Overlay.tsx`** (4 lines) | `ui/Overlay.tsx` |
| `e76e4ebe` | F · the ferry's 车厢里 chip (lane T's review) | aboard the ferry the move chip reads **船上 / On deck** and its hop-off key **下船 / Go ashore**; trains and cable cars keep 车厢里 / 下车. **Surgical, lane K2's `ui/MoveChip.tsx`** (4 lines) | `ui/MoveChip.tsx` |
| `854f3b8e` | D · the sea-otter egg on the GGB deck (W5-Z §7.3) | `otterHost` returns while the player is on the walk deck (`deckSteer.onDeck`: the deck's whole width at deck height — marina's own `onDeck` covers only a ±4 u band of the roadway, which is why the sidewalks fired), on marina's deck band, or above `OTTER_MAX_Y` = 9 u (the fort's waterside is 0.44 u in the published city, the deck 15.22 u: read live) | `eggs/marina.ts` |
| `ac483389` | D · the Castro prints' rebuild floor | `PropPool.step`: a dirty pool rebuilds at most every `PROP_REBUILD_FLOOR` = 0.25 s (a trail's drops and fades were ≈ 500 merged triangles rebuilt at 10 Hz) | `eggs/props.ts` |
| `5134bbf6` | A · heave-ho vs the boarding prompt; prefetch `play/rings` | `placeHeave` parks 嘿咻，推！ while a boarding prompt (a transit stop's, not T's 帮忙推) is in reach (`boardingInReach()`): at Powell & Market the tap in the queue boards, the heave-ho is offered round it — one prompt per tap. `play/index.ts` fetches `./rings` (its layer and the material's warm-up) once `glideUnlocked()` (at once for a save that has it, else on the `subscribeGlide` change of lane C's moment), not on the first flight's first frame | `play/{zones3,index}.ts` |

Tests (all in my files): `tests/opus-bay-w6-k1-feel.test.ts` (+6: the deck queries' out objects and the same answers, the
glide floor / auto-glide, the stair race / bell pad, the far talk mark, the world-switch band, the heave-ho / rings),
`tests/opus-bay-w6-k1-dom.test.ts` (2, jsdom + React: the E prompt re-read, the ferry chip),
`tests/opus-bay-w6-k1-eggs.test.ts` (2: the otter from the deck vs at the water, the prop pool floor). **Red on the old
code**: the far talk mark (she walked 48 u toward it), the E prompt (still 看看飞行表演), the otter (found from the
deck), the prop pool (21 rebuilds in 2 s → ≤ 9).

### Evidence

- Checks on `5134bbf6`: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · suite **1395 / 1395**, fail 0.
- Lane A's size budget (`W5-A1 chunks`): `BellPad.tsx` 5081 B ≤ 5 KB gzip after trimming the cursor writes (a first
  version was 5129 B and failed it), the play core 5716 B ≤ 6 KB.
- Live (dev 5601, 390 × 844, dpr 3): at Fort Point's water (`?at=xz:-747.3,595.5`) the player stands at y 0.47, the
  ground there 0.44, the deck cell 3 u away 15.22; **the egg still fires at the water** (小发现 · BAYBAY's distant cousins,
  `docs/opus-bay/qa/w6/K1/b-otter-at-the-fort-phone.jpg`, read). A live walk onto the deck at s ≈ 114–124 was not run
  (`?at` onto the deck put the player 21 u off the spot); the node test covers the deck.

### Decisions

- The E-prompt, sky-band and chip fixes sit in lane K2's `ui/` files: each is a few lines, named in its commit, so the
  items assigned to K1 could land without waiting for K2.
- `TALK_FAR` = 30 u (every live talk mark is within ≈ 7–10 u of the player; 30 leaves room and is well under the 60 u
  hop-in).
- The heave-ho yields to any boarding prompt in reach (not only the cable car's): no stop's tap should push a turntable.
- `OTTER_MAX_Y` = 9 u: a guard under the deck's `minY` 11 even if the deck registry were empty.

### Known gaps

- The glide's per-frame `GlideReport` object stays (callers keep it past the call).
- The bell pad was not played live (a cable-car ride with the riff); its logic is covered by the source checks and the
  unchanged hit / miss rendering path.

### Not done (this part)

- The Hyde St ride camera (part c).

### Requests

- **K2**: three small edits in your files, please keep them when you touch these lines: `ui/Hud.tsx` ContextAction (the
  `interactablesEpoch` subscription + re-read effect), `ui/Overlay.tsx` `useTimeOfDay` (the `world` dependency),
  `ui/MoveChip.tsx` (船上 / 下船 on the ferry).
- Push note: part b went out as `3b15557b` after four rebases onto a busy `origin/opus-bay` (the full suite ran green on
  three of the rebased heads: 1431, 1437, 1438 tests; the last two rebases brought only other lanes' realsf / Halloween /
  K2 files and were checked with `tsc` + the wave-6 tests before the push, then the full suite on the pushed tree:
  **1457 / 1457**).

## Part c (2026-09-29, 03:55–04:35 PDT): the Hyde St ride camera

### What was built

- **W6-K1m `c3ad471a` + W6-K1n `5833c54c`** `actors/cameraModes.ts` `RideCamera`: the side-on transit shot of the city
  lines (`sub.occlude`, the cable cars; the bus / LRV keep their designed RIDE_TOUR shot) checks at 5 Hz whether a wall
  stands nearer than `SWING_CLEAR` = 70 % of its distance; if so it tries swinging round toward straight behind the car
  (`SWING_STEPS` 0 / 0.3 / 0.55 / 0.8 / 1 of the way) and takes the first clear one; `swing` eases there at rate 5 (back
  to the side at 1.2 once the street opens) and the shot rises `SWING_PITCH` = 0.35 rad × swing over the car's roof and
  the street trees. A drag holds the swing where it is (the hold after a manual orbit); a new ride starts side-on. The
  pull-in (≥ 4 u) still applies after the swing. Before, the side-on shot on Hyde St pulled in only to 4 u, which is
  inside the houses there (lane T's review shot `C:/Users/willy/opus-qa/w5/w5-t/review/shots/r-cable-hyde-desktop.jpg`:
  wall fragments dithered across the frame).
- Test `tests/opus-bay-w6-k1-feel.test.ts` "narrow street": a synthetic street with houses 3.6 u either side of the car's
  axis → swing > 0.7 and the camera in the street behind the car, not in a house; an open street → swing < 0.05 and the
  side-on shot (red on the old code).

### Evidence

- Live, dev 5601, the Powell–Hyde from Hyde & Beach to Powell & Market (lane T's QA helpers `__opusBay.transit`),
  `C:/Users/willy/opus-qa/w6/k1/hyde.mjs`, desktop 1440 × 900 and phone 390 × 844 dpr 3: the swing reads **0.00 at the
  Hyde & Beach stop** (open: side-on as before), **0.8 → 1.0 up Hyde St**, 0.3–0.4 at the wider crossings, 1.0 again
  above Lombard — the same on both runs. Shots (read): `docs/opus-bay/qa/w6/K1/c-hyde-ride-behind-desktop.jpg` (first
  tune, SWING_PITCH 0.12: behind the car looking up Hyde St, the houses out of the frame's middle, the trees dithered in
  front) and `c-hyde-ride-behind-phone.jpg` (final, 0.35: the rider on the running board reads from above-behind, the
  street trees thinned by the dither round them).
- Checks: see the push note below.

### Decisions

- A swing toward behind the car rather than a closer pull (the 4 u minimum was already inside the houses; closer than
  that the rider fills the frame) — the street itself is the open direction on every city line.
- Trees are not blockers for the ray (only buildings, landmark colliders and blockers wider than 1 u); raising the swung
  shot was the cheap way over them.

### Known gaps

- The street trees still stand between the swung camera and the rider in places (dithered); a later pass could add the
  street trees' trunks to the ray test or prefer the swing step whose line misses a canopy.
- Not re-checked for the F-line (its window shot is not `occlude`) or the bus / LRV (their designed shot is unchanged).

### Not done

- Nothing else from my row. From the brief's list everything is done: the stick (P0 #2), the mantle, all six F items,
  both D items, the three A items.

### Requests

- None.
