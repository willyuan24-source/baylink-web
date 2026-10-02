# Wave 9 · plan and lead note (day 0) — "make Opus Bay good enough to replace /play"

Written 2026-10-01 ≈ 21:45 PDT by the lead in `C:/Users/willy/baylink-opus`. The owner (2026-10-01 ≈ 21:20 PDT), after the
first-use product review (`docs/opus-bay/review-2026-10-01-first-use.md`, 6.1 / 10): **"当OPUS-BAY没问题的时候，就可以替代PLAY了。
现在按照你的分析，进行全面优化"**. Standing orders: "直接做，不用经过我同意", quality first, never ask; Ultra (one workflow).
Inputs, in this order: the review (§0 conclusion, §5 Top 15, §6 other issues, §7 the routes, §8 ideas, §9 metrics, §10
decisions), `sf-w8-summary.md` §6 NEXT (time-bound items first), the wave-8 rules in `src/opus-bay/RESUME.md`.

## 0. 给主人的摘要

1. 第九波不加新区域，专修评测里发现的"路"：**入口、首屏、冷启动、第一分钟、带路、分享、度量、繁體搜索、免费福利提前看**。13 条线今晚通宵并行，明早（10/2 约 09:00）验收后上线。
2. **替代 /play**：首页「逛一圈 3D 湾区」和侧栏「小小湾区」改为进入 Opus Bay，/play 自动跳到 /opus-bay（旧的分享车票链接转到 /plan）。/play 的代码保留不删，随时可以改回。只有最终验收（W9-Z）判定"没问题"才会切换；否则其他修复照常上线，入口不动。
3. 修整站可能白屏的旧 iPhone 问题（iOS 16.4 以下的正则），/opus-bay 有自己的首屏和分享卡片，不再先闪 BAYLINK 首页。
4. 第一分钟：同屏最多 3 条消息，到站合成一张卡，第一次可操作时教手机怎么走，60 秒内让玩家飞一次；首访不再强制黄昏光，城市恢复白天的颜色。
5. 真实价值：这周免费福利提前 7 天看到、可加日历；"带娃/带长辈"的选择会一直记住；繁體搜索修好；照片和活动卡能带二维码分享到微信群，扫码直达同一地点。
6. 新增游乐图鉴（约 22 个小游戏都能找到），修好捉迷藏；万圣夜（10/31）和亡灵节游行（11/2）提前完整测一遍；新台词全部配音。Higgsfield 余额约 357，本波只用于配音（≤ 60）和必要的画面（≤ 30）。

## 1. State at day 0

- `origin/opus-bay` = `80f63b1a` (the wave-8 hand-off; code = `main` `90c6859e`, live since 2026-10-01 05:17 PDT). `origin/main`
  has **no** new commits since (fetched 21:22 PDT): no day-0 merge. Re-fetch before the go-live.
- Baseline (W8-Z + the go-live check): `npm run check` EXIT 0 (2933 tests, 2932 pass, 1 todo); opus-bay suite 1871 / 0 fail;
  GameRoot **258.03 KB** gzip, static guard 258.5 (≈ 0.2 KB headroom: every new module of this wave must be lazy);
  desktop max 126 calls / 387k tris; phone 4× every spot ≥ 45 fps; sweep 699 / 0 / 0 / 0.
- The review's evidence: `C:/Users/willy/opus-qa/review-1001/` (per persona folders, `gapfill/cold/summary.jsonl` = 33
  idle-machine cold starts, `gapfill/tour-full/` = the full Grand Tour with the two stuck legs, `gapfill/ios/` = the
  lookbehind simulation). Lanes read the review section(s) named in their row.
- Higgsfield `balance` 357.27 (2026-10-01 05:30 PDT, read only; the account is shared — read it before every batch).

## 2. Timeline (PDT, 2026-10-01 → 10-02)

