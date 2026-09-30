# Wave 7 · lane W1 · downtown and the start view

Lane W1 of wave 7 (`docs/opus-bay/sf-w7-lead.md` §3 row W1), worktree `C:/Users/willy/wt/w7-w1` (branch `w7-w1`), dev
port 5708, scratch `C:/Users/willy/opus-qa/w7/w1/`. Higgsfield: 0 credits (not this lane's).

## 给主人的摘要

1. **开局的市中心补齐了**：渡轮大厦对面、金融区南边原来有一片"空铺地"（老数据把那几块街区交给了手工区，手工区却没盖房子）。现在把那里真实的 OSM 房子（39 栋）按城市自己的样式补回来，看得见也会挡路；地铁站口、电车站、街道、广场、树都留出了空地，路网和所有目的地测过都还能走到。
2. 不增加绘制次数（和城里其他房子同一批画）；开局几个视角的三角形数只多了几千。

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
