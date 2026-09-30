# Wave 7 · lane M · San Francisco mini-games

Lane M (sf-w7-lead.md §7): new one-minute games only San Francisco has. Worktree `C:/Users/willy/wt/w7-m` (branch
`w7-m`), dev port 5712, scratch `C:/Users/willy/opus-qa/w7/m/`, QA images `docs/opus-bay/qa/w7/M/`. Owned: new
`play/<game>*` files, their registration line in `play/zones3.ts`, the appended rows of `economy/records.ts`, the
`medal:<game>:n` rewards.

## 给主人的摘要

1. 渔人码头的**机械博物馆**（Musée Mécanique，45 号码头）门口多了一台**抓娃娃机**：五枚 25 美分硬币，拖动爪子（手机单指拖、松手就抓；电脑 ← → 加空格），抓旧金山小纪念品——小缆车、金门大桥挂件、海狮玩偶、幸运饼干、酸面包抱枕、科伊特塔模型、彩色小屋、螃蟹玩偶，一共 8 种可以收集。
2. 旁边还有一台**算命婆婆**机器：投币后水晶球发光、卡片滑出来，写着一句好玩的"预言"和一条真实的旧金山小知识（每条都查过官网/资料），每次换一张。
3. 两台机器在世界里都有小模型（红色抓娃娃机、酒红色算命亭），只在走近时出现，只多 1 次绘制。
4. **7 号码头捞螃蟹**（渡轮大厦旁边，开局就能走到）：放下圈网 → 等螃蟹闻到饵爬进网（绳子会抖）→ 按住「拉！」一口气拉上来（拉得断断续续螃蟹会溜走）→ 用尺子量：按旧金山湾的真实规定，**珍宝蟹一只都不能带走**，**石蟹满 4 英寸**才可以留；最后全部放回海里。拉早了空网、拉晚了饵被吃光，耐心+判断对才能拿满分。
5. **渔人码头捏酸面包**（面包坊门口的小桌子）：跟着节拍揉面 → 选形状（圆面包、螃蟹、乌龟——码头的面包师真的会把酸面包捏成小动物）→ 刀划过虚线时划三刀 → 看着烤箱里的颜色，金黄的时候出炉。
6. 三个游戏手机（单指）和电脑（键盘）都实际玩过、截图看过；奖励和以前一样：好 / 很好 / 太棒了 三档（5 / 10 / 15 金币，每档一次），最好成绩进手帐"我的记录"。BAYBAY 的 34 句新台词已推上去等配音。本线没有用 Higgsfield（画面全部用代码画）。

## Part a · W7-M1 the Musée Mécanique: the claw machine and the fortune teller (20:34 → 21:50 PDT)

### Inventory first (what exists; nothing duplicated)

`play/`: first flight + Golden Gate rings, emotes / pet / sit / 16 view spots, the Seward slides, the cable-car bell riff +
lean-out, stair races (Filbert, Tiled, Lyon), the step counter, marshmallows at the Ocean Beach fire rings, the turntable
heave-ho, 12 crest hops, counting K-Dock's sea lions, frisbee, beach ball, the cardboard grass slide, the crooked-street
descents, hide & seek. `eggs/`: 24 eggs + city sounds (Laughing Sal at the Musée's door, the foghorn duet, the Wave Organ,
fortune-cookie rumours in `eggs/cookies.ts`, pebbles…). Pier 7's end has the district's 甩一竿 fishing (a POI). Lane W2
(running in parallel) owns kites, the skyline quiz and the busker. None of them is an arcade machine, crabbing or
bread-making: the three games of this lane are new.

### What was built

