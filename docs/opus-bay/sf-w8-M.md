# Wave 8 · lane M · San Francisco mini-games (second set)

Lane M (sf-w8-lead.md §3): three new one-minute games only San Francisco has. Worktree `C:/Users/willy/wt/w8-m` (branch
`w8-m`), dev port 5809, scratch `C:/Users/willy/opus-qa/w8/m/`, QA images `docs/opus-bay/qa/w8/M/`. Owned: new
`play/<game>*` files and their css, the registration lines in `play/zones3.ts`, APPEND-ONLY `economy/records.ts`, the
`medal:<game>:n` rewards; one line per panel in lane K's `game/baybayHold.ts` hold list. Run as part of the Ultra
workflow `wf_66c65596-f6a` (a first agent of this lane worked 19:00–19:20 PDT and was stopped by the relaunch; its
uncommitted grip game was kept, fixed and finished — see part a).

## 给主人的摘要

1. **叮当车「拉闸」**（鲍威尔街两条缆车线上）：缆车开动后横幅里有「拉闸」按钮（BAYBAY 也会邀请）。像真的缆车司机一样：上坡**按住拉闸**抓缆绳，红色路段（加州街路口、转弯）**松开**滑过去，进站前松闸、发车再拉，路过路口**摇铃**。游戏只"读"缆车的位置，不改变缆车怎么开。
2. **和街头艺人合奏**：海特街（拍铃鼓，民谣摇滚）和 24 街（摇沙锤，昆比亚舞曲）的吉他手旁边，圆点碰到圈就拍，拍得准硬币就掉进琴盒。街头艺人下午才出来；其他时间 BAYBAY 自己弹他的曲子陪你练，随时都能玩。
3. **金门大桥雾笛对答**（Fort Point 炮台旁）：一艘艘船从雾里开来，先听桥上的雾笛（南塔长长的低音、桥中间一高一低两声），再照着吹一遍（南塔要按住），对了船就从桥下开过去，雾越来越浓、曲子越来越长。
4. 三个游戏手机（单指）和电脑（键盘）都实际玩过、截图看过，都能拿到「太棒了」；奖励照旧三档（5 / 10 / 15 金币），最好成绩进手帐"我的记录"。修了上一位留下的几个不公平判定（拉闸游戏）。乱按、一直按、一直不按都拿不到奖牌。
5. BAYBAY 的新台词全部是固定句子（拉闸 20 句、合奏 11 句、雾笛 13 句），22:45 前已推送给配音线。所有知识点都查过官网/资料（缆绳时速 9.5 英里、鲍威尔线过加州街必须松缆、海德街 21% 最陡、1967 爱之夏、24 街壁画最多、南塔雾笛吹 2 秒停 18 秒）。本线没有用 Higgsfield。

## Part a · W8-M1 the cable-car grip (19:24 → 20:10 PDT)

### Inventory first (what exists; nothing duplicated)

