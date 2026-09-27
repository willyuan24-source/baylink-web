# SF data acquisition for Opus Bay (whole San Francisco) — KEY sf-data

Research phase, 2026-09-26 (PDT). Nothing under `C:/Users/willy/baylink-opus` or the main `baylink-web` checkout was modified. Everything below is on disk under `C:/Users/willy/opus-qa/sf-data/` so implementers can start right away.

## TL;DR

- **All raw layers are downloaded**. OSM comes twice, from Overpass (`osm_base` 2026-09-26) and from a BBBike snapshot (2026-09-19/20, PBF + XML): buildings, highways, railways incl. cable car, landcover/water/coast, POIs, boundary, wider-Bay backdrop. Also a z14 SF DEM (7.5 m cells), a z11 Bay DEM (60 m cells), the DataSF LiDAR building-height table and DataSF neighbourhood polygons. Total ≈ 614 MB on disk.
- **SF inside its city boundary (in the bbox)**: 161,463 buildings, 139,846 (86.6 %) with an OSM `height` tag, 157,996 (97.9 %) with a height once the DataSF LiDAR join is added; only 3,194 have `building:levels` and 421 have `roof:shape`. Roads: 4,552 km of `highway=*`, of which ≈ 2,340 km is drivable (residential 1,101 km, service 442, tertiary 223, secondary 208, primary 128, motorway 76), plus 1,907 km of mapped sidewalks/footways and **2,618 stairways (35 km)**.
- **Land area check**: DEM-land inside the boundary = **121.4 km²** (the official SF land area is 121.4 km² / 46.9 mi²), so the mask and DEM line up.
- **Projection verified**: my re-implementation of `district.ts` `project()` agrees with the imported original to ≤ 0.005 u on 6 points (the difference is only its 0.01 u rounding). **At the current 0.14 u/m, SF land spans x −795…1,275 and z −597…1,921 (2,071 × 2,518 u, ≈ 2.38 M u²).** The present district covers 2.2 % of that.
- **Landmarks**: `sf-data/landmarks.json` holds 69 SF landmarks/neighbourhoods and 11 backdrop points. Each has lat/lng, world x/z, OSM id, the height with its source, DEM ground elevation and notes. Multi-point landmarks (both bridges, Twin Peaks, Presidio) carry per-part coordinates.
- **Overpass**: every requested layer came through Overpass (all tiles re-served by `overpass-api.de` at `osm_base` 2026-09-26). It needed 38 retried attempts (HTTP 504/429) and one fix: my first `[maxsize:2000000000]` header made every server park the requests. The Overpass copy and the BBBike copy agree to within 0.1 % (buildings 171,514 vs 171,517; railways 2,192 = 2,192). `landmarks.json` built from either gives identical ids.

## 1. What is on disk

### 1.1 File inventory (`C:/Users/willy/opus-qa/sf-data/`)

| file | size | what | source / license |
|---|---|---|---|
| `raw/bbbike/SanFrancisco.osm.pbf` | 32.9 MB | full OSM snapshot, bbox −122.54…−122.32 × 37.54…37.93 (SF + Sausalito, Daly City, Brisbane) | BBBike extract 2026-09-19, ODbL |
| `raw/bbbike/SanFrancisco.osm.gz` | 76.4 MB | same snapshot as OSM XML (parsed by stdlib Python, no osmium needed) | BBBike 2026-09-20, ODbL |
| `raw/bbbike-osm-buildings.json` | 120.4 MB | 171,517 building / building:part ways+relations, full geometry + all tags (SF bbox) | derived from the above |
| `raw/bbbike-osm-highways.json` | 31.9 MB | 67,858 `highway=*` ways with geometry + tags (class, name, lanes, bridge, tunnel, oneway, incline, surface, sidewalk…) | " |
| `raw/bbbike-osm-railways.json` | 2.9 MB | 1,268 rail ways + 870 stop/station nodes + 54 route relations (cable car, F-line, Muni Metro, BART, Caltrain) | " |
| `raw/bbbike-osm-landcover.json` | 10.2 MB | 11,639 landuse/leisure/natural/water/pier/breakwater/parking/area:highway polygons + coastline | " |
| `raw/bbbike-osm-pois.json` | 2.2 MB | 7,785 POIs as centres (tourism, historic, towers, named amenities/parks, places, peaks, wikidata-tagged) | " |
| `raw/bbbike-osm-backdrop.json` | 1.7 MB | coastline (230 ways / 338 km within the extract), motorway/trunk bridges, town labels, peaks, islands, named water | " |
| `raw/osm-boundary-rel111968-full.json` | 0.2 MB | SF city-and-county boundary, relation **111968** (admin_level 6), 19 ways / 1,028 nodes | OSM API 0.6 `/full`, ODbL |
| `raw/osm-{buildings,highways,landcover,railways,pois,backdrop,boundary}.json` | 120.3 / 31.8 / 10.1 / 4.0 / 4.1 / 3.3 / 0.05 MB | the same layers fetched live through Overpass (`osm_base` 2026-09-26). `osm-backdrop.json` covers the **wide Bay box** 37.45–38.05 × −122.75…−122.10: 412 coastline ways / 804 km, Richmond–San Rafael / San Mateo / Dumbarton / Bay Bridge decks, 70+ town and island labels, peaks incl. Mt Tamalpais East Peak 784 m | Overpass API, ODbL |
| `raw/dem-sf-z14.f32` + `.json` | 15.8 MB | **1981 × 1990 float32** DEM, bbox 37.700–37.835 × −122.520…−122.350, cells 7.55 × 7.50 m, bathymetry negative (min −114.8 m in the Golden Gate, max 284.0 m at Mt Davidson) | AWS Terrain Tiles (terrarium) z14, 81 tiles |
| `raw/dem-bay-z11.f32` + `.json` | 4.2 MB | **947 × 1106 float32** wider-Bay DEM, 37.45–38.05 × −122.75…−122.10, 60 m cells (max 783 m = Mt Tamalpais) | terrarium z11, 25 tiles |
| `raw/terrain/z14/*.png`, `z11/*.png` | 6.8 + 2.7 MB | the raw terrarium tiles (`h = R*256 + G + B/256 − 32768`) | " |
| `raw/sf-landmask-z14.u8` + `.json` | 3.9 MB | uint8 on the DEM grid: 0 outside SF, 1 SF land (DEM > 0.5 m), 2 SF water; `sf-landmask-preview.png` | derived (boundary × DEM) |
| `raw/datasf-buildings.json` | 150.3 MB | 177,023 DataSF footprints with 2010-LiDAR `hgt_median_m`, `hgt_maxcm`, `gnd_min_m`, `peak_1st_m` | DataSF `ynuv-fyni`, PDDL |
| `raw/osm-datasf-height-join.json` | 3.7 MB | OSM way id → [LiDAR max m, LiDAR median m] (footprint containing the OSM centroid) | derived |
| `raw/datasf-neighborhoods-j2bu-swwd.geojson` | 1.7 MB | 41 "Analysis Neighborhoods" polygons (`nhood`) for zone labels | DataSF, PDDL |
| `raw/*-stats.json`, `insf-stats.json`, `sf-bounds-world.json` | small | counts used in this report | derived |
| `landmarks.json` | 63 KB | 69 landmarks + 11 backdrop points (§5) | derived |
| `sf-world-preview.png` | 1960×2120 | top-down QA map in **world units** (0.8 px/u, 256 u grid): DEM land/water, every building footprint shaded by height, today's slab outline, all landmarks and their `points` | derived |
| `tools/*.mjs, *.py, *.mts` | — | every script used (re-runnable, see §9) | — |