| file (all new unless named) | what |
|---|---|
| `play/sfgamesLines.ts` | the three games' names and **all of BAYBAY's fixed lines** (claw 11, crab 13, sourdough 10; zh + en, never templated) — pushed in part a so lane X can record them |
| `play/sfgames.ts` (zones chunk, 1.5 KB gz with all three games) | `initSfGames()`: the prompts 抓娃娃 (`play:claw`, −202.8, 71.8, r 1.8) and 算一卦 (`play:fortune`, −199.4, 70.8, r 1.6) on the pavement in front of the Musée (by the crab-wheel sign at Jefferson & Taylor), BAYBAY's invite at the door, the games' chunks prefetched within 60 u, the panels as lazy overlays (`play-claw`, `play-fortune`), the toy props mounted within 90 u (unmounted beyond 110 u); both prompts step aside while a game runs; DEV hook `__opusBay.sfgames` |
| `play/zones3.ts` (lane A/K's file, **surgical**, named) | 4 lines: `import('./sfgames')` → `initSfGames()` at init, disposed with the zones |
| `play/claw.ts` (3.3 KB gz) | `ClawGame` (pure, stepped by the game loop: a paused game pauses the claw): 5 quarters, 12 s to aim each (then it drops by itself), drop → close → lift → carry to the chute → release; a grab within 2.4 u of a prize's middle **never slips**, farther off it slips back part-way up (chance falls to a quarter of the prize's grip at its edge), empty glass is a miss; 8 souvenir kinds (`PRIZE_KINDS`, append-only: the saved set is a bit per kind in `play.b['claw-set']`); `startClaw()` through the PlayKit (`claw`, lock, cancel on move), keys ← → A D, Space / Enter / ↓ / S, Esc gives up (E swallowed), tiers **● 1 · ◆ 2 · ★ 3+ souvenirs** → `medal:claw:1..3`, best = souvenirs in one go, BAYBAY claps at each catch, a Musée fact after the card, then the fortune teller's invite |
| `play/ClawPanel.tsx` (3.5 KB gz) + `play/clawArt.ts` | the glass cabinet on a 2D canvas (dpr-aware, drawn every animation frame from the game; React re-renders only on a phase change): bulbs, rail, wooden floor, the chute, the 8 souvenirs drawn in code (no image files, no brand, no text), the claw with fingers over a held prize, an aim line; one thumb: **drag in the glass and let go to grab** (a tap aims there and drops); ◀ 抓！ ▶ buttons 56 px (hold ◀ ▶); the quarters left as coins, the aim clock, 收集 n / 8 |
| `play/fortune.ts` + `play/FortunePanel.tsx` (2.3 + 1.4 KB gz) | the fortune-teller automaton: a coin, the booth whirs, her hand circles the glowing crystal ball, a card slides out after 1.6 s: a playful fortune + a real SF fact + its source's host; 8 cards in turn (`play.b['fortune-n']`); a PlayKit activity with no medal while the card is up (feet held, nothing else offered; walking away closes it) |
| `play/sfgamesSounds.ts` | synthesized `m-coin` (a quarter), `m-whir` (the claw's motor), `m-grab`, `m-splash`, `m-tug`, `m-ding`, `m-pat` |
| `play/sfgamesProps.ts` | ONE InstancedMesh of boxes on the existing `ob-toy-inst` program (play/toyMesh.ts: no new program): the red claw cabinet (12 boxes) and the maroon fortune booth (8 boxes) on the Pier 45 shed's south wall, mounted only near |
| `play/sfgames.css` | the panels (tokens of opus-bay.css; phones under the top pills; reduced motion) |
| `economy/records.ts` (APPEND-ONLY) | rows `claw` (Musée claw machine), `crab`, `sourdough` (points) |
| `tests/opus-bay-w7-m-games.test.ts` | 8 tests (below) |

### Evidence

- **Tests** `tests/opus-bay-w7-m-games.test.ts` 8 / 8: the lines (fixed, zh ≤ 45); the pile (each kind once, inside the
  glass, clear of the chute, 4 seeds); the claw's rules (a centred grab under the worst luck still holds and lands in the
  chute, an off-centre one slips, an empty grab misses, five quarters then done, the aim clock drops by itself); **a whole
  game through `stepFrameSystems`** aimed like a player → `medal:claw:1/2/3`, best 5, 5 kinds kept, the ★ card; 放弃 →
  cancel, nothing paid, the lock gone; the fortunes (8, each an https source; the next card; one at a time; no reward);
  the records rows appended; **both prompts standable on the published city** and clear of each other, Laughing Sal's
  egg and the Wharf card; the chunks (zones 1.5 KB, claw 3.3, panel 3.5, fortune 2.3, its panel 1.4 KB gzip; lazy from
  zones3 / sfgames; nothing in GameRoot).
- **Played in the game** (dev 5712, `?world=city`, one headless Chrome, `--force_high_performance_gpu`; images read):
  desktop 1440 × 900 — the prompt 抓娃娃 at the Musée, E opens the cabinet, → moves the claw, Space drops, the loaf
  lifted to the chute (scratch `claw-desk-3.jpg`); a whole game of five aimed drops → the card **★ Brilliant · 5 won ·
  5 / 8 kinds · +30 coins** and BAYBAY's 新的纪念品！ (`qa/w7/M/a1-claw-result-desk.jpg`); Esc gives up (the game gone, no
  card); 算一卦 → the booth and the card "You will find treasure where you least expect it" + the 300-machines fact +
  sanfranciscobay.com (`a2-fortune-desk.jpg`). **Phone 390 × 844 dpr 3 (touch)**: the panel under the top pills, the
  cabinet 344 × 275 px, the buttons 56 px (`a1-claw-open-phone.jpg`); a finger drag across the glass and lift → the claw
  goes there, drops and lifts the house (scratch `claw-phone-drag.jpg`), 1 won / 4 quarters left after it.
