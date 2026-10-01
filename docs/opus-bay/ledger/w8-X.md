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

## Batch 3 · the lanes' new wave-8 lines on origin at 21:10 PDT (W8-X5), 2026-10-01 04:30–04:48 UTC

Balance before: **360.51** (21:28 PDT). Same model, voice and chain (`lines.ts --takes … --batch 3 --start 300 --redo`):
53 new lines × zh / en — lane M's three games (`play/sfgames8Lines.ts`: the cable-car grip, the busker jam, the foghorn
call-and-answer, 41 lines), lane H's `W8_HALLOWEEN_LINES` (1) and `W8_WORLD_LINES` (3: the Chinatown festival ×2, the
procession steps aside — read "soft, gentle and respectful"), lane W2's `westLines.ts` (5: surfers, Kelly's Cove, Seal
Rocks), lane S's Parade of Ships (4, `own`: realsf plays `voice-line realsf-parade-<key>`) — + 4 redo takes (the bell
当——当——当！ and 跟我来！我带你过去～ at 1.15 / 1.3) = **110 takes** (indices 300–409). The service failed 47 jobs (refunded)
and answered 429 to 7 submissions (no job): resubmitted up to three times until every take was in. Job ids
`C:/Users/willy/opus-qa/w8/x/voice3/jobs1.txt` … `jobs4.txt` (a later file's id replaces a failed one); raw `…/voice3/raw/`.

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W8X-VO6 | 106 clips (53 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | the lines verbatim | 0.01–0.05 a take | table below | `public/opus-bay/w8/voice/` | 106 used; 102 pass, **4 muted** (rate gate: 松得正好！滑过去～, 松闸、刹车，停得稳稳的！, We’re off: grip!; clipped samples: Nice driving! Let’s do another run!) |
| W8X-VO7 | 4 redo takes | same, 1.15 / 1.3 | verbatim | 0.01 a take | below | the clip replaced | 跟我来！我带你过去～ passes now and plays; 当——当——当！ still under the rate gate (1.31 s): muted, the owner's ear |
| — | 47 failed jobs (refunded) + 7 answered 429 | — | — | refunded | jobs1–4 | — | resubmitted |

**Credits:** balance 360.51 → **358.43** = **2.08**; `transactions` 04:30:09–04:48:23 UTC: TTS spends and the refunds of the
failed jobs only, nothing else on the account between 03:33:21 and 04:30:09 UTC — all this batch. **Wave-8 lane X running
total: 4.34.**

| take | clip | rate | job id | created (UTC) | output | status |
|---|---|---|---|---|---|---|
| 300 | `zh-w5-a-f6168ad1` | 1 | `bbce38d5-2fda-4868-b2dd-3e8b4422e607` | — | — | failed (refunded), resubmitted |
| 301 | `en-w5-a-f6168ad1` | 1 | `3b98222d-e150-4571-bd3d-54a1b7a8e8aa` | 04:30:09 | raw/301.wav | completed |
| 302 | `zh-w5-a-2344395c` | 1 | `cf64a9b9-72af-49cc-9bec-197b07eb0d64` | — | — | failed (refunded), resubmitted |
| 303 | `en-w5-a-2344395c` | 1 | `d8f16dbc-a643-4d30-bcea-8e262a2c8956` | — | — | failed (refunded), resubmitted |
| 304 | `zh-w5-a-c2c286b1` | 1 | `d9d4d3dc-d1c9-4d92-a72f-03cd1670a3a9` | — | — | failed (refunded), resubmitted |
| 305 | `en-w5-a-c2c286b1` | 1 | `28eae119-44d9-4751-b55e-13730bb776d9` | 04:30:09 | raw/305.wav | completed |
| 306 | `zh-w5-a-145988d4` | 1 | `73b94774-9c58-443d-99a8-b9b5721d7cd3` | 04:30:09 | raw/306.wav | completed |
| 307 | `en-w5-a-145988d4` | 1 | `ddfd67b2-cd49-459c-8ff7-a9f79060fa1b` | — | — | failed (refunded), resubmitted |
| 308 | `zh-w5-a-96c9bbc3` | 1 | `385034da-04f1-4860-a287-76b677c3fe24` | — | — | failed (refunded), resubmitted |
| 309 | `en-w5-a-96c9bbc3` | 1 | `78aab80b-be02-452d-abdd-cc4c82e2a845` | 04:30:09 | raw/309.wav | completed |
| 310 | `zh-w5-a-00bdef59` | 1 | `33f56cff-17a1-4879-953c-74d880db5c4f` | — | — | failed (refunded), resubmitted |
| 311 | `en-w5-a-00bdef59` | 1 | `42240811-d47d-4ade-91c1-8f767ccb5fdd` | 04:30:09 | raw/311.wav | completed |
| 313 | `en-w5-a-d036bc6b` | 1 | `9239ce96-8063-4d13-97a4-b294667f6d62` | 04:30:46 | raw/313.wav | completed |
| 314 | `zh-w5-a-61c180e4` | 1 | `6134f7e6-4f58-470c-bdb8-f7a26456cbd5` | 04:30:46 | raw/314.wav | completed |
| 315 | `en-w5-a-61c180e4` | 1 | `c24f7638-6aa0-4d67-80e8-c6e93b3335a9` | 04:30:46 | raw/315.wav | completed |
| 316 | `zh-w5-a-c37a8eb0` | 1 | `b7f11baa-5c3a-43d8-ab38-32a2ae116347` | 04:30:46 | raw/316.wav | completed |
| 317 | `en-w5-a-c37a8eb0` | 1 | `89a11b17-d91a-4a27-8401-8af8bc1218c5` | — | — | failed (refunded), resubmitted |
| 318 | `zh-w5-a-db91854d` | 1 | `0ab80813-2201-4ccc-9354-1aa5a589aa56` | 04:30:46 | raw/318.wav | completed |
| 319 | `en-w5-a-db91854d` | 1 | `c13381ea-03fd-44a7-9d9d-245ebb7e7e89` | 04:30:46 | raw/319.wav | completed |
| 321 | `en-w5-a-c189fab9` | 1 | `d156e027-b788-4150-9f4e-5280cd60884a` | 04:30:46 | raw/321.wav | completed |
| 322 | `zh-w5-a-3f26939f` | 1 | `809820ed-a875-41da-8571-05a911f7ecc9` | 04:30:46 | raw/322.wav | completed |
| 323 | `en-w5-a-3f26939f` | 1 | `665231e1-020b-448b-a586-f431cf90ff15` | 04:30:46 | raw/323.wav | completed |
| 324 | `zh-w5-a-42f65f9f` | 1 | `16868cca-c208-46af-b25c-3422738ea080` | 04:31:23 | raw/324.wav | completed |
| 325 | `en-w5-a-42f65f9f` | 1 | `737dcfa5-1f3f-4dfe-bb52-e9654117fcea` | 04:31:23 | raw/325.wav | completed |
| 326 | `zh-w5-a-c9a9c4b2` | 1 | `24b4be96-6a6f-4cea-beed-f7f736d3caaa` | 04:31:23 | raw/326.wav | completed |
| 327 | `en-w5-a-c9a9c4b2` | 1 | `0dd57487-e7a7-407d-bf17-f189528a93d2` | 04:31:23 | raw/327.wav | completed |
| 328 | `zh-w5-a-52d1ffc3` | 1 | `c345e477-2567-467c-ac7c-4b84ad6d82f4` | — | — | failed (refunded), resubmitted |
| 329 | `en-w5-a-52d1ffc3` | 1 | `f903acb9-7d81-4698-b983-7a2733cb44ce` | 04:31:24 | raw/329.wav | completed |
| 330 | `zh-w5-a-f1002ae5` | 1 | `0ec492aa-999b-4c9e-aaa5-e90e76c0d73d` | 04:31:23 | raw/330.wav | completed |
| 331 | `en-w5-a-f1002ae5` | 1 | `9f37f198-7915-4f38-8605-739f3ae32955` | 04:31:24 | raw/331.wav | completed |
| 332 | `zh-w5-a-0b092526` | 1 | `570d50cc-e456-46c8-81a2-856b2bb219d3` | 04:31:23 | raw/332.wav | completed |
| 333 | `en-w5-a-0b092526` | 1 | `d87de784-b8f1-4520-b24a-95083b5ed942` | — | — | failed (refunded), resubmitted |
| 334 | `zh-w5-a-1079d14f` | 1 | `d7fa19a1-9cc0-4b1a-a308-0eac55cfa447` | 04:31:23 | raw/334.wav | completed |
| 335 | `en-w5-a-1079d14f` | 1 | `3b80633e-3a88-4f6b-9f17-18d205a5bd62` | 04:31:23 | raw/335.wav | completed |
| 336 | `zh-w5-a-2f693b59` | 1 | `1c445e0b-b512-4bc9-8f11-d309ae276f38` | 04:31:59 | raw/336.wav | completed |
| 337 | `en-w5-a-2f693b59` | 1 | `b75da11e-8b0b-46fd-a6bf-ceca61105040` | 04:31:58 | raw/337.wav | completed |
| 339 | `en-w5-a-529b6223` | 1 | `bb18e247-183a-472f-b12d-b2fc0d4ca385` | 04:31:58 | raw/339.wav | completed |
| 340 | `zh-w5-a-39f33bd2` | 1 | `95a7d0d5-b672-4690-91a7-206225f89bc9` | 04:31:59 | raw/340.wav | completed |
| 341 | `en-w5-a-39f33bd2` | 1 | `4d73b33e-702c-413e-9a5f-5ac42ed43679` | — | — | failed (refunded), resubmitted |
| 342 | `zh-w5-a-3e5b9d08` | 1 | `4b1688f5-5df6-45ea-a2bf-8af79b9e58fa` | 04:31:58 | raw/342.wav | completed |
| 343 | `en-w5-a-3e5b9d08` | 1 | `a85be182-86fb-4f41-8098-981bc2a355a4` | — | — | failed (refunded), resubmitted |
| 345 | `en-w5-a-02080b3a` | 1 | `217780e4-e360-4445-a8bd-d2225d0c8d25` | 04:31:58 | raw/345.wav | completed |
| 346 | `zh-w5-a-c0b0dc0b` | 1 | `ba7381c5-3c5b-40ed-92a6-d998ee7fe9e4` | 04:31:58 | raw/346.wav | completed |
| 347 | `en-w5-a-c0b0dc0b` | 1 | `c6d02e9e-17c9-42e7-b57b-a138931b890b` | — | — | failed (refunded), resubmitted |
| 348 | `zh-w5-a-22ab87f6` | 1 | `4a37e8ce-2da4-497f-9048-7d3244617fde` | — | — | failed (refunded), resubmitted |
| 349 | `en-w5-a-22ab87f6` | 1 | `c82390bf-a300-48d4-9f81-eda45298252b` | — | — | failed (refunded), resubmitted |
| 350 | `zh-w5-a-4d43f1a8` | 1 | `df377ac1-3afa-46fa-afcd-974aa3a561d6` | — | — | failed (refunded), resubmitted |
| 351 | `en-w5-a-4d43f1a8` | 1 | `81a34eda-db34-46b1-a097-387135547d46` | 04:32:31 | raw/351.wav | completed |
| 352 | `zh-w5-a-34168bbe` | 1 | `5a4989b6-a2b8-46fa-bc79-7f4711e3137b` | 04:32:31 | raw/352.wav | completed |
| 353 | `en-w5-a-34168bbe` | 1 | `8e619d7b-bfc3-456b-9449-c779cb8c19bb` | 04:32:31 | raw/353.wav | completed |
| 354 | `zh-w5-a-6f8ae84a` | 1 | `de05fd69-780d-4436-af8c-560ccefd590c` | 04:32:31 | raw/354.wav | completed |
| 355 | `en-w5-a-6f8ae84a` | 1 | `8fd4ff36-434e-4304-a6f5-cd5d631c93d3` | 04:32:31 | raw/355.wav | completed |
| 356 | `zh-w5-a-ab9b375c` | 1 | `11ee53ef-365c-4009-855b-198a764f9944` | 04:32:31 | raw/356.wav | completed |
| 357 | `en-w5-a-ab9b375c` | 1 | `773ff3dc-1bd6-403b-8bf5-5a7728770354` | 04:32:31 | raw/357.wav | completed |
| 358 | `zh-w5-a-aea29261` | 1 | `7a4b02d3-263c-4876-a0f0-02c6b1a373f3` | 04:32:31 | raw/358.wav | completed |
| 359 | `en-w5-a-aea29261` | 1 | `506fe0a4-5325-44d4-a0f7-26bf44f09411` | 04:32:31 | raw/359.wav | completed |
| 360 | `zh-w5-a-4aa60f8a` | 1 | `45095ad8-7c5f-4527-a2e0-dd7aaac0ff2d` | 04:33:03 | raw/360.wav | completed |
| 361 | `en-w5-a-4aa60f8a` | 1 | `7dd7556a-ec48-47d2-b45c-065d220878cc` | 04:33:03 | raw/361.wav | completed |
| 362 | `zh-w5-a-3ae267bd` | 1 | `42df9fba-fed3-4db9-a5dd-165a0257219d` | 04:33:03 | raw/362.wav | completed |
| 363 | `en-w5-a-3ae267bd` | 1 | `898aeabc-d27a-445e-8bf8-2bee37e65ce6` | 04:33:03 | raw/363.wav | completed |
| 364 | `zh-w5-a-a9d45add` | 1 | `337a4731-ea45-4e96-b879-1f32fbc24c91` | — | — | failed (refunded), resubmitted |
| 365 | `en-w5-a-a9d45add` | 1 | `590a0cc0-02db-48bc-97e8-7f82a3799462` | 04:33:03 | raw/365.wav | completed |
| 366 | `zh-w5-a-c894f0db` | 1 | `baf7afde-aae2-417e-9df7-7d7bbdd1182d` | 04:33:03 | raw/366.wav | completed |
| 367 | `en-w5-a-c894f0db` | 1 | `ff3b55d0-cafd-44e8-9d24-f6a73b38d1b7` | 04:33:03 | raw/367.wav | completed |
| 368 | `zh-w5-a-be5780ec` | 1 | `b9907982-28ef-4c9a-ab35-8777fe444c9f` | 04:33:03 | raw/368.wav | completed |
| 369 | `en-w5-a-be5780ec` | 1 | `ec3858ce-1600-4182-b22a-7b2d67f19b8a` | — | — | failed (refunded), resubmitted |
| 370 | `zh-w5-a-402a365d` | 1 | `8eca9e02-93c4-4933-9447-4151692ce692` | 04:33:03 | raw/370.wav | completed |
| 371 | `en-w5-a-402a365d` | 1 | `b94307ee-d75b-404e-bd20-8efdfda7776a` | — | — | failed (refunded), resubmitted |
| 372 | `zh-w5-a-2dbc29a0` | 1 | `7fb5bc1e-5445-4fb8-b4a2-9d1fcb660efb` | 04:33:37 | raw/372.wav | completed |
| 373 | `en-w5-a-2dbc29a0` | 1 | `a0b80caa-c704-49b0-ae93-a76ec81dc83e` | — | — | failed (refunded), resubmitted |
| 374 | `zh-w5-a-6f4acec9` | 1 | `ef1f4367-de49-471a-993f-fa4a1096b012` | 04:33:38 | raw/374.wav | completed |
| 375 | `en-w5-a-6f4acec9` | 1 | `1defed51-9b72-4bae-b353-b2dc37692e93` | 04:33:38 | raw/375.wav | completed |
| 376 | `zh-w5-a-ebf7391f` | 1 | `eac2c248-4476-4a02-ae8f-aada3b304c0b` | 04:33:38 | raw/376.wav | completed |
| 377 | `en-w5-a-ebf7391f` | 1 | `c30a1699-32d4-47fb-b9fc-0f4a448123e7` | — | — | failed (refunded), resubmitted |
| 378 | `zh-w5-a-feb3d947` | 1 | `80fb0214-72dd-4bef-8cb3-f06515edbd6e` | 04:33:38 | raw/378.wav | completed |
| 379 | `en-w5-a-feb3d947` | 1 | `f58e57c2-981b-4d41-a25c-0fb385c7fb2c` | 04:33:38 | raw/379.wav | completed |
| 380 | `zh-w8h-costume-pumpkin-bow` | 1 | `0997f6fd-e635-46e1-8477-f458a785efbd` | 04:33:38 | raw/380.wav | completed |
| 381 | `en-w8h-costume-pumpkin-bow` | 1 | `ae374521-819d-41af-8bf2-11e3dcc976bb` | — | — | failed (refunded), resubmitted |
| 382 | `zh-w8-h-chinatown-contest` | 1 | `408b81fc-2a96-48dc-9f67-b8075f6c265e` | 04:33:38 | raw/382.wav | completed |
| 383 | `en-w8-h-chinatown-contest` | 1 | `ac1df907-cda6-4f9f-a676-78433ead5b7f` | — | — | failed (refunded), resubmitted |
| 384 | `zh-w8-h-chinatown-lanterns` | 1 | `731b497c-4cca-4aa9-a0b3-d61af9fa40bb` | — | — | failed (refunded), resubmitted |
| 385 | `en-w8-h-chinatown-lanterns` | 1 | `33b4a98e-0857-4fdd-a9f8-84ef7ac1beed` | 04:34:14 | raw/385.wav | completed |
| 386 | `zh-w8-h-procession-aside` | 1 | `ab6dfdf7-cd47-4a3c-938b-a08c64334522` | 04:34:14 | raw/386.wav | completed |
| 387 | `en-w8-h-procession-aside` | 1 | `bd8bdd6b-79e4-449c-820a-08c1b2dbb6cf` | 04:34:14 | raw/387.wav | completed |
| 388 | `zh-w5-w2-8c0a3f3e` | 1 | `f085bd97-b381-476b-94e9-11264a8cfbe7` | 04:34:15 | raw/388.wav | completed |
| 389 | `en-w5-w2-8c0a3f3e` | 1 | `34297302-9691-41c4-bb71-937c8f280119` | 04:34:15 | raw/389.wav | completed |
| 390 | `zh-w5-w2-9844f094` | 1 | `e097f185-afb1-4546-aedc-6494dd68ff16` | — | — | failed (refunded), resubmitted |
| 391 | `en-w5-w2-9844f094` | 1 | `24f6d0c3-719f-49aa-a63e-6e1f87780bae` | — | — | failed (refunded), resubmitted |
| 392 | `zh-w5-w2-f14792e8` | 1 | `e5ad2656-7206-4429-897b-c132a0e86226` | 04:34:14 | raw/392.wav | completed |
| 393 | `en-w5-w2-f14792e8` | 1 | `6892e926-133d-4635-bfa2-9af6c12cd77d` | 04:34:14 | raw/393.wav | completed |
| 394 | `zh-w5-w2-db9c6280` | 1 | `ad93e7fb-7f40-4c72-9b5c-e310bb107ddf` | 04:34:14 | raw/394.wav | completed |
| 395 | `en-w5-w2-db9c6280` | 1 | `d557e98f-50eb-4b5d-b4b8-f3d80642c086` | 04:34:14 | raw/395.wav | completed |
| 396 | `zh-w5-w2-a9ea6146` | 1 | `b5af3d8f-dcbb-4534-8a4c-3364831d487b` | — | — | failed (refunded), resubmitted |
| 397 | `en-w5-w2-a9ea6146` | 1 | `2211d212-e878-46d0-b158-9cf2c7463fdc` | 04:34:50 | raw/397.wav | completed |
| 398 | `zh-realsf-parade-day` | 1 | `06370c63-abae-42c2-a472-57bf14937b13` | 04:34:50 | raw/398.wav | completed |
| 399 | `en-realsf-parade-day` | 1 | `a7843851-6a1b-431e-9f91-851d5b75ada4` | — | — | failed (refunded), resubmitted |
| 400 | `zh-realsf-parade-now` | 1 | `0c99b8f7-7a40-456b-bacd-635c6eea4190` | — | — | failed (refunded), resubmitted |
| 401 | `en-realsf-parade-now` | 1 | `91c5284c-bc42-42a1-9388-edfcfde46e85` | 04:34:50 | raw/401.wav | completed |
| 402 | `zh-realsf-parade-near` | 1 | `1051f178-9e9c-4676-bd84-a1d79b6acd6d` | 04:34:50 | raw/402.wav | completed |
| 403 | `en-realsf-parade-near` | 1 | `d791c005-3dae-4ec3-a5e7-23783241cbd6` | 04:34:50 | raw/403.wav | completed |
| 404 | `zh-realsf-parade-photo` | 1 | `f3c33479-a572-4db4-8357-efb9dbdce248` | — | — | failed (refunded), resubmitted |
| 405 | `en-realsf-parade-photo` | 1 | `4937cc41-7714-43cf-8e02-f8bd4f45b6b4` | — | — | failed (refunded), resubmitted |
| 407 | `zh-w5-k-83579ca0` | 1.3 | `5d6a190f-3508-4a4f-b4b4-db5b1867ab16` | — | — | failed (refunded), resubmitted |
| 408 | `zh-w5-k-7755a76a` | 1.15 | `3f2e0d1a-9fb2-42ba-b494-6b11fffbfbd2` | 04:35:16 | raw/408.wav | completed |
| 409 | `zh-w5-k-7755a76a` | 1.3 | `524b90c4-83b0-48bc-8a6a-413d987be26e` | 04:35:17 | raw/409.wav | completed |
| 312 | `zh-w5-a-d036bc6b` | 1 | `d5a5fc0d-77bc-4215-bfb1-51d15f4d477c` | 04:35:16 | raw/312.wav | completed |
| 320 | `zh-w5-a-c189fab9` | 1 | `ed6d9c78-6811-4965-8828-7bc33d436650` | 04:35:17 | raw/320.wav | completed |
| 338 | `zh-w5-a-529b6223` | 1 | `a44961a6-90a9-40fe-9d17-9f61132aa3f6` | 04:35:16 | raw/338.wav | completed |
| 344 | `zh-w5-a-02080b3a` | 1 | `0093141d-ba92-454b-82b0-48d8e8c7b633` | 04:35:16 | raw/344.wav | completed |
| 406 | `zh-w5-k-83579ca0` | 1.15 | `9fb6e0f4-fe64-421e-89f9-7a4b9e556d63` | 04:35:17 | raw/406.wav | completed |
| 300 | `zh-w5-a-f6168ad1` | 1 | `6eaf8bf2-61d5-4f2a-ab0b-2855ec47c283` | 04:41:19 | raw/300.wav | completed |
| 302 | `zh-w5-a-2344395c` | 1 | `fd68e261-85bc-4a13-84c1-2d58da7af8e8` | 04:41:19 | raw/302.wav | completed |
| 303 | `en-w5-a-2344395c` | 1 | `476c1f4d-9a47-41db-bbe2-36c200e428be` | 04:41:19 | raw/303.wav | completed |
| 304 | `zh-w5-a-c2c286b1` | 1 | `a0ef8911-696b-48b5-979c-efb13f4392ed` | 04:41:19 | raw/304.wav | completed |
| 307 | `en-w5-a-145988d4` | 1 | `8564857c-0714-4e8d-90fb-871e273946e5` | — | — | failed (refunded), resubmitted |
| 308 | `zh-w5-a-96c9bbc3` | 1 | `4bfcad81-28c4-4e95-aec8-b64b489489e1` | 04:41:19 | raw/308.wav | completed |
| 310 | `zh-w5-a-00bdef59` | 1 | `1d9ecdbe-3e79-4c9f-a0fc-8d9102fc84f5` | — | — | failed (refunded), resubmitted |
| 317 | `en-w5-a-c37a8eb0` | 1 | `1909c922-766a-443d-ada3-d7f1de07b768` | 04:41:20 | raw/317.wav | completed |
| 328 | `zh-w5-a-52d1ffc3` | 1 | `97d1986d-c8ad-4257-95eb-451bf2654454` | 04:41:19 | raw/328.wav | completed |
| 333 | `en-w5-a-0b092526` | 1 | `dcd61e64-40d3-4b4c-a32d-e8a1c463c38c` | 04:41:19 | raw/333.wav | completed |
| 341 | `en-w5-a-39f33bd2` | 1 | `d4ba2145-5068-467f-86aa-af000eaba56e` | — | — | failed (refunded), resubmitted |
| 343 | `en-w5-a-3e5b9d08` | 1 | `cdc7ff16-00b8-49fb-9517-738030f73885` | — | — | failed (refunded), resubmitted |
| 347 | `en-w5-a-c0b0dc0b` | 1 | `5643d1a2-90f0-4520-a4fa-8773b18f4486` | 04:41:53 | raw/347.wav | completed |
| 348 | `zh-w5-a-22ab87f6` | 1 | `6ef86f79-f95a-4f86-8ee1-77c70c6bfead` | 04:41:53 | raw/348.wav | completed |
| 349 | `en-w5-a-22ab87f6` | 1 | `c3a4b973-ede4-469e-bb9e-b57c596ad2f2` | — | — | failed (refunded), resubmitted |
| 350 | `zh-w5-a-4d43f1a8` | 1 | `ab23f3d2-2ac1-4223-acaf-8cfb22924e9c` | — | — | failed (refunded), resubmitted |
| 364 | `zh-w5-a-a9d45add` | 1 | `898ad1c5-b09c-4512-83c5-14282f4c9e2b` | — | — | failed (refunded), resubmitted |
| 369 | `en-w5-a-be5780ec` | 1 | `ac51ad56-3a56-44fb-b972-02fd8f720d61` | 04:41:53 | raw/369.wav | completed |
| 371 | `en-w5-a-402a365d` | 1 | `9198f732-7479-4752-a5a2-49f5f5643161` | 04:41:53 | raw/371.wav | completed |
| 373 | `en-w5-a-2dbc29a0` | 1 | `0e0e3685-56b5-48e2-a7f7-f9b769711088` | — | — | failed (refunded), resubmitted |
| 377 | `en-w5-a-ebf7391f` | 1 | `ebfb2fca-5536-4f5a-b9ea-c40e6e056fdc` | 04:41:53 | raw/377.wav | completed |
| 381 | `en-w8h-costume-pumpkin-bow` | 1 | `55230437-7d65-4965-a7ed-b94236e9dc7b` | 04:41:53 | raw/381.wav | completed |
| 383 | `en-w8-h-chinatown-contest` | 1 | `fdd9939c-ec9a-474a-b59c-27a06b391b47` | — | — | failed (refunded), resubmitted |
| 384 | `zh-w8-h-chinatown-lanterns` | 1 | `58216c3e-b281-4603-95b9-a446aeabd641` | 04:41:53 | raw/384.wav | completed |
| 390 | `zh-w5-w2-9844f094` | 1 | `e3b166d1-9896-4295-a0ba-4d80ed3bc05d` | 04:42:29 | raw/390.wav | completed |
| 391 | `en-w5-w2-9844f094` | 1 | `10403b53-73af-4a52-a56c-eff1089a846d` | — | — | failed (refunded), resubmitted |
| 396 | `zh-w5-w2-a9ea6146` | 1 | `721e0ba2-5483-4c58-8522-17f5e55f90d5` | 04:42:29 | raw/396.wav | completed |
| 399 | `en-realsf-parade-day` | 1 | `d8785b91-2599-45dc-b4c2-607493e7d9c7` | — | — | failed (refunded), resubmitted |
| 400 | `zh-realsf-parade-now` | 1 | `fd5e806a-b427-4258-a035-7c3125d3dea6` | 04:42:31 | raw/400.wav | completed |
| 404 | `zh-realsf-parade-photo` | 1 | `5758bff0-862f-4236-ae6e-3e6d8520684e` | 04:42:29 | raw/404.wav | completed |
| 405 | `en-realsf-parade-photo` | 1 | `5ab3f937-2a0e-498f-9315-68a1e8361243` | 04:42:29 | raw/405.wav | completed |
| 407 | `zh-w5-k-83579ca0` | 1.3 | `bda4169b-ff57-434a-a8dc-36c964c997b6` | 04:42:29 | raw/407.wav | completed |
| 341 | `en-w5-a-39f33bd2` | 1 | `7bc0fd2f-de24-479a-bdc1-95e6513c7733` | 04:45:20 | raw/341.wav | completed |
| 343 | `en-w5-a-3e5b9d08` | 1 | `1e9a9626-d7d5-436c-a5b0-4eb8544ec2b7` | 04:45:20 | raw/343.wav | completed |
| 349 | `en-w5-a-22ab87f6` | 1 | `dfb23904-2679-4900-b1a3-b5deec2bbcb1` | — | — | failed (refunded), resubmitted |
| 350 | `zh-w5-a-4d43f1a8` | 1 | `1e190456-7ffd-4440-a735-38850763420e` | — | — | failed (refunded), resubmitted |
| 364 | `zh-w5-a-a9d45add` | 1 | `6ec3ae1b-7bc4-4051-9c67-d4d373b28ad1` | 04:45:20 | raw/364.wav | completed |
| 373 | `en-w5-a-2dbc29a0` | 1 | `daffcba8-e935-4298-9faa-3e7ea7eea90d` | 04:45:20 | raw/373.wav | completed |
| 383 | `en-w8-h-chinatown-contest` | 1 | `7e00310d-fae3-455f-8767-f7b8b5313a2d` | 04:45:20 | raw/383.wav | completed |
| 391 | `en-w5-w2-9844f094` | 1 | `80714723-e1f2-46c0-b8d7-130b8de6b1df` | — | — | failed (refunded), resubmitted |
| 399 | `en-realsf-parade-day` | 1 | `ce8dbf1f-cdbb-4e2c-b471-a980e87c55fb` | — | — | failed (refunded), resubmitted |
| 307 | `en-w5-a-145988d4` | 1 | `eeee34b5-496b-445c-b915-c3b1721f6783` | 04:45:37 | raw/307.wav | completed |
| 310 | `zh-w5-a-00bdef59` | 1 | `f2a284b3-cfbb-4c94-9a85-d9672491c295` | 04:45:35 | raw/310.wav | completed |
| 349 | `en-w5-a-22ab87f6` | 1 | `ac3a4cd9-af22-45b0-82bd-e0ac83f75d61` | 04:48:22 | raw/349.wav | completed |
| 350 | `zh-w5-a-4d43f1a8` | 1 | `ccaf18b0-a06f-476b-9e08-73fa52a7c5b5` | 04:48:22 | raw/350.wav | completed |
| 391 | `en-w5-w2-9844f094` | 1 | `3b9ae801-ba65-4e28-a70a-a843ad0c386e` | 04:48:22 | raw/391.wav | completed |
| 399 | `en-realsf-parade-day` | 1 | `45553b11-b830-4118-9335-6c0ac97a15be` | 04:48:23 | raw/399.wav | completed |

## Batch 4 · lanes A, W1, W2 and M's lines on origin at 22:15 PDT (W8-X6), 2026-10-01 05:24–05:33 UTC

Balance before: **358.43**. 18 new lines × zh / en — lane A's `ALCA_LINES` (7: boarding, ashore, the stair, the cellhouse,
the 1969–71 occupation, the way back, back at Pier 33 — all read "soft, gentle and respectful"), lane W1's
`W8_W1_LINES` (3 sight lines: the pagodas, Old St. Mary's bells, the O'Brien at Normandy; their own ids), lane W2's
Blue Heron Lake lines (3, `westLines.ts`), lane M's reworded busker / foghorn lines (5, the play/ scan) — + 10 redo takes
of batch 3's 5 muted clips = **46 takes** (indices 500–545). 25 jobs failed (refunded) and one submission was answered 429;
the new lines' takes were resubmitted until all were in (the four redo takes whose sibling take came in were not).
`post.py --prune` dropped the two lines lane M reworded after batch 3 (`w5-a-3e5b9d08` 街头艺人下午才来哦…, `w5-a-4aa60f8a`
南塔的雾笛就在头顶！…: rows and files).

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W8X-VO8 | 36 clips (18 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | verbatim | 0.01–0.05 a take | table below | `public/opus-bay/w8/voice/` | 36 used; 35 pass, **1 muted** (`zh-w5-al-cd19434a` 监狱楼在坡顶上…: clipped samples) |
| W8X-VO9 | 6 redo takes that came in | same, 1.15 / 1.3 | verbatim | 0.01 a take | below | clips replaced | 松得正好！滑过去～, 松闸、刹车，停得稳稳的！, We’re off: grip!, Nice driving! now pass and play; 当——当——当！ still muted |

**Credits:** balance 358.43 → **357.38** = 1.05, of which **0.99** this batch (05:24:53–05:33:27 UTC); two TTS spends of
0.03 at 05:44:46 / 05:44:48 UTC are not this lane's (nothing submitted then). **Wave-8 lane X running total: 5.33.**

| take | clip | rate | job id | created (UTC) | output | status |
|---|---|---|---|---|---|---|
| 500 | `zh-w5-a-17acef05` | 1 | `9d43aebd-79aa-4e57-8dc1-d318ce7579c4` | — | — | failed (refunded), resubmitted |
| 501 | `en-w5-a-17acef05` | 1 | `5c6848a5-1e2a-4f13-abbb-8d379f01397e` | — | — | failed (refunded), resubmitted |
| 502 | `zh-w5-a-a7d44dbd` | 1 | `bbc072b6-6d97-41e3-a43f-86fc2b1979d0` | 05:24:53 | raw/502.wav | completed |
| 503 | `en-w5-a-a7d44dbd` | 1 | `666dbc4f-efb9-45f0-bc9e-1c644fd312a5` | — | — | failed (refunded), resubmitted |
| 504 | `zh-w5-a-13cc9833` | 1 | `2e0c47d8-385a-4477-ae65-c86bf88f0682` | 05:24:53 | raw/504.wav | completed |
| 505 | `en-w5-a-13cc9833` | 1 | `75f35042-9388-4ed9-8969-24ebdad63866` | 05:24:53 | raw/505.wav | completed |
| 506 | `zh-w5-a-2934c9a3` | 1 | `d762019a-5ca5-49d3-9994-3cd84182064e` | — | — | failed (refunded), resubmitted |
| 507 | `en-w5-a-2934c9a3` | 1 | `52a3f454-2df8-415f-80ef-8f6965879dd0` | 05:24:53 | raw/507.wav | completed |
| 508 | `zh-w5-a-41359d1c` | 1 | `07e83061-2e6a-43e6-9c23-2dc62666185f` | 05:24:53 | raw/508.wav | completed |
| 509 | `en-w5-a-41359d1c` | 1 | `65f2ad5a-4e6f-4d2d-ae15-eef5e1c20a9b` | — | — | failed (refunded), resubmitted |
| 510 | `zh-w5-w2-8d4ca008` | 1 | `751df012-e0c8-4e3f-904d-5bb55b5354b4` | — | — | failed (refunded), resubmitted |
| 511 | `en-w5-w2-8d4ca008` | 1 | `fe726939-dc07-4255-aeb7-fb453caf7562` | — | — | failed (refunded), resubmitted |
| 512 | `zh-w5-w2-559a3fc8` | 1 | `08df8872-1473-490a-8946-d0e014c1312d` | 05:25:53 | raw/512.wav | completed |
| 513 | `en-w5-w2-559a3fc8` | 1 | `f808ad3c-26ed-4fcb-9c02-ef9639315158` | 05:25:53 | raw/513.wav | completed |
| 514 | `zh-w5-w2-3f60dca9` | 1 | `9d58efec-d492-45fd-b626-f6035ef7615e` | 05:25:53 | raw/514.wav | completed |
| 515 | `en-w5-w2-3f60dca9` | 1 | `249a1131-7e51-46d9-939c-9eaa725b623f` | 05:25:53 | raw/515.wav | completed |
| 517 | `en-w5-al-9a4f2404` | 1 | `b8ca7c4d-31bc-46c6-8024-5fcd4ca8586b` | — | — | failed (refunded), resubmitted |
| 518 | `zh-w5-al-ae4cef3d` | 1 | `ee2bae3e-d0aa-4fbc-981a-f049e63b5a42` | — | — | failed (refunded), resubmitted |
| 519 | `en-w5-al-ae4cef3d` | 1 | `379e11be-b54f-443b-88af-58ed60722321` | — | — | failed (refunded), resubmitted |
| 520 | `zh-w5-al-5b488218` | 1 | `c563892c-7dea-4229-9213-885bac573204` | — | — | failed (refunded), resubmitted |
| 521 | `en-w5-al-5b488218` | 1 | `e7f6f092-08f1-46e2-8af0-677c017fdd87` | 05:25:53 | raw/521.wav | completed |
| 522 | `zh-w5-al-cd19434a` | 1 | `c3e4e5b0-1164-4877-8239-95d892abb5cc` | — | — | failed (refunded), resubmitted |
| 523 | `en-w5-al-cd19434a` | 1 | `ba6b5cf6-ec39-4866-9485-f5d6b6638914` | — | — | failed (refunded), resubmitted |
| 516 | `zh-w5-al-9a4f2404` | 1 | `21852c12-22f6-42b3-b0bd-52af97268116` | — | — | failed (refunded), resubmitted |
| 524 | `zh-w5-al-d5b49c34` | 1 | `39044179-a50c-46ee-8dbf-d9d402f61750` | — | — | failed (refunded), resubmitted |
| 525 | `en-w5-al-d5b49c34` | 1 | `b590a4e4-19f6-4373-b167-9d19d896cf22` | 05:26:52 | raw/525.wav | completed |
| 526 | `zh-w5-al-3748ec64` | 1 | `1d6ccfff-4c42-4b48-ab28-f3fbd8bc87d4` | 05:26:52 | raw/526.wav | completed |
| 527 | `en-w5-al-3748ec64` | 1 | `9a47cf06-de33-43f1-a97d-fcf7681789fd` | 05:26:52 | raw/527.wav | completed |
| 528 | `zh-w5-al-1d5f1d1f` | 1 | `e8598429-0bb3-4879-93ee-d457a7a50539` | 05:26:53 | raw/528.wav | completed |
| 529 | `en-w5-al-1d5f1d1f` | 1 | `c72b0a4b-4d7d-430d-a850-f4398570468d` | — | — | failed (refunded), resubmitted |
| 530 | `zh-w8w1-pagodas-ahead` | 1 | `27cf2971-cc5e-425d-9177-d1dd4c7dfd19` | 05:26:53 | raw/530.wav | completed |
| 531 | `en-w8w1-pagodas-ahead` | 1 | `68e5df35-40c4-430b-ba99-834298f53ed0` | 05:26:52 | raw/531.wav | completed |
| 532 | `zh-w8w1-st-marys-bells` | 1 | `b778a105-6c76-4c9f-873f-8d19a3b62462` | 05:26:52 | raw/532.wav | completed |
| 533 | `en-w8w1-st-marys-bells` | 1 | `2b12582b-a8d7-4813-8275-73a0d4517f65` | — | — | failed (refunded), resubmitted |
| 534 | `zh-w8w1-obrien-normandy` | 1 | `78e1cf17-6223-4f85-85c1-a24a84a5f037` | 05:26:52 | raw/534.wav | completed |
| 535 | `en-w8w1-obrien-normandy` | 1 | `d9cf375d-e0ec-454d-bf98-fbee7f21a9ee` | 05:27:52 | raw/535.wav | completed |
| 536 | `zh-w5-k-83579ca0` | 1.15 | `6335679a-91b0-4798-9d53-3d8b0a1e9249` | 05:27:52 | raw/536.wav | completed |
| 537 | `zh-w5-k-83579ca0` | 1.3 | `3af1a3d0-cc53-4ad7-ad2c-2f510896bfe8` | — | — | failed (refunded) |
| 538 | `zh-w5-a-96c9bbc3` | 1.15 | `832ae634-4e96-4f43-857c-527b7a14b4af` | — | — | failed (refunded) |
| 539 | `zh-w5-a-96c9bbc3` | 1.3 | `d7c0fad8-2e84-490f-b8e2-d44a2e6e1c94` | 05:27:52 | raw/539.wav | completed |
| 540 | `zh-w5-a-61c180e4` | 1.15 | `c63eb900-6ba2-4ea6-b897-a1863b3a8abe` | 05:27:52 | raw/540.wav | completed |
| 541 | `zh-w5-a-61c180e4` | 1.3 | `4d3539bd-53cb-41ab-a274-0a189108bdae` | — | — | failed (refunded) |
| 542 | `en-w5-a-db91854d` | 1.15 | `b135b661-2264-4f4b-b68a-104473ded513` | — | — | failed (refunded) |
| 543 | `en-w5-a-db91854d` | 1.3 | `c94c6997-112f-46c3-96c0-6c210a10bdb9` | 05:27:52 | raw/543.wav | completed |
| 544 | `en-w5-a-f1002ae5` | 1.15 | `6b285b7b-8514-42dd-95bf-989561801b0c` | 05:27:52 | raw/544.wav | completed |
| 545 | `en-w5-a-f1002ae5` | 1.3 | `4e2adff4-53da-4c4f-b15f-622109016b3f` | 05:27:52 | raw/545.wav | completed |
| 500 | `zh-w5-a-17acef05` | 1 | `36d42931-fa4b-48a4-9077-c43dc1173b90` | 05:31:03 | raw/500.wav | completed |
| 501 | `en-w5-a-17acef05` | 1 | `f925e026-7fc1-4580-bd4c-aaf0c81d17e5` | 05:31:03 | raw/501.wav | completed |
| 503 | `en-w5-a-a7d44dbd` | 1 | `33c37d38-22ce-4c35-9573-7193891facd8` | 05:31:04 | raw/503.wav | completed |
| 506 | `zh-w5-a-2934c9a3` | 1 | `72030df4-c3fd-436f-b433-5b49ae9ff782` | 05:31:04 | raw/506.wav | completed |
| 509 | `en-w5-a-41359d1c` | 1 | `a90f8f9d-746d-4549-b747-eeded72e1bd6` | — | — | failed (refunded), resubmitted |
| 510 | `zh-w5-w2-8d4ca008` | 1 | `995772bf-ec9d-49bc-bd29-9028fe27e9f6` | — | — | failed (refunded), resubmitted |
| 511 | `en-w5-w2-8d4ca008` | 1 | `2da4b3bc-8b0c-45af-85a6-578ea922cd89` | — | — | failed (refunded), resubmitted |
| 517 | `en-w5-al-9a4f2404` | 1 | `a2844871-b26e-4423-8684-f2f054e65777` | 05:31:04 | raw/517.wav | completed |
| 518 | `zh-w5-al-ae4cef3d` | 1 | `f59a1191-705b-4c49-ab45-31eb2a0c33b7` | — | — | failed (refunded), resubmitted |
| 519 | `en-w5-al-ae4cef3d` | 1 | `b4d2e086-5c3a-420e-bc40-5e8991898c22` | 05:31:04 | raw/519.wav | completed |
| 520 | `zh-w5-al-5b488218` | 1 | `a6db1f02-62b2-4405-af34-f711d2d9a62b` | 05:31:04 | raw/520.wav | completed |
| 522 | `zh-w5-al-cd19434a` | 1 | `3bec8bff-eb82-4e02-a87f-dc85e2cea8f9` | 05:31:04 | raw/522.wav | completed |
| 523 | `en-w5-al-cd19434a` | 1 | `84472e8b-ef55-41b0-aa61-7f1c89149c63` | 05:31:48 | raw/523.wav | completed |
| 516 | `zh-w5-al-9a4f2404` | 1 | `625df66e-c341-48d2-874e-a6527241efc6` | 05:31:48 | raw/516.wav | completed |
| 524 | `zh-w5-al-d5b49c34` | 1 | `899293dc-8f5a-4375-a974-462154abed45` | 05:31:48 | raw/524.wav | completed |
| 529 | `en-w5-al-1d5f1d1f` | 1 | `b160801e-cf7c-4479-ac2a-5c4304f02fd7` | 05:31:48 | raw/529.wav | completed |
| 533 | `en-w8w1-st-marys-bells` | 1 | `1e54ff02-3f07-4389-9635-da3eb0b5e383` | 05:31:48 | raw/533.wav | completed |
| 509 | `en-w5-a-41359d1c` | 1 | `109da8ad-d19d-4b69-bc50-9c07803594dd` | 05:33:27 | raw/509.wav | completed |
| 510 | `zh-w5-w2-8d4ca008` | 1 | `5fb6b8b4-1575-4eb5-b554-0ae9f121fa2d` | 05:33:27 | raw/510.wav | completed |
| 511 | `en-w5-w2-8d4ca008` | 1 | `e171d378-748d-4d9a-a221-d8387cec777c` | 05:33:27 | raw/511.wav | completed |
| 518 | `zh-w5-al-ae4cef3d` | 1 | `050a726a-03f1-4db9-8880-0cbc0499322f` | 05:33:27 | raw/518.wav | completed |