Timing (wall clock): terrain tiles + both DEM grids 8.8 s; DataSF 177k rows 24 s (8 pages of 25k); BBBike download 10 s, XML→layers 74 s (3,719,102 nodes / 445,094 ways / 10,270 relations parsed); OSM boundary 1 s; Overpass ≈ 52 min wall clock for ≈ 380 s of actual query time (§1.3). Whole session ≈ 80 min, most of it waiting on Overpass.

### 1.2 Grid headers (for loaders)

`dem-sf-z14.json` uses cell-centre registration. The sample is `lat = 37.835 − (row + 0.5)·6.78494e-5` and `lng = −122.52 + (col + 0.5)·8.58307e-5`, little-endian, row 0 = north. Bilinear lookup:
`c = (lng − originLng)/dLng − 0.5; r = (originLat − lat)/dLat − 0.5` (same code in `tools/build-landmarks.mts` `demAt`).
The z11 header has the same schema with `dLng = 6.866e-4`.

### 1.3 Overpass run (requested primary source)

`tools/fetch-osm.mjs` (endpoint order private.coffee → overpass-api.de → kumi, retries with backoff, tile splitting: buildings 4×4, highways/landcover 2×2) writes `raw/osm-<layer>.json` in the same one-element-per-line format as the BBBike files, so every tool accepts either prefix (`node tools/stats.mjs osm`).

| job | queries (tiles) | query time | payload | elements | Overpass vs BBBike |
|---|---|---|---|---|---|
| boundary (`rel(111968)`) | 1 | 0.9 s | 0.1 MB | 1 | same relation |
| railways (+ route relations, stop nodes) | 1 | 14.4 s | 5.7 MB | 2,192 | 2,192 |
| pois (`out center`) | 1 | 17.0 s | 5.9 MB | 7,785 | 7,785 |
| highways | 4 (2×2) | ≈ 19 s | 42 MB | 67,874 (4,817 km) | 67,858 (4,816 km) |
| landcover | 4 (2×2) | 23.3 s | 13.8 MB | 11,636 | 11,639 |
| buildings (ways `out tags geom`, relations `out geom`) | 16 (4×4) | ≈ 150 s | 157 MB | 171,514 (143,413 with height) | 171,517 (143,418) |
| backdrop (wide Bay box) | 1 | 15.5 s | 4.4 MB | 2,039 | 796 (extract box only) |

What happened:
- **504s at first.** `private.coffee` and `kumi` timed out and `overpass-api.de` returned 504 for 40 minutes. The cause was my `[maxsize:2000000000]` header: servers wait to reserve 2 GB before starting. I removed it and use `[timeout:180]` with the 512 MiB default.
- **Retry policy.** After that, `overpass-api.de` still answers 429/504 about half the time, since it limits concurrent slots per IP. Retrying the same endpoint after 60 s (`tools/fetch-osm.mjs` `runQuery`) works. There were 38 failed attempts in total: de 504 ×22, de 429 ×9, kumi 504 ×6, private.coffee 504 ×1.
- **Stale mirrors.** The mirrors serve old snapshots: kumi `osm_base` 2026-06-01 / 07-15, private.coffee 2026-07-28. I re-fetched the 4 tiles they had served (pois, highways tile 3, buildings tiles 12 and 15) from `overpass-api.de` with `REFRESH=… node tools/fetch-osm.mjs`. Replace semantics removed 50 + 31 stale elements, so every `osm-*.json` is now the 2026-09-26 state.
- **Which copy to use.** The in-SF numbers in §2 come from the BBBike copy (the landmask/join scripts read `bbbike-osm-*`). They differ from the Overpass copy by < 0.1 %. Implementers should build from `osm-*.json` (fresher) and keep the BBBike PBF as the frozen, checksummable snapshot.

