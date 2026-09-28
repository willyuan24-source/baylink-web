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
