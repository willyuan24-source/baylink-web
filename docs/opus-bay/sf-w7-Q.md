# Wave 7 · lane Q · iPhone & phone readiness

Worktree `C:/Users/willy/wt/w7-q` (branch `w7-q`), dev port 5702, scratch `C:/Users/willy/opus-qa/w7/q/`, QA images
`docs/opus-bay/qa/w7/Q/`. Brief: `sf-w7-lead.md` §3 row Q and the iOS scout (`C:/Users/willy/opus-qa/w7/day0/scout-ios.txt`).

## 给主人的摘要

1. iPhone 上点「开始」后第一段声音（雾笛、音乐、BAYBAY）不响的问题修好了：现在点「开始 / 继续旅程」的那一下就把声音"解锁"，不用再点第二下。Chrome 证明不了苹果的规则，所以要你在真 iPhone 上听一下（见 `iphone-checklist.md` 第 1 步）。
2. 语音缓存加了上限（最多约 32 MB / 64 段），长时间玩不会再越吃越多内存导致 iPhone 刷新页面。
3. 如果手机把游戏画面的显存收回（黑屏/卡住），现在会先存档，再弹出一张小卡「画面需要重新加载 · 重新载入」，点一下就回来。
4. 相册：「保存」只发图片本身（iPhone 的「存储图像」不会再消失）；在微信里点「保存」不再假装"已保存"，而是把大图摆出来，提示「长按图片保存到相册」；手机切到后台很久再回来，相册照片也能打开了。
5. iPhone 细节：双指捏合不会再把整个游戏放大；长按 BAYBAY 头像不再弹出系统图片菜单；横屏字不会被放大；地图搜索收起键盘后画面归位；到站提示的英文名只占一行；设置和标题页会提示「没声音？iPhone 可能开了静音模式」；`?debug=1` 多了两行 iPhone 专用信息，截图给我就能看懂。
6. 横屏（带 Safari 地址栏的 667×320 / 844×340）右边一列按钮以前「设置」被挤出屏幕外、标题页也被切掉，现在都放得下；小屏手机上的小铺不再只露一条缝。给你写好了 5 分钟真 iPhone 检查清单：`docs/opus-bay/iphone-checklist.md`（10 步，写了要截哪几张图）。

## Part a (2026-09-29 20:25–20:45 PDT): the audio unlock inside the Start tap · the voice clip cache cap · a lost GL context

### What was built

