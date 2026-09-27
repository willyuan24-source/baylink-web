# Wave 3 · lane H2b credit ledger (painted map, voice lines, murals)

Cap 150 credits for the lane (lead note §4). Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account is shared by the
parallel wave-3 lanes: charges are attributed by job id and time from `transactions`, never by the balance difference
alone.

## Part a · preflight (H2b-1), 2026-09-27 07:35–07:40 UTC

- `balance` 498.28 (ultra plan); newest transaction before this lane: Voiceover −0.6 at 2026-09-27 05:00:14 UTC (the
  wave-2 mark).
- CDN: `curl` of K6 (`hf_20260925_223758_3617006b-….png`) → HTTP 200, 6,390,343 B (same bytes as
  `C:/Users/willy/opus-qa/assets-work/raw/key-wide-d.png`).
- Upload path: `media_upload` → presigned S3 PUT (`fast-and-furious-input-prod-….s3.amazonaws.com`, eu-north-1) → HTTP
  200 → `media_confirm` "uploaded" (1 × 1 PNG, media a1ea32a2-253e-496c-9a45-c52e3b7fef9a). Free.
- Scratch venv `C:/Users/willy/opus-qa/w3/h2b/venv` (Python 3.14): imageio-ffmpeg 0.x (ffmpeg 7.1), Pillow 12.3 (WebP
  on), numpy 2.5, scipy 1.18, opencv-python-headless 5.0.
- Preflight costs (`get_cost`): nano_banana_pro 4k = 4, seedream_v4_5 high = 1, seedream_v5_pro 2k inpaint = 2.5.

Reference media (free uploads): base render `388a9f83-d610-4dea-957c-a7e7b26ab43a` (base-4096 as JPEG q95, from
`scripts/opus-sf/map/render-base.ts` at c10f28f), `90a9210d-f106-4d9e-9b2b-e9c1259c94d1` (base-2048 PNG, spare);
style reference K6 = prior job `3617006b-483d-4ea7-9e72-39b681f8264f` (passed as a job id, no upload).

## Part a · T2 painted whole-SF map (H2b-3)

Balance before the batch: 498.28 (07:53 UTC).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| H2b-T2-1 | painted map, diorama variant A | nano_banana_pro (served nano_banana_2), 1:1, 4k; refs: base 388a9f83 + K6 3617006b | "repaint the FIRST image as a handcrafted miniature clay diorama seen straight from above; keep every coast / pier / park / street; cream table, teal resin board; K6 = materials + palette only; no text" | 4 | ad933d4f-91a6-4e1d-9635-8057dfcf7490 | C:/Users/willy/opus-qa/w3/h2b/cand/c1.png (4096²) | passed the coast gate (p95 15.0 / 9.8 px) but 3D towers and extrusions lean over the streets and the GGB runs on to the board edge: runner-up, not shipped |
| H2b-T2-2 | painted map, diorama variant A (second draw) | same as T2-1 | same | 4 | 4089cdee-3396-4122-8bf1-69f67a3270d5 | cand/c2.png | rejected: invented a Marin headland for the Golden Gate Bridge (coast p95 293 px) |
| H2b-T2-3 | painted map, gouache / watercolour variant B | nano_banana_pro (served nano_banana_2), 1:1, 4k; refs: base + K6 | "trace the FIRST image into a hand-painted illustrated map, gouache and soft watercolour on cream paper; exact base map; cozy toy town of tiny house dabs; K6 = palette + charm only; no text of any kind" | 4 | ad4bd486-a8f1-44e6-809c-852317157ff7 | cand/c3.png | rejected narrowly: two invented piers off Ocean Beach (coast p95 33.3 px > 30.7) |
| H2b-T2-4 | painted map, gouache / watercolour variant B (second draw) | same as T2-3 | same | 4 | aebf64b4-e9c9-4931-9959-dc0499974082 | cand/c4.png | **USED -> public/opus-bay/map/paper-v1-{1024,2048,4096}.webp** (coast p95 12.0 / 6.4 px; pseudo-letters on the hero lots and one Bayview lot wiped by paper_post.py --smooth-hero --declutter) |
| H2b-T2-5 | painted map, diorama (Seedream) | seedream_v4_5, quality high, 1:1; refs: base + K6 | variant A wording for Seedream ("image 1" / "image 2") | 1 | 1cab5a86-851e-4267-823f-ff355db6a5ab | cand/c5.png | rejected: a perspective toy diorama that ignores the layout |
| H2b-T2-6 | painted map, watercolour (Seedream) | seedream_v4_5, quality high, 1:1; refs: base + K6 | variant B wording for Seedream | 1 | e5f7bdeb-4a96-4fc5-bf1c-63703ea1d23b | cand/c6.png | rejected: re-imagined city, bridges moved, wrong outline |
| H2b-T2-7 | painted map, clay inpaint | seedream_v5_pro, 2k, is_inpaint, 1:1; ref: base only | "restyle this top-down map as a handcrafted miniature clay diorama without moving anything …; no text" | 2.5 | 2b6de989-b9c6-42d8-85b7-0b590d96112b | cand/c7.png (2048²) | passed the gate (p95 24.3 / 22.0 px) but blobby clay at 2048: not shipped |

Transactions (07:54:55–07:54:56 UTC, no other spend in between): Nano Banana Pro −4 ×4, Seedream 4.5 −1 ×2,
Seedream 5.0 Pro −2.5 ×1. **Subtotal T2: 20.5 credits.** Balance 498.28 → 477.78. No retake round (c4 passed).
Downloads: the CDN reset the connection on 5 of the first 7 GETs (curl error 35) and served all of them on retry.

