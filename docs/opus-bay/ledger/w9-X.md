# Wave 9 · lane X credit ledger (voice)

Cap **60** credits for wave 9, lane X (lead note `sf-w9-lead.md` §3 X / §6); the shared balance never goes under **20**.
Voice only (`qwen_audio_tts`, the preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz, W5-V7's instruction +
a mood note), as waves 5–8 (`ledger/w8-X.md`). The account is shared with other lanes and projects: charges are
attributed by job id and time from `transactions`, never by the balance difference alone. Times UTC (PDT = UTC − 7).

## Preflight, 2026-10-02 05:00 UTC (2026-10-01 22:00 PDT)

- `balance` **357.27** (ultra) — the same as the lead's day-0 reading (2026-10-01 05:30 PDT): nothing was charged in
  between.
- Wave-9 lane X running total before its first batch: **0.00**.

## Batch 1 · wave 8's two unrecorded lines + three reworded / new lines (W9-X3), 2026-10-02 05:40–05:43 UTC

Balance before: **357.27** (05:00 and 05:40 UTC). The take list: `scripts/opus-sf/voice/w9/lines.ts --takes … --batch 1`
(5 lines × zh / en = 10 takes, speech_rate 1.0), scratch `C:/Users/willy/opus-qa/w9/x/voice1/` (`takes.json`, `jobs1.txt`,
`jobs2.txt` = the resubmission, `got.txt`, `raw/`). Every take's measurements and the pick:
`docs/opus-bay/qa/w9/X/voice/w9-voice-report.json`.

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W9X-VO1 | 10 clips (5 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0, wav 48 kHz | `GRIP_LINES.short`, `SLED_LINES.short`, `LAKE_LINES.since` (reworded), `ALCA_LINES.boardBack` (new), `w8w1-pagodas-ahead` (reworded), verbatim | 0.01–0.04 a take | below | `public/opus-bay/w9/voice/{zh,en}-<id>.{m4a,ogg}` | 10 used: **10 pass every gate**, 9 heard right by the recogniser (advisory) |

| take | clip | job id | created (UTC) | output | status |
|---|---|---|---|---|---|
| 0 | `zh-w5-a-adfb2f33` | `38ce2073-de3b-459a-98bc-89488da32ae6` | 05:40:41 | raw/0.wav | picked |
| 1 | `en-w5-a-adfb2f33` | `e192eb6e-62d7-4a75-a031-c5773b58bcfa` | 05:40:41 | raw/1.wav | picked |
| 2 | `zh-w5-a-ddd3b836` | `8768f32f-dd59-4da8-af67-825e9c52ecf2` | — | — | failed (refunded 05:40:48), resubmitted |
| 2 | `zh-w5-a-ddd3b836` | `71652e17-44a7-433a-abc1-26a0e3b9d991` | 05:42:38 | raw/2.wav | picked |
| 3 | `en-w5-a-ddd3b836` | `4a0d94fa-a215-40bb-a5dc-ce3d8b33a759` | 05:40:41 | raw/3.wav | picked |
| 4 | `zh-w5-w2-280f73fb` | `2f93bf00-82d2-4f40-ae0c-8ef6bbd832c2` | 05:40:41 | raw/4.wav | picked |
| 5 | `en-w5-w2-280f73fb` | `78bd8a03-0f42-4b06-8192-f55dae77094f` | 05:40:41 | raw/5.wav | picked |
| 6 | `zh-w5-al-3042cee4` | `c275ac1c-44d0-4f1e-88f9-8c8d12fbdb80` | 05:40:41 | raw/6.wav | picked |
| 7 | `en-w5-al-3042cee4` | `52253e20-3d45-4ec9-b066-22f1526697fb` | 05:40:41 | raw/7.wav | picked |
| 8 | `zh-w8w1-pagodas-ahead-w9` | `a5c81258-7a74-44a5-ad6f-d8694cc76fd6` | 05:40:41 | raw/8.wav | picked |
| 9 | `en-w8w1-pagodas-ahead-w9` | `c357da3b-5ede-4a1a-ba76-dd1d5cc564ae` | 05:40:41 | raw/9.wav | picked |

**Credits:** `balance` 357.27 → **357.05** = **0.22**. `transactions` (newest 20 read at 05:50 UTC): 10 spends at 05:40:41
(0.01 + 0.01 + 0.01 + 0.02 + 0.02 + 0.03 + 0.04 + 0.01 + 0.04 + 0.03 = 0.22), the refund of take 2's failed job (+0.01,
05:40:48), the resubmission (−0.01, 05:42:38); the row before is 2026-10-01 06:02 UTC (wave 8's batch 5). **Wave-9 lane X
running total: 0.22.**

## Batch 2 · the pelican's later line and the today line as fixed lines (W9-X4), 2026-10-02 06:46–06:47 UTC

Balance before: **357.05** (06:45 UTC). 4 lines × zh / en = 8 takes (indices 100–107), scratch
`C:/Users/willy/opus-qa/w9/x/voice2/`.

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W9X-VO2 | 8 clips (4 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | `PELICAN_LATER_LINE`, `TODAY_EVENT_LINE`, `TODAY_SUNSET_LINE`, `TODAY_PLAIN_LINE`, verbatim | 0.01–0.04 a take | below | `public/opus-bay/w9/voice/` | 8 used: **8 pass every gate, 8 heard right** |

| take | clip | job id | created (UTC) | output | status |
|---|---|---|---|---|---|
| 100 | `zh-w5-c-df86205a` | `29261a59-59b3-4c53-a192-714f26f4b8b7` | 06:46:31 | raw/100.wav | picked |
| 101 | `en-w5-c-df86205a` | `a97b6234-7ceb-4688-85e7-10648ee5bcfb` | 06:46:31 | raw/101.wav | picked |
| 102 | `zh-w5-r-a13d0aed` | `64d6cb57-6413-448e-b6f3-ae7bd49fb1ef` | 06:46:31 | raw/102.wav | picked |
| 103 | `en-w5-r-a13d0aed` | `6f0ad49d-2cf2-43b7-b7e9-c7514ca1e7dc` | 06:46:31 | raw/103.wav | picked |
| 104 | `zh-w5-r-abd86c7b` | `7a5571c6-ff3b-472c-8ff0-05c1195b33c2` | — | — | failed (refunded 06:46:38), resubmitted |
| 104 | `zh-w5-r-abd86c7b` | `e06eef62-f7ef-4d2b-ab1d-86f81e8e0b32` | 06:46:55 | raw/104.wav | picked |
| 105 | `en-w5-r-abd86c7b` | `03bd0ab8-ef41-4b37-9796-6c1a453769d5` | 06:46:31 | raw/105.wav | picked |
| 106 | `zh-w5-r-7d16e184` | `b2d9163d-cd49-4eee-81f7-b02b5137c721` | — | — | failed (refunded 06:46:39), resubmitted |
| 106 | `zh-w5-r-7d16e184` | `2986a400-5861-4a49-b53a-3193d70c5ef0` | 06:46:54 | raw/106.wav | picked |
| 107 | `en-w5-r-7d16e184` | `89cb415e-0804-4ffa-a4b3-e456dd6a7693` | 06:46:31 | raw/107.wav | picked |

**Credits:** `balance` 357.05 → **356.86** = **0.19**. `transactions` (newest 14 read at 06:50 UTC): 8 spends at
06:46:31–32 (0.04 + 0.04 + 0.03 + 0.01 + 0.03 + 0.01 + 0.02 + 0.01 = 0.19), 2 refunds of the failed jobs (+0.02, +0.01,
06:46:38–39), 2 resubmissions (−0.01, −0.02, 06:46:54–55); the row before is batch 1's resubmission (05:42:38). **Wave-9
lane X running total: 0.41.**

## Batch 3 · lanes H, G and N's new lines on origin at 02:50 PDT (W9-X6), 2026-10-02 10:05–10:06 UTC

Balance before: **356.86** (10:04 UTC, unchanged since batch 2). 5 lines × zh / en = 10 takes (indices 200–209), scratch
`C:/Users/willy/opus-qa/w9/x/voice3/`: lane H's three big-day greetings (`halloween/worldLines.ts` `W9_WORLD_LINES`), lane
G's hide & seek crossing line (`play/hideSeek.ts` `HIDE_LINES.crosswalk`), lane N's stuck card question (`game/tripRun.ts`
`STUCK_LINE`), verbatim as committed on origin.

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W9X-VO3 | 10 clips (5 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | `w9-h-today-festival`, `w9-h-today-big-night`, `w9-h-today-procession`, `HIDE_LINES.crosswalk`, `STUCK_LINE`, verbatim | 0.01–0.05 a take | below | `public/opus-bay/w9/voice/` | 10 used: **10 pass every gate, 10 heard right** |

| take | clip | job id | created (UTC) | output | status |
|---|---|---|---|---|---|
| 200 | `zh-w5-a-311ad20d` | `e2b64235-03ed-4974-8e4d-001c3e0d5f62` | 10:05:44 | raw/200.wav | picked |
| 201 | `en-w5-a-311ad20d` | — | — | — | submission refused (429 rate limit, no job, no charge), resubmitted |
| 201 | `en-w5-a-311ad20d` | `01ddf360-cda5-43b0-b57c-6d018220a288` | 10:06:27 | raw/201.wav | picked |
| 202 | `zh-w9-h-today-festival` | `dce145bc-2f75-4d79-83af-f0ae522ae480` | 10:05:44 | raw/202.wav | picked |
| 203 | `en-w9-h-today-festival` | `5eb24948-a3f4-456b-8408-4c89b0ecff8d` | 10:05:44 | raw/203.wav | picked |
| 204 | `zh-w9-h-today-big-night` | `bd111804-e323-4530-9397-44cd0d05c5d6` | 10:05:44 | raw/204.wav | picked |
| 205 | `en-w9-h-today-big-night` | `5d6e9da1-1533-44c1-89e3-6445a75ea5ca` | 10:05:44 | raw/205.wav | picked |
| 206 | `zh-w9-h-today-procession` | `43919865-4a34-4a05-8f80-5bd35632e910` | 10:05:44 | raw/206.wav | picked |
| 207 | `en-w9-h-today-procession` | — | — | — | submission refused (429, no job, no charge), resubmitted |
| 207 | `en-w9-h-today-procession` | `f14ff8e2-bbc3-45f3-9278-bf5d60bfcd66` | 10:06:27 | raw/207.wav | picked |
| 208 | `zh-w5-n-645daeca` | `4294b56e-4ca5-49b3-be37-a674f9cd3ef3` | — | — | failed (refunded 10:05:51–52), resubmitted |
| 208 | `zh-w5-n-645daeca` | `3e0b823c-d3b8-4529-9422-0c5d19d33d27` | 10:06:28 | raw/208.wav | picked |
| 209 | `en-w5-n-645daeca` | `812b23c2-dc1e-44f9-964f-0392bddbb0f4` | — | — | failed (refunded 10:05:51–52), resubmitted |
| 209 | `en-w5-n-645daeca` | `9fe8e650-8101-4f8b-a94a-9fb52037b076` | 10:06:27 | raw/209.wav | picked |

**Credits:** `balance` 356.86 → **356.59** = **0.27**. `transactions` (newest 20 read at 10:08 UTC): 8 spends at 10:05:44–45
(0.05 + 0.02 + 0.02 + 0.02 + 0.05 + 0.01 + 0.01 + 0.02 = 0.20), 2 refunds of the failed jobs (+0.01, +0.02, 10:05:51–52),
4 resubmissions at 10:06:27–28 (0.05 + 0.02 + 0.02 + 0.01 = 0.10): 0.20 − 0.03 + 0.10 = 0.27; the row before is batch 2's
resubmission (06:46:55): nobody else spent on the account in between. **Wave-9 lane X running total: 0.68.**
