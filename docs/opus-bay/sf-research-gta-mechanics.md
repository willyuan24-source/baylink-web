# SF research · GTA_SZ movement & action mechanics → Opus Bay upgrade (KEY = gta-mechanics)

Path prefixes: `GTA/` = `C:/Users/willy/opus-qa/ref/GTA_SZ/` (main @ 73603f3, MIT code, read-only). `OB/` = `C:/Users/willy/baylink-opus/src/opus-bay/`. Line numbers are from these checkouts on 2026-09-26. GTA_SZ source is written in a minified style with many statements per line, so one line number often covers a whole function.

## 0. Summary

- **GTA_SZ's motion models are simple.** The walker has instant speed, strafes, and has no jump or gravity. The car is a kinematic bicycle model, the tank is a rate-limited variant of it, and the floatplane is "assisted". The drone mode pauses the world. What makes it feel like GTA is the **glue** around these models:
  - enter/exit checks against the actual doors;
  - a chase camera that moves with the car's delta;
  - a road-graph autopilot;
  - four map actions (auto-drive, route line, teleport, aerial view);
  - key hints that change with the mode.
- **Our on-foot game is already better than theirs:** acceleration, jump, wall sliding, stride-locked animation, touch/gamepad input, tap-to-walk, and BAYBAY. What we lack is everything around vehicles, a world at city scale (streaming, graph navigation), aerial viewing and fast travel.
- **The biggest constraint crosses into the world lane.** Our streets today are 3.2 u wide (Market 5 u) (`OB/data/district.ts:686-694`). A car scaled to the player (1.725 u tall, `OB/actors/dims.ts`) does not fit two lanes of that. Section 11.1 gives two consistent options.
- **Proposal in one sentence:** an explicit movement state machine (foot · sit · bike · car · transit [streetcar | cable car | ferry] · glide · travel · photo), pure and tested step functions per vehicle, "moving platform" frames for transit, a pelican glide for bird's-eye sightseeing, discovery-gated fast travel, a camera rig per mode, and BAYBAY always riding along.

## 1. GTA_SZ scale and units

- **`public/city/city.json` metadata** (checked with node):
  - `horizontalScale 0.6` ("metres scaled 0.60");
  - extent `[-6788,-2605,6788,2605]`, i.e. 13.6 × 5.2 k units;
  - 12,202 roads, with widths of 4.5, 5.8, 6, 9, 12 or 15;
  - 16,076 buildings.
- **The rider is 1.78 u tall** (`public/city/rider/manifest.json`), so bodies are in game metres and the map is compressed.
- **Running across the city takes about 54 minutes** (13,576 / 4.2), so the car (53 u/s) is the real way to travel.
- **In Opus Bay the picture is different.** SF is ≈ 11.3 km across, which is ≈ 1,580 u at K = 0.14. At our run speed (7.5 u/s) that is about 3.5 minutes. So in our world vehicles are for delight and hills, not a necessity.

## 2. Mode state machine and input (GTA_SZ)

**Modes are derived, not stored.** `controlMode` returns the first that applies (`GTA/src/city-world.ts:299`):

- `aircraft`
- `observer`
- `walking`
- `tank`
- `car`

`actor` is the walker or the car state (`:300`).

**One keydown handler** (`city-world.ts:204`) maps:

| Key | Action |
|---|---|
| B | flight (only from the drone) |
| T | tank |
| Space | fire (plane) |
| Enter / Space | fire (tank) |
| H | horn |
| G | drone |
| R | back to the nearest road |
| C | walking: 1st/3rd person; car: view 0/1/2 |
| L | light mode |
| Y | rain |
| V | inspect the car |
| F | leave the drone, or get in/out |

Any move key cancels the autopilot ("manual takeover"). `main.ts:170` adds:

- M / Tab: map;
- an Esc chain: drone → journal → photo → map → pause;
- J (journal) and E (interact) (`main.ts:89`).

**Guards on switching:**

- The tank is refused while walking or in the drone.
- The tank needs a clear 3.44 × 6.8 footprint, on the current pose or snapped to the road centre (`city-world.ts:329-347`, `city-tank-simulation.ts:11-15`).
- Async asset loads use request counters, so stale toggles are dropped (`:333`, `:340`, `:387-388`).

**Pausing:**

- The drone and photo views set `paused=true`, which freezes traffic and pedestrians too (`:378`, `:513`).
- The map and journal also pause the world (`main.ts:44`, `:92`).

**Devices:**

- The key set is cleared on blur and visibilitychange (`:205`, `:219`).
- Mouse: left/right drag; wheel zoom.
- Touch: centroid drag only, and it only moves the camera (`:210-217`).
- **There is no touch joystick, and no gamepad** (no `getGamepads` anywhere in `src/`).

## 3. On foot (`GTA/src/city-walk.ts`)

**Speed.** `WALK_SPEED 1.6`, `RUN_SPEED 4.2` (Shift), `WALK_RADIUS .23` (`:2-4`). There is no acceleration: the speed is the key state (`:44-53`).

**Direction.** Movement is relative to `walk.yaw`, the mouse-look yaw. So A/D strafe; the character does not turn:

```
dx = (sin yaw·f + cos yaw·s)·v·dt
dz = (cos yaw·f − sin yaw·s)·v·dt        (:47)
```

**Look.**

- Arrow keys turn the yaw at 1.6 rad/s and the pitch at 1 rad/s.
- Mouse drag: 0.004 rad/px yaw, 0.003 rad/px pitch; pitch is clamped to [−1.0, 1.05] (`:38`, `:42-43`).

