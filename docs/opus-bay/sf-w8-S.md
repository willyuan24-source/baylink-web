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
4. **舰队周「舰船巡游」做好了**：10/9 上午 11:00–12:00（游戏里的湾区时间），一艘红色消防船喷着水领头，后面六艘灰色玩具军舰（手机上四艘，没有武器细节、没有旗帜和舷号）从金门大桥下开进来，沿码头绿地、水上公园外侧开到海湾大桥下；11:20 在码头绿地正好看到船队经过。BAYBAY 当天会提醒、带路去码头绿地，按 E「拍舰船巡游」拍到船队就得纪念章 + 15 金币。只多 2 个绘制调用，不进首屏包。船队航线后来又调整过，避开 A 线新做的恶魔岛渡轮航道（只横穿一次）；当天早上码头绿地的提示也改成「看看舰船巡游」。
5. 50 张地点卡补上了开放时间或价格（今天逐个查官网：市立公园 5:00–24:00、国家公园海滩 6:00 到日落后 1 小时、海湾水族馆成人约 28 美元、Tadich 周日休息等；公共小巷/台阶写「全天可走」）；坎德尔斯蒂克州立公园的时间改成官网的 7:00–19:00。剩下 8 张（演出场馆、在翻修的朴茨茅斯广场等）写明了原因。

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

## Part c · the place cards without hours or a price (W8-S3)

Written 2026-09-30 ≈ 20:40 PDT. W7-R left ≈ 60 cards (mostly the short priority-4 ones) with neither hours nor a price.

### What was built

**50 cards** gained an `hours` and / or a `cost` line (zh + en, hedged like the rest: 以官网为准 / 以现场为准 / 约), each
re-dated `verifiedAt: '2026-09-30'`, the page it comes from added to `sources` where it is not the card's own source
(`data/sf/placeCards.ts` 10 full cards, `data/sf/placeCards2.ts` 40 short cards; text only). Sources, all read
2026-09-30:

| group | cards | the line | source |
|---|---|---|---|
| city parks (Rec and Park) | Alta Plaza, Buena Vista, Glen Canyon, Ina Coolbrith, Lafayette, McLaren, Mountain Lake, Patricia's Green, India Basin, Grand View, the Bison Paddock, Murphy Windmill (+ the cost of Seward St slides, Huntington Park) | 每天 5:00 到午夜开放（市公园规定，以官网为准）· 免费 | SF Park Code §3.21 https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_park/0-0-0-46781 ("Persons may enter and use any park from 5:00 a.m. to midnight daily"; the page answers 403 to scripts: read through the search index); Rec and Park's own pages for Ina Coolbrith (https://sfrecpark.org/Facilities/Facility/Details/Ina-Coolbrith-Park-175: "Park Hours 5 a.m. to Midnight") and Patricia's Green |
| the national park (GGNRA) | China Beach, Sutro Heights | 每天 6:00 到日落后 1 小时 · 免费 | https://www.nps.gov/goga/planyourvisit/hours.htm ("open from 6 a.m. until 1 hour after sunset") |
| | Baker Beach, Fort Funston | 大部分地方全天可去，停车场日出到日落 · 免费 | the same page ("GGNRA is accessible 24 hours a day in most areas, parking lots are open between sunrise to sunset") |
| other open spaces | Mount Sutro | 日出到日落，风速超过每小时 40 英里时关闭 · 免费 | https://www.ucsf.edu/about/locations/mount-sutro-open-space-reserve (search index) |
| | Heron's Head Park | 公园 5:00 到午夜；生态中心自然区周六 10:00–16:00 · 免费 | https://sfrecpark.org/facilities/facility/details/Herons-Head-Park-Nature-Exploration-Area-447 |
| | Crane Cove Park, Visitacion Valley Greenway | 免费（Crane Cove: kayak / paddleboard launch, paid rentals from Dogpatch Paddle) | https://www.sfport.com/cranecovepark; the greenway is a public park (its card's source) |
| public ways | Balmy Alley, Clarion Alley, Macondray Lane, Lyon St Steps, Greenwich Steps, Hidden Garden Steps, the 16th Ave Tiled Steps, Vermont St, Calle 24, Union St, Clement St, Irving St, Haight-Ashbury, Maiden Lane, Harvey Milk Plaza, the Ingleside sundial, Cupid's Span, the Yoda fountain, the Wave Organ, the Sentinel Building, the Chinese Telephone Exchange | 公共小巷 / 阶梯 / 街道，全天可走 · 免费 / 逛街免费; outdoor works 全天可看 | the cards' own sources (public streets, stairs and outdoor works) |
| | the Women's Building | 壁画在外墙上随时可看；楼内自助参观周二 10:00–15:30 · 看壁画免费 | https://www.womensbuilding.org/our-building/the-mural |
| venues | Aquarium of the Bay | 成人约 28 美元，4–12 岁约 20 美元，65 岁以上约 24 美元（预购价） | https://www.aquariumofthebay.org/tickets ("Adult (13-64): $28.25", "Child (4-12): $20.25", "Senior (65+): $24.25") |
| | Boudin at the Wharf | 隔着约 30 英尺长的观察窗看师傅做面包，免费 | https://boudinbakery.com/boudin-at-the-wharf/ |
| | the Buena Vista Cafe | 约周一至周四 9:00–23:00，周五 9:00–24:00，周六 8:00–24:00，周日 8:00–23:00 | https://www.thebuenavista.com/ |
| | Tadich Grill | 约周一至周五 11:00–21:00，周六 16:00–21:00，周日休息；可订位 | https://www.tadichgrillsf.com/ |
| | Glide Memorial Church (quiet) | 每周日 9:00 和 11:00 有礼拜，欢迎所有人 | https://www.glide.org/church/ |
| | Candlestick Point SRA | **changed**: 约每天 7:00–19:00 (the card said sunrise to sunset) | https://www.parks.ca.gov/candlestickpoint/ ("7:00 am to 7:00 pm") |

