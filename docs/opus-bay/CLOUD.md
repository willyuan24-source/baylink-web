# Opus Bay in a cloud session

The Opus Bay work moved from the owner's Windows machine to a Claude Code cloud session on 2026-09-26 (≈ 15:30 PDT). Branch: `opus-bay` of `willyuan24-source/baylink-web` (a **public** repo). Read `src/opus-bay/RESUME.md` first, then this file.

## Rules that still apply

- Work only on the `opus-bay` branch. Never push to `main`, never merge, never open a PR unless the owner asks.
- Only Opus Bay files: `src/opus-bay/**`, `public/opus-bay/**`, `scripts/opus-sf/**`, `scripts/opus-shot.mjs`, `tests/opus-bay-*`, `vite.opus.config.ts`, `docs/opus-bay/**`. The two site files already touched (`src/App.tsx` route, `src/routing.ts` path) stay as they are. Never edit `src/features/little-bay/**`, `src/data/**`, `public/*.json` (another team's work).
- Commit in small steps on `opus-bay` and push, so nothing is lost if the session ends.
- Higgsfield: **229 credits were used this round before the move** (133 part 1 + 56 part 2a first run + 40 part 2a resumed run; balance 748.48 → 519.48; reconciled in `src/opus-bay/ASSETS-LEDGER.md`). **Owner update 2026-09-26 (cloud session): the whole remaining balance of 519.48 may be used if needed; quality matters most.** The old 450 cap / 298.48 floor no longer apply. Still log every job in the ledger and check `transactions` after every batch.
- The cloud network policy blocks the Higgsfield result CDN (`d8j0ntlcm91z4.cloudfront.net`, proxy 403). Until the owner allows that host in the environment's network settings, generated images, audio and meshes cannot be downloaded into the repo from the cloud; generate only when the download works (test with `curl -sS -o /dev/null -w '%{http_code}' <a result url>`).

## Path mapping (the lane reports cite local Windows paths)

| local path in reports | in the repo |
|---|---|
| `C:/Users/willy/baylink-opus/…` | repo root |
| `C:/Users/willy/opus-qa/reports/sf-*.md` | `docs/opus-bay/sf-*.md` (plan: `sf-research-tech.md`; owner summary: `sf-research-synthesis.md`) |
| `C:/Users/willy/opus-qa/sf-data/landmarks.json` | `scripts/opus-sf/fetch/landmarks.json` |
| `C:/Users/willy/opus-qa/sf-data/tools/*` | `scripts/opus-sf/fetch/*` |
| `C:/Users/willy/opus-qa/sf-data/raw/*` (≈ 640 MB) | not in git; only needed to rebuild the SF data. Re-fetch with the scripts in `scripts/opus-sf/fetch/` into a folder and set `OPUS_SF_DATA` (see `scripts/opus-sf/lib/io.ts`). The published data `public/opus-bay/sf/v1` is complete without it. |
| `C:/Users/willy/opus-qa/*.png`, `assets-work/**`, `ref/GTA_SZ` | not in git (QA screenshots, asset scratch, reference clone). Re-clone GTA_SZ if needed: `git clone --depth 1 https://github.com/linranff/GTA_SZ` (read-only reference; MIT code, assets not reusable). |

## Commands

```bash
npm ci
npx tsc -p tsconfig.app.json --noEmit
npx tsx --tsconfig tsconfig.app.json --test tests/opus-bay-*.test.ts
npx eslint src/opus-bay tests/opus-bay-*
npx vite --config vite.opus.config.ts          # dev server on :5174 → /opus-bay?start=free&world=city
npx vite build --config vite.opus.config.ts --outDir /tmp/opus-dist
```

Screenshots in the cloud (checked 2026-09-26): `CHROME_FLAGS="--use-angle=swiftshader --enable-unsafe-swiftshader --use-gl=angle" node scripts/opus-shot.mjs --url "http://localhost:5174/opus-bay?start=free&world=city" --w 960 --h 600 --wait 40000 --out shot.png`. The script finds the Playwright Chromium in `/opt/pw-browsers` and adds `--no-sandbox` when it runs as root; without the SwiftShader flags WebGL is disabled. It renders at about 3 fps, so give it long waits and small viewports. `renderer.info` draw calls and triangles are still valid there, but **fps numbers are meaningless** — performance and phone checks wait for the owner's machine. The container has 4 CPUs: run at most 2 headless Chromes at a time.

## Not available in the cloud

- GPU (perf measurement), Blender 5.2 (3D asset cleanup: `assets-work` scripts), the owner's phone LAN test.
- Anything under `C:/Users/willy/…`.

## State at the move

- `tsc` 0 errors; opus-bay tests all pass (200 at the last full run).
- The wave-1 checkpoint (integration, smoke, perf, wave-2 list) was running when the machine had to shut down; if `docs/opus-bay/sf-w1-checkpoint.md` is missing or partial, redo its non-GPU parts in the cloud (health checks, district regression, city smoke via screenshots) and leave the perf table for the next local run.
- House kit (Higgsfield part 2a) was stopped at 15:18 PDT: 22 files published in `public/opus-bay/models/sf/kit/`; the ledger (`src/opus-bay/ASSETS-LEDGER.md`) reconciles the first 56 credits, but the **last 40 credits (after balance 559.48) may be missing from the ledger** — reconcile first with `transactions` + `show_generations` (job lists copied to `docs/opus-bay/kit-jobs/`). Check which kit ids and landmark meshes are registered in `src/opus-bay/data/assets.ts` (SF_KIT / SF_MODELS). Raw SAM downloads and Blender cleanup scripts live on the owner's machine (`C:/Users/willy/opus-qa/assets-work/sf/kit/`); unfinished Blender cleanup stays for a local run.
- The wave-1 checkpoint was stopped at 15:18 PDT before writing its report (no `sf-w1-checkpoint.md`); tsc 0 errors and 200/200 tests at the move.
- Next: wave 2 (see RESUME.md "PAUSED 2026-09-26 ~09:55" list and the checkpoint's wave-2 list).
