# Wave 7 · lane W1 · downtown and the start view

Lane W1 of wave 7 (`docs/opus-bay/sf-w7-lead.md` §3 row W1), worktree `C:/Users/willy/wt/w7-w1` (branch `w7-w1`), dev
port 5708, scratch `C:/Users/willy/opus-qa/w7/w1/`. Higgsfield: 0 credits (not this lane's).

## 给主人的摘要

1. **开局的市中心补齐了**：渡轮大厦对面、金融区南边原来有一片"空铺地"（老数据把那几块街区交给了手工区，手工区却没盖房子）。现在把那里真实的 OSM 房子（39 栋）按城市自己的样式补回来，看得见也会挡路；地铁站口、电车站、街道、广场、树都留出了空地，路网和所有目的地测过都还能走到。
2. 不增加绘制次数（和城里其他房子同一批画）；开局几个视角的三角形数只多了几千。
3. **东区新街景**：Transit Center 楼顶的 Salesforce 屋顶公园（离地 70 英尺的草坪、小路和树，走到楼下时自动让开，不挡镜头）；
   Rincon 公园草坪上的「丘比特之箭」大弓箭（金色弓、白弦、红羽毛的箭插进草地）；泛美金字塔脚下的红杉林和青蛙喷泉；
   哥伦布大道口铜绿色的哨兵大厦（白瓷砖横纹、圆角上的铜穹顶）。只多 2 次绘制，手机上看过。
4. **渔人码头 45 号码头边停着二战潜艇「潘帕尼托号」**（灰色艇身、指挥塔、潜望镜、甲板炮，没有文字）。自由轮「奥布莱恩号」没做：
   它在 OSM 里的位置正好压在手工区的海滨步道上，放上去会挡路；原因和下一步写在报告里。

## Part a · W7-W1 the FiDi south-edge seam

Started 20:24 PDT (`date`), on `315704c1`.

### What was built

- **`src/opus-bay/world/sf/cornersNB.ts`**: the seam region is now a list of rectangles — `SEAM_REGIONS` (`SeamRect`
  `{ id, xMin, xMax, zMin, zMax }`): `north-beach` (W6-W1's `x ≤ 60, z ≥ 60`, kept as `SEAM_REGION`) and **`fidi-south`**
  (`x 60…240, z 15…110`: Kearny St to the Embarcadero, Pacific Ave down to Market / Mission — the band the Ferry gate and
  the fidi perf spot look straight over); `seamRegionAt(x, z)` answers the region of a point.
- **`scripts/opus-sf/seam-fill.mts`**: candidates are the hero-owned blocks' buildings whose centroid lies in any region
  (the graph filter follows the regions too); `--why` prints every candidate left out and why, the summary counts per
  region. **New exclusions** (the district has more in the FiDi band than in North Beach): the district's `track` and
  `crosswalk` ribbons (the F-line along the Embarcadero), its walk areas (plazas, platforms, Rincon Park), its props
  (trees, lamps, benches, kiosks: nothing may stand inside a fill building), and the transit stops — the wave-4 board
  spots (`transit.json` props: poles / kiosks on the sidewalk) keep 2.5 u of open ground round them, the line stops on
  the centreline 1.2 u.
- **`src/opus-bay/world/sf/cornersSeamData.ts`** regenerated from `C:/Users/willy/opus-qa/sf-data/raw` (osm_base
  2026-09-26): **130 rows = 91 North Beach + 39 FiDi**. 206 candidates in 51 empty hero-owned blocks; FiDi: 77
  candidates → 39 kept (26 on a district street ribbon, 5 on a district lot, 5 in a hero exclusion circle, 1 on a
  graph edge, 1 walling in the Muni Embarcadero kiosk). The 91 North Beach rows are W6's 92 byte-for-byte minus one:
  `262112732` at (−66.1, 83.2) stood over a district tree (the tree's trunk was inside the building since W6).
  Same pools, same collision path (`world/sf/build.ts addSeamFill` in the stream worker): **0 new draw calls**.
- **Tests**: new `tests/opus-bay-w7-w1-seam.test.ts` (3): the regions (every row in one, ≥ 35 FiDi rows, the Ferry
  Building not a seam); the FiDi fill clear of every lot city mode keeps, the district's street / track / crosswalk
  ribbons, walk areas, props, the four exclusion circles (Transamerica 8.5, Salesforce Tower 7.5, Embarcadero Plaza 11,
  Redwood Park 4) and the wave-4 board spots (2.5 u); in city mode the tallest FiDi fill building is solid, no walking-
  graph edge through the band runs within 0.3 u of a fill building, route stops standable, trip ends outside the fill.
  `tests/opus-bay-w6-w-seam.test.ts`: the row-in-region check reads `seamRegionAt` (one line).
- Red → green on the way: the first fill (40 FiDi rows) walled in `muni-embarcadero` (127.73, 75.44) — the suite's
  `review R6 … every wave-4 pole / kiosk … joined to the street` failed (`walkReach 0.0 u`); the board-spot rule fixed
  it and the new test asserts it.

### Evidence

- Checks (this tree): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · suite
  `tests/opus-bay-*.test.ts` **1492 / 1492**.
- Static sweep (`scripts/opus-sf/qa/sweep-static.mts`): 688 targets · ok 545 · CORRIDOR 142 · **BOXED 0 · SNAG 0** ·
  UNREACHABLE 1 (`trip:ss-jeremiah-obrien`, as before: part c) — identical to W6-Z's counts.
- Calls / triangles (`scripts/opus-sf/qa/budget-views.mjs`, 1440 × 900, quality high, golden hour; the perf spots'
  own positions and facings; read, not fps; actors / streetcars move between runs, so ± a few calls is noise):

  | spot | before (`315704c1`) | after (the fill) |
  |---|---|---|
  | fidi (82.1, 125.3) → (120, 40) | 94 / 262.6k | 100 / 275.7k |
  | ferry-gate → (60, 120) | 100 / 353.7k | 101 / 348.5k |
  | chinatown (Dragon Gate) | 123 / 289.6k | 123 / 291.5k |
  | pier45 | 81 / 182.7k | 81 / 183.9k |
  | over the Embarcadero → SW (start-sw) | 95 / 339.6k | 98 / 343.4k |

  The fill's buildings are in the city pools (L0 chunk count goes up by one or two where the band is in view: the calls
  above are chunk / actor noise, not a new mesh). Ferry-gate stays under its W6-Z 365k.
- Shots (same camera before / after, desktop): over the Embarcadero looking south-west across the band
  `qa/w7/W1/w1-start-before.jpg` → `w1-start-after.jpg` (the open lot behind Embarcadero Plaza's trees now has its
  buildings); from above the band toward the Ferry Building `w1-seam-top-before.jpg` → `w1-seam-top-after.jpg` (the
  towers west of the Salesforce Tower; the Muni kiosk keeps its forecourt).

### Decisions

- **The region stops at z 110** (the slab's south edge is z 114): the Transit Center / Salesforce Park block is not a
  seam block (its OSM building belongs to the city side); part b draws the park's deck edge instead.
- **Buildings that meet a district street are left out**, not cut: the district's hand-made street grid does not match
  OSM's everywhere (26 FiDi candidates sit on a district ribbon); cutting footprints would leave odd slivers.
- **A district prop inside a fill footprint drops the building** (it applies to North Beach too: one W6 building went).
- The Muni kiosk rule is general (every wave-4 board spot, 2.5 u), so later fills cannot wall in a pole.

### Known gaps

- 38 FiDi candidates stay out (streets, lots, exclusions): the band is filled where the district's own streets allow,
  not every OSM building.
- The fill's buildings take the city's L0 / L1 look (grey-blue office boxes): lane X's façade work covers them as it
  covers the rest of downtown.

### Not done (this part)

- Nothing of W7-W1 (1)'s scope.

### Requests

- None.

## Part b · W7-W12 the East Cut / Embarcadero corner (+ the Sentinel's block)

Started 21:45 PDT (part a pushed 22:13 as `7e93789a`: tsc 0 · eslint 0 errors · suite 1512 / 1512 on the rebased tree;
the second rebase brought lanes P, H, S only — tsc, eslint and the seam / transit-review / look / hero / budget /
landmarks tests re-run, 56 / 56).

### What was built

- **`src/opus-bay/world/sf/cornersEastCut.ts`** (new): `attachEastCut()` — a city-only WorldSystem on the North Beach
  pattern, registered in **`world/sf/cityWorld.ts`** (2 lines + detach). **Two TOY meshes** (no new program) in one
  `THREE.LOD` centred at `EC_CENTER` (118, 72), drawn within `EC_CULL` 215 u, built the first time the camera comes within
  290 u; no shadows cast; soft obstacles for the redwood trunks, the fountain and the sculpture's feet. 3,167 triangles in all (the test's budget 7,000).
  - **Salesforce Park** on the Transit Center's OSM footprint (way 542375290, simplified `TC_RING`, x 170–178, z 84–145):
    the glass base (lit at night), the undulating white skin (billowing panels, most bulge at mid-height), the rim, the
    roof lawn at **70 ft = toy 6.46 u** (`TC_ROOF`, the game's height rule), a winding path, the roof trees (round ones
    and a few conifers) — its own mesh, which **hides while the player stands within 2.5 u of the footprint or the
    camera is on / under it** (`deckHidden`): the city's ground-level park strip and the streets under the Transit Center
    stay walkable, and the follow camera never looks at the player through a deck the collision does not know.
  - **Cupid's Span** on the district's Rincon Park lawn (walk `rincon-park`, between its benches and trees, facing the
    promenade): the golden bow (12 tapering beams, its lower tip in the lawn), the white string up to its top at
    **64 ft = toy 6.2 u**, the silver arrow nocked at the string's middle and driven through the grip into the lawn, three
    red feathers.
  - **Redwood Park**: nine coast redwoods (two-tier cones 4.6–5.7 u, red-brown trunks) in the district's empty r 4
    circle at the Pyramid's foot, and the fountain with lily pads and three bronze frogs.
  - **The Sentinel**: a copper-green shell over its seam-fill row — seven dark window bands with white tile bands, a
    white base and cornice, the **copper dome** on a drum over the rounded tip, a finial.
- **The Sentinel's block** (`world/sf/cornersNB.ts`, `scripts/opus-sf/seam-fill.mts`): OSM's flatiron (way 288485994) was
  merged with its neighbour and carved away whole by the build, and its footprint lies on the district's own street
  ribbon (`street-kearny-1`, 0.8 u into it: the hand-made grid is not OSM's). So:
  - `SEAM_DROP_LOT_IDS = ['lot-117']`: city mode hides the district's one plain 13 u office box over the whole block
    (like W6's `lot-211`; `nbDropLots` answers it, `hero.ts` / `stream.ts` / `cityWorld.ts` already use it). District
    mode keeps it. The fill then gives the block its real OSM buildings (8).
  - `SEAM_EXTRA_OSM` / `SENTINEL_RING` / `SENTINEL_TIP`: the toy Sentinel stands in the district's own corner where
    `street-kearny-1` (Columbus Ave's line) and `street-jackson-0` meet, 1.75 u in from both centrelines, 4.6 u back
    along each, the tip rounded; the script writes it as a fill row with OSM's tags, as a plain `industrial` prism
    0.8 u under the shell's top (`SENTINEL_H` 7.7 u = 29 m; no façade remap, no office crown or roof clutter poking
    through the shell — part c: `brick` failed the look test's "SoMa brick stays brick" after lane X's façade remap);
    the block's fill buildings give way to it. `--trace <osm>`
    tells where a building left the build (raw / merged / carved / kept).
  - Now **139 rows** (99 North Beach incl. the Sentinel's block, 39 FiDi, the Sentinel).
- **`data/sf/attractions.ts`** (my rows only): `ARRIVAL_OVERRIDES['sentinel-building']` (24.2, 109.4) facing the tip and
  the dome (the old end stood 0.6 u off its wall in the carriageway). Cupid's Span keeps the scouting's trip end (see
  Decisions).
- `world/sf/cornersNorthBeach.ts`: `NB_BUDGET` 8,000 → 9,000 triangles (the new fill buildings on the Sentinel's block
  give Columbus Ave one more café front: 8,260 triangles).
- **Tests**: new `tests/opus-bay-w7-w1-eastcut.test.ts` (4): 2 meshes, ≤ 7,000 triangles, one material, the deck on its
  footprint at 70 ft, every piece ≥ 60 u inside the cull; the deck's hide rule (player under it, at its edge, camera
  under it; shown from the Ferry Building and from high above); the Sentinel's row (7.7 u, brick, `SENTINEL_RING`, clear
  of every district roadway / path ribbon; part c: the row is `industrial`, 0.8 u under `SENTINEL_H`), lot-117 hidden in city mode and kept in the district; in city mode every
  soft obstacle > r + 0.3 u from the walking graph and clear of the district's roadways / tracks / lots, the sculpture's
  feet on the Rincon lawn ≥ 1.5 u from its benches and trees, the Sentinel solid, its new trip end standable, the grove
  enterable, the ground park under the deck standable. `tests/opus-bay-w6-w-seam.test.ts`: the drop lots are now
  `['lot-117', 'lot-211']` (one line).

### Evidence

- Shots (read; desktop 1440 × 900 and phone 390 × 844 dpr 3 quality mid): the roof park on the Transit Center from the
  north-east `qa/w7/W1/w2-salesforce-park-desk.jpg` and on the phone from the east `w2-salesforce-park-phone.jpg` (lawn,
  winding path, trees, the rim); Cupid's Span face-on from the promenade `w2-cupids-span-desk.jpg` (bow, string, arrow,
  red feathers among the lawn's trees and benches) and walking on the lawn on the phone `w2-cupids-span-phone.jpg` (the
  player and BAYBAY by it, the Bay Bridge behind); the Sentinel on the phone `w2-sentinel-phone.jpg` (green copper and
  white bands, the dome over the rounded corner); the redwood grove `w2-redwood-park-desk.jpg`.
- Calls / triangles (budget-views, 1440 × 900, high, golden hour; read, not fps):

  | spot | before (`315704c1`) | after part a | after part b |
  |---|---|---|---|
  | fidi | 94 / 262.6k | 100 / 275.7k | 99 / 273.5k |
  | ferry-gate | 100 / 353.7k | 101 / 348.5k | 104 / 357.7k |
  | chinatown | 123 / 289.6k | 123 / 291.5k | 123 / 289.3k |
  | pier45 | 81 / 182.7k | 81 / 183.9k | 81 / 185.5k |

  Ferry-gate stays under W6-Z's 365k (the corner's two meshes draw from there). The phone views above read 63–77 calls /
  181–224k at quality mid.
- Checks: see the push line below.

### Decisions

- **The deck hides when you are at it.** A 6.5 u deck over the city's walkable ground-level park (the published graph
  has ~60 path edges inside the footprint) cannot be solid without cutting the streets that pass under the Transit
  Center; a phantom roof over a walker would hide them from the follow camera (its ray test only knows buildings). So
  it is seen from everywhere else — the skyline, the streets round it, the hills — and steps aside when you walk in (the
  toy-game roof convention).
