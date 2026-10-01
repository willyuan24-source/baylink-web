# Wave 8 · lane X · looks, sound, voice (+ Higgsfield)

Worktree `C:/Users/willy/wt/w8-x` (branch `w8-x`), dev port 5810, scratch `C:/Users/willy/opus-qa/w8/x/`, ledger
`docs/opus-bay/ledger/w8-X.md`, QA files `docs/opus-bay/qa/w8/X/`. The main Higgsfield spender of wave 8 (cap 240, the
shared balance never under 20). Run inside the Ultra workflow `wf_66c65596-f6a` (lead note §7): this agent resumed the
lane's first agent (19:00–19:20 PDT, nothing committed).

## 给主人的摘要

1. **配音全部补齐**：BAYBAY 第七、八波所有固定台词都配上了 Pixie 的声音 —— 抓娃娃 / 捞螃蟹 / 捏酸面包、三个新小游戏（叮当车拉闸、街头艺人合奏、雾笛对答）、坐车出行的提示、万圣节新句、海洋海滩冲浪和海豹岩、蓝鹭湖、舰船巡游、坐渡轮去恶魔岛（语气轻柔、尊重）、唐人街宝塔和自由轮，共约 130 句、260 条中英文录音。第七波静音的 8 条里 7 条重录后恢复发声。
2. 只有 2 条暂时静音（气泡照常显示）：模仿钟声的"当——当——当！"（机器把三下钟声当成"说得太慢"）和第七波的 "Ho! Spot on!"（识别器听不出来）。试听单：`docs/opus-bay/qa/w8/X/voice/listening.md`，最后一栏写 ✗ 或 重录；每批连播在同目录 `w8-voice-preview-b*-zh/en.m4a`。
3. **车辆更精致**：F 线电车车头换成环绕式玻璃窗、黄铜圈车灯、保险杠、圆车顶和车轮，夜里车头玻璃和车厢里亮暖光；叮当车车头加了金线装饰板、黄铜灯圈和弧形车顶；观光巴士前脸有了窗框、格栅和圆车灯，并修好一侧车轮"浮在车身外"的问题。没有增加绘制调用。
4. **夜景和小修**：金门大桥两座塔夜里亮起暖光（1987 年起真实如此），越往上越暗；奖励时"星光 + 金币"不再连放两次；天空云朵边缘可能出现的一像素细线修掉；渡轮尾浪更明显。
5. Higgsfield 本线只花了 5.44 分（全部是配音，失败的任务都退款了）。没有找到 AI 贴图或 3D 模型明显胜过现有画面的地方，所以没有花在图片和模型上（规则：并排对比赢了才用）。

## Part a · BAYBAY's voice, batch 1 (2026-09-30 19:24–19:45 PDT)

### Resumed work

