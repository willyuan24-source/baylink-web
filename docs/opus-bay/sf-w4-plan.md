# Opus Bay wave 4 · plan: lines across the whole city, big attractions on the map, more places

Written 2026-09-27 from the four wave-4 scouting results (inventory, candidate places, geo + transit, map / guidance UX).
Wave 4 starts **after wave 3 has finished and passed the lead's final verify**, so this plan is written against the
wave-3 ownership (`sf-w2-contracts.md` §1.1 as amended by `sf-w3-lead.md`). The lead commits this file as
`docs/opus-bay/sf-w4-plan.md` and the attraction data as `docs/opus-bay/sf-w4-attractions.json`. Where a wave-3 lane
already fixed something listed here (the map-label bug, M1, F7), the wave-4 task becomes "verify and keep".

**The owner's request** (2026-09-27, relayed): finish wave 3 well and check it three times; then add one or two more
lines so the player can tour the whole of San Francisco; show the big attractions clearly on the map, with guidance
(带领: BAYBAY leading you there); add more attractions and famous places, for example the universities and Stonestown;
keep going until it is done (do not wait for approval: every open question in §7 carries a default).

Inputs (scratch, read-only for the lanes): `C:/Users/willy/opus-qa/w4/` — `inventory-a/` (lm.json, geo.json),
`ne/final.json` + `cand-south-west.json` (candidates, facts, sources), `geo/` (places-merged.json, final-lines.json,
loop-route*.json, budget.json and the scripts that made them), `ux/` (labels-sim.txt, loop-times.txt), the screenshots
`inv-a-*.jpg` / `ux-*.jpg`, and this plan's own tools in `plan/` (loop-final.mts = the measured 16-stop loop,
decide.mjs + placeids.mjs + table.mjs = the attraction list, budget.mjs = the per-view triangle check).

