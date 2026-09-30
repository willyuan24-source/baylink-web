# Wave 7 · lane R · places: enough information, true to life

Lane R of wave 7 (worktree `C:/Users/willy/wt/w7-r`, branch `w7-r`, dev port 5713). Brief: `sf-w7-lead.md` §7 row R.

## 给主人的摘要

1. 把地图上最有名的 48 个地方在游戏里逐个拍照，和维基共享资源的真实照片并排比对，打了「颜色 / 比例 / 标志性特征」三项分数，做成一张评分表（`sf-w7-R-realism.md`），V 线据此挑哪些值得用 Higgsfield 重做模型。
2. 已修好四处「一眼不像」的地方：渔人码头的船舵招牌原来是蓝圈 + 灰铁杆，现在是深棕木舵 + 缠绳木桩（和真的一样）；市政厅圆顶从灰绿色改成真实的铅灰色配金边；金门公园荷兰风车从奶白色改成风化的灰褐色木瓦；恩典大教堂改成冷灰色混凝土 + 深石板色屋顶。
3. 位置：把 46 个著名景点的地图坐标和 OpenStreetMap 逐一核对，全部对得上（38 个误差在 35 米内，其余是故意的，比如金门大桥的标记放在南塔、彩绘女士的标记在对面公园拍照点）。
4. 资料卡：把 25 张热门景点卡缺的开放时间、票价、施工提示补上了（全部今天在官网核对，带来源链接）：恶魔岛船票（日间团成人 $47.95、5–11 岁 $29.15、62 岁以上 $45.15）、PIER 39 商店约 10:00–20:00、日本城和平广场仍在翻修（商场照常营业）、叮当车约 7:00–23:00、迪扬博物馆周一闭馆、海湾大桥过桥费 $8.50 等；九曲花街的绣球花也做成了一团团蓝粉紫的花球。
5. 没做完的：60 多张小景点短卡还没有逐一补时间票价；旧金山塔、渡轮大厦等区域模式的地标按规定不动。

## Part a · the realism scorecard (pushed 21:22 PDT, `80ef896b`)

### What was built

- `docs/opus-bay/sf-w7-R-realism.md`: 48 places by fame, each scored /5 for colour, proportion and the identifying
  feature, with what would make it more recognisable, whether a generated model would help (for lane V), the owner lane,
  and the Wikimedia Commons reference of each (thumbnails in scratch only).
- The shooting harness `C:/Users/willy/opus-qa/w7/r/shots.mjs` (scratch; one headless Chrome through
  `scripts/opus-shot.mjs`): every site's own photo pose (`SF_LANDMARK_INFO.photo` / `w4.photo`, local → world by the
  site yaw) and a player's eye 6 u behind its arrival spot, hand-set views for the district landmarks, `?world=city&
  time=day&quality=high`, 1440 × 900, the HUD hidden, calls / triangles logged per view. 62 JPEGs +
  12 extra views in `C:/Users/willy/opus-qa/w7/r/shots/a/`.

### Evidence

- Suite before the push: `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1489 / 1489** (16.5
  min on the loaded machine), `tsc` 0, `eslint .` 0 errors (43 old warnings). The push was docs only; the rebase brought
  lane Q's commits (their own checks), so the combined tree was not re-run for that docs-only push.
- Every image was read before it was scored. Views that a building blocked (SFMOMA, the Asian Art Museum, War Memorial,
  City Hall's photo pose, the Bay Bridge, Alcatraz from Pier 33, Transamerica from the street) were re-shot from a raised
  camera (`x-*.jpg`).

### Decisions

- Scores are for the toy style (H = 3.2 + 0.155·h; no lettering), not photo-realism: 5 = a visitor names it at a glance.
- The district's hand-made landmarks (Coit, the Ferry Building, Transamerica, Salesforce, PIER 39's gate, the
  Exploratorium shed) are scored but not touched: district mode never changes. Salesforce's dark-banded shaft vs the real
  pale glass is left to the lead.
- W1 (Dragon Gate), W2 (Alcatraz, Union Square, Chase Center) rows are scored for the record only.

## Part b · the cheap realism fixes (commit W7-R2)

### What was built

- **Fisherman's Wharf wheel** (`world/sf/landmarks/fishermans-wharf.ts`, fame 90): the ring dark-brown wood (was blue
  `#2f6f96`), thin dark rings inside the plain band and round the crab, the spokes only outside the rim, and four wooden
  pilings bound with rope that rise above the rim instead of the grey steel post (as the real sign: Commons
  `File:Fishermans_Wharf_Sign,_SF,_CA,_jjron_25.03.2012.jpg`, checked 2026-09-29). `tops.ts` regenerated with
  `scripts/opus-sf/assets/landmark-tops.ts` (only that row changed: 5.2 → 6 u).
