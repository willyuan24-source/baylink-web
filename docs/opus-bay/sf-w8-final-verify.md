# Wave 8 · final verify (W8-Z), 2026-10-01

The lead's final verify of wave 8 (`sf-w8-lead.md` §7), run alone on the owner's machine under PERF-LOCK in the worktree
`C:/Users/willy/wt/w8-verify` (dev server 5870), on `origin/opus-bay` `ca25fc7b` — every lane (K, Q, P, A, H, S, W1, W2,
M, X), their two read-only lenses and fixer each, the integration pass W8-I, the completeness critic and the fix pass
W8-C pushed: 144 commits since the wave-7 hand-off `94ae2ae4` (146 since `1d5d0d00`, what baylink.us serves now). Method
and baseline: `sf-w7-final-verify.md` (W7-Z). Raw output: `C:/Users/willy/opus-qa/w8/final/` (logs, perf tables and
shots, sweep JSON, CSP stats, district numbers, language scans).

## 给主人的摘要

**结论：GO——可以把 opus-bay 快进合并到 main 上线。** 这次验收没有改任何游戏代码，也没有撤回任何提交；只新增了第八波的性能测点文件和这份报告。

1. **检查全部通过**：全站检查（代码规范、全部 2845 个测试、构建、预渲染 566 页、541 张分享卡）第一次从第六波以来全绿，0 失败；小游戏自己的 1871 个测试 0 失败；类型检查 0 错误。首屏主包 GameRoot 258.04 KB（上限 265，比上一波小 3.9 KB；255 的目标没达到，留给第九波）。
2. **性能达标**：电脑版所有点位都是 60 帧，最多 126 次绘制、38.7 万三角形（坐渡轮去恶魔岛时最高，上限 40 万）。手机模拟（CPU 降速 4 倍）所有测量段都没有超过 100 毫秒的卡顿。有一处（舰队周那天的水上公园）第一次测到 41.8 帧，低于 45；马上用现在线上的第七波版本对照重测：第七波 48–54 帧，第八波 53 帧，说明不是第八波造成的，是那个位置本来就重。
3. **全城巡检**：699 个点，被围死 0、卡脚 0、走不到 0。最后一个走不到的「奥布莱恩号」这波终于能走到了。
4. **正式版 + 正式安全策略**：6 段实玩（万圣节标题页、手机新玩家开场、33 号码头渡轮、恶魔岛码头、24 街街头艺人合奏、街区模式开场），0 次安全策略拦截、0 个失败请求。街区模式和上一波完全一样。英文版 56 个画面 0 个中文；繁体版 0 个简体字（有两处是网站转换器把「馬里納區」写成「馬裡納區」，交给网站编辑）。
5. **上线时请注意**：main 上有 GPT 新推的 6 个网站提交，合并没有冲突；合并后要把 10/7 动物园 SF 居民免费日加进 live.json（报告第 7 节有现成的一行），再跑一次全站检查。四条转发时被截断的审查意见已从工作流记录里找回并核对：2 条已修好，2 条是小问题（节日时巷子里停着一辆玩具车、网络很差时面板加载没有提示），都不挡上线。

## Setup

- Machine: Ryzen 9 5900HX, RTX 3070 Laptop (`CHROME_FLAGS=--force_high_performance_gpu`), Chrome headless via
  `scripts/opus-shot.mjs`, one Chrome at a time.
- Stray processes at 02:59 PDT: none (no headless Chrome, no `vite --port 58xx` left by earlier agents).
- PERF-LOCK `C:/Users/willy/opus-qa/w8/PERF-LOCK` (`W8-Z, since 2026-10-01 02:59 PDT`) held for the whole run; removed at
  the end.
- Order: `npm run check` alone (03:00–03:11); the static sweep, `tsc` and the live.json re-export beside it (none timed);
  the perf gate alone (desktop 03:11–03:43, phone 03:43–04:19); the paired W7 / W8 phone runs and the ferry frame log
  (04:19–04:34); the production CSP play with the opus-bay suite beside it (04:34–04:39); the district regression, the
  language scans and the phone package (04:40–04:47); the last paired run (04:47–04:50).
- Method as W7-Z (`--wait 12000 --ms 6000`: 12 s settle after each teleport, 6 s of frames standing and 6 s walking).

## 1. Checks

| check | on `ca25fc7b` (the tree as the lanes, W8-I and W8-C left it) | W7-Z (for comparison) |
|---|---|---|
| `npm run check` (eslint · all tests · build · prerender · share cards), 03:00–03:11 | **EXIT 0**: eslint **0 errors** (50 old warnings) · tests **2845: 2844 pass, 0 fail, 1 todo** (the todo is lane P's W8-P9 "GameRoot ≤ 255 KB" target, a registered not-yet: it reads ≈ 258.3 KB static, under its 258.5 KB guard) · build EXIT 0 · prerender **566 pages** · share cards **541** generated and verified (every QR decoded) | EXIT 1 (4 site tests of GPT's `b4f71de8`, red on `main` too) · 2551 / 2555 · 566 · 541 |
| `tsc -b` (inside the build) | 0 | 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | **0** | 0 |
| opus-bay suite (`tests/opus-bay-*.test.ts`) | **1871 tests: 1870 pass, 0 fail, 1 todo** (run 04:34–04:39 beside the CSP play; also inside the check's run) | 1660 / 1660 |
| GameRoot (the site build, gzip as vite reports) | **258.04 KB** (682.94 KB raw) — under the 265 KB ceiling, **3.92 KB under W7-Z**; lane P's ≤ 255 KB target **not met** (lane P's own open item). Play layer: playParts 17.71 KB, script 13.60 KB, poiTexts 7.24 KB, post 1.76 KB, halloween 1.43 KB; the city chunks cityMode 68.55 KB, cityDataChunk 11.59 KB | 261.96 KB |

