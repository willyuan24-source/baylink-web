# Opus Bay — resume notes (paused 2026-09-25 ~17:05 PDT)

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
