# Opus Bay — resume notes (newest first; the first pause was 2026-09-25 ~17:05 PDT)

## WAVE 8 DONE · LIVE ON baylink.us — 2026-10-01 (≈ 05:15 PDT)

- **State.** W8-Z said **GO** on `8e3e8e72` (04:52 PDT). At the go-live the lead merged `origin/main` (**W8-0g** `0d9093f5`:
  GPT's six site commits `263bfc43`, `25ab971a`, `b7b82ff4`, `2d9d9da9`, `f5b059ca`, `652a9975`), mapped the 7 Oct SF Zoo
  resident free day (**W8-0s** `a1cc3f60`: `scripts/opus-sf/export-live.ts` SPECS, `live.json` 15 SF offers), ran
  the full `npm run check` on that tree (red on one test, W5-R7: 15 SF offers ≠ 14), made the test follow the zoo row
  (**W8-0t** `90c6859e`), ran the check again (EXIT 0) and fast-forwarded `main` to **`90c6859e`** (= `opus-bay` before this
  hand-off) at ≈ 05:15 PDT (`origin/main` read `90c6859e` at 05:17). `origin/opus-bay` = that + this hand-off commit
  (docs only: `docs/opus-bay/sf-w8-summary.md`, the wave-8 ledger merged into `src/opus-bay/ASSETS-LEDGER.md` § "Wave 8 (local)", this section). **The deploy is to be confirmed
  by the owner**: the lead's curl of the live site is refused by a permission check; the owner opens
  https://www.baylink.us/opus-bay?start=free&at=xz:-94,-21.8 (Pier 33 · Alcatraz Landing with the ferry prompt = wave 8 is
  live). The Halloween season runs by the Bay date since 1 Oct 00:00.
