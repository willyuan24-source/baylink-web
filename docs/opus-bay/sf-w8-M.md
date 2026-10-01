# Wave 8 · lane M · San Francisco mini-games (second set)

Lane M (sf-w8-lead.md §3): three new one-minute games only San Francisco has. Worktree `C:/Users/willy/wt/w8-m` (branch
`w8-m`), dev port 5809, scratch `C:/Users/willy/opus-qa/w8/m/`, QA images `docs/opus-bay/qa/w8/M/`. Owned: new
`play/<game>*` files and their css, the registration lines in `play/zones3.ts`, APPEND-ONLY `economy/records.ts`, the
`medal:<game>:n` rewards; one line per panel in lane K's `game/baybayHold.ts` hold list. Run as part of the Ultra
workflow `wf_66c65596-f6a` (a first agent of this lane worked 19:00–19:20 PDT and was stopped by the relaunch; its
uncommitted grip game was kept, fixed and finished — see part a).

## 给主人的摘要

1. **叮当车「拉闸」小游戏**（鲍威尔街两条缆车线上）：坐上 Powell–Hyde 或 Powell–Mason 缆车开动后，横幅里多一个「拉闸」按钮（BAYBAY 也会邀请）。一分钟里像真的缆车司机一样：上坡**按住拉闸**抓缆绳，看到红色路段（加州街路口、转弯）**松开**滑过去，进站前松闸，发车时再拉，路过路口**摇铃**。游戏只"读"缆车的位置，不会改变缆车怎么开。
2. 手机（单指：大大的「拉闸（按住）」+「摇铃」按钮）和电脑（空格 + H）都实际玩过、截图看过；奖励照旧：好 / 很好 / 太棒了三档，最好成绩进手帐"我的记录"。
3. 修了上一位留下的几个不公平判定（停站后马上进红色路段被判"没松闸"、进站最后半步提示又跳回"拉闸"、路口铃在红色路段里根本摇不到），现在跟着提示玩能拿满分，一直按住或一直不按都拿不到奖牌。
4. 缆车知识都查过官网/资料（缆绳时速 9.5 英里、鲍威尔线过加州街必须松缆、海德街 21% 是全线最陡）。

## Part a · W8-M1 the cable-car grip (19:24 → 20:10 PDT)

### Inventory first (what exists; nothing duplicated)

