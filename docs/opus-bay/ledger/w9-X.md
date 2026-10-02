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
