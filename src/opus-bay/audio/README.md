# Opus Bay — audio

Web Audio only. Every sound is synthesized at runtime (oscillators, filtered noise, Karplus–Strong
plucks). The only files ever fetched are the optional BAYBAY voice barks.

## Wiring

- `audio.ts`: `startAudio()` (called once by `game/GameRoot.tsx`, returns cleanup).
  - Preparation starts at load, in idle slices of ≤ 4 ms (`slices.ts`, lead note P1 of wave 3): the
    `AudioContext` is opened suspended (the first one opens the audio device, 110–370 ms on Windows
    Chrome: the one stall that cannot be sliced, so it happens while the page loads), then the noise
    and reverb buffers (`engineBuffersJob`) and the shore field (`shoreJob`) are synthesised.
  - Activation is the first `{type:'start'}` event, which is a user gesture. With `?start=…` the
    title is skipped and flow-ui sends no `start` event, so the first key or pointer gesture after
    the title phase activates audio instead. Activation only resumes the context and plays the silent
    iOS unlock sample; a gesture that comes before the first idle slice opens the context itself.
  - `__opusAudio.stats().prep` (DEV): slices, `ctxMs`, `longestAfterContext`.
  - Resumes on later gestures, including iOS `interrupted`. Suspends while the tab is hidden and
    when sound is switched off, so it uses no CPU then.
  - Subscribes to the store:
    - `settings.sound` is the master switch.
    - `settings.music` switches the music bus.
    - `timeOfDay` and `mode` set the music mood.
    - `paused` muffles everything with a master lowpass.
    - `photoMode` lowers the music.
    - `dialogue.nodeId` holds the music lower while a bubble is open and cancels blips when it closes.
- `engine.ts`: the master chain, buses, voice budget and synthesis primitives.
  - Master chain: master gain → pause lowpass → glue compressor → limiter (-3 dB) → speakers.
  - Four buses (`ambience 0.36`, `sfx 0.8`, `music 0.26`, `voice 0.9`). Each has a matching send into
    one shared convolver reverb (generated 2.3 s impulse). Muting or ducking a bus also mutes its reverb.
  - The noise buffers (white, pink, brown) are generated once, before the first gesture, in slices,
    and shared by every sound, with seamless crossfaded loops.
  - One-shot voices: at most 32. When full, the oldest lowest-priority voice is stolen (footsteps and
    hover first). A voice's nodes are released when its last source ends.
- `sfx.ts`: one-shot recipes.
- `ambience.ts`: persistent layers plus a scheduler for ambient one-shots, updated at 10 Hz off the audio clock.
- `city.ts`, `street.ts`, `cityHooks.ts`: the city's soundscape (lane F10, see *City mode* below).
- `music.ts`: the generative music.
- `voice.ts`: dialogue blips and voice barks.
- `logic.ts`: pure helpers, tested in `tests/opus-bay-audio.test.ts`:
  - shore distance field, panning, rate limiter
  - footstep recipes, bump classification
  - syllable counter, blip plans, bark mapping
  - music theory (moods, pentatonic, progressions, voice leading, motifs)
  - Karplus–Strong render
  - Bay Area weekday / market day

## Sounds

