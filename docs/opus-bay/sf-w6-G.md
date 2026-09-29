# Wave 6 · lane G · Halloween games & costumes

## 给主人的摘要

1. BAYBAY 的万圣节台词表已先推送（`halloween/lines.ts`，22 句中英文），X 线可以直接录她的声音。
2. 不给糖就捣蛋已上线：旧金山 6 条真实的万圣节讨糖街（Belvedere、Chenery、Fair Oaks、Jordan、Sea Cliff、Hearst）上 54 户人家门口有装饰好的小门廊（南瓜灯、门灯、纸蝙蝠）；走过去点一下「敲门」，BAYBAY 喊「不给糖就捣蛋！」，门吱呀打开、糖果飞进糖果袋、还给 5 金币。10/31 大夜晚每家都开门、糖果加倍。右上角有糖果袋计数 🍬。
3. 之后：小铺里的万圣节服装（女巫帽、南瓜头、幽灵披风、猫耳朵），目标卡里的万圣节目标和手帐的万圣节页。

## Part a0 · the line table (W6-G1, pushed early for lane X)

- `src/opus-bay/halloween/lines.ts`: `HALLOWEEN_LINES` (22 lines, ids `w6g-*`, zh + en, `when` notes) and `hLine(id)`.
  The game says them as BAYBAY bubbles with exactly these texts (lane X matches by text, the W5-V7 rule).
