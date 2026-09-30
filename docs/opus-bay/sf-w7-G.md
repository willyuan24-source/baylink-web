# Wave 7 · lane G · Halloween games & postcards

Worktree `C:/Users/willy/wt/w7-g` (branch `w7-g`), dev port 5706, scratch `C:/Users/willy/opus-qa/w7/g/`, QA images
`docs/opus-bay/qa/w7/G/`. Brief: `sf-w7-lead.md` §3 row G, §4 (the charApi pelican widening).

## 给主人的摘要

1. 四张万圣节明信片现在真的会发到玩家手上：第一次讨到糖、10/31 大夜晚第一次讨糖、找齐 40 个南瓜灯、亡灵节看遍教会区 8 处——等 BAYBAY 说完话就弹出翻面卡片，点「收进手帐」后 BAYBAY 会说「万圣节明信片收进手帐啦」；手帐「发现」页和「万圣节」页都有这一栏，11/2 以后手帐里的还在。
2. 鹈鹕的蝙蝠翅膀上架了（小铺「坐骑」，100 金币，万圣节限定）：紫色蝙蝠膜、骨节、小爪子、橙色滚边晚上会亮，飞的时候跟着翅膀一起扑扇（电脑和手机都实际飞过）。
3. 万圣节期间，万圣节商品排在货架最前面；手机右上角胶囊在讨糖街附近不再变成三行（现在两行：金币 · 糖果）；大夜晚第一次敲的门会提示「双倍糖果 ×3！+10 金币」。
4. 旅行本「目标」页在万圣节期间多了一块「万圣节目标 0/3」，一键去万圣节页；Belvedere 街有一户其实是隔壁 Clayton 街的房子，已撤掉。
5. BAYBAY 的两句新台词（明信片、鹈鹕蝙蝠翅膀）在 20:50 就推送了，X 线可以录音。没有阻碍上线的问题。

## Part a · the four Halloween postcards at their moments (W7-G1, 20:25–20:45 PDT)

### What was built

| file | what |
|---|---|
| `halloween/playPostcards.ts` (new, pure) | `HALLOWEEN_CARD_GATES` (id, `earned(paid)`, `how` hint), `HALLOWEEN_CARD_ORDER`, `earnedHalloweenCards(paid)`, `halloweenCardCount`, `halloweenCardGate(id)`, `newlyEarned(before, after)`, `showCardsBlock(paid, inSeason)` |
| `halloween/playPostcardRun.ts` (new) | `initHalloweenPostcards()`: registers the `h-postcard` overlay (lazy), listens to the ledger, queues a card the moment its gate turns true, opens it after BAYBAY's bubble (`cardMayOpen`: ≥ 1.4 s after the moment, 0.8 s of quiet, nothing busy — dialogue, cinematic, city postcard reward, goals step — no side panel open, no other overlay; at 14 s even if she keeps chatting); kept → a `stamp` thud and BAYBAY's `w7g-postcard-keep`; a Settings reset drops what waits |
| `halloween/playPostcardCard.tsx` (new, lazy) | the card: the city postcard reward's look and flip (`.ob-reward` / `.ob-postcard`), the painting in front, the alt text + 万圣节限定 · 收在手帐「发现」页 on the back, BAYBAY's stamp, 收进手帐 / Keep it |
| `halloween/playPostcardGrid.tsx` (new) | `HalloweenPostcardGrid({ where })`: the 万圣节明信片 row (2 × 2: earned → picture, tap for the big one; locked → how to earn it) |
| `halloween/HalloweenPage.tsx` | the row after the goals |
| `economy/Notebook.tsx` (surgical, named) | the row in 发现 after 彩蛋明信片, city mode only, in the season or once a card is earned (so it **stays after 2 November**) |
| `halloween/lines.ts` | `W7_HALLOWEEN_LINES` (wave 7, apart from the recorded wave-6 table) and `hLine` reads both |
| `halloween/play.ts` | starts it; QA `__opusBay.g.card(id)` / `cards()` |
| `halloween/halloween.css` | the row and the card's orange kicker |
| `tests/opus-bay-w7-g-postcards.test.ts` (new, 5) | gates, moments, the hand-over rule, in play with the real ledger and fake timers, the new lines |

