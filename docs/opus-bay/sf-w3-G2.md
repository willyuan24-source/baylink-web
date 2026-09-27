# Wave 3 · lane G2 (city content: lines, residents, cards)

## Part a

### 给主人的摘要

- BAYBAY 在城市里会"看情况说话"了：第一次骑车 / 开车 / 坐叮当车 / 坐渡轮 / 滑翔 / 爬陡坡，磕碰、楼梯、喘气这些小反应，还有 41 个街区的第一次到达问候（20 个街区有专门的一句介绍，其他街区说"新街区！这里是 XX～"）。38 句台词 H2b 都录好了音，气泡的开头就是录音那句话。
- 规矩：同一句 60 秒内不重复，两句之间至少隔 8 秒，不会盖住别的气泡，对话 / 过场 / 快速旅行 / 拍照时不说话，滑翔时先不打招呼、落地后只问候落地的街区。"第一次"类台词每个存档只说一次。
- 地图上的普通地点（不是 24 个地标的那 1000 多个）现在点"详情"也有自己的卡片：类型、街区、攻略、地图、附近活动、数据来源，底部一个大大的"带我去"按钮，手机上好按。
- 叮当车 / 渡轮上下车的对白、司机和水手的台词都写好了；双峰和金门大桥两个目标在浏览器里真走了一遍，都能正常打勾。
- `data/VOICE.md` 加了城市篇：BAYBAY 在全城怎么说话、台词规则、中文译名表（双峰、唐人街、叮当车、要塞公园、马里纳区……和 HUD 一致）。

### What was built (files, API for other lanes)

| file | what |
|---|---|
| `data/sf/lines.ts` (new) | `BARK_SCRIPT` (**frozen**, header says so): `BARK_SCRIPT_RECORDED` (the 20 lines H2b recorded in a2dbfe4, word for word) + `BARK_SCRIPT_TODO` (the later 18: 7 reactions, cable bell, turntable push, the "新街区！" opener and 8 more greetings; H2b recorded them in e60eec4 as `SF_VOICE_EXTRA`). `EVENT_LINES` per `LineEvent` (bike, car, bump (hard only), hill, crest, glide, glide-land, glide-no-landing, pant, stairs, cable-bell, cable-ride, push, ferry, fline): the first entry is a once-per-save "first", the next one repeats with its own cooldown; every bubble starts with its recorded phrase (tested). `NEIGHBOURHOOD_LINES` (20, real `far.zones` ids, facts with `source` + `verifiedAt` 2026-09-27), `neighbourhoodGreeting(zone, name)` for the other 21 zones, `lineMs(text)` (2.6–5.6 s). |
| `game/baybayLines.ts` (new, city chunk only) | `LineScheduler` (pure; fake clock in tests): 60 s per key, ≥ 8 s between lines, never while any bubble is up nor within 1 s after one, silent in dialogue / cinematics / fast travel / photo / postcard rewards / panels / the quiet start, zone greetings wait while you stay and are held while gliding (only the landing zone is greeted), `after` (the glide lines wait 0.9 s for audio's take-off "wow"). `createLineMemory` (`opus-bay:lines:v1`, untrusted input, `?save=off` in memory), `clearLineMemory()` (for G1's reset), `lineEventOf(ev, onFoot)`, `initBaybayLines()`: core events → scheduler, a 5 Hz frame system, `bubble(...)` + `emit({ type: 'voice-line', id })` + an emote while BAYBAY walks beside you. DEV: `__opusBay.lines` (`waiting()`, `offer(e)`, `said(key)`). |
| `game/cityContent.ts` | loads `baybayLines` as its own chunk in city mode (nothing new in GameRoot). |
| `data/script.ts` | `CITY_TRANSIT_HOOKS` for F (`cablecarStation` / `ferryStation` with `{station}`, `cablecarBoard`, `cablecarCount`, `cablecarOff`, `turntableTurned`, `ferryBoard`, `ferryOff`), the crews as `CITY_NPC_LINES` (gripman, deckhand; `NPC_LINES = byMode`), `call.menu.city` (自己逛 → `free.goals.city`; the wave-2 gap), `tour.after.city`, `postcard.first.city` / `postcard.all.city` ("20 张"). District hooks untouched. |
| `game/content.ts` | `fillText` / `hookFill` for placeholder hooks. |
| `game/brain.ts` | city only: a landmark pass-by bark waits for the bubble on screen instead of cutting a greeting short. |
| `data/sf/cityPois.ts`, `ui/PoiCard.tsx` | G1's Request 3: `placeCardTarget(id, placeById)` (a landmark place → its landmark card, a hero place merged with a district POI → that card, any other place → a `PlaceCard`), `PLACE_KIND_NAMES` (23 kinds), `placeCardName`. `PlaceCard`: type + neighbourhood, an honest "still being written up" line, the BAYLINK guide and planner links when the place has them, Maps, this week's events within 1 km, the OSM source + date, a full-width 带我去 (`navigateTo('place:<id>')`). |
| `data/VOICE.md` | "City mode" section: BAYBAY in the whole city, transit crews and residents, event / neighbourhood line rules, the zh glossary matched to `far.zones` HUD labels. |
| `tests/opus-bay-sf-lines.test.ts` (new) | 12 tests (script vs recordings, phrase prefixes, `far.zones` ids, glossary, scheduler with a fake clock, event mapping, memory as untrusted input). `tests/opus-bay-sf-content.test.ts` + the place-card and transit-hook tests. |

