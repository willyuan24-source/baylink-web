# Opus Bay — status (rewritten 2026-09-29, wave 6, lane K2)

A cozy 3D toy San Francisco with BAYBAY the sea otter, at **`/opus-bay`** in the BAYLINK site. **Live** since
2026-09-29 at https://www.baylink.us/opus-bay (deployed from `main`; development on the `opus-bay` branch).

## What a player gets

- **`/opus-bay` opens the whole city** (default world `'city'`, W5-Z `a2ca9204`). `?world=district` is the original
  Embarcadero district (Ferry Building → PIER 39), kept exactly as it was (the hero regression test pins it).
- Title → 开始 (or 继续旅程 on a saved spot) → BAYBAY's welcome (Grand Tour · this week · 我自己逛逛) → the goals step
  (goal #1: meet the pelican at Coit Tower, then fly anywhere) → free roam: walk, run, jump, the pelican glide, the bike
  and toy car, cable cars, the F-line, the loop bus, the Muni Metro N / M, the ferry; the map (2 taps to go anywhere),
  the 旅行本 (今天 · postcards · goals · 手帐 · 相册), coins and the 小铺, activities, eggs, the real sun and real events.
- Languages: 简体 · 繁體 · English (title pills and Settings; 繁體 through the site's opencc conversion).
- Wave 6 (2026-09-29, in progress): Halloween (1 Oct – 2 Nov; preview any day with `?halloween=1|night|muertos`),
  more of the city, fixes. The plan and the lane table: `docs/opus-bay/sf-w6-lead.md`.

## Run it

- Dev: `npx vite --config vite.opus.config.ts --port <port> --strictPort`, then `http://localhost:<port>/opus-bay`
  (`?world=city|district`, `?start=free`, `?save=off`, `?quality=low|mid|high`, `?time=…`, `?at=<place | xz:x,z>`,
  `?debug=1`; `window.__opusBay` in DEV).
- Screenshots / QA: `node scripts/opus-shot.mjs` (read its header; `--mobile --dpr 3` for 390 × 844;
  `CHROME_FLAGS=--force_high_performance_gpu`). Phones are first-class (390 × 844 and 375 × 667, touch).
- Checks before every push: `npx tsc -p tsconfig.app.json --noEmit` (0) · `npx eslint .` (0 errors, the whole repo) ·
  `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` (fail 0; ≈ 1400 tests on 2026-09-29).

## Numbers (the W5-Z final verify, `docs/opus-bay/sf-w5-final-verify.md`, 2026-09-28)

- Desktop: max 119 draw calls / 352k triangles over 20 spots (budget 150 / 400k), 60 fps; phone at 4× CPU throttle:
  min 52.8 fps.
- First load: `GameRoot` 298.62 KB gzip (target ≤ 265 KB: wave 6 lane P).

## Code map (`src/opus-bay/`)

| folder | what |
|---|---|
| `core/` | stores (`store.ts`), events (`events.ts`, frozen), input, terrain, runtime |
| `world/` | the scene: the district, the streamed city (`world/sf/`), transit systems, sky, water |
| `actors/` | the player, BAYBAY, the crowds, movement, the camera, vehicles |
| `game/` | the flow: dialogue, trips and 带我去, rides, the tour, goals, the player lock and its watchdog, discovery |
| `ui/` | the HUD, the map, the 旅行本, cards, overlays, Settings |
| `economy/` | coins, the ledger, the 小铺, the 手帐 |
| `play/` · `eggs/` · `realsf/` · `halloween/` | activities · finds and eggs · the real San Francisco (sun, events, live data) · the season |
| `audio/` · `data/` | sound and voice · the content (`data/VOICE.md` is the zh glossary) |

## Where to read on

1. `src/opus-bay/RESUME.md` (newest first: state, rules learnt, how a new session continues).
2. `docs/opus-bay/sf-w5-summary.md` (wave 5 and §5 NEXT) and `docs/opus-bay/sf-w6-lead.md` (wave 6).
3. `src/opus-bay/DESIGN.md` (the design), `src/opus-bay/ASSETS-LEDGER.md` (every generated asset and its credits).