- **Calls / triangles** (desktop high, dev QA hook `renderer.info`): at the Musée prompt 92 calls / 316k; the props layer
  on vs off at the same pose: **+1 call** (93 → 94), triangles within noise (20 boxes ≈ 240 triangles); the panel open
  88 calls (the view behind is the same world: nothing is drawn in 3D by the games).

### Decisions

1. **The games' visuals are 2D panels over the world**, not 3D scenes: a claw machine seen close up reads best as a flat
   toy cabinet; it costs 0 calls in 3D and works the same on every GPU; the world gets small box props so the place is
   visible (`a3-props-wharf-desk.jpg`).
2. **One thumb**: drag-and-release in the glass is the phone's control (the buttons are there too); the keyboard has
   ← → and Space. A centred grab never slips, so skill wins, not luck; the aim line shows where the claw will drop.
3. **No brand, no named machine**: "a claw machine" and "the fortune teller" (not any trademarked automaton); the
   souvenirs are generic toys of SF sights. The real Musée's facts appear only as facts (sources below).
4. **The fortune teller has no medal**: a keepsake card, one at a time, the next one each visit.
5. **Records**: `points` is the only fitting unit of `economy/records.ts` (append-only rows, the type not changed), so
   the claw's row reads 最高 5 分 (souvenirs in one go).
6. **No Higgsfield** in this lane: the lead's §7 gives the spending to lanes X and V; everything is drawn in code.

### Facts (checked on the web 2026-09-29)

- The Musée Mécanique: at Pier 45 since 2002 (the Cliff House basement 1972–2002, Playland before), over 300 mechanical
  machines (≈ 200 on show), free admission, pay per game, the oldest a praxinoscope from 1884, Laffing Sal, owned by Dan
  Zelinsky (Ed's son) — https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique ; hours 10–8 daily, games take quarters
  (25 or 50 cents) — https://www.sanfranciscobay.com/museums/musee-mecanique/ (the museum's own site refused the
  connection today).
