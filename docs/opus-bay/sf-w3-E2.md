# Wave 3 · lane E2 (movement, camera, vehicles, pelican, touch and gamepad input)

Worktree `C:/Users/willy/wt/e2` (branch `w3-e2`), dev port 5203. Brief: `sf-w3-lead.md`, `sf-w1-checkpoint.md` §5.5,
the E2 requests in `sf-w2-C2.md`, `sf-w2-F.md`, `sf-w2-G1.md`, and C2's wave-3 request 3 (`sf-w3-C2.md`).

## Part a

### 给主人的摘要

- 手机上点一栋楼，小人会走到那栋楼前面最近的街上（带落点光圈）；隔着一排矮楼点后面的高楼，也会走到你这一侧的街，不会绕到楼背后。
- 手机右下多了一个「跳」按钮（56 像素，在行动按钮上方，不挡任何 HUD）：轻点是小跳，按住是大跳；骑车时是单车小跳。
- 手柄：A 同时算 E（缆车上坐下/站起、长椅起身），View 键开关地图，跑步猛推摇杆误按 L3 不再起飞，撞墙/鹈鹕落地有轻微震动。
- 爬坡喘气改成按爬升高度：爬 6 u 以上、到坡顶才喘一次，45 秒内不重复；从 Filbert Steps 一路爬到 Coit Tower 只在山顶喘一次。
- BAYBAY 换成正式模型的那一帧不再临时编译着色器（原来 +4 个程序，现在 0 个）。之前被打断的那次已经推上去的：存档恢复滑翔、车辆给行人让路、主包瘦身、等车提示、缆车刹车下车。
- 检查：tsc 0、eslint 0、opus-bay 测试全过（最后一次 534/534）；手机 390×844、375×667 和平板 768×1024 实机截图都看过。

### What was built

All on `origin/opus-bay` (hashes as pushed; a rebase may have changed the last one).