- **Cupid's Span on the district's lawn, its trip end unchanged.** OSM's Rincon Park lies under the district's Embarcadero
  roadway; the only park the district draws there is the lawn by the water (x 184–204). The published walking graph runs
  6+ u inland of it (OSM's positions), and a moved arrival must be ≤ 3 u from the graph (`tests/opus-bay-sf-attractions`
  P2), so the trip still ends at the scouting's spot across The Embarcadero (≈ 24 u, the sculpture in view); the lawn
  itself is walkable (the phone shot stands on it).
- **The Sentinel stands in the district's corner, square not acute.** The district's Kearny / Jackson ribbons meet at
  90°; OSM's footprint would sit on the district's road. Colour, bands, the dome and the rounded tip carry it.
- Colours: the bow golden-ochre, the string white, the shaft stainless, the feathers red (descriptions: "red and yellow",
  "the silver arrow has red feathers"; the fabricator's page gives the materials); the Sentinel copper-green with white
  tile (noehill.com: white tile and copper, a copper dome).
- `sentinel-building` / `salesforce-park` stay `treatment: 'defer'` in the rows (the JSON sync test pins treatments);
  the models are this corner's.

### Facts (checked on the web 2026-09-29)

- Salesforce Park: 5.4 acres, 70 ft above the street, 600 trees; Beale St to Second St —
  https://www.tjpa.org/salesforce-transit-center/salesforce-park , https://en.wikipedia.org/wiki/Salesforce_Transit_Center ;
  the skin: 3,992 perforated white aluminium panels, a Penrose pattern, an undulating cloud —
  https://www.architecturalrecord.com/articles/13595-salesforce-transit-center-by-pelli-clarke-pelli-architects-opens-in-san-francisco ,
  https://archello.com/project/salesforce-transit-center
- Cupid's Span: Oldenburg and van Bruggen, 2002, Rincon Park, fiberglass and steel, partly set in the ground; 64 ft by the
  artists (60–70 ft elsewhere); stainless shaft, gelcoat feathers — https://en.wikipedia.org/wiki/Cupid's_Span ,
  https://www.kreysler.com/projects/all/sculpture/cupid-span
- Transamerica Redwood Park: half an acre, 80 redwoods from the Santa Cruz Mountains (1972), the fountain's jumping frogs
  (Richard Clopton, 1996) — https://www.tclf.org/landscapes/transamerica-redwood-park
- Sentinel Building (Columbus Tower): 916 Kearny St, completed 1907, flatiron, white tile and copper, a copper dome —
  https://noehill.com/sf/landmarks/sf033.asp , https://en.wikipedia.org/wiki/Columbus_Tower_(San_Francisco) ; OSM way
  288485994 (height 29 m, 7 levels).

### Known gaps

- Salesforce Park is not walkable on the roof (no gondola, elevator or stairs); the ground-level park the city draws
  stays where OSM's footways are.
- From the Ferry plaza the downtown towers hide the deck; it reads from the east (Main / Beale), from above and from the
  hills.
- Cupid's Span's trip end is across The Embarcadero (Decisions).
- The Sentinel's wedge is square (the district's corner), and the Pyramid lines up behind it only from south of
  Columbus Ave.

