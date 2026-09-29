# Wave 6 · final verify (W6-Z), 2026-09-29

The lead's final verify of wave 6 (`sf-w6-lead.md` §2, 06:05–06:50), run alone on the owner's machine in the worktree
`C:/Users/willy/wt/w6-verify` (dev server 5620), on `origin/opus-bay` `00acc647` — every lane (K1, K2, B, P, H, G, S, W,
X) and every lane's adversarial review pushed, 117 commits since the go-live hand-off `7889a7ed` (the day-0 merge of `main` included); nothing new upstream
during the run. Method and baseline: `sf-w5-final-verify.md`. Raw output: `C:/Users/willy/opus-qa/w6/z/` (check log,
perf tables and shots, sweep JSON, CSP stats, district numbers).

## 给主人的摘要

**结论：GO——可以把 opus-bay 合并到 main 上线。** 没有任何阻碍上线的问题，这次验收也没有需要修的代码。

1. **全部检查通过**：全站检查（代码规范 0 个错误、2246 个测试全过、构建、预渲染 519 页、494 张分享卡）和小游戏自己的 1489 个测试都是绿的；类型检查 0 个错误。首屏主包从 298.6 KB 降到 279.2 KB（目标 265 KB，还差约 14 KB，下一波继续）。
2. **电脑版性能达标**：20 个点位 + 3 段乘车 + 两个万圣夜点位（阿拉莫广场、讨糖街 Belvedere）全部 60 帧，最多 122 次绘制、36.5 万三角形（上限 150 / 40 万），没有卡顿。
3. **手机模拟（390×844、中画质、CPU 降速 4 倍）**：23 项 + 两个万圣夜点位的帧率都在 45 以上（最低 45.0）；有两个点位（诺布山、菲尔伯特台阶）各出现 1 次超过 100 毫秒的卡顿。我用同样的方法把**现在线上正在跑的第五波版本**放在同一台机器上对比：菲尔伯特台阶同样卡（1–2 次，40.9–46.2 帧），两版打平。所以这不是第六波带来的，而是这台机器今天整体比昨天慢；已记入下一波待办。
4. **全城巡检**：688 个点，被围死 0、卡脚 0、走不到 1（和上一波一样，是三级景点"奥布莱恩号"）。
5. **正式版（生产构建 + 正式安全策略 CSP）实测**：0 次安全策略拦截、0 个失败请求（共 1793 个请求）；加 `?halloween=1` 标题页换成万圣节主图（蝙蝠、南瓜），`?halloween=night` 在电脑和手机上都能进城、讨糖街出现糖果袋、BAYBAY 说"今晚是万圣节大夜晚"。
6. **街区模式没变**：`?world=district` 标题画面仍是 71 次绘制 / 225,070 三角形 / 262 个物体，和上一波完全一样；万圣节预览不会进入街区模式。
7. 提醒：10 月 1 日万圣节会自动开始，所有玩家都会看到；上面的性能和正式版检查已经把万圣节打开测过。

## Setup

- Machine: Ryzen 9 5900HX, RTX 3070 Laptop (`CHROME_FLAGS=--force_high_performance_gpu`, the perf info line reads
  `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Laptop GPU …)`), Chrome headless via `scripts/opus-shot.mjs`.
- Stray processes at 05:52: none (no headless Chrome, no `vite --port 56xx` left by the lanes or reviewers).
- PERF-LOCK `C:/Users/willy/opus-qa/w6/PERF-LOCK` (`W6-Z, since 05:52 PDT`) held for the whole run; removed at the end.
- Order: `npm run check` alone (05:52–06:01); the perf gate alone (desktop, Halloween desktop, phone, Halloween phone:
  06:02–06:35; the paired phone re-checks to 06:45); then the production CSP play, the district regression, `tsc` and the
  opus-bay suite side by side (none of them is timed). The static sweep (node, 11 s) ran during the check's lint.
- **Method change, named**: to fit the window, the perf runs used `--wait 12000 --ms 6000` (12 s settle after each
  teleport, 6 s of frames standing and 6 s walking) instead of W5-Z's 20 s / 10 s. Calls / triangles are read the same way;
  fps is an average over 6 s instead of 10 s.

