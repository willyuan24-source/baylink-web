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

## Part b (2026-09-28): W5-N4, W5-N7, W5-N8 (+ MF2 trip ends and landings for lane F's sweep)

### 给主人的摘要

1. 手机地图：点一个地方，地图下沿直接浮出一张小卡片和大按钮（「BAYBAY 带路 · 约 1 分钟」或拿到鹈鹕后「飞过去 · 约 7 秒」），再点一下就出发——从打开地图到开始走，最多两下。
2. 叠在一起的「+2」图标，点一下会列出这几个地方，每行都有出发按钮；长按地图任意位置会插一面小旗「去这里」；搜索结果每一行也带出发按钮。
3. 画面安静了：路上顺路经过的地方不再一个个弹提示，只在左上角显示「+3 个地点」；从渡轮大厦走到科伊特塔，以前一路会弹很多次（计划里的试玩记录是 50 秒 12 次），现在只有 2 次（到达科伊特塔、解锁鹈鹕）。走上金门大桥桥面，左上角会写「金门大桥」。
4. 地图多了「这周」按钮：这周的真实活动（比如 10/3 金门公园的免费蓝草音乐节）在场地上显示小日历，点开能直接出发或看活动介绍；手机上活动小旗优先插在你附近和目的地附近。
5. 顺手修了几处「到了却走不动」的终点：九曲花街、苏特罗浴场、39 号码头、格林威治台阶、海德街码头，以及 L 线整理的 23 处景点到达点；飞到 Fort Point 不会再落到头顶的大桥上。自动检查从 12 处卡住降到 3 处（Fort Point 门口要 L 线改场地、野牛围场等 5 处等 E 线挪金币后接上、奥布莱恩号还没找到好位置）。
6. 进度：本部分全部推送；手机（390 × 844、375 × 667）和电脑都实际打开看过；全部测试通过。

### What was built

