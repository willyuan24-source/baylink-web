# Wave 4 · lane V credit ledger (AI landmark meshes, vehicle references, T1 map stickers, voice)

Cap **120** credits for wave 4 (plan §6, lead note §5), lane V only; keep ≥ 50 of the balance for the final polish.
Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account is shared: charges are attributed by job id and time from
`transactions`, never by the balance difference alone. Prompts (verbatim, with their references): 
`scripts/opus-sf/assets/w4/prompts.py` → `prompts.json`. Raw downloads: `C:/Users/willy/opus-qa/w4/w4-v/{ai/raw,vehicles,stickers}/`.

## Preflight (W4-V2), 2026-09-27 17:10 UTC

- `balance` **455.58** (ultra). Newest transaction before this lane: Qwen Audio 3.0 TTS Flash −0.01 at 10:07:13 UTC (wave 3,
  H2b voice) — the wave-4 mark.
- CDN: `curl` of K6 (`hf_20260925_223758_3617006b-….png`) → HTTP 200, 6,390,343 B. Downloads reset the connection now and
  then (curl error 35) and succeed on a retry (the download helper retries 4–6 times).
- Upload path: `media_upload` → S3 PUT 200 → `media_confirm` "uploaded": `588c24e4-8abb-4ad9-92ac-f98b5283b1a1` = a 1024 px
  crop of `public/opus-bay/map/paper-v1-2048.webp` (the painted-map style reference for the stickers). Free.
- Style references (prior jobs, no upload): K6 `3617006b-483d-4ea7-9e72-39b681f8264f`, rotunda concept L2-C1
  `fba12f36-5e33-435f-9944-be12f183acf9`.

## Batch 1 · concepts, vehicle references, sticker sheets (17:17 UTC)

Balance before: 455.58. Model `nano_banana_pro` (served `nano_banana_2`, billed "Nano Banana Pro"). Landmark variant a =
refs K6 + L2-C1 with the "match the look, make a different building" prefix; variant b = ref K6 only. Every landmark and
vehicle prompt = subject + the part-1 3D concept add-on + the style contract; the sticker prompt uses the painted-map
style instead of the (tilt-shift photo) contract.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-C1a | Cal Academy concept a | nano_banana_pro 1:1 2k, refs K6 + L2-C1 | long low glass museum under a thin white overhanging roof on slim columns; green living roof with two big porthole domes + small humps | 2 | 6c79ad6f-7731-44e7-aa65-da82b6a125ee | ai/raw/cal-academy-a.png | runner-up (left dome without portholes); its SAM failed (below) |
| W4V-C1b | Cal Academy concept b | nano_banana_pro 1:1 2k, ref K6 | same | 2 | 194ef1d0-31a2-40d0-94af-8235ab5c4985 | ai/raw/cal-academy-b.png | **USED** (both domes with portholes, humps between) |
| W4V-C2a | St Ignatius concept a | same as C1a | twin four-stage towers (square → octagonal, open belfry, domed lantern + chunky cross), columned front + pediment, tile nave, dome on a drum | 2 | 00c95970-261f-4fda-aa90-a57ab1a31742 | ai/raw/st-ignatius-a.png | meshed (W4V-3D4), IoU 0.805: not used |
| W4V-C2b | St Ignatius concept b | same as C1b | same | 2 | 708c7169-7186-4ee4-8f81-ca3502c5a78b | ai/raw/st-ignatius-b.png | **USED** (bigger dome, cleaner towers) |
| W4V-C3a | Holy Virgin Cathedral concept a | same as C1a | white body, rounded arched gables, deep red trim, five gold onion domes on drums with chunky crosses, arched porch | 2 | 1b8c2abe-8a9b-44bb-9a17-84e0c4bf7a3c | ai/raw/holy-virgin-a.png | **USED** |
| W4V-C3b | Holy Virgin Cathedral concept b | same as C1b | same | 2 | e1303403-1f9e-4d34-bcc7-fa25db9f5ba3 | ai/raw/holy-virgin-b.png | not meshed (domes crowded, narrow) |
| W4V-C4a | Chinese Pavilion concept a | same as C1a | open octagonal pavilion, 8 red columns, low red bench walls, grey-green glazed tile roof with upturned corners, finial, low stone floor | 2 | 9b698354-4462-445d-b6b8-d6588aa22808 | ai/raw/chinese-pavilion-a.png | **USED** (chunkier, SAM-friendly) |
| W4V-C4b | Chinese Pavilion concept b | same as C1b | same | 2 | c8c9b7d8-6c82-4cfe-a25e-afb80d5ee905 | ai/raw/chinese-pavilion-b.png | not meshed (fine fretwork beams) |
| W4V-R1 | toy open-top double-decker reference sheet | nano_banana_pro 16:9 2k, ref K6 | coral body, cream band, teal-grey windows, open upper deck with 4 bench rows, rear stair; side / front / back / top | 2 | 58a2c071-3d7c-4b48-b10e-e5b080844ef2 | vehicles/ref-tour-bus.png | USED as reference (3/4 main view; a tiny K6 streetcar leaked in beside the front wheel: ignore it) — front and back views |
| W4V-R2 | toy two-car LRV reference sheet | same | silver body, red belt line, teal-grey windows, 2 double doors per car, bellows, blank headsign, solid pantograph arm; side / front / back / top | 2 | 1641a3fd-7757-45ab-a7a7-238fbad63922 | vehicles/ref-lrv.png | **USED** as reference (all four views clean, no text) |
| W4V-S1 | T1 sticker sheet, draw 1 | nano_banana_pro 1:1 4k, refs K6 + paper crop 588c24e4 | 16 round die-cut gouache stickers, 4 × 4 in the order of STICKER_IDS | 4 | 846efbec-f889-495f-b8ad-8f7dcccff79a | stickers/sheet-1.png | runner-up (all 16 right; SF State / Stonestown weaker) |
| W4V-S2 | T1 sticker sheet, draw 2 | same | same | 4 | f313e2ed-e191-46c0-b461-7ac2612eb71b | stickers/sheet-2.png | **USED -> public/opus-bay/map/stickers-t1.{webp,json}** (read at full size row by row: no text, no letters, no logos) |

