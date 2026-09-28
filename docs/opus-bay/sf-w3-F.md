# Wave 3 · lane F (transit, city life, audio)

## Part a

### 给主人的摘要

- 第一次点击 / 按键时的卡顿（音频启动）已修好：渡轮码头实测第一段走路 0 帧超过 100 ms。
- 城市模式里 F 线老电车现在从 PIER 39 一路开到卡斯特罗：沿 Embarcadero、绕过渡轮大厦前的广场、整条 Market 街、在 17th & Castro 绕一圈掉头；4 辆车，Market 街上是单线、在车站错车。实测从渡轮大厦上车约 130 秒到卡斯特罗。
- 开场那艘渡轮在城市模式里变成可以坐的船：上层是露天甲板（长椅、栏杆），渡轮大厦 E 号登船口 ⇄ 41 号码头，路过 39 号码头的海狮，约 75 秒一程；索萨利托航线已写进数据，下一步再开船。
- 叮当车统一叫法、远离街区时暂停街区小动物（省三角形）已完成；Higgsfield 本部分没花分。

### What was built (files, API for other lanes)

Commits on `opus-bay`: `a0ad530` P1, `582573a` F13, `ee5b38a` 叮当车 glossary (first run, before the cut-off), `15da86f` F7, `17ef41a` F8, and the report commit (the turntable spinner wiring below).