- **City Hall dome, Grace Cathedral, the Dutch Windmill**: these three ship AI meshes (`sf-city-hall`,
  `sf-grace-cathedral`, `sf-windmill-body`), so the colour lives in their baked WebP textures. New
  `scripts/opus-sf/assets/w7r/recolour-glb.py` rewrites a Draco + WebP GLB with HSV rules on its texture (the mesh
  untouched): City Hall sage → lead-grey (gold stays), Grace cream → cool grey and teal roofs → slate, the windmill cream →
  grey-brown shingle and its orange wood darker. The procedural models (the far lod 2) got the same colours. References:
  Commons `San_Francisco_City_Hall_September_2013_panorama_2.jpg`, `2009-0723-CA-005-GraceCathedral_(pc).jpg`,
  `GGParkNorthWindmill2.jpg` (checked 2026-09-29).
- `data/assets.ts` (surgical: three `bytes` values) and `tests/opus-bay-w7-r.test.ts` (3 tests: no blue ring and pilings
  above the rim; the old colours gone from the procedural models; the GLB bytes pinned and still WebP).

### Evidence

- Before / after shots from the same cameras (`docs/opus-bay/qa/w7/R/b-*-before-after.jpg`; left before, right after).
  calls · triangles at the photo view: Wharf 70 · 142.1k → 72 · 141.9k; City Hall 75 · 238.4k → 78 · 239.1k; windmill
  94 · 261.4k → 94 · 261.4k; Grace 72 · 304.8k → 73 · 301.1k (the ±3 calls are walkers and cars; 0 new meshes).
- The landmark tests `opus-bay-sf-landmark-context`, `sf-landmarks`, `sf-models`, `w4-assets`, `w5-landmarks`,
  `sf-sites-w4`: 77 / 77; `opus-bay-w7-r`: 3 / 3.

### Decisions

- A texture recolour, not a regenerated model: the shapes of the three AI meshes are right; only the palette was off.
  No Higgsfield credits spent (0).
- The asset ledger (`src/opus-bay/ASSETS-LEDGER.md`) is the lead's to merge: the three rows W3-LM6 / LM7 / LM8 now have
  new byte sizes (83,956 / 111,804 / 146,860 B, "W7-R texture recolour").

### Known gaps

- The Wharf wheel's lettering band stays plain (no lettering rule), so the face reads as concentric rings.
- The recolour rules are hue windows: City Hall's teal window panels went grey with the dome (the real windows are dark
  glass, so this is fine).

## Part c · the cards: hours, prices and closures a visitor asks first (commit W7-R3)

### What was built

Facts checked on the official pages today (2026-09-29), hedged with 约 / 以官网为准 as the card rules ask; each card's
`verifiedAt` is 2026-09-29 where a fact changed, and the new source is in its `sources`:

| card | added / changed | source (checked 2026-09-29) |
|---|---|---|
| Alcatraz | the price: day tour adults $47.95, ages 5–11 $29.15, 62+ $45.15, under 5 free (was "see the official site") | https://www.nps.gov/alca/planyourvisit/fees.htm |
| PIER 39 | hours: shops about 10am–8pm, restaurants about 11am–9pm | https://www.pier39.com/ |
| Ferry Building Marketplace | the building 6am–10pm next to the market hours; cost: free to walk in | https://www.ferrybuildingmarketplace.com/visit/ |
| Golden Gate Park, Union Square, Dolores Park, Marina Green, Blue Heron Lake, Stern Grove, Bernal Heights Park, Mount Davidson, Lake Merced | hours: city parks 5am–midnight (SF Park Code §3.21); cost: free | https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_park/0-0-0-46781 |
| Palace of Fine Arts (refresh) | hours: grounds 5am–midnight | https://sfrecpark.org/Facilities/Facility/Details/Palace-of-Fine-Arts-423 |
| Painted Ladies, Twin Peaks (refreshes) | hours: the park 5am–midnight; Twin Peaks cost free | Park Code §3.21 (above) |
| Powell & Market turntable (refresh) | hours: the cars run about 7am–11pm (fare $9 re-checked: unchanged) | https://www.sfmta.com/routes/powell-hyde-cable-car · https://www.sfmta.com/fares |
| de Young (refresh) | hours: Tue–Sun 9:30am–5:15pm, closed Mondays, the tower until about 4:30pm | https://www.famsf.org/visit/de-young-tickets-hours (the page answers 403 to scripts; read through the search index) |
| Peace Pagoda (refresh) + Japan Center | status `works` until 2026-12: Peace Plaza is being renovated behind fences, the malls stay open, due in late 2026 | https://peaceplaza.org/ (Sept 2, 2026 update) · https://sfrecpark.org/m/newsflash/Home/Detail/3008 |
| Transamerica Pyramid | hours: Redwood Park weekdays 7am–5:30pm, free | https://downtownsf.org/go/transamerica-redwood-park |
| Presidio, Presidio Tunnel Tops | hours: open daily, year-round (Tunnel Tops free; the visitor center keeps its own hours) | https://presidio.gov/explore/attractions/presidio-tunnel-tops/ |
| Bay Bridge | cost: $8.50 toll westbound for a car in 2026 | https://mtc.ca.gov/news/new-bridge-toll-rates-now-effect |
| Ocean Beach | hours: open all day, bonfire season 1 Mar–31 Oct about 6am–9:30pm; cost free | https://www.parksconservancy.org/parks/ocean-beach-sf-bonfire-fire-pit-san-francisco-marin-parks |
| Haight-Ashbury, Lands End, Salesforce Tower, Crissy Field, Harvey Milk Plaza | cost (free / the tower is not open to visitors, the rooftop park is free) | the cards' own sources |

