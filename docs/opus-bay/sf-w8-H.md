# Wave 8 · lane H · Halloween live polish

Lane H of wave 8 (`docs/opus-bay/sf-w8-lead.md` §3, run inside the Ultra workflow): worktree `C:/Users/willy/wt/w8-h`
(branch `w8-h`), dev port 5805, scratch `C:/Users/willy/opus-qa/w8/h/`, QA images `docs/opus-bay/qa/w8/H/`. The season
goes live by itself at 00:00 on 1 October (`halloween/season.ts`, frozen).

## 给主人的摘要

1. 万圣节从 10/1 到 11/2 的每个关键日子都在手机（390 × 844）和电脑上实际玩过（10/1 讨糖、10/17 Sunnydale、10/24 Thrive City、10/31 大夜晚、11/1、11/2 游行），零点自动开季也看过，不用刷新页面。
2. **10/31 唐人街万圣节庆典**（11:00–15:00，Waverly 巷，官网已核对）：巷子上空挂满红灯笼，有手工桌、小南瓜堆、小舞台，穿着万圣节服装的玩具小朋友排队上台比变装；BAYBAY 会说两句新台词。只有那天那几个小时、走近时才出现。
3. **亡灵节游行**的小人现在会迈腿走路，玩家或 BAYBAY 站在路上时，队伍会从两边绕过去；讨糖的小朋友会时不时开心地跳一下。
4. **讨糖的门**：六条街全部检查，4 扇门有问题（3 扇在院子里/房子后面走不过去，1 扇其实是隔壁 29 大道的房子）——1 扇搬到正门，3 扇撤掉（编号不变，存档不受影响）。大夜晚提示改成「新门 + 万圣夜加倍 ×3」，更清楚。
5. 鹈鹕新服装 **南瓜领结**（60 金币，万圣节限定）；傍晚城里多一层淡淡的南瓜色薄雾（很轻）；备用目标卡片也有万圣节一行。
6. BAYBAY 的 4 句新台词 20:36 已推送给 X 线录音。没有阻碍上线的问题。

## Part a · play the season · the door-to-street check · the big-night toast · the fallback goals row (19:25 – 20:45 PDT)

### Resume

The first agent of this lane (19:00–19:20, stopped only for the switch to the Ultra workflow) left nothing in git and
its scratch: `drive.mjs` (a scratch driver over `scripts/opus-shot.mjs`: teleport, QA camera, measure, BAYBAY's bubble /
toasts / open overlays) and desktop captures on the live dates (`d1`, `d31`, `mid`, `n1`, `n2`, `p31` phone, `v17`,
`v24` + `v-*.json`). All of it was good and is reused below (every image read again before it is described); nothing was
discarded.

### The season end to end (1440 × 900 'high' and 390 × 844 dpr 3 'mid', `?world=city&start=free&date=…`)

| date (Bay) | where | what the game did | verdict |
|---|---|---|---|
| 30 Sep 23:59 → 1 Oct 00:00 (`mid/`, desktop, no reload) | Alamo Square | phase `off` → `season` at 00:00 on the running clock: 15 stoop cells / 225 stoops dressed, bats at alamo-square, the hunt drawn; BAYBAY's 藏起来的南瓜灯晚上会发光 line | ok |
| 1 Oct 10:00 (desktop `d1/`, phone `ph/d1/`) | Belvedere St | the free-roam goals card first (a new save), then door 5 / door 4 answer: 得到焦糖苹果！+5 金币 · 糖果袋 1 颗 and 谢谢您！万圣节快乐！; the 万圣节 page: goals 1/5 · 0/10 · costume, the streets, the four postcard slots | ok |
| 17 Oct 13:00 / 15:00 (`v17/`, `ph/v17b/`) | Sunnydale, The Hub | lane S's fair kit + the pumpkin patch (10 of 14 spots; hay bales and pumpkins by the tents); phone 68 calls / 219k | ok — a first phone run measured 6 s after the teleport saw no patch yet (the planner catalog and the ground still loading); after 20 s it is there |
| 24 Oct 13:00 (`v24/`, `ph/v24/`) | Thrive City | the Thrill-O-Ween kit + 13 pumpkin spots; phone 55 / 143k | ok |
| 31 Oct 19:30 (desktop `d31/`, phone `p31/`, `ph/d31/`) | Belvedere St, Alamo Square | every door answers; a new door pays door:n + night:n (×3, +10); the trick-or-treat and big-night postcards queue and open after BAYBAY's line; bats with moonlit rims; 89–113 calls / ≤ 345k desktop, 63–80 / ≤ 246k phone | **toast wording fixed** (W8-H2); BAYBAY's bubble over the open postcard (seen in `d31/e-alamo-night.jpg`) is lane K's W8-K1, pushed before this lane started |
| 1 Nov 12:00 (`n1/`, `ph/n1/`) | 24th St, Belvedere | papel picado over 24th St, the Mission's dressing 3.5k tris, no altars yet; a Belvedere door is `closed`; the page says 11 月 1–2 日是亡灵节：万圣节讨糖结束啦 | ok |
| 2 Nov 19:10 (`n2/`, `ph/n2/`) | 24th St / Bryant | procession `walk`, 40 walkers (high) / 26 (mid), altars built (8.9k); phone 67 / 216k | ok; the walkers walk through a player in their lane (part c) |