### Not done (this part)

- Nothing of the East Cut item's scope.

### Requests

- **Lane X** (optional): the Transit Center's white skin could carry a perforation pattern in the TOY shader's window
  styles if a style id is spare.

## Part c · W7-W13 USS Pampanito at Pier 45 (+ the Sentinel prism fix)

Started 23:40 PDT (part b committed as `f2843de8`; its full suite on the rebased tree: 1582 / 1586 — the look test's
"SoMa brick stays brick" (mine: fixed in this part, below) and three wall-clock / load cases that pass alone
(`E2-5 view field`, `W5-bus 20+ simulated minutes`, `W5-D-review the paid memo … 100.4 ms`)).

### What was built

- **`src/opus-bay/world/sf/wharfShips.ts`** (new): `attachWharfShips()` — a city-only WorldSystem (registered in
  `world/sf/cityWorld.ts`, 2 lines + detach), ONE TOY mesh in a `THREE.LOD` (cull 180 u, built within 250 u), no
  collision (it lies in the water): **USS Pampanito** on OSM's hull (way 165601339, `building=ship`, ref SS-383;
  13.1 u = the Balao class's 311 ft 9 in): the long grey hull low in the water (axis 0.1 u over the water at −0.6),
  the tapered bow and stern, the casing deck, the sail (conning tower) with its bridge, two periscope masts, the deck
  gun forward of it; no lettering. 1 draw call where it is in view, 204 triangles.
