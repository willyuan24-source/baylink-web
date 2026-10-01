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

## Wave 3 and wave 4 (local)

Merged by the lead (the lead-merge agent of the wave-4 integration, worktree `C:/Users/willy/wt/i4-lead`, 2026-09-27)
from `docs/opus-bay/ledger/w3-*.md` and `w4-*.md` as they stand on `origin/opus-bay` at `7c6e6e2`. Every lane row is copied
verbatim under its lane (the lane files stay as they are); the balance trail and the reconciliation with the
Higgsfield `transactions` tool follow at the end. Wave 3 ran with per-lane caps (`sf-w3-lead.md` §4), wave 4 with a
cap of 120 for lane V only (`sf-w4-plan.md` §6). Lanes that logged no file spent nothing: wave 3 C2 0 / 20, E2 0 / 50,
F 0 / 25, G1 0, G2 0 (their reports say so); wave 4 C, G, L, P, T 0 (their reports say so).

- **CDN note, dated (H2b-12, 2026-09-27).** The part 2a note above ("the cloud session cannot fetch the CDN (the proxy
  returns 403)") no longer holds: `d8j0ntlcm91z4.cloudfront.net` answers HTTP 200 on the owner's machine (K6
  `hf_20260925_223758_3617006b-….png`, 6,390,343 B, checked by lane H2b on 2026-09-27 07:35 UTC and by lane V at
  17:10 UTC; the cloud allow-list is in the wave-2 note above). Downloads sometimes reset the connection (curl error
  35) and succeed on a retry.

### Wave 3 · lane D2 (from docs/opus-bay/ledger/w3-D2.md)

Columns as in `src/opus-bay/ASSETS-LEDGER.md`. Lane cap in wave 3: **80 credits**. The lead merges this file into the
ledger after the wave.

#### Part a · D2-15 (the eight part-2a SAM landmark meshes) — 2026-09-27

No new generation in this part: the eight raw SAM 3 meshes of part 2a (LM1-3D … LM8-3D, already paid there) were
cleaned, graded and gated locally. Raw files: `C:/Users/willy/opus-qa/assets-work/sf/lm/raw/<name>-sam.glb` (the
Legion of Honor raw was fetched again on 2026-09-27 02:46 PDT from the result of its retry job, 38ca4559-…).
Cleanup: `docs/opus-bay/kit-jobs/kit_cleanup.py --grader hero --tex 1024 --draco 1 --max-tris 6000` in Blender 5.2
(working folders `C:/Users/willy/opus-qa/w3/d2/lm/<name>/v*`); IoU against the concept the mesh was made from
(variant b; `iou.py`, rembg mask).

Balance before: **455.58** (`balance`, 2026-09-27 09:45 PDT). `transactions` (newest 10:07 UTC): no "3D Objects"
charge in wave 3; the image and TTS charges of 09:22–10:07 UTC belong to other lanes (D2 started no job). Credits spent
by D2 in part a: **0**.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W3-LM1 | Legion of Honor, cleaned | from LM1-3D; weld, dissolve, 5,880 tris, court stretched in depth (`--box`), gateway widened to 1.6 u (`--gate`), graded, Draco + WebP 1024 | — | 0 | 38ca4559-cc62-4974-8e1a-066ce7035611 | legion-of-honor-sam.glb | published `models/sf/legion-of-honor.glb` (120,288 B); **shipped** |
| W3-LM2 | Ghirardelli clock tower, cleaned | from LM2-3D; 5,879 tris | — | 0 | eff7a796-6189-4920-ba4f-a152fc28fb60 | ghirardelli-clock-tower-sam.glb | published `models/sf/ghirardelli-clock-tower.glb` (133,520 B); **prototype, not shipped** (palette 59 % < 80 %; the slim tower reads weaker than the procedural clock stage) |
| W3-LM3 | Fort Point, cleaned | from LM3-3D; 5,879 tris | — | 0 | 33906fb6-5410-42d3-8529-5e8bd181f6a1 | fort-point-sam.glb | published `models/sf/fort-point.glb` (162,588 B); **prototype, not shipped** (palette 30 %; hot orange box, ragged gun ports) |
| W3-LM4 | Mission Dolores, cleaned | from LM4-3D; 5,880 tris; basilica re-graded toward cream (`regrade_glb.py`, hue 30–70°, sat × 0.55) | — | 0 | 1b2b296e-5b33-43bc-967c-dadfe94a14ab | mission-dolores-sam.glb | published `models/sf/mission-dolores.glb` (98,936 B); **shipped** |
| W3-LM5 | Castro Theatre, cleaned | from LM5-3D; 5,880 tris | — | 0 | f924e7e0-e8f0-4626-a787-9b1619d5e1dc | castro-theatre-sam.glb | published `models/sf/castro-theatre.glb` (87,048 B); **shipped** |
| W3-LM6 | Dutch windmill body, cleaned | from LM6-3D; 5,880 tris; sails stay procedural | — | 0 | 2c4615b0-8d00-42cc-aa3e-b3bbe010e3c2 | dutch-windmill-sam.glb | published `models/sf/windmill-body.glb` (91,692 B); **shipped**; W7-R texture recolour (grey-brown shingle, `scripts/opus-sf/assets/w7r/recolour-glb.py`, 0 credits) → 83,956 B |
| W3-LM7 | Grace Cathedral, cleaned | from LM7-3D; 5,880 tris | — | 0 | e70a3dfe-cd66-4a9b-be55-49fec8396d55 | grace-cathedral-sam.glb | published `models/sf/grace-cathedral.glb` (118,076 B); **shipped**; W7-R texture recolour (cool grey, slate roofs, 0 credits) → 111,804 B |
| W3-LM8 | City Hall, cleaned | from LM8-3D; 6,860 tris | — | 0 | 06674d67-43e6-466c-bb1e-c9155b44c064 | city-hall-sam.glb | published `models/sf/city-hall.glb` (151,068 B); **shipped**; W7-R texture recolour (lead-grey dome, 0 credits; W7-R-review regenerated from the original: no green streaks, mid grey) → 145,168 B |

Subtotal part a: **0 credits**. Balance after: 455.58 (unchanged by D2).

#### Part b · D2-10, C2-5 Sites, the turntable flag, D2-08 / D2-13 (house kit) — 2026-09-27

No Higgsfield job: the kit swap uses the eleven part-2a kit houses as published (their masks were checked on the
`?solo=kit` sheet and needed no re-grade). Credits spent by D2 in part b: **0** (lane total in wave 3: 0 / 80).

#### Part c · D2-09, D2-11, D2-14, HC-4 — 2026-09-27

No Higgsfield job. HC-4 re-packs the five district hero GLBs locally (`docs/opus-bay/kit-jobs/hero_glb_pack.py`: int8
normals, uint16 UVs, uint8 skin weights, int16 animation rotations, WebP base colours): `baybay.glb` 599,156 → 368,516 B,
`pelican.glb` 223,224 → 160,248 B, `sailboat.glb` 177,796 → 127,060 B, `sea-lion.glb` 175,584 → 122,368 B,
`sea-lion-bark.glb` 185,328 → 130,108 B (1,361,088 → 908,300 B; same meshes, same textures re-encoded). Credits spent
by D2 in part c: **0** (lane total in wave 3: **0 / 80**).

### Wave 3 · lane H2b (from docs/opus-bay/ledger/w3-H2b.md)

Cap 150 credits for the lane (lead note §4). Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account is shared by the
parallel wave-3 lanes: charges are attributed by job id and time from `transactions`, never by the balance difference
alone.

#### Part a · preflight (H2b-1), 2026-09-27 07:35–07:40 UTC

- `balance` 498.28 (ultra plan); newest transaction before this lane: Voiceover −0.6 at 2026-09-27 05:00:14 UTC (the
  wave-2 mark).
- CDN: `curl` of K6 (`hf_20260925_223758_3617006b-….png`) → HTTP 200, 6,390,343 B (same bytes as
  `C:/Users/willy/opus-qa/assets-work/raw/key-wide-d.png`).
- Upload path: `media_upload` → presigned S3 PUT (`fast-and-furious-input-prod-….s3.amazonaws.com`, eu-north-1) → HTTP
  200 → `media_confirm` "uploaded" (1 × 1 PNG, media a1ea32a2-253e-496c-9a45-c52e3b7fef9a). Free.
- Scratch venv `C:/Users/willy/opus-qa/w3/h2b/venv` (Python 3.14): imageio-ffmpeg 0.x (ffmpeg 7.1), Pillow 12.3 (WebP
  on), numpy 2.5, scipy 1.18, opencv-python-headless 5.0.
- Preflight costs (`get_cost`): nano_banana_pro 4k = 4, seedream_v4_5 high = 1, seedream_v5_pro 2k inpaint = 2.5.

Reference media (free uploads): base render `388a9f83-d610-4dea-957c-a7e7b26ab43a` (base-4096 as JPEG q95, from
`scripts/opus-sf/map/render-base.ts` at c10f28f), `90a9210d-f106-4d9e-9b2b-e9c1259c94d1` (base-2048 PNG, spare);
style reference K6 = prior job `3617006b-483d-4ea7-9e72-39b681f8264f` (passed as a job id, no upload).

#### Part a · T2 painted whole-SF map (H2b-3)

Balance before the batch: 498.28 (07:53 UTC).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| H2b-T2-1 | painted map, diorama variant A | nano_banana_pro (served nano_banana_2), 1:1, 4k; refs: base 388a9f83 + K6 3617006b | "repaint the FIRST image as a handcrafted miniature clay diorama seen straight from above; keep every coast / pier / park / street; cream table, teal resin board; K6 = materials + palette only; no text" | 4 | ad933d4f-91a6-4e1d-9635-8057dfcf7490 | C:/Users/willy/opus-qa/w3/h2b/cand/c1.png (4096²) | passed the coast gate (p95 15.0 / 9.8 px) but 3D towers and extrusions lean over the streets and the GGB runs on to the board edge: runner-up, not shipped |
| H2b-T2-2 | painted map, diorama variant A (second draw) | same as T2-1 | same | 4 | 4089cdee-3396-4122-8bf1-69f67a3270d5 | cand/c2.png | rejected: invented a Marin headland for the Golden Gate Bridge (coast p95 293 px) |
| H2b-T2-3 | painted map, gouache / watercolour variant B | nano_banana_pro (served nano_banana_2), 1:1, 4k; refs: base + K6 | "trace the FIRST image into a hand-painted illustrated map, gouache and soft watercolour on cream paper; exact base map; cozy toy town of tiny house dabs; K6 = palette + charm only; no text of any kind" | 4 | ad4bd486-a8f1-44e6-809c-852317157ff7 | cand/c3.png | rejected narrowly: two invented piers off Ocean Beach (coast p95 33.3 px > 30.7) |
| H2b-T2-4 | painted map, gouache / watercolour variant B (second draw) | same as T2-3 | same | 4 | aebf64b4-e9c9-4931-9959-dc0499974082 | cand/c4.png | **USED -> public/opus-bay/map/paper-v1-{1024,2048,4096}.webp** (coast p95 12.0 / 6.4 px; pseudo-letters on the hero lots and one Bayview lot wiped by paper_post.py --smooth-hero --declutter) |
| H2b-T2-5 | painted map, diorama (Seedream) | seedream_v4_5, quality high, 1:1; refs: base + K6 | variant A wording for Seedream ("image 1" / "image 2") | 1 | 1cab5a86-851e-4267-823f-ff355db6a5ab | cand/c5.png | rejected: a perspective toy diorama that ignores the layout |
| H2b-T2-6 | painted map, watercolour (Seedream) | seedream_v4_5, quality high, 1:1; refs: base + K6 | variant B wording for Seedream | 1 | e5f7bdeb-4a96-4fc5-bf1c-63703ea1d23b | cand/c6.png | rejected: re-imagined city, bridges moved, wrong outline |
| H2b-T2-7 | painted map, clay inpaint | seedream_v5_pro, 2k, is_inpaint, 1:1; ref: base only | "restyle this top-down map as a handcrafted miniature clay diorama without moving anything …; no text" | 2.5 | 2b6de989-b9c6-42d8-85b7-0b590d96112b | cand/c7.png (2048²) | passed the gate (p95 24.3 / 22.0 px) but blobby clay at 2048: not shipped |

Transactions (07:54:55–07:54:56 UTC, no other spend in between): Nano Banana Pro −4 ×4, Seedream 4.5 −1 ×2,
Seedream 5.0 Pro −2.5 ×1. **Subtotal T2: 20.5 credits.** Balance 498.28 → 477.78. No retake round (c4 passed).
Downloads: the CDN reset the connection on 5 of the first 7 GETs (curl error 35) and served all of them on retry.

#### Part b · voice lines (H2b-6/7/8), 2026-09-27 08:37–09:06 UTC

