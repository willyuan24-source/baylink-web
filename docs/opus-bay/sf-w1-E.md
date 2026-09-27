# SF wave 1 · Lane E — movement & action mechanics (report)

Worktree `C:/Users/willy/baylink-opus` (branch `opus-bay`, nothing committed). Plan: `sf-research-tech.md` §6.
Everything works in district mode today and only talks to the world through `core/terrain` (heightAt / surfaceAt /
blockersNear / canStand / nearestWalkable / pushOutOfBlockers / inWorld / MAX_GROUND_Y), so the streamed city gets it
for free once lane B extends those functions.

## Files

**New (lane E):**
- `src/opus-bay/actors/modes.ts` — pure MoveMode FSM + door slots (GTA_SZ city-walk.ts idea, credited).
- `src/opus-bay/actors/platform.ts` — moving platforms (registry, pose, toWorld/toLocal, deck clamp, DeckWalker, rider).
- `src/opus-bay/actors/glide.ts` — pure pelican flight model + landing resolver + terrain glide world.
- `src/opus-bay/actors/cameraModes.ts` — per-mode ride camera rigs.
- `src/opus-bay/actors/moveSystem.ts` — orchestrator: input → FSM → vehicles / glide / bench / streetcar platform → placements, runtime, store, events.
- `src/opus-bay/actors/vehicles/collide.ts` — shared vehicle dynamics (kinematic bicycle, slopes, hop/crest hop, sub-stepped hull collision that slides), `findFit` (R), `VehicleWorld`.
- `src/opus-bay/actors/vehicles/bike.ts`, `toyCar.ts` — specs + lean/pitch/roll helpers.
- `src/opus-bay/actors/vehicles/models.ts` — procedural skinned rigs: bike (basket, bell, pedals), toy car (BAYBAY up front), pelican wings; `PELICAN_RIDE` placement for the GLB.
- `src/opus-bay/actors/vehicles/fleet.ts` — parked/ridden vehicles, squash, call autopilot, R reset, bikes rolling home.
- `src/opus-bay/actors/vehicles/pelican.ts` — pelican.glb (tilted, ×3.4, lazy) + wings, fly-off.
- `src/opus-bay/data/vehicles.ts` — spots (bike per district rack + 3 kickstand bikes + the toy car at the Ferry plaza edge), `seatSpots()` (37 benches + a Filbert step).
- `src/opus-bay/audio/rides.ts` — bike bell, toy horn, seat pop, glide whoosh, pant, sit creak; `RideLoops` (glide wind, toy-car motor).
- `tests/opus-bay-sf-modes.test.ts` (10 tests), `tests/opus-bay-sf-vehicles.test.ts` (13 tests).