- **The Sentinel's prism** (`scripts/opus-sf/seam-fill.mts`, `cornersNB.ts SENTINEL_H`, `cornersEastCut.ts`): after the
  rebase onto lane X's façade work (`W7-X1`: `brick` joined the façade styles) the look test's "SoMa brick stays brick"
  failed on the Sentinel's `brick` row (red on the suite, green after): the row is now `industrial` (exempt, no façade
  remap), its height 0.8 u under the shell's `SENTINEL_H` 7.7 u so its roof clutter stays inside the shell.
- **Tests**: new `tests/opus-bay-w7-w1-ships.test.ts` (1): one mesh ≤ 1,500 triangles, inside OSM's ring, 12.5–14 u long,
  the keel under the water and the masts ≤ 3 u over it, the pier45 perf spot within the cull.
  `tests/opus-bay-w7-w1-eastcut.test.ts`: the Sentinel row check follows (industrial, 0.8 u under `SENTINEL_H`).

### Evidence

- Shot (desktop, golden hour, read): the submarine alongside Pier 45's shed, in the water, the sail and periscopes
  `qa/w7/W1/w3-pampanito-desk.jpg` (taken just before a small colour lift: the hull reads a little lighter now).
- Static sweep after parts b + c (`sweep-static.mts`, the tree with lanes S / H / X …): 694 targets · ok 548 · CORRIDOR 145
  (the 3 new ones are lane S's new venues: `venue:fort-mason-festival-pavilion`, `venue:irving-11th`,
  `venue:potrero-20th`; none of this lane's targets changed verdict) · **BOXED 0 · SNAG 0** · UNREACHABLE 1 (the O'Brien).
