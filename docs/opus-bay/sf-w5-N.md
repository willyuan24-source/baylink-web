# Wave 5 · lane N · Navigation, map & travel

Worktree `C:/Users/willy/wt/w5-n` (branch `w5-n`), dev port 5502, scratch `C:/Users/willy/opus-qa/w5/w5-n/`. Plan
`sf-w5-plan.md` §4.5 (MF4, MF6, MF2 arrivals); rules `sf-w5-lead.md`.

## Part a (2026-09-28): W5-N1, W5-N2, W5-N3, W5-N5, W5-N6

### 给主人的摘要

1. 地图上点一个地方，大按钮直接写着「BAYBAY 带路 · 约 1 分钟」或「飞过去 · 约 7 秒」；点一下，地图关上，人马上自己走（远了自己跑），一段接一段，连到车站、骑车都不用再按。
2. 想自己走，碰一下摇杆（电脑按方向键）就接管；底下的小条变成「自动跟上 BAYBAY」，点一下又接着带。问 BAYBAY 菜单里也多了「带我去 · 目的地」。
3. 拿到鹈鹕后，超过一分钟的路默认「飞过去」，没去过的地方也能飞；落地时正对着那个景点，屏幕写「第一次来 · 艺术宫」。
4. 老玩家打开游戏，大按钮就是「继续旅程」，回到上次站的那个位置，BAYBAY 说欢迎回来；「从头开始 · 渡轮大厦」在下面，进度都保留。
5. 给其他线的接口都已推上（活动「带我去」、地图小旗插槽、手帐里的足迹页）。手机和电脑都实际打开截图看过，全部测试通过。
6. 进度：本部分 5 项完成并推送；手机地图的小卡片 / 长按「去这里」等（W5-N4）和安静 HUD（W5-N7）在 part b。

### What was built

**W5-N1 · the hooks (pushed first, `73dabe9`)**
- `game/goTo.ts` — `goTo(target: { placeId?, point?, name? }, opts?: { prefer?: 'fly' | 'ground'; source? }): Promise<GoToResult>`.
  Type imports only; the work is `game/goToRun.ts` (city chunk, loaded on the first call): resolves an attraction id, an
  SF landmark id (also `lm-…`), a place-index id (through the attraction that speaks for it, so the arrival moment and
  the flag agree with the map), `place:` / `sf:` prefixes, an interactable id, or a point (snapped to walkable ground,
  id `pt:<x>,<z>`, name 目的地); plans with the live providers, waits ≤ 0.9 s for the walking routes, closes the open
  panel and starts the trip. Result `{ ok: true, mode, seconds, placeId, name }` or `{ ok: false, why: 'district' |
  'busy' | 'unknown' | 'here' | 'no-way' }` (BAYBAY says 就在这里啦 / 这里暂时过不去 for the last two). Never throws.
  Callers: R (pennants, SF Today rows, EventCards), D (rumours), E (compass), C.
