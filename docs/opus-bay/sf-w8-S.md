# Wave 8 · lane S · site sync, real dates, places — report

Lane S owns `realsf/**` (except lane H's `dressing.ts` / `seasons.ts` and lane A's `alcatraz*`), `scripts/opus-sf/export-live.ts`,
`public/opus-bay/sf/v1/live.json`, `tests/opus-bay-w6-s-*` + new `tests/opus-bay-w8-s-*`, the TEXT of `data/sf/placeCards*.ts`,
`data/sf/landmarks.ts`, `data/sf/extraPlaces.ts`, the text of the `data/sf/attractions.ts` rows (lanes A / W1 / W2 own
theirs) and the new `world/sf/fleetWeek*.ts` (lead note `sf-w8-lead.md` §3). Worktree `C:/Users/willy/wt/w8-s` (branch
`w8-s`), dev port 5806, scratch `C:/Users/willy/opus-qa/w8/s/`, QA images `docs/opus-bay/qa/w8/S/`.

## 给主人的摘要

1. 网站同步：GPT 9/30 的三个提交（服务预约、小队出游、AI 草稿）没有改动活动、优惠和新店数据，游戏里的活动点、纪念章、新店牌子、`live.json` 全部仍和网站一致；游戏能打开的网站链接（活动、优惠、新店、12 篇攻略、日历、计划页）全部能打开，已加测试。
2. 我决定**不在游戏里放「一起去 · 小队」入口**：小队是网站给成年人约陌生人一起出门的功能（要登录、2–8 位成年人），玩具城不该直接把玩家带过去；游戏里的活动卡本来就链到网站活动页，那里有网站自己的「一起去」。
3. 65 岁以上免费 Muni 的来源链接改成 SFMTA 英文官方页（网站原来指向越南语页）；舰队周三天的「今天」页新增一行「蓝天使通常下午三点左右上场 · 以官网为准」，BAYBAY 在码头绿地也会说这句（以前只有离得远才说）。
4. **舰队周「舰船巡游」做好了**：10/9 上午 11:00–12:00（游戏里的湾区时间），一艘红色消防船喷着水领头，后面六艘灰色玩具军舰（手机上四艘，没有武器细节、没有旗帜和舷号）从金门大桥下开进来，沿码头绿地、水上公园外侧开到海湾大桥下；11:20 在码头绿地正好看到船队经过。BAYBAY 当天会提醒、带路去码头绿地，按 E「拍舰船巡游」拍到船队就得纪念章 + 15 金币。只多 2 个绘制调用，不进首屏包。

## Part a · re-sync with the site after GPT's three day-0 commits (W8-S1)

Written 2026-09-30 ≈ 19:20 PDT.

### What was checked

- **What GPT's commits changed** (`git diff 94ae2ae4 e5f375e6`, 65 files): service booking (`/me/bookings`), small-group
  outings (`/together`, `src/lib/outings.ts`, the BayBay assistant's 找搭子一起去 tile, the event page's 查看或发起小队 link),
  outing AI drafts (`/ai/outing-draft`), legal pages, the water-lantern promo as WebP. **Not changed**:
  `public/planner-catalog.json`, `src/data/october-offers.ts` (`currentFreebies`), `src/data/local-discoveries.ts`
  (`currentOpenings`) — their last commit is still `b4f71de8`, merged by W7-0c.
- So the world's sync from wave 7 holds, and the existing guards say so on this tree: the venue test (every SF event of
  29 Sep – 30 Nov shown — 47 — or kept out for a stated reason), the souvenir / name guard, the openings test (6 signs =
  the 6 open / soft-open SF openings; Handroll Hawker is still `announced` in `src/data/september-openings.ts`, so still
  no sign), the link test (`/events/:id`, `/openings/:id`, `/offers/:id`): lane S's 9 test files **43 / 43**.
- **`live.json` re-exported** through `scripts/opus-sf/export-live.ts`: the same 14 offers; the only diffs are the two
  changes below.

### What was built

- **`scripts/opus-sf/export-live.ts`**: a `sourceEn` override per offer — the site's `sfmta-free-muni-seniors.sourceUrl` is
  SFMTA's Vietnamese page (`https://www.sfmta.com/vi/node/12193`); the game now links the English page of the same
  program, https://www.sfmta.com/fares/free-muni-seniors-ages-65 (read 2026-09-30: "All San Francisco seniors, ages 65+,
  with a gross annual family income at or below 100 percent of Bay Area Median Income level are eligible", apply first,
  "free access to Muni services, including cable cars, when using a Clipper card"). The export fails as soon as the
  site's own source changes ("drop the sourceEn override"), so a later fix by the site's editors cannot be masked. The
  export's `exported` stamp is now the Bay date (it wrote the UTC date: an evening export read tomorrow).
