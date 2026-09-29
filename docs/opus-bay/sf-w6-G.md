# Wave 6 · lane G · Halloween games & costumes

## 给主人的摘要

1. BAYBAY 的万圣节台词表已先推送（`halloween/lines.ts`，22 句中英文），X 线可以直接录她的声音。
2. 不给糖就捣蛋已上线：旧金山 6 条真实的万圣节讨糖街（Belvedere、Chenery、Fair Oaks、Jordan、Sea Cliff、Hearst）上 54 户人家门口有装饰好的小门廊（南瓜灯、门灯、纸蝙蝠）；走过去点一下「敲门」，BAYBAY 喊「不给糖就捣蛋！」，门吱呀打开、糖果飞进糖果袋、还给 5 金币。10/31 大夜晚每家都开门、糖果加倍。右上角有糖果袋计数 🍬。
3. 小铺里新增 4 套万圣节服装：BAYBAY 的女巫帽、南瓜头（晚上会发光），你的猫耳朵、小幽灵披风；可以先试穿再用金币买，只在 10/1–11/2 出售（买过的全年都能穿），第一次穿上会得到奖励、BAYBAY 会夸你。
4. 手帐（Journal）里多了「万圣节」页：三个万圣节目标（敲开 5 户人家的门、找到 10 个南瓜灯、穿上一套服装）、糖果袋、6 条讨糖街各敲了几户（一键「带我去」）、南瓜灯数、服装。

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
- `halloween/treatSounds.ts` — `g-knock` (three wooden knocks, synthesized through audio/hooks) for a door nobody
  answers; a door that answers plays lane X's whole treat vignette (audio/halloween.ts: knock, creak, candies, chime) for
  the `halloween` treat event, emitted at the knock (W6-G2b keeps the door and the candy in step with it).