No exception in any run (`opus-shot` prints them; 0 here).

### The door-to-street check on all six streets (W8-H1)

W7-G checked Belvedere only against the street polylines. The new rule (`tests/opus-bay-w8-h-doorcheck.ts`
`doorProblem`): a live door's **knock spot reaches its own street on foot** (a shortest walk on a 0.25 u grid of cells
where the player's 0.3 u disc stands, ≤ 18 u, to within 3.2 u of the street's centreline), the door **faces** that
street, and it does **not front another street** that is nearer by more than 1 u (square to the door's facing, in
front of it — a corner house whose side touches a cross street is fine). Kit houses: the kit swap never takes a door's
lot in the season (W7-G6, unit-tested on the real class); landmarks are in the walk rasters.

Before (origin): **4 of 53 live doors fail** — door 9 (Belvedere: in a courtyard inside the block, walled in), door 36
(Jordan Ave: behind the front row, its yard reaches Jordan only round the block), door 38 (Sea Cliff: a pocket between
houses its knock spot cannot leave), door 46 (Sea Cliff: a 29th Avenue face, 2.1 u from 29th, 3.6 from Sea Cliff).
After: door 38 **moved** (same number) 19.8 u to the nearest Sea Cliff Ave face that passes; doors 9, 36, 46 **gone**
(no passing face within 30 u that keeps 2.8 u from every other door, gone door 8 included). 50 live doors (Belvedere 7,
Chenery 10, Fair Oaks 9, Jordan 7, Sea Cliff 9, Hearst 8). `scripts/opus-sf/halloween-doors.mts --fix` reproduces it.
Rasters read: scratch `map-d9.png`, `map-d36.png`, `map-d38.png`, `map-d38new.png` (roadway grey, pavement, buildings
dark, the door red with its facing).

### What else was built

- **W8-H2** the big night's toast: 万圣夜糖果加倍：… ×2 at a door knocked before; 新门 + 万圣夜加倍：… ×3 at a new door
  (`halloween/treat.ts treatToast`); on the phone it wraps to two lines (`qa/w8/H/a-phone-big-night-toast.jpg`, read).
  The city's fallback goals card (`ui/Moments.tsx`, shown only when the goals step's chunk is missing) renders a
  one-line `Mini` of each goals-tab row: 🎃 万圣节目标 n/3 + the next goal (`halloween/playGoalsRow.tsx`).
- **W8-H3** the four new fixed lines (below), pushed at 20:36 for lane X.

### Decisions

- A door that fails may **move along its own street with its number** (the ledger id stays; its old spot is kept in a
  comment); the append-only rule is about numbers, and moving keeps every save's record meaningful. A door with no good
  face nearby goes (`gone: true`, the W7-G7 precedent). The ≥ 8-doors-a-street floor of my own test became ≥ 7.
- The rule asks for a walk, not a straight line: toy houses have porches and setbacks, and 32 of 53 doors failed a
  straight-out-to-the-kerb ray while being plainly reachable round a step or a tree.
- 大夜晚 toast: 新门 (two characters) rather than 新的一家 keeps the longest ×3 toast at 36 characters.

### Real-world facts (checked 2026-09-30)

