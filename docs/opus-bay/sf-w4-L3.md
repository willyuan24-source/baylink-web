# Wave 4 · lane L3 · Landmarks, tier 3 (W4-L9: the plan's priority-4 sites)

## Early phase

Written 2026-09-27 by the lane-L3 agent (worktree `C:/Users/willy/wt/w4-l3`, branch `w4-l3` → `opus-bay`). Early-phase
rule (`sf-w4-lead.md` §2): new files only. Every file lane L3 committed is one it created in this run (the
`W4-L9` commits list only new paths, plus later edits of those same files); two of them were touched by the lead's
registration commit `040440d` (W4-IL1: `tests/opus-bay-sf-sites-w4t3.test.ts` one line, `scripts/opus-sf/sites3-preview.tsx`),
which lane L3 then followed. Higgsfield: 0 credits.

### 给主人的摘要

1. 第四优先级能做的 **24 个小景点全部做好了**（地图三级）：壁画街、歌剧院、鹤湾两台老起重机、两座老宅（哈斯-利连塔尔、八角屋）、大日晷、里昂街台阶、滑梯、弯道、海浪风琴（能沿防波堤走到尽头）、女性大楼、24 街，还有 13 个公园和广场：阿尔塔、布埃纳维斯塔、中国海滩、格伦峡谷（红色燧石）、伊娜·库尔布里斯、拉法叶、麦克拉伦（蓝色大水塔）、苏特罗山、山湖（湖边木平台）、诺伊谷镇广场、帕特里夏绿地、苏特罗高地（面朝大海的石栏台）。
2. 每个都有：按真实坡度铺的地面、长椅路灯等小道具、能走的范围和到达点、地图旗杆；三角形都在 800 以内。壁画一律只用抽象色块，从不照抄；牌子一律空白；住宅区（日晷、滑梯）不放人群。
3. 前 9 个已经被主线接进游戏里（W4-IL1）；后 15 个在单独的等待名单里，接线时整批移过去、重跑一次 tops 表即可。
4. 测试 9 项全部通过，全套 opus-bay 测试 818/818 通过；每个地点都在预览里截图看过。
5. 没做的只有两个：华人电话局（唐人街三角形预算不够，按规定只做卡片）、亨廷顿公园（属于格蕾丝大教堂的场景，已派给 L 线）。

### What was built (files, API)