- **`realsf/calendar.ts`**: a new row `fleet-week-blue-angels-2026` (Oct 9–11, 15:00, Marina Green, grade *secondary* →
  以官网为准): "飞行表演 12:00–16:00 · 蓝天使通常下午三点左右上场". Sources (read 2026-09-30):
  https://fleetweeksf.org/events/air-show/ ("October 9, 10, 11, 2026", "12:00 Noon - 4:00 PM", the Blue Angels the
  headliner, no slot posted) and https://www.navyweek.org/fleetweek/san-francisco/ ("often around 3 p.m.", "roughly 45
  minutes"). No `catalogId` (a calendar row never makes an event card; the air show is the catalog's own event). The
  Parade of Ships row's note now says the fireboat leads from the Golden Gate to the Bay Bridge (source re-read
  2026-09-30).
- **`realsf/jets.ts`**: the hedged Blue Angels line (`jets-blue`, unchanged text, voiced in wave 7) is offered wherever
  the player is on a show day before 15:00 — wave 7 offered it only > 300 u from Marina Green, so a player already on
  the lawn never heard it (the W7 review's open item).
- Tests: new `tests/opus-bay-w8-s-site.test.ts` (4): every BAYLINK guide the city links (places.json, the landmark
  infos, the place cards, the 今天 tab's walks: 12 slugs) is a prerendered page in `vercel.json`, `/guides`,
  `/this-month`, `/calendar`, `/plan` are prerendered and `/my-week` opens the SPA; the game's sources link no
  `/together` or `/me/bookings`; the seniors' row links the English page and no `live.json` source is a translated SFMTA
  copy; the Blue Angels row. Surgical: `tests/opus-bay-w5-calendar.test.ts` (the seniors' source may be the English
  page while the site still has the Vietnamese one) and `tests/opus-bay-w7-s-dates.test.ts` (the parade row's check
  date 2026-09-30, Oct 9 has two rows).

### Decisions

1. **No outings hook in the game.** `/together` is the site's small-group feature for adults (2–8 adults including the
   host, sign-in, host approval, `noindex`); the toy city has players of every age and should not send them to strangers'
   meetups. The path stays: an event card → `/events/:id`, where the site's own 一起去 sheet links 查看或发起小队. The new
   test pins that the game opens neither `/together` nor `/me/bookings`. BayBay's outing drafts (`/ai/outing-draft`)
   likewise stay on the site.
2. **The seniors' source**: the game shows the English original and keeps the site's label; the request to fix the
   site's own `sourceUrl` stays open (Requests).
3. **The Blue Angels** stay hedged: the organiser posts no time; the calendar row and the line both say 通常 · 以官网为准.

### Evidence

- On the part-a tree: `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 warnings, all old) · the
  opus-bay suite **1664 / 1664** (149 s).

### Requests

- **The site's editors (via the owner / GPT)**: `sfmta-free-muni-seniors.sourceUrl` in `src/data/october-offers.ts` →
  https://www.sfmta.com/fares/free-muni-seniors-ages-65 (then delete the `sourceEn` override in `export-live.ts`: the
  export says so); add the Chinatown Halloween Festival (Sat 31 Oct, 11:00–15:00, Waverly Place,
  https://www.cycsf.org/chinatown-halloween-festival/) to the catalog — both still open from wave 7.

## Part b · Fleet Week · the Parade of Ships (W8-S2)

Written 2026-09-30 ≈ 20:10 PDT. Resumed from the first agent's local WIP commit `97b2b0b0` (never pushed): its code was
sound and was kept; the WIP commit was dropped and replaced by this proper commit (the S1 commit was re-worded with
its checks and pushed as `987a8780`; its one stray edit, `const H =(h…` in `export-live.ts`, was fixed before the push).

### What was built

- **`world/sf/fleetWeekDay.ts`** (tiny, imports only the Bay clock): `PARADE_DAY` 2026-10-09, `PARADE_FROM` / `PARADE_TO`
  11:00 / 12:00, `paradeWindow()`, `isParadeDay()`, `paradeOn()`, `PARADE_SOURCE`.
- **`world/sf/fleetWeek.ts`** (a lazy chunk; `realsf/index.ts` imports it only on the parade's Bay day):
  - a red toy **fireboat** with three arcs of water beads (the SFFD fireboat leads, "shooting jets of water into the
    air") and **six grey toy ships** in line astern 45 u apart (four on phones): plain haze-grey hulls, a dark boot-top,
    deckhouses, a mast and a funnel — no weapons detail, no flags, no lettering, no hull numbers;
  - one path over open water (19 control points, ≈ 1,915 u): in from outside the Golden Gate, under the main span,
    ≈ 90 u off Crissy Field and Marina Green, between Aquatic Park's pier and Alcatraz, outside the harbour ferry's loop
    along the Embarcadero, and under the Bay Bridge's west span between towers W2 and W3 (mast tops 1.4 u under the toy
    deck) to the open Bay. The fireboat is under the Golden Gate at 11:00, passes Marina Green ≈ 11:16 (the last ship
    ≈ 11:24), Pier 39 ≈ 11:31, the Bay Bridge ≈ 11:45; the last ship reaches the end at 12:00 (≈ 0.55 u/s). Ships grow
    out of / sink into the water over 20 u at the two far ends. The positions follow the Bay clock;
  - **2 draw calls** (one InstancedMesh for the grey line, one for the fireboat, ONE material on the city's
    `ob-toy-inst` program: no new shader), 3,208 triangles on high, 2,400 on phones; built only while the parade is on
    and the player is within 1,100 u of a ship; per frame only ≤ 7 instance matrices and two bounding spheres (pooled
    poses, no per-frame objects);
  - **BAYBAY** (fixed lines, below): on the day before 11:00 far from Marina Green 今天上午十一点有舰船巡游… + the waypoint
    to the Marina Green spot; during the parade far away 舰船巡游开始啦…; near the **fireboat** 看，领头的消防船…; after the
    first photo with a ship near and in frame the Parade of Ships **stamp + 15 coins** (`event:fleet-week-2026-parade`;
    `SOUVENIR_IDS` appended after the W7 ids, `EVENT_SAY` 舰队周舰船巡游 / the Parade of Ships);
  - during the parade the Marina Green spot (the jets' `WATCH`, the parade's reviewing stand) says **拍舰船巡游 /
    Photograph the ships** and opens photo mode facing the nearest ship (`jets.ts setWatchOverride`, from W8-S1; the jets
    keep the spot the rest of the show day).
- **`realsf/index.ts`**: loads the chunk on the parade's Bay day, offers its lines **before** the jets' (on 9 Oct the
  scheduler says the parade at 11:00 before the noon air show), `said()` / teardown; `__opusRealSF.parade()` and
  `offered().parade` for QA.
- **Changes to the WIP while finishing it**: the near line is offered only while the fireboat itself is within 260 u
  (the WIP offered it near any ship: at the tail of the line the fireboat is 270 u ahead); the parade's lines are
  ordered before the jets'; the speed comment corrected (≈ 0.55 u/s, not 0.62).
- **Calendar**: the row `fleet-week-parade-of-ships-2026` (from W7, re-read in W8-S1) is the parade's 这周 / 今天 entry.

### New fixed BAYBAY lines for lane X (exact zh + en; voice ids `realsf-<key>`)

| key | zh | en |
|---|---|---|
| `parade-day` | 今天上午十一点有舰船巡游，从金门大桥下开进湾里，去码头绿地看吧！ | At 11 this morning the Parade of Ships sails in under the Golden Gate — let’s watch from Marina Green! |
| `parade-now` | 舰船巡游开始啦，船队正沿着海边开向海湾大桥！ | The Parade of Ships is on — the ships are sailing along the shore to the Bay Bridge! |
| `parade-near` | 看，领头的消防船一边开一边喷水！打开拍照，把船队拍下来吧～ | Look — the fireboat leads the way, spraying water! Open the camera and get the ships in a shot! |
| `parade-photo` | 船队拍到啦，舰船巡游纪念章收好！ | Got the ships! A Parade of Ships stamp for your journal! |

No new overlay: the parade opens no panel (the photo uses photo mode), so nothing goes into lane K's
`BAYBAY_HOLD_OVERLAYS`; its lines go through `realsf/index.ts`'s scheduler, which already holds on `baybayHeld()` (W8-K1).

### Facts (checked 2026-09-30)

- https://fleetweeksf.org/events/parade-of-ships/ (re-read 2026-09-30 ≈ 19:30 PDT): "Friday 10/9 11:00 am - 12:00 pm",
  "See the ships of 2026 San Francisco Fleet Week sail under the Golden Gate Bridge", "The procession of ships can be
  seen from the Golden Gate Bridge to the Bay Bridge, with the reviewing stand at the Marina Green", "The San Francisco
  Fire Department will lead the parade with their fire boat shooting jets of water into the air". The page names no
  ships and no foreign navies: the toy line is generic grey ships (§6: no weapons detail, no foreign flags).

### Evidence

- `tests/opus-bay-w8-s-fleet.test.ts` (7 tests): the window (on 11:00–11:59 of 9 Oct only; the calendar row agrees;
  through `__setBayNowForTests`); the line's timing (the fireboat under the main span at 11:00, 45 u spacing, the last
  ship at the end at 12:00, nothing outside the window, 7 ships high / 5 phones, a ship < 200 u from Marina Green at
  11:20); **the path over open water** on the real city disk (every 4 u sample is water with no shore within 25 u, except
  on the Golden Gate's walkable deck; > 80 u from Alcatraz; > 30 u from the harbour ferry's loop; the Bay Bridge
  crossing between W2 and W3 ≥ 30 u from both towers); budget (≤ 3.5k triangles on high, one `ob-toy-inst` material,
  the mast top 1.4 u under the Bay Bridge's deck, ≤ 9 flat toy colours, no saturated flag colours on the grey ships);
  the lines (fixed, ≤ 45 zh width, no weapons words) and the appended souvenir; the lazy chunk (no static import; the day
  check imports only the Bay clock; not in GameRoot / cityWorld); the runtime (`initFleetWeek` with the pinned Bay clock:
  `parade-day` at 09:00 far away, `parade-now` at 11:20 far away, `parade-near` at Marina Green as the fireboat passes,
  none there at 11:40, nothing after 12:00 or the next day). 7 / 7; with lane S's other files, the jets, calendar and
  realsf tests 49 / 49; `tsc` 0.
- **Played** (dev server 5806, headless Chrome `--force_high_performance_gpu`, `?world=city&start=free&save=off&date=…`,
  the player placed with the DEV `fastTravel.placePlayer`); calls · triangles from `__opusBay.city.stats()` with the
  parade, then with its group hidden in the same session:

  | spot | Bay time | view | with the parade | without | parade |
  |---|---|---|---|---|---|
  | Marina Green (the reviewing stand, `WATCH`) | 11:20 | desktop 1440 × 900, high | 74 · 120.0k | 71 · 116.8k | 7 ships, 2 calls, 3,208 tris |
  | Aquatic Park beach | 11:26 | desktop, high | 78 · 133.1k | 77 · 130.7k | 7 ships, 2 calls |
  | Golden Gate Bridge, mid-span deck | 11:01 | desktop, high | 39 · 86.6k | 38 · 84.5k | 6 on the water, 2 calls |
  | Marina Green | 11:20 | phone 390 × 844 dpr 3, mid | 59 · 99.5k | 58 · 97.8k | 5 ships, 2,400 tris |

  (a call of the difference is walkers.) All far under the 150 calls / 400k budget.
- At Marina Green at 11:20 the E prompt reads **Photograph the ships · The Parade of Ships**; E opens photo mode turned to
  the ships; the shutter paid the stamp (`offered().parade` gained `parade-photo`; the album's "Saved to your album").
  BAYBAY's `parade-now` set the waypoint pill **The Parade of Ships** (seen from Aquatic Park).
- Images: `qa/w8/S/s2-parade-aquatic-park-2026-10-09T1126-desktop.jpg` (three grey ships in line beyond Aquatic Park's
  pier, the Golden Gate behind), `qa/w8/S/s2-parade-marina-green-2026-10-09T1120-phone.jpg` (the line passing Alcatraz,
  the 拍照 button labelled Photograph the ships), `qa/w8/S/s2-parade-marina-green-prompt-2026-10-09T1120-desktop.jpg`
  (the prompt; the fireboat at the right edge).

### Decisions

1. Toy ships stay generic: the organiser names no ships; a grey line with a red fireboat at its head reads as the
   parade without copying a real ship, insignia or hull number.
2. The fireboat's line only near the fireboat; the parade's lines before the jets' on 9 Oct.
3. The ships are visual only (no collider): nobody stands on the water, and the harbour ferry's loop is ≥ 30 u away.

### Known gaps

- **Photo mode at Marina Green's seawall frames the ships at the top edge**: the photo camera is lifted by its terrain
  avoidance behind the player (rig pitch 0.04, the camera's rotation ≈ −0.43 rad), so horizon subjects sit high; the
  stamp still pays (the ships are in frame) and the player can zoom / drag. The jets' photo goes the same way. Camera
  code is lane K's (`actors/camera.ts`): a request below.
- Lane A's new Alcatraz ferry (Pier 33 ↔ the island) crosses the parade's line if it runs between ≈ 11:25 and 11:35;
  the boats pass through each other for a few seconds (no colliders). Left (one hour, once).
- Under this sky the hulls' long sides are dark when the key light is low and astern (edge-on to it); the superstructure
  and the stern read grey. Left (lighting, not paint).

### Requests

- **Lane K** (camera): in photo mode the face request's low pitch is undone by the terrain lift behind the player
  (Marina Green seawall: `cameraRig.pitch` 0.04, `camera.rotation.x` ≈ −0.43): for a photo spot facing the water, keep
  the camera over the walkway (or let the face request choose the orbit side), so the parade and the jets sit mid-frame.
- **Lane X**: the four lines above (`realsf-parade-day`, `-now`, `-near`, `-photo`).