| when | what |
|---|---|
| 22:45 | lanes start (parts a → b → c; push after every part) |
| by 23:45 | **contract APIs on origin** (§4): F `game/attention.ts`, E `ui/entrySource.ts`, R `realsf/todayLine.ts todayHeadline()` + `realsf/prefs.ts`, S `game/metrics.ts track()`, P the warm-ready flag |
| by 01:45 | every new / changed fixed BAYBAY line appended to `C:/Users/willy/opus-qa/w9/new-lines.md` AND pushed (X records ≈ 02:00 and ≈ 02:40) |
| 02:45 | lanes stop starting new work; **03:00** last push + report |
| each lane's end → 04:40 | two read-only lenses (code & facts, player) → one fixer per lane |
| 04:40 → 06:10 | **W9-I**: three integration lenses (new player phone / desktop, words-facts-site) → the W9-I fixer |
| 06:10 → 07:20 | completeness critic (vs the review's Top 15 + §7 + this plan) → bounded fix pass W9-C |
| 07:20 → 08:50 | **W9-Z** final verify alone (PERF-LOCK): check, perf incl. the new cold-start gate, first-minute gate, sweep, bundle, CSP, the switch gate |
| ≈ 09:00 | the lead: merge `origin/main` if GPT pushed, `npm run check`, fast-forward `main`; hand-off |

## 3. Lanes and ownership

Worktree `C:/Users/willy/wt/w9-<id>` (branch `w9-<id>`, `node_modules` junction to the main checkout's), scratch
`C:/Users/willy/opus-qa/w9/<id>/`, report `docs/opus-bay/sf-w9-<ID>.md`, QA images `docs/opus-bay/qa/w9/<ID>/`, tests
`tests/opus-bay-w9-<id>*.test.ts`. Paths are under `src/opus-bay/` unless they start with `src/` (the site), `scripts/`,
`tests/`, `public/`, `docs/`, `index.html` or `vercel.json`. "Surgical" = a minimal edit in another lane's file, named in
the commit message and the report. Review refs: `R§5 #n` = the review's Top-15 item n; `R§6` = its other-issues tables.

**E · entry, site shell, the /play switch** (port 5901) — owns `vercel.json`, `scripts/prerender.tsx`, `src/App.tsx`
(routes), `src/routing.ts`, `src/components/HomeDiscovery.tsx`, `src/components/SiteNavigation.tsx`,
`src/pages/LittleBayPage.tsx` (the redirect only), `src/lib/little-bay-metadata.ts`, `src/lib/named-event-search.ts`,
`src/lib/guide-search.ts`, `src/lib/quick-search.ts`, `vite.config.ts` (`build.target` only), `index.html` (only if
needed), new `public/boot-check.js`, new `public/opus-bay/og-*.jpg`, new `ui/entrySource.ts`, `OpusBayPage.tsx`
(metadata / canonical / `from=`; A edits its history part), the site tests that pin these (update, never delete).
Work: (1) **R§5 #2 lookbehind** — rewrite both regexes without lookbehind (same matches: tests for every case), set
`build.target` so Safari 15 parses the bundle, a guard test that fails on any lookbehind in `src/**` regex literals /
`RegExp` strings, and `scripts/opus-sf/qa/dist-syntax.mjs` (scans `dist/assets/*.js` for `(?<=` / `(?<!`, for W9-Z); a
CSP-safe `public/boot-check.js` (a classic script, `'self'`) that shows a friendly notice + links to /guides when the
module bundle cannot run (old engine probe), if cheap. (2) **R§5 #3 the shell** — `scripts/prerender.tsx` writes
`dist/opus-bay.html`: its own `<title>`, description, canonical `https://www.baylink.us/opus-bay`, hreflang (zh-Hans /
zh-Hant `?lang=zh-Hant` / en `?lang=en`), `og:*` + `twitter:*` with a 1200×630 crop of the key art (`public/opus-bay/art/`),
a static first paint that looks like the title screen (key art + 湾区小旅 / Little Bay Trip + "准备中…", critical CSS
inline — `style-src 'unsafe-inline'` is allowed, `script-src` is `'self'` only), the same module / css tags as
`index.html`; `vercel.json` routes `/opus-bay` → `/opus-bay.html`; the sitemap lists `/opus-bay`. No BAYLINK-homepage
flash at any network speed (prove with a MutationObserver probe as tech did in the review). (3) **The /play switch**
(separate commits titled `W9-E-switch…`, so W9-Z can revert them alone): the homepage card → `/opus-bay?from=home`
(label honest: 逛一圈 3D 旧金山 / Explore 3D San Francisco), the nav 「小小湾区 · Little Bay」 → `/opus-bay?from=nav` (active
on /opus-bay), `/play` → `/opus-bay?from=play` keeping `lang`; old shared-ticket links (`/play?date=&stops=&places=`) →
the site planner with the same plan if `/plan` reads it (else `/opus-bay`); `/play` out of the sitemap, its prerendered
page a redirect shell with canonical /opus-bay; `LittleBayPage` code stays in the repo (unrouted) for an easy revert.
(4) `ui/entrySource.ts` (§4). (5) Names (§6): no user-visible "Opus Bay" (the title eyebrow is F's file — F does it).

**F · first minute & attention** (5902) — owns `game/flow.ts`, `game/flowStore.ts`, `game/welcome.ts`, `game/resume.ts`,
`game/goalsStep.ts`, `game/arrival.ts`, `game/pelicanFirst.ts`, `game/cityMoments.ts`, `game/linePacer.ts`,
`game/baybayLines.ts`, `game/baybayHold.ts`, `game/brain.ts`, new `game/attention.ts`, `ui/TitleScreen.tsx` (P edits the
Start readiness surgically), `ui/Overlay.tsx`, `ui/Floating.tsx`, `ui/ArrivalCard.tsx`, `ui/GoalsStep.tsx`,
`ui/CoachMark.tsx`, `ui/CoachMarkBody.tsx`, `ui/coachSeen.ts`, `ui/guideText.ts`, `ui/objectivePill.ts`, `ui/Moments.tsx`.
Work: (1) **R§5 #5 the attention arbiter** `game/attention.ts` (§4): one slot each for title-level (banners, arrival /
chapter / stuck cards), action-level (E prompt, wait / ride chips) and line-level (BAYBAY bubble + voice); the rest queue,
≥ 2.5 s apart; every popping surface goes through it (yours now, others' via §4); arrival banner + ARRIVED card + "+1 place"
→ one card that does not auto-close on a first visit; today 1/3 + pumpkins + coins → one progress ribbon; a headless gate
script `scripts/opus-sf/qa/first-minute.mjs` (fresh profile, each of the 4 entries × zh / en, desktop + phone: the max
number of visible messages per second over the first 60 s ≤ 3; W9-I / W9-Z re-run it). (2) **The first 60 s**: the player
moves on their own by ≈ 20 s; the chosen entry delivers by ≈ 45 s; tour / free get a short glide by ≈ 60 s
(`play/firstFlight.ts`, surgical) and "随时飞 · G" only after the pelican is actually on screen (`pelicanGreet`) (R§6 flight
row); wander → no waypoint, the 10 goals into the journal; "我是本地人" → quiet for 3 min for real (no fly coupon, time
toast or goal strip) + one 今天 card (`todayRows`). (3) **R§6 the time toast + R§6 golden**: a first visit opens golden only
for the intro; after the 4-way choice the real Bay time (`ui/Overlay.tsx` F11, `flow.ts` timeOffer) — no "看此刻的早晨"
toast. (4) **R§5 #14 touch coach**: only player-driven movement marks it seen (auto-travel / tours never); a 3 s ghost
joystick at the first free control on touch; the phone title keeps one line of controls; one wording for camera turning.
(5) Title: copy (R§6 language rows: 我是 BAYBAY，带你逛整座旧金山 / 先不玩，直接看攻略), the eyebrow `小小湾区 · BAYLINK` / `LITTLE
BAY · BAYLINK` (§6 names), a one-line 「今天在旧金山」 strip from R's `todayHeadline()`. (6) The postcard illustration stays
until a tap (R§6). (7) w8 NEXT #8 in your files: the pacing gap after a held line's release, the pacer reporting a dropped
line, the idle pool repeating a line 18 s apart (`brain.ts`).

**N · guide, trips, the Grand Tour** (5903) — owns `game/autoTravel.ts`, `game/tripRun.ts`, `game/tripTypes.ts`,
`game/tripPlan.ts`, `game/tripProviders.ts`, `game/tripText.ts`, `game/trips.ts`, `game/travel.ts`, `game/goTo.ts`,
`game/goToRun.ts`, `game/placeTrips.ts`, `game/scenicTrip.ts`, `game/tourTrips.ts`, `game/cityTour.ts`,
`game/guideCity.ts`, `game/waypoint.ts`, `game/busWatch.ts`, `game/lineRides.ts`, `game/transit.ts`, `game/ride.ts`,
`game/fastTravel.ts`, `game/mapRoute.ts`, `actors/guide.ts`, `actors/routeFollow.ts`, `actors/stuckHelper.ts`,
`actors/nav.ts`, `data/sf/tours.ts`, `data/tours.ts`, `data/sf/tourLines.ts`, `ui/TripPill.tsx`, `ui/TripOptions.tsx`,
`ui/tripRows.ts`, `ui/GoChip.tsx`, `ui/MoveChip.tsx`, `ui/RideBanner.tsx` (logic; Q its layout), `ui/TourRecap.tsx`,
`ui/CityTourRecap.tsx`, `ui/tourRecapModel.ts`, `ui/LineRideLayer.tsx`, `ui/GuideLayer.tsx`.
Work: (1) **R§5 #6 one time source**: 「车 9 秒后到 · 车程约 4 分钟」; no "下一站：X" inside X's radius; walking ETA from the
remaining path length, never rising (smoothing; a rise only with a stated detour); ride quotes calibrated (the review: a
240 s quote boarded in < 30 s; "约 24 秒" waited ≈ 3.5 min); w8 D-4 a ferry-aware ETA from Alcatraz. (2) **R§5 #7 stuck**:
bus drop-offs snapped to the nearest walkable nav node with clearance round each loop stop's shelter; a 20 s no-progress
watchdog; on give-up a top-slot card 「这段路被挡住了 [飞过去] [换条路] [我自己走]」 (F's arbiter); a short leg fades and
delivers; the player's own escape from a stuck state is not a takeover; regression tests (dev hooks, Bay clock pinned):
the Golden Gate viewpoint, Lands End and Ocean Beach drop-offs reach the next stop within 2× the quote; the SoMa Howard St
leg (phone review). (3) **The Grand Tour**: the Full / Express choice goes (`cityTour.ts choose()`: full by default, hop off
anytime); a chapter-end settlement card (postcards, coins, add to wishlist) through the arbiter; a resume card on return
(「继续一日游 · 第 n 章（约 m 分钟）」) and the chapter number fixed (`data/sf/tours.ts tourResumeLabel`, R§6 growth row: one
less); the recap: tour-stop postcards claimed (not "0/24") + a 「带回现实」 next step (this week's events near the stops; S's
share card when on origin); the tour bus menu's first item = the tour's next stop (R§6). (4) Trip ends turn to
`arrival.heading` (w8 NEXT #8); "Take me there" lands at the venue's booth / door (the Ferry Plaza market, not the F-line
platform) and reopens the event card on arrival (R owns the card: call its API). (5) The map's "~1 min" says 「和 BAYBAY 走
约 85 秒」 with ride / fly shortcuts (R§6).

**R · real-world value** (5904) — owns `realsf/**` except `dressing.ts` / `seasons.ts` (H; H edits `todayLine.ts` for the
big-night greeting surgically), `data/catalog.ts`, `data/links.ts`, `scripts/opus-sf/export-live.ts`,
`public/opus-bay/sf/v1/live.json`, `data/sf/placeCards.ts`, `placeCards2.ts`, `placeCardTypes.ts`, `ui/WeekPanel.tsx`,
`ui/EventCard.tsx`, `ui/EventCardBody.tsx`, `ui/PlaceCard.tsx`, `ui/PlaceActions.tsx`, `ui/PoiCard.tsx`,
`ui/PoiCardBody.tsx`, `tests/opus-bay-w6-s-*.test.ts`, new `realsf/prefs.ts`.
Work: (1) **R§5 #10 free days ahead**: a 7-day 「这周免费」 strip on top of 这周去哪; place cards show the next 7 days' free
days (wire `offersForPlace` with a date window); 「免费就好」 merges offers with events; 「加到日历」 (.ics, the day-before
VALARM; reuse `src/lib/event-calendar.ts`) on event cards and offers. (2) **R§5 #12 recommendations**: city mode relaxes
vibe → companions → region (SF last); 「户外」 by tags; the in-game third question = SF neighbourhoods; honest wording
(「旧金山的吃喝类这周只有 2 个」); a travel profile (带娃 / 带长辈 / 自己 / 两个人) from the 3 answers in `realsf/prefs.ts` (§4)
used by the daily three things, the recommendations and the cards' emphasis (senior prices, kid games). (3) Correctness
(R§6 real-world rows): internal editor notes never shown (split display fields + an export guard failing on internal
words), punctuation; a link-patrol script (status + a month in the URL) run once and its finds fixed (First Thursdays);
de Young free Saturdays for Bay Area residents (official page + date); transit times by weekday / weekend; manual "how to
get there" for the T1 cards without one (Golden Gate Bridge, the Zoo, Legion of Honor … official sources). (4)
**Time-bound** (w8 NEXT #6): the four SFPL family events out of `eventVenues.ts WORLD_SKIP` → rows before their dates —
7 Oct `sfpl-richmond-lego-oct7-2026`, 8 Oct `sfpl-ocean-view-stem-oct8-2026`, 17 Oct `sfpl-omi-history-day-oct17-2026`,
24 Oct `sfpl-western-addition-open-house-oct24-2026` (souvenir ids, names, the main-side assertion in
`tests/opus-bay-w6-s-venues.test.ts`); the Chinatown Halloween Festival (31 Oct) findable in game (calendar row +
search keywords 万圣 / Halloween; the site's catalog still lacks it: a Request, not a site edit). (5) `todayHeadline(now,
locale)` (§4): one line at a time — Fleet Week / Blue Angels 9–11 Oct, 「日落还有 12 分钟 · 飞去双峰」, today's free; pure +
tests. (6) `live.json` re-exported from the site's current offers (only what exists; the latest row today is 25 Oct).

**S · share & metrics** (5905) — owns `ui/Album.tsx`, `ui/album.css`, `ui/shareFile.ts`, `game/album.ts`, `game/photo.ts`,
`game/photoFrames.ts`, `game/shutterHook.ts`, new `game/metrics.ts`, new `ui/ShareCard*.tsx` / `ui/shareCard*.ts`,
`ui/common.tsx` (`LinkButton`), `src/lib/product-events.ts` (types only, append), `core/events.ts` (APPEND event types
only, §4). Work: (1) **R§5 #8 photos**: the frame prints `baylink.us/opus-bay` + a small QR (`qrcode`, a direct dependency:
lazy-load it) to `?at=<spot>&from=photo`; the share payload carries the url; the title 湾区小旅 / Little Bay Trip; a short
date (10月1日 / Oct 1); Web Share rejected → a long-press / download fallback (AbortError apart). (2) **「约家人」 card**: event
card, place card and the weekend list → a vertical PNG (date, place, cost, how to get there, QR to `?at=&from=family`) for
WeChat (long-press save), in the site's share-card style (`src/lib/share-card-svg.ts`); a share button on the event /
place cards (R's files: surgical, named). (3) **R§5 #9 metrics** (§6: no backend edit): `game/metrics.ts` lazy after the
first frame, subscribed to `core/events.ts onEvent`; the funnel of review §9 (start by `from`, title → start, cold-start
bucket, mode, first card ≤ 60 s, real actions, share, returning 1d / 7d / 30d, tour chapters); sends through
`recordProductEvent` only names in an allowlist that mirrors the backend — today `official_source_click` for official
links opened from the game; the `opus_*` names wait behind `OPUS_METRICS_LIVE = false` + a ready patch
`docs/opus-bay/w9-backend-metrics.patch` (backend `lib/productMetrics.js` + its test, written from a read of
`C:/Users/willy/OneDrive/Desktop/baylink-backend` — never edit that checkout); every outbound link from the game carries
`from=opus-bay`.

**L · language & search** (5906) — owns `data/sf/placeSearch.ts`, `data/sf/places.ts` (`normalizeQuery`), `i18n.ts`,
`ui/LangPills.tsx`, `ui/langChoice.ts`, `scripts/opus-sf/qa/lang-scan.mjs`, the text of `data/sf/copy.ts` (voiced lines
are frozen: §4), `src/i18n/locale.ts` (surgical: the 繁體 converter issues, the site's tests green), the site's English
dictionary rows for `venue-exploratorium-daytime` / `restaurant-gotts-ferry-building`,
`src/data/september-refresh-offers.json` (the seniors' Muni `sourceUrl` only). Work: (1) **R§5 #11 繁體 search**: run
`simplifySearch()` inside `normalizeSearch`; chips back-filled; tests: every zh-Hant example and chip finds results;
aliases so a search finds the games (crab → the crabbing spot, claw / 抓娃娃 → Musée Mécanique, foghorn / 雾笛 → Fort Point,
busker / 街头艺人 → Haight, kite / 风筝 …: read the zones in `play/`) and events / festivals (万圣 / Halloween → the treat
streets and the festival). (2) 繁體 quality: the converter's non-idempotent cases (馬里納區 → 馬裡納區, 小傢伙 → 小傢夥, 海里 →
海裡), a small phrase table for mainland words (設置→設定, 信息→資訊, 意大利→義大利 …) on opus-bay text (and the site's
`translateText` if safe); a 繁體 sweep. (3) Words (R§6 language rows): Welcome Center's zh name, time-of-day words from the
real Bay time, "What’ s that?", 「1–30 October」, w8 P0-4's seniors' Muni English source + drop the `sourceEn` override in
`export-live.ts` (R's file: surgical), the two English dictionary rows. (4) Part c: the lang-scan in en + zh-Hant over every
new wave-9 screen; fix leaks.

**G · games & discovery** (5907) — owns `play/**`, `eggs/**`, `economy/records.ts` / `economy/items.ts` (APPEND),
new `ui/PlayDex.tsx` + its tab registration in `ui/Journal.tsx` (surgical; Q owns the file), `ui/MapFilters.tsx`,
`ui/mapFilterRules.ts`, `ui/CityMapList.tsx` (filtering), `ui/mapIcons.ts`. Work: (1) **R§5 #13 the 游乐图鉴** journal tab:
every game (≈ 22) with where / one-line rule / best medal (`economy/records.ts BEST_ROWS`), silhouette + clue when unplayed,
「带我去」 to the exact game spot (N's goTo); the map's 「玩」 filter + game icons (filter chips filter the list too, R§6 UI
row); Ask BAYBAY 「附近能玩什么」 (nearest 3); trips that end at a game spot. (2) **Hide & seek**: hide on the player's side;
a curb hint 「从斑马线过去」; time-out → a reveal + a few coins; no offWalk spots; the right clue (Pier 14, not Treasure Island);
no auto-turning camera; stable hot / cold. (3) Small games (R§6 play rows): claw rules + a 3 s blinking countdown before
the auto drop; a big toy + cheer on the claw result; the grip's live score cumulative (no 100 → 14); 那是什么？ only targets
in view and large enough, medals by ratio; a renewable 「今日小游戏」 reward (§4); neighbours' name tags (Ray); the foghorn
prop + radius 3. (4) w8 NEXT #9 / #11: landscape layouts for the SF game panels (`play/sfgames*.css`), `play/zones3.ts` →
`./sfgames8` through `importRetry`, a game start waits for its panel chunk.

**C · camera, reveals, city looks** (5908) — owns `actors/camera.ts`, `actors/cameraModes.ts`, `actors/reveal.ts`,
`actors/cityViews.ts`, `actors/CameraRig.tsx`, `actors/view.ts`, `actors/viewField.ts`, `actors/glide.ts` (landing
heading), `data/sf/arrivals.ts`, `world/environment.ts` (city look), `world/sf/lights.ts`, `world/sf/look.ts`, the
parked-car layer, `play/bell.ts` (the lean camera only, surgical). Work: (1) **R§5 #15 reveals**: the occlusion ray counts
tree canopies (`canopySource`) and hides NPCs in front; viewpoints for the overlooks and Coit Tower; Lombard's curves in
frame, Painted Ladies without the cone tree, Twin Peaks facing downtown / the Bay Bridge when BAYBAY says so; a pelican
landing turns to the arrival heading and plays the reveal. (2) Rides: the cable-car lean auto for 3 s each segment +
「按住 L 探身」 + disabled when parked (R§6 world row); the Powell ride camera never stuck between buildings; the N line in
Cole Valley off the wall; 「窗外是 X」 lines only when X is in view (the line's owner file: surgical). (3) **Time-bound**:
before 9 Oct the Fleet Week photo framing at Marina Green's seawall (the parade + jets in frame, w8 S-P3); before 31 Oct no
parked cars on Waverly Place while the festival kit is up (w8 H-RP-5). (4) Looks: Chinatown's night lanterns lit
(emissive) + a little neon; the things BAYBAY names at Pier 39 / Blue Heron Lake visible or the lines gated; a scroll
zoom-out not saved across sessions beyond a sane distance (`actors/camera.ts`); the Alcatraz waiting-for-boat camera; the
Golden Gate south ground overlaps if cheap. Higgsfield ≤ 30 (side-by-side wins only).

**P · cold start, budgets, WebGL** (5909) — owns `game/GameRoot.tsx`, `game/firstFrame.ts`, `world/warmup.ts`,
`vite.opus.config.ts`, `tests/opus-bay-sf-budget.test.ts`, `game/importRetry.ts`, `game/lazyChunk.ts`,
`game/chunkLost.ts`, `ui/glHealth.ts`, `game/w5Features.ts` (unfrozen for the `importRetry` wrap only),
`scripts/opus-sf/qa/perf/**`, the Start readiness in `ui/TitleScreen.tsx` (surgical). Work: (1) **R§5 #4 cold start**: all
programs compiled before the first frame (`renderer.compileAsync` + `programsLinked()`, or no frames until ready), the
warm-up in batches that yield (no 3.5 s title freeze: the language pills and 「直接看攻略」 stay live), Start shows 「准备中…」
disabled + `aria-busy` until ready; measure like `C:/Users/willy/opus-qa/review-1001/gapfill/cold/` (idle machine, fresh
profile, click-at-title vs wait-10 s, desktop + phone 4×) before / after; `scripts/opus-sf/qa/perf/cold-start.mjs` (P75
Start → first control, longest task, title freeze) for W9-Z. (2) **No WebGL / software GL** (R§6 tech row): probe before
mount; stay on the title with 「直接看攻略」 + links to /this-month and /calendar and a clear message; SwiftShader detected →
quality low + a note; the context-lost card's words by device (R§6 language row). (3) **GameRoot**: ≤ 258.5 guard, target
255 (w8 NEXT #7 moves); you keep the guard — every new module of this wave lands outside GameRoot (extend the budget test as
lanes push). (4) w8 NEXT #11: a loading state for a retried panel, close-on-lost per panel, `w5Features.ts` loaders through
`importRetry`.

**A · input, accessibility, robustness** (5910) — owns `ui/Dialogue.tsx`, `ui/Settings.tsx`, `ui/hooks.ts`,
`ui/moreMenu.ts`, `ui/slots.ts` (the modal stack), `game/interactables.ts`, `ui/iosTouch.ts`, the history part of
`OpusBayPage.tsx`, the colour / focus tokens in `opus-bay.css` (surgical; Q owns the css), `data/save.ts` (one
`onWriteFailure` hook only, §4). Work: (1) Menus (R§6 UI rows): Esc and Space = cancel in BAYBAY menus (Space never picks
item 1); a focus trap in `aria-modal` cards; the HUD `inert` while faded (Q's `Hud.tsx`: surgical); the Ask menu ≤ 6 items
+ 「更多」, contextual order, a number key for every row; Esc then Q never stacks two panels (one modal stack); E priority:
activity / pickup > place card > BAYBAY, E ignored 400 ms after a dialog closes. (2) The back button / gesture closes the
open panel first (history state), never strands the player. (3) Contrast (R§6 tech row): white on the primary teal ≥ 4.5:1,
an opaque 2 px focus ring, the title key hints ≥ 4.5:1, body text ≥ 13 px. (4) Settings: music / effects / voice volume,
「只关语音」, text size 100 / 115 / 130 %, the camera slider's accessible name (X provides the audio API). (5) Storage
failure → one notice 「这次的进度无法保存（浏览器禁止了存储）」. (6) The typewriter text out of `aria-live`; an `.ob-sr` mirror
says the whole line once. (7) A keyboard-only run: title → choice → dialogs → map → Settings → back.

**Q · phone & layout** (5911) — owns `*.css` under `src/opus-bay/` except `play/*.css` (G), `ui/album.css` (S),
`realsf/*.css` (R), plus `ui/Hud.tsx`, `ui/Journal.tsx`, `ui/CityMap.tsx`, `ui/MapPanel.tsx`, `ui/StationPanel.tsx`,
`ui/SubwayOverlay.tsx`, `ui/sheetDrag.ts`, `game/hudLayout.ts`, `game/hudLayoutSlot.ts`, the layout of
`ui/RideBanner.tsx`, `scripts/opus-sf/qa/overlap-scan.mjs`. Work: (1) w8 NEXT #9 + R§6 UI rows: the map sheet during a ride
on desktop; `RideBanner` `PAD_ROW` wrapping; the 667×320 time offer over the Metro card; `CityMap firstOpenView`; the
shop tile label; the HUD and 这周去哪 buttons never jump; the journal tabs (two rows or a scroll hint; 足迹 never cut); the
flyer's 「带我去」 ≥ 44×44 (R's file: surgical css); body text ≥ 13 px on phones; 844×340 / 667×320 for every card. (2)
Zoom 175 % on desktop and large text on phones: title, 这周去哪, map search, a place card, Settings never break. (3) iOS safe
areas, the soft keyboard over the map search, a rotation mid-flow. (4) Part c: the overlap scans (390×664, 375×553,
667×320, 844×340, 390×844, 1440×900) on every new wave-9 surface as it lands on origin (F's card / ribbon / coach, N's
stuck / chapter / resume cards, R's free strip, S's share card, G's 游乐图鉴, A's Settings) — fix overlaps (their css:
surgical, named).

**H · Halloween night, Muertos, seasons** (5912) — owns `halloween/**` except `index.ts`, `season.ts`, `rewards.ts`
(frozen), `realsf/dressing.ts`, `realsf/seasons.ts`, the big-night greeting in `realsf/todayLine.ts` (surgical). Work: (1)
**Nobody has played these yet** (review gaps): 31 Oct night (`?date=2026-10-31T19:30`), the festival
(`?date=2026-10-31T12:00`, Waverly Place), 2 Nov's procession (`?date=2026-11-02T19:10`) and `?halloween=night|muertos`, on
390×844 and desktop: the treat streets and the trick-or-treat flow over the 44 doors, the procession's route / camera /
bubbles, the festival kit; fix what is off (a table). (2) The returning greeting on the big night (`todayLine.ts`); 「1–30
October」 wording; w8 P2 doors 22 / 26 and Belvedere 4–7. (3) Crowd trims where the 4× phone read 44–54 fps (Waverly Place 31
Oct, Aquatic Park 9 Oct) — counts, never fps claims. (4) 3 Nov: the decor comes off cleanly.

**X · voice, sound, listening** (5913) — owns `game/voiceW5.ts` (the binder), `data/sf/voiceW*.ts` + new
`data/sf/voiceW9.ts`, `audio/**`, `scripts/opus-sf/voice/w9/**`, `public/opus-bay/w9/**`, `docs/opus-bay/ledger/w9-X.md`,
`docs/opus-bay/qa/w9/X/voice/listening.md`. Work: (1) A coverage script + test: every fixed BAYBAY line (zh + en) and
whether it has a clip; the coverage % in the report. (2) Record w8 NEXT #10 (GRIP_LINES.short, SLED_LINES.short, the
pelican's later line as fixed + toast, the today line, `w8-w2-lake-1893` retake, the pagodas line without "yellow", an
Alcatraz return-boarding line), then every line in `C:/Users/willy/opus-qa/w9/new-lines.md` at ≈ 02:00 and ≈ 02:40. (3)
One voice at a time under F's arbiter; a dropped bubble never plays its voice. (4) Sound defaults (R§10 risk: music in
public): music starts lower / after the first gesture; the audio API for A's Settings (`setMusicVolume`,
`setEffectsVolume`, `setVoiceVolume`, voice-only mute). (5) The owner's listening sheet. Higgsfield ≤ 60.

Everyone: `src/opus-bay/**` outside your row only for a surgical fix you name. **Frozen** (the lead only; write the exact
change under Requests): `core/**` (S may APPEND event types to `core/events.ts`), `data/playSave.ts`, `data/save.ts`
(A's one hook excepted), `halloween/{index,season,rewards}.ts`, `economy/hints.ts` `HINT_KINDS`, `economy/ledger.ts` caps,
`world/palette.ts`, `package*.json` (no new dependencies), the site outside the rows of E / L / S. **District mode never
changes.** The backend checkout (`C:/Users/willy/OneDrive/Desktop/baylink-backend`) and the main checkout are read-only.

## 4. Contracts (on origin by 23:45 unless noted)

- **Attention** (F) `game/attention.ts`: `requestSlot(level: 'title' | 'action' | 'line', id, { priority?, minMs?, firstVisit? })
  → { granted, release() }` plus `onSlotFree(cb)`; a tiny module outside GameRoot. N's stuck / chapter / resume cards, S's
  share toast, G's game prompts and R's arrival re-open use it from part b on. Until it lands, write the call behind
  `attention?.` so a rebase is one line.
- **Entry source** (E) `ui/entrySource.ts`: `entrySource(): 'home' | 'nav' | 'play' | 'photo' | 'family' | 'share' |
  'guide' | 'promo' | 'direct'` read once from `from=` (then removed from the URL with `replaceState`).
- **Today headline** (R) `realsf/todayLine.ts todayHeadline(now, locale) → { zh, en, action? } | null` (pure). **Travel
  profile** (R) `realsf/prefs.ts getPrefs() / setPrefs()` in its own key `opus-bay:prefs:v1` (honours `?save=off`; no save
  bit).
- **Metrics** (S) `game/metrics.ts track(name, bucket?)` (no-op until loaded; never throws; nothing personal, no free text,
  no coordinates). Lanes emit through `core/events.ts` where an event exists; S appends the types it needs.
- **Warm-ready** (P) a store flag / hook the title's Start reads (`warmReady`), set when every program is linked.
- **Rewards**: new activities keep the `medal:` prefix; G's renewable 「今日小游戏」 uses a date-keyed source inside the
  existing ledger caps (no new cap, no save bit; if the ledger cannot, the reward is cosmetic — say so).
- **Voice**: lines are matched by exact zh + en text; **a reworded voiced line goes silent** until X re-records it — append
  every new or changed fixed line to `C:/Users/willy/opus-qa/w9/new-lines.md` (`lane · file · line id · zh · en`) by
  01:45 and push it. Templated bubbles cannot be voiced (fixed line + toast / pin).
- **Lazy**: GameRoot has ≈ 0.2 KB of static room: every new module is a lazy chunk through `importRetry` / `lazyChunk`.

## 5. Protocol

As `sf-w8-lead.md` §5 with `w9` for `w8` (one agent per lane in its worktree and port; `cd /c/Users/willy/wt/w9-<id> && `
first; at most one headless Chrome per agent; PERF-LOCK `C:/Users/willy/opus-qa/w9/PERF-LOCK`; tsc 0 · `npx eslint .` 0
errors · the opus-bay suite fail 0 before every push — **lanes E, L and S also run the site tests they touch** (`npx tsx
--tsconfig tsconfig.app.json --test tests/<file>`) and E runs `npm run build` once to its own outDir before its last push;
commits `W9-<ID><n>: …` + the Co-Authored-By line; push = fetch + rebase origin/opus-bay + push HEAD:opus-bay; never stash /
merge / force / main / PR). The RESUME's ten wave-8 rules apply (lens results go to fixers as files: lens reports are
written to `C:/Users/willy/opus-qa/w9/<id>-rc/findings.json` / `-rp/findings.json` too).

## 6. Decisions (defaults; the owner does not want to be asked)

- **Scope**: the review's §7 "本周 Quick wins" and "2–4 周" items, the Top 15 and the time-bound items of `sf-w8-summary.md`
  §6 — no new districts, no new landmarks, no art overhaul (review §8 "不建议做").
- **The /play switch** is the owner's: "当 OPUS-BAY 没问题的时候，就可以替代 PLAY". "没问题" = W9-Z's switch gate: `npm run
  check` green; every review Top-15 item done-verified or explicitly accepted; the cold-start gate (no freeze > 1 s after
  Start; Start disabled until ready) and the first-minute gate (≤ 3 messages) pass on desktop and phone; 0 lookbehind in
  `dist`; the /opus-bay shell shows no homepage flash; home card / nav / `/play` / old ticket links land where they should
  (zh, zh-Hant, en); perf and sweep as wave 8. Fail → W9-Z reverts the `W9-E-switch…` commits only and the rest can still
  go live. `LittleBayPage` and its features stay in the repo.
- **Names** (review §10.1): the site's 3D product is 「小小湾区 · Little Bay」 (the nav keeps that name and now opens the
  game); the game's title stays 「湾区小旅 · Little Bay Trip」; no user-visible "Opus Bay" (URL `/opus-bay` stays; the eyebrow
  becomes 小小湾区 · BAYLINK).
- **Metrics**: no backend edit tonight (another agent's checkout with uncommitted work; a deploy is the owner's): the
  frontend is ready, `official_source_click` counts now, the `opus_*` events wait for the owner to apply
  `docs/opus-bay/w9-backend-metrics.patch` and flip `OPUS_METRICS_LIVE`.
- **Site files** (GPT's): only the rows of E / L / S, surgical, with the site's tests; anything else → Requests.
- **Higgsfield** (357.27 on 1 Oct 05:30, all usable, shared account): X ≤ 60, C ≤ 30, a reviewer ≤ 2 for a retake;
  never below 20.
- **Go-live**: on W9-Z's GO the lead merges `origin/main` once more if GPT pushed, runs `npm run check`, fast-forwards
  `main`. The owner confirms the deploy (the lead's curl of the live site is refused by a permission check).

## 7. Run shape (Ultra workflow)

As wave 8 (`sf-w8-lead.md` §7): lanes → per lane two read-only lenses (code & facts `wt/w9-<id>-rc`; player `wt/w9-<id>-rp`,
port + 20) → one fixer (`wt/w9-<id>-rev`, port + 40, "## Review (Ultra)") → W9-I three lenses (5961–5963) + fixer
(`wt/w9-int`, 5964, `sf-w9-integration.md`) → completeness critic → bounded fix pass W9-C (5965) → W9-Z alone (5970,
`sf-w9-final-verify.md`, GO / NO-GO for the go-live and for the switch).
