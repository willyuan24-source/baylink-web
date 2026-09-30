# Wave 7 · lane R · places: enough information, true to life

Lane R of wave 7 (worktree `C:/Users/willy/wt/w7-r`, branch `w7-r`, dev port 5713). Brief: `sf-w7-lead.md` §7 row R.

## 给主人的摘要

1. 把地图上最有名的 48 个地方在游戏里逐个拍照，和维基共享资源的真实照片并排比对，打了「颜色 / 比例 / 标志性特征」三项分数，做成一张评分表（`sf-w7-R-realism.md`），V 线据此挑哪些值得用 Higgsfield 重做模型。
2. 已修好四处「一眼不像」的地方：渔人码头的船舵招牌原来是蓝圈 + 灰铁杆，现在是深棕木舵 + 缠绳木桩（和真的一样）；市政厅圆顶从灰绿色改成真实的铅灰色配金边；金门公园荷兰风车从奶白色改成风化的灰褐色木瓦；恩典大教堂改成冷灰色混凝土 + 深石板色屋顶。
3. 位置：把 45 个著名景点的地图坐标和 OpenStreetMap 逐一核对，全部对得上（差距都在设计范围内，比如金门大桥的标记故意放在南塔）。
4. 资料卡：下一部分会把热门景点缺的开放时间、票价补齐（今天在官网核对过），例如恶魔岛船票（成人 $47.95）、PIER 39 商店 10:00–20:00、日本城和平广场仍在施工等。

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