- The fortunes' facts: sea lions on K-Dock since 1990 (https://www.pier39.com/sea-lions/), the bridge's foghorns
  (https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/), Lombard's eight hairpins
  (https://en.wikipedia.org/wiki/Lombard_Street_(San_Francisco)), sourdough since the Gold Rush of 1849
  (https://en.wikipedia.org/wiki/History_of_bread_in_California), Pier 7 840 ft, no licence
  (https://www.pierfishing.com/pier-7-san-francisco/), Playland closed 1972 (the Wikipedia page above).

### Known gaps

- The souvenirs collected show on the card and the panel (n / 8), not yet as pictures in the notebook.
- The props stand on the shed's south wall by the crab-wheel sign (the Musée's door itself is not modelled).
- The fortunes are text (not voiced): they are a card, not BAYBAY's lines.

### Not done (this part)

- Crabbing (part b) and sourdough (part c).

### Requests

- **Lane X** (voice): BAYBAY's new lines are all in `src/opus-bay/play/sfgamesLines.ts` (`CLAW_LINES`, `CRAB_LINES`,
  `DOUGH_LINES`, exact zh + en) — pushed with part a, before 23:30.
- **W7-I / W7-Z**: the Musée prompts are at −202.8, 71.8 and −199.4, 70.8 (Jefferson & Taylor); the props add 1 call
  within 90 u of them.

## Part b · W7-M2 crabbing off Pier 7 (21:45 → 22:20 PDT)

### What was built

| file | what |
|---|---|
| `play/crab.ts` (new) | `CrabGame` (pure): three nets; 放网 (the ready prompt drops it by itself after 8 s) → it sinks 1.1 s → the soak: six crabs a net set off over the first 9 s from both sides, walk to the bait, eat 5–9 s and wander off; the bait lasts 16 s, then none come; the rope twitches while any eat (`tug`) → 拉！ held: the net rises at 0.95 depth/s, sinks back at 0.3 when let go; below 60 % depth each crab on it may scuttle off (0.3 /s hauling, ×6 when the haul stalls) → on the deck each crab on the gauge: 放回去 / 够 4 英寸，留下, judged by `mustRelease` (**a Dungeness always goes back; a rock crab stays from 4 inches**); rock crabs are never within ¼ inch of the line (read by eye); 10 points a crab landed + 10 a right call; tiers **● 30 · ◆ 90 · ★ 150** → `medal:crab:1..3`, best = points; BAYBAY: the drop, the first tug, too early / too late / one got away, each rule once a game (or 再看看尺子哦～ on a wrong call), cheers at a catch, the bye line (all back into the bay) and the no-licence fact after the first game. Keys: Space (drop; hold to haul — a Space still held from the drop never starts the haul), ← / 1 put back, → / 2 keep, Esc gives up, E swallowed |
| `play/CrabPanel.tsx` + `play/crabArt.ts` (new) | the canvas: the pier's planks and a pile, the surface with little waves, light shafts, kelp, the sand, the rope (it twitches), the bridled ring net with its bait, the crabs (rock: brick red, black claw tips; Dungeness: purple-brown, white claw tips) walking, eating, riding the net up; the gauge: a ruler 0–7 in with quarter ticks, the 4-inch line dashed up through the crab, the shell's two edges marked down to the ruler. One big button per step (56 px): 放网 → 拉！（按住） → 放回去 / 够 4 英寸，留下 (the rule under each); the nets as rings, the points |
| `play/sfgames.ts` | `play:crab` 捞螃蟹 at Pier 7's east rail (73.6, −24.3, r 1.6: the pier's frame u 16, v −1.4; 20 u from the district's 甩一竿 at the end), the invite, the prefetch, the overlay `play-crab` |
| `play/sfgamesProps.ts` | the crabbing kit on the deck by the rail: a blue bucket with a white rim, a cooler with a red lid, a folded spare hoop net (7 boxes, the same one mesh) |

### Evidence

- **Tests** (`tests/opus-bay-w7-m-games.test.ts`, now 11 / 11): the rules and the sizes (59 waves: every rock crab ≥ ¼ in
  from the line, Dungeness 4.6–7 in); **policies over 40 seeds**: patient (haul when 3 eat, or at 11 s) + right calls →
  ★ in ≥ 12 of 40 (the simulation: 23 ★ / 17 ◆), never 再试试; hauling at 2 s or after the bait is gone → 40 × 再试试;
  every other call wrong → never ★; a stalled haul loses more than twice the crabs of a steady one; a whole game through
  `stepFrameSystems` → `medal:crab` up to its tier, the best kept; 放弃 → nothing paid, the lock gone; the prompt standable
  on the published city (Pier 7's deck); the chunks (crab 3.0 KB, panel 3.6 KB gzip, lazy, not in GameRoot).
- **Played in the game** (images read): desktop — the prompt 捞螃蟹 on Pier 7 with the kit by the rail and the Bay Bridge
  behind (scratch `crab-prompt.jpg`); the soak with three crabs at the bait (`b1-crab-soak-desk.jpg`);
  hauled at 3 eating (7.4 s) → 3 rock crabs (4.7, 3.4, 5.1 in), 0 escaped; the whole game → **★ Brilliant · 8 landed ·
  8 called right · 160 points · +30 coins** (`b1-crab-result-desk.jpg`). Phone 390 × 844 dpr 3: three crabs riding the
  net up (scratch `crab-phone-pull.jpg`), the gauge with the two big buttons (`b1-crab-gauge-phone.jpg`).
- **Calls / triangles** on Pier 7 (desktop high): 78 calls / 246k at the prompt; during the game 77 / 239k (the panel;
  nothing new in 3D); the kit is in the same props mesh as the Musée's (1 call where mounted).

### Decisions

1. **Pier 7, not the Aquatic Park Municipal Pier** the brief named: the Municipal Pier has been closed since 2022 and is
   not expected to reopen (https://sf.funcheap.com/city-guide/sfs-historic-pier-aquatic-park-closed/ ,
   https://www.yelp.com/biz/municipal-pier-san-francisco "CLOSED", checked 2026-09-29). Pier 7 is an open public fishing
   pier known for rock crabs, in the start view, and the game already has it walkable. The district's 甩一竿 fishing at
   its end stays; crabbing is at the rail 20 u back (a different gear and game).
2. **Kind by design**: the only choice is *what the rule says*, and at the end everything goes back (BAYBAY's bye line);
   the keep button says 留下 (for the photo / the measure), never cooking. No Dungeness is ever a keeper (the Bay rule),
   so a player learns the real San Francisco rule, not the ocean season.
3. **The skill is timing and a steady haul** (as real hoop-netters say: pull fast and steady) plus reading the gauge;
   the rules are printed under the two buttons, so a first game can still get them right.

### Facts (checked on the web 2026-09-29)

- "Dungeness crab (Metacarcinus magister) may not be taken from, or possessed if taken from, San Francisco and San Pablo
  bays at any time"; rock crab: "The daily bag limit is 35 crab, and the minimum size limit is 4 inches" —
  https://wildlife.ca.gov/Fishing/Ocean/Regulations/Fishing-Map/sf-bay
- Public piers: "No fishing license required"; at most "two … nets, traps or other appliances" —
  https://cdfwmarine.wordpress.com/2025/02/21/public-ocean-fishing-piers-know-before-you-go/ ; a hoop net raised and
  checked at least every 2 hours — https://wildlife.ca.gov/Fishing/Ocean/Regulations/Sport-Fishing/Invertebrate-Fishing-Regs/Crab
- Pier 7: an 840-ft public fishing pier, "an excellent area for rock crabs" — https://www.pierfishing.com/pier-7-san-francisco/

### Known gaps

- BAYBAY's bubble shows over her head in the world, which the panel can cover while it is open (the panel's hint line
  says the same rule, so nothing is lost).
- The crabs are drawn in the panel, not in the 3D water.

### Not done (this part)

- Sourdough (part c).

## Part c · W7-M3 shaping sourdough at the Wharf's bakery (22:12 → 22:45 PDT)

### What was built

| file | what |
|---|---|
| `play/dough.ts` (new, 2.5 KB gz) | `DoughGame` (pure, stepped by the game loop): **揉面** eight beats 0.72 s apart after a 1.6 s lead-in — a ring closes on the dough; a tap within 0.09 s is perfect (5), within 0.2 s good (3), later a miss; a tap far from any beat is ignored (no penalty for nerves); an untapped beat passes as a miss → **整形** a round boule, a crab or a turtle → **划口** the blade sweeps across the loaf (1.5 s a way); three taps, each scored by how near the nearest uncut dashed guide (0–10); after five sweeps the blade cuts by itself → **烤** the crust browns from raw to burnt over 9 s; 出炉 scores 30 in the middle of the golden band (0.55–0.72), falling off either side; burnt at the end if never taken out. 0–100 points, tiers **● 40 · ◆ 65 · ★ 85** → `medal:sourdough:1..3`; the card names the shape and the three part scores; BAYBAY: each step's line, pale / golden / dark at the oven, one of two sourdough facts after the card. Keys Space / Enter (the step's button), 1 2 3 (shapes), Esc |
| `play/DoughPanel.tsx` + `play/doughArt.ts` (new, 3.0 KB gz) | the floured table, the dough squashed on each press, the closing ring (green on the beat), a dot per beat (green perfect, gold good, grey miss); the three loaves drawn in code; the dashed guides and the lame; the brick oven with the loaf browning behind its glowing window, and a meter (the golden band and a mark: shape + word); one big button per step (56 px) — a tap anywhere on the picture counts too (one thumb) |
| `play/sfgames.ts` | `play:sourdough` 捏酸面包 on the pavement on the bakery's east side (−193.4, 66.4, r 1.6; the attractions row `boudin-bakery` is at −196.2, 65.4 — the game names no bakery), the overlay `play-dough`, the prefetch, the invite; **a game already played this visit is not offered again by BAYBAY** (her invite fired right after the sourdough card in the first phone run) |
| `play/sfgamesProps.ts` | the bakery table against the wall: four legs, a floured top, three loaves (a boule, a crab, a turtle), a cream sign board with a red stripe (13 boxes, the same one mesh) |
| all three panels | a mouse press never focuses a game button, so Space stays the game's key (a focused button used to swallow it) |
| `play/ClawPanel.tsx` | the collection row under the cabinet: the eight souvenirs, the ones won in colour, the rest faint (a reason to come back) |

### Evidence

- **Tests** (`tests/opus-bay-w7-m-games.test.ts`, 14 / 14): a precise baker (on the beat, on the guides, mid-golden) →
  40 + ≥ 27 + ≥ 29 → ★; a sloppy one (0.15 s late, cuts 0.06 off, a little dark) → ● or ◆, never ★; untouched it still
  ends (8 misses, the blade cuts by itself, the oven burns it) → 再试试; the parts add up; a far tap is ignored; **a whole
  game through `stepFrameSystems`** → `medal:sourdough:1..3`, the best ≥ 85; 放弃 → nothing paid; the prompt standable
  on the published city; the chunks — lane M's gzip sizes (B): zones 1488, claw 3324, claw panel 3500, fortune 2295, its
  panel 1409, crab 3028, crab panel 3599, props 1463, dough 2459, dough panel 3042 (each ≤ 5 KB, lazy, not in GameRoot).
- **Played in the game** (images read): desktop — 8 / 8 perfect kneads (40), the crab loaf with two cuts made and the
  blade over the third guide (`qa/w7/M/c1-dough-score-crab-desk.jpg`), the oven near the golden band
  (`c1-dough-oven-desk.jpg`), out at 0.635 → 97 points; phone 390 × 844 dpr 3 — the shape choice (three 64 px buttons),
  a turtle loaf → **★ Brilliant · knead 40 · score 27 · bake 27 · 94 points · +30 coins** (`c1-dough-result-phone.jpg`);
  the phone's contextual button reads Shape a sourdough at the table.
- **Calls / triangles**: the bakery table joins the props mesh (still 1 call where mounted; 40 boxes in all ≈ 480
  triangles).

### Decisions

1. **No bakery is named**: the game says 渔人码头 · 捏酸面包 / Wharf bakery; the sculpted-animal loaves and the 1849 fact are
   told as San Francisco's, not a company's.
2. **Rhythm on the game clock, not the audio clock**: the kit's RhythmJudge reads AudioContext time; the knead is judged on
   the game's own stepped time with generous windows (90 / 200 ms), so it works with the sound off and on a slow phone.
3. **A tap on the picture = the button**: phones can play the whole game with one thumb anywhere on the canvas.

### Facts (checked on the web 2026-09-29)

- Sourdough was a staple of the Gold Rush of 1849 and of San Francisco since —
  https://en.wikipedia.org/wiki/History_of_bread_in_California
- The starter's bacterium was named after the city (Lactobacillus sanfranciscensis, now Fructilactobacillus
  sanfranciscensis) — https://en.wikipedia.org/wiki/Fructilactobacillus_sanfranciscensis
- The Wharf's bakers sculpt loaves into crabs, turtles, teddy bears and alligators —
  https://kirbiecravings.com/sculpted-bread-animals-at-boudin-in-sf/

### Known gaps

- The knead's beat has no music of its own (a soft pat on each press only).
- A loaf is not kept after the card (no inventory item: `economy/items.ts` is lane G's this wave).

### Not done (lane)

- The cable-car grip game on a Powell ride, a foghorn call-and-answer, a Chinatown lantern game (the brief's other
  candidates): the grip game needs lane B's ride stages (a pad on the ride banner like the bell riff) — a good item for a
  next wave; the foghorn one would repeat the bell riff's call-and-answer and the foghorn duet egg; lanterns would mix
  with the Halloween hunt's 40 lanterns this month.

### Requests

- **Lane X** (voice): all BAYBAY lines of the three games are fixed text in `src/opus-bay/play/sfgamesLines.ts`
  (`CLAW_LINES` 11, `CRAB_LINES` 13, `DOUGH_LINES` 10). The fortune cards are text on a card (not BAYBAY's lines).
- **Lane R** (information): the `musee-mecanique` and `boudin-bakery` cards could mention the games there
  (抓娃娃机 / 捏酸面包); the Pier 7 POI's tip already says people crab there.
- **W7-I / W7-Z**: the three places — the Musée (−202.8, 71.8 and −199.4, 70.8), the bakery (−193.4, 66.4), Pier 7
  (73.6, −24.3); the props add 1 call within 90 u of them.

## Part d · W7-M4 the panel beside the player on wide screens; the checks (23:40 → 00:15 PDT)

- **Pushed** at 23:40: `83bfa1d3`… rebased as W7-M1 / M2 / M3 up to `d963a982` on `origin/opus-bay` (BAYBAY's 34 lines
  were on origin 10 minutes after the 23:30 mark: the full suite ran first).
- **W7-M4** (`play/sfgames.css`): on a screen ≥ 1000 px wide the games' panel stands at the right (under the pill), not
  in the middle, so the player and BAYBAY stay in view — her rule lines and claps over her head were hidden behind the
  centred panel. Phones keep the panel under the top pills. Shot: `qa/w7/M/d1-crab-panel-side-desk.jpg` (the gauge at
  the right, BAYBAY's 量一量：够大的留下，太小的放回去！ over her head on the pier).
- **A rebase conflict** in `economy/records.ts` (lane W2 appended `kite` and `skyline` at the same place): both kept, W2's
  rows first, then lane M's (append-only).
- **Checks** before the push (rebased tree): `tsc` 0 · `eslint .` 0 errors (43 old warnings) · the full suite **1580:
  1577 pass, 3 fail** — `sf-citymap` "whole-city redraw … fast" and `sf-move2` "E2-5 view field" (wall-clock) pass alone
  (8 / 8, 24 / 24); **`W5-bus 20+ simulated minutes` fails alone and on pristine `origin/opus-bay` too** (`90dc7798`, a
  detached check worktree, removed after: "bus at an interlock stood 29.2 s (box:f-line@5661:750) at (149, 601)", bar
  25 s) — not lane M's (no transit file touched; the test imports none of `play/`); lane H's report (`W7-H7`) found the
  same. After the last two rebases (lanes H, R, lead notes only): `tsc` 0, `eslint .` 0 errors, the play / notebook /
  wave-6 W / wave-7 tests 171 / 171; the full suite on the pushed tree `d963a982`: **1597, 1596 pass**, the one failure
  the same `W5-bus` interlock wait (pre-existing, above).
- **W7-M5**: a test for BAYBAY's invite once per game (`W7-M zones: …`): the crab invite at the rail; after a sourdough
  game (given up) no invite at the bakery — red with the played-set check turned off ("no sourdough invite after playing
  it"), green with it. Lane M's tests now 14 / 14.

## Final checks (00:22 PDT, the pushed tree `68b2fcda`)

`npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (43 old warnings) · `npx tsx --tsconfig
tsconfig.app.json --test tests/opus-bay-*.test.ts` **1616: 1615 pass, 1 fail** — the `W5-bus 20+ simulated minutes`
interlock wait (29.2 s at `box:f-line@5661:750`, bar 25 s), red on pristine `origin/opus-bay` too (checked in a detached
worktree at `90dc7798`; lane H's W7-H7 saw it): a request to lane B / the lead. Lane M's own tests 14 / 14. Higgsfield:
0 credits (none spent by this lane). The dev server on 5712 is stopped; no Chrome left running.

## Review (W7-M-review, the adversarial review · 2026-09-30 00:23 → 01:40 PDT)

### 给主人的摘要

1. 三个小游戏和算命机我都重新玩了一遍（手机 390 × 844 单指、电脑 1440 × 900 键盘）：抓娃娃、7 号码头捞螃蟹、捏酸面包都能玩完、拿奖牌、出结果卡；地区模式（district）没有变化。
2. **修了两个真问题**：
   - **算命婆婆在开发版里点了没反应**：卡片刚出现就被关掉（React 开发模式会把面板"装上—拆下—再装上"一次，原来一拆下就结束了）。正式网站原本不受影响，但开发版测试（W7-I / W7-Z 会在博物馆门口试玩）会以为它坏了。现在开发版和正式版都正常。
   - **捏酸面包出炉后的 1.4 秒里碰一下摇杆，整局就作废**（没奖牌、没金币、没记录）。现在面包出炉以后碰摇杆也会照常出结果卡、发奖牌；游戏进行中推摇杆仍然是"放弃"。
   - 顺手：捞螃蟹每一帧少建几个临时数组（小的性能优化）。
3. 现实资料我又上网核对了一遍（2026-09-30）：机械博物馆 300 多台机器、免费入场、最老一台 1884 年、2002 年搬到 45 号码头；Playland 1972 年关门；旧金山湾的珍宝蟹一律不能带走，石蟹每天 35 只、至少 4 英寸；7 号码头 840 英尺、公共码头钓鱼不用执照；金门大桥雾笛（南塔一声、桥中间两声）——**全部正确**。
4. **没有阻止上线的问题。**

### What was checked

- **Every lane M commit read**: `44f9514e` (M1: the games, zones, props, lines, records, tests), `3f69b496` (M2 report + shots),
  `d963a982` (M3 collection row), `0978a465` (M4 the panel at the right ≥ 1000 px), `68b2fcda` (M5 the invite test),
  `6412035a` (M6 checks). No other lane touched lane M's files after it (origin `071b2666`).
- **Played in the game** (dev 5732, `?world=city`, one headless Chrome; every image read; scratch
  `C:/Users/willy/opus-qa/w7/m-rev/`):
  - desktop 1440 × 900 — the 抓娃娃 prompt at the Musée with BAYBAY's invite, the cabinet and the booth props on the Pier 45
    wall; the claw panel at the right, → moves the claw, Space drops, a grab off-centre slipped (哎呀，滑掉了！); the
    sourdough game played through (knead 40 · score 27 · bake 30 = 97, ★ **+30 coins**), W held right after 出炉！ → the card
    still came (`qa/w7/M/rev-dough-card-after-stick-desk.jpg`).
  - phone 390 × 844 dpr 3 touch — crabbing on Pier 7 (drop, the crabs at the bait, hold 拉！, the gauge: a 3.4″ rock crab,
    `qa/w7/M/rev-crab-gauge-phone.jpg`); the claw by a drag in the glass (the claw went there and dropped); the fortune
    card after the fix (`qa/w7/M/rev-fortune-strict-fixed-phone.jpg`), 好的 closes it and the activity ends.
  - touch targets measured: ✕ 44 × 44, claw ◀ ▶ 64 × 56, 抓！ 170 × 56, crab 放回去 / 留下 167 × 64, fortune 好的 314 × 48.
  - **district** `?world=district`: loads (the Ferry Building, 73 calls), `__opusBay.sfgames` absent — `play/` is started
    by `game/w5Features.ts` in city mode only; nothing of lane M loads there.
- **Calls / triangles** at the spots (dev, the pose the teleport gave): the claw prompt 104 / 327k (desktop), the bakery
  88 / 213k (desktop), Pier 7 58 / 212k (phone) — under W6-Z's desktop maximum 122 / 365k; the props are one instanced
  mesh (+1 call within 90 u, lane M measured on / off).
- **Assets / iPhone memory**: nothing generated (0 Higgsfield credits), no texture files; the panels are 2D canvases drawn
  in code, their backing store ≤ 1032 × 825 px (the claw at dpr 3, ≈ 3.4 MB) and only while a panel is open.
- **Teardown / leaks**: keys, frame systems, rAF loops and overlays go on end and on cancel; the props layer disposes its
  own geometry (the toy material is shared, not disposed); a world switch cancels the running activity
  (`play/index.ts`). Per-frame work: the crab getters allocated (fixed below); the canvases' per-frame gradients and
  the claw pile's `forEach` are negligible.
- **Save**: new `play.b` keys `claw`, `claw-set`, `crab`, `sourdough`, `fortune-n` (bests and counters through lane E's
  ledger; append-only `PRIZE_KINDS` bits). **Text**: zh / en everywhere; 繁體 is derived by OpenCC (`translateText`);
  the canvases draw only digits and ✓.
- **Facts re-checked on the web 2026-09-30**: https://en.wikipedia.org/wiki/Mus%C3%A9e_M%C3%A9canique ("over 300
  mechanical machines", "The oldest is a Praxinoscope, built in 1884", free admission, the move in 2002, Playland
  1928–1972); https://wildlife.ca.gov/Fishing/Ocean/Regulations/Fishing-Map/sf-bay (Dungeness "may not be taken from, or
  possessed if taken from, San Francisco and San Pablo bays at any time"; rock crab 35 a day, 4 inches);
  https://www.pierfishing.com/pier-7-san-francisco/ (840 feet, public pier, no licence, a Dungeness is illegal in the
  bay); https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/ (south tower: a single
  tone and blast; mid-span: two blasts). All as the game says.

### Defects fixed (red, then green)

1. **The fortune teller showed nothing in the dev build** (`play/fortune.ts`, `play/FortunePanel.tsx`). The panel's
   unmount ended the fortune's activity; React StrictMode (dev, `src/main.tsx`) mounts, unmounts and remounts a new
   component, so the run ended 28 ms after it started (`fortune:start@22561`, `fortune:end@22589`) and the card closed
   before it showed — every time the chunk was already fetched (the zones prefetch it at the door). Production was
   not affected, but the dev QA of W7-I / W7-Z would have reported 算一卦 dead. Now the unmount ends it a tick later and
   a remount calls that off (`fortunePanelGone` / `fortunePanelUp`). Test `tests/opus-bay-w7-m-review-dom.test.ts`
   (jsdom, the panel under `React.StrictMode`): red "the fortune still runs after the StrictMode remount", green; a
   real unmount still ends it. In the game: before — no panel, activity null after 300 ms; after — the card up
   (`rev-fortune-strict-fixed-phone.jpg`), 好的 → activity null, panel gone.
2. **Sourdough: a push of the stick after 出炉！ lost the whole game** (`play/dough.ts`). The card comes 1.4 s after the
   loaf is out (`FINISH_MS`), but the kit's `cancelOnMove` kept watching: a thumb back on the stick in that beat
   cancelled the run — no medal, no coins, no best, no card. The game now does the kit's stick check itself (same
   `MOVE_CANCEL` and `CANCEL_GRACE`) and skips it once the loaf is out. Test `W7-M-review sourdough: …` in
   `tests/opus-bay-w7-m-games.test.ts`: red "medal 1 paid after the stick", green; mid-game the stick still gives up
   with nothing paid. In the game: W held right after 出炉！ → ★ card, +30 coins (`rev-dough-card-after-stick-desk.jpg`).
3. **Crabbing: per-frame arrays** (`play/crab.ts`): `onNet` / `eating` were `filter(…).length`, read 3–4 times a frame by
   the run's frame system; now a counting loop (behaviour unchanged, lane M's crab tests green).

### Open items (not blocking)

- **`play.b` is near its 32-key cap** (`data/playSave.ts MAX_BESTS`): with lane M about 28 keys can now be written
  (steps ×3, slides, stairs ×3, hide-seek, bell, kite, skyline, claw, claw-set, crab, sourdough, fortune-n, beachball,
  frisbee, heave, heave-tt, sealions, sled, marshmallow, first-flight, ggb-rings, crooked ×2, crests). A later wave that
  adds ~5 more would have the ledger refuse the 33rd key (only a DEV warning): a best or the claw's collection silently
  not saved. Lane E / the lead: raise the cap or fold counters before wave 8 adds games.
- BAYBAY's own 和 BAYBAY 聊聊 prompt stays on during any activity (she walks up beside the player); a tap on it during a
  game opens her dialogue over the panel. The same for every PlayKit activity since wave 5 — not lane M's; lane A / G.
- The 手帐's row for the claw reads 最高 5 分 (souvenirs counted as points): `economy/records.ts` has only seconds /
  points (lane M's recorded decision).
- The `W5-bus 20+ simulated minutes` interlock wait (pre-existing on origin; lane B).

### Blocking the go-live to main

None.
