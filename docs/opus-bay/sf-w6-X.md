# Wave 6 · lane X · Visuals, models, animation, sound (+ Higgsfield)

Worktree `C:/Users/willy/wt/w6-x` (branch `w6-x`), dev port 5609, scratch `C:/Users/willy/opus-qa/w6/x/`, ledger
`docs/opus-bay/ledger/w6-X.md`, QA files `docs/opus-bay/qa/w6/X/`. The only Higgsfield spender of wave 6 (cap 1000,
floor 1375).

## 给主人的摘要

1. 万圣节明信片画好了 4 张（找齐南瓜灯、不给糖就捣蛋、10/31 大夜晚、教会区亡灵节），和以前的明信片同一种手工黏土小模型画风；已交给做万圣节的两条线（H、G）去放进游戏。
2. 万圣节音效做好了：敲门三下 → 门吱呀打开 → 糖果哗啦倒进桶里 → 叮！；找到南瓜灯时一声可爱的“呜～”加一串铃声；换上万圣节服装“噗”的一声魔法亮晶晶；10/31 晚上远处钟楼敲一下。全部是程序合成，不占下载，只有万圣节活动开始后才加载。
3. 城市里的路人变可爱了：以前是没有脸、肤色发色都一样的小人，现在有眼睛（带高光）、腮红、短袖子和小手，每个人的肤色和发色都不一样，和 BAYBAY、主角同一种圆滚滚的玩具风格（只改城市模式，街区模式不变）。
4. BAYBAY 会说万圣节的新台词了：讨糖（G 线）22 句 + 城市装扮/找南瓜灯/亡灵节（H 线）18 句，中英文共 80 条录音，还是 Pixie 的声音，气泡出现就自动播放。试听单在 `docs/opus-bay/qa/w6/X/voice/listening.md`（连播文件 `w6-voice-preview-b1-zh.m4a` / `-en.m4a`）。
5. 万圣节期间（10/1–10/31，或正式网站加 `?halloween=1` 预览）标题画面换成万圣节版：同一个渡轮大厦小模型，多了南瓜灯、小蝙蝠、橙色串灯，BAYBAY 戴着小巫师帽（电脑和手机都看过）；街区模式和其他日子不变。
6. Higgsfield 一共只花了 15.7 分（上限 1000，余额 2359.3），每一笔都记在账本 `docs/opus-bay/ledger/w6-X.md` 里。

## Part a1 · Halloween postcards and sounds (2026-09-29 01:53–02:25 PDT)

### What was built

| task | files |
|---|---|
| **W6-X2** the Halloween postcard set (Higgsfield batch 1) | `scripts/opus-sf/assets/w6/{prompts.py,prompts.json,postcards.py}` (new), `public/opus-bay/w6/postcards/` (8 WebP, 501 KB), `src/opus-bay/data/sf/halloweenPostcards.ts` (new), `docs/opus-bay/ledger/w6-X.md` (new) |
| **W6-X3** the Halloween sounds | `src/opus-bay/audio/halloween.ts` (new, lazy chunk), `src/opus-bay/audio/audio.ts` (one `case` + a 6-line lazy loader) |
| tests | `tests/opus-bay-w6-x.test.ts` (new, 5 tests) |