**Collision** (`:10-14`, `:48-52`):

- The walker is a 9-point disc (centre + 8 rim points at 0.23).
- A move is rejected if the height changes by ≥ 0.48 in one frame.
- It then tries the full move, x only, then z only (axis slide).
- The `blocked` predicate includes the parked car, an OBB of half-width 1.18 and half-length 2.7 (`city-world.ts:305-308`).

**Height and visuals.**

- There is no gravity: y is the ground height. The foot sits +0.105 on the road mesh and +0.065 on the pavement (`city-world.ts:318-327`).
- The model's yaw eases toward the direction of motion at rate 16 (`:500`).
- Skeletal walk/run clips share one phase clock with `speedRatio = speed / (cycleSeconds·authoredSpeed)` (`city-rider.ts:69-76`). The walk cycle is 1.03 u and the run cycle 1.90 u (manifest).

**Walk camera** (`city-world.ts:527-531`):

- The eye is at ground + 1.53, with a head bob of `sin(distance·7)·0.008` (`city-walk.ts:55`).
- Third person: `desired = eye − dir·cameraDistance + (0.35, 0.4, 0)`. The distance defaults to 3.7, and the wheel zoom is `×exp(Δ·0.0014)`, clamped to 1.5–7 (`city-walk.ts:37`).
- **Wall pull-in:** it marches t = 0.15 → 1 in steps of 0.07 along eye → desired. At the first blocked point the camera sits at t − 0.1 (at least 0.12), and y is kept ≥ ground + 0.3.
- The target is `eye + dir·0.7 − 0.55y`.
- FOV 0.88 rad (50°), near plane 0.12.
- C toggles first person. There is no smoothing: the camera is recomputed every frame.

## 4. Car (`GTA/src/driving.ts`)

**Keyboard steering** is shaped by speed (`:5`):

```
u = clamp(dir)·(0.76 − 0.22·min(1, |v|/26))
```

**`stepCar`** (`:6-16`), with dt clamped to 0.05:

- **Wheel angle:**
  - target `δ* = u·0.48/(1 + 0.026|v|)`;
  - it follows `δ += (δ* − δ)·min(1, 7dt)`.
- **Force (u/s²):**
  - throttle ≥ 0: `9·t`;
  - braking at v > 1: `18·t`;
  - reverse: `5·t`;
  - throttle while rolling backwards: 18.
- **Drag:** `−(0.038v + 0.0022v|v|)`.
- **Coast:** `−sign(v)·min(|v|/dt, 0.8)`.
- **Handbrake:** `−sign(v)·min(|v|/dt, 10)`, and the yaw rate is ×1.3 while it is on.
- **Speed limits:** v is clamped to [−10, 53·grip].
- **Yaw rate:** `ω = v/3.2·tan δ` (bicycle model, wheelbase 3.2).
- **Position:** `x += sin(yaw)·v·dt`, `z += cos(yaw)·v·dt`.

What this gives (my integration of these formulas):

- 0 → 27.8 u/s ("100 km/h" on the HUD, which shows speed·3.6) in about 3.6 s.
- At v = 10: turn radius ≈ 12 u. At v = 20: ≈ 17 u, ω ≈ 1.2 rad/s.
- There is no lateral slip or grip model.

**Collision response** (`city-world.ts:509`):

- The move is sub-stepped every ≤ 0.7 u.
- It probes a point at nose ±1.45 (tank: the full footprint), props, and traffic cars within 2.7.
- On a hit it **reverts to the previous pose** and sets `v = −0.15·v` (the tank stops). There is no sliding along walls.

**The collision world** (`CityCollision`, `driving.ts:20-36`):

- Spatial hashes with 90 u cells for road segments and buildings.
- Rule: being inside the road width/2 − 0.65 is always free. Otherwise a point is blocked if it is inside a building ring, within 1.15 of a building edge, inside a landmark radius (24–65), off land, or in water.
- **The car can drive anywhere that is not blocked** (the `offroad` flag is only informational, `:502`).

**Body pose** (`:513`):

- pitch = `atan2(h(front 1.5) − h(rear 1.5), 3)`;
- roll = `−δ·v·0.0025`;
- bob = `sin(7t)·min(0.008, 0.0004|v|)`.

**Car cameras** (`:516-519`, `:532-533`):

- **The camera is first moved by the car's delta** (`position += s − old`), and then lerped with `1 − exp(−9dt)` (20 in the cockpit). Speed therefore never makes the camera lag. Only yaw and height changes are smoothed.
- Chase view: offset −8.6, height = ground + 1.75 + 2·cameraPitch (default 0.22; drag range 0.02–0.8). Target: 5 u ahead, +2.65 up.
- Far view: −18 / 9. Cockpit: `CITY_DRIVER_POSE` (`city-cockpit.ts:3`).
- After a drag is released there is a 2 s hold (`viewReturn=2`, `:207`). Then the yaw springs back behind the heading at rate 3.
- FOV = `0.80 + 0.00045|v|` rad, i.e. 45.8° → 47.2° at top speed. That is almost constant.

## 5. Enter and exit rules (`GTA/src/city-walk.ts:15-35`, `city-world.ts:360-374`)

**Door slots** are four lateral points at ±1.9 and ±2.8 from the car centre (tank: ±3 / ±3.9).

**Exit:**

