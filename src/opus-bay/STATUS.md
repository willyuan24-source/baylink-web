# Opus Bay — status after integration (v1, 2026-09-25)

Route `/opus-bay` in the worktree `C:\Users\willy\baylink-opus` (branch `opus-bay`, nothing committed yet).
All modules (district, content, audio, assets, flow-ui, world, actors) are in and wired together.
QA screenshots: `C:\Users\willy\opus-qa\` (files named `int-*` are from the integration pass).
QA scripts: `C:\Users\willy\opus-qa\int\` (`run.mjs <scenario>`, `perf.mjs <anchor> <time> [m]`, `s-*.mjs` scenarios).

## Checks

| check | result |
|---|---|
| `npx tsc -p tsconfig.app.json` | 0 errors (whole project) |
| `npx eslint src/opus-bay tests/opus-bay-*` | 0 errors, 0 warnings |
| `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` | 81 / 81 pass |
| `npx vite build --config vite.opus.config.ts` | builds (18.8 s) |
| console during all smoke runs | 0 errors, 0 exceptions; 1 warning (`THREE.Clock` deprecated — from R3F 8 internals) |

## What works (end-to-end, verified in headless Chrome with real GPU)

- **Title** (DOM, key art, zh / en): `int-01-title.png`, `int-z1-title.png`, mobile in `int-8x-mobile-sheet.png`.
- **Start → arrival cinematic** (ferry glides in, caption, skippable): `int-02-arrival.png` (night), `int-m1-arrival.png` (mobile).
- **Intro dialogue with the 4 choices** (hotkeys 1–4, BAYBAY portrait, over-the-shoulder camera so her face shows): `int-c1-intro.png`, `int-z2-intro.png`, `int-m5-intro-night.png`.
- **① Tour, all 7 stops** — an autopilot run finished the whole tour (ferry clock → market taste → Pier 7 fishing → Exploratorium → Filbert Steps climb → Coit viewpoint → sea-lion photo → recap) in ≈2.5 min with no errors: `int-t-sheet.png`.
  - camera turns toward where BAYBAY is leading: `int-c3-tour-lead.png`; arrival two-shot `int-e4-tour-arrive.png`
  - bell = low-angle look up the clock tower: `int-d1-bell.png`; real-info card with BAYLINK links: `int-21-poi-card.png`, `int-22-card-sealions.png`
- **② This week** — 3 questions → BAYBAY walks you to the board → 5 real flyers from `/planner-catalog.json` (next 7 days, honest "relaxed filters" note): `int-30-week-q1.png`, `int-34-week-board.png`.
- **③ Free roam** — goals card, walk / run / jump, click-to-walk, postcard pickup + reward flip, journal, map, settings, photo mode:
  `int-40-free-goals.png`, `int-71-postcard.png`, `int-72-postcard-b.png`, `int-73-journal.png`, `int-70-map.png`, `int-74-settings.png`, `int-75-photo.png`, `int-f2-sealion-photo.png`.
- **Streetcar** — Green St → Ferry Building with the world's real car (wait → board → ride → arrive, goal counted): `int-51-ride-wait.png`, `int-53-ride-b.png`, `int-54-ride-c.png`.
- **Filbert Steps → Coit viewpoint** — climb to y = 20, sweep over Alcatraz and the Bay Bridge, map unlocks: `int-61-steps-climb.png`, `int-62-coit-view.png`, `int-d-sheet.png`, `int-65-coit-after.png`.
- **Telescopes** — Pier 14 (Bay Bridge span, Yerba Buena), Pier 33 (Alcatraz, Angel Island): `int-d2-tele-bridge.png`, `int-d-sheet.png`.
- **Night** (`?time=night`, and the real Bay clock after 19:00): `int-90-night-clock-b.png`, `int-91-night-over-b.png` (before the fix: `int-perf-ferry-clock-night.png`).
- **Mobile portrait** (390×844): `int-m-sheet.png`, `int-m-night-sheet2.png`, `int-8x-mobile-sheet.png`.
- **Chinese UI**: `int-z-sheet.png`. **`?debug=1` overlay**: `int-g1-debug.png`.

## Performance (walk mode, 1440×900 unless noted, quality high)

| spot | draw calls | triangles (incl. shadows) | scene objects | fps 1× | fps 4× CPU throttle (idle / walking) |
|---|---|---|---|---|---|
| Ferry gate, golden | 55–56 | 144k | 264 | 60 | 59 / 59 |
| Sea-lion viewpoint, golden | 53–57 | 179–186k | 264 | 60 | 60 / 58 |
| Coit viewpoint, golden | 61 | 190–191k | 264 | 60 | 49 / 53 |
| Ferry clock, night | 63–64 | 220–223k | 264 | 60 | 60 / 54 |
| Pier 39, mobile 390×844, day | 52–54 | 157k | 264 | 60 | 60 / 60 |
| Coit, mobile, night | 57–58 | 155k | 264 | 60 | 60 / 60 |

Budgets (DESIGN §9: ≤150 calls, ≤400k tris, ≤500 objects, ≥45 fps at 4×) are met everywhere measured.
World build ≈0.46–0.50 s once per page; world update ≈0.25 ms idle, ≈1.0–1.3 ms per frame walking (under 4× throttle).

## Bundle (production build, gzip)

| chunk | min | gzip | note |
|---|---|---|---|
| `OpusBayPage` | 1.45 kB | 0.94 kB | route entry |
| `GameRoot` | 546.8 kB | **198.6 kB** | all Opus Bay code + three/examples (~44 kB min) |
| `OpusBayPage.css` | 67.8 kB | 14.1 kB | |
| `react-three-fiber` (+ three core) | 874.3 kB | 233.6 kB | shared vendor chunk (also used by the site's Little Bay) |
| site shell `index` / `react-vendor` | 937.6 / 188.9 kB | 334.7 / 61.4 kB | loaded by every route, not Opus Bay's |

Assets: all of `public/opus-bay` is 2.1 MB; the title needs one key-art image (37–107 kB); GLBs (176–223 kB each) load lazily after start.

## Integration changes (all small, surgical)

- **Night was too dark to read** (the default after 19:00 Bay time): brighter "blue hour" night preset (`world/palette.ts`), and the characters' night self-light was computed but never reached the shader — wired `charGlow` into the character material (`actors/models.ts`).
- **Camera** (`actors/camera.ts`):
  - bug: the idle check compared the R3F clock (s) with `performance.now()` (ms), so the lazy re-centre stopped forever after the first camera drag — fixed;
  - portrait phones get a wider vertical FOV (horizontal view ≈19° → ≈29°);
  - gentle yaw assists, never while the player steers the camera: face where BAYBAY leads when a guided walk starts; over-the-shoulder two-shot when a conversation with BAYBAY opens; swing to a clear view when a building has sat between camera and player for 0.6 s (the Ferry Building back plaza: `int-c-occl-sheet.png`); one-shot "face this" requests from game flow (photo spot → sea lions in frame).
- **Moments** (`game/flow.ts`, `game/interactables.ts`, `game/cinema.ts`): bell interaction looks up at the clock face; the Coit sweep and telescopes aim at the real Alcatraz / Bay Bridge models (Bay Bridge subject moved from the SF anchorage to the main span, telescope keeps enough distance to frame it); goal ids de-duplicated; photo mode turns the camera to its subject.
- **Settings persistence** (`data/wishlist.ts`, `ui/Settings.tsx`, `world/WorldScene.tsx`): URL-forced settings (`?time=`, `?quality=`) and the adaptive-quality step-down now apply to the visit only; an explicit choice in Settings is saved. (Before, one QA link or one load hitch changed the saved time of day / quality for good.)
- **Mobile HUD** (`opus-bay.css`, `actors/TouchControls.tsx`, `game/Systems.tsx`): the mobile goals-card rules never applied (source order) — fixed, and it now sits under BAYBAY's bubble; the one-time touch hint waits until the player can move (it used to expire behind the title) and sits bottom-centre; speech bubble and waypoint clamp clear of screen edges / the top HUD row.
- **Lint**: hooks moved from `ui/common.tsx` to new `ui/hooks.ts` (Fast Refresh warnings gone).
- **Contract change (one)**: `game/GameRoot.tsx` `shadows={quality !== 'low' ? 'percentage' : false}` (R3F was re-applying the removed PCFSoft type every render). No `core/*` changes.
- Tests: tour test steps the new camera moment; new persistence test; import path update.

## Known issues (ranked)

1. **Page weight.** Opus Bay's own chunk is 198.6 kB gzip, but a cold visit also downloads the shared three/R3F chunk (233.6 kB) and the site shell (334.7 kB), and the DOM title lives inside `GameRoot`, so it paints only after all of that. Fix: split the title into `OpusBayPage`, lazy-load audio (~55 kB min) and the panels (map / journal / week / settings), consider a lighter shell for `/opus-bay`.
2. **Voice clips to check by ear**: `zh-yay` (heard as 讨厌), `zh-think` (untranscribable), `zh-arrived` (heard as 到了).
3. **Camera assists are heuristics.** Dialogue two-shots next to walls can still look through a dithered wall (e.g. the clock-tower "done" lines, `int-e-sheet.png`); the streetcar body can sit between camera and rider (`int-53-ride-b.png`).
4. **Gamepad** mapping is implemented but untested (no pad in headless runs).
5. `THREE.Clock` deprecation warning from R3F 8 on every load (harmless; goes away with an R3F upgrade).
6. Streetcar: the rider stands on the car's side step; rides toward the Ferry Building use the landward track (small sideways shift when boarding).
7. The jogger has lines in `script.ts` but, as a moving NPC, isn't interactable.
8. Photo mode saves a PNG download on every shutter press (as briefed; may surprise).
9. No resident portraits yet (icon badges); zoomed-in map labels can crowd; on mobile an open bottom sheet can hide BAYBAY's bubble.
10. No bloom pass (night glow = emissive + sprites). `public/opus-bay/README.md` is publicly served (provenance only).

## Next polish ideas

- Owner playtest (desktop + phone, day and night), then 2–3 critic → fixer rounds and the head-to-head with `/play`.
- Page-weight split above; preload the GLBs during the arrival cinematic.
- Dialogue camera: pick two-shot yaws with the same occlusion test used for walking.
- Sit on benches; BAYBAY reacts to sea-lion barks; a seat inside the streetcar.
- Warm lamp light pools on the promenade at night; a subtle bloom on the high tier.
- Resident portraits; make the jogger talkable when paused at a loop end.