## 2. Counts and coverage

### 2.1 Buildings

| metric | bbox (SF + Daly City strip + Marin headland) | inside SF boundary |
|---|---|---|
| building ways + relations | 169,839 (+1,678 `building:part`) | **161,463** (+1,650 parts) |
| with `height` | 143,418 (83.6 %) | 139,846 (86.6 %) |
| with height **or** LiDAR join | — | **157,996 (97.9 %)** |
| with `building:levels` | 3,869 | 3,194 |
| with `roof:shape` | 421 (flat 172, gabled 96, hipped 73, skillion 25, pyramidal 24, dome 18) | — |
| with `name` | 3,388 | — |
| footprint area | 32.5 km² | — |

- Tag values: `building=yes` 157,139, house 4,134, apartments 3,920, residential 1,113, terrace 634, retail 333, school 226, commercial 206, office 153, church 91.
- Height distribution: 0–6 m 16,584 · 6–10 m 97,477 · 10–15 m 25,903 · 15–25 m 2,244 · 25–50 m 674 · 50–100 m 324 · ≥100 m 212. DataSF agrees: median 6.57 m, p90 11.1 m, p99 18.4 m, 50 footprints ≥ 100 m.
- Tallest tagged: Salesforce Tower 326 (way 431972186, plus ten 3D parts), Sutro Tower 298 (rel 3829019), Transamerica 260 (way 24222973), 181 Fremont 244.4 (way 445566153), 555 California 226 (way 288511106).
- **Quality**: OSM heights come from the same LiDAR survey. On 141,237 buildings that have both, OSM − LiDAR median is 0.04 m, |Δ| median 0.24 m, p90 0.45 m. The join fills 18,467 of the 26,551 untagged footprints. Building parts exist for a few heroes (Golden Gate towers, Salesforce, Bay Bridge W-span towers, `ref` W2/W3/W5/W6, `height` 160).
- Real SF is ~98 % low-rise (< 15 m: 97.6 % of tagged OSM heights, 98.3 % of DataSF footprints). Only ~1,200 buildings exceed 25 m, almost all in the FiDi/SoMa/Rincon/Mission Bay wedge. That wedge is where a skyline needs individual models; everything else can be generated.
- Density per world chunk (bounds-centre, inside SF): 64 u chunks → 634 non-empty, mean 253, max 761 buildings. **128 u chunks → 180 non-empty, mean 892, p90 1,888, max 2,592.** 256 u → 57 non-empty, max 7,819. Average ring = 11.4 unique vertices.

### 2.2 Roads and paths (inside SF boundary)

| class | ways | km real | km in world (×0.14) |
|---|---|---|---|
| footway (mostly sidewalks) | 38,019 | 1,907 | 267 |
| residential | 5,961 | 1,101 | 154 |
| service | 8,337 | 442 | 62 |
| tertiary / secondary / primary | 2,222 / 2,467 / 1,654 | 223 / 208 / 128 | 31 / 29 / 18 |
| motorway (+link) / trunk | 284 (+360) / 294 | 76 (+42) / 30 | 11 (+6) / 4 |
| path / cycleway / pedestrian | 925 / 590 / 380 | 110 / 67 / 51 | 15 / 9 / 7 |
| **steps** | **2,618** | **35.3** | 4.9 |
| busway / living_street | 163 / 22 | 14.7 / 2.8 | — |

Tag coverage (bbox, 67,858 ways): name 16,160; lanes 8,691; oneway 8,727; maxspeed 5,957; sidewalk 9,729; surface 31,138; **incline 1,801**; width only 182. Bridges 764, tunnels 400. There are 2,864 distinct street names.

### 2.3 Rail and transit (all in `bbbike-osm-railways.json` / `osm-railways.json`)

