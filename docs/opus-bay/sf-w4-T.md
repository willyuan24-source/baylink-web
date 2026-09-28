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

## Integration part a

Written 2026-09-27 by lane T's integration implementer (worktree `wt/i4-t` → `opus-bay`). Commits: `b093e8e`
(publish + data), `b88d4f9` (wiring), `b41e95c` (routed wave-3 requests), `fd57e45` (budget: one fleet for every city
line), `3b3235c` (lane C's pacer / goals, the veil, H, short rows, the full build), `c182311` (walker obstacles, shots),
`89bb4af` (honest ride times, boxes held by bodies), `8f40d61` (portal hold, soft prefetch) and the one carrying this
section (`nextArrival` for cable stations).

### 给主人的摘要

**进度（回答"现在进度如何"）：T 组（公交 / 地铁线路）的"接入"第 a 部分已经全部做完、推送上线；下面是结果。**

1. **观光巴士和 N / M 两条地铁在城市模式里真的能坐了。** 走到站牌或地铁口按 E，选目的地（带 ★ 的是景点站，旁边写着大概几分钟）。巴士坐在上层露天前排，BAYBAY 每到一站讲一句；地铁在地下时换成"隧道"界面，快出隧道口时先把地面上的城市加载好再钻出来（实测出洞那一刻不卡）；很远的"直接到站"会先暗一下屏、等目的地加载好再亮起来。
2. **巴士会和叮当车、F 线老电车互相让路。** 在共用的路段（海德街终点、加州街、卡斯特罗、Market 街）谁先进路口谁先走，另一辆在路口外等。连续模拟一小时：0 次撞到一起。顺便修好了 F 线在卡斯特罗掉头环线上可能永久堵死的老毛病。
3. **性能达标，还变快了。** 所有线路的车（叮当车、F 线、巴士、轻轨）合成 2 次绘制 + 1 次影子，只有离镜头 60 米内的车才投影子；唐人街从 40.7 万个三角形降到 38.6 万（原来超标，现在达标），11 个测点全部通过，着色器数量不增加；游戏主包反而比开工前小（298.7 KB）。
4. **别的组转来的 7 条请求都做完了**（英雄区 F 线下车先刹车、新的模型加载器、城里行人绕开 6 位居民、渡轮下船兜底位置、方向信息、影子只在近处、预算确认），还给 P 组的站牌卡片加上了叮当车站的"下一班几分钟"。
5. **还要别的组帮忙的**：坐轻轨时镜头离车太近，会"钻进"车厢（镜头归 G 组）；巴士上层在窄街会穿过行道树；巴士在海德街终点偶尔要等叮当车掉头，最长约 40 秒。手机 4 倍降速的帧率需要 V 组在空闲机器上正式测一次。所有测试通过，Higgsfield 花费 0。

### What was wired (files, API)

| file | change |
|---|---|
| `public/opus-bay/sf/v1/transit.json` | the wave-2 lines unchanged + `sf-loop`, `n-judah`, `m-ocean-view` + `props` (each stop's placed pole / kiosk); byte-identical to the sidecar's output; `transit-w4.json` kept with the same lines (other lanes' tests read it) |
| `scripts/opus-sf/transit-sidecar.ts`, `scripts/opus-sf/lib/transit.ts` | `--publish` writes the props, re-runs are idempotent; `buildW4Lines` is shared by the sidecar and the full build (`buildTransit` appends the three lines and the published props: a full build writes the same lines, props and source — checked) |
| `data/transit.ts` | `TransitLineJson` widened (kind, short, loop, tunnels, speeds, major, attractions, props); `buildTransitW4` / `transitW4` / `setTransitW4` / `boardAt`; the fleet registry `setActiveLineFleet` / `activeLineFleet` (type-only import); `w4Kind`; `rideSystemFor` routes the three ids to the fleet's buses / trains |
| `world/transitLayer.ts` | hosts `LineFleet` (+ cable cars and F-line cars as its extra kinds), the interlock boxes, portal readiness (streamer `whenReady`), the ride prefetch (lane V's soft `prefetch`, 200 u ahead), road vehicles, surface Metro runs as transit streets, walker obstacles; DEV `__opusBay.transitLayer` |
| `world/sf/lineFleet.ts` | `ExtraVehicleKind` / `drawExtra`; per vehicle a near slot (casts, ≤ 60 u, `FLEET_DEPTH`), a mid slot (≤ 110 u) and a far slot (≤ 300 u); `roadAhead` for buses; `roadVehicles`, `surfaceRuns`, `obstacles`; `busInterlocks({ body })`; `dir` + the stop's attraction on the rider's events, remote sounds located (`emitAt`); a hidden rider train publishes no stale platform |
| `world/sf/lineInterlocks.ts` (new) | `interlockLines` (cable lines, the F-line's whole cycle, with their bodies), `boxBlocked` (a body + 14 u approach while moving), `busAheadOfFCar` (the box edge a bus holds) |
| `world/lineTrack.ts` | `bodySpans` (where two vehicle bodies can touch: separating axes over both tracks) |
| `world/busSystem.ts` | `roadAhead` (buses keep behind toy cars / the player's vehicle in their lane) |
| `world/transitLine.ts` | cable cars never claim a span through a box a bus is in (`free`) and stop short of it while running (`boxAhead`) |
| `world/flineSystem.ts`, `world/flineLayer.ts` | `roadAhead` (stop at a bus-held box edge), `firstInLine` (block queue fix), `setDrawer` (cars drawn by the fleet), `FLINE_LIVERIES` |
| `world/rails.ts` | straight steps laid as one run (≤ 14 u), plates every third step: Chinatown's rails 10k → 4.7k triangles |
| `world/streetcar.ts`, `game/ride.ts` | the hero F-line ride carries `line: 'streetcar'` + `hero` (`isLineRide` excludes it), the hero car honours `requestPlatformStop('streetcar')`; a Metro rider is held at the boarding kiosk under the overlay and moved to the exit portal 80 u before the train emerges (`lineRideUnderground()`) |
| `game/lineRides.ts` (new, lazy) | boarding dialogue (`boardLine`, busDriver / metroOperator lines, pre-filled `to`), `rideLine`, `lineLabel`, station interactables at the props (上观光巴士 / 坐 N 线 / 坐地铁), `stationRides`, `nextArrival` (loop, Metro and now cable stations), `requestNextStop`, `subwayView`, `leaveSpot`, `skipCounts`, `veiledSkip` (> 250 u), `stopVoiceIds`; lane G's `registerTripLines('t-w4')` + `registerLineEstimator`; lane C's `sayTunnel`, `offerLine` (hop-off tip), `noteLoopRide` |
| `game/transit.ts` | stubs other lanes call (`boardLine`, `stationRides`, `nextArrival`, `requestNextStop`, `subwayView`, `alightHere`, `setLineMapOpener`, `loadLineRides`, `lineRides`); `RideLabel` icons 'bus' / 'metro' + `canHopOff` / `hopOffNote` / `nextStop`; no hop-off in a tunnel, under ground only at a kiosk; 直接到站 counts a real leg; H on the bus = the stop bell; the ferry quay fallback |
| `ui/LineRideLayer.tsx` (new, lazy), `ui/SubwayOverlay.tsx`, `ui/transit-ui.css`, `ui/Overlay.tsx` (3 lines in lane G's file) | the subway overlay during a Metro ride (BAYBAY's line, 直接到站); the RideBanner steps aside while it is up (`:has()` rule) |
| `audio/audio.ts`, `audio/lines.ts`, `audio/logic.ts`, `audio/cityHooks.ts`, `audio/voice.ts` | bus / LRV one-shots (panned: arrive, doors, stop bell, gong, horn), `LineLoops` from the tick, the next stops' tour clips fetched ahead, `TOUR_VOICE_CHECK` muted |
| `world/life.ts`, `world/sf/cityLife.ts` | `heroGltfLoader()`; city walkers step round the six residents within 100 u |
| tests | `tests/opus-bay-sf-lines-int.test.ts` (new, 12 tests), `tests/opus-bay-sf-hopoff.test.ts` (the hero case now expects the braked hop-off, on purpose: the requested behaviour) |

### Evidence

- **Checks** before each push: `tsc` 0, `npx eslint .` 0 errors (warnings none in lane-T files), the full opus-bay
  suite green (820 / 820 on `8f40d61`; **821 / 821** on this section's commit, rebased on `39993fb`). Two wall-clock tests of other lanes
  (audio "P1 sliced jobs", sf-move2 "E2-5") failed once each under machine load and passed alone.
- **Perf gate** (lane V's `w4-perf.mjs`, desktop RTX, 1440 × 900, quality high, golden, 11 spots; calls / triangles
  incl. shadows): ferry-gate 70 / 240k · chinatown 124 / 386k · twin-peaks 119 / 378k · ocean-beach 45 / 105k ·
  ggb-south 65 / 121k · mission 81 / 337k · union-square 82 / 286k · civic-center 88 / 303k · music-concourse 89 / 251k
  · stonestown-sfsu 74 / 194k · haight-usf 90 / 305k: **all pass**, programs 48 → 48, 0 frames over 100 ms, p95 ≤ 16.9
  ms. Before the fleet batching / rail runs Chinatown read 130 / 407k (**fail: tris**).
- **Shared streets** (node, 60 simulated minutes, 3 buses + the cable cars + the F-line cars, the game's own glue incl.
  the F cars' `roadAhead`): **0 overlapping frames**, 0 block violations, ≈ 3.8 laps a bus (≈ 15.7 min a lap); longest
  box waits: Powell–Hyde terminus 39 s, the F-line's shared stretches ≤ 27 s, California 1.3 s (≈ 50–60 s before boxes
  were held by bodies); longest F car stand 24 s, cable car 22 s. The old F-line queue jammed the Castro loop for good
  after ≈ 37 min (a 1,452 s stand) — pinned by the test. (Without the F cars' `roadAhead` the same sim shows 14
  overlapping frames: the glue matters.)
- **Ride times** (node, six legs × 3): within ± 10 % of the shown estimate, except legs that meet a cable car at the
  Hyde terminus / California or an F car at the Castro hairpin (up to + 55 s).
- **Portal cuts** (N through the Duboce and Sunset portals, desktop 1×): no frame over 100 ms at either emergence after
  the exit-portal hold. Phone profile (390 × 844, mid, 4× CPU) only indicative: the machine sat at 87 % CPU with many
  other Chromes (bus ride 24 fps, N ride 18 fps) — lane V / the lead should run the gate quietly.
- **Bundle** (`vite build`): GameRoot 791.35 kB / **298.68 kB gzip** (origin `786c93e`: 310.82); lazy chunks
  `lineRides` 6.70, `LineRideLayer` 2.45 + css 1.56, audio `lines` 1.87, `transitLayer` 47.18 kB gzip.
- **Shots** (all read; `docs/opus-bay/qa/w4/T/`): `ux-w4-bus-deck.jpg` (1440 × 900: the open top deck along the Marina
  lagoon, the banner "Sightseeing Loop · next Palace of Fine Arts" with Stop at the next / Hop off here / Skip to stop,
  BAYBAY: the rotunda is from the 1915 world's fair), `i-subway-overlay-phone.jpg` (390 × 844 @3×: the M under Market
  St, the stop strip, "Next Civic Center · ~6s", the 1980 fact, "No getting off inside the tunnel", Skip to stop),
  `i-n-surfacing-duboce.jpg` (the N out of the Duboce portal toward Carl & Cole; shows the LRV camera clipping into the
  lead car — gap below), `i-m-19th-winston.jpg` (the M on 19th Ave, "Goal complete: Take the Metro to the sea or to SF
  State"; the same camera clip), `i-night-bus.jpg` (the bus near Pier 39 at night: lit windows, deck bulbs, tail
  lamps), `i-kiosk-embarcadero.jpg` (the Embarcadero kiosk, "Ride Muni Metro · Embarcadero", the Ferry Building
  behind), `i-skip-veil.jpg` (a long 直接到站 under the veil: "Next stop: Chinatown · Union Square …").

### Decisions

- **Stops keep their x, z; you board at the prop.** Lane C pins the stop points, so the placed pole / kiosk (`props`)
  is the boarding point (interactables, planner stops, where an underground ride ends); the stop point stays the
  track-side reference. No cross-lane re-pin.
- **The wave-4 game code is one lazy chunk** (`game/lineRides.ts`, loaded by `initTransit` in city mode); the main
  graph keeps thin stubs, and GameRoot did not grow.
- **The subway overlay mounts from `ui/Overlay.tsx`** (3 lines in lane G's file) and hides the RideBanner with a CSS
  `:has()` rule in lane T's stylesheet while up (its card carries the line, next stop and 直接到站).
- **Every city line vehicle in the fleet's two batched meshes** (the plan's optional step): cable cars and F-line cars
  are extra kinds with near / mid / far slots; the old InstancedMeshes remain only for a transit file without the
  wave-4 lines.
- **Interlock boxes from bodies, both ways**: a box is where a bus body and a cable / F car body can touch (centre-line
  distance missed the bus's Castro hairpin next to the F terminal loop); a box is held by a vehicle's body (plus its
  stopping distance while moving), not a cable car's whole block; cable and F cars stop at the edge of a part a bus is
  in. `firstInLine` was needed because those stops lined F cars up at the loop.
- **Honest times**: the boarding stop's dwell is part of the shown ride time; 直接到站 farther than 250 u waits under a
  veil until the destination is ready (whenReady, 8 s cap).
- **Out of the subway**: the held rider moves to the exit portal 80 u early so the portal's surface streams at the
  player's own priority under the overlay (a soft prefetch alone dropped its focus before the cut).
- **H on the sightseeing bus is the stop bell** (下一站下车); on the LRV it stays the gong.
- **Narration goes through lane C's pacer** (tunnel line, hop-off tip); T keeps only the bus's boarding bubble.
- **Walker obstacles are soft** ('static' for poles / kiosks / portal hoods, 'traffic' for vehicles): no chunk rebuild,
  nothing new in the walk rasters.

### Known gaps

- **LRV ride camera** (lane G): the rider stands at the lead car's front; the ride camera sits inside the train and
  dithers through its body (`i-n-surfacing-duboce.jpg`, `i-m-19th-winston.jpg`).
- **Bus upper deck under street trees**: on narrow streets (Castro St) the camera and deck pass through canopies.
- **Hyde St terminus**: the loop's Wharf stop sits on the Powell–Hyde turnaround, so a bus there can wait for a car on
  the turntable (≤ 39 s an hour); estimates exclude box waits. Moving the stop means a loop re-bake (lane C pins it).
- The loop's blend into Jefferson St in the hero west end was checked from above only.
- The 直接到站 veil is plain text (no art).
- `transit-w4.json` duplicates the three lines; `manifest.json` still says `transitLines: 4` (informational).
- Phone 4× fps not measured on a quiet machine (above).

### Not done (part b)

- The phone gate on real rides (bus deck, N at Duboce, M at West Portal) on a quiet machine
  (`__opusBay.transit.rideLine(line, from, to)` / `me()` board from a script).
- In-game shots that wait for lane G's LRV camera (N at the Sunset Tunnel west portal, M emerging at West Portal) and a
  clean loop-pole close-up.
- A real dark tube for the Sunset Tunnel instead of the overlay (plan R5: later polish).

### Requests

- **Lane G**: the LRV ride camera (a side chase outside the train or a rear-window spot); canopy fade over the bus deck.
  `lineRideUnderground()` (game/ride.ts) tells a camera that the rider is under the overlay.
- **Lane V**: the phone 4× gate on real rides (above); a listening pass for `audio/lines.ts` (air brake, doors, stop
  bell, gong, horn, hum / whine / tunnel rumble) — generated SFX are your call; the late `w4-lines` warm-up and batched
  caster depth were checked flat (48 programs).
- **Lane C**: none open.
- **Lane P**: `nextArrival` now answers for cable-car stations (your optional request).
- **Lead**: drop `transit-w4.json` once no test reads it; `manifest.json` `transitLines` 4 → 7 at the next data touch.

Relayed owner message during this part — "现在进度如何" — answered by the first line of the summary above.

## Integration part b

Written 2026-09-27 by lane T's integration implementer (worktree `wt/i4-t` → `opus-bay`). Commits: `a742dc8` (W4-T16,
D2), `359edea` (W4-T17, D3), `9025867` (W4-T18, D3 / M2 / D11 / m5), `b1ce881` (W4-T19, m6 / F4), `d118962` (W4-T20, C13
and the part-b tests), `b5248ac` (W4-T18b), `31fbc29` (W4-T18c), `d8330c8` (W4-T21, the shots), `f5da536` (W4-T18d) and
the one carrying this section.

### 给主人的摘要

**进度（回答"现在进度如何"）：T 组（公交 / 地铁 / 叮当车 / 渡轮）第 b 部分完成并推送：验收找到的、归 T 组的 8 个问题全部修好，每个都有测试和游戏内截图；剩下的是别的组的活和需要空闲机器的手机测速。**

1. **渡轮到 41 号码头不再被困住。** 原来的下船点在 45 号码头的棚屋平台上，四周被棚屋堵死，只能坐船离开。现在渡轮停靠在渔人码头的海滨步道边，下船就是步道，能走到全城（自动测试检查过）。
2. **叮当车不会再"卡"在终点站前。** 站在转车台旁边（地标卡片的位置）时，车会正常开进站、掉头；如果真的站在轨道上挡路，响铃几秒后 BAYBAY 会提醒"往路边站一站吧"。全部 56 个叮当车站的上车点都挪到了轨道旁边，不会站在铁轨上等车。
3. **"直接到站"一定把人送到站。** 目的地还没加载时，屏幕先暗一下，等那一片城市加载好再把你放到站台旁（手机上实测 Hyde & Beach 正确落在轨道旁的人行道上），不会再出现"提示到站、人却留在半路"。渡轮等船时也能直接到站（按钮请 G 组加在横幅上）。
4. **渡轮报时变诚实。** 选项里写明"约 186 秒，船约 85 秒后到"，不再只写航程。
5. **景点落地时路人不再挤在你身边或挡住脸**；你走近站着的游客，他们会让开。N 线的路线说明中英文一致（市中心 → 科尔谷 → 内日落区 → 海洋海滩）。所有测试 880 个全部通过，Higgsfield 花费 0。

### Findings fixed (lane T's files)

| finding | fix | evidence |
|---|---|---|
| **D2** (major) Pier 41 landing traps the player | `data/ferry.ts`: the berth moves to the Wharf promenade (−194.9, 46.4, the hull alongside the stones, heading −30°) and the quay onto the promenade (−186.5, 48.4); the loop comes round north of Pier 39 (19 u clear of the K-Dock floats, 32 before) and leaves west past the pier heads, 1,232 u (was 1,133), Gate E → Pier 41 543 u of arc. The old quay's walkable region was 605 cells of 0.75 u (x −267…−213, z 67…83: the Pier 45 shed deck, walled in by the shed buildings at the pier root) | `opus-bay-sf-ferry` "verify D2" (floods the quay's ground: > 10,000 cells reaching 140 u; the loop-over-water test passes the new loop); in game the flood from the quay reaches x −233…−126 within 60 u; `i-ferry-pier41-quay.jpg` (the boat alongside the promenade, "Take the ferry · Pier 41") |
| **D3** (major) a cable car never pulls into Powell & Market while the player stands at the terminus | `data/transit.ts PERSON_CLEAR` (0.8 u): a cable car (`world/transitLine.ts`), F-line car (`flineSystem.ts`), bus (`busSystem.ts`) or Metro train (`lightRail.ts`) runs in to its stop past someone standing beyond its resting nose (the turntable card spot is 2.8 u past it; the car used to stand 0.4 u short for good); someone on the stop itself still holds it, `viewerHeld()` counts how long, and after 4 s BAYBAY asks them to step aside (once in 40 s). Every cable-car station's prompt stands beside the track: the nearest standable spot 2.6–5.5 u round the station ≥ 2.45 u from every track there (a passing car reaches 2.05 u), 5–7 u from a turntable's centre; all 56 stations get one (a search that finds none is tried again 5 s later) | `opus-bay-sf-transit-verify` (pull-in, held + the ask, 56 prompts on walkable ground off the track; the pull-in test fails with the old rule); in game: the car reaches s 0, dwells and turns with the player on the card spot (`i-cable-turntable-pullin.jpg`); BAYBAY "The cable car is waiting for us. Let's step to the side" (`i-step-aside.jpg`); the Powell & Market prompt at (135.6, 257.6), 5.2 u from the disc |
| **M2** (major) 直接到站 on a cable car leaves the player mid-route with "到站" | `game/transit.ts leaveLineRide`: a skip on any city line to a stop that is far (> 250 u) or not streamed in (ground pending / nothing walkable within 16 u) waits under the veil (`lineRides.ts veiledSkip`, now "stream, then jump": whenReady 150 u, 8 s cap), then puts the rider at the stop — a cable-car stop's prompt beside the track, never on the rails; "到站" only once the rider stands there; a second tap starts no second veil | test (veil, one veil for two taps, nothing said until landed, landed at the stop); phone 390 × 844 zh: Powell & Market → Hyde & Beach skip lands at (−222.3, 133.3), standable, "到站：Hyde & Beach" (`i-skip-veil-phone.jpg`, `i-skip-landed-phone.jpg`) |
| **D11 / m5** (minor) the ferry offer leaves out the 80–140 s wait; no skip while waiting | the offer counts the wait (`ferryWaitSeconds`: the boat's eta with the dwell a waiting rider cuts): "去渡轮大厦 · E 号登船口（约 186 秒，船约 85 秒后到）" / "(~186s · boat in ~85s)"; `RideLabel.skipWhileWaiting` on the ferry, and finishRide while waiting puts the rider on the other quay (under the veil), never a ride | tests (the label's numbers, the boat boards within 20 % of the said wait; the skip while waiting); `i-ferry-offer-phone.jpg` |
| **m6** (minor) characters crowd the player at arrival spots | `world/sf/crowd.ts`: no walker or sightseer spawns within 2.5 u of the player, BAYBAY or a resident; a sightseer the player walks up to shuffles back to 1.5 u (a stander's spot is now its base: the push — and a hop out of a bus's way — used to be cancelled out every frame, so standers never moved) | test (plaza spots on the player stay empty; a sightseer 0.4 u away shuffles to ≥ 1.2 u); phone Twin Peaks arrival: 0 walkers within 2.5 u over 17 s (`i-twin-peaks-arrival-phone.jpg`). Lane L's W4-IL15 keeps the plaza spots off the site arrivals too |
| **F4** (minor) per-frame allocations | `world/sf/recordPool.ts` (new): the obstacle and road-vehicle sources reuse their records, one pool per consumer array (traffic, crowd, the cable / F-line cars, the fleet's buses, trains and stops); city life's focus, avoid and people lists reuse theirs. (crowd's sort and the F-line layer's counters were already clean; kitSwap / sites are lane L's) | test (the same records frame after frame; another consumer's array does not overwrite this one) |
| **C13** (minor) the N route text differs in zh / en | `data/sf/stationNames.ts`: "市中心 → 科尔谷 → 内日落区 → 海洋海滩" and Carl & Cole glossed 科尔谷 (Cole Valley, south of the Haight; the recorded line already says "海特街在北边不远"); transit.json and transit-w4.json re-published (only that gloss changes, checked byte for byte) | `opus-bay-sf-metro` pins 科尔谷 (on purpose) |

Checked, not lane T's (in their owners' lists): D1 (L, fixed W4-IL11), F1 kit swap and F3 quality (L / V), F2 the touch
seat button (G: 坐下 now shows on the bus deck, `i-bus-banner-phone.jpg`), D2's give-up message (G, W4-IG13), D4 / F6 /
C3–C10 (L / C), B1 / M1 / M3 / m1–m4 (P / G / C), the visual sweep (V).

### Part a's leftovers

- **Plan §5.3 shots, in the real game**: RideBanner on a phone (`i-bus-banner-phone.jpg`: "观光环线 · 下一站 双峰",
  下一站下车 · 直接到站 · ⋯), the N out of the Sunset Tunnel west portal (`i-n-sunset-west.jpg`, a QA camera over the cut), the
  M on 19th Ave at Winston (`i-m-19th-winston-ext.jpg`, from outside the train), a loop stop pole (`i-loop-pole.jpg`, Castro);
  with part a's bus deck, subway overlay, Duboce, Winston-from-the-train, Embarcadero kiosk and night bus the list is
  complete. Rendering was not touched in part b (calls / triangles / programs as in part a's gate: max 124 / 386k / 48).
- **Phone 4× CPU gate**: still only indicative — the machine sat at 37–63 % load with other lanes' Chromes: an N ride
  Van Ness → Carl & Hillway at 390 × 844 mid 24.5 fps (p95 116 ms, 52 calls, 171k tris, 54 programs); the portal-cut
  sample at 63 % load read 9.7 fps even under the subway overlay (frames there cost as much as on the surface; lane V's
  background "live" warm-up ran 11.3 s during it). Official run: lane V / the lead on a quiet machine.
- **GameRoot**: part b's city-only helpers (kerb spots, the step-aside ask, the veil test, the ferry wait) live in the
  lazy `game/lineRides.ts` chunk (7.73 kB gzip); GameRoot 296.16 kB gzip on `83d73a6` (296.75 before moving them; ≈ 295.8
  without part b's main-graph changes).

### Decisions

- **The Pier 41 landing moved, not the pier fixed**: the shed deck's way ashore is walled by the chunk's building
  footprints (lane L / V data; a chunk rebuild is out of scope); the promenade berth keeps the loop's ≥ 1 u / 3 u
  clearances. The terminal keeps its id and name (41 号码头).
- **A person past the stop is not in the way (0.8 u past the nose); a person on the stop is**: the vehicle never runs
  into anyone; BAYBAY asks instead of pushing the player.
- **"Stream, then jump"** for every veiled skip (the ride goes on under the veil): the rider lands on ground that has
  loaded, and the kerb spot of a cable-car stop can be found.
- **The skip while waiting** lives in the flow and the label; the button is lane G's banner (request below).

### Known gaps

- The LRV ride camera still sits inside the train (lane G); the §5.3 Metro shots are from outside.
- Pier 45's shed deck stays walled in (the walk graph thinks a leg exists there: lane G's walker gives up now).
- The 3D scene keeps rendering under the opaque subway overlay (see Requests).
- A skipped cable-car ride says "多坐几站再下车，才算坐过叮当车哦" (lane C's hook): true (a skip never counts) but a little
  preachy after 直接到站.

### Not done

- The phone 4× gate on a quiet machine (above); the dark Sunset Tunnel tube (plan R5, later polish); moving the loop's
  Wharf stop off the Powell–Hyde turnaround (a loop re-bake + lane C's pins; ≤ 39 s box waits an hour).

### Requests

- **Lane G**: (1) `ui/RideBanner.tsx`: in the waiting stage show 直接到站 when `rideLabel(ride).skipWhileWaiting` (the
  ferry: finishRide already puts the waiting rider on the other quay); (2) the LRV ride camera (part a's request, open).
- **Lane V**: `world/WorldScene.tsx`: skip the draw (not `world.update`) while the subway overlay covers the view
  (`subwayView()?.visible` from game/transit.ts, or `lineRideUnderground()` in game/ride.ts): on a phone the frames under
  the overlay cost as much as on the surface; the phone 4× gate as above.
- **Lane L / V**: Pier 45's shed deck has no walkable way ashore in the published city (the building blockers at the pier
  root, x −216…−205, z 70…80): open a gap if the pier should be walkable.
- **Lead**: part a's two items stand (`transit-w4.json`, `manifest.json transitLines`).

### Checks

On the pushed tree `f5da536` (rebased on `0325f32`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors
(43 warnings, none in lane-T files) · full opus-bay suite **880 / 880** (`sf-move2` "E2-5 view field" failed once under
load on an earlier run and passed alone, lane G's wall-clock test) · `opus-bay-sf-transit-verify` 8 tests, `sf-ferry` 6 ·
no Higgsfield credits.

Relayed owner message during this part — "现在进度如何" — answered by the first line of the summary above.

## Integration review

Written 2026-09-27 by lane T's adversarial reviewer (worktree `wt/i4-t` → `opus-bay`), over every W4-T commit of this
run (`b093e8e` … `0fc539e`, incl. `b41e95c`). Commits: `W4-T-int-review` ×3 (the props, the game code + tests, this
report with the flood tweak and the shots).

### 给主人的摘要

**进度（回答"现在进度如何"）：T 组的复查做完并推送：找到 6 个真问题，全部修好、有测试，并在游戏里（电脑和手机）实际走过一遍。**

1. **最严重的一个：66 个站牌 / 地铁口里有 22 个被房子围在"死角"里**（卡斯特罗、教堂街地铁口，海洋海滩终点站牌等）。坐地铁到卡斯特罗下车，或者用"直接到站"，人会被困在墙缝里走不出来（游戏里实测按方向键 20 秒只挪了 1 米）。现在所有站牌都重新摆在能走到街上的地方，另加了自动检查。
2. **叮当车站的上车点之前挪到了观光巴士车道和 F 线轨道上**（加州街、Powell & Market 等），站在那里等车会挡住巴士 / 电车；现在离所有车道都有安全距离。地铁在中途站停靠时按"直接到站"会被放在那个中途站，也修好了。
3. **手机上市中心的地铁站选项更有用了**：原来"市政中心 / 蒙哥马利 / 内河码头"各重复出现两次，却没有"海洋海滩"；现在每个目的地只出现一次，N 线终点和 M 线终点都在。

### What was checked

- Every W4-T commit's code: game/transit.ts, game/lineRides.ts, game/ride.ts, data/transit.ts, data/ferry.ts, the four
  vehicle systems (PERSON_CLEAR, viewerHeld), world/transitLayer.ts, world/sf/{lineFleet,crowd,traffic,cityLife,
  recordPool,lineInterlocks}.ts, ui/{LineRideLayer,SubwayOverlay}.tsx, scripts/opus-sf/{transit-sidecar,lib/stopPlace}.ts.
- Geometry over the published data (node, the game's own walk terrain from the chunks and the city's sites): every place
  a line ride puts the rider (66 wave-4 props, 56 cable-car prompts, the F-line stations, both ferry quays) flooded for a
  way out; every prompt's distance to every vehicle path.
- In the real game (dev server 5402, RTX): desktop 1440 × 900 and phone 390 × 844 @3 (touch, zh): the Castro kiosk
  (walk-out before / after), a real M ride Civic Center → Castro ending under ground, 直接到站 while the M dwells at
  Montgomery, 在这站下车 at Civic Center (phone), the Powell kiosk dialogue (phone), the Powell & Market prompt, the La
  Playa pole, district mode (the hero F-line ride and a Space hop-off). Every image read.
- Claims in parts a / b against the code: the pooled records (F4: one pool per consumer array, every consumer clears its
  array first), the stander base (m6), PERSON_CLEAR in each system (measured from the resting nose everywhere), the
  ferry landing (D2: joined), the ferry wait label (D11), district strings (unchanged), teardown (the layer's disposers).

### Defects found and fixed

| # | defect (severity) | fix | evidence |
|---|---|---|---|
| R6 | **22 of the 66 wave-4 props stood in walled gaps behind the kerb** (major): the sidecar's clearances (building footprints, road edges) accepted gaps between footprints that the walk rasters close: the Castro and Church kiosks, Duboce & Church, the La Playa pole (the N's goal end), the Palace of Fine Arts / Haight / Painted Ladies poles, most outer Judah stops. An underground arrival (always at the kiosk) or 直接到站 left the rider walled in; part a said "kiosks on a free patch of sidewalk / plaza" | `transit-sidecar.ts walkJoined`: each candidate is flooded on the game's walk terrain (published chunks + `SF_SITES`, 0.5 u, the player's radius) and must reach 24 u, judged at the published (rounded) spot and firm round it; where the buildings stand at the kerb, `stopPlace.placeOnStreet` puts the pole on the roadway's edge 2.6 u clear of every surface vehicle path. transit.json / transit-w4.json re-published: lines byte-identical, 45 props moved (most < 1 u; Castro 12.8, Church 31.6) | test R6 (66 props + 2 quays joined); game: at the old Castro kiosk 20 s of WASD moved the player 1 u; after the fix a real M ride to the Castro ends on the Market St sidewalk and the player walks off 10 u (`r-castro-arrival-phone.jpg`); `r-la-playa-pole.jpg` |
| R1 | **The D3 cable-car prompts stood in other vehicles' paths** (major): only the station's own track was cleared: California & Davis / Front / Battery / Sansome 1.1–1.6 u from the bus loop, Powell & Bush 0.09, Hyde & North Point 0.88, Powell & Market 1.0 and California & Drumm 0.6 u from the F-line's rails. A bus / streetcar stopped for whoever stood at the prompt, and ran through a rider waiting there for a cable car | `lineRides.ts kerbAround`: ≥ KERB_OFF 2.45 u from every vehicle path (cable lines, the F-line incl. the hero waterfront, the loop, the N / M outside tunnels: `vehicleSegmentsNear`), on ground joined to the street (`walkJoinedNear`, 10 u; unstreamed ground counts as closed, a miss is retried); rings out to 9 u; a street too narrow for 2.45 (Powell & Bush) takes the joined spot farthest from the paths if ≥ KERB_MIN 1.6 (no vehicle stops for someone there) | test R1 (56 stations, independent path distances; red on the old code); the Powell & Market prompt on the plaza (`r-powell-market-prompt.jpg`); all 56 searches 13 ms in node |
| R2 | 直接到站 to a city F-line station landed on the rails (minor): the station point is on the track | `flineLandingSpot`: the hero stop's platform (district anchor), else the kerb as in R1 | test R2 |
| R3 | **Metro 直接到站 during a dwell went to the wrong station** (major): pressed while the train stood at a station on the way, the rider was put at that station (leaveSpot took the dwelling station first); 在这站下车 followed the train when it pulled out under the veil; a skip count named the destination | `leaveSpot(…, alightAt)`: 直接到站 → the destination, 在这站下车 → the station tapped at (kept through the veil); `skipCounts` / `countRide` use where the rider got off | tests R3 (both red on the old code); game: a skip at the Montgomery dwell lands at the Castro kiosk, "Arrived: Castro" (`r-metro-skip-at-dwell.jpg`); phone 在这站下车 at Civic Center lands at its kiosk, "到站：市政中心站" |
| R4 | Shared Market St stations on a phone: Civic Center / Montgomery / Embarcadero twice (N and M) and no Ocean Beach / Balboa Park row (minor, UX): a cap per line | `stationChoices`: the lines' rows in turn, each destination once, one cap for all | test R4 (5 stations × phone / desktop); `r-powell-kiosk-rows-phone.jpg` (6 rows: 市政中心 · 蒙哥马利 · 内河码头 · 海洋海滩 · Balboa Park · Duboce & Church) |
| R5 | A throwing jump left the veil (pointer-events on) over the whole game (minor, robustness) | `veiledSkip`: the veil lifts in a `finally`, the error is reported | test R5 |

### Open (not fixed)

- The zh boarding rows show "Balboa Park" and "Duboce & Church" untranslated (the short name is the part before " · " in
  `stationNames.ts`); a content call, left as is.
- On a phone at Powell / Civic Center the M's Stonestown / SF State rows do not fit in the 6 (La Playa and Balboa Park
  do; desktop shows 8). Lane P's station card and the map still reach them.
- While a 直接到站 veil is up (≤ 8 s), a hop-off or a map fly-to is ignored and the landing wins.
- The subway overlay pops off without its fade when the ride ends (LineRideLayer unmounts with the ride).
- Part a / b open items stand: the phone 4× gate on a quiet machine (lane V / lead), the LRV ride camera (lane G), Pier
  45's walled shed deck (lane L / V), `transit-w4.json` and `manifest.json transitLines` (lead).

### Checks

On the pushed tree (rebased over `9953a4c`): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 warnings,
none in lane-T files) · full opus-bay suite **895 / 895** · new `tests/opus-bay-sf-transit-review.test.ts` 7 tests (red
on the old code, green now) · the sidecar re-run on the rebased tree reproduces the published bytes · `vite build`:
GameRoot 775.19 kB / **292.45 kB gzip**, lazy `lineRides` 8.64 kB gzip (+0.9) · no Higgsfield credits · dev server 5402
stopped.

Relayed owner message during this review — "现在进度如何" — answered by the first line of the summary above.
