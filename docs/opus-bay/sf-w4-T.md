# Wave 4 · lane T · Transit lines (the sightseeing loop, N Judah, M Ocean View)

## Early phase

Written 2026-09-27 by the lane-T agent (worktree `C:/Users/willy/wt/w4-t`, branch `w4-t` → `opus-bay`). Early-phase rule
(`sf-w4-lead.md` §2): new files only; nothing existing was edited, nothing new is imported by the game yet.

### 给主人的摘要

1. 三条新线的数据做好并推上去了：**观光巴士环线**（16 站，一圈约 15 分钟，避开了 JFK 步行大道、日落沙丘和双峰北口这些禁止开车的路）、**N 线**（1,569 u，市场街地铁 → 杜博斯隧道口 → 日落隧道 → 海洋海滩）、**M 线**（1,988 u，一条隧道直到西门 → 石镇 → 州立大学 → Balboa Park）。每个站都有固定编号和中文名，其他组已经可以用。
2. 巴士和地铁的"行车模拟"写好了：每站停靠、等你上车、**15 秒内一定有车来**、地铁在地下用 25 u/s 快速跑、到隧道口先等地面画面加载好再钻出来（最多等 8 秒）；测试里连续跑 10 分钟，没有一次撞车或卡死。
3. 敞篷双层小巴士（约 1,060 个三角形）、两节小电车（每节约 400）、站牌、市场街地铁口、地面站台、4 个隧道口（日落隧道西口做成"地标级"）、"地铁隧道动画"界面和一套合成音效都做好了；三条线合起来最多只多 3 次绘制 + 1 次阴影，最挤的画面约 7.5k 三角形；66 个站牌 / 地铁口都按城市实际的房子和马路摆放，没有一个插进房子或占到马路上。截图在 `docs/opus-bay/qa/w4/T/`。
4. 这些还没接进游戏（第三波还没验收）。等"接线"阶段按下面的步骤接上，就能在游戏里坐。

进度（2026-09-27）：早期阶段的 T1–T3、T5–T8、T11（界面部分）、T13 已完成并推送；接线类任务（T4、T9、T10、T11 接线、T12、T14 实测）等第三波验收后做。

### What was built (files, API)