- Requires |v| ≤ 1; otherwise the message is "先停稳".
- The first slot that passes wins. A slot passes if it is clear for the 0.23 disc and its height differs from the car's by ≤ 0.55.
- On exit: the autopilot is cancelled, speed and steer are zeroed, and the camera goes to third person.
- If no slot passes, the message is "车门旁需要留出空间".

**Enter:**

- Requires car |v| ≤ 1, the walker within 5 u (tank 7), and a height difference ≤ 0.8.
- Some door must be within 2.7 u, reachable along a straight path sampled every 0.15 u that is clear with steps ≤ 0.48. A car behind a wall is not enterable.

**Other rules:**

- The rider asset is lazy-loaded when you first exit (`:349-358`).
- The walking HUD shows the distance to the parked car once it is > 5 u away (`city-career-experience.ts:76`).
- Story and career steps require you to be **stopped (|v| < 1), on foot, within 28 u** before E works (`city-story.ts:8-11`, `:391-395`; `main.ts:100`).

## 6. Tank, floatplane, drone and beacons

**Tank** (`city-tank-simulation.ts:2-10`):

- Speed moves toward its target at a fixed rate: forward 14, reverse 5, rate 3.3 (8 when braking, 14 with the handbrake).
- Turning: `steer → 0.6·input`, rate 7; yaw rate `steer/0.6·0.60` rad/s. It can turn on the spot.
- Shell 145 u/s under gravity 9.81, reload 1.8 s.

**Floatplane** (`city-flight-simulation.ts:26-49`, `city-flight.ts:69-105`):

- **Integration:** fixed **120 Hz sub-steps**, and dt is clamped to 0.1.
- **Attitude:**
  - pitch → 0.57·input at rate 1.7;
  - roll → 0.82·input at rate 2.5;
  - yaw rate = `tan(roll)·0.75 + rudder·0.38`.
- **Speed:** `v → 24 + 53·throttle − 13·pitch` at rate 0.6.
- **Limits:** ceiling 2,100. At the extent boundary the flight ends.
- **Collision:** 9 hull points are swept against building prisms (`intersectFlightPrism` handles courtyard holes, `city-flight-collision.ts:8-24`) and exact landmark triangles. A hit is a crash, followed by a 3 s explosion and a return to the drone.
- **Spawn:** it searches upward in 25 u steps for free air at ≥ ground + 65.
- **Chase camera:** eye = `p − f·27 + (0, 8 − 12f.y, 0)`, target `p + f·12`, smoothing `1 − exp(−7dt)`. If the camera would be inside geometry it is pulled in to the hit − 1.2 (`:97-100`).

**Drone / observer** (`city-observer.ts`):

- An orbit rig with focus, yaw, pitch ±1.43 and distance 3–3,200 (wheel ×exp(Δ·0.0012)).
- WASD speed `max(4, min(90, 0.13·dist))`, ×3 with Shift.
- Pan scales with the visible span. Floor = ground + 1.5, ceiling 2,200.
- The near plane adapts to clearance (`city-observer-depth.ts`).

**Beacons:**

- Long-press 650 ms (drag tolerance 8 px) on a surface: mark, save (24 max, versioned JSON), or "move there" (`city-observer-beacon-state.ts:3-6`).
- "Move there" resolves a **safe road arrival** within 300 u. It tries offsets 0/±8/±16 along the nearest road segments, and a 9-point body sample must be on the road, not over water, on a bridge with real support, and with height differences ≤ 0.75. Clicking water never snaps to the shore (`city-observer-destination.ts:18-20`, `:60-100`).

## 7. Navigation and autopilot

**`RoadGraph`** (`navigation.ts`):

- Nodes come from road points merged on a 3 u grid, or from the precomputed `/city/navigation.json` (`main.ts:201`).
- `route()` runs Dijkstra from the nearest *edge*, then densifies to ≤ 20 u segments.

**`CityAutopilot`** (`city-autopilot.ts`):

- It is a **pure controller**: it outputs `{throttle, steer, handbrake}` for the same `stepCar` the player uses.
- **Time-sliced route search:** A* runs as a generator and yields every 2 ms (`:94-127`), so a long route never stalls a frame.
- **Route shaping:**
  - the route is resampled every 4 u;
  - bend cautions: turns > 0.75 rad cap the speed at 3.5, turns > 0.35 at 6, junctions at 11 (`:140`);
  - cruise speed by road class, 10–24 (`:23`).
- **Pure pursuit:** `wheel = atan(6.4·sin α / max(2, ld))`, with look-ahead `ld = clamp(4 + 0.5|v|, 5.5, 10)` (`:346-348`).
- **Other rules:** arrival radius 2.5; after a 20 s wait it is "blocked"; red lights are obeyed; the ETA shown is `remaining / max(3, 0.7·cruise) + wait` (`:74`).
- **Takeover:** any WASD/Space key takes over (`city-world.ts:204`).

## 8. Ambient movers (worth copying in spirit)

**Traffic** (`traffic.ts:14-29`):

- 40 agents on graph nodes 14–600 u from the player, at 7–13 u/s, offset 1.15 into their lane.
- A car stops if another is within 8 u ahead or a red light is within 6 u.
- They are re-seeded when the player is > 450 u from the last origin, and culled beyond 950.

**E-bikes** (`city-ebikes.ts:13`, `:48-81`): 18 riders at 5.5–9 u/s, offset 2.15 to the kerb, visible within 220 (aerial 260); parked bikes are thin instances in 80 u cells.

**Pedestrians** (`pedestrians.ts:28-38`, `:67`): ≤ 56 walkers ping-pong on authored path segments within 330 u, at 0.8 + 0.1·(i mod 7) u/s. They are re-placed after 220 u.

