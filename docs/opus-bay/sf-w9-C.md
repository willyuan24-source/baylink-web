# Wave 9 · lane C · camera, reveals, city looks

Lane C of wave 9 (plan `docs/opus-bay/sf-w9-lead.md` §3 C; the first-use review `docs/opus-bay/review-2026-10-01-first-use.md`
§5 #15 and §6 世界、镜头与美术; w8 NEXT #6 time-bound items). Worktree `C:/Users/willy/wt/w9-c`, port 5908, scratch
`C:/Users/willy/opus-qa/w9/c/`. Times PDT.

## 给主人的摘要

1. **10/9 舰队周拍照修好了**：在码头绿地海堤按 E 拍「舰船巡游」时，镜头不再被身后草坪上的树顶高、往下俯拍——拍照模式遇到树或楼会沿着镜头线往前收，保持平视，船队在画面中上部；下午拍「飞机编队」时，飞机和烟带在画面上半部。镜头前面挡脸的路人也会自动让开。
2. **10/31 唐人街万圣节庆典**：庆典布置在 Waverly 巷时，这条巷子对玩具车封路：车不会再开进来停在灯笼中间；两头的十字路口照常通车。
3. **到达镜头（体验评审第 15 条）**：Painted Ladies 的揭示镜头避开了正中间的锥形树，七栋房子完整入镜；双峰朝向市中心和海湾大桥（不再朝西）；Coit 塔有了自己的揭示镜头（整座塔 + 海湾大桥 + 渡轮大厦）；镜头和主角之间的路人会让开；鹈鹕落地后转向该看的方向。
4. **叮当车**：每段行驶中自动出现 3 秒「探身」侧拍（之前藏在"行驶中按住 L"后面）；按钮写明「按住 L 探身」，车停着时变灰并说明原因。坐 N 线时，镜头"看向景点"不会再把镜头塞进楼里——能越过屋顶就抬高，不能就保持原来的镜头。
5. **唐人街夜景**：Grant Ave 的 32 盏灯笼晚上有柔和的红色光晕，三块招牌旁加了一点粉色和青色霓虹；不增加任何绘制调用（draw call）。
6. 鼠标滚轮拉远的镜头距离，下次进游戏最多只记住 20（之前拉到 30 的"俯视模型"视角会被一直记住）。

## Part a · the time-bound items (2026-10-01 21:35 → 23:10)

### W9-C1 · the Fleet Week parade photo at Marina Green's seawall (w8 S-P3, before 9 Oct)

- **Reproduced** (desktop 1440 × 900, `?world=city&start=free&save=off&date=2026-10-09T11:20`, the player placed on the
  jets' WATCH spot (−377.5, 287.5), E = 拍舰船巡游): rig pitch 0.04 (the parade's face request), **`roofLift` 3.74 u**,
  the camera at y 6.0 over a target at 1.09 → `camera.rotation.x` **−0.60** (other stand spots: −0.86 at (−372, 294),
  −0.48 at (−366, 288)); the ships at the frame's top edge, the lower half lawn (`qa/w9/C/a1-marina-parade-photo-before.jpg`).
  The cause is not the terrain (flat, 0.06–0.19 u) but the W7-K1 canopy lift: four lawn trees stand round the camera's
  spot (one at (−368.3, 294.4), canopy 1.5–3.9 u), so the roof / canopy lift raised the photo camera over them.
- **Fix** (`actors/camera.ts`, `actors/cityViews.ts`): in photo mode the roof / canopy lift no longer raises the camera;
  `photoPullStep` pulls it in along the orbit toward the player to the farthest share (0.05 steps, never under photo
  mode's 3.5 u) whose line clears the roofs and canopies, keeping the pitch; only what is left at 3.5 u is lifted. Fast
  in, slow out (the roof lift's rates). The jets' photo at the same spot (`JETS_PHOTO_PITCH` 0.06) goes the same way.
- **After**: pull 0.95, `roofLift` 0, `camera.rotation.x` **−0.12**; the ships sit on the horizon at ≈ 38 % of the frame
  height, the player and BAYBAY on the walkway (`qa/w9/C/a1-marina-parade-photo-after.jpg`).
- **GameRoot**: the roof / canopy maths (`roofNeed`, city only) moved from `camera.ts` into the lazy city camera chunk
  (`actors/cityViews.ts`, loaded by `camera.ts` in city mode) with the new photo pull: the static estimate went
  258.318 → **258.163 KB** (−0.155; scratch `gr.mts`, the W8-P9 test's method). The follow camera's roof lift waits for
  that chunk (city mode loads it at once); `tests/opus-bay-w7-k1-camera.test.ts` now awaits `loadCityViews()` first.
- **Test** `tests/opus-bay-w9-c-camera.test.ts`: a flat city stand-in with one lawn tree where the photo camera stands;
  red on origin's camera (elevation **0.326 rad** over the target vs 0.100 without the tree), green after (pulled in,
  same elevation as without the tree, the line misses the canopy); `photoPullFor` pure cases.

### W9-C2 · no toy car on Waverly Place while the festival kit is up (w8 H-RP-5, before 31 Oct)

- **Reproduced** (`?date=2026-10-31T12:00`, the player at the W8 perf spot (29.5, 153.5)): over 60 s the city's toy
  traffic drove into the alley twice (edges 38022 / 38023, 0.65 / 1.35 u off the centreline, one slowing to 0.39 u/s by
  the line-up) — the "parked" toy car of W8-Z's festival view is a traffic car stopped short of the costume line-up.
- **Fix**: `world/sf/roadClosures.ts` (new, city chunk): a feature registers a closure test while its kit is up;
  `world/sf/traffic.ts` never spawns on or turns into a street whose middle is closed (`usable()`), and a car on (or
  turning into) one leaves — out of sight at once, in sight by the existing give-way hop-and-shrink (`clearLane(c,
  'closed')`). `halloween/worldFestival.ts` (lane H's file, **surgical**): `inAlley()` (≤ 2.6 u of the centreline,
  between the two ends — the cross streets' junctions stay open) is registered when the kit is built and removed when it
  comes down (`drop()`: 15:00, the player > 160 u away, a ground rebuild re-registers).
- **After** (same spot, 80 s + 45 s): the alley edges 38022 / 38023 `usable` = false, the cross streets (38020, 38021,
  38024, 38045, 38060) true; **0** cars on the alley; desktop 94 calls / 324k triangles at the perf spot (festival kit
  5,426 tris; unchanged by this fix).
- **Test** `tests/opus-bay-w9-c-waverly.test.ts` (the published city round the alley): the alley test; the kit closes /
  reopens (10:59 open, 12:00 closed, the player 400 u away open, 15:00 open, disposed open); on the real street net the
  alley's drivable edges become undrivable and the cross streets stay drivable, 60 s of simulated traffic never drive
  along the alley, a car placed in it leaves within one step. Red on origin (`usable` has no closure).

### Checks (part a)

See the commit message of `W9-C1` for the numbers of the run before the push.

## Resume note (02:12 → 05:00)

The lane's first agent was stopped by the account usage limit at ≈ 00:42 with W9-C1 / C2 pushed and the reveals, the
cable-car lean and the zoom cap uncommitted. The second agent kept all of it (tsc 0, its tests green, the QA shots it
had taken matched the code), split it into W9-C3 / C4 / C5, added the C4 test (red on origin: a 30 u zoom saved as 30),
ran the whole suite and pushed at 02:44 (nothing was discarded). The rebases (≈ 60 commits of other lanes) had no
conflict in any file; the last one (onto W9-P6 / E8) is the base of W9-C6 / C7.

## Part b · reveals, the zoom cap, the cable-car lean (pushed 02:44)

### W9-C3 · the arrival reveals (R§5 #15) — `1d0b52e8`

- `actors/reveal.ts`: `revealSight` (a street-tree canopy across the photo line or within ≈ 9° of the lens weighs 3, a
  building top under the line's camera-side 70 % weighs 1 per sample) and `clearPhotoPose` (turn round the target in
  ±0.14 rad steps to ±0.56, then rise +0.08 rad, then come in to 0.75 ×; the first clear pose, else the least blocked).
  `REVEAL_VIEWS`: Twin Peaks, Mount Davidson, Bernal Heights, Corona Heights look out at downtown (Salesforce Tower at
  the head of Market St, the Bay Bridge beyond), Lands End at the Golden Gate Bridge; Coit Tower (a district landmark
  without a photo pose) gets a pose of the tower from the west over the hill's shoulder.
- `actors/arrivalFace.ts` (new, guideCity's lazy chunk): within 4 s / 6 u of a pelican landing, an arrival without a
  reveal turns the player and the camera to the arrival heading (an overlook's view, else `data/sf/arrivals.ts`, else
  toward the attraction). `game/guideCity.ts` (lane N's file, surgical: REVEAL_VIEWS first, `revealSight`, the landing
  face) — lane N's later W9-N4 rebased onto it cleanly.
- `world/sf/crowd.ts` + `cityLife.ts`: the lens rule — a walker within 8 u in front of the lens inside an ≈ 18° cone,
  or on the view line short of the subject (the player, or a cinematic shot's target), shrinks away.
- Before / after (desktop 1440 × 900): Painted Ladies — the cone tree dead centre over the houses
  (`qa/w9/C/b1-painted-ladies-before.jpg`) → the photo pose turned / rose, all seven houses in frame
  (`b1-painted-ladies-reveal.jpg`); Coit Tower — no reveal, the plaza camera at the sign → the tower whole against
  downtown, the Ferry Building and the Bay Bridge (`b1-coit-reveal-hold.jpg`); Twin Peaks — looks down Market St at
  downtown and the Bay (`b1-twin-peaks-reveal-vista.jpg`). No geometry: draw calls / triangles unchanged by
  construction.
- Also seen at Marina Green (below): the walker who filled the lower middle of the parade photo in part a's after shot
  is gone with the lens rule.

### W9-C4 · the zoom-out is saved at most 20 u — `62fd4796`

`actors/camera.ts persistDistance` saves `settings.cameraDistance` within [7, SAVE_DIST_MAX 20] (was 30); the zoom
itself is not capped; the Settings slider still saves any distance. Test: 30 → 20 (red on origin: 30), 12.4 → 12,
4 → 7, photo mode → nothing. GameRoot static estimate +0.021 KB. A 30 saved by an earlier session stays until the
next wheel / pinch (it cannot be told from a slider choice).

### W9-C5 · the cable-car lean (R§6 world row) — `e8815224`

`play/bell.ts` (surgical, the lean camera only): 2 s after the car pulls away (≥ 0.5 u/s) the outside-the-car shot
looking back along it shows for 3 s, once per stretch between stops, seated too, no shutter, never under reduced
motion; a held L at the stop waits and leans out as the car leaves. `play/BellPad.tsx`: 「按住 L 探身 / Hold L to lean
out」 (touch 「按住探身」), disabled while the car stands (title 「车开起来才能探身」). BellPad's chunk 5081 → 5311 B (its
own cap 5.25 KB in the W5 chunk test).

**Played live** (02:55, the California St line from California & Grant to Van Ness, a fresh profile, no input): at
the stop the button is greyed (`qa/w9/C/c1-california-ride-stop.jpg`); the camera log (every 0.5 s) shows the lean
shot up at 29.5–31.0 s, 37.5–40.0 s and 47.5–50.0 s of the ride — 3 s once per stretch, each ≈ 2 s after the car left a
stop; the shot is the classic one, the car and the grip man from outside with the street behind
(`c1-california-auto-lean.jpg`). Desktop 76 calls / 281k triangles on Nob Hill.

## Part c · looks and the ride camera (03:00 → 04:45)

### W9-C6 · Chinatown's lanterns glow at night + a little neon — 0 new draw calls

- `world/sf/lights.ts`: a new band of the night light field, HALO_GLOW (aLevel 6 + diameter / 4): a soft glow of a
  fixed world size from 1.5 u out to ≈ 160 u (the field's other lights only fade in beyond 60 u, so near the camera a
  site's lanterns had nothing), a slow breath, its own falloff. The field's one Points draw: no call, no program, no
  triangle. `world/sf/sites.ts` (lane D2's file, surgical): the site light type's optional `halo`, passed through.
  `world/sf/landmarks/dragon-gate.ts` (surgical): 32 lantern glows (1.2 u, at each lantern's own sag), 4 dragon-lamp
  glows (1.4 u), a pink / teal / pink glow (2.0 u) by three blade signs (generic trade signs: light only).
- Before / after (the player at California & Grant looking up Grant Ave, timeOfDay night, the same camera both times):
  `qa/w9/C/d1-chinatown-night-before.jpg` (small red boxes, no light round them) → `d1-chinatown-night-after.jpg`
  (each lantern glows, the strings read lit down the street, pink and teal by the shop signs). Draw calls 121 / 123,
  triangles 275.5k / 279.4k (the same draw list; traffic and walkers vary ±3 calls between runs). Two stronger settings
  (1.5 u, a wider falloff) merged into a red haze and were rejected.

### W9-C7 · the ride camera's look-at never parks in the houses (R§5 #15, the N line)

- Why: W4-G9's look-at (a stop's attraction on approach, a portal on portal-out) puts the camera on the far side of
  the rider from the point; on Carl St UCSF is up the hill to the south, so the camera went into the north side's
  houses and the pull-in parked it ≥ 4 u off the rider against a house front (explorer 59-n-d, verify-explorer
  35-nj-a).
- `actors/cityViews.ts` (the lazy city camera chunk) `rideLookClear`, registered on `cameraModes.rideLookCheck`: on a
  city line the look's pose is checked at 5 Hz with the swing's own test at rises 0 / 0.18 / 0.36 / 0.54 rad; the first
  clear rise is taken, else the look is dropped (the line's own shot stays); eased. `cameraModes.ts` keeps only the
  call (GameRoot +0.070 KB; ≈ 257.9 after W9-P6, guard 258.5).
- Test (red on origin: pulled in to 4.9 u / x −3.5): an LRV passing a row of houses while a look 100 u east is on —
  open street as before; 6 u houses: over the roofs at > 10 u; 14 u houses: the look dropped, behind the train at > 12 u.
- **Not played live on the N** (a Metro ride with its real wait takes minutes; the time went to the checks above):
  Requests.

### Fleet Week framing, re-checked live (time-bound, before 9 Oct)

`?date=2026-10-09T11:20`, the player on the jets' WATCH spot (−377.5, 287.5), E → photo mode: the ships on the horizon
at ≈ 38 % of the frame height, the player and BAYBAY on the walkway, no walker in front of the lens
(`qa/w9/C/a2-marina-parade-photo-lens.jpg`; camera rotation.x −0.128, 64 calls / 118k triangles). `?date=…T14:00`
(the show 12:00–16:00), E → 拍飞机编队: the jets and their smoke trails across the frame's upper third, Alcatraz behind
(`a2-marina-jets-photo.jpg`; −0.143, 77 calls / 171k triangles). Both under the desktop budget.

## Not done (lane C's list)

- Lombard's curves in frame on a map-led arrival at Chestnut / Leavenworth (verify-explorer 07-lomb-*): not started.
- The Powell / California ride camera between tall buildings (the swung shot from behind looks down ≈ 35° over the
  car roof in Chinatown's canyon, `c1-california-ride-stop.jpg`): the auto-lean gives the classic shot each stretch,
  the base shot itself is unchanged (a retune of the W6-K1 swing needs its own before / after loop).
- 「窗外是 X」 lines gated by visibility: only the camera half (W9-C7) — the UCSF line still plays when the look is
  dropped.
- Pier 39's carousel / sea lions and Blue Heron Lake's pedal boats named by BAYBAY: not started.
- The Alcatraz waiting-for-boat camera (ultra-close on the hat), the Golden Gate south ground overlaps: not started.
- The cable-car lean and the reveals on a phone (390 × 844): not played on the phone this wave (desktop only).

## Requests

- W9-Z / a reviewer: ride the N outbound Duboce & Church → Carl & Hillway once (the portal-out at Carl & Cole and the
  UCSF look at Hillway) on desktop and phone and look at the camera (W9-C7 is test-verified only).
- Lane X: none — lane C changed no fixed BAYBAY line (the lean button's words are UI, not a voiced line).

## Decisions

- The reveal of an overlook pivots round the player (a pivot 150 u out would sweep the camera across the sky).
- The automatic lean takes no photo (the shutter stays the held lean's: a free stamp every stretch would cheapen it).
- The lantern glows are points of the existing light field rather than halo quads in the props layer (no new draw
  call, no new program; the props layer belongs to the street lamps).
- The ride look's check sits in the city camera chunk (GameRoot had 0.05 KB of room before W9-P6).
- Higgsfield: 0 credits (no side-by-side needed one).