| file | what | API (the integration surface) |
|---|---|---|
| `src/opus-bay/data/sf/stationNames.ts` | stable ids + names: 3 line metas, 16 loop stops (`loop-*`), 50 Muni Metro stations (`muni-*`, English sign name + zh gloss, `major`, `underground`), stop → attraction ids (checked against lane P's `ATTRACTIONS` by a test), tunnel names + one checked fact each, the 4 portal names | `LOOP_STOPS`, `METRO_STATIONS`, `STOP_ATTRACTIONS`, `TUNNELS`, `PORTAL_NAMES`, `W4_LINES`, `w4StationName(id)`, `stationAttractions(id)`, `metroStation(id)`, `metroStationForOsm(name)` |
| `scripts/opus-sf/lib/metro.ts` (W4-T1) | N (OSM 3435877, cut at Embarcadero) and M (3433314): chained track, tunnel spans from the way tags (merged over < 6 u gaps), named portals, underground heights (a 0.25 u/u dive for 16 u behind each visible mouth, then under the street and a train height under the chord between the mouths — never over the hills; ≥ −20 u; the Duboce hood stands 8 u outward of the OSM tunnel end, in the Duboce Ave median, and the dive starts there), surface stops moved out of the mouths, terminus turning loops trimmed (N 11 u, M 40 u) | `buildMetroLines(terrain, log)` |
| `scripts/opus-sf/lib/busLoop.ts` (W4-T2) | the 16-stop loop on the car-legal OSM graph with the plan-R8 exclusions (JFK 23 ways, Upper Great Highway south of Lincoln 23, Twin Peaks north 8), a cycle DP over stop candidates (no Chula Lane jog), right-hand lanes, a teardrop at the Twin Peaks spur, fillets, near-side stops, the hand-made hero Embarcadero (south lanes d −19.35 → U-turn at st 44 → bayside north lanes d −7.2 past the F platforms; poles on the promenade kerb at st 64 / 344), speed spans | `bakeLoop(terrain, log)` → `{ line, speeds, poles, report }` |
| `scripts/opus-sf/lib/lineGeom.ts` | polyline helpers (height-aware Douglas–Peucker, densify, fillets …) | — |
| `scripts/opus-sf/lib/stopPlace.ts` | where a pole / kiosk can stand in the built city: distances to building footprints and car-road edges from the published chunks (`public/opus-bay/sf/v1/c`) + the hero's lots / roadways | `Clearance(chunkDir)`: `prepare(points)`, `building(x, z)`, `road(x, z)`; `placePole(...)`, `placeKiosk(...)` |
| `scripts/opus-sf/transit-sidecar.ts` (W4-T3) | deterministic rebuild (≈ 2 min: the kiosk search); wave-2 lines copied byte for byte; every stop prop placed on the built city (loop poles just outside the road right of the bus, surface Metro poles outside the road ≥ 2.7 u from the track, kiosks on a free patch of sidewalk / plaza ≤ 30 u from the station, 48 u at Montgomery); writes them as the file's `props`; `checkW4Lines` = the frozen sf-data rules + `transitLineProblems` | `--out <dir>` (scratch), `--write-w4` (the new `public/opus-bay/sf/v1/transit-w4.json`), `--publish` (transit.json, integration only) |
| `public/opus-bay/sf/v1/transit-w4.json` | the three lines (53 KB raw); the loop carries `speeds: [fromAt, toAt, u/s][]`; `props` = where each stop's pole / kiosk stands | read by the tests, lane C's tour pin test and the QA harness |
| `src/opus-bay/world/lineTrack.ts` | pure track: arc tables (loops wrap), 1 u speed-limit profile (cruise spans, curve limit, 25 u/s deep underground with the tunnel accel, smoothed), time table, `proximitySpans` | `buildLineTrack`, `trackPoint`, `limitAt`, `arcAhead`, `runSeconds`, `tunnelOf`, `normArc`, `proximitySpans` |
| `src/opus-bay/world/busSystem.ts` (W4-T5) | pure bus sim, the CableSystem rider / platform API | `BusSystem(track, { groundY, visible, viewer, boxes })`: `request({ line, station, to })`, `board()`, `cancel()`, `rideStatus()` (`BusRideStatus` = RideStatus + `nextStop`, `nextEta`), `riderCarOf(line)`, `requestNextStop()`, `occupies(boxId)`, `eta()`, `rideSeconds(from, to)`, `step(dt)`, `events`, `violations()`; `busTrack(line)`, `BUS` |
| `src/opus-bay/world/lightRail.ts` (W4-T6) | pure LRV sim (N + M in one system) | `LightRailSystem(tracks, { groundY, visible, viewer, portalReady })`: same rider API with `dir`; `RailRideStatus` adds `underground`, `tunnel`, `at`, `dir`, `portalWait`; `leadCar(train)`, `rideSeconds(line, from, to)`, `nextStop(train)`; events incl. `portal-in` / `portal-out`; `railTrack(line)`, `LRV`, `TRAIN_LENGTH`, `stopPos` |
| `src/opus-bay/world/sf/tourBus.ts` (W4-T7) | toy open-top double-decker (1,060 tris; far 132), night lamps (head / tail, deck bulbs, warm lower-deck windows) | `tourBusGeometry()`, `tourBusFarGeometry()`, `TOUR_BUS_PLATFORM` (upper deck: front-bench seats, rail spot, aisle + front standing room), `TOUR_BUS_SPOTS` (BAYBAY's seat, the lower-deck spot) |
| `src/opus-bay/world/sf/lrv.ts` (W4-T7) | toy LRV car (396 tris; far 96), headsign in the line colour, lamps | `lrvCarGeometry(color)`, `lrvCarFarGeometry(color)`, `LRV_PLATFORM` |
| `src/opus-bay/world/sf/stations.ts` (W4-T8) | loop poles (coral ring roundel, 200 tris), Market St kiosks (2.2 × 3.0 u, 276), surface Metro stop poles with line bands (68 / 100; the toy streets leave no room for islands), all at the stop's x, z | `stationProps(lines, groundY)`, `busPoleGeometry`, `kioskGeometry`, `railStopGeometry`, `stationGeometryKey`, `RAIL_POLE_OFFSET` |
| `src/opus-bay/world/sf/portals.ts` (W4-T8) | Duboce (168 tris), Sunset east (180), Sunset west — landmark quality (324), West Portal (196): a one-track concrete hood (4.9 u wide) over the first 6.5–12.5 u (per mouth: beyond it a diving train is under the terrain), dark inside, wing walls except at West Portal | `portalPlacements(metroLines)`, `portalGeometry(id)`, `portalBlockers(p)`, `HOOD`, `HOOD_LENGTH`, `WING_LENGTH` |
| `src/opus-bay/world/sf/lineFleet.ts` | the three.js layer: both systems, `near` / `far` vehicle BatchedMeshes + one props BatchedMesh, own material instances, warm-up `w4-lines`, platforms, `transit` game events | `new LineFleet({ loop, metro }, opts)`, `.update(dt, cam, player)`, `.onPortal(fn)`, `.riderTrain()`, `.stats()`, `.dispose()`, `.group`; `busInterlocks(busTrack, otherLines, blockedBy)`, `makeFleetMaterial`, `FAR_LOD`, `HIDE_BEYOND` |
| `src/opus-bay/game/lineChoices.ts` (W4-T9/T10 pure part) | boarding choices (loop: next 3 stops + 坐一圈 + 看线路图 + 先不坐; Metro: next each way, termini, ★ stops beyond the current tunnel first, ≤ 6 on phones; pre-filled trip row) and the ride banner text | `lineChoices(line, from, { rideSeconds, max, to })`, `lineRideLabel(line, status, destination)` |
| `src/opus-bay/ui/SubwayOverlay.tsx` + `ui/subwayStrip.ts` + `ui/transit-ui.css` (W4-T11 UI) | the dark tunnel layer, lamp streaks (still under reduced motion), the line strip (labels never overlap at 375 / 390 / 1440 px), next stop + seconds, the tunnel fact, 在这站下车 / 隧道里不能下车 / 马上出隧道… | `<SubwayOverlay visible line destination tunnel stations at dir moving stopped next portalWait onAlight />`, `stripLayout()` |
| `src/opus-bay/audio/lines.ts` (W4-T13) | synthesized: bus air brake, door chime, stop bell, LRV gong, station chime, portal whoosh; `LineLoops` (bus hum, LRV whine, tunnel rumble) | functions `(e: AudioEngine, …)`, `new LineLoops(e).update(state)` |
| `scripts/opus-sf/transit-qa/w4-transit.{html,ts}`, `w4-overlay.{html,tsx}` | dev-only QA harness pages (vite dev server): the fleet on transit-w4.json / the overlay with a real ride state | `?view=bus|deck|lrv|kiosk|pole|railstop|portal-<id>&night=1`, `?line=&at=&dir=&stopped=&portal=1` |
| `tests/opus-bay-sf-bus.test.ts` (17 tests), `tests/opus-bay-sf-metro.test.ts` (17 tests) | data, sims, geometry, budgets, overlay, sounds, choices | — |

### Evidence

- **Checks** before every push: `tsc` 0, `eslint src/opus-bay tests/opus-bay-*` 0, full opus-bay suite green (last run 580 / 580;
  the two known wall-clock tests passed on re-run when the machine was loaded). The new scripts type-check (a temporary
  file-only tsconfig; only unrelated `src/i18n` declaration errors outside the app config).
- **Determinism**: two sidecar runs give identical `transit.json` / `transit-w4.json` (md5 equal); the wave-2 lines are
  byte-identical to the published ones (asserted in the sidecar).
- **Data** (sidecar report): loop **6,501.5 u** (OSM route 6,399.8 u + lanes / fillets; plan 6,522 ± 20 %), 16 stops;
  1,170 u at 9 u/s (residential / grade > 0.12); 7 stops moved near-side off corners (Twin Peaks 29.8 u below the
  teardrop: BAYBAY leads the rest, plan R4). N **1,569.1 u**, 28 stations, tunnels [0, 516.1] (Duboce) and
  [606.7, 787.0] (Sunset Tunnel, 180 u ≈ 1,290 m real); M **1,987.7 u**, 27 stations, tunnel [0, 1,164.2] (8 stations)
  to West Portal. Both pass `transitLineProblems` and `checkW4Lines`. Mouth heights: the track drops 3–4 u within 16 u
  behind each visible mouth (Duboce 7.7 → 3.6, Sunset east 12.6 → 9.5, Sunset west 21.6 → 16.7, West Portal 24.0 → 20.4).
- **Props on the built city** (a scratch checker against the chunk buildings / car roads, the same data the game draws):
  before the placement pass 54 of 66 props stood in a building or a roadway; after it **0 / 66**. The placed positions
  are the file's `props` (stop id → [x, z]); the stops' own x, z stay as pushed earlier because lane C's `TOUR_GEO` pins
  them (see Requests). Props over 8 u from their stop point: Montgomery kiosk 32.6 u (downtown has no free sidewalk
  closer), Church kiosk 20.3 u, Civic Center kiosk 10.5 u, Castro 8.9 u, Duboce & Church 11.7 u, Judah & Sunset 11.6 u,
  Ocean Ave 12.5 u and four more. Street furniture (27,347 chunk trees / lamps / benches) is avoided too: only the
  Montgomery kiosk has two tree trunks 2.1 u from its centre (just outside its canopy). Portal hoods touch the nearest building by ≤ 0.9 u (West
  Portal: OSM's own portal building over the mouth; Sunset west: one Cole Valley house, 0.46 u).
- **Times** (the systems' `rideSeconds`, the same numbers the boarding choices show): loop lap 913 s (15.2 min: 738 s
  driving + dwells); Ferry → Palace 107 s; Castro → Twin Peaks 86 s; N end to end 202 s; M end to end 208 s; Embarcadero →
  Church 42 s; Castro → West Portal 34 s; Castro → 19th & Winston 73 s; Duboce & Church → Carl & Cole 23 s.
- **Sims** (node): 10 simulated minutes of 3 buses and 4 trains: no violations, dwells 8 s (bus) / 4 s surface / 3 s
  underground, ≥ 4 reversals, nothing stuck; dispatch: waiting riders picked up ≤ 15.5 s at Palace, Castro, Civic Center
  (bus) and Castro (M, underground), a minor stop and a terminus (N); rides within 15 % of the estimates; portal hold
  (3 s until ready) and the 8 s cap; hop-off: bus stops within the asked 1.4 s and pulls 0.6 u to the kerb, LRV ignores
  it underground; interlock: the bus waits before Bush × Powell while blocked and drives through once clear.
- **Budgets** (node, measured on the geometries): bus 1,060 / far 132, LRV car 396 (train 792) / far 96, pole 200, kiosk
  276, surface stop 80–112, portals 168–324. The fleet walked over every stop of the three lines for 10 simulated
  minutes: **≤ 2 calls + 1 shadow call**, worst view **7,508 tris incl. shadows** (9th & Irving: 5 near vehicles, 20
  props). QA harness renderer: bus view 3 calls / 2,122 tris / 3 programs.
- **Shots** (`docs/opus-bay/qa/w4/T/`, read before describing): `t-early-bus.jpg` (coral open-top double-decker, cream
  band, wheels, benches), `t-early-deck.jpg` (the rider's upper-deck view, 4 rows of blue benches), `t-early-lrv.jpg` (two
  cars back to back, blue headsign, red belt, pantographs), `t-early-bus-night.jpg` / `t-early-lrv-night.jpg` (warm
  windows, lamps, deck bulbs, headsign glow), `t-early-kiosk.jpg` (canopy, stairwell, N / M discs), `t-early-pole.jpg`
  (ring roundel + bar, pennant — not a STOP sign), `t-early-portal-sunset-west.jpg` (stepped parapet, pilasters, planters,
  grass cap), `t-early-portal-west-portal.jpg` (classical headwall, lamps, the West Portal pole), `t-early-overlay-desk.jpg`
  (M in the subway, strip with 9 stations + 西门隧道口), `t-early-overlay-phone.jpg` (390 × 844, stopped at 市政中心站 with
  在这站下车), `t-early-overlay-375.jpg` (375 × 667, 马上出隧道… with the Twin Peaks Tunnel fact), `t-early-plot-whole.jpg`
  and `t-early-plot-hero.jpg` (the lines over the OSM streets; the hero U-turn south of the Ferry stop). These are harness
  shots on a plain ground; the in-game shots of plan §5.3 follow in the integration phase.
- **Facts checked** (2026-09-27, en.wikipedia.org): Market Street subway Muni Metro service from 18 Feb 1980; Twin Peaks
  Tunnel opened 3 Feb 1918, 3.65 km, West Portal Ave & Ulloa St to near Castro; Sunset Tunnel opened 21 Oct 1928, 1,290 m,
  N Judah only, portals at Duboce & Noe (Duboce Park) and in Cole Valley near Carl & Cole; the N and J leave the subway at
  the Duboce portal (Church & Duboce); the M runs Embarcadero ↔ San Jose & Geneva (Balboa Park), Stonestown station on
  Winston Dr, SF State on Holloway Ave; N Judah Caltrain ↔ Judah & La Playa, UCSF Parnassus served.

### Decisions

- **Station ids are prefixed** (`loop-…`, `muni-…`) instead of the plan table's bare `twin-peaks`, `castro` …: those are
  place ids, and stations join the place index (P) and the interactables (`transit-<id>`); `civic-center` would also have
  meant two different stations (the loop stop and the Muni station 53 u apart).
- **Props stand where the city has room**: the loop pole just outside the road right of the bus (the promenade kerb
  in the hero), a Metro kiosk on a free patch of sidewalk / plaza for underground stations, a pole outside the road for
  surface stops (≥ 2.7 u from the track: a passing train's outer side is at 2.4 u). The sidecar places them on the
  published chunks (lib/stopPlace.ts), so no prop stands in a house or a street. They are published as `props` beside
  the stops (the stops' x, z unchanged, pinned by lane C today); at the integration the stop x, z become the props (you
  board where the pole / kiosk is).
- **Short one-track hoods and a steep dive**: the toy terrain rises only ≈ 2 u over the first 14 u behind the mouths,
  so a long hood would stick out of the hill into the houses; instead the track dives 0.25 u/u behind the mouth and the
  hood ends where a train's roof is under the ground (6.5 u; 12.5 u in the flat Duboce median, whose hood stands 8 u
  outward of the OSM tunnel end so it stays clear of Market St). Trains never run side by side within 20 u of a mouth.
- **The hero Embarcadero is hand-made, not OSM** (plan §3.2 "555 u follow DISTRICT.roads"): the route arrives from
  Washington St on the landward south lanes, U-turns across the median at station 44 (before the Ferry F-line platform
  at 58.5), and serves the Ferry (st 64) and PIER 39 (st 344) stops from the bayside north lanes with the doors to the
  promenade. The U-turn crosses the F tracks: an interlock box with the hero streetcar is part of the integration.
- **Keep right**: two-way streets are offset to the right lane (¼ of the right-of-way, ≤ 1.4 u), so buses up and down
  the Twin Peaks spur never meet head-on; the spur ends in a flared teardrop in the summit lot.
- **Near-side stops**: a stop on a corner moves back to the last straight spot (≤ 40 u) so the bus dwells straight.
- **LRV termini trimmed**: the OSM outbound track ends in turning loops (La Playa, Balboa Park); a 12.9 u double-ended
  train must stand straight, so the path ends where the last 16 u turn by < 0.35 rad.
- **Underground runs virtually**: trains there are hidden and run at 25 u/s with 7 u/s² braking / pulling away (the
  overlay compresses the ride), 3 s at each station; within 25 u of a mouth they run at the surface speed so a train
  visibly enters / leaves the hood.
- **Draw calls**: all buses and LRV cars in one near and one far BatchedMesh, every stop / kiosk / portal in one props
  BatchedMesh (per-item culling, hidden beyond 300 u, refreshed at 4 Hz and at once after a camera jump). Near vehicles
  cast and receive shadows (a new program variant: batching + colour + shadows, registered for warm-up); far vehicles and
  props reuse the L1 / L2 pool program (batching + colour, no shadow receive). One material instance per batched mesh.
- **Interlocks are one-way for now**: the bus waits while another line's vehicle is in the shared box; the cable car
  yielding to a bus inside needs a hook in `CableSystem.free()` (integration step 3).
- **Ride estimates are the systems' own** (`rideSeconds`), so the boarding choices, the trip planner and the ride banner
  show what the sim will do (tests: within 15 %).

### Integration plan (after "wave 3 verified"; T owns these files then)

1. **Publish the data** — `npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/transit-sidecar.ts --publish` rewrites
   `public/opus-bay/sf/v1/transit.json` with the three lines (the frozen sf-data test already accepts them; wave-2 lines
   byte-identical). In the same commit set every stop's x, z to its `props` entry (the placed pole / kiosk: you board
   there) — lane C's `TOUR_GEO` follows in the same push (Requests). Then point `tests/opus-bay-sf-{bus,metro}.test.ts`
   at transit.json, delete `transit-w4.json` and the `--write-w4` flag. `scripts/opus-sf/build.ts` step 9a: append `buildMetroLines(terrain, log).lines` and
   `bakeLoop(terrain, log)` (line + `speeds`) to `transit.file.lines`, so a full rebuild reproduces the sidecar.
2. **`data/transit.ts`** — widen `TransitLineJson.kind` to `TransitLineKind` and add the optional `short`, `loop`,
   `tunnels`, `speeds`; `buildTransit` keeps building the cable lines only (unchanged) and stores the raw bus /
   light-rail lines: `transitW4(): { loop, metro } | null`; add the registry `setActiveLineFleet(f)` /
   `activeLineFleet()` (like `activeCableSystem`) so game code never imports world code.
3. **`world/transitLayer.ts`** — in the constructor: `this.lines = new LineFleet(transitW4()!, { groundY: residentGround,
   visible: visibleFromCamera, viewer: …, portalReady, boxes })`, `this.group.add(this.lines.group)`,
   `setActiveLineFleet(this.lines)`; in `update`: `this.lines.update(dt, U.uCam.value, runtime.player)`; dispose.
   `boxes = busInterlocks(this.lines.bus.track, cableJsonLines, blockedBy)` with `blockedBy(line, b0, b1)` = a cable car
   of that line whose `sys.span(car)` overlaps `[b0 + line.s0, b1 + line.s0]` (CableLine arcs include the start stub),
   plus one box for the hero U-turn (st 36–50 of the loop's hero span) blocked while `runtime.streetcar` is within 8 u of
   the U-turn centre. `CableSystem.free()` (world/transitLine.ts): after the crossing loop, refuse a span overlapping a box
   that `activeLineFleet()?.bus.occupies(boxId)`. `portalReady`: `p => ready.get(key(p)) ?? (void stream.whenReady({ x: p.x,
   z: p.z }, 150).then(() => ready.set(key(p), true)), false)` (world/sf/stream.ts `whenReady` exists).
   Optional budget step: move the cable cars into `lines.near` / `lines.far` (a `LineFleet.addVehicleGeometry` API) and
   the turntable aprons into the props mesh: F's layer drops 2–3 calls.
4. **`game/ride.ts`** — `beginLineRide(line, from, to, dir, epoch)` picks the system by line kind (cable → CableSystem,
   bus → `activeLineFleet().bus.request({ line, station: from, to })`, light rail → `.rail.request({ line, station: from,
   dir, to })`); `stepLineRide` is already generic over `rideStatus / board / cancel / riderCarOf` (all three systems);
   `RideState.kind` = the line kind; while `rideStatus().underground` the player stays at the boarding kiosk (no
   platform pose is published for a hidden train; the overlay covers the view).
5. **`game/transit.ts`** — `boardFrom(it)`: ids `loop-*` / `muni-*` → `boardLine(stationId, { to? })` = a dialogue from
   `lineChoices(line, stationId, { rideSeconds, max: touch ? 6 : 8, to })`; choice `next: flow.ride.ln:<line>:<from>:<to>`;
   `openRideNode` handles `ln:` → `rideLine(line, from, to)`; kind 'lap' → `to = from`; kind 'map' → lane P's map API
   (线路 tab, line highlighted). `transitInteractables()` adds the loop stops (verb 上观光巴士, radius 4.2 at the pole) and
   the Metro stations (坐 N 线 / 坐 M 线; a shared station 坐地铁) at stop x, z. `rideLabel` → `lineRideLabel` for bus /
   light rail (icons 'bus' / 'metro'). New `requestNextStop()` → the system's `requestNextStop()` + `stopBell`.
   `leaveLineRide` underground: only at a station, placed at its kiosk with the 0.6 s fade. `countRide`: the goal ids of
   lane C (sightseeing / metro) by line kind; `noteRide(line)` unchanged. Expose `subwayOverlayProps()` (from
   `rideStatus()`, `TUNNELS`, the line's stops) for the overlay mount.
6. **UI mount (lane G's files)** — `ui/Floating.tsx`: `<SubwayOverlay {...subwayOverlayProps()} />` while
   `flow.ride.kind === 'light-rail' && underground`; the RideBanner shows `lineRideLabel` (提前下车 disabled underground
   with its note, 下一站下车 → `requestNextStop`).
7. **Audio (`audio/audio.ts`)** — `transit` events with kind 'bus' / 'light-rail': arrive → `busAirBrake` + `doorChime`
   (bus) / `doorChime` (LRV); depart → `doorChime(false)`; bell → `stopBell` (bus) / `lrvGong` (LRV); `LineLoops.update`
   from the audio tick with `{ bus, busSpeed, lrv, lrvSpeed, tunnel }`; `fleet.onPortal` → `portalWhoosh`.
8. **Warm-up** — `lineFleet.ts` registers `w4-lines` when the lazy transit chunk loads (after the boot warm-up): call
   `warmPrograms` once more when `createTransitLayer` resolves (or V moves the registration into the main-graph list).
9. **Streamer prefetch (W4-T11)** — while riding, every 0.5 s `stream.whenReady(trackPoint(track, s + dir · 200))` for
   the rider's vehicle (bus and surface LRV).
10. **Tests updated on purpose** — `sf-transit` (interactable / station counts gain the loop stops and Metro stations),
    `sf-hud` (ride-label icons), `sf-hopoff` (no hop-off underground), `audio` (the new cues); the frozen `sf-data` needs
    no change.

### Not done (early phase)

- Everything in the integration plan (no existing file touched): in-game shots of plan §5.3 (bus deck on the Palace
  approach, the N surfacing at Duboce, the Sunset west portal, the M at 19th & Winston, a Market St kiosk in the city, a
  loop pole, a night bus), the phone perf / portal-cut checks at 4× CPU, the goal detector data (W4-T12), the streamer
  prefetch.
- Props are placed against the chunks' buildings, car roads and street furniture, but not yet seen in the city (the
  in-game shots come with the wiring); the portal hoods overlap one or two houses by ≤ 0.9 u.
- The loop's last 45 u in the hero west end blend from the north lanes into Jefferson St across the promenade line
  (st 356 → 441): check in the city.
- Bus × F-line on Market St (Dolores → Van Ness, 137 u of shared street) has no box yet (the F-line's city path and the
  bus's right lane need a look first).
- The upper deck's clearance under street trees is unchecked.

### Requests

- **Lead (frozen `world/sf/format.ts`)**: add `speeds?: [number, number, number][]` (arc spans with a cruise speed, u/s)
  to `TransitLine`; the loop carries it today and the runtime reads it through a cast.
- **Lane P**: stations use the ids above; the stop `attractions` use your ids (`alamo-square-painted-ladies`,
  `chinatown-dragon-gate`, `lombard-crooked`, `cable-car-powell-market` …; a sf-bus test pins that each exists). Please
  expose "open the map on the 线路 tab with line X highlighted" for the 看线路图 choice.
- **Lane C**: `TOUR_GEO` pins transit-w4.json's stop x, z, `at` and tunnel spans within 1 u; T keeps them stable in the
  early phase (the placed props are the separate `props` field). At the integration T moves each stop's x, z onto its
  prop (up to 33 u at Montgomery): please regenerate `TOUR_GEO` from the file in the same push (or derive it from
  `transitData()` at runtime). Narration keys = the stop ids; the `transit` `approach` event carries `station` + `attraction` (the stop's
  main attraction); `TUNNELS[*].fact` holds one checked line per tunnel for the tunnel-entry / portal lines; VOICE.md
  glossary: 内河码头站, 蒙哥马利站, 鲍威尔站, 市政中心站, 教堂街站, 卡斯特罗站 (SFMTA writes 卡斯楚), 森林山站, 西门站,
  观光巴士 / 观光环线, N 线 / M 线, 日落隧道, 双峰隧道.
- **Lane G**: RideBanner icons 'bus' / 'metro' and `lineRideLabel`; the bus deck camera on `TOUR_BUS_PLATFORM`
  (BAYBAY at `TOUR_BUS_SPOTS.baybaySeat`); the LRV platform is the lead car (`leadCar`); `portal-out` (via
  `LineFleet.onPortal`) for the emergence framing; mount `SubwayOverlay` (step 6).
- **Lane V**: the warm-up after the lazy chunk (step 8); the perf gate's moving rides (bus deck at the Palace approach, N
  at Duboce, M at West Portal) once wired; the fleet's near mesh is a new program variant (batching + colour + shadows).
- **Lane L**: the M platforms at 19th & Winston / Holloway: T places a simple island + pole 3.4 u right of the outbound
  track at each surface stop; if your Stonestown / SF State sites build real platforms there, tell me the station ids and
  T skips its props there. The West Portal site (#50) can use T's portal hood (`portalGeometry('west-portal')`).

## Early review

Written 2026-09-27 by the lane-T adversarial reviewer (worktree `C:/Users/willy/wt/w4-t`). Commits `9423db5` (lint) and
`515fb30` (fixes + tests) on `opus-bay`; this section is the third commit.

### 给主人的摘要

1. 查了 T 线全部新文件（数据、巴士 / 轻轨模拟、车辆、站牌、隧道口、地铁界面、音效、测试），在网上核对了 22 条事实和坐标，全部对得上。
2. 找到并修好 9 个问题，最要紧的三个：两列 N 线列车会在日落隧道口"穿过彼此"（现在隧道口一段改成单线、轮流通过，模拟 3 小时 0 次）；列车一半还在隧道口时就能"提前下车"（现在整列车出洞才行）；T 线的一个脚本让整个仓库的检查（CI）失败了（已先修好推送）。
3. 横幅文字改短了：以前是"M 线 · 开往 19th & Winston · 石镇 · 下一站 …"，现在是"M 线 · 开往 石镇 · 下一站 森林山站"。
4. 还有 8 条留给接线阶段的注意事项写在下面（主要是 ride.ts 和移动系统里要加的判断）。全部 649 个测试通过。

### What was checked

- **Scope:** every file of the eight W4-T commits (`88562d7` … `c434f57`): `data/sf/stationNames.ts`,
  `scripts/opus-sf/lib/{metro,busLoop,lineGeom,stopPlace}.ts`, `transit-sidecar.ts`, `transit-qa/*`,
  `world/{lineTrack,busSystem,lightRail}.ts`, `world/sf/{tourBus,lrv,stations,portals,lineFleet}.ts`, `game/lineChoices.ts`,
  `ui/{SubwayOverlay.tsx,subwayStrip.ts,transit-ui.css}`, `audio/lines.ts`, both tests, this report.
- **Early-phase rule:** `git show --name-status` of all eight commits: every file was added by the lane and only its own
  files were modified later. No existing tracked file was edited. ✓
- **Wiring:** read what the integration plan names — `game/ride.ts` (`stepLineRide` reads `sys.cars[st.car].pose`),
  `data/transit.ts` (`LineRideSystem`, `rideSystemFor`), `game/transit.ts` (`RideLabel` = `lineTo` + `dest`), `ui/Hud.tsx`
  `RideBanner`, `actors/moveSystem.ts` + `actors/modes.ts` (the hop-off handshake: `brakeTransit` alights after 1.2 s
  whatever the speed), `actors/platform.ts`, `audio/{audio,logic}.ts` (`transitSound` plays cable-car kinds only),
  `world/materials.ts` (`patchToyShader` under the `ob-toy` key: the fleet materials link the same program as
  `TOY_BATCH`), `world/warmup.ts`.
- **Behaviour probes** (scratch `C:/Users/willy/opus-qa/w4/w4-t/probe-*.mts`): 1–3 simulated hours of the light rail with
  a side-by-side check; stop → attraction distances against lane P's `ATTRACTIONS`; station and portal coordinates
  against Wikipedia (`projectCity`).
- **Budgets:** near / far / props batched meshes (≤ 3 calls + 1 shadow, 7.5k tris worst) and the geometries (bus 1,060,
  LRV car 396, portals 168–324): within plan §3.7. **Per-frame allocations** found and removed (R9). **zh text** read on
  every label the lane builds (R8).

### Facts re-checked on the web (22, all ✓)

Twin Peaks Tunnel opened 3 Feb 1918 · 3.65 km · West Portal Ave & Ulloa St to Castro (en.wikipedia Twin_Peaks_Tunnel);
Sunset Tunnel opened 21 Oct 1928 · 4,232 ft = 1,290 m · N Judah only · east portal Duboce & Noe on Duboce Park · west
portal near Carl & Cole (Sunset_Tunnel); Muni Metro in the Market Street subway from 18 Feb 1980 · the N leaves it at the
Duboce portal, Church & Duboce (Market_Street_subway); OSM 3435877 = "Muni Metro N outbound: Caltrain => Ocean Beach"
(King & 4th → Judah & La Playa), OSM 3433314 = "M outbound: Embarcadero => Balboa Park" (openstreetmap.org); M stops West
Portal → West Portal & 14th → St Francis Circle → Right of Way/Ocean → Right of Way/Eucalyptus → Stonestown (19th Ave at
Winston Dr) → SF State (Holloway) → Randolph / Broad / San Jose → Balboa Park (M_Ocean_View,
Stonestown_Galleria_station); N serves UCSF Parnassus at Irving & 2nd / Arguello (N_Judah); Sunset Dunes opened 12 Apr
2025 on the Upper Great Highway between Lincoln Way and Sloat (Sunset_Dunes); Twin Peaks Blvd closed to cars at the
Burnett (north) gate since March 2021, Portola entrance open (sfmta.com, SF Chronicle) — the loop enters from Portola ✓;
JFK Promenade car-free Kezar → Transverse, western MLK Dr closed from the Metson / Middle Dr loop to Lincoln Way
(sfrecpark.org "Driving Around the Closure") — the loop joins MLK at Crossover Dr, east of the closure ✓; Embarcadero =
內河碼頭站 (zh.wikipedia). Coordinates: West Portal station 2.8 u, Stonestown 2.9 u, Judah & La Playa 0.9 u from the
Wikipedia points (≈ 20 m).

### Defects found and fixed

| # | defect | fix | test |
|---|---|---|---|
| R1 | `transit-sidecar.ts` line 99 (`let spot = null`, never read) failed `npx eslint .`, i.e. CI's `npm run check` on `opus-bay` (the lane linted `src/opus-bay tests/…` only) | initialiser dropped (`9423db5`, pushed first) | whole-repo lint 0 errors |
| R2 | **Opposite trains drove through each other near the mouths**: nobody steps aside within 20 u of a mouth (one-track hoods) and nothing kept two trains from meeting there — ≈ 15 s per simulated hour, e.g. two N trains overlapping at the Sunset Tunnel west portal (the landmark mouth); `violations()` did not look at opposite trains | a single-track stretch round every mouth (`GAUNTLET` = 20 u + a train + 4 u, the Duboce hood's 8 u shift included): wait at the edge while an opposite train is inside or has the right of way (one that can no longer stop, else the nearer); dispatch never places a train into a taken stretch or beside an opposite one; `violations()` reports side-by-side passes. 0 in 3 simulated hours with 2 and 3 trains a line (`515fb30`) | sf-metro "review: opposite trains never meet side by side …" (1 h); the 10-min test now checks it too |
| R3 | **Hop-off inside a mouth**: the brake was ignored only while the train was wholly hidden, so a rider could step off with the train half in the tunnel or under the Duboce hood (8 u outside the OSM tunnel end); the HUD only knew `underground` | ignored while any part of the train is in a tunnel span or under a hood (`canHopOffAt`; a brake begun outside goes on); `RailRideStatus.canHopOff`, read by `lineRideLabel` | sf-metro "review: no hop-off while any part …" |
| R4 | **The sims did not fit `game/ride.ts`**: `stepLineRide` reads `rideSystemFor(line).cars[st.car].pose` (`LineRideSystem`); BusSystem has `buses`, LightRailSystem `trains` with two poses each — the report's "stepLineRide already fits all three" was wrong | both `implements LineRideSystem` (tsc proves it): `BusSystem.cars` = the buses, `LightRailSystem.cars[i].pose` = train i's lead car (follows reversals) | sf-bus / sf-metro "review: … LineRideSystem" |
| R5 | **The rider rode along under the street**: `LineFleet` published the platform pose of the rider's hidden train (the report said it did not), so the rider and the streamer would follow the virtual subway at 25 u/s | no platform pose for a hidden train (the platform goes stale; ride.ts keeps the rider at the kiosk, integration step 4) | sf-metro "review: the fleet publishes no platform pose …" |
| R6 | Bus `door` events were emitted as transit `bell` (the plan's stop-request ding): after integration step 7 every stop would ring the stop bell twice on top of the air brake + door chime | doors emit nothing (arrive / depart carry the chime) | sf-bus "review: … doors emit no bell" (10 min at the Castro stop) |
| R7 | Bus sim: a bus pulling away from a stop reported a ≈ 1.5 s ETA for that same stop (it is a lap away), so a request there picked it; `requestNextStop()` during a hop-off hold skipped a stop | ETA = a lap; the held bus keeps the stop ahead | sf-bus "review: a bus pulling away …" |
| R8 | **Banner text too long and ambiguous on a phone**: "M 线 · 开往 19th & Winston · 石镇 · 下一站 森林山站", "旧金山观光环线 · 下一站 渔人码头 · 海德街 · 约 131 秒", "等N 线进站"; `LineRideLabel` had no `lineTo` / `dest`, so today's RideBanner could not show it | short names (`w4StationShort`: 石镇, 州立大学, 海洋海滩, Balboa Park, else the part before " · "), `W4_LINES[id].shortName` (观光环线 / N 线 / M 线), minutes past 90 s, "等 M 线进站…", `lineTo` + `dest` in today's RideBanner shape: "M 线 · 开往 石镇 · 下一站 森林山站", "观光环线 · 下一站 渔人码头 · 约 2 分钟" | sf-bus / sf-metro "review: … short names" (every loop banner ≤ 28 characters) |
| R9 | Per-frame allocations: `LineFleet.update` built 2 closures + 2 `forEach` closures + a `filter` array per Metro line per frame; the sims a closure per vehicle per step (`yAt`), one per bus (`boxes.forEach`), an object per rider-train step (the mouth), tuple arrays per tunnel (portal events), a closure per train (`tunnels.some`). Also: `SubwayOverlay` was one `aria-live` region whose seconds change every frame; stopped at a station without `onAlight` it said 隧道里不能下车; `perLine > 2` put two trains on one spot at start | loops and private methods, nothing allocated per frame; only the station line is a live region; start positions spread | the 10-min / 1-h sims (3 trains a line in the probe), the fleet budget test |

Also: `InterlockBox.other = { line, b0, b1 }` (the other line's part of a box) so `CableSystem.free()` can test its span
at integration; `PORTAL_HOOD_SHIFT` + `portalIdOf` live in `stationNames.ts` (pure; `portals.ts` reads it).

### Open (not fixed, with a default)

1. **Lane G (`actors/moveSystem.ts`), integration:** the Space / B / F hop-off calls `requestPlatformStop` + `brakeTransit`,
   and `modes.ts` alights after 1.2 s whatever the car's speed. In a tunnel or a mouth the LRV ignores the brake, so the
   rider would step off a moving (or hidden) train. Guard: no hop-off while `rideStatus().canHopOff === false` (say
   `lineRideLabel(...).hopOffNote`).
2. **Lane T (`game/ride.ts`), integration:** `rideSystemFor(line)` returns the cable system for any other id — it must
   return `activeLineFleet().bus` / `.rail` for `sf-loop` / `n-judah` / `m-ocean-view`; and while
   `rideStatus().underground`, `stepLineRide` must not copy `cars[st.car].pose` (the hidden train) into the player: hold
   them at the boarding kiosk.
3. `RideLabel.icon` (game/transit.ts) widens to `'bus' | 'metro'`; Hud.tsx falls back to `TramFront` for an unknown icon,
   so nothing breaks before lane G adds the glyphs; `rideLabel()` can return `lineRideLabel(...)` as is.
4. `audio/logic.ts transitSound` plays cable-car kinds only: bus / LRV events stay silent until integration step 7.
5. **Hagiwara Tea Garden Drive** (the loop's GG Park → Haight leg: Music Concourse Dr > Hagiwara Tea Garden Dr > MLK Dr) is
   not in Rec & Park's car-free list, but not confirmed open either; OSM tags it car-legal. Check at integration.
6. `muni-19th-holloway` lists `lake-merced` 240 u (≈ 1.7 km) away as served on foot; Kezar / Koret are listed under both
   Carl & Stanyan (49 / 72 u) and Carl & Hillway (26 / 46 u). Default: keep (★ and the approach use the first attraction).
7. Ride-time estimates do not include a wait at a single-track stretch (rare, ≤ ≈ 10 s); rides stay within the tests'
   15 % + 4 s. `LineLoops` keeps its oscillators running at gain 0 after the first ride (`dispose()` stops them).
8. Report text: the Requests to lane L above still say "a simple island + pole"; the code places a pole only (the lane's
   final note is right). `scripts/opus-sf/lib/metro.ts MOUTH_VISUAL_SHIFT` duplicates `PORTAL_HOOD_SHIFT` (same numbers).

### Integration changes (supersede the early plan where they differ)

- Step 3: `CableSystem.free()` refuses a span overlapping `box.other.b0 … b1` (plus the line's `s0`) while
  `bus.occupies(box.id)`.
- Step 4 (`ride.ts`): `rideSystemFor` routes the three ids to the fleet; `stepLineRide` holds the player at the kiosk while
  `underground` (Open 2; the fleet no longer publishes a hidden train's platform).
- Steps 5 / 6: the RideBanner keeps its `lineTo` + `dest` layout (`lineRideLabel` fills both); the SubwayOverlay gets
  `line.name = W4_LINES[id].shortName` and `destination = w4StationShort(to)`; moveSystem guards the hop-off with
  `canHopOff` (Open 1).
- Step 7: bus doors send no `bell` any more; `bell` (bus) = the stop request (`requestNextStop` → `stopBell`).

### Checks

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (42 warnings, none in lane-T files) · full suite
**649 / 649** on the pushed tree (`515fb30`, after rebasing) · the lane-T scripts type-check under a temporary file-only
config (only the unrelated `src/i18n` declaration errors) · sf-bus 21 tests, sf-metro 21 tests (8 new review tests, 4
each; the `515fb30` message says "9 … sf-bus 5": it is 4) · no Higgsfield credits.
