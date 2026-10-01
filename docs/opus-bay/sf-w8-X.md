# Wave 8 · lane X · looks, sound, voice (+ Higgsfield)

Worktree `C:/Users/willy/wt/w8-x` (branch `w8-x`), dev port 5810, scratch `C:/Users/willy/opus-qa/w8/x/`, ledger
`docs/opus-bay/ledger/w8-X.md`, QA files `docs/opus-bay/qa/w8/X/`. The main Higgsfield spender of wave 8 (cap 240, the
shared balance never under 20). Run inside the Ultra workflow `wf_66c65596-f6a` (lead note §7): this agent resumed the
lane's first agent (19:00–19:20 PDT, nothing committed).

## 给主人的摘要

1. BAYBAY 的配音继续补齐：第七波小游戏（抓娃娃机、码头捞螃蟹、捏酸面包）的 34 句和出行/坐车时的 18 句提示（让路、提前下车、"坐过一站才算坐过"等）全部录好，中英文共 104 条，还是 Pixie 的声音。5 条短句读得太慢或有爆音，先静音（气泡照常显示），等你在试听单里点头。
2. 第七波因为"读得太慢"被静音的 8 条短句重新录了更快的版本：7 条通过检查并被语音识别听对，已经替换并恢复发声；英文 "Ho! Spot on!" 还是没过，继续静音。
3. 试听单：`docs/opus-bay/qa/w8/X/voice/listening.md`（每条一行，最后一栏写 ✗ 或 重录）；整批连播：同目录 `w8-voice-preview-b1-zh.m4a` / `-en.m4a`。
4. Higgsfield 这批只花了 1.92 分（第一位 agent 提交的录音，这次直接取回结果，没有重复付费；失败的任务都退款了）。

## Part a · BAYBAY's voice, batch 1 (2026-09-30 19:24–19:45 PDT)

### Resumed work

The first agent left, uncommitted: the preflight of `ledger/w8-X.md`, `scripts/opus-sf/voice/w8/lines.ts` (the
inventory: wave 7's inventory + lane K's plain bubbles + the retakes of wave 7's muted clips) and
`scripts/opus-sf/voice/w8/post.py` (wave 7's chain with wave-8 paths and the retake rule), and 120 TTS takes already
submitted. All of it was kept: the inventory still lists exactly the 52 lines the takes were made for after rebasing onto
`origin/opus-bay` (lane K's `W8-K1` changed no line), 119 / 120 results were already fetched to `raw/`, the last one
(take 114) had failed twice (`jobs_wait`: failed) — its sibling take at rate 1.3 covers that clip. Nothing was paid
twice. Nothing of the first agent's was discarded.

### What was built (W8-X1)

| file | change |
|---|---|
| `scripts/opus-sf/voice/w8/lines.ts` (new) | the inventory over waves 5–7's inventories (`w7Lines`) + `W8_SOURCES` (lane K's plain `bubble()` literals in `game/tripRun.ts`, `transit.ts`, `flow.ts`, `lineRides.ts`, `cityTour.ts`, picked by exact zh; wave 8's new tables are added here as the lanes push them) minus every text a voice table has; `EXCLUDE_SOURCES_W8` (the fortune teller's printed card, `play/fortune.ts`: paper, not a bubble); `RETAKES_W8` (the 8 clips of `W7_VOICE_CHECK`, two faster takes each) |
| `scripts/opus-sf/voice/w8/post.py` (new) | W5-V7's chain unchanged (trim, fades, two-pass loudnorm −18 LUFS / TP −1.5, AAC 64k + Opus 48k mono, wave 4's sentence gates, the Windows closed-grammar recogniser as an advisory check); a retake of a muted wave-7 clip is kept only if it passes every gate **and** is heard right; writes `voiceW8.ts`, the report, the previews and the listening sheet |
| `src/opus-bay/data/sf/voiceW8.ts` (generated) | `W8_VOICE_LINES` (52), `W8_VOICE_CHECK` (5 muted clips), `W8_VOICE_CLIPS` (104), `W8_RETAKE_CLIPS` (7, under their wave-7 ids) |
| `src/opus-bay/game/voiceW5.ts` (the binder) | imports wave 8's table first; matches `W8_VOICE_LINES` by exact zh + en after the earlier tables (an earlier recording of the same words still wins; `own` texts excluded); new `w5VoiceMuted(clip)`: every wave's CHECK list, except a wave-7 clip whose wave-8 retake was kept |
| `public/opus-bay/w8/voice/` (new) | 111 clips × m4a + ogg (104 new + 7 retakes), 5.9 MB, lazy (a clip loads when BAYBAY first says it) |
| `docs/opus-bay/qa/w8/X/voice/` (new) | `listening.md` (the owner's sheet), `w8-voice-report.json` (every take, gates, picks, files with sha256), `w8-voice-preview-b1-{zh,en}.m4a` |
| `tests/opus-bay-w8-x-voice.test.ts` (new) | 2 tests: every wave-8 line has both files on disk, is said verbatim somewhere in `src/opus-bay` (no dead clip), has no id or text of an earlier table, and BAYBAY's bubble with its exact text finds it; every claw / crab / sourdough line of `sfgamesLines.ts` is voiced; the muted clips stay text only; a kept retake plays from `/w8/voice/` under the wave-7 id and is unmuted, the rejected one stays muted with no file registered; the binder's import order |

### Evidence

- Batch 1: 104 clips, **99 pass the gates**, **95 heard right** by the recogniser (advisory). Muted until the owner
  approves them (rate gate: short calls read slowly; one take with clipped samples): `zh-w5-a-eb85ad0b` 金黄酥脆！完美！
  (3.33 s), `zh-w5-k-83579ca0` 当——当——当！ (2.16 s — a bell imitation, slow by nature), `zh-w5-k-eabf6332` /
  `en-w5-k-eabf6332` 嗯～好吃！ / Mmm, tasty!, `zh-w5-k-2a49803a` 这段路有点难走，你来带路吧！ (clipped).
- Retakes: 7 / 8 replace their muted wave-7 clip (e.g. 哎哟，碰到啦～ 2.27 → 2.00 s heard 0.99; Not quite! heard 0.78); "Ho!
  Spot on!" (en) was not heard in either take: wave 7's clip stays muted.
- Checks of this commit: `tsc` 0 · `eslint .` 0 errors · the voice tests (w8-x-voice, w7-x-voice, w6-x, asset-files,
  w4-assets, w8-k1-hold) 33 / 33 · the opus-bay suite before the push (numbers in the commit message).
- Higgsfield: **1.92** credits (ledger `docs/opus-bay/ledger/w8-X.md`, one row per job).

### Decisions

- Lane M's wave-7 lines keep wave 5's id scheme (`w5-a-<hash>`: the play/ scan's lane letter), like waves 6–7.
- The 5 muted clips are left to the owner's ear or to the next batch's faster retakes (batch 2 retakes them at 1.15 / 1.3).
- The bell call 当——当——当！ is a fair case for the owner to approve as is (the gate measures speech, not a bell).
