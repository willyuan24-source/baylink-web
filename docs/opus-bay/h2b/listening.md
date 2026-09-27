# BAYBAY 城市语音 · 试听单（H2b-8）

主人好！这里是 BAYBAY 在城市模式里的 43 段新语音（20 句 × 中英文 + 3 句重录）。机器只能量时长、削波、停顿和音高，
**好不好听、像不像 BAYBAY、听不听得清，要靠你的耳朵**。

**怎么听**

1. 最快：按顺序听两个合集（每句之间停 0.6 秒）：`docs/opus-bay/h2b/voice-preview-zh.m4a` = 下表 1–20 和 41–43，`voice-preview-en.m4a` = 下表 21–40。
2. 单句：`public/opus-bay/voice/sf/<clip>.m4a`（游戏里放的就是这个文件）。
3. 备选：`C:/Users/willy/opus-qa/w3/h2b/voice/listen/<clip>-<编号>.m4a`（同样处理过的其他版本）。

**怎么回复**：在“你的判断”一栏写 ✓（留用）、✗（不要，改回小叫声）或“换 #编号”。三句重录（最后一节）默认静音，
你说 ✓ 以后才把它们加进 `data/voiceLinesSf.ts` 的 `SF_VOICE_UNMUTE`，游戏里才会播放。

检查项（每句都过了）：时长 ≤ 2.0 秒 · 原始音频无削波 · 结尾没被截断 · 句中停顿 ≤ 0.45 秒（带“…”的 ≤ 0.65） · 音高中位数 180–450 Hz ·
响度 −18 LUFS / 峰值 ≤ −1.5 dBTP。“识别”一栏是 Windows 离线识别器在全部台词里挑中的那一句（只作参考，“-”表示它没认出来）。


## 中文 · 第一次骑车 / 开车 / 坐车 / 滑翔 / 爬坡

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 1 | `zh-first-bike` | 骑车出发！ | 1.13 | 骑车出发 | `voice/sf/zh-first-bike.m4a` | #0 #2 |  |
| 2 | `zh-first-car` | 开车兜风咯！ | 1.97 | 开车兜风咯 | `voice/sf/zh-first-car.m4a` | #6 #8✗ |  |
| 3 | `zh-first-cable-car` | 坐上叮当车啦！ | 1.65 | 坐上叮当车啦 | `voice/sf/zh-first-cable-car.m4a` | #12 #13 |  |
| 4 | `zh-first-streetcar` | 坐老电车咯！ | 1.72 | 坐老电车咯 | `voice/sf/zh-first-streetcar.m4a` | #18 #20 |  |
| 5 | `zh-first-ferry` | 开船啦！ | 1.19 | 开船啦 | `voice/sf/zh-first-ferry.m4a` | #25 #26 |  |
| 6 | `zh-first-glide` | 抓稳，飞咯！ | 1.98 | 抓稳飞咯 | `voice/sf/zh-first-glide.m4a` | #30 #31 #32✗ #147 #149 |  |
| 7 | `zh-first-hill` | 呼…这坡好陡！ | 1.69 | 呼这坡好陡 | `voice/sf/zh-first-hill.m4a` | #36✗ #37✗ #38✗ #150✗ #151 |  |
| 8 | `zh-first-crest` | 哇，飞过坡顶！ | 1.96 | 哇飞过坡顶 | `voice/sf/zh-first-crest.m4a` | #42✗ #43 #44✗ #157 #158 |  |

## 中文 · 第一次到一个街区

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 9 | `zh-zone-chinatown` | 你好，唐人街！ | 1.49 | 你好唐人街 | `voice/sf/zh-zone-chinatown.m4a` | #49 #50 |  |
| 10 | `zh-zone-north-beach` | 你好，北滩！ | 1.31 | 你好北滩 | `voice/sf/zh-zone-north-beach.m4a` | #54 #56 |  |
| 11 | `zh-zone-mission` | 你好，教会区！ | 1.69 | 你好教会区 | `voice/sf/zh-zone-mission.m4a` | #60 #62 |  |
| 12 | `zh-zone-castro-upper-market` | 你好，卡斯特罗！ | 1.95 | 你好卡斯特罗 | `voice/sf/zh-zone-castro-upper-market.m4a` | #66 #67 |  |
| 13 | `zh-zone-haight-ashbury` | 你好，海特街！ | 1.58 | 你好海特街 | `voice/sf/zh-zone-haight-ashbury.m4a` | #73 #74 |  |
| 14 | `zh-zone-marina` | 你好，马里纳区！ | 1.71 | 你好马里纳区 | `voice/sf/zh-zone-marina.m4a` | #78 #80 |  |
| 15 | `zh-zone-twin-peaks` | 登上双峰啦！ | 1.31 | 登上双峰啦 | `voice/sf/zh-zone-twin-peaks.m4a` | #85 #86 |  |
| 16 | `zh-zone-golden-gate-park` | 你好，金门公园！ | 1.58 | 你好金门公园 | `voice/sf/zh-zone-golden-gate-park.m4a` | #91 #92 |  |
| 17 | `zh-zone-financial-district-south-beach` | 你好，金融区！ | 1.54 | 你好金融区 | `voice/sf/zh-zone-financial-district-south-beach.m4a` | #96 #97 |  |
| 18 | `zh-zone-presidio` | 你好，要塞公园！ | 1.96 | 你好要塞公园 | `voice/sf/zh-zone-presidio.m4a` | #102 #104 |  |
| 19 | `zh-zone-nob-hill` | 你好，诺布山！ | 1.38 | 你好诺布山 | `voice/sf/zh-zone-nob-hill.m4a` | #109 #110 |  |
| 20 | `zh-zone-sunset-parkside` | 你好，日落区！ | 1.37 | 你好日落区 | `voice/sf/zh-zone-sunset-parkside.m4a` | #114 #116 |  |