Transactions 17:17:30.765–17:17:32.769 UTC: Nano Banana Pro −2 × 10, −4 × 2 (no other spend in between). **Subtotal 28.**

## Batch 2 · SAM 3 3D meshes + one bus retake (17:22–17:24 UTC)

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-3D1 | Cal Academy mesh from C1b, try 1 | sam_3_3d textured, prompt "the toy museum building" | — | 0 (failed, refunded) | a859fafe-cbb1-480b-a9e4-616b6c897a11 | — | failed (no detection), refunded |
| W4V-3D2 | Cal Academy mesh from C1a | same | — | 0 (failed, refunded) | 07c0e940-793d-4ba0-8ebb-bc5b8eb9d98f | — | failed, refunded |
| W4V-3D3 | St Ignatius mesh from C2b | sam_3_3d, "the toy church" | 21,844 tris raw | 1 | cc596ca6-c9c4-4ded-a6d8-2daff7021918 | ai/raw/st-ignatius-b-sam.glb | **USED** |
| W4V-3D4 | St Ignatius mesh from C2a | same | 24,210 tris raw | 1 | a352bdd1-461c-4324-8b2c-c09438f6c77f | ai/raw/st-ignatius-a-sam.glb | not used (IoU 0.805 < 0.85) |
| W4V-3D5 | Holy Virgin mesh from C3a | sam_3_3d, "the toy cathedral" | 18,402 tris raw | 1 | 78e206f5-9c5b-4ede-82b2-108da5b772f8 | ai/raw/holy-virgin-a-sam.glb | **USED** |
| W4V-3D6 | Chinese Pavilion mesh from C4a | sam_3_3d, "the toy pavilion" | 27,718 tris raw | 1 | 580b0015-df30-41eb-9d11-1572a21326a3 | ai/raw/chinese-pavilion-a-sam.glb | **USED** |
| W4V-R1b | tour-bus reference retake | nano_banana_pro 16:9 2k, refs K6 + R2 (layout) | "laid out like the train sheet", orthographic side / top, nothing but the bus | 2 | 9c78c22e-92a6-4e73-958f-b69dd8853db4 | vehicles/ref-tour-bus-b.png | **USED** as reference: the clean side and top views (its second view repeats the side and the "front" is the back: use R1 for front / back) |
| W4V-3D7 | Cal Academy mesh from C1b, try 2 | sam_3_3d, "the green-roofed toy building", detection_threshold 0.3 | 13,908 tris raw | 1 | 4d8799df-4fd4-4caa-9fc8-6dfc96164e85 | ai/raw/cal-academy-b-sam.glb | **USED** |

Transactions 17:22:05–17:23:46 UTC: 3D Objects −1 × 7 with +1 × 2 refunds (17:22:08, 17:22:11 = the two failed Cal
Academy jobs), Nano Banana Pro −2 at 17:22:30. **Subtotal 7.**

**Wave-4 lane V total so far: 35.00 credits** (28 + 7) of the 120 cap. Balance 455.58 → **420.58** (`balance` at 18:20 UTC,
equal to the tally: no other lane spent in the window).

## Published from these jobs (local cleanup, free)

