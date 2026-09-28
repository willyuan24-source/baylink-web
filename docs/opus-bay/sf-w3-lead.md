# Wave 3 (local) · lead note: rules on the owner's machine, findings, lane order

Written by the lead on 2026-09-27 before the wave-3 lanes start. **Read this first**, then `sf-w2-summary.md`,
`sf-w2-contracts.md` (ownership §1, hooks §4–§6: still valid) and your lane's task list in `sf-w1-checkpoint.md` §5.
Where this note and an older doc differ, this note wins.

**Never delete through a junction.** `node_modules` in every worktree is a junction to the main checkout's. `git worktree remove --force`, `rm -rf` or `Remove-Item -Recurse` on a worktree FOLLOWS that junction and empties the main checkout's `node_modules` (this happened once on 2026-09-27: `.bin` was emptied and had to be rebuilt). To remove a worktree: first `cmd //c rmdir C:\Users\willy\wt\<name>\node_modules` (removes only the link), check it is gone, then `git worktree remove <path>`. Never delete anything under `node_modules`.

## 1. State at the start of wave 3

- `opus-bay` @ the commit that adds this note. Before it: `e22d600` (perf table + phone check, checkpoint §4),
  `55b4833` + `a9b25d5` (Karl the Fog + night light field applied from the old `wip/` patches; the densest-chunk test
  now accepts the lamp level on city asphalt). tsc 0, eslint 0, **306/306** opus-bay tests, hero regression green.
- Higgsfield balance **498.28** (checked 2026-09-27 00:00 PDT). The owner allows the whole balance; quality first; log
  every job.
- Phone package (LAN): `C:/Users/willy/opus-qa/dist-phone`, served by the preview config `opus-bay-phone` on port 4174,
  `http://10.0.0.85:4174/opus-bay?world=city` (the lead rebuilds it at the end).

## 2. Owner-machine findings routed to lanes (details: `sf-w1-checkpoint.md` §4.2–§4.4)