| Event (`core/events.ts`) | Sound |
|---|---|
| `start` | Activates audio (resume + unlock sample). The master fades in over about 3 s; music fades in after 2 s. |
| `footstep {surface, run}` | By surface. `wood`: hollow boardwalk thunk. `pavement`: crisp tap. `plaza`: harder, brighter tap. `grass`: soft swish. `sand`: granular crunch. `stairs`: deeper wooden knock with alternating pitch. `dirt`: soft crunch. Pitch varies ±8% and level ±15%; left and right feet pan slightly apart; running is louder and shorter. Capped at 6/s (token bucket). |
| `jump` | Toy "hup": rising sine plus a small whoosh. |
| `land {impact}` | Thump plus surface texture. Scales with impact (0..1, or a vertical speed in u/s). Big landings add a squish. |
| `bump {kind, strength}` | `cone`: plastic clack plus topple bounce. `crate`/`bench`/`stall`: wood knock. `buoy`: rubbery bwong. `lamp`/`bin`/`bollard`: metal tonk. `baybay`/`npc`: squeak. Anything else: soft thud. |
| `interact {kind}` | Pop-ding, plus a flavour per kind. `telescope`: coin clink and focus ratchet. `taste`: two nom bites and a happy chirp. `fish`: cast whoosh, reel clicks, plop. `viewpoint`: rising air. `board`: paper rustle. |
| `dialogue {speaker, nodeId}` | Blip speech from the node's text in the current locale (`data/script.ts`), one blip per syllable, capped at 14. **BAYBAY**: soft FM otter chirps with an upward scoop. **NPC**: nasal reed mumble, pitch seeded by name. **Player**: muted hum. Questions rise at the end, exclamations get accents, and mood shifts pitch and rate. Blips duck the music to 40% and the ambience to 78%. Moods `wave`/`excited` also play a recorded bark if one is available (rate-limited), otherwise a synth chirp. |
| `choice` | Bright three-note plink. |
| `ui {open, close, hover, select, error}` | Soft rising fwip, falling fwip, tiny tick (≤ 10/s), two-note click, gentle low "nuh-uh". |
| `stamp` | Rubber-stamp thunk plus a sparkle shower. |
| `postcard` | Sparkly pentatonic arpeggio and shimmer, then BAYBAY's "yay". |
| `goal` | Little fanfare and chord, then "yay". |
| `wish {added}` | Up-pop with ding, or down-pop. |
| `bell` | Warm two-strike clock bell (G4 → D4) with inharmonic partials and long reverb. |
| `streetcar-bell` | F-line "clang-clang" (city mode: another car's bell is panned from that car and quieter far away). |
| `foghorn` | Distant two-tone diaphone ("beeee-ohhh"), panned towards the Golden Gate (district: north-west; city: the bridge itself, quieter far away). |
| `sea-lion {intensity}` | 1–4 gravelly formant barks, panned from the K-Dock. |
| `gull` | Herring gull "kee-ow" calls, 1–4 notes, random left/right. |
| `shutter` | Two-blade camera click plus film-advance whirr. |
| `arrive` | Three-note arrival chime plus BAYBAY's "arrived" bark. |
| `area {name}` | Soft two-note "discovered" chime, only the first time each area is entered. |
| `guide-call` | Pet-call whistle "fwee-fwoo" plus BAYBAY's "hi" reply. |
| `emote {who, emote}` | `hop`: boing. `clap`: three soft claps. |

### Ambience (continuous, follows `runtime.player` and `runtime.camera.yaw`)

- **Waves**: two independent pink-noise swells panned left and right under a soft surf bed. Each swell
  has its own random rise and fall, and its lowpass sweeps from 300 Hz to 4 kHz at the crest. Level
  follows the distance to shore: a distance field computed once from `DISTRICT` (see below), plus
  height above the water. The stereo image tilts towards the water as the camera turns.
- **Wind**: band-passed noise with gusts. Grows with height on Telegraph Hill (`runtime.player.y`),
  with a little extra at the water's edge.
- **City hum**: distant traffic wash plus a little rumble. Louder inland and near the Embarcadero roadway,
  quieter at night and up the hill. Cars pass by with a filter sweep and a left/right pan when you are
  near the road.
- **Crowd murmur**: formant-filtered noise plus chatter grains near `pier39-entrance`, `pier39-carousel`,
  `farmers-market` (full on Ferry Plaza market days Tue/Thu/Sat, Bay Area time), `ferry-clock` and
  `exploratorium-front`. Quieter at night and in the morning.
- **Streetcar**: rolling rumble, traction-motor whine that rises with speed, and rail-joint clacks.
  Speed comes from how far `runtime.streetcar` moves between updates. Louder when riding.
- **One-shots**:
  - gulls (common by day, rare at night)
  - sea lions (random barks near the `sea-lion-docks` landmark, or 8u north of `sea-lion-viewpoint`)
  - water slapping the pilings within 6u of the water
  - bell buoy (night and morning)
  - foghorn every 55–110 s in `morning`/`golden`, on its own timer independent of events

**Shore field** (`buildShoreField`): a 4u grid over the slab.
- A cell is land if it is covered by a non-pier walk area, a hill, a road, a ramp, a building or a
  landmark collider.
- Each column is filled south of its northern-most land cell (the city). Everything else is water.
- Pier decks count as water, because you are standing over it.
- A chamfer distance transform then gives distance to water and the direction to water.
- District mode: it is built in idle slices at load, off the start gesture, and tolerates missing anchors. City mode
  builds the whole city's field instead (see *City mode* below).

### City mode (lane F10: `city.ts`, `street.ts`, `cityHooks.ts`)

Everything above still runs; city mode (`game.worldMode === 'city'`) adds, from the ambience's first city tick:

- **The whole city's shore field** (`CityShore`, `buildShoreField({bounds, cell, isLand})` / `shoreGridJob` in
  `logic.ts`): a window of ±256 u round the listener in 4 u cells (128 × 128), each cell land or water from the
  streamed terrain's `isLand` (resident chunks, else the far 8 u map; piers and open water are water), then the same
  chamfer transform as the district's. Water that does not reach the window's edge (Stow Lake, reservoirs, ponds) is
  land: the waves are the sea's. Built in idle slices (≤ 256 land tests between yields, well under 4 ms) once the city
  terrain is registered and again after 96 u of movement; the old field plays until the new one is in. The district's
  field is not built in city mode. The Bay waves, splashes and buoy follow it as before.