**Changed:**
- `core/store.ts` — `MoveMode`, `MoveSpot`, `MoveState`, `GameState.move`; `createStore(initial, normalize?)`; `syncMovePatch` keeps legacy `riding` ⇄ `move` consistent whichever one a writer sets (flow.ts still writes `riding`), photo-on-foot mirrors as move 'photo'.
- `core/runtime.ts` — `runtime.move {mode, phase, progress, spot}`, `runtime.vehicle {...}`, `runtime.glide {...}`, `MovePhase` type.
- `core/events.ts` — movement events (below).
- `core/input.ts` — F (tap; hold 0.6 s with nothing near = call), G, H, C; gamepad Y/LB/L3/D-pad-in-vehicle, analog RT/LT; `input.analogSteer`, `input.vehicleContext`. Never preventDefault.
- `actors/controller.ts` — grade model, steep (> 0.9, non-stairs) = wall, `GradeTracker` (crest pant), `inSlab → inWorld`.
- `actors/system.ts` — MoveSystem integration (carried placement, BAYBAY seats, parked vehicles are soft obstacles, pant/landing squash, QA log), ground picker uses `inWorld` + `MAX_GROUND_Y`, removed the side-step ride pin.
- `actors/camera.ts` — delegates to `RideCamera` while carried (blends 0.7 s), C presets, dynamic near plane, `inSlab → inWorld`, removed the old side-on streetcar code.
- `actors/anim.ts` — ride poses (bike with pedals + stand-pedal, car, glide), `pant` emote.
- `actors/TouchControls.tsx` — 下车 / 按铃·喇叭 / 起飞 / 降落 buttons (touch only, 52–64 px).
- `actors/CameraRig.tsx` — exposes `camera` on `__opusBay` (DEV QA).
- `actors/view.ts` — `rideables` (parked vehicles for the interactables).
- `ui/Hud.tsx` — `MoveChip` (mode + keys, clickable; glide button on foot once unlocked). Inline styles (I don't own the CSS).
- `game/ride.ts` — rider position = platform spot (`riderWorld()`), fallback unchanged (node tests).
- `world/streetcar.ts` — migrated to `move`; car body rebuilt with open windows (band from chest height), floor, benches, brass poles; publishes the `streetcar` platform for the tracked car.
- `game/interactables.ts` — `vehicle` / `seat` sources (action 'info' → `interact` event handled by actors), `syncMoving` gates offers by mode (nothing while riding; benches only when nearly stopped).
- `game/Systems.tsx` — vehicles excluded from the static click proxies.
- `audio/audio.ts` — event mappings + ride loops.

## How it works / API for other lanes

- **Store**: `game.get().move: { mode: 'foot'|'sit'|'bike'|'car'|'transit'|'glide'|'travel'|'photo'; line?; spot?: 'rail'|'seat'|'deck' }`, changes only on transitions. Flow owns starting/ending transit and travel (the store is the authority there); the movement system owns the rest. Read `move`, not `riding` (`riding` stays a mirror).
- **Runtime (per frame)**: `runtime.move`, `runtime.vehicle` (id, kind, occupied, x/y/z, heading, speed (signed), steer, pitch, roll, grade, airborne), `runtime.glide` (active, pose, speed, height above ground).
- **FSM** (`actors/modes.ts`): `new MoveMachine()`; `enter(kind, {slotDistance, playerSpeed, vehicleSpeed})`, `exit()`, `sit({grounded})`, `stand()`, `takeOff({unlocked, grounded})`, `land({spotFound, seconds})`, `beginTransit(line, spot?)`, `switchSpot()`, `walkDeck()`, `endTransit()`, `beginTravel()/endTravel()`, `toFoot()`, `tick(dt, {vehicleSpeed, findExitSlot}) → MoveOutcome[]`; `doorSlots`, `slotClear`, `pickExitSlot`, `nearestEnterSlot`; constants `TIMING`, `BRAKE_DECEL 24`, `ALIGHT_SPEED 1.2`, `ENTER_RADIUS 2.4`, `CALL_MIN_DIST 25`.
- **Platforms** (`actors/platform.ts`) — for cable cars / ferry (lane F): `definePlatform(id, {floor, deck, rail, seatLeft, seatRight, seatY})` once, `setPlatformPose(id, {x, y, z, heading, roll}, dt)` every frame; readers: `platforms`, `riderWorld()`, `toWorld`, `toLocal`, `clampToDeck`, `DeckWalker`. The movement system puts the rider in the frame; the streetcar is the first user.
- **Vehicles**: `VehicleSim(spec).step(dt, DriveInput, world?) → StepReport`; `BIKE_SPEC`, `CAR_SPEC`, `TERRAIN_WORLD`, `poseCheck`, `findFit`. Spots: `vehicleSpots()`, `seatSpots()`.
- **Glide**: `GlideSim` (`takeOff`, `beginLanding(world) → seconds | null`, `step(dt, GlideInput, world)`), `terrainGlideWorld(tall)`, `GLIDE`. `moveSystem.setTallStructures([{x, z, r, top}])` adds towers the pelican steers round (lane D: GGB towers, Sutro, Salesforce …).
- **Camera**: `RideCamera`, `rideCamInfo`; `camera.ts` exports `nearPlane(camY, groundY)` and `rideCamMode()`.
- **Movement API for flow**: `__opusBay.actors.move` (`toFoot()`, `glideUnlocked`, `recent` event log). Fast travel: set `store.move = {mode: 'travel'}` for the trip, back to `{mode: 'foot'}` after — vehicles park, glide ends.
- **Events** (payloads in `core/events.ts`): `vehicle:enter {vehicle, id, baybay: 'hop'|'pop'}`, `vehicle:exit`, `vehicle:blocked {reason}`, `vehicle:bump {strength 0..1, hard, kind}`, `vehicle:refuse {surface}`, `vehicle:hop {crest}`, `vehicle:land {impact}`, `vehicle:horn`, `vehicle:call`, `hill {grade, mode}` (first g > 0.4), `pant`, `sit {seat}`, `stand {seat}`, `glide:unlock`, `glide:start`, `glide:land {x, z}`, `glide:no-landing`, `transit:spot {line, spot}`. Model-edge hits still emit `bump` kind `slab-edge`.

Controls: F enter/exit (hold with nothing near = your vehicle rolls up ≤ 4 s), E ride/sit/transit seat↔rail, Space hop (vehicles) / hop off (transit), H bell/horn, G take off / land, C camera near/far, R back on open drivable ground, W/S throttle/brake-reverse, A/D steer (keyboard curve), Shift sprint/boost. Gamepad: RT/LT analog, Y enter/exit (tap = journal when nothing near), LB horn, L3 glide, D-pad presets in vehicles. Touch: stick = throttle/steer, big buttons.

## Evidence

Node tests (all pass; 165/165 opus-bay tests in the worktree, 23 are mine): FSM guards (far / moving / busy), auto-brake exit (≤ 0.7 s, alight 0.4 s), blocked slot → "这里下不了车", no glide before unlock, take-off 1 s / landing, sit / stand, transit spots, store ⇄ riding sync, every spawn spot fits and is enterable; car top speed 14 (13.3–14.0 in 6 s), reverse −4.5, uphill g 0.54 → 7.2 ± 0.35 u/s, hill hold, downhill ≤ 1.25·vmax, full-lock radius ≤ 3 u at 6 u/s (2.3–3.0), keyboard radius > 5 u at 12 u/s, slides along a wall at 45° (keeps > 6 u/s, heading onto the tangent, never through), hard head-on bump, crest hop + landing, Space hop apex 0.42 (car) / 0.52 (bike), refuses steps / pier planks, grass ×0.5; bike 9 / 11.5 / uphill cut / lean; bike refused by the real Filbert Steps; R `findFit`; glide never below its hard floor over hills + a tower for 30 s of full dive, ceiling, edge turn-back, landing curve + no-spot case; grade factors + pant; triangle budgets; near plane.

Screenshots viewed (all `C:/Users/willy/opus-qa/`):
- bike: `sf-w1-move-01-bike-parked.png` (parked + prompt), `-04-bike-ride.png`, `-05-bike-side.png` (BAYBAY in the basket), `-32-bike-alight.png`, `-33-bike-called.png` ("Here comes your bike"), `-34-bike-stairs.png` (stopped at the Filbert Steps, hint toast, HUD chip).
- toy car: `-06-car-parked.png`, `-08-car-drive.png`, `-35-car-promenade.png` (chip), `-36-car-wall.png` (scraped along the Ferry Building). Event log of that run: enter, bumps 0.12 / **0.60 hard** / 0.15 / 0.16 / 0.24 / 0.05 (scrape), horn, hop, land.
- glide (?debug=1): `-16-glide-takeoff.png`, `-17-glide-bay.png` (over the piers toward the Ferry Building), `-18-glide-side.png` (rider + BAYBAY on the pelican), `-20-glide-landed.png` (landed on the promenade, BAYBAY hopped out), `-29-glide-locked.png` (locked toast), `-44-city-glide.png` (`?world=city`, far 3000, near 1.52 at ~42 u).
- streetcar inside: `-42-streetcar-rail.png` (standing at the pole, both looking out of the open window), `-43-streetcar-seat.png` (on the bench, facing the camera), `-25-streetcar-aisle.png` (walking the aisle), `-27-streetcar-hopoff.png` (Space → hop off, goal counted).
- bench: `-28-sit-bench.png`. Mobile 390×844: `-30-mobile-near-bike.png`, `-31-mobile-bike.png` (Bell / Get off buttons, BAYBAY in the basket).
(Shots 21–24/38 are from before the BAYBAY-in-car and window fixes; 02/03 before the bike was scaled up.)

## Numbers

- Triangles (one skinned draw each + shadow): bike 1,504; toy car 2,044; pelican wings 592 (+ existing pelican.glb 2,909 → pelican ride 3,501 in 2 draws).
- Ferry gate view with 2 bikes + the car on screen: +4 draw calls, +15k triangles incl. shadows (74 vs 70 calls; the ride group toggled off). Other lanes share the GPU, so no fps claims.
- Vehicle step: 120 Hz sub-steps, ≤ 0.3 u each, ≤ 12 per frame; glide 120 Hz.

## Decisions (owner said no approvals needed)

- BAYBAY rides the car **up front** (the 1.0 u car cannot seat two 1 u beans side by side) and **in the bike basket at 0.72×** ("tucked in"); visual bike ×1.28 and car ×1.12 over the plan's physics hull so the toys don't vanish under the round newcomer.
- Car uphill: the plan's gravity term applies only downhill (with it uphill the car would crawl at 3.7 u/s, not the stated 7.2).
- Pitch sign: nose up on acceleration (squat), nose down braking.
- Glide controls: W climbs / S dives (stick up = up), Shift/RT boost, Space/LT slow; take-off follows the camera's view direction; G with no spot within 40 u → the pelican heads for the nearest walkable ground (≤ 200 u) and lands in reach.
- Transit: E = rail ↔ seat, stick = walk the aisle, Space = hop off here (was "skip to stop"; the banner keeps both buttons); riders face the camera-side window.
- Toy car unlocked from the start (plan §12.2), drives promenade/plaza (district has no roads).
- Glide roofs: blockers carry no heights, so polygons count as 24 u, big circles 20 u, props 5 u, plus the hero towers (Coit, Ferry tower, Transamerica, Salesforce) at their modelled heights as repulsors.

## Known gaps

- No tap-to-drive / road-graph autopilot; hold-F call is a straight-line roll-up (≤ 4 s).
- Gamepad mapping untested (no pad in headless). Touch hop button not added.
- Transit hop-off doesn't brake the world car first (plan: 1.2 s brake).
- pelican.glb is a standing model tilted 1.2 rad: reads as a pelican, feet dangle; wings are procedural.
- The crest pant needs 10 s of uphill running — rare in the district (Filbert Steps ≈ 7 s).
- City mode: vehicles only at the district spots; city bike racks need a props hook.
- Occasionally the headless page reloads mid-run (shared Vite HMR from other lanes); re-ran those shots.

## Requests for other lanes

**Lane G (flow / UI / brain):**
1. `game/brain.ts` `updateGuide`: while `move.mode` is `bike | car | glide | travel`, treat as riding (`g.state = 'idle'; setTarget(null)`) — the movement system carries BAYBAY; today the brain may keep issuing lead targets (harmless, overridden).
2. BAYBAY lines (60 s cooldown each) on: `vehicle:enter` (first per kind), `vehicle:bump` with `hard` ("哎呀"), `hill` (first), `vehicle:hop` `crest: true`, `glide:start` / `glide:land`, `pant`, `vehicle:refuse` stairs.
3. `ui/icons.tsx InteractIcon`: interactables with `source 'vehicle'` (id `ride:*`, `vehicle` kind from `rideables`) → Bike / CarFront; `source 'seat'` → Armchair (they show the 'info' icon now).
4. `ui/CoachMark.tsx`: hide unless `s.move.mode === 'foot'` (it checks `!s.riding` only).
5. Map "飞过去": set `game.set({ move: { mode: 'travel' } })` during the trip and `{ mode: 'foot' }` after; "骑车/开车去" can use `__opusBay.actors.move` (vehicle position in `runtime.vehicle`).
6. `game/Systems.tsx QaBridge` `?at=`: with slow loads the 50/400/1000 ms teleports can land before the start flow re-places the player (`?at=streetcar-green` stayed at the spawn); consider re-applying once `phase === 'playing'`.
7. Optional: move the `MoveChip` / touch button inline styles into `opus-bay.css` classes.

**Lane B (terrain):**
1. Add optional `top?: number` (roof world y) to `Blocker` from the city provider; glide floor / repulsor and the ride-camera occlusion read it (`(b as {top?}).top`), else they fall back to estimates.
2. City roads should report `surfaceAt === 'road'` (toy car + bike), steps `'stairs'`, pier planks `'wood'` (car refuses wood).

**Lane D (landmarks):** register tall city structures for the pelican: `setTallStructures([{ x, z, r, top }])` from `actors/moveSystem.ts` (GGB towers, Sutro, Salesforce, City Hall dome …).

**Lane F (transit / audio):** cable cars / ferry use `definePlatform` + `setPlatformPose` (actors/platform.ts); the rider (rail/seat/deck), BAYBAY beside you, the camera and `riderWorld()` then work unchanged. I rebuilt the F-line car body (open windows, benches, poles) in `world/streetcar.ts` for the rider-inside view — keep that shape if you generalise it.

**Lead:** core contract additions as listed above (store `move` + `createStore` normalizer, runtime `move/vehicle/glide`, events, input fields). `STATUS.md` known issues #3 (car body between camera and rider) and #6 (side-step rider) are fixed by the platform ride.