The gates (all read with the ledger's `isPaid`, so a card earned before this shipped still shows in the notebook):

| card | moment | gate |
|---|---|---|
| `halloween-trick-or-treat` | the first trick-or-treat | any `halloween:door:<n>` |
| `halloween-pumpkin-hunt` | the hunt's end | `halloween:hunt:all` (all 40, the lead's §6 decision) |
| `halloween-big-night` | the first treat on 31 October | any `halloween:night:<n>` |
| `muertos-mission` | all 8 Día de los Muertos spots | `halloween:muertos:12` |

### Evidence

- Played (dev 5706, `?world=city&start=free&halloween=night`), a fresh save, Belvedere door 5: 敲门 → the treat pays
  `door:5` + `night:5` → both cards earned at once; after BAYBAY's 谢谢您！ the 不给糖就捣蛋 card opens (Halloween
  postcard! 2/4), flips to its back; 收进手帐 → BAYBAY: "The Halloween postcard's in our notebook — we can look at it any
  time!" → the big-night card follows. Desktop 1440 × 900 and phone 390 × 844 dpr 3 (quality mid):
  `docs/opus-bay/qa/w7/G/a1-phone-card-front.jpg`, `a1-card-back.jpg`, `a1-phone-keep-line.jpg`; the 万圣节 page row (2 × 2, locked ones with their hint) behind the card in `a1-phone-card-over-journal-before.jpg`.
- The first play showed the second card opening over the Journal (I had opened it): the card now waits while a side
  panel is open (test pinned).
- Checks: tsc 0 · `npx eslint .` 0 errors (43 old warnings) · suite 1494 tests, 1493 pass: the one failure is the known
  `W5-bus 20+ simulated minutes` (forced blockers 29 vs ≥ 30), failing alone too — it imports no file of this lane
  (transit, streets, terrain only); lane B is hardening it (lead §1).

### Decisions

- **No hook in lane H's `hunt.ts` / `muertos.ts`, none in the treat's code**: the run listens to the ledger (its
  `notify` after every pay) and compares the earned cards before / after. The moments are exactly the ledger ids the
  scouts named (`hunt:all`, the first `door:n`, the first `night:n`, `muertos:12`), H's files stay untouched (no rebase
  conflict while H edits them), and a card can never be handed over twice in a save.
- The treat card at the **first** door (not the 5-door goal): most players knock once; the goal already has its line.
- Cards earned before the wiring (or in an earlier session) never pop up at load: they are in the notebook.
- No new save bit (the `spare:` ids stay unassigned): "earned" is the ledger's own record.
- BAYBAY's line when the card is kept (not when it opens: her bubble would sit under the card's dim).

### Known gaps