| file | what | API |
|---|---|---|
| `src/opus-bay/world/sf/landmarks/siteKit3.ts` | the tier-3 kit: the ground lookup over the tier-3 baked table, and the props the small settings share | `groundOf(grid, fallback)`, `site3Ground(id, fallback)`, `box3`, `signBoard` (blank board on posts), `markerStone`, `colourPanel` (one- or two-tone field), `boulder`, `stairFlight` (up or down; treads never sink), `lowWall`, `bandPoly(points, half, ext)` |
| `src/opus-bay/world/sf/landmarks/siteTerrain3.ts` | generated: per site the numeric base and the local ground grid (as lane L's `siteTerrain.ts`) | `SITE_TERRAIN3[id]` |
| `src/opus-bay/world/sf/landmarks/w4list3.ts` | the tier-3 records, in the plan's P4 order | `W4_SITES_T3` (registered since W4-IL1), `W4_SITES_T3_NEXT` (built after it, waiting for their tops rows), `W4_SITES_T3_ALL` |
| 24 site modules (below) | one declarative `W4Site` record each: `build(b, lod)`, exclusion, walk blockers and decks, draped ground, lights, plazas (crowd spots), `w4` metadata (placeId, attractions, arrival, photo, flag, height with `top`, OSM ids, terrain box, notes) | `balmyAlley`, `bayviewOperaHouse`, `craneCovePark`, `haasLilienthalHouse`, `inglesideTerracesSundial`, `lyonStreetSteps`, `octagonHouse`, `sewardStreetSlides` (+ `SEWARD_SLIDES`: the two chute lines for a ride hook), `vermontStreetCrookedBlock`, `waveOrgan`, `womensBuilding`, `altaPlazaPark`, `buenaVistaPark`, `calle24`, `chinaBeach`, `glenCanyonPark`, `inaCoolbrithPark`, `lafayettePark`, `mclarenPark`, `mountSutroOpenSpace`, `mountainLakePark`, `noeValleyTownSquare`, `patriciasGreen`, `sutroHeightsPark` |
| `tests/opus-bay-sf-sites-w4t3.test.ts` | 9 tests on every tier-3 record (both lists), lane L's checks plus the tier-3 rules | — |
| `scripts/opus-sf/sites3-terrain.mts` | bakes `siteTerrain3.ts` (lane L's `sites-terrain.mts` for the tier-3 list) | `[--site <id>] [--check]` |
| `scripts/opus-sf/sites3-survey.mts` | lane L's `sites-survey.mts` with the tier-3 records findable by `--site` | same arguments |
| `scripts/opus-sf/sites3-tops.mts` | prints each record's lod-0 top over its base (`w4.height.top`) and its triangle counts | `[--site <id>]` |
| `scripts/opus-sf/sites3-qa.mjs`, `sites3-preview.html`, `sites3-preview.tsx` | QA shots through the dev server; the preview page appends the WAITING sites to `SF_SITES` (the registered ones are the game's) | `--sites a,b --views street,high --preview 1` |

The sites (lod 0 = model + draped ground triangles / the tier-3 cap of 800; ring = the walk-around ring's open share):

| # | id (attraction) | what the toy shows | list | lod 0 + ground | ring |
|---|---|---|---|---|---|
| 75 | `balmy-alley` | both sides of the alley: garage doors and fence boards in abstract two-tone colour fields, leaving lane H2b's four original mural boards free; the alley's asphalt; two lamps | registered | 364 + 10 | 81 % |
| 76 | `bayview-opera-house` | the 1888 hall on its OSM footprint with its false front on 3rd Street, the 2016 plaza: wooden stage on the south wall, bucket seats, rock garden, tree, lamp | registered | 665 + 22 | 86 % |
| 78 | `crane-cove-park` | Cranes 14 and 30 ("Nick and Nora") on their OSM spots, boom-less as restored (portal, turntable, machinery house, A-frame), the slipway with a painted hull and Transbay-Tube outline, benches, a kayak rack | registered | 596 + 48 | 90 % |
| 79 | `haas-lilienthal-house` | the Queen Anne house on its lot: rear block, front gable and bay, the corner tower's witch's cap, stoop, a blank museum plaque | registered | 312 + 4 | 72 % |
| 80 | `ingleside-terraces-sundial` | the dial with plain hour marks, the gnomon pointing north, four columns with urns (no crowd spots: a residential court) | registered | 298 + 16 | 98 % |
| 81 | `lyon-street-steps` | the upper run Broadway → Vallejo: the two flights, the Presidio's stone wall, clipped hedges, the planted middle landing, a bench and lamps facing the Palace dome | registered | 572 + 12 | 90 % |
| 82 | `octagon-house` | the octagonal two-storey body, a window in each face, cupola, portico, stoop, blank plaque | registered | 404 + 0 | 95 % |
| 83 | `seward-street-slides` | the two concrete chutes, the top deck with its rail and a stack of cardboard, shrubs, lamp, bin (no crowd spots: a mini park) | registered | 284 + 0 | 72 % |
| 84 | `vermont-street-crooked-block` | the hairpins redrawn as a narrow lane on the city's own line (the city's 3.6 u ribbon merged the bends), a shrub in each bend, a blank warning diamond, lamps | registered | 304 + 76 | 75 % |
| 85 | `wave-organ` | the breakwater from Yacht Road to the tip as a walk deck over the water, the terraces with the pipe mouths and carved-block seats | waiting | 396 + 52 | 75 % |
| 86 | `womens-building` | the building on its footprint, both street faces washed in abstract colour fields (never MaestraPeace), cornice, windows, entrance | waiting | 384 + 0 | 72 % |
| 87 | `alta-plaza-park` | the terraced south front: the grand stairs of the "What's Up, Doc?" chase at the head of Pierce Street, retaining walls, terrace walks, benches, lamps | waiting | 556 + 124 | 88 % |
| 88 | `buena-vista-park` | the summit clearing: the small lawn, the loop walk, plain stone edging (never a headstone), benches to the views, a summit stone, a blank park board | waiting | 276 + 48 | 72 % |
| 89 | `calle-24` | 24th Street's north side between Harrison and Alabama: a corner marker, pole banners and strings of cut-paper flags in colours only | waiting | 504 + 0 | 67 % |
| 90 | `china-beach` | the lawn above the cove by the trailhead: the 1982 monument as a stone with a plain plaque, a picnic table and grill, two benches over the cove, a blank board (no swim prompt) | waiting | 228 + 2 | 80 % |
| 91 | `glen-canyon-park` | a stop on the canyon floor: a cluster of red chert boulders, Islais Creek as a strip of colour with reeds, a plank footbridge on the side path, a bench, a blank trail board | waiting | 280 + 22 | 84 % |
| 93 | `ina-coolbrith-park` | the top terrace by Taylor Street: a paved overlook, a low parapet on the downhill edge, three benches to the view, planters, a lamp, a blank plaque | waiting | 344 + 24 | 81 % |
| 94 | `lafayette-park` | the summit: the lawn inside the summit walk (redrawn on the city's line), three benches facing the bay, two cypresses, a lamp, a blank board | waiting | 328 + 56 | 100 % |
| 95 | `mclaren-park` | "La Grande", the Tiffany-blue tank, on one of the two OSM water towers (the other stays the city's): base ring, ladder, gravel apron, benches, a blank board | waiting | 352 + 32 | 95 % |
| 96 | `mount-sutro-open-space` | the summit meadow (Rotary Meadow): native grass, the track and path over the top redrawn, three log seats, poppy- and lupine-coloured clumps, a blank trail board | waiting | 172 + 96 | 96 % |
| 97 | `mountain-lake-park` | an east-shore overlook: a timber deck over the water's edge with a rail (a walk surface), the Anza marker as a plain stone on a paved pad, the lakeside walk redrawn, a bench, reeds | waiting | 244 + 22 | 95 % |
| 98 | `noe-valley-town-square` | the square behind the 24th Street sidewalk: pavers and lawn, the timber pergola, two plain market stalls, benches, a planter, a tree, a lamp | waiting | 476 + 14 | 65 % (a mid-block lot) |
| 99 | `patricias-green` | the open strip between Octavia's frontage streets: lawn, a plinth with a generic abstract form (never the changing artwork), a bench, a planter, a bin | waiting | 132 + 12 | 86 % |
| 100 | `sutro-heights-park` | the Parapet: its paved top, the crenellated wall to the sea, three empty plinths, two benches facing the sea | waiting | 288 + 60 | 94 % |

Every module's header carries its facts and sources and its local frame (origin, yaw, what lies where).

### Evidence

- **Checks** on the pushed report tree `1cc2c35` (rebased on `59fb14b`): `npx tsc -p tsconfig.app.json --noEmit` 0;
  `npx eslint .` 0 errors (43 old warnings); the full opus-bay suite **818 / 818** (808 / 808 one rebase earlier, on
  `cc2aa8d`); the tier-3 test 9 / 9 over all 24 records. Earlier pushes ran the same checks (766 / 766 at `88bfe00`, 807 / 807 at `b24562d`); runs under
  load twice failed a wall-clock test (`opus-bay-sf-nav` "city mode: local A* window …", `opus-bay-audio` P1), which
  passed alone and in the next full run.
- **`tests/opus-bay-sf-sites-w4t3.test.ts`** (9 tests): registry (tier 3, ids not a landmark's nor lane L's, registered
  or waiting, baked base, only priority-4 attractions, each modelled once and not by lane L, the place row = the
  attraction's and near the site, a height rule SfLandmarkInfo knows); budgets (model + ground + animate ≤ 800, lod 2 ≤
  10 %, ≤ 3 parts); exclusions (origin inside, every toy vertex within 0.8 u, no overlap with the 24 landmarks, lane L's
  sites, each other or the hero slab); terrain (the bake re-measured on the rasters, every ground vertex just over the
  walked ground, no piece centre sinks); walk data (blockers valid, arrivals clear, standable, a street of the main
  network within 40 u and a path to it, the walk-around ring ≥ 75 % or a stated reason ≥ 60 %, feet on the draped
  ground); the Wave Organ's tip reachable on foot from Yacht Road along the deck; integration safety (the import graph
  of w4list3 never reaches the registry at runtime, `sink 0`, `measureTops` works on each); streets (every KEEP street
  the exclusion cuts is continued by site ground, none passing is clipped); flags and settings (28–70 u pole inside the
  site, `height.top` = the model's top, plazas ≥ 30 u² unless the notes say "no crowd spots" and there are none, lights
  valid, no text / sign / logo keys).
- **Facts checked on the web this run** (each header names its sources): Balmy Alley (first murals 1972 with Mia
  Galaviz de Gonzalez's children's project, Rodriguez and Carrillo 1973, PLACA 1984; SFMOMA, Wikipedia); Bayview Opera
  House (1888, 4705 3rd St, Geilfuss, 2014–16 $5.7 M renovation with a stage on the rebuilt south wall and seats for
  60, reopened 17 Sep 2016; Wikipedia, SF Public Works, Hoodline); Crane Cove Park (2020, 7 acres, Cranes 14 and 30 =
  Nick and Nora, Crane 14 a 50-ton American Hoist & Derrick whirley of 1941, booms removed in the rehabilitation, the
  Transbay Tube launched there 1965–69; Wikipedia, SF Port, hmdb 159381, Dogpatch Paddle; OSM crane ways 288656668 /
  853565321, slipway 678950944); Haas-Lilienthal House (1886, Peter R. Schmidt for William Haas, witch's-cap tower, SF
  Heritage 1973, National Treasure 2012); Ingleside sundial (10 Oct 1913, 28-ft gnomon, ~34-ft dial with Roman numerals,
  four columns and urns, the racetrack oval; outsidelands.org); Lyon Street Steps (SFGate; step counts vary); Octagon
  House (1861, McElroy, moved from the SE corner of Union & Gough, Colonial Dames 1952, open 2nd / 4th Sundays 12–3,
  Feb–Nov; nscda-ca.org); Seward slides (1973, Kim Clark's design in Ruth Asawa's contest, Tue–Sun 10–5, adults with a
  child, cardboard; sfrecpark.org — the plan's "built in the 1960s" is the activism, not the park); Wave Organ (May 1986,
  Peter Richards and George Gonzales for the Exploratorium, 25 PVC pipes, Laurel Hill Cemetery stone, high tide;
  Wikipedia); the Women's Building (MaestraPeace 1994, seven artists named, 18th and Lapidge faces, restored 2012;
  womensbuilding.org); Alta Plaza (12.9 acres, 1888, Jackson / Clay / Steiner / Scott, the 1972 chase; Wikipedia);
  Buena Vista (1867 as Hill Park, 38.3 acres, 575 ft, the WPA headstone gutters; Wikipedia); Calle 24 (May 2014, Board of
  Supervisors and Mayor Ed Lee; calle24sf.org); China Beach (the Chinese fishermen's cove from Gold Rush times, the 1982
  monument at the trailhead, no lifeguards; parksconservancy.org, hmdb 52925, NPS); Glen Canyon (≈ 70 acres, Islais
  Creek, Franciscan chert, the Giant Powder Company's dynamite 19 Mar 1868 – 26 Nov 1869, CHL 1002, the WPA recreation
  centre 1937; Wikipedia); Ina Coolbrith Park (0.8 acre at Vallejo and Taylor; California's first poet laureate, named
  30 June 1915; sfrecpark.org, Wikipedia); Lafayette Park (12.5 acres between Washington, Sacramento, Gough and Laguna;
  Wikipedia, sfrecpark.org); McLaren Park (313.7 acres, named 1926, Philosopher's Way 2013, the Jerry Garcia
  Amphitheater, La Grande 1956 — 350,000 gallons, 80 ft, a new steel tank in 2008; Wikipedia, SF Heritage, SFGate);
  Mount Sutro (911 ft, 61 acres of UCSF reserve, fog drip, Rotary Meadow 2004; Wikipedia, UCSF); Mountain Lake (Anza's
  camp of 1776, the plaque of September 1957, the 2014 clean-up; Wikipedia); Noe Valley Town Square (opened 27 Oct 2016
  on a former parking lot; the farmers' market since 2003; sfrecpark.org, CBS News); Patricia's Green (2005, on the
  Central Freeway's land, a changing large artwork; Wikipedia, Hayes Valley Neighborhood Association); Sutro Heights
  (Adolph Sutro's garden estate from 1881, open 1883, given to the city 1938, the mansion razed 1939, now GGNRA; the
  Parapet over the Cliff House; Wikipedia, NPS).
- **Preview shots** (read before describing; scratch `C:/Users/willy/opus-qa/w4/w4-l3/qa/`, key ones in
  `docs/opus-bay/qa/w4/L3/`): the Lyon Steps from the top landing — the flights between the Presidio wall and the hedge,
  lamps, the Palace dome and the bay straight ahead; the sundial with its hour marks, gnomon and four urn columns in
  the court; the Alta Plaza grand stairs between the retaining walls toward Pierce Street; the Women's Building's
  colour-banded faces over 18th Street; the Octagon House's portico and windows at the Gough / Union corner; Vermont's
  zigzag lane from above between McKinley Square and the houses; the Wave Organ's breakwater running out from the
  harbour; Crane Cove's two cranes framing the slipway with its outlines. The first Balmy shot showed my colour fields
  cutting through lane H2b's mural boards: fixed (their spans are left free) before this report. The later ten: China
  Beach's lawn from over the cove (benches, picnic table, grill, the monument stone and board beside the old lifeguard
  station); Glen Canyon's red chert cluster, bench and board on the canyon floor under the eucalyptus slope; Ina
  Coolbrith's terrace benches looking down over Chinatown to the towers; Lafayette's two cypresses at the summit in the
  middle of the park's walks; McLaren's blue tank beside the city's second tower above the park road; Mount Sutro's
  meadow with its log seats, flower clumps, board and the track over the top; Mountain Lake's railed deck over the water
  with the marker stone on the shore; Noe Valley's pergola, the two canopies, benches and planter behind the sidewalk;
  Patricia's Green's plinth and abstract form on the strip between the frontage streets; Sutro Heights' paved terrace,
  benches and crenellated wall with the sea beyond. Where the street camera (4 u behind the arrival) stood behind a
  prop (Lafayette's cypress, McLaren's tank, a city prop on Octavia) a ring view was used instead; the high golden views
  over Ocean Beach (China Beach, Sutro Heights) are washed out by the sea haze.
- **Walk checks beyond the test**: the Wave Organ spit was a 1.2 u path with gaps in the walk raster; a 1.8 u and a 2.6 u
  deck still broke the nav window at the bends (the stand clearance leaves ~2 cells); the 3.4 u walk joins up
  (`findPath` Yacht Road → the terrace: 9 points, reached).

### Decisions

- **Own kit and bake files** (`siteKit3.ts`, `siteTerrain3.ts`, the `sites3-*` scripts): lane L's `siteKit.ts`,
  `siteTerrain.ts` and scripts stay untouched; the tier-3 records use lane L's `W4Site` type and helpers unchanged.
- **Registered vs waiting**: W4-IL1 registered `W4_SITES_T3` (9 sites) with their tops rows; a site added to that list
  afterwards fails the tops tests until `landmarks/tops.ts` is regenerated, which is an existing file. So the sites
  built after W4-IL1 go to `W4_SITES_T3_NEXT` (tested exactly like the others, not drawn by the game yet).
- **No crowd spots** where the plan says a place is a residential court (the sundial) or where a crowd makes no sense
  (the Seward mini park): the record has no plazas and says "no crowd spots" in its notes; the test checks that pair.
  Elsewhere the crowd spots include the sidewalks (and the near lanes) in front of house museums, as the Haight corner does.
- **Art and brands**: murals are abstract colour fields only (Balmy, the Women's Building, Calle 24's papel picado
  colours), lane H2b's original boards stay the centrepieces at Balmy; boards, plaques and signs are blank; no headstone
  shapes at Buena Vista; no cars on the Alta Plaza stairs; no numerals on the sundial.
- **Streets**: Balmy and Vermont redraw the street they cut (the city's ribbon merges Vermont's bends into one slope);
  Vermont also drops the city's side steps, drawn flat and floating over the bends. Every other exclusion keeps the
  streets' ribbons whole (strips 1.9–2.2 u off a centreline, as at Calle 24; Patricia's Green is the open strip left
  between Octavia's two frontage streets, whose ribbons cover most of the OSM green). Park paths an exclusion cuts are
  redrawn inside it on the city's line (Lafayette's summit walk, Mount Sutro's track, Mountain Lake's lakeside walk,
  Glen Canyon's side path).
- **Water stays the city's**: an exclusion over a lake takes its water away, so Mountain Lake's exclusion is the shore
  lawn only and the overlook deck reaches over the water as a walk surface (as the Wave Organ's breakwater does).
- **McLaren's La Grande**: the city data carries two OSM water towers side by side (ways 290539043 / 290539044) and does
  not say which is La Grande; the blue tank takes the first, the other stays the city's (the header says so).
- **Changing or lost things are never modelled**: Patricia's Green shows a generic abstract form (its artwork changes),
  Sutro Heights' plinths stand empty (the statues are gone), plaques and monuments (China Beach, the Anza marker) are
  plain stones with blank plates; the cards tell their words.
- **Stairs** (Lyon, Alta Plaza): one box per tread, each tread the higher end of its stretch of slope, so the treads never
  sink and walkers (on the smooth walked ground) stand at most a riser under a tread.
- **Wave Organ**: the walk is a deck of walk surfaces from the tip to the West Harbor's land; the arrival stays lane P's
  viewing spot on the Marina Green shore (where trips end, 23 u across the harbour mouth).
- **Heights**: `height.top` is the measured lod-0 top over the base (lane L's rule); rules are `'H = 3.2 + 0.155·h'` for
  buildings and `'overlook'` for plazas, parks and street settings. Real heights not found in the sources are marked
  estimates in the headers (the Bayview hall's 12 m, the Haas tower's 20 m, the cranes' 25 m).

### Integration plan (the files lane L owns in the integration phase)

1. `src/opus-bay/world/sf/landmarks/w4list3.ts`: move the 15 entries of `W4_SITES_T3_NEXT` (`waveOrgan`,
   `womensBuilding`, `altaPlazaPark`, `buenaVistaPark`, `calle24`, `chinaBeach`, `glenCanyonPark`, `inaCoolbrithPark`,
   `lafayettePark`, `mclarenPark`, `mountSutroOpenSpace`, `mountainLakePark`, `noeValleyTownSquare`, `patriciasGreen`,
   `sutroHeightsPark`) to the end of `W4_SITES_T3` and leave `W4_SITES_T3_NEXT` empty (or drop it and
   `W4_SITES_T3_ALL`, and switch the test and the `sites3-*` scripts to `W4_SITES_T3`), and **in the same commit** re-run
   `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/assets/landmark-tops.ts` (tops.ts gains their 15 rows). The
   tier-3 test's registry check then takes the "registered" branch for them; nothing else changes. If the registered
   list grows in stages, each stage moves its entries and re-runs the tops script in one commit.
2. Nothing else is needed for drawing, walking or flags: W4-IL1 already reads `W4_SITES_T3` in `SF_SITES`, `CitySites`,
   `W4_ALL_SITES` (siteFlagTop, w4SiteOf) and the context helpers.
3. Lanes G / C (optional): a ride hook at the Seward slides — `SEWARD_SLIDES` (seward-street-slides.ts) gives the two
   chute lines (local, bottom → top, y over the site base); the player and BAYBAY sit on cardboard and slide down; the
   slides are walk blockers, the top deck a walk surface.
4. Lane C: cards for the 24 attractions from the module headers (the header facts were checked this run); the
   cautions: Seward (open Tue–Sun 10–5, adults only with a child, closed when wet), Octagon House (2nd and 4th Sundays
   12–3, Feb–Nov), Haas-Lilienthal (docent tours on select days), the Wave Organ (best at high tide), Crane Cove (no
   swimming), Balmy (people live here; murals are artists' works), the sundial and Vermont (residential), Buena Vista
   (the headstone gutters: a fact to tell, never to show), MaestraPeace (by name only), China Beach (no lifeguards,
   swimming not recommended), Glen Canyon (no climbing prompt at the chert), Mount Sutro (UCSF's
   reserve: stay on the trails), Mountain Lake (the Anza plaque's words on the card only), Patricia's Green (the artwork
   changes: never name a piece as current), McLaren (no band imagery for the Jerry Garcia Amphitheater).

### Not done

- **#77 Chinese Telephone Exchange**: gated with the Chinatown pagoda cluster (plan §2.3 / W4-L6); lane V measured
  10.1k of headroom, the rule wants ≥ 10k with room to spare and "build only if another diet frees ≥ 5k": card only.
- **#92 Huntington Park**: its setting extends Grace Cathedral's (an existing landmark module); the lead-merge (§8) routed
  "Grace's Huntington Park steps" to lane L's integration.
- The 15 waiting sites are not drawn by the game until the integration step above (they are tested and previewed
  through `sites3-preview.html`, which appends them to `SF_SITES`).
- The sundial's shadow does not follow the game sun: tier-3 sites cast no shadows today (`castShadow` is T1 only).
- No SoloView sheets or night shots for the tier-3 sites (street and high golden-hour shots only).

### Requests

- **Lane L (integration)**: step 1 above (move the waiting 15, re-run `landmark-tops.ts`), and the Huntington Park
  setting with Grace's (it is #92's attraction: `huntington-park`, place row `osm-w32946958`).
- **Lane V**: re-measure the Mission view (Balmy Alley, Calle 24 and the Women's Building add 1.26k triangles and 3 draws
  within ≈ 300 u), the Marina / Presidio edge (the Wave Organ, Lyon Steps, the Octagon House) and the Pacific Heights /
  Russian Hill view (Alta Plaza, Lafayette, Ina Coolbrith, Haas-Lilienthal: ≈ 1.75k triangles, 8 draws). Each tier-3
  site is ≤ 800 triangles in 2 meshes (model + ground, as the QA measures show).
- **Lanes G / C**: the optional Seward ride hook (`SEWARD_SLIDES`).
- **Lane C**: the cards above; the Crane Cove card can say the two cranes are Cranes 14 and 30.

Status (2026-09-27): 早期阶段完成——24 个地点全部推送（9 个已接进游戏，15 个等接线）；#77、#92 按规定不做。

## Early review 2

Written 2026-09-27 by the adversarial reviewer of lane L3 (worktree `C:/Users/willy/wt/w4-l3`, on `39993fb`). Commit
`W4-L3-review` (one code commit + this section); every change is in lane L3's own files. Higgsfield: 0 credits.

### 给主人的摘要

1. 复查了 L3 做的 24 个小景点：网上抽查了 28 条事实、9 个 OSM 编号，大多数都对。找到并修好三类问题：麦克拉伦公园的蓝色大水塔 "La Grande" 放错了塔（原来放在公园中间两座无名水罐上，真正的 La Grande 在公园西北角山顶，差了约 700 米），已经搬到正确位置并重新截图；有 7 个景点的"游客站位"落在马路车道上（富兰克林街、高夫街、18 街、24 街等），已改到人行道和广场上；日晷的 OSM 编号、中国海滩纪念碑的年份、几处高度数据也已更正。
2. 新增 3 项测试（游客站位不能在车道上、高度按规则、La Grande 和日晷必须在真实位置），全套 opus-bay 测试 839/839 通过。
3. 还没改的只有 P 线的数据：日晷、麦克拉伦等几个景点在地图上的点和到达点，写在下面的请求里，接线时一起改。

### What was checked

- **Rules of the early phase**: every `W4-L9` commit touches only files lane L3 created (checked with `git show --stat`
  on all 20 commits); the two files the lead's `040440d` also touched are the lane's own.
- **Facts on the web (28)**, all confirmed unless listed under the defects: McLaren (313.7 acres, 4th-largest, named 29
  Nov 1926, Philosopher's Way 2.7 mi / 2013 / George Gonzalez's 14 stations, amphitheatre 1970 → Jerry Garcia 2005, La
  Grande 1956 / 350,000 gal / 80 ft, SFPUC upgrade completed 2008); Buena Vista (38.3 acres, 575 ft, 1867 as Hill Park,
  the WPA headstone gutters); Lafayette (12.5 acres, Washington / Sacramento / Gough / Laguna); Octagon House (1861,
  McElroy and Shober, SE corner of Union and Gough, Colonial Dames 1952, 2nd / 4th Sundays 12–3, Feb–Nov); Seward
  slides (1973, Kim Clark, Ruth Asawa's contest, Tue–Sun 10–5, adults with a child, cardboard); Bayview Opera House
  (1888, 4705 3rd St, Geilfuss, youth centre 1989, $5.7 M, a stage with seating); the sundial (10 Oct 1913, 28-ft
  gnomon, 34-ft dial, four columns, the 1895–1905 track); the Wave Organ (May 1986, Richards and Gonzales, 25 PVC pipes,
  Laurel Hill stone, high tide, Oppenheimer); Crane Cove (2020, 7 acres, Nick and Nora, the Transbay Tube 1965–69);
  Haas-Lilienthal (1886, Schmidt, witches' cap, 1906, SF Heritage 1973, National Treasure 2012); Glen Canyon (≈ 70
  acres, "largest remaining creek … with public access", 350 ft in a mile, 19 Mar 1868 – 26 Nov 1869, CHL 1002, WPA
  1937); Mount Sutro (911 ft, Mount Parnassus, 61 acres, 30–40 % fog drip, Rotary Meadow 2004); Mountain Lake (4
  acres, 30 ft, Anza's two days in 1776, plaque Sept 1957, the 2014 clean-up); Sutro Heights (1881, open 1883, city
  1938, razed 1939, 18 acres, the Trafalgar lions, Diana); Alta Plaza (12.9 acres, 1888, Jackson / Clay / Steiner /
  Scott, the 1972 damage still visible); Ina Coolbrith (poet laureate 30 June 1915 at the PPIE); Balmy Alley (1972
  children's murals, 1973 Rodriguez and Carrillo, PLACA 1984 under Patlán); Vermont St (20th–22nd, 1.56 against
  Lombard's 1.2, McKinley Square, US-101); MaestraPeace (1994, the seven artists, Olivia Quevedo, both faces, restored
  2012); the Women's Building (1910, Mission Turn Hall); Calle 24 (May 2014, Board of Supervisors and Mayor);
  Patricia's Green (3 June 2005, Patricia Walkup, the changing sculpture).
- **Coordinates / OSM ids (9)**: Lyon Steps viewpoint 7221410485, the Parapet 1709352211, Lafayette Heights 7707941355,
  Mount Sutro 12056865382, Buena Vista Heights 358803216, the Octagon House, Haas, Women's Building and Opera House
  footprints (their `height` tags too): right. La Grande and the sundial: wrong (defects 1, 2).
- **Wiring**: read `landmarks/index.ts` (SF_SITES), `w4sites.ts`, `context.ts`, `landmark-tops.ts` and every test that
  runs over SF_SITES / W4_ALL_SITES (sf-landmarks W4-IL1 ×3, sf-landmark-context D2-10 / D2-09, sf-sites-w4, sf-models,
  w4-postcards, sf-attractions). The integration step of "## Early phase" (move the 15, re-run landmark-tops.ts in the
  same commit) matches what those tests need. The one check they make that the tier-3 test did not mirror (W4-IL1: every
  plaza site yields crowd spots) is now in it. A trial registration (moving the 15 and regenerating `tops.ts`) was not
  run here because it rewrites a tracked file: run the full suite in the integration commit.
- **Budgets and frames**: all 24 are ≤ 800 triangles with ground (McLaren now 352 + 32), lod 2 ≤ 10 %, ≤ 2 meshes (the
  QA measures 2). There are no `animate` parts and the geometry is built once, so there is no per-frame work or
  allocation. The modules have no zh text (names are lane C's); the report's summary reads fine on a phone.

### Defects found → fixed (commit `W4-L3-review`, tests in `tests/opus-bay-sf-sites-w4t3.test.ts`, now 10 tests)

1. **McLaren's "La Grande" stood on the wrong tank.** La Grande is OSM way 424957085 (water_tower, 23 m, wikidata
   Q118533874 "La Grande Tank", Commons 37°43′23″ N 122°25′27″ W) on the hilltop at the park's north-western edge by
   the Watertower View viewpoint. The record stood on way 290539043, one of two anonymous 13 m, 40 m-wide tanks ≈ 100 u
   (700 m) east in the middle of the park, and drew it 35 m wide where the real tank is 10.8 m wide. Moved to
   (674.79, 1065.88): a slender Tiffany-blue tank (r 1.3, 7 u, conical roof, base ring, ladder), a gravel apron over the
   service drive's ring, two benches and a blank board. The terrain is re-baked, the arrival is by the viewpoint
   (reachable), and the key shot `docs/opus-bay/qa/w4/L3/mclaren-park-high-golden.jpg` is replaced (read: the blue tank
   on the hill above the Excelsior's houses, the apron and benches round it). Test: the site stands within 1.5 u of the
   OSM footprint's centre and cites way 424957085; the registry test lets a big park's feature stand ≤ 130 u from the
   park's map point when its notes say so (McLaren only).
2. **The sundial cited the wrong OSM node.** `node/11903199250` is the Ingleside Terraces neighbourhood label (the
   scouting JSON's lat / lng); the dial is node 6691138540 (amenity=clock). The geometry was right (0.2 u from the dial).
   Test: it cites 6691138540, stands within 1.5 u of it, and no record cites the label.
3. **Crowd spots in the traffic lanes.** Lane F's sightseers stand still at `landmarkPlazaSpots` (exact spots; the
   traffic never waits for a standing walker). The plazas of 7 sites reached over the city's carriageway: Haas 7 / 7
   spots on Franklin St, Octagon 6 / 6 on Gough and Union, the Women's Building 6 / 6 on 18th and Lapidge, Calle 24
   9 / 10 on 24th St, Noe Valley 4 / 5 on 24th St, Ina Coolbrith 2 / 4 on Taylor St, Patricia's Green 2 / 6 on the cross
   streets. The city's sidewalks there are 0.4–0.6 u strips with driveway cuts, so the fix is chosen points on them
   (`siteKit3.standSpot`: a 0.3 u square whose one grid point is its centre) or plazas trimmed to the terraces.
   Bayview's lot gave a single spot (now 2) and two Wave Organ spit spots were not standable (now on the spit's line).
   Test: no candidate spot on a city carriageway outside the site's own exclusion (Balmy's alley is the site's), and
   ≥ 2 standable spots per plaza site; the ≥ 30 u² rule accepts "the crowd spots are … points" sites with ≥ 3 spots.
4. **Height records against their rule** (H = 3.2 + 0.155·h): Octagon said 12 m / 4.4 u (OSM: 8 m, two storeys →
   4.44), the Women's Building 18 m / 5.6 u (OSM 17 m → 5.84, what the city drew), Bayview 12 m / 4.95 u (OSM 10 m →
   4.75). The sundial's 3.4 u gnomon under the policy's 4.5 u is now a stated toy height. `height.u` is not read at
   runtime (the glide reads `top`), so nothing registered changes. Test: `u` within 0.1 u of the rule unless the notes
   say "toy height".
5. **Header facts** that feed lane C's cards: China Beach's monument plate reads "Gift of Henry & Diana Chung Family
   1981" (hmdb 52925, Wikipedia) while NPS dates it 1982; the header now names both (card: "early 1980s"). Calle 24's
   "Balmy Alley opens off the same block" is now "one block west" (between Treat and Harrison).

The registered nine keep their measured tops (only plazas, notes and height records changed): `tops.ts` is untouched
and the D2-10 test passes. Checks on the code commit rebased on `3600806`: tsc 0; `npx eslint .` 0 errors (43 old
warnings); tier-3 test 10 / 10; full opus-bay suite **839 / 839** (821 / 821 before the rebase, on `39993fb`).
Preview shots (dev server 5307, stopped): McLaren street / high, Haas street / high (scratch
`C:/Users/willy/opus-qa/w4/w4-l3/review/qa/`, each read).

### Corrections to "## Early phase"

- Its McLaren lines ("on one of the two OSM water towers … the other stays the city's", way 290539043) are superseded
  by defect 1, its crowd-spot lines for the house museums ("the sidewalks (and the near lanes)") by defect 3, Bayview's
  "12 m" by defect 4 and China Beach's "the 1982 monument" by defect 5.
- Integration step 2 ("nothing else is needed") holds for drawing, walking and flags; the arrivals are lane P's (below).

### Open (not fixed: other lanes' files)

- **Lane P (`data/sf/attractions.ts`, `extraPlaces.ts`), at the integration**: trips to a tier-3 attraction end at lane
  P's `arrival` or its x, z, not at the site's `w4.arrival`, and for these that is wrong. The sundial's point and
  arrival (283.8, 1438 / 284.6, 1437.4) are the neighbourhood label, 10 u from the dial (the dial: 276.15, 1443.84).
  Seward's point (154.7, 832.4, no arrival) lies inside the chutes' blocker and Vermont's (454.3, 506.2) inside a bend
  shrub. McLaren's (773.6, 1075.6) is the park's middle, ≈ 100 u from La Grande, and Mountain Lake's is 26 u from the
  overlook. Suggested: for the 24 tier-3 attractions take the site's world arrival (`sfLandmarkAnchor(siteId)`) as
  `LANDMARK_ARRIVALS` does for the 24 landmarks, and move the sundial's badge to the dial.
- **Lane P / G (design)**: the Wave Organ's trips end on the Marina Green shore, across the harbour mouth from it
  (lane P's arrival, kept by the site). The tip is reachable on foot (tested); ending at the spit's root on Yacht Road
  would bring players to it.
- **Lane C (cards)**: China Beach "early 1980s" (defect 5); La Grande at the park's north-western edge by Watertower View.
- Unchanged from "## Early phase": #77 and #92, the 15 waiting sites, the sundial's shadow, no SoloView or night sheets.