| file | what |
|---|---|
| `audio/{audio,engine,logic,ambience,slices}.ts` (P1, `a0ad530`) | The AudioContext opens suspended in the first idle slice at load; noise / impulse buffers, periodic waves, the rig and the shore field are built in ≤ 4 ms slices (idle callbacks, else one slice after a frame); the first gesture only resumes + plays the iOS unlock sample. iOS `interrupted` handling kept. |
| `world/life.ts` (F13, `582573a`) | City mode: the district's ambient life pauses while `cityStreamer().heroFar`; ferry 0 and the Alcatraz beam keep running. |
| `game/transit.ts`, `data/transit.ts` (`ee5b38a`) | 叮当车 / 叮当车司机 in everything the player reads (`glossName`, labels, dialogue). |
| `data/fline.ts` (new, pure) | `buildFLine(fLineJson, DISTRICT.streetcar)` → `FLine`: the centre line C (J2 = Market & Noe → the hero's Pier 39 end), the in-slab route at the foot of Market (up Market's east side, a left curve and a right U-turn onto the hero track just east of the Ferry Building stop: the OSM way via Steuart / Don Chee turns corners the 8.4 u car cannot, and the district's lot 5 and plaza trees stand there), block bounds (passing places at 14 Market stations ≥ 22 u apart), the cars' closed cycle (leg 1 toward Castro, leg 2 the Noe / 17th / Castro balloon loop, leg 3 toward Pier 39, leg 4 the district's Pier 39 turnaround) with lane offsets (±1.4 double track = the district's tracks A / B, ±1.1 at passing places, 0 on the single track), speed limits (curvature over a car length, 11 u/s hero, 14 u/s Market), 20 stations / 39 stops. Helpers `cyclePoint`, `legAt`, `sAtU`, `uAtS`, `centreAt`, `laneOffset`, `filletPath`, `FL` constants, `FLINE_V1`. |
| `world/flineSystem.ts` (new, pure) | `StreetcarSystem`: 4 cars forward round the cycle; one car per single-track block, the far passing place's side taken with the block (deadlock-free); dwell stops (hero stops, every third Market station, termini 9 s) and request stops; honours `platformStop('streetcar')` (hop-off brake); rider protocol (`request/board/cancel/rideStatus/riderCarOf/eta`, `legsFor(from, to)` picks the shorter way round); unseen bring-in dispatch; bogie poses with pitch; `seedFrom(poses)` (takes over where the district cars are); `violations()` for tests. 0.043 ms a step (node, 4 cars). |
| `world/flineLayer.ts` (new, lazy chunk) | 4 TOY_INST cars (2 liveries × near + far LOD, the trolley pole baked in), platform `'streetcar'` + `runtime.streetcar` mirror (the rider's car, else the nearest), bells near the player (`streetcar-bell`) and the rider's `transit` events (kind `'streetcar'`); `flineRailTracks(line)` for the rails. |
| `world/streetcar.ts` | `carGeometry(livery, pole?)` / `carFarGeometry(livery)` exported; city mode hands the cars, platform and mirror to the layer once it runs (the hero loop only finishes a ride that started on it); `new Streetcars()` in district mode unchanged. |
| `world/rails.ts` | `RailLayer(data, extra: RailTrack[])`: F-line tracks (2 u steps on straights, a paved bed across the hero plaza, 0.085 u lift on city streets so the sidings sit on the city's asphalt). |
| `data/ferry.ts` (new, pure; re-exported by `data/transit.ts`) | `FERRY` constants, `FERRY_ROUTES` (terminals: quay + berth; loop waypoints; `running`), `buildFerryLine(def)` (closed Catmull-Rom, curve limits, slow ahead within 22 u of a berth), `ferryPoint`, `ferryTerminal(id)`, `GATE_E_HEADING`. Routes: `ferry` Ferry Building ⇄ Pier 41 (running), `ferry-sausalito` (data, `running: false`). |
| `world/ferry.ts` (new) | `FerrySystem` (pure: 9 u/s, dwell 14 s / 4 s when a rider waits at the other end, rider protocol, eased heading, roll 0.02 sin 0.9t, bob) and `FerryLayer` (platform `'ferry'` = the open sun deck, `FERRY_PLATFORM`; horn + foghorn on departure near the player; kind `'ferry'` events). |
| `world/life.ts` | `ferryGeometry(stripe, openDeck)`: city-mode ferry 0 has an open sun deck (planks, railings, two outward benches, wheelhouse / funnel / mast forward); lying at Gate E after the arrival it is handed to the ferry system (`pendingFerry().takeOver()`), then drawn from `activeFerrySystem().cars[0].pose`. C2's P2 request: white instance colours on the gliding pelicans, `TOY_INST_TINT` for the dogs and K-Dock floats. |
| `world/transitLayer.ts` | hosts the F-line layer and the ferry layer; calls D2's `setTurntableSpinner(true)` (Powell & Market's static disc top gives way to F's spinning disc). |
| `data/transit.ts` | `flineJson()`; registries `activeStreetcarSystem / setActiveStreetcarSystem`, `activeFerrySystem / setActiveFerrySystem`, `pendingFerry / setPendingFerry`; `LineRideSystem` interface and `rideSystemFor(line)` ('streetcar' → F-line, 'ferry' → ferry, else cable cars). |
| `game/ride.ts` | `beginLineRide(line, from, to, dir, epoch, kind = 'cable-car')` and the line ride step through `rideSystemFor`; `rideMinOdometer(r)` (cable car / ferry 150 u, city F-line 60 u: its hero stops are closer). |
| `game/transit.ts` | City F-line: hero stops and Market stations board it (`boardFLine`: the motorman offers both termini + the nearest highlights with ride times; `rideFLine`, `flineStation`, `flineRideSeconds`); ferry: `boardFerry` (deckhand), `rideFerry` (spot `'deck'`), `ferryRideSeconds`; interactables for Market stations, the Castro terminal and both ferry terminals; labels (tram / ship icon); counted rides → goals `streetcar` / `ferry`, `rideLog` keys `streetcar` / `ferry`; off a boat only onto a quay. DEV `__opusBay.transit.{fline, boardF, rideF, ferry, boardFerry, rideFerry}`. |
| tests | `tests/opus-bay-sf-fline.test.ts` (7: line, stations / passing places, the splice sweep against district lots / trees / palms, 20 min of 4 cars with no head-on and nobody stuck, dispatch, rails, ride Ferry → Castro + the hop-off brake), `tests/opus-bay-sf-ferry.test.ts` (4: route table, 3 u water clearance against the district grid + the published city, the boat, ride Gate E → Pier 41 + the deck). |

### Evidence

- Checks at the F8 push: `tsc` 0, `eslint` 0, **572 / 572** opus-bay tests (hero regression and contracts green). Two wall-clock asserts of other lanes (`sf-citymap` "draw … fast", `sf-nav` "window build") failed once each under the six-lane load and pass on re-run.
- **P1** (perf helpers, Ferry gate, 1440×900 RTX, city golden, head with F7): 1× idle 60.1 fps, **1× first walk 60.1 fps, p99 17.0 ms, 0 frames > 50 ms, 0 > 100 ms** (was 2 × > 100 ms before P1). 82 calls / 255k tris / 39 programs. The 4× rows of that run (4–6 fps) are machine load (76 node / chrome processes at the time), not comparable: re-measure on a quiet machine (the lead's verify). CPU profile of the first key press: in `a0ad530` (audio self time 8.8 ms over the first 3 s of walking).
- **F7 in the browser** (1440×900): `rideF('ferry', 'f-17th-castro')` from the Ferry Building stop: the car stopped for the rider after ~4 s, HUD "F-line · to 17th & Castro", arrived at the Castro terminal ≈ 130 s later with the station prompt "Ride the F-line · 17th & Castro"; a car rounding the U-turn at the foot of Market with its pole up to the wire; 4 cars, 0 console errors. Node: Ferry → Castro < 200 s and within 45 s of `flineRideSeconds`; 20 simulated minutes, ≥ 2.4 laps each, no head-on, longest stand < 40 s.
- **F8 in the browser** (golden): the ferry handed over at Gate E, boarded on the sun deck, past Pier 39's sea lions, docked alongside Pier 41 ≈ 75 s later ("Arrived: Pier 41", G2's "We've docked!" line), `rideLog` `{ ferry: 1 }`, 92 calls / 337k tris / 40 programs at Pier 41. Phone 390×844 dpr 3 at `quality=mid`: the motorman's dialogue (6 destinations + Not now, two columns) and the ferry banner ("Ferry · to Pier 41", Hop off / Skip to stop) fit without overlap (`phone-ferry-banner-fline-choices.jpg`: the QA script left the dialogue open over a ferry ride, which is why both show).
- Powell & Market with D2's spinner flag: F's disc (planks, rails, pivot, two pushers) sits in the landmark's steel ring, not buried.
- Key shots in `docs/opus-bay/qa/w3/F/`: `fline-foot-of-market-uturn.jpg`, `fline-aboard-ferry-building.jpg`, `fline-riding-market-st.jpg`, `fline-castro-terminal.jpg`, `ferry-sun-deck-gate-e.jpg`, `ferry-passing-pier39-sea-lions.jpg`, `ferry-docked-pier41.jpg`, `turntable-powell-market-spinner.jpg`, `phone-ferry-banner-fline-choices.jpg`. Scratch: `C:/Users/willy/opus-qa/w3/f/`.
- Budget: the F-line adds ≤ 4 calls + 2 shadow calls (near car ≈ 2.2k triangles, far 84), its rails go into F's existing rail mesh (5.6k triangles within 150 u at the Ferry gate); the ferry is life's existing mesh (no new call). New materials: none (TOY_INST, already warmed by `f-cable-cars`); programs unchanged in the runs above.

### Decisions

- **Market St is single track with passing places** (the city draws one F-line track pair there and the street is 4.4–5.6 u wide against a 2.1 u car). Cars step 1.1 u to their own side at a station; one car per block between passing places; the far side is taken with the block, which keeps the line free of deadlocks.
- **The foot of Market is re-routed**, not the published Steuart / Don Chee way: every corner there is too tight for the car. The chosen line clears lot 5 and the plaza trees' main canopy by a few centimetres (the sweep test); it joins the hero track 8 u east of the Ferry Building stop so the stop keeps serving both directions.
- **One closed cycle** (like the district's loop): cars always run forward; a ride goes the shorter way round. The Castro terminal is on the balloon loop (Market → Noe → 17th → Castro → Market); the loop's exit waits 8 u before J2.
- **City ride rule for the F-line: ≥ 60 u** stop-to-stop (the hero stops are ~100 u apart; 150 u would not count a Ferry → Green ride, which the district always counted). Cable cars and the ferry keep 150 u.
- **Ferry = one closed loop too** (no reversing): out of Gate E the way the district's harbour loop leaves it, in again the way it arrives; alongside Pier 41's east face bow out, so it leaves forward.
- **The arrival ferry is the rideable ferry**: its city-mode model has the open sun deck from the start, so nothing swaps at the handover.

### Known gaps

- The foot-of-Market curves and the Castro hairpin are tight for the 8.4 u car (it visibly pivots there); the fit to lot 5 / the trees is centimetres.
- At passing places F's siding rails sit beside the city's centre rails (three rails there).
- Waiting for the F-line: an unseen car is brought in when possible; with the stop's street in view the wait can reach ~30 s. The ferry is a single boat: up to ~2 min if it has just left (its dwell is cut to 4 s when you wait at the other end).
- Hopping off the ferry mid-Bay: F sends you to the next quay, but E2's alight places the rider at its exit slot afterwards (request below).
- Sausalito is data only; its loop has not been checked against C2's Marin board (the test covers the SF side of the running route).
- The E-prompt glyph for F-line stations is G1's (request below).
- Not re-measured at 4× on a quiet machine.

### Not done

- Part b (per the brief): F10 city audio (cable hum, positional bells, ferry engine, the city shore field), F11 crowd (register with `registerObstacleSource`), F12 toy traffic.

### Requests

| to | file | change |
|---|---|---|
| E2 | `actors/moveSystem.ts` | Ferry (platform `kind === 'ferry'`): refuse a hop-off (Space / B / 提前下车) while the boat is under way (`rideSystemFor('ferry').rideStatus().station === null`), with a hint ("等船靠岸 / Wait until we dock"); when docked, keep F's quay teleport (`hopOffRide` moves the player to the terminal's quay) instead of writing `p.x/p.z = o.slot` over it (or pick the slot on the quay side). |
| G1 | `ui/icons.tsx` (`InteractIcon`) | `source: 'transit'` interactables whose `refId` is an F-line station (`flineStation(refId)` in `game/transit.ts`, ids `f-…`) show the tram glyph; ferry terminals (`ferryTerminal(refId)`, `ferry-building`, `pier-41`) the ship glyph. |
| G1 | `ui/CityMap.tsx` / `cityMapDraw.ts` | (optional) draw the city F-line (`activeStreetcarSystem()?.line`: `cxyz` centre line + `stations`) and the running ferry route (`FERRY_ROUTES` → `buildFerryLine`) with their stations. |
| G2 | `game/content.ts` hooks | (optional) `streetcarBoard` (city F-line boarding), `ferryBoard`, `ferryOff`; F falls back to inline lines. |

Relayed messages during part a: none.

## Part b

### 给主人的摘要

- 城市里有人了：身边 90 u 内最多 64 个小人走在人行道上（靠右走、在路口过马路、在联合广场等景点驻足看风景），车或叮当车开过来会跳一下躲开；走得快的会从旁边超过走得慢的。
- 城市里有车了：220 u 内最多 24 辆圆圆的玩具小汽车靠右行驶，排队保持 4 u 车距，路口一次只进一辆，会等行人、等你、等叮当车和 F 线电车；夜里车灯会亮。叮当车那几条街和 Market 街不走汽车（Market 街现实里也禁车）。
- 城市声音：跟着你移动的全城海岸声场、Ocean Beach 的大浪、公园里的鸟叫（夜里是蟋蟀）、Mission 街头的吉他弹唱、叮当车轨道下缆绳的嗡嗡声、渡轮的汽笛和发动机、从金门大桥方向传来的雾笛；别的车的铃声从它所在的方向传来。
- 全部检查通过（668/668），街区模式不变；Higgsfield 本部分 0 分（音效全是合成的，要不要换成生成音效等你试听后决定）。

### What was built (files, API for other lanes)

Commits on `opus-bay`: `7ee36f1` F11 / F12, `78b21ed` F10, `5d470d3` F10 (city audio in its own chunk), `79ccd27` F11 polish, the rounded toy sedan + the ferry engine only aboard, sightseers on D2's plaza spots, and the report commit (hashes after the last rebase: `git log origin/opus-bay --grep '^F1[0-2]\|^F-report'`).

| file | what |
|---|---|
| `world/sf/streetNet.ts` (new, pure) | `StreetNet(ix, probe)`: the walking graph's directed edges measured from the ground (`edge(e)`: kerb half widths per side from the terrain's road → pavement boundary, `road`, `raised` decks, `box` = a sliver inside a junction box), cached per chunk epoch; `setback(node, dx, dz)` = the widest *crossing* street at a junction (a crosswalk node or a path joining mid-block does not cut the sidewalk). **Hooks for other lanes**: `registerRoadVehicles(fn)` / `collectRoadVehicles(out)` (`RoadVehicle {x, z, heading, v, halfL, halfW, kind, line}`: F's transit layer registers the cable cars and F-line cars, the traffic its cars, city life the player's bike / car), `registerTransitStreet(xyz, stride?)` / `onTransitStreet(x, z, dx, dz)` (streets a transit line runs along: no toy traffic there), `predictApproach`, `centreLineDistance`, `lifeRng`. |
| `world/sf/crowd.ts` (new) | `CrowdSim` (pure given a probe) + `CrowdLayer`. 64 walkers (44 mid, 24 low) within 90 u; sidewalks past the kerb, keep right (street side one way, house side the other), the first free offset when a sidewalk is blocked, else cross over or turn round; at a corner the next way is chosen (straight on likelier, a long crossing less likely) and crossed along clear ground only; sightseers stand at plazas / landmarks (`placesNear`: plaza 16 u, landmark 10, attraction 7, viewpoint / museum 6, historic 5) and on lane D2's landmark plaza spots (`landmarkPlazaSpots()`, D2-09: one to a spot, facing the landmark); a body's length behind a slower walker, or pass in the other lane; step round the player / BAYBAY; **hop aside** when a vehicle's centre line is predicted within 1.2 u (wide ones: half width + 0.55) and closing (the toy traffic only at the last moment: it brakes by itself); `onRoad` while actually on the roadway (the traffic waits); spawns biased near the player (fill: half within ~30 u; recycled ≥ 14 u out of view, ≥ 58 u in view, fading in), an unseen walker beyond 60 u brought back nearer every half second, refill after a focus jump (fast travel); 55 % at night. Near figure = the promenade walker (324 tris) for the ≤ 18 closest within 24 u, far figure 92 tris (legs still swing). `obstacles()` = 'crowd' discs r 0.28. |
| `world/sf/traffic.ts` (new) | `TrafficSim` + `TrafficLayer`. 24 cars (16 / 8) within 220 u on street edges with ≥ 0.9 u of roadway each side (not raised, not hero, not a transit street), right-hand lane at `clamp(curbR / 2, 0.62, 1.6)`, 5–9 u/s, ≤ 3.4 u/s through a turn, **4 u queue gap** (anything in the corridor within 14 u), stop 1.3 u short of people on the roadway, the player, transit and buses; a junction box (OSM's cluster of junction nodes) takes one car at a time, and a car waits at its stop line for a walker in the box, a transit vehicle in it or due within 2 s, or no room on its exit lane; quadratic curves through turns, U-turn at dead ends; recycled when stuck 14 s out of view (40 s in view), beyond 220 u, or when its ground drops; an unseen car beyond 130 u brought nearer once a second; 70 % at night. The car: a rounded toy sedan (soft body and cabin, glass band, lamps that glow at night via aInfo style 7), 288 tris with shadow within 55 u, 48-tri far car, TOY_INST_TINT with pastel instance paints. `obstacles()` = two 'traffic' discs r 0.6; `passes` for pass-by sounds. |
| `world/sf/cityLife.ts` (new) | `CityLife`, made by the transit layer (lazy chunk) once `walkGraph()` is in: the probe (`cityProbe`: surfaceAt / canStand / heightAt / cityChunkEpoch), the view cone, who to avoid / stop for; registers both obstacle sources (E2's consumer: walker soft obstacles; `giveWay` 'crowd' → "whoa", 'traffic' → soft bump) and the road vehicles; hidden and reset in fast travel, refilled at the landing; the crowd hidden while gliding high; quality counts; the hop-aside event (`emitAt`, within 22 u, ≤ 1 per 5 s; kind 'bus' with line 'traffic' / 'player' for road vehicles); the city sound hooks. DEV `window.__opusCityLife.stats()` / `.life`. |
| `audio/cityHooks.ts` (new) | `emitAt(event, x, z)` + `soundAt` (a located event without changing the frozen contract), `cityHooks {crowd, cars, passes}`, `pushPass`, `clearCityHooks`. |
| `audio/city.ts` (new; its own chunk, loaded on the first city tick) | `CityShore` (the windowed shore field from core/terrain `isLand`, idle slices, rebuilt after 96 u) and `CityLayers`: Pacific surf seaward of the Golden Gate line (`gateSide` / `pacific`), park birds / crickets, cable hum + sheave clacks, the ferry's engine (aboard once the boat carries you, or within 60 u, panned), the Mission buskers, the crowd level. `GOLDEN_GATE`. |
| `audio/street.ts` (new) | `StreetMusic`, `BUSKER_SPOTS` (Valencia & 24th, Clarion Alley, Dolores Park, 24th & York). |
| `audio/logic.ts` | `buildShoreField({bounds, cell, isLand})` / `shoreGridJob` (enclosed water = land), `CITY_SHORE`, `shoreWindow`, `shoreRebuildDue`, the shared chamfer (district path unchanged), `transitSound` for `horn` / ferry, `hop-aside`, `turned`; `parkShare`, `pacificSide`, `cableHumLevel`, `buskerLevel`, `distToFlatPolyline`. |
| `audio/sfx.ts` | `gripClank`, `turntableCreak`, `turntableRumble`, `ferryHorn`, `hopSqueak`, `birdCall`, `cricket`, `surfCrash`; `cableBell` / `streetcarBell` take a pan (defaults = the old sounds). |
| `audio/ambience.ts`, `audio/audio.ts` | city layers + city shore (no district shore job in city mode), crowd murmur from the walkers, pass-bys from the toy cars, the city hum thickened by traffic, the foghorn from the Golden Gate; transit sounds panned from `soundAt`; `__opusAudio.stats().city`. |
| `world/transitLayer.ts`, `world/flineLayer.ts`, `world/ferry.ts`, `game/transit.ts` | hosts city life, registers road vehicles / transit streets; other cable cars' bells and grip, other F-line cars' bells and the ferry's horn are located (`emitAt`); the ferry sounds its own horn (no extra foghorn). |
| `world/streetcar.ts`, `world/life.ts` | warm-ups `f-crowd` (the crowd's own people-material instance, instanced + instanceColor) and `f-traffic` (TOY_INST_TINT instanced + instanceColor, casting); `personGeometry` and `crowdPeopleMaterial()` exported. |
| `audio/README.md` | the city section. |
| tests | `tests/opus-bay-sf-life.test.ts` (+6 on the published city at Union Square: crowd invariants, sightseers on the Dragon Gate's plaza spots, the hop and the passing car, traffic invariants, give-way to a cable car in a box, registry / budgets), `tests/opus-bay-audio.test.ts` (+5: grid field incl. lake / island / slice units, the window policy, the published city's shore and the Pacific side, transit sounds + emitAt, the city layers on a fake context and nothing in the district). |

### Evidence

- Checks on the final head (rebased on `63b8407`): `tsc` 0, `eslint` 0, **668 / 668** opus-bay tests (hero regression and contracts green).
- Node (published city, Union Square, 60–120 s at 30 Hz): 64 walkers out, > 93 % of samples on standable ground, ≈ 23 % on the roadway (crossing; walking along the roadway < 6 %), > 30 % within 30 u of the player; 24 cars, > 95 % of samples on the roadway, > 60 % moving, top speed ≤ 9, never two cars in one junction box, stopped queues ≥ 3.4 u apart, never along a registered transit street, a car stops ≥ 0.6 u short of a person in its lane, no car enters a box a cable car stands in. Step cost: crowd ≈ 0.12–0.18 ms, traffic ≈ 0.09–0.14 ms average (the refill is spread over frames, ≤ 10 walkers / 8 cars a frame; max step 2–4 ms).
- Browser (1440 × 900, RTX, `quality=high`, day, Union Square): the crowd and the traffic add **5 calls and ≈ 15k triangles** (whole view 107 calls / 416k with them, 102 / 401k without: the city's own view is already at the 400k line, C2 / D2's budget work); **programs 41 with and without** (the warm-ups hold, no new program). Phone 390 × 844 dpr 3 (`mid`): 81 calls / 338k, 44 walkers, 16 cars. Transit + vehicles (F14): the traffic is ≤ 2 calls + 1 shadow, ≈ 5.4k triangles with 8 near cars, shadows included.
- City audio in the browser (`__opusAudio.stats().city`): Ferry gate `engine 0.37` (the ferry alongside); Ocean Beach `ocean 1` + surf crashes + the morning foghorn; Golden Gate Park `park 0.75` + chirps / warbles / coos; Powell St `cable 1` + sheave clacks; Valencia & 24th `busk 1` (41 busker notes in 8 s, the score ducked); aboard the ferry `engine 1` + its horn at departure; the shore window re-centred at every stop (128 × 128 cells). Located bells / horn / hop-aside panned from where they happened.
- Bundle: GameRoot 309.9 KB gzip, unchanged by part b; the transit-layer chunk (crowd, traffic, street net, city life) 34.5 KB; city audio 3.6 KB beside the 73 KB audio chunk; the district fetches neither.
- Shots in `docs/opus-bay/qa/w3/F/`: `crowd-union-square.jpg` (the follow camera on the plaza: walkers, sightseers, a toy car), `crowd-city-hall-plaza.jpg` (sightseers on D2's City Hall plaza spots facing the dome, walkers on the sidewalks), `crowd-market-st.jpg` (Market St toward the Ferry Building, both sidewalks), `traffic-queue-junction.jpg` (a car queued at a junction while a walker crosses), `traffic-car-geary.jpg`, `traffic-night-headlights.jpg`, `night-union-square.jpg`, `fline-castro-night.jpg` (the Castro terminal prompt at night), `ferry-deck-under-way.jpg` (golden hour, engine on), `phone-crowd-union-square.jpg`, `phone-night-union-square.jpg`. Scratch (all runs): `C:/Users/willy/opus-qa/w3/f/`.

### Decisions

- **No toy traffic along Market St or the cable-car streets**: the F-line and the cable cars run at the centre of streets too narrow for a lane beside them (and lower Market is car-free in real life). Cars cross them at junctions and wait for transit in the box. The brief's "Market St traffic" shot is therefore Market's crowd and the F-line, with traffic on the cross streets.
- **Hop rule**: "within 1.2 u" is measured to the vehicle's centre line (half width + 0.55 for cable cars and buses) and only for a closing approach, so a car passing along the kerb never makes sidewalk walkers jump; the toy traffic brakes for people itself, the hop is mainly for the player's car / bike and for transit (which do not yield).
- **One car per junction box**, the box being OSM's cluster of junction nodes (≤ 6 u apart), plus room on the exit lane: no gridlock, some waiting at busy corners.
- **Density follows the player**: spawns are biased near, far unseen walkers / cars are brought back nearer; in-view spawns only far away or fading in.
- **Crowd without shadows** (like the promenade's) and at most 18 near figures: a packed plaza stays ≈ 10k triangles.
- **Audio**: the city shore field ignores enclosed water (no waves at Stow Lake); the surf is the Pacific side of the Golden Gate Bridge line; synthesis only, 0 Higgsfield credits: the owner's listening pass decides whether the ferry horn or the surf deserve generated SFX (the lane's 25-credit cap is untouched).
- **hop-aside's kind**: road vehicles that are not transit report `kind: 'bus'` (the union's only rubber-tyred kind) with `line: 'traffic'` / `'player'`; audio keys on the line.

### Known gaps

- Walkers can brush through a lamp post or a tree (the sidewalk check samples every 0.4 u); ≈ 5 % of walker samples sit within 0.2 u of a wall; walkers going opposite ways on a narrow sidewalk pass within ≈ 0.5 u.
- A fifth to a quarter of the downtown crowd is crossing a street at any moment (many junctions; crossings are short, ≈ 4 u).
- Toy cars on two streets forking at a shallow angle can brush for a few frames (< 20 car-frames in 64,800 in the test).
- No traffic lights; busy corners queue (a car stuck 40 s in view is recycled).
- The crowd and the traffic stay off the hero slab (the district's promenade walkers are there); walkers are dark silhouettes at night (the people material has no night glow); Karl's fog patch is not on the people material (plain scene fog).
- Wave 4's buses / light rail are not yet registered as road vehicles or transit streets (hooks ready, request below); lane T's `audio/lines.ts` is not wired into `audio.ts` (lane T's plan).
- No human listening pass: levels were set by reasoning and offline checks.
- The 4× CPU re-measure is still the lead's (the machine was loaded by parallel lanes all day).

### Not done

- Sausalito ferry run (data only since part a; not checked against C2's Marin board, no second boat).
- The 4× CPU perf row for the crowd + traffic on a quiet machine (the lead's verify: `scripts/opus-sf/qa/perf/`).
- Generated SFX (only if the owner finds a synthesized sound cheap after listening; cap 25 credits, nothing spent).

### Requests

| to | file | change |
|---|---|---|
| wave 4 lane T | `world/sf/lineFleet.ts` (theirs) | Register the buses and LRVs: `registerRoadVehicles(out => …)` with `{x, z, heading, v, halfL, halfW, kind: 'bus' / 'light-rail', line}` (walkers hop aside, the toy traffic waits for them), and `registerTransitStreet(xyz)` for surface light-rail tracks (no toy traffic along them). Both in `world/sf/streetNet.ts`. |
| wave 4 lane T | `audio/audio.ts` | Wire `audio/lines.ts` as planned; a stop / horn of a vehicle away from the rider can be emitted with `emitAt` (audio/cityHooks.ts) and panned with `located()` in the `transit` case. |
| wave 4 lane G (E2's files) | `actors/moveSystem.ts` | Still open from part a: refuse a hop-off from the ferry while under way (`rideSystemFor('ferry').rideStatus().station === null`, hint 等船靠岸 / Wait until we dock) and keep F's quay teleport when docked. |
| owner of `ui/transitGlyph.ts` (G1's; wave 4 lane G / P) | `transitGlyph` | F-line stations (`refId` starting `f-`, and the hero stops `ferry` / `green` / `bay` / `pier39` when the city F-line runs) answer `'streetcar'` (today they fall to the cable-car glyph: `transitStation` knows only cable-car stations); ferry terminals by `ferryTerminal(refId)` (`pier-41` has no "ferry" in its id). |
| C2 / lane V | (optional) Karl on non-TOY materials | If Karl looks wrong on walkers, publish the fog patch for plain MeshStandardMaterials; F would apply it in `crowdPeopleMaterial()` (its program is shared with the promenade walkers, so both change together). |

Relayed messages during part b: none.

## Review

### 给主人的摘要

- 我把 F 线电车、渡轮、城市里的人群和小汽车、城市声音都读了代码，并在浏览器里（电脑 1440×900 和手机 390×844）一个个试过，找到 9 个真问题，其中 8 个由我修好并推上去了：刚进城马上坐电车会被"换"到另一辆车上、城市里的渡轮偶尔要多等一整圈（约 95 秒）才能坐、在码头等船就听到船上的发动机、降低画质或天黑时人群不变少、高空滑翔时人群不隐藏、远处叮当车掉头的声音太响等。
- 第 9 个（渡轮开到海湾中间时跳船会被困在水面上）E2 的复查同时修好了（现在会提示"等船靠岸"），我确认过。
- 剩下几个小问题要别的线处理（渡轮开动时仍显示"下车"按钮、F 线车站的提示图标是叮当车的），写在下面的 Requests 里。全部检查通过。

### What I checked

- Every lane-F wave-3 commit (P1 `a0ad530`, F13 `582573a`, glossary `ee5b38a`, F7 `15da86f`, F8 `17ef41a`, `a9b87cb`, F11 / F12 `7ee36f1`, F10 `78b21ed` + `5d470d3`, `79ccd27`, `53211af`, `270f250`, `09eee9a`, `b87326e`) and the code around it: audio prep / activation, the F-line system and layer, the hero-loop handover in `world/streetcar.ts`, the ferry system / layer and its hand-over in `world/life.ts`, the ride flow in `game/transit.ts` / `game/ride.ts`, crowd, traffic, street net, city life, the city audio layers. Every file the lane touched is F's (no frozen file).
- Browser (own dev server 5204, RTX, desktop 1440×900 and phone 390×844 `--mobile --dpr 3`): ferry hand-over timing at load (1× and 4× CPU), ferry rides both ways with hop-off under way (near Gate E and on the open-water return leg) and "Skip to stop", a hero-streetcar ride started before the transit layer came in, F-line boarding dialogue / ride / HUD-tap hop-off on the phone, crowd + traffic at Union Square (budget with and without, quality high → low, night), fast travel Union Square → City Hall (hidden in flight, refilled at the landing), a glide off Twin Peaks, city audio at nine spots (Ocean Beach, the Bayview shore, Stow Lake, Golden Gate Park, Powell St, Valencia & 24th, the Ferry gate, Twin Peaks, Hunters Point), the district for regressions. Every screenshot read.

### Defects

| # | what (evidence) | status |
|---|---|---|
| 1 | **A hero streetcar ride begun before the lazy transit layer came in** (city mode, first ~15 s) was hijacked once the layer arrived: `FLineLayer.update` wrote the platform `'streetcar'` and `runtime.streetcar` after the hero loop every frame, so the rider rode whichever F-line car was nearest (it dwelt 7 s at Green St while the hero car drove on), and both the 2 hero cars and the 4 F-line cars were drawn on the hero track. Node repro: the rider's platform up to 104.8 u from any hero car. | fixed `08f6353`: `FLineLayer.setActive` (inactive = simulated, not drawn, publishes nothing); `Streetcars` keeps the F-line inactive until that ride ends and re-seeds it where the hero cars are then. Browser: platform = hero car 0 for the whole 41 s ride, F-line hidden; afterwards hero cars hidden, F-line cars at their spots. Test in sf-fline. |
| 2 | **The arrival ferry could miss its hand-over**: `life.ts` handed ferry 0 to the ride system only during its 22 s at Gate E; the transit layer arrives 12–25 s after load (lane F's own number), after which the boat left on the district's harbour loop, unrideable and with no terminal prompts, for the whole loop (node: 242 u away after 90 s). | fixed `073605b`: in city mode ferry 0 waits at Gate E until the ride system takes it. Test in sf-life (fails on the old code). |
| 3 | **Hopping off the ferry under way left the rider standing on the Bay, unable to move** (b87326e, Space at u ≈ 830 on the Pier 41 → Gate E leg: player at (−144.5, −87.6), `isWater`, W did nothing; `review-ferry-stranded-on-bay-before.jpg`). ~35 % of the loop is > 60 u from walkable ground, beyond the controller's unstick. | fixed by **E2's review** (`6bb6e16` + its transit-alight change, pushed while this review ran): refused under way ("等船靠岸"), F's quay kept when docked. My interim guard (`073605b`) was dropped again in `60b3a05`; the sf-ferry test pins F's side (leaving the ride out on the Bay puts the rider on solid ground on the next quay). Browser on the rebased head: Space under way refused, still riding; "Skip to stop" → Pier 41 quay (−238.2, 66.5). |
| 4 | A rider **still waiting** for the ferry and taken off by `hopOffRide` (a trip starting, QA) was teleported to the terminal the boat lay at (Pier 41 → the Gate E quay). | fixed `073605b` (only a rider aboard is moved). Test in sf-ferry (fails on the old code). |
| 5 | Since F10 a cable car that had turned played the turntable rumble at 0.6 and its bell at 0.9 anywhere within 90 u (never quieter), a stop bell 0.8 within 60 u; BAYBAY's "a bell close by" line (strength ≥ 0.4) fired for bells 60 u away. | fixed `88b8d9d`: strengths by distance, the rider's own car full. Test in sf-transit through the real `TransitLayer`. |
| 6 | **The ferry engine played at the aboard level while you waited on the quay** (Pier 41, boat 385 u away at Gate E: `__opusAudio.stats().city.engine` 1). `53211af`'s message says the engine plays "aboard only once the boat carries you", but that commit only touched `traffic.ts`. | fixed `58591f8`: aboard = ride phase `riding` / `arrived`. Test in audio. |
| 7 | **The crowd never hid while gliding high** (the report's claim): `cityLife` compared the camera with `runtime.player.y`, which rides the pelican, so the camera stayed 7 u "above the player" at 55 u over the streets. | fixed `14619f9`: height above the ground under the player, 10 u hysteresis (without it the crowd popped in and out at 54–56 u). Browser: hidden from 55 u, back below 45 u. |
| 8 | **A lower quality or the night did not thin a crowd in view**: extras went only where the view cone did not reach, so with the camera resting on Union Square the `low` crowd (24) stayed at 49 after 40 s (node, all in view: 62 after 60 s). | fixed `fd7e057`: while there are more walkers than wanted and all in view, one more than 16 u from the player fades out (shrinks) every ⅓ s; steady crowds never churn. Browser 64 → 37 (10 s) → 28 (40 s, the rest within 16 u); `review-crowd-low-quality-40s.jpg`. Test in sf-life. |
| 9 | Per-frame garbage: `traffic.ts` built `[0, 0.7, 1.4, 2]` and `[-1, 0, 1]` inside the per-car × per-vehicle loops (≈ 24 × 35 arrays a frame); `crowd.ts` `Array.from(dist).sort(...)` every crowded frame; both draws and `FLineLayer.update` built small arrays each frame. | fixed `cf98cf4`, `08f6353`. |

Open (not fixed here):

- Smaller per-frame objects remain: the road-vehicle registry pushes new objects (≈ 35 a frame: cable cars, F-line, traffic, the player's vehicle), `focus()`, the traffic's `people` entries, `span()` tuples, `life.ts` `ferryState`. Pooling needs the `registerRoadVehicles` shape to change, which wave 4 lane T is starting to use: left.
- The toy traffic thins only out of view (a quality step down reached 8 cars after ~40 s): acceptable, noted.
- Audio P1 under this machine's load: opening the AudioContext at load took 0.3–1.2 s (the one unsliceable task, as designed) and the sliced prep finished 10–19 s after load (idle callbacks are scarce while the city streams); a Start pressed before that is silent until the prep ends. The lead's quiet-machine perf run should look at the first-walk rows again.
- The lane's known gaps stand (walkers brush lamp posts, dark silhouettes at night, Sausalito data only, the 4× CPU row).
- The quality step down itself (C2's) re-links programs: 41 → 69–72 at Union Square; not F's materials (F's warm-ups hold: 51 with and without the crowd and traffic at day).

### Evidence

- Checks on the pushed head `60b3a05`: `tsc` 0, `eslint .` 0 errors (43 warnings, none in lane F files), **719 / 719** opus-bay tests in the run before the last rebase; on the rebased tree 720 tests, 719 pass and 1 failure, E2's wall-clock assert "a cached cell is cheap" (`opus-bay-sf-move2`) under load, 24 / 24 when that file is re-run. New tests: sf-fline (legacy hero ride), sf-ferry (waiting rider, leaving on the Bay), sf-life (ferry waits at Gate E; crowd thins in view), sf-transit (turned / bell by distance), audio (engine while waiting / aboard). Each fails on the code before its fix.
- Budget at Union Square (1440×900, high, day): with / without crowd + traffic 105 / 100 calls, 404.9k / 389.9k triangles, programs 51 / 51. Crowd 64 (near 18, far 46), traffic 24 (near 7), 0 overlaps. Night: 57 walkers, 19 cars.
- Ferry hand-over at load: layer in at 15.3 s (1×), 19.4 s (4× CPU phone), within the dock window on these runs; with the fix the window no longer matters.
- City audio: Ocean Beach `ocean 1` + surf crashes, Bayview shore `ocean 0` (the Pacific test holds on the Bay side), Golden Gate Park `park 0.81` + birds, Valencia & 24th `busk 1` (46 busker notes), Stow Lake no surf; the district builds no city layer and fetches none of the city chunks.
- Phone (390×844 dpr 3, mid): the motorman's dialogue (6 destinations + Not now) fits; the ride banner's "Hop off here" tapped on Market St → the car braked, the rider stood on Market St with the "ride to the next stop" hint (`review-phone-fline-hopoff-tap.jpg`).
- Fast travel Union Square → City Hall: crowd and traffic meshes hidden in flight, the city hooks cleared; 43 walkers within 40 u and 16 cars within 120 u 1.5 s after landing.
- Scratch (all runs and scripts): `C:/Users/willy/opus-qa/w3/f-review/`.

### Requests

| to | file | change |
|---|---|---|
| wave 4 lane G | `ui/Hud.tsx` RideBanner, `ui/MoveChip.tsx` | On the ferry under way (`rideSystemFor('ferry').rideStatus()?.station == null`) moveSystem refuses the hop-off (等船靠岸), yet the banner still offers 提前下车 / Hop off here and the chip "SPACE Hop off": grey them or say "at the next dock". On spot `'deck'` the chip reads "Walk the aisle": "Walk the deck" (走走甲板). |
| wave 4 lane T | `world/streetcar.ts`, `game/ride.ts` | §8.4 gives the hero F-line ride `line: 'streetcar'`. `Streetcars.update` tells a hero-loop ride from a city F-line ride by `r.line` (`city = fline && !(r && !r.line)`, plus the review's `legacyRide` / `fline.setActive`), and `rideSystemFor('streetcar')` answers the city F-line: keep a separate marker for a ride that runs on the hero loop (e.g. `kind` / a flag), or a hero ride begun before the layer came in is handed to the F-line system mid-ride again. |
| (already routed by the lead, §8.4) | `ui/transitGlyph.ts` (G), `game/transit.ts` `?? quay` (T) | unchanged; confirmed still open in the code (F-line stations and `pier-41` show the cable-car glyph). |

Relayed messages during the review: none.
