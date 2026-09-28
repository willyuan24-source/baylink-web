# Wave 5 · lead note (day 0): ownership, protocol, the frozen contracts, the hooks, the baseline

Written on 2026-09-28 by the lead's day-0 agent (worktree `C:/Users/willy/wt/w5-day0`). **Read this first**, then
`sf-w5-plan.md` (§1, §2, your lane's §4.x and every section it cites, §4.1 ownership, §4.2 the frozen contracts, §4.3 the
hooks, §4.14 builds, §6 defaults) and `owner-feedback-2026-09-27.md`. Where this note and the plan differ, **this note
wins** (the differences are listed in §9).

**Never delete through a junction.** `node_modules` in every worktree is a junction to
`C:/Users/willy/OneDrive/Desktop/baylink-web/node_modules` (another agent's checkout). `git worktree remove --force`,
`rm -rf` or `Remove-Item -Recurse` on a worktree FOLLOWS that junction and empties it (it happened once, 2026-09-27). To
drop a scratch worktree: first `cmd //c rmdir C:\Users\willy\wt\<name>\node_modules` (removes only the link), check it
is gone, then `git worktree remove <path>`. Never `npm install` / `npm ci`, never touch anything under `node_modules`.
If `npx tsx` / `npx tsc` / `npx eslint` say "not recognized", use `node node_modules/tsx/dist/cli.mjs` (resp.
`node_modules/typescript/bin/tsc`, `node_modules/eslint/bin/eslint.js`) and say so in your report; never repair
`node_modules` yourself.

## 0. 给主人的摘要

1. 第五波的"第 0 天"底层约定已经推上去（`436c888`）：金币/奖励/发现/小游戏/小铺/现实联动等新事件、旧金山真实时间（测试时可用 `?date=` 拨到任意一天，正式站不生效）、存档里的"玩法"栏（金币、收集、装扮），以及各条线往界面上"挂东西"的插槽（旅行本新页签、更多菜单、右上角小徽章、弹层、问 BAYBAY 菜单）。
2. 存档修好了一个隐患：以前存档太大时会只剩"上次位置"，飞行解锁、导览进度都会丢；现在只会裁掉最旧的"去过的地方"，金币和解锁永远保留（已按上限做了测试）。
3. 街区模式完全没变；全部 918 个测试通过；手机和电脑上都实际打开看过（右上角能显示 🪙，"更多"里能出现小铺）。
4. 10 条线今天就能开工，各自一个工作目录和端口；同一时间每条线最多开一个无头浏览器，测性能时大家暂停。
5. Higgsfield 余额 400.07（2026-09-28 01:37 PDT），第五波上限 130 分、只有 V 线能花，余额不低于 250。

## 1. State at day 0

- `origin/opus-bay`: `26b8be4` (the plan) · `27073fd` (**W5-0c**, `origin/main` merged: the 2026-09-27 site data) ·
  `826c658` (**W5-0b**, the F1 hotfix: `game/playerLock.ts`, `game/lockWatchdog.ts`, red-then-green
  `tests/opus-bay-w5-lock.test.ts`) · `436c888` (**W5-0d**, the frozen contracts, §4) · the commit that adds this note
  (**W5-0f / W5-0g**).
- Checks on `436c888`: `npx tsc -p tsconfig.app.json --noEmit` 0 errors · `npx eslint .` 0 errors (43 old warnings
  outside `src/opus-bay`) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **918 / 918** (907 +
  11 new contracts tests).
- Seen in the browser on `436c888` (dev server 5519, city mode, slots registered from the console, then removed):
  desktop 1440 × 900 — the pill reads `Postcards 0/24 · 🪙 42`, the desktop 更多 button appears between 拍照 and 设置, the
  问 BAYBAY menu shows an `order < 0` item on top; phone 390 × 844 dpr 3 — the phone bar's 更多 menu reads 拍照 · 小铺 ·
  设置, the badge takes its own line in the pill when it does not fit; district mode desktop — five round buttons,
  `Postcards 0/8`, no slot markup. Scratch shots: `C:/Users/willy/opus-qa/w5/w5-day0/`.
- **W5-0a (the quiet-machine baseline) is covered by the wave-4 final verify** (`sf-w4-final-verify.md`, run alone on
  the machine on `1d2cd76`, 2026-09-28 07:15–07:33 UTC); the numbers are in §6. Wave 5 has changed no rendering since
  (W5-0b / 0c / 0d add no draw call, triangle or material).

## 2. Ownership (= plan §4.1)

OB = `src/opus-bay`. Every lane also owns `docs/opus-bay/sf-w5-<LANE>.md`, `docs/opus-bay/ledger/w5-<LANE>.md` and
`docs/opus-bay/qa/w5/<LANE>/`.

| lane | owns (existing files) | new files it creates |
|---|---|---|
| **F · Feel & feet** | OB/actors/** except platform.ts (T), npcs.ts (V), residentLooks.ts (C), reveal.ts (N); OB/core/{input,terrain,walkGraph}.ts (additive); OB/data/vehicles.ts, OB/data/sf/rideSpots.ts; OB/game/{Systems.tsx,cinema.ts,lockWatchdog.ts}, the internals of OB/game/playerLock.ts; OB/ui/{Hud,Floating,Overlay,CoachMark,CoachMarkBody,Settings,icons,MoveChip,coachSeen,lazyParts}.ts(x), OB/opus-bay.css, OB/OpusBayPage.tsx; tests actors, sf-move2, sf-move3, sf-modes, sf-vehicles, sf-nav, sf-hud, sf-device, **w5-lock** | OB/actors/{charImpl,feet,stuckHelper,deckSteer,faceOpen}.ts, scripts/opus-sf/qa/{sweep-static.mts,walker-sweep.mjs}, tests/opus-bay-w5-{feet,char}.test.ts |
| **N · Navigation, map & travel** | OB/data/sf/{places,extraPlaces,attractions,placeSearch,stationPlaces,mapStickers,mapTransit}.ts, OB/data/cityZones.ts; OB/ui/{CityMap,CityMapList,cityMapDraw,cityMapModel,MapPanel,MapBadge,MapFilters,MapLegend,mapBadges,mapData,mapFilterRules,mapIcons,mapLabels,mapLayout,mapLines,mapListData,mapTrips,map-w4.css,PlaceActions,TripOptions,StationActions,Footprints,footprintsData,TitleScreen,common,hooks,city-ui.css,GuideLayer,TripPill,ArrivalCard,PanoramaTags,guide-ui.css,guideText,tripRows,panoramaPlace,spotLabel}.ts(x); OB/game/{discovery,fastTravel,placeTrips,travel,resume,streets,mapPanel,mapRoute,tripPlan,tripProviders,tripText,trips,tripRun,flags,guideCity,guidePrefs,waypoint,hudLayout}.ts; OB/world/sf/{flags,flagGlyphs}.ts; OB/actors/reveal.ts; scripts/opus-sf/{lib/places.ts,places-sidecar.ts}; public/opus-bay/sf/v1/places.json; tests sf-{citymap,discovery,places,travel,attractions,trip,tripflow,triptext,flags,waypoint,guide,guide-city,guide-review,guide-ui,map-fixes,map-int,map-w4,verify-g} | OB/game/goTo.ts, OB/ui/{MapGoCard,GoChip}.tsx, tests/opus-bay-w5-nav.test.ts |
| **C · Content, flow & tours** | as wave 4 **minus** data/{catalog,links}.ts and ui/{EventCard,EventCardBody}.tsx (→ R), actors/npcs.ts (→ V), game/{trips,tripRun}.ts (→ N); **plus** game/{cityTour,tourTrips,cityMoments,cityCards,cityDetectors,cityLive,linePacer,interactables}.ts, data/sf/{placeCards,placeCards2,placeCardTypes,tours,tourLines,voiceTour,arrivals,goalMarks}.ts, ui/{CityTourRecap,TourRecap,tourRecapModel,RecapMap,DistrictRecap,PlaceCard,PoiCardBody,content-ui.css}.ts(x); data/save.ts after day 0. Wave 4 C = game/{flow,brain,content,photo,projector,cityContent,cityGoals,residentTasks,baybayLines,flowStore}.ts, data/{postcards,script,pois,tours,contentMode,VOICE.md,save}(.ts), data/sf/{cityPois,copy,dialogue,goals,lines,postcards,residents}.ts, ui/{Journal,Moments,PoiCard,Dialogue,format}.ts(x), i18n.ts | OB/game/{rumours,goalsStep,photoFrames}.ts, tests/opus-bay-w5-content.test.ts |
| **T · Transit & crowds** | as wave 4 (game/{ride,transit}.ts, data/transit.ts, world/{streetcar,cablecar,ferry,rails,turntable,transitLine,transitLayer,life,busSystem,lightRail}.ts, world/sf/{tourBus,lrv,stations,portals}.ts, data/sf/stationNames.ts, ui/{SubwayOverlay.tsx,transit-ui.css}, OB/actors/platform.ts, scripts/opus-sf/lib/{transit,busLoop}.ts, transit-sidecar.ts, transit.json, the transit tests) + OB/world/sf/{cityLife,lineFleet,lineInterlocks,streetNet,crowd,traffic}.ts, OB/world/{flineLayer,flineSystem,lineTrack}.ts, OB/game/{lineRides,lineChoices}.ts, OB/ui/{RideBanner,LineRideLayer,StationPanel,rideHop,subwayStrip,transitGlyph}.ts(x), **OB/audio/** (the internals of audio/hooks.ts; the API is frozen)** | OB/world/sf/crowdSpots.ts, OB/game/busWatch.ts, tests/opus-bay-w5-transit.test.ts |
| **L · Landmarks & streets** | as wave 4: OB/world/sf/landmarks/** (incl. the tier-3 kit and lists), OB/world/sf/{sites,kitSwap,l0index,dress,swap}.ts, OB/data/sf/{landmarks,routes}.ts, OB/world/{models,modelMaterial}.ts, scripts/opus-sf/{routes-qa,sites-qa,sites3-*}, the landmark tests | OB/world/sf/landmarks/{cornerKit,corners}.ts (+ one module per new corner where no site module exists), tests/opus-bay-w5-corners.test.ts |
| **V · Visuals, performance, voice & assets** | as wave 4 (C2's world files, GameRoot.tsx, H2b's asset files, D2's pipeline, vite.opus.config.ts, scripts/opus-sf/qa/**) + OB/actors/npcs.ts | OB/world/sf/{signsAtlas,farHero}.ts, public/opus-bay/w5/**, scripts/opus-sf/qa/{csp-serve.mjs,perf/w5-spots.json}, tests/opus-bay-w5-perf.test.ts |
| **E · Economy & notebook** | — (reads the frozen `data/playSave.ts`) | OB/economy/** (index.ts — the day-0 stub is yours —, ledger.ts, coinSpots.ts, coins.ts, CoinBadge.tsx, items.ts, Shop.tsx, wear.ts, stamps.ts, Notebook.tsx, economy.css), scripts/opus-sf/coins-place.mts, tests/opus-bay-w5-{ledger,coins,shop,notebook}.test.ts |
| **A · Activities & actions** | — | OB/play/** (index.ts — the stub —, kit.ts, ResultCard.tsx, EmoteWheel.tsx, pet.ts, sit.ts, viewSpots.ts, firstFlight.ts, rings.ts, slides.ts, bell.ts, stairs.ts, the should activities, play.css), tests/opus-bay-w5-play{,-acts}.test.ts |
| **D · Discoveries & easter eggs** | — | OB/eggs/** (index.ts — the stub —, registry.ts, hosts.ts, props.ts, sounds.ts, FactCard.tsx, rumourSource.ts, one module per area, eggs.css), tests/opus-bay-w5-eggs.test.ts |
| **R · Real San Francisco** | OB/data/{catalog,links}.ts, OB/ui/{EventCard,EventCardBody,WeekPanel}.tsx, OB/game/qa.ts (the `sf-cards` rows about events stay C's: write Requests) | OB/realsf/** (index.ts — the stub —, sun.ts, moon.ts, seasons.ts, eventVenues.ts, events.ts, eventKit.ts, TodayTab.tsx, daily.ts, jets.ts, calendar.ts, tides.ts, HowToGo.tsx, realsf.css), scripts/opus-sf/{export-tides.ts,export-live.ts}, public/opus-bay/sf/v1/{tides,live}.json, tests/opus-bay-w5-{sun,events,today,jets}.test.ts |
| **frozen** (lead only) | OB/core/{types,store,events,runtime,geo}.ts, OB/world/sf/format.ts, OB/data/district.ts, OB/game/{systemsRegistry,tripTypes,bayNow,w5Features}.ts, **the API of** OB/game/playerLock.ts and OB/audio/hooks.ts, OB/data/playSave.ts, OB/data/sf/attractionTypes.ts, OB/ui/slots.ts, OB/actors/charApi.ts, tests/opus-bay-sf-disk.ts, tests/opus-bay-{contracts,district}.test.ts, tests/opus-bay-sf-{format,data,geo,terrain}.test.ts, OB/ASSETS-LEDGER.md, OB/{DESIGN,STATUS,RESUME}.md, package*.json, vite.config.ts, vercel.json, eslint.config.js | — |

- A file not listed: the lane whose subject it is; if unclear, frozen (write the change under Requests). Tests that pin
  another lane's module: do not edit them; write the change under Requests (`sf-w2-contracts.md` §2).
- **Day-0 wiring in lane files.** To land the render points and the dispatch, the lead touched on day 0: `ui/Hud.tsx`,
  `ui/Overlay.tsx`, `opus-bay.css` (F), `ui/Journal.tsx`, `ui/Dialogue.tsx`, `game/flow.ts`, `game/interactables.ts`,
  `game/cityContent.ts`, `data/save.ts` (C), `audio/audio.ts` (T). From `436c888` on they are their owners' again;
  keep the day-0 lines working (the contracts test renders the Hud and the Journal and walks the call menu).
- Counts wave 5 changes on purpose (the owning lane updates its own test): goals order and count (C), Journal tabs (C via
  the slots), the flag glyph set (N + V), the event rows in cards (R + C).

## 3. Protocol

### 3.1 Worktrees, ports, paths

| lane | worktree (branch `w5-<lane>`) | dev port | scratch | report · ledger · QA images |
|---|---|---|---|---|
| F · feel & feet | `C:/Users/willy/wt/w5-f` | **5501** | `C:/Users/willy/opus-qa/w5/f/` | `docs/opus-bay/sf-w5-F.md` · `ledger/w5-F.md` · `qa/w5/F/` |
| N · navigation | `C:/Users/willy/wt/w5-n` | **5502** | `…/w5/n/` | `sf-w5-N.md` · `ledger/w5-N.md` · `qa/w5/N/` |
| C · content | `C:/Users/willy/wt/w5-c` | **5503** | `…/w5/c/` | `sf-w5-C.md` · `ledger/w5-C.md` · `qa/w5/C/` |
| T · transit & crowds | `C:/Users/willy/wt/w5-t` | **5504** | `…/w5/t/` | `sf-w5-T.md` · `ledger/w5-T.md` · `qa/w5/T/` |
| L · landmarks & streets | `C:/Users/willy/wt/w5-l` | **5505** | `…/w5/l/` | `sf-w5-L.md` · `ledger/w5-L.md` · `qa/w5/L/` |
| V · visuals, perf, voice, assets | `C:/Users/willy/wt/w5-v` | **5506** | `…/w5/v/` | `sf-w5-V.md` · `ledger/w5-V.md` · `qa/w5/V/` |
| E · economy & notebook | `C:/Users/willy/wt/w5-e` | **5507** | `…/w5/e/` | `sf-w5-E.md` · `ledger/w5-E.md` · `qa/w5/E/` |
| A · activities | `C:/Users/willy/wt/w5-a` | **5508** | `…/w5/a/` | `sf-w5-A.md` · `ledger/w5-A.md` · `qa/w5/A/` |
| D · discoveries & eggs | `C:/Users/willy/wt/w5-d` | **5509** | `…/w5/d/` | `sf-w5-D.md` · `ledger/w5-D.md` · `qa/w5/D/` |
| R · real San Francisco | `C:/Users/willy/wt/w5-r` | **5510** | `…/w5/r/` | `sf-w5-R.md` · `ledger/w5-R.md` · `qa/w5/R/` |
| verify (lead) | `C:/Users/willy/wt/w5-verify` | **5520** | `…/w5/verify/` | — |

- The lead's checkout `C:/Users/willy/baylink-opus` runs the dev server **5174** and the phone preview **4174**: leave
  them alone, and never modify that checkout, another lane's worktree or `C:/Users/willy/OneDrive/Desktop/baylink-web`.
- The Bash tool's working directory resets between calls: start **every** command with `cd /c/Users/willy/wt/w5-<lane> && `;
  Read / Edit / Write paths are absolute under your worktree. Node / JSON paths are `C:/Users/...`, never `/c/Users/...`
  (in `tsx` scripts import absolute paths as `file:///C:/...`).
- Dev server: `npx vite --config vite.opus.config.ts --port <PORT> --strictPort` (background); stop it when you finish:
  PowerShell `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -like '*--port <PORT>*' | % { Stop-Process -Id $_.ProcessId -Force }`.
  A cold dev server may log "Failed to fetch dynamically imported module" for a chunk while Vite optimizes its deps on
  the first load: reload once before you call it a bug.

### 3.2 Ten lanes on one machine

- **At most ONE headless Chrome per lane at a time** (`node scripts/opus-shot.mjs`, `CHROME_FLAGS="--force_high_performance_gpu"`,
  `--mobile --dpr 3` for 390 × 844 / 375 × 667). **Read every image you make** before you describe it; a few key JPEGs go
  to your QA folder, the rest stays in scratch.
- **PERF-LOCK:** while the file `C:/Users/willy/opus-qa/w5/PERF-LOCK` exists (lane V or the lead is running a perf gate),
  start **no** Chrome and **no** `vite build`; poll every 30 s until it is gone. Whoever runs a gate creates the file
  first (one line: who, since when) and deletes it at the end, also on failure.
- **fps numbers come only from lane V's gate runs and the lead's verify.** Calls, triangles and programs may be read by
  anyone (they do not depend on load).
- The full suite has wall-clock asserts (`opus-bay-audio` "P1 sliced jobs", `sf-citymap` "draw … fast", `sf-nav` window
  stats) that can fail under load: re-run a failing wall-clock test alone before you call it a failure. Push only when
  the suite says **fail 0**.

### 3.3 Checks, commits, pushes

- **Before every push** (from your worktree root): `npx tsc -p tsconfig.app.json --noEmit` (0) ·
  `npx eslint .` (0 errors; **the whole repo**: CI runs `npm run check` on every push, and it lints `scripts/opus-sf` and
  the site too) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` (all green, the hero
  regression, district and contracts included). tsc covers `src/` only: tests are checked by running them.
- **Commits:** small and logical; messages start with the task id (`W5-E1: …`, `W5-F3: …`) and end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage explicit paths only (**never `git add -A` / `.`**; never
  `.claude/`, `.vite-opus/`, `dist/` or scratch).
- **Push:** `git fetch origin opus-bay && git rebase origin/opus-bay` (re-run the checks if the rebase brought commits),
  then `git push origin HEAD:opus-bay`; on a rejection repeat; on a lock / network error wait 2, 4, 8, 16 s and retry.
  **Never `git stash`** (the stash is shared by every worktree: use a WIP commit), never force-push, never touch `main`,
  never merge (the lead's W5-0c merge is the only one), never open a PR. A rebase conflict in a file you do not own: stop
  and report. If a push keeps failing for a tool / permission reason, say so in your report (the lead finishes it).
- **Frozen files** (§2 frozen row): nobody but the lead edits them; write the exact change under Requests.
- **Reports** `docs/opus-bay/sf-w5-<LANE>.md`: first a short **给主人的摘要** in Chinese (3–6 lines, plain words), then
  What was built (files, API) · Evidence (checks, numbers, shots) · Decisions · Known gaps · Not done · Requests. Each
  part appends its own section. Every real-world fact carries its source URL and the date you checked it on the web.
- **Relayed messages:** the owner's chat messages may be relayed to you ("现在进度如何", "继续", "OK"…). They are **not a
  new task** and never cancel your brief (the owner approved all of wave 5: code, pushes, Higgsfield within lane V's
  cap). If one asks for progress, add a one-line status (in Chinese when asked in Chinese) to your report / reply and
  keep working.
- **Higgsfield:** only lane V spends (§8); other lanes send asset requests to V through their report's Requests.
- **Mobile is first-class** (390 × 844 and 375 × 667, touch, quality mid); **district mode never changes** (the hero
  regression, `FIRST_TOUR`, the district texts and map, the district contact sheet).

## 4. The frozen contracts landed at day 0 (`436c888`, exact signatures)

Pinned by `tests/opus-bay-contracts.test.ts` (the eleven "wave 5:" tests). Nobody but the lead edits these files; ask
for a change under Requests with the exact diff.

### 4.1 `core/events.ts`

```ts
// GameEvent, new members (stuck landed with W5-0b)
| { type: 'reward'; source: string; coins: number; stamp?: string }            // any lane → E's ledger; paid ONCE per source
| { type: 'coins'; total: number; delta: number; source: string }             // E, after paying (a purchase: delta < 0, source 'shop:<item>')
| { type: 'find'; kind: FindKind; id: string; first: boolean }                // D eggs / pebbles / sounds, A views, E caches, R souvenirs
| { type: 'play'; activity: string; what: 'start' | 'end' | 'cancel'; tier?: 1 | 2 | 3 }   // A
| { type: 'shop'; what: 'open' | 'buy' | 'wear' | 'close'; item?: string }    // E
| { type: 'realsf'; what: 'event-enter' | 'event-leave' | 'window-open' | 'window-close'; id: string }   // R
| { type: 'stuck'; x: number; z: number; what: 'pull' | 'watchdog' | 'sweep'; source?: string }         // F (DEV log)
| { type: 'self-tap'; who: 'player' | 'baybay'; double: boolean }             // F → A (emote wheel, pet)
export const FIND_KINDS = ['egg', 'view', 'sound', 'pebble', 'cache', 'souvenir', 'nature'] as const;
export type FindKind = (typeof FIND_KINDS)[number];
export const REWARD_PREFIXES = ['arrive', 'postcard', 'favour', 'goal', 'egg', 'view', 'sound', 'pebble', 'cache', 'trail', 'ring', 'event', 'daily', 'page', 'medal', 'pelican'] as const;
export type RewardPrefix = (typeof REWARD_PREFIXES)[number];
export const REWARD_SOURCE = /^(arrive|postcard|favour|goal|egg|view|sound|pebble|cache|trail|ring|event|daily|page|medal|pelican):[a-z0-9:@-]{1,80}$/;
export function rewardPrefix(source: string): RewardPrefix | null;
```

Source examples: `arrive:coit-tower`, `postcard:sf-painted-ladies`, `favour:baker`, `goal:pelican`,
`egg:telegraph-hill-parrots`, `view:twin-peaks`, `trail:filbert-steps:3`, `ring:coit:2`, `event:hardly-strictly-bluegrass-2026`,
`daily:2026-10-03:1`, `page:views`, `medal:slides:2`, `pelican:unlock`. The ledger (E) ignores anything else.

### 4.2 `game/playerLock.ts` (API frozen at W5-0b; lane F owns the internals from W5-F1)

```ts
export type LockSource = 'dialogue' | 'fishing' | 'cinema' | 'ride' | 'phase' | 'travel' | 'panel' | 'activity' | 'shop';
export function holdLock(source: LockSource, key?: string): () => void;   // the returned function releases (idempotent)
export function lockHeld(): boolean;
export function lockReport(): { source: LockSource; key?: string; since: number }[];
export function setLockRefresher(fn: () => void): void;                     // flow registers refreshLock (cinema.finish calls it)
```

### 4.3 `game/bayNow.ts`

```ts
export const BAY_TZ = 'America/Los_Angeles';
export function bayNow(): Date;             // real time; DEV and QA builds: ?date=YYYY-MM-DDTHH:mm (Bay time) shifts it
export function bayParts(d?: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number; dateKey: string };
export function parseBayDate(spec: string): Date | null;     // a Bay wall-clock minute → the instant (DST-safe)
export function bayDateOverrideAllowed(): boolean;           // import.meta.env.DEV || VITE_OPUS_QA === '1'
export function __setBayNowForTests(spec: string | Date | null): boolean;   // tests / node QA only, never product code
```

`month` 1–12, `weekday` 0 = Sunday, `dateKey` `'YYYY-MM-DD'` (the Bay date: daily refills, 今日三件小事, once-a-Bay-day
lines). `?date=` starts the clock at that Bay minute when the page first reads it and runs on in real time. A **QA
build** is `VITE_OPUS_QA=1 npx vite build --config vite.opus.config.ts …` (the lead's dated phone package); the site is
built without it, so production ignores `?date=`. `bayParts` is cached per minute (cheap every frame) and returns a copy.

### 4.4 `data/playSave.ts` + `data/save.ts`

```ts
export const PLAY_BIT_KINDS = ['coin', 'cache', 'ring', 'egg', 'view', 'sound', 'pebble', 'stamp', 'own', 'souvenir', 'page'] as const;
export const WEAR_SLOTS = ['baybay-scarf', 'baybay-hat', 'player-hat', 'player-pack', 'bike', 'car', 'pelican', 'frame'] as const;
export interface PlaySaveV1 {
  v: 1; c: number;                                   // coins, integer 0..999999
  g: Partial<Record<(typeof PLAY_BIT_KINDS)[number], string>>;   // base64 bitsets over each kind's append-only registry, ≤ 256 chars each
  t?: { d: string; b: string };                      // today's trail bitset + its Bay date
  w?: Partial<Record<(typeof WEAR_SLOTS)[number], number>>;      // worn item index per slot, 0..255
  b?: Record<string, number>;                        // activity bests, ≤ 32 finite numbers, keys [a-z0-9:-]{1,40}
  d?: { d: string; m: number };                      // 今日三件小事: Bay date + done mask 0..255
  e?: string[];                                      // one-off reward sources not covered by a bitset, ≤ 128, each ≤ 40 chars
}
export function decodePlay(raw: unknown): PlaySaveV1 | undefined;
export function bitGet(b64: string | undefined, i: number): boolean;
export function bitSet(b64: string | undefined, i: number): string;
export function bitCount(b64: string | undefined): number;
export function normalBits(b64: unknown): string | undefined;
export const emptyPlay: () => PlaySaveV1;
// constants: MAX_COINS 999999 · MAX_BITSET_CHARS 256 · MAX_PLAY_BITS 1536 · MAX_BESTS 32 · MAX_ONE_OFFS 128 ·
// MAX_ONE_OFF_CHARS 40 · MAX_WEAR_INDEX 255 · PLAY_DATE_RE · ONE_OFF_RE

// data/save.ts
interface SaveV2 { …; play?: PlaySaveV1 }           // decodeSave learns it (untrusted input)
export const SAVE_TRIM_DISCOVERED = 500, SAVE_TRIM_ARRIVALS = 128;
export function encodeSave(s: SaveV2): string;       // ≤ SAVE_MAX_BYTES (64 KB) always
```

- Bitsets: bit `i` in byte `i >> 3`, bit `i & 7` (least significant first), standard base64 **without padding**,
  trailing zero bytes trimmed (the empty set is `''`). Registries are **append-only**: an index never moves.
- `encodeSave` over 64 KB: 1. `discovered` → the newest 500; 2. `arrivals` → the newest 128; 3. drop `discovered` and
  `arrivals`; 4. drop `zones`, `rides`, `vehicles`. `version`, `lastSafe`, `unlocked`, `tours`, `play` and `savedAt`
  are always written. The size test builds every cap (2,000 discovered, 512 arrivals, 8 tours × 64 stops, a full play
  block) with realistic and with the longest ids.
- Lane E's ledger is the only writer of `play` (through `patchSave`); others read it through E's API.

### 4.5 `ui/slots.ts` (render points wired on day 0)

```ts
export function registerJournalTab(t: { id: string; order: number; label: Bilingual; icon: ComponentType; count?: () => string | undefined; load: () => Promise<{ default: ComponentType }> }): () => void;
export function registerMoreItem(m: { id: string; order: number; label: Bilingual; icon: ComponentType; onSelect: () => void }): () => void;
export function registerPillBadge(p: { id: string; order: number; Component: ComponentType }): () => void;
export function registerOverlay(o: { id: string; Component: ComponentType<{ props?: unknown; close: () => void }> }): () => void;
export function registerAskItem(a: { id: string; order: number; label: Bilingual; icon: ComponentType; onSelect: () => void; visible?: () => boolean }): () => void;
export function openJournal(tab?: string): void;
export function openOverlay(id: string, props?: unknown): void;
export function closeOverlay(id: string): void;
// also exported: JOURNAL_BUILTIN_ORDER { cards 10, goals 20, wish 30, steps 40 } · MORE_BUILTIN_ORDER { photo 10, settings 90 }
// the registries (journalTabs, moreItems, pillBadges, overlays, askItems: .list / .subscribe / .get), openOverlays,
// subscribeOverlays, closeTopOverlay, visibleAskItems, runAskItem, runMoreItem, lastJournalRequest,
// subscribeJournalRequest, bindJournalOpener (flow's)
```

| slot | where it renders | rules |
|---|---|---|
| Journal tab | `ui/Journal.tsx`, merged with the built-in tabs by `order` | `openJournal(tab)` opens on it (or switches while open); the body loads on first view (翻开中…); an id equal to a built-in one is ignored |
| More item | phones: the bottom bar's 更多 menu, merged with 拍照 (10) / 设置 (90); desktop: a 更多 round button between 拍照 and 设置 that **exists only while an item is registered** | `onSelect` runs after the menu closes |
| pill badge | inside the free-roam objective pill, after 明信片 n/m (`明信片 3/24 · 🪙 42`) | phones: the badges take their own line when they do not fit; keep a badge ≤ 6 characters |
| overlay | `ui/Overlay.tsx`, above the HUD and the panels, under the dialogue box | `openOverlay(id, props)` (again = to the top with new props); Escape closes the newest; unregistering closes it |
| ask item | the 问 BAYBAY menu (`flow.openCallMenu`, DialogueAction `{ type: 'ask', id }`) | `order < 0`: above BAYBAY's own choices; `order ≥ 0`: after them, before 打开地图 / 没事，继续逛; `visible()` asked at each open; the icon shows before the label |

Every `register*` returns its unregister; the same id again replaces the earlier entry (last wins). Register from your
feature's `init()` (lazy), never from a module GameRoot imports statically.

### 4.6 `game/interactables.ts` (type by the lead; the file stays C's)

`InteractableSource` adds `'activity' | 'find' | 'shop' | 'event'`; `Interactable` gains `act?: () => void`
(`verb: Bilingual` already existed and stays required: it is the button label, 滑下去 · 比赛？ · 摇铃). `game/flow.ts`
`performInteraction` calls `it.act()` **instead of** the built-in action switch for those four sources
(`ACT_SOURCES`, exported); `action` still picks the prompt's icon (`'info'` when nothing fits). Register them with
`registerInteractables(key, fn)` as the residents do.

### 4.7 `actors/charApi.ts` (interface only; lane F implements it by W5-F2)

```ts
export const EMOTES = ['wave', 'cheer', 'clap', 'point', 'pose', 'dance', 'lie', 'sit', 'float', 'pet'] as const;
export interface CharApi {
  emote(who: 'player' | 'baybay', name: (typeof EMOTES)[number], opts?: { loop?: boolean; seconds?: number }): void;
  sitGround(pose: { x: number; z: number; heading: number }): boolean;
  stand(): void;
  attach(who: 'player' | 'baybay', slot: 'head' | 'neck' | 'back', obj: import('three').Object3D | null): void;
  tint(who: 'player' | 'baybay', part: 'scarf' | 'hat' | 'pack', color: number | null): void;
  vehiclePaint(kind: 'bike' | 'car' | 'pelican', id: string | null): void;
  glideSoftBox(key: string, box: { minX: number; minZ: number; maxX: number; maxZ: number; minY?: number } | null, line?: Bilingual): void;
}
export function setCharApi(impl: CharApi | null): void;
export function charApi(): CharApi | null;      // null until F registers: skip the flourish, never throw
```

### 4.8 `audio/hooks.ts` (API frozen; lane T owns the internals)

```ts
export function registerSound(id: string, recipe: (e: AudioEngine, opts?: { gain?: number; pan?: number; pitch?: number }) => void): () => void;
export function playSound(id: string, opts?: { gain?: number; pan?: number; pitch?: number }): void;
export function registerLoop(id: string, recipe: (e: AudioEngine) => { setGain(g: number): void; stop(): void }): () => void;
export function setLoop(id: string, gain: number, fadeMs?: number): void;   // default fade 400 ms
export function audioNow(): number;              // AudioContext.currentTime (s) while running; performance clock (s) before
export function duck(bus: 'music' | 'ambience', amount: number, ms: number): void;
// internals for audio/audio.ts (T may change them): bindAudioHooks(engine | null, live?), stepAudioHooks(dt), audioHooksStats()
```

The day-0 implementation works: `audio/audio.ts` binds the live engine when audio goes live, steps the loop fades on its
10 Hz tick, and unbinds on teardown. Sounds play only while audio is live and sound is on; a loop is built on its first
gain > 0 and stopped (nodes released) after fading to 0. `audioNow()` changes base once, at the first gesture: compare
only times read in the same state (PlayKit judges inside an activity, which always starts from a gesture).

### 4.9 `game/w5Features.ts` + the four stubs

```ts
export const W5_FEATURES = ['economy', 'play', 'eggs', 'realsf'] as const;       // the frozen order
export const W5_LOADERS: Record<W5FeatureId, () => Promise<{ init(): () => void }>>;   // import('../economy/index') …
export function initW5Features(loaders?): { off: () => void; ready: Promise<void> };
```

`game/cityContent.ts initCityContent` (city mode only; it returns early in district mode) calls `initW5Features()`
once. The four chunks load in parallel; `economy.init()` runs first (its `reward` listener is live before any other
feature can emit), then play, eggs and realsf; a failed load or init stops nothing else; teardown in reverse. The stubs
`economy/index.ts`, `play/index.ts`, `eggs/index.ts`, `realsf/index.ts` export `init(): () => void` and do nothing:
replace their bodies, keep the signature, and keep every other module of your folder behind your `index.ts` (the
contracts test walks GameRoot's static graph and fails if a feature folder enters it).

## 5. Cross-lane hooks to land first (each lane's first push, day 1 — plan §4.3)

| from | what | used by |
|---|---|---|
| F | `charApi` implementation (dance loop, lie, sit ground, float, pet; attach / tint for BAYBAY and the player; vehicle paints via `BIKE_LIVERIES`; `glideSoftBox`); `self-tap` events; `faceOpen(x, z)`; 起飞 always visible | A, E, R, N, D |
| N | `goTo(target: { placeId?: string; point?: Vec2; name?: Bilingual }, opts?: { prefer?: 'fly' \| 'ground'; source?: string })`; `registerFlagSource(key, fn)` in `game/flags.ts`; `FootprintsTab` exported for embedding | R, D, E, C |
| C | `bubble()` / `markGoalsDone()` documented as the public line and goal API; `registerRumourSource(fn)`; `registerFrameDecorator(id, draw)` in photo; the welcome / resume hook `onWelcome(kind: 'new' \| 'returning')` | D, E, R, N |
| T | `addCrowdSpots(key, spots, { face?, count? })` / `removeCrowdSpots(key)` with the 3 u clear-lane rule; `rideEta()` from real progress; the turntable push beat + boost hook; the ride banner's bell pad slot; crowd walkers answer `emote` wave within 6 u | R, L, A, N |
| E | the ledger listener live (pays `reward`, emits `coins`); `coinsTotal()`; `hintTarget(kind)` for the compass / magnifier | everyone who emits `reward` |
| D | `eggs/registry.ts` ids + riddles | E (notebook), C (rumours) |
| A | `play/viewSpots.ts` ids; the first-flight entry `startFirstFlight()` | E (notebook), C (unlock moment) |
| R | `sunBandAt(date)`, `isFireRingLit(date)`, `activeEventsAt(date)`, `eventVenue(id)`, `moonPhase(date)`, `karlMonthFactor(date)` | N (qa.ts is R's), L, V, C, E, D |
| V | the warm-up registration recipe for new instanced materials (documented, one example); the flag glyph atlas at 512² with coin / calendar / sparkle / music glyphs (day 2) | E, R, A, D, N |

Until a hook lands, code against its signature above and guard the call (a feature must load and do nothing harmful
without it). Put the hook in its own small module where you can, so the users' chunks stay small.

## 6. Baseline (W5-0a = the wave-4 final verify, `sf-w4-final-verify.md`, alone on the machine, `1d2cd76`)

Owner's machine: Ryzen 9 5900HX, RTX 3070 Laptop (`--force_high_performance_gpu`), AMD iGPU for the second phone run;
Chrome 153 headless; `scripts/opus-sf/qa/perf/w4-perf.mjs` with `w4-spots.json`.

| spot | desktop 1440 × 900 high, RTX: calls · tris · fps walk | phone 390 × 844 dpr 3 mid, 4× CPU: calls · tris · fps idle / walk |
|---|---|---|
| ferry-gate | 103 · 398k · 60.1 | 84 · 315k · 59.7 / **51.8** (iGPU 51.4) |
| chinatown | **125** · 392k · 60.1 | 102 · 317k · 60.1 / 60 (iGPU 59.4) |
| twin-peaks | 122 · 379k · 60.1 | 93 · 260k · 60 / 60.1 |
| ocean-beach | 46 · 106k · 60.1 | 39 · 100k · 59.7 / 60.1 |
| ggb-south | 52 · 111k · 60.1 | 47 · 105k · 60.1 / 60.1 |
| mission | 79 · 328k · 60.1 | 67 · 253k · 60.1 / 60.1 |
| union-square | 87 · 285k · 60.1 | 71 · 227k · 60.1 / 60.1 |
| civic-center | 78 · 263k · 60.1 | 67 · 214k · 60.1 / 60.1 |
| music-concourse | 89 · 251k · 60.1 | 71 · 178k · 60.1 / 60.1 |
| stonestown-sfsu | 71 · 204k · 60.1 | 62 · 155k · 59.8 / 60.1 |
| haight-usf | 94 · 291k · 60.1 | 75 · 215k · 60.1 / 60.1 |
| grace-nob-hill | 111 · **398k** · 60.1 | 97 · 363k · 60.1 / 60.1 |
| powell-market | 107 · 393k · 60.1 | 89 · 329k · 58.9 / 60.1 |
| bus-palace (ride) | 78 · 288k · (60.1) | 74 · 275k · (59.3) |
| n-duboce (ride) | 78 · 266k · (60.1) | 68 · 229k · (59.1) |
| m-west-portal (ride) | 71 · 243k · (60.1) | 67 · 234k · (59.6) |

- Programs 58 (desktop) / 55 (phone), first = last; 0 frames > 100 ms anywhere; p95 16.7–16.8 ms (phone Ferry gate
  walking 33.3).
- **Headroom is thin downtown**: the Ferry gate and Grace / Nob Hill sit at 398k of the 400k budget, Union Square's
  arrival view measured 406–409k in the wave-4 V review, Chinatown uses 125 of 150 calls. Nothing new goes downtown (the
  Ferry gate, Chinatown, the Financial District, Union Square) until lane V publishes the measured headroom after the
  levers (plan MF9, D15).
- Bundle: GameRoot **292.4 KB gzip** (target ≤ 265 at W5-Z, 250 stretch). The day-0 glue added to the main graph is
  small (`ui/slots.ts`, `game/w5Features.ts`, `game/bayNow.ts`, `data/playSave.ts`, `audio/hooks.ts`, the render points);
  lane V measures it with the first bundle numbers.
- Budgets for every wave-5 change: ≤ 150 calls and ≤ 400k triangles (shadows included) at quality high in every spot of
  the gate table (plan §4.9); phone ≥ 45 fps at 4× CPU; GameRoot ≤ 265 KB gzip; every new material warmed and never
  shared across object kinds; city-only code behind `world/cityLoader.ts` or a lazy chunk.

## 7. Builds and dates (plan §4.14; all times PT)

| when | what |
|---|---|
| **Mon Sep 28 (day 0)** | W5-0a (covered, §6) · W5-0b hotfix `826c658` (+ the phone package on 4174 the same day, lead) · W5-0c merge `27073fd` · W5-0d `436c888` · this note. Lanes start as soon as W5-0d is pushed (rebase on it). |
| **Day 1 (Tue Sep 29)** | every lane's §5 hooks first; V publishes the baseline on the new head and the downtown headroom; F starts the sweep (run 1 by the end of day 2). |
| **Build 1 — Thu Oct 1, 20:00** (Hardly Strictly opens Fri Oct 2) | MF1 (lead + F1) · 起飞 always visible + the pelican goal first (F3, C2) · resume + welcome back (N6, C3) · real sun + fire-ring season + `?date=` (R1, L2) · the venue table + HSB / YBG / Castro presence (R2, R3; **cut rule: not green by Oct 1 18:00 → HSB and Castro become 2027 calendar config**, only the venue table and flyers ship) · the first levers (V2, F8, T4 first parts). |
| **Build 2 — Wed Oct 7, 20:00** (Fleet Week air show Fri Oct 9) | MF2 sweep 0 stuck, the bus, the GGB deck (F, T, L, N, C) · MF4 one tap (N) · coins + ledger + pill + notebook (E1–E5) · the pelican moment + first flight (C2, A5) · the 今天 tab + the daily three (R4, R5) · **Fleet Week jets (R6; cut rule: in the owner's build by Oct 7 20:00 or 2027 config)** · all levers + the bundle move (V2, V3) · emotes, pet, sit (A2–A4). |
| **Mid-wave checkpoint** (lead, after build 2) | the gaps scout's 20-minute phone script and the sweep again; **the five owner points must pass before any should item starts.** |
| **Build 3 — Wed Oct 14** | the shop and wearables (E6, E7, prices from E8) · slides / bell / stairs (A6–A8) · eggs 1–24 and rumours (D3–D5) · corners 1–4 (+ 5–8 as ready) and lit nights (L4, L5, V5) · the green shoulds (marshmallow first: the fire season ends Oct 31). |
| **W5-Z verify — Fri Oct 16** (lead) | tsc, eslint, the full suite; the sweep (0 stuck); the lock paths on the phone profile; the save size test; the perf gate alone (RTX + iGPU) and the phone profile; a real iPhone pass; the production-header check; the Grand Tour timed; `sf-w5-summary.md`; ledgers → ASSETS-LEDGER; STATUS / RESUME. |
| **Live checks** (lead) | Fri Oct 9 12:30 (the jets are up) · Sat Oct 31 (Halloween dressing if built; the last day of the fire season and of the catalog's events) · Sun Nov 1 (DST ends: the sun bands). |

## 8. Higgsfield (W5-0g, read-only on day 0)

- `balance` on **2026-09-28 08:37 UTC (01:37 PDT)**: **400.07 credits**, plan `ultra`. This matches the plan's 400.07 at
  01:28 UTC (the brief's "≈ 410" was an estimate).
- `transactions` (newest first, 20 read): nothing since **2026-09-28 01:26:49 UTC**. The last spends are wave 4's: four
  Qwen Audio 3.0 TTS Flash lines at 01:26:32–01:26:49 UTC (0.06 in all; lane V's final voice fixes); Nano Banana Pro ×7
  (14.00) and one 3D Objects (1.00) at 2026-09-27 22:16–22:20 UTC (lane V's Holy Virgin re-fit, noted in `sf-w4-lead.md`
  §8.2); Qwen TTS lines at 19:29 UTC. No wave-5 job has run yet.
- **Wave-5 cap 130 credits, lane V only** (plan §5: expected ≈ 99); **the balance never goes under 250** (the owner's
  floor is 80; we keep more for later polish). Stop rules: reject any draw with text, logos, a base or clipped edges
  before paying the next step; two failed models in a row → no more models; spend past 100 → only H5-1, H5-3, H5-8
  continue. No image of a real person, real insignia, a real mural or artwork, or a brand.
- Every batch: `balance` before, `transactions` after (attribute by job id and time, never by the balance difference),
  the CDN check, a row in `docs/opus-bay/ledger/w5-V.md` (columns of `ASSETS-LEDGER.md`). Other lanes put asset requests
  in their report's Requests for V.

## 9. Day-0 decisions (where this note differs from, or adds to, the plan)

1. **`Interactable.verb` stays required.** The plan wrote `verb?: Bilingual`; the field already existed as required (the
   prompt's label), so only `act?` was added. `ACT_SOURCES` (flow) is exported so tests and lanes can read the rule.
2. **Ask-item order convention**: `order < 0` above BAYBAY's own choices (A's emote row "at the top of the sheet"),
   `order ≥ 0` after them and before 打开地图. The menu is a dialogue: ask items are choices (`DialogueAction { type:
   'ask'; id }`, new in `core/types.ts`) with the registered icon before the label; with more than nine choices the
   tenth has no number key.
3. **The desktop 更多** exists only while a More item is registered (the HUD had no More on desktop; district mode never
   registers one, so the district HUD is unchanged). Photo and settings keep their own round buttons on desktop.
4. **`openJournal` without an import cycle**: `ui/slots.ts` imports no game code; `game/flow.ts` binds the opener
   (`openPanel('journal', tab)`), and the Journal also follows each request's `seq`, so asking for the same tab again
   switches back to it.
5. **`?date=` scope**: DEV or `VITE_OPUS_QA=1` builds only (§4.3). Node tests use `__setBayNowForTests`. `bayParts`
   adds `weekday` 0 = Sunday and `dateKey`; `parseBayDate` is exported for R's tests and the QA scripts.
6. **`play.e` ids** follow the reward grammar's shape and are ≤ 40 characters (`ONE_OFF_RE`); the plan fixed only the
   count and length. Bitsets are unpadded base64 in a normal form (so equal sets are equal strings).
7. **`encodeSave` goes past the plan's two trims** (drop discovered / arrivals, then zones / rides / vehicles) so that no
   input can ever push the essentials out; the kept core at its longest is < 48 KB.
8. **`initW5Features` returns `{ off, ready }`** (the list and the order are frozen; `ready` lets tests and QA wait for
   the four inits). The other three chunks are fetched in parallel with the economy, initialised after it.
9. **Audio hooks internals**: `bindAudioHooks` / `stepAudioHooks` / `audioHooksStats` are exported for `audio.ts` and
   tests and are **not** part of the frozen API (lane T may change them). `duck` does nothing before audio is live.
10. **Phone pill**: with a badge registered the pill's first line may wrap (the badge on its own line, no leading dot)
    inside its `min(58vw, 250px)`; lane F owns the final look (W5-F9 layout pass), lane E the badge's content.

## 10. Docs updated on day 0

- `src/opus-bay/DESIGN.md` §8: the verified real-world calendar carve-out; no pressure mechanics; coins never buy speed
  or access.
- `src/opus-bay/data/VOICE.md`: the wave-5 glossary rows (金币 never 硬币, 小铺, 手帐, 小发现, 看风景, 今日三件小事, 飞行券).