Contents: [1 摘要](#1-给主人的摘要) · [2 Attractions](#2-attractions-to-build) · [3 Lines](#3-the-lines) ·
[4 Map and guidance](#4-map-display-and-guidance) · [5 Lanes](#5-lanes) · [6 Higgsfield](#6-higgsfield-plan) ·
[7 Risks and defaults](#7-risks-and-open-questions-answered-with-a-default)

---

## 1. 给主人的摘要

1. 第四波的目标是"坐车就能游遍旧金山"。新增三条线：**观光巴士环线**（16 站，敞篷双层小巴，每站 BAYBAY 讲解，随上随下，一圈约 14 分钟）、**N 线**（市中心 → 海特区 → UCSF → 金门公园南边 → 海洋海滩）、**M 线**（市中心 → 卡斯特罗 → 西门隧道 → 石镇购物中心 → 旧金山州立大学）。
2. 地铁在市中心走地下：不挖真隧道，改成一段"隧道动画"（黑底、灯光掠过、站名条），到隧道口再看到小电车钻出来（杜博斯、日落隧道两头、西门）。
3. 新增"环游旧金山一日游"：5 章、约 25 分钟（快速版约 18 分钟），巴士 + N 线 + M 线 + 步行 + 叮当车串起来；走完能顺手完成双峰、叮当车、彩绘女士、金门大桥等城市任务，大部分明信片也在路上。
4. 景点去重后一共 134 个，其中 **124 个是新的**。先做你点名的：旧金山州立大学、石镇购物中心、UCSF 帕纳萨斯、旧金山大学（圣依纳爵堂）、城市学院、UCSF 米慎湾；然后是加州科学院、日本茶园、联合广场、SFMOMA、动物园、海特街、多洛雷斯公园、天涯海角、海洋海滩等。
5. 其中 51 个一定做成小模型或小广场（4 个用 AI 模型），另有 26 个小景点有时间再做；124 个全部都有介绍卡（有出处、开放时间写得保守、关门的会写明）。每做好一个地标，周围 150–300 米的街道（广场、路面、斑马线、长椅路灯树）一起做好。
6. 地图：修好"地图上从来不显示地名"的 bug；16 个"必看"景点用更大的彩色图标和名字一直显示，其他按类别上色（博物馆、公园、观景、校园、购物……），太挤时自动合并成"+2"；画出三条线和车站；可以按"校园""购物""交通"筛选；搜"大学""石镇""N 线"都能找到。
7. 带领：选中景点后主按钮是"**跟 BAYBAY 去**"，还会列出步行、骑车、坐车、飞过去各要多久（按游戏里真实要花的时间）；BAYBAY 会领着你走、坐在车筐里陪你骑、陪你坐巴士和地铁，到站提醒你下车。
8. 远处的大景点头上有小旗子（手机最多 3 面）；在双峰等观景点，BAYBAY 会把看得见的地标一个个指给你看；到达景点有"抵达时刻"（大字提示、BAYBAY 一句话、拍照入口、盖章）。
9. 分 6 条线同时做（地图、交通线、地标、带领、内容与游览、画面性能与素材），每条都有测试、手机 390×844 检查和截图；街区模式完全不变。
10. Higgsfield 预计用约 **79 分**（上限 120，余额约 170，至少留 50 给最后打磨）：4 个 AI 地标模型、巴士和电车参考图、地图"必看"贴纸、新语音、4 张新明信片（可选）。
11. 所有没定的事都先按第 7 节的默认做法推进，不等批复。例如：码头英雄区里面的新模型先不做，只做介绍卡；市中心三角形预算不够时，新地标先"瘦身"或只做卡片。

---

## 2. Attractions to build

### 2.1 What the list is, after deduplication

| step | count |
|---|---|
| candidate entries from the two scouting lists (north-east 66 + south-west 70) | 136 |
| unique (`walt-disney-family-museum` and `presidio-tunnel-tops` were listed twice) | **134** |
| already-built landmarks among them: they become loop / tour stops and get card refreshes (de Young, Conservatory, Dutch Windmill, Sutro Baths, Cliff House, Legion of Honor, Twin Peaks, Sutro Tower, Castro Theatre, Mission Dolores) | 10 |
| **new attractions in wave 4** | **124** |
| by treatment: AI model / procedural / plaza + card / card only / card now, model later | 3 / 36 / 38 / 43 / 4 |
| by priority: P1 owner requests / P2 tier 1 / P3 tier 2 on a line / P4 tier 3 and cards (all 134) | 11 / 22 / 41 / 60 |
| place rows: map onto an existing **curated** place / promote an existing **OSM** row / **new** row in `extraPlaces.ts` | 35 / 52 / 47 |

Plus one AI part inside a plaza site (the Chinese Pavilion on Blue Heron Lake), so **4 AI meshes** in all (Cal Academy,
St Ignatius inside the USF site, Holy Virgin Cathedral, the pavilion), and two conditional AI models (the Tea Garden
pagoda set and Old St Mary's, only if the procedural versions read weak at the SoloView gate). The full data (facts, every source, cautions, lat/lng, arrival
spots, nearest stops, place-row match) is in `sf-w4-attractions.json`; the tables below are generated from it.

### 2.2 Rules every site follows

- **Treatments.** *AI model*: Higgsfield concept (nano_banana_pro 2k) → SAM 3 3D (the wave-2 bake-off winner) → the
  Blender cleanup and QA gate of `sf-research-tech.md` §8; the procedural version is built first as the fallback and
  the AI swap goes through the D2-06 SoloView decision gate. *Procedural*: a TOY model from the kit (`landmarks/kit.ts`)
  with lod 0 + a far silhouette. *Plaza + card*: GROUND polys, a few props and the card, no building. *Card only*: a
  place row, a map badge and a card. *Card now, model later*: the site is inside the frozen hero slab (§7 R1).
- **The owner's street rule** (`sf-research-synthesis.md` §4.2): a site is done only when the **150–300 m (21–42 u)
  around it** are right: plaza GROUND, street strips where the exclusion clips a street, crosswalks at the plaza
  corners, furniture (benches, lamps, bollards, bins, planters, trees), tidy kerbs, the arrival anchor reachable on
  the walk graph, and a walk-around ring ≥ 75 % (the `sf-landmark-context` test). One site is finished before the next
  one starts, in the priority order of §2.3.
- **Budgets.** lod 0 ≤ 6k tris (T1), ≤ 2.5k (T2; AI meshes ≤ 6k), ≤ 0.8k (T3); lod-0 rings 520 / 340 / 220 u, with a
  per-site `lod0R` override (new, lane L). **Downtown diet** (inside 400 u of the Ferry gate or Chinatown perf spots,
  where wave 3 left little headroom): SFMOMA ≤ 1.2k, Cable Car Museum ≤ 1.0k, Union Square ≤ 0.6k, Yerba Buena ≤ 0.4k,
  all with `lod0R` 200 u, and the Chinatown pagoda cluster only if lane V measures ≥ 10k headroom there (§2.6).
- **Hero slab.** The hand-made waterfront (`DISTRICT`) is frozen: nothing new is modelled inside it in wave 4 (Sentinel
  Building, Saints Peter and Paul, SS Jeremiah O'Brien, the Salesforce Park deck, Jack Kerouac Alley). They get cards
  and map badges; hero-side props (kiosks, bus poles) mount in city mode only, like the Taylor & Bay turntable.
- **Facts.** Every card carries `sourceUrl` + `verifiedAt` (the scouting checked all of them on 2026-09-27) and its
  secondary sources; hours and prices say "出发前查官网确认"; closures are stated (Portsmouth Square to 2028, Hyde
  Street Pier since Nov 2024, the Cliff House, the CCSF Rivera mural until ~2028, MoAD reopening 30 Sep 2026); memorials
  and churches get a quiet tone and no gameplay objects.
- **Brands and art.** Names in card text only; no logos, store names or sign text anywhere in the world (Stonestown,
  Salesforce, Disney, Lucasfilm, Boudin, the stadium teams). No copies of artworks (murals, the Tiled Steps mosaic,
  Cupid's Span, the MLK memorial quotation, the Beach Chalet frescoes): abstract colour only. **Never** a Yoda statue or
  giant pandas.
- **Glossary** (G2's VOICE.md gains these): 石镇购物中心 (Stonestown Galleria; aliases 石头城, Stonestown),
  旧金山州立大学 (short 州立大学), 旧金山大学 (USF), 加州大学旧金山分校 · 帕纳萨斯 / 米慎湾 (UCSF), 旧金山城市学院,
  蓝鹭湖（原斯托湖）(Blue Heron Lake, renamed 18 Jan 2024), 迪扬博物馆, 双峰, 叮当车, 观光巴士, N 线 / M 线,
  内河码头站 (Embarcadero). Map names equal card names (§4.1 name fixes).

### 2.3 Build order (lane L; cards in the same order by lane C)

1. **P1, owner requests:** `stonestown` → `sfsu` → `ucsf-parnassus` → `usf-lone-mountain` (procedural church first,
   the AI St Ignatius swap when lane V delivers) → `ccsf-ocean` → `ucsf-mission-bay`; the four university cards
   (UC Law SF, SF Conservatory of Music, Academy of Art, CCA) ship with them so "大学" finds ≥ 8 places.
2. **P2, tier 1:** `music-concourse` (Cal Academy procedural → AI swap; Japanese Tea Garden pagoda, drum bridge and
   gate; Botanical Garden gate) → `union-square` → `yerba-buena` (SFMOMA diet + gardens) → `haight` →
   `mission-dolores` (+ Dolores Park terraces) → `lands-end` (Lookout plaza) → `ocean-beach-west` (fire rings, Beach
   Chalet, Murphy Windmill, the N terminus spot) → `sf-zoo`; the hero cards (Transamerica, Salesforce Tower, Ferry
   Building Marketplace) and the refreshes of the 10 existing landmarks.
3. **P3, tier 2 on the lines:** `park-west` (bison) → `blue-heron-lake` (+ AI pavilion) → `park-east` (Kezar, Koret
   carousel, Hippie Hill) → `geary-west` (Holy Virgin, AI) → `clement` + `irving` strips → `golden-gate-heights` (Tiled
   Steps + Grand View) → `mount-davidson` → `stern-grove` → `lake-merced` → `fort-funston` → `castro` (Harvey Milk Plaza)
   → `presidio` (Tunnel Tops) → `fort-mason` → `baker-beach` → `corona-heights` → `bernal` → `cathedral-hill` (St Mary's
   hypar) → `civic-center` extension (War Memorial + Asian Art) → `cable-car-museum` → `wharf-west` (Bathhouse +
   Pampanito) → `japantown` extension → `chinatown-pagodas` (gated).
4. **P4 (stretch):** the tier-3 procedural and plaza sites in table order; their cards ship regardless.

### 2.4 The list

`map` = the map rank of §4.1 (T1 always shown and labelled). `place row` = the existing places.json id the attraction
uses (it gains rank, card and name fixes) or **new** (a row in `data/sf/extraPlaces.ts`). `nearest stops` = loop /
N / M stops within 200 u (the King St part of the N is not in wave 4). x, z in the city frame (`projectCity`).

#### Priority 1 · owner requests (universities, Stonestown)

| # | id | 名称 / name | map | treatment | site | x, z | place row | nearest stops | fact | source | build note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `st-ignatius-church` | 圣依纳爵堂 / St Ignatius Church | T2 | AI model | usf-lone-mountain | -150.9, 752.8 | **new** | loop haight-ashbury 111 u; N Carl Street & Cole Street 154 u | A twin-spired Jesuit church (1914) on the USF campus, visible across the west side. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Saint_Ignatius_Church_(San_Francisco)) +1 | twin spires + dome, a west-side skyline cue; replaces OSM 225193440 |
| 2 | `sf-state-university` | 旧金山州立大学 / San Francisco State University | T1 | procedural | sfsu | 198.2, 1555.6 | **new** | M 19th Avenue & Holloway Avenue 62 u | A CSU campus of about 21,000 students by Lake Merced, founded in 1899 and here since 1953. | [sfsu.edu](https://www.sfsu.edu/about) +1 | quad lawn, angular student-centre roof (Cesar Chavez), library block, Holloway gate; M 19th Ave & Holloway platform; no marks or mascot |
| 3 | `stonestown-galleria` | 石镇购物中心 / Stonestown Galleria | T1 | procedural | stonestown | 165.9, 1479.9 | **new** | M 19th Avenue & Winston Drive 30 u | One of America's early shopping centres (opened 16 July 1952 as Stonestown Shopping Center) and now the west side's busiest mall, with a Sunday farmers market. | [stonestowngalleria.com](https://www.stonestowngalleria.com/en/visit/) +3 | low 2-storey mall wings, glass entrance canopy, parking fields, 20th Ave plaza; replaces OSM 1154799336; M 19th Ave & Winston platform; no store names |
| 4 | `ccsf-ocean-campus` | 旧金山城市学院（Ocean 校区） / City College of San Francisco · Ocean Campus | T2 | procedural | ccsf-ocean | 421.9, 1268.3 | **new** | M San Jose Avenue & Geneva Avenue 95 u | San Francisco's only community college (1935), free for city residents and attended each year by about 1 in 35 San Franciscans. | [ccsf.libanswers.com](https://ccsf.libanswers.com/patrons/faq/432269) +3 | hilltop campus blocks + a crane over the Diego Rivera centre site (mural NOT on show until ~2028); 95 u from M Balboa Park |
| 5 | `ucsf-parnassus` | 加州大学旧金山分校 · 帕纳萨斯校区 / UCSF Parnassus Heights | T2 | procedural | ucsf-parnassus | -56.8, 939.6 | **new** | loop golden-gate-park 172 u; N Irving Street & 2nd Avenue 26 u | UCSF's flagship health-science campus, here since 1898 on land donated by Mayor Adolph Sutro. | [realestate.ucsf.edu](https://realestate.ucsf.edu/projects/ucsf-health-helen-diller-hospital-hdh) +2 | stepped hospital / research slabs against the Mt Sutro forest + one construction crane (Helen Diller Hospital, due 2030); replaces OSM 288632172; N Irving & 2nd |
| 6 | `university-of-san-francisco` | 旧金山大学 / University of San Francisco (USF) | T2 | procedural | usf-lone-mountain | -188.5, 706.2 | **new** | loop haight-ashbury 159 u | The city's Jesuit university, founded in 1855, on Lone Mountain and Fulton Street next to St Ignatius Church. | [usfca.edu](https://www.usfca.edu/about) +1 | hillside campus blocks on Lone Mountain + Fulton St frontage; one site with St Ignatius |
| 7 | `ucsf-mission-bay` | 加州大学旧金山分校 · 米慎湾校区 / UCSF Mission Bay campus | T2 | plaza + card | ucsf-mission-bay | 441, 292.5 | **new** | — | UCSF's 57.9-acre research and hospital campus, built on an old rail yard from 1999; its children's, women's and cancer hospitals opened in 2015, right next to Chase Center. | [ucsf.edu](https://www.ucsf.edu/about/locations/mission-bay) +2 | campus quad + generic lab blocks (T3); card anchor at the Community Center (441.7, 308.5) |
| 8 | `academy-of-art-university` | 旧金山艺术大学 / Academy of Art University | T3 | card only | — | 154.1, 162 | **new** | loop chinatown 65 u; M Montgomery Street 22 u; N Montgomery Street 22 u | Founded in 1929, it calls itself the largest privately owned art and design school in the US (about 5,500 students in 2024); its headquarters is 79 New Montgomery and its buildings are… | [academyart.edu](https://www.academyart.edu/) +1 | neutral wording; no single campus |
| 9 | `california-college-of-the-arts` | 加州艺术学院 / California College of the Arts (San Francisco campus) | T3 | card only | — | 394.5, 355.2 | **new** | — | The 119-year-old art and design school's campus near Potrero Hill; CCA ends operations after the 2026-27 academic year and Vanderbilt University takes over the campus. | [cca.edu](https://www.cca.edu/about/vanderbilt-agreement/) +1 | closing after 2026-27; Vanderbilt later |
| 10 | `sf-conservatory-of-music` | 旧金山音乐学院 / San Francisco Conservatory of Music (and Bowes Center) | T3 | card only | — | 124, 468.7 | **new** | loop civic-center 77 u; M Van Ness 13 u; N Van Ness 13 u | The conservatory's 50 Oak St home is joined by the 12-storey Bowes Center at 200 Van Ness (opened November 2023, $200M), with housing for 400 students and public concert spaces. | [sfcm.edu](https://sfcm.edu/discover/campus-life/bowes-center) +2 | card at 50 Oak St |
| 11 | `uc-law-sf` | 加州大学旧金山法学院 / UC Law San Francisco (University of California College of the Law, San Francisco) | T3 | card only | — | 102.7, 368.3 | **new** | loop civic-center 36 u; M Civic Center 35 u; N Civic Center 35 u | Founded in 1878 as the University of California's first law school; renamed from 'UC Hastings' to UC Law San Francisco on 1 January 2023. | [uclawsf.edu](https://www.uclawsf.edu/2023/01/03/welcome-to-university-of-california-college-of-the-law-san-francisco/) +2 | never "Hastings" (renamed 2023) |

#### Priority 2 · tier-1 attractions and the existing landmarks that become stops

| # | id | 名称 / name | map | treatment | site | x, z | place row | nearest stops | fact | source | build note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | `cal-academy` | 加州科学院 / California Academy of Sciences | T2 | AI model | music-concourse | -203.7, 934.5 | `cal-academy` | loop golden-gate-park 29 u; N Irving Street & 6th Avenue 95 u | An aquarium, a planetarium, a four-storey rainforest dome and a natural history museum share one building under a 2.5-acre living roof of native plants. | [calacademy.org](https://www.calacademy.org/visit) +2 | living roof with two domes + glass canopy; replaces OSM 28695389 (landmark-flagged); no sponsor names |
| 13 | `japanese-tea-garden` | 日本茶园 / Japanese Tea Garden | T2 | procedural | music-concourse | -242.9, 964.4 | `japanese-tea-garden` | loop golden-gate-park 47 u; N 9th Avenue & Irving Street 117 u | The oldest public Japanese garden in the US. | [gggp.org](https://gggp.org/visit) +3 | five-tier pagoda (Peace Pagoda roof kit) + drum bridge + gate; AI pagoda set only if procedural reads weak |
| 14 | `sf-zoo` | 旧金山动物园 / San Francisco Zoo & Gardens | T2 | procedural | sf-zoo | -110.3, 1657.6 | `sf-zoo` | — | A 100-acre zoo by the ocean with more than 1,000 animals (gorillas, penguins, an African savanna) and a 1921 Dentzel carousel. | [sfzoo.org](https://www.sfzoo.org/) +2 | entrance plaza + low enclosures + instanced toy animals seen from the path; NEVER pandas |
| 15 | `sfmoma` | 旧金山现代艺术博物馆 / SFMOMA (San Francisco Museum of Modern Art) | T2 | procedural | yerba-buena | 176.6, 183 | `sfmoma` | loop chinatown 88 u; M Montgomery Street 46 u; N Montgomery Street 46 u | One of the largest modern-art museums in the US: Mario Botta's striped-oculus building (1995) plus Snohetta's rippled white 2016 wing; free for visitors 18 and under. | [sfmoma.org](https://www.sfmoma.org/visit/) +1 | stepped brick block + striped cylindrical oculus + wavy white slab behind; replaces OSM 41692824 |
| 16 | `union-square` | 联合广场 / Union Square | T1 | plaza + card | union-square | 96.1, 221.3 | `union-square` | loop chinatown 55 u; M Powell Street 60 u; N Powell Street 60 u | The city's main shopping and theatre-district plaza; the 1903 Dewey Monument column topped by a Victory statue stands in the middle, the Powell St cable cars pass one block west, and a… | [en.wikipedia.org](https://en.wikipedia.org/wiki/Union_Square,_San_Francisco) +2 | open plaza, Dewey column with Victory, palms, generic store blocks, no signage; one of the 16 map T1 |
| 17 | `dolores-park` | 多洛雷斯公园 / Mission Dolores Park | T2 | plaza + card | mission-dolores | 242, 698 | `dolores-park` | loop mission-dolores 75 u; M Castro 110 u; N Duboce Avenue & Church Street 152 u | The Mission's sunny 16-acre lawn with a postcard downtown view from its south-west slope. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Mission_Dolores_Park) +1 | lawn terraces with the downtown view; extends the Mission Dolores site |
| 18 | `haight-ashbury` | 海特-阿什伯里（嬉皮区） / Haight-Ashbury | T2 | plaza + card | haight | -41.3, 763.5 | `haight-ashbury` | loop haight-ashbury 1 u; M Castro 183 u; N Carl Street & Cole Street 73 u | The corner that gave its name to the 1967 Summer of Love. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Haight-Ashbury) +1 | corner plaza, painted Victorians (kit), street-sign pole; loop stop 1 u |
| 19 | `lands-end` | 天涯海角（Lands End） / Lands End (Lookout & Coastal Trail) | T2 | plaza + card | lands-end | -703.2, 1231.2 | `lands-end` | loop lands-end-sutro 5 u | A cliff-top trail with Golden Gate Bridge views, shipwreck remains at low tide and the USS San Francisco memorial. | [nps.gov](https://www.nps.gov/goga/planyourvisit/landsend.htm) +1 | Lookout visitor centre plaza + cliff trail head; replaces OSM 250216260; labyrinth never promised |
| 20 | `ocean-beach` | 海洋海滩 / Ocean Beach | T2 | plaza + card | ocean-beach-west | -431, 1475 | `ocean-beach` | N Judah Street & La Playa Street 66 u | 3.5 miles of surf along the city's whole western edge, with bonfire rings and big sunsets. | [nps.gov](https://www.nps.gov/places/000/ocean-beach.htm) +2 | fire rings, N Judah terminus marker, no swimming prompts |
| 21 | `yerba-buena-gardens` | 芳草地花园 / Yerba Buena Gardens (MLK Memorial, YBCA, carousel) | T2 | plaza + card | yerba-buena | 176.9, 210.8 | `yerba-buena-gardens` | loop chinatown 98 u; M Montgomery Street 62 u; N Montgomery Street 62 u | A two-block green in SoMa ringed by museums: the Martin Luther King Jr. Memorial waterfall (restored 2026), an ice rink and bowling centre, a carousel, YBCA's galleries and new Chinese… | [yerbabuenagardens.org](https://yerbabuenagardens.org/) +2 | lawn, esplanade, waterfall wall (no quotation text), LeRoy King carousel prop at (193.4, 222.9) |
| 22 | `sutro-baths` | 苏特罗浴场遗址 / Sutro Baths ruins | T1 | existing → stop | lands-end | -726.2, 1246.5 | `sutro-baths` | loop lands-end-sutro 32 u | Concrete ruins of Adolph Sutro's huge public saltwater bathhouse from the late 1800s, on the shore below Lands End; free to walk. | [nps.gov](https://www.nps.gov/places/000/sutro-baths.htm) +1 | existing; map T1; the loop stop is named for it (the Cliff House is closed) |
| 23 | `twin-peaks` | 双峰观景台 / Twin Peaks overlook | T1 | existing → stop | twin-peaks | 125.7, 937.8 | `twin-peaks` | loop twin-peaks 27 u; M Forest Hill 178 u; N Carl Street & Cole Street 179 u | About 925 ft high, with the whole-city view from the Christmas Tree Point overlook. | [sfrecpark.org](https://www.sfrecpark.org/634/Twin-Peaks-Trails-Improvement-Promenade-) +2 | existing; loop stop + panorama; card gets the 2026-27 Promenade construction note |
| 24 | `castro-theatre` | 卡斯特罗剧院 / The Castro Theatre | T2 | existing → stop | castro | 151.9, 741.4 | `castro-theatre` | loop castro 10 u; M Castro 12 u; N Sunset Tunnel East Portal 114 u | Timothy Pflueger's 1922 movie palace with its 1937 vertical sign. | [localnewsmatters.org](https://localnewsmatters.org/2026/02/05/sf-castro-theatre-reopening-friday-after-rehabilitation/) +1 | existing; reopened 6 Feb 2026 |
| 25 | `conservatory-of-flowers` | 花卉温室 / Conservatory of Flowers | T2 | existing → stop | park-east | -184.2, 852.9 | `conservatory-of-flowers` | loop golden-gate-park 80 u; N Carl Street & Hillway Avenue 127 u | The oldest public wood-and-glass conservatory in North America, full of tropical and rare plants. | [gggp.org](https://gggp.org/visit) +1 | existing AI model; closed Wednesdays |
| 26 | `de-young-tower` | 迪扬博物馆 · 观景塔 / de Young Museum · Hamon Observation Tower | T2 | existing → stop | music-concourse | -244.4, 940.2 | `de-young` | loop golden-gate-park 26 u; N 9th Avenue & Irving Street 129 u | The Fine Arts Museums' copper-clad building in Golden Gate Park. | [famsf.org](https://www.famsf.org/) +2 | existing; loop stop; name 迪扬博物馆 everywhere |
| 27 | `dutch-windmill` | 荷兰风车与威廉明娜女王郁金香花园 / Dutch Windmill & Queen Wilhelmina Tulip Garden | T2 | existing → stop | ocean-beach-west | -580.7, 1311.9 | `dutch-windmill` | loop ocean-beach-windmill 20 u; N Judah Street & La Playa Street 156 u | The windmill was built to pump water for the park. | [sfrecpark.org](https://sfrecpark.org/908/Golden-Gate-Park---Queen-Wilhelmina-Gard) +1 | existing; loop stop "Ocean Beach · Windmill" |
| 28 | `legion-of-honor` | 荣勋宫美术馆 / Legion of Honor | T2 | existing → stop | legion | -663.6, 1083.4 | `legion-of-honor` | loop legion-of-honor 15 u | The Fine Arts Museums' Beaux-Arts palace in Lincoln Park above the Golden Gate. | [famsf.org](https://www.famsf.org/visit/legion-tickets-hours) +1 | existing; loop stop |
| 29 | `mission-dolores` | 多洛雷斯传教站 / Mission Dolores (Mission San Francisco de Asís) | T2 | existing → stop | mission-dolores | 195.5, 647.6 | `mission-dolores` | loop mission-dolores 7 u; M Church 55 u; N Duboce Avenue & Church Street 86 u | Founded on 29 June 1776, it is the oldest intact building in San Francisco, with a small museum, a historic cemetery and the 1918 basilica next door. | [missiondolores.org](https://www.missiondolores.org/) +1 | existing; loop stop |
| 30 | `sutro-tower` | 苏特罗塔 / Sutro Tower | T2 | existing → stop | twin-peaks | 73.2, 973.7 | `sutro-tower` | loop twin-peaks 74 u; M Forest Hill 142 u; N Carl Street & Hillway Avenue 158 u | The 977-ft three-legged broadcast tower that punctuates the skyline and the fog. | [sutrotower.org](https://sutrotower.org/) +1 | existing; no public access |
| 31 | `ferry-building-marketplace` | 渡轮大厦市集 / Ferry Building Marketplace & Ferry Plaza Farmers Market | T1 | card only | hero | 131.5, 15.1 | `ferry-building` | loop ferry-building 3 u; M Embarcadero 64 u; N Embarcadero 64 u | The 1898 Ferry Building's nave holds nearly 50 local food merchants, and the Ferry Plaza Farmers Market (run by Foodwise) sets up outside Tue and Thu 10-2 and Sat 8-2. | [ferrybuildingmarketplace.com](https://www.ferrybuildingmarketplace.com/) +2 | refresh the district ferry-building / farmers-market cards (Foodwise, Tue/Thu/Sat) |
| 32 | `salesforce-tower` | Salesforce 大楼 / Salesforce Tower | T2 | card only | hero | 166.2, 107.8 | `salesforce-tower` | loop chinatown 97 u; M Embarcadero 45 u; N Embarcadero 45 u | At 1,070 ft (326 m) and 61 floors (2018, Pelli Clarke Pelli) it is San Francisco's tallest building; Jim Campbell's 'Day for Night' LED crown (11,000 LEDs) glows at night and is visible… | [en.wikipedia.org](https://en.wikipedia.org/wiki/Salesforce_Tower) | hero model already; card + a generic warm crown glow in the night light field |
| 33 | `transamerica-pyramid` | 泛美金字塔 / Transamerica Pyramid | T2 | card only | hero | 55.8, 101.5 | `transamerica-pyramid` | loop chinatown 74 u; M Embarcadero 79 u; N Embarcadero 79 u | William Pereira's 853 ft (260 m), 48-floor pyramid of 1972 is the skyline's signature shape; the 2024 Foster + Partners restoration reopened its ground floor and the half-acre Redwood… | [en.wikipedia.org](https://en.wikipedia.org/wiki/Transamerica_Pyramid) +2 | hero model already; card + map label + arrival at Redwood Park |

#### Priority 3 · tier-2 anchors on the loop and the Metro lines

| # | id | 名称 / name | map | treatment | site | x, z | place row | nearest stops | fact | source | build note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 34 | `holy-virgin-cathedral` | 圣母大教堂（俄罗斯东正教） / Holy Virgin Cathedral (Joy of All Who Sorrow) | T3 | AI model | geary-west | -493.6, 999.4 | **new** | loop legion-of-honor 179 u | Gold onion domes over Geary Boulevard. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Holy_Virgin_Cathedral) +1 | gold onion domes on Geary (the loop passes); active church, respectful card |
| 35 | `cable-car-museum` | 叮当车博物馆 / Cable Car Museum (Washington-Mason powerhouse) | T2 | procedural | cable-car-museum | -16.9, 186.4 | `cable-car-museum` | loop chinatown 108 u; M Montgomery Street 151 u; N Montgomery Street 151 u | The working powerhouse and carbarn: from the gallery you watch the giant winding wheels that pull the cables for all three cable-car lines, alongside historic cars; admission is free. | [cablecarmuseum.org](https://www.cablecarmuseum.org/) +1 | brick barn + chimney + turning winding wheels; replaces OSM 30029681; Powell-Hyde passes the door |
| 36 | `mount-davidson` | 戴维森山 / Mount Davidson | T2 | procedural | mount-davidson | 257.5, 1160.9 | `mount-davidson` | M West Portal 159 u | At 928 ft, the highest natural point in San Francisco. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Mount_Davidson_(California)) +1 | forested cone + a plain concrete cross silhouette; memorial, respectful |
| 37 | `asian-art-museum` | 亚洲艺术博物馆 / Asian Art Museum | T3 | procedural | civic-center | 108.5, 378.3 | `osm-w24588037` | loop civic-center 31 u; M Civic Center 27 u; N Civic Center 27 u | One of the largest collections of Asian art in the West, in the former 1917 Main Library facing City Hall across Civic Center Plaza; free on the first Sunday of each month. | [asianart.org](https://asianart.org/) +1 | granite Beaux-Arts block closing Civic Center Plaza; merged into the City Hall site budget |
| 38 | `beach-chalet` | 海滩小屋（金门公园游客中心） / Beach Chalet (Golden Gate Park Visitor Center) | T3 | procedural | ocean-beach-west | -576.9, 1329.5 | **new** | loop ocean-beach-windmill 9 u; N Judah Street & La Playa Street 142 u | A 1925 Willis Polk building at the park's ocean end. | [beachchalet.com](https://www.beachchalet.com/visitors-center) +2 | white Spanish Revival block, red roof, blank signs; frescoes never reproduced |
| 39 | `bison-paddock` | 金门公园野牛围场 / Golden Gate Park Bison Paddock | T3 | procedural | park-west | -476, 1219.8 | **new** | loop ocean-beach-windmill 156 u; N Judah Street & 40th Avenue 140 u | Bison have lived in the park since 1892 and in this meadow since 1899. | [sfzoo.org](https://www.sfzoo.org/historic-sites-golden-gate-park-bison/) +2 | fenced meadow + ~10 instanced low-poly bison on an idle loop (JFK Dr) |
| 40 | `kezar-stadium` | 基泽体育场 / Kezar Stadium | T3 | procedural | park-east | -84.4, 877.1 | `osm-w30675203` | loop haight-ashbury 121 u; N Carl Street & Hillway Avenue 30 u | Opened in 1925, the 49ers' original home from 1946 to 1970 and the Raiders' first home in 1960. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Kezar_Stadium) +1 | oval stand around a track, no team marks |
| 41 | `koret-carousel` | 科雷特儿童乐园与旋转木马 / Koret Children's Quarter & Golden Gate Park Carousel | T3 | procedural | park-east | -109.9, 873.4 | **new** | loop golden-gate-park 127 u; N Carl Street & Hillway Avenue 51 u | One of the first public playgrounds in the US (1888). | [sfrecpark.org](https://sfrecpark.org/Facilities/Facility/Details/Koret-Childrens-Quarter-and-Carousel-414/) +1 | small spinning carousel (TOY_DYN) + playground mound |
| 42 | `maritime-museum-bathhouse` | 旧金山海事博物馆（水上公园浴场大楼） / San Francisco Maritime Museum (Aquatic Park Bathhouse) | T3 | procedural | wharf-west | -249.6, 167.8 | **new** | loop wharf-hyde 41 u | The 1939 Streamline Moderne bathhouse, shaped like an ocean liner on the Aquatic Park beach, is the national park's free Maritime Museum (Wed-Sun 10-4). | [nps.gov](https://www.nps.gov/safr/learn/historyculture/aquatic-park-bathhouse.htm) +2 | white streamline "ocean liner" block; merged into the Ghirardelli site |
| 43 | `murphy-windmill` | 墨菲风车 / Murphy Windmill | T3 | procedural | ocean-beach-west | -514.1, 1364.2 | `murphy-windmill` | loop ocean-beach-windmill 79 u; N Judah Street & La Playa Street 72 u | Built in 1908 to pump up to 40,000 gallons of groundwater an hour for the park. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Murphy_Windmill) +1 | Dutch windmill recipe, other cap + sail colour |
| 44 | `old-st-marys-cathedral` | 老圣玛利亚教堂 / Old St. Mary's Cathedral | T3 | procedural | chinatown-pagodas | 56.8, 153.8 | **new** | loop chinatown 35 u; M Montgomery Street 77 u; N Montgomery Street 77 u | California's first cathedral (dedicated 1854), a brick Gothic church whose clock tower reads 'Son, observe the time and fly from evil'; Saint Mary's Square with Bufano's Sun Yat-sen… | [osmsf.org](http://www.osmsf.org/) +1 | brick nave + square clock tower (no inscription); GATED on the Chinatown view budget |
| 45 | `sing-chong-sing-fat-buildings` | 都板街宝塔楼 / Sing Chong & Sing Fat pagoda buildings (Grant Ave & California St) | T3 | procedural | chinatown-pagodas | 56.5, 158.7 | **new** | loop chinatown 34 u; M Montgomery Street 77 u; N Montgomery Street 77 u | The pagoda-crowned corner buildings of 1907-08, commissioned by merchant Look Tin Eli to rebuild Chinatown in a Chinese style after the quake, are the neighbourhood's most photographed… | [theclio.com](https://theclio.com/entry/186932) +2 | two corner towers with stacked flared roofs (pagoda kit); GATED |
| 46 | `st-marys-cathedral` | 圣玛利亚大教堂 / Cathedral of Saint Mary of the Assumption | T3 | procedural | cathedral-hill | -12.8, 421.2 | **new** | loop civic-center 102 u; M Civic Center 154 u; N Civic Center 154 u | The 1971 cathedral by Pietro Belluschi and Pier Luigi Nervi: four hyperbolic-paraboloid shells rise 190 ft into a cross, a white landmark seen from much of the city. | [smcsf.org](https://smcsf.org/visit) +2 | four hypar shells meeting in a cross (exact maths); Belluschi + Nervi, not I.M. Pei; replaces OSM 7814696 |
| 47 | `tiled-steps-16th-avenue` | 第16大道马赛克阶梯 / 16th Avenue Tiled Steps (Moraga Steps) | T3 | procedural | golden-gate-heights | -113.3, 1143.4 | **new** | N Judah Street & 16th Avenue 87 u | 163 steps covered in a sea-to-sky mosaic of about 2,000 handmade tiles (2005, Aileen Barr and Colette Crutcher), climbing to Grand View Park. | [en.wikipedia.org](https://en.wikipedia.org/wiki/16th_Avenue_Tiled_Steps) +1 | stairs with an abstract blue-sand-sky vertex gradient (never a copy of the mosaic) |
| 48 | `uss-pampanito` | 潘帕尼托号潜艇 / USS Pampanito | T3 | procedural | wharf-west | -225.8, 63.3 | `osm-w165601339` | loop wharf-hyde 73 u | A WWII fleet submarine at Pier 45 that you can climb through, both museum and memorial; open daily 10-6. | [maritime.org](https://maritime.org/) +2 | toy submarine hull moored at Pier 45; card anchor on the pier deck |
| 49 | `war-memorial-opera-house` | 战争纪念歌剧院 / War Memorial Opera House (with Davies Symphony Hall) | T3 | procedural | civic-center | 86, 441.2 | `osm-w32865161` | loop civic-center 41 u; M Van Ness 58 u; N Van Ness 58 u | The 1932 home of SF Opera and SF Ballet (3,006 seats) faces City Hall across Van Ness; the UN Charter was signed in 1945 in the Herbst Theatre of the twin Veterans Building next door… | [sfwarmemorial.org](https://www.sfwarmemorial.org/) +2 | twin Beaux-Arts blocks + Davies Hall curved glass; merged into the City Hall site budget |
| 50 | `west-portal` | 西门站（West Portal） / West Portal (Twin Peaks Tunnel) | T3 | procedural | west-portal | 119.4, 1244.9 | `osm-n2094547200` | M West Portal 5 u | Muni's K, L and M trains come out of the 1918 Twin Peaks Tunnel here onto West Portal Avenue, a small-town main street of local shops. | [en.wikipedia.org](https://en.wikipedia.org/wiki/West_Portal_station) +1 | M tunnel mouth, trains emerging (lane T portal prop) |
| 51 | `baker-beach` | 贝克海滩 / Baker Beach | T2 | plaza + card | baker-beach | -614, 849.3 | `baker-beach` | — | A half-mile beach with the classic low-angle view of the Golden Gate Bridge. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Baker_Beach) +1 | battery prop + bridge-view photo spot at the SOUTH end |
| 52 | `bernal-heights-park` | 伯纳尔高地公园 / Bernal Heights Park | T2 | plaza + card | bernal | 525.6, 777.9 | `bernal-heights` | — | A bare hilltop with a 360° skyline view, a one-mile loop and off-leash dogs, topped by a microwave tower. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Bernal_Heights,_San_Francisco) +1 | bare summit, telescope, procedural microwave mast; panorama point |
| 53 | `blue-heron-lake` | 蓝鹭湖（原斯托湖）与草莓山 / Blue Heron Lake (formerly Stow Lake) & Strawberry Hill | T2 | plaza + card | blue-heron-lake | -269.8, 1032.3 | `stow-lake` | loop golden-gate-park 120 u; N Judah Street & 16th Avenue 105 u | A 12-acre boating lake (1893) that rings Strawberry Hill. | [sfrecpark.org](https://sfrecpark.org/facilities/facility/details/Stow-Lake-410) +2 | rename from Stow Lake; bridge walk strips to Strawberry Hill; Chinese Pavilion (AI, small) at (-251.5, 1017.0) |
| 54 | `corona-heights-randall-museum` | 科罗娜高地与兰德尔博物馆 / Corona Heights Park & Randall Museum | T2 | plaza + card | corona-heights | 95.9, 746.1 | `corona-heights` | loop castro 47 u; M Castro 45 u; N Sunset Tunnel East Portal 94 u | A free city-run kids' science museum with live animals and a model railroad, under a red-rock summit with one of the best close views of downtown. | [randallmuseum.org](https://randallmuseum.org/about-us/directions-hours/) +2 | red-rock summit viewpoint + museum block; panorama point |
| 55 | `harvey-milk-plaza` | 哈维·米尔克广场与彩虹斑马线 / Harvey Milk Plaza & Castro rainbow crosswalks | T2 | plaza + card | castro | 140.7, 746.7 | `osm-w225526801` | loop castro 7 u; M Castro 7 u; N Sunset Tunnel East Portal 112 u | The giant rainbow flag over the Castro Muni station is a city landmark, and the rainbow crosswalks at Castro & 18th (2014) and the Rainbow Honor Walk plaques mark the world's best-known… | [sfpublicworks.org](https://sfpublicworks.org/index.php/HarveyMilkPlaza) +3 | generic six-stripe rainbow flag on a pole + rainbow crosswalks; the M Castro kiosk |
| 56 | `lake-merced` | 默塞德湖 / Lake Merced | T2 | plaza + card | lake-merced | 104.1, 1726.6 | `lake-merced` | — | The city's largest lake: a freshwater reservoir ringed by a walking loop and golf courses, of which TPC Harding Park is public. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Lake_Merced) +1 | boathouse dock + loop path; anchor moves to the Harding Rd shore (the point is in the lake) |
| 57 | `presidio-tunnel-tops` | 要塞公园隧道顶公园 / Presidio Tunnel Tops & Presidio Visitor Center | T2 | plaza + card | presidio | -484.4, 489.1 | `osm-w91114607` | loop palace-of-fine-arts 110 u | Fourteen acres of free parkland over the Presidio Parkway tunnels (opened July 2022) with the Outpost nature playground, the Campfire Circle and big Golden Gate Bridge views; the… | [presidio.gov](https://presidio.gov/explore/attractions/presidio-tunnel-tops/) +2 | lawn deck sloping to Crissy Field; loop passes 18 u (request stop) |
| 58 | `stern-grove` | 斯特恩林（Stern Grove） / Stern Grove (Sigmund Stern Recreation Grove) | T2 | plaza + card | stern-grove | 65.6, 1408.4 | `osm-w103637554` | M Right of Way & Ocean Avenue 86 u | A eucalyptus-and-redwood ravine donated in 1931. | [prnewswire.com](https://www.prnewswire.com/news-releases/longest-running-free-music-festival-in-america-returns-for-its-89th-season-with-al-green-public-enemy-patti-labelle-major-lazer-japanese-breakfast--more-302735986.html) +2 | amphitheatre meadow in a eucalyptus ravine; no performer names |
| 59 | `clement-street` | 企李街（列治文区“新华埠”） / Clement Street (Inner Richmond) | T3 | plaza + card | clement | -331, 775.8 | **new** | loop golden-gate-park 177 u | The Richmond's 'New Chinatown'. | [sfexaminer.com](https://www.sfexaminer.com/news/the-city/how-richmond-district-became-second-san-francisco-chinatown/article_a7783c70-e034-11ef-8c71-3b9f0e67a124.html) +1 | street strip of blank-sign shopfronts ("New Chinatown") |
| 60 | `fort-funston` | 芬斯顿堡 / Fort Funston | T3 | plaza + card | fort-funston | 101, 1842 | `osm-w404851503` | — | Sandstone bluffs where hang-gliders launch over the Pacific, with the old Battery Davis (1936–39) bunker. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Fort_Funston) +1 | bluff deck + one looping hang-glider (TOY_DYN), never player-flyable |
| 61 | `fort-mason-center` | 梅森堡艺术文化中心 / Fort Mason Center for Arts & Culture | T3 | plaza + card | fort-mason | -320.8, 234.6 | `fort-mason` | loop wharf-hyde 139 u | Old Army port piers turned arts campus: theatres such as the Magic Theatre, galleries, Museo Italo Americano and night markets, with Golden Gate Bridge and Alcatraz views; about 1.5… | [fortmason.org](https://fortmason.org/) +1 | pier sheds + apron; loop passes 23 u (request stop) |
| 62 | `grand-view-park` | 格兰维尤公园（龟山） / Grand View Park (Turtle Hill) | T3 | plaza + card | golden-gate-heights | -103.6, 1129.6 | `osm-n7707827583` | N Judah Street & 16th Avenue 88 u | A tiny chert summit about 666 ft high with a 360° view from the Pacific to downtown and Sutro Tower. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Grand_View_Park) +1 | summit clearing + telescope; panorama point |
| 63 | `hippie-hill` | 嬉皮山 / Hippie Hill | T3 | plaza + card | park-east | -141.8, 852.7 | `osm-w272711313` | loop golden-gate-park 109 u; N Carl Street & Hillway Avenue 89 u | The meadow where the 1967 Summer of Love gathered. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Hippie_Hill) +1 | meadow, a few instanced drummers, weekend drum audio (sound hook) |
| 64 | `irving-street` | 尔文街（日落区华人商业街） / Irving Street (Sunset District) | T3 | plaza + card | irving | -248.7, 1120.6 | **new** | N Judah Street & 23rd Avenue 38 u | The Sunset's main street, with a long run of Chinese bakeries, roast-meat shops, grocers and Vietnamese and Thai cafés serving one of the city's largest Chinese-American neighbourhoods. | [sfchronicle.com](https://www.sfchronicle.com/restaurants/article/The-Middle-Sunset-s-vibrant-food-scene-captures-7381518.php) +2 | street strip of blank-sign shopfronts + market crates |
| 65 | `japan-center` | 日本城购物中心 / Japan Center Malls (Japantown) | T3 | plaza + card | japantown | -69.2, 454.7 | `japantown-peace-pagoda` | loop painted-ladies 138 u | Minoru Yamasaki's 1968 mall complex (Japan Center East and West plus the Kinokuniya building, joined by a bridge) around Peace Plaza: ramen, manga and Japanese goods in one of the oldest… | [sfjapantown.org](https://www.sfjapantown.org/japan-center-malls/) +1 | mall blocks + Webster St bridge around the Peace Pagoda (extends that site) |
| 66 | `sf-botanical-garden` | 旧金山植物园 / San Francisco Botanical Garden | T3 | plaza + card | music-concourse | -223.4, 1010.3 | `osm-w120480164` | loop golden-gate-park 91 u; N Judah Street & Funston Avenue 84 u | 55 acres holding more than 8,000 kinds of plants. | [gggp.org](https://gggp.org/visit) +1 | entrance-gate plaza at MLK Dr & 9th Ave, tree clusters |
| 67 | `sunset-dunes` | 日落沙丘公园 / Sunset Dunes | T3 | plaza + card | ocean-beach-west | -341.7, 1525 | `osm-w609650218` | N Judah Street & La Playa Street 161 u | The former Upper Great Highway between Lincoln Way and Sloat Blvd became a car-free coastal park on 12 April 2025, the largest pedestrianisation project in California. | [en.wikipedia.org](https://en.wikipedia.org/wiki/Sunset_Dunes) +3 | car-free promenade strip; neutral card, Prop G (3 Nov 2026) may change it |
| 68 | `cliff-house` | 悬崖屋与暗箱相机 / Cliff House & Camera Obscura | T3 | existing → stop | lands-end | -710.1, 1265.2 | `cliff-house` | loop lands-end-sutro 36 u | The third Cliff House (1909) above Seal Rocks has been closed since 2020 and is being restored to reopen around late 2026. | [nps.gov](https://www.nps.gov/goga/learn/news/nps-announces-lessee-for-food-and-beverage-operations-for-lands-end-restaurant-properties.htm) +2 | existing; card: closed since 2020, reopening not confirmed; add the Camera Obscura label |
| 69 | `city-lights-bookstore` | 城市之光书店 / City Lights Booksellers & Publishers | T3 | card only | hero | -4.3, 108.9 | `osm-w32858754` | loop chinatown 110 u; M Embarcadero 139 u; N Embarcadero 139 u | Founded in 1953 by poet Lawrence Ferlinghetti and Peter D. Martin as the first all-paperback bookstore, it published Ginsberg's 'Howl' and became a city landmark in 2001; Jack Kerouac… | [en.wikipedia.org](https://en.wikipedia.org/wiki/City_Lights_Bookstore) +1 | Jack Kerouac Alley plaza is hero data: card only |
| 70 | `musee-mecanique` | 机械博物馆（古董投币游戏机） / Musée Mécanique | T3 | card only | hero | -211.9, 65.5 | `osm-n368166365` | loop wharf-hyde 72 u | A free-entry hall on Pier 45 packed with 300+ antique coin-operated arcade machines that still play for coins; open every day. | [secretsanfrancisco.com](https://secretsanfrancisco.com/musee-mecanique/) +1 | coin-op prop at the Pier 45 door |
| 71 | `national-aids-memorial-grove` | 国家艾滋病纪念园 / National AIDS Memorial Grove | T3 | card only | park-east | -168.5, 902.3 | **new** | loop golden-gate-park 62 u; N Irving Street & 6th Avenue 85 u | A 7.5-acre dell planted by volunteers from 1991 and made a National Memorial in 1996. | [en.wikipedia.org](https://en.wikipedia.org/wiki/National_AIDS_Memorial_Grove) +1 | quiet memorial: no gameplay objects, BAYBAY speaks softly |
| 72 | `walt-disney-family-museum` | 华特·迪士尼家族博物馆 / The Walt Disney Family Museum | T3 | card only | presidio | -491.4, 530.5 | `osm-w288340246` | loop palace-of-fine-arts 148 u | A museum of Walt Disney's life, opened in 2009 in an 1897 Army barracks on the Presidio's parade ground; open Thursday-Sunday. | [waltdisney.org](https://www.waltdisney.org/visit) +1 | trademark: plain barracks, name in card text only |
| 73 | `salesforce-park` | Salesforce 屋顶公园 / Salesforce Park | T2 | card now, model later | hero-seam | 175.9, 112.4 | `salesforce-park` | loop chinatown 102 u; M Embarcadero 56 u; N Embarcadero 56 u | A free 5.4-acre, ~1,400 ft long park on the Transit Center roof, 70 ft above the street, with 600 trees, Ned Kahn's bus-triggered 'Bus Fountain' and a free gondola up from Mission & Fremont. | [tjpa.org](https://www.tjpa.org/salesforce-park/) +2 | the deck crosses the hero seam: card now, deck model after a hero sign-off |
| 74 | `saints-peter-and-paul-church` | 圣彼得圣保罗教堂（华盛顿广场） / Saints Peter and Paul Church & Washington Square | T3 | card now, model later | hero | -79.5, 98.2 | **new** | loop pier-39 105 u | The white twin-spired (191 ft) Italian Gothic church of 1924 faces Washington Square, the heart of North Beach's Little Italy; Joe DiMaggio and Marilyn Monroe posed for photos on its… | [salesiansspp.org](https://www.salesiansspp.org/our-history) +2 | on hero lot 211: card now; model needs heroDropLots |

#### Priority 4 · tier 3 and cards (built only after priorities 1–3 pass their checks; cards ship regardless)

| # | id | 名称 | map | treatment | x, z | place row | note | source |
|---|---|---|---|---|---|---|---|---|
| 75 | `balmy-alley` | 巴尔米巷壁画街 | T3 | procedural | 456.8, 653.4 | **new** | garage doors in abstract colour fields, or H2b original murals if shipped | [en.wikipedia.org](https://en.wikipedia.org/wiki/Balmy_Alley) +1 |
| 76 | `bayview-opera-house` | 湾景歌剧院 | T3 | procedural | 832.4, 635.3 | `osm-w288836717` | Victorian false-front hall from kit parts; the south-east anchor | [en.wikipedia.org](https://en.wikipedia.org/wiki/Bayview_Opera_House) +1 |
| 77 | `chinese-telephone-exchange` | 华人电话局旧址 | T3 | procedural | 27.4, 133.5 | `osm-n2579643653` | small 3-tier pagoda on Washington St; GATED | [foundsf.org](https://www.foundsf.org/Chinese_Telephone_Exchange) +2 |
| 78 | `crane-cove-park` | 鹤湾公园 | T3 | procedural | 553.3, 313.5 | `osm-w853562207` | two gantry cranes (Nick and Nora) + small beach | [en.wikipedia.org](https://en.wikipedia.org/wiki/Crane_Cove_Park) +2 |
| 79 | `haas-lilienthal-house` | 哈斯-利连塔尔故居 | T3 | procedural | -112.8, 318.6 | `osm-w256993595` | the Queen Anne kit house at full size | [haas-lilienthalhouse.org](https://www.haas-lilienthalhouse.org/house-tours) +2 |
| 80 | `ingleside-terraces-sundial` | 英格塞德日晷 | T3 | procedural | 283.8, 1438 | **new** | 28-ft gnomon whose shadow follows the game sun | [outsidelands.org](https://www.outsidelands.org/sundial.php) +2 |
| 81 | `lyon-street-steps` | 里昂街台阶 | T3 | procedural | -291.8, 513.8 | `osm-n7221410485` | stair flights + hedges, photo pose to the Palace dome | [sfgate.com](https://www.sfgate.com/local/article/lyon-street-steps-17901439.php) +1 |
| 82 | `octagon-house` | 八角屋 | T3 | procedural | -184.1, 291.8 | **new** | octagonal prism + cupola | [nscda-ca.org](https://www.nscda-ca.org/octagon-house/) |
| 83 | `seward-street-slides` | 西沃德街滑梯 | T3 | procedural | 154.7, 832.4 | `osm-w1364891448` | two chute ramps (a ride interaction for player + BAYBAY) | [sfrecpark.org](https://sfrecpark.org/facilities/facility/details/sewardminipark-203) +2 |
| 84 | `vermont-street-crooked-block` | 佛蒙特街弯道（比九曲花街更弯） | T3 | procedural | 454.3, 506.2 | **new** | Lombard hairpin kit on OSM way 799023220 | [en.wikipedia.org](https://en.wikipedia.org/wiki/Vermont_Street_(San_Francisco)) +1 |
| 85 | `wave-organ` | 海浪风琴 | T3 | procedural | -412.3, 290 | **new** | stone terraces + pipe mouths at the jetty tip; needs a jetty walk strip | [en.wikipedia.org](https://en.wikipedia.org/wiki/Wave_Organ) +2 |
| 86 | `womens-building` | 女性大楼（MaestraPeace 壁画） | T3 | procedural | 262.1, 640 | **new** | facade colour wash on the existing lot (no mural copy) | [womensbuilding.org](https://www.womensbuilding.org/our-building/the-mural) +1 |
| 87 | `alta-plaza-park` | 阿尔塔广场公园 | T3 | plaza + card | -198, 453.6 | `osm-w16751737` | stepped terraces + viewpoint | [en.wikipedia.org](https://en.wikipedia.org/wiki/Alta_Plaza_Park) +1 |
| 88 | `buena-vista-park` | 布埃纳维斯塔公园 | T3 | plaza + card | 30, 727.2 | `osm-w7459901` | forest hill + summit clearing | [en.wikipedia.org](https://en.wikipedia.org/wiki/Buena_Vista_Park) +1 |
| 89 | `calle-24` | 24街拉丁裔文化区（Calle 24） | T3 | plaza + card | 455.5, 637.1 | **new** | gateway marker + generic cut-paper banners over 24th St (label near 24th & Harrison) | [calle24sf.org](https://www.calle24sf.org/ourhistory) +1 |
| 90 | `china-beach` | 中国海滩 | T3 | plaza + card | -622.3, 960.9 | `osm-r2142591` | tiny cove + the 1982 marker stone | [parksconservancy.org](https://www.parksconservancy.org/parks/china-beach) +2 |
| 91 | `glen-canyon-park` | 格伦峡谷公园 | T3 | plaza + card | 347.9, 1053 | `osm-w35800082` | canyon trail + chert boulders | [en.wikipedia.org](https://en.wikipedia.org/wiki/Glen_Canyon_Park) +1 |
| 92 | `huntington-park` | 亨廷顿公园 | T3 | plaza + card | 9.1, 217 | `osm-w32946958` | fountain in the Grace Cathedral forecourt (extends that site) | [sfrecpark.org](https://sfrecpark.org/Facilities/Facility/Details/Huntington-Park-438) +1 |
| 93 | `ina-coolbrith-park` | 伊娜·库尔布里斯公园 | T3 | plaza + card | -68.7, 162.7 | `osm-w114151121` | terraced viewpoint | [sfrecpark.org](https://sfrecpark.org/Facilities/Facility/Details/Ina-Coolbrith-Park-175) +1 |
| 94 | `lafayette-park` | 拉法叶公园 | T3 | plaza + card | -117.1, 363.7 | `osm-w16751838` | terraced hilltop | [sfrecpark.org](https://sfrecpark.org/facilities/facility/details/Lafayette-Park-182) +1 |
| 95 | `mclaren-park` | 麦克拉伦公园 | T3 | plaza + card | 773.6, 1075.6 | `osm-w28716696` | blue "La Grande" tank as a procedural cylinder + amphitheatre bowl | [en.wikipedia.org](https://en.wikipedia.org/wiki/John_McLaren_Park) +1 |
| 96 | `mount-sutro-open-space` | 苏特罗山森林保护区 | T3 | plaza + card | 3.3, 981.9 | `osm-n12056865382` | forest cone + trail loop + summit meadow (a fog scene) | [en.wikipedia.org](https://en.wikipedia.org/wiki/Mount_Sutro) +1 |
| 97 | `mountain-lake-park` | 山湖公园 | T3 | plaza + card | -410.6, 769.1 | `osm-w401354283` | lake-edge path + Anza plaque | [en.wikipedia.org](https://en.wikipedia.org/wiki/Mountain_Lake_(San_Francisco)) +1 |
| 98 | `noe-valley-town-square` | 诺伊谷镇广场 | T3 | plaza + card | 319.4, 804.4 | **new** | small plaza, Saturday stalls | [sfrecpark.org](https://sfrecpark.org/1685/Noe-Valley-Town-Square) +1 |
| 99 | `patricias-green` | 帕特里夏绿地（海斯谷） | T3 | plaza + card | 81.7, 497 | `osm-w28015862` | green strip + a generic sculpture plinth | [en.wikipedia.org](https://en.wikipedia.org/wiki/Hayes_Valley,_San_Francisco) +1 |
| 100 | `sutro-heights-park` | 苏特罗高地公园 | T3 | plaza + card | -676.1, 1254.1 | `osm-w160025743` | parapet viewpoint, empty plinths | [en.wikipedia.org](https://en.wikipedia.org/wiki/Sutro_Heights_Park) +2 |
| 101 | `aquarium-of-the-bay` | 海湾水族馆 | T3 | card only | -151.1, 13.2 | `osm-w288396169` | attach to the PIER 39 area | [aquariumofthebay.org](https://www.aquariumofthebay.org/) |
| 102 | `balboa-theatre` | 巴尔博亚戏院 | T3 | card only | -542.6, 1152.9 | **new** | blank vertical sign if modelled later | [balboamovies.com](https://www.balboamovies.com/) +1 |
| 103 | `boudin-bakery` | 波丁酸面包（渔人码头旗舰店） | T3 | card only | -196.2, 65.4 | **new** | brand: name in card text only | [boudinbakery.com](https://boudinbakery.com/our-story/) +2 |
| 104 | `buena-vista-cafe` | Buena Vista 咖啡馆（爱尔兰咖啡） | T3 | card only | -224.1, 138 | **new** | family-neutral card | [thebuenavista.com](https://www.thebuenavista.com/home/irishcoffee.html) +1 |
| 105 | `candlestick-point-sra` | 烛台角州立休闲区 | T3 | card only | 1093.8, 765.1 | `osm-w40060675` | the stadium is gone: never model it | [parks.ca.gov](https://www.parks.ca.gov/candlestickpoint/) +2 |
| 106 | `childrens-creativity-museum` | 儿童创意博物馆与旋转木马 | T3 | card only | 200.2, 221.8 | `osm-w288716388` | check-before-you-go wording | [creativity.org](https://creativity.org/hours-admission/) +2 |
| 107 | `chinese-historical-society-of-america` | 美国华人历史学会博物馆 | T3 | card only | 19.1, 169.2 | `osm-n806240639` | open Wed + Sat only | [chsa.org](https://chsa.org/visit/) +1 |
| 108 | `clarion-alley` | 克拉里恩巷壁画 | T3 | card only | 261.4, 605.9 | `osm-w8916752` | changing political street art: card only | [en.wikipedia.org](https://en.wikipedia.org/wiki/Clarion_Alley) +1 |
| 109 | `cupids-span` | 丘比特之箭 | T3 | card only | 205.8, 27.7 | `osm-w32862802` | no replica of the artwork | [en.wikipedia.org](https://en.wikipedia.org/wiki/Cupid%27s_Span) +1 |
| 110 | `glide-memorial-church` | 格莱德纪念教堂 | T3 | card only | 92.4, 285.4 | **new** | respectful tone | [glide.org](https://www.glide.org/about/) |
| 111 | `golden-gate-fortune-cookie-factory` | 金门签语饼厂 | T3 | card only | 11.1, 136.4 | `osm-n1308317902` | Ross Alley card | [goldengatefortunecookies.com](https://www.goldengatefortunecookies.com/visit) +1 |
| 112 | `greenwich-steps` | 格林威治台阶 | T3 | card only | -51.7, 42.1 | `osm-w28839856` | linked to the Filbert Steps card | [foundsf.org](https://www.foundsf.org/Greenwich_Steps) +1 |
| 113 | `herons-head-park` | 苍鹭头公园 | T3 | card only | 923.3, 457.4 | `osm-n1306296013` | marsh boardwalk later | [en.wikipedia.org](https://en.wikipedia.org/wiki/Heron%27s_Head_Park) +1 |
| 114 | `hidden-garden-steps` | 隐秘花园阶梯 | T3 | card only | -153.9, 1111.5 | **new** | bonus card on the tiled-steps stop | [sfgate.com](https://www.sfgate.com/local/article/hidden-garden-steps-18108794.php) +1 |
| 115 | `hyde-street-pier` | 海德街码头（历史船只） | T3 | card only | -267.4, 116.7 | `aquatic-park-hyde-pier` | CLOSED since Nov 2024: empty pier + fence, no ships | [nps.gov](https://www.nps.gov/safr/planyourvisit/basicinfo.htm) +2 |
| 116 | `india-basin-waterfront-park` | 印度湾滨水公园 | T3 | card only | 988.2, 539.1 | **new** | phase 3 fenced until early 2028 | [sfrecpark.org](https://sfrecpark.org/1153/India-Basin-Waterfront-Park) +1 |
| 117 | `macondray-lane` | 麦康德雷巷 | T3 | card only | -94.9, 168 | `osm-n358805395` | quiet residential lane | [en.wikipedia.org](https://en.wikipedia.org/wiki/Macondray_Lane) +1 |
| 118 | `maiden-lane` | 少女巷 | T3 | card only | 106.9, 206.1 | **new** | card on the lane; gates 11-5 | [en.wikipedia.org](https://en.wikipedia.org/wiki/Maiden_Lane_(San_Francisco)) +2 |
| 119 | `moad` | 非洲侨民博物馆 | T3 | card only | 164.1, 183.6 | `osm-n415567060` | reopens 30 Sep 2026 | [moadsf.org](https://www.moadsf.org/visit) |
| 120 | `moscone-center` | 莫斯康展览中心 | T3 | card only | 194.8, 197.9 | **new** | no event names | [moscone.com](https://www.moscone.com/) +1 |
| 121 | `palace-hotel` | 皇宫酒店 | T3 | card only | 138.1, 167.5 | **new** | no brand names | [sfpalace.com](https://www.sfpalace.com/history/) +2 |
| 122 | `portsmouth-square` | 花园角 | T3 | card only | 37.2, 128.7 | `osm-r14547583` | CLOSED to 2028: construction fence + card; no footbridge | [sfrecpark.org](https://sfrecpark.org/1166/Portsmouth-Square-Improvement-Project) +3 |
| 123 | `presidio-officers-club` | 要塞公园军官俱乐部 | T3 | card only | -450.9, 575.6 | **new** | gallery Fri-Sun | [presidio.gov](https://presidio.gov/explore/attractions/presidio-officers-club/) |
| 124 | `sf-railway-museum` | 旧金山铁路博物馆 | T3 | card only | 149.2, 35.6 | `osm-n386591692` | attach to the F stop Don Chee Way & Steuart | [streetcar.org](https://www.streetcar.org/museum/) |
| 125 | `sfjazz-center` | 旧金山爵士中心 | T3 | card only | 104.6, 470.1 | `osm-w256720482` | — | [en.wikipedia.org](https://en.wikipedia.org/wiki/SFJAZZ_Center) +1 |
| 126 | `tadich-grill` | 塔迪奇烧烤餐厅 | T3 | card only | 103.9, 91.1 | **new** | business: no sign art | [tadichgrillsf.com](https://tadichgrillsf.com/) +2 |
| 127 | `tenderloin-museum` | 田德隆博物馆 | T3 | card only | 84.4, 323.1 | **new** | recheck the address (move planned 2026) | [tenderloinmuseum.org](https://www.tenderloinmuseum.org/) |
| 128 | `the-fillmore` | 菲尔莫尔音乐厅 | T3 | card only | -80.5, 490 | `osm-n368171371` | no posters | [thefillmore.com](https://www.thefillmore.com/shows) +1 |
| 129 | `tin-how-temple` | 天后古庙 | T3 | card only | 26.7, 145.6 | **new** | place of worship, respectful | [en.wikipedia.org](https://en.wikipedia.org/wiki/Tin_How_Temple) +2 |
| 130 | `union-street-shopping` | 联合街（牛谷购物街） | T3 | card only | -221.5, 334.8 | **new** | no store names | [sf.gov](https://www.sf.gov/perfect-day-along-union-st) +2 |
| 131 | `visitacion-valley-greenway` | 访谷绿道 | T3 | card only | 934.6, 1000.8 | `osm-w257182717` | community gardens, no harvesting gags | [visvalleygreenway.com](https://visvalleygreenway.com/visitacion-valley) +2 |
| 132 | `yoda-fountain` | 尤达喷泉（卢卡斯影业园区） | T3 | card only | -392.6, 484.9 | **new** | text-only card, NEVER a statue | [en.wikipedia.org](https://en.wikipedia.org/wiki/Yoda_Fountain) +1 |
| 133 | `sentinel-building` | 哨兵大厦（哥伦布塔） | T3 | card now, model later | 21.3, 106.9 | `osm-w288485994` | inside the hero slab: card now | [en.wikipedia.org](https://en.wikipedia.org/wiki/Columbus_Tower_(San_Francisco)) +1 |
| 134 | `ss-jeremiah-obrien` | 奥布莱恩号自由轮 | T3 | card now, model later | -130.1, -8.3 | `osm-w1280748838` | Pier 35 is hero: card now (moved from Pier 45) | [ssjeremiahobrien.org](https://ssjeremiahobrien.org/visit-us/) +2 |

### 2.5 The existing landmarks: stops, refreshes and name fixes

| landmark | wave-4 role | card / name change |
|---|---|---|
| Golden Gate Bridge | loop stop 5 (Welcome Center), tour chapter 1 | map name 金门大桥 (not "桥面中段"); flag on the south tower top |
| Palace of Fine Arts | loop stop 4 | — |
| Legion of Honor | loop stop 6 | free Saturdays for Bay Area residents; closed Mondays |
| Sutro Baths / Cliff House | loop stop 7 "Lands End · Sutro Baths" | map name 苏特罗浴场 (not "Main pool house"); drop the duplicate curated dot; Cliff House card: closed since 2020, reopening not confirmed; add the Camera Obscura label |
| Dutch Windmill | loop stop 8 "Ocean Beach · Windmill" | the tulip garden blooms about March; the interior is closed |
| de Young | loop stop 9 (Music Concourse) | one zh name 迪扬博物馆 on map and card; the tower is free |
| Conservatory of Flowers | N / walk from stop 9 | closed Wednesdays |
| Twin Peaks | loop stop 13, the panorama point | map name 双峰; construction note: the Promenade works (from May 2026, ~9 months) close the Crestline Trail; road and Christmas Tree Point stay open |
| Sutro Tower | seen from Twin Peaks | private, no access |
| Castro Theatre | loop stop 12 | reopened 6 Feb 2026 after the renovation |
| Mission Dolores | loop stop 14 | tours suspended; respectful tone (the cemetery) |
| City Hall | loop stop 15 | the site grows the War Memorial + Asian Art blocks |
| Dragon Gate | loop stop 16 "Chinatown · Union Square" | — |
| cable-car turntable | walk from stop 16 | map name 叮当车转车台 · Powell & Market, area "Union Square" (not "Tenderloin") |
| Fort Point | walk from stop 5 | map name Fort Point 炮台 (not 波因特堡) |

### 2.6 Budget check per view (lane V re-measures; numbers are lod-0 upper bounds from `plan/budget.mjs`)

| view (wave-1 table: calls / tris) | new lod-0 sites in range | add | after |
|---|---|---|---|
| Ferry gate (121 / 386k) | SFMOMA (diet), Yerba Buena | +1.6k, +2 calls | ≈ 388k |
| Chinatown Dragon Gate (124 / 432k; wave 3 must bring it ≤ 400k) | Union Square, SFMOMA, Yerba Buena, Cable Car Museum (all diet, lod0R 200) | +3.2k, +4 | ≤ 403k → **gate**: if wave 3 leaves < 4k headroom, these four use lod0R 120 and Union Square is ground-only (≈ 0.2k) |
| Twin Peaks (112 / 397k) | none (UCSF Parnassus, Harvey Milk, Corona Heights use lod0R 190) | 0 | 397k |
| Mission (87 / 346k) | Dolores Park, Harvey Milk, Corona Heights | +1.3k, +3 | ≈ 347k |
| Ocean Beach (58 / 148k) | Ocean Beach west site | +2.0k, +1 | ≈ 150k |
| GGB (52 / 125k) | Baker Beach | +0.5k, +1 | ≈ 126k |
| Union Square (new spot) | Union Square, SFMOMA, Yerba Buena, Civic ext, Cable Car Museum | +5.7k, +5 | base to measure (≈ Chinatown) |
| Civic Center (new) | Civic ext, St Mary's, Union Square, Japan Center | +5.1k, +4 | base to measure |
| Music Concourse (new) | Cal Academy (AI), Tea Garden, Blue Heron pavilion, park east, UCSF, USF, Holy Virgin, Clement, Irving | +21.5k, +12 | base to measure; if > 395k, Cal Academy ≤ 4k and the strips go to lod0R 150 |
| Stonestown / SF State (new) | Stonestown, SF State, Stern Grove, Lake Merced, Zoo | +8.3k, +6 | a ~150k view: safe |
| Haight / USF (new) | USF (AI church), Haight, park east, UCSF, Cal Academy, Corona Heights | +14.9k, +9 | base to measure |

Transit (buses, LRVs, stops, kiosks, portals) is budgeted separately (§3.7: ≤ 8 calls / 20k tris with the cable cars),
the flags are 1 call / ≤ 1k tris (§4.2). Draw calls are never the constraint (each site is 1–2 calls); triangles are.

---

## 3. The lines

### 3.1 Overview

| line | id / short | kind | length | stops | vehicles | lap / ride | colour |
|---|---|---|---|---|---|---|---|
| 旧金山观光环线 SF Sightseeing Loop | `sf-loop` / 观光 | hop-on hop-off bus, clockwise, one way | **6,522 u** (46.6 km real), measured on the car-legal OSM graph | 16 | 3 toy open-top double-deckers | ≈ 14 min per lap (≈ 11.5 min driving + 16 × 8 s dwell) | #e0563f coral, cream casing, white centre dashes |
| N 线 N Judah | `n-judah` / N | light rail (Muni Metro), double-ended | 1,580 u in wave 4 (Embarcadero → Judah & La Playa); tunnels 516 u (Market St subway) + 180 u (Sunset Tunnel) | 33 OSM stops → ≈ 30 stations (8 major) | 2 two-car toy LRVs | ≈ 2.8 min end to end | #2f6fb0 blue |
| M 线 M Ocean View | `m-ocean-view` / M | light rail (Muni Metro), double-ended | 2,028 u (Embarcadero → Balboa Park); one tunnel 1,164 u (Market St subway + Twin Peaks Tunnel) | 29 OSM stops → ≈ 28 stations (9 major) | 2 two-car toy LRVs | ≈ 3.1 min end to end | #2f8f5b green |

Why these: the three cable-car lines (and the F-line) all sit in the north-east; nothing reaches the Richmond, the
Sunset, Ocean Beach, Parnassus, Stonestown or SF State. The loop covers the famous north and west (the Marina, the
Presidio, the coast, Golden Gate Park, the Haight, Twin Peaks, the Mission, Civic Center, Chinatown); the N crosses the
Sunset to the sea; the M reaches the owner's Stonestown and SF State. The surface rails of both Metro lines **already
exist** in the published chunks (road class `tram`, checked in chunks 0_10, 1_11, −3_9, 0_4, −1_6, 2_1), so the Metro
needs no chunk rebuild. Not in wave 4 (§7): the N's King St part (its Embarcadero portal is in the hero slab), the T
Third (UCSF Mission Bay, Chase Center), the L Taraval (the Zoo), K Ingleside (CCSF).

### 3.2 The sightseeing loop (hop-on hop-off, BAYBAY at every stop)

**Stops (clockwise).** Measured with `plan/loop-final.mts` (raw OSM highways, access / motor_vehicle / oneway
respected, no motorways, Dijkstra preferring primary / secondary streets). The two waterfront stops use the hero F-line
platforms (the hero promenade is ≈ 18 u seaward of OSM).

| # | stop id | name | x, z | street | serves (walk) | transfers |
|---|---|---|---|---|---|---|
| 1 | `ferry-building` | 渡轮大厦 Ferry Building | 128.2, 15.7 (hero platform) | The Embarcadero | Ferry Building Marketplace, farmers market, Salesforce Park / Tower | F 5 u · California cable (Drumm) 31 u · N/M Embarcadero kiosk 50 u |
| 2 | `pier-39` | 39号码头 · 海狮 PIER 39 | −151.3, 21.0 (hero platform) | The Embarcadero | PIER 39, sea lions, Aquarium of the Bay, Coit via the Filbert / Greenwich steps | F Beach & Stockton 8 u |
| 3 | `wharf-hyde` | 渔人码头 · 海德街 Fisherman's Wharf · Hyde St | −223.0, 136.3 | Hyde St | Ghirardelli, Maritime Museum, Musée Mécanique, Pampanito, Lombard (73 u), Buena Vista | Powell-Hyde terminus 1 u, turntable 11 u · F Jones & Beach 41 u |
| 4 | `palace-of-fine-arts` | 艺术宫 Palace of Fine Arts | −414.4, 403.7 | Baker St | Palace 20 u, Marina Green, Wave Organ, Lyon St Steps | — (request stops on the way: Fort Mason 23 u) |
| 5 | `golden-gate-bridge` | 金门大桥 · 游客中心 Golden Gate Bridge | −680.7, 613.9 | Lincoln Blvd | Welcome Center 22 u, south-tower vista, Fort Point 72 u, the deck (golden-gate goal), GGB-fog postcard 57 u | — (Presidio Tunnel Tops passed at 18 u: request stop) |
| 6 | `legion-of-honor` | 荣勋宫 Legion of Honor | −658.5, 1068.8 | Legion of Honor Dr | Legion of Honor, Lincoln Park | — |
| 7 | `lands-end-sutro` | 天涯海角 · 苏特罗浴场 Lands End · Sutro Baths | −697.9, 1231.7 | Point Lobos Ave | Lands End Lookout 5 u, Sutro Baths 30 u, Cliff House, Sutro Heights | — |
| 8 | `ocean-beach-windmill` | 海洋海滩 · 荷兰风车 Ocean Beach · Windmill | −585.6, 1331.2 | Great Highway (north of Lincoln) | Dutch Windmill 20 u, Beach Chalet 10 u, Murphy Windmill 75 u, Ocean Beach, windmill postcard | N Judah & La Playa 145 u (BAYBAY leads) |
| 9 | `golden-gate-park` | 金门公园 · 音乐广场 Golden Gate Park | −228.0, 919.6 | Music Concourse Dr | de Young 26 u, Cal Academy 29 u, Tea Garden 47 u, Botanical Garden, Blue Heron Lake 120 u | N 9th & Irving 125 u |
| 10 | `haight-ashbury` | 海特-阿什伯里 Haight-Ashbury | −40.7, 764.0 | Ashbury St | Haight & Ashbury 1 u, Buena Vista Park, Hippie Hill, USF 159 u | N Carl & Cole 73 u |
| 11 | `painted-ladies` | 彩绘女士 · 阿拉莫广场 Painted Ladies | 5.2, 570.4 | Steiner St | Painted Ladies 5 u (photo goal), Alamo Square | — |
| 12 | `castro` | 卡斯特罗 The Castro | 142.5, 739.7 | Castro St | Castro Theatre 10 u, Harvey Milk Plaza 7 u, Seward slides | M Castro 2 u · F 17th & Castro 5 u |
| 13 | `twin-peaks` | 双峰 Twin Peaks | 145.6, 956.7 | Twin Peaks Blvd (summit lot) | Christmas Tree Point: BAYBAY leads the last ≈ 40 u on foot, so the twin-peaks goal counts "on foot"; panorama; Sutro Tower view | — |
| 14 | `mission-dolores` | 多洛雷斯传教站 · 公园 Mission Dolores | 194.2, 640.4 | Dolores St | Mission Dolores 7 u, Dolores Park 70 u, murals / Clarion Alley 90 u | M Church 55 u |
| 15 | `civic-center` | 市政厅 · 市政中心 Civic Center | 87.5, 400.6 | McAllister St | City Hall 20 u, Asian Art Museum, War Memorial, UC Law SF | M/N Civic Center 53 u · F Larkin 50 u |
| 16 | `chinatown` | 唐人街龙门 · 联合广场 Chinatown · Union Square | 89.7, 166.7 | Bush St | Dragon Gate 11 u, Union Square 55 u, Maiden Lane, Old St Mary's | California cable (Kearny) 31 u · Powell cables (Bush) 51 u · M/N Montgomery 43 u |

**Legs** (u, max grade world / real): Ferry → PIER 39 329 (all hero) · → Wharf 141 (0.14 / 0.09) · → Palace 407
(0.19 / 0.11) · → GGB 520 (0.14 / 0.08) · → Legion 571 (0.18 / 0.11) · → Lands End 326 (0.16 / 0.10) · → Ocean
Beach 217 (0.16 / 0.11) · → GG Park 706 (0.08 / 0.04; Great Highway > Lincoln Way > Crossover Dr > MLK Dr > Music
Concourse, never JFK Promenade or the Upper Great Highway south of Lincoln) · → Haight 429 · → Painted Ladies 259 ·
→ Castro 275 (0.21 / 0.13) · → Twin Peaks 674 (spur, climbs 38 u) · → Mission Dolores 791 · → Civic Center 322 (hand-
smooth the Chula Lane jog) · → Chinatown 325 (McAllister > Larkin > Bush: avoids the 0.25 Powell grade) · → Ferry 230
(Bush > Sansome > California > Drumm > Washington > The Embarcadero; 163 u in the hero). 555 u of the loop run inside
the hero slab and follow `DISTRICT.roads` there, not OSM.

**Vehicle.** A generic toy open-top double-decker (no Big Bus / City Sightseeing look): coral body, cream band, "观光
SF" on the side, upper deck with 4 rows of benches and a front rail, stairs at the back, lower-deck door. ≤ 1.2k tris,
TOY_INST: **one draw call for all buses**; far version (≈ 150 tris) beyond 110 u, hidden beyond 300 u; night lamps.
Seat spots: upper deck front row for the player + BAYBAY (the ride camera "deck"); a lower-deck standing spot.

**Simulation** (`world/busSystem.ts`, same RideStatus / platform API as `CableSystem`): one-way loop, cruise 12 u/s
on primary / secondary streets, 9 u/s on residential streets or grades > 0.12, corner slow-down, accel / decel
2.6 u/s² (as `streetcar.ts`), dwell 8 s at every stop, 3 buses spaced by headway (≈ 4.5 min). **Waiting-rider
dispatch**: if no bus is within 20 s of the stop where the player waits, an unseen bus is placed to arrive within 15 s. Buses
yield at the cable-car crossings (Bush × Powell, California St near Drumm) through the existing interlock pattern.

**Narration** (lane C's `tourLines.ts`, spoken by BAYBAY beside the player): per stop `{ approach, arrive, hopOffTip }`.
`approach` fires 60 u before the stop together with a 4 s look-at camera bias toward the attraction ("左手边就是艺术宫");
`arrive` plays during the dwell; `hopOffTip` ("下车走 20 米就是风车，郁金香三月开") shows as the hop-off hint. Seeds:
`SfLandmarkInfo.bark`, `realInfo.tips`, the Mini-SF visit notes and the new cards. Voice through lane V (§6), text
bubble always.

**Stop furniture** (lane T): a toy bus-stop pole with a coral 观光 roundel and the stop attraction's small pennant (the
same flag glyph as §4.2), instanced (one call for all stops); interactable `transit-<stop>` radius 4.2, verb 上观光巴士.

### 3.3 Muni Metro: N Judah and M Ocean View

**Data** (lane T, `scripts/opus-sf/lib/transit.ts`): add OSM route relations **3435877** (N outbound) and **3433314**
(M outbound; the inbound relations only duplicate stops) with kind `'light-rail'`, short `N` / `M`, `doubleEnded: true`,
and a new `tunnels[]` per line (arc spans from the ways tagged `tunnel=yes` / `layer<0`, with both portal positions and
the stations inside). Underground path heights are not sampled from the terrain (they would run the cars over the
hills); portals interpolate from the surface height at the mouth. The N path is cut at Embarcadero (arc 420.2) and
re-based to 0 for wave 4.

**Stops of interest** (English names stay primary, as on the real signs; a zh gloss is added from
`data/sf/stationNames.ts`; stops within 8 u merge as today):

| line | stop (zh gloss) | x, z | arc (u) | notes |
|---|---|---|---|---|
| N, M | Embarcadero 内河码头站 (underground) | 131.4, 78.9 | 0 | kiosk at Market & Drumm (hero ground, city mode only) |
| N, M | Montgomery 蒙哥马利站 (u.) | 132.7, 167.9 | 89 | kiosk on Market; loop stop 16 is 43 u away |
| N, M | Powell 鲍威尔站 (u.) | 134.1, 268.1 | 189 | kiosk by the cable-car turntable |
| N, M | Civic Center 市政中心站 (u.) | 135.5, 379.0 | 300 | kiosk; City Hall |
| N, M | Van Ness (u.) | 136.9, 468.1 | 389 | kiosk; SF Conservatory of Music, SFJAZZ |
| N | Duboce & Church · 杜博斯 | 118.6, 609.0 | 537 (surface) | **Duboce portal** (132.2, 592.7): the N surfaces; Painted Ladies 118 u |
| N | Sunset Tunnel east portal · Duboce Park | 79.4, 653.4 | 597 | **east portal** (73.0, 661.1), grade 0.18 world: cut the track into the hillside |
| N | Carl & Cole · 海特区 | −19.9, 833.7 | 804 | **west portal** (−17.1, 817.2), the classic N Judah photo: landmark-quality mouth |
| N | Carl & Stanyan · 金门公园东 | −39.8, 862.3 | 839 | Kezar, Koret carousel |
| N | Carl & Hillway · UCSF | −67.2, 901.5 | 887 | UCSF Parnassus 39 u |
| N | Irving & 2nd · UCSF 帕纳萨斯 | −79.4, 927.4 | 918 | UCSF Parnassus 26 u |
| N | 9th Ave & Irving · 金门公园 | −133.5, 1006.0 | 1,022 | Botanical Garden, Cal Academy ≈ 100 u, Irving St |
| N | Judah & 19th Ave | −200.3, 1111.5 | 1,163 | Tiled Steps / Hidden Garden Steps ≈ 50 u |
| N | Judah & Sunset Blvd | −355.2, 1290.8 | 1,400 | — |
| N | Judah & La Playa · 海洋海滩 (terminus) | −465.1, 1417.2 | 1,568 | Ocean Beach 66 u, windmill ≈ 110 u |
| M | Church 教堂街站 (u.) | 140.2, 648.1 | 569 | kiosk; Mission Dolores / Dolores Park |
| M | Castro 卡斯特罗站 (u.) | 140.4, 739.7 | 661 | kiosk at Harvey Milk Plaza |
| M | Forest Hill 森林山站 (u.) | 99.1, 1113.6 | 1,041 | kiosk on Laguna Honda Blvd |
| M | West Portal 西门站 | 119.8, 1239.6 | 1,169 | **West Portal** mouth (118.8, 1235.0): trains emerge onto West Portal Ave |
| M | St Francis Circle 圣弗朗西斯圆环 | 133.4, 1347.2 | 1,278 | Stern Grove ≈ 70 u |
| M | 19th Ave & Winston · 石镇 | 195.2, 1471.5 | 1,420 | Stonestown 30 u |
| M | 19th Ave & Holloway · 州立大学 | 256.9, 1536.2 | 1,510 | SF State east edge 62 u; Lake Merced ≈ 250 u |
| M | San Jose & Geneva · Balboa Park (terminus) | 511.7, 1299.3 | 2,028 | CCSF 95 u |

**Underground: no tunnel geometry is built.** Boarding at an underground station is at its street **kiosk** (a toy
stair headhouse with the line-letter disc, on the Market St sidewalk above the station, at or next to the F-line stop
there). E → pick a destination → a 0.6 s fade to the **subway overlay** (lane T, CSS only): dark, passing tunnel-lamp
streaks, a full-width line strip at the top with a moving dot and the station names; the ride runs time-compressed at
25 u/s with a 3 s stop at each station (Embarcadero → Church ≈ 35 s; Castro → West Portal ≈ 23 s). You can only get off
at stations: getting off fades you out and places you at that station's kiosk. Near a portal the surface chunk is
awaited (`whenReady(exit, 150)`, cut after 8 s at most), then the view cuts to the LRV **emerging** with the ride camera
behind it. The 180 u Sunset Tunnel uses the same overlay (≈ 7 s, no stations). Nothing is streamed while underground,
which saves the phone.

**Surface.** A two-car toy LRV (generic: silver body, red belt line, headsign with the letter only, no Muni logo),
≤ 1k tris per train, TOY_INST one call for all; 10 u/s (cap 12), dwell 4 s at the **major** stops (transfers, the ★
attraction stops, termini) and a stop at minor stops only when the player requested it or waits there; 2 trains per
line on the surface plus the waiting-rider dispatch; termini reverse like the California line. Surface portals are
T3 props (≤ 800 tris each, walk blockers around the mouth, the rail ramp cut into the terrain).

### 3.4 Boarding, riding, hopping off (all lines)

- **Boarding** (`lineChoices()`, generalising `cableChoices`): loop stops offer the next 3 stops with seconds (★ marks
  an attraction), **坐一圈（约 14 分钟，BAYBAY 讲解）**, 看线路图 (opens the map's 线路 tab with the line highlighted) and
  先不坐; Metro stations offer the next stop each way, the ★ stops and both termini; at most 6 choices on phones. In a
  trip or a tour, boarding is pre-filled with one confirm choice ("上车 · 坐到 石镇（约 70 秒）" / "先不坐").
- **Riding.** The RideBanner (`rideLabel`) shows an icon (bus / metro / cable-car / tram) and "观光环线 · 下一站 艺术宫 ·
  约 40 秒" or "N 线 · 开往 海洋海滩 · 下一站 Carl & Hillway · UCSF". Buttons: **下一站下车** (new: requests the next stop
  through E2's brake handshake), **直接到站** (existing `finishRide`; legs > 400 u use the travel veil + `whenReady`; it
  counts as a ride but skips the viewing moments), **提前下车** (existing; the bus pulls to the kerb; underground it is
  disabled with "隧道里不能下车"). H rings the bell / gong.
- **Hopping off** at a stop with an attraction starts that attraction's arrival moment (§4.2) and a walking leg that
  BAYBAY leads; a **回车站** chip shows "下一班 约 N 秒" and leads back. Tour progress survives a hop-off.

### 3.5 The Grand Tour 环游旧金山 · 一日游 (`sf-grand`)

| ch. | name | legs | ≈ min |
|---|---|---|---|
| 1 | 海湾 The Bay | Ferry Building → 🚌 PIER 39 → Wharf → Palace → Golden Gate Bridge (hop off: south-tower vista, Fort Point overlook; optional deck crossing = golden-gate goal) | 4.5 |
| 2 | 海岸 The Coast | 🚌 → Legion of Honor → Lands End · Sutro Baths (hop off: ruins) → Ocean Beach · Windmill (hop off: windmill postcard) → 🚶 BAYBAY leads 145 u to N Judah & La Playa | 4 |
| 3 | N 线穿越日落区 The Sunset by N | N inbound → 9th & Irving (hop off: Cal Academy / Tea Garden) → N → Carl & Hillway (UCSF from the window) → Carl & Cole (Haight) → Sunset Tunnel → Duboce & Church → 🚶 Painted Ladies (photo goal) → 🚶 Church station | 5 |
| 4 | M 线去石镇和州大 Stonestown & SF State | M (subway overlay) → West Portal (emerging) → St Francis Circle → 19th & Winston (hop off: **Stonestown**) → 🚶 BAYBAY leads 90 u down 19th Ave → **SF State** (campus moment) → M inbound → Castro | 4.5 |
| 5 | 双峰与市中心 Twin Peaks & Downtown | 🚌 from the Castro stop → Twin Peaks (panorama, BAYBAY leads to the overlook = twin-peaks goal, postcard clues unlock) → Mission Dolores → Civic Center → Chinatown · Union Square → 🚶 up to California & Powell (cable-car postcard) → 🚃 California cable car to Drumm (> 150 u = cable-car goal) → 🚶 Ferry Building | 7.5 |

Total ≈ 25.5 min; the express version (hop off only at GGB, Twin Peaks and SF State; 直接到站 on the legs > 400 u)
≈ 18 min. Honestly completed on the way: golden-gate (optional deck walk), twin-peaks (on foot), cable-car, painted-ladies,
the new sightseeing and metro goals, and most of the 12 SF postcards lie within 70 u of a hop-off (GGB fog, Palace,
windmill, Ocean Beach, Painted Ladies, Twin Peaks, City Hall, cable-car hill, Chinatown lanterns; Dolores Park and the
Mission murals 70–90 u from stop 14; Lombard 73 u from stop 3). Neighbourhoods 8 / 41 come on their own.

**Entry:** city welcome choice 1 "刚来湾区，带我认识一下" → the Grand Tour (subtitle "全城 5 章 · 约 25 分钟 · 随时下车";
Bay 101 stays the district tour and a short "海边 7 站" option in the city call menu); the call menu ("带我环游旧金山（约
25 分钟）", "坐观光巴士", "坐地铁去海边 / 去石镇和州大"); the map's 线路 tab. **Engine:** `CityTourDef { id, name,
chapters: [{ id, name, stops: CityTourStop[] }] }`, `CityTourStop { id, place?, station?, leg: { via: 'walk' } | { via:
'line', line, from, to }, optional?, moment?: 'arrive' | 'photo' | 'panorama' | 'deck', lines: { lead?, arrive, done? },
minutes }`; `game.tour.id` (default `'first-lesson'`, so the district is unchanged); resume "继续一日游 · 第 3 章". The
end is a recap panel: the path on a small map, postcards and stamps found, and "全城都能飞了" (every stop is now
discovered, so fast travel covers the city).

### 3.6 Map display, goals, save and audio for the lines

- **Map:** the loop as a coral dashed line with a cream casing, N blue, M green (solid; dashed over the tunnel spans),
  the cable lines as today, the F-line when wave 3's F7 is in; station symbols from s ≥ 0.3; the legend lists them
  (§4.1). Stations join the place index: searchable (zh + en), discovered when you stand at them, flyable once
  discovered.
- **Goals** (lane C; city goals 7 → 10): **sightseeing** 观光巴士 (ride the loop past 8 stops, real rides; 直接到站
  counts, fast travel does not), **metro** 坐地铁去海边 (a real N ride to La Playa or an M ride to Stonestown / SF State,
  ≥ 150 u, `travelEpoch` unchanged), **campuses** 大学巡礼 (arrival moments at 3 of SF State, USF, UCSF Parnassus, UCSF
  Mission Bay, CCSF; fast travel does not count). Waypoint targets from `cityContent.goalTargets`.
- **Save v2:** rides per line id (`noteRide`, lane T), `tours: Record<id, { chapter, stop, completed[] }>` (≤ 8 ids,
  decoded as untrusted input, lane C), discovered stations as places (≈ 70 rows inside the 2,000 cap, lane P).
- **Audio** (lane T, synthesized first): bus engine hum and air-brake, door chime, stop bell; LRV motor whine, gong on
  H, door chime; a low tunnel rumble under the overlay; a station chime at kiosks. Generated SFX only if synthesis sounds
  cheap (lane V, ≤ 5 credits). BAYBAY voice lines for the stops (§6).

### 3.7 Data and code changes (who does what is in §5)

- **Frozen types (lead, day 0):** `core/events.ts` `TransitKind` += `'bus' | 'light-rail'`, `TransitWhat` += `'approach'`,
  new events `{ type: 'arrival', place, tier, first }` and `{ type: 'trip', what: 'start' | 'leg' | 'end' | 'cancel',
  place, mode }`; `world/sf/format.ts` `TransitLine.kind` += `'bus' | 'light-rail'`, `loop?: boolean`, `short?: string`,
  `tunnels?: TransitTunnel[]` (`{ fromAt, toAt, portalA, portalB, stations: string[] }`), stop `name.zh` filled from the
  gloss; `SfPlaceKind` += `'campus' | 'shopping' | 'zoo' | 'religious'`.
- **Data:** `transit.json` is rebuilt by a **sidecar** (`scripts/opus-sf/transit-sidecar.ts`, same inputs as the build,
  writes only transit.json; chunks untouched; the manifest names the file without a hash). `places.json` likewise
  (`places-sidecar.ts`). The frozen `sf-data` test's exact line-id pin becomes "the wave-2 lines ⊆ ids ⊆ that set +
  `sf-loop`, `n-judah`, `m-ocean-view`" at day 0, so lane T can publish without touching a frozen file.
- **Runtime:** `buildTransit` keeps bus / light-rail lines; `CableSystem` stays; `BusSystem` and `LightRailSystem`
  implement the same publish / platform API; `ride.ts` drops its hard-coded `'cable-car'`; `transitLayer.ts` hosts the
  new systems in the lazy city chunk (GameRoot stays ≤ 250 KB gzip).
- **Budget:** vehicles + transit ≤ **8 calls / 20k tris** in any view (6 cable cars + 3 buses + 4 LRVs + stops +
  kiosks + portals, far versions reused, hidden beyond 300 u); every new program registered for warm-up.

---

## 4. Map display and guidance

Principle: always answer "where is it, how far, how do I get there" with **one quiet cue in the world, one on the
screen edge and one from BAYBAY**, never more; every time shown is the time it really takes in the game.

### 4.1 The map (lane P)

**Fix first: no place label ever renders** (if wave 3 did not already fix it). `CityMap.tsx` pushes each marker's own
circle as an obstacle; the landmark label box (bottom y − 9) overlaps its own circle (top y − 10), so
`cityMapDraw.layoutLabels` drops every label. `layoutLabels` takes obstacles with ids and never tests an item against
its own marker (labels sit beside the marker, §labels below). The `sf-citymap` test puts the obstacle **at the label's
own marker** (today's test cannot catch it).

**Data.** New `data/sf/attractions.ts`: `ATTRACTIONS: Attraction[]` with `{ placeId, rank: 1 | 2 | 3, cat, short:
Bilingual (≤ 5 CJK / 14 Latin chars), fame, aliases[], photo? (key into src/data/sf-landmark-photo-assets.json, the
-small.webp for thumbs), flag?: { x, z, h }, landmarkId?, officialUrl?, visitNote? }`, merged into the place index at
load; the types live in the frozen `data/sf/attractionTypes.ts` (day 0). New `data/sf/extraPlaces.ts`: the 47 new rows
of §2.4 (ids = the attraction ids), projected from lat/lng, arrivals snapped to the walking graph by the places sidecar.
The pipeline's `poiKind` learns `amenity=university|college` → campus, `shop=mall` → shopping, `tourism=zoo` → zoo.
**Name fixes** (map name = card name): Sutro Baths (not "Main pool house"), 金门大桥, 叮当车转车台 (area Union Square),
双峰, 迪扬博物馆, Fort Point 炮台, 蓝鹭湖（原斯托湖）; the duplicate curated sutro-baths dot goes; `lands-end` moves to the
Lookout (−703.2, 1231.2), `lake-merced` to the Harding Rd shore.

**Tiers.** Visibility is keyed to the absolute scale s (CSS px per world unit), not the zoom relative to MAP_FRAME, so a
phone and a desktop at the same s show the same things (phone SF-land fit 0.185, phone first open 0.34, desktop SF fit
0.231).
- **T1 (16, always shown, always labelled when space allows):** golden-gate-bridge 金门大桥, alcatraz 恶魔岛 (view only:
  带我去 leads to the Pier 33 telescope), fishermans-wharf 渔人码头, ferry-building 渡轮大厦, coit-tower 科伊特塔,
  chinatown-dragon-gate 唐人街, lombard-crooked 九曲花街, palace-of-fine-arts 艺术宫, golden-gate-park 金门公园,
  alamo-square-painted-ladies 彩绘女士, twin-peaks 双峰, city-hall 市政厅, union-square 联合广场, sutro-baths 苏特罗浴场,
  **sf-state-university 州立大学**, **stonestown-galleria 石镇** (the owner's two, and they fill the empty south).
- **T2 (≈ 45, from s 0.3):** the `map T2` rows of §2.4 plus the existing T2 landmarks (Sutro Tower, Mission Dolores,
  Castro Theatre, Legion, Fort Point, Conservatory, de Young, Dutch Windmill, Oracle Park, Chase Center, Ghirardelli,
  Grace Cathedral, Peace Pagoda, the turntable) and the famous curated places (Presidio, Crissy Field, PIER 39,
  Exploratorium, Bay Bridge, Treasure Island, Marina Green).
- **T3:** the other curated places and the `map T3` rows. **T4:** discovered OSM places (today's 3.5 px dots).

**Categories** (lucide glyph · colour): landmark Landmark · #d8744a terracotta; museum Palette · #8a5a9c plum; park
Trees (PawPrint for the zoo) · #4f8f5b; viewpoint Mountain / Binoculars · #b8862f ochre; coast Waves (Sailboat for
islands) · #2f8fa3; **campus GraduationCap · #3f5f9f navy**; **shopping ShoppingBag · #c8577a rose**; sports Trophy ·
#e07a3a; culture Church / Theater / Castle · #8a6a4a; neighbourhood Signpost · #6f5f47.

**Badges.** T1 26 px (r 13, 14 px glyph, 2 px cream rim #fffaf1, 1 px outline rgba(60,40,20,.25), a baked shadow
circle offset (0, 1.5) at 22 % ink, no SVG filters on phones); T2 20 px (11 px glyph); T3 a 10 px dot until s ≥ 1.2,
then a 16 px badge; T4 3.5 px dots at s ≥ 1.5. States: undiscovered = cream fill + 2.5 px category ring + category glyph
(famous places are known even under the paper fog); discovered = category fill + cream glyph; arrived = a 7 px gold tick
at 4 o'clock; selected = 3 px gold ring, scale 1.15; **active target** = a 30 px gold pin-flag with a pulse ring (the
same shape as the in-world flag); **next tour stop** = a coral number disc at 10 o'clock. Optional: lane V's illustrated
T1 sticker sprites replace the T1 glyph at s ≥ 0.45 (lucide stays the fallback).

**Visibility by scale:** s < 0.3 → T1 badges + labels, lines at 2 px, stations hidden, clusters on, zone names off;
0.3–0.45 → + T2 badges (no labels), station dots, visited zone names at 10 px (lowest priority); 0.45–1.2 → + T2 labels
when they fit, T3 dots, transfer-station and tour-stop names; ≥ 1.2 → T3 badges + labels, all station names; ≥ 1.5 T4
dots; ≥ 3 T4 labels; zone names off from s ≥ 2.

**Labels.** Greedy in priority order: selected, active target, next tour stop, T1 by fame, T2 by fame, stations, T3,
zones. Each kept badge tries 4 boxes (right x + r + 3 centred, left, above, below); a box stays inside the frame minus
the tool column (44 px right) and the credit line (16 px bottom), avoids placed labels and every kept badge except its
own. `short` names on the map (金门大桥, 州立大学, 石镇, 金门公园, 联合广场); the full name on selection. zh shows zh only
below s 1.2. Fonts: T1 12 px / 800, T2 11 / 700, T3 + stations 10.5 / 700, zones 10 px italic #6f5f47; a 3.5 px cream
halo (paint-order stroke). Simulated on real coordinates (`ux/labels-sim.txt`): phone 352 × 388 at the SF fit keeps 13
badges and labels 12 of 13 T1 (clusters wharf + lombard, chinatown + union, sfsu + stonestown); 375 × 667 11 / 12;
desktop 480 × 430 14 / 14.

**Clusters.** Screen-space, same priority order: a badge within rA + rB + 2 px of a kept badge of equal or higher
priority merges into it; the kept badge gets a "+n" pip (12 px cream pill) at 2 o'clock; a tap on it zooms to fit the
members (s ≥ 0.5); the label is the kept badge's short name ("州立大学 +1").

**Framing.** 全城 fits the SF land bbox (x −900…1000, z −100…1760 → s 0.185 on a 390 phone, zoom ≈ 1.62; MIN_ZOOM 0.8
stays for Bay context). First open: with a trip / tour / target, fit player + target + next stop (48 px padding, s in
[0.25, 1.2]); otherwise player + the 3 nearest undiscovered T1 (s in [0.3, 0.8]) — from the Ferry that frames Coit,
Chinatown and Union Square instead of the Bay. A 28 px compass rose top-left points to true north (≈ 46° up-left); tap →
"地图按游戏方向摆放，北在左上". No map rotation in wave 4.

**Filters, legend, list, search.** A scrolling chip row under the frame (32 px chips): 全部 · 必看★ · 博物馆 · 公园 · 观景 ·
校园 · 购物 · 交通; a chip dims the other categories to 25 % and hides their labels (T1 stay, dimmed); 交通 shows lines +
stations + T1 only; the choice is remembered in localStorage (try / catch). An ⓘ legend sheet: category icons, T1 / T2 /
T3 sizes, badge states, line swatches, station symbols, "pale areas = not visited yet". Tabs **景点 · 线路 · 附近 ·
去过的** (景点 replaces 地标): 景点 lists T1 then T2 grouped by area (北岸与市中心 / 金门大桥与要塞 / 海岸 / 金门公园与日落区 /
双峰·卡斯特罗·教会区 / 南区（石镇·州大·湖区）) with a 44 px photo thumb or badge, area, walking time, found tick; 线路 has one row
per line (swatch, name, stops, "坐一圈 约 14 分钟" / "N 线 · 市中心 ↔ 海洋海滩"); tapping highlights the line (others 30 %),
its stops become tappable ("坐到这一站"), the nearest stop gets "带我去车站". Search aliases: 大学 / university / college /
campus → campus; 商场 / 购物 / mall / shopping → shopping; 博物馆 / museum, 公园 / park, 观景 / view; 地铁 / metro / muni /
轻轨 → lines; SFSU / SF State / 州大 / 旧金山州立 → sf-state-university; UCSF / 加大旧金山 → both UCSF campuses; 石镇 /
石头城 / Stonestown → the mall first, the farmers-market node second; station names zh + en. Ranking: exact alias >
prefix > word start > substring, tier bonus T1 −1.0, T2 −0.7, curated −0.6; results grouped 景点 / 车站 / 线路 / 地点 with
walking times; the empty state suggests "金门大桥 · 大学 · 石镇 · N 线".

**Lines and stations.** Lines and route polylines are drawn on the canvas under the badges with a cream casing 2 px
wider (as the cable lines today; contrast ≥ 3:1 on the paper). Stop dot: white 7 px with a 2 px line-colour ring;
transfer: a white pill holding 12 px letter discs (N M 叮当 观光); underground: the same with a small stair glyph. A tap
opens StationActions: "坐 N 线 → 海洋海滩 · 约 2 分钟", "带我去车站", "下一班 约 20 秒".

**Guidance on the map.** The active target is the gold pin-flag plus a route polyline: walk legs dashed gold 3 px, ride
legs solid 4 px in the line colour, board / alight points as white dots, an ETA chip at the target ("市政厅 · 步行 约 2
分钟"); BAYBAY's dot gets a pulsing gold ring while she leads; a 路线 button fits player + target; the list header shows
"当前：去市政厅 · 约 2 分钟 [结束]"; tour stops are numbered coral discs and finished legs grey out.

**Paper.** Apply H2b's `request-G1-cityMapDraw-paper.patch` if wave 3 did not; paper fog .82 → ≈ .7.

**Phone** (390 × 844 and 375 × 667, dpr 3, touch, quality mid): sheet snap 78, frame 46vh (≈ 388 px; 42vh ≈ 280 px at
667); chips right under the frame; the selected-place card between chips and list with one row of ≥ 44 px buttons
[跟 BAYBAY 去] [其他方式 ▾] [ⓘ] [↗]; TripOptions expand inline as 48 px rows; the ⓘ and 路线 buttons form a second small
tool column only when the frame is ≥ 340 px tall. **Perf:** ≤ 150 SVG nodes on desktop / 120 on phones at every scale;
stations become SVG only from s 0.45; layout memoised per view / filter / epoch in the existing rAF.

### 4.2 Guidance in the world and on the HUD (lanes G and C)

**Attraction flags** (lane G, `game/flags.ts` + `world/sf/flags.ts`). A toy flagpole over each T1: gold six-sided pole
(r 0.35 u), ball finial, pennant 7 × 4.5 u (4 × 1 segments) in the category colour with a cream glyph disc, waving in
the vertex shader (uTime); pole top = `flag.h` (skyline + 10 u, clamped 28–70 u; GGB on the south tower top + 8, City
Hall over the dome, Coit over the tower, de Young over the Hamon tower, low sites a 30 u pole). The pennant scales by
max(1, d / 300) so it stays ≥ 25 px on a 390 phone at 1,200 u; `fog: false`, `toneMapped: false`; alpha =
smoothstep(140, 200, d) × (1 − smoothstep(1500, 1800, d)); hidden within 60 u (the landmark itself reads there).
`pickFlags(player, cameraYaw, attractions, discovered, target, max)` (pure): the active target first (gold, up to the
3,000 u far plane; the existing light column stays for the last 150 u), then undiscovered T1 within 1,600 u and ±75° of
the camera yaw, nearest first, then all T1 during a panorama; **max 6 on desktop, 3 on phones / quality mid**;
discovered T1 lose their flag unless Settings › 显示地标旗 is on; changes fade over 0.4 s. One InstancedMesh (≈ 60 tris ×
≤ 16), **1 draw call, 1 program** (warm-up registered), glyphs from one 256² canvas atlas built from the lucide paths.

**Viewpoint panorama.** At Twin Peaks, the Coit top, the de Young tower, Grand View Park, Corona Heights and Bernal
Heights, on the first arrival (or E at the overlook) BAYBAY says "我指给你看！": every T1 / T2 in view within 2,000 u gets
its flag plus a projected DOM name tag for 10 s (max 8, collision-avoided; tap → trip options from here). The Twin
Peaks summit also switches on the postcard clue circles on the map (mirroring the district's Coit unlock).

**Trip pill.** During a trip, tour or ride the objective pill (top right) becomes "[mode icon] 下一站 名称 · 约 N 分钟"
with tour progress dots; ≤ 16 CJK on phones; tap → the trip card (bottom sheet, snap 40): legs with icons and times,
跳过这一站, 换个方式, 结束. Outside trips the Postcards / Goals pill is unchanged.

**Waypoint (edge compass).** Keep today's pin + name + time, with: time = remaining route length / 4.2 u/s on foot (or
the trip plan's remaining seconds), straight × 1.25 only without a path; safe area x ∈ [12, w − 12], y ∈ [72, h − 124]
on phones and [80, h − 120] on desktop, left of the dock; if BAYBAY's bubble intersects the label it drops below the pin,
then collapses to arrow + time (fixes M1 for good); tap on the edge arrow turns the camera to the target over 0.6 s
("转过去"); occluded on-screen targets draw at 70 % with a small "behind" notch; the soft free hint is suppressed during
trips, tours and panoramas and for 60 s after an arrival moment.

**Ground chevrons.** When the player walks manually (joystick / WASD) toward a trip target: 3 gold chevrons 2–6 u ahead
following the route's next 20 u (breadcrumb instancing); hidden while auto-walking (the breadcrumbs show then).

**Trip planner** (lane G, `game/tripPlan.ts`, pure with injected providers): `planTrips(from, place) → TripOption[] =
{ mode: 'walk' | 'run' | 'bike' | 'car' | 'line' | 'fly', legs: TripLeg[], seconds, note?, recommended? }`. Honest times:
walk = `routeTo` length / 4.2 ("计算中…" until the time-sliced A* returns; straight × 1.25 fallback); run = / 7.5, only
when the walk is over 90 s; bike / car only with one within 60 u: walk to it / 4.2 + drive-graph length / 6.5 (bike) or
/ 8.5 (car) + 3 s to mount; line = offered when both ends are within 150 u (walking) of stops on one line: walk + wait
(the system's ETA, dispatch caps it near 15 s) + ride (arc / average speed + dwells; underground at the compressed
speed) + walk; fly = discovered places only, 0.8 + 1.0 + clamp(d / 400, 0.6, 3.5) + ≈ 2 + 1.2 s, note "不算登顶 / 骑行成就".
Sorted by seconds, up to 4; 推荐 = the fastest non-fly option, or the one that completes an open goal ("顺便完成叮当车目标").

**带我去 → 跟 BAYBAY 去.** PlaceActions keeps 飞过去 (when discovered); 带我去 becomes **跟 BAYBAY 去** (primary) + **其他方式
▾** (TripOptions rows: icon · mode · time · 推荐). Example, Palace from the Ferry: 🚶 步行 约 4 分钟 · 🚲 骑车 约 2 分钟 ·
🚌 观光巴士 2 站 约 3 分钟 · 🐦 飞过去 约 6 秒. Choosing closes the sheet, sets `flow.trip` and nudges the camera so the
target's flag is in view.

**BAYBAY leads** (lane C's `flow.trip` + brain; lane G's actors). `flow.trip = { placeId, option, legs, leg, startedAt }`;
`objectiveTarget()` priority: freeLead > trip leg > tour > week > mapTarget > freeHint; `startFreeLead` becomes a one-leg
walking trip. On foot: today's `lead()` (graph routes, wait barks, hop-in). **Touch:** the LeadChip "自动跟上 BAYBAY" shows
from the start of every lead (tour, week, trips). **Bike / car:** she leads on foot to the rideable (if > 10 u), says
"上车吧", rides in the basket / front seat while `moveApi.driveTo` runs the route, points 20 u before turns > 45°, says one
line at 1/3 and at 2/3, hops out and leads the last ≤ 30 u; if the player steers, the autopilot stops and the waypoint
stays. **Lines:** she leads to the boarding stop, boarding opens pre-filled, she rides along, names the stop on approach,
hops off first and leads the last walking leg. **Fly:** the pelican carries both (unchanged).

**Arrival moments** (lane C triggers, lane G shows). Trigger: the first arrival within max(12, radius) u of a T1 / T2
arrival anchor, on foot or right after hopping off, with no dialogue or panel open. Beats: a gold toast larger than the
discovery toast ("抵达 · 艺术宫 Palace of Fine Arts") with the stamp sound; BAYBAY's line (the card's bark); for T1 on foot
a 2.4 s reveal camera from `SfLandmarkInfo.photo` (skippable, never replays, off under reduced motion / quality low); a
peek card 72 px above the PhoneBar (bottom-left on desktop) with photo thumb, name, [看介绍] [拍照] [下一站] (6 s); with an
unfound postcard within 60 u BAYBAY says "这附近藏着一张明信片哦" and the glint brightens; a journal stamp and a Footprints
entry; the place becomes discovered (fly unlocked).

**Anti-spam.** At any time at most: 1 waypoint, the flags (≤ 3 on phones), BAYBAY's bubble and 1 toast. Flags carry no
text; the panorama tags are the only in-world names and last 10 s.

---

## 5. Lanes

### 5.0 Day 0 (the lead, before the lanes start)

- **W4-0a frozen contracts:** the `core/events.ts`, `world/sf/format.ts` changes of §3.7; `core/store.ts` `tour.id`
  (default `'first-lesson'`); new frozen `game/tripTypes.ts` (`TripMode`, `TripLeg`, `TripOption`, `TripState`) and
  `data/sf/attractionTypes.ts` (`AttractionCat`, `AttractionRank`, `Attraction`); `game/flowStore.ts` gains
  `trip: TripState | null` (then owned by lane C).
- **W4-0b frozen tests:** `sf-data` line-id pin relaxed as in §3.7; `contracts` pins the new hooks (TransitKind values,
  `tour.id` default, the trip / attraction types exported, FIRST_TOUR unchanged); `sf-format` covers the new optional
  fields; `district` unchanged.
- **W4-0c protocol:** worktrees `C:/Users/willy/wt/w4-<lane>` on `w4-<lane>` from `origin/opus-bay`, `node_modules`
  junctions, ports **V 5201 · L 5202 · G 5203 · T 5204 · P 5205 · C 5206 · verify 5210** (5174 / 4174 stay the lead's),
  the wave-4 lead note `docs/opus-bay/sf-w4-lead.md` (ownership = §5.1, credit caps = §6), this plan and
  `sf-w4-attractions.json` committed under `docs/opus-bay/`. Checks, commits and pushes exactly as `sf-w3-lead.md` §3.

### 5.1 Ownership in wave 4 (OB = `src/opus-bay`; every lane also owns its report `docs/opus-bay/sf-w4-<LANE>.md`, its ledger `docs/opus-bay/ledger/w4-<LANE>.md` and `docs/opus-bay/qa/w4/<LANE>/`)

| lane | inherits (wave-3 owner) | owns | new files it creates |
|---|---|---|---|
| **P · Places & map** | G1 (map part) | OB/data/sf/places.ts, OB/data/cityZones.ts, OB/ui/{CityMap,cityMapDraw,MapPanel,PlaceActions,Footprints,TitleScreen,WeekPanel,common,hooks,mapLabels}.ts(x), OB/ui/city-ui.css, OB/game/{discovery,fastTravel,placeTrips,travel,qa,resume,streets}.ts, scripts/opus-sf/lib/places.ts, public/opus-bay/sf/v1/places.json, tests/opus-bay-sf-{citymap,discovery,places,travel}.test.ts | OB/data/sf/{attractions,extraPlaces}.ts, OB/ui/{MapLegend,MapFilters,TripOptions,StationActions}.tsx, OB/ui/mapLines.ts, scripts/opus-sf/places-sidecar.ts, tests/opus-bay-sf-attractions.test.ts |
| **T · Transit lines** | F | OB/game/{ride,transit}.ts, OB/data/transit.ts, OB/world/{streetcar,cablecar,ferry,rails,turntable,transitLine,transitLayer,life}.ts, OB/world/sf/{crowd,traffic}.ts, OB/actors/platform.ts, OB/audio/**, scripts/opus-sf/lib/transit.ts, public/opus-bay/sf/v1/transit.json, tests/opus-bay-{audio,sf-transit,sf-life}.test.ts | OB/world/{busSystem,lightRail}.ts, OB/world/sf/{tourBus,lrv,stations,portals}.ts, OB/data/sf/stationNames.ts, OB/ui/SubwayOverlay.tsx, OB/ui/transit-ui.css, scripts/opus-sf/lib/busLoop.ts, scripts/opus-sf/transit-sidecar.ts, tests/opus-bay-sf-{bus,metro}.test.ts |
| **L · Landmarks & streets** | D2 (minus the asset pipeline) | OB/world/sf/sites.ts, OB/world/sf/landmarks/**, OB/data/sf/{landmarks,routes}.ts, OB/world/{models,modelMaterial}.ts, OB/world/sf/{kitSwap,l0index,dress,swap}.ts, OB/core/sfTerrain.ts (additive), scripts/opus-sf/routes-qa.mjs, tests/opus-bay-sf-{landmarks,models,kit-swap,routes,landmark-context}.test.ts | one module per new site under OB/world/sf/landmarks/, scripts/opus-sf/sites-qa.mjs, tests/opus-bay-sf-sites-w4.test.ts |
| **G · Guidance, HUD & ride feel** | E2 + G1 (HUD part) | OB/actors/** except platform.ts (T) and {npcs,residentLooks}.ts (C); OB/core/{input,terrain,walkGraph}.ts (additive), OB/data/vehicles.ts, OB/data/sf/rideSpots.ts, OB/ui/MoveChip.tsx, OB/game/{Systems.tsx,cinema.ts}, OB/ui/{Hud,Floating,Overlay,CoachMark,Settings,icons}.tsx, OB/opus-bay.css, OB/OpusBayPage.tsx, tests/opus-bay-{actors,sf-move2,sf-modes,sf-vehicles,sf-nav}.test.ts | OB/game/{tripPlan,flags}.ts, OB/world/sf/flags.ts, OB/actors/reveal.ts, OB/ui/{TripPill,ArrivalCard,PanoramaTags}.tsx, OB/ui/guide-ui.css, tests/opus-bay-sf-{trip,flags,waypoint}.test.ts |
| **C · Content & tours** | G2 + G1 (flowStore, save) | OB/game/{flow,brain,content,interactables,photo,projector,cityContent,cityGoals,residentTasks,baybayLines,flowStore}.ts, OB/data/{postcards,script,pois,tours,catalog,links,contentMode,VOICE.md,save}(.ts), OB/data/sf/{cityPois,copy,dialogue,goals,lines,postcards,residents}.ts, OB/actors/{npcs,residentLooks}.ts, OB/ui/{Journal,Moments,PoiCard,Dialogue,EventCard,format}.ts(x), OB/i18n.ts, tests/opus-bay-{content,flow-brain,flow-data,flow-logic,sf-content,sf-lines,sf-tasks,sf-save}.test.ts | OB/data/sf/{placeCards,placeCards2,tours,tourLines}.ts, OB/game/{arrival,trips}.ts, OB/ui/TourRecap.tsx, tests/opus-bay-sf-{tours,cards}.test.ts |
| **V · Visual assets, voice & performance** | C2 + H2b + D2 (asset pipeline) | C2's files (OB/world/{materials,warmup,environment,palette,post,world,WorldScene,water,backdrop,ground,props,fx,labels,clock,city,builder,typedBatch,landmarks}.ts(x), OB/world/recipes/**, OB/world/sf/{build,far,worker,stream,cell,props,hero,pools,water,stats,raster,mesh,look,fog,lights,boards,cloudBank}.ts, OB/game/GameRoot.tsx, vite.opus.config.ts, scripts/opus-sf/qa/**, the C2 tests incl. hero regression and world); H2b's files (OB/data/{mapPaper,murals,voiceLinesSf}.ts, OB/ui/{mapPaper.ts,MapPaperLayer.tsx}, OB/world/sf/murals.ts, scripts/opus-sf/{map,murals,voice}/**, public/opus-bay/{map,murals,voice}/**, tests/opus-bay-h2b-assets.test.ts); D2's asset pipeline (OB/data/assets.ts, public/opus-bay/models/**, scripts/opus-sf/assets/**, docs/opus-bay/kit-jobs/**) | public/opus-bay/map/stickers-t1.{webp,json}, public/opus-bay/models/sf/w4-*.glb, scripts/opus-sf/qa/perf/w4-spots.json |
| **frozen** (lead only) | — | OB/core/{types,store,events,runtime,geo}.ts, OB/world/sf/format.ts, OB/data/district.ts, OB/game/{systemsRegistry,tripTypes}.ts, OB/data/sf/attractionTypes.ts, tests/opus-bay-sf-disk.ts, tests/opus-bay-sf-{format,data,geo,terrain}.test.ts, tests/opus-bay-{district,contracts}.test.ts, OB/ASSETS-LEDGER.md, OB/{DESIGN,STATUS,RESUME}.md, package*.json, vite.config.ts | — |

A file not listed: the lane whose subject it is; if unclear, frozen (write the change under Requests). Tests that pin
another lane's module follow the wave-2 rule (`sf-w2-contracts.md` §2 table): do not edit them, write the change under
Requests. Counts that wave 4 changes on purpose: 24 landmarks / cards (`sf-content`, `sf-places`) → C and P update their
own tests; 37 off-graph places → P; 20 postcards → C (only if the optional 4 postcards ship); the transit line set →
day 0.

### 5.2 Lane P · Places & map

Ordered tasks:
1. **W4-P1** Label bug (verify / fix, §4.1) with the own-marker regression test; push first.
2. **W4-P2** `attractions.ts` from `sf-w4-attractions.json` + the existing landmarks / famous curated places: 16 T1, ≈ 45
   T2, T3; cats, short names, fame, aliases, photo keys, `flag` values from lane L's `siteFlagTop()` (placeholder heights
   until L pushes); push early (L, G, C consume the ids).
3. **W4-P3** `extraPlaces.ts` (47 rows) + name fixes + re-anchors + the dropped duplicate; `poiKind` for campus /
   shopping / zoo; `places-sidecar.ts` rebuilds places.json only, deterministic, no removed ids (diff report).
4. **W4-P4** Tier badges, categories, states, absolute-scale visibility (§4.1).
5. **W4-P5** Labels (4 positions, priorities, short names, fonts) and clusters (+n pips, tap-to-zoom).
6. **W4-P6** Framing (SF-land fit, smart first open) + compass rose.
7. **W4-P7** Lines and stations from `transitData()` (loop, N, M, cables, F), station symbols, StationActions; stations
   in the place index (search, discovery at 12 u, fly once discovered).
8. **W4-P8** Filter chips, legend sheet, tabs 景点 · 线路 · 附近 · 去过的, grouped list with photo thumbs.
9. **W4-P9** Search aliases, tier-aware ranking, grouped results, empty-state suggestions.
10. **W4-P10** Guidance on the map: target pin-flag, route polyline from `flow.trip`, ETA chip, BAYBAY pulse ring, 路线
    button, trip header, numbered tour stops.
11. **W4-P11** PlaceActions: 跟 BAYBAY 去 + 其他方式 ▾ → TripOptions (lane G's `planTrips`), full-width title (no
    truncation), phone layout.
12. **W4-P12** Paper patch (if needed), fog .7, line contrast on paper, T1 sticker sprites from lane V.
13. **W4-P13** Footprints tab (if wave 3 left it a stub): counts (地标 x / N, 地点, 街区, 线路 坐过的), the tour recap map
    API used by lane C.
14. **W4-P14** Tests, shots, report.

Acceptance: `sf-citymap` (the own-marker regression; the 4-position fallback; T1 labels never lose to T2 / T3; at
352 × 388 with the SF-land fit ≥ 11 T1 labels, no overlapping label boxes, cluster pips counted), `sf-attractions`
(exactly 16 T1, short names ≤ 5 CJK / 14 Latin, every T1 / T2 has a cat and a walkable arrival or an offWalk reason —
alcatraz, bay-bridge, treasure-island — and `flag.h` in 28–70; the 7 campus / Stonestown / Stern Grove rows exist),
`sf-places` search ('大学' → ≥ 4 campus results with SF State first; 'Stonestown' / '石镇' → the mall first; 'SF State' /
'SFSU' / '州大' → SF State; 'N 线' / 'muni' → the line rows; map names equal card names), `sf-discovery` (stations),
`sf-travel` (fly to a discovered station); ≤ 150 / 120 SVG nodes at every scale (a node-count test on a synthetic
index); district SVG map unchanged. **Shots** (`docs/opus-bay/qa/w4/P/`): phone 390 × 844 dpr 3 with the paper — SF-land
fit (ux-w4-map-phone-fit.jpg), first open at the Ferry (…-open.jpg), 校园 filter (…-campus.jpg), search 大学
(…-search.jpg), Palace selected with TripOptions (…-trip.jpg); the same five at 375 × 667; desktop 1440 × 900 SF fit,
线路 tab with N highlighted, mid-trip route + ETA, legend sheet.

### 5.3 Lane T · Transit lines

1. **W4-T1** Pipeline: N (3435877, cut at Embarcadero) and M (3433314) in `LINES` with kind, short, colours, `tunnels`,
   stop zh glosses (`stationNames.ts`), underground heights not from terrain.
2. **W4-T2** `busLoop.ts`: bake `sf-loop` from the 16 anchors of §3.2 (port `plan/loop-final.mts`), forced
   exclusions (JFK Promenade east of Transverse, the Upper Great Highway south of Lincoln, the Twin Peaks north gate),
   hero spans on `DISTRICT.roads`, the two hero platforms, the Chula Lane jog smoothed, heights from the terrain.
3. **W4-T3** `transit-sidecar.ts` → transit.json (deterministic, chunks untouched); push early with stable station ids
   (P draws, C builds the tour against them).
4. **W4-T4** `data/transit.ts`: bus and light-rail lines, dwell policy (loop every stop 8 s; LRV major 4 s, minor on
   request), station merge with zh names, tunnel spans exposed.
5. **W4-T5** `BusSystem` (§3.2 sim: speeds, dwell, 3 buses, dispatch ≤ 15 s, crossing interlocks).
6. **W4-T6** `LightRailSystem` (§3.3: surface 10 / 12 u/s, major-stop dwell, request stops, virtual underground at 25 u/s,
   portal hand-over, shared Market St stations, dispatch, double-ended reversal).
7. **W4-T7** Toy vehicles: `tourBus.ts` (≤ 1.2k tris, 1 call, far version, seat spots on `platform.ts`), `lrv.ts`
   (≤ 1k per train, 1 call); night lamps; warm-up registration.
8. **W4-T8** Stops, kiosks, platforms (`stations.ts`, instanced, 1 call) and the 4 portals (`portals.ts`: Duboce, Sunset
   east, Sunset west = landmark quality, West Portal; ≤ 800 tris each, walk blockers, rail ramp).
9. **W4-T9** Boarding: `lineChoices`, the pre-filled `boardLine(stationId, { to })` for trips / tours, interactables and
   verbs (上观光巴士 / 坐 N 线 / 坐 M 线).
10. **W4-T10** Riding: generic `ride.ts` kind, `rideLabel` icons and texts, `requestNextStop()` (下一站下车), 直接到站 veil for
    legs > 400 u, 提前下车 rules (disabled underground).
11. **W4-T11** Subway overlay + portal cut (`whenReady(exit, 150)`, 8 s cap) + streamer prefetch ahead of every moving
    ride (next 200 u of path).
12. **W4-T12** Events (`transit` approach / arrive / depart with line, station and the stop's attraction id) for lane C's
    narration; `noteRide` per line id; the metro goal detector data.
13. **W4-T13** Audio (§3.6).
14. **W4-T14** Budget pass: vehicles + transit ≤ 8 calls / 20k tris in the densest view; hide beyond 300 u.
15. **W4-T15** Tests, shots, report.

Acceptance: `sf-transit` / new `sf-bus` + `sf-metro` (the line-id set gains the 3 ids; tunnel spans exist and are
ordered for N and M; loop continuity last → first; every stop of interest has a zh gloss; bus headway, dwell and
dispatch ≤ 15 s; ride-time estimates within 15 % of the sims; hop-off disabled underground; the hero F-line loop and the
district `rideLabel` strings unchanged); ride stability on the phone profile (4× CPU): no hitch > 100 ms at a portal cut.
**Shots:** bus upper deck on the Palace approach with narration (ux-w4-bus-deck.jpg), the RideBanner on a phone, the
subway overlay with the strip diagram (phone), the N surfacing at Duboce, the N at the Sunset Tunnel west portal, the M at
19th & Winston with Stonestown, a Market St kiosk, a loop stop pole, night bus.

### 5.4 Lane L · Landmarks & streets

1. **W4-L1** Registry work: per-site `lod0R`; `siteFlagTop(id)` helper in `landmarks/context.ts` (push early for P / G);
   new-site records carry geometry, poses and `placeId` (text comes from lane C's cards; a test checks every new site has
   one); plaza kit helpers (ground polys, benches, lamps, bollards, bins, planters, trees, crosswalk stripes).
2. **W4-L2** P1 sites (§2.3 step 1) with their 21–42 u settings; the M platforms at 19th Ave coordinate with lane T.
3. **W4-L3** P2 sites (§2.3 step 2) with settings; downtown diet; the Cal Academy procedural fallback first.
4. **W4-L4** AI swaps as lane V delivers (St Ignatius, Cal Academy, Holy Virgin, Chinese Pavilion; conditional Tea
   Garden pagoda / Old St Mary's) through the SoloView decision gate (`?solo=<id>&ai=0|1`), walk data authored to the
   shipped layout.
5. **W4-L5** P3 sites (§2.3 step 3) in order, each finished with its settings before the next.
6. **W4-L6** Gated downtown: the Chinatown pagoda cluster only with lane V's ≥ 10k headroom number; otherwise
   leave it card-only (lane C) and record why.
7. **W4-L7** Walk data: blockers and surfaces for every site, arrivals reachable, the Blue Heron bridges, the Pier 45
   deck anchor, (P4) the Wave Organ jetty strip.
8. **W4-L8** `sites-qa.mjs` (8 samples on a ring around each new site: calls, tris, programs, landmark-on-screen
   fraction, a JPEG each) + SoloView sheets for every new site; D2-11 routes if wave 3 did not finish them.
9. **W4-L9** P4 sites (stretch).
10. **W4-L10** Tests, shots, report.

Acceptance: `sf-landmarks` / `sf-landmark-context` / new `sf-sites-w4` (bounds inside exclusions; plaza ≥ 30 u²;
arrival reachable; walk-around ring ≥ 75 %; street continuity through every exclusion; every new site has a card and a
`placeId`; lod-0 tris within its tier or diet cap; no text / logo meshes — a name check on materials), the §2.6 view
table re-measured by lane V after each batch. **Shots:** for each P1 / P2 site a golden-hour and a night shot at street
height plus one from 60 u up (the 150–300 m setting visible); Stonestown with the M at Winston; SF State quad; UCSF
against Mt Sutro; St Ignatius from the Haight; the Music Concourse (de Young + Cal Academy + Tea Garden); Union Square;
the Zoo entrance; the Ocean Beach west end.

### 5.5 Lane G · Guidance, HUD & ride feel

1. **W4-G1** `tripPlan.ts` (§4.2), pure with injected providers; push first (P and C consume it).
2. **W4-G2** Waypoint changes (route time, safe areas, bubble avoidance = M1, edge-arrow turn, occluded notch, hint
   suppression).
3. **W4-G3** TripPill + trip card; RideBanner 2-row phone layout with 下一站下车 / 直接到站 / ⋯.
4. **W4-G4** BAYBAY rides along (basket, front seat, bus deck, LRV) and leads by vehicle (points, 1/3 and 2/3 lines,
   last ≤ 30 u on foot, steering takes over); the rider side of 下一站下车.
5. **W4-G5** LeadChip for every lead on touch + one-time coach mark ("点箭头转向目标 · 点「自动跟上」就不用一直按").
6. **W4-G6** Ground chevrons.
7. **W4-G7** Flags (`pickFlags` + instanced mesh + atlas + Settings toggle), warm-up registered.
8. **W4-G8** Panorama tags at the six viewpoints.
9. **W4-G9** Ride cameras: bus deck with the 4 s look-at bias, LRV chase with portal-emergence framing; the 直接到站 veil
   hook.
10. **W4-G10** Arrival reveal camera + ArrivalCard (listens to lane C's `arrival` event).
11. **W4-G11** HUD at 390 × 844 and 375 × 667: no overlaps between trip pill, toasts, waypoint, bubble, arrival card,
    ride banner, PhoneBar.
12. **W4-G12** Tests, shots, report.

Acceptance: `sf-trip` (walk = length / 4.2; a line option only when both ends are within 150 u of stops on one line and
it includes walk + wait + ride + walk; fly only when discovered; sorted; 推荐 = fastest non-fly or the goal one; bilingual
labels), `sf-flags` (target first, ≤ max, none within 60 u, discovered T1 excluded unless the setting is on, only within
±75° of the yaw), `sf-waypoint` (pure layout: at 390 × 844 and 375 × 667 the pin and label stay in the safe area and never
intersect a docked bubble), `actors` / `sf-modes` green; flags cost ≤ 1 call and ≤ 1 program (with vs without).
**Shots:** flags from the Ferry Building looking west (≤ 3 on the phone), Twin Peaks panorama tags, the gold target flag
over the downtown towers from the Embarcadero, edge arrow + BAYBAY bubble at 390 and 375, BAYBAY leading on foot with
chevrons, in the bike basket pointing at a turn, at a bus stop with the pre-filled boarding, the SF State arrival card
(phone).

### 5.6 Lane C · Content & tours

1. **W4-C1** Trip state machine in flow (`flow.trip`, `startTrip`, `objectiveTarget` priority, `tripLegArrived`,
   `startFreeLead` as a one-leg trip, per-leg `lead()`, pre-filled boarding through lane T); push early.
2. **W4-C2** Tour engine generalisation (`CityTourDef`, `game.tour.id`, active-tour `tourStops` / intro / outro,
   `stopSubject` / `stageMark` from `SfLandmarkInfo.photo`, save v2 `tours`, resume by chapter); FIRST_TOUR byte-identical.
3. **W4-C3** `tourLines.ts`: 16 loop stops × { approach, arrive, hopOffTip }, ≈ 12 Metro lines (tunnel entry, portal
   emergence, UCSF from the window, the Stonestown / SF State approach), 5 chapter intros + outros, the arrival barks for
   new T1 / T2, quiet lines for memorials; the glossary additions in VOICE.md. **Freeze** it (tag the commit) for lane V.
4. **W4-C4** `sf-grand` data (§3.5) with every leg resolving (`place:<id>` / `transit-<station>`), moments, the express
   variant; TourRecap panel (lane P's map API).
5. **W4-C5** Cards (`placeCards.ts`, `placeCards2.ts`, lazy): full cards for all P1–P3 attractions and short cards for
   P4, from `sf-w4-attractions.json` (summary, cautious hours / cost, 2–3 tips, all sources, officialUrl, BAYLINK
   guide / planner ids when they exist — `sf-golden-gate-bridge-fort-point-guide`, `golden-gate-park-free-car-free-day-guide`,
   `presidio-picnic-day-guide`, `bay-area-without-car-guide` for the lines — the licensed photos for sf-state,
   stonestown, ucsf-parnassus, ucsf-mission-bay); cards for the famous curated places without one (Alcatraz, Golden Gate
   Park, Presidio, Crissy Field, PIER 39 umbrella); the refreshes of §2.5; `cityPois` joins landmark info + cards.
6. **W4-C6** Arrival moments (`game/arrival.ts`, §4.2) and the `arrival` event; panorama trigger at the six viewpoints.
7. **W4-C7** Entry points: city welcome choice 1, call menu items, 附近有什么 with stations.
8. **W4-C8** Goals sightseeing / metro / campuses (§3.6), waypoint targets; tests updated on purpose.
9. **W4-C9** (optional, with lane V) 4 new SF postcards → the city shows 24.
10. **W4-C10** Tests, shots, report.

Acceptance: `sf-tours` (FIRST_TOUR unchanged = hero regression; every `sf-grand` leg resolves; the save v2 `tours`
decoder clamps and validates untrusted input; `game.tour.id` defaults to `'first-lesson'`), `sf-cards` (every new
attraction has a card with `sourceUrl` + `verifiedAt` + ≥ 1 source; no card mentions pandas, Hastings or the
Rivera mural as on show; zh ≤ the card length limits), `flow-*` (objectiveTarget priority with a trip; the soft hint
suppressed during trips and for 60 s after an arrival; LeadChip for trips on touch), `sf-content` counts updated;
the Grand Tour played end to end in express mode in 18 ± 3 min (scripted run with `?qa` skips, measured by the lead).
**Shots:** the tour intro dialogue, a hop-off moment at the Palace, the Stonestown arrival, the SF State campus moment,
the recap map (ux-w4-grand-recap.jpg), a new card on the phone (SF State), the goals card with the 3 new goals.

### 5.7 Lane V · Visual assets, voice & performance

1. **W4-V1** Baseline on the wave-3 head: the six perf spots + the five new ones (Union Square, Civic Center, Music
   Concourse, Stonestown / SF State, Haight / USF) + moving rides (bus deck at the Palace approach, N at Duboce, M at West
   Portal) → a table in the report; publish the headroom numbers (the Chinatown gate for lane L) in the first push.
2. **W4-V2** Higgsfield preflight (balance, transactions mark, CDN, upload) and `ledger/w4-V.md`.
3. **W4-V3** Reference sheets (§6 H-4) → lanes T and L.
4. **W4-V4** AI meshes (§6 H-1 / H-2): concepts → SAM 3D → cleanup → QA gate → Draco GLB + mask WebP → `data/assets.ts`
   → lane L swaps; stop rules of §6.
5. **W4-V5** T1 sticker sheet → sprites + atlas JSON → lane P.
6. **W4-V6** Voice for lane C's frozen `tourLines` (qwen_audio_tts, the Pixie preset, 3 seeds, trim, loudnorm −18 LUFS /
   TP −1.5, m4a + ogg), the owner listening sheet, `MUTED_CLIPS`, registered in `voiceLinesSf`.
7. **W4-V7** (optional) 4 postcards with lane C; generated SFX only if lane T's synthesis sounds cheap.
8. **W4-V8** Performance work for the new content: warm-up for every new program (flags, bus, LRV, portals, AI parts),
   one material instance per object kind (the P2 rule), the Salesforce crown glow in the night light field, streamer
   prefetch support for moving rides, new code lazy in the city chunk (GameRoot ≤ 250 KB gzip).
9. **W4-V9** The perf gate after each batch of lane pushes and at the end (acceptance below).
10. **W4-V10** Shots, report, ledger.

Acceptance (the wave's global gate, run by V and re-run by the lead): **≤ 150 draw calls and ≤ 400k tris (shadows
included) at quality high** in all 11 spots on the owner's RTX at 1440 × 900; **phone profile 390 × 844, dpr 3, quality
mid, 4× CPU: ≥ 45 fps** walking in the six old spots and riding the bus and an LRV; `programs` equal at 1× idle and 4× walk
(no drift); no frame > 100 ms at portal cuts or on the first touch; GameRoot ≤ 250 KB gzip; `tsc` 0, `eslint` 0, all
opus-bay tests green, **hero regression green and district mode unchanged** (the district before / after contact sheet:
Ferry gate, Coit, PIER 39, night).

### 5.8 Order, timing and the final verify

- Day 0 (lead) → all six lanes in parallel (disjoint files).
- **Push early** (first commits): G `tripPlan.ts` API; C `flow.trip` + `startTrip` + objectiveTarget; T transit.json with
  the three lines and stable station ids; P `attractions.ts` + `extraPlaces.ts` ids; L `siteFlagTop` + `placeId`s and the
  procedural fallbacks; V the baseline and the downtown gate numbers; C freezes `tourLines` before V records voices.
- Mid-wave: V's AI meshes land → L swaps; V re-measures after each lane batch and posts the table in its report.
- **Final verify (lead, W4-Z):** rebuild the phone package; the perf table (11 spots + rides) on the RTX and the iGPU;
  phone checks at 390 × 844 and 375 × 667 (map, trip, bus ride, subway overlay, arrival); the Grand Tour express timed
  end to end (18 ± 3 min) and the full tour once (≈ 26 min); district regression; three read-throughs of every lane
  report against this plan (the owner asked for triple checks); `docs/opus-bay/sf-w4-summary.md`; merge the ledgers
  into ASSETS-LEDGER; update STATUS / RESUME.

---

## 6. Higgsfield plan

Balance after wave 3: ≈ 170 (wave-3 caps; the lead confirms with `balance` + `transactions` at day 0). The owner allows
using it for quality. **Wave-4 cap 120, expected ≈ 79; keep ≥ 50 for the final polish.** All jobs go through lane V and
its ledger (`docs/opus-bay/ledger/w4-V.md`, the ASSETS-LEDGER columns), `balance` before and `transactions` after every
batch (the account is shared: attribute by job id and time).

| # | asset | model / settings | credits (expected / worst) | fallback |
|---|---|---|---|---|
| H-1 | AI landmark meshes: **Cal Academy** (living roof, two domes, glass canopy), **St Ignatius** (twin spires + dome), **Holy Virgin Cathedral** (gold onion domes), **Chinese Pavilion** (Blue Heron Lake) | 2 concepts each: nano_banana_pro 1:1 2k (2 each), style ref K6, "toy diorama, no text, no base, whole building in frame"; SAM 3 3D textured (1) on the better concept, a second SAM if the first fails the gate | 4 × (4 + 1.5) = **22** / 24 | the procedural version (built first, always shippable) |
| H-2 | conditional: Japanese Tea Garden pagoda + drum bridge; Old St Mary's (only if the Chinatown gate passes) | same recipe | **6** (one of them) / 12 | procedural (Peace Pagoda roof kit; brick nave + clock tower) |
| H-3 | 3D retake reserve | new concept pair (4) or SAM retakes (1–2); **Meshy image_to_3d (30) only for Cal Academy** and only if SAM fails twice | **10** / 40 | procedural |
| H-4 | reference sheets for procedural builds (art targets, not shipped): toy open-top double-decker, toy two-car LRV, Stonestown mall, SF State student centre, UCSF on Parnassus, an N Judah tunnel portal | nano_banana_pro 2k × 6 | **12** / 14 | licensed photos in `src/data/sf-landmark-photo-assets.json` (sf-state, stonestown, ucsf-parnassus, ucsf-mission-bay are already licensed) |
| H-5 | map: **no repaint needed** (paper v1 covers the whole board, including the new areas); a sheet of 16 illustrated T1 stickers in the gouache style for the T1 badges | nano_banana_pro 1:1 4k × 2 draws (4 each) | **8** / 8 | lucide glyph badges |
| H-6 | voice: ≈ 110 new lines (16 loop stops × arrive + hop-off tip, 12 Metro, 10 chapter intros / outros, ≈ 40 arrival barks, station names for the overlay) × zh + en × 3 seeds ≈ 660 jobs | qwen_audio_tts, Pixie preset (≈ 0.01 each, as H2b-7) | **7** / 8 | the text bubble + chirp (today's behaviour) |
| H-7 | optional: 4 new postcards (the N Judah at Ocean Beach at sunset, the Tea Garden pagoda, the Tiled Steps, the SF State quad at golden hour) | nano_banana_pro 4:3 2k, refs P5 + P13, 1.75× retake factor | **14** / 14 | skip (the city keeps 20) |
| H-8 | optional generated SFX (bus air brake, LRV gong, door chime) | only if the synthesized ones sound cheap | **0** / 5 | synthesis |
| | **total** | | **≈ 79 / 125 → capped at 120** | |

Stop rules: reject a concept with text, a base / plinth or clipped edges before paying for 3D; two failed landmarks in
a row → stop AI meshes, everything procedural; spend passes 100 → only H-1, H-5 and H-6 continue. QA gate (plan §8):
silhouette IoU ≥ 0.85, < 1 % non-manifold edges, ≤ 3 islands, ≥ 80 % texels within ΔE 12 of the palette after grading,
readable at 64 px in an in-game shot; Draco (level 6) + WebP q82; size ≤ 250 KB per hero GLB.

---

## 7. Risks and open questions (answered with a default)

The owner said not to wait for approval: each item has the default the lanes follow; the lead notes any change in the
wave-4 lead note.

| # | question / risk | default |
|---|---|---|
| R1 | Places inside the frozen hero slab (Sentinel, Saints Peter and Paul on hero lot 211, SS Jeremiah O'Brien at Pier 35, the Salesforce Park deck across the seam, Jack Kerouac Alley). | Cards + map badges now; models wait for a later hero-data change (heroDropLots) and are listed in the summary. |
| R2 | Downtown triangles: Chinatown was 432k at the wave-1 table and wave 3 is only asked to reach ≤ 400k. | The downtown diet of §2.2; the Chinatown pagoda cluster only with ≥ 10k measured headroom; otherwise card-only. Lane V's numbers decide, not estimates. |
| R3 | Unmeasured new views (Music Concourse +21.5k, Haight / USF +14.9k). | V measures bases first; over 395k → Cal Academy ≤ 4k, AI church ≤ 4k, strips lod0R 150. |
| R4 | Does riding the bus to Twin Peaks count for the twin-peaks goal (on foot / bike / car only)? | Detector unchanged; BAYBAY leads the last ≈ 40 u from the summit lot to Christmas Tree Point on foot, so it counts honestly. |
| R5 | Real tunnels vs a veil. | Veil (subway overlay) for all tunnels in wave 4; no underground geometry; a real dark tube for the 180 u Sunset Tunnel is a later polish. |
| R6 | The N's King St part (Caltrain, Oracle Park, its Embarcadero portal inside the hero). | Cut at Embarcadero in wave 4; later with a hero change. |
| R7 | More Metro lines (T Third to UCSF Mission Bay / Chase Center, L Taraval to the Zoo, K to CCSF). | Wave 5 candidates; the Zoo, Lake Merced, UCSF Mission Bay and CCSF are reached by walking, bike, car or fast travel for now (TripOptions shows the honest times). |
| R8 | Car-free streets on the bus route (JFK Promenade, the Upper Great Highway = Sunset Dunes, the Twin Peaks north gate). | Excluded in the bake (measured route uses Lincoln Way / Crossover Dr); the Sunset Dunes card is neutral because Prop G (3 Nov 2026) may reopen it to cars on weekdays — re-check after the election. |
| R9 | Closures and changing facts (Portsmouth Square to 2028, Hyde Street Pier, the Cliff House, the Rivera mural, MoAD, the Twin Peaks Promenade, the Tenderloin Museum's move, CCA closing, pandas at the Zoo). | Cards state the checked status (2026-09-27) with "出发前查官网确认"; closed places show fences, never the missing thing; the lead re-checks the time-sensitive cards in the final verify. |
| R10 | Brands and trademarks (Stonestown Galleria, Salesforce, Disney, Lucasfilm, Boudin, stadium teams, Muni). | Names in card text only; no logos, signs or store names; generic bus and LRV liveries; line letters and colours are factual. |
| R11 | zh names for stations (SFMTA's own Chinese names differ in places, e.g. 卡斯楚 / 雲尼斯). | English stays primary as on the real signs; our glossary gloss (卡斯特罗站, Van Ness in English); lane C checks SFMTA's Chinese station list once and records differences in VOICE.md. |
| R12 | Is a 25-minute tour right for welcome choice 1? | Yes, with the subtitle "全城 5 章 · 约 25 分钟 · 随时下车", resume by chapter and the 18-minute express; Bay 101 stays in the call menu as the short waterfront option. |
| R13 | Performance on phones while riding at 12 u/s (streaming ahead). | Prefetch the next 200 u of path; the far versions of vehicles; 直接到站 veils legs > 400 u; the subway overlay streams nothing; quality mid on touch devices (wave-3 P4). |
| R14 | Test counts pinned to 24 landmarks / 20 postcards / 7 goals / the line set. | Updated deliberately by the owning lane (§5.1); frozen pins relaxed at day 0. |
| R15 | Scope: 124 new attractions is a lot for one wave. | Cards for all 124 are required; models follow the priority order; P4 models are stretch and roll to wave 5 if time runs out (listed in the summary). |
| R16 | A new places / transit data build could change the chunks and the hero regression. | Sidecars write only places.json and transit.json; no chunk rebuild in wave 4 (the Metro rails are already in the chunks). |
| R17 | Six parallel lanes on one machine (fps noise, Chrome slots). | As wave 3: at most 2 headless Chromes per lane; fps numbers only from lane V's gate runs and the lead's final verify. |
| R18 | Voice quality of ~660 generated clips. | The owner listening sheet; muted clips fall back to the text bubble + chirp; nothing blocks on voice. |
| R19 | Wave-3 items this plan assumes (label bug fix, M1, F7 F-line to the Castro, D2-11 routes, the Footprints tab). | Each wave-4 lane first checks what wave 3 delivered and turns the matching task into "verify and keep" (P1, G2, P13, L8). |