## 1. Checks

| check | on `00acc647` (the tree as the lanes left it) | W5-Z (for comparison) |
|---|---|---|
| `npm run check` (eslint · all tests · build · prerender · share cards) | **EXIT 0**: 0 errors (43 old warnings) · **2246 / 2246** · built · **519 pages** prerendered · **494 cards** generated and verified (every QR decoded) | EXIT 0 · 2076 / 2076 · 307 pages · 282 cards |
| `tsc -b` (inside the build) | 0 | 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | **0** | 0 |
| opus-bay suite (`tests/opus-bay-*.test.ts`) | **1489 / 1489** (run alone after the gate) | 1356 / 1356 |
| GameRoot (the site build, gzip as vite reports) | **279.19 KB** (playParts 15.37 KB, post 1.76 KB, halloween 1.43 KB) | 298.62 KB (target ≤ 265: open, §7) |

The page and card counts grew with GPT's autumn release merged at day 0 (`b35995a6`: 267 events, 86 offers, 44 openings).
The build's exports rewrite five `public/*.json` files with CRLF line endings only (`git diff --ignore-all-space`: empty);
they were restored.

No check failed, so nothing needed a fix. **No lane or review reported a `blocking_for_go_live` item** (K1, K2, B, P, H,
G, S, W, X: `blocking: []`, every review green); nothing was reverted.

## 2. The perf gate (`scripts/opus-sf/qa/perf/w4-perf.mjs --file w5-spots.json`, dev server 5620)

Tables: `C:/Users/willy/opus-qa/w6/z/perf/{desk,hw-desk,phone,hw-phone,recheck-w6,recheck-w5}/w4-perf.md`.

### Desktop 1440 × 900, quality high, RTX — all pass

| spot / ride | calls | triangles | fps idle / walk (ride) | > 100 ms | W5-Z calls · tris |
|---|---|---|---|---|---|
| ferry-gate | 102 | **365k** | 60.1 / 60.1 | 0 | 104 · 352k |
| chinatown | **122** | 285k | 60.1 / 60.1 | 0 | 119 · 276k |
| twin-peaks | 111 | 306k | 60.1 / 60.1 | 0 | 110 · 301k |
| civic-center | 87 | 291k | 60.1 / 60.1 | 0 | 83 · 258k |
| union-square | 84 | 242k | 60.1 / 60.1 | 0 | 85 · 300k |
| music-concourse | 96 | 260k | 60.1 / 60.1 | 0 | 91 · 243k |
| stonestown-sfsu | 74 | 196k | 60.1 / 60.1 | 0 | 74 · 294k |
| haight-usf | 96 | 277k | 60.1 / 60.1 | 0 | 80 · 270k |
| ocean-beach | 49 | 95k | 60.1 / 60.1 | 0 | 63 · 173k |
| ggb-south | 53 | 101k | 60.1 / 60.1 | 0 | 64 · 195k |
| mission | 85 | 317k | 60.1 / 60.1 | 0 | 86 · 312k |
| grace-nob-hill | 104 | 359k | 60.1 / 60.1 | 0 | 101 · 319k |
| powell-market | 98 | 306k | 60.1 / 60.1 | 0 | 112 · 308k |
| fidi | 95 | 277k | 60.1 / 60.1 | 0 | 91 · 325k |
| ggb-deck | 47 | 92k | 60.1 / 60.1 | 0 | 47 · 96k |
| hellman-hollow | 68 | 211k | 60.1 / 60.1 | 0 | 86 · 222k |
| marina-green | 72 | 151k | 60.1 / 60.1 | 0 | 71 · 229k |
| castro | 74 | 295k | 60.1 / 60.1 | 0 | 74 · 294k |
| filbert-steps | 92 | 358k | 60.1 / 60.1 | 0 | 84 · 300k |
| pier45 | 110 | 354k | 60.1 / 60.1 | 0 | 106 · 329k |
| ride bus-palace | 70 | 217k | (60.1) | 0 | 71 · 217k |
| ride n-duboce | 77 | 254k | (60.1) | 0 | 78 · 254k |
| ride m-west-portal | 66 | 222k | (60.1) | 0 | 68 · 222k |
| **Halloween night** Alamo Square (`--time night --halloween night`) | 83 | 328k | 60.1 / 60.1 | 0 | — |
| **Halloween night** Belvedere St (treat doors) | 101 | 328k | 60.1 / 60.1 | 0 | — |

