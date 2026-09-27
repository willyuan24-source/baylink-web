# Wave 4 · lead note (day 0): early phase, ownership, protocol, the frozen types

Written on 2026-09-27 by the lead's day-0 agent. **Read this first**, then `sf-w4-plan.md` (your lane's §5.x and every
section it points to), `sf-w3-lead.md` §3 (checks, commits, pushes: unchanged) and `sf-w2-contracts.md` §2 (the table
of tests that pin another lane's module). Where this note and the plan differ, **this note wins** (the ports of plan
§5.0 are replaced by §3 below).

## 0. 给主人的摘要

1. 第四波"第 0 天"的底层约定已经推上去了：新增巴士 / 轻轨两种线路类型、"抵达时刻"和"行程"两种事件、导览编号（默认还是湾区第一课）、行程和景点两套共用类型。街区模式完全不变，全部 388 个测试通过。
2. 第三波还在收尾，所以第四波 6 条线现在只**新建文件**（不改任何已有文件）；等第三波验收完，再进入"接线"阶段把新东西接进游戏。
3. Higgsfield 余额 455.58（10:03），第四波上限仍是 120 分，只有 V 线花钱，至少留 50 给最后打磨。

## 1. State at day 0

- `opus-bay` @ `36ebe2c` (W4-0a / W4-0b) + the commit that adds this note. tsc 0, eslint 0, **388 / 388** opus-bay tests
  (the full suite run in parallel with the six wave-3 lanes can fail the wall-clock asserts in `opus-bay-audio` "P1 sliced
  jobs" and `opus-bay-sf-citymap` "draw … fast" under load; both pass when re-run: re-run before you blame your change).
- **Wave 3 is still running**: C2, D2, E2, F, G1, G2 in `C:/Users/willy/wt/<lane>` on ports 5201–5207, pushing to
  `opus-bay` all the time. Their files are theirs until the lead announces "wave 3 verified" (§2).
- Higgsfield balance **455.58** credits (checked 2026-09-27 10:03 PDT; the plan assumed ≈ 170 because wave 3 is still
  spending). The wave-4 cap stays **120** (plan §6), lane V only.

## 2. The early phase (read twice)

**Until the lead announces "wave 3 verified"** (a commit that changes this section, relayed to you), wave-4 lanes
**only create new files**:

- Allowed: the new files plan §5.1 lists for your lane ("new files it creates") and other new files inside your
  subject; your report, ledger and QA folder; scratch under `C:/Users/willy/opus-qa/w4/<lane>/`.
- **Not allowed: editing any existing file**, even one plan §5.1 gives you: in wave 3 it still belongs to a wave-3 lane.
  That includes the data files (`public/opus-bay/sf/v1/transit.json`, `places.json`), registries
  (`world/sf/landmarks/index.ts`, `world/sf/sites.ts`), mounts (`GameRoot.tsx`, `Hud.tsx`, `CityMap.tsx`), stores
  (`game/flowStore.ts`), scripts (`scripts/opus-sf/lib/*.ts`) and every existing test.
- So: build your modules against the frozen types (§4) and today's APIs, unit-test them in **new** test files, and keep
  a section **"Integration"** in your report with the exact wiring steps (file · function · what to add · which test
  changes on purpose). New files are not imported by existing code yet, so they change nothing at runtime; they are
  still under `src/` and must pass tsc, eslint and the full suite.
- **Integration phase** (after the announcement): the lead first lands the deferred frozen items of §6; then each lane
  wires its modules into the existing files it owns per plan §5.1 (inherited ones included), updates the tests it
  inherits on purpose (plan R14), and pushes in small commits.

What each lane can finish in the early phase:

| lane | early phase (new files only) | waits for the integration phase |
|---|---|---|
| **P** | `data/sf/attractions.ts` + `extraPlaces.ts` (push early: L, G, C use the ids), `ui/mapLines.ts`, `ui/{MapLegend,MapFilters,TripOptions,StationActions}.tsx` as prop-driven components, `scripts/opus-sf/places-sidecar.ts` (writes to scratch until then), `tests/opus-bay-sf-attractions.test.ts`; the label-bug fix (P1) as a ready patch + its regression test in scratch (G1 may fix it in wave 3: then "verify and keep") | CityMap / cityMapDraw / MapPanel / PlaceActions wiring, name fixes and re-anchors in `places.ts`, `poiKind` in `lib/places.ts`, the places.json rebuild, the inherited tests |
| **T** | `data/sf/stationNames.ts` first (**stable station ids** + zh glosses: P and C code against them), `scripts/opus-sf/lib/busLoop.ts`, `transit-sidecar.ts` (own N / M specs; output to scratch), `world/{busSystem,lightRail}.ts`, `world/sf/{tourBus,lrv,stations,portals}.ts`, `ui/SubwayOverlay.tsx`, `ui/transit-ui.css`, `tests/opus-bay-sf-{bus,metro}.test.ts` | publishing transit.json (the frozen `sf-data` test already accepts the three new lines), `data/transit.ts`, `ride.ts` / `game/transit.ts` / `transitLayer.ts` wiring, `LINES` in `lib/transit.ts`, `sf-transit` |
| **L** | one module per new site under `world/sf/landmarks/` (not registered), plaza-kit helpers and the site flag tops in new files (re-exported from `context.ts` at integration), `scripts/opus-sf/sites-qa.mjs`, `tests/opus-bay-sf-sites-w4.test.ts` testing the modules directly | registration in `landmarks/index.ts` / `sites.ts`, per-site `lod0R`, `placeId` on the records, `siteFlagTop` in `context.ts`, `sfTerrain.ts`, inherited tests |
| **G** | `game/tripPlan.ts` first (pure, injected providers), `game/flags.ts` (`pickFlags`, pure), `world/sf/flags.ts` (not mounted), `actors/reveal.ts`, `ui/{TripPill,ArrivalCard,PanoramaTags}.tsx`, `ui/guide-ui.css`, pure waypoint-layout helpers in a new file, `tests/opus-bay-sf-{trip,flags,waypoint}.test.ts` | Hud / Overlay / Systems / camera / moveSystem wiring, the waypoint changes, the Settings toggle, warm-up registration |
| **C** | `data/sf/{placeCards,placeCards2,tours,tourLines}.ts` (freeze `tourLines` with a tag for V), `game/arrival.ts`, `game/trips.ts` (the trip state machine on `TripState`: pure reducers or a module-local store until `flow.trip` lands), `ui/TourRecap.tsx`, `tests/opus-bay-sf-{tours,cards}.test.ts` | `flow.ts` / `brain.ts` wiring (objectiveTarget priority, startFreeLead as a trip), the tour-engine generalisation, `cityPois` join, goals, save v2 `tours`, welcome choice, `VOICE.md` glossary |
| **V** | the baseline perf table on the current head (running C2's `scripts/opus-sf/qa/perf/` is fine; your spots in the new `w4-spots.json`), Higgsfield preflight + ledger, reference sheets, AI meshes (`public/opus-bay/models/sf/w4-*.glb`), the T1 sticker sheet (`public/opus-bay/map/stickers-t1.*`), voice files for C's frozen `tourLines` (new files) | registration in `data/assets.ts` / `voiceLinesSf.ts`, warm-up registration, any C2 / H2b / D2 file |

## 3. Ownership, worktrees, ports, paths

- **Ownership = plan §5.1** (effective for existing files only from the integration phase). The frozen row now also
  holds `src/opus-bay/game/tripTypes.ts` and `src/opus-bay/data/sf/attractionTypes.ts` (§4). A file not listed: the
  lane whose subject it is; if unclear, frozen (write the change under Requests).
- **Worktrees** (made by the lead): `C:/Users/willy/wt/w4-<lane>` on branch `w4-<lane>` from `origin/opus-bay`, with
  `node_modules` as a junction to `C:/Users/willy/OneDrive/Desktop/baylink-web/node_modules` (another agent's
  checkout: **never** touch it, never `npm install` / `npm ci`). Never modify another worktree or
  `C:/Users/willy/baylink-opus` (the lead's checkout with its dev server).

| lane | worktree | early-phase port | scratch | report | ledger | QA images |
|---|---|---|---|---|---|---|
| P · places & map | `C:/Users/willy/wt/w4-p` | **5301** | `C:/Users/willy/opus-qa/w4/p/` | `docs/opus-bay/sf-w4-P.md` | `docs/opus-bay/ledger/w4-P.md` | `docs/opus-bay/qa/w4/P/` |
| T · transit lines | `C:/Users/willy/wt/w4-t` | **5302** | `…/w4/t/` | `sf-w4-T.md` | `ledger/w4-T.md` | `qa/w4/T/` |
| L · landmarks & streets | `C:/Users/willy/wt/w4-l` | **5303** | `…/w4/l/` | `sf-w4-L.md` | `ledger/w4-L.md` | `qa/w4/L/` |
| G · guidance, HUD, ride feel | `C:/Users/willy/wt/w4-g` | **5304** | `…/w4/g/` | `sf-w4-G.md` | `ledger/w4-G.md` | `qa/w4/G/` |
| C · content & tours | `C:/Users/willy/wt/w4-c` | **5305** | `…/w4/c/` | `sf-w4-C.md` | `ledger/w4-C.md` | `qa/w4/C/` |
| V · assets, voice, perf | `C:/Users/willy/wt/w4-v` | **5306** | `…/w4/v/` | `sf-w4-V.md` | `ledger/w4-V.md` | `qa/w4/V/` |

- Ports: wave-3 lanes use 5201–5207 and verify 5210; the lead's dev server is 5174 and the phone preview 4174: leave
  them all alone. Dev server: `npx vite --config vite.opus.config.ts --port <PORT> --strictPort` (background; kill it
  when you finish: PowerShell `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -like '*--port <PORT>*' | % { Stop-Process -Id $_.ProcessId -Force }`).
- The Bash tool's working directory resets between calls: start **every** command with `cd /c/Users/willy/wt/w4-<lane> && `;
  Read / Edit / Write paths are absolute under your worktree. Node / JSON paths are `C:/Users/...`, never `/c/Users/...`
  (in `tsx` scripts import absolute paths as `file:///C:/...`).
- Screenshots: `node scripts/opus-shot.mjs --url "http://localhost:<PORT>/opus-bay?world=city&..." --out C:/Users/willy/opus-qa/w4/<lane>/x.jpg`
  (`CHROME_FLAGS="--force_high_performance_gpu"` for the RTX; `--mobile --dpr 3` for 390 × 844 / 375 × 667). At most 2 of
  your own headless Chromes at a time. fps numbers only from lane V's gate runs and the lead's final verify.
  **Read every image before you describe it.** A few key JPEGs go to your QA folder; scratch stays in scratch.
- Scouting inputs (read-only): `C:/Users/willy/opus-qa/w4/{inventory-a,ne,geo,ux,plan}/` (plan header: `plan/loop-final.mts` =
  the measured 16-stop loop, `geo/final-lines.json` = the N / M geometry), the attraction data
  `docs/opus-bay/sf-w4-attractions.json`.

## 4. The frozen types added at day 0 (exact signatures)

Nobody but the lead edits these; if you need a change, write the exact change under Requests. Everything is additive:
all fields new at day 0 are optional unless stated, and no existing code needed an edit.

### 4.1 `src/opus-bay/core/events.ts`

```ts
export const TRANSIT_KINDS = ['streetcar', 'cable-car', 'ferry', 'bus', 'light-rail'] as const;
export type TransitKind = (typeof TRANSIT_KINDS)[number];
export const TRANSIT_WHATS = ['bell', 'board', 'depart', 'arrive', 'ride', 'grip', 'push', 'turned', 'horn', 'hop-aside', 'approach'] as const;
export type TransitWhat = (typeof TRANSIT_WHATS)[number];

// GameEvent members (new or widened):
| { type: 'transit'; what: TransitWhat; line: string; kind: TransitKind; real?: boolean; strength?: number; station?: string; attraction?: string }
| { type: 'arrival'; place: string; tier: 1 | 2 | 3; first: boolean; attraction?: string }
| { type: 'trip'; what: 'start' | 'leg' | 'end' | 'cancel'; place: string; mode: TripMode; leg?: number }
```

- `approach`: the ridden vehicle is ≈ 60 u before its next stop (loop narration, the 4 s look-at bias). `station` = the
  TransitStop id, `attraction` = the Attraction id the stop serves (T emits, C narrates, G biases the camera).
- `arrival` (C emits from `game/arrival.ts`, G shows, audio stamps): `tier` = the attraction's map rank; `first: false`
  on later arrivals (quiet, no reveal).
- `trip` (C emits): `leg` = the 0-based index of the leg that just started (`what: 'leg'`).

### 4.2 `src/opus-bay/world/sf/format.ts`

```ts
export interface TransitStop {
  id: string; name: { zh: string; en: string }; at: number; x: number; z: number; osmId: number | null;
  major?: boolean;          // transfers, ★ attraction stops, termini: light rail dwells; minor stops on request
  attractions?: string[];   // attraction ids served on foot, the main one first
}
export const TRANSIT_LINE_KINDS = ['cable-car', 'streetcar', 'bus', 'light-rail'] as const;
export type TransitLineKind = (typeof TRANSIT_LINE_KINDS)[number];
export interface TransitPortal { x: number; y: number; z: number; name?: { zh: string; en: string } }
export interface TransitTunnel {
  fromAt: number; toAt: number;                 // arc span along path, fromAt < toAt
  portalA: TransitPortal | null;                // null only when the span starts at the line start (N / M at Embarcadero)
  portalB: TransitPortal | null;                // null only when the span ends at the line end
  stations: string[];                           // stop ids inside the span, arc order (boarded at their kiosks)
  name?: { zh: string; en: string };
}
export interface TransitLine {
  id: string; kind: TransitLineKind; name: { zh: string; en: string };
  short?: string;            // 'N', 'M', '观光' (1–4 characters)
  loop?: boolean;            // one-way loop: the path ends where it starts (≤ 2 u), length = the full lap, `at` wraps; never doubleEnded
  tunnels?: TransitTunnel[]; // arc order, non-overlapping
  osmRelation: number; sourceUrl: string; color: string; path: number[]; length: number; stops: TransitStop[];
  turntables: { x: number; z: number; osmId: number | null; name: string }[]; doubleEnded: boolean; heroSpans: [number, number][];
}
export function tunnelAt(line: Pick<TransitLine, 'length' | 'loop' | 'tunnels'>, at: number): TransitTunnel | null;
export function transitLineProblems(l: TransitLine): string[];   // [] = valid; used by sf-data, sf-format and T's sidecar

export const SF_PLACE_KINDS_W4 = ['campus', 'shopping', 'zoo', 'religious'] as const;
export type SfPlaceKindW4 = (typeof SF_PLACE_KINDS_W4)[number];
export type SfPlaceKindAll = SfPlaceKind | SfPlaceKindW4;
```

`SfPlaceKind` itself is **not** widened yet (§6 item 2): type wave-4 place kinds as `SfPlaceKindAll` until the
integration phase; afterwards `SfPlaceKindAll` is the same type as `SfPlaceKind`, so the code keeps compiling.
(**Done** at the integration, `W4-I0a`, §8: `SfPlaceKind` now includes the four kinds.)

### 4.3 `src/opus-bay/core/store.ts`

```ts
tour: { active: boolean; stop: number; completed: string[]; id?: string };   // in GameState
export const DEFAULT_TOUR_ID = 'first-lesson';                                 // = data/tours.ts FIRST_TOUR.id
export const tourIdOf = (tour: GameState['tour']): string => tour.id ?? DEFAULT_TOUR_ID;
```

`id` is optional in the type so every existing writer compiles unchanged; the store's normalizer (`syncMovePatch`) fills
`DEFAULT_TOUR_ID` into any `tour` patch without an id, and the initial state has it, so at runtime `game.get().tour.id`
is always set (a spread `{ ...s.tour, … }` keeps it). City tours write their own id (`'sf-grand'`). Read with
`tourIdOf()`.

### 4.4 `src/opus-bay/game/tripTypes.ts` (new, frozen, dependency-free)

```ts
export const TRIP_MODES = ['walk', 'run', 'bike', 'car', 'line', 'fly'] as const;   // also the tie-break order
export type TripMode = (typeof TRIP_MODES)[number];
export const TRIP_MODE_NAMES: Readonly<Record<TripMode, Bilingual>>;               // 步行 跑过去 骑车 开车 坐车 飞过去
export interface TripPoint { x: number; z: number; place?: string; station?: string; vehicle?: string; name?: Bilingual }
export interface TripLegBase {
  from: TripPoint; to: TripPoint;
  seconds: number;      // honest, waits and mounting included
  length: number;       // route length (u); straight × 1.25 while unknown
  path?: number[];      // flat [x0, z0, x1, z1, …] for the map and the chevrons
  estimate?: boolean;   // true while the A* has not answered (计算中…)
  label?: Bilingual;
}
export interface TripWalkLeg extends TripLegBase { via: 'walk' | 'run' }
export interface TripDriveLeg extends TripLegBase { via: 'bike' | 'car'; vehicle: string }
export interface TripLineLeg extends TripLegBase {
  via: 'line'; line: string; board: string; alight: string;   // TransitLine id, TransitStop ids
  wait: number; stops: number; dir?: 1 | -1; underground?: boolean;
}
export interface TripFlyLeg extends TripLegBase { via: 'fly'; place: string }
export type TripLeg = TripWalkLeg | TripDriveLeg | TripLineLeg | TripFlyLeg;
export type TripLegVia = TripLeg['via'];
export interface TripOption { mode: TripMode; legs: TripLeg[]; seconds: number; note?: Bilingual; recommended?: boolean; goal?: string }
export type TripSource = 'map' | 'card' | 'call' | 'free-lead' | 'tour' | 'panorama' | 'qa';
export interface TripState {
  placeId: string; attraction?: string; option: TripOption;
  legs: TripLeg[];      // = option.legs
  leg: number;          // current leg index (legs.length = arrived)
  startedAt: number;    // performance.now() ms
  source?: TripSource;
}
```

### 4.5 `src/opus-bay/data/sf/attractionTypes.ts` (new, frozen, dependency-free)

```ts
export const ATTRACTION_RANKS = [1, 2, 3] as const;                 // map tier T1 / T2 / T3
export type AttractionRank = (typeof ATTRACTION_RANKS)[number];
export const ATTRACTION_CATS = ['landmark', 'museum', 'park', 'viewpoint', 'coast', 'campus', 'shopping', 'sports', 'culture', 'neighbourhood'] as const;
export type AttractionCat = (typeof ATTRACTION_CATS)[number];
export const ATTRACTION_GLYPHS = ['Landmark', 'Palette', 'Trees', 'PawPrint', 'Mountain', 'Binoculars', 'Waves', 'Sailboat',
  'GraduationCap', 'ShoppingBag', 'Trophy', 'Church', 'Theater', 'Castle', 'Signpost'] as const;   // lucide-react names
export type AttractionGlyph = (typeof ATTRACTION_GLYPHS)[number];
export const ATTRACTION_CAT_STYLE: Readonly<Record<AttractionCat, { color: string; glyph: AttractionGlyph; name: Bilingual }>>;  // plan §4.1 colours
export type AttractionArea = 'north-downtown' | 'bridge-presidio' | 'coast' | 'park-sunset' | 'twin-peaks-mission' | 'south';
export const ATTRACTION_AREAS: Readonly<Record<AttractionArea, Bilingual>>;                      // the 景点 list groups
export const ATTRACTION_TREATMENTS = ['ai', 'proc', 'plaza', 'card', 'stop', 'defer'] as const;
export type AttractionTreatment = (typeof ATTRACTION_TREATMENTS)[number];
export const ATTRACTION_FLAG_H = { min: 28, max: 70 } as const;
export interface AttractionFlag { x: number; z: number; h: number }     // pole foot; h = pole top above the ground there (u)
export interface AttractionStop { line: string; stop: string; d: number }
export interface Attraction {
  id: string; placeId?: string; name: Bilingual; short?: Bilingual;     // short ≤ 5 CJK / 14 Latin
  cat: AttractionCat; glyph?: AttractionGlyph; rank: AttractionRank; fame?: number;   // fame 0–100, higher first
  x: number; z: number; arrival?: { x: number; z: number; heading?: number }; offWalk?: string;
  area?: AttractionArea; flag?: AttractionFlag; aliases?: string[]; photoKey?: string;
  landmarkId?: string; siteId?: string; treatment?: AttractionTreatment; priority?: 1 | 2 | 3 | 4;
  near?: AttractionStop[]; officialUrl?: string; visitNote?: Bilingual;
  quiet?: boolean; hero?: boolean; panorama?: boolean;
}
```

Mapping the scouting categories of `sf-w4-attractions.json` onto `AttractionCat` is lane P's (university → campus,
shopping / food-market → shopping, religious → culture with the Church glyph, historic → landmark or culture,
neighbourhood-icon → neighbourhood, transit-icon → landmark, …); the JSON's `rank` is a fame order, its `mapRank` is
`Attraction.rank`.

### 4.6 The frozen tests (W4-0b)

- `opus-bay-sf-data`: the published line set is **the wave-2 lines ⊆ ids ⊆ them + `sf-loop`, `n-judah`,
  `m-ocean-view`**; every line passes `transitLineProblems`; the new lines: kind (`bus` / `light-rail`), `loop` only for
  `sf-loop`, length within ± 20 % of plan §3.1 (6,522 / 1,580 / 2,028 u), a `short`, path y in [−30, 60) (tunnels may
  dip), light rail double-ended and starting underground at Embarcadero (`tunnels[0].fromAt ≤ 1`) with an OSM relation
  source; the loop on the surface with an https source. The wave-2 lines keep their kinds, lengths ± 15 %, y in [0, 60),
  no loop, no tunnels. **Unchanged pins lanes must keep:** 69 curated places; every `places.json` row cites an
  openstreetmap.org URL and stands on SF land (bridges, water and hero rows excepted); ≥ 90 % of non-hero places snapped
  into the connected walking graph. So lane P's new rows live in `extraPlaces.ts` (runtime), not in `places.json`, and
  the duplicate curated sutro-baths dot is hidden at runtime (`places.ts`), not removed from `places.json` (the sidecar
  removes no ids).
- `opus-bay-sf-format`: JSON round trip + validation of a light-rail line with two tunnels and a loop line; every
  invariant of `transitLineProblems` named by a broken sample; `tunnelAt` (loops wrap).
- `opus-bay-contracts`: `TRANSIT_KINDS` / `TRANSIT_WHATS` exact; `arrival` / `trip` / `transit approach` travel the bus;
  `tour.id` defaulting (initial state, district writers, spreads, `tourIdOf`); **FIRST_TOUR byte-identical** and
  `FIRST_TOUR_PASSES`; trip modes and names; attraction ranks, cats, style table (hex colours, glyphs exported by
  lucide-react), areas, treatments, flag range.
- `opus-bay-district`: unchanged.

## 5. Protocol

- **Checks before every push** (from your worktree root): `npx tsc -p tsconfig.app.json --noEmit` (0),
  `npx eslint .` (0 errors: the whole repo, as CI's `npm run check` does; it covers scripts/opus-sf), `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
  (all green, incl. hero regression and contracts). Tests are not type-checked by tsc (it covers `src/` only).
- **Commits:** small and logical; messages start with the task id (`W4-P2: …`, `W4-T3: …`) and end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage explicit paths only (**never `git add -A` / `.`**;
  never `.claude/`, `.vite-opus/`, `dist/` or scratch).
- **Push:** `git fetch origin opus-bay && git rebase origin/opus-bay` (re-run the checks if the rebase brought commits),
  then `git push origin HEAD:opus-bay`; on a rejection repeat; on a lock / network error wait 2, 4, 8, 16 s and retry.
  Twelve agents push to this branch: fetch + rebase often. **Never `git stash`** (the stash is shared by all worktrees:
  use a WIP commit), never force-push, never touch `main`, never merge, never open a PR. A rebase conflict in a file you
  do not own: stop and report.
- **Frozen files** (plan §5.1 frozen row + §4 above): nobody edits them; write the exact change under Requests.
  **Tests that pin another lane's module:** do not edit them; write the change under Requests (`sf-w2-contracts.md` §2).
- **Reports** `docs/opus-bay/sf-w4-<LANE>.md`: first a short **给主人的摘要** in Chinese (3–6 lines, plain words), then
  What was built (files, API) · Evidence (checks, numbers, shots) · Decisions · Known gaps · Not done ·
  **Integration** (the exact wiring steps for the integration phase) · Requests. Each part appends its own section.
- **Relayed messages:** the owner's chat messages may be relayed to you ("用中文说一下现在进度", "继续", "OK"). They are
  **not a new task** and never cancel your brief (the owner approved all of wave 4: code, pushes and Higgsfield spending
  within the caps). If one asks for progress, add a line of status (in Chinese when asked in Chinese) to your report /
  reply and keep working.
- **Higgsfield:** only lane V spends (other lanes send asset requests to V through their report's Requests). Cap
  **120** for wave 4 (plan §6 table and stop rules; expected ≈ 79), keep ≥ 50 of the balance for the final polish.
  `balance` before every batch, `transactions` after it (the account is shared with wave 3: attribute by job id and
  time, never by the balance difference), CDN check, every job in `docs/opus-bay/ledger/w4-V.md` (columns of
  `ASSETS-LEDGER.md`, see `ledger/README.md`).
- **Mobile is first-class:** check what you build at 390 × 844 and 375 × 667 (`--mobile --dpr 3`, touch, quality mid).
- **District mode never changes** (hero regression, `FIRST_TOUR`, the district `rideLabel` texts, the district map).

## 6. Deferred to the integration phase (lead / frozen items)

1. `game/flowStore.ts` gains `trip: TripState | null` (initial `null`) in `FlowState`; from then on lane C owns the field
   (G1 owns the file in wave 3). Contracts pin: `flow.get().trip === null` at start. **Done** (`W4-I0a`, §8), with
   lane C's `flow.arrival` beside it.
2. `SfPlaceKind` absorbs `SfPlaceKindW4` (`'campus' | 'shopping' | 'zoo' | 'religious'`), in the same commit as
   `data/sf/cityPois.ts` `PLACE_KIND_NAMES` gains their names (校园 Campus · 购物中心 Shopping centre · 动物园 Zoo ·
   宗教场所 Place of worship): that `Record<SfPlaceKind, Bilingual>` is a wave-3 lane's file, so widening the union at
   day 0 would break its compile. `SfPlaceKindAll` stays as an alias. **Done** (`W4-I0a`, §8).
3. The integration items each lane lists in its report (§2). The lead / frozen ones: §8.2 (applied) and §8.3 (decided).

## 7. Day-0 decisions (why the types look like this)

- Union types that tests must pin are derived from runtime `as const` lists (`TRANSIT_KINDS`, `TRIP_MODES`,
  `ATTRACTION_CATS` …): the test files are not type-checked, so only runtime values can be pinned exactly.
- `core/events.ts` imports `TripMode` type-only from `game/tripTypes.ts` (erased at build; no runtime edge) and inlines
  the arrival tier as `1 | 2 | 3` (= `AttractionRank`) so core does not import data modules.
- `Attraction.name` is one `Bilingual` (not separate `name` / `zh` fields) like every other name in the code;
  `flag: { x, z, h }` follows plan §4.1 (lane P's test checks `flag.h` in 28–70) in place of a bare `flagTop`; the photo
  key is `photoKey`.
- A loop's path closes on itself so arc positions wrap cleanly; a tunnel's null portal means "the line starts / ends
  underground" (N and M at Embarcadero), which `transitLineProblems` enforces.
- The new lines get ± 20 % on length and y ≥ −30 in the frozen test (lane T bakes the loop and cuts the N at
  Embarcadero; underground heights are interpolated, not sampled), the wave-2 lines keep their old tolerances.

## 8. Integration phase · lead-merge (the §6 items, the Requests, the ledgers)

Written on 2026-09-27 by the lead-merge agent (worktree `C:/Users/willy/wt/i4-lead`, branch `i4-lead`, on `7c6e6e2`).
Every "Requests" item of `sf-w3-*.md` and `sf-w4-*.md` addressed to the lead or to a frozen file was applied or decided
below; the open wave-3 requests to wave-3 lanes were checked against the code and routed to their wave-4 owners (§5.1).
Integration lanes: rebase onto this commit before you wire.

### 8.1 给主人的摘要

1. 第 6 节留到接线阶段的冻结改动已经落地：`flow.trip`（行程）和 `flow.arrival`（抵达时刻）两个新状态、地点类型加上校园 / 购物中心 / 动物园 / 宗教场所、乘车事件带方向（进隧道还是出隧道）、欢迎选项能直接开"环游旧金山"、观光巴士每段路的车速写进数据格式（带校验）。
2. 各线在报告里对主人 / 冻结文件提的请求全部处理完：能做的做了，不需要的写明了原因（例如"地标旗开关"放在本机设置就够；唐人街宝塔群预算不够，先只做卡片）。
3. 顺手修好两个工具问题：并行截图时 Chrome 调试端口会撞车（现在由 Chrome 自己挑端口，两路同时截图已验证）；本地开着开发服务器时全仓检查会误报（忽略 `.vite-opus` 缓存）。
4. 第三、四波的 Higgsfield 账本已合并进总账并和平台流水对上：第三波 42.70 分，第四波到目前 55.45 分（上限 120），余额 400.13。
5. 第三波各线留下、还没做的小请求（约 30 条）已按第四波的分工转给对应的线（见 8.4）。

### 8.2 Applied (frozen / lead files)

| request (source) | change | pinned by |
|---|---|---|
| §6 item 1 (day 0) | `game/flowStore.ts`: `trip: TripState \| null`, initial null (type-only import of `game/tripTypes`). Lane C owns the field from now on. | contracts "wave 4 integration: flow.trip …" |
| lane C (c) (`sf-w4-C.md` Requests) | `game/flowStore.ts`: `arrival: (ArrivalBeats & { attraction: string; place: string }) \| null`, initial null (type-only import of `game/arrival`; no runtime edge, the P7 guard skips type imports). Lane C writes it, lane G reads it. | same test |
| §6 item 2 (day 0; lane P's first request) | `world/sf/format.ts`: `SfPlaceKind` includes `SfPlaceKindW4` (`campus`, `shopping`, `zoo`, `religious`); `SfPlaceKindAll` stays as an alias of `SfPlaceKind`. `data/sf/cityPois.ts` `PLACE_KIND_NAMES` gains 校园 Campus · 购物中心 Shopping centre · 动物园 Zoo · 宗教场所 Place of worship in the same commit. | contracts "… SfPlaceKind absorbed …" |
| lane C (a) | `core/events.ts` `transit`: `dir?: 1 \| -1` (1 = increasing `at`, the path order = outbound from Embarcadero on the N / M; −1 = inbound; absent = unknown). | contracts (dir travels the bus) |
| lane C (b) | `core/types.ts` `DialogueAction`: `{ type: 'start-tour'; tourId?: string }` (absent = the first lesson, so every district node keeps its meaning). | contracts (documented values) |
| lane T (`sf-w4-T.md` Requests) | `world/sf/format.ts` `TransitLine.speeds?: [fromAt, toAt, speed][]`; `transitLineProblems` checks the spans (numbers, `fromAt < toAt`, inside `[0, length]`, in order and not overlapping, speed > 0). The published `transit-w4.json` loop (121 spans) and every `transit.json` line pass. The runtime casts `TransitLine & { speeds? }` still compile; drop them at leisure. | sf-format "integration: speed spans …" (+ `speeds` on the sample loop); sf-data validates the published lines through `transitLineProblems` |
| lane V (Requests) | `eslint.config.js`: `globalIgnores(['dist', '.vite-opus'])` (the opus dev server's optimizer cache). | `npx eslint .` with a dev server running |
| lane C2, wave 3 (part b 5, review 1) | `scripts/opus-shot.mjs`: `--remote-debugging-port=0` and the port read from `<profile>/DevToolsActivePort` (the random 9400–9899 port collided between lanes and drove another lane's page). Two captures run in parallel each shot their own page. `w4-perf.mjs` runs through opus-shot and gets the fix. | — |
| lanes D2, H2b, V (ledgers) | `src/opus-bay/ASSETS-LEDGER.md` "Wave 3 and wave 4 (local)": every row of `ledger/w3-D2.md`, `w3-H2b.md`, `w4-V.md`, the dated CDN correction (H2b-12), the balance trail and the reconciliation with `transactions` (15 credits at 22:16–22:20 UTC are not in a lane ledger yet: most likely lane V's Holy Virgin re-fit; its next ledger rows get merged). | — |

### 8.3 Decided, not applied

- **`settings.landmarkFlags` in `core/store.ts` (lane G, optional): not added.** A display preference per device is
  what `game/guidePrefs.ts` already keeps; a store field would need a second writer (the settings decoder in
  `data/wishlist.ts`) and touches every save for nothing the game needs.
- **`vercel.json` immutable cache header for `/opus-bay/sf/v1/**` (G1, wave 2 → 3): not touched.** Preview deployments
  of `opus-bay` are off and nobody edits `vercel.json` in this wave; it belongs to the release to `main`.
- **`SF_VOICE_UNMUTE` (H2b):** waits for the owner's listening (`docs/opus-bay/qa/w3/H2b/`); nothing to change before.
- **Mural boards vs the player's body (H2b review, design call):** boards flush to the walls (0.06 u instead of 0.12 u),
  not soft obstacles (no new obstacle kind for the ride code) → lane V (H2b's files), see 8.4.
- **Chinatown pagoda cluster (lane V / L):** card-only in wave 4. The headroom is 10.1k at `quality=high`, on the plan's
  10k line with no margin, and C2's review measured Chinatown at 411k on `c9cd8a4`; Old St Mary's and the Sing Chong /
  Sing Fat towers stay cards (lane C), models are a later wave's.
- **Strawberry Hill drawn as lake water (lane L, "lead / the lane that owns the chunk build"):** not a data fault. The
  chunks carry the island as `hole` rings right after the Blue Heron Lake ring (`-3_8` rings 13 → 14–16, `-2_7` 70 → 71–72),
  and the walk raster honours them (`core/sfTerrain.ts rasterizeChunk` fills even-odd with the holes; probe: kind land,
  surface 6 at the Chinese Pavilion origin). The **renderer** does not: `world/sf/build.ts chunkContext` fills every
  water ring, holes included, as water (`const v = k === A.land ? 1 : 0`), and `world/sf/far.ts` sets `land = 0` for a
  water hole too → lane V (C2's files), see 8.4. No chunk rebuild (plan R16).
- **Owner decisions, left as the lanes' defaults:** the toy-bike autopilot cruise (lane G: leave it, times stay honest);
  six residents' voices (G2, optional, would be lane V's recording + lane C's one-line emit).
- **For the final verify (W4-Z), not now:** the perf table on a quiet machine (C2 review 2); GameRoot 309 KB vs the
  250 KB target and whether to split the HUD / game systems by mode (C2 part b: a lead decision taken with lane V's
  bundle numbers after the wiring); D2's G5 on-screen gate for the three routes (re-run `routes-qa.mjs` once lane L's
  park sites are registered).

### 8.4 Routed to the wave-4 owners (open wave-3 requests, checked in the code at `7c6e6e2`)

| owner | from | file | change |
|---|---|---|---|
| **G** | C2 w3 a1 / b4 | `game/Systems.tsx` `FocusMarker` | ring material `forceSinglePass: true` (2 program lookups a frame today) |
| **G** | E2 w3 a1 / review 4 | `game/hudLayout.ts` `HUD_BOX_SELECTOR` | add `'.ob-move-buttons > *'` (bubble and waypoint keep off Hop / bell / 下车 / 起飞 / 降落) |
| **G** | E2 w3 review 2 | `opus-bay.css` | landscape 667 × 375: the `.ob-hud-buttons` column spans y −17…249, its top button is cut off |
| **G** | G2 w3 c5 | `actors/camera.ts` `twoShotPose` | in a resident's chat prefer BAYBAY's side (`prefer = gs \|\| this.twoSide`, exact code in `sf-w3-G2.md`) |
| **G** | G2 w3 review 8 | `ui/Settings.tsx` reset | `void import('../game/baybayLines').then(m => m.clearLineMemory());` after `clearSave()` |
| **G** | D2 w3 c2 | `actors/system.ts` BAYBAY GLB | load with `(await import('../world/models')).heroGltfLoader()` (then lane V can publish Draco + WebP heroes) |
| **G** | F w3 a / b | `ui/transitGlyph.ts`, `ui/icons.tsx` | F-line stations (`f-…`, hero stops while the city F-line runs) answer `'streetcar'`; ferry terminals by `ferryTerminal(refId)` (`pier-41`) |
| **G** | G1 w3 a2 | `tests/opus-bay-sf-nav.test.ts` l.180 | `navWindowStats.lastMs < 200` flakes under load: ≈ 600 ms or drop the wall clock (the build count is the check) |
| **G** | D2 w3 b (optional) | `actors/moveSystem.ts` `cityTallStructures` | the renderer's base for 'terrain' landmarks instead of `heightAt(l.x, l.z)` |
| **G** | G1 w3 review (observation) | RouteWalker legs | Ferry gate → Dragon Gate: a ≈ 20 u excursion east near x 132–153, z 29–33 while `routeTo` goes straight |
| **T** | E2 w3 a4 / review 4 | `world/streetcar.ts`, `game/transit.ts` | the hero F-line ride gets `line: 'streetcar'` and honours `requestPlatformStop('streetcar', 1.2)` / `releasePlatformStop` (braked hop-off like the city cars) |
| **T** | D2 w3 c2 | `world/life.ts` `loadModel` | `heroGltfLoader()` instead of `new GLTFLoader()` (as lane G above) |
| **T** | G2 w3 review 9 | `world/sf/cityLife.ts` `crowdEnv.avoid` | step round the six city residents (`RESIDENTS` within 100 u; code in `sf-w3-G2.md`) |
| **T** | F w3 b | `world/sf/lineFleet.ts` | `registerRoadVehicles` (buses, LRVs: kind, line, half sizes) and `registerTransitStreet` for surface tracks (`world/sf/streetNet.ts`) |
| **T** | E2 w3 review 1 (optional) | `game/transit.ts` `leaveLineRide` ferry branch | `?? { x: quay.x, z: quay.z }` when the quay's ground is not streamed |
| **T** | lead (this merge) | `world/lightRail.ts` / fleet events | set the new `dir` on `transit` board / approach / arrive for `n-judah` / `m-ocean-view` (lane C's portal lines stay silent without it) |
| **T + V** | C2 w3 b3 / review 3 | streetcars / cable cars | Chinatown 37k main tris on `c9cd8a4`: shadows only near the camera; confirm in the perf gate |
| **P** | E2 w3 b1 / review 4 | `game/fastTravel.ts` `arrivalSpot` | in city mode use `actors/nav` `arrivalSpot(p, 30)` first (never a slot between house rows; code in `sf-w3-E2.md`) |
| **P** | G2 w3 review 10 | place index names | zh for `osm-w120483945` (威廉明娜女王郁金香花园; residents already say "Queen Wilhelmina 郁金香花园"); `osm-w8916752` is named by the clarion-alley attraction |
| **P / C** | D2 w3 c5 | map lines, discovery chips | `SF_ROUTES` (`data/sf/routes.ts`) is ready to show |
| **L** (+ **C**, **P**) | D2 w3 c1 (to the lead) | `data/sf/landmarks.ts` + `data/sf/arrivals.ts` + `data/sf/attractions.ts` `LANDMARK_ARRIVALS` + `data/sf/routes.ts` | the four arrivals (Palace on the lagoon walk, Fort Point on the apron, de Young in the forecourt, Castro across the street; exact values in `sf-w3-D2.md` part c), in one push: `sf-content` and `sf-attractions` print the tables, then `routes-build.ts` (R2 / R3 stops). Routed rather than applied: every file is a lane's, and lanes C / P pin these points in tests they are editing now |
| **L** | L w4 (to "D2 / the kit owner") | `world/sf/landmarks/kit.ts` `pyramid` | turn by 45° before the scale (or call `siteKit.hipRoof`); the six `w ≠ d` calls change shape with it |
| **L** | D2 w3 not done | landmark settings | the remaining T2 settings (Grace's Huntington Park steps, the Legion's court approach, Ghirardelli, the Wharf, Sutro / Cliff House, Lombard, the turntable aprons) |
| **V** | lead (8.3) | `world/sf/build.ts` `chunkContext`, `world/sf/far.ts` | fill a water ring even-odd with its following hole rings (as `rasterizeChunk` does) so Strawberry Hill (and every lake island) is land in the render; then lane L can lower the pavilion's stone-base workaround |
| **V** | lead (8.3) | `scripts/opus-sf/murals/place.ts` | mural boards at 0.06 u from the wall (re-run; placement test stays); check for z-fighting at 300 u |
| **V** | lead (this merge) | `scripts/opus-sf/qa/perf/opus-prof.mjs` | the same debugging-port fix as `opus-shot.mjs` (random 9900–9989 port today) |
| **V** | G1 w3 a3 | `world/sf/stats.ts` `?debug` panel | on ≤ 720 px: `font-size 10px; max-width calc(100% − 12px); white-space pre-wrap`, under G1's debug line, or desktop only |
| **V** | D2 w3 c3 | warm-up | programs drift 40–41 → 42 along each route (`routes-qa.mjs` JSON): one or two link after the warm-up at the first route stop |
| **V** | D2 w3 not done | assets | Draco + WebP for the five district heroes once G and T load them through `heroGltfLoader()`; kit night-glass masks for marina-mediterranean / sunset-doelger / edwardian-flats |
| **C** | G2 w3 b2 | `data/wishlist.ts` `readProgress` | `goalsDone: strings(raw.goalsDone, 128)` (41 `hood:` marks + goals + favours come close to 64) |
| **C** | lead (this merge) | `game/flow.ts` | `start-tour` with `tourId` for the welcome choice; `flow.arrival` for the beats; `SfPlaceKindAll` may become `SfPlaceKind` |
| **C** (optional) | G1 w3 a4, F w3 a, D2 w3 a | `data/sf/copy.ts`, `game/content.ts`, `data/sf/cityPois.ts` | `greet?: Bilingual` for the city title; `streetcarBoard` / `ferryBoard` / `ferryOff` hooks; drop the now redundant landmark part of `ZH_GLOSSARY` / `PLANNER_DROP` |

Checked and already done (no action): C2 w3 a2–a4 and b1–b2, E2's BAYBAY precompile and crowd shadows, F's ferry
hop-off refusal (E2 review), G2's blob skip of hidden residents and `dispose()` release, G2's `LANDMARK_EDGES_PENDING`
(gone) and the cable-car fallback text, H2b's paper patch and the `SF_VOICE_LINES` merge, G2's `lines.ts` comment, the
601–1180 px touch-action column (G1 review: 721–1180 px, below that the narrow HUD), lane C's O1 (克莱门街 in the plan
row 59, the JSON and lane P's rows). The wave-4 reports' own cross-lane Requests stand as written: they already name
their wave-4 lanes.
