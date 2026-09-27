# Wave 2 · day-0 contracts, ownership and protocol

Landed by the lead's day-0 commit on `opus-bay` (2026-09-27). Everything below exists in the code **now**, harmless
(no behaviour change) until its owner fills it in. The plan is `sf-research-tech.md`; the lane task lists are
`sf-w1-checkpoint.md` §5.4–§5.10; the raw scoping outputs are `/tmp/claude-0/res-*.json`.

> **The rule: never edit a file you do not own. If you need a change in someone else's file, write it under
> "Requests" in your report (`docs/opus-bay/sf-w2-<LANE>.md`) with the exact change, and code against the hook that
> exists today.** Frozen files are edited by nobody in wave 2 (the lead merges requests for them afterwards).

Contents: [1 Ownership](#1-ownership) · [2 Protocol](#2-worktree-commit-push-ports) · [3 Decisions](#3-decisions) ·
[4 Events](#4-event-contract) · [5 Hooks and stubs](#5-hooks-and-stubs) · [6 Routed requests](#6-cross-lane-requests-already-known) ·
[7 What day 0 changed](#7-what-day-0-changed-and-checks) · [8 Review](#8-day-0-review-2026-09-27)

---

## 1. Ownership

### 1.1 Final wave-2 file ownership (decided by the lead; after day 0 only the owner edits a file). OB = src/opus-bay.

- C2 (city look, atmosphere, performance, bundle split): OB/world/{materials,warmup,environment,palette,post,world,WorldScene,water,backdrop,ground,props,fx,labels,clock,city,builder,typedBatch,landmarks}.ts(x) (district files: behaviour in district mode must not change), OB/world/recipes/**, OB/world/sf/{build,far,worker,stream,cell,props,hero,pools,water,stats,raster,mesh,look,fog,lights,boards}.ts, OB/game/GameRoot.tsx, vite.opus.config.ts, scripts/opus-sf/boards.ts, scripts/opus-sf/qa/**, public/opus-bay/sf/v1/boards/**, tests/opus-bay-sf-{look,atmos,boards,stream}.test.ts, tests/opus-bay-hero-regression.test.ts (BASELINE rows never change), tests/opus-bay-world.test.ts.
- D2 (landmarks in context, AI meshes, house kit, 3 routes): OB/world/sf/sites.ts, OB/world/sf/landmarks/**, OB/data/sf/landmarks.ts, OB/data/sf/routes.ts, OB/world/{models,modelMaterial}.ts, OB/world/sf/{kitSwap,l0index,dress,swap}.ts, OB/data/assets.ts, OB/core/sfTerrain.ts (additive only), public/opus-bay/models/** (except pelican-glide.glb), scripts/opus-sf/assets/**, scripts/opus-sf/routes-qa.mjs, docs/opus-bay/kit-jobs/**, tests/opus-bay-sf-{landmarks,models,kit-swap,routes,landmark-context}.test.ts.
- E2 (movement, camera, vehicles, pelican): OB/actors/** EXCEPT OB/actors/platform.ts (F) and OB/actors/{npcs,residentLooks}.ts (G2); OB/core/input.ts, OB/core/terrain.ts (additive; the CS-4 eviction fix), OB/core/walkGraph.ts (additive edgeAccept), OB/data/vehicles.ts, OB/data/sf/rideSpots.ts, OB/ui/MoveChip.tsx (after day 0 extracts it), scripts/opus-sf/ride-spots.ts, public/opus-bay/models/pelican-glide.glb, tests/opus-bay-{actors,sf-move2,sf-modes,sf-vehicles,sf-nav}.test.ts.
- F (transit, life, audio): OB/game/{ride,transit}.ts, OB/data/transit.ts, OB/world/{streetcar,cablecar,ferry,rails,turntable,transitLine,transitLayer,life}.ts, OB/world/sf/{crowd,traffic}.ts, OB/actors/platform.ts, OB/audio/**, tests/opus-bay-{audio,sf-transit,sf-life}.test.ts.
- G1 (map, discovery, fast travel, save v2, HUD): OB/game/{fastTravel,discovery,travel,qa,cinema,resume,streets,Systems,flowStore}.ts(x), OB/data/{save,cityZones,wishlist}.ts, OB/data/sf/places.ts, OB/ui/{CityMap,cityMapDraw,MapPanel,Hud,CoachMark,TitleScreen,Overlay,Settings,Floating,icons,mapLabels,PlaceActions,Footprints,WeekPanel,common,hooks}.ts(x), OB/ui/city-ui.css, OB/opus-bay.css, OB/OpusBayPage.tsx, tests/opus-bay-sf-{citymap,discovery,places,save,travel}.test.ts.
- G2 (city content): OB/game/{flow,brain,content,interactables,photo,projector,cityContent,cityGoals,residentTasks,baybayLines}.ts, OB/data/{postcards,script,pois,tours,catalog,links,contentMode,VOICE.md}(.ts), OB/data/sf/{cityPois,copy,dialogue,goals,lines,postcards,residents}.ts, OB/actors/{npcs,residentLooks}.ts, OB/ui/{Journal,Moments,PoiCard,Dialogue,EventCard,format}.ts(x), OB/i18n.ts, tests/opus-bay-{content,flow-brain,flow-data,flow-logic,sf-content,sf-lines,sf-tasks}.test.ts.
- H2b (Higgsfield part 2b: painted map, voice barks, murals): OB/data/{mapPaper,murals,voiceLinesSf}.ts, OB/ui/{MapPaperLayer.tsx,mapPaper.ts}, OB/world/sf/murals.ts, scripts/opus-sf/{map,murals,voice}/**, public/opus-bay/{map,murals,voice}/**, public/opus-bay/README.md, docs/opus-bay/h2b/**, tests/opus-bay-h2b-assets.test.ts.
- FROZEN after day 0 (nobody edits in wave 2; a lane that needs a change writes it under "Requests" in its report): OB/core/{types,store,events,runtime,geo}.ts, OB/world/sf/format.ts, OB/data/district.ts, tests/opus-bay-sf-disk.ts, tests/opus-bay-sf-{format,data,geo,terrain}.test.ts, tests/opus-bay-district.test.ts, OB/ASSETS-LEDGER.md (append-only, lead only), OB/DESIGN.md, OB/STATUS.md, OB/RESUME.md, package.json, package-lock.json, vite.config.ts, everything outside the Opus Bay paths in CLOUD.md.
- Every lane also owns: its report docs/opus-bay/sf-w2-<LANE>.md and its credit ledger docs/opus-bay/ledger/w2-<LANE>.md (Higgsfield rows, same columns as ASSETS-LEDGER.md; the lead merges them later), and its QA images under docs/opus-bay/qa/w2/<LANE>/ (a few key JPEGs; scratch shots stay in /tmp).
- New files a lane creates are owned by that lane. A file not listed above: ask yourself which lane's subject it is; if unclear, it is frozen.

### 1.2 Files day 0 placed (new files and the ones the list above does not name)

| file | owner | what it is |
|---|---|---|
| `OB/game/systemsRegistry.ts` | **frozen** | per-frame / scene-component / click-proxy registry that `game/Systems.tsx` consumes (§5.4; `invalidateProxies` added by the day-0 review) |
| `tests/opus-bay-contracts.test.ts` | **frozen** | pins every day-0 hook (lanes test their fillings in their own files) |
| `docs/opus-bay/sf-w2-contracts.md` (this file), `docs/opus-bay/ledger/README.md` | lead | |
| `OB/game/transit.ts` | F | the ride section moved out of `flow.ts` + hooks (§5.2) |
| `OB/game/cityContent.ts`, `OB/data/sf/copy.ts` | G2 | stubs (§5.3, §5.5) |
| `OB/game/resume.ts`, `OB/game/fastTravel.ts`, `OB/data/save.ts`, `OB/data/cityZones.ts`, `OB/ui/Footprints.tsx` | G1 | stubs / moved code (§5.3, §5.5) |
| `OB/actors/moveApi.ts`, `OB/ui/MoveChip.tsx` | E2 | new API; MoveChip moved verbatim out of `Hud.tsx` |
| `OB/world/sf/l0index.ts` | D2 | per-building L0 index (implemented, §5.6) |
| `OB/world/sf/landmarks/context.ts` | D2 | D2-01 helpers other lanes code against: `landmarkTallStructures`, `sfLandmarkAnchor`, `landmarkPlazaSpots` (added by the day-0 review, §5.6) |
| `OB/data/{mapPaper,murals,voiceLinesSf}.ts`, `OB/ui/{mapPaper.ts,MapPaperLayer.tsx}`, `OB/world/sf/murals.ts` | H2b | stubs (§5.7) |
| `OB/actors/models.ts` | E2 | day 0 exported `NPC_BONES` for G2 (no other change) |

Not in the list, assigned by subject: `OB/game/ride.ts` F (listed), `OB/game/travel.ts` G1 (listed),
`OB/actors/view.ts` E2 (actors/**), `OB/data/sf/*` files not named → the lane whose subject it is (ask the lead if unclear).

---

## 2. Worktree, commit, push, ports

**Setup (once per lane)**

```bash
cd /home/user/baylink-web && git fetch origin opus-bay
git worktree add -B w2-<lane> /home/user/wt/<lane> origin/opus-bay      # lane = c2 d2 e2 f g1 g2 h2b
ln -s /home/user/baylink-web/node_modules /home/user/wt/<lane>/node_modules
```

Work only in your worktree. Never touch `main`, never merge, never open a PR.

**Ports** (dev server `npx vite --config vite.opus.config.ts --port <PORT> --strictPort`, background, kill it when done):

| day0 | C2 | D2 | E2 | F | G1 | G2 | H2b | verify |
|---|---|---|---|---|---|---|---|---|
| 5200 | 5201 | 5202 | 5203 | 5204 | 5205 | 5206 | 5207 | 5210 |

**Machine:** 4 CPUs, no GPU (WebGL via SwiftShader ≈ 3 fps; `renderer.info` calls / triangles / programs are valid,
fps is not; simulated time runs ≈ 0.3× real time at 3 fps, so wait long in scripted rides). Screenshots:
`/tmp/claude-0/bin/opus-shot <opus-shot.mjs args>` from your worktree root (holds one of two machine-wide Chrome slots).
CPU-heavy commands (vite build, full test suite): `/tmp/claude-0/bin/opus-heavy <cmd>`.

**Checks before every push**

```bash
npx tsc -p tsconfig.app.json --noEmit                                   # 0 errors
npx eslint src/opus-bay tests/opus-bay-*                                 # 0 problems
/tmp/claude-0/bin/opus-heavy npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts   # all green
```

`tests/opus-bay-hero-regression.test.ts` must stay green (district mode is bit-for-bit unchanged), and so must
`tests/opus-bay-contracts.test.ts`.

**Tests that pin another lane's module** (keep them green; if a legitimate change of yours breaks one, do not edit it:
write the exact test change under Requests in your report and tell the owner):

| test (owner) | pins (owner) |
|---|---|
| `opus-bay-world` (C2) | `world/streetcar.ts` `new Streetcars()` district loop, `world/life.ts` (F) |
| `opus-bay-flow-logic` (G2) | `game/ride.ts` `stepRide` / `sortedStops` + `finishRide` (F), `game/cinema.ts` (G1), `actors/view.ts` (E2) |
| `opus-bay-flow-brain` (G2) | `game/qa.ts` `readQa` / `bayTimeOfDay`, `game/cinema.ts` `cinemaActive` / `stepCinema`, `ui/format`, `ui/hooks`, `ui/mapLabels` (G1) |
| `opus-bay-sf-stream` (C2) | `world/sf/sites.ts` exclusions: Palace lagoon is ground, `sink`, city buildings dropped (D2) |
| `opus-bay-sf-nav` (E2), `opus-bay-sf-terrain` (frozen) | `world/sf/landmarks/index.ts`, `core/sfTerrain.ts` (D2): GGB deck at 15.2, City Hall blockers, terrain-based decks |
| `opus-bay-audio` (F) | `data/voiceLinesSf.ts` `SF_VOICE_UNMUTE` (H2b) |
| `opus-bay-hero-regression` (C2) | `world/recipes/city.ts`, `world/materials.ts`, `world/typedBatch.ts` (C2 itself) |
| `opus-bay-contracts` (frozen) | every day-0 hook: `TypedBatch.vert` / `toArrays` / `toGeometry` (C2), TOY ≡ `patchToyShader` (C2), the district F-line `rideLabel` text and `goalIdsFor('cable-car' \| 'ferry') = []` in district (F, G2), district residents (G2), `SF_KIT` (D2) |

**Commit and push** — small logical commits; every message ends with the two lines

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017LP25KtXJb4YSph7iMzg8X
```

then

```bash
git fetch origin opus-bay && git rebase origin/opus-bay
# if the rebase brought anything: re-run tsc + the tests
git push origin HEAD:opus-bay
```

On a non-fast-forward rejection, repeat fetch / rebase / push. On network errors retry up to 4 times (wait 2, 4, 8,
16 s). A rebase conflict in a file you do not own means someone broke the rule: stop and report it, do not resolve it
by editing their file.

---

## 3. Decisions

- **Ferry v1** = Ferry Building ↔ Pier 41, data-driven (a route table in `data/transit.ts`) so Sausalito on C2's Marin
  board can be added later.
- **Ride goals** count after one real stop-to-stop segment that is not fast travel (compare G1's `travelEpoch()` at
  boarding and at the stop). The 150 u odometer rule applies to city lines only; the hero F-line keeps today's rule.
- **Karl the Fog** on by default in the morning and at golden hour, thin enough that downtown reads from Twin Peaks;
  `?karl=0|1` (parsed in C2's `WorldScene.tsx`). District keeps `uKarl = 0`.
- **Painted Ladies row** uses the AI houses only if they pass D2's QA gate (D2-07), else stays procedural.
- **The site shell (HC-3) is not touched.**
- **Kit hide** uses per-building L0 index ranges (D2's `l0index.ts`, §5.6), not C2-12's OBB discard. C2 keeps its
  `build.ts` / `worker.ts` / `stream.ts` edits to the few lines day 0 landed; C2-12 is dropped.
- **AI GLB material** is D2-03 (`world/modelMaterial.ts`) on C2's exported shader helpers (§5.6); C2-11 is dropped.
- **Obstacles**: one mechanism, `registerObstacleSource` in `actors/view.ts` (not a `movers` array).
- **Hop-off brake** (E2-10 and F6 both named it; one owner per side, decided by the day-0 review): **E2 runs the rider
  side** (every input path: Space, pad B, F, the HUD's 提前下车 via `moveApi.requestHopOff`), **F runs the car side**
  (`platformStop`, the HUD `'braking'` stage). The handshake is in §5.2.
- **`platform.ts`** is F's; the E2-0 stop-request API is in it (§5.8).
- **Hero-life pause** (F13) is F's in `life.ts`, reading `cityStreamer()?.heroFar` / `onHeroFar`; C2 does not toggle
  `life.group`.
- **`sites.ts`** is D2's; it keeps the `CitySites` API that `stream.ts` calls and hosts the `SiteHooks` type.
- **`walkGraph.ts`**: E2 may add `edgeAccept?: (edge: number) => boolean` to `RouteSearchOptions` (additive).
- **`assets.ts`** is D2's. H2b never edits it: its tables are spread in from its own modules (§5.7).
- **HC-4** (Draco + WebP re-encode or preload of the 5 hero GLBs) goes to **D2**, who owns `public/opus-bay/models/**`
  and `assets.ts`; H2b may hand over re-encoded files through a request.
- **The ledger**: wave-2 rows go to `docs/opus-bay/ledger/w2-<lane>.md`; `ASSETS-LEDGER.md` is lead-only (§ note of
  2026-09-27 at its end; the CDN block noted in part 2a is lifted).

---

## 4. Event contract

`core/events.ts` (frozen). New members, all additive; every existing member is unchanged (`'streetcar-bell'` stays).

```ts
export type TransitKind = 'streetcar' | 'cable-car' | 'ferry';
export type TransitWhat = 'bell' | 'board' | 'depart' | 'arrive' | 'ride' | 'grip' | 'push' | 'turned' | 'horn' | 'hop-aside';

| { type: 'transit'; what: TransitWhat; line: string; kind: TransitKind; real?: boolean; strength?: number }
| { type: 'voice-line'; id: string }
| { type: 'vehicle:auto'; vehicle: 'bike' | 'car'; state: 'start' | 'arrive' | 'stuck' | 'cancel' }
| { type: 'travel'; what: 'start' | 'cloud' | 'land'; to: string }
| { type: 'discover'; id: string; kind: 'place' | 'zone' | 'landmark' }
```

**One `transit` member** covers F's sounds, G2's lines / goals and H2b's barks (the checkpoint's split
`transit:ride` / `transit:bell` is the same thing: `what: 'ride'` / `what: 'bell'`):

| `what` | emitted by (F) | meaning | listeners |
|---|---|---|---|
| `bell` | gripman / motorman bell, H on a cable car | `line` = transit line id (`move.line`) | audio (F), G2 first-bell line |
| `board` / `depart` / `arrive` | at a station | | audio, G2 |
| `ride` | the player finished one stop-to-stop segment | `real: true` = it counts (not travel mode, the odometer rule met); never emitted in travel mode | G2 cable-car goal, H2b/G2 first-ride line |
| `grip` / `push` / `turned` | cable grip clank; a push on a turntable; the car finished turning | | audio, G2 |
| `horn` | ferry horn | | audio |
| `hop-aside` | a crowd walker stepped out of a vehicle's way | | audio |

`strength` (0..1) is an optional intensity hint. `voice-line`: G2 emits it next to a voiced bubble (the bubble text
must start with the recorded phrase; the 60 s cooldown lives in G2); audio plays the clip or its chirp (§5.7).
`vehicle:auto` (E2 tap-to-drive), `travel` (G1 fast travel) and `discover` (G1 discovery) are optional hooks for audio
and lines; `stamp` / `arrive` / `area` keep their meanings.

Store (`core/store.ts`, frozen): `syncMovePatch` now sets `riding = 'streetcar'` whenever `move.mode === 'transit'`,
**whatever the line** (cable cars and the ferry lock the player like the F-line); a `riding: 'streetcar'` patch while
already in transit keeps the line. New code reads `move` (`{ mode, line, spot }`). No `runtime.ts` or `types.ts`
field was requested by any lane, so none was added.

`game/flowStore.ts` (G1): `ride: null | FlowRide` with
`FlowRide { stage: 'waiting' | 'riding' | 'braking' | 'turning'; from; to; eta?; line?: string; kind?: TransitKind }`
(absent `line` = the hero F-line), and `Cinematic` gains `'travel'`.

---

## 5. Hooks and stubs

Signatures are exact. "Day 0" says what the code does today. Callers listed are the lanes known to use it.

### 5.1 Game flow (`game/flow.ts`, owner G2)

| hook | signature | day 0 | callers |
|---|---|---|---|
| ride section moved | `boardStreetcar, rideTo, cancelRide, hopOffRide, finishRide` now live in `game/transit.ts`; `flow.ts` re-exports them | identical code | Hud, moveSystem, tests |
| `flow.ride.*` nodes | `openNode('flow.ride.<rest>')` → `transit.openRideNode(rest)` | `<from>><to>` → `rideTo` | F |
| station interaction | `performInteraction` action `'streetcar'` → `transit.boardFrom(it)` (any source, incl. `'transit'`) | `boardStreetcar(refId ?? nearest)` | F |
| goal keys | `type GoalKey = … \| 'cable-car' \| 'ferry'`; words `'cable-car': ['cable-car','cablecar']`, `ferry: ['ferry']` | no district goal matches them | F (`completeGoal('cable-car')` after a counted ride), G2 |
| `initFlowListeners()` | also calls `initCityContent()` (G2) and `initTransit()` (F); returns one disposer | both no-ops | Overlay boot (G1) |
| postcard counts | `collectPostcard` / `closePostcardReward` count via `activePostcardCount` / `allPostcardsFound` | same numbers in district | G2 |
| `nextFreeGoal()` | also offers `cityContent.goalTargets()` whose `goal` is not in `goalsDone` | none | G2 |

`completeGoal('cable-car')` marks `'cable-car'` done plus every `FREE_GOALS` id containing a word of the key. G2: if a
city goal id must not be completed that way, avoid those words (and the old ones: ride, view, hill, card, photo,
market, …); `goalKeyOf(id) === null` is G2's own test.

### 5.2 Transit (`game/transit.ts`, owner F)

```ts
boardStreetcar(stopId: string): void
rideTo(stopId: string, target: string): void
cancelRide(): void
hopOffRide(): void
finishRide(): void
boardFrom(it: Interactable): void                // flow's 'streetcar' action
openRideNode(rest: string): void                 // flow's `flow.ride.<rest>` dialogue nodes
stepTransit(dt: number): void                    // game/Systems.tsx Ticker, right after stepCinema (was inline stepRide)
requestHopOff(): void                            // immediate programmatic hop-off (QA, a trip start while riding); = hopOffRide()
rideLabel(ride: FlowRide): RideLabel             // HUD RideBanner; RideLabel { icon: 'tram'|'cable-car'|'ferry'; waiting; lineTo; dest }
transitInteractables(): Interactable[]           // day 0 []; F registers them in initTransit via registerInteractables
rideLog(): Record<string, number>                // rides per line id this visit, for G1's save v2; day 0 {}
initTransit(): () => void                        // once per page from flow.initFlowListeners; day 0 no-op
```

`transit.ts` imports `say, bubble, announce, playDialogue, defineNode, teleportPlayer, refreshLock, completeGoal`
from `flow.ts` (a module cycle that is safe: neither side uses the other at load time; keep it that way). F calls
G1's `noteRide(lineId)` (`data/save.ts`) after a counted ride and compares G1's `travelEpoch()` (`game/fastTravel.ts`).

More of F's surface that other lanes already read (added by the day-0 review; the code is unchanged):

- **`currentRide(): RideState | null`** (`game/ride.ts`, F) is what E2's `moveSystem` keys the transit input and the
  rider placement on (`moveSystem.ts` ≈ l.360 and l.749: no ride → Space / B / the HUD button do nothing and the rider is
  not put on `platforms.get(move.line)`; `mode === 'wait'` = still at the stop). F keeps it answering for **every**
  line (cable car, ferry, city F-line) with `mode: 'wait'` until the car is at the stop and `elapsed` counting, and
  keeps `hopOffRide()` / `cancelRide()` working for every line, so E2's consumer needs no new API. `stepRide`,
  `sortedStops`, `MAX_WAIT`, `virtualT` keep their district behaviour (`world/streetcar.ts`, flow-logic test).
- **`boardFrom(it)`** receives every interactable whose action is `'streetcar'`, whatever its source or id.
  `InteractionKind` (`core/types.ts`) is frozen, so non-boarding station actions (the F4 turntable push by E, a ferry
  gangway) are registered with `action: 'streetcar'` and their own `verb`, and F dispatches them in `boardFrom` by id
  prefix or `refId`. (The HUD prompt icon for them is G1's: see §6.)
- **Hop-off handshake** (§3). One path for every input: Space / pad B / F in the car and the HUD's 提前下车
  (`moveApi.requestHopOff()` → `input.hopOffCount`) all reach E2's `moveSystem` transit branch.
  1. Waiting at the stop → `cancelRide()` at once (unchanged).
  2. Moving → E2 calls `requestPlatformStop(move.line, 1.2)` and enters its `'braking'` phase (E2-10). F's car
     honours `platformStop(id)` (brake to 0 within `within` s, hold), and F's `stepTransit` shows
     `flow.ride.stage = 'braking'` while a stop is pending for the ride's line (F writes `flow.ride`; nobody else does,
     since `stepTransit` rewrites the stage every frame).
  3. Speed < ALIGHT or 1.2 s → E2 calls `hopOffRide()` (F: ends the ride, counts it, steps off beside the car), places
     the player at a clear door slot, then `releasePlatformStop(move.line)`. F's `hopOffRide` / `finishRide` /
     `cancelRide` also release any stop pending on the ride's line, so a 直接到站 during the brake never leaves a car
     holding forever.
  `transit.requestHopOff()` is **not** part of this path: it is the immediate hop-off for code that is not the rider
  (QA, G1 starting a trip while riding) and stays `hopOffRide()` plus the release.

### 5.3 Interactables, brain, content (`game/interactables.ts`, `game/brain.ts`: G2; `data/cityZones.ts`: G1)

```ts
// interactables.ts
type InteractableSource = … | 'transit' | 'place'
registerInteractables(key: string, fn: () => Interactable[]): () => void   // appended after the built-ins, duplicate ids skipped
invalidateInteractables(): void                                            // a source's content changed → rebuild
subscribeInteractables(fn): () => void; interactablesEpoch(): number        // game/Systems.tsx rebuilds its list on change
setExtraResolver(fn: ((id: string) => Interactable | undefined) | null)    // G1: `place:<id>` → {source:'place', action:'info', radius:12,…}
registerSubjectResolver(fn: (subject: string) => {x,y,z} | null): () => void  // G2: telescope subjects (after the district ones)
```

- F: city stations as `{ id: 'transit-<stationId>', source: 'transit', action: 'streetcar', refId: stationId }`.
- G2: residents as `source: 'npc'` with `npc: <key>` (flow's `talkToNpc`), registered from `initCityContent`.
- G1: resolved places are **not** in `interactables()` (no E prompt); `objectiveTarget`, `navigateTo`, the waypoint,
  the beacon and brain's `mapTarget` clear all go through `interactableById`, so they work for `place:<id>`.

```ts
// brain.ts
registerFocusHook(key: string, hook: { tick?(p: Vec2, now: number): void; area?(id: string | null): void }): () => void
export { AREA_NAMES }   // moved to data/cityZones.ts, re-exported
// data/cityZones.ts (G1)
AREA_NAMES: Map<string, Bilingual>
cityAreaAt(x: number, z: number): { id: string; name: Bilingual } | null   // brain's city-mode area lookup; day 0 = zoneAt
```

`tick` runs at 10 Hz **before** brain's "blocked" early return (also while riding / gliding / in dialogue: throttle
and skip travel yourself); `area` runs when the area label changes. G1's `updateDiscovery`, `visitZone` and the
street-name tick register here (from G1's own boot code, e.g. `Overlay` or `Systems`). Lane E's wave-1 request 1
(bike / car / glide / travel count as riding for the guide brain) was already in the code (`updateGuide`'s `carried`).

```ts
// game/cityContent.ts (G2) — stub
initCityContent(): () => void                      // both world modes; return early in district
goalTargets(): GoalTarget[]                         // { id; goal; x; z; name; radius? } — id must resolve via interactableById
// data/postcards.ts (G2)
activePostcardCount(collected: readonly string[]): number
activePostcardTotal(): number
allPostcardsFound(collected: readonly string[]): boolean
```

### 5.4 Canvas systems (`game/systemsRegistry.ts`, frozen; consumed by G1's `game/Systems.tsx`)

```ts
registerFrameSystem(key: string, step: (dt: number, now: number) => void, order = 0): () => void
registerSceneSystem(key: string, Component: React.ComponentType): () => void   // mounted inside <Systems/> (R3F)
registerProxySource(fn: (it: Interactable) => {x,y,z,r}[] | null): () => void   // extra click spheres (e.g. an SF landmark body)
invalidateProxies(): void                                                       // a source's answers changed → Systems re-asks (review)
```

Frame steps run every frame in the Ticker after `stepTransit` and the input edges, before the 10 Hz focus / guide
brain (dt clamped to 0.1 s, `now` = `performance.now()`); a throwing step is logged and skipped. Re-registering a key
replaces it. `Systems.tsx` also re-samples, **in city mode only**, the ground height of click proxies and postcard
glints within 200 u of the player once a second (G2's cards on hills; district unchanged). `QaBridge` stays G1's.
World-side systems use `getWorld().addSystem` (§5.6) instead. Register from your own init code (`initCityContent`,
`initTransit`, a lane boot hook), not as a side effect of importing a data module: node tests import those modules.
Sources whose content changes call `invalidateInteractables()` / `invalidateProxies()` (E2's pooled city bikes and
benches through `vehicleSpots()` / `seatSpots()` included).

### 5.5 UI (`ui/Hud.tsx`, `TitleScreen.tsx`, `Overlay.tsx`, `Footprints.tsx`: G1; `MoveChip.tsx`: E2; `Journal.tsx`: G2)

| hook | where | day 0 |
|---|---|---|
| `<MoveChip />` | `ui/MoveChip.tsx` (E2) with `Hint` and the 3 style objects, moved verbatim | Hud renders it |
| RideBanner | `rideLabel(ride)` from `game/transit.ts` (F); icon `Ship` for `'ferry'`, `CableCar` for `'cable-car'`, else `TramFront` | the old F-line strings exactly |
| "提前下车" | calls `requestHopOff()` from `actors/moveApi.ts` (E2) → `input.hopOffCount++` → moveSystem hops off like Space / pad B | the button now takes the Space path |
| objective pill | `activePostcardCount(s.postcards)` / `activePostcardTotal()` | same in district |
| title subtitle | `CITY_COPY.titleSub` from `data/sf/copy.ts` (G2, dependency-free) in city mode, else the district line | `titleSub: null` |
| start | `Overlay` calls `startOrResume()` from `game/resume.ts` (G1) | = `startGame()` |
| 足迹 tab | `Journal` adds a tab when `FOOTPRINTS_TAB` (from `ui/Footprints.tsx`, G1) is set and renders `<Footprints />` | `null`, no tab |
| G1 save / resume | `data/save.ts`: `readSave(): SaveV2 \| null`, `noteRide(lineId)`, `requestResume()`, `takeResumeRequest(): boolean` | null / no-ops; dependency-free (the title imports it) |
| G1 fast travel | `game/fastTravel.ts`: `travelActive(): boolean`, `travelEpoch(): number`, `travelPose(): TravelPose \| null` with `TravelPose { phase: 'pickup' \| 'rise' \| 'pan' \| 'hold' \| 'descent'; t /* 0..1 in the phase */; x; y; z; heading }` | false / 0 / null |

Never import three.js (or `data/script.ts`, `game/*`) into the title chunk (`OpusBayPage` → `TitleScreen`):
`data/sf/copy.ts`, `data/save.ts`, `data/assets.ts` and the H2b data modules stay dependency-free.

### 5.6 World side (C2 files carry the hooks; D2 / F / H2b plug in)

```ts
// world/materials.ts (C2) — exported, stable
COMMON_VERT_PARS: string; COMMON_FRAG_PARS: string; TOY_FRAG: string
patchCommonVertex(shader, sway: boolean): void
patchToyShader(shader, { sway: boolean; hero?: { value: number } }): void   // the whole TOY patch; with hero, define OB_HERO
U                                                                            // shared uniforms (already exported)
// world/warmup.ts (C2)
registerWarmup(key: string, make: () => { objects: THREE.Object3D[]; dispose?(): void }): () => void
// world/world.ts (C2)
interface WorldSystem { name: string; group?: THREE.Object3D; update?(dt, t, camera, night: number): void; dispose?(): void }
getWorld().addSystem(sys: WorldSystem): () => void     // group under the world root; update after life, before fx
// world/sf/stream.ts (C2) — CityStreamer, via cityStreamer()
get heroFar(): boolean
onHeroFar(fn: (far: boolean) => void): () => void
forEachL0Building(x: number, z: number, r: number, fn: (cellKey: number, k: number, b: L0BuildingView) => void): void
setL0BuildingHidden(cellKey: number, k: number, hidden: boolean): boolean
onL0Drop(fn: (cellKey: number) => void): () => void    // before a cell's L0 meshes are dropped (release its swaps)
// world/sf/sites.ts (D2) — type read structurally by C2
interface SiteHooks { lights?: {x,y,z,size,color}[]; mount?(group: THREE.Group, baseY: number): void | (() => void); plaza?: {poly, surface}[] }
CitySites.siteLights(): {x,y,z,size,color}[]          // world-space lights of every landmark (C2's light field)
// world/sf/landmarks/context.ts (D2) — declarative (no loader / material imports: moveSystem and node tests import it)
landmarkTallStructures(baseOf: (l: SfLandmark) => number): { id; x; z; r; top }[]   // glide obstacles, world space
sfLandmarkAnchor(id: string): { x: number; z: number; heading: number } | null      // world arrival spot (heading = world yaw)
landmarkPlazaSpots(): { id: string; x: number; z: number }[]                         // crowd / prop spots on plazas; day 0 []
```

`landmarkTallStructures` is already what E2's `moveSystem` glide uses in city mode (the review moved moveSystem's own
list there verbatim, so D2-10's better radii and tops reach the glide without an E2 edit). `sfLandmarkAnchor` is the
D2-12 export G1 (`?at=lm-<id>`, fast travel) and G2 (card positions) read. D2 adds the registry fields themselves
(`swap?`, `dress?`, `tall?`, `WalkBlocker.top?`) in its own files; nobody else reads them directly.

- **TOY ≡ `patchToyShader`.** `TOY`'s `onBeforeCompile` must stay exactly `patchToyShader(shader, { sway: true })` (the
  frozen contract test compares the two shader strings). C2 therefore puts every new TOY-wide shader feature (Karl the
  Fog's `patchFog`, the C2-10 tier fade) **inside** `patchToyShader`, and D2's model material, which calls it, inherits
  them; D2 must not apply the same patch a second time. Features for other materials (GROUND, water, hero) stay
  C2-internal.
- **`CityStreamer` public members stay stable** (C2): `cityStreamer()`, `far`, `manifest`, `whenReady(p, r)`,
  `focusOverride`, `heroFar` / `onHeroFar`, `stats()`, the L0 building API above. G1 (map, fast travel, resume, streets),
  D2, F and H2b read them.
- **Landmark LOD by camera height** (C2-5 "Sites") is D2's, in `sites.ts` (checkpoint §5.1). `sites.update(fx, fz, t)`
  has no camera argument and needs none: read the camera from `U.uCam.value` (`world/materials.ts`, written by
  `World.update` before the streamer updates) and the ground under it with `heightAt`.
- `registerWarmup`: the objects must match the real ones (material, mesh type, instancing / batching, cast /
  receive shadow, defines). Register at module load of a module that is imported before the world mounts (D2: from
  `sites.ts` → `modelMaterial.ts`); the warm-up runs ~250 ms after mount and again after a quality change.
- `SiteHooks.mount` is already called by `CitySites.buildMesh` (and its unmount by `dropMesh`).
- `l0index.ts` (D2, worker-safe, implemented): `buildL0` records each building with
  `rec.begin(t); toyBuildingL0(t, spec); rec.end(t, l0Desc(set, i, spec, ctx.height))` and returns
  `L0Result.buildings: L0Buildings | null` (osmId f64, index ranges, and per building: OBB centre / half sizes / yaw,
  front yaw, baseY, H, the wall colour the recipe drew (`cityLook`), footprint ground slope, style / roof / flag codes);
  the worker transfers its buffers; the hide swaps a range to degenerate triangles and restores the saved copy
  (`setRangeHidden`, update range only). Zone ids are not in the descriptor: use `zoneAt` on the main thread.
- H2b's murals attach through `world/sf/murals.ts attachMurals(streamer: CityStreamer): WorldSystem | null`, which
  `World.enableCity` calls once and adds (day 0: null); `disableCity` removes it again (review fix).
- F's world entry stays `Streetcars` (`world/streetcar.ts`), which `world.ts` already constructs and updates; it can
  also `addSystem`.

### 5.7 Audio and assets (audio: F; assets.ts: D2; data modules: H2b)

```ts
// audio/voice.ts (F)
VoicePlayer.line(id: string, fallback: ChirpKind = 'hi'): void   // plays `<lang>-<id>`
VoicePlayer.preloadLines(): Promise<void>                         // city mode, after preload()
LINE_WAIT = 0.7                                                   // s to wait for a clip still loading
MUTED_CLIPS = { zh-yay, zh-think, zh-arrived } minus SF_VOICE_UNMUTE
// audio/audio.ts (F)
case 'voice-line': voice.line(ev.id, SF_VOICE_LINES[ev.id]?.fallback ?? 'hi')
// data/voiceLinesSf.ts (H2b) — empty today
SF_VOICE_LINES: Record<lineId, { zh; en; mood?; fallback: ChirpKind }>
SF_VOICE_CLIPS: Record<clipId, VoiceClip>       // clipId = `<lang>-<lineId>`, may override a district clip (a re-record)
SF_VOICE_UNMUTE: readonly string[]              // re-records the owner approved by ear
```

`line()` bypasses CLIP_GAP, keeps SAME_CLIP_GAP (25 s per clip), waits up to LINE_WAIT for a loading clip, else plays
the chirp (3 s chirp limiter); the voice bus handles volume / mute. The id check is `ASSETS.voice`, which now
includes `SF_VOICE_CLIPS` (`{...VOICE_CLIPS, ...SF_VOICE_CLIPS}`), so a line plays only when H2b lists its clip.
QA: `window.__opusAudio.stats().counts['voice-clip:<clipId>']`.

`data/assets.ts` (D2 from now on):
- `SF_KIT_IDS` (11) and `SF_KIT: Record<SfKitId, SfKitAsset>` — `url`, `mask` (G = walls tint region, R = night
  glass), `tint: 'walls'`, `draco: true`, `kind: 'house'`, `size` (ledger part 2a table), `triangles`, `bytes`,
  `tintKey` (graded wall key colour from `kit-jobs/specs.json`, null for mission-mural / deco-apartment), `styles`
  (recipe styles it may replace), `corner?`, `shop?`. In `ASSETS.models` and `listAssetUrls()`.
- `listAssetUrls()` also spreads `SF_VOICE_CLIPS` files, `mapPaperUrls()` (`data/mapPaper.ts`) and `muralUrls()`
  (`data/murals.ts`), so H2b never edits `assets.ts`.
- `SF_MODELS.landmarkId` still uses sf-data ids (D2-04 fixes it).

H2b stubs: `data/mapPaper.ts` (`MAP_FRAME = {minX: -1575, maxX: 1505, minZ: -972, maxZ: 2108}`,
`MAP_PAPER: MapPaper | null = null`, `mapPaperUrls()`), `data/murals.ts` (`MURALS = []`, `MURAL_ATLAS = null`,
`muralUrls()`), `ui/mapPaper.ts` (`loadMapPaper(width): Promise<HTMLImageElement | null>`,
`drawMapPaper(ctx, img, toPx, frame?)`), `ui/MapPaperLayer.tsx` (`<MapPaperLayer width? />`: an SVG `<image>` at
the paper's world bounds, null without paper). **G1** renders `<MapPaperLayer />` inside its world-space city map SVG
(or calls `loadMapPaper` / `drawMapPaper` on a canvas map) under the vector layers.

### 5.8 Actors (E2 files; `platform.ts`: F; `npcs.ts`: G2)

```ts
// actors/moveApi.ts (E2) — bound by the ActorSystem (bindMoveApi), safe before the bind
driveTo(p: Vec2): boolean            // day 0 false (E2-4 tap-to-drive; G1's 骑车去 / 开车去)
cancelDrive(): void
requestHopOff(): void                // input.hopOffCount++
toFoot(): void
fleetSnapshot(): FleetSnapshot       // { bike?: {id,x,z,heading}; car?: {x,z,heading} }; day 0 {}
restoreFleet(s: FleetSnapshot): void // day 0 no-op
glideUnlocked(): boolean
isRiding(): boolean
// core/input.ts (E2)
input.hopOffCount: number            // consumed by moveSystem in a transit car exactly like Space / pad B
// actors/platform.ts (F) — E2-0 stop requests
requestPlatformStop(id: string, seconds = 1.2): void
platformStop(id: string): { within: number; since: number; hold: boolean } | null   // brake to 0 within `within` s
releasePlatformStop(id: string): void
// optional Platform / pose fields (types only; F fills them, E2 reads them with defaults)
PlatformPose.pitch?: number; Platform.kind?: TransitKind; railLeft? / railRight?: PlatformSpot;
hangLean?: number; railMirror?: boolean; decks?: DeckRect[]
// actors/view.ts (E2)
registerObstacleSource(fn: (out: Obstacle[], x: number, z: number, r: number) => void): () => void
collectObstacles(out, x, z, r): void   // actors/system.ts adds them to the walker's soft obstacles (r = 8)
// actors/npcs.ts (G2)
NpcDef.at?: { x: number; z: number; heading?: number }   // explicit spot; district promenade helpers skipped
NpcDef.talks?: boolean                                   // false = never the talking resident (the kid)
npcDefsFor(mode: WorldMode): NpcDef[]                    // day 0 = NPC_DEFS; G2 adds CITY_NPC_DEFS in city mode
// actors/models.ts (E2)
NPC_BONES: readonly BoneDef[]                            // the resident skeleton the 'npc' Animator drives
```

`actors/system.ts` spawns `npcDefsFor(worldMode)` filtered by `def.at || DISTRICT.anchors[def.anchor]`, derives the
talking set from the spawned defs (`talks !== false`; district: vendor, fisher, family, operator, jogger), and
`nearestNpcId` only picks a resident within 7 u (inside the ~12 u asked for). The movement-system consumers of the
platform fields (pitch in the seat, the ferry deck spot, the braked hop-off, obstacle sources in `giveWay`) are E2's.

---

## 6. Cross-lane requests already known

Put these in your brief; if you depend on one, say so in your report.

| from → to | request |
|---|---|
| E2 → F | `world/streetcar.ts` and the cable cars honour `platformStop(id)` (brake to 0 within 1.2 s, hold, resume on release); cable-car platform ids equal `move.line`; `currentRide()` answers for every line; `stepTransit` shows `'braking'` while a stop is pending; `hopOffRide` / `finishRide` / `cancelRide` release it (§5.2 handshake) |
| F → E2 | consume `pitch`, `kind`, `railMirror` / running boards, the ferry `'deck'` spot, the rider side of the hop-off handshake (E2-10: `requestPlatformStop` → brake → `hopOffRide()` → door slot → `releasePlatformStop`, §5.2) and obstacle sources in `giveWay`; the ride camera looks up `platforms.get(move.line)` |
| G1 → E2 | long click-to-walk (`routeTo` + RouteWalker beyond 150 u); pose pelican / rider / BAYBAY from `travelPose()` in travel mode; `restoreFleet` |
| D2 → E2 | ~~switch `moveSystem` city tall structures to D2's `landmarkTallStructures()`~~ done by the day-0 review (`moveSystem.cityTallStructures` calls it) |
| D2 → G1 | `?at=lm-<id>` via `sfLandmarkAnchor(id)` (`world/sf/landmarks/context.ts`) in `qa.ts` / QaBridge, on the city `whenReady` + `arrivalSpot` path (G1-12) |
| G2 → G1 | `?at=` accepts `:` ids (e.g. `postcard:sf-painted-ladies`) |
| G2 → D2 | zh glossary in `data/sf/landmarks.ts` (双峰 not 双子峰…) and the month-tagged cable-car guide link (or G2 overrides them in `cityPois.ts`) |
| F → G1 | transit icons / lines on the city map from `data/transit.ts` (read-only import); `rideLog()` into save v2; the E-prompt icon for `source: 'transit'` stations by line kind (`ui/icons.tsx` `InteractIcon`: a cable-car / ferry glyph instead of the tram; the kind is in F's `data/transit.ts` by `refId`) |
| G1 → G2 | `ui/PoiCard.tsx` accepts `openPanel('poi', 'sf:<placeId>')` and renders the SF landmark / place card from `sfLandmarkInfo` + G1's `data/sf/places.ts` (read-only import); until then G1's `PlaceActions` hides 详情 for non-POI places |
| F → D2 | (optional) a flag or export so `landmarks/cable-car-turntable.ts` can omit its static disc top when F's turning disc is present; Hyde & Beach and Taylor & Bay turntable sites (F otherwise draws its disc 0.005 u above the static one and the other two sites itself) |
| F → G2 | gripman / deckhand lines, `hookText('cablecarOff' / 'ferryOff')`, first-bell and turntable-push lines, city `FREE_GOALS` for `cable-car` / `ferry` (F falls back to inline lines) |
| H2b → G1 | mount `<MapPaperLayer />` (or `drawMapPaper`) in the city map, keep the ODbL credit |
| H2b → G2 | `emit({ type: 'voice-line', id })` next to each voiced bubble; bubble text starts with the recorded phrase |
| C2 → D2 | Karl the Fog reaches the model material through `patchToyShader` (§5.6: C2 keeps TOY ≡ `patchToyShader`, D2 does not patch fog again); landmark LOD0 radius by camera height in `sites.ts` (C2-5 "Sites", from `U.uCam.value`, §5.6) |
| C2 → E2, F | (optional) Karl on your own non-TOY materials (actors, crowd, cable cars if not TOY_INST): call C2's fog patch (C2 publishes its name and signature in its report) |
| C2 ↔ F | the high-view budget needs F13 (hero-life pause) |
| E2 → D2 | a `MODELS` entry for `pelican-glide.glb` if E2 wants it listed (else a local URL constant) |

---

## 7. What day 0 changed, and checks

Behaviour in district mode is unchanged, with one intended exception: the HUD's "提前下车" button now goes through
E2's hop-off request, i.e. the same path as Space / pad B (BAYBAY steps off beside you instead of hopping out), so
F's and E2's brake applies to every way of getting off. City mode additionally re-samples item heights near the
player (§5.4).

Checks at the day-0 commit (worktree `/home/user/wt/day0`):
- `tsc` 0 errors, `eslint` 0 problems, 209/209 opus-bay tests (200 + 9 new contract tests), hero regression green.
- District `?start=free&time=golden` at the ferry gate, before / after: same frame, `renderer.info` 58 calls /
  190,355 triangles / 90 programs in both (one after-sample read 59 / 190,373 for a frame, then 58 / 190,355 again:
  a transient effect, the steady state is identical).
- City `?start=free&world=city`: renders and streams (status streaming, 3 L0 + 16 L1 cells at the gate).
- Scripted F-line ride: boards, the banner reads "F-line · to Green St · Exploratorium", the 提前下车 button hops off
  and counts the streetcar goal.
- Production build: GameRoot 295,079 B gzip (was 293,086), OpusBayPage (title) 16,791 (was 16,250; the SF_KIT table in
  `assets.ts`), worker 57,624 (was 56,950). No three.js in the title chunk.

---

## 8. Day-0 review (2026-09-27)

An adversarial review of the day-0 commits (`c7068d9..06069e9`) re-ran every check and closed the gaps below. Every
item is in the sections above; this is the list.

**Verified, unchanged**
- District: hero regression 11/11; the `?start=free&time=golden&quality=high` ferry-gate frame at 960×600 is the same
  at `c7068d9` and after day 0 (pixel differences only on animated things: sailboat, gull, idle poses) with identical
  `renderer.info` in three samples each: **76 calls / 228,982 triangles / 44 programs** (the numbers of the checkpoint's
  district table; the day-0 note's 58 / 190,355 / 90 was an auto-quality run).
- The one district behaviour change is the intended HUD 提前下车 path: a scripted F-line hop-off at `c7068d9` and after
  puts the player on the same spot (132.8, 16.8), ends the ride and frees the player; only BAYBAY's placement differs
  (beside you instead of hopping out), as §7 says.
- City `?start=free&world=city`: streams (0 errors, 74 calls at the gate) and the L0 building API answers live
  (`forEachL0Building` found buildings, `setL0BuildingHidden` hid and restored one).
- The ownership table has no file claimed twice and no source or test file without an owner (checked by expanding the
  globs over `git ls-files`; only `scripts/opus-sf/{build,publish}.ts`, `lib/**` and `fetch/**` are unowned → frozen).

**Fixed**
- The frozen contract test pinned things lanes are meant to change: `Object.keys(ASSETS.voice).length === 10` (would
  fail on H2b's first clip), empty registries (would fail once a lane registers from import-time code), the identity of
  `NPC_DEFS`, and G2's goal-word order. It now checks the contracts themselves (the voice merge, relative registry
  counts with ids no lane uses, the district resident ids).
- D2-01 was a day-0 item that had not landed: `world/sf/landmarks/context.ts` now has `landmarkTallStructures`,
  `sfLandmarkAnchor`, `landmarkPlazaSpots`; `moveSystem`'s city glide list moved there verbatim (closes the D2 → E2
  request).
- `systemsRegistry.invalidateProxies()` (frozen file: a proxy source whose answers change had no way to say so).
- `World.disableCity` now removes the murals system `enableCity` added.
- RideBanner draws `CableCar` for `icon: 'cable-car'` (the contract returned it; the HUD drew a tram).
- Contract gaps written down: the hop-off handshake and brake ownership (§3, §5.2; `transit.requestHopOff` is not the
  rider path), `currentRide()` must answer for every line (§5.2), `boardFrom` receives every `'streetcar'` action
  (§5.2), TOY ≡ `patchToyShader` (§5.6), the stable `CityStreamer` members (§5.6), landmark LOD by camera height is
  D2's (§5.6), `TravelPose` (§5.5), cross-lane test pins (§2), and the §6 rows G1 → G2 (PoiCard `sf:`), F → G1 (station
  prompt icons), F → D2 (turntable disc, optional), C2 → E2 / F (Karl on own materials, optional).
