# Wave 2 · lane G2 (city content)

## Part a-content

Lean pass over checkpoint §5.8: mode-resolved content (G2-0, fixes CS-9), the 24 landmark cards (G2-1), the 12 SF
postcards (G2-2), active-mode postcard counts (G2-3), city goals (G2-5) and the city onboarding copy (G2-8), with tests
(G2-10 part). Residents, BAYBAY's event / neighbourhood lines and VOICE.md are left for the next part.

### What was built (files, API for other lanes)

| file | what |
|---|---|
| `data/contentMode.ts` (new) | `CONTENT_MODE = readWorldMode()` (fixed per page), `byMode(district, city, mode?)`, `isCityContent()`. Node tests have no `location`, so they always resolve to district. |
| `data/pois.ts` | the v1 tables are now `DISTRICT_POIS`, `DISTRICT_POI_OFFICIAL_URLS`, `DISTRICT_POI_EXTRA_SOURCES`, `DISTRICT_PHOTO_SOURCE_PAGES`, `DISTRICT_SUBJECT_FACTS` (untouched values); the plain names are `byMode(DISTRICT_*, DISTRICT_* + CITY_*)`. City entries never merge in district mode. |
| `data/sf/cityPois.ts` (new) | `CITY_POIS`: one `PoiDef` per `SF_LANDMARK_INFO` record (24), id **`sf:<landmarkId>`** (`cityPoiId`), at D2's arrival spot (`sfLandmarkAnchor`), radius 4, kind `'info'` (no Coit sweep), `bark = info.bark`, `realInfo` with `sourceUrl` + `verifiedAt`. Planner / guide ids only if they exist; month-tagged guides (the October 2026 Muni guide on the turntable) fall back to `san-francisco-guide`; Ghirardelli's `pier39` planner place is dropped (it names a different spot). 12 licensed site photos from `src/data/sf-landmark-photo-assets.json` reused read-only where the photo shows the landmark (`CITY_PHOTOS`; the Castro photo is the crosswalk, not the theatre: not reused). `ZH_GLOSSARY` / `glossZh` (双子峰→双峰, 码头区→马里纳区, 缆车→叮当车, 卡斯楚→卡斯特罗, Presidio→要塞公园 in zh) applied to every card string; `CITY_POI_ZONES` (eyebrow), `CITY_SUBJECT_FACTS` (telescope / photo captions by landmark id). |
| `data/postcards.ts` | `DISTRICT_POSTCARDS` (v1) and `POSTCARDS = byMode(8, 8 + 12)`; `POSTCARD_FOR_POI` moved here from `ui/format.ts` (`DISTRICT_*` + `CITY_POSTCARD_FOR_POI`: `sf:<landmark>` → its card). `POSTCARD_IDS` / `PostcardId` stay the district ids (data/assets.ts types against them). |
| `data/sf/postcards.ts` (new) | `CITY_POSTCARDS` (ids = `SF_POSTCARD_ART_IDS`, art `POSTCARD_ART[id].small`) with title, fact, hint (zh ≤ 45), `sourceUrl`; `CITY_POSTCARD_NEAR` (card → landmark). Spots below. |
| `data/sf/goals.ts` (new) | `CITY_FREE_GOALS` (7), `CITY_GOAL` ids, `NEIGHBOURHOOD_TARGET = 8`, `HOOD_PREFIX = 'hood:'`, `neighbourhoodsVisited`, `goalProgress(id, goalsDone)` ("3/8"). |
| `data/script.ts` | `DISTRICT_START_NODE` / `CITY_START_NODE` (`intro.hello.city`, the same four choices; 3 → `free.intro.city` → `free.goals.city`), `START_NODE = byMode`; `DISTRICT_FREE_GOALS` / `FREE_GOALS = byMode(…, CITY_FREE_GOALS)`; `DISTRICT_SCRIPT_HOOKS` / `CITY_SCRIPT_HOOKS` (start, freeIntro, freeGoals, edge → `guide.edge.city`) / `SCRIPT_HOOKS`; `CHOICE_SUBS` for `intro.hello.city:1-4` ("全城 20 张明信片 · 叮当车 · 双峰"); `DISTRICT_GUIDE_BARKS` / `CITY_GUIDE_BARKS` (no sea lions or pier lights in idle / day / night / edge) / `GUIDE_BARKS`. New nodes: `intro.hello.city`, `free.intro.city`, `free.goals.city(.2,.3)`, `guide.edge.city`. |
| `data/sf/copy.ts` | `CITY_COPY.titleSub` filled (dependency-free, type imports only; the title renders it). |
| `game/cityGoals.ts` (new) | pure detectors: `createSummitDetector` (Twin Peaks), `createDeckCrossing` (Golden Gate), `neighbourhoodVisit` / `isNeighbourhoodId`, `cityGoalTargets()`; `initCityGoals({ done, heightAt })` = one frame system (`g2-city-goals`, 5 Hz) + a `shutter` listener. |
| `game/cityContent.ts` | `initCityContent()` (city only: the goal detectors, an SF landmark subject resolver for telescopes / photo captions), `goalTargets()` (city: 4 waypoints to landmark cards; district `[]`), `contentFor(mode)` for tests. |
| `game/flow.ts` | `markGoalsDone(ids)` (non-GoalKey goals: toast + `goal` event for FREE_GOALS ids, silent for `hood:` marks); `nextFreeGoal` offers the district's market / Coit / sea-lion / F-line targets only when that goal is in the active `FREE_GOALS` (district: all five, unchanged; city: Coit only) — the CS-9 goal chips; the collect announce uses `activePostcardTotal()`. |
| `ui/PoiCard.tsx` | renders `sf:<landmarkId>` cards through the same code; the eyebrow names the neighbourhood ("真实地点 · 阿拉莫广场"). |
| `ui/Journal.tsx`, `ui/Moments.tsx` (G2-3) | the journal tab count, the reward card and the recap count only the active world's cards (`activePostcardCount` / `activePostcardTotal`); the goals card and the journal show "· 3/8" on the neighbourhood goal. |
| `ui/format.ts` | `postcardForPoi` reads `POSTCARD_FOR_POI`. |
| `tests/opus-bay-sf-content.test.ts` (new) | 14 tests (below). `tests/opus-bay-content.test.ts` now imports the `DISTRICT_*` tables (pinned before any default flip). |