## English · first rides

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 21 | `en-first-bike` | Bike time! | 0.88 | Bike time | `voice/sf/en-first-bike.m4a` | #3 #4 |  |
| 22 | `en-first-car` | Let's go for a drive! | 1.81 | Let's go for a drive | `voice/sf/en-first-car.m4a` | #9✗ #10✗ #11 #139 #140 |  |
| 23 | `en-first-cable-car` | Cable car! Ding ding! | 1.98 | Cable car Ding ding | `voice/sf/en-first-cable-car.m4a` | #15✗ #16✗ #17✗ #141✗ #143✗ |  |
| 24 | `en-first-streetcar` | All aboard the streetcar! | 2.00 | All aboard the streetcar | `voice/sf/en-first-streetcar.m4a` | #22 #23✗ |  |
| 25 | `en-first-ferry` | All aboard the ferry! | 1.98 | All aboard the ferry | `voice/sf/en-first-ferry.m4a` | #27✗ #28✗ #29✗ #145 #146 |  |
| 26 | `en-first-glide` | Hold on, we're flying! | 1.53 | Hold on we're flying | `voice/sf/en-first-glide.m4a` | #33✗ #34 |  |
| 27 | `en-first-hill` | Phew, what a hill! | 1.75 | - | `voice/sf/en-first-hill.m4a` | #40 #41 #153 #154 #155 |  |
| 28 | `en-first-crest` | Whee, over the top! | 1.64 | Whee over the top | `voice/sf/en-first-crest.m4a` | #46 #47 |  |

## English · first arrivals

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 29 | `en-zone-chinatown` | Hello, Chinatown! | 1.94 | Hello Chinatown | `voice/sf/en-zone-chinatown.m4a` | #51 #53 |  |
| 30 | `en-zone-north-beach` | Hello, North Beach! | 1.57 | Hello North Beach | `voice/sf/en-zone-north-beach.m4a` | #57✗ #58✗ #59 #160 #161 |  |
| 31 | `en-zone-mission` | Hello, the Mission! | 2.00 | - | `voice/sf/en-zone-mission.m4a` | #63✗ #65 #162✗ #163 #164 |  |
| 32 | `en-zone-castro-upper-market` | Hello, the Castro! | 1.96 | Hello the Castro | `voice/sf/en-zone-castro-upper-market.m4a` | #69✗ #70 #71✗ #165✗ #167 |  |
| 33 | `en-zone-haight-ashbury` | Hello, Haight-Ashbury! | 1.94 | Hello Haight-Ashbury | `voice/sf/en-zone-haight-ashbury.m4a` | #76 #77✗ |  |
| 34 | `en-zone-marina` | Hello, the Marina! | 1.96 | Hello the Marina | `voice/sf/en-zone-marina.m4a` | #81✗ #82✗ #83✗ #168 #169 |  |
| 35 | `en-zone-twin-peaks` | Twin Peaks — we made it! | 1.92 | Twin Peaks we made it | `voice/sf/en-zone-twin-peaks.m4a` | #87✗ #88✗ #89✗ #171✗ #173 |  |
| 36 | `en-zone-golden-gate-park` | Hello, Golden Gate Park! | 1.80 | Hello Golden Gate Park | `voice/sf/en-zone-golden-gate-park.m4a` | #93✗ #94✗ #95✗ #175 #176 |  |
| 37 | `en-zone-financial-district-south-beach` | Hello, downtown! | 1.65 | Hello downtown | `voice/sf/en-zone-financial-district-south-beach.m4a` | #100 #101 |  |
| 38 | `en-zone-presidio` | Hello, the Presidio! | 1.51 | Hello the Presidio | `voice/sf/en-zone-presidio.m4a` | #105 #107✗ |  |
| 39 | `en-zone-nob-hill` | Hello, Nob Hill! | 1.79 | Hello Nob Hill | `voice/sf/en-zone-nob-hill.m4a` | #111 #113 |  |
| 40 | `en-zone-sunset-parkside` | Hello, the Sunset! | 1.32 | Hello the Sunset | `voice/sf/en-zone-sunset-parkside.m4a` | #117 #118 #119✗ #177✗ #178 |  |

## 重录的三句（默认静音，等你批准）

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 41 | `zh-yay` | 好耶好耶！ | 1.11 | 好耶好耶 | `voice/sf/zh-yay.m4a` | #120 #121 #122 #123 #124 #125 #180 #181 #182 |  |
| 42 | `zh-think` | 嗯…让我想想 | 1.83 | 嗯让我想想 | `voice/sf/zh-think.m4a` | #126 #127 #128 #129✗ #130✗ #131✗ #185✗ #186✗ |  |
| 43 | `zh-arrived` | 到啦！ | 0.88 | 到啦 | `voice/sf/zh-arrived.m4a` | #133 #134 #135 #136 #137 #187 #188 #189✗ #190✗ |  |

备选编号后面的 ✗ 表示那一版没过检查（多半是超过 2 秒）。每一版的详细数字：`docs/opus-bay/h2b/voice-report.json`。


**重录说明**：`zh-yay` 选的是“好耶好耶！”——单说“好耶！”的 8 个版本，识别器每次都听成“讨厌”（和旧版被误听成的词一样）；说两遍就稳定听成“好耶好耶”。如果你觉得单说“好耶！”也清楚，回复“zh-yay 换 #120”之类即可。`zh-arrived` 选的 #132 被识别成“到啦”，其余几版多被识别成“到了”。`zh-think` 的 #184 是唯一能被识别出“嗯让我想想”的版本。
