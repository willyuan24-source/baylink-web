# Wave 8 · lane K · BAYBAY, feel, safety

Worktree `C:/Users/willy/wt/w8-k` (branch `w8-k`), dev port 5801, scratch `C:/Users/willy/opus-qa/w8/k/`, QA images
`docs/opus-bay/qa/w8/K/`. Owns `game/**` except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`, `album.ts`, `photo.ts`;
`actors/**` (X's look edits excepted); `eggs/**`; `data/cityZones.ts`; `play/PlayChip.tsx`, `play/chip.ts`, `play/kit.ts`;
`world/sf/props.ts` (`treesNear`); the canopy part of `world/materials.ts` (city-only).

## 给主人的摘要

1. **P0 已修**：小游戏面板（抓娃娃、捞螃蟹、捏酸面包、算命、那是什么？）、彩蛋卡片、万圣节明信片打开时，BAYBAY 不再自己冒出路过/到站/街区问候等台词（以前声音在响、气泡被面板盖住）；关上面板后这些台词再说。捉迷藏、放风筝、叮当车铃声对答进行时也一样安静。小游戏自己的台词（抓到啦、答对啦）照常。
2. 万圣节明信片打开时有人说话，气泡会先等着，明信片收好、BAYBAY 说完"收进手帐啦"之后再出来（等太久就不说了）。
3. 以后其他线加新面板，只要在一个列表里加一行名字就行（已推送给 M / A / H 线用）。

## Part a (2026-09-30, 18:52–19:15 PDT): P0 · BAYBAY talks under a lazy overlay

### What was built

- **`game/baybayHold.ts`** (new, strings only, ≈ 1 KB, imports nothing but `ui/slots`):
  - `BAYBAY_HOLD_OVERLAYS` — the overlay ids that hold BAYBAY's ambient lines while open: `play-claw`, `play-crab`,
    `play-dough`, `play-fortune` (lane M, W7), `w2-skyline` (W2), `play-result` (the PlayKit medal card), `play-snap`
    (the crest polaroid), `play-lion-badges` (the sea-lion count), `play-emotes` (the emote wheel), `h-postcard`,
    `egg-card`, `egg-note`, `egg-operator`, `egg-listen`, `c-album`, `c-letter`, `realsf-opening`.
    **Lanes M / A / H (and anyone adding a panel): append your overlay id to this array, one line, named in your commit.**
  - `BAYBAY_HOLD_ACTIVITIES` — PlayKit activity ids that hold them while they run, panel or not: `claw`, `crab`,
    `sourdough`, `fortune`, `skyline`, `kite`, `hide-seek`, `bell`. A new game with no panel of its own during which
    BAYBAY must not chatter goes here (its `startActivity` id).
  - `BUBBLE_WAIT_OVERLAYS = ['h-postcard']`; `baybayHeld()`, `holdingOverlay()`, `bubbleWaits()`,
    `noteHoldActivity(id)` (called by `play/kit.ts` on every start / stop / reset).
  - Never `openOverlays().length`: `play-chip` and `play-flight` are overlays too and never hold (the glide / stairs /
    ride lines go on under them); the shop (`e-shop`, `e-ticket`) is not in the list (its own 好看！买下啦。 line is
    said while it is open).
- **The gates** — `|| baybayHeld()` in every unprompted BAYBAY line source:
  - `game/cityMoments.ts` `stepPacer` (arrival, tour, transit, tunnel lines; a held line waits its ttl out) and the
    rumour teller's `rumourMoment`; `game/baybayLines.ts` (event + neighbourhood lines); `game/pelicanFirst.ts` (the
    pelican moment waits);
  - surgical, one clause each (named here and in the commit): `realsf/index.ts` (lane S: the Bay's calendar lines),
    `halloween/world.ts` (lane H: the season's lines and the lantern sniff), `economy/lines.ts` `quietNow` (the
    notebook / ticket / compass lines; not the shop).
- **`game/flow.ts` `bubble()`** now returns whether the bubble is on screen. While the Halloween postcard is open it
  **waits**: the last bubble said is kept (up to `BUBBLE_WAIT_MAX` 15 s) and shown once the card has closed and no
  other bubble is up (so the card's own 万圣节明信片收进手帐啦 keep line goes first); older than 15 s it is dropped (not
  said late). A play panel never holds a bubble: the games say their own lines over their own panels.
- **A voice never plays with its bubble hidden**: the pacer, `baybayLines` and `realsf` emit their `voice-line` only
  when `bubble()` returned true (voiceW5's text-matched lines already follow the bubble on screen, so a waiting bubble
  is voiced when it shows).
- Test **`tests/opus-bay-w8-k1-hold.test.ts`** (6): the pacer's voiced tour line under each of 7 panels (no bubble, no
  voice; said with its voice once the panel closes); the first-hill and first-bike lines under an egg card and the
  Halloween postcard; the play chip + first-flight chip do not hold; `bubble()` waits behind the postcard, shows after,
  is dropped after 15 s, and a game's own bubble shows over its own panel; the list / activities / every scheduler asks
  `baybayHeld()` / the gate imports no lazy module; hide & seek and the kite hold, a stairs race does not.
  **Red on the old code: 5 of 6** ("no tour line under play-claw", "nothing said under the egg card", "not on screen
  under the card", "game/cityMoments.ts asks baybayHeld()", "hide-seek: [前面就是渡轮大厦…]"); green after.

### Evidence

- Checks on `f1891399` (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old warnings) ·
  suite **1666 / 1666** (145 s). Touched lanes' tests (lines, verify-c, w5 content / eggs / play / shop, w6-h, w7-g
  postcards, w7-h, w7-m games, w7-w2 kite / skyline / hide & seek, tripflow): 233 / 233.

### Decisions

- The hold covers every unprompted BAYBAY line source I found (5 schedulers + the rumours + the pelican moment), not only
  the two W7-I named: the realsf calendar lines and the Halloween world lines had the same gap.
- The cards (album, letter, a 新店 card) hold too: they are modal cards like the egg card. The shop does not.
- The pacer still ignores `quietUntil` (the games' quiet minute) as before: its lines are the tour / transit / arrival
  narration; the hold list is the stronger, explicit rule.
- `bubble()` waits only behind the Halloween postcard (lane G's request: a modal like the city postcard reward, whose
  bubbles are still dropped as before).

### Known gaps

- Not yet played live (part a pushed first so the other lanes have the list; a live check follows in part b).

### Requests

- **Lanes M, A, H, W1, W2, S**: a new panel / card overlay → one line in `game/baybayHold.ts` `BAYBAY_HOLD_OVERLAYS`
  (and a PlayKit activity that must be quiet without a panel → `BAYBAY_HOLD_ACTIVITIES`), named in your commit.