**For other lanes:**
- A city landmark card is `openPanel('poi', 'sf:<landmarkId>')`; the interactable has the same id (G1's `?at=sf:<id>`
  and "带我去" resolve it; checked: `?at=sf:painted-ladies` puts the player on the card with the E prompt focused).
  G1's place index merges POIs within `POI_MERGE_R` through `poiInputs()` (reads `POIS`), so its 详情 button opens these
  cards for landmark places.
- City goal ids: `postcards`, `cable-car` (F's `completeGoal('cable-car')` after a counted ride ticks it), `twin-peaks`,
  `golden-gate`, `painted-ladies`, `neighbourhoods`, `viewpoint`. Visited neighbourhoods are `hood:<far zone id>`
  entries in `goalsDone` (saved with it). G1's HUD pill already counts `FREE_GOALS` of the active world ("目标 0/7").
- `markGoalsDone(ids)` (flow) is the way to complete a goal that is not a `GoalKey`.

### Postcard spots (city frame, all on standable ground, ≥ 6.5 u from every landmark card)

| card | spot | why there |
|---|---|---|
| sf-golden-gate-fog | (−683.8, 670.4) | the grassy overlook at the bridge's south end (lead's spot moved 1 u onto standable grass) |
| sf-painted-ladies | (−2, 593.6) | Alamo Square hilltop facing the row |
| sf-palace-fine-arts | (−403.6, 426.4) | the lagoon path (lead's spot was in the water) |
| sf-cable-car-hill | (35.2, 188.9) | the sidewalk at California & Powell |
| sf-chinatown-lanterns | (31.8, 146.0) | Grant Ave sidewalk, north of the Dragon Gate |
| sf-lombard-street | (−163.1, 180.1) | top of the crooked block, Hyde St end |
| sf-mission-murals | (261.4, 606) | in Clarion Alley |
| sf-dolores-park | (242, 698) | the park lawn |
| sf-windmill | (−579.7, 1320.3) | the garden path by the windmill |
| sf-city-hall | (111.7, 417.0) | Civic Center plaza, east of City Hall |
| sf-twin-peaks-view | (133.5, 926.9) | by the Twin Peaks overlook (y ≈ 47) |
| sf-ocean-beach | (−431, 1475) | on the sand |

Facts: the cloud session has no web access (en.wikipedia.org and nps.gov are blocked by the egress proxy), so every
card fact is one of D2's facts verified on 2026-09-26 in `data/sf/landmarks.ts`, and the card's `sourceUrl` is that
fact's source (tested). Ocean Beach has no verified fact of its own: its card carries the Cliff House fact (the beach's
north end); the Mission murals and Dolores Park cards carry Mission Dolores facts phrased as its neighbour.