Model qwen_audio_tts (Qwen Audio 3.0 TTS Flash), preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz,
`language` zh / en, instruction = the shipped district instruction ("Cute otter mascot: warm, cheerful, bright but not
shrill; snappy playful delivery.") + one mood note (the service caps an instruction at 128 characters). `get_cost`
0.01 per job (longer texts are billed 0.02). Take list: `scripts/opus-sf/voice/takes.ts`; every job id with its text,
instruction, seed and speech rate: `docs/opus-bay/h2b/voice-takes.json`; measurements and picks:
`docs/opus-bay/h2b/voice-report.json`. Raw wavs: `C:/Users/willy/opus-qa/w3/h2b/voice/raw/<index>.wav`.

Balance before: 477.78 (08:37 UTC; the last spend before was H2b-T2 at 07:54:56).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| H2b-V1 | 20 city lines × zh / en, 3 takes each | qwen_audio_tts, Pixie, wav 48k, seeds 11 / 22 / 33 (one retry on seed 44) | 8 mode firsts + 12 neighbourhood greetings (data/voiceLinesSf.ts SF_VOICE_LINES) | 120 jobs | voice-takes.json #0–119 | raw/0–119.wav | picks below |
| H2b-V2 | re-records zh-yay / zh-think / zh-arrived, 2 phrasings × 3 seeds | same, note per word ("crisp 好 (hǎo), bright high 耶" …) | 好耶！ 好耶～！ · 嗯…让我想想 嗯——让我想想。 · 到啦！ 到啦～！ | 18 jobs | voice-takes.json #120–137 | raw/120–137.wav | picks below |
| H2b-V3 | round 2: 14 clips over 2 s or with < 2 distinct passing takes, 3 speech rates each; re-record phrasings | same, seed 11, speech_rate 1.1 / 1.2 / 1.3 (re-records 0.9–1.15) | the same texts; 好耶好耶！, 我们到啦！, 嗯，让我想想。 | 53 jobs | voice-takes.json #138–190 | raw/138–190.wav | picks below |
| H2b-V-fail | 33 submissions the service failed (status failed, 'type image' in the job record) | same | retried with the same parameters (#20 on seed 44) | 0 (all refunded) | 3082fe18, 90ffa0a1, 7400876e, 4a44ea29, a2539c81, c3d824ef, e3b84649, fdc26e9b, a7069b0b, ad95281e, d6c1e6f8, 2edfb3a3, 1482ddc8, 33a80f19, 7177f00e, f9d20872, ced9009f, 6668e867, 6f7d8ac7, 01ee342b, b1c573b5, cf1b5001, ee36947e, 77d48a36, 3d9e685f, 48e55218, 825353cd, 248106ce, ec41663a, bc312beb, cd12c904, 776077e5, c766f287 | - | refunded |

Picks (clip → job id prefix): zh-first-bike 6a826864, zh-first-car 5919e43c, zh-first-cable-car 8edbea5b, zh-first-streetcar aea6933b, zh-first-ferry a698a207, zh-first-glide fc43304a, zh-first-hill 4e6c0b5c, zh-first-crest a8ea813c; en-first-bike db9a068e, en-first-car b349ce05, en-first-cable-car 4c63bd08, en-first-streetcar 851acf7f, en-first-ferry e0a6e81e, en-first-glide 6e400d50, en-first-hill d96dd651, en-first-crest 859b1e91; zh-zone-chinatown cb837ad5, zh-zone-north-beach 43da724b, zh-zone-mission 5b2ecdb2, zh-zone-castro-upper-market e3c79b4a, zh-zone-haight-ashbury 0497bd1b, zh-zone-marina 23922e5e, zh-zone-twin-peaks 72f1e530, zh-zone-golden-gate-park 325c70a8, zh-zone-financial-district-south-beach 54c19945, zh-zone-presidio b05ef19a, zh-zone-nob-hill bdb7f4cd, zh-zone-sunset-parkside 8682a5cb; en-zone-chinatown 9974cc47, en-zone-north-beach 5073e4df, en-zone-mission 08c00c54, en-zone-castro-upper-market 7cf37dba, en-zone-haight-ashbury b1231999, en-zone-marina d2f81d27, en-zone-twin-peaks a2d56d95, en-zone-golden-gate-park 83d5a94f, en-zone-financial-district-south-beach 40b86cad, en-zone-presidio d4a9c9a6, en-zone-nob-hill 1825efe1, en-zone-sunset-parkside f82c740e; zh-yay 0a4d3369, zh-think d41595dc, zh-arrived f1b2ead6. Full ids in voice-report.json.

Transactions 08:37:56–09:05:45 UTC: only "Qwen Audio 3.0 TTS Flash" (224 submitted jobs at 0.01–0.02 each: 191 completed, 33 failed and refunded); no other lane spent in between. **Subtotal voice: 2.06 credits.** Balance 477.78 → 475.72 (`balance` at 09:07 UTC). Notes: the service often ignores the seed (byte-identical files for two or three of the seeds 11 / 22 / 33 on 14 of 46 text groups), so round 2 varied `speech_rate`; batches of 12 hit HTTP 429 (rate limit) — batches of 10 mostly pass.

#### Part b · Mission murals (H2b-10), 2026-09-27 09:22–09:25 UTC

Balance before: 475.72 (09:07 UTC). Shared prompt (every job): "An original community mural in the spirit of the painted
alleys of San Francisco's Mission District, but an entirely new design that copies no existing mural. Square,
full-bleed flat artwork only … Subject: {subject}. Style: hand-painted acrylic, bold flat shapes with a soft visible
brush texture, warm folk-art patterns, a cozy toy-town palette of cream, sand, sage green, terracotta, teal, marigold
and soft rose; friendly and calm. Strictly no people, no human faces, no text, no letters, no numbers, no signature, no
logos, no watermark." The nano_banana_pro variant adds K6 (`3617006b-…`) "only for its colour palette and warmth".
Raw files: `C:/Users/willy/opus-qa/w3/h2b/murals/raw/`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| H2b-M-A1 | A/B: sun + hummingbird | gpt_image_2_5 (Flare), high, 1k, 1:1 | radiant sun, hummingbird at a giant marigold, cut-paper bunting | 1.5 | 76baf3e7-c419-4cb2-adc6-41bb856b162f | raw/ab-gpt-sun.png | **USED** → sun-hummingbird |
| H2b-M-A2 | A/B: pelicans | gpt_image_2_5 (Flare), high, 1k, 1:1 | three brown pelicans over curling waves, tiny bridge towers in fog | 1.5 | 99ff5d30-d6b9-4fe2-8d2c-bbf04a618d3d | raw/ab-gpt-pelican.png | **USED** → pelican-bay |
| H2b-M-B1 | A/B: sun + hummingbird | nano_banana_pro (served nano_banana_2), 2k, 1:1, ref K6 | same subject | 2 | d8b6b8f8-33cd-4b73-a970-e66b5820347c | raw/ab-nano-sun.png | A/B loser: softer pastel, busy dot patterns that turn to noise at 512 px |
| H2b-M-B2 | A/B: pelicans | nano_banana_pro (served nano_banana_2), 2k, 1:1, ref K6 | same subject | 2 | 98383df7-80b5-433d-bb1f-678cfe7644d0 | raw/ab-nano-pelican.png | A/B loser (pink pelicans, same softness) |
| H2b-M-3 | flower cable car | gpt_image_2_5 (Flare), high, 1k, 1:1 | a cable car made of flowers climbing a hill of pastel row houses (no numbers, no signs) | 1.5 | 90fae8d5-f281-465a-a14a-6e200f075f3f | raw/m-cable-a.png | **USED** → flower-cable-car (zoomed: no numbers or letters) |
| H2b-M-4 | poppies + monarchs | same | poppies and lupines on green hills, monarch butterflies | 1.5 | 1602341c-b13c-4261-890d-080b17229fa0 | raw/m-poppies.png | **USED** → poppy-hills |
| H2b-M-5 | fruit stand | same | baskets of mangoes, papayas, limes, chiles, corn, watermelon; cut-paper bunting | 1.5 | 1ecf7748-fc9b-4071-b2e0-c7b31004d402 | raw/m-market-a.png | runner-up |
| H2b-M-6 | night bay | same | moon, stars, ribbon fog, a hill of houses with glowing windows | 1.5 | 042154ba-b1f9-47c0-9178-bb444aefb7a2 | raw/m-night.png | **USED** → night-bay |
| H2b-M-7 | music garden | same | guitar, accordion, drum among roses, marigolds and vines (no written notes) | 1.5 | 82dacccc-855b-4eac-8318-08c860f244a5 | raw/m-music.png | **USED** → music-garden |
| H2b-M-8 | under the bay | same | octopus, fish, sea stars in a kelp forest, sunbeams | 1.5 | 76869d60-f9e9-407b-b299-2e3b7ac79cb5 | raw/m-ocean.png | **USED** → kelp-forest |
| H2b-M-9 | flower cable car (second draw) | same | as M-3 | 1.5 | c4976a53-6727-462f-807c-69cde7152976 | raw/m-cable-b.png | runner-up |
| H2b-M-10 | fruit stand (second draw) | same | as M-5 | 1.5 | cdc779dd-c2e6-4b92-a9ca-9ca9eb5662d2 | raw/m-market-b.png | **USED** → fruit-stand |

Every used image was read at full size for text, numbers, signatures and faces: none (animals only, in profile or as
folk-art shapes). Transactions 09:22:02–09:24:27 UTC: GPT Image 2.5 Flare −1.5 × 10, Nano Banana Pro −2 × 2; no other
spend in between. **Subtotal murals: 19.00 credits.** Balance 475.72 → 456.72 (`balance` at 09:40 UTC).
Post-processing (free, `scripts/opus-sf/murals/murals_post.py`): 480 px art + 16 px edge gutter per 512 tile, atlas
WebP q48 = 256,124 B; singles 512 px WebP q82.

Lane subtotal at this point: 20.5 (map) + 2.06 (voice) + 19.0 (murals) = 41.56 credits; balance 456.72 (the final
total is after round 3 below).

#### Part b · voice round 3: G2's later lines (H2b-7), 2026-09-27 09:56–10:07 UTC

G2 froze `BARK_SCRIPT` (commit d4631e6) while this part ran: the 20 recorded lines word for word plus a
`BARK_SCRIPT_TODO` block of 18 lines "for the next H2b pass". This is the lane's last part, so they were recorded now
(`SF_VOICE_EXTRA` in `data/voiceLinesSf.ts`). Same model, preset and instruction scheme (moods: + "thinking" = "A little
puzzled, playful, not upset."), three speech rates (1.0 / 1.1 / 1.2) per clip from the start. Balance before: 456.72.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| H2b-V4 | 18 later lines × zh / en, 3 takes each | qwen_audio_tts, Pixie, wav 48k, seed 11, speech_rate 1.0 / 1.1 / 1.2 | bump-hard, stairs, pant, crest-again, glide-again, glide-land, glide-no-landing, cable-bell, turntable-push, zone-new + 8 greetings (G2's `BARK_SCRIPT_TODO`, word for word) | 108 jobs | voice-takes.json #191–298 | raw/191–298.wav | picks below |
| H2b-V4-fail | 10 submissions the service failed | same | retried with the same parameters | 0 (all refunded) | 2a5ad752, c887ce85, 03e943b8, cf2f21ec, 31849266, c67c4c7d, a65c48cd, 0f91fb13, a3f80a60, d6aefa9e | - | refunded |

Picks: zh-bump-hard 7f30be8a, en-bump-hard 76418af7, zh-stairs c93c5819, en-stairs a91cdbde, zh-pant fc2463e4, en-pant 50db92b8, zh-crest-again 3083fd63, en-crest-again 04a4a1e9, zh-glide-again 4db34b3c, en-glide-again 5d62331c, zh-glide-land 2167449a, en-glide-land 64c5415e, zh-glide-no-landing 83ee6ba0, en-glide-no-landing 2eb29411, zh-cable-bell baea99d7, en-cable-bell 26eac3b8, zh-turntable-push 27e4af15, en-turntable-push f8fed7ba, zh-zone-new 83e1253e, en-zone-new 31a6027a, zh-zone-hayes-valley 44cdb2ef, en-zone-hayes-valley 6dbd005b, zh-zone-japantown e8eea529, en-zone-japantown 6664fbcc, zh-zone-russian-hill 819651d0, en-zone-russian-hill 4b0968dc, zh-zone-south-of-market 38d48182, en-zone-south-of-market 006766dc, zh-zone-potrero-hill 4095f95a, en-zone-potrero-hill 88f00e20, zh-zone-lincoln-park 628ae892, en-zone-lincoln-park 77c9daca, zh-zone-mission-bay c9650ad1, en-zone-mission-bay 37d3e767, zh-zone-outer-richmond 76fab452, en-zone-outer-richmond 9422f9a0. Full ids in voice-report.json.

Transactions 09:56:01–10:07:13 UTC: only "Qwen Audio 3.0 TTS Flash" (118 submitted jobs: 108 completed, 10 failed and
refunded). **Subtotal round 3: 1.14 credits.** Balance 456.72 → 455.58 (`balance` at 10:12 UTC).

**Lane H2b total, wave 3 (final): 20.5 (map) + 3.20 (voice: 2.06 + 1.14) + 19.0 (murals) = 42.70 credits** of the 150 cap.
Balance 498.28 → 455.58.

### Wave 4 · lane V (from docs/opus-bay/ledger/w4-V.md)

Cap **120** credits for wave 4 (plan §6, lead note §5), lane V only; keep ≥ 50 of the balance for the final polish.
Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account is shared: charges are attributed by job id and time from
`transactions`, never by the balance difference alone. Prompts (verbatim, with their references): 
`scripts/opus-sf/assets/w4/prompts.py` → `prompts.json`. Raw downloads: `C:/Users/willy/opus-qa/w4/w4-v/{ai/raw,vehicles,stickers}/`.

#### Preflight (W4-V2), 2026-09-27 17:10 UTC

- `balance` **455.58** (ultra). Newest transaction before this lane: Qwen Audio 3.0 TTS Flash −0.01 at 10:07:13 UTC (wave 3,
  H2b voice) — the wave-4 mark.
- CDN: `curl` of K6 (`hf_20260925_223758_3617006b-….png`) → HTTP 200, 6,390,343 B. Downloads reset the connection now and
  then (curl error 35) and succeed on a retry (the download helper retries 4–6 times).
- Upload path: `media_upload` → S3 PUT 200 → `media_confirm` "uploaded": `588c24e4-8abb-4ad9-92ac-f98b5283b1a1` = a 1024 px
  crop of `public/opus-bay/map/paper-v1-2048.webp` (the painted-map style reference for the stickers). Free.
- Style references (prior jobs, no upload): K6 `3617006b-483d-4ea7-9e72-39b681f8264f`, rotunda concept L2-C1
  `fba12f36-5e33-435f-9944-be12f183acf9`.

#### Batch 1 · concepts, vehicle references, sticker sheets (17:17 UTC)

Balance before: 455.58. Model `nano_banana_pro` (served `nano_banana_2`, billed "Nano Banana Pro"). Landmark variant a =
refs K6 + L2-C1 with the "match the look, make a different building" prefix; variant b = ref K6 only. Every landmark and
vehicle prompt = subject + the part-1 3D concept add-on + the style contract; the sticker prompt uses the painted-map
style instead of the (tilt-shift photo) contract.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-C1a | Cal Academy concept a | nano_banana_pro 1:1 2k, refs K6 + L2-C1 | long low glass museum under a thin white overhanging roof on slim columns; green living roof with two big porthole domes + small humps | 2 | 6c79ad6f-7731-44e7-aa65-da82b6a125ee | ai/raw/cal-academy-a.png | runner-up (left dome without portholes); its SAM failed (below) |
| W4V-C1b | Cal Academy concept b | nano_banana_pro 1:1 2k, ref K6 | same | 2 | 194ef1d0-31a2-40d0-94af-8235ab5c4985 | ai/raw/cal-academy-b.png | **USED** (both domes with portholes, humps between) |
| W4V-C2a | St Ignatius concept a | same as C1a | twin four-stage towers (square → octagonal, open belfry, domed lantern + chunky cross), columned front + pediment, tile nave, dome on a drum | 2 | 00c95970-261f-4fda-aa90-a57ab1a31742 | ai/raw/st-ignatius-a.png | meshed (W4V-3D4), IoU 0.805: not used |
| W4V-C2b | St Ignatius concept b | same as C1b | same | 2 | 708c7169-7186-4ee4-8f81-ca3502c5a78b | ai/raw/st-ignatius-b.png | **USED** (bigger dome, cleaner towers) |
| W4V-C3a | Holy Virgin Cathedral concept a | same as C1a | white body, rounded arched gables, deep red trim, five gold onion domes on drums with chunky crosses, arched porch | 2 | 1b8c2abe-8a9b-44bb-9a17-84e0c4bf7a3c | ai/raw/holy-virgin-a.png | **USED** |
| W4V-C3b | Holy Virgin Cathedral concept b | same as C1b | same | 2 | e1303403-1f9e-4d34-bcc7-fa25db9f5ba3 | ai/raw/holy-virgin-b.png | not meshed (domes crowded, narrow) |
| W4V-C4a | Chinese Pavilion concept a | same as C1a | open octagonal pavilion, 8 red columns, low red bench walls, grey-green glazed tile roof with upturned corners, finial, low stone floor | 2 | 9b698354-4462-445d-b6b8-d6588aa22808 | ai/raw/chinese-pavilion-a.png | **USED** (chunkier, SAM-friendly) |
| W4V-C4b | Chinese Pavilion concept b | same as C1b | same | 2 | c8c9b7d8-6c82-4cfe-a25e-afb80d5ee905 | ai/raw/chinese-pavilion-b.png | not meshed (fine fretwork beams) |
| W4V-R1 | toy open-top double-decker reference sheet | nano_banana_pro 16:9 2k, ref K6 | coral body, cream band, teal-grey windows, open upper deck with 4 bench rows, rear stair; side / front / back / top | 2 | 58a2c071-3d7c-4b48-b10e-e5b080844ef2 | vehicles/ref-tour-bus.png | USED as reference (3/4 main view; a tiny K6 streetcar leaked in beside the front wheel: ignore it) — front and back views |
| W4V-R2 | toy two-car LRV reference sheet | same | silver body, red belt line, teal-grey windows, 2 double doors per car, bellows, blank headsign, solid pantograph arm; side / front / back / top | 2 | 1641a3fd-7757-45ab-a7a7-238fbad63922 | vehicles/ref-lrv.png | **USED** as reference (all four views clean, no text) |
| W4V-S1 | T1 sticker sheet, draw 1 | nano_banana_pro 1:1 4k, refs K6 + paper crop 588c24e4 | 16 round die-cut gouache stickers, 4 × 4 in the order of STICKER_IDS | 4 | 846efbec-f889-495f-b8ad-8f7dcccff79a | stickers/sheet-1.png | runner-up (all 16 right; SF State / Stonestown weaker) |
| W4V-S2 | T1 sticker sheet, draw 2 | same | same | 4 | f313e2ed-e191-46c0-b461-7ac2612eb71b | stickers/sheet-2.png | **USED -> public/opus-bay/map/stickers-t1.{webp,json}** (read at full size row by row: no text, no letters, no logos) |

Transactions 17:17:30.765–17:17:32.769 UTC: Nano Banana Pro −2 × 10, −4 × 2 (no other spend in between). **Subtotal 28.**

#### Batch 2 · SAM 3 3D meshes + one bus retake (17:22–17:24 UTC)

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-3D1 | Cal Academy mesh from C1b, try 1 | sam_3_3d textured, prompt "the toy museum building" | — | 0 (failed, refunded) | a859fafe-cbb1-480b-a9e4-616b6c897a11 | — | failed (no detection), refunded |
| W4V-3D2 | Cal Academy mesh from C1a | same | — | 0 (failed, refunded) | 07c0e940-793d-4ba0-8ebb-bc5b8eb9d98f | — | failed, refunded |
| W4V-3D3 | St Ignatius mesh from C2b | sam_3_3d, "the toy church" | 21,844 tris raw | 1 | cc596ca6-c9c4-4ded-a6d8-2daff7021918 | ai/raw/st-ignatius-b-sam.glb | **USED** |
| W4V-3D4 | St Ignatius mesh from C2a | same | 24,210 tris raw | 1 | a352bdd1-461c-4324-8b2c-c09438f6c77f | ai/raw/st-ignatius-a-sam.glb | not used (IoU 0.805 < 0.85) |
| W4V-3D5 | Holy Virgin mesh from C3a | sam_3_3d, "the toy cathedral" | 18,402 tris raw | 1 | 78e206f5-9c5b-4ede-82b2-108da5b772f8 | ai/raw/holy-virgin-a-sam.glb | **USED** |
| W4V-3D6 | Chinese Pavilion mesh from C4a | sam_3_3d, "the toy pavilion" | 27,718 tris raw | 1 | 580b0015-df30-41eb-9d11-1572a21326a3 | ai/raw/chinese-pavilion-a-sam.glb | **USED** |
| W4V-R1b | tour-bus reference retake | nano_banana_pro 16:9 2k, refs K6 + R2 (layout) | "laid out like the train sheet", orthographic side / top, nothing but the bus | 2 | 9c78c22e-92a6-4e73-958f-b69dd8853db4 | vehicles/ref-tour-bus-b.png | **USED** as reference: the clean side and top views (its second view repeats the side and the "front" is the back: use R1 for front / back) |
| W4V-3D7 | Cal Academy mesh from C1b, try 2 | sam_3_3d, "the green-roofed toy building", detection_threshold 0.3 | 13,908 tris raw | 1 | 4d8799df-4fd4-4caa-9fc8-6dfc96164e85 | ai/raw/cal-academy-b-sam.glb | **USED** |

Transactions 17:22:05–17:23:46 UTC: 3D Objects −1 × 7 with +1 × 2 refunds (17:22:08, 17:22:11 = the two failed Cal
Academy jobs), Nano Banana Pro −2 at 17:22:30. **Subtotal 7.**

**Wave-4 lane V total so far: 35.00 credits** (28 + 7) of the 120 cap. Balance 455.58 → **420.58** (`balance` at 18:20 UTC,
equal to the tally: no other lane spent in the window).

#### Published from these jobs (local cleanup, free)

Pipeline `scripts/opus-sf/assets/w4/` (Blender 5.2 headless; `build.py NAME TAG`, settings in `specs.json`): D2's wave-3
landmark cleanup (weld, flat base, planar dissolve + collapse to the cap, origin at the ground centre, front → +Z) plus a
**texel re-bake** (`--rebake 1`: smart-UV-project the decimated mesh and transfer the raw colour texel by texel with a
BVH ray along the face normal; it removes the diagonal roof-tile streaks the collapse decimation smeared over side walls),
the hero palette grade (`grade.py`, per-asset hue remaps), Draco (level 6) + WebP q82, IoU sweep against the concept.

| file | tris | bytes | size w × h × d (u) | IoU | non-manifold / islands | palette ΔE12 (before → after) | status |
|---|---|---|---|---|---|---|---|
| models/sf/w4-cal-academy.glb (+ -mask.webp 7,592 B, R = glass) | 5,880 | 93,120 | 24.4 × 7.9 × 16.6 (fitted to lane L's procedural block + canopy) | 0.908 native / 0.894 as published | 0 % / 1 | 0.66 → 0.99 | published, not registered (integration) |
| models/sf/w4-st-ignatius.glb | 5,879 | 152,988 | 7.5 × 13.2 × 11.15 (fitted to lane L's procedural church) | 0.863 native / 0.807 as published (fit waiver) | 0.08 % / 1 | 0.21 → 0.92 | published, not registered |
| models/sf/w4-holy-virgin.glb | 5,880 | 184,596 | 6.10 × 9.1 × 6.69 | 0.854 | 0.23 % / 2 | 0.41 → 0.85 | published, not registered |
| models/sf/w4-chinese-pavilion.glb | 2,940 | 71,388 | 5.62 × 4.5 × 5.61 | 0.855 | 0 % / 1 | 0.25 → 0.86 | published, not registered |
| map/stickers-t1.webp + .json | — | 74,150 | 512 × 512 atlas, 16 × 124 px circles | — | — | — | published (lane P draws it) |

The Cal Academy and St Ignatius rows were first written before the fit to lane L's bounds (`--box`); the lane-V review
(2026-09-27) set them to the published files (tests/opus-bay-w4-assets.test.ts checks this table against `W4_MODELS`).

#### Batch 3 · tour narration voice (W4-V6), 2026-09-27 18:29–19:30 UTC

Lane C froze `TOUR_LINES` at 9d9dab9 (tag `w4-tourlines-frozen`): 107 lines. Model `qwen_audio_tts` (Qwen Audio 3.0 TTS
Flash), preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4` (every BAYBAY clip), wav 48 kHz, `language` zh / en,
instruction = "Cute otter mascot tour guide: warm, cheerful, clear, friendly storytelling pace." + a mood note (quiet
lines: "soft, gentle and respectful, quiet and slow"), ≤ 128 characters. Take list `scripts/opus-sf/voice/w4/takes.ts`;
every take with its job id, text, rate, measurements and the pick: `docs/opus-bay/qa/w4/V/voice/tour-voice-report.json`.
Preflight `get_cost`: 0.05 for a 110-character line (billed by length, 0.01–0.04 for these lines). Raw wavs:
`C:/Users/willy/opus-qa/w4/w4-v/voice/raw/<take index>.wav`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-VO1 | 214 clips (107 lines × zh / en), take 1 | qwen_audio_tts, Pixie, speech_rate 1.0 | the frozen texts | (below) | tour-voice-report.json, `takes[].job_id` | voice/raw/<even index>.wav | 194 completed; 20 failed at the service ("failed", type image, as in wave 3); about 1 in 6 submissions answered 429 and were resubmitted |
| W4V-VO2 | the 20 failed takes, resubmitted | same | same | (below) | jobs_retry (in the report) | same paths | all completed |
| W4V-VO3 | 16 retakes at speech_rate 1.08 | same | the clips whose take missed a gate or the recogniser | (below) | jobs_r2 (in the report) | voice/raw/<odd index>.wav | 5 of them became the pick |

Transactions 18:29:40–19:29:39 UTC: only "Qwen Audio 3.0 TTS Flash" spends (0.01–0.04 each) and refunds (the 429 /
failed submissions), at the times of this lane's batches; no other lane spent in the window. **Subtotal 5.45 credits**
(balance 420.58 → 415.13).

**Wave-4 lane V total: 40.45 credits** (35.00 images + 3D, 5.45 voice) of the 120 cap. Balance 455.58 → **415.13**
(`balance`, 2026-09-27 ≈ 20:05 UTC).

Published: `public/opus-bay/voice/sf/tour/<lang>-<id>.m4a` + `.ogg` (214 × 2 files, 2.2–8.1 s, 17 MB), all picks pass the
gates (no clipping, not cut, pauses, pitch, speaking rate with numbers counted as read), the recogniser heard 203 of 214
right; `src/opus-bay/data/sf/voiceTour.ts` (generated); previews and the owner's sheet in `docs/opus-bay/qa/w4/V/voice/`.

### Balance trail and reconciliation (lead-merge, 2026-09-27 ≈ 22:25 UTC)

| step | charges (`transactions`, UTC) | credits | balance after |
|---|---|---|---|
| end of wave 2 | — | — | 498.28 (`balance` 05:25) |
| wave 3 · H2b painted map | Nano Banana Pro −4 × 4, Seedream 4.5 −1 × 2, Seedream 5.0 Pro −2.5 (07:54:55–56) | 20.50 | 477.78 |
| wave 3 · H2b voice rounds 1–2 | Qwen Audio 3.0 TTS Flash only (08:37:56–09:05:45; 33 failed jobs refunded) | 2.06 | 475.72 (`balance` 09:07) |
| wave 3 · H2b murals | GPT Image 2.5 Flare −1.5 × 10, Nano Banana Pro −2 × 2 (09:22:02–09:24:27) | 19.00 | 456.72 (`balance` 09:40) |
| wave 3 · H2b voice round 3 | Qwen Audio 3.0 TTS Flash only (09:56:01–10:07:13; 10 refunded) | 1.14 | 455.58 (`balance` 10:12) |
| wave 3 · D2 parts a–c, C2, E2, F, G1, G2 | none | 0 | 455.58 |
| wave 4 · V batch 1 (concepts, vehicle sheets, sticker sheets) | Nano Banana Pro −2 × 10, −4 × 2 (17:17:30.765–17:17:32.769) | 28.00 | 427.58 |
| wave 4 · V batch 2 (SAM meshes, bus retake) | 3D Objects −1 × 7 with +1 × 2 refunds (17:22:05–17:23:46), Nano Banana Pro −2 (17:22:30) | 7.00 | 420.58 (`balance` 18:20) |
| wave 4 · V tour voice | Qwen Audio 3.0 TTS Flash spends and refunds only (18:29:40–19:29:39) | 5.45 | 415.13 (`balance` ≈ 20:05) |
| after the lane ledgers (**not yet in a lane ledger**) | Nano Banana Pro −2 × 6 (22:16:37.078–.675), 3D Objects −1 (22:18:37), Nano Banana Pro −2 (22:20:16) | 15.00 | **400.13** (`balance` ≈ 22:25) |

Reconciliation: `transactions` was read newest first in pages of 100 down to H2b's last charge (10:07:13.112 UTC).
There is no transaction between 10:07:13 and V's batch 1 at 17:17:30 (D2's part a found none either); V's two image /
3D batches match its ledger rows one to one (28 + 7, the two refunds are the two failed Cal Academy SAM jobs); the
18:29:40–19:29:39 window holds only TTS spends and refunds and the lane's `balance` checks bracket it (420.58 → 415.13 =
5.45, its subtotal); nothing between 19:29:39 and 22:16:37. The 15 credits of 22:16–22:20 UTC came after every ledger
on the branch: at the time of this merge lane V's worktree holds uncommitted work on the Holy Virgin re-fit (lane L's
request in `sf-w4-L.md`: its prompts, specs and GLB), so they are most likely lane V's; its ledger attributes them by
job id and the lead's next merge copies those rows here. Sum check: 498.28 − 400.13 = 98.15 = 42.70 + 40.45 + 15.00.

**Wave 3 total: 42.70 credits** (H2b 42.70 of 150; D2 0 of 80; C2 0 of 20; E2 0 of 50; F 0 of 25). **Wave 4 so far:
55.45 credits** of the 120 cap (V 40.45 logged + 15.00 pending attribution); balance **400.13**, well above the ≥ 50 kept
for the final polish. Whole-SF round so far: 250.20 (to the end of wave 2) + 42.70 + 55.45 = **348.35 credits**.

## Wave 5 (local)

Merged by the lead's hand-off writer (worktree `C:/Users/willy/wt/w5-verify`, 2026-09-28 PDT = 2026-09-29 ≈ 04:10 UTC)
from `docs/opus-bay/ledger/w5-V.md` as it stands on `origin/opus-bay` at `a45f5afd`. Every lane row is copied verbatim
under its lane (the lane file stays as it is; its `##` headings are `####` here); the balance trail and the
reconciliation with the Higgsfield `transactions` tool follow at the end. Wave 5 ran with a cap of 130 credits for lane V
only and a floor of 250 on the balance (`sf-w5-plan.md` §5, `sf-w5-lead.md` §8). Only lane V logged a file: lanes F, N,
C, T, L, E, A, D and R spent nothing (their reports say Higgsfield 0), nor did the lead's day 0, the ten reviews or W5-Z.

First, wave 4's last two lane-V batches. They came after the wave-4 merge above (its trail row "after the lane ledgers
(not yet in a lane ledger)", 15.00, and a 0.06 voice fix on 2026-09-28 01:26 UTC); lane V's own file attributes them by
job id, and they are copied here as that merge said they would be.

### Wave 4 · lane V, the rows after the wave-4 merge (from docs/opus-bay/ledger/w4-V.md)

#### Part 2 · Batch 4 · Holy Virgin retake, 4 postcards (W4-V4b, W4-C9 / H-7), 2026-09-27 22:16–22:20 UTC

Balance before: 415.13 (the last spend on the account was this lane's voice batch at 19:29:39 UTC). Holy Virgin: lane L's
lot on Geary Blvd is 2.6–2.9 × 3.0–3.3 u (OSM way 286435447) and the part-1 concept is squat (6.1 × 9.1 × 6.7 u): squeezed
into the lot its onion domes turned into spikes (the gate, `docs/opus-bay/qa/w4/V/v-gate-holy-virgin.jpg`), so a narrow,
tall concept pair (`holy-virgin-tall` in prompts.py; the cathedral stands on "a narrow urban lot", Orthodox Arts Journal).
Postcards: the recipe of the 12 shipped SF postcards (ASSETS-LEDGER T1-1…13: nano_banana_pro 4:3 2k, refs P5
`df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433`, subject + "Full-bleed illustration
… NOT a card, NOT on a mat …" + the look line + the style contract; prompts.py `POSTCARDS`).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-C5a | Holy Virgin tall concept a | nano_banana_pro 1:1 2k, refs K6 + L2-C1 | narrow city lot: tall narrow white body, kokoshniks, red trim, narrow porch, five round gold onion domes; "about three times as tall as it is wide" | 2 | 15da86c6-6765-43fb-b0aa-2d06a0997141 | ai/raw/holy-virgin-tall-a.png | not meshed (still nearly as wide as part 1's) |
| W4V-C5b | Holy Virgin tall concept b | nano_banana_pro 1:1 2k, ref K6 | same | 2 | 1ebf72db-3660-4184-938d-dfca6bb3ad53 | ai/raw/holy-virgin-tall-b.png | **USED** (tallest, round domes, no text, no base) |
| W4V-3D8 | Holy Virgin mesh from C5b | sam_3_3d textured, "the toy cathedral" | — | 1 | 58f802b8-aa4d-41b6-8c5b-5a4010825b0c | ai/raw/holy-virgin-tall-b-sam.glb | **USED** (native 4.94 × 9.1 × 5.52 u, IoU 0.906) |
| W4V-P1 | postcard sf-state-quad | nano_banana_pro 4:3 2k, refs P5 + P13 | the SF State Quad: lawn, students, low concrete buildings, the angled student centre roof, the lake beyond | 2 | 2a9083c4-6649-48e5-ae40-e7083b2e2a77 | postcards/sf-state-quad-a.png | **USED** (read at full size: no signs, no lettering) |
| W4V-P2 | postcard sf-music-concourse | same | the sunken concourse, pollarded plane trees, fountains, the bandshell, the de Young tower, the Academy's living roof | 2 | 9ca0df6e-1f88-4b90-bb56-21fd0b320121 | postcards/sf-music-concourse-a.png | **USED** (the bandshell's cartouche is blank) |
| W4V-P3 | postcard sf-lands-end | same | the cliff trail through wind-bent cypress, hikers, a rocky cove, the Golden Gate Bridge in soft mist | 2 | 0f211b8e-ce67-45de-831a-b3b9febfa624 | postcards/sf-lands-end-a.png | **USED** |
| W4V-P4a | postcard sf-west-portal, draw a | same | a silver-and-red LRV leaving a round-arched tunnel portal onto a shopping street with awnings | 2 | 9d2945b5-fe8b-41ff-9ce7-1411bb762b56 | postcards/sf-west-portal-a.png | rejected (a floating diorama slab on the cream background, the fault of T1-8) |
| W4V-P4b | postcard sf-west-portal, draw b | same + "seen from within the street … fills the whole frame … no floating slab, no base edge, no cream void" | same | 2 | a68d158e-a118-4532-b8d8-3738765ebf00 | postcards/sf-west-portal-b.png | **USED** after a local fix: a logo-like red mark on each car side and a lit display text on the front were painted out (diffusion fill, 1,773 px; `postcards/sf-west-portal-b-clean.png`) |

Transactions 22:16:37 UTC (Nano Banana Pro −2 × 6), 22:18:37 (3D Objects −1), 22:20:16 (Nano Banana Pro −2); no refunds,
no other spend in the window. **Subtotal 15.00.** **Wave-4 lane V total: 55.45 credits** (35.00 + 5.45 part 1, 15.00 part
2) of the 120 cap. Balance 415.13 → **400.13** (`balance`, 2026-09-27 ≈ 22:40 UTC). H-8 (generated SFX): not spent (see
the report).

Published from batch 4 (local post-processing, free): the Holy Virgin GLB (the row above; `specs.json`
`holy-virgin-tall-fit`: the part-1 cleanup + texel re-bake, `--box 2.8,9.1,3.2`), and the postcards (`postcards.py`:
centre-crop to 4:3, 1200 + 600 WebP q82, as the shipped 12):

| file | tris | bytes | size w x h x d (u) | IoU | non-manifold / islands | palette ΔE12 (before -> after) | status |
|---|---|---|---|---|---|---|---|
| postcards/sf-state-quad-1200.webp | - | 71,116 | 1200 x 900 | - | - | - | published; registered at the integration (W4-V-I7: POSTCARD_ART, ASSETS.postcards) |
| postcards/sf-state-quad-600.webp | - | 28,124 | 600 x 450 | - | - | - | published; registered (W4-V-I7) |
| postcards/sf-music-concourse-1200.webp | - | 88,882 | 1200 x 900 | - | - | - | published; registered (W4-V-I7) |
| postcards/sf-music-concourse-600.webp | - | 32,444 | 600 x 450 | - | - | - | published; registered (W4-V-I7) |
| postcards/sf-lands-end-1200.webp | - | 64,372 | 1200 x 900 | - | - | - | published; registered (W4-V-I7) |
| postcards/sf-lands-end-600.webp | - | 27,074 | 600 x 450 | - | - | - | published; registered (W4-V-I7) |
| postcards/sf-west-portal-1200.webp | - | 54,460 | 1200 x 900 | - | - | - | published; registered (W4-V-I7) |
| postcards/sf-west-portal-600.webp | - | 23,064 | 600 x 450 | - | - | - | published; registered (W4-V-I7) |

#### Batch 5 · integration (part a): lane C's line added after the freeze (W4-V-I8), 2026-09-28 01:26 UTC

Balance before: 400.13 (`balance`; newest transaction: this lane's Nano Banana Pro −2 at 2026-09-27 22:20:16 UTC). Lane C's
request (`sf-w4-C.md` part 2, integration step 7): `metro-sfsu-next-2` in `TOUR_LINES_2` ("下一站 Holloway，就是州立大学。" /
"Next stop Holloway — that's SF State.", mood happy), replacing the retired `metro-sfsu-next`. Same recipe as batch 3
(qwen_audio_tts, preset Pixie `0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz, the guide instruction + "Happy and warm,
relaxed."), both speech rates at once. Take list `scripts/opus-sf/voice/w4/takes.ts --set 2`; processed by
`tour_post.py --merge` (only these takes; the 214 committed picks unchanged byte for byte). Preflight `get_cost` 0.01.
Raw wavs: `C:/Users/willy/opus-qa/w4i/i4-v/voice2/raw/<index>.wav`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W4V-VO4a | zh-metro-sfsu-next-2, take 0 | qwen_audio_tts, Pixie, zh, speech_rate 1.0 | 下一站 Holloway，就是州立大学。 | 0.01 | 3638d5a6-3937-4d55-b0de-1d07083f8119 | voice2/raw/0.wav | **USED** (3.55 s, every gate, recogniser right 0.93) |
| W4V-VO4b | zh-metro-sfsu-next-2, take 1 | same, speech_rate 1.08 | same | 0.01 | cc03cdf4-7ab0-42f4-8598-97ef515e3c1e | voice2/raw/1.wav | alternate (3.30 s, passes) |
| W4V-VO4c | en-metro-sfsu-next-2, take 2 | same, en, speech_rate 1.0 | Next stop Holloway — that's SF State. | 0.02 | 2826fc19-4a30-483e-95c3-9896b56cc096 | voice2/raw/2.wav | **USED** (3.70 s, every gate, recogniser right 0.90) |
| W4V-VO4d | en-metro-sfsu-next-2, take 3 | same, speech_rate 1.08 | same | 0.02 | 3bf2058e-b50c-4c9b-867d-c36f22550833 | voice2/raw/3.wav | alternate (3.87 s, passes) |

Transactions 2026-09-28 01:26:32, 01:26:43, 01:26:46, 01:26:49 UTC: Qwen Audio 3.0 TTS Flash −0.01, −0.01, −0.02, −0.02; no
refunds, no other spend in the window. **Subtotal 0.06.** **Wave-4 lane V total: 55.51 credits** of the 120 cap. Balance
400.13 → **400.07** (`balance`, 2026-09-28 ≈ 01:28 UTC).

Published: `public/opus-bay/voice/sf/tour/{zh,en}-metro-sfsu-next-2.{m4a,ogg}` (the report `tour-voice-report.json` holds
bytes and sha256), in `src/opus-bay/data/sf/voiceTour.ts`; previews `docs/opus-bay/qa/w4/V/voice/tour-voice-preview-added-{zh,en}.m4a`.

### Wave 5 · lane V (from docs/opus-bay/ledger/w5-V.md)

Cap **130** credits for wave 5, lane V only (plan §5, lead note §8); **the balance never goes under 250**. Stop rules
(plan §5): reject any draw with text, logos, a base or clipped edges before paying for the next step; two failed models
in a row → no more models; spend past 100 → only H5-1, H5-3 and H5-8 continue. No image of a real person, real insignia,
a real mural or artwork, or a brand. Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account is shared: charges are
attributed by job id and time from `transactions`, never by the balance difference alone.

#### Preflight (part b), 2026-09-28 13:10 UTC

- `balance` **400.07** (ultra), equal to the lead's day-0 reading (2026-09-28 08:37 UTC).
- `transactions` (newest 15 read): nothing since **2026-09-28 01:26:49 UTC** (wave 4's last voice fix) — the wave-5 mark.
- Cost preflight (`get_cost`, free): Qwen Audio 3.0 TTS Flash, a 28-character zh line = **0.02**.

#### Batch 1 · H5-3 voice, the lanes' wave-5 BAYBAY lines (W5-V7), 2026-09-28 13:15–13:31 UTC

Lines: `scripts/opus-sf/voice/w5/lines.ts` over the lanes' sources at `da331c9` (lane A play/, lane C pelican / goals /
flow's two nudges, lane N goToRun, lane D eggs/ + the registry's lines, rumours and fortunes, lane R's fire-season line):
**95 lines × zh / en = 190 clips**. Model `qwen_audio_tts` (Qwen Audio 3.0 TTS Flash), preset "Pixie"
`0178ef57-ada4-43d9-992b-8d9221045bb4` (every BAYBAY clip), wav 48 kHz, speech_rate 1.0, `language` zh / en, instruction
= "Cute otter mascot talking to a friend: warm, cheerful, natural, clear, easy chatty pace." + a mood note from the
line's punctuation (≤ 128 characters). One take per clip; post.py lists the retakes. Every take with its job id, text,
measurements and the pick: `docs/opus-bay/qa/w5/V/voice/w5-voice-report.json`. Raw wavs:
`C:/Users/willy/opus-qa/w5/w5-v/voice/raw/<take index>.wav` (job ids in `jobs.txt` beside them).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO1 | 190 clips (95 lines × zh / en), one take each | qwen_audio_tts, Pixie, speech_rate 1.0, wav 48 kHz | the lanes' fixed bubble lines, verbatim | 4.54 (below) | w5-voice-report.json `takes[].job_id` (190 ids) | voice/raw/0–189.wav | 190 completed; 2 submissions answered 429 (rate limit, nothing charged) and were resubmitted in the last batch (takes 6 and 158) |

Transactions 13:15:10.778–13:31:33.149 UTC: exactly 190 "Qwen Audio 3.0 TTS Flash" spends of 0.01–0.04 (by length),
no refund, no other spend on the account in the window. **Subtotal 4.54 credits** (balance 400.07 → **395.53**,
`balance` at 13:40 UTC, equal to the tally). CDN check: every result is
`d8j0ntlcm91z4.cloudfront.net/user_…/hf_20260928_<hhmmss>_<job id>.wav`; 190 / 190 downloaded (the timestamps from
`jobs_wait`, the rest probed within ±8 s of their batch; 8 needed their exact timestamp from `jobs_wait`).

**Wave-5 lane V running total after batch 1: 4.54 credits.** Balance **395.53**.

#### Batch 2 · H5-2 six 彩蛋明信片 (secret postcards, W5-V8), 2026-09-28 13:44–13:48 UTC

Balance before: 395.53. The recipe of every shipped postcard (ASSETS-LEDGER T1-1…13, wave-4 W4V-P1…P4): nano_banana_pro
4:3 2k, refs P5 `df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433`, subject + "Full-bleed
illustration … NOT a card …" + the look line + the style contract (`scripts/opus-sf/assets/w5/prompts.py` →
`prompts.json`, verbatim). Cost preflight: 2 credits a draw. Served as `nano_banana_2`, billed "Nano Banana Pro". Every
draw read at full size (no text, no letters, no numbers, no logos, no faces; the pennants and stones blank).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-P1a | china-beach-fishermen, draw a | nano_banana_pro 4:3 2k, refs P5 + P13 | China Beach cove at golden hour, two old Chinese fishing junks, the GGB far off | 2 | 0b5be7de-eabe-4def-baed-3d41f4bf608e | postcards/china-beach-fishermen-a.png | rejected (a floating diorama slab with its side edges on the cream void — wave 4's sf-west-portal fault) |
| W5V-P2 | telegraph-hill-parrots | same | the Filbert Steps' gardens, a flock of red-headed green parrots, Coit Tower on top | 2 | 67c26ab7-14d4-4891-9890-e9c4a1224ef6 | postcards/telegraph-hill-parrots-a.png | **USED** |
| W5V-P3 | wave-organ-high-tide | same | the jetty tip's carved stones, benches and short pipes, high-tide splashes, the GGB beyond | 2 | 88affc80-7d52-4052-98b0-5fbda22b6c8c | postcards/wave-organ-high-tide-a.png | **USED** (generic stones and pipes, no copy of the installation) |
| W5V-P4a | lands-end-labyrinth, draw a | same | a ring labyrinth of pale stones on a headland, cypresses, the GGB across the strait | 2 | 80816964-ef15-4a44-9e62-e45cecac4162 | postcards/lands-end-labyrinth-a.png | rejected (the headland on a board whose edge shows) |
| W5V-P5 | dahlia-dell-100 | same | a dahlia bed in full bloom, blank paper pennants, the white Conservatory of Flowers | 2 | 7e4d896a-53c3-490d-a5d9-34e04f69c336 | postcards/dahlia-dell-100-a.png | **USED** (pennants blank at full size) |
| W5V-P6 | ggb-foghorn-duet | same | the two towers and cables above a bank of summer fog, the Marin headlands | 2 | 27dd11b6-2ae3-41ea-a7d5-22c5e2aaa4a6 | postcards/ggb-foghorn-duet-a.png | **USED** |
| W5V-P1b | china-beach-fishermen, draw b | same + "seen from the sand of the cove itself so that the scene fills the whole frame … No floating slab, no base edge, no cream void" | same | 2 | c77ec4c6-80bf-411d-98ab-c8bab14c1ee5 | postcards/china-beach-fishermen-b.png | **USED** |
| W5V-P4b | lands-end-labyrinth, draw b | same + "seen from the cliff path beside it …" + the full-frame line | same | 2 | 96d73e71-c98f-4f1c-ae9c-0ce94554f567 | postcards/lands-end-labyrinth-b.png | **USED** |

Transactions 13:44:16.728–13:44:25.470 UTC (Nano Banana Pro −2 × 6) and 13:48:03.700 / 13:48:04.605 (−2 × 2); no refund,
no other spend in the window. **Subtotal 16.00** (8 draws; the plan's 1.75 × retake factor allowed 21). Local raw files:
`C:/Users/willy/opus-qa/w5/w5-v/postcards/`. Published (free, `scripts/opus-sf/assets/w5/postcards.py`: centre-crop 4:3,
1200 + 600 WebP q82): `public/opus-bay/w5/postcards/<egg id>-{1200,600}.webp` (12 files, 752 KB), listed in
`src/opus-bay/data/sf/eggPostcards.ts`.

#### Batch 3 · H5-3 voice retakes (W5-V7), 2026-09-28 13:57 UTC

The 10 clips whose take missed a gate (1: zh 看，云在慢慢走～, spoken too slowly) or the recogniser (9) after the grammar
fix (post.py `speakable`: a `"` inside the recogniser's command line had broke its whole zh grammar on the first pass),
retaken once at speech_rate 1.08 (take indices 190–199, `jobs_r2.txt`), same model, preset and instruction.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO2 | 10 retakes | qwen_audio_tts, Pixie, speech_rate 1.08 | the same texts | 0.18 | w5-voice-report.json `takes[].job_id` (indices 190–199) | voice/raw/190–199.wav | the picks: see the report |

Transactions 13:57:39.775–13:57:47.144 UTC: 10 "Qwen Audio 3.0 TTS Flash" spends (0.01–0.04), no refund, nothing else
in the window. **Subtotal 0.18.**

**Running total after batch 3: 20.72 credits** (4.54 + 16.00 + 0.18). Balance **379.35** (`balance` at 14:02 UTC, equal to
the tally).

#### Batch 4 · H5-3 voice, the lines frozen since batch 1 (W5-V7), 2026-09-28 14:12–14:18 UTC

After the rebase onto `7319d9e` the inventory found 43 new lines: lane C's frozen table (`data/sf/linesW5.ts` W5_C_LINES,
11 lines with lane C's own `w5c-*` ids, paced by lane C), lane A's part b (the bell riff, the Seward slides, the stair
races: 18), lane D's eggs 13–24 lines and two renamed rumours (11), lane R's single-text lines under R's ids
(`realsf-daily-all`, `realsf-jets-up`, `realsf-jets-photo`). 86 takes, same recipe (work dir
`C:/Users/willy/opus-qa/w5/w5-v/voice2/`). One 429 (take 37) resubmitted with the last group.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO3 | 86 clips (43 lines × zh / en) | qwen_audio_tts, Pixie, speech_rate 1.0 | the new lines, verbatim | 1.65 | w5-voice-report.json `takes[].job_id` (batch 2) | voice2/raw/0–85.wav | 86 completed |
| W5V-VO4 | 8 retakes | same, speech_rate 1.08 | the takes that missed a gate (2) or the recogniser (6) | 0.10 | same (indices 86–93) | voice2/raw/86–93.wav | 7 picked; `en-w5-a-2fe95a24` ("Me first! Again?", 1.4 words / s both times) stays muted in W5_VOICE_CHECK until the owner approves it |

Transactions 14:12:51.872–14:18:05.992 UTC: 86 "Qwen Audio 3.0 TTS Flash" spends (1.65); 14:23:24.607–14:23:29.854: 8
spends (0.10); no refund, nothing else on the account in the windows. **Subtotal 1.75.** Seven batch-1 lines no source
says any more (lane C's five now carry lane C's ids; two lane-D rumours renamed 地之角 → 天涯海角, 16 街 → 第 16 大道) were
retired by post.py: out of the table, their 28 files deleted, kept in the report's `retired` block with their job ids.

**Running total after batch 4: 22.47 credits.** Balance **377.60** (`balance` at 14:35 UTC, equal to the tally).

#### Batch 5 · H5-3 voice, lines the first filter missed (W5-V7), 2026-09-28 14:32 UTC

The inventory's speaker rule read any short "xx：" opening as another speaker, so the seven cookie fortunes (今日签：…) and
lane A's 滑梯现在没开：… had been left out, and one-word calls (跑！) were under its length floor; lane R's SOFT_BOX_LINE
(我们在旁边看就好～, said by lane F's glide soft box) was not in its source list. The rule now names the speakers, and the
rate gate treats a one- or two-word call by its length (≤ 1.5 s). 10 lines, 20 takes (work dir `voice3/`).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO5 | 20 clips (10 lines × zh / en) | qwen_audio_tts, Pixie, speech_rate 1.0 | the lines above, verbatim | 0.43 | w5-voice-report.json `takes[].job_id` (batch 3) | voice3/raw/0–19.wav | 20 completed, 20 pass the gates (en "Go!" not recognised: advisory) |

Transactions 14:32:30.647–14:32:51.600 UTC: 20 "Qwen Audio 3.0 TTS Flash" spends, no refund, nothing else in the window.
**Subtotal 0.43.**

**Wave-5 lane V total: 22.90 credits** (4.54 + 16.00 + 0.18 + 1.75 + 0.43) of the 130 cap. Balance 400.07 → **377.17**
(`balance` at 14:45 UTC, equal to the tally). Voice in all (H5-3): 6.90 of the plan's 9 expected; H5-2 16 of 21.

#### Batch 6 · H5-3 voice, the lanes' part-c lines (W5-V7, part c), 2026-09-28 20:51–21:52 UTC

Balance before: **377.17** (`balance` at 20:50 UTC). Lines: `scripts/opus-sf/voice/w5/lines.ts` on `2506d3c4` + lane D's
batch 2 (`508d4f06`, eggs 25–33): **53 lines × zh / en = 106 clips** (report batch 4) — lane A's marshmallow and fire-ring
lines (13), lane D's pebbles, city sounds, batch-2 eggs and the renamed Wave Organ rumour (26), lane E's 12 `E_LINES`
under lane E's own ids `e-<key>` (lane E plays them with its `voice-line` event) and one shop line. The inventory now
skips paper under `riddle` / `how` / `name` / `hint` … keys (lane D's city-sound riddles and hints) and three lane-A button
labels. Same recipe as batch 1 (Pixie, wav 48 kHz, speech_rate 1.0, the bubble instruction + mood); work dir `voice4/`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W5V-VO6 | 106 clips (53 lines × zh / en), one take each | qwen_audio_tts, Pixie, speech_rate 1.0 | the lanes' fixed bubble lines, verbatim | 1.92 | w5-voice-report.json `takes[].job_id` (batch 4) | voice4/raw/0–105.wav | 106 completed after 5 re-runs (jobs 3, 48, 63, 64, 68 failed and were refunded; 3 submissions hit a 429 and created no job) |
| W5V-VO7 | 18 retakes | same, speech_rate 1.08 (14) then 1.15 (4) | the clips that missed a gate (8) or the recogniser (6) | 0.25 | same (indices 106–123) | voice4/raw/106–123.wav | 6 of 8 gate misses fixed; `zh-e-bought` (好看！买下啦。) and `en-w5-a-dbc137fe` (Golden! Crisp outside, gooey inside!) stay muted until the owner's ear |

Transactions 20:51:06.917–21:01:14.092 UTC: 111 "Qwen Audio 3.0 TTS Flash" spends and 5 refunds (the 5 failed jobs),
nothing else on the account in the window: **net 1.92**. 21:43:49.537–21:44:05.463 UTC: 14 spends (0.20); 21:52:17.445–
21:52:17.932 UTC: 4 spends (0.05). **Subtotal 2.17.** CDN check: every pick is
`d8j0ntlcm91z4.cloudfront.net/user_…/hf_20260928_<hhmmss>_<job id>.wav` (the timestamps from `jobs_wait`), 124 / 124
downloaded. Balance **375.00** (`balance` at 21:53 UTC, equal to the tally).

**Wave-5 lane V total: 25.07 credits** (22.90 + 2.17) of the 130 cap. Balance 400.07 → **375.00**. Voice in all (H5-3):
9.07 of the plan's 9 expected (15 worst); H5-2 16 of 21. Nothing else spent in part c (H5-1 shop tiles not made:
Decisions in the report).

### Balance trail and reconciliation (wave-5 merge, 2026-09-29 ≈ 04:10 UTC)

| step | charges (`transactions`, UTC) | credits | balance after |
|---|---|---|---|
| wave-4 merge (above) | — (its trail already holds wave 4's 15.00 of 2026-09-27 22:16–22:20, now attributed: W4V-C5a, C5b, 3D8, P1, P2, P3, P4a, P4b) | — | 400.13 (`balance` 2026-09-27 ≈ 22:25) |
| wave 4 · V batch 5 (W4V-VO4a–d, the Holloway line) | Qwen Audio 3.0 TTS Flash −0.01, −0.01, −0.02, −0.02 (2026-09-28 01:26:32–01:26:49) | 0.06 | 400.07 (`balance` 08:37, the lead's day 0) |
| wave 5 · V batch 1 voice (W5V-VO1) | 190 Qwen Audio 3.0 TTS Flash spends (13:15:10.778–13:31:33.149), no refund | 4.54 | 395.53 (`balance` 13:40) |
| wave 5 · V batch 2 secret postcards (W5V-P1a … P4b) | Nano Banana Pro −2 × 6 (13:44:16.728–13:44:25.470), −2 × 2 (13:48:03.700, 13:48:04.605) | 16.00 | 379.53 |
| wave 5 · V batch 3 voice retakes (W5V-VO2) | 10 TTS spends (13:57:39.775–13:57:47.144) | 0.18 | 379.35 (`balance` 14:02) |
| wave 5 · V batch 4 voice (W5V-VO3, VO4) | 86 TTS spends (14:12:51.872–14:18:05.992, 1.65), 8 (14:23:24.607–14:23:29.854, 0.10) | 1.75 | 377.60 |
| wave 5 · V batch 5 voice (W5V-VO5) | 20 TTS spends (14:32:30.647–14:32:51.600) | 0.43 | 377.17 (`balance` 14:45) |
| wave 5 · V batch 6 voice, part c (W5V-VO6, VO7) | 111 TTS spends + 5 refunds (20:51:06.917–21:01:14.092, net 1.92), 14 (21:43:49.537–21:44:05.463, 0.20), 4 (21:52:17.445–21:52:17.932, 0.05) | 2.17 | 375.00 (`balance` 21:53) |
| after lane V's last batch (the reviews, W5-Z, this merge) | none | 0 | **375.00** (`balance` 2026-09-29 ≈ 04:07 UTC, plan `ultra`) |

Reconciliation: `transactions` read newest first at this merge. The newest charge on the account is
2026-09-28 21:52:17.931834 UTC (lane V's last retake), so nothing was spent after lane V's last batch; the page that spans
batch 5 and batch 6 holds nothing between 14:32:51.600 and 20:51:06.917 UTC; lane V's preflight found nothing between
wave 4's 01:26:49 and 13:10 UTC. One timing note: lane V's batch-4 paragraph dates its `balance` reading of 377.60 "at
14:35 UTC", but batch 5's first spend is at 14:32:30.647, so that reading was taken before 14:32:30 (the numbers agree:
377.60 − 0.43 = 377.17, the reading at 14:45). Sum check: 400.07 − 375.00 = **25.07** = 4.54 + 16.00 + 0.18 + 1.75 +
0.43 + 2.17.

**Wave 4 final: 55.51 credits**, all lane V (the 15.00 pending at the wave-4 merge are its part-2 batch 4, the 0.06 its
batch 5). **Wave 5 total: 25.07 credits** of the 130 cap (H5-2 secret postcards 16.00, H5-3 voice 9.07; H5-1 shop tiles,
H5-4 reference sheets, H5-5 textures, H5-6 models, H5-7 SFX and the H5-8 reserve 0). Balance **375.00**. Whole-SF round:
250.20 (to the end of wave 2) + 42.70 (wave 3) + 55.51 (wave 4) + 25.07 (wave 5) = **373.48 credits**.

## Wave 6 (local)

Merged verbatim from `docs/opus-bay/ledger/w6-X.md` by the lead at the wave-6 hand-off (2026-09-29 ≈ 07:00 PDT). Wave-6 cap 1000 (owner), lane X only; spent **15.70** (postcards 10.00 · voice 1.70 · key art 4.00); balance 2375 → **2359.30**. Whole-SF round: 373.48 (waves 1–5) + 15.70 = **389.18 credits**.

### Wave 6 · lane X (from docs/opus-bay/ledger/w6-X.md)

Cap **1000** credits for wave 6, lane X only (lead note `sf-w6-lead.md` §1 / §3 / §6, owner-approved); **the balance
never goes under 1375**. A generated asset ships only if it beats what is there (side by side). Rules as wave 5
(`ledger/w5-V.md`): reject any draw with text, logos, a base or clipped edges before paying for the next step; no image of
a real person, real insignia, a real mural or artwork, or a brand. Columns as `src/opus-bay/ASSETS-LEDGER.md`. The account
is shared: charges are attributed by job id and time from `transactions`, never by the balance difference alone.

#### Preflight, 2026-09-29 08:55 UTC

- `balance` **2375** (ultra), equal to the lead's day-0 reading (2026-09-29 08:36 UTC: a 2000 "Credit Reset Bonus" on 375).
- `transactions` (newest 10 read): nothing after the grant at **2026-09-29 08:36:21 UTC** — the wave-6 mark (the last
  spend before it: wave 5's batch-4 TTS at 2026-09-28 21:52:17 UTC).
- Nano Banana Pro: 2 credits a draw at 2k (wave 5's preflight; confirmed by the charges below).

#### Batch 1 · the Halloween postcard set (W6-X2), 2026-09-29 08:57–09:00 UTC

Balance before: 2375. The recipe of every shipped postcard (ASSETS-LEDGER T1-1…13, W4V-P1…P4, W5V-P1…P6):
nano_banana_pro 4:3 2k, refs P5 `df659275-cf2a-4352-8166-1934f9945e0f` + P13 `d756b0c4-46f1-4761-9e58-0d5d78bc2433`,
subject + no-text line + full-frame line + FULL_BLEED + LOOK + the style contract with its light set to "warm glowing lantern
light in a soft blue dusk" (`scripts/opus-sf/assets/w6/prompts.py` → `prompts.json`, verbatim). Served as `nano_banana_2`,
billed "Nano Banana Pro". Every draw read at full size (no letters, numbers or logos; no human faces; candy wrappers
patterned only).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W6X-P1 | halloween-pumpkin-hunt | nano_banana_pro 4:3 2k, refs P5 + P13 | a park hill heaped with smiling jack-o'-lanterns at dusk, paper lanterns, Victorians and the city beyond, bats | 2 | 143b96dc-0bd4-468f-9757-fb98b7548b9a | raw/halloween-pumpkin-hunt-a.png | **USED** |
| W6X-P2 | halloween-trick-or-treat | same | a Victorian stoop, orange porch light, candy bowl, three jack-o'-lanterns, witch hat + ghost sheet on the railing | 2 | 686f114a-2f38-433e-aad7-fb0721970987 | raw/halloween-trick-or-treat-a.png | **USED** |
| W6X-P3a | halloween-big-night, draw a | same | the Painted Ladies on Halloween night, jack-o'-lanterns on every stoop, moon, bats, trick-or-treaters from behind | 2 | 92eefaaa-4c5a-4a98-9829-b55275134234 | raw/halloween-big-night-a.png | rejected (the blue night backdrop ends in a cut edge on the cream void at the right; the slab's front edge shows) |
| W6X-P4 | muertos-mission | same | a small community altar under marigold arches in the Mission, candles, bread, fruit, sugar skulls, papel picado | 2 | 965a37dc-11eb-45db-b26d-1989adda9396 | raw/muertos-mission-a.png | **USED** (banners' cut patterns only; the altar's small frame holds a candle) |
| W6X-P3b | halloween-big-night, draw b | same + "seen from the grass of the park hill itself … the night sky fills the whole top of the frame … no backdrop edge" (`prompts.json` `retakes`) | same | 2 | f65fac80-bb2e-4d56-82bb-fe914a80bdd6 | raw/halloween-big-night-b.png | **USED** |

Transactions 08:57:47.673 / 47.920 / 48.204 / 48.851 UTC (Nano Banana Pro −2 × 4) and 09:00:14.256 (−2); no refund, no other
spend in the window. **Subtotal 10.00** (balance 2375 → **2365**, `balance` at 09:02 UTC, equal to the tally). Local raw
files: `C:/Users/willy/opus-qa/w6/x/raw/`. Published (free, `scripts/opus-sf/assets/w6/postcards.py`: centre-crop 4:3, 1200
+ 600 WebP q82): `public/opus-bay/w6/postcards/<id>-{1200,600}.webp` (8 files, 501 KB), listed in
`src/opus-bay/data/sf/halloweenPostcards.ts`.

**Wave-6 lane X running total after batch 1: 10.00 credits.** Balance **2365**.

#### Batch 2 · BAYBAY's Halloween voice (W6-X4), 2026-09-29 10:26–10:53 UTC

Balance before: 2365. Lines: `scripts/opus-sf/voice/w6/lines.ts` over lane G's `halloween/lines.ts` (22 lines, `w6g-*`,
commit W6-G1) and lane H's `halloween/worldLines.ts` (18 lines, `w6-h-*`, commit W6-H1): **40 lines × zh / en = 80
clips**. Model `qwen_audio_tts` (Qwen Audio 3.0 TTS Flash), preset "Pixie" `0178ef57-ada4-43d9-992b-8d9221045bb4` (wave 5's
BAYBAY voice), wav 48 kHz, speech_rate 1.0, `language` zh / en, instruction = W5-V7's "Cute otter mascot talking to a friend:
warm, cheerful, natural, clear, easy chatty pace." + a mood note (Halloween fun / cosy-spooky / a local fact / gentle and
respectful for the Día de los Muertos lines). One take per clip; the post (W5-V7's chain) asked for one retake. Every take
with its job id, text, measurements and the pick: `docs/opus-bay/qa/w6/X/voice/w6-voice-report.json`; raw wavs
`C:/Users/willy/opus-qa/w6/x/voice/raw/<take index>.wav` (job ids in `jobs1.txt`, `jobs2.txt` beside them).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W6X-VO1 | 80 clips (40 lines × zh / en), one take each | qwen_audio_tts, Pixie, speech_rate 1.0, wav 48 kHz | lanes G / H's fixed bubble lines, verbatim | 1.68 (below) | w6-voice-report.json `takes[].job_id` (80 ids) | voice/raw/0–79.wav | 80 completed, 79 through the gates; 4 submissions answered 429 (rate limit, nothing charged) and were resubmitted (takes 24, 30, 32, 35) |
| W6X-VO2 | zh-w6g-costume-witch retakes (take 32 read 2.1 characters / s, the rate gate) | same, speech_rate 1.1 / 1.2 | 我像不像一个小女巫？ | 0.02 | 075adb38-6651-4eac-942a-e03f7609c081 (80), 625b129d-7312-44fc-8d9a-ef429b3daca3 (81) | voice/raw/80.wav, 81.wav | take 81 (rate 1.2) **USED** (2.6 characters / s, passes); 80 rejected (rate) |

Transactions 10:26:26.511–10:52:42.574 UTC: exactly 82 "Qwen Audio 3.0 TTS Flash" spends of 0.01–0.05 (by length), no
refund, no other spend on the account in the window. **Subtotal 1.70 credits** (balance 2365 → **2363.30**, `balance` at
10:58 UTC, equal to the tally). CDN: every result is `d8j0ntlcm91z4.cloudfront.net/user_…/hf_20260929_<hhmmss>_<job id>.wav`,
the timestamps from `jobs_wait`; 82 / 82 downloaded.

**Wave-6 lane X running total after batch 2: 11.70 credits.** Balance **2363.30**.

#### Batch 3 · the Halloween key art for the title (W6-X6), 2026-09-29 11:17 UTC

Balance before: 2363.30. An edit of the shipped key art (ASSETS-LEDGER K7 `33cf7b82-f9b5-4656-a8e8-96a2e663ebcb` wide, K4
`e8a213b0-c81d-44a0-b476-165c60373ce8` tall, passed as the image reference): "keep everything else exactly the same … add
only jack-o'-lanterns, a tiny witch hat on the otter, orange string lights in the palms, a few friendly bats, a warm dusk
glow on the diorama; no text" (the full prompt: `scripts/opus-sf/assets/w6/keyart.md`). nano_banana_pro 16:9 / 9:16 2k.
Read at full size: the composition and the empty title area match the shipped art (side by side: `qa/w6/X/x6-keyart-*`).

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W6X-K1 | key art wide, Halloween | nano_banana_pro 16:9 2k, ref K7 | the shipped wide key art + jack-o'-lanterns, witch hat, lights, bats, dusk glow | 2 | 9489bb25-d793-49f1-836c-3284afcd17f1 | raw/key-wide-halloween-a.png | **USED** → `w6/art/key-wide-halloween-{1920,1280}.webp` |
| W6X-K2 | key art tall, Halloween | nano_banana_pro 9:16 2k, ref K4 | same, on the tall art | 2 | 50d48075-715d-4200-9ff4-073a455dcf55 | raw/key-tall-halloween-a.png | **USED** → `w6/art/key-tall-halloween-{1080,720}.webp` (the diorama sits ≈ 4 % lower than the shipped tall art; the text panel still covers only cream and the plaza's edge) |

Transactions 11:17:54.394 / 54.828 UTC (Nano Banana Pro −2 × 2); no other spend in the window. **Subtotal 4.00** (balance
2363.30 → **2359.30**, `balance` at 11:29 UTC). Published (free, `scripts/opus-sf/assets/w6/keyart.py`: exact 16:9 / 9:16
centre crop, WebP q80): 4 files, 268 KB.

**Wave-6 lane X running total after batch 3: 15.70 credits.** Balance **2359.30** (cap 1000, floor 1375: far inside).

## Wave 7 (local)

Merged verbatim from `docs/opus-bay/ledger/w7-X.md` and `docs/opus-bay/ledger/w7-V.md` at the wave-7 hand-off (2026-09-30 ≈ 03:40 PDT). The owner's rules this wave: cap 800 for lane X with a floor of 1400 at day 0; from 20:35 PDT no cap (lanes X and V, a reserve of 200); from 23:15 PDT lanes X and V stop below a balance of 1900 (up to 1800 credits reserved for two BAYLINK promo videos after the go-live). Spent **33.63** (lane V 30.00: particle sprites + plush textures 24.00, the de Young tower 6.00; lane X 3.63: voice batch 1 1.99, batch 2 1.64); balance 2247.50 → **2213.87**. Lane R's three texture recolours (0 credits) are recorded in their rows W3-LM6 / LM7 / LM8 above. Whole-SF round: 389.18 (waves 1–6) + 33.63 = **422.81 credits**.

### Wave 7 · lane X (from docs/opus-bay/ledger/w7-X.md)

Cap **800** credits for wave 7, lane X only (lead note `sf-w7-lead.md` §1 / §3 / §6); **the balance never goes under
1400**. A generated asset ships only if a side-by-side shot beats what is there. Rules as waves 5–6 (`ledger/w6-X.md`):
reject any draw with text, logos, a base or clipped edges before paying for the next step; no image of a real person,
real insignia, a real mural or artwork, or a brand. The account is shared: charges are attributed by job id and time from
`transactions`, never by the balance difference alone.

#### Preflight, 2026-09-30 04:31 UTC (2026-09-29 21:31 PDT)

- `balance` **2223.5** (ultra). The lead's day-0 reading was 2247.5 (2026-09-29 20:10 PDT = 03:10 UTC).
- `transactions` (newest 20 read): **12 × "Nano Banana Pro" −2 at 2026-09-30 03:50:45.50–03:50:46.62 UTC** (= 24.00
  credits, 20:50 PDT) — **not lane X** (this lane had submitted nothing by then; its first job is below). Before them:
  8 × "Kling v3.0" −8.75 at 00:05 UTC (before wave 7's day 0, already in the lead's 2247.5). Both are other work on the
  shared account; they are listed here only so the balance reconciles.
- Wave-7 lane X running total before its first batch: **0.00**. Floor 1400 → lane X may spend at most 800 (cap).

**Correction (00:25 PDT):** the 12 × Nano Banana Pro at 03:50 UTC (24.00) are **lane V's** batch 1 (`ledger/w7-V.md`,
"balance 2247.5 → 2223.5"), not other work outside the wave.

#### Batch 1 · BAYBAY's voice, the lines no batch had (W7-X2), 2026-09-30 04:54–06:05 UTC

Balance before: 2223.5 (04:31 UTC). Model `qwen_audio_tts` (Qwen Audio 3.0 TTS Flash), preset "Pixie"
`0178ef57-ada4-43d9-992b-8d9221045bb4`, wav 48 kHz, W5-V7's instruction + a mood note, speech_rate 1.0 (retakes 1.0 / 1.1).
Lines: `scripts/opus-sf/voice/w7/lines.ts` (50 lines × zh / en = 100 clips) + 22 retake takes of 11 wave-6 clips. Every
take with its job id, text, measurements and the pick: `docs/opus-bay/qa/w7/X/voice/w7-voice-report.json`; job ids
`C:/Users/willy/opus-qa/w7/x/voice/jobs1.txt`, `jobs2.txt`; raw wavs `…/voice/raw/<index>.wav`.

| # | asset | model / settings | prompt summary | credits | job id | local raw file | status |
|---|---|---|---|---|---|---|---|
| W7X-VO1 | 100 clips (50 lines × zh / en) | qwen_audio_tts, Pixie, rate 1.0 | the lanes' fixed bubble lines, verbatim | 0.01–0.05 each | w7-voice-report.json `takes[].job_id` | raw/0–99.wav | 100 used (93 pass the gates, 7 muted: W7_VOICE_CHECK) |
| W7X-VO2 | 22 retake takes (11 wave-6 clips × 2) | same, rate 1.0 / 1.1 | the wave-6 texts, verbatim | 0.01–0.05 each | same | raw/100–121.wav | 3 replace wave 6 (zh-w6g-street-fair-oaks, zh-w6-h-hunt-all, en-w6-h-hunt-20), 8 rejected (wave 6 stays) |
| — | 27 jobs the service failed ("failed", refunded) + 10 submissions answered 429 (nothing charged) | — | — | refunded | jobs1 / jobs2 | — | resubmitted (jobs2.txt) |

#### Batch 2 · wave 7's new lines (W7-X3), 2026-09-30 06:47–06:56 UTC

76 takes: 38 lines × zh / en — lane W2's hide & seek `被你找到啦！`, 放风筝 and 那是什么？ lines (play/), lane G's
`W7_HALLOWEEN_LINES` (2), lane H's `W7_WORLD_LINES` (9), lane S's four own lines (`realsf-calendar-*`, `realsf-jets-blue`).
Same model and voice; the Día de los Muertos / procession and the Alcatraz sunrise lines with "Soft, gentle and
respectful." Job ids `…/voice/jobs3.txt`; 7 submissions answered 429 and were resubmitted; 0 failed jobs.

**Reconciliation (00:25 PDT):** `balance` **2213.87**. `transactions` (newest 200 read) shows, after 03:50 UTC, only
"Qwen Audio 3.0 TTS Flash" rows (spend 0.01–0.05, and refunds for the failed jobs) from 04:54 to 06:56 UTC — lane X's —
plus whatever lane V spent after its batch 1 (its own ledger). Lane X's net TTS spend is ≈ 3–4 credits (≈ 235 charged
takes at 0.01–0.05, minus the refunds); the exact row-by-row sum and the split against `ledger/w7-V.md` is left to the
hand-off (Requests). **Wave-7 lane X running total ≈ 4 credits**, far under the cap; balance ≫ floor 1400.

### Wave 7 · lane V (from docs/opus-bay/ledger/w7-V.md)

Lane V (models, characters, vehicles, effects), worktree `C:/Users/willy/wt/w7-v`. The owner (2026-09-29 ≈ 20:30 PDT):
"尽情用 higgsfield 上能用的工具，分数随便用" — no cap; a practical reserve of 200 credits stays. Lane X spends in parallel
with its own ledger (`ledger/w7-X.md`), so the account balance below can drop by more than this lane's rows; the per-job
credits are the authoritative tally for lane V. Raw downloads: `C:/Users/willy/opus-qa/w7/v/raw/`.
Output base URL: `https://d8j0ntlcm91z4.cloudfront.net/user_3GeGz2pt6e7qQoBduIsGSY4Xu4Q/` + the file name.

#### Balances

| when (UTC) | balance | note |
|---|---|---|
| 2026-09-30 03:40 | 2247.50 | lane start (20:40 PDT) |
| 2026-09-30 03:50 | 2247.50 | before batch 1 |

#### Batch 1 · particle sprites and a plush texture (nano_banana_pro, 1:1 1k, 2 credits each; preflight 2)

Prompt frame for the sprites: "A single hand-painted white gouache game-effect sprite, centered, on a pure flat black
background (#000000): <subject>. Soft painterly brush texture with visible bristle strokes …, like a charming handcrafted
toy-diorama video game. The shape fills about 70–80% of the frame with an even black margin all around. Monochrome white
only on black. No text, no letters, no logos, no watermark, no border, no drop shadow."

| # | UTC | job | subject | credits | output file | local | verdict |
|---|---|---|---|---|---|---|---|
| V1 | 03:50 | fee442c4 | four-pointed star glint | 2 | hf_20260930_035045_fee442c4-f305-48ac-9395-bb17ae013f54.png | raw/s0-star.png | kept: atlas cell star |
| V2 | 03:50 | b284cf5a | billowing dust puff | 2 | hf_20260930_035045_b284cf5a-4f0c-48c4-8aed-4a292382c184.png | raw/s1-puff.png | kept: atlas cell cloud |
| V3 | 03:50 | 3f75d704 | water droplet | 2 | hf_20260930_035045_3f75d704-083e-4ead-bc11-e2ea0b7ed8c1.png | raw/s2-drop.png | kept: atlas cell droplet |
| V4 | 03:50 | ea84c459 | foam ring from above | 2 | hf_20260930_035045_ea84c459-d70b-4c5a-b953-243a0ad57581.png | raw/s3-foam.png | kept: atlas cell foam |
| V5 | 03:50 | ea729d6d | fog wisp | 2 | hf_20260930_035045_ea729d6d-204c-4da5-aa24-96f69c97a857.png | raw/s4-wisp.png | kept: atlas cells puff + wisp (dark-grey ground levelled) |
| V6 | 03:50 | da4924f6 | heart | 2 | hf_20260930_035045_da4924f6-8707-4985-ab6f-9c59fc792e9d.png | raw/s5-heart.png | kept: atlas cell heart |
| V7 | 03:50 | 79aa08f9 | music note | 2 | hf_20260930_035045_79aa08f9-6015-43da-a9f6-3aa6f1319792.png | raw/s6-note.png | kept: atlas cell note |
| V8 | 03:50 | cfafa074 | confetti curl | 2 | hf_20260930_035045_cfafa074-eb53-4a2f-b579-9cab03045ea0.png | raw/s7-confetti.png | kept: atlas cell confetti |
| V9 | 03:50 | fcdecca9 | light glow / flare | 2 | hf_20260930_035045_fcdecca9-c6b2-483e-9889-976f88e7857b.png | raw/s8-flare.png | kept: atlas cell flare |
| V10 | 03:50 | 3eb56fe8 | leaf | 2 | hf_20260930_035045_3eb56fe8-d62b-437f-9299-5e69315740ae.png | raw/s9-leaf.png | kept: atlas cell leaf |
| V11 | 03:50 | b9a5fe99 | tileable felt (plush toy) | 2 | hf_20260930_035045_b9a5fe99-001a-47cf-a3e2-f173398de41e.png | raw/t0-felt.png | kept: `public/opus-bay/w7v/felt.webp` (W7-V3, `felt.py`: high-passed, seamless, 256²) — *verdict filled in by the W7-V-review* |
| V12 | 03:50 | 3a81a0aa | tileable minky plush | 2 | hf_20260930_035046_3a81a0aa-9739-4a90-a84b-563828ec44f7.png | raw/t1-plush.png | not shipped: W7-V3 uses V11 alone (`felt.py` reads only `t0-felt.png`); no side-by-side of V12 was recorded — *verdict filled in by the W7-V-review* |

Batch 1 subtotal: 24 credits.

#### Batch 2 · the de Young's Hamon tower (W7-V4; lane R's scorecard #22)

Balance before: 2223.50 (03:55 UTC, after batch 1). Concept prompts: the wave-4 landmark recipe
(`scripts/opus-sf/assets/w4/prompts.py`: PRE_A + subject + ADDON + colours; refs K6 `3617006b` and the rotunda concept
`fba12f36` for a, K6 only + the style contract for b). SAM 3 3D prompt: "the twisted copper tower" / "the brown tower".

| # | UTC | job | tool / model | credits | output file | local | verdict |
|---|---|---|---|---|---|---|---|
| V13 | 04:44 | e684912e | nano_banana_pro 1:1 2k, refs K6 + rotunda | 2 | hf_20260930_044455_e684912e-e9a4-4df7-b084-7e228d6c734e.png | raw/dy-a.png | kept: the concept (twist, perforated + dimpled copper, glass top) |
| V14 | 04:44 | 63b4fc5d | nano_banana_pro 1:1 2k, ref K6 | 2 | hf_20260930_044455_63b4fc5d-6f96-4dfc-8ce7-f67b5e3ebaae.png | raw/dy-b.png | rejected: a square shaft, not the slab |
| V15 | 04:47 | 3b46e279 | sam_3_3d on V13 | 0 (failed: no object; −1 at 04:47:06, refunded +1 at 04:47:08) | — | — | failed |
| V16 | 04:47 | f066422b | sam_3_3d on V14 | 1 | hf_20260930_044713_f066422b-4d0c-4265-8b74-565692cd3287.glb | ai/raw/dy-b-sam.glb | rejected with V14 |
| V17 | 04:48 | d81df52a | sam_3_3d on V13 ("the brown tower") | 1 | hf_20260930_044801_d81df52a-f10c-4868-a6c5-c3cf9089f900.glb | ai/raw/dy-a-sam.glb | kept → `public/opus-bay/models/sf/w7v-de-young-tower.glb` (cleanup v2: box 4.3 × 11.15 × 2.6, 3,920 tris, 101,296 B; v1 at the mesh's own 3.45 depth read as a fat block and was not shipped) |

Balance after: 2217.13 (05:02 UTC; lane X's voice jobs run in parallel, so the drop is not all this batch).

Balance at 06:25 UTC (23:25 PDT): 2215.51 (lane X's voice jobs included).

#### Reconciliation (`transactions`, read 2026-09-30 06:30 UTC)

Lane V's charges are the only "Nano Banana Pro" and "3D Objects" rows since 03:40 UTC (lane X's are "Qwen Audio 3.0 TTS
Flash"): 12 × Nano Banana Pro −2 at 03:50:45–46 (batch 1 = 24), 2 × Nano Banana Pro −2 at 04:44:56 (V13, V14 = 4), 3D
Objects −1 04:47:06 / +1 refund 04:47:08 (V15) / −1 04:47:13 (V16) / −1 04:48:01 (V17) (= 2). **Lane V total: 30.00
credits** (batch 1 24 + batch 2 6), every row above accounted for; no other lane-V job.

#### Review check (W7-V-review, `transactions` read 2026-09-30 07:35 UTC)

Re-read by the reviewer, three pages back to 2026-09-29 11:17 UTC: since 03:40 UTC the only non-TTS rows are the 14 ×
Nano Banana Pro −2 (03:50:45–46 × 12, 04:44:56 × 2) and the four 3D Objects rows (−1 04:47:06, +1 refund 04:47:08, −1
04:47:13, −1 04:48:01); everything after 04:48 is lane X's Qwen Audio 3.0 TTS Flash. **Lane V = 30.00 credits, as
recorded.** The two V11 / V12 rows had "see part b" as their verdict; filled in above.

### Balance trail and reconciliation (wave-7 merge, 2026-09-30 ≈ 10:35 UTC)

| step | charges (`transactions`, UTC) | credits | balance after |
|---|---|---|---|
| wave 6 end (above) | — | — | 2359.30 (`balance` 2026-09-29 11:29) |
| other work on the shared account between the waves (not Opus Bay) | Seed Audio 1.0 × 13 (2026-09-29 20:10:12.370–20:47:12.089, 25.80), Outpaint −2 × 8 (2026-09-30 00:00:42.753–00:00:57.465, 16.00), Kling v3.0 −8.75 × 8 (00:05:29.319–00:05:43.436, 70.00) | 111.80 | 2247.50 (`balance` 2026-09-30 03:10, the lead's day 0 = 20:10 PDT) |
| wave 7 · V batch 1 (V1–V12) | Nano Banana Pro −2 × 12 (03:50:45.503–03:50:46.618) | 24.00 | 2223.50 (`balance` 04:31, lane X's preflight) |
| wave 7 · V batch 2 (V13–V17) | Nano Banana Pro −2 × 2 (04:44:56.027, 04:44:56.176); 3D Objects −1 (04:47:06.035), +1 refund (04:47:08.546), −1 (04:47:13.571), −1 (04:48:01.417) | 6.00 | 2217.50 |
| wave 7 · X batch 1 (W7X-VO1, VO2) | Qwen Audio 3.0 TTS Flash spends and the failed jobs' refunds (04:54:09.649–06:04:42.959) | 1.99 | 2215.51 (`balance` 06:25, lane V's reading) |
| wave 7 · X batch 2 (W7-X3) | 76 Qwen Audio 3.0 TTS Flash spends, no refund (06:47:47.924–06:55:48.084), summed row by row | 1.64 | 2213.87 (`balance` 07:25, lane X's reconciliation; again ≈ 10:30, plan ultra) |

Reconciliation: `transactions` read newest first at this merge (three pages of 100, back to 2026-09-29 11:17 UTC). The
newest charge on the account is 2026-09-30 06:55:48.084774 UTC (lane X's last take): nothing was spent after the lanes.
Since the day-0 reading the only rows that are not TTS are lane V's 14 Nano Banana Pro and 4 3D Objects rows (as the
W7-V-review found at 07:35 UTC), and the first TTS row is lane X's first take at 04:54:09.649 — so every row of the wave
is lane V's or lane X's. Lane X's ledger left its exact sum open ("≈ 3–4"): batch 2's 76 rows add up to 1.64 (= 2215.51 −
2213.87), and batch 1 is 2217.50 − 2215.51 = 1.99 (spends minus the refunds of the 27 failed jobs; the 10 + 7 answers 429
charged nothing). Sum check: 2247.50 − 2213.87 = **33.63** = 24.00 + 6.00 + 1.99 + 1.64.

**Wave 7 total: 33.63 credits** (lane V 30.00, lane X 3.63) — far under every limit. Balance **2213.87**: the promo
reserve (up to 1800) is untouched; the game lanes' floor stays 1900 until the promo videos are made.

## Wave 8 (local)

Merged verbatim from `docs/opus-bay/ledger/w8-X.md` at the wave-8 hand-off (2026-10-01 ≈ 05:10 PDT). Lanes W1 and W2 (caps 40 / 60) generated nothing and kept no ledger; no other lane reported a spend (the workflow journal's `higgsfield_spent` is 0 for every lane but X), and `transactions` shows no charge after lane X's last take (23:02 PDT), so the fixers, W8-I, the critic, W8-C and W8-Z spent nothing. The 0.73 of other TTS in the lanes' hours (below) carries no job id: who spent it is not known. The owner's rule this wave: all of the remaining credits usable (363.44 at day 0); lane X ≤ 240, W2 ≤ 60, W1 ≤ 40; the shared balance never under 20 (`sf-w8-lead.md` §6). Spent **5.44** (lane X, all Qwen Audio 3.0 TTS Flash: batch 1 1.92, batch 2 0.34, batch 3 2.08, batch 4 0.99, batch 5 0.11); balance 363.44 → **357.27**; 0.73 of other TTS on the shared account in the same hours is claimed by no lane (below). Whole-SF round: 422.81 (waves 1–7) + 5.44 = **428.25 credits**.

### Wave 8 · lane X (from docs/opus-bay/ledger/w8-X.md)

Cap **240** credits for wave 8, lane X (lead note `sf-w8-lead.md` §6); the shared balance never goes under **20**. A
generated asset ships only if a side-by-side shot beats what is there. Rules as waves 5–7 (`ledger/w7-X.md`): reject any
draw with text, logos, a base or clipped edges before paying for the next step; no image of a real person, real insignia,
a real mural or artwork, or a brand. The account is shared with other projects and lanes W1 / W2: charges are attributed
by job id and time from `transactions`, never by the balance difference alone.

#### Preflight, 2026-10-01 02:00 UTC (2026-09-30 19:00 PDT)

- `balance` **363.44** (ultra) — the lead's day-0 reading (18:42 PDT) unchanged.
- Wave-8 lane X running total before its first batch: **0.00**.

#### Batch 1 · BAYBAY's voice: lane M's wave-7 games, lane K's plain bubbles, wave 7's muted clips (W8-X1), 2026-10-01 02:01–02:19 UTC

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

#### Batch 2 · lane K's fixed city lines (W8-K3), the 5 muted batch-1 clips again, "Ho! Spot on!" again (W8-X3), 2026-10-01 03:28–03:34 UTC

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

#### Batch 3 · the lanes' new wave-8 lines on origin at 21:10 PDT (W8-X5), 2026-10-01 04:30–04:48 UTC

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

#### Batch 4 · lanes A, W1, W2 and M's lines on origin at 22:15 PDT (W8-X6), 2026-10-01 05:24–05:33 UTC

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

#### Batch 5 · lane K's last fixed lines + the Alcatraz stair redo (W8-X7), 2026-10-01 06:02 UTC

Balance before: **357.38**. Lane K's three new `W8K_LINES` (`tripFly` 抓紧！我们飞过去～, `tripBike`, `tripCar`) × zh / en
+ two redo takes of `zh-w5-al-cd19434a` (the Alcatraz stair line, clipped in batch 4; read gently at 1.0 / 1.1) = 8 takes
(the bell's redo was dropped: no speed gets three bell strokes past the speech-rate gate). Job ids
`C:/Users/willy/opus-qa/w8/x/voice5/jobs1.txt`: 7 completed, 1 failed (608, refunded; its sibling 609 came in).

| # | asset | model / settings | prompt summary | credits | job ids | output | status |
|---|---|---|---|---|---|---|---|
| W8X-VO10 | 6 clips (3 lines × zh / en) + 1 redo | qwen_audio_tts, Pixie | verbatim | 0.01–0.03 a take | 600–605, 609 (608 failed) | `public/opus-bay/w8/voice/` | all pass; the Alcatraz stair line now plays |

**Credits:** 357.38 → **357.27** = **0.11** (06:02:23–06:02:31 UTC: 8 spends, 1 refund). **Wave-8 lane X total: 5.44 credits**
(cap 240). Reconciliation: 363.44 (day 0) − 357.27 = 6.17 = 5.44 lane X + 0.73 other TTS on the shared account (02:29–02:35
and 05:44 UTC, not this lane's).

### Balance trail and reconciliation (wave-8 hand-off, 2026-10-01 ≈ 05:00 PDT)

| step | charges (`transactions`, UTC) | credits | balance after |
|---|---|---|---|
| wave 7 end (above) | — | — | 2213.87 (`balance` 2026-09-30 ≈ 10:30 UTC) |
| other work on the shared account between the waves (not Opus Bay) | the newest of these rows: Seed Audio 1.0 (2026-09-30 23:09:33.050–23:12:51.425), GPT Image 2.5 Flare −2.75 × 4 (23:18:34.998–23:18:35.611), Qwen Audio 3.0 TTS Flash × 9 (23:20:37.386–23:20:38.266), Seedance 2.5 −35, −35, −28, −28 (23:20:53.026–23:21:08.576); not summed row by row here | 1850.43 (by the two balances) | 363.44 (`balance` 2026-10-01 01:42, the lead's day 0 = 18:42 PDT) |
| wave 8 · X batch 1 (W8X-VO1, VO2) | Qwen Audio 3.0 TTS Flash spends and the failed jobs' refunds (02:01:16.171–02:18:57.990) | 1.92 | 361.52 (`balance` 19:22 / 19:26 PDT) |
| TTS on the shared account claimed by no lane | 30 spends, 2 refunds (02:29:39.999–02:35:01.100) | 0.67 | 360.85 (`balance` 20:27 PDT) |
| wave 8 · X batch 2 (W8X-VO3 – VO5) | 31 spends, 3 refunds (03:28:50.829–03:33:21.267) | 0.34 | 360.51 |
| wave 8 · X batch 3 (W8X-VO6, VO7) | spends and refunds (04:30:09.145–04:48:23.638) | 2.08 | 358.43 |
| wave 8 · X batch 4 (W8X-VO8, VO9) | spends and refunds (05:24:53.043–05:33:27.355) | 0.99 | 357.44 (computed) |
| TTS on the shared account claimed by no lane | −0.03 × 2 (05:44:46.303, 05:44:48.727) | 0.06 | 357.38 |
| wave 8 · X batch 5 (W8X-VO10) | 8 spends, 1 refund (06:02:23.330–06:02:31.718) | 0.11 | 357.27 (`balance` read again at this hand-off, ≈ 05:00 PDT, plan ultra) |

Reconciliation: `transactions` read newest first at this hand-off (six pages of 100 and one of 30). The newest row on the
account is 2026-10-01 06:02:31.718 UTC (lane X's batch 5, 23:02 PDT): nothing was charged after the lanes. The 600 rows
from 02:01:16.171 to 06:02:31.718 UTC are all "Qwen Audio 3.0 TTS Flash"; the row before them is "Seedance 2.5" −28 at
2026-09-30 23:21:08.576 UTC, before the day-0 reading. Lane X's ledger attributes its five batches by job id and time; the
0.67 of 02:29–02:35 UTC (19:29–19:35 PDT, after lane X's first agent had stopped and before its resumed agent's first
batch) was re-summed row by row here, twice (30 spends 0.71, 2 refunds 0.04; 0-based offsets 341–372 of the newest-first listing). Sum check: 363.44 − 357.27 = **6.17** = 1.92 +
0.67 + 0.34 + 2.08 + 0.99 + 0.06 + 0.11.

**Wave 8 total: 5.44 credits** recorded for Opus Bay (lane X, all voice) — far under every limit; 0.73 more TTS on the shared account in the same hours is claimed by no one. Balance **357.27** (read again ≈ 05:30 PDT: unchanged; newest charge still 06:02:31.718 UTC).
