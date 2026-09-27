# Wave 2 · lane F (transit, life, audio)

## Part a-cablecars

The previous agent of this part was stopped mid-way (wave 2 paused at 02:53 UTC). Its uncommitted work was inspected,
kept (it was sound: data, motion, model, turntables, rails, layer, rides, tests) and finished: two real bugs fixed
(below), dead code removed, the running-system registry moved out of the main bundle, a harder dispatch test added,
then QA shots in the city.

### What was built (files, API for other lanes)

| file | what |
|---|---|
| `data/transit.ts` (pure, no three) | `buildTransit(file)` → `TransitData { lines: CableLine[], stations, turntables }` from `public/opus-bay/sf/v1/transit.json`: arc-length tables (`xyz`, `cum`), turntable stubs added to the path (Powell & Market 2.7 u, Hyde & Beach 11.7 u, Taylor & Bay 5.6 u; arc 0 / the end sit on the disc centre), stops within 8 u merged into 56 stations with ids `[a-z0-9-]` ("powell-market", "hyde-beach", three-line "powell-california"), dwell at every second stop + termini + the crossing station, the shared Powell trunk (0–188.5 u, to Jackson & Mason), the Powell × California crossing (115.2 / 161.5 u). `CABLE` constants (cable 9 u/s, grip 3 u/s², brake 3 u/s², dwell 4 s, turn 9 s, body 5.6 × 2.0 × 2.6, hide beyond 300 u, dispatch 5 s), `RIDE_MIN_ODOMETER = 150`. `pointAt`, `nearestAt`, `stopPos`. Browser: `loadTransit()` (current.json → manifest → transit.json, cached), `transitData()`, `onTransitData(fn)`, `cableLine(id)`, `transitStation(id)`; the running system's registry `activeCableSystem()` / `setActiveCableSystem()`. |
| `world/transitLine.ts` (pure) | `CableSystem`: constant cable with grip / brake, dwell, request stops, block signalling on single track (cars pass only at stations, ±1.05 u each to its right), the crossing interlock, turntable turns (≈ 9 s, `push(id)` +14°/s a press, decaying), double-ended reversal (California), the waiting-rider dispatch (`request`, `board`, `cancel`, `rideStatus`), the hop-off brake (`platformStop(line)` → one constant deceleration, 0 within `within` s, hold until released), poses (bogies on the track, height from `groundY` where the terrain is exact, pitch = grade, heading along travel, passing offset), events (`arrive/depart/grip/bell/turn/turned/push/board`). |
| `world/cablecar.ts` | the toy cable car, one geometry (2,124 triangles): cream + maroon, gold trim, enclosed saloon with warm windows (aInfo style 7), open ends with outward benches back to back and brass poles, running boards at x ±1.22, the gripman baked at the front grip with lever and bell, head / tail / roof lamps (aInfo glow), blank destination boards (no lettering); `cableCarFarGeometry()` (156 triangles). `CABLE_PLATFORM` (floor 0.55, rail spots on both running boards, outward bench seats, `railMirror`, `hangLean` 12°, `kind: 'cable-car'`, the running boards as `decks`). `figure()` (crew). |
| `world/turntable.ts` | the spinning timber disc (812 triangles: planks, steel rim, rails, pivot, two pushing crew), the static apron F draws at Hyde & Beach and Taylor & Bay, the 36-segment progress ring (drawRange = turn progress). |
| `world/rails.ts` | rails + cable slot only where the city draws none (hero spans of California 0–71.8 u and the Taylor & Bay tail, the Hyde & Beach stub, the Powell/Jackson corner gap), per 64 u cell, built only where the terrain is exact (`residentGround`), ≤ 1 cell per frame, within 150 u (dropped beyond 190 u), one TOY mesh. |
| `world/transitLayer.ts` (lazy chunk) | hosted by `Streetcars` in city mode only: the `CableSystem` (installed as the active one), 6 cars as `TOY_INST` InstancedMeshes (full car ≤ 110 u from the camera with shadow, the far version beyond, none beyond 300 u; visible instances packed), the 3 discs (one InstancedMesh), the aprons, the progress ring (only while a car turns within 26 u of the player), the rails, the platforms `<lineId>` (the rider's car, else the line's car nearest the player, with pitch), the cars' events as `transit` game events near the player. `transitLayer()` for QA. |
| `world/streetcar.ts` | city mode only: registers the cable-car warm-up (`f-cable-cars`: instanced TOY_INST with shadows) and `import('./transitLayer')` lazily; district mode neither downloads nor compiles any of it (`new Streetcars()` unchanged). |
| `actors/platform.ts` | `toWorld` / `toLocal` with `pitch` (Euler(−pitch, heading, roll, 'YXZ'), exactly the car body; no pitch = the old flat maths), `RAIL_LEAN` (12°), `spotFor` with `railMirror` (the running board / outward bench on the camera's side, so the body never hides the rider: DR-5 car side). |
| `game/ride.ts` | `RideState` gains `line, kind, dir, epoch, counted, seenArrivals, boarded`; `beginLineRide(line, from, to, dir, epoch)`, `lineRideEta()`, `lineRideTurning()`; `stepRide(dt, travelEpochNow)` answers for city lines (mode `'wait'` until the car stands at the stop, then `'follow'`; `braking` / `turning` stages; `count` once per ride after a real stop-to-stop segment). District path unchanged. |
| `game/transit.ts` | `boardFrom` dispatches city stations (`source: 'transit'`, refId = station id) and the turntable push (`transit-push-<id>`); `boardCable(station)` (the gripman's dialogue: each line's terminus both ways with the ride time), `rideCable(line, from, to)`, `openRideNode('cc:<line>:<from>:<to>')`; `stepTransit` (H rings the bell aboard, E pushes a turning car while you wait, the HUD stage incl. `'braking'` while a hop-off stop is pending); `hopOffRide` / `finishRide` / `cancelRide` release any pending stop and step off beside the car on the rider's side; `rideLabel` for cable cars (icon `'cable-car'`, "turning… press E to help push"); `transitInteractables()` (56 stations + the push prompt at a turning turntable within 40 u, 12 u radius; city only); `rideLog()`; `initTransit()` (city: registers the source, loads transit.json, DEV `__opusBay.transit` = `{data, system, rideLog, board, ride, push, station, stopPos}`). A counted ride: `emit({type:'transit', what:'ride', real:true})`, `completeGoal('cable-car')`, G1's `noteRide(line)`. |
| `tests/opus-bay-sf-transit.test.ts` | 13 tests (below). |
| `audio/{logic,sfx,audio}.ts`, `tests/opus-bay-audio.test.ts` | `transitSound(what, kind, strength)`, `sfx.cableBell(e, gain, strikes)`, the `transit` case in the audio event switch; 1 test. |

Other lanes read: `data/transit.ts` (G1: map lines / station icons by `refId`, read-only), `platforms.get(move.line)`
with `pitch`, `kind`, `railLeft/railRight`, `railMirror`, `hangLean`, `decks` (E2), `rideLabel` (G1's HUD, already
wired: the banner shows the cable-car icon), `transit` events (G2, H2b, audio).

### Fixes made in this part

- **Hop-off brake measured wall time.** The car derived its deceleration from `platformStop().since` (performance.now),
  so in node (and at low fps) it braked too softly (2.17 s instead of ≤ 1.2 s). Now one constant rate is chosen when
  the request arrives (`brakeRate = max(3, v / (within − since))`); the test brakes in ≤ 1.25 s and holds.
- **A rider could be stranded for 2–3 minutes.** `eta()` handled only one turn-around (a car just past the stop, going
  the right way, needs two), the pickup car was never re-chosen, and the only bring-in spot (30 u upstream, clamped by
  dwell stops) was often in view or blocked. Now: `eta()` follows up to two turn-arounds; once a second while the rider
  waits, the pickup goes to the car that gets there clearly sooner, and if the wait is still > 20 s an unseen car is
  brought in at 30/22/15 u, else farther back (45/70/100 u, halfway between stops) or, near a line end, from beyond the
  stop heading out (it turns at the terminus and comes back), each only if it beats the current ETA. Worst case in the
  new test (the 40 u around the stop in view, 15 situations over 3 lines): 36 s, median 14 s (was up to 146 s).
- The cable-car system registry moved to `data/transit.ts`, so `game/ride.ts` / `game/transit.ts` (main bundle) no
  longer import `world/transitLine.ts`; it now ships only in the lazy transit-layer chunk (HC-1).
- **The push prompt lost to BAYBAY.** The brain scores `d / radius`, so at 5–6 u from the disc BAYBAY (≈ 1.5 u, +0.2)
  won the E prompt and the presses went to her menu. The push interactable now has a 12 u radius while a car turns;
  verified in the browser (focus `transit-push-powell-market`, 5 presses → +1.12 rad/s).
- **Budget:** a far cable car (156 triangles, no shadow) beyond 110 u, and visible instances packed so the draws cover
  only the cars and discs within 300 u.
- **Sounds:** `transit` events now play (audio is F's): the gripman's bell (`sfx.cableBell`, 880 Hz, 2–3 strikes,
  quieter far away, ≤ 1 per 1.5 s), the grip clank (metal bump) and the turntable creak on a push; pure mapping
  `transitSound()` in `audio/logic.ts`, tested.
- Dead code removed from `transitLayer.ts` (an unused turntable listener; the prompt is `pollTurntables`, 4 Hz);
  `transitLayer()` is cleared on dispose.

### Evidence

Tests (`npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-sf-transit.test.ts`, 13/13):
data (3 lines, published lengths ± 0.6, stubs 2.7 / 11.7 / 5.6 ± 0.1, termini on the discs, Powell & Market is the
landmark disc), stations (ids, shared Powell & Market, three-line Powell & California), motion (top speed 9 ± 0.01,
grip ≤ 3 u/s², Powell–Hyde 51 ± 5 s of motion), 10 simulated minutes with no block violation and every car making
≥ 25 stops, dwell ≥ 4 s, turntables (unpushed 9 ± 0.3 s; 3.5 pushes/s < 60 % of it), dispatch (≤ 5 s with nothing in
view; ≤ 40 s / median ≤ 20 s with the stop's surroundings in view), pose (pitch = grade over the bogie base on Mason's
steepest block, > 0.3; heading along travel; stands on the track), platform (pitched `toWorld` = the body matrix,
`toLocal` inverts it, the flat F-line maths unchanged, running boards ±1.25 ± 0.05, 12° lean, mirror to the camera
side), model (car ≤ 3k triangles, 5.6 × 2.6, lamps and warm windows present; the far car ≤ 300 with the same silhouette and lamps; disc < 1.5k), rails (F draws only hero
spans, non-landmark stubs, the corner gap), ride flow (hop off before a stop: nothing counts; a fast-travel epoch change:
never counts; the hop-off brake ≤ 1.2 s, HUD `'braking'`, hold, release on hop-off; a real segment ≥ 150 u counts once:
goal, `rideLog`, one `ride:real` event; arrival at Hyde & Beach ends the ride on foot; the HUD label), stations (none in
district mode; 56 in city mode; the gripman's choices).

Shots (960 × 600, `?quality=high`, SwiftShader; saved in `docs/opus-bay/qa/w2/F/`):

| file | what it shows |
|---|---|
| `cablecar-hyde-climb-bay.jpg` | a Powell–Hyde car climbing Hyde St toward Chestnut (pitch ≈ 0.34 rad = the track grade), rails and cable slot, the Bay and Alcatraz behind (QA camera on the street, golden hour) |
| `cablecar-rider-running-board.jpg` | riding down Hyde past Lombard: the newcomer on the running board on the camera's side, BAYBAY inside, the gripman at the grip; HUD "Powell–Hyde cable car · to Hyde & Beach", Hop off here / Skip to stop |
| `cablecar-turntable-push-powell-market.jpg` | a Powell–Mason car turning on the Powell & Market disc; the E prompt "Help push · Powell & Market turntable" (5 presses → boost 1.12 rad/s, 5 creaks in `__opusAudio` counts) |
| `cablecar-turntable-turning.jpg` | the same turn from Market St, the car at ≈ 60° on the disc |
| `cablecar-night-lamps-hyde.jpg` | night: head lamp with its halo, the roof lamps and the warm saloon windows of a car climbing Hyde St |
| `cablecar-waiting-closeup.jpg` | waiting at Hyde & Greenwich ("Waiting for the cable car… ~19s", Cancel) while the other car passes: maroon / cream body, gold trim, brass poles, outward benches, the gripman, running boards |
| `cablecar-station-prompt-hyde-chestnut.jpg` | on foot at Hyde & Chestnut: "E Ride the cable car · Hyde & Chestnut", the Bay and Alcatraz down the hill |
| `district-start-unchanged.jpg` | `?start=free` (district): the usual Ferry Building start; `__opusBay.transit` absent, the F-line streetcar state live in `runtime.streetcar` |

Also checked in the browser: dispatch with the player's own camera (HUD ETA counting down, then boarding: `currentRide().mode`
`'follow'`, `flow.ride.stage` `'riding'`), the `transit` → audio mapping (`cable-bell` counted after a turn), and the
near / far car split (Powell & Market: 2 near + 4 far; Hyde: 2 + 2).

`renderer.info` at 960 × 600, quality high (golden hour unless noted):

| view | calls | triangles | programs |
|---|---|---|---|
| Hyde St, QA camera on the street, car in view (with the far LOD) | 73 | 243,799 | 47 |
| Hyde & Chestnut, walking camera, car in view (before the far LOD) | 76 | 379,038 | 45 |
| riding down Hyde St, walking camera (before the far LOD) | 75 | 393,430 | 45 |
| Powell & Market, walking camera, car turning, push prompt (before → with the far LOD) | 100 → 108 | 420,334 → 405,277 | 47 |
| 70 u over Russian Hill, QA camera (with the far LOD; 1 near + 5 far cars) | 115 | 454,517 | 47 |
| Hyde St at night, QA camera | 65 | 245,299 | 47 |
| district `?start=free`, walking camera at the Ferry Building | 76 | 228,982 | 44 |

Everything F adds is instanced and packed (hidden cars and discs are not drawn at all): near cars 1 call + 1 shadow
(2,124 triangles each, again in the shadow pass), far cars beyond 110 u 1 call without shadow (156 each), discs 1 + 1
(812 each), aprons 1, rails 1, ring 1 while a car turns near the player: ≤ 8 calls; with 2 near + 4 far cars and 3
discs ≈ 14k triangles including shadows (budget for vehicles + transit: ≤ 8 calls / 20k). The far version took ≈ 10k
off the Powell & Market view. The totals above are the streamed city's (C2): the Powell & Market walking view (405k)
and the 70 u view over Russian Hill (455k) are over the 400k line with or without the cable cars; that is C2's budget
work (CS-3), not something F can close. The call counts vary by ±8 between runs with the streaming state. The 45 → 47
programs were not attributed (the cars, the far cars and the discs share the warmed TOY_INST program; the ring is
TOY_DYN, which the F-line already uses; D2's landmark site and night variants are the likelier sources).

Full suite: 255/255 (`opus-heavy`, after the last rebase), incl. `tests/opus-bay-hero-regression.test.ts` 11/11 and
the flow / world / actors / contracts / audio tests; tsc 0 errors, eslint clean on every touched file. District:
`Streetcars` does nothing new unless `worldMode === 'city'` (no warm-up, no chunk download, no `__opusBay.transit`).

### Decisions

- **Dwell rule.** "Dwell at every second block" = cars always stop at every second published stop, the termini and the
  crossing station; the others are request stops (a waiting rider, the rider's stop).
- **Single track with passing at stations.** The streets are 3.6 u and the car 2.0 u; cars going opposite ways step
  1.05 u to their right only near a shared station, so they never overlap. The block check keeps two cars off one
  block unless they meet at a station.
- **Dispatch never pops a car into view.** Placements are out of the camera's rough view cone, ≥ 22 u from the player,
  and the moved car itself must be out of view and ≥ 60 u away. The price is that a rider whose whole street is in
  view waits for a real car (≤ 36 s in the test).
- **The E key while waiting** pushes the car turning on the turntable (the "help push it round" moment from the stop);
  on foot at a turntable the push is an interactable (`transit-push-<id>`, 12 u radius, only while a car turns there).
- **Far LOD at 110 u.** Shadows beyond that are outside the shadow camera anyway; the far car keeps the silhouette,
  colours, lamps and warm windows, so night streets still show moving lights.
- **Rider spots:** `railMirror` puts the rider on the running board on the camera's side and seats them on the outward
  bench on that side facing out, so the body never hides them (DR-5, car side).
- **`move.mode = 'transit'` at the start of the wait**, like the F-line (`currentRide().mode === 'wait'` until the car
  is at the stop, per the contract). The chip text while waiting (DR-1) is E2's MoveChip, which should read
  `flow.ride.stage === 'waiting'`.

### Known gaps

- Rider body pitch / 12° hang lean, BAYBAY's cable-car seat (it still uses the F-line seat choice) and the ride camera
  on `platforms.get(move.line)` are E2's consumers (§6 F → E2). The rider's position already follows the pitched deck
  (`toWorld`).
- Cable-car audio is the bell, grip clank and push creak only; the cable hum under the street, a turntable rumble and
  positional panning for other cars' bells are F10 (next part).
- The station E prompt shows G1's tram glyph for `source: 'transit'` (request below).
- The gripman's lines, `hookText('cablecarOff')` and a city goal id for `cable-car` are G2's; F falls back to inline
  bilingual lines.
- At Powell & Market F's disc sits 0.005 u above D2's static disc (no flag yet, request below).
- The dispatch view test is the rough cone in `transitLayer.visibleFromCamera`, not a frustum; buildings are ignored.
- fps and phone checks wait for the owner's machine.

### Not done (for the next part)

- F7 F-line to the Castro, F8 ferry v1, F10 city audio (cable hum, panning, ferry horn and engine, the city shore
  field), F11 crowd, F12 toy traffic, F13 hero-life pause, the `sf-life` tests.
- `obstacle` sources for the cars in E2's `giveWay` (`registerObstacleSource`), so walkers step aside for a car.

### Requests

| to | file | change |
|---|---|---|
| E2 | `actors/moveSystem.ts` | Consume the cable-car platform fields: tilt the rider by `plat.pitch ?? 0` when standing / seated, lean out by `plat.hangLean` on a running board (`plat.railMirror`), keep a walking rider on `plat.decks` too (the running boards), place BAYBAY with `spotFor(plat, 'seat', −cameraSide)` when `plat.kind === 'cable-car'`; the ride camera looks up `platforms.get(move.line)`. |
| E2 | `ui/MoveChip.tsx` | DR-1: while `flow.ride?.stage === 'waiting'` show the waiting chip (Cancel), not "On board · Sit down · Walk the aisle". |
| G1 | `ui/icons.tsx` (`InteractIcon`) | For `source: 'transit'` interactables show the cable-car glyph (the HUD banner already uses `CableCar`); the station's lines are in `transitStation(refId).lines` (`data/transit.ts`). |
| G1 | `game/Systems.tsx` / save v2 | Read `transit.rideLog()` into save v2 `rides` (F already calls `noteRide(line)` per counted ride). |
| G2 | `game/content.ts`, `data/sf/*` | `hookText('cablecarOff')`, gripman lines for `flow.cablecar`, first-bell / turntable-push lines on `transit` events, a city `FREE_GOALS` entry for `cable-car` (`completeGoal('cable-car')` fires after a counted ride). |
| D2 | `world/sf/landmarks/cable-car-turntable.ts` | (optional) an export or flag to omit the static disc top when F's spinning disc is present; F draws 0.005 u above it with r + 0.02 until then. |