| task | commit | what |
|---|---|---|
| G1 save v2 hook | `01f8241` | `moveApi.setGlideUnlocked(v)`: restores the glide unlock quietly (safe before the bind; `false` locks again). |
| E2-16 | `2572ca9` | `giveWay` consumes `registerObstacleSource` obstacles (own radius, any speed, the step that reached one is undone). |
| HC-1 / P7 | `87ba00b` | moveSystem reads `landmarkTallStructures` through `cityModule()`; `nav` / `driveRoute` load `core/walkGraph` lazily (per-frame helpers moved to `core/polyline`); no static city-module import left in E2's files. |
| DR-1 | `a35a85f` | MoveChip shows the waiting chip (Cancel) while `flow.ride.stage` is `'waiting'` / `'turning'`, "Stopping…" while `'braking'`; glyph per ride kind; the glide button reads `moveApi.subscribeGlide`. |
| E2-10 + F's platform consumers | `2cc188b` | Rider side of the hop-off handshake (`requestPlatformStop` → `'braking'` → `hopOffRide()` at speed < ALIGHT or 1.2 s → clear door slot → `releasePlatformStop`) for Space, pad B and `moveApi.requestHopOff`; rider / BAYBAY pitch with `plat.pitch`, running-board lean (`hangLean`, `railMirror`), walking kept on `plat.decks`, BAYBAY's cable-car bench, the ride camera on `platforms.get(move.line)`. Test `tests/opus-bay-sf-hopoff`. |
| M2 | `875a10b` | A tap / click on a city building wall walks to the open ground in front of it (below). |
| E2-9 | `71f2bff` | Touch 跳 / Hop button (below). |
| E2-11 | `5917f0c` | Gamepad (below). |
| E2-13 | `6c30416` | Crest pant by climb height (below). |
| P5 (C2 request 3) | `ee2b765` | The BAYBAY GLB swap links no shader program (below). |
| E2-16 follow-up (H2b's question) | `3dde7a2` | Only person kinds say "whoa" in `giveWay`; `'traffic'` and any other kind (e.g. `'static'` for a mural board) give the soft bump without a voice. |

**M2 — tap on a facade** (`actors/tapTarget.ts`, new; `actors/system.ts`):
- The ground picker's ray (`heightfieldRaycast`) now also stops at the first city building wall below its top
  (`Blocker.top`, polygon blockers of city buildings) within 320 u horizontally (`FACADE_REACH`). No triangles: a 0.5 u
  march through `blockersNear`, cached for the pointerdown / click pair. Walls inside the occlusion dither between the
  camera and the player (the `TOY_FRAG` cylinder) are seen through, as on screen.
- `frontSpot(x, z, ux, uz)`: back along the ray (≤ 24 u), the first standable point whose large open area
  (`nav.arrivalSpot`, ≤ 6 u) lies on the camera side of the wall; else a large area within 10 u of the wall; else the
  first standable point; else `nearestWalkable(8)`. The intersection carries `facade` (`FacadeIntersection`), and
  `onGroundClick` walks there with the usual ring marker (double tap = run) or drives there (tap-to-drive).
- District mode has no building tops: nothing changes there (hero regression green).

**E2-9 — touch hop** (`core/input.ts`, `actors/TouchControls.tsx`):
- `touchJump(down)`: the press is the same jump edge as Space / pad B; `input.touchJumpHeld` joins `jumpHeld` in
  `pollInput` (a finger tap of ~0.1 s is a short hop, a hold the full jump; a release before the 0.07 s take-off
  crouch keeps the full jump, as for clicks). `clearKeys` (blur) releases it.
- The button: 56 px cream, arrow icon, "跳 / Hop", always the lowest of the touch movement column (bell, 下车, 降落,
  起飞 above it), on foot and on the bike / in the car (bunny hop); hidden while sitting, gliding, in transit, in a
  dialogue, a panel, a cinematic, fishing and the postcard reward. Pointer capture keeps the release when the thumb
  slides off; `touch-action: none`. Phones (≤ 600 px): 14 px above the contextual action button. 601–1180 px touch
  screens: one column in (`right: 84px`), beside G1's round-button column. Safe-area insets in both. The column has the
  class `ob-move-buttons` (G1 request 1).

**E2-11 — gamepad** (`core/input.ts`, `actors/Actors.tsx`, `actors/system.ts`, `ui/MoveChip.tsx`):
- `pickGamepad(pads)`: the first connected pad with `mapping === 'standard'`, else the first connected one. The full
  mapping table is in the `input.ts` header.
- A: the flow's interact / confirm and `input.interactCount++` (E): switch seat on a cable car, stand up from a bench
  (the move chip says A there now). View / Back (8) toggles the map (`padActions.map`); Y's journal and the map wait for
  the same states as J / M (dialogue, photo mode, cinematic, fishing, reward). L3 is ignored while the left stick is
  pushed past 0.94 (`L3_STICK_MAX`). `rumble(weak, strong, ms)` on the pad in use (vibrationActuator): hard vehicle
  bumps and glide landings, nothing unless the pad is the input device.

**E2-13 — crest pant** (`actors/controller.ts`):
- `GradeTracker.update(dt, g, moving, y)` follows the climb: it starts on g > 0.2 (walking or running, steps
  included), survives gentle stretches (0.1–0.2) and short landings; the crest is 1 s on the flat, 1.5 s standing still
  or 1.5 u back down; a crest after a ≥ 6 u rise pants once, at most one per 45 s (`PANT`). A teleport
  (`controller.sync`) forgets the climb. The old rule (10 s running uphill) never fired on a click-to-walk.

**P5 — BAYBAY GLB swap** (`actors/Actors.tsx`, `actors/system.ts`, `actors/models.ts`):
- Late models (the BAYBAY GLB, the pelican) are precompiled for the render path the world uses (a 1×1 half-float
  target while the tilt-shift post is on, as `world/warmup` does), the swapped mesh keeps the skinned shadow-depth
  material C2's `kindSweep` gave the procedural BAYBAY, and its shadow pass drops the map (no alpha test; three hands
  the map to the depth material otherwise).

**API for other lanes**
- `core/input`: `touchJump(down)`, `input.touchJumpHeld`, `pickGamepad(pads)`, `rumble(weak, strong, ms)`,
  `L3_STICK_MAX`, `padActions.map`.
- `actors/tapTarget`: `facadeAlongRay(o, d, tMax, player?)`, `frontSpot(x, z, ux, uz)`, `FACADE_REACH`,
  `type FacadeIntersection`.