Pipeline `scripts/opus-sf/assets/w4/` (Blender 5.2 headless; `build.py NAME TAG`, settings in `specs.json`): D2's wave-3
landmark cleanup (weld, flat base, planar dissolve + collapse to the cap, origin at the ground centre, front → +Z) plus a
**texel re-bake** (`--rebake 1`: smart-UV-project the decimated mesh and transfer the raw colour texel by texel with a
BVH ray along the face normal; it removes the diagonal roof-tile streaks the collapse decimation smeared over side walls),
the hero palette grade (`grade.py`, per-asset hue remaps), Draco (level 6) + WebP q82, IoU sweep against the concept.

| file | tris | bytes | size w × h × d (u) | IoU | non-manifold / islands | palette ΔE12 (before → after) | status |
|---|---|---|---|---|---|---|---|
| models/sf/w4-cal-academy.glb (+ -mask.webp 7,592 B, R = glass) | 5,880 | 93,120 | 24.4 × 7.9 × 16.6 (fitted to lane L's procedural block + canopy) | 0.908 native / 0.894 as published | 0 % / 1 | 0.66 → 0.99 | published, not registered (integration) |
| models/sf/w4-st-ignatius.glb | 5,879 | 152,988 | 7.5 × 13.2 × 11.15 (fitted to lane L's procedural church) | 0.863 native / 0.807 as published (fit waiver) | 0.08 % / 1 | 0.21 → 0.92 | published, not registered |
| models/sf/w4-holy-virgin.glb | 5,880 | 184,596 | 6.10 × 9.1 × 6.69 | 0.854 | 0.23 % / 2 | 0.41 → 0.85 | published, not registered |
| models/sf/w4-chinese-pavilion.glb | 2,940 | 71,388 | 5.62 × 4.5 × 5.61 | 0.855 | 0 % / 1 | 0.25 → 0.86 | published, not registered |
| map/stickers-t1.webp + .json | — | 74,150 | 512 × 512 atlas, 16 × 124 px circles | — | — | — | published (lane P draws it) |

The Cal Academy and St Ignatius rows were first written before the fit to lane L's bounds (`--box`); the lane-V review
(2026-09-27) set them to the published files (tests/opus-bay-w4-assets.test.ts checks this table against `W4_MODELS`).

## Batch 3 · tour narration voice (W4-V6), 2026-09-27 18:29–19:30 UTC

Lane C froze `TOUR_LINES` at 9d9dab9 (tag `w4-tourlines-frozen`): 107 lines. Model `qwen_audio_tts` (Qwen Audio 3.0 TTS
Flash), preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4` (every BAYBAY clip), wav 48 kHz, `language` zh / en,
instruction = "Cute otter mascot tour guide: warm, cheerful, clear, friendly storytelling pace." + a mood note (quiet
lines: "soft, gentle and respectful, quiet and slow"), ≤ 128 characters. Take list `scripts/opus-sf/voice/w4/takes.ts`;
every take with its job id, text, rate, measurements and the pick: `docs/opus-bay/qa/w4/V/voice/tour-voice-report.json`.
Preflight `get_cost`: 0.05 for a 110-character line (billed by length, 0.01–0.04 for these lines). Raw wavs:
`C:/Users/willy/opus-qa/w4/w4-v/voice/raw/<take index>.wav`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-VO1 | 214 clips (107 lines × zh / en), take 1 | qwen_audio_tts, Pixie, speech_rate 1.0 | the frozen texts | (below) | tour-voice-report.json, `takes[].job_id` | voice/raw/<even index>.wav | 194 completed; 20 failed at the service ("failed", type image, as in wave 3); about 1 in 6 submissions answered 429 and were resubmitted |
| W4V-VO2 | the 20 failed takes, resubmitted | same | same | (below) | jobs_retry (in the report) | same paths | all completed |
| W4V-VO3 | 16 retakes at speech_rate 1.08 | same | the clips whose take missed a gate or the recogniser | (below) | jobs_r2 (in the report) | voice/raw/<odd index>.wav | 5 of them became the pick |

Transactions 18:29:40–19:29:39 UTC: only "Qwen Audio 3.0 TTS Flash" spends (0.01–0.04 each) and refunds (the 429 /
failed submissions), at the times of this lane's batches; no other lane spent in the window. **Subtotal 5.45 credits**
(balance 420.58 → 415.13).

**Wave-4 lane V total: 40.45 credits** (35.00 images + 3D, 5.45 voice) of the 120 cap. Balance 455.58 → **415.13**
(`balance`, 2026-09-27 ≈ 20:05 UTC).

Published: `public/opus-bay/voice/sf/tour/<lang>-<id>.m4a` + `.ogg` (214 × 2 files, 2.2–8.1 s, 17 MB), all picks pass the
gates (no clipping, not cut, pauses, pitch, speaking rate with numbers counted as read), the recogniser heard 203 of 214
right; `src/opus-bay/data/sf/voiceTour.ts` (generated); previews and the owner's sheet in `docs/opus-bay/qa/w4/V/voice/`.