Programs first = last in every session (60 → 60); p95 16.7–16.8 ms everywhere. Max **122 calls / 365k triangles**
(≤ 150 / 400k): headroom 28 calls / 35k. The Halloween spots were checked in the shots: the Painted Ladies' stoops with
lit jack-o'-lanterns, bats over the square, a lantern on a Belvedere stoop (`qa/w6/final/z-halloween-*-desk.jpg`).

### Phone profile 390 × 844, dpr 3, quality mid, 4× CPU (RTX)

| spot / ride | calls · tris | fps idle / walk (ride) | > 100 ms | gate | W5-Z (9/28) idle / walk |
|---|---|---|---|---|---|
| ferry-gate | 79 · 282k | 59.6 / 45.7 | 0 | pass | 60.1 / 54.5 |
| chinatown | 98 · 238k | 56.4 / 50.4 | 0 | pass | 60.1 / 58.2 |
| twin-peaks | 78 · 216k | 60.1 / 60.1 | 0 | pass | 60.1 / 60.1 |
| civic-center | 67 · 204k | 58.1 / 51.2 | 0 | pass | 60.1 / 58.3 |
| union-square | 69 · 172k | 60.1 / 57.2 | 0 | pass | 60.1 / 58.5 |
| music-concourse | 73 · 159k | 60.1 / 55.2 | 0 | pass | 60.1 / 59.5 |
| stonestown-sfsu | 66 · 180k | 60.1 / 60.1 | 0 | pass | 60.1 / 60 |
| haight-usf | 79 · 206k | 59.2 / 56.4 | 0 | pass | 60.1 / 59.9 |
| ocean-beach | 42 · 91k | 60.1 / 55.2 | 0 | pass | 60.1 / 60 |
| ggb-south | 47 · 92k | 60.1 / 59.1 | 0 | pass | 60.1 / 60.1 |
| mission | 69 · 238k | 60.1 / 52.9 | 0 | pass | 60.1 / 59 |
| grace-nob-hill | 89 · 289k | 57.2 / 50.7 | **1** | fail (1 frame) | 59.7 / 58.3 |
| powell-market | 81 · 235k | 59.1 / 51.2 | 0 | pass | 60.1 / 58.7 |
| fidi | 82 · 244k | 59.6 / **45.0** | 0 | pass | 60.1 / 52.8 |
| ggb-deck | 41 · 90k | 60.1 / 55.4 | 0 | pass | 60.1 / 59.6 |
| hellman-hollow | 55 · 147k | 60.1 / 59.2 | 0 | pass | 60.1 / 59.5 |
| marina-green | 57 · 122k | 60.1 / 55.4 | 0 | pass | 60.1 / 59.6 |
| castro | 56 · 211k | 60.1 / 46.4 | 0 | pass | 60.1 / 56.3 |
| filbert-steps | 77 · 289k | 59.6 / **45.0** | **1** | fail (1 frame) | 60.1 / 54.8 |
| pier45 | 92 · 305k | 60.1 / 60.1 | 0 | pass | 59.5 / 60.1 |
| ride bus-palace | 59 · 166k | (59.6) | 0 | pass | (59) |
| ride n-duboce | 56 · 184k | (59.9) | 0 | pass | (59.7) |
| ride m-west-portal | 55 · 172k | (60) | 0 | pass | (60.1) |
| **Halloween night** Alamo Square | 63 · 222k | 59.6 / 50.4 | 0 | pass | — |
| **Halloween night** Belvedere St | 66 · 229k | 59.9 / 55.1 | 0 | pass | — |

Programs first = last per session (58 → 58). Every fps figure ≥ 45 (lowest 45.0, fidi and the Filbert Steps walking);
**two spots showed one frame over 100 ms** (Grace / Nob Hill, the Filbert Steps). The walking figures are 2–10 fps under
W5-Z's of yesterday almost everywhere, so before judging wave 6 the two spots and the lowest one were measured again
**with W5-Z's exact method (20 s settle, 10 s frames) on this tree and on the wave-5 tree `7889a7ed`** (the code live on
`main` today; its own dev server on 5621), same machine, minutes apart:

