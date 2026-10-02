# Wave 8 · plan and lead note (day 0)

Written 2026-09-30 ≈ 18:50 PDT by the lead in `C:/Users/willy/baylink-opus`. The owner's brief (2026-09-30 ≈ 18:40 PDT):
"继续 Opus Bay，做第八波" — the same process as waves 6–7: day 0 (merge `origin/main` once, frozen-file changes, this note),
lanes in parts, one adversarial reviewer per lane, an integration playtest (W8-I), a final verify alone (W8-Z), then
fast-forward `main` on GO (go-live). Standing orders: "直接做，不用经过我同意", quality first, never ask. **Higgsfield: all
of the remaining credits may be used** (363.44 at day 0, the account is shared: read `balance` before every batch; one
ledger row per job). Inputs: `sf-w7-summary.md` §5 NEXT, the wave-7 reports and reviews, W7-I, W7-Z, the promo films'
notes (`C:/Users/willy/baylink-promo/B/DELIVERY.md`: the English hand-off line).

## 0. 给主人的摘要

1. 第八波 10 条线今晚通宵同时开工，明早（10/1 凌晨）验收通过后上线。万圣节 10/1 自动开始，第八波把它打磨好。
2. **先修 P0**：BAYBAY 在小游戏面板 / 万圣节明信片打开时还在说话（声音响、气泡被盖住）；英文版「带去 BAYLINK 安排」那句还夹着中文站名（宣传片里拍到的）；手机上坐地铁时设置按钮被盖住、地图按钮太小；海德街缆车上树冠挡镜头。
3. **更多旧金山**：**坐渡轮去恶魔岛**（33 号码头上船、上岛走一圈、拍照盖章、再坐回来）；唐人街宝塔楼群和老圣玛丽教堂；渔人码头的自由轮 SS Jeremiah O'Brien（最后一个走不到的景点）；海洋海滩的冲浪小人和海豹岩；斯托湖脚踏船；圣依纳爵教堂的双塔、海特街维多利亚房子和壁画。
4. **真实日子**：10/9 舰队周「舰船巡游」——金门桥下有玩具军舰开进来；10/31 唐人街万圣节；网站 9/30 新内容（小团出游、服务预约）同步到游戏里能连的地方；地点卡片补营业时间和票价。
5. **新小游戏**：鲍威尔街缆车「拉闸」小游戏、街头艺人合奏、雾笛对答（选最好玩的 3 个），BAYBAY 全程配音。
6. **画面和声音**：车辆、夜景灯光、摩天轮、市政厅穹顶、渡轮尾浪等变精致；新台词全部配音。Higgsfield 剩余 363 分全部可用（账户是共用的，每批先查余额）。

## 1. State at day 0