`play/`: first flight + Golden Gate rings, emotes / pet / sit / view spots, the Seward slides, **the cable-car bell riff +
lean-out** (a call-and-response rhythm game on the ride banner: `play/bell.ts`), stair races, the step counter,
marshmallows, the turntable heave-ho, crest hops, K-Dock's sea lions, frisbee, beach ball, the cardboard slide, the
crooked-street descents, hide & seek, kites, the skyline quiz, wave 7's claw machine / fortune teller / crabbing /
sourdough. `eggs/`: 24 eggs + city sounds (incl. **the foghorn duet** heard on the bridge deck in fog). A busker figure
exists: the **guitarist at Calle 24** (`world/sf/landmarks/calle-24.ts`, afternoons 12:00–20:00 Bay time, with three
listeners); none on Haight St. Nothing works the cable car's grip: the grip game is new; the bell riff stays the
rhythm game (the grip game's bell is one tap per crossing, on the same ride).

### What was built

| file (new unless named) | what |
|---|---|
| `play/grip.ts` (4.3 KB gz) | `GripGame` (pure, stepped with the ridden car's view `{ s, dir, v, mode }`): the let-go stretches (`gripMarks`: the Powell × California crossing 9 u before → 3 u past, and the line's corners found from the track heading, ends skipped), the bells (the request stops it runs through and the crossing), the dwell stops; the judgements: a red stretch entered with the lever let go (+10, held: the alarm), the rope taken again as the car leaves the red / a stop (+5 within 1.2 s), a stop pulled into let go (+5), a bell in reach (+5; stray rings after five cost a point). Score 0–100 = 70 × the judged share + 30 × the share of running time on the cable; tiers **● 40 · ◆ 65 · ★ 88** → `medal:grip:1..3`, best = score. The run: `startGrip()` through the PlayKit (`grip`), keys Space (hold) / H / Esc, Settings pauses its clock, 60 s of riding or the ride's end (a ride shorter than 15 s: no card, nothing paid, BAYBAY says why) |
| `play/GripPanel.tsx` (2.9 KB gz) | overlay `play-grip` at the bottom of the screen (phones) / at the right above the HUD (≥ 1000 px): the track ahead on a canvas (the hill's real profile, the red stretches, the stop boards, the bells — gold / ringing / green / grey —, the car with its lever back or forward, the cable glowing while held), the hint, the clock, the score, ✕ 44 px; buttons **Bell** 95 × 64 and **Grip (hold)** 243 × 64 on a phone |
| `play/GripPad.tsx` | the ride banner's pad (lane T's `registerRidePad`) on a Powell car under way: 拉闸当司机 / Work the grip; short label 拉闸 / Grip it ≤ 600 px (three pads share the phone's row) |
| `play/sfgames8.ts` (0.96 KB gz) | the set's zones chunk: the overlay, the pad, the chunks prefetched while waiting for / riding a Powell car, BAYBAY's invite 5 s into the ride once a visit (not while lane K's hold is on, a bubble is up, a game runs) |
| `play/sfgames8Lines.ts` | the set's names and **all BAYBAY lines** (zh + en, fixed): grip 20, busker 11, foghorn 10 (busk / foghorn lines for parts b / c) |
| `play/sfgames8Sounds.ts`, `play/sfgames8.css` | synthesized `m8-grip-on` / `-off`, `m8-take`, `m8-coast`, `m8-alarm`; the panel css |
| `play/zones3.ts` (surgical, 4 lines) | `import('./sfgames8')` → `initSfGames8()` beside wave 7's set |
| `game/baybayHold.ts` (lane K's, 1 line) | `'play-grip'` in `BAYBAY_HOLD_OVERLAYS` |
| `economy/records.ts` (append) | row `grip` 叮当车拉闸 (points) |
| `tests/opus-bay-w8-m-grip.test.ts` | 10 tests (below) |

### Defects in the inherited draft, fixed (red, then green)

1. **A red stretch right after a stop was judged "not let go"**: a let-go counted only if the lever had been held within
   8 s, and the clock ran on while the car stood at the stop — southbound the crossing's red begins 3.8 u after
   Powell & Sacramento, so a player who let go into Sacramento correctly got `letgo-idle` (0 / 10). Now the window counts
   running time only, a right let-go keeps the lever "in rhythm" (a stop right after the red counts too), and the game's
   start counts as a grip. Test "the let-go clock ran on at a stop": red `bell-miss,stop-ok,letgo-idle`, green.
2. **The stop hint flipped back to "grip" in the car's last half-unit** (the next stop was looked up as "more than 0.3 u
   ahead"), so a player following it gripped into every stop: `stop-bad` × 4 on lane F's real cars (the real-car test
   was red: perfect player 77). Now the game tracks the next stop until the car has stood at it or passed it.
3. **The crossing's bell could not be rung by a player following the hint** (the bell and the red stretch overlap and
   the hint showed only "let go"): the bell is now its own cue (`bellNow`; the hint reads 松开拉闸，摇铃过路口！) and the
   lever's hint goes on. The hint also says let go 6 u **before** a red stretch (it said so only inside it).
4. A "take the rope" window opened while the hint already said let go for a red stretch just ahead (`go-late` for doing
   the right thing): closed.

### Evidence

- **Tests** `tests/opus-bay-w8-m-grip.test.ts` 10 / 10: the lines (fixed text, zh ≤ 45); the marks on both Powell lines
  both ways; **players on lane F's real `CableSystem` stepped in node** (6 rides incl. southbound; the game reads the car
  only): perfect 100 on all six, a player 0.3 s late 95–100, the lever always held 35 (no medal), never touched 4–26 (no
  medal), never ringing ≤ 85 (never ★); the stop-clock regression; the hint before the red; **a whole game through
  `stepFrameSystems`** → `medal:grip:1..3`, best ≥ 88; 放弃 → nothing paid; an 8 s ride → no card and the 这趟太短啦 line;
  Settings pauses the clock; the pad's visibility (Powell under way only, not California, not waiting); the hold list;
  the records row; the chunks (zones8 960 B, grip 4315, panel 2931, pad ≈ 330, lines 2782, sounds 673 gzip; lazy from
  zones3 → sfgames8; nothing in GameRoot; no transit module imports the game).
- **Played in the game** (dev 5809, `?world=city&start=free&save=off`, one headless Chrome, `--force_high_performance_gpu`;
  every image read): the Powell–Hyde from Powell & Market toward Hyde & Beach; the pad clicked; an in-page player pressing
  the real keys (desktop: Space / H on `document.body`) and the panel's buttons (phone: pointer events on 拉闸 / 摇铃):
  - desktop 1440 × 900: the panel at the right above the HUD row, the red stretch at the crossing
    (`qa/w8/M/a3-grip-cross-desk.jpg`; the new player's goals card was left open in this run), the card **★ Brilliant · 96 ·
    let-gos 2/2 · bells 5/5 · on the cable 99% · +30 coins** (the first stop came 2.4 s into the game: judged idle → fix 1's
    "the start counts").
  - phone 390 × 844 dpr 3 touch: the panel under the ride banner (`a1-grip-cross-phone.jpg`), the whole minute by the
    buttons → **★ Brilliant · 100 · let-gos 2/2 · bells 5/5 · on the cable 99%** and BAYBAY's 你是真正的叮当车司机！
    (`a2-grip-card-phone.jpg`); the judgements in order: stop-ok, go-ok, bell-ok, … letgo-ok (California), take-ok, …
  - the phone's pad row measured: Bell riff 41–141, Lean out 145–254, **Grip it 262–355** px (the long label overlapped
    Lean out by ≈ 5 px before the short one).
- **Calls / triangles** (desktop, dev `renderer.info`): 81–82 calls / 271–275k on the moving car with the panel up (the
  game draws nothing in 3D).
- Checks on `ef061beb` (before the rebase): `npx tsc -p tsconfig.app.json --noEmit` 0 · `npx eslint .` 0 errors (50 old
  warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` **1676 / 1676** (250 s).

### Decisions

1. **Read-only on the ride**: the game never brakes, holds or moves the car (lane K / F own it); it judges how well the
   lever is worked against the car's real motion. So the car does not stop if you never let go: the alarm, BAYBAY's
   line and the score say it (as the real alarm under Powell St would).
2. **Every corner is a let-go curve in the toy** (the real lines have pull curves too; the museum page describes both):
   simpler to read; the crossing is the real rule.
3. The rope is "taken again" right past the crossing (the real northbound cars coast 3½ blocks downhill: 20 s of nothing
   to do in a one-minute game) — recorded in the code.
4. ★ needs the bells too (88: a perfect lever without bells tops out near 85).

### Facts (checked on the web 2026-09-30)

- "Four loops of wire rope are run at a constant 9 ½ miles an hour"; "Powell Street cars have to 'let go' of the cable
  because the Powell Street cable runs beneath the California Street cable"; drift curves ("the grip person simply
  releases the cable to let the car coast around the corner") vs pull curves; bells as "a warning device of an
  approaching cable car" — https://www.cablecarmuseum.org/archive/Anat/Anat.html
- "With one hand clanging the bell to keep crossing automobiles from getting in his way, he throws the grip lever forward
  with his other hand just in time"; "an alarm system and mechanism under Powell Street on either side of the California
  tracks to physically force the Powell cable from the grip if it is held too long" —
  https://www.streetcar.org/wheels-motion/cable-cars-work/
- "the Powell cars coast downhill, off the cable, for three and a half blocks"; "the steepest grade in the cable car
  system—a harrowing 21 percent slope—… from Chestnut to Bay Street" —
  https://www.streetcar.org/wheels-motion/ride-cable-car-lines/
- Gripping "requires extraordinary skills" (strength and coordination) — https://www.sfmta.com/press-releases/sfmta-announces-third-woman-ever-serve-cable-car-grip (the first agent's check, 2026-09-30)

### Known gaps

- The ride is skipped (直接到站) or hopped off: the game ends with what was judged (a card from 15 s and three judged
  moments).
- In node a fresh `CableSystem` never brings a car round the Hyde & Beach / Taylor & Bay turntable to a rider waiting
  there (the southbound real-car tests start mid-line); the game's own rides do (lane F's area, not changed).

### Requests

- **Lane X** (voice): BAYBAY's new lines are fixed text in `src/opus-bay/play/sfgames8Lines.ts` (`GRIP_LINES` 20;
  `BUSK_LINES`, `FOG_LINES` for parts b / c — final by 22:45).
- **Lane Q**: the ride banner's pad row (`ui/RideBanner.tsx` `PAD_ROW`) does not wrap; with three pads on a 390 px phone
  the long labels overlapped — the grip pad now uses a short label; a `flexWrap: 'wrap'` would make it robust.
- **W8-I / W8-Z**: ride a Powell car (`__opusBay.transit.ride('powell-hyde','powell-market','hyde-beach')`), tap 拉闸 /
  Grip it in the banner.

## Part b · W8-M3 play along with the busker (20:40 → 21:20 PDT)

### What was built

| file (new unless named) | what |
|---|---|
| `play/busk.ts` (4.0 KB gz) | `BuskGame` (pure, stepped by the game clock) + the run. Two songs of 18 bars (2 to listen in, 6 verse, 8 chorus, 2 outro): **Haight St** — a folk-rock strum in G at 108 BPM, you play the **tambourine** on the backbeat (2 and 4), then every beat and the "and"s in the chorus (49 dots, 40 s); **24th St** — a **cumbia** in A minor at 96 BPM, you shake the **maracas** on the off-beats, then the güiro's figure (73 dots, 45 s). A tap is judged against the nearest dot still to play: within 70 ms perfect (2), 140 ms good (1); a near miss breaks the run; a tap with no dot near is a stray (−1: no mashing); a dot passed unplayed is a miss. The first taps teach the player's own offset (the PlayKit's `RhythmJudge`, ±0.25 s: a late thumb, a Bluetooth speaker). Score = the share of a perfect take; tiers **● 50 · ◆ 75 · ★ 90** → `medal:busk:1..3`, best = score. A coin falls into the open guitar case every 4 in a run. The city's music and ambience are ducked while you jam |
| `play/buskSounds.ts` | synthesized, scheduled beat by beat 0.18 s ahead on the audio clock: `m8-busk-beat` (Haight: a steel-string strum D · D U · U · D U over a stomp box; 24th St: the bass on 1 and 3, the nylon guitar's chop on the off-beat, a soft güiro), `m8-tambourine`, `m8-maracas`, `m8-clink`; chords voiced in code, no melody of any real song |
| `play/BuskPanel.tsx` (3.1 KB gz) | overlay `play-busk` (bottom on phones, at the right ≥ 1000 px): the street on a canvas (Haight's painted fronts / 24th St's papel picado and a mural of shapes — no copy of a real mural), the busker strumming on the beat (or **BAYBAY with a toy ukulele** when he is not out), his open case filling with coins, the track (dots slide in to the ring: the tambourine / the maracas; it pulses on the beat; green / gold / grey / red flash), the run ×n and the score; one 68 px button 拍铃鼓 / 摇沙锤 (Tap / Shake), a tap anywhere on the picture counts; Space / Enter / J / F |
| `play/sfgames8.ts` (+ 0.8 KB) | the two prompts beside lane L's guitarists (`play:busk-haight` at −36.97, 757.33 — the corner's local (0.5, −7.6); `play:busk-mission` at 455.00, 636.47 — local (0.2, 2.7)), **their hours = the corners' afternoon windows** (Haight 11–19, 24th St 12–20 Bay time): 和街头艺人合奏 / Jam with the busker while he plays, **和 BAYBAY 练一曲 / Practise with BAYBAY** otherwise (she plays his tune: the same game and medal); BAYBAY's invite (the busker's line, or 街头艺人下午才来，我们先练练他的曲子吧！) once, not after a jam, not under lane K's hold; the chunks within 60 u; the prompts step aside while any game runs |
| `game/baybayHold.ts` (lane K's, the same line) | `'play-busk'` |
| `economy/records.ts` (append) | row `busk` 和街头艺人合奏 (points) |
| `tests/opus-bay-w8-m-busk.test.ts` | 6 tests (below) |

### Evidence

- **Tests** 6 / 6: the charts (18 bars, dots ≥ 0.27 s apart, the backbeat / the off-beats in the verses, a chord a bar,
  40 / 45 s); **players**: on the dot 100, ±40 ms 100, ±110 ms 61 / 64 (●), a +130 ms thumb learnt (offset 0.12) 100,
  every third dot skipped 65 / 66 (no ★), a masher every 60 ms **0**, a dozer 0; a whole jam through `stepFrameSystems`
  → `medal:busk:1..3`, best ≥ 90; 放弃 and the stick pay nothing; Settings pauses the song; the prompts **standable on
  the published city**, ≥ 0.6 u clear of the guitarist / his case (soft obstacles) and ≥ 0.75 u of his listeners, the
  hours and frames pinned to `HAIGHT_CORNER` / `CALLE_24_CORNER`; the hold list; the records row; the chunks (busk
  3997, panel 3127, zones8 1793 B gzip; lazy; nothing in GameRoot).
- **Played in the game** (dev 5809, images read):
  - desktop 1440 × 900, Haight St at 21:00 Bay time (no busker out): the contextual button **Practise with BAYBAY · Jam
    with the busker** and her invite 街头艺人下午才来… (scratch `b/d-0-prompt.jpg`); an in-page player pressing Space on
    `document.body` at each dot: the chorus with the run ×39 and BAYBAY's ukulele on the panel
    (`qa/w8/M/b2-busk-haight-practice-desk.jpg`), **49 / 49 perfect → 100**, the coins 15 → 45 (+30: the three medals),
    then the Summer of Love fact.
  - phone 390 × 844 dpr 3 touch, 24th St at `?date=2026-09-30T14:30` (the guitarist out): BAYBAY's 24 街的吉他手！拿对沙锤
    一起合奏？ and the contextual button **Jam with the busker** (`b3-busk-invite-phone.jpg`); pointer events on 摇沙锤:
    the chorus (`b1-busk-mission-phone.jpg`: the papel picado, the mural of shapes, the guitarist, ×52), the card
    **★ Brilliant · 99 · perfect 72 · good 1 · best run 73 · 18 coins in the case · +30 coins** and BAYBAY's 你们简直就是一支
    乐队！ (the card's text read from the DOM).
- **Calls / triangles** (dev `renderer.info`): Haight St during the jam 94 calls / 305k (desktop), 24th St 61 / 205k
  (phone, quality mid); the jam draws nothing in 3D.

### Decisions

1. **Both buskers, by their real hours in the game**: lane L's corners show the guitarists in the afternoon; outside
   that window the game is still there — BAYBAY plays his tune herself (the prompt and the invite say so) — so a player
   in China's evening (the Bay's early morning) can play it too, and the world never shows a busker who is not there.
2. **Rhythm on the game clock, the sound scheduled beat by beat** (each beat handed to the audio clock 0.18 s ahead):
   the dots and the sound stay together on a slow phone, Settings pauses the song cleanly, and the game works with the
   sound off. The windows are generous (70 / 140 ms) and the offset is learnt.
3. **No mashing**: a stray tap costs a point (a masher scores 0); a tap a little off breaks the run but costs nothing.
4. The instruments are the player's (tambourine on Haight St, maracas on 24th St): the busker's own part is the guitar.

### Facts (checked on the web 2026-09-30)

- "As many as 100,000 people … converged in San Francisco's Haight-Ashbury district and Golden Gate Park" (the Summer of
  Love, 1967) — https://en.wikipedia.org/wiki/Summer_of_Love
- Calle 24 Latino Cultural District: recognized by the Board of Supervisors in May 2014; "The district boasts the most
  murals in the city" — https://en.wikipedia.org/wiki/Calle_24_Latino_Cultural_District

### Known gaps

- The 3D guitarist does not strum in time with the jam (lane L's corner figure is static; the panel's figure strums).
- The songs are toy loops (no melody line): the busker's strum and the bass carry the beat.

### Requests

- **Lane X** (voice): `BUSK_LINES` in `play/sfgames8Lines.ts` (11, fixed; `closed` reworded this part:
  街头艺人下午才来，我们先练练他的曲子吧！ / The busker comes in the afternoon. Let’s practise his tune!).
- **W8-I / W8-Z**: Haight St −36.97, 757.33 and 24th St 455.00, 636.47; `?date=…T14:30` for the guitarists.

## Part c · W8-M5 / M6 the foghorns' call and answer at Fort Point (21:10 → 22:15 PDT)

### Pick: the foghorns, not the Chinatown lanterns

The brief offered the fog-horn call-and-answer at the bridge / Fort Point or a Chinatown lantern game at night. The
foghorns are the more San Francisco one (the Golden Gate's horns are what the city hears in fog; Fort Point is under the
bridge's south end) and play by day and night; lanterns would mix with the Halloween hunt's 40 lanterns this month and
with lane H's Chinatown Halloween Festival kit on Waverly Place (31 Oct), and a night-only game is out of reach for a
player in China's evening. It is not the foghorn-duet egg (eggs/marina.ts: listening on the deck in fog) nor the bell
riff (a rhythm call-and-response on the cable car): this is a memory-and-listening game with three different horns, a
held long blast, and ships to bring in.

### What was built

| file (new unless named) | what |
|---|---|
| `play/foghorn.ts` (3.3 KB gz) | `FogGame` (pure, stepped by the game clock). Three horns after the real ones: **南塔 · 长音** the south tower pier's long low horn (hold it ≥ 0.7 s), **桥中 · 高 / 低** the mid-span's two tones (a tap each). Six rounds: a ship comes out of the fog → the bridge calls a short tune (2, 3, 3, 4, 4, 5 horns, drawn fresh each game: the south horn at most once a round, never one mid-span horn three times running) → you blow it back in order (judged on release) → right: a toot back and the ship sails under the bridge; wrong / too short / too slow (2.6 s a horn + 2 s): the call plays again; wrong again: the ship drops anchor and the next one comes. 3 points a horn first time, 1 on a second listen; 0–100 of 63; tiers **● 40 · ◆ 70 · ★ 90** → `medal:foghorn:1..3`, best = score. The fog thickens each round. Synthesized `m8-horn-S/H/L` (sawtooth through a low-pass, a sub-octave sine, reverb) and `m8-toot`. Keys 1 / J, 2 / K, 3 / L (press = blow, release = judged), Esc; the stick gives up |
| `play/FogPanel.tsx` (3.3 KB gz) | overlay `play-foghorn` (bottom on phones, at the right ≥ 1000 px): the Golden Gate from Fort Point on a canvas — the south tower in International Orange with its portal struts and pier, the main cable sagging to mid-span, the suspenders and the deck, the strait, Fort Point's brick corner in front; the ship of the round (a container ship, a sailboat, a tanker, a ferry, a fishing boat, a second container ship) coming in, waiting, sailing under the bridge or at anchor; the horns lighting and ringing over the water as they sound; the fog drifting, thicker each round; the tune's dots (lit as you answer) and the six ships' dots; three 64 px horn buttons (dimmed while the bridge calls) |
| `play/sfgames8.ts` (+ 0.2 KB) | the prompt 雾笛对答 / Foghorn call and answer at Fort Point (the fort's local (−7, −3.5) = −743.71, 590.25, by its west wall on the water), BAYBAY's invite 南塔的雾笛就在旁边！来玩雾笛对答？ from the fort's arrival on (`FOG_INVITE_R` 12: the arrival is 9.5 u away), the chunks within 60 u |
| `play/sfgames8Lines.ts` (W8-M5, pushed 21:35) | `FOG_LINES` final, 13 fixed lines: + `ship`, `hold`, `anchor`; the invite says 就在旁边 / right here (Fort Point is beside the south tower, not under it) |
| `game/baybayHold.ts` (lane K's, the same line) | `'play-foghorn'` |
| `economy/records.ts` (append) | row `foghorn` 金门大桥雾笛对答 (points) |
| `tests/opus-bay-w8-m-foghorn.test.ts` | 6 tests (below) |

### Evidence

- **Tests** 6 / 6: the tunes over 60 seeds (lengths, the rules, ≥ 55 different games); **players**: a good ear **100 in
  67 s**, a second listen on two rounds 78 (◆), two ships lost 67 (●), the south horn always tapped short never ★,
  never answering 0 (12 late answers); a whole game through `stepFrameSystems` → `medal:foghorn:1..3`, best 100; 放弃,
  the stick and Settings; the prompt **standable and reached on foot** from `LANDMARK_ARRIVALS['fort-point']` (a flood
  fill on a 0.25 u grid at radius 0.3: the sea-wall walk on the strait side is not reachable from the arrival, so the
  prompt stands by the fort's west wall), 6.4 u from egg 9, 9.5 u from the arrival; the hold list; the records row; the
  chunks (foghorn 3283, panel 3298, zones8 2016 B gzip; lazy; nothing in GameRoot).
- **Played in the game** (dev 5809, images read):
  - desktop 1440 × 900: the prompt by the fort's brick wall and a lamp on the water (scratch `c/d-1-prompt.jpg`; egg 9's
    otter story was up from the arrival); the answer of round 3 (`qa/w8/M/c2-foghorn-answer-desk.jpg`: the panel at the
    right, the bridge drawn in orange, the ferry waiting, the three horn buttons with 1 / 2 / 3); an in-page player
    pressing the keys → **★ Brilliant · 100 · 6 ships first time · +30 coins** (`c3-foghorn-card-desk.jpg`).
  - phone 390 × 844 dpr 3 touch, pointer events on the horn buttons, one wrong horn on purpose in round 2: the log
    `wrong@17.0` → the call again → `right, right, round-ok` (a second listen); round 4's ferry sailing under the bridge
    in the thicker fog, the real bridge and its towers behind the panel (`c1-foghorn-ship-phone.jpg`). (The run's script
    ended in the last round before the card: the card is the desktop's.)
- **Calls / triangles** (dev `renderer.info`): at the prompt during the game 50 calls / 92k (desktop), 40 / 74k (phone).
- **A landscape phone, 844 × 340 dpr 2 touch** (scratch `d/L-busk.jpg`, `d/L-fog.jpg`, read): the busker panel stands at
  x 202–642, y 43–328 with its Tap button 418 × 68; the foghorn panel y 56–328 with three horn buttons 134 × 64 and the
  bridge picture; both fit (the `max-height: 560px` rules shrink the canvas); while open they cover the left half of the
  postcards pill.
- **W8-M7** (after the part's suite): the set's hot paths no longer allocate per frame (grip's `inZone` / `zoneAhead` /
  `bellWindow` closures, the foghorn call's `callTimes` rebuilt each frame, the busker prompts' pair array): plain
  loops / computed once; behaviour unchanged (lane M's tests 22 / 22).
- Checks on `293b9f3b` (W8-M6, before the rebase): `tsc` 0 · `eslint .` 0 errors · the opus-bay suite **1766 / 1766**
  (212 s). Part b's run on `07850533`: **1729 / 1729**.

### Decisions

1. **Judged on release, the south horn by how long it was held**: the hold is the skill of the long blast; the
   mid-span horns are taps. A press while the bridge calls does nothing (the buttons are dimmed).
2. **One more listen, then anchor**: a mistake replays the call once (BAYBAY: 哎呀，吹错啦，再听一遍～); a second
   mistake loses that ship, not the game — six ships always come.
3. **The prompt by the fort's west wall**: the strait-side sea wall is not walkable from the arrival in the published
   city; the west wall is on the water too and reached on foot (recorded in `play/sfgames8.ts`).

### Facts (checked on the web 2026-09-30)

- "There are two foghorns mounted on the south tower pier"; "A 2-second blast, an 18-second pause"; "three foghorns
  mounted below the roadway level at mid-span … sound as two blasts, each with a distinct tones"; "When the fog rolls in
  … the foghorns are manually turned on (and off) by Bridge workers" —
  https://www.goldengate.org/bridge/history-research/bridge-features/foghorns-beacons/
- Fort Point stands under the bridge's south arch (lane D2's landmark note, `world/sf/landmarks/fort-point.ts`).

### Known gaps

- The horns sound in the panel only: the city's own foghorn sounds (lane D's egg, the ambience) are not driven by the
  game, and the 3D world's fog does not change with the panel's.
- A game with second listens runs about 80 s (one minute when right first time).

### Requests

- **Lane X** (voice): `FOG_LINES` in `play/sfgames8Lines.ts` (13, fixed, final at W8-M5).
- **W8-I / W8-Z**: Fort Point's prompt at −743.71, 590.25 (walk west from the fort's arrival along its wall).

## Not done (lane)

- The Chinatown lantern game (the brief's alternative to the foghorns: recorded in part c why the foghorns were picked).
- The 3D guitarists strumming in time with the jam; the grip game's pull curves (every corner is a let-go curve here).
- No Higgsfield credits were given to this lane and none were spent: everything is drawn and synthesized in code.

## Requests (lane, all parts)

- **Lane X**: BAYBAY's 44 new fixed lines are in `src/opus-bay/play/sfgames8Lines.ts` — `GRIP_LINES` 20, `BUSK_LINES` 11,
  `FOG_LINES` 13 (exact zh + en; final since W8-M5, on origin since 21:35 PDT). **W8-X5 (batch 3) voiced 38 of them**
  (checked 22:58 against `data/sf/voiceW8.ts`); **6 still to record** (exact text):
  `GRIP_LINES.short` 这趟太短啦，下次坐远一点再拉闸！ / That ride was too short! Grip on a longer one next time. ·
  `BUSK_LINES.closed` 街头艺人下午才来，我们先练练他的曲子吧！ / The busker comes in the afternoon. Let’s practise his tune! ·
  `FOG_LINES.invite` 南塔的雾笛就在旁边！来玩雾笛对答？ / The south tower’s foghorns are right here! Call and answer? ·
  `FOG_LINES.ship` 大船从雾里开出来了！ / A big ship is coming out of the fog! ·
  `FOG_LINES.hold` 南塔的长音要按住哦～ / Hold the south horn for its long blast! ·
  `FOG_LINES.anchor` 这艘船先抛锚等一等，下一艘！ / This one drops anchor to wait. Next ship!
  Two clips of batch 3 carry the first agent's older wording and match no bubble now (`w5-a-3e5b9d08` 街头艺人下午才来哦，
  下午再来！ and `w5-a-4aa60f8a` 南塔的雾笛就在头顶！…): the new wording is kept on purpose (the busker game plays at any
  hour with BAYBAY; Fort Point is beside the south tower, not under it).
- **Lane Q**: the ride banner's pad row (`ui/RideBanner.tsx` `PAD_ROW`) could wrap (three pads on a 390 px phone); the
  new overlays `play-grip`, `play-busk`, `play-foghorn` for the iOS-size overlap scans.
- **W8-I / W8-Z**: the grip on a Powell car (the banner's 拉闸 / Grip it pad), the buskers at Haight St (−36.97, 757.33)
  and 24th St (455.00, 636.47) (`?date=…T14:30` for the guitarists; other hours: BAYBAY's practice), the foghorns at
  Fort Point (−743.71, 590.25).

## Commits and final checks (23:05 PDT)

| commit | what |
|---|---|
| W8-M1 | the cable-car grip game (kept the first agent's draft; four unfair judgements fixed red-then-green) |
| W8-M2 | report part a + 3 shots |
| W8-M3 | play along with the busker (Haight St tambourine, 24th St maracas; BAYBAY's practice off-hours) |
| W8-M4 | report part b + 3 shots |
| W8-M5 | the foghorn lines final for lane X (13) |
| W8-M6 | the foghorns' call and answer at Fort Point |
| W8-M7 | no per-frame allocations in the set's hot paths |
| W8-M8 | report part c, 给主人的摘要 for the three games + 3 shots |
| W8-M9 | report: the 6 lines lane X has still to voice; these final checks |

- Final checks on `11537357` (W8-M8 on origin; W8-M9 is docs only): `npx tsc -p tsconfig.app.json --noEmit` **0** ·
  `npx eslint .` **0 errors** (50 old warnings) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
  **1795 / 1795** (22:56–22:59 PDT). Lane M's own tests: grip 10, busk 6, foghorn 6.
- Higgsfield: **0 credits** (none granted to this lane). The dev server on 5809 is stopped; no Chrome of this lane is
  left running.
- Where a reviewer looks first: the grip on a Powell car from Powell & Market (the phone's pad row, the panel at the
  bottom, the crossing at California ≈ 30 s in); the busker at 24th St with `?date=2026-09-30T14:30` (the guitarist out)
  and at Haight St at any other hour (BAYBAY's practice); the foghorns at Fort Point (a wrong horn → the call again; a
  short south horn → 南塔的长音要按住哦～).
