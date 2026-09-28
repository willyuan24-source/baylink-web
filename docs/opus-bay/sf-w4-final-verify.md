# Wave 4 · final verify (W4-Z), 2026-09-28

## 给主人的摘要

- 第四波接入后在你电脑上单独测了性能门槛（机器空闲时测）：**电脑版 16 个点位和乘车全部通过**（60 帧，最多 125 次绘制、398k 三角形，没有超过 100 毫秒的卡顿帧，着色器数量稳定）。
- **手机模拟（390×844、3 倍像素、中画质、CPU 降速 4 倍）也全部通过**：几乎处处 60 帧，最低是渡轮大厦门口走路 51.8 帧；换成较弱的 AMD 集显（更接近手机显卡）也通过。
- 手机现在会自动选"中"画质；第一次触屏的卡顿已经没有了。
- 默认世界切换成全城的性能门槛已达标；但先等第五波修好"落地卡住""走不动"再切，让第一印象更好。

## Setup

Owner's machine (Ryzen 9 5900HX, RTX 3070 Laptop with `--force_high_performance_gpu`, AMD iGPU for the second phone run),
Chrome 153 headless, dev server on origin `1d2cd76` (wave-4 integration + reviews), `scripts/opus-sf/qa/perf/w4-perf.mjs`
(spots and rides in `w4-spots.json`), run while only read-only design agents were working (light load). Auto quality on
the phone profile (`--mobile --dpr 3`, no `?quality`): the policy picks **mid** (pixel ratio 1.25, canvas 487 × 1055).

## Desktop 1440 × 900, quality high, RTX


profile **desktop** · http://localhost:5174/opus-bay?start=free&world=city&time=golden&quality=high · 2026-09-28T07:15:09.043Z

| spot / ride | calls | triangles | programs | fps idle / walk (ride) | p95 ms | frames > 100 ms | gate |
|---|---|---|---|---|---|---|---|
| ferry-gate | 103 | 398k | 58 | 60.1 / 60.1 | 16.8 | 0 | pass |
| chinatown | 125 | 392k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| twin-peaks | 122 | 379k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| ocean-beach | 46 | 106k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| ggb-south | 52 | 111k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| mission (aimed: the walking camera looked 39° away) | 79 | 328k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| union-square | 87 | 285k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| civic-center | 78 | 263k | 58 | 60.1 / 60.1 | 16.8 | 0 | pass |
| music-concourse | 89 | 251k | 58 | 60.1 / 60.1 | 16.8 | 0 | pass |
| stonestown-sfsu (aimed: the walking camera looked 39° away) | 71 | 204k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| haight-usf (aimed: the walking camera looked 61° away) | 94 | 291k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| grace-nob-hill (aimed: the walking camera looked 122° away) | 111 | 398k | 58 | 60.1 / 60.1 | 16.7 | 0 | pass |
| powell-market (aimed: the walking camera looked 149° away) | 107 | 393k | 58 | 60.1 / 60.1 | 16.8 | 0 | pass |
| bus-palace | 78 | 288k | 58 | (60.1) | 16.7 | 0 | pass |
| n-duboce | 78 | 266k | 58 | (60.1) | 16.8 | 0 | pass |
| m-west-portal | 71 | 243k | 58 | (60.1) | 16.8 | 0 | pass |

programs first → last: 58 → 58


## Phone profile 390 × 844, dpr 3, quality mid, 4× CPU, RTX


profile **phone** · http://localhost:5174/opus-bay?start=free&world=city&time=golden&quality=mid · 2026-09-28T07:28:05.900Z

| spot / ride | calls | triangles | programs | fps idle / walk (ride) | p95 ms | frames > 100 ms | gate |
|---|---|---|---|---|---|---|---|
| ferry-gate | 84 | 315k | 55 | 59.7 / 51.8 | 33.3 | 0 | pass |
| chinatown | 102 | 317k | 55 | 60.1 / 60 | 16.7 | 0 | pass |
| twin-peaks | 93 | 260k | 55 | 60 / 60.1 | 16.7 | 0 | pass |
| ocean-beach | 39 | 100k | 55 | 59.7 / 60.1 | 16.7 | 0 | pass |
| ggb-south | 47 | 105k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| mission (aimed: the walking camera looked 39° away) | 67 | 253k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| union-square | 71 | 227k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| civic-center | 67 | 214k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| music-concourse | 71 | 178k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| stonestown-sfsu (aimed: the walking camera looked 39° away) | 62 | 155k | 55 | 59.8 / 60.1 | 16.7 | 0 | pass |
| haight-usf (aimed: the walking camera looked 61° away) | 75 | 215k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| grace-nob-hill (aimed: the walking camera looked 124° away) | 97 | 363k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| powell-market (aimed: the walking camera looked 149° away) | 89 | 329k | 55 | 58.9 / 60.1 | 16.7 | 0 | pass |
| bus-palace | 74 | 275k | 55 | (59.3) | 16.7 | 0 | pass |
| n-duboce | 68 | 229k | 55 | (59.1) | 16.7 | 0 | pass |
| m-west-portal | 67 | 234k | 55 | (59.6) | 16.7 | 0 | pass |

programs first → last: 55 → 55


## Phone profile on the AMD iGPU (subset)


profile **phone** · http://localhost:5174/opus-bay?start=free&world=city&time=golden&quality=mid · 2026-09-28T07:33:35.573Z

| spot / ride | calls | triangles | programs | fps idle / walk (ride) | p95 ms | frames > 100 ms | gate |
|---|---|---|---|---|---|---|---|
| ferry-gate | 84 | 315k | 55 | 60.1 / 51.4 | 33.3 | 0 | pass |
| chinatown | 101 | 317k | 55 | 60.1 / 59.4 | 16.8 | 0 | pass |
| twin-peaks | 93 | 260k | 55 | 60.1 / 60.1 | 16.7 | 0 | pass |
| powell-market (aimed: the walking camera looked 149° away) | 92 | 333k | 55 | 60 / 60.1 | 16.7 | 0 | pass |

programs first → last: 55 → 55


## Decision

The G2 gate passes (desktop <= 150 calls / <= 400k tris, phone >= 45 fps at 4× CPU, 0 frames > 100 ms, programs stable).
`DEFAULT_WORLD_MODE` stays `'district'` until wave 5's must-fix items (the owner's F1 stuck after landing, F2 blocked
walking; `docs/opus-bay/owner-feedback-2026-09-27.md`) have landed and passed their walker sweep; then the lead flips it.
Open budget notes from the reviews: Union Square's arrival view 406–409k (sf-w4-V.md), the Ferry gate ≈ 1-2k margin.
