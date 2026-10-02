# Wave 9 · lane X · voice, sound, listening (+ Higgsfield ≤ 60)

Worktree `C:/Users/willy/wt/w9-x` (branch `w9-x`), dev port 5913, scratch `C:/Users/willy/opus-qa/w9/x/`, ledger
`docs/opus-bay/ledger/w9-X.md`, QA files `docs/opus-bay/qa/w9/X/`. Brief: `sf-w9-lead.md` §3 X. Run inside the wave-9
Ultra workflow.

## 给主人的摘要

1. **公共场合不再突然放音乐**：点「开始」后音乐不会自己响起，要等你自己第一次操作（按键、点一下、走一步）才从无声慢慢淡入，而且默认音量比以前低（原来的 60%）。环境声和 BAYBAY 的声音照旧随「开始」出现（iPhone 解锁声音的做法没动）。
2. **设置里的音量接口已备好**（给 A 线做滑块）：音乐、音效、语音三个音量，以及「只关语音」（只让 BAYBAY 安静，音乐和音效照常；关了以后连录音文件都不下载）。音量会记在这台设备上。
3. **一次只说一句**：BAYBAY 的新一句录音开始时，上一句会立刻淡出；气泡被别的气泡换掉，它的录音也停；气泡没出现（被丢掉、被挡住、还没加载完就过期）就绝不会只剩声音；她说话时不会再叠一个"耶"之类的短叫声。
4. **配音覆盖率**：新写了统计脚本，现在 BAYBAY 的固定台词共 598 句，已配音 591 句（98.8%），5 句等你试听批准，2 句没配音（拉闸太短、雪橇坡太缓，这一波补录）。

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
