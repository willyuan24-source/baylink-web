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