`play/`: first flight + Golden Gate rings, emotes / pet / sit / view spots, the Seward slides, **the cable-car bell riff +
lean-out** (a call-and-response rhythm game on the ride banner: `play/bell.ts`), stair races, the step counter,
marshmallows, the turntable heave-ho, crest hops, K-Dock's sea lions, frisbee, beach ball, the cardboard slide, the
crooked-street descents, hide & seek, kites, the skyline quiz, wave 7's claw machine / fortune teller / crabbing /
sourdough. `eggs/`: 24 eggs + city sounds (incl. **the foghorn duet** heard on the bridge deck in fog). A busker figure
exists: the **guitarist at Calle 24** (`world/sf/landmarks/calle-24.ts`, afternoons 12:00–20:00 Bay time, with three
listeners); none on Haight St. Nothing works the cable car's grip: the grip game is new; the bell riff stays the
rhythm game (the grip game's bell is one tap per crossing, on the same ride).

### What was built

| file (new unless named) | what |
|---|---|
| `play/grip.ts` (4.3 KB gz) | `GripGame` (pure, stepped with the ridden car's view `{ s, dir, v, mode }`): the let-go stretches (`gripMarks`: the Powell × California crossing 9 u before → 3 u past, and the line's corners found from the track heading, ends skipped), the bells (the request stops it runs through and the crossing), the dwell stops; the judgements: a red stretch entered with the lever let go (+10, held: the alarm), the rope taken again as the car leaves the red / a stop (+5 within 1.2 s), a stop pulled into let go (+5), a bell in reach (+5; stray rings after five cost a point). Score 0–100 = 70 × the judged share + 30 × the share of running time on the cable; tiers **● 40 · ◆ 65 · ★ 88** → `medal:grip:1..3`, best = score. The run: `startGrip()` through the PlayKit (`grip`), keys Space (hold) / H / Esc, Settings pauses its clock, 60 s of riding or the ride's end (a ride shorter than 15 s: no card, nothing paid, BAYBAY says why) |
| `play/GripPanel.tsx` (2.9 KB gz) | overlay `play-grip` at the bottom of the screen (phones) / at the right above the HUD (≥ 1000 px): the track ahead on a canvas (the hill's real profile, the red stretches, the stop boards, the bells — gold / ringing / green / grey —, the car with its lever back or forward, the cable glowing while held), the hint, the clock, the score, ✕ 44 px; buttons **Bell** 95 × 64 and **Grip (hold)** 243 × 64 on a phone |
| `play/GripPad.tsx` | the ride banner's pad (lane T's `registerRidePad`) on a Powell car under way: 拉闸当司机 / Work the grip; short label 拉闸 / Grip it ≤ 600 px (three pads share the phone's row) |
| `play/sfgames8.ts` (0.96 KB gz) | the set's zones chunk: the overlay, the pad, the chunks prefetched while waiting for / riding a Powell car, BAYBAY's invite 5 s into the ride once a visit (not while lane K's hold is on, a bubble is up, a game runs) |
| `play/sfgames8Lines.ts` | the set's names and **all BAYBAY lines** (zh + en, fixed): grip 20, busker 11, foghorn 10 (busk / foghorn lines for parts b / c) |
| `play/sfgames8Sounds.ts`, `play/sfgames8.css` | synthesized `m8-grip-on` / `-off`, `m8-take`, `m8-coast`, `m8-alarm`; the panel css |
| `play/zones3.ts` (surgical, 4 lines) | `import('./sfgames8')` → `initSfGames8()` beside wave 7's set |
| `game/baybayHold.ts` (lane K's, 1 line) | `'play-grip'` in `BAYBAY_HOLD_OVERLAYS` |
| `economy/records.ts` (append) | row `grip` 叮当车拉闸 (points) |
| `tests/opus-bay-w8-m-grip.test.ts` | 10 tests (below) |

### Defects in the inherited draft, fixed (red, then green)

1. **A red stretch right after a stop was judged "not let go"**: a let-go counted only if the lever had been held within
   8 s, and the clock ran on while the car stood at the stop — southbound the crossing's red begins 3.8 u after
   Powell & Sacramento, so a player who let go into Sacramento correctly got `letgo-idle` (0 / 10). Now the window counts
   running time only, a right let-go keeps the lever "in rhythm" (a stop right after the red counts too), and the game's
   start counts as a grip. Test "the let-go clock ran on at a stop": red `bell-miss,stop-ok,letgo-idle`, green.
2. **The stop hint flipped back to "grip" in the car's last half-unit** (the next stop was looked up as "more than 0.3 u
   ahead"), so a player following it gripped into every stop: `stop-bad` × 4 on lane F's real cars (the real-car test
   was red: perfect player 77). Now the game tracks the next stop until the car has stood at it or passed it.
3. **The crossing's bell could not be rung by a player following the hint** (the bell and the red stretch overlap and
   the hint showed only "let go"): the bell is now its own cue (`bellNow`; the hint reads 松开拉闸，摇铃过路口！) and the
   lever's hint goes on. The hint also says let go 6 u **before** a red stretch (it said so only inside it).
4. A "take the rope" window opened while the hint already said let go for a red stretch just ahead (`go-late` for doing
   the right thing): closed.

### Evidence

- **Tests** `tests/opus-bay-w8-m-grip.test.ts` 10 / 10: the lines (fixed text, zh ≤ 45); the marks on both Powell lines
  both ways; **players on lane F's real `CableSystem` stepped in node** (6 rides incl. southbound; the game reads the car
  only): perfect 100 on all six, a player 0.3 s late 95–100, the lever always held 35 (no medal), never touched 4–26 (no
  medal), never ringing ≤ 85 (never ★); the stop-clock regression; the hint before the red; **a whole game through
  `stepFrameSystems`** → `medal:grip:1..3`, best ≥ 88; 放弃 → nothing paid; an 8 s ride → no card and the 这趟太短啦 line;
  Settings pauses the clock; the pad's visibility (Powell under way only, not California, not waiting); the hold list;
  the records row; the chunks (zones8 960 B, grip 4315, panel 2931, pad ≈ 330, lines 2782, sounds 673 gzip; lazy from
  zones3 → sfgames8; nothing in GameRoot; no transit module imports the game).
- **Played in the game** (dev 5809, `?world=city&start=free&save=off`, one headless Chrome, `--force_high_performance_gpu`;
  every image read): the Powell–Hyde from Powell & Market toward Hyde & Beach; the pad clicked; an in-page player pressing
  the real keys (desktop: Space / H on `document.body`) and the panel's buttons (phone: pointer events on 拉闸 / 摇铃):
  - desktop 1440 × 900: the panel at the right above the HUD row, the red stretch at the crossing
    (`qa/w8/M/a3-grip-cross-desk.jpg`; the new player's goals card was left open in this run), the card **★ Brilliant · 96 ·
    let-gos 2/2 · bells 5/5 · on the cable 99% · +30 coins** (the first stop came 2.4 s into the game: judged idle → fix 1's
    "the start counts").
  - phone 390 × 844 dpr 3 touch: the panel under the ride banner (`a1-grip-cross-phone.jpg`), the whole minute by the
    buttons → **★ Brilliant · 100 · let-gos 2/2 · bells 5/5 · on the cable 99%** and BAYBAY's 你是真正的叮当车司机！
    (`a2-grip-card-phone.jpg`); the judgements in order: stop-ok, go-ok, bell-ok, … letgo-ok (California), take-ok, …
  - the phone's pad row measured: Bell riff 41–141, Lean out 145–254, **Grip it 262–355** px (the long label overlapped
    Lean out by ≈ 5 px before the short one).
- **Calls / triangles** (desktop, dev `renderer.info`): 81–82 calls / 271–275k on the moving car with the panel up (the
  game draws nothing in 3D).
- Checks on `ef061beb` (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old
  warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1676 / 1676** (250 s).

### Decisions

1. **Read-only on the ride**: the game never brakes, holds or moves the car (lane K / F own it); it judges how well the
   lever is worked against the car's real motion. So the car does not stop if you never let go: the alarm, BAYBAY's
   line and the score say it (as the real alarm under Powell St would).
2. **Every corner is a let-go curve in the toy** (the real lines have pull curves too; the museum page describes both):
   simpler to read; the crossing is the real rule.
3. The rope is "taken again" right past the crossing (the real northbound cars coast 3½ blocks downhill: 20 s of nothing
   to do in a one-minute game) — recorded in the code.
4. ★ needs the bells too (88: a perfect lever without bells tops out near 85).

### Facts (checked on the web 2026-09-30)

- "Four loops of wire rope are run at a constant 9 ½ miles an hour"; "Powell Street cars have to 'let go' of the cable
  because the Powell Street cable runs beneath the California Street cable"; drift curves ("the grip person simply
  releases the cable to let the car coast around the corner") vs pull curves; bells as "a warning device of an
  approaching cable car" — https://www.cablecarmuseum.org/archive/Anat/Anat.html
- "With one hand clanging the bell to keep crossing automobiles from getting in his way, he throws the grip lever forward
  with his other hand just in time"; "an alarm system and mechanism under Powell Street on either side of the California
  tracks to physically force the Powell cable from the grip if it is held too long" —
  https://www.streetcar.org/wheels-motion/cable-cars-work/
- "the Powell cars coast downhill, off the cable, for three and a half blocks"; "the steepest grade in the cable car
  system—a harrowing 21 percent slope—… from Chestnut to Bay Street" —
  https://www.streetcar.org/wheels-motion/ride-cable-car-lines/
- Gripping "requires extraordinary skills" (strength and coordination) — https://www.sfmta.com/press-releases/sfmta-announces-third-woman-ever-serve-cable-car-grip (the first agent's check, 2026-09-30)

### Known gaps

- The ride is skipped (直接到站) or hopped off: the game ends with what was judged (a card from 15 s and three judged
  moments).
- In node a fresh `CableSystem` never brings a car round the Hyde & Beach / Taylor & Bay turntable to a rider waiting
  there (the southbound real-car tests start mid-line); the game's own rides do (lane F's area, not changed).

### Requests

- **Lane X** (voice): BAYBAY's new lines are fixed text in `src/opus-bay/play/sfgames8Lines.ts` (`GRIP_LINES` 20;
  `BUSK_LINES`, `FOG_LINES` for parts b / c — final by 22:45).
- **Lane Q**: the ride banner's pad row (`ui/RideBanner.tsx` `PAD_ROW`) does not wrap; with three pads on a 390 px phone
  the long labels overlapped — the grip pad now uses a short label; a `flexWrap: 'wrap'` would make it robust.
- **W8-I / W8-Z**: ride a Powell car (`__opusBay.transit.ride('powell-hyde','powell-market','hyde-beach')`), tap 拉闸 /
  Grip it in the banner.