- Street facts (hedged "往年" / "usually"): https://www.rebeccarealtor.com/blog/best-neighborhoods-for-trick-or-treating-in-san-francisco-2025/
  (checked 2026-09-29: Belvedere St 17th → Parnassus, Chenery St Elk → Diamond, Fair Oaks St 21st → 26th, Jordan Ave
  Geary → California, Hearst Ave Edna → Congo closed for Halloween in 2025; Sea Cliff Ave / El Camino del Mar popular, no
  closure) and https://mommypoppins.com/san-francisco-bay-area-kids/best-places-to-trick-or-treat-on-halloween-in-san-francisco
  (checked 2026-09-29: Belvedere "One of the most well-known Halloween party spots"; Sea Cliff "several hundred
  trick-or-treaters each year").
- Test: `tests/opus-bay-w6-g-lines.test.ts` (unique ids / texts, zh ≤ 45, en ≤ 110, no controls named).
- Requests to lane X: `C:/Users/willy/opus-qa/w6/x/requests-G.md` (record the 22 lines; optional knock / creak / candy SFX).

## Part a · trick-or-treat (W6-G2)

### What was built

- `halloween/treatStreets.ts` — the six streets (OSM name, the block's cross streets, zh / en names, the neighbourhood,
  BAYBAY's line id, the source), `TREAT_SOURCES`, `DOORS_PER_STREET` (10), `KNOCK_OUT` (0.9 u).
- `scripts/opus-sf/halloween-doors.mts` (new) — places the doors on our published city (never hand-typed): the street face
  of each building within 7 u of the street's centreline and parallel to it, inside the named block first (between the
  cross streets' crossings, widened only when the block has too few houses), ≥ 2.8 u apart; the knock spot (0.9 u out)
  standable and not the roadway (with 0.15 u margin), the house blocking walking right behind the door.
- `halloween/treatDoors.ts` — the 54 doors it placed (APPEND-ONLY numbering `door:1…54` / `night:1…54`): Belvedere 9,
  Chenery 10, Fair Oaks 9, Jordan 8, Sea Cliff 10, Hearst 8.
- `halloween/treat.ts` — the rules (pure): in the season a door answers on a fixed daily roll (2 in 3; 4 in 5 in the
  treat hours 16–22), one candy, `halloween:door:<n>` 5 coins; on 31 October every door answers, two candies,
  `halloween:night:<n>` 5 coins (+ `door:<n>` when never knocked); `again` after a door's treat; nothing in `muertos` /
  `off`. Six candies (太妃糖 · 棒棒糖 · 巧克力 · 小熊软糖 · 玉米糖 · 焦糖苹果). The candy bag = what the ledger paid
  (one per door, two per night): persistent, never counted twice, emptied by a Settings reset.
- `halloween/treatMesh.ts` — toy geometry on ONE material (our own instance of the TOY_DYN program `ob-toy-dyn`, warmed
  `g-doors`: no new program): a door = a little gabled porch reaching 1.3 u back into the lot (hidden in a house that
  stands on its footprint, bridging the gap to a near-player kit house that stands back — seen in QA, see Known gaps),
  a stone step, white frame, a painted door with two panels and a brass knob, a glowing transom, a porch lantern, a
  paper bat, a jack-o'-lantern on the step, a paper note on a door that does not answer today. ≤ 300 triangles a door,
  one merged mesh per street (≈ 2.5k triangles, 1 draw call); the swinging panel and the flying candy are two small
  meshes on the same material, only while a door is answering. Glow: lantern / transom / pumpkin face always lit in the
  treat hours and on the big night (aInfo.w 1.9), else at night only (0.9); dark when nobody answers.
- `halloween/treatSounds.ts` — `g-knock` (three wooden knocks), `g-creak` (the door), `g-candy` (a rustle and a twinkle),
  synthesized through audio/hooks (lane X may hand recorded ones: requests-G.md).
- `halloween/treatRun.ts` — the system: a street's mesh is built within 170 u of it (dropped past 210 u) while the doors
  are dressed; the prompts (`registerInteractables('g-treat')`, source `find`, verb 敲门 / Knock, name 「Belvedere St 的人家」,
  radius 1.3 at the knock spot); a knock: the knock sound + BAYBAY 不给糖就捣蛋！ → 0.95 s the door creaks open (the lit
  doorway) → the candy flies in an arc into your bag → the rewards (`{type:'reward', source: halloweenSource('door:n')}`
  and `night:n`), `{type:'halloween', what:'treat', id:'door:n'}`, a gold toast 「得到巧克力！糖果袋 3 颗」, a sparkle →
  BAYBAY 谢谢您！万圣节快乐！ (and 糖果袋越来越沉啦！ at 5, the not-too-much line at 10, all doors) → the door closes at
  5.2 s. Nobody home: the knock, then 没人在家……; a door already knocked: 这家我们来过啦. BAYBAY says a street's line
  the first time you come within 22 u of its doors in a session (the treat-hour or big-night line first when it applies).
- `halloween/treatBadge.tsx` — 🍬 n in the top-right pill after the coins (`registerPillBadge('g-candy', order 11)`), shown
  while the doors are dressed (and after, in the season, while the bag is not empty).
- `halloween/play.ts` — starts it; DEV / QA `__opusBay.g.{knock(n), look(n, out), stats()}`.

### Evidence

- `tests/opus-bay-w6-g-treat.test.ts` (4 tests): the doors' numbering inside `HALLOWEEN_REWARD_IDS`, each street's line;
  the rules (daily roll, treat hours, again, the big night's two candies and `night:n`, closed out of season, the bag);
  the geometry budget and glow; every door on the published city (standable knock spot off the roadway, a wall behind
  the door, y on the ground). `tests/opus-bay-w6-g-lines.test.ts`.
- Played in the real game (dev 5606, `?world=city&halloween=1|night`): Belvedere door 5 (golden) — the porch, the knock,
  the door open with the warm doorway, the candy sparkle, toast 「Treat: chocolate bar! Candy bag: 1」, coins 0 → 5, 🍬 1,
  BAYBAY's Trick or treat! / Thank you! Happy Halloween! bubbles. Chenery door 12 at night on the big night: 10 coins,
  🍬 3 (door + night). Sea Cliff door 40 at night: the lantern and the pumpkin face glow. Shots:
  `docs/opus-bay/qa/w6/G/G2-door-belvedere.jpg`, `G2-treat-open-door.jpg`, `G2-night-sea-cliff.jpg`.
- Two streets built near the player at most in practice (Chenery + Sea Cliff after a teleport: 4,960 triangles; one
  street ≈ 2.5k).

### Decisions

- 54 doors, not 60: the placement keeps only faces whose knock spot is off the roadway with a margin and whose house
  blocks walking behind the door; the remaining ids `door:55…60` / `night:55…60` stay unused (append-only).
- The season's doors answer on a daily roll (not all every day), so "on the big night every door answers" means
  something; the treat hours open more doors and light them always.
- 5 coins a door, 5 more on the big night (the ledger's cap for `halloween` is 25): 54 doors ≈ 270 coins in the season
  and 270 more on the 31st — enough for a costume or two, not the whole shop.
- No player lock during a knock (you may walk off; the treat still lands and pays).
- The porch reaching back into the lot (below).

### Known gaps

- Near the player the city swaps some toy houses for the SAM kit houses (world/sf/kitSwap.ts), which can stand a little
  back from the lot's street edge: the porch bridges that gap (it reads as an entry porch), but the kit house's own
  painted door may show beside ours. A cleaner fix would be to exclude the treat doors' lots from the kit swap (lane P /
  W own world/sf: see Requests).
- The QA camera (`look`) frames the door through the cinematic override and can be blocked by BAYBAY or a tree.
- Doors 1–9 on Belvedere include a few just past Parnassus (the block has 7 faces).

### Requests

- Lane X: record the 22 lines of `halloween/lines.ts` (and optional knock / creak / candy SFX): `C:/Users/willy/opus-qa/w6/x/requests-G.md`.
- (optional, lead / world/sf owner) `world/sf/kitSwap.ts`: skip lots within 0.6 u of a `TREAT_DOORS` door in the
  Halloween season (so the toy house with our porch stays), e.g. an exported `setKitSwapSkip((x, z) => boolean)` hook.