**W5-N4 · the phone map (MF4 "Phone map"; at most two taps from the open map to moving)**
- `ui/mapGo.ts` (new, pure): the pinned card's box and its go button (`goCardBox` / `goButtonBox`, `GO_CARD`: 8 px inset,
  10 padding, a two-line head — one line on a frame under 340 px, the 375 × 667 phone —, 48 px go button, 44 px 其他方式),
  `toolsMaxHeight` (the tool column stops above the card and wraps into a second column), `panForCard` / `chooserHeight`
  (a tapped place, the "+n" badge, a pressed spot or an event pin is moved clear of the card: 46 px above it, for its label
  and the lifted OSM credit), `pressSpot` (long-press → the nearest walkable arrival spot: the point itself when
  standable; on a loaded chunk the nearest standable spot within 30 u; on a chunk not loaded the walking graph's nearest
  node within 60 u, else a place arrival within 60 u, else the point on land; the sea → nothing) and its name (科伊特塔附近 /
  the area / 这里), `PRESS` (0.52 s, 8 px), `pressPlaceId` (= goTo's `pt:` rule, tested equal).
- `ui/MapGoCard.tsx` (new): `MapGoCard` (title, meta, one big go button with the way and the time — the planner's 推荐,
  the same option the full card takes —, ⌄ 其他方式 opens the full card under the map with its list open and scrolls to
  it, ✕), `ClusterChooser` (这里有 3 个地方 · 放大看看 · ✕; a row per place: its name selects it, its go button goes),
  `RowGo` (the small go button: the way's icon + 约 7 秒; the pelican's is blue), `useQuickWays` (the 推荐 of several
  places at once; the first rows ask for their routes once the list settles for 350 ms — the chooser all of them, the
  search the first 3 —, the rest answer from the route cache: `game/tripProviders.ts peekTripProviders`), `goQuick`
  (through `goTo()`, source `map`: planned again with the routes, carried at once).
- `ui/CityMap.tsx`: a map frame ≤ 520 px wide (phones, and the desktop side sheet, which is 484 px) pins the selection's
  card over the map and opens the chooser for a "+n" badge (the desktop's wider frames keep the wave-4 zoom); long-press
  (and a right-click) anywhere drops the gold pin and the 去这里 card on every device; the tool column and the credit make
  room; the full card under the map (`PlaceActions hideGo`) keeps 其他方式 · 详情 · Maps · 步行路线.
- `ui/CityMapList.tsx`: the first 8 search results (attractions, places, stations) carry the go button (their row time
  goes: the button says it); `ui/mapListData.ts listWalkSeconds` at the carried pace (the list's times now match the
  card's go button before its route lands: one ETA source).

**W5-N7 · the quiet HUD (MF6)**
- Finds batch into one chip under the area pill (`ui/GuideLayer.tsx FoundChipView`, `ui/guide-ui.css .ob-found-chip`):
  "+1 · 格林威治台阶", then "+3 个地点" while more come (4.5 s after the last), one soft stamp per chip. `game/discovery.ts
  setDiscoveryAnnouncer` hands the finds to the city guide (`game/guideCity.ts announceFinds`: `chipFinds` leaves out a
  T1 / T2 attraction's place while on foot — its arrival moment says it); without the guide chunk the wave-3 toast stays.
  `game/hudLayout.ts` keeps the waypoint off the chip.
- An attraction passed on a trip's way goes quiet (`arrivalPassBy`): no gold toast, no peek card, no reveal camera
  swinging away mid-walk — the chip names it and BAYBAY's line still says it; the trip's own end (or anything within
  40 u of it) keeps its whole moment.
- One waypoint owner: the running trip's leg, else the map target, else the soft goal hint (the hint waits during a trip)
  — already the rule (`game/trips.ts pickObjective`, `game/waypoint.ts freeHintSuppressed`), now tested here.
- The area chip says 金门大桥 on the deck: `data/cityZones.ts LANDMARK_SPANS` (the brain's GGB walkway): `cityAreaAt(x,
  z, y?)` and `landmarkAreaAt` over the water (from a quarter of the way on), and with a height anywhere on the deck;
  never at Fort Point under it; `zoneName('golden-gate-bridge')` for the welcome back.
- The routed P items were already in: the Queen Wilhelmina row's zh name (`data/sf/extraPlaces.ts`), `SF_ROUTES` on
  the map (wave 4, W4-P-I7). The district's 湾区第一课 list in the Journal is lane C's file: Request.

**W5-N8 · flags and the map's 这周**
- `game/flags.ts pickFlags({ phone })`: on a phone a source's pennant stands only within `EXTRA_PHONE_NEAR` 600 u of the
  player, or near the waypoint (150 u, then up to its own far); the waypoint's own first, then priority, then nearer; at
  most half the slots as before. `extraGlyph` (V's Coins / CalendarDays / Sparkles / Music; an unknown glyph → the pin),
  a bad colour → `EXTRA_FALLBACK_COLOR`. The Settings toggle (显示地标旗) is unchanged. Lane R's source (`realsf`,
  priority 2 near the player / waypoint, far 1,600) fits the rule as it is.
- The map's 这周 (plan §3.3 R2, "DOM badges"): `ui/mapEvents.ts` reads lane R's `realsf/events.ts weekEvents(bayNow(), 7)`
  through a dynamic import (the realsf chunk the city already loaded; never GameRoot's graph), one coral calendar pin per
  venue (the live ones pulse, "3" when a venue holds several), `whenLabel` in Bay time (进行中 · 到 19:00 / 今天 11:00–19:00
  / 明天 … / 10/6 周二 …). Under 全部 today's events show (on by default while one is live); the 这周 N chip right after 全部
  shows the week and dims the rest (a remembered 这周 with no event this week is 全部). A pin tap pins its card: the event,
  when · where, the go button (to the venue), ⓘ the event card (`openEvent`: 官网 · 加入想去). Labels keep off the pins.

**MF2 · the trip ends lane F's sweep found stuck (Requests to N in `sf-w5-F.md`)**
- `data/sf/attractions.ts ARRIVAL_OVERRIDES`: Lombard St (T1, BOXED in Lombard St's lane → the pavement at the crooked
  block's foot), the Sutro Baths (T1, SNAG → the ruins' overlook path), PIER 39 (T2, OFF: the anchor was in The
  Embarcadero's roadway → the pier's gate plaza), the Greenwich Steps (T3, BOXED → the landing by the top step), the Hyde
  Street Pier (T3, UNREACHABLE → the pier's gate): each found with the sweep's own judge (a scratch search over rings of
  candidates: standable, three of four 1.5 s pushes move ≥ 3 u, a nav path from the main graph ends on it, off every driven
  carriageway, ≤ 3 u from a graph node — Lombard ≤ 6 u), heading toward the landmark, and looked at in the game.
- Lane L's `data/sf/siteArrivals.ts` (the parked `w5-n-site-arrivals` branch): 23 of its 29 trip ends wired
  (`siteArrivalFor`); `SITE_ARRIVALS_WAITING` names the other six and why (five wait for lane E's coin spots / lane L's
  route stop; Irving St's new spot is BOXED where the old one is a corridor).
- `game/fastTravel.ts arrivalSpot`: the open area nav finds within 30 u is taken only within `LEVEL_STEP` 4 u of the
  place's own ground — Fort Point's door lies under the Golden Gate's approach and the landing went onto the deck, 15 u up.
- Fort Point's own end stays at the door (the moment: 抬头！金门大桥就在头顶): every open spot within 25 u is the deck above
  or out of the fort's sight; its apron is lane L's site record (Request).

### Evidence

- Commits on `origin/opus-bay`: `de13ff3` (N4), `e4c17c0` (N7 / N8), `af8f50f` (N8 这周), then three W5-N5 (MF2)
  commits (the trip ends, the site arrivals, the landing level) and this report (their hashes after the last rebase: the
  structured output).
- Checks on the pushed head: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings
  outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1,158 / 1,158** (on
  the base with lane L's `e889335`; before it, a run at 06:40 PT failed only lane L's two fire-ring tests, which read the
  real Bay clock — the same failures on `origin/opus-bay` without my commits, checked in a scratch worktree — and the run
  at 05:15 PT passed 1,118 / 1,118). `tests/opus-bay-w5-nav.test.ts` 30 → 46: the card never hides its go button in the 352 × 388 and
  337 × 307 frames (clear of the tools and the compass), the pan, long-press spots (standable / snapped / graph / place /
  land / the sea) and names, the quick rows start no search, the list pace, the card and chooser markup; the find chip, the
  announcer, the 金门大桥 deck area (and not at Fort Point), the objective owner, pass-by moments; phone pennants, the
  glyph cells, the 这周 pins on 2026-10-03 data; the landing level. `sf-map-w4` (the 9th filter, its chip only with events),
  `sf-attractions` / `sf-places` / `sf-tripflow` (the moved ends and the site arrivals).
- Lane F's static sweep (`scripts/opus-sf/qa/sweep-static.mts --only trip-end,arrival`, 158 targets): 12 stuck
  (2 OFF, 6 BOXED, 2 SNAG, 2 UNREACHABLE) → 3 (Fort Point BOXED, the bison paddock OFF — waiting —, SS Jeremiah O'Brien
  UNREACHABLE). Output `C:/Users/willy/opus-qa/w5/w5-n/sweep4/static.json`.
- The real game on 5502 (Chrome 153 headless, RTX flag, zh-Hans; phone 390 × 844 dpr 3 with touch events, 375 × 667,
  desktop 1440 × 900), images in `docs/opus-bay/qa/w5/N/`:
  - `n4-phone-chooser.jpg`: 地图 (tap 0) → the Coit "+2" badge (tap 1) → 这里有 3 个地方 with 科伊特塔 约 1 分钟 · 电报山 约 55 秒 ·
    格林威治台阶 约 50 秒 (routed), the badge above it; its go (tap 2) → `n4-phone-moving.jpg`: trip coit-tower walk, source map,
    carried at once, pill 下一站 科伊特塔 约 1 分钟 (the same time as the row).
  - `n4-phone-card.jpg`: the 探索馆 badge → the pinned card 探索馆（15 号码头）· 金融区 · 南滩 · BAYBAY 带路 · 约 25 秒, go button
    at (20, 320) 262 × 48 in the 352 × 388 frame, in view; the card under the map without its go (其他方式 · ⓘ · ↗); go → moving.
    `n4-phone-card-375.jpg`: the one-line head on the 375 × 667 phone (337 × 307 frame), the tools in two columns above it.
  - `n4-phone-longpress.jpg`: a 0.8 s press on the map → the gold pin and 去这里 · 城市之光书店附近 · BAYBAY 带路 · 约 45 秒; go →
    trip `pt:-8,124` carried (pill 下一站 城市之光书…约 40 秒). `n4-desktop-longpress.jpg`: the same with the mouse (1440 × 900).
  - `n4-phone-search-fly.jpg` / `n4-phone-fly-card.jpg` (pelican unlocked): 艺术宫 in the search with the blue 🐦 约 7 秒 go
    buttons; its row → the pinned 飞过去 · 约 7 秒 (the plan's shot).
  - The search 金门 (not kept): 金门大桥 / 金门公园 / 野牛围场 go 约 3 分钟 (routed), the others from the cache; the first go →
    trip ggb-deck-mid carried, pill 约 3 分钟.
  - `n7-phone-found-chip.jpg`: carried from the Ferry to Coit, the chip "+5 个地点" under 唐人街 · Washington Street. The
    whole walk logged by a MutationObserver: before, 4 toasts (抵达 渡轮大厦市集 at the start, 抵达 泛美金字塔 on the way, 抵达
    科伊特塔, 解锁：随时飞！); after the pass-by rule, **2** (科伊特塔, 解锁：随时飞！) and the chips (+11 个地点 at most).
  - `n7-phone-ggb-deck.jpg`: at mid-span the area chip reads 金门大桥 (y 15; at the south approach it reads 要塞公园).
  - `n8-phone-week-pins.jpg` (`?date=2026-10-03T10:30`): 这周 4 → four venue pins over the whole city (one holds 3
    events), the rest dimmed; `n8-phone-event-card.jpg`: the Hellman Hollow pin → Hardly Strictly Bluegrass 免费音乐节 · 进行中
    · 到 19:00 · 金门公园 Hellman Hollow · BAYBAY 带路 · 约 3 分钟 · ⓘ.
  - The moved trip ends (scratch `C:/Users/willy/opus-qa/w5/w5-n/b/e-*.jpg`): PIER 39 on the gate plaza facing the pier and
    the sea lions; the Sutro Baths above the ruins (BAYBAY: 这里曾经是世界最大的室内泳池…); the Greenwich Steps on the Coit
    plaza; the Hyde Street Pier on the pier; Lombard at the block's foot with the zigzag up ahead. 飞过去 Fort Point lands at
    the door (y 0.76).
- **A slip (said plainly):** one Chrome run of mine (≈ 40 s, the GGB deck check, 11:59 UTC) started while lane V's
  PERF-LOCK (11:55:37 UTC) was up — my check read the file and ran anyway. From then on every Chrome command of mine checks
  the file and stops. Lane V: if a desktop number from 11:59–12:00 UTC looks off, that is why.

### Decisions

- **Narrow frames pin the card, not "phones"**: the rule is the map frame's width (≤ 520 px), so the desktop side sheet
  (484 px) gets the same pinned card and chooser; it reads well there and one behaviour is simpler to learn. A wider frame
  keeps the wave-4 layout.
- **A "+n" badge opens the chooser, not the badge itself** (Coit's "+2" lists Coit first): a tap cannot tell the pip from
  the disc on a phone, and the chooser still reaches Coit in two taps.
- **Quick rows ask for routes only for the few that matter** (the chooser's rows, the first three search results, after
  350 ms): their times then match the trip (Coit 约 1 分钟 = the pill); the rest are estimates at the carried pace.
- **Long-press lands on "the nearest walkable arrival spot"** in the loaded world; beyond the streamed chunks the walking
  graph's node (the walk and the landing snap again on the way).
- **Pass-by moments are quiet only during a trip**: free roam past the Transamerica Pyramid still gets its whole moment.
- **The 这周 pins read lane R's published `weekEvents`** instead of a new registration hook: R's report offers it (Requests
  §4), no work on their side.
- **Fort Point is not moved**: the apron is the fix (lane L); the landing now keeps the level.

### Known gaps

- SS Jeremiah O'Brien (T3) stays UNREACHABLE: the only open spots are 26–35 u away at Pier 45's foot; not moved without a
  look at the pier (next part). The bison paddock and four more wait (Requests).
- The chooser covers the lower half of a 375 × 667 map with 4+ rows (it scrolls; the badge is panned above it).
- A pass-by chip counts the attraction once more if its place is found again later on foot (rare: the place is then known).
- The Lombard end is off the carriageway but the block's foot is a narrow pavement; the follow camera frames the houses
  more than the zigzag (a camera matter for the arrival, lane F / L).

### Not done

- W5-N9 (should: the scenic auto-glide with F; could: 陪 BAYBAY 散步过去) — not started.
- The owner's 湾区第一课 list in city mode (lane C's Journal: Request); the site arrivals that wait.
- Relayed owner messages during this part: none received.

### Requests

- **C** (`ui/Journal.tsx` Goals): hide the district's 湾区第一课 list in city mode (plan MF6): wrap its `<section>` in
  `{!city && (…)}` (`city` is already read there). Optional: `game/brain.ts updateFocus` → `cityAreaAt(p.x, p.z,
  runtime.player.y)` so the deck's south approach says 金门大桥 too.
- **E** (`scripts/opus-sf/coins-place.mts`, `tests/opus-bay-w5-coins.test.ts`): five spots near lane L's site arrivals
  N wires as soon as they move ≥ 4 u away — trail buena-vista-park #5 (29.4, 734.9) and #6 (29.9, 738.4), trail
  bison-paddock #1 (−463.7, 1218.6), trail stop-haight #1 (−39.4, 760), cache sutro-heights-top, cache seward-slides-top
  (3.8 u from the Seward deck arrival 154.6, 838.9). The arrivals: `data/sf/siteArrivals.ts`.
- **L**: Fort Point's apron (the door is BOXED: 1 of 4 ways; F's triage too) — then N drops nothing (the end stays);
  (route stop `r3-bison` at the bison paddock's site arrival: done by lane L in `81d6178`; the paddock now waits for lane
  E's trail #1 only, 1.8 u from it); Irving St's site arrival (−248.1, 1124.99) is BOXED in the sweep (the old end −247.9, 1121.6 is a corridor).
- **F**: the sweep's `trip-end` numbers above are on this head; run 2 can count N's ends as fixed but Fort Point / bison /
  O'Brien.
- **V** (W5-V3, the city-data move): OK from N to edit N's files in the window (`game/resume.ts`, `game/discovery.ts`,
  and any other of N's importers of the moved data).
- ~~**L**: the fire-ring tests fail 06:00–21:30 PT on the real clock~~ — fixed by lane L in `e889335` (lane T found it
  too); the final suite of this part ran on it.
- **Lead**: none frozen.

## Part c (2026-09-28): the mid-wave checkpoint's N findings (CP-1, CP-2, CP-7, CP-13), W5-N9, W5-N10

### 给主人的摘要

1. 中期检查给 N 线的 4 个问题都修好了：BAYBAY 自动带路时，如果你被推着贴在一辆等你让路的电车旁边（检查时卡了两分半），现在 1 秒后会自己往路边让一步，车开走再接着走；手机地图点地点不会再误开 OpenStreetMap 网页；Fort Point 和野牛围场的终点换到了能走动的地方；左上角地名不再夹英文（「探索馆 · 15 号码头」「科伊特塔 · 电报山」），没有中文名的新地点显示「+1 个地点」。
2. 新功能「看风景飞过去」：拿到鹈鹕后，150–900 单位远的地方，地图卡片「其他方式」里在「飞过去」下面多一行（渡轮大厦到九曲花街约 25 秒，到艺术宫约 45 秒）。鹈鹕在城市上空低飞、镜头在身后；碰摇杆（电脑按方向键）就自己开，松手 2.5 秒 BAYBAY 接着带，最后稳稳降落在目的地。电脑上按 G 可以就地降落，剩下的路 BAYBAY 带你走；「跳过」就直接快速飞到。原来一键「飞过去」照旧是推荐。
3. 顺带接上了 L 线整理的 4 个景点到达点（野牛围场、Buena Vista 公园、Sutro Heights、Seward 滑梯）。自动检查 158 个终点和到达点，卡住的从 3 个降到 1 个（奥布莱恩号，实机能走）。
4. 手机（390 × 844）和电脑（1440 × 900）都实际跑过、截图看过；测试全部通过（偶尔有一个大家都知道的"机器忙时计时偏慢"的测试失败，单独跑通过）。
5. 没做：可选的「陪 BAYBAY 散步过去」（要 E 线先给出"今天还没捡的金币小路"的接口，已写在请求里）。

### What was built

**CP-1 · a carried walk steps aside for a vehicle that waits for the player** (`game/autoTravel.ts`, `game/tripRun.ts`)
- The checkpoint's deadlock, reproduced on 5502 at the Green St stop (27.5, 1.8): the carried Exploratorium → Lombard
  walk crossing the tracks presses the player into the side of an F-line car dwelling at the stop; once the player is
  beside the car's front half, the car's "someone standing on the track ahead" rule holds it for good (`held` grows),
  and the walk kept pushing into it.
- `autoStep` learns a yield: `yieldTo` (a line vehicle has waited ≥ `YIELD_AFTER_S` 1 s for the player) issues a step
  aside (`AutoState.yielding`), BAYBAY says **有车来，我们先让一让～** once, and the walk waits until no vehicle is within
  `YIELD_CLEAR_R` 7 u (at least `YIELD_MIN_MS` 1.5 s, at most `YIELD_MAX_MS` 20 s: a long dwell is walked past), then
  re-issues the leg; the retry counter is not touched meanwhile; the stick is a takeover as ever.
- `yieldSpot(player, car, stand, toward)`: straight across the car's axis to `YIELD_SIDE` 4.5 u (clear of its 1.4 u
  band and of the neighbouring track, ≤ 3.8 u apart), on the player's own side when pressed against the body, on the
  walk's side when clear ahead of the nose (`YIELD_BODY_CLEAR` 5.4 u), else the other side, else nothing (the old
  behaviour).
- `tripRun.lineVehicles()` reads every running line vehicle's pose and `held` (cable cars, F-line cars, the sightseeing
  buses, the Metro trains' cars) through `data/transit.ts`; `vehicleYield()` picks the one waiting longest within 24 u.

**CP-2 · no ghost click on the lifted OSM credit** (`ui/CityMap.tsx`, `ui/mapGo.ts`)
- A map tap that selects pins the card and lifts the credit to just above it — under the finger; the touch's
  compatibility click then opened openstreetmap.org/copyright in a new tab (the game hidden). Now the map's `touchend`
  (on the map itself: `mapGestureTarget`, never on a button, link, the card or the chooser) calls `preventDefault` (no
  click follows; a focused search field is let go by hand, as the click would), and the credit's own `onClick` ignores
  a click within `CREDIT_GUARD_MS` 600 ms of a map gesture (event time stamps). A deliberate tap on the credit still
  opens it.

**CP-7 · Fort Point and the bison paddock** (`data/sf/attractions.ts`, `data/sf/extraPlaces.ts`)
- Fort Point's trips end on the seawall promenade by the fort's east wall under the bridge (−744.81, 588.26, heading
  −0.685) — found with the sweep's own judge at the fort's own level (under 4 u: the deck is 15 u up) and looked at in
  the game; the door end was boxed (1 of 4 ways live). An extra place row whose attraction's end moved ends travel
  there too (`overrideArrivalRows`).
- Lane E's `88722c2` keeps every coin 4 u from the trip ends: four of lane L's site arrivals that waited are wired —
  the bison paddock (−464.9, 1220; = route r3's stop; my interim override from earlier in this part is gone), Buena
  Vista Park, Sutro Heights, the Seward slides. `SITE_ARRIVALS_WAITING` keeps Haight & Ashbury (its site arrival SNAGs
  in the sweep; the old end is ok) and Irving St.

**CP-13 · no English in the zh HUD** (`data/cityZones.ts`, `ui/GuideLayer.tsx`, `game/guideCity.ts`)
- The hero waterfront zones are the district's (frozen `data/district.ts`, mixed names such as 'Coit Tower · 电报山',
  'Exploratorium · Pier 15', 'Embarcadero 海滨大道'). City mode names them through `CITY_HERO_ZONE_NAMES` (VOICE.md's
  glossary and the attractions' names): 科伊特塔 · 电报山, 菲尔伯特台阶, 李维斯广场, 14 号码头, 渡轮大厦, 7 号码头, 探索馆 ·
  15 号码头, 33 号码头, 39 号码头, 内河码头 — in `cityAreaAt`, `zoneName` (BAYBAY's welcome back) and the area pill. The
  district keeps its own.
- The find chip: a find whose zh name is only its English one (most OSM places: 'Golden White House', 'Boiler rooms',
  'The Embarcadero & Green St') says **+1 个地点** in zh (`foundChipText`, `hasCjk`). The street line under the pill
  stays English on purpose (street signs, `translate="no"`).

**Lane F's request** (`game/hudLayout.ts`): lane A's `.ob-play-result` and `.ob-play-flight` are HUD boxes.

**W5-N9 · 看风景飞过去, the scenic auto-glide** (should; `game/scenicTrip.ts` new, `game/scenicFlight.ts` new,
`game/fastTravel.ts`, `game/tripRun.ts`, `ui/PlaceActions.tsx`, `ui/tripRows.ts`, `ui/TripOptions.tsx`)
- The option (`scenicTrip.ts`, tiny and pure): for 150–900 u once the pelican is unlocked, `withScenic` puts a scenic
  twin right after the fast 飞过去 in the card's 其他方式 / 换个方式 rows — **看风景飞过去 · 低空慢慢飞 · 能自己开**; never
  推荐, never a goal (a fly row); not counted in the four rows (`orderOptions`), its own React key. Honest time
  `scenicSeconds(d)` = pickup 0.8 + rise 1.0 + d / 18.5 + landing 2.6 (measured: Ferry → Lombard 360 u in 22.5 s,
  quoted 约 25 秒; Ferry → the Palace 712 u in 41 s, quoted 约 45 秒). A scenic leg is a `TripFlyLeg` with `scenic: true`
  (a structural extension: the frozen trip types are untouched).
- The flight (`scenicFlight.ts`, loaded with the trip runner): `ScenicFlight` flies a `GlideSim` (lane F's flight model:
  the soft floor over the roofs, the tall structures, the model's edge, the soft boxes) with `scenicPilot` (bank toward
  the destination, hold `scenicHeight` = soft floor + 14 and ≥ 30 over the ground, lower on the approach; boost on the
  straight, slow near the end) or with the player's controls: any stick / WASD / pad move flies it (BAYBAY: **你来飞！松开
  我就接着带路～** once), letting go hands it back after 2.5 s; the caption's second line follows who flies and the device
  (碰摇杆自己飞 / 方向键自己飞 · G 就地降落 / 松开就由 BAYBAY 接着飞). The camera is the glide rig's framing (14 u behind,
  pitch 0.3, 10 u ahead), carried by the pelican and eased. Within 45 u of a streamed destination it asks to land; not
  streamed: it circles up to 8 s, then lands anyway; a destination it cannot reach (a soft box) goes the fast way.
- The seam (`fastTravel.ts`, the main graph's only growth): `startTravel(dest, scenic?: ScenicDriver)`; the pickup and
  the rise are the fast hop's (the rise closes on the chase camera); the driver's poses and camera between; the landing
  is a curve from the pelican onto the arrival spot (`arrivalSpot`, the level guard, `landingHeading`, first sights and
  `faceOpen` as before; 2–3.2 s); G lands where the pelican is (`landAt`); 跳过 / Esc and the give-up take the fast hop
  through the cloud; `travelIsScenic()` and the pose's `roll` for lane F.
- The trip runner: a scenic leg starts `new ScenicFlight(...)` (BAYBAY: **抓紧！我们低低地飞，看看风景～**); a flight that
  lands farther than `FLY_END_R` 60 u from its leg's end turns the rest into a carried walk (**就在这儿降落啦，我们走过去！**).

### Evidence

- Checks (the structured output has the hashes after the last rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 ·
  `npx eslint .` 0 errors (43 old warnings outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test
  tests/opus-bay-*.test.ts`: 1228 / 1228 before the first push, 1232 / 1232 on the rebased checkpoint push, 1240 / 1240
  with W5-N9; on lane V's `cef43f9` 1254 / 1255 — the one failure is lane F's wall-clock assert "a cached cell is cheap"
  (sf-move2 E2-5), 24 / 24 alone; the final run is in the structured output. `tests/opus-bay-w5-nav.test.ts` 46 → 61:
  CP-1 (the spot, the reducer's step-aside and wait, the vehicle pick), CP-2 (gesture targets, the credit guard, the
  wiring), CP-7 (radius, facing, coins, the site arrivals), CP-13 (zh names, the district untouched, the chip), the HUD
  boxes; W5-N9 (the option, the rows, the autopilot, the flight on a synthetic world with a block of 40 u roofs — never
  under 4 u over them —, the streaming wait, the takeover and hand-back, G, the soft-box give-up, the trip through the
  seam with the landing and the lock let go, the bank and `travelIsScenic`, skip, the runner's walk after a far
  landing). `sf-attractions` / `sf-places` updated for the moved rows.
- Lane F's static sweep (`sweep-static.mts --only trip-end,arrival`, 158 targets, on this head): **ok 118, CORRIDOR 39,
  BOXED 0, SNAG 0, OFF 0, UNREACHABLE 1** (SS Jeremiah O'Brien, which the checkpoint's live walker passes); part b ended
  at 3 stuck. The first run with Haight's site arrival wired showed it SNAG: kept waiting.
- The real game on 5502 (Chrome 153 headless, RTX flag, zh-Hans; phone 390 × 844 dpr 3 with touch, desktop 1440 × 900),
  images in `docs/opus-bay/qa/w5/N/` (`c-*.jpg`):
  - CP-1: before the fix the player stood pressed against the car's side (the checkpoint's picture). With it, phone and
    desktop alike: the car held 1.2 s → **有车来，我们先让一让～**, the player stepped to (29.5, 1.5), the car left (v 1.6 →
    7.3) and the walk went on toward Lombard a second later (`c-cp1-desktop-yield.jpg`, `c-cp1-desktop-car-passes.jpg`).
    A carried crossing in front of a waiting westbound car just walks across.
  - CP-2: the Ferry badge dragged under the spot the lifted credit takes (credit 84, 509, 78 × 12 css), tapped at (123,
    515): **control without the fix** — a second tab on openstreetmap.org/copyright and the game `hidden`; **with the fix**
    — one tab, `visible`, the station's card pinned (`c-cp2-phone-card-no-tab.jpg`); a deliberate tap on the credit 1.5 s
    later still opens the licence page.
  - CP-7: Fort Point's new end on the seawall with the fort's wall and the bridge overhead (`c-cp7-phone-fort-point.jpg`);
    the bison paddock's site arrival on the JFK Drive path with the herd behind the fence (`c-cp7-desktop-bison.jpg`).
    Four 1.5 s pushes from the Palace of Fine Arts' landing: 2.6 (the lagoon) / 8.0 / 3.7 / 9.5 u.
  - CP-13: the pill **探索馆 · 15 号码头** at the Green St stop (`c-cp13-phone-area-pill.jpg`), **科伊特塔 · 电报山** on the Coit
    plaza; no English find chip.
  - W5-N9 phone: 地图 → search 九曲花街 → the pinned card → ⌄ → rows 飞过去 约 6 秒 推荐 · **看风景飞过去 约 25 秒** · 步行 约 1
    分钟 (`c-n9-phone-rows.jpg`); the flight over North Beach toward the Golden Gate with the gold flag ahead
    (`c-n9-phone-flight.jpg`); landed on Lombard's trip end (−158.6, 153.4) in 22.5 s. To the Palace (约 45 秒): the stick
    at 7 s banked it round (**松开就由 BAYBAY 接着飞**), BAYBAY flew on 2.5 s after the release, landed at the Palace's
    arrival (−409.9, 409.9), 抵达 · 艺术宫 (`c-n9-phone-landed.jpg`). Renderer while flying (quality mid): at most **75
    calls, 263k triangles**.
  - W5-N9 desktop: WASD takes over with the bubble (`c-n9-desktop-takeover.jpg`), the hint comes back to **方向键自己飞 · G
    就地降落**; G over Nob Hill lands at (−46.2, 185.4) and the trip walks on, carried (**就在这儿降落啦，我们走过去！**, pill
    下一站 艺术宫, chip BAYBAY 带路中, `c-n9-desktop-land-here.jpg`). A clean flight to the Palace: 41 s. Renderer while
    flying (quality high): at most **94 calls, 342k triangles** (budget 150 / 400k). No new material or program (the
    pelican, the city and the camera are the glide's). The fast 飞过去 checked again after the change: Coit in 3.8 s with
    第一次来 · 科伊特塔.
- Main-graph growth (per-file esbuild minify + gzip, standalone): `game/fastTravel.ts` 2,550 → 3,222 B, `data/cityZones.ts`
  1,253 → 1,603 B, `game/hudLayout.ts` 1,562 → 1,577 B: ≈ +1.0 KB gzip for lane V to count; `scenicFlight.ts` lives in the
  trip runner's chunk, `scenicTrip.ts` in the map's and the runner's.
- No real-world fact was added in this part (nothing to source).

### Decisions

- **CP-1 is fixed in the walker, not in the car.** The car's rule belongs to lane T and is right for a person standing
  on the track; the auto-walk now does what a person does — steps off and lets it pass. The trigger is lane T's own
  `held` signal (≥ 1 s), so a walk that just crosses a track never yields. The side: the player's own (never round the
  nose) when pressed against the body; toward the walk when clear ahead. A car at its stop that does not hold is only
  waited for (its dwell is about 5 s; the checkpoint's jam needed the hold).
- **CP-2: both fixes**, the swallowed click (the cause) and the credit's guard (any other synthesized click); the licence
  link stays tappable.
- **CP-13: names, not translation machinery.** Ten hero zones get city names; finds without a zh name say how many, not
  an invented name; the street line stays English (it is the street's sign).
- **Fort Point moves after all** (part b kept the door): the level guard now keeps a landing off the deck, and the search
  at the fort's own level found an open spot with the fort and the bridge in view.
- **The scenic flight is a choice, not the default.** 飞过去 stays the one-tap 推荐 (F4); the scenic row is the slow,
  pretty way for whoever wants it, and its time says so. It is flown by the same flight model as the free glide
  (instantiated, not modified), so the pelican never passes through a roof, a tower or a soft box.
- **Takeover means steering; the destination stays.** Letting go hands the pelican back and the trip still ends at the
  destination; G (desktop) is "land here"; 跳过 is the fast way. Phones have no "land here" yet (lane F's 降落 button is
  hidden in a cinematic: Request, with the seam ready).
- **The scenic part stays out of GameRoot's graph** except the driver seam in `fastTravel.ts` (+0.7 KB gzip).
- **The could (陪 BAYBAY 散步过去) is not built**: "the day's coin trail" is lane E's live state (which coins are still
  there today) and E's public API has no trail hint; a stroll that leads to coins already picked would be worse than none.

### Known gaps

- A phone cannot land where it is during a scenic flight (lane F: TouchControls' 降落 in a cinematic, `travelIsScenic()`).
- The scenic pelican does not bank yet (lane F's `flyTravel` sets its roll from the pose's phase; the pose now carries
  `roll`).
- With the running trip's mode 'fly', both fly rows show as pressed in 换个方式 (`picked` is a mode).
- New BAYBAY lines without a recorded voice (lane V's binder is text-matched): 有车来，我们先让一让～ · 你来飞！松开我就接着带路～ ·
  抓紧！我们低低地飞，看看风景～ · 就在这儿降落啦，我们走过去！
- SS Jeremiah O'Brien stays UNREACHABLE in the static sweep (passes live).
- Dev server only: after HMR the probes' bare `import()` of a module on an HMR chain is a second instance
  (`flow.endTrip` did nothing from the console once); `window.__opusBay.actions` / `.fastTravel` are the app's.
- District lines in city zh bubbles still say English names (lane C's `data/pois.ts`: Exploratorium 里全是…, 这一站就在
  Exploratorium 门口…).

### Not done

- W5-N9 could: 陪 BAYBAY 散步过去 (needs lane E's trail hints, Requests).
- Relayed owner messages during this part: none received.

### Requests

- **T** (`world/flineSystem.ts onTrackAhead`, and the same test in `world/transitLine.ts`, `world/busSystem.ts`,
  `world/lightRail.ts` if they share it): a person beside the car's body is not "on the track ahead" — `along - FL.half`
  below 0 means beside the front half, and the car then holds for good while the person is pressed against its side (the
  checkpoint's 72 s). Suggest `return along > FL.half && along < 16 && side < 1.4 ? along - FL.half : null;` (N's walker
  steps aside after 1 s either way).
- **F** (`actors/TouchControls.tsx`): show 降落 while `travelIsScenic()` (game/fastTravel), `onPress={() => {
  input.glideCount++; }}` — it lands the scenic pelican where it is, as G does on a keyboard; (`actors/moveSystem.ts
  flyTravel`): `g.roll = pose.roll ?? <today's wobble>` so the scenic pelican banks into its turns.
- **E**: a trail hint for the stroll option — e.g. `registerHintSource('trail', …)` ('trail' in HINT_KINDS, not in
  COMPASS_KINDS) listing today's trails with coins still to pick (`{ id: '<trail>', x, z }` of the first one left, and
  how many); N then offers 陪 BAYBAY 散步过去 along the nearest one on the way.
- **L**: Haight & Ashbury's site arrival (−42.2, 760.64) SNAGs in the sweep (moves 2 / 4, one way stopped at once);
  Irving St's as before.
- **C** (`data/pois.ts` barks shown in the city): English in zh bubbles — Exploratorium 里全是能动手玩的实验…, 这一站就在
  Exploratorium 门口… (探索馆).
- **V**: the main graph grows by ≈ 1.0 KB gzip (above); the four new BAYBAY lines if they should be voiced.
- **Lead**: none frozen.

Status (zh): 第五波 N 线 part c 完成：中期检查 4 个问题（让车、地图误开网页、两个终点、英文地名）已修并推送；「看风景飞过去」已上线（手机和电脑都实测）；散步选项等 E 线接口。
