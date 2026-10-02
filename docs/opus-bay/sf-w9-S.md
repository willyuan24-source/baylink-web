# Wave 9 · lane S · share & metrics

Lane S of wave 9 (plan `docs/opus-bay/sf-w9-lead.md` §3 S, §4 "Metrics", §6 "Metrics"; review
`docs/opus-bay/review-2026-10-01-first-use.md` R§5 #8, #9, §8 ideas 2 and 5, §9). Worktree `C:/Users/willy/wt/w9-s`
(branch `w9-s`), dev port 5905, scratch `C:/Users/willy/opus-qa/w9/s/`. Times PDT, 2026-10-01 → 10-02. Two agents: the
first worked 21:36 → ≈ 01:30 (S1 pushed; S2, S3 committed) and was stopped by the account's usage limit; the second
resumed at 02:14, checked and pushed S2 + S3 (02:30), built and pushed S4 (04:15) and S5.

## 给主人的摘要

1. **照片能"带人回来"了**：相册里的照片底部印上 `baylink.us/opus-bay` 和一个小二维码，扫码直接打开游戏、站在拍照的地方（`?at=…&from=photo`）。分享时标题是「湾区小旅」，带上链接；日期改成「10月1日」这样的短格式；微信等 App 拒绝分享时，改为"长按图片保存"或下载，不再"点了没反应"。
2. **新增「约家人」卡片**：活动卡、地点卡、「我的周末」都有「约家人」按钮，一键生成一张竖版图片（日期、地点、费用、怎么坐车去、二维码），微信里长按就能保存或转发到家人群，扫码直达同一个地点（`from=family`）。中文、繁體、英文都会按读者语言出图。
3. **开始有数据了**：游戏里点开官网/来源链接，现在会计入站点已有的 `official_source_click` 计数（不带任何个人信息，DNT/GPC 时不发）；从游戏打开 BAYLINK 自己的页面都会带 `from=opus-bay`。评测第 9 节的整套漏斗（入口来源、冷启动分档、四选一、首张卡、真实行动、分享、回访、一日游章节）已经在游戏里计数，但**要等后端加白名单才发送**。
4. **需要主人做一件事**：把 `docs/opus-bay/w9-backend-metrics.patch` 应用到 baylink-backend 并部署，然后把 `src/opus-bay/game/metricNames.ts` 里的 `OPUS_METRICS_LIVE` 改成 `true`，游戏的 39 个计数才会真正上报。

## Commits (all on `origin/opus-bay`)

| commit | what |
|---|---|
| `6009e776` W9-S1 | the metrics contract: `game/metrics.ts track(what, bucket?)` (an emit on `core/events.ts`, 0 bytes for GameRoot callers), `game/metricNames.ts` (the 39 `opus_*` names, `OPUS_METRICS_LIVE = false`, `linkAction`, `withGameFrom`), `core/events.ts` APPEND `{ type: 'metric' }`, `src/lib/product-events.ts` types only |
| `97f5c359` W9-S2 | photos carry the way back (R§5 #8): the city card's band prints the caption, `BAYLINK · baylink.us/opus-bay` and a QR code to the photo's spot; share = 湾区小旅 / Little Bay Trip + the url; refused share → long-press / download; short date |
| `0174982f` W9-S3 | the metrics runner (R§5 #9): the review §9 funnel counted in memory, `official_source_click` sent, `from=opus-bay` on the site's links opened from the game, the backend patch `docs/opus-bay/w9-backend-metrics.patch` |
| `249ecf01` W9-S4 | the 约家人 card: event / place / 我的周末 → a vertical PNG with a QR code to `?at=…&from=family`; buttons on lane R's cards (surgical) |
| W9-S5 (the report's commit) | `realsf/addCal.ts` (lane R, surgical): 加到日历 counts `opus_real_action_ics`; this report |

## Part 1 — photos (R§5 #8 first half) · W9-S2

Before (review, `phone/shots/photo-export.jpg`): the card's band said 「湾区小旅 · 金融区 · 南滩 · 2026年1…」 + BAYLINK — no
address, no code, the date cut; the share was `{ title: 'Opus Bay', text, files }` with no url; a host app's refused
share did nothing.

- `game/photoCard.ts` (new, pure + the lazy `qrcode` chunk): `gameLink(at, from)` = `https://www.baylink.us/opus-bay?at=<spot>&from=photo|family`
  (the canonical host whatever host took the shot; a bad `at` is dropped); `photoSpot(x, z)` = the nearest landmark /
  curated place within 60 u (a readable id `game/resume.ts` resolves), else `xz:<x>,<z>`; `bandLayout()` (the band ≥ 160 px
  so the code keeps ≈ 3 px a module at WeChat's ≈ 1280 px; the QR box clear of every shop-frame ring); `loadQr()`
  (error correction M); `drawQr()` (whole-pixel module edges).
- `game/photo.ts`: only the CITY card changes (district mode is drawn exactly as before).
- `ui/shareFile.ts`: `sharePayload(nav, file, { title, text, url }, asSave)` — the url where the browser takes it with a
  file, else in the text, else the file alone; 保存 stays the file alone (iOS keeps 存储图像); `refusedShareRoute()`:
  AbortError (the player's own cancel) ends it, anything else falls back to the long-press photo (in-app / iOS) or a
  download.
- Files are `little-bay-trip-<Bay date-time>.jpg`; the shutter's caption date is 10月1日 / Oct 1 (`ui/Moments.tsx`, lane
  F's file, one line).

Verified: `tests/opus-bay-w9-s-photo.test.ts` 9/9 (jsQR decodes the drawn code at card size and box-filtered to 1280 px;
the band clear of the ring at 6 sizes). Played: desktop at Coit Tower → card 1520×1142, the code decodes to
`…?at=telegraph-hill&from=photo` also from a 1280 px JPEG q .7; phone 390×844 at Alamo Square → 523×1233, decodes.
`docs/opus-bay/qa/w9/S/photo-card-*.jpg`.

## Part 2 — metrics (R§5 #9, review §9) · W9-S1, W9-S3

No backend edit tonight (plan §6). The API (baylink-backend `origin/main` fef792c, read only) accepts 9 names and answers
any other name with 400 while still spending the visitor's write rate limit, so:

- **Sent today**: `official_source_click` — an official / source page opened from the game, through the site's
  `recordProductEvent` (no id, no referrer, no URL; nothing under DNT / GPC).
- **Counted, not sent** (until the owner applies the patch and flips `OPUS_METRICS_LIVE`): `opus_title`,
  `opus_start_<home|nav|play|photo|family|share|guide|promo|direct>` (lane E's `entrySource()`),
  `opus_cold_start_<lt10|10to30|gt30>` (Start → the first frame after play begins), `opus_mode_<tour|week|free|local|resume>`,
  `opus_first_card` (≤ 60 s), `opus_real_action_<plan|official|maps|guide|offer|ics|event|wish>`,
  `opus_share_<photo|card>`, `opus_visit_new` / `opus_returning_<1d|7d|30d>` (one Bay day kept on the device, never under
  `?save=off`), `opus_tour_<ch1..ch5|done>`. `metricsLog()` (from `game/metricsRun.ts`) shows them for QA.
- **Caps**: a funnel step once a page, an action / share ≤ 5, ≤ 40 sends a page.
- **Cost**: `game/metricsBoot.ts` sits in the album's city chunk (`game/album.ts initAlbum`), loads `game/metricsRun.ts`
  1.5 s after the world's first frame, city mode only — 0 bytes in GameRoot (≈ 258.3 KB, unchanged by this lane).
- **from=opus-bay**: a capture listener adds it to the site's own links inside the game page (all ≈ 60 anchors,
  `LinkButton` or not); other sites' links never change.
- **The patch** `docs/opus-bay/w9-backend-metrics.patch`: `lib/productMetrics.js` (`OPUS_EVENTS`, the 39 names, added to
  `PRODUCT_EVENTS`) + `tests/productMetrics.test.js` (the site's 9 names; every game name once; extra fields refused).
  Checked on a `git archive` export of fef792c: `node --test tests/productMetrics.test.js` 10/10.

Verified: `tests/opus-bay-w9-s-metrics.test.ts` 11/11; played with `?from=family` → `opus_title, opus_start_family,
opus_cold_start_lt10, opus_mode_free, opus_first_card, opus_real_action_official, opus_real_action_event` in memory and
one POST `{"event":"official_source_click","locale":"en"}`; the clicked /events link became `…?lang=en&from=opus-bay`,
foodwise.org / Maps links unchanged (W9-S3's message has the details).

## Part 3 — the 约家人 card (R§5 #8 second half, §8 idea 5) · W9-S4

Before: no share button on any card (event, place, 想去 / 我的周末); WeChat drops links, so a picture with a code is the
only way back.

- `ui/shareCardModel.ts` (pure): `eventCard` / `placeCard` / `weekendCard` → kicker, title, rows (日期 · 地点 · 费用 or 开放
  · 怎么去 = the two nearest real Muni lines with the stop and the walk from `realsf/transitReal.ts`), the QR link
  `…?at=xz:<x>,<z>&from=family` (an event's world spot; an event in another city: no `at=`, the game's start), the file
  `baylink-<id>.png`. Days are absolute and short (10月3日 · 周六 / Sat, Oct 3: the card is read later, elsewhere).
  我的周末: ≤ 5 rows + 「还有 n 个」, a cost only when it is free (each event's own card has the rest).
- `ui/shareCardDraw.ts`: 1080 px wide, 1350 … 2160 tall, in the site share card's style (`src/lib/share-card-svg.ts`:
  cream paper, the deep-green frame, a pale-green band with two waves, BAYLINK, the dark pill, the code in a white
  box). Text is wrapped with `measureText` (CJK by character, Latin by word, kinsoku: 、。）· never start a line); an
  English card uses Latin-first fonts (a CJK face drew ’ full-width: "New Year’ s" on the first Coit Tower card).
- `ui/ShareCard.tsx` (the overlay `c-share-card`, its own lazy chunk, registered by the city's boot): the picture as a
  data: image (a long press saves / forwards it in WeChat & co.), 保存 / 分享 the album's way, catalog words through
  `catalogText` (English cards read "Ferry Plaza Farmers Market: A Waterfront Stroll"), the date line and the cost
  through lane R's `data/publicText.ts` like the event card (W9-R5 landed during this part: never the editors' working
  notes; a 繁體 card converts them too — played zh-Hant: 約家人 · 這個週末 / 週六 / 免費), `track('share', 'card')`.
- `ui/ShareCardButton.tsx`: 约家人 / Invite family; nothing where the overlay is not registered (district mode).
- Lane R's files (surgical, one import + one line each): `ui/EventCardBody.tsx`, `ui/PoiCardBody.tsx`, `ui/PlaceCard.tsx`,
  `realsf/TodayTab.tsx` (我的周末's actions, when it lists something).

Verified: `tests/opus-bay-w9-s-card.test.ts` 8/8 (the painted code decodes with jsQR at 1080 px and box-filtered to
60 %). Played (`C:/Users/willy/opus-qa/w9/s/card-probe.mjs`): desktop 1440×900 en and phone 390×844 touch zh-Hans — the
Ferry Plaza market's card → 约家人 → a 1080×1924 / 1080×1816 picture whose code decodes to `…?at=xz:132,15&from=family`
from the PNG and from a 0.6× JPEG q .7; Coit Tower's card (`…?at=xz:-50,46&from=family`) and a 我的周末 card likewise.
The first try pushed the sheet's buttons to y 1161 on a 900 px screen; `album.css` now keeps the whole picture and both
buttons in view (sheet 480×738 desktop / 362×702 phone). `docs/opus-bay/qa/w9/S/family-card-*.jpg`.

## Part 4 — 加到日历 counts (W9-S5)

Lane R's 「加到日历」 (`realsf/addCal.ts`, W9-R3) builds the .ics through a lazy chunk and clicks an anchor outside the
game page, which the link listener does not see: `addToCalendar()` now calls `track('real', 'ics')` (one import + one
line, named here and in the commit; `tests/opus-bay-w9-s-ics.test.ts` red before — no metric event — green after). The north-star "real actions" of review §9 are now all wired: plan · official ·
maps · guide · offer · event (links), wish (the wishlist), ics (this), card shares.

## Decisions

- The card is drawn on a canvas, not the site's SVG renderer: the site's card is 1200×630 landscape (an OG image) and
  embeds a logo + font through the server; a phone canvas has the system's CJK fonts and makes a PNG directly.
- The card's code points at the world spot (`xz:`), not the venue's lat/lng: `ll:` of an event outside San Francisco
  would place the player off the map.
- The share counts as sent when the share sheet resolves, when a download starts, or on the first long press of the
  picture (once per opening) — WeChat gives no other signal.
- No BAYBAY lines were added or changed by this lane (buttons, toasts and the card's words are UI text, not voiced):
  nothing appended to `new-lines.md`.

## Not done

- The `opus_*` counters are not sent until the owner applies the backend patch and flips `OPUS_METRICS_LIVE`.
- The 约家人 card was not tried inside the real WeChat app (no device here): the long-press relies on the data: image +
  `-webkit-touch-callout: default`, the same path the album's long-press photo (W7-Q4) uses.
- An event outside the game's San Francisco has no world spot: its card's code opens the game's start (still `from=family`).

## Requests

- **Owner**: apply `docs/opus-bay/w9-backend-metrics.patch` in baylink-backend (`git apply`, `node --test
  tests/productMetrics.test.js`), deploy the API, then set `OPUS_METRICS_LIVE = true` in
  `src/opus-bay/game/metricNames.ts`. Until then only `official_source_click` reaches the counter.
- **W9-I / reviewers**: try 约家人 on an iPhone (Safari and WeChat) — 分享 with the file + url, 保存 to Photos, the long
  press.

## Where to look first

- `docs/opus-bay/qa/w9/S/family-card-place-phone-zh.jpg` (the phone sheet), `family-card-event-desktop-en.jpg`.
- An event card → 约家人 (city mode, e.g. the Ferry Plaza market); Coit Tower's card → 约家人; the journal's 今天 tab →
  我的周末 with a saved weekend event → 约家人.
- The album: take a photo, open it, the band's code; 分享 on desktop copies the link.