Re-checked and **unchanged** (2026-09-30): SS Jeremiah O'Brien (daily 10–4, $20 general — ssjeremiahobrien.org/visit-us),
MoAD (Tue–Sun, Thu to 8 pm, $15 adults, every Second Saturday free — moadsf.org/visit), the Chinese Historical Society
(Wed and Sat 10–5 — chsa.org/visit), the Children's Creativity Museum (Wed–Sun 10–4, $20 for age 1+ —
creativity.org/hours-admission), the Tenderloin Museum (Tue–Sat 10–5, $10 / $6 / under 13 free — tenderloinmuseum.org),
Haas-Lilienthal tours (select Wed / Sat, $10 — haas-lilienthalhouse.org/house-tours), the Railway Museum (Tue–Sun 12–5,
free — streetcar.org/museum), the Presidio Officers' Club (Fri–Sun 11–4, free — presidio.gov), the fortune-cookie
factory (Mon–Fri 9–6:30, weekends 9–7 — goldengatefortunecookies.com/visit). Hyde Street Pier stays **closed** (NPS:
"Hyde Street Pier is closed at this time"; the ships open some weekends at Mare Island) — its status line holds.

### Not filled (reason)

- Balboa Theatre, SFJAZZ Center, The Fillmore: per-show tickets; their pages gave no hours / price to quote (SFJAZZ
  answered 403, the Fillmore's page lists no box-office hours). Palace Hotel's Garden Court: its page answered 403
  (the search index says Saturday tea 12–2 pm; not on an official page we could open). Bayview Opera House: the site
  (now rwoh.org) lists events but no hours. Moscone Center: open for events only (not re-read). Portsmouth Square:
  closed for its renovation (status line). The full cards of the universities and churches keep their notes (working
  campuses / services) — not part of W7-R's short-card list.

### Evidence

- `tests/opus-bay-w8-s-cards.test.ts` (2): the 50 ids re-dated 2026-09-30, each with hours or a price, valid
  (`placeCardProblems`), hours hedged, a price with a number hedged; the short cards still without either are exactly
  the eight above; the sources behind each group (the park code, the GGNRA page, the venues' pages), the Aquarium's
  three prices, Tadich's 周日休息, Glide still quiet, Candlestick's new 7:00–19:00; no free public place gained a price.
- Surgical: `tests/opus-bay-sf-cards.test.ts` (lane C's wave-4 file) allows `verifiedAt` 2026-09-30 next to 09-27 /
  09-29. `sf-cards` + `w7-r` + `w8-s-cards` + `w8-s-site`: 27 / 27.

### Decisions

- Public streets, alleys and stairs say "全天可走" from their own nature (a public right of way), not from a page; parks
  use the park code unless a park page says otherwise; no price is written where no official page states one.

## Part d · the parade beside lane A's Alcatraz ferry, its morning prompt, the owner's live dates, small words (W8-S4)

Written 2026-09-30 ≈ 21:30 PDT.

### What was built

- **The parade and the new Alcatraz ferry** (lane A's W8-A1 landed after W8-S2): the Alcatraz boat runs Pier 33 ↔ the
  island on two lanes along z ≈ −100 … −131 (`data/ferry.ts ALCA_OUT / ALCA_BACK`), and the parade's line ran 226 u of
  its path within 30 u of them — beside the ferry's lanes all the way from x ≈ −330 to Pier 33's end. Three control points
  of `PATH_POINTS` moved out (−322, −98) · (−270, −160) · (−170, −176) · (−40, −168): the line now **crosses the lanes
  once** (≈ 106 u of path within 30 u, a quick, steep crossing at x ≈ −330) and then runs ≈ 40 u outside them and
  ≥ 55 u outside the harbour ferry's loop. The path is ≈ 1,940 u (≈ 0.56 u/s); the timings barely move (Marina Green
  11:16 → 11:24, Aquatic Park 11:23 → 11:31, Pier 39 ≈ 11:32 → 11:40, the Bay Bridge 11:46 → 11:54).
- **The Marina Green spot on the parade's morning**: until 11:00 on 9 Oct it reads **舰船巡游 · 码头绿地 / Parade of Ships ·
  Marina Green — 看看舰船巡游 / See the Parade of Ships** and opens the Fleet Week card (the waypoint BAYBAY's
  今天上午十一点… line sets now names the parade, not "Air show · Marina Green", which starts at noon); 11:00–12:00 the
  photo prompt (W8-S2); after 12:00 the jets' own. `fleetWeekDay.ts paradeWatchState(date)` ('soon' / 'on' / null) is
  pure; `fleetWeek.ts` invalidates the interactables when it changes.
- **`world/sf/fog.ts`** `setGoldenTint`'s comment: it said the Halloween world pushes × 0.18; `DUSK_TINT` has been
  × 0.35 since W7-H1 (comment only; lane H's dusk setter untouched).

### The owner's live dates (the world's functions on this tree, then the moments marked ▶ played)

From `C:/Users/willy/opus-qa/w8/s/dates.mts` (`activeEventsAt`, `calendarOn`, `calendarLines` at a far point, `jetsUp`,
`blueLineOn`, `paradeOn`, `halloweenPhase`, `sunTimes`) over the site's real catalog:

| Bay time | world events open (event @ venue row) | calendar rows | jets · parade | Halloween | sunset |
|---|---|---|---|---|---|
| Thu Oct 1 00:05 | — | — | — | **season** (live at midnight) | 18:52 |
| Fri Oct 2 12:00 | Hardly Strictly @ hellman-hollow | — | — | season | 18:51 |
| Sat Oct 3 10:30 | the market + Foodwise Latine Makers @ ferry-building, Hardly Strictly | — | — | season | 18:49 |
| Sun Oct 4 13:00 | Litquake @ YBG, Castro Street Fair @ castro-market, Hardly Strictly | — | — | season | 18:48 |
| ▶ Fri Oct 9 09:00 | — | Parade of Ships, **Blue Angels** | jets no (+ blue line) · parade day | season | 18:40 |
| ▶ Fri Oct 9 11:20 | — | Parade of Ships, Blue Angels | **parade sailing** (+ blue line) | season | 18:40 |
| Fri Oct 9 12:40 | Fleet Week @ marina-green | Parade of Ships, Blue Angels | jets up (+ blue line) | season | 18:40 |
| Sat Oct 10 12:30 | the market, Fleet Week | Blue Angels | jets up (+ blue line) | season | 18:39 |
| ▶ Sun Oct 11 13:00 | Fleet Week, Inner Sunset Flea, YBG Dance Day, Italian Heritage Parade @ jefferson-powell | Blue Angels | jets up | season | 18:38 |
| Sat Oct 17 12:00 | the market, Potrero Hill Festival, the Marina library open house, the Pumpkin Fest, the Science Festival, FilBookFest, the Fall Show | — | — | season | 18:29 |
| Sun Oct 18 12:00 | Sunday Streets Excelsior, the Fall Show, FilBookFest | — | — | season | 18:28 |
| Sat Oct 24 12:30 / 15:00 | the market, Exploratorium family day, Chowder Fest, Thrill-O-Ween; + Bay Beats at the bandshell from 14:00 | — | — | season | 18:20 |
| ▶ Sat Oct 31 12:30 | the market, the Halloween Hoopla @ YBG | Halloween, Chinatown Halloween Festival | — | night | 18:12 |
| Sat Oct 31 19:30 | Figaro opening @ the Opera House | Halloween, Chinatown festival | — | night | 18:12 |
| Sun Nov 1 00:30 / 10:00 | — | DST ends (BAYBAY's past-tense line only from 02:00: none at 00:30, `calendar-dst-end-2026` at 10:00) | — | muertos | **17:11** |
| Mon Nov 2 12:00 / 19:30 | — | Día de los Muertos | — | muertos | 17:10 |

Played (dev server 5806, desktop 1440 × 900 high unless said; `save=off` = a first visit, which is always golden light
by design — the shots look like late afternoon whatever the hour):

- **Oct 9 09:00**, Marina Green (`qa/w8/S/s4-parade-morning-prompt-2026-10-09T0900-desktop.jpg`): the E prompt **See the Parade of Ships · Parade of Ships · Marina Green**; E opens the
  San Francisco Fleet Week card (air show 10/9–11 12:00–16:00). `offered()`: `jets-blue` (the player is at the lawn:
  the far-away day lines are not offered there).
- **Oct 9 11:20 / 11:26 / 11:01** (part b): the line at Marina Green, Aquatic Park, the Golden Gate deck; the photo stamp.
- **Oct 11 13:00**, Jefferson & Powell (W7-S's heaviest overlap: the Italian Heritage Parade's kit, Fleet Week, the jets
  up): **86 calls · 281.1k triangles** (desktop high) — under the 150 / 400k budget; BAYBAY's waypoint pill "The jet
  formation".
- **Oct 31 12:30**, Waverly Place: `offered().calendar` = `calendar-chinatown-halloween-festival-2026` (BAYBAY's festival
  line), 119 calls · 329.2k (Chinatown, the city's busiest spot); lane H's festival kit was not on origin yet when shot.
- Not re-shot (unchanged since W7-S part d / lane H's own runs): Oct 2–4, 17, 18, 24; Nov 1 (the 今天 tab's DST row);
  Nov 2 (lane H's procession).

### Small words: decided, not changed

- **The Belvedere doors' pill (内日落 · Carmel St)**: the area comes from the city's neighbourhood polygons through
  `data/cityZones.ts cityAreaAt` (lane K's), the street from the nearest centreline (Carmel St meets Belvedere there);
  BAYBAY's line calls the street 贝尔维德街 (Cole Valley). Both names are used for that block; changing the zone grid or
  adding a non-landmark area to `LANDMARK_AREAS` (tested against places.json anchors) is lane K's call — left, recorded.
- **`cable:powell-geary` ok → CORRIDOR at Union Square**: W7-Z's sweep — the stop is open along Powell St and closed
  across it since W2's Union Square terraces; two ways open is within the CORRIDOR waiver. Moving a planter is lane W2's
  landmark (`union-square.ts`), not lane S's data — left, recorded.

### Evidence

- `tests/opus-bay-w8-s-fleet.test.ts` + 2 (9 / 9): the line crosses the Alcatraz ferry's lanes exactly once, ≤ 130 u of
  path within 30 u of them (the old path measured 226 u with the same metric, scratch `alca.mts`); `paradeWatchState` 'soon' 06:00–10:59, 'on'
  11:00–11:59, null after 12:00 and on other days. The water / shore / bridge / timing tests still pass on the new path
  (also `pathcheck.mts`: no shore within 25 u off the Golden Gate's deck).
- `npx tsc` 0 · `npx eslint` of the touched files 0 (the full checks before the push: below the commit).

