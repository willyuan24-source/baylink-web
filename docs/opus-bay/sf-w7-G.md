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