- `game/flags.ts` — `registerFlagSource(key, fn)` / `extraFlags(ctx)`; `fn({ player, target, phone })` returns
  `ExtraFlag { key, x, z, color, glyph?, h?, priority?, far? }`. `pickFlags` stands them right after the target, ahead
  of the panorama and T1 flags, at most half the slots (2 of the phone's 3, 3 of 6, 4 of 8), in view or within 150 u of
  the target, within their own `far` (≤ 3,000 u); role `'extra'` draws with the target's fades on the same InstancedMesh
  (no new draw call or program). `game/guideCity.ts` passes them at 4 Hz.
- `ui/Footprints.tsx` — `FootprintsTab({ embedded })` for lane E's notebook:
  `lazy(() => import('../ui/Footprints').then(m => ({ default: m.FootprintsTab })))`.

**W5-N2 · the planner after the pelican** (`game/tripPlan.ts`, `game/tripProviders.ts`, `game/guideCity.ts`)
- `flyUnlocked` provider (live: `glideUnlocked()`): 飞过去 is offered to every place, discovered or not, and is the 推荐
  whenever the fastest other way takes over `FLY_REC_AFTER_S` = 60 s. Before the unlock: discovered places only and
  never 推荐 while a ground way exists (unchanged). Flying still never completes a goal: the goal ways stay in the list
  with their note, the fly row carries `FLY_NOTE`.
- `autoPace` provider (live: true): trips carry the player, so on-foot legs are timed with `autoTravelSeconds(length)`
  (the controller's auto-walk: runs while > 30 u are left; equal to `travel.autoWalkSeconds`, tested) and there is no
  separate 跑过去 row.
- One ETA source: the pill and the waypoint (`tripSecondsLeft` / `legSecondsLeft`, new `LegPace { auto, rideEta }`)
  count a carried walk at the same pace and, aboard, lane T's `rideEta().rideLeft` (`liveRideEta`); walking by hand
  after a takeover they count walking pace (honest). The map pin (`ui/CityMap.tsx`) shows the 推荐 way and time when it
  is not a walk ("飞过去 约 7 秒"), as the card's button; `useTripOptions` is exported from `ui/PlaceActions.tsx` for it.

**W5-N3 · auto-travel** (`game/autoTravel.ts` new, `game/tripRun.ts`, `ui/GoChip.tsx` new, `ui/GuideLayer.tsx`)
- `autoStep` — the persistent-follow reducer (pure): issue the leg's on-foot target once; a held stick / WASD since the
  issue or a walk target that is not ours (a tap / click) = takeover (off, the trip goes on); blocked (dialogue, panel,
  cinematic, pelican, ride, not on foot) = wait; a new leg re-issues at once; a walk that stopped short retries after
  1.5 s, gives up after 3 (BAYBAY: 这段路有点难走，你来带路吧！); a moved target (a step-out done, a walkway's entry reached)
  re-issues without counting a fail.
- The trip runner carries trips from `map`, `card`, `call`, `panorama`, `free-lead`, `qa` (not `tour`): walk / run
  legs to their end (the GGB deck through its entry: brain `leadStep`), line legs to the boarding stop (the pre-filled
  boarding follows), bike / car legs to the parked vehicle with the interact id (mounted on arrival, then the autopilot
  drives), on from the alighting stop; a start inside a blocker steps out to the nearest walkable spot first. 结束 stops
  our walk (never a walk the player set). `resumeAutoTravel()` hands the walking back.
- The chip (in the lead chip's place, on every device): **BAYBAY 带路中 · 碰摇杆接管** (desktop 按方向键接管, pad
  推摇杆接管), a quiet status that lets taps through; after a takeover **自动跟上 BAYBAY** (touch at once, keyboard / pad
  once they stop steering). `.ob-go-chip` is in `HUD_BOX_SELECTOR` (the waypoint keeps off it).
- The 问 BAYBAY sheet: ask item `n-take-me` **带我去 · <destination>** (order 5) while a trip runs without auto-travel.
- The map's go button says the way and its time (`ui/tripRows.ts goButtonLabel`): 飞过去 · 约 7 秒 / BAYBAY 带路 · 约 1
  分钟 / 骑车 · 约 2 分钟 / 观光巴士 2 站 · …; on phones it is one big button on its own row (`ui/map-w4.css`; in one
  row it was cut to "飞过去 · 约 7 …").

**W5-N5 · the landing** (`game/fastTravel.ts`, `game/tripRun.ts`)
- The city arrival spot through `actors/nav arrivalSpot` was already in place (wave 4); the landing heading
  (`landingHeading`) now faces the most open ground (lane F's `actors/faceOpen openHeading`; the place heading or the
  travel way on ties) and the follow camera swings in behind the player after the landing (`faceOpen`).
- A flight to an attraction not found yet is its first sight (`firstSight(t)` → `TravelDest.look`): the player lands
  facing the landmark, the descent camera (`descentShot`) ends a little further back with it ahead, the caption says
  **第一次来 · 名称**; the landing is the discovery (the discovery tick and lane C's arrival follow).
- Lane L's `data/sf/siteArrivals.ts` wiring (29 trip ends out of blockers / driven lanes / off-graph spots) is done and
  tested but **parked** on the local branch `w5-n-site-arrivals` (`fd93f12`): lane E's coin placement and lane L's route
  table pin the old arrivals (Requests below). It pushes as soon as they adapt.

**W5-N6 · title resume** (`ui/TitleScreen.tsx`, `game/resume.ts`)
- With a saved city spot the primary button is **继续旅程** and resumes there (Enter too); **从头开始 · 渡轮大厦** is the
  secondary (the arrival at the Ferry Building; progress kept); the greeting says 欢迎回来！接着逛吗？. District mode is
  unchanged (no city spot there).
- `resumePlace`: the saved spot itself when standable (the sampler saved it standing), else the arrival rule; no toast
  on top — lane C's `beginPlaying('local')` → `welcomeBack()` names the area (欢迎回来！上次我们走到…了。; its bubble had
  already gone by my 15 s shots, so the words are C's code, not seen here).

### Evidence

- Commits on `origin/opus-bay`: `73dabe9` (N1), the N6, N2 / N3 / N5 and hook-wiring commits of this part (hashes in
  the structured output; rebased on `069a8a4`).
- Checks on the pushed head: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings
  outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` fail 0 (see the
  structured output for the count). New / changed tests: `tests/opus-bay-w5-nav.test.ts` (30: goTo resolution, choice,
  sources, the hook's size; flag sources, caps, cone, far, priority, the flag shader's one colour declaration; the pace
  = autoWalkSeconds; fly after the unlock / never before / never a goal; autoPace rows; the four ETA displays within
  10 %; T's ride ETA; the reducer (issue, takeover by stick and by tap, blocked, legs, retries, give-up, step-out, the
  bike's interact); the runner (map trip carried at once and leg after leg, the tour not; takeover, the ask item,
  resume, 结束 vs a player's walk; a panel pauses it; step-out; the GGB entry); the go button's words; the landing
  heading, the descent shot, first sights; resumePlace, the title with / without a spot and in the district,
  startOrResume), `tests/opus-bay-sf-map-int.test.ts` (the go button's words).
- The real game on 5502 (Chrome 153 headless, RTX flag; zh-Hans), images in `docs/opus-bay/qa/w5/N/`:
  - `n3-desktop-go-button.jpg` (1440 × 900): Coit Tower's card, **BAYBAY 带路 · 约 1 分钟**; tap → `trip coit-tower walk`,
    `running: true`, walk target Coit, chip **BAYBAY 带路中 · 按方向键接管** (`n3-desktop-carried-chip.jpg`: pill 下一站
    科伊特塔 约 1 分钟, waypoint 约 55 秒); W for 0.7 s → carried off, trip on, chip **自动跟上 BAYBAY**
    (`n3-desktop-takeover.jpg`).
  - `n3-desktop-ask-take-me.jpg`: after S as a takeover, Q → the sheet lists **6 带我去 · 科伊特塔**; picked → carried again.
  - `n1-desktop-goto.jpg`: `goTo({ placeId: 'painted-ladies' })` from the console → `{ ok: true, mode: 'walk', seconds:
    100.7, placeId: 'alamo-square-painted-ladies' }`; pill 约 2 分钟, waypoint 约 2 分钟, BAYBAY 跟我来！去彩绘女士（明信片排屋）;
    `goTo({ placeId: 'no-such-place' })` → `{ ok: false, why: 'unknown' }`.
  - `n2-phone-fly-button.jpg` (390 × 844 dpr 3, pelican unlocked): the Palace of Fine Arts card, one big **飞过去 · 约 7 秒**
    (undiscovered); `n5-phone-first-sight.jpg`: the descent opens on the Palace with **第一次来 · 艺术宫**; landed at
    (−409.9, 409.9), walkable, arrival card and BAYBAY's line after.
  - `n3-phone-carried-chip.jpg`: carried to Coit, **BAYBAY 带路中 · 碰摇杆接管** clear of 跳 and the bottom bar; the gold
    target flag draws.
  - `n6-desktop-title.jpg`, `n6-phone-title.jpg`: 继续旅程 (primary) + 从头开始 · 渡轮大厦; `n6-desktop-resumed.jpg`: back at
    the saved spot (−12, 575) in 阿拉莫广场 · Fulton Street (desktop and phone both returned the exact spot).
- Found on the way: W5-V4's 512² atlas broke the flag program (`float col` shadowed the pennant's `vec3 col`: no flag
  drew). Fixed here and, at the same time, by the lead (`4fb3e6e`, acol / arow): the lead's version stands; my
  regression test (the colour declared once) stays.

### Decisions

- **Auto-travel is the rule, the pace follows it.** The walk row is timed at the auto-walk's pace (≈ 7.5 u/s over long
  walks) and the separate run row goes (it would say the same thing). A player who takes over sees walking time.
- **Tours are not carried** (`AUTO_SOURCES` without `'tour'`): the Grand Tour is lane C's paced walk with its own chip.
  One word in `tripRun.ts` changes it if C wants it.
- **The chip lives in the lead chip's place**, not inside the trip pill: the pill keeps the time (one ETA), the chip says
  who steers; it is a status (taps pass through: a tap on the ground is a takeover anyway).
- **从头开始 · 渡轮大厦**: the plan's 从头开始 with where it starts, so nobody reads it as "wipe my progress".
- **Setting pathTarget directly** from the trip runner (the same object the reducer holds) is how a takeover is told
  from our own walk; `walkTo` would copy the point.
- **The first sight faces the landmark** even where the open-ground rule would face elsewhere (the landing spot is an
  open area within 30 u already); other landings face the open ground.
- **The hooks I first added as registration seams** (`setLandingFacer`, `registerRideEta`) went again once F and T
  pushed plain modules (`faceOpen`, `rideEta`): N imports them directly.

### Known gaps

- After a flight to a T1 place lane C's arrival still plays the 2.4 s on-foot reveal (the landing counts as on foot):
  Request to C. The first-sight descent plays before it.
- The call menu's 带我去下一个目标 · 约 50 秒 (lane C) times a straight walk; the carried trip says 约 1 分钟: Request.
- The dev-server probes after HMR saw a second copy of an edited module (my console `import()` of `autoTravel.ts` read
  `false` while the app's chip showed 带路中); the app itself is one graph. Fresh builds are not affected.
- The flag program links a second variant (render target, `srgb`) the first time the map sheet opens: pre-existing,
  Request to V.

### Not done (part b)

- W5-N4 (phone map: compact pinned card, cluster chooser, long-press → 去这里, search results with the go button), W5-N7
  (quiet HUD: the discovery batch, toasts for attractions only — the Ferry start still stacks 抵达 + 发现新地点, one
  waypoint owner, the district lesson list, the 金门大桥 chip, the routed P items), W5-N8 (event pennants first on
  phones with V's new glyphs), W5-N9, W5-N10.
- The site-arrivals push (waits on E and L), a live check of the aboard ETA with T's `rideEta` on a real ride.
- No real-world fact was added in this part (nothing to source).

### Requests

- **C** (`game/cityMoments.ts`, the arrival sampler): treat a fast-travel landing like a hop-off for the grace window,
  so a flight never gets the on-foot reveal (plan MF4: "a descent beat instead of the on-foot reveal"): in the event
  listener next to `vehicle:exit`, `else if (e.type === 'travel' && e.what === 'land') hoppedOffAt = performance.now();`.
- **C** (`game/flow.ts openCallMenu`): the 带我去下一个目标 label's time — the trip it starts is carried, so
  `timeLabel(autoTravelSeconds(dist × STREET_FACTOR))` (both exported by `game/tripPlan.ts`) instead of `gameTimeLabel`.
- **C** (optional): tour legs carried too → add `'tour'` to `AUTO_SOURCES` in `game/tripRun.ts` (tell N; N's file).
- **E** (coin placement): five spots sit < 3 u from the site arrivals N will wire (`scripts/opus-sf/coins-place.mts`,
  `tests/opus-bay-w5-coins.test.ts`): trail buena-vista-park #5 (29.4, 734.9) and #6 (29.9, 738.4), trail bison-paddock
  #1 (−463.7, 1218.6), trail stop-haight #1 (−39.4, 760), cache sutro-heights-top — against the new arrivals of
  `data/sf/siteArrivals.ts` (buena-vista-park 29.62, 736.62 · bison-paddock −464.9, 1220 · haight-ashbury −42.2, 760.64
  · sutro-heights-park −687.16, 1254.64). Please move them; then N pushes `w5-n-site-arrivals`.
- **L** (`data/sf/routes.ts`): route stop `r3-bison` at the bison paddock's site arrival (−464.9, 1220) —
  `tests/opus-bay-sf-routes.test.ts` "D2-11" pins stops at their attraction's arrival; with the site arrivals wired it
  fails there. N pushes the wiring once this lands (or together, tell N).
- **V**: the flag program's render-target variant (`outputColorSpace` srgb, the map sheet's background pass) links the
  first time the map opens (seen with `renderer.info.programs` on 5502: `ob-flags` srgb-linear, then srgb after
  `openMapOn`): warm that variant too.
- **R / D / E** (how to use the hooks): `import { goTo } from '../game/goTo'` (tiny; `goTo({ placeId })`,
  `goTo({ point, name })`, `{ prefer: 'fly' | 'ground', source: 'realsf:today' }`); `registerFlagSource('realsf', ctx =>
  [...])` from your feature's `init()` (colour hex, glyph one of `FLAG_GLYPHS` incl. V's Coins / CalendarDays / Sparkles
  / Music, keep the list short: ≤ 4 Hz); `FootprintsTab` as above.
- **Lead**: none frozen.
