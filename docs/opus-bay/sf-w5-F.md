# Wave 5 · lane F · Feel & feet

Plan `sf-w5-plan.md` §2 MF1 / MF2 / MF3, §4.4; lead note `sf-w5-lead.md`. Worktree `C:/Users/willy/wt/w5-f`, dev server 5501.

## Part a (2026-09-28)

### 给主人的摘要

1. **落地卡住（F1）根治**：现在"能不能动"每一帧都重新判断——只看有没有对话、钓鱼、坐车、菜单暂停或者正在进行的镜头/活动；东西一结束就自动放开，不会再"要对话一次才能走"。14 种落地/到达方式（飞过去、滑翔落地、公交/地铁/叮当车/电车/渡轮下车、到达卡片、全景、望远镜、和居民聊天、拍照、地图、小铺试穿、小游戏、彩蛋镜头）都有测试，每次 1 秒内能走、看门狗一次都没出手。
2. **角色能力（给其它线用）**：主角和 BAYBAY 会跳舞、躺草地、坐地上、BAYBAY 仰泳漂浮、被摸摸时开心扭一扭；能戴帽子/围巾等配件、换围巾和帽子背包颜色、换单车/小车颜色、给鹈鹕系丝带；点自己会弹出动作轮（A 线已接上），双击 BAYBAY 是摸摸。
3. **"起飞"按钮一直在**：解锁鹈鹕后，手机上走路时"起飞"始终显示（以前 BAYBAY 在旁边就会被藏起来），解锁那一刻按钮会闪一下提醒。
4. **落地朝向空地**：滑翔落地、下车后，人和镜头自动转向最开阔的方向，第一下推摇杆不会撞墙或冲海。
5. **全城自动走一遍（第一轮）**：672 个地点（景点到达点、车站、步道、金门大桥桥面、活动场地、金币、彩蛋、看风景点、明信片）逐个检查，找到 56 个可疑点，实机复查 41 个确实走不出去（其中 T1：九曲花街、苏特罗浴场；T2：39 号码头、Fort Point；地铁地面站 20 个），已按负责的线列出，下一步各线修、我修自己的部分（桥面、坡道）。
6. 进度：本部分 5 项全部推送（F2、F1、F3、F7、F4 第一轮）；下一部分做"脚下更宽容"（贴墙滑行、自动翻越、BAYBAY 拉一把）和金门大桥桥面。

### What was built

**W5-F2 · the charApi implementation** (pushed first: `b76a717`, `d7bff1f`, `0933450`) — `actors/charImpl.ts` implements the frozen
`actors/charApi.ts` over the actor system; `Actors.tsx` registers it (`setCharApi`) while the actors are mounted.