**Signals** (`city-traffic-signals.ts:39`): a 31.4 s cycle (green 13 / amber 3 / all-red 1.2 / green 10). Amber holds traffic unless it is already within 5 u.

**Pedestrian impact** (`pedestrian-impact.ts`): a car hit becomes an analytic swept-OBB impact and ballistic knockdown bodies (gravity 18, ≤ 8 active, 0.8 s rest, then they get up). **This is off-tone for us.** Replace it with "hop aside" (section 11.12).

## 9. HUD, map, objectives and saves

- **HUD refresh.** The HUD updates every 0.12 s, not every frame (`main.ts:175`).
- **Area reveal banner.** It shows when you come within 520 u of a place and re-arms beyond 650 (hysteresis, `:180-181`).
- **Visited places.** A place counts as visited ("城市足迹 +1") when you are within 40 u and have stopped (`:195`).
- **Minimap.** Heading-up, 0.38 px/u, with a perspective tilt of `0.40 + 0.25·min(1, |v|/28)` rad (`city-hud.ts:201`, `:306`) and a route polyline.
- **Map panel** (`city-map.ts:24-29`, `:94`): search, category filters, a "discovered only" toggle and zoom 0.8–18×. Actions: **auto-drive**, **manual route** (green line), **"移动到附近道路" teleport**, **"俯瞰此处" aerial view**.
- **Teleports don't count toward progress.** A teleport bumps `debugEpoch` and marks an active ride as "debugged", so it cannot be completed that way (`main.ts:105`, `:166`; `city-story.ts:10`, STORY_TELEPORT_DISTANCE 45).
- **Rides need real travel.** A ride settles only after ≥ 150 u of real odometer (`city-life.ts:8`).
- **Objective marker.** A torus 13 u across, shown within 180 u; its screen label, with distance, is shown within 650 u (`city-objective-marker.ts:4-17`).
- **Quick tips.** A different key set per mode, plus a "?" full help panel (`city-quicktips.ts:6-17`).
- **Saves.** Versioned and validated:
  - career v2 migrates from life v1 (`city-career.ts:13`, `:36-41`);
  - story v1 (`city-story.ts:6-7`, `:78-86`);
  - beacons are decoded as untrusted input (`city-observer-beacon-state.ts:23-37`).
- **Player position is not restored.** Every load starts at `data.spawn` (`city-world.ts:250`).

## 10. Ours vs GTA_SZ (honest)

| Aspect | GTA_SZ | Opus Bay | Edge |
|---|---|---|---|
| Walking feel | instant speed, strafing, no jump (`city-walk.ts:39-54`) | accel 24 / decel 30, turn rate 13, skid, analog, jump with coyote / buffer / cut (`OB/actors/controller.ts:18-36`, `:331-380`) | **ours** |
| Wall contact | axis slide, 0.23 disc | 32-sample averaged normal, slide or press-and-lean with hysteresis, soft bumps (`controller.ts:66-111`, `:296-329`) | **ours** |
| Slopes / stairs | 0.48 step cap only | uphill ×max(0.6, 1 − 0.4·slope), stairs stride 0.5 (`controller.ts:289-294`, `:34`). But the rise cap of 0.55 per 0.18 u sub-step (`:39`) means **no steepness limit** at all | ours; both need a grade model |
| Follow camera | mouse-look strafing cam, ray pull-in, 1st person | zoom-coupled pitch (`OB/actors/camera.ts:28`), smoothDamp 0.2 s focus, look-ahead ±3.5, lazy re-centre, zone views, hero clearance, two-shots, terrain lift (`:998-1017`), dither fade | ours for cozy; theirs has pull-in and 1st person |
| Speed feel | FOV almost constant; carry-by-delta chase | run: +1.5 distance, +3° FOV (`camera.ts:33`) | — |
| Vehicles | car, tank, plane; validated doors; parked car persists and collides | streetcar ride only; player pinned to the car's side step (`OB/game/ride.ts:114-139`, `OB/actors/system.ts:433-446`) | **theirs** |
| Autonomous travel | road-graph autopilot, time-sliced A* | grid A* click-to-walk, 0.75 u cells, 90k expansion cap (`OB/actors/nav.ts:12-13`) | theirs at scale, ours for tap UX |
| Aerial / fast travel | drone, beacons, plane, teleport-to-road, anti-cheat flags | photo orbit ≤ 46 u (`camera.ts:25`); map "带我去" walks there | **theirs** |
| Devices | keyboard + mouse (touch rotates the camera only) | keyboard, mouse, floating stick, tap-to-walk, pinch, gamepad (`OB/core/input.ts:115-190`, `OB/actors/pointer.ts`) | **ours** |
| Companion | none | BAYBAY lead / follow / hop-in, rides along (`OB/actors/guide.ts:17-30`, `system.ts:468-474`) | **ours** |
| World scale | hashes at 90 / 160 u, streamed instances | one 0.5 u grid over the ±400 slab (`OB/core/terrain.ts:56`, `:237-249`) | **theirs** |
| Saves | versioned, validated, migrations | settings + wishlist localStorage | theirs |

## 11. Recommendations for Opus Bay (whole SF)

### 11.1 Scale constraints that movement puts on the world

- **Lane geometry.** A two-lane toy road needs a roadway ≥ 2·(car width + 0.7). Sidewalks need ≥ 1.2 u each so that the player (radius 0.45) and BAYBAY (0.42) fit side by side.
- **Real SF streets** are about 20 m right-of-way, with about 11–12 m between curbs (typical residential). At K = 0.14 that is 2.8 / 1.6 u, far below any car.