**Postcards (W6-X2).** Four cards for lanes H and G, painted with the recipe of every shipped postcard (nano_banana_pro
4:3 2k, refs P5 + P13, the style contract; the contract's golden-hour light swapped for "warm glowing lantern light in a
soft blue dusk" because all four are dusk / night scenes): `halloween-pumpkin-hunt` (the hunt's end), `halloween-trick-or-treat`
(a door), `halloween-big-night` (31 Oct at Postcard Row), `muertos-mission` (a community altar under marigold arches, papel
picado with plain cut patterns). 1200 × 900 and 600 × 450 WebP q82. API:

```ts
// src/opus-bay/data/sf/halloweenPostcards.ts — pure data, import from a lazy chunk only
export const HALLOWEEN_POSTCARD_IDS = ['halloween-pumpkin-hunt', 'halloween-trick-or-treat', 'halloween-big-night', 'muertos-mission'] as const;
export interface HalloweenPostcard { id; moment: 'hunt-end' | 'treat' | 'night' | 'muertos'; title: Bilingual; alt: Bilingual; large; small }
export const HALLOWEEN_POSTCARDS: readonly HalloweenPostcard[];
export const halloweenPostcard: (id: string) => HalloweenPostcard | null;
```

**Sounds (W6-X3).** `audio/audio.ts` routes the frozen `{ type: 'halloween', what, id }` event to `audio/halloween.ts`,
fetched as its own chunk at the first such event (nothing enters the main graph, lane P's budget): `treat` → three
knuckle knocks on a panelled door, an old hinge's creak, a crinkle of wrapped candies and three plastic taps into the
bucket, a G–C–E chime (≈ 1.7 s); `pumpkin` → a breathy cartoon-ghost glide (E4 → C5 with wobble) under an A-minor
celesta run that resolves to C major; `costume` → a glitter poof (a lowpass-opening noise swell) and an E-major twinkle, or
a small pop when taken off (`id` ''); `phase` `night` → one far D3 clock-tower toll with a breath of wind, once a session.
All synthesized with the engine's primitives (no files), like every sound in `audio/`.

### Evidence

- Rendered offline with the real engine in headless Chrome (`OfflineAudioContext`, `C:/Users/willy/opus-qa/w6/x/sfx/render.mjs`)
  and measured with ffmpeg ebur128: treat −27.0 LUFS (peak −6.3 dBFS, the knocks), pumpkin −26.8, costume −26.8 / off −36.6
  (a 0.15 s pop), night toll −29.3 (meant far away) — next to the shipped postcard −25.9, goal −25.3, stamp −28.9 LUFS.
  The treat's spectrogram shows the three knocks at 0 / 0.17 / 0.34 s, the creak at 0.62–1.1 s, the candy grains at
  1.1–1.4 s, the taps and the chime after. Listening files: `docs/opus-bay/qa/w6/X/sfx-{treat,pumpkin,costume-on,costume-off,night-toll}.m4a`.
- Postcards: every draw read at full size (no letters, numbers, logos or human faces; the candy wrappers patterned only);
  one redraw (the big night's draw a showed a backdrop edge on the cream void). The test checks each WebP's header size.
- Higgsfield: 5 draws, **10.00 credits** (balance 2375 → 2365, reconciled with `transactions`: ledger batch 1).

### Decisions

- The Halloween sounds are synthesized, not generated: the Higgsfield server offers speech only for standalone audio (its
  sound-effect model is reserved for its game pipeline), and every sound in `audio/` is synthesized anyway (no downloads).
- The `treat` vignette starts with the knock so it reads right whether lane G emits the event at the knock or when the door
  answers.
- The Halloween sounds load lazily from `audio.ts` (the main graph) so they add nothing to GameRoot (lane P's target).

### Requests

- **Lanes H and G**: the file names and the API are in `C:/Users/willy/opus-qa/w6/x/delivered.md` (and above): show
  `halloweenPostcard(id)?.large / .small` with its `title` / `alt` at your moments; emit the frozen `halloween` events for
  the sounds (nothing to import). Say BAYBAY's Halloween lines as BAYBAY bubbles with the texts of your line tables and
  they will speak once lane X's voice batch lands.

## Part a2 · the owner's "直接优化": the city's people (2026-09-29 02:40–03:05 PDT)

### What I shot and what was weakest

Desktop 1440 × 900 (quality high) and phone 390 × 844 dpr 3 (quality mid) at the title, the Ferry Building start, the
Painted Ladies, the Golden Gate (Presidio arrival), the Dragon Gate and Coit Tower (golden hour), BAYBAY and the player
up close (`C:/Users/willy/opus-qa/w6/x/shots/`). Ranked, the weakest things a player sees most:

1. **The people.** The city crowd and the promenade walkers (in almost every shot, often within a few metres of the
   camera) were the district promenade's faceless figure: a capsule, a ball head with a hair cap, stick legs, floating
   shirt-coloured hands, and one skin and one hair colour for everybody — next to the polished BAYBAY, the player and
   the residents (faces, cheeks, nub arms) they looked unfinished. → **fixed in this part (W6-X5)**.
2. The downtown / Chinatown blocks: grey-blue boxes with large flat windows right beside the Dragon Gate.
3. The day sky: a flat pale beige at street level (the golden-hour and night skies look good).
4. The gulls on the water read as grey blobs from the Ferry plaza.

### What was built (W6-X5)

| file | change |
|---|---|
| `src/opus-bay/world/sf/crowd.ts` (surgical, named) | new `cityPersonGeometry()` — the crowd's near figure; the far figure's head joins the tone channel; `cityPeopleFigure.make` registered at import |
| `src/opus-bay/world/life.ts` (surgical, named) | `peopleMaterial`: the shirt tint only for `aInfo.x` 9, new channel 10 = skin / hair picked per walker from its phase (7 skin tones, 8 hair colours; a dark vertex colour is hair, a light one skin); `cityPeopleFigure` + `Life.pickPeopleFigure`: the promenade's walkers wear the city figure in city mode, the district figure otherwise |
| `tests/opus-bay-w6-x.test.ts` | +2 tests |

The new figure (the residents' shape language, `actors/models.ts buildNpc`): stubby capsule legs up into the body and
bean shoes (swinging as before), a soft capsule body in the walker's shirt tint, nub sleeves tilted out, mitten hands in
the walker's skin (the x > 0 hand still waves back, W5-T1), a round head with two dark bean eyes with a white glint and
rosy cheeks, a hair cap over the crown and the back. **664 triangles** (the old one 324; the crowd draws at most
`CROWD.nearMax` = 18 near figures a frame: ≤ 12k, + ≈ 6k over wave 5 worst case; the far figure stays 92). **No new draw
call, material or program** (the same `ob-people` program, the same instanced attributes).

### Evidence

- `docs/opus-bay/qa/w6/X/x5-crowd-alamo-before-after.jpg` and `x5-crowd-ferry-before-after.jpg` (desktop, same spots):
  faces, cheeks, sleeves and hands; skin tones from light to dark brown and hair from black to blond / grey in one crowd.
  Phone 390 × 844 at the Painted Ladies (`shots/ph-painted-after.jpg`, read): the near walkers show their faces; the one
  inside the lens shrink (≤ 3.6 u) shows a faceted head (it shrinks away as before).
- The district: `personGeometry()` (324 triangles, no channel 10) is what the district's walkers wear; the test checks it
  carries no tone channel and that `pickPeopleFigure(false)` restores it.
- Checks: tsc 0 · eslint 0 errors · suite (below, before the push).

### Decisions

- Faces and tones in code, not a generated GLB: a Higgsfield character would be a new draw call and a skinned model per
  walker (the crowd is one instanced mesh of up to 64); the procedural figure matches the residents exactly.
- Tones from the walker's phase in the shader (no new attribute): the phase is a per-walker constant, so a walker keeps
  its skin and hair across LOD switches (the far figure uses the same hash).

## Part b · BAYBAY's Halloween voice (2026-09-29 03:22–04:05 PDT)

### What was built (W6-X4)

| file | change |
|---|---|
| `scripts/opus-sf/voice/w6/lines.ts` (new) | the inventory of lanes G (`halloween/lines.ts` `HALLOWEEN_LINES`, 22) and H (`halloween/worldLines.ts` `ALL_WORLD_LINES`, 18) and the take list (the lanes' own ids; mood notes) |
| `scripts/opus-sf/voice/w6/post.py` (new) | W5-V7's measured chain, unchanged (trim, two-pass loudnorm −18 LUFS / −1.5 dBTP, AAC 64k + Opus 48k, the gates, the advisory recogniser), writing wave 6's table and QA files |
| `src/opus-bay/data/sf/voiceW6.ts` (generated) | `W6_VOICE_LINES` (40 rows: id, lane, zh, en, seconds), `W6_VOICE_CHECK` (empty), `W6_VOICE_CLIPS`, registered on import |
| `src/opus-bay/game/voiceW5.ts` | the binder matches BAYBAY's bubbles against the wave-6 table too (zh + en exactly; a wave-5 recording of the same words wins) |
| `public/opus-bay/w6/voice/` | 160 files (80 clips × .m4a + .ogg, 5.1 MB on disk; a player fetches one format of a clip, only when she says it) |
| `docs/opus-bay/qa/w6/X/voice/` | `listening.md` (the owner's sheet), `w6-voice-preview-b1-{zh,en}.m4a`, `-b2-zh.m4a` (the retake), `w6-voice-report.json` |
| `src/opus-bay/audio/{audio,hooks}.ts` | `soundRegistered(id)`; the `halloween` pumpkin event plays lane X's sting only when lane H has not registered its own find chime (`halloween:pumpkin`, which it has: no double sound) |
| `tests/opus-bay-w6-x.test.ts` | +2 tests: every G / H line recorded with an unchanged text and matched by the binder, the files on disk; the pumpkin hand-over |

Nothing for lanes G and H to wire: they say these lines as BAYBAY bubbles with these texts, and the binder emits
`voice-line <id>` once per new bubble (the clip, or the chirp while it loads).

### Evidence

- 80 / 80 clips through the gates (no clipping or cut-off; pauses ≤ 0.9 / 1.2 s; F0 200–274 Hz, Pixie's range; speaking
  rate zh 2.6–4.7 characters / s, en 1.6–2.9 words / s), 73 heard right by the Windows closed-grammar recogniser (advisory:
  the misses are short calls like "Trick or treat!" and street names, `listening.md`). One retake (zh 我像不像一个小女巫？ at
  speech_rate 1.2; the first take dragged at 2.1 characters / s).
- Clip lengths 1.8–6.9 s (the Día de los Muertos lines are the longest and the gentlest).
- Higgsfield batch 2: 82 takes, **1.70 credits** (ledger); running total **11.70**, balance **2363.30**.
- Checks before the push: below.

### Decisions

- The lanes' own ids are the clip ids (`zh-w6g-knock`, `en-w6-h-hunt-all` …), so a report reads like the lanes' tables.
- A line whose text a lane changes after this batch stays a text bubble until the next batch (the test names it).

### Known gaps

- Not heard by a human: the owner's ear on `listening.md` (mark ✗ or 重录). In-game playback of these clips is covered by the
  binder test (the same path W5-V7 proved in game); a live knock with sound was not recorded in a shot.

## Part c · the Halloween title (2026-09-29 04:16–04:40 PDT)

### What was built (W6-X6)

| file | change |
|---|---|
| `public/opus-bay/w6/art/key-{wide,tall}-halloween-*.webp` (4, 268 KB) | the shipped key art edited into its Halloween version (Higgsfield batch 3, 2 draws, both used) |
| `scripts/opus-sf/assets/w6/{keyart.py,keyart.md}` | the export (exact 16:9 / 9:16 centre crop, WebP q80) and the verbatim prompt |
| `src/opus-bay/data/assets.ts` (surgical, named) | `KEY_ART_HALLOWEEN`, `titleInHalloween(date?, search?)` (halloween/season.ts's rule restated: the main graph must not import the feature folder; a test proves they agree on every day of Sep–Nov and every preview value), `keyArtFor(world, halloween)`; `ASSETS.keyArt = keyArtFor(readWorldMode(), titleInHalloween())`; `keyArtAlt` reads the chosen art's alt |
| `tests/opus-bay-w6-x.test.ts` | +1 test (city in season / on the big night only; the district and Día de los Muertos keep the shipped art; files and sizes) |

### Evidence

- `docs/opus-bay/qa/w6/X/x6-keyart-title-before-after.jpg` (desktop 1440 × 900: the shipped title vs `?halloween=1`),
  `x6-keyart-title-phone.jpg` (390 × 844 dpr 3: the tall art under the title panel, bats and the witch hat above it),
  `x6-keyart-wide-before-after.jpg` (the art alone: the same composition). `?world=district&halloween=1` shows the shipped
  art (read). Without `?halloween=` today (29 Sep) the shipped art shows. A first cold load after the edit rendered white
  once while Vite re-optimised; the reload was right (the known cold-dev-server case).
- Higgsfield batch 3: **4.00 credits**; wave total **15.70**, balance **2359.30**.

### Decisions

- The Halloween title only in the season and on the big night (not 1–2 Nov: jack-o'-lanterns are not Día de los Muertos) and
  only in city mode (the district never changes).
- `data/assets.ts` restates the season rule (a dozen lines, `game/bayNow.ts` and `core/store.ts` are already in the main
  graph) instead of importing `halloween/season.ts`: the contract test keeps the feature folders out of GameRoot's graph (it
  failed on the first try, and was right). The one main-graph addition of this lane (≈ 0.4 KB gzip); the Halloween sounds,
  the crowd figure and the voice all load lazily.

## Not done (the lane)

- The downtown / Chinatown box blocks, the day sky and the gulls (weakest items 2–4 of part a2): not started — no time for a
  change that must beat what is there in a side-by-side and pass the perf budget.
- GLBs (jack-o'-lantern, ghost, witch hat): not made — lanes H and G ship procedural ones on the shared toy program at ≈ 100
  triangles a stoop; a GLB would be a new draw call per kind and would not beat them at that size.
- V's voice batch 5 (NEXT #12): not started (time).
- A live in-game recording of a knock with its voice and sound (the binder path is unit-tested; W5-V7 proved it in game).

## Requests (the lane)

1. **Lead (hand-off)**: merge `docs/opus-bay/ledger/w6-X.md` (3 batches, 15.70 credits) into `src/opus-bay/ASSETS-LEDGER.md`;
   reconcile: every charge of the wave is listed by job id in the ledger (5 + 2 Nano Banana Pro draws, 82 TTS takes).
2. **Owner**: `docs/opus-bay/qa/w6/X/voice/listening.md` (80 Halloween clips; `w6-voice-preview-b1-{zh,en}.m4a`) and the SFX
   (`qa/w6/X/sfx-*.m4a`): mark ✗ / 重录 where something sounds wrong.
3. **Lanes H / G**: show the four postcards at your moments (`data/sf/halloweenPostcards.ts`, `delivered.md`); keep your
   line texts as recorded (the test in `tests/opus-bay-w6-x.test.ts` names any line changed after the batch).
4. **Lane P**: `data/assets.ts` gained the title's season check and the Halloween key-art row (≈ 0.4 KB gzip) — FYI for the budget.
5. **Reviewer**: the crowd's per-walker tones use the walker's phase (`life.ts PEOPLE_TONES`); a walker keeps its tones across
   the near / far switch. Worth a look on the phone at night (the tones are vertex colours, lit like the shirts).

## Final (2026-09-29 04:56 PDT)

- Commits on `origin/opus-bay`: `9d65f2a7` W6-X2 (postcards) · `bb0c5e6b` W6-X3 (Halloween sounds, report a1) · `5208bb79`
  W6-X5 (the city's people) · `fe329ae8` W6-X4 (the Halloween voice, report b) · `3bc2bb29` W6-X6 (the Halloween title,
  report c) · and this report commit.
- Checks on the pushed head `3bc2bb29`: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · opus-bay suite **1468 / 1468**.
  (Earlier, under load, one run failed D2-09 in `sf-landmarks` / `sf-landmark-context` once; it passed alone and in every
  later full run.)
- Higgsfield: **15.70 credits** of the 1000 cap (batch 1 postcards 10.00 · batch 2 voice 1.70 · batch 3 key art 4.00);
  `balance` **2359.30** at 11:29 UTC, reconciled with `transactions` job by job (ledger `docs/opus-bay/ledger/w6-X.md`).
- Dev server 5609 stopped; no Chrome of this lane left running. Scratch (raw draws, takes, renders):
  `C:/Users/willy/opus-qa/w6/x/`.
- 进度（给主人）：第六波视觉/声音线完成——万圣节明信片 4 张、万圣节音效、BAYBAY 万圣节台词 80 条录音、城市路人有了脸和不同肤色发色、万圣节标题画面；共花 15.7 分。

## Review (W6-X-review, 2026-09-29 04:56–05:40 PDT)

**给主人的摘要：** 第六波视觉/声音线我逐个提交看过，也在游戏里实际试过（电脑 1440×900 和手机 390×844）。
万圣节明信片 4 张、万圣节标题画面都好看，画风和以前一致；敲门讨糖时 BAYBAY 的录音和敲门、开门、糖果的音效都会正常播放；
城市路人的脸和肤色发色没有问题，街区模式没变。找到并修好 1 个问题：**10/31 万圣节大夜晚那声远处钟楼的钟声，原来实际上永远不会响**
（万圣节模块在声音还没开始时就宣布了“今晚是大夜晚”，这一下被错过，以后也不会再宣布）。现在进入游戏后的第一刻会响一次。
没有阻止上线的问题。Higgsfield 余额核对：2359.3（和账本一致，本次审查没有花分）。

**What was checked**

- Every commit of the lane (`9d65f2a7`, `bb0c5e6b`, `5208bb79`, `fe329ae8`, `3bc2bb29`, `b3e83493`), code read line by line.
- Live, dev server on 5629, `node scripts/opus-shot.mjs`:
  - the title with `?world=city&halloween=1` on desktop: the Halloween key art loads (`w6/art/key-wide-halloween-1920.webp`),
    alt text in the manifest; `review/rev-title-halloween-desk.jpg`. The world mode is fixed for the page
    (`?world=`), so computing `ASSETS.keyArt` once at load is right; no preload of the old art to waste.
  - the phone (390×844, dpr 3, quality mid) at night at the Ferry Building with `?halloween=1`: 46 calls, 173k triangles;
    walkers on the pier read as figures with hair / face at night (dim, like the shirts) — `review/rev-phone-night-ferry.jpg`.
    Desktop at a Belvedere door: 61 calls, 236k triangles (≤ 150 / 400k).
  - a trick-or-treat door end to end (`__opusBay.g.look(3)` + `knock(3)`): the page fetched `w6/voice/en-w6g-knock.m4a`,
    the lazy `audio/halloween.ts` chunk, then `w6/voice/en-w6g-thanks.m4a`; `__opusAudio.stats().counts` shows
    `halloween:treat: 1`. This closes the lane's open item "no in-game recording of a knock".
- The crowd faces (`world/sf/crowd.ts`, `world/life.ts`): no per-frame allocation (`pickPeopleFigure` allocates only when
  the city figure is first made); the shared `aPhase` / `aWalk` instanced attributes are the Packer's, so packing still
  works; both figures disposed on `dispose()`; the shader's `aInfo.x < 9.5` narrowing touches no other geometry of the
  people material (the district figure and the warmup box have no 10 channel). District figure unchanged (test).
- Costume events: lane G emits them only for costume items (a normal hat swap is silent); the pumpkin chime defers to
  lane H's registered `halloween:pumpkin` (one chime, not two).
- Voice: 80 m4a + 80 ogg on disk; sampled clips measured with ffmpeg (mean −17…−19 dB, peaks ≤ −2.5 dB, durations equal
  to the table; the retaken zh 小女巫 clip has no long silence). zh-Hant plays the zh clip (the binder keys on the zh text).
- Real-world fact baked into a recording (lane H's 亡灵节 line "11 月 2 日晚上 … 22 街和布莱恩特街口出发"): matches
  SFMTA's 2025 notice, https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025
  (procession on 2 November from 22nd & Bryant; checked 2026-09-29).
- Higgsfield `balance` 2359.3 at 05:33 PDT — matches the ledger (2375 − 15.70). The reviewer spent nothing.

**Defect fixed (red → green, `tests/opus-bay-w6-x.test.ts` "W6-X review" ×2)**

1. **The big night's toll never played.** `halloween/world.ts` announces the phase once, when the feature starts; that is
   before the audio is live, so `audio.ts` dropped the event, and the phase does not change again that night. Live before:
   `?halloween=night`, after a gesture and a walk, `counts` had no `halloween:night`. Fix (`audio/audio.ts`): a small
   `nightTollGate()` sees every event before the live gate and the first live moment after a `night` announcement plays
   the toll (once; a later phase disarms it); phase events no longer load the chunk on their own. Live after:
   `halloween:night: 1`, then `halloween:treat: 1` at a door.
2. **A toll the voice budget dropped counted as played** (`audio/halloween.ts` set `tolled` before asking for a voice).
   Now only a toll that got its voice counts (`nightToll` returns whether it played; `resetNightToll()` for tests).

**Checks of the pushed tree** (rebased on `b609a2ce`): `tsc` 0 · `eslint .` 0 errors · opus-bay suite **1489 / 1489**.

**Open items (not blocking)**

- The owner has not yet listened to the 80 clips and the SFX (`qa/w6/X/voice/listening.md`, `qa/w6/X/sfx-*.m4a`).
- The four Halloween postcards are delivered but not shown anywhere yet (no import of `data/sf/halloweenPostcards.ts`
  outside itself): lanes H / G still have to use them, or they stay unused files (harmless).
- A waving city walker lifts only its mitten hand (the nub sleeve stays at the shoulder), as the old figure lifted a
  floating arm blob; fine at crowd distance.
- On the phone title the tall crop hides most of BAYBAY behind the card (only the witch hat shows) — the same crop as the
  shipped key art, so not a regression.
- Weakest items 2–4 of the lane's shoot and V's voice batch 5: not started (the lane's own note).

**Blocking the go-live to main:** none.
