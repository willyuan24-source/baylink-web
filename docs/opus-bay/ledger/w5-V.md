# Wave 5 · lane V credit ledger (voice, shop tiles, secret postcards, reference sheets, textures)

Cap **130** credits for wave 5, lane V only (plan §5, lead note §8); **the balance never goes under 250**. Stop rules
(plan §5): reject any draw with text, logos, a base or clipped edges before paying for the next step; two failed models
in a row → no more models; spend past 100 → only H5-1, H5-3 and H5-8 continue. No image of a real person, real insignia,
a real mural or artwork, or a brand. Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account is shared: charges are
attributed by job id and time from `transactions`, never by the balance difference alone.

## Preflight (part b), 2026-09-28 13:10 UTC

- `balance` **400.07** (ultra), equal to the lead's day-0 reading (2026-09-28 08:37 UTC).
- `transactions` (newest 15 read): nothing since **2026-09-28 01:26:49 UTC** (wave 4's last voice fix) — the wave-5 mark.
- Cost preflight (`get_cost`, free): Qwen Audio 3.0 TTS Flash, a 28-character zh line = **0.02**.

## Batch 1 · H5-3 voice, the lanes' wave-5 BAYBAY lines (W5-V7), 2026-09-28 13:15–13:31 UTC

Lines: `scripts/opus-sf/voice/w5/lines.ts` over the lanes' sources at `da331c9` (lane A play/, lane C pelican / goals /
flow's two nudges, lane N goToRun, lane D eggs/ + the registry's lines, rumours and fortunes, lane R's fire-season line):
**95 lines × zh / en = 190 clips**. Model `qwen_audio_tts` (Qwen Audio 3.0 TTS Flash), preset "Pixie"
`0178ef57-ada4-43d9-992b-8d9221045bb4` (every BAYBAY clip), wav 48 kHz, speech_rate 1.0, `language` zh / en, instruction
= "Cute otter mascot talking to a friend: warm, cheerful, natural, clear, easy chatty pace." + a mood note from the
line's punctuation (≤ 128 characters). One take per clip; post.py lists the retakes. Every take with its job id, text,
measurements and the pick: `docs/opus-bay/qa/w5/V/voice/w5-voice-report.json`. Raw wavs:
`C:/Users/willy/opus-qa/w5/w5-v/voice/raw/<take index>.wav` (job ids in `jobs.txt` beside them).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO1 | 190 clips (95 lines × zh / en), one take each | qwen_audio_tts, Pixie, speech_rate 1.0, wav 48 kHz | the lanes' fixed bubble lines, verbatim | 4.54 (below) | w5-voice-report.json `takes[].job_id` (190 ids) | voice/raw/0–189.wav | 190 completed; 2 submissions answered 429 (rate limit, nothing charged) and were resubmitted in the last batch (takes 6 and 158) |

Transactions 13:15:10.778–13:31:33.149 UTC: exactly 190 "Qwen Audio 3.0 TTS Flash" spends of 0.01–0.04 (by length),
no refund, no other spend on the account in the window. **Subtotal 4.54 credits** (balance 400.07 → **395.53**,
`balance` at 13:40 UTC, equal to the tally). CDN check: every result is
`d8j0ntlcm91z4.cloudfront.net/user_…/hf_20260928_<hhmmss>_<job id>.wav`; 190 / 190 downloaded (the timestamps from
`jobs_wait`, the rest probed within ±8 s of their batch; 8 needed their exact timestamp from `jobs_wait`).

**Wave-5 lane V running total after batch 1: 4.54 credits.** Balance **395.53**.

## Batch 2 · H5-2 six 彩蛋明信片 (secret postcards, W5-V8), 2026-09-28 13:44–13:48 UTC

Balance before: 395.53. The recipe of every shipped postcard (ASSETS-LEDGER T1-1…13, wave-4 W4V-P1…P4): nano_banana_pro
4:3 2k, refs P5 `df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433`, subject + "Full-bleed
illustration … NOT a card …" + the look line + the style contract (`scripts/opus-sf/assets/w5/prompts.py` →
`prompts.json`, verbatim). Cost preflight: 2 credits a draw. Served as `nano_banana_2`, billed "Nano Banana Pro". Every
draw read at full size (no text, no letters, no numbers, no logos, no faces; the pennants and stones blank).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-P1a | china-beach-fishermen, draw a | nano_banana_pro 4:3 2k, refs P5 + P13 | China Beach cove at golden hour, two old Chinese fishing junks, the GGB far off | 2 | 0b5be7de-eabe-4def-baed-3d41f4bf608e | postcards/china-beach-fishermen-a.png | rejected (a floating diorama slab with its side edges on the cream void — wave 4's sf-west-portal fault) |
| W5V-P2 | telegraph-hill-parrots | same | the Filbert Steps' gardens, a flock of red-headed green parrots, Coit Tower on top | 2 | 67c26ab7-14d4-4891-9890-e9c4a1224ef6 | postcards/telegraph-hill-parrots-a.png | **USED** |
| W5V-P3 | wave-organ-high-tide | same | the jetty tip's carved stones, benches and short pipes, high-tide splashes, the GGB beyond | 2 | 88affc80-7d52-4052-98b0-5fbda22b6c8c | postcards/wave-organ-high-tide-a.png | **USED** (generic stones and pipes, no copy of the installation) |
| W5V-P4a | lands-end-labyrinth, draw a | same | a ring labyrinth of pale stones on a headland, cypresses, the GGB across the strait | 2 | 80816964-ef15-4a44-9e62-e45cecac4162 | postcards/lands-end-labyrinth-a.png | rejected (the headland on a board whose edge shows) |
| W5V-P5 | dahlia-dell-100 | same | a dahlia bed in full bloom, blank paper pennants, the white Conservatory of Flowers | 2 | 7e4d896a-53c3-490d-a5d9-34e04f69c336 | postcards/dahlia-dell-100-a.png | **USED** (pennants blank at full size) |
| W5V-P6 | ggb-foghorn-duet | same | the two towers and cables above a bank of summer fog, the Marin headlands | 2 | 27dd11b6-2ae3-41ea-a7d5-22c5e2aaa4a6 | postcards/ggb-foghorn-duet-a.png | **USED** |
| W5V-P1b | china-beach-fishermen, draw b | same + "seen from the sand of the cove itself so that the scene fills the whole frame … No floating slab, no base edge, no cream void" | same | 2 | c77ec4c6-80bf-411d-98ab-c8bab14c1ee5 | postcards/china-beach-fishermen-b.png | **USED** |
| W5V-P4b | lands-end-labyrinth, draw b | same + "seen from the cliff path beside it …" + the full-frame line | same | 2 | 96d73e71-c98f-4f1c-ae9c-0ce94554f567 | postcards/lands-end-labyrinth-b.png | **USED** |

Transactions 13:44:16.728–13:44:25.470 UTC (Nano Banana Pro −2 × 6) and 13:48:03.700 / 13:48:04.605 (−2 × 2); no refund,
no other spend in the window. **Subtotal 16.00** (8 draws; the plan's 1.75 × retake factor allowed 21). Local raw files:
`C:/Users/willy/opus-qa/w5/w5-v/postcards/`. Published (free, `scripts/opus-sf/assets/w5/postcards.py`: centre-crop 4:3,
1200 + 600 WebP q82): `public/opus-bay/w5/postcards/<egg id>-{1200,600}.webp` (12 files, 752 KB), listed in
`src/opus-bay/data/sf/eggPostcards.ts`.

## Batch 3 · H5-3 voice retakes (W5-V7), 2026-09-28 13:57 UTC

The 10 clips whose take missed a gate (1: zh 看，云在慢慢走～, spoken too slowly) or the recogniser (9) after the grammar
fix (post.py `speakable`: a `"` inside the recogniser's command line had broke its whole zh grammar on the first pass),
retaken once at speech_rate 1.08 (take indices 190–199, `jobs_r2.txt`), same model, preset and instruction.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO2 | 10 retakes | qwen_audio_tts, Pixie, speech_rate 1.08 | the same texts | 0.18 | w5-voice-report.json `takes[].job_id` (indices 190–199) | voice/raw/190–199.wav | the picks: see the report |

Transactions 13:57:39.775–13:57:47.144 UTC: 10 "Qwen Audio 3.0 TTS Flash" spends (0.01–0.04), no refund, nothing else
in the window. **Subtotal 0.18.**

**Wave-5 lane V total: 20.72 credits** (4.54 + 16.00 + 0.18) of the 130 cap. Balance 400.07 → **379.35** (`balance` at
14:02 UTC, equal to the tally).
