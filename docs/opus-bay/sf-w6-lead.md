# Wave 6 · plan and lead note (day 0)

Written 2026-09-29 ≈ 01:50 PDT by the lead in `C:/Users/willy/wt/w6-day0`. The owner's brief (2026-09-29 01:40 PDT,
"直接做，不用经过我同意"): continue Opus Bay the same way as wave 5 — first the small problems and the skipped review the
hand-off recorded, then **Halloween before 10/31**, then more San Francisco, content and play; Higgsfield **up to 1000
credits, every charge in a ledger**; sync the site's newest content (GPT's autumn release) into the 3D world where it
fits; merge to `main` (go live) once the checks pass. Later message: where models, visuals, animation or sound need to
be better, generate and improve them directly. **Hard stop: everything pushed by 07:30 PDT, the owner shuts the machine
down at 07:45.**

## 0. 给主人的摘要

1. 第六波 9 条线同时开工：两条补小问题（手感/界面、流程/内容），一条补做车辆卡死审查 + 公交细节，一条首屏瘦身，两条万圣节（城市装扮 + 南瓜灯寻宝 + 亡灵节；不给糖就捣蛋 + 万圣节服装），一条同步网站新资讯（GPT 更新的秋季活动/优惠/新店），一条新玩法和街区，一条视觉/模型/声音升级（唯一花 Higgsfield 的线，上限 1000）。
2. 万圣节 10/1–10/30 装扮和寻宝，10/31 是"大夜晚"（每家都开门、双倍糖），11/1–2 亡灵节；正式网站加 `?halloween=1`（或 `night` / `muertos`）今天就能预览。
3. 每条线做完都有一位审查员逐条复查、手机 390×844 实玩；最后总验收通过后合并到 main 上线。

## 1. State at day 0

- `origin/opus-bay` = the go-live hand-off `7889a7ed` (= `origin/main` before GPT's release). **W6-0c** merged
  `origin/main` (`a8fad4ad` autumn content: 267 events / 86 offers / 44 openings, `live.json` refreshed; `c5d294c4` split
  route allowlists) into `opus-bay`: `b35995a6`, clean. The wave's only merge (the go-live at the end is a fast-forward of
  `main`, or one more merge of `origin/main` if GPT pushed again).
- Baseline after the merge: `tsc` 0 · `eslint .` 0 errors (43 old warnings) · opus-bay suite **1376 / 1376**.
- W5-Z numbers stay the perf baseline (`sf-w5-final-verify.md`): desktop max 119 calls / 352k; phone 4× min 52.8 fps;
  GameRoot 298.62 KB gzip.
- Higgsfield `balance` **2375** (2026-09-29 08:36 UTC a 2000 "Credit Reset Bonus" on top of 375). Wave-6 cap **1000**
  (owner), lane X only; floor 1375.

## 2. Timeline (PDT, 2026-09-29)

| when | what |
|---|---|
| 02:40 | lanes start (parts a → b; push after every part) |
| 04:50 | lanes stop starting new work; 05:05 last push + report |
| 05:05–06:05 | one adversarial reviewer per lane (as each lane ends) |
| 06:05–06:50 | W6-Z final verify (alone on the machine, PERF-LOCK) |
| 06:50–07:15 | the lead: go-live (main), deploy check on baylink.us |
| 07:15–07:30 | hand-off: `sf-w6-summary.md`, ledger → ASSETS-LEDGER, RESUME top section |

The mid-wave checkpoint is folded into the reviews (time). A lane that finishes early stops; nobody starts work after
04:50 that cannot be pushed green by 05:05.

## 3. Lanes and ownership

