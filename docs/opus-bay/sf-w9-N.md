# Wave 9 · lane N — guide, trips, the Grand Tour

Lane N of wave 9 (plan `docs/opus-bay/sf-w9-lead.md` §3 N), worktree `C:/Users/willy/wt/w9-n` (branch `w9-n`), dev port
5903, scratch `C:/Users/willy/opus-qa/w9/n/`. Review refs: R§5 #n = the first-use review's Top-15 item n
(`docs/opus-bay/review-2026-10-01-first-use.md`), R§6 = its other-issues tables. Times PDT.

## 给主人的摘要

1. 带路不会再"卡死不动"：BAYBAY 带你走路时，20 秒没有进展就会出手——近的路（60 米内）直接黑屏一下把你送到，远的路弹出卡片「这段路被挡住了」让你选［飞过去］［换条路］［我自己走］。
2. 一日游第 1 章金门大桥那段（下车后要绕悬崖 259 米才能到 30 米外的游客中心）现在直接送达；自己推摇杆脱困不再被当成"不要带路"，后面每一段照样自动带。
3. 一日游不再先问「完整版 / 快速版」，直接出发；中途回来时「继续一日游 · 第 n 章」的章节号修好了（以前每到章节交界都少 1）。
4. （part b / c 的结果写在下面各节。）

## Part a — stuck (R§5 #7), the tour's first fixes (21:35 → )

**What the review saw** (gapfill/tour-full log 274 → 649 s; gapfill/tour2 chip-293 … chip-651; phone g2–g14): after the
sightseeing bus at the Golden Gate, the carried walk to the Welcome Center (quote 9 s) gave up after three silent retries
and the player stood 6 min; at Lands End the player was pinned and their own escape counted as a takeover, so every later
leg of the tour needed the chip; in SoMa the walk retried 3 × in 45 s under "BAYBAY 带路中" and stopped quietly.

**Reproduced** on the dev server (`C:/Users/willy/opus-qa/w9/n/leg.mjs`, the tour seeded at chapter 1 with the player at
the GGB drop-off): the carried walk leaves the stop eastward, pauses ≈ 3 s at (−636.3, 637.5) (the review's stuck spot:
the long-route fetch), goes on round the cliff (−578, 624) → (−600, 600) and arrives after 42 s; the pill / beacon time
rose 9 → 25 s on the way (`ggb1/log.jsonl`). On the real terrain in node: the stop → Welcome Center is 30 u straight and
**259 u** on foot (the local A* and `routeTo` agree); Lands End's drop-off → Sutro 24 u / 47 u (graph), Ocean Beach's →
the windmill 20 u / 20 u.

**Done**
- `game/autoTravel.ts` — the carried walk's **watchdog**: no progress (moving 3 u from the last spot that counted; a detour
  that first leads away counts) for **20 s** while free to walk → `giveup` (`why: 'stall'`); its clock stops in a dialogue,
  a panel, a ride or while stepping aside for a car. The old 3-fails rule stays (`why: 'fails'`). **Escape**: the stick /
  WASD / a tap while the walk is stuck (a failed re-issue, or 5 s without progress) is the player getting out, not a
  takeover — BAYBAY carries on 1.2 s after they let go. `autoEndReason()` / `noteAutoEnd()` tell a takeover from a give-up.
- `game/tripRun.ts` — the **rescue** on a give-up: within 60 u (straight) the way is **delivered** under the veil
  (`lineRides.veiledSkip` with the runner's words "BAYBAY 带你绕过去…", the player and BAYBAY set down on walkable ground,
  carrying on); farther, the **stuck card** (a BAYBAY card: 「这段路被挡住了，我们怎么走？」 [飞过去] [换条路] [我自己走];
  hidden ask items run the answers): 飞过去 = the rest of the trip as one pelican hop; 换条路 = a detour spot on rings of
  10 / 16 / 24 u round the player (standable, the local A* both ways, nearest the target first, ≤ 16 checks) walked to
  first, else delivered; 我自己走 = carrying off (the tour still carries the next legs). **A short way that walks far
  round is delivered at once**: once per carried leg the route cache (the planner's A*) is asked; a way ≤ 60 u straight
  whose route is > 3 × and > 80 u longer (or none exists) is delivered (the GGB stop → Welcome Center: 30 / 259 u).
  F's attention arbiter (`game/attention.ts`, §4) is not on origin yet: the card is a dialogue now; it moves into the
  title slot when F's module lands.
- `game/cityTour.ts` — carrying stays on for the next legs unless the player took over (`autoEndReason() !== 'takeover'`);
  `resumeIndex` (the save's chapter = the first open stop's, not the stop just reached: "继续一日游 · 第 n 章" said one
  less at every boundary, R§6 growth row); **no 完整版 / 快速版 question** (R§6: 7 minutes apart, on top of the time
  toast): `start` begins the full tour; a saved express run still resumes as one; `chooseCityTourVersion` keeps the old
  node for QA.
- `game/lineRides.ts` — `roomySpot`: off at a loop / Metro surface stop the rider gets 0.9 u of room (rings ≤ 3 u, kept
  2.3 u off the line), not a pinned corner; `veiledSkip(…, text)` takes the runner's words.
- `ui/GuideLayer.tsx` — the tour's lead chip 「让 BAYBAY 带我过去」 hands the walking back to the carried walk
  (`tourNext`: watchdog and card included) instead of `walkTo` the same blocked way again.

**Verified**
- Live (dev 5903, `ggb2/`): the same seeded GGB leg is delivered within ≈ 1.3 s of the stop's trip starting (phase
  `dwell` at the Welcome Center, (−700.3, 604.8)); before: 42 s round the cliff here, 6 min stuck in the review.
- `tests/opus-bay-w9-n-stuck.test.ts` (9 tests; red before: no `stall` give-up, the stuck stick was a takeover, the
  resume chapter one less): the watchdog, a detour that leads away is progress, the escape, the end reason, the rescue
  choice, 换条路's spot, `resumeIndex`, and **the Golden Gate, Lands End and Ocean Beach drop-offs reach their next stop
  within 2 × the quote on the real terrain** (GGB delivered; Lands End 47 u, Ocean Beach 20 u walked at the carried pace).
  The SoMa leg: the phone reviewer's "no headway" case (verify-phone phone-2: fails at 12 / 23 / 34 s, give-up at 46 s)
  now gives up at 20 s into the card (the watchdog test); the leg itself did not reproduce (verify-phone: 68 s from YBG).
- Updated (never deleted): `opus-bay-w5-nav` (the give-up says why), `opus-bay-w5-tours` (a give-up keeps the tour
  carrying; a takeover still turns it off), `opus-bay-sf-tripflow` (no version question).