| # | finding | owner | what to do |
|---|---|---|---|
| P1 | The first key / tap boots the audio rig synchronously (`audio/audio.ts boot`: AudioContext + `AudioEngine` noise / impulse buffers ≈ 370 ms), then `ambience.setWorld(describeWorld(DISTRICT, true))` builds the shore field 900 ms later (`logic.ts distToSegment` ≈ 135 ms): 2 frames > 100 ms in **every** run; on a phone a 1–2 s freeze on the first touch. | **F** | Create the context suspended at load (idle), do only `resume()` + the silent unlock sample inside the gesture; build noise / impulse buffers and the shore field in idle slices (≤ 4 ms each) or a worker. Test: a node test that `boot()` does no buffer synthesis; measure: 0 frames > 100 ms in the first walk (perf script `scripts/opus-sf/qa/perf/`). |
| P2 | Dense views are main-thread bound at 4× CPU (27–40 fps). three.js re-looks-up programs every frame (`getParameters` + `getProgram` + `setProgram` ≈ 9 % of the frame): the classic sign of one material instance shared between object kinds (Mesh / InstancedMesh / BatchedMesh / SkinnedMesh, or different `receiveShadow`, fog, `instanceColor`). `BatchedMesh.onBeforeRender` (per-item culling + sorting) + `projectObject` + `updateMatrixWorld` ≈ 9 %. | **C2** (materials, pools, stream); E2 / F / D2 for their own materials | Find the shared instances (instrument `renderer.programs` or count `material.onBeforeCompile` / program switches per frame), give each object kind its own material instance with the same program key; `sortObjects = false` on opaque BatchedMeshes; skip `matrixWorldAutoUpdate` on static city groups. Target: ≥ 45 fps at 4× in the six spots on the RTX. |
| P3 | `pool=tile` (the no-`WEBGL_multi_draw` fallback, i.e. a phone without multi-draw) draws **519k** triangles at Twin Peaks vs 396k batched for the same cells. | **C2** | Per-item (or per-tile) frustum culling in the tile pool; budget ≤ 400k in both paths. |
| P4 | Auto quality never steps down on the phone profile (30–45 fps on `high`): drei `PerformanceMonitor` declines only when 7 of 8 windows are < 40 fps. `mid` holds 60 at both phone spots; `low` buys nothing over `mid`. | **C2** (CS-7, `WorldScene.tsx` + `GameRoot.tsx`) | Touch / coarse-pointer or DPR ≥ 2 devices start at `mid` unless `?quality` or a saved choice says otherwise; decline at ≈ 50 fps (custom `bounds`), and never flip back up in the same visit. The G1 settings panel keeps showing the real level. |
| P5 | `programs` drift by 1–3 after warm-up at the Ferry gate, Ocean Beach and GGB. | **C2** (CS-6) + every lane that adds a material | `registerWarmup` for every new program; `programs` equal at 1× idle and 4× walk. |
| P6 | Triangles: Chinatown (Dragon Gate) desktop 432k (> 400k); iGPU Ferry gate 408k. | **C2** (budget) + **D2** (C2-5 "Sites" LOD by camera height) | ≤ 400k incl. shadows. |
| P7 | GameRoot is **311.7 KB** gzip after Karl (`world/sf/fog.ts` is in the main graph through `materials.ts` / `environment.ts`); target 250 KB. | **E2** (C2's requests 1–2: `moveSystem` via `cityModule()`, lazy `walkGraph`), **C2** (keep only the shader strings + uniforms of fog in the main graph) | Measure with `npx vite build --config vite.opus.config.ts --outDir <scratch>` (never into `dist/`). |
| P8 | `game/Systems.tsx project()` (click proxies) runs every frame: 2 % at 4×. | **G1** | Project at 10–15 Hz or only while the pointer is over the canvas / a proxy is in view. |
| M1 | Phone HUD (390×844): the "It's night in the Bay … See the night view" banner covers the top of the goals card; the postcard-clue label collides with BAYBAY's bubble. | **G1** (DR-3) | No overlaps at 390×844 and 375×667 in city mode; shots of each HUD state. |
| M2 | A tap on a building facade does nothing (only ground taps walk). | **E2** | Tap on a building → walk to the nearest reachable ground spot in front of it (`arrivalSpot` / walk graph), with the ring marker. |
| M3 | Karl reads as a light haze from Twin Peaks at walking height (it does hide the Golden Gate in the morning). | **C2** (C2-14) | Tune on the contact sheet (morning / golden / day / night, walk + high views) so Karl reads as a fog bank rolling in over the Sunset and through the Gate, downtown still readable. District before / after with Karl on (uKarl stays 0 there). |

Mobile is a first-class target from now on: every lane checks what it builds at **390×844 and 375×667, `--mobile
--dpr 3`**, with touch (no keyboard-only features), and at `quality=mid`.

## 3. Local protocol (replaces `sf-w2-contracts.md` §2 paths)

**Machine:** Windows 11, Ryzen 9 5900HX (16 threads), 31 GB, RTX 3070 Laptop + AMD iGPU, Chrome 153, Blender 5.2
(`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`), Python 3 on PATH (`python`), Node 24. Shells: Git Bash
(the Bash tool) and PowerShell. Use forward-slash Windows paths in Node / JSON (`C:/Users/...`), never `/c/Users/...`
(Node reads that as `C:\c\Users`).

**Worktrees** (made by the lead): `C:/Users/willy/wt/<lane>` on branch `w3-<lane>` from `origin/opus-bay`, with
`node_modules` as a junction to the main checkout's. **Never run `npm install` / `npm ci`** (the main checkout
`C:/Users/willy/OneDrive/Desktop/baylink-web` belongs to another agent: never touch it). Work only in your worktree.

**Ports:** C2 5201 · D2 5202 · E2 5203 · F 5204 · G1 5205 · G2 5206 · H2b 5207 · verify 5210 (the lead's dev server is
5174, the phone preview 4174: leave both alone).
`npx vite --config vite.opus.config.ts --port <PORT> --strictPort` (background; kill it when you finish: PowerShell
`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -like '*--port <PORT>*' | % { Stop-Process -Id $_.ProcessId -Force }`).

