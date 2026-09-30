# Wave 7 · final verify (W7-Z), 2026-09-30

The lead's final verify of wave 7 (`sf-w7-lead.md` §2), run alone on the owner's machine in the worktree
`C:/Users/willy/wt/w7-verify` (dev server 5720), on `origin/opus-bay` `90ce562f` — every lane (K, Q, B, P, H, G, S, W1,
W2, X, V, M, R), every lane's adversarial review and the integration playtest W7-I pushed, 144 commits since the
wave-6 hand-off `83e88511`; `origin/main` has nothing new since day 0 (its head `b4f71de8` is already merged). Method and
baseline: `sf-w6-final-verify.md`. Raw output: `C:/Users/willy/opus-qa/w7/z/` (check log, perf tables and shots, sweep
JSON, CSP stats, district numbers).

## 给主人的摘要

**结论：GO——可以把 opus-bay 快进合并到 main 上线。** 第七波 13 条线、13 个审查和整合试玩都没有报告阻碍上线的问题；这次验收没有改任何游戏代码。有一件事要你知道：全站检查里有 4 个网站测试是红的，但它们来自 GPT 9/29 18:05 推到 main 的网站内容（`b4f71de8`），main 上现在也是同样 4 个红，和游戏无关，上线不会让网站变差（见第 1 节，修法已写好，留给你 / GPT）。

1. **检查**：代码规范 0 个错误；全站 2555 个测试里 2551 个通过，失败的 4 个都是网站自己的测试（水灯节宣传图是 AVIF 而测试要求 WebP、两条活动的行程写了 4 步而测试要求 3 步、圣何塞周末筛选多出一场新活动）；小游戏自己的 1660 个测试全部通过；类型检查 0 错误；构建、预渲染 566 页、541 张分享卡全部成功。
2. **首屏主包达标**：GameRoot 从 279.2 KB 降到 **262.0 KB**，第一次低于 265 KB 的目标。
3. **电脑版性能全部达标**：20 个点位 + 3 段乘车 + 2 个万圣夜点位 + 4 个第七波新点位（从科伊特塔和 39 号码头看恶魔岛、10/11 下午渔人码头意大利游行 + 舰队周飞机、11/2 晚上亡灵节游行）全部 60 帧，最多 123 次绘制、36.0 万三角形（上限 150 / 40 万）。
4. **手机模拟（390×844、中画质、CPU 降速 4 倍）全部达标**：所有点位最低 58.4 帧，**没有一帧超过 100 毫秒**（上一波有 2 次）；另外测了 iPhone 可能走的 tile 渲染路径（最多多 10 次绘制，帧率不变）和新的白天蓝天（60 帧）。
5. **全城巡检**：694 个点，被围死 0、卡脚 0、走不到 1（还是"奥布莱恩号"，W1 这波没来得及做）。
6. **正式版 + 正式安全策略**：5 段实玩（万圣节标题、万圣夜讨糖街、手机阿拉莫广场夜景、手机新玩家从标题开始、电脑街区模式从标题开始），**0 次安全策略拦截、0 个失败请求**（共 1514 个请求）。
7. **街区模式没变**：标题画面 71 次绘制 / 225,070 三角形 / 262 个物体，和上一波完全一样；街区模式不加载城市包。
8. **网站联动**：游戏里所有旧金山活动、纪念章、新店牌子、优惠、日历、链接都和网站最新数据对得上（第 7 节）；main 从 day 0 之后没有新内容。
9. **给你的 iPhone 真机检查包已更新**：`http://10.0.0.85:4174/opus-bay`（需要先启动预览 `opus-bay-phone`），照 `docs/opus-bay/iphone-checklist.md` 做 5 分钟检查，最重要的是第 1 步：点「开始」后第一声雾笛要直接响。

## Setup

- Machine: Ryzen 9 5900HX, RTX 3070 Laptop (`CHROME_FLAGS=--force_high_performance_gpu`), Chrome headless via
  `scripts/opus-shot.mjs`.
- Stray processes at 02:13 PDT: lane P's reviewer's `vite preview --port 5724` (two node processes) — stopped. No
  headless Chrome was left.