- Chinatown Halloween Festival: https://www.cycsf.org/chinatown-halloween-festival/ — "Saturday, October 31, 2026, from
  11am-3pm", Waverly Place, organiser Community Youth Center; "arts & crafts, games, a pumpkin patch"; a costume contest
  (children 0–11, teens, adults, families). https://www.cycsf.org/ — "family-friendly activities, cultural
  performances, a costume contest". (The calendar row in `realsf/calendar.ts` agrees.)

### New fixed lines for lane X (pushed in `904ddfc8`, W8-H3)

| id | zh | en |
|---|---|---|
| `w8-h-chinatown-contest` (worldLines.ts) | 小朋友们排队上台比变装啦！大家都好可爱～ | The kids are lining up for the costume contest — everyone looks so cute! |
| `w8-h-chinatown-lanterns` (worldLines.ts) | 红灯笼配南瓜，这就是唐人街的万圣节！ | Red lanterns and pumpkins — that’s Halloween in Chinatown! |
| `w8-h-procession-aside` (worldLines.ts) | 队伍从我们身边绕过去了。我们站到路边吧～ | They’re walking around us — let’s step onto the sidewalk. |
| `w8h-costume-pumpkin-bow` (lines.ts) | 鹈鹕戴上南瓜领结啦，好神气！ | Our pelican’s wearing a pumpkin bow tie — how dapper! |

### Checks (part a)

- On the tree before the first rebase: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old
  warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1671 / 1671** (392 s).
- After the rebases onto lanes A / P / Q / X / K / S / W2: tsc 0; the incoming test files with lane H's (169 / 169, then
  the Fleet Week / W2 ones 18 / 18). Pushed `652415ca` W8-H1, `fc1151dd` W8-H2, `904ddfc8` W8-H3 (20:36 PDT).

## Part b · the procession, the Chinatown festival, the pumpkin bow (20:45 – 22:00 PDT)

### What was built

- **W8-H5 the procession walks** (`halloween/muertosWalkers.ts`, `muertos.ts`): the robe stops at 0.24 u and two dark
  legs swing under it while the column walks (±0.5 rad, in step with the bob; straight at the corner pauses and while
  gathering). The robes' InstancedMesh draws four parts a walker (robe, sleeve, two legs) of one unit cylinder — still
  two meshes / two calls; 436 triangles a walker (was ≈ 330). **They step aside**: a walker whose place is within 1.0 u
  across / 1.6 u along of the player or BAYBAY slides sideways off that line (smoothed, ≤ 1.4 u) and back after;
  BAYBAY offers `w8-h-procession-aside` while they part round us. The toy traffic reads the shifted places.
- **W8-H6 the Chinatown Halloween Festival** (`halloween/worldFestival.ts`, wired in `world.ts`): on Waverly Place,
  31 Oct 2026 11:00–15:00 only, within 160 u: 27 red paper lanterns on 9 wires across the alley, two craft tables, a
  hay bale and pumpkins, a low stage with a backdrop and a painted jack-o'-lantern, and the costume contest's line-up
  (the trick-or-treaters' ghost / witch / pumpkin kids queueing to the stage, one on it). One merged mesh on TOY:
  **+1 call** that day only (desktop 104 → 105 at the alley's end, phone 83 → 84 / 77 → 78); 5,426 triangles. BAYBAY:
  `w8-h-chinatown-contest` by the stage, `w8-h-chinatown-lanterns` in the alley (lane S's calendar line also plays
  there). No new overlay, so nothing for lane K's hold list.
- **W8-H7 the pelican's pumpkin bow** (`economy/items.ts` append `pelican-pumpkin-bow`, index 36, 60 coins, rides shelf,
  season only; `halloween/costumeMesh.ts`, `economy/wear.ts`, `costume.ts`, `costumeArt.tsx`, `HalloweenPage.tsx`):
  two ribbed pumpkin-orange loops, two tails, a little pumpkin knot with stem and leaf, 248 triangles on the hats'
  material, on charApi 'pelican' 'neck' at the top of the hindneck where the ribbon's own bow sits (probed on the rig's
  vertices: the neck's top at body y ≈ 0.60); the ribbon comes off. No charApi / charImpl change was needed (W7-G2's
  slot table already had `neck`). BAYBAY: `w8h-costume-pumpkin-bow`.

### Evidence