The first agent left, uncommitted: the preflight of `ledger/w8-X.md`, `scripts/opus-sf/voice/w8/lines.ts` (the
inventory: wave 7's inventory + lane K's plain bubbles + the retakes of wave 7's muted clips) and
`scripts/opus-sf/voice/w8/post.py` (wave 7's chain with wave-8 paths and the retake rule), and 120 TTS takes already
submitted. All of it was kept: the inventory still lists exactly the 52 lines the takes were made for after rebasing onto
`origin/opus-bay` (lane K's `W8-K1` changed no line), 119 / 120 results were already fetched to `raw/`, the last one
(take 114) had failed twice (`jobs_wait`: failed) — its sibling take at rate 1.3 covers that clip. Nothing was paid
twice. Nothing of the first agent's was discarded.

### What was built (W8-X1)

| file | change |
|---|---|
| `scripts/opus-sf/voice/w8/lines.ts` (new) | the inventory over waves 5–7's inventories (`w7Lines`) + `W8_SOURCES` (lane K's plain `bubble()` literals in `game/tripRun.ts`, `transit.ts`, `flow.ts`, `lineRides.ts`, `cityTour.ts`, picked by exact zh; wave 8's new tables are added here as the lanes push them) minus every text a voice table has; `EXCLUDE_SOURCES_W8` (the fortune teller's printed card, `play/fortune.ts`: paper, not a bubble); `RETAKES_W8` (the 8 clips of `W7_VOICE_CHECK`, two faster takes each) |
| `scripts/opus-sf/voice/w8/post.py` (new) | W5-V7's chain unchanged (trim, fades, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k + Opus 48k mono, wave 4's sentence gates, the Windows closed-grammar recogniser as an advisory check); a retake of a muted wave-7 clip is kept only if it passes every gate **and** is heard right; writes `voiceW8.ts`, the report, the previews and the listening sheet |
| `src/opus-bay/data/sf/voiceW8.ts` (generated) | `W8_VOICE_LINES` (52), `W8_VOICE_CHECK` (5 muted clips), `W8_VOICE_CLIPS` (104), `W8_RETAKE_CLIPS` (7, under their wave-7 ids) |
| `src/opus-bay/game/voiceW5.ts` (the binder) | imports wave 8's table first; matches `W8_VOICE_LINES` by exact zh + en after the earlier tables (an earlier recording of the same words still wins; `own` texts excluded); new `w5VoiceMuted(clip)`: every wave's CHECK list, except a wave-7 clip whose wave-8 retake was kept |
| `public/opus-bay/w8/voice/` (new) | 111 clips × m4a + ogg (104 new + 7 retakes), 5.9 MB, lazy (a clip loads when BAYBAY first says it) |
| `docs/opus-bay/qa/w8/X/voice/` (new) | `listening.md` (the owner's sheet), `w8-voice-report.json` (every take, gates, picks, files with sha256), `w8-voice-preview-b1-{zh,en}.m4a` |
| `tests/opus-bay-w8-x-voice.test.ts` (new) | 2 tests: every wave-8 line has both files on disk, is said verbatim somewhere in `src/opus-bay` (no dead clip), has no id or text of an earlier table, and BAYBAY's bubble with its exact text finds it; every claw / crab / sourdough line of `sfgamesLines.ts` is voiced; the muted clips stay text only; a kept retake plays from `/w8/voice/` under the wave-7 id and is unmuted, the rejected one stays muted with no file registered; the binder's import order |

### Evidence

- Batch 1: 104 clips, **99 pass the gates**, **95 heard right** by the recogniser (advisory). Muted until the owner
  approves them (rate gate: short calls read slowly; one take with clipped samples): `zh-w5-a-eb85ad0b` 金黄酥脆！完美！
  (3.33 s), `zh-w5-k-83579ca0` 当——当——当！ (2.16 s — a bell imitation, slow by nature), `zh-w5-k-eabf6332` /
  `en-w5-k-eabf6332` 嗯～好吃！ / Mmm, tasty!, `zh-w5-k-2a49803a` 这段路有点难走，你来带路吧！ (clipped).
- Retakes: 7 / 8 replace their muted wave-7 clip (e.g. 哎哟，碰到啦～ 2.27 → 2.00 s heard 0.99; Not quite! heard 0.78); "Ho!
  Spot on!" (en) was not heard in either take: wave 7's clip stays muted.
- Checks of this commit: `tsc` 0 · `eslint .` 0 errors · the voice tests (w8-x-voice, w7-x-voice, w6-x, asset-files,
  w4-assets, w8-k1-hold) 33 / 33 · the opus-bay suite before the push (numbers in the commit message).
- Higgsfield: **1.92** credits (ledger `docs/opus-bay/ledger/w8-X.md`, one row per job).

### Decisions

- Lane M's wave-7 lines keep wave 5's id scheme (`w5-a-<hash>`: the play/ scan's lane letter), like waves 6–7.
- The 5 muted clips are left to the owner's ear or to the next batch's faster retakes (batch 2 retakes them at 1.15 / 1.3).
- The bell call 当——当——当！ is a fair case for the owner to approve as is (the gate measures speech, not a bell).

### Batch 2 (W8-X3, 20:25–20:40 PDT)

Lane K pushed `W8-K3` at 19:09 (its templated city bubbles became fixed lines: `game/fixedLines.ts W8K_LINES` and
`SKYLINE_LINES.noViewPin`); `lines.ts` reads `W8K_LINES` (`W8_SOURCES`), and gained `--redo` (wave 8's own muted clips:
two faster takes each, `takes.json redo`, the new pick replaces the clip) and `--retakes <clips>` (a subset of
`RETAKES_W8`). 28 takes: 8 new lines × zh / en, 10 redo takes of batch 1's 5 muted clips, 2 more takes of "Ho! Spot
on!". Result: the table holds **60 lines / 120 clips, 118 pass the gates, 111 heard right**; muted now
`zh-w5-k-83579ca0` 当——当——当！ (three bell strokes in 1.40 s still read as "slow speech" by the rate gate: the owner's
ear) and `zh-w5-k-7755a76a` 跟我来！我带你过去～ (a 0.99 s pause; redone in batch 3). 金黄酥脆！完美！, 这段路有点难走，你来带路吧！
and 嗯～好吃！ / Mmm, tasty! now pass and play. "Ho! Spot on!" passes every gate in both new takes but the recogniser
hears nothing in either: by the retake rule wave 7's clip stays muted (approve it on the sheet if it sounds right).
Credits **0.34** (ledger). Preview files `w8-voice-preview-b2-{zh,en}.m4a`.

### Batch 3 (W8-X5, 21:25–22:15 PDT)

The lanes' wave-8 tables on origin at 21:10: lane M's three games (`play/sfgames8Lines.ts`, found by the play/ scan: the
grip 20, the busker 11, the foghorn 10), lane H's `W8_HALLOWEEN_LINES` + `W8_WORLD_LINES` (their own ids, as wave 7; the
procession line read gently), lane W2's `westLines.ts` (5), lane S's four Parade of Ships lines (`own`: realsf emits
`voice-line realsf-parade-<key>`, so the binder never matches their text). `lines.ts` gained `ids` / `mood` per source;
`post.py` gained `--prune` (a recorded line the game no longer says verbatim loses its row and files — a lane may reword a
line after it was recorded); the voice test now reports such a line as a diagnostic instead of failing the other lanes.
110 takes (47 failed jobs and 7 rate-limit answers resubmitted until all were in). The table: **113 lines / 226 clips,
221 pass, 214 heard right**; muted (`W8_VOICE_CHECK`, the owner's ear): 当——当——当！, 松得正好！滑过去～, 松闸、刹车，停得稳稳的！,
We’re off: grip! (rate gate) and Nice driving! Let’s do another run! (clipped samples). 跟我来！我带你过去～ passes now.
Credits **2.08** (ledger).

### Batch 4 (W8-X6, 22:20–23:00 PDT)

Lane A's seven Alcatraz lines (`world/sf/alcatrazLines.ts ALCA_LINES`: read soft, gentle and respectful — a former federal
prison, the 1969–71 occupation by Indians of All Tribes), lane W1's three sight lines (`W8_W1_LINES`), lane W2's Blue
Heron Lake lines, lane M's reworded busker / foghorn lines, + redo takes of batch 3's muted clips: 46 takes. `--prune`
dropped the two lines lane M reworded after batch 3. The table: **129 lines / 258 clips, 256 pass, 247 heard right**;
muted: 当——当——当！ (the bell, every take under the rate gate: the owner's ear) and the Alcatraz stair line in zh (clipped
samples). Credits **0.99** (ledger).

### Batch 5 (W8-X7, 23:00–23:35 PDT)

Lane K's last three fixed lines (`W8K_LINES.tripFly / tripBike / tripCar`) and the Alcatraz stair line again (gently): all
pass. **Final table: 132 lines / 264 clips, 263 pass the gates, 253 heard right; one clip muted** — the bell
当——当——当！ (`W8_VOICE_CHECK`), plus wave 7's "Ho! Spot on!" still muted by the retake rule. Credits 0.11.

## Part b · looks: the vehicles up close, one burst per reward, the floodlit Golden Gate (2026-09-30 19:50–21:20 PDT)

### What was built (W8-X2)

| file | change |
|---|---|
| `src/opus-bay/world/streetcar.ts` | `carGeometry(livery, pole = true)` is the **city** F-line car (the district's car, `pole` false, is byte-identical — checksum pinned in the test): `cityCab()` at both ends — five glass panes round the rounded cab between sill and header (one dark slab poked out of the curve before), glass style 7 (warm at night); a round headlamp in a brass rim; a low bumper; two amber marker lamps; a rounded roof cap over the cab. Bogie wheels, roof rain strips, a gold header line. The saloon's inner faces, bulkheads and ceiling glow warm at night (a lit car through its open windows). 1,068 → 1,888 triangles for the near car only (mid / far looks unchanged), the same footprint, platform and pole |
| `src/opus-bay/world/cablecar.ts` (city only: the lazy transit layer) | the dash lamp's brass rim and a gold-lined blank panel either side under the dash's gold line (no number, no lettering); the roof's gentle arch (a flat half-round along the car under the clerestory, vaulting the open ends' ceilings). 2,124 → 2,492 triangles; size, name, platform unchanged |
| `src/opus-bay/world/sf/tourBus.ts` | **bug**: the tyres were not mirrored — the cylinder grows toward −x from its origin, so the left tyres sat inset with their hub plates floating outside them; now both sides stand out alike with the plate on the outer face. The windscreen's cream pillars, two chrome grille bars, round head lamps. 1,176 triangles (≤ 1,200, the W4 budget test), footprint `BUS.width` + 0.28 (≤ + 0.3) |
| `src/opus-bay/world/fx.ts` | **one burst per reward moment** (the W7-V review's "double coin pop"): a paid-coins pop now starts `POP_DELAY` 0.2 s late and dies when a sparkle or confetti bursts within `POP_NEAR` 4 u of the player in that beat; no pop within `POP_MERGE` 0.6 s after such a burst — a postcard, a stamp, an egg, a crest or the hunt bursts once; paid coins on their own still pop. A per-particle tag copied in the compaction (no allocation). The ferry's wake foam denser by day (alpha 0.5 → 0.75; 0.55 at night) and a little longer (W7-V: "faint on bright water") |
| `src/opus-bay/world/sf/lights.ts` | `ggbLights()`: warm far dots up both faces of every Golden Gate tower leg every 2.5 u, dimmer toward the top — the towers have been lit at night since 22 June 1987, and Irving Morrow's plan gave the tops less light so they seem to soar (`GGB_TOWER_LIGHT_SOURCE`: https://www.goldengate.org/bridge/history-research/moments-events/golden-gate-bridge-anniversaries/ and https://radianthistory.com/lighting-the-golden-gate-bridge-scale-and-dignity/, checked 2026-09-30). +128 points in the light field's one Points draw (they fade within ≈ 60–150 u of the camera like the rest) |
| `tests/opus-bay-w8-x-looks.test.ts` (new) | 4 tests: the F-line (district checksum, warm faces, footprint, budget), the cable car and the bus (sizes, budgets, both sides' wheels), the coin pop (either order one burst; alone it pops), the tower lights. **Red on the old code** (3 of 4: the bus wheels, the coin pop, the tower lights), green now |

No new draw call, material or program: the vehicles are geometry inside their existing instanced / batched meshes, the fx
and the light field keep their one draw each.

### Evidence (Part b)

Shots read before described; desktop 1440 × 900 quality high, phone 390 × 844 dpr 3 (quality mid); "before" = this lane's
five files at `592136b6` swapped into the same tree (the scratch script `C:/Users/willy/opus-qa/w8/x/batch-ba.sh`), the
camera following the nearest vehicle of the kind from the same offset (`…/x/vcam.js`):

- `qa/w8/X/x2-fline-before-after.jpg` (desktop, Ferry plaza): the cab's dark slab → five panes round the curve, the
  brass-rimmed headlamp, the bumper, the rounded roof cap, wheels under the bogies. Phone: `x2-fline-phone-before-after.jpg`.
- `qa/w8/X/x2-fline-night.jpg` / `x2-fline-night-phone.jpg`: the cab glass glows warm at night, the headlamp and marker
  lamps lit. (The phone "before" at night came up as the page's error card: the dev server re-optimising after the file
  swap — a reload artefact of the swap, not the game; the "after" loads clean.)
- `qa/w8/X/x2-cable-before-after.jpg` (Powell & Market): the gold-lined panels on the dash and the lamp's brass rim.
- `qa/w8/X/x2-bus-before-after.jpg`: the windscreen pillars, grille bars, round lamps; the near side's tyres now stand
  out like the far side's.
- `qa/w8/X/x2-ggb-night-before-after.jpg` (from Crissy Field at night): the towers now carry warm light up their legs,
  fainter toward the tops.
- `qa/w8/X/x2-wake-before-after.jpg` (riding the Ferry Building ⇄ Pier 41 boat, camera above the stern): the foam trail
  is a little denser and longer; a subtle change by design (the water shader's own wake lines stay).
- Calls / triangles: no new draw call (the vehicles are geometry in their existing meshes; the fx pool and the light field
  keep one draw each). The F-line's near car +820 triangles (×2 with its shadow, within 45 u), the cable car +368, the bus
  +116; at the Ferry plaza with a near F-line car the frame read 82–84 calls / 245–252k triangles before and after (the
  moving cars make single readings noisy). Phone (mid) at the Ferry plaza: 63–67 calls / 208–216k.
- The double coin pop and the sky-puff edge are not visible in a still: their evidence is the tests (red on the old code).

### Decisions (Part b)

- City only, district untouched: the F-line's new pieces sit behind `carGeometry`'s `pole` flag (the city's instanced
  cars); the district's car is byte-identical (a pinned checksum). The cable car and the tour bus are city-only meshes
  (the lazy transit layer). The light field and the sky blocks are city-only.
- No numbers, lettering or real liveries on any vehicle (the dash panels are blank gold frames).
- The toy traffic cars were left as they are: they sit at their 300-triangle budget (`sf-life` test) with up to 40 on
  screen, and their rounded soft-box bodies already read well up close.
- The Golden Gate's tower light is far dots (the light field fades within ≈ 60–150 u): close up the towers stay as they
  were at night (a lit tower material would be the landmark's file, not this lane's).

## Part c · Higgsfield (2026-09-30)

Every credit went to the voice: 5 batches of `qwen_audio_tts` (≈ 5.4 credits in all; the ledger has one row per job and
the reconciliation). No image, texture or GLB was generated: the candidates were weighed against what is there —
the vehicles and the night lights are geometry and shader work inside existing draws (a texture would add a material /
program per kind and not beat a resolution-free pattern at every distance, as wave 7 found for the façades); a GLB swap
(the Palace of Fine Arts' open peristyle, the scorecard's best candidate outside W1 / W2 / A) needs a concept, image-to-3D,
a decimation pass and the wave-4 gate's SoloView + city shots — more than the hours left after the voice batches, and
image-to-3D tends to fill open colonnades. Standalone sound effects are not offered by the tool (speech only). So: no
generated look asset shipped, by the rule "only when a side-by-side shot beats what is there".

## Not done

- A Higgsfield look asset (see Part c).
- Salesforce Tower's bands (city-only): the tower is built by `world/landmarks.ts` (the district's landmarks, shared with
  the city build) with window style 6; a city-only look needs a city-only window style on the hero batch — the lead's
  call (Requests).
- Night street-lamp pools: the pools and their material are `world/sf/props.ts` / `world/materials.ts POOL` (lane K's /
  shared with the district); the night Market St shot shows the lamp heads and halos but faint pools — Requests.
- The bell 当——当——当！: no take passes the speech-rate gate (three bell strokes in ≈ 1.3–1.9 s); muted for the owner's ear.
- "Ho! Spot on!" (wave 7's muted en clip): the new takes pass every gate but the recogniser hears nothing; muted.
- A before shot of the F-line at night on desktop (the phone pair stands in), and a phone "after" of the Golden Gate at
  night (that shot did not save).

## Requests

1. **Owner**: `docs/opus-bay/qa/w8/X/voice/listening.md` — the 3 muted clips can be approved there (the bell, "Ho! Spot
   on!", and the Alcatraz stair line if batch 5's take is still muted); mark ✗ / 重录 on any clip that sounds off.
2. **Lead (a later wave)**: Salesforce Tower's shaft reads dark-banded (style 6 glass) where the real one is pale
   silver-blue with fine white lines (W7-R's scorecard #32): a city-only window style for the tower's faces in
   `world/landmarks.ts salesforce()` (when the world is the city) — frozen-adjacent, so the lead's OK.
3. **Lane K / lead**: the city lamp pools (`world/sf/props.ts` + `materials.ts POOL`) read faint at street level at night
   (Market St at Powell); a stronger city-only pool would warm the night streets.
4. **Lead (hand-off)**: merge `ledger/w8-X.md` into ASSETS-LEDGER (wave 8, lane X: 5 TTS batches; ≈ 0.73 credits of
   other TTS on the shared account at 02:29–02:35 and 05:44 UTC are not this lane's).

## Final (2026-09-30 23:40 PDT)

- Commits on `origin/opus-bay`: W8-X1 (voice batch 1 + binder) · W8-X2 (vehicles, one burst per reward, the floodlit
  Golden Gate, the wake) · W8-X3 (voice batch 2) · W8-X4 (the sky puffs' edge) · W8-X5 (voice batch 3 + Part b shots) ·
  W8-X6 (voice batch 4) · W8-X7 (voice batch 5 + this report's end).
- Checks: every push ran `tsc` 0 and `eslint .` 0 errors (50 old warnings) and the opus-bay suite — 1668 / 1668 (X1),
  1678 / 1680 (X2 / X3: two wall-clock budgets red under load, red alone too, modules this lane does not touch),
  1779 / 1779 (X4 / X5), 1795 / 1796 (X6: the `sf-terrain` 200k-query wall-clock budget, green alone). X6 was pushed
  straight after a clean rebase onto lane P's import-retry commits; `tsc` and their tests (sf-hud, w5-play-acts,
  w7-p-retry, w8-p-retry, w8-q-phone) + this lane's ran green right after (115 / 115). W8-X7: below / in its commit.
- Higgsfield: **5.44** credits (cap 240), all TTS; ledger `docs/opus-bay/ledger/w8-X.md` reconciled with `transactions`.
- Dev server 5810 stopped; no Chrome of this lane running. Scratch `C:/Users/willy/opus-qa/w8/x/` (shoot.mjs, vcam.js,
  batch-ba.sh, voice/ … voice5/).
