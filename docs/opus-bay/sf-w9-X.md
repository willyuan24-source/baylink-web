# Wave 9 · lane X · voice, sound, listening (+ Higgsfield ≤ 60)

Worktree `C:/Users/willy/wt/w9-x` (branch `w9-x`), dev port 5913, scratch `C:/Users/willy/opus-qa/w9/x/`, ledger
`docs/opus-bay/ledger/w9-X.md`, QA files `docs/opus-bay/qa/w9/X/`. Brief: `sf-w9-lead.md` §3 X. Run inside the wave-9
Ultra workflow.

## 给主人的摘要

1. **公共场合不再突然放音乐**：点「开始」后音乐不自己响，等你自己第一次操作才从无声慢慢淡入，默认音量是以前的 60%。设置里的音乐、音效、语音三个音量和「只关语音」已经接好（A 线的设置页在用）。
2. **一次只说一句**：BAYBAY 新的一句开始，上一句立刻淡出；气泡没出现或被换掉，录音就不播；她的对话框现在也能说录好的话（比如「这段路被挡住了，我们怎么走？」「上次的一日游还没走完，接着走吗？」），翻到下一页就停，不和"嘀嘀"声叠在一起。
3. **配音覆盖率 99.2%**：BAYBAY 的固定台词共 608 句，603 句有中英文录音，5 句等你试听批准，0 句没录音。这一波新录了 15 句（30 个音频），全部通过音量、断句、音高检查，花了 0.72 积分（上限 60）。
4. **修了一个我自己引起的问题**：万圣节当天回来时，BAYBAY 又说回了普通的「今日三件小事」（H 线修好的又被我的改动盖掉了），现在她会说万圣节当天的那句。
5. **请你试听**：docs/opus-bay/qa/w9/X/voice/listening.md 列了每一句在游戏里哪儿能听到，以及要用耳朵确认的声音设置。

## Part a · the audio API, the music in public, one voice at a time, the coverage (2026-10-01 21:36–22:30 PDT)

### What was built (W9-X1)

| file | change |
|---|---|
| `src/opus-bay/audio/levels.ts` (new) | **the contract for lane A's Settings**: `getAudioLevels()` → `{ music, effects, voice: 0..1, voiceMuted }`; `setMusicVolume / setEffectsVolume / setVoiceVolume` (clamped 0..1, NaN ignored), `setVoiceMuted` (「只关语音」), `onAudioLevels(cb) → off`, `useAudioLevels()` (React, `useSyncExternalStore`), `resetAudioLevels()`, `busGains(levels, BUS_LEVELS)` (pure). Defaults music **0.6**, effects 1, voice 1, not muted. Stored in its own key `opus-bay:audio:v1` (`{ v: 1, … }`, every field validated on read; `?save=off` or a blocked storage keeps the levels for the page). No game imports: Settings' chunk and the audio chunk share it; nothing in GameRoot's static graph |
| `src/opus-bay/audio/audio.ts` | the levels on the buses: effects × the sfx and ambience buses, music × the music bus (× 0.55 in photo mode, as before), voice × the voice bus, 只关语音 → the voice bus 0; live on every change (only the buses whose gain changed are touched, so a fade in progress keeps going). **The music in public**: no more "music 2.2 s after Start" — it waits for the player's own first gesture after Start (a key / pointer / touch ≥ `MUSIC_GESTURE_GAP` 1.2 s after the Start tap: the tap's own events do not count; with `?start=` the gesture that turns sound on is the player's own and counts), then fades in from silence (`MUSIC_FADE_TAU` 3 s: ≈ 95 % after 9 s) at the player's music level. The master, the soundscape, BAYBAY and the W7 iPhone unlock inside the Start tap are unchanged. `musicProbe` (tests) and `__opusAudio.stats().levels / .lines` (DEV) |
| `src/opus-bay/audio/voice.ts` | **one voice at a time**: `line(id, fallback, shown)` — the line's clip (or its chirp) starts only while `shown()` (its bubble is still the one on screen: a bubble dropped, replaced or gone while the clip loaded never plays its voice); a newer line fades the playing one out (`stopLine`, 80 ms); no bark or chirp starts over a playing line (`lineSpeaking`); 只关语音: no clip is fetched (`line`, `loadStop`, `preload`, `preloadLines`) or played, no blips. `lineStats` (played / dropped / cut / muted) |
| `audio/audio.ts` (`voice-line`) | the line belongs to the bubble on screen when it is emitted (every emitter says it right after its `bubble()`: the binder `game/voiceW5.ts`, the pacer, `baybayLines`, realsf, economy); a line of another bubble still playing stops at once; when another bubble replaces the line's bubble (a new line, a resident's bubble) the line fades out. A bubble that simply ends keeps its clip (the binder already holds a voiced bubble for its clip's length). No bubble (a card or a dialogue box carries the words: the goals step, the pelican's ask): no gate |
| `tests/opus-bay-w9-x-audio.test.ts` (new) | 8 tests: the levels (defaults, clamping, listeners, storage round trip, damaged values, `?save=off`, a throwing storage), the bus gains, a dropped bubble never plays its voice, one voice at a time (a newer line cuts the old one, no bark over a line), 只关语音 (no clip, bark or blip), the music waits for the player's own gesture (not the Start tap, not 2.2 s), `?start=` begins it with the activating gesture. **Red on the old code** (the three behaviour tests: the line played with its bubble gone; two lines overlapped and a bark started over a line; the old code has no music gate) |

