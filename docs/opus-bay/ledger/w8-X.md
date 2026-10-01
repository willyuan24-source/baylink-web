# Wave 8 · lane X credit ledger (voice, looks, sounds)

Cap **240** credits for wave 8, lane X (lead note `sf-w8-lead.md` §6); the shared balance never goes under **20**. A
generated asset ships only if a side-by-side shot beats what is there. Rules as waves 5–7 (`ledger/w7-X.md`): reject any
draw with text, logos, a base or clipped edges before paying for the next step; no image of a real person, real insignia,
a real mural or artwork, or a brand. The account is shared with other projects and lanes W1 / W2: charges are attributed
by job id and time from `transactions`, never by the balance difference alone.

## Preflight, 2026-10-01 02:00 UTC (2026-09-30 19:00 PDT)

- `balance` **363.44** (ultra) — the lead's day-0 reading (18:42 PDT) unchanged.
- Wave-8 lane X running total before its first batch: **0.00**.

## Batch 1 · BAYBAY's voice: lane M's wave-7 games, lane K's plain bubbles, wave 7's muted clips (W8-X1), 2026-10-01 02:01–02:19 UTC

Submitted by the lane's first agent (19:00–19:20 PDT); its results were **fetched, not paid again**, by the resumed agent
(19:25 PDT: `jobs_wait` on the one take still missing, the stored result URLs for the rest). Model `qwen_audio_tts`
(Qwen Audio 3.0 TTS Flash), preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz, W5-V7's instruction + a
mood note, speech_rate 1.0 (the retakes 1.15 / 1.3). The take list: `scripts/opus-sf/voice/w8/lines.ts --takes … --retakes`
(52 lines × zh / en = 104 takes + 16 retake takes of the 8 muted wave-7 clips = 120 takes, indices 0–119). Job ids
`C:/Users/willy/opus-qa/w8/x/voice/jobs1.txt` (first submissions) and `jobs2.txt` (resubmissions of the failed ones);
raw wavs `…/voice/raw/<index>.wav`; every take's measurements and the pick: `docs/opus-bay/qa/w8/X/voice/w8-voice-report.json`.

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W8X-VO1 | 104 clips (52 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | lane M's 34 wave-7 game lines (`play/sfgamesLines.ts`: claw, crab, sourdough) + lane K's 18 plain bubbles (`game/{tripRun,transit,flow,lineRides,cityTour}.ts`), verbatim | 0.01–0.04 a take | table below | `public/opus-bay/w8/voice/{zh,en}-<id>.{m4a,ogg}` | 104 used: 99 pass every gate, **5 muted** (`W8_VOICE_CHECK`: rate gate on 金黄酥脆！完美！, 当——当——当！, 嗯～好吃！ zh + en; the clip gate on 这段路有点难走，你来带路吧！) |
| W8X-VO2 | 16 retake takes (8 muted wave-7 clips × rate 1.15 / 1.3) | same | the wave-7 texts, verbatim | 0.01–0.04 a take | table below | `public/opus-bay/w8/voice/<wave-7 clip>.{m4a,ogg}` | **7 kept** (pass + heard right → unmuted under the wave-7 id, `W8_RETAKE_CLIPS`), 1 rejected (`en-w5-a-b95c4fe2` "Ho! Spot on!": not heard, wave 7 stays muted). Take 114 (`zh-w5-a-420d6131` at 1.15) failed twice: the 1.3 take was used |
| — | 54 jobs the service failed ("failed", refunded) + 3 submissions answered 429 (no job, nothing charged: takes 54, 94, 101) | — | — | refunded | jobs1 / jobs2 | — | resubmitted once in `jobs2.txt` (take 114 failed again; takes 9 and 90 needed a third try) |

**Credits:** `balance` 363.44 (18:42 PDT) → **361.52** (19:22 and 19:26 PDT) = **1.92 net**. `transactions` (newest 300
read at 19:27 PDT): every row from 2026-10-01 02:01:16 to 02:18:57 UTC is "Qwen Audio 3.0 TTS Flash" (spends of
0.01–0.04 and the refunds of the failed jobs); the row before is 2026-09-30 23:21 UTC (Seedance 2.5, the promo films —
before wave 8's day 0, already in the lead's 363.44). So the whole 1.92 is this batch. **Wave-8 lane X running total:
1.92.**

Per job (173 submissions = 119 completed + 54 failed; "created" = the time in the result's file name):

| take | clip | rate | job id | created (UTC) | output | status |
|---|---|---|---|---|---|---|
| 0 | `zh-w5-a-692eab60` | 1 | `bf4983ee-d406-485b-861e-044059b28661` | 02:01:16 | raw/0.wav | picked |
| 1 | `en-w5-a-692eab60` | 1 | `3e644d97-f95c-4257-adcf-357aba6fdb14` | — | — | failed (refunded) |
| 2 | `zh-w5-a-20bfa352` | 1 | `1260877f-99ae-4568-a1ef-8e4bbc65561c` | 02:01:16 | raw/2.wav | picked |
| 3 | `en-w5-a-20bfa352` | 1 | `1ae64ff9-a84d-40d7-bf08-b212b67cd2c4` | 02:01:16 | raw/3.wav | picked |
| 4 | `zh-w5-a-7838c5cc` | 1 | `3765f1b0-c6d1-4573-804a-5132e3941a05` | 02:01:16 | raw/4.wav | picked |
| 5 | `en-w5-a-7838c5cc` | 1 | `9a197b84-226a-458f-a873-57ad028f5744` | — | — | failed (refunded) |
| 6 | `zh-w5-a-8ffd6654` | 1 | `5bf6a3c0-6ed7-423d-a0da-31038f85ab09` | 02:01:16 | raw/6.wav | picked |
| 7 | `en-w5-a-8ffd6654` | 1 | `1e673ed5-a8f6-4f36-976c-f6cc6b4803b4` | — | — | failed (refunded) |
| 8 | `zh-w5-a-778c7dc0` | 1 | `69dbbb7d-0d73-4423-9e88-8758ea3ff937` | — | — | failed (refunded) |
| 9 | `en-w5-a-778c7dc0` | 1 | `16891bff-d6ac-4b0f-aae3-faf3d07da0a9` | — | — | failed (refunded) |
| 10 | `zh-w5-a-5248e608` | 1 | `c19b126f-f54d-4299-9d7b-60a3163b6ef0` | — | — | failed (refunded) |
| 11 | `en-w5-a-5248e608` | 1 | `982a1248-16db-44cf-bd79-7a03f66f97a0` | — | — | failed (refunded) |
| 12 | `zh-w5-a-d8e1d8a4` | 1 | `1639e93d-9535-4c2c-bc91-38bd3c9ac574` | — | — | failed (refunded) |
| 13 | `en-w5-a-d8e1d8a4` | 1 | `b67d4b0c-b3ac-44f7-b0a3-4d1064dcae81` | — | — | failed (refunded) |
| 14 | `zh-w5-a-c20171ba` | 1 | `8418ac75-eb76-4e88-a934-c005704f148f` | 02:01:40 | raw/14.wav | picked |
| 15 | `en-w5-a-c20171ba` | 1 | `0ec7f5bd-8cf9-48b5-a9d8-af2b2160d79c` | 02:01:40 | raw/15.wav | picked |
| 16 | `zh-w5-a-b38115d4` | 1 | `f31936fc-bde9-4a1e-a2fe-8ad3a10ae812` | 02:01:40 | raw/16.wav | picked |
| 17 | `en-w5-a-b38115d4` | 1 | `34ff1915-012c-48d9-a996-f07ac76e37c6` | — | — | failed (refunded) |
| 18 | `zh-w5-a-416727f0` | 1 | `35052ab6-25c2-4188-a85a-5d02ca58cc9b` | 02:01:40 | raw/18.wav | picked |
| 19 | `en-w5-a-416727f0` | 1 | `232b656b-d5c3-4d20-8044-52774afacb9a` | — | — | failed (refunded) |
| 20 | `zh-w5-a-89e99fc1` | 1 | `b865b8b2-8e15-4830-80f8-31a5e1c4deca` | — | — | failed (refunded) |
| 21 | `en-w5-a-89e99fc1` | 1 | `b5da1b59-d113-4c70-8295-328e50488240` | — | — | failed (refunded) |
| 22 | `zh-w5-a-5a04c263` | 1 | `3d98e9d6-ec62-4d1b-b48f-9cd7a4638fa4` | — | — | failed (refunded) |
| 23 | `en-w5-a-5a04c263` | 1 | `ac6deba7-9859-4300-856b-6dbd50b67073` | 02:01:40 | raw/23.wav | picked |
| 24 | `zh-w5-a-7959d7a5` | 1 | `031f3b1c-ddd9-4444-92a4-681b075e4911` | 02:02:12 | raw/24.wav | picked |
| 25 | `en-w5-a-7959d7a5` | 1 | `954364bc-f5cc-4f36-a61d-6d63f3962399` | — | — | failed (refunded) |
| 26 | `zh-w5-a-5c057864` | 1 | `2adf19da-2168-446b-902f-5a052e578fe9` | 02:02:12 | raw/26.wav | picked |
| 27 | `en-w5-a-5c057864` | 1 | `4f8d0c67-9766-4614-8f29-b8a24de0c72a` | 02:02:12 | raw/27.wav | picked |
| 28 | `zh-w5-a-893672b0` | 1 | `2fc0a668-667c-4914-bc40-3fe563faf8c9` | 02:02:12 | raw/28.wav | picked |
| 29 | `en-w5-a-893672b0` | 1 | `e19e879a-7f73-4c2e-8e05-bf0e12d63632` | 02:02:12 | raw/29.wav | picked |
| 30 | `zh-w5-a-aec5cba8` | 1 | `f5bc0a18-1c5e-43ea-bc64-dfd45e47d61e` | 02:02:12 | raw/30.wav | picked |
| 31 | `en-w5-a-aec5cba8` | 1 | `a62ff136-a890-42d6-9852-ae60c6900dc8` | 02:02:12 | raw/31.wav | picked |
| 32 | `zh-w5-a-d14a5c34` | 1 | `60c27781-ed3a-4c45-bfb9-7add6bac7ca4` | — | — | failed (refunded) |
| 33 | `en-w5-a-d14a5c34` | 1 | `69d8d4e7-85be-409e-8651-05439f2821d8` | — | — | failed (refunded) |
| 34 | `zh-w5-a-10b83d1a` | 1 | `89f09703-c455-4acd-9750-a1675ed3dade` | — | — | failed (refunded) |
| 35 | `en-w5-a-10b83d1a` | 1 | `46c533a3-a2e4-4576-a5f2-63952353cbdf` | — | — | failed (refunded) |
| 36 | `zh-w5-a-25182d00` | 1 | `52595b61-1c7c-4282-aa7c-b7fbef8b9f5f` | 02:02:46 | raw/36.wav | picked |
| 37 | `en-w5-a-25182d00` | 1 | `8e578ad2-1fec-4913-bb55-14d354635e98` | — | — | failed (refunded) |
| 38 | `zh-w5-a-bcc6583c` | 1 | `1a9b320b-3cbf-4f80-b1e6-c37a7d82f030` | — | — | failed (refunded) |
| 39 | `en-w5-a-bcc6583c` | 1 | `454ac540-d303-44b7-a7a0-d051115d5405` | — | — | failed (refunded) |
| 40 | `zh-w5-a-482d1993` | 1 | `9bb0ad11-3b76-4c28-ad46-7f074b132089` | 02:02:46 | raw/40.wav | picked |
| 41 | `en-w5-a-482d1993` | 1 | `ec90295c-8853-4bd8-a7bc-af9c1d2e0e1c` | — | — | failed (refunded) |
| 42 | `zh-w5-a-61af8842` | 1 | `9b3cacc2-7aba-4519-af96-2c15d301b3a4` | — | — | failed (refunded) |
| 43 | `en-w5-a-61af8842` | 1 | `8d2e6df1-5ba1-4610-a270-0d1168e4bb1f` | — | — | failed (refunded) |
| 44 | `zh-w5-a-dc695d4d` | 1 | `c1102ca2-3d99-411f-98af-b0cf2e6af57a` | 02:02:46 | raw/44.wav | picked |
| 45 | `en-w5-a-dc695d4d` | 1 | `09a9a83f-fbae-4fdd-a88b-9f5971da7072` | — | — | failed (refunded) |
| 46 | `zh-w5-a-020cb6aa` | 1 | `934bec8d-f5ec-42b9-b110-d6b6f1f5ad79` | 02:02:46 | raw/46.wav | picked |
| 47 | `en-w5-a-020cb6aa` | 1 | `08d3b68f-03ea-4565-af8a-431b35a10084` | 02:02:46 | raw/47.wav | picked |
| 48 | `zh-w5-a-b2f94b25` | 1 | `41e8f242-5341-4903-9606-38558a94bef1` | — | — | failed (refunded) |
| 49 | `en-w5-a-b2f94b25` | 1 | `95c720db-d466-41a8-9b6b-d18fce3425c5` | 02:03:37 | raw/49.wav | picked |
| 50 | `zh-w5-a-4338aef0` | 1 | `90c2e76d-b5c3-4fec-88bd-b08d530c81d3` | 02:03:37 | raw/50.wav | picked |
| 51 | `en-w5-a-4338aef0` | 1 | `9e0d14ba-33c0-43ae-a8db-66b12bc5a868` | 02:03:38 | raw/51.wav | picked |
| 52 | `zh-w5-a-db6f18d1` | 1 | `6618a7d8-2d2a-48e5-8c16-7bcb8f59c40d` | 02:03:37 | raw/52.wav | picked |
| 53 | `en-w5-a-db6f18d1` | 1 | `704a34e7-80d1-4d3b-8a2c-abc0ea113841` | 02:03:37 | raw/53.wav | picked |
| 55 | `en-w5-a-3fab2d6f` | 1 | `49444af4-3d72-4090-8233-8474bfa1fd8c` | 02:03:37 | raw/55.wav | picked |
| 56 | `zh-w5-a-a35821dc` | 1 | `35c6b613-538a-45ac-b05e-d86b6858e9f6` | 02:03:37 | raw/56.wav | picked |
| 57 | `en-w5-a-a35821dc` | 1 | `21f6d993-098b-475a-93e8-73640679dd20` | 02:03:37 | raw/57.wav | picked |
| 58 | `zh-w5-a-ecac118d` | 1 | `c627d495-eef0-4699-8997-2f08b738a10c` | 02:03:37 | raw/58.wav | picked |
| 59 | `en-w5-a-ecac118d` | 1 | `ffb91e1e-3607-49ab-9de5-fcd1105886a1` | 02:03:37 | raw/59.wav | picked |
| 60 | `zh-w5-a-2de97f72` | 1 | `c2473699-cd39-4dcd-8142-b87a00fc96da` | — | — | failed (refunded) |
| 61 | `en-w5-a-2de97f72` | 1 | `dbf242c3-05e5-4147-a1b8-1bc285934f79` | 02:06:25 | raw/61.wav | picked |
| 62 | `zh-w5-a-eb85ad0b` | 1 | `5d354fc9-42e2-4f89-af5a-03e4fb9c9f1b` | 02:06:25 | raw/62.wav | picked, muted (gate) |
| 63 | `en-w5-a-eb85ad0b` | 1 | `eb8a8279-aece-4b1e-87b5-08d2c432d0fb` | 02:06:25 | raw/63.wav | picked |
| 64 | `zh-w5-a-44f5a821` | 1 | `8dbcbcf0-2028-4d58-8601-27ed5402cd26` | 02:06:24 | raw/64.wav | picked |
| 65 | `en-w5-a-44f5a821` | 1 | `d5f4c17c-752c-42a4-99c3-1dabb7a14b69` | 02:06:25 | raw/65.wav | picked |
| 66 | `zh-w5-a-7e8dde5d` | 1 | `c8c47271-4662-4844-8ff3-4abbf0560f4f` | — | — | failed (refunded) |
| 67 | `en-w5-a-7e8dde5d` | 1 | `98f4dac7-4971-4b91-91fe-1d1cbe23580f` | — | — | failed (refunded) |
| 68 | `zh-w5-k-2aa6fb42` | 1 | `e3397c3d-519a-4b42-8a3d-7ae6ed9c7d86` | — | — | failed (refunded) |
| 69 | `en-w5-k-2aa6fb42` | 1 | `134427b4-1c7f-4179-be6e-9818b3402d73` | 02:06:25 | raw/69.wav | picked |
| 70 | `zh-w5-k-2e87c7f2` | 1 | `5ec5af97-f894-4f81-91c1-db4053341f50` | 02:06:25 | raw/70.wav | picked |
| 71 | `en-w5-k-2e87c7f2` | 1 | `44368974-a04a-4dc0-984b-a363fb6ec386` | — | — | failed (refunded) |
| 72 | `zh-w5-k-257c510d` | 1 | `4db84ae1-1804-4815-8c33-2eb5086bc89e` | 02:08:48 | raw/72.wav | picked |
| 73 | `en-w5-k-257c510d` | 1 | `a2f0b487-87b1-4d90-8261-f17571b2d344` | — | — | failed (refunded) |
| 74 | `zh-w5-k-7c88ffac` | 1 | `5dfd138f-acde-40d3-96af-2a56f8534767` | — | — | failed (refunded) |
| 75 | `en-w5-k-7c88ffac` | 1 | `9db490f9-789a-45fb-9639-a0be999c9c5e` | — | — | failed (refunded) |
| 76 | `zh-w5-k-2a49803a` | 1 | `ecd0b7c4-18af-424e-9dbd-c999a3c7f197` | — | — | failed (refunded) |
| 77 | `en-w5-k-2a49803a` | 1 | `106a35da-0d99-4a6f-ad94-f90737ebe6c8` | 02:08:48 | raw/77.wav | picked |
| 78 | `zh-w5-k-169f9235` | 1 | `5386157d-8c92-4d40-a981-8472724d8ba4` | 02:08:48 | raw/78.wav | picked |
| 79 | `en-w5-k-169f9235` | 1 | `f3c583d5-8459-435b-9a9f-e6adb6e5e145` | — | — | failed (refunded) |
| 80 | `zh-w5-k-deef4cff` | 1 | `e654f749-fd23-44c8-a9ee-dec6f30edc6b` | 02:08:46 | raw/80.wav | picked |
| 81 | `en-w5-k-deef4cff` | 1 | `8cbcd5c5-684c-4994-ae81-8c64d89b48d5` | — | — | failed (refunded) |
| 82 | `zh-w5-k-83579ca0` | 1 | `c7fac021-45f1-4b84-a5e3-61e00a6385db` | 02:08:48 | raw/82.wav | picked, muted (gate) |
| 83 | `en-w5-k-83579ca0` | 1 | `95717015-c52f-4dcb-8a84-fac788e08d13` | 02:08:48 | raw/83.wav | picked |
| 84 | `zh-w5-k-eabf6332` | 1 | `4cf18b15-802e-4fa1-8af7-be7e852fa28a` | 02:09:17 | raw/84.wav | picked, muted (gate) |
| 85 | `en-w5-k-eabf6332` | 1 | `e430cd05-901c-474b-bbb6-dd1241ccb875` | — | — | failed (refunded) |
| 86 | `zh-w5-k-4b1387ba` | 1 | `66b5cc81-cb0f-440a-98e9-df46450edb1a` | 02:09:17 | raw/86.wav | picked |
| 87 | `en-w5-k-4b1387ba` | 1 | `ee3669a5-b6e5-487f-8ecb-a02e8389041e` | 02:09:17 | raw/87.wav | picked |
| 88 | `zh-w5-k-9124e340` | 1 | `ed19dc2c-fa69-40c5-9d27-2a971aecd28c` | 02:09:17 | raw/88.wav | picked |
| 89 | `en-w5-k-9124e340` | 1 | `8cbcdbc8-c7ea-4d9d-afc0-5918e1e71909` | — | — | failed (refunded) |
| 90 | `zh-w5-k-9ae1d629` | 1 | `aabeda7a-da37-47e8-b437-f6ffff63ec7a` | — | — | failed (refunded) |
| 91 | `en-w5-k-9ae1d629` | 1 | `4483a13e-7054-455f-ad84-a8e9da234bc9` | 02:09:17 | raw/91.wav | picked |
| 92 | `zh-w5-k-00c99efb` | 1 | `48b0a975-7780-465f-a6b1-dfb59e92f6a3` | 02:09:17 | raw/92.wav | picked |
| 93 | `en-w5-k-00c99efb` | 1 | `06969881-8497-406c-8389-feae5a04f39c` | 02:09:17 | raw/93.wav | picked |
| 95 | `en-w5-k-d3e5f745` | 1 | `935040f0-97fe-474c-b9d0-82241f080885` | 02:09:17 | raw/95.wav | picked |
| 96 | `zh-w5-k-831da4b9` | 1 | `c1f7c8b5-676e-40d7-90d5-47948634e5db` | 02:10:20 | raw/96.wav | picked |
| 97 | `en-w5-k-831da4b9` | 1 | `96596c42-f4b5-4773-8e87-03f3f489c642` | — | — | failed (refunded) |
| 98 | `zh-w5-k-91a6801c` | 1 | `c2677914-f8a4-4f99-b42e-e1a88e9fa3b8` | — | — | failed (refunded) |
| 99 | `en-w5-k-91a6801c` | 1 | `4e99e8af-ec01-4164-9271-8a8c01f2724a` | — | — | failed (refunded) |
| 100 | `zh-w5-k-3f22bdb5` | 1 | `07f060dd-bef6-4177-8672-c986aad70c2a` | 02:10:20 | raw/100.wav | picked |
| 102 | `zh-w5-k-7538cb4b` | 1 | `a5421336-d3de-47c8-b09f-c7c3372ea7c3` | — | — | failed (refunded) |
| 103 | `en-w5-k-7538cb4b` | 1 | `7aa1038b-dbe7-4957-a3cb-de486f6a9cc1` | 02:10:20 | raw/103.wav | picked |
| 104 | `zh-w5-a-5d9dcf9c` | 1.15 | `efcca655-b196-4ecc-9e65-9dc6466d4a8a` | 02:10:20 | raw/104.wav | alternate (not picked) |
| 105 | `zh-w5-a-5d9dcf9c` | 1.3 | `11584578-659b-429f-a3fe-a560b45de620` | 02:10:20 | raw/105.wav | retake KEPT |
| 106 | `zh-w5-a-6807a93e` | 1.15 | `ae62044a-5124-4427-9e3d-6d3453671a80` | — | — | failed (refunded) |
| 107 | `zh-w5-a-6807a93e` | 1.3 | `d7d0e86e-8e9a-4dfd-8af7-40da08182490` | 02:10:20 | raw/107.wav | alternate (not picked) |
| 108 | `zh-w5-a-b95c4fe2` | 1.15 | `03c61d49-565f-4875-a93d-85bbffb5aa84` | 02:11:15 | raw/108.wav | retake KEPT |
| 109 | `zh-w5-a-b95c4fe2` | 1.3 | `9ee2748e-a804-424e-ada3-824d85fa73aa` | — | — | failed (refunded) |
| 110 | `en-w5-a-b95c4fe2` | 1.15 | `95839f3d-b914-4fc1-a5a4-a1f776725233` | 02:11:15 | raw/110.wav | retake rejected (wave 7 stays muted) |
| 111 | `en-w5-a-b95c4fe2` | 1.3 | `5dafce71-abcc-4add-8f8e-86f83d417d25` | 02:11:15 | raw/111.wav | alternate (not picked) |
| 112 | `en-w5-a-0b992197` | 1.15 | `e77f9f5b-84f0-4f86-b4bf-8ae6d2ebb3b6` | 02:11:15 | raw/112.wav | alternate (not picked) |
| 113 | `en-w5-a-0b992197` | 1.3 | `7881d34a-47b7-4c01-8711-32eef2659b3d` | — | — | failed (refunded) |
| 114 | `zh-w5-a-420d6131` | 1.15 | `cf5a73e0-985a-431a-b879-373da803083c` | — | — | failed (refunded) |
| 115 | `zh-w5-a-420d6131` | 1.3 | `f873363d-1043-45d1-8693-190d9930ef93` | — | — | failed (refunded) |
| 116 | `zh-w5-a-6c4f2c8f` | 1.15 | `7296d5e7-39fc-4bf9-a27f-cf37f3514109` | 02:11:15 | raw/116.wav | alternate (not picked) |
| 117 | `zh-w5-a-6c4f2c8f` | 1.3 | `4f796c0b-04fe-4c6d-923f-fa0c3d0bfc1e` | 02:11:15 | raw/117.wav | retake KEPT |
| 118 | `en-w5-a-9a2d1075` | 1.15 | `1c40647f-1540-4ab5-be5e-105faf3f2064` | 02:11:15 | raw/118.wav | retake KEPT |
| 119 | `en-w5-a-9a2d1075` | 1.3 | `5dd32f91-3cde-4a1a-a2c0-5c90e526808b` | — | — | failed (refunded) |
| 1 | `en-w5-a-692eab60` | 1 | `4375c1f3-93a8-433a-aea9-84fe2f6c0b63` | 02:12:46 | raw/1.wav | picked |
| 5 | `en-w5-a-7838c5cc` | 1 | `083643fb-9449-478f-8300-5140dc8afb95` | 02:12:46 | raw/5.wav | picked |
| 7 | `en-w5-a-8ffd6654` | 1 | `4d06f0a5-348e-4dad-84eb-2d280a05cb88` | 02:12:46 | raw/7.wav | picked |
| 8 | `zh-w5-a-778c7dc0` | 1 | `a7aea042-4e67-43a6-a13f-ffcec5f46a16` | 02:12:46 | raw/8.wav | picked |
| 9 | `en-w5-a-778c7dc0` | 1 | `6a9e2d51-cf5b-46ea-806d-be9d978e9f54` | — | — | failed (refunded) |
| 10 | `zh-w5-a-5248e608` | 1 | `5076d596-dbdb-4501-82b2-459c664e667a` | 02:12:46 | raw/10.wav | picked |
| 11 | `en-w5-a-5248e608` | 1 | `25599a39-47d0-48d6-9ce1-6023356e9335` | 02:13:30 | raw/11.wav | picked |
| 12 | `zh-w5-a-d8e1d8a4` | 1 | `876ab210-5ac2-4681-ba85-bc43ca75cc29` | 02:13:30 | raw/12.wav | picked |
| 13 | `en-w5-a-d8e1d8a4` | 1 | `ae7ef31e-856e-461f-a0c5-e43926e58d27` | 02:13:30 | raw/13.wav | picked |
| 17 | `en-w5-a-b38115d4` | 1 | `59a5f62f-369c-453f-9821-705a10584e5c` | 02:13:30 | raw/17.wav | picked |
| 19 | `en-w5-a-416727f0` | 1 | `9cc27c1d-5266-4ac3-867c-f5e075ebae0d` | 02:13:29 | raw/19.wav | picked |
| 20 | `zh-w5-a-89e99fc1` | 1 | `bb1cb090-eda3-4bea-876a-e246b351f71c` | 02:13:30 | raw/20.wav | picked |
| 21 | `en-w5-a-89e99fc1` | 1 | `82bfa5cc-3349-4cdb-aaf3-a878db84c5e0` | 02:14:06 | raw/21.wav | picked |
| 22 | `zh-w5-a-5a04c263` | 1 | `48370a74-a2e6-44b3-ba96-982b95dd5a48` | 02:14:06 | raw/22.wav | picked |
| 25 | `en-w5-a-7959d7a5` | 1 | `901908ee-a89d-4bb1-beaf-dc5d96a520a2` | 02:14:05 | raw/25.wav | picked |
| 32 | `zh-w5-a-d14a5c34` | 1 | `ba023cfc-14a3-4532-9a6a-daf8553903a4` | 02:14:05 | raw/32.wav | picked |
| 33 | `en-w5-a-d14a5c34` | 1 | `a3e44e03-d613-4e42-8acd-7e641fe6d441` | 02:14:05 | raw/33.wav | picked |
| 34 | `zh-w5-a-10b83d1a` | 1 | `1edd622f-8249-48de-bfc7-d0ee5131a038` | 02:14:05 | raw/34.wav | picked |
| 35 | `en-w5-a-10b83d1a` | 1 | `a1fc7d3d-ef93-4daf-8299-c27ea07bc85a` | 02:14:37 | raw/35.wav | picked |
| 37 | `en-w5-a-25182d00` | 1 | `c9f77919-22b0-4a2a-a723-753d06fa230c` | 02:14:37 | raw/37.wav | picked |
| 38 | `zh-w5-a-bcc6583c` | 1 | `b4ec4b2f-c248-4d3d-80c5-1b649a2749d8` | 02:14:37 | raw/38.wav | picked |
| 39 | `en-w5-a-bcc6583c` | 1 | `557cab1f-d1eb-41d8-a1a8-36b409d1dad2` | 02:14:37 | raw/39.wav | picked |
| 41 | `en-w5-a-482d1993` | 1 | `6e3b2144-52dd-4deb-a37e-bb5f2b5bc24f` | 02:14:37 | raw/41.wav | picked |
| 42 | `zh-w5-a-61af8842` | 1 | `61ee23a9-ca5c-4771-bdcf-fb343839b68a` | 02:14:36 | raw/42.wav | picked |
| 43 | `en-w5-a-61af8842` | 1 | `23247b79-7633-496f-8751-400f43334d4f` | 02:15:09 | raw/43.wav | picked |
| 45 | `en-w5-a-dc695d4d` | 1 | `51369d42-207d-4f19-a85f-93362c42dbbc` | 02:15:09 | raw/45.wav | picked |
| 48 | `zh-w5-a-b2f94b25` | 1 | `5c3822fa-8874-4d53-925e-c5b1e2c62813` | 02:15:10 | raw/48.wav | picked |
| 54 | `zh-w5-a-3fab2d6f` | 1 | `22da1721-424e-40cd-8043-0202bac1d75b` | 02:15:09 | raw/54.wav | picked |
| 60 | `zh-w5-a-2de97f72` | 1 | `f0a0b6e0-ea9c-4fe6-9940-dbf375578c67` | 02:15:09 | raw/60.wav | picked |
| 66 | `zh-w5-a-7e8dde5d` | 1 | `1e84f054-b0b2-4666-8237-22f1340c41e1` | 02:15:09 | raw/66.wav | picked |
| 67 | `en-w5-a-7e8dde5d` | 1 | `1243c6ed-61cc-4eb9-9472-f8748dedbcaf` | 02:15:45 | raw/67.wav | picked |
| 68 | `zh-w5-k-2aa6fb42` | 1 | `06f90234-9c54-4f2f-9334-d58504895853` | 02:15:45 | raw/68.wav | picked |
| 71 | `en-w5-k-2e87c7f2` | 1 | `c15d0b14-8dbf-4ac5-bd46-4c1639fb5361` | 02:15:44 | raw/71.wav | picked |
| 73 | `en-w5-k-257c510d` | 1 | `f068e361-6d66-416a-8a4c-c7f13cff9ae9` | 02:15:44 | raw/73.wav | picked |
| 74 | `zh-w5-k-7c88ffac` | 1 | `319683d7-1425-4877-87c1-66368ecf2043` | 02:15:44 | raw/74.wav | picked |
| 75 | `en-w5-k-7c88ffac` | 1 | `d8cd155d-2e35-4ed9-9d51-882ae9042cf3` | 02:15:45 | raw/75.wav | picked |
| 76 | `zh-w5-k-2a49803a` | 1 | `febdcba1-a17b-4812-9493-3a1da9737303` | 02:16:23 | raw/76.wav | picked, muted (gate) |
| 79 | `en-w5-k-169f9235` | 1 | `2e2df7e2-430d-4f26-b157-da51b9d5e4fa` | 02:16:23 | raw/79.wav | picked |
| 81 | `en-w5-k-deef4cff` | 1 | `fd31e16c-dcab-4988-a8a9-67508f71ff25` | 02:16:23 | raw/81.wav | picked |
| 85 | `en-w5-k-eabf6332` | 1 | `070dec43-68b9-47ce-9df1-e0f3f16d94db` | 02:16:23 | raw/85.wav | picked, muted (gate) |
| 89 | `en-w5-k-9124e340` | 1 | `16f48055-b3aa-4b4b-88f8-372b162b3ac7` | 02:16:23 | raw/89.wav | picked |
| 90 | `zh-w5-k-9ae1d629` | 1 | `9eb603b2-5812-46bf-bff3-55878221d9ad` | — | — | failed (refunded) |
| 90 | `zh-w5-k-9ae1d629` | 1 | `6d1bf468-92d5-44ed-bfb3-8bfef31dd30a` | 02:17:01 | raw/90.wav | picked |
| 94 | `zh-w5-k-d3e5f745` | 1 | `6d36dceb-593e-4d6f-92e0-45e834a35973` | 02:17:01 | raw/94.wav | picked |
| 97 | `en-w5-k-831da4b9` | 1 | `c7cb957a-bd8d-4998-856a-a9770d5ef5ca` | 02:17:01 | raw/97.wav | picked |
| 98 | `zh-w5-k-91a6801c` | 1 | `a7cd2a14-f967-4ebf-a89a-575ec4d55606` | 02:17:01 | raw/98.wav | picked |
| 99 | `en-w5-k-91a6801c` | 1 | `be81a705-9294-4a93-9ef6-5480e09d127c` | 02:17:01 | raw/99.wav | picked |
| 101 | `en-w5-k-3f22bdb5` | 1 | `98c6e466-e86b-474c-a18c-4a7a4c25d84f` | 02:17:02 | raw/101.wav | picked |
| 102 | `zh-w5-k-7538cb4b` | 1 | `71652a4f-adf2-4972-8a08-5f57db72a272` | 02:18:50 | raw/102.wav | picked |
| 106 | `zh-w5-a-6807a93e` | 1.15 | `eb2cc38f-7c75-47c9-9e32-158f2fb10e4e` | 02:18:50 | raw/106.wav | retake KEPT |
| 109 | `zh-w5-a-b95c4fe2` | 1.3 | `a3bd28ac-2cd4-47c0-b0c0-421c0b62a9cb` | 02:18:50 | raw/109.wav | alternate (not picked) |
| 113 | `en-w5-a-0b992197` | 1.3 | `2852428b-458c-4047-8756-f0d37a077282` | 02:18:50 | raw/113.wav | retake KEPT |
| 114 | `zh-w5-a-420d6131` | 1.15 | `7351c507-ab84-4450-ac35-43c0c4900579` | — | — | failed (refunded) |
| 115 | `zh-w5-a-420d6131` | 1.3 | `63e7359c-cd6c-43f4-a426-c2cb9bfb8b95` | 02:18:49 | raw/115.wav | retake KEPT |
| 9 | `en-w5-a-778c7dc0` | 1 | `63f6463c-f44b-4bb3-9a62-3c2732a96ed5` | 02:18:53 | raw/9.wav | picked |
| 119 | `en-w5-a-9a2d1075` | 1.3 | `e8ba6765-59b4-4c08-a438-e4c8b3e9c2ba` | 02:18:53 | raw/119.wav | alternate (not picked) |

**Not lane X (19:29–19:35 PDT):** `transactions` shows "Qwen Audio 3.0 TTS Flash" spends and refunds from 2026-10-01
02:29:40 to 02:35:01 UTC — after the lane's first agent had stopped (02:20 UTC) and before this agent's first batch
(03:28 UTC); the balance went 361.52 (19:26 PDT) → **360.85** (20:27 PDT), **0.67** that are not this lane's (another lane
or project on the shared account). Listed only so the balance reconciles.

## Batch 2 · lane K's fixed city lines (W8-K3), the 5 muted batch-1 clips again, "Ho! Spot on!" again (W8-X3), 2026-10-01 03:28–03:34 UTC

Balance before: **360.85** (20:27 PDT). Same model, voice and chain. The take list (`lines.ts --takes … --batch 2 --start
200 --retakes en-w5-a-b95c4fe2 --redo`): 8 new lines × zh / en (lane K's `W8K_LINES` in `game/fixedLines.ts` — the free
lead's 跟我来 / 到啦, the trip's arrival and next ride, go-to's 就在这里啦, the boarding line, the view-spot sit — and
`SKYLINE_LINES.noViewPin` 最近的观景点我标出来啦… in `play/skylineLines.ts`, lane K's fixed bubble that replaced the
templated 最近的观景点：<name>)
= 16 takes at rate 1.0, + 10 redo takes of batch 1's 5 muted clips (1.15 / 1.3, `redo`: the new pick replaces the clip) +
2 more takes of `en-w5-a-b95c4fe2` = **28 takes** (indices 200–227). Job ids `C:/Users/willy/opus-qa/w8/x/voice2/jobs1.txt`,
`jobs2.txt`; raw `…/voice2/raw/`.

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W8X-VO3 | 16 clips (8 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | the lines verbatim | 0.01–0.03 a take | table below | `public/opus-bay/w8/voice/` | 16 used; 15 pass, **1 muted** (`zh-w5-k-7755a76a` 跟我来！我带你过去～: a 0.99 s pause; redone in batch 3) |
| W8X-VO4 | 10 redo takes (5 muted clips × 1.15 / 1.3) | same | verbatim | 0.01 a take | below | the clips' files replaced | 4 of 5 now pass and play (金黄酥脆！完美！, 这段路有点难走…, 嗯～好吃！ zh + en); 当——当——当！ still misses the rate gate (1.40 s for three bell strokes): muted for the owner's ear |
| W8X-VO5 | 2 takes of "Ho! Spot on!" (1.15 / 1.3) | same | verbatim | 0.01 a take | below | — | both pass every gate (1.45 / 1.62 s) but the recogniser hears nothing → by the rule wave 7's clip stays muted (the owner can approve it on the sheet) |
| — | 3 jobs failed (refunded: takes 213, 216, 224), 3 submissions answered 429 (202, 208, 216: nothing charged) | — | — | refunded | jobs1 / jobs2 | — | resubmitted once, all completed |

**Credits:** balance 360.85 → **360.51** = **0.34**; `transactions` 03:28:50–03:33:21 UTC: 31 spends of 0.01–0.03 (0.37) and 3
refunds (0.03) = 0.34 net — all this batch. **Wave-8 lane X running total: 2.26.**

| take | clip | rate | job id | created (UTC) | output | status |
|---|---|---|---|---|---|---|
| 200 | `zh-w5-a-b2601524` | 1 | `d2463dad-08a3-4c37-be19-bedf63c3a316` | 03:28:50 | raw/200.wav | picked |
| 201 | `en-w5-a-b2601524` | 1 | `f2a2ec3b-1f14-4e34-b3c5-fa968968f72e` | 03:28:50 | raw/201.wav | picked |
| 203 | `en-w5-k-7755a76a` | 1 | `80bd1099-f892-4a8c-a339-91c9d40cfa03` | 03:28:51 | raw/203.wav | picked |
| 204 | `zh-w5-k-d77094cb` | 1 | `aad2b8bd-5739-4549-9fd8-23e5c04d66a3` | 03:28:50 | raw/204.wav | picked |
| 205 | `en-w5-k-d77094cb` | 1 | `37961dad-4451-4fef-924e-91226012ab02` | 03:28:50 | raw/205.wav | picked |
| 206 | `zh-w5-k-23a8415a` | 1 | `e119f17f-0f53-4fdb-89e8-671691613ad7` | 03:28:50 | raw/206.wav | picked |
| 207 | `en-w5-k-23a8415a` | 1 | `9445053b-5621-43ba-91dc-9cf126b6c0d7` | 03:28:51 | raw/207.wav | picked |
| 209 | `en-w5-k-0d12e5c2` | 1 | `0d050d3c-451d-4b52-813d-c2a335bf4f11` | 03:28:50 | raw/209.wav | picked |
| 210 | `zh-w5-k-268761c0` | 1 | `1a21cbd0-2801-4f3d-80ff-1c29ef717c47` | 03:28:50 | raw/210.wav | picked |
| 211 | `en-w5-k-268761c0` | 1 | `e185aa99-3c7d-46a4-8777-29be77e0a933` | 03:28:51 | raw/211.wav | picked |
| 212 | `zh-w5-k-6b7424b5` | 1 | `4e91c97e-6a24-458d-a6e8-d90ffeeedd27` | 03:30:42 | raw/212.wav | picked |
| 213 | `en-w5-k-6b7424b5` | 1 | `898ef9c2-ff48-4b7d-bec9-6cd6f736e619` | — | — | failed (refunded) |
| 214 | `zh-w5-k-fce1d40b` | 1 | `04d11038-4828-419d-bae5-d31d596ea03d` | 03:30:42 | raw/214.wav | picked |
| 215 | `en-w5-k-fce1d40b` | 1 | `fe0fdacb-707f-4ed1-b7e5-2b4e28ac9ba1` | 03:30:42 | raw/215.wav | picked |
| 217 | `en-w5-a-b95c4fe2` | 1.3 | `56562a9d-7c89-48d4-9c2c-6a1ddf885479` | 03:30:42 | raw/217.wav | alternate (not picked) |
| 218 | `zh-w5-a-eb85ad0b` | 1.15 | `d44d2691-4c39-43a1-b21b-86ce488b97dd` | 03:30:42 | raw/218.wav | alternate (not picked) |
| 219 | `zh-w5-a-eb85ad0b` | 1.3 | `2879f96d-597e-4ee9-87b8-f0923183e471` | 03:30:42 | raw/219.wav | picked |
| 220 | `zh-w5-k-2a49803a` | 1.15 | `91231a5a-fa6c-41ef-bf62-6b6cacee5ff5` | 03:30:42 | raw/220.wav | picked |
| 221 | `zh-w5-k-2a49803a` | 1.3 | `584dfa8e-3c72-4891-8257-84cc2f802de6` | 03:30:42 | raw/221.wav | alternate (not picked) |
| 222 | `zh-w5-k-83579ca0` | 1.15 | `a00fbcde-8177-4b15-8b66-e954b842ceb2` | 03:30:42 | raw/222.wav | picked, muted (gate) |
| 223 | `zh-w5-k-83579ca0` | 1.3 | `9f6550d6-a1c1-48e2-9c2f-13aa641e06b8` | 03:30:42 | raw/223.wav | alternate (not picked) |
| 224 | `zh-w5-k-eabf6332` | 1.15 | `c86edfde-7c79-4818-9019-154d7084602f` | — | — | failed (refunded) |
| 225 | `zh-w5-k-eabf6332` | 1.3 | `4df1965f-39d7-4389-8605-11fd77582299` | 03:32:03 | raw/225.wav | picked |
| 226 | `en-w5-k-eabf6332` | 1.15 | `2cb2b898-627f-443b-a26d-9c736bad47f7` | 03:32:03 | raw/226.wav | alternate (not picked) |
| 227 | `en-w5-k-eabf6332` | 1.3 | `5bb336fc-6eab-4c79-8c2c-584ba5bf6fa2` | 03:32:03 | raw/227.wav | picked |
| 202 | `zh-w5-k-7755a76a` | 1 | `7cb9150a-3d09-49e2-8bb5-d2a7df9a8d4e` | 03:32:03 | raw/202.wav | picked, muted (gate) |
| 208 | `zh-w5-k-0d12e5c2` | 1 | `8cadabef-f6e2-4074-ab92-a8db2594fbd8` | 03:32:03 | raw/208.wav | picked |
| 216 | `en-w5-a-b95c4fe2` | 1.15 | `147a0d97-b79d-4484-9280-f664b5755515` | — | — | failed (refunded) |
| 213 | `en-w5-k-6b7424b5` | 1 | `b0284d01-b21c-428e-b8c2-a95a0a9745eb` | 03:33:20 | raw/213.wav | picked |
| 224 | `zh-w5-k-eabf6332` | 1.15 | `e569169e-f07d-433f-afae-7f72fa6884d7` | 03:33:20 | raw/224.wav | alternate (not picked) |
| 216 | `en-w5-a-b95c4fe2` | 1.15 | `8882f5d9-e858-444c-968a-7f17590ebc56` | 03:33:21 | raw/216.wav | retake rejected (wave 7 stays muted) |