**Screenshots / QA:** `node scripts/opus-shot.mjs --url "http://localhost:<PORT>/opus-bay?..." --out C:/Users/willy/opus-qa/w3/<lane>/x.jpg ...`
(real GPU; add `CHROME_FLAGS="--force_high_performance_gpu"` for the RTX; `--mobile --dpr 3` for phones). At most 2 of
your own headless Chromes at a time. fps is real here but six lanes share the machine: treat fps as rough; the perf gate
belongs to the final verify (the lead re-runs `scripts/opus-sf/qa/perf/`). Scratch output goes to
`C:/Users/willy/opus-qa/w3/<lane>/`; a few key JPEGs go to `docs/opus-bay/qa/w3/<LANE>/`. **Read every image before you
describe it.**

**Checks before every push** (from the worktree root):

```bash
npx tsc -p tsconfig.app.json --noEmit                                   # 0 errors
npx eslint .                                                             # 0 errors (whole repo: CI runs `npm run check`, which lints scripts/opus-sf too)
npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts     # all green, incl. hero regression + contracts
```

**Commit and push:** small logical commits, messages start with the task id (`E2-8: …`) and end with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage explicit paths only (**never `git add -A` / `git add .`**;
never commit `.claude/`, `.vite-opus/`, `dist/` or scratch files). Then
`git fetch origin opus-bay && git rebase origin/opus-bay` (re-run the checks if the rebase brought commits) and
`git push origin HEAD:opus-bay`; on a rejection repeat; on a lock / network error wait and retry (2, 4, 8, 16 s). Never
touch `main`, never merge, never open a PR, never force-push. A rebase conflict in a file you do not own: stop and report.

**Ownership:** `sf-w2-contracts.md` §1.1 unchanged (frozen files stay frozen: write exact changes under "Requests" in
your report; the lead merges them after the wave). New files belong to the lane that makes them. The cross-lane requests
already written in the wave-2 reports are addressed to the file's owner, who does them in wave 3 (listed per lane in the
brief).

**Reports:** `docs/opus-bay/sf-w3-<LANE>.md` — first a short **给主人的摘要** in Chinese (3–6 lines, plain words), then
What was built (files, API) · Evidence (checks, numbers, shots) · Decisions · Known gaps · Not done · Requests. Each
part appends its own section (`## Part a`, `## Part b`, `## Review`).

## 4. Higgsfield (balance 498.28 at the start)

Caps per lane (quality first; spend below the cap when the result is already good): **D2 80** (SAM landmark retakes,
the kit), **E2 50** (glide-pelican fallback, only if the procedural pelican reads weak on the contact sheet), **F 25**
(generated SFX only if synthesis sounds cheap), **C2 20** (art-direction targets), **H2b 150** (painted map, voice
lines, murals; G2's barks go through H2b). Reserve ≈ 170 for the final polish.
Log every job in `docs/opus-bay/ledger/w3-<LANE>.md` (columns of `ASSETS-LEDGER.md`); before a batch `balance`, after
every batch `transactions` (the account is shared by parallel lanes: attribute by job id and time, never by the balance
difference alone). Results download from `d8j0ntlcm91z4.cloudfront.net` (reachable locally).

## 5. Lanes and order

All six code lanes run in parallel (disjoint files). H2b starts when G1 and G2 have finished (it needs G2's frozen
`BARK_SCRIPT` and G1's map mount). Then the lead runs the final verify (perf table again, phone, district regression,
reports) and flips `DEFAULT_WORLD_MODE` to `'city'` only if the G2 gate passes.

Cross-lane timing (push these **early**, in your first commits, so the others can use them):
- E2: `moveApi.setGlideUnlocked(v)` (G1 restores it from save v2); `registerObstacleSource` consumption in `giveWay` (F).
- G2: `BARK_SCRIPT` in `data/sf/lines.ts`, frozen (H2b records it).
- F: the `transit` events already exist; F registers crowd / traffic obstacle sources after E2's consumer lands.
- G1: `<MapPaperLayer />` mounted in the city map (null-safe; H2b fills `MAP_PAPER`).
- D2: `placeId` on every `SfLandmarkInfo` (D2-12) and the glossary fixes G2 asked for.