| Option | K | Toy car L × W / wheelbase | Roadway | Right-of-way | Cross-SF (walk / run / car) |
|---|---|---|---|---|---|
| **A: "kiddie car"** (recommended if K stays 0.14) | 0.14 | 1.8 × 1.0 u / 1.1 (newcomer's torso and hat above the rim) | 3.4 u (≈ today's 3.2) | 5.8 u (sidewalks 1.2) | ≈ 1,580 u: 6.3 / 3.5 / 2.0 min |
| B: player-scale car | 0.20 | 2.4 × 1.3 / 1.5 | 4.4 u | 7.4 u | ≈ 2,260 u: 9 / 5 / 2.6 min |

- **Street widths should be toy constants**, applied to real OSM centrelines. Lots shrink to fit, the same way the promenade is already "inflated" (`OB/data/district.ts:17-19`).
- **Grades.** The height exaggeration today is 20 u / 84 m = 0.238 u/m against 0.14 u/m horizontally, i.e. ×1.7. SF's steepest blocks are commonly cited at 31.5% (Filbert between Leavenworth and Hyde; 22nd St), which becomes ≈ 54% in game.
- **Limits:** walkable grade ≤ 0.9; vehicles ≤ 0.8.
- **Ask the world lane** to compress heights above ≈ 90 m: `y = 0.238h` for h ≤ 90, else `21.4 + 0.12(h − 90)`. Twin Peaks (≈ 280 m) then becomes ≈ 44 u instead of 67 u, and its grades stay drivable.

### 11.2 Movement state machine (`OB/actors/modes.ts`, pure and tested)

```
MoveMode = foot | sit | bike | car | transit(line, spot: rail|seat|deck) | glide | travel | photo
foot    -F, parked bike/car door slot reachable, player |v|<0.8-->  boarding(0.45 s) --> bike|car
bike|car -F: auto-brake at 24 u/s² until |v|<1.2 (≤0.7 s)-------->  alighting(0.4 s) --> foot
         (no clear slot: toast "这里下不了车", stay in the vehicle)
foot    -E at a stop--> waiting(≤5 s, as ride.ts MAX_WAIT) --> boarding(0.5 s) --> transit
transit -E switches rail<->seat; Space/B: car brakes 1.2 s --> alighting(0.4 s) --> foot
foot    -G (grounded, glide unlocked)--> takeoff(1.0 s pelican swoop) --> glide
glide   -G, or long-press/tap a spot--> landing(≤3 s descent to a resolved spot) --> foot
any free mode -map "飞过去" (discovered place)--> travel(2.5–6 s, waits for tiles) --> foot
foot    -E at bench/step/seat--> sit --(any move)--> foot
dialogue / photo / cinematic: freeze; a moving vehicle auto-brakes first (≤1.5 s)
```

- **Door slots** (following `GTA/src/city-walk.ts:15-35`, adapted): 4 slots at ±(W/2 + 0.9) lateral and ±(L/2 + 0.6) fore/aft.
- **A slot is valid if** `canStand(slot, 0.45)`, its height difference ≤ 0.55, and there is a straight clear path from the player sampled every 0.15 u.
- **Entering** is allowed within 2.4 u of a slot. **Holding F for 0.6 s while more than 25 u from your vehicle "calls" it:** it spawns off-screen on the nearest road and drives up in ≤ 4 s, using the autopilot below.

### 11.3 On foot (edits to `OB/actors/controller.ts`)

- **Keep `WALK 4.2` / `RUN 7.5`.** They read well at toy scale.
- **Grade** is measured as g = Δh/Δs along the motion over 0.6 u, as today at `:290-293`.
  - Uphill: × `max(0.55, 1 − 0.45g)`.
  - Downhill: × `(1 + 0.12·min(1, |g|/0.5))`.
  - g > 0.9 on a non-`stairs` surface is a wall. It feeds `moveDisc`, whose wall test would use the grade instead of `MAX_RISE`.
  - Stairs: ×0.8 going up, ×0.9 going down (the stride of 0.5 is kept).
- **No stamina.** A cosmetic "puff" replaces it: after 10 s of running uphill (g > 0.25), play a 2 s pant animation at the top. BAYBAY's line about it has a 60 s cooldown.
- **Sit:** E on `bench`, steps or seat anchors (`district.ts:963`, `:982`, `:990` already place benches). A 0.35 s snap to the seat, then the camera eases to that spot's zone view. The idle ladder's sit (`system.ts:461`) stays.
- **Moving platforms** (`OB/actors/platform.ts`): `{toLocal, toWorld, deck polygon (local), heightLocal, v}`. While on a deck, the controller steps in the deck's local frame and writes world = `toWorld(local)`. This replaces pinning the player to the car (`system.ts:437-445`), so you can walk around the ferry deck.

### 11.4 Bicycle (`OB/actors/vehicles/bike.ts`)

| Property | Value |
|---|---|
| Size | length 1.3 u, wheelbase 0.95 |
| Speed | cruise 10 u/s, Shift/RB 13 u/s (no stamina) |
| Accel / brake / coast | 8 / 18 / 1.5 u/s² |
| Uphill | `vmax·max(0.45, 1 − 0.9g)`; standing-pedal animation when g > 0.3 |
| Steering | `δmax = 0.7/(1 + 0.12v)`; `ω = v/L·tan δ`; visual lean = `0.8·atan(v·ω/9.8)` |
| Hop | Space / B: vy 5, g 24 → apex 0.52 u |
| Blocked by | `stairs` surfaces, water, buildings; hint "楼梯要走上去 · F 下车" |