- `origin/opus-bay` was the wave-7 hand-off `94ae2ae4` (`main` = `1d5d0d00` + GPT's 3 commits). **W8-0c** `e5f375e6` merged
  `origin/main` (`f3fa187f` service booking flows + "fix release checks", `11ffcf60` small-group outings + BayBay planning
  drafts, `f2f3f889` outing discovery / waitlist / AI drafts): clean; `vercel.json` gained `/me/bookings` and `/together`
  (the `/opus-bay` route and the CSP unchanged).
- Baseline after the merge: `tsc` 0 · `eslint .` 0 errors in tracked files (50 warnings; the 9 parse errors are the lead's
  untracked `.claude/*.js` workflow copies, not in git) · the full `npm test`: see §1.1 below.
- W7-Z numbers stay the perf baseline (`sf-w7-final-verify.md`): desktop max 123 calls (Chinatown) / 360k; phone 4× min
  58.4 fps; GameRoot **261.96 KB** gzip (target ≤ 265); sweep 694 targets 0 boxed / 0 snag / 1 unreachable (O'Brien).
- Higgsfield `balance` **363.44** (2026-09-30 18:42 PDT). The whole remainder is the owner's grant for wave 8 (§6).

### 1.1 Day-0 test run

- `npm test` (the site's whole suite, 18:42–18:49 PDT on `e5f375e6`): **2634 / 2634 pass, 0 fail** — GPT's "fix release
  checks" (`f3fa187f`) cleared the 4 red site tests of `b4f71de8`, so CI's `npm run check` can be green again. The W5-bus
  deadlock test passed inside the full run.
- **W8-0d** (the lead, frozen file): `data/playSave.ts` `MAX_BESTS` 32 → **64**; `tests/opus-bay-contracts.test.ts` and
  `tests/opus-bay-w5-ledger.test.ts` follow the constant (the play block at every format cap is 12.5 KB: its bound 12 → 13 KB;
  the whole save at every cap still ≤ 64 KB). contracts + ledger tests 39 / 39, tsc 0.

## 2. Timeline (PDT, 2026-09-30 → 10-01)

| when | what |
|---|---|
| 19:30 | lanes start (parts a → b → c; push after every part) |
| 23:00 | lanes K, H, M, S, W1, W2: new fixed BAYBAY lines pushed (lane X records them from 23:15) |
| 00:15 | lanes stop starting new work; **00:30** last push + report |
| as each lane ends → 01:30 | one adversarial reviewer per lane |
| 01:30–02:30 | **W8-I** integration playtest (a new player, phone + desktop, across all lanes; Halloween is live by then) |
| 02:30–04:00 | **W8-Z** final verify (alone on the machine, PERF-LOCK) |
| 04:00–04:30 | the lead: merge `origin/main` again if GPT pushed, the site-sync check, `npm run check`, fast-forward `main` |
| 04:30–05:00 | hand-off: `sf-w8-summary.md`, ledgers → ASSETS-LEDGER, RESUME top section |

A lane that finishes early stops (quality over quantity). Nobody starts work after 00:15 that cannot be pushed green by 00:30.

## 3. Lanes and ownership

Worktree `C:/Users/willy/wt/w8-<id>` (branch `w8-<id>`, `node_modules` junction to the main checkout's), scratch
`C:/Users/willy/opus-qa/w8/<id>/`, report `docs/opus-bay/sf-w8-<ID>.md`, QA images `docs/opus-bay/qa/w8/<ID>/`.
Paths are under `src/opus-bay/` unless they start with `scripts/`, `tests/`, `public/` or `docs/`.

| lane | port | owns (edit only these; anything else: a small, surgical fix named in the commit and the report) | work, most valuable first |
|---|---|---|---|
| **K** · BAYBAY, feel, safety | 5801 | `game/**` except `GameRoot.tsx`, `voiceW5.ts`, `w5Features.ts`, `album.ts`, `photo.ts`; `actors/**` (X's look edits in `actors/models.ts` and vehicle meshes excepted); `eggs/**`; `data/cityZones.ts`; `play/PlayChip.tsx`, `play/chip.ts`, `play/kit.ts`; `world/sf/props.ts` (`treesNear`); the canopy part of `world/materials.ts` (city-only) | (1) **P0 · BAYBAY talks under a lazy overlay**: `game/cityMoments.ts stepPacer` and `game/baybayLines.ts` hold while a play panel (claw / crab / dough / fortune / skyline / kite / hide & seek), the Halloween postcard (`h-postcard`) or the egg card is open — overlay ids as strings, never `openOverlays().length` (the play chip is an overlay too); `game/flow.ts bubble()` waits while `h-postcard` is open; voice never plays with its bubble hidden; node tests; (2) the templated `最近的观景点：…` bubble (`play/skyline.ts:101`) → a fixed bubble + the name on a toast / pin so X can voice it (and any other templated BAYBAY bubble you meet); (3) **the seated Hyde St rider under a canopy**: a tree-only dither round the player (`OB_CANOPY` on `TOY_INST_TINT` in `world/materials.ts`, or a per-instance fade for ≤ 3 canopies from `treesNear`), city-only; (4) small tech: `treesNear`'s iterator allocation; a parked ride > 250 u towed only on return; the kite's Space key after a click and its 75 s `quietUntil` after an early quit; (5) BAYBAY on foot near the new Alcatraz ferry / Fleet Week ships (the W7 step-off rule covers boats too?) |
| **Q** · phone UI & words | 5802 | `ui/**`, `*.css` under `src/opus-bay/` (lanes' own css excepted), `OpusBayPage.tsx`, `game/album.ts`, `game/photo.ts`, `i18n.ts` | (1) **P0 · English never shows Chinese**: the Journal's 带去 BAYLINK line (`ui/Journal.tsx:350` joins zh-only `titles`: names in the locale) — then a scan of every screen in `en` and `zh-Hant` for wrong-script text (an automated DOM pass: Han characters in `en`, simplified-only characters in `zh-Hant`; the title, HUD, map, journal, shop, album, Settings, cards, the Halloween page) and fix what you find (text owned by another lane: a surgical fix, named); (2) **a Settings button during an underground Metro ride** (the subway overlay z 40 covers the HUD; `ui/transit-ui.css`), the album / letter / goals step under the subway overlay; (3) the map's tool buttons 36 × 36 → ≥ 44 on touch, the waypoint × 24 → ≥ 44 hit area; (4) at 844 × 340 the free-roam goals card over the lead chip; the skyline card and Union Square at 390 × 844; (5) re-run the iOS-size overlap scans (390 × 664, 375 × 553, 667 × 320, 844 × 340) on every overlay wave 8 adds (the Alcatraz ferry, the new games, the Fleet Week card) as they land on origin (part c) |
| **P** · first load & lazy chunks | 5803 | `game/GameRoot.tsx`, `vite.opus.config.ts`, `tests/opus-bay-sf-budget.test.ts`, the import sites it converts in any lane's files (import lines + registration only; name each); the import-retry helper and its call sites | (1) **GameRoot headroom**: 261.96 → **≤ 255 KB** gzip: the city-only parts of `world/fx.ts`, `world/materials.ts`, `world/environment.ts`, `actors/models.ts` behind the city chunk (≈ 6 KB added in wave 7) with district fallbacks; (2) the shared `importRetry` on the other ≈ 170 lazy imports where a retry is safe (panels, city chunks, play chunks, halloween); (3) a resume after a lost discovery chunk waits up to 12 s silently → a retry + a visible state; a lost shared chunk dependency; (4) the new lazy chunks of wave 8 (the ferry, the games, Fleet Week) land outside GameRoot: a budget test that names them; district unchanged (the hero regression); the chunk table before / after |
| **A** · Alcatraz by ferry | 5804 | `world/sf/landmarks/alcatraz*.ts` (walkable parts, arrival, pose), the ferry parts of `data/ferry.ts` / `world/` ferry system (Pier 33 ↔ the island), new `world/sf/alcatraz*` / `realsf/alcatraz*` files, the island's walking edges (new data file + its registration), its rows in `data/sf/attractions.ts` | **ride to Alcatraz**: (1) a toy ferry from **Pier 33** (Alcatraz Landing) to the island dock (`FLOAT` in `alcatraz.ts`, world ≈ −448.9, −76.4): board like the other rides (the ride card, BAYBAY boards too, Settings pauses it, it never runs through the player), ~90 s toy time, the wake, gulls, the view of the bridge / Bay Bridge; departures on the real cadence (check alcatrazcitycruises.com with the date: toy schedule, no prices claimed beyond the official page); (2) the island **walkable**: the dock apron, the switchback road up past Building 64 to the cellhouse front and the lighthouse terrace (a small walking graph of its own, wired to the arrival); an arrival row, a photo pose, a stamp, BAYBAY's lines (respectful: a former federal prison, the 1969–71 Indian occupation — NPS sources); (3) the return ferry; a ride back if the player swims / glides away (no softlock); (4) the sweep and the perf at Pier 33, on board and on the island (≤ 150 calls / 400k); night: the lighthouse beam stays; the ferry runs by day only (the night tour exists — a quiet line). New fixed lines by **23:00** |
| **H** · Halloween live polish | 5805 | `halloween/**` except `index.ts`, `season.ts`, `rewards.ts` (frozen); `realsf/dressing.ts`, `realsf/seasons.ts`; the dusk setter in `world/sf/fog.ts` (surgical); APPEND-ONLY `economy/items.ts`; `economy/wear.ts`; the pelican slots in `actors/charApi.ts` / `charImpl.ts` (surgical) | Halloween goes live at 00:00 on 1 Oct: (1) play the season end to end on the live dates (`?date=2026-10-01T10:00`, `-10-17`, `-10-24`, `-10-31T19:30`, `-11-01`, `-11-02T19:10`) on 390 × 844 and desktop and fix what is off; (2) the procession walkers step aside for the player and swing their legs; a vertical hop for the trick-or-treat kids; (3) the dusk tint downtown (W7: only out west?); (4) the door-to-street check on the other five treat streets (the W7 check covered one); (5) a pelican `neck` costume — a pumpkin bow (`items.ts` append, ≈ 60 coins); (6) the fallback goals card's Halloween row; the big-night toast wording; (7) the **Chinatown Halloween Festival** (Sat 31 Oct 11:00–15:00, Waverly Place — re-check https://www.cycsf.org with the date): a small kit of lanterns, a costume parade of toy kids, BAYBAY's line; new fixed lines by **23:00** |
| **S** · site sync, real dates, places | 5806 | `realsf/**` except H's `dressing.ts` / `seasons.ts` and A's `alcatraz*`; `scripts/opus-sf/export-live.ts`, `public/opus-bay/sf/v1/live.json`, `tests/opus-bay-w6-s-*.test.ts` + new `tests/opus-bay-w8-s-*`; the TEXT of `data/sf/placeCards*.ts`, `data/sf/landmarks.ts`, `data/sf/extraPlaces.ts`, `data/sf/attractions.ts` rows (text only; A / W1 / W2 own their rows); new `world/sf/fleetWeek*.ts` | (1) **re-sync with the site after GPT's 3 commits**: every SF event of the catalog window shown or kept out for a stated reason (the S venue test), every shown event with a souvenir id + name, the 新店 signs = the site's current openings (open / soft_open, SF), `live.json` = the site's offers (re-export via `export-live.ts`), every link the game opens resolves (`vercel.json` routes + prerendered pages); does anything of GPT's outings / BayBay planning drafts belong in the game (a 这周去哪 hook, a link) — decide, small; (2) **Fleet Week · the Parade of Ships** (`san-francisco-fleet-week-2026`; re-check fleetweeksf.org with the date — 2025's pattern: Friday 11:00–12:00 from under the Golden Gate along the waterfront to the Bay Bridge): toy grey ships in a line on 9 Oct 11:00–12:00 Bay time, a calendar row, BAYBAY's line, "蓝天使通常下午三点左右 · 以官网为准" for the air show days if not there; `?date=2026-10-09T11:20` shows it; perf at Marina Green / Aquatic Park / the bridge; (3) **≈ 60 short place cards without hours / price** → filled from official pages (zh + en, source + date); (4) the Belvedere doors' pill (内日落 · Carmel St vs Cole Valley), `cable:powell-geary` ok → CORRIDOR at Union Square, the `fog.ts` comment, `sfmta-free-muni-seniors`' English source; (5) the owner's live dates end to end with `?date=` (2–4, 9–11, 17, 18, 24, 31 Oct; 1 Nov DST; 2 Nov); new fixed lines by **23:00** |
| **W1** · Chinatown & the Wharf | 5807 | `world/sf/landmarks/{dragon-gate,fishermans-wharf,ghirardelli-square}.ts`, `world/sf/{cornersNB,cornersSeamData,cornersNorthBeach,cornersEastCut,wharfShips}.ts`, `scripts/opus-sf/seam-fill.mts`, new `world/sf/corners*` files, `world/sf/cityWorld.ts` (registration), its rows in `data/sf/attractions.ts` | (1) **Chinatown's pagoda cluster** — the Sing Chong / Sing Fat towers at Grant & California, Old St. Mary's red-brick church with its clock tower, the Chinese Telephone Exchange on Washington St — inside the Dragon Gate corner's mesh (0 new calls; Chinatown is the busiest spot at 123 calls: count before / after); facts on the web (URL + date); exclusions drop the OSM boxes; (2) **SS Jeremiah O'Brien at Pier 35** (`wharfShips.ts` has Pampanito) + an arrival on Pier 35's apron (a walking-graph edge along the promenade or the 3 u waiver, recorded) → the sweep's last UNREACHABLE becomes reachable; (3) North Beach leftovers: Columbus Ave asphalt inside the slab, the café clusters back from the path (the 4 CORRIDOR targets); (4) Ghirardelli / Beach St west of Hyde (the recorded call), the Wharf wheel's cream band; new fixed lines by **23:00**. Higgsfield: ≤ 40 credits (textures / decals; §6) |
| **W2** · the west side & neighbourhood looks | 5808 | `world/sf/landmarks/{ocean-beach,cliff-house,sutro-baths,st-ignatius,usf-lone-mountain,haight-ashbury,chase-center,de-young-tower,city-hall,blue-heron-lake}.ts`, `world/sf/murals.ts`, new `world/sf/west*` / `world/sf/haight*` files, `world/sf/cityWorld.ts` (registration), its rows in `data/sf/attractions.ts` | (1) **Ocean Beach's toy surfers** by day out on the break (instanced, one call) and **Seal Rocks** off the Cliff House (with sea lions / birds as toy dots); (2) **Stow Lake pedal boats** (ambient toy boats on Stow Lake; a rentable boat ride only if cheap and safe — then a lazy chunk); (3) **St Ignatius's twin cupolas** (the church's two towers), the **Haight Victorian / mural kit** (painted façades and 2–3 mural walls on Haight St, city-only, 0 new calls if possible), **Chase Center** to T2, the **de Young** tower's twist, the far **City Hall dome** (gold, the lantern); facts on the web; (4) perf at haight-usf, ocean-beach, music-concourse, civic-center before / after; new fixed lines by **23:00**. Higgsfield: ≤ 60 credits (mural textures, façades; §6) |
| **M** · San Francisco mini-games | 5809 | new `play/<game>*.ts(x)` files + their css, registration lines in `play/zones3.ts` / `play/index.ts` (surgical), APPEND-ONLY `economy/records.ts`, `medal:<game>:n` rewards | first inventory `play/` and `eggs/` (never duplicate: claw, crab, dough, fortune, kite, skyline, hide & seek, heave, bell, slides, stairs, sled, …), then **3 new one-minute games** that only San Francisco has, touch-first, a lazy chunk each, tiers ● ◆ ★, BAYBAY cheering in fixed lines (pushed by **23:00**): (1) the **cable-car grip** game on a Powell ride (hold / release the grip on the hills, the bell at the crossings; reads the ride's grade, never changes transit — K / A own the ride code: a read-only hook); (2) **play along with the busker** at Haight or Calle 24 (a synthesized loop, a rhythm judge); (3) the **fog-horn call-and-answer** at the bridge / Fort Point, or the **Chinatown lantern** game at night — pick by fun and SF-ness; facts on the web with URL + date |
| **X** · looks, sound, voice (Higgsfield) | 5810 | `world/recipes/{city,palettes}.ts`, `world/sf/{look,far,cloudBank,crowd,lights,water}.ts`, `world/environment.ts` (city-only), `world/life.ts`, `world/fx.ts` + `world/fx/**`, the LOOK of `actors/models.ts` and the vehicle meshes (keep bones, slots, sizes, colliders, names), `game/voiceW5.ts`, `data/sf/voiceW*.ts` + new `data/sf/voiceW8.ts`, `audio/**` (the W7 unlock path and clip cache: keep their behaviour), `public/opus-bay/w8/**`, `scripts/opus-sf/{voice,assets}/w8/**`, `docs/opus-bay/ledger/w8-X.md` | (1) **voice**: lane M's 34 W7 lines (`play/sfgamesLines.ts`), the 7 muted batch-1 retakes, every new W8 fixed line of K / A / H / S / W1 / W2 / M (fetch origin at 23:15 and again at 00:30) → `data/sf/voiceW8.ts` through the binder; the listening sheet; (2) **looks**: vehicles (cable car, F-line, Muni bus, toy cars) and night glows (windows, street lamps, the bridge lights), the ferry wake, Salesforce Tower's bands (city-only), the sky-puff AA line, the double coin pop; (3) Higgsfield for what wins side by side (textures, a GLB through the swap gate, sounds) — the main spender (§6) |

Everyone: `src/opus-bay/**` outside the table only for a surgical fix you name. **Frozen** (the lead only; write the exact
change under Requests): `core/**`, `data/playSave.ts`, `data/save.ts`, `game/w5Features.ts`, `halloween/{index,season,
rewards}.ts`, `economy/hints.ts` `HINT_KINDS`, `economy/ledger.ts` caps, `world/palette.ts` (shared with the district),
`vercel.json`, `package*.json`, everything outside `src/opus-bay`, `scripts/opus-sf`, `tests/opus-bay-*`, `public/opus-bay`,
`docs/opus-bay` (the site is GPT's). **District mode never changes.**

## 4. Contracts and approvals at day 0

- **`play.b` MAX_BESTS 32 → 64** (W8-0d, the lead; `data/playSave.ts`, the contracts test): room for wave 8's games
  (W7-M counted ≈ 28 keys writable). The save stays under 64 KB with every cap at its maximum (the contracts test).
- **Rewards:** new activities use the existing `medal:` prefix (`medal:grip:n`, `medal:busk:n`, `medal:foghorn:n`,
  `medal:lantern:n`); records rows are appended; the Alcatraz visit uses the existing arrival / stamp / pose paths. No new
  prefix, event or save bit. Halloween ids stay frozen (`spare:1…20` unassigned; a new costume is an `items.ts` append).
- **Voice:** `data/sf/voiceW8.ts` (lane X) is registered by `game/voiceW5.ts` like `voiceW7.ts`. Lines are matched by exact
  zh + en text: **templated bubbles cannot be voiced** — split a fixed bubble from the number / name.
- **Event souvenir ids:** a shown event must have a `SOUVENIR_IDS` entry (append-only, ≤ 40 chars) — lane S's guard test.
- **Overlay gate (lane K):** the list of overlay ids that silence BAYBAY lives in one exported constant in `game/` so lanes
  M / A / H add their new panels' ids to it (one line each, named in the commit).

## 5. Protocol

`sf-w5-lead.md` §3 with `w8` for `w5`: one agent per lane in its worktree and port; the Bash working directory resets
(start every command with `cd /c/Users/willy/wt/w8-<id> && `); **at most one headless Chrome per lane**
(`node scripts/opus-shot.mjs`, `?world=city`, `CHROME_FLAGS=--force_high_performance_gpu`, `--mobile --dpr 3` for
390 × 844); **PERF-LOCK** `C:/Users/willy/opus-qa/w8/PERF-LOCK` (no Chrome, no `vite build` while it exists); every dev
server with its own vite `cacheDir` (rule 6 of wave 7); before every push `npx tsc -p tsconfig.app.json --noEmit` (0) ·
`npx eslint .` (0 errors, the whole repo) · `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts` (fail 0;
re-run a wall-clock or deadlock failure alone); commits `W8-<ID><n>: …` ending with `Co-Authored-By: Claude Opus 5.5
<noreply@anthropic.com>`, explicit paths only; push = `git fetch origin opus-bay && git rebase origin/opus-bay && git push
origin HEAD:opus-bay` (never merge, never force, never `git stash`, never `main`, never a PR); reports with 给主人的摘要
first; every real-world fact with its source URL and the date checked; a generic User-Agent for any web API (never the
owner's address). Relayed owner messages are not a new task. Never delete through a `node_modules` junction. Never
SendMessage anyone.

**Time:** run `date` at the start of every part. Stop new work at 00:15 PDT; last push 00:30.

## 6. Decisions (defaults, recorded here; the owner does not want to be asked)

- Scope order: the P0s (BAYBAY under overlays, English text, phone UI) and Halloween's live polish first, then more San
  Francisco (Alcatraz by ferry first: fame 95 and nothing to do there today), then games and looks.
- **Higgsfield (363.44 at day 0, all usable):** lane X ≤ 240, lane W2 ≤ 60, lane W1 ≤ 40, ≈ 20 left for the reviewers /
  W8-I voice retakes. Every spender reads `balance` before every batch and does not start a batch that would take it
  below **20** (the shared account: another project may spend at the same time — if the balance drops by more than your own
  spend, write it in your ledger and keep going within your cap). A generated asset ships only when a side-by-side shot
  beats what is there and it stays inside the perf budget.
- The Alcatraz ferry runs by day on a toy cadence; prices, times and tour details are the official page's (以官网为准). The
  island is a national park and a former federal prison: BAYBAY's lines stay light but respectful; the 1969–71
  occupation is mentioned from NPS sources only.
- Fleet Week: toy ships only (no weapons detail, no flags of foreign navies); the Blue Angels stay a hedged line.
- The Chinatown Halloween Festival stays a calendar row + a small kit (the site's catalog still lacks it: a request to the
  site's editors in the summary).
- P's district vehicles (W6 Request 3) stay as they are.
- Go-live: on W8-Z's GO, merge `origin/main` once more if GPT pushed, re-check the site sync (§7.2 of wave 7), `npm run
  check`, fast-forward `main`. The owner confirms the deploy (the lead's curl of the live site is refused).

## 7. Addendum 19:30 PDT — run as an Ultra workflow

The owner, 2026-09-30 ≈ 19:25 PDT: "用ULTRA来运行哦". The ten lanes had run 19:00–19:20 as background agents (W8-K1 /
W8-K2 pushed; the others had committed or uncommitted work in their worktrees, lane X had submitted ≈ 120 TTS takes); they
were stopped and the wave was relaunched as one workflow run **`wf_66c65596-f6a`** (script
`opus-bay-wave8-ultra-wf_66c65596-f6a.js` under the lead session's `workflows/scripts/`). Each lane agent resumes its
predecessor's worktree (keep what is good, finish it, push).

- **Shape:** lanes (§3) → per lane, as soon as it ends, two read-only adversarial lenses in parallel — **code & facts**
  (`wt/w8-<id>-rc`: every diff, leaks, per-frame allocations, save, district, ownership, tests, calls / tris, facts
  re-checked on the web, words) and **player** (`wt/w8-<id>-rp`, port lane + 20: desktop + 390 × 844, try to break it) —
  → one **fixer** (`wt/w8-<id>-rev`, port lane + 40) that reproduces every finding (default: refuted), fixes the confirmed
  ones and appends "## Review (Ultra)" → **W8-I**: three read-only lenses (phone playtest 5861, desktop playtest 5862,
  words + site-sync scan 5863) → the W8-I fixer (`wt/w8-int`, 5864, `sf-w8-integration.md`) → a **completeness critic**
  (read-only; P0 status, unverified claims, go-live risks) → a bounded **fix pass** (`W8-C`, ≤ 45 min) → **W8-Z** alone
  (PERF-LOCK, 5870, `sf-w8-final-verify.md`, GO / NO-GO).
- **Times (replace §2):** lanes stop new work 23:45, last push 00:00; new fixed lines by 22:45 (X records at ≈ 23:00 and
  ≈ 23:40); lens reports ≈ 45 min after their lane; fixers' last push 01:40; W8-I fixer 03:05; the fix pass 03:50; W8-Z
  ≈ 90 min after; the lead's go-live after W8-Z's GO.
- Higgsfield caps unchanged (§6); `balance` 361.52 at 19:22 PDT (lane X's first takes).
