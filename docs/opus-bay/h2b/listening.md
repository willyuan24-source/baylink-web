# BAYBAY 城市语音 · 试听单（H2b-8）

主人好！这里是 BAYBAY 在城市模式里的 79 段新语音：38 句台词 × 中英文，加 3 句旧语音的重录。机器只能量时长、削波、停顿和音高，
**好不好听、像不像 BAYBAY、听不听得清，要靠你的耳朵**。

**怎么听**

1. 最快：按顺序听两个合集（每句之间停 0.6 秒）：`docs/opus-bay/h2b/voice-preview-zh.m4a` = 下表 1–41，`voice-preview-en.m4a` = 下表 42–79。
2. 单句：`public/opus-bay/voice/sf/<clip>.m4a`（游戏里放的就是这个文件）。
3. 备选：`C:/Users/willy/opus-qa/w3/h2b/voice/listen/<clip>-<编号>.m4a`（同样处理过的其他版本）。

**怎么回复**：在“你的判断”一栏写 ✓（留用）、✗（不要，改回小叫声）或“换 #编号”。三句重录默认静音，你说 ✓ 以后才把它们加进
`data/voiceLinesSf.ts` 的 `SF_VOICE_UNMUTE`，游戏里才会播放。

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

## 中文 · 重录的三句（默认静音，等你批准）

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 21 | `zh-yay` | 好耶好耶！ | 1.11 | 好耶好耶 | `voice/sf/zh-yay.m4a` | #120 #121 #122 #123 #124 #125 #180 #181 #182 |  |
| 22 | `zh-think` | 嗯…让我想想 | 1.83 | 嗯让我想想 | `voice/sf/zh-think.m4a` | #126 #127 #128 #129✗ #130✗ #131✗ #185✗ #186✗ |  |
| 23 | `zh-arrived` | 到啦！ | 0.88 | 到啦 | `voice/sf/zh-arrived.m4a` | #133 #134 #135 #136 #137 #187 #188 #189✗ #190✗ |  |

## 中文 · 反应、坐车和更多街区（G2 后加的 18 句）

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 24 | `zh-bump-hard` | 哎呀！ | 0.51 | 哎呀 | `voice/sf/zh-bump-hard.m4a` | #192 #193 |  |
| 25 | `zh-stairs` | 楼梯上不去！ | 1.61 | 楼梯上不去 | `voice/sf/zh-stairs.m4a` | #197 #198 |  |
| 26 | `zh-pant` | 呼…歇口气！ | 1.94 | - | `voice/sf/zh-pant.m4a` | #204✗ #205 |  |
| 27 | `zh-crest-again` | 再飞一个！ | 0.82 | 再飞一个 | `voice/sf/zh-crest-again.m4a` | #209 #210 |  |
| 28 | `zh-glide-again` | 起飞！ | 0.57 | 起飞 | `voice/sf/zh-glide-again.m4a` | #215 #217 |  |
| 29 | `zh-glide-land` | 安全降落！ | 1.13 | 安全降落 | `voice/sf/zh-glide-land.m4a` | #221 #223 |  |
| 30 | `zh-glide-no-landing` | 这儿降落不了！ | 1.79 | 这儿降落不了 | `voice/sf/zh-glide-no-landing.m4a` | #228 #229 |  |
| 31 | `zh-cable-bell` | 叮叮！叮当车来啦！ | 1.94 | 叮叮叮当车来啦 | `voice/sf/zh-cable-bell.m4a` | #233✗ #234✗ |  |
| 32 | `zh-turntable-push` | 一起推！嘿咻！ | 1.69 | - | `voice/sf/zh-turntable-push.m4a` | #239✗ #240✗ |  |
| 33 | `zh-zone-new` | 新街区！ | 1.34 | 新街区 | `voice/sf/zh-zone-new.m4a` | #246 #247 |  |
| 34 | `zh-zone-hayes-valley` | 你好，海斯谷！ | 1.39 | 你好海斯谷 | `voice/sf/zh-zone-hayes-valley.m4a` | #251 #253 |  |
| 35 | `zh-zone-japantown` | 你好，日本城！ | 1.40 | 你好日本城 | `voice/sf/zh-zone-japantown.m4a` | #257 #258 |  |
| 36 | `zh-zone-russian-hill` | 你好，俄罗斯山！ | 1.76 | 你好俄罗斯山 | `voice/sf/zh-zone-russian-hill.m4a` | #263 #265 |  |
| 37 | `zh-zone-south-of-market` | 你好，南市场！ | 1.54 | 你好南市场 | `voice/sf/zh-zone-south-of-market.m4a` | #269 #271 |  |
| 38 | `zh-zone-potrero-hill` | 你好，波特雷罗山！ | 1.72 | 你好波特雷罗山 | `voice/sf/zh-zone-potrero-hill.m4a` | #275 #276 |  |
| 39 | `zh-zone-lincoln-park` | 你好，林肯公园！ | 1.65 | 你好林肯公园 | `voice/sf/zh-zone-lincoln-park.m4a` | #281 #283 |  |
| 40 | `zh-zone-mission-bay` | 你好，米慎湾！ | 1.78 | 你好米慎湾 | `voice/sf/zh-zone-mission-bay.m4a` | #288 #289 |  |
| 41 | `zh-zone-outer-richmond` | 你好，外列治文！ | 1.64 | 你好外列治文 | `voice/sf/zh-zone-outer-richmond.m4a` | #293 #295 |  |