- pier45 (budget-views, the perf spot's own spot facing the berth): 91 calls / 191.4k (the facing differs from the
  table's (−140, 75): +1 mesh where the sub is in view); a camera over the water at the sub: 74 / 185.9k.
- Checks: see the final line.

### Decisions

- **No SS Jeremiah O'Brien, no arrival row for it.** OSM's hull (way 1280748838: x −122…−136, z −1…−14) lies on the
  district's promenade band by Pier 35 (the district's seawall is further out), so a hull there would block the
  promenade. The trip end (−130.1, −8.3) stands on that band, which the published walking graph never comes within 3 u
  of (the nearest edges run along z ≈ 6.5, over ground the stand raster calls blocked); an `ARRIVAL_OVERRIDES` row must be
  ≤ 3 u from the graph (`tests/opus-bay-sf-attractions` P2), and the one spot tried (−124.5, 4.5) is OFF (not standable).
  The sweep's only UNREACHABLE stays — Requests.
- The Pampanito needs no collision: the berth is water beside the pier.

### Facts (checked on the web 2026-09-29)

- USS Pampanito: WWII Balao-class fleet submarine (1943), a museum and memorial at Pier 45, run by the San Francisco
  Maritime National Park Association — https://www.nps.gov/places/uss-pampanito.htm ,
  https://en.wikipedia.org/wiki/USS_Pampanito , https://maritime.org/visit-us/