- `halloween/treatRun.ts` — the system: a street's mesh is built within 170 u of it (dropped past 210 u) while the doors
  are dressed; the prompts (`registerInteractables('g-treat')`, source `find`, verb 敲门 / Knock, name 「Belvedere St 的人家」,
  radius 1.3 at the knock spot); a knock: `{type:'halloween', what:'treat', id:'door:n'}` (X's sound) + BAYBAY
  不给糖就捣蛋！ → 0.6 s the door swings open (the lit doorway) → the candy flies in an arc into your bag (1.3 s) → the
  rewards (`{type:'reward', source: halloweenSource('door:n')}` and `night:n`), a gold toast 「得到巧克力！糖果袋 3 颗」, a
  sparkle → BAYBAY 谢谢您！万圣节快乐！ (then the goal line at the 5th door, 糖果袋越来越沉啦！ at 5 candies, the
  not-too-much line at 10, all doors) → the door closes at 4.6 s. Nobody home: the knock, then 没人在家……; a door already knocked: 这家我们来过啦. BAYBAY says a street's line
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

## Part b · costumes in the 小铺 (W6-G3)

### What was built

- `economy/items.ts` (APPEND-ONLY, surgical, named): `HatKind` += `'witch' | 'pumpkin'`; `CostumeKind`; `ItemDef` +=
  `costume?`, `season?: 'halloween'`; four items appended after `frame-sounds` (indices 31–34): `hat-witch` 女巫帽 (BAYBAY,
  120), `hat-pumpkin` 南瓜头 (BAYBAY, 120, the face glows at night), `my-cat-ears` 猫耳朵 (you, 80), `my-ghost` 小幽灵披风
  (you, 100), each noted 万圣节限定; `setSeasonGate({ onSale, shown })` — `forSale()` and `shelfItems()` ask the gate for a
  seasonal item (no gate: neither sold nor shown).
- `economy/hats.ts` (surgical): `hatGeometry('witch' | 'pumpkin')` → `halloween/costumeMesh.ts costumeHatGeometry`.
- `economy/wear.ts` (surgical): the `player-hat` slot attaches a costume to the head (`charApi.attach('player', 'head',
  …)`: the bucket hat hides under it, lane F's rule) and clears the hat tint; a plain hat detaches it.
- `economy/Shop.tsx` (surgical, K2's file): `ItemArt` shows `halloween/costumeArt.tsx` for an item with `costume`.
- `halloween/costumeMesh.ts` — the toy geometry on the hats' material (TOY_DYN program, no new program): the witch hat
  (brim, cone crown with its tip bent back, orange band, buckle), the pumpkin head (ribbed pumpkin, stem, leaf, carved face
  lit at night), cat ears (headband, black ears pink inside), the ghost sheet (a dome and a skirt over the bean, soft hem
  folds, black eyes and an "oo" mouth; the feet show). ≤ 420 triangles each (ghost ≈ 350).
- `halloween/costumeArt.tsx` — the four tile pictures (inline SVG).
- `halloween/costume.ts` — `initCostumes()`: the gate (`onSale` in the season incl. previews; `shown` in the season or
  owned: owned costumes stay wearable all year); on a costume put on (the ledger's wear) `{ type: 'halloween', what:
  'costume', id }` (taken off: id ''; lane X plays the poof), BAYBAY's line for it (once a session), and the first costume of
  the save pays `halloween:costume:first` (10 coins) with 穿上服装，我们就能去讨糖啦！.
- The pelican's bat wings: not built — `charApi` has no attach slot on the pelican and its ribbon paints live in lane K1's
  `actors/vehicles/models.ts` (see Not done).

### Evidence

- `tests/opus-bay-w6-g-costume.test.ts` (4): the items appended after every wave-5 item (indices kept), labels, slots;
  the gate (no gate → not sold / not shown; season → sold and shown; off season → shown only when owned, never sold); the
  geometry budget, the hats' material, the pumpkin's night glow; what wear.ts sends (the ghost attached + tint null, a
  plain hat detaches it, BAYBAY's pumpkin attached).
- Played (dev 5606, `?halloween=1`): the ghost sheet and the cat ears on the player through the try-on preview (desktop
  and 390 × 844); the phone shop's BAYBAY shelf shows 女巫帽 / Witch hat 120 and 南瓜头 / Pumpkin 120 with their pictures.
  Shots `docs/opus-bay/qa/w6/G/G3-phone-ghost-sheet-shop.jpg`, `G3-phone-cat-ears-witch-pumpkin-tiles.jpg`.

### Decisions

- Costumes use the existing wear slots (the save format is frozen): BAYBAY's two in `baybay-hat`, yours in `player-hat`.
- The pumpkin "head" sits on BAYBAY's head like a hat (her face stays visible — her expressions matter more).
- Prices 80–120 (the W5 hats are 150): a season's trick-or-treating (≈ 270 coins) buys two.

### Known gaps

- The shop's own two-shot can put the player in front of BAYBAY on a narrow street; the close-up below was framed with
  the QA camera.

## Part c · the Halloween goals and the 万圣节 page (W6-G4)

### What was built

- `halloween/progress.ts` — the season's three goals from the ledger: 敲开 5 户人家的门 (`door:n`), 找到 10 个南瓜灯
  (lane H's `pumpkin:n`, read from the frozen ids), 穿上一套万圣节服装 (`costume:first`); `goalsDoneText()` "n/3".
- `halloween/HalloweenPage.tsx` + `halloween.css` — a Journal tab 万圣节 (`registerJournalTab('halloween', order 8)`,
  between 手帐 and 明信片, count "n/3", registered only while `inHalloween()`, re-checked every 30 s): the phase line, the
  three goals with meters, the candy bag and each street's doors knocked with 带我去 (game/goTo to the next door's knock
  spot), the jack-o'-lanterns found (lane H's `pumpkinsFound()` / `pumpkinTotal()`), the four costumes (wearing / owned /
  price) and 去小铺试穿, the sources with the date checked.
- `halloween/treatRun.ts`: the fifth door says BAYBAY's 敲开了五户人家的门，糖果袋满满的！ (the goal) before the bag lines.
- `halloween/play.ts`: starts the costumes and the page tab; QA `__opusBay.g.page()`.

### Decisions

- The goals card itself (data/sf/goals.ts: ten tested goals, lane K2's UI) is not changed: the Halloween goals live on
  the 万圣节 page in the season (a seasonal list would have moved the card's counts and tests for a month).
- No coins for the goals themselves: the doors, lanterns and costume already pay through their own ids.

### Evidence

- `tests/opus-bay-w6-g-page.test.ts`: the goals from the ledger (capped at the goal), the tab count.
- Played on 390 × 844: the Journal's 万圣节 tab (0/3), goals with meters, the streets with 带我去 —
  `docs/opus-bay/qa/w6/G/G4-phone-halloween-page.jpg`.

## Not done

- The pelican's Halloween look (bat wings / a pumpkin bow): needs an attach point on the pelican (charApi, lane K1) or
  a new ribbon paint in `actors/vehicles/models.ts` (K1) — see Requests.
- A seasonal row in the goals card (decision above).

## Requests

- Lane K1 (actors): a `charApi.attach('pelican', …)` slot (or a `PAINTS` id `pumpkin` for the ribbon) so lane G can sell
  bat wings / a pumpkin bow for the pelican next wave.
- Lane X: the 22 lines of `halloween/lines.ts` (incl. the costume lines and 敲开了五户人家的门…) — requests-G.md.

## Part d · polish after playing it (W6-G5)

- The pumpkin head sat a hand above BAYBAY's crown on her GLB body (the head slot is at her ear tips): lowered by 0.12;
  close-up of both costume hats on BAYBAY: `docs/opus-bay/qa/w6/G/G3-baybay-witch-hat-pumpkin-head.jpg` (golden hour,
  Alamo Square).
- A knock turns you to face the door (the prompt's 'info' action already plays the reaching gesture); BAYBAY cheers
  (`charApi.emote('baybay', 'cheer')`) when the candy lands.
- Phone (390 × 844, quality mid, `?halloween=night&time=night`, Sea Cliff door 41): the one-tap 敲门 / Knock button at the
  bottom right, the porch with its glowing transom and pumpkin, the door opening on the warm doorway, 「Double treat:
  toffee! Candy bag: 3」, 10 coins — `docs/opus-bay/qa/w6/G/G2-phone-knock-big-night.jpg`.
- The full suite on the pushed W6-G4 tree (03:55) and on this part (04:14): 1446 / 1446; tsc 0; eslint 0 errors.

## Review (W6-G-review, adversarial, 04:31–05:40 PDT)

### 给主人的摘要

1. 万圣节玩法整体扎实：讨糖、服装、手帐「万圣节」页在电脑和手机上都实际玩过，街道资料在网上重新核对属实，电脑版和区县模式（district）完全没被影响。
2. 找到并修好 3 个问题：
   - 手机上右上角的小胶囊被糖果袋撑成三行，第三行开头还挂着一个孤零零的「·」（看起来像坏了）。现在手机上离讨糖街远时不显示糖果袋（胶囊恢复两行）；走到讨糖街附近才出现，而且单独一行、没有多余的点。糖果数量在手帐「万圣节」页和每次拿到糖的提示里一直都看得到。
   - 10/31 大夜晚去敲 10 月已经敲过的门，BAYBAY 会再说一遍「敲开了五户人家的门」；每次重新打开游戏，第一次拿糖她也会重复「糖果袋越来越沉啦」。现在每句里程碑台词只在真正达到那一刻说一次。
   - 手帐「万圣节」页：11/1–2（亡灵节，门已经不装饰了）还显示「带我去」；10/31 大夜晚，10 月里敲完的街显示 10/10、没有「带我去」，其实每家当晚还有双倍糖果。现在大夜晚按当晚的糖计数，亡灵节不再给「带我去」。
3. 没有阻碍上线的问题。注意：真正的万圣节季（10/1）在上线两天后自动开始，所有玩家都会看到这些内容。

### What was checked

- Every lane commit read in full: `1d0b0d0c` (lines), `1c19ca3d` + `96cd3f8a` (trick-or-treat, X's treat sound), `ee095d56`
  (costumes; the surgical edits to `economy/items.ts`, `hats.ts`, `wear.ts`, `Shop.tsx`), `0f08a042` (goals + page),
  `31d1f31a` (polish).
- Facts re-checked on the web (2026-09-29, 04:40 PDT):
  https://www.rebeccarealtor.com/blog/best-neighborhoods-for-trick-or-treating-in-san-francisco-2025/ — Belvedere 17th →
  Parnassus 4–10 pm, Chenery Elk → Diamond 4–9:30 pm, Fair Oaks 21st → 26th ~5–8:30 pm, Jordan Ave Geary → California
  4–10 pm, Hearst Ave Edna → Congo 4–8 pm, Sea Cliff "no formal 2025 street closure";
  https://mommypoppins.com/san-francisco-bay-area-kids/best-places-to-trick-or-treat-on-halloween-in-san-francisco —
  Belvedere as one of the best-known Halloween spots, Sea Cliff "several hundred trick-or-treaters each year". The lines
  hedge the closures (往年 / usually) and say nothing about Sea Cliff closing: correct.
- Played (dev 5626, headless Chrome): desktop 1440 × 900 `?world=city&halloween=night` — Chenery door 12: 敲门 / Knock
  prompt, Trick or treat! → the door open on the lit doorway → 「Double treat: caramel apple! Candy bag: 3」, coins 0 → 10;
  `stats()` two streets built, 4,464 triangles. 390 × 844 (dpr 3) in en, zh-Hans and zh-Hant: the shop's Me shelf (cat
  ears tile), BAYBAY's shelf, the 万圣节 page (繁體 conversion correct: 萬聖節目標 · 敲開 5 戶人家的門 · 糖果袋 · 36 顆), twelve
  big-night knocks (120 coins, 36 candies). Desktop try-on: witch hat + ghost sheet, pumpkin head + cat ears.
  `?world=district&halloween=night`: no `__opusBay.g`, no candy badge, no style tag, the district's goals card as before.
- Code: per-frame work (the frame system allocates only during a 1.3 s candy flight; street checks every 0.5 s, no
  allocation beyond a closure); teardown (`off()` drops the street meshes, the swing and candy, timers, the season gate,
  the Journal tab, the pill badge, the style tag; a world switch re-inits cleanly); save compatibility (items appended at
  indices 31–34 ≤ `MAX_WEAR_INDEX` 255, `halloween` bits in the frozen `PLAY_BIT_KINDS`, no format change); the ledger pays
  each `door:n` / `night:n` / `costume:first` once (cap 25 each); the prompt is offered on foot only
  (`syncMoving`); dt spikes (a whole answer in one frame still opens, pays and closes).

### Defects fixed (commit "W6-G-review: …", test `tests/opus-bay-w6-g-review.test.ts`, red before, green after)

1. **Phone pill: a third line starting with a dangling "·"** (`treatBadge.tsx`, new `treatNear.ts`, `treatRun.ts`,
   `play.ts`). On ≤ 600 px the pill's badges ride on its goals line (ui/Hud.tsx `badgesBelow`, W5-F9 "the pill keeps two
   lines"); the pill is 48vw (187 px) and its goals line 132 px, so 目标 0/10 + 🪙 + 🍬 overflowed (measured: en already at
   0 / 0, zh at 🪙 120 · 🍬 36) and the badges wrapped as one block onto a third line beginning with "·".
   Before: `docs/opus-bay/qa/w6/G/rev-phone-pill-before.jpg` (zh-Hant, 3 lines, "· 🪙 120 · 🍬 36"). After: away from the
   streets the phone pill is the old two lines (42 px, no candy badge); within `BUILD_NEAR` of a trick-or-treat street
   the badges take a line of their own with no leading separator (58 px) —
   `docs/opus-bay/qa/w6/G/rev-phone-pill-after-near.jpg`. The rules are injected by play.ts (a `<style data-ob="g-candy">`,
   removed at teardown; no CSS import so node tests still load `halloween/index`). Desktop unchanged.
2. **BAYBAY's milestone lines repeated** (`treat.ts` `treatMilestone`, `treatRun.ts`). "Once a session" + `doorsKnocked
   === 5` made 敲开了五户人家的门 play again on the big night at a door knocked in October (the count stays 5), and the
   bag's 5 / 10 lines and "every door" come back at the first treat of every session. Now the line is the milestone this
   treat crossed (before → after), so each is said once per save. (Also: fired timers leave the `timers` list.)
3. **万圣节 page on 1–2 Nov and on 31 Oct** (`HalloweenPage.tsx`, `treat.ts` `streetGoOffered`, `pageSourceOf`): 带我去
   was offered to undressed streets during Día de los Muertos; on the big night a street knocked in the season showed
   10/10 with no 带我去 although every door there had tonight's treat left. Now a street counts tonight's treats on the
   31st and 带我去 shows only while its doors are dressed and some are left.

Checks before the push (05:20): tsc 0 · `npx eslint .` 0 errors (the 43 old warnings, none new) · the opus-bay suite 1467 / 1467.

### Open items (not blocking)

- The pelican's Halloween look and a goals-card row: not built (the lane's recorded decisions; K1 request stands).
- Costumes are appended at the end of their shelves, so on a phone they sit behind the shelf's sideways scroll (BAYBAY:
  after four scarves and three hats). Suggest (K2, `economy/Shop.tsx` / `shelfItems`): seasonal items first while in
  season.
- On the big night a never-knocked door pays `door:n` + `night:n` (bag + 3) while the toast says ×2: cosmetic.
- `w6g-season-over` is in the line table but never said (no door is dressed on 1–2 Nov): harmless for lane X.
- The porch has no collider (you can walk into it where a kit house stands back); the kit-swap skip request stands.
- Near a trick-or-treat street the phone pill is three lines (58 px): the lead / W6-Z may want it in the HUD-area check.
- DEV-only `look()` framing is often blocked by a fence or tree (QA only).

### Blocking for the go-live

- None from lane G.
