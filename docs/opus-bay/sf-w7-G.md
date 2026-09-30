# Wave 7 · lane G · Halloween games & postcards

Worktree `C:/Users/willy/wt/w7-g` (branch `w7-g`), dev port 5706, scratch `C:/Users/willy/opus-qa/w7/g/`, QA images
`docs/opus-bay/qa/w7/G/`. Brief: `sf-w7-lead.md` §3 row G, §4 (the charApi pelican widening).

## 给主人的摘要

1. 四张万圣节明信片现在真的会发到玩家手上：第一次讨到糖、10/31 大夜晚第一次讨糖、找齐 40 个南瓜灯、亡灵节看遍教会区 8 处——等 BAYBAY 说完话，就弹出和城市明信片一样的翻面卡片（正面是画，背面是说明），点「收进手帐」后 BAYBAY 会说「万圣节明信片收进手帐啦」。
2. 手帐「发现」页和「万圣节」页都有「万圣节明信片」一栏（没拿到的写着怎么拿）；万圣节过后（11/2 之后）手帐里的这一栏还在。
3. BAYBAY 的两句新台词（明信片、鹈鹕蝙蝠翅膀）已在 23:30 前推送，X 线可以录音。

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
| (8) goals card row | — | not done (below) |
| (9) templated lines | — | checked: every BAYBAY bubble of lane G is a fixed line of `halloween/lines.ts` (`sayLine(id)` → `hLine`), the postcard's and the wings' lines included; the numbers live in toasts / the page, never in a bubble. Nothing to split |
| tests | `tests/opus-bay-w7-g-polish.test.ts` (new, 5; red before the fix: the full-suite run at 22:07 had these five red and everything else green), `tests/opus-bay-w6-g-review.test.ts` (the W6 near rule → the purse rule), `tests/opus-bay-w6-g-treat.test.ts` (picks live doors) | |

### Evidence

- Phone 390 × 844 dpr 3, quality mid, `?halloween=night&lang=zh-Hans`, a fresh save: at Belvedere the pill reads
  明信片 0/24 / 🪙 0 · 🍬 0 — **42.5 px, two lines** (it was 58 px, three lines, in W6); a knock on a door never knocked
  before: the toast 双倍糖果：巧克力 ×3！+10 金币 · 糖果袋 3 颗, the pill 🪙 10 · 🍬 3, still 42.5 px
  (`qa/w7/G/c-phone-toast.jpg`). The shop on the phone in season: 坐骑 opens on 蝙蝠翅膀 100 before 鹈鹕丝带 90
  (`c-phone-shop-rides.jpg`); BAYBAY's shelf reads 女巫帽, 南瓜头, 毛线帽, 遮阳帽, 水手帽, then the scarves.
- Checks (22:57): tsc 0 · `npx eslint .` 0 errors (43 old warnings) · the suite **1538 / 1538**.
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