- SS Jeremiah O'Brien: "Located on the North end of Pier 35, near the intersection of Kearny St, North Point St and The
  Embarcadero", daily 10:00–16:00 — https://ssjeremiahobrien.org/visit-us/

### Known gaps / Not done

- (3) Chinatown's pagoda cluster (Sing Chong / Sing Fat, Old St. Mary's, the Telephone Exchange): not started (time).
- (4) the SS Jeremiah O'Brien and its trip end (Decisions).
- (5) North Beach leftovers (Columbus Ave asphalt inside the slab, the café clusters off the path / the 4 CORRIDOR
  targets): not started (time).

### Requests

- **Lead / lane B or N (a later wave)**: the Pier 35 promenade band (x −140…−110, z −14…0 in city mode) has no walking-
  graph edge within 3 u, so neither the O'Brien's trip end nor a moved arrival can be walked to: either a graph edge
  along the district's promenade there (the graph is published data) or a waiver of the P2 3 u rule for this row; then
  `ARRIVAL_OVERRIDES['ss-jeremiah-obrien']` at ≈ (−128, −6) facing the berth, and the ship on the Pier 35 north face.

## Final checks (00:44 PDT)

- Pushed: `7e93789a` (W7-W11, part a), `dc9f1099` (W7-W12, part b), `30028e90` (W7-W13, part c) on `origin/opus-bay`.
- The combined tree (parts a–c, rebased on `4bc614be`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
  (43 old warnings) · suite **1585 / 1587**: `E2-5 view field in the city` (wall-clock) passes alone; `W5-bus 20+
  simulated minutes` fails identically (bus at an interlock 29.2 s, box:f-line@5661:750, (149, 601)) on a clean
  `origin/opus-bay` at `1903d52f` without this lane's commits (a check worktree) — lane B's test (their W7-B9 pins the
  Bay clock since). Static sweep 694 targets: 0 BOXED · 0 SNAG · 1 UNREACHABLE (the O'Brien, as before).
- After the last two rebases (lanes K, X, V, M, S, Q, G, P, R, B, W2): tsc 0 · eslint 0 errors · this lane's tests + the
  look / attractions / transit-review / hero regression / landmarks / budget tests 87 / 87, then 52 / 52.
- District mode: untouched (every change is in the city worker's fill or city-only world systems; lot-117 and lot-211
  are hidden in city mode only; the hero regression is green).