- PERF-LOCK `C:/Users/willy/opus-qa/w7/PERF-LOCK` (`W7-Z, since 02:13 PDT`) held for the whole run; removed at the end.
- Order: `npm run check` alone (02:13–02:21); then the site build, `tsc` and the static sweep side by side (none timed);
  then the perf gate alone (02:23–03:09); then the production CSP play, the district regression and the opus-bay suite.
- Method as W6-Z (`--wait 12000 --ms 6000`: 12 s settle after each teleport, 6 s of frames standing and 6 s walking).
- New this wave: `scripts/opus-sf/qa/perf/w7-spots.json` — Alcatraz from Coit Tower's plaza and from PIER 39, Jefferson &
  Powell on 11 Oct 13:00 (the Italian Heritage Parade kit + Fleet Week's jets, lane S's request), the Día de los Muertos
  procession on Bryant at 24th St on 2 Nov 19:10 (lane H: the column's head is at (469, 612) at 19:10,
  `muertosWalkers.headAt(600)`).

## 1. Checks

| check | on `90ce562f` (the tree as the lanes left it) | W6-Z (for comparison) |
|---|---|---|
| `npm run check` (eslint · all tests · build · prerender · share cards) | **EXIT 1**: eslint 0 errors (43 old warnings) · tests **2551 / 2555** — the 4 failures are **site tests on GPT's content, identical on `origin/main`** (below); none is an opus-bay test. `npm run check` stops at the failed test step, so the rest was run by hand on the same tree: `npm run build` **EXIT 0** (566 pages prerendered, 541 share cards generated) · `npm run verify:share-cards` **EXIT 0** (541 PNGs, every QR decoded) | EXIT 0 · 2246 / 2246 · 519 pages · 494 cards |
| `tsc -b` (inside the build) | 0 | 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | **0** | 0 |
| opus-bay suite (`tests/opus-bay-*.test.ts`) | **1660 / 1660** (run alone after the gate, 03:09–03:12; also inside the check's run: no opus-bay failure) | 1489 / 1489 |
| GameRoot (the site build, gzip as vite reports) | **261.96 KB** — **under the 265 KB target** (playParts 17.24 KB, script 13.60 KB, poiTexts 7.24 KB, post 1.76 KB, halloween 1.43 KB) | 279.19 KB |

### The four red site tests (not wave 7, not fixed here)

All four come from GPT's site commit `b4f71de8` ("Fill October event gaps and make SF water lantern searches find Foster
City", 2026-09-29 18:05), which is `origin/main`'s head (on `main` since then). Outside the game's own paths
(`src/opus-bay`, `tests/opus-bay-*`, `public/opus-bay`, `scripts/opus-sf`, `docs/opus-bay`) the `opus-bay` tree is
byte-identical to `origin/main` (`git diff --stat origin/main HEAD -- . ':!src/opus-bay' …` is empty), so `main` fails
the same four today; the fast-forward adds nothing to them and cannot make the live site worse.

| test (file) | what fails | the fix (GPT's call: site content) |
|---|---|---|
| guide media registry has usable local images (`tests/guide-journal.test.tsx`) | `/guides/september-refresh/water-lantern-festival-promo.avif` — the registry and the test expect WebP (+ a `-small.webp` 480w) | convert the promo to WebP 2010 w + 480 w, point `src/data/september-refresh-media.json` at them |
| monthly media files and credits (`tests/monthly-ui.test.tsx`) | the same `.avif` path fails `/\.webp$/` | same fix |
| published activities … traceable source metadata (`tests/monthly-logic.test.ts`) | `plan.length` 4, not 3, for `woodside-djerassi-free-art-hike-oct5-2026` and `fremont-fog-diwali-mela-2026` (`src/data/coverage-audit-regional-events.json`): the 4th step is a source / directions note | fold the 4th step into the 3rd (or allow 4 in the test) |
| date shortcuts combine with region, cost and search (`tests/monthly-ui.test.tsx`) | the San Jose weekend filter now also returns `san-jose-hellflowers-free-concert-oct2-2026` (new in `b4f71de8`) | add the new id to the test's expected list, or check the date rule |

W7-Z started the first fix (the WebP conversion) and backed it out unpushed: the site's files are GPT's (lead note §3
"the site is GPT's"; §6 the same rule for the Safari regex), and the harness refused edits to the site's shared data. So
these four stay for the owner / GPT (§10).

## 2. Blocking items

No lane, review or the integration playtest reported a `blocking_for_go_live` item (K, Q, B, P, H, G, S, W1, W2, X, V,
M, R and W7-I: every "Blocking the go-live" section reads *None*; every review green). Nothing was reverted.

## 3. The perf gate (`scripts/opus-sf/qa/perf/w4-perf.mjs`, dev server 5720, 02:23–03:09)

Tables: `C:/Users/willy/opus-qa/w7/z/perf/{desk,hw-desk,w7-desk,jeff-desk,mu-desk,phone,hw-phone,w7-phone,jeff-phone,mu-phone,tile-phone,day-phone,day-phone2}/w4-perf.md`.

### Desktop 1440 × 900, quality high, RTX — all pass

| spot / ride | calls | triangles | fps idle / walk (ride) | > 100 ms | W6-Z calls · tris |
|---|---|---|---|---|---|
| ferry-gate | 104 | 351k | 60.1 / 60.1 | 0 | 102 · 365k |
| chinatown | 123 | 290k | 60.1 / 60.1 | 0 | 122 · 285k |
| twin-peaks | 109 | 323k | 60.1 / 60.1 | 0 | 111 · 306k |
| civic-center | 77 | 220k | 60.1 / 60.1 | 0 | 87 · 291k |
| union-square | 83 | 244k | 60.1 / 60.1 | 0 | 84 · 242k |
| music-concourse | 91 | 242k | 60.1 / 60.1 | 0 | 96 · 260k |
| stonestown-sfsu | 72 | 195k | 60.1 / 60.1 | 0 | 74 · 196k |
| haight-usf | 96 | 278k | 60.1 / 60.1 | 0 | 96 · 277k |
| ocean-beach | 49 | 95k | 60.1 / 60.1 | 0 | 49 · 95k |
| ggb-south | 54 | 102k | 60.1 / 60.1 | 0 | 53 · 101k |
| mission | 86 | 319k | 60.1 / 60.1 | 0 | 85 · 317k |
| grace-nob-hill | 106 | 350k | 60.1 / 60.1 | 0 | 104 · 359k |
| powell-market | 98 | 281k | 60.1 / 60.1 | 0 | 98 · 306k |
| fidi | 103 | 279k | 60.1 / 60.1 | 0 | 95 · 277k |
| ggb-deck | 48 | 94k | 60.1 / 60.1 | 0 | 47 · 92k |
| hellman-hollow | 68 | 212k | 60.1 / 60.1 | 0 | 68 · 211k |
| marina-green | 74 | 157k | 60.1 / 60.1 | 0 | 72 · 151k |
| castro | 74 | 300k | 60.1 / 59.9 | 0 | 74 · 295k |
| filbert-steps | 86 | 325k | 60.1 / 60.1 | 0 | 92 · 358k |
| pier45 | 116 | 360k | 60.1 / 60.1 | 0 | 110 · 354k |
| ride bus-palace | 73 | 256k | (60.1) | 0 | 70 · 217k |
| ride n-duboce | 85 | 258k | (60.1) | 0 | 77 · 254k |
| ride m-west-portal | 67 | 226k | (60.1) | 0 | 66 · 222k |
| **Halloween night** Alamo Square (`--time night --halloween night`) | 83 | 330k | 60.1 / 60.1 | 0 | 83 · 328k |
| **Halloween night** Belvedere St (treat doors) | 100 | 330k | 60.1 / 60.1 | 0 | 101 · 328k |
| **W7** Coit Tower's plaza → Alcatraz | 102 | 304k | 60 / 60.1 | 0 | — |
| **W7** PIER 39 → Alcatraz | 92 | 272k | 60.1 / 60.1 | 0 | — |
| **W7** Jefferson & Powell, 11 Oct 13:00 (parade kit, Fleet Week jets) | 107 | 257k | 60.1 / 60.1 | 0 | — |
| **W7** Día de los Muertos procession, Bryant at 24th, 2 Nov 19:10 night | 104 | 344k | 60.1 / 60.1 | 0 | — |

Programs first = last in every session (60 → 60); p95 16.7–16.8 ms everywhere. Max **123 calls** (Chinatown, W6-Z 122) /
**360k triangles** (Pier 45, W6-Z 365k at ferry-gate) — headroom 27 calls / 40k. The spots wave 7 touched most:
ferry-gate 104 / 351k and fidi 103 / 279k (lane W1's FiDi seam, lane X's pre-war façades), Chinatown 123 / 290k and
Powell & Market 98 / 281k (lane X's cornices, +10.6k at X's fixed Market St camera: here Chinatown is +5k over W6-Z and
Powell & Market under it — the runner's walking view differs from X's camera), Pier 45 116 / 360k (W1's USS Pampanito, lane M's Musée props), Marina Green 74 / 157k (W2's
kites), Union Square 83 / 244k (W2's T2 square). The dated Jefferson view shows the Italian parade's balloons, the
Fleet Week jets with smoke trails over the Bay and the Pampanito at Pier 45 (`qa/w7/final/z-jefferson-parade-desk.jpg`);
from PIER 39 the new Alcatraz reads as the long cellhouse with the lighthouse (`z-pier39-alcatraz-desk.jpg`).

### Phone profile 390 × 844, dpr 3, quality mid, 4× CPU (RTX) — all pass, 0 frames over 100 ms

| spot / ride | calls · tris | fps idle / walk (ride) | > 100 ms | gate | W6-Z idle / walk · > 100 ms |
|---|---|---|---|---|---|
| ferry-gate | 82 · 287k | 60.1 / 59.7 | 0 | pass | 59.6 / 45.7 · 0 |
| chinatown | 100 · 238k | 60.1 / 60.1 | 0 | pass | 56.4 / 50.4 · 0 |
| twin-peaks | 81 · 211k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 · 0 |
| civic-center | 64 · 170k | 59.9 / 60.1 | 0 | pass | 58.1 / 51.2 · 0 |
| union-square | 69 · 171k | 60.1 / 60.1 | 0 | pass | 60.1 / 57.2 · 0 |
| music-concourse | 76 · 170k | 60.1 / 60.1 | 0 | pass | 60.1 / 55.2 · 0 |
| stonestown-sfsu | 65 · 150k | 60.1 / 59.4 | 0 | pass | 60.1 / 60.1 · 0 |
| haight-usf | 79 · 201k | 60.1 / 60.1 | 0 | pass | 59.2 / 56.4 · 0 |
| ocean-beach | 42 · 85k | 60.1 / 60.1 | 0 | pass | 60.1 / 55.2 · 0 |
| ggb-south | 48 · 89k | 60.1 / 60.1 | 0 | pass | 60.1 / 59.1 · 0 |
| mission | 70 · 237k | 60.1 / 60.1 | 0 | pass | 60.1 / 52.9 · 0 |
| grace-nob-hill | 94 · 286k | 60.1 / 60.1 | 0 | pass | 57.2 / 50.7 · 1 |
| powell-market | 83 · 238k | 60.1 / 60.1 | 0 | pass | 59.1 / 51.2 · 0 |
| fidi | 88 · 232k | 60.1 / 58.4 | 0 | pass | 59.6 / 45 · 0 |
| ggb-deck | 42 · 87k | 60.1 / 60.1 | 0 | pass | 60.1 / 55.4 · 0 |
| hellman-hollow | 57 · 148k | 60.1 / 60.1 | 0 | pass | 60.1 / 59.2 · 0 |
| marina-green | 59 · 123k | 60.1 / 60.1 | 0 | pass | 60.1 / 55.4 · 0 |
| castro | 60 · 208k | 60.1 / 59.9 | 0 | pass | 60.1 / 46.4 · 0 |
| filbert-steps | 76 · 278k | 59.9 / 60.1 | 0 | pass | 59.6 / 45 · 1 |
| pier45 | 97 · 298k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 · 0 |
| ride bus-palace | 60 · 173k | (59.9) | 0 | pass | (59.6) · 0 |
| ride n-duboce | 57 · 187k | (59.7) | 0 | pass | (59.9) · 0 |
| ride m-west-portal | 56 · 175k | (59.9) | 0 | pass | (60) · 0 |
| **Halloween night** Alamo Square | 63 · 224k | 60.1 / 59.9 | 0 | pass | 59.6 / 50.4 · 0 |
| **Halloween night** Belvedere St | 66 · 225k | 60.1 / 60.1 | 0 | pass | 59.9 / 55.1 · 0 |
| **W7** Coit → Alcatraz | 83 · 272k | 60.1 / 59.7 | 0 | pass | — |
| **W7** PIER 39 → Alcatraz | 81 · 261k | 60.1 / 60.1 | 0 | pass | — |
| **W7** Jefferson & Powell, 11 Oct 13:00 | 90 · 235k | 60.1 / 59.9 | 0 | pass | — |
| **W7** muertos procession, 2 Nov 19:10 | 87 · 244k | 60.1 / 59.9 | 0 | pass | — |
| **W7** the city's day sky (`--time day`): Coit → Alcatraz, open sky over the Bay | 79 · 273k | 60.1 / 59.9 | 0 | pass | — |
| **W7** the city's day sky: Ocean Beach | 39 · 86k | 60.1 / 59.9 | 0 | pass | — |

Programs first = last per session (58 → 58). Lowest fps **58.4** (fidi walking; W6-Z 45.0), **no frame over 100 ms
anywhere** (W6-Z: one each at Grace / Nob Hill and the Filbert Steps). Every walking figure is at or above W6-Z's — the
W6-Z note said the machine ran slow on 9/29 for both trees; lane X's crowd change on `mid` (near figures 18 → 8, the
Filbert Steps' +13.6k triangles of wave 6) also takes CPU off the walk. Same runner, same flags, same canvas
(487 × 1055, pixel ratio 1.25) as W6-Z. Lane X's day sky (a 3-cell puff loop in the sky shader) measured at two
open-sky day views: 60 fps.

### Phone with the tile pool (`--pool tile`: the path of an iPhone without `WEBGL_multi_draw`, lane Q's request)

| spot | calls · tris (tile) | batched, same run above | fps idle / walk | > 100 ms |
|---|---|---|---|---|
| ferry-gate | 92 · 286k | 82 · 287k (**+10 calls**) | 60.1 / 59.9 | 0 |
| chinatown | 103 · 239k | 100 · 238k (+3) | 60.1 / 60.1 | 0 |
| fidi | 89 · 216k | 88 · 232k (+1) | 59.9 / 60.1 | 0 |

Programs 57 → 57 (the batched pool's own program is absent). The tile pool costs up to 10 calls, as lane Q measured;
all under the desktop call cap even on the phone.

**Perf verdict: pass on both profiles, no wave-7 regression.** The two W6-Z phone frames over 100 ms did not recur.

## 4. The static walk sweep (`sweep-static.mts`, node, the published city, 7 s)

| | W6-Z | **W7-Z** |
|---|---|---|
| targets | 688 | **694** (+ lane S's six new event venues) |
| ok · CORRIDOR | 545 · 142 | **547 · 146** |
| BOXED · SNAG | 0 · 0 | **0 · 0** |
| UNREACHABLE · OFF | 1 · 0 | **1 · 0** |

- Left: `trip:ss-jeremiah-obrien` (T3, UNREACHABLE: moves 3 of 4 ways, the nav path ends short — as in W5-Z / W6-Z).
  Lane W1 aimed at 0 with a Pier 35 ship and an `arrival`; the Jeremiah O'Brien was not built this wave (W1's Not done),
  so the count stays 1.
- New targets: `venue:golden-gate-bandshell`, `venue:marina-library`, `venue:mission-excelsior` ok;
  `venue:fort-mason-festival-pavilion`, `venue:irving-11th`, `venue:potrero-20th` CORRIDOR (two ways open along the
  pavilion front / the street; the fair's arch and stalls close the other two).
- One verdict changed: `cable:powell-geary` (98.2, 235.0) ok → CORRIDOR (moves [5.85 · 1.97 · 6.14 · 1.32]: open along
  Powell St, closed across it) — lane W2's Union Square T2 (terraces, planters, café tables) now stands at the stop's
  square side. Two ways open: the CORRIDOR waiver covers it; noted for W2 (§10).
- By owner (targets / CORRIDOR): A 16 / 0, C 16 / 2, D 35 / 8, E coins 180 / 40, caches 40 / 0, F deck 21 / 21,
  L 31 / 8, N 158 / 40 (+ 1 unreachable), R 24 / 9, T 173 / 18. JSON: `C:/Users/willy/opus-qa/w7/z/sweep/static.json`.

## 5. Production build and the production CSP (`scripts/opus-sf/qa/csp-serve.mjs`)

The site's own build (`npm run build`, `dist/`, what Vercel deploys) served with `vercel.json`'s headers, rewrites and
routes on 5517, five headless sessions through the UI only:

1. desktop `/opus-bay?halloween=1` — the title shows the Halloween key art (`w6/art/key-wide-halloween-1920.webp`);
2. desktop `?halloween=night&start=free&time=night&quality=high&at=xz:35,856` (Belvedere St) — the city at night, a
   click, walking, the map; the pill reads Haight Ashbury · Belvedere Street with the candy badge
   (`qa/w7/final/z-prod-belvedere-night-desk.jpg`);
3. phone 390 × 844 dpr 3, Alamo Square at Halloween night, a drag on the stick;
4. phone, **a new player from the title** (lane P's request): the Start button → the Ferry Building arrival with
   BAYBAY's four choices, the city loaded (`z-prod-arrival-phone.jpg`);
5. desktop, **the district from the title** (lane P's request): Start → "Welcome to the Bay" with the district's own
   choices (7 stops, 8 postcards); the loaded scripts include no `cityMode` / `cityDataChunk` / `cityLive`
   (`z-prod-district-start-desk.jpg`).

`/__csp-stats` after all five: **0 violations, 0 failed requests, 1514 served** (W6-Z: 0 / 0 / 1793 over three
sessions). No page exception (the only console line is the old `THREE.Clock` deprecation warning).

## 6. District regression (`?world=district`, dev server)

| view | calls | triangles | objects | W6-Z |
|---|---|---|---|---|
| the title diorama | **71** | **225,070** | **262** | 71 · 225,070 · 262 |
| free roam at the Ferry Building, `?halloween=night` added | 74 → 73 walking | 232k → 231k | 266 | 77 → 74 · 242k → 229k · 266 |

The title is identical to W6-Z and W5-Z. With `?halloween=night` the district loads no city and no Halloween feature
(`__opusBay.g` absent, `city: false`), the page title stays "Explore the Embarcadero with BAYBAY". Shot:
`qa/w7/final/z-district-title-desk.jpg`.

## 7. 网站联动 (the owner's 23:20 message, lead note §7.2)

Checked on the final tree `90ce562f`. `origin/main` has no commit after `b4f71de8`, which W7-0c merged at day 0, so the
game reads the site's current records.

| what | how checked | result |
|---|---|---|
| every San Francisco event of the catalog window is in the world or kept out for a stated reason | `tests/opus-bay-w6-s-venues.test.ts` "every San Francisco event of 29 Sep – 30 Nov is in the world, 18+ / professional, or not placed for a stated reason (W7-S: 47 shown)" | green (in the check's run) |
| every shown event has a souvenir id and a name | `tests/opus-bay-w7-s-venues.test.ts` W7-S1 guard (souvenir bit, short name, venue name, lines fit on every day) and the long-id `pay()` test | green |
| the 新店 signs follow the site's current openings (open / soft_open, SF) | `tests/opus-bay-w6-s-openings.test.ts` (`currentOpenings`, the planner's rule; OSM-checked addresses; on the walking network) | green |
| `live.json` matches the site's offers | re-exported now with `npx tsx scripts/opus-sf/export-live.ts` (14 SF offers): **no content change** (line endings only, restored) | in sync |
| the calendar rows carry sources | `tests/opus-bay-w7-s-dates.test.ts` (DST 1 Nov, Día de los Muertos 以官网为准, Chinatown Halloween Festival, the Alcatraz sunrise, the Parade of Ships) and `tests/opus-bay-w5-calendar.test.ts` (sources checked on a date) | green |
| every link the game opens resolves | `tests/opus-bay-w7-s-site.test.ts` W7-S3: `/events/:id` of all 47 shown SF events, `/openings/:id` of every sign, `/offers/:id` of every `live.json` offer, in `vercel.json`'s routes and the prerendered pages (566 built here) | green |
| the 今天 tab and 这周去哪 read today's data | `tests/opus-bay-w5-today.test.ts` (the tab: clock, sun, moon, today's rows with sources, past rows hidden; the daily three seeded by the Bay date) | green |

The site's own four red tests (§1) are about GPT's regional listings (Foster City, Woodside, Fremont, San Jose), not the San Francisco rows the
game shows; the Foster City water lantern event is not an SF event, so nothing in the world depends on it.

## 8. What W7-Z changed

| commit | what | files |
|---|---|---|
| this one | the wave-7 perf spots (Alcatraz from Coit and PIER 39, Jefferson & Powell on the parade / Fleet Week day, the muertos procession); this report and its QA shots | `scripts/opus-sf/qa/perf/w7-spots.json` (new), `docs/opus-bay/sf-w7-final-verify.md`, `docs/opus-bay/qa/w7/final/*` |

No product code changed.

## 9. The owner's LAN phone package and the GO / NO-GO

The phone package was rebuilt from this tree (`npx vite build --config vite.opus.config.ts --outDir
C:/Users/willy/opus-qa/dist-phone`, 03:15, the same GameRoot hash as the site build; no `public/` churn). The preview
`opus-bay-phone` (`.claude/launch.json`, port 4174) was not running at 02:13: start it to serve
http://10.0.0.85:4174/opus-bay for the owner's iPhone pass (`docs/opus-bay/iphone-checklist.md`).

## GO / NO-GO for fast-forwarding `main` to `opus-bay`: **GO**

- Checks: eslint 0 errors, `tsc` 0, opus-bay **1660 / 1660**, build + prerender (566) + share cards (541) green. The
  full check's test step is 2551 / 2555: the four failures are the site's own (GPT's `b4f71de8`, already on `main`;
  the tree is byte-identical to it outside the game) — not wave 7, and the fast-forward cannot make them worse. The lead's
  go-live step will see the same four; they are for the owner / GPT (§1).
- Blocking items: none from thirteen lanes, thirteen reviews and W7-I.
- Perf: desktop all pass (max 123 calls / 360k, 60 fps, 0 long frames, Halloween night, the muertos procession and the
  dated Wharf view included); phone every fps ≥ 58.4, **0 frames over 100 ms** anywhere (W6-Z's two did not recur);
  the tile pool and the city day sky pass too.
- GameRoot **261.96 KB** ≤ 265 (the target is met for the first time).
- Sweep: 0 boxed, 0 snag, 0 off; the one unreachable T3 unchanged.
- Production: 0 CSP violations, 0 failed requests in five sessions; the new-player phone start and the district start
  work in the production build.
- District: unchanged. 网站联动: in sync (§7).

The lead merges (`main` fast-forward; `origin/main` has nothing new), checks baylink.us/opus-bay once on a phone. The
Halloween season still starts by itself on 1 October (Bay date).

## 10. Open (owners named; none blocks the merge)

From this run:

- **The site's four red tests** (§1, GPT's `b4f71de8`, red on `main` as well): the lantern promo as WebP, the two 4-step
  plans, the San Jose weekend list. The lead's go-live step re-runs `npm run check` and will see the same four; they are
  the site's, not the game's.
- **Union Square stop** (lane W2): `cable:powell-geary` went ok → CORRIDOR (§4).
- **SS Jeremiah O'Brien** (lane W1, next wave): the sweep's one UNREACHABLE stays until the Pier 35 ship and its arrival
  land.

From the lanes, the reviews and W7-I (each report's Review / Open section has the detail):

1. **A real iPhone pass** (`docs/opus-bay/iphone-checklist.md`, lane Q): the audio unlock inside the Start tap (WebKit's
   gesture rule), 存储图像, WeChat's long-press save, iOS context loss, `svh` / safe areas, the iOS 26 tab bar. The LAN
   package at http://10.0.0.85:4174/opus-bay carries wave 7 (§9).
2. **BAYBAY's ambient lines under a lazy overlay** (W7-I): the claw / crab / dough / fortune / skyline panels, the
   Halloween postcard and the egg card do not hold `cityMoments.stepPacer` / `baybayLines` — the voice plays with its
   bubble hidden. One clause in both gates with the overlay ids as strings, plus a node test (lead / lane K).
3. **The seated Hyde St rider under a canopy** (lane K): needs a tree-only dither around the player in the TOY shader
   (`world/materials.ts`, lane X / lead).
4. **Phone UI**: no Settings reachable during an underground Metro ride; the album / letter / goals step under the
   subway overlay (lane B review → Q); the map's tool buttons 36 × 36 and the waypoint × 24 × 24 (W7-I → Q); at 844 × 340
   the free-roam goals card covers the lead chip (Q → K).
5. **Transit**: the night-time Market St single-track convoy (≈ 29 s bus wait); the shorter courtesy diff
   (`C:/Users/willy/opus-qa/w7/b/b5-attempt/b5.diff`, Hyde & Chestnut 48 → 41.5 s) to re-measure; the Alcatraz ferry
   (part c, not built; W2's dock is on origin); a stale comment in `game/transit.ts` `holdRideForPause` (lane B).
6. **BAYBAY / parked rides** (lane K, K review): the step-off-the-rails and the five review fixes were staged in node
   only — one phone check at a Powell St stop with a car waiting; a parked ride > 250 u away is towed only when the
   player returns within 250 u.
7. **Wording / places**: the Belvedere doors read 内日落 · Carmel St on the pill while BAYBAY says Belvedere (Cole Valley
   by most maps; `cityAreaAt`, lane K); Ghirardelli Square / Beach St west of Hyde outside 渔人码头 (a recorded call).
8. **GameRoot** is at 261.96 KB, 3 KB under 265: city-only parts of `world/fx.ts`, `world/materials.ts`,
   `world/environment.ts`, `actors/models.ts` (≈ 6 KB added tonight) can move behind the city chunk (lane P → V / X);
   `importRetry` covers the main lazy imports, not the other ≈ 170.
9. **Not built this wave**: the Ocean Beach surfers and Seal Rocks (X), the Pier 35 Jeremiah O'Brien and North Beach
   leftovers (W1), toy ships for the Parade of Ships (S), the Chinatown Halloween Festival venue row (waits for the
   site's catalog), a shader-compile split for iPhones without `KHR_parallel_shader_compile` (Q).
10. **Git housekeeping**: admin folders under `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/` (`w7-*-rev`,
    `w7-int`, `wt-origin1`, `w7-p-chk`, `w7-h-origin`, …) could not be deleted (OneDrive lock); `git worktree prune` with
    OneDrive paused.

## Files

- QA images (`docs/opus-bay/qa/w7/final/`, every one read): `z-fidi-desk.jpg` (California St with the pre-war façades),
  `z-jefferson-parade-desk.jpg` (11 Oct 13:00: the parade balloons, the Fleet Week jets' smoke over the Bay, the
  Pampanito at Pier 45), `z-pier39-alcatraz-desk.jpg` (the new Alcatraz from PIER 39), `z-coit-daysky-alcatraz-phone.jpg`
  (phone, the city's day sky and Alcatraz from Coit), `z-prod-belvedere-night-desk.jpg` (production, the treat street at
  night), `z-prod-arrival-phone.jpg` (production phone, a new player's arrival), `z-prod-district-start-desk.jpg`
  (production, the district's welcome), `z-district-title-desk.jpg` (the district title, unchanged).
- Scratch: `C:/Users/willy/opus-qa/w7/z/` (`../z-check.log`, `build.out`, `verify-cards.out`, `tsc.out`, `suite.out`,
  `sweep/`, `perf/<run>/`, `csp/` with `stats.json` and the shots, `district/`, `dist-phone.out`).