## English · first rides

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 42 | `en-first-bike` | Bike time! | 0.88 | Bike time | `voice/sf/en-first-bike.m4a` | #3 #4 |  |
| 43 | `en-first-car` | Let's go for a drive! | 1.81 | Let's go for a drive | `voice/sf/en-first-car.m4a` | #9✗ #10✗ #11 #139 #140 |  |
| 44 | `en-first-cable-car` | Cable car! Ding ding! | 1.98 | Cable car Ding ding | `voice/sf/en-first-cable-car.m4a` | #15✗ #16✗ #17✗ #141✗ #143✗ |  |
| 45 | `en-first-streetcar` | All aboard the streetcar! | 2.00 | All aboard the streetcar | `voice/sf/en-first-streetcar.m4a` | #22 #23✗ |  |
| 46 | `en-first-ferry` | All aboard the ferry! | 1.98 | All aboard the ferry | `voice/sf/en-first-ferry.m4a` | #27✗ #28✗ #29✗ #145 #146 |  |
| 47 | `en-first-glide` | Hold on, we're flying! | 1.53 | Hold on we're flying | `voice/sf/en-first-glide.m4a` | #33✗ #34 |  |
| 48 | `en-first-hill` | Phew, what a hill! | 1.75 | - | `voice/sf/en-first-hill.m4a` | #40 #41 #153 #154 #155 |  |
| 49 | `en-first-crest` | Whee, over the top! | 1.64 | Whee over the top | `voice/sf/en-first-crest.m4a` | #46 #47 |  |

## English · first arrivals

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 50 | `en-zone-chinatown` | Hello, Chinatown! | 1.94 | Hello Chinatown | `voice/sf/en-zone-chinatown.m4a` | #51 #53 |  |
| 51 | `en-zone-north-beach` | Hello, North Beach! | 1.57 | Hello North Beach | `voice/sf/en-zone-north-beach.m4a` | #57✗ #58✗ #59 #160 #161 |  |
| 52 | `en-zone-mission` | Hello, the Mission! | 2.00 | - | `voice/sf/en-zone-mission.m4a` | #63✗ #65 #162✗ #163 #164 |  |
| 53 | `en-zone-castro-upper-market` | Hello, the Castro! | 1.96 | Hello the Castro | `voice/sf/en-zone-castro-upper-market.m4a` | #69✗ #70 #71✗ #165✗ #167 |  |
| 54 | `en-zone-haight-ashbury` | Hello, Haight-Ashbury! | 1.94 | Hello Haight-Ashbury | `voice/sf/en-zone-haight-ashbury.m4a` | #76 #77✗ |  |
| 55 | `en-zone-marina` | Hello, the Marina! | 1.96 | Hello the Marina | `voice/sf/en-zone-marina.m4a` | #81✗ #82✗ #83✗ #168 #169 |  |
| 56 | `en-zone-twin-peaks` | Twin Peaks — we made it! | 1.92 | Twin Peaks we made it | `voice/sf/en-zone-twin-peaks.m4a` | #87✗ #88✗ #89✗ #171✗ #173 |  |
| 57 | `en-zone-golden-gate-park` | Hello, Golden Gate Park! | 1.80 | Hello Golden Gate Park | `voice/sf/en-zone-golden-gate-park.m4a` | #93✗ #94✗ #95✗ #175 #176 |  |
| 58 | `en-zone-financial-district-south-beach` | Hello, downtown! | 1.65 | Hello downtown | `voice/sf/en-zone-financial-district-south-beach.m4a` | #100 #101 |  |
| 59 | `en-zone-presidio` | Hello, the Presidio! | 1.51 | Hello the Presidio | `voice/sf/en-zone-presidio.m4a` | #105 #107✗ |  |
| 60 | `en-zone-nob-hill` | Hello, Nob Hill! | 1.79 | Hello Nob Hill | `voice/sf/en-zone-nob-hill.m4a` | #111 #113 |  |
| 61 | `en-zone-sunset-parkside` | Hello, the Sunset! | 1.32 | Hello the Sunset | `voice/sf/en-zone-sunset-parkside.m4a` | #117 #118 #119✗ #177✗ #178 |  |

