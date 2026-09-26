# BAYLINK · Opus Bay — design bible (v1)

Route: `/opus-bay` (standalone, full-screen, outside the site AppLayout).
Everything lives in `src/opus-bay/**` and `public/opus-bay/**`. Do NOT import from or modify
`src/features/little-bay/**` (another team's code) and do NOT modify site data files
(`src/data/**`, `public/*.json`). Reading published site data at runtime (fetch `/planner-catalog.json`,
`/baybay-guides.json`) and linking to site pages (`/guides/:slug`, `/events/:id`, `/plan?...`, `/my-week`)
is the intended integration. Reusing site infra read-only is OK (`src/i18n/locale.ts` `useLocale`,
`translateText`, `simplifySearch`; `src/lib/planner.ts` `todayInBay`, `validDay`).

Stack: React 18, @react-three/fiber 8, drei 9, three 0.186 (WebGL2 only). No new npm dependencies.
`three/examples/jsm/**` (BufferGeometryUtils, EffectComposer passes, GLTFLoader, etc.) is available.
Blender 5.2 is installed locally (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`) for offline asset cleanup.

## 1. Fantasy and pillars

**"You just arrived in the Bay. BAYBAY — the brand's cream-white sea otter — meets you at the ferry and shows you around."**

1. **Guided or free, your choice, in the first 20 seconds.** A friendly guide asks what you want; newcomers are never lost.
2. **A tiny place that feels alive.** One dense, handcrafted district: the San Francisco Embarcadero waterfront, Ferry Building → Pier 39, with Telegraph Hill / Coit Tower behind it. Every few seconds of walking there is something to look at, poke or learn.
3. **Real, current, useful.** Every landmark carries verified real info and links into BAYLINK (guides, this week's events, plan an outing). Weekly events come live from BAYLINK's published catalog.
4. **Toy-like feel.** Squash-and-stretch characters, sound on every action, things that react when you bump them, a camera that never loses you.
5. **Beautiful diorama.** Brand look: a miniature diorama slab floating on a warm cream table (see `public/brand/bay-area-diorama-v2.webp`), soft golden light, visible cut edges of land and water.

## 2. Characters

- **Player: "新朋友 / the newcomer."** Small round traveler (height ~1.5u) with a teal backpack, rolled map and a bucket hat. Colors: cream body `#f6ecd9`, hat terracotta `#d8744a`, backpack teal `#2f8f88`. Readable silhouette from the default camera. Idle / walk / run / jump / wave / look / sit animations are procedural (squash & stretch, bob, lean).
- **Guide: BAYBAY.** Cream-white sea otter (brand avatar: white fur `#fbf7ef`, cream belly `#f3e6cc`, black nose, dark eyes, pink tongue on smile, small whiskers, teal scarf `#1f8f8a`, orange accent dot `#e8663d` as a pin/badge). Height ~1.3u, walks upright with a waddle, tail swings, waves, points, hops. Always within reach: leads in tour mode, follows in free mode, can be called with Q.
- **Residents (ambient):** a few NPCs (vendor at the farmers market, a fisher on Pier 7, a streetcar operator, a tourist family, a jogger). Light procedural models, 1-2 lines each, clearly fictional.
- **Wildlife:** California sea lions on the Pier 39 K-Dock floats (bark, flop, jostle), gulls, pelicans gliding, harbor seal head popping up occasionally.

## 3. First minute (target script)

| t | what happens |
|---|---|
| 0–1s | Title screen (pre-rendered DOM, no WebGL needed): key art, "开始 / Start", sound toggle, language follows site. |
| 1–4s | Press start → audio unlock → ferry glides into the Ferry Building terminal (skippable 3s cinematic), gulls, foghorn. |
| 4–8s | You step onto the plaza. BAYBAY waddles up, waves: "嗨！欢迎来到湾区～我是 BAYBAY。第一次来吗？" |
| 8–20s | Choice card (big buttons, also 1/2/3/4 keys): ① 刚来湾区，带我认识一下 ② 这周有什么好玩的？ ③ 我自己逛逛 ④ 我是本地人，直接开始 |
| 20–60s | ① Tour: BAYBAY leads to stop 1 (Ferry Building clock tower / marketplace) — a micro-interaction + a real-info card. ② Week: 2 quick questions (who with / what vibe / which area), then BAYBAY walks you to the **weekly board** where 3–5 real events appear as flyers. ③ Free: BAYBAY follows; objectives card shows 3 light goals + postcards to find. |

The guide can always be re-asked: "问 BAYBAY" button / E near BAYBAY / Q to call BAYBAY over.

## 4. Modes

- **Tour (“湾区第一课”):** 6–7 stops along the waterfront (see data/pois.ts). Each stop: BAYBAY walks there (waits and waves if you lag), a 1–2 line story, a distinct micro-interaction (ring the bell, taste a sample, cast a line, look through a telescope, climb the steps, photograph the sea lions), then a real-info card with BAYLINK links + "加入想去". Ends with a recap card and the wishlist → "在 BAYLINK 安排这趟出游".
- **This week (“这周去哪”):** preference Q&A → filter live events from `/planner-catalog.json` (date window = today..+7 days in America/Los_Angeles; companions → audience/category; vibe → category/cost; region). Flyers appear on the Ferry Building weekly board; each opens an event card (date label, venue, cost label, summary, plan bullets, verifiedAt, official link, `/events/:id`, add to wishlist). If nothing matches, relax filters and say so honestly.
- **Free roam:** goals: find 8 illustrated postcards (collectibles), ride the F-line streetcar once, reach Coit Tower's viewpoint (reveals the map), photograph the sea lions, taste something at the market. BAYBAY follows and comments near POIs.

## 5. World (district data owns exact layout)

Coordinates: world units ("u"), x = east, z = south (north is −z), y up. One real geographic projection with compression (roughly 0.14–0.2 u per real meter along the waterfront) plus exaggerated landmark scale.
Walkable: Embarcadero promenade (palms, lamps, benches, bollards), Ferry Building front + back plaza (farmers market stalls on market days), Pier 14 short breakwater, Pier 7 fishing pier, Exploratorium front (Pier 15), Levi's Plaza, **Filbert Steps up Telegraph Hill to Coit Tower** (verticality + viewpoint), Pier 33 (Alcatraz landing, not boardable), Pier 39 deck with the sea-lion viewing edge.
Visual only: Embarcadero roadway + F-line tracks (streetcar runs; you can ride it), pier sheds with numbered facades, city blocks behind (merged), Transamerica, Salesforce Tower, Bay Bridge west span + Yerba Buena Island, Alcatraz with lighthouse, Angel Island, East Bay hills, sailboats, ferries.
Target walking length Ferry → Pier 39 along the promenade: 260–320u (≈ 60–75 s walk, 35–45 s run, ≈ 20 s by streetcar).
Scale: player 1.5u, BAYBAY 1.3u, promenade ≈ 8u wide, pier sheds 7–10u tall, Ferry Building body ≈ 9u with clock tower ≈ 30u, Coit Tower ≈ 16u on a hill ≈ 20u high.
The whole district sits on a diorama slab with a clean cut edge (layered earth/stone on land, glassy water thickness on the water side), floating over a warm cream "table" backdrop with soft shadow — the brand diorama look. Beyond the slab edge nothing is walkable (soft invisible wall with a gentle bump + BAYBAY line "前面是模型边缘啦").

## 6. Art direction

- Palette (sRGB): cream table `#f3ecdf`, sky top `#bfdbe6` → horizon `#f7e9d2` (day); bay water deep `#3f8f95` → shallow `#79c1bb` with foam `#f4f1e6`; land/plaza `#e7dcc5`, promenade pavers `#d9ccb3`, wood decks `#b98a5a`, grass `#9fbf7a`, trees `#6f9a5b`/`#557f47`, pier shed walls `#e9e0cf` + trim `#7f9c8f`, terracotta roofs `#d07a55`, Victorian houses pastel set `#f2c9b1 #cfe0d0 #f4e2a8 #c9d6e8 #e8c6cf`, Bay Bridge silver-grey `#b8c0c4`, Golden-hour sun `#ffd9a3`. Collectible/interaction signal color: gold `#e0a94a` only.
- Materials: matte, soft. Prefer `MeshStandardMaterial` (roughness 0.8–0.95, metalness 0) with **vertex colors** so each merged mesh needs one material. Very few distinct materials (target ≤ 20).
- Lighting: hemisphere + one directional sun with a tight shadow frustum that follows the player; baked-feeling contact shadows (blob decals) under actors/props. Time of day follows the real Bay Area clock (morning / day / golden / night) — night has warm window lights, lamp glows, Bay Bridge tower lights; user can override in settings.
- Atmosphere: exponential fog tinted to the horizon; sky dome gradient with sun disc; high tier adds a subtle tilt-shift (depth-of-field) + vignette for the miniature look.
- Water: custom shader — gentle vertex waves, fresnel tint, shoreline/pier foam from a precomputed distance texture, sparkles at golden hour. Boats leave wakes.
- Silhouettes first: Ferry Building clock tower, Coit Tower, Transamerica, Bay Bridge towers, Pier 39 entry arch and carousel, Alcatraz lighthouse must be recognizable in a 64 px thumbnail.
- No real brand logos/trademarked signage; place names rendered as plain text labels (HTML/SVG) or simple painted signs.

## 7. UX and controls

- HUD (≤ 12 % of a 390×844 screen when idle): top-left place name (fades), top-right one objective pill ("湾区第一课 2/7", "这周去哪", "明信片 3/8"), bottom-right buttons (问 BAYBAY, map, wishlist/journal, settings), bottom-center ONE contextual action pill ("E 敲钟", "E 和 BAYBAY 聊聊", "E 上电车") shown only when something is in range.
- Panels are side sheets (desktop) / bottom sheets (mobile, draggable 35/70/100 %) — the world keeps running, no blur.
- Controls: WASD / arrows by `event.code`, Shift run, Space jump, E / Enter interact, Q call BAYBAY, M map, J journal, P photo mode, R reset camera / unstuck, Esc pause/settings. Left-click ground = walk there (A* on nav grid); click a highlighted thing = walk there and interact; hover highlights usable things. Right-drag / two-finger = rotate camera, wheel / pinch = zoom (clamped). Touch: tap-to-walk primary, floating left joystick optional, 72 px action button appears only when something is in range. Gamepad: left stick move, right stick camera, A interact, B jump, X call BAYBAY, Y journal.
- Camera: third-person follow, default pitch ~38°, distance ~15u, look-ahead, soft damping; buildings that occlude the player dither-fade; photo mode frees the camera.
- Accessibility: reduced motion (no shake, no DOF, shorter tweens), sound optional with visual cues, all actions reachable by keyboard, `aria-live` for focus prompts, text ≥ 12 px, touch targets ≥ 44 px.
- Language: follow the site locale (`useLocale()` → zh-Hans / zh-Hant / en). Author zh-Hans + en; zh-Hant is produced automatically by the site's JSX runtime for native elements, and via `translateText()` for strings passed to non-DOM places.

## 8. Real info rules

- Every real fact has `sourceUrl` + `verifiedAt` and is shown on the card. Hours/prices are phrased cautiously ("出发前查官网确认").
- Events come only from `/planner-catalog.json` at runtime (no invented events). Expired events never shown. `/events/:id` links only for ids from that catalog.
- Place links: BAYLINK guide `/guides/:slug` when a guide exists; planner handoff `/plan?date=YYYY-MM-DD&stops=place:<plannerPlaceId>,event:<eventId>` (only planner place ids that exist in the catalog `places`, e.g. `pier39`, `chinatown`, `alcatraz`, `golden-gate`); official site; Google Maps search link from lat/lng.
- Wishlist ("想去") is local (localStorage key `opus-bay:wishlist:v1`), with a clear handoff button to BAYLINK planning. Virtual collectibles are clearly game items.

## 9. Performance budgets (hard)

- Walk mode: ≤ 150 draw calls, ≤ 400k triangles incl. shadows, ≤ 500 Object3D in the scene graph, static objects `matrixAutoUpdate=false` (+ one `updateMatrixWorld(true)`), shadows only from actors + hero landmarks.
- Chrome CPU throttle ×4 on the dev machine: ≥ 45 fps walking. DPR cap 1.5 (high) / 1.25 (mid) / 1 (low), drei `PerformanceMonitor` adaptive tiers.
- First interactive ≤ 4 s desktop broadband; JS for the page ≤ 250 KB gzip; assets on first load ≤ 3 MB (GLBs / images lazy after start).
- No per-frame React state updates. Per-frame data lives in `core/runtime.ts`; React store updates ≤ 10 Hz and only on change.

## 10. Module map and ownership

| path | owner | role |
|---|---|---|
| `core/types.ts`, `core/store.ts`, `core/runtime.ts`, `core/events.ts`, `i18n.ts`, `OpusBayPage.tsx`, `game/GameRoot.tsx` | lead (fixed contracts; change only via integrator) | backbone |
| `data/district.ts`, `core/terrain.ts` | district | layout data + pure geometric queries (heightAt, walkability, surface, colliders, nav graph source) |
| `data/pois.ts`, `data/script.ts`, `data/postcards.ts`, `data/tours.ts` | content | real info + dialogue + tour/week/free content (bilingual) |
| `world/**` | world | rendering of terrain, water, sky, city, landmarks, props, ambient life, streetcar, diorama slab, time of day, post FX |
| `actors/**`, `core/input.ts`, `ui/TouchControls.tsx` | actors | player + BAYBAY + NPC models/animation, controller + collision, nav/A*, camera rig, input (kb/mouse/touch/gamepad) |
| `game/**` (except GameRoot), `ui/**` (except TouchControls), `data/catalog.ts`, `data/links.ts`, `data/wishlist.ts`, `opus-bay.css` | flow-ui | game systems (focus, interactions, guide brain, tour/week/free logic, quests, photo mode), all DOM UI |
| `audio/**` | audio | Web Audio engine, synthesized ambience + SFX + light generative music, voice clip playback |
| `public/opus-bay/**`, `data/assets.ts` | assets | Higgsfield-generated key art, portraits, postcard illustrations, voice barks, optional GLBs |

## 11. Shared anchor names (district ⇄ content ⇄ flow-ui contract)

`DISTRICT.anchors` MUST define every name below (walkable points, outside colliders). Content positions POIs/postcards via these names; flow-ui/actors use them for spawns, NPC posts and guide targets.

- Arrival & Ferry Building: `ferry-gate` (where the player steps off the ferry), `ferry-clock` (front of the clock tower, promenade side), `weekly-board` (the "这周去哪" board on the Ferry plaza), `farmers-market` (stalls on the front plaza), `ferry-back-plaza` (bay side, benches)
- Waterfront: `pier14-end`, `pier7-end`, `exploratorium-front`, `pier33-landing`, `pier39-entrance`, `pier39-carousel`, `sea-lion-viewpoint`
- Hill: `levis-plaza`, `filbert-steps-bottom`, `filbert-steps-mid`, `coit-summit`, `coit-view` (viewpoint spot facing the bay)
- Streetcar boarding spots: `streetcar-ferry`, `streetcar-green`, `streetcar-pier39` (ids match `DISTRICT.streetcar.stops[].id` = `ferry`, `green`, `pier39`)
- NPC posts: `npc-vendor`, `npc-fisher`, `npc-jogger-a`, `npc-jogger-b` (jog loop endpoints), `npc-family`, `npc-streetcar`
- Postcards (hidden a little off the main path near the subject): `postcard-ferry-building-dawn`, `postcard-pier7-sunset`, `postcard-exploratorium`, `postcard-filbert-steps`, `postcard-coit-tower`, `postcard-bay-bridge-night`, `postcard-sea-lions`, `postcard-streetcar`

Zones (`DISTRICT.zones`) for the top-left label: Ferry Building, Pier 14, Pier 7, Exploratorium · Pier 15, Levi's Plaza, Filbert Steps, Coit Tower · Telegraph Hill, Pier 33, Pier 39, The Embarcadero (default).

## 12. QA hooks (flow-ui implements, everyone may use)

- URL: `?start=tour|week|free|local` skips the title; `?time=morning|day|golden|night`; `?quality=low|mid|high`; `?debug=1` shows an fps / draw-call / triangle overlay; `?at=<anchor>` spawns the player at an anchor.
- Dev global: `window.__opusBay = { game, runtime, emit, district, renderer }` (renderer = three WebGLRenderer, set by world) for scripted QA with `node scripts/opus-shot.mjs`.