- **Ocean Beach surf**: on the Pacific side of the Golden Gate (the signed distance to the bridge's line, `gateSide`:
  Baker Beach, Lands End, Ocean Beach; not Crissy Field or the Bay) a deep swelling surf bed (brown + pink noise,
  7–11 s swells, filter opening at the crest), panned toward the water, and a breaker (`sfx.surfCrash`) on every swell.
  Audible within ~110 u of the shore.
- **Park birds and crickets**: once a second a ring of 16 ground samples (5 u and 12 u) says how much of the spot is
  park (grass, woodland dirt). By day sparrow chirps, finch warbles and dove coos (`sfx.birdCall`, more often in the
  morning); at night crickets (`sfx.cricket`).
- **The Mission's buskers** (`street.ts`): a nylon-string guitar in a 3/4 ranchera strum (bass on one, chord on two
  and three; I I V V V V I I in G, now and then a IV turn), Karplus–Strong plucks rendered once per pitch, at Valencia
  & 24th, Clarion Alley, Dolores Park and 24th & York: audible within 40 u, panned from the spot, softer at night; the
  music bus ducks to ~55 % while one plays close by.
- **Cable hum**: within 16 u of a cable-car track (transit.json lines) the cable's low whirr under the slot (lowpassed
  brown noise + 58 Hz) and the sheaves' soft double clack every 1.1–1.7 s.
- **The ferry's engine**: aboard the ferry, or within 60 u of it (panned from the boat), a diesel chug (44–48 Hz
  sawtooth, amplitude-modulated at 8.8 Hz) and the wash along the hull, both rising with the boat's speed.
- **The crowd murmur** follows the city's walkers (`cityHooks.crowd`: how many within 18 u, and their middle) and **the
  city hum** thickens with the toy cars within 40 u; **pass-bys** are the toy cars that really passed within 10 u
  (`cityHooks.passes`, panned the way they went).
- **The foghorn** comes from the Golden Gate itself (pan toward its mid-span, duller and quieter far away).
- Gliding high: the street-level layers (park, cable, buskers) fade out.

Transit sounds (`transitSound` in `logic.ts`, the `transit` event):

| `what` / `kind` | Sound |
|---|---|
| `bell` / cable-car | The gripman's bell (`cableBell`): 880 Hz clang in 2–3 strikes, ≤ 1 per 1.5 s. |
| `grip` / cable-car | `gripClank`: lever ratchet, the jaws' iron clank, the cable scraping through. |
| `push` / cable-car | `turntableCreak`: a long wooden groan and the disc's iron wheels. |
| `turned` / cable-car | `turntableRumble`: the disc rolling to a stop. |
| `horn` / ferry | `ferryHorn`: a deep major third on two reeds (147 + 185 Hz), duller and roomier far away, ≤ 1 per 4 s. |
| `hop-aside` / any | `hopSqueak`: a walker's "eep!" and a shoe scuff (heard within 22 u, ≤ 1 per 5 s). |

**Where it happened**: world code emits located events with `cityHooks.emitAt(event, x, z)` (another cable car's bell,
another F-line car's `streetcar-bell`, the ferry's horn out on the water, a hop-aside); the handler pans them from
there (`soundAt`, set only during that synchronous emit). The rider's own car is centred. The frozen event contract is
unchanged; `strength` already carries the distance.