## English · reactions, rides and more neighbourhoods (G2’s later 18)

| # | clip | 文字 | 秒 | 识别 | 文件 | 备选（编号） | 你的判断 |
|---|---|---|---|---|---|---|---|
| 62 | `en-bump-hard` | Oops! | 0.90 | Oops | `voice/sf/en-bump-hard.m4a` | #195 #196 |  |
| 63 | `en-stairs` | No stairs on wheels! | 1.92 | No stairs on wheels | `voice/sf/en-stairs.m4a` | #200✗ #202 |  |
| 64 | `en-pant` | Phew, catch your breath! | 1.99 | Phew catch your breath | `voice/sf/en-pant.m4a` | #206✗ #208 |  |
| 65 | `en-crest-again` | Wheee, again! | 1.96 | Wheee again | `voice/sf/en-crest-again.m4a` | #213 #214 |  |
| 66 | `en-glide-again` | Up we go! | 0.92 | Up we go | `voice/sf/en-glide-again.m4a` | #219 #220 |  |
| 67 | `en-glide-land` | Safe landing! | 1.18 | Safe landing | `voice/sf/en-glide-land.m4a` | #225 #226 |  |
| 68 | `en-glide-no-landing` | Can't land here! | 1.18 | Can't land here | `voice/sf/en-glide-no-landing.m4a` | #230 #232 |  |
| 69 | `en-cable-bell` | Ding ding! A cable car! | 1.98 | Ding ding A cable car | `voice/sf/en-cable-bell.m4a` | #236✗ #237✗ |  |
| 70 | `en-turntable-push` | Push together! Heave! | 1.97 | Push together Heave | `voice/sf/en-turntable-push.m4a` | #242✗ #243✗ |  |
| 71 | `en-zone-new` | New neighbourhood! | 1.22 | New neighbourhood | `voice/sf/en-zone-new.m4a` | #248 #250 |  |
| 72 | `en-zone-hayes-valley` | Hello, Hayes Valley! | 1.96 | Hello Hayes Valley | `voice/sf/en-zone-hayes-valley.m4a` | #254✗ #255 |  |
| 73 | `en-zone-japantown` | Hello, Japantown! | 1.43 | Hello Japantown | `voice/sf/en-zone-japantown.m4a` | #261 #262 |  |
| 74 | `en-zone-russian-hill` | Hello, Russian Hill! | 1.57 | Hello Russian Hill | `voice/sf/en-zone-russian-hill.m4a` | #267 #268 |  |
| 75 | `en-zone-south-of-market` | Hello, SoMa! | 1.46 | - | `voice/sf/en-zone-south-of-market.m4a` | #272 #274 |  |
| 76 | `en-zone-potrero-hill` | Hello, Potrero Hill! | 1.72 | Hello Potrero Hill | `voice/sf/en-zone-potrero-hill.m4a` | #278 #280 |  |
| 77 | `en-zone-lincoln-park` | Hello, Lincoln Park! | 1.59 | Hello Lincoln Park | `voice/sf/en-zone-lincoln-park.m4a` | #284 #286 |  |
| 78 | `en-zone-mission-bay` | Hello, Mission Bay! | 1.96 | Hello Mission Bay | `voice/sf/en-zone-mission-bay.m4a` | #291 #292 |  |
| 79 | `en-zone-outer-richmond` | Hello, the Outer Richmond! | 1.90 | Hello the Outer Richmond | `voice/sf/en-zone-outer-richmond.m4a` | #296✗ #298✗ |  |

备选编号后面的 ✗ 表示那一版没过检查（多半是超过 2 秒）。每一版的详细数字：`docs/opus-bay/h2b/voice-report.json`。


**重录说明**：`zh-yay` 选的是“好耶好耶！”——单说“好耶！”的 8 个版本，识别器每次都听成“讨厌”（和旧版被误听成的词一样）；说两遍就稳定听成“好耶好耶”。如果你觉得单说“好耶！”也清楚，回复“zh-yay 换 #120”之类即可。`zh-arrived` 选的 #132 被识别成“到啦”，其余几版多被识别成“到了”。`zh-think` 的 #184 是唯一能被识别出“嗯让我想想”的版本。