### What was built (W9-X2 · the coverage)

| file | change |
|---|---|
| `scripts/opus-sf/voice/w9/lines.ts` (new) | wave 9's inventory over wave 8's (`w8Lines`): every fixed line no table `voiceW5 … voiceW9` has, `W9_SOURCES` for wave 9's own new tables, `--takes … [--only ids] [--redo]` (the take list; redo = wave 9's muted clips at 1.1 / 1.2) |
| `scripts/opus-sf/voice/w9/coverage.ts` (new) | **every fixed BAYBAY line (zh + en) and whether it has a clip**: the text-matched lines (the tables' lines the game still says verbatim + the inventories' unrecorded lines; a recorded line a lane reworded is listed as dead, not counted) and the lines played by id (the tour / loop narration `voiceTour`, the city lines `voiceLinesSf`); voiced = both clips, neither muted; muted = waits for the owner's ear; `--list`, `--json` |
| `scripts/opus-sf/voice/w9/post.py` (new) | wave 8's chain with wave 9's paths (`public/opus-bay/w9/voice/`, `docs/opus-bay/qa/w9/X/voice/`, `data/sf/voiceW9.ts`), without wave 8's retakes of wave-7 clips; the recogniser's grammar includes wave 8's clips |
| `tests/opus-bay-w9-x-voice.test.ts` (new) | the coverage ≥ 95 % (a floor: a lane may add a line after the last batch), the rows add up, every line played by id has both clips, no line counted twice, no template; every non-voiced line is printed as a diagnostic |

### Evidence

- Coverage at `f1460b0c` (before any wave-9 recording): **598 fixed lines — 591 voiced (98.8 %), 5 muted** (the owner's
  ear: 我先到啦！再来一次？ en, 好看！买下啦。 zh, 金黄金黄的！外脆里软～ en, "Ho! Spot on!" en, 当——当——当！ zh), **2 unvoiced**
  (`GRIP_LINES.short`, `SLED_LINES.short`: w8 NEXT #10); text-matched 452 (445 / 5 / 2), by id 146 (146 voiced).
  3 recordings are dead (wave 5's 点「起飞」…, 按 G 起飞…, 1989 年大地震后… — reworded since; their new words are
  recorded in later tables).
- Tests: `tests/opus-bay-w9-x-audio.test.ts` 8 / 8, `tests/opus-bay-w9-x-voice.test.ts` 2 / 2; the audio / voice files
  (opus-bay-audio, h2b-assets, w5-tours, w6-x, w7-q-unlock, w7-q-voice-cache, w7-x-voice, w8-x-voice + the new) 79 / 79.
  The three behaviour tests fail on the old `audio.ts` / `voice.ts` (copied back from `f1460b0c`) and pass now.

### Decisions

- **Music 60 % by default and only after the player's own gesture** (the review's §10 risk "music on by default in a
  public place"): the brief's "music starts lower / after the first gesture". The Start tap still turns on the sound
  (ambience, BAYBAY) — it is the gesture iOS needs, and the soundscape is soft; the music is the loud, unexpected part.
- "Effects" = the sfx + ambience buses (the soundscape is an effect to a player); "voice" = the voice bus (recorded lines,
  barks, chirps, the dialogue blips). 只关语音 silences the whole voice bus and fetches no clip (data on a phone).
- A voice line's bubble ending on its own does not cut the clip (some lanes' bubbles are a little shorter than their
  clips: cutting there would cut words); a bubble *replaced* does.