QA: `__opusAudio.stats().city` = the shore window in use and the city layers' last levels (`park`, `ocean`, `cable`,
`engine`, `busk`); counts `busker`, `bird:*`, `cricket`, `sheave`, `surf-crash`, `ferry-horn`, `grip-clank`,
`turntable-creak`, `hop-squeak`, `car`.

**Samples**: none. The owner's listening pass decides whether any of these (the ferry horn, the surf) should become
generated SFX (lane F's Higgsfield cap; nothing was spent in wave 3).

### Music

Generative and gentle, 72–84 bpm, pentatonic, looping an A A' B A' form over 8 bars. Every third cycle
rests to breathe.

- Instruments:
  - Karplus–Strong plucks, rendered once per 3 semitones into small 22 kHz buffers and replayed at the
    right rate
  - a three-voice pad with voice leading and swells on each chord
  - a bass pluck on beat one (sometimes the fifth on beat three)
  - an occasional glockenspiel sparkle
- By time of day:
  - `morning`: D major pentatonic, 80 bpm
  - `day`: C major pentatonic, 82 bpm
  - `golden`: B♭ major pentatonic, 76 bpm, warmer and more sparkle
  - `night`: A minor pentatonic, 72 bpm, darker, more pad
- By mode: `tour` is brighter (+4 bpm, lifted melody). `week` is slightly bouncier. `onboarding` is sparse.
- Mood changes land on a 4-bar boundary.
- The music is scheduled 0.45 s ahead from a 100 ms timer; if the tab stalls, it skips missed steps
  instead of bursting.

## Voice barks (optional files)

Ids: `zh-hi zh-this-way zh-wow zh-yay zh-arrived zh-think en-hi en-this-way en-yay en-arrived`.

- **Manifest set**: if `data/assets.ts` has `ASSETS.voice[id]` = URL, only listed ids are used.
- **Manifest empty**: the engine probes `/opus-bay/voice/<id>.m4a`, or `.ogg` when the browser can't
  play AAC. It starts with `<lang>-hi`; if that is missing it stops probing, so a missing folder costs
  at most 2 requests.
- Barks load 3.5 s after boot, and only for the current language. HTML fallbacks and decode failures
  count as missing.
- **Rate limits**: at least 6 s between any two barks, and 25 s between repeats of the same bark.
- **Fallback**: missing or rate-limited barks use synth otter chirps, which are themselves rate-limited to one per kind per 3 s.

## Levels

Measured from offline renders, 400 ms RMS, dBFS.

- Ambience bed at the promenade: median about -27. Inland: about -34.
- Music: about -30.
- Dialogue blips: up to about -25.
- Footsteps: peaks around -7 dBFS.
- Collectible fanfares: up to about -17.
- The limiter keeps peaks below -3 dBFS.
- All ambience is high-passed at 95 Hz (24 dB/oct) and music at 55 Hz, so the bed stays out of the
  sub-bass that small speakers can't play.

## QA

- `DEV` only:
  - `console.debug('[opus-audio]', name)` for every sound that triggers. It is hidden unless the
    console is at Verbose level.
  - `window.__opusAudio.stats()` returns the context state, per-sound counts, active, stolen and
    dropped voices, and the last sound.
  - `window.__opusAudio.boot()` forces audio on.
- Example:
  `node scripts/opus-shot.mjs --url "http://localhost:5174/opus-bay" --actions '[{"do":"eval","expr":"document.querySelector(\".ob-btn-primary\").click()"},{"do":"wait","ms":6000},{"do":"eval","expr":"JSON.stringify(window.__opusAudio.stats())"}]'`
- The engine accepts any `BaseAudioContext`, so every recipe can be rendered with an
  `OfflineAudioContext` for spectrogram and loudness checks. Stepping `ctx.suspend(t)` lets
  `Ambience.update()` and `Music.tick()` run offline.

## Integration notes

- **Pan convention**: panning assumes the camera sits at `target + (sin yaw, cos yaw) · d`, looking
  back at the target, so screen-right is `(cos yaw, −sin yaw)`. If the rig uses the opposite sign,
  flip `LISTENER_YAW_SIGN` in `logic.ts`.
- Nodes missing from `data/script.ts` still get a short blip phrase.
