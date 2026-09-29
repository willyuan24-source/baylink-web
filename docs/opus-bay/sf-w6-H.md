# Wave 6 · lane H · Halloween in the world

Lane H of wave 6 (`docs/opus-bay/sf-w6-lead.md` §3): the season in the toy city from `halloween/season.ts` — the
residential city dressed, the pumpkin hunt, Día de los Muertos, the night atmosphere. Worktree `C:/Users/willy/wt/w6-h`,
dev port 5605, scratch `C:/Users/willy/opus-qa/w6/h/`, QA images `docs/opus-bay/qa/w6/H/`.

## 给主人的摘要

1. 十月（10/1–11/2）旧金山住宅区换上万圣节装扮：阿拉莫广场、海特、卡斯特罗、诺伊谷、太平洋高地、教会区、海斯谷约 2000 户维多利亚老房门口摆南瓜和南瓜灯、门廊小灯、蜘蛛网、挂着的小幽灵，人行道上偶尔有扮成小幽灵/小女巫/小南瓜的孩子；黄昏后阿拉莫广场、布埃纳维斯塔公园、双峰上空有小蝙蝠绕圈。只在玩家附近生成，手机也不卡。
2. **南瓜灯寻宝**：全城 40 个好玩的地方（九曲花街、苏特罗浴场遗址、波因特堡、双峰……）各藏一个发光的南瓜灯，走近就找到：叮的一声、金色提示「南瓜灯 n / 40」、金币，找到 10 / 20 / 40 个还有额外奖励。晚上南瓜灯会发光，更好找。
3. **亡灵节（11/1–2）**：教会区 24 街挂满彩色剪纸旗、人行道摆万寿菊，波特雷罗德尔索尔公园有 6 座祭坛（按 2025 年真实“祭坛节”地点），24 街社区祭坛，22 街和布莱恩特街口有游行集合的万寿菊拱门；走到祭坛前看一看，BAYBAY 会轻声介绍，还有小小的金币奖励。
4. 苏特罗浴场遗址上空夜里飘着三个发光的小幽灵；十月的晚上海雾会低低地漫进来一点，更有万圣节气氛（手机上不增加负担）。
5. BAYBAY 的万圣节台词都是固定的中英文（一张表），方便 X 线录音。
6. 预览：网址加 `?halloween=1`（十月）/ `night`（万圣夜）/ `muertos`（亡灵节）今天就能看到。

## Part a · W6-H1 the city dressed + W6-H2 the pumpkin hunt (02:00 – 02:55 PDT)

### What was built

- `src/opus-bay/halloween/worldSpots.ts` (**generated** by `scripts/opus-sf/halloween-place.mts` on the published city
  sf/v1): **2 062 stoops** — the street face (the footprint edge nearest a street centreline ≤ 9 u) of one in three
  `victorian` / `edwardian` houses (one in six `residential`) in the DataSF analysis neighbourhoods Western Addition
  (Alamo Square) 147 · Hayes Valley 146 · Haight-Ashbury 174 · Castro / Upper Market 330 · Noe Valley 400 · Pacific
  Heights 298 · Mission 567; a spot 0.45 u out from the wall, standable, never the roadway, ≥ 2.6 u apart, ≥ 14 u from
  lane R's Waller St / Painted Ladies spots. Five numbers a stoop (x·10, z·10, y·100, facing·100, zone | trick-or-treater
  side << 3); the script also checks the sidewalk beside the pumpkins for the trick-or-treater (108 get one, 10 have no
  room and get none).
