# Wave 7 · lane H · Halloween world

Lane H of wave 7 (`docs/opus-bay/sf-w7-lead.md` §3): the Halloween season in the toy city, keyed off
`halloween/season.ts` (frozen). Worktree `C:/Users/willy/wt/w7-h`, dev port 5705, scratch `C:/Users/willy/opus-qa/w7/h/`,
QA images `docs/opus-bay/qa/w7/H/`.

## 给主人的摘要

1. 十月的黄昏变成「南瓜色」：万圣节期间傍晚的海雾带一点橘色（只是颜色，不增加手机负担），BAYBAY 早就录好的那句「南瓜色的黄昏……」现在终于会说了。
2. 门口讨糖的小朋友（小幽灵 / 小女巫 / 小南瓜）会轻轻摇晃，门廊下挂着的小幽灵会随风荡来荡去；夜里的蝙蝠翅膀边缘带淡淡的月光色，天黑后也看得见了。
3. 找南瓜灯更容易：每个还没找到的南瓜灯上方飘着一团橙色的「小鬼火」，BAYBAY 走近时会说「南瓜灯的光在左边 / 右边 / 前面 / 后面」。
4. 夜里门口灯光多的时候，优先点亮离你最近的那些。
5. 新台词 9 句（中英各一，固定文字，可配音），已交给 X 线录音。

## Part a · W7-H1 the pumpkin dusk · W7-H2 figures that move · W7-H3 bats at night · W7-H4 the glow nearest first · W7-H8 the lantern guide (20:25 – 21:15 PDT)

### What was built

- **The pumpkin dusk (W7-H1).** `world/sf/fog.ts` (surgical, lane H's row): `KarlState.setGoldenTint(color | null,
  amount, instant)` — a feature PUSHES a warm tint that applies only at golden hour (in `retarget`, Karl's golden colour
  is lerped toward it) and slides with Karl's own 45 s slide; `goldenTint` reads it back. fog.ts imports nothing of the
  Halloween feature (a test checks the source). `halloween/world.ts` pushes `DUSK_TINT` `#f2a65a` × **0.35** while the
  phase is not `'off'` (`duskTintFor(phase)`): the first push into a world's Karl is instant (at load), a phase change
  slides, the teardown clears it. BAYBAY's already-recorded `w6-h-dusk` line ("南瓜色的黄昏，有一点点神秘，又很温柔～") is
  now offered at the season's golden hour (once a Bay day, the season's own scheduler and gates).