| call | what it does |
|---|---|
| `emote(who, name, { loop?, seconds? })` | `actors/anim.ts` gains **dance** (120 bpm `DANCE_BPS`: a bounce every beat, sway every two, "raise the roof" ↔ chest swing over a 4 s bar, feet stepping on the beat), **lie** (on the back: the root bone pitched ≈ 78° about the feet and lifted onto the backpack / the back), **sit** (the ground-sit weight), **float** (BAYBAY's otter float: on her back, paws on the chest, a slow bob and roll), **pet** (BAYBAY: a happy squint on the procedural body, a wiggle, paws to the chest, the tail going; the player: the petting hand). One play by default (`EMOTE_SECONDS`); `loop` holds for `seconds`, none = until the next move. The whole-body moods (`BODY_EMOTES`: dance, lie, sit, float) end as soon as that body moves and are skipped while it is carried; gestures are never cut by walking. |
| `sitGround({x, z, heading})` / `stand()` | the player sits on standable ground within `SIT_REACH` 8 u, placed there facing `heading`, until `stand()` or any move; false off ground, too far, NaN, or carried. |
| `attach(who, slot, obj)` | slot anchors (`ob-slot-<who>-<slot>`) on the bones — player: head = the bean's crown (a head item hides the bucket hat), neck = the base of the face, back = the pack; BAYBAY: head = between the ears, neck = the scarf ring, back = mid-back (procedural and GLB offsets). The object's frame: origin on the slot point, +y up, +z the way the body faces, character units. Again = replaced, null = removed; BAYBAY's items move onto her GLB body when it swaps in. |
| `tint(who, part, color)` | the player's hat (+ band) and backpack (+ straps), BAYBAY's scarf: vertex colours on the clay rigs (`actors/recolor.ts`: matched by base colour × shading factor, shading kept, `null` restores every vertex exactly; no new material or program); the textured GLB BAYBAY keys her scarf's teal in her shader (`models.ts baybayScarfUniforms`, one program as before). Other parts: no-op. |
| `vehiclePaint(kind, id)` | `vehicles/models.ts PAINTS` (append-only ids: teal, terracotta, gold = the parked bikes' liveries; maroon, orange = International Orange, fog, cream, dahlia): the **ridden** bike (its own livery back on getting off), every toy car, the pelican's new **ribbon** (a `ribbon` bone collapsed to a point until painted; +332 tris, 2,680 total ≤ 3,500). Unknown ids change nothing (DEV warning). |
| `glideSoftBox(key, box, line)` | `actors/glide.ts setGlideSoftBox`: the pelican turns back from a box like at the model's edge, steers out by the nearest side when inside, flies freely under `minY`; keyed; BAYBAY says `line` (moveSystem, at most every 8 s). |
| `self-tap` events | a tap on the player's own body emits `{ who: 'player', double }` (its own invisible capsule pick, `actors/system.ts selfPick`, reported 4 u nearer so the body wins over interactable spheres round the spot it stands on); a second tap on BAYBAY within 0.38 s emits `{ who: 'baybay', double: true }` and folds away the call menu the first tap opened (`game/Systems.tsx tapBaybay`); single taps unchanged (the first tap also says `double: false`). |

**W5-F1 · the derived lock** (`f66a14b`) — `game/playerLock.ts deriveLock()` is the one writer of `runtime.player.locked`:
`a dialogue || fishing || a ride || phase ≠ playing || a hold` (a camera sequence holds 'cinema', a 飞过去 trip 'travel'); written every
frame by `Systems.tsx` (before the watchdog), at once by every release and by flow's `refreshLock` (now just `deriveLock()`).
`dropHolds()` lets the watchdog (`game/lockWatchdog.ts`) drop forgotten holds instead of writing the lock. The frozen five
(`holdLock`, `lockHeld`, `lockReport`, `setLockRefresher`, `LockSource`) are unchanged.

**W5-F3 · 起飞 always there** (`fb20445`) — `actors/TouchControls.tsx`: once the glide is unlocked, 起飞 is on foot in its slot above 跳
whatever is in focus (BAYBAY in talk range included); the column hides only in a dialogue, a panel, a cinematic, fishing or the
postcard reward. `actors/moveApi.ts pulseGlideButton()` / `glidePulseSeq()`: a warm ring pulses twice (a glow with reduced motion,
`opus-bay.css .ob-glide-pulse`) when the glide unlocks during play (not for a save restored at load) and when lane C / A ask.
The routed wave-3 G items were already in; `tests/opus-bay-sf-hud.test.ts` now pins them (FocusMarker single pass, the move
column in `HUD_BOX_SELECTOR`, the 667 × 375 column, `twoShotPose`, the reset clearing the line memory and the save's play block
— lane E's ledger listens to `onSaveCleared` —, the BAYBAY GLB via `heroGltfLoader()`). Lane A's request: the 坐下 prompt
(`play:sit`) shows the seat icon (`ui/Hud.tsx`).

**W5-F7 · faceOpen** (hook `23c9b8d`, landings `ce39c21`) — `actors/faceOpen.ts`: `openRuns` / `openHeading(x, z, prefer)` (24 rays,
1.4 u steps to 28 u of standable ground; a ray scores its run + half of each neighbour's: a wide opening beats a slit; ties go to
`prefer`) and `faceOpen(x, z)` (turns the player standing there; `game/cinema faceCameraToward(…, { open: true })` swings the
camera behind them and outranks the camera's own arrival yaw — the teleport snap and the city settle look — for 3 s). Called at
the glide landing and at the transit hop-off's step down (`actors/moveSystem.ts`); lane N uses `openHeading` in fastTravel's
landing (its report).

**W5-F4 · the sweep tools and run 1** (`48fb99b`)
- `scripts/opus-sf/qa/sweep-static.mts` (node, deterministic, ≈ 30 s): 672 targets — 158 attraction trip ends / arrival anchors
  (N), 175 station exits (T: loop / Metro poles and kiosks, cable-car kerbs via `stationBoardSpot`, F-line stops via
  `flineLandingSpot`, ferry quays), 31 route stops and via points (L), 21 GGB deck points (F), 12 event venues (R), 180 coin-trail
  points and 38 ground caches (E, trails judged at both ends and the middle), 25 ground egg spots (D), 16 view spots (A), 16
  postcards (C) — on the city as the game streams it (the landmark sites' walk inputs), with canStand, a nav path from the walk
  graph's main component, and the real `PlayerController` pushed 1.5 s in four directions. Verdicts OFF · BOXED (≤ 1 direction
  moves ≥ 3 u) · SNAG (open ground ahead but no move) · UNREACHABLE (the nav path ends > 1.1 u short) · CORRIDOR (2 directions
  move, the other two closed by what is drawn: the deck, a pier — reported, not a failure) · ok; the plan's STUCK (< 3 of 4)
  is counted too. Output `C:/Users/willy/opus-qa/w5/sweep/static.json`, `targets.json`.
- `scripts/opus-sf/qa/walker-sweep.mjs` (headless Chrome, the real game through `__opusBay`): teleport, wait for the ground,
  W / D / S / A 1.5 s each, a shot of each stuck target; the GGB deck both ways holding W (slowest 3 s window, the camera's
  angle to the deck axis); the three routes stop to stop by tap-to-walk. Output `C:/Users/willy/opus-qa/w5/sweep/live/`
  (`live.json`, `sheet.html` = the contact sheet). Refuses to start while PERF-LOCK exists.

### Evidence

- Checks on the final rebase: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings outside
  `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1101 / 1101** (fail 0; one run
  earlier had the wall-clock "a cached cell is cheap" in `sf-move2` fail under load and pass alone).
- New / extended tests: `tests/opus-bay-w5-char.test.ts` (8: the emote list and loops, lie / float / dance / pet on the rigs,
  sitGround, attach and the GLB swap, tint round trips, paints, soft boxes, the self-tap capsule), `tests/opus-bay-w5-lock.test.ts`
  (28: every MF1 path + the grep + the derive table; the frame derives the lock and runs the watchdog like the Ticker, each path
  asserts 0 watchdog releases), `tests/opus-bay-w5-feet.test.ts` (5: faceOpen on the district anchors, the Pier 7 end, the
  request, a glide landing, the hop-off wiring), `tests/opus-bay-sf-hud.test.ts` (+3: 起飞 without the focus rule, the pulse, the
  routed G items).
- In the game (dev 5501; shots read; key ones in `docs/opus-bay/qa/w5/F/`):
  - desktop 1440 × 900: dance, lie, sit + float, pet on both heroes (`f2-dance-desktop.jpg`, `f2-lie-desktop.jpg`); BAYBAY's GLB
    scarf in International Orange, the player's pack in dahlia pink, a halo attached to both heads with the bucket hat hidden
    (`f2-scarf-tint-attach-desktop.jpg`); 飞过去 to the Palace of Fine Arts → the arrival cinematic → free at its end, 2.6 u walked
    in 1 s, 0 watchdog releases (`f1-fly-palace-walks-desktop.jpg`).
  - phone 390 × 844 dpr 3: a tap on the player in the Ferry gate's ring gives `self-tap` single then double (before the separate
    pick it opened the ferry); a double-tap on BAYBAY opens and folds the call menu and gives `double: true`, a single tap opens it
    as before; 起飞 + 跳 shown with BAYBAY the focus, the pulse ring on the unlock (`f3-glide-baybay-in-focus-phone.jpg`); a glide
    from Drumm Street lands on Pier 7 facing along the pier, camera behind (`f7-glide-landing-faces-pier-phone.jpg`).
  - 667 × 375: the move column (y 103…225) beside the HUD column (y 53…357), clear of the pill (`f3-landscape-667x375.jpg`).
- Sweep run 1 (city v1, head `ce39c21` + the scripts): static — 672 targets: ok 454 · CORRIDOR 162 · BOXED 26 · SNAG 5 ·
  UNREACHABLE 21 · OFF 4 (plan-STUCK 213, of which 162 corridors). Live (desktop) on the 56 non-ok, non-corridor targets:
  **41 stuck** in the real game (< 3 of 4 directions ≥ 3 u), 5 with no ground at the point; the GGB deck: **south → north stuck
  at the start** (0 u in 6.7 s, the camera 83° off the deck axis), **north → south stalls at the north tower** after 89 u
  (`f4-run1-deck-stall-at-north-tower.jpg`); routes: 24 legs, 3 stalled ≈ 3–10 u short of the stop (r1 Saints Peter and Paul →
  Coit, r3 de Young → Tea Garden, r3 Polo → the bison paddock).

### Sweep run 1 · triage to the owners

The numbers: static verdict (live W / D / S / A in u). Full lists: `C:/Users/willy/opus-qa/w5/sweep/static.json`,
`…/live/live.json`, `…/live/sheet.html`.

| owner | targets | what the sweep says | the ask |
|---|---|---|---|
| **N** (trip ends, `arrivalSpot`) | **T1** `lombard-crooked` BOXED, reach 2.1 (0.5 / 4.5 / 2.9 / 2.6) · **T1** `sutro-baths` SNAG, reach 1.5 (0.2 / 0.2 / 0.5 / 3.9) · **T2** `pier-39` OFF (the trip end is not standable, nothing within 3 u) · **T2** `fort-point` BOXED (0.8 / 4.5 / 1.2 / 0.0) · T3 `greenwich-steps` BOXED (0.2 / 0 / 0.1 / 0.4), `haas-lilienthal-house` BOXED (0.7 / 0 / 0 / 1.8), `ingleside-terraces-sundial`, `noe-valley-town-square` (OFF live), `bison-paddock` OFF, `octagon-house` SNAG, `hyde-street-pier` / `ss-jeremiah-obrien` UNREACHABLE | move each trip end to open, reachable ground (T1 / T2 first: no waiver allowed); re-run `sweep-static.mts --only trip-end,arrival` |
| **L** (sites, routes) | `fort-point` apron (the site behind N's trip end and route r2's stop), the bison paddock stop of r3 (inside the paddock), the Wave Organ jetty (nav cannot reach its tip: A's view spot, D's egg, E's jetty coins), the GGB walkway round the north tower (with F6) | open ground in the site records; a route stop outside the fence |
| **T** (station exits) | **20 of 26 Muni Metro surface stops** stuck live: N Judah Carl & Cole (1.4 / 0 / 0 / 0.2: the pole in a notch between two houses), Carl & Stanyan, Irving & 2nd, 9th & Irving, Judah & 9th / Funston / 19th / 25th / 34th / 43rd / 46th; M West Portal (0 / 0.1 / 6 / 1.4), St Francis Circle, 19th & Randolph, Randolph & Bright, Broad & Orizaba / Capitol, San Jose & Mt Vernon; 11 of them also end the nav path 1.7–4.5 u short · the Sausalito ferry quay is off the model (OFF) | place the poles / kiosks (the transit sidecar's `props`) on open pavement ≥ 1.5 u from walls, reachable by nav; Sausalito: never land a rider there, or a quay on the model |
| **E** (coins) | caches `crane-cove-end` (0.2 / 0 / 4.8 / 0.8), `calle-24` BOXED; trails `ina-coolbrith` 1 and 5, `lyon-street-steps` 1, `mount-davidson` 7, `municipal-pier` 1 / 4 / 7 (the pier is closed and nav cannot reach it), `wave-organ-jetty` 8; SNAG `india-basin` 6, `stop-castro` 5, `baker-beach-north` (slopes: they move 2.4–2.9 u, see F) | nudge the spots onto open steps / paths (coins-place.mts), drop the Municipal Pier trail (closed, lane A's note) |
| **D** (eggs) | `musee-laughing-lady` (1.1 / 0.6 / 6 / 1.2), `baybay-otter-roots` (Fort Point, = L / N), `ingleside-sundial-real-time`, `china-beach-fishermen` (nav 6.2 u short), `wave-organ-high-tide` (jetty) | spots on open ground beside the host |
| **A** | view spot `wave-organ` (the jetty: nav cannot reach it) | = L's jetty |
| **C** | postcards: 3 corridors only (ok) | — |
| **R** | venues: 4 corridors only (ok) | — |
| **F** (mine) | the GGB deck (stuck at the south start with the camera across the deck; stalls at the north tower), the slope SNAGs (2.4–2.9 u in 1.5 s on steep grass / steps), the three route stalls 3–4 u short (tap-to-walk giving up at a corner) | W5-F5 (slide along, auto-vault, BAYBAY pull, a gentler slope rule on paths) and W5-F6 (deck camera and deck steering) in part b; run 2 (W5-F11) after all fixes |

### Decisions

1. **playerLock internals exported**: `deriveLock()` and `dropHolds()` are exported for Systems, flow, the watchdog and tests;
   they are not part of the frozen API (documented in the file). The derive no longer calls `cinemaActive()`: a camera sequence
   holds 'cinema' while it runs, which the hold count covers.
2. **One line in lane C's `game/flow.ts`**: `refreshLock()` became `deriveLock()` (the grep test forbids any other writer). Nothing
   else in flow changed; C's callers keep calling `refreshLock`.
3. **The self-tap has its own pick mesh** reported 4 u nearer than it is: the interactable proxy spheres round the spot you stand on
   (the Ferry gate's ring) otherwise took the tap (seen on the phone). Under the finger, the player is what shows.
4. **A double-tap on BAYBAY folds away the menu the first tap opened** (only that menu, only while untouched): single taps are
   unchanged, and petting does not leave the call menu on screen.
5. **The GLB BAYBAY has no eye or mouth bones**: the pet's happy squint shows on the procedural body only; on the GLB the pet is the
   wiggle, the paws, the head tilt and the tail.
6. **Paints**: one append-only id table for bikes, the car and the ribbon; a bike paint follows the rider (parked bikes keep their
   liveries); the gold livery shares `PALETTE.gold` with the bell and the basket rim, so a painted gold bike repaints those too
   (small, left). International Orange: the name is the bridge's (goldengate.org, "Color & Art Deco Styling", CMYK 0/69/100/6, read
   2026-09-28); the toy paint is the softened tone the game's own bridge wears (`landmarks/kit.ts SF.ggb #c44a31`).
7. **faceOpen outranks the arrival yaw for 3 s** (`OPEN_HOLD_S`): the camera's own arrival choice picks a view (the bay, a landmark);
   after a landing the owner's problem is the first step, so the open ground wins, then the camera is the player's again.
8. **Sweep verdicts**: the plan's STUCK (< 3 of 4 directions) also counts every deck, pier and narrow path; the sweep keeps that count
   but triages on OFF / BOXED / SNAG / UNREACHABLE and reports CORRIDOR separately (the GGB deck's 21 points are all corridors:
   along 6 u, across 2 u to the rails). Directions are relative to the most open heading (static) and to the camera (live).
9. **BAYBAY's GLB swap keeps her mood**: a loop she is in (a dance, the float) goes on on the new body with the seconds left.

### Known gaps

- The live sweep ran on the desktop profile only (the phone profile's controller is the same code; a phone run comes with run 2).
- The walker's trips phase (Ferry Building → every T1 / T2 by walk mode within 1.3 × the quote) is not built yet (part b, W5-F11).

### Not done (this part)

W5-F5 forgiving feet, W5-F6 the GGB deck, W5-F8 levers, W5-F9 overlay layout (the phone pill now wraps to three lines with E's
badge; C's goals card covers the pill's second line on the phone right after the welcome), W5-F10, W5-F11 (run 2 → 0 stuck).

### Requests

- **N**: the trip ends in the triage table (T1 Lombard, Sutro Baths; T2 PIER 39, Fort Point first); `faceOpen(x, z)` after the resume
  places the player (fastTravel already uses `openHeading`).
- **L**: Fort Point's apron, the r3 bison stop, the Wave Organ jetty's reachability, the GGB walkway round the north tower (I take the
  steering side in W5-F6).
- **T**: the Metro surface stops' poles / kiosks on open, reachable pavement (20 stops listed); the Sausalito quay.
- **E**: the coin spots listed (and the closed Municipal Pier trail).
- **D**: the five egg spots listed.
- **A**: `pulseGlideButton()` (actors/moveApi) is there for the first flight's intro (your request 3); `emote('baybay', 'pose')`
  turning her to the camera in photo mode (your request 2) comes with part b.
- **C**: FYI the one-line `refreshLock` change in `game/flow.ts` (decision 2).
- **Lead**: accept `deriveLock` / `dropHolds` as playerLock internals (decision 1). Seen in passing and already fixed upstream by the
  time of this report: the `ob-flags` shader compile error (`float col` shadowing the colour, W5-V4) — flags are fine again at head.

## Part b (2026-09-28): W5-F5, W5-F6, W5-F8, W5-F9

### 给主人的摘要

1. **脚下更宽容（F5）**：贴着栏杆、码头边、窄路走时会顺着滑过去，不再"一顶就停"；跑着（或跳着）撞上矮墙、矮树篱会自动撑手翻过去（只翻有实测高度的矮东西，绝不翻到屋顶、悬崖、水里、桥栏外，海滩篝火也不翻）；真被看不见的缝卡住，推 1.2 秒 BAYBAY 会跑来喊"嘿咻！"把你拉出来（绝不隔着水或墙拉）；按 R 也能马上脱困。
2. **金门大桥桥面（F6）**：上桥后镜头自动转到身后、顺着桥走；一直按"前"就能从南走到北、再走回来，遇到桥塔的柱子会自己绕到中间车道，速度一直 ≥ 3 u/s、镜头偏差 ≤ 1°（电脑和手机都实测过）。
3. **帮手机减负（F8）**：主角和 BAYBAY 的影子改用简化模型（影子三角形从约 1.7 万降到约 1,500，画面一样，不多一次绘制）；在城里离镜头 250 u 以外的停放单车/小车不画。
4. **手机界面不重叠（F9）**：390×844 和 375×667 上逐个状态检查（自由逛、提示条、到达卡、带路中、叮当车、目标页、更多菜单、小游戏成绩卡），修掉了 4 处遮挡；城里右上角的明信片药丸现在直接打开旅行本（有"今天"就开"今天"，否则开"目标"），金币显示在第二行，药丸保持两行。
5. 顺手完成其它线的请求：拍照时 BAYBAY 摆姿势会整个身子转向镜头（A）；镜头朝向接口可以指定俯仰角（R，拍舰队周飞机用）。
6. 进度：本部分 4 项全部推送；下一步是全城巡检第 2 轮（F11）和 C 线要的"鹈鹕落在身边"小动画。

### What was built

**W5-F5 · forgiving feet** (`6232123`; walk speed, jump and stair rules unchanged) — `actors/feet.ts` (pure queries over core/terrain), `actors/stuckHelper.ts`, `actors/controller.ts`, `actors/guide.ts`, `actors/anim.ts`, `actors/system.ts`.

| move | rule in the code | guards |
|---|---|---|
| slide along | `corridorAt(x, z, n)`: a wall contact whose other edge is within `FEET.corridor` 6 u (a deck, a pier, a narrow path, a stair landing), or a registered bridge deck. There a wish within `FEET.steerCone` 35° of the wall runs along it at full speed; a steeper one slides at `cos φ` down to `FEET.corridorSlideMin` 0.12 before it stops and leans. The contact probe now also runs while sliding, so the glide along a rail does not stutter. | open ground keeps `SLIDE_MIN` 0.35 (a 75° push into a sidewalk wall still leans) |
| auto-vault | `vaultPlan(x, z, feet, dir)`: running (≥ 5 u/s, or the run key held and ≥ 2.5 u/s) or in a jump, head-on (≤ 45°) into blockers that **all** have a measured `top` ≤ feet + 1.1 u, with standable ground ≤ 1.6 u beyond the far side → a 0.35 s hop (the controller's `vault` state: an eased line with a parabola that clears the top by 0.3 u, hands forward via the new `Motion.vault` weight, the jump / land sounds, the run carries on). | an unknown top is a wall; never when the ground beyond is more than 0.75 u lower or more than 0.6 u higher (so never onto a roof or a terrace); never over water or off the model; never with a cliff (ground 2 u lower) within 1.2 u of the landing; never in a `noVault` area (`registerNoVault(key, polys)`; bridge decks always; the Ocean Beach fire rings, registered from `actors/cityViews.ts`: they burn in season, plan D22) |
| BAYBAY pull | `StuckHelper`: a manual push for `FEET.pullPush` 1.2 s with < 0.3 u of progress → `pullTarget` (the nearest standable spot ≥ 0.9 u along the push, within 45° of it and 4 u of the player) → BAYBAY dashes over (`GuideMover.dash`: a straight run at her running pace, or a hop-in from the camera side when she is far or out of view), 嘿咻！/ Heave-ho! (`flow.bubble`), a 0.45 s hop to the spot (the controller waits, `Motion.vault` on the player, `reach` then `hop` on BAYBAY). Every pull emits `stuck { what: 'pull', x, z, source: 'push' \| 'reset' }`, a DEV console line, and a record in `__opusBay.actors.feet.pulls`. | the line to the target crosses no blocker (a 0.08 u probe: no building, wall or fence), no water, nothing off the model, no ridge more than 1 u above the feet or a drop past 1.6 u; the target at most 0.8 u higher / 1.2 u lower; not while leaning on a parked car or a resident; at most 3 pulls within 30 s at one spot; 1.5 s rest after one |
| R | R with the feet boxed in (`probeReach` < 0.9 u of 1 u toward the push, or with no push toward the most open ground) pulls at once; the day-0 watchdog already frees a stale lock on R. | free on open ground, R stays the camera reset |

**W5-F6 · the Golden Gate Bridge deck** (`6232123`, `a26d35f`, `abc0d96`) — `actors/deckSteer.ts` (a deck registry: `registerDeck`, `deckAt(x, z, y?)` with station and lateral offset, `deckWish`, `deckCameraYaw`, `heroRelaxed`). `actors/cityViews.ts` registers the bridge (`ggbDeck()`: END_S → END_N, the rails' inner faces 2.62 u off the axis, y = `GGB.DECK`) when the city camera data loads, so the landmark library stays out of the main graph.
- Steering (controller, manual input only): a wish within 60° of the axis runs along it (a third of the across input kept, never outward past the rail clearance); when the lane ahead is blocked within 3.2 u (the tower legs stand across the sidewalks), it steers to the nearest clear lane (0.35 u steps). A wish mostly across the deck is left alone (to go and look over the rail).
- Camera (`actors/camera.ts`): on the deck the follow camera turns behind the player along the axis (rate 3 while more than 25° off, 2.2 after); the alignment is chosen behind the heading when the player comes onto the deck, after a jump of more than 1.2 u (a teleport, a landing) and on R, and then holds (walking back toward the camera never flips it) until the player turns the camera; the towers' hero points are relaxed on the deck and the occlusion swing waits there. `chooseYaw` on the deck gives the axis alignment.
- `game/cinema.ts faceCameraToward(x, z, { pitch })` (lane R's request 3): the photo orbit's pitch (clamped to its range) or the follow camera's pitch through its offset.
- `scripts/opus-sf/qa/walker-sweep.mjs --deck` presses R after the teleport, shoots the half-way view, reads the pull count.

**W5-F8 · the levers** (`877dc59`)
- `actors/models.ts withShadowProxy(mesh, proxy)`: a character's low-poly shadow proxy lives in its own geometry after the drawn triangles (the same vertex layout and skeleton); `onBeforeRender` sets the draw range to the body, `onBeforeShadow` (chained after BAYBAY's existing one) to the proxy — no extra draw call, material or program, and the shadow keeps the arms, hat, pack, tail and feet because the proxy rides the same bones. The player (hand-made proxy: bean, hat, pack + bedroll, arms and the map, feet) **8,784 → 556** shadow triangles; the procedural BAYBAY **10,404 → 780**; the GLB BAYBAY **8,326 → 960** (`fitShadowProxy`: a 10 × 7 ellipsoid per bone over the vertices it weighs most; slivers such as the eyes add nothing). Measured in the game at the Ferry gate (`geometry.userData.shadowProxy`): the drawn ranges unchanged, ≈ −15.6k triangles in the sun's shadow pass.
- `actors/system.ts`: in city mode a parked bike or the toy car more than `FAR_RIDE` 250 u from the camera is not drawn (the one ridden or called always is; district mode unchanged). In the game: 5 of 7 rides drawn at the Ferry gate, 1 of 8 (the pooled city bike beside the player) after a teleport to the west side.

**W5-F9 · the overlay layout at 390 × 844 and 375 × 667** (`98a9d32`, `042bafb`)
- `ui/Hud.tsx` + `ui/objectivePill.ts` (plan MF6; lanes C and R asked): in the city the top-right pill opens the journal on lane R's 今天 once registered (it is now, order 5), else on 目标; it no longer toggles a hidden goals card. The district keeps its goals card.
- Phones: lane E's pill badges ride on the goals line (目标 0/10 · 🪙 42): the pill keeps two lines (it wrapped to three).
- Phones: lane N's go chip (BAYBAY 带路中 · 碰摇杆接管) sits in the band left of the move column (it covered 跳 by 43 px), its second half ellipsed when it does not fit.
- Phones: while lane N's discovery chip (+3 个地点) shows under the area pill, the top stack starts under it (a toast covered its right half); while lane A's activity chip shows, the stack starts under it (185 px); while A's result card shows, it starts under the card on every screen (281 px; under the ride banner the card already sits below the stack and the toasts wait hidden) — lane A's request 3.
- Lane A's request 2 (`39dab6e`): posing in photo mode, BAYBAY turns her whole body to the camera.

### Evidence

- Checks on the last push `abc0d96` (rebased on `7319d9e`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1191 / 1191**, fail 0. Earlier today, between 06:00 and 07:00 PDT, two lane-L tests (the fire-ring tops and the flags table) failed on the real clock (the rings are lit from 06:00): with `Date` pinned to 04:00 PDT the suite was green, and lane L fixed the tests in `e889335`.
- New tests: `tests/opus-bay-w5-feet.test.ts` +11 (synthetic worlds: slide along at 30° keeps full speed in a corridor and 75° still slides there but leans on open ground; the vault over a low wall running or jumping, none walking, none over an unknown or 1.3 u top; the guards: a drop, a roof, a terrace, water, a cliff, a noVault area, a deck; the pull out of a 0.7 u lip with the `stuck` event, never across water or a wall; R out of a pit, nothing on flat ground; the fire rings are noVault. The published city: the deck's lanes, the legs and the rails; the walk south → north holding forward from a camera 83° across, and back north → south running, **never under 3 u/s over any 3 s, camera within 25°**; `chooseYaw` / the relaxed tower hero points; the photo pitch) · `tests/opus-bay-w5-char.test.ts` +4 (the proxies' draw ranges, bones and colours; `fitShadowProxy` with normalized 8-bit weights; the far-ride rule; BAYBAY's pose) · `tests/opus-bay-sf-hud.test.ts` +2 (the pill → journal; the phone pill, the go chip, the stack rules).
- Without the deck steering (a temporary switch, reverted) the north → south walk stalled at s 89 of 422 — the test catches the run-1 failure.
- In the game (dev 5501, headless Chrome with the RTX flag; every shot read; key ones in `docs/opus-bay/qa/w5/F/`):
  - **The GGB deck, live walker** (`walker-sweep.mjs --deck`): desktop 1440 × 900 south → north reached, slowest 3 s **3.47 u/s**, camera ≤ **0°** off the axis; north → south **3.97 u/s**, ≤ 1°. Phone 390 × 844 dpr 3: **4.16 / 0°** and **4.16 / 1°**. Run 1 was stuck at the south start (0 u in 6.7 s, the camera 83° across) and stalled at the north tower. `f6-deck-mid-camera-behind-desktop.jpg`, `f6-deck-mid-camera-behind-phone.jpg`.
  - **The pull**: the Sutro Baths trip end (a run-1 SNAG: a hole in the walk surface on the slope up to the path) — R there pulled 0.9 u (`reset`), holding forward later got stuck at a surface seam and BAYBAY pulled 3.6 u (`push`): the bubble, her dash, the hop (`f5-baybay-pull-sutro-desktop.jpg`); 0 watchdog releases.
  - **The vault**: running into a 0.6 u hedge on Franklin Street by City Hall → one vault, landed on the lawn beyond (`f5-vault-hedge-civic-center-desktop.jpg`, the camera over a roof, dithered). A node scan of the whole city (every landmark site, 1.5 u grid, 8 headings) found 37 vault spots at 13 landmarks (hedges, planters and low walls at City Hall, the de Young, the Palace, Lombard, the Dutch windmill, the Legion of Honor, Sutro Baths …) before the fire rings became noVault.
  - **The stuck targets**: the static sweep on today's head — 673 targets: ok 483 · CORRIDOR 153 · BOXED 14 · SNAG 2 · UNREACHABLE 19 · OFF 2 (run 1: 454 / 162 / 26 / 5 / 21 / 4). None of the 39 left is lane F's (the deck points are corridors; the slope SNAGs are gone): N 3, T 19, L 1, E 12, D 1, A 1 (Requests). A node run of push + pull on the BOXED / SNAG ones: 12 stuck directions at 10 targets get out with BAYBAY's pull.
  - **Shadows**: `f8-shadow-proxies-desktop.jpg` (golden hour at the Ferry gate: both heroes' long shadows read as the bean with its hat and the otter).
  - **F9 overlap scans** (every fixed HUD box, the bubble, the waypoint, the overlays; pairs that overlap, containers excluded), 390 × 844 and 375 × 667 in en and zh, and 1440 × 900: free roam + bubble + two toasts · the arrival toast + card · a walking trip (pill, go chip, waypoint, discovery chip, toast, bubble) · a cable-car ride banner · lane C's goals step · the 更多 menu · lane A's chip and result card with toasts → **no overlaps left** except lane C's goals step, a modal card over the dimmed HUD (it scrolls at 375 × 667). `f9-trip-go-chip-phone-390.jpg`, `f9-busy-hud-phone-375-zh.jpg`, `f9-pill-opens-journal-phone-375-zh.jpg` (the pill tap → 旅行本 on lane R's 今天 0/3, whose first row is the next goal; before R's tab reached my tree the same tap opened 目标), `f9-play-result-toasts-phone-390-zh.jpg`.
  - BAYBAY posing in photo mode faces the camera: `f2-baybay-pose-photo-desktop.jpg`.
- No real-world fact is new in this part (the fire-ring season is lane L / R's, already sourced).

### Decisions

1. **Corridors are found from the ground, not the walk graph**: a ray from the wall contact across the walk (≤ 12 raster reads, only while touching a wall) finds the other edge; the walk graph has no hero decks or piers and is loaded late.
2. **The vault needs every blocker in front to have a measured top** (`Blocker.top`: landmark walk blockers from `landmarks/tops.ts`, the city's buildings); the hero district's props and benches have none, so they stay walls. The landing must be standable ground within 0.6 u above and 0.75 u below the feet: a roof or a terrace is never a landing.
3. **The Ocean Beach fire rings are noVault** (they burn in season; plan D22's safety tone), registered with the city camera data.
4. **The pull never crosses any blocker**, not only buildings: a fence or a wall with ground behind stays a wall (the vault is the way over low ones). It also refuses a climb of more than 0.8 u, so repeated pulls cannot scale a slope.
5. **The deck camera's alignment is sticky**: behind the heading on entering, after a teleport / landing and on R; otherwise it holds, so walking back toward the camera does not swing it round (the lazy re-centre's own rule); a player who turns the camera keeps the alignment nearest their view.
6. **Shadow proxies inside the same draw** (draw-range switching in `onBeforeRender` / `onBeforeShadow`): a separate shadow-only mesh would cost a draw call and a program in the main pass (three.js tests the main camera's layers in the shadow pass).
7. **The pill opens the journal only in the city**; the district's goals card toggle is unchanged (district mode must not change).
8. **Toasts give way to lane A's card and chip** by moving the top stack down while they show (not by hiding them), except under the ride banner, where the card sits below the stack and the toasts wait hidden.

### Known gaps

- The live vault shot is over a hedge seen through a dithered roof (the best of the spots tried; at the Palace the arrival cinematic took the run, at the windmill garden the approach was not head-on).
- Lane C's goals step at 375 × 667 is taller than the screen: it scrolls, its last line starts below the fold (C's `goals-step.css`, `place-items: center` in an overflowing wrap).
- The waypoint does not avoid lane A's result card and chip (they are not in `game/hudLayout.ts HUD_BOX_SELECTOR`, lane N's file): its label can sit faintly behind the card (Requests).
- The deck rule knows one deck (the Golden Gate Bridge); other long decks (piers) get the corridor slide only.

### Not done (this part)

- W5-F10 (should: mantle, the bus / LRV ride camera, the auto-glide with N) and W5-F11 (sweep run 2 on the phone profile, the walker's trips phase Ferry → every T1 / T2 within 1.3 × the quote).
- Lane C's `pelicanGreet(x, z)` (the pelican landing beside the player for the unlock moment): next part.
- Lane A's optional request 1 (`holdGuide` in the brain) is lane C's file (`game/brain.ts`).

### Requests

- **N**: add `'.ob-play-result', '.ob-play-flight'` (lane A's card and chip) to `game/hudLayout.ts HUD_BOX_SELECTOR`, so the waypoint and the bubble keep out of them. Still stuck on today's head: `trip:fort-point` (BOXED), `trip:bison-paddock` (OFF), `trip:ss-jeremiah-obrien` (UNREACHABLE).
- **T**: the Muni Metro surface stops are unchanged since run 1: 19 of them (N Judah: Carl & Stanyan, Irving & 2nd / 6th, 9th & Irving, Judah & 9th / Funston / 19th / 25th / 34th / 43rd / 46th; M: West Portal, St Francis Circle, 19th & Randolph, Randolph & Arch, Randolph & Bright, Broad & Orizaba, San Jose & Mt Vernon) and the Sausalito quay (OFF). List: `C:/Users/willy/opus-qa/w5/w5-f/static-c/static.json`.
- **E**: 12 coin spots still stuck: `lyon-street-steps:1`, `ina-coolbrith:5`, `crane-cove-end`, `calle-24`, `stop-castro:5`, `baker-beach-north`, the closed Municipal Pier trail (1 / 4 / 7 and its end cache), `wave-organ-jetty:4` and `:8`.
- **L**: route r2's Fort Point stop (BOXED) and the Wave Organ jetty's reachability (lanes A, D, E's spots there); lane F's vault scan found low hedges and walls at City Hall, the de Young, the Palace, Lombard, the windmill, the Legion of Honor and Sutro Baths — tell me any that must not be vaulted and I register them as noVault.
- **C**: `ui/goals-step.css`: `align-items: safe center` (or `start` when taller than the screen) so the step never opens with its end below the fold at 375 × 667.
- **Lead / V**: `actors/feet.ts`, `actors/stuckHelper.ts` and `actors/deckSteer.ts` are in GameRoot's main graph (the controller and the actor system use them): 1.3 + 1.4 + 0.9 KB gzip standalone (esbuild --minify), plus the additions to the controller, camera, models and actor system — please count them in the next bundle measurement. The deck and the fire-ring noVault ride on the lazy `actors/cityViews.ts`.

## Part c (2026-09-28): the checkpoint's CP-12, lane C's pelicanGreet, W5-F10, W5-F11

### 给主人的摘要

1. 检查点给 F 线的问题修好了：坐观光巴士到双峰下车，现在人面朝马路而不是悬崖，按"前"就能走（以前只挪了 0.14 u）；手机上 6 秒的到达卡片不再挡住左手拇指——手指按在卡片上一拖就能走路，轻点按钮照样能用。
2. 解锁飞行那一刻，大鹈鹕会从天上飞下来，落在你和 BAYBAY 身后、收好翅膀等你；选"试试起飞"它就带你飞，选"以后再说"它自己飞走（C 线已接进解锁那一刻）。
3. 新的手感：跳起来碰到比你高的台阶（0.45–1.6 u）会用手扒住边缘翻上去；坐观光巴士和地铁时，镜头在车后上方，你和 BAYBAY 在画面下方，城市在前面展开；新增"自动飞"：告诉鹈鹕去哪（60–900 u），它自己飞过去降落，推一下摇杆就换你来飞（N 线的"看风景飞过去"已经用上）。
4. 全城巡检第 2 轮：684 个点，卡住的从第 1 轮 56 个、上次 39 个降到 2 个（模型外的索萨利托码头归 T 线；点按走到 SS Jeremiah O'Brien 会差 4.8 u，归 N 线）；坐巴士或地铁下车会把你放在旁边开阔的人行道上，也不会面朝还停在站上的车；金门大桥来回、三条步行路线在电脑和手机上都走通。
5. 巡检顺带抓到一个真问题：BAYBAY 带路时会被停在墙边的共享单车卡死（渡轮大厦门口），现在带路和点按走路会从停着的车旁穿过去。
6. 从渡轮大厦步行到一级、二级景点的计时结果见下文 Evidence。

### What was built

**Checkpoint CP-12** (`d56438d3`, pushed first with the hook)
- `actors/moveSystem.ts`: when the flow ends a line ride at its stop (game/transit `leaveLineRide`: the loop bus's lap at
  Twin Peaks, an arrival, 直接到站), the move system now faces the rider to the open ground like a hop-off (city mode).
  Before, only the rider's own hop-off (`transit-alighted`) did: the lap left the rider facing the drop at Twin Peaks.
- `actors/pointer.ts THUMB_PASS` + `opus-bay.css`: on touch screens lane N's arrival card (6 s, bottom left, css y ≈ 599–710
  at 390 × 844) shares its touches with the stick: its body passes touches to the canvas, and a drag that starts on one of its
  buttons (看介绍 · 拍照 · 下一站 · ×) steers (window-level capture listeners feed the same stick code; the click that
  would end the drag is swallowed; a tap stays the button's). While the stick steers the card steps back to 30 % opacity
  (`actors/TouchControls` sets `.is-sticking` on the overlay).

**Lane C's request: `pelicanGreet`** (`1c27890b`)
- `actors/moveApi.pelicanGreet(x?, z?, { seconds? })` → `MoveSystem.pelicanGreet` → `Pelican.startGreet`: the ride pelican
  glides in from ahead of the camera (`greetFrom`: a steeper drop when a roof or a hill stands in that line), settles behind
  the player and BAYBAY as the camera sees them (`greetSpot`: the middle of the pair, 3.2–3.8 u across their line away from
  the camera; else beside the player, away from BAYBAY; open ground for its body at the feet's level, ≥ 2.4 u from both),
  faces them with its wings folded (the wing and hand bones swept back), waits while a dialogue is open (the moment's
  先试试起飞？, ≤ 14 s), then takes off and is gone. 起飞 while it waits hands the bird to the glide; a fast travel or a
  restart flies it off from where it sits. No new draw call, material or program (the ride pelican's own mesh).

**W5-F10 (should)** (`755f55ab`)
- **Mantle** (`actors/controller.ts startMantle / stepMantle`, `feet.ts FEET.mantle*`): a hop that meets a ledge standing
  above the body, 0.45–1.6 u over the take-off feet, climbs it hands first in 0.23–0.42 s (up the face, then onto the
  ledge; the vault's hands-first weight drives the arms). A hop that clears the edge lands on top as before. In the city a
  ledge higher than 1.6 u is a wall even in a jump: before, any jump popped the body onto any height (a 2 u step in a test
  world). A roof is never ground (buildings are blockers), so the mantle never lands on one.
- **The designed ride shot** (`actors/cameraModes.ts RIDE_TOUR`; `camera.ts` passes the platform's kind): the
  sightseeing bus's open deck (14 u back, pitch 0.38, a 0.35 rad turn toward the view side, looking 6 u ahead) and the
  Metro's LRV (15 u, 0.46, nearly straight behind, 6 u ahead) — the riders small in the lower third, the city opening in
  front. The side-on window shot (cable cars, the F-line, the ferry) is unchanged; the stop look-at bias still applies.
- **The scenic auto-glide** (`actors/glide.ts AUTO_GLIDE, autoGlideInput`; `MoveSystem.startAutoGlide / cancelAutoGlide`;
  `moveApi.autoGlide(to, { onEnd }) / autoGliding() / cancelAutoGlide()`): for 60–900 u the pelican takes off toward
  the destination, holds 14 u over the soft floor (roofs + 6), boosts on a straight stretch farther than 180 u, eases
  down from 110 u and starts its landing 20 u out (the landing curve's own lead carries it to the spot; the landing faces
  open ground). A stick push past 0.25 hands the wings over (`onEnd('taken')`, BAYBAY: 好，你来飞！); G / 降落 lands early;
  a fast travel or a restart ends it (`'cancelled'`); `'landed'` when it set the player down. BAYBAY says
  坐稳啦～想自己飞，动一下就接管 2.8 s after the take-off line. Lane N's 看风景飞过去 rides it (`dd19cf15`, W5-N9).

**W5-F11 · sweep run 2** (`f8ddb7fc`, `9882ac38`, `5989563a`)
- `actors/faceOpen.ts openSpot / openAround` (+ `OPEN_SPOT`): the nearest spot within 6 u with walkable ground (standable,
  no uphill step steeper than 0.85) ≥ 3 u in 3 of 4 directions on the sweep's own axes; `faceOpen` / `openHeading` take an
  optional blocker.
- `actors/moveSystem.ts`: a loop-bus or Metro ride the flow ends at its stop sets the rider down on open ground near it (`openSpot`; only those two
  kinds: a cable car's kerb spot lies between the tracks and the houses), and `faceOpen` counts the bus or train still at
  the stop as a wall (`vehicleBlock`: its deck widened by 1.4 u each side).
- `scripts/opus-sf/qa/sweep-static.mts` judges a loop / Metro stop where the game now sets a rider down (`setDown`,
  `sx / sz` in targets.json); `walker-sweep.mjs` replays that spot, answers a dialogue met on a route (the pelican's
  moment at Coit stalled r1), and gains the **trips phase** (`--trips t1|t12 --budget <min>`: the Ferry Building → every
  T1 / T2 attraction on foot with lane N's planner's walk option, started as the map's 跟 BAYBAY 去 so BAYBAY carries the
  player; pass = arrived within 1.3 × the planner's quote; gives up at max(1.6 × quote, quote + 40 s) or 30 s without
  progress, with a shot).
- `actors/system.ts` (found by the trips phase): a parked bike or the toy car stays a soft obstacle for the walker, but
  not while the player auto-walks (a tap-to-walk, BAYBAY carrying a trip): the path does not know them, and the first
  trip (Ferry gate → the marketplace) wedged for good between the pooled city bike parked by the Ferry Building's wall and
  the wall (Can't get through this way); now 7.2 s against a 9.6 s quote.

### Evidence

- Checks on the last push `5989563a` (rebased on `a6fcb6f4`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .`
  0 errors (43 old warnings outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
  **1341 / 1341**, fail 0. The pushes before it ran full suites of 1199, 1223, 1252 and 1292, all green; two other full
  runs had one wall-clock assert each fail under the ten-lane load (lane T's 直接到站 veil R5 — lane T since gave it 2.5 s,
  `01d8e2d6` — and sf-move2's "E2-5 … cached per 16 u cell"); each passed alone and the next full run was green. After
  the rebases that only brought lane D's egg batch and lane T's re-stood poles, tsc and the touched test files (eggs,
  eggs-c, transit, w5-transit, feet, char, contracts, district, audio, transit-review) ran green before the push; the full
  suite ran again for the last push.
- New tests: `tests/opus-bay-w5-feet.test.ts` +8 (the mantle in synthetic worlds: 1.45 / 1.55 u climbed hands first,
  0.8 u landed on, 2 u a wall in the city, a roof never; the ride shot's framing at 390 × 844 and 1440 × 900 and the cable
  car's side-on shot kept; the auto-glide stick; a full auto-glide in the move system — refused locked / too near / too
  far, takes off, lands near the target on standable ground, a stick push hands it over; openSpot on a boarding island;
  the CP-12 / set-down / parked-ride source checks) · `tests/opus-bay-w5-char.test.ts` +2 (greetSpot / greetFrom; the
  greeting's life: in, folded, held, max, gone, a take-off, a fly-off).
- npx, tsx, tsc and eslint worked from the junctioned node_modules. PERF-LOCK: lane V's gate held it 13:34–14:30 PDT —
  no Chrome and no suite of mine ran then; one Chrome of mine at a time otherwise. Dev server 5501 stopped at the end.

**In the game** (dev 5501, headless Chrome with the RTX flag; every shot read; the key ones in `docs/opus-bay/qa/w5/F/`)
- CP-12 Twin Peaks: `boardLine('loop-castro', { to: 'loop-twin-peaks' })` on desktop — before the fix the rider stood at
  (150.8, 977.8) facing 2.52 rad with the camera over the view, W moved **1.06 u**; after: heading 0.79 (up the road), the
  camera swinging behind, W moved **5.91 u** (`cp12-twin-peaks-alight-walk-desktop.jpg`).
- CP-12 thumb zone, phone 390 × 844 dpr 3, zh: 飞过去 the Palace of Fine Arts, the arrival card at y 599–710; a stick drag
  from (110, 665) — on its 看介绍 button — moved the player (2.6 u in 1.6 s against the lagoon's edge; before: 0), the
  card faded while steering, and a tap on 看介绍 right after still opened the Palace's card (panel `poi`)
  (`cp12-arrival-card-stick-phone.jpg`).
- pelicanGreet at the Coit unlock moment (called on the moment's dialogue, as lane C now does): desktop and phone — it lands
  3.3 u away behind the pair, wings folded, waits through the dialogue, and after 以后再说 flies off and is hidden
  (`pelican-greet-coit-desktop.jpg`, `pelican-greet-coit-phone.jpg`).
- Auto-glide Ferry gate → Lombard (367 u): desktop 23.4 s, cruising at y ≈ 44 over the Financial District at 20 u/s,
  landed 10 u from the target on Russian Hill, W walked 4.2 u at once; a push of A 4 s into a second flight ended it
  `'taken'` with the player still gliding; phone: the same flight landed in 17.7 s (`f10-auto-glide-cruise-desktop.jpg`,
  `f10-auto-glide-phone.jpg`: 坐稳啦～想自己飞，动一下就接管 in the bubble).
- Ride shots: the loop bus Castro → Twin Peaks and the N Judah Judah & 12th → 19th on desktop, the loop bus on the phone
  (`f10-bus-ride-camera-desktop.jpg`, `f10-bus-ride-camera-phone.jpg`, `f10-lrv-ride-camera-desktop.jpg`). A first LRV
  try with a 0.55 rad turn put the rig over the houses and it pulled in to a wall at the 9th & Irving corner; nearly
  straight behind keeps the street open.
- Metro set-down: the N to Judah & 19th (the pole was BOXED in run 2): set down on the corner, first facing the train
  still at the stop (W 1.35 u); with the train counted as a wall the rider faces down 19th Ave and W walks **6.35 u**
  (`f11-metro-setdown-walk-desktop.jpg`).
- Mantle: a scan of every landmark site found only two terrain ledges of 0.9 u next to a walk (Twin Peaks, Alamo
  Square), which a hop clears (a normal landing); the mantle is proven in synthetic worlds (tests), not seen live.

**Sweep run 2** (`C:/Users/willy/opus-qa/w5/sweep/run2`, `run2b`, `run2c`, `run2d`: static.json, targets.json,
live-*/live.json and sheet.html)

| | run 1 (part a) | part b | run 2 (head at 12:40) | run 2b (+ the set-down) | run 2c / 2d (+ lane T's re-stood poles, lane D's batch 2) |
|---|---|---|---|---|---|
| static targets | 672 | 673 | 675 | 675 | 675 / **684** |
| ok · CORRIDOR | 454 · 162 | 483 · 153 | 496 · 159 | 523 · 146 | 538 · 135 / **547 · 135** |
| BOXED · SNAG · UNREACHABLE · OFF | 26 · 5 · 21 · 4 | 14 · 2 · 19 · 2 | 7 · 0 · 12 · 1 | 0 · 0 · 5 · 1 | **0 · 0 · 1 · 1** |
| live desktop: stuck of the flagged | 41 / 56 | 31 / 37 (checkpoint) | 19 / 20 | 2 / 6 | **1 / 2** |
| live phone: stuck of the flagged | — | — | 17 / 20 | 2 / 6 | **1 / 2** |

- Every lane's fixes since part b landed: E's coins and caches, D's eggs (all 35 of both batches), L's route stops and the
  Wave Organ, A's view spot, N's trip ends (Fort Point, the bison paddock), T's 26 re-stood Muni poles and kiosks (CP-3) —
  all pass. **Left: 2, both lane T's or N's to decide**: `ferry:sausalito` (OFF: the quay is off the model — a waiver or
  a quay on it) and N's `trip:ss-jeremiah-obrien` (T3, UNREACHABLE: it moves 3 of 4 ways and passes the live walker on
  desktop and phone, but the nav path ends 4.8 u short, so a tap-to-walk stops short of it). Before T's poles moved, run 2b had
  `muni-irving-2nd` stuck live (no open ground within 6 u) — gone in run 2c. The plan's STUCK also counts the 135
  CORRIDORs (decks, piers, stairs, narrow paths; the deck's 21 points are all corridors); as in part a they are reported,
  not failures.
- The set-down (`setDown` in static.json): on run 2c's poles 32 of 71 loop / Metro stops move the rider 0.75–3 u to open
  ground (on run 2b's poles 45 of 71, up to 5.25 u).
- The GGB deck, holding W (walker `--deck`): run 2 desktop south → north 4.12 u/s slowest 3 s, camera ≤ 0°; north →
  south 3.52, ≤ 1°; phone 4.15 / 0° and 4.02 / 1°; run 2c desktop 4.06 / 0° and 4.16 / 1°; both ends reached both ways
  (95 s each).
- The three routes stop to stop (tap-to-walk): run 2 phone **24 / 24** legs; run 2 desktop 23 / 24 (r1 Peter & Paul →
  Coit: the walker did not yet answer the pelican's moment there); run 2c desktop 23 / 24: r2 Welcome Center → overlook
  stalled once on Lincoln Blvd behind the loop bus standing at its stop (BAYBAY: The tour bus is waiting for us. Let's
  step to the side; the toast Can't get through this way), a leg that passed in run 2 on desktop and phone (Requests: T).
  r3 de Young → Tea Garden passes (lane L moved the stop off the pond, CP-8).

**Trips phase** (`walker-sweep.mjs --trips t12 --budget 60`, desktop, BAYBAY carrying every trip from the Ferry gate;
`C:/Users/willy/opus-qa/w5/sweep/run2c/trips/live.json`) — 41 trips in the hour, **0 BAYBAY pulls**, mean 0.95 × the
quote, the longest 237.6 s:

| | trips | within 1.3 × the quote | ratio (min · mean · max) |
|---|---|---|---|
| T1 (all 16) | 16 | **16** | 0.78 · 0.93 · 1.30 (Coit: 79.7 s / 61.4 s, the pelican's moment on arrival) |
| T2 (nearest 25 of 48) | 25 | **24** | 0.70 · 0.96 · 1.34 |

- The one over: the Powell & Market turntable (T2) 63 s against a 47 s quote (1.34 ×), arriving 9.8 u short with a cable
  car on the turntable's track in the way (Requests: N — the quote round the turntable's queue).
- Every T1: the marketplace 7.5 / 9.6 s, Chinatown 30.5 / 38.9, Coit 79.7 / 61.4, Union Square 38.4 / 44.6, Alcatraz (its
  view on the waterfront) 47.5 / 61.1, Lombard 56 / 66.9, Fisherman's Wharf 64.9 / 74.4, City Hall 64.3 / 69.8, the
  Painted Ladies 92.7 / 100.7, the Palace 130.4 / 124.2, Twin Peaks 147.3 / 153.6, the Golden Gate Bridge 158.4 / 170.2,
  Golden Gate Park 173 / 180.3, Stonestown 221.9 / 224.3, Sutro Baths 212.5 / 220.8, SF State 237.6 / 240.9.
- The first try of the phase found a real stuck: the carried walk to the marketplace wedged for good between the pooled
  city bike parked by the Ferry Building's wall and the wall (fixed, above).
- 22 far T2 (the Sunset, the Richmond, the Presidio's west, ≥ 794 u straight) were left by the hour's budget: the lead's
  verify can run them all with `--trips t12 --budget 150`.

### Decisions

1. **The arrival card shares its touches instead of moving.** The phone's thumb zone is the whole lower left; any peek card
   there is in the way. Its body passes touches through, and a drag that starts on a button steers (a tap is still a tap),
   so lane N's layout stays as it is (`THUMB_PASS` can take other cards).
2. **The greeting pelican lands behind the pair** (as the camera sees them), so the moment's two-shot shows it between and
   behind them; beside the player only when there is no room.
3. **The mantle replaces a pop, and caps the jump in the city.** Before, the airborne move skipped the rise check and any
   jump snapped the body onto any height; now 0.45–1.6 u is a hands-first climb and higher is a wall (city only; the
   district is unchanged). A hop that clears the edge lands as before.
4. **Two ride shots only**: the open-top bus and the LRV. The cable car, the F-line and the ferry keep the side-on shot
   (their riders stand at the rail or the window, where it reads best). The phone's narrow frame set the bus's turn
   (0.35 rad): at 0.62 the riders sat at its edge (checked by projection at 390 × 844 and 1440 × 900 in the tests).
5. **Auto-glide ends through a callback**, not an event: `vehicle:auto` is frozen as bike / car. It lands about 20 u from
   the target (the glide's own landing spot rules), then faceOpen.
6. **Set down only off the bus and the Metro**, within 6 u, only when the stop's spot is not open already; the sweep judges
   those stops at the same spot (`setDown` in static.json says how far from the pole: on lane T's re-stood poles 0.75–3 u,
   32 of 71 stops).
7. **The stopped vehicle is a wall for faceOpen** (the ground does not know it) — only at the ride's end, while its platform
   is live.
8. **Parked rides do not block an auto-walk** (a toy bike passed through for a moment is better than a trip stuck for
   good); a player steering by hand still bumps into them.

### Known gaps

- The mantle is not seen live: no ledge between 1.2 and 1.6 u next to a walk was found near the landmarks.
- pelicanGreet and the auto-glide were checked driven from the console; since then lane C calls the greet in the moment
  (`game/pelicanFirst.ts`, once the two-shot has turned and `greetBehind()` agrees) and lane N's 看风景飞过去 rides the
  auto-glide (`dd19cf15`). I have not re-shot them through those callers.
- The greeting pelican can stand partly behind the player in the two-shot (its head and bill show; seen on desktop and
  phone).
- The live walker pushes along the camera's axes, the static sweep along the most open heading: a spot can pass one and
  not the other (run 2: SS Jeremiah O'Brien passed on desktop, not on the phone; in run 2d it passes on both).

### Not done (this part)

- The trips phase's 22 farthest T2 destinations (the hour's budget; the tool runs them).
- The phone profile's trips phase (the carried walk is the same code; the desktop run only).

### Requests

- **C / N**: FYI — both hooks are already wired on origin (pelicanFirst's greet; `dd19cf15` 看风景飞过去 on the auto-glide).
- **N**: SS Jeremiah O'Brien's trip end (T3): the walk graph's nav path ends 4.8 u short of it (a tap-to-walk stops
  short); it passes the live walker on desktop and phone. The Powell & Market turntable's walk quote (47 s) came in at
  63 s with a cable car on the turntable's track in the way (1.34 ×).
- **T**: the Sausalito quay (OFF: off the model — a waiver in your report, or a quay on the model); the loop bus standing
  at the Welcome Center stop blocked r2's walk on Lincoln Blvd once for > 5 s (run 2c desktop). FYI: off the bus / Metro the
  rider is now set down on open ground by lane F (`openSpot`, ≤ 3 u on your re-stood poles), and the static sweep judges
  the stops there.
- **Lead / V**: new in GameRoot's main graph: the pelican greeting (vehicles/pelican.ts), the mantle (controller), the
  auto-glide (glide.ts, moveSystem), openSpot (faceOpen.ts), `RIDE_TOUR` (cameraModes.ts), `THUMB_PASS` (pointer.ts) —
  a few KB gzip in all; please count them in the next bundle measurement. No draw call, triangle, material or program.

## Review (2026-09-28, the adversarial review of lane F)

### 给主人的摘要

1. F 线做的东西在电脑和手机（390×844）上都实际玩了一遍：落地后马上能走、跳舞/摸摸/坐下、"起飞"常驻、自动飞、金门大桥都正常。找到并修好 8 个问题，最明显的两个：滑翔落在渡轮大厦海堤边时，第一下推摇杆会撞上栏杆（现在直接朝空地走）；离 BAYBAY 稍远时双击她，摸完会弹出一大块菜单挡住手机屏幕（现在只摸摸）。
2. 街区模式恢复原样（点自己、双击 BAYBAY、角色影子都和以前一样）；车漆"国际橘"改成常用的"国际橙"（小铺里的同名商品请 E 线改）。
3. 还没解决的：首屏包 298 KB，目标 265（这次把 F 线的角色能力代码挪进城市包，省了约 2.8 KB），其余要主管和其它线一起挪。

### What I checked

- Every commit lane F pushed in wave 5 (22 code / tool commits and the three report commits, `23c9b8de` … `5e448a0a`), the
  code round them (controller, camera, moveSystem, system, glide, pelican, models, anim, pointer, TouchControls, Hud,
  Systems, playerLock, lockWatchdog, cinema, the sweep scripts), plan §2 MF1–MF3, §4.4, §4.9, the lead note and the
  owner's feedback. Rebased on `80ede43f` (lane A's review) before the push.
- Played on the dev server 5501, headless Chrome with the RTX flag, one at a time, PERF-LOCK checked before each run:
  desktop 1440 × 900 (city and district) and the phone profile 390 × 844 dpr 3 with touch. Every shot read.
  - City, desktop: the self-tap opens lane A's wheel; dance on both heroes; G → glide → G lands, 0 watchdog releases;
    the scenic auto-glide Ferry gate → Coit landed 7.7 u from the target in 8.3 s and W walked 3.9 u at once.
  - City, phone: 起飞 shown next to 跳 with the ferry as the focus; the self-tap wheel → 跳舞 on both heroes
    (`review-wheel-dance-lazy-charimpl-phone.jpg`); the pill opens the journal on 今天 (`panel journal / today`); a glide
    landing by the Ferry Building, then the stick walked 8.5 u in 1.5 s.
  - District, desktop: after the fixes a tap on the player gives no `self-tap` and nothing else changes.
  - Node probes (not committed): the auto-glide with lane R's real Fleet Week soft boxes on a flat stand-in city, Ferry →
    Marina Green / the Wave Organ / Fort Mason: all landed (35 s, 40 s, 30 s), no circling at the boxes' edges.
- Report claims recomputed from the data on disk: the trips phase (`run2c/trips/live.json`) — T1 16 / 16 within 1.3 ×
  (0.78 · 0.93 · 1.30), T2 24 / 25 (0.70 · 0.95 · 1.34, the Powell & Market turntable over), 0 pulls, 22 skipped by
  the budget: as reported.

### Defects found and fixed (`f734abce`, tests +7)

| # | where | what was wrong (seen / proven) | fix |
|---|---|---|---|
| 1 | W5-F7 `actors/camera.ts` | After a landing faceOpen turns the player at once, but the camera swings at rate 1 and the stick is camera-relative: the first push went along the old view. Off a glide landing by the Ferry Building's seawall (114.4, −27.4) W walked into the rail: **0.64 u in 1 s** (replayed: 1.16 u in 1.5 s, stuck at the chain) — the report's "第一下推摇杆不会撞墙或冲海" did not hold there. | The open-ground turn sets the movement basis to the open heading at once, until the camera gets there, the 3 s hold ends or the player drags the camera (then a 0.3 s blend). Same spot: **3.3 u in 1 s, 6.6 u in 1.5 s** along the plaza (`review-landing-seawall-before-desktop.jpg`, `review-landing-seawall-after-desktop.jpg`). |
| 2 | W5-F2 `game/Systems.tsx` | A double-tap on BAYBAY out of her reach: the first tap starts a walk up to her with a pending interact, so no menu is open yet to fold; the walk arrived and opened the call menu over the pet (phone: the hearts under a menu covering the lower half of the screen). | The double-tap drops the pending interact (the walk goes on: lane A pets her on arrival) and a pending call. Phone: pet, no menu 2.5 s later (`review-baybay-pet-no-menu-phone.jpg`). |
| 3 | W5-F5 `actors/stuckHelper.ts`, `system.ts` | A pull in progress kept writing the player's position for up to 1.15 s whatever happened: 起飞 while BAYBAY runs over, a vehicle, a restart, or R's own unstick (the controller and the helper both answer R) — a node probe teleported the player 45 u away and it was dragged back to the pull's target. | `abort` (not playing, carried, not on foot) and a moved-away check (> 1 u from where the pull last put them) stop it where the new mover put them. The helper's input is one reused object (it was a new literal every frame). |
| 4 | W5-F2 `actors/system.ts`, `game/Systems.tsx` | District mode changed: the self-tap body (reported 4 u nearer) took any tap on the player in the district, where nothing listens (lane A's wheel is a city feature) — the tap used to reach the ground or the interactable round the player; the district's BAYBAY double-tap folded her menu away with nothing to answer. | Both are city-only; the district taps as before wave 5 (checked live: 0 self-taps, nothing opened). |
| 5 | W5-F8 `actors/models.ts` | The shadow proxies also cast in the district; plan MF9 makes every lever city-mode only ("district mode unchanged"). | `shadowProxies.on` follows the world mode every frame; off, the shadow pass draws the full body (as before wave 5). |
| 6 | W5-F2 `actors/system.ts` | The self-tap's 4 u lead also beat BAYBAY standing in front of the player: a tap on her body gave the player's emote wheel. | No lead when BAYBAY's own body (a capsule, not her 1.1 u proxy sphere) is met first on the ray (`selfTapDistance`). |
| 7 | rules / budget: `actors/Actors.tsx`, `system.ts` | `charImpl` (+ `recolor`) sat in GameRoot's main graph although every caller (lanes A, E, R, D) is a city feature ("city-only code behind cityLoader or a lazy chunk"). | A lazy chunk loaded in city mode (charApi() is null until it lands: the frozen contract; E's wear re-sends every second). Production build of `f734abce` (to scratch): the `charImpl` chunk is **2.79 KB gzip**, GameRoot **298.36 KB** gzip. `CharImpl.update` makes no array or closure per frame. |
| 8 | zh text: `actors/vehicles/models.ts` | The paint's Chinese name 国际橘: the colour is 国际橙 (the game's own GGB bark and postcard, common usage). | 国际橙; lane E's shop copied 国际橘 (Requests). |

Tests: `tests/opus-bay-w5-feet.test.ts` (the pull stops on a take-over and after a teleport, a lone pull still lands; the
open basis at once, handed back on a drag and after the hold), `tests/opus-bay-w5-char.test.ts` (proxies off = the full
body casts; the city-only gates and the dropped pending menu; no static import of charImpl / recolor anywhere in
`src/opus-bay`; 国际橙; BAYBAY in front wins the tap). The two behaviour tests (1, 3) fail on the unfixed code.

### Facts re-checked on the web (2026-09-28)

1. The Golden Gate Bridge's colour is named International Orange, CMYK 0 / 69 / 100 / 6 — goldengate.org, Color & Art
   Deco Styling (https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/) ✓ (the
   page now lives under bridge-features; the code comment carries the URL).
2. In Chinese the colour is 国际橙 (the game's own `data/sf/landmarks.ts` bark and postcard fact; e.g.
   https://color.d777.com/hex-c0362c "国际橙金门大桥"). ✗ in lane F's paint name → fixed; ✗ in lane E's shop.
3. Ocean Beach fires: March 1 – October 31, 6 a.m. – 9:30 p.m., in the NPS rings
   (https://www.nps.gov/articles/ocean-beach-fire-program.htm, https://sf.funcheap.com/event-series/ocean-beach-bonfires-return/)
   — the noVault rings' "they burn in season" ✓.
4. The Aquatic Park Municipal Pier has been closed since October 2022
   (https://www.nps.gov/safr/learn/historyculture/aquatic-park-pier.htm,
   https://www.sfgate.com/bayarea/article/san-francisco-municipal-pier-closed-17607420.php) — part a's triage ✓.
5. Sea otters float on their backs and use the chest as a table
   (https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/sea-otter) — the float emote ✓.
6. SS Jeremiah O'Brien is at Pier 35 (long-term lease 2023; https://ssjeremiahobrien.org/visit-us/) ✓ (N's T3 target).
7. Fort Point stands under the bridge's south arch (https://www.goldengate.org/bridge/visiting-the-bridge/fort-point/) —
   `deckSteer.ts`'s "the ground far below, Fort Point under the arch" ✓.
8. Golden Gate Ferry runs the Ferry Building ↔ Sausalito (https://www.goldengate.org/ferry/riding-the-ferry/) ✓.
9. The Powell–Hyde and Powell–Mason lines turn on the Powell & Market turntable
   (https://www.sfmta.com/places/powell-cable-car-turnaround) ✓.
10. The Wave Organ sounds best at high tide (https://www.exploratorium.edu/visit/wave-organ) ✓.
11. The N Judah stops Irving & 2nd Ave and Irving & 6th Ave exist (https://www.sfmta.com/routes/n-judah; SFMTA's
    bus-substitution stop lists) ✓.
12. Randolph & Bright: trains stop at marked poles, no platforms (https://en.wikipedia.org/wiki/Randolph_and_Bright_station) ✓
    (the "poles" the sweep judges).
13. **M Ocean View, San Jose Ave & Mt Vernon Ave: permanently removed** from Saturday 28 September 2024 (SFMTA board
    approval February 2024; https://www.sfmta.com/project-updates/stop-removal-san-jose-ave-mt-vernon-ave-starting-saturday-september-28).
    ✗ lane T's `muni-san-jose-mt-vernon` still stops there (and part b's list names it) — request to T.

### Claims the code or the data do not bear out (besides the defects above)

- Part a cites six commit ids that are not on origin (pre-rebase ids): W5-F2 is `b76a7177`, `be708590`, `9bc07e57`,
  `cddbb065` (not `d7bff1f` / `0933450`); W5-F1 is `b094085e` (not `f66a14b`); W5-F3 `a3339730` (not `fb20445`); the
  landings `43f975d7` (not `ce39c21`); W5-F4 `362bdc6c` (not `48fb99b`).
- Part c "T2 (nearest 25 of 48)" with "22 far T2 left": 25 + 22 = 47 — Treasure Island (T2) is not in the phase's list
  (no walk trip: it is across the Bay Bridge); the next run should say so.
- "双击 BAYBAY 是摸摸" and "第一下推摇杆不会撞墙或冲海" held only in the easy cases (defects 2 and 1, now fixed).

### Budgets, warm-ups, teardown, save

- No new draw call, material or program from lane F: the proxies ride the heroes' own draw; the GLB scarf key is inside
  the existing `opus-bay-character-glb` program; the ribbon is a bone of the pelican mesh (+332 tris). GameRoot is
  298.36 KB gzip on `f734abce` (target 265): still over (open, the lead's list).
- Teardown: `setCharApi(null)` on unmount; the self-tap switched off; the THUMB_PASS window listeners removed; the deck,
  noVault and soft-box registries and the scarf uniforms are module state, fine while the world mode is fixed per page.
- Save / economy: lane F writes no save and pays no reward. Vault, mantle and pull never land on a roof (buildings are
  blockers; the landing must be standable ground), so the rooftop coins stay glide-only; the auto-glide may fly through
  lane E's air rings (paid once each by E's ledger).
- zh lines: 嘿咻！ · 好，你来飞！ · 坐稳啦～想自己飞，动一下就接管 (15 characters): short and natural.

### Open (not fixed here)

- The mantle also runs in the district (a hop against a 0.45–1.6 u ledge climbs hands first; the > 1.6 u wall is
  city-only). It is MF2's forgiving feet, not a lever; left for the lead to decide.
- The watchdog never drops a leaked `activity` / `shop` / `panel` hold (self-explained by the day-0 design), and R cannot
  free it: a hold a lane forgets to release would lock the feet for good. Lanes A and E release on every path (their
  reviews); the lead may want a long timeout.
- Small per-frame garbage left: on the GGB deck `deckAt` / `deckWish` / `laneClear` objects every frame, and
  `autoGlideInput` + `floorAt` objects during an auto-glide.
- The phone trips phase and the 22 far T2 trips (lane F's part c gaps) are still to run at W5-Z.

### Requests

- **E**: `economy/items.ts` — 国际橘围巾 / 国际橘背包 / 国际橘单车, the short name 国际橘 and the note 金门大桥的颜色就叫国际橘 →
  国际橙 (the paint itself is now 国际橙).
- **T**: `muni-san-jose-mt-vernon` — the M no longer stops at San Jose & Mt Vernon (permanent since 2024-09-28, SFMTA):
  retire the stop (riders use San Jose & Geneva inbound, San Jose & Niagara outbound).
- **Lead**: GameRoot 298.36 KB — lane F's remaining city-only main-graph code (`deckSteer` ≈ 0.8 KB, the auto-glide in
  `glide.ts` / `moveSystem.ts`, the greeting in `vehicles/pelican.ts`) could follow charImpl into a city chunk; and the
  self-explained-hold policy above.

### Checks

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (the 43 old warnings, none in `src/opus-bay`) ·
`npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1353 / 1353**, fail 0, on the rebased head
(`80ede43f` + `f734abce`). npx, tsx, tsc and eslint worked from the junctioned node_modules. PERF-LOCK absent at every
Chrome and at the one `vite build` (to scratch); one Chrome at a time; dev server 5501 stopped at the end. No Higgsfield
credits.
