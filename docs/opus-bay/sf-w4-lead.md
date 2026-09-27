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
   (G1 owns the file in wave 3). Contracts pin: `flow.get().trip === null` at start.
2. `SfPlaceKind` absorbs `SfPlaceKindW4` (`'campus' | 'shopping' | 'zoo' | 'religious'`), in the same commit as
   `data/sf/cityPois.ts` `PLACE_KIND_NAMES` gains their names (校园 Campus · 购物中心 Shopping centre · 动物园 Zoo ·
   宗教场所 Place of worship): that `Record<SfPlaceKind, Bilingual>` is a wave-3 lane's file, so widening the union at
   day 0 would break its compile. `SfPlaceKindAll` stays as an alias.
3. The integration items each lane lists in its report (§2).

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