- **Cable cars**: tracks are `railway=tram` + `cable_tram=cable`, gauge 1067, `maxspeed=9.5 mph` (40 ways, 14.1 km incl. sidings). Routes are `route=tram`: **Powell–Hyde** rel 1959009 (outbound) / 3433158 (inbound), **Powell–Mason** rel 1959010 / 3433157, **California** rel 2852264 / 2852265. There are 3 `railway=turntable` ways, and Powell & Market is node 8641952045.
- **F-line streetcar**: rel 2007934 (Fisherman's Wharf → Castro) / 2007933. Other tram-class track totals 34.9 km.
- **Muni Metro** light rail J/K/L/M/N/S/T: 14 route relations, 120.5 km of `light_rail` (street-running N-Judah / L-Taraval / T-Third are the visible ones).
- **BART** (`subway`, 44.4 km; underground in SF except the Glen Park–Balboa–Daly City cut), **Caltrain** (`rail` 51 km, 22 service relations).
- Nodes: 292 `tram_stop`, 239 `stop`, 77 `station`, 187 `platform`, 71 subway entrances.

### 2.4 Landcover, water, coast (bbox)

Areas from outer rings: residential 35.8 km², **park 19.1 km²** (343 polygons), nature reserve 9.5, scrub 7.2, industrial 5.8, retail 4.8, **golf 4.7** (10), wood 3.8 (214), parking 2.5 (1,338), grass 1.8 (1,962), water 1.7 (104 + 7 reservoirs), beach 1.0 (35) + sand 409 polygons, pitch 1,589, garden 1,659, playground 305, **pier 1,195**, breakwater 86, cliff 41, bare rock 66, stream 96, coastline 94 ways (2.3 km² enclosed islets). Cemeteries are almost all in Colma, outside SF (2 + 1 in the bbox).

### 2.5 POIs (7,785; 5,819 named)

tourism: artwork 612, information 600, hotel 284, viewpoint **144**, attraction **139**, picnic site 107, gallery 74, museum 54. amenity: place of worship 415, theatre 74, library 49. leisure: park 299, playground 170, garden 108. man_made: mast 279, flagpole 234, tower 104. historic: memorial 260, naval 77, maritime 39, ruins 39. place: neighbourhood **56**, quarter 27, islet 22. natural: peak **43** (with `ele`: Mount Davidson 283, Noe Peak 274, Eureka Peak 271, Corona Heights 158, Buena Vista 173, Bernal Hill 132, Nob Hill 113, Russian Hill 97, Telegraph Hill 91, Rincon Hill 35 …), cliff 41, beach 32.

### 2.6 Elevation

- SF land (mask = 1): mean 54.5 m, median 46.4 m, p90 114.9 m, max 284.0 m. Checks: Coit base 91.5, Sutro Tower base 255.0 (OSM `ele` 254), Mt Davidson node 276.6, Eureka Peak 277.8. Depths: Golden Gate mid-span −94 m, bay west of the Ferry Building −10 to −20 m.
- Slopes on land (DEM gradient): p50 6.2 % (3.5°), p75 13.7 %, p90 25 % (14°), p95 35.8 % (19.7°), p99 61 % (31.5°). After the district's 1.7× vertical exaggeration (below): p90 23°, p95 31°, p99 46°. 5.6 % of land is > 30° and 3.6 % is > 35° (cliffs, quarried faces, Twin Peaks flanks).
- Caveats: bare-earth USGS 3DEP (NED ~10 m) resampled to 7.5 m. Piers and some Mission Bay / Hunters Point fill read ≤ 0.5 m, so use OSM coastline, not the DEM, for exact shorelines. Over the Golden Gate the source is bathymetry, and bridges are not in the DEM.

## 3. Gaps and caveats

1. **LiDAR is from 2010.** Salesforce Tower (LiDAR 110.8 m vs real 326 m), Chase Center (none), the Transit Center/Salesforce Park, 181 Fremont and Mission Bay are newer. Always prefer the OSM `height` (current) and use LiDAR only to fill gaps. LiDAR max also catches overhangs: Fort Point reads 64.2 m because the bridge deck is above it, and windmills read ~35 m because of trees. So `landmarks.json` takes LiDAR only from the footprint that contains the point.
2. **Bbox ≠ SF.** The bbox includes a Daly City/Brisbane strip south of 37.708 and a slice of the Marin headlands. The county polygon (rel 111968) runs to the Marin shore of the Golden Gate and out to the Farallones, so filter with `sf-landmask-z14.u8` (already drops Marin cells: `lat > 37.815 && lng < −122.44`).
3. **Roof data is thin** (421 roof shapes, 3,194 levels). Roof style has to be rule-based (see §8).
4. The **Bay Bridge east span / Oakland shore** are outside the SF bbox. Its SAS tower (way 237735191, 160 m) is in the data. The coast east of −122.32 comes from `osm-backdrop.json` (wide box, 804 km of coastline) or the z11 DEM.
5. `pty2-tcw4` (SF Find neighbourhoods, 117) returned empty geometry through the geojson endpoint. The 41 Analysis Neighborhoods plus 56 OSM `place=neighbourhood` nodes are enough for zone labels.

## 4. Projection and world bounds

`district.ts` defines `K = 0.14` (u/m, line 43), `ROT = 46°` (44), `LAT0 = 37.802338` (45), `LNG0 = −122.40001` (46), `MX = 111320·cos(LAT0)` (47), `MZ = 110540` (48), and `project()` at line 55:

```
e = (lng − LNG0)·MX ; n = (lat − LAT0)·MZ
x = K·(e·cos46° − n·sin46°) ; z = K·(−e·sin46° − n·cos46°)   (rounded to 0.01)
```

Verification (`tools/proj-check.mts`, imports the real module): Coit Tower (−50.25, 51.10), Transamerica (56.02, 101.68), Salesforce (166.32, 107.54), Embarcadero Plaza (128.65, 32.48), GG south tower seed (−750.37, 601.89), Ocean Beach (−478.10, 1438.29). Every point matches my re-implementation (`tools/proj.mjs`) within 0.005 u, and `unproject` round-trips to 1e-6°. The projection is local equirectangular with a fixed `cos(LAT0)`. At SF's southern edge the east–west scale error is 0.13 % (≈ 13 m over 10 km), which can be ignored.

| extent (true scale, 0.14 u/m) | x | z | size |
|---|---|---|---|
| SF land (mask, incl. Treasure Is./YBI/Alcatraz) | −795 … 1,275 | −597 … 1,921 | 2,071 × 2,518 u |
| SF mainland | −795 … 1,275 | −206 … 1,921 | — |
| buildings in bbox | −1,343 … 1,260 | −581 … 1,959 | (includes Marin/Daly City) |
| task bbox corners | NW (−1,390, 712), NE (64, −794), SW (113, 2,163), SE (1,567, 657) | | |
| current slab (`district.ts:409`) | −246 … 244 | −104 … 114 | 102,962 u² (land 53,247 u² = **2.24 %** of SF's 2.38 M u²) |

The 46° rotation that lays the Embarcadero along +x (district.ts header) turns SF into a diamond. The extremes are the Presidio/Fort Point (min x), Hunters Point (max x), the Treasure Island tip (min z) and the Fort Funston county line (max z).

Travel times at `WALK_SPEED 4.2` / `RUN_SPEED 7.5` (`actors/controller.ts:18-19`; 4.2 u/s ≈ 30 m/s real) are ferry-building-centred:

| from Ferry Building (130, 17) to | distance | walk | run |
|---|---|---|---|
| Twin Peaks | 930 u | 3.7 min | 2.1 min |
| Golden Gate south tower | 1,076 u | 4.3 min | 2.4 min |
| Ocean Beach | 1,540 u | 6.1 min | 3.4 min |

The avatar therefore covers ground ~21× faster than a real walker (30 vs 1.4 m/s). That is fine for a toy, but crossing town still wants rides (cable car, F-line, bike).

## 5. Landmarks (`sf-data/landmarks.json`)

Each record carries: `id`, `name {en, zh}`, `category`, `lat/lng`, `world {x,z}`, `inCurrentDistrict`, `osm {type,id,url,matchDistM,wikidata,heightTag,eleTag}`, `heightM` + `heightSource` (published / OSM tag / LiDAR), `groundElevM` (DEM), `lidar`, `trueScaleU`, optional `points`, and `note`. A `backdrop[]` holds 11 far points with z11 elevation.

| id (★ = inside today's slab) | world x, z | height m (src) | ground m | OSM |
|---|---|---|---|---|
| ggb-south-tower / north-tower | −796.1, 564.4 / −935.5, 452.7 | 227 (pub) | −2.9 / 1.8 | w/1330586852 "San Fransisco Tower", w/1330832666 "Marin Tower" |
| ggb-deck-mid (points: S anchorage −740.6, 608.7; N anchor −978.8, 418.8) | −865.9, 508.5 | deck 67 (pub) | −94 (water) | r/21407754 |
| bay-bridge-center-anchorage (W2 250.4, −1.1; W3 240.7, −99.0; W5 230.5, −204.2; W6 221.0, −302.0; YBI tunnel 215.1, −360.7) | 235.7, −151.6 | towers 154 above water (pub; OSM 160) | — | w/236374789 |
| bay-bridge-sf-anchorage | 278.0, 79.5 | — | 3.5 | w/1011568818 (West Span) |
| yerba-buena-island / treasure-island | 193.3, −397.7 / 9.7, −487.4 | — | 70.5 / 3.5 | w/26767311, w/26767313 |
| alcatraz | −468.2, −58.5 | lighthouse 26 (pub) | 37.7 | r/20197830 |
| ferry-building ★ | 132.0, 14.8 | 75 (pub) | 1.2 | w/558731934 |
| embarcadero-center ★ | 94.5, 65.6 | 173 (pub) | 3.6 | w/32612520 |
| transamerica-pyramid ★ | 56.1, 101.7 | 260 (pub; LiDAR 258.5) | 5.4 | w/24222973 |
| salesforce-tower ★ | 166.3, 107.5 | 326 (pub) | 6.2 | w/431972186 |
| salesforce-park | 174.0, 114.3 | 21 (pub) | 5.3 | r/8524888 |
| coit-tower ★ / telegraph-hill ★ | −50.3, 51.1 / −54.3, 47.5 | 64 (pub) | 91.5 / 86.7 | w/28824850, n/358807538 |
| exploratorium ★ / pier-39 ★ | 28.7, 2.3 / −154.7, 26.6 | 15.6 (LiDAR) | 2.4 / 3.6 | n/621529017, n/1083360025 |
| north-beach-washington-sq ★ | −69.2, 105.9 | — | 24 | w/18583270 |
| fishermans-wharf | −206.4, 84.6 | — | 3.2 | n/11283438662 |
| ghirardelli-square | −235.6, 165.2 | 29.6 (LiDAR) | 18.4 | w/27104863 |
| aquatic-park-hyde-pier | −267.2, 116.8 | — | pier | w/456528981 |
| cable-car-hyde-turnaround / powell-market / museum | −222.2, 135.8 / 129.3, 257.5 / −12.9, 184.4 | — | 11.1 / 11.7 / 59 | w/197979144, n/8641952045, w/30029681 |
| lombard-crooked | −157.6, 168.0 | — | 67.2 | n/4972243722 |
| russian-hill / nob-hill | −120.9, 175.7 / −29.3, 232.6 | — | 65.5 / 104.4 | n/1680468587, n/358806914 |
| chinatown-dragon-gate / grace-cathedral | 81.9, 174.7 / 1.6, 232.4 | — / 53 (osm) | 23.8 / 91.8 | n/65328703, w/32946942 |
| union-square / yerba-buena-gardens / sfmoma | 96.1, 221.3 / 176.4, 211.4 / 177.3, 181.8 | — / — / 79 (LiDAR) | 23.9 / 11 / 9 | w/25278818, w/28842443, w/41692824 |
| city-hall | 92.3, 418.2 | dome 94 (pub) | 17.6 | r/7261820 |
| oracle-park / chase-center | 353.0, 162.3 / 491.2, 258.8 | 45 / 38.1 (osm) | 3.6 / 2.5 | r/7325085, w/579646390 |
| mission-dolores / dolores-park | 195.5, 647.6 / 242.0, 698.0 | 8 (osm) | 24.8 / 30 | w/256442765, w/23871270 |
| castro-theatre / corona-heights | 151.9, 741.4 / 80.3, 751.3 | 21.7 (LiDAR) | 42.6 / 147.7 | w/1206216224, n/331937887 |
| haight-ashbury / alamo-square (Painted Ladies on the east edge) | −41.3, 763.5 / −7.5, 586.5 | — | 82.3 / 75.8 | n/140982670, w/745183964 |
| japantown-peace-pagoda | −63.1, 450.0 | 30 (pub) | 47.1 | w/1458363734 |
| golden-gate-park (bbox centre) | −334.8, 1080.6 | — | 65.5 | w/158602261 |
| de-young / cal-academy / conservatory | −244.4, 940.2 / −203.4, 934.9 / −184.2, 852.9 | 44 (pub) / 11 / 15 (osm) | 75–77 | r/1652482, w/28695389, w/30675038 |
| japanese-tea-garden / stow-lake (Strawberry Hill) | −243.0, 964.4 / −269.7, 1032.3 | — | 77.9 / 129.2 | w/30900516, n/358807454 |
| dutch-windmill / murphy-windmill | −580.7, 1311.9 / −514.1, 1364.1 | 13 / 10 (osm, check) | 8.5 / 7.2 | w/287921407, w/287927026 |
| ocean-beach / sf-zoo / lake-merced | −431.0, 1475.0 / −102.1, 1652.8 / 118.5, 1718.3 | — | 3–8 | r/2165532, w/404847048, r/16308125 |
| cliff-house / sutro-baths / lands-end | −710.2, 1265.2 / −726.2, 1246.5 / −741.2, 1092.8 | 7 (osm) | 24.4 / 5.2 / 30.2 | w/168942988, w/32776564, n/379784480 |
| legion-of-honor / baker-beach | −663.6, 1083.4 / −622.5, 849.3 | — | 116.7 / beach | r/21115818, r/6260732 |
| presidio (Main Post −480.2, 542.7) / crissy-field / fort-point | −527.9, 622.9 / −576.2, 546.4 / −750.4, 595.1 | — / — / 15 (osm) | 54 / 3.7 / 4.8 | r/8346137, w/32649967, r/5504536 |
| palace-of-fine-arts / marina-green / fort-mason | −420.3, 422.3 / −382.1, 300.7 / −312.6, 238.4 | 49 (pub) | 2.7 / 3.3 / 6.2 | w/288371295, w/16761472, n/1478520965 |
| twin-peaks (Eureka; Noe 156.5, 968.3) / sutro-tower | 140.1, 946.9 / 73.2, 973.7 | — / 298 (pub) | 277.8 / 255 | n/11778387241, r/3829019 |
| mount-davidson / bernal-heights | 257.4, 1160.9 / 525.6, 778.0 | cross 31 (pub) | 276.6 / 138.6 | n/358806322, n/358806089 |
| mission-24th-valencia | 347.0, 588.3 | — | 9.9 | n/140983158 |

Backdrop (true scale): Hawk Hill (−1,108, 630, 235 m), Point Bonita (−1,258, 1,007), Sausalito (−1,361, 144), Angel Island (−939, −340, 215 m), Tiburon (−1,277, −263), **Mt Tamalpais (−2,931, 213, 769 m)**, Bay Bridge SAS tower (211, −507), Port of Oakland cranes (761, −669), Oakland downtown (1,080, −1,164), Grizzly Peak (533, −2,318, 518 m), San Bruno Mountain (882, 1,447, 223 m).

Today's backdrop is compressed about 0.62× relative to real positions (`district.ts:1062-1072`): YBI (214, −236) vs real (193, −398), and Alcatraz (−292, −34) vs real (−468, −59).

## 6. How GTA_SZ handles its data (for contrast; code MIT, data not reusable)

- **Snapshot, not live queries.** `scripts/download_osm.py:11-13` pulls a Geofabrik PBF with md5 verification and a 250 MiB cap (`LIMIT`, `:13`), then writes a provenance manifest (license, sha256, timestamps). `data/ATTRIBUTION.md` records every source.
- **Assembly.** `scripts/extract_city.py` uses libosmium multipolygon assembly and UTM 49N (`:21`). It "never infer[s] height" at the extraction stage and tags each building `height_status` = tagged / levels-only / unknown (`:43-45`).
- **Game conversion.** `scripts/prepare_driving_city.py` works as follows:
  - scale 0.60 (`:12`) with an equirectangular projection (`:14`)
  - land = the largest polygon from polygonising the bbox + coastline (`:24`)
  - drivable classes whitelisted (`:31`), road width = `clamp(lanes·3.0, 5.8, 16)` m, service 4.5 (`:41-42`)
  - height = OSM height, else levels·3.3 m, else a random typology from {18, 24, 30, 39, 54, 72, 96} m, clamped 5–290 (`:79-84`)
  - footprints < 22 m² dropped (`:74`), exclusion radius around hero landmarks (`:71`), road buffers of `width/2 + 2` m cut out of footprints (`:87`)
- **Output.** `public/city/city.json` (8.4 MB): 16,076 buildings (heights: 508 OSM / 5,445 levels / 9,603 guessed), 12,202 road ways, extent ±6,788 × ±2,605. `asset-manifest.json`: buildings.glb 3.31 M tris in 882 meshes (49.8 MB), chunkSize 640, total GLB 108.7 MB. `navigation.json`: 42,829 nodes / 47,218 edges. Hill and opposite-shore terrain is Copernicus GLO-30 (30 m DSM, `data/ATTRIBUTION.md`), and roads are flattened (`prepare_driving_city.py:1-3`).
- **Lesson for SF.** Our inputs are much better (98 % real heights vs their 3 %, and a 7.5 m bare-earth DEM vs 30 m DSM). The pipeline shape is worth copying: frozen snapshot, manifest, offline build, chunked output. Their 108 MB of GLB is not a size to copy.

## 7. Licensing and attribution

- **OSM (ODbL 1.0)**: show "© OpenStreetMap contributors" with a link to openstreetmap.org/copyright in the credits/map panel. The derived building/road database stays ODbL (share-alike applies to the derived *database*, not to the game code or art). Keep `tools/` and the snapshot date as provenance.
- **DataSF** (building footprints + neighbourhoods) is PDDL / public domain, so credit is optional, but add "Building heights: DataSF (2010 LiDAR)".
- **Terrain Tiles** (Mapzen/AWS): attribution per tilezen/joerd `attribution.md`. For SF the underlying data is USGS 3DEP (public domain) and NOAA/GMRT bathymetry.
- GTA_SZ assets/models/data are not used anywhere.

## 8. Recommendations for Opus Bay (whole SF)

1. **Keep the projection exactly** (`district.ts:43-58`). Every existing anchor, polygon and test depends on it. Build SF at true horizontal scale around it: land = 2,071 × 2,518 u. Treat the current slab (`district.ts:409`) as a hand-crafted **hero district**. The generated city is masked out inside `LAND` (`district.ts:1180`) plus a 12 u blend band. The waterfront "inflation" (`SHIFT 18.4`, `district.ts:84`) stays local to that hero district.
2. **Vertical scale**: `y = 0.2375 · max(0, elev_m − 3)` u, i.e. 1.7× horizontal, which matches the current Telegraph Hill (84 m → 20 u, `SUMMIT_HEIGHT` line 352). Check: the DEM at Coit gives (91.5 − 3)·0.2375 = 21.0 u. Results: Twin Peaks (Eureka, DEM 277.8 m) 65.3 u, Mt Davidson (DEM max 284 m) 66.7 u, median land (46.4 m) 10.3 u.
   - The −3 m offset puts the waterfront (DEM 1–4 m) at y ≈ 0–0.2 u, matching today's deck/promenade level 0 and water level −0.6 (`district.ts` header).
   - Resample `dem-sf-z14.f32` once into a **world-aligned 1 u grid**: 2,072 × 2,519 Float16 or Uint16 at 1 cm, ≈ 10.4 MB raw (≈ 4 MB gz). Split it into 128 u chunks (129² samples, 33 KB each), and load the 3×3–5×5 chunks around the player only.
   - `core/terrain.ts` (`TERRAIN_CELL = 0.5`, line 56) cannot be city-wide: 20.9 M cells per layer. Make grids per chunk, keeping 0.5 u only inside the hero district.
3. **Building heights**: `h_u = 2.2·√h_m`, clamped ≥ 3.5 u. This fits today's toy scale: 6.6 m house → 5.7 u (lots are 4.2–8.5 u), 15 m pier shed → 8.5 u (`shedH 8.5`, line 459), 64 m Coit → 17.6 u (16 now), 260 m Transamerica → 35.5 u (41 now, `world/landmarks.ts:203`). Heroes keep explicit heights, so Salesforce stays taller than Transamerica. Height input order: OSM `height`, then DataSF LiDAR from `osm-datasf-height-join.json` (except post-2010 sites), then `levels·3.2`, then 6.6 m. Base = terrain min under the footprint, with the existing "steep lot" rule (`district.ts:825-834`) reused.
4. **Roof and style** (only 421 roof tags):
   - `gable` for 1–4 storey `house`/`terrace`/`residential` outside the downtown wedge; `flat` for everything ≥ 15 m or `commercial/office/retail/industrial`.
   - Victorian pastel palette (DESIGN §6) where the LiDAR median is 6–12 m and the footprint is < 250 m² in the Western Addition / Haight / Mission / Noe / Castro neighbourhoods (use `datasf-neighborhoods-j2bu-swwd.geojson`).
5. **Geometry budget**: simplify rings to ≤ 8 vertices (Douglas-Peucker at 0.4 m real = 0.056 u) and drop footprints < 20 m², giving ≈ 16–20 tris per building. That is 892 × 18 ≈ 16 k tris per average 128 u chunk and 47 k for the densest.
   - Render full footprints within 2 chunks (≈ 320 u) and per-block merged hulls beyond that. `FogExp2 0.0014` (`world/environment.ts:106`) already hides ~86 % at 1,000 u.
   - This keeps the DESIGN §9 caps (≤ 400 k tris, ≤ 150 draws): one merged mesh per chunk per material, vertex colours.
6. **Offline build script**, `baylink-opus/scripts/opus-sf-build.mjs` (no runtime deps), reading `sf-data/raw/*` and writing:
   - `public/opus-bay/sf/manifest.json` (chunk size 128, bounds, attribution)
   - `sf/chunks/{cx}_{cz}.bin`: Int16 chunk-local coords at 1/256 u, per-building u16 height and u8 style/roof. Estimate ≈ 50 B/building, ≈ 8 MB raw / ~3 MB gz for all 161 k.
   - `sf/roads/{cx}_{cz}.bin`: polylines + class + width.
   - `sf/terrain/{cx}_{cz}.u16`
   - Runtime loader: `src/opus-bay/world/sfChunks.ts` + `core/sfTerrain.ts`, sitting beside `district.ts`, with no change to `core/types` contracts beyond an optional `chunks` hook.
7. **Roads**: ribbon width `u = 0.14·clamp(lanes·3.2, 6, 20) m·1.6` (toy-widened). Default lanes are 2 for residential/tertiary and 4 for primary. Motorways (I-80, US-101 Central Freeway, I-280) should be drawn as elevated decks where `bridge=yes` or `layer ≥ 1`. The 2,618 `steps` ways become climbable stair ramps. That is SF's signature verb (Filbert Steps already works), and it justifies an "upstairs shortcut" mechanic.
8. **Navigation**: replace the city-wide grid idea with an A* **graph** built from footway + residential + steps + pedestrian + path. For click-to-walk this is ≈ 50 k ways; GTA_SZ's 42.8 k-node graph shows the scale is fine. Keep the 1 u nav grid only for loaded chunks (`core/terrain.ts:458` `buildNavGrid`).
9. **Transit rides** (the answer to 6-minute cross-town walks). Route lengths from the OSM relations at 0.14 u/m:
   - Powell–Hyde cable car (rel 1959009): 3.26 km → 456 u, Powell & Market (129, 258) → Hyde turnaround (−222, 136).
   - Powell–Mason (rel 1959010): 346 u. California (rel 2852264): 320 u.
   - F-line (rel 2007934): 1,136 u to the Castro (≈ 150, 740).
   - N-Judah surface section to Ocean Beach (rel 63223, 1,975 u incl. tunnel).
   - Speed: the real cable car speed (9.5 mph = 4.25 m/s) is only 0.6 u/s at true scale, 7× slower than walking. Reuse the existing streetcar speeds `VMAX 11` / `VMAX_RIDE 13` u/s (`world/streetcar.ts:18-19`); that makes Powell–Hyde a ~35 s ride and the full F-line ~90 s.
   - Cable cars must follow the terrain (Hyde St grades ~20 %, ×1.7 exaggerated), so sample y from the chunk terrain along the track.
10. **Backdrop moves to true positions**: replace the compressed `district.ts:1062-1072` values with those in `landmarks.json`: YBI 193/−398, Alcatraz −468/−59, Angel Island −939/−340, Marin Hawk Hill −1,108/630, Oakland 1,080/−1,164.
    - Build a far-terrain ring from `dem-bay-z11.f32`: 60 m cells ≈ 8.4 u, one mesh ≈ 30–60 k tris for Marin + East Bay.
    - Mt Tamalpais at 3,060 u needs `far ≥ 3,500` (now 1,600, `game/GameRoot.tsx:29`) or a painted backdrop card.
    - Both bridges become real geometry at the terrain's vertical scale (0.2375 u/m): GG deck 67 m → 15.9 u above water, towers 227 m → 54 u, Bay Bridge W-span towers ~154 m → 37 u. Do not use the √ building rule for bridges: it would squash the deck-to-tower ratio.
11. **Zones and labels**: 41 DataSF neighbourhoods plus OSM `place=neighbourhood` (56) feed the top-left place label. POI candidates for BAYBAY stops come from `tourism=viewpoint` (144) and `attraction` (139). Every POI keeps its OSM id so real info can be linked to BAYLINK guides.
12. **Hero model priority** (silhouette-first): Golden Gate Bridge, Bay Bridge W span + YBI, Salesforce, Transamerica (exists), City Hall dome, Palace of Fine Arts, Sutro Tower, de Young tower, Coit (exists), Ferry Building (exists), Painted Ladies row, Lombard hairpins, Twin Peaks lookout, Alcatraz (exists), Oracle Park, Dutch windmill, Cliff House / Sutro Baths, Legion of Honor. Higgsfield 3D suits the small props (windmill, cable car, Painted Ladies facade kit). The large structures should be procedural from OSM parts, e.g. the GG tower parts in `osm-buildings.json` (ways 1330832664–1330832688, heights 13–225 m).

## 9. Re-run commands

```
node C:/Users/willy/opus-qa/sf-data/tools/fetch-osm.mjs [boundary railways pois highways landcover buildings backdrop]   # Overpass (skips existing)
python C:/Users/willy/opus-qa/sf-data/tools/fetch-terrain.py                      # DEM z14 + z11
node C:/Users/willy/opus-qa/sf-data/tools/fetch-datasf-buildings.mjs              # LiDAR heights
python C:/Users/willy/opus-qa/sf-data/tools/bbbike-to-layers.py                   # snapshot -> layers
python C:/Users/willy/opus-qa/sf-data/tools/landmask.py                           # mask + world bounds
python C:/Users/willy/opus-qa/sf-data/tools/world-preview.py                      # sf-world-preview.png
REFRESH="pois:1;highways:3" node C:/Users/willy/opus-qa/sf-data/tools/fetch-osm.mjs   # re-fetch given tiles from overpass-api.de (replace semantics)
node C:/Users/willy/opus-qa/sf-data/tools/stats.mjs bbbike-osm|osm ; node .../insf-stats.mjs ; node .../join-heights.mjs
cd C:/Users/willy/baylink-opus && npx tsx --tsconfig tsconfig.app.json C:/Users/willy/opus-qa/sf-data/tools/build-landmarks.mts osm   # or bbbike-osm (identical ids)
```