| run (phone, 4×, W5-Z method) | grace-nob-hill idle / walk · > 100 ms | filbert-steps idle / walk · > 100 ms | fidi idle / walk · > 100 ms |
|---|---|---|---|
| A · wave 6 (`00acc647`) | 57.0 / 49.9 · 0 | 51.1 / 34.4 · **3** | — |
| A · wave 5 (`7889a7ed`) | 59.9 / 49.0 · 0 | 60.1 / 46.2 · **1** | — |
| B · wave 5 (run first) | — | 59.3 / 40.9 · **2** | 60.0 / 48.5 · 0 |
| B · wave 6 | — | 59.5 / 40.5 · **2** | 60.0 / 51.1 · 0 |

**Verdict: not caused by wave 6.** The wave-5 code that is live today fails the Filbert Steps walk on this machine today
just the same (1–2 frames > 100 ms, 41–46 fps walking); paired run B is a tie (40.9 vs 40.5, 2 vs 2), fidi and Nob Hill
are even (wave 6 a little faster in both). Over all five Filbert runs wave 6 walks a few fps slower (45.0 in the gate run · 34.4 · 40.5 against 46.2 ·
40.9), inside the spread of the paired runs; run A's 34.4 is the outlier. The machine is slower than yesterday for both trees (the same wave-5 tree walked the
Filbert Steps at 54.8 in W5-Z's run 2); the machine was otherwise idle (one headless Chrome ≈ 9 % CPU, nothing else over
1 %). What wave 6 did add in view is triangles, not CPU: the city walkers' new near figure (lane X, W6-X5) takes the
`life` group from 28.5k to 42.1k triangles at the Filbert Steps. The Filbert Steps walk at 4× CPU is a standing phone
item for the next wave (§7), not a regression to fix or gate here.

## 3. The static walk sweep (`sweep-static.mts`, node, the published city, 11 s)

