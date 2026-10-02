# Wave 9 · lane C · camera, reveals, city looks

Lane C of wave 9 (plan `docs/opus-bay/sf-w9-lead.md` §3 C; the first-use review `docs/opus-bay/review-2026-10-01-first-use.md`
§5 #15 and §6 世界、镜头与美术; w8 NEXT #6 time-bound items). Worktree `C:/Users/willy/wt/w9-c`, port 5908, scratch
`C:/Users/willy/opus-qa/w9/c/`. Times PDT.

## 给主人的摘要

1. **10/9 舰队周拍照修好了**：在码头绿地海堤按 E 拍「舰船巡游」时，镜头不再被身后草坪上的树顶高、往下俯拍——拍照模式遇到树或楼会沿着镜头线往前收，保持平视，船队在画面中上部（之前船被挤在最上沿）。
2. **10/31 唐人街万圣节庆典**：庆典布置在 Waverly 巷时，这条巷子对玩具车封路：车不会再开进来停在灯笼中间；已经在巷子里的车会让开消失；两头的十字路口照常通车。
3. 后续部分（揭示镜头、叮当车探身、唐人街夜灯等）见下面各节。

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
