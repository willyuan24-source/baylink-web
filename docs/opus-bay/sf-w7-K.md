# Wave 7 · lane K · feel, camera, safety

Worktree `C:/Users/willy/wt/w7-k` (branch `w7-k`), dev port 5701, scratch `C:/Users/willy/opus-qa/w7/k/`, QA images
`docs/opus-bay/qa/w7/K/`. Owns `actors/**` (G's pelican slot and P's import-site moves excepted), `eggs/**`, `game/**`
except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`, `album.ts`, `photo.ts`; `data/cityZones.ts`; `play/PlayChip.tsx`,
`play/chip.ts`; a `treesNear` query in `world/sf/props.ts`.

## 给主人的摘要

1. 镜头和行道树：跟随镜头如果会站进一棵行道树的树冠里（B 线审查员在鲍威尔街·萨克拉门托街等车时看到的），现在会自动抬高到树冠上方；坐叮当车时，镜头会避开挡在镜头和你之间的树冠（站着坐都算）。但海德街很窄，路边的树冠几乎贴着车的踏板，坐在长椅上时镜头离你只有 4 格，树叶还是会占掉大半个画面——这需要让"贴着你的树冠"变半透明，已经写进请求里，留给下一波。
2. （后续部分完成后补充）

## Part a (2026-09-29, 20:24–21:55 PDT): the street trees in the cameras' ray tests

### What was built

- **`world/sf/props.ts`** (the lane's `treesNear` query): `CityProps.treesNear(x, z, r, fn)` — every street tree of the
  resident chunks whose canopy meets the disc, as a `Canopy` `{ x, z, r, y0, y1 }` (a vertical cylinder round the trunk,
  from `CANOPY_SHAPE` per kind × the same per-instance scale `select()` draws: round tree r 1.45 over 1.3–3.45, cypress,
  pine, palm fronds). Per chunk a 16 u CSR grid built on the first query after the chunk arrives (dropped with it); one
  reused record, no allocation per call. On top: `segmentCanopy(a, b, skip, cone)` (the fraction where a segment first
  enters a canopy; a canopy entered within `skip` u of `a` is left out; `cone` > 0 also counts a canopy within
  atan(cone) of the line seen from `b`, answering how far out a camera may stand with it outside its view cone) and
  `canopyLift(a, b, from, clear)` (how far to raise `b` so the segment clears every canopy it crosses beyond the
  fraction `from`). None of this is in GameRoot: the cameras reach it through `cityStreamerLazy()?.props`.
- **`actors/cameraModes.ts`** `RideCamera` (the city lines' side-on shot, `occlude` subjects only; bus / LRV / F-line /
  car / bike / glide unchanged): `occluded()` also returns the first canopy on the line (with `CANOPY_SKIP` 1.5 u and
  `CANOPY_CONE` 0.22 ≈ 12°, and the same line `CANOPY_LEAD` 0.35 s on so the pull-in comes in before a kerb tree
  crosses it); the swing's step test looks ahead where the car will be in 0.5 / 1 / 1.5 s (`SWING_AHEAD`); a swing is
  held until the side has been clear for `SWING_HOLD` 2.5 s (it eased back at every gap between two trees or houses);
  the pull-in never comes in for a canopy it cannot get in front of (nearer the rider than `MIN_PULL`: closer, the
  leaves only filled more of the frame). New exports: `CanopySource`, `canopySource()`, `setCanopySourceForTests()`,
  `CANOPY_SKIP`, `CANOPY_CONE`, `SWING_HOLD`. The subject's `speed` for a city line is now the car's own along its
  heading (`actors/camera.ts` `rideSubject`, from the platform's velocity; it was 0 and unused for transit).
- **`actors/camera.ts`** (the follow camera, city only): `roofLiftStep` lifts over the street trees' canopies like
  over roofs — the far 65 % of the line and the camera itself (`CANOPY_CLEAR` 0.6 u, under the same `ROOF_LIFT_MAX`
  cap). District mode: no canopy source (null), nothing changes.
- Tests `tests/opus-bay-w7-k1-camera.test.ts` (4): the canopy queries (scale, band, cone, lift, a chunk leaving);
  riding past kerb trees every 8 u standing and seated, the camera → rider line meets a canopy (cone included) in < 8 %
  of the frames and the shot is side-on again past the trees; the swing held along a row of trees (min swing after the
  first swing > 0.5) and K1's open street still side-on; the follow camera rises over a canopy it would stand in.
  **Red on the old code**: the ride test "a canopy between the camera and the rider in 297 of 818 frames", the hold test
  "the trees swung the shot" (never), the follow test "over the canopy: y 6.64 vs top 8.02".

### Evidence

- Checks on the part-a tree (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
  (43 old warnings) · suite **1493 tests, 1492 pass**; the one failure is the wall-clock assert of `opus-bay-actors`
  "A* reaches the hill … planned in < 400 ms" under the ten lanes' load — re-run alone: 20 / 20 pass (rule 9). W6-K1's
  camera tests (`w6-k1-feel`, `w6-k1-review`) green.
- Played (dev 5701, one headless Chrome, PERF-LOCK absent; scripts `C:/Users/willy/opus-qa/w7/k/{hyde,wait}.mjs`; every
  image read). The Powell–Hyde from Hyde & Beach, 5 spots up Hyde St, at each a shot with the trees in the camera's
  test ("on") and then with the canopy source switched off ("off", W6's camera for trees), 1.4 s apart:
  - **Standing, phone 390 × 844 dpr 3 mid**: the swing is 1.0 up the whole of Hyde St (the houses already did that);
    the probe "a canopy in the view cone between the camera and the rider" read on / off: −, 0.69 / 0.90, − / 0.96,
    − / −, 0.20 / −. At the same spot (spot 2, the car at a stop) on: the line clear, off: a canopy on it. Shot
    `docs/opus-bay/qa/w7/K/a-hyde-stand-phone-trees-on-off.jpg` (read): in both the rider on the running board is seen
    from above-behind with a kerb tree's canopy right over them (dithered in part) — the canopy stands at the rider.
  - **Seated, phone and desktop 1440 × 900 high**: the seated swing stops at 0.8 (K1 review), and the houses pull the
    bench shot in to 4 u (`pull` 4.0–5.3 with the trees off as well). Up Hyde St the kerb trees stand ≈ 1.1 u from the
    outward bench and their canopies (r 1.4–1.9) overhang the sitter: at bench height, 4 u off, the leaves fill most of
    the frame at 3–4 of 5 spots on both runs, on and off (`a-hyde-seat-phone-5-spots-on-off.jpg`,
    `a-hyde-seat-desktop-5-spots-on-off.jpg`, read). The rider and BAYBAY show at the Lombard crossing. **Not fixed:
    see Known gaps and Requests.**
  - **Lane B's waiting shot**, phone zh, waiting for the Powell–Hyde at Powell & Sacramento (`wait.mjs`): the camera
    stood 6 u above the player, no canopy round it (the probe: not inside any canopy), the player under a kerb tree's
    canopy, the near canopy at the frame's foot dithered (`a-wait-powell-sacramento-phone.jpg`, read). The camera
    inside a tree is covered by the lift (node test); the canopy over the player is the same gap as the seated ride.

### Decisions

- Canopies only for the city lines' side-on shot and the follow camera's lift: the car / bike / glide shots run along
  the road or over it, and a pull-in for every kerb tree on a turn would breathe.
- The view cone (≈ 12°, a portrait phone's half width) rather than the bare line: on Hyde St the line to the rider was
  clear while the camera stood right beside a canopy with half the frame leaves.
- No pull-in for a canopy the camera cannot pass (nearer the rider than 4 u): tested live, pulling in toward it made
  the leaves bigger.
- The swing hold (2.5 s) applies to walls too: at Hyde St's crossings the shot now stays behind the car instead of
  easing toward the side for the second the crossing is open.

### Known gaps

- **A canopy that overhangs the rider** (within 1.5 u, the seated bench on Hyde St, the Powell & Sacramento stop) is
  not something a camera position can clear at bench / street height: it needs the canopy thinned round the player.
  The TOY dither-fade (`world/materials.ts` TOY_FRAG) leaves out fragments within 1.2 u of the player and below
  `uPlayer.y + 0.35`, and its tube is 0.7 u at the camera end.
- The swing / pull-in were played on the Powell–Hyde only (Powell–Mason and California take the same code).

### Not done (this part)

- Nothing else of item 1.

### Requests

- **Lead / lane X (materials, not in any lane's table):** a tree-only dither round the rider — e.g. an `OB_CANOPY`
  define on `TOY_INST_TINT` (the street trees' material) whose fade tube keeps its 2.2 u radius all the way to the
  player and ignores the `L − 1.2` / `+0.35` cut-offs, or a per-instance fade the camera sets for the ≤ 3 canopies
  `CityProps.treesNear(player, 2)` returns while riding. The query is there; the shader is not lane K's.