Worktree `C:/Users/willy/wt/w6-<id>` (branch `w6-<id>`, `node_modules` junction to the main checkout's), scratch
`C:/Users/willy/opus-qa/w6/<id>/`, report `docs/opus-bay/sf-w6-<ID>.md`, QA images `docs/opus-bay/qa/w6/<ID>/`.

| lane | port | owns (edit only these; anything else: a small, surgical fix named in the commit and the report) | work |
|---|---|---|---|
| **K1** · feel & play fixes | 5601 | `actors/**`, `play/**` (except new files of W), `eggs/**` | NEXT P0 #2 the floating stick's base in client coordinates; P1 #7 (F): deck / auto-glide per-frame garbage, BAYBAY's far talk-target guard, the stale E prompt label (`interactablesEpoch`), `useTimeOfDay` on a world switch, the ferry's 车厢里 chip, the Hyde St ride camera; #9 (D) the sea-otter egg's height check (fires on the GGB deck), the Castro prints' rebuild floor; #11 (A) prefetch `play/rings` at the unlock, heave-ho vs boarding prompt, stair-race / bell-pad garbage; the mantle in the district (gate it to the city) |
| **K2** · flow, UI & content fixes | 5602 | `game/**` (except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`), `ui/**`, `economy/**` (except G's appended items) | with Settings open the tour bus still boards and drives on (Settings pauses the world like the other panels); on phones the ARRIVED card can cover an open More menu; 国际橘 → **国际橙** everywhere (shop items, `data/VOICE.md`); #8: no 飞行券 during goal #1's lead, rewards emitted before the ledger is live, `cityAreaAt` with height on the deck, the new-save goals card over the ringing phone, a quiet first discovery batch on resume, re-time the Grand Tour quotes (约 34 / 25 → measured 36 / 29); leaked `activity` / `shop` / `panel` holds get a 90 s timeout; `src/opus-bay/STATUS.md` rewritten for the city default |
| **B** · bus review & transit | 5603 | `world/busSystem.ts`, `world/flineSystem.ts`, `world/sf/{lineInterlocks,traffic,tourBus,lineFleet,stations}.ts`, `data/transit.ts`, `data/fline.ts`, `data/ferry.ts`, `tests/opus-bay-w5-deadlock.test.ts` | the **adversarial review of W5-bus that was skipped** (`5a726a5a`, `1ad63d6a`, `ec4f3a10`, `ce073ce9`, `52091013`): read every commit, play it (desktop + 390 × 844), judge the previous reviewer's unfinished edits (`C:/Users/willy/opus-qa/w6/b/w5-bus-uncommitted.diff`, from `C:/Users/willy/wt/w5-bus`: keep what is right, redo it on the new tree), fix and push; #10 retire the M stop San Jose & Mt Vernon, zh cable-car stop names, the shared Hyde St box; #13 `ferry:sausalito` (a waiver or a quay on the model) |
| **P** · first-load size | 5604 | `game/GameRoot.tsx`, `vite.opus.config.ts`, `tests/opus-bay-sf-budget.test.ts`, import sites that move a module behind the city chunk | GameRoot **298.62 → ≤ 265 KB gzip** (MF9 / D16): F's city-only actor modules and vehicles, C's POI bodies / script / residents, N's city-only modules behind the city chunk (lane V's review lists sizes); district mode unchanged; prove it with the build's chunk table |
| **H** · Halloween world | 5605 | `halloween/world.ts` + new `halloween/world*/`, `halloween/hunt*`, `halloween/muertos*`, `realsf/dressing.ts`, `realsf/seasons.ts` | the season in the world from `halloween/season.ts`: pumpkins and jack-o'-lanterns on Victorian stoops across the residential city (not only the Painted Ladies), orange porch lights at night, bats over Alamo Square / Twin Peaks, cobwebs, a few costumed crowd figures, a haunted glow at a spooky landmark; **the pumpkin hunt** (up to 40 hidden jack-o'-lanterns, rewards `pumpkin:n`, `hunt:10/20/all`; glowing at night, a notebook count); **Día de los Muertos** (1–2 Nov: marigolds and papel picado in the Mission, the real procession route / altars — verified on the web with source + date); all within the perf budget (merged geometry, one material, built near the player) |
| **G** · Halloween games & costumes | 5606 | `halloween/play.ts` + new `halloween/play*/`, `halloween/treat*`, `halloween/costume*`, `halloween/lines.ts`; APPEND-ONLY additions to `economy/items.ts` (+ what wearing a new item needs in `economy/wear.ts` / `actors/recolor.ts` — name each edit) | **trick-or-treat**: knock on decorated doors (up to 60, `door:n`; on 31 Oct `night:n`), BAYBAY says 不给糖就捣蛋！, a candy bag, treats → coins; the doors glow brightest 16:00–22:00 (`isTreatHour`); **costumes** in the 小铺 (e.g. witch hat / pumpkin head / ghost sheet / cat ears for BAYBAY and the player, bat wings for the pelican), try-on, `costume:first`; a Halloween goal in the goals card and a 万圣节 page in the notebook; **BAYBAY's Halloween lines** in `halloween/lines.ts` (zh + en, 简体/繁體 through the site's conversion) — **push the line table by 03:30** so lane X can record them |
| **S** · site sync (GPT's autumn release) | 5607 | `realsf/{eventVenues,eventKit,events,calendar,live,daily,todayRows,todayLine,TodayTab}.ts(x)`, `scripts/opus-sf/export-live.ts`, `public/opus-bay/sf/v1/live.json` | the new catalog (`/planner-catalog.json`, 267 events) in the world: every **San Francisco** event of Oct–Nov whose venue is a real place in the toy city gets a venue row (OSM-checked point on the walking network, a kit, hours where the organiser gives them) — first the Halloween ones (`sf-halloween-hoopla-2026` is in; `sf-sunnydale-pumpkin-fest-2026`, `sf-family-connections-halloween-2026`), Día de los Muertos (hand the verified date / route to H), then the rest by date; the 今天 tab / 这周去哪 with the refreshed offers; the new openings where the site gives a verifiable SF address (a small 新店 sign, never a guessed point); `live.json` re-exported only through `export-live.ts` |
| **W** · more San Francisco & play | 5608 | new `play/{hideSeek,lyonSteps}*.ts`, `play/stairCourses.ts` (Lyon St), `world/sf/{look,hero,heroGround,build,cell}.ts` for the seam, new `world/sf/corners*` | the North Beach seam gap (NEXT #15), then the **North Beach corner** (Washington Square, Saints Peter & Paul's white towers, café tables on Columbus); the **Lyon St steps** stair course; **hide & seek with BAYBAY** (she hides near a landmark, warmer / colder hints, a find reward through an existing prefix); one more thing a new player can do anywhere in 2 minutes if time allows |
| **X** · visuals, models, animation, sound (+ Higgsfield) | 5609 | `game/voiceW5.ts`, `data/sf/voiceW5.ts` + new `data/sf/voiceW6.ts`, `audio/**`, `public/opus-bay/w6/**`, `scripts/opus-sf/{voice,assets}/w6/**`, `docs/opus-bay/ledger/w6-X.md`, model swaps in `world/models.ts` / `actors/models.ts` | **the only Higgsfield spender, cap 1000** (floor 1375; read `balance` before and after every batch; every job a ledger row: time, model, credits, file, kept / rejected). (1) Halloween: BAYBAY's Halloween voice lines (G's `halloween/lines.ts` + H's lines, zh + en, the Pixie voice W5 used, matched by text like W5-V7), trick-or-treat / spooky SFX, a Halloween postcard set for the hunt's end and the big night, Halloween key art for the title in season; GLBs (jack-o'-lantern, ghost, witch hat) only if they beat the procedural ones in a side-by-side shot. (2) The owner's "直接优化": shoot the city on desktop and 390 × 844, pick the 3–5 weakest things a player sees most (a model, an animation, a texture, a sound) and make them clearly better, before / after shots in the report. (3) V's voice batch 5 (NEXT #12). Hand lanes H / G any asset they asked for through their Requests. |

Everyone: `src/opus-bay/**` outside the table only for a surgical fix you name. `core/**` (except `core/events.ts`,
frozen), `data/playSave.ts`, `data/save.ts`, `game/w5Features.ts`, `halloween/{index,season,rewards}.ts`, `vercel.json`,
`package*.json`: **frozen** (the lead only; write the exact change under Requests). **District mode never changes**.

## 4. Frozen contracts landed at day 0 (`W6-0d`)

- `core/events.ts`: `{ type: 'halloween'; what: 'pumpkin' | 'treat' | 'costume' | 'phase'; id: string }`; reward prefix
  **`halloween`** appended to `REWARD_PREFIXES` / `REWARD_SOURCE`.
- `data/playSave.ts`: `PLAY_BIT_KINDS` += `'halloween'` (appended). `economy/ledger.ts`: `REWARD_CAPS.halloween = 25`,
  `PREFIX_KIND.halloween = 'halloween'`.
- `game/w5Features.ts`: `W5_FEATURES` += `'halloween'` → `halloween/index.ts` (a lazy chunk after the economy, city only).
- `halloween/season.ts`: `halloweenPhase(date?, search?)` → `'off' | 'season' (1–30 Oct) | 'night' (31 Oct) | 'muertos'
  (1–2 Nov)`, `inHalloween`, `isTreatHour` (16:00–22:00 Bay), `halloweenPreview()` (`?halloween=1|season|night|muertos|off`
  in any build, production too — the owner can preview today), `HALLOWEEN_DATES`.
- `halloween/rewards.ts`: `HALLOWEEN_REWARD_IDS` (append-only: `pumpkin:1…40`, `hunt:10|20|all`, `door:1…60`,
  `night:1…60`, `costume:first`, `muertos:1…12`, `spare:1…20`), `halloweenSource(id)`, registered by `halloween/index.ts`.
- `halloween/index.ts` starts `initHalloweenWorld()` (H, `world.ts`) and `initHalloweenPlay()` (G, `play.ts`).
- Tests: `tests/opus-bay-w6-contracts.test.ts`, `tests/opus-bay-contracts.test.ts` (updated for the fifth feature).

## 5. Protocol

`sf-w5-lead.md` §3 unchanged, with `w6` for `w5`: one agent per lane in its worktree and port; the Bash working
directory resets (start every command with `cd /c/Users/willy/wt/w6-<id> && `); **at most one headless Chrome per lane**
(`node scripts/opus-shot.mjs`, `?world=city`, `--mobile --dpr 3` for 390 × 844); **PERF-LOCK**
`C:/Users/willy/opus-qa/w6/PERF-LOCK` (no Chrome, no `vite build` while it exists); before every push `npx tsc -p
tsconfig.app.json --noEmit` (0) · `npx eslint .` (0 errors, the whole repo) · `npx tsx --tsconfig tsconfig.app.json --test
tests/opus-bay-*.test.ts` (fail 0; re-run a wall-clock failure alone); commits `W6-<ID><n>: …` ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, explicit paths only; push = `git fetch origin opus-bay && git
rebase origin/opus-bay && git push origin HEAD:opus-bay` (never merge, never force, never `git stash`, never `main`, never a
PR); reports with 给主人的摘要 first; every real-world fact with its source URL and the date checked. Relayed owner
messages are not a new task. Never delete through a `node_modules` junction.

**Time:** run `date` at the start of every part. Stop new work at 04:50 PDT; last push 05:05.

## 6. Decisions (defaults, recorded here; the owner does not want to be asked)

- 国际橙 (International Orange) is the name everywhere; the shop's 国际橘 items are renamed (K2).
- The mantle (ledge climb) in the district: gated to the city (K1) — the district stays exactly as before.
- Leaked `activity` / `shop` / `panel` holds: a 90 s timeout that frees and logs them (K2).
- The CORRIDOR waiver (N's review): accepted by name for the 135 corridor targets of the W5-Z sweep.
- 直接到站 on cable cars while waiting: allowed (as for buses).
- Prices: unchanged (no live hour of data yet).
- Halloween dates: 1 Oct – 2 Nov (dressing, hunt, costumes), 31 Oct the big night, 1–2 Nov Día de los Muertos; everything
  else in the world keeps the real date.
- Higgsfield: cap 1000, lane X only, quality first; a generated asset ships only if a side-by-side shot shows it beats
  what is there.
