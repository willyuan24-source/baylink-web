# Wave 7 · lane X credit ledger (voice, visual upgrades)

Cap **800** credits for wave 7, lane X only (lead note `sf-w7-lead.md` §1 / §3 / §6); **the balance never goes under
1400**. A generated asset ships only if a side-by-side shot beats what is there. Rules as waves 5–6 (`ledger/w6-X.md`):
reject any draw with text, logos, a base or clipped edges before paying for the next step; no image of a real person,
real insignia, a real mural or artwork, or a brand. The account is shared: charges are attributed by job id and time from
`transactions`, never by the balance difference alone.

## Preflight, 2026-09-30 04:31 UTC (2026-09-29 21:31 PDT)

- `balance` **2223.5** (ultra). The lead's day-0 reading was 2247.5 (2026-09-29 20:10 PDT = 03:10 UTC).
- `transactions` (newest 20 read): **12 × "Nano Banana Pro" −2 at 2026-09-30 03:50:45.50–03:50:46.62 UTC** (= 24.00
  credits, 20:50 PDT) — **not lane X** (this lane had submitted nothing by then; its first job is below). Before them:
  8 × "Kling v3.0" −8.75 at 00:05 UTC (before wave 7's day 0, already in the lead's 2247.5). Both are other work on the
  shared account; they are listed here only so the balance reconciles.
- Wave-7 lane X running total before its first batch: **0.00**. Floor 1400 → lane X may spend at most 800 (cap).

**Correction (00:25 PDT):** the 12 × Nano Banana Pro at 03:50 UTC (24.00) are **lane V's** batch 1 (`ledger/w7-V.md`,
"balance 2247.5 → 2223.5"), not other work outside the wave.

## Batch 1 · BAYBAY's voice, the lines no batch had (W7-X2), 2026-09-30 04:54–06:05 UTC

Balance before: 2223.5 (04:31 UTC). Model `qwen_audio_tts` (Qwen Audio 3.0 TTS Flash), preset "Pixie"
`0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz, W5-V7's instruction + a mood note, speech_rate 1.0 (retakes 1.0 / 1.1).
Lines: `scripts/opus-sf/voice/w7/lines.ts` (50 lines × zh / en = 100 clips) + 22 retake takes of 11 wave-6 clips. Every
take with its job id, text, measurements and the pick: `docs/opus-bay/qa/w7/X/voice/w7-voice-report.json`; job ids
`C:/Users/willy/opus-qa/w7/x/voice/jobs1.txt`, `jobs2.txt`; raw wavs `…/voice/raw/<index>.wav`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W7X-VO1 | 100 clips (50 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | the lanes' fixed bubble lines, verbatim | 0.01–0.05 each | w7-voice-report.json `takes[].job_id` | raw/0–99.wav | 100 used (93 pass the gates, 7 muted: W7_VOICE_CHECK) |
| W7X-VO2 | 22 retake takes (11 wave-6 clips × 2) | same, rate 1.0 / 1.1 | the wave-6 texts, verbatim | 0.01–0.05 each | same | raw/100–121.wav | 3 replace wave 6 (zh-w6g-street-fair-oaks, zh-w6-h-hunt-all, en-w6-h-hunt-20), 8 rejected (wave 6 stays) |
| — | 27 jobs the service failed ("failed", refunded) + 10 submissions answered 429 (nothing charged) | — | — | refunded | jobs1 / jobs2 | — | resubmitted (jobs2.txt) |

## Batch 2 · wave 7's new lines (W7-X3), 2026-09-30 06:47–06:56 UTC

76 takes: 38 lines × zh / en — lane W2's hide & seek `被你找到啦！`, 放风筝 and 那是什么？ lines (play/), lane G's
`W7_HALLOWEEN_LINES` (2), lane H's `W7_WORLD_LINES` (9), lane S's four own lines (`realsf-calendar-*`, `realsf-jets-blue`).
Same model and voice; the Día de los Muertos / procession and the Alcatraz sunrise lines with "Soft, gentle and
respectful." Job ids `…/voice/jobs3.txt`; 7 submissions answered 429 and were resubmitted; 0 failed jobs.

**Reconciliation (00:25 PDT):** `balance` **2213.87**. `transactions` (newest 200 read) shows, after 03:50 UTC, only
"Qwen Audio 3.0 TTS Flash" rows (spend 0.01–0.05, and refunds for the failed jobs) from 04:54 to 06:56 UTC — lane X's —
plus whatever lane V spent after its batch 1 (its own ledger). Lane X's net TTS spend is ≈ 3–4 credits (≈ 235 charged
takes at 0.01–0.05, minus the refunds); the exact row-by-row sum and the split against `ledger/w7-V.md` is left to the
hand-off (Requests). **Wave-7 lane X running total ≈ 4 credits**, far under the cap; balance ≫ floor 1400.