**API for other lanes**
- Any lane can make BAYBAY react through core events it already emits: `vehicle:enter`, `vehicle:bump {hard}`, `vehicle:refuse {surface:'stairs'}`, `vehicle:hop {crest}`, `hill`, `pant`, `glide:start|land|no-landing`, `transit {kind, what}` (cable-car `depart` / `push` / `bell` (on foot, strength ≥ 0.4); ferry and streetcar `depart` / `board`). The hero F-line (no transit events) is picked up from `flow.ride`.
- A new line = a new `BARK_SCRIPT` id (never a changed wording) → H2b records it → an `EVENT_LINES` entry.
- `clearLineMemory()` for a "reset progress" button (G1).

### Evidence

- Checks on this head (rebased on `83bc5de`): `tsc` 0 errors, `eslint src/opus-bay tests/opus-bay-*` 0 problems, **381 / 381** opus-bay tests (hero regression + contracts green).
- In the app (dev 5206, RTX), this run: `?start=free&world=city&save=off&at=ll:37.7502,-122.4337` (Noe Valley, a template zone) → bubble "New neighbourhood! This is Noe Valley." / "新街区！这里是诺伊谷～", `__opusAudio` counts `voice-clip:en-zone-new` = 1 (an `SF_VOICE_EXTRA` clip through the scheduler), `said('zone-noe-valley')` true. Phone 390×844 `--mobile --dpr 3` zh at the Dragon Gate: the landmark bark docks at the top under the discovery toast, no overlap with the postcard-clue chip (G1's M1 fix): `docs/opus-bay/qa/w3/G2/g2-phone390-bubble-docked-zh.jpg`.
- In the app, the interrupted run (commits d4631e6 / 96387f5 / 6447b1a / eafcef8; shots in `docs/opus-bay/qa/w3/G2/`):
  - `g2-line-first-bike.jpg` — "Bike time! I'll ride in the basket~" on the first `vehicle:enter` at the Ferry Building.
  - `g2-line-first-glide.jpg` — "Hold on, we're flying! The whole city's below us~" after the take-off whoosh (debug HUD: 70 calls, 221k triangles, 43 programs; the lines add no meshes and no programs).
  - `g2-phone390-greeting-chinatown-zh.jpg` — "你好，唐人街！它是北美最老的唐人街。" (taken before G1's M1 fix: the bubble still touched the clue chip there; the new shot above has it docked).
  - `g2-twin-peaks-goal-real-walk.jpg` — goal ticked (目标 1/7) after a real walk Castro → Twin Peaks summit (the detector armed ≥ 150 u away, no teleport).
  - `g2-golden-gate-goal-deck-walk.jpg` — goal ticked after a real walk on the deck tower to tower.
  - `g2-place-card-desktop.jpg`, `g2-place-card-phone390.jpg`, `g2-place-card-phone375.jpg` — the place card (金门公园, Salesforce 空中公园), 带我去 in reach of the thumb; the 带我去 tap on the phone starts the walk.
- Budgets: nothing of this part adds a mesh, material or program (lines are DOM bubbles; the place card is DOM).

### Decisions

- `BARK_SCRIPT` was built from H2b's already-recorded table (it landed before G2-4), so the bubbles start with exactly those phrases; everything else was written as a later block and recorded by H2b the same day.
- Reactions go stale fast (ttl 3 s): a bump line 5 s after the bump reads as a non sequitur. Firsts may wait 12 s for a free moment.
- Zone greetings rank between firsts and reactions; the Twin Peaks greeting waits for the summit (45 u of the overlook), not the zone's lower edge.
- The glide lines wait 0.9 s (`after`) instead of asking F to drop the "wow" (H2b's request 3 done on G2's side).
- Place cards say honestly that the write-up is still coming rather than inventing a summary for 1,000 places.

### Known gaps

- `SF_VOICE_EXTRA` clips are not preloaded (audio preloads `SF_VOICE_LINES` only): the first play of each can wait up to 0.7 s; and `audio.ts` picks the fallback chirp from `SF_VOICE_LINES`, so an EXTRA line whose clip is missing chirps `hi` instead of its own fallback. Both go away with Request 1.
- Place names in the discovery toast can be English in the zh UI (e.g. "Heaven Art Gallery"; G1's place index, not G2's card, which uses `placeCardName`).
- `lang=zh` is not a locale: QA URLs must use `lang=zh-Hans` for the zh clips.

### Not done

- Nothing of part a. Part b (six residents with tasks and bodies, the neighbour-help list, `sf-tasks` tests) follows below.

### Requests

1. **Lead + H2b's file** (`data/voiceLinesSf.ts`, `tests/opus-bay-h2b-assets.test.ts`, one commit with G2's `data/sf/lines.ts`), H2b's Request 1: rename today's `SF_VOICE_LINES` literal to `const CORE_LINES` and export
   `export const SF_VOICE_LINES: Record<string, SfVoiceLine> = { ...CORE_LINES, ...SF_VOICE_EXTRA };`
   In `tests/opus-bay-h2b-assets.test.ts` l.172 count `Object.keys(SF_VOICE_LINES).length` only (no `+ EXTRA`), l.179 compare `BARK_SCRIPT_RECORDED` with `CORE_LINES` (export it) and drop the `!SF_VOICE_LINES[id]` "only once" check at l.182. G2's `tests/opus-bay-sf-lines.test.ts` already accepts `SF_VOICE_LINES` growing by the later block; no G2 code change is needed (the emits already use the same ids). Then the 18 later lines preload and use their own fallback chirps.