- `src/opus-bay/halloween/worldDress.ts`: per stoop (variant by a stable hash) a carved jack-o'-lantern + a small
  pumpkin, or three pumpkins, or a lantern + a cobweb in the wall's corner, or a lantern + a little sheet ghost hanging
  from a bracket; a porch lantern (lit at night) on every other house; a trick-or-treater (ghost sheet / witch with
  broom / pumpkin kid, each with a treat pail) at ~1 in 19 stoops, only in 'season' and 'night'. Our own low-poly flat
  shapes (`FACE` 11 tris, `WEB_GEO` 20 tris): **≈ 103 triangles a stoop**. ONE merged mesh on the shared `TOY_DYN`
  material (no new program; faces and lanterns glow through the toy shader's night glow), built near the player only:
  48 u cells built ≤ 2 a step and cached as typed arrays, the mesh re-assembled by copying cached cells when the wanted
  set changes (no Batch work while driving); `DRESS_NEAR` high 100 / mid 80 / low 60 u, ceiling `DRESS_TRIS_MAX` 24k.
  **Bats**: one dynamic mesh (10 bats, 120 triangles, both windings on TOY_DYN) at the nearest colony within 260 u —
  Alamo Square, Buena Vista Park, Twin Peaks — from dusk (toy night ≥ 0.3), flapping and circling, written in place.
- `src/opus-bay/halloween/worldHalos.ts`: ONE instanced mesh on the shared `HALO` material (additive, its built-in
  per-halo flicker = the candles) for every Halloween light: the carved faces, the porch lanterns, the hunt's lanterns
  (priority), later the muertos candles. Hidden by day (0 calls), 1 call at night. The stoop glow reaches further than
  the geometry (`HALO_NEAR` high 200 / mid 150 / low 110 u, positions only), cap 768.
- `src/opus-bay/halloween/hunt.ts` + `huntPlaces.ts` (40 places, names zh / en) + `huntSpots.ts` (**generated**: each
  moved to the nearest spot a walker reaches — standable with a 0.4 u body, not water, not the roadway, a node of the
  walking graph's main component within 14 u; ≥ 12 u from every pebble, ≥ 30 u apart). The hunt runs 1 Oct – 2 Nov.
  Walk / bike / drive within 1.9 u of a lantern: the synthesized chime `halloween:pumpkin`, a sparkle, a gold toast
  "南瓜灯 n / 40 · <place>", `emit({ type: 'halloween', what: 'pumpkin', id: 'pumpkin:<n>' })`, the reward
  `halloween:pumpkin:<n>` (5 金币), milestones `hunt:10` (15) / `hunt:20` (20) / `hunt:all` (25), BAYBAY's line. A glint
  within 14 u. The lanterns (r 0.46, smooth, their faces glow a little by day and brightly at night) are ONE merged mesh
  of the unfound ones within 240 u.
  **API for lane G's notebook / HUD**: `pumpkinsFound()`, `pumpkinTotal()`, `pumpkinFound(n)`, `huntList()` →
  `{ n, near: {zh,en}, found }[]`, `onHuntChange(fn)` → undo; QA `pickPumpkin(n)`.
- `src/opus-bay/halloween/worldLines.ts`: **BAYBAY's 18 fixed lines** (zh + en, ids `w6-h-*`) in one exported table
  `HALLOWEEN_WORLD_LINES` / `ALL_WORLD_LINES` for lane X (requests in `C:/Users/willy/opus-qa/w6/x/requests-H.md`).
- `src/opus-bay/halloween/world.ts`: the init — one world system `halloween-world` (stoops, hunt, bats, halos), one frame
  system; `phaseWants(phase)`: season / night everything, muertos the stoops + the hunt (no costumes, no bats), off
  nothing. Ambient lines (season hello, night glow, big night, bats, trick-or-treaters, the hunt's hint) through lane R's
  once-a-Bay-day `RealLineScheduler` (own memory key `opus-bay:halloween:v1`) behind the city lines' gates.
  `{ type: 'halloween', what: 'phase' }` is emitted at start and on a change. DEV: `__opusBay.halloween.stats()`.
- `src/opus-bay/realsf/dressing.ts` (owned): lane R's Painted Ladies / Waller St pumpkins now stand the whole season
  (`halloweenPhase(now) !== 'off'`), not only on the calendar's 31 October row.
- `scripts/opus-sf/halloween-place.mts` (new): places and checks the stoops and the hunt, writes the two generated files.
- `tests/opus-bay-w6-h.test.ts` (7 tests): the lines table; the stoops (count, zones, spacing, decoding, clear of lane R's
  spots); cost (avg ≤ 115 tris a stoop, ≤ 460 the richest, halos); the phases; the 40 hunt places (ids, names, reward
  ids, spacing, pebbles); **on the published city** every lantern standable / off the water and the roadway / on the
  main walking graph / its baked y, every 25th stoop off the roadway with its baked y, the trick-or-treaters off the
  roadway; the hunt on lane E's real ledger (pays once, milestones once, `huntList`).

### Evidence

- `?halloween=1&time=golden|night`, `quality=high`, 960 × 600, the budget-views harness (a scratch copy that passes
  `?halloween=`): Castro stoop 89 calls / 306k tris (halloween-world 2 calls / 25k), Western Addition at night 67 calls
  / 266k (halloween-world 3 / 27k), Alamo Square hunt lantern at night 91 / 289k (halloween-world 4 / 27k: stoops, hunt,
  halos, bats), Noe Valley 83 / 302k. All inside ≤ 150 calls / 400k.
- Shots (read): `qa/w6/H/h1-stoop-night-alamo.jpg` (a carved face glowing, its halo), `h1-noe-night-witch-ghost.jpg`
  (a witch kid with her pail beside a jack-o'-lantern, a sheet ghost hanging from a porch), `h1-castro-golden.jpg`,
  `h2-hunt-lantern-alamo-night.jpg` (the hunt's lantern in Alamo Square's grass, the glint's sparkles).
- Checks: tsc 0 · eslint 0 errors · suite (see the push line below).

### Decisions

- Dates: everything keys off `halloweenPhase` (frozen). The hunt and the stoop pumpkins run through Día de los Muertos
  (1 Oct – 2 Nov, the lead's decision); trick-or-treaters and bats only in 'season' / 'night'.
- Density: one house in three (Victorian / Edwardian), not every house — a street reads as decorated, not uniform.
- Bats: only from dusk, only near three colonies (hill parks where bats plausibly hunt at dusk); the line says they
  eat bugs (all Bay Area bats are insect-eaters) — kept generic.
- Pumpkins are faceted (ICO 0) to hold ≈ 100 triangles a stoop; the hunt's 40 are smooth (ICO 1) and bigger.
- No compass hint for the hunt (lane E's `HINT_KINDS` is frozen to cache / egg / pebble / postcard); the glint and
  BAYBAY's hint line do it.

### Known gaps

- Trick-or-treaters and ghosts are static (no bobbing): merged geometry, no per-frame cost.
- The hunt lanterns face a fixed direction per number, not toward the path.

### Requests

- Lane X: record `halloween/worldLines.ts` (18 lines) — written in `C:/Users/willy/opus-qa/w6/x/requests-H.md`.
- Lane G: the notebook's 万圣节 page can read `pumpkinsFound()` / `pumpkinTotal()` / `huntList()` / `onHuntChange()`
  from `halloween/hunt.ts`; H emits `{ type: 'halloween', what: 'phase' }` (G does not need to).

## Part b · W6-H3 Día de los Muertos + W6-H4 the haunted glow and a foggier Halloween evening (03:00 – 03:45 PDT)

### What was built

- **Día de los Muertos, 1–2 November** (`halloweenPhase` 'muertos'; preview `?halloween=muertos`):
  `src/opus-bay/halloween/muertos.ts` + `muertosSpots.ts` (**generated** by `scripts/opus-sf/muertos-place.mts` on the
  published city, which carries the sources): 14 strings of **papel picado** (paper flags with a scalloped edge, seven
  colours, a sag in the middle) across **24th Street from Bryant to Mission** and **Bryant from 22nd to 24th** — the
  procession's first legs; **marigold pots** along 24th St's sidewalks; **six ofrendas at Potrero del Sol Park** (the
  2025 Festival of Altars), **a community altar at Acción Latina's door on 24th St**, and **a marigold arch where the
  procession gathers at 22nd & Bryant**. An ofrenda = three cloth tiers (cream, purple, pink), six candles whose flames
  glow (and halo at night), three framed photos, a sugar skull, a marigold arch and two pots. One merged TOY_DYN mesh
  (≤ 12k triangles, built within 260 u of the route only on those two days); the candles go to the halo pool.
  Visiting each (within 2.6 u, on foot / bike / car) is a quiet find: a sparkle, a toast "亡灵节 n / 8 · <place>", the
  reward `halloween:muertos:<n>` (3 金币, once), `muertos:12` (10) when all eight were seen (`muertos:9…11` unused);
  BAYBAY's lines are soft (worldLines.ts `muertosAltar`, `muertosMarigold`, `muertosProcession`, `muertosAll`), and the
  once-a-day hello / procession line near the route. The stoops keep their pumpkins, the hunt goes on; no costumes, no
  bats those days. QA: `__opusBay.halloween.visitMuertos(n)`.
- **The haunted glow** (`src/opus-bay/halloween/worldHaunt.ts`): over the **Sutro Baths ruins** three friendly sheet
  ghosts float and bob (a faint glow always, a pale green halo each at night); 'season' / 'night' only, within 300 u;
  one small mesh (TOY_DYN) moved by one matrix a frame.
- **A foggier Halloween evening** (`src/opus-bay/realsf/seasons.ts`, owned): `karlMonthFactor(date)` returns at least
  `HALLOWEEN_NIGHT_KARL` 0.6 (October's climatology is 0.35) on a Halloween 'season' / 'night' evening, 18:00–06:00 Bay
  time — Karl rolls in lower and thicker over the west side (the city's real sky reads it once a minute and slides it
  over 45 s). A game mood, documented as not climatology; by day October stays the clearest month. Uniform-level only:
  no cost on the phone.
- `src/opus-bay/halloween/world.ts`: `phaseWants()` gains `muertos`; the muertos and haunt systems, their halos
  (priority below the hunt), the muertos lines on offer.
- Tests: `tests/opus-bay-w6-h-muertos.test.ts` (4): the sources on the placement script, numbering and reward ids, the
  six Festival altars and the one gathering arch; **on the published city** every altar / the arch standable with a
  0.8 u body off the roadway, every marigold pot off the roadway, every picado string a street's width; the geometry
  ≤ 12k triangles with a halo per candle; the finds on lane E's real ledger (once each, `muertos:12` once).
  `tests/opus-bay-w6-h.test.ts`: the phases include `muertos`.

### Real-world facts (checked on the web 2026-09-29)

- The procession: 2 November, 7 p.m., assembling at 22nd & Bryant; route "South on Bryant, West onto 24th, North onto
  Mission, East onto 22nd, Ending at Bryant & 22nd" (the 2025 edition) —
  https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025 (also sf.funcheap.com:
  gather at 6 p.m., procession about 7–9 p.m.).
- The Festival of Altars (the Marigold Project): 2 November 2025, 8 a.m. – 9 p.m., at **Potrero del Sol Park**, 2827
  Cesar Chavez St (not Garfield Square that year) — https://missionlocal.org/2025/10/celebrate-day-of-the-dead-sf/ and
  https://eltecolote.org/content/en/dia-de-los-muertos-sf-events-2/ (El Tecolote, 2025-10-28, which also lists the
  community altar at Acción Latina, 2958 24th St).
- 2026's dates / sites were not published on 2026-09-29: the game follows the 2025 route and sites; BAYBAY's line says
  "every 2 November, in the evening" (the procession is held on 2 November each year).

### Evidence

- `?halloween=muertos&time=golden`: 24th St under the papel picado 78 calls / 331k tris (halloween-world 3 calls / 32k:
  stoops, muertos, the pool); Potrero del Sol altars 70 / 235k (halloween-world 2 / 25k). `?halloween=1&time=night`:
  Sutro Baths 52 / 63k; Twin Peaks → the west 70 / 171k.
- Shots (read): `qa/w6/H/h3-muertos-24th-papel-picado.jpg` (strings of papel picado down 24th St, marigold pots, a
  jack-o'-lantern on a stoop), `h3-muertos-altars-potrero-del-sol.jpg` (four ofrendas with their marigold arches and
  candles on the park's lawn), `h4-haunt-sutro-night.jpg` (two ghosts glowing over the ruins by the sea),
  `h4-karl-halloween-evening.jpg` (Karl's bank low along the coast behind Sutro Tower at night).
- Alamo Square at night (DEV stats): stoops 230 in 17 cells, 23.8k triangles (at the ceiling), 11 trick-or-treaters,
  bats at `alamo-square`, the hunt's 10 lanterns 1k, halos 768 (the cap).

### Decisions

- Día de los Muertos follows the **latest verified** sites (2025): the altars at Potrero del Sol Park, not Garfield
  Square (the task text named Garfield Square; the 2025 sources put the Festival of Altars at Potrero del Sol).
- The finds are few (8) and quiet; the reward is small (3 金币): the altars are for remembering, BAYBAY says so.
- The haunted glow is at the Sutro Baths ruins (a ruin by the sea, the hunt's lantern 20 is there) — friendly ghosts.
- Halloween evenings are foggier by design, only 18:00–06:00 in October (or a preview).

### Known gaps

- No procession walkers (the route is dressed; the crowd lane's walkers are not re-routed).
- The bats are dark on a dark sky at full night (they read best at dusk, against the sky).
- The halo pool hits its cap (768) in the densest neighbourhoods at night: the far stoop glows are dropped first (the
  hunt / muertos / haunt halos have priority).