- A bubble that starts while the card is open (a neighbourhood greeting after a teleport, seen in QA) shows above the
  dim: `game/flow.ts bubble()` pauses only for the city postcard reward and the goals step (lane K's file).

## Part b · the pelican's bat wings (W7-G2, 20:48–21:30 PDT)

### What was built

| file | what |
|---|---|
| `actors/charApi.ts` (the approved widening, §4, surgical) | `CharWho` += `'pelican'`; `AttachSlot` += `'wingL' \| 'wingR'`. Existing callers unchanged (tsc: the only errors the widening raised were inside `charImpl.ts`) |
| `actors/charImpl.ts` (surgical, lane K's file) | a `pelican` slot table (`head` on the yellow crown, `neck` at the ribbon, `back` on the mantle, `wingL` / `wingR` = the wing bones' own frames); `slotDef()` (a slot a body lacks does nothing: `attach('player', 'wingL', …)` is ignored); `anchor()` resolves `host.pelican()` and returns null without a rig; `syncPelican()` once a frame (in `update`, no allocation unless the rig changed) puts waiting pelican attachments on when the rig appears, moves them to a new rig, takes them off when it goes; `dispose()` clears them; `emote` / `tint` on the pelican do nothing |
| `economy/items.ts` (APPEND-ONLY) | `CostumeKind` += `'bat-wings'`; `pelican-bat-wings` appended (index 35): 鹈鹕蝙蝠翅膀 / Pelican bat wings, shelf `rides`, slot `pelican`, 100 coins, `season: 'halloween'`, note 万圣节限定 · 飞起来会扑扇 |
| `economy/wear.ts` (surgical) | the `pelican` slot: bat wings → `attach('pelican', 'wingL' / 'wingR', mesh)` + `vehiclePaint('pelican', null)` (the ribbon off); a ribbon / nothing → the wings off (only when they were on, so a ribbon change sends exactly what it always sent) + the paint |
| `halloween/costumeMesh.ts` | `batWingGeometry(side)`, `pelicanBatWingMesh('L' \| 'R')`: a thin membrane just above the feathered arm (dark purple on top, mauve underneath) with a scalloped trailing edge between three finger ribs fanning back from the wrist, a cream thumb claw, an orange piping on the leading edge that glows at night (`aInfo.w` 0.9); **108 triangles a wing, 216 the pair** (≤ 420), the hats' material (`ob-toy-dyn`: no new program), no shadow |
| `halloween/costumeArt.tsx` | the shop tile (two scalloped wings, the piping) |
| `halloween/costume.ts` | watches the `pelican` slot too: the `halloween` costume event (X's poof), `costume:first`, BAYBAY's `w7g-costume-bat-wings` 鹈鹕也扮成小蝙蝠啦，扑扇扑扇！ |
| `halloween/HalloweenPage.tsx`, `halloween.css` | the costume list shows the wings (5 tiles, auto-fill grid) |
| `tests/opus-bay-w7-g-pelican.test.ts` (new, 4) | charApi on the real pelican rig with a stub host (waits for the rig, on the wing bones, the tip rises > 0.8 u with a 0.6 rad flap, moves to a new rig, off without one, dispose, wing slots only on the pelican, the player's head slot unchanged); the item; wear; the geometry budget |
| `tests/opus-bay-w5-shop.test.ts` (surgical) | the W5-E6 rule "every pelican-slot item is a PAINTS paint" exempts the bat-wings costume |

### Evidence

- Played (dev 5706, `?world=city&start=free&halloween=1&debug=1`): 110 coins → bought the wings (→ 10, + 10 for
  `costume:first` = 20) → BAYBAY: "Our pelican's a little bat now — flap, flap!" (`qa/w7/G/b-bought-line.jpg`) → G:
  the glide over the Bay with the bat wings on both wings, orange piping, claws, finger ribs, the hands' feathers past the
  wrist (`b-desktop-bat-wings-glide.jpg`, 1440 × 900). Phone 390 × 844 dpr 3, quality mid, climbing (W held): three
  frames 180 ms apart, the wings (and the membranes with them) at three flap angles (`b-phone-bat-wings-flap-strip.jpg`).
  Draw calls during the glide 50 (the wings add 2 small meshes while worn).
- Checks (21:40, before the rebase): tsc 0 · `npx eslint .` 0 errors (43 old warnings) · the suite **1498 / 1498** (the deadlock test passed this run). The first run had two red W5 shop tests from this part, fixed before the push: W5-E6 wants every pelican-slot item to be a paint (the bat wings are exempted as a costume, surgical) and W5-E7 pins the calls a ribbon sends (wear.ts now takes the wings off only when they were on).
- After the rebase onto `f90e3bf3` (lanes Q, W2, R): tsc 0 · eslint 0 errors · suite 1513 tests, 1512 pass; the one red was the wall-clock `W5-D-review the paid memo` (2000 counts in 162 ms under load), green alone (5 / 5).
- Pushed after rebasing onto `d64dc400` (lanes P, H, S: the full suite 1532 tests, every one green but the five of my own untracked part-c test file, red before its fix as it should be) and then onto `7e93789a` (lane W1's seam data only): tsc 0 and the related tests (w7-g, w6-g, w5-shop, w5-char, w7-w1-seam) 59 / 59.

### Decisions

- Two rigid meshes on the wing bones, not a SkinnedMesh bound to the rig: a skinned mesh on the hats' material would be a
  new shader program; rigid pieces on the arm flap exactly with it. The membrane stops at the wrist (x ≈ 2.0): the hand
  flexes on its own bone (`tipL` / `tipR`, not in the approved slots), so a membrane over it would part from the feathers
  — the feathered hand past the bat wing reads as a costume strapped on.
- The wings replace the ribbon in the one `pelican` wear slot (no save change).
- 100 coins (the brief's ≈ 100; the costumes are 80–120).
- A try-on in the shop attaches them to the pelican's rig like the ribbon's paint (seen when the pelican is near).

### Known gaps

- `back` / `head` / `neck` on the pelican exist in the slot table but nothing uses them yet (a pumpkin bow later).

## Part c · the Halloween games' polish (W7-G3 … G7, 21:45–23:00 PDT)

### What was built

| item | files | what |
|---|---|---|
| (3) seasonal first (W7-G3) | `economy/items.ts` `shelfItems` | while a seasonal item is on sale it leads its shelf (the shop groups tiles by slot in this order, so its slot's group comes first): BAYBAY 女巫帽, 南瓜头 then 毛线帽…; 我 猫耳朵, 小幽灵 first; 坐骑 蝙蝠翅膀 then 鹈鹕丝带 and the paints. Out of season an owned one keeps its append-order place. The `ITEMS` order (the save's indices) is unchanged |
| (4) the phone pill (W7-G4) | `halloween/treatNear.ts` `CANDY_PHONE_CSS` (injected by play.ts) | near a trick-or-treat street the pill keeps **two lines**: its second line becomes the purse 🪙 n · 🍬 n in place of 目标 n/10 (the goals text is sized to nothing, still read by a screen reader; the Journal and the goals card show the goals), no dangling "·". Far from the streets as before (no bag) |
| (5) the treat toast (W7-G5) | `halloween/treat.ts` `treatToast`, `treatRun.ts` | the toast counts what THIS treat paid: 得到巧克力！+5 金币 · 糖果袋 4 颗 in the season; on the big night 双倍糖果：巧克力 ×2！… and at a door never knocked before ×3 and +10 金币 (`door:<n>` + `night:<n>`); the coins are the ledger's own delta (0: not shown) |
| (6) the kit-swap skip (W7-G6) | `world/sf/kitSwap.ts` (surgical: `setKitSwapSkip`, one line in `reselect`), `halloween/treat.ts` `doorOnLot`, `treatRun.ts` | while the doors are dressed a lot whose box holds a treat door (within 0.6 u) is never chosen for a SAM kit house (one already there leaves after the dwell): the porch keeps the toy house it was built against. Set through a dynamic import (kitSwap is its own chunk), cleared when the season ends or the feature stops |
| (7) Belvedere (W7-G7) | `halloween/treatDoors.ts` | measured on the published city (scratch `opus-qa/w7/g/belv.mts`: the 17th St crossing (43.2, 859.9), Parnassus (0.8, 830.0), a 51.9 u block): **no door was past Parnassus**; door 8 stood on a **Clayton Street** face at the Parnassus end (3.3 u from Clayton's centreline, 6.7 from Belvedere's — the W6 run only asked for a face parallel to Belvedere within 7 u) → `gone: true` (append-only). Doors 1–3 stand 4–10 u past the 17th St end, on Belvedere itself (5.5–6.7 u from it): kept. 53 doors to knock (Belvedere 8) |
| (8) goals row | — | part d (W7-G8, below) |
| (9) templated lines | — | checked: every BAYBAY bubble of lane G is a fixed line of `halloween/lines.ts` (`sayLine(id)` → `hLine`), the postcard's and the wings' lines included; the numbers live in toasts / the page, never in a bubble. Nothing to split |
| tests | `tests/opus-bay-w7-g-polish.test.ts` (new, 5; red before the fix: the full-suite run at 22:07 had these five red and everything else green), `tests/opus-bay-w6-g-review.test.ts` (the W6 near rule → the purse rule), `tests/opus-bay-w6-g-treat.test.ts` (picks live doors) | |

### Evidence

- Phone 390 × 844 dpr 3, quality mid, `?halloween=night&lang=zh-Hans`, a fresh save: at Belvedere the pill reads
  明信片 0/24 / 🪙 0 · 🍬 0 — **42.5 px, two lines** (it was 58 px, three lines, in W6); a knock on a door never knocked
  before: the toast 双倍糖果：巧克力 ×3！+10 金币 · 糖果袋 3 颗, the pill 🪙 10 · 🍬 3, still 42.5 px
  (`qa/w7/G/c-phone-toast.jpg`). The shop on the phone in season: 坐骑 opens on 蝙蝠翅膀 100 before 鹈鹕丝带 90
  (`c-phone-shop-rides.jpg`); BAYBAY's shelf reads 女巫帽, 南瓜头, 毛线帽, 遮阳帽, 水手帽, then the scarves.
- Checks (22:57): tsc 0 · `npx eslint .` 0 errors (43 old warnings) · the suite **1538 / 1538**. After the rebase onto
  `c3dd95cc` (23:14): tsc 0 · eslint 0 errors · 1582 tests, 1581 pass: the one red is `W5-bus 20+ simulated minutes`,
  now failing the same way every run ("bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)"), also with
  this part's source files put back to origin's (so it is on origin, not from this lane; see Requests).
- The kit skip: unit-tested on the real `KitSwap` class (a door's lot never swaps while the skip is set, swaps after,
  a swapped one leaves when it is set again). In the live dev runs the swap had 0 houses on at the spots tried (the
  Ferry plaza, Chenery door 12) whether or not the skip was set, so an in-game A/B shot was not possible tonight.

### Decisions

- The pill: the purse instead of the goals count near a street (the goals count is one tap away and on the goals card);
  a narrower badge or a third line both failed the two-line rule in W6's measurements.
- Belvedere: only the door that is not on Belvedere goes; the doors just past 17th St are Belvedere houses (the closure
  block is where the street closes, not where people knock). No replacement door: the only other in-block face the
  script's checks accept (with relaxed parallel / distance limits) is also a Clayton face (4.4 u from Clayton).

### Known gaps

- Door-to-street checks for the other five streets were not re-run (a face nearer another parallel street could exist
  there too, as on Belvedere).
- The kit skip was not seen in a live A/B (above).

## Part d · a Halloween block in the city's goals (W7-G8, 23:20–23:40 PDT)

### What was built

- The city's goals are the journal's 目标 tab (the pill opens it; the old goals card is only the district's and a
  fallback in the city: `game/flow.ts startFree` shows the goals step once instead), so the Halloween row goes there:
  `ui/slots.ts` (surgical, lane Q's file) `registerGoalsRow({ id, order, Component })` / `goalsRows`; `ui/Journal.tsx`
  (surgical) renders them after the explorer goals in the city (`GoalsRows`); `halloween/playGoalsRow.tsx`
  `HalloweenGoalsRow`: 🎃 万圣节目标 n/3, the three goals with their counts (the tab's own ob-goals list) and a
  万圣节页：讨糖街、南瓜灯、明信片 › button (`openJournal('halloween')`); `halloween/play.ts` registers it while
  `inHalloween()` (re-checked every 30 s with the 万圣节 tab) and undoes it with the feature. The district's tab is
  unchanged (the rows render in city mode only, and the Halloween feature never loads in the district).
- Test: `tests/opus-bay-w7-g-polish.test.ts` W7-G8 (in the season on 12 Oct the block is registered, undone with the
  feature; on 20 Nov none).

### Evidence

- Phone 390 × 844 dpr 3, `?halloween=1&lang=zh-Hans`: the pill → 目标: 坐地铁… / 大学巡礼 0/3, then 🎃 万圣节目标 · 0/3
  (敲开 5 户人家的门 · 0/5, 找到 10 个南瓜灯 · 0/10, 穿上一套万圣节服装) and the page button, then 邻居的小忙
  (`qa/w7/G/d-phone-goals-tab-halloween.jpg`).
- Checks (23:47, the tree on origin `fe80aa0e` + part d): tsc 0 · `npx eslint .` 0 errors (43 old warnings) · the suite
  1583 tests, 1582 pass — the one red is the deadlock test that is red on origin (Requests). Rebased onto `81787b14`
  (lanes M, R, H: `economy/records.ts` rows, play / realsf / halloween-world files): tsc 0 and the related tests (w7-g,
  w6-g, w7-m, w5-shop, the contracts) 88 / 88.

## The pushed tree (00:15 PDT, `1251f8ec` = origin with lanes Q7–Q9, P3–P4, M4 in)

- The part-d push rebased onto `9690c56d` (lanes Q, P, M: none of this lane's files) and went out after tsc 0 only; the
  full check on that exact tree followed: tsc 0 · `npx eslint .` 0 errors (43 old warnings) · 1614 tests, 1611 pass —
  the deadlock test red on origin (Requests) and two wall-clock tests under the night's load (`W5-D-review the paid
  memo`, `W5-T6 audio hooks internals` "refilled at 16 a second"), both green alone (40 / 40).
- Played once more on that tree (phone, `?halloween=night`, a fresh save): the knock pays `door:5` + `night:5`, both
  cards wait (`__opusBay.g.cards()`), and they wait behind the new-save goals step (先看看这几个小目标～) as they should
  (never over the goals step, a dialogue or a panel); they open once it is closed (the in-play test and part a's runs).

## Not done

- The door-to-street check (a face nearer another parallel street, as Belvedere's door 8 was) for the other five streets.
- A live A/B of the kit-swap skip (the swap had no house on at the spots tried; the hook is unit-tested on the real class).
- The pelican's `head` / `neck` / `back` slots have no costume yet (a pumpkin bow would go on `neck`).
- The city's fallback goals card (`ui/Moments.tsx`, shown only when the goals step's chunk is missing) has no Halloween
  row: the city's goals are the journal's 目标 tab, which has it.

## Requests

- **Lane X**: record `W7_HALLOWEEN_LINES` in `src/opus-bay/halloween/lines.ts` (2 lines, pushed 20:50 in `559006e5`):
  `w7g-postcard-keep` 万圣节明信片收进手帐啦，随时都能翻出来看！ / The Halloween postcard’s in our notebook — we can
  look at it any time! · `w7g-costume-bat-wings` 鹈鹕也扮成小蝙蝠啦，扑扇扑扇！ / Our pelican’s a little bat now — flap,
  flap!. Both are said as BAYBAY bubbles with exactly these texts (`sayLine(id)`); the wave-6 table is unchanged.
- **Lane B / the lead**: `tests/opus-bay-w5-deadlock.test.ts` "W5-bus 20+ simulated minutes" is red on origin after
  ≈ 23:00 in every run, alone too: "bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)" (not the
  blocker count B1 fixed); it stays red with this lane's files put back to origin's.
- **Lane K** (optional, `game/flow.ts`): `bubble()` pauses for the city postcard reward and the goals step only; a
  bubble that starts while the Halloween postcard (`h-postcard` overlay, a modal like the reward) is open shows above its
  dim — pausing bubbles while it is open would match the city card.
- **Lane V** (FYI): the bat wings ride the pelican rig's `wingL` / `wingR` bones (charImpl `SLOTS.pelican`): keep those
  bones' names and positions if the pelican's look changes.
- **Lane Q** (FYI): two surgical additions in your files — `ui/slots.ts` `registerGoalsRow` / `goalsRows` and
  `ui/Journal.tsx` `GoalsRows` after the city's explorer goals; the phone pill near a treat street is two lines through
  G's injected CSS (`halloween/treatNear.ts`).