- **Trick-or-treaters and hanging ghosts move (W7-H2).** `halloween/worldDress.ts`: the stoop mesh is drawn with the static
  `TOY` material (the city L0 cells' program `ob-toy`, a plain Mesh with receiveShadow: nothing new to link) instead of
  `TOY_DYN`, and its **wind sway** (vertex shader: xz += (0.16 sin + 0.025 sin) · aInfo.z², `uWind` 1) is the life:
  `swayInfo(y0, h, k)` writes aInfo.z = k·√t per vertex, so a trick-or-treater rocks from the feet (0) to the head
  (`FIGURE_SWAY` 0.75 → ≈ 0.09 u) and a hanging ghost swings from its hook (0) down to its hem (`GHOST_SWAY` 0.87 → ≈ 0.12
  u; the string bends with it). No new call, no per-frame CPU work. Pumpkins, lanterns and webs keep z = 0.
- **Bats readable at full night (W7-H3).** `createBats()`: the wing tips carry a pale lavender rim `#b3a6dc` with the toy
  shader's night glow (`BAT_GLOW` tip 0.55, shoulder 0.2, body 0.12; (0, 1] = night only), the body stays dark, the
  bats are ≈ 15 % bigger (`BAT_SIZE` 0.3; the flight band test still clears the hills). Against the dark-blue night sky
  they read as dark bodies with moonlit wing edges.
- **The glow nearest first (W7-H4).** `nearestHalos(cells, px, pz, cap)`: every stoop halo of the cells in reach sorted by
  its distance to the player, the first `DRESS_HALOS_BY_QUALITY[q]` kept (W6 kept whole cells in cell order, so a far
  corner of a near cell could win over the house next door); re-sorted when the player has moved `HALO_RESORT` 8 u or
  the quality changes. The pool's priorities (hunt 2, muertos / haunt 1, stoops 0) unchanged.
- **The lantern guide (W7-H8)** (the hunt postcard waits at all 40; `economy/hints.ts` `HINT_KINDS` untouched):
  - `halloween/huntGuide.ts` (new): `sniffSide(px, pz, yaw, lx, lz)` → 前面 / 左边 / 右边 / 后面 from the camera's view
    (the camera sits at the player + (sin yaw, cos yaw) · d); `createHuntGuide()` says one of four fixed lines the first
    time the player comes within `HUNT_RADAR` 60 u of an unfound lantern (once a lantern a session, ≥ `SNIFF_GAP` 40 s
    apart, not closer than 12 u, only when BAYBAY may speak — the season's gates).
  - `halloween/hunt.ts`: a **wisp** over every unfound lantern — a glowing orange orb (always lit: aInfo.w 1.9) with a
    little tail, `WISP_UP` 2.3 u above it, drifting on the same TOY sway — built into the lanterns' own merged mesh (now
    on `TOY`, receiveShadow like the cells): no new call; a halo each at night (hunt priority). BAYBAY points one out
    once a Bay day (`huntWisp`, within 35 u). The `collect()` / milestone code is untouched (lane G's postcard hook goes
    there).
- **Día de los Muertos by the hour (W7-H6, first half).** `halloween/muertos.ts`: `muertosSchedule(date)` (pure) — 1
  November: the papel picado, the marigolds and Acción Latina's community altar; 2 November 08:00–21:00: the six
  Festival of Altars ofrendas at Potrero del Sol and the marigold arch at 22nd & Bryant; `procession` 'gather' 18:00–19:00,
  'walk' 19:00–21:00 with `walkS`; a `?halloween=muertos` preview on another date = 2 November with the altars at any
  hour. `buildMuertos(halos, altars)` leaves the park and the arch out; `spotShown()` gates the finds; the mesh rebuilds
  when the altars come or go. `near()` now returns the lines on offer in order (the gathering line near 22nd & Bryant
  18:00–19:00, the eve line on 1 November).
- **BAYBAY's new fixed lines** (`halloween/worldLines.ts`, pushed with this part for lane X): `W7_WORLD_LINES`, ids
  `w7-h-*` — hunt-ahead / hunt-left / hunt-right / hunt-behind / hunt-wisp, muertos-eve, procession-gather,
  procession-walk, venue-pumpkins (zh ≤ 33 characters; every dated one says 通常 and 以官网为准 / "check the official
  site"). `ALL_WORLD_LINES` stays wave 6's recorded list (lane X's W6-X4 test keeps passing); `EVERY_WORLD_LINE` = both.
- Tests: `tests/opus-bay-w7-h.test.ts` (7): the dusk tint (the colour at golden only, the slide, the dedupe, the phases,
  fog.ts free of the feature); the sway weights (feet 0, head > 0.6, offset 0.06–0.12 u, the ghost's hem, pumpkins 0, the
  TOY program key); the bats' rim; `nearestHalos`; the guide (the four sides, once a lantern, the gap, the radius); the
  muertos schedule (1 Nov, 2 Nov 07:59 / 08:00 / 18:00 / 19:30 / 21:00, the preview, the finds, the altar-less build);
  the new lines. `tests/opus-bay-w6-h.test.ts`: ids `w6-h-` or `w7-h-`.

### Evidence

- Checks on this tree: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · the suite
  (see the push line) · the lane's files alone (w7-h, w6-h, w6-h-muertos, w6-h-review) 20 / 20.
- Dev server 5705, headless Chrome 1440 × 900 'high' (scratch driver `C:/Users/willy/opus-qa/w7/h/shots.mjs`):
  - Alamo Square walking view, `?halloween=night&time=night`: **93 calls / 321k triangles** (the stoops 23.8k, 227 stoops
    in 16 cells, 12 trick-or-treaters, bats at alamo-square). The W6 review measured 98 / 315k there. Golden hour, the same
    spot: 80 / 317k (halloween-world 2 calls / 26.0k). The Western Addition stoop street: 73 / 280k.
  - `qa/w7/H/h3-bats-night-alamo.jpg` (read): looking up at the Alamo Square colony at night — the bats show as pale
    lavender wing shapes against the dark-blue sky (W6: invisible there).
  - `qa/w7/H/h2-ghost-swings-two-frames.jpg` (read): the same hanging ghost 2.4 s apart — it has swung to the side, the
    string bent. `h2-witch-trick-or-treater.jpg` (read): a witch kid with her broom and pail by a carved jack-o'-lantern.
  - `qa/w7/H/h8-wisp-over-lantern-alamo.jpg` (read): the orange wisp floating over the hidden lantern on Alamo Square's
    lawn; BAYBAY said the wisp line there on her own ("See that little orange wisp? A lantern is hiding right under
    it!").
  - The dusk: Twin Peaks → the west at golden hour, `?halloween=1` vs `?halloween=0`, mean colour of the fog band
    (x 900–1440, y 380–460): at 0.18 (214, 191, 168) vs (208, 187, 166) — hard to see; at **0.35** (214, 188, 163). Walking
    in the Outer Sunset inside the golden bank (`qa/w7/H/h1-pumpkin-dusk-sunset.jpg`, read): a soft apricot haze.

### Decisions

- The dusk tint is **0.35**, not the ≈ 0.18 of the request: measured, 0.18 moved the fog band by ≤ 6 / 255 (not visible);
  0.35 reads as a warm apricot haze inside the bank and is still soft. It runs in every season phase (1 Oct – 2 Nov,
  muertos included: marigold dusk); the dusk LINE only in 'season' / 'night'.
- Movement through the shared TOY sway (xz only), not a new material: a sway / rock instead of a vertical bob, but zero new
  programs and zero calls — the safest on a phone.
- The guide speaks per lantern per session (not once a Bay day): 40 lanterns across the city need more than one hint a
  day; the gap (40 s) and the gates keep it quiet.
- The wisps float over every unfound lantern in draw reach (240 u): generous on purpose (the postcard needs all 40); a
  0.2 u orb is only visible within ≈ 80 u.

### Known gaps

- The sway is horizontal (the kids rock, they do not hop).
- The dusk tint colours Karl's bank (the west side, the Gate); downtown at golden hour barely changes (no bank there).

### Requests

- **Lane X**: record `W7_WORLD_LINES` in `src/opus-bay/halloween/worldLines.ts` (9 lines, ids `w7-h-*`) into
  `data/sf/voiceW7.ts`. `w6-h-dusk` (already recorded) now plays: take it off any "never plays" list.
