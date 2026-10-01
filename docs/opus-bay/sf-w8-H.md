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
| `4b700a4e` W8-H10 | the festival kit rebuilt on the streamed ground |
| `8ba22115` W8-H11 | this report's parts b and c and the final checks (docs only) |

## Final checks (22:37 – 22:57 PDT, the tree with W8-H1 … H9 on origin `10de0860` + W8-H10 in the working tree)

- `npx eslint .` **0 errors** (50 old warnings, the day-0 baseline) · `npx tsc -p tsconfig.app.json --noEmit` **0** ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1786 / 1786 (414 s)**.
- Lane H's wave-8 test files alone: 17 / 17 (doors 2, polish 2, lines 1, procession 2, festival 3, bow 3, dusk 2, hop 2).
- The dev server (5805) and every Chrome of this lane are stopped; scratch `C:/Users/willy/opus-qa/w8/h/` keeps the
  drivers (`drive.mjs`, `drive-png.mjs`, the door map / check scripts) and every capture named in this report.

After the last rebase (onto lanes K / M / W1 / X, 23:00): tsc 0; the incoming test files with lane H's 46 / 46.

## Not done

- The festival's line-up does not walk (a static line-up rocking on the sway); toy cars parked in Waverly Place stay
  (the parked-car layer is not lane H's).
- The phone's view of the parting is narrow (portrait, the QA camera): one walker with its legs passing beside the player,
  26 walkers, 62 calls / 221k on 390 × 844 dpr 3 mid (scratch `C:/Users/willy/opus-qa/w8/h/proc-phone/`, read); W8-I plays
  the season on the phone.
- The dusk haze is measurable but subtle; a stronger downtown dusk needs the sky shader (Requests).

## Requests

- **Lane X**: the four W8-H lines (part a's table) — **done by lane X already**: `data/sf/voiceW8.ts` on origin carries
  w8-h-chinatown-contest, w8-h-chinatown-lanterns, w8-h-procession-aside and w8h-costume-pumpkin-bow (checked 23:01).
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

## Review (Ultra)

Fixer of the Ultra review of lane H (two read-only lenses — code & facts, player — then this pass), 30 Sep 23:44 – 1 Oct
01:00 PDT; worktree `C:/Users/willy/wt/w8-h-rev` (branch `w8-h-rev`), dev port 5845, scratch
`C:/Users/willy/opus-qa/w8/h-rev/`.

### 给主人的摘要

1. 两组审查共提出 10 条问题，我收到其中 9 条（第 10 条在转交时被截断，没看到内容），9 条全部独立复现、全部确认、全部修好。
2. **讨糖的门**：又发现 6 扇门放得不对——4 扇藏在邻居房子后面（要绕一大圈才能走到街上），1 扇对着两栋房子之间的窄缝，1 扇其实是 25 大道街角的房子。规则加严后这 6 扇撤掉（编号不变、存档不受影响），现在 44 扇门，每条街至少 6 扇。
3. **亡灵节游行**：玩家站在队伍一侧时，同一排的两个小人会挤成一个——已修好，两人一起让路；骑鹈鹕从队伍上空飞过时队伍不再“让路”，BAYBAY 也不会在天上或开车时说“我们站到路边吧”。
4. 南瓜领结在英文手机商店里显示成「Pumpkin …」，改成「Bow tie」（完整名字不变）。另外自己查出一个小隐患：讨糖小朋友跳一跳时，画面外的更新记录会越积越多，已加上上限。
5. 最终检查全绿，没有阻碍上线的问题。

### What was checked

Every finding was reproduced on the current tree before any change (scripts in scratch: `doormetrics.mts` — walk,
straight distance, detour, the roadway straight out of every door; `doorascii.mts` — the walk raster round a door;
`overlap.mts` — the lens's walker overlap sim; `fastcand.mts` — the free faces near a failing door). Then my own pass
over W8-H1 … H12: the festival kit (2 Hz, dropped off its day / hours / range, disposed with the world), the dusk haze
(uniform-only, the Halloween world only), the hop (per-frame partial uploads), the toast wording, the bow (wear / save
index append-only), the BAYBAY lines (lane X recorded all four), district mode (the hero regression test in the suite).

### Findings and verdicts

| id | lens | verdict | evidence / what changed |
|---|---|---|---|
| H-code-1 (major) | code | **fixed** | Reproduced: doors 3 / 21 / 47 / 48 reach their street only by a 10.8 / 12.8 / 6.5 / 11.6 u walk for 1.5 / 2.4 / 2.2 / 2.4 u straight (every other live door ≤ 2.8 u of detour); the rasters show a neighbour's house between door and street. New rule `DETOUR_MAX` 3.5 u (walk − straight) in `tests/opus-bay-w8-h-doorcheck.ts`; no free face of the same street within 80 u passes (`fastcand.mts`: every other face is a door or within 2.8 u of one), so the four are `gone` (numbers kept). Red: `doors-red.txt` (6 doors); green after. |
| H-code-2 | code | **fixed** | Confirmed: the test name / header promised a straight standable ray to the kerb within FRONT_MAX; the code checked a ≤ 18 u walk, FRONT_MAX / SQUARE_MIN were dead. The header now states the real rule (fronts / faces / walk / detour / roadway straight out) and why a straight standable ray is not used (porches, stoops and parked cars at the kerb block it for doors plainly reachable); FRONT_MAX removed, SQUARE_MIN used in the fronts loop; the test's name says what it checks. |
| H-code-3 | code | **fixed** | Confirmed: door 38's moved spot is 3.0 u from 25th Ave, 5.7 from Sea Cliff Ave; straight out of it the first roadway (3.5 u) is nearest 25th Avenue. New rule `RAY_MAX` / `CORNER_GAP`: the roadway straight out of a door must not be a cross street's corner nearer the door than its own street by > 2 u — door 38 fails it alone (door 40 at the 27th Ave corner is a tie, 2.21 vs 2.22, and passes). Its two other free faces within 80 u face a gap between houses: `gone`. |
| H-code-4 | code | **fixed** | Reproduced with the lens's sim: player 0.5 u beside a file → two walkers 0.140 u apart (0.308 u without the player). `muertosWalkers.ts`: the wanted slides are computed first, then the two walkers of a row part as a pair (the one stepping round someone harder keeps its place, its row-mate makes room `ASIDE.pair` 0.6 u beyond it, on its own side; clamp `ASIDE.max`); no per-frame allocation (a preallocated `wants` array, `sOf` / `latOf` hoisted). After: 0.308 u at every offset (−0.9 … +0.9), walker-to-player ≥ 0.97 u unchanged. Test: `tests/opus-bay-w8-h-review.test.ts` (red 0.140 before). |
| H-code-5 | code | **fixed** | Confirmed in code and by a red test: `muertos.ts` passed the player's x / z whatever the mode; `near()` offered the aside line whenever `aside()`. Now the walkers part only round someone on the street (`processionParts()` = foot / sit / bike / car, not gliding) and BAYBAY's line only on foot (`asideLineFits()` = foot / sit, not gliding); BAYBAY's own position is passed only then (she rides the pelican). Test: glide → no line, foot → line, toy car → they part but no line, glide again → back in their files. |
| H-RP-1 | player | **fixed** | Same door as H-code-3 (the knock prompt 'A house on Sea Cliff Ave' under the chip 'Seacliff · 25th Avenue'): door 38 gone. |
| H-RP-2 | player | **fixed** | Confirmed (the lens's `d20-top.jpg` read: the knock spot in a slot between two houses): straight out of door 20 there is no roadway within 6 u (`RAY_MAX`; the first is Guerrero St at 15 u). No free Fair Oaks face within 80 u passes: `gone`. |
| H-RP-3 | player | **fixed** | Confirmed (the lens's `s4-wear.jpg` read: 'Pumpkin …'; the tile's label holds ≈ 66 css px of 13 px bold). The English tile label is now 'Bow tie' (the full name stays 'Pelican pumpkin bow', zh 南瓜领结 unchanged); the bow test asserts ≤ 9 characters (red with 'Pumpkin bow'). Phone check: see Evidence. |
| H-RP-4 | player | **fixed** | The same defect as H-code-5 (found by reading; reproduced by the new test): fixed with it. |
| (10th item) | — | not received | The relayed list of the two lenses was cut off after H-RP-4's repro; the tenth item's text never reached the fixer, so it was neither verified nor fixed (open item). |

### Own findings

| id | verdict | what |
|---|---|---|
| H-rev-1 | **fixed** | `worldDress.ts stepHops` added an update range per hopping child per frame; three.js clears them only when it uploads, so while the stoops' mesh is not drawn (culled, the group hidden) they piled up without bound (≈ 1–2 a frame, ≈ 5,000 a minute) and the next upload sorted them all. Past `HOP_RANGES_MAX` (64) they now collapse into one range over every child (correct: it covers every cleared range). Test: ten minutes at 60 fps without an upload → ≤ 64 + n pending, every child covered. |
| H-rev-2 | open (not a blocker) | Doors 22 and 26 (Fair Oaks) face a neighbour's wall 1–2 u straight out (`doorascii.mts` rasters) but reach their street with a 2.8 / 2.4 u detour, under the new 3.5 u rule; there is no free face to move them to. |
| H-rev-3 | open (not a blocker) | Belvedere doors 4–7 are nearer a cross street's centreline (Rivoli / Alma / Grattan, 2.6–3.0 u) than Belvedere's (5.4 u), beside the door rather than in front (W7-G accepted them); the place chip at door 5 reads Alma Street. |

### Evidence

- Doors: `C:/Users/willy/opus-qa/w8/h-rev/doormetrics.txt` (all 54: walk, straight, detour, the roadway straight out),
  `doors-red.txt` (the strengthened test on the old doors: the six), `fastcand.txt` (the free faces near each), `fix1.txt`
  (`halloween-doors.mts --fix` with the new rule: the same six, no candidate within 30 u).
- Walkers: `overlap.mts` output before / after (0.140 → 0.308 u). In the game (dev 5845, desktop high,
  `?date=2026-11-02T19:10&time=night`, the player 0.55 u beside a file six rows behind the head): the column passes on
  both sides of the player and BAYBAY; 106 calls / 345k triangles there (`proc/p1-beside-file.jpg`, `p2-later.jpg`, read —
  dark and from above, so the numbers in the test are the proof).
- The bow: phone 390 × 844 dpr 3, `lang=en`, 15 Oct 12:00, the shop's Rides shelf — 'Bat wings | Bow tie | Ribbon |
  Maroon', the label 48 px wide and not cut (`ui/s1-shop-rides.jpg`, read; `s2-tiles` measures every tile).

### Checks

- On the tree with W8-H-review 1–3 (rebased on `017fe6ee`) plus the hop cap: `npx tsc -p tsconfig.app.json --noEmit` 0 ·
  `npx eslint . --quiet` 0 errors · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1814 pass,
  0 fail, 1 todo** (lane P's GameRoot ≤ 255 KB target, a known todo) of 1815 (622 s).
- After the last rebase (onto lanes A / K / S reviews, `12366546`): tsc 0; the incoming test files with lane H's 40 / 40.
  Pushed 00:49 PDT (`44097f1a` … `24699c7c`).

### Commits

| commit | what |
|---|---|
| `44097f1a` W8-H-review | the door rule asks for the way out of the door (DETOUR_MAX, RAY_MAX, CORNER_GAP); doors 3 / 20 / 21 / 38 / 47 / 48 gone; the test's name and docs match the rule (H-code-1, H-code-2, H-code-3, H-RP-1, H-RP-2) |
| `0e5ef9b5` W8-H-review | the procession's row parts as a pair; the walkers part only round someone on the street, the sidewalk line only on foot (H-code-4, H-code-5, H-RP-4) |
| `995efcf0` W8-H-review | the bow's English shop tile says 'Bow tie' (H-RP-3) |
| `24699c7c` W8-H-review | the hop's pending upload ranges stay bounded (H-rev-1) |

### Open items

- The tenth item of the two lenses' list was not received (the relay cut it off); whoever holds the lens outputs should
  check it against this table.
- Doors 22 / 26 face a neighbour's wall straight out (H-rev-2) and Belvedere doors 4–7 sit nearer a cross street
  (H-rev-3): reachable, not blockers; a better spot needs new faces (none free today).
- 44 live doors now (Belvedere 6, Chenery 10, Fair Oaks 7, Jordan 7, Sea Cliff 8, Hearst 6); the season's goal asks for
  5 doors (progress.ts GOAL_DOORS), so nothing else moves.
- Not lane H's: on the phone the Rides shelf's 'Int’l Orange' tile label overflows its tile (`s2-tiles`: its text wider
  than the label box, the only one of nine) — the same kind as H-RP-3, for the lane that owns that item.

### Blocking the go-live to main

Nothing. The door changes only take doors away (numbers kept: a door knocked on main before the merge stays paid); the
walker and hop changes are inside lane H's own files; district mode is untouched (its hero regression test is in the
green suite).
