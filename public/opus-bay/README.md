# Opus Bay assets

Assets for Opus Bay (`/opus-bay`), BAYLINK's 3D mini-world of the San Francisco Embarcadero.
They are AI-generated with [Higgsfield](https://higgsfield.ai) on **2026-09-25**, reviewed by hand and optimized for the web.
The typed manifest the page reads is `src/opus-bay/data/assets.ts`. Every paid job (model, prompt, credits, output, local file) is in `src/opus-bay/ASSETS-LEDGER.md`.

## Files (49 assets)

| folder | contents | format |
|---|---|---|
| `art/` | Title key art: `key-wide-1920/1280` (16:9, empty top third for the title) and `key-tall-1080/720` (9:16, empty lower third) | WebP q80 |
| `portraits/` | BAYBAY `happy` (waving), `thinking`, `excited` (pointing), `proud`, plus `newcomer-neutral`; residents `npc-vendor`, `npc-fisher`, `npc-streetcar`, `npc-family`, `npc-jogger` | 512 × 512 WebP q85 on flat `#f3ecdf` |
| `postcards/` | 8 postcard illustrations, each `-1200` (1200 × 900) and `-600` (600 × 450): ferry-building-dawn, pier7-sunset, exploratorium, filbert-steps, coit-tower, bay-bridge-night, sea-lions, streetcar | 4:3 WebP q82 |
| `voice/` | 10 BAYBAY barks (`zh-hi`, `zh-this-way`, `zh-wow`, `zh-yay`, `zh-arrived`, `zh-think`, `en-hi`, `en-this-way`, `en-yay`, `en-arrived`), 0.5–1.2 s | `.m4a` AAC 64 kbps mono and `.ogg` Opus 48 kbps mono, trimmed, -18 LUFS |
| `models/` | `sea-lion`, `sea-lion-bark`, `pelican`, `sailboat`; `baybay` (rigged BAYBAY, 9 bones, 8.3k triangles, 585 KB, loaded after Start) | GLB, one mesh + one matte material, 512 px JPEG texture, 1.9k–2.9k triangles, 171–218 KB, origin bottom-centre, front +Z |

Every image prompt used the same style contract: soft handcrafted miniature diorama, matte clay and painted wood, warm golden-hour light, cream / sand / sage / terracotta / teal / silver-grey palette, no text or logos.

## Models used

| model (on Higgsfield) | used for |
|---|---|
| Nano Banana Pro | key art, portraits, postcards (27 generations, 10 shipped) |
| FLUX.2 Pro outpaint | widening the 16:9 key art to clear the title space |
| Image background remover | portrait cut-outs, recomposited locally on `#f3ecdf` |
| Qwen TTS (`qwen_audio_tts`, preset "Pixie") | all 10 voice barks (Seed Audio was auditioned, not shipped) |
| GPT Image 2.5 (high) | concept images for the 3D creatures |
| Meshy image-to-3D | the four GLBs, then cleaned up in Blender 5.2 (decimate, recenter, matte material) |

Local post-processing (free): Pillow for WebP, FFmpeg for audio trim / loudnorm / encode, Blender for GLB cleanup.

## Credits

| pass | credits |
|---|---|
| 2D art + voice | 62.23 |
| 3D creatures | 126.00 |
| **Total** | **188.23** |

Account balance went from 1090.21 to 901.98 over the run (a drop of 188.23, matching the ledger).

## Whole San Francisco (2026-09-26, wave 1)

| folder | contents | notes |
|---|---|---|
| `sf/current.json`, `sf/v1/` | Streamed city data: 194 chunk files `c/<cx>_<cz>.obc`, `far.obc`, `graph.obc`, `transit.json`, `places.json`, `manifest.json`, `report.json` | Built by `scripts/opus-sf/build.ts`, published by `scripts/opus-sf/publish.ts` (never overwrites a version). 4.6 MB on disk, 3.96 MB gzip, streamed by workers in city mode only (`?world=city`). Sources and licences: `sf/v1/ATTRIBUTION.md` (© OpenStreetMap contributors, ODbL; DataSF, PDDL; AWS Terrain Tiles). |
| `models/sf/` | `victorian-a`, `victorian-b` (+ `-mask.webp`), `palace-rotunda`, `dragon-gate`, `conservatory` (+ `-mask.webp`) | SAM 3 3D meshes (Higgsfield), cleaned in Blender, Draco + WebP. Masks: R = night-lit glass, G = tintable walls (load with `flipY = false`). Not yet loaded by the game (needs a DRACOLoader). |
| `models/sf/draco/` | `draco_decoder.wasm`, `draco_wasm_wrapper.js` | Copied unchanged from three 0.186 (`examples/jsm/libs/draco/gltf/`). |
| `postcards/sf-*` | 12 San Francisco postcards (golden-gate-fog, painted-ladies, palace-fine-arts, cable-car-hill, chinatown-lanterns, lombard-street, mission-murals, dolores-park, windmill, city-hall, twin-peaks-view, ocean-beach), `-1200` and `-600` | 4:3 WebP, no text. |
| `portraits/sf-npc-*` | gripman, baker, muralist, gardener, ranger, record-store | 512 px WebP, same style as `npc-*`. |
| `badges/` | 18 neighbourhood badges | 256 px WebP, transparent. |

Every paid job is in `src/opus-bay/ASSETS-LEDGER.md` ("Whole-SF assets, part 1 (lane H)"): 133.00 credits.

## Whole San Francisco, wave 3 (2026-09-27, lane H2b)

| folder | contents | notes |
|---|---|---|
| `map/` | `paper-v1-{1024,2048,4096}.webp`: the painted whole-city map under the city map (square, the world frame `MAP_FRAME`) | Nano Banana Pro 4k repaint of our own top-down base render (`scripts/opus-sf/map/render-base.ts`, no text) with the K6 key art as a style reference; similarity-fitted to our coast (p95 12 px at 2048), graded, pseudo-letters wiped (`scripts/opus-sf/map/paper_post.py`). 111 / 345 / 668 KB; phones stop at 2048. Registry: `src/opus-bay/data/mapPaper.ts`. |
| `voice/sf/` | 76 BAYBAY city lines (`zh-` / `en-` × 38 lines: 8 mode firsts `first-*`, 20 neighbourhood greetings `zone-<far.zones id>` + the `zone-new` opener, 9 reactions and transit lines) and 3 re-records of district barks (`zh-yay` 好耶好耶！, `zh-think` 嗯…让我想想, `zh-arrived` 到啦！) | Qwen TTS (`qwen_audio_tts`, preset "Pixie", the district instruction + a mood), picked by measured checks from 3–10 takes each (`scripts/opus-sf/voice/voice_post.py`); trimmed, −18 LUFS / TP −1.5, every clip ≤ 2 s; `.m4a` AAC 64 kbps + `.ogg` Opus 48 kbps mono. The re-records stay muted until the owner approves them by ear (`docs/opus-bay/h2b/listening.md`). Registry: `src/opus-bay/data/voiceLinesSf.ts`. |
| `murals/` | `atlas-v1.webp` (2048 × 1024, 4 × 2 tiles, 256 KB) and eight `<id>-512.webp` singles: sun-hummingbird, poppy-hills, fruit-stand, music-garden, pelican-bay, flower-cable-car, night-bay, kelp-forest | Original paintings in the spirit of the Mission's mural alleys — none copies a real mural; no people, no faces, no text. GPT Image 2.5 high (won an A/B against Nano Banana Pro + K6); tiles carry a 16 px edge gutter (`scripts/opus-sf/murals/murals_post.py`). Shown as freestanding boards along Clarion and Balmy alleys (`src/opus-bay/data/murals.ts`, `world/sf/murals.ts`). |

Every paid job of wave 3 is in `docs/opus-bay/ledger/w3-H2b.md` (merged into `src/opus-bay/ASSETS-LEDGER.md` by the lead):
map 20.5 + voice 3.20 + murals 19.0 = **42.70 credits**.