- **Where bikes come from:** the existing `bike-rack` prop kind (`district.ts:941`). Racks go at transit stops and landmarks, with generic toy bikes (no brand).
- **Returns:** a bike left more than 80 u away returns quietly to the nearest rack.

### 11.5 Toy car (`OB/actors/vehicles/toyCar.ts`, option A numbers)

| Property | Value |
|---|---|
| Size | L 1.8, W 1.0, wheelbase 1.1, hitbox 0.95 × 0.55 half-extents |
| Top speed | vmax 13 u/s, reverse 4.5 u/s |
| Drive | `a = 10·t·(1 − v/vmax_eff)`; brake 24; coast 3 (toy rolling friction, no drag term) |
| Uphill | `vmax_eff = vmax·(1 − 0.9·max(0, g))` → 54% grade: 6.7 u/s, a chugging toy |
| Downhill | gravity `−9·g` u/s², capped at 1.25·vmax |
| Hill hold | no throttle downhill → hold ≤ 6 u/s |
| Keyboard steering | `u·(0.85 − 0.25·min(1, v/vmax))` (as `driving.ts:5`) |
| Wheel angle | `δmax = 0.6/(1 + 0.09v)`, rate 9 |
| Turning | `ω = v/L·tan δ` → full-lock radius 2.7 u at 6 u/s, 3.9 u at 13 u/s; with keyboard shaping 3.7 / 6.6 u (a 3.4 u roadway corner is taken at ≤ 6 u/s) |
| Crest hop | grade drops by > 0.25 within 2 u at v > 9 → vy = 0.12v, squash on landing (an SF hill-crest nod, not a crash) |
| Hop | Space / B: vy 4.5 → apex 0.42 u, 0.6 s cooldown, no air steering |
| Body pose | pitch = `−0.006·a` + terrain pitch (`atan2` front/rear, as `city-world.ts:513`); roll = `clamp(−0.012·v·ω, ±0.12)` |

**Collision** (`OB/actors/vehicles/collide.ts`, shared with the bike):

- 3 nose probes and 2 tail probes, fixed **120 Hz sub-steps** (as the plane) and ≤ 0.3 u per sub-step.
- The wall normal comes from the same 32-sample ring as `moveDisc`.
- **Slide, don't stick** (GTA_SZ reverts the pose, `city-world.ts:509`): keep the tangential velocity ×0.85, bounce the normal velocity at −0.3·v_n, and ease the yaw toward the tangent at rate 6.
- A `bump` event is sent with strength |v_n|/vmax. At |v_n| > 5, squash the car and BAYBAY says "哎呀".
- **R** puts the car back on the nearest roadway centreline, facing along it (as `resetRoad`, `city-world.ts:495`).

### 11.6 Transit: cable car, streetcar, ferry (`OB/game/transit.ts` + `OB/data/transit.ts`)

- **Generalise `ride.ts` into lines:** `{id, kind, path (with heights), stops[{id, at}], vmax, acc, dwell, cars, spots}`. `world/streetcar.ts` (VMAX 11, ride speed 13, ACC 2.6, DWELL 6, `:17-22`) becomes one instance of it.
- **Cable cars** — Powell–Hyde, Powell–Mason, California, all real lines:
  - A **constant cable speed** of 8 u/s (the real one is a constant 9.5 mph), grip on/off accel 3 u/s², dwell 4 s at every second block.
  - Powell–Hyde is ≈ 3 km, so ≈ 420 u, or ≈ 55 s of riding.
  - **Turntables** at Powell & Market, Hyde & Beach and Taylor & Bay, with an E-mash "help push it round" moment. The California line has double-ended cars and no turntable.
  - Spots:
    - `rail`: the running board at local (±1.25, +0.45, z ∈ [−1.5, 1.5]). Hang pose: one arm on the pole, 12° lean-out, hat and backpack springs driven by 0.6·v.
    - `seat`: bench anchors.
  - E switches spot. While on the rail, a **bell rhythm** mini-action (the real bell-ringing tradition) plays on E.
