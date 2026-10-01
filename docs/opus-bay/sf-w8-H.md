# Wave 8 · lane H · Halloween live polish

Lane H of wave 8 (`docs/opus-bay/sf-w8-lead.md` §3, run inside the Ultra workflow): worktree `C:/Users/willy/wt/w8-h`
(branch `w8-h`), dev port 5805, scratch `C:/Users/willy/opus-qa/w8/h/`, QA images `docs/opus-bay/qa/w8/H/`. The season
goes live by itself at 00:00 on 1 October (`halloween/season.ts`, frozen).

## 给主人的摘要

1. 万圣节从 10/1 到 11/2 每个关键日子都在手机（390 × 844）和电脑上实际玩过：10/1 讨糖、10/17 Sunnydale 南瓜节、10/24 Thrive City、10/31 大夜晚、11/1 亡灵节前夜、11/2 游行，零点自动开季也看过（不用刷新页面）。
2. **讨糖的门**：六条讨糖街全部检查了一遍（上一波只查了 Belvedere 街）。有 4 扇门有问题——3 扇在院子里或房子后面、从街上走不过去，1 扇其实是隔壁 29 大道的房子——1 扇搬到了同一条街的正门上，3 扇撤掉（编号都不变，存档不受影响）。现在 50 扇门每一扇都能从自己那条街走到。
3. 10/31 大夜晚的提示更清楚：敲过的门显示「万圣夜糖果加倍 ×2」，没敲过的新门显示「新门 + 万圣夜加倍 ×3」（以前都写「双倍糖果」，看到 ×3 会糊涂）。
4. 备用的目标卡片（目标页加载失败时才出现）也有了「🎃 万圣节目标」一行。
5. BAYBAY 的 4 句新台词（唐人街万圣节庆典 2 句、游行绕开玩家 1 句、鹈鹕南瓜领结 1 句）已推送，X 线可以录音。

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