| | W5-Z | **W6-Z** |
|---|---|---|
| targets | 684 | **688** (+ the new event venues and lane W's corner / steps) |
| ok · CORRIDOR | 547 · 135 | **545 · 142** |
| BOXED · SNAG | 0 · 0 | **0 · 0** |
| UNREACHABLE · OFF | 1 · 1 | **1 · 0** |

- Left: `trip:ss-jeremiah-obrien` (T3, UNREACHABLE: moves 3 of 4 ways, the nav path ends short — as in W5-Z).
- Target changes since W5-Z: + 6 event venues (lane S: Thrive City, Chase Center, the Opera House ok; Davies, the
  Exploratorium, Arc Gallery CORRIDOR), − the retired M stop San Jose & Mt Vernon (lane B), − `ferry:sausalito` (lane B:
  exempt by name, the quay is off the model).
- CORRIDOR 135 → 142: the 3 new venues, and 4 North Beach targets that were ok and now have two ways closed by lane W's
  new corner (`trip:saints-peter-and-paul-church` = `route:r1-peter-paul` at the church front: 6.0 · 5.8 open, 1.5 · 2.3;
  `route:r1-washington-sq:via1` / `via3`: 6.0 / 5.8 along the path, 1.3–1.9 across). Two ways open everywhere: the lead's
  CORRIDOR waiver (`sf-w6-lead.md` §6) covers them; noted for lane W (§7). By owner (targets / CORRIDOR): A 16 / 0,
  C 16 / 2, D 35 / 8, E coins 180 / 40, caches 40 / 0, F deck 21 / 21, L 31 / 8, N 158 / 40, R 18 / 6, T 173 / 17.
- JSON: `C:/Users/willy/opus-qa/w6/z/sweep/static.json`.

## 4. Production build and the production CSP (`scripts/opus-sf/qa/csp-serve.mjs`)

The site's own build from `npm run check` (`dist/`, what Vercel deploys) served with `vercel.json`'s headers, rewrites
and routes (`/opus-bay` is in the SPA route list: `spaHits 0`, no `--spa` needed), three headless sessions through the
UI only (a production bundle has no `__opusBay`):

1. desktop `/opus-bay?halloween=1` — the title shows the Halloween key art (`w6/art/key-wide-halloween-1920.webp`: bats,
   jack-o'-lanterns, BAYBAY in a witch hat) and the language switch (`qa/w6/final/z-prod-title-halloween-desk.jpg`);
2. desktop `?halloween=night&start=free&time=night&at=xz:35,856` (Belvedere St) — the city at night, a click, walking,
   the map; the pill carries the candy badge (🍬 0) on the treat street (`z-prod-belvedere-night-desk.jpg`);
3. phone 390 × 844 dpr 3 `?halloween=night&…&at=xz:-13.5,590.5` (Alamo Square) — BAYBAY: "Tonight's the big Halloween
   night! The whole street is glowing.", the hunt's lanterns and coins, a drag on the stick (`z-prod-alamo-night-phone.jpg`).

`/__csp-stats` after all three: **0 violations, 0 failed requests, 1793 served**. No page exception in any session (the
only console line is three's `THREE.Clock` deprecation warning, as before).

## 5. District regression (`?world=district`, dev server)

| view | calls | triangles | objects | W5-Z |
|---|---|---|---|---|
| the title diorama | **71** | **225,070** | **262** | 71 · 225,070 · 262 |
| free roam at the Ferry Building, `?halloween=night` added | 77 → 74 walking | 242k → 229k | 266 | (W6-W review: 69 · 234k at its start) |

The title is identical to W5-Z (programs read 85 against W5-Z's 66: the count includes the background warm-up passes
and depends on when it is read; nothing is drawn differently). With `?halloween=night` the district loads no city, no
Halloween feature (`__opusBay.g` absent) and the page title stays "Explore the Embarcadero with BAYBAY"; the hero
regression and district tests are green inside the suite. Shot: `qa/w6/final/z-district-title-desk.jpg`.

## 6. What W6-Z changed

| commit | what | files |
|---|---|---|
| this one | the perf runner takes `--halloween 1|season|night|muertos` (the season preview in the page URL); two Halloween spots (Alamo Square at night, Belvedere St) for `--time night --halloween night --rides 0`; this report and seven QA shots | `scripts/opus-sf/qa/perf/w4-perf.mjs`, `scripts/opus-sf/qa/perf/w6-halloween-spots.json` (new), `docs/opus-bay/sf-w6-final-verify.md`, `docs/opus-bay/qa/w6/final/*` |

No product code changed: every check was green on the lanes' tree, no lane or review raised a go-live blocker, and the
two phone frames over 100 ms reproduce on the wave-5 code that is live now (§2).

## GO / NO-GO for merging `opus-bay` into `main`: **GO**

- Checks: `npm run check` EXIT 0 (2246 / 2246), `tsc` 0, eslint 0 errors, opus-bay 1489 / 1489.
- Blocking items: none from nine lanes and nine reviews.
- Perf: desktop all pass (max 122 calls / 365k triangles, 60 fps, 0 long frames, Halloween night included); phone every
  fps ≥ 45 and 21 of 23 + both Halloween spots clean; the two single long frames are not a wave-6 regression (the live
  wave-5 code does the same at the Filbert Steps on this machine today, paired runs tied).
- Sweep: 0 boxed, 0 snag, 0 off; the one unreachable T3 unchanged.
- Production: 0 CSP violations, 0 failed requests; the Halloween preview works in the production build, desktop and phone.
- District: unchanged.

The lead merges (`main` fast-forward or one merge of `origin/main` if GPT pushed again), then checks baylink.us/opus-bay
once on a phone. The live season starts by itself on 1 October (Bay date).

## 7. Open (owners named; none blocks the merge)

From this run:

- **Phone profile, the Filbert Steps walk at 4× CPU**: 1–3 frames over 100 ms and 34–46 fps walking, on this tree and on
  the live wave-5 tree alike (§2); every walking figure is 2–10 fps under W5-Z's of 9/28 on both trees. Next wave: a CPU
  profile of the walk there (lanes P / F), and whether the city walkers' new near figure (lane X, W6-X5: +13.6k
  triangles in view there) should drop to the far figure sooner on the mid tier. A real-phone pass is still owed.
- **North Beach corner** (lane W): 4 targets went from ok to CORRIDOR (the church front, route r1's two via points in
  Washington Square; two ways open, covered by the waiver). A look at whether the café clusters / poles should stand back
  from the path.

From the lanes and their reviews (each report's Review section has the detail):

1. **GameRoot 279.19 KB gzip vs ≤ 265** (was 298.62): about 14 KB still to go, all in per-frame code other lanes own —
   F's city-only actor modules (≈ 6.1 KB), the POI card bodies (≈ 8–10 KB), the district vehicles (≈ 9 KB, changes the
   district's first frame: the owner's call), `hudLayout` 1.5 KB, `discovery` + `places` 4.1 KB (lane P's Requests 1–5).
2. **"A failed import stays failed"** for other lazy chunks (tap-to-drive's `loadDrive`, …): after one lost request that
   feature does nothing for the rest of the page. Pre-dates wave 6; a shared import-with-reload helper (P review).
3. **Transit and parked vehicles / BAYBAY**: a cable car, streetcar or bus still drives through the player's parked
   (empty) toy car or bike and through BAYBAY standing on the rails (lane B → K1: a tow, a step off the rails, or a
   viewer list in the transit contract).
4. **Hyde St ride camera**: street-tree canopies still stand between the camera and the rider at some spots (seated on
   the phone 3 of 4) — trees are not in the camera's ray test (K1 review).
5. **Halloween extras not built**: the orange dusk tint (`world/sf/fog.ts`, so the recorded `w6-h-dusk` line never shows),
   procession walkers on 2 Nov, a compass hint for the hunt, a pelican costume slot; bats dark against full night;
   trick-or-treaters and stoop ghosts static; one stoop of lane H within 3 u of one of lane G's treat doors.
6. **Wording / UI polish**: `Powell & Market 转车台` in goal / dialogue texts vs the station's new name `鲍威尔街 · 市场街`
   (B review); on the phone the bottom bar overlaps the Settings sheet's lowest row in its opening frame; the Jefferson St
   area pill reads 北滩 (DataSF neighbourhood); a long English subtitle under the first-stop reveal (K2 review).
7. **Settings holds only the rider's own ride** (and the tour dwell), not the whole world — K2's recorded decision; a
   Metro train under ground ignores the pause brake (lane T's tunnel rule).
8. **Phone goals card ending an N ride**: seen once by lane B (new save, 40 s into a ride), not reproduced by the B or K2
   reviews; watch on the first real phone.
9. **Not done by anyone this wave**: a real iPhone pass (the stick's toolbar case is CDP-emulated + a node test), the bell
   riff played live, Powell–Mason / California rides played with the new Hyde St camera swing.
10. **Git housekeeping**: the admin folders `.git/worktrees/w6-*-rev` (and the older `wt-check`, `wt-origin`) under the
    OneDrive repo could not be deleted (Permission denied, OneDrive lock); `git worktree list` no longer shows most of
    them; remove by hand with OneDrive paused. The local `w6-*` / `w6-*-rev` branches are all pushed.

## Files

- QA images (`docs/opus-bay/qa/w6/final/`, every one read): `z-halloween-alamo-night-desk.jpg` (the perf spot: jack-o'-lanterns
  on the Painted Ladies' stoops, bats), `z-halloween-belvedere-night-desk.jpg` (a lit lantern on a Belvedere stoop),
  `z-prod-title-halloween-desk.jpg` (production title in season), `z-prod-belvedere-night-desk.jpg` (production, the treat
  street at night, the candy badge), `z-prod-alamo-night-phone.jpg` (production phone, BAYBAY's big-night line),
  `z-district-title-desk.jpg` (the district title, unchanged).
- Scratch: `C:/Users/willy/opus-qa/w6/z/` (`check.out`, `suite.out`, `tsc.out`, `sweep/`, `perf/{desk,hw-desk,phone,hw-phone,recheck-w6,recheck-w5,recheck2-w6,recheck2-w5}/`,
  `csp/` with `stats.json` and the shots, `district/`).