- `actors/controller`: `PANT`, `GradeTracker` (`update(dt, g, moving, y)`, `rise`, `reset()`).
- `actors/view` `registerObstacleSource`: kinds documented (people / `'traffic'` / anything else = static).
- `moveApi`: `setGlideUnlocked(v)`, `subscribeGlide`, `requestHopOff` (earlier in this part).
- DOM: the touch movement column is `.ob-move-buttons` (for G1's HUD box list).

### Evidence

- Checks on the last push: `tsc` 0, `eslint` 0, **534 / 534** opus-bay tests (hero regression and contracts
  included). Under the shared machine load the wall-clock assert in `opus-bay-sf-citymap` "draw … fast" failed twice
  (171–337 ms > 150 ms) and passes alone (36–77 ms), and one full run had 1 failure that did not repeat (the wave-4 note
  lists the same wall-clock flakes); my check script re-runs a failing file alone before it calls a run red.
- New tests (`tests/opus-bay-sf-move3.test.ts`): M2 (a Union Square tower wall, the thin building seen over a lower row,
  the see-through dither, open ground, district = null), E2-9 (tap 0.13 s < 1.0 u, hold > 1.3 u, Space + touch, blur),
  E2-11 (stubbed `navigator.getGamepads`: standard pad wins, A = interact + E once per press, View → map once, L3 with a
  hard / calm stick, B held, rumble clamp and device gate), E2-13 (the rule: landings, gentle stretch, 45 s cooldown,
  standing crest, 5 u = no pant; the Filbert Steps walk in district: one pant, at the top), E2-16 static kind.
  `tests/opus-bay-sf-vehicles` pant assert updated to the new signature.
- M2 in the app (city, `ll:37.7880,-122.4075`): a real touch tap on a tower at 390×844 walked to Post Street
  (`(100.1, 201.4)`); at 375×667 the thin building seen over a lower row sent the walker round the block before the
  camera-side rule (`(97.1, 190.9)`, still walking after 7 s) and to the near street after it (`(97.1, 205.1)`, arrived);
  a mouse click at 1440×900 walked to Maiden Lane at the tower's base. Plain ground taps with touch at both phone sizes:
  target set, arrived. Raycast cost 0.0–0.2 ms per cast (worst: a near-horizontal ray, 0.2 ms).
  Shots: [`qa/w3/E2/m2-phone375-tapped.jpg`](qa/w3/E2/m2-phone375-tapped.jpg), [`m2-phone375-arrived.jpg`](qa/w3/E2/m2-phone375-arrived.jpg).
- E2-9 with real touch (CDP touch events): 390×844 Hop at (316, 638)–(372, 694), 375×667 at (301, 461)–(357, 517),
  768×1024 (zh) at (628, 818)–(684, 874); **0 overlaps** with every fixed HUD box in the three sizes, with and without the
  contextual action button (at a cable-car station). Tap 0.64–0.65 u rise, hold 1.33 u. The floating touch stick walked
  16.0 u (390) and 17.3 u (375) in 1.4 s. Shots: [`e2-9-hop-phone390-action.jpg`](qa/w3/E2/e2-9-hop-phone390-action.jpg),
  [`e2-9-tablet768-zh.jpg`](qa/w3/E2/e2-9-tablet768-zh.jpg) (also shows G1's overlap, request 2).
- E2-11 in the app with a stubbed standard pad: View opened and closed the map; on a Powell-Hyde car A moved the rider
  rail → seat, the chip reads "A Stand · B Hop off". Shot: [`e2-11-pad-A-seat-cablecar.jpg`](qa/w3/E2/e2-11-pad-A-seat-cablecar.jpg).
- E2-13 in the app (city mode, click-to-walk Levi's Plaza → Coit summit): arrived at 15.8 s, one `pant` at 17.3 s at
  y 20 (the summit). Shot: [`e2-13-coit-summit-pant.jpg`](qa/w3/E2/e2-13-coit-summit-pant.jpg).
- P5: programs 30 frames before / after `swapGuideNow()` at the Ferry gate: before the fix 37 → 41 (quality high); after
  49 → 49 (high) and 36 → 36 (mid). (Two `basic` programs link at ≈ 11 s after load in every run, with the warm-up;
  not from the swap.)
- P7 / GameRoot gzip (`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/w3/e2/dist`):
  HC-1 312.26 → 310.72 KB (walkGraph + format became a 2.6 KB lazy chunk; 283.5 KB measured with G2's static landmark
  imports stubbed). 328.26 KB at `6c30416` (the growth came from other lanes' wave-3 / wave-4 work), **301.49 KB** at
  `fe4d427` after G2 moved the landmark library out (`88ed44f`). E2's part-a additions to the main graph are ≈ 1.5 KB
  (`tapTarget` 0.84 KB gzip).

### Decisions

- M2 uses the blocker tops, not a triangle raycast against the city batches: zero draw-side cost and the same answer the
  walker's collision uses. A tap goes to the camera side of the wall: a thin building seen over a lower row must not
  send the walker round the block. Hero district buildings and landmarks (no `top`) keep the old ground behaviour.
- The Hop button stays in one place (the column's bottom) in every mode that has it, so the thumb learns it; it never
  moves when the contextual action appears. A touch release before take-off keeps the full jump (same rule as clicks);
  a normal finger tap is past it and gives the short hop.
- Pad A does both (interact and the E count), exactly like the keyboard's E; the flow's own guards stop double actions.
- Pant thresholds (1 s flat, 1.5 s standing, 1.5 u drop) keep the 0.5 s near-flat stretch of the Pioneer Park path from
  ending the Filbert climb.
- H2b's question (sf-w3-H2b.md review request 3): a static obstacle source is fine now; register the mural boards with
  kind `'static'` (vehicles stop with a soft bump, no voice; the walker slides round them).

### Known gaps

- G1's bubble / waypoint placement does not know the touch movement column yet (request 1): BAYBAY's bubble can sit
  over the Hop button for a moment.
- A facade tap with no reachable ground in front shows the red ring at the wall base, which can be hidden inside the
  building.
- The hero F-line car does not honour stop requests yet, so its hop-off stays immediate (request 4).
- The seated cable-car camera frames the rider very close (part b's city camera).

### Not done

Nothing from part a's list. Part b: E2-5 view field, E2-6 city camera, E2-7 glide world, E2-8 flying pelican, E2-12 city
bike racks and benches.

### Requests

1. **G1, `src/opus-bay/game/hudLayout.ts` `HUD_BOX_SELECTOR`**: add `'.ob-move-buttons > *'` so BAYBAY's bubble and the
   waypoint keep off the touch movement buttons (Hop, bell, 下车, 起飞, 降落):
   `'.ob-hud > *', '.ob-touch-action > span', '.ob-topstack > *', '.ob-toast', '.ob-goals-card', '.ob-coach', '.ob-lead-chip', '.ob-move-buttons > *',`
2. **G1, `src/opus-bay/opus-bay.css`**: on 601–1180 px touch screens the contextual action button (`.ob-touch-action`,
   76 px at right 18 / bottom 20) sits on the round-button column (right 16, bottom 18, column-reverse) — see
   [`e2-9-tablet768-zh.jpg`](qa/w3/E2/e2-9-tablet768-zh.jpg) (坐叮当车 over the map / Ask buttons). Move it one column in,
   like the movement column:
   `@media (min-width: 601px) and (max-width: 1180px) { .ob-hud:not(.is-narrow) .ob-touch-action { right: calc(84px + var(--ob-sr)); } }`
3. ~~G2 (+ D2), P7: the static landmark imports in G2's files~~ — done by G2 in `88ed44f` (C2's request 4) while this
   report was being written: GameRoot's static graph reaches no `world/sf/landmarks` module now (301.49 KB at `fe4d427`).
4. **F, `src/opus-bay/world/streetcar.ts` + `game/transit.ts`**: the district / hero F-line ride has no `line`, so E2's
   rider hops off at once (as before). For the braked hop-off there too, give that ride `line: 'streetcar'` and honour
   `requestPlatformStop('streetcar', 1.2)` / `releasePlatformStop` in the hero streetcar (brake to 0 within 1.2 s, like the
   city cars); E2's side needs no change.

Relayed messages during part a: none.
