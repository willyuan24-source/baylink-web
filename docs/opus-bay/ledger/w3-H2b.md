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
