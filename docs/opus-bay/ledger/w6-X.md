# Wave 6 · lane X credit ledger (Halloween postcards, voice, key art, visual upgrades)

Cap **1000** credits for wave 6, lane X only (lead note `sf-w6-lead.md` §1 / §3 / §6, owner-approved); **the balance
never goes under 1375**. A generated asset ships only if it beats what is there (side by side). Rules as wave 5
(`ledger/w5-V.md`): reject any draw with text, logos, a base or clipped edges before paying for the next step; no image of
a real person, real insignia, a real mural or artwork, or a brand. Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account
is shared: charges are attributed by job id and time from `transactions`, never by the balance difference alone.

## Preflight, 2026-09-29 08:55 UTC

- `balance` **2375** (ultra), equal to the lead's day-0 reading (2026-09-29 08:36 UTC: a 2000 "Credit Reset Bonus" on 375).
- `transactions` (newest 10 read): nothing after the grant at **2026-09-29 08:36:21 UTC** — the wave-6 mark (the last
  spend before it: wave 5's batch-4 TTS at 2026-09-28 21:52:17 UTC).
- Nano Banana Pro: 2 credits a draw at 2k (wave 5's preflight; confirmed by the charges below).

## Batch 1 · the Halloween postcard set (W6-X2), 2026-09-29 08:57–09:00 UTC

Balance before: 2375. The recipe of every shipped postcard (ASSETS-LEDGER T1-1…13, W4V-P1…P4, W5V-P1…P6):
nano_banana_pro 4:3 2k, refs P5 `df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433`,
subject + no-text line + full-frame line + FULL_BLEED + LOOK + the style contract with its light set to "warm glowing lantern
light in a soft blue dusk" (`scripts/opus-sf/assets/w6/prompts.py` → `prompts.json`, verbatim). Served as `nano_banana_2`,
billed "Nano Banana Pro". Every draw read at full size (no letters, numbers or logos; no human faces; candy wrappers
patterned only).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W6X-P1 | halloween-pumpkin-hunt | nano_banana_pro 4:3 2k, refs P5 + P13 | a park hill heaped with smiling jack-o'-lanterns at dusk, paper lanterns, Victorians and the city beyond, bats | 2 | 143b96dc-0bd4-468f-9757-fb98b7548b9a | raw/halloween-pumpkin-hunt-a.png | **USED** |
| W6X-P2 | halloween-trick-or-treat | same | a Victorian stoop, orange porch light, candy bowl, three jack-o'-lanterns, witch hat + ghost sheet on the railing | 2 | 686f114a-2f38-433e-aad7-fb0721970987 | raw/halloween-trick-or-treat-a.png | **USED** |
| W6X-P3a | halloween-big-night, draw a | same | the Painted Ladies on Halloween night, jack-o'-lanterns on every stoop, moon, bats, trick-or-treaters from behind | 2 | 92eefaaa-4c5a-4a98-9829-b55275134234 | raw/halloween-big-night-a.png | rejected (the blue night backdrop ends in a cut edge on the cream void at the right; the slab's front edge shows) |
| W6X-P4 | muertos-mission | same | a small community altar under marigold arches in the Mission, candles, bread, fruit, sugar skulls, papel picado | 2 | 965a37dc-11eb-45db-b26d-1989adda9396 | raw/muertos-mission-a.png | **USED** (banners' cut patterns only; the altar's small frame holds a candle) |
| W6X-P3b | halloween-big-night, draw b | same + "seen from the grass of the park hill itself … the night sky fills the whole top of the frame … no backdrop edge" (`prompts.json` `retakes`) | same | 2 | f65fac80-bb2e-4d56-82bb-fe914a80bdd6 | raw/halloween-big-night-b.png | **USED** |

Transactions 08:57:47.673 / 47.920 / 48.204 / 48.851 UTC (Nano Banana Pro −2 × 4) and 09:00:14.256 (−2); no refund, no other
spend in the window. **Subtotal 10.00** (balance 2375 → **2365**, `balance` at 09:02 UTC, equal to the tally). Local raw
files: `C:/Users/willy/opus-qa/w6/x/raw/`. Published (free, `scripts/opus-sf/assets/w6/postcards.py`: centre-crop 4:3, 1200
+ 600 WebP q82): `public/opus-bay/w6/postcards/<id>-{1200,600}.webp` (8 files, 501 KB), listed in
`src/opus-bay/data/sf/halloweenPostcards.ts`.

**Wave-6 lane X running total after batch 1: 10.00 credits.** Balance **2365**.
