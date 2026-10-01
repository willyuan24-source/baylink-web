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