## Part b · voice lines (H2b-6/7/8), 2026-09-27 08:37–09:06 UTC

Model qwen_audio_tts (Qwen Audio 3.0 TTS Flash), preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz,
`language` zh / en, instruction = the shipped district instruction ("Cute otter mascot: warm, cheerful, bright but not
shrill; snappy playful delivery.") + one mood note (the service caps an instruction at 128 characters). `get_cost`
0.01 per job (longer texts are billed 0.02). Take list: `scripts/opus-sf/voice/takes.ts`; every job id with its text,
instruction, seed and speech rate: `docs/opus-bay/h2b/voice-takes.json`; measurements and picks:
`docs/opus-bay/h2b/voice-report.json`. Raw wavs: `C:/Users/willy/opus-qa/w3/h2b/voice/raw/<index>.wav`.

Balance before: 477.78 (08:37 UTC; the last spend before was H2b-T2 at 07:54:56).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| H2b-V1 | 20 city lines × zh / en, 3 takes each | qwen_audio_tts, Pixie, wav 48k, seeds 11 / 22 / 33 (one retry on seed 44) | 8 mode firsts + 12 neighbourhood greetings (data/voiceLinesSf.ts SF_VOICE_LINES) | 120 jobs | voice-takes.json #0–119 | raw/0–119.wav | picks below |
| H2b-V2 | re-records zh-yay / zh-think / zh-arrived, 2 phrasings × 3 seeds | same, note per word ("crisp 好 (hǎo), bright high 耶" …) | 好耶！ 好耶～！ · 嗯…让我想想 嗯——让我想想。 · 到啦！ 到啦～！ | 18 jobs | voice-takes.json #120–137 | raw/120–137.wav | picks below |
| H2b-V3 | round 2: 14 clips over 2 s or with < 2 distinct passing takes, 3 speech rates each; re-record phrasings | same, seed 11, speech_rate 1.1 / 1.2 / 1.3 (re-records 0.9–1.15) | the same texts; 好耶好耶！, 我们到啦！, 嗯，让我想想。 | 53 jobs | voice-takes.json #138–190 | raw/138–190.wav | picks below |
| H2b-V-fail | 33 submissions the service failed (status failed, 'type image' in the job record) | same | retried with the same parameters (#20 on seed 44) | 0 (all refunded) | 3082fe18, 90ffa0a1, 7400876e, 4a44ea29, a2539c81, c3d824ef, e3b84649, fdc26e9b, a7069b0b, ad95281e, d6c1e6f8, 2edfb3a3, 1482ddc8, 33a80f19, 7177f00e, f9d20872, ced9009f, 6668e867, 6f7d8ac7, 01ee342b, b1c573b5, cf1b5001, ee36947e, 77d48a36, 3d9e685f, 48e55218, 825353cd, 248106ce, ec41663a, bc312beb, cd12c904, 776077e5, c766f287 | - | refunded |

Picks (clip → job id prefix): zh-first-bike 6a826864, zh-first-car 5919e43c, zh-first-cable-car 8edbea5b, zh-first-streetcar aea6933b, zh-first-ferry a698a207, zh-first-glide fc43304a, zh-first-hill 4e6c0b5c, zh-first-crest a8ea813c; en-first-bike db9a068e, en-first-car b349ce05, en-first-cable-car 4c63bd08, en-first-streetcar 851acf7f, en-first-ferry e0a6e81e, en-first-glide 6e400d50, en-first-hill d96dd651, en-first-crest 859b1e91; zh-zone-chinatown cb837ad5, zh-zone-north-beach 43da724b, zh-zone-mission 5b2ecdb2, zh-zone-castro-upper-market e3c79b4a, zh-zone-haight-ashbury 0497bd1b, zh-zone-marina 23922e5e, zh-zone-twin-peaks 72f1e530, zh-zone-golden-gate-park 325c70a8, zh-zone-financial-district-south-beach 54c19945, zh-zone-presidio b05ef19a, zh-zone-nob-hill bdb7f4cd, zh-zone-sunset-parkside 8682a5cb; en-zone-chinatown 9974cc47, en-zone-north-beach 5073e4df, en-zone-mission 08c00c54, en-zone-castro-upper-market 7cf37dba, en-zone-haight-ashbury b1231999, en-zone-marina d2f81d27, en-zone-twin-peaks a2d56d95, en-zone-golden-gate-park 83d5a94f, en-zone-financial-district-south-beach 40b86cad, en-zone-presidio d4a9c9a6, en-zone-nob-hill 1825efe1, en-zone-sunset-parkside f82c740e; zh-yay 0a4d3369, zh-think d41595dc, zh-arrived f1b2ead6. Full ids in voice-report.json.

Transactions 08:37:56–09:05:45 UTC: only "Qwen Audio 3.0 TTS Flash" (224 submitted jobs at 0.01–0.02 each: 191 completed, 33 failed and refunded); no other lane spent in between. **Subtotal voice: 2.06 credits.** Balance 477.78 → 475.72 (`balance` at 09:07 UTC). Notes: the service often ignores the seed (byte-identical files for two or three of the seeds 11 / 22 / 33 on 14 of 46 text groups), so round 2 varied `speech_rate`; batches of 12 hit HTTP 429 (rate limit) — batches of 10 mostly pass.