- `qa/w8/H/b-phone-chinatown-festival-lanterns.jpg` (read): 31 Oct 12:00, phone — the lanterns across Waverly Place, a
  craft table, BAYBAY's 红灯笼配南瓜，这就是唐人街的万圣节！. `qa/w8/H/b-chinatown-festival-stage.jpg` (read): the stage, a
  witch on it, the line-up in the alley.
- `qa/w8/H/b-pelican-pumpkin-bow-glide.jpg` (read): 15 Oct, a glide off the Ferry Building with the bow tried on —
  orange loops on the hindneck in front of BAYBAY (straight behind the riders they hide it, as they hide the ribbon's bow).
- The procession (2 Nov 19:10 night, desktop): walkers with candles, legs under the robes, the files passing round the
  player standing in the lane; 63–76 calls / ≤ 308k (scratch `C:/Users/willy/opus-qa/w8/h/proc/`, read — the clearest
  frame, from the street side, was overwritten by a later run; the test pins the parting numerically).
- Tests (new): `tests/opus-bay-w8-h-procession.test.ts` (2), `-festival.test.ts` (3), `-bow.test.ts` (3), each red on
  the old code.

### Decisions

- The festival kit is **+1 call** on one day for four hours near Waverly Place: nothing of the season is drawn in
  Chinatown's stoops (not a dressed neighbourhood), and merging the kit into the hunt's lantern mesh (drawn wherever a
  lantern is in reach) would couple two features' rebuilds. Chinatown was the busiest spot (W7-Z 123 calls); lane W1's
  pagoda cluster there was briefed at 0 new calls. Measured with it: 105 desktop / 84 phone at the alley's south end.
- A costume **line-up**, not a moving parade: the real event is a costume contest (CYC); the kids rock on the shader's
  sway like the trick-or-treaters.
- The walkers' legs are parts of the robes' instanced mesh (4 instances a walker) rather than a third mesh (a call).
- The bow sits on the hindneck (the ribbon's place), not under the chin: the riders see the back of the neck.

## Part c · the dusk downtown, the children's hop (22:00 – 22:40 PDT)

### What was built

- **W8-H8 the dusk beyond Karl's bank** (`world/sf/fog.ts` surgical: `setGoldenTint(…, haze)`; `halloween/world.ts`
  DUSK_TINT.haze 0.35): at golden hour in the season the camera's own ground counts as at least 0.35 under the bank
  (uKarlCam's floor) — the shader's own extinction lays the tinted colour thinly over downtown, deepening with distance.
  Uniform-only, city-only, no call. Measured (12 Oct 15:00 `?time=golden`, the same walking view, `?halloween=1` vs
  `=0`, PNG means): the far town (176.6, 138.4, 95.5) vs (172.3, 134.1, 88.6), near walls identical — subtle by design.
  (Rebase: lane S's W8-S4 had fixed the old "× 0.18" comment in the same block; the conflict was resolved keeping S's
  wording plus the W8-H paragraph.)
- **W8-H9 the trick-or-treaters hop** (`halloween/worldDress.ts`): each child does a 0.13 u, 0.42 s hop every 2.6–4.6 s
  (its own rhythm); only the hopping children's vertex ranges of the stoops' merged mesh are rewritten and uploaded
  (`addUpdateRange`), the position attribute is DynamicDraw; still with Settings' reduced motion. Live at Alamo Square
  (20 Oct 13:00): the stoop mesh's heights change by up to 0.13 u over 12 samples 90 ms apart, x never; 74–77 calls,
  unchanged.
- **W8-H10 the festival kit stands on the streamed ground**: the city streams the alley's chunks in as the player comes
  (the far heights first), so a kit built from 160 u away could float or sink; `createFestival` re-samples the alley's
  ground at its two ends and middle twice a second while the kit is up and rebuilds it when the ground moved (> 0.05 u).
  The W7 pumpkin patches keep their own rule (they retry while nothing could be placed).
- Tests (new): `tests/opus-bay-w8-h-dusk.test.ts` (2), `-hop.test.ts` (2). The festival test gains the late-ground case (red before).

### Decisions

- The haze stays thin (0.35): the golden palette is already warm, so a stronger floor only washes the city out; a truly
  pumpkin-coloured sky downtown would need the sky / fog shaders (lane X / the lead) — a note under Requests.
- The hop is CPU-side with partial uploads, not a shader change: `world/materials.ts` / the TOY program are shared with
  the district (programs must not change).

## Commits (all on origin/opus-bay)

| commit | what |
|---|---|
| `652415ca` W8-H1 | the door-to-street check on all six treat streets (doors 9 / 36 / 46 gone, 38 moved); `halloween-doors.mts --fix` |
| `fc1151dd` W8-H2 | the big night's toast wording; the Halloween row in the fallback goals card |
| `904ddfc8` W8-H3 | the four new fixed BAYBAY lines for lane X |
| `c5b91f58` W8-H4 | report part a + one QA JPEG |
| `1df0ff90` W8-H5 | the procession: legs and stepping aside (player + BAYBAY), still 2 calls |
| `7d416d42` W8-H6 | the Chinatown Halloween Festival kit on Waverly Place (31 Oct 11:00–15:00, +1 call that day) |
| `f15eddbc` W8-H7 | the pelican's pumpkin bow (items append, neck slot, 248 triangles) |
| `d1e3abec` W8-H8 | the golden-hour haze floor beyond Karl's bank (uniform-only) |
| `10de0860` W8-H9 | the trick-or-treaters' hop (partial uploads, no new program / call) |
| W8-H10 | the festival kit rebuilt on the streamed ground |
| W8-H11 | this report's parts b and c and the final checks (docs only) |

## Final checks (22:37 – 22:57 PDT, the tree with W8-H1 … H9 on origin `10de0860` + W8-H10 in the working tree)

- `npx eslint .` **0 errors** (50 old warnings, the day-0 baseline) · `npx tsc -p tsconfig.app.json --noEmit` **0** ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1786 / 1786 (414 s)**.
- Lane H's wave-8 test files alone: 17 / 17 (doors 2, polish 2, lines 1, procession 2, festival 3, bow 3, dusk 2, hop 2).
- The dev server (5805) and every Chrome of this lane are stopped; scratch `C:/Users/willy/opus-qa/w8/h/` keeps the
  drivers (`drive.mjs`, `drive-png.mjs`, the door map / check scripts) and every capture named in this report.

## Not done

- The festival's line-up does not walk (a static line-up rocking on the sway); toy cars parked in Waverly Place stay
  (the parked-car layer is not lane H's).
- The phone's view of the parting is narrow (portrait, the QA camera): one walker with its legs passing beside the player,
  26 walkers, 62 calls / 221k on 390 × 844 dpr 3 mid (scratch `C:/Users/willy/opus-qa/w8/h/proc-phone/`, read); W8-I plays
  the season on the phone.
- The dusk haze is measurable but subtle; a stronger downtown dusk needs the sky shader (Requests).

## Requests

- **Lane X**: record the four W8-H lines (part a's table; `halloween/worldLines.ts` W8_WORLD_LINES, `halloween/lines.ts`
  W8_HALLOWEEN_LINES) into `data/sf/voiceW8.ts` — all four are said as bubbles with exactly these texts.
- **Lane X / the lead (optional)**: if a stronger pumpkin dusk downtown is wanted, the place is the sky's horizon colour
  in `world/environment.ts` (the Karl mix there is weighted to the western horizon only); `KarlState.goldenHaze` says
  when the season's dusk is on.
- **The site's editors (via the owner)**: the Chinatown Halloween Festival (31 Oct 2026, 11:00–15:00, Waverly Place,
  https://www.cycsf.org/chinatown-halloween-festival/) is still not in the planner catalog (lead §6); the game shows it
  from lane S's calendar row and this kit.

## Where a reviewer should look first

1. `src/opus-bay/halloween/treatDoors.ts` + `tests/opus-bay-w8-h-doorcheck.ts` — the door rule and the moved / gone doors
   (`?date=2026-10-31T19:30`, Sea Cliff Ave door 38 at (−580.2, 890.6)).
2. `src/opus-bay/halloween/worldFestival.ts` — `?date=2026-10-31T12:00` at Waverly Place (36, 149), phone and desktop.
3. `src/opus-bay/halloween/muertosWalkers.ts` — `?date=2026-11-02T19:10&time=night`, stand in the procession's lane on
   24th St.
4. `src/opus-bay/halloween/worldDress.ts` hop (Alamo Square, any season date) and `economy/wear.ts` / `costumeMesh.ts`
   (the bow on a glide, 鹈鹕南瓜领结 in the 小铺 in season).