Pushed 22:12 PDT: `a5af4106` (W9-X1), `c2b8059d` (W9-X2).

## Part b · w8 NEXT #10 recorded, the wave-9 table, the owner's sheet (2026-10-01 22:30–23:40 PDT)

### What was built (W9-X3)

| file | change |
|---|---|
| `world/sf/westLines.ts` (surgical, no wave-9 owner) | W2-C6: `LAKE_LINES.since` 从1893年起，这座船屋就一直租船给游客。 → **船屋从1893年起就租船给游客。** / The boathouse has rented boats to visitors since 1893. (the business since 1893, the building 1946–49; https://blueheronboathouse.com/ "In operation since 1893", re-read 2026-10-01) |
| `world/sf/cornersSights.ts` (surgical) | WS-4: `w8w1-pagodas-ahead` without Sing Fat's unsourced yellow: **往上看！路口两座宝塔楼：Sing Fat 和绿顶的 Sing Chong。** / Look up! The two pagoda towers at the corner: Sing Fat, and Sing Chong with the green roofs. (Sing Chong's green roof: the W8-C source; ≤ 45 zh / ≤ 110 en, the W8-W1 test) |
| `world/sf/alcatrazLines.ts` + `alcatrazFerrySystem.ts` (surgical) | the Alcatraz return-boarding line `ALCA_LINES.boardBack` **回城啦。回头再看一眼恶魔岛，前面就是旧金山。** / Heading back to the city. One last look at Alcatraz — San Francisco is just ahead. (read gently); `boardLine()` says it on the way back (it answered null → the ferry's generic 上船啦！); `tests/opus-bay-w8-a-ferry.test.ts` follows (the return line instead of "All aboard!", still never the outbound line) |
| `data/sf/voiceW9.ts` (generated by `w9/post.py`) + `public/opus-bay/w9/voice/` | batch 1: 5 lines × zh / en = 10 clips (676 KB, lazy like every clip): `GRIP_LINES.short`, `SLED_LINES.short` (wave 8's two unrecorded lines) + the three above |
| `game/voiceW5.ts` (the binder) | imports wave 9's table: matched after the earlier tables (an earlier recording of the same words still wins), `W9_VOICE_CHECK` muted, the clip lengths for the bubble hold |
| `scripts/opus-sf/voice/w9/listening.py` (new) + `docs/opus-bay/qa/w9/X/voice/listening.md` | **the owner's listening sheet**: how to listen, the wave-9 clips with where to hear them in the game, the older clips still muted (by language), the sound defaults to check by ear (the music's start, the volumes, 只关语音, one voice at a time), the older sheets not heard yet |
| `tests/opus-bay-w9-x-voice.test.ts` | + 2 tests: every wave-9 line has both files, is said verbatim, has a new id and new words, and the bubble finds it; w8 NEXT #10's five lines are voiced, the pagodas line names no colour for Sing Fat |

### Evidence

- Batch 1: 10 takes (1 failed job, refunded, resubmitted), **10 / 10 pass every gate, 9 heard right** (the en sled line
  is not recognised: advisory); −18 LUFS / −1.5 dBTP; lengths zh 2.11–5.31 s, en 2.98–6.67 s. Previews
  `docs/opus-bay/qa/w9/X/voice/w9-voice-preview-b1-{zh,en}.m4a`. Credits **0.22** (ledger, reconciled with `transactions`).
- **Coverage now: 599 fixed lines, 594 voiced (99.2 %), 5 muted (the owner's ear), 0 unvoiced**; 5 dead recordings
  (wave 5's three + wave 8's old 1893 / pagodas words, replaced).
- Checks (before the push): tsc 0 · `eslint .` 0 errors (50 warnings) · the voice tests (w7-x-voice, w8-x-voice,
  w9-x-voice) 9 / 9 · the edited lines' tests (w8-a-ferry / island / review, w8-w1-*, w8-w2-*) green · opus-bay suite
  1893 tests, 1891 pass, 1 todo, 1 fail = `sf-move2` E2-5 "a cached cell is cheap" (1000 calls < 50 ms: a wall-clock
  budget in `actors/viewField.ts`, which this lane does not touch; red alone too on this loaded machine).

### Decisions

- The three line files have no wave-9 owner (`sf-w9-lead.md` §3): lane X edits them surgically, as w8 NEXT #10 says, and
  lists them in `C:/Users/willy/opus-qa/w9/new-lines.md`.
- The pelican's later line (F's `game/pelicanFirst.ts`) and the today line (R's `realsf/todayLine.ts`) wait for those
  lanes' part-a pushes (both files are being edited tonight), then get a fixed line + a toast (part c).

Pushed 23:34 PDT: `de263e3b` (W9-X3).

## Part c · the pelican's and the today line as fixed voiced lines, one voice per bubble (2026-10-01 23:35 → 10-02 00:30 PDT)

### What was built (W9-X4)

| file | change |
|---|---|
| `game/pelicanFirst.ts` (F's file, surgical · w8 K-RC-3) | the later line was templated (想飞的时候${key}就行～: never recordable) → `PELICAN_LATER_LINE` **想飞的时候，叫上鹈鹕就行～** / Whenever you want to fly, just call the pelican! on every device; the control goes on a toast `PELICAN_LINES.laterToast` 「随时飞 · 按 G 起飞」 / 「随时飞 · 点「起飞」」 after 「以后再说」 (shown only with its bubble). The late-bubble path already has the unlock toast with the key, so no second toast there. `laterBubble(key)` keeps its shape (w5-content's regex still holds) |
| `realsf/todayLine.ts` + `realsf/index.ts` (R's files, surgical · w8 W8I-WS-1) | `todaySpoken(now, catalog)` → `{ line, toast }`: BAYBAY's welcome-back today line is one of three fixed lines — `TODAY_EVENT_LINE` 今天城里有活动！旅行本「今天」里写着呢～, `TODAY_SUNSET_LINE` 今天的日落时间和三件小事，都在旅行本「今天」里～, `TODAY_PLAIN_LINE` (the old plain branch) — and the venue · event or the sunset time go on a toast (「今天 · 金门公园 · 蓝草音乐节」, 「今天旧金山日落 18:47」). `todayLine()` stays the text of record (its tests unchanged); realsf/index says `todaySpoken` in both welcome paths, the late one shows the toast only when its bubble is on screen |
| `audio/audio.ts` | **one voice per bubble**: the first `voice-line` of a bubble wins (the binder's text match comes first, inside `bubble()`); a lane's own id for the same bubble after it (realsf's `realsf-today-welcome`, never recorded) is skipped instead of chirping over the clip. `voiceLineProbe` (tests) |
| `scripts/opus-sf/voice/w9/lines.ts` | `W9_SOURCES`: realsf/todayLine.ts' three lines (the pelican's is found by wave 5's scan of `game/pelicanFirst.ts`) |
| voice batch 2 → `data/sf/voiceW9.ts`, `public/opus-bay/w9/voice/` | 4 lines × zh / en = 8 clips |
| tests | `opus-bay-w9-x-audio` + one voice per bubble (two events, one bubble → 1 taken, 1 skipped; a new bubble's line is taken); `opus-bay-w9-x-voice` + the today line / the pelican line are fixed and voiced, the names / time / control on the toast (Bay clock pinned: 10:30 and 22:30 PDT on 3 Oct, an empty catalog) |

### Evidence

- Batch 2: 8 takes (2 failed jobs refunded and resubmitted), **8 / 8 pass every gate, 8 / 8 heard right**; zh 2.88–4.65 s,
  en 3.65–5.06 s. Credits **0.19** (lane X total 0.41).
- **Coverage: 603 fixed lines, 598 voiced (99.2 %), 5 muted (the owner's ear), 0 unvoiced** (the 4 lines are new to the
  inventory: the today line's plain branch was a literal no scan read).
- Tests of the touched files (w5-calendar, w5-content, w5-favours, w5-r-review, w5-today, w5-tours, w6-k2-review,
  w8-k1-hold, w8-s-fleet, w9-r-today, w9-x-voice) 95 / 95.

Pushed ≈ 00:47 PDT: `877d330c` (W9-X4). The first agent of the lane was stopped at ≈ 00:35–01:35 PDT by an account usage
limit (not by a fault); its last local work was three real-game probes of the sound (`C:/Users/willy/opus-qa/w9/x/probe-d*`,
01:23–01:32 PDT) whose numbers it did not write down — nothing local was left uncommitted, nothing was discarded.

## Part d · resumed: the Halloween welcome restored, BAYBAY's dialogue box voiced, batch 3 (2026-10-02 02:14 → PDT)

### What was built

| commit | file | change |
|---|---|---|
| W9-X5 | `realsf/todayLine.ts` (R's file, surgical) | **a regression of W9-X4 fixed**: W9-H2 (22:44) put the big Halloween days into `todayLine()`; W9-X4 (00:35) switched both welcome paths of `realsf/index.ts` to `todaySpoken()`, which did not have them, so a player back at 19:30 on Halloween night heard the generic 「旅行本「今天」里有今日三件小事」 again — the very thing W9-H2 fixed (review R§6 growth row). `todaySpoken()` now returns `halloween/today.ts`' fixed line first (no toast: the line names its own place and time) |
| W9-X5 | `tests/opus-bay-w9-x-today.test.ts` (new) | 31 Oct 19:30 / 12:30, 1 Nov 18:00, 2 Nov 19:10: the spoken line = lane H's line = `todayLine()`; other days the W9-X4 lines. **Red before** (31 Oct 19:30 → `TODAY_PLAIN_LINE`) |
| W9-X6 | `game/voiceW5.ts` (the binder) | **BAYBAY's dialogue box says its recorded words**: `w5VoiceForNode(speaker, nodeId)`; on a `dialogue` event of a node of hers whose exact zh + en were recorded, the binder emits its `voice-line`. Needed for lane N's stuck card (`game/tripRun.ts` `STUCK_LINE`, a dialogue node, not a bubble: the binder matched bubbles only, so the line N listed could never have been heard). None of the 103 static nodes of `data/script.ts` has recorded words (a test), so no other dialogue starts talking |
| W9-X6 | `audio/audio.ts` | a `voice-line` with no bubble while a dialogue node is open **belongs to that node**: closed or moved on before its clip starts, it never plays (the gate); moved on while it plays (a choice, the next node, closed), it stops (`voiceLineProbe.node / nodeReleases`). With neither bubble nor dialogue (a card): no gate, as before. The pelican's ask (emitted before its dialogue opens, never while another is open: `pelicanFirst` requires `!dialogueOpen()`) and the goals step are unaffected |
| W9-X6 | `audio/voice.ts` | one voice at a time in a dialogue: a recorded clip starting cuts the node's blips (`cancel()`), and no blips start over a playing recorded line |
| W9-X6 | `scripts/opus-sf/voice/w9/lines.ts` | `W9_SOURCES` + lane H's `W9_WORLD_LINES` (ids kept), lane N's `STUCK_LINE` (text pick: no import of tripRun); lane G's crossing line is found by wave 5's scan of `play/hideSeek.ts` |
| W9-X6 | batch 3 → `data/sf/voiceW9.ts`, `public/opus-bay/w9/voice/` | 5 lines × zh / en = 10 clips: `w9-h-today-festival`, `w9-h-today-big-night`, `w9-h-today-procession`, `HIDE_LINES.crosswalk` (`w5-a-311ad20d`), `STUCK_LINE` (`w5-n-645daeca`) |
| W9-X6 | `listening.py` → `docs/opus-bay/qa/w9/X/voice/listening.md` | the five lines with where to hear them (`?date=2026-10-31T19:30` on the dev server for the big night) |
| W9-X6 | tests | `opus-bay-w9-x-voice` + W9-X6 (her node with recorded words emits its line; an NPC's node, unrecorded words, an unknown node do not; no static node is affected) + W9-X7 (batch 3 voiced, the words as the files say them); `opus-bay-w9-x-audio` + W9-X6 × 2 (a dialogue line belongs to its node and is let go when the node moves on; the clip cuts the blips, no blips over a line). **The three W9-X6 tests fail on the code before** (the three files copied back from `25c2847a`) |

### Evidence

- Batch 3 (10:05–10:06 UTC): 10 takes (2 submissions refused with a 429, 2 jobs failed and were refunded; all resubmitted),
  **10 / 10 pass every gate, 10 / 10 heard right**; zh 2.69–8.66 s (the big night's greeting is the longest), en
  3.60–7.76 s. Previews `docs/opus-bay/qa/w9/X/voice/w9-voice-preview-b3-{zh,en}.m4a`. Credits **0.27** (lane X total
  **0.68**; ledger reconciled with `transactions`: nobody else spent in between).
- **Coverage now: 607 fixed lines, 602 voiced (99.2 %), 5 muted (the owner's ear), 0 unvoiced**; 6 dead recordings (wave
  5's three, wave 8's old 1893 / pagodas words, and wave 8's 这段路有点难走，你来带路吧！ which lane N replaced by the stuck card).
- W9-X6 pushed ≈ 04:03 PDT (`b6570935`; the first push loop hit a stale `rebase-merge` folder in the worktree's admin
  directory — "could not remove" on the OneDrive path — removed by hand after `git rebase --continue`; nothing lost).

### The 04:00 pass (W9-X7)

- `new-lines.md` at 04:04 PDT: 17 rows; lanes L (03:40) and R (03:46) wrote that they have no new lines. Every row's text was
  re-read in the committed source on origin `b6570935` (not only the list): H's three, N's two, G's one, X's six match their
  files verbatim and are recorded; the inventory over origin found **one** unrecorded line: lane N's Grand Tour resume card
  (`game/tripRun.ts` `RESUME_LINE`, the dialogue node `flow.tour.resume`, W9-N3) — the binder voices it since W9-X6.
- A scan of every `bubble(` / `defineNode(` added since day 0 (`git diff f1460b0c origin/opus-bay -- src/opus-bay`):
  the chapter-end card is the narrator's and templated (not BAYBAY's, not voiceable), `firstFlight`'s 跟着金圈飞！ was
  recorded in wave 5, the device-dependent bubbles (`firstFlight`, `hideSeek`, `pet`) are literal pairs the scans hold.
- Batch 4: 2 takes, **2 / 2 pass every gate, 2 / 2 heard right** (zh 3.07 s, en 4.26 s). Credits **0.04** (lane X total
  **0.72**).
- **Coverage: 608 fixed lines, 603 voiced (99.2 %), 5 muted (the owner's ear), 0 unvoiced.**

### The 04:40 pass

- 04:37–04:40 PDT: `new-lines.md` unchanged (17 rows); the inventory over origin `8df35b78` finds **0** unrecorded lines; no
  `bubble(` / BAYBAY node added since `b6570935`; no recorded line reworded since 04:03 (the 6 dead recordings are the
  known ones). No batch 5. Lane X's recorded total for wave 9: **15 lines, 30 clips** (batches 1–4), every one through all
  gates, 29 / 30 heard right by the recogniser (the en sled line of batch 1 is the advisory miss).

## Not done

- **A real-game probe of the sound** (the music's start after the first gesture, the levels, played / dropped / cut lines
  over a minute): the first agent ran it three times (01:23–01:32 PDT, `C:/Users/willy/opus-qa/w9/x/probe-d*`, its script
  `probe-audio.mjs`) but its numbers were lost with the session; the resumed agent did not re-run it (the machine took
  10 min for one `tsc` at 04:20 PDT; the brief's time box). The behaviour is covered by the unit tests (music gate, levels,
  one voice at a time, the dialogue tie); W9-I / W9-Z or the owner's ear (the listening sheet's part three) should check it.
- **F's arbiter for BAYBAY's lines**: lane F routed the title level through `game/attention.ts`; the `line` level is not
  used by the pacer yet. The voice does not depend on it: a line plays only while its own bubble (or dialogue node) is on
  screen, so whatever F's arbiter drops never speaks.
- The 5 muted clips wait for the owner's ear; the 6 dead recordings (reworded lines) still ship their small files
  (`post.py --prune` handles only wave 9's own table; the older tables are frozen for their waves).

## Requests

- **Owner**: listen through `docs/opus-bay/qa/w9/X/voice/listening.md` (30 wave-9 clips + the 5 older muted ones; the sound
  defaults: music after your first touch at 60 %, the three sliders, 只关语音). A clip you reject: name it there; lane X
  re-takes it next wave.
- **W9-I / W9-Z**: on a phone, after Start, the music must stay silent until the first own touch and then fade in; on the
  stuck card (`flow.trip.stuck`) her question is voiced once and stops on a choice.

## Higgsfield

Lane X wave 9: **0.72 credits** of 60 (batch 1 0.22, batch 2 0.19, batch 3 0.27, batch 4 0.04), balance 357.27 → 356.55,
every spend matched in `transactions` by time (ledger `docs/opus-bay/ledger/w9-X.md`); no other spend on the account between
lane X's batches.