- Read, in order: this section → `docs/opus-bay/sf-w8-summary.md` (给主人的摘要, the ten lanes, the review in numbers,
  W8-Z's numbers, Higgsfield, **§6 NEXT**) → `docs/opus-bay/sf-w8-final-verify.md` (W8-Z) →
  `docs/opus-bay/sf-w8-integration.md` (W8-I and `## Completeness pass` = W8-C) → the lane reports `sf-w8-<ID>.md` (each
  with `## Review (Ultra)`) → the plan / lead note `docs/opus-bay/sf-w8-lead.md` (ownership §3, contracts §4, protocol §5,
  decisions §6, §7 the Ultra shape).
- **What wave 8 added:** the five P0s (BAYBAY silent under play panels / cards / the Halloween postcard via
  `game/baybayHold.ts`; English never shows Chinese + `scripts/opus-sf/qa/lang-scan.mjs`; Settings in the underground
  Metro and 44 px map tools + `scripts/opus-sf/qa/overlap-scan.mjs`; the Hyde St canopy dither; Halloween live from 1
  Oct); **Alcatraz by ferry** from Pier 33 and the island on foot; three games (the cable-car grip, the busker jam, the
  foghorns at Fort Point); Chinatown's pagoda cluster; the SS Jeremiah O'Brien at Pier 35 (the sweep's last
  UNREACHABLE gone); Ocean Beach surfers + Seal Rocks, Blue Heron Lake's boats and boathouse, St Ignatius's lead domes;
  Fleet Week's Parade of Ships (9 Oct); the Chinatown Halloween Festival (31 Oct), the procession's legs, the doors
  re-checked, the pelican's pumpkin bow; 50 place cards with hours / prices; the vehicles' fronts, the lit Golden Gate
  towers; voice for 132 lines / 264 clips; every lazy import through `importRetry` + the reload card
  (`game/chunkLost.ts`) and `game/lazyChunk.ts`; GameRoot **258.04 KB**.
- **Checks at W8-Z** (`ca25fc7b` + W8-Z's docs): `npm run check` **EXIT 0** — eslint 0 errors (50 warnings), **2845 tests,
  2844 pass, 0 fail, 1 todo**, build, prerender 566, share cards 541 (the first fully green check since wave 6) · tsc 0 ·
  opus-bay **1871 tests, 0 fail, 1 todo** (W8-P9's 255 KB target) · perf desktop all 60.1 fps, max 126 calls / 387k (on
  board the Alcatraz ferry) · phone 4× 0 frames > 100 ms in every measured window, every spot ≥ 45 fps after paired W7 /
  W8 runs · sweep 699 targets 0 boxed / 0 snag / 0 unreachable / 0 off · production CSP 0 / 0 of 1789 · district 71 /
  225,070 / 262 (unchanged) · English 56 screens 0 Chinese, 繁體 55 screens 0 Simplified-only. **The go-live tree** `90c6859e`: `npm run check` EXIT 0 — eslint 0 errors (50 warnings),
  2933 tests (2932 pass, 0 fail, 1 todo), build, prerender 589, share cards 564 (`C:/Users/willy/opus-qa/w8/golive-check3.txt`).
- **Higgsfield:** wave 8 spent **5.44** (lane X, all TTS; no other lane spent); `balance` 363.44 (day 0) → 361.52 (19:22)
  → **357.27** (04:58 and ≈ 05:00 PDT, read only); 0.73 of other TTS on the shared account is claimed by no lane. The
  promo videos are done (766.43 of the 1800 the owner reserved, `C:/Users/willy/baylink-promo`); the owner's last rule
  (wave 8): all of the remaining credits usable, read `balance` before every batch (the account is shared).
- **Workflow run:** `wf_66c65596-f6a`, one Ultra workflow of 47 agents, 19:24 → 04:53 PDT; script
  `C:/Users/willy/.claude/projects/C--Users-willy-baylink-opus/f0bf32bb-00df-4c15-bf61-df7e5e6b5e50/workflows/scripts/opus-bay-wave8-ultra-wf_66c65596-f6a.js`;
  journal (every agent's structured result)
  `C:/Users/willy/.claude/projects/C--Users-willy-baylink-opus/f0bf32bb-00df-4c15-bf61-df7e5e6b5e50/subagents/workflows/wf_66c65596-f6a/journal.jsonl`
  with each agent's transcript beside it. Finished; a run cannot be resumed across sessions.
- **Worktrees kept** `C:/Users/willy/wt/w8-{k,q,p,a,h,s,w1,w2,m,x}` and `wt/w8-handoff` (branches `w8-*`, pushed; every
  `node_modules` is a **junction** — remove with `cmd //c rmdir C:\Users\willy\wt\<name>\node_modules` first, check it is
  gone, then `git worktree remove <path>`, never `--force`). The lenses', fixers', W8-I's, the critic's, W8-C's and W8-Z's
  worktrees are removed, but 46 `w8-*` admin folders sit in `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/`
  (11 of them the kept worktrees): `git worktree prune` with OneDrive paused. Scratch `C:/Users/willy/opus-qa/w8/` (lanes
  `<id>/`, lenses `<id>-rc/` `<id>-rp/`, fixers `<id>-rev/`, `int*/`, `critic/`, `cfix/`, `final/`, the go-live check
  logs `golive-check*.txt`). The lead's checkout `C:/Users/willy/baylink-opus` is on `opus-bay`. The LAN phone package
  `C:/Users/willy/opus-qa/dist-phone` was rebuilt by W8-Z at 04:46 from its tree (before the go-live merge); start the
  `opus-bay-phone` preview for http://10.0.0.85:4174/opus-bay.
- **Still owed by the owner** (summary §6 P0): confirm the deploy; the real-iPhone pass (`docs/opus-bay/iphone-checklist.md`
  + the wave-8 panels); the voice listening sheets (`docs/opus-bay/qa/w8/X/voice/listening.md`, the w7 and w6 sheets); the
  site issues for GPT (the Safari 16.0–16.3 lookbehind at `src/lib/named-event-search.ts:2`, still there; the 繁體
  converter's 馬裡納區 / 小傢夥 / 海里; the seniors' Muni source; the Chinatown Halloween Festival in the catalog; the
  Exploratorium / Gott's English entries; the planner's HTTP 400 and the free-admission price from wave 7, not re-checked).
- **Rules learnt this wave** (add them to every brief, on top of the wave-7 rules and "Rules learnt" below):
  1. **When the owner says Ultra, run the wave as one Workflow**: lanes → two read-only lenses → a fixer that reproduces
     each finding → integration lenses + fixer → completeness critic → bounded fix pass → final verify; it took ≈ 9.5 h
     for 47 agents (19:24 → 04:53 PDT). Lanes already started as background agents are stopped and resumed inside the
     workflow: each lane agent keeps its predecessor's worktree work.
  2. **Lens findings can be cut off in the relay**: W8-Z recovered four from the journal (the lists for lanes H, M and P
     arrived truncated, so 4 of 93 findings never reached a fixer) — fixers should read the journal / the lens reports,
     not only the relayed list, and the script should hand lens results over as files.
  3. **Restart the dev server before a probe** after editing source: a probe that imports `/src/...` modules can get a
     second instance of an HMR-invalidated module (a game that "started" with no panel: Q's review).
  4. **QA evals poll until the game's hooks exist**: on a cold dev server `__opusBay` was not mounted 25 s after load and a
     throw inside a `setInterval` hung the run (W8-C). A first click on the activity chip waits for its pop-in (≈ 0.5 s) or
     it lands on the Postcards pill (lane K).
  5. **A low phone reading after a long perf chain is re-measured back to back on the live tree and the new tree** before
     it is called a regression: after 30 min of desktop load the chain read lower, and the W7 tree measured that night
     sat below W7-Z's own figures (W8-Z's paired runs).
  6. **A recorded line's words are frozen**: voice is matched by exact zh + en text, so rewording a voiced line silences it
     until lane X re-records; a wrong voiced fact needs a source or a retake in the same wave (W2-C6, WS-4), and a
     templated bubble is split into a fixed line + a toast / pin.
  7. **Lazy code goes through the guards**: every new relative `import()` is `importRetry(() => import('./x'))` and every
     `React.lazy` goes through `game/lazyChunk.ts` (both scan tests fail on a bare one); GameRoot's static guard fails above
     258.5 KB (≈ 0.2 KB headroom) and the play core is near its 6246 B guard.
  8. **Run the whole-repo `eslint .` and the full suite before a push**, not after (W8-C pushed first; both were green).
  9. **Site data lands with the go-live merge**: a site offer / event new on `main` is mapped after the merge
     (`export-live.ts` throws for an id the site data lacks), and only the merged tree's full `npm run check` catches the
     tests that count it (the go-live's second check failed W5-R7, 15 ≠ 14: W8-0t).
  10. **`eslint .` in the lead's checkout parses its untracked `.claude/*.js` workflow copies** (9 parse errors in the
      go-live's first check, `C:/Users/willy/opus-qa/w8/golive-check.txt`): run the check where they are not.
- **How to continue:** say **"继续 Opus Bay，做第九波"**. Read this section and `docs/opus-bay/sf-w8-summary.md` §6 NEXT; do
  the owner-side P0 first (confirm the deploy, the real iPhone pass, the listening sheets, the site items to GPT). Then
  launch wave 9 like wave 8 (day 0 = merge `origin/main` once if GPT pushed and re-sync the world with the site, a plan
  with a default for every question, lanes in parts, the workflow shape of rule 1 when the owner says Ultra, a final
  verify alone with PERF-LOCK, fast-forward `main` on GO, the hand-off). Time-bound first: the parade photo framing before
  9 Oct, the branch-library events before 17 / 24 Oct, Waverly Place's parked car before 31 Oct. Higgsfield: read
  `balance` first.

## NEXT SESSION → WAVE 8 — done: wave 8 ran 2026-09-30 19:00 → 10-01 04:53 PDT; its list and the owner's to-dos are carried into the section above and `docs/opus-bay/sf-w8-summary.md` §6.

## WAVE 7 DONE · LIVE ON baylink.us — 2026-09-30 03:25 PDT

- **State.** `main` was fast-forwarded by the lead to **`1d5d0d00`** (W7-Z, GO) at 03:25 PDT; `origin/opus-bay` = that +
  this hand-off commit (docs only: `docs/opus-bay/sf-w7-summary.md`, the wave-7 ledgers merged into
  `src/opus-bay/ASSETS-LEDGER.md` § "Wave 7 (local)", this section). `origin/main` had nothing new after day 0 (GPT's
  head `b4f71de8` was merged by W7-0c), so no second merge was needed. **The deploy is not confirmed**: the lead's check
  of baylink.us was refused by a permission check; the owner was asked to open
  https://www.baylink.us/opus-bay?halloween=1 (the Halloween key art on the title = wave 7 is live). The Halloween season
  starts by itself on 1 Oct (Bay date).
- Read, in order: this section → `docs/opus-bay/sf-w7-summary.md` (给主人的摘要, the thirteen lanes, W7-Z's numbers,
  Higgsfield, **§5 NEXT**) → `docs/opus-bay/sf-w7-final-verify.md` (W7-Z) → `docs/opus-bay/sf-w7-integration.md`
  (W7-I) → the plan / lead note `docs/opus-bay/sf-w7-lead.md` (ownership §3, contracts §4, decisions §6, the addendum §7).
- **What wave 7 added:** Halloween complete (the 4 postcards at their moments, the pelican's bat wings, the pumpkin
  dusk, moving figures, readable bats, lantern wisps, the 2 Nov procession); iPhone readiness (the audio unlock inside
  the Start tap, a voice-clip cap, the context-loss card, the album in WeChat, iOS viewport sizes,
  `docs/opus-bay/iphone-checklist.md`); Alcatraz T1, the FiDi seam, the East Cut corner, USS Pampanito, Union Square T2;
  five new games (放风筝, 那是什么？, the Musée claw machine + fortune teller, crabbing, sourdough); felt characters,
  painted particles, Golden Gate fog wisps, the de Young tower (AI), pre-war / Chinatown façades, the city day sky; the
  site sync (six venues, souvenir ids, 3 new-shop signs, real dates); GameRoot **261.96 KB** (≤ 265 for the first time).
- **Checks at W7-Z** (`1d5d0d00`): eslint 0 errors · tsc 0 · opus-bay suite **1660 / 1660** · build + prerender 566 +
  541 share cards green · `npm run check`'s test step **2551 / 2555**: the 4 failures are the site's own tests on GPT's
  `b4f71de8` (red on `main` too; CI stays red until GPT fixes them — the summary's §5 P0 4 has the fixes). Perf: desktop
  max 123 calls / 360k, 60 fps; phone 4× min 58.4 fps, 0 frames > 100 ms; sweep 694 targets 0 boxed / 0 snag / 1
  unreachable (O'Brien); production CSP 0 / 0; district unchanged (71 / 225,070 / 262).
- **Higgsfield:** wave 7 spent **33.63** (lane V 30.00, lane X 3.63); `balance` **2213.87** (read only, 2026-09-30 ≈ 10:30
  UTC). The owner reserved **up to 1800 credits for two BAYLINK promo videos** after this go-live (the website; the 3D
  world with the real world): game lanes stop below **1900** until those are made.
- **Workflow runs:** `wf_24420585-505` (the ten lanes K Q B P H G S W1 W2 X → one reviewer per lane → W7-I → W7-Z) and
  `wf_b9e6ab11-810` (the addendum: V M R → one reviewer per lane), scripts `opus-bay-wave7-wf_24420585-505.js` /
  `opus-bay-wave7-addendum-wf_b9e6ab11-810.js` under the lead session's `workflows/scripts/`. Both finished; a run cannot
  be resumed across sessions.
- **Worktrees kept** `C:/Users/willy/wt/w7-{day0,k,q,b,p,h,g,s,w1,w2,x,v,m,r}` (branches `w7-*`, all pushed; every
  `node_modules` is a **junction** — remove with `cmd //c rmdir C:\Users\willy\wt\<name>\node_modules` first, check it is
  gone, then `git worktree remove <path>`, never `--force`). The review worktrees, `w7-int`, `w7-verify` and
  `w7-handoff` are removed; `C:/Users/willy/wt/w7-p-rev` is an empty leftover folder. Scratch `C:/Users/willy/opus-qa/w7/`
  (day-0 scouts `day0/`, lanes `<id>/`, reviews `<id>-rev/`, `int/`, `z/`). The lead's checkout
  `C:/Users/willy/baylink-opus` is still at `83e88511`: `git pull --ff-only` before using 5174 or rebuilding 4174. The LAN
  phone package `C:/Users/willy/opus-qa/dist-phone` was rebuilt by W7-Z from the final tree (start the `opus-bay-phone`
  preview for http://10.0.0.85:4174/opus-bay).
- **Rules learnt tonight** (add them to every brief, on top of "Rules learnt" below):
  1. **A test that simulates the city must pin the Bay clock.** The W5 deadlock proof read the real clock through the
     transit layer (cable cars run by their real service hours, `bayParts()`), so every run after ≈ 23:00 PDT met the
     Market St convoy and went red for every lane (29.2 s at `box:f-line@5661:750`) until W7-B9 `fd2ff25b` pinned it to a
     day clock (`__setBayNowForTests`); W7-B1 also resets the state the test before it leaves. A red test on clean origin
     is the lead's / its owner's, not every lane's.
  2. **13 lanes on this machine** ran it at CPU 100 % with ≈ 3 GB RAM free, and it held with Windows' automatic pagefile.
     Run the touched tests while iterating and the full suite only before a push; wall-clock tests fail under that load
     (rule 9 below): re-run alone.
  3. **Push contention:** thirteen lanes rebasing onto one branch make a lane with a slow check (the ~10-minute suite)
     lose the race again and again. After the rebase re-run `tsc` and the incoming lanes' test files, then push at once;
     keep the last full-suite run's numbers in the report.
  4. **The auto-mode classifier refuses a curl of the live site** as a production deploy check: after a go-live the owner
     confirms the deploy (or grants that permission); do not retry the curl.
  5. **The OneDrive lock leaves `.git/worktrees/*` admin folders** (`w7-*-rev`, `w7-int`, `w7-verify`, `w7-*-chk`,
     `w7-h-origin`, `wt-origin`, `wt-origin1`, …) in `C:/Users/willy/OneDrive/Desktop/baylink-web/.git/worktrees/`:
     `git worktree prune` later, with OneDrive paused.
  6. **Dev servers share `node_modules/.vite` through the junction**: one worktree's server re-optimises the deps under
     another's (mixed React, "Invalid hook call", "Failed to fetch dynamically imported module"). Give each dev server its
     own `cacheDir` (a scratch vite config, as the H / G reviewers did).
  7. **Never edit the site's files** (outside `src/opus-bay`, `tests/opus-bay-*`, `public/opus-bay`, `scripts/opus-sf`,
     `docs/opus-bay`): W7-Z's start on GPT's red tests was backed out and the harness refused edits to the site's shared
     data. Report site problems to the owner / GPT in the summary.
  8. A lane once put the owner's e-mail in a Nominatim User-Agent (openstreetmap.org only, nothing in the repo): briefs say
     to use a generic User-Agent, never the owner's address.
- **How to continue:** say **"继续 Opus Bay"**. Read this section and `sf-w7-summary.md` §5 NEXT; do the owner-side P0
  first (confirm the deploy, the real iPhone pass on the LAN package, the listening sheets, the site's 4 tests and the
  Safari 16.0–16.3 regex go to GPT). Then launch wave 8 the same way as waves 6–7 (lead note §5 protocol, ports 57xx /
  58xx, a plan with a default for every question, day 0 = merge `origin/main` once if GPT pushed, lanes in parts, one
  adversarial reviewer per lane, W8-I integration, W8-Z final verify alone with PERF-LOCK, fast-forward `main` on GO, the
  hand-off). Higgsfield: check `balance` first and keep the promo reserve (floor 1900) unless the promo videos are done.

## WAVE 6 DONE · LIVE ON baylink.us — 2026-09-29 06:50 PDT (`main` fast-forwarded to `5da5822c`, W6-Z GO)

- Wave 6 ran 01:40–07:30 PDT on 2026-09-29 (the owner left at 07:45). Read, in order: this section →
  `docs/opus-bay/sf-w6-summary.md` (给主人的摘要, the nine lanes, numbers, **§5 NEXT**) → `docs/opus-bay/sf-w6-final-verify.md`
  (W6-Z) → the plan / lead note `docs/opus-bay/sf-w6-lead.md` (ownership, frozen contracts §4, decisions §6).
- **Halloween is in**: a fifth lazy city feature `src/opus-bay/halloween/` (`season.ts` frozen: 1–30 Oct season, 31 Oct the
  big night, 1–2 Nov Día de los Muertos on the Bay clock; **`?halloween=1|night|muertos|off` previews it in any build**,
  production too). World (lane H): dressed stoops, bats, the Sutro haunt, the 40-lantern hunt, Día de los Muertos in the
  Mission. Games (lane G): trick-or-treat on 6 real streets (54 doors), candy bag, 4 costumes, the 万圣节 Journal page.
  Assets (lane X): postcards, SFX, 80 voice clips, the Halloween title key art. Reward ids `halloween:*` are append-only
  (`halloween/rewards.ts`).
- Also: GPT's autumn catalog in the world (SF events 18 → 38, new-shop signs), the North Beach seam + corner, hide & seek,
  the Lyon St Steps race, cuter city walkers, the W5-bus review done (transit no longer drives through the player's car),
  the stick base fix, Settings holds the ride, 国际橙, GameRoot 300 → 279 KB.
- `main` was merged into `opus-bay` twice (W6-0c `b35995a6`, W6-0e `89b16f37`: GPT's site commits) and `main` was then
  fast-forwarded to `opus-bay` (go-live). GPT keeps pushing to `main`: next wave, merge `origin/main` once at day 0 again.
- Higgsfield: balance **2359.30** after wave 6 (15.70 spent of the owner's 1000 cap; ledger merged into ASSETS-LEDGER).
- Worktrees `C:/Users/willy/wt/w6-{day0,k1,k2,b,p,h,g,s,w,x,verify}` (branches `w6-*`, all pushed; node_modules are
  junctions — remove with `cmd //c rmdir <wt>\node_modules` first). Scratch `C:/Users/willy/opus-qa/w6/`. Review worktrees
  are removed; their `.git/worktrees/w6-*-rev` admin folders could not be deleted (OneDrive permission): `git worktree
  prune` later.
- **To continue:** say "继续 Opus Bay"; read the three docs above; launch wave 7 the same way (the lead note's §5
  protocol; ports 56xx; one reviewer per lane; W6-Z style verify; fast-forward `main` on GO). Rules learnt below still
  hold; new: a workflow's lanes finished in ≈ 3 h and the reviews in ≈ 45 min — a 6-hour night fits a whole wave.

## LIVE ON baylink.us — 2026-09-29 (after wave 5)

- `opus-bay` was fast-forwarded into `main` and deployed by Vercel: **https://www.baylink.us/opus-bay** opens the whole
  city (default world `'city'`; `?world=district` keeps the Embarcadero district). The deployed head is `main` =
  `origin/opus-bay` at the go-live commit (see `git log -1 origin/main`).
- Added after the W5-Z verify, before going live:
  - **Language switch** (`54aff531`, `cbfa32dc`, `255535f6`): 简体 · 繁體 · English pills above Start on the title and a
    语言 / Language row first in Settings; a switch is live (HUD, bubbles, cards, map, journal, shop, painted world
    labels, BAYBAY's next voice line) and persists site-wide (`setLocale(…, true)` + `?lang`). Reviewed.
  - **Vehicle deadlock fix** (`5a726a5a`, `1ad63d6a`, `ec4f3a10`, `ce073ce9`, `52091013`): toy traffic yields to transit and
    to the player's ride (a car that holds one up 2 s clears the lane), the tap-to-drive car / bike pass a standing car
    on two-lane streets, interlocks between cable cars / streetcars / buses cannot wait on each other, and
    `tests/opus-bay-w5-deadlock.test.ts` runs 20+ simulated minutes of the loop, the N and the M with dense traffic
    (road waits ≤ 5 s, interlocks ≤ 60 s). **Its adversarial review was skipped at the owner's request**; the reviewer's
    unfinished edits stay uncommitted in `C:/Users/willy/wt/w5-bus` (not on origin): wave 6 should re-run that review.
  - **Go-live prep** (`6e03237f`, `vercel.json`, owner-approved go-live): the `/opus-bay` route (it answered 404 in
    production) and a CSP that lets three's Draco decoder run (`script-src 'wasm-unsafe-eval'`, `connect-src blob:`);
    checked with `scripts/opus-sf/qa/csp-serve.mjs` on a production build: 0 CSP violations, 0 failed requests.
- Vercel previews for `opus-bay` stay off (`git.deploymentEnabled.opus-bay: false`); production deploys from `main`.
  The owner cleaned the old previews on 2026-09-28; storage is fine.
- **To continue in a new window:** say "继续 Opus Bay" (or name the work, e.g. "做第六波"): read this file top-down,
  then `docs/opus-bay/sf-w5-summary.md` §5 NEXT (wave-6 list) and `docs/opus-bay/owner-feedback-2026-09-27.md`; launch the
  next wave the same way (plan → day 0 → lanes with parts → checkpoint → reviews → final verify → owner playtest → merge
  `opus-bay` into `main` to go live). New items for wave 6 on top of §5: re-run the deadlock review; with Settings open the
  tour bus still boards and drives on; on phones the ARRIVED card can cover an open More menu; 国际橘 vs 国际橙 in the shop;
  GameRoot 298.6 KB vs the 265 KB target; a real iPhone pass by the owner.

## WAVE 5 DONE 2026-09-28 (≈ 21:10 PDT = 2026-09-29 ≈ 04:10 UTC)

Read, in order: this section → `docs/opus-bay/sf-w5-summary.md` (给主人的摘要, the ten lanes, the numbers, **§5 NEXT**)
→ `docs/opus-bay/sf-w5-final-verify.md` → the plan's defaults `docs/opus-bay/sf-w5-plan.md` §6 and the protocol
`docs/opus-bay/sf-w5-lead.md` §3. (Waves 3–4 are not summarised here: `sf-w3-lead.md`, `sf-w4-plan.md`,
`sf-w4-lead.md`, `sf-w4-final-verify.md`.)

### State

- `origin/opus-bay`: code head **`a45f5afd`** (W5-Z, the final verify) + the hand-off commit that adds this section,
  `docs/opus-bay/sf-w5-summary.md` and the ASSETS-LEDGER merge (docs only). Wave 5 = the W5-0c merge of `origin/main`
  (`27073fda`), the plan `26b8be4`, then 252 commits (day 0, ten lanes in parts a–c, the checkpoint fixes, ten reviews,
  W5-Z), all on 2026-09-28 PDT.
- Checks: W5-Z on `a2ca9204`: `npm run check` EXIT 0 (**2076 / 2076** tests, 0 lint errors / 43 old warnings, build,
  prerender 307 pages, 282 share cards). Re-run by the hand-off before its push: `npx tsc -p tsconfig.app.json --noEmit`
  0 · `npx eslint .` 0 errors · opus-bay suite `npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts`
  **1356 / 1356**.
- **Default world: the city** (`DEFAULT_WORLD_MODE = 'city'` in `core/store.ts`, `a2ca9204`): `/opus-bay` opens San
  Francisco. `?world=district` opens the Embarcadero district exactly as before (hero regression green). Node tests and
  scripts without `location` keep the district (`NODE_WORLD_MODE`); QA scripts pass `?world=city` / `?world=district`
  explicitly (`scripts/opus-shot.mjs`'s default URL now opens the city).
- Perf (W5-Z, alone on the machine): desktop 1440 × 900 high max 119 calls / 352k triangles, 60 fps; phone 390 × 844 mid
  4× CPU min 52.8 fps, 0 frames > 100 ms; AMD iGPU pass; auto quality picks mid. **GameRoot 298.62 KB gzip** (target
  ≤ 265: open). Sweep 684 targets: 0 boxed / 0 snag; left: SS Jeremiah O'Brien (T3, 4.8 u short), the Sausalito quay
  (off the model).
- Higgsfield: `balance` **375.00** (2026-09-29 ≈ 04:07 UTC; newest charge 2026-09-28 21:52:17 UTC). Wave 5 spent 25.07
  of its 130 cap (lane V only); every ledger is merged into `src/opus-bay/ASSETS-LEDGER.md` § "Wave 5 (local)" (with
  wave 4's last two batches). The owner's floor is 80; the lead keeps ≥ 250.
- Not deployed: `vercel.json` has `git.deploymentEnabled.opus-bay: false` (opus-bay previews are off). The public site
  gets the game only after the `vercel.json` CSP + `/opus-bay` route fix (NEXT P0) and a merge to `main` on the owner's
  word.
- Still open (details and owners in the summary's §5 NEXT): a real iPhone pass, the floating stick's base in client
  coordinates, GameRoot, `vercel.json`, the lead's decisions (the mantle in the district, leaked-hold timeout, the
  CORRIDOR waiver, 直接到站 on cable cars, 国际橙 vs 国际橘), the live dates Oct 9 12:30 PT (jets), Oct 31, Nov 1 (DST),
  and `STATUS.md`, which still describes v1.

### Where everything is

- **Docs** (`docs/opus-bay/`): `sf-w5-plan.md` (the plan), `sf-w5-lead.md` (day 0: ownership, protocol, frozen
  contracts, hooks, baseline), `sf-w5-{F,N,C,T,L,V,E,A,D,R}.md` (lane reports: parts a–c, then `## Review`),
  `sf-w5-final-verify.md`, `sf-w5-summary.md`, `owner-feedback-2026-09-27.md` (the owner's F1–F5). The mid-wave
  checkpoint has no file of its own: its findings CP-1 … CP-14 and their fixes are in the lanes' part c. Ledger
  `ledger/w5-V.md` (merged); QA images `qa/w5/<LANE>/` and `qa/w5/final/`; the voice listening sheet
  `qa/w5/V/voice/listening.md` (three clips muted until the owner has heard them).
- **Proposals and scouts** of the plan: `C:/Users/willy/opus-qa/w5/proposal-{cozy,action,real}.md`, `scout-*`,
  `capacity/`, `eggs-scout-notes.txt`. Lane scratch `C:/Users/willy/opus-qa/w5/w5-<lane>/`; W5-Z raw output
  `C:/Users/willy/opus-qa/w5z/` (perf tables, sweep JSON, logs, shots).
- **Perf and QA scripts** (in the repo): `scripts/opus-sf/qa/perf/w4-perf.mjs` (the gate runner: `--file w5-spots.json`,
  `--time night`, `--date …`; it answers an open dialogue before each teleport) with `w5-spots.json`, `run-all.sh`,
  `table.mjs`, `opus-prof.mjs`; `scripts/opus-sf/qa/sweep-static.mts` (node, the published city, ≈ 30 s) and
  `walker-sweep.mjs` (the real game; `--deck`); `budget-views.mjs`; `csp-serve.mjs` (the production CSP check);
  `scripts/opus-shot.mjs` (one headless Chrome per run, `CHROME_FLAGS=--force_high_performance_gpu`, `--mobile --dpr 3`);
  `scripts/opus-sf/{coins-place,economy-run}.mts`; voice `scripts/opus-sf/voice/w5/`; assets `scripts/opus-sf/assets/w5/`.
- **Worktrees** `C:/Users/willy/wt/*` (every `node_modules` is a junction to
  `C:/Users/willy/OneDrive/Desktop/baylink-web/node_modules`): the lanes `w5-{f,n,c,t,l,v,e,a,d,r}` (branches
  `w5-<lane>`, done and pushed), `w5-v-gate` (lane V's detached gate tree), `w5-day0`, `w5-lead`, `w5-verify` (W5-Z and
  this hand-off), `w5-bus` (clean at `958dee58`); older waves `w4-*`, `i4-*`, `c2`, `d2`, `e2`, `f`, `g1`, `g2`, `h2b`,
  `ci`. **In flight when this was written:** `w5-lang` (branch `w5-lang`, dev server 5531, uncommitted work on language
  pills: `ui/LangPills.tsx`, `ui/langChoice.ts`, `tests/opus-bay-w5-lang.test.ts` and edits in `core/store.ts`,
  `OpusBayPage.tsx`, …). It is not part of wave 5: leave it to its own agent. W5-Z's last Chrome cleanup may have cut
  off one of its headless screenshot runs: that run should be repeated.
- **The lead's checkout** `C:/Users/willy/baylink-opus` (branch `opus-bay`; it was still at `958dee58` when this was
  written: `git pull --ff-only` there before using its dev server; only `.claude/` is untracked). Its
  `.claude/launch.json`: `opus-bay-dev` = `npx vite --config vite.opus.config.ts --host 0.0.0.0` on **5174**;
  `opus-bay-phone` = `npx vite preview --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/dist-phone --host
  0.0.0.0 --port 4174 --strictPort`.
- **The phone package** `C:/Users/willy/opus-qa/dist-phone` on **4174**, LAN **http://10.0.0.85:4174/opus-bay**: last
  built by W5-Z from `w5-verify` after the flip and the deck fix (a production build). Rebuild from an up-to-date tree:
  `npx vite build --config vite.opus.config.ts --outDir C:/Users/willy/opus-qa/dist-phone` (with `VITE_OPUS_QA=1` for a
  dated QA build where `?date=` works; production ignores `?date=`). The build rewrites `public/*.json` with CRLF only:
  restore them with git afterwards.
- The main checkout `C:/Users/willy/OneDrive/Desktop/baylink-web` belongs to another agent: never touch it.

### Rules learnt (put them in every brief)

1. **Relayed owner messages are not a new task** ("现在进度如何", "继续", "OK"…): they never cancel a brief; add a
   one-line status (in Chinese when asked in Chinese) and keep working.
2. **Never `SendMessage` a running workflow agent's id**: it starts a copy of that agent instead of talking to it. Wait
   for the run; to change finished work, launch a fresh agent with a brief.
3. **Lint the whole repo** (`npx eslint .`, not just `src/opus-bay`): CI runs `npm run check` on every push, and it
   lints `scripts/opus-sf` and the site too.
4. **Never delete through a `node_modules` junction**: `rm -rf`, `Remove-Item -Recurse` and `git worktree remove
   --force` follow it and empty the main checkout's `node_modules` (it happened on 2026-09-27). To drop a worktree:
   `cmd //c rmdir C:\Users\willy\wt\<name>\node_modules` first (removes only the link), check it is gone, then `git
   worktree remove <path>`. Never `npm install` / `npm ci`; if `npx` fails, call `node node_modules/<tool>/…` directly.
5. **One Chrome per lane, and the PERF-LOCK**: at most one headless Chrome per lane; while
   `C:/Users/willy/opus-qa/w5/PERF-LOCK` exists (one line: who, since when) nobody starts a Chrome or a `vite build`;
   fps numbers come only from the gate runs of the visuals lane and the lead's verify. Stray QA Chromes survive restarts
   (W5-Z stopped a day-old one rendering at 0.4 core): list and stop them before a gate. Two lanes shot during a gate in
   wave 5 (R, A): each said so at once, and the gate was re-run.
6. **Vercel previews for opus-bay are off** (`git.deploymentEnabled.opus-bay: false` in `vercel.json`): the branch is
   never deployed; never open a PR, never touch `main`; the lead's day-0 merge of `origin/main` is the only merge.
7. **Usage limits**: commit and push often (every part pushes its code and its report section), so a cut-off agent
   loses little; resume with a fresh agent and a **resume brief** (the last pushed commit, the report's last section,
   what is left, the same ownership and rules). A workflow run cannot be resumed across sessions.
8. Never `git stash` (the stash is shared by every worktree: make a WIP commit); stage explicit paths; rebase on
   `origin/opus-bay`, never merge, never force-push.
9. The suite's wall-clock tests (`opus-bay-audio` P1 sliced jobs, `sf-citymap` draw fast, `sf-nav` window stats) can
   fail under load: re-run a failing one alone before blaming a change. A cold dev server may fail one dynamic import
   while Vite optimizes: reload once.
10. Harnesses must play like a player: the perf runner answers an open dialogue before teleporting (`b61979f5`; a
    dialogue left open made BAYBAY re-plan a 370 u path every ~4 s). Read every image you make before describing it.

### How a new session continues

1. Read this section, `docs/opus-bay/sf-w5-summary.md` (esp. §5 NEXT) and `sf-w5-plan.md` §6 (the owner does not want
   to be asked: follow the defaults and record every decision in the next lead note).
2. Health check in a fresh worktree: `git worktree add C:/Users/willy/wt/<name> -b <name> origin/opus-bay`, then
   `cmd //c mklink /J C:\Users\willy\wt\<name>\node_modules C:\Users\willy\OneDrive\Desktop\baylink-web\node_modules`;
   `npx tsc -p tsconfig.app.json --noEmit` (0), `npx eslint .` (0 errors), `npx tsx --tsconfig tsconfig.app.json --test
   tests/opus-bay-*.test.ts` (fail 0). Bring the lead's checkout up to date (`git pull --ff-only`) before using 5174 /
   rebuilding 4174.
3. NEXT P0 first. Small items (the stick base, `vercel.json`, the lead's decisions, `STATUS.md`) can be done by the lead
   in one worktree with the push protocol; the real iPhone pass needs the owner's phone on the LAN package.
4. **Launch wave 6 the same way as wave 5:**
   - **Plan** (a read-only planner, with proposals / scouts when the scope is new): `docs/opus-bay/sf-w6-plan.md` from the
     summary's NEXT, the owner's newest feedback and the scored proposals — must-fixes first, a default for every open
     question, a Higgsfield plan (a cap, the ≥ 250 floor, one spending lane).
   - **Day 0** (the lead, `wt/w6-day0`): merge `origin/main` only if the site data moved (the one merge); frozen contracts
     with tests (`tests/opus-bay-contracts.test.ts`); hotfixes red-then-green; `docs/opus-bay/sf-w6-lead.md` (ownership
     table, worktrees and ports, the protocol of `sf-w5-lead.md` §3, frozen files, the hooks each lane lands first, the
     baseline = W5-Z's numbers, the `balance`).
   - **Lanes**: one agent per lane in `wt/w6-<lane>` (own dev port, own scratch), in **parts a / b / c**; hooks first;
     every part pushes its code and appends its report section (给主人的摘要 · What was built · Evidence · Decisions ·
     Known gaps · Not done · Requests).
   - **Mid-wave checkpoint** (the lead): the sweep (static, then the live walker), the 20-minute new-player phone script,
     the owner's points; findings CP-n go into the lanes' next part; the must-fixes pass before any should starts.
   - **Reviews**: one adversarial reviewer per lane (every commit read, desktop + 390 × 844 played, facts re-checked on
     the web, defects fixed and pushed, `## Review` appended).
   - **Final verify W6-Z** (the lead, alone on the machine, PERF-LOCK): `npm run check`, tsc, the suite, the perf gate
     (RTX + iGPU + phone 4×), the sweep, the owner's points on the production phone package, the 4174 rebuild; then the
     hand-off: `sf-w6-summary.md`, ledgers → ASSETS-LEDGER, a new top section here.

## WAVE 2 (lean) DONE 2026-09-27 ~05:30 UTC — cloud session stopped for budget; continue locally

Read `docs/opus-bay/sf-w2-summary.md` first (what shipped, what is deferred), then `docs/opus-bay/sf-w2-contracts.md` (file ownership, day-0 hooks, protocol) and the lane reports `docs/opus-bay/sf-w2-{C2,D2,F,G1,G2}.md` (each ends with "Not done" and "Requests").
State: branch `opus-bay` @ this commit; tsc 0, eslint 0, 299/299 tests; district mode unchanged (hero regression green). Higgsfield balance 498.28 (wave 2 spent 21.2; owner allows the whole balance, quality first).

Local continuation, in order:
1. `git pull` on `opus-bay` in `C:\Users\willy\baylink-opus`, `npm ci`, run the health commands from CLOUD.md.
2. Perf + phone first (needs the GPU): fill the table in `sf-w1-checkpoint.md` §4 (6 spots × 1×/4× × desktop/390×844, `?quality=high`), test the phone (LAN build), check iPhone `WEBGL_multi_draw`.
3. Apply the Karl fog + night patches in `docs/opus-bay/wip/` (git am, then git apply), fix the densest-chunk L0/L1 budget test, commit.
4. Then the deferred lanes from the summary, one lane per worktree with the ownership table and push protocol from the contracts doc. Suggested order: E2 camera + pelican → C2 boards → D2 8 SAM meshes (Blender 5.2 locally) + kit swap + routes → F F-line/ferry/life/audio → G2 residents + lines → H2b map/voice/murals → final verify → flip `DEFAULT_WORLD_MODE` to `'city'` when the G2 perf gate passes.
5. Log every Higgsfield job in `docs/opus-bay/ledger/w2-<lane>.md`, merge into ASSETS-LEDGER.md at the end.

The owner paused the session to shut down the computer. Everything is on disk; nothing is committed yet.

## Where things are

- Worktree: `C:\Users\willy\baylink-opus`, branch `opus-bay` (from `main` @ 9664a3c). `node_modules` is a junction to the main checkout.
- Main checkout `C:\Users\willy\OneDrive\Desktop\baylink-web` is being edited by another agent (GPT). **Do not touch it.**
- Only shared-file edits in the branch: `src/App.tsx` (route `/opus-bay`, outside AppLayout) and `src/routing.ts` (`isKnownAppPath`).
- Dev server: preview config `opus-bay-dev` in the main repo's `.claude/launch.json` (runs `npx vite --config vite.opus.config.ts` in the worktree on port 5174, cache dir `.vite-opus`).
- Visual QA tool: `node scripts/opus-shot.mjs` (own headless Chrome per run). Scratch/QA output: `C:\Users\willy\opus-qa\`.
- Typecheck at pause: `npx tsc -p tsconfig.app.json` → 0 errors.

## Module status

| module | status | report |
|---|---|---|
| backbone (DESIGN.md, core/types, store, runtime, events, i18n, GameRoot, page, route) | done | — |
| assets (Higgsfield) | done — key art, 5 portraits, 8 postcards, 10 voice barks, 4 GLBs (sea lions ×2, pelican, sailboat) | `C:\Users\willy\opus-qa\reports\assets-*.md`, `src/opus-bay/ASSETS-LEDGER.md`, `public/opus-bay/README.md` |
| content (pois, script, tours, postcards, VOICE.md) | done, tests pass | `reports\content.md` |
| audio | done, tests pass | `reports\audio.md` |
| district (data/district.ts, core/terrain.ts) | done, 10/10 tests; real OSM geometry; walk Ferry→Pier 39 = 303 u; 239 lots | `reports\district.md`, map `C:\Users\willy\opus-qa\district-map.png`, zoom-*.png |
| flow-ui (game/**, ui/**, data/catalog/links/wishlist, css) | done (finishing pass 2026-09-25) | see `STATUS.md` |
| world (world/**) | done | see `STATUS.md` |
| actors (actors/**, core/input.ts, TouchControls) | done | see `STATUS.md` |
| integration + smoke + perf | done 2026-09-25: tsc 0 / eslint 0 / 81 tests / build OK; full tour, week, free, ride, Coit smoke; 49–60 fps at 4× throttle | `src/opus-bay/STATUS.md`, `C:\Users\willy\opus-qa\reports\integration.md` |

Higgsfield credits used: **188.23** (2D/voice 62.23 + 3D 126.00) of the owner's 500 allowance → **≈ 311 left**. Account balance after: 901.98.

## Update 2026-09-26 ~01:15 PDT — paused again (owner restarting)

- **Polish round 1**: 4 critics + character-3d experiment + plan (44 items) + 3 fixers (world / actors / flow-ui) all finished; the **verify step was stopped midway** (it may have made small edits). After stopping: `tsc` 0 errors, **104/104** opus-bay tests pass.
- Reports: `C:\Users\willy\opus-qa\reports\polish-1-*.md` (plan, critic-*, fix-*, character-3d). Before/after shots: `C:\Users\willy\opus-qa\p1-fix-*.png` and `C:\Users\willy\opus-qa\pol1\`.
- Visible results: lower camera showing sky/skyline/clock tower, much better night, welcome two-shot with option subtitles, in-context control hints, rigged **BAYBAY GLB shipped** (`public/opus-bay/models/baybay.glb`, procedural fallback), newcomer stays procedural (silhouette fixes), 5 resident portraits (`public/opus-bay/portraits/npc-*.webp`).
- Higgsfield credits: 188.23 + 149.00 = **337.23 used of 500** → ≈163 left.
- Owner phone test used a LAN build snapshot of v1 (`C:\Users\willy\opus-qa\dist-phone`, preview config `opus-bay-phone` on port 4174, URL http://10.0.0.85:4174/opus-bay). Rebuild it after verification so the owner sees polish 1.
- **Next steps**: (1) re-run the polish-1 **verify** agent (brief in the workflow script saved at `C:\Users\willy\opus-qa\reports\polish-1-workflow.js`) — full E2E, perf table, before/after sheet, STATUS.md update; (2) rebuild the phone package; (3) owner feedback → polish round 2; (4) head-to-head comparison with `/play` and report; (5) commit only when the owner asks.

## Update 2026-09-26 ~12:00 PDT — new phase: whole San Francisco + movement upgrade

Owner request: study github.com/linranff/GTA_SZ, then expand Opus Bay to ALL of San Francisco in our own toy-diorama style, and improve movement/action mechanics; Higgsfield up to 500 credits this round (balance at start 748.48 → floor ≈ 248). "直接做，不用经过我同意".
- GTA_SZ clone: `C:\Users\willy\opus-qa\ref\GTA_SZ` (read-only; MIT code, assets not reusable).
- Baseline shot before this phase: `C:\Users\willy\opus-qa\sf0-baseline.png`.
- Phase 1 research workflow (7 readers + synthesis) → `C:\Users\willy\opus-qa\reports\sf-research-*.md`; SF raw data → `C:\Users\willy\opus-qa\sf-data\`.
- Research done: THE PLAN is `C:\Users\willy\opus-qa\reports\sf-research-tech.md` (English, implementers) + `sf-research-synthesis.md` (Chinese, owner).
- Lead contracts added before wave 1: `store.worldMode` / `readWorldMode()` (`?world=city`), SurfaceKind `'road'`, `terrain.inWorld` / `MAX_GROUND_Y`, `builder.BatchLike`, `?solo=<landmarkId>` → `world/sf/landmarks/SoloView.tsx`.
- **Wave 1** launched (workflow run `wf_683b9458-e29`, script saved under the session's workflows/scripts/opus-sf-wave1-*.js): lanes A data → `public/opus-bay/sf/v1`, M0 renderer foundation, E movement/vehicles/glide, D procedural landmarks, H Higgsfield part 1 (cap 280 credits, floor balance 468.48), then B terrain/nav (after A), C city streaming (after A+M0), then a checkpoint. Lane reports → `C:\Users\willy\opus-qa\reports\sf-w1-*.md`. If interrupted: read those reports, then re-run only the missing lanes.
- **2026-09-26 09:30 status:** wave-1 lanes A, M0, E, D, H, B, C all finished (reports `sf-w1-*.md`; `?world=city` streams all of SF, 200/200 tests at lane C's end). The checkpoint agent was cut off by a session end and was re-run (same run id). In parallel, Higgsfield part 2a (house kit ≈10 archetypes + ≈7 landmark meshes, cap 120 credits, floor balance 495.48) runs as workflow `wf_4e44c4a1-7a8` → report `sf-w2-H2a.md`. Credits this round so far: 133 (balance 615.48 before 2a).
- Lead's own look at city mode (`opus-qa/sf-lead-twinpeaks.png`): whole city reads great, but (1) roofs are almost all orange gables (SF is mostly flat-roofed pastel/white boxes with bays), (2) haze too strong, downtown washed out, (3) Twin Peaks ground brown not grassy, (4) 152 calls / 637k tris at a high view — over budget.

## MOVED TO THE CLOUD 2026-09-26 ~15:30 PDT

Work continues in a Claude Code cloud session on branch `opus-bay`. Read `docs/opus-bay/CLOUD.md` (rules, path mapping, commands, state at the move, credits: 229 of 500 used). The local-machine notes below still describe what is left.

## PAUSED 2026-09-26 ~09:55 PDT (owner shutting down) — how to resume

State on disk: **tsc 0 errors, 200/200 opus-bay tests pass.** Nothing committed. Dev server must be restarted (preview config `opus-bay-dev`, port 5174).
- Both background jobs were **stopped** by the lead:
  1. **Wave-1 checkpoint** (integration + district regression smoke + city smoke + perf table + wave-2 list) never finished → re-run it as a fresh single-agent workflow: the brief is the `CHECK` prompt in the saved script `…/workflows/scripts/opus-sf-wave1-wf_683b9458-e29.js` (feed it the 7 lane reports `opus-qa/reports/sf-w1-{A,M0,E,D,H,B,C}.md`). Its output: `reports/sf-w1-checkpoint.md`.
  2. **Higgsfield part 2a (house kit)** stopped midway: **56 credits spent** (balance 615.48 → 559.48), concepts + SAM jobs are in `C:\Users\willy\opus-qa\assets-work\sf\kit\` (`jobs1/2.json`, `sam-jobs.json`, `raw/`, `p1–p3`, `z-*.jpg` sheets); nothing published to `public/opus-bay/models/sf/kit/` yet and **the ledger rows for these 56 credits are not written yet** — the resumed agent must first reconcile with `transactions` + `show_generations`, append the ledger, then finish cleanup/publish (reuse downloads, don't regenerate). Remaining cap for it: 120 − 56 = 64 credits (floor balance 495.48). Brief: `…/workflows/scripts/opus-sf-assets-kit-wf_4e44c4a1-7a8.js`.
- Round credit total so far: 133 (part 1) + 56 (part 2a) = **189 of the 450 lead cap / 500 owner allowance**.
- Then **wave 2** (lanes, disjoint file ownership): C2 world look/atmosphere/perf (SF flat roofs + pastels instead of orange gables, lighter haze, green hills, high-view budget, draw walked ground from `groundRaster`, Marin/East Bay boards, Karl the Fog, night light field); E2 movement follow-ups (`routeTo` for long click-to-walk, tap-to-drive, city camera, pelican look); F transit + life + audio (3 cable-car lines + turntables on platforms, F-line to the Castro, ferry, crowd + toy traffic, city ambience); G1 map/fast travel/discovery/save v2/HUD neighbourhood + street (use `arrivalSpot`/`routeTo`); G2 content (landmark cards from `SF_LANDMARK_INFO`, 12 sf postcards, 6 residents, city goals, BAYBAY lines, onboarding copy); D2 landmarks in context + AI mesh swaps (Draco GLB loader, own material with mask tint/night glass) + near-player house-kit swap + 3 finished routes; H2b after G1/G2 (map repaint, barks, murals). Then verify + polish + flip `DEFAULT_WORLD_MODE` to `'city'` once gates pass + rebuild the phone package.
- Next after wave 1: wave 2 (C2 boards/fog/life, F transit, G flow/UI, D placement + AI swaps, H part 2) → verify/polish. Polish-1 verify is folded into the final verify.

## How to resume

**Update 2026-09-25 evening:** the flow-ui finish, world, actors and integration are done (see `STATUS.md`). What is left from the plan below is step 5: owner playtest, polish rounds, the `/play` comparison and listening to the flagged voice clips. Nothing is committed yet.

The workflow run cannot be resumed across sessions. Re-run a continuation workflow based on
`C:\Users\willy\opus-qa\reports\build-v1-workflow.js` but:
1. Skip district, content, audio (done) — pass their saved reports to later agents instead.
2. flow-ui: a "finish" agent that reads the existing game/** and ui/** code, completes what is missing, runs its tests and screenshots.
3. world + actors in parallel (same briefs as in the script, include `reports\district.md`).
4. integrator (same brief, include all reports).
5. Then: owner-visible playtest, 2–3 polish rounds (critics → fixers), head-to-head comparison with `/play`, and a report. Check `zh-yay` and `zh-think` voice clips by ear (auto check was unsure).
