# Opus Bay — generated assets ledger

Every paid generation for `public/opus-bay/**` is recorded here (append-only).
Style contract used in every image prompt (subject varies):

> Soft handcrafted miniature diorama, tilt-shift toy photography feel, matte clay and painted wood materials, warm golden-hour light, gentle soft shadows, clean warm cream background (#f3ecdf) where background is visible, palette of cream, sand, sage green, terracotta, teal water, silver-grey; cozy, charming, calm; no text, no letters, no logos, no watermarks.

## 2D art + voice pass (assets agent, cap 220 credits)

Balance at start: 1090.21 credits (shared account; other agents may spend in parallel, so the per-job costs below are the authoritative tally for this pass).

Reference uploads (free): `0acf8ba7-5f9f-4d92-b1ed-fc369ddf71f2` = public/brand/baybay-avatar.png, `287d7e4e-3cd7-4f0d-b39a-3e995cc2066c` = public/brand/bay-area-diorama-v2.webp (as PNG).

Rows for this pass are appended at the end of the file in "2D art + voice — log" blocks (several agents append to this file concurrently).

## 3D creatures (assets agent: creatures) — 2026-09-25

Budget cap: 200 credits. Balance at start: 1090.21.

| # | model | prompt summary | credits | output URL | local file |
|---|---|---|---|---|---|
| C1 | gpt_image_2_5 (high, 1:1, 1k) | concept: sea lion lying on belly, caramel clay, 3/4 view, style contract | 1.5 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222658_03c3d7aa-18e2-438c-9c8d-c6984ef63d2c.png | C:/Users/willy/opus-qa/assets-work/creatures/concept-sea-lion.png |
| C2 | gpt_image_2_5 (high, 1:1, 1k) | concept: sea lion propped up, head raised barking, 3/4 view, style contract | 1.5 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222658_c0484651-89cd-4336-ba85-9f0db1d908e8.png | C:/Users/willy/opus-qa/assets-work/creatures/concept-sea-lion-bark.png |
| C3 | gpt_image_2_5 (high, 1:1, 1k) | concept: brown pelican standing, silver-grey/cream clay, 3/4 view, style contract | 1.5 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222658_36518859-4ffc-4219-885b-62573bcaa88a.png | C:/Users/willy/opus-qa/assets-work/creatures/concept-pelican.png |
| C4 | gpt_image_2_5 (high, 1:1, 1k) | concept: small white sailboat, teal stripe, cream sails, keel visible, style contract | 1.5 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222658_cd2765a4-e660-4aa2-9cda-226c22b58ba2.png | C:/Users/willy/opus-qa/assets-work/creatures/concept-sailboat.png |
| M1 | Meshy image_to_3d (textured, remesh tri, target 5000, no PBR/rig) | sea lion lying, from C1 | 30 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222752_fe6f693a-67eb-437e-b508-4262379b768f.glb | C:/Users/willy/opus-qa/assets-work/creatures/raw-sea-lion.glb |
| M2 | Meshy image_to_3d (textured, remesh tri, target 5000, no PBR/rig) | pelican standing, from C3 | 30 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222754_39886151-f483-47ce-8eeb-2f90fcfd6ef2.glb | C:/Users/willy/opus-qa/assets-work/creatures/raw-pelican.glb |
| M3 | Meshy image_to_3d (textured, remesh tri, target 4000, no PBR/rig) | sailboat, from C4 | 30 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_222755_fca7ff1a-2f11-42dd-a864-82fdf2add0b3.glb | C:/Users/willy/opus-qa/assets-work/creatures/raw-sailboat.glb |
| M4 | Meshy image_to_3d (textured, remesh tri, target 5000, no PBR/rig) | sea lion head-raised barking, from C2 | 30 | https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/hf_20260925_223122_c1c8c68f-975b-42a3-ad02-fe5fa8daeb5f.glb | C:/Users/willy/opus-qa/assets-work/creatures/raw-sea-lion-bark.glb |

Creatures subtotal: **126 credits** (4 x 1.5 concept images + 4 x 30 Meshy image_to_3d), confirmed against `transactions`. No rejects or redos.
Account balance at end: 909.98. The account is shared with the other asset agents running at the same time (Nano Banana Pro images, audio), so the balance dropped by more than this section's 126.

Web GLBs (Blender 5.2 headless cleanup: join, weld seams, decimate, recenter to bottom-center, front = +Z, metallic 0 / roughness 0.9, normal/PBR maps dropped, base color 512 px JPEG q82, Draco OFF):

| file | tris | size | bounds (x × y × z, u) | runtime hint |
|---|---|---|---|---|
| public/opus-bay/models/sea-lion.glb | 2909 | 175,584 B | 1.18 × 0.75 × 1.60 | scale 1, yOffset 0 (belly on the float) |
| public/opus-bay/models/sea-lion-bark.glb | 2907 | 185,328 B | 0.79 × 1.05 × 1.16 | scale 1, yOffset 0 (same volume as the lying one, so it pairs 1:1) |
| public/opus-bay/models/pelican.glb | 2909 | 223,224 B | 0.49 × 1.00 × 0.76 | scale 1 (1.0 tall), yOffset 0; for glide use the same mesh tilted |
| public/opus-bay/models/sailboat.glb | 1939 | 177,796 B | 1.05 × 4.96 × 4.00 | scale 1, yOffset ≈ -0.75 (keel 0–0.5, hull 0.5–1.45, so the waterline sits about 0.75 above the keel bottom) |

Previews: C:/Users/willy/opus-qa/assets-work/creatures/sheet-*.png (front/side/3-4/top), lineup-eevee.png (lit lineup).

## 2D art + voice — log (assets agent, cap 220)

Base URL for outputs: `https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/` (+ file name below). Raw downloads live in `C:/Users/willy/opus-qa/assets-work/raw/` and `.../audio/`.
Every image prompt = subject + the style contract above (verbatim). Model `nano_banana_pro` (the job API labels it nano_banana_2), preflight 2 credits per image at 1k or 2k.

| # | asset | model / settings | prompt summary | credits | job id / output file | local raw file | status |
|---|---|---|---|---|---|---|---|
| A1 | BAYBAY master (happy, waving) | nano_banana_pro 1:1 1k, ref = brand avatar | clay otter, teal scarf + orange pin, waving, plain cream bg | 2 | 14f39998 / hf_20260925_222811_14f39998-26f8-4809-889e-3bc0bb69b561.png | raw/p-baybay-happy-a.png | USED: identity ref for all later jobs + portraits/baybay-happy |
| A2 | BAYBAY master alt | same | same | 2 | 200d671b / hf_20260925_222812_200d671b-aa63-4afc-8d4a-e7016a575ae5.png | raw/p-baybay-happy-b.png | rejected (props in background) |
| A3 | newcomer master | nano_banana_pro 1:1 1k | round cream plush traveler, terracotta bucket hat, teal backpack, rolled map | 2 | ec4b4fb3 / hf_20260925_222811_ec4b4fb3-3ba9-4e10-a320-0c62807394c9.png | raw/p-newcomer-a.png | USED: portraits/newcomer-neutral + key-art ref |
| A4 | newcomer alt | same | same | 2 | a2854202 / hf_20260925_222811_a2854202-f8d3-491a-b762-c00e5bd862da.png | raw/p-newcomer-b.png | rejected (open flat map, weaker silhouette) |
| B1 | baybay-thinking | nano_banana_pro 1:1 1k, ref A1 | paw on chin, head tilt | 2 | d6e605fb / hf_20260925_223023_d6e605fb-0f21-4e7d-ae44-5f1ba3b8312e.png | raw/p-baybay-thinking-a.png | USED |
| B2 | baybay-excited | same | pointing, star-sparkle eyes, hop | 2 | ac04f7ab / hf_20260925_223023_ac04f7ab-0f2a-40c9-a1fb-ce0dca129f94.png | raw/p-baybay-excited-a.png | USED |
| B3 | baybay-proud | same | holding a picture postcard (no writing) | 2 | 9fb3b404 / hf_20260925_223023_9fb3b404-0298-46cc-b611-5ab0268cc857.png | raw/p-baybay-proud-a.png | USED |
| K1 | key art wide v-a | nano_banana_pro 16:9 2k, refs A1 + A3 + brand diorama | Embarcadero diorama slab on cream table, Ferry Building, streetcar, piers, Bay Bridge, Coit Tower, BAYBAY waves to newcomer; top third empty | 2 | bd6f4c06 / hf_20260925_223023_bd6f4c06-8d1d-4039-aaaa-367b34fdf6da.png | raw/key-wide-a.png | rejected (clock tower breaks the title space) |
| K2 | key art wide v-b | same | same | 2 | b1b74fc9 / hf_20260925_223024_b1b74fc9-6020-47ec-84ed-00e56d766ec6.png | raw/key-wide-b.png | runner-up, not shipped (characters small) |
| K3 | key art tall v-a | nano_banana_pro 9:16 2k, same refs | same scene, lower third empty | 2 | b78c8644 / hf_20260925_223024_b78c8644-53c0-4157-b552-b6f825aabbdd.png | raw/key-tall-a.png | rejected (characters stand on the water) |
| K4 | key art tall v-b | same | same | 2 | e8a213b0 / hf_20260925_223023_e8a213b0-c81d-44a0-b476-165c60373ce8.png | raw/key-tall-b.png | USED -> art/key-tall-* (content shifted up 100 px, empty table extended) |
| K5 | key art wide v-c | nano_banana_pro 16:9 2k, same refs, stricter layout rule | diorama in lower 65%, characters ~1/5 frame height | 2 | 617490ef / hf_20260925_223758_617490ef-9d1d-496a-a937-5695fa168ee8.png | raw/key-wide-c.png | rejected (ghost duplicate of the scene) |
| K6 | key art wide v-d | same | same | 2 | 3617006b / hf_20260925_223758_3617006b-483d-4ea7-9e72-39b681f8264f.png | raw/key-wide-d.png | USED as outpaint source |
| K7 | key art wide final | flux_2_pro_outpaint on K6 downscaled to 1600 px (upload 808de487), expand top 420 / sides 367 | extend empty cream backdrop + table | 2.64 | 33cf7b82 / hf_20260925_225243_33cf7b82-f9b5-4656-a8e8-96a2e663ebcb.png | raw/key-wide-d-outpaint.png | USED -> art/key-wide-* |
| P1 | ferry-building-dawn v-a | nano_banana_pro 4:3 2k | clock tower at dawn, market tents on plaza | 2 | c3de4cdc / hf_20260925_223048_c3de4cdc-a8f3-48a3-ba20-0e38ff92ef00.png | raw/pc-ferry-building-dawn-a.png | rejected (tower top cropped) |
| P2 | pier7-sunset v-a | same | long wooden fishing pier, lamps, fisher, sunset | 2 | a52238d2 / hf_20260925_223050_a52238d2-3c37-4b3b-bfe5-a4a89411c4a0.png | raw/pc-pier7-sunset-a.png | rejected (bridge in foreground, indoor wall) |
| P3 | exploratorium v-a | same | Pier 15 glass pier shed, kites | 2 | 98949f78 / hf_20260925_223048_98949f78-9bc4-4809-9c52-a5275067e80f.png | raw/pc-exploratorium-a.png | rejected (sparse, gazebo instead of observatory) |
| P4 | filbert-steps | same | wooden stairway through gardens, cottages | 2 | 6f599007 / hf_20260925_223048_6f599007-bc15-4169-8726-0ae1a53e7736.png | raw/pc-filbert-steps-a.png | USED |
| P5 | coit-tower | same | fluted white tower on Telegraph Hill, bay + bridge behind | 2 | df659275 / hf_20260925_223048_df659275-cf2a-4352-8166-1934f9945e0f.png | raw/pc-coit-tower-a.png | USED |
| P6 | bay-bridge-night v-a | same | west span at night, cable lights | 2 | 3598ac02 / hf_20260925_223048_3598ac02-986f-4ef2-8300-2a2e9b872257.png | raw/pc-bay-bridge-night-a.png | USED (model drew a postcard on a mat; inner picture cropped to 4:3) |
| P7 | sea-lions v-a | same | sea lions on K-Dock floats, sailboats | 2 | 6906dff2 / hf_20260925_223048_6906dff2-56cf-4167-95f8-22bfca633521.png | raw/pc-sea-lions-a.png | rejected (blotchy painted backdrop) |
| P8 | streetcar v-a | same | vintage streetcar, palms | 2 | bbba111c / hf_20260925_223048_bbba111c-47ee-4e65-af89-cbfd77e7312b.png | raw/pc-streetcar-a.png | rejected (odd pole, mushy background) |
| P9 | ferry-building-dawn v-b | same, "whole tower in frame" | same | 2 | de9b1b37 / hf_20260925_223757_de9b1b37-7862-4c3e-b21a-cac1b9d74b39.png | raw/pc-ferry-building-dawn-b.png | USED (drawn on a mat; inner picture cropped to 4:3) |
| P10 | pier7-sunset v-b | same, looking out along the pier, open sky | same | 2 | 31a9599f / hf_20260925_223758_31a9599f-70de-4702-81c8-611eb0eac055.png | raw/pc-pier7-sunset-b.png | USED |
| P11 | exploratorium v-b | same, flat-roof glass observatory | same | 2 | 0a459ac2 / hf_20260925_223758_0a459ac2-4f9b-4291-95ac-ac0efe5dc00b.png | raw/pc-exploratorium-b.png | USED |
| P12 | bay-bridge-night v-b | same, "full-bleed, no card" | same | 2 | 7dad2f4e / hf_20260925_223757_7dad2f4e-1294-4353-b4ab-e21d33db19aa.png | raw/pc-bay-bridge-night-b.png | rejected (stage curtain backdrop) |
| P13 | sea-lions v-b | same, clean golden sky | same | 2 | d756b0c4 / hf_20260925_223758_d756b0c4-46f1-4761-9e58-0d5d78bc2433.png | raw/pc-sea-lions-b.png | USED |
| P14 | streetcar v-b | same, 1940s PCC-style car | same | 2 | 5e32c76e / hf_20260925_223757_5e32c76e-f543-4e80-a2cc-bf49cdfe3bd7.png | raw/pc-streetcar-b.png | USED (tiny painted car number removed locally) |
| R1-R5 | portrait cutouts | image_background_remover on A1, B1, B2, B3, A3 (no cost preview offered by the tool) | background removal, then composited on flat #f3ecdf with a soft contact shadow | 5 (1 each) | cb7318b9, 625c83d7, 1681640c, 3f80bad5, d872b7df | raw/cut-*.png | USED |
| V0 | voice audition | seed_audio x2 (Kiki, Pixie presets) + qwen_audio_tts x3 (Pixie, Luna, Hana) | "嗨！欢迎来到湾区～" | 0.23 | seed 51e846aa, 40c4ea38; qwen 9bf32cac, b7b6bed0, 91eb884d | audio/t-*.wav | picked qwen_audio_tts + preset "Pixie" (0178ef57-ada4-43d9-992b-8d9221045bb4): best Mandarin ASR match, median F0 ~270 Hz |
| V1 | 10 barks, up to 3 takes each + retries | qwen_audio_tts, Pixie, wav 48 kHz, language zh/en, instruction "Cute otter mascot: warm, cheerful, bright but not shrill; snappy playful delivery." + per-line mood | 嗨！/ 这边这边！/ 哇～ / 好耶！/ 到啦！/ 嗯…让我想想 / Hi there! / This way! / Yay! / We're here! | 0.36 (42 charged, 6 refunded failures) | picks: zh-hi 8350f63f, zh-this-way fd4c5c89, zh-wow d5b4cb55, zh-yay 81bf3174, zh-arrived 8c8f21d9, zh-think ccc213df, en-hi b531f44d, en-this-way 8365be31, en-yay 02b29bf6, en-arrived 6e399e87 | audio/*.wav, audio/final/*.wav | USED -> public/opus-bay/voice/*.m4a + *.ogg |

Post-processing (local, free): images -> WebP via PIL (key art q80, portraits q85, postcards q82). Voice -> silence-trimmed; zh-think pause shortened plus atempo 1.144 to fit 1.2 s; two-pass loudnorm I=-18 LUFS / TP -1.5 (every clip re-measures -18.0); AAC 64 kbps mono .m4a + Opus 48 kbps mono .ogg.

**Pass total: 62.23 credits** (54.00 Nano Banana Pro + 2.64 outpaint + 5.00 background removal + 0.39 Qwen TTS + 0.20 Seed Audio). Balance at end: 901.98. The 188.23 drop on the shared account includes the creatures agent's 126 credits.

## Integration (manifest + README) — 2026-09-25

No paid generations in this step. `src/opus-bay/data/assets.ts` now lists all 49 files under `public/opus-bay` (4 key art, 5 portraits, 16 postcards, 20 voice, 4 GLB), checked to exist on disk; `public/opus-bay/README.md` records provenance.

**Run total: 188.23 credits** (2D art + voice 62.23 + 3D creatures 126.00). Shared-account balance 1090.21 -> 901.98.

## Rigged 3D characters + resident portraits (assets agent: character-3d) — 2026-09-25

Budget cap: 250 credits. Balance at start: 897.48 (shared account). Raw downloads: `C:/Users/willy/opus-qa/char3d/raw/`.
Identity refs (prior jobs, no upload): A1 `14f39998-26f8-4809-889e-3bc0bb69b561` (BAYBAY master), A3 `ec4b4fb3-3ba9-4e10-a320-0c62807394c9` (newcomer master).

| # | model / settings | prompt summary | credits | job id / output | local raw file | status |
|---|---|---|---|---|---|---|
| H1 | nano_banana_pro 3:4 2k, ref A1 | BAYBAY full body, straight front, A-pose (arms 35° out, gap between legs), flat #f3ecdf, even light | 2 | 036d94a6-db49-4cc0-9085-8bec19d512f6 | char3d/raw/ref-baybay-front.png | ok (not used for 3D; turnaround preferred) |
| H2 | nano_banana_pro 16:9 2k, ref A1 | BAYBAY turnaround sheet front / side / back, same A-pose | 2 | b347dad5-d684-47df-8bb6-a1cd162c158b | char3d/raw/ref-baybay-turn.png | USED: cropped to 3 views (uploads 53b10ba9 / f760b9e8 / c491d7f1) |
| H3 | nano_banana_pro 3:4 2k, ref A3 | newcomer full body front, A-pose, map tucked in backpack side pocket (hands free) | 2 | 3d6e0893-eec3-4a61-81da-4f947fee06ae | char3d/raw/ref-newcomer-front.png | ok (not used for 3D; turnaround preferred) |
| H4 | nano_banana_pro 16:9 2k, ref A3 | newcomer turnaround sheet front / side / back | 2 | 89818a99-8e3e-4d81-8649-be30e0003701 | char3d/raw/ref-newcomer-turn.png | USED: cropped to 3 views, side view mirrored so the map pocket side agrees with front/back (uploads ba882e4a / ece5d85c / 4408b9c0) |
| M5 | Meshy multi_image_to_3d (3 views, textured, triangle, target 8000, pose a-pose, symmetry auto, no rig) | BAYBAY mesh from H2 views | 30 | 803eef70-4239-459b-910c-da554711152b | char3d/raw/baybay-mesh.glb | USED as rig source: 8326 tris, 2048 tex; face/scarf/pin/tail faithful (hf_20260926_045611_803eef70-….glb) |
| M6 | Meshy multi_image_to_3d (same settings) | newcomer mesh from H4 views | 30 | 95f52b36-3543-42ca-ae77-03e4f969e0ac | char3d/raw/newcomer-mesh.glb | rejected: pose_mode a-pose dropped the backpack (flat terracotta patch on the back, strap ring floating round the arm), arms forced horizontal |
| N1 | nano_banana_pro 1:1 1k, style ref A3 | resident portrait: market vendor (straw hat, sage shirt, cream apron, fruit basket) + style contract | 2 | a4c48911-2303-419f-974d-b86082e0fede | char3d/raw/npc-vendor.png | USED -> portraits/npc-vendor.webp |
| N2 | same | resident portrait: fisher (red knit cap, grey beard, olive vest, rod, teal bucket) | 2 | 4e407a93-fe42-4313-a184-b9b8ee37db30 | char3d/raw/npc-fisher.png | USED -> portraits/npc-fisher.webp |
| N3 | same | resident portrait: streetcar operator (navy 1940s uniform, peaked cap, plain gold badge, brass bell) | 2 | 55398ef0-f4ab-42a0-bc6b-fc7dbb8c75fc | char3d/raw/npc-streetcar.png | USED -> portraits/npc-streetcar.webp |
| N4 | same | resident portrait: tourist family (parent with sun hat + camera, child in yellow jacket + orange cap) | 2 | c1042a77-8445-420e-b3e7-633656f24d4b | char3d/raw/npc-family.png | USED -> portraits/npc-family.webp |
| N5 | same | resident portrait: jogger (orange headband, blue tee, navy shorts, jogging pose) | 2 | 0f5543f9-5f14-40a7-8b02-369e74364959 | char3d/raw/npc-jogger.png | rejected (figure stands on a diorama base with water/plants) |
| N6 | nano_banana_pro 1:1 1k, style ref A3 | jogger retake: same + "stands alone on the plain table, no base / props" | 2 | f2e14919-a227-4dd2-8e4b-d806b7797a3e | char3d/raw/npc-jogger-b.png | USED -> portraits/npc-jogger.webp |
| R6-R10 | image_background_remover on N1, N2, N3, N4, N6 | cut-outs, recomposited locally on flat #f3ecdf + soft contact shadow, 512 WebP q85 | 5 (1 each) | b1bea1f5, 7578ed8e, 7e079130, a8ecb68d, 6e153184 | char3d/raw/cut-npc-*.png | USED |
| G1 | Meshy 3d_rigging (height 1.3 m, animation 0 Idle) | rig BAYBAY mesh M5 | 0 (8 refunded) | 18c0230d-e1d4-4a08-b1dd-65b14bca44c4 | - | FAILED (no error detail; 8 refunded, net 0). Per brief, Meshy rigging stopped for BAYBAY; rigged locally in Blender instead (see below) |
| M7 | Meshy multi_image_to_3d (3 views, textured, triangle, target 8000, symmetry auto, NO pose_mode) | newcomer mesh retry from H4 views | 30 | 94f39395-6c2e-4d7f-a964-86b9dab4cab0 | char3d/raw/newcomer-mesh-b.glb | rejected after rig tests: pack straps are thin tattered shells that spike when animated, backpack present but thin shells, black texture specks, map lost (8181 tris) |
| G2 | Meshy 3d_rigging (height 1.5 m, animation 30 Casual_Walk) | rig newcomer mesh M7 | 0 (8 refunded) | 2e574745-be9a-4e59-9eb1-44faa6a76555 | - | FAILED (refunded). Meshy rigging stopped for the newcomer too |
| H5 | nano_banana_pro 16:9 2k, refs H4 + A3 | newcomer turnaround v2 with a simplified chunky backpack (thick straps, map on top) for cleaner 3D | 2 | 1c0ba4c2-e303-494e-949a-cce84bc90efa | char3d/raw/ref-newcomer-turn2a.png | USED: cropped to 3 views (uploads 4f45f226 / 768c2661 / d2cf249b) |
| H6 | same, variant (map sticking up from the pack corner) | newcomer turnaround v2b | 2 | 82f5f3dd-8785-45c0-8991-0de1bf7f142c | char3d/raw/ref-newcomer-turn2b.png | rejected (map in hand in front view but in the pocket in side/back: inconsistent views) |
| M8 | Meshy multi_image_to_3d (3 views from H5, textured, triangle, target 8000, symmetry on) | newcomer mesh v3 (chunky pack) | 30 | 401bfdab-78b2-4382-9347-b1692d36a21c | char3d/raw/newcomer-mesh-c.glb | best newcomer mesh: clean pack, clean face; map reduced to a nub on the pack top (two stray map-end islands deleted locally) |

**Rigging.** Meshy auto-rigging failed on both chibi meshes (G1, G2: no error detail, both refunded), so per the brief that path was
stopped. Both meshes were rigged **locally in Blender 5.2** instead (free): `C:/Users/willy/opus-qa/char3d/build_char.py`.
Bone-heat weights from temporary limb bones, then colour masks (scarf end, hat, pack) and torso guards; every bone is renamed
and re-oriented to match the procedural rigs in `actors/models.ts` (`root, body, head, armL, armR, tail, scarf, footL, footR` /
`root, body, hat, pack, armL, armR, footL, footR`), pointing up with roll 0, so every joint has an identity rest rotation in
three.js space and `actors/anim.ts` can drive the GLB bones directly. Baked clips (ports of the Animator formulas, 30 fps):
`idle` 4.0 s loop, `walk` 0.8 s (one two-step cycle), `run` 0.6 s, `wave` 1.5 s, `jump` 1.0 s (in place). Brand colour pass on
the textures (Meshy baked the bodies beige / peach and the pack grey-green): fur to #fbf7ef, newcomer skin to #f8e2ba, pack to
#2f8f88; pinks, terracotta and dark details untouched. Texture 1024 px JPEG q85 inside the GLB, no Draco, single-sided.

| file | tris | size | bounds | clips | status |
|---|---|---|---|---|---|
| public/opus-bay/models/baybay.glb | 8326 | 599,156 B | 1.3 u tall, feet y=0, front +Z | idle 4.0 / walk 0.8 / run 0.6 / wave 1.5 / jump 1.0 s | SHIPPED (clearly better than the procedural BAYBAY) |
| C:/Users/willy/opus-qa/char3d/out/newcomer.glb | 7380 | 644,120 B | 1.5 u tall, feet y=0, front +Z | same five | NOT shipped: on-brand but not a clear win over the procedural player at gameplay distance |
| public/opus-bay/portraits/npc-{vendor,fisher,streetcar,family,jogger}.webp | - | 8.3-14.7 KB | 512 x 512 on #f3ecdf | - | SHIPPED |

Previews / A-B: `C:/Users/willy/opus-qa/char3d/` (`sheet-*-vs-portrait.png`, `ingame-ab-procedural-vs-glb.png`, `out/pose-*-final.png`, `ab/cmp4-*.png`).

**Pass total: 149.00 credits** (24 Nano Banana Pro + 120 Meshy multi-image-to-3D + 5 background removal + 0 rigging after refunds).
Balance 897.48 -> 748.48 (drop 149.00, matches the tally).

## Whole-SF assets, part 1 (lane H) — 2026-09-26

Cap for this part: 280 credits (floor: stop before the balance drops below 468.48). Balance at start: 748.48 (shared account).
Plan: `C:/Users/willy/opus-qa/reports/sf-research-tech.md` §8 and `sf-research-asset-scout.md` §7-10. Raw downloads and previews: `C:/Users/willy/opus-qa/assets-work/sf/`.
Style ref K6 = `3617006b-483d-4ea7-9e72-39b681f8264f` (key art source). Every image prompt = subject + the style contract at the top of this file (verbatim).
3D concept add-on (verbatim in every concept prompt): "as a chunky handmade clay-and-painted-wood toy model, centered on a plain flat warm cream background (#f3ecdf), three-quarter view from about 25 degrees above …, the whole … in frame with generous margin, soft even studio light, only a faint contact shadow … No base, no plinth, no ground patch …, no text, numbers, signs or logos."

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| S0-1 | Victorian house A concept (Queen Anne, corner turret) | nano_banana_pro 1:1 2k, ref K6 | house A subject + 3D concept add-on + style contract; sage walls #cfe0d0, slate roof, teal-glass windows | 2 | c544a52b-e687-4083-999b-11f9acffb872 | sf/raw/house-a-1.png | not used (wide detached villa, not a row house) |
| S0-2 | house A concept, variant 2 | same | same | 2 | a5270ca9-a918-4404-b2ca-6d7df3722789 | sf/raw/house-a-2.png | USED: bake-off input + house A |
| S0-3 | Victorian house B concept (Italianate, false-front cornice, angled bay) | same | house B subject + add-on + contract | 2 | cad51afe-56a0-47f7-ad6d-5e6d8d0b71cd | sf/raw/house-b-1.png | USED: house B |
| S0-4 | house B concept, variant 2 | same | same | 2 | cf60975d-af68-4a20-8a43-88916db843aa | sf/raw/house-b-2.png | not used (stoop on the side, flat front) |
| S1-1 | bake-off: SAM 3 3D on S0-2 | sam_3_3d, textured, prompt "the toy Victorian house" | 20,362 tris raw, 1024 PNG texture | 1 | 4637c808-77f7-40dc-9320-8d14501c1c02 | sf/bake/raw-sam.glb | WINNER (IoU 0.94, 0 % non-manifold, 1 island, palette 0.85 after grade, crisp modelled trim, clean back) |
| S1-2 | bake-off: Tripo H3.1 on S0-2 | tripo_h3_1_image_to_3d {face_limit 6000, texture, pbr false, texture detailed, geometry standard, align_image} | 5,416 tris, 4096 JPEG | 12 | 23c4ec34-710d-4136-b8b9-453f2582a7d7 | sf/bake/raw-tripo.glb | fail: olive smear over the unseen back wall; palette 0.54 after grade |
| S1-3 | bake-off: Hunyuan3D v3 LowPoly on S0-2 | hunyuan3d_v3_image_to_3d {LowPoly, triangle} | 10,837 tris, 4096 PNG (16.7 MB GLB), lies on its back (pitch +90 needed) | 14 | 100d3c4d-7b97-4da0-bea8-685ffa7d6fda | sf/bake/raw-hunyuan.glb | fail: muddy brown/olive texture, no glass; palette 0.26 after grade |
| S1-4 | bake-off: Meshy on S0-2 | image_to_3d {textured, remesh, triangle, target 6000, symmetry off} | 5,874 tris, 2048 JPEG | 30 | 2abbc123-f705-47ce-b60d-bfff946e8a5e | sf/bake/raw-meshy.glb | pass (IoU 0.956, 0.43 % non-manifold, palette 0.95) but softer trim and 30x the price: fallback only |
| L1-3D | house B mesh | sam_3_3d, textured | from S0-3 | 1 | 00ed9bb2-f7a3-42e9-81fc-01c95f1db55a | sf/raw/house-b-sam.glb | see below |
| L2-C1 | Palace of Fine Arts rotunda concept | nano_banana_pro 1:1 2k, ref K6 | octagonal drum on 8 arched piers, salmon dome, peach-sand stone, open arches + add-on + contract | 2 | fba12f36-5e33-435f-9944-be12f183acf9 | sf/raw/rotunda-1.png | USED |
| L2-C2 | rotunda concept, variant 2 | same | same | 2 | 7c48aa2e-c203-4ca3-bf04-2170b34ec8a0 | sf/raw/rotunda-2.png | rejected before 3D (teal floor disc = a base) |
| L3-C1 | Dragon Gate concept (walk-through, blank plaque, 2 lions) | same | three jade roofs, wide central opening + 2 side openings, terracotta beams | 2 | 8a1bf0a0-ad53-46f0-9fe0-e243712db2e5 | sf/raw/gate-1.png | USED |
| L3-C2 | Dragon Gate concept, variant 2 | same | same | 2 | 9ad2d3d2-3ed1-45a2-84a6-c24205228bfa | sf/raw/gate-2.png | runner-up (its SAM mesh had a green blotch on a wall) |
| L4-C1 | Conservatory of Flowers concept | same | white greenhouse, onion dome + cupola, two glass wings, end pavilions, teal glass | 2 | 4479ee05-dc53-4504-9b62-8b1a657ca4d6 | sf/raw/cons-1.png | runner-up (SAM IoU 0.849) |
| L4-C2 | Conservatory concept, variant 2 | same | same | 2 | 15526d93-8831-4ba0-ab26-3c1760128b34 | sf/raw/cons-2.png | USED |
| V1-1 | cable car reference sheet (front / side / back / top) | nano_banana_pro 16:9 2k, ref K6 | cream + maroon toy cable car, open end benches, no number | 2 | a56bf097-f642-41d8-9e43-bbde9bb6b6ff | sf/vehicles/ref-cable-car.webp | USED as reference (front/back ends differ slightly; the side view is the master) |
| V1-2 | kiddie toy car reference sheet | same | 1.8:1 open-top toy car, neutral grey | 2 | fe1ecb2a-2c68-4f84-9f06-caa6116f309c | sf/vehicles/ref-toy-car.webp | USED as reference (the front view wrongly shows a hard top) |
| V1-3 | toy bicycle reference sheet | same | teal step-through, solid-disc wheels, wicker basket | 2 | 9a54bb0f-85ec-4d1b-90ab-766eb8b6ba9e | sf/vehicles/ref-bike.webp | USED as reference |
| L2-3D | rotunda mesh | sam_3_3d textured, prompt "the toy domed rotunda" | from L2-C1; 26,518 tris raw | 1 | f6e59516-acf1-4f1f-9473-adeff5131954 | sf/raw/rotunda-1-sam.glb | USED |
| L3-3D-a | gate mesh from L3-C2 | sam_3_3d | lions dropped by SAM | 1 | b4a924f8-9be9-4f40-ad3d-339023e0e4c1 | sf/raw/gate-2-sam.glb | not used |
| L3-3D-b | gate mesh from L3-C1 | sam_3_3d | lions dropped by SAM; 11,770 tris raw | 1 | cce0f6d2-1077-47b5-9ac3-21f801ae7b9d | sf/raw/gate-1-sam.glb | USED |
| L4-3D-a | conservatory mesh from L4-C1 | sam_3_3d | 12,018 tris raw | 1 | a09af4ce-1367-4f5b-9a14-cdba32d8dd14 | sf/raw/cons-1-sam.glb | not used |
| L4-3D-b | conservatory mesh from L4-C2 | sam_3_3d | 10,713 tris raw | 1 | ff3d372d-d84b-4eff-9df1-1c394c31756e | sf/raw/cons-2-sam.glb | USED |
| T1-0 | 12 postcards, first submission | nano_banana_pro 4:3 2k | refs P5 + a mistyped P13 id (`d756b0c4-56f1-…` as printed in sf-research-asset-scout.md; the real job is `d756b0c4-46f1-…`) | 0 | none (all 12 rejected at submission: "Media input not found") | - | resubmitted below |
| T1-1 | postcard sf-golden-gate-fog | nano_banana_pro 4:3 2k, refs P5 `df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433` | subject + "Full-bleed illustration … NOT a card, NOT on a mat …" + contract | 2 | 088b3b51-3b94-461d-b355-f84c7ea22db2 | sf/postcards/sf-golden-gate-fog-a.png | USED |
| T1-2 | postcard sf-painted-ladies | same | seven pastel Victorians, park lawn, skyline | 2 | ac585120-af50-4d33-89b3-e2d7cc4a4b11 | sf/postcards/sf-painted-ladies-a.png | USED |
| T1-3 | postcard sf-palace-fine-arts | same | rotunda + colonnade reflected in the lagoon, swans | 2 | 802dab3f-3440-41b7-bfa1-9644ffeae7fc | sf/postcards/sf-palace-fine-arts-a.png | USED |
| T1-4 | postcard sf-cable-car-hill | same | cable car climbing a steep street, bay below, no number | 2 | 200925ed-221e-49ae-9367-73da92ec1dc3 | sf/postcards/sf-cable-car-hill-a.png | USED (front panel checked at full size: decoration only, no lettering) |
| T1-5 | postcard sf-chinatown-lanterns | same | Grant Ave lanterns, blank signs | 2 | 3859674a-dd81-41be-a839-5ebb539ddaec | sf/postcards/sf-chinatown-lanterns-a.png | USED (signs blank) |
| T1-6 | postcard sf-lombard-street | same | crooked block, flower hedges, Coit on a hill | 2 | 09f542b2-1e7c-49d9-be2c-6c0c1bade10f | sf/postcards/sf-lombard-street-a.png | USED |
| T1-7 | postcard sf-mission-murals | same | alley of original murals (marigolds, hummingbirds, sun rays), papel picado | 2 | 97bc58b3-a6ca-404f-ae37-bf22ea337151 | sf/postcards/sf-mission-murals-a.png | USED |
| T1-8 | postcard sf-dolores-park v-a | same | lawn, palms, mission church, skyline | 2 | b0dfce60-3410-469b-92c6-fc6758185868 | sf/postcards/sf-dolores-park-a.png | rejected (floating slab on cream, not full-bleed; ghost duplicate skyline) |
| T1-9 | postcard sf-windmill | same | Dutch windmill, tulip beds, cypress, ocean | 2 | 9d43dc40-8f1a-493e-a96b-a78e69d1cab4 | sf/postcards/sf-windmill-a.png | USED |
| T1-10 | postcard sf-city-hall | same | Beaux-Arts dome with soft gold trim, civic plaza | 2 | d42ad9b2-a0fb-406e-8cae-b911371568bc | sf/postcards/sf-city-hall-a.png | USED |
| T1-11 | postcard sf-twin-peaks-view | same | two peaks, the city as a model, bay + bridge | 2 | f090c4be-70c4-4f42-b8eb-1218bcee427b | sf/postcards/sf-twin-peaks-view-a.png | USED |
| T1-12 | postcard sf-ocean-beach | same | sunset beach, dunes, walker with a dog | 2 | f8c69af1-a436-4718-a1ea-1f40914c53b0 | sf/postcards/sf-ocean-beach-a.png | USED |
| T1-13 | postcard sf-dolores-park v-b | same + "seen from inside the park … fills the whole frame … no floating slab, no cream void, no duplicate skyline" | same | 2 | 5fc2028c-0878-4a39-8ca9-e537f23134eb | sf/postcards/sf-dolores-park-b.png | USED |
| T3-1 | neighbourhood badge sheet 1 (3x3) | nano_banana_pro 1:1 2k, ref K6 | round clay badges: cable car, Dragon Gate, Victorian, windmill, GGB tower, mural sun, rainbow flag, Coit, Twin Peaks | 2 | c9c7eca0-06dd-4b61-9761-7e7182529765 | sf/badges/sheet-1.png | USED -> 9 badges |
| T3-2 | neighbourhood badge sheet 2 (3x3) | same | Ferry Building, sea lion, rotunda, pyramid tower, City Hall dome, pagoda, Lombard, wave + sun, baseball + glove | 2 | 4da19af5-9387-4482-96a0-7a0981fac0e2 | sf/badges/sheet-2.png | USED -> 9 badges |
| T7-1 | resident portrait: cable car gripman | nano_banana_pro 1:1 1k, style ref A3 `ec4b4fb3-3ba9-4e10-a320-0c62807394c9` | flat cap, burgundy vest, leather gloves, waving | 2 | 7623d8be-7f09-489b-a765-cae58ceb312a | sf/portraits/gripman.png | USED |
| T7-2 | resident portrait: sourdough baker | same | baker's cap, floury apron, round loaf | 2 | 9f9e1743-014b-463c-bacd-67e53378183e | sf/portraits/baker.png | USED |
| T7-3 | resident portrait: muralist | same | bandana, paint-dotted overalls, brush + pot | 2 | 204a2a4d-9662-4a90-bed2-8542f3323039 | sf/portraits/muralist.png | USED |
| T7-4 | resident portrait: Golden Gate Park gardener | same | straw hat, sage apron, tulip pot + trowel | 2 | a481f71c-c349-43f8-b322-54a994a38540 | sf/portraits/gardener.png | USED |
| T7-5 | resident portrait: Presidio ranger | same | flat-brim hat, olive uniform, plain badge, binoculars | 2 | 77145a7f-53ec-48c8-abc8-aaf56d01dfc8 | sf/portraits/ranger.png | USED |
| T7-6 | resident portrait: record-store owner | same | round glasses, teal cardigan, blank-label record | 2 | a8c883ab-ca68-4364-8920-e3db6b266684 | sf/portraits/record-store.png | USED |
| T6-1 | facade tile A/B: Victorian clapboard | gpt_image_2_5 medium 1k 1:1 | seamless 2-storey x 2-bay elevation, sage clapboard, cream trim | 0.5 | 3dba7b4a-4fd1-4c2e-b3ad-ff7359883528 | sf/facade/victorian.png | A/B only (decision: lead) |
| T6-2 | facade tile A/B: SoMa brick warehouse | same | terracotta brick, arched windows | 0.5 | 602d0ed6-1f81-4fd1-b34a-704921ae4290 | sf/facade/soma-brick.png | A/B only |
| T6-3 | facade tile A/B: Sunset stucco | same | sand stucco, rounded square windows, tile band | 0.5 | 6a349205-65f3-41e2-9f0e-030029be9e71 | sf/facade/sunset-stucco.png | A/B only |
| T6-4 | facade tile A/B: Chinatown | same | cream walls, jade tile awnings, red balconies | 0.5 | 3c0c6514-4975-437a-9e69-ad4832005986 | sf/facade/chinatown.png | A/B only |

**Bake-off (S1) result.** All four meshes were cleaned with the same script and grade and checked against the §8 gate: silhouette IoU against the concept in the concept's own view (found by an azimuth/elevation sweep), non-manifold edges and islands after the weld, the share of texels within ΔE 12 of the DESIGN palette after the grade, and an in-game 64 px thumbnail. SAM 3 3D (1 credit) passed every check and gave the crispest trim and the cleanest unseen back. Meshy (30) also passed. Tripo H3.1 (12) and Hunyuan3D LowPoly (14) failed on texture (a dirty back wall; a muddy palette). **Winner: SAM 3 3D**, with Meshy as the fallback. Every later mesh used SAM and every SAM mesh passed, so no fallback or retake was needed.

**Post-processing (local, free).** `C:/Users/willy/opus-qa/assets-work/sf/arch_cleanup.py` (Blender 5.2 headless): join; weld at 5e-4 x the bbox diagonal; drop islands under 0.3 % of faces; flatten the base (bisect at 1 % of the height, then cap); planar dissolve at 3° (delimit UV/seam/sharp); collapse to the tri cap; scale; origin at ground centre; front -> +Z; metallic 0 / roughness 0.9; normal/PBR links dropped. The base colour is resized and graded by `grade.py` (per-asset hue remaps to brand hex with feathered selections, saturation clamp, shadow lift, cream white-lift, 8 px gutter fill, texel coverage from the UVs), which also writes the mask WebP (R = glass stencil after GTA_SZ, G = tint region). Export: GLB with Draco (level 6, pos 14 / nrm 10 / uv 12) and a WebP q82 texture; plain-GLB twins are kept in scratch. Previews (front, both 3/4 sides, side, back, top) and the silhouette sweep are in `assets-work/sf/<asset>/`. Draco decoding was verified in the running game with three 0.186's DRACOLoader reading the decoder from `/opus-bay/models/sf/draco/`.
Postcards: centre-crop to 4:3, then 1200 + 600 WebP q82 (`export_postcards.py`). Portraits: local rembg (u2net, cached model; replaces the 1-credit remover), recomposited on #f3ecdf with a soft contact shadow, 512 WebP q85. Badges: rembg disc detection (the 3x3 grid is rebuilt when a pale disc is missed), circle cut, 256 px WebP q88 with alpha (`export_portraits_badges.py`).

| file | tris | bytes | size w x h x d (u) | IoU | non-manifold / islands | palette ΔE12 (before -> after) | status |
|---|---|---|---|---|---|---|---|
| models/sf/victorian-a.glb (+ -mask.webp 12,782 B) | 2,940 | 67,900 | 4.23 x 5.60 x 3.94 | 0.94 | 0 % / 1 | 0.56 -> 0.85 | SHIPPED |
| models/sf/victorian-b.glb (+ -mask.webp 9,064 B) | 2,940 | 50,060 | 3.81 x 5.00 x 4.19 | 0.91 | 0 % / 1 | 0.59 -> 0.93 | SHIPPED |
| models/sf/palace-rotunda.glb | 5,874 | 121,208 | 12.66 x 10.80 x 12.67 | 0.88 | 0.03 % / 14 (the planter blocks and cornice parts are separate solids, not torn shells) | 0.61 -> 0.91 | SHIPPED |
| models/sf/dragon-gate.glb | 5,880 | 124,200 | 9.60 x 5.85 x 2.45 | 0.79 unwidened, 0.76 after the deliberate 1.2x widening (the concept's lions are missing from the mesh) | 0 % / 1 | 0.22 -> 0.86 | SHIPPED with an IoU waiver |
| models/sf/conservatory.glb (+ -mask.webp 22,854 B) | 5,879 | 125,224 | 11.77 x 6.00 x 6.13 | 0.86 | 0.03 % / 1 | 0.85 -> 0.87 | SHIPPED |
| models/sf/draco/draco_decoder.wasm + draco_wasm_wrapper.js | - | 192,420 + 58,456 | - | - | - | - | copied unchanged from three 0.186 `examples/jsm/libs/draco/gltf/` |
| postcards/sf-*-1200.webp + -600.webp (12 ids) | - | 45-96 KB / 20-39 KB | 1200x900 / 600x450 | - | - | - | SHIPPED |
| portraits/sf-npc-{gripman,baker,muralist,gardener,ranger,record-store}.webp | - | 9.6-15.0 KB | 512x512 | - | - | - | SHIPPED |
| badges/*.webp (18 neighbourhoods) | - | 9.8-17.0 KB | 256x256 RGBA | - | - | - | SHIPPED |

**Part 1 total: 133.00 credits** (68.00 Nano Banana Pro for 34 images, 7.00 SAM 3 3D, 12 Tripo, 14 Hunyuan, 30 Meshy, 2.00 GPT Image 2.5 medium). Confirmed with `transactions`: every row from 10:46 to 11:20 UTC on 2026-09-26 belongs to this lane, there are no refunds, and the failed first postcard submission charged nothing. Balance 748.48 -> 615.48, leaving 147 of the 280 part-1 cap unspent.

## Whole-SF assets, part 2a (lane H2a: house kit + landmark meshes) — 2026-09-26

Cap for this part: 120 credits (floor: stop before the balance drops below 495.48). Balance at start: 615.48 (shared account).
Same pipeline and style contract as part 1. Concept prompts: `C:/Users/willy/opus-qa/assets-work/sf/kit/prompts.json` (variant a = refs K6 `3617006b-…` + house B concept `cad51afe-…`, prefixed "Match the handmade clay toy look … but make a completely different building exactly as described."; variant b = ref K6 only). Every concept = subject + the part-1 3D concept add-on + the style contract, plus a depth line ("narrow and deep like a real San Francisco row house: its right side wall is about one and a half times as long as the front is wide"). Raw files: `assets-work/sf/kit/raw/`.
The first run of this lane was stopped midway (owner shutdown ~09:55 PDT). Rows K1-K11 and K-x were reconciled on resume against `transactions` + `show_generations` (every charge from 16:20:01 to 16:43:30 UTC belongs to it); nothing was regenerated.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| K1-a | edwardian-flats concept a | nano_banana_pro 1:1 2k, refs K6 + HB | 3-storey flats, full-height angled bay column, recessed columned porch + stoop, heavy bracketed cornice; powder blue #c9d6e8 siding | 2 | c2683f70-fd5a-45d5-9425-1f3f7e1de519 | kit/raw/edwardian-flats-a.png | not used (runner-up) |
| K1-b | edwardian-flats concept b | nano_banana_pro 1:1 2k, ref K6 | same | 2 | 66f1890b-4b60-4c84-9520-8c1b203d2250 | kit/raw/edwardian-flats-b.png | USED |
| K2-a | stick-victorian concept a | same as K1-a | Stick-Eastlake, square bay, false-front cornice, gabled hood over the door; lilac #d9c8e6 | 2 | 4873d4a1-50dc-415e-9c0b-e0560d5fd767 | kit/raw/stick-victorian-a.png | USED |
| K2-b | stick-victorian concept b | same as K1-b | same | 2 | 1c3c7df0-7ef2-4116-9709-4442641868a9 | kit/raw/stick-victorian-b.png | not used |
| K3-a | queen-anne-corner concept a | same as K1-a | corner-lot Queen Anne, round turret with a cone roof, shingled gable, bays; dusty rose #e8c6cf | 2 | 8669b628-4923-4f70-8a54-364540233e85 | kit/raw/queen-anne-corner-a.png | USED |
| K3-b | queen-anne-corner concept b | same as K1-b | same | 2 | aa5e6fd0-f52d-462b-948a-4f9f1e8e72b0 | kit/raw/queen-anne-corner-b.png | not used |
| K4-a | sunset-doelger concept a | same as K1-a | 2-storey stucco over a garage, stepped parapet, tile hood over the picture window, arched door + side stair; mint #cfe0d0 | 2 | de5a4333-d251-42b1-a9a2-09479c73bdc7 | kit/raw/sunset-doelger-a.png | USED |
| K4-b | sunset-doelger concept b | same as K1-b | same | 2 | 3ec31a94-6450-4f67-97c0-3ec2482bbbfb | kit/raw/sunset-doelger-b.png | not used |
| K5-a | marina-mediterranean concept a | same as K1-a | stucco, terracotta tile roof edge, big arched window + balconette, arched garage; peach #f2c9b1 | 2 | 65e112cf-8b74-41e8-a256-266934b0f51c | kit/raw/marina-mediterranean-a.png | USED |
| K5-b | marina-mediterranean concept b | same as K1-b | same | 2 | 62b0f804-95ce-4607-8f00-bd8e27862d3b | kit/raw/marina-mediterranean-b.png | not used |
| K6-a | richmond-flats concept a | same as K1-a | 3 stacked flats with a bay column, arched double-door entry; butter #f4e2a8 | 2 | dd564204-c784-4875-892b-7f39437b40ec | kit/raw/richmond-flats-a.png | not used |
| K6-b | richmond-flats concept b | same as K1-b | same | 2 | 41016bd4-b3e1-41d7-96fd-4b9d3101ba72 | kit/raw/richmond-flats-b.png | USED |
| K7-a | chinatown-shophouse concept a | same as K1-a | 3-storey, recessed balconies with red rails, jade pagoda eaves + cornice, shop windows, NO signs; cream walls | 2 | 001511da-ad53-42ff-abc5-204a916232f3 | kit/raw/chinatown-shophouse-a.png | not used |
| K7-b | chinatown-shophouse concept b | same as K1-b | same | 2 | 7ddae6cd-0baf-4d61-a1ef-5e008a2323b2 | kit/raw/chinatown-shophouse-b.png | USED |
| K8-a | northbeach-corner concept a | same as K1-a | 3-storey mixed-use corner, café at street level, striped awning wrapping the corner, bays above; ochre #f0d49a | 2 | e3a46866-0fb3-4ffb-ba96-e26af671272b | kit/raw/northbeach-corner-a.png | 3D tried (K10-8), not used |
| K8-b | northbeach-corner concept b | same as K1-b | same | 2 | 383ad092-2d8d-4957-ab71-0a50066ff311 | kit/raw/northbeach-corner-b.png | USED (via K11) |
| K9-a | soma-warehouse concept a | same as K1-a | 3-storey brick loft, rows of round-arched windows with cream keystones, arched loading door, parapet; brick #b56e55 | 2 | 6fc42e9a-9150-484c-a08e-7397690d180c | kit/raw/soma-warehouse-a.png | USED |
| K9-b | soma-warehouse concept b | same as K1-b | same | 2 | f63f7c92-6b9b-4f8c-b08b-de4df2ca0d08 | kit/raw/soma-warehouse-b.png | not used |
| K10m-a | mission-mural concept a | same as K1-a | 2-storey corner shop, teal striped awning, ORIGINAL mural on the long side wall (sun rays, marigolds, hummingbirds, hills; no text, no faces); marigold front #f0b15a | 2 | 38815029-367e-4657-afb6-fe3ee78536ba | kit/raw/mission-mural-a.png | not used |
| K10m-b | mission-mural concept b | same as K1-b | same | 2 | 6bedda66-4c58-4a1c-8939-3d5e30259ba0 | kit/raw/mission-mural-b.png | USED |
| K12d-a | deco-apartment concept a | same as K1-a | 5-storey 1930s art deco, central window band between fluted piers, rounded corner windows, stepped zigzag crown, rounded canopy; cream stucco with sage + terracotta relief | 2 | 8f98898f-09b0-4dbe-aa0f-325edecf1a9d | kit/raw/deco-apartment-a.png | not used |
| K12d-b | deco-apartment concept b | same as K1-b | same | 2 | cf6d1b85-2e24-4627-85a4-3a0c1bc5787c | kit/raw/deco-apartment-b.png | USED |
| K10-1 | edwardian-flats mesh | sam_3_3d textured, prompt "the toy house" | from K1-b | 1 | 03164ea5-a6bb-4f78-b797-45e485134bc6 | kit/raw/edwardian-flats-sam.glb | USED |
| K10-2 | stick-victorian mesh | same | from K2-a | 1 | 574a89b6-7b26-46c9-a5bb-ccbd7cf74790 | kit/raw/stick-victorian-sam.glb | USED |
| K10-3 | queen-anne-corner mesh | same | from K3-a | 1 | 93235404-4e71-4ec6-b3ad-0ae1cab4cf22 | kit/raw/queen-anne-corner-sam.glb | USED |
| K10-4 | sunset-doelger mesh | same | from K4-a | 1 | 38207d03-00c7-4b16-9dfa-e82d0223e76a | kit/raw/sunset-doelger-sam.glb | USED |
| K10-5 | marina-mediterranean mesh | same | from K5-a | 1 | 36459158-1867-4030-9ad2-75d1c5873431 | kit/raw/marina-mediterranean-sam.glb | USED |
| K10-6 | richmond-flats mesh | same | from K6-b | 1 | 79ee70d7-53cd-4e7d-8831-dda4c4a5c812 | kit/raw/richmond-flats-sam.glb | USED |
| K10-7 | chinatown-shophouse mesh | same | from K7-b | 1 | 14aee3fc-5bd6-443d-aad8-97ccd84dc2ce | kit/raw/chinatown-shophouse-sam.glb | USED |
| K10-8 | northbeach-corner mesh, try 1 | same | from K8-a | 1 | 5a77a24d-deb7-4bc1-92b0-d1a5f481efc2 | kit/raw/northbeach-corner-sam.glb | not used (probe: the corner and awning read worse than K11) |
| K10-9 | soma-warehouse mesh | same | from K9-a | 1 | b4ebdebd-4609-4463-9efb-ae1c3e278357 | kit/raw/soma-warehouse-sam.glb | USED |
| K10-10 | mission-mural mesh | same | from K10m-b | 1 | 697f8175-a596-47dc-9691-c011f7bb9898 | kit/raw/mission-mural-sam.glb | USED |
| K10-11 | deco-apartment mesh | same | from K12d-b | 1 | 068ac3d1-1b5c-44fd-8b58-b6d50727e0c1 | kit/raw/deco-apartment-sam.glb | USED |
| K11 | northbeach-corner mesh, try 2 | same | from K8-b | 1 | 83e2bdba-0434-4854-864a-46465eaffa45 | kit/raw/northbeach-corner-b-sam.glb | USED |
| K-x | one Nano Banana Pro image submitted at 16:35:29 UTC by the stopped run | nano_banana_pro | unknown (no local file; not in the completed-generations history) | 2, refunded +2 at 16:43:30 = 0 | not recorded (failed job) | - | failed, fully refunded |

Reconciled subtotal of the stopped run: 22 × Nano Banana Pro (−44) + 12 × "3D Objects" (−12) + 1 × Nano Banana Pro spend and refund (0) = **56.00 credits**. Balance 615.48 → 559.48 (checked with `balance` on resume). Remaining cap: 64 (floor 495.48).

### Part 2a, resumed run (landmark meshes) — reconciled in the cloud session, 2026-09-26

The resumed run (22:03–22:14 UTC) made two concepts each for eight landmarks and one SAM 3 3D mesh each, then was stopped at 15:18 PDT before it wrote these rows. Reconciled from `transactions` (every charge from 22:03:07 to 22:13:57 UTC belongs to it) and `show_generations` (prompts, inputs and parent images). Nothing was regenerated. The generation history labels the image model `nano_banana_2`; `transactions` bills it as "Nano Banana Pro" at 2 credits. Variant a = refs K6 `3617006b-…` + rotunda concept L2-C1 `fba12f36-…`, with the "Match the handmade clay toy look … but make a completely different building exactly as described." prefix; variant b = ref K6 only. Every prompt = subject + the part-1 3D concept add-on + the style contract (no base, no text, no people, no thin wires). All eight meshes were made from variant b.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| LM1-a | Legion of Honor concept a | nano_banana_pro 1:1 2k, refs K6 + L2-C1 | white neoclassical courtyard complex: arch gateway screen wall, two colonnade wings, portico + low sage-grey dome; open courtyard | 2 | 0b86ff3b-0a8e-4d1d-a741-ad323f857f4b | - | not meshed |
| LM1-b | Legion of Honor concept b | nano_banana_pro 1:1 2k, ref K6 | same | 2 | e61b7e8b-9e7d-4f66-b2d5-1337778a760c | - | meshed (LM1-3D) |
| LM2-a | Ghirardelli clock tower concept a | same as LM1-a | narrow 3-storey red-brick building, square clock tower with blank faces, slate pyramid spire + corner turrets, no sign | 2 | e0ddbc20-c31a-4ee8-b518-ccda94bc7f1a | - | not meshed |
| LM2-b | Ghirardelli clock tower concept b | same as LM1-b | same | 2 | 9d6be2ba-56d4-4371-906d-a0685d6d8b26 | - | meshed (LM2-3D) |
| LM3-a | Fort Point concept a | same as LM1-a | squat red-brick fort, three tiers of arched gun openings, granite foot, roof terrace + courtyard, tiny corner lighthouse | 2 | 5646affa-71cc-4781-84f3-451622fccb21 | - | not meshed |
| LM3-b | Fort Point concept b | same as LM1-b | same | 2 | b4385c0f-9f4b-4d3b-a9bd-e3bf50b0c9f9 | - | meshed (LM3-3D) |
| LM4-a | Mission Dolores concept a | same as LM1-a | 1791 adobe chapel (tile gable, 4 engaged columns, 3 bells) joined to the cream baroque basilica with two domed towers | 2 | 4b2b3351-0dd9-44ae-a00f-1c9c30b3bb93 | - | not meshed |
| LM4-b | Mission Dolores concept b | same as LM1-b | same | 2 | 2f313b8b-e559-431e-9d5c-61ecd1a24f5d | - | meshed (LM4-3D) |
| LM5-a | Castro Theatre concept a | same as LM1-a | Spanish-colonial movie palace, blank red blade sign edged with bulbs, V marquee, sand auditorium block behind | 2 | 0b1a67fa-18eb-4567-8e8b-36572d7c049b | - | not meshed |
| LM5-b | Castro Theatre concept b | same as LM1-b | same | 2 | 111f2c21-fd30-4d87-8ca4-79bab52230be | - | meshed (LM5-3D) |
| LM6-a | Dutch windmill body concept a (no sails) | same as LM1-a | cream octagonal tapering tower on a brick foot, reefing balcony ring, brown boat cap with a stub hub; sails stay procedural | 2 | 305e6471-6251-4d32-acb5-21d8d7ca12d1 | - | not meshed |
| LM6-b | Dutch windmill body concept b (no sails) | same as LM1-b | same | 2 | ea0ce3bb-83e7-4c19-8a13-d857ab3ad061 | - | meshed (LM6-3D) |
| LM7-a | Grace Cathedral concept a | same as LM1-a | pale stone French-Gothic front, twin square towers, rose window, buttressed nave, sage copper roof, crossing spire | 2 | 59ffe68a-b5a0-41a5-a5d1-8fdd7621837c | - | not meshed |
| LM7-b | Grace Cathedral concept b | same as LM1-b | same | 2 | 51457b31-4feb-49ea-82a1-1d036b4a1eeb | - | meshed (LM7-3D) |
| LM8-a | City Hall concept a | same as LM1-a | white Beaux-Arts palace, colonnaded portico, corner pavilions, columned drum + sage dome with gold trim and lantern | 2 | 56fcad39-a25e-423b-b38e-ac4ae1b58191 | - | not meshed |
| LM8-b | City Hall concept b | same as LM1-b | same | 2 | a842af50-b06f-412c-b8c8-5bdc6d75bc37 | - | meshed (LM8-3D) |
| LM4-3D | Mission Dolores mesh | sam_3_3d textured, prompt "the toy mission church group" | from LM4-b | 1 | 1b2b296e-5b33-43bc-967c-dadfe94a14ab | - | raw only |
| LM3-3D | Fort Point mesh | sam_3_3d, "the toy brick fort" | from LM3-b | 1 | 33906fb6-5410-42d3-8529-5e8bd181f6a1 | - | raw only |
| LM6-3D | windmill body mesh | sam_3_3d, "the toy windmill tower" | from LM6-b | 1 | 2c4615b0-8d00-42cc-aa3e-b3bbe010e3c2 | - | raw only |
| LM5-3D | Castro Theatre mesh | sam_3_3d, "the toy theatre building" | from LM5-b | 1 | f924e7e0-e8f0-4626-a787-9b1619d5e1dc | - | raw only |
| LM2-3D | Ghirardelli clock tower mesh | sam_3_3d, "the toy clock tower building" | from LM2-b | 1 | eff7a796-6189-4920-ba4f-a152fc28fb60 | - | raw only |
| LM7-3D | Grace Cathedral mesh | sam_3_3d, "the toy cathedral" | from LM7-b | 1 | e70a3dfe-cd66-4a9b-be55-49fec8396d55 | - | raw only |
| LM8-3D | City Hall mesh | sam_3_3d, "the toy domed city hall" | from LM8-b | 1 | 06674d67-43e6-466c-bb1e-c9155b44c064 | - | raw only |
| LM1-3D-x | Legion of Honor mesh, first submission | sam_3_3d | from LM1-b; charged 22:09:07, refunded +1 at 22:09:37 | 0 | not recorded (failed job) | - | failed, fully refunded |
| LM1-3D | Legion of Honor mesh, retry | sam_3_3d, "the white toy building" | from LM1-b; 22:13:56 | 1 | 38ca4559-cc62-4974-8e1a-066ce7035611 | - | raw only |

Reconciled subtotal of the resumed run: 16 × Nano Banana Pro (−32) + 9 × "3D Objects" spends (−9) + 1 refund (+1) = **40.00 credits**. Balance 559.48 → **519.48** (checked with `balance` in the cloud session). **Part 2a total: 56 + 40 = 96 of its 120 cap.**

"Raw only" means: the GLB exists on Higgsfield (the result URL is in `show_generations`), but it has not been cleaned, graded, Draco-compressed or published. Whether the stopped run downloaded any of them to `C:/Users/willy/opus-qa/assets-work/sf/kit/raw/` is not known. The cloud session cannot fetch the CDN (the proxy returns 403) and has no Blender, so download, cleanup (`kit_cleanup.py`, `grade_kit.py` in `docs/opus-bay/kit-jobs/`) and the §8 QA gate wait for a local run. Until then these eight landmarks stay procedural.

**Published by part 2a (house kit, cleaned before the stop).** 11 Draco GLBs with a WebP texture plus a tint/glass mask, in `public/opus-bay/models/sf/kit/`. Numbers measured from the GLB headers in the cloud session; the IoU and palette columns were not recorded before the stop.

| file | tris | bytes | size w x h x d (u) | mask bytes | status |
|---|---|---|---|---|---|
| kit/edwardian-flats.glb | 2,890 | 44,448 | 4.4 x 5.2 x 8.0 | 4,344 | published, not yet registered in `data/assets.ts` |
| kit/stick-victorian.glb | 2,889 | 42,904 | 4.4 x 5.4 x 8.0 | 8,366 | same |
| kit/queen-anne-corner.glb | 2,891 | 68,232 | 5.2 x 6.4 x 7.0 | 15,810 | same |
| kit/sunset-doelger.glb | 2,890 | 37,956 | 4.4 x 4.0 x 8.0 | 5,438 | same |
| kit/marina-mediterranean.glb | 2,890 | 42,464 | 4.4 x 4.2 x 8.0 | 6,544 | same |
| kit/richmond-flats.glb | 2,891 | 68,972 | 4.4 x 5.4 x 8.0 | 14,596 | same |
| kit/chinatown-shophouse.glb | 2,890 | 55,044 | 4.4 x 5.4 x 8.0 | 13,018 | same |
| kit/northbeach-corner.glb | 2,890 | 65,912 | 4.4 x 5.2 x 5.9 | 13,300 | same |
| kit/soma-warehouse.glb | 2,887 | 65,732 | 6.6 x 5.6 x 8.0 | 12,284 | same |
| kit/mission-mural.glb | 2,890 | 64,576 | 4.4 x 4.3 x 8.0 | 5,430 | same |
| kit/deco-apartment.glb | 2,890 | 57,940 | 6.6 x 8.2 x 8.0 | 1,446 | same |

**Round total (whole-SF phase): 133.00 (part 1) + 96.00 (part 2a) = 229.00 credits** of the owner's 500 allowance. Lead cap 450 → **221 credits left** this round; floor balance 298.48.

## Wave 2 — ledger note (2026-09-27, lead, day-0 contracts)

- **CDN block lifted.** The part 2a note above says the cloud session cannot fetch `d8j0ntlcm91z4.cloudfront.net` (proxy 403). That is no longer true: the owner allowed the host in the cloud environment on 2026-09-26, and GLB / PNG / WAV results download with HTTP 200 / 206 (checked 2026-09-26/27, see `docs/opus-bay/CLOUD.md` and `docs/opus-bay/sf-w1-checkpoint.md` §5.2). A new container can lose the allow-list: test with `curl -sS -o /dev/null -w '%{http_code}' <result url>` before paying for a generation.
- **Where wave-2 rows go.** Each wave-2 lane logs its Higgsfield jobs in its own file, `docs/opus-bay/ledger/w2-<lane>.md` (lanes C2, D2, E2, F, G1, G2, H2b), with the same columns as the tables above (`# | asset | model / settings | prompt summary | credits | job id | local raw file | status`) plus a subtotal and the balance before / after each batch (`transactions`). This file stays append-only and is written by the lead only: the lead merges the lane files here at the end of wave 2.
- Balance at the start of wave 2: **519.48** (owner: all of it may be used if needed; quality first).

## Wave 2 (lean, cloud session 2026-09-27)

Merged by the lead from `docs/opus-bay/ledger/w2-*.md`. Only lane C2 logged rows.

### Lane C2 (from docs/opus-bay/ledger/w2-C2.md)

## Part a-look · art-direction targets (not shipped) — 2026-09-27

Purpose: calibrate the C2-2 palette (flat SF roofscape, pastel / white walls, roof tops darker than the walls) and
the C2-4 haze against a toy-diorama target. The images are reference only: nothing from them enters `public/`.
Balance before: 519.48 (CDN check: HTTP 200 on a known result URL before paying).
The job results report the served model as `nano_banana_2` for the `nano_banana_pro` requests (2 credits each).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| C2-AD1 | art direction: SF roofscape from Twin Peaks, golden hour | nano_banana_pro (served nano_banana_2), 16:9, 2k | style contract; green hill foreground, dense row houses with flat light-grey / off-white roofs + white parapets, white / cream / pastel walls, a terracotta minority in the far west, brick near downtown, towers, bay; light warm haze | 2 | 3919fa18-7d3f-4944-ab41-4b8ed0a789dc | /tmp/claude-0/c2/ad/ad-0.png (2752×1536) | used (palette + haze reference) |
| C2-AD2 | art direction: the same view at night | nano_banana_pro (served nano_banana_2), 16:9, 2k | flat grey / off-white roofs, warm lit windows, street-lamp dots along the grid, lit towers, deep blue-teal sky, city still readable | 2 | 23734eba-b516-422f-b0ee-08bd201f9a37 | /tmp/claude-0/c2/ad/ad-1.png | used (night reference for C2-9) |
| C2-AD3 | art direction: close aerial of a Mission block | nano_banana_pro (served nano_banana_2), 16:9, 2k | attached Victorians / Edwardians, flat roofs behind cornices, bay windows, pastel + white walls, light-grey roof tops, corner shop awning | 2 | 4b6e9c95-e162-43dc-b21a-2011408f8633 | /tmp/claude-0/c2/ad/ad-2.png | used (wall / roof pairs) |
| C2-AD4 | art direction: Sunset district from above | nano_banana_pro, 16:9, 2k | uniform stucco rows, flat light-grey roofs, one in six with terracotta tile, beach + fog bank | 0 (failed, refunded) | 0c86343e-70bf-4941-a704-30cb37fbf061 | — | failed, refunded (transactions 02:15:01 spend, 02:15:44 refund) |
| C2-AD5 | art direction: Sunset district from above (retry, reworded) | nano_banana_pro (served nano_banana_2), 16:9, 2k | as C2-AD4 | 2 | 7cd80df0-5892-47a0-aa6a-5a081f719d16 | /tmp/claude-0/c2/ad/ad-3.png | used (Sunset stucco + tile minority) |

Subtotal part a-look: **8 credits** (5 spends of 2, 1 refund of 2). Balance 519.48 → 511.48 (transactions
2026-09-27 02:15:01 ×4 spend, 02:15:44 refund, 02:16:31 spend; no other lane spent in between).


### Unattributed Voiceover jobs (2026-09-27 03:55–05:00 UTC)

`transactions` shows **22 × "Voiceover" at −0.6 = 13.20 credits** (03:55:13 ×5, 03:55:27, 04:23:32 ×6, 04:24:01 ×2, 04:29:06, 04:55:57–58 ×5, 05:00:14). No lane logged them and no voice file was committed in wave 2, so they were test or audition TTS runs by one of the running lanes (F, G1, G2, D2 or C2 part d). Their job ids can be found with `show_generations` (type audio). Nothing shipped from them.

**Wave-2 total: 8.00 (C2) + 13.20 (Voiceover) = 21.20 credits.** Balance 519.48 → **498.28** (checked with `balance` at 05:25 UTC). Whole-SF round so far: 229 + 21.20 = 250.20 credits.