The site's four red tests of wave 7 are gone (GPT's "fix release checks" `f3fa187f`, merged at day 0): the full check is
green for the first time since wave 6. The build's export steps rewrote five `public/*.json` files with line-ending
changes only (`git diff --ignore-cr-at-eol` empty); restored with `git checkout`.

No product file outside the game changed in wave 8: `git diff --name-only e5f375e6 HEAD` (the day-0 merge to now) lists
nothing outside `src/opus-bay`, `tests/opus-bay-*`, `public/opus-bay`, `scripts/opus-sf`, `docs/opus-bay`; of the frozen
files only `data/playSave.ts` (the lead's W8-0d, MAX_BESTS 32 → 64) and a comment line in `economy/ledger.ts` changed.

## 2. Blocking items

No lane, lens, fixer, W8-I or W8-C reported a blocking item (K, Q, P, A, H, S, W1, W2, M, X: every "Blocking the go-live
to main" reads *Nothing* / *None*; every fixer's `blocking` list is empty; W8-I: *Nothing*). Nothing was reverted.

**The four review findings lost in the relay** (the critic's first go-live risk: lane H's 10th lens item, M-RP-5, P-RP-4,
P-RP-5) were recovered here from the workflow's own journal (`wf_66c65596-f6a`, the lenses' structured results) and checked:

| id | what the lens said | status on `ca25fc7b` |
|---|---|---|
| H-RP-5 (minor) | During the Chinatown Halloween Festival (31 Oct 11:00–15:00) a toy car stays parked mid-alley on Waverly Place among the lanterns and the costume line-up | **open, cosmetic** — seen again in this run's festival view (`perf/fest-desk/waverly-festival.jpg`: a green toy car behind the player). The city's parked-car layer is not lane H's; wave 9: keep cars off Waverly Place while the festival kit is up |
| M-RP-5 (minor) | Desktop: while the grip game holds Space, the ride's key bar still read "SPACE Hop off" | **fixed** (it is the code lens's M-C5, fixed in `e82f5863`: the move chip's hop-off hint has no key while `play-grip` is open). Seen fixed in this run's grip ride: the bar reads "Hop off", the panel "Grip (hold) SPACE" (`qa/w8/final/z-grip-ride-desk.jpg`) |
| P-RP-4 (minor) | BAYBAY's bubbles and voice keep running under the chunk-lost reload card | **fixed** by the P fixer (`game/baybayHold.ts` `baybayHeld()` also holds while `chunkLostCard()` is up; read in the code). The game behind the dim layer still runs (minor, wave 9) |
| P-RP-5 (minor) | While a panel chunk is pending or retried (up to 12 s), the HUD jumps into the panel-open layout with no spinner; a second M closes it | **open** — only on a lost or very slow network; no data is lost. Wave 9: a small loading state for the lazy panels |

None blocks the go-live.

## 3. The perf gate (`scripts/opus-sf/qa/perf/w4-perf.mjs`, dev server 5870, 03:11–04:19; paired runs to 04:50)

Tables: `C:/Users/willy/opus-qa/w8/final/perf/{desk,w8-desk,fest-desk,fleet-desk,hw-desk,mu-desk,ride-desk,phone,w8-phone,fest-phone,fleet-phone,hw-phone,mu-phone,ride-phone,tile-phone}/`.
New: `scripts/opus-sf/qa/perf/w8-spots.json` (the spots wave 8 touched most) and, for the two real rides (on board the
Alcatraz ferry, a Powell–Hyde car with the grip game running), a scratch driver
(`C:/Users/willy/opus-qa/w8/final/ride-perf.mjs`): it boards through `game/transit` (`rideFerry('pier-33',
'alcatraz-dock')`; `transit.ride('powell-hyde', 'hyde-beach', 'powell-market')` + a click on "Work the grip"), keeps the
HUD and the game panel visible (a real player's screen), samples every frame's calls / triangles / frame time for the
whole ride, and measures 6 s windows of frames at boarding, mid-Bay and on the island (ferry) and three windows during
the grip game.

### Desktop 1440 × 900, quality high, RTX — all pass

| spot / ride | calls | triangles | fps idle / walk (ride) | > 100 ms | W7-Z calls · tris |
|---|---|---|---|---|---|
| ferry-gate | 104 | 359k | 60.1 / 60.1 | 0 | 104 · 351k |
| chinatown | 126 | 302k | 60.1 / 60.1 | 0 | 123 · 290k |
| twin-peaks | 111 | 338k | 60.1 / 60.1 | 0 | 109 · 323k |
| civic-center | 79 | 227k | 60.1 / 60.1 | 0 | 77 · 220k |
| union-square | 84 | 246k | 60.1 / 60.1 | 0 | 83 · 244k |
| music-concourse | 93 | 253k | 60.1 / 60.1 | 0 | 91 · 242k |
| stonestown-sfsu | 74 | 193k | 60.1 / 60.1 | 0 | 72 · 195k |
| haight-usf | 98 | 299k | 60.1 / 60.1 | 0 | 96 · 278k |
| ocean-beach | 50 | 112k | 60.1 / 60.1 | 0 | 49 · 95k |
| ggb-south | 55 | 101k | 60.1 / 60.1 | 0 | 54 · 102k |
| mission | 87 | 343k | 60.1 / 60.1 | 0 | 86 · 319k |
| grace-nob-hill | 110 | 356k | 60.1 / 60.1 | 0 | 106 · 350k |
| powell-market | 101 | 283k | 60.1 / 60.1 | 0 | 98 · 281k |
| fidi | 105 | 285k | 60.1 / 60.1 | 0 | 103 · 279k |
| ggb-deck | 50 | 94k | 60.1 / 60.1 | 0 | 48 · 94k |
| hellman-hollow | 71 | 231k | 60.1 / 60.1 | 0 | 68 · 212k |
| marina-green | 75 | 158k | 60.1 / 60.1 | 0 | 74 · 157k |
| castro | 77 | 319k | 60.1 / 60.1 | 0 | 74 · 300k |
| filbert-steps | 88 | 328k | 60.1 / 60.1 | 0 | 86 · 325k |
| pier45 | 119 | 366k | 60.1 / 60.1 | 0 | 116 · 360k |
| ride bus-palace | 75 | 253k | (60.1) | 0 | 73 · 256k |
| ride n-duboce | 85 | 258k | (60.1) | 0 | 85 · 258k |
| ride m-west-portal | 67 | 226k | (60.1) | 0 | 67 · 226k |
| Halloween night Alamo Square | 83 | 330k | 60.1 / 60.1 | 0 | 83 · 330k |
| Halloween night Belvedere St | 100 | 329k | 60.1 / 60.1 | 0 | 100 · 330k |
| muertos procession, 2 Nov 19:10 night | 105 | 345k | 60.1 / 60.1 | 0 | 104 · 344k |
| **W8** Pier 33's quay (Alcatraz Landing) | 72 | 210k | 60.1 / 60.1 | 0 | — |
| **W8** Alcatraz's quay | 45 | 76k | 60.1 / 60.1 | 0 | — |
| **W8** the cellhouse front, looking back at the city | 86 | 221k | 60.1 / 60.1 | 0 | — |
| **W8** Grant Ave below the pagoda corner | 122 | 298k | 60.1 / 60.1 | 0 | — |
| **W8** … on 31 Oct 12:00 (festival day) | 122 | 294k | 60.1 / 60.1 | 0 | — |
| **W8** Waverly Place, the Chinatown Halloween Festival, 31 Oct 12:00 | 109 | 285k | 60.1 / 60.1 | 0 | — |
| **W8** the SS Jeremiah O'Brien, Pier 35 | 73 | 196k | 60.1 / 60.1 | 0 | — |
| **W8** Blue Heron (Stow) Lake | 83 | 209k | 60.1 / 60.1 | 0 | — |
| **W8** Aquatic Park, 9 Oct 11:20 (Parade of Ships) | 124 | 341k | 60.1 / 60.1 | 0 | — |
| **W8** Marina Green, 9 Oct 11:20 (the toy grey ships out in the Bay) | 79 | 159k | 60.1 / 60.1 | 0 | — |
| **W8 ride** on board the Alcatraz ferry, Pier 33 → the island (whole ride, every frame) | max **95** | max **387k** | boarding 60.1 · mid-Bay 60.1 · island 60.1 / 60.1 | 0 (worst frame 17.6 ms over 15,717 frames) | — |
| **W8 ride** Powell–Hyde from Hyde & Beach with the grip game running (every frame) | max 89 | max 318k | 60.1 · 60.1 · 60.1 | 0 (worst 17.5 ms) | — |

Programs 60 → 60 in every session; p95 16.7–16.8 ms everywhere. Max **126 calls** (Chinatown, W7-Z 123) / **387k
triangles** (on board the Alcatraz ferry crossing the Bay with the whole waterfront in view; the highest standing spot is
Pier 45, 366k, W7-Z 360k) — headroom 24 calls / 13k triangles. Most spots are a few calls and 0–20k triangles over W7-Z:
lane X's vehicle fronts and night glows, lane W2's west-side kit (ocean-beach +17k: the surfers and the break), lane W1's
Chinatown cluster inside the Dragon Gate's meshes (+3 calls), lane K's canopy dither (0 calls). The ferry's 387k is the
number to watch in wave 9: it is the one view near the 400k cap.

### Phone profile 390 × 844, dpr 3, quality mid, 4× CPU (RTX) — pass, 0 frames over 100 ms in every measured window

| spot / ride | calls · tris | fps idle / walk (ride) | > 100 ms | gate | W7-Z idle / walk |
|---|---|---|---|---|---|
| ferry-gate | 83 · 289k | 59.9 / 59.4 | 0 | pass | 60.1 / 59.7 |
| chinatown | 102 · 245k | 57.9 / 59.4 | 0 | pass | 60.1 / 60.1 |
| twin-peaks | 84 · 221k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 |
| civic-center | 67 · 175k | 59.6 / 59.9 | 0 | pass | 59.9 / 60.1 |
| union-square | 70 · 173k | 59.9 / 59.7 | 0 | pass | 60.1 / 60.1 |
| music-concourse | 75 · 180k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 |
| stonestown-sfsu | 65 · 141k | 59.9 / 60.1 | 0 | pass | 60.1 / 59.4 |
| haight-usf | 81 · 216k | 59.9 / 59.9 | 0 | pass | 60.1 / 60.1 |
| ocean-beach | 43 · 99k | 59.9 / 60.1 | 0 | pass | 60.1 / 60.1 |
| ggb-south | 49 · 90k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 |
| mission | 71 · 252k | 60.1 / 58.7 | 0 | pass | 60.1 / 60.1 |
| grace-nob-hill | 94 · 288k | 58.6 / 58.6 | 0 | pass | 60.1 / 60.1 |
| powell-market | 84 · 239k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 |
| fidi | 90 · 236k | 58.9 / 59.9 | 0 | pass | 60.1 / 58.4 |
| ggb-deck | 43 · 87k | 59.9 / 60.1 | 0 | pass | 60.1 / 60.1 |
| hellman-hollow | 59 · 168k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 |
| marina-green | 60 · 125k | 60.1 / 59.6 | 0 | pass | 60.1 / 60.1 |
| castro | 64 · 225k | 60.1 / 60.1 | 0 | pass | 60.1 / 59.9 |
| filbert-steps | 76 · 279k | 59.2 / 59.9 | 0 | pass | 59.9 / 60.1 |
| pier45 | 99 · 308k | 59.9 / 60.1 | 0 | pass | 60.1 / 60.1 |
| ride bus-palace | 62 · 171k | (59.4) | 0 | pass | (59.9) |
| ride n-duboce | 57 · 187k | (48.6) — paired: W7 (56.1), W8 (56.7) | 0 | pass | (59.7) |
| ride m-west-portal | 56 · 173k | (53.7) — paired: W7 (57.3), W8 (57.8) | 0 | pass | (59.9) |
| Halloween night Alamo Square | 63 · 222k | 58.9 / 51.2 | 0 | pass | 60.1 / 59.9 |
| Halloween night Belvedere St | 66 · 225k | 57.4 / 59.9 | 0 | pass | 60.1 / 60.1 |
| muertos procession, 2 Nov 19:10 | 88 · 247k | 59.9 / 54.6 | 0 | pass | 60.1 / 59.9 |
| **W8** Pier 33's quay | 65 · 194k | 58.9 / 57.2 | 0 | pass | — |
| **W8** Alcatraz's quay | 37 · 60k | 60.1 / 60.1 | 0 | pass | — |
| **W8** the cellhouse front | 75 · 186k | 59.4 / 59.9 | 0 | pass | — |
| **W8** Grant Ave at the pagodas | 101 · 239k | 50.9 / 51.2 — paired: W7 58.4 / 59.2, W8 57.4 / 57.1 | 0 | pass | — |
| **W8** … on 31 Oct 12:00 | 95 · 243k | 56.4 / 49.9 | 0 | pass | — |
| **W8** Waverly Place festival, 31 Oct 12:00 | 97 · 254k | 48.6 / 45.1 — paired: **W7 49.1 / 44.1**, W8 57.1 / 51.9 | 0 | pass | — |
| **W8** Aquatic Park, 9 Oct 11:20 | 97 · 273k | **41.8 / 39.1** in the chain — paired: **W7 54.4 / 48.2**, **W8 53.1 / 53.2** | 0 | pass on the paired re-run (below) | — |
| **W8** Marina Green, 9 Oct 11:20 | 64 · 127k | 50.4 / 51.7 — paired: W7 57.6 / 58.4, W8 60.1 / 60.1 | 0 | pass | — |
| **W8 ride** on board the Alcatraz ferry (boarding · mid-Bay · island idle / walk) | max 82 · 298k | 58.7 · 59.6 · 60.1 / 53.6 | 0 in the windows | pass | — |
| **W8 ride** Powell–Hyde with the grip game (three windows) | max 93 · 276k | 46.7 · 53.7 · 56.1 | 0 (worst 99.8 ms) | pass | — |

**The tile pool** (`--pool tile`, an iPhone without `WEBGL_multi_draw`): ferry-gate 93 · 289k, 60.1 / 58.7; chinatown
105 · 242k, 59.6 / 59.2; pier45 108 · 291k, 60.1 / 60.1; 0 frames over 100 ms (programs 57 → 57). The tile pool costs
+10 calls at the ferry gate and +3 / +9 elsewhere, as in wave 7; the worst phone call count anywhere is 108.

**The paired runs decide the low readings: none is a wave-8 regression.** The phone chain ran 03:43–04:19 after 30 min of
continuous desktop load, and its later sessions read lower than its first (the W7 tree measured tonight is also below
W7-Z's own figures of 30 Sep: n-duboce 56.1 vs 59.7). So every reading under 55 was re-measured right away on the W7
tree (`1d5d0d00`, what baylink.us serves, its own dev server on 5871) and on the W8 tree back to back, same runner and
flags (`C:/Users/willy/opus-qa/w8/final/pair/`):

- **Aquatic Park on the Parade of Ships morning** (the one gate failure of the chain, 41.8 / 39.1): W7 54.4 / 48.2, W8
  53.1 / 53.2. The view (the Maritime Museum's lawn and its crowd, the cove) is heavy on the 4× phone on both trees; the
  toy ships add 2 calls and ≤ 3.2k triangles (lane S) and no measurable time. **Pass on the re-run; not wave 8.**
- **Waverly Place, the festival** (45.1 walking): W7 49.1 / **44.1** (the live tree itself dips under 45 there), W8
  57.1 / 51.9. Not wave 8.
- **The two Metro camera rides** (48.6 / 53.7) and **Grant Ave at the pagodas** (50.9 / 51.2): within 1 fps of W7 in the
  pairs (rides W7 56.1 / 57.3 vs W8 56.7 / 57.8; pagodas W7 58.4 / 59.2 vs W8 57.4 / 57.1). Their calls and triangles are
  W7-Z's to the call. Not wave 8.

**Long frames on the ferry.** The ride driver also samples every frame of the whole ferry trip (from asking for the boat
at Pier 33 through the ≈ 140 s wait, the 84 s crossing and the arrival: ≈ 15,600 frames). Desktop: worst 17.6 ms. Phone:
the first run saw **2 frames over 100 ms (worst 333 ms)** outside the measured windows; a second run with a frame log
(`perf/hitch-phone/events.json`) saw **none** (worst 99.9 ms): its frames over 50 ms all came while the player stood on
Pier 33's quay waiting for the boat (83 and 100 ms at 23 s and 61 s), plus three of 67 ms at boarding, mid-Bay and the
island's arrival bubble. No measured window had a long frame. Recorded for wave 9 (lane A: profile the quay wait at 4×
CPU); not a gate failure (the gate counts the measured windows, as in every wave).

**Perf verdict: pass on both profiles; no wave-8 regression.** Desktop max 126 calls / 387k triangles at 60 fps; phone 0
frames over 100 ms in every window and every spot ≥ 45 fps, the one chain reading under 45 re-measured at 53.1 and matched
by the live W7 tree.

## 4. The static walk sweep (`sweep-static.mts`, node, the published city, 8 s)

| | W7-Z | **W8-Z** |
|---|---|---|
| targets | 694 | **699** (+ lane A's Pier 33 quay, the island dock and its walk points, lane W1's targets) |
| ok · CORRIDOR | 547 · 146 | **550 · 149** |
| BOXED · SNAG | 0 · 0 | **0 · 0** |
| UNREACHABLE · OFF | 1 · 0 | **0 · 0** |

- **The last UNREACHABLE is gone**: `trip:ss-jeremiah-obrien` is **ok** (lane W1's O'Brien at Pier 35 and her trip end on
  the apron, `(-126, -10)`; four ways open). Wave 8's target of 0 is met.
- New CORRIDORs are lane A's: `ferry:pier-33`, `ferry:alcatraz-dock`, `island:alcatraz:5` (the stair top) and `:6` (the
  cellhouse front) — two ways open along the quay / the road, the water or the walls on the other two (reported, not
  failures). `cable:powell-geary` stays CORRIDOR (W7-Z's note).
- By owner (targets / CORRIDOR): A views 16 / 0, A arrivals 3 / 3, C 16 / 2, D 35 / 8, E coins 180 / 40, caches 40 / 0,
  F deck 21 / 21, L 31 / 6, N 158 / 40, R 24 / 9, T 175 / 20. JSON: `C:/Users/willy/opus-qa/w8/final/sweep/static.json`.

## 5. Production build and the production CSP (`scripts/opus-sf/qa/csp-serve.mjs`)

The site's own build (`npm run build` above, `dist/`, what Vercel deploys) served with `vercel.json`'s headers, rewrites
and routes on 5517, six headless sessions through the UI and URL parameters only (the production build has no QA hooks
and ignores `?date`, so these ran on the real Bay time, 1 Oct ≈ 04:35):

1. desktop `/opus-bay?halloween=1` — the title shows the Halloween key art (`w6/art/key-wide-halloween-1920.webp`);
2. phone 390 × 844 dpr 3, **a new player from the title**, `?halloween=1`: Start → the Ferry Building arrival with
   BAYBAY's four choices ("Hi! Welcome to San Francisco — I'm BAYBAY. First time here?"), the city loaded (`cityMode`,
   `cityDataChunk`, `cityLive`, `zones3`, `fleetWeekDay`, `alcatrazLines` among 228 scripts) (`qa/w8/final/z-prod-arrival-phone.jpg`);
3. desktop `?start=free&at=xz:-94,-21.8` — **Pier 33 · Alcatraz Landing**: the "E Take the ferry" prompt, clicked: the
   deckhand's card "The little ferry isn't running yet. The first boat leaves at 8:40 a.m. Check the official site for
   times." (the right answer at 04:37 Bay time) (`z-prod-pier33-deckhand-desk.jpg`);
4. desktop `?halloween=1&at=xz:-452.26,-74.85` — **Alcatraz's quay**: the pill reads Alcatraz Island · East Road, the
   prompt "Take the ferry · Alcatraz dock", a walk;
5. desktop `?start=free&at=xz:455,636.5` — **24th St, a new wave-8 game**: "E Practise with BAYBAY · Jam with the
   busker", clicked: the jam panel opens from its lazy chunk — "BAYBAY plays the intro… tap as each dot meets the ring!"
   (the busker is out 12:00–20:00; at other hours BAYBAY plays his tune), two Spaces, Escape (`z-prod-busk-desk.jpg`);
6. desktop, **the district from the title**: Start → "Hi! Welcome to the Bay" with the district's own choices (7 stops,
   8 postcards); its scripts include no `cityMode` / `cityDataChunk` / `cityLive` (the same `city-ui` / `cityHooks` pair as
   W7-Z's district session).

`/__csp-stats` after all six: **0 violations, 0 failed requests, 1789 served** (W7-Z: 0 / 0 / 1514 over five sessions).
No page exception and no console error in any session.

## 6. District regression (`?world=district`, dev server)

| view | calls | triangles | objects | W7-Z |
|---|---|---|---|---|
| the title diorama | **71** | **225,070** | **262** | 71 · 225,070 · 262 |
| free roam at the Ferry Building, `?halloween=night` added | 75 → 75 walking | 241k → 241k | 266 | 74 → 73 · 232k → 231k · 266 (W6-Z 77 → 74 · 242k → 229k) |

The title is identical to W7-Z, W6-Z and W5-Z. Free roam stays within the range of the moving actors and the ferry at its
slip (W6-Z read 77 / 242k there); objects 266 as before. With `?halloween=night` the district loads no city and no
Halloween feature (`city: false`, `halloween: false`, no city chunk); the page title stays "Explore the Embarcadero with
BAYBAY", golden hour, Postcards 0/8, Goals 0/5. The hero regression test is green in the suite. One known bend (the
critic's): lane Q's coarse-pointer 44 px map tools are touch-only CSS that also reach a district map on a phone; the
1440 × 900 hero is unchanged.

## 7. 网站联动 (sf-w7-lead.md §7.2, on the final tree)

Checked on `ca25fc7b`. **`origin/main` has 6 site commits that are not on `opus-bay`** (GPT, 30 Sep 18:51–22:41:
`263bfc43`, `25ab971a`, `b7b82ff4`, `2d9d9da9`, `f5b059ca`, `652a9975`); the lead merges them at the go-live (§9).

| what | how checked | result |
|---|---|---|
| every SF event of the catalog window is in the world or kept out for a stated reason | `tests/opus-bay-w6-s-venues.test.ts` (+ lane S's wave-8 guards) inside the check's run | green |
| every shown event has a souvenir id and a name | `tests/opus-bay-w7-s-venues.test.ts` W7-S1 guard and lane S's wave-8 venue tests | green |
| the 新店 signs follow the site's current openings (open / soft_open, SF) | `tests/opus-bay-w6-s-openings.test.ts` | green |
| `live.json` matches the site's offers | re-exported now (`npx tsx scripts/opus-sf/export-live.ts`, 14 SF offers): **only the `exported` date changed** (2026-09-30 → 10-01); restored | in sync |
| the calendar rows carry sources (Fleet Week's Parade of Ships 9 Oct, the Chinatown Halloween Festival 31 Oct, DST 1 Nov, Día de los Muertos 2 Nov) | `tests/opus-bay-w7-s-dates.test.ts`, `tests/opus-bay-w5-calendar.test.ts`, lane S's W8-S tests | green |
| every link the game opens resolves | `tests/opus-bay-w7-s-site.test.ts` + W8-S1 (`/events/:id`, `/openings/:id`, `/offers/:id`, guides: in `vercel.json` and the 566 prerendered pages; the game opens no `/together` or `/me/bookings` page — adults-only, signed-in flows) | green |
| the 今天 tab and 这周去哪 read today's data | `tests/opus-bay-w5-today.test.ts` (60 days × 3 times since W8-I) | green |
| the merge with `origin/main` | `git merge-tree --write-tree HEAD origin/main`: **clean** (exit 0). Main's only game-side edits: `realsf/eventVenues.ts` `WORLD_SKIP` gains seven SFPL events of 30 Sep ("pending independent world import") and `tests/opus-bay-w6-s-venues.test.ts` follows; `vercel.json` gains routes (the `/opus-bay` route and the CSP unchanged) | clean |

**At the go-live (lead):** after merging `origin/main`, map the SF Zoo resident free day (W8I-WS-6; it lives only in
main's `src/data/october-refresh-offers.ts`, so it cannot be mapped on `opus-bay` first — the export throws for an id the
site data lacks) in `scripts/opus-sf/export-live.ts` `SPECS` and re-export `live.json`:

```ts
  {
    id: 'sf-zoo-resident-free-oct7-2026', kind: 'park', free: true, who: { zh: 'SF 居民 · 凭地址证件', en: 'SF residents · with proof of address' },
    place: { id: 'sf-zoo', x: -110.3, z: 1657.6, name: { zh: '旧金山动物园', en: 'the San Francisco Zoo' } }, hours: [H(10), H(16)],
    ruleUrl: 'https://www.sfzoo.org/calendar/sf-resident-free-day-5/', ruleCheckedAt: '2026-09-30',
  },
```

(the place is `data/sf/attractions.ts` `sf-zoo`; the 10:00–16:00 window and the source are the site's own row,
`verifiedAt 2026-09-30`). Then `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-w6-s-*.test.ts
tests/opus-bay-w7-s-*.test.ts tests/opus-bay-w8-s-*.test.ts` and the full `npm run check` on the merged tree.

### Lane Q's language scan on the final tree (`scripts/opus-sf/qa/lang-scan.mjs`, dev server, `--query '&halloween=1&date=2026-10-02T11:00'`)

- **English, 390 × 844 touch: 56 screens, 0 leaks** (15 allowed, e.g. the language picker's own 简体 / 繁體 labels), 0
  page errors — the title, the arrival and its choices, the goals step, the HUD, 更多, the map with its tabs, legend,
  search and a place card, 这周去哪 and its board, three event cards, Ask, every Journal tab and Notebook page top and end
  (Today, Stamps, Finds, Views, City sounds, Footprints, Halloween, Postcards, Goals, Wishlist), the shop, the album,
  Settings, a result card, a Halloween postcard, a Powell–Hyde ride, an underground Metro ride, **the busker jam, the
  Alcatraz ferry** and Coit Tower's arrival, plus every canvas text. **The P0 "English never shows Chinese" holds on the
  final tree**, after W8-I's and W8-C's last text edits (todayLine, TodayTab, the screen-reader prompt).
- **繁體, 1440 × 900: 55 screens, 0 Simplified-only characters**, 0 page errors. The scanner's round-trip judge (W8-I,
  tw → cn → tw) flags five distinct texts that the site's own converter does not give back unchanged: **馬裡納區** (the
  Marina's area name on map rows, Notebook headings and Footprints: a transliteration wants 里, the converter writes 裡)
  and **小傢夥** (an egg's caption; 傢伙 is the usual form). Both come from the site's `translateText` over-converting at
  runtime (the same family as W2-P2's 海里 → 海裡), not from Simplified text: a request to the site's editors (§10), not a
  go-live item.

## 8. What W8-Z changed

| commit | what | files |
|---|---|---|
| this one | the wave-8 perf spots (Pier 33, the island's quay and cellhouse front, Grant Ave at the pagodas, Waverly Place's festival, the O'Brien, Stow Lake, Aquatic Park and Marina Green on the Parade of Ships morning); this report and its QA shots | `scripts/opus-sf/qa/perf/w8-spots.json` (new), `docs/opus-bay/sf-w8-final-verify.md`, `docs/opus-bay/qa/w8/final/*` |

No product code changed; nothing was reverted.

## 9. The owner's LAN phone package

Rebuilt from this tree at 04:46 (`npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/dist-phone
--emptyOutDir`, 36 s): the same GameRoot file as the site build (`GameRoot-BbJH-ms2.js`, 258.04 KB gzip); no `public/`
churn. The preview `opus-bay-phone` (`.claude/launch.json`, port 4174) was not running: start it to serve
http://10.0.0.85:4174/opus-bay for the owner's iPhone pass (`docs/opus-bay/iphone-checklist.md`).

## GO / NO-GO for fast-forwarding `main` to `opus-bay`: **GO**

- **Checks:** the site's full `npm run check` is **green** (EXIT 0; the first fully green check since wave 6): eslint 0
  errors, 2845 tests with 0 failures (1 registered todo), build, prerender 566 pages, 541 share cards; `tsc` 0; opus-bay
  **1871 tests, 0 fail** (1 todo).
- **Blocking items:** none from ten lanes, twenty lenses, ten fixers, W8-I, the critic and W8-C. The four relay-cut review
  findings were recovered from the workflow journal and checked: two fixed, two cosmetic / network-only minors (§2).
- **Perf:** desktop all pass (max 126 calls / 387k triangles, 60 fps, 0 long frames — on board the Alcatraz ferry and
  with the grip game included); phone every spot ≥ 45 fps and 0 frames over 100 ms in every measured window; the
  chain's one reading under 45 (Aquatic Park on the Parade of Ships morning) re-measured at 53.1 / 53.2, with the live W7
  tree at 54.4 / 48.2 on the same spot — not wave 8. Every paired run puts wave 8 level with or above wave 7.
- **GameRoot 258.04 KB** ≤ 265 (3.92 KB under W7-Z); lane P's 255 target missed (an open item, not a gate).
- **Sweep:** 699 targets, 0 boxed, 0 snag, 0 off and — new — **0 unreachable** (the O'Brien is reachable).
- **Production:** 0 CSP violations and 0 failed requests in six sessions (1789 requests), including a phone new-player
  start, the Alcatraz ferry's quay and the island, a wave-8 game (the busker jam) and the district start.
- **District:** unchanged (71 / 225,070 / 262).
- **Words:** English 56 screens with 0 Chinese; 繁體 55 screens with 0 Simplified-only characters.
- **网站联动:** in sync on `opus-bay` (live.json re-exports identically; every guard green). `origin/main` has six newer
  site commits; the merge is clean (`git merge-tree`).

**The lead's go-live, in order:** (1) `git worktree prune` first (admin folders from tonight's lanes under
`baylink-web/.git/worktrees/` could not be deleted: OneDrive locks); (2) merge `origin/main` into `opus-bay` (a normal
3-way merge: clean); (3) map the 7 Oct SF Zoo resident free day in `export-live.ts` and re-export `live.json` (§7, the
exact row); (4) the S guards and the full `npm run check` on the merged tree; (5) fast-forward `main`; (6) the owner checks
baylink.us/opus-bay once on a phone. The Halloween season is already running by the Bay date (1 Oct, 00:05).

## 10. Open (owners named; none blocks the merge)

From this run:

- **The phone ferry trip** (lane A): one phone run saw 2 frames over 100 ms (worst 333 ms) outside the measured windows,
  a second run none (worst 99.9 ms, while waiting on Pier 33's quay for the boat). Profile the quay wait at 4× CPU.
- **The ferry crossing's 387k triangles** (desktop high, the whole waterfront from mid-Bay) is the one view within 13k of
  the 400k cap: anything wave 9 adds along the north waterfront should be measured from the boat.
- **Heavy phone views on both trees** (not wave 8): Aquatic Park's lawn on 9 Oct and Waverly Place on 31 Oct read 44–54
  fps at 4× CPU on W7 and W8 alike; the crowd near a spot is the first thing to trim if wave 9 adds there.
- **繁體 converter** (the site's `translateText`, site editors): 馬裡納區 → 馬里納區 (transliteration), 小傢夥 → 小傢伙; lane
  Q: the scanner should report a text only when it holds a Simplified-only character (its `simplified` field), and list
  round-trip differences apart.
- **H-RP-5** (lane H / lane K): a toy car parked mid-alley on Waverly Place during the festival (seen again here).
- **P-RP-5** (lane P): no visible state while a lazy panel chunk is retried on a bad network (up to 12 s).
- **GameRoot** 258.04 KB: the 255 target needs lane P's remaining moves; the static guard sits at 258.5 (0.2 KB headroom).

Carried from the lanes, W8-I and the critic (each report's Open section has the detail): the map sheet during a ride on
desktop (D-2); the island's walking ETA to Coit Tower (D-4); BAYBAY's density on a first Powell ride (P-7); the today line
and the pelican's later line as fixed voiced lines (WS-1, K-RC-3); the Sing Fat roof colour's source or a re-recording
(WS-4); the waypoint edge arrow under the ride banner / play chip at 375 × 553 and 844 × 340; a parked ride > 250 u away
towed only on return; the Fleet Week photo framing at Marina Green (S-P3); a landscape layout for the seven SF game panels;
two muted voice clips and two unrecorded short lines; the Haight mural kit, Chase Center, the de Young twist and the far
City Hall dome (not built); the canopy dither not played on the Powell–Mason / California lines; a real iPhone pass of the
wave-8 panels; the site editors' items (the Chinatown Halloween Festival in the catalog, the Exploratorium / Gott's English
entries, the seniors' Muni source, the seven SFPL events main left "pending" for a world import).

## Files

- QA images (`docs/opus-bay/qa/w8/final/`, every one read): `z-chinatown-desk.jpg` (the Dragon Gate with Old St. Mary's and
  a pagoda roof up Grant Ave), `z-chinatown-pagodas-phone.jpg` (phone, Grant Ave: the Sing Chong / Sing Fat pagoda roofs,
  Old St. Mary's clock tower, Coit Tower beyond), `z-fleet-week-marina-desk.jpg` (9 Oct 11:20, the toy grey ships in the
  Bay off the Marina, Alcatraz and Angel Island behind), `z-alcatraz-island-desk.jpg` (after a real ferry ride: the
  island, pill Alcatraz Island · East Road, BAYBAY's 13-storey line), `z-grip-ride-desk.jpg` (the grip game on a
  Powell–Hyde car up Hyde St: the panel's "Grip (hold) SPACE", the move chip's "Hop off" without a key, BAYBAY's bubble,
  the canopy dither over the rider), `z-prod-arrival-phone.jpg` (production phone, a new player's arrival),
  `z-prod-pier33-deckhand-desk.jpg` (production, Pier 33's deckhand before the first boat), `z-prod-busk-desk.jpg`
  (production, the busker jam's panel on 24th St).
- Scratch: `C:/Users/willy/opus-qa/w8/final/` (`logs/` with the check, suite, tsc, sweep, every perf run and the language
  scans; `perf/<run>/` tables, JSON and shots; `pair/` the paired W7 / W8 runs; `sweep/static.json`; `csp/` with
  `stats.json` and the shots; `district/`; `lang/`; the drivers `ride-perf.mjs`, `ride-hitch.mjs`, `csp-run.mjs`,
  `district.mjs`, `perf-chain.sh`, `pair-chain.sh`).
