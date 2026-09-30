# Wave 7 · lane V ledger (Higgsfield)

Lane V (models, characters, vehicles, effects), worktree `C:/Users/willy/wt/w7-v`. The owner (2026-09-29 ≈ 20:30 PDT):
"尽情用 higgsfield 上能用的工具，分数随便用" — no cap; a practical reserve of 200 credits stays. Lane X spends in parallel
with its own ledger (`ledger/w7-X.md`), so the account balance below can drop by more than this lane's rows; the per-job
credits are the authoritative tally for lane V. Raw downloads: `C:/Users/willy/opus-qa/w7/v/raw/`.
Output base URL: `https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/` + the file name.

## Balances

| when (UTC) | balance | note |
|---|---|---|
| 2026-09-30 03:40 | 2247.50 | lane start (20:40 PDT) |
| 2026-09-30 03:50 | 2247.50 | before batch 1 |

## Batch 1 · particle sprites and a plush texture (nano_banana_pro, 1:1 1k, 2 credits each; preflight 2)

Prompt frame for the sprites: "A single hand-painted white gouache game-effect sprite, centered, on a pure flat black
background (#000000): <subject>. Soft painterly brush texture with visible bristle strokes …, like a charming handcrafted
toy-diorama video game. The shape fills about 70–80% of the frame with an even black margin all around. Monochrome white
only on black. No text, no letters, no logos, no watermark, no border, no drop shadow."

| # | UTC | job | subject | credits | output file | local | verdict |
|---|---|---|---|---|---|---|---|
| V1 | 03:50 | fee442c4 | four-pointed star glint | 2 | hf_20260930_035045_fee442c4-f305-48ac-9395-bb17ae013f54.png | raw/s0-star.png | kept: atlas cell star |
| V2 | 03:50 | b284cf5a | billowing dust puff | 2 | hf_20260930_035045_b284cf5a-4f0c-48c4-8aed-4a292382c184.png | raw/s1-puff.png | kept: atlas cell cloud |
| V3 | 03:50 | 3f75d704 | water droplet | 2 | hf_20260930_035045_3f75d704-083e-4ead-bc11-e2ea0b7ed8c1.png | raw/s2-drop.png | kept: atlas cell droplet |
| V4 | 03:50 | ea84c459 | foam ring from above | 2 | hf_20260930_035045_ea84c459-d70b-4c5a-b953-243a0ad57581.png | raw/s3-foam.png | kept: atlas cell foam |
| V5 | 03:50 | ea729d6d | fog wisp | 2 | hf_20260930_035045_ea729d6d-204c-4da5-aa24-96f69c97a857.png | raw/s4-wisp.png | kept: atlas cells puff + wisp (dark-grey ground levelled) |
| V6 | 03:50 | da4924f6 | heart | 2 | hf_20260930_035045_da4924f6-8707-4985-ab6f-9c59fc792e9d.png | raw/s5-heart.png | kept: atlas cell heart |
| V7 | 03:50 | 79aa08f9 | music note | 2 | hf_20260930_035045_79aa08f9-6015-43da-a9f6-3aa6f1319792.png | raw/s6-note.png | kept: atlas cell note |
| V8 | 03:50 | cfafa074 | confetti curl | 2 | hf_20260930_035045_cfafa074-eb53-4a2f-b579-9cab03045ea0.png | raw/s7-confetti.png | kept: atlas cell confetti |
| V9 | 03:50 | fcdecca9 | light glow / flare | 2 | hf_20260930_035045_fcdecca9-c6b2-483e-9889-976f88e7857b.png | raw/s8-flare.png | kept: atlas cell flare |
| V10 | 03:50 | 3eb56fe8 | leaf | 2 | hf_20260930_035045_3eb56fe8-d62b-437f-9299-5e69315740ae.png | raw/s9-leaf.png | kept: atlas cell leaf |
| V11 | 03:50 | b9a5fe99 | tileable felt (plush toy) | 2 | hf_20260930_035045_b9a5fe99-001a-47cf-a3e2-f173398de41e.png | raw/t0-felt.png | see part b |
| V12 | 03:50 | 3a81a0aa | tileable minky plush | 2 | hf_20260930_035046_3a81a0aa-9739-4a90-a84b-563828ec44f7.png | raw/t1-plush.png | see part b |

Batch 1 subtotal: 24 credits.

## Batch 2 · the de Young's Hamon tower (W7-V4; lane R's scorecard #22)

Balance before: 2223.50 (03:55 UTC, after batch 1). Concept prompts: the wave-4 landmark recipe
(`scripts/opus-sf/assets/w4/prompts.py`: PRE_A + subject + ADDON + colours; refs K6 `3617006b` and the rotunda concept
`fba12f36` for a, K6 only + the style contract for b). SAM 3 3D prompt: "the twisted copper tower" / "the brown tower".

| # | UTC | job | tool / model | credits | output file | local | verdict |
|---|---|---|---|---|---|---|---|
| V13 | 04:44 | e684912e | nano_banana_pro 1:1 2k, refs K6 + rotunda | 2 | hf_20260930_044455_e684912e-e9a4-4df7-b084-7e228d6c734e.png | raw/dy-a.png | kept: the concept (twist, perforated + dimpled copper, glass top) |
| V14 | 04:44 | 63b4fc5d | nano_banana_pro 1:1 2k, ref K6 | 2 | hf_20260930_044455_63b4fc5d-6f96-4dfc-8ce7-f67b5e3ebaae.png | raw/dy-b.png | rejected: a square shaft, not the slab |
| V15 | 04:46 | 3b46e279 | sam_3_3d on V13 | 1 (failed: no object) | — | — | failed (refund expected; see the reconciliation) |
| V16 | 04:47 | f066422b | sam_3_3d on V14 | 1 | hf_20260930_044713_f066422b-4d0c-4265-8b74-565692cd3287.glb | ai/raw/dy-b-sam.glb | rejected with V14 |
| V17 | 04:48 | d81df52a | sam_3_3d on V13 ("the brown tower") | 1 | hf_20260930_044801_d81df52a-f10c-4868-a6c5-c3cf9089f900.glb | ai/raw/dy-a-sam.glb | kept → `w7v-de-young-tower.glb` (3,920 tris, 100,532 B) |

Balance after: 2217.13 (05:02 UTC; lane X's voice jobs run in parallel, so the drop is not all this batch).