### Goals (G2-5)

| goal | how it completes |
|---|---|
| 找齐 20 张旧金山明信片 | `completeGoal('postcards')` when `allPostcardsFound` (20 in city) |
| 坐一段真的叮当车 | lane F: `completeGoal('cable-car')` after a counted ride (never travel mode) |
| 自己爬上双峰 | within 16 u of the overlook at y ≥ base − 3, on foot / bike / car / sitting; armed only after being ≥ 150 u away on your own; a fast travel (new `travelEpoch`) or the pelican disarms it |
| 走过金门大桥 | on the deck (y > DECK − 3.2, \|local z\| ≤ 8) from local x ≤ −89 to ≥ +89 or back (tower to tower until C2's Marin board); leaving the deck, gliding or a fast travel resets |
| 给彩绘女士拍张照 | a `shutter` within 70 u of the row |
| 逛 8 个街区 | `zoneAt` in city mode returns a far zone (41 DataSF neighbourhoods; the hero zones are not counted); each new one adds `hood:<id>`; the 8th adds `neighbourhoods` |
| 登上 Coit Tower 观景点 | unchanged (the viewpoint sweep) |

`goalKeyOf(id) === null` for the four new ids (tested); waypoints (`goalTargets`) lead to the turntable, Twin Peaks, the
bridge and the Painted Ladies cards.

### Evidence

- `tests/opus-bay-sf-content.test.ts` (14 tests): district mode resolves every export to the v1 table and
  `contentFor('district')` is v1; city = district waterfront + 24 cards + 20 postcards + 7 goals, no waterfront barks;
  24 cards with verified info, live BAYLINK ids only, no month-tagged guide; photos on disk and listed in the site's
  photo manifest with the same credit page; no glossary "from" word left in any city zh string; the glossary names are
  far.zones HUD labels; 12 postcards with both art files, a verified source, hint ≤ 45; every postcard spot stands
  (published city loaded with `sfDisk`) and every card and postcard spot is in the ferry-gate walking component;
  active counts; goal ids; Twin Peaks / deck / neighbourhood detectors with synthetic input; waypoints; the city
  welcome mirrors the district's choices; copy.ts stays dependency-free.
- `opus-bay-content` (pinned to DISTRICT_*), `opus-bay-contracts`, `opus-bay-flow-*` green; `opus-bay-hero-regression`
  11/11. Full suite before the final push (after rebasing on G1's save fix 480418e): **289/289 pass** (the one
  earlier failure, `sf-transit` "ride: boarding waits…", was G1's save.ts calling `window.addEventListener` under the
  node stub, fixed on origin by 480418e, not a G2 change).
- Shots (960×600, SwiftShader, `docs/opus-bay/qa/w2/G2/`):
  - `g2-title-city-zh.jpg`: the city subtitle "跟 BAYBAY 逛整座旧金山：金门大桥、叮当车、双峰…".
  - `g2-landmark-card-painted-ladies.jpg` (`?world=city&start=free&at=sf:painted-ladies`, E): "真实地点 · 阿拉莫广场",
    the licensed photo with credit, the verified summary, BAYLINK 旧金山攻略; the free-roam hint chip already points to
    the next city goal ("叮当车 · Powell & Market 转车台").
  - `g2-city-postcard-pickup.jpg`: the Painted Ladies postcard collected — "新明信片！1/20", fact + source, HUD 1/20.
  - `g2-city-goals-card.jpg`: the 7 city goals, "逛 8 个街区 · 1/8" after arriving in Alamo Square.
  - `g2-city-twin-peaks-card-prompt.jpg` (`?world=city&start=free&quality=high&at=sf:twin-peaks`): the HUD area 双峰, the E
    prompt "看看这里的介绍卡 · 双峰观景台" (glossary), the next-goal chip "给彩绘女士拍张照 · 约 1 分钟"; Twin Peaks is not
    ticked (arrived by ?at= teleport, the detector was never armed). `renderer.info` there: **66 draw calls, 258,648
    triangles** (960×600, quality high, incl. shadows) — this part adds no meshes (12 more postcard glints in city mode).
  - `g2-district-unchanged-0of8.jpg` (`?start=free`, district): "明信片 0/8 · 目标 0/5", the v1 postcard-clue chip and the
    v1 idle bark — district content is the v1 table.

### Decisions

- Mode resolution at import time (the world mode never changes within a page); every table keeps its `DISTRICT_*`
  export so tests and later lanes can pin either side. `contentFor(mode)` sits in `game/cityContent.ts` (it needs both
  sides; `data/contentMode.ts` stays a leaf so data modules can import it).
- City mode keeps the district's POIs and 8 cards: the hero waterfront is part of the city. Tour and week flows are
  unchanged in city mode ("湾区第一课" still walks the waterfront).
- Landmark cards open straight away on E (no reaction node): the pass-by bark already speaks.
- Postcard hints name the area, not the exact spot; facts are only already-verified ones (no web).

### Known gaps

- `openPanel('poi', 'sf:<id>')` renders the 24 landmark cards (G1's 详情 opens them since a999572); a G1 place that is
  not a landmark has no card of its own (G1 hides 详情 there).
- Only landmark cards without a licensed photo show a postcard art strip (the art-strip mapping covers all 12 cards but
  most of their landmarks have photos).
- The Twin Peaks and Golden Gate detectors were tested with synthetic input only; a real walk across the deck and up
  the hill was not played in the browser (SwiftShader at ≈ 3 fps).
- The city `call.menu` dialogue node (unused: flow builds `flow.call` itself) still says "自己逛 → free.goals".

### Not done (for the next part)

- G2-4 BAYBAY event and neighbourhood lines (`data/sf/lines.ts`, `game/baybayLines.ts`, `BARK_SCRIPT` for H2b), G2-6
  residents and tasks, G2-7 resident bodies, G2-9 `data/VOICE.md` (city voice, glossary), G2-11 邻居的小忙 list,
  G2-12 BARK_SCRIPT freeze and calls / triangles with residents in view; tests `sf-lines`, `sf-tasks`.

### Requests

- **D2** (`data/sf/landmarks.ts`): adopt the zh glossary at the source — `双子峰` → `双峰` (sutro-tower zone, twin-peaks
  name and zone), `码头区 Marina` → `马里纳区` (palace zone, matches the HUD's far.zones label), `缆车` → `叮当车` in the
  turntable tip, `Presidio` → `要塞公园` in zh zone strings; replace the turntable's month-tagged guide
  `bay-area-october-muni-clipper-payment-update-2026` with `san-francisco-guide`; Ghirardelli's `plannerPlaceId: 'pier39'`
  names a different place. G2 overrides all of these in `data/sf/cityPois.ts` until then (harmless once D2 changes).
- **F** (`game/transit.ts`): the zh glossary uses 叮当车 for cable cars in dialogue and banners (the landmark card, the
  goals and BAYBAY say 叮当车); transit.ts says 缆车 / 缆车司机 (≈ 10 strings, l.200–290). Suggest 叮当车 / 叮当车司机.
- **G1** (`ui/TitleScreen.tsx`): the greeting under the city subtitle still says "嗨～第一次来湾区吗？我带你逛！" — fine
  for the city too; if G1 wants a city line, G2 can add `CITY_COPY.greet` (same dependency-free file).