- **F-line** follows its real route along Market from Castro to the Wharf.
- **Ferry** between the Ferry Building and Pier 41 (≈ 2.5 km, so ≈ 350 u): ≈ 40 s at 9 u/s, walkable deck (platform), rocking roll `0.02·sin(0.9t)`.
- **Goals** such as "ride the cable car" count only after ≥ 1 real segment has been ridden (GTA_SZ's ≥ 150 u odometer rule, `city-life.ts:8`).

### 11.7 Pelican glide: bird's-eye sightseeing (`OB/actors/glide.ts`)

- **The pelican already exists:** `public/opus-bay/models/pelican.glb` ("for glide use the same mesh tilted", `OB/ASSETS-LEDGER.md:40`). The newcomer sits on its back with BAYBAY in front.
- **Unlocked** at the Coit viewpoint, where the map unlocks today.
- **Flight model** (after `city-flight-simulation.ts:26-38`, with **no crash and no stall**):
  - cruise 14 u/s, Shift/RT 20, S/LT 9;
  - pitch → 0.45·input at rate 1.8; roll → 0.7·steer at rate 2.5;
  - yaw rate = `tan(roll)·0.9`; wings level themselves with no input.
- **Height limits:**
  - soft floor = the highest of terrain / building roof within 6 u, + 6 u. Below it, a pitch-up spring (k = 4) takes over.
  - ceiling 260 u, enough to frame all of SF.
- **Edge of the slab:** within 30 u of the edge the pelican turns back toward the centre (0.8 rad/s). There is no abort.
- **Buildings:** `intersectFlightPrism`-style sweeps are used as repulsors. Look 2 s ahead; on a predicted hit, pitch up and roll away. A residual overlap pushes out with a soft `bump`.
- **Landing:** G, or a long-press of 650 ms / a tap.
  - The spot comes from a resolver like `city-observer-destination.ts`: nearest `canStand` point within 40 u, never water.
  - Then a 2–3 s descent, and the pelican drops you with a hop and a squash.
- **The world keeps running** (GTA_SZ pauses it). When above 40 u, streaming switches to coarse LOD.

### 11.8 Fast travel (`OB/game/fastTravel.ts`, `OB/game/discovery.ts`)

- **Discovery.** A place is discovered when you are within 12 u of its anchor. "足迹" counts go in the save.
- **Map actions** (`OB/ui/MapPanel.tsx:122` today only offers "带我去"):
  - "飞过去" — discovered places only;
  - "带我去" — walks, as today;
  - "开车 / 骑车去" — when your vehicle is within 60 u. It draws breadcrumbs and, on phones, can autopilot the car. Autopilot: pure pursuit on the street graph with look-ahead `clamp(3 + 0.4v, 4, 8)` and GTA_SZ's corner cautions scaled ×0.55.
- **"飞过去" sequence:**
  1. Pelican pickup, 0.8 s.
  2. The camera rises to a top view (pitch 1.1, distance 90).
  3. A pan at up to 400 u/s, ≤ 3.5 s.
  4. **A hold, high in "clouds", until the destination tiles are ready.** After 8 s it cuts instead.
  5. A 1.2 s descent to the arrival anchor, facing the zone view.
- BAYBAY arrives with you. Travel never completes ride goals (anti-cheat flag, as `main.ts:105`).

### 11.9 Camera per mode (`OB/actors/cameraModes.ts`; `camera.ts` delegates)

| Mode | Distance / height | Pitch | FOV ° | Follow | Re-centre | Occlusion |
|---|---|---|---|---|---|---|
| foot | 7–30 (15), as now | zoom keys | 42 (+3 run) | smoothDamp 0.2 | idle 1.8 s, rate 0.5 | dither + swing (now) |
| bike | 9 + 0.25v (≤ 12) | 0.24, +0.2 when the road ahead drops | 44 + 0.4v (≤ 50) | **carry by vehicle delta** + exp 8 | always behind the heading 1.0 s after a drag, rate 3 | dither + pull-in, ≥ 4 u |
| car | 10 + 0.25v (≤ 13), height 3.2 | 0.26, +0.25·max(0, −g ahead at +8 u) (look down the hill at a crest) | 44 + 0.6v (≤ 52) | carry by delta (`city-world.ts:519`) | 2.0 s after a drag, rate 3 (`:516`) | pull-in, ≥ 4 u |
| cable car | rail 7 / seat 11 | 0.2 | 46 | fixed to the car frame | side = downhill-view side | choose the side (fixes the known "car body between camera and rider", `STATUS.md:80`) |
| ferry | foot rig in the deck frame | — | — | — | auto-orbit at 24 u after 4 s idle | — |
| glide | eye `p − f·16 + (0, 5, 0)` | — | 50 + 0.4(v − 14) | exp 6 | always | pull-in to the hit − 1.2 (`city-flight.ts:99-100`) |
| sit | the zone view, or 12 u from the bench | 0.22 | 42 | — | — | as foot |
| travel | scripted | | | | | |

### 11.10 BAYBAY per mode (`OB/actors/guide.ts`, `system.ts`)

- **Bike:** she sits in the **front basket**; ears, tail and scarf springs follow speed.
- **Car:** passenger seat of the open-top car, head above the rim.
- **Boarding:**
  - If she is within 25 u, she runs to the car and hops in (the existing `hopIn` arc of 0.4 s, `guide.ts:102-117`). The throttle is gated until she is seated, 1.5 s at most.
  - If she is farther away, she pops into the seat with a puff (hidden by the car body).
- **Cable car:** on the running board beside you, holding the pole. **Ferry:** she walks the deck with you (platform-local follow). **Glide / travel:** carried along.
- **Getting out:** she hops out to your side slot (`guide.ts:88-96`).
- **Lines** trigger on firsts: first hill with g > 0.4, first crest hop, first cable-car bell, arriving in a new neighbourhood. Each has a 60 s cooldown.

### 11.11 Input mappings (`OB/core/input.ts`)

| Action | Keyboard | Gamepad (standard mapping) | Touch |
|---|---|---|---|
| move / steer | WASD, arrows | left stick (D-pad on foot, as now) | floating stick, left half |
| throttle / brake-reverse | W / S | RT(7) / LT(6), analog `.value` | stick y |
| run / sprint | Shift | RB(5), or stick > 0.94 | stick > 0.92 |
| jump / hop / get off transit | Space | B(1) | action button |
| interact / board / sit | E, Enter | A(0) | action button (context label) |
| enter / exit vehicle; hold = call vehicle | F | **Y(3)** (journal moves to a View-button long-press) | "上车 / 下车" pill |
| horn / bell | H | LB(4) | 56 px button while in a vehicle |
| glide | G | L3(10) | "起飞 / 降落" button when unlocked |
| map (hold: journal) | M (J) | View(8) | HUD |
| call BAYBAY | Q | X(2) | HUD |
| camera near / far preset | C | D-pad up / down in vehicles | pinch |
| reset / unstick / back on road | R | R3(11) | — |

- Keep the rule of never calling `preventDefault` (`input.ts:58-60`).
- Read trigger values as analog.
- Tap-to-walk becomes **tap-to-drive** while in a car (autopilot to the tapped road point).

### 11.12 Collision and streaming for a big city

- **Tiles of 128 u.** Each tile holds:
  - height as `Uint16` (cm) at 0.5 u — 128 KB per tile;
  - surface and kind packed into one byte;
  - a blocker hash at 8 u.
- **Memory.** A 5 × 5 window is ≈ 4.8 MB. The full city (≈ 13 × 13 tiles at K = 0.14) is only needed for the map.
- **Queries stay O(1)** (`heightAt`, `surfaceAt`, `canStand`, `blockersNear`). A tile that has not loaded counts as *blocked*, and vehicles slow down there.
- **Prefetch radius** = 160 + 3·v (u); glide uses 320 at coarse LOD.
- **Navigation is two-level:**
  - a global sidewalk/street graph (like `navigation.json`), searched with time-sliced A* at 2 ms per frame (`city-autopilot.ts:94-127`);
  - then the existing 0.75 u grid A* inside the loaded tiles.
- **Dynamic obstacles.** People hop aside instead of being knocked down. NPCs predict the player's vehicle 1.5 s ahead; if it will pass within 1.2 u, they hop 1 u sideways with a "!" emote. Otherwise the car stops (v × 0.2) with a bump.
- **Toy traffic** (later): 24 instanced cars within 220 u at 5–9 u/s, a 4 u queue gap and the 31 s signal cycle. Bumping one exchanges velocity along the normal with restitution 0.3; the other car honks and waits 1.5 s.

### 11.13 Save v2 (`OB/data/wishlist.ts` or a new `OB/data/save.ts`)

- **Key and shape:** `opus-bay:save:v2 = {version:2, discovered[], vehicles:{car?, bike?: {x, z, heading}}, lastSafe:{x, z, heading}, unlocked:{glide}, rides:{line: count}}`.
- **Decode as untrusted:** drop damaged rows, clamp positions to the slab, and snap `lastSafe` with `nearestWalkable` (the pattern of `city-observer-beacon-state.ts:23-37`).
- **Offer "继续上次的位置"** on the title screen. GTA_SZ always respawns at spawn, which is fine for 13 km of roads but tedious for a walking game.

### 11.14 Module boundaries and tests

**New files:**

- `actors/modes.ts`
- `actors/platform.ts`
- `actors/glide.ts`
- `actors/vehicles/{toyCar,bike,collide,models}.ts` (models are procedural `Batch` meshes ≤ 3k triangles, with wheel and steering pivots)
- `actors/cameraModes.ts`
- `game/transit.ts`, `data/transit.ts` (with sourceUrl / verifiedAt)
- `game/fastTravel.ts`, `game/discovery.ts`
- `world/cablecar.ts`, `world/vehicles.ts` (instanced parked and traffic cars)

**Changed files:**

- `core/store.ts:42`: `riding: 'streetcar'|null` becomes `move: {mode, line?, spot?}`. This is a contract change and goes through the integrator.
- `core/runtime.ts`: `vehicle`, `glide`.
- `core/input.ts`: axes, F/G/H/C, the Y remap, hold-to-call.
- `actors/controller.ts`: grade model, platforms, sit.
- `actors/system.ts:396-474`: mode dispatch replaces the streetcar-only branch.
- `actors/guide.ts`: seat/basket states.
- `actors/camera.ts`: delegate to per-mode rigs.
- `actors/nav.ts`: tiles and graph.
- `game/flow.ts:1185-1235`: generic board and alight.
- `ui/Hud.tsx`, `ui/MapPanel.tsx`, `ui/CoachMark.tsx`: hints per mode, like `city-quicktips.ts`.

**Tests (node, pure):**

- toyCar: top speed, uphill speed at g = 0.54, turn radius ≤ 3 u at 6 u/s, slide-not-stick against a wall.
- FSM guards: blocked slot, auto-brake exit, no glide before unlock.
- Glide never below its floor.
- Fast travel only to discovered places.
- Transit goals need a real ride.

**Also:**

- Sub-step vehicles at 120 Hz, capped at 12 sub-steps. `system.ts:388` already clamps dt to 0.1.
- Budget: ≤ +8 draw calls in a vehicle.

### 11.15 Higgsfield

This lane needs little.

- **Vehicles, cable cars and bikes should be procedural**, because movement needs exact wheel, steering, pole and seat anchors. A Meshy image-to-3D costs 30 credits (`ASSETS-LEDGER.md:26-31`) and returns unrigged meshes.
- **The pelican GLB is reused** for the glide.
- **Suggested spend: ≤ 15 credits.** That covers about 12 BAYBAY barks for mode firsts (TTS at ≈ 0.1–0.4 credits each) and 2 style-reference images (toy car, cable car; 2 credits each) for the modeller.

### 11.16 Build order

1. FSM, input, and the grade model on foot.
2. Toy car with collision, its camera, and BAYBAY as passenger.
3. Transit generalisation with the cable car and platforms.
4. Pelican glide.
5. Fast travel, discovery, and save v2.
6. Bike.
7. Toy traffic and pedestrians hopping aside.

Every step ships with its node tests and an `opus-shot` run: car on Filbert, cable car on Hyde, glide over Coit, mobile.