| # | what | files | API |
|---|---|---|---|
| 1 | **The audio unlock inside the Start tap.** WebKit (Safari and every iOS browser, WeChat included) starts an `AudioContext` only from inside a gesture's handler. The game's `start` event reaches `audio.ts` seconds after the Start tap (the page waits for the first frame and the play layer's parts), and `onGesture` returned while `phase === 'title'`, so on an iPhone the arrival foghorn, the music and BAYBAY's first line stayed silent until a second tap. Now a tiny, dependency-free page-chunk module is called **synchronously inside the click**: `OpusBayPage.start` (Start, 继续旅程, 从头开始 · 渡轮大厦, Enter) primes with `starting: true` (the context stays running for the arrival), the title's sound button primes when it turns sound on, and `audio.ts onGesture` primes on any other title tap (then the context is suspended again after 400 ms: the title stays quiet, and WebKit lets a context it once saw start inside a gesture resume later without one). If the audio chunk has not made its context yet, the tap makes it and `createContext` **adopts** it (one context per page); if it has, `createContext` **shares** it and the tap primes that one. `createContext` no longer suspends a context the Start tap left running. Chrome / Edge / Firefox / Android: nothing changes (`gestureUnlockNeeded` is false: sticky activation already works there, and opening an audio device inside a tap costs 110–370 ms on Windows — why `audio.ts` opens it at idle). `?unlock=1` forces the WebKit path in any browser (QA), `?unlock=0` turns it off. | new `audio/unlock.ts`; `audio/audio.ts` (`createContext`, `unlock` → `silentSample`, `activate` sets `audioProbe.activated`, `onGesture`, dispose `releaseAudioContext`, DEV `__opusAudio.stats().unlock`); `OpusBayPage.tsx` (`start`); `ui/TitleScreen.tsx` (`toggleSound`); `tests/opus-bay-w5-lang.test.ts` (the title-chunk guard allows exactly `audio/unlock.ts` and asserts it imports nothing) | `primeAudio({ starting? })`, `gestureUnlockNeeded(win?)`, `adoptAudioContext()`, `shareAudioContext(c)`, `releaseAudioContext(c)`, `silentSample(c)`, `audioProbe` |
| 2 | **An LRU cap on decoded voice clips.** `VoicePlayer.clips` kept every decoded `AudioBuffer` for the page's life (771 clips ship; a decoded 4 s line is 0.73 MB of native PCM: 100–300 MB in a long iPhone session, invisible to the Chrome perf gate). Now a Map in use order with two caps, **`CLIP_CACHE_BYTES` 32 MB** and **`CLIP_CACHE_MAX` 64 clips**; a use (a bark, a line, a cache hit in `load`) moves a clip to the end; past a cap the least recently used goes (fetched again from the HTTP cache and decoded when wanted). Never evicted: the six barks in both languages, the current stop's tour clips (`loadStop`, which `audio.ts preloadStopVoices` now calls — the next stop's list replaces the pins), and the null markers (absent / muted ids). `dispose()` drops the buffers. The numbers go to `audioProbe` for the ?debug line. | `audio/voice.ts` (`use`, `keep`, `trim`, `cacheStats`, `loadStop`); `audio/audio.ts` `preloadStopVoices` (one line) | `CLIP_CACHE_BYTES`, `CLIP_CACHE_MAX`, `clipBytes(b)`, `VoicePlayer#loadStop(ids)`, `VoicePlayer#cacheStats()` |
| 3 | **A lost WebGL context.** `webglcontextlost` → `preventDefault`, `flushSave()` at once, one small card **画面需要重新加载 · 重新载入** (zh-Hans / zh-Hant / en; the button reloads the page, 44 px tall), counted for ?debug. A back / forward-cache return (`pageshow` with `persisted`) and a tab made visible again check `getContext().isContextLost()`. No in-place restore (the scout: batched pools, canvas textures and merged cells do not rebuild cleanly). R3F forces a context loss ≈ 500 ms after the Canvas unmounts: by then the canvas has left the page, so that loss is ignored and the watch removes itself. GameRoot (lane P's) got one line in `onCreated`: `import('../ui/glHealth').then(m => m.watchGl(gl))` — the module is its own small chunk. | new `ui/glHealth.ts`; `game/GameRoot.tsx` (onCreated, surgical); `opus-bay.css` (`.ob-gl-lost*`) | `watchGl(gl, win?, doc?)`, `markLost(doc?)`, `glHealth` |

### Evidence

- `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · suite **1501 tests, 1499 pass**: the
  two failures were the title-chunk guard (fixed as above, then 8 / 8) and `W5-bus 20+ simulated minutes` (forced blockers
  29 vs ≥ 30 — the day-0 flake lane B is hardening; it failed alone at 29 too, as at day 0; nothing in this part touches transit).
- New tests (all green):
  - `tests/opus-bay-w7-q-unlock.test.ts` (6) — a WebKit stand-in whose context starts only inside a gesture:
    **the bug** with `?unlock=0` (the Start tap on the title, then `start` outside the gesture: the context stays
    `suspended`); the Start tap primes the idle-made context (running, no second context, not suspended again at the
    arrival); a tap before the audio chunk (the page makes it, `audio.ts` adopts it: one context; released on dispose);
    a title tap (not Start) unlocks, goes quiet after 400 ms, and the later `start` resumes without a gesture; Chrome /
    Android: nothing made; the UA table (iPhone Safari, CriOS, WeChat MicroMessenger, macOS Safari, iPadOS desktop mode vs
    Chrome, Edge, Android Chrome, Firefox).
  - `tests/opus-bay-w7-q-voice-cache.test.ts` (2) — 100 clips of 4 s loaded after the barks: 43 held (the byte cap binds
    first), ≤ 32 MB, the barks all kept, the newest kept and the oldest gone, `audioProbe` in step; least recently *used*
    goes first (a clip reused every step survives 80 loads), the stop's clips and the `zh-yay` null marker survive, an
    evicted clip is fetched and decoded again, the next stop's list unpins the previous one, `dispose` drops the buffers.
  - `tests/opus-bay-w7-q-glhealth.test.ts` (4) — the loss: `preventDefault`, the save written at once (it was waiting for
    1 s of quiet), one card in `.ob-page`, a second loss adds no second card and counts 2; `pageshow` persisted with a lost
    context shows it (a live context or a fresh load does not); a tab made visible again with a lost context shows it;
    R3F's forced loss after an unmount is ignored and the listeners are gone.
- Played (dev 5702, 390 × 844 dpr 3 touch, city, `?unlock=1&save=off`): on the title the audio chunk had made its context
  at idle (`ctxMs` 485, `suspended`, `shared: true`, 0 primes); the Start click → `primes 1, startPrimed true` in the same
  call; after the arrival `running`, `activated`, `unlocked: true`, the page's one context (`shared: true`, adopted false).
  Then `?start=free`, `WEBGL_lose_context.loseContext()` → the card over the frozen canvas with the HUD behind:
  `qa/w7/Q/a-phone-context-lost-card.jpg`.

### Decisions

- The unlock runs only where WebKit's rule applies (iOS / iPadOS browsers, desktop Safari): Chrome keeps the wave-6 path
  exactly (no audio device opened inside the tap, no context running on the title).
- A Start prime leaves the context running (the arrival is seconds away); any other title prime suspends it again after
  400 ms. The silent sample is played in every prime (the classic iOS unlock) and again at activation.
- Caps 32 MB / 64 clips: the 38 recorded city lines (≤ 2 s each) + 6 barks ≈ 12–15 MB warm at boot, leaving room for
  ≈ 20–25 tour / W5 / W6 clips. Evicted clips come back from the HTTP cache (decode only).
- No in-place GL restore; the card reloads. The card is plain DOM (no React), inside `.ob-page` so it gets the theme.

### Known gaps

- Chrome cannot prove WebKit's rule: the node stand-in models it (from WebKit's `AudioContext::willBeginPlayback`, which
  lifts the gesture restriction for a context once a gesture has started it). **The owner's device check**:
  `docs/opus-bay/iphone-checklist.md` step 1 (part c) — sound on, tap 开始 once, and the foghorn must be heard during the
  ferry shot without touching the screen again.
- The context-loss card was shot in Chrome with `WEBGL_lose_context`; iOS's own losses (memory pressure, background) can
  only be seen on a device (the ?debug line will count them, part b).

### Not done (part a)

- Everything from item (4) on: parts b / c.

### Requests

- None.

## Part b (2026-09-29 20:55–22:05 PDT): the album on phones · touch guards · the arrival subtitle · the silent-mode hint · the ?debug phone lines

Part a's push re-ran the checks after its rebase (it brought W7-G1): tsc 0, eslint 0 errors, **1506 / 1506** (the W5-bus
test passed in that run).

### What was built

| # | what | files | API |
|---|---|---|---|
| 4 | **The album on phones.** (a) **保存 shares the file only** (`{ files }`, no title / text: with a text item iOS treats the share as mixed content and can drop 存储图像, the album's point on an iPhone); 分享 adds the words only where `canShare` accepts them, else the file alone. (b) **In-app browsers** (WeChat `MicroMessenger`, Facebook, Instagram, LINE, Weibo, QQ, DingTalk, Alipay) and an iOS without file sharing: no dead `<a download>` and no false 照片已保存 — the photo is shown large as a **`data:` image** (a long press saves it in a WKWebView; a `blob:` one not reliably) with **长按图片保存到相册** (分享: 长按图片，保存或发给朋友) and a 好了 button; that image re-enables `-webkit-touch-callout`. (c) **IndexedDB reopens**: every operation runs through `run()`; a failure (iOS drops the connection after a while in the background: `InvalidStateError` / "Connection to Indexed Database server lost") closes the handle, reopens once and runs again; `onclose` / `onversionchange` drop the handle. Before, `photoFile` returned null (这张照片找不到了) and `addPhoto` switched the whole page to memory. (d) **A 3 s open timeout** (`ALBUM_OPEN_TIMEOUT_MS`): an open that never answers (iOS) no longer leaves the album empty for the page; it works in memory (the sheet's note says so); a late success is closed. (e) **`navigator.storage.persist()` once** per page after the first photo went into IndexedDB (Safari's 7-day storage cap; Safari 17+ grants it at its discretion); the answer is on the ?debug line. The district shutter (`photo.ts downloadUrl`) is unchanged (district mode never changes). | `game/album.ts` (`openDb`, `idbBackend` `run`, `askPersist`, `resetAlbumForTests({ idb, openTimeoutMs })`); `ui/Album.tsx` (`share`, the long-press view); new `ui/shareFile.ts`; `ui/album.css` | `ALBUM_OPEN_TIMEOUT_MS`, `albumPersistedNow()`; `saveRoute(nav, file, asSave, touch)`, `sharePayload(nav, file, text, asSave)`, `inAppBrowser(ua)`, `isIOS(nav)`, `fileToDataUrl(blob)` |
| 6 | **Touch guards.** `gesturestart` / `gesturechange` → `preventDefault` (passive: false) on the document while the game is up (iOS ignores `user-scalable=no`: a pinch inside 旅行本 / the shop / the map list zoomed the whole fixed game); `touch-action: pan-y` on the vertical scrollers (sheet body, album grid, goals card, the choices grid, the goals step, trip legs, the map chooser / legend, an open egg card, the recap) and `pan-x` on the chip rows (shop shelves / groups, the journal's tabs, the map chips); `-webkit-touch-callout: none` on `.ob-root` and the title (a held thumb on BAYBAY's face opened the iOS image menu); `-webkit-text-size-adjust: 100%` on `.ob-page` (iOS inflates text after a rotation); **a page left scrolled by the keyboard** (the map search) goes back to 0, 0 after `focusout` and when the visual viewport grows back while nothing is being typed in (never while an input has the focus). | new `ui/iosTouch.ts`; `OpusBayPage.tsx` (the ob-lock effect); `opus-bay.css` | `installIosTouchGuards(win?, doc?)`, `pageShifted(win, doc)` |
| 7 | **The arrival toast's English name on one line** (ellipsis; the full name in `title`): "Ferry Building Marketplace & Ferry Plaza Farmers Market" took two lines under 抵达 · 渡轮大厦市集 (K2 review, `qa/w6/K2/rev-phone-tour-first-stop-no-ticket.jpg`). | `ui/guide-ui.css`, `ui/ArrivalCard.tsx` (`ArrivalToast`) | — |
| 8 | **The silent-mode hint** on touch iOS (the lead's option a; `audioSession` not touched): under 音效 in Settings, and on the title after its sound button turned sound on — **没声音？iPhone 可能开了静音模式** / No sound? Your iPhone may be in silent mode ("silent mode" covers the ring / silent switch and the Action button of newer iPhones). | `ui/Settings.tsx`, `ui/TitleScreen.tsx`, `ui/shareFile.ts` (`SILENT_HINT`), `opus-bay.css` (`.ob-title-silent`) | `SILENT_HINT` |
| 9 | **The production ?debug=1 phone lines**, under the main line in the same box (`.ob-debug` is now a box of two `<pre>`s; `world/sf/stats.ts` still places the city stats under it). Line 1: the short UA (`iOS 18.6 Safari 18.6`, `iOS 17.5 WeChat 8.0.49`, `CriOS`, `in-app` …) · `innerWidth×innerHeight` · `vv` visualViewport height @ offsetTop · `safe` top/right/bottom/left (env() measured on a probe) · `dpr` screen → renderer · the quality (its reason, and decision → now when it stepped). Line 2: the cell pool (`batched` needs `WEBGL_multi_draw`, else `tile`; `?pool=` shown as forced) · `psc` KHR_parallel_shader_compile · `cbf` EXT_color_buffer_float / half_float · the audio state, `a`ctivated, `u`nlocked in a tap, `p`rimes · decoded clips, MB, evicted · album idb / memory and persisted · GL context losses / restores. Its own chunk, loaded only with ?debug=1, refreshed once a second. | new `ui/iosDebug.ts`; `ui/Floating.tsx` (`DebugOverlay`); `opus-bay.css` | `iosDebugLine()`, `shortUa(ua)` |

### Evidence

- `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · suite **1515 tests, 1514 pass**;
  the one failure, `A* reaches the hill, Pier 39 and the Pier 7 end …` (`opus-bay-actors`), passed alone (20 / 20): load
  (13 lanes on the machine); nothing in this part touches the nav.
- New tests (all green): `tests/opus-bay-w7-q-album.test.ts` (4: the route table — iPhone Safari share, WeChat / iOS
  without sharing long-press, desktop 保存 download / 分享 share, the in-app UA list; the payloads — 保存 = `{ files }`;
  **a fake IndexedDB** whose transaction throws "Connection … lost" once: the photo opens after one reopen, the next photo
  still goes to IndexedDB, `persist()` asked once; an open that never answers → memory after the timeout, photos kept for
  the page) · `tests/opus-bay-w7-q-touch.test.ts` (3: pinch cancelled, the disposer; a shifted page back to 0, 0 after
  focusout, not while typing, a visual-viewport offset counts; the CSS rules present) · `tests/opus-bay-w7-q-debug.test.ts`
  (2: `shortUa` for iPhone Safari, WeChat, CriOS, a Facebook in-app, Android Chrome, Edge, macOS Safari; the hint's length).
- Played (dev 5702, 390 × 844 dpr 3 touch, city):
  - **WeChat** (UA `… MicroMessenger/8.0.49 …`, Web Share removed as in a WKWebView): a photo in the album (IndexedDB),
    更多 → 相册 → the photo → 保存 → the long-press view: **长按图片保存到相册** over the photo as `data:image/jpeg;base64,…`,
    **no toast** (`qa/w7/Q/b-phone-wechat-album-longpress.jpg`).
  - **?debug=1**: `Windows Chrome 154 · 390×844 · vv 844@0 · safe 0/0/0/0 · dpr 3 → 1.25 · mid (device)` /
    `pool batched (multi_draw y) · psc y · cbf y/y · audio suspended a0 u0 p0 · clips 0 0.0MB ev0 · album -/p? · lost 0/0`
    under the main line, the city stats box below it (`qa/w7/Q/b-phone-debug-ios-lines.jpg`).

### Decisions

- The long-press path is chosen by the browser's abilities first (file sharing wins wherever it exists, WeChat included
  if it ever gains it), then by the UA (in-app) or iOS. Desktop 保存 still downloads; desktop 分享 still copies the link.
- Touch-action is set per scroller in `opus-bay.css` with one `:where()` list (no edits in other lanes' CSS files).
- The keyboard fix is global (any input's focusout), not only the map search: the same shift can follow any input.
- The silent hint shows on touch iOS only; on the title only after the player turned sound on there (no permanent line on
  a small title card).
- `persist()` is asked by the album only: the save (`data/save.ts`) is frozen; one ask covers the whole origin anyway.

### Known gaps

- The long press itself (WeChat's 保存图片 menu on a `data:` image) and 存储图像 in the iOS share sheet are device checks
  (the checklist, part c). Chrome cannot show the iOS image menu.
- `navigator.storage.persist()` may be refused silently by Safari (it decides by engagement); a Home Screen web app is the
  sure way to keep photos — not offered in the UI.

### Not done (part b)

- District mode's shutter (`photo.ts downloadUrl`) in WeChat still downloads nothing (district mode must not change).

### Requests

- None.

## Part c (2026-09-29 22:30–23:30 PDT): iOS viewport sizes · the iPhone checklist · the tile pool's numbers

Part b's first push was rejected (the tree had moved); it went out with part c's first commits after a rebase and a green
suite (below).

### What was built

| # | what | files | API |
|---|---|---|---|
| 5 | **iOS viewport scans** at the sizes Safari really gives the page (its bars never collapse: the game does not scroll) — portrait **390 × 664** (iPhone 12–15), **375 × 553** (SE), landscape **667 × 320** (SE) and **844 × 340** (12–15) — in an iPhone UA with touch, zh: the title, the welcome + goals step (375 × 553), the HUD, Settings (at the top and scrolled to the end), the journal, the map, the shop, the album grid and viewer. The scan (scratch `vscan.mjs`) lists every visible control of the surface whose centre is **covered** (`elementFromPoint` hits something else) or **off the screen** outside any scroller, at the top and with every scroller at its end. Fixed what it found: **(a)** at 667 × 320 and 844 × 340 the round-button column (six buttons + 问我, 382 px) ran off the top — **设置 at y −56…−10 / −60…−10, unreachable** — and at 844 × 340 its ··· sat on the objective pill: under 420 px tall the column packs (44 px buttons, BAYBAY 48, 6 px gaps, 问我 beside BAYBAY), 298 px from 12 px over the bottom edge; the pill keeps left of it. **(b)** the title at 667 × 320: 湾区小旅 cut at the top and 不玩了，直接看攻略 below the screen — short narrow landscape drops the subtitle, greeting and hint (the 821 px+ windows already did), `align-items: safe center` and it scrolls if it still does not fit. **(c)** phone sheets: a 35–38 % snap was a sliver on short screens (the shop: 210 px at 375 × 553 with its cards behind the footer, 122 px at 667 × 320) — a sheet at rest is at least 320 px and at most the screen minus a 40 px strip (dragging still follows the finger). **(d)** the desktop shop counter (min(420 px, 52 vh): 177 px at 844 × 340) takes the screen's height on windows under 500 px. **(e)** the phone bar over Settings' last row (W6 NEXT): it was the sheet's 0.38 s slide-in from 40 % opacity with the bar still drawn under it — the bar now goes at once under any open panel and fades back when it closes. **(f)** a footer-less sheet body clears the bottom safe area (`:has`). **(g)** `vh` sizes got an `svh` twin after them (album grid / photo, map frame, map svg, choices grid, trip card, legend; the title's decorative `vw` / `vh` stay). | `opus-bay.css`, `ui/album.css`, `ui/city-ui.css`, `ui/guide-ui.css`, `ui/map-w4.css` | — |
| 10 | **`docs/opus-bay/iphone-checklist.md`** — the owner's 5-minute real-iPhone pass in plain Chinese, 10 steps (the one-tap sound at 开始; the ?debug lines and how to read them; the silent-mode hint; Settings' last row; pinch in 旅行本; 保存 → 存储图像; WeChat's long press; the album after 10 minutes in the background and the 重新载入 card; landscape; the map search keyboard), what to screenshot, plus three extras (long press on BAYBAY's face, a 20–30 min soak watching `clips … MB`, Low Power Mode). | `docs/opus-bay/iphone-checklist.md` | — |
| 11 | **The tile pool's calls / triangles** (an iPhone without `WEBGL_multi_draw` runs it; last measured in wave 3). The perf runner takes `--pool tile\|batched` (one line, `scripts/opus-sf/qa/perf/w4-perf.mjs`). | `scripts/opus-sf/qa/perf/w4-perf.mjs` | `--pool` |

### Evidence

- Checks (the tree with Q4–Q8 rebased on `origin/opus-bay` at 23:00): tsc 0 · eslint 0 errors (43 old warnings) · suite
  **1586 tests, 1584 pass**: `W5-D-review the paid memo …` passed alone (5 / 5: load); `W5-bus 20+ simulated minutes` fails
  with *bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)* — **the same failure on a clean checkout of
  `origin/opus-bay` 90dc7798** (a scratch worktree, 8 pass / 1 fail, identical message): not this lane's (lane B's W7-B1
  made the proof force 47 blockers; a 29.2 s interlock stand is what it now finds). Named under Requests.
- The earlier runs this part: 1546 / 1546 (after the second rebase of part b), 1569 / 1569 (Q7 rebased).
- Scans before → after (covered / off counts of controls; "—" = none):

  | size | surface | before | after |
  |---|---|---|---|
  | 390 × 664 | HUD, Settings (top / end), journal, shop, album grid / viewer | — (the shop's shelf chips pass under its own sticky head when scrolled: a sticky header, not a defect) | — |
  | 375 × 553 | title, goals step, HUD, Settings, journal, map, album | — | — |
  | 375 × 553 | shop | 4 item cards covered by the footer hint (sheet 210 px) | — (sheet 320 px: shelves + a full row of cards, `qa/w7/Q/c-phone-375x553-shop.jpg`) |
  | 667 × 320 | HUD | **设置（Esc） off the screen** (y −56…−10) (`c-land-667x320-hud-before.jpg`) | — (`c-land-667x320-hud-column.jpg`: 设置 on top, 问我 beside BAYBAY, the pill left of the column) |
  | 667 × 320 | title | **不玩了，直接看攻略 off the screen** (y 314…358), 湾区小旅 cut | — (`c-land-667x320-title.jpg`) |
  | 667 × 320 | Settings, journal, map | — | — |
  | 844 × 340 | HUD | **设置（Esc） off the screen** (y −60…−10), ··· on the pill | — (`c-land-844x340-hud.jpg`) |
  | 844 × 340 | shop | 177 px counter, cards under its head | 308 px |
  | 844 × 340 | title, Settings, journal, map, album viewer | — | — |

  Settings' opening frame 120 ms after Esc at 375 × 553: no bar under the sliding sheet (scratch `v375x553-settings-opening.jpg`;
  W6's `qa/w6/K2/rev-phone-settings-holds-tour-dwell.jpg` showed 问 BAYBAY · 地图 · 旅行本 · 更多 over 显示地标旗).
- The tile pool vs the batched pool, the phone profile (390 × 844, dpr 3, quality mid, golden hour; W5 spots; the same
  dev server minutes apart; calls and triangles from `renderer.info`, the runner's max of stand / aim / walk):

  | spot | calls tile | calls batched | Δ | triangles tile | triangles batched |
  |---|---|---|---|---|---|
  | ferry-gate | 91 | 81 | +10 | 282k | 285k |
  | chinatown | 102 | 99 | +3 | 235k | 236k |
  | fidi | 91 | 89 | +2 | 241k | 241k |
  | filbert-steps | 86 | 78 | +8 | 265k | 266k |
  | halloween-alamo-night (`--time night --halloween night`) | 72 | 63 | +9 | 216k | 221k |
  | halloween-belvedere-night (same) | 72 | 65 | +7 | 229k | 226k |

  The tile pool costs +2…+10 calls at these spots (W3 measured +12…+16), triangles equal within noise, programs 57 vs 58
  (the batched pool's own program). The Dragon Gate view with the tile pool renders whole (scratch `perf-tile/chinatown.jpg`).
  No fps from me (W7-Z's). Raw: scratch `perf-tile/`, `perf-batched/`, `perf-hw-tile/`, `perf-hw-batched/`.

### Decisions

- The short-landscape rules key on height (≤ 420 px for the column, ≤ 460 px for the title) inside the existing width bands,
  so 667 × 375 / 844 × 390 (no bars, Home Screen) keep wave 6's layout; district mode shares the HUD column rule (the same
  buttons minus 更多), which only applies below 420 px tall — the hero regression sizes are untouched.
- The sheet floor is 320 px (a shelf row + a card row + the head fit) — dragging below it still closes the sheet.
- The goals card over the lead chip at 844 × 340 seen with `?start=free` on a fresh save (the real start shows the goals
  *step* instead): left as is (below).

### Known gaps

- Chrome emulation is not Safari: `svh`, the bars, `env(safe-area-inset-*)` (0 in Chrome) and the long-press menus only show
  on the device — the checklist covers them; the ?debug line reports `vv` and `safe` from the phone.
- The Halloween journal tab was not found by the scan with `?halloween=1` in the time I had (lane G / H own those
  overlays and shot them themselves); the Halloween postcard overlay was not scanned.
- At 844 × 340 with `?start=free` on a fresh save, the free-roam goals card (left) covers the lead chip under it.

### Not done

- The iOS 26 floating tab bar (the page may run under it): only the device can show it (checklist step 9 / 10 screenshots).
- A shader-compile stall measurement on the device (the ?debug line shows `psc y|n` and the warm-up ms; the scout's
  per-frame compile split was not built: it is lane P / X's warm-up and only worth it if the device shows a stall).

### Requests

- **To lane B / the lead**: `tests/opus-bay-w5-deadlock.test.ts` fails on `origin/opus-bay` 90dc7798 itself (alone, no load):
  *bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)* — a bus held by an F-line interlock box near the
  Embarcadero; every push after it runs the suite red on this one test.
- **To W7-Z / the lead**: the perf runner has `--pool tile` now; worth one phone-profile row at ferry-gate (the largest
  tile − batched difference, +10 calls) in the final verify.
- **To lane K** (the free-roam goals card, `game/goalsStep.ts` / `flow.ts startFree`): at 844 × 340 the card covers the lead
  chip; if the card can show on a real start, place the chip below it (or hide the chip while the card is up).