Re-checked and **unchanged** (the card was right): Coit Tower hours and elevator fee (Apr–Oct 10–6, Nov–Mar 10–5;
$11 / $8 residents; sfrecpark.org/facilities/facility/details/Coit-Tower-290), the cable-car fare ($9; senior $4 before 7am
/ after 9pm), Cal Academy (Mon–Sat 9:30–5, Sun 11–5, NightLife Thu 21+; calacademy.org/visit), SFMOMA (adult $30, closed
Wed; sfmoma.org/visit), the Castro Theatre's reopening (6 Feb 2026), the Cliff House (closed, late 2026 hoped), the Twin
Peaks Promenade works (May 2026 → end of 2026, the overlook open), Lombard's one-way downhill block, Sutro Baths, the
Dutch Windmill's tulip garden closed all October (already on its card).

Also: **Lombard's hydrangeas** (`world/sf/landmarks/lombard-crooked-street.ts`, scorecard #6): the hairpin beds' flat
flower cubes are round hydrangea clumps in blue / pink / purple, the planters' flowers the same colours; lod 0 2,478 of
the T2 2,500 triangles; `tops.ts` row regenerated.

### Positions (OpenStreetMap)

The 46 most famous attractions Nominatim could resolve were compared with OSM (search today, `C:/Users/willy/opus-qa/w7/r/
nomi.json`, projected with `core/geo.ts projectCity`): 38 badges are within 5 u (35 m) of the OSM feature; the other 8
differ on purpose or are large areas: the Golden Gate Bridge's badge on its south tower, the Painted Ladies' in Alamo
Square where the photo is taken, PIER 39's at its entrance, Twin Peaks' on the summit (its trip end is 0.4 u from OSM's
Christmas Tree Point node), SF State, the zoo and Blue Heron Lake at a point inside their grounds, and Haight-Ashbury,
where Nominatim's hit was a shop a block west (the intersection itself, 37.76993, −122.44690, projects to (−40.3, 763.7),
1 u from the badge). **No position needed a fix.**

### Evidence

- `tests/opus-bay-w7-r.test.ts` 5 / 5 (+ the Lombard hydrangeas and the famous cards' hours / price / status);
  `opus-bay-sf-cards` 14 / 14 after the surgical test change below; `sf-landmark-context` 13 / 13.
- The cards open in game on the phone (390 × 844, dpr 3): `qa/w7/R/c-cards-phone.jpg` (Alcatraz; the Peace Pagoda with
  the renovation line first among the tips). Lombard before / after: `qa/w7/R/c-lombard-before-after.jpg`
  (calls · triangles at the photo view 66 · 235.2k → 67 · 236.4k).

### Decisions

- `tests/opus-bay-sf-cards.test.ts` (surgical, lane C's wave-4 file): the refresh set was pinned to exactly the 10
  "stop" landmarks with `verifiedAt` 2026-09-27; it now requires every stop to have one, allows more built landmarks
  (Painted Ladies, the Palace, the turntable, the Peace Pagoda) and a 2026-09-29 date, and checks refresh hours are hedged.
- The district POI texts (`data/poiTexts.ts`, lane P's new module: Coit Tower, the Ferry Building, Pier 33, the
  Exploratorium…) are district mode and stay as they are; their facts were re-checked and still hold.
- Hours for city parks follow the Park Code (5am–midnight) rather than a per-park page when the park page gave nothing else.

### Known gaps / Not done

- About 60 short cards (priority 4) still have no hours or price (their short form allows 0–1 tips); the famous ones are done.
- The Lands End Lookout's hours disagree between sources (daily 9–5 vs a reduced week): left as "see the official site".
- Salesforce Tower's dark-banded shaft (scorecard #32) is a district landmark: the lead's call.

### Requests

- **Lead**: merge the three asset rows (W3-LM6 / LM7 / LM8: new sizes 83,956 / 111,804 / 146,860 B, "W7-R texture
  recolour, no credits") into `ASSETS-LEDGER.md`.
- **Lane V**: the scorecard's "generated model?" column (Palace peristyle, de Young tower, St Ignatius cupolas, a Haight
  Victorian / mural kit); the sites R edited (Wharf, City Hall, Grace, the windmill, Lombard) are done by code.
